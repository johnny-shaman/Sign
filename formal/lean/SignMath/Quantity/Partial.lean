import Mathlib.CategoryTheory.Category.PartialFun
import Mathlib.Algebra.Category.MonCat.Adjunctions
import Mathlib.Algebra.BigOperators.Finsupp.Basic

/-!
# L. 計算の量の像（その2：部分関数、分岐は双積へ、発散は零へ）

部分関数の圏 `PartialFun` から量の側の模型 CMon（`AddCommMonCat`）へ、関手 `lin` を作る。
対象 `X` は自由可換モノイド `ℕ^(X)`（`X →₀ ℕ`）へ行く。
部分関数 `f` の像 `lin f` は、値のある点 `x` を `f x` へ送り、値の無い点 `x` を `0` へ送る。
`lin` は忠実で、全域の関数に制限すると A 節のつなぎ `ℕ^(−)` と一致する。
分岐（余積 `X ⊕ Y`）は双積へ行き、発散（値が無いこと）は `0` へ行く。
Mathlib は `AddCommMonCat` に零射の構造（`HasZeroMorphisms`）を与えていない。
そのため双積の等式は、下にある加法的な写像の上で書く。
-/

namespace SignMath.Quantity

open CategoryTheory

universe u

open Classical in
/-- 部分関数 `f : X →. Y` の、加法的な像。点 `x` の重み `n` は、`f x` に値があればその値へ、
値が無ければ `0` へ行く。 -/
noncomputable def linHom {X Y : Type u} (f : X →. Y) : (X →₀ ℕ) →+ (Y →₀ ℕ) :=
  Finsupp.liftAddHom fun x => if h : (f x).Dom then Finsupp.singleAddHom ((f x).get h) else 0

open Classical in
/-- `linHom f` の、点の上の値。 -/
theorem linHom_single {X Y : Type u} (f : X →. Y) (x : X) (n : ℕ) :
    linHom f (Finsupp.single x n) =
      if h : (f x).Dom then Finsupp.single ((f x).get h) n else 0 := by
  rw [linHom, Finsupp.liftAddHom_apply_single]
  by_cases h : (f x).Dom <;> simp [h]

/-- 値のある点の像。 -/
theorem linHom_single_of_eq_some {X Y : Type u} {f : X →. Y} {x : X} {y : Y}
    (h : f x = Part.some y) (n : ℕ) : linHom f (Finsupp.single x n) = Finsupp.single y n := by
  rw [linHom_single]
  simp [h]

/-- 値の無い点の像。 -/
theorem linHom_single_of_eq_none {X Y : Type u} {f : X →. Y} {x : X}
    (h : f x = Part.none) (n : ℕ) : linHom f (Finsupp.single x n) = 0 := by
  rw [linHom_single]
  simp [h]

/-- 部分関数は、その加法的な像で決まる。 -/
theorem linHom_injective {X Y : Type u} : Function.Injective (linHom : (X →. Y) → _) := by
  intro f g hfg
  funext x
  have kx : linHom f (Finsupp.single x 1) = linHom g (Finsupp.single x 1) := by rw [hfg]
  rcases Part.eq_none_or_eq_some (f x) with hf | ⟨y, hf⟩ <;>
    rcases Part.eq_none_or_eq_some (g x) with hg | ⟨z, hg⟩
  · rw [hf, hg]
  · rw [linHom_single_of_eq_none hf, linHom_single_of_eq_some hg] at kx
    exact absurd kx.symm (Finsupp.single_ne_zero.mpr one_ne_zero)
  · rw [linHom_single_of_eq_some hf, linHom_single_of_eq_none hg] at kx
    exact absurd kx (Finsupp.single_ne_zero.mpr one_ne_zero)
  · rw [linHom_single_of_eq_some hf, linHom_single_of_eq_some hg,
      Finsupp.single_left_inj one_ne_zero] at kx
    rw [hf, hg, kx]

/-- `X →₀ ℕ` を CMon の対象として見たもの。 -/
noncomputable abbrev linObj (X : Type u) : AddCommMonCat.{u} :=
  AddCommMonCat.of (X →₀ ℕ)

/-- `linHom f` を CMon の射として見たもの。 -/
noncomputable def linMap {X Y : Type u} (f : X →. Y) : linObj X ⟶ linObj Y :=
  AddCommMonCat.ofHom (linHom f)

/-- `linMap` は恒等を保つ。 -/
theorem linMap_id (X : Type u) : linMap (PFun.id X) = 𝟙 (linObj X) := by
  refine AddCommMonCat.hom_ext (Finsupp.addHom_ext (α := X) fun x n => ?_)
  exact linHom_single_of_eq_some (PFun.id_apply x) n

/-- `linMap` は合成を保つ。部分関数の合成 `g.comp f` は、先に `f` を受ける。 -/
theorem linMap_comp {X Y Z : Type u} (f : X →. Y) (g : Y →. Z) :
    linMap (g.comp f) = linMap f ≫ linMap g := by
  refine AddCommMonCat.hom_ext (Finsupp.addHom_ext (α := X) fun x n => ?_)
  show linHom (g.comp f) (Finsupp.single x n) = linHom g (linHom f (Finsupp.single x n))
  rcases Part.eq_none_or_eq_some (f x) with h | ⟨y, h⟩
  · have hc : (g.comp f) x = Part.none := by
      rw [PFun.comp_apply, h]
      exact Part.bind_none g
    rw [linHom_single_of_eq_none h, map_zero, linHom_single_of_eq_none hc]
  · have hc : (g.comp f) x = g y := by
      rw [PFun.comp_apply, h]
      exact Part.bind_some y g
    rw [linHom_single_of_eq_some h, linHom_single, linHom_single, hc]

/-- 定義 L.2：部分関数の圏から CMon への関手 `lin`。対象 `X` は `X →₀ ℕ` へ行く。
射 `f` は、`single x n` を、`f x` に値があれば `single (f x) n` へ、値が無ければ `0` へ送る。 -/
noncomputable def lin : PartialFun.{u} ⥤ AddCommMonCat.{u} where
  obj X := linObj X
  map {X Y} f := linMap (X := X) (Y := Y) f
  map_id X := linMap_id X
  map_comp {X Y Z} f g := linMap_comp (X := X) (Y := Y) (Z := Z) f g

open Classical in
/-- `lin` の射の、点の上の値。 -/
@[simp]
theorem lin_map_single {X Y : Type u} (f : X →. Y) (x : X) (n : ℕ) :
    (lin.map (X := .of X) (Y := .of Y) f).hom (Finsupp.single x n) =
      if h : (f x).Dom then Finsupp.single ((f x).get h) n else 0 :=
  linHom_single f x n

/-- `f` が点 `x` で値を持つなら、`lin f` は `single x n` を `single (f x) n` へ送る。 -/
theorem lin_map_single_of_dom {X Y : Type u} (f : X →. Y) (x : X) (n : ℕ) (h : (f x).Dom) :
    (lin.map (X := .of X) (Y := .of Y) f).hom (Finsupp.single x n) =
      Finsupp.single ((f x).get h) n := by
  rw [lin_map_single, dite_eq_left h]

/-- 定理 L.2a（忠実）：`lin` は忠実である。部分関数は、その量の像で決まる。 -/
instance lin_faithful : lin.{u}.Faithful where
  map_injective {X Y} _ _ hfg :=
    linHom_injective (X := X) (Y := Y) (congrArg AddCommMonCat.Hom.hom hfg)

/-- 定理 L.2b（A 節のつなぎの延長）：全域の関数に制限した `lin` は、A 節のつなぎ
`ℕ^(−) : Type ⥤ CMon`（`AddCommMonCat.free`）と自然に同型である。対象の上では恒等である。 -/
noncomputable def linFreeIso : typeToPartialFun.{u} ⋙ lin.{u} ≅ AddCommMonCat.free.{u} :=
  NatIso.ofComponents (fun X => Iso.refl _) fun {X Y} f => by
    refine AddCommMonCat.hom_ext (Finsupp.addHom_ext (α := X) fun x n => ?_)
    show linHom (PFun.lift (f : X → Y)) (Finsupp.single x n) =
      Finsupp.mapDomain (f : X → Y) (Finsupp.single x n)
    rw [linHom_single_of_eq_some (PFun.coe_val (f : X → Y) x), Finsupp.mapDomain_single]

/-- `linFreeIso` の成分は、どの対象でも恒等写像である。 -/
theorem linFreeIso_hom_app (X : Type u) (v : X →₀ ℕ) : (linFreeIso.hom.app X).hom v = v :=
  rfl

/-- `linFreeIso` の逆の成分も、どの対象でも恒等写像である。 -/
theorem linFreeIso_inv_app (X : Type u) (v : X →₀ ℕ) : (linFreeIso.inv.app X).hom v = v :=
  rfl

/-- 部分の射影 `X ⊕ Y →. X`。`inl x` でだけ値を持ち、その値は `x`。 -/
def partFst (X Y : Type u) : X ⊕ Y →. X :=
  Sum.elim Part.some fun _ => Part.none

/-- 部分の射影 `X ⊕ Y →. Y`。`inr y` でだけ値を持ち、その値は `y`。 -/
def partSnd (X Y : Type u) : X ⊕ Y →. Y :=
  Sum.elim (fun _ => Part.none) Part.some

/-- 定義 L.2c：分岐の量の像。`ι₁ = lin (inl)`、`ι₂ = lin (inr)`、`π₁ = lin (partFst)`、
`π₂ = lin (partSnd)`。 -/
noncomputable def branchInl (X Y : Type u) : linObj X ⟶ linObj (X ⊕ Y) :=
  lin.map (typeToPartialFun.map (↾(Sum.inl : X → X ⊕ Y)))

/-- 分岐の入口 `ι₂ = lin (inr)`。 -/
noncomputable def branchInr (X Y : Type u) : linObj Y ⟶ linObj (X ⊕ Y) :=
  lin.map (typeToPartialFun.map (↾(Sum.inr : Y → X ⊕ Y)))

/-- 分岐の出口 `π₁ = lin (partFst)`。 -/
noncomputable def branchFst (X Y : Type u) : linObj (X ⊕ Y) ⟶ linObj X :=
  lin.map (X := .of (X ⊕ Y)) (Y := .of X) (partFst X Y)

/-- 分岐の出口 `π₂ = lin (partSnd)`。 -/
noncomputable def branchSnd (X Y : Type u) : linObj (X ⊕ Y) ⟶ linObj Y :=
  lin.map (X := .of (X ⊕ Y)) (Y := .of Y) (partSnd X Y)

private theorem branchInl_single (X Y : Type u) (x : X) (n : ℕ) :
    (branchInl X Y).hom (Finsupp.single x n) = Finsupp.single (Sum.inl x) n :=
  linHom_single_of_eq_some (f := PFun.lift (Sum.inl : X → X ⊕ Y)) rfl n

private theorem branchInr_single (X Y : Type u) (y : Y) (n : ℕ) :
    (branchInr X Y).hom (Finsupp.single y n) = Finsupp.single (Sum.inr y) n :=
  linHom_single_of_eq_some (f := PFun.lift (Sum.inr : Y → X ⊕ Y)) rfl n

private theorem branchFst_inl (X Y : Type u) (x : X) (n : ℕ) :
    (branchFst X Y).hom (Finsupp.single (Sum.inl x) n) = Finsupp.single x n :=
  linHom_single_of_eq_some (f := partFst X Y) rfl n

private theorem branchFst_inr (X Y : Type u) (y : Y) (n : ℕ) :
    (branchFst X Y).hom (Finsupp.single (Sum.inr y) n) = 0 :=
  linHom_single_of_eq_none (f := partFst X Y) rfl n

private theorem branchSnd_inl (X Y : Type u) (x : X) (n : ℕ) :
    (branchSnd X Y).hom (Finsupp.single (Sum.inl x) n) = 0 :=
  linHom_single_of_eq_none (f := partSnd X Y) rfl n

private theorem branchSnd_inr (X Y : Type u) (y : Y) (n : ℕ) :
    (branchSnd X Y).hom (Finsupp.single (Sum.inr y) n) = Finsupp.single y n :=
  linHom_single_of_eq_some (f := partSnd X Y) rfl n

/-- 定理 L.2c（分岐は双積へ）：`π₁ ∘ ι₁ = id`、`π₂ ∘ ι₂ = id`、`π₁ ∘ ι₂ = 0`、`π₂ ∘ ι₁ = 0`、
`ι₁ ∘ π₁ + ι₂ ∘ π₂ = id`。この5つの等式は、射の集まりが可換モノイドである圏での双積の等式である。
等式は、下にある加法的な写像（`.hom`）の上で書く。 -/
theorem branch_biproduct (X Y : Type u) :
    (branchFst X Y).hom.comp (branchInl X Y).hom = AddMonoidHom.id _ ∧
    (branchSnd X Y).hom.comp (branchInr X Y).hom = AddMonoidHom.id _ ∧
    (branchFst X Y).hom.comp (branchInr X Y).hom = 0 ∧
    (branchSnd X Y).hom.comp (branchInl X Y).hom = 0 ∧
    (branchInl X Y).hom.comp (branchFst X Y).hom + (branchInr X Y).hom.comp (branchSnd X Y).hom =
      AddMonoidHom.id _ := by
  refine ⟨Finsupp.addHom_ext (α := X) fun x n => ?_, Finsupp.addHom_ext (α := Y) fun y n => ?_,
    Finsupp.addHom_ext (α := Y) fun y n => ?_, Finsupp.addHom_ext (α := X) fun x n => ?_,
    Finsupp.addHom_ext (α := X ⊕ Y) fun s n => ?_⟩
  · show (branchFst X Y).hom ((branchInl X Y).hom (Finsupp.single x n)) = Finsupp.single x n
    rw [branchInl_single, branchFst_inl]
  · show (branchSnd X Y).hom ((branchInr X Y).hom (Finsupp.single y n)) = Finsupp.single y n
    rw [branchInr_single, branchSnd_inr]
  · show (branchFst X Y).hom ((branchInr X Y).hom (Finsupp.single y n)) = 0
    rw [branchInr_single, branchFst_inr]
  · show (branchSnd X Y).hom ((branchInl X Y).hom (Finsupp.single x n)) = 0
    rw [branchInl_single, branchSnd_inl]
  · show (branchInl X Y).hom ((branchFst X Y).hom (Finsupp.single s n)) +
        (branchInr X Y).hom ((branchSnd X Y).hom (Finsupp.single s n)) = Finsupp.single s n
    rcases s with x | y
    · rw [branchFst_inl, branchSnd_inl, map_zero, add_zero, branchInl_single]
    · rw [branchFst_inr, branchSnd_inr, map_zero, zero_add, branchInr_single]

/-- 定理 L.3a（発散は零へ）：`f` が点 `x` で値を持たないなら、`lin f` は `single x n` を `0` へ送る。 -/
theorem lin_map_single_of_not_dom {X Y : Type u} (f : X →. Y) (x : X) (n : ℕ)
    (h : ¬ (f x).Dom) : (lin.map (X := .of X) (Y := .of Y) f).hom (Finsupp.single x n) = 0 :=
  linHom_single_of_eq_none (Part.eq_none_iff'.mpr h) n

/-- 定理 L.3b（どこでも発散すれば零写像）：`f` がどの点でも値を持たないなら、`lin f` は零写像である。
射の集まりの足し算で見れば、これが零射である。 -/
theorem lin_map_eq_zero_of_nowhere_dom {X Y : Type u} (f : X →. Y)
    (h : ∀ x, ¬ (f x).Dom) : (lin.map (X := .of X) (Y := .of Y) f).hom = 0 :=
  Finsupp.addHom_ext (α := X) fun x n =>
    (lin_map_single_of_not_dom f x n (h x)).trans (AddMonoidHom.zero_apply _).symm

end SignMath.Quantity
