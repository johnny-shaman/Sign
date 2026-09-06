/**
 * Sign言語 演算子テーブル (正引き・逆引き)
 * `A_Operator_Table.md` に基づく定義
 */

// 逆引き用: 優先順位順の配列 (precedens順)
// 配列のインデックスがそのまま優先順位 (precedence) を表します。インデックス0は未使用。
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
    '#': { position: 'infix', name: 'output' },
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
    // **`===` は廃止された。** 唯一の役目だった「ねじれ（宣言順の置換）の同定」は、
    // 2つの引き方の差で導出できる——`p ' 0` と `p ' 名前` が一致すれば恒等置換である
    // （type_system.md §6.2 が元からそう書いていた）。しかも宣言順はコンパイル時の性質
    // なので、実行時の演算子では答えられない（呼び出しサイトごとに置換が違うと決まらない）。
    //
    // **表から消しては（字句として）いけない。** 消すと `1 === 1` が `==` + `=` に割れて
    // `construct(1, assign_equal(atom "==", 1))` という別の意味へ黙って化ける。1つの字句
    // として読ませたうえで、使ったら pass3 が名指しする。
    '===': { position: 'infix', name: 'same', removed: "ねじれは `p ' 0` と `p ' 名前` の差で導出できます" },
    '==': { position: 'infix', name: 'equal' },
    // 8/6修正: 以前は'!='(tier12)と同じ'not_equal'だったため、この演算子テーブル自身の
    // 中で.nameが衝突していた（`documents/ja-jp/impl/syntax/operator_table.md`が元々
    // 使っていた'xnot_equal'に改名して解消）。
    '!==': { position: 'infix', name: 'xnot_equal' },
  },
  { // 9
    ',': { position: 'infix', name: 'product' },
  },
  { // 10: 空白演算子（適用、リスト構築等）
    ' ': { position: 'infix', name: 'coproduct' },
  },
  { // 11
    '~': { position: 'infix', name: 'range' },
    '~+': { position: 'infix', name: 'range_arithmetic' },
    '~-': { position: 'infix', name: 'range_arithmetic_rev' },
    '~*': { position: 'infix', name: 'range_geometric' },
    '~/': { position: 'infix', name: 'range_geometric_rev' },
    '~^': { position: 'infix', name: 'range_power' },
  },
  { // 12
    '<': { position: 'infix', name: 'less' },
    '<=': { position: 'infix', name: 'less_equal' },
    '=': { position: 'infix', name: 'assign_equal' },
    '>=': { position: 'infix', name: 'more_equal' },
    '>': { position: 'infix', name: 'more' },
    '!=': { position: 'infix', name: 'not_equal' },
  },
  { // 13
    '+': { position: 'infix', name: 'add' },
    '-': { position: 'infix', name: 'sub' },
  },
  { // 14
    '*': { position: 'infix', name: 'mul' },
    '/': { position: 'infix', name: 'div' },
    '%': { position: 'infix', name: 'mod' },
  },
  { // 15
    '^': { position: 'infix', name: 'pow' },
  },
  { // 16
    // 囲みはここには居ない。自己完結しているので優先順位を持たず、ブロックと同じ段にある。
  },
  { // 17
    "'": { position: 'infix', name: 'get_prop' },
    '@': { position: 'infix', name: 'get_at' },
  },
  { // 18
    '<<': { position: 'infix', name: 'bit_shift_left' },
    '>>': { position: 'infix', name: 'bit_shift_right' },
  },
  { // 19
    '||': { position: 'infix', name: 'bit_or' },
  },
  { // 20
    ';;': { position: 'infix', name: 'bit_xor' },
  },
  { // 21
    '&&': { position: 'infix', name: 'bit_and' },
  },
  { // 22
    '!': { position: 'postfix', name: 'factorial' },
    '~': { position: 'postfix', name: 'expand' },
  },
  { // 23
    '~': { position: 'prefix', name: 'continuous' },
    '!': { position: 'prefix', name: 'not' },
    '$': { position: 'prefix', name: 'address' },
    '@': { position: 'prefix', name: 'input' },
    '!!': { position: 'prefix', name: 'bit_not' },
    '-': { position: 'prefix', name: 'negate' }, // 仕様書に明記は無いが事実上の前置演算子（8/6: 符号反転は算術演算のため、代数式の優先順位に従いpow(15)より上に置く。この点はoperator_table.mdへの明記が必要）
    // 【8/6 撤去】'><': reverse（リスト反転）。専用演算子を新設せずとも、rest記法の
    // 位置一般化（list_model.md §2.5、`[~head tail]`のような末尾からの分割代入）で
    // リストを末尾から辿る計算は表現できるため不要と判断。加えて`><`（`<>`の鏡像）は
    // 古いBASIC/Pascal/SQLで「等しくない」を表す記号として広く定着しており、Signの
    // 「記号の自然な意味と操作的意味の一致」という設計原則にも反していた
    // （そもそも「等しくない」はSignでは`!=`が既に担っている）。
  },
  { // 24: postfix @（import）は単独tier。8/6: 以前はtier22（factorial/expandと同居）に
    // 間借りしていたが、operator_table.mdは単独tier(24、prefix @/inputのtier23より上)を
    // 割り当てており、「importしてからinput」（`@`\`add.sn\`@`` → `input(import(...))`、
    // 実際にresolveDensityで確認済み）という意図と、tier番号を大きい方が優先＝先に
    // 結合されるという慣習に、.mdの配置の方が整合していたため、こちらに合わせた
    // （resolveDensityは前置/後置演算子ではprecedence数値自体を参照しないため、この
    // 修正は現状のパース挙動には影響しない——あくまで仕様記述としての正確さの修正）。
    '@': { position: 'postfix', name: 'import' },
  },
  { // 25（旧24から繰り下げ）
    // **囲みはすべてここに居る。** 自己完結しているので優先順位は参照されない
    // ——`pass2` は囲みの tier を一度も引かない（文法が先にブロックへ畳む）。
    // 絶対値だけ別の段に書かれていたのは帳簿のズレで、実装は最初からここと同じ挙動だった。
    '(...)': { position: 'enclosure', name: 'block_paren' },
    '{...}': { position: 'enclosure', name: 'block_brace' },
    '[...]': { position: 'enclosure', name: 'block_bracket' },
    '|...|': { position: 'enclosure', name: 'abs' },
    '||...||': { position: 'enclosure', name: 'norm' },
  },
  { // 26（旧25から繰り下げ）
    '\t': { position: 'prefix', name: 'indent' },
  },
  { // 27（旧26から繰り下げ）
    '\\': { position: 'prefix', name: 'escape' },
  }
];

// 正引き用: 記号をキーとした辞書型 (symbol -> definitions array)
// 逆引きの配列から動的に生成する
export const OPERATOR_DICT = {};

// 【修正済み】以前は `prec = 1` から始めていたため、配列index 0（コメント上の優先順位"1"：
// 改行・前置export `#`/`##`/`###`）が一生 OPERATOR_DICT に登録されなかった。しかも
// `precedence: prec` は配列indexをそのまま使っていたため、他の全演算子もコメントの
// 優先順位表記より1つ小さい値で格納されていた。`prec`を配列indexそのまま(0始まり)にし、
// `precedence: prec + 1`でコメント表記と一致させて解消。
for (let prec = 0; prec < OPERATOR_BY_PRECEDENCE.length; prec++) {
  const opsAtPrec = OPERATOR_BY_PRECEDENCE[prec];
  if (!opsAtPrec) continue;

  for (const symbol in opsAtPrec) {
    if (!OPERATOR_DICT[symbol]) {
      OPERATOR_DICT[symbol] = [];
    }
    // 元の構造と同等のオブジェクトを再構築して正引き辞書に追加
    OPERATOR_DICT[symbol].push({
      precedence: prec + 1,
      symbol: symbol,
      ...opsAtPrec[symbol]
    });
  }
}

/**
 * ユーティリティ: 多義的演算子（複数の position を持つか、enclosure として機能するもの）を取得する
 */
export function getPolysemousOperators() {
  const polysemous = new Set();
  for (const [symbol, defs] of Object.entries(OPERATOR_DICT)) {
    if (symbol === ' ' || symbol === '\t') continue; // 空白系は除外
    const positions = new Set(defs.map(d => d.position));
    if (positions.size > 1 || positions.has('enclosure')) {
      polysemous.add(symbol);
    }
  }
  // 絶対値ブロック |...| の存在により、中置演算子の | も実質的に多義的な振る舞いをするため追加
  polysemous.add('|');
  return Array.from(polysemous);
}

/**
 * ユーティリティ: 純粋な中置演算子（中置機能しか持たないもの）を取得する
 */
export function getStrictInfixOperators() {
  const strictInfix = [];
  for (const [symbol, defs] of Object.entries(OPERATOR_DICT)) {
    // 空白は除外。また、| は絶対値ブロックと記号が被るため、自動空白挿入の対象外とする
    if (symbol === ' ' || symbol === '|') continue;

    const positions = new Set(defs.map(d => d.position));
    if (positions.size === 1 && positions.has('infix')) {
      strictInfix.push(symbol);
    }
  }
  return strictInfix;
}

/**
 * ユーティリティ: Lexer用の正規表現生成器
 * strict infix のみを長い順にマッチさせる正規表現などを生成できる
 */
export function buildLexerRegex() {
  const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // 多義的演算子などを除いた、確実に前後に空白を挿入してよい演算子のリスト
  const strictInfix = getStrictInfixOperators();
  // 長い順にソート (例: !== が != や = より先にマッチするように)
  strictInfix.sort((a, b) => b.length - a.length);

  // 例: (!==|!=|==|<=|>=|<<|>>|\|\||;;|&&|~\+|~-|~\*|~\/|~\^|...)
  const infixPattern = strictInfix.map(escapeRegExp).join('|');

  // 今回はユーザーの `separateInfix` に合わせて、 `!!` などを保護対象に含める
  // （ユーザーの元の正規表現を踏襲しつつ、動的に生成する）
  const regexStr = `(\`[^\`\\r\\n]*\`|\`[^\\r\\n]*|"(\\\\.|[^"\\r\\n])*"|\\\\.|!!)|(${infixPattern})`;

  return new RegExp(regexStr, 'g');
}
