import SignSem.Lex
import SignSem.Peg
import SignSem.Tree

/-!
# 前段：源から行の木まで

alpha1 の resolve() の頭（alpha1/javascript/resolve.js:12012-12025）の写し。源を3つの段に通す。

1. 字句の前処理（`Lex.preprocess`、lexer.js の preprocessWithLines）
2. 文法（`Peg.parse`、sign.pegjs を peggy が作る構文解析器。断りの行は frontEnd の lineAt）
3. 行の木（`Tree.rows`、ファイルの行ごとの parseRow）

どこかの段が断れば、そこでファイルごと止まる（JS の throw と同じ）。読む段の後ろの段（種類と断り）は、ここに入らない。
JS のスタックの溢れ（resolve.js の stackRefusal、括り 2 万段など）は写さない。ここでは燃料と構造の再帰で止まり、木を返す。
-/

namespace SignSem.Front

/-- 源 → 行の木（resolve.js:12012-12025 の frontEnd と行ごとの parseRow）。源は JS の文字列（`JStr`、UTF-16 の符号単位の並び）。 -/
def front (source : JStr) : Except FrontErr (List Row) := do
  let pre ← Lex.preprocess source
  let words ← Peg.parse pre
  Tree.rows words

end SignSem.Front
