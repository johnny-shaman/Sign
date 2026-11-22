import Mathlib.CategoryTheory.Monoidal.Closed.Basic
import Mathlib.CategoryTheory.Limits.Shapes.ZeroObjects
import Mathlib.CategoryTheory.Limits.Shapes.ZeroMorphisms
import Mathlib.CategoryTheory.Limits.Shapes.BinaryProducts.ProdComparison
import Mathlib.CategoryTheory.Category.Pointed
import Mathlib.CategoryTheory.Endomorphism
import Mathlib.Algebra.Ring.BooleanRing
import SignMath.Pointed

/-!
# I（圏の側）. 暗黙の Boolean
-/

namespace SignMath

open CategoryTheory Limits MonoidalCategory

universe v u

section General

variable {C : Type u} [Category.{v} C]

/-- 定理 I.2(a)：零対象を持つ閉なテンソルの上では、零の点を食わせると何もしない口（R83 の形）は、
零対象にしか置けない。 -/
theorem closed_port_unit_trivial [MonoidalCategory C] [MonoidalClosed C] [HasZeroMorphisms C]
    [HasZeroObject C] {X Y : C} (m : X ⊗ Y ⟶ X)
    (h : (ρ_ X).inv ≫ (X ◁ (0 : 𝟙_ C ⟶ Y)) ≫ m = 𝟙 X) : IsZero X := by
  obtain ⟨Z, hZ⟩ := HasZeroObject.zero (C := C)
  have hXZ : IsZero (X ⊗ Z) := by
    rw [IsZero.iff_id_eq_zero]
    exact MonoidalClosed.curry_injective (hZ.eq_of_src _ _)
  have h0 : X ◁ (0 : 𝟙_ C ⟶ Y) = 0 := by
    rw [← comp_zero (f := (0 : 𝟙_ C ⟶ Z)) (Z := Y), MonoidalCategory.whiskerLeft_comp,
      hXZ.eq_zero_of_tgt (X ◁ _), zero_comp]
  rw [IsZero.iff_id_eq_zero, ← h, h0, zero_comp, comp_zero]

/-- 定理 I.2(d)：零射があれば、残った物を零へ送る自然な引き込みは [id, 0] だけ。 -/
theorem natural_retraction_eq [HasZeroMorphisms C] [HasBinaryCoproducts C] (A : C)
    (φ : ∀ P : C, A ⨿ P ⟶ A) (nat : ∀ {P Q : C} (g : P ⟶ Q), coprod.map (𝟙 A) g ≫ φ Q = φ P)
    (hinl : ∀ P, coprod.inl ≫ φ P = 𝟙 A) (P : C) : φ P = coprod.desc (𝟙 A) 0 := by
  apply coprod.hom_ext
  · rw [hinl, coprod.inl_desc]
  · rw [coprod.inr_desc, ← nat (0 : P ⟶ P), coprod.inr_map_assoc, zero_comp]

/-- 定理 I.5（系）：零対象どうしの余積は零対象。 -/
theorem isZero_coprod_of_isZero {A B : C} (hA : IsZero A) (hB : IsZero B)
    [HasBinaryCoproduct A B] : IsZero (A ⨿ B) := by
  refine hA.of_iso ⟨coprod.desc (𝟙 A) (hB.to_ A), coprod.inl, ?_, ?_⟩
  · apply coprod.hom_ext
    · simp
    · simpa using hB.eq_of_src _ _
  · simp

/-- 定理 I.5（系）：零対象を2つ並べた余積の2つの入射は等しい（1+1 の真偽は潰れる）。 -/
theorem inl_eq_inr_of_isZero {Z : C} (hZ : IsZero Z) [HasBinaryCoproduct Z Z] :
    (coprod.inl : Z ⟶ Z ⨿ Z) = coprod.inr := by
  exact hZ.eq_of_src _ _

end General

/-- 定理 I.2(d)：零の無い Set では、自然な引き込みの族は既定値の選び方と1対1。 -/
def setRetractionEquiv (A : Type u) :
    {φ : ∀ P : Type u, A ⊕ P → A //
      (∀ (P Q : Type u) (g : P → Q) (x : A ⊕ P), φ Q (Sum.map id g x) = φ P x) ∧
      ∀ (P : Type u) (a : A), φ P (Sum.inl a) = a} ≃ A := by
  exact
  { toFun := fun φ => φ.1 PUnit (Sum.inr PUnit.unit)
    invFun := fun a => ⟨fun _ => Sum.elim id (fun _ => a),
      fun _ _ _ x => by cases x <;> rfl, fun _ _ => rfl⟩
    left_inv := fun φ => by
      apply Subtype.ext
      funext P x
      cases x with
      | inl a => exact (φ.2.2 P a).symm
      | inr p => exact φ.2.1 P PUnit (fun _ => PUnit.unit) (Sum.inr p)
    right_inv := fun _ => rfl }

/-! ## I.3 真偽は射の側に住む -/

/-- S⁰ の基点でない点。 -/
private def aux_one : (S0.{u}).X := (some PUnit.unit : Option PUnit.{u+1})

private theorem aux_one_ne_point : (aux_one.{u} : (S0.{u}).X) ≠ S0.point :=
  Option.some_ne_none _

private theorem aux_S0_cases (x : (S0.{u}).X) : x = S0.point ∨ x = aux_one := by
  change Option PUnit.{u+1} at x
  rcases x with _ | ⟨⟨⟩⟩
  · exact Or.inl rfl
  · exact Or.inr rfl

/-- S⁰ の自己射は、基点でない点の行き先で決まる。 -/
private theorem aux_S0_hom_ext (f g : (S0.{u} : Pointed.{u}) ⟶ S0) (h : f.toFun aux_one = g.toFun aux_one) :
    f = g := by
  apply Pointed.Hom.ext
  funext x
  rcases aux_S0_cases x with rfl | rfl
  · rw [f.map_point, g.map_point]
  · exact h

/-- S⁰ の零射。 -/
private def aux_zeroS0 : (S0.{u} : Pointed.{u}) ⟶ S0 := ⟨fun _ => S0.point, rfl⟩

/-- 定理 I.3(a)：(End(S⁰), ∘) ≅ ({0,1}, ∧)。 -/
noncomputable def endS0MulEquiv : End (S0 : Pointed.{u}) ≃* Bool := by
  exact
  { toFun := fun f => Option.isSome (f.asHom.toFun aux_one : Option PUnit.{u+1})
    invFun := fun b => cond b 1 (End.of aux_zeroS0)
    left_inv := fun f => by
      apply End.ext
      apply aux_S0_hom_ext
      dsimp only
      rcases aux_S0_cases (f.asHom.toFun aux_one) with h | h
      · rw [h]; rfl
      · rw [h]; rfl
    right_inv := fun b => by cases b <;> rfl
    map_mul' := fun f g => by
      change Option.isSome (f.asHom.toFun (g.asHom.toFun aux_one) : Option PUnit.{u+1}) =
        (Option.isSome (f.asHom.toFun aux_one : Option PUnit.{u+1}) &&
          Option.isSome (g.asHom.toFun aux_one : Option PUnit.{u+1}))
      rcases aux_S0_cases (g.asHom.toFun aux_one) with h | h
      · rw [h, f.asHom.map_point]
        simp [S0, Pointed.of]
      · rw [h]
        simp [aux_one] }

/-- 付点集合の点 x を指す、S⁰ からの射。 -/
private def aux_pt (X : Pointed.{u}) (x : X) : (S0.{u} : Pointed.{u}) ⟶ X :=
  ⟨fun o => Option.elim (o : Option PUnit.{u+1}) X.point (fun _ => x), rfl⟩

/-- 恒等関手の自然な自己変換は、S⁰ の成分で決まる。 -/
private theorem aux_natApp (α : 𝟭 Pointed.{u} ⟶ 𝟭 Pointed.{u}) (X : Pointed.{u}) (x : X) :
    (α.app X).toFun x = (aux_pt X x).toFun ((α.app S0).toFun aux_one) :=
  congrArg (fun h => Pointed.Hom.toFun h aux_one) (α.naturality (aux_pt X x))

/-- 恒等関手の自然な自己変換 0。 -/
private def aux_zeroNat : 𝟭 Pointed.{u} ⟶ 𝟭 Pointed.{u} where
  app X := ⟨fun _ => X.point, rfl⟩
  naturality X Y f := by
    apply Pointed.Hom.ext
    funext x
    exact f.map_point.symm

/-- 定理 I.3(a)：End(Id) ≅ End(S⁰)（S⁰ の成分を取る）。 -/
noncomputable def endIdMulEquivEndS0 : End (𝟭 Pointed.{u}) ≃* End (S0 : Pointed.{u}) := by
  exact
  { toFun := fun α => End.of (α.asHom.app S0)
    invFun := fun e =>
      cond (Option.isSome (e.asHom.toFun aux_one : Option PUnit.{u+1})) 1 (End.of aux_zeroNat)
    left_inv := fun α => by
      apply End.ext
      apply NatTrans.ext
      funext X
      apply Pointed.Hom.ext
      funext x
      dsimp only
      rw [aux_natApp α.asHom X x]
      rcases aux_S0_cases ((α.asHom.app S0).toFun aux_one) with h | h
      · rw [h]; rfl
      · rw [h]; rfl
    right_inv := fun e => by
      apply End.ext
      apply aux_S0_hom_ext
      dsimp only
      rcases aux_S0_cases (e.asHom.toFun aux_one) with h | h
      · rw [h]; rfl
      · rw [h]; rfl
    map_mul' := fun _ _ => rfl }

/-! ## I.6 支え τ は lax にだけ自然 -/

open Classical in
/-- 支え τ_A：「評価しきったか」（基点で `false`）。一般の付点集合では排中律で定める。 -/
noncomputable def supp (A : Pointed.{u}) (a : A) : Bool := decide (a ≠ A.point)

open Classical in
/-- 制限 f̄：f(a) が基点なら基点、ほかは a。 -/
noncomputable def restrP {A B : Pointed.{u}} (f : A ⟶ B) (a : A) : A :=
  if f.toFun a = B.point then A.point else a

private theorem aux_supp_point (A : Pointed.{u}) : supp A A.point = false := by
  simp [supp]

private theorem aux_supp_of_ne {A : Pointed.{u}} {a : A} (h : a ≠ A.point) : supp A a = true := by
  simp [supp, h]

/-- 定理 I.6(a0)：付点でない写像 f でも、τ_B ∘ f ≤ τ_A ⇔ f は基点を保つ。 -/
theorem supp_le_iff_point {A B : Pointed.{u}} (f : A → B) :
    (∀ a, supp B (f a) ≤ supp A a) ↔ f A.point = B.point := by
  constructor
  · intro h
    have h1 := h A.point
    rw [aux_supp_point] at h1
    by_contra hne
    rw [aux_supp_of_ne hne] at h1
    exact absurd h1 (by decide)
  · intro h a
    by_cases ha : a = A.point
    · rw [ha, h, aux_supp_point]
      exact Bool.false_le _
    · rw [aux_supp_of_ne ha]
      exact Bool.le_true _

/-- 定理 I.6(a)：τ_B ∘ f = τ_A ∘ f̄ ≤ τ_A。 -/
theorem supp_comp {A B : Pointed.{u}} (f : A ⟶ B) (a : A) :
    supp B (f.toFun a) = supp A (restrP f a) ∧ supp B (f.toFun a) ≤ supp A a := by
  by_cases hfa : f.toFun a = B.point
  · rw [restrP, ite_eq_left hfa, hfa, aux_supp_point, aux_supp_point]
    exact ⟨rfl, Bool.false_le _⟩
  · have ha : a ≠ A.point := fun ha => hfa (ha ▸ f.map_point)
    rw [restrP, ite_eq_right hfa, aux_supp_of_ne hfa, aux_supp_of_ne ha]
    exact ⟨rfl, le_rfl⟩

/-- 定理 I.6(b)：τ が f について自然 ⇔ f̄ = id ⇔ f は基点を映し返す。 -/
theorem supp_natural_iff {A B : Pointed.{u}} (f : A ⟶ B) :
    ((∀ a, supp B (f.toFun a) = supp A a) ↔ ∀ a, f.toFun a = B.point → a = A.point) ∧
    (restrP f = id ↔ ∀ a, f.toFun a = B.point → a = A.point) := by
  refine ⟨⟨fun h a hfa => ?_, fun h a => ?_⟩, ⟨fun h a hfa => ?_, fun h => ?_⟩⟩
  · by_contra ha
    have h1 := h a
    rw [hfa, aux_supp_point, aux_supp_of_ne ha] at h1
    exact absurd h1 (by decide)
  · by_cases hfa : f.toFun a = B.point
    · rw [hfa, h a hfa, aux_supp_point, aux_supp_point]
    · have ha : a ≠ A.point := fun ha => hfa (ha ▸ f.map_point)
      rw [aux_supp_of_ne hfa, aux_supp_of_ne ha]
  · have h1 := congrFun h a
    rw [restrP, ite_eq_left hfa] at h1
    exact h1.symm
  · funext a
    by_cases hfa : f.toFun a = B.point
    · rw [restrP, ite_eq_left hfa, h a hfa]
      rfl
    · rw [restrP, ite_eq_right hfa]
      rfl

/-- 定理 I.6(b)：bind k が τ を保つ ⇔ k は全域（公理なし）。 -/
theorem bind_supp_iff {α β : Type u} (k : α → Option β) :
    (∀ o : Option α, (o.bind k).isSome = o.isSome) ↔ ∀ x, (k x).isSome = true := by
  constructor
  · intro h x
    exact h (some x)
  · intro h o
    cases o with
    | none => rfl
    | some x => exact h x

/-! ## I.7(a) Set* の自然な2項演算は3本 -/

/-- Set* のすべての付点写像について自然な2項演算（× は Set* の積）。 -/
structure NatBinOp where
  op : ∀ X : Pointed.{u}, X → X → X
  nat : ∀ {X Y : Pointed.{u}} (f : X ⟶ Y) (a b : X),
    f.toFun (op X a b) = op Y (f.toFun a) (f.toFun b)

/-- 3点の付点集合 S⁰ ∨ S⁰。 -/
private def aux_W : Pointed.{u} := Pointed.of (none : Option (ULift.{u} Bool))

/-- S⁰ ∨ S⁰ の2つの点を a と b へ送る射。 -/
private def aux_W_hom (X : Pointed.{u}) (a b : X) : aux_W.{u} ⟶ X :=
  ⟨fun o => match (o : Option (ULift.{u} Bool)) with
    | none => X.point
    | some ⟨true⟩ => a
    | some ⟨false⟩ => b, rfl⟩

/-- 定理 I.7(a)：自然な2項演算は 0・π₁・π₂ のどれか。 -/
theorem natBinOp_trichotomy (N : NatBinOp.{u}) :
    (∀ (X : Pointed.{u}) (a b : X), N.op X a b = X.point) ∨
    (∀ (X : Pointed.{u}) (a b : X), N.op X a b = a) ∨
    (∀ (X : Pointed.{u}) (a b : X), N.op X a b = b) := by
  have key : ∀ (X : Pointed.{u}) (a b : X), N.op X a b =
      (aux_W_hom X a b).toFun
        (N.op aux_W (some ⟨true⟩ : Option (ULift.{u} Bool)) (some ⟨false⟩ : Option (ULift.{u} Bool))) :=
    fun X a b => (N.nat (aux_W_hom X a b) (some ⟨true⟩ : Option (ULift.{u} Bool))
      (some ⟨false⟩ : Option (ULift.{u} Bool))).symm
  obtain ⟨o, ho⟩ : ∃ o : Option (ULift.{u} Bool),
      N.op aux_W (some ⟨true⟩ : Option (ULift.{u} Bool)) (some ⟨false⟩ : Option (ULift.{u} Bool)) = o :=
    ⟨_, rfl⟩
  rcases o with _ | ⟨⟨_ | _⟩⟩
  · left
    intro X a b
    rw [key, ho]
    rfl
  · right; right
    intro X a b
    rw [key, ho]
    rfl
  · right; left
    intro X a b
    rw [key, ho]
    rfl

/-- 定理 I.7(a)：基点を両側の単位にする自然な2項演算は無い（`|` と `;` は自然でない）。 -/
theorem no_unital_natBinOp :
    ¬ ∃ N : NatBinOp.{u}, ∀ (X : Pointed.{u}) (a : X), N.op X a X.point = a ∧ N.op X X.point a = a := by
  rintro ⟨N, hN⟩
  rcases natBinOp_trichotomy N with h | h | h
  · have h1 := (hN S0 aux_one).1
    rw [h] at h1
    exact aux_one_ne_point h1.symm
  · have h1 := (hN S0 aux_one).2
    rw [h] at h1
    exact aux_one_ne_point h1.symm
  · have h1 := (hN S0 aux_one).1
    rw [h] at h1
    exact aux_one_ne_point h1.symm

/-! ## I.8 振り分けと交換する射（付点集合の形） -/

open Classical in
/-- 一般の付点集合の上の `|`（排中律で定める）。 -/
noncomputable def orP (X : Pointed.{u}) (a b : X) : X := if a = X.point then b else a

/-- 決まった射：基点でない点を基点へ送るなら、どの点も基点へ送る。 -/
def IsDecided {X Y : Pointed.{u}} (f : X ⟶ Y) : Prop :=
  ∀ a b : X, a ≠ X.point → f.toFun a = Y.point → f.toFun b = Y.point

/-- 定理 I.8：f が `|` と交換する ⇔ f は決まった射。 -/
theorem commutes_orP_iff {X Y : Pointed.{u}} (f : X ⟶ Y) :
    (∀ a b : X, f.toFun (orP X a b) = orP Y (f.toFun a) (f.toFun b)) ↔ IsDecided f := by
  constructor
  · intro h a b ha hfa
    have h1 := h a b
    rw [orP, orP, ite_eq_right ha, ite_eq_left hfa] at h1
    rw [← h1, hfa]
  · intro hd a b
    by_cases ha : a = X.point
    · rw [orP, orP, ite_eq_left ha, ha, f.map_point, ite_eq_left rfl]
    · rw [orP, orP, ite_eq_right ha]
      by_cases hfa : f.toFun a = Y.point
      · rw [ite_eq_left hfa, hfa, hd a b ha hfa]
      · rw [ite_eq_right hfa]

/-- 定理 I.8：決まった射 ⇔ 基点を映し返すか零射（排中律を使う）。 -/
theorem isDecided_iff {X Y : Pointed.{u}} (f : X ⟶ Y) :
    IsDecided f ↔ (∀ a, f.toFun a = Y.point → a = X.point) ∨ (∀ a, f.toFun a = Y.point) := by
  constructor
  · intro hd
    by_cases hex : ∃ a, a ≠ X.point ∧ f.toFun a = Y.point
    · obtain ⟨a, ha, hfa⟩ := hex
      exact Or.inr fun b => hd a b ha hfa
    · refine Or.inl fun a hfa => ?_
      by_contra ha
      exact hex ⟨a, ha, hfa⟩
  · rintro (h | h) a b ha hfa
    · exact absurd (h a hfa) ha
    · exact h b

/-! ## I.9 単位つきの自然な演算は可換 -/

/-- 零射と二項の積を持つ圏の、0 を両側の単位にする自然な演算。 -/
structure UnitalNatOp (C : Type u) [Category.{v} C] [HasZeroMorphisms C] [HasBinaryProducts C] where
  op : ∀ B : C, B ⨯ B ⟶ B
  nat : ∀ {A B : C} (h : A ⟶ B), op A ≫ h = prod.map h h ≫ op B
  unitL : ∀ B : C, prod.lift 0 (𝟙 B) ≫ op B = 𝟙 B
  unitR : ∀ B : C, prod.lift (𝟙 B) 0 ≫ op B = 𝟙 B

section Unital

variable {C : Type u} [Category.{v} C] [HasZeroMorphisms C] [HasBinaryProducts C]

private theorem aux_zero_op (O : UnitalNatOp C) {X B : C} (b : X ⟶ B) :
    prod.lift 0 b ≫ O.op B = b := by
  have : prod.lift (0 : X ⟶ B) b = b ≫ prod.lift 0 (𝟙 B) := by
    rw [prod.comp_lift, comp_zero, Category.comp_id]
  rw [this, Category.assoc, O.unitL, Category.comp_id]

private theorem aux_op_zero (O : UnitalNatOp C) {X B : C} (a : X ⟶ B) :
    prod.lift a 0 ≫ O.op B = a := by
  have : prod.lift a (0 : X ⟶ B) = a ≫ prod.lift (𝟙 B) 0 := by
    rw [prod.comp_lift, comp_zero, Category.comp_id]
  rw [this, Category.assoc, O.unitR, Category.comp_id]

/-- 積の上の演算は成分ごと。 -/
private theorem aux_op_prod (O : UnitalNatOp C) {X B : C} (a b c d : X ⟶ B) :
    prod.lift (prod.lift a b) (prod.lift c d) ≫ O.op (B ⨯ B) =
      prod.lift (prod.lift a c ≫ O.op B) (prod.lift b d ≫ O.op B) := by
  apply prod.hom_ext
  · rw [Category.assoc, O.nat, prod.lift_map_assoc, prod.lift_fst, prod.lift_fst, prod.lift_fst]
  · rw [Category.assoc, O.nat, prod.lift_map_assoc, prod.lift_snd, prod.lift_snd, prod.lift_snd]

/-- 交換律（interchange）。 -/
private theorem aux_interchange (O O' : UnitalNatOp C) {X B : C} (a b c d : X ⟶ B) :
    prod.lift (prod.lift a c ≫ O.op B) (prod.lift b d ≫ O.op B) ≫ O'.op B =
      prod.lift (prod.lift a b ≫ O'.op B) (prod.lift c d ≫ O'.op B) ≫ O.op B := by
  rw [← aux_op_prod O, Category.assoc, O.nat, prod.lift_map_assoc]

/-- 定理 I.9：可換（Eckmann–Hilton）。 -/
theorem UnitalNatOp.comm (O : UnitalNatOp C) {X B : C} (a b : X ⟶ B) :
    prod.lift a b ≫ O.op B = prod.lift b a ≫ O.op B := by
  have h := aux_interchange O O 0 b a 0
  rw [aux_zero_op, aux_op_zero, aux_zero_op, aux_op_zero] at h
  exact h

/-- 定理 I.9：結合的。 -/
theorem UnitalNatOp.assoc (O : UnitalNatOp C) {X B : C} (a b c : X ⟶ B) :
    prod.lift (prod.lift a b ≫ O.op B) c ≫ O.op B =
      prod.lift a (prod.lift b c ≫ O.op B) ≫ O.op B := by
  have h := aux_interchange O O a 0 b c
  rw [aux_zero_op, aux_op_zero] at h
  exact h

/-- 定理 I.9：在れば1つ。 -/
theorem UnitalNatOp.op_unique (O O' : UnitalNatOp C) (B : C) : O.op B = O'.op B := by
  have h := aux_interchange O O' (prod.fst : B ⨯ B ⟶ B) 0 0 prod.snd
  rw [aux_op_zero, aux_zero_op, aux_op_zero, aux_zero_op, prod.lift_fst_snd,
    Category.id_comp, Category.id_comp] at h
  exact h.symm

/-- 定理 I.9（系）：左優先の catch（a ⋆ b = a、b ⋆ a = b）は違う2元では成り立たない。 -/
theorem UnitalNatOp.no_left_catch (O : UnitalNatOp C) {X B : C} (a b : X ⟶ B)
    (h1 : prod.lift a b ≫ O.op B = a) (h2 : prod.lift b a ≫ O.op B = b) : a = b := by
  rw [← h1, O.comm, h2]

end Unital

end SignMath
