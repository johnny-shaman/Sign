import Lean.Data.Json
import SignSem

/-!
# signsem：Lean の写しを alpha1 の答えに当てる道具

`signsem check [--show N] [--no-end] [--allow-partial] [--max-diffs N]`

標準入力から、dump.mjs が書く stages の JSONL の行（`{id, source, b1, b2, b3}`）を読み、段ごとに JS の答えと Lean の Json の BEq で比べる。

- 前処理：`Lex.preprocess source` を b1（`{text, lineAt}` か `{err}`）と。
- 文法：b1 が `{text, lineAt}` なら、その Pre から `Peg.parse` を b2（`{rows}` か `{err}`）と。
- 木：b2 が `{rows}` なら、その語の行から `Tree.rows` を b3 と。
- 通し：`Front.front source` を、b1 が `{err}` なら `{err: b1.err}`、そうでなければ b3 と。
- b3 が null の行（前処理を通さない text を文法に当てた行）は、文法だけを比べる。
- 段の入力にした b1・b2 は、`toJson ∘ fromJson` で Json の値として戻ることも見る（戻らなければ「読めない」）。

比べない物（数と id を出す）：JS のスタックの溢れ（期待が `{name: "RangeError", message: "Maximum call stack size exceeded"}` か
reason `resolve-stack-limit`）。Lean の写しはスタックの溢れを写さない。

対の無いサロゲート：Lean の String はそれを持てない。行の JSON に対の無いサロゲートの escape があれば（源・text・peggy の断りの文の
found など）、Lean の Json.parse はそれを U+FFFD に替える（この替え方を φ と書く）。そういう行は外さずに比べ、数を「U+FFFD に寄せた」に出す。
比べの意味は、出る側と入る側で違う。

- 出る側：写しは、JS が対の無いサロゲートを出す所で U+FFFD を出す（Peg.lean の頭）。期待も φ を通るので、比べは φ(JS の答え) と
  写しの答えが同じかで、対の無いサロゲートと本物の U+FFFD は分けない。
- 入る側：JS が受けたのは x で、写しが受けるのは φ(x)。比べは 写し(φ(x)) = φ(JS(x)) で、これが「写しは JS と同じ」と言えるのは
  φ ∘ JS = φ ∘ JS ∘ φ の時だけ。いつもそうではない（lexer.js の断りの文の一部は源の字を JSON.stringify で載せる（lexer.js:130 など）
  ので、対の無いサロゲートと U+FFFD で文が変わる）。写しが JS のとおりなら、そういう行では答えが合わず、門は違いとして落とす。

終わりの印：dump.mjs（と gen/ の fuzz・rawfuzz）は最後に `{"end": true, "lines": N, "complete": B, …}` を書く（ほかの欄は gate.mjs が見る）。
印が無い・N が読んだ行の数と違う・complete が偽（`--allow-partial` で許す）・印の後に行がある・行が 0 のどれかなら 1 を返す。
印の無い入力は `--no-end` で読む。
`--max-diffs N` は、違いと読めない行が合わせて N に届いたら読むのを止めて 1 を返す（変異の試験で早く止める）。
最後に機械が読む1行 `結果 {…}` を出し、gate.mjs がそれで指紋を照らす。段ごとに、数と、比べた行の写しの答えのハッシュ
（`digest`：Lean の Json の `hash` を比べた順に `mixHash` で畳んだ物、16 進）を載せる。数は期待の形だけで決まるので、写しの答えが
変わったことは `digest` で見る。

Windows の pipe では、書き手（gzip -dc）の長さ 0 の書き込みが EOF に見えることがあるので、node formal/check/sem/gunzip.mjs で解いて流す：

    node formal/check/sem/gunzip.mjs < formal/check/out/sem/stages.jsonl.gz | formal/sem/.lake/build/bin/signsem check
-/

open Lean SignSem

def trunc (s : String) (n : Nat) : String :=
  if s.length ≤ n then s else (s.take n).toString ++ "…"

def jkeys (j : Json) : List String :=
  match j with
  | .obj kvs => kvs.foldl (fun acc k _ => acc ++ [k]) []
  | _ => []

/-- 2つの JSON の最初に違う所（道と2つの値）。 -/
partial def jdiff (a b : Json) (path : String) : Option String :=
  match a, b with
  | .arr xs, .arr ys =>
    if xs.size != ys.size then some s!"{path}: 長さ {xs.size} と {ys.size}"
    else (List.range xs.size).findSome? fun k => jdiff xs[k]! ys[k]! s!"{path}[{k}]"
  | .obj _, .obj _ =>
    let ka := jkeys a
    if ka != jkeys b then some s!"{path}: 鍵 {ka} と {jkeys b}"
    else ka.findSome? fun k => jdiff (a.getObjValD k) (b.getObjValD k) s!"{path}.{k}"
  | _, _ => if a == b then none else some s!"{path}: 期待 {trunc a.compress 300}、答え {trunc b.compress 300}"

/--
1行を読む。Windows の pipe では、書き手の長さ 0 の書き込みが EOF に見えて getLine が空を返すことがある。
空が来たら少し待って読み直し、50 回続けて空なら本当の終わりとする。行が `\n` で終わるまで繋ぐ。
-/
partial def readLine (s : IO.FS.Stream) (acc : String) (empties : Nat) : IO String := do
  let l ← s.getLine
  if l.isEmpty then
    if empties ≥ 50 then return acc
    IO.sleep 20
    readLine s acc (empties + 1)
  else
    let acc := acc ++ l
    if acc.endsWith "\n" then return acc else readLine s acc 0

/-- 行の字に、対の無いサロゲートの escape（`\ud800`〜`\udfff`）があるか。node の JSON.stringify は対の無いサロゲートだけを escape で書く。 -/
def hasLoneSurrogateEscape (b : ByteArray) : Bool := Id.run do
  let mut i := 0
  while i + 3 < b.size do
    -- `\` `u` `d`/`D` と、8〜9・a〜f・A〜F
    if b[i]! == 92 && b[i + 1]! == 117 && (b[i + 2]! == 100 || b[i + 2]! == 68) then
      let c := b[i + 3]!
      if (56 ≤ c && c ≤ 57) || (97 ≤ c && c ≤ 102) || (65 ≤ c && c ≤ 70) then return true
    -- `\\` は1つの escape として飛ばす（`\\ud800` は字の `\` と `ud800`）
    if b[i]! == 92 then i := i + 2 else i := i + 1
  return false

/-- 期待が JS のスタックの溢れか。 -/
def jsStackOverflow (expect : Json) : Bool :=
  match expect.getObjVal? "err" with
  | .ok e =>
    ((e.getObjValD "name").getStr?.toOption == some "RangeError" &&
      (e.getObjValD "message").getStr?.toOption == some "Maximum call stack size exceeded") ||
    (e.getObjValD "reason").getStr?.toOption == some "resolve-stack-limit"
  | .error _ => false

def errJ (e : FrontErr) : Json := Json.mkObj [("err", e.toJson)]

def rowsJ (rows : List Row) : Json := Json.mkObj [("rows", Json.arr (rows.map Row.toJson).toArray)]

def wrowsJ (rows : List WRow) : Json := Json.mkObj [("rows", Json.arr (rows.map WRow.toJson).toArray)]

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
  /-- 比べた行の写しの答えのハッシュを、比べた順に畳んだ物。 -/
  digest : UInt64 := 7

/-- 16 進で 16 字（頭の 0 も書く）。 -/
def hex16 (h : UInt64) : String :=
  let ds := Nat.toDigits 16 h.toNat
  String.ofList (List.replicate (16 - ds.length) '0' ++ ds)

def Stage.line (s : Stage) : String :=
  let ex := if s.excluded.isEmpty then "" else s!" {s.excluded.toList.take 20}"
  s!"{s.name}：走らせた {s.run}・合った {s.same}（通った {s.sameRows}・断り {s.sameErr}）・違った {s.differ}・InternalError {s.internal}・外した {s.excluded.size}{ex}"

def Stage.toJson (s : Stage) : Json :=
  Json.mkObj [("run", Lean.toJson s.run), ("ok", Lean.toJson s.sameRows), ("err", Lean.toJson s.sameErr), ("differ", Lean.toJson s.differ),
    ("internal", Lean.toJson s.internal), ("excluded", Lean.toJson s.excluded), ("digest", Lean.toJson (hex16 s.digest))]

structure St where
  lines : Nat := 0
  bad : Nat := 0
  lossy : Nat := 0
  endMark : Option (Nat × Bool) := none
  afterEnd : Nat := 0
  pre : Stage := { name := "前処理" }
  peg : Stage := { name := "文法" }
  tree : Stage := { name := "木" }
  front : Stage := { name := "通し" }
  shown : Array String := #[]

/-- 1つの段を比べて数える。`got` を作るのは比べる時だけ（外す行では走らせない）。 -/
def compare (st : St) (nShow : Nat) (stage : Stage) (id : Nat) (src : String)
    (expect : Json) (got : Unit → Json × Bool) : St × Stage := Id.run do
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

def checkLine (st : St) (nShow : Nat) (line : String) : St := Id.run do
  let mut st := { st with lines := st.lines + 1 }
  match Json.parse line with
  | .error e =>
    st := { st with bad := st.bad + 1 }
    if st.shown.size < nShow then st := { st with shown := st.shown.push s!"行 {st.lines}: JSON を読めない {e}" }
    return st
  | .ok j =>
  if (j.getObjValD "end").getBool?.toOption == some true then
    let n := (j.getObjValD "lines").getNat?.toOption.getD 0
    let complete := (j.getObjValD "complete").getBool?.toOption.getD false
    return { st with lines := st.lines - 1, endMark := some (n, complete) }
  if st.endMark.isSome then st := { st with afterEnd := st.afterEnd + 1 }
  let id := (j.getObjValD "id").getNat?.toOption.getD 0
  if hasLoneSurrogateEscape line.toUTF8 then st := { st with lossy := st.lossy + 1 }
  let some src := (j.getObjValD "source").getStr?.toOption
    | return { st with bad := st.bad + 1 }
  let b1 := j.getObjValD "b1"
  let b2 := j.getObjValD "b2"
  let b3 := j.getObjValD "b3"
  let raw := b3.isNull
  -- 前処理
  if !raw then
    let (st', s) := compare st nShow st.pre id src b1 fun _ =>
      let r := Lex.preprocess src
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
          let r := Peg.parse p
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
        if wrowsJ ws != Json.mkObj [("rows", wj)] then
          st := { st with bad := st.bad + 1 }
          if st.shown.size < nShow then st := { st with shown := st.shown.push s!"id {id}: b2 が語の行の往復で戻らない" }
        else
          let (st', s) := compare st nShow st.tree id src b3 fun _ =>
            let r := Tree.rows ws
            ((match r with | .ok rows => rowsJ rows | .error e => errJ e), internalOf r)
          st := { st' with tree := s }
  -- 通し
  if !raw then
    let expect : Json := match b1.getObjVal? "err" with
      | .ok e => Json.mkObj [("err", e)]
      | .error _ => b3
    let (st', s) := compare st nShow st.front id src expect fun _ =>
      let r := Front.front src
      ((match r with | .ok rows => rowsJ rows | .error e => errJ e), internalOf r)
    st := { st' with front := s }
  return st

def check (args : List String) : IO UInt32 := do
  let mut nShow := 40
  let mut needEnd := true
  let mut allowPartial := false
  let mut maxDiffs := 0
  let mut as := args
  while !as.isEmpty do
    match as with
    | "--show" :: n :: rest => nShow := n.toNat!; as := rest
    | "--no-end" :: rest => needEnd := false; as := rest
    | "--allow-partial" :: rest => allowPartial := true; as := rest
    | "--max-diffs" :: n :: rest => maxDiffs := n.toNat!; as := rest
    | a :: _ => throw (IO.userError s!"知らない引数 {a}")
    | [] => as := []
  let stdin ← IO.getStdin
  let t0 ← IO.monoMsNow
  let mut st : St := {}
  let mut stopped := false
  repeat
    let line ← readLine stdin "" 0
    if line.isEmpty then break
    st := checkLine st nShow line
    let bad := st.bad + [st.pre, st.peg, st.tree, st.front].foldl (fun a s => a + s.differ) 0
    if maxDiffs > 0 && bad ≥ maxDiffs then
      stopped := true
      break
    if st.lines % 50000 == 0 && st.lines > 0 then
      let t ← IO.monoMsNow
      IO.eprintln s!"{st.lines} 行 {(t - t0) / 1000} 秒"
  let t1 ← IO.monoMsNow
  let stages := [st.pre, st.peg, st.tree, st.front]
  IO.println s!"行 {st.lines}・読めない {st.bad}・対の無いサロゲートを U+FFFD に寄せた {st.lossy}・{(t1 - t0) / 1000} 秒"
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
  let endJ : Json := match st.endMark with
    | some (n, c) => Json.mkObj [("lines", toJson n), ("complete", toJson c)]
    | none => Json.null
  IO.println ("結果 " ++ (Json.mkObj [("lines", toJson st.lines), ("bad", toJson st.bad), ("lossy", toJson st.lossy),
    ("end", endJ), ("stopped", toJson stopped), ("pre", st.pre.toJson), ("peg", st.peg.toJson), ("tree", st.tree.toJson),
    ("front", st.front.toJson)]).compress)
  let clean := stages.all (fun s => s.differ == 0 && s.internal == 0)
  return (if clean && st.bad == 0 && endOk then 0 else 1)

def main (args : List String) : IO UInt32 :=
  match args with
  | "check" :: rest => check rest
  | _ => do
    IO.eprintln "使い方：signsem check [--show N] [--no-end] [--allow-partial] [--max-diffs N]（標準入力に dump.mjs が書く stages の JSONL）"
    return 2
