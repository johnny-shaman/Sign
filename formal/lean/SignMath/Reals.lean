import Mathlib.Analysis.Real.OfDigits
import Mathlib.Analysis.Real.Cardinality
import SignMath.Digits

/-!
# J（J-3・J-4 の ℝ の側）. 桁の列の値を Mathlib の `Real.ofDigits` につなぐ

`Digits.lean` は値の等しさと順を ℕ の不等式（`SameVal`・`ValLE`・`ValLT`・`HasVal`・`ISameVal`）で
書いた。このファイルは、それが Mathlib の `Real.ofDigits`（`b = 10`）の =・≤・< と同じことを言う。
ℝ は Mathlib の物なので、証明には `Classical.choice` が出る（印は〔L〕）。
-/

namespace SignMath

/-- 整数部つきの名前の値。 -/
noncomputable def ivalue (x : IName) : ℝ := (x.int : ℝ) + Real.ofDigits x.frac

/-! ### J.15(e) 橋 -/

/-- 定理 J.15(e)：尺度つきの部分和は `Real.ofDigits` の部分和。 -/
theorem approx_eq_sum (s : Digits) (N : Nat) :
    (approx s N : ℝ) / 10 ^ (N + 1) = ∑ i ∈ Finset.range (N + 1), Real.ofDigitsTerm s i := by
  induction N with
  | zero => simp [approx, Real.ofDigitsTerm]; ring
  | succ N ih =>
    rw [Finset.sum_range_succ, ← ih]
    simp only [approx, Real.ofDigitsTerm]
    push_cast
    field_simp
    ring

-- 10^(N+1) 倍の値は、部分和と尾の値の和
private theorem reals_split (s : Digits) (N : Nat) :
    Real.ofDigits s * 10 ^ (N + 1) =
      (approx s N : ℝ) + Real.ofDigits (fun i => s (i + (N + 1))) := by
  have h := Real.ofDigits_eq_sum_add_ofDigits s (N + 1)
  rw [← approx_eq_sum] at h
  rw [h]
  push_cast
  field_simp

-- 要の区間：approx s N ≤ 10^(N+1)·ofDigits s ≤ approx s N + 1
private theorem reals_bracket (s : Digits) (N : Nat) :
    (approx s N : ℝ) ≤ Real.ofDigits s * 10 ^ (N + 1) ∧
    Real.ofDigits s * 10 ^ (N + 1) ≤ (approx s N : ℝ) + 1 := by
  have e := reals_split s N
  have h0 := Real.ofDigits_nonneg (fun i => s (i + (N + 1)))
  have h1 := Real.ofDigits_le_one (fun i => s (i + (N + 1)))
  rw [e]
  constructor <;> linarith

-- アルキメデス性：どの N でも (x - y)·10^(N+1) ≤ C なら x ≤ y
private theorem reals_small_le (x y C : ℝ) (h : ∀ N : Nat, (x - y) * 10 ^ (N + 1) ≤ C) :
    x ≤ y := by
  by_contra hne
  have hd : 0 < x - y := by linarith [not_le.mp hne]
  obtain ⟨n, hn⟩ := pow_unbounded_of_one_lt (C / (x - y)) (by norm_num : (1 : ℝ) < 10)
  rw [div_lt_iff₀ hd] at hn
  have hp : (10 : ℝ) ^ n ≤ 10 ^ (n + 1) := pow_le_pow_right₀ (by norm_num) (by omega)
  have hm := mul_le_mul_of_nonneg_left hp hd.le
  have h1 := h n
  linarith

private theorem reals_small_eq (x y C : ℝ) (h1 : ∀ N : Nat, (x - y) * 10 ^ (N + 1) ≤ C)
    (h2 : ∀ N : Nat, (y - x) * 10 ^ (N + 1) ≤ C) : x = y :=
  le_antisymm (reals_small_le x y C h1) (reals_small_le y x C h2)

/-- 定理 J.15(e)：`SameVal` は `Real.ofDigits` の等しさ。 -/
theorem sameVal_iff_ofDigits (s t : Digits) :
    SameVal s t ↔ Real.ofDigits s = Real.ofDigits t := by
  constructor
  · intro h
    apply reals_small_eq _ _ 2
    · intro N
      obtain ⟨a1, a2⟩ := reals_bracket s N
      obtain ⟨b1, b2⟩ := reals_bracket t N
      have c1 : (approx s N : ℝ) ≤ approx t N + 1 := by exact_mod_cast (h N).1
      rw [sub_mul]; linarith
    · intro N
      obtain ⟨a1, a2⟩ := reals_bracket s N
      obtain ⟨b1, b2⟩ := reals_bracket t N
      have c2 : (approx t N : ℝ) ≤ approx s N + 1 := by exact_mod_cast (h N).2
      rw [sub_mul]; linarith
  · intro h N
    obtain ⟨a1, a2⟩ := reals_bracket s N
    obtain ⟨b1, b2⟩ := reals_bracket t N
    rw [h] at a1 a2
    constructor
    · have : (approx s N : ℝ) ≤ approx t N + 1 := by linarith
      exact_mod_cast this
    · have : (approx t N : ℝ) ≤ approx s N + 1 := by linarith
      exact_mod_cast this

/-- 定理 J.15(e)：`ValLE` は `Real.ofDigits` の ≤。 -/
theorem valLE_iff_ofDigits (s t : Digits) :
    ValLE s t ↔ Real.ofDigits s ≤ Real.ofDigits t := by
  constructor
  · intro h
    apply reals_small_le _ _ 2
    intro N
    obtain ⟨a1, a2⟩ := reals_bracket s N
    obtain ⟨b1, b2⟩ := reals_bracket t N
    have c1 : (approx s N : ℝ) ≤ approx t N + 1 := by exact_mod_cast h N
    rw [sub_mul]; linarith
  · intro h N
    obtain ⟨a1, a2⟩ := reals_bracket s N
    obtain ⟨b1, b2⟩ := reals_bracket t N
    have hm : Real.ofDigits s * 10 ^ (N + 1) ≤ Real.ofDigits t * 10 ^ (N + 1) :=
      mul_le_mul_of_nonneg_right h (by positivity)
    have : (approx s N : ℝ) ≤ approx t N + 1 := by linarith
    exact_mod_cast this

/-- 定理 J.15(e)：`ValLT` は `Real.ofDigits` の <。 -/
theorem valLT_iff_ofDigits (s t : Digits) :
    ValLT s t ↔ Real.ofDigits s < Real.ofDigits t := by
  have e : ValLT s t ↔ ¬ ValLE t s := by
    unfold ValLT ValLE
    push Not
    constructor
    · rintro ⟨N, hN⟩; exact ⟨N, by omega⟩
    · rintro ⟨N, hN⟩; exact ⟨N, by omega⟩
  rw [e, valLE_iff_ofDigits, not_le]

/-- 定理 J.15(e)：`HasVal s a c` は「c > 0 で、`Real.ofDigits s` が a / c」。 -/
theorem hasVal_iff_ofDigits (s : Digits) (a c : Nat) :
    HasVal s a c ↔ 0 < c ∧ Real.ofDigits s = (a : ℝ) / c := by
  constructor
  · rintro ⟨hc, h⟩
    refine ⟨hc, ?_⟩
    have hc' : (0 : ℝ) < c := by exact_mod_cast hc
    rw [eq_div_iff hc'.ne']
    apply reals_small_eq _ _ c
    · intro N
      obtain ⟨a1, a2⟩ := reals_bracket s N
      have c1 : (c : ℝ) * approx s N ≤ a * 10 ^ (N + 1) := by exact_mod_cast (h N).1
      have m2 := mul_le_mul_of_nonneg_left a2 hc'.le
      nlinarith
    · intro N
      obtain ⟨a1, a2⟩ := reals_bracket s N
      have c2 : (a : ℝ) * 10 ^ (N + 1) ≤ c * (approx s N + 1) := by exact_mod_cast (h N).2
      have m1 := mul_le_mul_of_nonneg_left a1 hc'.le
      nlinarith
  · rintro ⟨hc, h⟩
    refine ⟨hc, fun N => ?_⟩
    have hc' : (0 : ℝ) < c := by exact_mod_cast hc
    obtain ⟨a1, a2⟩ := reals_bracket s N
    have e : (a : ℝ) * 10 ^ (N + 1) = c * (Real.ofDigits s * 10 ^ (N + 1)) := by
      rw [h]; field_simp
    have m1 := mul_le_mul_of_nonneg_left a1 hc'.le
    have m2 := mul_le_mul_of_nonneg_left a2 hc'.le
    constructor
    · have : (c : ℝ) * approx s N ≤ a * 10 ^ (N + 1) := by rw [e]; exact m1
      exact_mod_cast this
    · have : (a : ℝ) * 10 ^ (N + 1) ≤ c * (approx s N + 1) := by rw [e]; exact m2
      exact_mod_cast this

-- 整数部つきの区間
private theorem reals_ibracket (x : IName) (N : Nat) :
    (iapprox x N : ℝ) ≤ ivalue x * 10 ^ (N + 1) ∧
    ivalue x * 10 ^ (N + 1) ≤ (iapprox x N : ℝ) + 1 := by
  obtain ⟨a1, a2⟩ := reals_bracket x.frac N
  have e : (iapprox x N : ℝ) = (x.int : ℝ) * 10 ^ (N + 1) + approx x.frac N := by
    unfold iapprox; push_cast; ring
  have e2 : ivalue x * 10 ^ (N + 1) =
      (x.int : ℝ) * 10 ^ (N + 1) + Real.ofDigits x.frac * 10 ^ (N + 1) := by
    unfold ivalue; ring
  rw [e, e2]
  constructor <;> linarith

/-- 定理 J.15(e)：`ISameVal` は整数部つきの値の等しさ。 -/
theorem isameVal_iff_ivalue (x y : IName) : ISameVal x y ↔ ivalue x = ivalue y := by
  constructor
  · intro h
    apply reals_small_eq _ _ 2
    · intro N
      obtain ⟨a1, a2⟩ := reals_ibracket x N
      obtain ⟨b1, b2⟩ := reals_ibracket y N
      have c1 : (iapprox x N : ℝ) ≤ iapprox y N + 1 := by exact_mod_cast (h N).1
      rw [sub_mul]; linarith
    · intro N
      obtain ⟨a1, a2⟩ := reals_ibracket x N
      obtain ⟨b1, b2⟩ := reals_ibracket y N
      have c2 : (iapprox y N : ℝ) ≤ iapprox x N + 1 := by exact_mod_cast (h N).2
      rw [sub_mul]; linarith
  · intro h N
    obtain ⟨a1, a2⟩ := reals_ibracket x N
    obtain ⟨b1, b2⟩ := reals_ibracket y N
    rw [h] at a1 a2
    constructor
    · have : (iapprox x N : ℝ) ≤ iapprox y N + 1 := by linarith
      exact_mod_cast this
    · have : (iapprox y N : ℝ) ≤ iapprox x N + 1 := by linarith
      exact_mod_cast this

/-- 定理 J.17(g)：`Times9 s x` は「x の値が s の値の 9 倍」。 -/
theorem times9_iff_ivalue (s : Digits) (x : IName) :
    Times9 s x ↔ ivalue x = 9 * Real.ofDigits s := by
  constructor
  · intro h
    apply reals_small_eq _ _ 10
    · intro N
      obtain ⟨a1, a2⟩ := reals_bracket s N
      obtain ⟨b1, b2⟩ := reals_ibracket x N
      have c1 : 9 * (approx s N : ℝ) ≤ iapprox x N + 1 := by exact_mod_cast (h N).1
      have c2 : (iapprox x N : ℝ) ≤ 9 * approx s N + 9 := by exact_mod_cast (h N).2
      rw [sub_mul]; linarith
    · intro N
      obtain ⟨a1, a2⟩ := reals_bracket s N
      obtain ⟨b1, b2⟩ := reals_ibracket x N
      have c1 : 9 * (approx s N : ℝ) ≤ iapprox x N + 1 := by exact_mod_cast (h N).1
      have c2 : (iapprox x N : ℝ) ≤ 9 * approx s N + 9 := by exact_mod_cast (h N).2
      rw [sub_mul]; linarith
  · intro h N
    obtain ⟨a1, a2⟩ := reals_bracket s N
    obtain ⟨b1, b2⟩ := reals_ibracket x N
    have e : ivalue x * 10 ^ (N + 1) = 9 * (Real.ofDigits s * 10 ^ (N + 1)) := by
      rw [h]; ring
    rw [e] at b1 b2
    constructor
    · have : 9 * (approx s N : ℝ) ≤ iapprox x N + 1 := by linarith
      exact_mod_cast this
    · have : (iapprox x N : ℝ) ≤ 9 * approx s N + 9 := by linarith
      exact_mod_cast this

-- 0.(k) は 10x = k + x を満たすので x = k / 9
private theorem reals_ofDigits_const (k : Fin 10) :
    Real.ofDigits (fun _ => k) = (k.val : ℝ) / 9 := by
  have e := reals_split (fun _ => k) 0
  simp only [approx, zero_add, pow_one] at e
  rw [eq_div_iff (by norm_num)]
  linarith

/-- 定理 J.15(e)：0.1000… と 0.0999… の値はどちらも 1/10。 -/
theorem ofDigits_tenth_nines0 :
    Real.ofDigits tenth = 1 / 10 ∧ Real.ofDigits nines0 = 1 / 10 := by
  constructor
  · have e := reals_split tenth 0
    have ht : (fun i => tenth (i + (0 + 1))) = fun _ => (0 : Fin 10) := by
      funext i; simp [tenth]
    rw [ht, reals_ofDigits_const] at e
    simp [approx, tenth] at e
    linarith
  · have e := reals_split nines0 0
    have ht : (fun i => nines0 (i + (0 + 1))) = fun _ => (9 : Fin 10) := by
      funext i; simp [nines0]
    rw [ht, reals_ofDigits_const] at e
    simp [approx, nines0] at e
    linarith

/-- 定理 J.15(e)：名前から値への写像は単射でない。 -/
theorem ofDigits_not_injective : ¬ Function.Injective (Real.ofDigits : Digits → ℝ) := by
  intro h
  have e : Real.ofDigits tenth = Real.ofDigits nines0 := by
    rw [ofDigits_tenth_nines0.1, ofDigits_tenth_nines0.2]
  have h0 := congrFun (h e) 0
  simp [tenth, nines0] at h0

/-- 定理 J.15(e)：0.(9) と 1.(0) の値はどちらも 1。 -/
theorem ivalue_nines_one : ivalue ⟨0, fun _ => 9⟩ = 1 ∧ ivalue ⟨1, zeros⟩ = 1 := by
  constructor
  · unfold ivalue
    rw [reals_ofDigits_const]
    norm_num
  · unfold ivalue zeros
    rw [reals_ofDigits_const]
    norm_num

/-! ### J.16(d) 循環小数の値 -/

/-- 定理 J.16(d)：0.(k) の値は k / 9。 -/
theorem ofDigits_const (k : Fin 10) : Real.ofDigits (fun _ => k) = (k.val : ℝ) / 9 :=
  reals_ofDigits_const k

-- p 桁の塊 B の桁の和は (B mod 10^p) / 10^p
private theorem reals_digit_sum (p B : Nat) :
    ∑ i ∈ Finset.range p, ((B / 10 ^ (p - 1 - i) % 10 : Nat) : ℝ) * ((10 : ℝ) ^ (i + 1))⁻¹
      = ((B % 10 ^ p : Nat) : ℝ) / 10 ^ p := by
  induction p with
  | zero => simp [Nat.mod_one]
  | succ p ih =>
    rw [Finset.sum_range_succ']
    have e : ∀ i ∈ Finset.range p,
        ((B / 10 ^ (p + 1 - 1 - (i + 1)) % 10 : Nat) : ℝ) * ((10 : ℝ) ^ (i + 1 + 1))⁻¹
          = (((B / 10 ^ (p - 1 - i) % 10 : Nat) : ℝ) * ((10 : ℝ) ^ (i + 1))⁻¹) * 10⁻¹ := by
      intro i _
      have hi : p + 1 - 1 - (i + 1) = p - 1 - i := by omega
      rw [hi, pow_succ, mul_inv, mul_assoc]
    rw [Finset.sum_congr rfl e, ← Finset.sum_mul, ih]
    have hm : B % 10 ^ (p + 1) = B % 10 ^ p + 10 ^ p * (B / 10 ^ p % 10) := by
      rw [pow_succ, Nat.mod_mul]
    have h0 : p + 1 - 1 - 0 = p := by omega
    rw [h0, hm]
    push_cast
    field_simp
    ring

/-- 定理 J.16(d)：名前の側の φ_B（塊 B を前に置く）は、値の側の φ_B(x) = (B + x) / 10^p に写る。 -/
theorem ofDigits_prepend (p B : Nat) (hB : B < 10 ^ p) (s : Digits) :
    Real.ofDigits (prepend p B s) = ((B : ℝ) + Real.ofDigits s) / 10 ^ p := by
  have h := Real.ofDigits_eq_sum_add_ofDigits (prepend p B s) p
  have ht : (fun i => prepend p B s (i + p)) = s := by
    funext i; simp [prepend]
  have hs : ∑ i ∈ Finset.range p, Real.ofDigitsTerm (prepend p B s) i = (B : ℝ) / 10 ^ p := by
    have d := reals_digit_sum p B
    rw [Nat.mod_eq_of_lt hB] at d
    rw [← d]
    apply Finset.sum_congr rfl
    intro i hi
    rw [Finset.mem_range] at hi
    simp [Real.ofDigitsTerm, prepend, rep, hi, Nat.mod_eq_of_lt hi]
  rw [h, hs, ht]
  push_cast
  ring

/-- 定理 J.16(d)：0.(B) の値は B / (10^p − 1)。 -/
theorem ofDigits_rep (p B : Nat) (hp : 0 < p) (hB : B < 10 ^ p) :
    Real.ofDigits (rep p B) = (B : ℝ) / (10 ^ p - 1) := by
  have hf : prepend p B (rep p B) = rep p B := by
    funext i
    unfold prepend
    split_ifs with hi
    · rfl
    · apply Fin.ext
      simp only [rep]
      rw [← Nat.mod_eq_sub_mod (by omega)]
  have h := ofDigits_prepend p B hB (rep p B)
  rw [hf] at h
  have h10 : (1 : ℝ) < 10 ^ p := one_lt_pow₀ (by norm_num) (by omega)
  rw [eq_div_iff (by linarith)]
  rw [eq_div_iff (by positivity)] at h
  linarith

/-! ### J.18(c)・J.21(d) 数え上げられる名前は ℝ に届かない -/

/-- 定理 J.18(c)：数え上げられるどの名前の集まりからも、ℝ への全射は無い。 -/
theorem names_not_surjective {T : Type*} [Countable T] (v : T → ℝ) :
    ¬ Function.Surjective v := by
  intro h
  apply Cardinal.not_countable_real
  rw [← Set.range_eq_univ.mpr h]
  exact Set.countable_range v

-- 桁が n まで同じなら部分和も同じ
private theorem reals_approx_congr (s t : Digits) (n : Nat) (h : ∀ i, i ≤ n → s i = t i) :
    approx s n = approx t n := by
  induction n with
  | zero => simp [approx, h 0 le_rfl]
  | succ n ih =>
    simp only [approx]
    rw [ih (fun i hi => h i (by omega)), h (n + 1) le_rfl]

-- 桁が n の手前まで同じなら、部分和の差は n 桁目の差だけ
private theorem reals_approx_head (s t : Digits) (n : Nat) (h : ∀ i, i < n → s i = t i) :
    approx s n + (t n).val = approx t n + (s n).val := by
  cases n with
  | zero => simp only [approx]; omega
  | succ k =>
    simp only [approx]
    rw [reals_approx_congr s t k (fun i hi => h i (by omega))]
    omega

-- 対角線の桁は 4 か 5
private theorem reals_diag_digit (v : Nat → Digits) (j : Nat) :
    4 ≤ (diag v j).val ∧ (diag v j).val ≤ 5 := by
  unfold diag
  split_ifs <;> decide

/-- 定理 J.21(d)：0 と 9 を避けた対角線の値は、表のどの行の値とも違う。 -/
theorem diag_ofDigits_ne (v : Nat → Digits) (m : Nat) :
    Real.ofDigits (diag v) ≠ Real.ofDigits (v m) := by
  intro heq
  have hall : ∀ n, diag v n = v m n := by
    intro n
    induction n using Nat.strong_induction_on with
    | _ n ih =>
      have hh := reals_approx_head (diag v) (v m) n ih
      have hh' : (approx (diag v) n : ℝ) + ((v m n).val : ℝ) =
          (approx (v m) n : ℝ) + ((diag v n).val : ℝ) := by exact_mod_cast hh
      have ed := reals_split (diag v) n
      have et := reals_split (v m) n
      rw [heq] at ed
      -- 対角線の尾の値は [4/10, 6/10]
      have es := reals_split (fun i => diag v (i + (n + 1))) 0
      simp only [approx, zero_add, pow_one] at es
      have g0 := Real.ofDigits_nonneg (fun i => diag v (i + 1 + (n + 1)))
      have g1 := Real.ofDigits_le_one (fun i => diag v (i + 1 + (n + 1)))
      obtain ⟨d4, d5⟩ := reals_diag_digit v (n + 1)
      have d4' : (4 : ℝ) ≤ ((diag v (n + 1)).val : ℝ) := by exact_mod_cast d4
      have d5' : ((diag v (n + 1)).val : ℝ) ≤ 5 := by exact_mod_cast d5
      have t0 := Real.ofDigits_nonneg (fun i => v m (i + (n + 1)))
      have t1 := Real.ofDigits_le_one (fun i => v m (i + (n + 1)))
      by_contra hne
      have hv : (diag v n).val ≠ (v m n).val := fun e => hne (Fin.ext e)
      rcases Nat.lt_or_gt_of_ne hv with hl | hl
      · have hl' : ((diag v n).val : ℝ) + 1 ≤ (v m n).val := by exact_mod_cast hl
        linarith
      · have hl' : ((v m n).val : ℝ) + 1 ≤ (diag v n).val := by exact_mod_cast hl
        linarith
  have hdm := congrArg Fin.val (hall m)
  unfold diag at hdm
  split_ifs at hdm with h4
  · rw [← hdm] at h4; exact absurd h4 (by decide)
  · exact h4 hdm.symm

end SignMath
