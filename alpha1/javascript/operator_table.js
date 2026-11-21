/**
 * Sign言語 演算子テーブル（alpha1、構文の欄だけ）
 *
 * alpha/javascript/operator_table.js（c3b203fc）から、**構文が使う欄だけ**を持ってきた：
 * 段（優先順位）、位置（前置・中置・後置・囲み）、名前、結合の向き。
 *
 * 持ってこなかったもの——命令の綴り（`asm` 欄）、`ASM_BY_NAME`・`ASM_COLUMNS`・`asmOf`、
 * `NOT_YET`・`NOT_AN_INSTRUCTION`、それと各行の命令列の注。どれも機械の側の話で、意味解析より
 * 後で要る。中身は alpha の表（と git の履歴）にそのまま残っている。
 *
 * 単位は `_` だけである（`__` は言語に無い）。この表に単位の行は無い——単位は演算子ではなく字面
 * だから、文法（sign.pegjs）が持つ。
 */
export const OPERATOR_BY_PRECEDENCE = [
  { // 1
    '\\n': { position: 'infix', name: 'newline' },
    '#': { position: 'prefix', name: 'export_internal' },
    '##': { position: 'prefix', name: 'export_external' },
    '###': { position: 'prefix', name: 'export_pin' },
  },
  { // 2
    ':': { position: 'infix', name: 'define' , assoc: 'right' },
  },
  { // 3
    '?': { position: 'infix', name: 'lambda' , assoc: 'right' },
  },
  { // 4
    '#': { position: 'infix', name: 'output', assoc: 'right' },
  },
  { // 5
    ';': { position: 'infix', name: 'xor' },
  },
  { // 6
    '|': { position: 'infix', name: 'or' },
  },
  { // 7
    '&': { position: 'infix', name: 'and' },
  },
  { // 8
    // **`===` は廃止された。** それでも**表から消しては（字句として）いけない。** 消すと `1 === 1` が
    // `==` + `=` に割れて別の意味へ黙って化ける。1つの字句として読ませたうえで、使ったら名指しする。
    '===': { position: 'infix', name: 'same', removed: "ねじれは `p ' 0` と `p ' 名前` の差で導出できます" },
    '==': { position: 'infix', name: 'equal' },
    // 段13 の `!=`（not_equal）と名前が衝突しないよう、こちらは `xnot_equal` を名乗る。
    '!==': { position: 'infix', name: 'xnot_equal' },
  },
  { // 9
    ',': { position: 'infix', name: 'product', assoc: 'right' },
  },
  { // 10
    // 空の段。段の番号は配列の添字＋1 なので、ほかの段の番号を保つために残す（段17 と同じ）。
  },
  { // 11: 空白演算子（余積）。適用になるか構築になるかは意味解析が決める。
    ' ': { position: 'infix', name: 'coproduct' },
  },
  { // 12
    '~': { position: 'infix', name: 'range' },
    '~+': { position: 'infix', name: 'range_arithmetic' },
    '~-': { position: 'infix', name: 'range_arithmetic_rev' },
    '~*': { position: 'infix', name: 'range_geometric' },
    '~/': { position: 'infix', name: 'range_geometric_rev' },
    '~^': { position: 'infix', name: 'range_power' },
  },
  { // 13
    '<': { position: 'infix', name: 'less' },
    '<=': { position: 'infix', name: 'less_equal' },
    '=': { position: 'infix', name: 'assign_equal' },
    '>=': { position: 'infix', name: 'more_equal' },
    '>': { position: 'infix', name: 'more' },
    '!=': { position: 'infix', name: 'not_equal' },
  },
  { // 14
    '+': { position: 'infix', name: 'add' },
    '-': { position: 'infix', name: 'sub' },
  },
  { // 15
    '*': { position: 'infix', name: 'mul' },
    '/': { position: 'infix', name: 'div' },
    '%': { position: 'infix', name: 'mod' },
  },
  { // 16
    '^': { position: 'infix', name: 'pow', assoc: 'right' },
  },
  { // 17
    // 囲みはここには居ない。自己完結しているので優先順位を持たず、ブロックと同じ段にある。
  },
  { // 18
    "'": { position: 'infix', name: 'get_prop' },
    '@': { position: 'infix', name: 'get_at', assoc: 'right' },
  },
  { // 19
    '<<': { position: 'infix', name: 'bit_shift_left' },
    '>>': { position: 'infix', name: 'bit_shift_right' },
  },
  { // 20
    '||': { position: 'infix', name: 'bit_or' },
  },
  { // 21
    ';;': { position: 'infix', name: 'bit_xor' },
  },
  { // 22
    '&&': { position: 'infix', name: 'bit_and' },
  },
  { // 23
    // 後置の印。文法（sign.pegjs の postfix）が核に密着させて項の印にする（R2：印は隣の核1つに付く）。
    '!': { position: 'postfix', name: 'factorial' },
    '~': { position: 'postfix', name: 'expand' },
  },
  { // 24
    // 前置の印。文法（sign.pegjs の prefix）が隣の核1つ（単一の対象か括りの式）に付ける（R2）。前置 `~`（持ち上げ、R79）も
    // ほかの前置の印と同じこの段にあり、`~1 2 3` は `(~1) 2 3`、つまり `[1] 2 3`。前置の印は核に近い物から結ぶ（R57）。
    // 前置の印は段23 の後置の印より先に結ぶので、`~x~` は持ち上げてから下ろす（`~x` に後置 `~` を当てた物、
    // U〔答え〕[2026-11-20 23:14:54 UTC 9f9fd58f]「~x~ は、持ち上げてから持ち下げる」）。
    '~': { position: 'prefix', name: 'continuous' },
    '!': { position: 'prefix', name: 'not' },
    '$': { position: 'prefix', name: 'address' },
    '@': { position: 'prefix', name: 'input' },
    '!!': { position: 'prefix', name: 'bit_not' },
    '-': { position: 'prefix', name: 'negate' },
  },
  { // 25: 後置 `@`（import）は単独の段（「import してから input」の意図と段の番号の慣習を揃えるため）。
    '@': { position: 'postfix', name: 'import' },
  },
  { // 26
    // **囲みはすべてここに居る。** 自己完結しているので優先順位は参照されない（文法が先にブロックへ畳む）。
    '(...)': { position: 'enclosure', name: 'block_paren' },
    '{...}': { position: 'enclosure', name: 'block_brace' },
    '[...]': { position: 'enclosure', name: 'block_bracket' },
    '|...|': { position: 'enclosure', name: 'abs' },
    '||...||': { position: 'enclosure', name: 'norm' },
  },
  { // 27
    '\t': { position: 'prefix', name: 'indent' },
  },
  { // 28
    // **演算としては現れない。** 文法の `charactor` が `\` と直後の1文字を1つの字面として取るので、`\_` も
    // 文字 `_`（U+005F）である（利用者の裁定 2026-09-28）。行は字句の印として残す。
    '\\': { position: 'prefix', name: 'escape' },
  }
];

export const OPERATOR_DICT = {};

// 段の番号は配列の添字＋1（コメントの番号と揃える）。
for (let prec = 0; prec < OPERATOR_BY_PRECEDENCE.length; prec++) {
  const opsAtPrec = OPERATOR_BY_PRECEDENCE[prec];
  if (!opsAtPrec) continue;

  for (const symbol in opsAtPrec) {
    if (!OPERATOR_DICT[symbol]) {
      OPERATOR_DICT[symbol] = [];
    }
    OPERATOR_DICT[symbol].push({
      precedence: prec + 1,
      symbol: symbol,
      ...opsAtPrec[symbol]
    });
  }
}

export function getStrictInfixOperators() {
  const strictInfix = [];
  for (const [symbol, defs] of Object.entries(OPERATOR_DICT)) {
    // `|` / `||` は囲みにもなる（絶対値・ノルム）ので、中置と決めつけて空白を入れない。
    // 前後へ空白を入れると、`|5|` や `||xs||` が `| 5 |` `|| xs ||` になって囲みが壊れる
    // ——**囲みか中置かは空白の位置が決める**ので、レキサーが空白を足してはいけない。
    if (symbol === ' ' || symbol === '|' || symbol === '||') continue;
    const positions = new Set(defs.map(d => d.position));
    if (positions.size === 1 && positions.has('infix')) {
      strictInfix.push(symbol);
    }
  }
  return strictInfix;
}

export function buildLexerRegex() {
  const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const strictInfix = getStrictInfixOperators();
  strictInfix.sort((a, b) => b.length - a.length);
  const infixPattern = strictInfix.map(escapeRegExp).join('|');
  // ダブルクォート文字列の内側は非捕捉グループ `(?:...)` にする。捕捉グループだと、呼び出し側
  // （lexer.js の separateInfix）が想定する「1番目=protect、2番目=operator」の番号が1つずれる。
  // 文字リテラルの `\` は直後の1文字を取る——文字の改行（LF）も含めて（preprocessor.md §0）。`.` は LF を
  // 取らないので `[\s\S]` で取る。
  const regexStr = `(\`[^\`\\r\\n]*\`|\`[^\\r\\n]*|"(?:\\\\.|[^"\\r\\n])*"|\\\\[\\s\\S]|!!)|(${infixPattern})`;
  return new RegExp(regexStr, 'g');
}
