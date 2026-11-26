import Mathlib.Algebra.Category.ModuleCat.Adjunctions
import Mathlib.CategoryTheory.Preadditive.Mat
import Mathlib.CategoryTheory.Category.PartialFun
import Mathlib.CategoryTheory.Limits.Shapes.Biproducts

/-!
# L. 計算の量の像（その1：どの圏も線形圏へ忠実に入る）

どの圏 `C` も、零対象と有限の双積を持つ線形圏（量の圏）へ忠実に入る。
入れ方は2段。
1段目は自由な `ℤ` 線形圏 `Free ℤ C`。射 `f` を、`f` だけを係数 `1` で持つ形式和に送る。
2段目は行列の圏 `Mat_`。対象を有限の並びにし、射を射の行列にする。
この構成は `C` の射の性質を何も使わない。
だからチューリング機械の性質も、浮動小数点の性質も使わない。
「量の圏に入る」こと自体は、どの圏についても成り立つ。
この入れ方が保つのは合成と恒等だけで、分岐も発散も保たない。
射 `f` は 0 でない `single f 1` へ行くので、どこでも値の無い部分関数も 0 へは行かない。
L 節の中身は、部分関数の圏からの別の移しが何を保つかにある。
`Partial.lean` の `lin` と、`Rel.lean` のグラフの関手で扱う。
-/

namespace SignMath.Quantity

open CategoryTheory Limits

universe v u

section

variable (C : Type u) [Category.{v} C]

/-- 定理 L.1a（自由な線形化は忠実）：埋め込み `Free.embedding ℤ C` は忠実である。
射 `f` は `Finsupp.single f 1` に移る。`(1 : ℤ) ≠ 0` なので、異なる射は異なる形式和に移る。 -/
theorem free_embedding_faithful : (Free.embedding ℤ C).Faithful where
  map_injective h := Finsupp.single_left_injective (one_ne_zero : (1 : ℤ) ≠ 0) h

instance : (Free.embedding ℤ C).Faithful := free_embedding_faithful C

/-- 定義 L.1：`linearize C` は、`C` を自由な `ℤ` 線形圏 `Free ℤ C` へ入れる関手である。
その先で、行列の圏 `Mat_ (Free ℤ C)` へ1行1列の行列として入れる。 -/
noncomputable def linearize : C ⥤ Mat_ (Free ℤ C) :=
  Free.embedding ℤ C ⋙ Mat_.embedding (Free ℤ C)

/-- 定理 L.1b（線形化は忠実）：`linearize C` は忠実である。 -/
theorem linearize_faithful : (linearize C).Faithful := by
  unfold linearize
  infer_instance

instance : (linearize C).Faithful := linearize_faithful C

/-- 定理 L.1c（双積）：行き先 `Mat_ (Free ℤ C)` は有限の双積を持つ。 -/
theorem linearize_target_hasFiniteBiproducts : HasFiniteBiproducts (Mat_ (Free ℤ C)) :=
  inferInstance

/-- 定理 L.1c（零対象）：行き先 `Mat_ (Free ℤ C)` は零対象を持つ。 -/
theorem linearize_target_hasZeroObject : HasZeroObject (Mat_ (Free ℤ C)) :=
  inferInstance

end

/-- 定理 L.1d（関数）：`C = Type u` のとき、`linearize` は忠実である。
行き先は有限の双積と零対象を持つ。`Type u` の射は関数を包んだ物で、関数 `f` は `TypeCat.ofHom f` として射になる。 -/
theorem linearize_type :
    (linearize (Type u)).Faithful ∧ HasFiniteBiproducts (Mat_ (Free ℤ (Type u))) ∧
      HasZeroObject (Mat_ (Free ℤ (Type u))) :=
  ⟨linearize_faithful _, linearize_target_hasFiniteBiproducts _,
    linearize_target_hasZeroObject _⟩

/-- 定理 L.1d（関数、射ごと）：異なる関数 `f g : X → Y` は、`linearize (Type u)` で異なる射に移る。 -/
theorem linearize_type_map_injective (X Y : Type u) :
    Function.Injective (fun f : X → Y => (linearize (Type u)).map (TypeCat.ofHom f)) := by
  intro f g h
  have h' := (linearize (Type u)).map_injective h
  funext x
  exact congrArg (fun k : X ⟶ Y => k x) h'

/-- 定理 L.1d（部分関数）：`C = PartialFun` のとき、`linearize` は忠実である。
行き先は有限の双積と零対象を持つ。`PartialFun` の射は部分関数である。 -/
theorem linearize_partialFun :
    (linearize PartialFun.{u}).Faithful ∧ HasFiniteBiproducts (Mat_ (Free ℤ PartialFun.{u})) ∧
      HasZeroObject (Mat_ (Free ℤ PartialFun.{u})) :=
  ⟨linearize_faithful _, linearize_target_hasFiniteBiproducts _,
    linearize_target_hasZeroObject _⟩

/-- 定理 L.1d（部分関数、射ごと）：異なる部分関数 `f g : X →. Y` は、
`linearize PartialFun` で異なる射に移る。 -/
theorem linearize_partialFun_map_injective (X Y : PartialFun.{u}) :
    Function.Injective (fun f : X →. Y => (linearize PartialFun.{u}).map (X := X) (Y := Y) f) :=
  fun _ _ h => (linearize PartialFun.{u}).map_injective h

end SignMath.Quantity
