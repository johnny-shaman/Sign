import SignSem.JStr

/-!
# Sign（alpha1）の構文の木

alpha1 の前段が作る2つの木の形を、Lean の型にする。どちらも alpha1/javascript の物の写しで、欄は値の段と前段が読む物だけ。

- 語の行（`WRow`）：文法（sign.pegjs）が返す物。行は語の平らな並びで、語は文字列か囲み。
- 行の木（`Row`）：resolve.js の parseRow が語の行から作る物。値の段（interpret.js）はこの木と行の番号だけを読む。

文字列の欄（綴り・印・字面・前処理の後の文字列・断りの欄）は、どれも `JStr`（JS の文字列。UTF-16 の符号単位の並びで、対の無い
サロゲートも1つの単位としてそのまま持つ）。位置の欄（`WRow` の `start`・`qs` と `Pre.lineAt` の添え字）は、前処理の後の文字列の
UTF-16 の符号単位の番号（JS の文字列の位置。peggy の offset と lexer.js の lineAt が受ける位置そのまま、dump.mjs の頭）。サロゲートの
対は2つの位置、対の無いサロゲートは1つの位置。

import は `SignSem.JStr` だけ（その先は Init だけ）。JSON との行き来は `SignSem.Json` に置く。
-/

namespace SignSem

/-- 囲みの種類（resolve.js の BLOCK_TAG）。`[…]`・`(…)`・`{…}` は区別しないで `bracket` 1つ。 -/
inductive Enc where
  | bracket
  | abs
  | norm
  | indent
  deriving DecidableEq, Repr, Inhabited

mutual

/--
行の木（resolve.js の parseRow）。

- `seq`：段11 の余積の並び（空白）。項は1つ以上。
- `op`：段2〜9 の行を切る中置（`:`・`?`・`#`・`;`・`|`・`&`・`==`・`!==`・`,`）。欠けた辺（`none`）は括りの行だけ。

`sym` は中置の綴り（JS の文字列）。`line` は元のソースの行（1 から）。parseRow が作った行の根（ファイルの行と、囲みの中の行）にだけ付き、
`op` の辺には付かない。
-/
inductive Row where
  | seq (terms : List Term) (line : Option Nat)
  | op (sym : JStr) (stage : Nat) (left right : Option Row) (line : Option Nat)

/--
項（resolve.js の tokenize と parseHigh）。

- `atom`：前置の印・核・後置の印。印は書いた順（外から内）で、前段の `_` を外した綴り（`$`・`-`・`!` など。JS の文字列）。
  書いた `_` には、いちばん内側に内部の `!` が1つ足されている（tokenize の写し、R138）。
- `infix`：段12〜22 の中置（`sym` は綴り、JS の文字列）。欠けた辺（`none`）は区間で、括りの行だけ。
-/
inductive Term where
  | atom (pre : List JStr) (core : Core) (post : List JStr)
  | infix (sym : JStr) (stage : Nat) (left right : Option Term)

/--
核（resolve.js の makeCore）。

- `name`：識別子（前段の `<x>` の `<>` を外した物。JS の文字列）。
- `lit`：字面（書いたまま。数・文字列・文字・番地など。JS の文字列）。
- `unit nId nVoid`：`_`。`nId` は書いた `_`（id）、`nVoid` は書いた `!_`（void）、どちらも偽なら点なしの席。
- `enc k rows`：囲みと、その中の行。
-/
inductive Core where
  | name (s : JStr)
  | lit (text : JStr)
  | unit (nId nVoid : Bool)
  | enc (k : Enc) (rows : List Row)

end

mutual

/--
文法の語（sign.pegjs の Expression が返す平らな並びの要素）。

- `str`：語の文字列（`<inc>`・`5`・`+`・`$_`・`_!` など。前置の印は末尾に `_`、後置の印は頭に `_`。JS の文字列）。
- `blk tag rows`：囲み。`tag` は前段の印の文字列そのまま（`"BRACKET_"` を引用符ごと。JS の文字列）。
-/
inductive Word where
  | str (s : JStr)
  | blk (tag : JStr) (rows : List WRow)

/--
文法の行（sign.pegjs の Expression の結果）。

- `start`：行の書き始めの位置（rowAt）。前処理の後の文字列の符号単位の番号（peggy の位置そのまま）。
- `line`：その位置の元のソースの行（lineAt(start)）。
- `qs`：行の中の `?` の語の位置（左から。qAt）。数え方は `start` と同じ（符号単位の番号）。
- `words`：語の並び。
-/
inductive WRow where
  | mk (start : Nat) (line : Option Nat) (qs : List Nat) (words : List Word)

end

/--
前処理（lexer.js の preprocessWithLines）の結果。

- `text`：文法に渡す文字列（JS の文字列。`text.size` は JS の `text.length`）。
- `lineAt`：`text` の位置ごとの、元のソースの行（1 から）。添え字は `text` の符号単位の位置 0〜`text.length` で、k 番目は JS の
  lineAt（preprocessWithLines が返す関数。lexer.js:774 で位置を 0〜`text.length` に切り詰める）に k を渡した値（dump.mjs の頭）。
  `lineAt.size` は `text.size + 1`（対の後ろの半分の位置にも値がある。`Pre.fromJson` は大きさの違う物を断る）。
-/
structure Pre where
  text : JStr
  lineAt : Array Nat
  deriving Inhabited

/--
前段の断り。alpha1 の throw の写しで、ファイルごと止まる。文字列の欄はどれも JS の文字列。

- `name`：JS の例外の名前（`OperationError`・`SyntaxError`）。
- `reason`：OperationError の機械の鍵（`question-row-indent`・`compare-chain` など）。SyntaxError には無い。
- `line`：元のソースの行（1 から）。
- `message`：利用者に見せる文（peggy の断りの found など、源の字をそのまま載せる所には対の無いサロゲートも来る）。
-/
structure FrontErr where
  name : JStr
  reason : Option JStr
  line : Option Nat
  message : JStr
  deriving Inhabited, Repr

end SignSem
