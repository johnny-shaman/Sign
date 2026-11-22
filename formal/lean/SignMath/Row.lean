/-!
# I（前半）. 行の模型と振り分け（Mathlib を使わない）

`!_` を `Option` の `none` に置く（値の段の計算の `!_`。書いた `!_` は読む段が断る、R138）。
この節の証明は Mathlib を使わず、`Classical.choice` も排中律も使わない（`#print axioms` で確かめる）。
-/

namespace SignMath

universe u v w

/-! ## I.1 行の模型 -/

/-- 口の段の消し δ：計算の `!_`（`none`）を消す（R83：値の口では消えて口を使わない）。 -/
def dropVoid {V : Type u} (w : List (Option V)) : List V := w.filterMap id

/-- 行の模型：先に積んだ値 `u`、アリティ `n` の関数 `f`、実引数 `w`。
`!_` を消した実引数が `n` 個に足りなければ関数が残り、評価する所で `!_`（値は `u`）。 -/
def row {V : Type u} (n : Nat) (f : List V → Option V) (u : List V) (w : List (Option V)) :
    List V :=
  if (dropVoid w).length < n then u
  else u ++ (f ((dropVoid w).take n)).toList ++ (dropVoid w).drop n

/-- 正格な行：`!_` も席を取り、前の `n` 個に `!_` があればその適用は `!_`。 -/
def strictRow {V : Type u} (n : Nat) (f : List V → Option V) (u : List V)
    (w : List (Option V)) : List V :=
  if w.length < n then u
  else u ++ (if (w.take n).all (·.isSome) then (f (dropVoid (w.take n))).toList else [])
    ++ dropVoid (w.drop n)

private theorem aux_dropVoid_map_some {V : Type u} (l : List V) :
    dropVoid (l.map some) = l := by
  induction l with
  | nil => rfl
  | cons a l ih => exact congrArg (a :: ·) ih

private theorem aux_dropVoid_length_all {V : Type u} (l : List (Option V))
    (h : l.all (·.isSome) = true) : (dropVoid l).length = l.length := by
  induction l with
  | nil => rfl
  | cons a l ih =>
    cases a with
    | none => cases h
    | some x =>
      have h' : l.all (·.isSome) = true := h
      exact congrArg (· + 1) (ih h')

private theorem aux_dropVoid_length_not_all {V : Type u} (l : List (Option V))
    (h : l.all (·.isSome) = false) : (dropVoid l).length < l.length := by
  induction l with
  | nil => cases h
  | cons a l ih =>
    cases a with
    | none =>
      have := List.length_filterMap_le id l
      show (dropVoid l).length < l.length + 1
      exact Nat.lt_succ_of_le this
    | some x =>
      have h' : l.all (·.isSome) = false := h
      exact Nat.succ_lt_succ (ih h')

private theorem aux_dropVoid_split {V : Type u} (n : Nat) (w : List (Option V)) :
    dropVoid w = dropVoid (w.take n) ++ dropVoid (w.drop n) := by
  conv => lhs; rw [← List.take_append_drop n w]
  exact List.filterMap_append

/-- 定理 I.1(a)：行の値は `!_` を消した実引数だけで決まる（口の段の `f !_ = f`）。 -/
theorem row_dropVoid {V : Type u} (n : Nat) (f : List V → Option V) (u : List V)
    (w : List (Option V)) : row n f u w = row n f u ((dropVoid w).map some) := by
  unfold row
  rw [aux_dropVoid_map_some]

/-- 定理 I.1(b)：口が足りなければ、関数は残って `!_` になり、行の値は先に積んだ値だけ。 -/
theorem row_short {V : Type u} (n : Nat) (f : List V → Option V) (u : List V)
    (w : List (Option V)) (h : (dropVoid w).length < n) : row n f u w = u := by
  unfold row
  exact ite_eq_left h

/-- 定理 I.1(b)：行の段の `f !_ = !_`（アリティ ≥ 1）。 -/
theorem row_void_arg {V : Type u} (n : Nat) (hn : 0 < n) (f : List V → Option V) :
    row n f [] [(none : Option V)] = [] := by
  exact row_short n f [] [none] hn

/-- 定理 I.1(c)：空でない行の値が出る ⇔ 口が足りて、答えが値か後ろに値が残る。 -/
theorem row_ne_nil_iff {V : Type u} (n : Nat) (f : List V → Option V) (w : List (Option V)) :
    row n f [] w ≠ [] ↔
      n ≤ (dropVoid w).length ∧
        ((f ((dropVoid w).take n)).isSome = true ∨ n < (dropVoid w).length) := by
  unfold row
  split
  · rename_i h
    constructor
    · intro h'; exact absurd rfl h'
    · intro h'; exact absurd h'.1 (Nat.not_le_of_lt h)
  · rename_i h
    have hn : n ≤ (dropVoid w).length := Nat.le_of_not_lt h
    cases hf : f ((dropVoid w).take n) with
    | none =>
      simp [List.drop_eq_nil_iff, hn]
    | some y =>
      simp [hn]

/-- 定理 I.1(e)：どの関数でも行の読みと正格な読みが一致する ⇔
前の `n` 個に `!_` が無いか、後ろに値が残らない。 -/
theorem row_eq_strict_iff {V : Type u} (n : Nat) (u : List V) (w : List (Option V)) :
    (∀ f : List V → Option V, row n f u w = strictRow n f u w) ↔
      ((w.take n).all (·.isSome) = true ∨ dropVoid (w.drop n) = []) := by
  have hsplit := aux_dropVoid_split n w
  have htl : (w.take n).length = min n w.length := List.length_take
  have hdl : (w.drop n).length = w.length - n := List.length_drop
  have hbl := List.length_filterMap_le id (w.drop n)
  have hal := List.length_filterMap_le id (w.take n)
  have hwl := List.length_filterMap_le id w
  constructor
  · intro h
    cases hall : (w.take n).all (·.isSome) with
    | true => exact Or.inl rfl
    | false =>
      refine Or.inr ?_
      cases hb : dropVoid (w.drop n) with
      | nil => rfl
      | cons b bs =>
        exfalso
        have h0 := congrArg List.length (h (fun _ => none))
        have hlt := aux_dropVoid_length_not_all _ hall
        have hb1 : (dropVoid (w.drop n)).length = bs.length + 1 := by rw [hb]; rfl
        have hDl : (dropVoid w).length = (dropVoid (w.take n)).length + (bs.length + 1) := by
          rw [hsplit, List.length_append, hb1]
        unfold dropVoid at hb1 hlt hDl
        unfold row strictRow at h0
        rw [hall, hb] at h0
        have hwn : ¬ w.length < n := by omega
        rw [ite_eq_right hwn] at h0
        split at h0
        · simp only [List.length_append, List.length_cons] at h0
          omega
        · simp only [List.length_append, Option.toList, List.length_nil, List.length_drop,
            List.length_cons] at h0
          unfold dropVoid at h0
          omega
  · intro h f
    unfold row strictRow
    cases Nat.lt_or_ge w.length n with
    | inl hw =>
      rw [ite_eq_left hw, ite_eq_left (by unfold dropVoid; omega)]
    | inr hw =>
      rw [ite_eq_right (Nat.not_lt_of_le hw)]
      have htn : (w.take n).length = n := by omega
      cases hall : (w.take n).all (·.isSome) with
      | true =>
        have hA := aux_dropVoid_length_all _ hall
        rw [htn] at hA
        have hL : ¬ (dropVoid w).length < n := by
          rw [hsplit, List.length_append, hA]; omega
        rw [ite_eq_right hL, hsplit, List.take_left' hA, List.drop_left' hA]
        rfl
      | false =>
        have hb : dropVoid (w.drop n) = [] := by
          cases h with
          | inl h1 => rw [hall] at h1; cases h1
          | inr h1 => exact h1
        have hA := aux_dropVoid_length_not_all _ hall
        have hL : (dropVoid w).length < n := by
          rw [hsplit, List.length_append, hb]; simp; omega
        rw [ite_eq_left hL, hb]
        simp

/-- 引き算の2口の関数（仕様の `f2 : x y ? x - y`）。 -/
def sub2 : List Int → Option Int
  | [a, b] => some (a - b)
  | _ => none

/-- 例：`f2 (3 < 2) 1 2` は行の読みで -1（R83 の例）、正格な読みなら 2。 -/
example : row 2 sub2 [] [none, some 1, some 2] = [-1] ∧
    strictRow 2 sub2 [] [none, some 1, some 2] = [2] := by
  decide

/-! ## I.2 口の段と行の段（具体の形） -/

/-- 定理 I.2(b)：口の段の作用 ▹（`r ▹ !_ = r`）が smash の商を通るなら、R は1点。 -/
theorem port_action_not_smash {R : Type u} (pt : R) {V : Type v} (act : R → Option V → R)
    (hunit : ∀ r, act r none = r) (hsmash : ∀ r v, (r = pt ∨ v = none) → act r v = pt) :
    ∀ r, r = pt := by
  intro r
  exact (hunit r).symm.trans (hsmash r none (Or.inr rfl))

/-- 口の段の適用：`!_` は口を使わず関数が残り、値なら答えへ進む。 -/
def appPort {V : Type u} (g : V → Option V) : Option V → (V → Option V) ⊕ Option V
  | none => .inl g
  | some v => .inr (g v)

/-- 評価する所：残った関数は `!_`、値はそのまま。 -/
def rowEnd {V : Type u} : (V → Option V) ⊕ Option V → Option V
  | .inl _ => none
  | .inr o => o

/-- 定理 I.2(c)：評価する所を通した口の段の適用は、smash の評価射（正格な bind）と同じ。 -/
theorem rowEnd_appPort {V : Type u} (g : V → Option V) (o : Option V) :
    rowEnd (appPort g o) = o.bind g := by
  cases o <;> rfl

/-- 定理 I.2(c)：口の段の適用は、`!_` を受けた所で関数を区別するので smash の商を通らない。 -/
theorem appPort_not_smash {V : Type u} (v : V) :
    appPort (V := V) (fun _ => none) none ≠ appPort (V := V) some none := by
  intro h
  injection h with h'
  have h2 := congrFun h' v
  cases h2

/-! ## I.3・I.4 振り分けの演算 -/

/-- `a | b`：左が値なら左、`!_` なら右（catch、V7）。 -/
def orO {α : Type u} : Option α → Option α → Option α
  | some a, _ => some a
  | none, b => b

/-- `a & b`：左が `!_` なら `!_`、値なら右（V7）。 -/
def andO {α : Type u} {β : Type v} : Option α → Option β → Option β
  | none, _ => none
  | some _, b => b

/-- `a ; b`：片方だけが値ならその値、ほかは `!_`（V7）。 -/
def xorO {α : Type u} : Option α → Option α → Option α
  | some a, none => some a
  | none, some b => some b
  | _, _ => none

/-- 相対補 `a ∖ b`：右が `!_` なら左、値なら `!_`（Sign の演算子ではないが `&`・`;` で書ける）。 -/
def sdiffO {α : Type u} {β : Type v} : Option α → Option β → Option α
  | a, none => a
  | _, some _ => none

/-- 定理 I.3(a)：S⁰ の上で `|`・`&`・`;` は ∨・∧・排他和（isSome で写る）。 -/
theorem isSome_ops {α : Type u} (a b : Option α) :
    (orO a b).isSome = (a.isSome || b.isSome) ∧
    (andO a b).isSome = (a.isSome && b.isSome) ∧
    (xorO a b).isSome = (a.isSome != b.isSome) := by
  cases a <;> cases b <;> exact ⟨rfl, rfl, rfl⟩

/-- 定理 I.3(a)：S⁰ = 1₊ の元は isSome で Bool と1対1。 -/
theorem isSome_injective_S0 : Function.Injective (Option.isSome : Option PUnit.{u+1} → Bool) := by
  intro a b h
  cases a with
  | none =>
    cases b with
    | none => rfl
    | some _ => cases h
  | some p =>
    cases b with
    | none => cases h
    | some q => cases p; cases q; rfl

/-- 定理 I.3(b)：`&` は両側で正格（smash を通る）。`|` と `;` は通らない。 -/
theorem smash_profile {α : Type u} (a b : Option α) (x : α) :
    andO a (none : Option α) = none ∧ andO (none : Option α) b = none ∧
    orO (some x) none = some x ∧ xorO (some x) none = some x := by
  refine ⟨?_, rfl, rfl, rfl⟩
  cases a <;> rfl

/-- 定理 I.3(b)：`&` の転置は「評価しきったか」の真偽 {id, 0} を右に当てる物。 -/
theorem andO_transpose {α : Type u} {β : Type v} (a : Option α) :
    (fun b : Option β => andO a b) = (if a.isSome then id else fun _ => none) := by
  funext b
  cases a <;> rfl

/-- 定理 I.4(a)：`|` は冪等なモノイドで、`!_` が両側の単位、値は左零。 -/
theorem orO_laws {α : Type u} :
    (∀ x y z : Option α, orO (orO x y) z = orO x (orO y z)) ∧
    (∀ x : Option α, orO none x = x) ∧ (∀ x : Option α, orO x none = x) ∧
    (∀ x : Option α, orO x x = x) ∧ (∀ (a : α) (y : Option α), orO (some a) y = some a) := by
  refine ⟨fun x y z => ?_, fun x => rfl, fun x => ?_, fun x => ?_, fun a y => rfl⟩
  · cases x <;> cases y <;> cases z <;> rfl
  · cases x <;> rfl
  · cases x <;> rfl

/-- 定理 I.4(a)：`&` は結合的で冪等、`!_` が両側の零。 -/
theorem andO_laws {α : Type u} :
    (∀ x y z : Option α, andO (andO x y) z = andO x (andO y z)) ∧
    (∀ x : Option α, andO x x = x) ∧
    (∀ x : Option α, andO (none : Option α) x = none) ∧
    (∀ x : Option α, andO x (none : Option α) = none) := by
  refine ⟨fun x y z => ?_, fun x => ?_, fun x => rfl, fun x => ?_⟩
  · cases x <;> cases y <;> cases z <;> rfl
  · cases x <;> rfl
  · cases x <;> rfl

/-- 定理 I.4(a)：吸収律4本と、両側の分配律と、正規の形（右手系の歪束）。 -/
theorem skew_lattice_laws {α : Type u} (x y z : Option α) :
    andO x (orO x y) = x ∧ andO (orO y x) x = x ∧
    orO x (andO x y) = x ∧ orO (andO y x) x = x ∧
    andO x (orO y z) = orO (andO x y) (andO x z) ∧
    andO (orO x y) z = orO (andO x z) (andO y z) ∧
    andO x (andO y x) = andO y x ∧ orO x (orO y x) = orO x y := by
  cases x <;> cases y <;> cases z <;> exact ⟨rfl, rfl, rfl, rfl, rfl, rfl, rfl, rfl⟩

/-- 定理 I.4(a)：相対補は `&`・`;` で書け、`;` は相対補と `|` で書ける。 -/
theorem sdiff_xor {α : Type u} (x y : Option α) :
    sdiffO x y = andO x (xorO x y) ∧ xorO x y = orO (sdiffO x y) (sdiffO y x) := by
  cases x <;> cases y <;> exact ⟨rfl, rfl⟩

/-- 定理 I.4(b)：`|` が可換 ⇔ 値が高々1つ。 -/
theorem orO_comm_iff {α : Type u} :
    (∀ x y : Option α, orO x y = orO y x) ↔ ∀ a b : α, a = b := by
  constructor
  · intro h a b
    have h1 : some a = some b := h (some a) (some b)
    injection h1
  · intro h x y
    cases x with
    | none => cases y <;> rfl
    | some a =>
      cases y with
      | none => rfl
      | some b => exact congrArg some (h a b)

/-- 定理 I.4(b)：`&` が可換 ⇔ 値が高々1つ。 -/
theorem andO_comm_iff {α : Type u} :
    (∀ x y : Option α, andO x y = andO y x) ↔ ∀ a b : α, a = b := by
  constructor
  · intro h a b
    have h1 : some b = some a := h (some a) (some b)
    injection h1 with h2
    exact h2.symm
  · intro h x y
    cases x with
    | none => cases y <;> rfl
    | some a =>
      cases y with
      | none => rfl
      | some b => exact congrArg some (h b a)

/-- 定理 I.4(b)：`(c & t) | e` は「c も t も値なら t、ほかは e」で、if-then-else と違う。 -/
theorem and_or_gap {α : Type u} (c t e : Option α) :
    orO (andO c t) e = (if (c.isSome && t.isSome) = true then t else e) := by
  cases c <;> cases t <;> rfl

/-! ## I.4(c) 証人を返す述語と制限 -/

/-- 証人の述語：どの x でも `p x = x` か `!_`（`is_even 4` は 4）。 -/
def IsWitness {X : Type u} (p : X → Option X) : Prop := ∀ x, p x = some x ∨ p x = none

def witnessToBool {X : Type u} (p : X → Option X) : X → Bool := fun x => (p x).isSome

def boolToWitness {X : Type u} (b : X → Bool) : X → Option X :=
  fun x => if b x = true then some x else none

/-- 定理 I.4(c)：証人の述語と X → Bool は1対1（公理なし）。 -/
theorem witness_bool_inverse {X : Type u} :
    (∀ b : X → Bool, IsWitness (boolToWitness b) ∧ witnessToBool (boolToWitness b) = b) ∧
    (∀ p : X → Option X, IsWitness p → boolToWitness (witnessToBool p) = p) := by
  refine ⟨fun b => ⟨fun x => ?_, ?_⟩, fun p hp => ?_⟩
  · unfold boolToWitness
    cases b x
    · exact Or.inr rfl
    · exact Or.inl rfl
  · funext x
    unfold witnessToBool boolToWitness
    cases b x <;> rfl
  · funext x
    unfold boolToWitness witnessToBool
    cases hp x with
    | inl h => rw [h]; rfl
    | inr h => rw [h]; rfl

/-- Kleisli の合成（左から）。 -/
def kc {X : Type u} {Y : Type v} {Z : Type w} (f : X → Option Y) (g : Y → Option Z) :
    X → Option Z := fun x => (f x).bind g

/-- 制限 f̄(x) = f(x) & x（Cockett–Lack）。 -/
def restr {X : Type u} {Y : Type v} (f : X → Option Y) : X → Option X :=
  fun x => andO (f x) (some x)

/-- 定理 I.4(c)：証人の述語は、ちょうど制限の冪等（ē = e）。 -/
theorem restr_eq_self_iff {X : Type u} (e : X → Option X) : restr e = e ↔ IsWitness e := by
  constructor
  · intro h x
    have hx : andO (e x) (some x) = e x := congrFun h x
    cases hex : e x with
    | none => exact Or.inr rfl
    | some y =>
      rw [hex] at hx
      exact Or.inl hx.symm
  · intro hp
    funext x
    unfold restr
    cases hp x with
    | inl h => rw [h]; rfl
    | inr h => rw [h]; rfl

/-- 定理 I.4(c)：制限の公理 R1〜R4。 -/
theorem restr_axioms {X : Type u} {Y : Type v} {Z : Type w} :
    (∀ f : X → Option Y, kc (restr f) f = f) ∧
    (∀ (f : X → Option Y) (g : X → Option Z), kc (restr f) (restr g) = kc (restr g) (restr f)) ∧
    (∀ (f : X → Option Y) (g : X → Option Z), restr (kc (restr f) g) = kc (restr f) (restr g)) ∧
    (∀ (f : X → Option Y) (g : Y → Option Z), kc f (restr g) = kc (restr (kc f g)) f) := by
  refine ⟨fun f => ?_, fun f g => ?_, fun f g => ?_, fun f g => ?_⟩
  · funext x
    unfold kc restr
    cases hf : f x with
    | none => rfl
    | some y => exact hf
  · funext x
    unfold kc restr
    cases hf : f x <;> cases hg : g x <;> simp [andO, hf, hg]
  · funext x
    unfold kc restr
    cases hf : f x <;> cases hg : g x <;> simp [andO, hf, hg]
  · funext x
    unfold kc restr
    cases hf : f x with
    | none => simp [andO, hf]
    | some y => cases hg : g y <;> simp [andO, hf, hg]

/-- 定理 I.4(c)：証人の述語の上で `&` は Kleisli の合成、補は x ∖ p x で、Bool の否定に写る。 -/
theorem witness_algebra {X : Type u} (p q : X → Option X) (hp : IsWitness p) :
    (fun x => andO (p x) (q x)) = kc p q ∧
    IsWitness (fun x => sdiffO (some x) (p x)) ∧
    (∀ x, (sdiffO (some x) (p x)).isSome = !(p x).isSome) := by
  refine ⟨?_, fun x => ?_, fun x => ?_⟩
  · funext x
    unfold kc
    cases hp x with
    | inl h => rw [h]; rfl
    | inr h => rw [h]; rfl
  · show sdiffO (some x) (p x) = some x ∨ sdiffO (some x) (p x) = none
    cases p x
    · exact Or.inl rfl
    · exact Or.inr rfl
  · cases p x <;> rfl

/-! ## I.7(b) Maybe の上の自然な2項演算 -/

/-- Option の上の、どの写像とも交換する2項演算（(−)₊ の像の射と零射について自然）。 -/
def NatOptOp : Type (u+1) :=
  {op : ∀ α : Type u, Option α → Option α → Option α //
    ∀ (α β : Type u) (g : α → β) (a b : Option α),
      (op α a b).map g = op β (a.map g) (b.map g)}

/-- 12 本の演算：(値, 値) の行き先 ∈ {*, x, y}、(値, *) ∈ {*, x}、(*, 値) ∈ {*, y}。 -/
def buildOp (c : Fin 3 × Bool × Bool) : NatOptOp.{u} :=
  ⟨fun _ a b =>
    match a, b with
    | some x, some y =>
      match c.1.val with
      | 0 => none
      | 1 => some x
      | _ => some y
    | some x, none => if c.2.1 = true then some x else none
    | none, some y => if c.2.2 = true then some y else none
    | none, none => none,
   by
    rcases c with ⟨⟨_ | _ | k, hk⟩, b1, b2⟩ <;> intro α β g a b <;> cases a <;> cases b <;>
      cases b1 <;> cases b2 <;> rfl⟩

/-- 自然な2項演算の座標：3つの見本の点での値。 -/
private def aux_decode (o : NatOptOp.{u}) : Fin 3 × Bool × Bool :=
  (match o.1 (ULift.{u} Bool) (some ⟨false⟩) (some ⟨true⟩) with
    | none => 0
    | some ⟨false⟩ => 1
    | some ⟨true⟩ => 2,
   (o.1 PUnit (some PUnit.unit) none).isSome,
   (o.1 PUnit none (some PUnit.unit)).isSome)

private theorem aux_decode_buildOp (c : Fin 3 × Bool × Bool) :
    aux_decode (buildOp.{u} c) = c := by
  rcases c with ⟨⟨_ | _ | _ | k, hk⟩, b1, b2⟩
  · cases b1 <;> cases b2 <;> rfl
  · cases b1 <;> cases b2 <;> rfl
  · cases b1 <;> cases b2 <;> rfl
  · exact absurd hk (by omega)

/-- 定理 I.7(b)：自然な2項演算は 12 本の1つ。 -/
theorem natOptOp_classify (o : NatOptOp.{u}) : ∃ c, o = buildOp c := by
  refine ⟨aux_decode o, ?_⟩
  obtain ⟨op, hop⟩ := o
  apply Subtype.ext
  funext α a b
  cases a with
  | none =>
    cases b with
    | none =>
      have h : (op PEmpty none none).map PEmpty.elim = op α none none :=
        hop PEmpty α PEmpty.elim none none
      show op α none none = none
      rw [← h]
      generalize op PEmpty none none = t
      cases t with
      | none => rfl
      | some e => exact e.elim
    | some y =>
      have h : (op PUnit none (some PUnit.unit)).map (fun _ => y) = op α none (some y) :=
        hop PUnit α (fun _ => y) none (some PUnit.unit)
      show op α none (some y) =
        (if (op PUnit none (some PUnit.unit)).isSome = true then some y else none)
      rw [← h]
      generalize op PUnit none (some PUnit.unit) = t
      cases t <;> rfl
  | some x =>
    cases b with
    | none =>
      have h : (op PUnit (some PUnit.unit) none).map (fun _ => x) = op α (some x) none :=
        hop PUnit α (fun _ => x) (some PUnit.unit) none
      show op α (some x) none =
        (if (op PUnit (some PUnit.unit) none).isSome = true then some x else none)
      rw [← h]
      generalize op PUnit (some PUnit.unit) none = t
      cases t <;> rfl
    | some y =>
      have h : (op (ULift.{u} Bool) (some ⟨false⟩) (some ⟨true⟩)).map
          (fun b => cond b.down y x) = op α (some x) (some y) :=
        hop (ULift.{u} Bool) α (fun b => cond b.down y x) (some ⟨false⟩) (some ⟨true⟩)
      show op α (some x) (some y) =
        (match (match op (ULift.{u} Bool) (some ⟨false⟩) (some ⟨true⟩) with
          | none => (0 : Fin 3)
          | some ⟨false⟩ => 1
          | some ⟨true⟩ => 2).val with
        | 0 => none
        | 1 => some x
        | _ => some y)
      rw [← h]
      generalize op (ULift.{u} Bool) (some ⟨false⟩) (some ⟨true⟩) = t
      rcases t with _ | ⟨_ | _⟩ <;> rfl

/-- 定理 I.7(b)：12 本はどれも違う。 -/
theorem buildOp_injective : Function.Injective (buildOp.{u}) := by
  intro c₁ c₂ h
  have h' := congrArg aux_decode h
  rwa [aux_decode_buildOp, aux_decode_buildOp] at h'

/-- 定理 I.7(b)：`|`・`&`・`;` の座標。 -/
theorem ops_coordinates :
    (buildOp.{u} (1, true, true)).1 = (fun α => @orO α) ∧
    (buildOp.{u} (2, false, false)).1 = (fun α => @andO α α) ∧
    (buildOp.{u} (0, true, true)).1 = (fun α => @xorO α) := by
  refine ⟨?_, ?_, ?_⟩ <;> funext α a b <;> cases a <;> cases b <;> rfl

/-! ## I.8 振り分けを通して配れる射（Maybe の形） -/

/-- 定理 I.8：k が `|` に左分配する ⇔ k の値か `!_` かが入力に依らない。 -/
theorem orO_left_distrib_iff {α : Type u} {β : Type v} (k : α → Option β) :
    (∀ m n : Option α, (orO m n).bind k = orO (m.bind k) (n.bind k)) ↔
      ∀ a b, k a = none → k b = none := by
  constructor
  · intro h a b ha
    have h1 : k a = orO (k a) (k b) := h (some a) (some b)
    rw [ha] at h1
    exact h1.symm
  · intro h m n
    cases m with
    | none => rfl
    | some a =>
      show k a = orO (k a) (n.bind k)
      cases hka : k a with
      | some c => rfl
      | none =>
        cases n with
        | none => rfl
        | some b => exact (h a b hka).symm

/-- 定理 I.8：`&` でも同じ条件。 -/
theorem andO_left_distrib_iff {α : Type u} {β : Type v} (k : α → Option β) :
    (∀ m n : Option α, (andO m n).bind k = andO (m.bind k) (n.bind k)) ↔
      ∀ a b, k a = none → k b = none := by
  constructor
  · intro h a b ha
    have h1 : k b = andO (k a) (k b) := h (some a) (some b)
    rw [ha] at h1
    exact h1
  · intro h m n
    cases m with
    | none => rfl
    | some a =>
      show n.bind k = andO (k a) (n.bind k)
      cases hka : k a with
      | some c => rfl
      | none =>
        cases n with
        | none => rfl
        | some b => exact h a b hka

/-- 定理 I.8：`;` でも同じ条件。 -/
theorem xorO_left_distrib_iff {α : Type u} {β : Type v} (k : α → Option β) :
    (∀ m n : Option α, (xorO m n).bind k = xorO (m.bind k) (n.bind k)) ↔
      ∀ a b, k a = none → k b = none := by
  constructor
  · intro h a b ha
    have h1 : none = xorO (k a) (k b) := h (some a) (some b)
    rw [ha] at h1
    cases hkb : k b with
    | none => rfl
    | some c =>
      rw [hkb] at h1
      cases h1
  · intro h m n
    cases m with
    | none =>
      cases n with
      | none => rfl
      | some b =>
        show k b = xorO none (k b)
        cases k b <;> rfl
    | some a =>
      cases n with
      | none =>
        show k a = xorO (k a) none
        cases k a <;> rfl
      | some b =>
        show none = xorO (k a) (k b)
        cases hka : k a with
        | none => rw [h a b hka]; rfl
        | some c =>
          cases hkb : k b with
          | none =>
            have h2 := h b a hkb
            rw [hka] at h2
            cases h2
          | some d => rfl

/-! ## I.10 拾う `!_` と発散 -/

/-- 平坦な順序（`none` を ⊥ とする）。 -/
def flatLE {X : Type u} : Option X → Option X → Prop
  | none, _ => True
  | some x, some y => x = y
  | some _, none => False

/-- 定理 I.10(i)：拾う `!_` を発散 ⊥ と同じ点に置くと、`|` は単調でない。 -/
theorem orO_not_monotone {X : Type u} (x y : X) (hxy : x ≠ y) :
    ¬ (∀ a a' b b' : Option X, flatLE a a' → flatLE b b' → flatLE (orO a b) (orO a' b')) := by
  intro h
  have h1 : y = x := h none (some x) (some y) (some y) True.intro rfl
  exact hxy h1.symm

/-- (X₊)_⊥ の上の catch：外の `none` は発散 ⊥、`some none` は見えた `!_`。 -/
def orL {X : Type u} : Option (Option X) → Option (Option X) → Option (Option X)
  | none, _ => none
  | some none, b => b
  | some (some x), _ => some (some x)

/-- 定理 I.10(iii)：見えた `!_` と発散を分ければ、catch は単調で、左の発散に正格で、smash を通らない。 -/
theorem orL_profile {X : Type u} (x : X) :
    (∀ a a' b b' : Option (Option X), flatLE a a' → flatLE b b' →
      flatLE (orL a b) (orL a' b')) ∧
    (∀ b : Option (Option X), orL none b = none) ∧
    orL (some (some x)) none = some (some x) := by
  refine ⟨fun a a' b b' ha hb => ?_, fun b => rfl, rfl⟩
  cases a with
  | none => exact True.intro
  | some p =>
    cases a' with
    | none => exact False.elim ha
    | some p' =>
      have hp : p = p' := ha
      subst hp
      cases p with
      | none => exact hb
      | some z => exact (rfl : some z = some z)

end SignMath
