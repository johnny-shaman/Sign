import Lean.Data.Json
import SignSem.Syntax

/-!
# 構文の木と JSON

formal/check/sem の道具が alpha1 から書き出す JSON（stages.jsonl）と、`SignSem.Syntax` の木を行き来する。

- 行の木の形は rowsjson.mjs の exportRows と同じ（core.raw を落とし、行の根に `line`）。
- 語の行の形は `{at, line, q, w}`、囲みの語は `{tag, rows}`（道具の dump.mjs）。

JS の文字列（`JStr`）と Lean の Json の文字列（Lean の String）の間の替え方 φ は、この file にだけ置く。

- 入る側：Lean の `Json.parse` は、対の無いサロゲートの escape（`\ud800` など）を U+FFFD に替えて読む（これが φ）。読んだ String を
  `JStr.ofString` で単位の並びにする（`JStr.fromJson`）。だから JSON から来た JStr に対の無いサロゲートは無い。
- 出る側：JStr を `JStr.toStringPhi` で String にして `Json.str` に置く（`JStr.toJson`）。対の無いサロゲートは U+FFFD になり、
  ほかの単位と対はそのまま字になる。
- `JStr.toStringPhi` を呼ぶのはこの file だけ。ほかの file が JStr を Json にする時は `JStr.toJson` を使う。

ここは道具なので `partial def` で書く（中身の性質は証明しない）。
-/

namespace SignSem
open Lean

/-- JStr を Json の文字列に（出る側の φ：`JStr.toStringPhi`）。 -/
def JStr.toJson (s : JStr) : Json := Json.str s.toStringPhi

/-- Json の文字列を JStr に（Lean の `Json.parse` が φ を当てた後の String を `JStr.ofString` で）。文字列でなければ断り。 -/
def JStr.fromJson (j : Json) : Except String JStr := JStr.ofString <$> j.getStr?

/-- JStr の並びを Json の配列に（`JStr.toJson` を要素ごとに）。 -/
def JStr.listToJson (xs : List JStr) : Json := Json.arr (xs.map JStr.toJson).toArray

/-- Json の配列を JStr の並びに（`JStr.fromJson` を要素ごとに）。 -/
def JStr.listFromJson (j : Json) : Except String (List JStr) := do
  let a ← j.getArr?
  a.toList.mapM JStr.fromJson

private def optJson {α} (f : α → Json) : Option α → Json
  | none => Json.null
  | some a => f a

def Enc.tag : Enc → String
  | .bracket => "bracket"
  | .abs => "abs"
  | .norm => "norm"
  | .indent => "indent"

def Enc.ofTag? : String → Option Enc
  | "bracket" => some .bracket
  | "abs" => some .abs
  | "norm" => some .norm
  | "indent" => some .indent
  | _ => none

mutual

partial def Row.toJson : Row → Json
  | .seq terms line =>
    Json.mkObj <| [("type", Json.str "seq"), ("terms", Json.arr (terms.map Term.toJson).toArray)] ++
      (match line with | some l => [("line", Lean.toJson l)] | none => [])
  | .op sym stage left right line =>
    Json.mkObj <| [("type", Json.str "op"), ("sym", sym.toJson), ("stage", Lean.toJson stage),
      ("left", optJson Row.toJson left), ("right", optJson Row.toJson right)] ++
      (match line with | some l => [("line", Lean.toJson l)] | none => [])

partial def Term.toJson : Term → Json
  | .atom pre core post =>
    Json.mkObj [("type", Json.str "atom"), ("pre", JStr.listToJson pre), ("core", Core.toJson core),
      ("post", JStr.listToJson post)]
  | .infix sym stage left right =>
    Json.mkObj [("type", Json.str "infix"), ("sym", sym.toJson), ("stage", Lean.toJson stage),
      ("left", optJson Term.toJson left), ("right", optJson Term.toJson right)]

partial def Core.toJson : Core → Json
  | .name s => Json.mkObj [("c", Json.str "name"), ("name", s.toJson)]
  | .lit t => Json.mkObj [("c", Json.str "lit"), ("text", t.toJson)]
  | .unit nId nVoid =>
    Json.mkObj <| [("c", Json.str "unit")] ++ (if nId then [("nId", Json.bool true)] else []) ++
      (if nVoid then [("nVoid", Json.bool true)] else [])
  | .enc k rows => Json.mkObj [("c", Json.str k.tag), ("rows", Json.arr (rows.map Row.toJson).toArray)]

end

private def optField (j : Json) (k : String) : Option Json :=
  match j.getObjVal? k with
  | .ok Json.null => none
  | .ok v => some v
  | .error _ => none

mutual

partial def Row.fromJson (j : Json) : Except String Row := do
  let ty ← (← j.getObjVal? "type").getStr?
  let line := (optField j "line").bind (fun l => (l.getNat?).toOption)
  match ty with
  | "seq" =>
    let ts ← (← j.getObjVal? "terms").getArr?
    return .seq (← ts.toList.mapM Term.fromJson) line
  | "op" =>
    let sym ← JStr.fromJson (← j.getObjVal? "sym")
    let stage ← (← j.getObjVal? "stage").getNat?
    let left ← (optField j "left").mapM Row.fromJson
    let right ← (optField j "right").mapM Row.fromJson
    return .op sym stage left right line
  | t => throw s!"行の木の type が分からない: {t}"

partial def Term.fromJson (j : Json) : Except String Term := do
  let ty ← (← j.getObjVal? "type").getStr?
  match ty with
  | "atom" =>
    let pre ← JStr.listFromJson (← j.getObjVal? "pre")
    let post ← JStr.listFromJson (← j.getObjVal? "post")
    return .atom pre (← Core.fromJson (← j.getObjVal? "core")) post
  | "infix" =>
    let sym ← JStr.fromJson (← j.getObjVal? "sym")
    let stage ← (← j.getObjVal? "stage").getNat?
    let left ← (optField j "left").mapM Term.fromJson
    let right ← (optField j "right").mapM Term.fromJson
    return .infix sym stage left right
  | t => throw s!"項の type が分からない: {t}"

partial def Core.fromJson (j : Json) : Except String Core := do
  let c ← (← j.getObjVal? "c").getStr?
  match c with
  | "name" => return .name (← JStr.fromJson (← j.getObjVal? "name"))
  | "lit" => return .lit (← JStr.fromJson (← j.getObjVal? "text"))
  | "unit" =>
    let flag (k : String) : Bool := match optField j k with | some (Json.bool b) => b | _ => false
    return .unit (flag "nId") (flag "nVoid")
  | t =>
    match Enc.ofTag? t with
    | some k =>
      let rs ← (← j.getObjVal? "rows").getArr?
      return .enc k (← rs.toList.mapM Row.fromJson)
    | none => throw s!"核の c が分からない: {t}"

end

mutual

partial def Word.toJson : Word → Json
  | .str s => s.toJson
  | .blk tag rows => Json.mkObj [("tag", tag.toJson), ("rows", Json.arr (rows.map WRow.toJson).toArray)]

partial def WRow.toJson : WRow → Json
  | .mk start line qs words =>
    Json.mkObj [("at", Lean.toJson start), ("line", optJson Lean.toJson line), ("q", Lean.toJson qs),
      ("w", Json.arr (words.map Word.toJson).toArray)]

end

mutual

partial def Word.fromJson (j : Json) : Except String Word :=
  match j with
  | Json.str s => return .str (JStr.ofString s)
  | _ => do
    let tag ← JStr.fromJson (← j.getObjVal? "tag")
    let rs ← (← j.getObjVal? "rows").getArr?
    return .blk tag (← rs.toList.mapM WRow.fromJson)

partial def WRow.fromJson (j : Json) : Except String WRow := do
  let start ← (← j.getObjVal? "at").getNat?
  let line := (optField j "line").bind (fun l => (l.getNat?).toOption)
  let qs ← (← (← j.getObjVal? "q").getArr?).toList.mapM (·.getNat?)
  let ws ← (← j.getObjVal? "w").getArr?
  return .mk start line qs (← ws.toList.mapM Word.fromJson)

end

/-- 断りの JSON（dump.mjs の `err`）：`{name, reason, line, message}`。無い欄は null。 -/
def FrontErr.toJson (e : FrontErr) : Json :=
  Json.mkObj [("name", e.name.toJson), ("reason", optJson JStr.toJson e.reason),
    ("line", optJson Lean.toJson e.line), ("message", e.message.toJson)]

def FrontErr.fromJson (j : Json) : Except String FrontErr := do
  let name ← JStr.fromJson (← j.getObjVal? "name")
  let reason := (optField j "reason").bind (fun r => (JStr.fromJson r).toOption)
  let line := (optField j "line").bind (fun l => (l.getNat?).toOption)
  let message := ((optField j "message").bind (fun m => (JStr.fromJson m).toOption)).getD JStr.empty
  return { name, reason, line, message }

/-- 前処理の結果の JSON（dump.mjs の `b1`）：`{text, lineAt}`。 -/
def Pre.toJson (p : Pre) : Json :=
  Json.mkObj [("text", p.text.toJson), ("lineAt", Lean.toJson p.lineAt)]

def Pre.fromJson (j : Json) : Except String Pre := do
  let text ← JStr.fromJson (← j.getObjVal? "text")
  let la ← (← j.getObjVal? "lineAt").getArr?
  return { text, lineAt := ← la.mapM (·.getNat?) }

end SignSem
