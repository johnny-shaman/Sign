import SignMath.Row

/-!
# K. 否定は書かなくていい（Mathlib を使わない）

値の集合 `V`、`!_` は `none`。前提 `x : V` は値の口に来た値（R83 で `!_` は口に残らない）。
述語 `p : V → Option V` は値か `!_` を返す（証人の述語に限らない）。
この節の証明は Mathlib を使わず、`Classical.choice` も排中律も使わない（`#print axioms` で確かめる）。
-/

namespace SignMath

universe u

/-! ## K.1 零対象への射は1本だけ -/

/-- 定理 K.1(a)：`!_` だけの所（Set* の零 {`!_`} = `Option Empty`）への写像は高々1本。 -/
theorem to_zero_unique {A : Type u} (f g : A → Option Empty) : f = g := by
  funext a
  match f a, g a with
  | none, none => rfl
  | some e, _ => exact e.elim
  | _, some e => exact e.elim

/-- 定理 K.1(b)：零からの、`!_` を保つ写像も高々1本（始かつ終＝零対象）。 -/
theorem from_zero_unique {A : Type u} (f g : Option Empty → Option A)
    (hf : f none = none) (hg : g none = none) : f = g := by
  funext o
  match o with
  | none => rw [hf, hg]
  | some e => exact e.elim

/-- 定理 K.1(c)：集合の圏の ⊥（空集合、始だが終でない）では、A → ⊥ があること自体が「A は空」を言う。 -/
theorem set_neg_content {A : Type u} : Nonempty (A → Empty) ↔ ¬ Nonempty A :=
  ⟨fun ⟨f⟩ ⟨a⟩ => (f a).elim, fun h => ⟨fun a => (h ⟨a⟩).elim⟩⟩

/-! ## K.2 真を id（前提を返す射）に取ると、否定は `x ; ·` -/

/-- 真偽の入れ替えを値の上に置いた物：`!_` を真の値 `i` へ、値を `!_` へ。 -/
def negO {V : Type u} (i : V) : Option V → Option V
  | none => some i
  | some _ => none

/-- 前置 `!`（R138）を射の上に置いた物：`!_` を id へ（クライスリの id は `some`）、値を `!_` の射へ。 -/
def negM {V : Type u} : Option V → (V → Option V)
  | none => some
  | some _ => fun _ => none

/-- 定理 K.2(a)：どの値 v でも、`v ; t` は t が `!_` なら v、値なら `!_`。 -/
theorem xor_value {V : Type u} (v : V) (t : Option V) :
    xorO (some v) t = (if t.isSome then none else some v) ∧
    (xorO (some v) t).isSome = !t.isSome := by
  cases t <;> exact ⟨rfl, rfl⟩

/-- 定理 K.2(b)：`!t` の id を前提 x に当てた答えは `x ; t`。
真の値を前提に取った入れ替えも `x ; t`。 -/
theorem neg_at_premise {V : Type u} (x : V) (t : Option V) :
    negM t x = xorO (some x) t ∧ negO x t = xorO (some x) t := by
  cases t <;> exact ⟨rfl, rfl⟩

/-! ## K.3 条件の式と、否定の消し方 -/

/-- 条件の式：字面の値、前提 x、述語 `pₖ x`、`|`・`&`・`;`、否定（真偽の入れ替え）。 -/
inductive Cond (V : Type u) : Type u
  | lit : V → Cond V
  | prem : Cond V
  | pred : Nat → Cond V
  | or : Cond V → Cond V → Cond V
  | and : Cond V → Cond V → Cond V
  | xor : Cond V → Cond V → Cond V
  | neg : Cond V → Cond V

/-- 式の値。否定は真偽を入れ替え、真の値を `i` に取る。 -/
def Cond.eval {V : Type u} (i : V) (ps : List (V → Option V)) (x : V) : Cond V → Option V
  | .lit v => some v
  | .prem => some x
  | .pred k => match ps[k]? with
    | some p => p x
    | none => none
  | .or a b => orO (a.eval i ps x) (b.eval i ps x)
  | .and a b => andO (a.eval i ps x) (b.eval i ps x)
  | .xor a b => xorO (a.eval i ps x) (b.eval i ps x)
  | .neg a => negO i (a.eval i ps x)

/-- 否定を書かない式。 -/
def Cond.NoNeg {V : Type u} : Cond V → Prop
  | .lit _ => True
  | .prem => True
  | .pred _ => True
  | .or a b => a.NoNeg ∧ b.NoNeg
  | .and a b => a.NoNeg ∧ b.NoNeg
  | .xor a b => a.NoNeg ∧ b.NoNeg
  | .neg _ => False

/-- 値の葉（字面の値も前提も）を書かない式。 -/
def Cond.NoVal {V : Type u} : Cond V → Prop
  | .lit _ => False
  | .prem => False
  | .pred _ => True
  | .or a b => a.NoVal ∧ b.NoVal
  | .and a b => a.NoVal ∧ b.NoVal
  | .xor a b => a.NoVal ∧ b.NoVal
  | .neg a => a.NoVal

/-- 式に書いた述語の番号（書いた順）。 -/
def Cond.preds {V : Type u} : Cond V → List Nat
  | .lit _ => []
  | .prem => []
  | .pred k => [k]
  | .or a b => a.preds ++ b.preds
  | .and a b => a.preds ++ b.preds
  | .xor a b => a.preds ++ b.preds
  | .neg a => a.preds

/-- 否定の所だけを `x ; ·` に置き換える。ほかの所は木のまま。 -/
def Cond.elim {V : Type u} : Cond V → Cond V
  | .lit v => .lit v
  | .prem => .prem
  | .pred k => .pred k
  | .or a b => .or a.elim b.elim
  | .and a b => .and a.elim b.elim
  | .xor a b => .xor a.elim b.elim
  | .neg a => .xor .prem a.elim

theorem Cond.elim_noNeg {V : Type u} (c : Cond V) : c.elim.NoNeg := by
  induction c with
  | lit _ => trivial
  | prem => trivial
  | pred _ => trivial
  | or _ _ iha ihb => exact ⟨iha, ihb⟩
  | and _ _ iha ihb => exact ⟨iha, ihb⟩
  | xor _ _ iha ihb => exact ⟨iha, ihb⟩
  | neg _ iha => exact ⟨trivial, iha⟩

/-- 定理 K.3(a)：置き換えは、書いた述語の並びを変えない。 -/
theorem Cond.elim_preds {V : Type u} (c : Cond V) : c.elim.preds = c.preds := by
  induction c with
  | lit _ => rfl
  | prem => rfl
  | pred _ => rfl
  | or _ _ iha ihb => simp only [Cond.elim, Cond.preds, iha, ihb]
  | and _ _ iha ihb => simp only [Cond.elim, Cond.preds, iha, ihb]
  | xor _ _ iha ihb => simp only [Cond.elim, Cond.preds, iha, ihb]
  | neg _ iha => simp only [Cond.elim, Cond.preds, iha, List.nil_append]

/-- 定理 K.3(b)：否定を `x ; ·` に置き換えた式は、真の値を前提 x に取った元の式と、値まで同じ。 -/
theorem Cond.elim_eval {V : Type u} (i : V) (ps : List (V → Option V)) (x : V) (c : Cond V) :
    c.elim.eval i ps x = c.eval x ps x := by
  induction c with
  | lit _ => rfl
  | prem => rfl
  | pred _ => rfl
  | or _ _ iha ihb => simp only [Cond.elim, Cond.eval, iha, ihb]
  | and _ _ iha ihb => simp only [Cond.elim, Cond.eval, iha, ihb]
  | xor _ _ iha ihb => simp only [Cond.elim, Cond.eval, iha, ihb]
  | neg a iha =>
    simp only [Cond.elim, Cond.eval, iha]
    exact ((neg_at_premise x _).2).symm

/-- 真偽の表：どの述語が値を返したか（`bs`）から、式が値か `!_` か。 -/
def Cond.tv {V : Type u} (bs : List Bool) : Cond V → Bool
  | .lit _ => true
  | .prem => true
  | .pred k => (bs[k]?).getD false
  | .or a b => a.tv bs || b.tv bs
  | .and a b => a.tv bs && b.tv bs
  | .xor a b => a.tv bs != b.tv bs
  | .neg a => !(a.tv bs)

/-- 定理 K.3(c)：式が値か `!_` かは、どの述語が値を返したかだけで決まる（真の値 `i` に依らない）。 -/
theorem Cond.isSome_eval {V : Type u} (i : V) (ps : List (V → Option V)) (x : V) (c : Cond V) :
    (c.eval i ps x).isSome = c.tv (ps.map fun p => (p x).isSome) := by
  induction c with
  | lit _ => rfl
  | prem => rfl
  | pred k =>
    simp only [Cond.eval, Cond.tv, List.getElem?_map]
    cases ps[k]? <;> rfl
  | or a b iha ihb => simp only [Cond.eval, Cond.tv, (isSome_ops _ _).1, iha, ihb]
  | and a b iha ihb => simp only [Cond.eval, Cond.tv, (isSome_ops _ _).2.1, iha, ihb]
  | xor a b iha ihb => simp only [Cond.eval, Cond.tv, (isSome_ops _ _).2.2, iha, ihb]
  | neg a iha =>
    simp only [Cond.eval, Cond.tv, ← iha]
    cases a.eval i ps x <;> rfl

/-- 定理 K.3（本体）：否定を書いた式は、否定を書かない式に置き換えられる。
置き換えは否定の所だけを `x ; ·` にし、書いた述語の並びは同じ。
値か `!_` かはどの真の値 `i` でも元と同じで、値は真の値を前提 x に取った元の式と同じ。 -/
theorem negation_unneeded {V : Type u} (c : Cond V) :
    ∃ d : Cond V, d.NoNeg ∧ d.preds = c.preds ∧
      ∀ (i : V) (ps : List (V → Option V)) (x : V),
        d.eval i ps x = c.eval x ps x ∧ (d.eval i ps x).isSome = (c.eval i ps x).isSome := by
  refine ⟨c.elim, c.elim_noNeg, c.elim_preds, fun i ps x => ⟨c.elim_eval i ps x, ?_⟩⟩
  rw [c.elim_eval i ps x, Cond.isSome_eval x ps x c, Cond.isSome_eval i ps x c]

/-! ## K.4 否定なしで、どの真偽の表も書ける -/

/-- 述語の番号を1つずらす。 -/
def Cond.shift {V : Type u} : Cond V → Cond V
  | .lit v => .lit v
  | .prem => .prem
  | .pred k => .pred (k + 1)
  | .or a b => .or a.shift b.shift
  | .and a b => .and a.shift b.shift
  | .xor a b => .xor a.shift b.shift
  | .neg a => .neg a.shift

theorem Cond.eval_shift {V : Type u} (i : V) (p : V → Option V) (ps : List (V → Option V))
    (x : V) (c : Cond V) : c.shift.eval i (p :: ps) x = c.eval i ps x := by
  induction c with
  | lit _ => rfl
  | prem => rfl
  | pred k => rfl
  | or a b iha ihb => simp only [Cond.shift, Cond.eval, iha, ihb]
  | and a b iha ihb => simp only [Cond.shift, Cond.eval, iha, ihb]
  | xor a b iha ihb => simp only [Cond.shift, Cond.eval, iha, ihb]
  | neg a iha => simp only [Cond.shift, Cond.eval, iha]

theorem Cond.noNeg_shift {V : Type u} (c : Cond V) (h : c.NoNeg) : c.shift.NoNeg := by
  induction c with
  | lit _ => trivial
  | prem => trivial
  | pred _ => trivial
  | or a b iha ihb => exact ⟨iha h.1, ihb h.2⟩
  | and a b iha ihb => exact ⟨iha h.1, ihb h.2⟩
  | xor a b iha ihb => exact ⟨iha h.1, ihb h.2⟩
  | neg _ _ => exact h.elim

/-- 真偽の表 f を、否定を使わずに書く（場合分け：`p₀ x & …` と `(x ; p₀ x) & …`）。
どの述語も書くので、短絡は保たない。 -/
def Cond.ofTable {V : Type u} : Nat → (List Bool → Bool) → Cond V
  | 0, f => if f [] then .prem else .xor .prem .prem
  | n + 1, f =>
    .or (.and (.pred 0) (Cond.ofTable n fun bs => f (true :: bs)).shift)
      (.and (.xor .prem (.pred 0)) (Cond.ofTable n fun bs => f (false :: bs)).shift)

theorem Cond.ofTable_noNeg {V : Type u} (n : Nat) (f : List Bool → Bool) :
    (Cond.ofTable (V := V) n f).NoNeg := by
  induction n generalizing f with
  | zero =>
    unfold Cond.ofTable
    split
    · trivial
    · exact ⟨trivial, trivial⟩
  | succ n ih =>
    exact ⟨⟨trivial, Cond.noNeg_shift _ (ih _)⟩,
      ⟨⟨trivial, trivial⟩, Cond.noNeg_shift _ (ih _)⟩⟩

theorem orO_none {α : Type u} (a : Option α) : orO a none = a := by
  cases a <;> rfl

/-- 定理 K.4：どの真偽の表も、`|`・`&`・`;`・述語・前提だけで書け、答えは条件が立てば x、立たなければ `!_`。 -/
theorem Cond.ofTable_eval {V : Type u} (i : V) (n : Nat) (f : List Bool → Bool)
    (ps : List (V → Option V)) (x : V) (hn : ps.length = n) :
    (Cond.ofTable n f).eval i ps x = if f (ps.map fun p => (p x).isSome) then some x else none := by
  induction n generalizing f ps with
  | zero =>
    match ps, hn with
    | [], _ =>
      unfold Cond.ofTable
      cases h : f [] <;> simp only [List.map_nil, h] <;> rfl
  | succ n ih =>
    match ps, hn with
    | p :: qs, hq =>
      have hq' : qs.length = n := Nat.succ.inj hq
      unfold Cond.ofTable
      simp only [Cond.eval, Cond.eval_shift, ih _ qs hq', List.map_cons]
      show orO (andO (p x) _) (andO (xorO (some x) (p x)) _) = _
      cases p x with
      | none => rfl
      | some y => simp only [andO, xorO, orO_none, Option.isSome_some]

/-! ## K.5 述語が全部 `!_` の所で値を出す物が要る -/

/-- 定理 K.5(a)：値の葉も否定も書かない式は、どの述語も `!_` を返す所で `!_`。 -/
theorem noVal_void {V : Type u} (i : V) (ps : List (V → Option V)) (x : V) (c : Cond V)
    (hp : c.NoVal) (hn : c.NoNeg) (h : ∀ k, (Cond.pred k : Cond V).eval i ps x = none) :
    c.eval i ps x = none := by
  induction c with
  | lit _ => exact hp.elim
  | prem => exact hp.elim
  | pred k => exact h k
  | or a b iha ihb => simp only [Cond.eval, iha hp.1 hn.1, ihb hp.2 hn.2]; rfl
  | and a b iha ihb => simp only [Cond.eval, iha hp.1 hn.1]; rfl
  | xor a b iha ihb => simp only [Cond.eval, iha hp.1 hn.1, ihb hp.2 hn.2]; rfl
  | neg _ _ => exact hn.elim

/-- 定理 K.5(b)：値の葉も否定も書かずに、p だけを使って「p でない」は書けない。 -/
theorem not_without_value {V : Type u} (i x : V) :
    ¬ ∃ c : Cond V, c.NoVal ∧ c.NoNeg ∧
      ∀ p : V → Option V, (c.eval i [p] x).isSome = !(p x).isSome := by
  intro ⟨c, hp, hn, hc⟩
  have e := hc (fun _ => none)
  rw [noVal_void i [fun _ => none] x c hp hn (fun k => by cases k <;> rfl)] at e
  cases e

/-! ## K.6 評価する所に置いた `!c` -/

/-- 評価する所の読み：`q a` の値（関数・id）を `!_` と読む（評価する所に残った関数は `!_`、`_` も）。 -/
def atEval {V : Type u} (q : V → Bool) : Option V → Option V
  | some a => if q a then none else some a
  | none => none

/-- 定理 K.6(a)：`!c` の答えの id を評価する所で `!_` と読むなら、`!c & t | e` は c に依らず e。 -/
theorem bang_in_condition {V : Type u} (q : V → Bool) (i : V) (hi : q i = true)
    (c t e : Option V) : orO (andO (atEval q (negO i c)) t) e = e := by
  cases c <;> simp [negO, atEval, hi, andO, orO]

/-- 前置 `!`（R138）の答えを、射か `!_` かで持つ：c が `!_` なら id（`some`）、値なら `!_`。 -/
def bang {V : Type u} : Option V → Option (V → Option V)
  | none => some some
  | some _ => none

/-- 並置で x に当てる：頭の `!_` は単位で消え（R137）、射なら x に当てる。 -/
def juxt {V : Type u} (h : Option (V → Option V)) (x : V) : Option V :=
  match h with
  | none => some x
  | some f => f x

/-- 定理 K.6(b)：並置で `!c` を x に当てると、c に依らず x。
`!_` を零射と読む模型（`negM`）でだけ `x ; c` になる（K.2(b)）。 -/
theorem bang_juxt {V : Type u} (c : Option V) (x : V) :
    juxt (bang c) x = some x ∧
    negM c = (match bang c with
      | some f => f
      | none => fun _ => none) := by
  cases c <;> exact ⟨rfl, rfl⟩

end SignMath
