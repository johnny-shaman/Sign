/**
 * Sign Language Lexer (前処理フェーズ)
 * alpha/javascript/lexer.js（c3b203fc）から移植。元は pre_alpha/lexisize/lexer.js
 * alpha1 で足した規則（利用者 2026-10-17）：字下げのブロックは演算子の右にだけ置ける（refuseBlockAfterValue）、
 * いちばん外の定義が字下げのブロックで終わったら空行を1行置く（refuseMissingBlankLine）。
 *
 * 主な役割:
 * - 多義的でない中置演算子の前後に自動で空白を挿入し、PEGパーサーが
 *   フラットな配列として要素を捉えやすくする。
 * - 多義的演算子（`|`, `-`, `#`, `@`, `!`, `~`, `$` 等）には空白を挿入せず、
 *   密着結合（前置・後置）としてPEGが処理できるようにする。
 * - 文字列、コメント、エスケープ文字の中身は保護する。
 * - インデント/デデントを \x02 / \x03 の制御文字としてマーキングする（markBlock）。
 *
 * 【設計方針】中置演算子の前後スペースは、本来ユーザーが必ず自分で書くべきもの
 * （`operator_table.md`「基本原則」: 中置演算子は空白で区切らなければならない）。
 * separateInfixによる自動補完は、あくまでパーサー実装上の都合による内部的な寛容さで
 * あって、保証された言語仕様ではない。ここに依存したコードが将来のリファクタで
 * 壊れても、それは「保証を破った」ことにはならない（見つかれば直すが、無限責任は負わない）。
 * 本来この手の自動整形はコンパイラ／lexerではなくエディタ側のフォーマッタが担うべき仕事。
 */

import { buildLexerRegex, OPERATOR_DICT } from './operator_table.js';
import { OperationError } from './errors.js';

export function separateInfix(input) {
  const lexerRegex = buildLexerRegex();

  return input.replace(lexerRegex, (match, protect, operator) => {
    if (protect) {
      // 文字列、コメント、エスケープ文字、保護対象(!!)はそのまま返す
      return protect;
    }
    if (operator) {
      // 多義的でない中置演算子の前後に空白を挿入
      return ` ${operator} `;
    }
    return match;
  });
}

/**
 * **改行を2つの役割に分ける（最初の走査）**（preprocessor.md §0、利用者の決定 2026-09-15）。
 *
 * 改行には、処理の区切り（その行を評価してよい、という演算子）と、文字としての改行（`\` の直後の1文字）の
 * 2つの役割がある。同じバイトに両方を担わせていたので、後の段が文脈から推測していた——`\` + 改行の次が
 * 0列目だと区切りにもなって値が黙って変わり、次の行へつなぐ処理は LF を空白に替え、行頭の空白を許すかは
 * 生のテキストから推測していた（`prevEndsWithEscape`）。
 *
 * だから最初に一度だけ左から走査して、ディスク上の CRLF・LF・CR を次のように分ける：
 *
 *   `\` の直後の改行   → LF（U+000A、文字の改行。`\` と組んで1つの文字リテラル）
 *   それ以外の改行     → CR（U+000D、処理の区切り）
 *
 * 文字列（`` `…` ``・`"…"`）の中は素通しにする——そこでの `\` はただの文字なので、改行を LF に変えない。
 *
 * **行頭のコメントはこの走査で判別し、読み捨てる。** 後の段は判別し直さない。判別は生のテキストの上で
 * string_and_comment.md §2 のとおり（閉じの直後が後置演算子か空白なら式、それ以外はコメント）で、行頭は
 * 「直前が CR か、ファイルの先頭」、しかも括弧の外で TAB の後ではない所だけである（§3、文法が `comment` を
 * 試すのもそこだけ）。以前は判別を文法にも任せていたので、文法は separateInfix が空白を入れた後のテキストで、
 * 括弧やブロックの中では試さずに判別し直し、2つの段の答えが食い違うと `\` が CR を文字として食った。
 *
 * 括弧の深さは、コメントかどうかを決めるために数える。数え方は markBlock の `bracketDelta` と同じ（文字列と
 * `\` の組は数えない）。
 *
 * **`\` + 改行の後の TAB は、ここですべて落とす。** 続きの行の頭の TAB は揃えであって字下げではない——CR の後の
 * 続きの行（markBlock）で深い TAB を読み捨てるのと同じ扱いにする。以前は「今のブロックの深さ」まで落とす
 * つもりで物理行の頭の TAB の数を使っていたので、続きの行で揃えた行の後だけ多く落ち、CR の後の続きとも食い違った。
 *
 * **文字列は行をまたがない。** 行の終わりまでに閉じないバッククォートは構文エラーにする。続きの行がつながった
 * 後の段で閉じが見つかると、2行にまたがる文字列が黙ってできていた。
 */
export function classifyNewlines(input) {
  return classifyNewlinesWithComments(input).text;
}

// classifyNewlines の本体。読み捨てた行頭のコメントの行の番号（CR で切った処理行の何番目か）も返す。markBlock は
// それを見て、コメントの行を空行に数えない（refuseMissingBlankLine）。印を文字列の中に置くと、ソースに同じ文字が
// あったときに見分けが付かないので、行の番号で外に渡す。
function classifyNewlinesWithComments(input) {
  const n = input.length;
  const commentLines = new Set();
  let lineNo = 0;
  const newlineWidth = (k) => (input[k] === '\r' ? (input[k + 1] === '\n' ? 2 : 1) : input[k] === '\n' ? 1 : 0);
  let out = '';
  let i = 0;
  let lineStart = true;
  let bracketDepth = 0;
  while (i < n) {
    if (lineStart) {
      lineStart = false;
      if (bracketDepth <= 0 && input[i] === '`' && isCommentAt(input, i)) {
        while (i < n && !newlineWidth(i)) i++;
        commentLines.add(lineNo);
        continue;
      }
    }
    const w = newlineWidth(i);
    if (w) {
      out += '\r';
      lineNo++;
      i += w;
      lineStart = true;
      continue;
    }
    const ch = input[i];
    if (ch === '\\') {
      const w2 = i + 1 < n ? newlineWidth(i + 1) : 0;
      if (w2) {
        out += '\\\n';
        i += 1 + w2;
        while (input[i] === '\t') i++;
      } else {
        out += input.slice(i, i + 2);
        i += 2;
      }
      continue;
    }
    if (ch === '`' || ch === '"') {
      let k = i + 1;
      while (k < n && input[k] !== ch && !newlineWidth(k)) k += ch === '"' && input[k] === '\\' && k + 1 < n && !newlineWidth(k + 1) ? 2 : 1;
      if (input[k] === ch) k++;
      else if (ch === '`') {
        const lineEnd = input.slice(i).search(/[\r\n]/);
        throw new SyntaxError(`文字列が行の終わりまでに閉じていません（文字列は行をまたげません）: ${JSON.stringify(input.slice(i, lineEnd < 0 ? n : i + lineEnd))}`);
      }
      out += input.slice(i, k);
      i = k;
      continue;
    }
    if (ch === '[' || ch === '(' || ch === '{') bracketDepth++;
    else if (ch === ']' || ch === ')' || ch === '}') bracketDepth--;
    out += ch;
    i++;
  }
  return { text: out, commentLines };
}

// 行頭のバッククォートがコメントの始まりか（sign.pegjs の `comment` と同じ判別）。
function isCommentAt(input, j) {
  let k = j + 1;
  while (k < input.length && input[k] !== '`' && input[k] !== '\r' && input[k] !== '\n') k++;
  if (input[k] !== '`') return true;
  const after = input[k + 1];
  return !(after === '@' || after === '~' || after === '!' || after === ' ');
}

// 1行ぶんのコンテンツを見て、ブラケット（[ ( {）の開閉深さの増減を計算する。
// 文字列（バッククォート・ダブルクォート）やエスケープ文字の中身は、カッコとして
// 数えないよう読み飛ばす（例: `array[3]` という文字列リテラルの中の`[`は無視する）。
// 閉じられていないバッククォート/ダブルクォートは、行末までのコメント・文字列として
// 残り全部を読み飛ばす。
function bracketDelta(content) {
  let depth = 0;
  let i = 0;
  while (i < content.length) {
    const ch = content[i];
    if (ch === '\\') {
      i += 2; // エスケープ文字（\X）はまとめて読み飛ばす
      continue;
    }
    if (ch === '`' || ch === '"') {
      const close = content.indexOf(ch, i + 1);
      if (close === -1) break; // 閉じ引用符が無い＝残りは行コメント/文字列として読み飛ばす
      i = close + 1;
      continue;
    }
    if (ch === '[' || ch === '(' || ch === '{') depth++;
    else if (ch === ']' || ch === ')' || ch === '}') depth--;
    i++;
  }
  return depth;
}

// **`?` の行は、定義の行から1段だけ字下げする**（利用者の裁定 2026-10-05）。
//
//     f :                f : x y
//     		x            	? x + y
//     		y : 3
//     	? x + y
//
// 仮引数のブロックは2段、`?` は1段、本体をブロックで書くなら本体も2段（深さ k の定義なら k+2・k+1・k+2）。
// 括りの仮引数のブロック（`[` … `]`）も同じ字下げで書き、`?` は閉じの次の行に置く。形は1つだけで、外れた形は
// 名指しで断る。
//
// `?` で始まる行は定義の行で前の行へつなぐので、置いた深さでどの行に付くかが決まる（下の markBlock）。深い TAB は揃えで
// 今の行に付き、浅ければ閉じた段の先の行に付く。だから門は**書いた行**（続きの行でも括弧の中の行でもない行）の
// 深さで見る。`?` の行の深さを q とすると、付いてよいのは次の2つが揃うときだけである:
//
//   1. q - 1 に書いた行（定義の行）があり、q に書いた行が無い。q に書いた行があれば `?` はその行に付く——
//      0桁目の `?`（1行の仮引数の次の行でも）、入れ子の定義と同じ深さの `?`、仮引数の行と同じ深さの `?` が
//      これで、最後のものは**最後の仮引数の行に付き**、`y : 3 ? x + y`（`3` という名の仮引数を取る `y` の定義）
//      として黙って読まれていた。q - 1 に書いた行が無ければ、`?` は定義の行から2段以上離れている（1行の
//      仮引数の `?` を2段に置いた形、仮引数3段・`?` 2段の形）。
//   2. q より深い書いた行（仮引数の行）が無いか、いちばん浅いものが q + 1 にあり、しかもその行が**字下げを
//      深くして開いた段**にある。仮引数を3段以上に置いた形（`?` は1段）と、最初の仮引数の行を3段に置いてから
//      2段へ戻した形（2段は跳んだ途中の段を後から埋めた段）をここで断る。
//
// 深さ k の定義でも同じ2つで、1行の仮引数（q より深い書いた行が無い）にも仮引数のブロックにも当てはまる。
// 行頭の空白の後の `?`（`\t ? x`）も同じ所に付く——空白は余積で、つないだ後の木は `?` で始まる行と変わらない。
//
// **括りの仮引数を複数の行に書いたら、`?` は閉じの行に続けない**（`questionAfterClose`）。括りの中の行は
// 字下げを数えないので、閉じの行（`]` …）は書いた行ではなく、その後ろの `?` は行の頭に来ない。括りの中で
// 始まった行が括りの外（深さ 0）へ出て、同じ行に `?` があれば断る。1行の括り（`f : [x ~xs] ? x`）は閉じが
// 開きと同じ行なので当たらない。
//
// **字句の段でしか見えない。** 続きの行は前の行へ空白でつながれるので、後の段（Pass 2・parser.sn）には
// `y : 3`⏎`\t\t? x + y` と1行に書いた `y : 3 ? x + y` が同じ木で届く。Sign 側の前処理
// （preprocess.sn の `q_bad`）も同じ深さで同じ判定をする。
//
// 断らないもの：ファイルの最初の行の `? 5`（続ける行が無いので続きにならない）、括弧の中の `?`（括弧の中は
// 字下げを数えない）。仮引数の行より1段深い `?` は、1行の仮引数の `?` と深さでは見分けられない——前の行が
// 定義の行か仮引数の行かは字句の段では決まらないので、ここでは断らない（未決、2026-10-05）。
const QUESTION_ROW_RULE =
  "`?` で始まる行は、定義の行から1段だけ字下げします（仮引数のブロックは2段、`?` は1段、本体のブロックも2段。" +
  "仮引数を定義の行に並べたときも `?` の行は1段。括りの仮引数を複数の行に書いたら `?` は閉じの次の行）。";

function refuseMisplacedQuestionRow(content, q, depth, written) {
  let k = written.length - 1;
  while (k >= 0 && written[k].depth > q) k--;
  const at = k >= 0 ? written[k].depth : -1;
  const deeper = written[k + 1];
  if (q >= 1 && at === q - 1 && (deeper === undefined || (deeper.depth === q + 1 && deeper.opened))) return;
  let where;
  if (at === q) {
    where =
      q === depth
        ? "直前の行と同じ深さなので、その行の続きになります（仮引数の行と同じ深さなら、最後の仮引数の行に付きます）"
        : "同じ深さに書いた行（定義の行）の続きになります";
  } else if (at < 0) {
    where = "その上に書いた行がありません";
  } else if (at < q - 1) {
    where = `その上に書いた行（TAB ${at} 個）から ${q - at} 段下がっています`;
  } else if (deeper.depth !== q + 1) {
    where = `定義の行（TAB ${at} 個）から1段ですが、仮引数の行が定義の行から ${deeper.depth - at} 段下がっています（仮引数の行は2段）`;
  } else {
    where = `定義の行（TAB ${at} 個）から1段ですが、仮引数の行が定義の行から2段の所で始まっていません（字下げを跳んで深く書いた行の後に、2段の行を書いています）`;
  }
  throw new OperationError(`${QUESTION_ROW_RULE}この行（TAB ${q} 個の \`${content}\`）は${where}`, {
    reason: "question-row-indent",
  });
}

// 括りの中で始まった行が、括りの外（深さ 0）へ出た後に `?` を書いているか。数え方は bracketDelta と同じ
// （文字列とエスケープの中は数えない）。
function questionAfterClose(content, depth) {
  let i = 0;
  while (i < content.length) {
    const ch = content[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '`' || ch === '"') {
      const close = content.indexOf(ch, i + 1);
      if (close === -1) return false;
      i = close + 1;
      continue;
    }
    if (ch === '[' || ch === '(' || ch === '{') depth++;
    else if (ch === ']' || ch === ')' || ch === '}') depth--;
    else if (ch === '?' && depth <= 0) return true;
    i++;
  }
  return false;
}

// **字下げのブロックは、演算子の右にだけ置ける**（利用者 2026-10-17）。値や語のすぐ後ろの字下げを余積の項として
// 読むと、ブロックと余積が混ざる。前の行の余積を続けたいなら、TAB の後に空白を置く——行頭の空白は前の行の続き
// なので（上の markBlock の注）、`inc` の次の行の `\t 5` は `inc 5` である。器として渡したいなら括りで書く。
//
// 「演算子の右」は、前の行（続きの行をつないだもの）の最後の語が、中置の意味を持つ演算子（演算子表に中置の行が
// ある綴り）であること。中置演算子の前後の空白は書き手が書くものだが、separateInfix が補う分も同じに読むよう、
// 補った後の綴りで見る。前置・後置にしかならない綴り（`$`・`!!`・`!`・`##`・`###`）は、前置なら被演算子に密着
// させる演算子で、改行をはさんだ下のブロックの前置にはならない（位置は隣接で決まる）ので、ここでは値と同じに断る。
// 前置にも中置にもなる綴り（`-`・`~`・`#`・`@`）は、前の行の末尾で空白に区切られているので中置である。
function endsWithInfixOperator(text) {
  const words = separateInfix(text).trimEnd().split(' ');
  const defs = OPERATOR_DICT[words[words.length - 1]];
  return !!defs && defs.some((d) => d.position === 'infix');
}

// 断りの文面で引く行。続きの行をつないだときの空白の重なりと、文字の改行（`\` + LF）を見える形にする。
const quoted = (s) => s.replace(/ {2,}/g, ' ').replace(/\n/g, '\\n');

function refuseBlockAfterValue(logical, content, q) {
  throw new OperationError(
    `字下げのブロックは、中置の演算子（\`:\`・\`?\` を含む）の右にだけ置けます。この行（TAB ${q} 個の \`${quoted(content)}\`）は、` +
      `値や語、または前置・後置にしかならない演算子で終わる行（\`${quoted(logical)}\`）の下で字下げを深くしています。` +
      "前の行の余積を続けるなら（括りを渡すときも）TAB の後に空白を置きます。",
    { reason: "block-after-value" }
  );
}

// **いちばん外の定義の終わりには空行を1行置く**（利用者 2026-10-17）。関数のブロック・構造体のブロックが終わり、
// しかも定義も終わる所である。ブロックの途中で深さが変わる所（入れ子のブロックの終わり、ブロックの中の定義の
// 終わり）は深さで分かるので要らない。1行で書き終えた定義（ブロックが無い）にも要らない。仮引数のブロックの後に
// `?` の行が続く所は、定義がまだ終わっていないので置かない（`?` の行は定義の行）。ファイルの終わりは、空行が
// 無くても定義の終わりである。行頭のコメントの行は空行に数えない。
//
// 定義かどうかは、いちばん外の行（続きの行をつないだもの）に括りの外の `:` があるかで見る。絶対値・ノルムの囲み
// （`|x : 1|`）の中も括りの中と同じに数える——囲みか中置かは空白の位置が決めるので、密着した `|` で始まる語が開き、
// 密着した `|` で終わる語が閉じる（sign.pegjs の Block の注）。
function hasTopLevelDefine(text) {
  const s = separateInfix(text);
  let depth = 0;
  let word = '';
  const isDefineWord = () => depth === 0 && word === ':';
  const countEnclosure = () => {
    if (word === '|' || word === '||') return;
    if (/^\|\|?[^|]/.test(word)) depth++;
    if (/[^|]\|\|?$/.test(word)) depth--;
  };
  for (let i = 0; i < s.length; ) {
    const ch = s[i];
    if (ch === '\\') {
      word += s.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (ch === '`' || ch === '"') {
      const close = s.indexOf(ch, i + 1);
      if (close === -1) return false;
      word += s.slice(i, close + 1);
      i = close + 1;
      continue;
    }
    if (ch === ' ' || ch === '[' || ch === '(' || ch === '{' || ch === ']' || ch === ')' || ch === '}') {
      if (isDefineWord()) return true;
      countEnclosure();
      word = '';
      if (ch === '[' || ch === '(' || ch === '{') depth++;
      else if (ch !== ' ') depth--;
      i++;
      continue;
    }
    word += ch;
    i++;
  }
  return isDefineWord();
}

function refuseMissingBlankLine(definition, content) {
  throw new OperationError(
    `いちばん外の定義が字下げのブロックで終わったら、空行を1行置いてから次の行を書きます。定義（\`${quoted(definition)}\`）の後の、` +
      `この行（\`${quoted(content)}\`）の前に空行がありません。`,
    { reason: "definition-end-blank-line" }
  );
}

function refuseQuestionAfterClose(content, q) {
  throw new OperationError(
    `${QUESTION_ROW_RULE}この行（TAB ${q} 個の \`${content}\`）は複数の行に書いた括りを閉じた行で、閉じの後ろに \`?\` を続けています` +
      "——`?` は閉じの次の行の頭に置きます",
    { reason: "question-row-indent" }
  );
}

// Indent・Dedentのマーキング関数。**入力は `classifyNewlines` を通したもの**で、処理行は CR で切る。
// 行の中の LF は `\` と組んだ文字の改行であり、行の区切りではない（preprocessor.md §0）。
//
// **TAB 1つが1段である**（利用者の決定 2026-09-15）。深さの変化は段の数だけ INDENT / DEDENT になる——
// 2段深くなれば INDENT INDENT（1段深いブロックが括弧のブロックの代わりになる、つまり入れ子のブロック）、
// 2段戻れば DEDENT DEDENT。だから覚えるのは今の TAB の数だけでよい。
// かつては Python のように「実際に深くなった TAB の数」を積んでいたので、何段跳んでも INDENT は1つで、
// 跳んだ途中の深さへ戻ると、閉じてから開き直した別のブロックになっていた（0→2→1 が `a→b←→c←`）。
function markBlock(input, commentLines = new Set()) {
  const lines = input.split('\r');
  let depth = 0; // 今のブロックの深さ（TAB の数）
  let result = [];
  let lastContentLineIdx = -1;
  // ブラケットが未クローズの間（>0）は、タブ深さの変化をINDENT/DEDENTとして扱わない。
  // markBlockはタブの深さの変化だけを見ており、ブラケットの存在を考慮しないため、
  // ブラケット内側で見た目の可読性のためにタブを深くする書き方（例: function_guide.mdの
  // func_mixed例）をすると、ブラケットの中に本来無いはずのインデントブロックが
  // 二重に差し込まれてパースが壊れる。他の多くの言語のオフサイドルールと同様、
  // ブラケットの中では改行・インデントの意味を一時的に無効化することでこれを防ぐ。
  let bracketDepth = 0;
  // **続きの行**（preprocessor.md §0）。TAB を除いた行頭が空白なら、その行は前の行の続きであり、
  // 前の改行は処理の区切りではない。空白は余積（あるいは中置演算子の前の空白）で、その左辺は前の行にある——
  // だから `1 +` の次の ` 1` は `1 + 1` である。空白は字下げにならない（字下げは TAB だけ）。括弧の中でも
  // 同じで、括弧の中か外かで続きの読みを変えない。空白の無い行は、演算子で始まっても続きにならない（利用者
  // 2026-11-01。前は中置演算子で始まる行も続きだった）。`?` で始まる行だけは定義の行として前の行へつなぐ。
  // いちばん外の空行とコメントの行は越えない（下の sawBlank・sawComment）。
  //
  // かつては行頭の空白を「空白インデント」として断り、`\` + 改行の後だけ許していた（`prevEndsWithEscape`、
  // その後は常に断った）。括弧の中では逆に黙って削っていたので、`(1` の次の ` + 1` は `[1, (+ 1)]` になった。
  //
  // **書いた行の深さ**（`refuseMisplacedQuestionRow` が読む）。続きの行でも括弧の中の行でもない行の TAB の数を、
  // 開いている間だけ浅い順に積む。字下げを跳んで深くなったとき（0 → 2）、途中の段には書いた行が無い。
  // `opened` はその段を**その行が字下げを深くして開いた**か——跳んだ途中の段へ後から戻って書いた行（0 → 3 → 2 の
  // 2）や、閉じた段へ書いた行は開いていない。同じ深さの次の行はその段の印を変えない。
  const written = [];
  // 前の書いた行からこの行までに空行があったか（refuseMissingBlankLine）。
  let sawBlank = false;
  // 前の書いた行からこの行までにコメントの行があったか（式の途中にコメントは置けない）。
  let sawComment = false;
  // 今の行（続きの行をつないだもの）の中身。字下げのブロックが開くとき、その上の行がこれである（refuseBlockAfterValue）。
  let logical = '';
  // いちばん外（TAB 0 個）の文：その行（続きの行をつないだもの）、字下げのブロックを開いたか、定義か。
  let top = { logical: '', hadBlock: false, isDef: false };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 行頭のコメントの行（classifyNewlines が読み捨てた行）。空行には数えない。
    if (commentLines.has(i)) {
      sawComment = true;
      continue;
    }

    // **空の処理行は読み捨てる**（preprocessor.md §0）。ブロックや括弧の中の空行も同じで、残すと
    // 行の区切りが2つ続いて構文が壊れていた。空とは TAB と空白しか無い行である——trim() だと
    // U+3000 や NBSP だけの行まで黙って食っていた。読み捨てるが、在ったことは覚える（定義の終わりの空行）。
    if (/^[\t ]*$/.test(line)) {
      sawBlank = true;
      continue;
    }

    // Sign言語の仕様により、インデントは厳密に \t のみを使用する
    const leadingWsMatch = line.match(/^\t*/);
    const leadingWs = leadingWsMatch ? leadingWsMatch[0] : '';
    // 文字の改行（`\` + LF）の後の TAB は classifyNewlines が落とし済み（preprocessor.md §0）。
    const content = line.substring(leadingWs.length);

    // 継続行の判定。**行頭をそのまま見る**——かつてはここで `content.trim()` していたが、行頭の空白は
    // 余積演算子であって剥がしてよいものではない（preprocess.sn 側の lstrip と同じ穴だった）。
    let isContinuation = content.startsWith(' ') || content.startsWith('?');

    // 行頭の空白の左に続ける行が無い。空白は字下げではないので、ファイルの先頭の空白は断る。
    if (content.startsWith(' ') && lastContentLineIdx === -1) {
      throw new SyntaxError(`行頭の空白は前の行の続きですが、続ける行がありません（字下げは TAB だけです）: ${JSON.stringify(line)}`);
    }

    if (bracketDepth > 0) {
      // 複数の行に書いた括りを閉じた行の後ろの `?`（上の refuseMisplacedQuestionRow の注）。
      if (questionAfterClose(content, bracketDepth)) refuseQuestionAfterClose(content, leadingWs.length);
      // **ブラケットの中ではタブ深さを INDENT/DEDENT に翻訳しない。** 見やすさのために
      // 中を深くインデントする書き方（function_guide.md の func_mixed 例）で、本来無い
      // インデントブロックが二重に差し込まれるのを防ぐ。行頭のタブだけ落として、
      // 改行はそのまま残す——ブロックの縁の EOL は文法の `_e` が受ける。続きの行は外と同じにつなぐ。
      if (isContinuation && lastContentLineIdx !== -1) {
        result[lastContentLineIdx] += ' ' + content;
      } else {
        result.push(content);
        lastContentLineIdx = result.length - 1;
      }
      logical = isContinuation ? logical + ' ' + content.replace(/^ +/, '') : content;
      // 括りの中の行も、いちばん外の文がまだ字下げのブロックを開いていなければ、その文の行である（括りを閉じた行の
      // 後ろの `:` を定義と見るため）。
      if (!top.hadBlock) top.logical += ' ' + content.replace(/^ +/, '');
      sawBlank = false;
      sawComment = false;
      bracketDepth += bracketDelta(content);
      continue;
    }

    const currentIndent = leadingWs.length; // タブの数をインデントレベルとする

    // **式の途中にコメントは置けない**（利用者 2026-11-01）。説明が要るなら、式の上に同じ形のコメントを書く。
    if (isContinuation && sawComment) {
      throw new SyntaxError(`コメントの行の後なので、前の行へ続けられません（説明は式の上に書きます）: ${JSON.stringify(line)}`);
    }
    // **いちばん外の空行は越えない**（問28、利用者の答え 2026-11-01）。ブロックの中の空行は読み捨てる。
    if (isContinuation && sawBlank && (currentIndent === 0 || depth === 0)) {
      if (content.startsWith(' ')) throw new SyntaxError(`行頭の空白は前の行の続きですが、空行の後なので続ける行がありません: ${JSON.stringify(line)}`);
      isContinuation = false;
    }

    // いちばん外の文の始まり。前の文が字下げのブロックを開いた定義なら、その終わりには空行が要る。
    if (!isContinuation && currentIndent === 0) {
      if (top.hadBlock && top.isDef && !sawBlank) refuseMissingBlankLine(top.logical, content);
      top = { logical: content, hadBlock: false, isDef: false };
    } else if (isContinuation && !top.hadBlock) {
      top.logical += ' ' + content.replace(/^ +/, '');
    }

    // `?` で始まる行が付く先は、この行を前の行へつなぐ前（下の DEDENT の前）の深さで決まる。行頭の空白の後の `?`
    // （`\t ? x`）も同じ所に付く——空白は余積で、つないだ後の木は `?` で始まる行と変わらない。
    if (isContinuation && /^ *\?/.test(content) && lastContentLineIdx !== -1) refuseMisplacedQuestionRow(content, currentIndent, depth, written);
    while (written.length > 0 && written[written.length - 1].depth > currentIndent) written.pop();
    if (!isContinuation && (written.length === 0 || written[written.length - 1].depth !== currentIndent)) {
      written.push({ depth: currentIndent, opened: currentIndent > depth });
    }

    // インデントが浅くなった場合、戻った段の数だけ DEDENT マーカーを出力
    if (currentIndent < depth) {
      if (lastContentLineIdx !== -1) {
        result[lastContentLineIdx] += '\x03'.repeat(depth - currentIndent); // DEDENTマーカー
      }
      depth = currentIndent;
    }

    // 続きの行は、浅くなったぶんのブロックを閉じてから（上の DEDENT）前の行へつなぐ。だからブロックの後の
    // 0列目の ` * 2` はブロック全体に掛かり、`\t * 2` は最後の行に掛かる。深い TAB は揃えなので段を増やさない。
    if (isContinuation) {
      if (lastContentLineIdx !== -1) {
        result[lastContentLineIdx] += ' ' + content;
      } else {
        result.push(content);
        lastContentLineIdx = result.length - 1;
      }
    } else if (currentIndent > depth) {
      // ブロックは前の行へ続く物なので、続きの行と同じくコメントの行といちばん外の空行を越えない。
      if (lastContentLineIdx !== -1 && sawComment) {
        throw new SyntaxError(`コメントの行の後なので、前の行の下にブロックを開けません（説明は式の上に書きます）: ${JSON.stringify(line)}`);
      }
      if (lastContentLineIdx !== -1 && sawBlank && depth === 0) {
        throw new SyntaxError(`空行の後なので、前の行の下にブロックを開けません: ${JSON.stringify(line)}`);
      }
      // 字下げのブロックは中置の演算子の右にだけ開ける（refuseBlockAfterValue）。
      if (lastContentLineIdx !== -1 && !endsWithInfixOperator(logical)) refuseBlockAfterValue(logical, content, currentIndent);
      if (depth === 0) {
        top.hadBlock = true;
        top.isDef = hasTopLevelDefine(top.logical);
      }
      // インデントが深くなった場合、深くなった段の数だけ INDENT マーカーを出力
      const indents = '\x02'.repeat(currentIndent - depth); // INDENTマーカー
      depth = currentIndent;
      // 演算子とブロックの間に空白を1つ置く。置かないと、前置にもなる綴り（`-`・`~`・`#`・`@`）がブロックに密着して
      // 前置と読まれる（`1 -` の下の `2` が `1` と `-(ブロック)` の余積になっていた）。
      if (lastContentLineIdx !== -1) {
        result[lastContentLineIdx] += ' ' + indents + content;
      } else {
        result.push(indents + content);
        lastContentLineIdx = result.length - 1;
      }
    } else {
      // インデントが同じ場合
      result.push(content);
      lastContentLineIdx = result.length - 1;
    }

    logical = isContinuation ? logical + ' ' + content.replace(/^ +/, '') : content;
    sawBlank = false;
    sawComment = false;
    bracketDepth += bracketDelta(content);
  }

  // ファイル末尾に達した場合、残っているインデントをすべて（段の数だけ）閉じる
  if (depth > 0 && lastContentLineIdx !== -1) {
    result[lastContentLineIdx] += '\x03'.repeat(depth);
  }

  return result.join('\r');
}

export function preprocess(input) {
  const { text, commentLines } = classifyNewlinesWithComments(input);
  return separateInfix(markBlock(text, commentLines));
}
