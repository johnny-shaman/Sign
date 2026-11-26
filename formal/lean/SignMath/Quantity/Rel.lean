import Mathlib.CategoryTheory.Category.RelCat
import Mathlib.CategoryTheory.Category.PartialFun
import Mathlib.CategoryTheory.Limits.Shapes.BinaryBiproducts
import Mathlib.CategoryTheory.Limits.Shapes.ZeroObjects

/-!
# L. 計算の量の像（その5：関係の圏は線形圏、浮動小数点の規格の演算も入る）

関係の圏 `RelCat` は、零対象と二項の双積を持つ。
零射は空の関係である。
零対象は空集合 `PEmpty` である。
二項の双積の頂点は直和 `X ⊕ Y` である。
入口は `Sum.inl`・`Sum.inr` のグラフで、出口はそのグラフの逆の関係である。
部分関数の圏 `PartialFun` は、グラフを取る関手で `RelCat` へ忠実に入る。
どこでも値の無い部分関数は、零射へ行く。
`RelCat` には、どの関数のグラフでもない射がある。
だから線形圏の射は、関数に限らず関係も含む。

Mathlib で二項の双積から有限の双積を作る補題は、前加法圏（`Preadditive`）を仮定する。
`RelCat` で双積から来る射の和は和集合になり、`f + f = f` なので、射の集まりは群にならない。
この2つはこのファイルでは証明しない。
このファイルは、二項の双積と零対象までを示す。

`RelCat` の対象は型そのものである。
関係の等式は、まず型の上の集合の等式として示し、それを `RelCat` の射の等式に移す。
-/

namespace SignMath.Quantity

open CategoryTheory Limits SetRel

universe u

section Zero

/-- 定義 L.7a：`RelCat` の零射。どの `X ⟶ Y` でも、零射は空の関係である。 -/
instance relCat_hasZeroMorphisms : HasZeroMorphisms RelCat.{u} where
  zero _ _ := ⟨RelCat.Hom.ofRel ∅⟩
  comp_zero f _ := RelCat.Hom.ext _ _ (SetRel.comp_empty f.rel)
  zero_comp _ _ _ f := RelCat.Hom.ext _ _ (SetRel.empty_comp f.rel)

/-- 定理 L.7a（零射は空の関係）：`RelCat` の零射の下にある関係は、空の関係である。 -/
theorem relCat_zero_rel (X Y : RelCat.{u}) : (0 : X ⟶ Y).rel = ∅ :=
  rfl

/-- 定理 L.7b（零対象）：空集合 `PEmpty` は `RelCat` の零対象である。 -/
theorem relCat_isZero_pempty : IsZero (C := RelCat.{u}) PEmpty.{u+1} :=
  (IsZero.iff_id_eq_zero _).mpr (RelCat.Hom.ext _ _ (Set.ext fun p => p.1.elim))

/-- 定理 L.7b（零対象を持つ）：`RelCat` は零対象を持つ。 -/
instance relCat_hasZeroObject : HasZeroObject RelCat.{u} :=
  ⟨⟨_, relCat_isZero_pempty⟩⟩

end Zero

section SumRel

variable {T X Y : Type u}

/-- 対の関係。`t` は、`t ~[f] x` のとき `inl x` と結ばれ、`t ~[g] y` のとき `inr y` と結ばれる。 -/
def sumLiftRel (f : SetRel T X) (g : SetRel T Y) : SetRel T (X ⊕ Y) :=
  {p | Sum.elim (fun x => (p.1, x) ∈ f) (fun y => (p.1, y) ∈ g) p.2}

/-- 場合分けの関係。`inl x` は `x ~[f] t` のとき `t` と結ばれ、`inr y` は `y ~[g] t` のとき `t` と結ばれる。 -/
def sumDescRel (f : SetRel X T) (g : SetRel Y T) : SetRel (X ⊕ Y) T :=
  {p | Sum.elim (fun x => (x, p.2) ∈ f) (fun y => (y, p.2) ∈ g) p.1}

@[simp]
theorem mem_sumLiftRel_inl (f : SetRel T X) (g : SetRel T Y) (t : T) (x : X) :
    (t, Sum.inl x) ∈ sumLiftRel f g ↔ (t, x) ∈ f :=
  Iff.rfl

@[simp]
theorem mem_sumLiftRel_inr (f : SetRel T X) (g : SetRel T Y) (t : T) (y : Y) :
    (t, Sum.inr y) ∈ sumLiftRel f g ↔ (t, y) ∈ g :=
  Iff.rfl

@[simp]
theorem mem_sumDescRel_inl (f : SetRel X T) (g : SetRel Y T) (x : X) (t : T) :
    (Sum.inl x, t) ∈ sumDescRel f g ↔ (x, t) ∈ f :=
  Iff.rfl

@[simp]
theorem mem_sumDescRel_inr (f : SetRel X T) (g : SetRel Y T) (y : Y) (t : T) :
    (Sum.inr y, t) ∈ sumDescRel f g ↔ (y, t) ∈ g :=
  Iff.rfl

/-- `inl` のグラフのあとにその逆を置くと、恒等の関係になる。 -/
theorem graph_inl_comp_inv :
    Function.graph (Sum.inl : X → X ⊕ Y) ○ (Function.graph Sum.inl).inv = SetRel.id :=
  Set.ext fun ⟨_, _⟩ => by simp [eq_comm]

/-- `inl` のグラフのあとに `inr` のグラフの逆を置くと、空の関係になる。 -/
theorem graph_inl_comp_inr_inv :
    Function.graph (Sum.inl : X → X ⊕ Y) ○ (Function.graph Sum.inr).inv = ∅ :=
  Set.ext fun ⟨_, _⟩ => by simp

/-- `inr` のグラフのあとに `inl` のグラフの逆を置くと、空の関係になる。 -/
theorem graph_inr_comp_inl_inv :
    Function.graph (Sum.inr : Y → X ⊕ Y) ○ (Function.graph Sum.inl).inv = ∅ :=
  Set.ext fun ⟨_, _⟩ => by simp

/-- `inr` のグラフのあとにその逆を置くと、恒等の関係になる。 -/
theorem graph_inr_comp_inv :
    Function.graph (Sum.inr : Y → X ⊕ Y) ○ (Function.graph Sum.inr).inv = SetRel.id :=
  Set.ext fun ⟨_, _⟩ => by simp [eq_comm]

/-- 対の関係のあとに `inl` のグラフの逆を置くと、1つ目の成分に戻る。 -/
theorem sumLiftRel_comp_inl_inv (f : SetRel T X) (g : SetRel T Y) :
    sumLiftRel f g ○ (Function.graph Sum.inl).inv = f :=
  Set.ext fun ⟨_, _⟩ => by simp

/-- 対の関係のあとに `inr` のグラフの逆を置くと、2つ目の成分に戻る。 -/
theorem sumLiftRel_comp_inr_inv (f : SetRel T X) (g : SetRel T Y) :
    sumLiftRel f g ○ (Function.graph Sum.inr).inv = g :=
  Set.ext fun ⟨_, _⟩ => by simp

/-- `X ⊕ Y` への関係は、2つの成分の対の関係である。 -/
theorem sumLiftRel_eta (m : SetRel T (X ⊕ Y)) :
    m = sumLiftRel (m ○ (Function.graph Sum.inl).inv) (m ○ (Function.graph Sum.inr).inv) :=
  Set.ext fun ⟨_, s⟩ => by rcases s with _ | _ <;> simp

/-- `inl` のグラフのあとに場合分けの関係を置くと、1つ目の枝に戻る。 -/
theorem graph_inl_comp_sumDescRel (f : SetRel X T) (g : SetRel Y T) :
    Function.graph Sum.inl ○ sumDescRel f g = f :=
  Set.ext fun ⟨_, _⟩ => by simp

/-- `inr` のグラフのあとに場合分けの関係を置くと、2つ目の枝に戻る。 -/
theorem graph_inr_comp_sumDescRel (f : SetRel X T) (g : SetRel Y T) :
    Function.graph Sum.inr ○ sumDescRel f g = g :=
  Set.ext fun ⟨_, _⟩ => by simp

/-- `X ⊕ Y` からの関係は、2つの枝の場合分けの関係である。 -/
theorem sumDescRel_eta (m : SetRel (X ⊕ Y) T) :
    m = sumDescRel (Function.graph Sum.inl ○ m) (Function.graph Sum.inr ○ m) :=
  Set.ext fun ⟨s, _⟩ => by rcases s with _ | _ <;> simp

end SumRel

section Biproduct

/-- 定義 L.7c：`RelCat` の二項の双錐。頂点は直和 `X ⊕ Y` である。
入口 `inl`・`inr` は `Sum.inl`・`Sum.inr` のグラフである。
出口 `fst`・`snd` は、そのグラフの逆の関係である。 -/
def sumBicone (X Y : RelCat.{u}) : BinaryBicone X Y where
  pt := (X ⊕ Y : Type u)
  fst := RelCat.Hom.ofRel (Function.graph (Sum.inl : X → X ⊕ Y)).inv
  snd := RelCat.Hom.ofRel (Function.graph (Sum.inr : Y → X ⊕ Y)).inv
  inl := RelCat.Hom.ofRel (Function.graph (Sum.inl : X → X ⊕ Y))
  inr := RelCat.Hom.ofRel (Function.graph (Sum.inr : Y → X ⊕ Y))
  inl_fst := RelCat.Hom.ext _ _ graph_inl_comp_inv
  inl_snd := RelCat.Hom.ext _ _ graph_inl_comp_inr_inv
  inr_fst := RelCat.Hom.ext _ _ graph_inr_comp_inl_inv
  inr_snd := RelCat.Hom.ext _ _ graph_inr_comp_inv

/-- 定理 L.7c（双積）：`sumBicone X Y` は双極限である。
錐として極限（積）であり、余錐として余極限（余積）である。
積への射は対の関係 `sumLiftRel` で、余積からの射は場合分けの関係 `sumDescRel` である。 -/
def sumBicone_isBilimit (X Y : RelCat.{u}) : (sumBicone X Y).IsBilimit where
  isLimit := BinaryFan.IsLimit.mk _
    (fun f g => RelCat.Hom.ofRel (sumLiftRel f.rel g.rel))
    (fun f g => RelCat.Hom.ext _ _ (sumLiftRel_comp_inl_inv f.rel g.rel))
    (fun f g => RelCat.Hom.ext _ _ (sumLiftRel_comp_inr_inv f.rel g.rel))
    (by
      rintro _ _ _ m rfl rfl
      exact RelCat.Hom.ext _ _ (sumLiftRel_eta m.rel))
  isColimit := BinaryCofan.IsColimit.mk _
    (fun f g => RelCat.Hom.ofRel (sumDescRel f.rel g.rel))
    (fun f g => RelCat.Hom.ext _ _ (graph_inl_comp_sumDescRel f.rel g.rel))
    (fun f g => RelCat.Hom.ext _ _ (graph_inr_comp_sumDescRel f.rel g.rel))
    (by
      rintro _ _ _ m rfl rfl
      exact RelCat.Hom.ext _ _ (sumDescRel_eta m.rel))

/-- 定理 L.7c（二項の双積を持つ）：`RelCat` は二項の双積を持つ。
`X` と `Y` の双積は、`sumBicone X Y` で与えられる。 -/
instance relCat_hasBinaryBiproducts : HasBinaryBiproducts RelCat.{u} where
  has_binary_biproduct X Y := HasBinaryBiproduct.mk ⟨sumBicone X Y, sumBicone_isBilimit X Y⟩

end Biproduct

section PartialFun

/-- 恒等の部分関数のグラフは、恒等の関係である。 -/
theorem pfun_graph'_id (X : Type u) : PFun.graph' (PFun.id X) = SetRel.id :=
  Set.ext fun ⟨_, _⟩ => by simp [PFun.graph', eq_comm]

/-- 部分関数の合成のグラフは、グラフの合成である。`g.comp f` は先に `f` を受ける。 -/
theorem pfun_graph'_comp {X Y Z : Type u} (f : X →. Y) (g : Y →. Z) :
    PFun.graph' (g.comp f) = PFun.graph' f ○ PFun.graph' g :=
  Set.ext fun ⟨_, _⟩ => Part.mem_bind_iff

/-- 部分関数は、そのグラフで決まる。 -/
theorem pfun_graph'_injective {X Y : Type u} :
    Function.Injective (PFun.graph' : (X →. Y) → SetRel X Y) :=
  fun _ _ h => PFun.ext fun a b => Set.ext_iff.mp h (a, b)

/-- どの点でも値を持たない部分関数のグラフは、空の関係である。 -/
theorem pfun_graph'_eq_empty {X Y : Type u} (f : X →. Y) (h : ∀ x, ¬ (f x).Dom) :
    PFun.graph' f = ∅ :=
  Set.ext fun ⟨x, y⟩ => ⟨fun hy => (h x (Part.dom_iff_mem.mpr ⟨y, hy⟩)).elim, fun hy => hy.elim⟩

/-- 定義 L.7d：部分関数の圏から関係の圏への関手。
部分関数 `f` は、`y ∈ f x` のときに `x` と `y` を結ぶ関係 `PFun.graph' f` へ行く。 -/
def pfunToRel : PartialFun.{u} ⥤ RelCat.{u} where
  obj X := (X : Type u)
  map {X Y} f := RelCat.Hom.ofRel (PFun.graph' (α := X) (β := Y) f)
  map_id X := RelCat.Hom.ext _ _ (pfun_graph'_id X)
  map_comp {X Y Z} f g := RelCat.Hom.ext _ _ (pfun_graph'_comp (X := X) (Y := Y) (Z := Z) f g)

/-- `pfunToRel` の射の下にある関係。`x` と `y` は、`y ∈ f x` のときに結ばれる。 -/
theorem mem_pfunToRel_map {X Y : Type u} (f : X →. Y) (x : X) (y : Y) :
    (x, y) ∈ (pfunToRel.map (X := .of X) (Y := .of Y) f).rel ↔ y ∈ f x :=
  Iff.rfl

/-- 定理 L.7d（忠実）：`pfunToRel` は忠実である。部分関数は、そのグラフで決まる。 -/
instance pfunToRel_faithful : pfunToRel.{u}.Faithful where
  map_injective {X Y} _ _ h := pfun_graph'_injective (X := X) (Y := Y) (congrArg RelCat.Hom.rel h)

/-- 定理 L.7d（どこでも発散すれば零射）：`f` がどの点でも値を持たないなら、
`pfunToRel f` は零射（空の関係）である。 -/
theorem pfunToRel_map_eq_zero_of_nowhere_dom {X Y : Type u} (f : X →. Y)
    (h : ∀ x, ¬ (f x).Dom) : pfunToRel.map (X := .of X) (Y := .of Y) f = 0 :=
  RelCat.Hom.ext _ _ (pfun_graph'_eq_empty f h)

end PartialFun

section NotGraph

/-- `Bool` の上の関数のグラフは、全体の関係ではない。 -/
theorem graph_ne_univ (g : Bool → Bool) : Function.graph g ≠ Set.univ := by
  intro h
  have hm : (false, !g false) ∈ Function.graph g := by
    rw [h]
    exact Set.mem_univ _
  simp at hm

/-- 定義 L.7e：`Bool` の上の、どの入力も `false` と `true` の両方に結ぶ関係。
出口の値を1つに決めない演算は、こういう関係になる。 -/
def anyOut : RelCat.graphFunctor.obj Bool ⟶ RelCat.graphFunctor.obj Bool :=
  RelCat.Hom.ofRel Set.univ

/-- `anyOut` は、どの関数 `g : Bool → Bool` のグラフでもない。 -/
theorem anyOut_ne_graph (g : Bool → Bool) :
    RelCat.graphFunctor.map (TypeCat.ofHom g) ≠ anyOut :=
  fun h => graph_ne_univ g (congrArg RelCat.Hom.rel h)

/-- 定理 L.7e（関数でない射）：`RelCat` には、どの関数のグラフでもない射 `Bool ⟶ Bool` がある。
線形圏の射は関数に限らず、関係も含む。
IEEE 754 の演算をビットの並びの上で見ると、規格は NaN の結果の符号を（copy・negate・abs・copySign を除いて）決めない。
ペイロードも推奨（should）に留める。
そういう演算は関数でなく関係で、関係の圏の射として入る。
このファイルは IEEE 754 そのものを模型にしない。 -/
theorem exists_rel_not_graph :
    ∃ r : RelCat.graphFunctor.obj Bool ⟶ RelCat.graphFunctor.obj Bool,
      ∀ g : Bool → Bool, RelCat.graphFunctor.map (TypeCat.ofHom g) ≠ r :=
  ⟨anyOut, anyOut_ne_graph⟩

end NotGraph

end SignMath.Quantity
