/**
 * コンパイルパイプラインの単一ドライバ（compiler_pipeline.md §3 のフロントエンド Pass 1〜3）。
 *
 * これまで各テスト・playgroundが同じ手順（preprocess → parse → buildEnv → reduceAll）を
 * それぞれコピーして持っており、pass1b と pass3 はどこからも呼ばれていなかった
 * （型を出しても消費者が存在しない状態）。ここに一本化する。
 *
 *   1. preprocess   lexer.js       前処理（separateInfix + markBlock）
 *   2. parse        parser.js      フラットなTerm列（sign.pegjs から生成）
 *   3. buildEnv     pass1.js       Pass 1a: 識別子テーブル（Layer 1 カテゴリ・アリティ）
 *   4. reduceAll    pass2.js       Pass 2: 余積の解決 → 二分木AST
 *   5. specialize   pass1b.js      Pass 1b: ジェネリック仮引数（@ref）の具体化
 *   6. annotate     pass3.js       Pass 3: Layer 2 型を全ノードへ注釈
 *
 * 【Passの順序が type_system.md §5 と食い違っている点】
 * §5 は Pass 1a → Pass 1b → Pass 2 → Pass 3 の順を書いており、呼び出しサイトの収集も
 * 「Pass 1a と同じ線形スキャンで記録する」としている。しかし実装では Pass 1b は Pass 2 の
 * **後**に走る。理由は、呼び出しサイトが何であるかは Pass 2 が余積（スペース）を
 * apply/compose/concat のどれに解決するかを決めるまで確定しないためである——
 * トークン列の段階では `f x` が関数適用なのかリスト構築なのか判定できない。
 * これは B-1（§5 Pass 1a の擬似コード）・B-3（§3.2 の左辺優先ルール）と同じ
 * 「§5 の記述が実装より単純化されている」系の食い違いであり、仕様側の修正候補。
 */

import { preprocess } from "./lexer.js";
import { parse } from "./parser.js";
import { buildEnv, bindEnv, envLookup, EXPORT_MARKERS } from "./pass1.js";
import { reduceAll, desugarIndexRest } from "./pass2.js";
import { specializeGenericParams } from "./pass1b.js";
import { annotateAll, checkLayerConstraints, checkCharsetConstraints } from "./pass3.js";
import { findStreamFunctions, generatePullers, groupStreamFunctions, CURSOR_SUFFIXES } from "./stream_desugar.js";

function isIdentifierNode(n) {
  return !!n && n.type === "atom" && n.kind === "identifier";
}

function isDefineNode(n) {
  return !!n && n.type === "operation" && n.name === "define";
}

// Pass 1b: トップレベルの各ラムダ定義について、ジェネリック仮引数（本体で `@` が
// 直接かかっている仮引数）を呼び出しサイトの実引数カテゴリで具体化する。
// 対象が無ければ空のMapが返るだけなので、ジェネリックを含まないプログラムでは実質no-op。
function runPass1b(nodes, env) {
  const specializations = new Map();
  for (const node of nodes) {
    if (!isDefineNode(node) || !node.right || node.right.name !== "lambda") continue;
    const result = specializeGenericParams(node, nodes, env);
    if (result.size > 0) specializations.set(node.left.value, result);
  }
  return specializations;
}

/**
 * ソースを Pass 1〜3 に通し、型注釈済みのASTを返す。
 *
 * @param source Sign のソース文字列
 * @param options.parse パーサーの差し替え（省略時はビルド済みの `parser.js`）。
 *   テストは `sign.pegjs`（正式仕様）から peggy で都度ビルドしたパーサーを渡す——
 *   `parser.js` は `npm run build:parser` の成果物であり、実際に一度8/4時点で
 *   止まったまま `sign.pegjs` の修正が反映されていなかったことがあるため、
 *   テストが文法ソースを直接検証する性質は保つ必要がある。
 * @returns {{ nodes, env, specializations, diagnostics }}
 *   nodes           行ごとの型注釈済みAST（各ノードに `atomType` が載る）
 *   env             Pass 1a の識別子テーブル（.ist 相当、プロセス内メモリのみ）
 *   specializations Pass 1b の具体化結果 Map<関数名, Map<仮引数名, {callsiteCount, categories}>>
 *   diagnostics     コンパイル時に検出した診断（Pass 3b の Unit 収束理由など。現状は空）
 */
// 縮約しきれずに残った式（pass2 が `{type:"unresolved"}` として返したもの）を探す。
// pass2 側のコメントが言う通りこれは「未対応の演算子等」であり、静的に判定できる
// 構文の誤りである。原理4（静的に決定可能な違反は自己責任に丸投げせず弾く）に従って
// ここで止める——以前はどこにも消費されず、評価時に静かに無視されていたため、
// `[5 !] 1` が 1 を返すなど、解決できていない式が無言で別の値になっていた。
function findUnresolved(node) {
  if (!node || typeof node !== "object") return null;
  if (node.type === "unresolved") return node;
  for (const key of ["left", "right", "operand"]) {
    const found = findUnresolved(node[key]);
    if (found) return found;
  }
  if (Array.isArray(node.lines)) {
    for (const line of node.lines) {
      const found = findUnresolved(line);
      if (found) return found;
    }
  }
  return null;
}

function describeUnresolved(node) {
  return node.items
    .map((x) => (typeof x === "string" ? x : x && x.type === "atom" ? x.value : "(式)"))
    .join(" ");
}

/**
 * 糖衣が置き換えた定義に印を付ける。同じ名前が2回出てくるので、**後ろがカーソルの入口**、
 * 前は元の関数である。元は AST に残す——インタプリタは元の形をそのまま走らせられるし、
 * 「均した先が同じ列になるか」はそれと突き合わせて初めて言える。
 */
function markCursorEntries(nodes, entries, superseded, group) {
  const names = new Set(entries);
  const dead = new Set(superseded);
  const last = new Map();
  const advName = group ? group + CURSOR_SUFFIXES.adv : null;
  let adv = null;
  for (const node of nodes) {
    if (!node || node.type !== "operation" || node.name !== "define") continue;
    const id = node.left;
    if (!id || id.type !== "atom" || id.kind !== "identifier") continue;
    const raw = String(id.value).replace(/^<|>$/g, "");
    if (names.has(raw)) last.set(raw, node);
    if (raw === advName) adv = node;
  }
  // `isEntry` は「元の名前」だけ。**入口は捕まえた入力を仮引数に持つ**ので、pullers の
  // 署名の種はそこから撒ける（pass3 の `seedCursorPullers`）。`_adv` はカーソルを返すが
  // 入口ではない——第1仮引数は枝番号であって入力ではないので、混ぜると種が間違う。
  const markBody = (node, raw, isEntry) => {
    if (!node.right || node.right.type !== "operation" || node.right.name !== "lambda") return;
    if (isEntry) node.right.cursorEntry = true;
    else node.right.cursorReturns = true;
    node.right.cursorGroup = raw;
    // 本体（`(arm s) , 0 , s`）にも印を付ける。積に見えるが、置かれるのは
    // `{arm, k, 入力}` の3つ組であってメモリ上の並びではない。分岐の場合は枝それぞれ。
    const body = node.right.right;
    if (!body) return;
    const arms = Array.isArray(body.lines) ? body.lines : [body];
    for (const line of arms) {
      const v = line && line.type === "operation" && line.name === "define" ? line.right : line;
      if (v) v.cursorGroup = raw;
    }
    // 分岐そのものにも印を付ける。どの枝もカーソルを返すので、合流した結果もカーソルである。
    body.cursorGroup = raw;
  };
  for (const [raw, node] of last) markBody(node, raw, true);
  // 進めた結果もカーソルである（`<g>_adv`）。枝はどちらも3つ組を返す。
  if (adv) markBody(adv, group, false);
  // 元の定義（同じ名前の、入口ではない方）は機械語を出さない。糖衣が置き換えたものを
  // もう一度出しても、同じ列を2通りに出すだけである。
  for (const node of nodes) {
    if (!node || node.type !== "operation" || node.name !== "define") continue;
    const id = node.left;
    if (!id || id.type !== "atom" || id.kind !== "identifier") continue;
    const raw = String(id.value).replace(/^<|>$/g, "");
    if (dead.has(raw) && last.get(raw) !== node) node.supersededByDesugar = true;
  }
}

/**
 * **インポートはコンパイル時に解ける**（build_system.md §4.2）。
 *
 * `` `lib/x.sn`@~ `` は「そのファイルを読んで（`@`）、束縛をここへ撒く（`~`）」であり、
 * 後置演算子2つの意味そのままである。専用の構文は要らないし、走らせる側には何も残らない
 * ——読むのはビルド時である（Zig の `@import` と同じ立場で、layer 4 の話ではない）。
 *
 * 解くのは**行の段階**である。ここがまだ「ファイルが1つに見えている」最後の場所であり、
 * 以降のパスは `lines` しか見ない——束縛表もそこから作るので、撒いた先の名前が普通に引ける。
 */
function importPathOf(line) {
  // `[text, "_@", "_~"]` の形だけがインポートである。`@` だけ（撒かない）は「そのファイルの
  // 値を1つ読む」であって、束縛を並べる話ではない。裸のテキスト1つはコメントである。
  if (!Array.isArray(line) || line.length !== 3) return null;
  const [t, at, spread] = line;
  if (at !== "_@" || spread !== "_~") return null;
  if (typeof t !== "string" || t.length < 2 || t[0] !== "`" || t[t.length - 1] !== "`") return null;
  return t.slice(1, -1);
}

/** その行は束縛か。撒くのは**束縛**であって、そのファイルの実行例ではない。 */
function definedNameOf(line) {
  if (!Array.isArray(line)) return null;
  const at = typeof line[0] === "string" && EXPORT_MARKERS[line[0]] ? 1 : 0;
  const id = line[at];
  if (typeof id !== "string" || id[0] !== "<" || id[id.length - 1] !== ">") return null;
  return line[at + 1] === ":" ? { name: id, exported: at > 0 } : null;
}

function dirOf(path) {
  const n = normPath(path);
  const i = n.lastIndexOf("/");
  return i < 0 ? "" : n.slice(0, i);
}

/** 区切りは `/` に均す（Windows の区切りも同じ意味である）。 */
const normPath = (x) => String(x).split(String.fromCharCode(92)).join("/");

function joinPath(base, rel) {
  const r = normPath(rel);
  const drive = r.length > 2 && r[1] === ":" && r[2] === "/";
  const raw2 = r.startsWith("/") || drive ? r : (base ? normPath(base) + "/" : "") + r;
  const abs = raw2.startsWith("/");
  const seg = [];
  for (const x of raw2.split("/")) {
    if (x === "" || x === ".") continue;
    if (x === "..") { seg.pop(); continue; }
    seg.push(x);
  }
  return (abs ? "/" : "") + seg.join("/");
}

function resolveImports(lines, options, parseFn, base, state) {
  const out = [];
  for (const line of lines) {
    const rel = importPathOf(line);
    if (rel === null) { out.push(line); continue; }
    if (!options.readImport)
      throw new SyntaxError(`インポートを解決する手段がありません（${rel}——compile に readImport を渡してください）`);
    const full = joinPath(base, rel);
    // **同じファイルは一度だけ撒く。** 2つのモジュールが同じものを読んでいても定義が2つに
    // なってはいけない——後の定義が勝つので、黙って別物になる。
    if (state.done.has(full)) continue;
    // **循環は通してよい。** 同じファイルは一度しか撒かないので、定義はそれぞれ1つに
    // なる。トップレベルの定義は順序に依らない（`buildEnv` が先に全部集める）ので、
    // 循環するインポートは**ファイルを跨いだ相互再帰**でしかない——`sep` と `in_quote` が
    // 同じファイルで呼び合えるのと同じ話であり、断る理由が無い（原理4）。
    let src;
    try { src = options.readImport(full); } catch { throw new SyntaxError(`インポートが読めません: ${full}`); }
    state.done.add(full);
    // **撒くのは束縛だけである。** モジュールの末尾にある実行例まで持ってくると、
    // 最後の式が入れ替わる——`_sign_main` が返すのはそれなので、黙って別の値になる。
    const inner = resolveImports(parseFn(preprocess(src)), options, parseFn, dirOf(full), state);
    for (const l of inner) if (definedNameOf(l)) out.push(l);
  }
  return out;
}

function compile(source, options = {}) {
  const parseFn = options.parse || parse;
  // **入口のファイル自身も「撒き済み」として数える。** 循環したときに入口が自分を撒き直し、
  // 同じ定義が2つになる——後の定義が勝つので、黙って別物になりうる。
  const selfPath = options.sourcePath ? joinPath("", options.sourcePath) : null;
  const lines = resolveImports(
    parseFn(preprocess(source)),
    options,
    parseFn,
    options.importBase !== undefined ? options.importBase : selfPath ? dirOf(selfPath) : "",
    { done: new Set(selfPath ? [selfPath] : []) }
  );
  const env = buildEnv(lines);
  // 添字位置の `N~` を終端の無いレンジへ均す（糖衣）。**後置 `~` の意味を「撒く」
  // 1つに絞るための書き換え**であり、逆適用（`x f`）と同じ扱いである——記号は残し、
  // 意味論からは消す。Pass 2 の出口でやるのは、ここが「構文の形が最後に見える場所」
  // だからである（Pass 3 以降は型の話しかしない）。
  const nodes = lines.map((line) => desugarIndexRest(reduceAll(line, env)));
  for (const node of nodes) synthesizePointfreeIn(node, env);

  // **並べた相手は、ここで畳み終える。** 個数が構文から見えているなら関数も器も要らない
  // ——`construct` の連鎖が既に左畳みの括弧の形をしている。残った（相手が実行時の器の）
  // 形だけが、下の合成へ回る。
  expandGreedyFoldsIn(nodes, env);

  // **貪欲な畳み込みへ名前と本体を与える。** `[+]` は残りアリティ2なので受け口1つの
  // 合成には収まらない——トップレベルへ持ち上げてから、その場の `[+]` を名前へ差し替える。
  if (!options.__pfFolded) {
    const folds = collectGreedyFolds(nodes);
    if (folds.length > 0) {
      // **前に置く。** ストリームの糖衣は元の名前を上書きするので後ろだったが、畳み込みは
      // 新しい名前を足すだけなので、使う場所より先に定義が要る。元の最後の式が最後のまま
      // 残る、という点でも前置きが正しい——`_sign_main` はそれを返す。
      return compile([...folds, source].join("\n"), { ...options, __pfFolded: true });
    }
  } else {
    replaceGreedyFolds(nodes);
  }
  // 木を1つにするのは、ポイントフリーが名前へ変わった**後**である。
  gatherBracketArgs(nodes, env);
  for (const node of nodes) {
    const bad = findUnresolved(node);
    if (bad) {
      throw new SyntaxError(
        `解決できない式です: ${describeUnresolved(bad)}` +
          `（演算子の位置・空白の付け方を確認してください。中置演算子は空白で区切り、` +
          `前置・後置演算子は対象値に密着させます）`
      );
    }
  }
  // **ストリームを返す関数を、引ける規則へ均す**（糖衣、stream_desugar.js）。
  //
  // 生成するのは Sign のソースなので、ここでソースを足して**もう一度同じ道を通す**。
  // 手で書いたコードと同じパイプラインを通るので、生成側だけが通る抜け道が生まれない。
  // 元の名前はカーソルの入口として再定義され（後の定義が勝つ）、Pass 4 は元を飛ばす。
  //
  // 既定では走らせない。均すと `sep s` が列ではなくカーソルを返すようになるので、
  // 消費側もカーソルを引ける必要がある——それが揃うまでは、頼まれたときだけ動かす。
  // 均した先の入口に印を付ける。**同じ名前が2回定義されている**ので、後の方（生成側）が
  // カーソルの入口で、前の方（元の関数）は Pass 4 が飛ばす対象である。
  for (const g of options.__cursorGroups || []) markCursorEntries(nodes, g.entries, g.entries, g.group);
  const specializations = runPass1b(nodes, env);
  // **鍵が増えるマージのぶんまで、器の並びを先に決める。**
  //
  // `p~ [ zzz : 1 ]~` は p の器へ入れる形だが鍵が1本増える。増える鍵が `aa` なら名前順
  // なので既存のスロットが全部ずれるので、少しずつ伸ばす手は無い——全プログラムを見る
  // のだから、和集合はコンパイル時の事実として先に確定させる（layout.js）。
  //
  // **Pass 3 より前でなければならない。** Pass 3 は仮引数へ届ける並び（`binding.shape`）
  // を `layoutOfStruct` のスナップショットとして焼くので、後から和集合を足すとそこだけ
  // 古い並びが残り、`f p` の中の `this ' foo` が隣のスロットを読む。
  // Pass 3 の型注釈と Pass 3b（`__` へ収束する経路の静的記録）は同じ走査で行う。
  const diagnostics = [];
  annotateAll(nodes, env, diagnostics);
  // layer による使用可能リテラル型の門番（option_ms_schema.md §4）。型が確定した後でないと
  // 判定できないのでここに置く。`options.layer` を渡さなければ検査しない——`option.ms` を
  // 読まない経路（テスト・playground の素の評価）まで std 相当を強制しないためである。
  if (options.layer !== undefined) checkLayerConstraints(nodes, options.layer);
  // charset に収まらない文字も同じ門番で見る（option_ms_schema.md §4.2）。
  if (options.charset !== undefined) checkCharsetConstraints(nodes, options.charset);

  // **均すのは型が付いてからである。**
  //
  // 認識器は「並べるものが器か」を型で見る（器が並ぶ形は個数が固定でないので均せない）。
  // 注釈の前に走らせると `atomType` が無く、その判定が素通りする——実際 `lexer.sn` で
  // 均せないはずの形まで均し、診断が 3 件から 8 件へ増えていた。**同じ入力に対して
  // 認識器が2つの答えを出す**形であり、いつもの壊れ方である。
  //
  // 生成するのは Sign のソースなので、ここでソースを足して**もう一度同じ道を通す**。
  // 手で書いたコードと同じパイプラインを通るので、生成側だけが通る抜け道が生まれない。
  // 元の名前はカーソルの入口として再定義され（後の定義が勝つ）、Pass 4 は元を飛ばす。
  //
  // 既定では走らせない。均すと `sep s` が列ではなくカーソルを返すようになるので、
  // 消費側もカーソルを引ける必要がある——それが揃うまでは、頼まれたときだけ動かす。
  if (options.desugarStreams && !options.__desugared) {
    // **呼び合う塊ごとに均す。** 関係の無い関数を1つの群にまとめると、片方が均せない
    // ときに巻き添えになるし、引くたびに関係の無い枝まで比べることになる。
    const groups = groupStreamFunctions(findStreamFunctions(nodes)).map(generatePullers).filter(Boolean);
    if (groups.length > 0) {
      return compile(`${source}\n${groups.map((g) => g.source).join("\n")}`, {
        ...options,
        __desugared: true,
        __cursorGroups: groups.map((g) => ({ group: g.group, entries: g.entries })),
      });
    }
  }

  return { nodes, env, specializations, diagnostics };
}


/**
 * **貪欲な畳み込み（`[+]`）に名前と本体を与える。**
 *
 * 貪欲なポイントフリーにはアリティがある。`[+ 2]` は残りアリティ0（合成済み）だが、
 * `[+]` は残りアリティ2——隣り合う2つを潰していく**畳み込み**であり、器を1本走査すれば
 * 済む。書き下せば `[x ~xs] ? xs & x + (自分 xs) | x` であり、`function_guide.md` の
 * `sum_list` そのものである。
 *
 * **合成には名前が要る。** 畳み込みは自分を呼ぶので、その場に書かれた `[+]` のままでは
 * 再帰の呼び先が無い。だからトップレベルへ名前付きで持ち上げる。
 *
 * 生成するのは Sign のソースであり、足してから**同じ道をもう一度通す**（ストリームの
 * 糖衣と同じやり方）。手で書いたコードと同じパイプラインを通るので、生成側だけが通れる
 * 抜け道が生まれない——`fold [1 2 3]` が Pass 4 で出せる以上、`[+] 1 2 3` も出せる。
 */
/**
 * **ブラケット仮引数1つの関数へは、並置を器1つにまとめて渡す。**
 *
 * `f : [x ~xs] ?` に `f 1 2 3` と書いたとき、渡るのは3つの実引数ではなく器 `(1 2 3)`
 * 1つである——ブラケット仮引数は「器を分解して受ける」形だからで、`f (1 2 3)` や
 * `f [1 2 3]` と同じ木にならなければならない。
 *
 * インタプリタは適用の連鎖を辿りながら畳んでいたので答えは合っていたが、Pass 4 は
 * 連鎖をそのまま「3引数の呼び出し」として出していた。**同じ式に2つの読みがあった**
 * わけで、機械の側だけが黙って違う値を出す（`[+] 1 2 3` が 1 になる）。木を1つに
 * すれば、どちらも同じものを見る。
 *
 * まとめるのは**仮引数がブラケット1つだけ**の場合に限る。`go : acc [x ~xs]` のように
 * 前に別の仮引数が居る形は、どこから器が始まるかが位置で決まるので別の話である。
 */
function gatherBracketArgs(nodes, env) {
  const construct = (l, r) => ({ type: "operation", op: " ", name: "construct", position: "infix", left: l, right: r });
  // 名前 → ブラケット仮引数が何番目か。`entries[i].pattern` がその印である
  // （`[x ~xs]` は entries 全体が分解、`k [x ~xs]` は2つ目の entry が分解）。
  const brackets = new Map();
  for (const node of nodes) {
    if (!isDefineNode(node) || !isIdentifierNode(node.left)) continue;
    const params = node.right && node.right.name === "lambda" ? node.right.left : null;
    if (!params || !Array.isArray(params.entries)) continue;
    // **ブラケットが最後の仮引数であるときだけ。** `mul_go : acc [~ts] i` のように後ろへ
    // まだ仮引数が続く形は、どこまでが器なのかを位置から言えない——器がいくつ食うかは
    // 実引数の数で決まるので、後ろの仮引数と取り合いになる。そこは元の並びのままにする。
    if (params.bracket) {
      brackets.set(node.left.value, 0); // entries 全体が1つの分解（`[x ~xs]`）
      continue;
    }
    const at = params.entries.findIndex((e) => Array.isArray(e.pattern));
    if (at >= 0 && at === params.entries.length - 1) brackets.set(node.left.value, at);
  }
  const rewrite = (n) => {
    if (!n || n.type !== "operation" || n.name !== "apply") return n;
    const args = [];
    let head = n;
    while (head && head.type === "operation" && head.name === "apply") {
      args.unshift(head.right);
      head = head.left;
    }
    if (args.length < 2 || !head || !isIdentifierNode(head)) return n;
    const at = brackets.get(head.value);
    // ブラケット仮引数より前は普通の実引数である。まとめるのはそこから後ろだけ。
    if (at === undefined || args.length <= at + 1) return n;
    const gathered = { type: "block", kind: "paren", lines: [args.slice(at).reduce(construct)], scope: n.scope || null };
    const front = args.slice(0, at);
    return [...front, gathered].reduce(
      (f, a) => ({ type: "operation", op: " ", name: "apply", position: "infix", left: f, right: a }),
      head
    );
  };
  // **外側から降りる。** 内側の適用を先に畳むと `f 1 2 3` が `f ((1 2) 3)` になり、
  // 並べるものの中に器が現れる（要素数が実行時にしか決まらない形）。連鎖は一番外から
  // 見て初めて「実引数が何個並んでいるか」が分かる。
  const seen = new Set();
  const deep = (n) => {
    if (!n || typeof n !== "object" || seen.has(n)) return n;
    const r = rewrite(n);
    seen.add(r);
    for (const k of ["left", "right", "operand"]) if (r[k]) r[k] = deep(r[k]);
    if (Array.isArray(r.lines)) r.lines = r.lines.map(deep);
    for (const e of r.entries || []) if (e.default) e.default = deep(e.default);
    return r;
  };
  for (let i = 0; i < nodes.length; i++) nodes[i] = deep(nodes[i]);
}

/**
 * 畳み込みの本体を Sign のソースとして書き下す。
 *
 * **左から畳む。** 貪欲な連鎖は隣り合う2つを左から潰していくので、`[-] 10 3 2` は
 * `(10 - 3) - 2 = 5` である。右から畳むと 9 になり、非可換な演算子で黙って答えが変わる。
 *
 * 累算器を別の仮引数に出すのは、そうすれば**器を組み直さずに済む**からである。頭2つを
 * 潰して残りへ繋ぐ形（`自分 ((x OP y) ~xs)`）だと再帰のたびに列を作ることになるが、
 * 累算器なら残りをそのまま渡せる。しかも `自分 (acc OP x) xs` は末尾呼び出しなので、
 * 走査はループへ潰れる。
 */
function foldSource(op) {
  const f = foldNameFor(op);
  const go = `${f}_go`;
  // **空側を `!xs` で名指しする。** `xs & 本体 | x` と書くと、本体が正当に `__` を返した
  // とき（`` `abc` + 1 `` のような型エラー）にも `| x` へ落ちて、黙って違う値が出る。
  // 両側を条件付きにすれば、`__` は `__` のまま通る。
  //
  // **枝は match_case で書く。** 同じ意味を `条件 & 本体 | 条件 & 本体` で書くと、`|` の
  // 左辺は「値を見てから飛び先を決める」ので**末尾位置にならない**——再帰が `bl` になり、
  // フレームが積み上がる。match_case ならどの腕も末尾位置なので、自分への再帰がその場の
  // 分岐に畳まれる。実測で 145 → 110 命令（`bl` 3 → 1）。
  //
  // **公理だけで終端する形（`f : [x ~xs] ? x ${op} (f xs)`）は採らない。** 40 命令まで
  // 落ちて一番小さいが、二重に間違っている：
  //
  // 1. **右畳みになる。** `[-] [10 3 2]` が `10 - (3 - 2) = 9` で、左畳みの 5 ではない。
  // 2. **正当な `__` を飲む。** 完全性公理は右辺の `__` を単位元にするので（`x + __` は
  //    `x`）、「列が尽きた」と「計算が `__` を返した」が同じ形になる。`[+] `abc`` は
  //    `` `a` + `b` `` が charset の外（符号位置 195）で正当に `__` になるのに、公理が
  //    それを吸収して先頭の `a` を返してしまう。
  //
  // **単位元と誤りの印は、同じ位置で兼ねられない。** `!xs` はその2つを分けるために在る。
  return [
    `${go} : acc [x ~xs] ?`,
    `\t!xs : acc ${op} x`,
    `\t${go} (acc ${op} x) xs`,
    `${f} : [x ~xs] ?`,
    `\t!xs : x`,
    `\t${go} x xs`,
  ].join("\n");
}
/**
 * **貪欲な写像（`[* 2,]`）に名前と本体を与える。**
 *
 * 残りアリティ1——各要素へ同じ演算を当てて器を返す。畳み込みと同じく器を1本走査する
 * だけで、違うのは畳むか並べるかである。
 *
 * **顔は2つあるが規則は1つ。** 各要素に `x OP k` を当て、`__` になったものを落とす。
 * 算術ならどれも `__` にならないので素直な写像になり、比較なら偽が `__` になるので
 * **選択**になる（`[< 3,] [1 2 3]` が `[1 2]`）。落とすのは構築がやる（`1 __ 3` は
 * `[1 3]`）ので、規則を2つ持つ必要は無い。
 *
 * ただし**書き下し方は2つ要る**。比較で残すのは判定の値ではなく**要素そのもの**なので
 * （`[< 3,]` は 3 ではなく 1 を残す）、`(x OP k) & x` と書く。そしてその形は「通れば
 * 並べて再帰、落ちれば並べずに再帰」の枝分かれにしないと、機械の側で長さが上界のまま
 * になる——飛ばした個数を返り値の長さへ反映できないからである。
 *
 * 相手（`2`）は仮引数で受ける。生成するのはソースなので、相手が任意の式だと書き下せない
 * ——仮引数にしておけば、呼ぶ側が元の式のノードをそのまま実引数として渡せる。
 *
 * 繋ぎの後置 `~` は**列の μ が任意である**ことから来る（原理7）。文字列なら要らないが、
 * 追記の位置では 0 命令なので、どちらでも同じ命令に落ちる。
 */
// 比較族（Pass 2 が付ける名前）。`=` は `assign_equal`、構造比較は `equal`/`xnot_equal`。
const COMPARE_MAP_OPS = new Set([
  "less",
  "less_equal",
  "more",
  "more_equal",
  "assign_equal",
  "not_equal",
  "equal",
  "xnot_equal",
]);

function mapSource(m) {
  const f = mapNameFor(m);
  const k = m.operand;
  const step = `(${f} (s ' 1~))~`;
  if (COMPARE_MAP_OPS.has(m.name)) {
    // 比較は選択である。残すのは判定の値ではなく要素そのもの。
    //
    // 「通れば並べて再帰、落ちれば並べずに再帰」に枝分かれさせる。`(x OP k) & x` と
    // 1本で書いても解釈側は同じ答えを出すが、機械の側は飛ばした個数を長さへ反映できず
    // 上界のままになる——枝にすれば、落ちる枝が「0 個書いて続ける」ことになる。
    return [`${f} : [~s] ?`, `\t!s : __`, `\t(s ' 0) ${m.op} ${k} : (s ' 0) ${step}`, `\t${f} (s ' 1~)`].join("\n");
  }
  return [`${f} : [~s] ?`, `\t!s : __`, `\t((s ' 0) ${m.op} ${k}) ${step}`].join("\n");
}

function mapNameFor(m) {
  const hex = (s) => [...String(s)].map((c) => c.charCodeAt(0).toString(16)).join("");
  return `_pf_map_${hex(m.op)}_${hex(m.operand)}`;
}

/**
 * その式は「残りアリティ1の貪欲なポイントフリー」か（`[* 2,]`）。穴は左辺である。
 *
 * **相手はリテラルのときだけ扱う。** 生成するのは Sign のソースなので、相手が任意の式だと
 * 書き下せない。仮引数で受ける手もあるが、それだと合成した関数のアリティが 2 になり、
 * 書き換え前に `buildEnv` が記録した束縛（`g : [* 2,]` の `g`）と食い違う——木だけ
 * 差し替えても、束縛の言うアリティは古いままだからである。リテラルを焼き込めば受け口は
 * 器1つのままで、畳み込みと同じく**名前へ差し替えるだけ**で済む。
 *
 * 相手が式の形は、これまで通り解釈側の貪欲な道を通る（機械では出せないと名指しされる）。
 */
function greedyMapOf(node) {
  const n = node && Array.isArray(node.lines) && node.lines.length === 1 ? node.lines[0] : node;
  if (!n || n.type !== "operation" || !n.partial || !n.pointfreeMap || n.position !== "infix") return null;
  if (n.left || !n.right || !n.op) return null;
  // **添字の写像（`[' 0,]`）は扱わない。** 相手は要素の中の位置であって、走査する器の
  // 切り出し方（`s ' 1~`）と同じ演算子を別の意味で使うことになる。実際、積を渡した形
  // （`[' 0,] ([1 2] , [3 4])`）で残りの取り方が食い違う。ここは積の切り出しが揃って
  // からで、それまでは解釈側の貪欲な道に残す。
  if (n.name === "get_prop") return null;
  const r = n.right;
  if (!r || r.type !== "atom" || !(r.kind === "number" || r.kind === "address")) return null;
  return { op: n.op, name: n.name, operand: String(r.value), node: n };
}

function foldNameFor(op) {
  return `_pf_fold_${[...op].map((c) => c.charCodeAt(0).toString(16)).join("")}`;
}

/** その式は「残りアリティ2の貪欲なポイントフリー」か（`[+]` / `[*]`）。 */
function isGreedyFold(node) {
  const n = node && Array.isArray(node.lines) && node.lines.length === 1 ? node.lines[0] : node;
  return !!(n && n.type === "operation" && n.partial && !n.pointfreeMap && n.position === "infix" && !n.left && !n.right && n.op);
}

/**
 * **並べた相手なら、畳み込みはコンパイル時に終わる。**
 *
 * `[-] 1 2 3 4 5` の右辺は、Pass 2 を出た時点で既に**左に入れ子の `construct` 連鎖**に
 * なっている——`construct(construct(construct(construct(1,2),3),4),5)`。これは左畳みの
 * 括弧の付き方そのものなので、**`construct` を演算子に差し替えるだけ**で畳み終わる。
 *
 *     [-] 1 2 3 4 5   →   ((((1 - 2) - 3) - 4) - 5)
 *
 * 個数が構文から見えているときだけできる。相手が識別子（実行時の器）や後置 `~` なら
 * 長さが分からないので、これまで通り再帰する関数を合成する。
 *
 * これが効くのは命令数だけではない。**実行時の値に対するポイントフリーが出せるように
 * なる**——`f : a b c ? [+] a b c` は器を組んで走ろうとして「器の構築はまだ出せません
 * （フレームから出る）」で止まっていたが、展開すれば器そのものが要らない。
 *
 * @returns 畳み終えたノード。展開できない形なら null。
 */
function expandGreedyFold(node) {
  if (!node || node.type !== "operation" || node.name !== "apply" || node.position !== "infix") return null;
  if (!isGreedyFold(node.left)) return null;
  const inner = node.left.lines ? node.left.lines[0] : node.left;
  const leaves = constructLeaves(node.right);
  if (!leaves || leaves.length < 2) return null; // 1つだけの形は畳む相手が無く、器かもしれない
  return leaves.reduce((acc, x) => ({
    type: "operation",
    name: inner.name,
    op: inner.op,
    position: "infix",
    left: acc,
    right: x,
  }));
}

/**
 * 左に入れ子の `construct` 連鎖を、並びとして読む。連鎖でなければ null。
 *
 * 一番外側の括弧だけ剥がす（`[+] [1 2 3]` の `[…]`）。**要素の括弧は剥がさない**
 * ——`(1 2)` は入れ子の器であって、外の並びの1要素である。
 */
function constructLeaves(node) {
  const outer = node && Array.isArray(node.lines) && node.lines.length === 1 ? node.lines[0] : node;
  const isChain = (n) => !!(n && n.type === "operation" && n.name === "construct" && n.position === "infix");
  if (!isChain(outer)) return null;
  const leaves = [];
  const walk = (n) => {
    if (isChain(n)) { walk(n.left); leaves.push(n.right); return; }
    leaves.push(n);
  };
  walk(outer);
  return leaves;
}

/**
 * **並べた相手なら、写像もコンパイル時に終わる。**
 *
 * 畳み込みが `construct` を演算子に差し替えるのに対し、写像は**連鎖の形を保ったまま
 * 各要素に演算を当てる**——並びの長さは変わらないからである。
 *
 *     [* 2,] 1 2 3   →   (1 * 2) (2 * 2) (3 * 2)
 *
 * **比較は選択になる。** `[< 3,]` が残すのは判定の値ではなく**要素そのもの**なので
 * `(x < 3) & x` と書く。落ちた要素は `__` になり、**落とすのは構築がやる**
 * （`1 __ 3` は `[1 3]`）——規則を2つ持つ必要は無く、合成する関数の側と同じ読みである。
 *
 * これは一度諦めた道である。Pass 4 の構築が `__` を落とさず、`||[< 3,] 1 2 3||` が
 * 3 を返していた（解釈は 2）——**展開が正しくても、置く先が落とさなければ合わない**。
 * 構築がカーソルで書くようになって成り立った。
 */
function expandGreedyMap(node) {
  if (!node || node.type !== "operation" || node.name !== "apply" || node.position !== "infix") return null;
  const m = greedyMapOf(node.left);
  if (!m) return null;
  const leaves = constructLeaves(node.right);
  if (!leaves || leaves.length < 2) return null;
  const k = () => ({ type: "atom", kind: m.node.right.kind, value: m.node.right.value });
  const step = (x) => {
    const hit = { type: "operation", name: m.name, op: m.op, position: "infix", left: x, right: k() };
    // 比較は「通ったら要素を残す」——判定の値ではない。
    return COMPARE_MAP_OPS.has(m.name)
      ? { type: "operation", name: "and", op: "&", position: "infix", left: hit, right: x }
      : hit;
  };
  return leaves.map(step).reduce((acc, x) => ({
    type: "operation",
    name: "construct",
    op: " ",
    position: "infix",
    left: acc,
    right: x,
  }));
}

/**
 * **合成は左から実行する。** `f g` は「`f` してから `g`」であり（operator_table.md
 * 10.6「左結合な関数合成」）、数学の `g ∘ f` と読みの向きが逆である——パイプラインの
 * 順に書ける。したがって `(f g) x` は `g (f x)` に展開する。
 *
 * 呼び先が静的に分かるので実行時に合成を組む必要が無い。畳み込みや写像と同じ「並べた
 * 相手ならコンパイル時に終わる」形であり、これが無いと Pass 4 は
 * 「呼び先が静的に決まりません」「まだ出せない式です（compose）」で止まる。
 *
 * 連なり（`f g h`）は `compose(compose(f,g),h)` なので、外側を1回開くと内側がまた
 * `apply(compose(...), …)` になる——不動点まで回す側が続きを片付ける。
 */
function expandCompose(node, named) {
  if (!node || node.type !== "operation" || node.name !== "apply" || node.position !== "infix") return null;
  const peelParen = (x) => (x && Array.isArray(x.lines) && x.lines.length === 1 ? x.lines[0] : x);
  const isCompose = (x) => !!(x && x.type === "operation" && x.name === "compose" && x.position === "infix");
  let fn = peelParen(node.left);
  // **名前を付けた合成（`h : f g`）も同じ形である。** `buildEnv` の束縛は型とアリティしか
  // 持たないので（値ノードは後の pass が入れる）、トップレベルの定義から直に引く。
  if (!isCompose(fn) && fn && fn.type === "atom" && fn.kind === "identifier" && named) {
    const v = named.get(fn.value);
    if (isCompose(v)) fn = v;
  }
  if (!isCompose(fn)) return null;
  const call = (f, x) => ({ type: "operation", name: "apply", op: " ", position: "infix", left: f, right: x });
  return call(fn.right, call(fn.left, node.right));
}

/**
 * 木の中の展開できる畳み込み・写像・合成を、その場で終わらせる。
 *
 * **内側から畳む必要がある。** `[+] ([* 2,] a b c)` は、写像が並びになって初めて
 * 畳み込みの相手が `construct` 連鎖になる。`walkNodes` は差し替えたところで降りるのを
 * やめるので、**変化が無くなるまで回す**——回数は式の入れ子の深さで、実際には 2〜3 回。
 */
function expandGreedyFoldsIn(nodes, env) {
  // 名前を付けた合成を先に集める（`h : f g`）。
  const named = new Map();
  for (const n of nodes) {
    if (!n || n.type !== "operation" || n.name !== "define") continue;
    if (!n.left || n.left.type !== "atom" || n.left.kind !== "identifier") continue;
    const v = n.right && Array.isArray(n.right.lines) && n.right.lines.length === 1 ? n.right.lines[0] : n.right;
    if (v && v.type === "operation" && v.name === "compose" && v.position === "infix") named.set(n.left.value, v);
  }
  const one = (n) => expandGreedyFold(n) || expandGreedyMap(n) || expandCompose(n, named) || null;
  for (let pass = 0; pass < 16; pass++) {
    let changed = false;
    for (let i = 0; i < nodes.length; i++) {
      const done = one(nodes[i]);
      if (done) { nodes[i] = done; changed = true; }
    }
    walkNodes(nodes, null, (child) => {
      const d = one(child);
      if (d) changed = true;
      return d || child;
    });
    if (!changed) break;
  }
  // **展開しきった合成の定義は、もう誰も見ない。** `h : f g` の呼び出しは全部
  // `g (f x)` へ開いてあるので、定義そのものは死んでいる——残すと Pass 4 が
  // 「まだ出せない式です（compose）」で止まる。
  //
  // 開けなかった使い方（`$h` のように値として渡す形）が残っていれば、そちらは
  // 「まだ出せない識別子です（h）」と名指しで止まる——**黙って消えることはない**。
  for (const n of nodes) {
    if (!n || n.type !== "operation" || n.name !== "define") continue;
    const v = n.right && Array.isArray(n.right.lines) && n.right.lines.length === 1 ? n.right.lines[0] : n.right;
    if (v && v.type === "operation" && v.name === "compose" && v.position === "infix") n.supersededByDesugar = true;
  }
}

/** 貪欲なポイントフリーを演算子ごとに集め、生成すべきソースを返す。 */
function collectGreedyFolds(nodes) {
  const folds = new Set();
  const maps = new Map(); // 名前 -> 記述（演算子と焼き込む相手で1つに畳む）
  walkNodes(nodes, (n) => {
    if (isGreedyFold(n)) {
      folds.add((n.lines ? n.lines[0] : n).op);
      return;
    }
    const m = greedyMapOf(n);
    if (m) maps.set(mapNameFor(m), m);
  });
  return [...folds].map(foldSource).concat([...maps.values()].map(mapSource));
}

/**
 * 貪欲なポイントフリーを、生成した名前への参照へ置き換える。
 *
 * 畳み込みも写像も**器1つを取る**ので、どちらも名前へ差し替えるだけでよい。写像の相手を
 * 焼き込んであるおかげで受け口が1つに収まり、`buildEnv` が記録した束縛のアリティと
 * 食い違わない。
 */
function replaceGreedyFolds(nodes) {
  walkNodes(nodes, null, (child) => {
    const inner = child && child.lines ? child.lines[0] : child;
    if (isGreedyFold(child)) {
      return { type: "atom", kind: "identifier", value: `<${foldNameFor(inner.op)}>` };
    }
    const m = greedyMapOf(child);
    if (m) return { type: "atom", kind: "identifier", value: `<${mapNameFor(m)}>` };
    return child;
  });
}

/** 子を差し替えられる木歩き。`visit` は観測、`swap` は置き換え。 */
function walkNodes(nodes, visit, swap) {
  const seen = new Set();
  const step = (n) => {
    if (!n || typeof n !== "object" || seen.has(n)) return;
    seen.add(n);
    if (visit) visit(n);
    for (const k of ["left", "right", "operand"]) {
      if (!n[k]) continue;
      const s = swap ? swap(n[k]) : n[k];
      if (s !== n[k]) n[k] = s;
      else step(n[k]);
    }
    if (Array.isArray(n.lines)) {
      for (let i = 0; i < n.lines.length; i++) {
        const s = swap ? swap(n.lines[i]) : n.lines[i];
        if (s !== n.lines[i]) n.lines[i] = s;
        else step(n.lines[i]);
      }
    }
    for (const e of n.entries || []) {
      if (!e.default) continue;
      const s = swap ? swap(e.default) : e.default;
      if (s !== e.default) e.default = s;
      else step(e.default);
    }
  };
  for (const n of nodes) step(n);
}

/** その識別子ノードは「置き場所」を表すホールか（`[!_]` の `_`）。 */
function isHole(n) {
  return !!(n && n.type === "atom" && n.kind === "hole");
}

/**
 * **ポイントフリーを、仮引数を持つ形へ合成する。**
 *
 * `[+ 2]` は「左辺の欠けた演算」であって仮引数を持たない。意味論の上ではそれで足りる
 * （インタプリタは欠けた所へ実引数を入れて評価する）が、機械の上で関数として出すには
 * **受け口**が要る——`genFunction` は仮引数リストが無いと何も束縛できない。
 *
 * そこで書かれた形から `_a ? _a + 2` を組む。意味は変えない——**欠けている所に名前を
 * 置くだけ**である。判定に使う `partial` は縮約時に書かれた形から付く印なので、ここも
 * 「フロントエンドの表現がそのまま型になる」の側に居る。
 *
 * 合成できるのは受け口が1つの形だけである。`[+]`（貪欲な畳み込み）と `[* 2,]`（写像）は
 * 実引数を何個でも食うので、仮引数1つの形には収まらない——そちらは別の合成が要る。
 *
 * @returns 合成したラムダノード。合成できない形なら null。
 */
function synthesizePointfree(node, scope) {
  const inner = node && Array.isArray(node.lines) && node.lines.length === 1 ? node.lines[0] : node;
  if (!inner || inner.type !== "operation" || !inner.partial || inner.pointfreeMap) return null;
  const name = "<_pf>";
  const param = { type: "atom", kind: "identifier", value: name };
  let body = null;
  if (inner.position === "infix" && inner.right && !inner.left) {
    // `[+ 2]` → `_a ? _a + 2`。欠けているのは左辺である。
    body = { ...inner, left: param, partial: undefined };
  } else if ((inner.position === "prefix" || inner.position === "postfix") && isHole(inner.operand)) {
    // `[!_]` / `[_!]` → ホールがそのまま受け口である。
    body = { ...inner, operand: param, partial: undefined };
  }
  if (!body) return null;
  const inner2 = bindEnv([name], scope);
  return {
    type: "operation",
    op: "?",
    name: "lambda",
    position: "infix",
    left: { type: "params", entries: [{ name, rest: false, default: null }], requiredArity: 1, bracket: false },
    right: body,
    scope: inner2,
  };
}

/** 束縛の右辺に書かれたポイントフリーを、その場でラムダへ置き換える。 */
function synthesizePointfreeIn(node, scope) {
  if (!node || typeof node !== "object") return;
  if (node.type === "operation" && node.name === "define" && node.right) {
    const lam = synthesizePointfree(node.right, scope);
    if (lam) {
      node.right = lam;
      return;
    }
  }
  for (const k of ["left", "right", "operand"]) synthesizePointfreeIn(node[k], scope);
  for (const l of node.lines || []) synthesizePointfreeIn(l, scope);
  for (const e of node.entries || []) {
    if (!e.default) continue;
    const lam = synthesizePointfree(e.default, scope);
    if (lam) e.default = lam;
    else synthesizePointfreeIn(e.default, scope);
  }
}

export { compile };
