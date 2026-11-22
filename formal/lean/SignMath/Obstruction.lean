import Mathlib.CategoryTheory.Monoidal.Closed.Cartesian
import Mathlib.CategoryTheory.Distributive.Cartesian
import Mathlib.CategoryTheory.Limits.Shapes.ZeroMorphisms
import Mathlib.CategoryTheory.Preadditive.OfBiproducts

/-!
# B. 自明化と障害の定理

零対象と、デカルト閉・分配・捨ての自然性・双積を、1つの圏に同時に置くと何が起きるか。
-/

namespace SignMath

open CategoryTheory Limits MonoidalCategory

universe v u

variable {C : Type u} [Category.{v} C]

/-- `A` から出る射がどれも等しい（`𝟙 A` が零対象を通る）なら、`A` は零対象。 -/
private theorem aux_isZero_of_id_eq {Z : C} (hZ : IsZero Z) {A : C}
    (h : 𝟙 A = hZ.from_ A ≫ hZ.to_ A) : IsZero A :=
  hZ.of_iso
    { hom := hZ.from_ A
      inv := hZ.to_ A
      hom_inv_id := h.symm
      inv_hom_id := hZ.eq_of_src _ _ }

/-- 定理 B.1（T1）：零対象を持つデカルト閉圏では、どの対象も零対象である。 -/
theorem t1_ccc_zero [CartesianMonoidalCategory C] [MonoidalClosed C]
    {Z : C} (hZ : IsZero Z) (A : C) : IsZero A := by
  have : IsIso (hZ.from_ A) := strict_initial hZ.isInitial (hZ.from_ A)
  exact hZ.of_iso (asIso (hZ.from_ A))

/-- 定理 B.2（T2）：零対象を持つ分配圏では、どの対象も零対象である。
分配は二項の余積についてだけ仮定する（空の余積の分配律 `A × 0 ≅ 0` は仮定しない）。 -/
theorem t2_distrib_zero [CartesianMonoidalCategory C] [HasBinaryCoproducts C]
    [IsCartesianDistributive C] {Z : C} (hZ : IsZero Z) (A : C) : IsZero A := by
  have hinl : (coprod.inl : Z ⟶ Z ⨿ Z) = coprod.inr := hZ.eq_of_src _ _
  have h1 : (coprod.inl : A ⊗ Z ⟶ (A ⊗ Z) ⨿ (A ⊗ Z)) = coprod.inr := by
    rw [← cancel_mono (leftDistrib A Z Z).hom, coprod_inl_leftDistrib_hom,
      coprod_inr_leftDistrib_hom, hinl]
  have key : ∀ {B : C} (f g : A ⊗ Z ⟶ B), f = g := by
    intro B f g
    calc f = coprod.inl ≫ coprod.desc f g := (coprod.inl_desc f g).symm
      _ = coprod.inr ≫ coprod.desc f g := by rw [h1]
      _ = g := coprod.inr_desc f g
  refine aux_isZero_of_id_eq hZ ?_
  calc 𝟙 A = CartesianMonoidalCategory.lift (𝟙 A) (hZ.from_ A) ≫ CartesianMonoidalCategory.fst A Z :=
        (CartesianMonoidalCategory.lift_fst _ _).symm
    _ = CartesianMonoidalCategory.lift (𝟙 A) (hZ.from_ A) ≫
          (CartesianMonoidalCategory.fst A Z ≫ hZ.from_ A ≫ hZ.to_ A) :=
        congrArg (CartesianMonoidalCategory.lift (𝟙 A) (hZ.from_ A) ≫ ·) (key _ _)
    _ = hZ.from_ A ≫ hZ.to_ A := by
        rw [← Category.assoc, CartesianMonoidalCategory.lift_fst, Category.id_comp]

/-- 定理 B.3（T3）：⊗ について閉で零対象を持つ圏で、捨て `ε A : A ⟶ 𝟙_ C` が
すべての射について自然で `ε (𝟙_ C) = 𝟙 _` なら、どの対象も零対象である。 -/
theorem t3_discard_natural [MonoidalCategory C] [MonoidalClosed C]
    {Z : C} (hZ : IsZero Z) (ε : ∀ A : C, A ⟶ 𝟙_ C)
    (nat : ∀ {A B : C} (f : A ⟶ B), f ≫ ε B = ε A) (unit : ε (𝟙_ C) = 𝟙 _)
    (A : C) : IsZero A := by
  have hI : IsZero (𝟙_ C) := hZ.of_iso
    { hom := hZ.from_ (𝟙_ C)
      inv := ε Z
      hom_inv_id := by rw [nat, unit]
      inv_hom_id := hZ.eq_of_src _ _ }
  have key : ∀ {B : C} (f g : A ⊗ 𝟙_ C ⟶ B), f = g := fun f g =>
    MonoidalClosed.curry_injective (hI.eq_of_src _ _)
  refine aux_isZero_of_id_eq hZ ?_
  calc 𝟙 A = (ρ_ A).inv ≫ (ρ_ A).hom := (Iso.inv_hom_id _).symm
    _ = (ρ_ A).inv ≫ ((ρ_ A).hom ≫ hZ.from_ A ≫ hZ.to_ A) := congrArg ((ρ_ A).inv ≫ ·) (key _ _)
    _ = hZ.from_ A ≫ hZ.to_ A := by rw [← Category.assoc, Iso.inv_hom_id, Category.id_comp]

/-- 定理 B.4：零射を持ち、始対象があれば、その始対象は零対象である。
（双積は零射を前提にするので、双積を持つ圏の始対象は零対象。） -/
theorem initial_isZero [HasZeroMorphisms C] {I : C} (hI : IsInitial I) : IsZero I := by
  exact (IsZero.iff_id_eq_zero I).mpr (hI.hom_ext _ _)

open ZeroObject in
/-- 零対象を通る射は零射。 -/
private theorem aux_zero_of_comp [HasZeroMorphisms C] {X W Y : C} (hW : IsZero W)
    (p : X ⟶ W) (q : W ⟶ Y) : p ≫ q = 0 := by
  rw [hW.eq_zero_of_src q, comp_zero]

open ZeroObject in
private theorem aux_zero_factor [HasZeroMorphisms C] [HasZeroObject C] (X Y : C) :
    (0 : X ⟶ Y) = (0 : X ⟶ (0 : C)) ≫ (0 : (0 : C) ⟶ Y) := by
  rw [zero_comp]

open ZeroObject in
private theorem aux_tensor_zero_right [MonoidalCategory C] [HasZeroMorphisms C] [HasZeroObject C]
    {A B : C} (a : 𝟙_ C ⟶ A) : a ⊗ₘ (0 : 𝟙_ C ⟶ B) = 0 := by
  rw [tensorHom_def', aux_zero_factor, MonoidalCategory.whiskerLeft_comp, Category.assoc]
  exact aux_zero_of_comp ((isZero_zero C).of_iso (λ_ (0 : C))) _ _

open ZeroObject in
private theorem aux_tensor_zero_left [MonoidalCategory C] [HasZeroMorphisms C] [HasZeroObject C]
    {A B : C} (b : 𝟙_ C ⟶ B) : (0 : 𝟙_ C ⟶ A) ⊗ₘ b = 0 := by
  rw [tensorHom_def, aux_zero_factor, MonoidalCategory.comp_whiskerRight, Category.assoc]
  exact aux_zero_of_comp ((isZero_zero C).of_iso (ρ_ (0 : C))) _ _

/-- 定理 B.5（T4）：零対象と二項の双積を持つモノイダル圏で、`g : A ⊞ B ⟶ A ⊗ B` が
どの点 `a : 𝟙_ C ⟶ A`、`b : 𝟙_ C ⟶ B` でも `⟨a, b⟩ ≫ g = a ⊗ b`（`𝟙 ≅ 𝟙 ⊗ 𝟙` で読む）なら、
`a ⊗ b` はいつも零射である。双積の和は `OfBiproducts` の可換モノイドで取る。 -/
theorem t4_biprod_to_tensor [MonoidalCategory C] [HasZeroMorphisms C] [HasZeroObject C]
    [HasBinaryBiproducts C] {A B : C} (g : A ⊞ B ⟶ A ⊗ B)
    (hg : ∀ (a : 𝟙_ C ⟶ A) (b : 𝟙_ C ⟶ B), biprod.lift a b ≫ g = (λ_ (𝟙_ C)).inv ≫ (a ⊗ₘ b))
    (a : 𝟙_ C ⟶ A) (b : 𝟙_ C ⟶ B) : (λ_ (𝟙_ C)).inv ≫ (a ⊗ₘ b) = 0 := by
  let _ := fun X Y : C => SemiadditiveOfBinaryBiproducts.addCommMonoidHomOfHasBinaryBiproducts X Y
  have hsplit : biprod.lift a b = biprod.lift a 0 + biprod.lift 0 b := by
    apply biprod.hom_ext
    · rw [SemiadditiveOfBinaryBiproducts.add_comp, biprod.lift_fst, biprod.lift_fst, biprod.lift_fst,
        add_zero]
    · rw [SemiadditiveOfBinaryBiproducts.add_comp, biprod.lift_snd, biprod.lift_snd, biprod.lift_snd,
        zero_add]
  rw [← hg, hsplit, SemiadditiveOfBinaryBiproducts.add_comp, hg, hg, aux_tensor_zero_right,
    aux_tensor_zero_left, comp_zero, add_zero]

open ZeroObject in
/-- 定理 B.6：⊗ が対称で閉、零対象を持つなら、零射との ⊗ は零射。
とくに評価射は零の点に正格：`(0 ⊗ f) ≫ ev = 0`。 -/
theorem tensor_zero_left [MonoidalCategory C] [SymmetricCategory C] [MonoidalClosed C]
    [HasZeroMorphisms C] [HasZeroObject C] {X Y Z W : C} (f : Z ⟶ W) :
    (0 : X ⟶ Y) ⊗ₘ f = 0 := by
  have key : ∀ {T : C} (h k : (0 : C) ⊗ W ⟶ T), h = k := by
    intro T h k
    have : (β_ (0 : C) W).inv ≫ h = (β_ (0 : C) W).inv ≫ k :=
      MonoidalClosed.curry_injective ((isZero_zero C).eq_of_src _ _)
    simpa using this
  rw [aux_zero_factor X Y, ← Category.comp_id f, ← tensorHom_comp_tensorHom,
    key ((0 : (0 : C) ⟶ Y) ⊗ₘ 𝟙 W) 0, comp_zero]

theorem ev_strict [MonoidalCategory C] [SymmetricCategory C] [MonoidalClosed C]
    [HasZeroMorphisms C] [HasZeroObject C] {J K A B : C} (f : K ⟶ (ihom A).obj B) :
    ((0 : J ⟶ A) ⊗ₘ f) ≫ (ihom.ev A).app B = 0 := by
  rw [tensor_zero_left, zero_comp]

end SignMath
