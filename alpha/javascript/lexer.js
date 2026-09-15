/**
 * Sign Language Lexer (前処理フェーズ)
 * pre_alpha/lexisize/lexer.js から移植（変更なし、動作確認済み）
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

import { buildLexerRegex } from './operator_table.js';

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
  const n = input.length;
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
        continue;
      }
    }
    const w = newlineWidth(i);
    if (w) {
      out += '\r';
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
  return out;
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

// Indent・Dedentのマーキング関数。**入力は `classifyNewlines` を通したもの**で、処理行は CR で切る。
// 行の中の LF は `\` と組んだ文字の改行であり、行の区切りではない（preprocessor.md §0）。
//
// **TAB 1つが1段である**（利用者の決定 2026-09-15）。深さの変化は段の数だけ INDENT / DEDENT になる——
// 2段深くなれば INDENT INDENT（1段深いブロックが括弧のブロックの代わりになる、つまり入れ子のブロック）、
// 2段戻れば DEDENT DEDENT。だから覚えるのは今の TAB の数だけでよい。
// かつては Python のように「実際に深くなった TAB の数」を積んでいたので、何段跳んでも INDENT は1つで、
// 跳んだ途中の深さへ戻ると、閉じてから開き直した別のブロックになっていた（0→2→1 が `a→b←→c←`）。
function markBlock(input) {
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
  // **続きの行**（preprocessor.md §0）。TAB を除いた行頭が空白か中置演算子なら、その行は前の行の続きであり、
  // 前の改行は処理の区切りではない。空白は余積（あるいは中置演算子の前の空白）で、その左辺は前の行にある——
  // だから `1 +` の次の ` 1` は `1 + 1` である。空白は字下げにならない（字下げは TAB だけ）。括弧の中でも
  // 同じで、括弧の中か外かで続きの読みを変えない。
  //
  // かつては行頭の空白を「空白インデント」として断り、`\` + 改行の後だけ許していた（`prevEndsWithEscape`、
  // その後は常に断った）。括弧の中では逆に黙って削っていたので、`(1` の次の ` + 1` は `[1, (+ 1)]` になった。

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // **空の処理行は読み捨てる**（preprocessor.md §0）。ブロックや括弧の中の空行も同じで、残すと
    // 行の区切りが2つ続いて構文が壊れていた。空とは TAB と空白しか無い行である——trim() だと
    // U+3000 や NBSP だけの行まで黙って食っていた。
    if (/^[\t ]*$/.test(line)) {
      continue;
    }

    // Sign言語の仕様により、インデントは厳密に \t のみを使用する
    const leadingWsMatch = line.match(/^\t*/);
    const leadingWs = leadingWsMatch ? leadingWsMatch[0] : '';
    // 文字の改行（`\` + LF）の後の TAB は classifyNewlines が落とし済み（preprocessor.md §0）。
    const content = line.substring(leadingWs.length);

    // 継続行の判定。**行頭をそのまま見る**——かつてはここで `content.trim()` していたが、行頭の空白は
    // 余積演算子であって剥がしてよいものではない（preprocess.sn 側の lstrip と同じ穴だった）。
    //
    // **行頭の `|` / `||` が「続き」なのは、空白が続くときだけである。** 密着していれば
    // それは囲みの開き（絶対値・ノルム）であって中置演算子ではない——`||xs||` を続きと
    // 読むと、インデントブロックの境界がずれる（枝が1つ header へ吸い込まれていた）。
    // `.` は演算子表に無いので、行頭に来ても継続行にはなりえない（かつては文法の
    // 文字クラスが `'-=` をレンジとして読み、`.` を演算子として受理していた名残）。
    const isContinuation = content.startsWith(' ') || /^[?+*\/,=<>;%&^]/.test(content) || /^!=(?:=)?/.test(content) || /^\|\|? /.test(content) || /^~(?: |[+*\/\^-])/.test(content);

    // 行頭の空白の左に続ける行が無い。空白は字下げではないので、ファイルの先頭の空白は断る。
    if (content.startsWith(' ') && lastContentLineIdx === -1) {
      throw new SyntaxError(`行頭の空白は前の行の続きですが、続ける行がありません（字下げは TAB だけです）: ${JSON.stringify(line)}`);
    }

    if (bracketDepth > 0) {
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
      bracketDepth += bracketDelta(content);
      continue;
    }

    const currentIndent = leadingWs.length; // タブの数をインデントレベルとする

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
      // インデントが深くなった場合、深くなった段の数だけ INDENT マーカーを出力
      const indents = '\x02'.repeat(currentIndent - depth); // INDENTマーカー
      depth = currentIndent;
      if (lastContentLineIdx !== -1) {
        result[lastContentLineIdx] += indents + content;
      } else {
        result.push(indents + content);
        lastContentLineIdx = result.length - 1;
      }
    } else {
      // インデントが同じ場合
      result.push(content);
      lastContentLineIdx = result.length - 1;
    }

    bracketDepth += bracketDelta(content);
  }

  // ファイル末尾に達した場合、残っているインデントをすべて（段の数だけ）閉じる
  if (depth > 0 && lastContentLineIdx !== -1) {
    result[lastContentLineIdx] += '\x03'.repeat(depth);
  }

  return result.join('\r');
}

export function preprocess(input) {
  return separateInfix(
    markBlock(classifyNewlines(input))
  );
}
