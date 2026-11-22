import SignMath.Kappa

/-!
# I（後半）. 振り分けの構成の代金（Mathlib を使わない）

この節の証明は Mathlib を使わず、`Classical.choice` も排中律も使わない（`#print axioms` で確かめる）。
`propext` と `Quot.sound` は使う。
-/

namespace SignMath

universe u v

/-! ## I.11 振り分けが公理なしで在る所 -/

/-- 付点の型（Mathlib の `Pointed` と同じ形を、Mathlib を使わずに置く）。 -/
structure PType : Type (u+1) where
  carrier : Type u
  point : carrier

/-- 基点との等しさが決まる（命題の形）。 -/
def DecidesPoint (A : PType.{u}) : Prop := ∀ a : A.carrier, a = A.point ∨ a ≠ A.point

/-- 振り分け：基点で `false`、ほかで `true`。 -/
def IsSorter (A : PType.{u}) (J : A.carrier → Bool) : Prop := ∀ a, J a = false ↔ a = A.point

/-- 比べの写像 c_A : (A∖*)₊ → A。 -/
def canon (A : PType.{u}) : Option {a : A.carrier // a ≠ A.point} → A.carrier
  | none => A.point
  | some a => a.val

/-- 定理 I.11(a)：振り分けは在れば1つ。 -/
theorem sorter_unique (A : PType.{u}) (J K : A.carrier → Bool) (hJ : IsSorter A J)
    (hK : IsSorter A K) : J = K := by
  funext a
  cases hJa : J a with
  | false =>
    exact ((hK a).mpr ((hJ a).mp hJa)).symm
  | true =>
    cases hKa : K a with
    | false =>
      have := (hJ a).mpr ((hK a).mp hKa)
      rw [hJa] at this
      cases this
    | true => rfl

/-- 定理 I.11(a)：c_A はいつも単射。 -/
theorem canon_injective (A : PType.{u}) : Function.Injective (canon A) := by
  intro o o' h
  cases o with
  | none =>
    cases o' with
    | none => rfl
    | some b => exact (b.property h.symm).elim
  | some a =>
    cases o' with
    | none => exact (a.property h).elim
    | some b =>
      have hab : a.val = b.val := h
      exact congrArg some (Subtype.ext hab)

/-- 定理 I.11(a)：c_A が全射 ⇔ 基点が決まる。 -/
theorem canon_surjective_iff (A : PType.{u}) : Function.Surjective (canon A) ↔ DecidesPoint A := by
  constructor
  · intro hs a
    obtain ⟨o, ho⟩ := hs a
    cases o with
    | none => exact Or.inl ho.symm
    | some b => exact Or.inr (fun e => b.property (ho.trans e))
  · intro hD a
    cases hD a with
    | inl h => exact ⟨none, h.symm⟩
    | inr h => exact ⟨some ⟨a, h⟩, rfl⟩

/-- 定理 I.11(a)：振り分けが在れば基点が決まる。 -/
theorem decidesPoint_of_sorter (A : PType.{u}) (J : A.carrier → Bool) (hJ : IsSorter A J) :
    DecidesPoint A := by
  intro a
  cases hJa : J a with
  | false => exact Or.inl ((hJ a).mp hJa)
  | true =>
    refine Or.inr (fun e => ?_)
    have := (hJ a).mpr e
    rw [hJa] at this
    cases this

/-- 定理 I.11(a)：基点が決まる（データの形）なら振り分けが在る。 -/
def sorterOfDecidable (A : PType.{u}) (d : ∀ a : A.carrier, Decidable (a = A.point)) :
    {J : A.carrier → Bool // IsSorter A J} := by
  refine ⟨fun a => match d a with
    | isTrue _ => false
    | isFalse _ => true, fun a => ?_⟩
  show (match d a with
    | isTrue _ => false
    | isFalse _ => true) = false ↔ a = A.point
  cases d a with
  | isTrue h => exact ⟨fun _ => h, fun _ => rfl⟩
  | isFalse h => exact ⟨fun e => Bool.noConfusion e, fun e => absurd e h⟩

/-- 定理 I.11(a)：基点が決まる ⇔ A は付点の全単射で X₊ の形。 -/
theorem decidesPoint_iff_plus (A : PType.{u}) :
    DecidesPoint A ↔ ∃ (X : Type u) (e : Option X → A.carrier),
      e none = A.point ∧ Function.Injective e ∧ Function.Surjective e := by
  constructor
  · intro hD
    exact ⟨{a : A.carrier // a ≠ A.point}, canon A, rfl, canon_injective A,
      (canon_surjective_iff A).mpr hD⟩
  · rintro ⟨X, e, he0, hinj, hsurj⟩ a
    obtain ⟨o, ho⟩ := hsurj a
    cases o with
    | none => exact Or.inl (ho.symm.trans he0)
    | some x =>
      refine Or.inr (fun ha => ?_)
      have hx : e (some x) = e none := by rw [ho, ha, he0]
      cases hinj hx

/-- 定理 I.11(a)：どの付点集合でも、基点が決まることの否定の否定は成り立つ。 -/
theorem not_not_decides (A : PType.{u}) (a : A.carrier) : ¬¬(a = A.point ∨ a ≠ A.point) := by
  intro h
  exact h (Or.inr (fun e => h (Or.inl e)))

/-- 定理 I.11(b)：どの付点集合でも基点が決まる ⇔ 排中律。 -/
theorem lem_iff_decidesPoint : (∀ P : Prop, P ∨ ¬P) ↔ ∀ A : PType.{0}, DecidesPoint A := by
  constructor
  · intro H A a
    exact H (a = A.point)
  · intro H P
    cases H ⟨Prop, True⟩ P with
    | inl e => exact Or.inl (e.mpr trivial)
    | inr ne => exact Or.inr (fun hp => ne (propext ⟨fun _ => trivial, fun _ => hp⟩))

/-- 定理 I.11(b)：弱い形は弱い排中律と同値。 -/
theorem wlem_iff :
    (∀ P : Prop, ¬P ∨ ¬¬P) ↔ ∀ (A : PType.{0}) (a : A.carrier), a ≠ A.point ∨ ¬(a ≠ A.point) := by
  constructor
  · intro H A a
    exact H (a = A.point)
  · intro H P
    cases H ⟨Prop, True⟩ P with
    | inl ne => exact Or.inl (fun hp => ne (propext ⟨fun _ => trivial, fun _ => hp⟩))
    | inr nn => exact Or.inr (fun hnp => nn (fun e => hnp (e.mpr trivial)))

/-- 定理 I.11(b)：Kl(Maybe)(1,1) = 2 → Par(1,1) = Ω が全射 ⇔ 排中律。 -/
theorem bool_to_prop_surjective_iff :
    Function.Surjective (fun b : Bool => b = true) ↔ ∀ P : Prop, P ∨ ¬P := by
  constructor
  · intro hs P
    obtain ⟨b, hb⟩ := hs P
    cases b with
    | true => exact Or.inl (hb.mp rfl)
    | false =>
      refine Or.inr (fun hp => ?_)
      have hf : false = true := hb.mpr hp
      cases hf
  · intro H P
    cases H P with
    | inl hp => exact ⟨true, propext ⟨fun _ => hp, fun _ => rfl⟩⟩
    | inr hnp => exact ⟨false, propext ⟨fun e => Bool.noConfusion e, fun hp => absurd hp hnp⟩⟩

/-- Diaconescu の商 A_P = 2/∼_P（a ∼ b :⇔ a = b ∨ P）。 -/
def dSetoid (P : Prop) : Setoid Bool where
  r a b := a = b ∨ P
  iseqv := by
    refine ⟨fun _ => Or.inl rfl, fun h => ?_, fun h1 h2 => ?_⟩
    · cases h with
      | inl e => exact Or.inl e.symm
      | inr p => exact Or.inr p
    · cases h1 with
      | inl e1 =>
        cases h2 with
        | inl e2 => exact Or.inl (e1.trans e2)
        | inr p => exact Or.inr p
      | inr p => exact Or.inr p

/-- A_P の基点は [true]。 -/
def AP (P : Prop) : PType.{0} := ⟨Quotient (dSetoid P), Quotient.mk _ true⟩

/-- 定理 I.11(c)：A_P の基点が決まる ⇔ P ∨ ¬P。 -/
theorem decidesPoint_AP_iff (P : Prop) : DecidesPoint (AP P) ↔ P ∨ ¬P := by
  constructor
  · intro hD
    cases hD (Quotient.mk (dSetoid P) false) with
    | inl h =>
      have h' : Quotient.mk (dSetoid P) false = Quotient.mk (dSetoid P) true := h
      have h'' : false = true ∨ P := Quotient.exact h'
      cases h'' with
      | inl e => cases e
      | inr hp => exact Or.inl hp
    | inr h =>
      refine Or.inr (fun hp => h ?_)
      have e : Quotient.mk (dSetoid P) false = Quotient.mk (dSetoid P) true :=
        Quotient.sound (Or.inr hp)
      exact e
  · intro hP
    show ∀ x : Quotient (dSetoid P),
      x = Quotient.mk (dSetoid P) true ∨ x ≠ Quotient.mk (dSetoid P) true
    intro x
    induction x using Quotient.ind
    rename_i b
    cases hP with
    | inl hp => exact Or.inl (Quotient.sound (Or.inr hp))
    | inr hnp =>
      cases b with
      | true => exact Or.inl rfl
      | false =>
        refine Or.inr (fun h => ?_)
        have h'' : false = true ∨ P := Quotient.exact h
        cases h'' with
        | inl e => cases e
        | inr hp => exact hnp hp

/-- 定理 I.11(c)：q_P : 2 → A_P に切断がある ⇔ P ∨ ¬P。 -/
theorem section_AP_iff (P : Prop) :
    (∃ s : (AP P).carrier → Bool, ∀ x, Quotient.mk (dSetoid P) (s x) = x) ↔ P ∨ ¬P := by
  constructor
  · rintro ⟨s, hs⟩
    have key : ∀ b1 b2 : Bool, s (Quotient.mk (dSetoid P) true) = b1 →
        s (Quotient.mk (dSetoid P) false) = b2 → P ∨ ¬P := by
      intro b1 b2 h1 h2
      cases decEq b1 b2 with
      | isTrue e =>
        have htf : Quotient.mk (dSetoid P) true = Quotient.mk (dSetoid P) false :=
          calc Quotient.mk (dSetoid P) true
              = Quotient.mk (dSetoid P) (s (Quotient.mk (dSetoid P) true)) := (hs _).symm
            _ = Quotient.mk (dSetoid P) (s (Quotient.mk (dSetoid P) false)) := by rw [h1, h2, e]
            _ = Quotient.mk (dSetoid P) false := hs _
        have h'' : true = false ∨ P := Quotient.exact htf
        cases h'' with
        | inl e' => cases e'
        | inr hp => exact Or.inl hp
      | isFalse ne =>
        refine Or.inr (fun hp => ne ?_)
        have htf : Quotient.mk (dSetoid P) true = Quotient.mk (dSetoid P) false :=
          Quotient.sound (Or.inr hp)
        have hst := congrArg s htf
        rw [h1, h2] at hst
        exact hst
    exact key _ _ rfl rfl
  · intro hP
    cases hP with
    | inl hp =>
      refine ⟨fun _ => true, ?_⟩
      show ∀ x : Quotient (dSetoid P), Quotient.mk (dSetoid P) true = x
      intro x
      induction x using Quotient.ind
      exact Quotient.sound (Or.inr hp)
    | inr hnp =>
      refine ⟨Quotient.lift (s := dSetoid P) id (fun a b h => ?_), ?_⟩
      · cases h with
        | inl e => exact e
        | inr hp => exact absurd hp hnp
      · show ∀ x : Quotient (dSetoid P), Quotient.mk (dSetoid P) (Quotient.lift (s := dSetoid P) id _ x) = x
        intro x
        induction x using Quotient.ind
        rfl

/-- 定理 I.11(c)：2 からの全射がどれも切断を持てば排中律（Diaconescu）。 -/
theorem diaconescu :
    (∀ (B : Type) (f : Bool → B), Function.Surjective f → ∃ s : B → Bool, ∀ b, f (s b) = b) →
      ∀ P : Prop, P ∨ ¬P := by
  intro H P
  apply (section_AP_iff P).mp
  refine H (AP P).carrier (Quotient.mk (dSetoid P)) ?_
  show ∀ x : Quotient (dSetoid P), ∃ b, Quotient.mk (dSetoid P) b = x
  intro x
  induction x using Quotient.ind
  exact ⟨_, rfl⟩

/-- 定理 I.11(d)：X₊ の上では振り分けは isSome で、公理なしで在る。 -/
def optSorter (X : Type u) : {J : Option X → Bool // IsSorter ⟨Option X, none⟩ J} :=
  ⟨Option.isSome, by
    intro a
    cases a with
    | none => exact ⟨fun _ => rfl, fun _ => rfl⟩
    | some x => exact ⟨fun e => Bool.noConfusion e, fun e => by cases e⟩⟩

/-! ## I.12 暗黙の基底で止まる再帰（R122） -/

/-- next を n 回たどる（`!_` に着けば `!_` のまま）。 -/
def iterN {X : Type u} (next : X → Option X) : Nat → Option X → Option X
  | 0, o => o
  | n + 1, o => iterN next n (o.bind next)

/-- x から next をたどると有限回で `!_` に着く。 -/
def Terminates {X : Type u} (next : X → Option X) (x : X) : Prop :=
  ∃ n, iterN next n (some x) = none

/-- 方程式 f(x) = h(x, next(x) ≫= f)：next が `!_` なら呼び出しは本体を読まずに `!_`。 -/
def Sol {X : Type u} {Y : Type v} (next : X → Option X) (h : X → Option Y → Option Y)
    (f : X → Option Y) : Prop :=
  ∀ x, f x = h x ((next x).bind f)

private theorem aux_acc_of_iter {X : Type u} (next : X → Option X) :
    ∀ n (o : Option X), iterN next n o = none → ∀ x, o = some x →
      Acc (fun y x => next x = some y) x := by
  intro n
  induction n with
  | zero =>
    intro o ho x hx
    rw [hx] at ho
    cases ho
  | succ n ih =>
    intro o ho x hx
    subst hx
    exact ⟨x, fun y hy => ih (next x) ho y hy⟩

/-- 軌道がどれも `!_` に着けば、「next で1歩先」は整礎。 -/
private theorem aux_wf_of_term {X : Type u} (next : X → Option X)
    (hT : ∀ x, Terminates next x) : WellFounded (fun y x => next x = some y) :=
  ⟨fun x => by
    obtain ⟨n, hn⟩ := hT x
    exact aux_acc_of_iter next n (some x) hn x rfl⟩

private def aux_pbind {X : Type u} {Y : Type v} :
    (o : Option X) → ((y : X) → o = some y → Option Y) → Option Y
  | none, _ => none
  | some y, g => g y rfl

private theorem aux_pbind_eq {X : Type u} {Y : Type v} (o : Option X) (f : X → Option Y) :
    aux_pbind o (fun y _ => f y) = o.bind f := by
  cases o <;> rfl

private theorem aux_fix_sol {X : Type u} {Y : Type v} (next : X → Option X)
    (hwf : WellFounded (fun y x => next x = some y)) (h : X → Option Y → Option Y) :
    Sol next h (hwf.fix (C := fun _ => Option Y) (fun x rec => h x (aux_pbind (next x) rec))) := by
  intro x
  rw [WellFounded.fix_eq, aux_pbind_eq]

private theorem aux_sol_agree {X : Type u} {Y : Type v} (next : X → Option X)
    (hT : ∀ x, Terminates next x) (h : X → Option Y → Option Y) (f g : X → Option Y)
    (hf : Sol next h f) (hg : Sol next h g) : f = g := by
  have hwf := aux_wf_of_term next hT
  funext x
  refine hwf.induction (C := fun x => f x = g x) x (fun x ih => ?_)
  rw [hf x, hg x]
  cases hn : next x with
  | none => rfl
  | some y => exact congrArg (h x) (ih y hn)

/-- 定理 I.12(a)：どの軌道も `!_` に着けば、解はちょうど1つ。 -/
theorem sol_exists_unique {X : Type u} {Y : Type v} (next : X → Option X)
    (hT : ∀ x, Terminates next x) (h : X → Option Y → Option Y) :
    ∃ f, Sol next h f ∧ ∀ g, Sol next h g → g = f := by
  have hwf := aux_wf_of_term next hT
  exact ⟨_, aux_fix_sol next hwf h,
    fun g hg => aux_sol_agree next hT h g _ hg (aux_fix_sol next hwf h)⟩

/-- 逆向きを見るための本体：受けた命題をそのまま返し、`!_` なら偽。 -/
def guardH {X : Type u} (_x : X) (o : Option Prop) : Option Prop :=
  some (match o with
    | some p => p
    | none => False)

/-- 定理 I.12(b)：解が高々1つなら、どの軌道も `!_` に着くことの否定の否定。 -/
theorem notnot_terminates_of_unique {X : Type u} (next : X → Option X)
    (huniq : ∀ f g : X → Option Prop, Sol next guardH f → Sol next guardH g → f = g) :
    ∀ x, ¬¬ Terminates next x := by
  intro x hnt
  have hs1 : Sol next guardH (fun _ => some False) := by
    intro y
    cases next y <;> rfl
  have hs2 : Sol next guardH (fun y => some (¬ Terminates next y)) := by
    intro y
    cases hn : next y with
    | none =>
      show some (¬ Terminates next y) = some False
      have hTy : Terminates next y := ⟨1, hn⟩
      exact congrArg some (propext ⟨fun hc => hc hTy, False.elim⟩)
    | some z =>
      show some (¬ Terminates next y) = some (¬ Terminates next z)
      have fwd : Terminates next y → Terminates next z := by
        rintro ⟨k, hk⟩
        cases k with
        | zero => cases hk
        | succ k =>
          have hk' : iterN next k (next y) = none := hk
          rw [hn] at hk'
          exact ⟨k, hk'⟩
      have bwd : Terminates next z → Terminates next y := by
        rintro ⟨k, hk⟩
        refine ⟨k + 1, ?_⟩
        show iterN next k (next y) = none
        rw [hn]
        exact hk
      exact congrArg some (propext ⟨fun hc hz => hc (bwd hz), fun hc hy => hc (fwd hy)⟩)
  have heq := congrFun (huniq _ _ hs1 hs2) x
  have hP : False = ¬ Terminates next x := Option.some.inj heq
  exact hP.mpr hnt

/-- 定理 I.12(c)：解がいつも `!_` ⇔ 本体が再帰の口に来た `!_` でいつも `!_` を返す。 -/
theorem sol_void_iff {X : Type u} {Y : Type v} (next : X → Option X)
    (hT : ∀ x, Terminates next x) (h : X → Option Y → Option Y) (f : X → Option Y)
    (hf : Sol next h f) : (∀ x, f x = none) ↔ ∀ x, h x none = none := by
  constructor
  · intro hall x
    have hb : (next x).bind f = none := by
      cases next x with
      | none => rfl
      | some y => exact hall y
    calc h x none = h x ((next x).bind f) := by rw [hb]
      _ = f x := (hf x).symm
      _ = none := hall x
  · intro hnone
    have hwf := aux_wf_of_term next hT
    intro x
    refine hwf.induction (C := fun x => f x = none) x (fun x ih => ?_)
    rw [hf x]
    cases hn : next x with
    | none => exact hnone x
    | some y =>
      show h x (f y) = none
      rw [ih y hn]
      exact hnone x

/-! ## I.13 返らない計算も「しきれなかった」に数える振り分け -/

def Delay.Returns {α : Type} (d : Delay α) (x : α) : Prop := ∃ n, d.run n = some x

def Delay.Diverges {α : Type} (d : Delay α) : Prop := ∀ n, d.run n = none

private theorem aux_s_run_le {α : Type} (d : Delay α) {n m : Nat} {a : α} (h : d.run n = some a)
    (hnm : n ≤ m) : d.run m = some a := by
  induction hnm with
  | refl => exact h
  | step _ ih => exact d.mono _ _ ih

private theorem aux_s_run_unique {α : Type} (d : Delay α) {n m : Nat} {a b : α}
    (ha : d.run n = some a) (hb : d.run m = some b) : a = b := by
  have h1 := aux_s_run_le d ha (Nat.le_add_right n m)
  have h2 := aux_s_run_le d hb (Nat.le_add_left m n)
  rw [h1] at h2
  cases h2
  rfl

/-- S1：返れば値を言う。 -/
def SortS1 {α : Type} (J : Delay α → Option α) : Prop := ∀ d x, d.Returns x → J d = some x

/-- S2：返らなければ `!_`。 -/
def SortS2 {α : Type} (J : Delay α → Option α) : Prop := ∀ d, d.Diverges → J d = none

/-- S3：値を言えば本当に返る（作り話をしない）。 -/
def SortS3 {α : Type} (J : Delay α → Option α) : Prop := ∀ d x, J d = some x → d.Returns x

def WLPO : Prop := ∀ s : Nat → Bool, (∀ n, s n = false) ∨ ¬(∀ n, s n = false)

def MP : Prop := ∀ s : Nat → Bool, ¬(∀ n, s n = false) → ∃ n, s n = true

/-- LPO のデータの形：各列で選言を決める関数。 -/
def LPOd : Type := ∀ s : Nat → Bool, PSum (∃ n, s n = true) (∀ n, s n = false)

/-- WLPO のデータの形。 -/
def WLPOd : Type := ∀ s : Nat → Bool, PSum (∀ n, s n = false) (¬∀ n, s n = false)

/-- 段 n までに列が `true` になったか。 -/
private def aux_anyB (s : Nat → Bool) : Nat → Bool
  | 0 => s 0
  | n + 1 => aux_anyB s n || s (n + 1)

private theorem aux_anyB_of {s : Nat → Bool} {n : Nat} (h : s n = true) : aux_anyB s n = true := by
  cases n with
  | zero => exact h
  | succ n => simp [aux_anyB, h]

private theorem aux_exists_of_anyB {s : Nat → Bool} {n : Nat} (h : aux_anyB s n = true) :
    ∃ k, s k = true := by
  induction n with
  | zero => exact ⟨0, h⟩
  | succ n ih =>
    cases hs : s (n + 1) with
    | true => exact ⟨n + 1, hs⟩
    | false =>
      apply ih
      simpa [aux_anyB, hs] using h

private theorem aux_anyB_false {s : Nat → Bool} (hall : ∀ n, s n = false) :
    ∀ n, aux_anyB s n = false := by
  intro n
  induction n with
  | zero => exact hall 0
  | succ n ih => simp [aux_anyB, ih, hall]

/-- 列が初めて `true` になった段から a を返す遅延。 -/
private def aux_seqD {α : Type} (s : Nat → Bool) (a : α) : Delay α :=
  ⟨fun n => if aux_anyB s n then some a else none, by
    intro n b h
    have h' : (if aux_anyB s n = true then some a else none) = some b := h
    cases hc : aux_anyB s n with
    | false =>
      rw [ite_eq_right (by rw [hc]; decide)] at h'
      cases h'
    | true =>
      have hc' : aux_anyB s (n + 1) = true := by simp [aux_anyB, hc]
      show (if aux_anyB s (n + 1) = true then some a else none) = some b
      rw [ite_eq_left hc']
      rw [ite_eq_left hc] at h'
      exact h'⟩

private theorem aux_seqD_run_of {α : Type} {s : Nat → Bool} {a : α} {n : Nat}
    (h : aux_anyB s n = true) : (aux_seqD s a).run n = some a := by
  show (if aux_anyB s n = true then some a else none) = some a
  rw [ite_eq_left h]

private theorem aux_seqD_run_none {α : Type} {s : Nat → Bool} {a : α} {n : Nat}
    (h : aux_anyB s n = false) : (aux_seqD s a).run n = none := by
  show (if aux_anyB s n = true then some a else none) = none
  rw [ite_eq_right (by rw [h]; decide)]

private theorem aux_seqD_some {α : Type} {s : Nat → Bool} {a b : α} {n : Nat}
    (h : (aux_seqD s a).run n = some b) : aux_anyB s n = true := by
  cases hc : aux_anyB s n with
  | false =>
    rw [aux_seqD_run_none hc] at h
    cases h
  | true => rfl

/-- 「次の段」の関係：`true` の見つかっていない段から1つ上へ。 -/
private def aux_upR (p : Nat → Bool) (m n : Nat) : Prop := m = n + 1 ∧ ∀ k, k ≤ n → p k = false

private theorem aux_upR_acc (p : Nat → Bool) (m : Nat) (hm : p m = true) :
    ∀ j n, n + j = m → Acc (aux_upR p) n := by
  intro j
  induction j with
  | zero =>
    intro n hn
    have e : n = m := by omega
    subst e
    exact ⟨_, fun y ⟨_, hy⟩ => Bool.noConfusion (hm.symm.trans (hy n (Nat.le_refl n)))⟩
  | succ j ih =>
    intro n hn
    have hacc := ih (n + 1) (by omega)
    exact ⟨_, fun y ⟨hy, _⟩ => hy ▸ hacc⟩

private theorem aux_upR_wf (p : Nat → Bool) (h : ∃ m, p m = true) : WellFounded (aux_upR p) := by
  obtain ⟨m, hm⟩ := h
  refine ⟨fun n => ?_⟩
  rcases Nat.lt_or_ge m n with hmn | hmn
  · exact ⟨_, fun y ⟨_, hy⟩ => Bool.noConfusion (hm.symm.trans (hy m (Nat.le_of_lt hmn)))⟩
  · exact aux_upR_acc p m hm (m - n) n (by omega)

private structure aux_Up (p : Nat → Bool) (_h : ∃ m, p m = true) where
  pos : Nat

private instance aux_Up.wfRel (p : Nat → Bool) (h : ∃ m, p m = true) :
    WellFoundedRelation (aux_Up p h) :=
  ⟨fun a b => aux_upR p a.pos b.pos, InvImage.wf (fun a : aux_Up p h => a.pos) (aux_upR_wf p h)⟩

private theorem aux_step_inv (p : Nat → Bool) (n : Nat) (inv : ∀ k, k < n → p k = false)
    (hp : ¬p n = true) : ∀ k, k ≤ n → p k = false := by
  intro k hk
  rcases Nat.lt_or_ge k n with hkn | hkn
  · exact inv k hkn
  · have e : k = n := by omega
    subst e
    cases hpk : p k
    · rfl
    · exact absurd hpk hp

/-- 段 n から上へ、最初に `true` になる段を探す（在ることは命題で受ける）。 -/
private def aux_findFrom (p : Nat → Bool) (h : ∃ m, p m = true) (n : Nat)
    (inv : ∀ k, k < n → p k = false) : {m // p m = true} :=
  if hp : p n = true then ⟨n, hp⟩ else
    aux_findFrom p h (n + 1) (fun k hk => aux_step_inv p n inv hp k (Nat.le_of_lt_succ hk))
termination_by (aux_Up.mk n : aux_Up p h)
decreasing_by exact ⟨rfl, aux_step_inv p n inv hp⟩

private def aux_find (p : Nat → Bool) (h : ∃ m, p m = true) : {m // p m = true} :=
  aux_findFrom p h 0 (fun _ hk => absurd hk (Nat.not_lt_zero _))

/-- LPO の答えで返るかを決め、返れば値を取る。 -/
private def aux_pick {α : Type} (d : Delay α) :
    PSum (∃ n, (d.run n).isSome = true) (∀ n, (d.run n).isSome = false) → Option α
  | .inl h => d.run (aux_find (fun n => (d.run n).isSome) h).val
  | .inr _ => none

private theorem aux_pick_S1 {α : Type} (d : Delay α) (x : α) (hx : d.Returns x)
    (v : PSum (∃ n, (d.run n).isSome = true) (∀ n, (d.run n).isSome = false)) :
    aux_pick d v = some x := by
  obtain ⟨k, hk⟩ := hx
  cases v with
  | inl h =>
    show d.run (aux_find (fun n => (d.run n).isSome) h).val = some x
    have hp : (d.run (aux_find (fun n => (d.run n).isSome) h).val).isSome = true :=
      (aux_find (fun n => (d.run n).isSome) h).property
    cases hm : d.run (aux_find (fun n => (d.run n).isSome) h).val with
    | none =>
      rw [hm] at hp
      cases hp
    | some y => rw [aux_s_run_unique d hm hk]
  | inr h =>
    have hk' : (d.run k).isSome = false := h k
    rw [hk] at hk'
    cases hk'

private theorem aux_pick_S3 {α : Type} (d : Delay α) (x : α)
    (v : PSum (∃ n, (d.run n).isSome = true) (∀ n, (d.run n).isSome = false))
    (hJ : aux_pick d v = some x) : d.Returns x := by
  cases v with
  | inl h => exact ⟨(aux_find (fun n => (d.run n).isSome) h).val, hJ⟩
  | inr h => cases hJ

/-- WLPO の答えを1歩ずつ読む。 -/
private def aux_scanStep {α : Type} {P Q : Prop} (a : α) (rest : Option α) : PSum P Q → Option α
  | .inl _ => rest
  | .inr _ => some a

/-- 並び l の値ごとに、その値に返らないかを WLPO で訊く。 -/
private def aux_scan {α : Type} [DecidableEq α] (W : WLPOd) (d : Delay α) : List α → Option α
  | [] => none
  | a :: l => aux_scanStep a (aux_scan W d l) (W (fun n => decide (d.run n = some a)))

private theorem aux_scan_ret {α : Type} [DecidableEq α] (W : WLPOd) (d : Delay α) (x : α)
    (hx : d.Returns x) : ∀ l : List α, x ∈ l → aux_scan W d l = some x := by
  obtain ⟨m, hm⟩ := hx
  intro l
  induction l with
  | nil => intro h; cases h
  | cons a l ih =>
    intro hmem
    show aux_scanStep a (aux_scan W d l) (W (fun n => decide (d.run n = some a))) = some x
    cases W (fun n => decide (d.run n = some a)) with
    | inl hall =>
      have hax : a ≠ x := by
        intro e
        subst e
        have hc := hall m
        rw [hm] at hc
        simp at hc
      cases hmem with
      | head => exact absurd rfl hax
      | tail _ h => exact ih h
    | inr hnot =>
      cases decEq a x with
      | isTrue e => subst e; rfl
      | isFalse ne =>
        exfalso
        apply hnot
        intro n
        cases hd : d.run n with
        | none => simp
        | some b =>
          have hbx : b = x := aux_s_run_unique d hd hm
          subst hbx
          simp
          exact fun e => ne e.symm

private theorem aux_scan_div {α : Type} [DecidableEq α] (W : WLPOd) (d : Delay α)
    (hd : d.Diverges) : ∀ l : List α, aux_scan W d l = none := by
  intro l
  induction l with
  | nil => rfl
  | cons a l ih =>
    show aux_scanStep a (aux_scan W d l) (W (fun n => decide (d.run n = some a))) = none
    cases W (fun n => decide (d.run n = some a)) with
    | inl _ => exact ih
    | inr hnot =>
      exfalso
      apply hnot
      intro n
      rw [hd n]
      simp

/-- 列が初めて `true` になった段の番号を、その段から返す。 -/
private def aux_first (s : Nat → Bool) : Nat → Option Nat
  | 0 => if s 0 then some 0 else none
  | n + 1 => match aux_first s n with
    | some k => some k
    | none => if s (n + 1) then some (n + 1) else none

private theorem aux_first_mono {s : Nat → Bool} {n a : Nat} (h : aux_first s n = some a) :
    aux_first s (n + 1) = some a := by
  show (match aux_first s n with
    | some k => some k
    | none => if s (n + 1) then some (n + 1) else none) = some a
  rw [h]

private theorem aux_first_true {s : Nat → Bool} {n k : Nat} (h : aux_first s n = some k) :
    s k = true := by
  induction n with
  | zero =>
    have h' : (if s 0 = true then some 0 else none) = some k := h
    cases hs : s 0 with
    | false =>
      rw [ite_eq_right (by rw [hs]; decide)] at h'
      cases h'
    | true =>
      rw [ite_eq_left hs] at h'
      cases h'
      exact hs
  | succ n ih =>
    have h' : (match aux_first s n with
      | some k => some k
      | none => if s (n + 1) then some (n + 1) else none) = some k := h
    cases hc : aux_first s n with
    | some j =>
      rw [hc] at h'
      cases h'
      exact ih hc
    | none =>
      rw [hc] at h'
      have h'' : (if s (n + 1) = true then some (n + 1) else none) = some k := h'
      cases hs : s (n + 1) with
      | false =>
        rw [ite_eq_right (by rw [hs]; decide)] at h''
        cases h''
      | true =>
        rw [ite_eq_left hs] at h''
        cases h''
        exact hs

private theorem aux_first_of {s : Nat → Bool} {n : Nat} (h : s n = true) :
    ∃ k, aux_first s n = some k := by
  cases n with
  | zero => exact ⟨0, by simp [aux_first, h]⟩
  | succ n =>
    cases hc : aux_first s n with
    | some k => exact ⟨k, by simp [aux_first, hc]⟩
    | none => exact ⟨n + 1, by simp [aux_first, hc, h]⟩

private theorem aux_first_fix {s : Nat → Bool} {n k : Nat} (h : aux_first s n = some k) :
    aux_first s k = some k := by
  induction n with
  | zero =>
    have h' : (if s 0 = true then some 0 else none) = some k := h
    cases hs : s 0 with
    | false =>
      rw [ite_eq_right (by rw [hs]; decide)] at h'
      cases h'
    | true =>
      rw [ite_eq_left hs] at h'
      cases h'
      exact h
  | succ n ih =>
    have h' : (match aux_first s n with
      | some k => some k
      | none => if s (n + 1) then some (n + 1) else none) = some k := h
    cases hc : aux_first s n with
    | some j =>
      rw [hc] at h'
      cases h'
      exact ih hc
    | none =>
      rw [hc] at h'
      have h'' : (if s (n + 1) = true then some (n + 1) else none) = some k := h'
      cases hs : s (n + 1) with
      | false =>
        rw [ite_eq_right (by rw [hs]; decide)] at h''
        cases h''
      | true =>
        rw [ite_eq_left hs] at h''
        cases h''
        exact h

private def aux_firstD (s : Nat → Bool) : Delay Nat := ⟨aux_first s, fun _ _ h => aux_first_mono h⟩

/-- 定理 I.13(a)：α = 1 の S1∧S3 の振り分けから LPO が作れる。 -/
def lpoD_of_sorter13 (J : Delay Unit → Option Unit) (h1 : SortS1 J) (h3 : SortS3 J) : LPOd := by
  intro s
  cases hJ : J (aux_seqD s ()) with
  | some u =>
    exact PSum.inl (by
      obtain ⟨n, hn⟩ := h3 _ _ hJ
      exact aux_exists_of_anyB (aux_seqD_some hn))
  | none =>
    exact PSum.inr (fun n => by
      cases hsn : s n with
      | false => rfl
      | true =>
        have hc := h1 _ () ⟨n, aux_seqD_run_of (aux_anyB_of hsn)⟩
        rw [hJ] at hc
        cases hc)

/-- 定理 I.13(a)：LPO からはどの α の S1∧S3 の振り分けも作れる。 -/
def sorter13_of_lpoD (L : LPOd) (α : Type) : {J : Delay α → Option α // SortS1 J ∧ SortS3 J} := by
  exact ⟨fun d => aux_pick d (L (fun n => (d.run n).isSome)),
    fun d x hx => aux_pick_S1 d x hx _, fun d x hJ => aux_pick_S3 d x _ hJ⟩

/-- 定理 I.13(b)：空でない α の S1∧S2 の振り分けから WLPO が作れる。 -/
def wlpoD_of_sorter12 {α : Type} (a₀ : α) (J : Delay α → Option α) (h1 : SortS1 J)
    (h2 : SortS2 J) : WLPOd := by
  intro s
  cases hJ : J (aux_seqD s a₀) with
  | none =>
    exact PSum.inl (fun n => by
      cases hsn : s n with
      | false => rfl
      | true =>
        have hc := h1 _ a₀ ⟨n, aux_seqD_run_of (aux_anyB_of hsn)⟩
        rw [hJ] at hc
        cases hc)
  | some x =>
    exact PSum.inr (fun hall => by
      have hdiv : (aux_seqD s a₀).Diverges := fun n => aux_seqD_run_none (aux_anyB_false hall n)
      have hc := h2 _ hdiv
      rw [hJ] at hc
      cases hc)

/-- 定理 I.13(b)：等しさが決まる有限の α なら、WLPO から S1∧S2 の振り分けが作れる。 -/
def sorter12_of_wlpoD {α : Type} [DecidableEq α] (l : List α) (hl : ∀ a, a ∈ l) (W : WLPOd) :
    {J : Delay α → Option α // SortS1 J ∧ SortS2 J} := by
  exact ⟨fun d => aux_scan W d l, fun d x hx => aux_scan_ret W d x hx l (hl x),
    fun d hd => aux_scan_div W d hd l⟩

/-- 定理 I.13(c)：α = ℕ では S1 だけの振り分けから LPO が作れる。 -/
def lpoD_of_sorter1_nat (J : Delay Nat → Option Nat) (h1 : SortS1 J) : LPOd := by
  intro s
  cases hJ : J (aux_firstD s) with
  | none =>
    exact PSum.inr (fun n => by
      cases hsn : s n with
      | false => rfl
      | true =>
        obtain ⟨k, hk⟩ := aux_first_of hsn
        have hc := h1 (aux_firstD s) k ⟨n, hk⟩
        rw [hJ] at hc
        cases hc)
  | some m =>
    cases hf : aux_first s m with
    | some k => exact PSum.inl ⟨k, aux_first_true hf⟩
    | none =>
      exact PSum.inr (fun n => by
        cases hsn : s n with
        | false => rfl
        | true =>
          obtain ⟨k, hk⟩ := aux_first_of hsn
          have hc := h1 (aux_firstD s) k ⟨n, hk⟩
          rw [hJ] at hc
          have hmk : m = k := Option.some.inj hc
          subst hmk
          rw [aux_first_fix hk] at hf
          cases hf)

/-- 定理 I.13(d)：S3 ⇒ S2。 -/
theorem sortS2_of_sortS3 {α : Type} (J : Delay α → Option α) (h3 : SortS3 J) : SortS2 J := by
  intro d hd
  cases hJ : J d with
  | none => rfl
  | some x =>
    obtain ⟨n, hn⟩ := h3 d x hJ
    rw [hd n] at hn
    cases hn

/-- 定理 I.13(d)：S1∧S2∧MP ⇒ S3。 -/
theorem sortS3_of_mp {α : Type} (hmp : MP) (J : Delay α → Option α) (h1 : SortS1 J)
    (h2 : SortS2 J) : SortS3 J := by
  intro d x hJ
  have hnot : ¬ ∀ n, (fun n => (d.run n).isSome) n = false := by
    intro hall
    have hdiv : d.Diverges := by
      intro n
      have hn : (d.run n).isSome = false := hall n
      cases hd : d.run n with
      | none => rfl
      | some y =>
        rw [hd] at hn
        cases hn
    have hc := h2 d hdiv
    rw [hJ] at hc
    cases hc
  obtain ⟨n, hn⟩ := hmp _ hnot
  have hn' : (d.run n).isSome = true := hn
  cases hd : d.run n with
  | none =>
    rw [hd] at hn'
    cases hn'
  | some y =>
    have hc := h1 d y ⟨n, hd⟩
    rw [hJ] at hc
    cases hc
    exact ⟨n, hd⟩

/-- 定理 I.13(d)：LPO ⇔ WLPO ∧ MP。 -/
theorem lpo_iff_wlpo_mp : LPO ↔ WLPO ∧ MP := by
  constructor
  · intro hL
    constructor
    · intro s
      cases hL s with
      | inl h =>
        refine Or.inr (fun hall => ?_)
        obtain ⟨n, hn⟩ := h
        rw [hall n] at hn
        cases hn
      | inr h => exact Or.inl h
    · intro s hs
      cases hL s with
      | inl h => exact h
      | inr h => exact absurd h hs
  · rintro ⟨hW, hM⟩ s
    cases hW s with
    | inl h => exact Or.inr h
    | inr h => exact Or.inl (hM s h)

/-! ## I.14 打ち切り -/

/-- 打ち切り J_n：段 n までに返らなければ `!_`。 -/
def cut {α : Type} (n : Nat) (d : Delay α) : Option α := d.run n

/-- 段 k から x を返す遅延。 -/
def Delay.later {α : Type} (k : Nat) (x : α) : Delay α :=
  ⟨fun n => if k ≤ n then some x else none, by
    intro n a h
    have h' : (if k ≤ n then some x else none) = some a := h
    cases Nat.decLe k n with
    | isTrue hk =>
      show (if k ≤ n + 1 then some x else none) = some a
      rw [ite_eq_left (Nat.le_succ_of_le hk)]
      rw [ite_eq_left hk] at h'
      exact h'
    | isFalse hk =>
      rw [ite_eq_right hk] at h'
      cases h'⟩

/-- 定理 I.14(a)：打ち切りは S2 と S3 を満たす。 -/
theorem cut_S2_S3 {α : Type} (n : Nat) : SortS2 (cut (α := α) n) ∧ SortS3 (cut (α := α) n) := by
  constructor
  · intro d hd
    exact hd n
  · intro d x h
    exact ⟨n, h⟩

/-- 定理 I.14(b)：どの固定の n も、段 n+1 で返る物を `!_` と取り違える。 -/
theorem cut_misses {α : Type} (n : Nat) (x : α) :
    (Delay.later (n + 1) x).Returns x ∧ cut n (Delay.later (n + 1) x) = none := by
  constructor
  · refine ⟨n + 1, ?_⟩
    show (if n + 1 ≤ n + 1 then some x else none) = some x
    rw [ite_eq_left (Nat.le_refl _)]
  · show (if n + 1 ≤ n then some x else none) = none
    rw [ite_eq_right (Nat.not_succ_le_self n)]

/-- 定理 I.14(b)：打ち切りは ≈ で不変でない（now x ≈ later k x）。 -/
theorem now_equiv_later {α : Type} (k : Nat) (x : α) :
    Delay.Equiv (Delay.now x) (Delay.later k x) := by
  intro a
  constructor
  · rintro ⟨_, h⟩
    have h' : some x = some a := h
    refine ⟨k, ?_⟩
    show (if k ≤ k then some x else none) = some a
    rw [ite_eq_left (Nat.le_refl k)]
    exact h'
  · rintro ⟨m, h⟩
    have h' : (if k ≤ m then some x else none) = some a := h
    refine ⟨0, ?_⟩
    show some x = some a
    cases Nat.decLe k m with
    | isTrue hk =>
      rw [ite_eq_left hk] at h'
      exact h'
    | isFalse hk =>
      rw [ite_eq_right hk] at h'
      cases h'

/-- J が段 0..n の観測だけに依る。 -/
def DependsUpTo {α : Type} (J : Delay α → Option α) (n : Nat) : Prop :=
  ∀ d e : Delay α, (∀ k, k ≤ n → d.run k = e.run k) → J d = J e

/-- 段 n で止めた遅延：段 n より先は段 n の観測のまま。 -/
private def aux_trunc {α : Type} (d : Delay α) (n : Nat) : Delay α :=
  ⟨fun k => d.run (min k n), fun _ _ h => aux_s_run_le d h (by omega)⟩

/-- 定理 I.14(c)：段 0..n だけに依る S3 の振り分けの中で、J_n は最大。 -/
theorem cut_maximal {α : Type} (J : Delay α → Option α) (n : Nat) (hJ : DependsUpTo J n)
    (h3 : SortS3 J) : ∀ d x, J d = some x → cut n d = some x := by
  intro d x hJd
  have hagree : ∀ k, k ≤ n → (aux_trunc d n).run k = d.run k := by
    intro k hk
    show d.run (min k n) = d.run k
    rw [Nat.min_eq_left hk]
  have hJe : J (aux_trunc d n) = some x := (hJ _ _ hagree).trans hJd
  obtain ⟨m, hm⟩ := h3 _ _ hJe
  exact aux_s_run_le d hm (Nat.min_le_right m n)

/-- J が never で連続：ある m があって、段 0..m で返っていない物は never と同じ答え。 -/
def ContinuousAtNever {α : Type} (J : Delay α → Option α) : Prop :=
  ∃ m, ∀ d : Delay α, (∀ k, k ≤ m → d.run k = none) → J d = J Delay.never

/-- 定理 I.14(d)：never で連続で S2 か S3 を満たす振り分けは、返る物を `!_` と取り違える。 -/
theorem continuous_misses {α : Type} (J : Delay α → Option α) (hc : ContinuousAtNever J)
    (h : SortS2 J ∨ SortS3 J) (x : α) : ∃ d : Delay α, d.Returns x ∧ J d = none := by
  obtain ⟨m, hm⟩ := hc
  have hnever : J Delay.never = none := by
    cases h with
    | inl h2 => exact h2 _ (fun _ => rfl)
    | inr h3 => exact sortS2_of_sortS3 J h3 _ (fun _ => rfl)
  refine ⟨Delay.later (m + 1) x, (cut_misses m x).1, ?_⟩
  have hearly : ∀ k, k ≤ m → (Delay.later (m + 1) x).run k = none := by
    intro k hk
    show (if m + 1 ≤ k then some x else none) = none
    rw [ite_eq_right (by omega)]
  rw [hm _ hearly]
  exact hnever

/-- 定理 I.14(e)：各点では J_n は正しい答えに着く。 -/
theorem cut_converges {α : Type} (d : Delay α) (x : α) (h : d.Returns x) :
    ∃ N, ∀ n, N ≤ n → cut n d = some x := by
  obtain ⟨N, hN⟩ := h
  exact ⟨N, fun n hn => aux_s_run_le d hN hn⟩

end SignMath
