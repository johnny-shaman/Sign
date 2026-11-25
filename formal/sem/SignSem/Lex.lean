import SignSem.Syntax

/-!
# 字句の前処理（lexer.js の preprocessWithLines）

alpha1/javascript/lexer.js の `preprocessWithLines`（:736）と、それが呼ぶ物の全部を Lean に写す。的は JS の挙動そのもの
（文書と食い違えば JS が正）。入口は `SignSem.Lex.preprocess : JStr → Except FrontErr Pre`。

- 字の数え方：文字列はどれも `JStr`（JS の文字列。UTF-16 の符号単位の並び）で、JS と同じく単位で数える。`s[k]`・`.length`・
  `slice`・`indexOf`・`startsWith`・`split(' ')`・`trim`・`trimEnd` は単位の操作（`JStr` の物）で、字の比べは単位の値の比べ。
  lexer.js と operator_table.js の正規表現にはどれも u の印が無いので、`.`・`[^…]`・`[\s\S]` は1単位に当たり、当たらなければ
  1単位進む。だから `\` の後ろの `[\s\S]`・`\\.`・`input.slice(i, i + 2)` は、BMP の外の字なら上の半分だけを取り、下の半分は次の回で
  「ほかの字」として出る。対の無いサロゲートも、ほかの単位と同じ1つの値として運ぶ。
- `JSON.stringify` で源の字を載せる断りの文（lexer.js:130・600・637・641・682・685）は `JStr.jsonStringify`（ES2019 の
  well-formed な形：上の半分と下の半分の対はそのまま、対の無いサロゲートと逆さの対は `\udxxx`）。断りの文に源の字をそのまま
  載せる所（テンプレートと `+`）は JStr の `++`。数は `JStr.ofNat`・`JStr.ofInt`（JS の `String(n)`）。
- 行の表：lineAt（lexer.js:745-786）は単位で数えて、位置 0〜`text.length` の全部で引く（`lineAtTable`）。`Pre.lineAt` はその表
  そのまま（添え字は単位の位置、大きさ `text.size + 1`。dump.mjs が書く物と同じ）。
- ループ：`partial def` を使わない。1単位ずつ進むループは「残りの単位の数」で構造の再帰にする（燃料は要らない）。跳んで進むループ
  （`i += 2`、閉じの次へ跳ぶ、正規表現の当たりの終わりへ跳ぶ）は燃料（`Nat`）を引数にする。燃料はそのループが読む文字列の単位の
  数＋1（どの回も1単位以上進むので尽きない）で、尽きたら `FrontErr` の name `"InternalError"` を返す（JS には無い断り）。
- 断り：JS の throw は `FrontErr`。`OperationError` は reason と message、`SyntaxError` は message だけ。`TypeError` は
  JS の実行の誤り（`endsWithInfixOperator` が Object.prototype の名前を引いた所、下の注）の写し。行（`line`）の付け方は
  preprocessWithLines（:738-744）の写し。
-/

namespace SignSem.Lex

/-- 前段の断りを返す計算。 -/
abbrev M := Except FrontErr

/-- 燃料が尽きた（写しの側の誤り。JS には無い）。`fn` は写しの側で書いた名前。 -/
def outOfFuel {α : Type} (fn : String) : M α :=
  throw { name := "InternalError", reason := none, line := none, message := .ofString ("燃料が尽きました（" ++ fn ++ "）") }

/-- 写しが前提にした形が崩れた（JS なら undefined を読む所。写しの側の誤り）。 -/
def internalError {α : Type} (what : String) : M α :=
  throw { name := "InternalError", reason := none, line := none, message := .ofString what }

/-- `new SyntaxError(message)`（line は後で preprocessWithLines が持たせる）。 -/
def syntaxError {α : Type} (msg : JStr) : M α :=
  throw { name := "SyntaxError", reason := none, line := none, message := msg }

/-- `new OperationError(message, { reason })`（errors.js:13）。 -/
def operationError {α : Type} (reason msg : JStr) : M α :=
  throw { name := "OperationError", reason := some reason, line := none, message := msg }

/-! ## JS の文字列の道具 -/

-- lexer.js が比べる ASCII の字の単位。
namespace U
/-- TAB -/
abbrev tab : UInt16 := 0x09
/-- LF（`\n`） -/
abbrev lf : UInt16 := 0x0A
/-- CR（`\r`） -/
abbrev cr : UInt16 := 0x0D
/-- INDENT の印（`\x02`） -/
abbrev stx : UInt16 := 0x02
/-- DEDENT の印（`\x03`） -/
abbrev etx : UInt16 := 0x03
/-- 空白 -/
abbrev sp : UInt16 := 0x20
/-- `!` -/
abbrev bang : UInt16 := 0x21
/-- `"` -/
abbrev dq : UInt16 := 0x22
/-- `#` -/
abbrev hash : UInt16 := 0x23
/-- `$` -/
abbrev dollar : UInt16 := 0x24
/-- `(` -/
abbrev lparen : UInt16 := 0x28
/-- `)` -/
abbrev rparen : UInt16 := 0x29
/-- `:` -/
abbrev colon : UInt16 := 0x3A
/-- `?` -/
abbrev qm : UInt16 := 0x3F
/-- `@` -/
abbrev atSign : UInt16 := 0x40
/-- `[` -/
abbrev lbrack : UInt16 := 0x5B
/-- `\` -/
abbrev bslash : UInt16 := 0x5C
/-- `]` -/
abbrev rbrack : UInt16 := 0x5D
/-- `` ` `` -/
abbrev bq : UInt16 := 0x60
/-- `{` -/
abbrev lbrace : UInt16 := 0x7B
/-- `|` -/
abbrev bar : UInt16 := 0x7C
/-- `}` -/
abbrev rbrace : UInt16 := 0x7D
/-- `~` -/
abbrev tilde : UInt16 := 0x7E
end U

/-- `ch === '[' || ch === '(' || ch === '{'`。 -/
@[inline] def isOpen (u : UInt16) : Bool := u == U.lbrack || u == U.lparen || u == U.lbrace

/-- `ch === ']' || ch === ')' || ch === '}'`。 -/
@[inline] def isClose (u : UInt16) : Bool := u == U.rbrack || u == U.rparen || u == U.rbrace

/-- Int の等しさ（`decide (a = b)`）。Lean 4.36 の Int の `==` は順序の包み（instLinearOrderPackage）から来て Classical.choice に
依るので、DecidableEq（Int.decEq、公理なし）で比べる。 -/
@[inline] def intEq (a b : Int) : Bool := decide (a = b)

/-- JS の `s.split(' ')` の最後の要素（最後の空白の後ろ、空白が無ければ全部）。後ろから1単位ずつ見る。 -/
def lastWord (s : JStr) : JStr := s.sliceFrom (go s.size)
where
  go : Nat → Nat
    | 0 => 0
    | e + 1 => if s.getD e 0 == U.sp then e + 1 else go e

/-- `s.replace(/^ +/, '')`。 -/
def dropLeadingSpaces (s : JStr) : JStr := s.sliceFrom (s.skipWhile (· == U.sp) 0)

/-- `/^ *\?/.test(s)`。 -/
def startsSpacesQuestion (s : JStr) : Bool := s.isAt (s.skipWhile (· == U.sp) 0) U.qm

/-! ## 演算子の表（operator_table.js） -/

/--
operator_table.js:14 の `OPERATOR_BY_PRECEDENCE` の、綴りと位置（position）の欄。段は並びの添字＋1。
構文の前処理が読むのは、綴りと位置だけ（getStrictInfixOperators と endsWithInfixOperator）。綴りはどれも ASCII。
-/
def OPERATOR_BY_PRECEDENCE : List (List (JStr × JStr)) := [
  [("\\n", "infix"), ("#", "prefix"), ("##", "prefix"), ("###", "prefix")],                      -- 1
  [(":", "infix")],                                                                              -- 2
  [("?", "infix")],                                                                              -- 3
  [("#", "infix")],                                                                              -- 4
  [(";", "infix")],                                                                              -- 5
  [("|", "infix")],                                                                              -- 6
  [("&", "infix")],                                                                              -- 7
  [("===", "infix"), ("==", "infix"), ("!==", "infix")],                                         -- 8
  [(",", "infix")],                                                                              -- 9
  [],                                                                                            -- 10
  [(" ", "infix")],                                                                              -- 11
  [("~", "infix"), ("~+", "infix"), ("~-", "infix"), ("~*", "infix"), ("~/", "infix"), ("~^", "infix")], -- 12
  [("<", "infix"), ("<=", "infix"), ("=", "infix"), (">=", "infix"), (">", "infix"), ("!=", "infix")],   -- 13
  [("+", "infix"), ("-", "infix")],                                                              -- 14
  [("*", "infix"), ("/", "infix"), ("%", "infix")],                                              -- 15
  [("^", "infix")],                                                                              -- 16
  [],                                                                                            -- 17
  [("'", "infix"), ("@", "infix")],                                                              -- 18
  [("<<", "infix"), (">>", "infix")],                                                            -- 19
  [("||", "infix")],                                                                             -- 20
  [(";;", "infix")],                                                                             -- 21
  [("&&", "infix")],                                                                             -- 22
  [("!", "postfix"), ("~", "postfix")],                                                          -- 23
  [("~", "prefix"), ("!", "prefix"), ("$", "prefix"), ("@", "prefix"), ("!!", "prefix"), ("-", "prefix")], -- 24
  [("@", "postfix")],                                                                            -- 25
  [("(...)", "enclosure"), ("{...}", "enclosure"), ("[...]", "enclosure"), ("|...|", "enclosure"),
    ("||...||", "enclosure")],                                                                   -- 26
  [("\t", "prefix")],                                                                            -- 27
  [("\\", "prefix")]                                                                             -- 28
]

/--
operator_table.js:142-159 の `OPERATOR_DICT`：綴り → 位置の並び（段の順）。綴りの並びは JS の物の鍵の順（初めて出た順。
どの綴りも整数の形でないので、挿入の順のまま）。
-/
def OPERATOR_DICT : List (JStr × List JStr) :=
  OPERATOR_BY_PRECEDENCE.foldl (fun d stage => stage.foldl add d) []
where
  add (d : List (JStr × List JStr)) (e : JStr × JStr) : List (JStr × List JStr) :=
    if d.any (fun p => p.1 == e.1) then d.map (fun p => if p.1 == e.1 then (p.1, p.2 ++ [e.2]) else p) else d ++ [(e.1, [e.2])]

/-- operator_table.js:161 の `getStrictInfixOperators`：位置が中置だけの綴り（`' '`・`|`・`||` を除く）。 -/
def getStrictInfixOperators : List JStr :=
  (OPERATOR_DICT.filter fun (p : JStr × List JStr) => !(p.1 == " " || p.1 == "|" || p.1 == "||") && p.2.all (· == "infix")).map (·.1)

/--
operator_table.js:179 の `strictInfix.sort((a, b) => b.length - a.length)`（安定な並べ替え。単位の数の長い順、同じ長さは元の順）。
-/
def sortByLengthDesc (l : List JStr) : List JStr := l.foldl (fun acc s => ins s acc) []
where
  ins (s : JStr) : List JStr → List JStr
    | [] => [s]
    | t :: ts => if t.size ≥ s.size then t :: ins s ts else s :: t :: ts

/-- buildLexerRegex（operator_table.js:176）の第2の組の選択肢の並び。 -/
def lexerOperators : List JStr := sortByLengthDesc getStrictInfixOperators

#guard lexerOperators == ([ "===", "!==", "\\n", "==", "~+", "~-", "~*", "~/", "~^", "<=", ">=", "!=", "<<", ">>", ";;",
  "&&", ":", "?", ";", "&", ",", "<", "=", ">", "+", "*", "/", "%", "^", "'"] : List JStr)

/-! ## separateInfix（lexer.js:26） -/

/-- 正規表現の当たり：第1の組（protect、終わりの位置）か第2の組（operator、綴り）。 -/
inductive Hit where
  | protect (stop : Nat)
  | operator (op : JStr)

/-- 第2の組 `(===|!==|\\n|==|…|')`：並びの順で、`a` の `i` から並ぶ最初の綴り。 -/
def operatorAt (a : JStr) (i : Nat) : Option Hit :=
  (lexerOperators.find? (fun op => a.startsWithAt op i)).map Hit.operator

/-- 正規表現の `.`（u の印が無いので1単位。LineTerminator の4つ以外の単位で、サロゲートの片方にも当たる）。 -/
def isDotChar (c : UInt16) : Bool := !(c == U.lf || c == U.cr || c == 0x2028 || c == 0x2029)

/--
第1の組の3つ目 `"(?:\\.|[^"\r\n])*"` の、`i`（`"` の位置）からの当たりの終わり（当たらなければ `none`）。単位で読む
（`.`・`[^"\r\n]` は1単位）。

JS の正規表現は後戻りで探す：各回はまず `\\.`、だめなら `[^"\r\n]`、それもだめなら閉じの `"` を試す。どの道でも、`"` の前に
CR・LF が無ければ当たる（全部を `[^"\r\n]` で取る道がある）。だから当たるのは、i+1 から最初の CR・LF（か終わり）までに `"` が
あるときだけで、その最後の `"` を `lastQ` とすると、最初に見つかる道は「`\` の次が `.` に当たる単位で、2単位取った後に
まだ `lastQ` が残る（p + 2 ≤ lastQ）なら `\\.`、でなければ1単位」で前から進み、境目に来た最初の `"` で閉じる道である
（`\\.` を取って先で行き詰まる道は、後戻りで1単位の道に戻る。その先に閉じが残るのは p + 2 ≤ lastQ のときだけ）。
-/
def dquoteEnd (a : JStr) (i : Nat) : M (Option Nat) := do
  let L := a.skipWhile (fun c => c != U.cr && c != U.lf) (i + 1)
  match lastQuote L (L - (i + 1)) none (i + 1) with
  | none => return none
  | some q => return some (← walk q (a.size + 1) (i + 1))
where
  /-- [k, L) の最後の `"`（1単位ずつ進む）。 -/
  lastQuote (L : Nat) : Nat → Option Nat → Nat → Option Nat
    | 0, last, _ => last
    | r + 1, last, k => lastQuote L r (if a.isAt k U.dq then some k else last) (k + 1)
  walk (q : Nat) : Nat → Nat → M Nat
    | 0, _ => outOfFuel "separateInfix（\"…\" の当たり）"
    | fuel + 1, p =>
      match a.get? p with
      | some c =>
        if c == U.dq then pure (p + 1)
        else if c == U.bslash then
          if (match a.get? (p + 1) with | some d => isDotChar d | none => false) && p + 2 ≤ q then walk q fuel (p + 2)
          else walk q fuel (p + 1)
        else walk q fuel (p + 1)
      | none => internalError "separateInfix: \"…\" の当たりが終わりを越えた"

/--
`i` での正規表現の当たり（buildLexerRegex、operator_table.js:176-187）。出来上がる正規表現（g 付き、u は無い）は：

```
(`[^`\r\n]*`|`[^\r\n]*|"(?:\\.|[^"\r\n])*"|\\[\s\S]|!!)|(===|!==|\\n|==|~\+|~-|~\*|~\/|~\^|<=|>=|!=|<<|>>|;;|&&|:|\?|;|&|,|<|=|>|\+|\*|\/|%|\^|')
```

選択肢を左から試し、最初に当たった物を取る。第1の組の選択肢は頭の単位で分かれる（`` ` ``・`"`・`\`・`!`）。
- `` ` ``：1つ目は次の `` ` `` が CR・LF より前にあれば当たり、無ければ2つ目が CR・LF（か終わり）まで取る。だから `` ` `` は必ず当たる。
- `"`：`dquoteEnd`。当たらなければ第2の組へ（`"` で始まる綴りは無い）。
- `\`：次の単位があれば2単位（`[\s\S]` は何でも1単位。BMP の外の字なら上の半分）。無ければ第2の組（`\\n` も当たらない）。
  第2の組の `\\n` はいつも第1の組に先を取られる。
- `!!`：第2の組の `!==`・`!=` より先。
-/
def matchAt (a : JStr) (i : Nat) : M (Option Hit) := do
  match a.get? i with
  | none => return none
  | some c =>
    if c == U.bq then
      let k := a.skipWhile (fun c => c != U.bq && c != U.cr && c != U.lf) (i + 1)
      return some (.protect (if a.isAt k U.bq then k + 1 else k))
    else if c == U.dq then
      match ← dquoteEnd a i with
      | some j => return some (.protect j)
      | none => return operatorAt a i
    else if c == U.bslash then
      return (if i + 1 < a.size then some (.protect (i + 2)) else operatorAt a i)
    else if c == U.bang && a.isAt (i + 1) U.bang then
      return some (.protect (i + 2))
    else
      return operatorAt a i

/--
lexer.js:26 の `separateInfix`：`input.replace(lexerRegex, …)`。左から探し、当たった所を置き換え、当たりの終わりから続ける
（g の置き換え。どの選択肢も1単位以上取るので、空の当たりは無い。当たらない位置は1単位進む）。protect はそのまま、operator は
前後に空白を1つずつ置く。
-/
def separateInfix (input : JStr) : M JStr :=
  go input (input.size + 1) 0 JStr.empty
where
  go (a : JStr) : Nat → Nat → JStr → M JStr
    | 0, _, _ => outOfFuel "separateInfix"
    | fuel + 1, i, out => do
      match a.get? i with
      | none => pure out
      | some c =>
        match ← matchAt a i with
        | some (.protect j) => go a fuel j (out ++ a.slice i j)
        | some (.operator op) => go a fuel (i + op.size) (out ++ " " ++ op ++ " ")
        | none => go a fuel (i + 1) (out.push c)

/-! ## classifyNewlinesWithComments（lexer.js:81） -/

/-- 最初の走査の結果。`commentLines` は処理行の番号 → 読み捨てたコメントの行か（JS の Set の写し）、`sourceLines` は処理行の番号 → 元の行。 -/
structure Classified where
  text : JStr
  commentLines : Array Bool
  sourceLines : Array Nat

/-- lexer.js:87 の `newlineWidth`。 -/
def newlineWidth (a : JStr) (k : Nat) : Nat :=
  match a.get? k with
  | some c => if c == U.cr then (if a.isAt (k + 1) U.lf then 2 else 1) else if c == U.lf then 1 else 0
  | none => 0

/-- lexer.js:147 の `isCommentAt`：行頭のバッククォートがコメントの始まりか。 -/
def isCommentAt (a : JStr) (j : Nat) : Bool :=
  let k := a.skipWhile (fun c => c != U.bq && c != U.cr && c != U.lf) (j + 1)
  if !a.isAt k U.bq then true
  else
    match a.get? (k + 1) with
    | some c => !(c == U.atSign || c == U.tilde || c == U.bang || c == U.sp)
    | none => true

/-- lexer.js:126 の文字列の中の走査（`"…"` の中の `\` は次の単位と組む）。 -/
def scanString (a : JStr) (ch : UInt16) : Nat → Nat → M Nat
  | 0, _ => outOfFuel "classifyNewlinesWithComments（文字列）"
  | fuel + 1, k =>
    match a.get? k with
    | none => pure k
    | some c =>
      if c == ch || newlineWidth a k != 0 then pure k
      else
        scanString a ch fuel
          (k + (if ch == U.dq && c == U.bslash && k + 1 < a.size && newlineWidth a (k + 1) == 0 then 2 else 1))

/-- classifyNewlinesWithComments の走査の状態（lexer.js:82-91 の変数）。`lineNo` はいつも `sourceLines.size - 1`。 -/
structure CState where
  i : Nat
  out : JStr
  lineNo : Nat
  sourceLine : Nat
  sourceLines : Array Nat
  commentLines : Array Bool
  lineStart : Bool
  bracketDepth : Int

/--
lexer.js:81 の `classifyNewlinesWithComments`：改行を CR（処理の区切り）と LF（`\` と組んだ文字の改行）に分け、行頭のコメントを
読み捨てる。閉じない `` ` `` は SyntaxError（line は今の元の行）。
-/
def classifyNewlinesWithComments (input : JStr) : M Classified :=
  loop input (input.size + 1)
    { i := 0, out := JStr.empty, lineNo := 0, sourceLine := 1, sourceLines := #[1], commentLines := #[false], lineStart := true,
      bracketDepth := 0 }
where
  loop (a : JStr) : Nat → CState → M Classified
    | 0, _ => outOfFuel "classifyNewlinesWithComments"
    | fuel + 1, st => do
      match a.get? st.i with
      | none => pure { text := st.out, commentLines := st.commentLines, sourceLines := st.sourceLines }
      | some ch =>
        let isComment := st.lineStart && st.bracketDepth ≤ 0 && ch == U.bq && isCommentAt a st.i
        let st := { st with lineStart := false }
        if isComment then
          -- while (i < n && !newlineWidth(i)) i++
          let i := a.skipWhile (fun c => c != U.cr && c != U.lf) st.i
          loop a fuel { st with i := i, commentLines := st.commentLines.setIfInBounds st.lineNo true }
        else
          let w := newlineWidth a st.i
          if w != 0 then
            loop a fuel
              { st with out := st.out.push U.cr, lineNo := st.lineNo + 1, sourceLine := st.sourceLine + 1,
                        sourceLines := st.sourceLines.push (st.sourceLine + 1),
                        commentLines := st.commentLines.push false, i := st.i + w, lineStart := true }
          else if ch == U.bslash then
            let w2 := if st.i + 1 < a.size then newlineWidth a (st.i + 1) else 0
            if w2 != 0 then
              let i := a.skipWhile (· == U.tab) (st.i + 1 + w2)
              loop a fuel { st with out := st.out ++ "\\\n", i := i, sourceLine := st.sourceLine + 1 }
            else
              loop a fuel { st with out := st.out ++ a.slice st.i (st.i + 2), i := st.i + 2 }
          else if ch == U.bq || ch == U.dq then
            let k ← scanString a ch (a.size + 1) (st.i + 1)
            if a.isAt k ch then
              loop a fuel { st with out := st.out ++ a.slice st.i (k + 1), i := k + 1 }
            else if ch == U.bq then
              -- input.slice(i).search(/[\r\n]/)：u の印が無いので単位の位置。
              let lineEnd := a.skipWhile (fun c => c != U.cr && c != U.lf) st.i
              throw { name := "SyntaxError", reason := none, line := some st.sourceLine,
                      message := "文字列が行の終わりまでに閉じていません（文字列は行をまたげません）: " ++
                        JStr.jsonStringify (a.slice st.i lineEnd) }
            else
              loop a fuel { st with out := st.out ++ a.slice st.i k, i := k }
          else
            let bd : Int := if isOpen ch then st.bracketDepth + 1
              else if isClose ch then st.bracketDepth - 1 else st.bracketDepth
            loop a fuel { st with bracketDepth := bd, out := st.out.push ch, i := st.i + 1 }

/-! ## markBlock の道具（lexer.js:155-519） -/

/-- lexer.js:160 の `bracketDelta`：1行の括りの深さの増減（文字列と `\` の組は数えない。閉じない引用符の後は読み飛ばす）。 -/
def bracketDelta (content : JStr) : M Int :=
  go content (content.size + 1) 0 0
where
  go (a : JStr) : Nat → Nat → Int → M Int
    | 0, _, _ => outOfFuel "bracketDelta"
    | fuel + 1, i, depth =>
      match a.get? i with
      | none => pure depth
      | some ch =>
        if ch == U.bslash then go a fuel (i + 2) depth
        else if ch == U.bq || ch == U.dq then
          match a.indexOfUnit ch (i + 1) with
          | none => pure depth
          | some close => go a fuel (close + 1) depth
        else if isOpen ch then go a fuel (i + 1) (depth + 1)
        else if isClose ch then go a fuel (i + 1) (depth - 1)
        else go a fuel (i + 1) depth

/-- lexer.js:221 の `QUESTION_ROW_RULE`。 -/
def QUESTION_ROW_RULE : JStr :=
  "`?` で始まる行は、定義の行から1段だけ字下げします（仮引数のブロックは2段、`?` は1段、本体のブロックも2段。" ++
  "仮引数を定義の行に並べたときも `?` の行は1段。括りの仮引数を複数の行に書いたら `?` は閉じの次の行）。"

/-- 段の置き場（lexer.js:416 の placeOfBlock が返す文字列と、openFrames の `'bracket'`）。 -/
inductive Place where
  | top | body | field | param | default | other | bracket
  deriving DecidableEq, Repr, Inhabited

/-- 書いた行の段（lexer.js:558 の `written` の要素）。 -/
structure Written where
  depth : Nat
  opened : Bool
  place : Place
  deriving Inhabited

/-- `written` の後ろから、深さが q 以下の最後の添字（lexer.js:226-227 の `while (k >= 0 && written[k].depth > q) k--`）。 -/
def lastAtMost (w : Array Written) (q : Nat) : Option Nat := go w.size
where
  go : Nat → Option Nat
    | 0 => none
    | n + 1 =>
      match w[n]? with
      | some x => if x.depth > q then go n else some n
      | none => none

/-- lexer.js:225 の `refuseMisplacedQuestionRow`：`?` で始まる行の字下げの門。 -/
def refuseMisplacedQuestionRow (content : JStr) (q depth : Nat) (written : Array Written) : M Unit := do
  let k := lastAtMost written q
  let at_ : Int := match k with
    | some k => match written[k]? with | some x => (x.depth : Int) | none => -1
    | none => -1
  let deeper := match k with | some k => written[k + 1]? | none => written[0]?
  let qi : Int := q
  if q ≥ 1 && intEq at_ (qi - 1) && (match deeper with | none => true | some d => d.depth == q + 1 && d.opened) then
    return ()
  let where_ : JStr ← do
    if intEq at_ qi then
      pure (if q == depth then
        "直前の行と同じ深さなので、その行の続きになります（仮引数の行と同じ深さなら、最後の仮引数の行に付きます）"
      else "同じ深さに書いた行（定義の行）の続きになります")
    else if at_ < 0 then pure "その上に書いた行がありません"
    else if at_ < qi - 1 then
      pure ("その上に書いた行（TAB " ++ JStr.ofInt at_ ++ " 個）から " ++ JStr.ofInt (qi - at_) ++ " 段下がっています")
    else
      match deeper with
      | some d =>
        if d.depth != q + 1 then
          pure ("定義の行（TAB " ++ JStr.ofInt at_ ++ " 個）から1段ですが、仮引数の行が定義の行から " ++
            JStr.ofInt ((d.depth : Int) - at_) ++ " 段下がっています（仮引数の行は2段）")
        else
          pure ("定義の行（TAB " ++ JStr.ofInt at_ ++ " 個）から1段ですが、仮引数の行が定義の行から2段の所で始まっていません" ++
            "（字下げを跳んで深く書いた行の後に、2段の行を書いています）")
      | none =>
        -- JS なら deeper.depth で TypeError。上の return に当たるので来ない。
        throw { name := "TypeError", reason := none, line := none,
                message := "Cannot read properties of undefined (reading 'depth')" }
  operationError "question-row-indent"
    (QUESTION_ROW_RULE ++ "この行（TAB " ++ JStr.ofNat q ++ " 個の `" ++ content ++ "`）は" ++ where_)

/-- lexer.js:253 の `questionAfterClose`：括りの中で始まった行が、括りの外（深さ 0）へ出た後に `?` を書いているか。 -/
def questionAfterClose (content : JStr) (depth : Int) : M Bool :=
  go content (content.size + 1) 0 depth
where
  go (a : JStr) : Nat → Nat → Int → M Bool
    | 0, _, _ => outOfFuel "questionAfterClose"
    | fuel + 1, i, depth =>
      match a.get? i with
      | none => pure false
      | some ch =>
        if ch == U.bslash then go a fuel (i + 2) depth
        else if ch == U.bq || ch == U.dq then
          match a.indexOfUnit ch (i + 1) with
          | none => pure false
          | some close => go a fuel (close + 1) depth
        else if isOpen ch then go a fuel (i + 1) (depth + 1)
        else if isClose ch then go a fuel (i + 1) (depth - 1)
        else if ch == U.qm && depth ≤ 0 then pure true
        else go a fuel (i + 1) depth

/-- Object.prototype の自分の名前（node v24 の `Object.getOwnPropertyNames(Object.prototype)`）。`OPERATOR_DICT[w]` はこれらで物を返す。 -/
def OBJECT_PROTOTYPE_KEYS : List JStr :=
  ["constructor", "__defineGetter__", "__defineSetter__", "hasOwnProperty", "__lookupGetter__", "__lookupSetter__",
    "isPrototypeOf", "propertyIsEnumerable", "toString", "valueOf", "__proto__", "toLocaleString"]

/--
lexer.js:284 の `endsWithInfixOperator`：補った後の綴りで、最後の語が中置の意味を持つ演算子か。

`OPERATOR_DICT` は JS のただの物なので、最後の語が Object.prototype の名前（`toString` など）だと `defs` は関数か物になり、
`defs.some` が無いので TypeError（"defs.some is not a function"）で止まる。その写し。鍵の比べは単位ごと（JS の物の鍵の比べ）。
-/
def endsWithInfixOperator (text : JStr) : M Bool := do
  let w := lastWord (JStr.trimEnd (← separateInfix text))
  match JStr.lookup w OPERATOR_DICT with
  | some defs => return defs.any (· == "infix")
  | none =>
    if OBJECT_PROTOTYPE_KEYS.any (· == w) then
      throw { name := "TypeError", reason := none, line := none, message := "defs.some is not a function" }
    else return false

/-- lexer.js:291 の `quoted`：`s.replace(/ {2,}/g, ' ').replace(/\n/g, '\\n')`（1単位ずつ、残りの数で構造の再帰）。 -/
def quoted (s : JStr) : JStr := go 0 false JStr.empty s.size
where
  go (k : Nat) (prevSp : Bool) (out : JStr) : Nat → JStr
    | 0 => out
    | r + 1 =>
      let c := s.getD k 0
      if c == U.sp && prevSp then go (k + 1) true out r
      else go (k + 1) (c == U.sp) (if c == U.lf then out ++ "\\n" else out.push c) r

/-- lexer.js:293 の `refuseBlockAfterValue`。 -/
def refuseBlockAfterValue (logical content : JStr) (q : Nat) : M Unit :=
  operationError "block-after-value"
    ("字下げのブロックは、中置の演算子（`:`・`?` を含む）の右にだけ置けます。この行（TAB " ++ JStr.ofNat q ++ " 個の `" ++
      quoted content ++ "`）は、" ++
      "値や語、または前置・後置にしかならない演算子で終わる行（`" ++ quoted logical ++ "`）の下で字下げを深くしています。" ++
      "前の行の余積を続けるなら（括りを渡すときも）TAB の後に空白を置きます。")

/-- lexer.js:318 の `/^\|\|?[^|]/.test(word)`（`[^|]` は1単位）。 -/
def opensEnclosure (w : JStr) : Bool :=
  w.isAt 0 U.bar &&
    (match w.get? 1 with
     | some c => c != U.bar || (match w.get? 2 with | some d => d != U.bar | none => false)
     | none => false)

/-- lexer.js:319 の `/[^|]\|\|?$/.test(word)`（`[^|]` は1単位。`$` は終わりだけ）。 -/
def closesEnclosure (w : JStr) : Bool :=
  let n := w.size
  n ≥ 2 && w.isAt (n - 1) U.bar && (w.getD (n - 2) 0 != U.bar || (n ≥ 3 && w.getD (n - 3) 0 != U.bar))

/-- lexer.js:316 の `countEnclosure`。 -/
def countEnclosure (word : JStr) (depth : Int) : Int :=
  if word == "|" || word == "||" then depth
  else
    let depth := if opensEnclosure word then depth + 1 else depth
    if closesEnclosure word then depth - 1 else depth

/-- lexer.js:311 の `hasTopLevelDefine`：いちばん外の行に、括り（と `|…|`・`||…||` の囲み）の外の `:` があるか。 -/
def hasTopLevelDefine (text : JStr) : M Bool := do
  let a ← separateInfix text
  go a (a.size + 1) 0 0 JStr.empty
where
  go (a : JStr) : Nat → Nat → Int → JStr → M Bool
    | 0, _, _, _ => outOfFuel "hasTopLevelDefine"
    | fuel + 1, i, depth, word =>
      match a.get? i with
      | none => pure (intEq depth 0 && word == ":")
      | some ch =>
        if ch == U.bslash then go a fuel (i + 2) depth (word ++ a.slice i (i + 2))
        else if ch == U.bq || ch == U.dq then
          match a.indexOfUnit ch (i + 1) with
          | none => pure false
          | some close => go a fuel (close + 1) depth (word ++ a.slice i (close + 1))
        else if ch == U.sp || isOpen ch || isClose ch then
          if intEq depth 0 && word == ":" then pure true
          else
            let depth := countEnclosure word depth
            let depth := if isOpen ch then depth + 1 else if ch != U.sp then depth - 1 else depth
            go a fuel (i + 1) depth JStr.empty
        else go a fuel (i + 1) depth (word.push ch)

/-- lexer.js:350 の `refuseMissingBlankLine`。 -/
def refuseMissingBlankLine (definition content : JStr) : M Unit :=
  operationError "definition-end-blank-line"
    ("いちばん外の定義が字下げのブロックで終わったら、空行を1行置いてから次の行を書きます。定義（`" ++ quoted definition ++
      "`）の後の、" ++ "この行（`" ++ quoted content ++ "`）の前に空行がありません。")

/-- lexer.js:358 の `refuseQuestionAfterClose`。 -/
def refuseQuestionAfterClose (content : JStr) (q : Nat) : M Unit :=
  operationError "question-row-indent"
    (QUESTION_ROW_RULE ++ "この行（TAB " ++ JStr.ofNat q ++ " 個の `" ++ content ++ "`）は複数の行に書いた括りを閉じた行で、閉じの後ろに `?` を続けています" ++
      "——`?` は閉じの次の行の頭に置きます")

/-- 括りの中に書いた行（lexer.js:609 の `{ t, c }`）。 -/
structure FrameRow where
  t : Nat
  c : JStr
  deriving Inhabited

/-- 開いている括りの控え（lexer.js:391 の物）。`at_` は JS の `at`（`head` の単位の位置）。 -/
structure Frame where
  k : Nat
  head : JStr
  at_ : Nat
  endsOpen : Bool
  place : Place
  rows : Array FrameRow
  more : JStr
  deriving Inhabited

/--
lexer.js:375 の `openFrames`：1行を読んで、開いている括りの控えを積み・降ろす。

JS の `last` は、この呼び出しで最後に積んだ控え（降ろしたら null）。積んだ控えはいつも積みの頂きにあり、降ろすのは頂きだけなので、
`done === last` は「`last` が null でない」と同じ。ここでは `last` をその真偽で持つ。
-/
def openFrames (frames : Array Frame) (content : JStr) (k : Nat) (place : Place) : M (Array Frame) := do
  let (frames, last) ← go content (content.size + 1) 0 frames false
  match frames.back? with
  | some top =>
    if last && (content.sliceFrom (top.at_ + 1)).trim.isEmpty then
      return frames.modify (frames.size - 1) (fun f => { f with endsOpen := true })
    else return frames
  | none => return frames
where
  go (a : JStr) : Nat → Nat → Array Frame → Bool → M (Array Frame × Bool)
    | 0, _, _, _ => outOfFuel "openFrames"
    | fuel + 1, i, frames, last =>
      match a.get? i with
      | none => pure (frames, last)
      | some ch =>
        if ch == U.bslash then go a fuel (i + 2) frames last
        else if ch == U.bq || ch == U.dq then
          match a.indexOfUnit ch (i + 1) with
          | none => pure (frames, last)
          | some close => go a fuel (close + 1) frames last
        else if isOpen ch then
          let f : Frame := { k, head := content, at_ := i, endsOpen := false,
                             place := if frames.size > 0 then .bracket else place, rows := #[], more := JStr.empty }
          go a fuel (i + 1) (frames.push f) true
        else if isClose ch then
          let done := frames.back?
          let frames := frames.pop
          let last := if done.isSome then false else last
          -- 行を跨いだ内の括りを閉じたら、その中身を外の括りの控え（lexer.js:398 の `parent`、積みの頂き）へ戻す（:399-402）。
          -- 頂きは `frames.modify` の中で書き換える。頂きを積みから取り出して書くので、控えの行の並びも最後の行も共有されず
          -- その場で書け、閉じ1つの費用は戻す中身（`text`）の長さだけ。
          let frames :=
            match done with
            | some d =>
              if frames.size > 0 && (d.rows.size > 0 || !d.more.isEmpty) then
                let text := JStr.intercalate " " ((d.more.trim :: d.rows.toList.map (·.c)).filter (fun t => !t.isEmpty))
                frames.modify (frames.size - 1) fun parent =>
                  if parent.rows.size > 0 then
                    { parent with rows := parent.rows.modify (parent.rows.size - 1) (fun r => { r with c := r.c ++ " " ++ text }) }
                  else { parent with more := parent.more ++ " " ++ text }
              else frames
            | none => frames
          go a fuel (i + 1) frames last
        else go a fuel (i + 1) frames last

/-- 段の置き場の、上の段（`parent`）から決まる所（lexer.js:416 の `placeOfBlock`）。 -/
def placeOfBlock (parent : Option Written) (depth : Nat) (logical : JStr) (opened : Bool) : M Place := do
  if depth == 0 then return .top
  match parent with
  | none => return .other
  | some parent =>
    if !opened then return .other
    let op := lastWord (JStr.trimEnd (← separateInfix logical))
    if op == "?" then return .body
    if op != ":" then return .other
    let d : Int := (depth : Int) - parent.depth
    if parent.place == .body then return .body
    if parent.place == .param then return (if intEq d 2 then .param else .default)
    if parent.place != .top && parent.place != .field then return .other
    return (if intEq d 1 then .field else if intEq d 2 then .param else .other)

/-- lexer.js:430 の `cutAtClose`：括りの閉じの手前まで（その括りより外へ出たら切る）。1単位ずつ、残りの数で構造の再帰。 -/
def cutAtClose (s : JStr) : JStr := go 0 0 s.size
where
  go (i : Nat) (depth : Int) : Nat → JStr
    | 0 => s.trim
    | r + 1 =>
      let ch := s.getD i 0
      if isOpen ch then go (i + 1) (depth + 1) r
      else if isClose ch then
        if depth - 1 < 0 then (s.slice 0 i).trim else go (i + 1) (depth - 1) r
      else go (i + 1) depth r

/-- lexer.js:443 の `questionBeforeBracket`：括りを開いた行で、その括り（位置 at）より前に、その括りを囲む所の `?` があるか。 -/
def questionBeforeBracket (head : JStr) (at_ : Nat) : M Bool :=
  go head (at_ + 1) 0 #[false]
where
  go (a : JStr) : Nat → Nat → Array Bool → M Bool
    | 0, _, _ => outOfFuel "questionBeforeBracket"
    | fuel + 1, i, open_ =>
      if i < at_ then
        match a.get? i with
        | some ch =>
          if ch == U.bslash then go a fuel (i + 2) open_
          else if ch == U.bq || ch == U.dq then
            match a.indexOfUnit ch (i + 1) with
            | none => pure (open_.contains true)
            | some close => if close ≥ at_ then pure (open_.contains true) else go a fuel (close + 1) open_
          else if isOpen ch then go a fuel (i + 1) (open_.push false)
          else if isClose ch then
            go a fuel (i + 1) (if open_.size > 1 then open_.pop else open_.setIfInBounds 0 false)
          else if ch == U.qm then go a fuel (i + 1) (open_.setIfInBounds (open_.size - 1) true)
          else go a fuel (i + 1) open_
        | none => go a fuel (i + 1) open_
      else pure (open_.contains true)

/-- `content.replace(/^ *\? */, '')`。 -/
def dropQuestionPrefix (s : JStr) : JStr :=
  let k := s.skipWhile (· == U.sp) 0
  if s.isAt k U.qm then s.sliceFrom (s.skipWhile (· == U.sp) (k + 1)) else s

/-- `/^#*[A-Za-z_][A-Za-z0-9_]* *:$/.test(r)`（欄の行 `m :`。`$` は終わりだけ）。 -/
def isFieldRow (r : JStr) : Bool :=
  let k0 := r.skipWhile (· == U.hash) 0
  match r.get? k0 with
  | some c =>
    isIdentStart c &&
      (let k2 := r.skipWhile (· == U.sp) (r.skipWhile isIdentChar (k0 + 1))
       r.isAt k2 U.colon && k2 + 1 == r.size)
  | none => false
where
  isIdentStart (c : UInt16) : Bool :=
    let n := c.toNat
    (0x41 ≤ n && n ≤ 0x5A) || (0x61 ≤ n && n ≤ 0x7A) || n == 0x5F
  isIdentChar (c : UInt16) : Bool := isIdentStart c || (0x30 ≤ c.toNat && c.toNat ≤ 0x39)

/-- `r.replace(/ *:$/, '')`（終わりの `:` と、その前の空白を除く）。 -/
def dropFieldColon (r : JStr) : JStr :=
  if r.size > 0 && r.isAt (r.size - 1) U.colon then
    let p := r.slice 0 (r.size - 1)
    p.slice 0 (p.endWhile (· == U.sp))
  else r

/--
`f.head.match(/^(#*[A-Za-z_][A-Za-z0-9_]*) *: *\$?[[({]/)` の、組1（名前）と当たりの長さ（単位の数）。
綴りの類は重ならないので後戻りは要らない（`\$?` は次が括りでなければ空に戻り、その位置の `$` は括りでないので外れる）。
-/
def headDefOpen (head : JStr) : Option (JStr × Nat) :=
  let k0 := head.skipWhile (· == U.hash) 0
  match head.get? k0 with
  | some c =>
    if isFieldRow.isIdentStart c then
      let k1 := head.skipWhile isFieldRow.isIdentChar (k0 + 1)
      let k2 := head.skipWhile (· == U.sp) k1
      if head.isAt k2 U.colon then
        let k3 := head.skipWhile (· == U.sp) (k2 + 1)
        match head.get? k3 with
        | some ch =>
          if ch == U.dollar then
            match head.get? (k3 + 1) with
            | some ch2 => if isOpen ch2 then some (head.slice 0 k1, k3 + 2) else none
            | none => none
          else if isOpen ch then some (head.slice 0 k1, k3 + 1) else none
        | none => none
      else none
    else none
  | none => none

/-- `/ : *\$?$/.test(s)`（` :` の後が空白と、あれば `$` 1つで終わる）。 -/
def endsWithColonValue (s : JStr) : Bool :=
  let e := if s.size > 0 && s.isAt (s.size - 1) U.dollar then s.size - 1 else s.size
  let e := (s.slice 0 e).endWhile (· == U.sp)
  e ≥ 2 && s.isAt (e - 1) U.colon && s.isAt (e - 2) U.sp

/-- `rows.findLastIndex(p)`（無ければ none）。 -/
def findLastIndex (p : JStr → Bool) (l : List JStr) : Option Nat := go l 0 none
where
  go : List JStr → Nat → Option Nat → Option Nat
    | [], _, r => r
    | x :: xs, i, r => go xs (i + 1) (if p x then some i else r)

/-- lexer.js:467 の `refuseBracketQuestionRow`：括りの中の `?` の行を断る（R135）。言い分は形で出し分ける。いつも断る。 -/
def refuseBracketQuestionRow (f : Option Frame) (content : JStr) (q : Nat) : M Unit := do
  let body := cutAtClose (dropQuestionPrefix content)
  let head : JStr := match f with | some f => f.head.trim | none => JStr.empty
  let tail : JStr := match f with | some f => cutAtClose (f.head.sliceFrom (f.at_ + 1) ++ f.more) | none => JStr.empty
  let rows : List JStr :=
    ((if !tail.isEmpty then [tail] else []) ++ (match f with | some f => f.rows.toList.map (fun r => cutAtClose r.c) | none => [])).filter
      (fun t => !t.isEmpty)
  let prev := rows.getLast?.getD JStr.empty
  let shape := match f with
    | some f => f.endsOpen && f.rows.size ≥ 1 && f.rows.all (fun r => r.t == f.k + 2) && q == f.k + 1
    | none => false
  let what : JStr :=
    "複数の行に書いた括り（`" ++ quoted head ++ "` の行で開いた括り）の中に、`?` で始まる行（TAB " ++ JStr.ofNat q ++ " 個の `" ++
      quoted content.trim ++ "`）があります。" ++
      "括りの中は字下げを数えないので、括りの中に `?` の行は置けません（名前の無い関数に仮引数のブロックの綴りは無い、§4 R131 の帰結1）。"
  let end_ : JStr := "文法に無い形なので、読む段で止めます（§4 R135）。"
  let refuse (guide : JStr) : M Unit := operationError "param-block-bracket" (what ++ guide ++ end_)
  let isDefRow (r : JStr) : Bool := (" " ++ r ++ " " : JStr).includes " : "
  let block (name : JStr) (ps : List JStr) : JStr :=
    "`" ++ name ++ " :` ⏎ " ++ JStr.intercalate " ⏎ " (ps.map (fun r => "`⇥⇥" ++ quoted r ++ "`")) ++ " ⏎ `⇥?" ++
      (if !body.isEmpty then " " ++ quoted body else JStr.empty) ++ "`" ++ (if !body.isEmpty then JStr.empty else " ⏎ 枝の行")
  let choose (oneLine : Option JStr) (named after : JStr) (note : JStr := JStr.empty) : M Unit :=
    refuse (match oneLine with
      | some o => "短ければ" ++ o ++ "に、長いか既定値・行に割った枝を使うなら" ++ named ++ after ++
          (if !note.isEmpty then "（" ++ note ++ "）" else JStr.empty) ++ "。"
      | none => named ++ after ++ "（既定値と、行に割った枝は名前の定義の物です" ++
          (if !note.isEmpty then "。" ++ note else JStr.empty) ++ "）。")
  -- 仮引数の無い `?` の行（括りを開いた次の行など）。
  if rows.isEmpty then refuse "仮引数を `?` の左に並べた1行の括り（`[x ? …]`）か、名前の定義にします。"
  -- 括りの中の欄の行 `m :` の下に仮引数を書いた形。
  let fieldAt : Option Nat := findLastIndex isFieldRow rows
  match fieldAt with
  | some fa =>
    if fa < rows.length - 1 then
      let field := dropFieldColon (rows.getD fa JStr.empty)
      let ps := rows.drop (fa + 1)
      let oneLine : Option JStr := if !ps.any isDefRow && !body.isEmpty then
          some ("欄の1行（`" ++ field ++ " : " ++ quoted (JStr.intercalate " " ps) ++ " ? " ++ quoted body ++ "`）") else none
      let inBody ← match f with
        | some f => if f.place == .body then pure true else questionBeforeBracket f.head f.at_
        | none => pure false
      if inBody then choose oneLine ("ファイルの名前の定義（" ++ block "名前" ps ++ "）") "にして、ここではその名前を書きます"
      choose oneLine ("字下げの欄のブロック（" ++ block field ps ++ "。字下げは欄の行から数え、括りで書いた構造体は字下げのブロックで書きます）") "にします"
  | none => pure ()
  -- 前の行が定義の行で、字下げが仮引数のブロックの形でなければ、`?` はその行の続き。
  if !shape && isDefRow prev && !body.isEmpty then
    refuse ("`?` は前の行の終わりに続けて書きます（`" ++ quoted prev ++ " ? " ++ quoted body ++ "`）。")
  let oneLine : Option JStr := if !rows.any isDefRow && !body.isEmpty then
      some ("1行の括り（`[" ++ quoted (JStr.intercalate " " rows) ++ " ? " ++ quoted body ++ "]`）") else none
  let m : Option JStr := match f with
    | some f => match headDefOpen f.head with
      | some (name, len) => if len - 1 == f.at_ then some name else none
      | none => none
    | none => none
  let place := match f with | some f => f.place | none => .other
  match m with
  | some name =>
    if place == .top then choose oneLine ("名前の定義（" ++ block name rows ++ "）") "にします"
    if place == .field then choose oneLine ("字下げの欄のブロック（" ++ block name rows ++ "。字下げは欄の行から数えます）") "にします"
  | none => pure ()
  let nested := place == .body || place == .param || place == .default
  let valueOfColon : Bool := match f with
    | some f => f.place != .default && endsWithColonValue (" " ++ f.head.slice 0 f.at_)
    | none => false
  if nested then
    choose oneLine ("ファイルの名前の定義（" ++ block "名前" rows ++ "）") "にして、ここではその名前を書きます"
      (if valueOfColon then "枝の値・既定値の値に仮引数のブロックの関数は置けません、§4 R134" else JStr.empty)
  choose oneLine ("ファイルの名前の定義（" ++ block "名前" rows ++ "）") "にして、その名前を書きます"

/-! ## markBlock（lexer.js:532） -/

/-- 処理行の中身を置いた所（lexer.js:530 の `track.segs` の要素）：出力の k 行目の col 単位目から、処理行 line の中身。 -/
structure Seg where
  k : Nat
  col : Nat
  line : Nat
  deriving Inhabited

/-- いちばん外の文（lexer.js:568 の `top`）。 -/
structure Top where
  logical : JStr
  hadBlock : Bool
  isDef : Bool

/--
markBlock の状態（lexer.js:533-568 の変数）。JS の `lastContentLineIdx` はいつも「`result` が空なら -1、でなければ最後の添字」
なので（push のたびに最後の添字にする）、`result` が空かで読む。
-/
structure MB where
  depth : Nat := 0
  result : Array JStr := #[]
  bracketDepth : Int := 0
  written : Array Written := #[]
  frames : Array Frame := #[]
  sawBlank : Bool := false
  sawComment : Bool := false
  logical : JStr := JStr.empty
  top : Top := ⟨JStr.empty, false, false⟩
  segs : Array Seg := #[]

/-- `result[lastContentLineIdx] += s`。 -/
def MB.appendLast (st : MB) (s : JStr) : MB :=
  { st with result := st.result.modify (st.result.size - 1) (· ++ s) }

/-- `result.push(s); lastContentLineIdx = result.length - 1`。 -/
def MB.pushRow (st : MB) (s : JStr) : MB :=
  { st with result := st.result.push s }

/-- `track.segs.push({ k: result.length - 1, col: result[result.length - 1].length - content.length, line: i })`（長さは単位の数）。 -/
def MB.pushSeg (st : MB) (content : JStr) (i : Nat) : MB :=
  let seg : Seg := { k := st.result.size - 1, col := (st.result.back?.map JStr.size).getD 0 - content.size, line := i }
  { st with segs := st.segs.push seg }

/-- `written.length > 0 ? written[written.length - 1].place : 'other'`。 -/
def placeOfLast (w : Array Written) : Place := match w.back? with | some x => x.place | none => .other

/-- `while (written.length > 0 && written[written.length - 1].depth > currentIndent) written.pop()`（1つずつ降ろす）。 -/
def popDeeper (w : Array Written) (currentIndent : Nat) : Array Written := go w.size w
where
  go : Nat → Array Written → Array Written
    | 0, w => w
    | n + 1, w => match w.back? with
      | some x => if x.depth > currentIndent then go n w.pop else w
      | none => w

/-- `/^[\t ]*$/.test(line)`（`$` は終わりだけ）。 -/
def isBlankLine (line : JStr) : Bool := line.skipWhile (fun c => c == U.tab || c == U.sp) 0 == line.size

/-- lexer.js:570-717 の for の1回（処理行 i）。 -/
def markLine (commentLines : Array Bool) (i : Nat) (line : JStr) (st0 : MB) : M MB := do
  let mut st := st0
  -- 行頭のコメントの行（classifyNewlines が読み捨てた行）。空行には数えない。
  if commentLines.getD i false then
    return { st with sawComment := true }
  -- 空の処理行は読み捨てる（在ったことは覚える）。
  if isBlankLine line then
    return { st with sawBlank := true }
  -- line.match(/^\t*/) と line.substring(leadingWs.length)。
  let nTabs := line.skipWhile (· == U.tab) 0
  let content := line.sliceFrom nTabs
  let startsSp := content.isAt 0 U.sp
  let mut isContinuation := startsSp || content.isAt 0 U.qm
  if startsSp && st.result.isEmpty then
    syntaxError ("行頭の空白は前の行の続きですが、続ける行がありません（字下げは TAB だけです）: " ++ JStr.jsonStringify line)
  if st.bracketDepth > 0 then
    if (← questionAfterClose content st.bracketDepth) then refuseQuestionAfterClose content nTabs
    let frame := st.frames.back?
    if startsSpacesQuestion content then refuseBracketQuestionRow frame content nTabs
    if frame.isSome && !startsSp then
      st := { st with frames := st.frames.modify (st.frames.size - 1) (fun f => { f with rows := f.rows.push ⟨nTabs, content⟩ }) }
    if isContinuation && !st.result.isEmpty then st := st.appendLast (" " ++ content)
    else st := st.pushRow content
    st := st.pushSeg content i
    st := { st with logical := if isContinuation then st.logical ++ " " ++ dropLeadingSpaces content else content }
    if !st.top.hadBlock then
      st := { st with top := { st.top with logical := st.top.logical ++ " " ++ dropLeadingSpaces content } }
    let delta ← bracketDelta content
    st := { st with sawBlank := false, sawComment := false, bracketDepth := st.bracketDepth + delta }
    if st.bracketDepth > 0 then
      let frames ← openFrames st.frames content nTabs (placeOfLast st.written)
      st := { st with frames }
    else st := { st with frames := #[] }
    return st
  let currentIndent := nTabs
  -- 式の途中にコメントは置けない。
  if isContinuation && st.sawComment then
    syntaxError ("コメントの行の後なので、前の行へ続けられません（説明は式の上に書きます）: " ++ JStr.jsonStringify line)
  -- いちばん外の空行は越えない。
  if isContinuation && st.sawBlank && (currentIndent == 0 || st.depth == 0) then
    if startsSp then
      syntaxError ("行頭の空白は前の行の続きですが、空行の後なので続ける行がありません: " ++ JStr.jsonStringify line)
    isContinuation := false
  -- いちばん外の文の始まり。
  if !isContinuation && currentIndent == 0 then
    if st.top.hadBlock && st.top.isDef && !st.sawBlank then refuseMissingBlankLine st.top.logical content
    st := { st with top := ⟨content, false, false⟩ }
  else if isContinuation && !st.top.hadBlock then
    st := { st with top := { st.top with logical := st.top.logical ++ " " ++ dropLeadingSpaces content } }
  if isContinuation && startsSpacesQuestion content && !st.result.isEmpty then
    refuseMisplacedQuestionRow content currentIndent st.depth st.written
  st := { st with written := popDeeper st.written currentIndent }
  if !isContinuation && (match st.written.back? with | none => true | some w => w.depth != currentIndent) then
    let opened := currentIndent > st.depth
    let place ← placeOfBlock st.written.back? currentIndent st.logical opened
    st := { st with written := st.written.push ⟨currentIndent, opened, place⟩ }
  -- 浅くなったら、戻った段の数だけ DEDENT（\x03）。
  if currentIndent < st.depth then
    if !st.result.isEmpty then st := st.appendLast (JStr.repeatUnit U.etx (st.depth - currentIndent))
    st := { st with depth := currentIndent }
  if isContinuation then
    if !st.result.isEmpty then st := st.appendLast (" " ++ content) else st := st.pushRow content
  else if currentIndent > st.depth then
    if !st.result.isEmpty && st.sawComment then
      syntaxError ("コメントの行の後なので、前の行の下にブロックを開けません（説明は式の上に書きます）: " ++ JStr.jsonStringify line)
    if !st.result.isEmpty && st.sawBlank && st.depth == 0 then
      syntaxError ("空行の後なので、前の行の下にブロックを開けません: " ++ JStr.jsonStringify line)
    if !st.result.isEmpty then
      if !(← endsWithInfixOperator st.logical) then refuseBlockAfterValue st.logical content currentIndent
    if st.depth == 0 then
      let isDef ← hasTopLevelDefine st.top.logical
      st := { st with top := { st.top with hadBlock := true, isDef } }
    -- 深くなったら、深くなった段の数だけ INDENT（\x02）。
    let indents := JStr.repeatUnit U.stx (currentIndent - st.depth)
    st := { st with depth := currentIndent }
    if !st.result.isEmpty then st := st.appendLast (" " ++ indents ++ content) else st := st.pushRow (indents ++ content)
  else
    st := st.pushRow content
  st := st.pushSeg content i
  st := { st with logical := if isContinuation then st.logical ++ " " ++ dropLeadingSpaces content else content,
                  sawBlank := false, sawComment := false }
  let delta ← bracketDelta content
  st := { st with bracketDepth := st.bracketDepth + delta, frames := #[] }
  if st.bracketDepth > 0 then
    let frames ← openFrames #[] content currentIndent (placeOfLast st.written)
    st := { st with frames }
  return st

/--
lexer.js:532 の `markBlock`：処理行（CR で切る）ごとに、字下げを INDENT（\x02）・DEDENT（\x03）にし、続きの行を前の行へつなぐ。
断りは、そのとき読んでいた処理行の番号（JS の `track.at`）と組で返す。成功なら出力と `track.segs`。
-/
def markBlock (input : JStr) (commentLines : Array Bool) : Except (Nat × FrontErr) (JStr × Array Seg) := do
  let st ← go (input.splitOnUnit U.cr) 0 {}
  let st := if st.depth > 0 && !st.result.isEmpty then st.appendLast (JStr.repeatUnit U.etx st.depth) else st
  return (JStr.intercalate "\r" st.result.toList, st.segs)
where
  go : List JStr → Nat → MB → Except (Nat × FrontErr) MB
    | [], _, st => pure st
    | l :: ls, i, st =>
      match markLine commentLines i l st with
      | .ok st => go ls (i + 1) st
      | .error e => .error (i, e)

/-! ## preprocessWithLines（lexer.js:736） -/

/-- lexer.js:759-762 の `for (const at = …; p < at; p++)`：p から at まで、空白でない単位と LF を数える（1単位ずつ、残りの数で構造の再帰）。 -/
def advance (m : JStr) : Nat → Nat → Nat → Nat → Nat × Nat × Nat
  | 0, p, c, l => (p, c, l)
  | r + 1, p, c, l =>
    advance m r (p + 1) (if !m.isAt p U.sp then c + 1 else c) (if m.isAt p U.lf then l + 1 else l)

/-- lexer.js:777-784 の二分探索：counts[j] ≤ n の最後の j（無ければ -1）。燃料は counts の長さ＋2（どの回も幅が1以上縮む）。 -/
def bsearch (counts : Array Nat) (n : Nat) : Nat → Int → Int → Int → M Int
  | 0, _, _, _ => outOfFuel "lineAt（二分探索）"
  | fuel + 1, lo, hi, j =>
    if lo ≤ hi then
      let mid := (lo + hi) / 2
      match counts[mid.toNat]? with
      | some cm => if cm ≤ n then bsearch counts n fuel (mid + 1) hi mid else bsearch counts n fuel lo (mid - 1) j
      | none => internalError "lineAt: 二分探索が counts の外を読んだ"
    else pure j

/--
lexer.js:745-786 の `lineAt` を、text の単位の位置 0〜`text.length` の全部で引いた表（大きさ `text.size + 1`。lexer.js:774 が
位置を切り詰める範囲と同じ）。

置いた所（segs）ごとに、marked の中のその位置（`starts[s.k] + s.col`、単位の位置）の前の空白でない単位の数（counts）・LF の数（lfs）・
元の行（lines）を数え、text の側は前からの空白でない単位の数（nonSpace）と LF の数（lf）の表を作り、位置 o で
`counts[j] ≤ nonSpace[o]` の最後の j を二分探索で引く。答えは j < 0 なら 1、でなければ `lines[j] + lf[o] - lfs[j]`。
サロゲートは2つの半分をそれぞれ1単位に数える（JS の `marked[p] !== ' '`・`text[k] !== ' '`）。
-/
def lineAtTable (marked text : JStr) (segs : Array Seg) (sourceLines : Array Nat) : M (Array Nat) := do
  -- lexer.js:752-753 の `starts`（marked の行の頭の単位の位置：0 と、CR の次）。1つの配列にその場で push する。
  let mut starts : Array Nat := #[0]
  for k in [0:marked.size] do
    if marked.isAt k U.cr then starts := starts.push (k + 1)
  let mut counts : Array Nat := #[]
  let mut lfs : Array Nat := #[]
  let mut lines : Array Nat := #[]
  let mut c := 0
  let mut l := 0
  let mut p := 0
  for s in segs do
    let some sk := starts[s.k]? | internalError "lineAt: segs の k が marked の行の外"
    let at_ := sk + s.col
    let (p', c', l') := advance marked (at_ - p) p c l
    p := p'
    c := c'
    l := l'
    counts := counts.push c
    lfs := lfs.push l
    let some sl := sourceLines[s.line]? | internalError "lineAt: segs の line が sourceLines の外"
    lines := lines.push sl
  let mut nonSpace : Array Nat := #[0]
  let mut lf : Array Nat := #[0]
  for ch in text.units do
    nonSpace := nonSpace.push (nonSpace.back?.getD 0 + (if ch != U.sp then 1 else 0))
    lf := lf.push (lf.back?.getD 0 + (if ch == U.lf then 1 else 0))
  let mut out : Array Nat := Array.mkEmpty (text.size + 1)
  for o in [0:text.size + 1] do
    let n := nonSpace.getD o 0
    let j ← bsearch counts n (counts.size + 2) 0 ((counts.size : Int) - 1) (-1)
    if j < 0 then out := out.push 1
    else
      let v : Int := (lines.getD j.toNat 0 : Int) + lf.getD o 0 - lfs.getD j.toNat 0
      if v < 0 then internalError "lineAt: 行が負になった"
      out := out.push v.toNat
  return out

/--
lexer.js:736 の `preprocessWithLines`：classifyNewlinesWithComments → markBlock → separateInfix と、位置から元の行を引く表。

markBlock の断りに行が無ければ、読んでいた処理行の元の行（`sourceLines[track.at]`）を持たせる（:742-744）。classifyNewlines の
断り（閉じない `` ` ``）は自分で行を持っている（:131）。行の表は単位の位置 0〜`text.length` の全部で引いた物（`lineAtTable`）を
そのまま `Pre.lineAt` に置く。
-/
def preprocessWithLines (input : JStr) : M Pre := do
  let c ← classifyNewlinesWithComments input
  let (marked, segs) ← match markBlock c.text c.commentLines with
    | .ok r => pure r
    | .error (at_, e) => throw (if e.line.isNone then { e with line := c.sourceLines[at_]? } else e)
  let text ← separateInfix marked
  let lineAt ← lineAtTable marked text segs c.sourceLines
  return { text, lineAt }

/--
前段の入口：lexer.js:736 の `preprocessWithLines` と同じ（JS の `preprocess`（:727）は text だけを返すが、ここは行の表も返す）。
-/
def preprocess (input : JStr) : Except FrontErr Pre := preprocessWithLines input

/-! ## 確かめ（期待は node v24.16.0 で lexer.js の preprocessWithLines から取った値） -/

/-- 断りの name・line と、message の終わり（JSON.stringify で載せた所）が期待どおりか。 -/
private def errIs (r : Except FrontErr Pre) (name : JStr) (line : Nat) (tail : Array UInt16) : Bool :=
  match r with
  | .error e => e.name == name && e.line == some line && e.message.endsWith ⟨tail⟩
  | .ok _ => false

-- lexer.js:130：x `a\ud800 → 断りの終わりは "`a\ud800"
#guard errIs (preprocess ⟨#[0x78, 0x20, 0x60, 0x61, 0xD800]⟩) "SyntaxError" 1
  #[0x22, 0x60, 0x61, 0x5C, 0x75, 0x64, 0x38, 0x30, 0x30, 0x22]
-- lexer.js:600：逆さの対 " \ude00\ud83d" → " \ude00\ud83d"
#guard errIs (preprocess ⟨#[0x20, 0xDE00, 0xD83D]⟩) "SyntaxError" 1
  #[0x22, 0x20, 0x5C, 0x75, 0x64, 0x65, 0x30, 0x30, 0x5C, 0x75, 0x64, 0x38, 0x33, 0x64, 0x22]
-- lexer.js:637：x ⏎ `c ⏎ " \udc00" → " \udc00"
#guard errIs (preprocess ⟨#[0x78, 0x0D, 0x60, 0x63, 0x0D, 0x20, 0xDC00]⟩) "SyntaxError" 3
  #[0x22, 0x20, 0x5C, 0x75, 0x64, 0x63, 0x30, 0x30, 0x22]
-- lexer.js:685：x : ⏎ ⏎ "\t😀" → "\t😀"（対はそのまま）
#guard errIs (preprocess ⟨#[0x78, 0x20, 0x3A, 0x0D, 0x0D, 0x09, 0xD83D, 0xDE00]⟩) "SyntaxError" 3
  #[0x22, 0x5C, 0x74, 0xD83D, 0xDE00, 0x22]
-- `\` の後ろの `[\s\S]` は上の半分だけを取る：\😀:\ud800 → text は \😀 : \ud800、lineAt は単位 7 つ＋終わりの 8 つ
#guard match preprocess ⟨#[0x5C, 0xD83D, 0xDE00, 0x3A, 0xD800]⟩ with
  | .ok p => p.text.units == #[0x5C, 0xD83D, 0xDE00, 0x20, 0x3A, 0x20, 0xD800] && p.lineAt == #[1, 1, 1, 1, 1, 1, 1, 1]
  | .error _ => false
-- a\ud800 : ⏎ ⇥b → text は a\ud800  :  \x02b\x03、lineAt は [1,1,1,1,1,1,1,1,2,2,2]
#guard match preprocess ⟨#[0x61, 0xD800, 0x20, 0x3A, 0x0D, 0x09, 0x62]⟩ with
  | .ok p => p.text.units == #[0x61, 0xD800, 0x20, 0x20, 0x3A, 0x20, 0x20, 0x02, 0x62, 0x03] &&
      p.lineAt == #[1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2]
  | .error _ => false

-- x : ⏎ ⇥😀 → text は x  :  \x02😀\x03（単位 10）、lineAt は 11 個で、対の2つの単位（7・8）はどちらも 2 行目
#guard match preprocess ⟨#[0x78, 0x20, 0x3A, 0x0D, 0x09, 0xD83D, 0xDE00]⟩ with
  | .ok p => p.text.units == #[0x78, 0x20, 0x20, 0x3A, 0x20, 0x20, 0x02, 0xD83D, 0xDE00, 0x03] &&
      p.lineAt == #[1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2]
  | .error _ => false

end SignSem.Lex
