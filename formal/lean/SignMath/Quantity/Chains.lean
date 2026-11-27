import SignMath.Quantity.Dialogue
import Mathlib.CategoryTheory.Limits.Shapes.Opposites.Products
import Mathlib.CategoryTheory.Limits.Shapes.BinaryBiproducts
import Mathlib.CategoryTheory.Monoidal.Closed.Zero
import Mathlib.Logic.Equiv.Prod

/-!
# L. 計算の量の像（その7：2本の鎖。分解の半分の2つの三角と、一意の半分）

2本の鎖は、次の2つである。
- 1本目：a ⇒ (a,a) ⇒ (a → a) ⇒ a
- 2本目：a ⇒ (a ← a) ⇒ (a,a) ⇒ a

1本目は、随伴 Δ ⊣ × の、対角の側の三角である。写し（Δ ⊣ × の単位）のあとに射影すると、元に戻る。
これは写しの余単位律でもあり、積の側（余代数）にある。
2本目は、1本目を後ろから読んで矢を向け替えた物で、随伴 + ⊣ Δ の、対角の側の三角である。
入口のあとに畳む（+ ⊣ Δ の余単位）と、元に戻る。これは畳みの単位律でもあり、余積の側（代数）にある。
真ん中の歩み（組と射の行き来）は転置である。
同じ組 `(id, id)` を出口の側に置くと写しになり、入口の側に置くと畳みになる。
転置は余単位を後ろに（余積では単位を前に）当てる操作なので、単位の転置がそのまま三角の合成になる。

随伴の射の集まりの全単射は、2つの向きの往復でできる。
- 分解が在る半分（組から射を作り、それを割ると組に戻る）は、対角の側の三角と、組へ割る射の自然性が言う。
  積（Δ ⊣ ×）では、1本目と射影（余単位）の自然性。余積（+ ⊣ Δ）では、2本目と入口（単位）の自然性。
- 一意の半分（射を組に割り、その組から射を作り直すと射に戻る）は、関手であることと、もう一方の三角と、
  組から射を作る側の自然性が言う。積では、`Δ ≫ (π₁ × π₂) = 𝟙`（もう一方の三角）と写し（単位）の自然性。
  余積では、入口の和のあとに畳むと恒等なことと、畳み（余単位）の自然性。
  一意の半分に入る自然性は、どちらも写しと畳みの自然性（L.8 の対話）である。
積の側でも余積の側でも、単位も余単位も自然で、対角の側の三角も立つのに、もう一方の三角が崩れて
一意が崩れる例がある。だから自然性だけでは、一意の半分は出ない。
型の上では、分解の半分の仮定（余単位の自然性と対角の側の三角）の下で、一意の半分はちょうど、射影がまとめて
点を分けることで、もう一方の三角はその帰結である。余積では、入口の自然性と2本目の三角の下で、一意の半分は
ちょうど、入口がまとめて全部の点を覆うことである。

2本の `(a,a)` は、1本目では積 `a ⨯ a` に、2本目では余積 `a ⨿ a` にある。
零射のある圏で、2つを入口と射影に揃えて同じ対象に置けるのは、余積から積への比べの射が同型な時である。
それはちょうど、双積がある時である。

このファイルは次を示す。
- 2本の律。写しの `op` は、反対圏の畳み（L.9a）。
- 型の上で、同じ組 `(id, id)` を2つの向きに転置すると、写しと畳み（L.9b）。
- 写しの自然性の四角は、恒等の射の所では両辺とも写し。2つの道に射影を足すと `f` に戻る（L.9c）。
- 型の上で、積と余積の、分解の半分と一意の半分の形。積の側と余積の側のそれぞれで、
  単位と余単位が自然で、対角の側の三角が立っても、もう一方の三角が崩れる例。積の側の例は射の集まりの
  全単射を持たない（だから随伴にならない、の最後の1歩は散文。L.9d）。
- 型の上で、分解の半分の仮定の下で、一意の半分 ⇔ 射影がまとめて点を分ける。点を分けるなら、もう一方の三角は
  帰結で、射の集まりの間に自然な全単射がある（逆向きは `1` からの射の所の単射で足りる）。余積では、
  一意の半分 ⇔ 入口がまとめて全部の点を覆う。`HalfG` の射影は点を分けず、`HalfH` の入口は覆わない（L.10）。
- 関係の圏の `×` で、写しと可換な関係は2つの射影で決まる。一価は写しとの可換から、残りは射影が点を分けること
  （`Prod.ext`）から出る。射影が点を分けない `HalfG` の2つの射影では、写しと可換なグラフでも決まらない。
  恒等の名前（対角）はどの関係とも滑るが、射影だけでは決まらない（L.9e）。
- 零射のある圏で、余積から積への比べの射が同型 ⇔ 双積（L.9f）。
- 関係の圏の `×` の上の写しと照合は、Frobenius の2つの律と双代数の中心の律を満たすが、
  双代数の単位と余単位の律が全部立つのは、ちょうど1点の型の時（L.9g）。
- 逆の関係は、`⊕` の上では写しを畳みに移す。`×` の上では、Bool で写しの逆が全域でない（L.9h）。
- デカルト閉で零射を持つ圏では、射の集まりがどれも1点（L.9i）。
-/

namespace SignMath.Quantity

universe v u

section Laws

open CategoryTheory Limits Opposite

variable {C : Type u} [Category.{v} C]

/-- 定理 L.9a（2本の律）：写してから射影すると恒等に戻る（写しの余単位律）。
入口から畳むと恒等に戻る（畳みの単位律）。 -/
theorem copy_counit_fold_unit (X : C) [HasBinaryProduct X X] [HasBinaryCoproduct X X] :
    (prod.lift (𝟙 X) (𝟙 X) ≫ prod.fst = 𝟙 X ∧ prod.lift (𝟙 X) (𝟙 X) ≫ prod.snd = 𝟙 X) ∧
      (coprod.inl ≫ coprod.desc (𝟙 X) (𝟙 X) = 𝟙 X ∧
        coprod.inr ≫ coprod.desc (𝟙 X) (𝟙 X) = 𝟙 X) := by
  simp

/-- 定理 L.9a（鏡）：写しの `op` は、反対圏の畳みである。 -/
theorem op_copy_is_fold (X : C) [HasBinaryProduct X X] :
    (opProdIsoCoprod X X).inv ≫ (prod.lift (𝟙 X) (𝟙 X)).op =
      coprod.desc (𝟙 (op X)) (𝟙 (op X)) := by
  apply coprod.hom_ext
  · rw [← Category.assoc, inl_opProdIsoCoprod_inv, ← op_comp, prod.lift_fst, op_id,
      coprod.inl_desc]
  · rw [← Category.assoc, inr_opProdIsoCoprod_inv, ← op_comp, prod.lift_snd, op_id,
      coprod.inr_desc]

/-- 定理 L.9c（四角は恒等の所で中身が無い）：写しの自然性の四角を恒等の射で取ると、
2つの道はどちらも写しそのものである。 -/
theorem copy_square_at_id (X : C) [HasBinaryProduct X X] :
    𝟙 X ≫ prod.lift (𝟙 X) (𝟙 X) = prod.lift (𝟙 X) (𝟙 X) ∧
      prod.lift (𝟙 X) (𝟙 X) ≫ prod.map (𝟙 X) (𝟙 X) = prod.lift (𝟙 X) (𝟙 X) := by
  simp

/-- 定理 L.9c（四角のあとに射影）：写しの自然性の四角の2つの道に、前の射影を足しても後ろの射影を足しても、
どちらも `f` に戻る。`f` が恒等の時、これは写しの余単位律。 -/
theorem copy_square_then_proj {X Y : C} [HasBinaryProduct X X] [HasBinaryProduct Y Y] (f : X ⟶ Y) :
    (f ≫ prod.lift (𝟙 Y) (𝟙 Y) ≫ prod.fst = f ∧
        prod.lift (𝟙 X) (𝟙 X) ≫ prod.map f f ≫ prod.fst = f) ∧
      (f ≫ prod.lift (𝟙 Y) (𝟙 Y) ≫ prod.snd = f ∧
        prod.lift (𝟙 X) (𝟙 X) ≫ prod.map f f ≫ prod.snd = f) := by
  simp

end Laws

/-- 定理 L.9b（転置）：型の上で、同じ組 `(id, id)` を積の側の全単射で戻すと写しになり、
余積の側の全単射で戻すと畳みになる。 -/
theorem same_pair_two_transposes (A : Type u) :
    (Equiv.arrowProdEquivProdArrow A (fun _ => A) (fun _ => A)).symm (id, id) =
        (fun a => (a, a)) ∧
      (Equiv.sumArrowEquivProdArrow A A A).symm (id, id) = Sum.elim id id :=
  ⟨rfl, rfl⟩

section HalfTriangle

/-- 定理 L.9d（分解が在る半分）：型の上の `G` で、余単位 `ε₁, ε₂` が自然で、対角の側の三角
（単位のあとに余単位で恒等）が立つなら、組 `(f, g)` から作った射 `G(f, g) ∘ η` を余単位で割ると、
`(f, g)` に戻る。 -/
theorem existence_half {G : Type → Type → Type}
    (map : ∀ {b b' c c' : Type}, (b → b') → (c → c') → G b c → G b' c')
    (η : ∀ x : Type, x → G x x) (ε₁ : ∀ {b c : Type}, G b c → b) (ε₂ : ∀ {b c : Type}, G b c → c)
    (hε : ∀ {b b' c c' : Type} (f : b → b') (g : c → c'),
      ε₁ ∘ map f g = f ∘ ε₁ ∧ ε₂ ∘ map f g = g ∘ ε₂)
    (tri : ∀ x : Type, ε₁ ∘ η x = id ∧ ε₂ ∘ η x = id)
    {x b c : Type} (f : x → b) (g : x → c) :
    ε₁ ∘ (map f g ∘ η x) = f ∧ ε₂ ∘ (map f g ∘ η x) = g := by
  constructor
  · funext a
    have h1 := congrFun (hε f g).1 (η x a)
    have h2 := congrFun (tri x).1 a
    exact h1.trans (congrArg f h2)
  · funext a
    have h1 := congrFun (hε f g).2 (η x a)
    have h2 := congrFun (tri x).2 a
    exact h1.trans (congrArg g h2)

/-- 定理 L.9d（一意の半分）：型の上の関手 `G` で、単位 `η` が自然で、もう一方の三角
（`G(ε₁, ε₂) ∘ η = id`）が立つなら、どの射 `h` も、余単位で割った組
`(ε₁ ∘ h, ε₂ ∘ h)` から作り直した射に等しい。 -/
theorem uniqueness_half {G : Type → Type → Type}
    (map : ∀ {b b' c c' : Type}, (b → b') → (c → c') → G b c → G b' c')
    (η : ∀ x : Type, x → G x x) (ε₁ : ∀ {b c : Type}, G b c → b) (ε₂ : ∀ {b c : Type}, G b c → c)
    (hmap : ∀ {b b' b'' c c' c'' : Type} (f : b → b') (f' : b' → b'') (g : c → c') (g' : c' → c''),
      map (f' ∘ f) (g' ∘ g) = map f' g' ∘ map f g)
    (hη : ∀ {x y : Type} (f : x → y), map f f ∘ η x = η y ∘ f)
    (tri' : ∀ b c : Type, map ε₁ ε₂ ∘ η (G b c) = id)
    {x b c : Type} (h : x → G b c) : map (ε₁ ∘ h) (ε₂ ∘ h) ∘ η x = h := by
  rw [hmap h ε₁ h ε₂]
  funext a
  have h1 : map h h (η x a) = η (G b c) (h a) := congrFun (hη h) a
  have h2 := congrFun (tri' b c) (h a)
  show map ε₁ ε₂ (map h h (η x a)) = h a
  rw [h1]
  exact h2

/-- 定理 L.9d（余積の分解が在る半分）：型の上の `H` で、入口 `ι₁, ι₂`（`+ ⊣ Δ` の単位の成分）が自然で、
対角の側の三角（入口のあとに畳む `ε` で恒等。2本目）が立つなら、組 `(f, g)` から作った射 `ε ∘ H(f, g)` を
入口で割ると、`(f, g)` に戻る。 -/
theorem coprod_existence_half {H : Type → Type → Type}
    (map : ∀ {b b' c c' : Type}, (b → b') → (c → c') → H b c → H b' c')
    (ι₁ : ∀ {b c : Type}, b → H b c) (ι₂ : ∀ {b c : Type}, c → H b c) (ε : ∀ x : Type, H x x → x)
    (hι : ∀ {b b' c c' : Type} (f : b → b') (g : c → c'),
      map f g ∘ ι₁ = ι₁ ∘ f ∧ map f g ∘ ι₂ = ι₂ ∘ g)
    (tri : ∀ x : Type, ε x ∘ ι₁ = id ∧ ε x ∘ ι₂ = id)
    {x b c : Type} (f : b → x) (g : c → x) :
    (ε x ∘ map f g) ∘ ι₁ = f ∧ (ε x ∘ map f g) ∘ ι₂ = g := by
  constructor
  · funext a
    have h1 := congrFun (hι f g).1 a
    have h2 := congrFun (tri x).1 (f a)
    show ε x (map f g (ι₁ a)) = f a
    rw [show map f g (ι₁ a) = ι₁ (f a) from h1]
    exact h2
  · funext a
    have h1 := congrFun (hι f g).2 a
    have h2 := congrFun (tri x).2 (g a)
    show ε x (map f g (ι₂ a)) = g a
    rw [show map f g (ι₂ a) = ι₂ (g a) from h1]
    exact h2

/-- 定理 L.9d（余積の一意の半分）：型の上の関手 `H` で、畳み `ε`（`+ ⊣ Δ` の余単位）が自然で、
`+` の側の三角（入口の和のあとに畳むと恒等）が立つなら、どの射 `k` も、入口で割った組
`(k ∘ ι₁, k ∘ ι₂)` から作り直した射に等しい。 -/
theorem coprod_uniqueness_half {H : Type → Type → Type}
    (map : ∀ {b b' c c' : Type}, (b → b') → (c → c') → H b c → H b' c')
    (ι₁ : ∀ {b c : Type}, b → H b c) (ι₂ : ∀ {b c : Type}, c → H b c) (ε : ∀ x : Type, H x x → x)
    (hmap : ∀ {b b' b'' c c' c'' : Type} (f : b → b') (f' : b' → b'') (g : c → c') (g' : c' → c''),
      map (f' ∘ f) (g' ∘ g) = map f' g' ∘ map f g)
    (hε : ∀ {x y : Type} (f : x → y), f ∘ ε x = ε y ∘ map f f)
    (tri' : ∀ b c : Type, ε (H b c) ∘ map (ι₁ (c := c)) (ι₂ (b := b)) = id)
    {x b c : Type} (k : H b c → x) : ε x ∘ map (k ∘ ι₁) (k ∘ ι₂) = k := by
  rw [hmap ι₁ k ι₂ k]
  funext s
  have h1 := congrFun (hε k) (map (ι₁ (c := c)) (ι₂ (b := b)) s)
  have h2 := congrFun (tri' b c) s
  show ε x (map k k (map ι₁ ι₂ s)) = k s
  exact h1.symm.trans (congrArg k h2)

/-- 定理 L.9d（型の和は、余積の2つの半分の仮定を満たす）：畳みのあとの和の射を入口で割ると組に戻り、
どの射も、入口で割った組から作り直した射に等しい。 -/
theorem sum_two_halves {x b c : Type} (f : b → x) (g : c → x) (k : b ⊕ c → x) :
    ((Sum.elim id id ∘ Sum.map f g) ∘ Sum.inl = f ∧ (Sum.elim id id ∘ Sum.map f g) ∘ Sum.inr = g) ∧
      Sum.elim id id ∘ Sum.map (k ∘ Sum.inl) (k ∘ Sum.inr) = k := by
  refine ⟨coprod_existence_half Sum.map Sum.inl Sum.inr (fun x => Sum.elim id id)
      (fun _ _ => ⟨rfl, rfl⟩) (fun _ => ⟨rfl, rfl⟩) f g,
    coprod_uniqueness_half Sum.map Sum.inl Sum.inr (fun x => Sum.elim id id)
      (fun f f' g g' => by funext s; cases s <;> rfl)
      (fun f => by funext s; cases s <;> rfl)
      (fun _ _ => by funext s; cases s <;> rfl) k⟩

/-- 定義 L.9d：組と印の型 `G b c = b × c × Bool`。 -/
abbrev HalfG (b c : Type) : Type := b × c × Bool

/-- 定義 L.9d：`HalfG` の射。印はそのまま。 -/
def halfGMap {b b' c c' : Type} (f : b → b') (g : c → c') : HalfG b c → HalfG b' c' :=
  fun p => (f p.1, g p.2.1, p.2.2)

/-- 定理 L.9d（`HalfG` は関手）：恒等を保つ。 -/
theorem halfGMap_id {b c : Type} : halfGMap (id : b → b) (id : c → c) = id :=
  rfl

/-- 定理 L.9d（`HalfG` は関手）：射の合成を保つ。 -/
theorem halfGMap_comp {b b' b'' c c' c'' : Type} (f : b → b') (f' : b' → b'') (g : c → c')
    (g' : c' → c'') : halfGMap (f' ∘ f) (g' ∘ g) = halfGMap f' g' ∘ halfGMap f g :=
  rfl

/-- 定義 L.9d：単位の候補。点 `a` を `(a, a, false)` へ送る。 -/
def halfUnit (x : Type) : x → HalfG x x := fun a => (a, a, false)

/-- 定義 L.9d：余単位の候補の左。 -/
def halfFst {b c : Type} : HalfG b c → b := fun p => p.1

/-- 定義 L.9d：余単位の候補の右。 -/
def halfSnd {b c : Type} : HalfG b c → c := fun p => p.2.1

/-- 定義 L.9d：転置の候補。組 `(g₁, g₂)` を `HalfG(g₁, g₂) ∘ 単位` へ送る。 -/
def halfTranspose {x b c : Type} (g : (x → b) × (x → c)) : x → HalfG b c :=
  halfGMap g.1 g.2 ∘ halfUnit x

/-- 定義 L.9d：逆の転置の候補。`h` を `(左 ∘ h, 右 ∘ h)` へ送る。 -/
def halfUntranspose {x b c : Type} (h : x → HalfG b c) : (x → b) × (x → c) :=
  (halfFst ∘ h, halfSnd ∘ h)

/-- 定理 L.9d（単位は自然）。 -/
theorem halfUnit_natural {x y : Type} (f : x → y) : halfGMap f f ∘ halfUnit x = halfUnit y ∘ f :=
  rfl

/-- 定理 L.9d（余単位は自然）。 -/
theorem halfCounit_natural {b b' c c' : Type} (f : b → b') (g : c → c') :
    halfFst ∘ halfGMap f g = f ∘ halfFst ∧ halfSnd ∘ halfGMap f g = g ∘ halfSnd :=
  ⟨rfl, rfl⟩

/-- 定理 L.9d（1つの点での往復は恒等）：写してから射影すると、元に戻る。 -/
theorem half_round_trip (x : Type) : halfFst ∘ halfUnit x = id ∧ halfSnd ∘ halfUnit x = id :=
  ⟨rfl, rfl⟩

/-- 定理 L.9d（分解が在る半分は立つ）：転置してから戻すと、元の組に戻る。
`existence_half` の仮定（余単位の自然性と、対角の側の三角）を `HalfG` は満たす。 -/
theorem half_untranspose_transpose {x b c : Type} (g : (x → b) × (x → c)) :
    halfUntranspose (halfTranspose g) = g :=
  Prod.ext
    (existence_half halfGMap halfUnit halfFst halfSnd halfCounit_natural half_round_trip g.1 g.2).1
    (existence_half halfGMap halfUnit halfFst halfSnd halfCounit_natural half_round_trip g.1 g.2).2

/-- 定理 L.9d（もう一方の三角は崩れる）：`HalfG(左, 右) ∘ 単位` は恒等でない。
`HalfG` は関手で（`halfGMap_id`・`halfGMap_comp`）、単位は自然なので（`halfUnit_natural`）、
`uniqueness_half` の仮定のうち欠けるのは、この三角だけ。 -/
theorem half_other_triangle_fails : halfGMap halfFst halfSnd ∘ halfUnit (HalfG PUnit PUnit) ≠ id := by
  intro h
  have := congrFun h (PUnit.unit, PUnit.unit, true)
  simp [halfGMap, halfUnit, halfFst, halfSnd] at this

/-- 定理 L.9d（一意の半分が無い）：射影が同じで、違う2つの射がある。 -/
theorem half_uniqueness_fails :
    ∃ h h' : PUnit → HalfG PUnit PUnit, halfUntranspose h = halfUntranspose h' ∧ h ≠ h' := by
  refine ⟨fun _ => (PUnit.unit, PUnit.unit, false), fun _ => (PUnit.unit, PUnit.unit, true), rfl, ?_⟩
  intro h
  have := congrFun h PUnit.unit
  simp at this

/-- 定理 L.9d（射の集まりの全単射が無い）：`1` から `HalfG 1 1` への射の集まりと、`1` から `1` への射の組の
間には、全単射が無い。随伴なら、この全単射があるので、どんな単位と余単位を選んでも、`HalfG` は対角の
右随伴にならない（この最後の1歩は、`Adjunction` を立てずに言っている）。 -/
theorem half_no_hom_bijection :
    ¬ Nonempty ((PUnit.{1} → HalfG PUnit PUnit) ≃ (PUnit.{1} → PUnit.{1}) × (PUnit.{1} → PUnit.{1})) := by
  rintro ⟨e⟩
  let h₀ : PUnit → HalfG PUnit PUnit := fun _ => (PUnit.unit, PUnit.unit, false)
  let h₁ : PUnit → HalfG PUnit PUnit := fun _ => (PUnit.unit, PUnit.unit, true)
  have h : h₀ = h₁ := e.injective (Subsingleton.elim (e h₀) (e h₁))
  exact Bool.false_ne_true (congrArg (fun p : HalfG PUnit PUnit => p.2.2) (congrFun h PUnit.unit))

/-- 定義 L.9d：余積の側の例の型 `H b c = Bool × (b ⊕ c)`。 -/
abbrev HalfH (b c : Type) : Type := Bool × (b ⊕ c)

/-- 定義 L.9d：`HalfH` の射。印はそのまま。 -/
def halfHMap {b b' c c' : Type} (f : b → b') (g : c → c') : HalfH b c → HalfH b' c' :=
  fun p => (p.1, Sum.map f g p.2)

/-- 定義 L.9d：左の入口の候補。印は `false`。 -/
def halfInl {b c : Type} : b → HalfH b c := fun a => (false, Sum.inl a)

/-- 定義 L.9d：右の入口の候補。印は `false`。 -/
def halfInr {b c : Type} : c → HalfH b c := fun a => (false, Sum.inr a)

/-- 定義 L.9d：畳みの候補。印を捨てて畳む。 -/
def halfFold (x : Type) : HalfH x x → x := fun p => Sum.elim id id p.2

/-- 定理 L.9d（`HalfH` は関手）：恒等と合成を保つ。 -/
theorem halfHMap_id_comp {b b' b'' c c' c'' : Type} (f : b → b') (f' : b' → b'') (g : c → c')
    (g' : c' → c'') :
    halfHMap (id : b → b) (id : c → c) = id ∧
      halfHMap (f' ∘ f) (g' ∘ g) = halfHMap f' g' ∘ halfHMap f g := by
  constructor <;> (funext p; rcases p with ⟨t, s⟩; cases s <;> rfl)

/-- 定理 L.9d（入口は自然）。 -/
theorem halfInj_natural {b b' c c' : Type} (f : b → b') (g : c → c') :
    halfHMap f g ∘ halfInl = halfInl ∘ f ∧ halfHMap f g ∘ halfInr = halfInr ∘ g :=
  ⟨rfl, rfl⟩

/-- 定理 L.9d（畳みは自然）。 -/
theorem halfFold_natural {x y : Type} (f : x → y) : f ∘ halfFold x = halfFold y ∘ halfHMap f f := by
  funext p; rcases p with ⟨t, s⟩; cases s <;> rfl

/-- 定理 L.9d（対角の側の三角は立つ）：入口のあとに畳むと恒等。 -/
theorem half_fold_round_trip (x : Type) : halfFold x ∘ halfInl = id ∧ halfFold x ∘ halfInr = id :=
  ⟨rfl, rfl⟩

/-- 定理 L.9d（余積の分解が在る半分は立つ）：`coprod_existence_half` の仮定を `HalfH` は満たす。 -/
theorem half_coprod_existence {x b c : Type} (f : b → x) (g : c → x) :
    (halfFold x ∘ halfHMap f g) ∘ halfInl = f ∧ (halfFold x ∘ halfHMap f g) ∘ halfInr = g :=
  coprod_existence_half halfHMap halfInl halfInr halfFold halfInj_natural half_fold_round_trip f g

/-- 定理 L.9d（`+` の側の三角は崩れる）：入口の和のあとに畳むのは恒等でない。
`HalfH` は関手で、畳みは自然なので、`coprod_uniqueness_half` の仮定のうち欠けるのは、この三角だけ。 -/
theorem half_coprod_other_triangle_fails :
    halfFold (HalfH PUnit PUnit) ∘ halfHMap (halfInl (c := PUnit)) (halfInr (b := PUnit)) ≠ id := by
  intro h
  have := congrFun h (true, Sum.inl PUnit.unit)
  simp [halfFold, halfHMap, halfInl] at this

/-- 定理 L.9d（余積の一意の半分が無い）：入口で割った組が同じで、違う2つの射がある。 -/
theorem half_coprod_uniqueness_fails :
    ∃ k k' : HalfH PUnit PUnit → Bool, k ∘ halfInl = k' ∘ halfInl ∧ k ∘ halfInr = k' ∘ halfInr ∧ k ≠ k' := by
  refine ⟨fun p => p.1, fun _ => false, rfl, rfl, ?_⟩
  intro h
  have := congrFun h (true, Sum.inl PUnit.unit)
  simp at this

end HalfTriangle

section Separation

/-- 定理 L.10a（一意の半分と、点を分けること）：型の上の `G` で、余単位 `ε₁, ε₂` が自然で、対角の側の三角
（単位のあとに余単位で恒等）が立つなら、一意の半分（どの射 `h` も、余単位で割った組から作り直した射に等しい）と、
射影がまとめて点を分けること（射影が同じ2点は等しい）は同値。関手であること・単位の自然性・もう一方の三角は、
仮定に無い。 -/
theorem uniqueness_half_iff_separating {G : Type → Type → Type}
    (map : ∀ {b b' c c' : Type}, (b → b') → (c → c') → G b c → G b' c')
    (η : ∀ x : Type, x → G x x) (ε₁ : ∀ {b c : Type}, G b c → b) (ε₂ : ∀ {b c : Type}, G b c → c)
    (hε : ∀ {b b' c c' : Type} (f : b → b') (g : c → c'),
      ε₁ ∘ map f g = f ∘ ε₁ ∧ ε₂ ∘ map f g = g ∘ ε₂)
    (tri : ∀ x : Type, ε₁ ∘ η x = id ∧ ε₂ ∘ η x = id) :
    (∀ {x b c : Type} (h : x → G b c), map (ε₁ ∘ h) (ε₂ ∘ h) ∘ η x = h) ↔
    (∀ {b c : Type} (p q : G b c), ε₁ p = ε₁ q → ε₂ p = ε₂ q → p = q) := by
  constructor
  · intro hu b c p q h1 h2
    have hp := congrFun (hu (x := PUnit) (fun _ => p)) PUnit.unit
    have hq := congrFun (hu (x := PUnit) (fun _ => q)) PUnit.unit
    have e1 : (ε₁ ∘ fun _ : PUnit => p) = (ε₁ ∘ fun _ : PUnit => q) := funext fun _ => h1
    have e2 : (ε₂ ∘ fun _ : PUnit => p) = (ε₂ ∘ fun _ : PUnit => q) := funext fun _ => h2
    rw [e1, e2] at hp
    exact hp.symm.trans hq
  · intro hs x b c h
    funext a
    obtain ⟨e1, e2⟩ := existence_half map η ε₁ ε₂ hε tri (ε₁ ∘ h) (ε₂ ∘ h)
    exact hs _ _ (congrFun e1 a) (congrFun e2 a)

/-- 定理 L.10b（もう一方の三角は帰結）：`uniqueness_half_iff_separating` と同じ仮定で、射影がまとめて点を
分けるなら、もう一方の三角 `G(ε₁, ε₂) ∘ η = id` が立つ。使うのは、余単位の自然性と対角の側の三角だけ。 -/
theorem other_triangle_of_separating {G : Type → Type → Type}
    (map : ∀ {b b' c c' : Type}, (b → b') → (c → c') → G b c → G b' c')
    (η : ∀ x : Type, x → G x x) (ε₁ : ∀ {b c : Type}, G b c → b) (ε₂ : ∀ {b c : Type}, G b c → c)
    (hε : ∀ {b b' c c' : Type} (f : b → b') (g : c → c'),
      ε₁ ∘ map f g = f ∘ ε₁ ∧ ε₂ ∘ map f g = g ∘ ε₂)
    (tri : ∀ x : Type, ε₁ ∘ η x = id ∧ ε₂ ∘ η x = id)
    (hs : ∀ {b c : Type} (p q : G b c), ε₁ p = ε₁ q → ε₂ p = ε₂ q → p = q) :
    ∀ b c : Type, map ε₁ ε₂ ∘ η (G b c) = id := by
  intro b c
  funext p
  apply hs
  · have h1 := congrFun (hε (ε₁ (b := b) (c := c)) (ε₂ (b := b) (c := c))).1 (η (G b c) p)
    have h2 := congrFun (tri (G b c)).1 p
    exact h1.trans (congrArg ε₁ h2)
  · have h1 := congrFun (hε (ε₁ (b := b) (c := c)) (ε₂ (b := b) (c := c))).2 (η (G b c) p)
    have h2 := congrFun (tri (G b c)).2 p
    exact h1.trans (congrArg ε₂ h2)

/-- 定義 L.10c：`uniqueness_half_iff_separating` と同じ仮定で、射影がまとめて点を分けるなら、
`(x → G b c) ≃ (x → b) × (x → c)`。向きの一方は射影で割る写像、もう一方は `G(f, g) ∘ η`。 -/
def homEquiv_of_separating {G : Type → Type → Type}
    (map : ∀ {b b' c c' : Type}, (b → b') → (c → c') → G b c → G b' c')
    (η : ∀ x : Type, x → G x x) (ε₁ : ∀ {b c : Type}, G b c → b) (ε₂ : ∀ {b c : Type}, G b c → c)
    (hε : ∀ {b b' c c' : Type} (f : b → b') (g : c → c'),
      ε₁ ∘ map f g = f ∘ ε₁ ∧ ε₂ ∘ map f g = g ∘ ε₂)
    (tri : ∀ x : Type, ε₁ ∘ η x = id ∧ ε₂ ∘ η x = id)
    (hs : ∀ {b c : Type} (p q : G b c), ε₁ p = ε₁ q → ε₂ p = ε₂ q → p = q) (x b c : Type) :
    (x → G b c) ≃ (x → b) × (x → c) where
  toFun h := (ε₁ ∘ h, ε₂ ∘ h)
  invFun fg := map fg.1 fg.2 ∘ η x
  left_inv h := (uniqueness_half_iff_separating map η ε₁ ε₂ hε tri).mpr hs h
  right_inv fg := Prod.ext (existence_half map η ε₁ ε₂ hε tri fg.1 fg.2).1
                            (existence_half map η ε₁ ε₂ hε tri fg.1 fg.2).2

/-- 定理 L.10c（射の集まりの自然な全単射）：同じ仮定で、射影がまとめて点を分けるなら、全単射が在り、
その向きの一方は射影で割る写像である。その写像は `x` について自然で（前に `u : y → x` を当てると、
両側で前に当たる。定義から）、`b, c` について自然（後ろに `G(f, g)` を当てると、組の成分の後ろに
`f, g` が当たる。余単位の自然性から）。 -/
theorem hom_bijection_of_separating {G : Type → Type → Type}
    (map : ∀ {b b' c c' : Type}, (b → b') → (c → c') → G b c → G b' c')
    (η : ∀ x : Type, x → G x x) (ε₁ : ∀ {b c : Type}, G b c → b) (ε₂ : ∀ {b c : Type}, G b c → c)
    (hε : ∀ {b b' c c' : Type} (f : b → b') (g : c → c'),
      ε₁ ∘ map f g = f ∘ ε₁ ∧ ε₂ ∘ map f g = g ∘ ε₂)
    (tri : ∀ x : Type, ε₁ ∘ η x = id ∧ ε₂ ∘ η x = id)
    (hs : ∀ {b c : Type} (p q : G b c), ε₁ p = ε₁ q → ε₂ p = ε₂ q → p = q) (x b c : Type) :
    ∃ e : (x → G b c) ≃ (x → b) × (x → c),
      (∀ h, e h = (ε₁ ∘ h, ε₂ ∘ h)) ∧
      (∀ {y : Type} (u : y → x) (h : x → G b c), (ε₁ ∘ (h ∘ u), ε₂ ∘ (h ∘ u)) =
        ((e h).1 ∘ u, (e h).2 ∘ u)) ∧
      (∀ {b' c' : Type} (f : b → b') (g : c → c') (h : x → G b c),
        (ε₁ ∘ (map f g ∘ h), ε₂ ∘ (map f g ∘ h)) = (f ∘ (e h).1, g ∘ (e h).2)) :=
  ⟨homEquiv_of_separating map η ε₁ ε₂ hε tri hs x b c, fun _ => rfl, fun _ _ => rfl,
    fun f g h => Prod.ext (funext fun a => congrFun (hε f g).1 (h a))
      (funext fun a => congrFun (hε f g).2 (h a))⟩

/-- 定理 L.10c（逆向き）：`1` からの射の所で、射影で割る写像が単射なら、射影はまとめて点を分ける。 -/
theorem separating_of_proj_injective {G : Type → Type → Type}
    (ε₁ : ∀ {b c : Type}, G b c → b) (ε₂ : ∀ {b c : Type}, G b c → c)
    (hi : ∀ {b c : Type}, Function.Injective (fun h : PUnit.{1} → G b c => (ε₁ ∘ h, ε₂ ∘ h))) :
    ∀ {b c : Type} (p q : G b c), ε₁ p = ε₁ q → ε₂ p = ε₂ q → p = q := by
  intro b c p q h1 h2
  have := hi (b := b) (c := c) (a₁ := fun _ => p) (a₂ := fun _ => q)
    (Prod.ext (funext fun _ => h1) (funext fun _ => h2))
  exact congrFun this PUnit.unit

/-- 定理 L.10d（余積の一意の半分と、覆うこと）：型の上の `H` で、入口 `ι₁, ι₂` が自然で、対角の側の三角
（入口のあとに畳むと恒等。2本目）が立つなら、一意の半分（どの射 `k` も、入口で割った組から作り直した射に
等しい）と、入口がまとめて全部の点を覆うこと（どの点も、どちらかの入口の像）は同値。関手であること・
畳みの自然性・`+` の側の三角は、仮定に無い。⇒ は試しの対象を `Prop` に取る。 -/
theorem coprod_uniqueness_half_iff_covering {H : Type → Type → Type}
    (map : ∀ {b b' c c' : Type}, (b → b') → (c → c') → H b c → H b' c')
    (ι₁ : ∀ {b c : Type}, b → H b c) (ι₂ : ∀ {b c : Type}, c → H b c) (ε : ∀ x : Type, H x x → x)
    (hι : ∀ {b b' c c' : Type} (f : b → b') (g : c → c'),
      map f g ∘ ι₁ = ι₁ ∘ f ∧ map f g ∘ ι₂ = ι₂ ∘ g)
    (tri : ∀ x : Type, ε x ∘ ι₁ = id ∧ ε x ∘ ι₂ = id) :
    (∀ {x b c : Type} (k : H b c → x), ε x ∘ map (k ∘ ι₁) (k ∘ ι₂) = k) ↔
    (∀ {b c : Type} (s : H b c), (∃ a, s = ι₁ a) ∨ (∃ c', s = ι₂ c')) := by
  constructor
  · intro hu b c s
    let k : H b c → Prop := fun s => (∃ a, s = ι₁ a) ∨ (∃ c', s = ι₂ c')
    let k' : H b c → Prop := fun _ => True
    have e1 : k ∘ ι₁ = k' ∘ ι₁ :=
      funext fun a => propext ⟨fun _ => trivial, fun _ => Or.inl ⟨a, rfl⟩⟩
    have e2 : k ∘ ι₂ = k' ∘ ι₂ :=
      funext fun a => propext ⟨fun _ => trivial, fun _ => Or.inr ⟨a, rfl⟩⟩
    have hk := hu (x := Prop) k
    have hk' := hu (x := Prop) k'
    rw [e1, e2] at hk
    have : k = k' := hk.symm.trans hk'
    have hs : k s = k' s := congrFun this s
    exact cast hs.symm trivial
  · intro hc x b c k
    funext s
    obtain ⟨e1, e2⟩ := coprod_existence_half map ι₁ ι₂ ε hι tri (k ∘ ι₁) (k ∘ ι₂)
    rcases hc s with ⟨a, rfl⟩ | ⟨a, rfl⟩
    · exact congrFun e1 a
    · exact congrFun e2 a

/-- 定理 L.10e（`HalfG` の射影は点を分けない）：印だけが違う2点は、射影が同じ。 -/
theorem halfG_not_separating :
    ¬ (∀ {b c : Type} (p q : HalfG b c), halfFst p = halfFst q → halfSnd p = halfSnd q → p = q) :=
  fun hs => by
    have := hs (b := PUnit) (c := PUnit) (PUnit.unit, PUnit.unit, false) (PUnit.unit, PUnit.unit, true)
      rfl rfl
    simp at this

/-- 定理 L.10e（`HalfH` の入口は覆わない）：印が `true` の点は、どちらの入口の像でもない。 -/
theorem halfH_not_covering :
    ¬ (∀ {b c : Type} (s : HalfH b c), (∃ a, s = halfInl a) ∨ (∃ c', s = halfInr c')) :=
  fun hc => by
    rcases hc (b := PUnit) (c := PUnit) (true, Sum.inl PUnit.unit) with ⟨a, h⟩ | ⟨a, h⟩
    · simp [halfInl] at h
    · simp [halfInr] at h

end Separation

section Uniqueness

open SetRel

variable {A B X : Type u}

/-- 定義 L.9e：恒等の名前（対角）。1点から、`(a, a)` の形の組の全部へ行く関係。 -/
def cupRel (A : Type u) : SetRel PUnit.{u+1} (A × A) := {p | p.2.1 = p.2.2}

/-- 定義 L.9e：関係 `R` の名前。1点から、`R` で結ばれた組の全部へ行く関係。 -/
def nameRel (R : SetRel A B) : SetRel PUnit.{u+1} (A × B) := {p | p.2.1 ~[R] p.2.2}

/-- 定理 L.9e（対角は右の成分で滑る）：対角のあとに、右の成分へ `R` を当てると、`R` の名前になる。 -/
theorem cup_slide_snd (R : SetRel A B) : cupRel A ○ prodRel SetRel.id R = nameRel R := by
  ext ⟨w, x, y⟩
  constructor
  · rintro ⟨p, hp, h1, h2⟩
    have hp' : p.1 = p.2 := hp
    have h1' : p.1 = x := h1
    show x ~[R] y
    rw [← h1', hp']
    exact h2
  · intro h
    exact ⟨(x, x), rfl, rfl, h⟩

/-- 定理 L.9e（対角は左の成分では逆で滑る）：対角のあとに、左の成分へ `R` の逆を当てても、`R` の名前になる。 -/
theorem cup_slide_fst_inv (R : SetRel A B) : cupRel B ○ prodRel R.inv SetRel.id = nameRel R := by
  ext ⟨w, x, y⟩
  constructor
  · rintro ⟨p, hp, h1, h2⟩
    have h1' : x ~[R] p.1 := h1
    have hp' : p.1 = p.2 := hp
    have h2' : p.2 = y := h2
    show x ~[R] y
    rw [hp', h2'] at h1'
    exact h1'
  · intro h
    exact ⟨(y, y), rfl, h, rfl⟩

/-- 定理 L.9e（対角は、捨ての逆のあとの写し）。 -/
theorem cup_eq_unit_copy : cupRel A = (discardRel A).inv ○ copyRel A := by
  ext ⟨w, x, y⟩
  constructor
  · intro h
    have h' : x = y := h
    subst h'
    exact ⟨x, rfl, rfl⟩
  · rintro ⟨z, -, hz⟩
    have hz' : (z, z) = (x, y) := hz
    simp only [Prod.mk.injEq] at hz'
    show x = y
    rw [← hz'.1, ← hz'.2]

/-- 定理 L.9e（逆と入れ替え）：`R` の逆の名前は、`R` の名前の組を入れ替えた物。
対角は、入れ替えで動かない。 -/
theorem name_inv_and_cup_swap (R : SetRel A B) :
    nameRel R.inv = nameRel R ○ Function.graph Prod.swap ∧
      cupRel A ○ Function.graph Prod.swap = cupRel A := by
  constructor
  · ext ⟨w, y, x⟩
    constructor
    · intro h
      exact ⟨(x, y), h, rfl⟩
    · rintro ⟨p, hp, hs⟩
      have e1 : p.2 = y := congrArg Prod.fst (hs : p.swap = (y, x))
      have e2 : p.1 = x := congrArg Prod.snd (hs : p.swap = (y, x))
      show x ~[R] y
      rw [← e1, ← e2]
      exact hp
  · ext ⟨w, x, y⟩
    constructor
    · rintro ⟨p, hp, hs⟩
      have e1 : p.2 = x := congrArg Prod.fst (hs : p.swap = (x, y))
      have e2 : p.1 = y := congrArg Prod.snd (hs : p.swap = (x, y))
      have hp' : p.1 = p.2 := hp
      show x = y
      rw [← e1, ← e2]
      exact hp'.symm
    · intro h
      have h' : x = y := h
      subst h'
      exact ⟨(x, x), rfl, rfl⟩

/-- 定理 L.9e（関係の圏の一意の半分）：写しと可換な関係 `R : X → A × B` は、
写してから、成分ごとに `R` と射影を当てた物に等しい。つまり2つの射影で決まる。
写しとの可換から出るのは `R` が一価なこと（L.8c）で、残りは射影が点を分けること（`Prod.ext`）から出る。 -/
theorem copy_natural_determined_by_projections (R : SetRel X (A × B))
    (hR : R ○ copyRel (A × B) = copyRel X ○ prodRel R R) :
    R = copyRel X ○ prodRel (R ○ Function.graph Prod.fst) (R ○ Function.graph Prod.snd) := by
  have hsv := (copyRel_natural_iff R).mp hR
  ext ⟨x, q⟩
  constructor
  · intro h
    exact ⟨(x, x), rfl, ⟨q, h, rfl⟩, ⟨q, h, rfl⟩⟩
  · rintro ⟨p, hp, ⟨b, hb, hb1⟩, ⟨c, hc, hc2⟩⟩
    have hp' : (x, x) = p := hp
    subst hp'
    have hbc : b = c := hsv x b c hb hc
    subst hbc
    have hq : b = q := Prod.ext hb1 hc2
    exact hq ▸ hb

/-- 定理 L.9e（写しとの可換だけでは決まらない）：`1` から `HalfG 1 1` への2つの関数のグラフは、
どちらも写しと可換で、`halfFst`・`halfSnd` での射影も同じなのに、違う。`HalfG` の射影は点を分けない（L.10e）。 -/
theorem half_copy_natural_same_projections :
    let h₀ : PUnit.{1} → HalfG PUnit PUnit := fun _ => (PUnit.unit, PUnit.unit, false)
    let h₁ : PUnit.{1} → HalfG PUnit PUnit := fun _ => (PUnit.unit, PUnit.unit, true)
    (Function.graph h₀ ○ copyRel _ = copyRel _ ○ prodRel (Function.graph h₀) (Function.graph h₀)) ∧
    (Function.graph h₁ ○ copyRel _ = copyRel _ ○ prodRel (Function.graph h₁) (Function.graph h₁)) ∧
    Function.graph h₀ ○ Function.graph halfFst = Function.graph h₁ ○ Function.graph halfFst ∧
    Function.graph h₀ ○ Function.graph halfSnd = Function.graph h₁ ○ Function.graph halfSnd ∧
    Function.graph h₀ ≠ Function.graph h₁ := by
  intro h₀ h₁
  refine ⟨(copyRel_natural_iff _).mpr ?_, (copyRel_natural_iff _).mpr ?_, ?_, ?_, ?_⟩
  · intro a b b' hb hb'
    exact (show h₀ a = b from hb).symm.trans hb'
  · intro a b b' hb hb'
    exact (show h₁ a = b from hb).symm.trans hb'
  · ext ⟨w, z⟩; simp [h₀, h₁, halfFst]
  · ext ⟨w, z⟩; simp [h₀, h₁, halfSnd]
  · intro h
    have hm : (PUnit.unit, h₀ PUnit.unit) ∈ Function.graph h₁ := by rw [← h]; rfl
    have : h₁ PUnit.unit = h₀ PUnit.unit := hm
    simp [h₀, h₁] at this

/-- 定理 L.9e（滑りだけでは一意が出ない）：対角と全体の関係は、射影が同じで、違う。 -/
theorem cup_univ_same_projections :
    cupRel Bool ○ Function.graph Prod.fst =
        (Set.univ : SetRel PUnit.{1} (Bool × Bool)) ○ Function.graph Prod.fst ∧
      cupRel Bool ○ Function.graph Prod.snd =
        (Set.univ : SetRel PUnit.{1} (Bool × Bool)) ○ Function.graph Prod.snd ∧
      cupRel Bool ≠ Set.univ := by
  refine ⟨?_, ?_, ?_⟩
  · ext ⟨w, b⟩
    exact ⟨fun _ => ⟨(b, b), trivial, rfl⟩, fun _ => ⟨(b, b), rfl, rfl⟩⟩
  · ext ⟨w, b⟩
    exact ⟨fun _ => ⟨(b, b), trivial, rfl⟩, fun _ => ⟨(b, b), rfl, rfl⟩⟩
  · intro h
    have hm : (PUnit.unit, (true, false)) ∈ cupRel Bool := by rw [h]; trivial
    exact Bool.noConfusion (hm : true = false)

end Uniqueness

section Comparison

open CategoryTheory Limits

variable {C : Type u} [Category.{v} C] [HasZeroMorphisms C]

/-- 定義 L.9f：余積から積への比べの射。左の入口は `(𝟙, 0)` へ、右の入口は `(0, 𝟙)` へ行く。 -/
noncomputable def coprodToProd (X Y : C) [HasBinaryProduct X Y] [HasBinaryCoproduct X Y] :
    X ⨿ Y ⟶ X ⨯ Y :=
  coprod.desc (prod.lift (𝟙 X) 0) (prod.lift 0 (𝟙 Y))

theorem inl_coprodToProd (X Y : C) [HasBinaryProduct X Y] [HasBinaryCoproduct X Y] :
    coprod.inl ≫ coprodToProd X Y = prod.lift (𝟙 X) 0 := by
  simp [coprodToProd]

theorem inr_coprodToProd (X Y : C) [HasBinaryProduct X Y] [HasBinaryCoproduct X Y] :
    coprod.inr ≫ coprodToProd X Y = prod.lift 0 (𝟙 Y) := by
  simp [coprodToProd]

section
variable (X Y : C) [HasBinaryProduct X Y] [HasBinaryCoproduct X Y] [IsIso (coprodToProd X Y)]

/-- 定義 L.9f：比べの射の逆を通した場合分け。 -/
noncomputable def descViaComparison {T : C} (f : X ⟶ T) (g : Y ⟶ T) : X ⨯ Y ⟶ T :=
  inv (coprodToProd X Y) ≫ coprod.desc f g

theorem descViaComparison_inl {T : C} (f : X ⟶ T) (g : Y ⟶ T) :
    prod.lift (𝟙 X) 0 ≫ descViaComparison X Y f g = f := by
  rw [descViaComparison, ← inl_coprodToProd, Category.assoc, IsIso.hom_inv_id_assoc,
    coprod.inl_desc]

theorem descViaComparison_inr {T : C} (f : X ⟶ T) (g : Y ⟶ T) :
    prod.lift 0 (𝟙 Y) ≫ descViaComparison X Y f g = g := by
  rw [descViaComparison, ← inr_coprodToProd, Category.assoc, IsIso.hom_inv_id_assoc,
    coprod.inr_desc]

theorem descViaComparison_uniq {T : C} (f : X ⟶ T) (g : Y ⟶ T) (m : X ⨯ Y ⟶ T)
    (h1 : prod.lift (𝟙 X) 0 ≫ m = f) (h2 : prod.lift 0 (𝟙 Y) ≫ m = g) :
    m = descViaComparison X Y f g := by
  rw [descViaComparison, IsIso.eq_inv_comp]
  apply coprod.hom_ext
  · rw [← Category.assoc, inl_coprodToProd, h1, coprod.inl_desc]
  · rw [← Category.assoc, inr_coprodToProd, h2, coprod.inr_desc]

end

/-- 定義 L.9f：積の頂点の上の双錐。入口は `(𝟙, 0)` と `(0, 𝟙)`、出口は射影。 -/
noncomputable def prodBicone (X Y : C) [HasBinaryProduct X Y] : BinaryBicone X Y where
  pt := X ⨯ Y
  fst := prod.fst
  snd := prod.snd
  inl := prod.lift (𝟙 X) 0
  inr := prod.lift 0 (𝟙 Y)
  inl_fst := by simp
  inl_snd := by simp
  inr_fst := by simp
  inr_snd := by simp

/-- 定義 L.9f：比べの射が同型なら、積の頂点の上の双錐は双極限。 -/
noncomputable def prodBicone_isBilimit (X Y : C) [HasBinaryProduct X Y] [HasBinaryCoproduct X Y]
    [IsIso (coprodToProd X Y)] : (prodBicone X Y).IsBilimit where
  isLimit := BinaryFan.IsLimit.mk _
    (fun f g => prod.lift f g)
    (fun f g => by simp [prodBicone])
    (fun f g => by simp [prodBicone])
    (fun f g m h1 h2 => by
      apply prod.hom_ext
      · simpa [prodBicone] using h1
      · simpa [prodBicone] using h2)
  isColimit := BinaryCofan.IsColimit.mk _
    (fun f g => descViaComparison X Y f g)
    (fun f g => descViaComparison_inl X Y f g)
    (fun f g => descViaComparison_inr X Y f g)
    (fun f g m h1 h2 => descViaComparison_uniq X Y f g m h1 h2)

/-- 定理 L.9f（比べの射が同型なら双積）。 -/
theorem hasBinaryBiproduct_of_isIso_coprodToProd (X Y : C) [HasBinaryProduct X Y]
    [HasBinaryCoproduct X Y] [IsIso (coprodToProd X Y)] : HasBinaryBiproduct X Y :=
  HasBinaryBiproduct.mk ⟨prodBicone X Y, prodBicone_isBilimit X Y⟩

/-- 定理 L.9f（双積なら比べの射は同型）。 -/
theorem isIso_coprodToProd_of_hasBinaryBiproduct (X Y : C) [HasBinaryBiproduct X Y] :
    IsIso (coprodToProd X Y) := by
  have h : coprodToProd X Y = (biprod.isoCoprod X Y).inv ≫ (biprod.isoProd X Y).hom := by
    apply coprod.hom_ext <;> apply prod.hom_ext <;> simp [coprodToProd]
  rw [h]
  infer_instance

end Comparison

section Frobenius

open SetRel

variable (A : Type u)

/-- 定義 L.9g：照合。写しの逆の関係で、組 `(x, y)` は `x = y` の時だけ `x` へ行く。 -/
def mergeRel : SetRel (A × A) A := (copyRel A).inv

/-- 定義 L.9g：照合の単位。捨ての逆の関係で、1点から `A` の全部へ行く。 -/
def unitRel : SetRel PUnit.{u+1} A := (discardRel A).inv

/-- 定義 L.9g：真ん中の入れ替え。`((a, b), (c, d))` を `((a, c), (b, d))` へ送る。 -/
def prodMidSwap : (A × A) × (A × A) → (A × A) × (A × A) :=
  fun p => ((p.1.1, p.2.1), (p.1.2, p.2.2))

@[simp]
theorem mem_mergeRel (p : A × A) (a : A) : p ~[mergeRel A] a ↔ (a, a) = p :=
  Iff.rfl

@[simp]
theorem mem_unitRel (w : PUnit.{u+1}) (a : A) : w ~[unitRel A] a :=
  rfl

/-- 定理 L.9g（Frobenius の律、左の形）：左を写してから右を照合するのは、照合してから写すのと同じ。 -/
theorem frobenius_law :
    prodRel (copyRel A) SetRel.id ○ Function.graph (Equiv.prodAssoc A A A) ○
        prodRel SetRel.id (mergeRel A) =
      mergeRel A ○ copyRel A := by
  ext ⟨⟨x, y⟩, ⟨u, v⟩⟩
  simp
  constructor
  · rintro ⟨rfl, rfl, rfl⟩; simp
  · rintro ⟨⟨rfl, rfl⟩, rfl⟩; simp

/-- 定理 L.9g（Frobenius の律、右の形）：右を写してから左を照合するのも、照合してから写すのと同じ。 -/
theorem frobenius_law_mirror :
    prodRel SetRel.id (copyRel A) ○ Function.graph (Equiv.prodAssoc A A A).symm ○
        prodRel (mergeRel A) SetRel.id =
      mergeRel A ○ copyRel A := by
  ext ⟨⟨x, y⟩, ⟨u, v⟩⟩
  simp
  constructor
  · rintro ⟨⟨rfl, rfl⟩, rfl⟩; simp
  · rintro ⟨⟨rfl, rfl⟩, rfl⟩; simp

/-- 定理 L.9g（双代数の中心の律）：照合してから写すのは、それぞれ写し、真ん中を入れ替え、
それぞれ照合するのと同じ。 -/
theorem merge_copy_central_law :
    mergeRel A ○ copyRel A =
      prodRel (copyRel A) (copyRel A) ○ Function.graph (prodMidSwap A) ○
        prodRel (mergeRel A) (mergeRel A) := by
  ext ⟨⟨x, y⟩, ⟨u, v⟩⟩
  simp [prodMidSwap]
  constructor
  · rintro ⟨⟨rfl, rfl⟩, rfl⟩; simp
  · rintro ⟨⟨rfl, rfl⟩, h, -⟩; simp [h]

/-- 定理 L.9g（単位と余単位の律）：照合してから捨てるのが2つ捨てるのと同じで、
単位から写すのが単位を2つ並べるのと同じで、単位から捨てるのが恒等になるのは、
ちょうど `A` が1点の時。 -/
theorem merge_copy_unit_laws_iff :
    (mergeRel A ○ discardRel A = discardRel (A × A) ∧
      unitRel A ○ copyRel A =
        Function.graph (fun _ : PUnit.{u+1} => (PUnit.unit, PUnit.unit)) ○
          prodRel (unitRel A) (unitRel A) ∧
      unitRel A ○ discardRel A = SetRel.id) ↔
    (Subsingleton A ∧ Nonempty A) := by
  simp only [Set.ext_iff, Prod.forall]
  simp
  intro _
  exact subsingleton_iff.symm

/-- 定理 L.9g（Bool の例）：Bool では、単位から写すのは、単位を2つ並べるのと違う。 -/
theorem merge_copy_unit_law_fails_bool :
    unitRel Bool ○ copyRel Bool ≠
      Function.graph (fun _ : PUnit.{1} => (PUnit.unit, PUnit.unit)) ○
        prodRel (unitRel Bool) (unitRel Bool) := by
  intro h
  have hm : PUnit.unit ~[Function.graph (fun _ : PUnit.{1} => (PUnit.unit, PUnit.unit)) ○
      prodRel (unitRel Bool) (unitRel Bool)] (true, false) :=
    ⟨(PUnit.unit, PUnit.unit), rfl, rfl, rfl⟩
  rw [← h] at hm
  obtain ⟨z, -, hz⟩ := hm
  simp only [mem_copyRel, Prod.mk.injEq] at hz
  exact Bool.noConfusion (hz.1.symm.trans hz.2)

end Frobenius

section Dagger

open SetRel

/-- 定理 L.9h（`⊕` の上では、写しの逆は畳み）：`⊕` の写しの逆の関係は畳みで、畳みは関数のグラフ。 -/
theorem sumCopyRel_inv_eq_sumFoldRel (X : Type u) :
    (sumCopyRel X).inv = sumFoldRel X ∧ sumFoldRel X = Function.graph (Sum.elim id id) := by
  constructor
  · ext ⟨s, x⟩
    rcases s with y | y <;> simp [sumCopyRel, sumFoldRel, eq_comm]
  · ext ⟨s, x⟩
    rcases s with y | y <;> simp [sumFoldRel]

/-- 定理 L.9h（`×` の上では、写しの逆は全域でない）：Bool の組 `(true, false)` は、照合でどこへも行かない。 -/
theorem copyRel_inv_not_total :
    ¬ ∀ p : Bool × Bool, ∃ a, p ~[(copyRel Bool).inv] a := by
  intro h
  obtain ⟨a, ha⟩ := h (true, false)
  have ha' : (a, a) = (true, false) := ha
  simp only [Prod.mk.injEq] at ha'
  exact Bool.noConfusion (ha'.1.symm.trans ha'.2)

/-- 定義 L.9h：組の後ろを読む関係。 -/
def sndRel (A : Type u) : SetRel (A × A) A := Function.graph Prod.snd

/-- 定理 L.9h（`×` の上の鏡）：写してから後ろを読むのは恒等で、その逆もやはり恒等。 -/
theorem copy_snd_and_inverse (A : Type u) :
    copyRel A ○ sndRel A = SetRel.id ∧
      (sndRel A).inv ○ (copyRel A).inv = (copyRel A ○ sndRel A).inv ∧
      (sndRel A).inv ○ (copyRel A).inv = SetRel.id := by
  have h1 : copyRel A ○ sndRel A = SetRel.id := by
    ext ⟨a, b⟩
    constructor
    · rintro ⟨p, hp, hq⟩
      have hp' : (a, a) = p := hp
      subst hp'
      exact hq
    · intro h
      exact ⟨(a, a), rfl, h⟩
  refine ⟨h1, (SetRel.inv_comp _ _).symm, ?_⟩
  rw [← SetRel.inv_comp, h1, SetRel.inv_id]

/-- 定理 L.9h（鏡の1歩目は対角の外を通る）：後ろを読む関係の逆は、`a` を後ろが `a` の組の全部へ送る。
Bool では、対角の外の `(false, true)` を通る。 -/
theorem sndRel_inv_off_diagonal :
    (∀ (A : Type u) (a : A) (p : A × A), a ~[(sndRel A).inv] p ↔ p.2 = a) ∧
      true ~[(sndRel Bool).inv] (false, true) :=
  ⟨fun _ _ _ => Iff.rfl, rfl⟩

/-- 定理 L.9h（`⊕` の上の2本目は関数）：右の入口から畳むと恒等で、関係の圏でも同じ。 -/
theorem sum_inr_fold (X : Type u) :
    (Sum.elim id id : X ⊕ X → X) ∘ Sum.inr = id ∧
      Function.graph (Sum.inr : X → X ⊕ X) ○ sumFoldRel X = SetRel.id :=
  ⟨rfl, graph_inr_comp_sumDescRel _ _⟩

end Dagger

section ClosedZero

open CategoryTheory Limits MonoidalCategory

/-- 定理 L.9i（冪と零対象）：デカルト閉で零対象を持つ圏では、どの射の集まりもちょうど1点。 -/
theorem closed_zero_homsets_trivial {C : Type u} [Category.{v} C] [CartesianMonoidalCategory C]
    [MonoidalClosed C] [HasZeroObject C] (X Y : C) :
    Subsingleton (X ⟶ Y) ∧ Nonempty (X ⟶ Y) :=
  letI := uniqueHomsetOfZero X Y
  ⟨inferInstance, inferInstance⟩

/-- 定理 L.9i（冪と零射）：デカルト閉で零射を持つ圏でも（零対象は仮定しない）、どの射の集まりもちょうど1点。
終対象からの点はどれも零射になり、`X ⟶ Y` は終対象から内部の冪への点と1対1だから。 -/
theorem closed_zeroMorphisms_homsets_trivial {C : Type u} [Category.{v} C]
    [CartesianMonoidalCategory C] [MonoidalClosed C] [HasZeroMorphisms C] (X Y : C) :
    Subsingleton (X ⟶ Y) ∧ Nonempty (X ⟶ Y) := by
  have pt : ∀ (Z : C) (a : 𝟙_ C ⟶ Z), a = 0 := by
    intro Z a
    have h1 : (0 : 𝟙_ C ⟶ Z) ≫ CartesianMonoidalCategory.toUnit Z = 𝟙 _ :=
      CartesianMonoidalCategory.toUnit_unique _ _
    calc a = 𝟙 _ ≫ a := (Category.id_comp a).symm
      _ = ((0 : 𝟙_ C ⟶ Z) ≫ CartesianMonoidalCategory.toUnit Z) ≫ a := by rw [h1]
      _ = 0 := by rw [Category.assoc, zero_comp]
  have e : (X ⟶ Y) ≃ (𝟙_ C ⟶ (ihom X).obj Y) :=
    (Iso.homCongr (ρ_ X).symm (Iso.refl Y)).trans ((ihom.adjunction X).homEquiv _ _)
  refine ⟨⟨fun f g => e.injective ?_⟩, ⟨0⟩⟩
  rw [pt _ (e f), pt _ (e g)]

/-- 定理 L.9i（型では余積と積は違う）：`1 ⊕ 1` と `1 × 1` は同型でない。 -/
theorem not_sum_equiv_prod : ¬ Nonempty (PUnit.{u+1} ⊕ PUnit.{u+1} ≃ PUnit.{u+1} × PUnit.{u+1}) :=
  fun ⟨e⟩ => Sum.inl_ne_inr
    (e.injective (Subsingleton.elim (e (Sum.inl PUnit.unit)) (e (Sum.inr PUnit.unit))))

end ClosedZero

end SignMath.Quantity
