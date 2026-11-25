import SignSem.Syntax

/-!
# 文法（alpha1/javascript/sign.pegjs）の写し

alpha1 の前段の2つ目（B2）。peggy 4.2.0（alpha1/javascript/node_modules/peggy）が sign.pegjs から作る構文解析器の挙動を、
そのまま写す。的は文法の文面でなく、peggy が作った JS の動き（順序つきの選択、`*`・`+`、先読みの `&`・`!` と peg$silentFails、
`$` の字の取り出し、peg$maxFailPos と期待の集め方、error() の位置、最後まで読めなかった時の断り）。

- 入口は `parse : Pre → Except FrontErr (List WRow)`。返す行は Program の結果（sign.pegjs:57）で、行ごとに
  start は Expression の offset()（sign.pegjs:74 の rowAt）、line は `Pre.lineAt[start]`、qs は `?` の語の位置（sign.pegjs:76-79 の qAt）。
  位置は下の「文字列と位置」のとおり符号単位の番号のまま。
- 断りは JS の throw の写しで、name は `"SyntaxError"`、reason は無し。line は frontEnd（resolve.js:250-252）と同じく
  断りの位置（location.start.offset）の `Pre.lineAt`。
- 写した JS は、sign.pegjs の規則と、peggy が作る parser の source（`peggy.generate(文法, {output: "source", format: "es"})`、
  以下「生成物」。peggy の版が同じなら同じ字になる）の関数、peggy の雛形（node_modules/peggy/lib/compiler/passes/generate-js.js）。
  各定義の頭に file:line を書く。生成物の行は、上の呼び方で書き出した file の行。
- 名前は生成物の関数（`peg$parseX` → `parseX`）に揃える。生成物が関数の中に書く繰り返し（`while`）と Block の選択肢は、
  `parseXLines`・`parseXTail`・`parseBlockBracket` などの別の定義にした。並びは生成物の順で、ただし Lean は使う前に定義が要るので、
  互いに呼ばない規則（字だけを読む物）を先に、互いに呼ぶ規則（Program・Line・Expression・TermAt・Term・Prefixes・Core・Block・
  Expressions・prefix）を後の mutual に置いた。

## 文字列と位置

文字列は JS の文字列（`JStr`、UTF-16 の符号単位の並び）のまま持つ。解析は JS と同じく `Pre.text` の符号単位の上で行う（`In.units` の
k 番目が JS の `input.charCodeAt(k)`）。字の組の判定（`input.charAt(pos)` を正規表現に当てる。この文法の正規表現に u の旗は無い）も
1単位ずつなので、BMP の外の字はサロゲートの片方ずつを見る（`\😀` の `\` は前の半分だけを取り、後ろの半分で止まる）。
返す文字列（`$( … )` の字の取り出し、語、断りの文）も符号単位から直に作るので、対の無いサロゲートは対の無いまま出る（断りの文の
found が対の片方の時、`Pre.text` に対の無いサロゲートがある時）。断りの文の期待の並べ（`descriptions.sort()`）は符号単位の辞書式（`JStr.lt`）。

返す位置（WRow の start・qs）は peg$currPos（符号単位の番号）のままで、dump.mjs が書く peggy の offset と同じ。行は `Pre.lineAt`
（添え字は同じ符号単位の位置、大きさは単位の数 + 1）をその位置で引く。対の後ろの半分を指す位置（断りの位置だけがそうなる）も
1つの位置で、そこの lineAt を引く。

## 止まること

再帰は燃料（`fuel`）で数える。燃料は「呼び出しの深さ」で、互いに呼ぶ関数（下の mutual の 17 個）の1回の呼び出しで1つ減る。
互いに呼ぶ関数の輪はどれも、輪を1周する間に符号単位を1つ以上読む（括りの開き・`-`・語・`\r` など）ので、呼び出しの道の上で同じ関数が同じ位置で
2度呼ばれることはない。だから道の長さは 17 ×（符号単位の数 + 1）を超えない。燃料はそれより多い `fuelOf n = 20 * (n + 1)` にした（n は符号単位の数）。
尽きたら FrontErr の name `"InternalError"` で返す（起きないはず）。字の繰り返し（`" "*` など）は、1回で符号単位を1つ以上読むので、
残りの符号単位の数 + 1 回で必ず止まる。その回数を燃料にする（`starAux`）。`partial def` は使わない。

## 公理

`#print axioms SignSem.Peg.parse` は `[propext]` だけ（Classical.choice は出ない。SignSem/Axioms.lean で固める）。Lean 4.36 の
String の `==`・`String.toList`・`String.length` は Classical.choice に依るので、Lean の String は字面と `internalError` の文を
`JStr` にする所（`Coe String JStr` の `JStr.ofString`、公理なし）でだけ使い、比べには使わない。文字列は JStr の `==`（単位ごと、
公理なし）と `JStr.lt` で、符号単位は Nat の `==`・`≤` で比べる。

## 確かめ（2026-11-25）

比べは `signsem check`（Main.lean）で、JS の答え（node v24.16.0 と peggy 4.2.0 で formal/check/sem/dump.mjs と gen の道具が書いた stages）と
写しの答えを JV の値の `==` で比べた。文字列は UTF-16 の単位ごとに比べ、対の無いサロゲートもそのまま比べる。位置は peggy の offset（単位の番号）のまま。
formal/check/sem/gate.mjs の 20 個の集まりの全部で、文法の段を当てた 2,064,121 行（通る 778,875・断る 1,285,246）に違いは無く、
外したのは下の id 1193 の1行だけ。集まりごとには次のとおり。

- formal/check/out/sem/stages.jsonl.gz の全部の行 354,751 本：b1 が通る 354,628 本のうち、id 1193（括り 2 万段。JS は RangeError の
  スタックの溢れ）を外した 354,627 本で、b2 と全部合う（rows 354,619 本・断り 8 本、message と line まで）。b1 が断る 123 本は入力が無いので飛ばした。
  id 1193 は、この写しでは燃料が尽きずに rows を返し、スタックを 512 MB にした Worker で peggy の parser が返す rows と同じ。
- 前段を通す源（dump.mjs の答えと比べた。formal/check/out/sem/ の pegrev_* と peg_*）：手書き 189 本（stages で通らない生成物の枝を通す物）、
  BMP の外の字の手書き 7 本、乱れた源 40,000 本（b1 が通る 29,080 本）、BMP の外の字を混ぜた乱れた源 10,000 本（同 7,310 本）、前の手書き 36 本で全部合う。
  stages とこれらで、前処理を通る源から届く生成物の塊は全部通った（残りは先読みの中の peg$fail など通らない塊と、閉じの無い行頭の ` の comment）。
- 前処理を通さない字の並び（peg_fuzz・peg_rawfuzz・peg_rawfuzz2）：155,903 本と 250,000 本（BMP の外の字 97,055 本・
  対にならないサロゲート 53,852 本を含む）で、peggy の parser の答えと全部合う。
-/

namespace SignSem.Peg

/-! ## 期待（peggy の expectation） -/

/--
字の組の部分（generate-js.js:1231-1233 の peg$classExpectation の parts の要素）。1字か、`a-z` の範囲（JS の `[lo, hi]`）。
この文法の組の字はどれも ASCII なので、JS の1字の文字列 `c` の `charCodeAt(0)` は `c.toNat`。
-/
inductive CPart where
  | ch (c : Char)
  | range (lo hi : Char)
  deriving Inhabited

/--
期待（generate-js.js:1227-1241 の peg$literalExpectation・peg$classExpectation・peg$anyExpectation・peg$endExpectation）。
`other`（expected() の物）はこの文法では作らない。literal の text は JS の文字列（読みにも説明にも使う）。
-/
inductive Expect where
  | literal (text : JStr)
  | cls (parts : List CPart) (inverted : Bool)
  | any
  | endOfInput
  deriving Inhabited

/--
字の組の判定（生成物の `peg$rN.test(input.charAt(peg$currPos))`、正規表現は parts と同じ物から作られる）。u は符号単位
（正規表現に u の旗が無いので、JS も1単位ずつ比べる）。
-/
def CPart.has (u : Nat) : CPart → Bool
  | .ch d => u == d.toNat
  | .range lo hi => decide (lo.toNat ≤ u) && decide (u ≤ hi.toNat)

def clsTest (parts : List CPart) (inverted : Bool) (u : Nat) : Bool :=
  parts.any (CPart.has u) != inverted

/-! 生成物の期待の定数（parser_gen の peg$e0〜peg$e41、生成物:221-262）。番号は生成物と同じ。 -/

/-- 生成物:221 `peg$e0 = peg$literalExpectation(" ", false)` -/
def e0 : Expect := .literal " "
/-- 生成物:222 -/
def e1 : Expect := .literal "\x02"
/-- 生成物:223（`_e` の `" " / EOL` は peggy が字の組 `[\r ]` に畳む） -/
def e2 : Expect := .cls [.ch '\r', .ch ' '] false
/-- 生成物:224 -/
def e3 : Expect := .literal "\r"
/-- 生成物:225（EOF の `.`。いつも先読みの中なので記録されない） -/
def e4 : Expect := .any
/-- 生成物:226 -/
def e5 : Expect := .literal "`"
/-- 生成物:227 -/
def e6 : Expect := .cls [.ch '\r', .ch '\n', .ch '`'] true
/-- 生成物:228 -/
def e7 : Expect := .cls [.ch '@', .ch '~', .ch '!', .ch ' '] false
/-- 生成物:229 -/
def e8 : Expect := .cls [.ch '\r', .ch '\n'] true
/-- 生成物:230 -/
def e9 : Expect := .literal "["
/-- 生成物:231 -/
def e10 : Expect := .literal "]"
/-- 生成物:232 -/
def e11 : Expect := .literal "{"
/-- 生成物:233 -/
def e12 : Expect := .literal "}"
/-- 生成物:234 -/
def e13 : Expect := .literal "("
/-- 生成物:235 -/
def e14 : Expect := .literal ")"
/-- 生成物:236 -/
def e15 : Expect := .literal "||"
/-- 生成物:237（`"]" / "}" / ")" / "\x03"` を peggy が字の組に畳む） -/
def e16 : Expect := .cls [.ch '\x03', .ch ')', .ch ']', .ch '}'] false
/-- 生成物:238 -/
def e17 : Expect := .literal "|"
/-- 生成物:239 -/
def e18 : Expect := .literal "\x03"
/-- 生成物:240 -/
def e19 : Expect := .cls [.ch '`', .ch '\r', .ch '\n'] true
/-- 生成物:241 -/
def e20 : Expect := .literal "\\"
/-- 生成物:242 -/
def e21 : Expect := .cls [.ch '\r'] true
/-- 生成物:243 -/
def e22 : Expect := .literal "-"
/-- 生成物:244 -/
def e23 : Expect := .cls [.range '0' '9'] false
/-- 生成物:245 -/
def e24 : Expect := .literal "."
/-- 生成物:246 -/
def e25 : Expect := .literal "x"
/-- 生成物:247 -/
def e26 : Expect := .literal "0r"
/-- 生成物:248 -/
def e27 : Expect := .literal "0b"
/-- 生成物:249（`"0" / "1"` を peggy が字の組に畳む） -/
def e28 : Expect := .cls [.range '0' '1'] false
/-- 生成物:250 -/
def e29 : Expect := .literal "u"
/-- 生成物:251 -/
def e30 : Expect := .cls [.range 'a' 'z', .range 'A' 'Z'] false
/-- 生成物:252 -/
def e31 : Expect := .cls [.range 'a' 'z', .range 'A' 'Z', .range '0' '9', .ch '_'] false
/-- 生成物:253 -/
def e32 : Expect := .literal "_"
/-- 生成物:254 -/
def e33 : Expect := .cls [.range '0' '9', .range 'a' 'f', .range 'A' 'F'] false
/-- 生成物:255 -/
def e34 : Expect := .literal "###"
/-- 生成物:256 -/
def e35 : Expect := .literal "##"
/-- 生成物:257 -/
def e36 : Expect := .literal "#"
/-- 生成物:258 -/
def e37 : Expect := .literal "~"
/-- 生成物:259 -/
def e38 : Expect := .literal "!!"
/-- 生成物:260（prefix の `"!" / "$" / "@"` を peggy が字の組に畳む） -/
def e39 : Expect := .cls [.ch '!', .ch '$', .ch '@'] false
/-- 生成物:261（postfix の `"!" / "~" / "@"`） -/
def e40 : Expect := .cls [.ch '!', .ch '@', .ch '~'] false
/-- 生成物:262（operator の字の組） -/
def e41 : Expect :=
  .cls [.ch '!', .ch '"', .ch '#', .ch '$', .ch '%', .ch '&', .ch '\'', .ch '-', .ch '=', .ch '^', .ch '~', .ch '|',
    .ch '@', .ch ';', .ch '+', .ch ':', .ch '*', .ch ',', .ch '<', .ch '>', .ch '/', .ch '?'] false

/-! ## 断りの文（peg$SyntaxError.buildMessage、generate-js.js:974-1072） -/

/-- hex(ch)（generate-js.js:1003-1005）：符号単位 `ch.charCodeAt(0)` を16進の大文字で（`toString(16).toUpperCase()`）。 -/
def hexUpper (n : Nat) : JStr := ⟨(Nat.toDigits 16 n).foldl (fun acc c => acc.push (JStr.unitOf c.toUpper)) #[]⟩

/--
literalEscape・classEscape の終わりの2つ（generate-js.js:1015-1016・1029-1030）：制御の単位を `\x0H`・`\xHH` に。
ほかの単位（対の片方も）は、その1単位の文字列のまま。
-/
def ctlEscape (u : Nat) : JStr :=
  if u ≤ 0x0F then "\\x0" ++ hexUpper u
  else if u ≤ 0x1F || (0x7F ≤ u && u ≤ 0x9F) then "\\x" ++ hexUpper u
  else JStr.fromCharCode u

/--
literalEscape（generate-js.js:1007-1017）の1単位ぶん。JS は文字列全体に置き換えを順に当てる（正規表現に u の旗は無く、1単位ずつ当たる）が、
前の置き換えが出す字（`\`・`"`・`0`・英字）は後の置き換えに当たらないので、1単位ずつ当てるのと同じ。
-/
def literalEscapeUnit (u : Nat) : JStr :=
  if u == '\\'.toNat then "\\\\"
  else if u == '"'.toNat then "\\\""
  else if u == 0x00 then "\\0"
  else if u == '\t'.toNat then "\\t"
  else if u == '\n'.toNat then "\\n"
  else if u == '\r'.toNat then "\\r"
  else ctlEscape u

/-- literalEscape（generate-js.js:1007-1017）。 -/
def literalEscape (s : JStr) : JStr := s.units.foldl (fun acc u => acc ++ literalEscapeUnit u.toNat) JStr.empty

/-- classEscape（generate-js.js:1019-1031）の1単位ぶん。 -/
def classEscapeUnit (u : Nat) : JStr :=
  if u == '\\'.toNat then "\\\\"
  else if u == ']'.toNat then "\\]"
  else if u == '^'.toNat then "\\^"
  else if u == '-'.toNat then "\\-"
  else if u == 0x00 then "\\0"
  else if u == '\t'.toNat then "\\t"
  else if u == '\n'.toNat then "\\n"
  else if u == '\r'.toNat then "\\r"
  else ctlEscape u

/-- DESCRIBE_EXPECTATION_FNS（generate-js.js:975-1000）と describeExpectation（generate-js.js:1033-1035）。 -/
def describeExpectation : Expect → JStr
  | .literal t => "\"" ++ literalEscape t ++ "\""
  | .cls parts inv =>
    let part : CPart → JStr
      | .ch c => classEscapeUnit c.toNat
      | .range lo hi => classEscapeUnit lo.toNat ++ "-" ++ classEscapeUnit hi.toNat
    ("[" : JStr) ++ (if inv then ("^" : JStr) else JStr.empty) ++ JStr.join (parts.map part) ++ "]"
  | .any => "any character"
  | .endOfInput => "end of input"

/--
並べた所へ1つ入れる。同じ物があれば入れない（`descriptions.sort()` の後の重複の除き、generate-js.js:1041-1052 と同じ結果）。
並べは JS の既定の sort の比べ（符号単位の辞書式、`JStr.lt`）、同じかは `!==` の逆（単位ごとに同じか、JStr の `==`）。
-/
def insertUniq (d : JStr) : List JStr → List JStr
  | [] => [d]
  | x :: xs =>
    if d == x then x :: xs
    else if JStr.lt d x then d :: x :: xs
    else x :: insertUniq d xs

/-- `descriptions.slice(0, -1).join(", ") + ", or " + 最後`（generate-js.js:1061-1063）。空の時は JS と同じく `", or undefined"`。 -/
def joinOr : List JStr → JStr
  | [] => ", or undefined"
  | [d] => ", or " ++ d
  | ds => JStr.intercalate ", " ds.dropLast ++ ", or " ++ ds.getLastD JStr.empty

/-- describeExpected（generate-js.js:1037-1065）。 -/
def describeExpected (expected : List Expect) : JStr :=
  let ds := expected.foldl (fun acc e => insertUniq (describeExpectation e) acc) []
  match ds with
  | [d] => d
  | [d0, d1] => d0 ++ " or " ++ d1
  | _ => joinOr ds

/-- describeFound（generate-js.js:1067-1069）。found は `input.charAt(peg$maxFailPos)`（符号単位1つ。対の片方ならその片方のまま）か null。 -/
def describeFound : Option Nat → JStr
  | some u => "\"" ++ literalEscapeUnit u ++ "\""
  | none => "end of input"

/-- buildMessage（generate-js.js:1071）。 -/
def buildMessage (expected : List Expect) (found : Option Nat) : JStr :=
  "Expected " ++ describeExpected expected ++ " but " ++ describeFound found ++ " found."

/-! ## 状態と道具 -/

/--
解析の状態（生成物:316-321）。

- `pos`：peg$currPos。
- `maxFailPos`・`maxFailExpected`：peg$maxFailPos・peg$maxFailExpected。期待は頭が新しい（JS の push の逆順。並べてから使うので同じ）。
- `silentFails`：peg$silentFails。
-/
structure St where
  pos : Nat
  maxFailPos : Nat
  maxFailExpected : List Expect
  silentFails : Nat

/--
解析の入力。

- `text`：JS の `input`（`Pre.text`）。`$( … )` の字はここから切り出す。
- `units`：`text` の符号単位の値（`input.charCodeAt(k)` の表）。位置（peg$currPos）はこの番号。
- `lineAt`：符号単位の位置（0〜単位の数）から元の行を引く表（Pre.lineAt）。
-/
structure In where
  text : JStr
  units : Array Nat
  lineAt : Array Nat

/-- 符号単位の位置 u の元の行（frontEnd の `lineAt(offset)`、resolve.js:252・261）。 -/
def In.lineU (i : In) (u : Nat) : Option Nat := i.lineAt[u]?

/-- 解析の型。PEG の失敗（peg$FAILED）は `none`、JS の throw（error()）は `Except` の `error`。 -/
abbrev M := StateT St (Except FrontErr)

/-- 燃料が尽きた時の断り（JS には無い。起きないはず）。 -/
def internalError (what : String) : FrontErr :=
  { name := "InternalError", reason := none, line := none, message := s!"燃料が尽きた（{what}）" }

@[inline] def getPos : M Nat := do return (← get).pos

@[inline] def setPos (p : Nat) : M Unit := modify fun s => { s with pos := p }

/-- peg$fail（生成物:454-463、generate-js.js:1308-1317）。 -/
def pegFail (e : Expect) (s : St) : St :=
  if s.pos < s.maxFailPos then s
  else if s.maxFailPos < s.pos then { s with maxFailPos := s.pos, maxFailExpected := [e] }
  else { s with maxFailExpected := e :: s.maxFailExpected }

/-- 生成物の `if (peg$silentFails === 0) { peg$fail(e); }`（generate-js.js:734、op.FAIL）。 -/
def fail (e : Expect) : M Unit := modify fun s => if s.silentFails == 0 then pegFail e s else s

/-- 先読みの中（generate-js.js:771-779、SILENT_FAILS_ON・SILENT_FAILS_OFF）。中で throw した時は戻さないが、その時は解析ごと止まる。 -/
def silent {α : Type} (m : M α) : M α := do
  modify fun s => { s with silentFails := s.silentFails + 1 }
  let r ← m
  modify fun s => { s with silentFails := s.silentFails - 1 }
  return r

/--
`input.substr(pos, n) === text`（generate-js.js:671-688、MATCH_STRING。1字の時の `charCodeAt` も同じ）。text の符号単位を順に比べ、
合えば読み終わりの位置（ACCEPT_STRING・ACCEPT_N の `peg$currPos += n`、n は text の符号単位の数）を返す。燃料は text の残りの単位の数。
-/
def litAt (us : Array Nat) (t : JStr) (pos : Nat) : Option Nat := go 0 t.size
where
  go (k : Nat) : Nat → Option Nat
    | 0 => some (pos + k)
    | r + 1 => if us[pos + k]? == some (t.getD k 0).toNat then go (k + 1) r else none

/-- 字そのまま（literal）の一致。合えば読み進め（ACCEPT_STRING・ACCEPT_N）、合わなければ期待を記録する。 -/
def lit (i : In) (e : Expect) : M Bool := do
  let s ← get
  match e with
  | .literal t =>
    match litAt i.units t s.pos with
    | some p =>
      set { s with pos := p }
      return true
    | none =>
      fail e
      return false
  | _ =>
    fail e
    return false

/-- 字の組の一致（generate-js.js:700-706、MATCH_CHAR_CLASS）。入力の終わりでは `charAt` が空で、正規表現に当たらない。合えば読んだ符号単位を返す。 -/
def cls (i : In) (e : Expect) : M (Option Nat) := do
  let s ← get
  match i.units[s.pos]?, e with
  | some c, .cls parts inv =>
    if clsTest parts inv c then
      set { s with pos := s.pos + 1 }
      return some c
    else
      fail e
      return none
  | _, _ =>
    fail e
    return none

/-- 字の組の一致を Bool で。 -/
def clsB (i : In) (e : Expect) : M Bool := do return (← cls i e).isSome

/-- `x*`（生成物の `while (s !== peg$FAILED)`）。x は1回で1単位以上を読む物に限る。k は燃料。 -/
def starAux (step : M Bool) : Nat → M Unit
  | 0 => throw (internalError "star")
  | k + 1 => do
    if ← step then starAux step k else return ()

/-- `x*`：燃料は残りの符号単位の数 + 1（1回で1単位以上読むので、それより多くは回らない）。 -/
def star (i : In) (step : M Bool) : M Unit := do
  starAux step (i.units.size - (← getPos) + 1)

/-- `x+`：1回目が合えば `x*` を続ける（生成物の `if (s !== peg$FAILED) { while … } else { s = peg$FAILED; }`）。 -/
def plus (i : In) (step : M Bool) : M Bool := do
  if ← step then
    star i step
    return true
  else
    return false

/--
`$( … )` の字（generate-js.js:612、op.TEXT の `input.substring(s0, peg$currPos)`）。符号単位の a〜b をそのまま切り出す
（呼ぶ所ではいつも a ≤ b で、substring の a・b の入れ替えは起きない）。
-/
def text (i : In) (a b : Nat) : JStr := i.text.slice a b

/-! ## 字だけを読む規則（互いに呼ばない） -/

/-- `__`（sign.pegjs:25、生成物:486-543）：`" "+ / &"\x02"`。 -/
def parse__ (i : In) : M Bool := do
  if ← plus i (lit i e0) then return true
  let s1 ← getPos
  let ok ← silent (lit i e1)
  if ok then
    setPos s1
    return true
  else
    return false

/-- `_`（sign.pegjs:26、生成物:545-572）：`" "*`。失敗しない。 -/
def parse_ (i : In) : M Unit := star i (lit i e0)

/-- `_e`（sign.pegjs:27、生成物:574-601）：`(" " / EOL)*`（peggy が字の組 `[\r ]` に畳む）。失敗しない。 -/
def parse_e (i : In) : M Unit := star i (clsB i e2)

/-- SOL（sign.pegjs:32、生成物:603-615）：意味の述語。位置が 0 か、直前が `\r`。期待は記録しない。 -/
def parseSOL (i : In) : M Bool := do
  let o ← getPos
  return o == 0 || i.units[o - 1]? == some 13

/-- EOL（sign.pegjs:33、生成物:617-629）。 -/
def parseEOL (i : In) : M Bool := lit i e3

/-- EOF（sign.pegjs:34、生成物:631-652）：`!.`。中は先読みなので期待を記録せず、位置も変えない。 -/
def parseEOF (i : In) : M Bool := do
  return i.units.size ≤ (← getPos)

/-- comment（sign.pegjs:49、生成物:654-766）：`SOL "`" !([^\r\n`]* "`" [@~! ]) [^\r\n]* (EOL / EOF)`。返す物は null（Program が除く）。 -/
def parsecomment (i : In) : M Bool := do
  let s0 ← getPos
  if !(← parseSOL i) then
    setPos s0
    return false
  if !(← lit i e5) then
    setPos s0
    return false
  let s3 ← getPos
  let inner ← silent do
    let s4 ← getPos
    star i (clsB i e6)
    if ← lit i e5 then
      if ← clsB i e7 then
        return true
      else
        setPos s4
        return false
    else
      setPos s4
      return false
  if inner then
    setPos s3
    setPos s0
    return false
  star i (clsB i e8)
  if ← parseEOL i then return true
  if ← parseEOF i then return true
  setPos s0
  return false

/-- Hex（sign.pegjs:183、生成物:1946-1958）。 -/
def parseHex (i : In) : M Bool := clsB i e33

/-- string（sign.pegjs:172、生成物:1432-1488）：`$("`" [^`\r\n]* "`")`。 -/
def parsestring (i : In) : M (Option JStr) := do
  let s0 ← getPos
  if ← lit i e5 then
    star i (clsB i e19)
    if ← lit i e5 then return some (text i s0 (← getPos))
    setPos s0
    return none
  setPos s0
  return none

/-- charactor（sign.pegjs:176、生成物:1490-1528）：`$("\\" [^\r])`。 -/
def parsecharactor (i : In) : M (Option JStr) := do
  let s0 ← getPos
  if ← lit i e20 then
    if ← clsB i e21 then return some (text i s0 (← getPos))
    setPos s0
    return none
  setPos s0
  return none

/-- number（sign.pegjs:177、生成物:1530-1609）：`$("-"? [0-9]+ "."? [0-9]*)`。 -/
def parsenumber (i : In) : M (Option JStr) := do
  let s0 ← getPos
  let _ ← lit i e22
  if ← plus i (clsB i e23) then
    let _ ← lit i e24
    star i (clsB i e23)
    return some (text i s0 (← getPos))
  setPos s0
  return none

/-- address（sign.pegjs:178、生成物:1611-1679）：`$([0-9]+ "x" Hex+)`。 -/
def parseaddress (i : In) : M (Option JStr) := do
  let s0 ← getPos
  if ← plus i (clsB i e23) then
    if ← lit i e25 then
      if ← plus i (parseHex i) then return some (text i s0 (← getPos))
      setPos s0
      return none
    setPos s0
    return none
  setPos s0
  return none

/-- register（sign.pegjs:179、生成物:1681-1772）：`$("0r" Hex+) / $("0b" ("0" / "1")+)`。 -/
def parseregister (i : In) : M (Option JStr) := do
  let s0 ← getPos
  if ← lit i e26 then
    if ← plus i (parseHex i) then return some (text i s0 (← getPos))
    setPos s0
  else
    setPos s0
  if ← lit i e27 then
    if ← plus i (clsB i e28) then return some (text i s0 (← getPos))
    setPos s0
    return none
  setPos s0
  return none

/-- unicode（sign.pegjs:180、生成物:1774-1842）：`$([0-9]+ "u" Hex+)`。 -/
def parseunicode (i : In) : M (Option JStr) := do
  let s0 ← getPos
  if ← plus i (clsB i e23) then
    if ← lit i e29 then
      if ← plus i (parseHex i) then return some (text i s0 (← getPos))
      setPos s0
      return none
    setPos s0
    return none
  setPos s0
  return none

/-- identifier（sign.pegjs:182、生成物:1844-1944）：`$([a-zA-Z][a-zA-Z0-9_]*) / $("_" [a-zA-Z0-9_]+)` を `<…>` で包む。 -/
def parseidentifier (i : In) : M (Option JStr) := do
  let s0 ← getPos
  if ← clsB i e30 then
    star i (clsB i e31)
    return some ("<" ++ text i s0 (← getPos) ++ ">")
  setPos s0
  if ← lit i e32 then
    if ← plus i (clsB i e31) then return some ("<" ++ text i s0 (← getPos) ++ ">")
    setPos s0
    return none
  setPos s0
  return none

/-- unit（sign.pegjs:186、生成物:1960-1972）：`"_"`。 -/
def parseunit (i : In) : M (Option JStr) := do
  if ← lit i e32 then return some "_" else return none

/-- Atom（sign.pegjs:169-170、生成物:1403-1430）：string / charactor / address / register / unicode / number / identifier / unit。 -/
def parseAtom (i : In) : M (Option JStr) := do
  if let some a ← parsestring i then return some a
  if let some a ← parsecharactor i then return some a
  if let some a ← parseaddress i then return some a
  if let some a ← parseregister i then return some a
  if let some a ← parseunicode i then return some a
  if let some a ← parsenumber i then return some a
  if let some a ← parseidentifier i then return some a
  parseunit i

/-- postfix（sign.pegjs:192-193、生成物:2077-2089）：`"!" / "~" / "@"`（peggy が字の組 `[!@~]` に畳み、`input.charAt(peg$currPos)` を返す）。 -/
def parsepostfix (i : In) : M (Option JStr) := do
  return (← cls i e40).map JStr.fromCharCode

/-- Postfixes の `postfix*` の繰り返し（生成物:952-967 の while）。k は燃料（残りの符号単位の数 + 1）。 -/
def parsePostfixesAux (i : In) (acc : Array JStr) : Nat → M (List JStr)
  | 0 => throw (internalError "Postfixes")
  | k + 1 => do
    match ← parsepostfix i with
    | some p => parsePostfixesAux i (acc.push ("_" ++ p)) k
    | none => return acc.toList

/-- Postfixes（sign.pegjs:116-117、生成物:952-967）：`postfix*` の頭に `_` を付ける。 -/
def parsePostfixes (i : In) : M (List JStr) := do
  parsePostfixesAux i #[] (i.units.size - (← getPos) + 1)

/-- operator（sign.pegjs:195-196、生成物:2091-2124）：`$[!"#$%&'\-=^~\|@;+:*,<>/?]+`。 -/
def parseoperator (i : In) : M (Option JStr) := do
  let s0 ← getPos
  if ← plus i (clsB i e41) then return some (text i s0 (← getPos))
  return none

/-- 括りの印（sign.pegjs:128-160 の返す物の頭）。 -/
def tagBracket : JStr := "\"BRACKET_\""
def tagNorm : JStr := "\"NORM_\""
def tagAbs : JStr := "\"ABS_\""
def tagIndent : JStr := "\"INDENT_\""

/-- 行に `":"` の語があるか（sign.pegjs:9 の `line.includes(":")`）。 -/
def rowHasColon : WRow → Bool
  | .mk _ _ _ ws => ws.any fun w => match w with
    | .str s => s == (":" : JStr)
    | .blk _ _ => false

/--
refuseDefineInEnclosure（sign.pegjs:8-12）。囲みの中の行に `:` の語があれば error() で止める。error() の位置（生成物:365-371）は
peg$savedPos（囲みの書き始め、`start`）で、断りの line はそこの lineAt。
-/
def refuseDefineInEnclosure (i : In) (exprs : List WRow) (name : JStr) (start : Nat) : M Unit :=
  if exprs.any rowHasColon then
    throw { name := "SyntaxError", reason := none, line := i.lineU start,
            message := name ++ " の囲みの中には定義（`:`）を置けません。`:` は名前を付ける定義で値を返さないので、" ++ name ++
              " の域に入りません。" }
  else
    return ()

/-- 空の括り（sign.pegjs:136-138、生成物 parseBlock の 4〜6 番目、生成物:1090-1176）：`"[" _e "]"` など。 -/
def parseBlockEmpty (i : In) (eo ec : Expect) : M (Option Word) := do
  let s0 ← getPos
  if ← lit i eo then
    parse_e i
    if ← lit i ec then return some (.blk tagBracket [])
    setPos s0
    return none
  setPos s0
  return none

/-! ## 互いに呼ぶ規則 -/

/-- Term の返す物（sign.pegjs:93-107）。`op` は operator の字、`tm` は前置・核・後置（前置は `p_`、後置は `_p`）。 -/
inductive TermR where
  | op (s : JStr)
  | tm (pre : List JStr) (core : Word) (post : List JStr)

/-- Expression の `items.map((x) => x[0]).flat()`（sign.pegjs:72）の1項ぶん。Term の返す物（文字列、`[core]`、`[...pre, core, ...post]`）を1段ほどいた物。 -/
def TermR.words : TermR → List Word
  | .op s => [.str s]
  | .tm pre core post => pre.map Word.str ++ core :: post.map Word.str

/-- `x[0] === "?"`（sign.pegjs:77）：項が `?` の字そのものか。 -/
def TermR.isQ : TermR → Bool
  | .op s => s == ("?" : JStr)
  | .tm _ _ _ => false

mutual

/-- Program（sign.pegjs:57、生成物:768-832）：`lines:(…)* EOF`。 -/
def parseProgram (i : In) (fuel : Nat) : M (Option (List WRow)) :=
  match fuel with
  | 0 => throw (internalError "Program")
  | f + 1 => do
    let s0 ← getPos
    let lines ← parseProgramLines i f #[]
    if ← parseEOF i then return some lines.toList
    setPos s0
    return none

/-- Program の `(SOL @(comment / Line) EOL*)*`（sign.pegjs:57、生成物:771-821 の while）。comment の null は入れない（sign.pegjs:57 の filter）。 -/
def parseProgramLines (i : In) (fuel : Nat) (acc : Array WRow) : M (Array WRow) :=
  match fuel with
  | 0 => throw (internalError "Program")
  | f + 1 => do
    let s2 ← getPos
    if ← parseSOL i then
      if ← parsecomment i then
        star i (parseEOL i)
        parseProgramLines i f acc
      else
        match ← parseLine i f with
        | some r =>
          star i (parseEOL i)
          parseProgramLines i f (acc.push r)
        | none =>
          setPos s2
          return acc
    else
      setPos s2
      return acc

/-- Line（sign.pegjs:59-60、生成物:834-850）：`_ Expression _`。 -/
def parseLine (i : In) (fuel : Nat) : M (Option WRow) :=
  match fuel with
  | 0 => throw (internalError "Line")
  | f + 1 => do
    let s0 ← getPos
    parse_ i
    match ← parseExpression i f with
    | some r =>
      parse_ i
      return some r
    | none =>
      setPos s0
      return none

/--
Expression（sign.pegjs:66-81、生成物:852-898）：`head:TermAt tail:(__ @TermAt)*`。行は項を平らにした語の並びで、start は offset()（Expression の書き始め）、
line はそこの lineAt、qs は `?` の項の書き始め（左から）。
-/
def parseExpression (i : In) (fuel : Nat) : M (Option WRow) :=
  match fuel with
  | 0 => throw (internalError "Expression")
  | f + 1 => do
    let s0 ← getPos
    match ← parseTermAt i f with
    | some h =>
      let tail ← parseExpressionTail i f #[]
      let items := h :: tail.toList
      let words := items.flatMap fun x => x.1.words
      let qs := items.filterMap fun x => if x.1.isQ then some x.2 else none
      return some (.mk s0 (i.lineU s0) qs words)
    | none =>
      setPos s0
      return none

/-- Expression の `(__ @TermAt)*`（生成物:858-889 の while）。 -/
def parseExpressionTail (i : In) (fuel : Nat) (acc : Array (TermR × Nat)) : M (Array (TermR × Nat)) :=
  match fuel with
  | 0 => throw (internalError "Expression")
  | f + 1 => do
    let s3 ← getPos
    if ← parse__ i then
      match ← parseTermAt i f with
      | some t => parseExpressionTail i f (acc.push t)
      | none =>
        setPos s3
        return acc
    else
      setPos s3
      return acc

/-- TermAt（sign.pegjs:83、生成物:900-912）：項と、その書き始め（offset()）。 -/
def parseTermAt (i : In) (fuel : Nat) : M (Option (TermR × Nat)) :=
  match fuel with
  | 0 => throw (internalError "TermAt")
  | f + 1 => do
    let s0 ← getPos
    match ← parseTerm i f with
    | some t => return some (t, s0)
    | none => return none

/-- Term（sign.pegjs:93-107、生成物:914-933）：`pre:Prefixes core:Core post:Postfixes / operator`。 -/
def parseTerm (i : In) (fuel : Nat) : M (Option TermR) :=
  match fuel with
  | 0 => throw (internalError "Term")
  | f + 1 => do
    let s0 ← getPos
    let pre ← parsePrefixes i f
    match ← parseCore i f with
    | some c =>
      let post ← parsePostfixes i
      return some (.tm pre c post)
    | none =>
      setPos s0
      return (← parseoperator i).map TermR.op

/-- Prefixes（sign.pegjs:111-112、生成物:935-950）：`prefix*` の末尾に `_` を付ける。 -/
def parsePrefixes (i : In) (fuel : Nat) : M (List JStr) :=
  match fuel with
  | 0 => throw (internalError "Prefixes")
  | f + 1 => do
    let ps ← parsePrefixesLoop i f #[]
    return ps.toList.map fun p => p ++ "_"

/-- Prefixes の `prefix*`（生成物:940-944 の while）。 -/
def parsePrefixesLoop (i : In) (fuel : Nat) (acc : Array JStr) : M (Array JStr) :=
  match fuel with
  | 0 => throw (internalError "Prefixes")
  | f + 1 => do
    match ← parseprefix i f with
    | some p => parsePrefixesLoop i f (acc.push p)
    | none => return acc

/-- Core（sign.pegjs:119-121、生成物:969-978）：Block / Atom。 -/
def parseCore (i : In) (fuel : Nat) : M (Option Word) :=
  match fuel with
  | 0 => throw (internalError "Core")
  | f + 1 => do
    match ← parseBlock i f with
    | some w => return some w
    | none => return (← parseAtom i).map Word.str

/--
Block（sign.pegjs:127-160、生成物:980-1351）。順に `[…]`・`{…}`・`(…)`・`[]`・`{}`・`()`・`||…||`・`|…|`・字下げ。
-/
def parseBlock (i : In) (fuel : Nat) : M (Option Word) :=
  match fuel with
  | 0 => throw (internalError "Block")
  | f + 1 => do
    if let some w ← parseBlockBracket i f e9 e10 then return some w
    if let some w ← parseBlockBracket i f e11 e12 then return some w
    if let some w ← parseBlockBracket i f e13 e14 then return some w
    if let some w ← parseBlockEmpty i e9 e10 then return some w
    if let some w ← parseBlockEmpty i e11 e12 then return some w
    if let some w ← parseBlockEmpty i e13 e14 then return some w
    if let some w ← parseBlockEnclosure i f true then return some w
    if let some w ← parseBlockEnclosure i f false then return some w
    parseBlockIndent i f

/-- 括り（sign.pegjs:128-130、生成物 parseBlock の 1〜3 番目、生成物:983-1089）：`"[" _e Expressions _e "]"` など。 -/
def parseBlockBracket (i : In) (fuel : Nat) (eo ec : Expect) : M (Option Word) :=
  match fuel with
  | 0 => throw (internalError "Block")
  | f + 1 => do
    let s0 ← getPos
    if ← lit i eo then
      parse_e i
      match ← parseExpressions i f with
      | some ex =>
        parse_e i
        if ← lit i ec then return some (.blk tagBracket ex)
        setPos s0
        return none
      | none =>
        setPos s0
        return none
    setPos s0
    return none

/--
ノルムと絶対値（sign.pegjs:152-153、生成物:1177-1304）：`"||" Expressions "||" &(__ / EOL / EOF / "]" / "}" / ")" / "\x03")`
（norm が真）と `"|" Expressions "|" &(…)`。合えば refuseDefineInEnclosure を当てる。
-/
def parseBlockEnclosure (i : In) (fuel : Nat) (norm : Bool) : M (Option Word) :=
  match fuel with
  | 0 => throw (internalError "Block")
  | f + 1 => do
    let e := if norm then e15 else e17
    let s0 ← getPos
    if ← lit i e then
      match ← parseExpressions i f with
      | some ex =>
        if ← lit i e then
          let s4 ← getPos
          let ok ← silent do
            if ← parse__ i then return true
            if ← parseEOL i then return true
            if ← parseEOF i then return true
            clsB i e16
          if ok then
            setPos s4
            if norm then
              refuseDefineInEnclosure i ex "`||…||`" s0
              return some (.blk tagNorm ex)
            else
              refuseDefineInEnclosure i ex "`|…|`" s0
              return some (.blk tagAbs ex)
          setPos s0
          return none
        setPos s0
        return none
      | none =>
        setPos s0
        return none
    setPos s0
    return none

/-- 字下げ（sign.pegjs:160、生成物:1305-1340）：`"\x02" _ Expressions _ "\x03"`。3つ目の `"_DEDENT"` は持たない。 -/
def parseBlockIndent (i : In) (fuel : Nat) : M (Option Word) :=
  match fuel with
  | 0 => throw (internalError "Block")
  | f + 1 => do
    let s0 ← getPos
    if ← lit i e1 then
      parse_ i
      match ← parseExpressions i f with
      | some ex =>
        parse_ i
        if ← lit i e18 then return some (.blk tagIndent ex)
        setPos s0
        return none
      | none =>
        setPos s0
        return none
    setPos s0
    return none

/-- Expressions（sign.pegjs:163-166、生成物:1353-1401）：`head:Expression tail:(EOL _ @Expression)*`。 -/
def parseExpressions (i : In) (fuel : Nat) : M (Option (List WRow)) :=
  match fuel with
  | 0 => throw (internalError "Expressions")
  | f + 1 => do
    let s0 ← getPos
    match ← parseExpression i f with
    | some h =>
      let t ← parseExpressionsTail i f #[]
      return some (h :: t.toList)
    | none =>
      setPos s0
      return none

/-- Expressions の `(EOL _ @Expression)*`（生成物:1359-1392 の while）。 -/
def parseExpressionsTail (i : In) (fuel : Nat) (acc : Array WRow) : M (Array WRow) :=
  match fuel with
  | 0 => throw (internalError "Expressions")
  | f + 1 => do
    let s3 ← getPos
    if ← parseEOL i then
      parse_ i
      match ← parseExpression i f with
      | some r => parseExpressionsTail i f (acc.push r)
      | none =>
        setPos s3
        return acc
    else
      setPos s3
      return acc

/--
prefix（sign.pegjs:189-190、生成物:1974-2075）：`"###" / "##" / "#" / $("-" &(Block / identifier / unit)) / "~" / "!!" / "!" / "$" / "@"`。
`-` の後の先読みは Block の action も走らせる（中の refuseDefineInEnclosure の error() は先読みの中でも止める）。
最後の `"!" / "$" / "@"` は peggy が字の組 `[!$@]` に畳み、`input.charAt(peg$currPos)` を返す。
-/
def parseprefix (i : In) (fuel : Nat) : M (Option JStr) :=
  match fuel with
  | 0 => throw (internalError "prefix")
  | f + 1 => do
    if ← lit i e34 then return some "###"
    if ← lit i e35 then return some "##"
    if ← lit i e36 then return some "#"
    let s1 ← getPos
    if ← lit i e22 then
      let s3 ← getPos
      let ok ← silent do
        match ← parseBlock i f with
        | some _ => return true
        | none =>
          match ← parseidentifier i with
          | some _ => return true
          | none => return (← parseunit i).isSome
      if ok then
        setPos s3
        return some (text i s1 (← getPos))
      setPos s1
    else
      setPos s1
    if ← lit i e37 then return some "~"
    if ← lit i e38 then return some "!!"
    return (← cls i e39).map JStr.fromCharCode

end

/-- Start（sign.pegjs:15、生成物:478-484）：`Start = Program`。 -/
def parseStart (i : In) (fuel : Nat) : M (Option (List WRow)) := parseProgram i fuel

/-- 燃料：互いに呼ぶ関数の数（17）より多い 20 を、符号単位の数 + 1 に掛ける（頭の注の「止まること」）。 -/
def fuelOf (n : Nat) : Nat := 20 * (n + 1)

/-- 解析の入力を Pre から作る（text と、その符号単位の値の表と、行の表）。 -/
def inOf (p : Pre) : In :=
  { text := p.text, units := p.text.codes, lineAt := p.lineAt }

/--
入口（生成物:169-2165 の peg$parse(input, options) を、options に rowAt・qAt を渡して呼んだ物）。
最後まで読めなければ、peg$maxFailExpected・peg$maxFailPos から断りを作る（生成物:2150-2164、generate-js.js:1400-1412）。
断りの line は frontEnd（resolve.js:250-252）と同じく、断りの位置の lineAt。
-/
def parse (p : Pre) : Except FrontErr (List WRow) := do
  let i := inOf p
  let n := i.units.size
  let (r, s) ← (parseStart i (fuelOf n)).run { pos := 0, maxFailPos := 0, maxFailExpected := [], silentFails := 0 }
  match r with
  | some rows =>
    if s.pos == n then return rows
    else
      -- `peg$result !== peg$FAILED && peg$currPos < input.length` の時は終わりの期待を足す（生成物:2153-2155）
      let s := if s.pos < n then pegFail .endOfInput s else s
      throw (syntaxErr i s)
  | none => throw (syntaxErr i s)
where
  /--
  peg$buildStructuredError(peg$maxFailExpected, found, location)（生成物:2157-2163）の断り。found は
  `peg$maxFailPos < input.length ? input.charAt(peg$maxFailPos) : null`（符号単位1つ。対の片方ならその片方のまま）。
  -/
  syntaxErr (i : In) (s : St) : FrontErr :=
    { name := "SyntaxError", reason := none, line := i.lineU s.maxFailPos,
      message := buildMessage s.maxFailExpected i.units[s.maxFailPos]? }

/-! ## 確かめ（対の無いサロゲート。期待は node v24.16.0 で peggy 4.2.0 の parser から取った値）

`Pre.lineAt` の k 番目を `10 + k` にして、行がどの符号単位の位置で引かれたかも見る。
-/

/-- 確かめの Pre（`lineAt` の k 番目は `10 + k`、大きさは text の符号単位の数 + 1）。 -/
private def preOf (us : Array UInt16) : Pre :=
  { text := ⟨us⟩, lineAt := (List.range (us.size + 1)).foldl (fun a k => a.push (10 + k)) #[] }

-- `\😀`：charactor が `\` と前の半分を取り、後ろの半分で止まる。found は `\ude00`、断りの位置は対の後ろの半分（単位の位置 2）
#guard match parse (preOf #[0x5C, 0xD83D, 0xDE00]) with
  | .error e => e.name == "SyntaxError" && e.reason.isNone && e.line == some 12 &&
    e.message == ("Expected \" \", \"\\r\", or [!@~] but \"" : JStr) ++ ⟨#[0xDE00]⟩ ++ "\" found."
  | .ok _ => false

-- `a \ude00`・`a \ud800`・`😀`・`\ufffd`：found は対の片方のまま（U+FFFD と分かれる）
#guard
  let exp : JStr := "Expected \" \", \"!!\", \"#\", \"##\", \"###\", \"(\", \"-\", \"0b\", \"0r\", \"[\", \"\\\\\", \"\\r\", \"\\x02\", \"_\", \"`\", \"{\", \"|\", \"||\", \"~\", [!\"#$%&'\\-=\\^~|@;+:*,<>/?], [!$@], [0-9], or [a-zA-Z] but \""
  let expNoR : JStr := "Expected \" \", \"!!\", \"#\", \"##\", \"###\", \"(\", \"-\", \"0b\", \"0r\", \"[\", \"\\\\\", \"\\x02\", \"_\", \"`\", \"{\", \"|\", \"||\", \"~\", [!\"#$%&'\\-=\\^~|@;+:*,<>/?], [!$@], [0-9], or [a-zA-Z] but \""
  let msg (us : Array UInt16) : Option JStr := match parse (preOf us) with
    | .error e => some e.message
    | .ok _ => none
  msg #[0x61, 0x20, 0xDE00] == some (exp ++ ⟨#[0xDE00]⟩ ++ "\" found.") &&
  msg #[0x61, 0x20, 0xD800] == some (exp ++ ⟨#[0xD800]⟩ ++ "\" found.") &&
  msg #[0xD83D, 0xDE00] == some (expNoR ++ ⟨#[0xD83D]⟩ ++ "\" found.") &&
  msg #[0xFFFD] == some (expNoR ++ ⟨#[0xFFFD]⟩ ++ "\" found.")

-- `a\u0001`：制御の字は `\x01`
#guard match parse (preOf #[0x61, 0x01]) with
  | .error e => e.line == some 11 &&
    e.message == ("Expected \" \", \"\\r\", [!@~], or [a-zA-Z0-9_] but \"\\x01\" found." : JStr)
  | .ok _ => false

-- `\\\ud800 x`・`\\\udc00`・`` `a\ud800b` c ``：語に対の無いサロゲートがそのまま入る
#guard match parse (preOf #[0x5C, 0xD800, 0x20, 0x78]) with
  | .ok [.mk 0 (some 10) [] [.str a, .str b]] => a == ⟨#[0x5C, 0xD800]⟩ && b == ("<x>" : JStr)
  | _ => false
#guard match parse (preOf #[0x5C, 0xDC00]) with
  | .ok [.mk 0 (some 10) [] [.str a]] => a == ⟨#[0x5C, 0xDC00]⟩
  | _ => false
#guard match parse (preOf #[0x60, 0x61, 0xD800, 0x62, 0x60, 0x20, 0x63]) with
  | .ok [.mk 0 (some 10) [] [.str a, .str b]] => a == ⟨#[0x60, 0x61, 0xD800, 0x62, 0x60]⟩ && b == ("<c>" : JStr)
  | _ => false

-- `?` の位置（符号単位の位置のまま）：`` `😀` ? x `` は 5、逆さの対 `` `\ude00\ud83d` ? x `` は 5、`` `\ude00😀` ? x `` は 6
#guard match parse (preOf #[0x60, 0xD83D, 0xDE00, 0x60, 0x20, 0x3F, 0x20, 0x78]) with
  | .ok [.mk 0 (some 10) [5] [.str a, .str q, .str x]] =>
    a == ⟨#[0x60, 0xD83D, 0xDE00, 0x60]⟩ && q == ("?" : JStr) && x == ("<x>" : JStr)
  | _ => false
#guard match parse (preOf #[0x60, 0xDE00, 0xD83D, 0x60, 0x20, 0x3F, 0x20, 0x78]) with
  | .ok [.mk 0 (some 10) [5] [.str a, .str q, .str x]] =>
    a == ⟨#[0x60, 0xDE00, 0xD83D, 0x60]⟩ && q == ("?" : JStr) && x == ("<x>" : JStr)
  | _ => false
#guard match parse (preOf #[0x60, 0xDE00, 0xD83D, 0xDE00, 0x60, 0x20, 0x3F, 0x20, 0x78]) with
  | .ok [.mk 0 (some 10) [6] [.str a, _, _]] => a == ⟨#[0x60, 0xDE00, 0xD83D, 0xDE00, 0x60]⟩
  | _ => false

-- `|a : 1|`：refuseDefineInEnclosure の断り（位置 0 の行）
#guard match parse (preOf #[0x7C, 0x61, 0x20, 0x3A, 0x20, 0x31, 0x7C]) with
  | .error e => e.line == some 10 &&
    e.message == ("`|…|` の囲みの中には定義（`:`）を置けません。`:` は名前を付ける定義で値を返さないので、`|…|` の域に入りません。" : JStr)
  | .ok _ => false

-- `[a`：入力の終わり
#guard match parse (preOf #[0x5B, 0x61]) with
  | .error e => e.line == some 12 &&
    e.message == ("Expected \" \", \"\\r\", \"]\", [!@~], [\\r ], or [a-zA-Z0-9_] but end of input found." : JStr)
  | .ok _ => false

end SignSem.Peg
