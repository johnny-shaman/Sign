/-!
# F. κ の側：返るかの観測と LPO

この節は Mathlib を使わず、`Classical.choice` を使わずに証明する（`#print axioms` で確かめる）。
-/

namespace SignMath

/-- LPO（限定された全知の原理）：0/1 の列は、どこかで `true` になるか、どこでも `false` か。 -/
def LPO : Prop := ∀ s : Nat → Bool, (∃ n, s n = true) ∨ (∀ n, s n = false)

/-- Rosolini の Σ（Σ⁰₁ の真理値）：「どこかで `true` になる」の形に書ける命題。
返る計算の「返った」は、有限の段で観測できる真理値になる。 -/
def Sigma01 : Type := {p : Prop // ∃ s : Nat → Bool, (p ↔ ∃ n, s n = true)}

/-- κ₁ : S⁰ = 2 → Σ。`true ↦ 真`、`false ↦ 偽`。 -/
def kappa1 (b : Bool) : Sigma01 := ⟨b = true, ⟨fun _ => b, by exact ⟨fun h => ⟨0, h⟩, fun ⟨_, h⟩ => h⟩⟩⟩

/-- 定理 F.1：κ₁ はいつも単射（選択も排中律も使わない）。 -/
theorem kappa1_injective : Function.Injective kappa1 := by
  intro a b h
  have h' : (a = true) = (b = true) := congrArg Subtype.val h
  cases a <;> cases b
  · rfl
  · exact absurd (h'.mpr rfl) (by decide)
  · exact absurd (h'.mp rfl) (by decide)
  · rfl

/-- 定理 F.2：κ₁ が全射 ⇔ LPO（選択も排中律も使わない）。 -/
theorem kappa1_surjective_iff_LPO : Function.Surjective kappa1 ↔ LPO := by
  constructor
  · intro hs s
    obtain ⟨b, hb⟩ := hs ⟨∃ n, s n = true, ⟨s, Iff.rfl⟩⟩
    have h' : (b = true) = ∃ n, s n = true := congrArg Subtype.val hb
    cases b
    · right
      intro n
      cases hsn : s n
      · rfl
      · exact absurd (h'.mpr ⟨n, hsn⟩) (by decide)
    · left
      exact h'.mp rfl
  · rintro hL ⟨p, s, hs⟩
    cases hL s with
    | inl h =>
      refine ⟨true, ?_⟩
      apply Subtype.ext
      exact propext ⟨fun _ => hs.mpr h, fun _ => rfl⟩
    | inr h =>
      refine ⟨false, ?_⟩
      apply Subtype.ext
      apply propext
      constructor
      · intro hf
        have hf' : false = true := hf
        cases hf'
      · intro hp
        obtain ⟨n, hn⟩ := hs.mp hp
        rw [h n] at hn
        exact absurd hn (by decide)

/-- 遅延（段ごとの観測）：`run n` は段 n までに返った値。一度返れば変わらない。 -/
structure Delay (α : Type) where
  run : Nat → Option α
  mono : ∀ n a, run n = some a → run (n + 1) = some a

/-- 弱双模倣：同じ値に（いつかの段で）返る。 -/
def Delay.Equiv {α : Type} (d e : Delay α) : Prop :=
  ∀ a, (∃ n, d.run n = some a) ↔ (∃ n, e.run n = some a)

/-- `now x` と、返らない計算 `never`。 -/
def Delay.now {α : Type} (x : α) : Delay α := ⟨fun _ => some x, fun _ _ h => h⟩
def Delay.never {α : Type} : Delay α := ⟨fun _ => none, fun _ _ h => nomatch h⟩

/-- κ_X : X₊ → D X（商を取る前）。 -/
def kappaD {α : Type} : Option α → Delay α
  | some x => Delay.now x
  | none => Delay.never

/-- 定理 F.3：κ は弱双模倣の上で単射（`now x ≈ now y → x = y`、`now x ≉ never`）。 -/
theorem kappaD_injective_upto {α : Type} (o o' : Option α)
    (h : Delay.Equiv (kappaD o) (kappaD o')) : o = o' := by
  cases o with
  | none =>
    cases o' with
    | none => rfl
    | some y =>
      obtain ⟨n, hn⟩ := (h y).mpr ⟨0, rfl⟩
      cases hn
  | some x =>
    cases o' with
    | none =>
      obtain ⟨n, hn⟩ := (h x).mp ⟨0, rfl⟩
      cases hn
    | some y =>
      obtain ⟨n, hn⟩ := (h x).mp ⟨0, rfl⟩
      have hyx : some y = some x := hn
      cases hyx
      rfl

/-- 段 n までに列が `true` になったか。 -/
private def aux_anyUpTo (s : Nat → Bool) : Nat → Bool
  | 0 => s 0
  | n + 1 => aux_anyUpTo s n || s (n + 1)

private theorem aux_anyUpTo_of {s : Nat → Bool} {n : Nat} (h : s n = true) :
    aux_anyUpTo s n = true := by
  cases n with
  | zero => exact h
  | succ n => simp [aux_anyUpTo, h]

private theorem aux_exists_of_anyUpTo {s : Nat → Bool} {n : Nat} (h : aux_anyUpTo s n = true) :
    ∃ k, s k = true := by
  induction n with
  | zero => exact ⟨0, h⟩
  | succ n ih =>
    cases hs : s (n + 1) with
    | true => exact ⟨n + 1, hs⟩
    | false =>
      apply ih
      simpa [aux_anyUpTo, hs] using h

/-- 列が初めて `true` になった段から返る遅延。 -/
private def aux_seqDelay (s : Nat → Bool) : Delay Unit :=
  ⟨fun n => if aux_anyUpTo s n then some () else none, by
    intro n a h
    cases a
    cases hc : aux_anyUpTo s n with
    | false => simp [hc] at h
    | true => simp [aux_anyUpTo, hc]⟩

private theorem aux_seqDelay_isSome (s : Nat → Bool) (n : Nat) :
    ((aux_seqDelay s).run n).isSome = aux_anyUpTo s n := by
  cases hc : aux_anyUpTo s n <;> simp [aux_seqDelay, hc]

private theorem aux_isSome_iff (o : Option PUnit) : o.isSome = true ↔ o = some PUnit.unit := by
  cases o with
  | none => simp
  | some u => cases u; simp

private theorem aux_run_le {α : Type} (d : Delay α) {n m : Nat} {a : α} (h : d.run n = some a)
    (hnm : n ≤ m) : d.run m = some a := by
  induction hnm with
  | refl => exact h
  | step _ ih => exact d.mono _ _ ih

private theorem aux_run_unique {α : Type} (d : Delay α) {n m : Nat} {a b : α}
    (ha : d.run n = some a) (hb : d.run m = some b) : a = b := by
  have h1 := aux_run_le d ha (Nat.le_add_right n m)
  have h2 := aux_run_le d hb (Nat.le_add_left m n)
  rw [h1] at h2
  cases h2
  rfl

/-- 定理 F.4：どの D X の元も、ある X₊ の元と弱双模倣 ⇔ LPO。 -/
theorem kappaD_surjective_upto_iff_LPO :
    (∀ (α : Type) (d : Delay α), ∃ o, Delay.Equiv d (kappaD o)) ↔ LPO := by
  constructor
  · intro hA s
    obtain ⟨o, ho⟩ := hA Unit (aux_seqDelay s)
    cases o with
    | some u =>
      left
      obtain ⟨n, hn⟩ := (ho u).mpr ⟨0, rfl⟩
      have hs : ((aux_seqDelay s).run n).isSome = true := by rw [hn]; rfl
      rw [aux_seqDelay_isSome] at hs
      exact aux_exists_of_anyUpTo hs
    | none =>
      right
      intro n
      cases hsn : s n with
      | false => rfl
      | true =>
        have hs : ((aux_seqDelay s).run n).isSome = true := by
          rw [aux_seqDelay_isSome]; exact aux_anyUpTo_of hsn
        cases hr : (aux_seqDelay s).run n with
        | none => rw [hr] at hs; exact absurd hs (by decide)
        | some u =>
          obtain ⟨m, hm⟩ := (ho u).mp ⟨n, hr⟩
          cases hm
  · intro hL α d
    cases hL (fun n => (d.run n).isSome) with
    | inl h =>
      obtain ⟨n, hn⟩ := h
      have hn' : (d.run n).isSome = true := hn
      cases hd : d.run n with
      | none => rw [hd] at hn'; simp at hn'
      | some a =>
        refine ⟨some a, fun b => ⟨?_, ?_⟩⟩
        · rintro ⟨m, hm⟩
          refine ⟨0, ?_⟩
          show some a = some b
          rw [aux_run_unique d hd hm]
        · rintro ⟨m, hm⟩
          have hab : some a = some b := hm
          exact ⟨n, hd.trans hab⟩
    | inr h =>
      refine ⟨none, fun b => ⟨?_, ?_⟩⟩
      · rintro ⟨m, hm⟩
        have h2 : (d.run m).isSome = false := h m
        rw [hm] at h2
        simp at h2
      · rintro ⟨m, hm⟩
        cases hm


/-- 弱双模倣は同値関係。 -/
def Delay.setoid (α : Type) : Setoid (Delay α) where
  r := Delay.Equiv
  iseqv := by
    exact ⟨fun _ _ => Iff.rfl, fun h a => (h a).symm, fun h1 h2 a => (h1 a).trans (h2 a)⟩

/-- L1 = D1/≈ から Σ へ：「いつかの段で返る」。 -/
def toSigma : Quotient (Delay.setoid PUnit) → Sigma01 :=
  Quotient.lift (fun d => (⟨∃ n, (d.run n).isSome = true, ⟨fun n => (d.run n).isSome, Iff.rfl⟩⟩ : Sigma01))
    (by
      intro a b h
      have h' : Delay.Equiv a b := h
      apply Subtype.ext
      apply propext
      constructor
      · rintro ⟨n, hn⟩
        obtain ⟨m, hm⟩ := (h' PUnit.unit).mp ⟨n, (aux_isSome_iff _).mp hn⟩
        exact ⟨m, (aux_isSome_iff _).mpr hm⟩
      · rintro ⟨n, hn⟩
        obtain ⟨m, hm⟩ := (h' PUnit.unit).mpr ⟨n, (aux_isSome_iff _).mp hn⟩
        exact ⟨m, (aux_isSome_iff _).mpr hm⟩)

/-- 定理 F.5：L1 ≅ Σ（全単射。選択も排中律も使わない）。 -/
theorem toSigma_bijective : Function.Injective toSigma ∧ Function.Surjective toSigma := by
  constructor
  · intro q1 q2
    induction q1 using Quotient.ind
    induction q2 using Quotient.ind
    rename_i a b
    intro h
    have h' : (∃ n, (a.run n).isSome = true) = (∃ n, (b.run n).isSome = true) :=
      congrArg Subtype.val h
    apply Quotient.sound
    show Delay.Equiv a b
    intro u
    cases u
    constructor
    · rintro ⟨n, hn⟩
      obtain ⟨m, hm⟩ := h'.mp ⟨n, (aux_isSome_iff _).mpr hn⟩
      exact ⟨m, (aux_isSome_iff _).mp hm⟩
    · rintro ⟨n, hn⟩
      obtain ⟨m, hm⟩ := h'.mpr ⟨n, (aux_isSome_iff _).mpr hn⟩
      exact ⟨m, (aux_isSome_iff _).mp hm⟩
  · rintro ⟨p, s, hs⟩
    refine ⟨Quotient.mk _ (aux_seqDelay s), ?_⟩
    apply Subtype.ext
    show (∃ n, ((aux_seqDelay s).run n).isSome = true) = p
    apply propext
    constructor
    · rintro ⟨n, hn⟩
      rw [aux_seqDelay_isSome] at hn
      exact hs.mpr (aux_exists_of_anyUpTo hn)
    · intro hp
      obtain ⟨n, hn⟩ := hs.mp hp
      exact ⟨n, by rw [aux_seqDelay_isSome]; exact aux_anyUpTo_of hn⟩

end SignMath
