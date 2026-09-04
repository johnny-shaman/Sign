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

// Indent・Dedentのマーキング関数
function markBlock(input) {
  const lines = input.split(/\r?\n/);
  const indentStack = [0];
  let result = [];
  let lastContentLineIdx = -1;
  // ブラケットが未クローズの間（>0）は、タブ深さの変化をINDENT/DEDENTとして扱わない。
  // markBlockはタブの深さの変化だけを見ており、ブラケットの存在を考慮しないため、
  // ブラケット内側で見た目の可読性のためにタブを深くする書き方（例: function_guide.mdの
  // func_mixed例）をすると、ブラケットの中に本来無いはずのインデントブロックが
  // 二重に差し込まれてパースが壊れる。他の多くの言語のオフサイドルールと同様、
  // ブラケットの中では改行・インデントの意味を一時的に無効化することでこれを防ぐ。
  let bracketDepth = 0;
  // grammar（sign.pegjs）の Block 規則 `"[" _ exprs:Expressions _ "]"` は、
  // `_` がスペースのみでEOLを許さないため、開き括弧の直後・閉じ括弧の直前に
  // 改行があってはならない（複数行ある場合の「間」の統計行だけがEOL区切りを許される）。
  // そのため、ブラケットを開いた直後の最初の行と、閉じて深さが0に戻る行は、
  // 改行を挟まず直前の行にくっつける。
  let justOpenedBracket = false;
  // **行頭のスペースが許されるのは、それが余積演算子であるときだけである。**
  // 直前の行が文字リテラルの `\` で終わっていれば、`\` は改行そのものを1バイトとして
  // 食っている（operator_table.md 特殊記号「直後の1文字を文字として扱う」）。すると
  // 次の行の行頭スペースは字下げではなく、その文字と右辺を繋ぐ**余積**である
  // （同 基本原則「全ての空白を余積演算子と見なせる」）。落とすと右辺が宙に浮き、
  // 値が黙って変わる。それ以外の行頭スペースは空白インデントであり、
  // match_case.md「TABのみ・空白インデントはNG」により受け付けない。
  //
  // かつてここは「スペース1個までは黙って無視、2個以上はエラー」という閾値だった。
  // 1個を許していたのは上の余積を通すためだが、閾値は仕様のどこにも無く、
  // ついでに ` ?`（行頭スペース＋?）という仕様に無い仮引数ブロックの綴りも通していた。
  let prevEndsWithEscape = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 空行や空白のみの行はそのまま追加し、インデントの深さ計算から除外
    if (line.trim() === '') {
      result.push(line);
      continue;
    }

    // Sign言語の仕様により、インデントは厳密に \t のみを使用する
    const leadingWsMatch = line.match(/^\t*/);
    const leadingWs = leadingWsMatch ? leadingWsMatch[0] : '';
    const content = line.substring(leadingWs.length);

    // タブを全部消費してもなお行頭にスペースが残っている＝スペースインデント（またはタブ+
    // スペース混在）の疑い。スペース1個までは（grammarの`_`が元々許容する程度の余白として）
    // 黙って無視するが、2個以上はスペースインデントの意図とみなし明確な構文エラーにする
    // （黙って独立したトップレベル文として誤解釈されるのを防ぐ）。ブラケット内
    // （bracketDepth>0）ではインデント自体が意味を持たない（整形用の空白は無害）ため対象外。
    if (bracketDepth === 0 && content.startsWith(' ') && !prevEndsWithEscape) {
      throw new SyntaxError(
        `Signのインデントは厳密にタブ文字(\\t)のみです。行頭のスペースが許されるのは、` +
          `直前の行が文字リテラルの \\ で終わっていて、そのスペースが余積演算子である場合だけです: ${JSON.stringify(line)}`
      );
    }
    prevEndsWithEscape = /(^|[^\\])(\\\\)*\\$/.test(line);

    if (bracketDepth > 0) {
      const newDepth = bracketDepth + bracketDelta(content);
      if (justOpenedBracket || newDepth <= 0) {
        // 開いた直後の最初の行、または閉じ括弧を含んで深さが0に戻る行は、
        // 改行を挟まず前の行にくっつける（grammar上、"["直後・"]"直前にはEOL不可のため）。
        result[lastContentLineIdx] += content;
      } else {
        // 開始・終了以外の中間行は、複数文として改行区切りのまま新しい行で追加する
        // （Expressionsの `(EOL _ Expression)*` がこの形を前提としている）。
        result.push(content);
        lastContentLineIdx = result.length - 1;
      }
      justOpenedBracket = false;
      bracketDepth = newDepth;
      continue;
    }

    const currentIndent = leadingWs.length; // タブの数をインデントレベルとする

    let prefix = '';

    // インデントが浅くなった場合、スタックをポップしてDEDENTマーカーを出力
    while (indentStack.length > 1 && currentIndent < indentStack[indentStack.length - 1]) {
      indentStack.pop();
      if (lastContentLineIdx !== -1) {
        result[lastContentLineIdx] += '\x03'; // DEDENTマーカー
      }
    }

    // 継続行の判定 (行頭が中置演算子などで始まる場合)
    const contentTrimmed = content;
    // **行頭の `|` / `||` が「続き」なのは、空白が続くときだけである。** 密着していれば
    // それは囲みの開き（絶対値・ノルム）であって中置演算子ではない——`||xs||` を続きと
    // 読むと、インデントブロックの境界がずれる（枝が1つ header へ吸い込まれていた）。
    const isContinuation = /^[?+*\/\.,=<>;%&^]/.test(contentTrimmed) || /^!=(?:=)?/.test(contentTrimmed) || /^\|\|?\s/.test(contentTrimmed) || /^~(?:\s|[+*\/\^-])/.test(contentTrimmed);

    if (isContinuation) {
      if (lastContentLineIdx !== -1) {
        result[lastContentLineIdx] += ' ' + content;
      } else {
        result.push(prefix + content);
        lastContentLineIdx = result.length - 1;
      }
    } else if (currentIndent > indentStack[indentStack.length - 1]) {
      // インデントが深くなった場合
      indentStack.push(currentIndent);
      if (lastContentLineIdx !== -1) {
        result[lastContentLineIdx] += '\x02' + content; // INDENTマーカー
      } else {
        result.push('\x02' + content);
        lastContentLineIdx = result.length - 1;
      }
    } else {
      // インデントが同じ場合
      result.push(prefix + content);
      lastContentLineIdx = result.length - 1;
    }

    const depthBefore = bracketDepth;
    bracketDepth += bracketDelta(content);
    justOpenedBracket = depthBefore === 0 && bracketDepth > 0;
  }

  // ファイル末尾に達した場合、残っているインデントをすべて閉じる
  while (indentStack.length > 1) {
    indentStack.pop();
    if (lastContentLineIdx !== -1) {
      result[lastContentLineIdx] += '\x03';
    }
  }

  return result.join('\n');
}

export function preprocess(input) {
  return separateInfix(
    markBlock(input)
  );
}
