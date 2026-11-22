import Mathlib.CategoryTheory.Category.Pointed
import Mathlib.CategoryTheory.Limits.Shapes.ZeroObjects
import Mathlib.CategoryTheory.Limits.Shapes.Products
import Mathlib.CategoryTheory.Endomorphism

/-!
# D. 付点集合の圏 Set*（Mathlib の `Pointed`）
-/

namespace SignMath

open CategoryTheory Limits

universe u

/-- S⁰ = 1₊：基点 `none` と、もう1点 `some ⟨⟩`。 -/
def S0 : Pointed.{u} := Pointed.of (none : Option PUnit.{u+1})

/-- 定理 D.1：1点の付点集合は Set* の零対象。 -/
theorem isZero_punit : IsZero (Pointed.of PUnit.unit : Pointed.{u}) := by
  refine ⟨fun Y => ⟨{ default := ⟨fun _ => Y.point, rfl⟩, uniq := fun f => ?_ }⟩,
    fun Y => ⟨{ default := ⟨fun _ => PUnit.unit, rfl⟩, uniq := fun f => ?_ }⟩⟩
  · apply Pointed.Hom.ext
    funext x
    cases x
    exact f.map_point
  · apply Pointed.Hom.ext
    funext x
    rfl

/-- 定理 D.2（米田）：S⁰ からの付点の射は、行き先の元と1対1（`Hom*(S⁰, −) ≅ U`）。 -/
def homS0Equiv (X : Pointed.{u}) : (S0 ⟶ X) ≃ X := by
  exact
    { toFun := fun f => f.toFun (some PUnit.unit)
      invFun := fun x => ⟨fun o => o.elim X.point (fun _ => x), rfl⟩
      left_inv := fun f => by
        apply Pointed.Hom.ext
        funext o
        cases o with
        | none => exact f.map_point.symm
        | some a => cases a; rfl
      right_inv := fun _ => rfl }

/-- 恒等関手の自然な自己変換 0：どの点も基点へ送る。 -/
def zeroNat : 𝟭 Pointed.{u} ⟶ 𝟭 Pointed.{u} := by
  exact
    { app := fun X => ⟨fun _ => X.point, rfl⟩
      naturality := fun X Y f => by
        apply Pointed.Hom.ext
        funext x
        exact f.map_point.symm }

private theorem aux_app_S0 (α : 𝟭 Pointed.{u} ⟶ 𝟭 Pointed.{u}) (X : Pointed.{u}) (x : X) :
    (α.app X).toFun x =
      ((homS0Equiv X).symm x).toFun ((α.app S0).toFun (some PUnit.unit)) := by
  have h := congrArg (fun g => g.toFun (some PUnit.unit)) (α.naturality ((homS0Equiv X).symm x))
  exact h

/-- 定理 D.3：`End(Id_{Set*}) = {id, 0}`。 -/
theorem endId_eq (α : 𝟭 Pointed.{u} ⟶ 𝟭 Pointed.{u}) : α = 𝟙 _ ∨ α = zeroNat := by
  rcases h : (α.app S0).toFun (some PUnit.unit) with _ | a
  · right
    apply NatTrans.ext
    funext X
    apply Pointed.Hom.ext
    funext x
    rw [aux_app_S0, h]
    rfl
  · left
    cases a
    apply NatTrans.ext
    funext X
    apply Pointed.Hom.ext
    funext x
    rw [aux_app_S0, h]
    rfl

theorem id_ne_zeroNat : (𝟙 (𝟭 Pointed.{u})) ≠ zeroNat := by
  intro h
  have := congrArg (fun α : 𝟭 Pointed.{u} ⟶ 𝟭 Pointed.{u} => (α.app S0).toFun (some PUnit.unit)) h
  change (some PUnit.unit : Option PUnit.{u+1}) = none at this
  exact Option.some_ne_none _ this

/-- 定理 D.4：入れ替え `id ↔ 0` は、合成についてのモノイドの射にならない。
どのモノイドの射も単位 `id` を `id` へ送り、`0` へは送らない。 -/
theorem swap_not_monoidHom (σ : End (𝟭 Pointed.{u}) →* End (𝟭 Pointed.{u})) :
    σ 1 ≠ End.of zeroNat := by
  rw [map_one]
  intro h
  exact id_ne_zeroNat (congrArg End.asHom h)

/-- 定理 D.5：どの付点の自己射も基点を動かさない。とくに、不動点の無い自己射は無い
（S⁰ の2点の入れ替え、つまり否定は Set* の射でない）。 -/
theorem endo_fixes_point {X : Pointed.{u}} (f : X ⟶ X) : f.toFun X.point = X.point := by
  exact f.map_point

theorem no_fixedPointFree_endo {X : Pointed.{u}} (f : X ⟶ X) : ∃ x, f.toFun x = x := by
  exact ⟨X.point, f.map_point⟩

/-- 定理 D.6：どの付点集合も S⁰ の wedge（基点でない点で添字づけた、S⁰ の余積）。 -/
noncomputable def wedgeCofan (X : Pointed.{u}) : Cofan (fun _ : {x : X // x ≠ X.point} => (S0 : Pointed.{u})) := by
  exact Cofan.mk X (fun i => (homS0Equiv X).symm i.1)

noncomputable def wedgeIsColimit (X : Pointed.{u}) : IsColimit (wedgeCofan X) := by
  classical
  refine Cofan.IsColimit.mk _
    (fun s => ⟨fun x => if h : x = X.point then s.pt.point else (s.inj ⟨x, h⟩).toFun (some PUnit.unit),
      dite_eq_left (rfl : X.point = X.point)⟩) ?_ ?_
  · intro s i
    apply Pointed.Hom.ext
    funext o
    cases o with
    | none =>
      change (if h : X.point = X.point then s.pt.point else _) = (s.inj i).toFun none
      rw [dite_eq_left rfl]
      exact (s.inj i).map_point.symm
    | some a =>
      cases a
      change (if h : i.1 = X.point then s.pt.point else (s.inj ⟨i.1, h⟩).toFun (some PUnit.unit)) = _
      rw [dite_eq_right i.2]
  · intro s m hm
    apply Pointed.Hom.ext
    funext x
    change m.toFun x = if h : x = X.point then s.pt.point else (s.inj ⟨x, h⟩).toFun (some PUnit.unit)
    split_ifs with h
    · subst h
      exact m.map_point
    · rw [← hm ⟨x, h⟩]
      rfl

theorem wedgeCofan_pt (X : Pointed.{u}) : (wedgeCofan X).pt = X := by
  rfl

end SignMath
