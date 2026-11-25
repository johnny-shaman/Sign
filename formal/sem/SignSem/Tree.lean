import SignSem.Syntax

/-!
# 行の木（resolve.js の parseRow）

語の行（`WRow`、文法の結果）から行の木（`Row`）を作る。的は alpha1/javascript の挙動そのもので、
resolve() の頭（resolve.js:12008-12025）と同じく、ファイルの行ごとに parseRow を当てる。

- 写した物：parseRow（resolve.js:514）と、それが呼ぶ tokenize・makeCore・isSeatRow・hasMissing・
  sectionInSeq・missingInfix・rowRefusal・refuseMixedAssoc・refuseChain・chainSyms・assocOf、
  断りの文を作る writeRow・writeBlock・writeCore・writeTerm・writeTree・isUnitTerm・shapeError、
  演算子の表（operator_table.js の OPERATOR_BY_PRECEDENCE と OPERATOR_DICT）。
- 中の木（`PRow`・`PTerm`・`PCore`）は JS の物と同じく囲みの語（`core.raw`）を持つ。断りの文（writeTerm）が
  囲みを書いた綴りで書くため。出す時に `Row` へ移す（`toRow`。raw を落とすのは rowsjson.mjs の exportRows と同じ）。
- 行の木の根（ファイルの行と、囲みの中の行）の `line` は、その語の行の `WRow.line`（rowTreeLine、resolve.js:201・:561）。
- 断りの `line` は withLine（resolve.js:270）と同じく、いちばん内で先に付いた行を残す。
- JS のスタックの溢れ（stackRefusal）は写さない（燃料と構造の再帰で止まる）。
- 語の行の位置（`WRow` の `start`・`qs`）は読まない。

文字列（語・中置の記号・前置と後置の印・名前・字面・囲みの印・断りの欄と文）はどれも `JStr`（JS の文字列。UTF-16 の符号単位の
並びで、対の無いサロゲートも1つの単位のまま）。

- 等しさは `==`（`JStr.beq`、単位ごと。JS の `===`）。表の鍵の引き当ても同じ `==` で見る。
- 長さ・切り出し・頭と末尾の単位は符号単位で数える（`size`・`slice`・`isAt`。JS の `.length`・`slice`・`w[k]`）。
- resolve.js の正規表現（PREFIX_MARK・POSTFIX_MARK・OPERATOR_WORD、resolve.js:412-414）は `u` の印が無いので、符号単位ごとに当たる。
  写しも単位で見る。
- 文は JStr の `++`・`JStr.join`・`JStr.intercalate` で組み、`JSON.stringify(s)` は `JStr.jsonStringify`。字面の文字列は
  `Coe String JStr` で JStr の所にそのまま書く。
- 公理：`==` は `JStr.beq` と UInt16 の `instBEqUInt16Decide`（JStr.lean）で、Classical.choice に依らない（SignSem/Axioms.lean が
  `Tree.rows` の `#print axioms` を固める）。

止まること：語の行と語の再帰（parseRow・parseRows・tokenize・makeCore）と、木の再帰は構造の再帰。
parseLow・parseSegment・parseHigh は位置を進める再帰で構造では言えないので、燃料（`6 * 字句の数 + 5`、parseRow の注）を引数にする。
-/

namespace SignSem.Tree
open SignSem

/-! ## 演算子の表（operator_table.js） -/

/-- 演算子の位置（operator_table.js の `position`）。 -/
inductive Position where
  | «prefix»
  | infix
  | «postfix»
  | enclosure
  deriving DecidableEq, Repr, Inhabited

/-- 表の1行（operator_table.js:153-166 の OPERATOR_DICT の要素：precedence・symbol と元の行の欄）。`assoc` が無ければ左。 -/
structure OpDef where
  symbol : JStr
  precedence : Nat
  position : Position
  name : JStr
  assoc : Option JStr := none
  removed : Option JStr := none
  deriving Repr, Inhabited

/-- 段ごとの演算子（operator_table.js:14 の OPERATOR_BY_PRECEDENCE）。段の番号は配列の添字＋1 で、空の段 10・17 は行が無い。
記号の `"\\n"` は `\` と `n` の2単位（operator_table.js:16 の `'\\n'`）、`"\t"` は TAB の1単位、`"\\"` は `\` の1単位。 -/
def OPERATOR_BY_PRECEDENCE : List (List OpDef) :=
  [ -- 1
    [ { symbol := "\\n", precedence := 1, position := .infix, name := "newline" },
      { symbol := "#", precedence := 1, position := .prefix, name := "export_internal" },
      { symbol := "##", precedence := 1, position := .prefix, name := "export_external" },
      { symbol := "###", precedence := 1, position := .prefix, name := "export_pin" } ],
    -- 2
    [ { symbol := ":", precedence := 2, position := .infix, name := "define", assoc := some "right" } ],
    -- 3
    [ { symbol := "?", precedence := 3, position := .infix, name := "lambda", assoc := some "right" } ],
    -- 4
    [ { symbol := "#", precedence := 4, position := .infix, name := "output", assoc := some "right" } ],
    -- 5
    [ { symbol := ";", precedence := 5, position := .infix, name := "xor" } ],
    -- 6
    [ { symbol := "|", precedence := 6, position := .infix, name := "or" } ],
    -- 7
    [ { symbol := "&", precedence := 7, position := .infix, name := "and" } ],
    -- 8
    [ { symbol := "===", precedence := 8, position := .infix, name := "same",
        removed := some "ねじれは `p ' 0` と `p ' 名前` の差で導出できます" },
      { symbol := "==", precedence := 8, position := .infix, name := "equal" },
      { symbol := "!==", precedence := 8, position := .infix, name := "xnot_equal" } ],
    -- 9
    [ { symbol := ",", precedence := 9, position := .infix, name := "product", assoc := some "right" } ],
    -- 10（空の段）
    [],
    -- 11
    [ { symbol := " ", precedence := 11, position := .infix, name := "coproduct" } ],
    -- 12
    [ { symbol := "~", precedence := 12, position := .infix, name := "range" },
      { symbol := "~+", precedence := 12, position := .infix, name := "range_arithmetic" },
      { symbol := "~-", precedence := 12, position := .infix, name := "range_arithmetic_rev" },
      { symbol := "~*", precedence := 12, position := .infix, name := "range_geometric" },
      { symbol := "~/", precedence := 12, position := .infix, name := "range_geometric_rev" },
      { symbol := "~^", precedence := 12, position := .infix, name := "range_power" } ],
    -- 13
    [ { symbol := "<", precedence := 13, position := .infix, name := "less" },
      { symbol := "<=", precedence := 13, position := .infix, name := "less_equal" },
      { symbol := "=", precedence := 13, position := .infix, name := "assign_equal" },
      { symbol := ">=", precedence := 13, position := .infix, name := "more_equal" },
      { symbol := ">", precedence := 13, position := .infix, name := "more" },
      { symbol := "!=", precedence := 13, position := .infix, name := "not_equal" } ],
    -- 14
    [ { symbol := "+", precedence := 14, position := .infix, name := "add" },
      { symbol := "-", precedence := 14, position := .infix, name := "sub" } ],
    -- 15
    [ { symbol := "*", precedence := 15, position := .infix, name := "mul" },
      { symbol := "/", precedence := 15, position := .infix, name := "div" },
      { symbol := "%", precedence := 15, position := .infix, name := "mod" } ],
    -- 16
    [ { symbol := "^", precedence := 16, position := .infix, name := "pow", assoc := some "right" } ],
    -- 17（空の段）
    [],
    -- 18
    [ { symbol := "'", precedence := 18, position := .infix, name := "get_prop" },
      { symbol := "@", precedence := 18, position := .infix, name := "get_at", assoc := some "right" } ],
    -- 19
    [ { symbol := "<<", precedence := 19, position := .infix, name := "bit_shift_left" },
      { symbol := ">>", precedence := 19, position := .infix, name := "bit_shift_right" } ],
    -- 20
    [ { symbol := "||", precedence := 20, position := .infix, name := "bit_or" } ],
    -- 21
    [ { symbol := ";;", precedence := 21, position := .infix, name := "bit_xor" } ],
    -- 22
    [ { symbol := "&&", precedence := 22, position := .infix, name := "bit_and" } ],
    -- 23
    [ { symbol := "!", precedence := 23, position := .postfix, name := "factorial" },
      { symbol := "~", precedence := 23, position := .postfix, name := "expand" } ],
    -- 24
    [ { symbol := "~", precedence := 24, position := .prefix, name := "continuous" },
      { symbol := "!", precedence := 24, position := .prefix, name := "not" },
      { symbol := "$", precedence := 24, position := .prefix, name := "address" },
      { symbol := "@", precedence := 24, position := .prefix, name := "input" },
      { symbol := "!!", precedence := 24, position := .prefix, name := "bit_not" },
      { symbol := "-", precedence := 24, position := .prefix, name := "negate" } ],
    -- 25
    [ { symbol := "@", precedence := 25, position := .postfix, name := "import" } ],
    -- 26
    [ { symbol := "(...)", precedence := 26, position := .enclosure, name := "block_paren" },
      { symbol := "{...}", precedence := 26, position := .enclosure, name := "block_brace" },
      { symbol := "[...]", precedence := 26, position := .enclosure, name := "block_bracket" },
      { symbol := "|...|", precedence := 26, position := .enclosure, name := "abs" },
      { symbol := "||...||", precedence := 26, position := .enclosure, name := "norm" } ],
    -- 27
    [ { symbol := "\t", precedence := 27, position := .prefix, name := "indent" } ],
    -- 28
    [ { symbol := "\\", precedence := 28, position := .prefix, name := "escape" } ] ]

/-- 記号の行の並び（operator_table.js:142-166 の OPERATOR_DICT[symbol]。段の順に入れたまま）。鍵は単位ごとの `==` で引く。 -/
def OPERATOR_DICT (symbol : JStr) : List OpDef :=
  (OPERATOR_BY_PRECEDENCE.flatten).filter (fun d => d.symbol == symbol)

/-- 中置の行（resolve.js:478・:715 の `(OPERATOR_DICT[w] || []).find((d) => d.position === "infix")`）。 -/
def infixDef? (symbol : JStr) : Option OpDef :=
  (OPERATOR_DICT symbol).find? (·.position == .infix)

/-- 結合の向き（resolve.js:714 assocOf）。表に無いか `assoc` が無ければ `"left"`。 -/
def assocOf (sym : JStr) : JStr :=
  match infixDef? sym with
  | some d => d.assoc.getD "left"
  | none => "left"

/-! ## 中の木 -/

/-- 核（resolve.js:444 makeCore の返す物）。囲みは中の行の木（もう `Row` に移した物）と、書いた語の行（`core.raw` の `w[1]`）を持つ。 -/
inductive PCore where
  | name (s : JStr)
  | lit (text : JStr)
  | unit (nId nVoid : Bool)
  | enc (k : Enc) (rows : List Row) (raw : List WRow)

/-- 項（resolve.js:472 tokenize の atom と :549 parseHigh の infix）。 -/
inductive PTerm where
  | atom (pre : List JStr) (core : PCore) (post : List JStr)
  | infix (sym : JStr) (stage : Nat) (left right : Option PTerm)

/-- 行の木（resolve.js:529 parseLow の op と :544 parseSegment の seq）。`line` は parseRow が根にだけ付ける（rowTreeLine）。 -/
inductive PRow where
  | seq (terms : List PTerm) (line : Option Nat)
  | op (sym : JStr) (stage : Nat) (left right : Option PRow) (line : Option Nat)

/-- 字句（resolve.js:472 tokenize の `{t:"op", sym, stage, assoc}` と `{t:"atom", term}`）。 -/
inductive Tok where
  | op (sym : JStr) (stage : Nat) (assoc : JStr)
  | atom (term : PTerm)

/-- 核を出す形へ（rowsjson.mjs の exportRows が `core.raw` を落とすのと同じ）。 -/
def PCore.toCore : PCore → Core
  | .name s => .name s
  | .lit t => .lit t
  | .unit a b => .unit a b
  | .enc k rows _ => .enc k rows

mutual
/-- 項を出す形へ。 -/
def toTerm : PTerm → Term
  | .atom pre core post => .atom pre core.toCore post
  | .infix sym stage l r => .infix sym stage (toTermOpt l) (toTermOpt r)
/-- 欠けうる項を出す形へ。 -/
def toTermOpt : Option PTerm → Option Term
  | none => none
  | some t => some (toTerm t)
end

mutual
/-- 行の木を出す形へ。 -/
def toRow : PRow → Row
  | .seq terms line => .seq (terms.map toTerm) line
  | .op sym stage l r line => .op sym stage (toRowOpt l) (toRowOpt r) line
/-- 欠けうる行の木を出す形へ。 -/
def toRowOpt : Option PRow → Option Row
  | none => none
  | some r => some (toRow r)
end

/-! ## 断り -/

/-- 木にできない形の断り（resolve.js:388 shapeError）。`spec` は出す物に無いので持たない。行は後から withLine で付ける。 -/
def shapeError (reason message : JStr) : FrontErr :=
  { name := "OperationError", reason := some reason, line := none, message := message }

/-- 写しの中の、起きないはずの所（燃料が尽きた所など）。JS に対応する断りは無い。 -/
def internalError (message : JStr) : FrontErr :=
  { name := "InternalError", reason := none, line := none, message := message }

/-- 断りに行を持たせる（resolve.js:270 withLine）。先に持たせた行（いちばん内の行）を残す。行が無ければそのまま。 -/
def withLine (e : FrontErr) (line : Option Nat) : FrontErr :=
  match line with
  | none => e
  | some _ =>
    match e.line with
    | none => { e with line := line }
    | some _ => e

/-- 前段の行の断りに、その行の元のソースの行を持たせる（resolve.js:616 rowRefusal）。`rowLineOf(words)` は語の行の `line`。 -/
def rowRefusal (e : FrontErr) (line : Option Nat) : FrontErr :=
  withLine e line

/-! ## 語の見分け方（resolve.js:412-418） -/

/-- 前置の印の語（resolve.js:412 PREFIX_MARK `/^(###|##|#|-|~|!!|!|\$|@)_$/` に当たる語の全部）。 -/
def PREFIX_MARK_WORDS : List JStr := ["###_", "##_", "#_", "-_", "~_", "!!_", "!_", "$_", "@_"]

/-- 後置の印の語（resolve.js:413 POSTFIX_MARK `/^_[!~@]$/` に当たる語の全部）。 -/
def POSTFIX_MARK_WORDS : List JStr := ["_!", "_~", "_@"]

/-- 前置の印（PREFIX_MARK）なら、末尾の `_` の1単位を外した物（`w.slice(0, -1)`）。 -/
def prefixMark? (w : JStr) : Option JStr :=
  if PREFIX_MARK_WORDS.any (· == w) then some (w.slice 0 (w.size - 1)) else none

/-- 後置の印（POSTFIX_MARK）なら、頭の `_` の1単位を外した物（`w.slice(1)`）。 -/
def postfixMark? (w : JStr) : Option JStr :=
  if POSTFIX_MARK_WORDS.any (· == w) then some (w.sliceFrom 1) else none

/-- 語の前置の印（文字列の語だけ。JS の `typeof w === "string" && PREFIX_MARK.test(w)`）。 -/
def prefixWord? : Word → Option JStr
  | .str s => prefixMark? s
  | .blk _ _ => none

/-- 語の後置の印（文字列の語だけ）。 -/
def postfixWord? : Word → Option JStr
  | .str s => postfixMark? s
  | .blk _ _ => none

/-- resolve.js:414 OPERATOR_WORD の字の組 `[!"#$%&'\-=^~|@;+:*,<>/?]` の単位（22 個、どれも ASCII）。 -/
def OPERATOR_UNITS : Array UInt16 := ("!\"#$%&'-=^~|@;+:*,<>/?" : JStr).units

/-- 単位が OPERATOR_WORD の字の組に入るか。 -/
def isOperatorChar (u : UInt16) : Bool := OPERATOR_UNITS.contains u

/-- 文字列が OPERATOR_WORD（resolve.js:414 `/^[…]+$/`）に当たるか：空でなく、単位が全部 isOperatorChar。
`u` の印が無い正規表現なので字の組は単位ごとに当たり、サロゲートの単位（対の半分も、対の無い物も）は組に無いので当たらない。 -/
def isOperatorWord (s : JStr) : Bool :=
  !s.isEmpty && s.units.all isOperatorChar

/-- 中置の語か（resolve.js:416 isInfixWord）。 -/
def isInfixWord : Word → Bool
  | .str s => isOperatorWord s
  | .blk _ _ => false

/-- 名前の語（resolve.js:415 isNameWord：`w.length > 2 && w[0] === "<" && w[w.length - 1] === ">"`）なら、`<>` を外した物
（`w.slice(1, -1)`）。長さと位置は符号単位で、JS のとおり（`<😀>` は長さ 4 で、中身は対の2単位）。 -/
def nameWord? (s : JStr) : Option JStr :=
  if s.size > 2 && s.isAt 0 0x3C && s.isAt (s.size - 1) 0x3E then some (s.slice 1 (s.size - 1)) else none

/-- 囲みの印（resolve.js:418 BLOCK_TAG の鍵。引用符ごとの綴り）。 -/
def blockTag? (tag : JStr) : Option Enc :=
  if tag == "\"BRACKET_\"" then some .bracket
  else if tag == "\"ABS_\"" then some .abs
  else if tag == "\"NORM_\"" then some .norm
  else if tag == "\"INDENT_\"" then some .indent
  else none

/-- 点なしの席の前置の語（resolve.js:428 SEAT_PREFIX_WORDS）。 -/
def SEAT_PREFIX_WORDS (w : JStr) : Bool :=
  w == "-_" || w == "!_" || w == "!!_"

/-- 語が文字列 `s` か（JS の `w === s`。囲みの語は当たらない）。 -/
def wordIs (w : Word) (s : JStr) : Bool :=
  match w with
  | .str t => t == s
  | .blk _ _ => false

/-- 括りの1行の語の並びが点なしの席か（resolve.js:430 isSeatRow）：前置 `-`・`!`・`!!` の1つと `_`、か `_` と後置 `!`。後ろの `,` 1つは見ない。 -/
def isSeatRow (ws : List Word) : Bool :=
  let a := match ws.getLast? with
    | some l => if wordIs l "," then ws.dropLast else ws
    | none => ws
  match a with
  | [a0, a1] =>
    (match a0 with | .str s => SEAT_PREFIX_WORDS s | .blk _ _ => false) && wordIs a1 "_" ||
      (wordIs a0 "_" && wordIs a1 "_!")
  | _ => false

/-! ## 書いたとおりの綴り（resolve.js:723-790） -/

/-- 囲みの綴りの外側（resolve.js:754 writeBlockIn の switch）。字下げのブロックと知らない印は `{…}`。 -/
def encWrap (k : Option Enc) (inner : JStr) : JStr :=
  match k with
  | some .bracket => "[" ++ inner ++ "]"
  | some .abs => "|" ++ inner ++ "|"
  | some .norm => "||" ++ inner ++ "||"
  | _ => "{" ++ inner ++ "}"

/-- 語を綴った部分の並びの仕上げ（resolve.js:741-746）：行末の `,` は前の語に付ける（貪欲の印）。 -/
def finishParts (parts : Array JStr) : JStr :=
  let parts :=
    match parts.back? with
    | some last =>
      if parts.size ≥ 2 && last == "," then
        let p := parts.pop
        match p.back? with
        | some l => p.pop.push (l ++ ",")
        | none => p
      else parts
    | none => parts
  JStr.intercalate " " parts.toList

mutual
/-- resolve.js:723 writeRow の語のループ（`parts` と `pending`）。前置の印は次の部分に、後置の印は前の部分に付ける。 -/
def writeWords : List Word → Array JStr → JStr → Array JStr
  | [], parts, _ => parts
  | .blk tag rows :: rest, parts, pending =>
    writeWords rest (parts.push (pending ++ writeBlock tag rows)) JStr.empty
  | .str w :: rest, parts, pending =>
    match prefixMark? w with
    | some m => writeWords rest parts (pending ++ m)
    | none =>
      match postfixMark? w, parts.back? with
      | some m, some l => writeWords rest (parts.pop.push (l ++ m)) pending
      | _, _ => writeWords rest (parts.push (pending ++ (nameWord? w).getD w)) JStr.empty
/-- 書いた括り・囲みの綴り（resolve.js:749 writeBlock・:754 writeBlockIn）。中の行は ` ⏎ `（U+23CE は1単位）で繋ぐ。 -/
def writeBlock (tag : JStr) (rows : List WRow) : JStr :=
  encWrap (blockTag? tag) (JStr.intercalate " ⏎ " (writeRowList rows))
/-- 中の行ごとの綴り（writeBlockIn の `b[1].map(writeRow)`）。 -/
def writeRowList : List WRow → List JStr
  | [] => []
  | r :: rs => writeWRow r :: writeRowList rs
/-- 語の行の綴り（resolve.js:723 writeRow）。 -/
def writeWRow : WRow → JStr
  | .mk _ _ _ words => finishParts (writeWords words #[] JStr.empty)
end

/-- 語の並びの書いたとおりの綴り（resolve.js:723 writeRow）。 -/
def writeRow (words : List Word) : JStr :=
  finishParts (writeWords words #[] JStr.empty)

/-- 核の綴り（resolve.js:768 writeCore）。前段の囲みは書いた語（`core.raw`）から綴る（`core.written` は前段では付かない）。 -/
def writeCore : PCore → JStr
  | .name s => s
  | .lit t => t
  | .unit _ _ => "_"
  | .enc k _ raw => encWrap (some k) (JStr.intercalate " ⏎ " (writeRowList raw))

/-- 空でない物を空白で繋ぐ（`[…].filter((s) => s !== "").join(" ")`）。 -/
def joinNonEmpty (xs : List JStr) : JStr :=
  JStr.intercalate " " (xs.filter (fun s => !s.isEmpty))

mutual
/-- 項の綴り（resolve.js:777 writeTerm）。内部の印を綴りへ戻す：id は足した前置 `!` を外し、手で書いた void は外した `!` を戻す。 -/
def writeTerm : PTerm → JStr
  | .infix sym _ l r => joinNonEmpty [writeTermOpt l, sym, writeTermOpt r]
  | .atom pre core post =>
    let pre' : List JStr := match core with
      | .unit true _ => pre.dropLast
      | .unit _ true => pre ++ [("!" : JStr)]
      | _ => pre
    JStr.join pre' ++ writeCore core ++ JStr.join post
/-- 欠けうる項の綴り（`writeTerm(null)` は `""`）。 -/
def writeTermOpt : Option PTerm → JStr
  | none => JStr.empty
  | some t => writeTerm t
end

mutual
/-- 行の木の綴り（resolve.js:785 writeTree）。 -/
def writeTree : PRow → JStr
  | .seq terms _ => JStr.intercalate " " (terms.map writeTerm)
  | .op sym _ l r _ => joinNonEmpty [writeTreeOpt l, sym, writeTreeOpt r]
/-- 欠けうる行の木の綴り（`writeTree(null)` は `""`）。 -/
def writeTreeOpt : Option PRow → JStr
  | none => JStr.empty
  | some t => writeTree t
end

/-- 書いた単位だけの項（resolve.js:6885 isUnitTerm）：印の無い核 `_`。 -/
def isUnitTerm : PTerm → Bool
  | .atom [] (.unit _ _) [] => true
  | _ => false

/-! ## 欠けた被演算子（resolve.js:601-632） -/

mutual
/-- 項の中に欠けた被演算子があるか（resolve.js:625 hasMissingTerm）。 -/
def hasMissingTerm : PTerm → Bool
  | .infix _ _ l r => hasMissingTermOpt l || hasMissingTermOpt r
  | .atom _ _ _ => false
/-- 欠けうる項（`hasMissingTerm(null)` は真）。 -/
def hasMissingTermOpt : Option PTerm → Bool
  | none => true
  | some t => hasMissingTerm t
end

mutual
/-- 行の木に欠けた被演算子があるか（resolve.js:620 hasMissing）。 -/
def hasMissingRow : PRow → Bool
  | .seq terms _ => terms.any hasMissingTerm
  | .op _ _ l r _ => hasMissing l || hasMissing r
/-- 欠けうる行の木（`hasMissing(null)` は真）。 -/
def hasMissing : Option PRow → Bool
  | none => true
  | some t => hasMissingRow t
end

/-- 並びの中で、被演算子の欠けた最初の項の番号と項（sectionInSeq の `terms.find(hasMissingTerm)` と、parseRow の `indexOf`）。 -/
def findMissing : List PTerm → Nat → Option (Nat × PTerm)
  | [], _ => none
  | t :: ts, i => if hasMissingTerm t then some (i, t) else findMissing ts (i + 1)

mutual
/-- 2項以上の並びの中の、被演算子の欠けた項（resolve.js:601 sectionInSeq）。見つかれば並びの項・番号・項。 -/
def sectionInSeqRow : PRow → Option (List PTerm × Nat × PTerm)
  | .seq terms _ =>
    if terms.length ≥ 2 then
      match findMissing terms 0 with
      | some (i, t) => some (terms, i, t)
      | none => none
    else none
  | .op _ _ l r _ =>
    match sectionInSeq l with
    | some hit => some hit
    | none => sectionInSeq r
/-- 欠けうる行の木（`sectionInSeq(null)` は null）。 -/
def sectionInSeq : Option PRow → Option (List PTerm × Nat × PTerm)
  | none => none
  | some t => sectionInSeqRow t
end

mutual
/-- 項の中の、被演算子の欠けた中置（resolve.js:610 missingInfix）。記号と、左が欠けたか。 -/
def missingInfix : PTerm → Option (JStr × Bool)
  | .atom _ _ _ => none
  | .infix sym _ l r =>
    if l.isNone || r.isNone then some (sym, l.isNone)
    else
      match missingInfixOpt l with
      | some hit => some hit
      | none => missingInfixOpt r
/-- 欠けうる項（null は null）。 -/
def missingInfixOpt : Option PTerm → Option (JStr × Bool)
  | none => none
  | some t => missingInfix t
end

/-! ## 比べの連鎖と結合の向き（resolve.js:634-718） -/

/-- 段13 の比べ（resolve.js:667 COMPARE_HIGH）。 -/
def COMPARE_HIGH (s : JStr) : Bool :=
  s == "<" || s == "<=" || s == "=" || s == ">=" || s == ">" || s == "!="

/-- 段8 の比べ（resolve.js:668 COMPARE_LOW）。 -/
def COMPARE_LOW (s : JStr) : Bool :=
  s == "==" || s == "!=="

mutual
/-- 段13 の比べの左の背骨の記号（resolve.js:697 chainSyms の `high`）。 -/
def highSyms : PTerm → List JStr
  | .infix sym _ l _ => if COMPARE_HIGH sym then sym :: highSymsOpt l else []
  | .atom _ _ _ => []
/-- 欠けうる項（null は何も足さない）。 -/
def highSymsOpt : Option PTerm → List JStr
  | none => []
  | some t => highSyms t
end

/-- 比べの項1つだけの並びの、その項の背骨（chainSyms の `high(only(s))`）。 -/
def highOnly : Option PRow → List JStr
  | some (.seq [t] _) => highSyms t
  | _ => []

mutual
/-- 段8 の比べの左の背骨（resolve.js:697 chainSyms の op の枝）：記号ごとに右の辺の比べの背骨も数え、終わりの左の辺の背骨も数える。 -/
def lowSyms : PRow → List JStr
  | t@(.op sym _ l r _) => if COMPARE_LOW sym then sym :: (highOnly r ++ lowSymsOpt l) else highOnly (some t)
  | t@(.seq _ _) => highOnly (some t)
/-- 欠けうる行の木（`high(only(null))` は何も足さない）。 -/
def lowSymsOpt : Option PRow → List JStr
  | none => []
  | some t => lowSyms t
end

/-- 比べの連鎖の記号の並び（resolve.js:697 chainSyms）。項なら段13 の背骨、行の木なら段8 の背骨。 -/
def chainSyms : Sum PTerm PRow → List JStr
  | .inl t => highSyms t
  | .inr t => lowSyms t

/-- 比べの連鎖を断るか（resolve.js:675 refuseChain）。通す物は `ok ()`。断りの文の木は、項なら writeTerm、行の木なら writeTree。 -/
def refuseChain (t : Sum PTerm PRow) (line : Option Nat) : Except FrontErr Unit :=
  let syms := chainSyms t
  if syms.length < 2 then pure ()
  else if syms.all (· == "=") || syms.all (· == "==") then pure ()
  else
    let up := fun (s : JStr) => s == "<" || s == "<="
    let down := fun (s : JStr) => s == ">" || s == ">="
    if syms.length == 2 && (syms.all up || syms.all down) then pure ()
    else
      let s0 : JStr := syms.head?.getD JStr.empty
      let why : JStr :=
        if syms.all up || syms.all down then JStr.ofNat (syms.length + 1) ++ "項です（範囲の連鎖は3項までです）"
        else if syms.all (fun s => up s || down s) then "向きが揃っていません"
        else if syms.all (· == "!=") || syms.all (· == "!==") then
          "`" ++ s0 ++ "` の連鎖です（`" ++ s0 ++ "` は推移的でないので、`1 " ++ s0 ++ " 2 " ++ s0 ++ " 1` は隣どうしが全部違っても両端が等しくなります）"
        else "種類の違う比べを混ぜています"
      let shown : JStr := match t with
        | .inl u => writeTerm u
        | .inr u => writeTree u
      throw (rowRefusal (shapeError "compare-chain"
        ("比べの連鎖（`" ++ shown ++ "`）は" ++ why ++
          "。通る比べの連鎖は、3項までの範囲（`a < b < c`・`0 <= i < n`・`a > b >= c`）と、`=` だけ・`==` だけの連鎖です。比べを分けるなら括りで書きます。")) line)

mutual
/-- 項の中の中置を見る（resolve.js:635 refuseMixedAssoc の visitTerm）。段13 の比べは連鎖を見て、子の中置が同じ段で向きが違えば断る。 -/
def visitTerm (line : Option Nat) : PTerm → Except FrontErr Unit
  | .atom _ _ _ => pure ()
  | t@(.infix sym stage l r) => do
    if COMPARE_HIGH sym then refuseChain (.inl t) line
    visitChild line sym stage l
    visitChild line sym stage r
/-- visitTerm の `for (const child of [term.left, term.right])` の1回。 -/
def visitChild (line : Option Nat) (sym : JStr) (stage : Nat) : Option PTerm → Except FrontErr Unit
  | none => pure ()
  | some c => do
    match c with
    | .infix csym cstage _ _ =>
      if cstage == stage && !(assocOf csym == assocOf sym) then
        throw (rowRefusal (shapeError "infix-mixed-assoc"
          ("同じ段で結合の向きが違う中置（`" ++ csym ++ "` と `" ++ sym ++ "`）が続いています。括りで分けて書きます。")) line)
    | .atom _ _ _ => pure ()
    visitTerm line c
end

mutual
/-- 行の木を見る（resolve.js:651 refuseMixedAssoc の visit）。段8 の `==`・`!==` は並びを切る節なので、ここで連鎖を見る。 -/
def visitRow (line : Option Nat) : PRow → Except FrontErr Unit
  | .seq terms _ => terms.forM (visitTerm line)
  | t@(.op sym _ l r _) => do
    if COMPARE_LOW sym then refuseChain (.inr t) line
    visitOpt line l
    visitOpt line r
/-- 欠けうる行の木（null は見ない）。 -/
def visitOpt (line : Option Nat) : Option PRow → Except FrontErr Unit
  | none => pure ()
  | some t => visitRow line t
end

/-- 同じ段で結合の向きの違う中置の続きと、比べの連鎖を断る（resolve.js:634 refuseMixedAssoc）。`words` は行（rowRefusal）のためだけに要るので、その行を受ける。 -/
def refuseMixedAssoc (tree : Option PRow) (line : Option Nat) : Except FrontErr Unit :=
  visitOpt line tree

/-! ## 段1〜9 と段12〜22 を畳む（resolve.js:525-559、parseRow の中の関数） -/

/-- 燃料が尽きた断り。燃料は字句の数から決めてあり、尽きないはず（parseRow の注）。 -/
def outOfFuel : FrontErr :=
  internalError "行の木を畳む途中で燃料が尽きました（parseLow・parseSegment・parseHigh。字句の数から決めた燃料が足りません）。"

/-- 並びを切る中置か（resolve.js:526 isLow）。 -/
def isLow : Option Tok → Bool
  | some (.op _ stage _) => stage ≤ 9
  | _ => false

/-- 項の中へ畳む中置か（resolve.js:527 isHigh）。 -/
def isHigh : Option Tok → Bool
  | some (.op _ stage _) => stage ≥ 12
  | _ => false

mutual
/-- 段1〜9 を畳む（resolve.js:529 parseLow）。`(木, 次の位置)` を返す。 -/
def parseLow (toks : Array Tok) : Nat → Nat → Nat → Except FrontErr (Option PRow × Nat)
  | 0, _, _ => throw outOfFuel
  | fuel + 1, minStage, pos => do
    let (left, pos) ← parseSegment toks fuel pos
    parseLowLoop toks fuel minStage left pos
/-- parseLow の `while (isLow(peek()) && peek().stage >= minStage)`。 -/
def parseLowLoop (toks : Array Tok) : Nat → Nat → Option PRow → Nat → Except FrontErr (Option PRow × Nat)
  | 0, _, _, _ => throw outOfFuel
  | fuel + 1, minStage, left, pos =>
    match toks[pos]? with
    | some (.op sym stage assoc) =>
      if stage ≤ 9 && stage ≥ minStage then do
        let (right, pos) ← parseLow toks fuel (if assoc == "right" then stage else stage + 1) (pos + 1)
        parseLowLoop toks fuel minStage (some (.op sym stage left right none)) pos
      else pure (left, pos)
    | _ => pure (left, pos)
/-- 余積の並び（resolve.js:544 parseSegment）。項が無ければ null。 -/
def parseSegment (toks : Array Tok) : Nat → Nat → Except FrontErr (Option PRow × Nat)
  | 0, _ => throw outOfFuel
  | fuel + 1, pos => do
    let (terms, pos) ← parseSegmentLoop toks fuel #[] pos
    pure (if terms.isEmpty then none else some (.seq terms.toList none), pos)
/-- parseSegment の `while (pos < toks.length && !isLow(peek())) terms.push(parseHigh(12))`。
並びを切らない字句は項か段12 以上の中置なので、parseHigh(12) は必ず項を返す（表に段10・11 の中置の語は無い）。返さなければ写しの誤り。 -/
def parseSegmentLoop (toks : Array Tok) : Nat → Array PTerm → Nat → Except FrontErr (Array PTerm × Nat)
  | 0, _, _ => throw outOfFuel
  | fuel + 1, terms, pos =>
    if pos < toks.size && !isLow toks[pos]? then do
      let (t, pos) ← parseHigh toks fuel 12 pos
      match t with
      | some t => parseSegmentLoop toks fuel (terms.push t) pos
      | none => throw (internalError "並びの項が null になりました（parseSegment）。")
    else pure (terms, pos)
/-- 段12〜22 を項の中へ畳む（resolve.js:549 parseHigh）。左が無ければ区間（左の欠けた中置）。 -/
def parseHigh (toks : Array Tok) : Nat → Nat → Nat → Except FrontErr (Option PTerm × Nat)
  | 0, _, _ => throw outOfFuel
  | fuel + 1, minStage, pos =>
    match toks[pos]? with
    | some (.atom t) => parseHighLoop toks fuel minStage (some t) (pos + 1)
    | _ => parseHighLoop toks fuel minStage none pos
/-- parseHigh の `while (isHigh(peek()) && peek().stage >= minStage)`。右は、次が項か段12 以上の中置の時だけ読む。 -/
def parseHighLoop (toks : Array Tok) : Nat → Nat → Option PTerm → Nat → Except FrontErr (Option PTerm × Nat)
  | 0, _, _, _ => throw outOfFuel
  | fuel + 1, minStage, left, pos =>
    match toks[pos]? with
    | some (.op sym stage assoc) =>
      if stage ≥ 12 && stage ≥ minStage then do
        let next := if assoc == "right" then stage else stage + 1
        let pos := pos + 1
        let readRight := match toks[pos]? with
          | some (.atom _) => true
          | t => isHigh t
        let (right, pos) ← if readRight then parseHigh toks fuel next pos else pure (none, pos)
        parseHighLoop toks fuel minStage (some (.infix sym stage left right)) pos
      else pure (left, pos)
    | _ => pure (left, pos)
end

/-! ## 語を項に寄せる（resolve.js:444 makeCore・:472 tokenize）と行を木にする（resolve.js:514 parseRow） -/

/-- tokenize の1つの項の途中（`while (i < words.length)` の中の位置）。
- `idle`：項の始まり。
- `pre ms`：前置の印を集めている（`while (PREFIX_MARK.test(words[i])) pre.push(…)`）。
- `post pre core ps`：核を読み、後置の印を集めている。 -/
inductive TokSt where
  | idle
  | pre (marks : Array JStr)
  | post (pre : Array JStr) (core : PCore) (marks : Array JStr)

/-- 項を閉じる（resolve.js:491-502 tokenize の綴りから意味への写し、R138）。点なしの席でない行の核 `_` で、いちばん内側の前置が `!` の物は
void（その `!` を外して印 nVoid）、ほかの核 `_` は id（いちばん内側に `!` を足して印 nId）。 -/
def closeAtom (seat : Bool) (pre : Array JStr) (core : PCore) (post : Array JStr) : PTerm :=
  match core with
  | .unit _ _ =>
    if seat then .atom pre.toList core post.toList
    else
      match pre.back? with
      | some l =>
        if l == "!" then .atom pre.pop.toList (.unit false true) post.toList
        else .atom (pre.push "!").toList (.unit true false) post.toList
      | none => .atom (pre.push "!").toList (.unit true false) post.toList
  | _ => .atom pre.toList core post.toList

/-- 中置の語の字句（resolve.js:477-482）。表に無ければ operator-unknown、廃止なら operator-removed。 -/
def infixTok (w : JStr) : Except FrontErr Tok :=
  match infixDef? w with
  | none => throw (shapeError "operator-unknown" ("`" ++ w ++ "` は中置の演算子として表にありません。"))
  | some d =>
    match d.removed with
    | some why => throw (shapeError "operator-removed" ("`" ++ w ++ "` は廃止されました（" ++ why ++ "）。"))
    | none => pure (.op w d.precedence (d.assoc.getD "left"))

/-- 文字列の語の核（resolve.js:466-468 makeCore の後ろ）：`_` は単位、`<x>` は名前、ほかは字面。 -/
def strCore (w : JStr) : PCore :=
  if w == "_" then .unit false false
  else match nameWord? w with
    | some n => .name n
    | none => .lit w

mutual
/-- 1行を木にする（resolve.js:514 parseRow）。`inBracket` は括りの中の行（欠けた被演算子を許す所）、`seat` はその行が点なしの席か（seatRows.has(words)）。

燃料：字句の数を n とすると、parseLow・parseLowLoop・parseSegment・parseSegmentLoop・parseHigh・parseHighLoop の呼ばれる数の和は
`4 + 5·(段1〜9 の中置の字句の数) + 3·(項の字句の数) + 6·(段12〜22 の中置の字句の数) ≤ 6n + 4`（parseLow は段1〜9 の中置ごとに1回と初めの1回、
parseSegment も同じ数、ループは1回ごとに字句を1つ読む、並びの項は字句を1つ以上読む）。呼び出しの鎖の長さはこの和を超えないので、`6n + 5` で尽きない
（formal/check/sem/gate.mjs の 20 個の集まりで木の段を当てた 713,928 行で、燃料の断り（InternalError）は 0）。燃料は字句の数で数え、語の綴りの長さ（単位の数）には依らない。 -/
def parseRow (inBracket seat : Bool) : WRow → Except FrontErr PRow
  | .mk _ line _ words => do
    -- resolve.js:515-520：tokenize の断りは、この行が（括りの中の行が先に持っていなければ）行を持つ
    let toks ← match tokenize seat words .idle #[] with
      | .ok toks => pure toks
      | .error e => throw (rowRefusal e line)
    let (tree, _) ← parseLow toks (6 * toks.size + 5) 1 0
    -- resolve.js:562-568：行の木の根に行を付ける（rowTreeLine）
    let tree : Option PRow := match tree with
      | some (.seq terms _) => some (.seq terms line)
      | some (.op sym stage l r _) => some (.op sym stage l r line)
      | none => none
    -- resolve.js:569
    let allowMissing := inBracket && (match words.head?, words.getLast? with
      | some a, some b => isInfixWord a || isInfixWord b
      | _, _ => false)
    -- resolve.js:570-572
    if !allowMissing && hasMissing tree then
      throw (rowRefusal (shapeError "infix-missing-operand"
        ("中置の演算子の被演算子が欠けています（点なしは括りの中でだけ書けます）: `" ++ writeRow words ++ "`")) line)
    -- resolve.js:578-596（R119：点なしの被演算子は1項に限る）
    if allowMissing then
      match sectionInSeq tree with
      | some (terms, idx, term) =>
        match missingInfix term with
        | some (sym, leftMissing) =>
          let side : JStr := if leftMissing then "左" else "右"
          let sec := writeTerm term
          let near : JStr := if idx == 0 then "後ろ" else if idx == terms.length - 1 then "前" else "前と後ろ"
          let tail : JStr :=
            if idx == 0 && (terms.drop 1).all isUnitTerm then "点なしなら `!_` を書かずに `[" ++ sec ++ "]` と書きます。" else JStr.empty
          throw (rowRefusal (shapeError "infix-missing-operand"
            ("点なしの被演算子は1項に限ります（§2）。括りの行 `" ++ writeRow words ++ "` は、区間 `" ++ sec ++ "` の" ++ near ++
              "にも項が並ぶので点なしの形ではなく、中置 `" ++ sym ++ "` の" ++ side ++
              "の被演算子が欠けています（括りの外の `+ 16` と同じ、§1.2 P1）。文法に無い形なので、読む段で止めます（§4 R119。前は G7）。" ++ tail)) line)
        | none => throw (internalError "欠けた項に欠けた中置がありません（missingInfix）。")
      | none => pure ()
    -- resolve.js:597-598
    refuseMixedAssoc tree line
    match tree with
    | some t => pure t
    | none => throw (internalError "行の木が null になりました（parseRow）。")
/-- 囲みの中の行を順に木にする（resolve.js:451 makeCore の `w[1].map((row) => parseRow(row, …))`）。最初の断りで止まる。 -/
def parseRows (inBracket seat : Bool) : List WRow → Except FrontErr (List PRow)
  | [] => pure []
  | r :: rs => do
    let t ← parseRow inBracket seat r
    let ts ← parseRows inBracket seat rs
    pure (t :: ts)
/-- 1行の語を項と中置の字句の並びにする（resolve.js:472 tokenize）。印は隣の核1つに付く（R2）。`seat` は seatRows.has(words)。 -/
def tokenize (seat : Bool) : List Word → TokSt → Array Tok → Except FrontErr (Array Tok)
  | [], .idle, acc => pure acc
  | [], .pre _, _ => throw (shapeError "front-end-shape" "前置の印の後ろに核がありません。")
  | [], .post pre core ps, acc => pure (acc.push (.atom (closeAtom seat pre core ps)))
  | w :: rest, st, acc =>
    match st, postfixWord? w with
    | .post pre core ps, some m => tokenize seat rest (.post pre core (ps.push m)) acc
    | st, _ =>
      -- 前の項を閉じる（後置の印が続かない所）
      let closed : Option (Array JStr) × Array Tok := match st with
        | .post pre core ps => (none, acc.push (.atom (closeAtom seat pre core ps)))
        | .pre ms => (some ms, acc)
        | .idle => (none, acc)
      let acc := closed.2
      match closed.1 with
      | some ms =>
        -- 前置の印の後ろ：次の前置の印か、核（中置の語でも核にする）
        match prefixWord? w with
        | some m => tokenize seat rest (.pre (ms.push m)) acc
        | none => do
          let core ← makeCore w
          tokenize seat rest (.post ms core #[]) acc
      | none =>
        -- 項の始まり：中置の語か、前置の印か、核
        if isInfixWord w then do
          let tok ← infixTok (match w with | .str s => s | .blk _ _ => JStr.empty)
          tokenize seat rest .idle (acc.push tok)
        else
          match prefixWord? w with
          | some m => tokenize seat rest (.pre #[m]) acc
          | none => do
            let core ← makeCore w
            tokenize seat rest (.post #[] core #[]) acc
/-- 語を核にする（resolve.js:444 makeCore）。囲みは中の行を木にし、1行の括りが片側の欠けた `:`・`?` なら断る（R119、pointfree-tree-notation）。 -/
def makeCore : Word → Except FrontErr PCore
  | .str w => pure (strCore w)
  | .blk tag rows => do
    match blockTag? tag with
    | none => throw (shapeError "front-end-shape" ("前段の囲みの印を読めません: " ++ JStr.jsonStringify tag))
    | some c =>
      let isB := c == .bracket
      -- resolve.js:450：1行の括りが点なしの席なら、その行の `_` は綴りのまま読む（seatRows）
      let seat := isB && (match rows with
        | [.mk _ _ _ ws] => isSeatRow ws
        | _ => false)
      let prows ← parseRows isB seat rows
      -- resolve.js:456-464
      if isB then
        match prows with
        | [r0@(.op sym _ l r _)] =>
          if (sym == ":" || sym == "?") && (l.isNone || r.isNone) then
            let how : JStr :=
              if sym == "?" then "関数なら左に仮引数、右に本体を書きます（`[z ? z]`）" else "欄なら左に名前、右に値を書きます（`[k : 5]`）"
            throw (shapeError "pointfree-tree-notation"
              ("括り `[" ++ writeTree r0 ++ "]` は、片側の欠けた `" ++ sym ++ "` の点なし（木を書く記法の `[" ++ sym ++
                "]`）です。alpha1 では作らない（§2、§5 Q19）ので、読む段で止めます（§4 R119。前は並びの中で G7）。" ++ how ++ "。"))
        | _ => pure ()
      pure (.enc c (prows.map toRow) rows)
end

/-! ## 入口 -/

/-- ファイルの行ごとに parseRow を当てる（resolve.js:12012-12025 resolve() の頭の `front.rows.map((words) => parseRow(words))`）。最初の断りで止まる。 -/
def rows : List WRow → Except FrontErr (List Row)
  | [] => pure []
  | r :: rs => do
    let t ← parseRow false false r
    let ts ← rows rs
    pure (toRow t :: ts)

end SignSem.Tree
