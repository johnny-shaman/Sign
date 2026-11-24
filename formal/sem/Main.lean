import SignSem

/-!
# signsem：Lean の写しを alpha1 の答えに当てる道具

`signsem check [--show N] [--no-end] [--allow-partial] [--max-diffs N] [--force-internal ID]`

標準入力から、dump.mjs が書く stages の JSONL の行（`{id, source, b1, b2, b3}`）を読み、段ごとに JS の答えと比べる。行は JS の値と
しての JSON（`JV`、SignSem/JV.lean）に読み、写しの答えも `JV` にして（SignSem/Json.lean）、`JV` の `==` で比べる。`==` は形のままの
等しさで、文字列は UTF-16 の符号単位ごと（JS の `===`）、数は整数、物は鍵の順に依らない。

- 前処理：`Lex.preprocess source` を b1（`{text, lineAt}` か `{err}`）と。
- 文法：b1 が `{text, lineAt}` なら、その Pre から `Peg.parse` を b2（`{rows}` か `{err}`）と。
- 木：b2 が `{rows}` なら、その語の行から `Tree.rows` を b3 と。
- 通し：`Front.front source` を、b1 が `{err}` なら `{err: b1.err}`、そうでなければ b3 と。
- b3 が null の行（前処理を通さない text を文法に当てた行）は、文法だけを比べる。
- 段の入力にした b1・b2 は、`toJson ∘ fromJson` で同じ `JV` に戻ることも見る（戻らなければ「読めない」）。

行は標準入力のバイトのまま `JV.parse` に渡す（Lean の String に解かない。崩れた UTF-8 は、サロゲートを UTF-8 にした物も、読めない
行に数える）。文字列は JS の文字列（`JStr`）のまま、行から段の入力へ渡り、段の答えから比べへ出る。対の無いサロゲート（源・text・peggy
の断りの文の found など）も1つの単位としてそのまま渡り、そのまま比べる（ほかの字に替えない）。だから比べが合うのは、その行の入力で、
写しの答えが JS の答えと単位まで同じ時。対の無いサロゲートのある行は、別に2つに分けて数える：

- 入る側（`loneIn`）：段の入力にある行（源に。b3 が null の行では b1 の text に）。
- 答え（`loneOut`）：入る側に無く、b1・b2・b3 のどこかにある行（peggy の断りの文の found が対の片方の時など）。

比べない物（数と id を出す）：JS のスタックの溢れ（期待が `{name: "RangeError", message: "Maximum call stack size exceeded"}` か
reason `resolve-stack-limit`）。Lean の写しはスタックの溢れを写さない。

終わりの印：dump.mjs（と gen/ の fuzz・rawfuzz）は最後に `{"end": true, "lines": N, "complete": B, …}` を書く（ほかの欄は gate.mjs が見る）。
印が無い・N が読んだ行の数と違う・complete が偽（`--allow-partial` で許す）・印の後に行がある・行が 0 のどれかなら 1 を返す。
印の無い入力は `--no-end` で読む。
`--max-diffs N` は、違いと読めない行が合わせて N に届いたら読むのを止めて 1 を返す（変異の試験で早く止める）。
`--force-internal ID` は試験の口：id が ID の行では、走らせる段の全部で、段を走らせずに写しの答えを InternalError の断りにする
（gate.mjs の自己試験が、InternalError を数えて 1 を返すかを見る。写しの InternalError は燃料が尽きた所と写しの前提が崩れた所だけで、
どの入力でも起きないので、この口で起こす）。
最後に機械が読む1行 `結果 {…}` を出し、gate.mjs がそれで指紋を照らす。段ごとに、数と、比べた行の写しの答えのハッシュ
（`digest`：`JV` の `hash` を比べた順に `mixHash` で畳んだ物、16 進）を載せる。数は期待の形だけで決まるので、写しの答えが
変わったことは `digest` で見る。

Windows の pipe では、書き手（gzip -dc）の長さ 0 の書き込みが EOF に見えることがあるので、node formal/check/sem/gunzip.mjs で解いて流す：

    node formal/check/sem/gunzip.mjs < formal/check/out/sem/stages.jsonl.gz | formal/sem/.lake/build/bin/signsem check

## 読み手の速さ

`signsem bench`：標準入力の行ごとに `JV.parse` の時を測り、MB/s（10^6 バイト毎秒、行のバイトの和を時の和で割った物）を出す。行を
読む時は入れない。
-/

open SignSem

def trunc (s : String) (n : Nat) : String :=
  if s.length ≤ n then s else (s.take n).toString ++ "…"

/-- 道の鍵の名前（失わずに String に直せる鍵はそのまま、ほかは JSON の文字列の文）。 -/
def keyLabel (k : JStr) : String := (k.toString?).getD k.quote

/-- 鍵の並びの文（JSON の文字列の文を `, ` で繋ぐ）。 -/
def keysText (ks : Array JStr) : String := "[" ++ ", ".intercalate (ks.toList.map JStr.quote) ++ "]"

/-- 2つの JSON の最初に違う所（道と2つの値）。 -/
partial def jdiff (a b : JV) (path : String) : Option String :=
  match a, b with
  | .arr xs, .arr ys =>
    if xs.size != ys.size then some s!"{path}: 長さ {xs.size} と {ys.size}"
    else (List.range xs.size).findSome? fun k => jdiff xs[k]! ys[k]! s!"{path}[{k}]"
  | .obj xs, .obj ys =>
    let ka := xs.map (·.1)
    let kb := ys.map (·.1)
    if ka != kb then some s!"{path}: 鍵 {keysText ka} と {keysText kb}"
    else (List.range xs.size).findSome? fun k => jdiff xs[k]!.2 ys[k]!.2 s!"{path}.{keyLabel xs[k]!.1}"
  | _, _ => if a == b then none else some s!"{path}: 期待 {trunc a.compress 300}、答え {trunc b.compress 300}"

/-- 標準入力から一度に読むバイトの数。 -/
def chunkSize : USize := 1048576

/--
標準入力のバイトを、UTF-8 に解かずに行に分ける読み手。`buf` の `pos` から先が、まだ渡していないバイト。`pos` から `scan` の前までに
LF は無い。
-/
structure LineReader where
  s : IO.FS.Stream
  buf : ByteArray := .empty
  pos : Nat := 0
  scan : Nat := 0

/-- `b` の `i` から先で最初の LF（0x0A）の位置か、無ければ `b.size`。 -/
partial def findLF (b : ByteArray) (i : Nat) : Nat :=
  if h : i < b.size then
    if b[i].toNat = 10 then i else findLF b (i + 1)
  else b.size

/--
`chunkSize` バイトまで読む。Windows の pipe では、書き手の長さ 0 の書き込みが EOF に見えて read が空を返すことがある。
空が来たら少し待って読み直し、50 回続けて空なら本当の終わりとして空を返す。
-/
partial def readChunk (s : IO.FS.Stream) (empties : Nat) : IO ByteArray := do
  let c ← s.read chunkSize
  if !c.isEmpty || empties ≥ 50 then return c
  IO.sleep 20
  readChunk s (empties + 1)

/--
次の1行のバイト（終わりの LF も入れる。入力の最後の、LF で終わらない行はそのまま）と、進めた読み手。入力が尽きていれば空。
行が読んだ所で切れていれば、読み足して繋ぐ（繋ぐのはバイトなので、字の途中で切れても字は替わらない）。
-/
partial def LineReader.next (r : LineReader) : IO (ByteArray × LineReader) := do
  let e := findLF r.buf r.scan
  if e < r.buf.size then
    return (r.buf.extract r.pos (e + 1), { r with pos := e + 1, scan := e + 1 })
  let rest := r.buf.extract r.pos r.buf.size
  let c ← readChunk r.s 0
  if c.isEmpty then
    return (rest, { r with buf := .empty, pos := 0, scan := 0 })
  LineReader.next { r with buf := rest ++ c, pos := 0, scan := rest.size }

/-- JSON の値が文字列 s か。 -/
def strIs (j : JV) (s : JStr) : Bool :=
  match j with
  | .str t => t == s
  | _ => false

/-- JSON の値が `true` か。 -/
def isTrue : JV → Bool
  | .bool true => true
  | _ => false

/-- 期待が JS のスタックの溢れか。 -/
def jsStackOverflow (expect : JV) : Bool :=
  match expect.getObjVal? "err" with
  | .ok e =>
    (strIs (e.getObjValD "name") "RangeError" && strIs (e.getObjValD "message") "Maximum call stack size exceeded") ||
    strIs (e.getObjValD "reason") "resolve-stack-limit"
  | .error _ => false

def errJ (e : FrontErr) : JV := JV.mkObj [("err", e.toJson)]

def rowsJ (rows : List Row) : JV := JV.mkObj [("rows", .arr (rows.map Row.toJson).toArray)]

def wrowsJ (rows : List WRow) : JV := JV.mkObj [("rows", .arr (rows.map WRow.toJson).toArray)]

/-- 1つの段の数。 -/
structure Stage where
  name : String
  run : Nat := 0
  same : Nat := 0
  sameRows : Nat := 0
  sameErr : Nat := 0
  differ : Nat := 0
  internal : Nat := 0
  excluded : Array Nat := #[]
  /-- 比べた行の写しの答えの `JV` の `hash` を、比べた順に `mixHash` で畳んだ物。 -/
  digest : UInt64 := 7

/-- 16 進で 16 字（頭の 0 も書く）。 -/
def hex16 (h : UInt64) : String :=
  let ds := Nat.toDigits 16 h.toNat
  String.ofList (List.replicate (16 - ds.length) '0' ++ ds)

def Stage.line (s : Stage) : String :=
  let ex := if s.excluded.isEmpty then "" else s!" {s.excluded.toList.take 20}"
  s!"{s.name}：走らせた {s.run}・合った {s.same}（通った {s.sameRows}・断り {s.sameErr}）・違った {s.differ}・InternalError {s.internal}・外した {s.excluded.size}{ex}"

def Stage.toJson (s : Stage) : JV :=
  JV.mkObj [("differ", JV.ofNat s.differ), ("digest", .str (hex16 s.digest)), ("err", JV.ofNat s.sameErr),
    ("excluded", .arr (s.excluded.map JV.ofNat)), ("internal", JV.ofNat s.internal), ("ok", JV.ofNat s.sameRows),
    ("run", JV.ofNat s.run)]

structure St where
  lines : Nat := 0
  bad : Nat := 0
  /-- 段の入力（源、b3 が null の行では b1 の text）に対の無いサロゲートがある行。 -/
  loneIn : Nat := 0
  /-- 段の入力には無く、b1・b2・b3 のどこかに対の無いサロゲートがある行。 -/
  loneOut : Nat := 0
  endMark : Option (Nat × Bool) := none
  afterEnd : Nat := 0
  pre : Stage := { name := "前処理" }
  peg : Stage := { name := "文法" }
  tree : Stage := { name := "木" }
  front : Stage := { name := "通し" }
  shown : Array String := #[]

/-- 1つの段を比べて数える。`got` を作るのは比べる時だけ（外す行では走らせない）。 -/
def compare (st : St) (nShow : Nat) (stage : Stage) (id : Nat) (src : JStr)
    (expect : JV) (got : Unit → JV × Bool) : St × Stage := Id.run do
  if jsStackOverflow expect then
    return (st, { stage with excluded := stage.excluded.push id })
  let (g, internal) := got ()
  let stage := { stage with run := stage.run + 1, internal := stage.internal + (if internal then 1 else 0), digest := mixHash stage.digest (hash g) }
  if g == expect then
    let isErr := (expect.getObjVal? "err").toBool
    let sr := stage.sameRows + (if isErr then 0 else 1)
    let se := stage.sameErr + (if isErr then 1 else 0)
    return (st, { stage with same := stage.same + 1, sameRows := sr, sameErr := se })
  let st := if st.shown.size < nShow then
    let d := (jdiff expect g "期待").getD "（BEq は違うが道が見つからない）"
    { st with shown := st.shown.push s!"{stage.name} id {id} 源 {trunc src.quote 200}\n    {d}" }
  else st
  return (st, { stage with differ := stage.differ + 1 })

def internalOf {α} (r : Except FrontErr α) : Bool :=
  match r with
  | .error e => e.name == "InternalError"
  | .ok _ => false

/-- `--force-internal` の行で段の答えに置く、写しの InternalError の断り。 -/
def forcedInternal : FrontErr :=
  { name := "InternalError", reason := none, line := none, message := "--force-internal で置いた答え" }

/-- 段を走らせる。`force` なら走らせずに `forcedInternal` を返す。 -/
def runStage {α} (force : Bool) (f : Unit → Except FrontErr α) : Except FrontErr α :=
  if force then .error forcedInternal else f ()

def checkLine (st : St) (nShow : Nat) (forceId : Option Nat) (line : ByteArray) : St := Id.run do
  let mut st := { st with lines := st.lines + 1 }
  match JV.parse line with
  | .error e =>
    st := { st with bad := st.bad + 1 }
    if st.shown.size < nShow then st := { st with shown := st.shown.push s!"行 {st.lines}: JSON を読めない {e}" }
    return st
  | .ok j =>
  if isTrue (j.getObjValD "end") then
    let n := (j.getObjValD "lines").getNat?.toOption.getD 0
    let complete := isTrue (j.getObjValD "complete")
    return { st with lines := st.lines - 1, endMark := some (n, complete) }
  if st.endMark.isSome then st := { st with afterEnd := st.afterEnd + 1 }
  let id := (j.getObjValD "id").getNat?.toOption.getD 0
  let force := match forceId with
    | some f => decide (f = id)
    | none => false
  let src? := (j.getObjValD "source").getStr?.toOption
  let b1 := j.getObjValD "b1"
  let b2 := j.getObjValD "b2"
  let b3 := j.getObjValD "b3"
  let raw := b3.isNull
  -- 対の無いサロゲート：段の入力（源、b3 が null の行では b1 の text）にあるか、ほかは答え（b1・b2・b3）にあるか
  if (src?.map JStr.hasLone).getD false || (raw && (b1.getObjValD "text").hasLone) then
    st := { st with loneIn := st.loneIn + 1 }
  else if b1.hasLone || b2.hasLone || b3.hasLone then
    st := { st with loneOut := st.loneOut + 1 }
  let some src := src?
    | return { st with bad := st.bad + 1 }
  -- 前処理
  if !raw then
    let (st', s) := compare st nShow st.pre id src b1 fun _ =>
      let r := runStage force fun _ => Lex.preprocess src
      ((match r with | .ok p => p.toJson | .error e => errJ e), internalOf r)
    st := { st' with pre := s }
  -- 文法（b1 の Pre から）
  if (b1.getObjVal? "text").isOk then
    match Pre.fromJson b1 with
    | .error e =>
      st := { st with bad := st.bad + 1 }
      if st.shown.size < nShow then st := { st with shown := st.shown.push s!"id {id}: b1 が Pre に読めない {e}" }
    | .ok p =>
      if p.toJson != b1 then
        st := { st with bad := st.bad + 1 }
        if st.shown.size < nShow then st := { st with shown := st.shown.push s!"id {id}: b1 が Pre の往復で戻らない" }
      else
        let (st', s) := compare st nShow st.peg id src b2 fun _ =>
          let r := runStage force fun _ => Peg.parse p
          ((match r with | .ok ws => wrowsJ ws | .error e => errJ e), internalOf r)
        st := { st' with peg := s }
  -- 木（b2 の語の行から）
  if !raw then
    match b2.getObjVal? "rows" with
    | .error _ => pure ()
    | .ok wj =>
      match (do let a ← wj.getArr?; a.toList.mapM WRow.fromJson) with
      | .error e =>
        st := { st with bad := st.bad + 1 }
        if st.shown.size < nShow then st := { st with shown := st.shown.push s!"id {id}: b2 が語の行に読めない {e}" }
      | .ok ws =>
        if wrowsJ ws != JV.mkObj [("rows", wj)] then
          st := { st with bad := st.bad + 1 }
          if st.shown.size < nShow then st := { st with shown := st.shown.push s!"id {id}: b2 が語の行の往復で戻らない" }
        else
          let (st', s) := compare st nShow st.tree id src b3 fun _ =>
            let r := runStage force fun _ => Tree.rows ws
            ((match r with | .ok rows => rowsJ rows | .error e => errJ e), internalOf r)
          st := { st' with tree := s }
  -- 通し
  if !raw then
    let expect : JV := match b1.getObjVal? "err" with
      | .ok e => JV.mkObj [("err", e)]
      | .error _ => b3
    let (st', s) := compare st nShow st.front id src expect fun _ =>
      let r := runStage force fun _ => Front.front src
      ((match r with | .ok rows => rowsJ rows | .error e => errJ e), internalOf r)
    st := { st' with front := s }
  return st

/-! ## 読み手の速さ（`bench`） -/

/-- `JV.parse` で1行を読む（呼び出しの中で読み終える。時の測りの間に挟むため、畳み込まない）。 -/
@[noinline] def benchJV (b : ByteArray) : IO Bool := pure (JV.parse b).isOk

/-- 小数1桁の文。 -/
def fmt1 (x : Float) : String :=
  let n := (x * 10).round.toUInt64.toNat
  s!"{n / 10}.{n % 10}"

def bench : IO UInt32 := do
  let mut rd : LineReader := { s := ← IO.getStdin }
  let mut lines := 0
  let mut bytes := 0
  let mut ns := 0
  let mut ok := 0
  repeat
    let (b, rd') ← rd.next
    rd := rd'
    if b.isEmpty then break
    lines := lines + 1
    bytes := bytes + b.size
    let t0 ← IO.monoNanosNow
    let r ← benchJV b
    let t1 ← IO.monoNanosNow
    ns := ns + (t1 - t0)
    if r then ok := ok + 1
  let mb := Float.ofNat bytes / 1e6
  let rate := if ns == 0 then "-" else fmt1 (mb / (Float.ofNat ns / 1e9))
  IO.println s!"読み手の速さ：行 {lines}・{fmt1 mb} MB"
  IO.println s!"  JV.parse：{fmt1 (Float.ofNat ns / 1e9)} 秒・{rate} MB/s・読めた {ok}"
  return (if ok == lines then 0 else 1)

def check (args : List String) : IO UInt32 := do
  let mut nShow := 40
  let mut needEnd := true
  let mut allowPartial := false
  let mut maxDiffs := 0
  let mut forceId : Option Nat := none
  let mut as := args
  while !as.isEmpty do
    match as with
    | "--show" :: n :: rest => nShow := n.toNat!; as := rest
    | "--no-end" :: rest => needEnd := false; as := rest
    | "--allow-partial" :: rest => allowPartial := true; as := rest
    | "--max-diffs" :: n :: rest => maxDiffs := n.toNat!; as := rest
    | "--force-internal" :: n :: rest => forceId := some n.toNat!; as := rest
    | a :: _ => throw (IO.userError s!"知らない引数 {a}")
    | [] => as := []
  let mut rd : LineReader := { s := ← IO.getStdin }
  let t0 ← IO.monoMsNow
  let mut st : St := {}
  let mut stopped := false
  repeat
    let (line, rd') ← rd.next
    rd := rd'
    if line.isEmpty then break
    st := checkLine st nShow forceId line
    let bad := st.bad + [st.pre, st.peg, st.tree, st.front].foldl (fun a s => a + s.differ) 0
    if maxDiffs > 0 && bad ≥ maxDiffs then
      stopped := true
      break
    if st.lines % 50000 == 0 && st.lines > 0 then
      let t ← IO.monoMsNow
      IO.eprintln s!"{st.lines} 行 {(t - t0) / 1000} 秒"
  let t1 ← IO.monoMsNow
  let stages := [st.pre, st.peg, st.tree, st.front]
  IO.println s!"行 {st.lines}・読めない {st.bad}・入る側に対の無いサロゲート {st.loneIn}・答えに対の無いサロゲート {st.loneOut}・{(t1 - t0) / 1000} 秒"
  for s in stages do IO.println s!"  {s.line}"
  let mut endOk := true
  match st.endMark with
  | none =>
    if needEnd then
      endOk := false
      IO.println "[終わりの印が無い] 入力が途中で切れたかもしれない（印の無い入力は --no-end）"
  | some (n, complete) =>
    IO.println s!"  終わりの印：lines {n}・complete {complete}"
    if n != st.lines then
      endOk := false
      IO.println s!"[本数が違う] 印は {n}、読んだのは {st.lines}"
    if !complete && !allowPartial then
      endOk := false
      IO.println "[部分の書き出し] dump.mjs が源の全部を書いていない（許すなら --allow-partial）"
  if st.afterEnd > 0 then
    endOk := false
    IO.println s!"[印の後に行がある] {st.afterEnd} 行"
  if st.lines == 0 then
    endOk := false
    IO.println "[行が 0]"
  if stopped then
    endOk := false
    IO.println s!"[途中で止めた] 違いが {maxDiffs} に届いた（--max-diffs）"
  for s in st.shown do IO.println s
  -- 機械が読む1行（gate.mjs が数の指紋を照らす）
  let endJ : JV := match st.endMark with
    | some (n, c) => JV.mkObj [("complete", .bool c), ("lines", JV.ofNat n)]
    | none => .null
  IO.println ("結果 " ++ (JV.mkObj [("bad", JV.ofNat st.bad), ("end", endJ), ("front", st.front.toJson), ("lines", JV.ofNat st.lines),
    ("loneIn", JV.ofNat st.loneIn), ("loneOut", JV.ofNat st.loneOut), ("peg", st.peg.toJson), ("pre", st.pre.toJson),
    ("stopped", .bool stopped), ("tree", st.tree.toJson)]).compress)
  let clean := stages.all (fun s => s.differ == 0 && s.internal == 0)
  return (if clean && st.bad == 0 && endOk then 0 else 1)

def main (args : List String) : IO UInt32 :=
  match args with
  | "check" :: rest => check rest
  | ["bench"] => bench
  | _ => do
    IO.eprintln "使い方：signsem check [--show N] [--no-end] [--allow-partial] [--max-diffs N] [--force-internal ID]・signsem bench（標準入力に dump.mjs が書く stages の JSONL）"
    return 2
