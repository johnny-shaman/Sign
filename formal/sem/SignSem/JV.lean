import SignSem.JStr

/-!
# JS の値としての JSON（`JV`）

formal/check/sem の道具（dump.mjs と gen/ の fuzz・rawfuzz）が `JSON.stringify` で書いた行を、JS の `JSON.parse` が作る値の形で読む。
文字列は JS の文字列（`JStr`、UTF-16 の符号単位の並び）のまま持つ。対の無いサロゲートも1つの単位で、U+FFFD に替えない。

- 値：`null`・真偽・数・文字列・配列・物（`obj`）。
- 数：JS の数は倍精度だが、道具が書く数は安全な整数だけ（`Number.isSafeInteger` で確かめてから書く）。だから `Int` で持ち、文法は
  整数の `-?(0|[1-9][0-9]*)` だけを読む。文のどこかに小数・指数（`1.5`・`1e3`）か安全な整数の外（絶対値が 2^53 以上）の数があれば、
  文ごと断る（後の同じ鍵が替えて JS の値には残らない数でも断る。JS の `JSON.parse` は `{"a":1.5,"a":1}` を `{a: 1}` に読む）。
  安全な整数の外は JS なら丸めた倍精度になる所で、Int に持つと JS の値と違う物になるので、読まずに断る。`-0` は `num 0`（Int に `-0` は
  無い。JS でも `-0 === 0` で、`JSON.stringify(-0)` は `"0"`）。
- 物：鍵を JStr の順（`JStr.lt`、比べの関数を渡さない JS の `sort()` の順）に並べて持ち、同じ鍵は1つ（後の物が前の物を替える。JS の
  `JSON.parse` と同じ）。JS の物は入れた順を持つが、その順は道具の書き方で alpha1 の答えではないので持たない。並べて持つので、`==` と
  `hash` は形のまま比べ、鍵の順に依らない。読み手は組を入れた順に溜め、閉じの `}` で一度に並べる（`sortKV`。組の数 N に N log N の手間）。
- 文法は RFC 8259 の JSON。空白は空白・TAB・LF・CR。文字列の中の 0x20 より小さいバイトは断る。文字列は UTF-8 のバイトを単位に直す
  （4 バイトの字は対の2単位、1〜3 バイトの字は1単位）。崩れた UTF-8（続きのバイトが足りない・長すぎる符号化・サロゲートの符号化・
  U+10FFFF の外）は断る。escape は `\" \\ \/ \b \f \n \r \t` と `\uXXXX`（16 進は大文字も小文字も）で、`\uXXXX` はちょうど1単位
  （対にまとめない。上の半分と下の半分の escape を続けた物は2単位で、生の 😀 と同じ。`\ud800` だけなら対の無い1単位）。
- 入れ子：読み手は入れ子を自分の stack（`Array Frame`）に積み、Lean の呼び出しの stack を使わないので、深さに依らない（treerev_big は
  5,008 段）。燃料はバイトの数で、1回で1バイト以上進むので尽きない。`==`・`hash`・`compress` などは木を再帰で辿り、深さの分だけ呼び出しを積む。
- 速さ：文字列は先に閉じの `"` を探し（`strScan`）、中が ASCII の字だけならバイトをそのまま単位に、ほかは escape と UTF-8 を解く
  （`decodeStr`）。0〜4095 の数と、よく出る鍵（`commonKeys`）は、読むたびに作らず表の同じ値を配る。

読み手（`parse`）は燃料で止まる普通の定義で、Classical.choice に依らない（SignSem/Axioms.lean で固める）。ほかは道具なので
`partial def` で書く（中身の性質は証明しない）。
-/

namespace SignSem

/-- JSON の値（JS の `JSON.parse` が作る値の形）。物の鍵は `JStr.lt` の順に並び、同じ鍵は無い。 -/
inductive JV where
  | null
  | bool (b : Bool)
  | num (n : Int)
  | str (s : JStr)
  | arr (xs : Array JV)
  | obj (kvs : Array (JStr × JV))
  deriving Inhabited

/--
JS の `JSON.stringify(s)` を Lean の String で（表示と `JV.compress` の葉）。`JStr.jsonStringify` は対の無いサロゲートを `\udxxx` に
するので、その出力は `JStr.toString?` で失わずに直せる（断らない）。断った時（起きない）は JSON として読めない印の文を返し、
`compress` の往復の確かめが落ちる。
-/
def JStr.quote (s : JStr) : String :=
  match (JStr.jsonStringify s).toString? with
  | some t => t
  | none => "<jsonStringify の後に対の無いサロゲートが残った>"

namespace JV

/-! ## 等しさとハッシュ -/

/-- 形のままの等しさ（文字列は単位ごと、JS の `===`。物は並べた鍵の順で組ごと）。 -/
partial def beq : JV → JV → Bool
  | .null, .null => true
  | .bool a, .bool b => decide (a = b)
  | .num a, .num b => decide (a = b)
  | .str a, .str b => a == b
  | .arr xs, .arr ys => xs.isEqv ys beq
  | .obj xs, .obj ys => xs.isEqv ys fun p q => p.1 == q.1 && beq p.2 q.2
  | _, _ => false

instance : BEq JV := ⟨beq⟩

/-- 形のままのハッシュ（定数は Lean の Json の `hash` と同じ。文字列は `JStr.hash`、物は並べた鍵の順に畳む）。 -/
partial def hash : JV → UInt64
  | .null => 11
  | .bool b => mixHash 13 (Hashable.hash b)
  | .num n => mixHash 17 (Hashable.hash n)
  | .str s => mixHash 19 s.hash
  | .arr xs => mixHash 23 (xs.foldl (fun r x => mixHash r (hash x)) 7)
  | .obj kvs => mixHash 29 (kvs.foldl (fun r kv => mixHash r (mixHash kv.1.hash (hash kv.2))) 7)

instance : Hashable JV := ⟨hash⟩

/-! ## 物を作る -/

/--
鍵の順に並べた組の並びに組 (k, v) を1つ入れる。同じ鍵があれば値を替える（JS の `JSON.parse` の後の鍵と同じ）。入れる所から後ろの組を
1つずつずらすので、1回で組の数の手間。多くの組から物を作るのは `sortKV`（`mkObj`）。
-/
def insertKV (kvs : Array (JStr × JV)) (k : JStr) (v : JV) : Array (JStr × JV) := go kvs.size (kvs.size + 1)
where
  go (j : Nat) : Nat → Array (JStr × JV)
    | 0 => kvs.push (k, v)
    | r + 1 =>
      if j = 0 then kvs.insertIdx! 0 (k, v)
      else
        match JStr.cmp (kvs.getD (j - 1) default).1 k with
        | .lt => kvs.insertIdx! j (k, v)
        | .eq => kvs.set! (j - 1) (k, v)
        | .gt => go (j - 1) r

/-- 組の並びの鍵が、`JStr.lt` の順に狭く増えているか（並べることも、同じ鍵を始末することも要らないか）。 -/
def strictlySorted (kvs : Array (JStr × JV)) : Bool := go 1 kvs.size
where
  go (k : Nat) : Nat → Bool
    | 0 => true
    | r + 1 =>
      if k < kvs.size then
        match JStr.cmp (kvs.getD (k - 1) default).1 (kvs.getD k default).1 with
        | .lt => go (k + 1) r
        | _ => false
      else true

/-- 挿し入れの並べ替え（安定：前の組の鍵が狭く大きい間だけ入れ替える）。組の少ない並びに使う。 -/
def insertionSort (kvs : Array (JStr × JV)) : Array (JStr × JV) := outer 1 kvs kvs.size
where
  /-- j 番目の組を、前の組の鍵が狭く大きい間だけ前へ送る。 -/
  sink (j : Nat) (a : Array (JStr × JV)) : Nat → Array (JStr × JV)
    | 0 => a
    | r + 1 =>
      if 0 < j then
        match JStr.cmp (a.getD (j - 1) default).1 (a.getD j default).1 with
        | .gt => sink (j - 1) (a.swapIfInBounds (j - 1) j) r
        | _ => a
      else a
  outer (i : Nat) (a : Array (JStr × JV)) : Nat → Array (JStr × JV)
    | 0 => a
    | r + 1 => if i < a.size then outer (i + 1) (sink i a i) r else a

/-- 並んだ2つの区間 a[lo, mid) と a[mid, hi) を併せて out の末尾に足す（同じ鍵は前の区間の組が先。安定）。 -/
def mergeRuns (a : Array (JStr × JV)) (lo mid hi : Nat) (out : Array (JStr × JV)) : Array (JStr × JV) :=
  go lo mid out (hi - lo)
where
  go (i j : Nat) (out : Array (JStr × JV)) : Nat → Array (JStr × JV)
    | 0 => out
    | r + 1 =>
      if i < mid then
        if j < hi then
          let x := a.getD i default
          let y := a.getD j default
          match JStr.cmp y.1 x.1 with
          | .lt => go i (j + 1) (out.push y) r
          | _ => go (i + 1) j (out.push x) r
        else go (i + 1) j (out.push (a.getD i default)) r
      else if j < hi then go i (j + 1) (out.push (a.getD j default)) r
      else out

/-- 幅 w の並んだ区間を、頭から2つずつ併せる（幅 2w の並んだ区間の並びになる）。 -/
def mergePass (a : Array (JStr × JV)) (w : Nat) : Array (JStr × JV) := go 0 (Array.mkEmpty a.size) a.size
where
  go (lo : Nat) (out : Array (JStr × JV)) : Nat → Array (JStr × JV)
    | 0 => out
    | r + 1 =>
      if lo < a.size then
        let mid := if lo + w ≤ a.size then lo + w else a.size
        let hi := if lo + 2 * w ≤ a.size then lo + 2 * w else a.size
        go hi (mergeRuns a lo mid hi out) r
      else out

/-- 併せの並べ替え（安定、下から：幅 1, 2, 4, … の区間を併せる）。組の数 N に N log N の手間。 -/
def mergeSort (kvs : Array (JStr × JV)) : Array (JStr × JV) := go kvs 1 kvs.size
where
  go (a : Array (JStr × JV)) (w : Nat) : Nat → Array (JStr × JV)
    | 0 => a
    | r + 1 => if w < a.size then go (mergePass a w) (2 * w) r else a

/-- 並べた組の並びに、同じ鍵の組が隣り合う所があるか。 -/
def adjDup (a : Array (JStr × JV)) : Bool := go 1 a.size
where
  go (k : Nat) : Nat → Bool
    | 0 => false
    | r + 1 => if k < a.size then (a.getD (k - 1) default).1 == (a.getD k default).1 || go (k + 1) r else false

/-- 並べた組の並びから、同じ鍵の続きの最後の組だけを残す（同じ鍵が無ければ、そのまま返す）。 -/
def keepLast (a : Array (JStr × JV)) : Array (JStr × JV) :=
  if adjDup a then go 0 (Array.mkEmpty a.size) a.size else a
where
  go (k : Nat) (out : Array (JStr × JV)) : Nat → Array (JStr × JV)
    | 0 => out
    | r + 1 =>
      if k < a.size then
        if k + 1 < a.size && (a.getD (k + 1) default).1 == (a.getD k default).1 then go (k + 1) out r
        else go (k + 1) (out.push (a.getD k default)) r
      else out

/--
入れた順の組の並びを物の組の並びに：鍵を `JStr.lt` の順に並べ（安定）、同じ鍵は後に入れた組を残す（JS の `JSON.parse` と同じ）。
並び終えている並びはそのまま返す。16 組までは挿し入れ、ほかは併せの並べ替えで、組の数 N に N log N の手間。
-/
def sortKV (kvs : Array (JStr × JV)) : Array (JStr × JV) :=
  if strictlySorted kvs then kvs
  else keepLast (if kvs.size ≤ 16 then insertionSort kvs else mergeSort kvs)

/-- 組の並びから物を作る（鍵を並べ、同じ鍵は後の物を残す）。 -/
def mkObj (kvs : List (JStr × JV)) : JV := .obj (sortKV kvs.toArray)

/-! ## 取り出す（Lean の Json の `getObjVal?` などと同じ形） -/

/-- 物の鍵 k の値。 -/
def find? (kvs : Array (JStr × JV)) (k : JStr) : Option JV := kvs.findSome? fun kv => if kv.1 == k then some kv.2 else none

/-- 物の鍵 k の値（物でない・鍵が無いなら断り）。 -/
def getObjVal? (j : JV) (k : JStr) : Except String JV :=
  match j with
  | .obj kvs =>
    match find? kvs k with
    | some v => .ok v
    | none => .error ("鍵 " ++ k.quote ++ " が無い")
  | _ => .error ("物でないので鍵 " ++ k.quote ++ " を引けない")

/-- 物の鍵 k の値（物でない・鍵が無いなら `null`）。 -/
def getObjValD (j : JV) (k : JStr) : JV :=
  match j with
  | .obj kvs => (find? kvs k).getD .null
  | _ => .null

/-- 物の組の並び（鍵の順）。 -/
def getObj? : JV → Except String (Array (JStr × JV))
  | .obj kvs => .ok kvs
  | _ => .error "物でない"

/-- 配列の要素。 -/
def getArr? : JV → Except String (Array JV)
  | .arr xs => .ok xs
  | _ => .error "配列でない"

/-- 文字列。 -/
def getStr? : JV → Except String JStr
  | .str s => .ok s
  | _ => .error "文字列でない"

/-- 0 以上の整数。 -/
def getNat? : JV → Except String Nat
  | .num n => if 0 ≤ n then .ok n.toNat else .error "負の数"
  | _ => .error "数でない"

/-- 整数。 -/
def getInt? : JV → Except String Int
  | .num n => .ok n
  | _ => .error "数でない"

/-- 真偽。 -/
def getBool? : JV → Except String Bool
  | .bool b => .ok b
  | _ => .error "真偽でない"

/-- `null` か。 -/
def isNull : JV → Bool
  | .null => true
  | _ => false

/-- どこかの文字列（鍵も）に対の無いサロゲートがあるか（JS の `!s.isWellFormed()` がどれかの文字列で真か）。 -/
partial def hasLone : JV → Bool
  | .str s => s.hasLone
  | .arr xs => xs.any hasLone
  | .obj kvs => kvs.any fun kv => kv.1.hasLone || hasLone kv.2
  | _ => false

/-- 入れ子の深さ（数・文字列などは 0、配列と物は中の一番深い物に 1 を足す。`[]` は 1）。 -/
partial def depth : JV → Nat
  | .arr xs => 1 + xs.foldl (fun m x => max m (depth x)) 0
  | .obj kvs => 1 + kvs.foldl (fun m kv => max m (depth kv.2)) 0
  | _ => 0

/-! ## 書く -/

/-- `compress` の中身：acc に値の JSON の文を足す。 -/
partial def compressAux (acc : String) : JV → String
  | .null => acc ++ "null"
  | .bool b => acc ++ (if b then "true" else "false")
  | .num n => acc ++ toString n
  | .str s => acc ++ s.quote
  | .arr xs => Id.run do
    let mut a := acc.push '['
    for h : k in [0:xs.size] do
      if k ≠ 0 then a := a.push ','
      a := compressAux a xs[k]
    return a.push ']'
  | .obj kvs => Id.run do
    let mut a := acc.push '{'
    for h : k in [0:kvs.size] do
      if k ≠ 0 then a := a.push ','
      a := compressAux ((a ++ kvs[k].1.quote).push ':') kvs[k].2
    return a.push '}'

/--
値の JSON の文（空白なし）。鍵は持っている順（`JStr.lt` の順）、文字列は `JStr.jsonStringify` を通して失わずに String に直した物、
数は 10 進（JS の `String(n)`）。鍵を並べた物の `JSON.stringify` と同じ文で、`JV.parse` で読み直すと同じ値に戻る。
-/
def compress (j : JV) : String := compressAux "" j

/-! ## 読み手 -/

/-- 読みかけの入れ子（読み手の stack の1段）。 -/
inductive Frame where
  /-- 配列：読んだ要素。 -/
  | arr (acc : Array JV)
  /-- 物：読んだ組（入れた順。閉じの `}` で `sortKV` に通す）と、いま値を読んでいる組の鍵。 -/
  | obj (acc : Array (JStr × JV)) (key : JStr)
  deriving Inhabited

namespace Parse

/-- i 番目のバイト（外なら 256。どのバイトとも違う値で、終わりの印）。 -/
@[inline] def byteAt (b : ByteArray) (i : Nat) : Nat := if h : i < b.size then b[i].toNat else 256

/-- 数字（0x30〜0x39）か。 -/
@[inline] def isDigit (c : Nat) : Bool := 0x30 ≤ c && c ≤ 0x39

/-- 続きのバイト（0x80〜0xBF）か。 -/
@[inline] def isCont (c : Nat) : Bool := 0x80 ≤ c && c ≤ 0xBF

/-- 断りの文（何が・どこで。位置は 0 から数えたバイトの位置）。 -/
def msg (what : String) (i : Nat) : String := s!"JSON を読めない：{what}（バイトの位置 {i}）"

/-- i から空白（空白・TAB・LF・CR）を飛ばした位置。 -/
def skipWs (b : ByteArray) (i : Nat) : Nat := go i (b.size - i)
where
  go (i : Nat) : Nat → Nat
    | 0 => i
    | r + 1 =>
      let c := byteAt b i
      if c == 0x20 || c == 0x09 || c == 0x0A || c == 0x0D then go (i + 1) r else i

/-- 16 進の1桁の値（16 進の字でなければ 16）。 -/
@[inline] def hexVal (c : Nat) : Nat :=
  if 0x30 ≤ c && c ≤ 0x39 then c - 0x30
  else if 0x61 ≤ c && c ≤ 0x66 then c - 0x57
  else if 0x41 ≤ c && c ≤ 0x46 then c - 0x37
  else 16

/-- i から4桁の 16 進の値（4桁そろわなければ 0x10000）。 -/
def hex4 (b : ByteArray) (i : Nat) : Nat :=
  let d0 := hexVal (byteAt b i)
  let d1 := hexVal (byteAt b (i + 1))
  let d2 := hexVal (byteAt b (i + 2))
  let d3 := hexVal (byteAt b (i + 3))
  if d0 < 16 && d1 < 16 && d2 < 16 && d3 < 16 then d0 * 0x1000 + d1 * 0x100 + d2 * 0x10 + d3 else 0x10000

/-- `\` の次の字 e の escape が表す単位（`\u` とほかの字は 0x10000）。 -/
@[inline] def escUnit (e : Nat) : Nat :=
  if e == 0x22 then 0x22 else if e == 0x5C then 0x5C else if e == 0x2F then 0x2F
  else if e == 0x62 then 0x08 else if e == 0x66 then 0x0C else if e == 0x6E then 0x0A
  else if e == 0x72 then 0x0D else if e == 0x74 then 0x09 else 0x10000

/--
開きの `"` の次の位置 i から閉じの `"` を探す。返すのは 2 × (閉じの位置) + (中のバイトがどれも 0x20〜0x7F なら 1、ほかは 0)。
閉じが無ければ 2 × `b.size`。`\` の次の1バイトは見ずに飛ばし（`\"` で閉じない）、`\` があれば 0 にする。ここは閉じの位置を探して
ASCII の字だけの文字列を見分けるだけで、ほかの文字列の中身の正しさは `decodeStr` が見る。
-/
def strScan (b : ByteArray) (i : Nat) : Nat := go i true (b.size - i)
where
  go (i : Nat) (plain : Bool) : Nat → Nat
    | 0 => 2 * b.size
    | r + 1 =>
      let c := byteAt b i
      if c == 0x22 then 2 * i + (if plain then 1 else 0)
      else if c == 0x5C then go (i + 2) false r
      else if c == 256 then 2 * b.size
      else go (i + 1) (plain && 0x20 ≤ c && c < 0x80) r

/-- 位置 i から e の手前まで（`strScan` が見た、どれも 0x20〜0x7F のバイト）を、バイトをそのまま単位にした文字列。 -/
def asciiStr (b : ByteArray) (i e : Nat) : JStr := ⟨go i (Array.mkEmpty (e - i)) (e - i)⟩
where
  go (i : Nat) (acc : Array UInt16) : Nat → Array UInt16
    | 0 => acc
    | r + 1 => go (i + 1) (acc.push (byteAt b i).toUInt16) r

/--
位置 i から e（`strScan` が見つけた閉じの `"`）の手前までを単位の並びに直す。単位の数はバイトの数より多くならない（1〜3 バイトの字と
escape は1単位、4 バイトの字は2単位）ので、e - i の大きさの配列を先に取る。
-/
def decodeStr (b : ByteArray) (i e : Nat) : Except String JStr := go i (Array.mkEmpty (e - i)) (e - i + 1)
where
  go (i : Nat) (acc : Array UInt16) : Nat → Except String JStr
    | 0 => .error (msg "文字列が閉じない" i)
    | r + 1 =>
      let c := byteAt b i
      if e ≤ i then (if i = e then .ok ⟨acc⟩ else .error (msg "崩れた文字列" i))
      else if c == 0x5C then
        let d := byteAt b (i + 1)
        if d == 0x75 then
          let n := hex4 b (i + 2)
          if n < 0x10000 then go (i + 6) (acc.push n.toUInt16) r else .error (msg "\\u の後に 16 進の4桁が無い" i)
        else
          let u := escUnit d
          if u < 0x10000 then go (i + 2) (acc.push u.toUInt16) r else .error (msg "知らない escape" i)
      else if c < 0x20 then .error (msg "文字列の中に 0x20 より小さいバイトがある" i)
      else if c < 0x80 then go (i + 1) (acc.push c.toUInt16) r
      else if c < 0xC2 then .error (msg (if c == 256 then "文字列が閉じない" else "崩れた UTF-8") i)
      else if c < 0xE0 then
        let c1 := byteAt b (i + 1)
        if isCont c1 then go (i + 2) (acc.push ((c % 0x20) * 0x40 + c1 % 0x40).toUInt16) r
        else .error (msg "崩れた UTF-8" i)
      else if c < 0xF0 then
        let c1 := byteAt b (i + 1)
        let c2 := byteAt b (i + 2)
        -- E0 の後は A0 から（長すぎる符号化を断る）、ED の後は 9F まで（サロゲートの符号化を断る）
        let lo1 := if c == 0xE0 then 0xA0 else 0x80
        let hi1 := if c == 0xED then 0x9F else 0xBF
        if lo1 ≤ c1 && c1 ≤ hi1 && isCont c2 then
          go (i + 3) (acc.push ((c % 0x10) * 0x1000 + (c1 % 0x40) * 0x40 + c2 % 0x40).toUInt16) r
        else .error (msg "崩れた UTF-8" i)
      else if c < 0xF5 then
        let c1 := byteAt b (i + 1)
        let c2 := byteAt b (i + 2)
        let c3 := byteAt b (i + 3)
        -- F0 の後は 90 から（長すぎる符号化を断る）、F4 の後は 8F まで（U+10FFFF の外を断る）
        let lo1 := if c == 0xF0 then 0x90 else 0x80
        let hi1 := if c == 0xF4 then 0x8F else 0xBF
        if lo1 ≤ c1 && c1 ≤ hi1 && isCont c2 && isCont c3 then
          let m := (c % 0x08) * 0x40000 + (c1 % 0x40) * 0x1000 + (c2 % 0x40) * 0x40 + c3 % 0x40 - 0x10000
          go (i + 4) ((acc.push (0xD800 + m / 0x400).toUInt16).push (0xDC00 + m % 0x400).toUInt16) r
        else .error (msg "崩れた UTF-8" i)
      else .error (msg (if c == 256 then "文字列が閉じない" else "崩れた UTF-8") i)

/-- j から数字が続く間を進めた位置。 -/
def digitsEnd (b : ByteArray) (j : Nat) : Nat := go j (b.size - j)
where
  go (j : Nat) : Nat → Nat
    | 0 => j
    | r + 1 => if isDigit (byteAt b j) then go (j + 1) r else j

/-- j から e の手前までの数字の値（10 進）。 -/
def digitsVal (b : ByteArray) (j e : Nat) : Nat := go j 0 (e - j)
where
  go (j acc : Nat) : Nat → Nat
    | 0 => acc
    | r + 1 => go (j + 1) (acc * 10 + (byteAt b j - 0x30)) r

/--
安全な整数の上の端（2^53 - 1、JS の `Number.MAX_SAFE_INTEGER`、16 桁）。`noinline` で1つの値に置く（畳み込まれると、使う所ごとに
10 進の字から作り直す）。
-/
@[noinline] def maxSafe : Nat := 9007199254740991

/-- 0 から 4095 までの `num` の表（小さい数は読むたびに作らず、この表の同じ値を配る）。 -/
def smallNums : Array JV := (Array.range 4096).map fun (n : Nat) => JV.num (Int.ofNat n)

/-- 0 以上の n の `num`（4096 より小さければ表の物）。 -/
@[inline] def natNum (n : Nat) : JV := if n < 4096 then smallNums.getD n .null else .num n

/--
開きの `"` の次の位置 i から、閉じの `"`（位置 s / 2、s は `strScan` の値）の手前までの文字列。ASCII の字だけなら `asciiStr`、
ほかは `decodeStr`。
-/
@[inline] def readStr (b : ByteArray) (i s : Nat) : Except String JStr :=
  let e := s / 2
  if e < b.size then (if s % 2 == 1 then .ok (asciiStr b i e) else decodeStr b i e)
  else .error (msg "文字列が閉じない" i)

/--
道具が書く行の物の鍵（多い順）。読み手は、これと同じ鍵を読むたびに作らず、`keyTable` の同じ値を配る（値は同じなので、`==` も
`hash` も変わらない）。
-/
def commonKeys : Array JStr :=
  #["type", "pre", "core", "c", "post", "terms", "line", "name", "sym", "stage", "left", "right", "rows", "at", "q", "w", "tag",
    "text", "id", "source", "b1", "b2", "b3", "lineAt", "nId", "skip", "err", "reason", "message", "nVoid"]

/-- 鍵の表の場所（長さ・頭の単位・終わりの単位から。`commonKeys` はどれも違う場所に入る）。 -/
@[inline] def keySlot (len c0 cl : Nat) : Nat := (len + c0 * 6 + cl * 8) % 64

/-- 64 の場所の鍵の表（`commonKeys` の鍵をその場所に置き、空の場所は空の文字列）。 -/
def keyTable : Array JStr :=
  commonKeys.foldl (fun t k => t.set! (keySlot k.size (k.getD 0 0).toNat (k.getD (k.size - 1) 0).toNat) k)
    (Array.replicate 64 JStr.empty)

/-- 位置 i から e の手前までのバイトが、文字列 t の単位と同じか。 -/
def sameAscii (b : ByteArray) (i e : Nat) (t : JStr) : Bool := t.size == e - i && go 0 t.size
where
  go (k : Nat) : Nat → Bool
    | 0 => true
    | r + 1 => (t.getD k 0).toNat == byteAt b (i + k) && go (k + 1) r

/-- 位置 i から e の手前まで（ASCII の字だけ）の鍵：`keyTable` にある鍵ならその値、無ければ `asciiStr`。 -/
@[inline] def asciiKey (b : ByteArray) (i e : Nat) : JStr :=
  if i < e then
    let t := keyTable.getD (keySlot (e - i) (byteAt b i) (byteAt b (e - 1))) JStr.empty
    if sameAscii b i e t then t else asciiStr b i e
  else JStr.empty

/-- 物の鍵を読む（`readStr` と同じで、ASCII の字だけの鍵は `asciiKey`）。 -/
@[inline] def readKey (b : ByteArray) (i s : Nat) : Except String JStr :=
  let e := s / 2
  if e < b.size then (if s % 2 == 1 then .ok (asciiKey b i e) else decodeStr b i e)
  else .error (msg "文字列が閉じない" i)

/-- 新しい物の段の組の並び（物の鍵は多くて 6 つなので、その大きさを先に取る）。 -/
@[inline] def objAcc : Array (JStr × JV) := Array.mkEmpty 6

/-- 新しい配列の段の要素の並び（初めに 4 つ分を取る）。 -/
@[inline] def arrAcc : Array JV := Array.mkEmpty 4

/--
読み手の本体。`want` が真なら位置 i から値を1つ読み始め、偽なら値 v を読み終えて位置 i にいる。読みかけの入れ子は stk に積む
（一番奥が末尾）。燃料はバイトの数 + 2 で、1回で1バイト以上進むか読み終えるので尽きない。
-/
def run (b : ByteArray) : Nat → Nat → Bool → JV → Array Frame → Except String JV
  | 0, i, _, _, _ => .error (msg "燃料が尽きた" i)
  | fuel + 1, i, want, v, stk =>
    if want then
      let i := skipWs b i
      let c := byteAt b i
      if c == 0x5B then
        let j := skipWs b (i + 1)
        if byteAt b j == 0x5D then run b fuel (j + 1) false (.arr #[]) stk
        else run b fuel j true .null (stk.push (.arr arrAcc))
      else if c == 0x7B then
        let j := skipWs b (i + 1)
        let c1 := byteAt b j
        if c1 == 0x7D then run b fuel (j + 1) false (.obj #[]) stk
        else if c1 == 0x22 then
          let s := strScan b (j + 1)
          match readKey b (j + 1) s with
          | .error err => .error err
          | .ok k =>
            let j3 := skipWs b (s / 2 + 1)
            if byteAt b j3 == 0x3A then run b fuel (j3 + 1) true .null (stk.push (.obj objAcc k))
            else .error (msg "鍵の後に : が無い" j3)
        else .error (msg "物の鍵（文字列）か } が無い" j)
      else if c == 0x22 then
        let s := strScan b (i + 1)
        match readStr b (i + 1) s with
        | .error err => .error err
        | .ok t => run b fuel (s / 2 + 1) false (.str t) stk
      else if c == 0x2D || isDigit c then
        let neg := c == 0x2D
        let j0 := if neg then i + 1 else i
        let d0 := byteAt b j0
        if !isDigit d0 then .error (msg "- の後に数字が無い" j0)
        else
          let e := if d0 == 0x30 then j0 + 1 else digitsEnd b (j0 + 1)
          let c2 := byteAt b e
          if isDigit c2 then .error (msg "頭に 0 のある数" j0)
          else if c2 == 0x2E || c2 == 0x65 || c2 == 0x45 then .error (msg "小数・指数の数（読むのは整数だけ）" e)
          else if e - j0 > 16 then .error (msg "安全な整数の外の数" j0)
          else
            let n := digitsVal b j0 e
            -- 15 桁までは安全な整数の中なので、端と比べるのは 16 桁の時だけ
            if e - j0 = 16 && n > maxSafe then .error (msg "安全な整数の外の数" j0)
            else run b fuel e false (if neg then .num (-(n : Int)) else natNum n) stk
      else if c == 0x74 then
        if byteAt b (i + 1) == 0x72 && byteAt b (i + 2) == 0x75 && byteAt b (i + 3) == 0x65 then
          run b fuel (i + 4) false (.bool true) stk
        else .error (msg "true でない" i)
      else if c == 0x66 then
        if byteAt b (i + 1) == 0x61 && byteAt b (i + 2) == 0x6C && byteAt b (i + 3) == 0x73 && byteAt b (i + 4) == 0x65 then
          run b fuel (i + 5) false (.bool false) stk
        else .error (msg "false でない" i)
      else if c == 0x6E then
        if byteAt b (i + 1) == 0x75 && byteAt b (i + 2) == 0x6C && byteAt b (i + 3) == 0x6C then
          run b fuel (i + 4) false .null stk
        else .error (msg "null でない" i)
      else .error (msg (if c == 256 then "値が無いまま終わった" else "値の頭でない字") i)
    else
      let i := skipWs b i
      let c := byteAt b i
      if stk.size = 0 then
        if c == 256 then .ok v else .error (msg "値の後に余りがある" i)
      else
        -- 一番奥の段を取り出してから足す（stk から外しておくと、中の配列は1つの持ち手だけになり、その場で伸びる）
        let f := stk.back!
        let stk := stk.pop
        match f with
        | .arr acc =>
          let acc := acc.push v
          if c == 0x2C then run b fuel (i + 1) true .null (stk.push (.arr acc))
          else if c == 0x5D then run b fuel (i + 1) false (.arr acc) stk
          else .error (msg "配列の要素の後に , か ] が無い" i)
        | .obj acc k =>
          let acc := acc.push (k, v)
          if c == 0x2C then
            let j := skipWs b (i + 1)
            if byteAt b j == 0x22 then
              let s := strScan b (j + 1)
              match readKey b (j + 1) s with
              | .error err => .error err
              | .ok k2 =>
                let j3 := skipWs b (s / 2 + 1)
                if byteAt b j3 == 0x3A then run b fuel (j3 + 1) true .null (stk.push (.obj acc k2))
                else .error (msg "鍵の後に : が無い" j3)
            else .error (msg ", の後に物の鍵（文字列）が無い" j)
          else if c == 0x7D then run b fuel (i + 1) false (.obj (sortKV acc)) stk
          else .error (msg "物の組の後に , か } が無い" i)

end Parse

/-- 0 以上の整数の `num`（4096 より小さければ、読み手と同じ表の値）。 -/
@[inline] def ofNat (n : Nat) : JV := Parse.natNum n

/-- JSON の文（UTF-8 のバイト）を1つ読む。前後の空白は許し、値の後に余りがあれば断る。 -/
def parse (b : ByteArray) : Except String JV := Parse.run b (b.size + 2) 0 true .null #[]

/-! ## 確かめ（期待は node v24.16.0 の `JSON.parse`・`JSON.stringify` で取った値） -/

private def p (t : String) : Except String JV := parse t.toUTF8

private def units? (t : String) : Option (Array UInt16) :=
  match p t with
  | .ok (.str s) => some s.units
  | _ => none

private def isErr (t : String) : Bool :=
  match p t with
  | .ok _ => false
  | .error _ => true

/-- JSON の escape `\u` と 16 進の4桁の字（`\` と `u` を分けて書いて組む）。 -/
private def u (hex : String) : String := "\\" ++ "u" ++ hex

/-- `"` で囲んだ JSON の文字列の文。 -/
private def q (body : String) : String := "\"" ++ body ++ "\""

-- JSON.parse('"\"\\\/\b\f\n\r\t"')。\u と4桁の escape（大文字も小文字も、0x20 より小さい単位と U+FFFD も）は1単位
#guard units? r#""\"\\\/\b\f\n\r\t""# == some #[0x22, 0x5C, 0x2F, 0x08, 0x0C, 0x0A, 0x0D, 0x09]
#guard units? (q (u "0041" ++ u "00e9" ++ u "FFFF" ++ u "00E9")) == some #[0x41, 0xE9, 0xFFFF, 0xE9]
#guard units? (q (u "0001" ++ u "001f" ++ u "fffd")) == some #[0x01, 0x1F, 0xFFFD]
-- JSON.parse('"\ud800"') は対の無い1単位（isWellFormed() は偽）
#guard units? r#""\ud800""# == some #[0xD800]
#guard (p r#""\ud800""#).toOption.map hasLone == some true
-- JSON.parse('"\ude00\ud83d"')（逆さの対）は2単位のまま。JSON.stringify は "\ude00\ud83d"
#guard units? r#""\ude00\ud83d""# == some #[0xDE00, 0xD83D]
#guard (p r#""\ude00\ud83d""#).toOption.map (fun v => decide (v.compress = r#""\ude00\ud83d""#)) == some true
#guard (p r#""\ude00\ud83d""#).toOption.map hasLone == some true
-- 生の 😀 と、上の半分と下の半分の escape を続けた物（小文字も大文字も）は同じ2単位
#guard units? "\"😀\"" == some #[0xD83D, 0xDE00]
#guard units? (q (u "d83d" ++ u "de00")) == some #[0xD83D, 0xDE00] && units? (q (u "D83D" ++ u "DE00")) == some #[0xD83D, 0xDE00]
#guard (p "\"😀\"").toOption == (p (q (u "d83d" ++ u "de00"))).toOption
#guard (p (q (u "d83d" ++ u "de00"))).toOption.map hasLone == some false
-- 上の半分の escape の後に生の 😀（3単位で、初めの1つは対が無い）
#guard units? (q (u "d83d" ++ "😀")) == some #[0xD83D, 0xD83D, 0xDE00]
#guard (p (q (u "d83d" ++ "😀"))).toOption.map hasLone == some true
-- JSON.parse('{"a":1,"b":2,"a":3}') は後の "a" が残り、JSON.stringify は {"a":3,"b":2}
#guard (p r#"{"a":1,"b":2,"a":3}"#).toOption == some (mkObj [("a", .num 3), ("b", .num 2)])
#guard (p r#"{"a":1,"b":2,"a":3}"#).toOption.map (fun v => decide (v.compress = r#"{"a":3,"b":2}"#)) == some true
#guard mkObj [("a", .num 1), ("b", .num 2), ("a", .num 3)] == mkObj [("b", .num 2), ("a", .num 3)]
-- 鍵の順に依らない（`==` も hash も）
#guard (p r#"{"b":1,"a":[2,{"d":3,"c":4}]}"#).toOption == (p r#"{"a":[2,{"c":4,"d":3}],"b":1}"#).toOption
#guard (p r#"{"b":1,"a":[2,{"d":3,"c":4}]}"#).toOption.map hash == (p r#"{"a":[2,{"c":4,"d":3}],"b":1}"#).toOption.map hash
#guard (p r#"{"a":1}"#).toOption != (p r#"{"a":1,"b":null}"#).toOption && (p "[1,2]").toOption != (p "[2,1]").toOption
-- 鍵は JS の sort() の順に並ぶ（["type","terms","pre","core","post","line","😀","！",""].sort()）
#guard match p r#"{"type":0,"terms":0,"pre":0,"core":0,"post":0,"line":0,"😀":0,"！":0,"":0}"# with
  | .ok (.obj kvs) => kvs.map (·.1) == (#["", "core", "line", "post", "pre", "terms", "type", "😀", "！"] : Array JStr)
  | _ => false
-- 鍵の表：よく出る鍵はどれも違う場所に入り、同じ場所の違う鍵（"tyqe" は "type" と同じ場所）は表の物にならない
#guard (Parse.commonKeys.map fun k => Parse.keySlot k.size (k.getD 0 0).toNat (k.getD (k.size - 1) 0).toNat).toList.eraseDups.length ==
  Parse.commonKeys.size
#guard (p r#"{"tyqe":1,"type":2,"t":3,"":4}"#).toOption ==
  some (mkObj [("tyqe", .num 1), ("type", .num 2), ("t", .num 3), ("", .num 4)])
#guard (p r#"{"tyqe":1}"#).toOption != (p r#"{"type":1}"#).toOption
-- 9007199254740991（2^53 - 1）と -9007199254740991 は読む。2^53 から先は安全な整数の外で断る
#guard (p "9007199254740991").toOption == some (.num 9007199254740991)
#guard (p "-9007199254740991").toOption == some (.num (-9007199254740991))
#guard isErr "9007199254740992" && isErr "-9007199254740992" && isErr "12345678901234567890"
-- JSON.parse("-0") は -0 で、JSON.stringify(JSON.parse("[-0]")) は "[0]"。JV は num 0
#guard (p "-0").toOption == some (.num 0) && (p "[-0]").toOption.map (fun v => decide (v.compress = "[0]")) == some true
-- 小数と指数は断る（JS は 1.5・1000 に読む）
#guard isErr "1.5" && isErr "1e3" && isErr "1E3" && isErr "1.0" && isErr "[1.5]" && isErr "-0.0" && isErr "0e0"
-- JS の JSON.parse も断る物
#guard isErr "01" && isErr "-01" && isErr "-" && isErr "- 1" && isErr "+1" && isErr "[1,]" && isErr r#"{"a":1,}"#
#guard isErr "1 2" && isErr "" && isErr " " && isErr "\x0c1" && isErr "tru" && isErr "nul" && isErr "fals" && isErr "["
#guard isErr r#"{"a" 1}"# && isErr "{1:2}" && isErr "[1]x" && isErr "\"\x01\"" && isErr "\"abc" && isErr r#""\x41""#
#guard isErr r#""\u12""# && isErr r#""\u12g4""# && isErr "{" && isErr r#"{"a":}"# && isErr "]" && isErr "[1 2]"
-- 空白は空白・TAB・LF・CR だけ
#guard (p " \t\n\r[ 1 , 2 ] \r\n").toOption == some (.arr #[.num 1, .num 2])
#guard (p r#" { "a" : [ ] , "b" : { } } "#).toOption == some (mkObj [("a", .arr #[]), ("b", .obj #[])])
-- DEL・U+2028 は生のまま
#guard units? "\"\x7f \"" == some #[0x7F, 0x2028]
-- UTF-8：1〜3 バイトの字は1単位、4 バイトの字は対
#guard (parse ⟨#[0x22, 0x41, 0xC3, 0xA9, 0xE2, 0x82, 0xAC, 0xF0, 0x9F, 0x98, 0x80, 0xF4, 0x8F, 0xBF, 0xBF, 0x22]⟩).toOption ==
  some (.str ⟨#[0x41, 0xE9, 0x20AC, 0xD83D, 0xDE00, 0xDBFF, 0xDFFF]⟩)
-- 崩れた UTF-8 は断る（長すぎる符号化・サロゲートの符号化・途中で切れた字・U+10FFFF の外・頭の無い続きのバイト）
#guard (parse ⟨#[0x22, 0xC0, 0x80, 0x22]⟩).toOption.isNone && (parse ⟨#[0x22, 0xE0, 0x9F, 0xBF, 0x22]⟩).toOption.isNone
#guard (parse ⟨#[0x22, 0xED, 0xA0, 0x80, 0x22]⟩).toOption.isNone && (parse ⟨#[0x22, 0xE2, 0x82, 0x22]⟩).toOption.isNone
#guard (parse ⟨#[0x22, 0xF4, 0x90, 0x80, 0x80, 0x22]⟩).toOption.isNone && (parse ⟨#[0x22, 0x80, 0x22]⟩).toOption.isNone
#guard (parse ⟨#[0x22, 0xF0, 0x8F, 0xBF, 0xBF, 0x22]⟩).toOption.isNone && (parse ⟨#[0x22, 0xF5, 0x80, 0x80, 0x80, 0x22]⟩).toOption.isNone
-- 鍵を並べた物の JSON.stringify と同じ文で、読み直すと同じ値
#guard (p r#"{"b":[1,"x\u0001",null,true,false,-7],"a":{"c":"\ud800😀","":[]}}"#).toOption.map
  (fun v => decide (v.compress = r#"{"a":{"":[],"c":"\ud800😀"},"b":[1,"x\u0001",null,true,false,-7]}"#)) == some true
#guard let v := (p r#"{"b":[1,"x\u0001",null,true,false,-7],"a":{"c":"\ud800😀\udc00","\ude00":[]}}"#).toOption
  v.isSome && v.bind (fun v => (parse v.compress.toUTF8).toOption) == v
-- 取り出し
#guard match p r#"{"id":7,"s":"x","n":-1,"b":true,"z":null,"a":[1]}"# with
  | .ok j =>
    (j.getObjValD "id").getNat?.toOption == some 7 && (j.getObjValD "n").getNat?.toOption.isNone &&
    (j.getObjValD "n").getInt?.toOption == some (-1) && (j.getObjValD "missing").isNull && (j.getObjValD "z").isNull &&
    (j.getObjVal? "z").toOption.isSome && (j.getObjVal? "missing").toOption.isNone &&
    (j.getObjValD "b").getBool?.toOption == some true && (j.getObjValD "a").getArr?.toOption.map (·.size) == some 1 &&
    (j.getObjValD "s").getStr?.toOption == some ("x" : JStr) && (j.getObjValD "s").getNat?.toOption.isNone &&
    ((j.getObjValD "a").getObjVal? "x").toOption.isNone && j.getObj?.toOption.map (·.size) == some 6
  | .error _ => false
-- 物を作る：`sortKV` は、組を1つずつ `insertKV` で入れた物と同じ（鍵の順・同じ鍵は後の物）。挿し入れ（16 組まで）と併せ（17 組から）の
-- 両方で、同じ鍵の多い並び・逆さの並び・並んだ並びを当てる
private def kvsOf (n m s : Nat) : Array (JStr × JV) :=
  (Array.range n).map fun i => (JStr.ofNat ((i * 7919 + s) % m), .num i)
private def byInsert (a : Array (JStr × JV)) : Array (JStr × JV) := a.foldl (fun acc kv => insertKV acc kv.1 kv.2) #[]
#guard [(0, 1, 0), (1, 1, 0), (2, 1, 0), (5, 3, 1), (16, 16, 0), (16, 4, 9), (17, 5, 2), (17, 17, 0), (100, 1000, 3), (100, 7, 4),
    (300, 290, 5), (257, 257, 6), (64, 1, 7)].all fun (n, m, s) =>
  let a := kvsOf n m s
  sortKV a == byInsert a && strictlySorted (sortKV a) && insertionSort a == mergeSort a
#guard let a := (Array.range 300).reverse.map fun i => (JStr.ofNat (1000 + i), JV.num i)
  sortKV a == byInsert a && sortKV a == a.reverse && strictlySorted (sortKV a)
#guard let a := (Array.range 300).map fun i => (JStr.ofNat (1000 + i), JV.num i)
  strictlySorted a && sortKV a == a
-- JSON.parse の後の鍵（40 組、逆さで、同じ鍵 "k10" を後でもう一度）
#guard let ks := (List.range 40).reverse.map fun i => "\"k" ++ toString (10 + i) ++ "\":" ++ toString i
  (p ("{" ++ ",".intercalate (ks ++ ["\"k10\":99"]) ++ "}")).toOption ==
    some (mkObj ((List.range 40).reverse.map (fun (i : Nat) => (JStr.ofString ("k" ++ toString (10 + i)), JV.num i)) ++
      [((("k10" : String) : JStr), JV.num 99)]))
-- 深さ 10,000 の入れ子も読む（読み手は入れ子を自分の stack に積む）
#guard (parse (String.ofList (List.replicate 10000 '[' ++ List.replicate 10000 ']')).toUTF8).isOk
#guard (parse (String.ofList (List.replicate 10000 '[' ++ List.replicate 9999 ']')).toUTF8).toOption.isNone

end JV

end SignSem
