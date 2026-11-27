import SignMath.Machine.Output
import Mathlib.Computability.Halting
import Mathlib.Computability.Reduce
import Mathlib.Computability.RecursiveIn

/-!
# M. 処理系から見た木と意味：木と意味の3つの段、意味の側、Rice の強い形、いつか出力するか

このファイルでは、Mathlib の `Nat.Partrec.Code` を木と呼び、木 c の意味を `c.eval`（入力から
結果への部分関数）と置く。木と入力の2つを受ける `Code.eval` を処理系、燃料 k で区切った
`Code.evaln k` を区切った処理系と呼ぶ。Sign の木の Lean は `formal/sem/SignSem` にある。
`Code.comp f g` は g を走らせてから f を走らせる。

このファイルは次を示す。
- M.1 木と意味の3つの段。
  - (a) 木の等しさは公理なしの判定を持ち、2つの木を受ける計算できる述語で、番号の等しさと同じ。
  - (b) 同じ木なら同じ意味（定義からの合同）。
  - (c) 違う木で同じ意味がある（`id ∘ id` と `id`、`zero ∘ succ` と `zero`）。eval は単射でない。
  - (d) 恒等との合成を下から畳んだ等しさ `UnitEq` は、健全で、木の等しさより真に粗く、意味へは
    完全でない。公理なしの判定を持つ（計算できる述語であることは示していない）。
  - 3つの段：木の `=` ⊊ `UnitEq` ⊊ 意味の `=`（対の集まりとして、左ほど細かい。`three_levels`）。
    木の `=` は計算できる述語、`UnitEq` は公理なしの判定を持ち、意味の `=` は計算できる述語でない。
- M.2 意味の側。
  - (a) どの c₀ でも、「意味が c₀ と同じか」は計算できる述語でない（`ComputablePred.rice₂`）。
    2つの木を受ける形も同じ。
  - (b) 処理系は部分再帰で、木の意味の全体は部分再帰関数のちょうど全部。
  - (c) 燃料 k で区切った処理系 `evaln` は原始再帰で、入力が k 以上なら値を持たず、
    x ∈ eval c n ⇔ ある k で x ∈ evaln k c n。
  - (d) 計算できる f : Code → Code には、f c と c が同じ意味になる c がある（再帰定理）。
    自分の番号を返す木がある。
  - (e) c と succ ∘ c が同じ意味になる木はあり、そうなる木の意味はどれも、どこでも未定義。
  - (f) 入力 0 での振り分け J : Code → Option ℕ。ここでは、c が入力 0 で止まることを I.13 の
    「返る」に当てる。止まればその値を言い（I.13 の S1）、値を言えば本当に止まってその値を返す
    （S3）、計算できる J は無い（停止問題から）。S1 だけの計算できる J も無い（再帰定理から）。
- M.3 Rice の強い形。H₀ = {c : (eval c 0) が値を持つ}。C は部分関数の集まりで、I_C = {c : eval c ∈ C}
  （木の上の述語）。⊥ はどこでも未定義の関数。C が非自明とは、C に入る意味の木と入らない意味の木が
  あること。
  - (a) ⊥ ∉ C で C に入る意味の木があれば、H₀ ≤₀ I_C。
  - (b) ⊥ ∈ C で C に入らない意味の木があれば、H₀ の補 ≤₀ I_C。
  - (c) そこから、非自明な C の I_C は計算できる述語でない（Rice がもう一度出る）。
  - (d) 非自明な C の I_C を決める関数が神託 O で計算できれば、H₀ を決める関数も O で計算できる。
- M.4(a) の Code の形：`codeEv` は、ある燃料で値を持てば燃料を足しても同じ値を持ち、跡は燃料に
  ついて後ろへ延びる（`codeTrace_prefix_le`）。
- M.4(e) c ↦ (call c ; emit 1) が始めの状態 0 から燃料のどこかで出力するかは、c の計算できる
  述語でない（`ComputablePred.halting_problem`）。この木が出力の節を含むかは、どの c でも true。
-/

open Nat.Partrec (Code)
open Encodable

-- Mathlib v4.36.0 には `DecidableEq Code` の instance が登録されていない。
/--
error: failed to synthesize
  DecidableEq Code

Hint: Additional diagnostic information may be available using the `set_option diagnostics true` command.
-/
#guard_msgs in
#synth DecidableEq Code

-- この確かめは、Mathlib が instance を足した時と、Lean の文言が変わった時に落ちる。
-- Mathlib が instance を足したら、下の deriving の行を消し、`treeDecEq` の公理を見直す。
-- Lean の文言だけが変わったら、上の期待の文を新しい出力に書き直す。

namespace SignMath.Machine

-- 木の構造で比べる判定を導く（構造の帰納で、kernel の中で走る）。
deriving instance DecidableEq for Nat.Partrec.Code

/-! ## M.1 木と意味の3つの段 -/

section Levels

/-- 定義 M.1(a)：木の等しさの判定（構造で比べる物）。 -/
def treeDecEq : DecidableEq Code := inferInstance

example : Code.id ≠ Code.comp Code.id Code.id := by decide
example : Code.zero ≠ Code.comp Code.zero Code.succ := by decide

/-- 定理 M.1(a)：木が等しい ⇔ 木の番号（`encode`）が等しい。 -/
theorem tree_eq_iff_encode_eq (c₁ c₂ : Code) : c₁ = c₂ ↔ encode c₁ = encode c₂ :=
  encode_injective.eq_iff.symm

/-- 定理 M.1(a)：木の等しさは、2つの木を受ける計算できる述語。 -/
theorem tree_eq_computable : ComputablePred (fun p : Code × Code => p.1 = p.2) :=
  PrimrecPred.computablePred (Primrec.eq (α := Code))

/-- 定理 M.1(b)：同じ木なら同じ意味。 -/
theorem same_tree_same_eval {c₁ c₂ : Code} (h : c₁ = c₂) : c₁.eval = c₂.eval :=
  congrArg Code.eval h

/-- 定理 M.1(c)：恒等に恒等を合成した物と恒等（単位律の分だけ違う木）は、同じ意味。 -/
theorem id_comp_id_eval : (Code.comp Code.id Code.id).eval = Code.id.eval := by
  funext n
  show (Code.id.eval n).bind (fun m => Code.id.eval m) = Code.id.eval n
  simp only [Code.eval_id, Part.bind_some]

/-- 定理 M.1(c)：succ を走らせてから捨てて 0 を返す物と定数 0（計算を捨てる分だけ違う木）は、
同じ意味。 -/
theorem zero_comp_succ_eval : (Code.comp Code.zero Code.succ).eval = Code.zero.eval := by
  funext n
  show (Part.some (n + 1)).bind (fun m => Code.zero.eval m) = Code.zero.eval n
  rw [Part.bind_some]
  rfl

/-- 定理 M.1(c)：違う木で同じ意味（2つの例）。 -/
theorem tree_ne_eval_eq :
    (Code.comp Code.id Code.id ≠ Code.id ∧ (Code.comp Code.id Code.id).eval = Code.id.eval) ∧
    (Code.comp Code.zero Code.succ ≠ Code.zero ∧
      (Code.comp Code.zero Code.succ).eval = Code.zero.eval) :=
  ⟨⟨by decide, id_comp_id_eval⟩, ⟨by decide, zero_comp_succ_eval⟩⟩

/-- 定理 M.1(c)：「意味が同じなら木が同じ」は偽。 -/
theorem not_eval_injective : ¬ Function.Injective Code.eval := fun h =>
  absurd (h zero_comp_succ_eval) (by decide)

/-- 定義 M.1(d)：片方が恒等なら合成を畳む。 -/
def smartComp (f g : Code) : Code :=
  if f = Code.id then g else if g = Code.id then f else Code.comp f g

/-- 定義 M.1(d)：木を、恒等との合成を下から畳んだ木へ写す。 -/
def unitNorm : Code → Code
  | .zero => .zero
  | .succ => .succ
  | .left => .left
  | .right => .right
  | .pair f g => .pair (unitNorm f) (unitNorm g)
  | .comp f g => smartComp (unitNorm f) (unitNorm g)
  | .prec f g => .prec (unitNorm f) (unitNorm g)
  | .rfind' f => .rfind' (unitNorm f)

/-- 恒等は畳んでも恒等。 -/
theorem unitNorm_id : unitNorm Code.id = Code.id := rfl

/-- 合成を畳んでも意味は同じ。 -/
theorem eval_smartComp (f g : Code) : (smartComp f g).eval = (Code.comp f g).eval := by
  unfold smartComp
  by_cases h1 : f = Code.id
  · subst h1
    funext n
    show g.eval n = (g.eval n).bind (fun m => Code.id.eval m)
    simp only [Code.eval_id, Part.bind_some_right]
  · simp only [h1, ↓reduceIte]
    by_cases h2 : g = Code.id
    · subst h2
      simp only [↓reduceIte]
      funext n
      show f.eval n = (Code.id.eval n).bind (fun m => f.eval m)
      simp only [Code.eval_id, Part.bind_some]
    · simp only [h2, ↓reduceIte]

/-- 恒等との合成を畳んでも意味は同じ。 -/
theorem eval_unitNorm (c : Code) : (unitNorm c).eval = c.eval := by
  induction c with
  | zero => rfl
  | succ => rfl
  | left => rfl
  | right => rfl
  | pair f g ihf ihg => simp only [unitNorm, Code.eval, ihf, ihg]; rfl
  | comp f g ihf ihg =>
      simp only [unitNorm]
      rw [eval_smartComp]
      simp only [Code.eval, ihf, ihg]; rfl
  | prec f g ihf ihg => simp only [unitNorm, Code.eval, ihf, ihg]; rfl
  | rfind' f ihf => simp only [unitNorm, Code.eval, ihf]; rfl

/-- 定義 M.1(d)：単位律で畳んだ後の木の等しさ。 -/
def UnitEq (c₁ c₂ : Code) : Prop := unitNorm c₁ = unitNorm c₂

/-- 定義 M.1(d)：`UnitEq` の判定（畳んだ木を構造で比べる物）。 -/
instance unitEqDec : DecidableRel UnitEq := fun a b =>
  inferInstanceAs (Decidable (unitNorm a = unitNorm b))

example : UnitEq (Code.comp Code.id Code.succ) Code.succ := by decide

/-- 定理 M.1(d)：健全。畳んだ木が同じなら同じ意味。 -/
theorem unitEq_sound {c₁ c₂ : Code} (h : UnitEq c₁ c₂) : c₁.eval = c₂.eval := by
  rw [← eval_unitNorm c₁, ← eval_unitNorm c₂]
  exact congrArg Code.eval h

/-- 定理 M.1(d)：同じ木なら畳んでも同じ。 -/
theorem eq_unitEq {c₁ c₂ : Code} (h : c₁ = c₂) : UnitEq c₁ c₂ := congrArg unitNorm h

/-- 定理 M.1(d)：右の単位律。 -/
theorem unitEq_comp_id (c : Code) : UnitEq (Code.comp c Code.id) c := by
  show smartComp (unitNorm c) (unitNorm Code.id) = unitNorm c
  rw [unitNorm_id]
  by_cases h : unitNorm c = Code.id
  · simp only [smartComp, h, ite_true]
  · simp only [smartComp, h, ite_false, ite_true]

/-- 定理 M.1(d)：左の単位律。 -/
theorem unitEq_id_comp (c : Code) : UnitEq (Code.comp Code.id c) c := by
  show smartComp (unitNorm Code.id) (unitNorm c) = unitNorm c
  rw [unitNorm_id]
  simp only [smartComp, ite_true]

/-- 定理 M.1(d)：木の等しさより真に粗い。 -/
theorem unitEq_not_eq : UnitEq (Code.comp Code.id Code.id) Code.id ∧
    Code.comp Code.id Code.id ≠ Code.id :=
  ⟨unitEq_comp_id _, by decide⟩

/-- 定理 M.1(d)：意味へは完全でない。畳んでも違う木で、同じ意味（計算を捨てる物）。 -/
theorem unitEq_incomplete : ¬ UnitEq (Code.comp Code.zero Code.succ) Code.zero ∧
    (Code.comp Code.zero Code.succ).eval = Code.zero.eval :=
  ⟨by decide, zero_comp_succ_eval⟩

/-- 定理 M.1：3つの段。木の `=` ⊊ `UnitEq` ⊊ 意味の `=`（対の集まりとして、左ほど細かい）。 -/
theorem three_levels :
    (∀ c₁ c₂ : Code, c₁ = c₂ → UnitEq c₁ c₂) ∧
    (∃ c₁ c₂ : Code, UnitEq c₁ c₂ ∧ c₁ ≠ c₂) ∧
    (∀ c₁ c₂ : Code, UnitEq c₁ c₂ → c₁.eval = c₂.eval) ∧
    (∃ c₁ c₂ : Code, c₁.eval = c₂.eval ∧ ¬ UnitEq c₁ c₂) :=
  ⟨fun _ _ => eq_unitEq, ⟨_, _, unitEq_not_eq⟩, fun _ _ => unitEq_sound,
    ⟨_, _, unitEq_incomplete.2, unitEq_incomplete.1⟩⟩

end Levels

/-! ## M.2 意味の側 -/

section Meaning

/-- 定理 M.2(a)：どの `c₀` でも、「意味が `c₀` と同じか」は計算できる述語でない。 -/
theorem eval_eq_not_computable (c₀ : Code) :
    ¬ ComputablePred (fun c : Code => c.eval = c₀.eval) := by
  intro h
  have H := (ComputablePred.rice₂ {c : Code | c.eval = c₀.eval}
    (fun cf cg e => by
      show cf.eval = c₀.eval ↔ cg.eval = c₀.eval
      rw [e])).1 h
  rcases H with h0 | h1
  · have hm : c₀ ∈ ({c : Code | c.eval = c₀.eval} : Set Code) := rfl
    rw [h0] at hm
    exact hm
  · have h0 : Code.const 0 ∈ ({c : Code | c.eval = c₀.eval} : Set Code) := by
      rw [h1]; exact Set.mem_univ _
    have h1' : Code.const 1 ∈ ({c : Code | c.eval = c₀.eval} : Set Code) := by
      rw [h1]; exact Set.mem_univ _
    have e : (Code.const 0).eval 0 = (Code.const 1).eval 0 :=
      congrFun ((show (Code.const 0).eval = c₀.eval from h0).trans
        (show (Code.const 1).eval = c₀.eval from h1').symm) 0
    rw [Code.eval_const, Code.eval_const] at e
    exact absurd (Part.some_injective e) (by decide)

/-- 定理 M.2(a)：2つの木を受ける形。意味の等しさは計算できる述語でない。 -/
theorem eval_eq_pair_not_computable :
    ¬ ComputablePred (fun p : Code × Code => p.1.eval = p.2.eval) := by
  rintro ⟨inst, hc⟩
  apply eval_eq_not_computable Code.zero
  exact ⟨fun c => inst (c, Code.zero),
    hc.comp (Computable.pair Computable.id (Computable.const Code.zero))⟩

/-- 定理 M.2(b)：処理系（木と入力の2つを受ける `Code.eval`）は部分再帰。 -/
theorem interpreter_partrec : Partrec₂ Code.eval := Code.eval_part

/-- 定理 M.2(b)：木の意味の全体は、部分再帰関数のちょうど全部。 -/
theorem interpreter_universal {f : ℕ →. ℕ} : Nat.Partrec f ↔ ∃ c : Code, c.eval = f :=
  Code.exists_code

/-- 定理 M.2(c)：区切った処理系は原始再帰（全域で、いつも Option の値を返す）。 -/
theorem bounded_interpreter_primrec :
    Primrec fun a : (ℕ × Code) × ℕ => Code.evaln a.1.1 a.1.2 a.2 :=
  Code.primrec_evaln

/-- 定理 M.2(c)：燃料 k で区切った処理系は、入力が k 以上なら値を持たない。 -/
theorem bounded_interpreter_bound {k : ℕ} {c : Code} {n x : ℕ} (h : x ∈ Code.evaln k c n) :
    n < k :=
  Code.evaln_bound h

/-- 定理 M.2(c)：区切った処理系を全部の燃料で合わせると、木の意味（`c.eval`）になる。 -/
theorem bounded_interpreter_complete {c : Code} {n x : ℕ} :
    x ∈ c.eval n ↔ ∃ k, x ∈ Code.evaln k c n :=
  Code.evaln_complete

/-- 定理 M.2(d)：再帰定理。計算できる f : Code → Code には、f c と c が同じ意味になる c がある。 -/
theorem recursion_theorem {f : Code → Code} (hf : Computable f) :
    ∃ c : Code, (f c).eval = c.eval :=
  Code.fixed_point hf

/-- 定理 M.2(d)：自分の木の番号を返す木がある。 -/
theorem quine : ∃ c : Code, c.eval = fun _ => Part.some (encode c) :=
  Code.fixed_point₂
    (Computable₂.partrec₂ (f := fun (c : Code) (_ : ℕ) => encode c)
      (Computable.encode.comp Computable.fst))

/-- 定理 M.2(e)：`c` と `succ ∘ c` が同じ意味になる木の意味は、どこでも未定義。 -/
theorem succ_fixed_point_undefined (c : Code) (hc : (Code.comp Code.succ c).eval = c.eval) :
    ∀ n, c.eval n = Part.none := by
  refine fun n => Part.eq_none_iff.2 fun m hm => ?_
  have h2 : m + 1 ∈ (Code.comp Code.succ c).eval n := by
    show m + 1 ∈ (c.eval n).bind Code.succ.eval
    exact Part.mem_bind hm (Part.mem_some (m + 1))
  rw [hc] at h2
  have := Part.mem_unique hm h2
  omega

/-- 定理 M.2(e)：`c` と `succ ∘ c` が同じ意味になる木がある。その木の意味はどこでも未定義。 -/
theorem succ_fixed_point_diverges :
    ∃ c : Code, (Code.comp Code.succ c).eval = c.eval ∧ ∀ n, c.eval n = Part.none := by
  obtain ⟨c, hc⟩ := recursion_theorem (f := fun c => Code.comp Code.succ c)
    (Code.primrec₂_comp.comp (Primrec.const Code.succ) Primrec.id).to_comp
  exact ⟨c, hc, succ_fixed_point_undefined c hc⟩

/-- 定理 M.2(f)：入力 0 での振り分け `J : Code → Option ℕ` で、止まればその値を言い（S1）、
値を言えば本当に止まってその値を返す（S3）、計算できる物は無い。 -/
theorem no_computable_sort (J : Code → Option ℕ) (hJ : Computable J)
    (sound : ∀ c v, J c = some v → v ∈ c.eval 0)
    (complete : ∀ c v, v ∈ c.eval 0 → J c = some v) : False := by
  apply ComputablePred.halting_problem 0
  refine ComputablePred.computable_iff.2 ⟨fun c => (J c).isSome,
    (Primrec.option_isSome.to_comp.comp hJ), ?_⟩
  funext c
  apply propext
  constructor
  · intro hd
    obtain ⟨v, hv⟩ := Part.dom_iff_mem.1 hd
    simp [complete c v hv]
  · intro hs
    rcases h : J c with _ | v
    · simp [h] at hs
    · exact Part.dom_iff_mem.2 ⟨v, sound c v h⟩

/-- 定理 M.2(f)：入力 0 での振り分け `J : Code → Option ℕ` で、止まればその値を言う（S1）だけの、
計算できる物も無い。 -/
theorem no_computable_sort_S1 (J : Code → Option ℕ) (hJ : Computable J)
    (complete : ∀ c v, v ∈ c.eval 0 → J c = some v) : False := by
  have hw : Computable fun c : Code => ((J c).map Nat.succ).getD 0 :=
    Computable.option_getD (Computable.option_map hJ (Computable.succ.comp Computable.snd).to₂)
      (Computable.const 0)
  obtain ⟨c, hc⟩ := recursion_theorem (Code.primrec_const.to_comp.comp hw)
  have h0 : ((J c).map Nat.succ).getD 0 ∈ c.eval 0 := by
    rw [← hc, Code.eval_const]; exact Part.mem_some _
  have hJc := complete c _ h0
  have e : ((J c).map Nat.succ).getD 0 = ((J c).map Nat.succ).getD 0 + 1 := by
    conv_lhs => rw [hJc]
    rfl
  omega

end Meaning

/-! ## M.3 Rice の強い形 -/

section Strong

/-- 定義 M.3：c が入力 0 で止まる時だけ e として振る舞う木。 -/
def haltThen (e c : Code) : Code :=
  Code.comp e (Code.comp Code.right (Code.pair (Code.comp c Code.zero) Code.id))

/-- `haltThen e` は原始再帰。 -/
theorem haltThen_primrec (e : Code) : Primrec (haltThen e) :=
  Code.primrec₂_comp.comp (Primrec.const e)
    (Code.primrec₂_comp.comp (Primrec.const Code.right)
      (Code.primrec₂_pair.comp (Code.primrec₂_comp.comp Primrec.id (Primrec.const Code.zero))
        (Primrec.const Code.id)))

/-- `haltThen e c` は、c が入力 0 で止まってから e を走らせる。 -/
theorem eval_haltThen (e c : Code) (x : ℕ) :
    (haltThen e c).eval x = (c.eval 0).bind (fun _ => e.eval x) := by
  have hz : (Code.comp c Code.zero).eval x = c.eval 0 := by
    show (Part.some 0).bind (fun m => c.eval m) = c.eval 0
    exact Part.bind_some 0 _
  have hp : (Code.pair (Code.comp c Code.zero) Code.id).eval x =
      (c.eval 0).bind (fun y => Part.some (Nat.pair y x)) := by
    show ((Code.comp c Code.zero).eval x).bind
        (fun y => ((Code.id.eval x).map (Nat.pair y))) = _
    rw [hz, Code.eval_id]
    simp only [Part.map_some]
  show (((Code.pair (Code.comp c Code.zero) Code.id).eval x).bind
      (fun m => Part.some (Nat.unpair m).2)).bind (fun m => e.eval m) = _
  rw [hp, Part.bind_assoc, Part.bind_assoc]
  simp only [Part.bind_some, Nat.unpair_pair]

/-- 定理 M.3(a)：⊥ ∉ C で、C に入る意味の木 e があれば、止まる問題は指数集合へ m 還元される。 -/
theorem halting_le_index (C : Set (ℕ →. ℕ)) (hbot : (fun _ => Part.none) ∉ C)
    (e : Code) (he : e.eval ∈ C) :
    (fun c : Code => (c.eval 0).Dom) ≤₀ (fun c : Code => c.eval ∈ C) := by
  refine ⟨haltThen e, (haltThen_primrec e).to_comp, fun c => ?_⟩
  show (c.eval 0).Dom ↔ (haltThen e c).eval ∈ C
  by_cases h : (c.eval 0).Dom
  · obtain ⟨v, hv⟩ := Part.dom_iff_mem.1 h
    have : (haltThen e c).eval = e.eval := by
      funext x; rw [eval_haltThen, Part.eq_some_iff.2 hv, Part.bind_some]
    rw [this]; exact ⟨fun _ => he, fun _ => h⟩
  · have : (haltThen e c).eval = fun _ => Part.none := by
      funext x; rw [eval_haltThen, Part.eq_none_iff'.2 h, Part.bind_none]
    rw [this]; exact ⟨fun h' => absurd h' h, fun h' => absurd h' hbot⟩

/-- 定理 M.3(b)：⊥ ∈ C で、C に入らない意味の木 e があれば、止まらない問題が指数集合へ m 還元
される。 -/
theorem nonhalting_le_index (C : Set (ℕ →. ℕ)) (hbot : (fun _ => Part.none) ∈ C)
    (e : Code) (he : e.eval ∉ C) :
    (fun c : Code => ¬ (c.eval 0).Dom) ≤₀ (fun c : Code => c.eval ∈ C) := by
  obtain ⟨f, hf, hr⟩ := halting_le_index Cᶜ (fun h' => h' hbot) e he
  refine ⟨f, hf, fun c => ?_⟩
  show ¬ (c.eval 0).Dom ↔ (f c).eval ∈ C
  have h1 : (c.eval 0).Dom → (f c).eval ∉ C := (hr c).1
  have h2 : (f c).eval ∉ C → (c.eval 0).Dom := (hr c).2
  exact ⟨fun hn => Classical.byContradiction fun hm => hn (h2 hm), fun hm hd => h1 hd hm⟩

/-- 定理 M.3(c)：強い形から Rice がもう一度出る。非自明な C の指数集合は計算できる述語でない。 -/
theorem rice_again (C : Set (ℕ →. ℕ)) (e₁ e₂ : Code) (h₁ : e₁.eval ∈ C) (h₂ : e₂.eval ∉ C) :
    ¬ ComputablePred (fun c : Code => c.eval ∈ C) := by
  intro h
  by_cases hbot : (fun _ => Part.none) ∈ C
  · have h' := ComputablePred.computable_of_manyOneReducible
      (nonhalting_le_index C hbot e₂ h₂) h
    exact ComputablePred.halting_problem 0 (by simpa using h'.not)
  · exact ComputablePred.halting_problem 0
      (ComputablePred.computable_of_manyOneReducible (halting_le_index C hbot e₁ h₁) h)

/-- 定理 M.3(d) の補い：神託つきで計算できる物の前に、計算できる写像を当てても神託つきで計算できる。 -/
theorem computableIn_precomp {α β σ : Type} [Primcodable α] [Primcodable β] [Primcodable σ]
    {O : Set (ℕ →. ℕ)} {g : β → σ} {h : α → β} (hg : ComputableIn O g) (hh : Computable h) :
    ComputableIn O (fun a => g (h a)) := by
  have hh' : Nat.RecursiveIn O (fun n => Part.bind (Encodable.decode (α := α) n)
      fun a => (Part.some (h a)).map Encodable.encode) := Nat.Partrec.recursiveIn hh
  refine Nat.RecursiveIn.of_eq (Nat.RecursiveIn.comp hg hh') ?_
  intro n
  rcases hd : Encodable.decode (α := α) n with _ | a
  · simp
  · simp [Encodable.encodek]

/-- 定理 M.3(d) の補い：神託つきで計算できる物の後に、計算できる写像を当てても神託つきで計算できる。 -/
theorem computableIn_postcomp {α β σ : Type} [Primcodable α] [Primcodable β] [Primcodable σ]
    {O : Set (ℕ →. ℕ)} {f : α → β} {g : β → σ} (hf : ComputableIn O f) (hg : Computable g) :
    ComputableIn O (fun a => g (f a)) := by
  have hg' : Nat.RecursiveIn O (fun n => Part.bind (Encodable.decode (α := β) n)
      fun b => (Part.some (g b)).map Encodable.encode) := Nat.Partrec.recursiveIn hg
  refine Nat.RecursiveIn.of_eq (Nat.RecursiveIn.comp hg' hf) ?_
  intro n
  rcases hd : Encodable.decode (α := α) n with _ | a
  · simp
  · simp [Encodable.encodek]

/-- 定理 M.3(d)：非自明な C の指数集合を決める関数が神託 O で計算できれば、止まる問題を決める関数も
O で計算できる。 -/
theorem halting_computableIn_of_index (O : Set (ℕ →. ℕ)) (C : Set (ℕ →. ℕ))
    (e₁ e₂ : Code) (h₁ : e₁.eval ∈ C) (h₂ : e₂.eval ∉ C)
    (f : Code → Bool) (hf : ComputableIn O f) (hfC : ∀ c, f c = true ↔ c.eval ∈ C) :
    ∃ g : Code → Bool, ComputableIn O g ∧ ∀ c, g c = true ↔ (c.eval 0).Dom := by
  by_cases hbot : (fun _ => Part.none) ∈ C
  · obtain ⟨r, hr, hrr⟩ := nonhalting_le_index C hbot e₂ h₂
    refine ⟨fun c => !(f (r c)), computableIn_postcomp (computableIn_precomp hf hr)
      Primrec.not.to_comp, fun c => ?_⟩
    show (!(f (r c))) = true ↔ (c.eval 0).Dom
    cases hv : f (r c) with
    | false =>
        have hn : (r c).eval ∉ C := fun hm => by
          have := (hfC (r c)).2 hm
          rw [hv] at this
          exact Bool.false_ne_true this
        exact ⟨fun _ => Classical.byContradiction fun hd => hn ((hrr c).1 hd), fun _ => rfl⟩
    | true =>
        have hm : (r c).eval ∈ C := (hfC (r c)).1 hv
        exact ⟨fun h => absurd h (by decide), fun hd => absurd hd ((hrr c).2 hm)⟩
  · obtain ⟨r, hr, hrr⟩ := halting_le_index C hbot e₁ h₁
    exact ⟨fun c => f (r c), computableIn_precomp hf hr, fun c => (hfC (r c)).trans (hrr c).symm⟩

end Strong

/-! ## M.4(e) いつか出力するかは決まらない -/

section Emit

/-- 定義 M.4(e)：計算の節の意味。燃料 n で区切った `Code.evaln`。 -/
def codeEv (n : ℕ) (c : Code) (s : ℕ) : Option ℕ := Code.evaln n c s

/-- 定理 M.4(a) の Code の形：`codeEv` は、ある燃料で値を持てば燃料を足しても同じ値を持つ。 -/
theorem codeEv_mono : ∀ n c s v, codeEv n c s = some v → codeEv (n + 1) c s = some v :=
  fun n _ _ _ h => Code.evaln_mono (Nat.le_succ n) h

/-- 定理 M.4(a) の Code の形：多い燃料の跡は、少ない燃料の跡を頭に持つ。 -/
theorem codeTrace_prefix_le {n m : ℕ} (h : n ≤ m) (p : Prog Code) (s : ℕ) :
    ∃ t, trace codeEv m p s = trace codeEv n p s ++ t :=
  trace_prefix_le codeEv codeEv_mono h p s

/-- 定義 M.4(e)：計算の節を走らせてから 1 を出力する木。 -/
def probe (c : Code) : Prog Code := .seq (.call c) (.emit 1)

/-- 定理 M.4(e)：この木が出力の節を含むかは、どの c でも true。 -/
theorem hasEmit_probe (c : Code) : hasEmit (probe c) = true := rfl

/-- `probe c` の燃料 n での跡は、c が燃料 n で入力 0 から止まれば `[1]`、止まらなければ空。 -/
theorem trace_probe (n : ℕ) (c : Code) :
    trace codeEv n (probe c) 0 = match Code.evaln n c 0 with | some _ => [1] | none => [] := by
  cases n with
  | zero => simp [trace, run, step, probe, andThen, codeEv, Code.evaln]
  | succ n =>
      show (andThen ([], Code.evaln (n + 1) c 0) (run codeEv (n + 1) (.emit 1))).1 = _
      rcases Code.evaln (n + 1) c 0 with _ | v <;> rfl

/-- 定理 M.4(e)：`probe c` が状態 0 からいつか出力する ⇔ c が入力 0 で止まる。 -/
theorem eventuallyEmits_probe (c : Code) :
    EventuallyEmits codeEv (probe c) 0 ↔ (c.eval 0).Dom := by
  constructor
  · rintro ⟨n, hn⟩
    rw [trace_probe] at hn
    rcases h : Code.evaln n c 0 with _ | v
    · rw [h] at hn; exact absurd rfl hn
    · exact Part.dom_iff_mem.2 ⟨v, Code.evaln_complete.2 ⟨n, h⟩⟩
  · intro hd
    obtain ⟨v, hv⟩ := Part.dom_iff_mem.1 hd
    obtain ⟨n, hn⟩ := Code.evaln_complete.1 hv
    refine ⟨n, ?_⟩
    rw [trace_probe]
    rw [Option.mem_def] at hn
    rw [hn]; simp

/-- 定理 M.4(e)：`c ↦ (call c ; emit 1)` が始めの状態 0 から燃料のどこかで出力するかは、
計算できる述語でない。 -/
theorem eventuallyEmits_not_computable :
    ¬ ComputablePred (fun c : Code => EventuallyEmits codeEv (probe c) 0) := by
  have e : (fun c : Code => EventuallyEmits codeEv (probe c) 0) = (fun c => (c.eval 0).Dom) :=
    funext fun c => propext (eventuallyEmits_probe c)
  rw [e]
  exact ComputablePred.halting_problem 0

end Emit

end SignMath.Machine
