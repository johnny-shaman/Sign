import SignMath.Quantity.Rel
import Mathlib.CategoryTheory.Preadditive.Biproducts
import Mathlib.Logic.Equiv.Prod
import Mathlib.Logic.Equiv.Sum

/-!
# L. 計算の量の像（その6：対話。代数と余代数、自然同型なら双代数）

対話は、写しと射の2つの順の道が同じ所へ着くことである。
1つ目の道は、写してから射を当てる。
2つ目の道は、射を当ててから写す。
2つの道が同じ所へ着くことを、写しの自然性と言う。

写しと捨ては、余可換な余モノイド（余代数）である。
対話は、どの射もその準同型だということである。
畳みと始の射は、可換なモノイド（代数）である。対話は、どの射もその準同型だということである。
律と対話は別の条件である。関係の圏の `×` の写しは律を満たすが、どの関係とも対話するわけではない。
余積から積への射が同型（双積）なら、`×` と `+` が同じ `⊕` になる。
写しと畳みは同じ `⊕` の上にあり、どの射とも対話し、双代数の律を満たす。
その時、射の足し算は、写しと畳みの間に2つの射を並べた物になる。

このファイルは次を示す。
- 型の積 `×` の上の写しと捨ては、余可換な余モノイドで、どの関数とも可換である（L.8a）。
- 型の和 `⊕` の上の畳みと始の射は、可換なモノイドで、どの関数とも可換である（L.8b）。
- 関係の圏の `×` では、写しと可換な関係はちょうど一価な関係である。
  捨てと可換な関係はちょうど全域な関係である。
  だから両方と可換な関係は、ちょうど関数のグラフである（L.8c）。
- 二項の双積を持つ圏では、写しと畳みはどの射とも可換で、双代数の律を満たす。
  前加法圏なら、射の足し算は `Δ ≫ (f ⊕ g) ≫ ∇` で、`Δ ≫ ∇ = 𝟙 + 𝟙` である（L.8d）。
- 関係の圏の `⊕`（L.7 の双積）では、写しと畳みはどの関係とも可換で、
  射の足し算は和集合である（L.8e）。
- 同じ関係の圏で、`×` の写しと可換でない関係 `Bool → Bool` がある。
  `⊕` の写しは `Bool → Bool` のどの関係とも可換である（L.8f。`⊕` の側は L.8e の特別な場合）。
-/

namespace SignMath.Quantity

open CategoryTheory Limits SetRel

universe v u

section Coalgebra

variable {A B : Type u}

/-- 定義 L.8a：写し。点 `a` を組 `(a, a)` へ送る。 -/
def copy (a : A) : A × A := (a, a)

/-- 定義 L.8a：捨て。どの点も、1点の型のただ1つの点へ送る。 -/
def discard (_ : A) : PUnit.{u+1} := PUnit.unit

/-- 定理 L.8a（余結合）：写してから左を写すのと、写してから右を写すのは、組の組み直しで一致する。 -/
theorem copy_coassoc (a : A) :
    Equiv.prodAssoc A A A (Prod.map copy id (copy a)) = Prod.map id copy (copy a) :=
  rfl

/-- 定理 L.8a（余単位）：写してから左を捨てても、右を捨てても、元の点に戻る。 -/
theorem copy_counit (a : A) :
    Equiv.punitProd A (Prod.map discard id (copy a)) = a ∧
      Equiv.prodPUnit A (Prod.map id discard (copy a)) = a :=
  ⟨rfl, rfl⟩

/-- 定理 L.8a（余可換）：写した組は、入れ替えで動かない。 -/
theorem copy_comm (a : A) : (copy a).swap = copy a :=
  rfl

/-- 定理 L.8a（対話）：どの関数 `f` についても、写してから `f` を当てるのと、
`f` を当ててから写すのは同じである。 -/
theorem copy_natural (f : A → B) (a : A) : Prod.map f f (copy a) = copy (f a) :=
  rfl

/-- 定理 L.8a（対話）：どの関数 `f` についても、`f` を当ててから捨てるのは、そのまま捨てるのと同じである。 -/
theorem discard_natural (f : A → B) (a : A) : discard (f a) = discard a :=
  rfl

end Coalgebra

section Algebra

variable {A B : Type u}

/-- 定義 L.8b：畳み。和 `A ⊕ A` のどちらの側の点も、そのまま `A` の点へ送る。 -/
def fold : A ⊕ A → A :=
  Sum.elim id id

/-- 定義 L.8b：始の射。空の型から `A` へのただ1つの関数。 -/
def init : PEmpty.{u+1} → A :=
  PEmpty.elim

/-- 定理 L.8b（結合）：左を畳んでから畳むのと、和を組み直して右を畳んでから畳むのは同じである。 -/
theorem fold_assoc (s : (A ⊕ A) ⊕ A) :
    fold (Sum.map fold id s) = fold (Sum.map id fold (Equiv.sumAssoc A A A s)) := by
  rcases s with (a | a) | a <;> rfl

/-- 定理 L.8b（単位）：始の射を左に置いて畳むと、空の型との和を外したのと同じである。 -/
theorem fold_unit (s : PEmpty.{u+1} ⊕ A) :
    fold (Sum.map init id s) = Equiv.emptySum PEmpty.{u+1} A s := by
  rcases s with e | a
  · exact e.elim
  · rfl

/-- 定理 L.8b（可換）：和の左右を入れ替えてから畳んでも、同じである。 -/
theorem fold_comm (s : A ⊕ A) : fold s.swap = fold s := by
  rcases s with a | a <;> rfl

/-- 定理 L.8b（対話）：どの関数 `f` についても、畳んでから `f` を当てるのと、
両側に `f` を当ててから畳むのは同じである。 -/
theorem fold_natural (f : A → B) (s : A ⊕ A) : f (fold s) = fold (Sum.map f f s) := by
  rcases s with a | a <;> rfl

/-- 定理 L.8b（対話）：どの関数 `f` についても、始の射のあとに `f` を当てると、始の射である。 -/
theorem init_natural (f : A → B) : f ∘ init = init :=
  funext fun e => e.elim

end Algebra

section RelProd

variable {A B C D : Type u}

/-- 定義 L.8c：関係の圏の写し。写しのグラフである。 -/
def copyRel (A : Type u) : SetRel A (A × A) :=
  Function.graph copy

/-- 定義 L.8c：関係の圏の捨て。捨てのグラフである。 -/
def discardRel (A : Type u) : SetRel A PUnit.{u+1} :=
  Function.graph discard

/-- 定義 L.8c：組の関係。組の成分ごとに、`R` と `S` を当てる。 -/
def prodRel (R : SetRel A B) (S : SetRel C D) : SetRel (A × C) (B × D) :=
  {p | p.1.1 ~[R] p.2.1 ∧ p.1.2 ~[S] p.2.2}

@[simp]
theorem mem_copyRel (a : A) (p : A × A) : a ~[copyRel A] p ↔ (a, a) = p :=
  Iff.rfl

@[simp]
theorem mem_discardRel (a : A) (u : PUnit.{u+1}) : a ~[discardRel A] u :=
  rfl

@[simp]
theorem mem_prodRel (R : SetRel A B) (S : SetRel C D) (p : A × C) (q : B × D) :
    p ~[prodRel R S] q ↔ p.1 ~[R] q.1 ∧ p.2 ~[S] q.2 :=
  Iff.rfl

/-- 定理 L.8c（写しと可換 ⇔ 一価）：関係 `R` について、`R` を当ててから写すのと、
写してから成分ごとに `R` を当てるのが同じになるのは、ちょうど `R` が一価の時である。 -/
theorem copyRel_natural_iff (R : SetRel A B) :
    R ○ copyRel B = copyRel A ○ prodRel R R ↔ ∀ a b b', a ~[R] b → a ~[R] b' → b = b' := by
  constructor
  · intro h a b b' hb hb'
    have hm : a ~[copyRel A ○ prodRel R R] (b, b') := ⟨(a, a), rfl, hb, hb'⟩
    rw [← h] at hm
    obtain ⟨c, _, hc⟩ := hm
    simp only [mem_copyRel, Prod.mk.injEq] at hc
    exact hc.1.symm.trans hc.2
  · intro h
    ext ⟨a, q⟩
    constructor
    · rintro ⟨b, hb, hq⟩
      simp only [mem_copyRel] at hq
      subst hq
      exact ⟨(a, a), rfl, hb, hb⟩
    · rintro ⟨p, hp, h1, h2⟩
      simp only [mem_copyRel] at hp
      subst hp
      refine ⟨q.1, h1, ?_⟩
      simp only [mem_copyRel]
      exact Prod.ext rfl (h a _ _ h1 h2)

/-- 定理 L.8c（捨てと可換 ⇔ 全域）：関係 `R` について、`R` を当ててから捨てるのと、
そのまま捨てるのが同じになるのは、ちょうど `R` が全域の時である。 -/
theorem discardRel_natural_iff (R : SetRel A B) :
    R ○ discardRel B = discardRel A ↔ ∀ a, ∃ b, a ~[R] b := by
  constructor
  · intro h a
    have hm : a ~[R ○ discardRel B] PUnit.unit := by rw [h]; exact mem_discardRel a _
    obtain ⟨b, hb, _⟩ := hm
    exact ⟨b, hb⟩
  · intro h
    ext ⟨a, u⟩
    refine ⟨fun _ => mem_discardRel a u, fun _ => ?_⟩
    obtain ⟨b, hb⟩ := h a
    exact ⟨b, hb, mem_discardRel b u⟩

/-- 定理 L.8c（対話を通る関係は関数）：関係 `R` が写しとも捨てとも可換になるのは、
ちょうど `R` がある関数のグラフである時である。 -/
theorem dialogue_iff_graph (R : SetRel A B) :
    (R ○ copyRel B = copyRel A ○ prodRel R R ∧ R ○ discardRel B = discardRel A) ↔
      ∃ f : A → B, R = Function.graph f := by
  rw [copyRel_natural_iff, discardRel_natural_iff]
  constructor
  · rintro ⟨hsv, htot⟩
    choose f hf using htot
    refine ⟨f, ?_⟩
    ext ⟨a, b⟩
    exact ⟨fun hb => hsv a _ _ (hf a) hb, fun hb => hb ▸ hf a⟩
  · rintro ⟨f, rfl⟩
    exact ⟨fun a b b' hb hb' => hb.symm.trans hb', fun a => ⟨f a, rfl⟩⟩

end RelProd

section Bialgebra

variable {C : Type u} [Category.{v} C] [HasZeroMorphisms C] [HasBinaryBiproducts C]

/-- 定義 L.8d：双積の上の写し。`X` から `X ⊞ X` への、両方の成分が恒等の射。 -/
noncomputable abbrev bcopy (X : C) : X ⟶ X ⊞ X :=
  biprod.lift (𝟙 X) (𝟙 X)

/-- 定義 L.8d：双積の上の畳み。`X ⊞ X` から `X` への、両方の枝が恒等の射。 -/
noncomputable abbrev bfold (X : C) : X ⊞ X ⟶ X :=
  biprod.desc (𝟙 X) (𝟙 X)

/-- 定義 L.8d：真ん中の入れ替え。`(x₁, x₂), (y₁, y₂)` を `(x₁, y₁), (x₂, y₂)` へ送る。 -/
noncomputable abbrev middleSwap (X : C) : (X ⊞ X) ⊞ (X ⊞ X) ⟶ (X ⊞ X) ⊞ (X ⊞ X) :=
  biprod.lift (biprod.map biprod.fst biprod.fst) (biprod.map biprod.snd biprod.snd)

/-- 定理 L.8d（写しの対話）：どの射 `f` についても、`f` のあとに写すのと、
写してから成分ごとに `f` を当てるのは同じである。 -/
theorem bcopy_natural {X Y : C} (f : X ⟶ Y) : f ≫ bcopy Y = bcopy X ≫ biprod.map f f := by
  ext <;> simp

/-- 定理 L.8d（畳みの対話）：どの射 `f` についても、畳んでから `f` を当てるのと、
成分ごとに `f` を当ててから畳むのは同じである。 -/
theorem bfold_natural {X Y : C} (f : X ⟶ Y) : bfold X ≫ f = biprod.map f f ≫ bfold Y := by
  ext <;> simp

/-- 定理 L.8d（余単位と単位）：写してから射影すると恒等に戻り、入口から畳むと恒等に戻る。 -/
theorem bcopy_fst_snd_inl_inr_bfold (X : C) :
    bcopy X ≫ biprod.fst = 𝟙 X ∧ bcopy X ≫ biprod.snd = 𝟙 X ∧
      biprod.inl ≫ bfold X = 𝟙 X ∧ biprod.inr ≫ bfold X = 𝟙 X := by
  simp

/-- 定理 L.8d（双代数の律）：畳んでから写すのは、それぞれ写し、真ん中を入れ替え、それぞれ畳むのと同じである。 -/
theorem bialgebra_law (X : C) :
    bfold X ≫ bcopy X =
      biprod.map (bcopy X) (bcopy X) ≫ middleSwap X ≫ biprod.map (bfold X) (bfold X) := by
  ext <;> simp

end Bialgebra

section HomAdd

variable {C : Type u} [Category.{v} C] [Preadditive C] [HasBinaryBiproducts C]

/-- 定理 L.8d（射の足し算）：前加法圏で、射の足し算は、写しと畳みの間に2つの射を並べた物である。 -/
theorem hom_add_eq_bcopy_map_bfold {X Y : C} (f g : X ⟶ Y) :
    bcopy X ≫ biprod.map f g ≫ bfold Y = f + g := by
  rw [biprod.add_eq_lift_desc_id, ← Category.assoc]
  congr 1
  ext <;> simp

/-- 定理 L.8d（写してすぐ畳む）：写したあとすぐ畳むと、恒等の2倍 `𝟙 + 𝟙` になる。 -/
theorem bcopy_bfold (X : C) : bcopy X ≫ bfold X = 𝟙 X + 𝟙 X := by
  simp only [bcopy, bfold, biprod.lift_desc, Category.id_comp]

end HomAdd

section RelSum

variable {X Y : Type u}

/-- 定義 L.8e：関係の圏の `⊕` の上の写し。L.7 の双積 `X ⊕ X` への、両方の成分が恒等の関係である。 -/
def sumCopyRel (X : Type u) : SetRel X (X ⊕ X) :=
  sumLiftRel SetRel.id SetRel.id

/-- 定義 L.8e：関係の圏の `⊕` の上の畳み。L.7 の双積 `X ⊕ X` からの、両方の枝が恒等の関係である。 -/
def sumFoldRel (X : Type u) : SetRel (X ⊕ X) X :=
  sumDescRel SetRel.id SetRel.id

/-- 定義 L.8e：和の関係。左の側には `R` を、右の側には `S` を当て、側を変えない。 -/
def sumMapRel (R S : SetRel X Y) : SetRel (X ⊕ X) (Y ⊕ Y) :=
  sumDescRel (R ○ Function.graph Sum.inl) (S ○ Function.graph Sum.inr)

@[simp]
theorem mem_sumMapRel_inl_inl (R S : SetRel X Y) (x : X) (y : Y) :
    Sum.inl x ~[sumMapRel R S] Sum.inl y ↔ x ~[R] y := by
  simp [sumMapRel]

@[simp]
theorem mem_sumMapRel_inr_inr (R S : SetRel X Y) (x : X) (y : Y) :
    Sum.inr x ~[sumMapRel R S] Sum.inr y ↔ x ~[S] y := by
  simp [sumMapRel]

@[simp]
theorem not_mem_sumMapRel_inl_inr (R S : SetRel X Y) (x : X) (y : Y) :
    ¬ Sum.inl x ~[sumMapRel R S] Sum.inr y := by
  simp [sumMapRel]

@[simp]
theorem not_mem_sumMapRel_inr_inl (R S : SetRel X Y) (x : X) (y : Y) :
    ¬ Sum.inr x ~[sumMapRel R S] Sum.inl y := by
  simp [sumMapRel]

/-- 定理 L.8e（写しの対話）：どの関係 `R` についても、`R` のあとに写すのと、
写してから側ごとに `R` を当てるのは同じである。 -/
theorem sumCopyRel_natural (R : SetRel X Y) : R ○ sumCopyRel Y = sumCopyRel X ○ sumMapRel R R := by
  ext ⟨x, s⟩
  rcases s with y | y <;> simp [sumCopyRel]

/-- 定理 L.8e（畳みの対話）：どの関係 `R` についても、畳んでから `R` を当てるのと、
側ごとに `R` を当ててから畳むのは同じである。 -/
theorem sumFoldRel_natural (R : SetRel X Y) : sumFoldRel X ○ R = sumMapRel R R ○ sumFoldRel Y := by
  ext ⟨s, y⟩
  rcases s with x | x <;> simp [sumFoldRel]

/-- 定理 L.8e（射の足し算は和集合）：写しと畳みの間に2つの関係 `R`・`S` を並べると、和集合 `R ∪ S` になる。 -/
theorem sumCopy_map_fold (R S : SetRel X Y) :
    (sumCopyRel X ○ sumMapRel R S) ○ sumFoldRel Y = R ∪ S := by
  ext ⟨x, y⟩
  simp only [mem_comp, Set.mem_union]
  constructor
  · rintro ⟨t, ⟨s, hs, hst⟩, ht⟩
    rcases s with x' | x' <;> rcases t with y' | y' <;>
      simp_all [sumCopyRel, sumFoldRel]
  · rintro (h | h)
    · exact ⟨Sum.inl y, ⟨Sum.inl x, by simp [sumCopyRel], by simpa using h⟩, by simp [sumFoldRel]⟩
    · exact ⟨Sum.inr y, ⟨Sum.inr x, by simp [sumCopyRel], by simpa using h⟩, by simp [sumFoldRel]⟩

end RelSum

section Contrast

/-- 定理 L.8f（× と ⊕ の対比）：関係の圏で、`×` の写しと可換でない関係 `Bool → Bool` がある。
一方、`⊕` の写しは、`Bool → Bool` のどの関係とも可換である（L.8e の特別な場合）。 -/
theorem copy_prod_vs_sum :
    (∃ R : SetRel Bool Bool, R ○ copyRel Bool ≠ copyRel Bool ○ prodRel R R) ∧
      ∀ R : SetRel Bool Bool, R ○ sumCopyRel Bool = sumCopyRel Bool ○ sumMapRel R R := by
  refine ⟨⟨Set.univ, fun h => ?_⟩, sumCopyRel_natural⟩
  have := (copyRel_natural_iff (Set.univ : SetRel Bool Bool)).mp h true true false trivial trivial
  exact Bool.noConfusion this

end Contrast

end SignMath.Quantity
