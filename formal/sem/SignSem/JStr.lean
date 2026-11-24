/-!
# JS の文字列（UTF-16 の符号単位の並び）

alpha1/javascript が扱う文字列は ECMA-262 の String 型（§6.1.4）で、UTF-16 の符号単位（16 bit）の並び。写しはこの型をそのまま
持つ（`JStr`）。

- 長さと位置は符号単位で数える（JS の `.length`・`s[k]`・`charCodeAt(k)`・`slice`）。BMP の外の字は対の2単位。
- 等しさは単位ごとの等しさ（JS の `===`）。順序は単位の辞書式（JS の `<` と、比べの関数を渡さない `Array.prototype.sort()`）。
- 対の無いサロゲート（対になっていない 0xD800〜0xDFFF の単位）も、ほかの単位と同じ1つの値で、U+FFFD に替えない。
- Lean の String と Char を通さない。String は対の無いサロゲートを持てず、`Char.ofNat 0xD800` は `'\0'` になる。だから
  `ToString JStr` と `Coe JStr String` は置かない（`s!` に JStr を入れると組めない。文は JStr の `++` で組む）。String から JStr へは
  `ofString` で、`Coe String JStr` があるので字面の文字列はそのまま JStr の所に書ける。JStr から String へは `toStringPhi` だけ。
- 公理：ここの定義は Classical.choice に依らない（`#print axioms` は SignSem/Axioms.lean で固める）。Lean 4.36 の UInt16 の `==` は
  choice に依るので、`instBEqUInt16Decide` で置き換える。UInt16 の `<`・`≤`（`UInt16.decLt`・`UInt16.decLe`）はそのままで公理なし。
- import は Init だけ。
-/

namespace SignSem

/--
UInt16 の `==` を `decide (a = b)`（`UInt16.decEq`、公理なし）で決める。Lean 4.36 の UInt16 の `==` は順序の包み
（`instLinearOrderPackageUInt16` の `Std.PreorderPackage.toBEq`）から来て Classical.choice に依る（String・Int の `==` と同じ罠）。
優先度を上げたこの instance を import した file では、UInt16・`Array UInt16`・`List UInt16`・`Option UInt16` の `==` が
どれも公理なしになる。
-/
instance (priority := high) instBEqUInt16Decide : BEq UInt16 := ⟨fun a b => decide (a = b)⟩

/-- JS の文字列（ECMA-262 の String）：UTF-16 の符号単位の並び。`units` の k 番目が JS の `s.charCodeAt(k)`。 -/
structure JStr where
  units : Array UInt16
  deriving Inhabited, Repr

namespace JStr

/-- 空の文字列 `""`。 -/
def empty : JStr := ⟨#[]⟩

/-- JS の `s.length`（符号単位の数）。 -/
@[inline] def size (s : JStr) : Nat := s.units.size

/-- `s.length === 0`。 -/
@[inline] def isEmpty (s : JStr) : Bool := s.units.size == 0

/-- k 番目の単位（JS の `s.charCodeAt(k)`。外なら `none` で、JS の NaN・`s[k]` の undefined に当たる）。 -/
@[inline] def get? (s : JStr) (k : Nat) : Option UInt16 := s.units[k]?

/-- k 番目の単位（外なら `d`）。 -/
@[inline] def getD (s : JStr) (k : Nat) (d : UInt16) : UInt16 := s.units.getD k d

/-- k 番目の単位が `u` か（外なら偽。JS の `s[k] === c`）。 -/
@[inline] def isAt (s : JStr) (k : Nat) (u : UInt16) : Bool := s.units[k]? == some u

/-- 単位の値を Nat で（文法の写しの `input.charCodeAt(k)` の表）。 -/
def codes (s : JStr) : Array Nat := s.units.map (·.toNat)

/-- BMP の字の単位（`'<'` などの字面を UInt16 に。外の字は下の 16 bit になるので、対が要る時は `ofString`）。 -/
@[inline] def unitOf (c : Char) : UInt16 := c.toNat.toUInt16

/-- JS の `String.fromCharCode(n)`（引数1つ）：n を ToUint16（2^16 で割った余り）にした1単位の文字列。対の片方も、その1単位のまま
（文法の写しの `input.charAt(k)` も、k 番目の単位の値をこれに渡した物）。 -/
def fromCharCode (n : Nat) : JStr := ⟨#[n.toUInt16]⟩

/-- 末尾に単位を1つ足す（`s + String.fromCharCode(u)`）。 -/
@[inline] def push (s : JStr) (u : UInt16) : JStr := ⟨s.units.push u⟩

/-- 繋ぎ（JS の `a + b`）。 -/
@[inline] def append (a b : JStr) : JStr := ⟨a.units ++ b.units⟩

instance : Append JStr := ⟨JStr.append⟩

/-- JS の `s.slice(i, j)`（i・j は 0 以上。外は切り詰め、j ≤ i なら空）。 -/
@[inline] def slice (s : JStr) (i j : Nat) : JStr := ⟨s.units.extract i j⟩

/-- JS の `s.slice(i)`。 -/
@[inline] def sliceFrom (s : JStr) (i : Nat) : JStr := ⟨s.units.extract i s.units.size⟩

/-- JS の `String.fromCharCode(u).repeat(n)`（単位 u を n 個）。 -/
def repeatUnit (u : UInt16) (n : Nat) : JStr := ⟨Array.replicate n u⟩

/-- JS の `a === b`（単位ごとに同じか）。 -/
def beq (a b : JStr) : Bool := a.units == b.units

instance : BEq JStr := ⟨JStr.beq⟩

/-- `List.lookup` を JStr の `==`（JS の `===`）で：鍵が k の最初の組の値（無ければ `none`）。 -/
def lookup {β : Type} (k : JStr) : List (JStr × β) → Option β
  | [] => none
  | (k', v) :: rest => if k == k' then some v else lookup k rest

/-- 単位の辞書式の比べ（同じ所までは単位の値で、片方が尽きたら短い方が小さい）。 -/
def cmp (a b : JStr) : Ordering := go 0 (if a.size ≤ b.size then a.size else b.size)
where
  go (k : Nat) : Nat → Ordering
    | 0 => if a.size < b.size then .lt else if b.size < a.size then .gt else .eq
    | r + 1 =>
      let x := a.getD k 0
      let y := b.getD k 0
      if x < y then .lt else if y < x then .gt else go (k + 1) r

/-- JS の `a < b`（文字列どうし）。比べの関数を渡さない `sort()` の順もこれ。 -/
def lt (a b : JStr) : Bool := match cmp a b with
  | .lt => true
  | _ => false

/-- JS の `a <= b`（文字列どうし）。`List.mergeSort` などに渡す形。 -/
def le (a b : JStr) : Bool := !lt b a

instance : Ord JStr := ⟨JStr.cmp⟩
instance : LT JStr := ⟨fun a b => JStr.lt a b = true⟩
instance (a b : JStr) : Decidable (a < b) := inferInstanceAs (Decidable (JStr.lt a b = true))

/-- 単位を順に `mixHash` で畳んだ物。 -/
def hash (s : JStr) : UInt64 := s.units.foldl (fun h u => mixHash h u.toUInt64) 7

instance : Hashable JStr := ⟨JStr.hash⟩

/-- 上の半分（0xD800〜0xDBFF）か。 -/
@[inline] def isHigh (u : UInt16) : Bool := 0xD800 ≤ u.toNat && u.toNat ≤ 0xDBFF

/-- 下の半分（0xDC00〜0xDFFF）か。 -/
@[inline] def isLow (u : UInt16) : Bool := 0xDC00 ≤ u.toNat && u.toNat ≤ 0xDFFF

/-- サロゲート（0xD800〜0xDFFF）か。 -/
@[inline] def isSurrogate (u : UInt16) : Bool := 0xD800 ≤ u.toNat && u.toNat ≤ 0xDFFF

/-- k 番目と k+1 番目が、上の半分と下の半分の対か。 -/
def pairAt (s : JStr) (k : Nat) : Bool :=
  match s.get? k, s.get? (k + 1) with
  | some u, some v => isHigh u && isLow v
  | _, _ => false

/-- 対の無いサロゲートがあるか（JS の `!s.isWellFormed()`）。 -/
def hasLone (s : JStr) : Bool := go 0 s.size
where
  go (k : Nat) : Nat → Bool
    | 0 => false
    | r + 1 =>
      match s.get? k with
      | none => false
      | some u => if pairAt s k then go (k + 2) r else if isSurrogate u then true else go (k + 1) r

/--
Lean の String（正しい UTF-8）を単位の並びに（BMP の外の字はサロゲートの対）。Lean 4.36 の `String.toList` などは
Classical.choice に依るので、`String.toUTF8`（公理なし）のバイトを読む。String は正しい UTF-8 なので、頭のバイトで長さを
決めて繋ぐだけでよい。燃料はバイトの数で、1回で1バイト以上進むので尽きない。
-/
def ofString (s : String) : JStr :=
  let b := s.toUTF8
  ⟨go b 0 #[] b.size⟩
where
  byte (b : ByteArray) (j : Nat) : Nat := if h : j < b.size then b[j].toNat else 0
  pushCode (acc : Array UInt16) (n : Nat) : Array UInt16 :=
    if n < 0x10000 then acc.push n.toUInt16
    else
      let m := n - 0x10000
      (acc.push (0xD800 + m / 0x400).toUInt16).push (0xDC00 + m % 0x400).toUInt16
  go (b : ByteArray) (i : Nat) (acc : Array UInt16) : Nat → Array UInt16
    | 0 => acc
    | k + 1 =>
      if i < b.size then
        let c0 := byte b i
        if c0 < 0x80 then go b (i + 1) (acc.push c0.toUInt16) k
        else if c0 < 0xE0 then go b (i + 2) (pushCode acc ((c0 % 0x20) * 0x40 + byte b (i + 1) % 0x40)) k
        else if c0 < 0xF0 then
          go b (i + 3) (pushCode acc ((c0 % 0x10) * 0x1000 + (byte b (i + 1) % 0x40) * 0x40 + byte b (i + 2) % 0x40)) k
        else
          go b (i + 4) (pushCode acc ((c0 % 0x08) * 0x40000 + (byte b (i + 1) % 0x40) * 0x1000 +
            (byte b (i + 2) % 0x40) * 0x40 + byte b (i + 3) % 0x40)) k
      else acc

instance : Coe String JStr := ⟨JStr.ofString⟩

/-- JS の `String(n)`（n は安全な整数、`n ≤ 2^53 - 1`。10 進で、頭の 0 は無い）。 -/
def ofNat (n : Nat) : JStr := ⟨(Nat.toDigits 10 n).foldl (fun acc c => acc.push c.toNat.toUInt16) #[]⟩

/-- JS の `String(n)`（負なら頭に `-`。Int に `-0` は無い）。 -/
def ofInt : Int → JStr
  | .ofNat n => ofNat n
  | .negSucc n => ⟨#[0x2D]⟩ ++ ofNat (n + 1)

/--
JS の `trim`・`trimEnd`・`\s` が空白と見る単位（WhiteSpace と LineTerminator。node v24.16.0 で 0..0xFFFF を当てて確かめた）。
どれも BMP の字でサロゲートを含まないので、単位で見ても JS と同じ。
-/
def isJsSpace (u : UInt16) : Bool :=
  let n := u.toNat
  n == 0x9 || n == 0xA || n == 0xB || n == 0xC || n == 0xD || n == 0x20 || n == 0xA0 || n == 0x1680 ||
    (n ≥ 0x2000 && n ≤ 0x200A) || n == 0x2028 || n == 0x2029 || n == 0x202F || n == 0x205F || n == 0x3000 ||
    n == 0xFEFF

/-- k から、`p` が成り立つ単位の間だけ進めた位置（尽きたら `s.size`）。 -/
def skipWhile (s : JStr) (p : UInt16 → Bool) (k : Nat) : Nat := go (s.size - k) k
where
  go : Nat → Nat → Nat
    | 0, k => k
    | r + 1, k =>
      match s.get? k with
      | some u => if p u then go r (k + 1) else k
      | none => k

/-- 末尾から、`p` が成り立つ単位を除いた長さ。 -/
def endWhile (s : JStr) (p : UInt16 → Bool) : Nat := go s.size
where
  go : Nat → Nat
    | 0 => 0
    | e + 1 => if p (s.getD e 0) then go e else e + 1

/-- JS の `s.trimStart()`。 -/
def trimStart (s : JStr) : JStr := s.sliceFrom (s.skipWhile isJsSpace 0)

/-- JS の `s.trimEnd()`。 -/
def trimEnd (s : JStr) : JStr := s.slice 0 (s.endWhile isJsSpace)

/-- JS の `s.trim()`。 -/
def trim (s : JStr) : JStr := s.slice (s.skipWhile isJsSpace 0) (s.endWhile isJsSpace)

/-- JS の `s.startsWith(p, pos)`（pos は `s.length` で切り詰める）。 -/
def startsWithAt (s p : JStr) (pos : Nat) : Bool :=
  let i := if pos ≤ s.size then pos else s.size
  i + p.size ≤ s.size && go i 0 p.size
where
  go (i k : Nat) : Nat → Bool
    | 0 => true
    | r + 1 => s.getD (i + k) 0 == p.getD k 0 && go i (k + 1) r

/-- JS の `s.startsWith(p)`。 -/
def startsWith (s p : JStr) : Bool := startsWithAt s p 0

/-- JS の `s.endsWith(p)`。 -/
def endsWith (s p : JStr) : Bool := p.size ≤ s.size && startsWithAt s p (s.size - p.size)

/-- JS の `s.indexOf(p, pos)`（無ければ `none`。JS の -1）。 -/
def indexOf (s p : JStr) (pos : Nat := 0) : Option Nat :=
  go (if pos ≤ s.size then pos else s.size) (s.size + 1)
where
  go (k : Nat) : Nat → Option Nat
    | 0 => none
    | r + 1 => if k + p.size ≤ s.size then (if startsWithAt s p k then some k else go (k + 1) r) else none

/-- JS の `s.indexOf(String.fromCharCode(u), pos)`。 -/
def indexOfUnit (s : JStr) (u : UInt16) (pos : Nat := 0) : Option Nat :=
  let k := s.skipWhile (· != u) pos
  if k < s.size then some k else none

/-- JS の `s.includes(p)`。 -/
def includes (s p : JStr) : Bool := (s.indexOf p).isSome

/-- JS の `s.split(String.fromCharCode(sep))`（空の文字列は `[""]`）。 -/
def splitOnUnit (s : JStr) (sep : UInt16) : List JStr := go 0 0 [] s.size
where
  go (start k : Nat) (acc : List JStr) : Nat → List JStr
    | 0 => (s.slice start s.size :: acc).reverse
    | r + 1 =>
      if s.getD k 0 == sep then go (k + 1) (k + 1) (s.slice start k :: acc) r else go start (k + 1) acc r

/-- JS の `xs.join("")`。 -/
def join (xs : List JStr) : JStr := xs.foldl (· ++ ·) empty

/-- JS の `xs.join(sep)`。 -/
def intercalate (sep : JStr) : List JStr → JStr
  | [] => empty
  | x :: xs => xs.foldl (fun acc y => acc ++ sep ++ y) x

/-- 16 進の1桁（小文字）。 -/
@[inline] def hexLower (d : Nat) : UInt16 := if d < 10 then (0x30 + d).toUInt16 else (0x57 + d).toUInt16

/-- `\u` と小文字の 16 進 4 桁（ECMA-262 の UnicodeEscape）を足す。 -/
def pushUnicodeEscape (acc : Array UInt16) (n : Nat) : Array UInt16 :=
  ((((acc.push 0x5C).push 0x75).push (hexLower (n / 0x1000 % 16))).push (hexLower (n / 0x100 % 16))
    |>.push (hexLower (n / 0x10 % 16))).push (hexLower (n % 16))

/--
JS の `JSON.stringify(s)`（s は文字列。ES2019 の well-formed JSON.stringify、ECMA-262 の QuoteJSONString）。
`"` で囲み、`"`・`\` と 0x08・0x0C・0x0A・0x0D・0x09 は `\"`・`\\`・`\b`・`\f`・`\n`・`\r`・`\t`、ほかの 0x20 より小さい単位は
`\u00xx`（小文字）。上の半分と下の半分の対はそのまま写し、対の無いサロゲートは `\udxxx`（小文字）。ほかの単位（DEL・U+2028・U+2029
も）はそのまま。燃料は単位の数で、1回で1単位以上進むので尽きない。
-/
def jsonStringify (s : JStr) : JStr := ⟨(go 0 #[0x22] s.size).push 0x22⟩
where
  esc (acc : Array UInt16) (c : UInt16) : Array UInt16 := (acc.push 0x5C).push c
  go (k : Nat) (acc : Array UInt16) : Nat → Array UInt16
    | 0 => acc
    | r + 1 =>
      match s.get? k with
      | none => acc
      | some u =>
        let n := u.toNat
        if n == 0x22 then go (k + 1) (esc acc 0x22) r
        else if n == 0x5C then go (k + 1) (esc acc 0x5C) r
        else if n == 0x08 then go (k + 1) (esc acc 0x62) r
        else if n == 0x0C then go (k + 1) (esc acc 0x66) r
        else if n == 0x0A then go (k + 1) (esc acc 0x6E) r
        else if n == 0x0D then go (k + 1) (esc acc 0x72) r
        else if n == 0x09 then go (k + 1) (esc acc 0x74) r
        else if n < 0x20 then go (k + 1) (pushUnicodeEscape acc n) r
        else if pairAt s k then go (k + 2) ((acc.push u).push (s.getD (k + 1) 0)) r
        else if isSurrogate u then go (k + 1) (pushUnicodeEscape acc n) r
        else go (k + 1) (acc.push u) r

/--
Lean の String に直す（φ）：対は BMP の外の字1つに、対の無いサロゲートは U+FFFD に、ほかの単位はその字に。Lean の Json.parse が
`\ud800` を読むのと同じ替え方。JS の答えを Lean の Json の値で比べる間だけの道具で、使ってよいのは SignSem/Json.lean だけ
（段の file は使わない）。
-/
def toStringPhi (s : JStr) : String := go 0 "" s.size
where
  go (k : Nat) (acc : String) : Nat → String
    | 0 => acc
    | r + 1 =>
      match s.get? k with
      | none => acc
      | some u =>
        if pairAt s k then
          let v := s.getD (k + 1) 0
          go (k + 2) (acc.push (Char.ofNat (0x10000 + (u.toNat - 0xD800) * 0x400 + (v.toNat - 0xDC00)))) r
        else if isSurrogate u then go (k + 1) (acc.push (Char.ofNat 0xFFFD)) r
        else go (k + 1) (acc.push (Char.ofNat u.toNat)) r

/-! ## 確かめ（期待は node v24.16.0 で取った値） -/

-- JSON.stringify("\ud800")
#guard (jsonStringify ⟨#[0xD800]⟩).units == #[0x22, 0x5C, 0x75, 0x64, 0x38, 0x30, 0x30, 0x22]
-- JSON.stringify("\udbff")
#guard (jsonStringify ⟨#[0xDBFF]⟩).units == #[0x22, 0x5C, 0x75, 0x64, 0x62, 0x66, 0x66, 0x22]
-- JSON.stringify("a\"b\\c\n\u0001\u001f")
#guard (jsonStringify ⟨#[0x61, 0x22, 0x62, 0x5C, 0x63, 0x0A, 0x01, 0x1F]⟩).units ==
  #[0x22, 0x61, 0x5C, 0x22, 0x62, 0x5C, 0x5C, 0x63, 0x5C, 0x6E, 0x5C, 0x75, 0x30, 0x30, 0x30, 0x31, 0x5C, 0x75, 0x30, 0x30,
    0x31, 0x66, 0x22]
-- JSON.stringify("\b\f\r\t\u007f ")
#guard (jsonStringify ⟨#[0x08, 0x0C, 0x0D, 0x09, 0x7F, 0x2028]⟩).units ==
  #[0x22, 0x5C, 0x62, 0x5C, 0x66, 0x5C, 0x72, 0x5C, 0x74, 0x7F, 0x2028, 0x22]
-- JSON.stringify("\ude00\ud83d")（逆さの対）
#guard (jsonStringify ⟨#[0xDE00, 0xD83D]⟩).units ==
  #[0x22, 0x5C, 0x75, 0x64, 0x65, 0x30, 0x30, 0x5C, 0x75, 0x64, 0x38, 0x33, 0x64, 0x22]
-- JSON.stringify("😀")
#guard (jsonStringify "😀").units == #[0x22, 0xD83D, 0xDE00, 0x22]
-- JSON.stringify("x😀\udc00")
#guard (jsonStringify ⟨#[0x78, 0xD83D, 0xDE00, 0xDC00]⟩).units ==
  #[0x22, 0x78, 0xD83D, 0xDE00, 0x5C, 0x75, 0x64, 0x63, 0x30, 0x30, 0x22]
-- JSON.stringify("\ud800𐀀")
#guard (jsonStringify ⟨#[0xD800, 0xD800, 0xDC00]⟩).units ==
  #[0x22, 0x5C, 0x75, 0x64, 0x38, 0x30, 0x30, 0xD800, 0xDC00, 0x22]
-- JSON.stringify("")
#guard (jsonStringify "").units == #[0x22, 0x22]
-- "<😀>".length
#guard ("<😀>" : JStr).size == 4
-- "😀" < "！" と "！" < "😀"、["！","😀"].sort() は ["😀","！"]
#guard lt "😀" "！" && !lt "！" "😀"
#guard lt "ab" "abc" && !lt "abc" "ab" && !lt "" "" && !lt "a" "a"
-- String(0)・String(123)・String(-5)
#guard (ofNat 0).units == #[0x30]
#guard (ofNat 123).units == #[0x31, 0x32, 0x33]
#guard (ofInt (-5)).units == #[0x2D, 0x35]
-- "é😀"
#guard (ofString "é😀").units == #[0xE9, 0xD83D, 0xDE00]
-- 字面と JStr の `++`（`Coe String JStr`）
#guard ("<" ++ ofNat 5 ++ ">" : JStr).units == #[0x3C, 0x35, 0x3E]
-- "\ud800 ".trim()・" 　a﻿  ".trim()・" a ".trimEnd()
#guard (trim ⟨#[0xD800, 0x20]⟩).units == #[0xD800]
#guard (trim ⟨#[0x20, 0x3000, 0x61, 0xFEFF, 0x2028, 0x20]⟩).units == #[0x61]
#guard (trimEnd " a ").units == #[0x20, 0x61]
#guard (trim "  ").size == 0
-- /\s/ が当たる 0..0xFFFF の単位は 25 個で、値の和は 206732
#guard ((List.range 0x10000).filter (fun n => isJsSpace n.toUInt16)).length == 25
#guard ((List.range 0x10000).filter (fun n => isJsSpace n.toUInt16)).foldl (· + ·) 0 == 206732
-- "abcabc".indexOf("ca")・"abc".indexOf("", 10)・"abc".indexOf("d")・"abcabc".indexOf("a", 1)
#guard indexOf "abcabc" "ca" == some 2 && indexOf "abc" "" 10 == some 3 && indexOf "abc" "d" == none &&
  indexOf "abcabc" "a" 1 == some 3
-- "abc".startsWith("", 10)・"abc".startsWith("bc", 1)・"abc".endsWith("bc")・"abc".endsWith("abcd")
#guard startsWithAt "abc" "" 10 && startsWithAt "abc" "bc" 1 && endsWith "abc" "bc" && !endsWith "abc" "abcd"
-- "a,,b".split(",")・"".split(",")
#guard (splitOnUnit "a,,b" 0x2C).map (·.units) == [#[0x61], #[], #[0x62]]
#guard (splitOnUnit "" 0x2C).map (·.units) == [#[]]
-- ["a","b","c"].join(", ")
#guard (intercalate ", " ["a", "b", "c"]) == ("a, b, c" : JStr)
-- "abcdef".slice(2, 4)・slice(4, 2)・slice(2, 100)・"abc".slice(5)
#guard (slice "abcdef" 2 4) == ("cd" : JStr) && (slice "abcdef" 4 2).isEmpty && (slice "abcdef" 2 100) == ("cdef" : JStr) &&
  (sliceFrom "abc" 5).isEmpty
-- String.fromCharCode(0xD800)・String.fromCharCode(0x10041)（ToUint16 で "A"）
#guard (fromCharCode 0xD800).units == #[0xD800] && (fromCharCode 0x10041).units == #[0x41]
-- "\u0002".repeat(3)・"a".repeat(0)
#guard (repeatUnit 0x02 3).units == #[0x02, 0x02, 0x02] && (repeatUnit 0x61 0).isEmpty
-- 鍵の比べは単位ごと（最初の組、対の無いサロゲートと U+FFFD は別の鍵）
#guard lookup "b" [("a", 1), ("b", 2), ("b", 3)] == some 2 && lookup "c" [("a", 1)] == none &&
  lookup ⟨#[0xD800]⟩ [(⟨#[0xFFFD]⟩, 1), (⟨#[0xD800]⟩, 2)] == some 2
-- 対の無いサロゲート
#guard hasLone ⟨#[0x78, 0xD83D, 0xDE00, 0xDC00]⟩ && !hasLone "x😀" && hasLone ⟨#[0xDE00, 0xD83D]⟩
-- φ：対は字1つに、対の無いサロゲートは U+FFFD に
#guard decide (toStringPhi ⟨#[0x78, 0xD83D, 0xDE00, 0xDC00]⟩ = "x😀�")
#guard (ofString (toStringPhi "é😀<")) == ("é😀<" : JStr)

end JStr

end SignSem
