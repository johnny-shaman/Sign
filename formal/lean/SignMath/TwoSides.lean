import Mathlib.CategoryTheory.Monoidal.Closed.Types
import Mathlib.Algebra.Category.MonCat.Adjunctions
import Mathlib.Algebra.Category.MonCat.Colimits
import Mathlib.CategoryTheory.Limits.Shapes.ZeroObjects
import Mathlib.CategoryTheory.Limits.Preserves.Basic
import Mathlib.CategoryTheory.Adjunction.Limits

/-!
# A. 二つの側とつなぎ（模型の存在）

空間の側（デカルト閉で分配的な圏）と量の側（零対象と双積を持つ圏）を、
有限の余積を保つ関手（Lawvere の外延量の型）でつなぐ。
標準の模型は `Type ⥤ CMon`、`X ↦ ℕ^(X)`（自由可換モノイド）。
-/

namespace SignMath

open CategoryTheory Limits

universe u

/-- 定理 A.1：空間の側の模型 `Type u` は零対象を持たない（空集合は終対象でない）。 -/
theorem type_not_hasZeroObject : ¬ HasZeroObject (Type u) := by
  rintro ⟨Z, hZ⟩
  have z : Z := hZ.from_ PUnit.{u+1} PUnit.unit
  exact (hZ.to_ PEmpty.{u+1} z).elim

/-- 定理 A.2：量の側の模型 CMon（`AddCommMonCat`）では、1点のモノイドが零対象。 -/
theorem cmon_isZero_punit : IsZero (AddCommMonCat.of PUnit.{u+1}) := by
  refine ⟨fun Y => ⟨{ default := AddCommMonCat.ofHom 0, uniq := fun f => ?_ }⟩,
    fun Y => ⟨{ default := AddCommMonCat.ofHom 0, uniq := fun f => ?_ }⟩⟩
  · ext x
    cases x
    exact f.hom.map_zero
  · ext x

/-- 定理 A.3：CMon では `A × B` が、`inl`・`inr` で余積、`fst`・`snd` で積になる（双積）。 -/
noncomputable def cmonCoprodIsColimit (A B : AddCommMonCat.{u}) :
    IsColimit (BinaryCofan.mk (P := AddCommMonCat.of (A × B))
      (AddCommMonCat.ofHom (AddMonoidHom.inl A B)) (AddCommMonCat.ofHom (AddMonoidHom.inr A B))) := by
  refine BinaryCofan.IsColimit.mk _
    (fun f g => AddCommMonCat.ofHom (AddMonoidHom.coprod f.hom g.hom)) ?_ ?_ ?_
  · intro T f g
    ext a
    simp
  · intro T f g
    ext b
    simp
  · intro T f g m h₁ h₂
    ext ⟨a, b⟩
    have ha := congrArg (fun k => k.hom a) h₁
    have hb := congrArg (fun k => k.hom b) h₂
    simp only [BinaryCofan.mk_inl, BinaryCofan.mk_inr, AddCommMonCat.hom_comp,
      AddCommMonCat.hom_ofHom, AddMonoidHom.coe_comp, Function.comp_apply] at ha hb
    simp only [AddCommMonCat.hom_ofHom]
    rw [AddMonoidHom.coprod_apply, ← ha, ← hb, ← map_add]
    congr 1
    simp

noncomputable def cmonProdIsLimit (A B : AddCommMonCat.{u}) :
    IsLimit (BinaryFan.mk (P := AddCommMonCat.of (A × B))
      (AddCommMonCat.ofHom (AddMonoidHom.fst A B)) (AddCommMonCat.ofHom (AddMonoidHom.snd A B))) := by
  refine BinaryFan.IsLimit.mk _
    (fun f g => AddCommMonCat.ofHom (AddMonoidHom.prod f.hom g.hom)) ?_ ?_ ?_
  · intro T f g
    ext t
    simp
  · intro T f g
    ext t
    simp
  · intro T f g m h₁ h₂
    ext t
    have ha := congrArg (fun k => k.hom t) h₁
    have hb := congrArg (fun k => k.hom t) h₂
    simp only [BinaryFan.mk_fst, BinaryFan.mk_snd, AddCommMonCat.hom_comp,
      AddCommMonCat.hom_ofHom, AddMonoidHom.coe_comp, Function.comp_apply] at ha hb
    simp only [AddCommMonCat.hom_ofHom]
    rw [AddMonoidHom.prod_apply]
    exact Prod.ext ha hb

/-- 定理 A.4：つなぎ `ℕ^(−) : Type ⥤ CMon` は左随伴なので、すべての余積を保つ。 -/
theorem free_preservesColimits : PreservesColimitsOfSize.{u, u} AddCommMonCat.free.{u} := by
  exact AddCommMonCat.adj.leftAdjoint_preservesColimits

/-- 定理 A.5：CMon は自明でない（`ℕ` は零対象でない）。 -/
theorem cmon_not_trivial : ¬ IsZero (AddCommMonCat.of ℕ) := by
  intro h
  have := congrArg (fun k : AddCommMonCat.of ℕ ⟶ AddCommMonCat.of ℕ => k.hom 1)
    (h.eq_of_src (𝟙 _) (AddCommMonCat.ofHom 0))
  simp at this

end SignMath
