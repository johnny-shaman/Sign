/**
 * Pass3（型伝播、type_system.md §2〜§3.2の実装）
 *
 * Pass2（coproduct_resolver.md）が構築した二分木ASTを歩いて、各ノードの
 * Layer 2型（Atom内部型: Address/Float/String/Vector/List/Struct/Implicit/Iterator/Unit）を推論する。
 *
 * 左辺優先ルール（§3.2）:
 *   typeof(L op R) = typeof(L)
 * 例外（§3.2 NOTE）:
 *   String型の左辺に算術演算子（+ - * / % ^）が来ると、リストに対して算術は効かないため
 *   型エラーとして __（Unit）に収束する（例: `123` + 0 = __）。
 *
 * 【既知の制限】
 * - 識別子のatom_typeは、Pass1a（pass1.js の buildEnvScope）が
 *   「`<id> : <リテラル1個>` という最も単純な定義行」から静的に読み取れた場合のみ解決できる。
 *   ラムダの仮引数（本体の使用箇所から逆算する必要がある、type_system.md §7.1 の x/y の例、
 *   Pass 1b の `@ref` ジェネリック具体化）は未対応。
 * - 比較演算子（< <= = >= > !=）等、算術演算子以外は一律で左辺優先ルールにフォールバック
 *   しており、§4の個別の型シグネチャとの細かい整合は未検証。
 * - 構造体判定は「複数行、全行がdefine(key:val)」という形（list_model.md §5.3、
 *   pattern_guide.mdの`dict`例が示す改行区切りの形）のみを見る。カンマと`:`を1行に
 *   混在させる形（例: `foo:1, bar:2`、ドキュメントに例が無い）は非対応・未定義動作。
 * - `Implicit(T)`（場所）と `Iterator(T)`（ストリーム）は type_system.md §2 に型として
 *   定義されたが、ここではまだ推論しない。仮引数の形による割り当て
 *   （`f : [x ~xs]` → `Implicit(List(T))` / `f : x ~xs` → `Iterator(T)`、list_model.md §2.4）も、
 *   `'`・前置`#` が `Implicit` を返すことも未実装。
 *   **前置 `~` はこの一覧から外れた。** 作るのは場所ではなく長さ1の器（`List`）である
 *   ——番地を表に出さないと決めた以上、「場所」という観測可能な型には仕事が残っていない。
 *   これが入ると原理4の静的拒否ルール「`[...]`内でのstream型識別子の使用」が
 *   初めて強制可能になる（stream型が型として存在するため）。
 */

import { literalDigits } from "./target_info.js";
import { envLookup } from './pass1.js';
import { OperationError } from "./errors.js";
import { stringLength, layoutOfStruct , elementShapeOfList } from "./layout.js";
import { CURSOR_SUFFIXES } from "./stream_desugar.js";

const ARITHMETIC_OPS = new Set(["add", "sub", "mul", "div", "mod", "pow"]);
// coproduct_resolver.md §3-4: Atom-Atom間の余積（スペース）が縮約される演算。
// これらの結果はList（1次元配列）そのものであり、左辺の個別の型を素通しすべきではない。
const LIST_BUILDING_OPS = new Set(["construct", "concat", "push", "unshift"]);

function isDefineNode(n) {
  return !!n && n.type === "operation" && n.name === "define";
}

function isIdentifierNode(n) {
  return !!n && n.type === "atom" && n.kind === "identifier";
}

// **後置 `@`（import）は名前の由来を隠さない。** `g : inc@` は「inc を取り込んで g と
// 呼ぶ」であって、行き着く定義は `inc` そのもの（`system_architecture.md` §2.1 の
// `#`/`@` 随伴ペア）。ここで剥がさないと `g : inc@` が別名として記録されず、Pass 4 で
// 「まだ出せない識別子です（inc）」になる——**取り込んだ関数に名前を付けた途端に
// 呼べなくなる**という、取り込み側だけを直しても消えない穴だった。
function stripImport(n) {
  let cur = n;
  while (cur && cur.type === "operation" && cur.position === "postfix" && cur.name === "import" && cur.operand) cur = cur.operand;
  return cur;
}

// 【2026-08-09】以前ここには productShape() があり、カンマ結合の要素列を
// 「全要素が define(key:val) なら Dict、そうでなければ Struct」と振り分けていた。
// type_system.md §2 で `Dict` を `Struct` へ統合したため、この振り分けは不要になった
// ——名前付きスロット（`[key : val]`）と連番スロット（`1, 2, 3`）は同じ構造であり、
// 名前がコンパイル時にオフセットへ解決されて Pass 4 に残らない点も同じだからである。

// type_system.md §3.2「数値の昇格格子」と算術族の型変換テーブルの実装。
// 左辺は「どの規則を使うか」を選ぶだけで、数値同士の結果型は昇格格子が決める
// （＝左辺の型がそのまま結果型になるとは限らない）。
const NUMERIC_TYPES = new Set(["Int", "Address", "Float", "Vector"]);
// 数値の昇格格子の順（`arithmeticResultType` が使っている順そのもの）。**下ほど弱い。**
// `Int` が最下位であることには意味がある——算術の相手に `1` と書いてあっても、それは
// 「相手も Int だ」とは言っていない。`Address + 1` も `Float + 1` も普通に書ける形で、
// 昇格すれば通るからである。したがって Int リテラルは**証拠として一番弱い**。
const NUMERIC_RANK = { Int: 0, Address: 1, Float: 2, Vector: 3 };
// 「場所」と「ストリーム」。値ではないので算術・比較の対象にならない（§4 は Scalar を要求）。
// `Iterator` は範囲族が生む。`Implicit` を生むものは今は無い——前置 `~` は長さ1の器
// （`List`）を作るようになったので、`'`・前置 `#` が参照を返すようになるまで出番が無い。
// `~xs + 1` はここではなく List 算術の規則で `__` になる（素の `xs + 1` と同じ理由）。
const NON_SCALAR_PLACES = new Set(["Implicit", "Iterator"]);
// 恒等射（真）。Layer 1 の射であって Layer 2 の値ではないので、型の表には載らない。
// `__` が単位元である以上 `x ⊗ __ ≅ x` であり、`__` の積関手は恒等関手そのものである
// ——恒等射は `__` から導かれる別の顔であって、独立した型ではない。
const IDENTITY = "Identity";
// List左辺で固有の意味を持つのは `*`(repeat)・`^`(lift)・`/`(split) だけ。
// `+`・`-`・`%` はList/Stringと同様に型エラーで __ へ収束する。
const LIST_ARITHMETIC_OPS = new Set(["mul", "pow", "div"]);

// 範囲族（list_model.md §2.3）。`~` は単純形式 `[start ~ end]` と、3項形式
// `[start ~op step ~ end]` の外側を担う。`~+`〜`~^` は step を伴う派生演算子。
const RANGE_STEP_OPS = new Set([
  "range_arithmetic",
  "range_arithmetic_rev",
  "range_geometric",
  "range_geometric_rev",
  "range_power",
]);

// type_system.md §4: `~` 中置は `(Scalar -> Scalar) -> Iterator -> List`。
// 端点になれるのは「点」——数値と文字である。文字は Layer 2 では String だが、
// 範囲の端点としては符号位置で数えるため点として扱える（`\a ~ \e`）。
// List / Struct は点ではないので端点にできない。原理4により静的に弾く。
// 端点になれるのは「点」——数値と1文字である。`Char` はまさに1文字そのもの
// （2文字以上の `String` は点ではないので端点にできない）。
const RANGE_ENDPOINT_TYPES = new Set(["Int", "Address", "Float", "Vector", "Char"]);

// 範囲式の端点になっているノードの型を、単純形式・3項形式のどちらでも取り出す。
// 3項形式は `range(range_arithmetic(start, step), end)` という入れ子であり、
// 実際の端点は内側の左辺（start）と外側の右辺（end）である。
function rangeEndpoints(node, env) {
  if (RANGE_STEP_OPS.has(node.name)) return [node.left, node.right];
  const inner = node.left;
  if (inner && inner.type === "operation" && RANGE_STEP_OPS.has(inner.name)) {
    return [inner.left, node.right];
  }
  return [node.left, node.right];
}

// 端点として不正な型を見つけたら、その型を返す（見つからなければ null）。
// 「不正」は例外にしない——点でないものを端点に置くことは「射が無い」ということであり、
// 零対象を経由する射（零射）が常に存在する以上、結果は `__` である。なぜ潰れたかは
// Pass 3b（collectUnitReason）が診断として記録する。
function badRangeEndpoint(node, env) {
  const [startNode, endNode] = rangeEndpoints(node, env);
  for (const [label, operand] of [["左辺", startNode], ["右辺", endNode]]) {
    const t = operand ? inferAtomType(operand, env) : null;
    // 未解決（null）は静的に判定できないので何も言わない。
    // Unit は零射として振る舞うので、そもそも型の不一致ではない。
    //
    // `Atom` と `Scalar` も断じない。**どちらも「まだ分かっていない」の言い換え**である
    // ——`Atom` は「どの Atom か未確定」、`Scalar` は「String を含まない Atom の族」で
    // あって、どちらも「点ではない」という証拠を持っていない。分からないことを「不正」と
    // 断じないのが原理4 の線引きであり、joinElementTypes が同じ2つに対して NO_JOIN では
    // なく null を返しているのと同じ扱いである。
    //
    // ここを断じていたせいで `mk : n ? [1 ~ n]` が丸ごと `Unit` になっていた。仮引数は
    // 証拠が無ければ `Atom` まで決まる（§7.1）ので、**終端が実行時変数のレンジが全部
    // 潰れていた**——list_model.md §2.3 が「終端値 `n` が実行時変数であっても静的型付け
    // 原則は完全に維持される」と明記している、まさにその形である。
    if (t === "Atom" || t === "Scalar") continue;
    if (t && t !== "Unit" && !RANGE_ENDPOINT_TYPES.has(t)) return { label, type: t };
  }
  return null;
}

/**
 * レンジの要素型。**両端は同じ点でなければならない**——§4 のシグネチャ
 * `~ : (Point -> Point) -> Iterator -> (List | String)` がそう定めている。
 *
 * したがって片方が具体的な点型で、もう片方が「まだ分かっていない」（`Atom` / `Scalar`）
 * なら、要素型は具体的な方に決まる。これは未知数を立てて解いているのではなく、
 * **演算子の定義をそのまま読んでいるだけ**である（§1「型は宣言されるものではなく
 * コードから読み取って書き写すだけの存在」）。
 *
 * これが効くのは `mk : n ? [1 ~ n]` のような形である。終端が実行時変数でも、要素型が
 * 決まれば規則裏打ちの大きさ（`{start, step, end}`）は静的に確定する
 * ——list_model.md §2.3 が「静的型付け原則は完全に維持される」と言うのはこのことである。
 */
function rangeElementType(startType, endType) {
  const unknown = (x) => x === null || x === undefined || x === "Atom" || x === "Scalar";
  if (unknown(startType) && unknown(endType)) return null;
  if (unknown(startType)) return endType;
  if (unknown(endType)) return startType;
  return joinElementTypes(startType, endType);
}

function rangeResultType(node, env) {
  if (badRangeEndpoint(node, env)) return "Unit";
  const [startNode, endNode] = rangeEndpoints(node, env);
  const startType = startNode ? inferAtomType(startNode, env) : null;
  const endType = endNode ? inferAtomType(endNode, env) : null;
  // 終端を持たない2項形式（`1 ~+ 2`）は Pull 型のストリームそのもの。
  // **実体は規則である**（list_model.md §2.3）。型は「何ができるか」しか語らないので、
  // 「どう置かれているか」はここに印として残す——Pass 4 が `l ' i` に対してロードを出すか
  // 算術を出すかは、型ではなくこれが決める（type_system.md §2 のアクセス表）。
  node.repr = "rule";
  if (RANGE_STEP_OPS.has(node.name)) {
    // ストリームでも**要素型は分かる**——始点と歩幅の join がそれである。Pass 4 は
    // 添字に対して要素1個ぶんの命令を出すので、ここを落とすと添字が型を失う。
    const el = rangeElementType(startType, endType);
    if (typeof el === "string") node.elementType = el;
    return "Iterator";
  }
  // **長さ1のリストは存在しない。** 1要素の器はスカラーと同型なので（`[5]` は `Int`）、
  // その瞬間にスカラーへ落ちる。端点が同じレンジ（`[3 ~ 3]`）は1要素であり、値としては
  // 既に `3` になっている（interpreter.js）——型だけが器のまま取り残されていた。
  // **型が値より広い**のは、`is_digit` を壊したのと同じ形である。
  const one = rangeSingleton(node, env);
  if (one) {
    const el = rangeElementType(startType, endType);
    return typeof el === "string" ? el : startType;
  }
  // 文字の範囲は文字の並び＝String（`String ≅ List(Char)`）。端点は `Char` である。
  if (startType === "Char" && endType === "Char") {
    node.elementType = "Char";
    return "String";
  }
  // 有限レンジも要素型を持つ。ストリームと同じく端点の join がそれである。
  const el = rangeElementType(startType, endType);
  if (typeof el === "string") node.elementType = el;
  return "List";
}

// 切り出しの長さが静的に1か（`s ' (1 ~+ 1 ~ 1)`）。終端の無い形は器の長さが要るので
// 判定しない——決まらないものを決まったことにはしない（原理4）。
function sliceLengthOne(node, env) {
  let r = node.right;
  while (r && r.type === "block" && Array.isArray(r.lines) && r.lines.length === 1) r = r.lines[0];
  if (!r) return false;
  // **終端の無い形でも、器の長さが分かれば決まる。** リテラルの器（`` `abc` ' 2~ ``）は
  // 長さが静的に分かるので、そこから 1 になるかどうかも静的に出る。決まるものは決める。
  if (r.type === "operation" && RANGE_STEP_OPS.has(r.name)) {
    const num0 = (n) => {
      let d = n;
      while (d && d.type === "block" && Array.isArray(d.lines) && d.lines.length === 1) d = d.lines[0];
      return d && d.type === "atom" && d.kind === "number" && Number.isInteger(Number(d.value)) ? Number(d.value) : null;
    };
    const st = num0(r.left);
    const sp = num0(r.right);
    if (st === null || sp !== 1) return false;
    const total = stringLength(node.left, env);
    return total !== null && total - st === 1;
  }
  if (r.type !== "operation" || r.name !== "range") return false;
  const num = (n) => {
    let d = n;
    while (d && d.type === "block" && Array.isArray(d.lines) && d.lines.length === 1) d = d.lines[0];
    return d && d.type === "atom" && d.kind === "number" && Number.isInteger(Number(d.value)) ? Number(d.value) : null;
  };
  const end = num(r.right);
  if (end === null) return false;
  let l = r.left;
  while (l && l.type === "block" && Array.isArray(l.lines) && l.lines.length === 1) l = l.lines[0];
  if (l && l.type === "operation" && RANGE_STEP_OPS.has(l.name)) {
    const st = num(l.left);
    const sp = num(l.right);
    return st !== null && sp === 1 && st === end;
  }
  return num(l) === end;
}

// 端点が静的に等しいレンジか（`[3 ~ 3]`）。**1要素の器は存在しない**ので、そのときは
// 器ではなくスカラーである。実行時に決まる端点は判定できないので false（原理4）。
function rangeSingleton(node, env) {
  if (RANGE_STEP_OPS.has(node.name)) return false;
  const [s, e] = rangeEndpoints(node, env);
  const lit = (n) => {
    const d = derefToNode(n, env);
    if (!d || d.type !== "atom") return null;
    if (d.kind === "number" && Number.isInteger(Number(d.value))) return Number(d.value);
    return null;
  };
  const a = lit(s);
  const b = lit(e);
  return a !== null && a === b;
}

// type_system.md §3.2「要素型の join」: 余積で構築される List の要素型を求める。
// join は数値の昇格格子そのもの。戻り値の意味を3値で区別する：
//   型名   … join が求まった
//   null   … どちらかが未解決（静的に判定できないのでエラーにしない、原理4）
//   NO_JOIN … join が存在しない（コンパイルエラー）
const NO_JOIN = Symbol("no-join");

// **`List` は「要素型が未確定のリスト」＝族である。** `List(Int)` はその成員であり、
// 両者の関係は `Scalar` と `Int` の関係と同じ——具体的な方が勝つ。入れ子の要素型
// （`List(List(Int))`）を運ぶようになって初めて、この区別が要るようになった。
function memberOfListFamily(family, type) {
  return family === "List" && typeof type === "string" && type.startsWith("List(");
}

// **スカラーは1要素の器と同型である**（`Scalar ⇒ [Scalar, __]`）。
//
// 「長さ1のリストは存在しない」（`[5]` は `Int`）は既にこの同型を**降りる**方向で
// 使っている。ここはその同じ同型を**昇る**方向で読むだけである——片方が `T`、もう片方が
// `T` の器なら、上限は器である。
//
// **根拠は単位元が持ち上げで動かないこと。** 機械の上で `$__ = __ = @__` が成り立つので
// （pass4.js / interpreter.js）、型の上で `$__ = [__] = @__` と読んでも観測は壊れない。
// 持ち上げの底が `__` のまま動かないから、持ち上げてよい。
//
// **そして自然同型はコードの表面に出さない。** 書かせた時点で自然ではなくなるからで、
// 実際 Sign には1文字の `String` を書く手段が無い（`s ' 0` も `s ' (0 ~ 0)` も `Char` へ
// 降りる）。だから昇る側はフロントエンドが黙って吸う。lexer.sn の `tokens` が記号1文字の
// 枝で `Char`、語の枝で `String` を積むのは、書き手にとっては同じ「トークンを1つ積む」で
// あって、そこに変換を書かせる理由が無い。
//
// 代金は原理8のとおり出る——`Char` の要素は `{ptr, len}` の2語になる。ただし `s ' 0` は
// 元の器のスライス（`{s.ptr, 1}`）なので確保は要らない。
function liftScalarToBox(a, b) {
  if (a === "Char" && b === "String") return "String"; // String ≅ List(Char)（原理7）
  if (b === "Char" && a === "String") return "String";
  if (b === `List(${a})`) return b;
  if (a === `List(${b})`) return a;
  return null;
}

function joinElementTypes(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  if (a === b) return a;
  if (memberOfListFamily(a, b)) return b;
  if (memberOfListFamily(b, a)) return a;
  const lifted = liftScalarToBox(a, b);
  if (lifted) return lifted;
  // `Scalar` は「String を含まない Atom」という**族**であり（§4 の記法定義）、
  // Address / Float / Vector はその要素である。族と要素の上限は族——どの要素かは
  // まだ分かっていないので、分かっている以上のことを名乗らない。仮引数の型が
  // 呼び出しサイトで具体化されるまでの暫定形がここを通る（§7.1）。
  // `Atom` は「どの Atom か分かっていない」という下限であり、join は判定できない。
  // NO_JOIN（コンパイルエラー）ではなく null を返す——分からないことを「不正」と
  // 断じないのが原理4 の線引きである。
  if (a === "Atom" || b === "Atom") return null;
  if (a === "Scalar" || b === "Scalar") {
    const other = a === "Scalar" ? b : a;
    return NUMERIC_TYPES.has(other) || other === "Scalar" ? "Scalar" : NO_JOIN;
  }
  if (NUMERIC_TYPES.has(a) && NUMERIC_TYPES.has(b)) {
    if (a === "Vector" || b === "Vector") return "Vector";
    if (a === "Float" || b === "Float") return "Float";
    // Address は昇格段には乗らない（幅は Int と同じ GPR 1語）が、**より具体的**である。
    // 片側がアドレスなら結果もアドレス——`p + 4` はオフセット計算であって、ただの整数
    // 加算に落ちてはいけない（type_system.md §3.6）。
    if (a === "Address" || b === "Address") return "Address";
    return "Int";
  }
  return NO_JOIN;
}

// ノードが表す「値の要素型」を返す。List なら要素型、それ以外はその値自身の型
// （スカラーは1要素リストと同型なので、自分自身が要素になる）。
function elementTypeOf(node, env) {
  const type = inferAtomType(node, env);
  // **直和の要素型は、決まっている腕の join である。**
  //
  // `Int | List | Struct` は「スカラーとして渡ることも器として渡ることもある」であって、
  // 要素が何かを言っていないわけではない——スカラーの腕は1要素の器なので自分自身が要素で
  // あり（`Scalar ⇒ [Scalar, __]`、value_representation.md §5.10）、器の腕は要素型を
  // 持つならそれである。決まらない腕は数えない（`joinArmTypes` が `Unit` を落とすのと
  // 同じ理由）。
  //
  // ここが無いと、直和は最後の「スカラーは自分自身が要素」へ落ちて**直和そのものを要素型
  // として返す**——それは何とも join できないので `NO_JOIN` になり、余積が `Struct` へ
  // 落ちる。preprocess.sn の `push : [~st] d ? d st~` はそれで型が輪になっていた：
  // `push` の返値が `Struct` ← 本体が `Struct` ← `st` が直和 ← `push` の返値。
  // 単独で書けば `List(Int)` と正しく決まるのに、呼び合う文脈でだけ固まっていた。
  if (typeof type === "string" && type.includes(" | ")) {
    let acc = null;
    for (const arm of type.split(" | ").map((x) => x.trim())) {
      const el =
        arm === "String" ? "Char"
        : arm === "List" || arm === "Iterator" ? node.elementType ?? null
        : arm === "Struct" || FAMILY_MEMBERS[arm] ? null // 中身が揃わない／族は下限
        : arm; // スカラーは1要素の器なので、要素は自分自身
      if (!el) continue;
      acc = acc === null ? el : joinElementTypes(acc, el);
      if (acc === NO_JOIN) return null; // 本当に食い違うなら決めない（原理4）
    }
    return acc;
  }
  if (type === "List" || type === "Iterator") return node.elementType ?? null;
  // **`String` の要素は `Char` である**（`String ≅ List(Char)`、§2）。ここが `String` を
  // 返していたのは、`Char` が Layer 2 の型になる前に書かれた規則が残っていたからで、
  // `getPropResultType` では既に直っていた同じ穴である（[[vocabulary lag]]）。器を1つ
  // 受けて分解する形（`[c ~rest]`）で `c` の幅が決まらなかった原因がここ。
  if (type === "String") return "Char";
  // **どの器かが決まっていなければ、要素の型も決まらない。** `Container` は「器である」
  // としか言っていないので、要素が何かは言えない——器の要素が器とは限らない。ここで
  // `Container` をそのまま返すと「分かっていないこと」を書くことになる（原理4）。
  // スカラーの分岐（下）へ落として自分自身を返すのも同じ誤りである。
  if (type === "Container") return null;
  // スカラーは1要素の器なので、要素は自分自身である（`[5]` ≅ `5`）。
  return type;
}

function arithmeticResultType(node, leftType, env) {
  const rightType = inferAtomType(node.right, env);
  // §3.2: Stringは左右どちらに来ても算術の型エラー（両方向とも __ 消去）
  if (leftType === "String" || rightType === "String") return "Unit";
  // **`__` は強さの底である**（爆発律）。
  //
  // 算術は `A × A → A`——積を食って同じ対象を返すので、片方が始対象なら返せる値は
  // 残った方しか無い。型でも同じで `Unit ⊕ T → T` になる。「A と B が出会ったら強い方」
  // の A に `__` を置くと必ず相手が勝つ、という一点である。
  //
  // 以前ここは `Unit` を素通りさせていて、`__ + 3` の型が `Unit` になっていた。値の側は
  // 3 を出すのに型が `Unit` なので、Pass 4 が「GPR 幅の整数演算だけを出せます（Unit）」で
  // 止まる——**意味と型が食い違っていた**。
  //
  // 相手が算術の対象でないとき（String は上で落ちる、List や Implicit は下の規則）は
  // 通り抜けない。代数の中に居ないものは、底から持ち上がる先が無い。
  if (leftType === "Unit" && (NUMERIC_TYPES.has(rightType) || rightType === "Char")) return rightType;
  if (rightType === "Unit" && (NUMERIC_TYPES.has(leftType) || leftType === "Char")) return leftType;
  if (leftType === "List" || leftType === "Struct") {
    return LIST_ARITHMETIC_OPS.has(node.name) ? leftType : "Unit";
  }
  // 場所（`Implicit`）とストリーム（`Iterator`）は Scalar ではないので算術の対象にならない
  // （§4: `(L(Scalar) -> R(Scalar)) -> L`）。射が無い＝零射なので `__` へ収束する。
  // 持ち上げた結果に算術を書いてしまう形（`~xs + 1`）がここに来る——要素型を決める演算は
  // 持ち上げの**内側**に置くこと（`~(xs + 1)`）。
  if (NON_SCALAR_PLACES.has(leftType) || NON_SCALAR_PLACES.has(rightType)) return "Unit";
  // **文字の算術は符号位置の算術である。** `c + 1` で次の文字を取る書き方が成立する
  // のはこのためで、結果もまた文字である。ただし**足せることと、足した先が文字である
  // ことは別**なので、charset の外へ出たら `__` になる——そこは値を見る側（インタプリタ
  // と Pass 4）が決める。型の側は「文字である」とだけ言う。
  //
  // `Char` を `Scalar` の成員に入れていないのは算術の対象でないからではなく、昇格格子
  // （`Int → Address → Float → Vector`）に乗らないからである。文字は数の一種ではない。
  // **`Char` と `Int` の間に強弱は無い。** 昇格格子は「精度の高い方へ上がる」で決まるが、
  // 文字は数の一種ではないので上下が付かない——だから格子では決められず、**左辺優先の
  // 規則**がそのまま働く（§3.2「左辺の**型**が演算の意味を選ぶ」）。
  //
  //   `\`a\` + 1`  → `Char`（位置に差を足すと位置）
  //   `1 + \`a\``  → `Int` （数に数を足すと数。文字にはならない）
  //
  // 以前ここには `Int + Char → Char` の節があった。右辺の型が結果を決めていたことになり、
  // 左辺優先と食い違う。**節を消すのが直し方**である——強弱が無いものに順序を作らない。
  if (leftType === "Char") return "Char";
  // **`Raw`（生の入力）は最弱である。** 値は在るが型が無いので、相手が具体型なら
  // 必ずそちらが勝つ——だからどちらの位置に来ても答えが同じで、**可換が保たれる**
  // （`@p + 0` も `0 + @p` も `Int`）。左辺優先が働くのは「強弱が無いとき」だけで
  // あり、型を持たないものには主張すべき内容が無い。
  if (leftType === "Raw" && rightType && rightType !== "Raw") return arithmeticResultType(node, rightType, env);
  if (rightType === "Raw" && leftType !== "Raw") return leftType;

  // **強弱があるものだけ格子で決まる。無いものは左辺が決める。**
  //
  // `Vector` と `Float` は精度で本当に上なので、どちら側に来ても昇格する（降格しない）。
  // だが `Address` と `Int` の間に強弱は無い——片方が精度で上なのではなく、**符号の有無
  // が違うだけ**で、溢れ方が違う（integer_overflow.md）。上下が付かないものに順序を作る
  // と、右辺が結果を決めることになり左辺優先と食い違う。
  //
  //   `番地 + 8` → `Address`（番地を進める）
  //   `8 + 番地` → `Int`   （数に数を足す。番地にはならない）
  //
  // 以前は `Address` が片側にあれば結果も `Address` だった。`Char` の `Int + Char →
  // Char` と同じ形の誤りで、**強弱の無いものに順序を作っていた**。
  if (NUMERIC_TYPES.has(leftType) && NUMERIC_TYPES.has(rightType)) {
    if (leftType === "Vector" || rightType === "Vector") return "Vector";
    if (leftType === "Float" || rightType === "Float") return "Float";
    return leftType;
  }
  // **片方が族なら、結果も族である。** `Int + Scalar` を `Int` と答えてはいけない
  // ——相手が Float なら昇格して Float になり、Address なら Address になる。具体型の側を
  // そのまま答えにすると、分かっていないことを分かったと書くことになる（原理4）。
  //
  // 算術は String を対象にしないので（上で `Unit` へ落としている）、`Atom` が来ても
  // 実際に置けるのは `Scalar` の成員だけである。したがって結果は `Scalar` まで狭まる。
  if (FAMILY_MEMBERS[leftType] || FAMILY_MEMBERS[rightType]) return "Scalar";
  // どちらかの型が未解決（識別子のatom_typeが読めない等）なら、従来通り左辺を通す
  return leftType;
}


// 識別子を束縛先のノードまで辿る。`l : [1 2 3]` と書いてから `l ' 0` と引く形は普通なので、
// ここを辿れないと実用上ほとんどの添字が型を失う。pass2 が縮約済みノードをメモ化している。
function derefToNode(node, env) {
  if (!isIdentifierNode(node) || !env) return node;
  const b = envLookup(env, node.value);
  return (b && (b.valueNode || b.rhsNode)) || node;
}

// List ノードの要素型を読む。まだ注釈されていなければ推論を走らせてから読む。
function elementTypeOfNode(node, env) {
  if (!node) return null;
  if (node.elementType) return node.elementType;
  inferAtomType(node, env);
  if (node.elementType) return node.elementType;
  // **1行だけの括りは括りでしかない。** `(f 5) ' 1` の `(f 5)` は器の型（`Int | List`）
  // までは運ぶのに、要素型を運んでいなかった——呼び先の返値の要素型は中の適用ノードに
  // 載っている（`callee.returnsElementType`）ので、括りを剥がさないと届かない。
  // 型を運ぶのに要素型を落とすと、Pass 4 が `base + i × sizeof(T)` を出せない。
  if (node.type === "block" && Array.isArray(node.lines) && node.lines.length === 1 && node.kind !== "abs" && node.kind !== "norm") {
    return elementTypeOfNode(node.lines[0], env);
  }
  return null;
}

// 器の要素型。識別子なら識別子テーブルへ書き戻された値を使う——Pass 3 の不動点が合成値の
// 型と要素型を書き戻しているので、`l : [1 2 3]` と束縛してからの `l ' 0` もここで解ける。
// 後置 `~`（展開）が付いているか。§5.3 のマージは「双方に `~`」が条件なので、
// 値ではなく**書かれ方**を見る。
function isSpreadNode(n) {
  return !!n && n.type === "operation" && n.position === "postfix" && n.name === "expand";
}

// 名前付きスロットを `名前 -> 値ノード` で読む。識別子なら束縛先まで辿る。
// **型ではなくノードを持つ。** 型からは大きさが出ないからである（文字列の長さ、
// リストの要素数、レンジの実体はノードにしか無い）——形の解決がここを読む。
function namedSlotTypes(node, env) {
  const d = derefToNode(isSpreadNode(node) ? node.operand : node, env);
  const target = derefToNode(d, env);
  if (!target) return null;
  // 既にマージ済みの結果はスロット表をそのまま持っている。`a~ b~ c~` は左結合なので、
  // 3つ目を足すときの左辺は「マージ済みの構造体」であって展開ノードではない。
  if (target.mergedSlots) return target.mergedSlots;
  if (target.slotKind !== "named") return null;
  const out = new Map();
  for (const line of target.lines || []) {
    if (isDefineNode(line) && isIdentifierNode(line.left)) out.set(line.left.value, line.right);
    else if (isIdentifierNode(line)) out.set(line.value, line);
  }
  return out;
}

/**
 * 構造体のマージ（list_model.md §5.3）。**双方に後置 `~` があるときだけ**成立する。
 *
 * 規則は3つ。重複しないキーは足す。重複するキーは**両辺の型が一致するときだけ**
 * 上書きを許す（右が勝つ）。型が違えばコンパイルエラーである——「型安全な上書き」と
 * 呼ばれているのは、上書きが型を変えないことを保証するという意味だからである。
 *
 * 全て静的に決まる。マージ対象のフィールド型はコードの評価前に確定しており、
 * 実行時型情報を必要としない（§5.3 の NOTE）。
 */
function mergedStructSlots(node, env) {
  // 右辺には必ず `~` が要る（足す側が展開されていなければマージではない）。左辺は
  // 展開ノードか、既にマージ済みの結果のどちらかでよい——`a~ b~ c~` の左結合に対応する。
  if (!isSpreadNode(node.right)) return null;
  if (!isSpreadNode(node.left) && !node.left.mergedSlots) return null;
  const l = namedSlotTypes(node.left, env);
  const r = namedSlotTypes(node.right, env);
  if (!l || !r) return null;
  for (const [k, rNode] of r) {
    if (!l.has(k)) continue;
    const lt = inferAtomType(l.get(k), env);
    const rt = inferAtomType(rNode, env);
    // 未解決（null）は判定できないので断じない（原理4）。
    if (lt === null || rt === null || lt === rt) continue;
    throw new TypeError(
      `list_model.md §5.3違反: 構造体のマージで型が衝突しています（${bareIdent({ value: k })} が ${lt} と ${rt}）。` +
        "上書きが許されるのは両辺の型が一致するときだけです"
    );
  }
  return new Map([...l, ...r]);
}

// スロットの種別。名前付きか連番かは**中身にしか無い**ので、識別子なら束縛まで辿る。
function slotKindOf(node, env) {
  if (isIdentifierNode(node) && env) {
    const b = envLookup(env, node.value);
    if (b && b.slotKind) return b.slotKind;
  }
  const d = derefToNode(node, env);
  return (d && d.slotKind) || null;
}

function containerElementType(node, env) {
  if (isIdentifierNode(node) && env) {
    const b = envLookup(env, node.value);
    if (b && b.elementType) return b.elementType;
  }
  return elementTypeOfNode(derefToNode(node, env), env);
}


/**
 * `'`（添字・フィールドアクセス）の結果型（type_system.md §2 のアクセス表）。
 *
 * これまで `'` は左辺優先ルールへ落ちて**器の型をそのまま返して**いた——`[1 2 3] ' 0` が
 * `Int` ではなく `List` になっていた。値は正しく `1` を返しているので、型だけが器のまま
 * 取り残されていたことになる。Pass 4 は `base + i × sizeof(T)` を出すのに要素型 `T` を
 * 必要とするので、ここは落としてはいけない情報である。
 *
 * 添字が**範囲**のときだけ結果は器と同じ型になる（部分列は同じ器だから）。
 */
// 添字が**部分列を指す**形かどうか。`l ' 1~`（後置 `~`＝そこから先）と `l ' (1 ~ 2)`
// （範囲式）の2つがある。単一の点を指す添字と違い、結果は器と同じ型になる。
function sliceIndexNode(node) {
  let r = node.right;
  if (!r) return false;
  // 括弧1段は剥がす（`(1 ~ 2)` のように優先順位のために括る形）。
  while (r.type === "block" && Array.isArray(r.lines) && r.lines.length === 1) r = r.lines[0];
  if (r.type !== "operation") return false;
  // `s ' 1~` は Pass 2 が `s ' (1 ~+ 1)` へ均しているので（`desugarIndexRest`）、
  // ここで後置 `~` を見る必要は無い——添字が部分列を指すかどうかは**レンジかどうか**
  // だけで決まる。
  return r.name === "range" || RANGE_STEP_OPS.has(r.name);
}

// 連番スロットを左から並べる。`1 , \`a\` , 2.5` は product の入れ子なので均す。
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
function slotsByFamily(node, coproduct) {
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

function positionalSlots(node) {
  if (!node) return [node];
  const isCoproduct = node.type === "operation" && COPRODUCT_OPS.includes(node.name);
  if (node.type === "operation" && (node.name === "product" || isCoproduct)) return slotsByFamily(node, isCoproduct);
  if (Array.isArray(node.lines) && node.lines.length === 1) return positionalSlots(node.lines[0]);
  return [node];
}

/**
 * スロットの**形の鍵**。型と、並ぶものなら個数まで含めた文字列を返す。
 *
 * `List` と `Struct` を分ける基準は §2 が明言している通り「Pass 4 が1つの命令
 * テンプレートで済むか」であり、それは **`base + i × stride` が書けるか**である。
 * つまり要る条件は型が揃っていることではなく**幅が揃っていること**である。
 *
 *   1 2 , 3 4     スロットは List(Int) が2つ、幅も 16 と 16   → 揃う
 *   1 2 , 3 4 5   スロットは List(Int) が2つ、幅は 16 と 24   → 揃わない
 *
 * 2つ目は**型だけ見ると同じ**なので、型の一致だけを見ていると取り違える。だから鍵には
 * 個数を含める。幅そのもの（バイト数）はターゲットが決めるが、**揃っているかどうかは
 * ターゲットに依らない**——同じ型が同じ個数並ぶなら、どのターゲットでも同じ幅になる。
 */
/**
 * 撒いたときに**1つ置かれるもの**の形の鍵。
 *
 * 器なら要素、器でなければ自分自身である（スカラーは1要素の器なので撒いても1つ）。
 * `String` の要素は `Char`（原理7）。
 */
function spreadItemKey(inner, env, depth) {
  if (!inner) return "?";
  const t = inferAtomType(inner, env);
  if (t === "String") return "Char";
  if (t === "List" || t === "Iterator") {
    // **器の要素型は名前の先にある。** 識別子ノード自身は要素型を持たないので、束縛まで
    // 辿らないと「決まらない（?）」に落ちて、揃っているかの判定が素通りする。
    const el = containerElementType(inner, env) ?? elementTypeOf(inner, env);
    return el ? String(el) : "?";
  }
  return slotShapeKey(inner, env, depth + 1);
}

function slotShapeKey(node, env, depth = 0) {
  if (!node || depth > 8) return "?";
  // **撒いているスロットは「器1つ」ではなく、その要素たちである。** 置かれるのは中身なので
  // 形も中身で見る——ここを器のまま見ていたため `a~ , x` が「List と Char で揃わない」と
  // 読まれて `Struct` へ落ち、入れ子になっていた。撒くかどうかは**書かれ方**で決まる
  // （`isSpreadNode`）ので、値の側を見る必要は無い。
  if (isSpreadNode(node)) return spreadItemKey(node.operand, env, depth);
  const type = inferAtomType(node, env);
  if (type === "List") {
    const items = listItemNodes(node, env);
    const el = node.elementType || "?";
    return items === null ? `List(${el})?` : `List(${el})[${items.length}]`;
  }
  // **`String` は中身の長さで分かれない。** スロットに置かれるのは常に `{ptr, len}` の
  // 16 バイトであり（`slotCellSize`）、中身が何文字かは配置に効かない。ここを長さで
  // 比べていたので、`[`ab` , `c`]` のように**長さの違う文字列が並ぶだけ**で「揃わない」と
  // 読まれ、`List(String)` ではなく `Struct` になっていた——トークン列がまさにその形である。
  //
  // `measure`（中身の長さ）と `passingOf`（運ぶ幅）の取り違えは、これで6度目である。
  if (type === "String") return "String";
  if (type === "Struct") {
    const d = derefValueNode(node, env);
    const slots = d && d.slotKind === "named" ? [...namedSlots(d).values()] : positionalSlots(d);
    if (slots.length === 1 && slots[0] === d) return "Struct?";
    return `Struct(${slots.map((x) => slotShapeKey(x, env, depth + 1)).join(" ")})`;
  }
  return String(type);
}

// List の要素ノード。均せなければ null（個数が読めない）。
function listItemNodes(node, env) {
  let d = derefValueNode(node, env);
  if (!d) return null;
  // 括りのブロックを剥がす。中身が何であれ、1行だけのブロックは括りでしかない。
  while (Array.isArray(d.lines) && d.lines.length === 1) d = d.lines[0];
  // **均質な直積も List である**（カンマが上げた次元の行）。行の並びを数えるには
  // 直積で割る必要がある——`[1 2 , 3 4]` は行が2つであって1つではない。
  // どの族で割るかは根が決める（族を混ぜると次元が潰れる）。
  const coproduct = ["construct", "concat", "push", "unshift"];
  const isProduct = d.type === "operation" && d.name === "product";
  const same = (n) =>
    n && n.type === "operation" && (isProduct ? n.name === "product" : coproduct.includes(n.name));
  const flat = (n) => {
    if (same(n)) return [...flat(n.left), ...flat(n.right)];
    if (!isProduct && n && Array.isArray(n.lines) && n.lines.length === 1 && same(n.lines[0])) return flat(n.lines[0]);
    return [n];
  };
  // 行のブロック（`L :` の下に行が並ぶ形）は行そのものが要素である。
  if (Array.isArray(d.lines) && d.lines.length > 1 && d.lines.every((l) => !isDefineNode(l))) return d.lines;
  const items = flat(d);
  return items.length === 1 && items[0] === d ? null : items;
}

// 名前付きスロットを `名前 -> 値ノード` で取り出す。
function namedSlots(node) {
  const out = new Map();
  for (const line of node.lines || []) {
    if (isDefineNode(line) && isIdentifierNode(line.left)) out.set(line.left.value, line.right);
    else if (isIdentifierNode(line)) out.set(line.value, line);
  }
  return out;
}

/**
 * 値ノードを辿る。識別子は束縛先へ、適用は呼び先の返値へ。
 *
 * `derefToNode` は識別子だけを辿る。ここは**適用も辿る**——`fst (expr ts)` の実引数が
 * どんな形かは `expr` の本体にしか無いからである。呼び出しサイトから形を運ぶには、
 * サイトに書かれている式の先まで行く必要がある。
 */
function derefValueNode(node, env, seen = new Set()) {
  if (!node || !env) return node;
  if (isIdentifierNode(node)) {
    if (seen.has(node.value)) return node;
    seen.add(node.value);
    const b = envLookup(env, node.value);
    const next = b && (b.valueNode || b.rhsNode);
    return next ? derefValueNode(next, env, seen) : node;
  }
  if (node.type === "operation" && (node.name === "apply" || node.name === "partial_apply")) {
    const { base } = applyChainOf(node);
    if (isIdentifierNode(base) && !seen.has(base.value)) {
      seen.add(base.value);
      const b = envLookup(env, base.value);
      if (b && b.returnsNode) return derefValueNode(b.returnsNode, env, seen);
    }
    return node;
  }
  // ブロックは最終行が値である。1行なら括りでしかなく、複数行なら match_case の
  // 最後の枝——どちらも「そのブロックが返すもの」は最終行に書いてある。ブロックの型を
  // 最終行から取るのは Pass 3 の既定の読み方なので、形も同じ読み方に揃える。
  // ただし**名前付きスロットのブロックは値そのもの**である。`[x : 1 / y : 2.5]` の
  // 各行はスロットであって枝ではないので、最終行へ潰すと構造体が1スロットに化ける。
  if (Array.isArray(node.lines) && node.lines.length > 0 && !node.slotKind) {
    const last = node.lines[node.lines.length - 1];
    if (last !== node) return derefValueNode(last, node.scope || env, seen);
  }
  return node;
}

/**
 * `Struct` の**スロットの形**（種別とスロットごとの型）を読む。読めなければ null。
 *
 * 型名（`Struct`）だけでは `p ' 0` が何を返すか決まらない。スロットごとに型が違って
 * よいのが直積の意味なので（§2）、必要なのは並びそのものである。**呼び出しサイトは
 * それを知っている**——`fst (expr ts)` の `expr` は返値の形を持っているので、そこから
 * 運べば仮引数の側でも添字が解ける。
 */
function structShapeOf(node, env) {
  const base = derefValueNode(node, env);
  if (!base || inferAtomType(base, env) !== "Struct") return null;
  if (base.slotKind === "named") {
    const m = namedSlots(base);
    if (m.size === 0) return null;
    return { slotKind: "named", names: [...m.keys()], types: [...m.values()].map((n) => inferAtomType(n, env)) };
  }
  const slots = positionalSlots(base);
  // 分解できていない（自分自身1個）なら形は読めない。
  if (slots.length <= 1 && slots[0] === base) return null;
  return { slotKind: "positional", types: slots.map((n) => inferAtomType(n, env)) };
}

// 形が同じかどうか。スロットごとの型まで一致して初めて同じ形である。
function sameShape(a, b) {
  if (!a || !b) return false;
  return a.slotKind === b.slotKind && JSON.stringify(a.types) === JSON.stringify(b.types) && JSON.stringify(a.names || null) === JSON.stringify(b.names || null);
}

// `'` の右辺に置かれた前置 `@` は「名前ではなく中身を使う」という指示である
// （参照外しではない）。仮引数の型を逆算する側がそれを知る必要があるので、印を付ける。
// `'` の右辺が「値として引く」形か（前置 `@`、または数値・式）。
function isGetPropValueKey(k) {
  return !!k && k.type === "operation" && k.position === "prefix" && k.name === "input";
}

function markGetPropKey(node) {
  const k = node && node.right;
  if (k && k.type === "operation" && k.position === "prefix" && k.name === "input") k.inGetPropKey = true;
}

/**
 * そのアドレスが**何を指しているか**。`$` が書き留めた印を、識別子なら束縛先まで辿って拾う。
 *
 * `elementType`（器の要素型）と同じ運び方をする——ノードに付き、束縛へ書き戻され、
 * 呼び出しサイトと返値を通って次の段へ渡る。**型は帳簿なので、1つ足しても命令は増えない。**
 */
function pointeeOfNode(n, env) {
  if (!n || typeof n !== "object") return null;
  // 括弧は剥ぐ。
  while (n && Array.isArray(n.lines) && n.lines.length === 1) n = n.lines[0];
  if (!n) return null;
  if (n.pointee) return { type: n.pointee, element: n.pointeeElement || null, node: n.pointeeNode || null };
  const d = derefToNode(n, env);
  if (d && d !== n && d.pointee) return { type: d.pointee, element: d.pointeeElement || null, node: d.pointeeNode || null };
  if (isIdentifierNode(n) && env) {
    const b = envLookup(env, n.value);
    if (b && b.pointee) return { type: b.pointee, element: b.pointeeElement || null, node: b.pointeeNode || null };
    if (b && b.returnsPointee) {
      return { type: b.returnsPointee, element: b.returnsPointeeElement || null, node: b.returnsPointeeNode || null };
    }
  }
  // 適用の結果は呼び先の返値である。
  if (n.type === "operation" && (n.name === "apply" || n.name === "partial_apply")) {
    const callee = applyCalleeBinding(n, env);
    if (callee && callee.returnsPointee) {
      return { type: callee.returnsPointee, element: callee.returnsPointeeElement || null, node: callee.returnsPointeeNode || null };
    }
  }
  return null;
}

// 直和のうち**器の側**（広い方）。置かれ方がそちらなので、引き方もそちらで決まる。
const CONTAINER_TYPES = new Set(["String", "List", "Struct", "Iterator", "Implicit"]);
function widestMember(type) {
  if (typeof type !== "string" || !type.includes(" | ")) return type;
  const parts = type.split(" | ").map((t) => t.trim());
  return parts.find((t) => CONTAINER_TYPES.has(t)) || type;
}

/**
 * **構造体を返す式の並び。** Pass 4 の `structShapeOf` と同じ問いで、同じ3通りである
 * ——リテラル（名前を経由するものを含む）、仮引数（`binding.shape`）、そして
 * `x ' k` のように別の構造体から取り出したもの（外側の並びの `slots[].shape`）。
 *
 * ここが無かったので型が**1段で切れていた**：`n ' b` は Struct と付くのに
 * `(n ' b) ' d` は null になり、Pass 4 は命令を選べなかった。
 */
function structShapeOfNode(node, env, depth = 0) {
  const u = node && node.type === "block" && node.kind === "paren" && node.lines && node.lines.length === 1 ? node.lines[0] : node;
  if (!u || depth > 8) return null;
  const conf = { target: "aarch64_qemu", charset: "ascii", env };
  const direct = layoutOfStruct(u, conf);
  if (direct) return direct;
  if (isIdentifierNode(u) && env) {
    const b = envLookup(env, u.value);
    if (b && b.shape && b.shape.slotKind === "named") return b.shape;
  }
  if (u.type === "operation" && u.name === "get_prop") {
    // 器の要素を引いた形。要素はどれも同じ形なので、並びは要素そのものが持っている。
    const bl = u.left;
    if (bl && (bl.atomType === "List" || bl.atomType === "Iterator")) {
      const direct = elementShapeOfList(bl, conf);
      if (direct) return direct;
      // 仮引数として受けた器には値ノードが無い。呼び出しサイトから起こしたものが束縛に在る。
      if (isIdentifierNode(bl) && env) {
        const b2 = envLookup(env, bl.value);
        if (b2 && b2.elementShape && b2.elementShape.slotKind === "named") return b2.elementShape;
      }
      return null;
    }
    const base = structShapeOfNode(u.left, env, depth + 1);
    if (!base || base.slotKind !== "named" || !Array.isArray(base.slots)) return null;
    const sl = slotOfKey(base, u.right);
    return (sl && sl.shape) || null;
  }
  return null;
}

/** 並びの中から、この鍵が指すスロットを1つ選ぶ。名前でも連番（**宣言順**）でも引ける。 */
function slotOfKey(shape, key) {
  if (!shape || !Array.isArray(shape.slots) || !key) return null;
  if (key.type === "atom" && key.kind === "number") {
    const i = parseInt(key.value, 10);
    return shape.slots.find((x) => x.ordinal === i) || null;
  }
  // 名前は綴りではなく中身（layout.js の `bareName` と同じ規則）。
  if (key.type === "atom" && (key.kind === "identifier" || key.kind === "string")) {
    const v = String(key.value);
    const bare = v.length >= 2 && ((v[0] === "<" && v[v.length - 1] === ">") || (v[0] === "`" && v[v.length - 1] === "`")) ? v.slice(1, -1) : v;
    return shape.slots.find((x) => x.name === bare) || null;
  }
  return null;
}

function getPropResultType(node, env) {
  markGetPropKey(node);
  // 器そのものを解決する。識別子なら束縛先まで辿る——`l : [1 2 3]` の `l ' 0` を
  // 解けなければ、実用上ほとんどの添字が型を失う。
  const base = derefToNode(node.left, env);
  // **直和は広い方で引く。** 置かれているのが広い方だからである（layout.js の
  // `passingOf`：「表現の違う枝の直和は広い方に揃える」）。`Char | String` は器として
  // 置かれているので、引けば `Char` が出る——狭い枝（1文字）も器として置かれている以上、
  // 同じ引き方で正しい。
  const containerType = widestMember(inferAtomType(node.left, env));

  // 範囲添字は部分列なので器と同じ型。要素型もそのまま引き継ぐ。
  if (sliceIndexNode(node)) {
    // **長さ1のリストは存在しない。** 終端が起点と同じ切り出し（`s ' (1 ~+ 1 ~ 1)`）は
    // 1要素であり、値としては既にスカラーになっている（interpreter.js）——型だけが器の
    // まま取り残されると、幅が値より広くなる。
    //
    // 終端の無い形（`s ' i~`）は器の長さが要るので、そこは触らない。**これは直和の理由
    // ではない**——直和（`Char | String`）は「どちらか分からない」ではなく「経路によって
    // 型が違う」ことであり、両方の型はコンパイル時に決まっている（`gap` の枝はリテラルの
    // `Char` と計算した `String`）。実行時に決まるのは**どの経路を通るか**だけである。
    if (sliceLengthOne(node, env)) {
      if (containerType === "String") return "Char";
      const el = containerElementType(node.left, env);
      if (el) return el;
    }
    if (containerType === "List") node.elementType = containerElementType(node.left, env);
    // **規則を切っても規則である。** `repr` は「どう置かれているか」を持つ帳簿なので、
    // ここで落とすと `[0 ~ 3] ' 2~` が「要素列への参照」に見え、Pass 4 が `start` を
    // ポインタとして読む命令を出す。切るというのは起点をずらす算術1つであって、
    // 要素はどこにも現れない。
    // 識別子は「どう置かれているか」を持たない——持っているのは束縛の側で、仮引数なら
    // 呼び出しサイトから観測した `repr` がそこに在る。`base` を見るだけでは、規則を
    // 受け取った仮引数を切ったときに落ちる。
    if (reprOfNode(node.left, env) === "rule") node.repr = "rule";
    // **カーソルを進めた結果もカーソルである。** 枝と位置をずらすだけで、要素はどこにも
    // 現れない——器を切った結果が器であるのと同じことである。群も一緒に運ぶ（引く命令が
    // どこへ跳ぶかはそこから決まる）。
    const cg = cursorGroupOfNode(node.left, env);
    if (cg) {
      node.repr = "cursor";
      node.cursorGroup = cg;
    }
    return containerType;
  }

  // **`String` の添字は `Char` である。**
  //
  // `String ≅ List(Char)` であり（§2）、`List(T) ' i` が `T` を返すのと同じ引き方をする。
  // ここが長く `String` を返していたのは、`Char` が Layer 2 の型になる前に「1文字も
  // String」と書かれた規則が残っていたからである——`Char` を足した時点で、この行は
  // 「要素型」ではなく「器の型」を返すようになっていた。
  //
  // 実害は Pass 4 で出た。`is_digit : c ? \0 <= c <= \9` の `c` を呼び出しサイトから
  // 逆算すると `s ' 0`＝`String` になり、仮引数を `{ptr, len}` の2本で受けるという
  // 結論になる。同じ `c` が本体では `Char`（レジスタ1本）として比較されるので、
  // **入口と本体で幅が食い違う**。型が値より広いときに起きる、いつもの壊れ方である。
  if (containerType === "String") return "Char";

  // **どの器かが決まっていなければ、要素の型も決まらない。** `Container` は「器である」
  // としか言っていない。ここを素通りさせると最後の `return containerType` に落ちて
  // 「器の要素は器である」と書いてしまう——器の要素が器とは限らない（原理4）。
  // 決まるのは呼び出しサイトが実引数を見せた時点である。
  if (containerType === "Container") return null;

  // List と Iterator はどちらも「同じ型の要素が並ぶもの」で、違いは実体を持つかどうかだけ。
  // **型の上では同じ引き方をする**ので、添字の結果はどちらも要素型である。
  if (containerType === "List" || containerType === "Iterator") {
    return containerElementType(node.left, env) || null;
  }

  if (containerType === "Struct") {
    const key = node.right;
    // **入れ子も辿る。** 名前で引いた結果がまた構造体なら、その並びは外側の並びの中の
    // スロットが持っている（layout.js の `slots[].shape`）。名前でも連番でも同じ表を引く。
    {
      const shape = structShapeOfNode(node.left, env);
      const sl = shape && shape.slotKind === "named" ? slotOfKey(shape, key) : null;
      if (sl && sl.type) return sl.type;
    }
    // 名前付きスロットは名前で引く。
    if (base && base.slotKind === "named" && isIdentifierNode(key)) {
      const slot = namedSlots(base).get(key.value);
      return slot ? inferAtomType(slot, env) : null;
    }
    // 連番スロットはリテラルの添字で引く。**実行時の添字は静的に解けない**
    // ——スロットごとに型が違ってよいのが直積の意味なので、どの命令を出すか決まらない
    // （§2「多相な Struct への実行時添字はコード生成できない」）。
    const slots = base && base.slotKind === "named" ? [...namedSlots(base).values()] : positionalSlots(base);
    // 呼び出しサイトから形が届いていれば、それで解ける。中身が見えないのは**定義サイト
    // だけ**であって、呼ばれ方まで含めればスロットの型は書いてある。
    if (isIdentifierNode(node.left) && env) {
      const b = envLookup(env, node.left.value);
      const sh = b && b.slotShape;
      if (sh && key && key.type === "atom" && key.kind === "number") {
        const i = parseInt(key.value, 10);
        return sh.types[i] ?? null;
      }
      if (sh && sh.slotKind === "named" && isIdentifierNode(key)) {
        const i = sh.names.indexOf(key.value);
        return i >= 0 ? sh.types[i] : null;
      }
    }
    // **スロットへ分解できなければ、添字は解けない。** 仮引数のように中身の見えない
    // `Struct` は `positionalSlots` が自分自身1個を返すだけなので、`p ' 0` がスロットの型
    // ではなく**器の型そのもの**を返してしまう——`fst : p ? p ' 0` が `Struct -> Struct`
    // になっていた。`p ' 1` は範囲外で `_` になるので、同じ関数の 0 と 1 で答えの質が
    // 変わっていたことになる。偶然当たった型は、未解決より悪い。
    if (slots.length === 1 && slots[0] === base) return null;
    if (key && key.type === "atom" && key.kind === "number") {
      const i = parseInt(key.value, 10);
      return slots[i] ? inferAtomType(slots[i], env) : null;
    }
    // **多相な `Struct` への実行時添字は原理的にコード生成できない**（§2）。`p ' @i` は
    // 「名前ではなく中身で引く」形だが、スロットごとに型が違ってよいのが直積の意味なので、
    // どの命令を出すか決まらない。スロットの型が全部同じならそれは `List` である
    // （幅が揃うかで分ける、§2）ので、ここへ来るのは本当に多相な場合だけである。
    //
    // 黙って未解決にせず名指しする——`_` のままだと「まだ実装していない」に見えるが、
    // これは**書けないことが決まっている**形である。
    // 実行時の添字が引けない理由は2つあり、どちらかは必ず当たる。
    //
    //   名前付き … 物理配置は**名前順**なので、連番と一致しない。「N番目は offset N×幅」
    //              の確約が得られるのは連番スロットだけである（stack_abi.md §7.1 CAUTION）
    //   連番     … スロットごとに型が違う。揃っていればそれは `List` である（§2）ので、
    //              ここへ来る連番スロットは必ず多相である
    if (isGetPropValueKey(key)) {
      node.runtimeIndexProblem = base && base.slotKind === "named" ? "named" : "polymorphic";
    }
    return null;
  }

  return containerType;
}

function literalAtomTypeFromKind(node) {
  switch (node.kind) {
    // アドレスは `0x` 記法のみ（§3.6）。十進整数は `Int`。
    case "number": return node.value.includes(".") ? "Float" : "Int";
    // **1文字は `Char`、2文字以上が `String`。**
    //
    // `String ≅ List(0u)`（§2）であり、1要素のリストはスカラーと同型（`[5]` は `Int`）。
    // したがって1文字の文字列は `0u` 1個そのもの——`Char` である。潰れの規則を型に
    // 見せているだけで、新しい概念ではない。
    //
    // 分けないと**表現が実行時の長さで変わる**。`Char` はレジスタに乗る符号位置、
    // `String` は `{ptr, len}` の参照（stack_abi.md §4.6）なので、同じ型が両方を
    // 指すと実行時に見分ける必要が出る——それは動的型付けである。
    //
    // **0文字は `Unit` ではなく `String` である。** 値としては空文字列も `__` も同じもの
    // （零対象は一つ）だが、型だけが違う——`` `` 1 2 3 `` が `` `123` `` になり
    // `__ 1 2 3` が `[1 2 3]` になるのは、`` `` `` が「以降をテキストとして連結する」と
    // 宣言しているからである（type_system.md §余積族の型変換テーブル）。ここを `Unit` に
    // すると余積の吸収則が効かなくなり、テキスト連結が List 構築へ落ちる。
    case "string": return [...node.value.slice(1, -1)].length === 1 ? "Char" : "String";
    case "char": return "Char";
    case "address": return "Address";
    case "register": return "Address";
    // U+0000 は Char の値域から除外された niche なので Unit（value_representation.md §3）。
    case "unicode": return parseInt(literalDigits(node.value), 16) === 0 ? "Unit" : "Char";
    case "unit": return "Unit";
    default: return null; // identifier/hole/unknown はここでは扱わない
  }
}

// node（Pass2が返す二分木ASTのノード）のLayer 2 Atom内部型を推論する。
// env は識別子のatom_type解決のため（pass1.jsのBinding.atomTypeを参照）。
//
// 結果はノード自身の `atomType` フィールドへ載せる（メモ化＋注釈を兼ねる）。
// type_system.md §5 の Pass 3 は出力を「完全型付きAST」と定めており、原理2の
// 「型は実行時ゼロコストの帳簿」に照らせば、**ASTそのものが帳簿の担体**である
// （汚染ではない）。Pass 4 も同じノードから型を読んで命令を選ぶことになる。
function inferAtomType(node, env) {
  if (!node || typeof node !== "object") return null;
  // **カーソルの印は不動点を跨いで生き残る。** `clearTypeAnnotations` は周回ごとに
  // `repr` を消すが、`cursorGroup`（糖衣が付ける、消されない印）から毎回書き戻す。
  // 型の側の分岐（積 → `Struct`）へ落ちる前に置く必要がある——置かれているのは
  // `{arm, k, 入力}` の3つ組であって、メモリ上の並びではない。
  if (node.cursorGroup && node.repr !== "cursor") node.repr = "cursor";
  if (node.atomType !== undefined) return node.atomType;
  const inferred = computeAtomType(node, env);
  node.atomType = inferred;
  return inferred;
}

function computeAtomType(node, env) {
  if (node.type === "atom") {
    if (node.kind === "identifier") {
      if (!env) return null;
      const binding = envLookup(env, node.value);
      return binding ? binding.atomType ?? null : null;
    }
    return literalAtomTypeFromKind(node);
  }

  if (node.type === "block") {
    // `|x|`（abs）は「数値の絶対値」と「リストの要素数」を兼ねる多重定義である。
    // オペランドがUnitのとき、`__ = []`（unit.md）の同一視によって「空リスト＝要素数0」
    // とも「値の不在」とも読めてしまい、**値だけでは決まらない**。これは `5 / 2` と
    // `5.0 / 2` を型で分けたのと同じ構図なので、型で決める（原理2：型はゼロコストの帳簿）。
    // ここではオペランドの型を記録するだけで、Unitの読み替えは評価器が行う。
    // 結果型は絶対値・要素数のいずれも非負の機械語1語に収まるため Int（uint）とする。
    // ——アドレスではない。要素数はどこも指していない（§3.6）。
    // ノルム（`~|...|~`）は常に要素数なので、オペランドの型で読み替える必要が無い
    // ——空は 0、スカラーは 1 である（1要素の器は存在しない）。
    if (node.kind === "norm") return "Int";
    if (node.kind === "abs") {
      node.operandType =
        Array.isArray(node.lines) && node.lines.length > 0
          ? inferAtomType(node.lines[node.lines.length - 1], node.scope || env)
          : "List";
      return "Int";
    }
    if (!Array.isArray(node.lines) || node.lines.length === 0) return "List";
    // 全行が define(key:val) かつ左辺が識別子 → Struct（list_model.md §5.3、
    // pattern_guide.mdの改行区切り構造体リテラルの形）。単一エントリの `[foo : 1]` も含む。
    // 左辺が識別子でない define 行（match_caseの `cond : result`）は構造体ではないので
    // 除外する——interpreter.jsの構造体判定と同じ基準に揃えてある。
    // それ以外（関数本体等）は「ブロックの値＝最後の文の値」にフォールバックする。
    // 関数本体（pass2 が isFunctionBody を立てたインデントブロック）は構造体にならない。
    // そこでの `識別子 : 値` は match_case であり、構造体を返すにはカッコで囲む。
    // フィールドは `a : x`（明示）と `x`（省略記法）の2通り。省略記法は2行以上のときだけ
    // 有効で、`[x]` が1要素リスト ≅ スカラーであることを壊さない（interpreter.jsと同基準）。
    //
    // 名前付きスロットには `slotKind: "named"` を立てる。物理オフセットは名前でソートした
    // 正規順で割り当てられるが（stack_abi.md §7.1）、**その順序は言語から観測できない**
    // ——`==` は Hom集合の一致で宣言順を問わず、位置アクセスも持たない。順序が意味を持つ
    // のは連番スロット（`slotKind: "positional"`）の側であり、両者は互いの順序を漏らさない。
    // 「名前が関心事か、順序が関心事か」がこの2つを分ける唯一の軸である（§2）。
    if (!node.isFunctionBody) {
      // **名前は識別子でも文字列でも綴れる。** スロットの意味論は「名前→値の有限写像」で
      // あり（function_guide.md）、名前が識別子として綴れるかどうかは別の話である
      // ——演算子記号を鍵にした表（`` `+` : `add` ``）を書けるようにするために要る。
      // interpreter.js の `isSlotKeyNode` と同じ基準にしてある。**片方だけ広げると、
      // 同じソースが解釈器では構造体・機械語では match_case になる**（実際そうなった）。
      const slotKey = (n) => isIdentifierNode(n) || (!!n && n.type === "atom" && n.kind === "string");
      const explicit = (l) => isDefineNode(l) && slotKey(l.left);
      if (node.lines.every(explicit)) {
        node.slotKind = "named";
        return "Struct";
      }
      if (node.lines.length >= 2 && node.lines.every((l) => explicit(l) || isIdentifierNode(l))) {
        node.slotKind = "named";
        return "Struct";
      }
    }
    // 関数本体（match_case の並び）の型は、各 arm の型の**直和**である（§7.3）。
    // 最終行だけを見ると、途中の arm が返しうる型が消えてしまう。
    if (node.isFunctionBody) {
      // **「自分を呼ぶだけ」の枝は数えない。**
      //
      // 選択（`通れば並べて再帰／落ちれば並べずに再帰`）の後者がこれである。その枝は
      // 「結果は全体と同じものである」としか言っておらず、新しいことを何も足さない。
      // join に入れると `X = join(A, X)` になり、**自分で自分を養い続ける**——実際
      // `Int | List | Struct` と発散していた。
      //
      // この方程式の最小解は `A` である。だから落とすのは近似ではなく、**最小不動点を
      // 取る**ということそのものだ。`joinArmTypes` が `Unit`（零対象＝直和の単位元）を
      // 落とすのと同じ扱いで、情報を持たない枝は単位元として扱う。
      const selfOnly = (v) => {
        let b = v && v.type === "block" && (v.lines || []).length === 1 ? v.lines[0] : v;
        while (b && b.type === "operation" && b.name === "apply") b = b.left;
        while (b && b.type === "block" && (b.lines || []).length === 1) b = b.lines[0];
        return !!(node.selfName && b && b.type === "atom" && b.kind === "identifier" && b.value === node.selfName);
      };
      const armValues = node.lines.map((line) => (isDefineNode(line) ? line.right : line));
      const armTypes = armValues.map((v, i) =>
        selfOnly(v) && armValues.some((o, j) => j !== i && !selfOnly(o)) ? "Unit" : inferAtomType(v, node.scope || env)
      );
      // **実体の種類も枝で合流する。** どれか1つでも規則を返す枝があれば、全体は規則で
      // ある——場所は規則として歩けるが（`makeWalk`：器の上を走るイテレータ）、規則を
      // 場所へ戻すには確保が要るからである。type_system.md §2 の「表現の違う枝の直和は
      // 広い方に揃える」を、型ではなく実体の側へ当てたもの。
      const armNodes = node.lines.map((line) => (isDefineNode(line) ? line.right : line));
      if (armNodes.some((a) => a && a.repr === "closure")) node.repr = "closure";
      // **要素型も枝で合流する。** 型（`List`）だけ合流させて要素型を落とすと、返値を
      // 引く側で幅が決まらない——`(m [1 2 3]) ' 1` が「まだ出せない」になっていた。
      // 基底の枝は `__`（`Unit`）で要素型を持たないので、**持っている枝から採る**
      // ——`joinArmTypes` が `Unit` を落とすのと同じ扱いである。
      //
      // **食い違う枝は join する。** 以前はそこで諦めていたが、それは「違う」と「まだ
      // 決まっていない」を混ぜていた。lexer.sn の `tokens` は記号1文字の枝が `Char`、
      // 語の枝が `String` で、`String ≅ List(Char)`（原理7）だから上限は `String` で
      // ある。諦めると要素型が消え、再帰の枝が `Char` のまま固定されて——**型は通るのに
      // 1要素 1 byte で場所を測る**という一番たちの悪い形になっていた。
      //
      // 本当に合流しない枝（`joinElementTypes` が `NO_JOIN` を返す）だけは、これまで
      // 通り決めない。原理4——決まらないものを決まったことにはしない。
      const els = [...new Set(armNodes.map((a) => a && a.elementType).filter((x) => x))];
      if (els.length === 1) node.elementType = els[0];
      else if (els.length > 1) {
        const j = els.reduce((x, y) => (x === null || x === NO_JOIN ? x : joinElementTypes(x, y)));
        if (j && j !== NO_JOIN) node.elementType = j;
      }
      return joinArmTypes(armTypes);
    }
    // **どの行も定義でないブロックは、行が要素の列である**（list_model.md §3.1 の
    // 2次元配列のブロック記法）。定義を1つでも含めば構造体か match_case なので対象外。
    // 揃っているかの判定はカンマと同じ——均質なら `List`、そうでなければ `Struct`。
    if (node.lines.length > 1 && node.lines.every((l) => !isDefineNode(l))) {
      const rowKeys = node.lines.map((l) => slotShapeKey(l, node.scope || env));
      const rowDecided = (k) => k && !k.includes("?") && k !== "Unit" && k !== "null" && k !== "undefined";
      if (rowKeys.every((k) => k === rowKeys[0] && rowDecided(k))) {
        const rowType = inferAtomType(node.lines[0], node.scope || env);
        const innerEl = node.lines[0].elementType;
        node.elementType = rowType === "List" && innerEl ? `List(${innerEl})` : rowType;
        return "List";
      }
      node.slotKind = "positional";
      return "Struct";
    }
    const last = node.lines[node.lines.length - 1];
    // pass2 が残した子スコープで最終行を解決する。外側のenvで先に評価すると、
    // ブロック内で定義された識別子が解決できないまま**メモ化されてしまう**
    // （後から annotateTypes が正しいスコープで歩いても、もう上書きされない）。
    const lastType = inferAtomType(last, node.scope || env);
    // `[1 2 3]` のようにブロックが List を包んでいる場合、要素型もブロックへ引き継ぐ
    // （そうしないと `[1 2] [3 4]` のように List 同士を余積で繋いだとき、外側から
    // 中身の要素型が見えなくなる）。
    if (lastType === "List" || lastType === "Iterator") {
      node.elementType = last.elementType ?? null;
    }
    // 実体の種類はブロック越しに引き継ぐ（`[1 ~ 5]` の外側から中身が規則だと見えるように）。
    // **器の型なら何でも運ぶ**——`String` を落としていたので、文字列を組み立てる関数の
    // 返値が「場所」に見えていた。
    if (last.repr && (lastType === "List" || lastType === "Iterator" || lastType === "String")) {
      node.repr = last.repr;
    }
    return lastType;
  }

  if (node.type === "operation") {
    if (node.name === "product") {
      // **後置 `~` が付いていれば、相手のスロットを並べる**（余積との双対）。
      //
      // `a , b~` は「b のスロットを自分の並びへ広げる」であり、スロットを1つ足す形とは
      // 違う。したがって結果は「a と b の要素が並んだ列」——b の型がそのまま結果の型に
      // なる（b は既にその並びだからである）。
      //
      // これが無いと、値は平坦なのに型が `Struct` のままで食い違う。lexer.sn の
      // `(s ' 0) , (tokens …)~` がまさにそれで、値は平坦なトークン列なのに型が段の深い
      // `Struct` になり、大きさが静的に決まらないと言われていた。
      if (isSpreadNode(node.right)) {
        // **積と余積は、二項演算のようでいて制御である。** だから左辺の型に合わせては
        // ならない——中身が同型なら配列、同型でなければ添え字が数字になる構造体である。
        //
        // 左辺だけを見ていた頃、lexer.sn の `tokens` が壊れていた。記号1文字を積む枝
        // `(s ' 0) , (tokens (s ' 1~))~` は左辺が `Char` なので `List(Char)` になり、
        // 同じ関数の `(take_while …) , …~` の枝は `List(String)` になる。**型は通るのに
        // 中身が違う**——1要素 1 byte として場所を測るので、`{ptr, len}` のトークンには
        // 到底足りなかった。`String ≅ List(Char)`（原理7）なので join は `String` である。
        //
        // ただし**相手の型をそのまま返してはいけない**。`f` の返値が `a , (f …)~` なら
        // `T = T` になり、どの型も不動点なので何も分からない。だから
        // **既に注釈されている要素型だけを読む**——推論を強制すると自分へ戻る。1周目は
        // 左辺だけで決まり、相手が決まった次の周で join が効く（Pass 3 は不動点で回る）。
        const el = inferAtomType(node.left, env);
        if (el && el !== "Unit") {
          // 相手の要素型は**束縛表から来る**（適用ノードは呼び先の `returnsElementType` を
          // 読む）ので、推論を走らせても自分へは戻らない。周回ごとに注釈は消されるため、
          // 走らせないと同じ周の中では読めない——枝1（適用そのもの）が上がっても枝4
          // （積）が `Char` のまま取り残されていたのはこれである。
          const known = elementTypeOfNode(node.right.operand ?? node.right, env);
          const j = known && known !== el ? joinElementTypes(el, known) : el;
          // join できない＝中身が同型でない。そのときは下の Struct（連番スロット）へ
          // 落ちる——「添え字が数字になる構造体」がまさにそれである。
          if (j !== NO_JOIN) {
            node.elementType = j || el;
            return "List";
          }
        }
      }
      // カンマ（直積）は常に Struct（type_system.md §2）。名前付きスロットも
      // 連番スロットも同じ「固定オフセットで並ぶ連続ブロック」である。
      // ただし**関心事が違う**ので slotKind で区別する——カンマは名前を持たないため
      // 順序が意味そのものであり、宣言順がそのまま物理配置になる。名前ソートの
      // 正規順（stack_abi.md §7.1）は名前付きスロットにのみ適用される規則である。
      // **均質なら List である。** カンマは「次元を上げる」演算子だが、上げた結果が
      // 多相であるとは限らない——`1 2 , 3 4` は行が全部同じ形なので `base + i × stride`
      // が書ける。次元を上げることと多相な入れ物を作ることは別の操作であり、両方を
      // 無条件に `Struct` へ落とすと §2 が定めた基準（1つの命令テンプレートで済むか）と
      // 型が食い違う。
      //
      // 揃っているかは**幅**で見る。型だけでは足りない——`1 2 , 3 4 5` はスロットの型が
      // どちらも `List(Int)` なのに幅が 16 と 24 で違う。
      const slots = positionalSlots(node);
      const keys = slots.map((x) => slotShapeKey(x, env));
      // **`Unit` は証拠ではない。** 不動点の初回は返値がまだ束の底（`Unit`）なので、
      // どの直積もスロットが揃って見えてしまう——そこで `List` が確定すると、直和は
      // 単調にしか増えないので二度と抜けられない（`List | Struct` が自分自身を養う）。
      // 種を答えとして数えない、というのはここでも同じである。
      const decided = (k) => k && !k.includes("?") && k !== "Unit" && k !== "null" && k !== "undefined";
      const uniform = keys.length > 1 && keys.every((k) => k === keys[0] && decided(k));
      if (uniform) {
        // 要素型は入れ子ごと運ぶ。`List` とだけ書くと、行が何の列なのかが落ちる
        // ——`List(List(Int))` の内側が要らないなら、そもそも要素型を書く意味が無い。
        // **撒いているスロットからは要素型を取る。** 置かれるのは中身なので、器の型を
        // そのまま要素型にすると1段深くなる（`List(Char)` を要素だと言ってしまう）。
        const head = isSpreadNode(slots[0]) ? slots[0].operand : slots[0];
        const slotType = isSpreadNode(slots[0])
          ? containerElementType(head, env) ?? elementTypeOf(head, env)
          : inferAtomType(head, env);
        const inner = isSpreadNode(slots[0]) ? null : head.elementType;
        node.elementType = slotType === "List" && inner ? `List(${inner})` : slotType;
        node.slotKind = undefined;
        return "List";
      }
      // **`Char` と `String` が並ぶ器は `List(String)` である。** 1文字は長さ1の文字列で
      // あり（原理7——`String ≅ List(Char)`）、型の上では `Char ∨ String = String` が
      // 既に成り立っている。ここを形の鍵の一致だけで見ていたので、**トークン列**
      // （`[`10` , `+` , `2`]`）のように長さの違う語が並ぶだけで `Struct` に落ちていた。
      //
      // 要素はどれも `{ptr, len}` で運ばれる。1文字のリテラルもそう置けばよいので、
      // 実行時の持ち上げは要らない——払うのは**書いた側**（`.rodata` の置き方）である。
      if (keys.length > 1 && keys.every((k) => k === "Char" || k === "String")) {
        node.elementType = "String";
        node.slotKind = undefined;
        return "List";
      }
      node.slotKind = "positional";
      return "Struct";
    }
    if (node.name === "define") {
      // 定義の値は「束縛される値そのもの」（interpreter.jsのdefineも右辺の値を返す）。
      // 以前は無条件に "Struct"（旧 Dict）を返していたが、それは `[foo : 1]` のような
      // 構造体リテラルの単一エントリを想定した規則であり、トップレベルの定義行
      // （`f : x ? x + 1`）まで誤判定していた。リテラルの判定は上のblock分岐が担う。
      return inferAtomType(node.right, env);
    }
    if (node.name === "lambda") {
      // Layer 2 は「Atom の内部分類」（§2）であり、Lambda は Layer 1 のカテゴリ。
      // Atom内部型は持たないので null を返す（未解決ではなく「該当なし」）。
      return null;
    }
    if (LIST_BUILDING_OPS.has(node.name)) {
      // **作られた器は場所ではなく規則である。**
      //
      // `\`abc\`` は `.rodata` に在る場所、`s ' 1~` は既存の場所を指し直したもの。どちらも
      // `{ptr, len}` で運べる。しかし `c rest` のように**組み立てられた**器には、置く場所が
      // どこにも無い——`alloca` は自分のフレームなので返せず、`layer: 0` には確保の手段が
      // 無い（memory_management.md §2）。
      //
      // 返すのは「残りをどう作るか」という規則であり、その実体は部分適用と同じ
      // `{fn, captured…}` である（stack_abi.md §4.3）。**大きさが静的に決まる**ので
      // 呼び出し側が確保できる——作られた文字列の長さは静的に決まらないが、その規則の
      // 大きさは決まる。sret の「スロットの大きさ」が答えられなかったのは、返すものを
      // 取り違えていたからである。
      //
      // 型は「何ができるか」しか語らないので、「どう置かれているか」はここに印として残す
      // （レンジが `repr = "rule"` を置くのと同じ場所・同じ理由）。アフィンな規則とは
      // 実体の形が違う（`{start, step, end}` ではない）ので別の名前にする。
      node.repr = "closure";
      // 余積族（§3.2の族別テーブル）: 左辺がStringならテキスト連結でString、
      // それ以外はList構築。以前は無条件に"List"を返していたが、interpreter.jsの
      // concatは左辺がstringならテキスト連結する（`ab` 1 → "ab1"）ため食い違っていた。
      const leftType = inferAtomType(node.left, env);
      const rightType = inferAtomType(node.right, env);
      // §3.2の余積族テーブル: どちらかがStringならテキスト連結でString。
      // Stringは余積の**吸収元**として振る舞う——あらゆる値がテキスト表現を持つため、
      // String との join は常に存在する（「レンダリングする」という全域の操作がある）。
      // 左辺だけを見ると `` `ab` 1 `` → "ab1" なのに `1 `ab`` はエラー、という
      // 引数の順序で挙動が変わる非対称が生じてしまう。
      // 構造体のマージ（§5.3）。文字列吸収より先に見る——両辺が構造体である以上、
      // テキスト連結の話にはならない。
      if (leftType === "Struct" && rightType === "Struct") {
        const merged = mergedStructSlots(node, env);
        if (merged) {
          node.slotKind = "named";
          node.mergedSlots = merged;
          return "Struct";
        }
      }
      // §3.2の余積族テーブル。**`Char` も文字の並びを作る**——`String ≅ List(Char)` で
      // あり、文字を並べれば文字列だからである。1文字どうしを並べれば2文字になり、
      // それは `Char` ではなく `String` である（潰れるのは1要素のときだけ）。
      if (leftType === "String" || rightType === "String" || leftType === "Char" || rightType === "Char") {
        node.elementType = "Char";
        return "String";
      }
      // §3.2の余積族テーブル / §6.1: 余積の単位元。片側がUnitなら他方を素通しする
      // （`__ x = x`、`x __ = x`）。Unitは要素型の join には参加しない——
      // 「無い」ものと型が合わないという判定は成立しないため。
      if (leftType === "Unit") {
        node.elementType = node.right.elementType ?? null;
        return rightType;
      }
      if (rightType === "Unit") {
        node.elementType = node.left.elementType ?? null;
        return leftType;
      }
      // **`unshift`/`push` は片方が「要素」である**（器へ1個足す）。`construct`/`concat` の
      // ように両側を器として扱うと、要素そのものの型を器の要素型と突き合わせてしまい、
      // `m [5 6]`（2次元へ行を1つ足す）が「Struct と Int の join が無い」で落ちる。
      //
      // 器が `Struct` なら、足すのは**スロット**である。スロットごとに型が違ってよいのが
      // 直積の意味なので（§2）、要素型の join は要らず結果も `Struct` のままである。
      if (node.name === "unshift" || node.name === "push") {
        const isUnshift = node.name === "unshift";
        const containerNode = isUnshift ? node.left : node.right;
        const elementNode = isUnshift ? node.right : node.left;
        const containerType = isUnshift ? leftType : rightType;
        if (containerType === "Struct") {
          // **名前付きスロットには、名前の無いものを足せない。** 名前で引くのが名前付き
          // スロットの意味なので、付ける名前が無いものはスロットになりようがない。
          // 足せないからといって不正なのではなく、そのとき余積は**次元の中を伸ばす**
          // ——構造体が2つ並んだ列（`List(Struct)`）になる。評価器は最初からそう動いて
          // いて、型だけが `Struct` と言い張っていた（`l : p p` の値は構造体2個の列）。
          //
          // 名前付き構造体同士を1つに畳むのは §5.3 のマージであり、それは**双方に後置
          // `~` を書いたときだけ**起きる。`~` の無い並びをマージと読んではいけない。
          if (slotKindOf(containerNode, env) === "named") {
            node.elementType = "Struct";
            return "List";
          }
          // 連番スロットなら足せる。順序が意味そのものなので、末尾に1つ増えるだけである
          // ——`m : 1 2 , 3 4` へ行を足す `m [5 6]` がこれ。
          node.slotKind = slotKindOf(containerNode, env) || "positional";
          return "Struct";
        }
        // **器の要素型は名前の先にある。** 識別子ノード自身は要素型を持たないので、
        // 束縛まで辿らないと検査が効かない——`m : 1 2` の後の `m [3 4]` が素通りして
        // いた。型は `List`（同一幅の連続領域）と言うのに中身は Int Int List で、
        // Pass 4 は `base + i × 8` を出して3番目で壊れる。型と値の食い違いである。
        const containerEl = containerElementType(containerNode, env) ?? elementTypeOf(containerNode, env);
        const joinedAppend = joinElementTypes(containerEl, inferAtomType(elementNode, env));
        // **揃っていないことは不正ではない。それは `Struct` である。**
        //
        // 以前ここはコンパイルエラーにして「混ぜたいならカンマで Struct にしろ」と
        // 誘導していた。その誘導は「カンマでしか Struct が作れない」という前提に
        // 立っており、カンマを「均質なら List」にした時点でその前提は消えた。幅が
        // 揃わない連続領域は、スロットごとに別命令で引くもの——つまり `Struct` である。
        if (joinedAppend === NO_JOIN) {
          node.slotKind = "positional";
          return "Struct";
        }
        return "List";
      }
      // §2「Listは同一型」: 要素型のjoinを取る。**join が無いのは不正ではなく Struct**
      // である（上の unshift/push と同じ理由）。幅が揃わない連続領域はスロットごとに
      // 別命令で引くもの——それが `Struct` の定義そのものである。
      // **「まだ分からない」に「分かっている」を潰させない。**
      //
      // 器を返す再帰（写像：`(s ' 0) (m (s ' 1~))~`）では、右の再帰呼び出しの要素型が
      // その周回ではまだ決まっていない。null と join すると全体が null になり、**片方が
      // 分かっているのに何も分からないと言う**ことになる——`joinArmTypes` が `Unit` を
      // 落とすのと同じ理由で、ここも未確定の側を数えない。
      //
      // 不動点で回るので、次の周回で右が決まれば改めて join される。食い違えば
      // `NO_JOIN` になって `Struct` へ落ちるので、取り違えたまま固まることはない。
      //
      // これが落ちていたため、列の写像は「並べるものの幅」が決まらず sret の計画が
      // 立たなかった。`String` は型名に要素が入っている（`≅ List(Char)`）ので偶然通り、
      // `List` だけが出せなかった。
      //
      // ただし**片側だけから族を名乗らない**。`Atom` や `Scalar` は「どれか分かって
      // いない」という下限であり、要素型に書いても素の `List` と情報量が変わらない
      // ——分かっている以上のことも、以下のことも言わないのが `.st` の原則である。
      const lel = elementTypeOf(node.left, env);
      const rel = elementTypeOf(node.right, env);
      const lone = lel ?? rel ?? null;
      const joined = lel == null || rel == null ? (lone && FAMILY_MEMBERS[lone] ? null : lone) : joinElementTypes(lel, rel);
      if (joined === NO_JOIN) {
        node.slotKind = "positional";
        return "Struct";
      }
      node.elementType = joined;
      return "List";
    }
    // apply の結果型は**呼び先の返値型**である（§7.1・§8）。Lambda 自身は Layer 1 の
    // カテゴリであり Layer 2 型を持たない（§2）が、射の**適用結果**は場所を持つ値なので
    // 型を持つ。したがって返値型は Layer 2 の型表へ足すのではなく、識別子テーブル側
    // （binding.returns）に置く。
    if (node.name === "apply") {
      const callee = applyCalleeBinding(node, env);
      if (!callee) return null;
      // 要素型と実体の種類も返値と一緒に運ぶ。器の型（`List`）だけでは Pass 4 が
      // 添字の命令を選べない——要素1個ぶんの幅と、ロードか算術かが要る。
      //
      // **上がれるようにする。** 以前は `!node.elementType` で最初に読めた値を凍結して
      // いたが、束は `__`（底）から始めて単調に上がる設計であり、相互再帰では初回に
      // 必ず低い値が入る。lexer.sn の `tokens` は1周目に `Char` で固まり、他の枝が
      // `String` だと分かっても二度と上がれなかった——**型は通るのに要素の幅が違う**。
      // join は単調で型の束は有限なので、これで止まる。
      if (callee.returnsElementType) {
        const j =
          node.elementType && node.elementType !== callee.returnsElementType
            ? joinElementTypes(node.elementType, callee.returnsElementType)
            : callee.returnsElementType;
        if (j && j !== NO_JOIN) node.elementType = j;
      }
      // **そのまま返される仮引数の要素型は、実引数が言う。** `(id [0 0]) ' 1` の要素型は
      // `id` の定義からは出ない——`ar` が何の器かは呼ぶ側にしか無いからである。ここが
      // 無いと、器を受け取ってそのまま返す関数の結果に添字が付けられなかった
      // （`get_prop` が「まだ出せない式です」で止まる）。
      //
      // 族（`Atom` / `Scalar`）は証拠の不在なので載せない（原理4）。
      if (callee.returnsParamAt && callee.returnsParamAt.length) {
        const { args } = applyChainOf(node);
        for (const i of callee.returnsParamAt) {
          const el = args[i] ? elementTypeOf(args[i], env) : null;
          if (!el || FAMILY_MEMBERS[el]) continue;
          const j = node.elementType && node.elementType !== el ? joinElementTypes(node.elementType, el) : el;
          if (j && j !== NO_JOIN) node.elementType = j;
        }
      }
      if (callee.returnsRepr && !node.repr) node.repr = callee.returnsRepr;
      if (callee.returnsRepr === "cursor") {
        node.repr = "cursor";
        // **捕まえた幅は決め打ちしない。** 分からないなら測る側（`measureCursor`）が
        // 組そのものを見て決める——器とは限らず、スカラーを捕まえるカーソルもある。
        if (callee.returnsCursorInner) node.cursorInner = callee.returnsCursorInner;
        node.cursorGroup = callee.returnsCursorGroup || null;
      }
      return callee.returns ?? null;
    }
    if (node.position === "infix" && node.left) {
      // 論理・圏論族の`&`（§4: `(L -> R) -> (R | __)`）だけは右辺の型を返す。
      // 左辺は短絡（Unitなら全体がUnit）を決めるだけで、値として返るのは右辺。
      if (node.name === "and") return inferAtomType(node.right, env);
      // **`|` は左辺が短絡しうるときだけ直和になる。** `|` は左辺が非Unitならそれを返す
      // ので、左辺が静的に非Unitなら結果は左辺そのものであり、型も左辺の型でよい
      // （`1 | \`abc\`` は `Int`）。
      //
      // だが左辺が `&` なら話が違う——§4 のシグネチャは `(L -> R) -> (R | __)` であり、
      // **`&` は Unit を返しうる**と自分で言っている。`cond & 結果 | 既定` はまさにその形
      // なので、右辺も返りうる。ここを左辺型で通していたため、末尾の自己再帰が丸ごと片腕に
      // なっている形（`xs & go acc xs | !xs & 結果`）で全体が `Unit` に落ちていた——再帰の
      // 返値はまだ決まっていないからである。直和にすれば `joinArmTypes` が `Unit` を落とし、
      // 基底の腕が型を決める。ブロック形の match（`isFunctionBody`）が §7.3 で既にそう
      // 畳んでいるので、インライン形もこれで揃う。
      if (node.name === "or") {
        const lt = inferAtomType(node.left, env);
        const leftShortCircuits = lt === "Unit" || (node.left.type === "operation" && node.left.name === "and");
        if (leftShortCircuits) return joinArmTypes([lt, inferAtomType(node.right, env)]);
        return lt;
      }
      // 範囲族は左辺優先ルール（§3.2）の対象外——結果は端点の型ではなく列である。
      // 以前は `return leftType` へ落ちており、`1 ~ 5` の型が値（[1,2,3,4,5]）と
      // 食い違って Address になっていた。
      if (node.name === "range" || RANGE_STEP_OPS.has(node.name)) return rangeResultType(node, env);
      // `'`（添字・フィールドアクセス）は器の型ではなく**取り出したものの型**を返す。
      if (node.name === "get_prop") return getPropResultType(node, env);
      const leftType = inferAtomType(node.left, env);
      if (ARITHMETIC_OPS.has(node.name)) return arithmeticResultType(node, leftType, env);
      return leftType; // 左辺が規則を選ぶ（§3.2）。比較・構造比較族は左辺の型が結果型
    }
    if (node.operand) {
      // 前置 `~`（`continuous`、§4）は**持ち上げ**である。`$`/`@` が単体値に対する
      // 持ち上げ／持ち下げであるのと同じ段で、前置 `~`／後置 `~` が列に対するそれを担う。
      //
      //   単体値   $ が持ち上げ（値 → Address）      @ が持ち下げ
      //   列       前置 ~ が持ち上げ（→ Implicit）   後置 ~ が持ち下げ（展開）
      //
      // 行き先は `Implicit(T)`——「暗黙のアドレス（場所）」であり、`$` が返す
      // 「値としての Address」とは別物である（§2 の Layer 2 表）。§4 は
      // `List -> Implicit(List)` しか定めていないが、スカラーを持ち上げた場合も
      // 同じ段の操作なので `Implicit(T)` になる。要素型は elementType に載せる
      // （`List(T)` と同じ機構）。
      // 前置 `$`（アドレス取得）は §4 の通り常に `Atom(Address)` を返す。凍結対象が
      // 関数であろうとデータへのパスであろうと、`$` 自身は「その式が指す場所のアドレスを
      // 取る」だけで場合分けを必要としない（§2 の非対称性）。オペランドの型を素通しすると、
      // 関数を指したとき（Lambda は Layer 2 型を持たない）に `_` になってしまい、
      // 「アドレスという値を持っている」ことすら型に出なかった。
      // **アドレスは指す先を覚える。**
      //
      // `Address` だけでは `@c` の型が決まらない——C の `int*` と `cell*` の区別が無い
      // 状態である。`$` は何を指したのかを知っているので、そこで書き留める。`List(T)` の
      // 要素型（`elementType`）と同じ機構であり、型は「ゼロコストの帳簿」なので、
      // 指す先を1つ足しても命令は1つも増えない。
      if (node.position === "prefix" && node.name === "address") {
        const p = inferAtomType(node.operand, env);
        if (p && p !== "Unit") {
          node.pointee = p;
          const el = node.operand && node.operand.elementType;
          if (el) node.pointeeElement = el;
          // **形は型ではなくノードにしかない。** `Struct` はスロットごとに型が違ってよいので、
          // 「何番目が何バイト目か」は式そのものを見ないと出ない（`layoutOfStruct`）。
          // `binding.returnsNode` を残しているのと同じ理由である。
          // 括弧は剥ぐ。測るのは中身であって、包みではない（包んだまま測ると
          // 「16 バイトの要素が1つ」に見え、スロットの並びが出ない）。
          let pn = node.operand;
          while (pn && Array.isArray(pn.lines) && pn.lines.length === 1) pn = pn.lines[0];
          node.pointeeNode = pn;
        }
        return "Address";
      }
      // **`@` は指す先を読む。** 何を指しているか分かっているなら、その型である。
      // 分からなければ従来通りオペランドの型を素通しする（下の既定へ落ちる）。
      if (node.position === "prefix" && node.name === "input" && !node.inGetPropKey) {
        // **`@` の相手は番地である。** 相手が `Raw`（値は在るが型が無い）なら、外側の
        // `@` が「これを番地として使う」と言っている——**要求が型を決める**。
        //
        // `@@p` がこの形である。前置は右結合なので `@(@p)` と切れ、内側の `@p` は
        // 指す先が分からないので `Raw`。それを外側が読むと言った時点で `Address` に
        // 決まり、外側の結果はまた `Raw` になる（その先も分からないので）。
        if (node.operand && inferAtomType(node.operand, env) === "Raw") node.operand.atomType = "Address";
        const p = pointeeOfNode(node.operand, env);
        // **指す先が分からないなら `Raw` である。** 以前はオペランドの型を素通ししており、
        // `@0x40200000` が `Address` を名乗っていた——読んだのが 65（`\`A\``）でも
        // 「これは番地だ」と言うことになる。**分かっていないことを分かったと書かない**
        // （原理4）。値は在るので `__` でもない。
        if (!p) return "Raw";
        if (p) {
          if (p.element) node.elementType = p.element;
          // 形も刻む。**1語より広い指す先は読むのではなく指したまま引く**ので、
          // Pass 4 はスロットの並びを知る必要がある。
          if (p.node) node.pointeeNode = p.node;
          return p.type;
        }
      }
      // **前置 `~` が作るのは長さ1の器（`List`）であって「場所」ではない。**
      //
      // 以前はここが `Implicit(T)`（暗黙の番地＝場所）を返していた。その名前は「番地を
      // 型として名指す」ことに意味があった頃のものだが、**番地は表に出さないと決めた**
      // ——`$` が作った番地は算術に使えず、読むなら `@`、列を辿るなら `[h ~t]` の分解で
      // 語る。観測できないものを名指す型には仕事が残っていない。観測できる姿は「長さ1の
      // 器」だけであり、それは `List` である（`~x ≅ [x]`）。
      //
      // 実害も出ていた。`Implicit` は要素型が1段ずれるので `~5 ' 0` が要素の 5 ではなく
      // 器そのものを返し、`||~[1 2 3]||` は型が 1・値が 3 と食い違っていた。
      //
      // **器なら恒等、スカラーなら持ち上げ。** `~` は η（持ち上げ）であり、`[x] ≅ x` の
      // 潰れが効くので器に当てても何も増えない（冪等：`~~5` は `~5`）。スカラーのときだけ
      // 表現が変わる——型では無償、表現では有償（原理8）。
      if (node.position === "prefix" && node.name === "continuous") {
        const inner = inferAtomType(node.operand, env);
        if (CONTAINER_TYPES.has(inner)) {
          // 要素型は束縛の側に在ることがある（`l : [1 2 3]` の `~l`）ので、ノードの
          // フィールドを覗くだけでは落ちる。
          node.elementType = containerElementType(node.operand, env) || node.operand.elementType || null;
          return inner;
        }
        node.elementType = inner;
        return "List";
      }
      // **否定は真偽を反転する。** `!__` は恒等射（真）である。
      //
      // 恒等射は `__` と別物ではない——`__` は単位元なので単位律 `x ⊗ __ ≅ x` が成り立ち、
      // **`__` の積関手はそのまま恒等関手**である。`!__` はその自然同型の成分であって、
      // `__` から随伴で導かれる（unit.md §368 の外延性による証明も同じ結論に至る）。
      // したがって新しい型を足す話ではなく、**単位元の射としての顔**に名前を与えるだけである。
      //
      // `Unit`（偽）と書くのは意味が逆なので、Layer 1 の印 `IDENTITY` を返す。`.st` は
      // これを `_` と書く——裸の `_` は Sign 自身の恒等射記法であり（unit.md §378）、
      // 「まだ埋まっていないスロット」と同じ概念だからである。
      if (node.position === "prefix" && node.name === "not") {
        const t = inferAtomType(node.operand, env);
        if (t === "Unit") return IDENTITY;
        return t ? "Unit" : null;
      }
      // それ以外の前置/後置演算子は§4に個別の型シグネチャがあるが、今回は簡略化して
      // オペランドの型をそのまま通す（要精査、既知の制限）。
      return inferAtomType(node.operand, env);
    }
    return null;
  }

  return null;
}

// ---- 仮引数のatomType自動導出（type_system.md §7.1） ----
//
// `f : x y ? x + y` の x/y のように、仮引数自身は `<id> : expr` という定義行を持たないため
// pass1.js の buildEnvScope（リテラルからの静的読み取り）では atomType を解決できない。
// §7.1 はこれを「本体の演算子使用箇所から逆算する」——`x + y` の `x` は `+` の左辺、
// `y` は右辺なので、どちらも `+` のシグネチャ（§4: `(L(Scalar) -> R(Scalar)) -> L`）が
// 要求する `Scalar` だと仮定できる、としている。
//
// 【制限】算術演算子（+ - * / % ^）・比較演算子（< <= = >= > !=、§4）による使用箇所のみを
// 見る。HM流の単一化はせず、最初に見つかった制約を採用する（Pass 1a が前提とする
// 「線形スキャンで完結する」という設計方針に合わせた、早い者勝ちの単純な走査）。
// `'`（get_prop）等、他の演算子からの逆算は未対応（要拡張）。
//
// 比較演算子は symbol（node.op）で判定する。`!=`（§4の比較演算子、precedence 12、
// name="not_equal"）と`!==`（構造比較、precedence 8、name="xnot_equal"、8/6に
// operator_table.jsを改名して名前衝突は解消済み）は記号で区別する。`==`/`===`/`!==`は
// Scalarに限定されない構造比較（type_system.md §4 NOTE: 「リストや構造体の比較には
// ==を使用」）なので対象外。

const SCALAR_ARITHMETIC_OPS = ARITHMETIC_OPS;
const SCALAR_COMPARISON_OP_SYMBOLS = new Set(["<", "<=", "=", ">=", ">", "!="]);

// 演算の相手が「型の制約として意味を持つリテラル」なら、その型を返す。
// リテラルでなければ null（演算子が要求する族までしか言えない）。
//
// `Unit` は除く。`__` は零射であって型ではないので、`a + __` は `a` について何も語らない
// ——むしろ結果が `__` に収束することを意味する（§3.3 の吸収則）。
function constraintFromLiteral(node) {
  if (!node || node.type !== "atom") return null;
  const t = literalAtomTypeFromKind(node);
  return t === "Unit" ? null : t;
}

/**
 * ポイントフリーの演算子ブロック（`[+ 1]` / `[+]`）のシグネチャを求める。
 *
 * `operator_table.md` の基本原則が「持ち上げる／持ち下げる演算子の関係性が包括的に型を
 * 決定する」と言う通り、**演算子表はそれ自体が型の表**である。`[+ 1]` は「`+` の左辺が
 * まだ来ていない」形なので、シグネチャは `+` のシグネチャから穴の数を数えるだけで出る
 * ——型変数も制約ソルビングも要らない（§1）。
 *
 * 規則は `f : x ? x + 1` を逆算するのと同一である。相手がリテラルならその型まで決まり
 * （`[+ 1]` は `Int -> Int`）、両方とも空なら演算子が要求する族までしか言えない
 * （`[+]` は `Scalar Scalar -> Scalar`）。同じ結論を2通りの書き方から得ているのであって、
 * ポイントフリーのために別の規則を足しているわけではない。
 */
// ブロックのまま（`[+ 1]`）でも、1文の括弧を剥がした後の演算子ノードのままでも受ける。
function pointfreeOp(node) {
	if (!node || typeof node !== "object") return null;
	if (node.type === "operation" && node.partial) return node;
	if (node.type !== "block") return null;
	if (!Array.isArray(node.lines) || node.lines.length !== 1) return null;
	const op = node.lines[0];
	if (!op || op.type !== "operation" || !op.partial) return null;
	return op;
}

function pointfreeSignature(node) {
	const op = pointfreeOp(node);
	if (!op) return null;
	// 族が `Scalar` に定まる演算子だけを扱う。構造比較（`==` / `!==`）はリストや構造体にも
	// 効くので族が決まらず、ここでは何も名乗らない（§4 NOTE）。
	const isScalarOp = SCALAR_ARITHMETIC_OPS.has(op.name) || SCALAR_COMPARISON_OP_SYMBOLS.has(op.op);
	if (!isScalarOp) return null;
	// 埋まっている側がリテラルなら、その型が穴の型でもある——比較も算術も同種同士でしか
	// 成立しないためである。両方空なら演算子が要求する族までしか言えない。
	const filled = op.left || op.right || null;
	const slot = (filled && constraintFromLiteral(filled)) || "Scalar";
	const holes = (op.left ? 0 : 1) + (op.right ? 0 : 1);
	if (holes === 0) return null;
	return { params: new Array(holes).fill(slot), ret: slot };
}


// 比較・算術の相手が「型の分かっている識別子」なら、その型を制約として使う。
// 仮引数自身（まだ型が決まっていない）と、型が読めないものは対象にしない。
function typeOfKnownOperand(node, scope, paramNames) {
  if (!scope || !node) return null;
  // 仮引数そのものは「相手」にならない（互いを根拠にしても何も決まらない）。
  if (isIdentifierNode(node) && paramNames.has(node.value)) return null;
  // **相手はリテラルや識別子とは限らない。** §3.2 が「域を選ぶのは左辺」と定める通り、
  // 左辺が式であってもその型が域を決める——`0.0 + x + y` は `(0.0 + x) + y` に切れるので、
  // `y` の相手は `Float` と分かっている式である。ここを識別子に限っていたせいで、
  // 型注釈の書き方（`0.0 +`）が**2項目以降へ伝わらなかった**。
  //
  // 式の型は既に解けているものだけを読む（未解決なら null のまま）。
  if (!isIdentifierNode(node) && !(node.type === "operation" && node.position === "infix")) return null;
  const t = inferAtomType(node, scope);
  // 族は証拠ではないので相手の根拠にしない。
  return t && t !== "Unit" && !FAMILY_MEMBERS[t] ? t : null;
}

// 族（まだ具体型が決まっていない下限）とその成員（§4 の記法定義）。
//
// **`Atom` は Layer 1 の語である。** §2 が Layer 2 を「Atom 内部型」と呼んでいる通り、
// `Atom` は「射ではないもの＝値」を指す。したがって `List` も `Struct` も `Atom` である
// ——値だからである。`Scalar` はその中の「レジスタに乗る数値」だけを指す族であり、
// `String` はどちらでもない独立した Layer 2 型である（`Scalar` ではない）。
//
// 以前ここは §4 の記法をそのまま写して `Atom` を `Scalar | String` としていた。その定義は
// 循環している上に噛み合っておらず（String が `Scalar` でないなら、String を含む `Atom`
// はスカラーではありえない）、実害もあった——仮引数の既定は「証拠が無くても `Atom`」
// なので、そこへ `Struct` や `List` が渡ると**型が値より狭くなる**。狭めた定義のままでは
// それを表現することも検出することもできなかった。
// 「器である」とだけ分かっている型。ここへスカラーが合流したら、それは中身である。
const CONTAINER_FAMILY = new Set(["Container", "List", "Iterator"]);
// 器の中に1つとして並びうるスカラー。`String` の要素は `Char` だと型が既に言っている
// ので、そこは対象にしない（合流の余地が無い）。
const SCALAR_ELEMENTS = new Set(["Int", "Char", "Address", "Float", "Vector"]);

const FAMILY_MEMBERS = {
  // **`Char` も算術の対象である。** かつてここに入れていなかったのは「文字は算術の
  // 対象ではない」と考えていたからだが、文字の算術は符号位置の算術として成立する
  // （`c + 1` で次の文字）。除外の理由の方が消えたので、成員に戻す。
  //
  // ただし**昇格格子には乗らない**（`NUMERIC_TYPES` に入れていない）。文字は数の一種
  // ではないので、`Char + Float` は Float にはならない——足せるのは文字と整数だけで、
  // 結果は文字である（`arithmeticResultType`）。族の成員であることと、格子を昇るのは
  // 別の話である。
  Scalar: new Set(["Int", "Address", "Float", "Vector", "Char"]),
  // **器だとは分かるが、どの器かはまだ分からない。** 仮引数を添字・スライス・撒きする
  // 書き方は「これは器である」としか言っていない——`s ' 0` は `String` でも `List` でも
  // 書けるので、そこから具体型を決めると当て推量になる（原理4）。呼び出しサイトが
  // 実引数を見せた時点で成員のどれかへ狭まる。族は「分かっていない」の言い換えであり、
  // 束を下る（狭める）だけなので順序に依存しない。
  Container: new Set(["String", "List", "Struct", "Iterator", "Implicit"]),
  // `Char` は値なので `Atom` の成員である。`Scalar` には入れない——算術の対象では
  // ないからである（§3.2 が String を算術から外しているのと同じ理由）。
  Atom: new Set(["Int", "Address", "Float", "Vector", "Scalar", "Container", "Char", "String", "List", "Struct", "Iterator", "Implicit"]),
};

/**
 * 仮引数の型の合流。**スカラーは1要素の器である**（`[5] ≅ 5`）ので、器と混ざったら器へ
 * 持ち上げる——`Int` と `List` は別の型ではなく、同じものの別の段（`C` と `C×C`）である。
 *
 * 族は「まだ分かっていない」の言い換えなので、具体型が来たら譲る。どちらも器・どちらも
 * スカラーで食い違う場合は決めない（本当に複数の型で呼ばれている）。
 */
function joinParamType(cur, next) {
  if (!next) return cur;
  if (!cur || FAMILY_MEMBERS[cur]) return next;
  if (cur === next) return cur;
  // **直和に器が混じっていれば器である。** `next_st` の返値は `List | Int`——枝によって
  // 段が違うだけで、器になりうる。ここを文字列の一致で見ていたため `"List | Int"` が
  // 器と読めず、`walk` の `st` が「決められない（null）」に落ちていた。器の側で運べば
  // どちらの枝も通る（スカラーは長さ1の器）ので、広い方へ寄せるのが正しい。
  // `returnSizeBound` は既に同じ判定をしている——**そちらだけが直和を読めていた**。
  // **持ち上がる先は均質な器だけである。** 根拠は `Scalar ⇒ [Scalar, __]`、つまり
  // 「長さ1の器はその要素と同型」（原理8）であり、これが言えるのは**要素が並ぶ**器
  // ——`List` / `String` / `Iterator` / `Implicit`——に限る。
  //
  // **`Struct` はここに入らない。** 積はスロット配置が型の側にあり、`[x] ≅ x` が成り
  // 立たない——Char は「同じ形の Struct」ではない。にもかかわらず入れていたため、
  // parser.sn の `mul_go` の `acc` が Char（`mul_lv` から来る葉）と Struct（再帰から
  // 来る枝）の両方で呼ばれているのに `Struct` へ潰れていた。どちらも1レジスタなので
  // 幅の検査も通り、**Char の値がポインタとして参照される**ところだった。
  //
  // 葉と枝が別の形をしているのは本当なので、決めない方が正しい（原理4）。
  const box = (t) =>
    String(t || "")
      .split(" | ")
      .some((x) => ["String", "List", "Iterator", "Implicit"].includes(x.trim()));
  // **持ち上げのときだけ合流する。** スカラーは1要素の器なので器へ上げられるが、
  // スカラー同士・器同士で食い違うなら本当に複数の型で呼ばれている——決めない。
  if (box(cur) && !box(next)) return cur;
  if (box(next) && !box(cur)) return next;
  return null;
}

function inferParamTypesFromUsage(bodyNode, paramNames, scope, bareNames = null, elemsOut = null) {
  const inferred = new Map();

  /**
   * 仮引数の型を記録する。**先に書いた方が勝つのではなく、具体的な方が勝つ。**
   *
   * 使用箇所は複数あり、証拠の強さが違う。`col > n` は「col は数である」としか言わない
   * （相手も仮引数なので）が、`col + 1` は「col は Int である」と言う。先勝ちにすると
   * 本体の**書いた順**で型が変わってしまい、`try_col : col row n [~board] ?` の `col` が
   * `Scalar` に留まっていた——`col > n` が `col + 1` より前の行にあるという、それだけの
   * 理由で。Pass 4 は `Scalar` では命令を選べない（GPR か FPU かも幅も決まらない）ので、
   * ここで落ちる差は最後まで響く。
   *
   * 族（`Atom` / `Scalar`）は証拠ではなく**証拠の不在**なので、具体型が来たら譲る。
   * 逆に具体型が既にあるところへ族が来ても何も起きない。束を単調に下る（狭める）だけで
   * あり、順序に依存しない——これが不動点の前提でもある。
   */
  const refine = (name, type) => {
    if (!type) return;
    const prev = inferred.get(name);
    if (prev === undefined) {
      inferred.set(name, type);
      return;
    }
    if (prev === type) return;
    // **族の中でだけ狭める。** `Scalar` に対する `Int` は「どの数か分かった」だが、
    // `Scalar` に対する `List` は絞り込みではなく食い違いである——`List` は `Scalar` の
    // 成員ではない。
    //
    // これは実際に踏んだ差である。`first_row : col n ?` の `col` は数（`col > n`、
    // `col + 1`）だが、`place 2 n col` では盤（`List`）を要求するスロットへ渡る
    // ——スカラーが1要素リストと同型だからそう書ける。両方とも真だが、`col` 自身の型は
    // 数である。族の外から来た型で上書きすると、同型で通しただけの位置が型を乗っ取る。
    //
    // 食い違いはここでは断じない。本当の不一致を見るのは演算子ごとの検査の仕事である
    // （原理4）。
    const members = FAMILY_MEMBERS[prev];
    if ((members && members.has(type)) || memberOfListFamily(prev, type)) {
      inferred.set(name, type);
      return;
    }
    // **器にスカラーが合流したら、それは要素である**（`Scalar ⇒ [Scalar, __]`、
    // value_representation.md §5.10）。型は器のまま——どの器かは分からない——だが、
    // **1個が何であるかは分かる**ので、そこを落とさずに残す。
    //
    // これが無いと `preprocess.sn` の `pop : [~st] ? st ' 1~` が出せない。スタックの底は
    // `bottom : 0` というスカラーなので、呼び出しサイトは `Int` を持ってくるのに
    // `FAMILY_MEMBERS.Container` に `Int` が居ないので黙って捨てられ、**要素の幅が
    // 決まらないから切り出せない**、という所まで落ちていた。
    if (elemsOut && CONTAINER_FAMILY.has(prev) && SCALAR_ELEMENTS.has(type) && !elemsOut.has(name)) {
      elemsOut.set(name, type);
    }
  };

  function visit(node) {
    if (!node || typeof node !== "object") return;

    const isScalarOp =
      node.type === "operation" &&
      node.position === "infix" &&
      (SCALAR_ARITHMETIC_OPS.has(node.name) || SCALAR_COMPARISON_OP_SYMBOLS.has(node.op));

    if (isScalarOp) {
      for (const [side, other] of [
        [node.left, node.right],
        [node.right, node.left],
      ]) {
        if (
          side &&
          side.type === "atom" &&
          side.kind === "identifier" &&
          paramNames.has(side.value) &&
          true
        ) {
          // 相手がリテラルなら**その型がこの仮引数の型を決める**。相手が分からなければ
          // 演算子が要求する族（`Scalar`）までしか言えない。
          //
          // これは「恒等演算を型注釈として使う」書き方を成立させるための規則である。
          // Sign には型注釈の構文が無いので（§1「型はコードの影」）、初期化時に型を
          // 決めたいときは値を変えない演算を書く。
          //
          //   x : @p + 0      Address として読む
          //   x : @p + 0.0    Float として読む
          //   x : @p          型を決める情報が無い
          //
          // `+ 0` は値を変えないので実行時コストは無い（コンパイル時に消える）が、
          // 型は固定される。注釈構文を足さずに「キャスト情報がある場合と無い場合」を
          // 書き分けられる。比較でも同じで、`t = \`===\`` の `t` は String になる
          // ——比較は同種同士でしか成立しないため、相手の型がそのまま制約になる。
          // 相手が**型の分かっている識別子**でも同じことが言える。`c = tab` の `tab` が
          // 文字定数として定義されているなら、比較が同種同士でしか成立しない以上 `c` も
          // 文字である。定数へ切り出した書き方（`tab : \t` と置いてから比べる）が、
          // リテラルを直接書いた場合より弱い型になってしまうのを防ぐ。
          const fromOther = constraintFromLiteral(other) || typeOfKnownOperand(other, scope, paramNames);
          refine(side.value, fromOther || "Scalar");
        }
      }
    }

    // **仮引数を添字・スライス・撒きしたら、それは器である。** `@p` から `Address` を
    // 読むのと同じ推論で、演算子が被演算子に要求するものを書き写している——`s ' 0` も
    // `st~` も、器でなければ書けない。
    //
    // ここが無かったために、スタックの API 全体（`top` / `pop` / `push`）の仮引数が
    // `Int` になっていた。初期値が `bottom : 0` というスカラーで、呼び出しサイトだけが
    // 型を決めていたためである。1要素の器はスカラーと同型（`[5] ≅ 5`）なので値としては
    // 正しく、**役割だけが器**だった。
    //
    // **書くのは族であって具体型ではない。** `List` と書くと `take_while` の `s`
    // （`String`）まで `List` になり、要素型が降りられなくなる（実際に layout が
    // 無限再帰した）。分かっているのは「器である」ことだけなので、そこまでを書く。
    //
    // **裸の仮引数だけを見る。** `[c ~rest]` の `rest` は分解元から型が決まっている
    // ——そこへ族を書いても近づかないし、分解の側と引っ張り合って不動点が回る
    // （実際 `sep` で回り、コンパイルが 100ms から 7.6 秒になった）。穴があったのは
    // 「名前1つで器を受けている」位置だけである。
    const bare = bareNames || paramNames;
    if (
      node.type === "operation" &&
      node.name === "get_prop" &&
      isIdentifierNode(node.left) &&
      bare.has(node.left.value)
    ) {
      refine(node.left.value, "Container");
    }
    if (
      node.type === "operation" &&
      node.position === "postfix" &&
      node.name === "expand" &&
      isIdentifierNode(node.operand) &&
      bare.has(node.operand.value)
    ) {
      refine(node.operand.value, "Container");
    }
    // **前置 `@` / `#` はアドレスを要求する。** §3.5 の表が `@` を
    // 「`Address` → 参照先の圏を継承」と定めており、参照を外せるのはアドレスだけである。
    // だから `f : p ? @p 1` の `p` は `Address` だと**書いてある**——演算子から逆算する
    // という点で `x + 1` から `Int` を読むのと同じことをしている。
    //
    // これは高階関数の受け口そのものである。§2 の状況表が「高階関数の型解決は `$`/`@` に
    // よる明示的な Lambda↔Atom 変換で足りる」と言う通り、Sign では関数を渡すときに
    // `$is_digit` とアドレスを取り、受け側は `@p` で呼ぶ。仕組みは既にあったが、
    // **型がそれを書き写していなかった**——`take_while : Atom String -> String` の
    // 第1引数は `Address` である。Pass 4 が関数ポインタを渡す命令を選ぶのに要る。
    // ただし **`'` の右辺の `@` は参照外しではない**。そこでの `@` は「名前ではなく
    // 中身を使う」という指示であり（type_system.md §2 のアクセス規則）、指すのは
    // アドレスではなく添字である。ここを Address と読むと `f : p i ? p ' @i` の `i` が
    // アドレス扱いになる。
    if (
      node.type === "operation" &&
      node.position === "prefix" &&
      node.name === "input" &&
      isIdentifierNode(node.operand) &&
      paramNames.has(node.operand.value) &&
      !node.inGetPropKey
    ) {
      refine(node.operand.value, "Address");
    }
    // 中置 `#`（output、tier 4）は「アドレスにデータを入れる」ので**左辺**がアドレスである
    // （前置 `#` は export 印なので別物——同じ記号でも位置で意味が違う）。
    if (
      node.type === "operation" &&
      node.position === "infix" &&
      node.name === "output" &&
      isIdentifierNode(node.left) &&
      paramNames.has(node.left.value)
    ) {
      refine(node.left.value, "Address");
    }

    // レンジの端点も同じ規則で読める。§4 のシグネチャ
    // `~ : (Point -> Point) -> Iterator -> (List | String)` は**両端が同じ点である**ことを
    // 要求しているので、片方が分かればもう片方も決まる——比較が同種同士でしか成立
    // しないのと全く同じ構造である。
    //
    // これを拾わないと `mk : n ? [1 ~ n]` の `n` が `Atom` に留まり、要素型が決まらず、
    // 規則裏打ちの大きさ（`{start, step, end}`）が出せない。終端が実行時変数でも形は
    // 静的に決まる、という list_model.md §2.3 の主張はここまで繋がって初めて成立する。
    if (node.type === "operation" && (node.name === "range" || RANGE_STEP_OPS.has(node.name))) {
      const ends = rangeEndpoints(node, scope);
      for (const [side, other] of [
        [ends[0], ends[1]],
        [ends[1], ends[0]],
      ]) {
        if (side && side.type === "atom" && side.kind === "identifier" && paramNames.has(side.value)) {
          const fromOther = constraintFromLiteral(other) || typeOfKnownOperand(other, scope, paramNames);
          // 端点になれるのは点だけなので、相手が分からなくても `Scalar` までは言える。
          refine(side.value, fromOther && RANGE_ENDPOINT_TYPES.has(fromOther) ? fromOther : "Scalar");
        }
      }
    }

    // 連鎖比較（``0` <= c <= `9``）も同じ規則で読める。中央の項が両端と比較される
    // 以上、比較が同種同士でしか成立しないという性質がそのまま制約になる（comparison.md §4）。
    // これは範囲判定の書き方そのものなので、拾えないと述語の型が `Atom` に留まる。
    if (node.type === "operation" && node.name === "chain_compare") {
      const mid = node.middle;
      if (isIdentifierNode(mid) && paramNames.has(mid.value)) {
        const t =
          constraintFromLiteral(node.left) ||
          constraintFromLiteral(node.right) ||
          typeOfKnownOperand(node.left, scope, paramNames) ||
          typeOfKnownOperand(node.right, scope, paramNames);
        refine(mid.value, t || "Scalar");
      }
      visit(node.middle);
    }

    // **実引数の位置が仮引数の型を語る。**
    //
    // `f : s ? g s` で `g` が String を要求するなら `s` は String である。演算子から逆算
    // するのと同じことを、演算子の代わりに**呼び先のシグネチャ**でやっている——結局どちらも
    // 「その位置に置ける型は何か」を読んでいるだけである。呼び先の要求は不動点で確定して
    // いくので（collectParamTypes）、多段でも周回のうちに伝わる。
    if (node.type === "operation" && node.name === "apply" && scope) {
      const { base, args } = applyChainOf(node);
      const callee = isIdentifierNode(base) && !paramNames.has(base.value) ? envLookup(scope, base.value) : null;
      const slots = callee && callee.paramTypes;
      if (slots) {
        args.forEach((arg, i) => {
          const t = slots[i];
          // `Atom` は下限であって制約ではないので、逆流させる意味が無い。
          if (!t || t === "Atom") return;
          if (isIdentifierNode(arg) && paramNames.has(arg.value)) {
            refine(arg.value, t);
            return;
          }
          // **`xs~` はスロットへ「要素」を渡す。** 後置 `~` は展開なので、呼び先のスロットに
          // 入るのは rest 自身ではなくその要素である。したがってスロットの型がそのまま
          // rest の**要素型**になる——`sum : x ~xs ? x + (sum xs~)` の `xs` の要素は、
          // 展開された先が `x` である以上 `x` と同じ型でなければならない。
          if (
            arg &&
            arg.type === "operation" &&
            arg.position === "postfix" &&
            arg.name === "expand" &&
            isIdentifierNode(arg.operand) &&
            paramNames.has(arg.operand.value) &&
            true
          ) {
            refine(arg.operand.value, t);
          }
        });
      }
    }

    if (node.left) visit(node.left);
    if (node.right) visit(node.right);
    if (node.operand) visit(node.operand);
    if (node.type === "block" && Array.isArray(node.lines)) node.lines.forEach(visit);
  }

  visit(bodyNode);
  return inferred;
}

// paramNode（resolveLambdaLineが返すlambdaノードのleft: 単一identifierノード or params[]ノード）
// から仮引数名の一覧を取り出す。
function paramNamesOf(paramNode) {
  if (!paramNode) return [];
  if (paramNode.type === "atom" && paramNode.kind === "identifier") return [paramNode.value];
  if (paramNode.type === "params") {
    // 混在形（`dist [h ~t]`）のブラケットは1エントリに畳まれ、内側の名前は `pattern` に
    // 入っている。それらも本体で使われる仮引数なので、使用箇所からの逆算の対象である。
    return paramNode.entries.flatMap((e) => (e.pattern ? e.pattern.map((p) => p.name) : [e.name]));
  }
  return [];
}

// lambdaNode（{type:"operation", name:"lambda", left: params, right: body}）から、
// 本体の使用箇所に基づく仮引数のatomType推定結果を Map<識別子, atomType> で返す。
function inferLambdaParamTypes(lambdaNode, env) {
  const names = new Set(paramNamesOf(lambdaNode.left));
  const scopeOf = lambdaNode.scope || env;
  // 裸の仮引数（`f : st ?`）だけが「器として使われた」の対象である。
  const bareNames = new Set(
    lambdaNode.left && lambdaNode.left.type === "atom"
      ? [lambdaNode.left.value]
      : ((lambdaNode.left && lambdaNode.left.entries) || []).filter((e) => !e.pattern && !e.rest && e.name).map((e) => e.name)
  );
  const elems = new Map();
  const inferred = inferParamTypesFromUsage(lambdaNode.right, names, scopeOf, bareNames, elems);
  // 呼ぶ側が要素型も要るので、Map に添えて返す（返り値の形は変えない）。
  inferred.elementTypes = elems;
  // 呼び出しサイトで観測した具体型を取り込む（§5 Pass 1b の Layer 2 版）。§7.1 の
  // `Scalar` は「呼び出しサイトで具体化されるまでの暫定形」なので、族に留まっている
  // 位置はここで決まる。本体の証拠が既に具体型なら、そちらの方が近いので触らない。
  if (Array.isArray(lambdaNode.callsiteParamTypes) && lambdaNode.left) {
    const entries = lambdaNode.left.type === "params" ? lambdaNode.left.entries || [] : [];
    const slotNames = lambdaNode.left.type === "atom" ? [lambdaNode.left.value] : entries.map((e) => (e.pattern || e.rest ? null : e.name || null));
    slotNames.forEach((name, i) => {
      const t = lambdaNode.callsiteParamTypes[i];
      if (!name || !t) return;
      const prev = inferred.get(name);
      const members = prev === undefined ? null : FAMILY_MEMBERS[prev];
      // **`Container` は実引数に譲る。スカラーにも譲る。**
      //
      // ここで器へ持ち上げたくなるが、それは間違いである。`f : n ? n ' 0` を `f 5` と
      // 呼ぶ形と、`f : st ? st ' 0` を `f bottom` と呼ぶ形は**構文が同じ**であり、
      // 使い方だけでは区別が付かない——`[5] ≅ 5` なのでどちらも意味は通る。違うのは
      // 表現（レジスタ1本か `{ptr, len}` か）だけである。
      //
      // 器だと決めるのは**実引数が食い違うとき**である。スタックは `bottom`（`Int`）と
      // `next_st st d`（`List`）の両方で呼ばれるので、`joinParamType` が既に器へ寄せる
      // ——`C` と `C×C` は同じものの別の段だからである。全ての呼び出しがスカラーなら、
      // それは本当に長さ1であり、1本で運ぶ方が正しい。
      if (prev === "Container" && t && !FAMILY_MEMBERS[t]) {
        inferred.set(name, t);
        return;
      }
      // **実引数のどれかが器なら、仮引数は器で運ぶ。** 観測が `Int | List` に落ち着く形
      // ——`walk` の `st` は `bottom`（スカラー）でも `next_st st d`（器）でも呼ばれる
      // ——では、広い方が両方を運べる（スカラーは長さ1の器）。逆は運べない。
      //
      // 直和のまま置くと Pass 4 が幅を選べないので、**器の成員へ寄せる**。段が違うだけで
      // 同じものなので、広い側に決めるのは情報の破棄ではない（原理7）。
      const boxMember = String(t || "")
        .split(" | ")
        .map((x) => x.trim())
        .find((x) => CONTAINER_TYPES.has(x));
      if (boxMember && (prev === undefined || !CONTAINER_TYPES.has(prev))) {
        inferred.set(name, boxMember);
        return;
      }
      // 本体から読めた型が具体型でも、それが**算術の相手のリテラルから来た `Int`** なら
      // 呼び出しサイトの方が近い。`f : a ? a / 2` の `a` は「数である」までしか言われて
      // いないのに、リテラル `2` の型がそのまま `a` の型として書き込まれていた。呼び出しが
      // `f 0x40` なら `a` は `Address` であり、Pass 4 はそこで `udiv` と `sdiv` を、
      // 符号付き条件と符号なし条件を選び分ける。上位ビットの立った番地（カーネル空間）で
      // 実際に壊れる差である。
      //
      // **昇格の向きにしか動かさない。** 格子を上がるのは「もっと広い型だった」という
      // 情報の追加だが、下がるのは情報の破棄である（`@p` から読んだ `Address` を
      // 呼び出しの `Int` で潰してはいけない）。族の中で狭める既存の規則と向きは逆だが、
      // どちらも「分かっていないことを分かったと書かない」の側に倒れている（原理4）。
      // `Char` も同じ扱いである。`c - 200` の `200` は「相手も Int だ」とは言っていない
      // ——文字の算術は符号位置の算術として成立するので、`Char` から引ける。格子には
      // 乗らないが（文字は数の一種ではない）、**リテラル由来の `Int` より近い**という
      // 点では Address や Float と変わらない。
      const promotes =
        NUMERIC_RANK[prev] !== undefined && (NUMERIC_RANK[t] > NUMERIC_RANK[prev] || (prev === "Int" && t === "Char"));
      if (prev === undefined || promotes || (members && members.has(t))) inferred.set(name, t);
    });
  }
  // 仮引数のデフォルト式も走査する。デフォルトは**他の仮引数を使って書ける**ので
  // （`walk : s  line : head_line s  …`）、そこも使用箇所である。本体だけを見ていると、
  // 仮引数リストの中で使われているだけの引数がいつまでも `Atom` のままになる。
  if (lambdaNode.left && lambdaNode.left.type === "params") {
    for (const e of lambdaNode.left.entries || []) {
      if (!e.default) continue;
      for (const [k, v] of inferParamTypesFromUsage(e.default, names, scopeOf)) {
        if (!inferred.has(k)) inferred.set(k, v);
      }
    }
  }
  // **デフォルト式があれば、その型がその仮引数の型である。**
  //
  // デフォルトは「引数が省略されたときに実際にそこへ入る値」なので、型の根拠として
  // 本体の使用箇所より強い。使用箇所は「その演算が要求する型」しか語らないが（`y + 0.0`
  // は y が Address でも昇格するので Float とは限らない）、デフォルトは中身そのものを
  // 語る。したがって使用箇所からの逆算より優先する。
  const paramNode = lambdaNode.left;
  if (paramNode && paramNode.type === "params") {
    const scope = lambdaNode.scope || env;
    for (const e of paramNode.entries || []) {
      if (!e.name || !e.default) continue;
      const t = inferAtomType(e.default, scope);
      // ただし `__` は例外である。零対象は束の**底**であって「この引数は Unit だ」とは
      // 言っていない——`s : __` は「省略されうる」という宣言であり、完全性公理の抑制が
      // 目的である（そうしないと空を渡した時点で呼び出しごと消える）。型は使用箇所が語る。
      if (t && t !== "Unit") inferred.set(e.name, t);
      // **`__` のデフォルトは束縛へ印を残す。** 型には出せない——`joinArmTypes` が
      // `T | Unit` を `T` へ吸収するのは正しい（niche が T の表現の中にあるので、機械の
      // 上では同じ幅である）。違うのは**関数の性質**の方であり、この仮引数について
      // 完全性公理が働かない＝非正格になる、というのがその内容である。
      //
      // **止める必要は本来は無い。** 完全性公理が与える終端は答えが必ず `__` になるが、
      // 終端に仕事があるなら**その仕事を高階関数で渡し、崩壊を `|` で受ける**のが本来の形
      // である——`(f k rest st') | (@k st)`。子の呼び出しが公理で潰れた瞬間、その階層の
      // `st` が最終状態なので、そこで仕事をすればよい。`system_semantics.md` の
      // ポーリング標準形（`@STATUS & @DATA | read __`）と同じ形である。
      //
      // 公理を止める書き方でも動くが、正当な「空」と失敗して `__` に落ちた値を区別
      // できなくなるという代償が残る（`function_guide.md` の状態ベクタの節）。
      //
      // **見るのは書かれた形であって推論された型ではない。** `line : head_line s` のような
      // 計算されるデフォルトは、返値型が未解決な周回では `Unit` に見えるが、それは
      // 「まだ分かっていない」であって定義域の宣言ではない。持ち上げは書き手が
      // `: __` と**書いた**ときだけ起きる。
      else if (e.default.type === "atom" && e.default.kind === "unit") {
        const b = scope ? envLookup(scope, e.name) : null;
        if (b) b.liftedDomain = true;
      }
      // 器のデフォルトは要素型も語る。`c : [0 ~+ 1]` の `c ' n` が何の型かは
      // ここを渡さないと出ない——`inferred` は型名しか運べないので束縛へ直接置く。
      if (e.default.elementType) {
        const b = scope ? envLookup(scope, e.name) : null;
        if (b) b.elementType = e.default.elementType;
      }
    }
  }
  // **裸の仮引数は、証拠が何も無くても `Atom` まで決まる。**
  //
  // 裸の仮引数（rest でもブラケット分割代入でもない）は1個の値を受ける。集合を受け取る
  // なら `[x ~xs]`（参照渡し）か `~xs`（stream）で宣言するので、宣言の形が既に「点で
  // ある」ことを語っている（原理3 の表）。さらにデフォルトが無ければ `__` を渡せない
  // ——完全性公理により呼び出しごと潰れるので、本体に入った時点で非Unitが保証される。
  //
  // `Atom` は §4 の記法定義で「String を**含む**スカラー」＝ `Scalar | String` である。
  // 多相に見えて下限が決まっている。具体的な型は呼び出しサイトで確定する（§5 Pass 1b）。
  if (paramNode && paramNode.type === "params") {
    for (const e of paramNode.entries || []) {
      if (!e.name || e.rest || e.pattern) continue;
      if (!inferred.has(e.name)) inferred.set(e.name, "Atom");
    }
  } else if (isIdentifierNode(paramNode) && !inferred.has(paramNode.value)) {
    inferred.set(paramNode.value, "Atom");
  }
  // **ブラケット分割代入の rest は器そのものである。**
  //
  // `[c ~rest]` は渡された単一の集合をその場で分解する（list_model.md §2.4）。`c` が要素、
  // `rest` は**残りの集合**——つまり `rest` の型は器の型と同じである。したがって要素の型が
  // 分かれば器の型も決まる。
  //
  // 要素が文字（`String`）なら器は `String` である。`List(String)` という型は**存在しない**
  // ——文字列同士をスペース（余積）で並べると String の吸収則で1本に連結されるため
  // （`` [`ab` `cd`] `` は `"abcd"`）、複数の文字列を保つには `Struct`（カンマ）が要る。
  // だから「要素が String な List」と「String」は同じものであり、迷う余地が無い。
  // ブラケットの rest には器の型を与える。全体ブラケット（`[c ~rest]`）でも、混在形の
  // パターン（`dist [h ~t]`）でも規則は同じである。
  if (paramNode && paramNode.type === "params") {
    const groups = [];
    if (paramNode.bracket) groups.push(paramNode.entries || []);
    for (const e of paramNode.entries || []) if (e.pattern) groups.push(e.pattern);
    for (const group of groups) {
      const restEntry = group.find((e) => e.rest && e.name);
      if (!restEntry || inferred.has(restEntry.name)) continue;
      const element = group.find((e) => !e.rest && e.name && inferred.has(e.name));
      const elementType = element ? inferred.get(element.name) : null;
      // **要素が無くても「器である」ことは分かる。**
      //
      // `[~st]` のように rest だけを書く形では、要素の型を語る項目がどこにも無い。だが
      // ブラケットは**器を受ける形の宣言**であり、呼ぶ側はスカラーを渡すときも形に合わせて
      // 持ち上げてから渡す（`emitLiftToContainer`）——中では必ず器である。
      //
      // ここで何も言わずに終わると、呼び出しサイトから来たスカラーの型がそのまま残り、
      // **型は 1 本と言うのに ABI は 2 本で運ぶ**という食い違いになる。preprocess.sn の
      // `push : [~st] d ? d st~` がそれで、スタックの底が `bottom : 0` というスカラー
      // なので `Int` が入っていた。**形の宣言の方が正しい。**
      //
      // どの器かは分からないので `Container` と言う——分かっている以上のことを名乗らない
      // のが原理4 である。
      if (!elementType && !group.some((e) => !e.rest && e.name)) {
        inferred.set(restEntry.name, "Container");
        continue;
      }
      if (elementType && elementType !== "Atom") {
        // 要素が文字なら器は `String` である（`String ≅ List(Char)`）。`List(Char)` と
        // `String` は同じものであり、別の名前を持たない。
        inferred.set(restEntry.name, elementType === "Char" || elementType === "String" ? "String" : "List");
      }
    }
  }
  return inferred;
}


/**
 * ラムダが**実引数ごとに**要求する型の並びを返す（未解決の位置は null）。
 *
 * `inferLambdaParamTypes` が返すのは「束縛名 → 型」であって、実引数の並びではない。
 * ブラケット分割代入（`[c ~rest]`）は**実引数を1個だけ食って分解する**ので、束縛が2つでも
 * スロットは1つである（list_model.md §2.4）。呼び出しサイトから型を逆流させるには、
 * この「スロットの並び」の方が要る。
 */
function lambdaParamSlotTypes(lambdaNode, env) {
  const inferred = inferLambdaParamTypes(lambdaNode, env);
  const paramNode = lambdaNode.left;
  if (isIdentifierNode(paramNode)) return [inferred.get(paramNode.value) || null];
  if (!paramNode || paramNode.type !== "params") return [];
  const entries = paramNode.entries || [];
  // 仮引数リスト全体が1個のブラケットなら、要求する実引数は1個。その型は rest（＝器）の型。
  if (paramNode.bracket) {
    const restEntry = entries.find((e) => e.rest && e.name);
    return [restEntry ? inferred.get(restEntry.name) || null : null];
  }
  return entries.map((e) => {
    // 混在形のパターン（`dist [h ~t]`）も**実引数1個**を食って分解する。器の型は rest である。
    if (e.pattern) {
      const restEntry = e.pattern.find((p) => p.rest && p.name);
      return restEntry ? inferred.get(restEntry.name) || null : null;
    }
    return e.name ? inferred.get(e.name) || null : null;
  });
}

/**
 * `fnName` への呼び出しサイトを全て集め、各サイトの位置順の実引数ノードを返す。
 *
 * **部分適用も呼び出しサイトである。** `f 1` は飽和していないが、スロット0へ 1 を
 * 渡していることに変わりはない——埋めたスロットについては同じ強さの証拠になる。
 * `applyChainOf` が `apply` と `partial_apply` の両方を辿るのはそのためである
 * （Pass 1b 側の収集は Layer 1 のジェネリック解決が目的なので別物として残す）。
 */
function callsitesOf(nodes, fnName, rootEnv) {
  const sites = [];
  // **別名越しの呼び出しも、その関数の呼び出しサイトである。**
  //
  // `g : f` と書いたとき `g 5 6` は `f` を呼んでいる。ここで数えないと、実引数を見せて
  // いるのに仮引数の型が決まらない——`f: 仮引数 a の渡し方が決まりません（直和か族）` に
  // なる。名前を1つ挟んだだけで型が落ちるのは、`$` を挟んだ場合と同じ穴であり、そちらは
  // `addressOf`／`aliasOf` を辿って既に塞いである。
  //
  // 辿るのは名前の連なりだけ（`h : g` / `g : f`）。部分適用（`g : f 1`）は実引数の位置が
  // ずれるので数えない——ずれたまま数えると、別の位置の型を書き込むことになる。
  const names = new Set([fnName]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const node of nodes) {
      if (!isDefineNode(node) || !isIdentifierNode(node.left) || !isIdentifierNode(node.right)) continue;
      if (names.has(node.right.value) && !names.has(node.left.value)) {
        names.add(node.left.value);
        grew = true;
      }
    }
  }
  // **サイトごとにスコープを持ち回る。** 実引数の型はそれが書かれた場所でしか引けない
  // ——`try_col 1 row n board` の `board` は `place` のスコープに居るので、トップレベルの
  // env で引いても見つからない。器が何段も引数として渡り歩く形（盤が first_row →
  // place → try_col → conflict と流れる）は、ここを取り違えると連鎖が切れる。
  const visit = (node, scope) => {
    if (!node || typeof node !== "object") return;
    if (node.scope) scope = node.scope;
    if (node.type === "operation" && (node.name === "apply" || node.name === "partial_apply")) {
      const { base, args } = applyChainOf(node);
      if (isIdentifierNode(base) && names.has(base.value)) {
        sites.push(Object.assign(args, { scope }));
        // 連鎖全体で1サイト。内側を別サイトとして二重に数えない。ただし実引数の中に
        // 別の呼び出しが入っていることはあるので、そちらは個別に辿る。
        args.forEach((a) => visit(a, scope));
        return;
      }
    }
    if (node.left) visit(node.left, scope);
    if (node.right) visit(node.right, scope);
    if (node.operand) visit(node.operand, scope);
    if (Array.isArray(node.lines)) node.lines.forEach((l) => visit(l, scope));
  };
  // **置き換えられた定義は呼び出しサイトではない。** ストリームの糖衣は同じ名前の定義を
  // 2つ作る（元のものと、器を引く形へ均したもの）。元の方は `supersededByDesugar` の印が
  // 付いていて命令にはならないが、`callsitesOf` はそこも歩いていたので、**死んだ定義の
  // 中の呼び出しが型の証拠として数えられていた**。
  //
  // 実害はこう出た。`sep : [c ~rest] ?` の `c` は `Char` だが、置き換えられた側の `c` は
  // `String` のまま取り残される。そこの `infix1 c` が観測されるため `infix1` の仮引数が
  // `String` になり、`ch = \:` が「String と Char の比較」になって出せなくなっていた。
  // 生きている `sep_arm` の側では `c` は正しく `Char` である。
  for (const n of nodes) {
    if (n && n.supersededByDesugar) continue;
    visit(n, rootEnv);
  }
  return sites;
}

/**
 * 呼び出しサイトから仮引数の型を確定させる（§5 Pass 1b の Layer 2 版）。
 *
 * §7.1 の `Scalar` は「String を含まない Atom」という**族**であり、「呼び出しサイトで
 * 具体化されるまでの暫定形」だと §1 が明記している。Pass 1b は Layer 1（`Lambda` か
 * `Atom` か）についてこれを既にやっていたが、Layer 2 についてはやっていなかった
 * ——`solve : n ? first_row 1 n` は `solve 8` としか呼ばれないのに `n` が `Scalar` の
 * ままで、Pass 4 は Int 版を出す根拠を持てなかった。
 *
 * **export されていない関数は、呼び出しサイトが全てである。** 外から呼ばれる可能性が
 * 無いので、観測したサイトの型がその関数の型そのものになる。export されているものは
 * ジェネリックのまま残す——外の呼び出しサイトは見えないので、見えている分だけで
 * 決めつけてはいけない（compiler_pipeline.md §6.3 が呼び出しサイトの列挙を export の
 * 性質として扱っているのと同じ線引きである）。
 *
 * 全サイトが同じ具体型で一致したときだけ狭める。食い違うなら族のままが正しい
 * ——それは「まだ決まっていない」のではなく「複数の型で呼ばれている」ということであり、
 * Pass 4 はサイトごとに別の実体を出す（stack_abi.md のコンパイル時特殊化）。
 * 観測した型の集合は `binding.instances` に残すので、そちらが実体の一覧になる。
 */
function collectCallsiteParamTypes(nodes, env) {
  let changed = false;
  for (const node of nodes) {
    // 糖衣が置き換えた元の定義は見ない。**同じ名前の束縛が2つある**ので、両方から
    // 書き戻すと型が交互に書き換わって不動点が回り続ける（実際 `sep` が String と Struct を
    // 300 周以上往復し、コンパイルが 85ms から 6 秒になっていた）。勝つのは後の定義である。
    if (node && node.supersededByDesugar) continue;
    if (!isDefineNode(node) || !isIdentifierNode(node.left)) continue;
    const rhs = node.right;
    if (!rhs || rhs.type !== "operation" || rhs.name !== "lambda") continue;
    const binding = envLookup(env, node.left.value);
    if (!binding) continue;
    const paramNode = rhs.left;
    // 裸の仮引数だけを扱う。ブラケット分割代入は実引数1個を分解する形なので、
    // スロットと束縛名が1対1にならない（器の型は別の規則が決めている）。
    const entries = paramNode && paramNode.type === "params" ? paramNode.entries || [] : [];
    const names = isIdentifierNode(paramNode)
      ? [paramNode.value]
      : paramNode && paramNode.type === "params" && !paramNode.bracket
        ? entries.map((e) =>
            // **`[~st]` は器を丸ごと受ける位置である。** 分解（`[c ~rest]`、`e.pattern`）
            // なら実引数1個を割るので位置と名前が1対1にならないが、丸ごと受ける形は
            // 渡された実引数**そのもの**を受けるので、裸の仮引数と同じく型を持つ。
            //
            // ここを `null` にしていたため、`push : [~st] d ?` の `st` に呼び出しサイトの
            // 型が届かず、渡し方が「器か分からないので1本」になっていた——呼ぶ側は器
            // （2本）で渡すので幅が食い違う。**宣言を正しく書いた方が弱くなる**という
            // 逆転で、`[~ts]` について前に一度直したのと同じ形の穴である。
            // `[~st]` は `pattern` が rest 1つだけの形で来る（`[c ~rest]` は2つ以上）。
            e.pattern
              ? e.pattern.length === 1 && e.pattern[0].rest && e.pattern[0].name
                ? e.pattern[0].name
                : null
              : e.rest
                ? null
                : e.name || null
          )
        : [];
    // **ブラケットで受ける形は実引数1個を分解する。**
    //
    // `sep : [c ~rest] ?` の `c` は渡された器の要素で、`rest` は器そのものである。
    // スロットと束縛名が1対1にならないので下の経路（`entries[i]` と `args[i]` を突き
    // 合わせる形）では扱えないが、**要素型は呼び出しサイトが知っている**。ここを丸ごと
    // 飛ばしていたので、器を1つ受けて分解する関数の `c` がいつまでも族（`Atom`）の
    // ままで、Pass 4 が「要素の幅が決まりません」と言うしかなかった。
    // **ストリーム形（`x ~xs`）は位置で照合できない。**
    //
    // 渡るのは展開された1つ（`f l~`）であり、それが頭と残りの両方を埋める——`x` は先頭の
    // 要素、`~xs` は残りを包む遅延ストリームである（list_model.md §2.4①）。ところが観測は
    // 実引数を位置で照合していたので、`x` に器の型が入り `xs` は何も観測されないまま
    // （`["List", null]`）だった。**器形と同じ観測がここにも要る**——違うのは実体化する
    // かどうかだけで、型の読み方は同じである。
    if (
      paramNode &&
      paramNode.type === "params" &&
      !paramNode.bracket &&
      entries.length === 2 &&
      entries[1] &&
      entries[1].rest &&
      entries[0] &&
      entries[0].name &&
      !entries[0].rest &&
      !entries[0].pattern
    ) {
      const ssites = callsitesOf(nodes, node.left.value, env);
      const sscope = rhs.scope;
      if (ssites.length > 0 && sscope) {
        const els = new Set();
        const cts = new Set();
        for (const args of ssites) {
          if (args.length === 0) continue;
          const sc = args.scope || env;
          const a = args[0];
          // 展開（`l~`）で渡されたものだけを見る。`~` 無しの List は §5.4 が禁じている。
          const inner = a && a.type === "operation" && a.position === "postfix" && a.name === "expand" ? a.operand : a;
          const el = containerElementType(inner, sc) || elementTypeOf(inner, sc);
          if (el && el !== "Unit" && !FAMILY_MEMBERS[el]) els.add(el);
          const ct = inferAtomType(inner, sc);
          if (ct && ct !== "Unit" && !FAMILY_MEMBERS[ct]) cts.add(ct);
        }
        const el = els.size === 1 ? [...els][0] : null;
        const ct = cts.size === 1 ? [...cts][0] : null;
        const hb = envLookup(sscope, entries[0].name);
        if (hb && el && hb.atomType !== el) { hb.atomType = el; changed = true; }
        const rb2 = envLookup(sscope, entries[1].name);
        if (rb2 && ct) {
          if (rb2.atomType !== ct) { rb2.atomType = ct; changed = true; }
          if (el && rb2.elementType !== el) { rb2.elementType = el; changed = true; }
        }
      }
      continue;
    }
    // **構造体を受ける仮引数には、並び（オフセット表）を届ける。**
    //
    // 名前でフィールドを引く（`s ' foo`）には、名前がどのオフセットかを Pass 4 が知って
    // いなければならない。それを持っているのは呼び出しサイトの実引数だけである——仮引数
    // そのものには値が無いので、`layoutOfStruct` は束縛から並びを起こせない。
    //
    // ここを `[foo bar ~obj]` の形にだけ付けていたため、**同じ「構造体を受ける仮引数」
    // なのに書き方で情報の質が変わっていた**：`[foo bar ~o] ? foo` は実機まで通るのに、
    // `s ? s ' foo` と `[~this] ? this ' foo` は「まだ出せない識別子です」で落ちた。
    // 決めるのは受け取り方の構文ではなく、**渡ってくるものが構造体かどうか**である。
    // 仮引数が1つだけの裸の形（`f : s ? …`）は `params` ノードにならず、識別子がそのまま
    // 置かれる。**同じ「器を受ける仮引数」なので、ここで形の違いに引っかかってはいけない。**
    if (rhs.scope && (paramNode && (paramNode.type === "params" || isIdentifierNode(paramNode)))) {
      const oneBare = isIdentifierNode(paramNode);
      const pents = oneBare ? [{ name: paramNode.value }] : entries;
      const isBracket = !oneBare && !!paramNode.bracket;
      const sites = callsitesOf(nodes, node.left.value, env);
      if (sites.length > 0) {
        pents.forEach((e, i) => {
          if (!e) return;
          // **器そのものを受ける名前はどれか。**
          //
          // ブラケット形は実引数を1つだけ食って分解する（Eager パターン、list_model.md
          // §2.4）ので、器を受けるのは rest だけ——先頭たちはフィールドを1つずつ受ける
          // ので、器の並びを置いたら嘘になる。裸の並びは位置で対応し、そこでは仮引数
          // そのものが器を受ける。裸の並びの中に置いたブラケット（`[~this]` を複数行の
          // 仮引数リストへ入れた形）は `e.pattern` に内側の並びを持ち、器を受けるのは
          // その rest である——構造体の分割代入を糖衣へ展開するとこの形になる。
          const recv = e.pattern
            ? e.pattern.find((q) => q && q.rest && q.name) || null
            : isBracket
              ? (e.rest ? e : null)
              : (e.rest ? null : e);
          if (!recv || !recv.name) return;
          const ai = isBracket ? 0 : i;
          // 渡ってくるのが構造体そのものか、**構造体を要素にする器**かで置く先が変わる。
          // どちらも「中を名前で引くには並びが要る」という同じ話であり、器の場合は
          // 要素の並び——要素はどれも同じ形なので1つで足りる。
          let lay = null, elay = null, sameL = true, sameE = true;
          for (const args of sites) {
            if (args.length <= ai) { sameL = false; sameE = false; break; }
            const cf = { target: "aarch64_qemu", charset: "ascii", env: args.scope || env };
            // 呼び出しサイトが1つでも違う並びを渡すなら、静的には決まらない。
            const l = layoutOfStruct(args[ai], cf);
            if (!l || l.slotKind !== "named" || (lay && JSON.stringify(lay.slots) !== JSON.stringify(l.slots))) sameL = false;
            else lay = l;
            const e = elementShapeOfList(args[ai], cf);
            if (!e || e.slotKind !== "named" || (elay && JSON.stringify(elay.slots) !== JSON.stringify(e.slots))) sameE = false;
            else elay = e;
          }
          const bnd = envLookup(rhs.scope, recv.name);
          if (!bnd) return;
          if (sameL && lay) {
            if (!bnd.shape) { bnd.shape = lay; changed = true; }
            if (bnd.atomType !== "Struct") { bnd.atomType = "Struct"; changed = true; }
          } else if (sameE && elay && !bnd.elementShape) {
            bnd.elementShape = elay;
            changed = true;
          }
        });
      }
    }
    if (paramNode && paramNode.type === "params" && paramNode.bracket) {
      const bsites = callsitesOf(nodes, node.left.value, env);
      const bscope = rhs.scope;
      if (bsites.length === 0 || !bscope) continue;
      // **名前で分ける形は、スロットの型がそのまま束縛の型である。**
      //
      // `calc_diff : [foo bar ~obj] ?` は構造体を名前で分解する（function_guide.md
      // 「構造体メンバーの一致による自動バインディング」）。物理配置は名前でソートした
      // 正規順だが、束縛は名前で結ぶので順序に依らない——`layoutOfStruct` がそのスロット
      // 表を持っているので、そこから引く。ここを見ていなかったため `foo` も `bar` も
      // 器の型（`Struct`）のままで、Pass 4 は幅を選べなかった。
      const named = entries.filter((e) => e && e.name && !e.rest && !e.pattern);
      if (named.length > 0 && entries.some((e) => e && e.rest)) {
        const seen = new Map();
        let agree = true;
        let layout = null;
        for (const args of bsites) {
          if (args.length === 0) { agree = false; break; }
          const lay = layoutOfStruct(args[0], { target: "aarch64_qemu", charset: "ascii", env: args.scope || env });
          if (!lay || lay.slotKind !== "named") { agree = false; break; }
          layout = lay;
          for (const s of lay.slots || []) {
            const prev = seen.get(s.name);
            if (prev && prev.type !== s.type) { agree = false; break; }
            // 型だけでなくスロットごと覚える。分解した先が構造体なら、その**並び**まで
            // 渡さないと Pass 4 は中を引けない（型は "Struct" としか言わない）。
            seen.set(s.name, s);
          }
        }
        if (agree) {
          for (const e of named) {
            const sl = seen.get(String(e.name).replace(/[<>]/g, ""));
            if (!sl) continue;
            const b = envLookup(bscope, e.name);
            if (b && b.atomType !== sl.type) { b.atomType = sl.type; changed = true; }
            if (b && sl.shape && !b.shape) { b.shape = sl.shape; changed = true; }
          }
          // **並びは器そのものを受ける名前に置く。** Pass 4 の入口はそこから引いて
          // 固定オフセットのロードを出す——名前はコンパイル時にオフセットへ解決され、
          // Pass 4 には残らない（function_guide.md）。
          const rest = entries.find((e) => e && e.rest && e.name);
          if (rest && layout) {
            const rb = envLookup(bscope, rest.name);
            if (rb && !rb.shape) { rb.shape = layout; changed = true; }
          }
        }
      }
      const obsEl = new Set();
      const obsCt = new Set();
      for (const args of bsites) {
        if (args.length === 0) continue;
        const sc = args.scope || env;
        const el = containerElementType(args[0], sc) || elementTypeOf(args[0], sc);
        if (el && el !== "Unit" && !FAMILY_MEMBERS[el]) obsEl.add(el);
        const ct = inferAtomType(args[0], sc);
        if (ct && ct !== "Unit" && !FAMILY_MEMBERS[ct]) obsCt.add(ct);
      }
      // 食い違うなら決まらないのが正しい（複数の型で呼ばれている）。
      const el = obsEl.size === 1 ? [...obsEl][0] : null;
      const ct = obsCt.size === 1 ? [...obsCt][0] : null;
      for (const e of entries) {
        if (!e.name || e.pattern) continue;
        const b = envLookup(bscope, e.name);
        if (!b) continue;
        if (e.rest) {
          // rest は器そのもの。型と要素型の両方を持つ——次の段の呼び出しサイトが
          // ここを読むので、これが連鎖を繋ぐ。
          if (ct && b.atomType !== ct) { b.atomType = ct; changed = true; }
          if (el && b.elementType !== el) { b.elementType = el; changed = true; }
        } else if (el && b.atomType !== el && (!b.atomType || FAMILY_MEMBERS[b.atomType])) {
          b.atomType = el;
          b.fromContainer = el;
          changed = true;
        }
      }
      continue;
    }
    if (names.length === 0) continue;
    const sites = callsitesOf(nodes, node.left.value, env);
    if (sites.length === 0) continue;
    // **器を受け取る位置は、要素の型を語る。** `[h ~t]` は渡された集合をその場で分解
    // するので、渡ってくるのが `List(Int)` なら `h` は Int である。既存の規則は
    // 「要素の型が分かれば器の型も決まる」という**逆向き**しか持っていなかったため、
    // 器の側からしか情報が無い場合（`conflict col dist [h ~t]` の盤）に要素が族の
    // ままだった。分解は同型の両側から読める。
    // 要素型も呼び出しサイトで観測する。器の型（`List`）だけでは分解した先が決まらず、
    // 器が何段も引数として渡り歩く場合（盤が `first_row` → `place` → `try_col` →
    // `conflict` と流れる）は、各段で要素型を運ばないと連鎖が切れる。
    const elementObs = entries.map(() => new Set());
    // **`[~ts]` は「ここは器だ」と書いてある。** 分割代入の rest 名は器そのものを受ける
    // 位置なので、器の型も観測して書き戻す必要がある——ここまで要素型しか書いていな
    // かったため、`f : a [~ts] ? …` の `ts` が要素型だけ持って**器の型は null** という
    // 半端な状態になっていた（仮引数が `[~ts]` 1つだけの形は別の経路が通るので偶然
    // 動いていた）。結果、**宣言した方が裸で書くより弱い**という逆転が起きていた。
    const containerObs = entries.map(() => new Set());
    // **指す先は仮引数の並びごとに観測する。** 裸の1引数（`head : c ?`）は `entries` が
    // 空なので、器の要素型と同じループには乗らない——名前の並びを別に作って拾う。
    const ptNames = isIdentifierNode(paramNode) ? [paramNode.value] : entries.map((e) => (e.pattern ? null : e.name || null));
    const pointeeObs = ptNames.map(() => new Set());
    // 形（スロットの並び）はノードにしか無いので、型とは別に持ち回る。
    const pointeeNodes = ptNames.map(() => null);
    for (const args of sites) {
      entries.forEach((e, i) => {
        if (i >= args.length) return;
        const el = containerElementType(args[i], args.scope || env) || elementTypeOf(args[i], args.scope || env);
        if (el && el !== "Unit" && !FAMILY_MEMBERS[el]) elementObs[i].add(el);
        const ct = inferAtomType(args[i], args.scope || env);
        if (ct && ct !== "Unit" && !FAMILY_MEMBERS[ct]) containerObs[i].add(ct);
      });
      // アドレスを受け取る位置は、**指す先**を語る。`head (cons …)` の `c` が何を
      // 指しているかは、呼び出しサイトにしか書いていない。
      ptNames.forEach((nm, i) => {
        if (!nm || i >= args.length) return;
        const pt = pointeeOfNode(args[i], args.scope || env);
        if (pt && pt.type && !FAMILY_MEMBERS[pt.type]) {
          pointeeObs[i].add(pt.type + "|" + (pt.element || ""));
          if (pt.node && !pointeeNodes[i]) pointeeNodes[i] = pt.node;
        }
      });
    }
    // 全サイトで一致したときだけ採る。仮引数の束縛へ書き戻す。
    if (rhs.scope) {
      ptNames.forEach((nm, i) => {
        if (!nm) return;
        const seen = [...pointeeObs[i]];
        if (seen.length !== 1) return;
        const [ty, el] = seen[0].split("|");
        const b2 = envLookup(rhs.scope, nm);
        if (b2 && b2.pointee !== ty) {
          b2.pointee = ty;
          b2.pointeeElement = el || undefined;
          b2.pointeeNode = pointeeNodes[i] || undefined;
          changed = true;
        }
      });
    }
    // **裸の仮引数にも要素型が要る。** 上の `elementObs` は `entries`（分割代入の並び）
    // ごとに回るので、`m : s ?` のような裸の1引数は `entries` が空で観測に乗らない
    // ——指す先（`pointeeObs`）だけが `ptNames` で別に拾われていた。
    //
    // 器を受け取る位置は、ブラケットで受けようが裸で受けようが**同じだけ要素の型を
    // 語る**。落ちていると、器を返す再帰（写像）で「並べるものの幅」が決まらず、
    // sret の計画が立たない——`String` は型名に要素が入っている（`≅ List(Char)`）ので
    // 偶然通り、`List` だけが落ちていた。
    if (rhs.scope && isIdentifierNode(paramNode)) {
      const obsEl = new Set();
      const obsCt = new Set();
      for (const args of sites) {
        if (args.length === 0) continue;
        const el = containerElementType(args[0], args.scope || env) || elementTypeOf(args[0], args.scope || env);
        if (el && el !== "Unit" && !FAMILY_MEMBERS[el]) obsEl.add(el);
        const ct = inferAtomType(args[0], args.scope || env);
        if (ct && ct !== "Unit" && !FAMILY_MEMBERS[ct]) obsCt.add(ct);
      }
      const b0 = envLookup(rhs.scope, paramNode.value);
      if (b0) {
        // 全サイトで一致したときだけ採る（食い違うなら決まらないのが正しい）。
        if (obsCt.size === 1 && b0.atomType !== [...obsCt][0] && (!b0.atomType || FAMILY_MEMBERS[b0.atomType])) {
          b0.atomType = [...obsCt][0];
          changed = true;
        }
        if (obsEl.size === 1 && b0.elementType !== [...obsEl][0]) {
          b0.elementType = [...obsEl][0];
          changed = true;
        }
      }
    }
    const patScope = rhs.scope;
    if (patScope) {
      entries.forEach((e, i) => {
        // 器の型は rest 名（器そのものを受ける位置）へ書く。要素型とは別の観測なので、
        // 片方しか揃わない場合でも揃った方だけ書く。
        const ctSeen = [...containerObs[i]];
        if (ctSeen.length === 1) {
          for (const q of e.pattern || []) {
            if (!q.rest || !q.name) continue;
            const rb = envLookup(patScope, q.name);
            if (rb && rb.atomType !== ctSeen[0] && (!rb.atomType || FAMILY_MEMBERS[rb.atomType])) {
              rb.atomType = ctSeen[0];
              changed = true;
            }
          }
        }
        const seen = [...elementObs[i]];
        if (seen.length !== 1) return;
        // 器そのものを受ける位置（rest・ブラケット全体）には要素型を載せる。
        // 次の段の呼び出しサイトはここを読むので、これが連鎖を繋ぐ。
        for (const name of [e.name, ...(e.pattern || []).filter((q) => q.rest).map((q) => q.name)]) {
          if (!name) continue;
          const cb = envLookup(patScope, name);
          if (cb && cb.elementType !== seen[0]) {
            cb.elementType = seen[0];
            changed = true;
          }
        }
        if (!e.pattern) return;
        for (const pe of e.pattern) {
          if (!pe.name || pe.rest) continue;
          const b = envLookup(patScope, pe.name);
          if (!b) continue;
          const members = FAMILY_MEMBERS[b.atomType];
          if (b.atomType && !(members && members.has(seen[0]))) continue;
          if (b.atomType === seen[0]) continue;
          b.atomType = seen[0];
          b.fromContainer = seen[0];
          changed = true;
        }
      });
    }
    const observed = names.map(() => new Set());
    // **型だけでは渡し方が決まらない。** `[1 ~ 10]` の型は `List` だが、置かれているのは
    // `{start, step, end}` という規則であって要素列への参照ではない（`repr`）。型を運んで
    // `repr` を落とすと、呼ぶ側は3本で渡し受ける側は2本で受け、しかも `start` をポインタ
    // として読む命令が出る——実際にそうなっていた。渡し方は型と一緒に運ぶ。
    const reprObs = names.map(() => new Set());
    const groupObs = names.map(() => new Set());
    // **型名だけでは足りない。** `Struct` はスロットごとに型が違ってよいので、`p ' 0` が
    // 何を返すかは並びを知らないと決まらない。呼び出しサイトはそれを知っているので、
    // 型と一緒に形も運ぶ。全サイトで形が一致したときだけ採る。
    const shapes = names.map(() => ({ shape: undefined, agreed: true }));
    // **器だと分かっただけでは引けない。何バイトずつ並んでいるかが要る。** 型と同じく
    // 要素型も呼ぶ側が知っているので、一緒に運ぶ。
    const elemObs = names.map(() => new Set());
    for (const args of sites) {
      names.forEach((name, i) => {
        if (!name || i >= args.length) return;
        const t = inferAtomType(args[i], args.scope || env);
        // 未解決と `Unit` は観測ではない（`__` は零射であって型の主張ではない）。
        // **族も観測ではない。** 族は「まだ分かっていない」の言い換えなので、それを
        // 観測に数えると具体型と食い違って「複数の型で呼ばれている」に見えてしまう。
        //
        // これが効くのは再帰である。`conflict : col dist [h ~t] ?` は自分自身を
        // `conflict col (dist + 1) t` と呼ぶので、`col` の観測に `col` 自身の型が
        // 混ざる——決めようとしているものを証拠として数える循環になっていた。結果
        // `{Int, Scalar}` と食い違って、`try_col` から Int で呼ばれている事実が
        // 打ち消されていた。
        if (t && t !== "Unit" && !FAMILY_MEMBERS[t]) observed[i].add(t);
        // 決まっていないものは観測ではない——ここも再帰で効く。`sum c (i + 1) …` は
        // 自分の `c` を渡すので、まだ決まっていないうちは証拠に数えない。1周目で
        // 呼び出しサイトの `[1 ~ 10]` から決まり、2周目で自己呼び出しも一致する。
        const el = containerElementType(args[i], args.scope || env);
        if (el && !FAMILY_MEMBERS[el]) elemObs[i].add(el);
        const rp = reprOfNode(args[i], args.scope || env);
        if (rp) reprObs[i].add(rp);
        // **カーソルは群も一緒に運ぶ。** 引く命令がどこへ跳ぶか（`<群>_at` / `<群>_adv`）は
        // 群からしか決まらない。`repr` だけを渡して群を落とすと、仮引数で受けたカーソルが
        // 「参照」に見えて `ptr` を値として読む——**黙って違う値が出る**（実測で 97 の
        // ところに 0 が出ていた）。渡し方は群と一緒に運ぶ。
        const cg = cursorGroupOfNode(args[i], args.scope || env);
        if (cg) {
          groupObs[i].add(cg);
          // **群が付くならカーソルである。** `reprOfNode` は呼び出しの返値までは辿らない
          // が、`cursorGroupOfNode` は辿る（「返値経由も見る」）。群が分かった時点で
          // 置かれ方も分かっているので、そこから読む。
          reprObs[i].add("cursor");
        }
        if (t !== "Struct") return;
        const sh = structShapeOf(args[i], args.scope || env);
        if (!sh) { shapes[i].agreed = false; return; }
        if (shapes[i].shape === undefined) shapes[i].shape = sh;
        else if (!sameShape(shapes[i].shape, sh)) shapes[i].agreed = false;
      });
    }
    const instances = names.map((name, i) => (name ? [...observed[i]] : null));
    if (JSON.stringify(binding.instances) !== JSON.stringify(instances)) {
      binding.instances = instances;
      changed = true;
    }
    // export されているものはジェネリックのまま。外の呼び出しサイトは見えない。
    if (node.exported) continue;
    // **観測はラムダノードへ置く。** 型を組み立てるのは inferLambdaParamTypes であり、
    // そこは本体と仮引数リストしか見ない——呼び出しサイトは別の場所にあるので、
    // 証拠をここへ運んでおかないと合流しない。
    const settled = names.map((name, i) => {
      if (!name) return null;
      const seen = [...observed[i]].filter((t) => !FAMILY_MEMBERS[t]);
      if (seen.length === 0) return null;
      // **スカラーと器が混ざったら、器へ持ち上げる。**
      //
      // `[5] ≅ 5` なのでスカラーは1要素の器であり、`Int` と `List` は「どちらか分から
      // ない」のではなく**同じものの別の段**である（`C` と `C×C`）。食い違いを `null` へ
      // 捨てていたので、`push : st d ? d st~` の `st` が `Int` のまま——**型が値より狭く**、
      // 返す器の上界が `2` になっていた（実行時には伸びる）。持ち上げは無償である。
      //
      // どちらも器・どちらもスカラーで食い違うなら、本当に複数の型で呼ばれている
      // （`binding.instances` が実体の一覧を持つ）ので決めない。
      return seen.reduce((a, b) => (a === null ? null : joinParamType(a, b)));
    });
    if (JSON.stringify(rhs.callsiteParamTypes) !== JSON.stringify(settled)) {
      rhs.callsiteParamTypes = settled;
      changed = true;
    }
    // **仮引数の型を決めるのは呼ぶ側である**（type_system.md §5——呼び出しサイトで実引数の
    // 具体的な型を用いて `.ist` 上に具体化する）。観測はここまで来ているのに、束縛へは
    // 本体からの推定しか書かれていなかった——本体は「器として使った」までしか言えないので
    // `Container` に留まり、**呼ぶ側が知っている具体型が届かない**。
    //
    // 蓄積子がそれで輪になる：`go (acc~ , x) …` の `acc` は本体からは `Container`、
    // 呼び出しサイトからは `List` と観測されているのに、束縛は `Container` のまま。
    // すると `acc~ , x` が「揃わない」と読まれて `Struct` になり、その `Struct` が次の
    // 周回の観測に混ざる——決めようとしているものが証拠に化ける。
    //
    // 族は「まだ分かっていない」の言い換えなので、具体型に譲る（原理4 の線引き）。
    if (rhs.scope) {
      names.forEach((name, i) => {
        const t = settled[i];
        if (!name || !t || FAMILY_MEMBERS[t]) return;
        const b2 = envLookup(rhs.scope, name);
        if (!b2) return;
        if (!b2.atomType || FAMILY_MEMBERS[b2.atomType]) {
          if (b2.atomType !== t) {
            b2.atomType = t;
            changed = true;
          }
        }
        // 要素型は全サイトが一致したときだけ採る（食い違うなら決めない——原理4）。
        const els = [...elemObs[i]];
        if (els.length === 1 && !b2.elementType) {
          b2.elementType = els[0];
          changed = true;
        }
      });
    }
    // **持ち上げた直和のスカラー側が、要素の型である。**
    //
    // `st` が `Int | List` と観測されるのは「スカラーでも器でも呼ばれる」形であり、
    // `[5] ≅ 5` なので前者は**長さ1の器**である。だから器の要素は `Int` だと分かって
    // いる。ここを繋がないと `List` とだけ書かれて要素の幅が決まらず、`top : st ? st ' 0`
    // が「まだ出せない式」になる——型は正しいのに命令が選べない状態である。
    if (rhs.scope) {
      names.forEach((name, i) => {
        const t = settled[i];
        if (!name || !t) return;
        const ms = String(t).split(" | ").map((x) => x.trim());
        const boxM = ms.find((x) => CONTAINER_TYPES.has(x));
        const scaM = ms.find((x) => x !== "Unit" && !CONTAINER_TYPES.has(x) && !FAMILY_MEMBERS[x]);
        if (!boxM || !scaM) return;
        const b = envLookup(rhs.scope, name);
        if (b && b.elementType !== scaM) { b.elementType = scaM; changed = true; }
      });
    }
    // 形は仮引数の束縛へ直接置く。型（`Struct`）は既に分かっていて、足りないのは
    // 並びの方だからである。スコープは入れ子なので親まで辿る。
    const scope = rhs.scope;
    if (!scope) continue;
    names.forEach((name, i) => {
      if (!name) return;
      const sh = shapes[i].agreed ? shapes[i].shape : null;
      const b = envLookup(scope, name);
      if (!b) return;
      // **一度決まった形を消さない。** 不動点は底から単調に上がる設計なので、下げると
      // 回り続ける——実際ここが `null` と形を往復して、糖衣を通したときに 170 周以上
      // 回っていた（決まらない周回では単に「まだ分からない」であって、否定ではない）。
      if (sh && JSON.stringify(b.slotShape) !== JSON.stringify(sh)) {
        b.slotShape = sh;
        changed = true;
      }
      // 全サイトが同じ渡し方で一致したときだけ採る。食い違うなら決まらないのが正しい。
      const rp = [...reprObs[i]];
      if (rp.length === 1 && b.repr !== rp[0]) {
        b.repr = rp[0];
        changed = true;
      }
      const gp = [...groupObs[i]];
      if (gp.length === 1 && b.cursorGroup !== gp[0]) {
        b.cursorGroup = gp[0];
        changed = true;
      }
    });
  }
  return changed;
}

// どの群のカーソルか。識別子なら束縛先まで辿る（返値経由も見る）。
function cursorGroupOfNode(n, env) {
  if (!n) return null;
  // 括弧は剥ぐ——`(sep s) ' 0` のように括った形が普通である。
  while (n && Array.isArray(n.lines) && n.lines.length === 1) n = n.lines[0];
  if (!n) return null;
  if (n.cursorGroup) return n.cursorGroup;
  const d = derefToNode(n, env);
  if (d && d.cursorGroup) return d.cursorGroup;
  if (isIdentifierNode(n) && env) {
    const b = envLookup(env, n.value);
    if (b && b.cursorGroup) return b.cursorGroup;
    if (b && b.returnsCursorGroup) return b.returnsCursorGroup;
  }
  return null;
}

/**
 * **カーソルは pullers の署名を宣言する。**
 *
 * 糖衣が出す `_at` / `_nx` / `_na` は、カーソルを引く命令からしか呼ばれない
 * （`cur ' 0` / `cur ' 1~` が Pass 4 でそこへ跳ぶ）。ソースには呼び出しサイトが無いので、
 * 呼び出しサイトからの逆算では型が決まらない——決めているのはカーソルの側であり、
 * 「捕まえた入力が何か」は入口（`sep : s ? …`）の仮引数が知っている。
 *
 * 枝番号と枝の中の位置は常に `Int` である。それはカーソルの形そのものなので、
 * 本体の使われ方を待つ必要が無い。
 */
function seedCursorPullers(nodes, env) {
  let changed = false;
  for (const node of nodes) {
    // 糖衣が置き換えた元の定義は見ない。**同じ名前の束縛が2つある**ので、両方から
    // 書き戻すと型が交互に書き換わって不動点が回り続ける（実際 `sep` が String と Struct を
    // 300 周以上往復し、コンパイルが 85ms から 6 秒になっていた）。勝つのは後の定義である。
    if (node && node.supersededByDesugar) continue;
    if (!isDefineNode(node) || !isIdentifierNode(node.left)) continue;
    const rhs = node.right;
    if (!rhs || !rhs.cursorEntry || !rhs.scope) continue;
    // 入口の仮引数が捕まえた入力である。
    const p = rhs.left;
    const pname = isIdentifierNode(p) ? p.value : (p && p.entries && p.entries[0] && p.entries[0].name) || null;
    if (!pname) continue;
    const inb = envLookup(rhs.scope, pname);
    if (!inb || !inb.atomType || FAMILY_MEMBERS[inb.atomType]) continue;
    const group = rhs.cursorGroup;
    for (const suffix of [CURSOR_SUFFIXES.at, CURSOR_SUFFIXES.nx, CURSOR_SUFFIXES.na, CURSOR_SUFFIXES.len, CURSOR_SUFFIXES.adv]) {
      const target = nodes.find(
        (n) => isDefineNode(n) && isIdentifierNode(n.left) && n.left.value.replace(/^<|>$/g, "") === group + suffix,
      );
      const lam = target && target.right;
      if (!lam || lam.type !== "operation" || lam.name !== "lambda" || !lam.scope) continue;
      const entries = lam.left && lam.left.type === "params" ? lam.left.entries || [] : [];
      entries.forEach((e, i) => {
        if (!e.name || e.pattern) return;
        const b = envLookup(lam.scope, e.name);
        if (!b) return;
        // 最後の仮引数が入力、それ以外（枝番号・枝の中の位置）は Int。
        const last = i === entries.length - 1 && suffix !== CURSOR_SUFFIXES.len;
        const want = last ? inb.atomType : "Int";
        if ((!b.atomType || FAMILY_MEMBERS[b.atomType]) && b.atomType !== want) {
          b.atomType = want;
          changed = true;
        }
        if (last && inb.elementType && b.elementType !== inb.elementType) {
          b.elementType = inb.elementType;
          changed = true;
        }
        if (last && inb.repr && b.repr !== inb.repr) {
          b.repr = inb.repr;
          changed = true;
        }
      });
    }
  }
  return changed;
}

/**
 * その式が**どう置かれているか**（`repr`）。型（`atomType`）とは別の帳簿で、
 * 「規則なのか、要素列への参照なのか」を持つ。識別子なら束縛先まで辿る。
 */
function reprOfNode(n, scope) {
  if (!n) return null;
  if (n.repr) return n.repr;
  const d = derefToNode(n, scope);
  if (d && d.repr) return d.repr;
  if (isIdentifierNode(n) && scope) {
    const b = envLookup(scope, n.value);
    if (b && b.repr) return b.repr;
  }
  return null;
}

/**
 * 各識別子が要求する実引数の型を識別子テーブルへ書き戻す（`binding.returns` と対になる）。
 * 変化があったら true——返値型と同じ不動点で回る。
 */
function collectParamTypes(nodes, env) {
  let changed = false;
  for (const node of nodes) {
    // 糖衣が置き換えた元の定義は見ない。**同じ名前の束縛が2つある**ので、両方から
    // 書き戻すと型が交互に書き換わって不動点が回り続ける（実際 `sep` が String と Struct を
    // 300 周以上往復し、コンパイルが 85ms から 6 秒になっていた）。勝つのは後の定義である。
    if (node && node.supersededByDesugar) continue;
    if (!isDefineNode(node) || !isIdentifierNode(node.left)) continue;
    const binding = envLookup(env, node.left.value);
    if (!binding) continue;
    const rhs = node.right;
    let types = null;
    // **合成値に束縛された識別子の型も書き戻す。** Pass 1a は `名前 : リテラル1個` しか
    // 読めないので、`m : 1 2 , 3 4` のような合成形は `atomType` が空のまま残る。そのため
    // `m , 5 6` を見たときに `m` が Struct だと分からず、直積の結合が名前を経由すると
    // 破れていた（`1 2 , 3 4 , 5 6` は3スロットなのに `m , 5 6` は入れ子になる）。
    if (rhs && !(rhs.type === "operation" && rhs.name === "lambda") && !pointfreeSignature(rhs)) {
      const t = inferAtomType(rhs, env);
      // **値ノードは型が変わらなくても記録する。** 型と大きさは別の情報だからである
      // ——`t : `abc`` は Pass 1a の時点で `String` と分かるので型は動かないが、
      // 「3文字である」ことは値ノードにしか無い。ここを型の変化に紐付けていたせいで、
      // リテラルに束縛された識別子だけ形の解決から漏れていた（`s : t` が測れない）。
      // `changed` は不動点を回す旗なので、型が動いたときだけ立てる。
      if (t && t !== "Unit") binding.valueNode = rhs;
      if (t && t !== "Unit" && binding.atomType !== t) {
        binding.atomType = t;
        // 名前付きスロットと連番スロットは結合の可否が違うので、種別も持ち回る。
        if (rhs.slotKind) binding.slotKind = rhs.slotKind;
        if (rhs.elementType) binding.elementType = rhs.elementType;
        if (rhs.repr) binding.repr = rhs.repr;
        changed = true;
      }
    }
    const pf = pointfreeSignature(rhs);
    if (pf) types = pf.params;
    else if (rhs && rhs.type === "operation" && rhs.name === "lambda") {
      const scope = rhs.scope || env;
      // 逆算した仮引数の型を**ラムダのスコープへ書き戻す**。ここを書かないと、本体で
      // その仮引数を読んだときに Pass 1a が置いた下限（`Atom`）しか見えず、返値型が
      // 実際より緩くなる——`b : lstrip raw` のようにデフォルトが式の場合、Pass 1a は
      // 型を読めないので下限のままである。書き戻して初めて逆算が本体まで届く。
      const inferred = inferLambdaParamTypes(rhs, scope);
      if (scope && scope.bindings) {
        for (const [name, t] of inferred) {
          // **仮引数のスコープは入れ子である。** カリー化により引数1つごとに1段できるので、
          // 最内側の `bindings` だけを見ると**最後の引数しか書き戻されない**
          // ——`f : a b ? a + b` の `a` は1段外に居る。親まで辿る。
          const b = envLookup(scope, name);
          // `Atom` は下限であって情報ではないので、上書きの根拠にしない。
          //
          // **ここは使われ方であって、値ではない。** `c (rest ' 0)` の `c` は「String を
          // 要求する演算に渡された」だけで、値が String だとは言っていない——持ち上げの
          // 判断（`joinParamType`）はここではなく**実引数を観測する側**で行う。
          // 混同すると `[c ~rest]` の頭まで器に持ち上がり、要素の幅が決まらなくなる。
          if (b && t && t !== "Atom" && b.atomType !== t) {
            b.atomType = t;
            changed = true;
          }
          // **器だと分かっただけでは引けない。** 何バイトずつ並んでいるかが要る
          // （value_representation.md §5.10）。要素型を書き戻せば `elementTypeOfNode` が
          // 束縛まで辿って見つける——新しい口は要らない。
          const el = inferred.elementTypes && inferred.elementTypes.get(name);
          if (b && el && b.elementType !== el) {
            b.elementType = el;
            changed = true;
          }
        }
      }
      types = lambdaParamSlotTypes(rhs, scope);
    }
    if (!types) continue;
    const key = types.join("\u0000");
    if (binding.paramTypesKey !== key) {
      binding.paramTypes = types;
      binding.paramTypesKey = key;
      changed = true;
    }
  }
  return changed;
}

// 適用の連なりを左へ辿り、呼び先の項と実引数の並びを返す。
// `f a b` は `apply[apply[f, a], b]` なので、ここで `{base: f, args: [a, b]}` になる。
/**
 * **どの位置の仮引数を、そのまま返しうるか。**
 *
 * `id : [~ar] ? ar` の要素型は定義側には無い——器の中身を決めているのは実引数である。
 * 位置を覚えておいて、呼ぶ側で実引数の要素型を読む。
 *
 * ブラケットの仮引数は**1つの引数を分解した形**なので位置は0番だけであり、器を指すのは
 * 残り（`rest`）の名前である。頭（`c`）は要素であって器ではない。
 */
function returnedParamPositions(lam) {
  const p = lam.left;
  if (!p) return [];
  const at = new Map();
  if (p.type === "atom" && p.kind === "identifier") at.set(p.value, 0);
  else if (p.type === "params") {
    // **分解した形は位置ごとに畳まれている。** 純ブラケット（`[~ar]`）は器1つを分解した
    // 形なので位置は0番だけ。混在形（`[~ar] n`）は各エントリが1位置で、分解した中身は
    // `pattern` に入る——**名前の場所が2つある**ので、片方だけを見ると混在形が落ちる。
    const wholeOf = (e) => {
      if (!e.pattern) return e.name;
      const r = e.pattern.find((x) => x.rest) || e.pattern[e.pattern.length - 1];
      return r ? r.name : null;
    };
    if (p.bracket && (p.entries || []).length && !(p.entries || []).some((e) => e.pattern)) {
      const r = (p.entries || []).find((e) => e.rest);
      if (r) at.set(r.name, 0);
    } else
      (p.entries || []).forEach((e, i) => {
        const nm = wholeOf(e);
        if (nm) at.set(nm, i);
      });
  }
  if (!at.size) return [];
  const out = new Set();
  const arms = (v) => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v.lines)) {
      for (const l of v.lines) arms(isDefineNode(l) ? l.right : l);
      return;
    }
    if (v.type === "operation" && v.name === "or") {
      arms(v.left);
      arms(v.right);
      return;
    }
    if (isIdentifierNode(v) && at.has(v.value)) out.add(at.get(v.value));
  };
  arms(lam.right);
  return [...out];
}

function applyChainOf(node) {
  const args = [];
  let n = node;
  while (n && n.type === "operation" && (n.name === "apply" || n.name === "partial_apply")) {
    args.unshift(n.right);
    n = n.left;
  }
  return { base: n, args };
}

// AST全体を歩いて、全ノードに `atomType` を載せる（type_system.md §5 Pass 3 の
// 出力＝「完全型付きAST」）。inferAtomType自身がメモ化するため、各ノードの型は
// 一度しか計算されない。
//
// 【既知の制限】ブロックの中身も呼び出し元と同じenvで解決する。pass2.jsのresolveBlockは
// 縮約中に子スコープを作るが、それをノードへ残していないため、ここから辿れない
// （inferAtomTypeが元々持っていた制限と同じ。ブロック内で新たに定義された識別子の
// atomTypeは解決できず null になる）。
function annotateTypes(node, env, diagnostics) {
  if (!node || typeof node !== "object") return node;
  inferAtomType(node, env);
  if (diagnostics) collectUnitReason(node, env, diagnostics);
  if (diagnostics) collectExportMisuse(node, diagnostics);
  // ブロック・ラムダは pass2 が残した子スコープで中身を歩く（無ければ現在のenv）。
  // これが無いと仮引数やブロック内の定義が「未定義識別子」になってしまう。
  const inner = node.scope || env;
  // 仮引数の atomType を、本体を歩く**前に**その子スコープへ書き込む（§7.1）。
  //
  // 仮引数には型注釈スロットが無いが、本体でどの演算子に渡されているかから型が逆算できる
  // ——§7.1 の表がそのまま「`x + y` の `x` は `+` のシグネチャが要求する `Scalar`」と
  // 述べている。inferParamTypesFromUsage はその実装として既に存在しテストもあったが、
  // 自身のテストからしか呼ばれておらずパイプラインに載っていなかった（pass3 自身が
  // compile.js 以前にそうだったのと同じ形）。ここで繋ぐ。
  //
  // 本体より先に書き込む必要がある。inferAtomType は結果をノードへメモ化するため、
  // 型の付いていない状態で本体を先に歩くと null が焼き付いて後から直らない。
  //
  // ここで入る `Scalar` は「String を含まない Atom」という**族**であり（§4 の記法定義）、
  // Layer 2 の具体型（Address / Float / Vector）ではない。呼び出しサイトで具体化される
  // までの暫定形であり、§7.1 が `Lambda<returns: Scalar>` と書いているのと同じ粒度である。
  if (node.name === "lambda" && node.scope) {
    for (const [name, atomType] of inferLambdaParamTypes(node, env)) {
      const binding = envLookup(node.scope, name);
      if (binding && !binding.atomType) binding.atomType = atomType;
    }
  }
  if (node.left) annotateTypes(node.left, node.name === "lambda" ? env : inner, diagnostics);
  if (node.middle) annotateTypes(node.middle, inner, diagnostics); // chain_compare（§4の三項連鎖比較）
  if (node.right) annotateTypes(node.right, inner, diagnostics);
  if (node.operand) annotateTypes(node.operand, inner, diagnostics);
  if (node.type === "block" && Array.isArray(node.lines)) {
    for (const line of node.lines) annotateTypes(line, inner, diagnostics);
  }
  if (node.type === "params" && Array.isArray(node.entries)) {
    for (const e of node.entries) if (e.default) annotateTypes(e.default, inner, diagnostics);
  }
  return node;
}

// ---- Pass 3b: `__` へ収束する経路の静的記録（type_system.md §5 Pass 3b） ----
//
// `__` は零対象なのであらゆる崩壊が同じ `__` に潰れる。実行時にはこの一様性こそが
// 価値だが（オーバーヘッドゼロの収束）、「なぜ潰れたか」は互いに全く異なる。
// Sign の真理は Boolean ではなく値そのものを証拠として返す（原理6）ため、真の側は
// witness を運ぶのに偽の側は何も運ばない、という非対称がある。それを**値ではなく
// 帳簿の側で**埋めるのが本節の役割。
//
// 記録するのは静的に判定できた分だけで、実行時には一切残らない（原理2）。
// 実行時側の対応物は unit.md §7.3（デバッグ層の Unit Payload）。
//
// `reason` は機械可読なコード、`message` は人間向け。形式手法へ橋を架けるとき
// （Lean/Coq への変換など）に読むのは `reason` の方であり、日本語文ではない。
/**
 * **匿名の式へアドレスを作るのは `$` である。**
 *
 * 前置 `#` / `##` / `###` は名前に付く印であり（operator_table.md tier 1：「名前を
 * プロジェクト内部から発見可能にする」）、`#name : value` は Pass 2 が `define.exported`
 * へ畳む。演算子ノードとして残っているなら**名前が無い**——修飾する対象が無い。
 *
 * `#(x ? x + 1)` と `$(x ? x + 1)` は**同じ所を指す**。閉じたラムダは何も捕まえて
 * いないので実体は `.text` のコード番地であり、フレームでもアリーナでもないからである。
 * リテラルも同じ。だから「どちらでもよい」に見える。
 *
 * **しかし一致するのは記憶を持たない値だけである。** `$` は自分のフレーム（`sub sp`、
 * 関数から戻ると死ぬ）、`#` はプロジェクトのアリーナ（unload まで生きる）で、
 * `#(d st~)` のように実体を持つものでは寿命が本当に違う。**寿命が問題にならない所で
 * だけ一致し、問題になる所で食い違う**——同義語にすると、一番効く場所で破れる規則を
 * 教えることになる。だから記法は `$` に寄せる。
 *
 * 「一つのことを表現する方法は一つ」（pass2.js の方針）に従う。
 */
const EXPORT_PREFIX_OPS = new Set(["export_internal", "export_external", "export_pin"]);

function collectExportMisuse(node, diagnostics) {
  if (!node || node.type !== "operation" || node.position !== "prefix") return;
  if (!EXPORT_PREFIX_OPS.has(node.name)) return;
  diagnostics.push({
    level: "warning",
    reason: "export-on-anonymous-expression",
    spec: "operator_table.md tier 1",
    message:
      `匿名の式へアドレスを作るなら '$式' と書きます（前置 '${node.op}' は名前に付ける印で、` +
      `'${node.op}名前 : 値' の形でしか修飾する対象がありません）` +
      `——記憶を持たない値では同じ所を指しますが、実体を持つものでは寿命が違います` +
      `（'$' は自分のフレーム、'${node.op}' はプロジェクトのアリーナ）`,
  });
}

function collectUnitReason(node, env, diagnostics) {
  if (!node || node.type !== "operation" || node.position !== "infix") return;
  if (node.atomType !== "Unit") return;

  // 範囲族（§4）: 端点が「点」でない（List / Struct）ため零射へ落ちた場合。
  if (node.name === "range" || RANGE_STEP_OPS.has(node.name)) {
    const bad = badRangeEndpoint(node, env);
    if (bad) {
      diagnostics.push({
        level: "information",
        reason: "range-endpoint-not-a-point",
        spec: "type_system.md §4",
        message: `範囲演算子 '${node.op}' の${bad.label}が ${bad.type} であり、範囲の端点になれないため __ に収束します（端点になれるのは数値と1文字だけです）`,
      });
    }
    return;
  }

  if (!ARITHMETIC_OPS.has(node.name)) return;

  const leftType = inferAtomType(node.left, env);
  const rightType = inferAtomType(node.right, env);
  // 左辺Unitは§3.3の吸収則（`__ + x = __`）であり、型の不一致ではない——
  // 意図された伝播なので診断しない。
  if (leftType === "Unit" || rightType === "Unit") return;

  if (NON_SCALAR_PLACES.has(leftType) || NON_SCALAR_PLACES.has(rightType)) {
    diagnostics.push({
      level: "information",
      reason: "arithmetic-on-place",
      spec: "type_system.md §4",
      message:
        `算術演算 '${node.op}' の被演算子が場所またはストリーム（左辺=${leftType}, 右辺=${rightType}）であるため __ に収束します。` +
        `算術は Scalar を要求します——持ち上げた結果に演算を書いている場合は、演算を持ち上げの内側へ移してください（\`~(x + 1)\`）`,
    });
    return;
  }
  if (leftType === "String" || rightType === "String") {
    diagnostics.push({
      level: "information",
      reason: "arithmetic-type-mismatch",
      spec: "type_system.md §3.2",
      message: `算術演算 '${node.op}' の被演算子に String（左辺=${leftType}, 右辺=${rightType}）が含まれるため __ に収束します。文字列を数値として扱いたい場合は明示的な変換が必要です`,
    });
    return;
  }
  if (leftType === "List" || leftType === "Struct") {
    diagnostics.push({
      level: "information",
      reason: "list-arithmetic-undefined",
      spec: "type_system.md §3.2",
      message: `List 左辺に対する '${node.op}' は定義されていないため __ に収束します（List で意味を持つ算術は '*'（複製）・'^'（次元上げ）・'/'（分割）のみ）`,
    });
  }
}

// match_case の各 arm の型から返値型（直和）を作る（§7.3）。
//
// `__` は直和から落とす。完全性公理によりあらゆる関数が `__` を返しうるので `T | Unit` は
// 全ての関数に付き、識別情報をゼロしか持たない。零対象は余積の単位元でもあるので、
// 直和の単位元として落とすのは代数的にも一貫している。
//
// 未解決（null）が混ざる場合は直和全体が未解決——分かっていない枝がある以上、
// 分かっている枝だけで返値型を名乗ると嘘になる。
/**
 * **多相な `Struct` へ実行時の添字は引けない**（§2）。
 *
 * `p ' @i` は「名前ではなく中身で引く」形だが、スロットごとに型が違ってよいのが直積の
 * 意味なので、どの命令を出すか決まらない。スロットの型が全部同じならそれは `List` で
 * ある（幅が揃うかで分ける、§2）ので、ここへ来るのは本当に多相な場合だけである。
 *
 * 黙って未解決にしない。`_` のままだと「まだ実装していない」に見えるが、これは
 * **書けないことが決まっている**形である。
 */
function collectPolymorphicIndex(nodes, diagnostics) {
  const visit = (n) => {
    if (!n || typeof n !== "object") return;
    if (n.runtimeIndexProblem) {
      diagnostics.push({
        severity: "error",
        message:
          n.runtimeIndexProblem === "named"
            ? "stack_abi.md §7.1違反: 名前付きスロットへ実行時の添字は引けません" +
              "（物理配置は名前順なので連番と一致しない）。名前で引くか、連番スロットにしてください"
            : "type_system.md §2違反: 多相な Struct へ実行時の添字は引けません" +
              "（スロットごとに型が違うため命令が決まらない）。スロットの型を揃えれば List になります",
        node: n,
      });
    }
    for (const k of ["left", "right", "operand"]) visit(n[k]);
    for (const l of n.lines || []) visit(l);
    for (const e of n.entries || []) visit(e.default);
  };
  for (const n of nodes) visit(n);
}

function joinArmTypes(types) {
  if (types.some((x) => x === null || x === undefined)) return null;
  // **直和は平らにする。** arm の型が既に直和（再帰呼び出しの返値など）だと、それを1個の
  // 要素として数えてしまい、周回のたびに `String | List | String | List | …` と伸び続ける
  // ——直和は冪等（`A | A = A`）であり、結合的でもあるのだから、入れ子を保つ理由が無い。
  const flat = types.flatMap((t) => String(t).split(" | "));
  const distinct = [...new Set(flat.filter((x) => x !== "Unit"))].sort();
  if (distinct.length === 0) return "Unit";
  if (distinct.length === 1) return distinct[0];
  // **族が既に含んでいる枝は畳む。** §4 の記法定義では `Atom` は `Scalar | String` で
  // あり、`Scalar` は `Int | Address | Float | Vector` である。したがって
  // `Atom | String` は `Atom` であって、`| String` は何も足していない。
  //
  // 畳まないと「表現を決めるべき直和」が水増しされる——Pass 4 から見れば `Atom | String`
  // は枝が2つあるように見えるが、実際には1つの族でしかない。冪等（`A | A = A`）を
  // 平らにするのと同じ話が、族と成員の間にも成り立つ。
  const absorbed = distinct.filter(
    (x) => !distinct.some((y) => y !== x && ((FAMILY_MEMBERS[y] && FAMILY_MEMBERS[y].has(x)) || memberOfListFamily(y, x)))
  );
  if (absorbed.length === 1) return absorbed[0];
  // **スカラーと器は「どちらか」ではなく、同じものの別の段である**（原理8——`[x] ≅ x`）。
  // `Char | String` は「文字か文字列か」ではなく、**1文字は長さ1の文字列**なので `String`
  // である（原理7）。族を畳むのと同じ話が、持ち上げの上下にも成り立つ。
  //
  // 直和のまま残すと、枝ごとに表現が違う（1本と2本）ことになり、合流の幅も返値の幅も
  // 決められない——**型が「同じもの」と言っているのに、表現だけが分かれたまま**になる。
  const lifted = absorbed.filter((x) => !absorbed.some((y) => y !== x && liftScalarToBox(x, y) === y));
  if (lifted.length === 1) return lifted[0];
  return lifted.join(" | ");
}

// apply 連鎖（`apply(apply(f, a), b)`）の根にある識別子の binding を返す。
// 根が識別子でなければ（即値ラムダ・ポイントフリー等）null——呼び先が静的に決まらない
// ので返値型も決まらない。
// 識別子の binding から、それが**指している**関数の binding を辿る。
// `p : $f` のように「関数のアドレス」を束縛している場合、`@p` の呼び先は `f` である
// ——§2 の IMPORTANT が「多くの場合は静的に一意に決まる（`@handler` で handler の定義が
// 既知なら構文から読める）」と述べている分をここで解決する。
function resolveThroughAddress(binding, env) {
  let b = binding;
  const seen = new Set();
  // `$対象`（持ち上げ）でも `別名`（そのまま）でも、辿り着く先の定義は同じである。
  while (b && (b.addressOf || b.aliasOf)) {
    const to = b.addressOf || b.aliasOf;
    if (seen.has(to)) break;
    seen.add(to);
    const next = envLookup(env, to);
    if (!next) break;
    b = next;
  }
  return b;
}

function applyCalleeBinding(node, env) {
  let base = node;
  while (base && base.type === "operation" && base.name === "apply") base = base.left;
  while (base && base.type === "block" && base.kind !== "indent" && base.kind !== "abs" && (base.lines || []).length === 1) {
    base = base.lines[0];
  }
  if (!env) return null;
  // 根が `@識別子`（前置 input）なら、その識別子が指す先まで辿る。`@f x` はもちろん、
  // `p : $f` を経由した `@p x` も呼び先が静的に決まる。
  if (base && base.type === "operation" && base.position === "prefix" && base.name === "input") {
    const inner = base.operand;
    if (!isIdentifierNode(inner)) return null;
    return resolveThroughAddress(envLookup(env, inner.value), env) || null;
  }
  if (!isIdentifierNode(base)) return null;
  return resolveThroughAddress(envLookup(env, base.value), env) || null;
}

// 不動点計算のために、前回付けた型注釈を消す。
function clearTypeAnnotations(node) {
  if (!node || typeof node !== "object") return;
  delete node.atomType;
  delete node.elementType;
  delete node.repr;
  delete node.slotKind;
  delete node.operandType;
  for (const k of ["left", "right", "operand", "middle"]) clearTypeAnnotations(node[k]);
  for (const l of node.lines || []) clearTypeAnnotations(l);
  for (const e of node.entries || []) clearTypeAnnotations(e.default);
}

// トップレベルの `名前 : ラムダ` から返値型を集めて識別子テーブルへ書き戻す。
// 変化があったら true（不動点の判定に使う）。
function collectReturns(nodes, env) {
  let changed = false;
  for (const node of nodes) {
    // 糖衣が置き換えた元の定義は見ない。**同じ名前の束縛が2つある**ので、両方から
    // 書き戻すと型が交互に書き換わって不動点が回り続ける（実際 `sep` が String と Struct を
    // 300 周以上往復し、コンパイルが 85ms から 6 秒になっていた）。勝つのは後の定義である。
    if (node && node.supersededByDesugar) continue;
    if (!isDefineNode(node) || !isIdentifierNode(node.left)) continue;
    const rhs = node.right;
    const binding = envLookup(env, node.left.value);
    if (!binding) continue;
    // ポイントフリーの演算子ブロック（`inc : [+ 1]`）もラムダである。返値型は演算子表から
    // 決まるので、`inc 3` の型が呼び先の返値として伝わるように識別子テーブルへ書き戻す。
    const pf = pointfreeSignature(rhs);
    if (pf) {
      // 演算子表から返値が読めているのだから、これは種ではない。
      binding.returnsSeeded = false;
      if (binding.returns !== pf.ret) {
        binding.returns = pf.ret;
        changed = true;
      }
      continue;
    }
    if (!rhs || rhs.type !== "operation" || rhs.name !== "lambda") continue;
    const ret = inferAtomType(rhs.right, rhs.scope || env);
    // **null は「まだ分からない」であって、型ではない。** 束は `__`（底）から始めて単調に
    // 上がる設計なので、途中の周回で読めなかったからといって底を壊してはいけない
    // ——相互再帰では初回に必ず相手が未確定になるため、上書きすると二度と上がれなくなる。
    if (ret === null || ret === undefined) continue;
    // 返値の**ノード**も残す。型は「何ができるか」しか語らないので、大きさと実体の種類
    // （規則裏打ちか要素の並びか）は返値の式そのものにしか無い。形の解決がこれを辿る。
    binding.returnsNode = rhs.right;
    // 一度でも本体から型が読めたら、もう種ではない。
    binding.returnsSeeded = false;
    if (rhs.right.elementType) binding.returnsElementType = rhs.right.elementType;
    // **仮引数をそのまま返す枝は、要素型を呼び出しサイトから受け取る。** 定義側は器の
    // 中身を知らない——知っているのは実引数である。
    const rp = returnedParamPositions(rhs);
    if (rp.length) binding.returnsParamAt = rp;
    // **指す先も返値と一緒に運ぶ。** `cons : h t ? $(h , t)` を呼んだ側が `@` で読むとき、
    // 何が出るかを決めているのは `cons` の中の `$` である。ここで運ばないと連鎖が切れる。
    if (rhs.right.pointee) binding.returnsPointee = rhs.right.pointee;
    if (rhs.right.pointeeElement) binding.returnsPointeeElement = rhs.right.pointeeElement;
    if (rhs.right.pointeeNode) binding.returnsPointeeNode = rhs.right.pointeeNode;
    if (rhs.right.repr) binding.returnsRepr = rhs.right.repr;
    // **カーソルの入口は「どう置かれているか」を宣言している。** 糖衣が作る
    // `sep : s ? (sep_arm s) , 0 , s` の本体は積に見えるが、置かれているのは
    // `{arm, k, 入力}` の3つ組であって要素の並びではない（stream_desugar.js）。
    // 本体から読める `repr` で上書きさせない。
    if (rhs.cursorEntry || rhs.cursorReturns) {
      binding.returnsRepr = "cursor";
      if (rhs.cursorInner) binding.returnsCursorInner = rhs.cursorInner;
      // どの群のカーソルかも運ぶ。引く命令はここから跳び先を決める。
      binding.returnsCursorGroup = rhs.cursorGroup || null;
    }
    if (binding.returns !== ret) {
      binding.returns = ret;
      changed = true;
    }
  }
  return changed;
}


/**
 * 合成の中間の型が噛み合っているかを検査する（Pass 3b）。
 *
 * `h : f g` はスペースによる左→右のパイプライン（`f g` は `g(f(x))`）なので、**`f` の返値が
 * `g` の第1仮引数へ入る**。ここが噛み合っていなければ射が無く、適用しても零射（`__`）に
 * なる——値は静かに消え、型だけが `Int -> String` のように**通ったかのように**見えてしまう。
 *
 * 例外にはしない。射が無いことは「不正」ではなく「そこに射が無い」という事実であり、
 * 零対象を経由する射（零射）が常に存在する以上、結果は `__` である（原理4）。なぜ潰れるかを
 * 記録するのが Pass 3b の仕事である。
 */

// `arg` を `param` の位置へ置けるか。分からないものは通す——分からないことを「不正」と
// 断じないのが原理4 の線引きである。
function acceptsType(param, arg) {
  if (!param || !arg) return true;
  if (param === arg) return true;
  // `Atom` は「どの Atom か分かっていない」という下限であり、制約ではない。
  if (param === "Atom" || arg === "Atom") return true;
  // `Unit` を渡すのは完全性公理の話であって型の不一致ではない。
  if (param === "Unit" || arg === "Unit") return true;
  // 恒等射は何でも通す（`!__ x = x`）。
  if (param === IDENTITY || arg === IDENTITY) return true;
  // 直和はどれか1つでも置ければよい。
  if (String(param).includes(" | ")) return String(param).split(" | ").some((p) => acceptsType(p, arg));
  if (String(arg).includes(" | ")) return String(arg).split(" | ").some((a) => acceptsType(param, a));
  // `Scalar` は族（String を含まない Atom）。その要素なら置ける。
  if (param === "Scalar") return NUMERIC_TYPES.has(arg) || arg === "Scalar";
  if (arg === "Scalar") return NUMERIC_TYPES.has(param) || param === "Scalar";
  // 数値同士は昇格格子で繋がっている（§3.2）ので射がある。
  if (NUMERIC_TYPES.has(param) && NUMERIC_TYPES.has(arg)) return true;
  return false;
}

// 合成木を左から順に並べる。`f g h` は `compose[compose[f,g],h]`。
function composeChain(node) {
  if (node && node.type === "operation" && node.name === "compose") {
    return [...composeChain(node.left), ...composeChain(node.right)];
  }
  return [node];
}

function signatureOfTerm(term, env) {
  if (!isIdentifierNode(term) || !env) return null;
  const b = envLookup(env, term.value);
  if (!b) return null;
  return { returns: b.returns, params: b.paramTypes };
}

function collectCompositionMismatch(nodes, env, diagnostics) {
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "operation" && node.name === "compose") {
      const chain = composeChain(node);
      for (let i = 0; i + 1 < chain.length; i++) {
        const from = signatureOfTerm(chain[i], env);
        const to = signatureOfTerm(chain[i + 1], env);
        if (!from || !to || !to.params || to.params.length === 0) continue;
        const out = from.returns;
        const need = to.params[0];
        if (acceptsType(need, out)) continue;
        diagnostics.push({
          level: "information",
          reason: "composition-type-mismatch",
          spec: "coproduct_resolver.md §3.1",
          message:
            `合成 '${bareIdent(chain[i])} ${bareIdent(chain[i + 1])}' の中間の型が噛み合っていません` +
            `（${bareIdent(chain[i])} の返値は ${out}、${bareIdent(chain[i + 1])} が要求するのは ${need}）。` +
            `射が無いため、適用すると __ に収束します`,
        });
      }
      return;
    }
    for (const k of ["left", "right", "operand", "middle"]) visit(node[k]);
    for (const line of node.lines || []) visit(line);
    for (const e of node.entries || []) visit(e.default);
  };
  for (const node of nodes) visit(node);
}

function bareIdent(n) {
  const v = n && n.value;
  return typeof v === "string" && v.startsWith("<") && v.endsWith(">") ? v.slice(1, -1) : String(v);
}

/**
 * 型注釈を不動点まで回す（§5 Pass 3）。
 *
 * 再帰関数の返値型は自分自身に依存するため、一度の走査では決まらない。**`__` を束の底**
 * として始める——零対象は直和の単位元であり joinArmTypes が `Unit` を落とすので、初回は
 * 再帰呼び出しの枝が何も寄与せず、基底ケースだけが型を決める。次の周回でその型が再帰の枝
 * へ伝わり、変化が止まったところが返値型である。
 *
 * 型変数も制約ソルビングも使っていない（§1）——束を単調に上がるだけである。
 */
function annotateAll(nodes, env, diagnostics) {
  for (const node of nodes) {
    // 糖衣が置き換えた元の定義は見ない。**同じ名前の束縛が2つある**ので、両方から
    // 書き戻すと型が交互に書き換わって不動点が回り続ける（実際 `sep` が String と Struct を
    // 300 周以上往復し、コンパイルが 85ms から 6 秒になっていた）。勝つのは後の定義である。
    if (node && node.supersededByDesugar) continue;
    if (!isDefineNode(node) || !isIdentifierNode(node.left)) continue;
    const rhs = node.right;
    if (!rhs || rhs.type !== "operation" || rhs.name !== "lambda") continue;
    const binding = envLookup(env, node.left.value);
    // 束の**底**を置く。これは答えではなく出発点である——再帰の枝が初回に何も寄与
    // しないようにするための種であって、「何も返さない」という主張ではない。
    if (binding && binding.returns === undefined) {
      binding.returns = "Unit";
      binding.returnsSeeded = true;
    }
  }
  // `名前 : $対象` の由来を記録する。`@名前` の呼び先を静的に解くのに使う。
  for (const node of nodes) {
    // 糖衣が置き換えた元の定義は見ない。**同じ名前の束縛が2つある**ので、両方から
    // 書き戻すと型が交互に書き換わって不動点が回り続ける（実際 `sep` が String と Struct を
    // 300 周以上往復し、コンパイルが 85ms から 6 秒になっていた）。勝つのは後の定義である。
    if (node && node.supersededByDesugar) continue;
    if (!isDefineNode(node) || !isIdentifierNode(node.left)) continue;
    const rhs = stripImport(node.right);
    // **`名前 : 別名` も呼び先の由来である。** `g : f` と書いたとき `g 5` の呼び先は `f`
    // であり、構文から読める。`$` を挟むかどうかは持ち上げの有無の違いでしかなく、
    // 「どの定義へ行き着くか」は同じ問いである——だから同じ場所で記録する。
    //
    // これが無いと、別名越しの呼び出しは返値型も仮引数型も付かなかった（`g : f` の
    // `g 5` が `null`）。ポイントフリーの畳み込みは `add : [+]` が生成した名前への
    // 別名になるので、この穴をそのまま踏んでいた。
    if (rhs && isIdentifierNode(rhs)) {
      const b = envLookup(env, node.left.value);
      if (b && rhs.value !== node.left.value) b.aliasOf = rhs.value;
      continue;
    }
    if (!rhs || rhs.type !== "operation" || rhs.position !== "prefix" || rhs.name !== "address") continue;
    if (!isIdentifierNode(rhs.operand)) continue;
    const binding = envLookup(env, node.left.value);
    if (binding) binding.addressOf = rhs.operand.value;
  }
  // 上限は「定義の数 + 2」。各周回で少なくとも1つは束を上がるので、それ以上は回らない。
  const limit = nodes.length + 2;
  //
  // **2相で回す。** 返値型の不動点は底から単調に上がる設計だが、**仮引数の型は後から
  // 狭まる**（呼び出しサイトからの具体化）。これは単調な変化ではないので、一度上がった
  // 返値は狭まらない——再帰の枝が前の周回の値を読み、それが自分を養い続けるからである。
  //
  // `unwind : st d ?` がこれを踏んでいた。`st` は初回に既定の `Atom` で、返値が `Atom`
  // へ上がる。呼び出しサイトから `st` が `Int` へ狭まった後も `join(Atom, Int) = Atom`
  // で固定されていた。
  //
  // 1相目で仮引数の型を確定させ、返値を底へ戻して2相目を回す。2相目は最初から
  // 正しい仮引数の型で始まるので、基底ケースが決めた型がそのまま残る。
  const runFixpoint = () => {
  for (let i = 0; i < limit; i++) {
    for (const node of nodes) clearTypeAnnotations(node);
    for (const node of nodes) annotateTypes(node, env, null);
    // 返値型と仮引数型は互いに依存する（呼び先の要求が実引数の型を決め、その型が返値を
    // 決める）ので、同じ周回で両方を集める。どちらかが動いている限り回す。
    const a = collectReturns(nodes, env);
    const b = collectParamTypes(nodes, env);
    // 呼び出しサイトからの具体化も同じ不動点で回す——狭まった型が本体へ伝わり、
    // その本体が別の関数を呼んでいれば、そこでも狭まる。
    const c = collectCallsiteParamTypes(nodes, env);
    // カーソルの pullers は呼び出しサイトを持たない（引く命令が Pass 4 で跳ぶだけ）。
    // 型を決めているのはカーソルの側なので、同じ不動点で種を撒く。
    const d = seedCursorPullers(nodes, env);
    if (!a && !b && !c && !d) break;
  }
  };
  runFixpoint();
  // 返値だけを底へ戻して、確定した仮引数の型で回し直す。
  for (const node of nodes) {
    // 糖衣が置き換えた元の定義は見ない。**同じ名前の束縛が2つある**ので、両方から
    // 書き戻すと型が交互に書き換わって不動点が回り続ける（実際 `sep` が String と Struct を
    // 300 周以上往復し、コンパイルが 85ms から 6 秒になっていた）。勝つのは後の定義である。
    if (node && node.supersededByDesugar) continue;
    if (!isDefineNode(node) || !isIdentifierNode(node.left)) continue;
    const b2 = envLookup(env, node.left.value);
    if (b2 && b2.returns !== undefined) {
      b2.returns = "Unit";
      // 底へ戻したのだから、これは答えではなく種である——印も立て直す。
      b2.returnsSeeded = true;
    }
  }
  runFixpoint();

  // **完全性公理が働かない仮引数を名指しする。**
  //
  // `s : __` は「省略されうる」の宣言であると同時に、その引数について完全性公理を
  // 止めるという宣言でもある——`__` を受けても本体が走る。型には出せない
  // （`T | Unit` は `T` へ吸収される。niche が T の表現の中にあるので機械の上では
  // 同じ幅であり、その吸収は正しい）ので、性質として報告する。
  //
  // **誤りではない。** 完全性公理が与える終端は答えが必ず `__` になるので、終端に仕事が
  // あるときは公理を止めるしかない（`preprocess.sn` の `walk` は残ったインデントを
  // 閉じる）。代償は、正当な「空」と失敗して `__` に落ちた値を区別できなくなること
  // である（`function_guide.md` の状態ベクタの節）。だから information に留める。
  for (const node of nodes) {
    // 糖衣が置き換えた元の定義は見ない。**同じ名前の束縛が2つある**ので、両方から
    // 書き戻すと型が交互に書き換わって不動点が回り続ける（実際 `sep` が String と Struct を
    // 300 周以上往復し、コンパイルが 85ms から 6 秒になっていた）。勝つのは後の定義である。
    if (node && node.supersededByDesugar) continue;
    if (!isDefineNode(node) || !isIdentifierNode(node.left)) continue;
    const rhs = node.right;
    if (!rhs || rhs.type !== "operation" || rhs.name !== "lambda") continue;
    const pn = rhs.left;
    if (!pn || pn.type !== "params") continue;
    for (const e of pn.entries || []) {
      if (!e.name || !e.default) continue;
      if (!(e.default.type === "atom" && e.default.kind === "unit")) continue;
      const b = rhs.scope ? envLookup(rhs.scope, e.name) : null;
      diagnostics.push({
        level: "information",
        reason: "lifted-domain",
        spec: "function_guide.md 「仮引数リストは関数の状態ベクタである」",
        message:
          `${String(node.left.value).replace(/^<|>$/g, "")} の仮引数 ${String(e.name).replace(/^<|>$/g, "")} は定義域が __ まで持ち上がっています` +
          `（デフォルトが __ なので完全性公理が働かず、__ を受けても本体が走ります${b && b.atomType ? `。型は ${b.atomType}` : ""}）。` +
          `以降その関数は、正当な「空」と失敗して __ に落ちた値を区別できません。` +
          `終端に仕事があるなら、公理を止めるのではなく仕事を高階関数で渡し、崩壊を | で受けてください` +
          `（\`(f k rest st') | (@k st)\`）`,
      });
    }
  }

  // **上がらなかった種は答えではない。** 不動点が一度も本体から型を読めなかった関数は
  // 「何も返さない」のではなく「まだ分からない」のである。底を置いたまま報告すると、
  // `f : [x ~xs] ? xs` が `Unit` を返すと言い張りながら値はリストを返す——型と値が
  // 食い違う。分からないことを「分かった」と書かないのが `.st` の原則であり（§1）、
  // 「無い」と断じないのが原理4 の線引きである。
  for (const node of nodes) {
    // 糖衣が置き換えた元の定義は見ない。**同じ名前の束縛が2つある**ので、両方から
    // 書き戻すと型が交互に書き換わって不動点が回り続ける（実際 `sep` が String と Struct を
    // 300 周以上往復し、コンパイルが 85ms から 6 秒になっていた）。勝つのは後の定義である。
    if (node && node.supersededByDesugar) continue;
    if (!isDefineNode(node) || !isIdentifierNode(node.left)) continue;
    const binding = envLookup(env, node.left.value);
    if (binding && binding.returnsSeeded) binding.returns = null;
  }
  // 診断は確定後の1回だけ集める（周回ごとに集めると重複する）。
  for (const node of nodes) clearTypeAnnotations(node);
  for (const node of nodes) annotateTypes(node, env, diagnostics);
  if (diagnostics) collectCompositionMismatch(nodes, env, diagnostics);
  if (diagnostics) collectPolymorphicIndex(nodes, diagnostics);
  return nodes;
}


/**
 * layer による使用可能リテラル型の門番（option_ms_schema.md §4、type_system.md §2）。
 *
 * layer は単なるビルド設定ではなく**コンパイル時の使用可能機能セットの宣言**であり
 * （build_system.md）、違反はコンパイルエラーとして報告される。`layer: 0` は RAM も FPU も
 * 未初期化の段階なので、そこに `3.14` と書けてしまうと **FPU が初期化される前に浮動小数点
 * 命令を出す**ことになる。これは静的に決定可能な違反なので、原理4 に従って弾く。
 *
 * 見るのは**リテラルの型**であって式の型ではない。昇格でその型になった式（`x + 1.0` が
 * Float になる等）は、元をたどれば必ずどこかにリテラルが在るので、リテラルの位置で
 * 止めた方が誤りの在り処が正確に指せる。
 */
const LITERAL_MIN_LAYER = { Float: 2, Vector: 3 };

// その layer で何が使えないのかを、機能の名前で言う（数字だけでは何が足りないか読めない）。
const LAYER_FEATURE = { 2: "FPU", 3: "SIMD" };

/**
 * `charset` に収まらない文字を名指しする（option_ms_schema.md §4.2）。
 *
 * `charset : `ascii`` は Char 1個を1バイトとすると決めることであり、そこへ U+0080 以上を
 * 書けば**収まらない**。黙って下位バイトへ落とすと、書いた文字と出る文字が違うという
 * 一番たちの悪い壊れ方をするので、名指しして止める。
 *
 * layer の門番と同じ形である——`option.ms` を読まない経路（テスト・playground の素の
 * 評価）では検査しない。
 *
 * **コメントは検査しない。** Sign のコメントはバッククォート文字列そのものなので AST に
 * 残るが（guide/string_and_comment.md）、値として使われない以上 `.rodata` にも命令にも
 * ならない。日本語で書いたコメントが `charset : `ascii`` を落とすのは、書いた文字と出る
 * 文字が違うという本来の危険とは何の関係も無い。
 */
function checkCharsetConstraints(nodes, charset) {
  const limit = charset === "ascii" ? 0x7f : 0x10ffff;
  const seen = new Set();
  const visit = (node) => {
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    if (node.type === "atom" && (node.kind === "char" || node.kind === "string" || node.kind === "unicode")) {
      const text =
        node.kind === "unicode"
          ? String.fromCodePoint(parseInt(literalDigits(node.value), 16) || 1)
          : node.kind === "char"
            ? node.value.slice(1)
            : node.value.slice(1, -1);
      for (const ch of text) {
        const cp = ch.codePointAt(0);
        if (cp > limit) {
          throw new OperationError(
            `charset: ${charset} に収まらない文字です（U+${cp.toString(16).toUpperCase().padStart(4, "0")} '${ch}'）。` +
              `option.ms の charset を utf32 にするか、この文字を使わないでください`,
            { spec: "option_ms_schema.md §4.2", reason: "char-above-charset" }
          );
        }
      }
    }
    for (const k of ["left", "right", "operand", "middle"]) visit(node[k]);
    for (const l of node.lines || []) visit(l);
    for (const e of node.entries || []) visit(e.default);
  };
  for (const n of nodes) {
    if (isBareComment(n)) continue;
    visit(n);
  }
}

/**
 * 値として使われない裸の文字列リテラル——すなわちコメント（guide/string_and_comment.md）。
 *
 * **Pass 4 も同じ判定でここを読み飛ばす。** 判定を1箇所に置くのは、食い違うと
 * 「charset の検査は通ったのに `.rodata` へ出る」（またはその逆）が起きるからである。
 */
function isBareComment(node) {
  return !!node && node.type === "atom" && node.kind === "string";
}

function checkLayerConstraints(nodes, layer) {
	if (!Number.isInteger(layer)) return;
	const seen = new Set();
	function visit(node) {
		if (!node || typeof node !== "object" || seen.has(node)) return;
		seen.add(node);
		// **リテラルだけを見る。** 識別子は除く——`x : 3.14` では `x` にも Float が付くが、
		// それは 3.14 が Float であることの帰結であって違反の在り処ではない。値が書かれて
		// いる場所を指した方が直せる。`Vector` はリテラル1個ではなく並びが作るので、
		// atom でなくても型で拾う。
		const isLiteral = node.type === "atom" && node.kind !== "identifier" && node.kind !== "hole";
		if (node.atomType && (isLiteral || node.atomType === "Vector")) {
			const need = LITERAL_MIN_LAYER[node.atomType];
			if (need !== undefined && layer < need) {
				throw new OperationError(
					`layer: ${layer} では ${node.atomType} を使えません` +
						(node.value !== undefined ? `（${node.value}）` : "") +
						`（${LAYER_FEATURE[need]} は layer: ${need} 以上で有効）。` +
						`option.ms の layer を ${need} 以上にするか、この値を整数で書いてください`,
					{ spec: "option_ms_schema.md §4", reason: "literal-above-layer" }
				);
			}
		}
		for (const k of ["left", "right", "operand", "middle"]) visit(node[k]);
		for (const line of node.lines || []) visit(line);
		for (const e of node.entries || []) visit(e.default);
	}
	for (const node of nodes) visit(node);
}

export { IDENTITY, inferAtomType, annotateTypes, annotateAll, inferLambdaParamTypes, inferParamTypesFromUsage, checkLayerConstraints, checkCharsetConstraints, isBareComment, pointfreeSignature };
