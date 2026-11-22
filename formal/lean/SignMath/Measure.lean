import Mathlib.Order.Filter.Ultrafilter.Basic
import Mathlib.Data.Finsupp.Basic

/-!
# H. 外延量：有限加法的な ℕ 値の測度は、超フィルターの上の有限の台の関数

`M X` は X の全部の部分集合の上の、ℕ 値の有限加法的な測度。主定理は `M X ≃ (βX →₀ ℕ)`
（係数は `c_μ(U) = min {μ A | A ∈ U}`）で、X について自然。
-/

namespace SignMath

open Filter

universe u

/-- ℕ 値の有限加法的な測度（全部の部分集合の上）。 -/
structure FAMeasure (X : Type u) where
  toFun : Set X → ℕ
  map_empty : toFun ∅ = 0
  map_union : ∀ A B : Set X, Disjoint A B → toFun (A ∪ B) = toFun A + toFun B

namespace FAMeasure

variable {X Y : Type u}

private theorem aux_ext {μ ν : FAMeasure X} (h : ∀ A, μ.toFun A = ν.toFun A) : μ = ν := by
  cases μ
  cases ν
  congr
  funext A
  exact h A

private theorem aux_inter_add_compl (μ : FAMeasure X) (A B : Set X) :
    μ.toFun (A ∩ B) + μ.toFun (A ∩ Bᶜ) = μ.toFun A := by
  rw [← μ.map_union _ _
    ((disjoint_compl_right (a := B)).mono Set.inter_subset_right Set.inter_subset_right),
    Set.inter_union_compl]

private theorem aux_mono (μ : FAMeasure X) {A B : Set X} (h : A ⊆ B) : μ.toFun A ≤ μ.toFun B := by
  rw [← aux_inter_add_compl μ B A, Set.inter_eq_right.mpr h]
  exact Nat.le_add_right _ _

/-- 押し出し `f_* μ`。 -/
def map (f : X → Y) (μ : FAMeasure X) : FAMeasure Y := by
  exact
    { toFun := fun A => μ.toFun (f ⁻¹' A)
      map_empty := by rw [Set.preimage_empty]; exact μ.map_empty
      map_union := fun A B h => by
        rw [Set.preimage_union]
        exact μ.map_union _ _ (h.preimage f) }

private theorem aux_not_both {A B : Set X} {U : Ultrafilter X} (h : Disjoint A B)
    (hA : A ∈ U) (hB : B ∈ U) : False := by
  have := Filter.inter_mem (f := (U : Filter X)) hA hB
  rw [Set.disjoint_iff_inter_eq_empty.mp h] at this
  exact Ultrafilter.empty_notMem this

/-- 有限の台の重み `c : βX →₀ ℕ` が決める測度 `A ↦ Σ_{U ∋ A} c U`。 -/
noncomputable def ofFinsupp (c : Ultrafilter X →₀ ℕ) : FAMeasure X := by
  classical
  exact
    { toFun := fun A => c.sum (fun U n => if A ∈ U then n else 0)
      map_empty := by simp [Ultrafilter.empty_notMem]
      map_union := fun A B h => by
        rw [← Finsupp.sum_add]
        apply Finsupp.sum_congr
        intro U _
        by_cases hA : A ∈ U
        · have hB : B ∉ U := fun hB => aux_not_both h hA hB
          rw [ite_eq_left (Ultrafilter.union_mem_iff.mpr (Or.inl hA)), ite_eq_left hA,
            ite_eq_right hB, add_zero]
        · by_cases hB : B ∈ U
          · rw [ite_eq_left (Ultrafilter.union_mem_iff.mpr (Or.inr hB)), ite_eq_right hA,
              ite_eq_left hB, zero_add]
          · rw [ite_eq_right (fun h' => (Ultrafilter.union_mem_iff.mp h').elim hA hB),
              ite_eq_right hA, ite_eq_right hB] }

/-- 係数 `c_μ(U) = min {μ A | A ∈ U}`。 -/
noncomputable def coeff (μ : FAMeasure X) (U : Ultrafilter X) : ℕ := by
  classical
  exact Nat.find (⟨μ.toFun Set.univ, Set.univ, Filter.univ_mem, rfl⟩ :
    ∃ n, ∃ A ∈ U, μ.toFun A = n)

open Classical in
private theorem aux_ofFinsupp_apply (c : Ultrafilter X →₀ ℕ) (A : Set X) :
    (ofFinsupp c).toFun A = c.sum (fun U n => if A ∈ U then n else 0) := rfl

open Classical in
private theorem aux_coeff_eq (μ : FAMeasure X) (U : Ultrafilter X) :
    μ.coeff U = Nat.find (⟨μ.toFun Set.univ, Set.univ, Filter.univ_mem, rfl⟩ :
      ∃ n, ∃ A ∈ U, μ.toFun A = n) := rfl

private theorem aux_coeff_le (μ : FAMeasure X) {U : Ultrafilter X} {A : Set X} (hA : A ∈ U) :
    μ.coeff U ≤ μ.toFun A := by
  classical
  rw [aux_coeff_eq]
  exact Nat.find_min' _ ⟨A, hA, rfl⟩

private theorem aux_le_coeff (μ : FAMeasure X) {U : Ultrafilter X} {n : ℕ}
    (h : ∀ A ∈ U, n ≤ μ.toFun A) : n ≤ μ.coeff U := by
  classical
  rw [aux_coeff_eq]
  obtain ⟨A, hA, hAe⟩ := Nat.find_spec (⟨μ.toFun Set.univ, Set.univ, Filter.univ_mem, rfl⟩ :
    ∃ n, ∃ A ∈ U, μ.toFun A = n)
  rw [← hAe]
  exact h A hA

private theorem aux_separate {U V : Ultrafilter X} (h : V ≠ U) : ∃ A ∈ U, A ∉ V := by
  by_contra hc
  push Not at hc
  exact h (Ultrafilter.eq_of_le fun A hA => hc A hA)

private theorem aux_coeff_ofFinsupp (c : Ultrafilter X →₀ ℕ) (U : Ultrafilter X) :
    (ofFinsupp c).coeff U = c U := by
  classical
  apply le_antisymm
  · have hsep : ∀ V : Ultrafilter X, ∃ A ∈ U, V ≠ U → A ∉ V := by
      intro V
      by_cases hV : V = U
      · exact ⟨Set.univ, Filter.univ_mem, fun h => (h hV).elim⟩
      · obtain ⟨A, hA, hAV⟩ := aux_separate hV
        exact ⟨A, hA, fun _ => hAV⟩
    choose g hgU hgV using hsep
    let A : Set X := ⋂ V ∈ c.support, g V
    have hA : A ∈ U := (Filter.biInter_finset_mem c.support).mpr fun V _ => hgU V
    refine (aux_coeff_le _ hA).trans (le_of_eq ?_)
    rw [aux_ofFinsupp_apply, Finsupp.sum]
    rw [Finset.sum_eq_single U]
    · rw [ite_eq_left hA]
    · intro V hV hVU
      rw [ite_eq_right]
      intro hAV
      exact hgV V hVU (Filter.mem_of_superset hAV (Set.biInter_subset_of_mem hV))
    · intro hU
      rw [Finsupp.notMem_support_iff.mp hU, ite_self]
  · apply aux_le_coeff
    intro A hA
    rw [aux_ofFinsupp_apply, Finsupp.sum]
    by_cases hU : U ∈ c.support
    · rw [← Finset.add_sum_erase _ _ hU, ite_eq_left hA]
      exact Nat.le_add_right _ _
    · rw [Finsupp.notMem_support_iff.mp hU]
      exact Nat.zero_le _

open Classical in
private theorem aux_ofFinsupp_add (c d : Ultrafilter X →₀ ℕ) (A : Set X) :
    (ofFinsupp (c + d)).toFun A = (ofFinsupp c).toFun A + (ofFinsupp d).toFun A := by
  rw [aux_ofFinsupp_apply, aux_ofFinsupp_apply, aux_ofFinsupp_apply]
  apply Finsupp.sum_add_index'
  · intro U
    exact ite_self 0
  · intro U a b
    split_ifs <;> simp

open Classical in
private theorem aux_ofFinsupp_single (U : Ultrafilter X) (m : ℕ) (A : Set X) :
    (ofFinsupp (Finsupp.single U m)).toFun A = if A ∈ U then m else 0 := by
  rw [aux_ofFinsupp_apply, Finsupp.sum_single_index]
  exact ite_self 0

private theorem aux_exists (μ : FAMeasure X) : ∃ c, ofFinsupp c = μ := by
  classical
  suffices H : ∀ n, ∀ μ : FAMeasure X, μ.toFun Set.univ = n → ∃ c, ofFinsupp c = μ from
    H _ μ rfl
  intro n
  induction n using Nat.strong_induction_on with
  | _ n ih =>
  intro μ hn
  by_cases hpos : ∃ A, 0 < μ.toFun A
  · have hP : ∃ k, ∃ A, 0 < μ.toFun A ∧ μ.toFun A = k := by
      obtain ⟨A, hA⟩ := hpos
      exact ⟨_, A, hA, rfl⟩
    obtain ⟨A, hApos, hAeq⟩ := Nat.find_spec hP
    have hmin : ∀ B, 0 < μ.toFun B → μ.toFun A ≤ μ.toFun B := fun B hB =>
      hAeq ▸ Nat.find_min' hP ⟨B, hB, rfl⟩
    have hatom : ∀ B, μ.toFun (A ∩ B) = 0 ∨ μ.toFun (A ∩ B) = μ.toFun A := by
      intro B
      rcases Nat.eq_zero_or_pos (μ.toFun (A ∩ B)) with h0 | h0
      · exact Or.inl h0
      · exact Or.inr (le_antisymm (aux_mono μ Set.inter_subset_left) (hmin _ h0))
    let F : Filter X :=
      { sets := {B | μ.toFun (A ∩ B) = μ.toFun A}
        univ_sets := by
          change μ.toFun (A ∩ Set.univ) = μ.toFun A
          rw [Set.inter_univ]
        sets_of_superset := fun {B C} hB hBC =>
          le_antisymm (aux_mono μ Set.inter_subset_left)
            (le_of_eq_of_le (Eq.symm hB) (aux_mono μ (Set.inter_subset_inter_right A hBC)))
        inter_sets := fun {B C} hB hC => by
          change μ.toFun (A ∩ B) = μ.toFun A at hB
          change μ.toFun (A ∩ C) = μ.toFun A at hC
          change μ.toFun (A ∩ (B ∩ C)) = μ.toFun A
          have h1 : μ.toFun (A ∩ (B ∩ C)) + μ.toFun (A ∩ B ∩ Cᶜ) = μ.toFun (A ∩ B) := by
            rw [← Set.inter_assoc]
            exact aux_inter_add_compl μ (A ∩ B) C
          have h2 := aux_inter_add_compl μ A C
          have h3 : μ.toFun (A ∩ B ∩ Cᶜ) ≤ μ.toFun (A ∩ Cᶜ) :=
            aux_mono μ (Set.inter_subset_inter_left _ Set.inter_subset_left)
          rcases hatom (B ∩ C) with h | h
          · omega
          · exact h }
    have hF : ∀ s, sᶜ ∉ F ↔ s ∈ F := by
      intro s
      change ¬ μ.toFun (A ∩ sᶜ) = μ.toFun A ↔ μ.toFun (A ∩ s) = μ.toFun A
      have h1 := aux_inter_add_compl μ A s
      rcases hatom s with h | h <;> omega
    let U : Ultrafilter X := Ultrafilter.ofComplNotMemIff F hF
    have hmemU : ∀ B, B ∈ U ↔ μ.toFun (A ∩ B) = μ.toFun A := fun B => Iff.rfl
    have hle : ∀ B, B ∈ U → μ.toFun A ≤ μ.toFun B := fun B hB =>
      le_of_eq_of_le ((hmemU B).mp hB).symm (aux_mono μ Set.inter_subset_right)
    let ν : FAMeasure X :=
      { toFun := fun B => μ.toFun B - (if B ∈ U then μ.toFun A else 0)
        map_empty := by
          rw [μ.map_empty]
          exact Nat.zero_sub _
        map_union := fun B C hBC => by
          have hU := μ.map_union B C hBC
          change μ.toFun (B ∪ C) - (if B ∪ C ∈ U then μ.toFun A else 0) =
            (μ.toFun B - (if B ∈ U then μ.toFun A else 0)) +
            (μ.toFun C - (if C ∈ U then μ.toFun A else 0))
          by_cases hB : B ∈ U
          · have hC : C ∉ U := fun hC => aux_not_both hBC hB hC
            have := hle B hB
            rw [ite_eq_left (Ultrafilter.union_mem_iff.mpr (Or.inl hB)), ite_eq_left hB, ite_eq_right hC]
            omega
          · by_cases hC : C ∈ U
            · have := hle C hC
              rw [ite_eq_left (Ultrafilter.union_mem_iff.mpr (Or.inr hC)), ite_eq_right hB, ite_eq_left hC]
              omega
            · rw [ite_eq_right (fun h' => (Ultrafilter.union_mem_iff.mp h').elim hB hC), ite_eq_right hB,
                ite_eq_right hC]
              omega }
    have hlt : ν.toFun Set.univ < n := by
      have := hle Set.univ Filter.univ_mem
      change μ.toFun Set.univ - (if Set.univ ∈ U then μ.toFun A else 0) < n
      rw [ite_eq_left (show Set.univ ∈ U from Filter.univ_mem)]
      omega
    obtain ⟨c', hc'⟩ := ih _ hlt ν rfl
    refine ⟨c' + Finsupp.single U (μ.toFun A), aux_ext fun B => ?_⟩
    rw [aux_ofFinsupp_add, aux_ofFinsupp_single, hc']
    change μ.toFun B - (if B ∈ U then μ.toFun A else 0) + (if B ∈ U then μ.toFun A else 0) = _
    by_cases hB : B ∈ U
    · have := hle B hB
      rw [ite_eq_left hB]
      omega
    · rw [ite_eq_right hB]
      omega
  · refine ⟨0, aux_ext fun A => ?_⟩
    push Not at hpos
    rw [aux_ofFinsupp_apply, Finsupp.sum_zero_index]
    exact (Nat.le_zero.mp (hpos A)).symm

private theorem aux_coeff_finite (μ : FAMeasure X) : (Function.support μ.coeff).Finite := by
  obtain ⟨c, rfl⟩ := aux_exists μ
  have : (ofFinsupp c).coeff = ⇑c := funext (aux_coeff_ofFinsupp c)
  rw [this, Finsupp.fun_support_eq]
  exact c.support.finite_toSet

/-- 定理 H.1（主定理）：`M X ≃ (βX →₀ ℕ)`。 -/
noncomputable def equivFinsupp (X : Type u) : FAMeasure X ≃ (Ultrafilter X →₀ ℕ) := by
  exact
    { toFun := fun μ => Finsupp.ofSupportFinite μ.coeff (aux_coeff_finite μ)
      invFun := ofFinsupp
      left_inv := fun μ => by
        obtain ⟨c, rfl⟩ := aux_exists μ
        congr 1
        ext U
        exact aux_coeff_ofFinsupp c U
      right_inv := fun c => by
        ext U
        exact aux_coeff_ofFinsupp c U }

theorem equivFinsupp_apply (μ : FAMeasure X) (U : Ultrafilter X) :
    equivFinsupp X μ U = μ.coeff U := by
  rfl

theorem equivFinsupp_symm (c : Ultrafilter X →₀ ℕ) :
    (equivFinsupp X).symm c = ofFinsupp c := by
  rfl

open Classical in
private theorem aux_ofFinsupp_mapDomain (f : X → Y) (c : Ultrafilter X →₀ ℕ) (B : Set Y) :
    (ofFinsupp (Finsupp.mapDomain (Ultrafilter.map f) c)).toFun B =
      (ofFinsupp c).toFun (f ⁻¹' B) := by
  rw [aux_ofFinsupp_apply, aux_ofFinsupp_apply, Finsupp.sum_mapDomain_index]
  · simp only [Ultrafilter.mem_map]
  · intro U
    exact ite_self 0
  · intro U a b
    split_ifs <;> simp

/-- 定理 H.2：この同型は自然（押し出しと `β f` の押し出しが合う）。 -/
theorem equivFinsupp_natural (f : X → Y) (μ : FAMeasure X) :
    equivFinsupp Y (μ.map f) = Finsupp.mapDomain (Ultrafilter.map f) (equivFinsupp X μ) := by
  rw [← Equiv.eq_symm_apply, equivFinsupp_symm]
  apply aux_ext
  intro B
  rw [aux_ofFinsupp_mapDomain, ← equivFinsupp_symm, Equiv.symm_apply_apply]
  rfl

/-- 点の重み `c : X →₀ ℕ` の測度（S⁰ から伸ばした側、`ℕ^(X)`）。 -/
noncomputable def ofPoints (c : X →₀ ℕ) : FAMeasure X := by
  classical
  exact
    { toFun := fun A => c.sum (fun x n => if x ∈ A then n else 0)
      map_empty := by simp
      map_union := fun A B h => by
        rw [← Finsupp.sum_add]
        apply Finsupp.sum_congr
        intro x _
        by_cases hA : x ∈ A
        · have hB : x ∉ B := Set.disjoint_left.mp h hA
          rw [ite_eq_left (Set.mem_union_left B hA), ite_eq_left hA, ite_eq_right hB, add_zero]
        · by_cases hB : x ∈ B
          · rw [ite_eq_left (Set.mem_union_right A hB), ite_eq_right hA, ite_eq_left hB, zero_add]
          · rw [ite_eq_right (fun h' => h'.elim hA hB), ite_eq_right hA, ite_eq_right hB] }

open Classical in
private theorem aux_ofPoints_apply (c : X →₀ ℕ) (A : Set X) :
    (ofPoints c).toFun A = c.sum (fun x n => if x ∈ A then n else 0) := rfl

/-- 定理 H.3：比べの写像 `ℕ^(X) → M X` は `ℕ^(η)` と同じ。 -/
theorem ofPoints_eq (c : X →₀ ℕ) :
    ofPoints c = ofFinsupp (Finsupp.mapDomain (pure : X → Ultrafilter X) c) := by
  classical
  apply aux_ext
  intro A
  rw [aux_ofPoints_apply, aux_ofFinsupp_apply, Finsupp.sum_mapDomain_index]
  · simp only [Ultrafilter.mem_pure]
  · intro U
    exact ite_self 0
  · intro U a b
    split_ifs <;> simp

/-- 定理 H.4：比べの写像はいつも単射。 -/
theorem ofPoints_injective : Function.Injective (ofPoints : (X →₀ ℕ) → FAMeasure X) := by
  classical
  have key : ∀ (c : X →₀ ℕ) (x : X), (ofPoints c).toFun {x} = c x := by
    intro c x
    rw [aux_ofPoints_apply, Finsupp.sum, Finset.sum_eq_single x]
    · rw [ite_eq_left (Set.mem_singleton x)]
    · intro y _ hyx
      exact ite_eq_right hyx
    · intro hx
      rw [Finsupp.notMem_support_iff.mp hx, ite_self]
  intro c d h
  ext x
  rw [← key c x, ← key d x, h]

/-- 定理 H.5：比べの写像が全射 ⇔ X の上の超フィルターは全部単項。 -/
theorem ofPoints_surjective_iff :
    Function.Surjective (ofPoints : (X →₀ ℕ) → FAMeasure X) ↔ ∀ U : Ultrafilter X, ∃ x, U = pure x := by
  classical
  constructor
  · intro hs U
    obtain ⟨c, hc⟩ := hs (ofFinsupp (Finsupp.single U 1))
    rw [ofPoints_eq, ← equivFinsupp_symm, ← equivFinsupp_symm] at hc
    have hc' := (equivFinsupp X).symm.injective hc
    have hU : U ∈ (Finsupp.mapDomain (pure : X → Ultrafilter X) c).support := by
      rw [hc']
      simp
    obtain ⟨x, _, hx⟩ := Finset.mem_image.mp (Finsupp.mapDomain_support hU)
    exact ⟨x, hx.symm⟩
  · intro hU μ
    have hsurj : Function.Surjective (pure : X → Ultrafilter X) := fun U =>
      (hU U).imp fun _ h => h.symm
    let e : X ≃ Ultrafilter X := Equiv.ofBijective pure ⟨Ultrafilter.pure_injective, hsurj⟩
    refine ⟨Finsupp.mapDomain e.symm (equivFinsupp X μ), ?_⟩
    rw [ofPoints_eq, ← Finsupp.mapDomain_comp]
    have : ((pure : X → Ultrafilter X) ∘ e.symm) = id := by
      funext U
      exact e.apply_symm_apply U
    rw [this, Finsupp.mapDomain_id, ← equivFinsupp_symm, Equiv.symm_apply_apply]

end FAMeasure

end SignMath
