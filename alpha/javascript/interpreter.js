import { charLimitOf, DEFAULT_CHARSET, literalDigits, literalParts } from "./target_info.js";

/**
 * 最小インタプリタ（評価器）。Pass2/Pass1bが構築した二分木ASTを実際に評価して値を出す。
 *
 * 【スコープ】今回の最初の実装は以下に限定する（既知の制限）：
 * - `$`/`@`/`#`（アドレス取得・デリファレンス・ストア）は未対応。メモリモデルが必要な
 *   ため別途の設計課題とする。
 * - block（List/Struct/Struct）の評価はシンプルなJS配列/オブジェクトへのマッピングに留める。
 * - TCO・末尾呼び出し最適化は行わない（JSの通常の再帰呼び出しに委ねる）。
 *
 * 【実装した中核の意味論】
 * - 完全性公理（type_system.md §3.4）：`f __ = __`。引数のいずれかがUnit（デフォルト値も
 *   rest~のフォールバックも無い場合）なら、本体を評価せず即座にUnitを返す。
 * - デフォルト引数へのUnitフォールバック（§3.4）：デフォルトを持つ仮引数にUnitが渡されたら
 *   デフォルト式（let*的に、直前までの束縛を使って）を評価する。
 * - restパラメータへのUnitフォールバック（§3.3）：restの実引数が無い、またはUnit単体なら
 *   空リストにフォールバックする（完全性公理による崩壊は起きない）。
 * - 算術演算子のUnit伝播則（§3.3）：**両辺とも単位元**（爆発律）。算術は積を食って
 *   同じ対象を返すので、片方が始対象なら残った方が通り抜ける——`__` は強さの底である。
 * - 比較演算子の吸収則（§3.3）：両辺とも吸収元。`!=`のみ例外で右辺Unitは単位元。
 * - `&`/`|`/`;`の短絡評価（AGENTS.md）：`&`は左辺がUnitなら右辺を評価せず即座にUnit、
 *   `|`は左辺がUnitでなければ右辺を評価せず左辺を返す。
 * - 多引数関数（`params[]`）の一括適用：pass2.jsのapplyChainInfoと対称に、apply連鎖を
 *   遡って引数を全部集めてから一度だけ本体を評価する（カリー化された中間クロージャは
 *   生成しない、今日合意した「単一`?`＝一括束縛・タダ」という設計に対応）。
 * - 未定義識別子のUnit収束（unit.md §0.1）：どのスコープにも見つからない識別子は例外を
 *   投げず`__`へフォールバックする。この収束は非ブロッキングな"information"診断として
 *   `env.diagnostics`（ルート env から共有される配列）に記録する。仮想キーワードとしての
 *   意図的な利用（`@lazy tick`等）を委縮させないため、warning/cautionへは格上げしない
 *   （末尾位置の警告はtco.md §3の領域でありTCO解析が無い本インタプリタでは対象外）。
 */

// Unit（__）の実行時における一意な番人（sentinel）。Symbolなので他のどんな値とも衝突しない。
const UNIT = Symbol("Sign.Unit");

// unit.md 103行目「`__ = []`（空リストと等価）」: 空配列はUnitと同型として扱う。
// これが無いと、`[h ~t]`型の再帰でリストを完全に消費し尽くした終端（restが正しく[]に
// なった状態）が`!placed`/`placed & ...`のようなUnit判定で検出できず、範囲外アクセスが
// 静かにUNITへ吸収されたまま再帰が終端しないまま数値の偶然の一致に頼って停止する、
// といった見た目上は動くが誤った挙動を招く（8-Queens監査で発見、2026-08-08）。
// string_and_comment.md §1「空文字列は`__`（Unit）と同型」: 同じ理屈をStringドメインにも
// 適用する——空文字列は文字列連結の単位元（`"" + s = s`）であり、空リストが余積の単位元
// であるのと同じ位置づけ。
// 整数リテラルを読む。安全な範囲に収まるなら Number、超えるなら BigInt——
// 丸めて返すと「もっともらしく見える間違った値」がリテラルの時点で入ってしまう。
function parseIntegerLiteral(text, radix) {
  const n = parseInt(text, radix);
  if (Number.isSafeInteger(n)) return n;
  const neg = String(text).trim().startsWith("-");
  const digits = String(text).replace(/^[+-]/, "");
  const b = radix === 16 ? BigInt("0x" + digits) : BigInt(digits);
  return neg ? -b : b;
}

function isUnit(v) {
  return v === UNIT || v === undefined || (Array.isArray(v) && v.length === 0) || v === "";
}

// pass3.jsのisDefineNodeと同じ判定（循環import回避のためここで別途最小実装）。
function isDefineNode(n) {
  return !!n && n.type === "operation" && n.name === "define";
}
function isIdentifierNode(n) {
  return !!n && n.type === "atom" && n.kind === "identifier";
}

// 構造体のフィールド行かどうか。`a : x`（明示）と `x`（省略記法：フィールド名も値も
// その識別子から取る）の2通りを認める。省略記法は2行以上のブロックでのみ有効にする
// ——`[x]` は「1要素リスト ≅ スカラー」として既に広く使われている形であり、
// 単独の識別子をフィールド1個の構造体へ読み替えると `(f 1)` のような括弧が全て壊れる。
function isStructFieldLine(n) {
  return (isDefineNode(n) && isSlotKeyNode(n.left)) || isIdentifierNode(n) || isStructSpreadLine(n);
}

// **名前付きスロットを撒く行**（`this~`）。分解した残りを組み直しへ戻すために要る。
//
// 分解（`[a b ~this]`）と組み直し（`[a : … / b : … / this~]`）で、Store の余代数の
// 取り出しと置き直しが揃う。`this` を `~` 無しで書くと省略記法として「this という名前の
// フィールド」になってしまうので、撒くことは `~` で言う——余積・直積の他の位置と同じ
// 「展開して渡す」である。
function isStructSpreadLine(n) {
  return !!n && n.type === "operation" && n.position === "postfix" && n.name === "expand";
}
// スロットのキーになれるノード。**識別子と文字列リテラル**である。
//
// 名前付きスロットの意味論は「名前→値の有限写像」であり（function_guide.md
// 「構造体メンバーの一致による自動バインディング」）、名前が識別子として綴れるか
// どうかは別の話である。演算子記号を鍵にした表を書けるようにするために要る:
//
//   add_mul :
//       `+` : `add`
//       `*` : `mul`
//
// 文字リテラル（`\+`）は受けない。同じ名前に綴りが2つある状態を作らないためで、
// 記号を名前にしたいなら文字列で書く。
function isSlotKeyNode(n) {
  if (isIdentifierNode(n)) return true;
  return !!n && n.type === "atom" && n.kind === "string";
}
function isStructBlock(node) {
  if (node.isFunctionBody) return false; // 関数本体は match_case であって構造体ではない
  const lines = node.lines;
  if (!Array.isArray(lines) || lines.length === 0) return false;
  if (lines.every((l) => isDefineNode(l) && isSlotKeyNode(l.left))) return true;
  return lines.length >= 2 && lines.every(isStructFieldLine);
}

// ---- 実行時環境（Pass1の静的envとは別物、実際の値を保持する） ----
// diagnosticsは子envにも同じ配列参照を引き継ぐ（ルートenvに一元的に蓄積される）。
function newRuntimeEnv(parent, charset) {
  // charset は根に置いて子は引き継ぐ。**文字の算術がここを見る**——足せることと、
  // 足した先が文字であることは別で、後者は charset が決める。
  return {
    bindings: new Map(),
    parent: parent || null,
    diagnostics: parent ? parent.diagnostics : [],
    charset: charset || (parent && parent.charset) || DEFAULT_CHARSET,
  };
}
function envDefine(env, name, value) {
  env.bindings.set(name, value);
}
function envGet(env, name) {
  let e = env;
  while (e) {
    if (e.bindings.has(name)) return e.bindings.get(name);
    e = e.parent;
  }
  // 未定義識別子はUnitへ収束（unit.md §0.1）。診断はinformationレベルに留め、実行は止めない。
  env.diagnostics.push({ level: "information", message: `未定義識別子 '${name}' は Unit(__) に収束しました`, identifier: name });
  return UNIT;
}

// ---- リテラルの評価 ----
function evalLiteral(node) {
  switch (node.kind) {
    case "number":
      // 整数リテラルは f64 では 2^53 までしか正しく持てない——`9223372036854775807` が
      // 読んだ時点で 2^63 になってしまう。8 byte の値を扱う言語で、リテラルが最初から
      // 壊れているのは通らないので、安全な範囲を超えるものは BigInt で読む。
      return node.value.includes(".") ? parseFloat(node.value) : parseIntegerLiteral(node.value, 10);
    case "string":
      return node.value.slice(1, -1); // バッククォートを剥がす
    case "char":
      return node.value.slice(1); // "\a" -> "a"
    case "address":
      return parseIntegerLiteral(literalDigits(node.value), 16);
    case "unicode": {
      // `0u` は Char（String の要素型）のリテラルである——`String ≅ List(0u)` であり、
      // guide/example.sn も `uni_a : 0u3042` を「Unicodeで 'あ' を表現」と説明している。
      // したがって符号位置の数値ではなく**文字そのもの**へ評価する（`\a` と同じ）。
      // 同じ文字を指す2つの記法が別の型・別の値になっていると、Byte 列を Char 列へ
      // 変換する境界（value_representation.md §4）が型として書けない。
      //
      // U+0000 は Char の値域から除外された niche であり、`__`（Unit）そのものである
      // （value_representation.md §3、system_semantics.md）。
      const cp = parseInt(literalDigits(node.value), 16);
      return cp === 0 ? UNIT : String.fromCodePoint(cp);
    }
    case "register":
      return parseInt(literalDigits(node.value), literalParts(node.value)?.radix ?? 16);
    case "unit":
      return UNIT;
    default:
      return UNIT;
  }
}

// ---- apply連鎖の収集（pass2.jsのapplyChainInfoと対称） ----
// apply[apply[apply[f, a1], a2], a3] を辿って、呼び出し先ノードと引数ノード列（左から順）を集める。
function collectApplyChain(node) {
  const argNodes = [];
  let n = node;
  while (n && n.type === "operation" && n.name === "apply") {
    argNodes.unshift(n.right);
    n = n.left;
  }
  return { calleeNode: n, argNodes };
}

// 実引数ノード1個を評価して値配列にする。後置~（expand）付きなら複数の位置引数へ展開する
// （pattern_guide.md「関数にListを渡すときは必ず後置~を使う」）。
function evalArgValues(argNode, env) {
  if (argNode.type === "operation" && argNode.position === "postfix" && argNode.name === "expand") {
    const v = evaluate(argNode.operand, env);
    if (Array.isArray(v)) return v;
    // **文字列も展開する。** `String ≅ List(Char)` なので、`` `abc`~ `` は文字3つの
    // ストリームである（list_model.md §2.4①）。ここが「配列かどうか」だけを見ていた
    // ため、文字列は展開されず1個の引数として渡っていた——`f : x ~xs ? x` を
    // `` f `abc`~ `` と呼ぶと `x` が "abc" になり、Pass 4 が出す 'a' と食い違っていた。
    //
    // 1文字は展開しても1つなので特別扱いは要らず（それは `Char` である）、空文字列は
    // 0個になる——`__` を渡したのと同じで、完全性公理がそこで止める。
    if (typeof v === "string") return [...v];
    return [v];
  }
  return [evaluate(argNode, env)];
}

function paramEntriesOf(paramsNode) {
  if (!paramsNode) return [];
  if (paramsNode.type === "atom" && paramsNode.kind === "identifier") {
    return [{ name: paramsNode.value, rest: false, default: null }];
  }
  if (paramsNode.type === "params") return paramsNode.entries;
  return [];
}

// ブラケット仮引数リスト（`[x ~xs]`等、list_model.md §2.4のEagerパターン）へ、呼び出し側が
// 渡した単一のList/Struct実引数を分割代入できる値かどうか判定する。Lambda（クロージャ）は
// 除外する——`f`をそのまま1個の不透明な値として渡すケースを構造体扱いしないため。
function isDestructurable(v) {
  // `String ≅ List(0u)`（type_system.md §2）なので、文字列も分割代入できる。添字（`s ' 0`）と
  // 要素数（`|s|`）は既に文字のリストとして扱っており、ブラケットだけ単一の不透明な値として
  // 扱うと同型が片側だけ成立していることになる。
  return Array.isArray(v) || typeof v === "string" || (v !== null && typeof v === "object" && !v.__lambda__);
}

// ブラケット仮引数リストへ、単一のList/Struct実引数を分割代入する（8/5の設計合意）。
// List: list_model.md §2.5「rest記法の位置一般化」——`~name`はブラケット内のどの位置にも
// 置ける。`~name`より前の非restエントリは先頭から、`~name`より後の非restエントリは
// **末尾から**順に対応し、`~name`自身はその間に残った要素全部を受け取る
// （`[x ~xs]`＝従来通り先頭分割、`[~head tail]`＝末尾からのpop、`[first ~mid last]`＝
// 両端からの分割代入、いずれも同じロジックで自然に表現される）。
// Struct: エントリ名とキー名の一致で（順序に関わらず）値を引く（構造体メンバーの一致による
// 自動バインディング、function_guide.md）。restエントリがあれば、名前が一致しなかった
// 残りのキーをまとめた新しいオブジェクトを渡す（pattern_guide.mdのStore「~objは...渡した
// 構造体以下の構造体を保持したい場合に使う」）。
// 【.st/.istへの含み】ここで「どのフィールド名にアクセスしたか」がentriesの名前列挙に
// 集約されているため、将来.st生成（type_system.md §6.2「関数仮引数のフィールド要求」）を
// 実装する際、このentries列挙をそのまま構造的フィールド要求集合として再利用できる想定。
function bindBracketParams(entries, value, env) {
  // **`[先頭... ~残り]` はイテレータを展開しない。**
  // 先頭は規則を進めれば出るし、残りは「進めたイテレータ」そのものである。これが
  // 効くおかげで、レンジ上の再帰が O(1) メモリで回る——無限ストリームでも回る。
  // 末尾側のエントリ（`[h ~t l]`）がある形だけは終端の位置が要るので、そこで初めて走る。
  if (isIterator(value)) {
    const restIdx = entries.findIndex((e) => e.rest);
    const streamable = restIdx !== -1 && restIdx === entries.length - 1;
    if (streamable) {
      let cur = value;
      for (const entry of entries.slice(0, restIdx)) {
        let v = isIterator(cur) ? cur.start : UNIT;
        if (isUnit(v)) {
          if (entry.default) v = evaluate(entry.default, env);
          else return null; // 完全性公理
        }
        envDefine(env, entry.name, v);
        cur = isIterator(cur) ? iteratorRest(cur) : UNIT;
      }
      envDefine(env, entries[restIdx].name, cur);
      return env;
    }
    value = materializeIterator(value);
  }
  // スカラー ≅ 1要素リスト（asList/get_propと同じ同型性）。Struct（プレーンオブジェクト）
  // ではない非Array値は、長さ1のリストとして分割代入できる。
  if (!isDestructurable(value)) value = [value];
  // 文字列は文字のリストとして分解し、rest には**文字列のまま**返す。範囲添字（`s ' 1~`）が
  // 文字列を返すのと揃える——同じ「残り」を取る操作が、書き方で違う型になってはいけない。
  // 符号位置単位で切る（サロゲートペアを2文字に割らない）。
  const fromString = typeof value === "string";
  if (fromString) value = [...value];
  const restValue = (v) => (fromString ? v.join("") : v);
  if (Array.isArray(value)) {
    const restIdx = entries.findIndex((e) => e.rest);
    const before = restIdx === -1 ? entries : entries.slice(0, restIdx);
    const after = restIdx === -1 ? [] : entries.slice(restIdx + 1);

    let idx = 0;
    for (const entry of before) {
      // **範囲外は「対象が無い」ではない。** 分解は受け取った器を指し直すだけであり
      // （layer_relations.md 分解 `[c ~r]` の行）、崩壊するのは「分解する対象が無ければ」＝
      // 実引数そのものが `__` のときである（function_guide.md）。それは呼び出し側で
      // 既に見ている。器は在るが位置が短いだけなら、そのスロットは `__` を指すだけで、
      // 呼び出しは本体へ入る——添字（`s ' 1`）が範囲外で `__` を返しつつ本体が走るのと同じ。
      const inRange = idx < value.length;
      let v = inRange ? value[idx] : UNIT;
      idx++;
      if (isUnit(v)) {
        if (entry.default) v = evaluate(entry.default, env);
        else if (inRange) return null; // 完全性公理：器の中身が `__` だった
      }
      envDefine(env, entry.name, v);
    }

    if (restIdx !== -1) {
      // afterの分だけ末尾を確保してから、間に残った部分をrestへ渡す。
      //
      // **残りは覗き窓である**（`listView`）。カッコは参照を取るという意味なので、
      // ここで写すと仮引数越しの書き込みが元へ届かない——機械の側は `ptr` と `len` を
      // ずらすだけで同じ領域を指し続けるので、写した瞬間に2つの意味ができてしまう。
      // 文字列は不変なので窓にしても書けず、`restValue` が文字列へ畳み戻す方が正しい。
      const restEnd = Math.max(idx, value.length - after.length);
      const rest = fromString ? restValue(value.slice(idx, restEnd)) : listView(value, idx, restEnd);
      envDefine(env, entries[restIdx].name, rest);
      for (let i = 0; i < after.length; i++) {
        const entry = after[i];
        const pos = restEnd + i;
        let v = pos < value.length ? value[pos] : UNIT;
        if (isUnit(v)) {
          if (entry.default) v = evaluate(entry.default, env);
          else return null; // 完全性公理
        }
        envDefine(env, entry.name, v);
      }
    }
    return env;
  }
  // Struct（構造体）: entry名とキー名の一致で分割代入
  //
  // **名前は識別子でも文字列でも綴れる。** どちらも外側を1文字ずつ剥がせば名前になり
  // （`<foo>` / `` `foo` ``）、キーとして引くのも束縛するのも同じ名前で行う。
  // 束縛名を綴りのまま使うと、`[`foo` ~this]` で束縛した `foo` を本体（`<foo>` を探す）
  // が見つけられない——鍵は消費されるのに値へ届かない、という半端な形になっていた。
  //
  // **仮引数名は静的に定まっていなければならない。** ここで見るのは書かれた綴りだけで、
  // 実行時の値からフィールド名を作る道は無い。
  const claimedKeys = new Set();
  for (const entry of entries) {
    if (entry.rest) continue; // restは全エントリ処理後にまとめて扱う
    const key = entry.name.slice(1, -1); // "<foo>" -> "foo" / "`foo`" -> "foo"
    claimedKeys.add(key);
    let v = Object.prototype.hasOwnProperty.call(value, key) ? value[key] : UNIT;
    if (isUnit(v)) {
      if (entry.default) v = evaluate(entry.default, env);
      else return null; // 完全性公理
    }
    envDefine(env, "<" + key + ">", v);
  }
  const restEntry = entries.find((e) => e.rest);
  if (restEntry) {
    const rest = {};
    for (const k of Object.keys(value)) if (!claimedKeys.has(k)) rest[k] = value[k];
    envDefine(env, restEntry.name, rest);
  }
  return env;
}

// 仮引数を実引数に束縛した新しい実行時envを返す。完全性公理により崩壊する場合は null を返す。
function bindParams(paramsNode, argValues, closureEnv) {
  const entries = paramEntriesOf(paramsNode);
  const env = newRuntimeEnv(closureEnv);

  if (paramsNode && paramsNode.type === "params" && paramsNode.bracket && argValues.length === 1) {
    // ブラケット仮引数リストは「渡された1個の実引数を分解する」という宣言である。
    // Unit には分解すべき構造が無いため、完全性公理により呼び出しごと崩壊させる。
    //
    // これが無いと、崩壊するかどうかがエントリの形に依存してしまっていた——
    // `[p ~ps]` は先頭が非restのためUnitを受けて崩壊する一方、`[~b]` は唯一のエントリが
    // restなので「可変長引数のUnitフォールバック」に落ちて空リストを束縛し、
    // 失敗して `__` になった値がそのまま素通りしていた（混在形 `f : x [~b] ?` では
    // 逆に崩壊するため、同じ宣言が置かれる位置で挙動が割れていた）。
    //
    // `~rest` のUnitフォールバック（function_guide.md）は「末尾の実引数が0個」を
    // 空リストとして扱う規則であって、**1個の実引数を分解する**話ではない。
    if (isUnit(argValues[0])) return null;
    if (isDestructurable(argValues[0])) return bindBracketParams(entries, argValues[0], env);
  }

  let argIdx = 0;

  for (const entry of entries) {
    if (entry.rest) {
      let restArgs = argValues.slice(argIdx);
      argIdx = argValues.length;
      // §3.3: restにUnitが渡された（または実引数が尽きた）場合は空リストへフォールバック
      if (restArgs.length === 0 || (restArgs.length === 1 && isUnit(restArgs[0]))) {
        restArgs = [];
      }
      envDefine(env, entry.name, restArgs);
      continue;
    }

    let value = argIdx < argValues.length ? argValues[argIdx] : UNIT;
    argIdx++;

    if (isUnit(value)) {
      if (entry.default) {
        // let*的に、ここまでに束縛済みのenvでデフォルト式を評価する
        value = evaluate(entry.default, env);
      } else {
        return null; // 完全性公理：デフォルト無しのパラメータにUnit → 呼び出し全体が崩壊
      }
    }

    if (entry.pattern) {
      // 混在パラメータ内のブラケット分割代入エントリ（pass2.jsのparseParamStatements/
      // splitBareParamTokens参照、例: `f : a [h ~t] ? ...`）。対応する1個の実引数を
      // そのままこのenvへ分割代入する（ネストした完全性公理の崩壊は呼び出し全体へ伝播）。
      if (bindBracketParams(entry.pattern, value, env) === null) return null;
      continue;
    }
    envDefine(env, entry.name, value);
  }

  return env;
}

function makeClosure(paramsNode, bodyNode, env) {
  return { __lambda__: true, params: paramsNode, body: bodyNode, env };
}

// `!__` が返す Id射（categorical_truth.md §6、guide/operator_table.md 141行目）。
// SKIのKコンビネータ（λx.λy.x、引数をそのまま返す恒等射）がSignにおける「真」であり、
// `__`（K*、引数を吸収する void 関数）が「偽」である。
// 【重要】ここで `1` や `true` のような具体的な値を返してはいけない——それは Boolean 型を
// 暗黙に再導入することであり、「Signに真偽値型は存在しない」という設計原則と矛盾する
// （categorical_truth.md の IMPORTANT ブロックが明示的に禁じている）。返すのは
// 「Unitでない何か」＝副作用を持たないことが静的に確定している恒等射そのもの。
// 未評価のラムダはUnitと同型（副作用の可能性があり評価予定が確定しない）だが、この
// Id射だけはその例外——純粋な恒等関数なので評価予定が静的に確定し、非Unitとして扱える。
const IDENTITY = { __lambda__: true, __identity__: true };

// 関数合成（coproduct_resolver.md §3: Lambda Lambda → compose）。
// 【重要】数学的合成記法(f∘g)(x)=f(g(x))とは逆で、Signの `f g` は左→右のパイプライン順。
// documents/ja-jp/guide/example.sn: `[+ 1] [* 2] 5 = [* 2]([+ 1] 5) = 12`
// （左の[+1]が先に5へ適用され6、その結果に右の[*2]が適用され12。"関数合成は左単位元"）。
// つまり (f g)(x) = g(f(x)) ——fを先に、その結果にgを適用する。
function makeComposed(f, g) {
  return { __lambda__: true, __compose__: [f, g] };
}

// ポイントフリー記述（function_guide.md）: `[+]`（左右とも欠落）・`[+ 1]`（右辺だけ束縛）
// のような、演算子を直接値として扱うLambda。nodeはpass2.jsが作るpartialな中置演算
// ノード（{op, name, partial:true, left, right}）で、left/rightのうち欠けている側が
// 呼び出し引数で埋まる。
function makePointfreeClosure(node, env) {
  return { __lambda__: true, __pointfree__: node, env };
}

// 自動カリー化（project memory: project-sign-currying-design、pass2.jsのmarkUndersaturatedApplies
// が"partial_apply"と静的に判定した呼び出し）を、部分適用クロージャへ変換する。
// 既に渡された分の実引数を新しいenvへ束縛し（完全性公理はここでも健在——供給された値が
// 明示的にUnitなら、デフォルトが無い限りやはり崩壊する。これは「値がUnit」の話であり、
// pass2が判定した「引数の個数が足りない」とは別軸——ここへ来る時点で個数の判断は
// 既に済んでいる）、残りの仮引数だけを持つ新しいLambdaを返す。
function makePartialClosure(closure, suppliedArgs) {
  const entries = paramEntriesOf(closure.params);
  const bound = entries.slice(0, suppliedArgs.length);
  const remaining = entries.slice(suppliedArgs.length);
  const capturedEnv = newRuntimeEnv(closure.env);
  for (let i = 0; i < bound.length; i++) {
    const entry = bound[i];
    let value = suppliedArgs[i];
    if (isUnit(value)) {
      if (entry.default) value = evaluate(entry.default, capturedEnv);
      else return UNIT; // 完全性公理：デフォルト無しのパラメータに明示的なUnitが来た場合は崩壊
    }
    envDefine(capturedEnv, entry.name, value);
  }
  const remainingParams = {
    type: "params",
    entries: remaining,
    requiredArity: remaining.filter((e) => !e.rest && e.default === null).length,
    bracket: false,
  };
  return { __lambda__: true, params: remainingParams, body: closure.body, env: capturedEnv };
}

// ---- 末尾呼び出し最適化（TCO） ----
// Signはif/while/forを持たず反復を再帰でのみ表現する設計（0_design_principles.md）だが、
// このインタプリタは素朴に木を歩くだけで、JS自身もES6仕様のProper Tail Callsを実装して
// いない（V8は結局実装しなかった）ため、深い再帰がJSの呼び出しスタック上限に直撃する
// （8-Queens監査後の相互再帰テストでn=2000程度からMaximum call stack size exceeded）。
// トランポリン方式で対処する: 末尾位置での関数呼び出しをTailCallという「まだ実行して
// いない呼び出しの予約」として返し、applyClosure側のwhileループがそれを検出したら
// 新しいJSスタックフレームを積まずに同じフレーム内でループを継続する。

// TailCallマーカー: 末尾位置で見つかったLambda呼び出し（未実行）を表す。
class TailCall {
  constructor(closure, argValues, pending = []) {
    this.closure = closure;
    this.argValues = argValues;
    // **まだ左辺と繋いでいない前置き。** `sep` のような「前置き ＋ 再帰」は末尾では
    // ないが、構築は自由モノイド（結合的、単位元 `__`）なので**繋ぐのを後回しに
    // できる**——溜めて最後に畳めば同じ値である。繋ぎ方はノードが知っているので
    // （`String` の吸収は型で決まる）、値とノードを対で持ち回る。
    this.pending = pending;
  }
}

// インデントブロック（match_case含む）の逐次評価。tailEvalは「ブロックの最終結果と
// なる式」をどう評価するかのコールバック——通常のevaluate()からはevaluate自身を渡す
// （常に値を完全に確定させる、従来通りの挙動）。末尾呼び出し検出用のevaluateTailからは
// evaluateTail自身を渡すことで、末尾位置の判定ロジックをこの1箇所だけに保つ。
/**
 * **どの行も定義でないブロックは、行が要素の列である。**
 *
 * `list_model.md` §3.1 は2次元配列のブロック記法を挙げている。
 *
 *     L :
 *         1 2
 *         3 4
 *
 * これまでは**全行を評価してから最後の1つだけを残して**いた。効果は既に起きているので
 * 失われるのは値だけであり、書いた行が黙って捨てられていたことになる——値の位置で
 * それが役に立つ場面は無い。集めれば、捨てていた分がそのまま行になる。
 *
 * 定義を1つでも含むブロックは対象外である。`名前 : 値` は構造体、`条件 : 結果` は
 * match_case であり、どちらも「行が要素」ではない。
 */
function isRowBlock(node) {
  const lines = node.lines;
  return Array.isArray(lines) && lines.length > 1 && lines.every((l) => !isDefineNode(l));
}

function evalIndentBlock(node, env, tailEval) {
  const lines = node.lines;
  if (isRowBlock(node)) return lines.map((l) => evaluate(l, env));
  let result = UNIT;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 関数本体のインデントブロックでは、`識別子 : 値` も match_case である
    // （function_guide.md）。ここを定義として扱うと、最も分岐させたい対象である
    // 仮引数を条件に書けない——`ready : send` が「準備できていれば送る」ではなく
    // ready の再束縛になり、しかも無言で別の意味になるため気づけなかった。
    // 本体以外のインデントブロック（定義の右辺の設定宣言など）は従来通り。
    if (isDefineNode(line) && (node.isFunctionBody || !isIdentifierNode(line.left))) {
      const cond = evaluate(line.left, env);
      if (!isUnit(cond)) return tailEval(line.right, env);
      continue;
    }
    if (i === lines.length - 1) return tailEval(line, env);
    result = evaluate(line, env);
  }
  return result;
}

// nodeを「末尾位置」として評価する。末尾位置とは、この式の値がそのまま関数呼び出し
// 全体の返値になる位置——ブロックの最終行・発火したmatch_case分岐の右辺・`|`/`&`の
// 右辺（短絡評価で右へ進んだ場合、その結果に対して何も後処理をしないため）。
// これらの位置を再帰的に辿った先が既知のLambdaへの素朴なapply呼び出しであれば、
// その場でapplyClosureを再帰呼び出しする代わりにTailCallマーカーを返す——
// JSのスタックフレームを消費しない。それ以外の形（compose・pointfree・組み込み関数・
// 算術式など）は通常のevaluate()にそのまま委譲する（正しく動くが最適化はされない）。
/**
 * **構築の合成を値の関数として置く。** ノードを見るのは `String` の吸収を型で決める
 * ところだけで、あとは値の話である——切り出しておけば、末尾の呼び出しへ跳ぶ側からも
 * 同じ規則で繋げる（`sep` のような「前置き ＋ 再帰」を積まずに回すのに要る）。
 */
function constructValues(node, l, r) {
        // 余積の単位元則（type_system.md §6.1「関数の位置の `__` は余積の初対象＝単位元、
        // 引数を素通しにする」）。Unit側を消した結果が1項だけになったら、それを
        // 1要素リストで包み直さずそのまま返す——`[5]`（1行ブロック）が5そのものに
        // 評価されるのと同じで、この言語では1要素リストとスカラーは同型。
        // これが無いと `__ 5` が `[5]` になり、guide/operator_table.md 147行目の
        // `__ 5 == !__ 5`（両方5）が成立しない。2項以上（`__ 1 2` → `[1 2]`、§6.1の
        // 輸入失敗例）は左結合で `(__ 1) 2` → `1 2` と畳まれるため従来通り。
        //
        // ただし**空文字列は単位元として落とさない**。値としては Unit と同型だが、
        // 型は String である（pass3 は `` `` 1 2 3 `` を既に String と注釈している）。
        // 余積に置かれた `` は「以降をテキストとして連結する」という宣言であり、
        // 落とすと型が String と言っているのに値が List になる——型と値が食い違う。
        // 値だけでは決まらないので型で決める。`5 / 2` と `5.0 / 2` を型で分けたのと
        // 同じ構図であり（原理2: 型はゼロコストの帳簿）、`|xs|` のオペランド型判定と同じ。
        //
        //   `` 1 2 3   → `123`（テキストとして連結する宣言）
        //   __ 1 2 3   → [1 2 3]（Unit は余積の単位元なので落ちる）
        const isTextSeed = (v, n) => isUnit(v) && !!n && n.atomType === "String";
        if (isUnit(l) && !isTextSeed(l, node.left)) return r;
        if (isUnit(r) && !isTextSeed(r, node.right)) return l;
        // tier 10.4（`Lambda` 中置 `Atom` → apply）は演算子表の上では**型による分岐**であり、
        // pass2 は静的に解けた場合だけ apply ノードを作る。ところが「適用の結果が Lambda に
        // なる式」（`[!_] __` → Id射）は、静的には arity 1 が飽和した Atom にしか見えないため
        // construct へ落ちてしまい、`([!_] __) 5` が `[Id射, 5]` になっていた。
        // 生の `(!__) 5` は getCategory が前置`!`+unit を直接 Lambda と判定するので 5 を返す。
        // 同じ Id射が、作られ方によって射になったり値として並んだりするのは誤り。
        // 実行時には左辺の実際の値が分かるので、ここで表どおりの分岐へ戻す。
        // 右辺も Lambda の場合は tier 10.5（compose）であってここでの apply ではないため除く。
        if (l !== null && typeof l === "object" && l.__lambda__ &&
            !(r !== null && typeof r === "object" && r.__lambda__)) {
          return applyClosure(l, [r]);
        }
        // **構造体のマージ**（list_model.md §5.3）。「双方に後置 `~` がついていれば、
        // リストの時と同様に構造体同士をマージできる」——後置 `~` の意味は一貫して
        // 「展開して渡す」であり、構造体を展開するとはスロットを撒くということである。
        //
        // `~` が無ければマージではない。`q r` は構造体2個が並んだ列（`List(Struct)`）で
        // あって、勝手に畳んではいけない——名前付きスロットに名前の無いものを足せない
        // 以上、余積は次元の中を伸ばすしかないからである。
        //
        // 重複キーは右が勝つ（§5.3 規則2）。型が違う上書きはコンパイルエラーであり、
        // それは Pass 3 が静的に弾く（規則3）——ここへ来る時点で型は揃っている。
        // 判定は**値**で行う。`~` はイテレータを返すので構文を見る必要が無い
        // ——`n : q~` と束縛してから `p n` と書いても同じようにマージされる。
        // 見るのは右辺だけでよい。**左辺は器なので常に展開されている**（§2.2）ので、
        // 左結合の連鎖（`a~ b~ c~`）で中間結果が素の構造体になっても繋がる。
        {
          const lo = isIterator(l) && isNamedSlots(l.origin) ? l.origin : l;
          if (isIterator(r) && isNamedSlots(r.origin) && isNamedSlots(lo)) {
            return { ...lo, ...r.origin };
          }
        }
        // マージにならなかった `~` は何もしない印なので、器そのものへ戻す
        // ——名前付きスロットは撒いても名前の行き先が無い。
        const unwrapStruct = (x) => (isIterator(x) && isNamedSlots(x.origin) ? x.origin : x);
        l = unwrapStruct(l);
        r = unwrapStruct(r);
        // §3.2 余積族: どちらかが文字列ならテキストとして連結する
        // （`123` 123 = `123123`、list_model.md §2.1/§4.4）。
        // Stringは余積の**吸収元**——あらゆる値がテキスト表現を持つため、Stringとの
        // 結合は常に成立する。左辺だけを見ていると `` `ab` 1 `` → "ab1" なのに
        // `1 `ab`` は [1, "ab"] という別物になり、同じ演算子が引数の順序で挙動を
        // 変えてしまっていた。それ以外は通常のList構築。
        {
          const t = textAbsorb(l, r);
          if (t !== null) return t;
        }
        // **撒くかどうかは値が決める。** 後置 `~` が付いた値だけを撒く。イテレータで
        // ありさえすれば撒く、ではない——レンジは撒くものではなく1個の値だからである。
        // 構文ではなく値なので、名前に束縛しても関数を通しても同じ答えになる。
        return [...asList(deIterate(l)), ...(isSpread(r) ? asList(deIterate(r)) : [r])];
}

function evaluateTail(node, env) {
  if (!node || typeof node !== "object") return evaluate(node, env);
  if (
    node.type === "block" &&
    node.kind === "indent" &&
    !isStructBlock(node)
  ) {
    // Struct型（全行define+識別子キー）はここでは対象外——evaluate()のStruct分岐へ委譲。
    return evalIndentBlock(node, env, evaluateTail);
  }
  // **括りは剥いでから見る。** `c (f rest)` の右辺は括りの節であって呼び出しノードでは
  // ないので、素通しすると末尾だと気づけない——1文字ごとに JS のフレームが積まれる。
  // 1行の括りの値はその行の値そのものなので、末尾の判定はそのまま中へ持ち込める。
  //
  // **`kind === "paren"` は丸カッコのことではない。** 文法は `[]` / `{}` / `()` を
  // 区別せず、pass2 はどれも「括り」を `paren` と呼ぶ（囲みの形は読みやすさのためであって、
  // 意味は構文の位置が決める）。ここで外しているのは**囲みの形をした演算子**の方である
  // ——`|x|`（絶対値、`abs`）と `||x||`（要素数、`norm`）は中の行の値ではないので、
  // 剥ぐと別のものになる。分岐（`indent`）も上で別に扱っている。
  if (node.type === "block" && node.kind === "paren" && Array.isArray(node.lines) && node.lines.length === 1) {
    return evaluateTail(node.lines[0], env);
  }
  if (node.type === "operation") {
    if (node.name === "or") {
      const l = evaluate(node.left, env);
      if (!isUnit(l)) return l;
      return evaluateTail(node.right, env);
    }
    if (node.name === "and") {
      const l = evaluate(node.left, env);
      if (isUnit(l)) return UNIT;
      return evaluateTail(node.right, env);
    }
    // **「前置き ＋ 末尾の呼び出し」は積まずに回せる。**
    //
    // `sep : [c ~rest] ? … c (sep rest)` は末尾呼び出しではない——呼んだ後に繋ぐ仕事が
    // 残るからで、素直に書くと1文字ごとに JS のフレームが1つ積まれる。だが繋ぐのは
    // 結合的な演算なので、**前置きを溜めて最後に畳んでも同じ値**である。Pass 4 が追記
    // （呼び先が同じ場所の続きへ書く）で同じことをしているのと同じ話で、実質末尾になる。
    //
    // 左辺を先に評価する。順序を変えると副作用（`#` の書き込み）の起きる順が変わる。
    if (node.name === "construct" || node.name === "concat") {
      const lv = evaluate(node.left, env);
      const rt = evaluateTail(node.right, env);
      if (rt instanceof TailCall) {
        rt.pending.push({ node, left: lv });
        return rt;
      }
      return constructValues(node, lv, rt);
    }
    if (node.name === "apply") {
      const { calleeNode, argNodes } = collectApplyChain(node);
      const callee = evaluate(calleeNode, env);
      const argValues = [];
      for (const a of argNodes) argValues.push(...evalArgValues(a, env));
      // compose/pointfree/組み込み関数（JS function）は素朴なLambda呼び出しではないため
      // トランポリンの対象外——安全側に倒して通常のapplyClosureへ委譲する。
      if (callee && callee.__lambda__ && !callee.__compose__ && !callee.__pointfree__) {
        return new TailCall(callee, argValues);
      }
      return applyClosure(callee, argValues);
    }
  }
  return evaluate(node, env);
}

// 「複数の実引数を貪欲に消費する」ポイントフリークロージャかどうか（実行時版）。
// pass2.js の isGreedyPointfree と同じ判定を、縮約後のクロージャに対して行う
// ——合成の中間をストリームとして展開すべきかどうかの判断に使う。
function isGreedyPointfreeClosure(closure) {
  const node = closure && closure.__pointfree__;
  if (!node || !node.partial) return false;
  return node.pointfreeMap === true || (node.left === null && node.right === null);
}

function applyClosure(closure, argValues) {
  // 末尾の手前に置かれた前置き（`構築 ＋ 再帰`）を溜める。積まずに回すために要る。
  const pending = [];
  // **どの出口でも前置きを畳む。** 完全性公理で潰れる底（`callEnv === null`）のように、
  // ループの途中から返る道がいくつもある——そこを素通しすると、溜めた前置きが丸ごと
  // 落ちて `__` になる。畳み方は1箇所にしておく。
  const finish = (v) => {
    let out = v;
    for (let i = pending.length - 1; i >= 0; i--) out = constructValues(pending[i].node, pending[i].left, out);
    return out;
  };
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (typeof closure === "function") return finish(closure(...argValues)); // 組み込み関数
    // 関数の位置に来たUnitは余積の初対象（単位元）として引数を素通しする
    // （type_system.md §6.1の表「関数の位置 (`__ x`) → 引数を素通しにする」、
    // 同§のimport失敗例が示す通りクラッシュさせない）。Pass2が静的にLambdaと判定した
    // 呼び出し先が、実行時にはまだ束縛されていない・未定義でUnitに収束していた、という
    // 場合にここへ来る——unit.md §0.1の「未定義識別子はUnitへ収束、実行は止めない」に
    // 揃える。Id射（`!__`）への適用と同じ結果になるのは偶然ではなく、
    // guide/operator_table.md 147行目の `__ 5 == !__ 5` が言っていることそのもの。
    if (isUnit(closure)) return finish(argValues.length === 1 ? argValues[0] : argValues);
    if (!closure || !closure.__lambda__) {
      throw new TypeError("Lambdaではない値を関数として適用しようとしました");
    }
    if (closure.__compose__) {
      const [f, g] = closure.__compose__;
      // 完全性公理はチェーン全体に効く：fの結果がUnitならgを呼ばず即座にUnit。
      // 左(f)を先に適用し、その結果に右(g)を適用する（左→右パイプライン順、上記参照）。
      const mid = applyClosure(f, argValues);
      if (isUnit(mid)) return finish(UNIT);
      // list_model.md §2.4③: ポイントフリー合成の中間は「1個の実体化されたList値」
      // ではなく次段へ流れるストリーム（①②の Eager/Lazy 境界と同じ原則）。
      // 次段が貪欲なポイントフリー（`[+]`/`[* 2,]`）なら展開して渡す——
      // `[* 2,] [+] 1 2 3 4 5` は「2倍の写像 → 畳み込み」で30になる。
      // 括弧で括った場合（`([* 2,] 1 2 3 4 5)`）はそこで値（List）に実体化されるため、
      // 畳み込むには後置`~`での再展開が要る、という区別がそのまま効く。
      if (Array.isArray(mid) && isGreedyPointfreeClosure(g)) return finish(applyClosure(g, mid));
      return finish(applyClosure(g, [mid]));
    }
    // Id射（`!__`）への適用は引数をそのまま返す。引数がUnitなら完全性公理がそのまま
    // 効いてUnitになる（categorical_truth.md「`!__ __` は理論的に正しく `__` を返す」）。
    if (closure.__identity__) return finish(argValues.length > 0 ? argValues[0] : UNIT);
    if (closure.__pointfree__) {
      // ホール由来のポイントフリー（`[!_]`）は hole_desugaring.md により静的に
      // `$p0 ? !$p0` へ脱糖される——すなわち**ラムダ**であり、完全性公理の対象である。
      // 演算子としての `!`（`!(5 < 3)`）は構文であって関数値ではないため、ここを通らず
      // 演算子表のUnit欄（`!` の右辺Unit → Id射）が支配する。この区別が無いと、同じ否定が
      // 「演算子・ポイントフリー・明示ラムダ」の3通りで別々の答えを返していた。
      //
      // 一方、貪欲なポイントフリー（`[+]`）は引数スロットではなく**余積のストリーム**を
      // 食う（tier 10.0）。ストリーム中の `__` は余積の単位元として消えるべきものであり、
      // 引数スロットへUnitが来たわけではないので公理の対象ではない（`[+] 1 __` は 1）。
      if (!isGreedyPointfreeClosure(closure) && argValues.some((v) => isUnit(v))) return finish(UNIT);
      return finish(applyPointfree(closure.__pointfree__, closure.env, argValues));
    }
    const callEnv = bindParams(closure.params, argValues, closure.env);
    if (callEnv === null) return finish(UNIT);
    const result = evaluateTail(closure.body, callEnv);
    if (result instanceof TailCall) {
      // 末尾呼び出し: 新しいJSフレームを積まず、同じループの中で継続する。
      if (result.pending.length > 0) pending.push(...result.pending);
      closure = result.closure;
      argValues = result.argValues;
      continue;
    }
    return finish(result);
  }
}

// ---- 算術・比較演算子のUnit伝播ルール（type_system.md §3.3） ----
/**
 * 整数の幅とビット演算。
 *
 * ## なぜ BigInt を経由するか
 *
 * JS の数値は f64 しか無いので、そのままでは Sign の整数を表せない——2^53 を超えると
 * 整数が保てず（`2^53 + 1` が `2^53` になる）、8 byte のラップアラウンドも表現できない。
 * `type_system.md` §3.6 と `integer_overflow.md` §1 が定める挙動（`Int` はラップ、
 * `Address` は `__` へ収束）は、**幅が確定していて初めて意味を持つ**規則である。
 *
 * そこで整数の演算だけ BigInt で行い、結果を安全な範囲なら Number へ戻す。安全でなければ
 * BigInt のまま流す——「もっともらしく見える間違った値」を返さないためである。
 *
 * ## 既定の幅は 64bit
 *
 * Sign の初期構想は AArch64（GPR 8 byte）を対象とする（`target_info.js`）。ターゲットを
 * 与えない経路ではその既定を使う。ターゲットが分かっている場合は `option.ms` の値が勝つ。
 */
const DEFAULT_GPR_BITS = 64;

function toBig(v) {
  if (typeof v === "bigint") return v;
  if (typeof v === "number" && Number.isInteger(v)) return BigInt(v);
  return null;
}

// 安全に Number へ戻せるなら戻す。戻せないものを丸めて返すと、静かに違う値になる。
function fromBig(b) {
  return b >= BigInt(Number.MIN_SAFE_INTEGER) && b <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(b) : b;
}

// `Int` は符号付きでラップする（integer_overflow.md §1）。ビット列（`0r`/`0b`）も同じ。
function wrapInt(b, bits = DEFAULT_GPR_BITS) {
  return fromBig(BigInt.asIntN(bits, b));
}

// `Address` は符号なしで、幅を超えたら `__` へ収束する——不正アドレスの伝播を止めるため。
function clampAddress(b, bits = DEFAULT_GPR_BITS) {
  const max = (1n << BigInt(bits)) - 1n;
  return b < 0n || b > max ? UNIT : fromBig(b);
}

const BIT_OPS = {
  bit_and: (a, b) => a & b,
  bit_or: (a, b) => a | b,
  bit_xor: (a, b) => a ^ b,
  bit_shift_left: (a, b) => a << b,
  bit_shift_right: (a, b) => a >> b,
};

// ビット演算は幅の中で閉じる。`<<` が幅の外へ出た分は捨てられる——ビット列はラップが
// 前提であり（integer_overflow.md §1「bit演算はラップが前提（暗号・ハッシュ等）」）、
// そこが桁あふれとして `__` になっては困る。
function bitOnValues(name, l, r) {
  const a = toBig(l);
  const b = toBig(r);
  if (a === null || b === null) return UNIT;
  return wrapInt(BIT_OPS[name](a, b));
}

// `!!` は幅の中での補数。幅が無ければ「全ビット反転」が定義できない。
function bitNot(v) {
  const a = toBig(v);
  return a === null ? UNIT : wrapInt(~a);
}


const ARITH_OPS = {
  add: (l, r) => l + r,
  sub: (l, r) => l - r,
  mul: (l, r) => l * r,
  div: (l, r) => l / r,
  mod: (l, r) => l % r,
  pow: (l, r) => Math.pow(l, r),
};

// 整数域の演算を BigInt で行う版。f64 は 2^53 を超えると整数を保てないので、8 byte の
// 値を扱う以上こちらが本体である。Number で足りる範囲は Number のまま流し、超えたところ
// だけこちらへ来る（`fromBig` が安全なら Number へ戻す）。
const BIG_ARITH = {
  add: (a, b) => a + b,
  sub: (a, b) => a - b,
  mul: (a, b) => a * b,
  // §3.2「除算だけは整数同士でも丸めが起きる」: 四捨五入・タイは0から遠ざける。
  // BigInt の `/` は切り捨てなので自前で丸める。
  div: (a, b) => {
    if (b === 0n) return null;
    const q = a / b;
    const rem = a % b;
    if (rem === 0n) return q;
    const absRem = rem < 0n ? -rem : rem;
    const absB = b < 0n ? -b : b;
    const away = absRem * 2n >= absB ? 1n : 0n;
    const sign = (a < 0n) !== (b < 0n) ? -1n : 1n;
    return q + sign * away;
  },
  mod: (a, b) => (b === 0n ? null : a % b),
  pow: (a, b) => (b < 0n ? null : a ** b),
};

const COMPARE_OPS = {
  less: (l, r) => l < r,
  less_equal: (l, r) => l <= r,
  assign_equal: (l, r) => l === r,
  more_equal: (l, r) => l >= r,
  more: (l, r) => l > r,
};

// list_cheat_sheet.md「重複した要素の作成/リフト/分割」: `*`（repeat）・`^`（lift）・
// `/`（split）はList左辺に対して固有の意味を持つ。それ以外の算術演算子（+ - %）は
// Stringの場合（下記）と同様、Listに対しては未定義のため型エラーとしてUnitへ収束する。
function listRepeat(l, r) {
  // [0 1] * 3 → [0 1 0 1 0 1]（lをr回連結）
  const out = [];
  for (let i = 0; i < r; i++) out.push(...l);
  return out;
}
function listLift(l, r) {
  // [0 1] ^ 3 → [[0 1] [0 1] [0 1]]（lのコピーをr個、要素として持ち上げる）
  const out = [];
  for (let i = 0; i < r; i++) out.push([...l]);
  return out;
}
function listSplit(l, r) {
  // [1 2 3 4] / 2 → [[1 2] [3 4]]（lをr個のグループへ均等分割）
  const out = [];
  const size = Math.ceil(l.length / r);
  for (let i = 0; i < l.length; i += size) out.push(l.slice(i, i + size));
  return out;
}

// type_system.md §3.2/§4.1 の丸め規則: 四捨五入（最近接、タイは0から遠ざける）。
// AArch64の`fcvtas`/`fcvtau`が1命令で行う丸めと同じ方向。JSの`Math.round`は
// タイを+∞方向へ倒す（`Math.round(-2.5)`が`-2`になる）ため、負側は符号を外して
// 丸めてから戻す必要がある。
function roundHalfAwayFromZero(x) {
  return x < 0 ? -Math.round(-x) : Math.round(x);
}

// 算術族の型規則を**値に対して**適用する（type_system.md §3.2）。
// 通常の中置（evalArith）とポイントフリー（applyPointfree の combine）の両方から呼ぶ——
// 以前は後者が ARITH_OPS を直に叩いており型ガードを丸ごと迂回していたため、
// `[+ 1] [1 2 3]` が `"1,2,31"`（JSの配列→文字列強制）、`[* 2,] \`abc\`` が NaN を
// 静かに返していた。算術が何を意味するかを決める場所は1つでなければならない。
function arithOnValues(name, l, r, limit = charLimitOf(DEFAULT_CHARSET)) {
  // **`__` は算術の両側で単位元である**（爆発律）。
  //
  // 算術は `A × A → A`——**積**を食って**同じ対象**を返す。片方が始対象なら、返せる値は
  // 残った方しか無い（始対象からの射は一意）。だから相手が通り抜ける。型の側で言えば
  // `__` は強さの**底**であり、`Unit ⊕ T → T` である。
  //
  // 比較は違う。`A × A → Ω` で返す先が別の対象なので、相手の値を通しても行き先の型に
  // ならない——爆発しようがなく、`__` のまま（`compareOnValues` 側）。
  //
  // 以前ここは「左辺Unit = 吸収元」で `__ + 3` が `__` だった。**`__` を誤りの印としても
  // 使っていた**が、それは `__` の役割ではない——誤りはコンパイル時の診断であり、
  // 実行時フォールバック経路を言語として持たない（compiler_pipeline.md §3）。
  // ただし **String は算術の対象ではない**（§3.2、左右どちらでも型エラー）。爆発律は
  // 算術の代数の中の話なので、代数に居ないものは通り抜けない——`__ + \`abc\`` も
  // `\`abc\` + __` も `__` で、左右対称である。
  if (isUnit(l)) {
    if (r === undefined) return UNIT;
    return typeof r === "string" && [...r].length !== 1 ? UNIT : r;
  }
  // **1文字は符号位置そのものである**（`[x] ≅ x` なので長さ1の文字列は `Char`）。
  // 文字の算術は符号位置の算術である——**そして値としてはそれで全部**である。
  //
  // ここで charset の範囲を見るのをやめた。`Char` は `Int` と同じ値であり、違うのは
  // **書き出すときだけ**だからである（`#` の出口が `emitWritableGuard` で見る）。
  // 算術で見ると、(1) 判定が半端になり（上限しか見ずサロゲートが通っていた）、
  // (2) `__` を「誤りの印」として使うことになり、(3) 演算のたびに払う。
  //
  // 長さ2以上の文字列は §3.2 の通り算術の対象ではない（型エラーで `__` へ収束）。
  // 区別できるのは、1要素の器がスカラーと同型だからである（原理8）。
  const cp = (x) => (typeof x === "string" && [...x].length === 1 ? x.codePointAt(0) : null);
  const lc = cp(l);
  const rc = cp(r);
  // **どちらが文字でも同じ道である。** `Char` は `Int` と同じ値なので、順序で答えが
  // 変わる理由が無い。以前は左辺しか見ておらず、`\`a\` + 1` は "b" なのに `1 + \`a\``
  // が `__` になっていた——右辺の文字が「算術に混ざった非数値」として弾かれていた。
  if (lc !== null || (rc !== null && typeof l === "number")) {
    if (isUnit(r)) return l; // 右辺Unit = 単位元（素通し）
    const lv = lc ?? l;
    const rv = rc ?? (typeof r === "number" ? r : null);
    if (rv === null) return UNIT;
    const fn = ARITH_OPS[name];
    if (!fn) return UNIT;
    const out = fn(lv, rv);
    // **左辺が結果の姿を決める。** `Char` と `Int` に強弱は無いので、格子ではなく
    // 左辺優先の規則が働く——`\`a\` + 1` は文字、`1 + \`a\`` は数である。
    if (lc === null) return out;
    // 値としては `Int` と同じなので、ここで落とすものは無い——負も、上限の外も、
    // サロゲートも普通に存在する。書けるかどうかは `#` の出口が見る。**描ける符号位置
    // なら文字として、そうでなければ数として**返す（同じ値の別の見せ方）。
    const drawable = Number.isInteger(out) && out >= 0 && out <= 0x10ffff && !(out >= 0xd800 && out <= 0xdfff);
    return drawable ? String.fromCodePoint(out) : out;
  }
  // §3.2: String（Listと同型）の左辺に算術演算子は効かない → 型エラーで__に収束。
  // 注: list_model.md §4.4の文面は「+でコードポイントが露出する」としているが、
  // 自身の例(`123` 123 = `123123`)はスペース連結でありこの主張を実証していない。
  // type_system.md §3.2の明示的な表（String+算術演算子→型エラー(__消去)）を正とする。
  if (typeof l === "string") return UNIT;
  if (isUnit(r)) return l; // 右辺Unit = 単位元（id射、素通し）
  if (Array.isArray(l)) {
    // §3.2の算術族テーブル: List左辺の `*`/`^`/`/` は右辺を「回数・個数」として使うため
    // Address（数値）でなければならない。それ以外は型エラーで__へ収束する。
    if (typeof r !== "number") return UNIT;
    if (name === "mul") return listRepeat(l, r);
    if (name === "pow") return listLift(l, r);
    if (name === "div") return listSplit(l, r);
    return UNIT; // list_cheat_sheet.mdに無い組み合わせ（+ - %）はStringと同様に型エラー
  }
  // §3.2 数値の昇格格子: 算術族に数値以外が混ざったら型エラーとして__へ収束する（両方向）。
  // 左辺Stringは上で弾いているが、右辺が String/List/Lambda のケースはここまで落ちてくる。
  // この判定が無いとJSの型強制がそのまま漏れ、「もっともらしく見える間違った値」が
  // 静かに出てくる——`1 + \`abc\`` → "1abc"、`1 + [2 3]` → "12,3"、
  // `x : !__` の `x + 1` → "[object Object]1" は全てこの経路だった。
  // 片方でも BigInt なら整数域の演算として BigInt で行う（JS は混在演算を許さない）。
  if (typeof l === "bigint" || typeof r === "bigint") {
    const a = toBig(l);
    const b = toBig(r);
    if (a === null || b === null) return UNIT;
    const fn = BIG_ARITH[name];
    if (!fn) return UNIT;
    const out = fn(a, b);
    return out === null ? UNIT : fromBig(out);
  }
  if (typeof l !== "number" || typeof r !== "number") return UNIT;
  return ARITH_OPS[name](l, r);
}

// ビット演算（`<< >> && || ;;`）。幅の中で閉じる——ビット列はラップが前提である
// （integer_overflow.md §1「bit演算はラップが前提（暗号・ハッシュ等）」）。
function evalBit(node, env) {
  const l = evaluate(node.left, env);
  const r = evaluate(node.right, env);
  // 算術と同じ族（operator_table.md の同じ行）なので、`__` は両側とも単位元である。
  if (isUnit(l)) return r;
  if (isUnit(r)) return l;
  return bitOnValues(node.name, l, r);
}

function evalArith(node, env) {
  const name = node.name;
  const l = evaluate(node.left, env);
  // 左辺が String の時点で右辺を評価せずに済ませる（型エラーは右辺に依らない）。
  // **ただし1文字は短絡しない**——`Char` は算術の対象なので右辺が要る。
  //
  // **`__` では短絡できない。** 爆発律で結果が右辺そのものになるので、右辺の値が要る
  // ——ここは観測できる差である（`__ + ($UART # x)` は書き込みが起きる）。以前は
  // 「零射との合成は零だから右辺は結果に寄与しえない」という理由で飛ばしていたが、
  // `__` が単位元になった以上その前提が消えた。
  const lim = charLimitOf(env && env.charset);
  if (typeof l === "string" && [...l].length !== 1) return arithOnValues(name, l, undefined, lim);
  const r = evaluate(node.right, env);
  const value = arithOnValues(name, l, r, lim);
  // BigInt は「安全な範囲を超えた整数」であり、溢れの規則を適用する対象そのものである。
  // ここで早期に返してしまうと、幅を超えた値が型の規則を通らずに素通りする。
  if (typeof value !== "number" && typeof value !== "bigint") return value;
  // §3.2「除算だけは整数同士でも丸めが起きる」: 結果型が整数（＝両辺とも
  // 整数）なのに非整数が出たら四捨五入する。丸めるべきかどうかは**値**からは
  // 決められない——JSのNumberでは `5` と `5.0` が同一なので、`5 / 2`（→3）と
  // `5.0 / 2`（→2.5）を値だけで区別できない。pass3 がノードへ載せた Layer 2 型
  // （compile.js のパイプライン）を読んで初めて判定できる。
  // 整数域（`Int` と `Address`）同士の除算がここに来る。アドレスも整数幅なので
  // 丸めの対象は同じ——分けたのは記法と溢れ方であって、除算の丸めではない（§3.6）。
  // 丸めが要るのは f64 の非整数だけである。BigInt は既に整数（BIG_ARITH.div が四捨五入
  // 済み）なので、ここへ入れると Math.round が BigInt を受け取って落ちる。
  if (typeof value === "number" && (node.atomType === "Int" || node.atomType === "Address") && !Number.isInteger(value)) {
    const rounded = roundHalfAwayFromZero(value);
    // 精度が失われたことを information として記録する（unit.md §7.3 と同じ非ブロッキング
    // 診断のレベル）。昇格格子のおかげで Float が絡む算術は精度を落とさないため、
    // 黙って丸めが起きるのは Address 同士の除算だけ——ここだけに診断を置けば足りる。
    if (env && env.diagnostics) {
      env.diagnostics.push({
        level: "information",
        message: `整数除算 ${l} / ${r} の結果を四捨五入して ${rounded} にしました。精度が必要なら左辺を ${l}.0 と書いてください`,
      });
    }
    return rounded;
  }
  // **溢れ方は型が決める**（integer_overflow.md §1）。`Int` はラップアラウンド、`Address` は
  // `__` へ収束する——不正アドレスの伝播を止めるためである。JS の数値は f64 しか無いので、
  // ここを型で矯正しないと 2^53 を超えた時点で「もっともらしく見える間違った値」が出る。
  // 除算の丸めと同じ手法であり、同じ理由（値だけでは決まらない）による。
  return applyOverflowRule(node.atomType, value);
}

// 整数域の演算結果へ、その型の溢れ方を適用する。整数でない結果（Float の演算）は対象外
// ——溢れの規則は幅が確定している整数にしか無い。
function applyOverflowRule(atomType, value) {
  if (typeof value === "number" && !Number.isInteger(value)) return value;
  if (typeof value !== "number" && typeof value !== "bigint") return value;
  const b = toBig(value);
  if (b === null) return value;
  if (atomType === "Int") return wrapInt(b);
  if (atomType === "Address") return clampAddress(b);
  return value;
}

// list_model.md §2.3の派生演算子5種（`~+`/`~-`/`~*`/`~/`/`~^`）が、pass2.js/operator_table.js
// でそれぞれ別名のASTノードになったもの（`~+`のみrange_arithmetic、他4種はrange_arithmetic_rev/
// range_geometric/range_geometric_rev/range_power）。rangeStepFn自体は5種全てのstep関数を
// 既に持っているが、evaluate側の"range"ケースが"range_arithmetic"の1つしか認識しておらず、
// 残り4種は3項形式（終端あり）ですら「未対応の演算」として弾かれていた（8-Queens監査で発見）。
const RANGE_ARITHMETIC_NAMES = new Set([
  "range_arithmetic",
  "range_arithmetic_rev",
  "range_geometric",
  "range_geometric_rev",
  "range_power",
]);

// list_model.md §2.3の派生演算子（`~+`/`~-`/`~*`/`~/`/`~^`）に対応するstep関数を返す。
function rangeStepFn(op, step) {
  switch (op) {
    case "~-":
      return (v) => v - step;
    case "~*":
      return (v) => v * step;
    case "~/":
      return (v) => v / step;
    case "~^":
      return (v) => Math.pow(v, step);
    default:
      return (v) => v + step; // "~+" またはstep省略の単純形式
  }
}

// 範囲の端点になれる値かを判定する。「点」であるのは数値と1文字だけで、それ以外
// （多文字の String・List・Struct）は端点になれない。
//
// 端点でない値を渡されても**例外にはしない**——点でないものを端点に置くことは
// 「射が無い」ということであり、零対象を経由する射（零射）が常に存在する以上、
// 結果は `__` である。静的に判定できた分は pass3 が Pass 3b の診断として記録する。
//
// 判定そのものは要る。検査が無かった頃は数値経路の `v + step` が
// `"abc"` → `"abc1"` → `"abc11"` と値を伸ばし続け、100万回のガードに当たるまで
// 走っていた（無限ループではないが実用上はハング）。
function isRangePoint(v, allowChar) {
  if (typeof v === "number") return true;
  return allowChar && typeof v === "string" && [...v].length === 1;
}

// 文字の範囲（`\a ~ \e` → `abcde`）。文字は Layer 2 では String だが、範囲の端点
// としては符号位置で数える点である。String ≅ List(0u) なので、結果は文字の並び
// ＝String として返す（pass3 の rangeResultType も両端が String なら String を返す）。
// 端点が1文字でなければ範囲ではないので null を返し、呼び出し元の数値経路へ渡さない
// ——数値経路の `v + step` は文字列に対して `"a"` → `"a1"` → `"a11"` と伸ばし続け、
// 100万回のガードに当たるまで走り続けてしまう（実際にハングとして踏んだ）。
function buildCharRange(start, end) {
  const isChar = (v) => typeof v === "string" && [...v].length === 1;
  if (!isChar(start) || !isChar(end)) return null;
  const s = start.codePointAt(0);
  const e = end.codePointAt(0);
  const step = s <= e ? 1 : -1;
  return buildRange(s, e, (v) => v + step)
    .map((c) => String.fromCodePoint(c))
    .join("");
}

// start から end まで（終端を含む）、stepFnを繰り返し適用して配列へ実体化する。
// 昇順・降順どちらもstart/endの大小関係だけから判定する（呼び出し元でstepの符号を揃える）。

/**
 * レンジ式の実体（`Iterator`、list_model.md §2.3・type_system.md §2）。
 *
 * 仕様は「レンジ式は**リストに見えるだけ**であり、実体は常に `{start, step, end}` 相当の
 * 固定サイズ構造体である。要素列はメモリ上に展開されるわけではない」と定める。展開は
 * **消費する側の都合**であって、レンジ自身の性質ではない。
 *
 * 終端の無い形（`0 ~+ 1`）はこれでしか表せない。`stack_abi.md` §3.3 が「開端レンジを
 * 引数として使うとループカウンタになる——再帰という概念を使わずに純粋なループを記述できる」
 * と書いている看板の書き方であり、実体化しかできない実装では**そもそも書けなかった**。
 */
function makeIterator(start, stepFn, end, affineStep = null, source = null, descending = null) {
  // `affineStep` は等差（`~` `~+` `~-`）のときの歩幅。規則が一次なら要素数は割り算で
  // 出るので、`|.|` が**走査すらせずに**答えられる。等比・冪では null（規則が一次でない）。
  //
  // `source` があるときは `start`/`end` は**値ではなく位置**であり、要素は `source[i]`
  // である。器の上を走るイテレータがこれで、機械の上では `{ptr, stride, end}` になる
  // （stack_abi.md §4.6 の「規則」の行）——**コピーは起きない**。
  // **向きは規則が持つ。端点の並びから読み直してはいけない。** 切ったイテレータ
  // （`[0 ~ 3] ' 5~`）は起点が終端を越えているので、並びで見ると降順に化ける——そして
  // 降順のつもりで終端を判定するので、いつまでも尽きない。等差なら歩幅の符号が向きで
  // あり、等比・冪では構築のときに決めた向きをそのまま持ち回る。
  const desc =
    descending !== null
      ? descending
      : typeof affineStep === "number" && affineStep !== 0
        ? affineStep < 0
        : start > end;
  return { __iterator__: true, start, stepFn, end, affineStep, source, descending: desc };
}

// `v` が終端の外か。**向きは規則が持つ**（`descending`）ので、切っても動かない。
function iteratorOutOfRange(it, v) {
  if (isInfiniteIterator(it)) return false;
  return it.descending ? v < it.end : v > it.end;
}

/**
 * 器の要素を走るイテレータ。後置 `~`（展開）がこれを作る。
 *
 * **`~` の結果が値になることが要である。** 器と同じ値を返していたときは、余積が
 * 「右辺に `~` が書いてあるか」という**構文**を見るしかなく、名前に束縛した瞬間に印が
 * 消えていた——`[1 2] [3 4]~` は平らになるのに `n : [3 4]~` を経由すると入れ子になる、
 * という破れである。値が違えば名前を通っても関数を通っても残る。
 *
 * `origin` は名前付きスロットを撒いたときの元の器。**スロットを撒くとは名前ごと撒く
 * ことである**——値だけにすると名前が落ちてマージできない（list_model.md §5.3）。
 */
function makeWalk(items, origin = null) {
  const it = makeIterator(0, (i) => i + 1, items.length - 1, 1, items);
  it.spread = true;
  if (origin) it.origin = origin;
  return it;
}

function isIterator(v) {
  return !!(v && typeof v === "object" && v.__iterator__);
}

/**
 * 「撒かれた並び」か——後置 `~` が付いた値かどうか。
 *
 * **規則そのものと、規則の要素たちは別のものである。** `[1 ~ 3]` は1個の値（`{start,
 * step, end}` の規則）であり、`[1 ~ 3]~` はその要素たちである。どちらもイテレータで
 * 運ばれるので、「イテレータかどうか」では区別できない——だから印を値に持たせる。
 *
 * 印が値にあるので名前を通っても関数を通っても残る。`n : [1 ~ 3]~` と束縛してから
 * `[1 2] n` と書いても撒かれる、という等価性がこれで保たれる。
 */
function isSpread(v) {
  return isIterator(v) && v.spread === true;
}

// 終端を持たないストリームは無限である。数え上げ・実体化はできない。
function isInfiniteIterator(v) {
  return isIterator(v) && (v.end === null || v.end === undefined);
}

// n 番目の要素を取り出す。**無限でも引ける**——これがループカウンタを成立させる。
function iteratorAt(it, n) {
  if (!Number.isInteger(n) || n < 0) return UNIT;
  // 規則が一次なら、`i` 回進めるのは掛け算1回である——`start + i × step`。
  // type_system.md §2 のアクセス表が `Iterator(T)` の欄に書いているのがこれで、
  // Pass 4 が出すのもロードではなくこの算術になる。
  if (typeof it.affineStep === "number" && typeof it.start === "number") {
    const v = it.start + n * it.affineStep;
    // 器の上なら `v` は位置なのでそこを読む。規則の上なら `v` そのものが要素である。
    const pick = (x) => (it.source ? (x in it.source ? it.source[x] : UNIT) : x);
    if (isInfiniteIterator(it)) return pick(v);
    return iteratorOutOfRange(it, v) ? UNIT : pick(v);
  }
  let v = it.start;
  for (let i = 0; i < n; i++) {
    v = it.stepFn(v);
    if (iteratorOutOfRange(it, v)) return UNIT;
  }
  return v;
}

/**
 * 要素数。**数えることと並べることは別である**（list_model.md §2.3）。
 * 等差なら規則から割り算1回で出る。そうでなくても走査で足りる——走査は O(1) メモリで、
 * 配列を作る必要はどこにも無い。無限は数え上げられないので零射（`__`）。
 */
function iteratorCount(it) {
  if (isInfiniteIterator(it)) return UNIT;
  const { start, end, affineStep } = it;
  if (typeof affineStep === "number" && affineStep !== 0) {
    const n = Math.floor((end - start) / affineStep) + 1;
    return n > 0 ? n : 0;
  }
  let v = start;
  let n = 0;
  while (!iteratorOutOfRange(it, v)) {
    n++;
    v = it.stepFn(v);
    if (n > 1000000) throw new Error("interpreter: range: 要素数が多すぎます（stepが0または終端に向かっていない可能性）");
  }
  return n;
}

// 先頭を1つ進めたイテレータ。`[h ~t]` の `t` がこれである——**残余は展開ではない**。
// これがあるおかげで、レンジ上の再帰が O(1) メモリで回る。
function iteratorRest(it) {
  const next = it.stepFn(it.start);
  if (iteratorOutOfRange(it, next)) return UNIT;
  return makeIterator(next, it.stepFn, it.end, it.affineStep, it.source, it.descending);
}

// 有限のイテレータだけを実体化する。無限は展開できないので `__`——「無限を配列にする」
// という射は無い。**ここへ来ることが「展開」であり、それは消費側の要求でしか起きない。**
function materializeIterator(it) {
  if (isInfiniteIterator(it)) return UNIT;
  const out = [];
  let v = it.start;
  const ascending = it.start <= it.end;
  let guard = 0;
  while (ascending ? v <= it.end : v >= it.end) {
    // 器の上なら `v` は位置である。規則の上なら `v` そのものが要素である。
    out.push(it.source ? it.source[v] : v);
    v = it.stepFn(v);
    if (++guard > 1000000) throw new Error("interpreter: range: 要素数が多すぎます（stepが0または終端に向かっていない可能性）");
  }
  return out;
}

// 値としてリストが要る場面で、イテレータなら実体化して渡す。
function deIterate(v) {
  return isIterator(v) ? materializeIterator(v) : v;
}

function buildRange(start, end, stepFn) {
  const out = [];
  let v = start;
  let guard = 0;
  const ascending = start <= end;
  while (ascending ? v <= end : v >= end) {
    out.push(v);
    v = stepFn(v);
    if (++guard > 1000000) throw new Error("interpreter: range: 要素数が多すぎます（stepが0または終端に向かっていない可能性）");
  }
  return out;
}

// type_system.md §6.2「`==` は常に純粋な構造比較（Hom集合の一致）であり、コンストラクタ名を
// 一切参照しない」: 値の「形」（Scalar/String/List/Struct）と中身だけを再帰的に比較する。
// どのコンストラクタ関数経由で作られたかは一切問わない（それを問うのは`===`/`' !__`の役目——
// Pass1レベルでの構造体の生成元追跡が必要になる別機能で、今回は対象外）。
// Unit同型の値（__・空配列・空文字列、いずれもisUnit）は互いに構造的に等しいとみなす
// （零対象は1つしかない、というunit.mdの立場と一貫させる）。
/**
 * **撒いた文字は文字列へ戻る**（原理7——`String` の μ は強制である）。
 *
 * `List` の μ は任意なので `~` を書いて初めて平らになるが、`String` のそれは書かなくても
 * 効く。つまり `s~` と `s` は**同じ値でなければならない**——機械はそう出している
 * （`~` は 0 命令、`s~ = s` は真）。ここが無いと解釈器だけが違う答えを出し、
 * **照合の相手として使えなくなる**。
 */
function collapseText(v) {
  if (!isIterator(v) || !v.spread || !v.text) return v;
  const d = deIterate(v);
  return Array.isArray(d) && d.every((x) => typeof x === "string") ? d.join("") : v;
}

function structuralEqual(l, r) {
  if (isUnit(l) && isUnit(r)) return true;
  if (isUnit(l) || isUnit(r)) return false;
  if (Array.isArray(l) && Array.isArray(r)) {
    return l.length === r.length && l.every((v, i) => structuralEqual(v, r[i]));
  }
  if (Array.isArray(l) || Array.isArray(r)) return false;
  const lIsPlainObject = l !== null && typeof l === "object" && !l.__lambda__;
  const rIsPlainObject = r !== null && typeof r === "object" && !r.__lambda__;
  if (lIsPlainObject && rIsPlainObject) {
    const lKeys = Object.keys(l);
    const rKeys = Object.keys(r);
    return (
      lKeys.length === rKeys.length &&
      lKeys.every((k) => Object.prototype.hasOwnProperty.call(r, k) && structuralEqual(l[k], r[k]))
    );
  }
  if (typeof l === "object" || typeof r === "object") return l === r; // Lambda等は参照同一性のみ
  return l === r; // Scalar/String
}

// comparison.md §2.1: 真のとき左辺と右辺のどちらを返すかは「左辺の値が**算術単位元**か」で
// 決まる。対象は Layer 2 型が数値（Address/Float/Vector）であるものに限る——
// リストや文字列は数値的に 0 に見えても算術ドメインではないため対象外。
//
// Float も対象に含む（ℝ は体であり 0 が加法単位元・1 が乗算単位元として ℤ と同格に
// 存在する。2026-08-09 に comparison.md の Float 除外を撤回した）。値だけでは
// リスト・文字列との区別がつかない場面があるため、pass3 がノードへ載せた Layer 2 型
// （compile.js のパイプライン）を読む。
function isArithmeticUnitElement(value, leftNode) {
  if (value !== 0 && value !== 1) return false;
  const type = leftNode && leftNode.atomType;
  // 型注釈が無い（pass3を通していない経路）の場合は、値が0/1である時点で数値とみなす
  if (type === undefined || type === null) return true;
  return type === "Int" || type === "Address" || type === "Float" || type === "Vector";
}

function evalCompare(node, env) {
  const l = evaluate(node.left, env);
  // 継続の規則（operator_table.md「Unit 欄の読み方」）: 左辺が零射へ落ちる演算子は、
  // その時点で結果が `__` に確定する。零射との合成は零であり右辺の値は結果に寄与しえない
  // ため、右辺を評価してはならない。算術（`+` 等）や `'` は既にそうなっており、比較だけが
  // 両辺を評価していた——Sign は副作用と非停止を持つので、`__ < ($UART # x)` で書き込みが
  // 起きるかどうかが変わる観測可能な差である。
  //
  // `!=` と `!==` だけは左辺Unitでも零射ではなく恒等射（非Unit側の値を返す）なので、
  // 右辺の値が要る。ここで短絡させてはならない。
  if (isUnit(l) && node.op !== "!=" && node.op !== "!==") return UNIT;
  return compareOnValues(node.name, node.op, l, evaluate(node.right, env), node.left);
}

// 比較族の型規則を**値に対して**適用する。通常の中置（evalCompare）とポイントフリー
// （`[== 2]` 等）の両方から呼ぶ——arithOnValues と同じ役割で、算術が既にそうなっている
// のに比較だけが evaluate と癒着していたため、ポイントフリー側から再利用できなかった。
// leftNode は `isArithmeticUnitElement` の型判定にだけ使う。ポイントフリーの右辺束縛
// （`[== 2] 6`）では左辺値がストリームから届きノードが無いので null を渡す——
// その場合 isArithmeticUnitElement は「値が0/1なら数値」とみなすフォールバックへ落ちる。
function compareOnValues(name, op, l, r, leftNode) {
  // 比べるのは**値**である。撒いた文字は文字列に戻してから比べる（原理7）。
  l = collapseText(l);
  r = collapseText(r);
  if (op === "!=") {
    // 例外: 比較族は両辺とも吸収元だが、`!=` だけは**両辺とも単位元**である
    // （operator_table.md tier 12）。片方が Unit なら「等しくない」ことが確定して真になり、
    // 真のときに情報を運ぶのは非Unit側の値なので、そちらを返す。
    // 以前は左辺Unitだけ `__`（吸収元）を返しており、`5 != __` が 5 を返すのに
    // `__ != 5` は `__` という非対称になっていた——同じ演算子が引数の順序で挙動を
    // 変えていたことになる。`!==` は元から両辺とも非Unit側を返しており、そちらが正しい。
    // 両辺ともUnitの場合は r（＝Unit）が返り、「等しいので偽」という正しい結果になる。
    if (isUnit(l)) return r;
    if (isUnit(r)) return l;
    // 真の場合の返値選択は他の比較演算子と同じ §2.1 の規則に従う（comparison.md §1が
    // `!=` を対象の比較演算子として列挙しており、§2.1の適用外とされているのは
    // 構造比較の `==`/`!==` だけ）。ここだけ左辺固定になっていた。
    return l !== r ? (isArithmeticUnitElement(l, leftNode) ? r : l) : UNIT;
  }
  if (op === "==") {
    // type_system.md §6.2: 型シグネチャ (L -> R) -> (L | __)。真なら左辺、偽ならUnit
    // （他の比較演算子・§4の慣習と同じ「返値が情報を運ぶ」規約）。
    return structuralEqual(l, r) ? l : UNIT;
  }
  if (op === "!==") {
    // `!==`は`==`の否定——ただしUnit規則は`!=`とは別物（operator_table.md 56行目）:
    // 左辺Unit→右辺値を返す、右辺Unit→左辺値を返す（どちらも素通し。`!=`の「左辺Unitは
    // 吸収元」のような非対称な吸収は無い）。両辺ともUnitなら構造的に等しい（__ == __）
    // ので「等しくない」は偽＝Unitを返す。
    if (isUnit(l) && isUnit(r)) return UNIT;
    if (isUnit(l)) return r;
    if (isUnit(r)) return l;
    return structuralEqual(l, r) ? UNIT : l;
  }
  if (isUnit(l) || isUnit(r)) return UNIT; // 両辺とも吸収元
  const truthy = COMPARE_OPS[name](l, r);
  // §2.1: 左辺が算術単位元(0/1、Intドメインに限る)なら右辺、それ以外は左辺を返す
  return truthy ? (isArithmeticUnitElement(l, leftNode) ? r : l) : UNIT;
}

// 前置/後置の単項演算（すでに評価済みの値vに対して行う）。通常のevaluate()経路
// （node.operandを評価してここへ渡す）と、ポイントフリーのhole適用（下記applyPointfree、
// 呼び出し引数を直接vとして渡す）の両方から共有する。
function evalUnaryOp(name, v) {
  switch (name) {
    case "negate":
      return isUnit(v) ? UNIT : -v;
    case "not":
      return isUnit(v) ? IDENTITY : UNIT; // §4: !__ = Id射（真）、!非Unit = __（偽）
    case "input":
      // 前置@（参照外し）。$で作った参照セルはget()で読み取る。それ以外の値
      // （$を経由せず直接Lambda等が束縛された識別子）はそのまま素通しする——
      // `@f 1`が「fを参照外ししてから呼ぶ」と「fを直接呼ぶ」の両方で同じ記法になるように
      // （手動カリー化`@(f 1) 2`の継続呼び出しと、通常のLambda呼び出しを区別しない）。
      // unit.md §0.4: @__ = __（Unitもそのまま吸収元として素通し）。
      return v && v.__address__ ? v.get() : v;
    case "expand": {
      // **後置 `~` は「器を開いて中身を撒く」だけを意味する。** 返すのは器そのものでは
      // なく「消費されるべき並び」＝イテレータであり、器とは別の値である
      // （list_model.md §2.3「消費と展開は別のこと」）。
      //
      // 器と同じ値を返していたときは、余積が「右辺に `~` が書いてあるか」という**構文**を
      // 見るしかなく、名前に束縛した瞬間に印が消えていた。添字位置の「N から末尾まで」は
      // Pass 2 が終端の無いレンジへ均している（`desugarIndexRest`）ので、ここには来ない。
      if (isUnit(v)) return UNIT; // 零射（operator_table.md tier 23）
      // **不動点は「撒かれた並び」であって「規則」ではない。** 規則に `~` を付けると
      // その要素たちになる——`[1 ~ 3]` は1個の値、`[1 ~ 3]~` は 1,2,3 である。
      // 既に撒かれているものへもう一度付けても変わらない（冪等）。
      if (isSpread(v)) return v;
      if (isIterator(v)) return { ...v, spread: true };
      // **文字から来たことを覚えておく。** 撒く印は値に持たせる必要があるが（構文では
      // 名前に束縛した瞬間に消える）、`String` の μ は強制なので**値として見るときには
      // 文字列に戻らなければならない**（原理7）。機械では `~` は 0 命令なので最初から
      // 同じもので、解釈器だけが `["a","b"]` のまま持っていた。
      if (typeof v === "string") {
        const w = makeWalk([...v]);
        w.text = true;
        return w;
      }
      if (Array.isArray(v)) return makeWalk(v);
      // 名前付きスロットの展開は「スロットを名前ごと撒く」ことである（§5.3）。
      if (isNamedSlots(v)) return makeWalk(Object.values(v), v);
      // **1要素はスカラーと同型**（`[x]` ≅ `x`）。撒いても1つなので器へ戻る。
      return makeWalk([v]);
    }
    case "continuous":
      // 前置~（rest記法用の密着マーカー）。値としてはオペランドをそのまま返す。
      return v;
    case "bit_not":
      // `!!` は幅の中での補数。幅が無ければ「全ビット反転」が定義できない。
      return bitNot(v);
    case "factorial": {
      if (isUnit(v)) return UNIT;
      let r = 1;
      for (let i = 2; i <= v; i++) r *= i;
      return r;
    }
    case "export_internal":
    case "export_external":
    case "export_pin":
      return v;
    case "import":
      // **`foo@` は `#foo` の随伴である**（`system_architecture.md` §2.1）。
      //
      // `#` が「名前を発見可能にする」なら、`@` は「発見した名前を要求する」——同じ一つの
      // 関係を両側から書いている。同一オブジェクト内では**指す先はその名前そのもの**なので
      // （§2.1「静的に解決（インライン化または同一オブジェクト内）」）、値としては素通しで
      // ある。`export` の3つが素通しなのと同じ理由で、対になっている。
      //
      // 別のオブジェクトから取り込む形（`link: static` / `dynamic`）はここには来ない
      // ——そちらは名前がこのスコープに無いので、識別子の解決の側で決まる。
      return v;
  }
  throw new Error(`interpreter: 未対応の前置/後置演算 '${name}'`);
}

// ポイントフリー演算子（`[+]`/`[+ 1]`/`[!_]`/`[_!]`等）を呼び出し引数へ適用する。
// 中置（op/left/right）と前置/後置（op/operand=hole）の両方に対応する
// （function_guide.md「全ての演算子を関数として扱う」、演算子の種類を問わない）。
// - 前置/後置（`[!_]`/`[_!]`）: holeの位置に呼び出し引数をそのまま充てる（arity=1固定）。
// - 中置・完全に裸（left/right両方null）: 貪欲に複数引数を畳み込む（function_guide.md
//   「ポイントフリー記述の二項演算子は、複数の引数を貪欲に演算する」、[+] 1 2 3 4 5 → 15）。
//   後置~による展開（evalArgValues）と組み合わせれば、[+] [1 2 3 4]~ のような畳み込み
//   関数（list_cheat_sheet.md）としても機能する。
// - 中置・右辺だけ束縛（left=null, right=非null）: 呼び出し引数が欠けている左辺を埋める
//   （[+ 1] 5 = 5 + 1、documents/ja-jp/guide/example.snの合成連鎖の例）。
// `list ' index` / `struct ' field` の本体。左辺は評価済みの値を、右辺は**ノードのまま**
// 受け取る——右辺が識別子のときはフィールド名そのものとして扱うため、値へ評価しては
// ならないからである。通常の中置（evaluateのget_prop）とポイントフリー（`[' 0]`）の
// 両方から呼ぶ。以前はevaluateの中にインラインで書かれており、ポイントフリー側から
// 再利用できなかったため `[' 0]` が「未対応の演算子」で落ちていた。
function getPropValue(l, rightNode, env) {
  if (isUnit(l)) return UNIT;

  // **イテレータは添字で引ける。無限でも引ける。** これがループカウンタを成立させる
  // ——`c : [0 ~+ 1]` の n 番目は、start から step を n 回適用すれば出る（stack_abi.md §3.3）。
  // 範囲での添字（部分列）は実体化してから通す。
  // 添字は**値として**読む。`s ' 1~` は Pass 2 が `s ' (1 ~+ 1)` へ均しているので、
  // ここに後置 `~` を見る分岐は要らない——書き方が2通りあって道が2本ある、が無くなる。
  if (isIterator(l)) return getPropByValue(l, evaluate(rightNode, env));
  // 右辺が識別子のとき、それを「名前」と読むか「値（添字）」と読むかは**左辺が決める**。
  //
  // type_system.md §2 は「名前付きスロット（`[key : val]`）と連番スロット（`1, 2, 3`）は
  // 同じ構造であり、名前の有無だけが違う」と規定している。したがって区別の基準は
  // 名前を持つかどうかであり、それは左辺の形にしか無い情報である。
  //
  //   名前付きスロット → 右辺の識別子は**名前**       `d ' foo`
  //   連番スロット・List・String → 右辺の識別子は**値**  `xs ' i`
  //
  // 以前は左辺を問わず常に名前として扱い、名前付きでなければ `__` を返していた。
  // そのため §2 が OK 例として明示している `list ' i`（`i` は実行時変数でよい）が
  // 書けず、仮引数経由の `f : n ? l ' n` も `__` になっていた——連番スロットは
  // 「順序が意味そのもの」であり、変数で引けなければバイト並びを扱う手段にならない。
  // **名前は識別子として綴れるものだけではない。** スロットの意味論は「名前→値の有限写像」
  // なので（function_guide.md「構造体メンバーの一致による自動バインディング」）、
  // 演算子記号のように識別子にできない綴りも文字列リテラルで名前にできる。
  // どちらも綴りの外側を1文字ずつ剥がせば名前になる（`<foo>` / `` `+` ``）。
  //
  // 名前として読むのは**左辺が名前付きスロットのときだけ**である。List や String が
  // 左辺なら右辺は値（添字）であり、その判断は下の内側の条件が持っている。
  // **後置 `~` は「中身を出せ」である。** 名前付きスロットに対して `d ' k~` と書いたら、
  // `k` という綴りではなく `k` が持っている値を名前として引く。`~` の意味は他の位置と
  // 同じ「展開して渡す」で、ここでは「識別子を綴りのままではなく中身で渡す」になる。
  //
  // 名前付きスロットに順序は無い（`type_system.md` §6.2、位置アクセスを持たない）ので、
  // 添字位置の `N~` が意味する get-rest はそもそも成立しない。空いている綴りである。
  //
  // 見るのは Pass 2 が残した `desugaredFrom: "index-rest"` の印で、元の添字は左辺に在る。
  if (l && typeof l === "object" && !Array.isArray(l) && rightNode && rightNode.desugaredFrom === "index-rest") {
    const key = evaluate(rightNode.left, env);
    if (isUnit(key)) return UNIT;
    const k = String(observe(key));
    return Object.prototype.hasOwnProperty.call(l, k) ? l[k] : UNIT;
  }
  if (rightNode.type === "atom" && (rightNode.kind === "identifier" || rightNode.kind === "string")) {
    if (l && typeof l === "object" && !Array.isArray(l)) {
      const key = rightNode.value.slice(1, -1); // "<foo>" -> "foo" / "`+`" -> "+"
      return Object.prototype.hasOwnProperty.call(l, key) ? l[key] : UNIT;
    }
    // 名前を持たない左辺（List / String / スカラー）。識別子は値として評価し、
    // 下の添字経路へ落とす。
  }
  // スカラー ≅ 1要素リスト（asListと同じ同型性）。非Array値も長さ1のリストとして
  // インデックスアクセスできる（`5 ' 0` = 5、`5 ' 1` = __）。
  // string_and_comment.md §6「文字列は0uリテラルのシーケンスとして扱える」:
  // Stringは文字のListと同型（list_model.md）なので、文字ごとに分解してインデックス
  // アクセスする（`hello ' 0` = `h`）。get-rest・複数インデックス取得の結果は
  // 文字の配列のままではなく文字列へ戻す（isString、Stringとして返す方が同型性に
  // 合う——List側の`[1 2 3 4] ' [1~3] → [2 3 4]`と対称）。
  const isString = typeof l === "string";
  const asIndexable = Array.isArray(l) ? l : isString ? l.split("") : [l];
  // get-rest（`list ' N~`）はここには無い。Pass 2 が `list ' (N ~+ 1)` へ均しており、
  // 「終端の無いレンジで引く＝そこから末尾まで」として `getPropByValue` が1本で扱う。
  return getPropByValue(l, evaluate(rightNode, env));
}

// 添字が**値として**確定している場合の取得。フィールド名（識別子）と get-rest（後置~）は
// 右辺のノード形を見ないと決まらないため getPropValue 側に残し、ここは数値・範囲だけを扱う。
// 左辺束縛のポイントフリー（`[[3 , 4] ']` に添字を渡す形）は右辺がノードとして存在しない
// ——ストリームから値で届く——ため、この入口が要る。
// 後置 `~`（展開）が付いているか。マージが「双方に `~`」を条件にしているので
// （list_model.md §5.3）、値ではなく**書かれ方**を見る必要がある。
function isSpreadNode(n) {
  return !!n && n.type === "operation" && n.position === "postfix" && n.name === "expand";
}

/**
 * 切り出した並びを値へ戻す。**1要素はスカラーである**（`[5]` は `Int`、list_model.md）。
 *
 * リテラルのブロックは構文の時点で潰れる（1行だけのブロックは括りでしかない）。文字列の
 * スライスも `join("")` で潰れる。ところがリストのスライスだけが配列のまま残っており、
 * `String ≅ List(0u)` が片側でしか成立していなかった——同じ操作の結果が、器が文字列か
 * リストかで別の形になっていた。
 *
 * これは見た目の問題ではない。`|st| = 1` のような長さでの場合分けが、潰れる側と潰れない
 * 側で違う答えを出す（parser.sn の `peek` が末尾のトークンを器ごと返していたのがこれ）。
 */
function collapseSlice(arr) {
  if (!Array.isArray(arr)) return arr;
  if (arr.length === 0) return [];
  return arr.length === 1 ? arr[0] : arr;
}

// 名前付きスロット（プレーンオブジェクト）か。List・String・スカラーと区別する。
function isNamedSlots(v) {
  // イテレータもプレーンオブジェクトなので明示的に除く——`{start, step, end}` の
  // フィールドは**規則の内訳**であって名前付きスロットではない。
  return v !== null && typeof v === "object" && !Array.isArray(v) && !v.__lambda__ && !v.__address__ && !v.__iterator__;
}

function getPropByValue(l, r) {
  if (isUnit(l)) return UNIT;
  // **終端の無いレンジで引くのは「その位置から末尾まで」である。** 位置の列そのものは
  // 実体化できないが、器の側に終端があるので、そこで閉じればよい。`s ' 1~` は Pass 2 が
  // `s ' (1 ~+ 1)` へ均しているので（`desugarIndexRest`）、両方がこの1本の道を通る。
  if (isInfiniteIterator(r) && typeof r.start === "number") {
    const from = r.start;
    // 左辺もイテレータなら、進めたイテレータそのものが答えである——**展開しない**。
    if (isIterator(l)) {
      let cur = l;
      for (let i = 0; i < from && isIterator(cur); i++) cur = iteratorRest(cur);
      return cur;
    }
    const asStr = typeof l === "string";
    const items = Array.isArray(l)
      ? l
      : asStr
        ? l.split("")
        : isNamedSlots(l)
          ? Object.values(l)
          : [l];
    // 負の添字は末尾から数える（`slice` の負 start 解釈が Sign の規約と一致する）。
    //
    // **スライスは覗き窓である**（`listView`）。`l ' 1~` と `[x ~xs]` の `xs` は同じ
    // 「残り」を別の書き方で取っているにすぎず、機械の側はどちらも `ptr` と `len` を
    // ずらすだけである。写すと書き込みが元へ届かなくなる。
    if (Array.isArray(l) && !asStr) {
      const start = from < 0 ? Math.max(0, items.length + from) : from;
      return collapseSlice(listView(items, start, items.length));
    }
    const sliced = items.slice(from);
    return asStr ? sliced.join("") : collapseSlice(sliced);
  }
  // **添字としてのレンジは消費側である。** どの位置を採るかの並びが要るので、ここで走る。
  r = deIterate(r);
  if (isUnit(r)) return UNIT;
  if (isIterator(l)) {
    // 左辺がイテレータなら、位置ごとに規則を適用すれば済む——**左辺は展開しない**。
    // 無限ストリームからの部分列取得もこれで通る。
    if (typeof r === "number") return iteratorAt(l, r);
    if (Array.isArray(r)) return collapseSlice(r.map((i) => iteratorAt(l, i)));
    return UNIT;
  }
  const isString = typeof l === "string";
  // 名前付きスロットは **名前・連番・実データ** の三つを持つ。名前で引くのは
  // getPropValue 側（右辺が識別子のとき）、連番で引くのはここ（右辺が数値のとき）である。
  //
  // 連番は宣言順であって、物理オフセットの順（名前ソートの正規順、stack_abi.md §7.1）
  // ではない。両者が食い違っても矛盾しない——`==` は Hom集合の一致であって**同一性では
  // ない**（同一性は `===` と `' !__` が担う、§6.2）。したがって
  // `point == point2` が真でありながら `point ' 0` と `point2 ' 0` が違う値になるのは、
  // `==` が比較していない別の性質を測っているだけであり、正しい観測である。
  const asIndexable = Array.isArray(l)
    ? l
    : isString
      ? l.split("")
      : isNamedSlots(l)
        ? Object.values(l)
        : [l];
  // 負のインデックスは末尾から数える（`-1`=最後の要素、length+indexへ写像）。
  // 正側は0始まり、負側は-1始まり（-0が無いため対称にはならない）。
  // type_system.md §4.1: `'` は Address（位置）を構造的に要求するため、Float が
  // 来たら四捨五入する（AArch64の`fcvtas`＝最近接・タイは0から遠ざける、1命令）。
  // 位置は整数でしか存在しないので、`list ' 1.5` は補間ではなく `list ' 2` になる。
  // 既に整数ならroundHalfAwayFromZeroは恒等なので、この丸めに静的な型情報は要らない
  // （除算の丸めは Address同士かFloat混在かで挙動が変わるため pass3 が必要、という
  // 点で対照的）。
  const resolveIndex = (i) => {
    const n = roundHalfAwayFromZero(i);
    return n < 0 ? asIndexable.length + n : n;
  };
  if (typeof r === "number") {
    const idx = resolveIndex(r);
    return idx >= 0 && idx < asIndexable.length ? asIndexable[idx] : UNIT;
  }
  // list_cheat_sheet.md「範囲で要素取得」: `[1 2 3 4] ' [1 ~ 3]` → `[2 3 4]`。
  // rangeが実体化したインデックス列（配列）で、該当位置の値をまとめて取り出す。
  if (Array.isArray(r)) {
    const mapped = r.map((i) => {
      if (typeof i !== "number") return UNIT;
      const idx = resolveIndex(i);
      return idx >= 0 && idx < asIndexable.length ? asIndexable[idx] : UNIT;
    });
    return isString ? mapped.map((v) => (isUnit(v) ? "" : v)).join("") : collapseSlice(mapped);
  }
  return UNIT;
}

function applyPointfree(node, closureEnv, argValues) {
  if (node.position === "prefix" || node.position === "postfix") {
    const x = argValues.length > 0 ? argValues[0] : UNIT;
    return evalUnaryOp(node.name, x);
  }

  const combine = (a, b) => {
    // 算術は通常の中置と同じ型規則を通す（arithOnValues）。以前はARITH_OPSを直に
    // 叩いており、`[+ 1] [1 2 3]` → "1,2,31"（JSの配列→文字列強制）や
    // `[* 2,] \`abc\`` → NaN といった silent-wrong-value が漏れていた。
    if (ARITH_OPS[node.name]) return arithOnValues(node.name, a, b);
    if (COMPARE_OPS[node.name]) {
      // ポイントフリーはList側のfold/map/filterが前提（8/5の設計合意）のため、単位元の
      // 見方も算術側（0/1）ではなくList側に移る——真なら常に要素そのもの(a)を残す。
      // evalCompare（通常の中置比較）の§4規則「左辺が算術単位元(0/1)なら右辺、それ以外は
      // 左辺」は、算術チェーンの中で「次に運ぶ値」を選ぶための規則であり、fold/map/filter
      // で「元の要素を残す/捨てる」ことが目的のポイントフリー文脈にはそぐわない
      // （`[< 3,] [1 2 3]~`が要素の1,2ではなく評価結果の3,2になってしまう）。
      if (isUnit(a) || isUnit(b)) return UNIT;
      const truthy = COMPARE_OPS[node.name](a, b);
      return truthy ? a : UNIT;
    }
    // `[' 0]`（インデックス取得）・`[' foo]`（フィールド取得）のポイントフリー。
    // 右辺は**ノードのまま** getPropValue へ渡す——識別子はフィールド名そのものとして
    // 扱うため、値へ評価してはならない（`[' foo]` の foo は変数ではなくキー名）。
    // これが無いと `[' 0] [3 , 4]` が「未対応の演算子」で落ち、`[_ ' 0]` という
    // ホールを使った回避形を書かざるを得なかった。
    if (node.name === "get_prop") {
      // 右辺束縛（`[' 0]` / `[' foo]`）は右辺のノードをそのまま使う。
      // 左辺束縛（`[[3 , 4] ']`）は添字がストリームから値で届くので値版へ回す。
      return node.right !== null && node.right !== undefined
        ? getPropValue(a, node.right, closureEnv)
        : getPropByValue(a, b);
    }
    // 論理族（`;` `|` `&`）。中置は短絡評価だが、ポイントフリーでは束縛側が既に評価済みで
    // 両辺の値が揃っているため、短絡は観測されない——値だけで決まる。返り値は中置と同じ
    // 規約に従う（`[| 0]` は「既定値の補完」、`[& 1]` は「ガード」として自然に読める）。
    if (node.name === "and") return isUnit(a) || isUnit(b) ? UNIT : b;
    if (node.name === "or") return isUnit(a) ? b : a;
    if (node.name === "xor") return isUnit(a) ? b : isUnit(b) ? a : UNIT;
    // 等価族（`==` `!==` `!=`）。真偽の判定は中置と同じ compareOnValues へ委ね、返す値だけを
    // List 側の規約へ揃える（真なら要素そのものを残す）——上の COMPARE_OPS 分岐と同じ理由で、
    // fold/map/filter が前提のポイントフリー文脈では「元の要素を残す/捨てる」ことが目的。
    if (node.op === "==" || node.op === "!==" || node.op === "!=") {
      return isUnit(compareOnValues(node.name, node.op, a, b, null)) ? UNIT : a;
    }
    throw new Error(`interpreter: pointfree: 未対応の演算子 '${node.name}'`);
  };

  // **器を1つ受けたら、その要素の上を走る。**
  //
  // 貪欲なポイントフリーは器を1本走査するものであり、その器が並置で届こうが（`[* 2,] 1 2 3`）
  // 器1つで届こうが（`[* 2,] [1 2 3]`）同じものである。以前は前者だけを走査対象と見て、
  // 後者は「器という1つの要素」として扱っていた——`[* 2,] [1 2 3]` が `[[1 2 3 1 2 3]]`
  // （List * Int の複製）になり、`~` で撒き直さないと写像にならなかった。
  //
  // 余積での関数適用が構築より下の優先順位になった今、並置は**ここへ来る前に器へまとまる**。
  // 走査対象を「届いた実引数の並び」ではなく「受け取った器」と読み直せば、両方の書き方が
  // 同じ道を通る——合成（`[* 2,] [* 3,] 1 2 3`）も、内側が返した器がそのまま外側の
  // 走査対象になるだけの話になる。
  // **走るのは貪欲な形だけである。** `[* 2,]`（写像）と `[+]`（畳み込み）は残りアリティが
  // あるので器を走るが、`[+ 1]` や `[' 1]` は残りアリティ0の**合成済み**の関数であり、
  // 受け取った器はそのまま1つの値である（`[+ 1] [1 2 3]` は `[1 2 3] + 1` で型エラー、
  // `[' 1] [3 , 4]` はその器の添字1）。ここを分けずに走らせると、合成済みの側が黙って
  // 写像に化ける。
  const rightBound = node.right !== null && node.right !== undefined;
  const leftBound = node.left !== null && node.left !== undefined;
  const greedy = !!node.pointfreeMap || (!leftBound && !rightBound);
  if (greedy && argValues.length === 1 && Array.isArray(argValues[0])) argValues = argValues[0];

  if (node.pointfreeMap) {
    // 末尾カンマの写像糖衣構文（`[* 2,]`、function_guide.md「そのすべてに適用される」）。
    // 複数の位置引数（`[* 2,] 1 2 3 4 5`、Phase2の貪欲消費でここへ集約済み）・後置~で
    // 展開されたList（`[* 2,] [1 2 3]~`、evalArgValuesが既に展開済み）のどちらでも、
    // argValuesは「写像対象の値がフラットに並んだ配列」として届く。各要素へ演算を適用し、
    // 結果からUnitを取り除く——比較演算子（`[< 3,]`）は真の場合のみ値を返す（§4）ため、
    // このUnit除去だけで「選択写像」（select、偽だった要素の除外）が自然に得られる
    // （list_cheat_sheet.md「選択写像」、余積のUnit除去則、type_system.mdの輸入失敗例と同型）。
    const bound = rightBound ? evaluate(node.right, closureEnv) : undefined;
    const results = argValues.map((v) => (isUnit(v) ? UNIT : combine(v, bound)));
    return results.filter((r) => !isUnit(r));
  }

  if (!leftBound && !rightBound) {
    if (argValues.length === 0) return UNIT;
    return argValues.reduce((acc, v) => (isUnit(acc) ? UNIT : combine(acc, v)));
  }
  if (rightBound && !leftBound) {
    const bound = evaluate(node.right, closureEnv);
    const x = argValues.length > 0 ? argValues[0] : UNIT;
    if (isUnit(x)) return UNIT;
    return combine(x, bound);
  }
  // 左辺束縛・右辺欠落（`[1 -]` = `x ? 1 - x`）。右辺束縛（`[- 1]`）と対称で、
  // 非可換な演算子では両方が必要になる。オペランドの順序だけが逆になる。
  if (leftBound && !rightBound) {
    const bound = evaluate(node.left, closureEnv);
    const x = argValues.length > 0 ? argValues[0] : UNIT;
    if (isUnit(x)) return UNIT;
    return combine(bound, x);
  }
  return UNIT;
}

// ---- construct/concat/product（List/Struct構築） ----
// unit.md 91-92行目: 空白/カンマ等の余積演算における __ は単位元（`__ op x = x`）であり、
// 103行目「`__ = []`（空リストと等価）」の通り、値として並べず消去（フィルタ）する。
function asList(v) {
  if (isUnit(v)) return [];
  // イテレータは「リストに見えるだけ」なので、リストが要る場面で初めて実体化する
  // （list_model.md §2.3）。無限は実体化できないので `__` ＝空になる。
  if (isIterator(v)) return asList(materializeIterator(v));
  return Array.isArray(v) ? v : [v];
}
/**
 * **文字列の吸収則**（type_system.md §3.2 の余積族）。どちらかが文字列ならテキストとして
 * 連結する。連結にならないなら null を返す。
 *
 * **同じ規則が3箇所に要る。** 余積は書かれ方で `construct` / `push` / `unshift` の3つの
 * ノードになるが、規則は1つである。`construct` にしか書いていなかったので、括弧が付いて
 * `unshift` になった途端に吸収が効かなくなっていた——`` `a` `bc` `` は "abc"、
 * `` `a` (`b` `c`) `` は ["a","bc"] という別物になり、**同じ値を代入しただけで結果が
 * 変わる**（参照透明が壊れる）。
 *
 * **括弧は評価順を決めるだけで、構造を作らない。** `String` の μ は強制だからである
 * （原理7、`String ≅ List(Char)`）——文字列の中に文字列は入れ子で生き残れない。
 * `List` の μ は任意なので、そちらは括弧が入れ子を作ってよい（`[1] ([2] [3])` は
 * `[1,[2,3]]` のままである）。
 */
function textAbsorb(l, r) {
  if (typeof l === "string" || typeof r === "string") return stringifyForConcat(l) + stringifyForConcat(r);
  return null;
}

/**
 * **括りが構造を作れるのは `List` だけである。**
 *
 * 余積は書かれ方で `construct` / `push` / `unshift` の3つのノードになる。括った側を
 * 1要素として足すのが `push`/`unshift` で、そこがテキストの吸収を通していなかったため、
 * 同じ値でも括ると答えが変わっていた——`` `a` `bc` `` は "abc"、`` `a` (`b` `c`) `` は
 * ["a","bc"]。**同じ値を代入しただけで結果が変わる**（参照透明が壊れる）。
 *
 * 括った側が `List` なら、そこは1要素である。`List` の μ は任意なので入れ子が生き残る
 * ——`` `abc` [1 2 3] `` は ["abc", [1,2,3]] であり、ブラケットが「これは器である」と
 * 宣言している（type_system.md 余積族の型変換テーブル）。
 *
 * 括った側が `String` なら、入れ子は生き残れない。**`String` の μ は強制**だからである
 * （原理7、`String ≅ List(Char)`）。だから括弧は評価順を決めるだけで、吸収は効く。
 */
function groupedAbsorb(l, r, groupedNode) {
  if (groupedNode && groupedNode.atomType === "List") return null;
  return textAbsorb(l, r);
}

function stringifyForConcat(v) {
  if (typeof v === "string") return v;
  if (isUnit(v)) return "";
  // List は要素を順に描画して連結する。`String([1,2,3])` が `"1,2,3"` になるのは
  // JS の Array.prototype.toString がカンマ区切りを挟むためで、Sign の意味論ではない
  // （`String ≅ List(0u)` である以上、リストのテキスト化は要素の描画の連結である）。
  // 左結合で1要素ずつ畳まれる `` `abc` 1 2 3 `` が "abc123" になるのと揃う——
  // 左辺が先に List へ確定している `1 2 3 \`abc\`` だけカンマが混ざるのは、
  // 同じ演算子が畳まれ方によって別の結果を出していたということである。
  if (Array.isArray(v)) return v.map(stringifyForConcat).join("");
  // **撒かれた並びも描画できる。** 後置 `~` は器を開いて中身を撒くので、`` `a` rest~ `` の
  // 右辺はイテレータで来る（`expand` が `makeWalk` を返す）。ここが並びを知らなかったので
  // `String(v)` へ落ち、`"a[object Object]"` になっていた——**`c rest~` という、仕様が
  // 「器を並べるならこう書け」と言っている形そのものが動いていなかった**。
  if (isIterator(v) || isSpread(v)) {
    const items = asList(deIterate(v));
    return items === null || isUnit(items) ? "" : stringifyForConcat(items);
  }
  return String(v);
}

// ---- $/@/#（アドレス操作） ----
// unit.md §0.4「$__、@__の挙動：UnitはすべてのUnitを吸収する」。
// アドレス値は { __address__:true, get, set } という参照セル（getter/setter）として表現する。
// get()で参照先を読み、set(v)で書き込む（`#`＝output、pattern_guide.mdの`$[array ' 0] # 3`）。
// 識別子・配列要素（get_prop）は実体（env/配列）への本物の参照（書き込みが反映される）、
// それ以外の式は評価結果のスナップショットを読み取り専用で包むだけ
// （新規に作った値自体はどこにも「格納」されていないため、書き込む先が無い）。
function makeAddress(getFn, setFn) {
  return { __address__: true, get: getFn, set: setFn || (() => {}) };
}

/**
 * **器の「残り」は覗き窓であって複製ではない。**
 *
 * `[~o]` / `[x ~xs]` のカッコは**参照を取る**という意味であり（C で `f(&x)` と書くのと
 * 同じ）、`l ' 1~` のスライスも同じ「残り」を別の書き方で取っているにすぎない。Pass 4 は
 * 元からそう出していた——`{ptr + k×幅, len - k}` で、同じ領域を指したまま頭と長さを
 * ずらすだけである（`emitDestructure`）。ところが解釈側は `slice()` で写していたので、
 * **同じプログラムが2つの意味を持っていた**：仮引数越しに書いた値が、機械では元へ届き、
 * 解釈では届かない。
 *
 * `Proxy` を使うと `Array.isArray` が真のまま添字と長さだけをずらせるので、既にある
 * 配列の扱い（`map`・スプレッド・`JSON`）は何も変えずに済む。読み書きはそのまま元の
 * 実体へ通る。
 *
 * 入れ子の窓は起点を足して1枚に畳む——窓の窓を作ると、辿る段が深さぶん増えるだけで
 * 得るものが無い。
 */
const VIEW_BASE = Symbol("viewBase");
const VIEW_FROM = Symbol("viewFrom");

function listView(base, from, to) {
  // 既に窓なら、元の実体まで降りて起点を足す。
  if (base && base[VIEW_BASE]) {
    from += base[VIEW_FROM];
    to += base[VIEW_FROM];
    base = base[VIEW_BASE];
  }
  const len = Math.max(0, Math.min(to, base.length) - from);
  const idx = (p) => (typeof p === "string" && /^\d+$/.test(p) ? Number(p) : null);
  return new Proxy(base, {
    get(t, p, r) {
      if (p === VIEW_BASE) return t;
      if (p === VIEW_FROM) return from;
      if (p === "length") return len;
      const i = idx(p);
      if (i !== null) return i < len ? t[i + from] : undefined;
      return Reflect.get(t, p, r);
    },
    set(t, p, v, r) {
      const i = idx(p);
      if (i !== null) {
        if (i < len) t[i + from] = v;
        return true;
      }
      return Reflect.set(t, p, v, r);
    },
    has(t, p) {
      const i = idx(p);
      if (i !== null) return i < len;
      return Reflect.has(t, p);
    },
    ownKeys(t) {
      return [...Array.from({ length: len }, (_, i) => String(i)), "length"];
    },
    getOwnPropertyDescriptor(t, p) {
      const i = idx(p);
      if (i !== null) return i < len ? { value: t[i + from], writable: true, enumerable: true, configurable: true } : undefined;
      if (p === "length") return { value: len, writable: true, enumerable: false, configurable: false };
      return Reflect.getOwnPropertyDescriptor(t, p);
    },
  });
}

// pass2.jsのunwrapSoloBlockと同じロジック（循環import回避のためここで別途最小実装）。
// `$[expr]`のようにブラケット/括弧で1個の式を囲んだだけの中身を覗く。
function unwrapParenNode(node) {
  while (node && node.type === "block" && node.kind !== "indent" && node.kind !== "abs" && node.kind !== "norm" && node.lines.length === 1) {
    node = node.lines[0];
  }
  return node;
}

// `$operand`（前置address）を、operandの構文形に応じた参照セルへ解決する。
function evalAddress(operandNode, env) {
  const inner = unwrapParenNode(operandNode);
  if (inner.type === "atom" && inner.kind === "identifier") {
    // $x: xが束縛されているスコープを辿り、そのバインディングへの本物の参照を作る
    // （代入すればxそのものが書き変わる）。未束縛ならUnit（アドレスの取りようが無い）。
    const name = inner.value;
    let e = env;
    while (e && !e.bindings.has(name)) e = e.parent;
    if (!e) return UNIT;
    return makeAddress(() => e.bindings.get(name), (v) => e.bindings.set(name, v));
  }
  if (inner.type === "operation" && inner.name === "get_prop") {
    // $[list ' idx]: リスト要素への本物の参照（list_cheat_sheet.mdのget_prop対象）。
    const l = evaluate(inner.left, env);
    const idx = evaluate(inner.right, env);
    if (!Array.isArray(l) || typeof idx !== "number" || idx < 0 || idx >= l.length) return UNIT;
    return makeAddress(() => l[idx], (v) => { l[idx] = v; });
  }
  // それ以外（リテラル・式・ラムダ式など、その場で作った値）。
  //
  // **`$匿名式` は「その場で生成されたオブジェクト本体のアドレス」である**——演算子表が
  // C++ の `&(new [](x){x})` に相当すると書いている通り、`new` であって覗き窓ではない。
  // 読み取り専用のスナップショットにしていたので `($式) # 値` が黙って効かなかった。
  // 機械の側は `sub sp` で場所を取って書けるので、そこと食い違っていた。
  //
  // カリー化の手動形（`f : x ? $[y ? ...]`）もここを通るが、書き込みが意味を持たない
  // だけで、持てないわけではない。
  let cell = evaluate(inner, env);
  // **単位元を置いた場所は場所ではない（$__ = __）。** @__ = __ と対であり、
  // $__ = __ = @__ が不動点になる。ここが場所を返していたので、機械（__ を返す）と
  // 食い違っていた。
  //
  // **名前や要素への $ は別である。** $x や $[l ~ i] は「いま何が入っているか」に
  // 関係なく実在する場所を指しており、書けば元が変わる。ここは new の側——置くものが
  // 無ければ場所も無い。
  //
  // **型の側の持ち上げ（Scalar ⇒ [Scalar, __]）はこの不動点を足場にしている。**
  if (isUnit(cell)) return UNIT;
  return makeAddress(
    () => cell,
    (v) => {
      cell = v;
    },
  );
}

function evaluate(node, env) {
  if (!node || typeof node !== "object") return UNIT;

  if (node.type === "atom") {
    if (node.kind === "identifier") return envGet(env, node.value);
    return evalLiteral(node);
  }

  if (node.type === "block") {
    // 空ブロック（`[]`/`{}`/`()`）は空リスト。unit.md「`__ = []`（空リストと等価）」の
    // 通りUnitと同型（isUnit([])が真）なので、Unit判定を要求する箇所ではそのまま
    // Unitとして振る舞いつつ、`|[]|`が0になる等の「リストとしての」性質も保てる。
    if (node.kind !== "abs" && node.kind !== "norm" && node.lines.length === 0) return [];
    // |list|（abs）: list_cheat_sheet.md「要素数の取得」。ブロックとしては通常通り解決される
    // （中身を逐次評価、最後の文の値）が、kind==='abs'の場合だけ絶対値/要素数へ変換する
    // ——List/StringならJSの.length、数値ならMath.abs（"absolute"の名の通り、リストの
    // 要素数と数値の絶対値を同じ記号で表す設計、list_cheat_sheet.mdの命名）。
    // ノルム（`~|...|~`）は**常に数え上げ**である。絶対値と分けるのは、1要素の器が
    // 存在しないからで（`[5] ≅ 5`）、同じ記号だと長さ1で意味が変わってしまう
    // ——`count : xs ? |xs|` が `[7]` に対して 7 を返していた。
    if (node.kind === "norm") {
      let inner = UNIT;
      for (const line of node.lines) inner = evaluate(line, env);
      // 空は 0 要素である（`__ = []`）。不在も空も、数えれば 0 になる。
      if (isUnit(inner)) return 0;
      // 無限は数えられない——「無限の要素数」という値は無いので零射へ落ちる。
      if (isIterator(inner)) return iteratorCount(inner);
      if (Array.isArray(inner) || typeof inner === "string") return inner.length;
      if (isNamedSlots(inner)) return Object.keys(inner).length;

      // **スカラーは1要素の器である。** 射（Lambda）は器ではないので零射。
      if (inner !== null && typeof inner === "object") return UNIT;
      return 1;
    }
    if (node.kind === "abs") {
      let inner = UNIT;
      for (const line of node.lines) inner = evaluate(line, env);
      // Unitのときだけ値では決まらない——`__ = []`（unit.md）の同一視により「空リスト
      // ＝要素数0」とも「値の不在」とも読めるため、pass3が記録したオペランド型で決める。
      // List/Stringの位置なら空コレクションなので0、それ以外（不在・型不明）は吸収元。
      // 型が付かない側を0に倒さないのは、不在がもっともらしい値に化けるのを防ぐため
      // ——「不在」と「うっかり使える値」を混ぜないという一点が、null参照の失敗の核心
      // だったので、Signは常に吸収元側へ倒す（narrowingは呼び出し側が明示的に行う）。
      if (isUnit(inner)) {
        const operand = node.operandType;
        return operand === "List" || operand === "String" ? 0 : UNIT;
      }
      // イテレータは有限なら要素数を持つ。**無限は数えられない**ので零射へ落ちる
      // ——「無限の要素数」という値は無い。
      if (isIterator(inner)) return iteratorCount(inner);
      if (Array.isArray(inner) || typeof inner === "string") return inner.length;
      // 名前付きスロットもスロット数を持つ。名前・連番・実データの三つを持つ以上、
      // 連番の個数＝スロット数は定義されている。連番で引ける（`point ' 0`）のに
      // 個数が取れないと、走査する手段が無くなってしまう。
      if (isNamedSlots(inner)) return Object.keys(inner).length;
      // Lambda（Id射・クロージャ等）には要素数/絶対値が定義されていない——
      // Math.absへ渡すとNaNが静かに出るため、型エラーとして__へ収束させる。
      if (inner !== null && typeof inner === "object") return UNIT;
      return Math.abs(inner);
    }
    // 構造体判定はpass3.jsのinferAtomTypeと同じ基準（全行がdefineかつ左辺が識別子）。
    // 左辺が識別子でないdefine行（下記match_case）と区別するため、identifierNode
    // 判定も併せて要求する——さもないと「フォールバック行の無いmatch_case連鎖」
    // （全行がcond:result）がStruct扱いされてしまう。構造体は独立したスコープで評価し、
    // キーが呼び出し元のenvへ漏れないようにする（let*的に、後のキーのデフォルト式的な
    // 参照は前のキーを見られる）。
    // 関数本体は構造体にならない。構造体を返したいならカッコで囲む
    // （`f : x y ? [ / a : x / b : y / ]`）——境界はカッコである。
    if (isStructBlock(node)) {
      const structEnv = newRuntimeEnv(env);
      const dict = {};
      for (const line of node.lines) {
        // **撒く行**（`this~`）: 名前付きスロットをそのまま溶かし込む。分解で取り出した
        // 残りを組み直しへ戻す道であり、`[a : … / b : … / this~]` が set にあたる。
        //
        // **鍵が重なったら上書きである。** 名前はコンパイル時に固定オフセットへ解決され、
        // フィールドへの書き込みはその場所への store でしかない（function_guide.md
        // 「名前はコンパイル時にオフセットへ解決され、Pass 4 には残らない」）。同じ場所へ
        // 2度書けば後の方が残る、というだけのことなので、行の順序がそのまま優先順位になる。
        // 書いた行を残したいなら撒くのを先に置く（`[this~ / a : …]`）。
        if (isStructSpreadLine(line)) {
          const spread = observe(evaluate(line.operand, structEnv));
          if (isNamedSlots(spread)) Object.assign(dict, spread);
          continue;
        }
        if (isIdentifierNode(line)) {
          // 省略記法（`[x / y]`）: フィールド名も値もその識別子から取る。
          // 値は外側のenvに既にある束縛（仮引数など）を読む。
          const name = line.value.slice(1, -1);
          const value = evaluate(line, structEnv);
          envDefine(structEnv, line.value, value);
          dict[name] = value;
          continue;
        }
        const value = evaluate(line, structEnv); // define評価：structEnvに束縛しつつ値を返す
        dict[line.left.value.slice(1, -1)] = value; // "<foo>" -> "foo" / "`+`" -> "+"
      }
      return dict;
    }
    // 通常のブロックの逐次評価（match_case含む）。evalIndentBlock参照——末尾呼び出し
    // 検出（evaluateTail）と評価ロジックを共有するため、ここではevaluateを
    // 「ブロックの最終結果をどう評価するか」のコールバックとして渡す（通常のevaluate()
    // から呼ぶ限りは以前と全く同じ挙動）。
    return evalIndentBlock(node, env, evaluate);
  }

  if (node.type === "operation") {
    // ポイントフリー記述（`[+]`/`[+ 1]`等、pass2.jsが作るpartialな中置演算ノード）は
    // 値として評価される場面では即座に演算しようとせず、クロージャ値として返す
    // （下のARITH_OPS/COMPARE_OPS分岐に落ちるとnode.left===nullをUnit扱いして
    // 誤った結果になるため、switch/算術分岐より前でここで捕捉する）。
    if (node.partial) return makePointfreeClosure(node, env);
    switch (node.name) {
      case "define": {
        const value = node.right.name === "lambda" ? makeClosure(node.right.left, node.right.right, env) : evaluate(node.right, env);
        envDefine(env, node.left.value, value);
        return value;
      }
      case "lambda":
        return makeClosure(node.left, node.right, env);
      case "apply": {
        const { calleeNode, argNodes } = collectApplyChain(node);
        const callee = evaluate(calleeNode, env);
        // 後置~（expand）で渡された引数は、1個のList値としてではなく複数の位置引数へ
        // 展開する（pattern_guide.md「関数にListを渡すときは必ず後置~を使う」「後置~を
        // 使ったときに、それぞれの引数リストに分配して渡される」）。これが無いと
        // 裸のrestパラメータでの再帰（xs~の展開）が終端せず無限再帰する。
        const argValues = [];
        for (const a of argNodes) {
          argValues.push(...evalArgValues(a, env));
        }
        return applyClosure(callee, argValues);
      }
      case "partial_apply": {
        // 自動カリー化。pass2.jsが「既知のアリティに対して引数の個数が足りない」と
        // 静的に判定済みのapplyチェーン——ここでは完全性公理による崩壊(bindParams経由の
        // 通常のapplyClosure)を一切通さず、無条件に部分適用クロージャを構築する。
        // collectApplyChainは"apply"という名前だけを見てチェーンを遡るため使えない
        // （pass2は連鎖の最も外側だけを"partial_apply"へリネームする——自分自身をそのまま
        // 渡すと無限再帰する）。最初の1段（自分自身）だけ別扱いし、以降は通常の"apply"
        // チェーンとして遡る。
        const argNodes = [node.right];
        let n = node.left;
        while (n && n.type === "operation" && n.name === "apply") {
          argNodes.unshift(n.right);
          n = n.left;
        }
        const calleeNode = n;
        const callee = evaluate(calleeNode, env);
        const argValues = [];
        for (const a of argNodes) {
          argValues.push(...evalArgValues(a, env));
        }
        if (!callee || !callee.__lambda__ || callee.__compose__ || callee.__pointfree__) {
          // pass2の静的判定は素のLambda識別子のみを対象にしているため通常来ないはずだが、
          // 想定外の形なら安全側の通常apply経路へフォールバックする。
          return applyClosure(callee, argValues);
        }
        return makePartialClosure(callee, argValues);
      }
      // `apply_reverse` の専用ケースは無い。`x f`（UFCS的なreceiver記法、
      // coproduct_resolver.md §3の10.3）は pass2 が通常の `apply`（`f x`）へ
      // 展開する糖衣であり、ここへは apply として届く。専用ノードだった頃は
      // TCO も静的な部分適用の印付けも届かず、`(n - 1) down` がスタックを溢れさせ、
      // `(5 add) 3` が 8 ではなく 3 を返していた。
      case "compose": {
        const f = evaluate(node.left, env);
        const g = evaluate(node.right, env);
        return makeComposed(f, g);
      }
      case "and": {
        // §3.3・AGENTS.md: 短絡評価。左辺がUnitなら右辺を評価せず即座にUnit。
        const l = evaluate(node.left, env);
        if (isUnit(l)) return UNIT;
        return evaluate(node.right, env);
      }
      case "or": {
        // 短絡評価: 左辺がUnitでなければ右辺を評価せず左辺を返す。
        const l = evaluate(node.left, env);
        if (!isUnit(l)) return l;
        return evaluate(node.right, env);
      }
      case "xor": {
        const l = evaluate(node.left, env);
        const r = evaluate(node.right, env);
        if (isUnit(l)) return r;
        if (isUnit(r)) return l;
        return UNIT;
      }
      case "construct":
      case "concat": {
        const cl = evaluate(node.left, env);
        const cr = evaluate(node.right, env);
        return constructValues(node, cl, cr);
      }
      // list_cheat_sheet.md「先頭/末尾に要素追加」（10.1、pass2.jsのcoproductReduce参照）。
      // pass2.js側の命名はJS配列メソッドのpush/unshiftとは意味が逆——push(a,b)はb側が
      // List（右がList~）で「aを先頭へ」、unshift(a,b)はa側がList（左がList~）で
      // 「bを末尾へ」（pass2.js冒頭コメント「優先度10.1の具体的な演算子名」参照、
      // 仕様は方向性を明記していないため実装時に決めた仮定）。
      // **`push` は Pass 2 が作らなくなった**（余積の向きは常に「左辺が器」で足りる）。
      // 外から与えられた AST を評価する経路のために残してある。
      case "push": {
        // 0 [1 2 3] → [0 1 2 3]（aを先頭に追加）。aがUnit（単位元）なら素通しでbのみ返す。
        // **`~` が付いていれば撒く**——判定は値であって構文ではない。
        const rawA = evaluate(node.left, env);
        const b = deIterate(evaluate(node.right, env));
        if (isUnit(rawA)) return asList(b);
        {
          const t = groupedAbsorb(rawA, b, node.left);
          if (t !== null) return t;
        }
        return [...(isSpread(rawA) ? asList(deIterate(rawA)) : [rawA]), ...asList(b)];
      }
      case "unshift": {
        // [1 2 3] 4 → [1 2 3 4]（bを末尾に追加）。bがUnit（単位元）なら素通しでaのみ返す。
        const rawB = evaluate(node.right, env);
        const a = deIterate(evaluate(node.left, env));
        // 余積の単位元則（type_system.md §6.1）。**器の側が `__` なら右辺がそのまま通る**
        // ——`__ [1 2 3]` は `[1 2 3]` であって `[[1 2 3]]` ではない。`construct` 側と
        // 同じ規則であり、片側にしか無いと `__` が「器を1つ被せる」ことになる。
        //
        // **単位元かどうかは実体化する前に見る。** 終端の無い規則を実体化すると `__` に
        // なるが、それは「規則が単位元だ」という意味ではない——`[1 2] [0 ~+ 1]` は
        // カウンタを1個持つリストであって、カウンタが消えるわけではない。
        if (isUnit(a)) return rawB;
        if (isUnit(rawB)) return asList(a);
        {
          const t = groupedAbsorb(a, rawB, node.right);
          if (t !== null) return t;
        }
        // 右辺が `~` 付きなら撒く。無ければ**1要素として**足す（§2.2 の表）。
        return [...asList(a), ...(isSpread(rawB) ? asList(deIterate(rawB)) : [rawB])];
      }
      // list_model.md §2.3「派生演算子による範囲リストの構築」。**レンジ式の実体は
      // 常にイテレータである**——`{start, step, end}` の固定サイズ構造体であり、
      // 終端の有無は「数え上げられるか」を分けるだけで、実体の種類は変えない。
      //
      // 項数が宣言するのは**消費**（いつ走るか）であって**展開**（並べて置くこと）では
      // ない。走査は O(1) メモリで済み、展開が要るのは同時アクセスを宣言した消費側
      // （`[x ~xs]` ＝ `Implicit(List(T))`、type_system.md §2）と観測境界（observe）だけ。
      case "range": {
        // 3項形式 [start ~op step ~ end]（node.leftが5種の派生演算子いずれかのノード。
        // list_model.md §2.3: ~+/~-/~*/~/~^、rangeStepFnが全種のstep関数を持つ）と、
        // 単純形式 [start ~ end]（step省略、昇順なら+1・降順なら-1）の両方を扱う。
        // 演算子表（operator_table.md）: `~` は両辺とも零射。左辺が Unit なら結果が
        // `__` に確定するため、継続の規則に従い右辺を評価しない。
        const isStepForm =
          node.left && node.left.type === "operation" && RANGE_ARITHMETIC_NAMES.has(node.left.name);
        const start = evaluate(isStepForm ? node.left.left : node.left, env);
        if (isUnit(start)) return UNIT;
        const step = isStepForm ? evaluate(node.left.right, env) : null;
        const end = evaluate(node.right, env);
        if (isUnit(end)) return UNIT;
        // step 形式は数値のみ（文字への等差・等比は意味が決まっていない）。
        // 単純形式は数値または1文字。点でなければ射が無い＝零射なので `__`。
        if (!isRangePoint(start, !isStepForm) || !isRangePoint(end, !isStepForm)) return UNIT;
        // **終端があってもイテレータである**（list_model.md §2.3 の IMPORTANT）。
        // 3項形式が宣言しているのは「いつ消費するか」であって「並べて置け」ではない。
        // 消費（走査）は O(1) メモリで済み、展開が要るのは同時アクセスを宣言した
        // 消費側（`[x ~xs]` ＝ `Implicit(List(T))`）だけである（type_system.md §2）。
        if (isStepForm) {
          const op = node.left.op;
          // 等差だけ歩幅を残す——規則が一次なら `|.|` が割り算1回で答えられる。
          const affine = op === "+" ? step : op === "-" ? -step : null;
          return makeIterator(start, rangeStepFn(op, step), end, affine);
        }
        // 文字の範囲だけは String になる（String ≅ List(0u)）。文字列は Sign では
        // 実体を持つ値であり、規則ではない。
        const charRange = buildCharRange(start, end);
        if (charRange !== null) return charRange;
        const delta = start <= end ? 1 : -1;
        return makeIterator(start, (v) => v + delta, end, delta);
      }
      case "range_arithmetic":
      case "range_arithmetic_rev":
      case "range_geometric":
      case "range_geometric_rev":
      case "range_power": {
        // 2項形式 [start ~op step]（終端なし、5種いずれも）は**無限の Pull 型ストリーム**
        // そのものである（list_model.md §2.3「2項指定」）。3項形式との違いは終端を持つか
        // どうかだけで、どちらも同じイテレータである。
        // （3項形式 [start ~op step ~ end] は上の"range"ケースが処理する——このケースに
        // 来るのは、外側に終端"~ end"が付いていない生の2項ノードのみ。）
        // 実体化できないことは扱えないことではない——添字で引けるので、stack_abi.md §3.3 の
        // ループカウンタ（`c : [0 ~+ 1]`）が成立する。
        const itStart = evaluate(node.left, env);
        if (isUnit(itStart)) return UNIT;
        const itStep = evaluate(node.right, env);
        if (isUnit(itStep)) return UNIT;
        if (!isRangePoint(itStart, false) || !isRangePoint(itStep, false)) return UNIT;
        return makeIterator(itStart, rangeStepFn(node.op, itStep), null);
      }
      case "product": {
        // list_model.md §2.1: `1,2,3,4,5`（スカラーのカンマ連鎖）は`1 2 3 4 5`と等価な
        // フラットリストだが、§(n次元配列の構築)の`1 2 3 , 4 5 6`は[[1,2,3],[4,5,6]]という
        // 入れ子。`,`は左結合（product[product[1,2],3]の形）で連鎖するため、左辺自身が
        // 同じproductノード（＝連鎖の続き）の場合だけ展開して連結し、そうでない場合
        // （スペースで構築された塊やリテラル単体が左辺の場合）は互いに対等な要素として
        // 2要素のリストにする。
        const rawL = evaluate(node.left, env);
        const rawR = evaluate(node.right, env);
        // **後置 `~` は積にも効く**（余積との双対）。
        //
        // 余積は「右辺を1要素として足すか、展開して繋ぐか」を `~` で選ぶ（10.1/10.2）。
        // 積にも同じ選択がある——**スロットを1つ足すか、相手のスロットを並べるか**である。
        // ところが積は `~` を見ておらず、構文上の連鎖（右辺が `,` のノード）でしか
        // 平坦化できなかった。
        //
        // **構文だけでは再帰を跨げない。** `x , (f …)` の右辺は呼び出しであって `,` の
        // ノードではないので、値としては積で作られた列なのに1スロットとして積まれる
        // ——lexer.sn のトークン列が `["foo",["123",…]]` と段の深い `Struct` になり、
        // 大きさが静的に決まらなくなっていた。`~` は値を見るので、そこを跨げる。
        //
        // 消費されない `~` は観測に漏れる（イテレータがそのまま値に出る）ので、受ける
        // 側が無いこと自体が穴だった。
        // **左辺の `~` も同じだけ効く。** 撒くかどうかは向きに依らない——`a~ , x` は
        // 「a の要素たちを並べて、その後ろに x を1つ」である。ここを右辺でしか見て
        // いなかったので、左から積む書き方（`acc~ , 新しい要素`）だけが入れ子になって
        // いた。左右で意味が違う理由は仕様の側に無く、**規則が片側にしか書かれて**
        // いなかっただけである。
        const spreadL = isSpread(rawL);
        const l = deIterate(rawL);
        const spreadR = isSpread(rawR);
        const r = deIterate(rawR);
        // **連鎖は右へ伸びる**（`,` は右結合、operator_table.md 9行目）。
        // `1 , 2 , 3` は `1 , (2 , 3)` なので、内側の並びの先頭へ足すと平坦になる。
        // 明示の器（`1 , [2 3]`）は連鎖ではないので要素1つとして残る——
        // `1 2 3 , 4 5 6` が `[[1,2,3],[4,5,6]]` であるための条件でもある。
        const isChain = node.right && node.right.type === "operation" && node.right.name === "product";
        const items = [...(spreadL ? asList(l) : [l]), ...(isChain || spreadR ? asList(r) : [r])];
        // `,` の単位元は `__` である。零対象は終対象でもあるため直積では `A × __ ≅ A` が
        // 成り立つ——スロットは生まれない。余積（空白）が連接の単位元として `__` を落とすのと
        // 同じ理屈が、直積では終対象としての性質から出てくる。
        //
return items.filter((v) => !isUnit(v));
      }
      case "get_prop":
        return getPropValue(evaluate(node.left, env), node.right, env);
      case "address":
        // 前置$。node.operandはまだ評価せず、その構文形（識別子/get_prop/その他）に
        // 応じてevalAddressが参照セルを組み立てる（evalUnaryOpの「先に評価済みの値を
        // 受け取る」経路には乗せられない——参照先の束縛そのものが必要なため）。
        return evalAddress(node.operand, env);
      case "output": {
        // `addr # value`（中置#、pattern_guide.mdの`$[array ' 0] # 3`）。
        //
        // **守るのは左辺である。** 演算子表の Unit 欄は「左辺がUnit」「右辺がUnit」に
        // 分かれており、危険なのは前者——`$__ # expr` と `$(0x80 < 0x40) # expr` は
        // 「**致命的なエラー（不正なアドレスへの書き込み）**」と guide の演算子表が名指し
        // している。書き込み先を持たない左辺へは書かず、`__` を返す。
        //
        // **右辺の `__` は書ける。** `__` を書けないと**場所を空にできない**——ストリームが
        // 尽きたときにカーソルへ「もう無い」を書き込めず、次の読み出しが古い値を返す。
        // `$__ = __ = @__` が不動点である以上、`__` は書いて読み戻せる値である。
        //
        // **返すのはアドレスである**（同表「アドレスにデータを入れ、成功したらアドレスを
        // 返す」）。値を返すと「書けたが値が `__`」と「書けなかった」が区別できず、
        // 連鎖（`$buf # a # b`）もできない。
        const addr = evaluate(node.left, env);
        const value = evaluate(node.right, env);
        if (!addr || !addr.__address__) return UNIT;
        addr.set(value);
        return addr;
      }
    }

    // 三項連鎖比較（comparison.md §4、pass2.jsが単一ノードへまとめたもの）。
    // 隣接ペアが全て真なら「無条件で中央の項」を返し、ひとつでも偽なら即座にUnit。
    // 二項比較の§2.1「左辺が算術単位元(0/1)なら右辺」は連鎖には適用しない——
    // §4はまさにその規則に依存せず中央を取り出すための仕組みとして定義されている。
    if (node.name === "chain_compare") {
      // 連鎖も二項と同じ継続の規則に従う——零射へ落ちた時点で結果が `__` に確定するため、
      // それより右の項を評価しない。連鎖できるのは推移的な比較（`<` `<=` `=` `>=` `>`）
      // だけであり、どれも左辺Unitで零射になるため例外は無い。推移的でない `!=` は
      // pass2.js が連鎖として組み立てず構文エラーにするので、ここへは来ない。
      const l = evaluate(node.left, env);
      if (isUnit(l)) return UNIT;
      const c = evaluate(node.middle, env);
      if (isUnit(c)) return UNIT;
      const r = evaluate(node.right, env);
      if (isUnit(r)) return UNIT; // 比較演算子の吸収則（§3.3）
      return COMPARE_OPS[node.compareName](l, c) && COMPARE_OPS[node.compareName](c, r) ? c : UNIT;
    }

    if (ARITH_OPS[node.name]) return evalArith(node, env);
    if (BIT_OPS[node.name]) return evalBit(node, env);
    // `!=`（tier12、name="not_equal"）・`==`（name="equal"）・`!==`（tier8、name="xnot_equal"、
    // ==の構造比較を否定したもの）はCOMPARE_OPSにキーを持たない——8/6にoperator_table.js側の
    // tier8`!==`をname="xnot_equal"へ改名して名前衝突自体は解消したが、COMPARE_OPS
    // （evalCompareの汎用フォールバックが呼ぶテーブル）には元々not_equal/equal/xnot_equalを
    // 追加していない。evalCompareは既にop==="!="/"=="/"!=="それぞれの専用分岐を持っている
    // ため、ここでnode.opを見て個別に通す。`===`（same、同一性）はコンストラクタ由来の
    // 追跡（type_system.md §6.2の`' !__`）が必要な別機能のため、まだ未対応のまま。
    if (COMPARE_OPS[node.name] || node.op === "!=" || node.op === "==" || node.op === "!==")
      return evalCompare(node, env);

    if (node.position === "prefix" || node.position === "postfix") {
      return evalUnaryOp(node.name, evaluate(node.operand, env));
    }

    // 未対応の演算（$/@/#等）
    throw new Error(`interpreter: 未対応の演算 '${node.name}'`);
  }

  return UNIT;
}

/**
 * **観測境界**。値が Sign の外——表示・受け渡し——へ出るときに呼ぶ。
 *
 * ホストは「全部を同時に見る」ことしかできないので、これは type_system.md §2 の
 * `Implicit`（同時アクセス）側の消費者である。展開が起きてよい場所がここしか無い、
 * というのが `Iterator` を実体にした狙いそのものである。無限は観測できないので `__`。
 */
function observe(v) {
  v = collapseText(v);
  // 中に入れ子になった規則も実体化する。**観測の話であって値の話ではない**
  // ——`[1 2] [1 ~ 3]` の値は「カウンタを1個持つリスト」であり、それを見せるときに
  // 有限の規則は要素の並びとして描かれる（`String ≅ List` を描画側で保つのと同じ）。
  if (Array.isArray(v)) return v.map(observe);
  const d = deIterate(v);
  // **1要素はスカラーである**（`[5]` は `Int`、list_model.md）。実体化した規則にも同じ
  // 規則が効く——`1 ~ 1` や `st~`（`st` が底の1要素だけ）が `[x]` のまま残っていると、
  // 同じ値が作られ方によって器になったりスカラーになったりする。`collapseSlice` が
  // スライスに対してやっているのと同じ潰しである。
  return isIterator(v) && Array.isArray(d) ? collapseSlice(d) : d;
}

export { evaluate, newRuntimeEnv, envDefine, envGet, UNIT, isUnit, observe };
