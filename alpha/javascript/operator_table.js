/**
 * Sign言語 演算子テーブル (正引き・逆引き)
 * documents/ja-jp/impl/syntax/operator_table.js から移植（正式仕様、変更なし）
 */

export const OPERATOR_BY_PRECEDENCE = [
  { // 1
    '\\n': { position: 'infix', name: 'newline' },
    '#': { position: 'prefix', name: 'export_internal' },
    '##': { position: 'prefix', name: 'export_external' },
    '###': { position: 'prefix', name: 'export_pin' },
  },
  { // 2
    ':': { position: 'infix', name: 'define' },
  },
  { // 3
    '?': { position: 'infix', name: 'lambda' },
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
    '===': { position: 'infix', name: 'same' },
    '==': { position: 'infix', name: 'equal' },
    // 8/6修正: 以前は'!='(tier12)と同じ'not_equal'だったため、operator_table.js自身の
    // 中で.nameが衝突しており、コード側は.op（記号そのもの）で区別する回避策に頼っていた
    // （pass3.js/interpreter.js参照）。operator_table.mdが元々使っていた'xnot_equal'に
    // 改名し、衝突そのものを解消した（既存の.opベースの区別ロジックは引き続き正しく動く
    // ため、この改名による挙動の変化は無い——念のため残してある）。
    '!==': { position: 'infix', name: 'xnot_equal' },
  },
  { // 9
    ',': { position: 'infix', name: 'product', assoc: 'right' },
  },
  { // 10: 前置 `~`（持ち上げ）。積（`,`）の隣であり、余積（空白）より緩い。
    // system_semantics.md の待機の表が「前置 `~`（持ち上げ）は**余積を一回**待機状態に
    // 入れる（サスペンド）」と述べている通り、被演算子は余積である。したがって余積より
    // 緩くなければ余積を掴めない——以前は他の前置演算子と同じ最内（旧tier23）に置かれて
    // おり、`~1 2 3` が `(~1) 2 3` に切れて型エラーになっていた。
    //
    // `$`/`@` が最内のままなのは、作用する対象が違うからである。`$` は単一の値に作用する
    // ので対象はアトム、前置 `~` は構造に作用するので対象は構造を作る演算子（`,`・空白）の
    // 段にある。「演算子の優先度は、作用対象を構築する演算子の優先度に合わせる」。
    //
    // 後置 `~`（展開）は余積より内側でありさえすればよいので、動かしていない（旧tier22）。
    // `list ' N~`（get-rest）が `'`（tier19）より内側であることに依存しているため、
    // ここまで下げると壊れる。
    '~': { position: 'prefix', name: 'continuous' },
  },
  { // 11: 空白演算子（適用、リスト構築等）
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
    '!': { position: 'postfix', name: 'factorial' },
    '~': { position: 'postfix', name: 'expand' },
  },
  { // 24
    // 前置 `~`（continuous）は tier 10 へ移した（そちらのコメント参照）。
    '!': { position: 'prefix', name: 'not' },
    '$': { position: 'prefix', name: 'address' },
    '@': { position: 'prefix', name: 'input' },
    '!!': { position: 'prefix', name: 'bit_not' },
    '-': { position: 'prefix', name: 'negate' },
    // 【8/6 撤去】'><' (reverse)。documents/ja-jp/impl/syntax/operator_table.js と同時に
    // 撤去——list_model.md §2.5のrest記法の位置一般化で代替できるため不要と判断。
  },
  { // 25: postfix @（import）は単独tier（8/6、documents/ja-jp/impl/syntax/operator_table.js
    // と同時に修正——「importしてからinput」の意図とtier番号の慣習の整合性のため）。
    '@': { position: 'postfix', name: 'import' },
  },
  { // 26（旧24から繰り下げ）
    // **囲みはすべてここに居る。** 自己完結しているので優先順位は参照されない
    // ——`pass2` は囲みの tier を一度も引かない（文法が先にブロックへ畳む）。
    // 絶対値だけ別の段に書かれていたのは帳簿のズレで、実装は最初からここと同じ挙動だった。
    '(...)': { position: 'enclosure', name: 'block_paren' },
    '{...}': { position: 'enclosure', name: 'block_brace' },
    '[...]': { position: 'enclosure', name: 'block_bracket' },
    '|...|': { position: 'enclosure', name: 'abs' },
    '||...||': { position: 'enclosure', name: 'norm' },
  },
  { // 27（旧25から繰り下げ）
    '\t': { position: 'prefix', name: 'indent' },
  },
  { // 28（旧26から繰り下げ）
    '\\': { position: 'prefix', name: 'escape' },
  }
];

export const OPERATOR_DICT = {};

// 【修正済み】以前は `prec = 1` から始めていたため、配列index 0（コメント上の優先順位"1"：
// 改行・前置export `#`/`##`/`###`）が一生 OPERATOR_DICT に登録されなかった。しかも
// `precedence: prec` は配列indexをそのまま使っていたため、他の全演算子もコメントの
// 優先順位表記より1つ小さい値で格納されていた（例: `:`はコメント"2"だが precedence=1
// として格納）。tier間の相対順序（どれがどれより先に処理されるか）はズレが一律だった
// ため偶然壊れずに動いていたが、pass2.js の reduceOnce が余積（スペース）を判定する
// ハードコードされた `tier === 10`（コメント通りの優先順位10を前提にしている）が、
// このバグにより実際にはコメント優先順位"11"のレンジ演算子（`~+`等）の格納値と衝突していた。
// `prec`を配列indexそのまま(0始まり)にし、`precedence: prec + 1`でコメント表記と一致させて解消。
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

export function getPolysemousOperators() {
  const polysemous = new Set();
  for (const [symbol, defs] of Object.entries(OPERATOR_DICT)) {
    if (symbol === ' ' || symbol === '\t') continue;
    const positions = new Set(defs.map(d => d.position));
    if (positions.size > 1 || positions.has('enclosure')) {
      polysemous.add(symbol);
    }
  }
  // `|` と `||` は囲みの delimiter でもある（絶対値・ノルム）。中置としか思わずに
  // 前後へ空白を入れると、`|5|` や `||xs||` が `| 5 |` `|| xs ||` になって囲みが壊れる
  // ——**囲みか中置かは空白の位置が決める**ので、レキサーが空白を足してはいけない。
  polysemous.add('|');
  polysemous.add('||');
  return Array.from(polysemous);
}

export function getStrictInfixOperators() {
  const strictInfix = [];
  for (const [symbol, defs] of Object.entries(OPERATOR_DICT)) {
    // `|` / `||` は囲みにもなる（絶対値・ノルム）ので、中置と決めつけて空白を入れない。
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
  // 【修正済み】ダブルクォート文字列の内側 `(\\.|[^"\r\n])*` が捕捉グループのままだと、
  // 呼び出し側（lexer.jsのseparateInfix）が想定する「1番目=protect、2番目=operator」という
  // グループ番号が1つずれてしまい、operator側が常にundefinedになる（strictInfixによる
  // 演算子前後への自動スペース挿入が事実上一切機能しなくなる）バグがあった。
  // 非捕捉グループ `(?:...)` に変更して解消。
  const regexStr = `(\`[^\`\\r\\n]*\`|\`[^\\r\\n]*|"(?:\\\\.|[^"\\r\\n])*"|\\\\.|!!)|(${infixPattern})`;
  return new RegExp(regexStr, 'g');
}
