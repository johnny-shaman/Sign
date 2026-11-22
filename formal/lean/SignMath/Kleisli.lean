import Mathlib.CategoryTheory.Category.KleisliCat
import Mathlib.CategoryTheory.Limits.Shapes.BinaryBiproducts
import Mathlib.Data.Seq.Computation

/-!
# C. モナドの Kleisli 圏で見る零対象と双積
-/

namespace SignMath

open CategoryTheory Limits

universe u

/-- 定理 C.1：Kl(T) が零対象を持つ ⇔ `T ∅` がちょうど1点。 -/
theorem kleisli_hasZeroObject_iff (m : Type u → Type u) [Monad m] [LawfulMonad m] :
    HasZeroObject (KleisliCat m) ↔ Nonempty (Unique (m PEmpty)) := by
  constructor
  · rintro ⟨Z, hZ⟩
    obtain ⟨u1⟩ := hZ.unique_from (KleisliCat.mk m PUnit.{u+1})
    obtain ⟨u2⟩ := hZ.unique_to (KleisliCat.mk m PEmpty.{u+1})
    have key : ∀ f : KleisliCat.mk m PUnit.{u+1} ⟶ KleisliCat.mk m PEmpty.{u+1},
        f = u1.default ≫ u2.default := by
      intro f
      have hi : (fun e => PEmpty.elim e : KleisliCat.mk m PEmpty.{u+1} ⟶ Z) ≫ u2.default = 𝟙 _ :=
        funext fun e => PEmpty.elim e
      rw [← Category.comp_id f, ← hi, ← Category.assoc, u1.uniq (f ≫ _)]
    exact ⟨{ default := (u1.default ≫ u2.default) PUnit.unit
             uniq := fun x => congrFun (key (fun _ => x)) PUnit.unit }⟩
  · rintro ⟨hU⟩
    refine ⟨⟨KleisliCat.mk m PEmpty.{u+1}, ⟨fun Y => ?_, fun Y => ?_⟩⟩⟩
    · exact ⟨⟨⟨fun e => PEmpty.elim e⟩, fun _ => funext fun e => PEmpty.elim e⟩⟩
    · exact ⟨⟨⟨fun _ => hU.default⟩, fun _ => funext fun _ => hU.uniq _⟩⟩

/-- 系 C.2：Kl(Maybe)（集合と部分写像の圏 Par）は零対象を持つ。 -/
theorem kleisli_option_hasZeroObject : HasZeroObject (KleisliCat Option.{u}) := by
  refine (kleisli_hasZeroObject_iff Option).2 ⟨{ default := none, uniq := fun x => ?_ }⟩
  cases x with
  | none => rfl
  | some e => exact PEmpty.elim e

private theorem aux_bind_some {α β : Type u} {o : Option α} {g : α → Option β} {b : β}
    (h : o >>= g = some b) : ∃ a, o = some a ∧ g a = some b := by
  cases o with
  | none => exact absurd h (by simp)
  | some a => exact ⟨a, rfl, h⟩

private theorem aux_comp_some {X Y Z : Type u} (f : X → Option Y) (g : Y → Option Z) (x : X) (y : Y)
    (h : f x = some y) : (f >=> g) x = g y := by
  simp [Bind.kleisliRight, h]

/-- 定理 C.3：Kl(Maybe) は、零射をどう選んでも、二項の双積を持たない。 -/
theorem kleisli_option_not_hasBinaryBiproducts :
    ¬ ∃ _ : HasZeroMorphisms (KleisliCat Option.{u}), HasBinaryBiproducts (KleisliCat Option.{u}) := by
  rintro ⟨hz, hb⟩
  have hzero : ∀ X Y : KleisliCat Option.{u}, (0 : X ⟶ Y) = fun _ => none := by
    intro X Y
    have h := (comp_zero (f := (fun _ => (none : Option PEmpty.{u+1}) :
      X ⟶ KleisliCat.mk Option PEmpty.{u+1})) (Z := Y)).symm
    rw [h]
    rfl
  let P : KleisliCat Option.{u} := KleisliCat.mk Option PUnit.{u+1}
  have e1 := congrFun (biprod.inl_fst (X := P) (Y := P)) PUnit.unit
  have e2 := congrFun (biprod.inl_snd (X := P) (Y := P)) PUnit.unit
  have e3 := congrFun (biprod.inr_fst (X := P) (Y := P)) PUnit.unit
  have e4 := congrFun (biprod.inr_snd (X := P) (Y := P)) PUnit.unit
  have e5 := congrFun (biprod.lift_fst (𝟙 P) (𝟙 P)) PUnit.unit
  have e6 := congrFun (biprod.lift_snd (𝟙 P) (𝟙 P)) PUnit.unit
  rw [hzero] at e2 e3
  obtain ⟨x1, hx1, f1⟩ := aux_bind_some e1
  obtain ⟨x2, hx2, s2⟩ := aux_bind_some e4
  obtain ⟨y, hy, fy⟩ := aux_bind_some e5
  have s1 : (biprod.snd : P ⊞ P ⟶ P) x1 = none := (aux_comp_some _ _ _ _ hx1).symm.trans e2
  have f2 : (biprod.fst : P ⊞ P ⟶ P) x2 = none := (aux_comp_some _ _ _ _ hx2).symm.trans e3
  have sy : (biprod.snd : P ⊞ P ⟶ P) y = some PUnit.unit := (aux_comp_some _ _ _ _ hy).symm.trans e6
  let g1 : P ⊞ P ⟶ P := fun _ => some PUnit.unit
  let g2 : P ⊞ P ⟶ P := fun x =>
    Option.elim ((biprod.fst : P ⊞ P ⟶ P) x) (some PUnit.unit)
      (fun _ => Option.elim ((biprod.snd : P ⊞ P ⟶ P) x) (some PUnit.unit) (fun _ => none))
  have hg : g1 = g2 := by
    apply biprod.hom_ext'
    · apply KleisliCat.ext
      intro u
      cases u
      refine (aux_comp_some _ _ _ _ hx1).trans (Eq.trans ?_ (aux_comp_some _ _ _ _ hx1).symm)
      show some PUnit.unit = Option.elim ((biprod.fst : P ⊞ P ⟶ P) x1) (some PUnit.unit)
        (fun _ => Option.elim ((biprod.snd : P ⊞ P ⟶ P) x1) (some PUnit.unit) (fun _ => none))
      rw [f1, s1]
      rfl
    · apply KleisliCat.ext
      intro u
      cases u
      refine (aux_comp_some _ _ _ _ hx2).trans (Eq.trans ?_ (aux_comp_some _ _ _ _ hx2).symm)
      show some PUnit.unit = Option.elim ((biprod.fst : P ⊞ P ⟶ P) x2) (some PUnit.unit)
        (fun _ => Option.elim ((biprod.snd : P ⊞ P ⟶ P) x2) (some PUnit.unit) (fun _ => none))
      rw [f2]
      rfl
  have h1 : some PUnit.unit = Option.elim ((biprod.fst : P ⊞ P ⟶ P) y) (some PUnit.unit)
      (fun _ => Option.elim ((biprod.snd : P ⊞ P ⟶ P) y) (some PUnit.unit) (fun _ => none)) :=
    congrFun hg y
  rw [fy, sy] at h1
  exact Option.some_ne_none _ (h1 : (some PUnit.unit : Option PUnit.{u+1}) = none)

/-- モナドの射：`pure` と `bind` を保つ、型ごとの写像の族。 -/
structure MonadHom (m n : Type u → Type u) [Monad m] [Monad n] where
  app : ∀ {α : Type u}, m α → n α
  map_pure : ∀ {α : Type u} (a : α), app (pure a) = pure a
  map_bind : ∀ {α β : Type u} (x : m α) (f : α → m β), app (x >>= f) = app x >>= fun a => app (f a)

private theorem aux_monadHom_ext {m n : Type u → Type u} [Monad m] [Monad n] {φ ψ : MonadHom m n}
    (h : ∀ {α : Type u} (x : m α), φ.app x = ψ.app x) : φ = ψ := by
  cases φ
  cases ψ
  congr
  funext α x
  exact h x

/-- 定理 C.4：Maybe からのモナドの射は `T ∅` の元と1対1。 -/
noncomputable def monadHomOptionEquiv (n : Type u → Type u) [Monad n] [LawfulMonad n] :
    MonadHom Option n ≃ n PEmpty := by
  exact
  { toFun := fun φ => φ.app (none : Option PEmpty)
    invFun := fun e =>
      { app := fun o => Option.elim o (e >>= PEmpty.elim) pure
        map_pure := fun _ => rfl
        map_bind := fun x f => by
          cases x with
          | none =>
            change e >>= PEmpty.elim =
              (e >>= PEmpty.elim) >>= fun a => Option.elim (f a) (e >>= PEmpty.elim) pure
            rw [bind_assoc]
            congr 1
            funext z
            exact PEmpty.elim z
          | some a =>
            change Option.elim (f a) (e >>= PEmpty.elim) pure =
              pure a >>= fun a => Option.elim (f a) (e >>= PEmpty.elim) pure
            rw [pure_bind] }
    left_inv := fun φ => by
      apply aux_monadHom_ext
      intro α o
      cases o with
      | none =>
        change φ.app (none : Option PEmpty) >>= PEmpty.elim = φ.app (none : Option α)
        have h := φ.map_bind (none : Option PEmpty) (PEmpty.elim : PEmpty → Option α)
        change φ.app (none : Option α) = _ at h
        rw [h]
        congr 1
        funext z
        exact PEmpty.elim z
      | some a => exact (φ.map_pure a).symm
    right_inv := fun e => by
      change e >>= PEmpty.elim = e
      conv_rhs => rw [← bind_pure e]
      congr 1
      funext z
      exact PEmpty.elim z }

private theorem aux_option_pempty (a b : Option PEmpty.{u+1}) : a = b := by
  cases a with
  | none =>
    cases b with
    | none => rfl
    | some z => exact PEmpty.elim z
  | some z => exact PEmpty.elim z

/-- 系 C.5：Maybe から遅延のモナド D（`Computation`）へのモナドの射はただ1つ（`none ↦ never`）。 -/
theorem monadHom_option_computation_unique (φ ψ : MonadHom Option Computation) :
    @MonadHom.app _ _ _ _ φ = @MonadHom.app _ _ _ _ ψ := by
  have h : φ = ψ := (monadHomOptionEquiv Computation).injective
    (Subtype.ext (funext fun _ => aux_option_pempty _ _))
  rw [h]

end SignMath
