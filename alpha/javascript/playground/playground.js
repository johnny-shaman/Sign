import { compile } from "../compile.js";
import { generateSignType } from "../st.js";
import { evaluate, newRuntimeEnv, UNIT, isUnit, observe } from "../interpreter.js";

const srcEl = document.getElementById("src");
const outEl = document.getElementById("out");
const outPreEl = outEl.parentElement;
const astEl = document.getElementById("ast");
const stEl = document.getElementById("st");
const stScopeEl = document.getElementById("stScope");
const lineNumbersEl = document.getElementById("lineNumbers");
const runBtn = document.getElementById("runBtn");
const exampleSelectEl = document.getElementById("exampleSelect");
const fontSelectEl = document.getElementById("fontSelect");
const fontSizeEl = document.getElementById("fontSize");
const fontSizeLabelEl = document.getElementById("fontSizeLabel");
const ligaturesEl = document.getElementById("ligatures");

// フォント表示（フォント種別・サイズ・合字の有無）を選べるようにする。Signは`~+`/`!=`/
// `<=`のような複合記号が多く、合字（ligature）でグリフが結合されると個々の記号が読み
// 取りにくくなる場合があるため、デフォルトは無効（`--code-ligatures: none`、playground.css）
// にしつつ、フォントによっては合字表示を見たい場合もあるためON/OFFを選べるようにした。
// 選択内容はlocalStorageへ保存し、リロードをまたいで保持する。
const FONT_PREF_KEY = "sign-playground-font-prefs";
function loadFontPrefs() {
  try {
    return JSON.parse(localStorage.getItem(FONT_PREF_KEY) || "{}");
  } catch {
    return {};
  }
}
function saveFontPrefs(prefs) {
  localStorage.setItem(FONT_PREF_KEY, JSON.stringify(prefs));
}
function applyFontPrefs() {
  const root = document.documentElement.style;
  root.setProperty("--code-font", fontSelectEl.value);
  root.setProperty("--code-size", `${fontSizeEl.value}px`);
  root.setProperty("--code-ligatures", ligaturesEl.checked ? "normal" : "none");
  fontSizeLabelEl.textContent = `${fontSizeEl.value}px`;
  saveFontPrefs({ font: fontSelectEl.value, size: fontSizeEl.value, ligatures: ligaturesEl.checked });
}
(function initFontPrefs() {
  const prefs = loadFontPrefs();
  if (prefs.font) fontSelectEl.value = prefs.font;
  if (prefs.size) fontSizeEl.value = prefs.size;
  if (prefs.ligatures) ligaturesEl.checked = true;
  applyFontPrefs();
})();
fontSelectEl.addEventListener("change", applyFontPrefs);
fontSizeEl.addEventListener("input", applyFontPrefs);
ligaturesEl.addEventListener("change", applyFontPrefs);

// ---- Template Loader（documents/ja-jp/guide/を踏まえた、alpha/javascriptで実際に
// 動く挙動だけを集めたサンプル集。pre-alpha版playgroundの構成に倣うが、$/@/#やWASM等
// alpha側の実装状況に合わせて中身は作り直した）。
const EXAMPLES = {
  composition: `\`関数合成（左→右パイプライン順、f gはg(f(x))）
f : x ? x + 1
g : x ? x * 2
h : f g
h 3`,
  currying: `\`自動カリー化（アリティ不足の適用は静的にpartial closureへ）
f : x y z ? x + y + z
g : f 1
g 2 3
(f 1) 2 3`,
  pointfree: `\`ポイントフリー記述（演算子を直接値として使う）
inc : [+ 1]
inc 3
add : [+]
add 1 2 3 4 5`,
  match_case: `\`match_case（&/|チェーンへ脱糖、上から順に短絡評価）
classify : x ?
	x < 0 : \`negative\`
	x = 0 : \`zero\`
	\`positive\`
classify -3
classify 0
classify 7`,
  rest_recursion: `\`裸のrestパラメータ（後置~で展開して渡す）
sum : x ~xs ? x + (sum xs~)
sum [1 2 3 4 5]~`,
  chain_compare: `\`三項連鎖比較（comparison.md §4、中央の項を返す）
x : 7
5 < x < 10
5 < 3 < 10`,
  manual_curry: `\`手動カリー（$で継続をアドレス化、@で呼び出す）
f : a ? $[b ? a + b]
@(f 1) 2`,
  types: `\`型はコードの影（SignTypeパネルを見る）。記法が域を、演算子が型を決める
\`アドレスは0x記法のみ。十進はInt、小数点ありはFloat（type_system.md §3.6）
#uart : [
	CR : 0x40011000
	SR : 3
	DR : \\d
]
\`リテラルは左辺に置く——域を選ぶのは左辺だから（§3.2）
#as_int : x ? 0 + x
#as_float : x ? 0.0 + x
\`返値はmatch_caseの直和になる
#classify : n ?
	n < 0 : \`neg\`
	n
\`合成は左端が仮引数を、右端が返値を決める
#piped : as_float classify`,
};

exampleSelectEl.addEventListener("change", () => {
  const example = EXAMPLES[exampleSelectEl.value];
  if (example) {
    srcEl.value = example;
    updateLineNumbers();
    run();
  }
});

// ---- 行番号ガター（ソースの行数・スクロール位置に追従） ----
function updateLineNumbers() {
  const count = srcEl.value.split("\n").length;
  let html = "";
  for (let i = 1; i <= count; i++) html += `<div>${i}</div>`;
  lineNumbersEl.innerHTML = html;
}
srcEl.addEventListener("input", updateLineNumbers);
srcEl.addEventListener("scroll", () => {
  lineNumbersEl.scrollTop = srcEl.scrollTop;
});

function showValue(v) {
  if (isUnit(v)) return "__ (Unit)";
  if (Array.isArray(v)) return "[" + v.map(showValue).join(" ") + "]";
  if (v && v.__address__) return `<Address → ${showValue(v.get())}>`;
  if (v && v.__lambda__) return "<Lambda>";
  if (v && typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function showAst(node) {
  if (node === null || node === undefined) return "null";
  if (node.type === "atom") return `${node.kind}(${node.value})`;
  if (node.type === "operation") {
    if (node.position === "prefix" || node.position === "postfix") return `${node.name}(${showAst(node.operand)})`;
    if (node.name === "chain_compare") return `chain_compare[${showAst(node.left)}, ${node.compareName}, ${showAst(node.middle)}, ${showAst(node.right)}]`;
    return `${node.name}[${showAst(node.left)}, ${showAst(node.right)}]`;
  }
  if (node.type === "block") return `${node.kind}{${node.lines.map(showAst).join("; ")}}`;
  if (node.type === "params") {
    return `params[${node.entries.map((e) => (e.rest ? `~${e.name}` : e.default ? `${e.name}:${showAst(e.default)}` : e.name)).join(", ")}]`;
  }
  if (node.type === "unresolved") return `UNRESOLVED[${node.items.map((x) => (typeof x === "string" ? x : showAst(x))).join(", ")}]`;
  return JSON.stringify(node);
}

function run() {
  const source = srcEl.value;
  const outLines = [];
  const astLines = [];
  let hadError = false;
  try {
    // 静的解決は compile()（Pass 1〜3 の単一ドライバ）に一本化。
    // 各ノードには pass3 が Layer 2 型（atomType）を注釈済みなので、AST表示にも出す。
    const { nodes, env, diagnostics } = compile(source);
    // SignType（.st/.ist）— Pass 1〜3 が確定した型の観測チャネル。
    // `.ist` はブラウザのメモリ上にしか出さない（compiler_pipeline.md §4:
    // 内部識別子名・構造体の内部レイアウトを含むためディスクへ永続化しない）。
    stEl.textContent = generateSignType(nodes, env, { scope: stScopeEl.value }).text;
    const runtimeEnv = newRuntimeEnv(null);
    let last = UNIT;
    for (const node of nodes) {
      // Layer 2 型（atomType）が無いノードは `:: ?` を出さずに省く。ラムダのような
      // Layer 1 の値に Atom 内部型が無いのは当然であって、解決の失敗ではない。
      // 型の全体像（シグネチャ・仮引数・返値）は SignType パネルが担う。
      astLines.push(node.atomType ? `${showAst(node)}\n  :: ${node.atomType}` : showAst(node));
      // 観測境界：画面へ出すので、ここで初めて並んだ姿になる。
      last = observe(evaluate(node, runtimeEnv));
      outLines.push(showValue(last));
    }
    // Pass 3b（コンパイル時）と実行時（unit.md §7.3相当のenv.diagnostics）の両方を出す。
    // 前者は「実行しなくても __ になると分かった」もの、後者は実行して初めて分かったもの。
    const all = [...diagnostics, ...runtimeEnv.diagnostics];
    if (all.length > 0) {
      outLines.push("");
      for (const d of all) outLines.push(`[${d.level}] ${d.message}`);
    }
  } catch (e) {
    outLines.push("エラー: " + e.message);
    hadError = true;
  }
  outEl.textContent = outLines.join("\n");
  outPreEl.classList.toggle("err", hadError);
  astEl.textContent = astLines.join("\n\n");
}

// ボタンのローディング表示（評価自体は同期処理のため一瞬だが、クリックへ視覚的な
// フィードバックを返すため1ティックだけ挟む）。
// 【requestAnimationFrameを使わない理由】rAFはタブが非表示・非コンポジット状態だと
// 発火しないため、「実行を押しても何も起きない」という状態になる（実際に踏んだ）。
// setTimeoutはその状態でも発火するので、描画の間引きに巻き込まれない。
function runWithFeedback() {
  runBtn.classList.add("loading");
  setTimeout(() => {
    try {
      run();
    } finally {
      runBtn.classList.remove("loading");
    }
  }, 0);
}

runBtn.addEventListener("click", runWithFeedback);
stScopeEl.addEventListener("change", run);
srcEl.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "Enter") runWithFeedback();
  // Signのインデントは厳密にタブ文字のみ（lexer.jsのmarkBlockは/^\t*/でタブしか見ない。
  // 行頭のスペースは字下げではなく前の行の続き、preprocessor.md §0）。素のtextareaはTabキーでフォーカス移動してしまい
  // タブ文字を入力できないため、ここで明示的にタブ文字を挿入する。
  if (e.key === "Tab") {
    e.preventDefault();
    const start = srcEl.selectionStart;
    const end = srcEl.selectionEnd;
    srcEl.value = srcEl.value.slice(0, start) + "\t" + srcEl.value.slice(end);
    srcEl.selectionStart = srcEl.selectionEnd = start + 1;
    updateLineNumbers();
  }
});

srcEl.value = EXAMPLES.composition;
updateLineNumbers();
run();
