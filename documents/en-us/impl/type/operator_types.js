// 演算子の型定義（documents/ja-jp/impl/type/type_system.md に基づく）
// JavaScript の型判定には .constructor を使用する
// - typeof null === 'object' などの罠を回避できる
// - null/undefined は ?. で安全にアクセスできる


function resolveArithmetic(L, R) {
  // JS の生の数値 (Number) が来た場合は 'Scalar' として返す
  if (L?.constructor === Number) return 'Scalar';
  return L;
}

function getTypeName(t) {
  if (t == null) return 'Unit';                   // null / undefined → Unit
  if (t.constructor === Number) return 'Scalar';  // JS number リテラル → Scalar
  if (t.constructor === String) return 'String';  // Sign 型名文字列 → そのまま返す
  if (t.constructor === Array) return 'List';     // JS 配列 → List
  if (t.constructor === Object) {
    if (t.type === 'Implicit' || t.type === 'Deref') return getTypeName(t.target);
    return t.type;
  }
  return null;
}

export const OPERATOR_TYPES = {
  // --- 前置演算子 ---
  '#_': (R) => ({ type: 'Implicit', target: R }),
  '##_': (R) => ({ type: 'Implicit', target: R }),
  '###_': (R) => ({ type: 'Implicit', target: R }),
  '~_': (R) => {
    return getTypeName(R) === 'List' ? { type: 'Implicit', target: 'List' } : { type: 'Unit' };
  },
  '!_': (R) => R,
  '$_': (R) => {
    // $ は任意の型 T に適用でき Implicit(T) を返す
    // Lambda → Implicit(Lambda): Lambda を Atom として扱う（高階関数渡し）
    // Atom/Address → Implicit(Atom): データのアドレス取得（C言語の &var に相当）
    // $!_ も有効: Implicit(Unit) = Unit のアドレス（非Unit、遅延サスペンド用）
    return { type: 'Implicit', target: R };
  },
  '@_': (R) => {
    if (typeof R !== 'object' || R === null) return { type: 'Unit' };
    if (R.type === 'Implicit') {
      const tName = getTypeName(R);
      if (tName === 'Lambda') {
        // @Implicit(Lambda<returns:T>) = 遅延評価の駆動 → 返値型 T を返す
        return R.target?.returns || { type: 'Deref', target: R };
      }
      // @Implicit(Address/Register/その他) = メモリ読み出し
      return { type: 'Deref', target: R };
    }
    // @!_ = !_（Unit の読み出しは Unit）
    if (getTypeName(R) === 'Unit') return { type: 'Unit' };
    return { type: 'Unit' };
  },
  '!!_': (R) => 'Scalar',
  '-_': (R) => R,

  // --- 後置演算子 ---
  '_!': (L) => getTypeName(L) === 'Scalar' ? 'Scalar' : { type: 'Unit' },
  '_~': (L) => {
    if (L?.constructor === Object && L.type === 'Implicit') {
      const tName = getTypeName(L);
      if (tName === 'List' || tName === 'Dictionary' || tName === 'Atom' || tName === 'String' || tName === 'Scalar') {
        return { type: 'Deref', target: L.target };
      }
    }
    return { type: 'Unit' };
  },
  '_@': (L) => {
    if (L?.constructor === Object && L.type === 'Implicit' && getTypeName(L) === 'Dictionary') {
      return { type: 'Deref', target: L };
    }
    return { type: 'Unit' };
  },

  // --- 中置演算子 ---
  ':': (_, R) => R,
  '?': (L, R) => getTypeName(L) === 'List' ? { type: 'Lambda', returns: R } : { type: 'Unit' },
  '#': (L, R) => getTypeName(L) === 'Address' ? 'Address' : { type: 'Unit' },
  ';': (L, R) => L,
  '|': (L, R) => L,
  '&': (L, R) => L,
  '==': (L, R) => L,
  '!==': (L, R) => L,
  ',': (L, R) => ({ type: 'List', elements: [L, R] }),
  // 空白演算子（coproduct_resolver で解決された後の名前を使用）
  'concat': (L, R) => ({ type: 'List', elements: [L, R] }),
  'compose': (L, R) => ({ type: 'Lambda', returns: L?.returns || { type: 'Compose', left: L, right: R } }),
  'apply': (L, R) => L?.returns || { type: 'Apply', left: L, right: R },
  'apply_reverse': (L, R) => R?.returns || { type: 'Apply', left: R, right: L },
  '~': (L, R) => (L === 'Scalar' || L === 'Iterator') && R === 'Scalar' ? 'Stream' : 'Unit',
  '~-': (L, R) => L === 'Scalar' && R === 'Scalar' ? 'Iterator' : 'Unit',
  '~+': (L, R) => L === 'Scalar' && R === 'Scalar' ? 'Iterator' : 'Unit',
  '~*': (L, R) => L === 'Scalar' && R === 'Scalar' ? 'Iterator' : 'Unit',
  '~/': (L, R) => L === 'Scalar' && R === 'Scalar' ? 'Iterator' : 'Unit',
  '~^': (L, R) => L === 'Scalar' && R === 'Scalar' ? 'Iterator' : 'Unit',
  '<': (L, R) => L === 'Scalar' && R === 'Scalar' ? 'Number' : 'Unit',
  '<=': (L, R) => L === 'Scalar' && R === 'Scalar' ? 'Number' : 'Unit',
  '=': (L, R) => L === 'Scalar' && R === 'Scalar' ? 'Number' : 'Unit',
  '>=': (L, R) => L === 'Scalar' && R === 'Scalar' ? 'Number' : 'Unit',
  '>': (L, R) => L === 'Scalar' && R === 'Scalar' ? 'Number' : 'Unit',
  '!=': (L, R) => L === 'Scalar' && R === 'Scalar' ? 'Number' : 'Unit',
  '+': resolveArithmetic,
  '-': resolveArithmetic,
  '*': resolveArithmetic,
  '/': resolveArithmetic,
  '%': resolveArithmetic,
  '^': resolveArithmetic,
  'abs': (L, R) => L,
  "'": (L, R) => ({ type: 'Deref', target: R }),
  '@': (L, R) => ({ type: 'Deref', target: L }),
  '<<': (L, R) => (getTypeName(L) === 'Address' || getTypeName(L) === 'Register') ? L : { type: 'Unit' },
  '>>': (L, R) => (getTypeName(L) === 'Address' || getTypeName(L) === 'Register') ? L : { type: 'Unit' },
  '||': (L, R) => (getTypeName(L) === 'Address' || getTypeName(L) === 'Register') ? L : { type: 'Unit' },
  ';;': (L, R) => (getTypeName(L) === 'Address' || getTypeName(L) === 'Register') ? L : { type: 'Unit' },
  '&&': (L, R) => (getTypeName(L) === 'Address' || getTypeName(L) === 'Register') ? L : { type: 'Unit' },
};
