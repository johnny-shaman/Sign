import SignSem.Syntax

/-!
# 字句の前処理（lexer.js の preprocessWithLines）

alpha1/javascript/lexer.js の `preprocessWithLines`（:736）と、それが呼ぶ物の全部を Lean に写す。的は JS の挙動そのもの
（文書と食い違えば JS が正）。入口は `SignSem.Lex.preprocess : String → Except FrontErr Pre`。

- 字の数え方：JS は文字列を UTF-16 の符号単位で数え、ここは Unicode の符号位置（`Char`）で数える。BMP の外の字があっても
  答え（text と、符号位置の番号で引いた行の表。formal/check/sem/README.md）は同じになる。前処理が字で分ける所はどれも
  BMP の中の字（ASCII・空白・改行）で、サロゲートの片方はどの枝でも「ほかの字」として1単位ずつ素通しになるから、対の2単位は
  1字と同じに運ばれる（`\` の後ろの `[\s\S]`・`\\.`・`input.slice(i, i + 2)` が上の半分だけを取っても、下の半分は次の回で
  そのまま出る）。位置どうしの比べ（括りの位置 `at`、行の表の counts と nonSpace）は同じ数え方の中の比べなので、大小が変わらない。
  lex-review で、BMP の外の字を含む源 711,307 本（lexrev_astral）に当てて全部合った。対になっていないサロゲートは Lean の
  String に置けないので、源にそれがあれば、写しが受けるのは U+FFFD に置き換えた源で、返すのはその源での答え。JS の答えと同じとは
  言えない（断りの文の一部は源の字を JSON.stringify で載せる（lexer.js:130 など）ので、対の無いサロゲートと U+FFFD で文が変わる。
  比べの意味は Main.lean の頭）。
- ループ：`partial def` を使わない。1字ずつ進むループは「残りの字の数」で構造の再帰にする（燃料は要らない）。跳んで進むループ
  （`i += 2`、閉じの次へ跳ぶ、正規表現の当たりの終わりへ跳ぶ）は燃料（`Nat`）を引数にする。燃料はそのループが読む文字列の長さ＋1
  （どの回も1字以上進むので尽きない）で、尽きたら `FrontErr` の name `"InternalError"` を返す（JS には無い断り）。
- 断り：JS の throw は `FrontErr`。`OperationError` は reason と message、`SyntaxError` は message だけ。`TypeError` は
  JS の実行の誤り（`endsWithInfixOperator` が Object.prototype の名前を引いた所、下の注）の写し。行（`line`）の付け方は
  preprocessWithLines（:738-744）の写し。
-/

namespace SignSem.Lex

/-- 前段の断りを返す計算。 -/
abbrev M := Except FrontErr

/-- 燃料が尽きた（写しの側の誤り。JS には無い）。 -/
def outOfFuel {α : Type} (fn : String) : M α :=
  throw { name := "InternalError", reason := none, line := none, message := s!"燃料が尽きました（{fn}）" }

/-- 写しが前提にした形が崩れた（JS なら undefined を読む所。写しの側の誤り）。 -/
def internalError {α : Type} (what : String) : M α :=
  throw { name := "InternalError", reason := none, line := none, message := what }

/-- `new SyntaxError(message)`（line は後で preprocessWithLines が持たせる）。 -/
def syntaxError {α : Type} (msg : String) : M α :=
  throw { name := "SyntaxError", reason := none, line := none, message := msg }

/-- `new OperationError(message, { reason })`（errors.js:13）。 -/
def operationError {α : Type} (reason msg : String) : M α :=
  throw { name := "OperationError", reason := some reason, line := none, message := msg }

/-! ## JS の文字列の道具 -/

/--
文字列の字の並び（UTF-8 のバイト列から読む）。Lean 4.36 の `String.toList`・`String.length`・`String.startsWith` は
Classical.choice に依るので使わず、`String.toUTF8`（公理なし）のバイトを自分で読む。String はいつも正しい UTF-8 なので、
崩れた並びは来ない（来たら1バイトを読み捨てる）。
-/
def chars (s : String) : List Char := decode s.toUTF8.data.toList
where
  cont (b : UInt8) : Nat := b.toNat % 64
  decode : List UInt8 → List Char
    | [] => []
    | b0 :: rest =>
      let n0 := b0.toNat
      if n0 < 0x80 then Char.ofNat n0 :: decode rest
      else if n0 < 0xC0 then decode rest
      else if n0 < 0xE0 then
        match rest with
        | b1 :: rest' => Char.ofNat ((n0 % 32) * 64 + cont b1) :: decode rest'
        | [] => []
      else if n0 < 0xF0 then
        match rest with
        | b1 :: b2 :: rest' => Char.ofNat ((n0 % 16) * 4096 + cont b1 * 64 + cont b2) :: decode rest'
        | _ => []
      else
        match rest with
        | b1 :: b2 :: b3 :: rest' =>
          Char.ofNat ((n0 % 8) * 262144 + cont b1 * 4096 + cont b2 * 64 + cont b3) :: decode rest'
        | _ => []

/-- 字の配列（JS の `s[k]` を `a[k]?` で引く。外なら `none` で、JS の undefined に当たる）。 -/
def toChars (s : String) : Array Char := (chars s).toArray

/--
文字列の等しさ（`decide (a = b)`）。Lean 4.36 では String と Int の `==` は順序の包み（instLinearOrderPackage）から来て
Classical.choice に依るので、DecidableEq（String.decEq・Int.decEq、公理なし）で比べる。
-/
@[inline] def strEq (a b : String) : Bool := decide (a = b)

/-- Int の等しさ（`strEq` の注）。 -/
@[inline] def intEq (a b : Int) : Bool := decide (a = b)

/-- `List.lookup` を `strEq` で。 -/
def lookupStr {β : Type} (k : String) : List (String × β) → Option β
  | [] => none
  | (k', v) :: rest => if strEq k k' then some v else lookupStr k rest

/-- JS の `s.slice(i, j)`（i・j は 0 以上。外は切り詰め、j ≤ i なら空）。 -/
def slice (a : Array Char) (i j : Nat) : String := String.ofList (a.extract i j).toList

/-- JS の `s.slice(i)`。 -/
def sliceFrom (a : Array Char) (i : Nat) : String := slice a i a.size

/-- k から、`p` が成り立つ字の間だけ進めた位置（字が尽きたら `a.size`）。1字ずつ進むので、残りの字の数で構造の再帰にする。 -/
def skipWhile (a : Array Char) (p : Char → Bool) (k : Nat) : Nat := go (a.size - k) k
where
  go : Nat → Nat → Nat
    | 0, k => k
    | r + 1, k =>
      match a[k]? with
      | some c => if p c then go r (k + 1) else k
      | none => k

/-- JS の `s.indexOf(ch, from)`（無ければ `none`）。 -/
def indexOf (a : Array Char) (ch : Char) (from_ : Nat) : Option Nat :=
  let k := skipWhile a (· != ch) from_
  if k < a.size then some k else none

/-- JS の `trim`・`trimEnd`・`\s` が空白と見る字（WhiteSpace と LineTerminator。node で 0..0xFFFF を当てて確かめた）。 -/
def isJsSpace (c : Char) : Bool :=
  let n := c.toNat
  n == 0x9 || n == 0xA || n == 0xB || n == 0xC || n == 0xD || n == 0x20 || n == 0xA0 || n == 0x1680 ||
    (n ≥ 0x2000 && n ≤ 0x200A) || n == 0x2028 || n == 0x2029 || n == 0x202F || n == 0x205F || n == 0x3000 ||
    n == 0xFEFF

/-- JS の `s.trim()`。 -/
def jsTrim (s : String) : String :=
  String.ofList (((chars s).dropWhile isJsSpace).reverse.dropWhile isJsSpace).reverse

/-- JS の `s.trimEnd()`。 -/
def jsTrimEnd (s : String) : String :=
  String.ofList ((chars s).reverse.dropWhile isJsSpace).reverse

/-- JS の `s.split(' ')` の最後の要素（最後の空白の後ろ、空白が無ければ全部）。 -/
def lastWord (s : String) : String :=
  String.ofList ((chars s).reverse.takeWhile (· != ' ')).reverse

/-- `s.replace(/^ +/, '')`。 -/
def dropLeadingSpaces (s : String) : String := String.ofList ((chars s).dropWhile (· == ' '))

/-- `/^ *\?/.test(s)`。 -/
def startsSpacesQuestion (s : String) : Bool := ((chars s).dropWhile (· == ' ')).head? == some '?'

/-- `s.includes(sub)`（`/ : /.test(…)` に使う）。 -/
def hasSub (s sub : List Char) : Bool :=
  match s with
  | [] => sub.isEmpty
  | c :: cs => sub.isPrefixOf (c :: cs) || hasSub cs sub

/-- 4 桁の16進（小文字）。 -/
def hex4 (n : Nat) : String :=
  let d := Nat.toDigits 16 n
  String.ofList (List.replicate (4 - d.length) '0' ++ d)

/-- JS の `JSON.stringify(s)`（s は文字列。`"`・`\`・U+0000〜U+001F を戻す。U+2028・U+2029・DEL はそのまま）。 -/
def jsonStr (s : String) : String :=
  (chars s).foldl (fun acc c => acc ++ esc c) "\"" ++ "\""
where
  esc (c : Char) : String :=
    if c == '"' then "\\\""
    else if c == '\\' then "\\\\"
    else if c == '\x08' then "\\b"
    else if c == '\t' then "\\t"
    else if c == '\n' then "\\n"
    else if c == '\x0c' then "\\f"
    else if c == '\r' then "\\r"
    else if c.toNat < 0x20 then "\\u" ++ hex4 c.toNat
    else c.toString

/-- `s.split(sep)`（sep は1字。空の文字列は `[""]`）。 -/
def splitOnChar (s : String) (sep : Char) : List String := go (chars s) [] []
where
  go : List Char → List Char → List String → List String
    | [], cur, acc => (String.ofList cur.reverse :: acc).reverse
    | c :: cs, cur, acc => if c == sep then go cs [] (String.ofList cur.reverse :: acc) else go cs (c :: cur) acc

/-! ## 演算子の表（operator_table.js） -/

/--
operator_table.js:14 の `OPERATOR_BY_PRECEDENCE` の、綴りと位置（position）の欄。段は並びの添字＋1。
構文の前処理が読むのは、綴りと位置だけ（getStrictInfixOperators と endsWithInfixOperator）。
-/
def OPERATOR_BY_PRECEDENCE : List (List (String × String)) := [
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
def OPERATOR_DICT : List (String × List String) :=
  OPERATOR_BY_PRECEDENCE.foldl (fun d stage => stage.foldl add d) []
where
  add (d : List (String × List String)) (e : String × String) : List (String × List String) :=
    if d.any (fun p => strEq p.1 e.1) then d.map (fun p => if strEq p.1 e.1 then (p.1, p.2 ++ [e.2]) else p) else d ++ [(e.1, [e.2])]

/-- operator_table.js:161 の `getStrictInfixOperators`：位置が中置だけの綴り（`' '`・`|`・`||` を除く）。 -/
def getStrictInfixOperators : List String :=
  (OPERATOR_DICT.filter fun p => !(strEq p.1 " " || strEq p.1 "|" || strEq p.1 "||") && p.2.all (strEq · "infix")).map (·.1)

/-- operator_table.js:179 の `strictInfix.sort((a, b) => b.length - a.length)`（安定な並べ替え。長い順、同じ長さは元の順）。 -/
def sortByLengthDesc (l : List String) : List String := l.foldl (fun acc s => ins s acc) []
where
  ins (s : String) : List String → List String
    | [] => [s]
    | t :: ts => if (chars t).length ≥ (chars s).length then t :: ins s ts else s :: t :: ts

/-- buildLexerRegex（operator_table.js:176）の第2の組の選択肢の並び。 -/
def lexerOperators : List String := sortByLengthDesc getStrictInfixOperators

#guard lexerOperators == ["===", "!==", "\\n", "==", "~+", "~-", "~*", "~/", "~^", "<=", ">=", "!=", "<<", ">>", ";;",
  "&&", ":", "?", ";", "&", ",", "<", "=", ">", "+", "*", "/", "%", "^", "'"]

/-! ## separateInfix（lexer.js:26） -/

/-- 正規表現の当たり：第1の組（protect、終わりの位置）か第2の組（operator、綴り）。 -/
inductive Hit where
  | protect (stop : Nat)
  | operator (op : String)

/-- `a` の `i` から綴り `s` が並ぶか。 -/
def startsAt (a : Array Char) (i : Nat) (s : String) : Bool := go (chars s) i
where
  go : List Char → Nat → Bool
    | [], _ => true
    | c :: cs, k => a[k]? == some c && go cs (k + 1)

/-- 第2の組 `(===|!==|\\n|==|…|')`：並びの順で最初に当たる綴り。 -/
def operatorAt (a : Array Char) (i : Nat) : Option Hit :=
  (lexerOperators.find? (startsAt a i)).map Hit.operator

/-- 正規表現の `.`（LineTerminator の4つ以外の1字）。 -/
def isDotChar (c : Char) : Bool := !(c.toNat == 0xA || c.toNat == 0xD || c.toNat == 0x2028 || c.toNat == 0x2029)

/--
第1の組の3つ目 `"(?:\\.|[^"\r\n])*"` の、`i`（`"` の位置）からの当たりの終わり（当たらなければ `none`）。

JS の正規表現は後戻りで探す：各回はまず `\\.`、だめなら `[^"\r\n]`、それもだめなら閉じの `"` を試す。どの道でも、`"` の前に
CR・LF が無ければ当たる（全部を `[^"\r\n]` で取る道がある）。だから当たるのは、i+1 から最初の CR・LF（か終わり）までに `"` が
あるときだけで、その最後の `"` を `lastQ` とすると、最初に見つかる道は「`\` の次が `.` に当たる字で、2字取った後に
まだ `lastQ` が残る（p + 2 ≤ lastQ）なら `\\.`、でなければ1字」で前から進み、境目に来た最初の `"` で閉じる道である
（`\\.` を取って先で行き詰まる道は、後戻りで1字の道に戻る。その先に閉じが残るのは p + 2 ≤ lastQ のときだけ）。
-/
def dquoteEnd (a : Array Char) (i : Nat) : M (Option Nat) := do
  let L := skipWhile a (fun c => c != '\r' && c != '\n') (i + 1)
  match lastQuote L (L - (i + 1)) none (i + 1) with
  | none => return none
  | some q => return some (← walk q (a.size + 1) (i + 1))
where
  /-- [k, L) の最後の `"`（1字ずつ進む）。 -/
  lastQuote (L : Nat) : Nat → Option Nat → Nat → Option Nat
    | 0, last, _ => last
    | r + 1, last, k => lastQuote L r (if a[k]? == some '"' then some k else last) (k + 1)
  walk (q : Nat) : Nat → Nat → M Nat
    | 0, _ => outOfFuel "separateInfix（\"…\" の当たり）"
    | fuel + 1, p =>
      match a[p]? with
      | some '"' => pure (p + 1)
      | some '\\' =>
        if (match a[p + 1]? with | some c => isDotChar c | none => false) && p + 2 ≤ q then walk q fuel (p + 2)
        else walk q fuel (p + 1)
      | some _ => walk q fuel (p + 1)
      | none => internalError "separateInfix: \"…\" の当たりが終わりを越えた"

/--
`i` での正規表現の当たり（buildLexerRegex、operator_table.js:176-187）。出来上がる正規表現（g 付き）は：

```
(`[^`\r\n]*`|`[^\r\n]*|"(?:\\.|[^"\r\n])*"|\\[\s\S]|!!)|(===|!==|\\n|==|~\+|~-|~\*|~\/|~\^|<=|>=|!=|<<|>>|;;|&&|:|\?|;|&|,|<|=|>|\+|\*|\/|%|\^|')
```

選択肢を左から試し、最初に当たった物を取る。第1の組の選択肢は字の頭で分かれる（`` ` ``・`"`・`\`・`!`）。
- `` ` ``：1つ目は次の `` ` `` が CR・LF より前にあれば当たり、無ければ2つ目が CR・LF（か終わり）まで取る。だから `` ` `` は必ず当たる。
- `"`：`dquoteEnd`。当たらなければ第2の組へ（`"` で始まる綴りは無い）。
- `\`：次の字があれば2字（`[\s\S]` は何でも1字）。無ければ第2の組（`\\n` も当たらない）。第2の組の `\\n` はいつも第1の組に先を取られる。
- `!!`：第2の組の `!==`・`!=` より先。
-/
def matchAt (a : Array Char) (i : Nat) : M (Option Hit) := do
  match a[i]? with
  | none => return none
  | some c =>
    if c == '`' then
      let k := skipWhile a (fun c => c != '`' && c != '\r' && c != '\n') (i + 1)
      return some (.protect (if a[k]? == some '`' then k + 1 else k))
    else if c == '"' then
      match ← dquoteEnd a i with
      | some j => return some (.protect j)
      | none => return operatorAt a i
    else if c == '\\' then
      return (if i + 1 < a.size then some (.protect (i + 2)) else operatorAt a i)
    else if c == '!' && a[i + 1]? == some '!' then
      return some (.protect (i + 2))
    else
      return operatorAt a i

/--
lexer.js:26 の `separateInfix`：`input.replace(lexerRegex, …)`。左から探し、当たった所を置き換え、当たりの終わりから続ける
（g の置き換え。どの選択肢も1字以上取るので、空の当たりは無い）。protect はそのまま、operator は前後に空白を1つずつ置く。
-/
def separateInfix (input : String) : M String :=
  let a := toChars input
  go a (a.size + 1) 0 ""
where
  go (a : Array Char) : Nat → Nat → String → M String
    | 0, _, _ => outOfFuel "separateInfix"
    | fuel + 1, i, out => do
      match a[i]? with
      | none => pure out
      | some c =>
        match ← matchAt a i with
        | some (.protect j) => go a fuel j (out ++ slice a i j)
        | some (.operator op) => go a fuel (i + (chars op).length) (out ++ " " ++ op ++ " ")
        | none => go a fuel (i + 1) (out.push c)

/-! ## classifyNewlinesWithComments（lexer.js:81） -/

/-- 最初の走査の結果。`commentLines` は処理行の番号 → 読み捨てたコメントの行か（JS の Set の写し）、`sourceLines` は処理行の番号 → 元の行。 -/
structure Classified where
  text : String
  commentLines : Array Bool
  sourceLines : Array Nat

/-- lexer.js:87 の `newlineWidth`。 -/
def newlineWidth (a : Array Char) (k : Nat) : Nat :=
  match a[k]? with
  | some '\r' => if a[k + 1]? == some '\n' then 2 else 1
  | some '\n' => 1
  | _ => 0

/-- lexer.js:147 の `isCommentAt`：行頭のバッククォートがコメントの始まりか。 -/
def isCommentAt (a : Array Char) (j : Nat) : Bool :=
  let k := skipWhile a (fun c => c != '`' && c != '\r' && c != '\n') (j + 1)
  if a[k]? != some '`' then true
  else
    match a[k + 1]? with
    | some '@' | some '~' | some '!' | some ' ' => false
    | _ => true

/-- lexer.js:126 の文字列の中の走査（`"…"` の中の `\` は次の字と組む）。 -/
def scanString (a : Array Char) (ch : Char) : Nat → Nat → M Nat
  | 0, _ => outOfFuel "classifyNewlinesWithComments（文字列）"
  | fuel + 1, k =>
    match a[k]? with
    | none => pure k
    | some c =>
      if c == ch || newlineWidth a k != 0 then pure k
      else
        scanString a ch fuel
          (k + (if ch == '"' && c == '\\' && k + 1 < a.size && newlineWidth a (k + 1) == 0 then 2 else 1))

/-- classifyNewlinesWithComments の走査の状態（lexer.js:82-91 の変数）。`lineNo` はいつも `sourceLines.size - 1`。 -/
structure CState where
  i : Nat
  out : String
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
def classifyNewlinesWithComments (input : String) : M Classified :=
  let a := toChars input
  loop a (a.size + 1)
    { i := 0, out := "", lineNo := 0, sourceLine := 1, sourceLines := #[1], commentLines := #[false], lineStart := true,
      bracketDepth := 0 }
where
  loop (a : Array Char) : Nat → CState → M Classified
    | 0, _ => outOfFuel "classifyNewlinesWithComments"
    | fuel + 1, st => do
      match a[st.i]? with
      | none => pure { text := st.out, commentLines := st.commentLines, sourceLines := st.sourceLines }
      | some ch =>
        let isComment := st.lineStart && st.bracketDepth ≤ 0 && ch == '`' && isCommentAt a st.i
        let st := { st with lineStart := false }
        if isComment then
          -- while (i < n && !newlineWidth(i)) i++
          let i := skipWhile a (fun c => c != '\r' && c != '\n') st.i
          loop a fuel { st with i := i, commentLines := st.commentLines.setIfInBounds st.lineNo true }
        else
          let w := newlineWidth a st.i
          if w != 0 then
            loop a fuel
              { st with out := st.out.push '\r', lineNo := st.lineNo + 1, sourceLine := st.sourceLine + 1,
                        sourceLines := st.sourceLines.push (st.sourceLine + 1),
                        commentLines := st.commentLines.push false, i := st.i + w, lineStart := true }
          else if ch == '\\' then
            let w2 := if st.i + 1 < a.size then newlineWidth a (st.i + 1) else 0
            if w2 != 0 then
              let i := skipWhile a (· == '\t') (st.i + 1 + w2)
              loop a fuel { st with out := st.out ++ "\\\n", i := i, sourceLine := st.sourceLine + 1 }
            else
              loop a fuel { st with out := st.out ++ slice a st.i (st.i + 2), i := st.i + 2 }
          else if ch == '`' || ch == '"' then
            let k ← scanString a ch (a.size + 1) (st.i + 1)
            if a[k]? == some ch then
              loop a fuel { st with out := st.out ++ slice a st.i (k + 1), i := k + 1 }
            else if ch == '`' then
              let lineEnd := skipWhile a (fun c => c != '\r' && c != '\n') st.i
              throw { name := "SyntaxError", reason := none, line := some st.sourceLine,
                      message := "文字列が行の終わりまでに閉じていません（文字列は行をまたげません）: " ++
                        jsonStr (slice a st.i lineEnd) }
            else
              loop a fuel { st with out := st.out ++ slice a st.i k, i := k }
          else
            let bd : Int := if ch == '[' || ch == '(' || ch == '{' then st.bracketDepth + 1
              else if ch == ']' || ch == ')' || ch == '}' then st.bracketDepth - 1 else st.bracketDepth
            loop a fuel { st with bracketDepth := bd, out := st.out.push ch, i := st.i + 1 }

/-! ## markBlock の道具（lexer.js:155-519） -/

/-- lexer.js:160 の `bracketDelta`：1行の括りの深さの増減（文字列と `\` の組は数えない。閉じない引用符の後は読み飛ばす）。 -/
def bracketDelta (content : String) : M Int :=
  let a := toChars content
  go a (a.size + 1) 0 0
where
  go (a : Array Char) : Nat → Nat → Int → M Int
    | 0, _, _ => outOfFuel "bracketDelta"
    | fuel + 1, i, depth =>
      match a[i]? with
      | none => pure depth
      | some ch =>
        if ch == '\\' then go a fuel (i + 2) depth
        else if ch == '`' || ch == '"' then
          match indexOf a ch (i + 1) with
          | none => pure depth
          | some close => go a fuel (close + 1) depth
        else if ch == '[' || ch == '(' || ch == '{' then go a fuel (i + 1) (depth + 1)
        else if ch == ']' || ch == ')' || ch == '}' then go a fuel (i + 1) (depth - 1)
        else go a fuel (i + 1) depth

/-- lexer.js:221 の `QUESTION_ROW_RULE`。 -/
def QUESTION_ROW_RULE : String :=
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
def refuseMisplacedQuestionRow (content : String) (q depth : Nat) (written : Array Written) : M Unit := do
  let k := lastAtMost written q
  let at_ : Int := match k with
    | some k => match written[k]? with | some x => (x.depth : Int) | none => -1
    | none => -1
  let deeper := match k with | some k => written[k + 1]? | none => written[0]?
  let qi : Int := q
  if q ≥ 1 && intEq at_ (qi - 1) && (match deeper with | none => true | some d => d.depth == q + 1 && d.opened) then
    return ()
  let where_ ← do
    if intEq at_ qi then
      pure (if q == depth then
        "直前の行と同じ深さなので、その行の続きになります（仮引数の行と同じ深さなら、最後の仮引数の行に付きます）"
      else "同じ深さに書いた行（定義の行）の続きになります")
    else if at_ < 0 then pure "その上に書いた行がありません"
    else if at_ < qi - 1 then
      pure ("その上に書いた行（TAB " ++ toString at_ ++ " 個）から " ++ toString (qi - at_) ++ " 段下がっています")
    else
      match deeper with
      | some d =>
        if d.depth != q + 1 then
          pure ("定義の行（TAB " ++ toString at_ ++ " 個）から1段ですが、仮引数の行が定義の行から " ++
            toString ((d.depth : Int) - at_) ++ " 段下がっています（仮引数の行は2段）")
        else
          pure ("定義の行（TAB " ++ toString at_ ++ " 個）から1段ですが、仮引数の行が定義の行から2段の所で始まっていません" ++
            "（字下げを跳んで深く書いた行の後に、2段の行を書いています）")
      | none =>
        -- JS なら deeper.depth で TypeError。上の return に当たるので来ない。
        throw { name := "TypeError", reason := none, line := none,
                message := "Cannot read properties of undefined (reading 'depth')" }
  operationError "question-row-indent"
    (QUESTION_ROW_RULE ++ "この行（TAB " ++ toString q ++ " 個の `" ++ content ++ "`）は" ++ where_)

/-- lexer.js:253 の `questionAfterClose`：括りの中で始まった行が、括りの外（深さ 0）へ出た後に `?` を書いているか。 -/
def questionAfterClose (content : String) (depth : Int) : M Bool :=
  let a := toChars content
  go a (a.size + 1) 0 depth
where
  go (a : Array Char) : Nat → Nat → Int → M Bool
    | 0, _, _ => outOfFuel "questionAfterClose"
    | fuel + 1, i, depth =>
      match a[i]? with
      | none => pure false
      | some ch =>
        if ch == '\\' then go a fuel (i + 2) depth
        else if ch == '`' || ch == '"' then
          match indexOf a ch (i + 1) with
          | none => pure false
          | some close => go a fuel (close + 1) depth
        else if ch == '[' || ch == '(' || ch == '{' then go a fuel (i + 1) (depth + 1)
        else if ch == ']' || ch == ')' || ch == '}' then go a fuel (i + 1) (depth - 1)
        else if ch == '?' && depth ≤ 0 then pure true
        else go a fuel (i + 1) depth

/-- Object.prototype の自分の名前（node v24 の `Object.getOwnPropertyNames(Object.prototype)`）。`OPERATOR_DICT[w]` はこれらで物を返す。 -/
def OBJECT_PROTOTYPE_KEYS : List String :=
  ["constructor", "__defineGetter__", "__defineSetter__", "hasOwnProperty", "__lookupGetter__", "__lookupSetter__",
    "isPrototypeOf", "propertyIsEnumerable", "toString", "valueOf", "__proto__", "toLocaleString"]

/--
lexer.js:284 の `endsWithInfixOperator`：補った後の綴りで、最後の語が中置の意味を持つ演算子か。

`OPERATOR_DICT` は JS のただの物なので、最後の語が Object.prototype の名前（`toString` など）だと `defs` は関数か物になり、
`defs.some` が無いので TypeError（"defs.some is not a function"）で止まる。その写し。
-/
def endsWithInfixOperator (text : String) : M Bool := do
  let w := lastWord (jsTrimEnd (← separateInfix text))
  match lookupStr w OPERATOR_DICT with
  | some defs => return defs.any (strEq · "infix")
  | none =>
    if OBJECT_PROTOTYPE_KEYS.any (strEq · w) then
      throw { name := "TypeError", reason := none, line := none, message := "defs.some is not a function" }
    else return false

/-- lexer.js:291 の `quoted`：`s.replace(/ {2,}/g, ' ').replace(/\n/g, '\\n')`。 -/
def quoted (s : String) : String := go (chars s) false ""
where
  go : List Char → Bool → String → String
    | [], _, out => out
    | c :: cs, prevSp, out =>
      if c == ' ' && prevSp then go cs true out
      else go cs (c == ' ') (if c == '\n' then out ++ "\\n" else out.push c)

/-- lexer.js:293 の `refuseBlockAfterValue`。 -/
def refuseBlockAfterValue (logical content : String) (q : Nat) : M Unit :=
  operationError "block-after-value"
    ("字下げのブロックは、中置の演算子（`:`・`?` を含む）の右にだけ置けます。この行（TAB " ++ toString q ++ " 個の `" ++
      quoted content ++ "`）は、" ++
      "値や語、または前置・後置にしかならない演算子で終わる行（`" ++ quoted logical ++ "`）の下で字下げを深くしています。" ++
      "前の行の余積を続けるなら（括りを渡すときも）TAB の後に空白を置きます。")

/-- lexer.js:318 の `/^\|\|?[^|]/.test(word)`。 -/
def opensEnclosure (w : List Char) : Bool :=
  match w with
  | '|' :: c :: rest => c != '|' || (match rest with | d :: _ => d != '|' | [] => false)
  | _ => false

/-- lexer.js:319 の `/[^|]\|\|?$/.test(word)`。 -/
def closesEnclosure (w : List Char) : Bool :=
  match w.reverse with
  | '|' :: c :: rest => c != '|' || (match rest with | d :: _ => d != '|' | [] => false)
  | _ => false

/-- lexer.js:316 の `countEnclosure`。 -/
def countEnclosure (word : String) (depth : Int) : Int :=
  if strEq word "|" || strEq word "||" then depth
  else
    let w := chars word
    let depth := if opensEnclosure w then depth + 1 else depth
    if closesEnclosure w then depth - 1 else depth

/-- lexer.js:311 の `hasTopLevelDefine`：いちばん外の行に、括り（と `|…|`・`||…||` の囲み）の外の `:` があるか。 -/
def hasTopLevelDefine (text : String) : M Bool := do
  let a := toChars (← separateInfix text)
  go a (a.size + 1) 0 0 ""
where
  go (a : Array Char) : Nat → Nat → Int → String → M Bool
    | 0, _, _, _ => outOfFuel "hasTopLevelDefine"
    | fuel + 1, i, depth, word =>
      match a[i]? with
      | none => pure (intEq depth 0 && strEq word ":")
      | some ch =>
        if ch == '\\' then go a fuel (i + 2) depth (word ++ slice a i (i + 2))
        else if ch == '`' || ch == '"' then
          match indexOf a ch (i + 1) with
          | none => pure false
          | some close => go a fuel (close + 1) depth (word ++ slice a i (close + 1))
        else if ch == ' ' || ch == '[' || ch == '(' || ch == '{' || ch == ']' || ch == ')' || ch == '}' then
          if intEq depth 0 && strEq word ":" then pure true
          else
            let depth := countEnclosure word depth
            let depth := if ch == '[' || ch == '(' || ch == '{' then depth + 1 else if ch != ' ' then depth - 1 else depth
            go a fuel (i + 1) depth ""
        else go a fuel (i + 1) depth (word.push ch)

/-- lexer.js:350 の `refuseMissingBlankLine`。 -/
def refuseMissingBlankLine (definition content : String) : M Unit :=
  operationError "definition-end-blank-line"
    ("いちばん外の定義が字下げのブロックで終わったら、空行を1行置いてから次の行を書きます。定義（`" ++ quoted definition ++
      "`）の後の、" ++ "この行（`" ++ quoted content ++ "`）の前に空行がありません。")

/-- lexer.js:358 の `refuseQuestionAfterClose`。 -/
def refuseQuestionAfterClose (content : String) (q : Nat) : M Unit :=
  operationError "question-row-indent"
    (QUESTION_ROW_RULE ++ "この行（TAB " ++ toString q ++ " 個の `" ++ content ++ "`）は複数の行に書いた括りを閉じた行で、閉じの後ろに `?` を続けています" ++
      "——`?` は閉じの次の行の頭に置きます")

/-- 括りの中に書いた行（lexer.js:609 の `{ t, c }`）。 -/
structure FrameRow where
  t : Nat
  c : String
  deriving Inhabited

/-- 開いている括りの控え（lexer.js:391 の物）。`at_` は JS の `at`。 -/
structure Frame where
  k : Nat
  head : String
  at_ : Nat
  endsOpen : Bool
  place : Place
  rows : Array FrameRow
  more : String
  deriving Inhabited

/--
lexer.js:375 の `openFrames`：1行を読んで、開いている括りの控えを積み・降ろす。

JS の `last` は、この呼び出しで最後に積んだ控え（降ろしたら null）。積んだ控えはいつも積みの頂きにあり、降ろすのは頂きだけなので、
`done === last` は「`last` が null でない」と同じ。ここでは `last` をその真偽で持つ。
-/
def openFrames (frames : Array Frame) (content : String) (k : Nat) (place : Place) : M (Array Frame) := do
  let a := toChars content
  let (frames, last) ← go a (a.size + 1) 0 frames false
  match frames.back? with
  | some top =>
    if last && (jsTrim (sliceFrom a (top.at_ + 1))).isEmpty then
      return frames.modify (frames.size - 1) (fun f => { f with endsOpen := true })
    else return frames
  | none => return frames
where
  go (a : Array Char) : Nat → Nat → Array Frame → Bool → M (Array Frame × Bool)
    | 0, _, _, _ => outOfFuel "openFrames"
    | fuel + 1, i, frames, last =>
      match a[i]? with
      | none => pure (frames, last)
      | some ch =>
        if ch == '\\' then go a fuel (i + 2) frames last
        else if ch == '`' || ch == '"' then
          match indexOf a ch (i + 1) with
          | none => pure (frames, last)
          | some close => go a fuel (close + 1) frames last
        else if ch == '[' || ch == '(' || ch == '{' then
          let f : Frame := { k, head := content, at_ := i, endsOpen := false,
                             place := if frames.size > 0 then .bracket else place, rows := #[], more := "" }
          go a fuel (i + 1) (frames.push f) true
        else if ch == ']' || ch == ')' || ch == '}' then
          let done := frames.back?
          let frames := frames.pop
          let last := if done.isSome then false else last
          -- 行を跨いだ内の括りを閉じたら、その中身を外の括りの控えへ戻す。
          let frames :=
            match done, frames.back? with
            | some d, some parent =>
              if d.rows.size > 0 || !d.more.isEmpty then
                let text := " ".intercalate ((jsTrim d.more :: d.rows.toList.map (·.c)).filter (fun t => !t.isEmpty))
                let parent :=
                  if parent.rows.size > 0 then
                    { parent with rows := parent.rows.modify (parent.rows.size - 1) (fun r => { r with c := r.c ++ " " ++ text }) }
                  else { parent with more := parent.more ++ " " ++ text }
                frames.set! (frames.size - 1) parent
              else frames
            | _, _ => frames
          go a fuel (i + 1) frames last
        else go a fuel (i + 1) frames last

/-- 段の置き場の、上の段（`parent`）から決まる所（lexer.js:416 の `placeOfBlock`）。 -/
def placeOfBlock (parent : Option Written) (depth : Nat) (logical : String) (opened : Bool) : M Place := do
  if depth == 0 then return .top
  match parent with
  | none => return .other
  | some parent =>
    if !opened then return .other
    let op := lastWord (jsTrimEnd (← separateInfix logical))
    if strEq op "?" then return .body
    if !strEq op ":" then return .other
    let d : Int := (depth : Int) - parent.depth
    if parent.place == .body then return .body
    if parent.place == .param then return (if intEq d 2 then .param else .default)
    if parent.place != .top && parent.place != .field then return .other
    return (if intEq d 1 then .field else if intEq d 2 then .param else .other)

/-- lexer.js:430 の `cutAtClose`：括りの閉じの手前まで（その括りより外へ出たら切る）。1字ずつ進む。 -/
def cutAtClose (s : String) : String := go (chars s) 0 []
where
  go : List Char → Int → List Char → String
    | [], _, acc => jsTrim (String.ofList acc.reverse)
    | ch :: cs, depth, acc =>
      if ch == '[' || ch == '(' || ch == '{' then go cs (depth + 1) (ch :: acc)
      else if ch == ']' || ch == ')' || ch == '}' then
        if depth - 1 < 0 then jsTrim (String.ofList acc.reverse) else go cs (depth - 1) (ch :: acc)
      else go cs depth (ch :: acc)

/-- lexer.js:443 の `questionBeforeBracket`：括りを開いた行で、その括り（位置 at）より前に、その括りを囲む所の `?` があるか。 -/
def questionBeforeBracket (head : String) (at_ : Nat) : M Bool :=
  let a := toChars head
  go a (at_ + 1) 0 #[false]
where
  go (a : Array Char) : Nat → Nat → Array Bool → M Bool
    | 0, _, _ => outOfFuel "questionBeforeBracket"
    | fuel + 1, i, open_ =>
      if i < at_ then
        match a[i]? with
        | some ch =>
          if ch == '\\' then go a fuel (i + 2) open_
          else if ch == '`' || ch == '"' then
            match indexOf a ch (i + 1) with
            | none => pure (open_.contains true)
            | some close => if close ≥ at_ then pure (open_.contains true) else go a fuel (close + 1) open_
          else if ch == '[' || ch == '(' || ch == '{' then go a fuel (i + 1) (open_.push false)
          else if ch == ']' || ch == ')' || ch == '}' then
            go a fuel (i + 1) (if open_.size > 1 then open_.pop else open_.setIfInBounds 0 false)
          else if ch == '?' then go a fuel (i + 1) (open_.setIfInBounds (open_.size - 1) true)
          else go a fuel (i + 1) open_
        | none => go a fuel (i + 1) open_
      else pure (open_.contains true)

/-- `content.replace(/^ *\? */, '')`。 -/
def dropQuestionPrefix (s : String) : String :=
  match (chars s).dropWhile (· == ' ') with
  | '?' :: rest => String.ofList (rest.dropWhile (· == ' '))
  | _ => s

/-- `/^#*[A-Za-z_][A-Za-z0-9_]* *:$/.test(r)`（欄の行 `m :`）。 -/
def isFieldRow (r : String) : Bool :=
  match ((chars r).dropWhile (· == '#')) with
  | c :: rest =>
    isIdentStart c &&
      (match (rest.dropWhile isIdentChar).dropWhile (· == ' ') with
       | [':'] => true
       | _ => false)
  | [] => false
where
  isIdentStart (c : Char) : Bool := ('A' ≤ c && c ≤ 'Z') || ('a' ≤ c && c ≤ 'z') || c == '_'
  isIdentChar (c : Char) : Bool := isIdentStart c || ('0' ≤ c && c ≤ '9')

/-- `r.replace(/ *:$/, '')`（終わりの `:` と、その前の空白を除く）。 -/
def dropFieldColon (r : String) : String :=
  match (chars r).reverse with
  | ':' :: rest => String.ofList (rest.dropWhile (· == ' ')).reverse
  | _ => r

/--
`f.head.match(/^(#*[A-Za-z_][A-Za-z0-9_]*) *: *\$?[[({]/)` の、組1（名前）と当たりの長さ。
綴りの類は重ならないので後戻りは要らない（`\$?` は次が括りでなければ空に戻り、その位置の `$` は括りでないので外れる）。
-/
def headDefOpen (head : String) : Option (String × Nat) :=
  let l := chars head
  let hashes := l.takeWhile (· == '#')
  let l1 := l.drop hashes.length
  match l1 with
  | c :: rest =>
    if isFieldRow.isIdentStart c then
      let identRest := rest.takeWhile isFieldRow.isIdentChar
      let name := hashes ++ c :: identRest
      let l2 := rest.drop identRest.length
      let sp1 := l2.takeWhile (· == ' ')
      match l2.drop sp1.length with
      | ':' :: l3 =>
        let sp2 := l3.takeWhile (· == ' ')
        let l4 := l3.drop sp2.length
        let n0 := name.length + sp1.length + 1 + sp2.length
        let isOpen (ch : Char) : Bool := ch == '[' || ch == '(' || ch == '{'
        match l4 with
        | '$' :: ch :: _ => if isOpen ch then some (String.ofList name, n0 + 2) else none
        | ch :: _ => if isOpen ch then some (String.ofList name, n0 + 1) else none
        | [] => none
      | _ => none
    else none
  | [] => none

/-- `/ : *\$?$/.test(s)`（` :` の後が空白と、あれば `$` 1つで終わる）。 -/
def endsWithColonValue (s : String) : Bool :=
  let r := (chars s).reverse
  let r := match r with | '$' :: rest => rest | _ => r
  match r.dropWhile (· == ' ') with
  | ':' :: ' ' :: _ => true
  | _ => false

/-- `rows.findLastIndex(p)`（無ければ none）。 -/
def findLastIndex (p : String → Bool) (l : List String) : Option Nat := go l 0 none
where
  go : List String → Nat → Option Nat → Option Nat
    | [], _, r => r
    | x :: xs, i, r => go xs (i + 1) (if p x then some i else r)

/-- lexer.js:467 の `refuseBracketQuestionRow`：括りの中の `?` の行を断る（R135）。言い分は形で出し分ける。いつも断る。 -/
def refuseBracketQuestionRow (f : Option Frame) (content : String) (q : Nat) : M Unit := do
  let body := cutAtClose (dropQuestionPrefix content)
  let head := match f with | some f => jsTrim f.head | none => ""
  let tail := match f with | some f => cutAtClose (sliceFrom (toChars f.head) (f.at_ + 1) ++ f.more) | none => ""
  let rows : List String :=
    ((if !tail.isEmpty then [tail] else []) ++ (match f with | some f => f.rows.toList.map (fun r => cutAtClose r.c) | none => [])).filter
      (fun t => !t.isEmpty)
  let prev := rows.getLast?.getD ""
  let shape := match f with
    | some f => f.endsOpen && f.rows.size ≥ 1 && f.rows.all (fun r => r.t == f.k + 2) && q == f.k + 1
    | none => false
  let what :=
    "複数の行に書いた括り（`" ++ quoted head ++ "` の行で開いた括り）の中に、`?` で始まる行（TAB " ++ toString q ++ " 個の `" ++
      quoted (jsTrim content) ++ "`）があります。" ++
      "括りの中は字下げを数えないので、括りの中に `?` の行は置けません（名前の無い関数に仮引数のブロックの綴りは無い、§4 R131 の帰結1）。"
  let end_ := "文法に無い形なので、読む段で止めます（§4 R135）。"
  let refuse (guide : String) : M Unit := operationError "param-block-bracket" (what ++ guide ++ end_)
  let isDefRow (r : String) : Bool := hasSub (chars (" " ++ r ++ " ")) (chars " : ")
  let block (name : String) (ps : List String) : String :=
    "`" ++ name ++ " :` ⏎ " ++ " ⏎ ".intercalate (ps.map (fun r => "`⇥⇥" ++ quoted r ++ "`")) ++ " ⏎ `⇥?" ++
      (if !body.isEmpty then " " ++ quoted body else "") ++ "`" ++ (if !body.isEmpty then "" else " ⏎ 枝の行")
  let choose (oneLine : Option String) (named after : String) (note : String := "") : M Unit :=
    refuse (match oneLine with
      | some o => "短ければ" ++ o ++ "に、長いか既定値・行に割った枝を使うなら" ++ named ++ after ++
          (if !note.isEmpty then "（" ++ note ++ "）" else "") ++ "。"
      | none => named ++ after ++ "（既定値と、行に割った枝は名前の定義の物です" ++ (if !note.isEmpty then "。" ++ note else "") ++ "）。")
  -- 仮引数の無い `?` の行（括りを開いた次の行など）。
  if rows.isEmpty then refuse "仮引数を `?` の左に並べた1行の括り（`[x ? …]`）か、名前の定義にします。"
  -- 括りの中の欄の行 `m :` の下に仮引数を書いた形。
  let fieldAt : Option Nat := findLastIndex isFieldRow rows
  match fieldAt with
  | some fa =>
    if fa < rows.length - 1 then
      let field := dropFieldColon (rows.getD fa "")
      let ps := rows.drop (fa + 1)
      let oneLine := if !ps.any isDefRow && !body.isEmpty then
          some ("欄の1行（`" ++ field ++ " : " ++ quoted (" ".intercalate ps) ++ " ? " ++ quoted body ++ "`）") else none
      let inBody ← match f with
        | some f => if f.place == .body then pure true else questionBeforeBracket f.head f.at_
        | none => pure false
      if inBody then choose oneLine ("ファイルの名前の定義（" ++ block "名前" ps ++ "）") "にして、ここではその名前を書きます"
      choose oneLine ("字下げの欄のブロック（" ++ block field ps ++ "。字下げは欄の行から数え、括りで書いた構造体は字下げのブロックで書きます）") "にします"
  | none => pure ()
  -- 前の行が定義の行で、字下げが仮引数のブロックの形でなければ、`?` はその行の続き。
  if !shape && isDefRow prev && !body.isEmpty then
    refuse ("`?` は前の行の終わりに続けて書きます（`" ++ quoted prev ++ " ? " ++ quoted body ++ "`）。")
  let oneLine := if !rows.any isDefRow && !body.isEmpty then
      some ("1行の括り（`[" ++ quoted (" ".intercalate rows) ++ " ? " ++ quoted body ++ "]`）") else none
  let m : Option String := match f with
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
    | some f => f.place != .default && endsWithColonValue (" " ++ slice (toChars f.head) 0 f.at_)
    | none => false
  if nested then
    choose oneLine ("ファイルの名前の定義（" ++ block "名前" rows ++ "）") "にして、ここではその名前を書きます"
      (if valueOfColon then "枝の値・既定値の値に仮引数のブロックの関数は置けません、§4 R134" else "")
  choose oneLine ("ファイルの名前の定義（" ++ block "名前" rows ++ "）") "にして、その名前を書きます"

/-! ## markBlock（lexer.js:532） -/

/-- 処理行の中身を置いた所（lexer.js:530 の `track.segs` の要素）：出力の k 行目の col 桁目から、処理行 line の中身。 -/
structure Seg where
  k : Nat
  col : Nat
  line : Nat
  deriving Inhabited

/-- いちばん外の文（lexer.js:568 の `top`）。 -/
structure Top where
  logical : String
  hadBlock : Bool
  isDef : Bool

/--
markBlock の状態（lexer.js:533-568 の変数）。`result` の最後の行の長さを `lastLen` に控える。JS の `lastContentLineIdx` は
いつも「`result` が空なら -1、でなければ最後の添字」なので（push のたびに最後の添字にする）、`result` が空かで読む。
-/
structure MB where
  depth : Nat := 0
  result : Array String := #[]
  lastLen : Nat := 0
  bracketDepth : Int := 0
  written : Array Written := #[]
  frames : Array Frame := #[]
  sawBlank : Bool := false
  sawComment : Bool := false
  logical : String := ""
  top : Top := ⟨"", false, false⟩
  segs : Array Seg := #[]

/-- `result[lastContentLineIdx] += s`。 -/
def MB.appendLast (st : MB) (s : String) : MB :=
  { st with result := st.result.modify (st.result.size - 1) (· ++ s), lastLen := st.lastLen + (chars s).length }

/-- `result.push(s); lastContentLineIdx = result.length - 1`。 -/
def MB.pushRow (st : MB) (s : String) : MB :=
  { st with result := st.result.push s, lastLen := (chars s).length }

/-- `track.segs.push({ k: result.length - 1, col: result[result.length - 1].length - content.length, line: i })`。 -/
def MB.pushSeg (st : MB) (content : String) (i : Nat) : MB :=
  { st with segs := st.segs.push { k := st.result.size - 1, col := st.lastLen - (chars content).length, line := i } }

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

/-- `/^[\t ]*$/.test(line)`。 -/
def isBlankLine (line : String) : Bool := (chars line).all (fun c => c == '\t' || c == ' ')

/-- `n` 個の `c`（`c.repeat(n)`）。 -/
def rep (c : Char) (n : Nat) : String := String.ofList (List.replicate n c)

/-- lexer.js:570-717 の for の1回（処理行 i）。 -/
def markLine (commentLines : Array Bool) (i : Nat) (line : String) (st0 : MB) : M MB := do
  let mut st := st0
  -- 行頭のコメントの行（classifyNewlines が読み捨てた行）。空行には数えない。
  if commentLines.getD i false then
    return { st with sawComment := true }
  -- 空の処理行は読み捨てる（在ったことは覚える）。
  if isBlankLine line then
    return { st with sawBlank := true }
  let lc := chars line
  let nTabs := (lc.takeWhile (· == '\t')).length
  let content := String.ofList (lc.drop nTabs)
  let startsSp := (chars content).head? == some ' '
  let mut isContinuation := startsSp || (chars content).head? == some '?'
  if startsSp && st.result.isEmpty then
    syntaxError ("行頭の空白は前の行の続きですが、続ける行がありません（字下げは TAB だけです）: " ++ jsonStr line)
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
    syntaxError ("コメントの行の後なので、前の行へ続けられません（説明は式の上に書きます）: " ++ jsonStr line)
  -- いちばん外の空行は越えない。
  if isContinuation && st.sawBlank && (currentIndent == 0 || st.depth == 0) then
    if startsSp then syntaxError ("行頭の空白は前の行の続きですが、空行の後なので続ける行がありません: " ++ jsonStr line)
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
    if !st.result.isEmpty then st := st.appendLast (rep '\x03' (st.depth - currentIndent))
    st := { st with depth := currentIndent }
  if isContinuation then
    if !st.result.isEmpty then st := st.appendLast (" " ++ content) else st := st.pushRow content
  else if currentIndent > st.depth then
    if !st.result.isEmpty && st.sawComment then
      syntaxError ("コメントの行の後なので、前の行の下にブロックを開けません（説明は式の上に書きます）: " ++ jsonStr line)
    if !st.result.isEmpty && st.sawBlank && st.depth == 0 then
      syntaxError ("空行の後なので、前の行の下にブロックを開けません: " ++ jsonStr line)
    if !st.result.isEmpty then
      if !(← endsWithInfixOperator st.logical) then refuseBlockAfterValue st.logical content currentIndent
    if st.depth == 0 then
      let isDef ← hasTopLevelDefine st.top.logical
      st := { st with top := { st.top with hadBlock := true, isDef } }
    -- 深くなったら、深くなった段の数だけ INDENT（\x02）。
    let indents := rep '\x02' (currentIndent - st.depth)
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
def markBlock (input : String) (commentLines : Array Bool) : Except (Nat × FrontErr) (String × Array Seg) := do
  let st ← go (splitOnChar input '\r') 0 {}
  let st := if st.depth > 0 && !st.result.isEmpty then st.appendLast (rep '\x03' st.depth) else st
  return ("\r".intercalate st.result.toList, st.segs)
where
  go : List String → Nat → MB → Except (Nat × FrontErr) MB
    | [], _, st => pure st
    | l :: ls, i, st =>
      match markLine commentLines i l st with
      | .ok st => go ls (i + 1) st
      | .error e => .error (i, e)

/-! ## preprocessWithLines（lexer.js:736） -/

/-- lexer.js:759-762 の `for (const at = …; p < at; p++)`：p から at まで、空白でない字と LF を数える（1字ずつ、残りの数で構造の再帰）。 -/
def advance (m : Array Char) : Nat → Nat → Nat → Nat → Nat × Nat × Nat
  | 0, p, c, l => (p, c, l)
  | r + 1, p, c, l =>
    advance m r (p + 1) (if m[p]? != some ' ' then c + 1 else c) (if m[p]? == some '\n' then l + 1 else l)

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
lexer.js:745-786 の `lineAt` を、text の位置 0..（長さ）の全部で引いた表（`Pre.lineAt`）。

置いた所（segs）ごとに、marked の中のその位置の前の空白でない字の数（counts）・LF の数（lfs）・元の行（lines）を数え、
text の側は前からの空白でない字の数（nonSpace）と LF の数（lf）の表を作り、位置 o で `counts[j] ≤ nonSpace[o]` の最後の j を
二分探索で引く。答えは j < 0 なら 1、でなければ `lines[j] + lf[o] - lfs[j]`。
-/
def lineAtTable (marked text : String) (segs : Array Seg) (sourceLines : Array Nat) : M (Array Nat) := do
  let m := toChars marked
  let t := toChars text
  let starts : Array Nat :=
    (m.foldl (fun (acc : Array Nat × Nat) c => (if c == '\r' then acc.1.push (acc.2 + 1) else acc.1, acc.2 + 1)) (#[0], 0)).1
  let mut counts : Array Nat := #[]
  let mut lfs : Array Nat := #[]
  let mut lines : Array Nat := #[]
  let mut c := 0
  let mut l := 0
  let mut p := 0
  for s in segs do
    let some sk := starts[s.k]? | internalError "lineAt: segs の k が marked の行の外"
    let at_ := sk + s.col
    let (p', c', l') := advance m (at_ - p) p c l
    p := p'
    c := c'
    l := l'
    counts := counts.push c
    lfs := lfs.push l
    let some sl := sourceLines[s.line]? | internalError "lineAt: segs の line が sourceLines の外"
    lines := lines.push sl
  let mut nonSpace : Array Nat := #[0]
  let mut lf : Array Nat := #[0]
  for ch in t do
    nonSpace := nonSpace.push (nonSpace.back?.getD 0 + (if ch != ' ' then 1 else 0))
    lf := lf.push (lf.back?.getD 0 + (if ch == '\n' then 1 else 0))
  let mut out : Array Nat := Array.mkEmpty (t.size + 1)
  for o in [0:t.size + 1] do
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
断り（閉じない `` ` ``）は自分で行を持っている（:131）。
-/
def preprocessWithLines (input : String) : M Pre := do
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
def preprocess (input : String) : Except FrontErr Pre := preprocessWithLines input

end SignSem.Lex
