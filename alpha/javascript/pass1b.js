/**
 * Pass1b（`@ref`のジェネリック仮引数の具体化、type_system.md §5 Pass 1b）
 *
 * `f : ref ? @ref 1 2 3` のようなジェネリックな仮引数（参照先が Lambda か Atom かが
 * 定義サイト単体では決まらないもの）は、Pass1a の単一線形スキャンだけでは解決できない。
 * §5はこれを「呼び出しグラフに対する処理」として、実際の呼び出しサイトの実引数カテゴリを
 * 集めて具体化する、と定義している。
 *
 * 【現状の実装範囲】呼び出しサイトの収集は、compiler_pipeline.md §6 が定義する
 * 「debugビルドで`test`フォルダを実行して得るトレース」ではなく、**`src`（プログラム全体の
 * 解決済みAST）に対する静的走査**のみで行う（テストフォルダを実行するインタプリタ自体が
 * まだ存在しないため）。
 *
 * export印（`#`/`##`/`###`）が付いたジェネリック関数に呼び出しサイトが1つも無い場合は
 * コンパイルエラーとする（§5・compiler_pipeline.md §6.3「呼び出しサイトの無いexportは
 * コンパイルエラー」）。exportされていない場合は、単純にデッドコードとして空の結果を返す
 * （§5「呼び出しサイトの無いジェネリック関数はexportされていなければdiscard」）。
 *
 * 【既知の制限】
 * - 相互再帰するジェネリック関数同士の具体化（§5 Pass1bの「本節は将来の検討事項」）は未対応。
 *
 * 【8/6修正】以前は「引数が複数あるLambdaへの呼び出しサイトのうち、ジェネリック仮引数以外の
 * 位置の対応付けは未対応（単一引数の関数、または最初の引数のみを想定）」という制限があった。
 * `collectCallsites`が`apply[fnName, arg]`という単一階層のみを見ており、多引数関数の呼び出し
 * （`f 3 5` → `apply[apply[f,3],5]`というapply連鎖、pass2.js/interpreter.jsのapplyChainInfoと
 * 同じ形）では、内側の`apply[f,3]`にしか`isIdentifierAtom(node.left,fnName)`がマッチせず、
 * 常に**最初の引数だけ**が呼び出しサイトの実引数として拾われていた——ジェネリック仮引数が
 * 2番目以降の位置にある場合、正しい実引数カテゴリが一度も収集されなかった。
 * `collectCallsites`をapply連鎖の根本まで遡ってから判定するよう修正し、各サイトを
 * 「位置ごとの実引数ノード配列」として返すようにした上で、`specializeGenericParams`が
 * ジェネリック仮引数の宣言順の位置（`paramNamesOf`のindex）で対応する実引数を選ぶように
 * 修正（`test/pass1b.test.js`で確認）。
 */

import { getCategory } from './pass2.js';

function isIdentifierAtom(node, name) {
  return !!node && node.type === "atom" && node.kind === "identifier" && (name === undefined || node.value === name);
}

// lambdaのparamsノード（identifier単体 or params[]）から仮引数名の集合を取り出す。
// pass3.jsのparamNamesOfと同じロジック（循環import回避のためここで別途最小実装）。
function paramNamesOf(paramNode) {
  if (!paramNode) return [];
  if (paramNode.type === "atom" && paramNode.kind === "identifier") return [paramNode.value];
  if (paramNode.type === "params") return paramNode.entries.map((e) => e.name);
  return [];
}

// このファイルの2つの走査（detectGenericParams / collectCallsites）が見る「子」。
// pass3.js の childrenOf よりわざと狭い——`middle` と entries[].default を外してある。
// 広げると両方の走査が見るノードが増え、`@`の検出と呼び出しサイトの数が変わる。
function subNodes(n) {
  return [n.left, n.right, n.operand, ...(n.type === "block" && Array.isArray(n.lines) ? n.lines : [])];
}

// 本体（bodyNode）を走査し、`@`前置演算子が直接かかっている仮引数名の集合を返す。
// これらは「参照先がLambdaかAtomか定義サイト単体では決まらない」ジェネリックな仮引数
// （type_system.md §3.5, §5 Pass1b）とみなす。
function detectGenericParams(bodyNode, paramNames) {
  const generic = new Set();

  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "operation" && node.position === "prefix" && node.op === "@") {
      const operand = node.operand;
      if (operand && paramNames.has(operand.value) && isIdentifierAtom(operand)) {
        generic.add(operand.value);
      }
    }
    subNodes(node).forEach(visit);
  }

  visit(bodyNode);
  return generic;
}

// apply[apply[apply[f, a1], a2], a3] のような左結合のapplyチェーンを根本まで遡り、
// 呼び出し先ノード（calleeNode）と、位置順の実引数ノード配列（argNodes）を返す。
// pass2.jsのapplyChainInfo/interpreter.jsのcollectApplyChainと同じロジック
// （循環import回避のためここで別途最小実装）。
function collectApplyChain(node) {
  const argNodes = [];
  let n = node;
  while (n && n.type === "operation" && n.name === "apply") {
    argNodes.unshift(n.right);
    n = n.left;
  }
  return { calleeNode: n, argNodes };
}

// resolvedNodes（Pass2で解決済みのASTの並び、プログラム全体）を走査し、`fnName`という
// 名前の関数へのapply連鎖の呼び出しサイトを全て集めて、各サイトの「位置順の実引数ノード
// 配列」を返す（多引数呼び出し `f 3 5` → apply[apply[f,3],5] のチェーンも正しく遡る）。
function collectCallsites(resolvedNodes, fnName) {
  const sites = [];

  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "operation" && node.name === "apply") {
      const { calleeNode, argNodes } = collectApplyChain(node);
      if (isIdentifierAtom(calleeNode, fnName)) {
        sites.push(argNodes);
        // チェーン全体を1サイトとして数えたので、内側のapply（例: apply[f,3]）を
        // 別の呼び出しサイトとして二重に走査しないよう、ここで打ち切る。
        // ただし引数ノードの中に別の呼び出しサイトが含まれる可能性はあるため、
        // 引数それぞれは個別に再帰する。
        argNodes.forEach(visit);
        return;
      }
    }
    subNodes(node).forEach(visit);
  }

  for (const n of resolvedNodes) visit(n);
  return sites;
}

// defineNode（{type:"operation", name:"define", left: identifier(fnName), right: lambdaNode}）と、
// プログラム全体の解決済みノード列を受け取り、各ジェネリック仮引数について
// { paramName -> { callsiteCount, categories } } を返す。
// categories は呼び出しサイトで実際に観測された実引数のカテゴリ（Lambda/Atom）の集合。
function specializeGenericParams(defineNode, resolvedNodes, env) {
  const result = new Map();
  if (!defineNode || defineNode.name !== "define") return result;

  const fnName = defineNode.left && defineNode.left.value;
  const lambdaNode = defineNode.right;
  if (!fnName || !lambdaNode || lambdaNode.name !== "lambda") return result;

  const paramNameList = paramNamesOf(lambdaNode.left); // 宣言順（位置対応に使う）
  const paramNameSet = new Set(paramNameList);
  const genericParams = detectGenericParams(lambdaNode.right, paramNameSet);
  if (genericParams.size === 0) return result;

  const sites = collectCallsites(resolvedNodes, fnName); // Array<位置順の実引数ノード配列>

  if (sites.length === 0 && defineNode.exported) {
    // §5・compiler_pipeline.md §6.3: exportされているのに呼び出しサイトが無い
    // ジェネリック関数は具体化しようがないため、コンパイルエラーとする。
    throw new TypeError(
      `'${fnName}'（${defineNode.exported} export）はジェネリックな仮引数を持つが、呼び出しサイトが1つも見つからないため具体化できません`
    );
  }

  for (const paramName of genericParams) {
    // ジェネリック仮引数の宣言順の位置に対応する実引数だけを、各呼び出しサイトから選ぶ
    // （8/6修正：以前は位置を区別せず全サイトの「最初の引数」だけを見ていた）。
    const position = paramNameList.indexOf(paramName);
    const categories = [
      ...new Set(
        sites
          .filter((argNodes) => position < argNodes.length)
          .map((argNodes) => getCategory(argNodes[position], env))
      ),
    ];
    result.set(paramName, { callsiteCount: sites.length, categories });
  }
  return result;
}

export { detectGenericParams, collectCallsites, specializeGenericParams };
