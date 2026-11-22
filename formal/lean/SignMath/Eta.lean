import Mathlib.Order.Filter.Ultrafilter.Basic

/-!
# G. η の側：超フィルターの単位
-/

namespace SignMath

open Filter

universe u

/-- η_X : X → βX（単項の超フィルター）。 -/
abbrev eta (X : Type u) : X → Ultrafilter X := pure

/-- 定理 G.1：η は自然（`β f ∘ η = η ∘ f`）。 -/
theorem eta_natural {X Y : Type u} (f : X → Y) (x : X) :
    Ultrafilter.map f (eta X x) = eta Y (f x) := by
  exact Ultrafilter.map_pure f x

/-- 定理 G.2：η はいつも単射。 -/
theorem eta_injective (X : Type u) : Function.Injective (eta X) := by
  exact Ultrafilter.pure_injective

/-- 定理 G.3：η_X が全単射 ⇔ X の上の超フィルターは全部単項。 -/
theorem eta_bijective_iff (X : Type u) :
    Function.Bijective (eta X) ↔ ∀ U : Ultrafilter X, ∃ x, U = pure x := by
  constructor
  · intro h U
    obtain ⟨x, hx⟩ := h.2 U
    exact ⟨x, hx.symm⟩
  · intro h
    refine ⟨eta_injective X, fun U => ?_⟩
    obtain ⟨x, hx⟩ := h U
    exact ⟨x, hx.symm⟩

/-- 定理 G.4：有限の X では η_X は全単射。 -/
theorem eta_bijective_of_finite (X : Type u) [Finite X] : Function.Bijective (eta X) := by
  exact ⟨eta_injective X, Ultrafilter.pure_surjective⟩

/-- 定理 G.5：η_ℕ は全射でない（非単項の超フィルターがある。選択を使う）。 -/
theorem eta_nat_not_surjective : ¬ Function.Surjective (eta ℕ) := by
  intro h
  obtain ⟨n, hn⟩ := h (Filter.hyperfilter ℕ)
  have hmem : ({n} : Set ℕ) ∈ eta ℕ n := Ultrafilter.mem_pure.mpr (Set.mem_singleton n)
  rw [hn] at hmem
  exact Filter.notMem_hyperfilter_of_finite (Set.finite_singleton n) hmem

end SignMath
