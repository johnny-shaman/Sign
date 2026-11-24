import Lean.Data.Json
import SignSem.Syntax

/-!
# 構文の木と JSON

formal/check/sem の道具が alpha1 から書き出す JSON（stages.jsonl）と、`SignSem.Syntax` の木を行き来する。

- 行の木の形は rowsjson.mjs の exportRows と同じ（core.raw を落とし、行の根に `line`）。
- 語の行の形は `{at, line, q, w}`、囲みの語は `{tag, rows}`（道具の dump.mjs）。

ここは道具なので `partial def` で書く（中身の性質は証明しない）。
-/

namespace SignSem
open Lean

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
    Json.mkObj <| [("type", Json.str "op"), ("sym", Json.str sym), ("stage", Lean.toJson stage),
      ("left", optJson Row.toJson left), ("right", optJson Row.toJson right)] ++
      (match line with | some l => [("line", Lean.toJson l)] | none => [])

partial def Term.toJson : Term → Json
  | .atom pre core post =>
    Json.mkObj [("type", Json.str "atom"), ("pre", Lean.toJson pre), ("core", Core.toJson core), ("post", Lean.toJson post)]
  | .infix sym stage left right =>
    Json.mkObj [("type", Json.str "infix"), ("sym", Json.str sym), ("stage", Lean.toJson stage),
      ("left", optJson Term.toJson left), ("right", optJson Term.toJson right)]

partial def Core.toJson : Core → Json
  | .name s => Json.mkObj [("c", Json.str "name"), ("name", Json.str s)]
  | .lit t => Json.mkObj [("c", Json.str "lit"), ("text", Json.str t)]
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

private def strList (j : Json) : Except String (List String) := do
  let a ← j.getArr?
  a.toList.mapM (·.getStr?)

mutual

partial def Row.fromJson (j : Json) : Except String Row := do
  let ty ← (← j.getObjVal? "type").getStr?
  let line := (optField j "line").bind (fun l => (l.getNat?).toOption)
  match ty with
  | "seq" =>
    let ts ← (← j.getObjVal? "terms").getArr?
    return .seq (← ts.toList.mapM Term.fromJson) line
  | "op" =>
    let sym ← (← j.getObjVal? "sym").getStr?
    let stage ← (← j.getObjVal? "stage").getNat?
    let left ← (optField j "left").mapM Row.fromJson
    let right ← (optField j "right").mapM Row.fromJson
    return .op sym stage left right line
  | t => throw s!"行の木の type が分からない: {t}"

partial def Term.fromJson (j : Json) : Except String Term := do
  let ty ← (← j.getObjVal? "type").getStr?
  match ty with
  | "atom" =>
    let pre ← strList (← j.getObjVal? "pre")
    let post ← strList (← j.getObjVal? "post")
    return .atom pre (← Core.fromJson (← j.getObjVal? "core")) post
  | "infix" =>
    let sym ← (← j.getObjVal? "sym").getStr?
    let stage ← (← j.getObjVal? "stage").getNat?
    let left ← (optField j "left").mapM Term.fromJson
    let right ← (optField j "right").mapM Term.fromJson
    return .infix sym stage left right
  | t => throw s!"項の type が分からない: {t}"

partial def Core.fromJson (j : Json) : Except String Core := do
  let c ← (← j.getObjVal? "c").getStr?
  match c with
  | "name" => return .name (← (← j.getObjVal? "name").getStr?)
  | "lit" => return .lit (← (← j.getObjVal? "text").getStr?)
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
  | .str s => Json.str s
  | .blk tag rows => Json.mkObj [("tag", Json.str tag), ("rows", Json.arr (rows.map WRow.toJson).toArray)]

partial def WRow.toJson : WRow → Json
  | .mk start line qs words =>
    Json.mkObj [("at", Lean.toJson start), ("line", optJson Lean.toJson line), ("q", Lean.toJson qs),
      ("w", Json.arr (words.map Word.toJson).toArray)]

end

mutual

partial def Word.fromJson (j : Json) : Except String Word :=
  match j with
  | Json.str s => return .str s
  | _ => do
    let tag ← (← j.getObjVal? "tag").getStr?
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
  Json.mkObj [("name", Json.str e.name), ("reason", optJson Json.str e.reason),
    ("line", optJson Lean.toJson e.line), ("message", Json.str e.message)]

def FrontErr.fromJson (j : Json) : Except String FrontErr := do
  let name ← (← j.getObjVal? "name").getStr?
  let reason := (optField j "reason").bind (fun r => (r.getStr?).toOption)
  let line := (optField j "line").bind (fun l => (l.getNat?).toOption)
  let message := ((optField j "message").bind (fun m => (m.getStr?).toOption)).getD ""
  return { name, reason, line, message }

/-- 前処理の結果の JSON（dump.mjs の `b1`）：`{text, lineAt}`。 -/
def Pre.toJson (p : Pre) : Json :=
  Json.mkObj [("text", Json.str p.text), ("lineAt", Lean.toJson p.lineAt)]

def Pre.fromJson (j : Json) : Except String Pre := do
  let text ← (← j.getObjVal? "text").getStr?
  let la ← (← j.getObjVal? "lineAt").getArr?
  return { text, lineAt := ← la.mapM (·.getNat?) }

end SignSem
