import SignMath.Quantity.Partial
import Mathlib.Computability.StateTransition
import Mathlib.Computability.TuringMachine.PostTuringMachine

/-!
# L. 計算の量の像（その4：走らせる式 Σ h∘Tⁿ と、チューリングマシン）

状態の型 `σ` と、1歩の遷移 `f : σ → Option σ` を取る。
`f s = some s'` は、`s` から1歩で `s'` へ進むことを言う。
`f s = none` は、`s` で止まることを言う。
1歩を部分関数 `stepP f` とし、その量の像を `T` とする。
止まりを部分関数 `haltP f` とし、その量の像を `h` とする。
`haltP f` は止まる点でだけ値を持ち、その値は点そのものである。
走らせた結果（`StateTransition.eval f`）の量の像は、和 `Σₙ h (Tⁿ x)` になる。
止まるなら、和の項のうち `0` でないのは、止まった歩数の項1つだけである。
止まらないなら、どの項も `0` であり、走らせた結果の像も `0` である。
チューリングマシン（`Turing.TM0`）の走りの像は、この和に出力の像を合成したものである。
-/

namespace SignMath.Quantity

open CategoryTheory

universe u

section

variable {σ : Type u}

/-- 定義 L.4：1歩の部分関数。`f s` に値があれば、値はそれである。無ければ、値が無い。 -/
def stepP (f : σ → Option σ) : σ →. σ := fun s => (f s : Part σ)

/-- 定義 L.4：止まりの部分関数。`f s = none` の点 `s` でだけ値を持ち、その値は `s` である。 -/
def haltP (f : σ → Option σ) : σ →. σ := fun s => ⟨f s = none, fun _ => s⟩

/-- 定義 L.4：1歩の量の像 `T = lin (stepP f)`。 -/
noncomputable def stepLin (f : σ → Option σ) : (σ →₀ ℕ) →+ (σ →₀ ℕ) :=
  (lin.map (X := .of σ) (Y := .of σ) (stepP f)).hom

/-- 定義 L.4：止まりの量の像 `h = lin (haltP f)`。 -/
noncomputable def haltLin (f : σ → Option σ) : (σ →₀ ℕ) →+ (σ →₀ ℕ) :=
  (lin.map (X := .of σ) (Y := .of σ) (haltP f)).hom

variable {f : σ → Option σ}

/-- 進む点の上の `T`。 -/
theorem stepLin_single_of_some {s s' : σ} (h : f s = some s') (n : ℕ) :
    stepLin f (Finsupp.single s n) = Finsupp.single s' n :=
  linHom_single_of_eq_some (f := stepP f) (Part.eq_some_iff.mpr (Part.mem_ofOption.mpr h)) n

/-- 止まる点の上の `T` は `0`。 -/
theorem stepLin_single_of_none {s : σ} (h : f s = none) (n : ℕ) :
    stepLin f (Finsupp.single s n) = 0 :=
  linHom_single_of_eq_none (f := stepP f)
    (by show ((f s : Option σ) : Part σ) = Part.none; rw [h]; exact Part.coe_none) n

/-- 止まる点の上の `h` は、その点をそのまま残す。 -/
theorem haltLin_single_of_none {s : σ} (h : f s = none) (n : ℕ) :
    haltLin f (Finsupp.single s n) = Finsupp.single s n :=
  linHom_single_of_eq_some (f := haltP f) (Part.eq_some_iff.mpr ⟨h, rfl⟩) n

/-- 進む点の上の `h` は `0`。 -/
theorem haltLin_single_of_some {s s' : σ} (h : f s = some s') (n : ℕ) :
    haltLin f (Finsupp.single s n) = 0 :=
  linHom_single_of_eq_none (f := haltP f)
    (Part.eq_none_iff'.mpr (by show ¬ f s = none; rw [h]; exact Option.some_ne_none s')) n

/-- 点 `x` から `n` 歩走った状態。`n` 歩より前に止まれば `none`。 -/
def runOpt (f : σ → Option σ) (n : ℕ) (x : σ) : Option σ :=
  (fun o : Option σ => o.bind f)^[n] (some x)

theorem runOpt_zero (x : σ) : runOpt f 0 x = some x :=
  rfl

theorem runOpt_succ (n : ℕ) (x : σ) : runOpt f (n + 1) x = (runOpt f n x).bind f :=
  Function.iterate_succ_apply' _ n _

/-- `n` 回の `T` は、`n` 歩走った状態の点へ行く。途中で止まれば `0` へ行く。 -/
theorem stepLin_iterate (n : ℕ) (x : σ) :
    (stepLin f)^[n] (Finsupp.single x 1) = (runOpt f n x).elim 0 fun s => Finsupp.single s 1 := by
  induction n with
  | zero => rfl
  | succ n ih =>
    rw [Function.iterate_succ_apply', ih, runOpt_succ]
    rcases runOpt f n x with _ | s
    · exact map_zero _
    · show stepLin f (Finsupp.single s 1) = (f s).elim 0 fun s => Finsupp.single s 1
      rcases hs : f s with _ | s'
      · exact stepLin_single_of_none hs 1
      · exact stepLin_single_of_some hs 1

/-- `n` 歩走って着いた状態には、`x` から届く。 -/
theorem reaches_of_runOpt {x s : σ} {n : ℕ} (h : runOpt f n x = some s) :
    StateTransition.Reaches f x s := by
  induction n generalizing s with
  | zero =>
    cases Option.some.inj h
    exact Relation.ReflTransGen.refl
  | succ n ih =>
    rw [runOpt_succ] at h
    rcases hc : runOpt f n x with _ | c
    · rw [hc] at h
      exact absurd h (by simp)
    · rw [hc] at h
      exact Relation.ReflTransGen.tail (ih hc) (Option.mem_def.mpr h)

/-- `x` から届く状態には、何歩かで着く。 -/
theorem exists_runOpt_of_reaches {x b : σ} (h : StateTransition.Reaches f x b) :
    ∃ k, runOpt f k x = some b := by
  induction h with
  | refl => exact ⟨0, rfl⟩
  | tail _ hcb ih =>
    obtain ⟨k, hk⟩ := ih
    refine ⟨k + 1, ?_⟩
    rw [runOpt_succ, hk]
    exact Option.mem_def.mp hcb

/-- `n` 歩で止まる点に着けば、`n + 1` 歩目とそれより先は `none` である。 -/
theorem runOpt_eq_none_of_halt {x s : σ} {n : ℕ} (h : runOpt f n x = some s) (hs : f s = none)
    (m : ℕ) : runOpt f (n + 1 + m) x = none := by
  induction m with
  | zero => rw [Nat.add_zero, runOpt_succ, h]; exact hs
  | succ m ih => rw [← Nat.add_assoc, runOpt_succ, ih]; rfl

/-- `n` 歩で止まる点に着かないなら、和の `n` 番目の項 `h (Tⁿ x)` は `0` である。 -/
theorem run_term_eq_zero {x : σ} {n : ℕ} (h : ∀ s, runOpt f n x = some s → f s ≠ none) :
    haltLin f ((stepLin f)^[n] (Finsupp.single x 1)) = 0 := by
  rw [stepLin_iterate]
  rcases hn : runOpt f n x with _ | s
  · exact map_zero _
  · rcases hs : f s with _ | s'
    · exact absurd hs (h s hn)
    · exact haltLin_single_of_some hs 1

/-- `k` 歩で止まる点 `b` に着くなら、`k` より大きい `M` で、和 `Σ_{n<M} h (Tⁿ x)` は
`single b 1` である。 -/
theorem run_sum_of_halt {x b : σ} {k : ℕ} (hk : runOpt f k x = some b) (hb : f b = none)
    {M : ℕ} (hM : k < M) :
    ∑ n ∈ Finset.range M, haltLin f ((stepLin f)^[n] (Finsupp.single x 1)) =
      Finsupp.single b 1 := by
  rw [Finset.sum_eq_single k]
  · rw [stepLin_iterate, hk]
    exact haltLin_single_of_none hb 1
  · intro n _ hnk
    refine run_term_eq_zero fun s hs hfs => ?_
    rcases Nat.lt_or_gt_of_ne hnk with hlt | hgt
    · have e := runOpt_eq_none_of_halt hs hfs (k - n - 1)
      rw [show n + 1 + (k - n - 1) = k by omega, hk] at e
      exact absurd e (by simp)
    · have e := runOpt_eq_none_of_halt hk hb (n - k - 1)
      rw [show k + 1 + (n - k - 1) = n by omega, hs] at e
      exact absurd e (by simp)
  · intro hk'
    exact absurd (Finset.mem_range.mpr hM) hk'

/-- 定理 L.4b（発散は零へ）：`x` から走らせて止まらないなら、どの `M` でも
和 `Σ_{n<M} h (Tⁿ (single x 1))` は `0` である。走らせた結果の量の像も、`single x 1` を `0` へ送る。 -/
theorem run_diverge (f : σ → Option σ) (x : σ) (hx : ¬ (StateTransition.eval f x).Dom) :
    (∀ M, ∑ n ∈ Finset.range M, haltLin f ((stepLin f)^[n] (Finsupp.single x 1)) = 0) ∧
      (lin.map (X := .of σ) (Y := .of σ) (StateTransition.eval (σ := σ) f)).hom
        (Finsupp.single x 1) = 0 := by
  refine ⟨fun M => Finset.sum_eq_zero fun n _ => run_term_eq_zero fun s hs hfs => hx ?_,
    lin_map_single_of_not_dom _ x 1 hx⟩
  exact Part.dom_iff_mem.mpr ⟨s, StateTransition.mem_eval.mpr ⟨reaches_of_runOpt hs, hfs⟩⟩

/-- 定理 L.4a（走らせる式）：どの点 `x` にも `N` があり、`N` 以上のどの `M` でも、
和 `Σ_{n<M} h (Tⁿ (single x 1))` は、走らせた結果 `StateTransition.eval f` の量の像が
`single x 1` を送る先に等しい。
証明では、止まるなら `N` に止まった歩数＋1 を取る。止まらない時に両辺が `0` なのは L.4b である。 -/
theorem run_formula (f : σ → Option σ) (x : σ) :
    ∃ N, ∀ M ≥ N, ∑ n ∈ Finset.range M, haltLin f ((stepLin f)^[n] (Finsupp.single x 1)) =
      (lin.map (X := .of σ) (Y := .of σ) (StateTransition.eval (σ := σ) f)).hom
        (Finsupp.single x 1) := by
  by_cases hd : (StateTransition.eval f x).Dom
  · obtain ⟨hr, hb⟩ := StateTransition.mem_eval.mp (Part.get_mem hd)
    obtain ⟨k, hk⟩ := exists_runOpt_of_reaches hr
    refine ⟨k + 1, fun M hM => ?_⟩
    rw [run_sum_of_halt hk hb (by omega), lin_map_single_of_dom _ x 1 hd]
  · refine ⟨0, fun M _ => ?_⟩
    exact ((run_diverge f x hd).1 M).trans (run_diverge f x hd).2.symm

end

/-- 定義 L.4：チューリングマシンの出力の量の像 `out`。配置 `c` をテープの右側 `c.Tape.right₀` へ
送る全域の関数を、部分関数として見て、`lin` で移したものである。 -/
noncomputable def tm0Out (Γ Λ : Type u) [Inhabited Γ] :
    (Turing.TM0.Cfg Γ Λ →₀ ℕ) →+ (Turing.ListBlank Γ →₀ ℕ) :=
  (lin.map (X := .of (Turing.TM0.Cfg Γ Λ)) (Y := .of (Turing.ListBlank Γ))
    (PFun.lift (fun c : Turing.TM0.Cfg Γ Λ => c.Tape.right₀) :
      Turing.TM0.Cfg Γ Λ →. Turing.ListBlank Γ)).hom

/-- 定理 L.4c（チューリングマシン）：機械 `M` と入力 `l` に `N` があり、`N` 以上のどの `K` でも、
`M` の走り `Turing.TM0.eval M` の量の像の `l` での値は、
初めの配置 `init l` からの和 `Σ_{n<K} h (Tⁿ (init l))` を `out` で移したものに等しい。
ここで `T` と `h` は、1歩の遷移 `Turing.TM0.step M` から作る。 -/
theorem tm0_run_formula {Γ Λ : Type u} [Inhabited Λ] [Inhabited Γ]
    (M : Turing.TM0.Machine Γ Λ) (l : List Γ) :
    ∃ N, ∀ K ≥ N,
      (lin.map (X := .of (List Γ)) (Y := .of (Turing.ListBlank Γ)) (Turing.TM0.eval M)).hom
          (Finsupp.single l 1) =
        tm0Out Γ Λ (∑ n ∈ Finset.range K, haltLin (Turing.TM0.step M)
          ((stepLin (Turing.TM0.step M))^[n] (Finsupp.single (Turing.TM0.init l) 1))) := by
  obtain ⟨N, hN⟩ := run_formula (Turing.TM0.step M) (Turing.TM0.init l)
  refine ⟨N, fun K hK => ?_⟩
  rw [hN K hK]
  by_cases hd : (StateTransition.eval (Turing.TM0.step M) (Turing.TM0.init l)).Dom
  · have hd' : (Turing.TM0.eval M l).Dom := hd
    rw [lin_map_single_of_dom (Turing.TM0.eval M) l 1 hd',
      lin_map_single_of_dom (StateTransition.eval (Turing.TM0.step M)) _ 1 hd]
    exact (lin_map_single_of_dom (PFun.lift fun c : Turing.TM0.Cfg Γ Λ => c.Tape.right₀) _ 1
      trivial).symm
  · have hd' : ¬ (Turing.TM0.eval M l).Dom := hd
    rw [lin_map_single_of_not_dom (Turing.TM0.eval M) l 1 hd',
      lin_map_single_of_not_dom (StateTransition.eval (Turing.TM0.step M)) _ 1 hd]
    exact (map_zero _).symm

end SignMath.Quantity
