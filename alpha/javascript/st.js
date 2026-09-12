/**
 * SignType（`.st` / `.ist`）の生成。
 *
 * type_system.md §6 が定める型シグネチャ形式へ、Pass 1〜3 が確定した型情報を書き出す。
 * 型は「宣言」されるものではなく「コードから読み取って書き写す」だけの存在であり（§1）、
 * ここはその書き写しを行う場所である。
 *
 * ## `.st` と `.ist` の違いは**範囲だけ**で、形式は同じ
 *
 * | | 内容 | 実体 |
 * |---|---|---|
 * | `.st` | `#`/`##`/`###` で export された識別子のみ | ディスク上のビルド成果物 |
 * | `.ist` | 非公開の内部識別子を含む全て | **プロセス内メモリのみ**（compiler_pipeline.md §4） |
 *
 * `.ist` をディスクへ書かないのはセキュリティ上の規定である——内部識別子名・内部 struct の
 * フィールド構成・アクセスパターンが載るため、ファイルを経由させると意図しない漏洩経路に
 * なりうる。したがって `scope: "ist"` は**デバッグ目的の文字列生成のみ**に使い、ビルド
 * 成果物として永続化してはならない。
 *
 * ## 未解決の型は `_`（ホール）で書く
 *
 * §6 の形式は「型が分からない」を表す記法を定めていない。ここでは Sign のホール記法 `_` を
 * 「まだ埋まっていないスロット」の意味で流用する。これは提案であり確定した記法ではない。
 * 未解決を伏せずに出すことが目的である——型システムに消費者が居ないうちは、間違った型も
 * 欠けた型も観測されないままになる。`.st` はその最初の観測手段である。
 */

import { inferLambdaParamTypes, pointfreeSignature, IDENTITY } from "./pass3.js";
// ノードの形を見るだけの述語と、名前の綴りを剥ぐ規則は layout.js が唯一の置き場である
// （理由はそこの `isDefineNode` のコメント）。`bareName` は `<name>` → `name`——識別子
// トークンは常に山括弧で囲まれている（pass1 の判定基準と同じ）。ここで渡す名前は
// 識別子ノードの `value` か、pass3 が `bareKey` で既に剥いだマージ済みスロットの鍵だけ
// なので、layout.js 側がバッククォートも剥ぐことはここでは観測されない。
import { isDefineNode, isIdentifierNode, bareName } from "./layout.js";

const UNKNOWN = "_";

function isLambdaNode(n) {
  return !!n && n.type === "operation" && n.name === "lambda";
}

// 単一の identifier ノード、または params ノードから仮引数エントリを取り出す。
function paramEntries(paramNode) {
  if (!paramNode) return [];
  if (isIdentifierNode(paramNode)) return [{ name: paramNode.value, rest: false, hasDefault: false }];
  if (paramNode.type === "params") {
    return (paramNode.entries || []).map((e) => ({
      name: e.name,
      rest: !!e.rest,
      hasDefault: e.default !== null && e.default !== undefined,
      pattern: e.pattern || null,
    }));
  }
  return [];
}

/**
 * 本体が `'` でどのフィールドへアクセスしているかを識別子ごとに集める
 * （§6.2「関数仮引数のフィールド要求も `.st` に自動生成する」）。
 *
 * Hindley-Milner のような制約ソルビングではなく、アクセスされたキー名を集合として
 * 集めるだけの単純な走査である。分岐でアクセスが変わる場合は和集合になる。
 * 別関数へのパススルーは追わない（§6.2 の NOTE が別途の課題としている）。
 */
function collectFieldRequirements(bodyNode, paramNames) {
  const fields = new Map();
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "operation" && node.name === "get_prop") {
      const base = node.left;
      const key = node.right;
      // **仮引数はフィールド名になれない。** 仮引数は実行時に値が入る場所であり、
      // 名前ではない——`f : l i ? l ' i` の `i` は添字であって「i というフィールド」
      // ではない。type_system.md §2 が OK 例として明示している `list ' i`（`i` は実行時
      // 変数でよい）がまさにこの形なので、ここを取り違えると添字の書き方が全部
      // 「フィールド要求」に化ける。
      //
      // 右辺が識別子のとき名前と読むか値と読むかは左辺が決める、というのが `'` の規則
      // （interpreter.js の getPropValue）。左辺が未解決の仮引数なら決め手が無いので、
      // せめて**右辺が仮引数であるときは値である**と分かる分だけは取り違えない。
      if (
        isIdentifierNode(base) &&
        paramNames.has(base.value) &&
        isIdentifierNode(key) &&
        !paramNames.has(key.value)
      ) {
        if (!fields.has(base.value)) fields.set(base.value, new Set());
        fields.get(base.value).add(bareName(key.value));
      }
    }
    for (const k of ["left", "right", "operand", "middle"]) visit(node[k]);
    for (const line of node.lines || []) visit(line);
    for (const e of node.entries || []) visit(e.default);
  }
  visit(bodyNode);
  return fields;
}

// 仮引数1つ分の型表記を作る。フィールド要求が集まっていればそれを優先する
// （`{x, y}` は「少なくとも x, y を持つ構造体」という構造的な要求）。
function paramTypeText(entry, usageTypes, fieldReqs) {
  if (entry.pattern) {
    // ブラケット分割代入パターン。実引数は1個で、その中身が分解される。器の型は rest
    // ——`[h ~t]` の `t` が残りの集合そのものだからである（pass3 の inferLambdaParamTypes）。
    // 型が分かればそれを書き、分からないときだけ形を書く。
    const restEntry = entry.pattern.find((p) => p.rest && p.name);
    const container = restEntry ? usageTypes.get(restEntry.name) : null;
    // **`Container` は形より弱い。** 「器である」としか言っていないのに対し、形は
    // 「器であり、こう分解する」まで言う。分からないときだけ形を書く、ではなく——
    // **多くを言っている方を書く**。要素の項目が無いパターン（`[~st]`）は器だとしか
    // 決まらないので、そこは形が残る。
    if (container && container !== "Container") return container;
    const inner = entry.pattern.map((p) => bareName(p.name) + (p.rest ? "~" : "")).join(" ");
    return `[${inner}]`;
  }
  const fields = fieldReqs.get(entry.name);
  if (fields && fields.size > 0) return `{${[...fields].sort().join(", ")}}`;
  const inferred = usageTypes.get(entry.name);
  if (inferred) return entry.rest ? `${inferred}~` : inferred;
  // 裸の仮引数（rest でもブラケット分割代入でもない）は**1個の値**を受ける。集合を受け取る
  // なら `[x ~xs]`（参照渡し）か `~xs`（stream）で宣言するので、宣言の形が既に「点である」
  // ことを語っている（原理3 の表）。さらにデフォルトが無ければ `__` を渡せない——完全性
  // 公理により呼び出しごと潰れるので、本体に入った時点で非Unitが保証される。
  //
  // したがって演算子から何も逆算できなくても `_` ではなく `Atom` まで書ける。`Atom` は
  // §4 の記法定義で「String を**含む**スカラー」＝ `Scalar | String` である。多相に見えて
  // 下限が決まっている——具体的な型は呼び出しサイトで確定する（§5 Pass 1b）。
  //
  // rest とブラケットには付けない。前者は stream、後者は構造であり、どちらも点ではない。
  return entry.rest ? `${UNKNOWN}~` : UNKNOWN;
}

// ノード1つ分の型表記。`List` は要素型を伴って `List(T)` と書く（§2 の記法）。
//
// 要素型を落とすと「整数のリスト」と「実数のリスト」が同じ `List` になり、単一の実数
// （`Float`）とも区別が付かなくなる。要素型は Pass 4 が `base + i × sizeof(T)` を出すのに
// 要る情報であり、型の側で最も落としてはいけない部分である。
//
// なお1要素のリストはスカラーと同型なので（`[5]` は `Int`）、`List(T)` が付くのは
// 2要素以上か構文的にリストと確定している場合だけである。これは設計上の同一視であり
// 欠落ではない——1要素の連続ブロックとレジスタ上のスカラーは同じビット列を持つ。
function slotTypeText(node) {
  if (!node) return UNKNOWN;
  // 恒等射（真）も `_` と書く。裸の `_` は Sign 自身の恒等射記法であり（unit.md §378）、
  // 「まだ埋まっていないスロット」＝部分適用のプレースホルダと**同じ概念**である。
  // 記号は最初から正しいので分ける必要は無い——分けるのは**数え方**だけである
  // （恒等射は解けている。未解決として数えてはいけない）。
  if (node.atomType === IDENTITY) return UNKNOWN;
  const t = node.atomType || UNKNOWN;
  // `Iterator` も要素型を伴う——実体を持たないだけで、並ぶものの型は List と同じに決まる。
  if (t === "List" || t === "Iterator") return node.elementType ? `${t}(${node.elementType})` : t;
  // `Implicit(T)`（暗黙のアドレス＝場所）も要素型を伴う。前置 `~`（持ち上げ）が生む。
  if (t === "Implicit") return node.elementType ? `Implicit(${node.elementType})` : "Implicit";
  if (t === "Struct") return structTypeText(node, t);
  return t;
}

/**
 * `Struct` を、名前付きスロットか連番スロットかが分かる形で書く。
 *
 * 両者は同じ構造（固定オフセットで並ぶ連続ブロック）だが**関心事が違う**（§2）。
 *
 *   Struct{x : Int , 0  y : Int , 1}  名前付き
 *   Struct(Int String Float)             連番
 *
 * どちらのスロットも **(型, 連番)** を持つ。違いは連番の書き表し方だけである。
 * 連番スロットには名前が無いので並べ替える鍵が無く、**記法上の位置がそのまま連番**に
 * なる（だから書かない）。名前付きスロットは名前でソートして並べるため、連番は
 * 明示するしかない——そこで `型 , 連番` という直積で書く。
 *
 * 名前付きの書き方は、それ自体が名前付きスロットの形をしている（名前→(型,連番) の写像）。
 * 名前がソート順に並ぶので**並びが物理配置**、各名前が持つ連番が**宣言順**であり、
 * どちらも導出に頼らず明示されている。
 *
 *   point  : [x : 3 / y : 4]  →  Struct{x : Int , 0  y : Int , 1}
 *   point2 : [y : 4 / x : 3]  →  Struct{x : Int , 1  y : Int , 0}
 *
 * 括弧の違いが**位置の確約の有無**を表す。`{}` は名前で同定するものであり、物理
 * オフセットは名前ソートの正規順（stack_abi.md §7.1）なので「N番目は offset N×幅」
 * という確約は無い——そして名前で引く以上、要らない。`()` はソートの鍵となる名前が
 * 無いため宣言順がそのまま物理配置になり、確約が在る。MMIO・FFI・シリアライズのように
 * 外が配置を決める場面は `()` の側で書く。
 *
 * 名前付きスロットは「名前・連番・実データ」の三つを持つ。ここに書き写すのは
 * **宣言順**である——物理配置は名前でソートした正規順（stack_abi.md §7.1）だが、
 * それは宣言順から `sort` で導出できる。逆は導出できない。したがって宣言順の方が
 * 情報として厳密に大きく、ソート順を書き写すと**ねじれが失われる**。
 *
 * ねじれ（宣言順と正規順の置換）自体が情報である。`point : [x y]` と
 * `point2 : [y x]` は `==` では等しい（Hom集合の一致は宣言順を問わない）が、
 * 連番で引けば違う値を返す。これは矛盾ではなく、`==` が比較していない性質を
 * 測っているだけである（§2、`==` は同一性ではない）。`.st` がソート順しか書かないと
 * この差が消え、「正した」事実だけが残って「何を正したか」が暗黙化してしまう。
 */
function structTypeText(node, atomType) {
  if (atomType !== "Struct" || !node) return atomType;
  // **名前付きスロットの出どころは2つ、書き出しは1つ。** マージ済みの表から来ても
  // 宣言の行から来ても、並ぶのは「名前・連番・型」の三つ組みなので、拾い方だけが
  // 違って書き出しは同じである。`slots` を組んでから下の共通の尾へ落ちる。
  let slots = null;
  // マージの結果はスロット表を直接持つ（list_model.md §5.3）。元の宣言は2つ以上の
  // 構造体に散っているので、書き写せるのは畳んだ後の並びだけである。
  if (node.mergedSlots) {
    // 宣言順は畳んだ後の並び（左の順、右の新しいキーが続く）。重複したキーは元の位置に
    // 留まり、値だけが右のものになる（§5.3 規則2）。物理配置は他の名前付き構造体と
    // 同じく名前順である（stack_abi.md §7.1）。
    slots = [...node.mergedSlots].map(([k, v], ordinal) => ({
      name: bareName(k),
      ordinal,
      type: slotTypeText(v),
    }));
  } else if (node.slotKind === "named") {
    slots = (node.lines || [])
      .map((l, ordinal) => {
        if (isDefineNode(l) && isIdentifierNode(l.left)) {
          return { name: bareName(l.left.value), ordinal, type: slotTypeText(l.right) };
        }
        // フィールド名の省略記法（`x` だけの行）。値はその識別子自身。
        if (isIdentifierNode(l)) return { name: bareName(l.value), ordinal, type: slotTypeText(l) };
        return null;
      })
      .filter(Boolean);
  }
  if (slots) {
    // 宣言順（連番）を先に確定させてから、名前でソートして並べる。
    // 並び＝物理配置（正規順）、各名前が持つ値＝宣言順。両方が明示される。
    if (slots.length === 0) return "Struct";
    slots.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return `Struct{${slots.map((s) => `${s.name} : ${s.type} , ${s.ordinal}`).join("  ")}}`;
  }
  if (node.slotKind === "positional") {
    const slots = [];
    // **自分自身を渡し直さない。** 連番スロットは直積（`product`）の連なりとして
    // 分解できるが、`slotKind` が付いていても直積でない形はありうる。そこで
    // `slotTypeText(node)` を呼ぶと `Struct` を見て再びここへ戻り、無限に回る
    // ——実際に `l : p p`（構造体を余積で並べた形）が型の書き出しで落ちていた。
    // 分解できないものは分解できないと言えばよい。型の書き出しが止まらないのは
    // どんな理由があっても間違いである。
    // **結合の向きに依存しない歩き方をする。** 左だけ再帰して右を葉として扱うのは
    // 「左結合で積まれている」を前提にしていた。`,` は仕様どおり右結合なので
    // （operator_table.md 9行目）、`1 , (`abc` , 2.5)` の右がそのまま1スロットに見え、
    // `Struct(Int Struct(String Float))` と入れ子で書き出されていた。値の側は平坦なのに
    // 型だけが入れ子という食い違いである。左右とも再帰で開けばどちらでも同じ並びが出る。
    const walk = (n) => {
      if (n && n.type === "operation" && n.name === "product") {
        walk(n.left);
        walk(n.right);
        return;
      }
      if (n === node) return;
      slots.push(slotTypeText(n));
    };
    walk(node);
    if (slots.length === 0) return "Struct";
    return `Struct(${slots.join(" ")})`;
  }
  return atomType;
}

/**
 * 1つの定義行から SignType の1エントリを組み立てる。
 * @returns {{ name: string, text: string, unresolved: number } | null}
 */
function isComposeNode(node) {
  return node && node.type === "operation" && node.name === "compose";
}

// 合成木の端の項を返す。`f g h` のような多段合成でも、シグネチャを決めるのは
// 両端だけである（間の関数は型の受け渡しにしか関与しない）。
function composeEndNode(node, side) {
  let n = node;
  while (isComposeNode(n)) n = side === "left" ? n.left : n.right;
  return n;
}

function isApplyLikeNode(node) {
  return node && node.type === "operation" && (node.name === "apply" || node.name === "partial_apply");
}

// 適用の連なりを左へ辿り、呼び先の項と渡された実引数の個数を返す。多引数の部分適用は
// `f 1 2` → `partial_apply[apply[f, 1], 2]` のように内側が `apply` になるので両方数える。
function applySpine(node) {
  let n = node;
  let supplied = 0;
  while (isApplyLikeNode(n)) {
    supplied++;
    n = n.left;
  }
  return { base: n, supplied };
}

// その場に書いた無名ラムダは `(x ? x + 1)` のように括弧で包まれて来るので、1文だけの
// 括弧ブロックは剥がしてから見る。
function unwrapSoloParen(node) {
  let n = node;
  while (n && n.type === "block" && n.kind === "paren" && Array.isArray(n.lines) && n.lines.length === 1) {
    n = n.lines[0];
  }
  return n;
}

// ラムダ1つ分のシグネチャ（仮引数の並びと返値）を組み立てる。`名前 : ラムダ` の分岐と、
// 合成（`h : f g`）が両端から拾う分岐とで共有する。
function lambdaSignature(rhs) {
  const entries = paramEntries(rhs.left);
  const paramNames = new Set(entries.map((e) => e.name).filter(Boolean));
  const usageTypes = inferLambdaParamTypes(rhs, null);
  const fieldReqs = collectFieldRequirements(rhs.right, paramNames);

  // 仮引数リスト全体が1個のブラケット（`[h ~t]`）なら、**要求する実引数は1個**である
  // ——ブラケットは渡された単一の List/Struct をその場で分割代入する（Eagerパターン、
  // list_model.md §2.4）。エントリ数は分解後の束縛の数であって実引数の数ではないので、
  // 型としても1スロットにまとめて書く。混在形（`dist [h ~t]`）の場合は entry.pattern
  // として1エントリに畳まれているので、こちらの分岐には来ない。
  const wholeBracket = rhs.left && rhs.left.type === "params" && rhs.left.bracket;
  // ブラケットの rest は器そのものなので（pass3 の inferLambdaParamTypes 参照）、その型が
  // 分かればそれが**スロットの型**である。分からないときだけ形を書く——形は「まだ型が
  // 分かっていない」ときの記述であって、裸の仮引数における `Atom` と同じ位置にある。
  const restEntry = wholeBracket ? entries.find((e) => e.rest && e.name) : null;
  let containerType = restEntry ? usageTypes.get(restEntry.name) : null;
  // **`Container` は形より弱い。** 「器である」としか言っていないのに対し、形は「器で
  // あり、こう分解する」まで言う。多くを言っている方を書く。
  if (containerType === "Container") containerType = null;
  // `List` は要素型を伴って書く（§2 の記法）。要素は先頭エントリそのものである
  // ——`[x ~xs]` の `x` が要素で `xs` が器なのだから、器の要素型は `x` の型である。
  if (containerType === "List") {
    const head = entries.find((e) => !e.rest && e.name && usageTypes.get(e.name));
    const el = head ? usageTypes.get(head.name) : null;
    if (el && el !== "Atom") containerType = `List(${el})`;
  }
  const params = wholeBracket
    ? [containerType || `[${entries.map((e) => bareName(e.name) + (e.rest ? "~" : "")).join(" ")}]`]
    : entries.map((e) => paramTypeText(e, usageTypes, fieldReqs));
  // 返値型は本体ノードの Layer 2 型そのもの。Lambda 自身は Layer 1 のカテゴリであり
  // Layer 2 型を持たないが（§2）、本体は値を作るので型を持つ。
  const ret = rhs.right && rhs.right.atomType ? slotTypeText(rhs.right) : UNKNOWN;
  // 恒等射（真）は `_` と書くが**解けている**。未解決と混ぜないよう印を持ち回る。
  const retIdentity = !!(rhs.right && rhs.right.atomType === IDENTITY);
  return { params, ret, retIdentity };
}

// 仮引数の並びと返値から1行分のテキストを起こす。仮引数が無い関数は `__ -> T`
// ——完全性公理（§3.4）が言う通り、引数を取らない関数は Unit を受ける関数である。
function signatureText(name, params, ret, retResolved) {
  // 返値が恒等射（真）のときは `_` と書くが**解けている**——未解決として数えない。
  //
  // **形は受け取り方であって、型ではない。** `[acc~]` は「器を1つ受けてこう分解する」と
  // しか言っておらず、**何の器かを言っていない**。ここを数えていなかったので、`.st` は
  // 仮引数の型が丸ごと決まっていない関数を「未解決 0」と報告していた——伏せずに出すのが
  // `.st` の目的なのだから、これは目的そのものを外している。
  //
  // 型が決まっていれば `List(Char)` のように書かれる（形へ落ちるのは決まらなかったとき
  // だけ）ので、括りの形をしていること自体が「決まらなかった」の印である。
  const isHole = (x) => x === UNKNOWN || x === `${UNKNOWN}~` || (x.startsWith("[") && x.endsWith("]"));
  const unresolved = params.filter(isHole).length + (ret === UNKNOWN && !retResolved ? 1 : 0);
  const lhs = params.length > 0 ? params.join(" ") : "__";
  return { name, text: `${name} : ${lhs} -> ${ret}`, unresolved };
}

/**
 * 右辺のノードからシグネチャ（仮引数の並びと返値）を求める。
 *
 * ラムダ・合成・部分適用はどれも **Lambda（Layer 1）であって Layer 2 の Atom 内部型を
 * 持たない**が、シグネチャそのものは静的に決まる。三つとも「別の関数から新しい関数を
 * 作る」形なので、ここで再帰的に一つの解決器として扱う——`inc : add3 1` を経由した
 * `both : inc 2` のように、Lambda を作る式が積み重なっても辿れるようにするため。
 *
 * 辿れないもの（ポイントフリーの `[+ 1]`、`@p` のような間接呼び出し、未定義の名前）は
 * null を返す。分からないことを「分かった」と書かないのが `.st` の原則である。
 * `seen` は名前の循環（`a : b 1` / `b : a 1`）を止める。
 */
function signatureOfNode(node, defineByName, seen) {
  const n = unwrapSoloParen(node);
  if (isLambdaNode(n)) return lambdaSignature(n);

  // ポイントフリーの演算子ブロック（`[+ 1]` / `[+]`）。演算子表はそれ自体が型の表なので
  // （operator_table.md 基本原則）、穴の数を数えるだけでシグネチャが出る。
  const pf = pointfreeSignature(n);
  if (pf) return pf;

  if (isIdentifierNode(n)) {
    if (seen.has(n.value)) return null;
    seen.add(n.value);
    const bound = defineByName && defineByName.get(n.value);
    return bound ? signatureOfNode(bound, defineByName, seen) : null;
  }

  // 合成（`h : f g`）のシグネチャは両端から決まる。スペースによる合成は**左→右の
  // パイプライン**（`f g` は `g(f(x))`、coproduct_resolver.md §3.1）なので、
  // **仮引数は左端の `f` が、返値は右端の `g` が**決める。間の関数は型の受け渡しに
  // しか関与しないので、多段合成でも見るのは両端だけでよい。
  if (isComposeNode(n)) {
    const first = signatureOfNode(composeEndNode(n, "left"), defineByName, new Set(seen));
    const last = signatureOfNode(composeEndNode(n, "right"), defineByName, new Set(seen));
    return first && last ? { params: first.params, ret: last.ret } : null;
  }

  // 部分適用（`g : f 1`）は**渡した分だけ仮引数が減り、返値は変わらない**。Pass 2 が
  // 静的にアリティ不足を判定して `partial_apply` を立てている以上（§5）、ここは残りの
  // 仮引数を数え直すだけでよい。
  if (n && n.type === "operation" && n.name === "partial_apply") {
    const { base, supplied } = applySpine(n);
    const callee = signatureOfNode(base, defineByName, new Set(seen));
    if (callee && supplied < callee.params.length) {
      return { params: callee.params.slice(supplied), ret: callee.ret };
    }
  }

  return null;
}

function entryFor(defineNode, defineByName) {
  if (!isDefineNode(defineNode) || !isIdentifierNode(defineNode.left)) return null;
  const name = bareName(defineNode.left.value);
  const rhs = defineNode.right;

  const sig = signatureOfNode(rhs, defineByName, new Set([defineNode.left.value]));
  if (sig) return signatureText(name, sig.params, sig.ret, sig.retIdentity);

  // Atom: 右辺式の Layer 2 型がそのまま識別子の型になる（§5 Pass 1a）。
  const t = rhs && rhs.atomType ? rhs.atomType : UNKNOWN;
  return { name, text: `${name} : ${slotTypeText(rhs)}`, unresolved: t === UNKNOWN ? 1 : 0 };
}

/**
 * SignType 形式の文字列を生成する。
 *
 * @param {object[]} nodes compile() が返した縮約済みノード列
 * @param {object} env compile() が返した識別子テーブル（ルートスコープ）
 * @param {{ scope?: "st"|"ist", source?: string }} [options]
 *   scope: "st"（既定、export されたもののみ）/ "ist"（全識別子、**メモリ上のみ**）
 *   source: 冒頭のコメントに書くソースファイル名
 * @returns {{ text: string, entries: number, unresolved: number }}
 */
function generateSignType(nodes, env, options = {}) {
  const scope = options.scope === "ist" ? "ist" : "st";
  const bindings = env && env.bindings ? env.bindings : new Map();

  // 合成・部分適用のシグネチャを呼び先から拾うための索引（名前 → 右辺ノード）。
  const defineByName = new Map();
  for (const node of nodes) {
    if (isDefineNode(node) && isIdentifierNode(node.left)) defineByName.set(node.left.value, node.right);
  }

  const out = [];
  let entries = 0;
  let unresolved = 0;

  for (const node of nodes) {
    const e = entryFor(node, defineByName);
    if (!e) continue;
    const binding = bindings.get(`<${e.name}>`);
    const exported = binding ? binding.exported : null;
    if (scope === "st" && !exported) continue;
    out.push(exported ? `${exported}${e.text}` : e.text);
    entries++;
    unresolved += e.unresolved;
  }

  const header = [
    `\` SignType (${scope}) — Pass 1〜3 が確定した型を書き写したもの`,
    options.source ? `\` source: ${options.source}` : null,
    scope === "ist" ? "` .ist はメモリ上のみ。ディスクへ永続化しないこと（compiler_pipeline.md §4）" : null,
    unresolved > 0 ? `\` 未解決 ${unresolved} 箇所を \`${UNKNOWN}\` で示している` : null,
  ].filter(Boolean);

  return { text: [...header, "", ...out].join("\n") + "\n", entries, unresolved };
}

export { generateSignType };
