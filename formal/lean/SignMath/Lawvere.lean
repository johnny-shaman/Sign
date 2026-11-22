import Mathlib.CategoryTheory.Monoidal.Cartesian.Basic
import Mathlib.CategoryTheory.Limits.Shapes.ZeroObjects
import Mathlib.CategoryTheory.Monoidal.Types.Basic

/-!
# E. Lawvere の不動点定理と嘘つきの文
-/

namespace SignMath

open CategoryTheory Limits MonoidalCategory CartesianMonoidalCategory

universe v u

variable {C : Type u} [Category.{v} C] [CartesianMonoidalCategory C]

/-- 定理 E.1（Lawvere、積だけの形）：`Φ : A ⊗ A ⟶ B` が弱く点全射
（どの `g : A ⟶ B` にも、どの点 `x` でも `Φ(a, x) = g(x)` となる点 `a` がある）なら、
`B` のどの自己射にも不動点（`s ≫ f = s` となる点 `s`）がある。 -/
theorem lawvere {A B : C} (Φ : A ⊗ A ⟶ B)
    (hΦ : ∀ g : A ⟶ B, ∃ a : 𝟙_ C ⟶ A, ∀ x : 𝟙_ C ⟶ A, lift a x ≫ Φ = x ≫ g)
    (f : B ⟶ B) : ∃ s : 𝟙_ C ⟶ B, s ≫ f = s := by
  obtain ⟨a, ha⟩ := hΦ (lift (𝟙 A) (𝟙 A) ≫ Φ ≫ f)
  refine ⟨lift a a ≫ Φ, ?_⟩
  calc (lift a a ≫ Φ) ≫ f = a ≫ lift (𝟙 A) (𝟙 A) ≫ Φ ≫ f := by
        rw [Category.assoc, comp_lift_assoc, Category.comp_id]
    _ = lift a a ≫ Φ := (ha a).symm

/-- 系 E.2（Cantor・嘘つき）：集合の圏では否定 `Bool.not` に不動点が無いので、
`A → (A → Bool)` の全射は無い。 -/
theorem cantor_of_lawvere (A : Type u) :
    ¬ ∃ φ : A → (A → ULift.{u} Bool), Function.Surjective φ := by
  rintro ⟨φ, hφ⟩
  obtain ⟨s, hs⟩ := lawvere (C := Type u) (A := A) (B := ULift.{u} Bool)
    (TypeCat.ofHom (fun p : A × A => φ p.1 p.2))
    (fun g => by
      obtain ⟨a₀, ha₀⟩ := hφ (fun a => g a)
      refine ⟨TypeCat.ofHom (fun _ => a₀), fun x => ?_⟩
      ext t
      change (φ a₀ (x t)).down = (g (x t)).down
      rw [ha₀])
    (TypeCat.ofHom (fun b : ULift.{u} Bool => ULift.up (!b.down)))
  have h : (!(s PUnit.unit).down) = (s PUnit.unit).down :=
    congrArg (fun k : 𝟙_ (Type u) ⟶ ULift.{u} Bool => (k PUnit.unit).down) hs
  cases hb : (s PUnit.unit).down <;> simp [hb] at h

/-- 定理 E.3：零対象を持つ（積を持つ）圏では、終対象からの点は1つしかなく、
どの自己射の不動点でもある。Lawvere の定理の対偶に入れる物（不動点の無い自己射）が無い。 -/
theorem every_point_fixed {Z : C} (hZ : IsZero Z) {B : C} (f : B ⟶ B) (s : 𝟙_ C ⟶ B) :
    s ≫ f = s := by
  have h1 : IsZero (𝟙_ C) := hZ.of_iso (isTerminalTensorUnit.uniqueUpToIso hZ.isTerminal)
  exact h1.eq_of_src _ _

end SignMath
