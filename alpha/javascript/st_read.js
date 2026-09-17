/**
 * `.st`（SignType）を**読む**側。テキスト → `.sn` のテキスト ＋ 診断。
 *
 * `.st` は長らく誰にも読まれていなかった（`generateSignType` の呼び手は playground と
 * 検査だけで、ディスクへ書く人も居ない）。`import` はコンパイル時にソースを読んで
 * 合流させている（`compile.js` の `resolveImports`）——つまり成果物ではなくソースが
 * 依存の実体だった。ここはその逆側、**成果物だけで合流できるようにする**ための入口である。
 *
 * ## 白名簿式であること（`__` で埋めない）
 *
 * 知らない型の綴り・`_`（未解決）・`->`（関数）は**名指しで断る**。
 * 雛形では既定値（`Int` なら `0`）で埋めていたが、それだと**道が無い所が永久に緑になる**
 * ——診断0件で命令は出て、値だけが違う（黙った誤答）。実測では `operator_table.sn` を
 * 型だけの `.st` から起こすと 824 行 → 156 行、`.ascii` が 85 本消えたまま**通った**。
 *
 * 起こせるのは「葉に値が載っている」ものだけである:
 *
 * | 綴り | 起こす |
 * |---|---|
 * | `Int=1` / `Float=3.14` / `Address=0x40011000` / `Char=\d` / `Unit=__` | 字面そのまま |
 * | ``String=`abc` `` | 字面そのまま（既にバッククォートで囲まれている） |
 * | ``Struct{`k` : … , 0  …}`` | 連番の順に並べ直して字下げブロックで書く |
 * | `Struct(T T …)` | `,` で並べる |
 *
 * 断るのは4つの形である: 関数（`->`）・穴（`_`）・器（`List(T)` / `Iterator(T)` /
 * `Implicit(T)`）・知らない綴り。値の載っていない葉（`Int` だけ）も同じく断る
 * ——「型は分かるが値が分からない」は、起こす側から見れば道が無いのと同じである。
 *
 * ## 割れ方が一意であること
 *
 * `st.js` は**スロットの鍵を必ずバッククォートで囲み**、String の値も字面のまま
 * （＝囲まれたまま）書く。`sign.pegjs` の `string` 規則（`` "`" [^`\r\n]* "`" ``）が
 * 中にバッククォートも改行も許さないので、「`` ` `` から次の `` ` `` まで」に例外が無い。
 * Char は `\` の直後1文字（`charactor = "\\" [^\r]`）。だから値や鍵が区切り
 * （2スペース / `,` / `}`）を含んでも、読む側はそこを飛ばせる。
 */

/** 起こせる葉の型。ここに無い綴りは**全部断る**（白名簿）。 */
const LEAF_TYPES = new Set(["Int", "Float", "Address", "Char", "String", "Unit"]);
/** 中身を持つ器の綴り。要素の実体が `.st` に無いので起こせない（名指しで断るために持つ）。 */
const CONTAINER_TYPES = new Set(["List", "Iterator", "Implicit"]);
/**
 * 綴りは知っているが、値が1つに決まらない型。**「知らない」と言うのは嘘になる**
 * ——族（`Atom` / `Scalar`）は呼び出しサイトで具体化されるまでの暫定形であり、
 * `Struct` 単体はスロットが書かれなかった印である。断る理由を取り違えないために分ける。
 */
const FAMILY_TYPES = new Set(["Atom", "Scalar", "Container", "Raw", "Struct", "Lambda"]);

/**
 * 読めなかったことを、**場所と綴りごと**運ぶ。
 *
 * 場所（`where`）は `infix ' + ' tier` のようなスロットの道である。名前だけで断ると
 * 「`operator_table` が読めません」としか言えず、14エントリのうちどの葉が欠けているのか
 * 探す所からになる。綴り（`spelling`）は原文のまま——要約すると、直す手掛かりが消える。
 */
class StRefusal extends Error {
  constructor(reason, spelling, where) {
    super(reason);
    this.reason = reason;
    this.spelling = spelling;
    this.where = where;
  }
}

const refuse = (reason, spelling, where) => {
  throw new StRefusal(reason, spelling, where);
};

/** 走査位置を1つだけ持つ読み取り器。型の綴りは入れ子になるので再帰で降りる。 */
class Cursor {
  constructor(text) {
    this.s = text;
    this.i = 0;
  }
  rest() {
    return this.s.slice(this.i);
  }
  at(lit) {
    return this.s.startsWith(lit, this.i);
  }
  eat(lit) {
    if (!this.at(lit)) return false;
    this.i += lit.length;
    return true;
  }
  expect(lit, spelling, where) {
    if (!this.eat(lit)) refuse(`\`${lit}\` があるはずの所が読めません`, spelling, where);
  }
}

/**
 * 値の字面を1つ読む。**ソースの字面をそのまま**返す（`.sn` へはそのまま書ける）。
 *
 * バッククォートで始まれば次のバッククォートまで、`\` で始まればその次の1文字まで
 * ——どちらも中身に区切りが入りうるので、ここだけが唯一の飛ばし方である。
 */
function readValue(cur, spelling, where) {
  const s = cur.s;
  if (s[cur.i] === "`") {
    const end = s.indexOf("`", cur.i + 1);
    if (end < 0) refuse("閉じていない文字列です", spelling, where);
    const v = s.slice(cur.i, end + 1);
    cur.i = end + 1;
    return v;
  }
  if (s[cur.i] === "\\") {
    if (cur.i + 1 >= s.length) refuse("`\\` の後に文字がありません", spelling, where);
    const v = s.slice(cur.i, cur.i + 2);
    cur.i += 2;
    return v;
  }
  // 数・番地・レジスタ・ユニコード・`__`。区切り（空白 / `,` / `}` / `)`）を含まない綴り。
  const m = /^[-0-9A-Za-z._]+/.exec(cur.rest());
  if (!m) refuse("値の字面が読めません", spelling, where);
  cur.i += m[0].length;
  return m[0];
}

/** 型の綴りを1つ読み、起こした `.sn` の式を返す。`indent` は入れ子ブロックの字下げ。 */
function readType(cur, indent, where) {
  if (cur.at("Struct{")) return readNamedStruct(cur, indent, where);
  if (cur.at("Struct(")) return readPositionalStruct(cur, indent, where);
  if (cur.at("_")) {
    cur.i += 1;
    refuse("型が決まっていません（`_`）", "_", where);
  }
  const m = /^[A-Za-z][A-Za-z0-9]*/.exec(cur.rest());
  if (!m) refuse("知らない型の綴りです", cur.rest(), where);
  const name = m[0];
  cur.i += name.length;
  if (cur.at("(")) {
    // `List(Int)` / `Implicit(Char)`。**要素の実体は `.st` に無い**——型は器だと言うが、
    // 中身が何個あってどんな値なのかは書かれていない。`__` で埋めれば通るが、通った先は
    // 空の器である（黙った誤答そのもの）。
    const close = cur.s.indexOf(")", cur.i);
    const inner = close < 0 ? cur.rest() : cur.s.slice(cur.i + 1, close);
    cur.i = close < 0 ? cur.s.length : close + 1;
    const spelling = `${name}(${inner})`;
    if (CONTAINER_TYPES.has(name)) refuse("器の中身が `.st` にありません", spelling, where);
    refuse("知らない型の綴りです", spelling, where);
  }
  if (!cur.eat("=")) {
    if (CONTAINER_TYPES.has(name)) refuse("器の中身が `.st` にありません", name, where);
    if (FAMILY_TYPES.has(name)) refuse("値の決まらない型です", name, where);
    if (!LEAF_TYPES.has(name)) refuse("知らない型の綴りです", name, where);
    // 綴りは知っているが値が書かれていない。起こす側から見れば道が無いのと同じである。
    refuse("値が `.st` にありません", name, where);
  }
  if (FAMILY_TYPES.has(name)) refuse("値の決まらない型です", name, where);
  if (!LEAF_TYPES.has(name)) refuse("知らない型の綴りです", name, where);
  return { multi: false, text: readValue(cur, name, where) };
}

/** `Struct{`k` : T , 0  `k2` : T , 1}` を読む。鍵は必ずバッククォートで囲まれている。 */
function readNamedStruct(cur, indent, where) {
  cur.expect("Struct{", "Struct{", where);
  const slots = [];
  for (;;) {
    if (cur.s[cur.i] !== "`") refuse("スロットの鍵がバッククォートで囲まれていません", cur.rest().slice(0, 40), where);
    const end = cur.s.indexOf("`", cur.i + 1);
    if (end < 0) refuse("閉じていない鍵です", cur.rest().slice(0, 40), where);
    const key = cur.s.slice(cur.i + 1, end);
    cur.i = end + 1;
    const at = `${where} ' ${key}`;
    cur.expect(" : ", key, at);
    const value = readType(cur, indent + "\t", at);
    cur.expect(" , ", key, at);
    const ord = /^-?[0-9]+/.exec(cur.rest());
    if (!ord) refuse("スロットの連番が読めません", key, at);
    cur.i += ord[0].length;
    slots.push({ key, ordinal: Number(ord[0]), value });
    if (cur.eat("  ")) continue;
    cur.expect("}", key, at);
    break;
  }
  // **`.st` の並びは名前順（物理配置）で、宣言順は連番が言う。** 起こすときは宣言順へ
  // 並べ直す——そうしないと `p : [x y]` と `p : [y x]` が同じ字面になり、ねじれが消える。
  slots.sort((a, b) => a.ordinal - b.ordinal);
  const lines = slots.map((s) =>
    s.value.multi ? `${indent}\`${s.key}\` :\n${s.value.text}` : `${indent}\`${s.key}\` : ${s.value.text}`
  );
  return { multi: true, text: lines.join("\n") };
}

/** `Struct(Int=1 String=`abc` Float=2.5)` を読む。連番スロットは記法上の位置が連番である。 */
function readPositionalStruct(cur, indent, where) {
  cur.expect("Struct(", "Struct(", where);
  const parts = [];
  for (;;) {
    const at = `${where} ' ${parts.length}`;
    const v = readType(cur, indent + "\t", at);
    if (v.multi) refuse("連番スロットの中に名前付きの器があります", "Struct(...)", at);
    parts.push(v.text);
    if (cur.eat(" ")) continue;
    cur.expect(")", "Struct(...)", at);
    break;
  }
  return { multi: false, text: parts.join(" , ") };
}

/**
 * 値の中ではない所に `->` があるか。**字面の検索では足りない**——`` String=`a -> b` `` の
 * ような値が関数に化ける。文字列は次のバッククォートまで、`\` は次の1文字まで飛ばす。
 */
function hasTopLevelArrow(s) {
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "`") {
      const e = s.indexOf("`", i + 1);
      if (e < 0) return false;
      i = e;
      continue;
    }
    if (s[i] === "\\") {
      i += 1;
      continue;
    }
    if (s.startsWith(" -> ", i)) return true;
  }
  return false;
}

/** 1行分の型の綴りを起こす。読み切れなければ、その理由を名指しで返す。 */
function readWholeType(typeText, where) {
  // 関数のシグネチャ（`Int -> Int` / `Int Int -> Int` / `[acc~] -> List`）は先に断る。
  // **本体は `.st` に無い**——型だけで関数は起こせない。先に見ないと `Int -> Int` が
  // 「値が `.st` にありません: Int」になり、断りの理由が本当の理由とずれる。
  if (hasTopLevelArrow(typeText)) refuse("関数の本体が `.st` にありません", typeText, where);
  const cur = new Cursor(typeText);
  const v = readType(cur, "\t", where);
  if (cur.i !== typeText.length) refuse("型の綴りを読み切れません", typeText, where);
  return v;
}

/**
 * `.st` のテキストを `.sn` のテキストへ起こす。
 *
 * @param {string} stText
 * @param {{ path?: string }} [options] 診断に書く出どころ
 * @returns {{ text: string, diagnostics: string[] }}
 *   diagnostics が空でなければ**起こせていない**。呼ぶ側は止めること。
 */
function readSignType(stText, options = {}) {
  const at = options.path ? `${options.path}: ` : "";
  const out = [];
  const diagnostics = [];
  for (const raw of String(stText).split(/\r?\n/)) {
    const line = raw.replace(/\r$/, "");
    // 空行と、行頭バッククォートのコメント（`.st` のヘッダ）は飛ばす。
    if (line === "" || line.startsWith("`")) continue;
    // `$` を名前に含める。**`.ist` の具体化名**（`drop_while$is_space`）がこの形で、
    // 弾くと「行が読めません」になって**断る理由を取り違える**——本当の理由は
    // 「関数の本体が `.st` にありません」である（実測: lexer.ist は9件中5件がこれだった）。
    // このファイル自身が「断る理由を分ける」と書いている所なので、分け損ねを直す。
    const m = /^(#{1,3})?([A-Za-z_][A-Za-z0-9_$]*) : ([\s\S]+)$/.exec(line);
    if (!m) {
      diagnostics.push(`${at}\`.st\` の行が読めません: ${line}`);
      continue;
    }
    const [, mark, name, typeText] = m;
    try {
      const v = readWholeType(typeText, name);
      out.push(v.multi ? `${mark || ""}${name} :\n${v.text}` : `${mark || ""}${name} : ${v.text}`);
    } catch (e) {
      if (!(e instanceof StRefusal)) throw e;
      // **名指しで断る。** どの識別子の・どのスロットの・どの綴りが、なぜ起こせないのかを
      // 全部書く——下流（pass4）に「まだ出せない識別子です」と言わせるのでは遅い。そこまで
      // 行ってしまう綴りもあるし、行かない綴り（値の無い葉）は黙って通る。
      diagnostics.push(`${at}\`.st\` から起こせません（${e.reason}: ${e.spelling}）: ${e.where || name}`);
    }
  }
  return { text: out.length > 0 ? out.join("\n") + "\n" : "", diagnostics };
}

export { readSignType, LEAF_TYPES, CONTAINER_TYPES };
