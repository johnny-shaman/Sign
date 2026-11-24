import SignSem.Syntax
import SignSem.JV

/-!
# 構文の木と JSON

formal/check/sem の道具が alpha1 から書き出す JSON（stages.jsonl）と、`SignSem.Syntax` の木を行き来する。JSON の値は JS の値としての
JSON（`JV`、SignSem/JV.lean）。

- 行の木の形は rowsjson.mjs の exportRows と同じ（core.raw を落とし、行の根に `line`）。
- 語の行の形は `{at, line, q, w}`、囲みの語は `{tag, rows}`（道具の dump.mjs）。
- 文字列の欄は JS の文字列（`JStr`）のまま `JV.str` に入り、そのまま出る。対の無いサロゲートも1つの単位のままで、ほかの字に替えない。
- 数の欄（行・位置・段）は 0 以上の整数（`JV.num`）。値の無い欄は、行の木の `line` は鍵ごと書かず、ほかは `null`（道具の書き方と同じ）。
- 物は `JV.mkObj` で作る（鍵は `JStr.lt` の順に並ぶ）。ここでは鍵をその順に書いておくので、並べ替えは走らない。

ここは道具なので `partial def` で書く（中身の性質は証明しない）。
-/

namespace SignSem

/-- JStr を JSON の文字列に。 -/
@[inline] def JStr.toJson (s : JStr) : JV := .str s

/-- JSON の文字列を JStr に（文字列でなければ断り）。 -/
@[inline] def JStr.fromJson (j : JV) : Except String JStr := j.getStr?

/-- JStr の並びを JSON の配列に。 -/
def JStr.listToJson (xs : List JStr) : JV := .arr (xs.map JStr.toJson).toArray

/-- JSON の配列を JStr の並びに（要素が文字列でなければ断り）。 -/
def JStr.listFromJson (j : JV) : Except String (List JStr) := do
  let a ← j.getArr?
  a.toList.mapM JStr.fromJson

private def optJson {α} (f : α → JV) : Option α → JV
  | none => .null
  | some a => f a

/-- 行の木の根の `line` の欄（値が無ければ鍵ごと書かない）。 -/
private def lineField (line : Option Nat) : List (JStr × JV) :=
  match line with
  | some l => [("line", JV.ofNat l)]
  | none => []

def Enc.tag : Enc → JStr
  | .bracket => "bracket"
  | .abs => "abs"
  | .norm => "norm"
  | .indent => "indent"

def Enc.ofTag? (t : JStr) : Option Enc :=
  if t == "bracket" then some .bracket
  else if t == "abs" then some .abs
  else if t == "norm" then some .norm
  else if t == "indent" then some .indent
  else none

mutual

partial def Row.toJson : Row → JV
  | .seq terms line =>
    JV.mkObj <| lineField line ++ ([("terms", .arr (terms.map Term.toJson).toArray), ("type", .str "seq")] : List (JStr × JV))
  | .op sym stage left right line =>
    JV.mkObj <| ([("left", optJson Row.toJson left)] : List (JStr × JV)) ++ lineField line ++
      ([("right", optJson Row.toJson right), ("stage", JV.ofNat stage), ("sym", sym.toJson), ("type", .str "op")] : List (JStr × JV))

partial def Term.toJson : Term → JV
  | .atom pre core post =>
    JV.mkObj [("core", Core.toJson core), ("post", JStr.listToJson post), ("pre", JStr.listToJson pre), ("type", .str "atom")]
  | .infix sym stage left right =>
    JV.mkObj [("left", optJson Term.toJson left), ("right", optJson Term.toJson right), ("stage", JV.ofNat stage),
      ("sym", sym.toJson), ("type", .str "infix")]

partial def Core.toJson : Core → JV
  | .name s => JV.mkObj [("c", .str "name"), ("name", s.toJson)]
  | .lit t => JV.mkObj [("c", .str "lit"), ("text", t.toJson)]
  | .unit nId nVoid =>
    JV.mkObj <| ([("c", .str "unit")] : List (JStr × JV)) ++
      ((if nId then [("nId", .bool true)] else []) : List (JStr × JV)) ++
      ((if nVoid then [("nVoid", .bool true)] else []) : List (JStr × JV))
  | .enc k rows => JV.mkObj [("c", .str k.tag), ("rows", .arr (rows.map Row.toJson).toArray)]

end

private def optField (j : JV) (k : JStr) : Option JV :=
  match j.getObjVal? k with
  | .ok .null => none
  | .ok v => some v
  | .error _ => none

mutual

partial def Row.fromJson (j : JV) : Except String Row := do
  let ty ← (← j.getObjVal? "type").getStr?
  let line := (optField j "line").bind (fun l => l.getNat?.toOption)
  if ty == "seq" then
    let ts ← (← j.getObjVal? "terms").getArr?
    return .seq (← ts.toList.mapM Term.fromJson) line
  else if ty == "op" then
    let sym ← JStr.fromJson (← j.getObjVal? "sym")
    let stage ← (← j.getObjVal? "stage").getNat?
    let left ← (optField j "left").mapM Row.fromJson
    let right ← (optField j "right").mapM Row.fromJson
    return .op sym stage left right line
  else throw ("行の木の type が分からない: " ++ ty.quote)

partial def Term.fromJson (j : JV) : Except String Term := do
  let ty ← (← j.getObjVal? "type").getStr?
  if ty == "atom" then
    let pre ← JStr.listFromJson (← j.getObjVal? "pre")
    let post ← JStr.listFromJson (← j.getObjVal? "post")
    return .atom pre (← Core.fromJson (← j.getObjVal? "core")) post
  else if ty == "infix" then
    let sym ← JStr.fromJson (← j.getObjVal? "sym")
    let stage ← (← j.getObjVal? "stage").getNat?
    let left ← (optField j "left").mapM Term.fromJson
    let right ← (optField j "right").mapM Term.fromJson
    return .infix sym stage left right
  else throw ("項の type が分からない: " ++ ty.quote)

partial def Core.fromJson (j : JV) : Except String Core := do
  let c ← (← j.getObjVal? "c").getStr?
  if c == "name" then return .name (← JStr.fromJson (← j.getObjVal? "name"))
  else if c == "lit" then return .lit (← JStr.fromJson (← j.getObjVal? "text"))
  else if c == "unit" then
    let flag (k : JStr) : Bool := match optField j k with | some (.bool b) => b | _ => false
    return .unit (flag "nId") (flag "nVoid")
  else
    match Enc.ofTag? c with
    | some k =>
      let rs ← (← j.getObjVal? "rows").getArr?
      return .enc k (← rs.toList.mapM Row.fromJson)
    | none => throw ("核の c が分からない: " ++ c.quote)

end

mutual

partial def Word.toJson : Word → JV
  | .str s => s.toJson
  | .blk tag rows => JV.mkObj [("rows", .arr (rows.map WRow.toJson).toArray), ("tag", tag.toJson)]

partial def WRow.toJson : WRow → JV
  | .mk start line qs words =>
    JV.mkObj [("at", JV.ofNat start), ("line", optJson JV.ofNat line), ("q", .arr (qs.map JV.ofNat).toArray),
      ("w", .arr (words.map Word.toJson).toArray)]

end

mutual

partial def Word.fromJson (j : JV) : Except String Word :=
  match j with
  | .str s => return .str s
  | _ => do
    let tag ← JStr.fromJson (← j.getObjVal? "tag")
    let rs ← (← j.getObjVal? "rows").getArr?
    return .blk tag (← rs.toList.mapM WRow.fromJson)

partial def WRow.fromJson (j : JV) : Except String WRow := do
  let start ← (← j.getObjVal? "at").getNat?
  let line := (optField j "line").bind (fun l => l.getNat?.toOption)
  let qs ← (← (← j.getObjVal? "q").getArr?).toList.mapM (·.getNat?)
  let ws ← (← j.getObjVal? "w").getArr?
  return .mk start line qs (← ws.toList.mapM Word.fromJson)

end

/-- 断りの JSON（dump.mjs の `err`）：`{name, reason, line, message}`。無い欄は null。 -/
def FrontErr.toJson (e : FrontErr) : JV :=
  JV.mkObj [("line", optJson JV.ofNat e.line), ("message", e.message.toJson), ("name", e.name.toJson),
    ("reason", optJson JStr.toJson e.reason)]

def FrontErr.fromJson (j : JV) : Except String FrontErr := do
  let name ← JStr.fromJson (← j.getObjVal? "name")
  let reason := (optField j "reason").bind (fun r => (JStr.fromJson r).toOption)
  let line := (optField j "line").bind (fun l => l.getNat?.toOption)
  let message := ((optField j "message").bind (fun m => (JStr.fromJson m).toOption)).getD JStr.empty
  return { name, reason, line, message }

/-- 前処理の結果の JSON（dump.mjs の `b1`）：`{text, lineAt}`。 -/
def Pre.toJson (p : Pre) : JV :=
  JV.mkObj [("lineAt", .arr (p.lineAt.map JV.ofNat)), ("text", p.text.toJson)]

def Pre.fromJson (j : JV) : Except String Pre := do
  let text ← JStr.fromJson (← j.getObjVal? "text")
  let la ← (← j.getObjVal? "lineAt").getArr?
  return { text, lineAt := ← la.mapM (·.getNat?) }

/-! ## 確かめ：書いた物は鍵の順に並んでいて（`mkObj` の並べ替えが走らない）、読み直すと同じ木に戻る -/

private def sorted? : JV → Bool
  | .obj kvs => JV.strictlySorted kvs
  | _ => false

private def lone : JStr := ⟨#[0x78, 0xD83D, 0xDC00, 0xDE00]⟩

#guard sorted? (Row.toJson (.seq [] (some 3))) && sorted? (Row.toJson (.seq [] none)) &&
  sorted? (Row.toJson (.op ":" 2 none none (some 1))) && sorted? (Row.toJson (.op ":" 2 none none none))
#guard sorted? (Term.toJson (.atom [] (.unit true true) [])) && sorted? (Term.toJson (.infix "+" 14 none none)) &&
  sorted? (Core.toJson (.unit true true)) && sorted? (Core.toJson (.name "x")) && sorted? (Core.toJson (.lit "5")) &&
  sorted? (Core.toJson (.enc .abs []))
#guard sorted? (WRow.toJson (.mk 0 (some 1) [2] [.blk "\"BRACKET_\"" []])) && sorted? (Word.toJson (.blk "t" [])) &&
  sorted? (FrontErr.toJson { name := "SyntaxError", reason := none, line := some 1, message := lone }) &&
  sorted? (Pre.toJson { text := lone, lineAt := #[1, 1, 1, 1, 1] })
-- 対の無いサロゲートも1つの単位のまま出て、読むと戻る
#guard (Pre.fromJson (Pre.toJson { text := lone, lineAt := #[1, 2] })).toOption.map (·.text) == some lone
#guard match FrontErr.fromJson (FrontErr.toJson { name := "SyntaxError", reason := some lone, line := none, message := lone }) with
  | .ok e => e.reason == some lone && e.message == lone && e.line.isNone
  | .error _ => false
#guard (JV.parse (Row.toJson (.op lone 2 (some (.seq [.atom [lone] (.lit lone) [] , .infix "+" 14 none none] none)) none (some 4))).compress.toUTF8).toOption.bind
  (fun j => (Row.fromJson j).toOption.map Row.toJson) ==
  some (Row.toJson (.op lone 2 (some (.seq [.atom [lone] (.lit lone) [], .infix "+" 14 none none] none)) none (some 4)))

end SignSem
