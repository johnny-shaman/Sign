/**
 * 形の解決（Pass 3.5）——大きさとバイトオフセットを出す。
 *
 * Pass 3 は型の**名前**を、`target_info.js` はスカラーの**幅**を出す。ここはその2つを
 * 合わせて、`Struct` の各スロットが**どこに在るか**（オフセット）と、値全体が**どれだけ
 * 場所を取るか**（大きさ）を確定させる。`compiler_pipeline.md` §3 が Pass 4 へ渡すと定めた
 * 情報のうち、幅と符号の次に来る最後の一片である。
 *
 * ## 並び順は既に決まっている
 *
 * `stack_abi.md` §7.1 が定める通り、
 *
 * - **名前付きスロット**（`[x : 1 / y : 2]`）は**フィールド名でソートした正規順**に並ぶ。
 *   `==` で等しい構造体が同じ物理配置を持つための規則であり、宣言順は型が (型, 連番) の
 *   形で別に保存している。したがって**詰め込み効率のための並べ替えはしない**——並びは
 *   名前が決めるのであって、コンパイラの裁量ではない。
 * - **連番スロット**（`1 , 2 , 3`）は**宣言順**がそのまま物理配置になる。ソートの鍵となる
 *   名前が無いためである。MMIO・FFI・シリアライズはこちらで書く。
 *
 * ## アラインメントは自然境界（仕様に規定が無かったので、ここで決める）
 *
 * 各スロットは**自分の幅の境界**に置き、構造体全体の境界は最大スロットの境界、全体の
 * 大きさはその境界へ切り上げる。理由は AArch64 のハードウェアにある。
 *
 * - **Device メモリ（MMIO、`Device-nGnRnE`）は境界を跨いだアクセスでフォールトする。**
 *   連番スロットは MMIO を書くための形なので、ここで詰めると動かない
 * - `ldp`/`stp`（ペア転送）は境界を要求する
 * - Normal メモリでも境界跨ぎは遅い
 *
 * 全体を境界へ切り上げるのは、`List(Struct)` の各要素が同じ境界に載るためである
 * ——ストライドが揃わないと `base + i × size` が壊れる。
 */

import { widthsOf, sizeOf, charSizeOf, DEFAULT_CHARSET, reduceToMachineType, literalDigits } from "./target_info.js";
import { envLookup } from "./pass1.js";

function isDefineNode(n) {
  return !!n && n.type === "operation" && n.name === "define";
}

function isIdentifierNode(n) {
  return !!n && n.type === "atom" && n.kind === "identifier";
}

/**
 * **スロットの名前になれるノード。** 識別子と文字列リテラルである（`t : / `+` : 3` の
 * ように、識別子として綴れない名前は文字列で書く）。
 *
 * この基準は interpreter.js の `isSlotKeyNode`、pass3.js の `slotKey`、pass4.js の
 * `isSlotKeyAtom`、そしてここ——**計5箇所で一致していなければならない**。ここだけ
 * 識別子に限っていたため、文字列キーの構造体は行が1つも拾われず、`layoutOfStruct` が
 * `null`（配置できない）ではなく **size 0 のもっともらしいレイアウト**を返していた。
 * 混在（`foo : 1` と ``+` : 2`）ではスロットが黙って1つ消えた。
 */
function isSlotKeyNode(n) {
  return isIdentifierNode(n) || (!!n && n.type === "atom" && n.kind === "string");
}

/**
 * **スロットの名前は、綴りではなく中身である。** 区切り（識別子の `<>`、文字列の
 * バッククォート）は名前の一部ではない——interpreter.js が `slice(1, -1)` で
 * どちらも同じに剥がしているのと同じ規則である。
 *
 * 名前付きスロットの物理配置は**名前のソート順**で決まる（stack_abi.md §7.1）ので、
 * ここで区切りを残すと並びが変わる。``~x`` と `foo` は、中身で比べれば
 * `foo` が先、バッククォート込みで比べれば ``~x`` が先——**同じ構造体が
 * 別の配置になる**。`==` で等しい構造体は同じ物理配置を持つ、という §7.1 の保証が壊れる。
 */
function bareName(value) {
  if (typeof value !== "string" || value.length < 2) return value;
  const head = value[0], tail = value[value.length - 1];
  if (head === "<" && tail === ">") return value.slice(1, -1);
  if (head === "`" && tail === "`") return value.slice(1, -1);
  return value;
}

/**
 * 識別子を束縛先の値ノードまで辿る（Pass 3 の `derefToNode` と同じ規則）。
 *
 * **名前は場所を持たない。** `s : r` の `s` が何バイト要るかは `r` が何であるかで決まり、
 * それは識別子テーブルにしか無い。ここを辿らないと、名前を1つ挟んだだけで大きさが
 * 出せなくなる——`l : [1 2 3]` の後の `s : l` すら測れなかった。
 *
 * 実体の種類（`repr`）も同じ経路で運ばれる。Pass 3 が束縛へ書き戻しているので、
 * 名前を何段挟んでも「これは規則裏打ちである」が Pass 4 まで届く。
 */
function applyBase(node) {
  let n = node;
  while (n && n.type === "operation" && (n.name === "apply" || n.name === "partial_apply")) n = n.left;
  return n;
}

// 器の型（pass3 の同名の集合と同じ顔ぶれ）。
const CONTAINER_TYPES = new Set(["String", "List", "Struct", "Iterator", "Implicit"]);

function deref(node, env, seen = new Set()) {
  if (!node || !env) return node;
  // 適用の結果は呼び先の返値である。`mk : n ? [1 ~ n]` の `mk 5` が何バイト要るかは
  // `mk` の本体にしか無い——そして**それは実行時の `n` に依らない**。規則裏打ちの
  // 大きさは要素数に依らないので、終端が実行時変数でも形は静的に決まる
  // （list_model.md §2.3「終端値 n が実行時変数であっても静的型付け原則は維持される」）。
  if (node.type === "operation" && (node.name === "apply" || node.name === "partial_apply")) {
    const base = applyBase(node);
    if (base && base.type === "atom" && base.kind === "identifier" && !seen.has(base.value)) {
      seen.add(base.value);
      const b = envLookup(env, base.value);
      if (b && b.returnsNode) return deref(b.returnsNode, env, seen);
    }
    return node;
  }
  if (node.type !== "atom" || node.kind !== "identifier") return node;
  // 自己参照・相互参照で回らないようにする（`a : b` / `b : a` は解けないので諦める）。
  if (seen.has(node.value)) return node;
  seen.add(node.value);
  const b = envLookup(env, node.value);
  const next = b && (b.valueNode || b.rhsNode);
  // **仮引数には値ノードが無い。** 束縛だけが「どう置かれているか」を知っている——
  // 呼び出しサイトから観測した `repr` がそこに在る（pass3 の collectCallsiteEvidence）。
  // ここで拾わないと、規則を受け取った仮引数が要素列への参照に見え、`start` をポインタ
  // として読む命令が出る。
  if (!next) {
    if (b && (b.repr || b.elementType)) {
      return {
        ...node,
        atomType: node.atomType || b.atomType,
        repr: node.repr || b.repr,
        elementType: node.elementType || b.elementType,
      };
    }
    return node;
  }
  // 束縛が実体の種類を知っていて、値ノード側が知らないなら引き継ぐ。
  if (b.repr && !next.repr) next.repr = b.repr;
  if (b.elementType && !next.elementType) next.elementType = b.elementType;
  return deref(next, env, seen);
}

// `n` を `align` の倍数へ切り上げる。align が 0/未定なら切り上げない。
function alignUp(n, align) {
  return align > 0 ? Math.ceil(n / align) * align : n;
}

/**
 * 余積の連なりを平らな要素の並びへ均す。`[1 2 3]` の中身がこの形で来る。
 *
 * `push` と `unshift` も余積である。pass2 が空白の解決結果として出す4つの名前
 * （`construct` / `concat` / `push` / `unshift`）は、どれも「列が1段の中で伸びる」ことを
 * 言っているにすぎず、**どちら側から伸びたか**が違うだけである。ここで `push` /
 * `unshift` を均さないと、`[1 2] 3` のように名前を経由せず伸びた列だけ大きさが
 * 出せなくなる——文字列側（``ab` `cd``）が数えられるのと食い違う。
 *
 * 名前も辿る。要素の並びは名前ではなく中身にしか無い。
 */
function flattenConstruct(node, env = null, seen = new Set()) {
  node = deref(node, env, seen);
  if (!node) return [];
  if (node.type === "operation") {
    // `construct` / `concat` は左右とも列。`push` は右が要素、`unshift` は左が要素。
    if (node.name === "construct" || node.name === "concat" || node.name === "push" || node.name === "unshift") {
      return [...flattenConstruct(node.left, env, seen), ...flattenConstruct(node.right, env, seen)];
    }
  }
  // 1行だけのブロックは括りでしかない（`[[1 2] 3]` の外側）。
  if (Array.isArray(node.lines) && node.lines.length === 1) return flattenConstruct(node.lines[0], env, seen);
  return [node];
}

// 直積（`product` の連なり）を平らな配列へ均す。連番スロットがこの形で来る。
const COPRODUCT_OPS = ["construct", "concat", "push", "unshift"];

/**
 * 連番スロットへ均す。**根の演算子と同じ族でだけ割る。**
 *
 * 直積（カンマ）の根なら、割るのは直積だけである——`1 2 , 3 4` の行は `1 2` と `3 4` の
 * 2つであって、`1 2 3 4` の4つではない。行の中の余積まで降りると次元が潰れる。
 * 余積の根なら、割るのは余積だけである——`[1 2] [3 4]` は同じ1段の中で伸びた列なので、
 * 入れ子の余積まで降りるのが正しい。
 *
 * 族を混ぜて割ると、**カンマが上げた次元を勝手に下げてしまう**（`1 2 , 3 4` が
 * `List(Int)` と型付けられ、値の `[[1,2],[3,4]]` と食い違う）。
 */
function flattenByFamily(node, coproduct) {
  const same = (n) =>
    n && n.type === "operation" && (coproduct ? COPRODUCT_OPS.includes(n.name) : n.name === "product");
  const walk = (n) => {
    if (same(n)) return [...walk(n.left), ...walk(n.right)];
    // 余積の側だけ、括りのブロックを剥がして中の余積まで割る。
    if (coproduct && n && Array.isArray(n.lines) && n.lines.length === 1 && same(n.lines[0])) return walk(n.lines[0]);
    return [n];
  };
  return walk(node);
}

function flattenProduct(node) {
  if (!node) return [node];
  const isCoproduct = node.type === "operation" && COPRODUCT_OPS.includes(node.name);
  if (node.type === "operation" && (node.name === "product" || isCoproduct)) return flattenByFamily(node, isCoproduct);
  if (Array.isArray(node.lines) && node.lines.length === 1) return flattenProduct(node.lines[0]);
  return [node];
}

/**
 * ノード1つ分の大きさと境界を返す。決まらなければ null。
 *
 * @returns {{ size: number, align: number }|null}
 */
// 器の入れ子をどこまで測るか。これを超えたら「測れない」と答える——実用上の入れ子は
// 数段で、それ以上は型が自己参照になっている印である（下の注を参照）。
const MAX_NEST = 32;

function measure(node, conf, depth = 0) {
  if (!node) return null;
  const { target, charset = DEFAULT_CHARSET, env = null } = conf;
  if (!widthsOf(target)) return null;
  // **自分を含む型は測れない。** 器の要素がまた同じ器になる形（`List(List(List(…)))`）は
  // 底に着かないので、大きさが存在しない。ここを見ていなかったため、そういう型が出来た
  // 瞬間にスタックを食い潰して落ちていた——**落ちるのと「測れない」は別**である（原理4）。
  // 測れないと答えれば、呼び出し側が名指しできる。
  //
  // 見るのは深さであってノードの同一性ではない。要素のノードは段ごとに作られるので、
  // 同じものを2度通ったかでは捕まらない——「底に着かない」ことの観測可能な形は
  // 「いくら降りても終わらない」である。
  //
  // 型が自己参照になること自体は推論の側の問題だが、測る側が検出できないと、どこで
  // 壊れたのかも分からなくなる。
  if (depth > MAX_NEST) return null;
  // 型は識別子のノードにも付いているが、**大きさは中身にしか無い**ので辿る。
  const named = node;
  node = deref(node, env);
  const type = node.atomType || named.atomType;
  if (!type) return null;

  // 零対象は場所を占めない。
  if (type === "Unit") return { size: 0, align: 1 };

  // **前置 `~`（持ち上げ）は器を1つ作る。型の振り分けより先に見る。**
  //
  // 器に当てれば恒等なので、測るのは中身そのものである（`[x] ≅ x` の潰れが効くので
  // 持ち上げても何も増えない。冪等：`~~5` は `~5`）。スカラーに当てたときだけ表現が
  // 変わり、要素1つの器になる——型では無償、表現では有償（原理8）。
  //
  // 以前ここは `Implicit`（場所）へ行っており、スカラーの持ち上げが `{ptr}` 8 byte に
  // なっていた。番地を表に出さないと決めた以上「場所」という観測可能な型は仕事を失って
  // おり、残るのは長さ1の器＝`List` である。
  //
  // 型の分岐より前に置くのは、**持ち上げたノードは中身の型を名乗る**からである。
  // `~s`（`String`）を後ろへ置くと String の分岐が先に捕まえ、文字列の長さを持ち上げ
  // ノードから数えようとして落ちる。
  if (node.type === "operation" && node.position === "prefix" && node.name === "continuous" && node.operand) {
    const t = deref(node.operand, env).atomType || node.operand.atomType;
    const inner = measure(node.operand, conf, depth + 1);
    if (!inner) return null;
    if (CONTAINER_TYPES.has(t)) return inner; // 既に器なので恒等
    return { size: inner.size, align: inner.align, repr: "cells", stride: inner.size, count: 1 };
  }

  // **「どう置かれているか」は型より先に見る。** カーソルの型は列の型（`String` など）
  // だが、置かれているのは `{arm, k, 入力}` の3つ組であって要素の並びではない。型の側の
  // 分岐（`String` は要素の並び）へ先に落ちると、規則が器に化ける。
  if (node.repr === "cursor" || named.repr === "cursor") return measureCursor(node.repr === "cursor" ? node : named, conf);

  // **`Char` の記憶上の幅は charset が決める**（1 or 4 byte）。レジスタ上は GPR だが
  // （符号位置という整数なので）、置くときは1文字ぶんである。
  if (type === "Char") {
    const w = charSizeOf(charset);
    return { size: w, align: w, repr: "cells", stride: w, count: 1 };
  }

  // `String ≅ List(Char)`。要素幅は charset が決める。長さはリテラルなら数えられる。
  if (type === "String") {
    const w = charSizeOf(charset);
    const n = stringLength(node, env);
    return n === null ? null : { size: n * w, align: w, repr: "cells", stride: w, count: n };
  }

  // **場所**（参照）は指す先を持たない。置かれるのは指し方そのものである。
  // 今これを生むものは無い——前置 `~` が上へ移ったので、`'` と前置 `#` が
  // 参照を返すようになるまでは出番が無い（type_system.md §4）。
  if (type === "Implicit") return measureImplicit(node, conf);

  // **規則裏打ち**（レンジ）は要素を持たない。置かれるのは規則そのものである。
  // **`Iterator` は型そのものが規則だと言っている**（type_system.md §2 のアクセス表：
  // 添字は必ずしもロードではない）。`repr` の印が付いていなくても規則である。曖昧なのは
  // `List` の方で、あちらは場所（`[1 2 3]`）にも規則（`[1 ~ 5]`）にもなる。
  if (node.repr === "rule" || node.atomType === "Iterator") return measureRule(node, conf);
  if (type === "List") return measureList(node, conf, depth);
  if (type === "Struct") {
    const l = layoutOfStruct(node, conf);
    return l && { size: l.size, align: l.align };
  }

  // スカラー。幅がそのまま境界になる（自然境界）。
  const size = sizeOf(type, target);
  return size === null ? null : { size, align: size };
}

/**
 * 文字列の文字数。バッククォートを剥がしてコードポイント単位で数える
 * （サロゲートペアを2文字と数えないため `[...s]` を使う）。
 *
 * **連結も数える。** `String ≅ List(0u)`（type_system.md §2）である以上、文字列は
 * 余積で伸びる列であり、両辺の長さが分かれば全体の長さも分かる——`[1 2] ~ [3 4]` の
 * 要素数が数えられるのと同じことである。ここを数えないと、同型が片側だけ成立している
 * ことになる（型は `String` と言えるのに大きさが言えない）。
 *
 * 名前も辿る。長さは名前ではなく中身にしか無い。
 *
 * 静的に決まらないもの（実行時に伸びる連結）は null。**それは失敗ではなく事実である**
 * ——長さが実行時に決まる値は場所を先に取れないので、参照として渡すしかない
 * （`Implicit`、return_value_addressing.md）。ここで嘘の数を返してはいけない。
 */
function stringLength(node, env = null, seen = new Set()) {
  node = deref(node, env, seen);
  if (!node) return null;
  if (node.type === "atom" && node.kind === "string") return [...node.value.slice(1, -1)].length;
  if (node.type === "atom" && node.kind === "char") return 1;
  // `0u….` は Char 1個。U+0000 は Unit なので 0 個（niche、value_representation.md §3）。
  if (node.type === "atom" && node.kind === "unicode") return parseInt(literalDigits(node.value), 16) === 0 ? 0 : 1;
  // 余積（`construct` / `concat`）は両辺の和。片方でも決まらなければ全体も決まらない。
  if (node.type === "operation" && (node.name === "construct" || node.name === "concat")) {
    const l = stringLength(node.left, env, seen);
    if (l === null) return null;
    const r = stringLength(node.right, env, seen);
    return r === null ? null : l + r;
  }
  // 1行だけのブロックは括りでしかない（`[`ab`]` は ``ab`` と同じ）。
  if (Array.isArray(node.lines) && node.lines.length === 1) return stringLength(node.lines[0], env, seen);
  return null;
}

/**
 * 場所（`Implicit(T)`）の大きさ。**参照が運ぶのは、型が語らないものだけである。**
 *
 * `stack_abi.md` §7.5 が答えを持っている。スライスの実装は
 *
 *     result_ptr = base + 1 * num_cols * sizeof(elem)
 *     result_len = 2 * num_cols
 *
 * の2つだけであり（「これだけ（メモリコピーなし）」）、`'` が返すのは `Implicit` である
 * （type_system.md §4）。つまり列への参照は `{ptr, len}` のファットポインタである。
 *
 * なぜ `len` が要るのかは型を見れば分かる。**Sign の `List(T)` は要素数を型に持たない**
 * ——要素数は定義した場所のノードにしか無いので、呼び出しごとに違う長さが渡る関数側では
 * 型から復元できない。だから参照がそれを運ぶ。逆にスカラーや構造体は大きさが型で
 * 決まりきっているので、運ぶものはアドレス1つで足りる。
 *
 * | 指す先 | 型が語らないもの | 実体 | AArch64 |
 * |---|---|---|---|
 * | スカラー・構造体・イテレータ | 無い（大きさは型で決まる） | `{ptr}` | 8 byte |
 * | `List(T)` ・ `String` | 要素数 | `{ptr, len}` | 16 byte |
 *
 * これは `Iterator` が「規則を運ぶ」のと同じ形の説明である——どちらも、**型に書いて
 * ない分だけを実体が持つ**。型と実体が二重に同じことを言わない、というのが一貫している。
 */
function measureImplicit(node, conf) {
  const { target } = conf;
  const w = widthsOf(target);
  if (!w) return null;
  const ptr = w.gpr;
  const el = node.elementType;
  // 要素数が型に無いもの（列）だけが `len` を伴う。
  const carriesLength = el === "List" || el === "String";
  const fields = carriesLength ? ["ptr", "len"] : ["ptr"];
  return {
    size: ptr * fields.length,
    align: ptr,
    repr: "place",
    fields: fields.map((name, i) => ({ name, offset: i * ptr, size: ptr, type: name === "ptr" ? "Address" : "Int" })),
    access: carriesLength ? "ptr + i × sizeof(T)（len で範囲を検査できる）" : "ptr を辿る",
    pointee: el || null,
  };
}

/**
 * 規則裏打ち（レンジ）の大きさ。要素は**置かれない**——置かれるのは規則である。
 *
 * ここで `Iterator` と `List` の差がバイト単位で現れる。**差は `end` フィールド1つ**である。
 *
 *   `0 ~+ 1`   → `{start, step}`        終端が無い＝数え上げられない → `Iterator(T)`
 *   `1 ~ 5`    → `{start, step, end}`   終端がある＝数え上げられる   → `List(T)`
 *
 * 型が「何ができるか」（`|.|` が答えられるか）で2つを分けているのと、レイアウトが
 * フィールド1つで分けているのが**同じ線**になっている。型と実体が別々の話でありながら
 * 食い違っていない、という確認でもある。
 *
 * 添字は `base` からのロードではなく `start + i × step` の**算術**になる
 * （type_system.md §2 のアクセス表、`Iterator(T)` の行）。
 */
function measureRule(node, conf) {
  const { target } = conf;
  const el = node.elementType;
  // **本数は要素の幅に依らない。** 規則が持つのは `{start, step}` か `{start, step, end}` の
  // 3つ組であり、要素型が分からなくても**何本で運ぶか**は決まる（stack_abi.md §4.6）。
  // 幅だけが未確定なので、そこは GPR 幅を置く——`size` を使う側（アラインメントや
  // オフセット計算）が要素型を要求するなら、そちらで名指しすればよい。
  const w = el ? sizeOf(el, target) : (widthsOf(target) || {}).gpr || 8;
  if (w === null) return null;
  const fields = node.atomType === "Iterator" ? ["start", "step"] : ["start", "step", "end"];
  return {
    size: w * fields.length,
    align: w,
    repr: "rule",
    fields: fields.map((name, i) => ({ name, offset: i * w, size: w, type: el })),
    access: "start + i × step",
  };
}

/**
 * **カーソル**（`{arm, k, 捕まえた入力}`）。規則の一般形である。
 *
 * レンジが `start + i × step` で引けるのは規則が一次だからだが、列を作る関数はどれも
 * 「有限個の要素を並べて自分をもう一度呼ぶ」形をしているので、`(どの枝か, 枝の中で何番目か,
 * 残りの入力)` という3つ組で同じことができる（stream_desugar.js）。要素はどこにも置かれず、
 * 訊かれたときに計算する——**器を作るのではなく引ける規則を作る**の一般形である。
 *
 * 尽きているかは `arm` が niche かで分かる。入力が空になれば枝を選ぶ関数（`_arm`）が
 * 完全性公理で `__` を返すので、そのまま先頭のフィールドに現れる。
 */
function measureCursor(node, conf) {
  const w = (widthsOf(conf.target) || {}).gpr;
  if (!w) return null;
  // **捕まえた入力の幅は、捕まえたものが決める。**
  //
  // カーソルは `(枝番号, 枝の中の位置, 入力)` の組であり、最初の2つは常に1本だが
  // 3つ目は入力次第である——器なら `{ptr, len}` の2本、規則なら3本、スカラーなら1本。
  // 既定を「器の2本」と決め打ちしていたので、スカラーを捕まえたカーソルで本数が合わな
  // かった（構築側は3本を出し、測る側は4本だと言う）。組そのものが在るならそれを測る。
  const parts = cursorParts(node);
  let inner = node.cursorInner || 0;
  if (!inner && parts) {
    const m = passingOf(parts[2], conf);
    inner = m ? Math.max(m.slots, 1) : 0;
  }
  if (!inner) inner = 2;
  const tail = inner === 1 ? ["入力"] : inner === 3 ? ["start", "step", "end"] : ["ptr", "len"];
  const names = ["arm", "k", ...tail];
  return {
    size: w * names.length,
    align: w,
    repr: "cursor",
    fields: names.map((name, i) => ({ name, offset: i * w, size: w, type: name === "ptr" ? "Address" : "Int" })),
    access: "at(arm, k, 入力)",
  };
}

// カーソルの組 `(枝番号, 位置, 入力)` を取り出す。組そのものでなければ null。
function cursorParts(node) {
  let n = node;
  while (n && Array.isArray(n.lines) && n.lines.length === 1) n = n.lines[0];
  // 分岐なら枝それぞれがカーソルである。どの枝も同じ形なので、最初に読めた枝で決まる
  // ——揃っていなければ `genMatch` が「枝の幅が揃いません」と言う。
  if (n && Array.isArray(n.lines)) {
    for (const line of n.lines) {
      const v = line && line.type === "operation" && line.name === "define" ? line.right : line;
      const p = cursorParts(v);
      if (p) return p;
    }
    return null;
  }
  if (!n || n.type !== "operation" || n.name !== "product") return null;
  // **結合の向きに依存しない歩き方をする。** 片方へ降りる while ループは「左結合で
  // 積まれている」を前提にしており、`,` の結合を仕様どおり（右結合）に直した瞬間に
  // 並びが崩れる。左右とも再帰で開けば、どちらから畳まれていても同じ並びが出る
  // ——`flattenByFamily` が既にその形である。
  const out = flattenProduct(n);
  return out && out.length === 3 ? out : null;
}

function measureList(node, conf, depth = 0) {
  const items = listItems(node, conf && conf.env);
  if (items === null) return null;
  // 要素は同一型（`List` の同一型制約、§2）なので、先頭1個を測れば全体が出る。
  // 降りた段数を渡す——底に着かないなら、そこで測れないと答える。
  const first = items.length > 0 ? measure(items[0], conf, depth + 1) : null;
  if (!first) return null;
  // 要素をその境界へ切り上げた大きさがストライドになる。
  const stride = alignUp(first.size, first.align);
  return { size: stride * items.length, align: first.align, stride, count: items.length, repr: "cells" };
}

// List の要素ノードを取り出す。`[1 2 3]` は paren ブロックの中に余積1本が入っているが、
// `[1 2] 3` のようにブロックを経ずに伸びた形もある。どちらも同じ余積である。
function listItems(node, env = null) {
  // 均質な直積も List である（カンマは次元を上げるが、上げた結果が多相とは限らない）。
  // その場合スロットは `product` の連なりで来るので、こちらも均す。
  if (node.type === "operation" && node.name === "product") return flattenProduct(node);
  if (Array.isArray(node.lines)) {
    if (node.lines.length === 1) return flattenConstruct(node.lines[0], env);
    return node.lines;
  }
  const items = flattenConstruct(node, env);
  // 均せずに自分自身が返ってきたなら、それは列ではない（数えようがない）。
  return items.length === 1 && items[0] === node ? null : items;
}

/**
 * `Struct` のレイアウトを出す。
 *
 * @returns {{ size, align, slotKind, slots: Array<{name?, ordinal, type, offset, size, align}> }|null}
 */
/**
 * **いま並びを起こしている途中の構造体。**
 *
 * `a : / b : a` のような自分を含む構造体は、並びを起こそうとすると回り続ける
 * ——`layoutOfStruct` → `packSlots` → `slotCellSize` → `passingOf` → `measure` →
 * `layoutOfStruct` と戻ってくるからである。**引数で持ち回すと途中の1つが渡し忘れた
 * だけで穴が開く**（実際 `slotCellSize` は conf しか受け取らない）ので、経路を選ばない
 * ところに置く。同期呼び出しなので、これで漏れなく止まる。
 *
 * 止めたところは並びが出ない（null）。無限に回るのでも例外で落ちるのでもなく、
 * 「決まらない」と言う（原理4）。以前は診断ではなく
 * `Maximum call stack size exceeded` で落ちていた。
 */
const LAYOUT_IN_PROGRESS = new Set();

function layoutOfStruct(node, conf) {
  // 構造体も名前を経由できる。`p2 : p` のスロット配置は `p` にしか無い。
  node = deref(node, conf && conf.env);
  if (!node || node.atomType !== "Struct") return null;
  if (LAYOUT_IN_PROGRESS.has(node)) return null;
  LAYOUT_IN_PROGRESS.add(node);
  try {
    return layoutOfStructInner(node, conf);
  } finally {
    LAYOUT_IN_PROGRESS.delete(node);
  }
}

function layoutOfStructInner(node, conf) {

  // マージの結果はスロット表を直接持つ（list_model.md §5.3）。元の宣言は2つ以上の
  // 構造体へ散っているので、並べられるのは畳んだ後のスロットだけである。物理配置は
  // 他の名前付き構造体と同じく名前順——マージで作ったからといって配置規則は変わらない。
  if (node.mergedSlots) {
    const entries = [...node.mergedSlots].map(([k, v], ordinal) => ({ name: bareName(k), ordinal, node: v }));
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return packSlots(entries, conf, "named");
  }

  // 名前付き: 宣言順（連番）を確定させてから、**名前でソートして並べる**（stack_abi.md §7.1）。
  // 並びが物理配置、各スロットが持つ ordinal が宣言順である。詰め込みのための並べ替えは
  // しない——並びを決めるのは名前であって、コンパイラの裁量ではない。
  if (node.slotKind === "named") {
    const entries = [];
    (node.lines || []).forEach((line, ordinal) => {
      if (isDefineNode(line) && isSlotKeyNode(line.left)) {
        entries.push({ name: bareName(line.left.value), ordinal, node: line.right });
      } else if (isIdentifierNode(line)) {
        entries.push({ name: bareName(line.value), ordinal, node: line });
      }
    });
    // **拾えなかった行が1つでもあれば配置しない。** 拾えた分だけで並べると、
    // 消えたスロットのぶん小さい「もっともらしいレイアウト」が出て、確保も添字も
    // 静かにずれる。決まらないことは null で言う（原理4）。
    if (entries.length !== (node.lines || []).length) return null;
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return packSlots(entries, conf, "named");
  }

  // 連番: 宣言順がそのまま物理配置。ソートの鍵となる名前が無いためである。
  if (node.slotKind === "positional") {
    const slots = flattenProduct(node);
    // 分解できなければオフセットは出ない。**自分自身を1スロットとして数えない**
    // ——数えると `measure` が同じノードへ戻ってきて無限に回る。
    if (slots.length === 1 && slots[0] === node) return null;
    const entries = slots.map((n, ordinal) => ({ ordinal, node: n }));
    return packSlots(entries, conf, "positional");
  }

  return null;
}

// スロットを順に自然境界へ置いていく。全体の境界は最大スロットの境界、全体の大きさは
// その境界へ切り上げ——`List(Struct)` の各要素が同じ境界に載るために要る。
/**
 * **スロット1つに何バイト要るか。**
 *
 * `measure` は「その値の中身の長さ」を測る。中身の長さが型に無いもの——`Struct` /
 * `String` / `List`——では `null` になるが、それは**置けない**という意味ではない。
 * 参照で運ぶ型はその参照ぶんを置けばよく、`passingOf` がその幅を答える
 * （`Struct` は `{ptr}` の 8 byte、`String`/`List` は `{ptr, len}` の 16 byte）。
 *
 * **同じ取り違えを今日3度踏んだ。** リストの要素（`elementCellSize`）、sret の計画、
 * そしてここである。`measure` は中身、`passingOf` は運ぶ幅——**並べるときに要るのは
 * 後者**である。ここで `null` を返していたので、`Struct` を1つでもスロットに持つ構造体
 * （parser.sn の `acc`）は形が出なかった。
 *
 * 中身の長さが分かるもの（文字列リテラルなど）はこれまで通り `measure` の答えを使う
 * ——先に測って、測れないときだけ運ぶ幅へ落ちる。
 */
function slotCellSize(node, conf) {
  // **先に訊くのは「どう運ぶか」である。** ここを `measure` から訊いていたため、
  // **リテラルの文字列で答えが変わっていた**——`` `ab` `` は中身が読めるので `measure` が
  // 2 バイトと答えて成功し、参照へ落ちる道に入らない。ところが出す側は `{ptr, len}` の
  // 16 バイトを書くので、次のスロットの位置が 2 バイト目になり **ptr を踏み潰す**。
  //
  // 中身が読めることと、そこに何バイト置かれるかは別の問いである。置かれるのは運ぶ姿の
  // 方なので、参照で運ぶ型はその幅で数える——中身が読めるかどうかに関わらず。
  const pass = passingOf(node, conf);
  if (pass && pass.mode === "reference" && pass.size) return { size: pass.size, align: 8 };
  return measure(node, conf);
}

function packSlots(entries, conf, slotKind) {
  const slots = [];
  let offset = 0;
  let maxAlign = 1;
  for (const e of entries) {
    const m = slotCellSize(e.node, conf);
    if (!m) return null;
    const align = m.align || 1;
    offset = alignUp(offset, align);
    // **内側の構造体の並びも載せる。** スロットには `{ptr}` の 8 byte しか置かれない
    // ので、`p ' inner ' x` のように辿るとき、内側がどこに何を持つかを知っているのは
    // ここだけである。型名（`"Struct"`）だけ残して並びを捨てていたため、Pass 4 は
    // 内側を引く命令を選べなかった。
    //
    // `seen` で自己参照を止める。`measure` の入れ子ガード（MAX_NEST）は
    // `layoutOfStruct` を経由すると depth が渡らずリセットされるので、ここは別に持つ。
    const shape = e.node && e.node.atomType === "Struct" ? layoutOfStruct(e.node, conf) : null;
    slots.push({
      ...(e.name !== undefined ? { name: e.name } : {}),
      ordinal: e.ordinal,
      type: e.node.atomType,
      offset,
      size: m.size,
      align,
      ...(shape ? { shape } : {}),
    });
    offset += m.size;
    if (align > maxAlign) maxAlign = align;
  }
  return { size: alignUp(offset, maxAlign), align: maxAlign, slotKind, slots };
}

/**
 * レイアウトを1行ずつの読める形にする（観測用）。
 */
function formatLayout(layout) {
  if (!layout) return "(決まらない)";
  // 規則裏打ちは要素ではなく規則が並ぶ。`end` の有無が Iterator と List を分けている。
  if (layout.repr === "rule") {
    const head = `size ${layout.size} / align ${layout.align} / rule`;
    const body = layout.fields.map((f) => `  +${String(f.offset).padStart(3)}  ${f.name.padEnd(8)} ${String(f.type).padEnd(8)} ${f.size} byte`);
    return [head, ...body, `  添字: ${layout.access}`].join("\n");
  }
  const head = `size ${layout.size} / align ${layout.align} / ${layout.slotKind}`;
  const body = layout.slots.map(
    (s) => `  +${String(s.offset).padStart(3)}  ${(s.name !== undefined ? s.name : `[${s.ordinal}]`).padEnd(8)} ${String(s.type).padEnd(8)} ${s.size} byte  (宣言順 ${s.ordinal})`
  );
  return [head, ...body].join("\n");
}

/**
 * 値が呼び出しをどう渡るか（`stack_abi.md` §4.6）。決まらなければ null。
 *
 * **参照で渡すのは「メモリに置かれているもの」だけである。**
 *
 *   スカラー          値渡し   レジスタ1本（§4.2）
 *   規則（レンジ）      値渡し   `{start, step, end}` がそのまま乗る
 *   要素の並び         参照渡し `{ptr}` または `{ptr, len}`
 *
 * 規則はメモリ上に無いので、指す先が無く参照を作れない。§5 のまとめが
 * `c : [0 ~+ 1]` を「ゼロ（レジスタのみ）」と書いているのはこのことである。
 *
 * 要素の並びは常にメモリを占める。そして `List(T)` は要素数を型に持たないので、
 * 値渡しにすると同じ型でも呼び出しごとに渡し方が変わってしまう。参照で揃えることで
 * **渡し方が型だけで決まる**という性質が保たれる。
 *
 * 参照が何を運ぶかは `Implicit` と同じ規則である——型が語らないものだけを運ぶ。
 *
 * @returns {{ mode: "register"|"reference", size, align, fields?, pointee? }|null}
 */
function passingOf(node, conf) {
  if (!node) return null;
  const { target, env = null } = conf;
  const w = widthsOf(target);
  if (!w) return null;
  const named = node;
  const target_ = deref(node, env);
  const type = target_.atomType || named.atomType;
  if (!type) return null;
  // 零対象は何も渡らない。
  if (type === "Unit") return { mode: "register", size: 0, align: 1, slots: 0 };
  // スカラーは値そのものがレジスタに乗る。
  const machine = reduceToMachineType(type, target);
  if (machine) return { mode: "register", size: machine.size, align: machine.size, slots: 1, class: machine.class, signed: machine.signed };
  // 規則（レンジ・イテレータ）はメモリ上に無いので、そのままレジスタへ乗る。
  //
  // 測るのは**辿った先**である。識別子そのものは「どう置かれているか」を持たない——
  // 持っているのは束縛の側で、`deref` がそれを載せて返す。ここで元のノードを測ると
  // 型（`List`）だけが残り、規則が参照に化ける。
  const shaped = named.repr ? named : { ...named, atomType: type, repr: target_.repr, elementType: named.elementType || target_.elementType, cursorInner: named.cursorInner || target_.cursorInner };
  const m = measure(shaped, conf);
  // カーソルも規則である（`{arm, k, 入力}`）。メモリ上に無いのでレジスタへ乗る。
  if (m && m.repr === "cursor") {
    return { mode: "register", size: m.size, align: m.align, slots: m.fields.length, fields: m.fields, cursor: true };
  }
  if (m && m.repr === "rule") {
    return { mode: "register", size: m.size, align: m.align, slots: m.fields.length, fields: m.fields };
  }
  // 場所（`Implicit`）は既に参照そのものである。
  if (m && m.repr === "place") return { mode: "reference", size: m.size, align: m.align, slots: m.fields.length, fields: m.fields, pointee: m.pointee };
  // 要素の並びは参照で渡す。運ぶものは型が語らない分だけ——要素数が型に無い
  // （`List` / `String`）なら `len` を伴う。
  //
  // **器だと分かれば、中身が何かを知らなくても運び方は決まる。** `Container` は「器で
  // ある」としか言っていない型だが（要素の項目が無いブラケット `[~st]` がこれを付ける）、
  // `{ptr, len}` の2本という運び方は `List` でも `String` でも同じである——**運ぶ幅は
  // 中身の型を見ていない**。ここに枝が無かったので、器として受けた途端に「返値の渡し方が
  // 決まりません」になっていた。
  if (type === "List" || type === "String" || type === "Struct" || type === "Container") {
    const carriesLength = type !== "Struct";
    const names = carriesLength ? ["ptr", "len"] : ["ptr"];
    return {
      mode: "reference",
      size: w.gpr * names.length,
      align: w.gpr,
      slots: names.length,
      fields: names.map((n, i) => ({ name: n, offset: i * w.gpr, size: w.gpr, type: n === "ptr" ? "Address" : "Int" })),
      pointee: type,
    };
  }
  // **直和は広い方へ揃える**（type_system.md §2「表現の違う枝の直和は広い方に揃える」）。
  //
  // `Char | String` は「1本の枝と2本の枝」であり、型の側に1つの答えは無い。置き方の話
  // なので、決めるのはここである——広い方（参照）で揃えれば、どの枝も同じ本数で運べる。
  // **狭い枝を広げるのに確保は要らない**：リテラルなら `.rodata` に置き場所があり、
  // 入力から来た値なら元の器の中に在る。要るとすれば計算した値だけで、それは Pass 4 が
  // 名指しする（`genWidened`）。
  if (type.includes(" | ")) {
    // 型だけを渡す。ノードごと渡すと `deref` が同じ直和へ戻ってきて回り続ける。
    const parts = type
      .split(" | ")
      .map((t) => passingOf({ atomType: t.trim(), elementType: node.elementType }, { target, charset: conf.charset }));
    if (parts.some((p) => !p)) return null;
    const widest = parts.reduce((a, b) => (b.slots > a.slots ? b : a));
    return widest.slots <= 2 ? widest : null;
  }
  // 族（`Atom` / `Scalar`）は、まだ渡し方が決まらない。
  return null;
}

export { measure, layoutOfStruct, formatLayout, alignUp, passingOf, stringLength, flattenProduct };
