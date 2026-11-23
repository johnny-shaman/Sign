import SignMath.Sorting
import SignMath.Row

/-!
# J（J-3・J-4）. 数の段：名前と値、対角線と不動点（Mathlib を使わない）

桁の列 `Nat → Fin 10` を小数の名前 0.d₀d₁d₂… とし、値の等しさと順を ℕ の不等式で書く
（ℝ を使わない。ℝ との橋は `Reals.lean`）。

この節は Mathlib を使わずに書き、`Classical.choice` を使わずに証明した（印は〔L・選択なし〕）。
core の Rat を使う `phi_fixed_iff` だけは選択を使う（〔L〕）。
-/

namespace SignMath

universe u v w

/-! ## J-3. 名前と値 -/

/-- 桁の列：小数の名前 0.d₀d₁d₂…（値は [0, 1] に入る）。 -/
abbrev Digits : Type := Nat → Fin 10

/-- 尺度つきの部分和 approx s N = Σ_{i ≤ N} s i · 10^(N-i)。
値は区間 [approx s N, approx s N + 1] / 10^(N+1) に入る。 -/
def approx (s : Digits) : Nat → Nat
  | 0 => (s 0).val
  | N + 1 => 10 * approx s N + (s (N + 1)).val

/-- 値が同じ：どの桁で切っても、部分和の差が最後の桁の1単位以内（ℝ の = と同じ、`Reals.lean`）。 -/
def SameVal (s t : Digits) : Prop :=
  ∀ N, approx s N ≤ approx t N + 1 ∧ approx t N ≤ approx s N + 1

/-- 値の順 s ≤ t。 -/
def ValLE (s t : Digits) : Prop := ∀ N, approx s N ≤ approx t N + 1

/-- 値の順 s < t：ある桁で、部分和の差が2単位以上。 -/
def ValLT (s t : Digits) : Prop := ∃ N, approx s N + 2 ≤ approx t N

/-- 列 s の値は a / c（c > 0）。 -/
def HasVal (s : Digits) (a c : Nat) : Prop :=
  0 < c ∧ ∀ N, c * approx s N ≤ a * 10 ^ (N + 1) ∧ a * 10 ^ (N + 1) ≤ c * (approx s N + 1)

/-- 名前の辞書式の順（狭義の順序。三分は古典の事実で、構成的には LPO と同じ強さ、J.17(d)）。 -/
def LexLt (s t : Digits) : Prop :=
  ∃ k, (∀ i, i < k → s i = t i) ∧ (s k).val < (t k).val

/-- 0.000… -/
def zeros : Digits := fun _ => 0
/-- 0.1000… -/
def tenth : Digits := fun i => if i = 0 then 1 else 0
/-- 0.0999… -/
def nines0 : Digits := fun i => if i = 0 then 0 else 9

/-- 整数部つきの名前 n.d₀d₁d₂…。 -/
structure IName where
  int : Nat
  frac : Digits

/-- 整数部つきの部分和：n · 10^(N+1) + approx frac N。 -/
def iapprox (x : IName) (N : Nat) : Nat := x.int * 10 ^ (N + 1) + approx x.frac N

/-- 整数部つきの名前の値が同じ。 -/
def ISameVal (x y : IName) : Prop :=
  ∀ N, iapprox x N ≤ iapprox y N + 1 ∧ iapprox y N ≤ iapprox x N + 1

/-! ### J.15 名前と値は1対1でない -/

/-- 定理 J.15(a)：0.1000… の部分和は 10^N。 -/
theorem approx_tenth (N : Nat) : approx tenth N = 10 ^ N := by
  induction N with
  | zero => rfl
  | succ n ih =>
    show 10 * approx tenth n + (tenth (n + 1)).val = 10 ^ (n + 1)
    rw [ih, Nat.pow_succ]
    show 10 * 10 ^ n + (if n + 1 = 0 then (1 : Fin 10) else 0).val = 10 ^ n * 10
    rw [ite_eq_right (Nat.succ_ne_zero n)]
    show 10 * 10 ^ n + 0 = 10 ^ n * 10
    omega

/-- 定理 J.15(a)：0.0999… の部分和は 10^N − 1。 -/
theorem approx_nines0 (N : Nat) : approx nines0 N + 1 = 10 ^ N := by
  induction N with
  | zero => rfl
  | succ n ih =>
    show 10 * approx nines0 n + (nines0 (n + 1)).val + 1 = 10 ^ (n + 1)
    rw [Nat.pow_succ]
    show 10 * approx nines0 n + (if n + 1 = 0 then (0 : Fin 10) else 9).val + 1 = 10 ^ n * 10
    rw [ite_eq_right (Nat.succ_ne_zero n)]
    show 10 * approx nines0 n + 9 + 1 = 10 ^ n * 10
    omega

/-- 定理 J.15(a)：0.1000… と 0.0999… は名前が違う。 -/
theorem tenth_ne_nines0 : tenth ≠ nines0 := by
  intro h
  have h0 := congrArg Fin.val (congrFun h 0)
  revert h0
  decide

/-- 定理 J.15(a)：0.1000… と 0.0999… は値が同じ。 -/
theorem sameVal_tenth_nines0 : SameVal tenth nines0 := by
  intro N
  have h1 := approx_tenth N
  have h2 := approx_nines0 N
  constructor <;> omega

/-- 定理 J.15(b)：名前の順では 0.0999… が小さいが、値の順で狭義に小さくはない。 -/
theorem lexLt_not_valLT : LexLt nines0 tenth ∧ ¬ ValLT nines0 tenth := by
  refine ⟨⟨0, fun i hi => absurd hi (Nat.not_lt_zero i), by decide⟩, ?_⟩
  rintro ⟨N, hN⟩
  have h1 := approx_tenth N
  have h2 := approx_nines0 N
  omega

private theorem digitsa_approx_congr {s t : Digits} {N : Nat} (h : ∀ i, i ≤ N → s i = t i) :
    approx s N = approx t N := by
  induction N with
  | zero => show (s 0).val = (t 0).val; rw [h 0 (Nat.le_refl 0)]
  | succ n ih =>
    show 10 * approx s n + (s (n + 1)).val = 10 * approx t n + (t (n + 1)).val
    rw [ih (fun i hi => h i (Nat.le_succ_of_le hi)), h (n + 1) (Nat.le_refl _)]

private theorem digitsa_approx_split {s t : Digits} {k : Nat} (hk : ∀ i, i < k → s i = t i) :
    ∃ c, approx s k = c + (s k).val ∧ approx t k = c + (t k).val := by
  cases k with
  | zero => exact ⟨0, (Nat.zero_add _).symm, (Nat.zero_add _).symm⟩
  | succ n =>
    refine ⟨10 * approx s n, rfl, ?_⟩
    show 10 * approx t n + (t (n + 1)).val = 10 * approx s n + (t (n + 1)).val
    rw [digitsa_approx_congr (fun i hi => (hk i (Nat.lt_succ_of_le hi)).symm)]

private theorem digitsa_lt_from {s t : Digits} {k : Nat} (hk : ∀ i, i < k → s i = t i)
    (hlt : (s k).val < (t k).val) : ∀ d, approx s (k + d) + 1 ≤ approx t (k + d) := by
  intro d
  induction d with
  | zero =>
    obtain ⟨c, hs, ht⟩ := digitsa_approx_split hk
    show approx s k + 1 ≤ approx t k
    omega
  | succ n ih =>
    show 10 * approx s (k + n) + (s (k + n + 1)).val + 1 ≤
      10 * approx t (k + n) + (t (k + n + 1)).val
    have := (s (k + n + 1)).isLt
    omega

/-- 定理 J.15(b)：名前の順から値の順へは単調。 -/
theorem valLE_of_lexLt {s t : Digits} : LexLt s t → ValLE s t := by
  rintro ⟨k, hk, hlt⟩ N
  rcases Nat.lt_or_ge N k with h | h
  · rw [digitsa_approx_congr (fun i hi => hk i (Nat.lt_of_le_of_lt hi h))]
    exact Nat.le_succ _
  · obtain ⟨d, rfl⟩ : ∃ d, N = k + d := ⟨N - k, by omega⟩
    have := digitsa_lt_from hk hlt d
    omega

private theorem digitsa_sameVal_up {s t : Digits} {k : Nat} (hk : ∀ i, i < k → s i = t i)
    (hup : (t k).val = (s k).val + 1) :
    SameVal s t ↔ ∀ i, k < i → (s i).val = 9 ∧ (t i).val = 0 := by
  obtain ⟨c, hs, ht⟩ := digitsa_approx_split hk
  have base : approx t k = approx s k + 1 := by omega
  constructor
  · intro h
    have key : ∀ d, approx t (k + d) = approx s (k + d) + 1 := by
      intro d
      induction d with
      | zero => exact base
      | succ n ih =>
        have h2 := (h (k + n + 1)).2
        change 10 * approx t (k + n) + (t (k + n + 1)).val ≤
          10 * approx s (k + n) + (s (k + n + 1)).val + 1 at h2
        show 10 * approx t (k + n) + (t (k + n + 1)).val =
          10 * approx s (k + n) + (s (k + n + 1)).val + 1
        have := (s (k + n + 1)).isLt
        omega
    intro i hi
    obtain ⟨n, rfl⟩ : ∃ n, i = k + n + 1 := ⟨i - k - 1, by omega⟩
    have e1 := key n
    have e2 := key (n + 1)
    change 10 * approx t (k + n) + (t (k + n + 1)).val =
      10 * approx s (k + n) + (s (k + n + 1)).val + 1 at e2
    have := (s (k + n + 1)).isLt
    constructor <;> omega
  · intro htail N
    rcases Nat.lt_or_ge N k with hN | hN
    · rw [digitsa_approx_congr (fun i hi => hk i (Nat.lt_of_le_of_lt hi hN))]
      exact ⟨Nat.le_succ _, Nat.le_succ _⟩
    · obtain ⟨d, rfl⟩ : ∃ d, N = k + d := ⟨N - k, by omega⟩
      have key : ∀ d, approx t (k + d) = approx s (k + d) + 1 := by
        intro d
        induction d with
        | zero => exact base
        | succ n ih =>
          show 10 * approx t (k + n) + (t (k + n + 1)).val =
            10 * approx s (k + n) + (s (k + n + 1)).val + 1
          have := htail (k + n + 1) (by omega)
          omega
      have := key d
      constructor <;> omega

private theorem digitsa_sameVal_symm {s t : Digits} (h : SameVal s t) : SameVal t s :=
  fun N => ⟨(h N).2, (h N).1⟩

/-- 定理 J.15(c)：最初に違う桁が k の時、値が同じ ⇔ k で1だけ違い、大きい方の尾は全部 0、
小さい方の尾は全部 9。 -/
theorem sameVal_iff_of_first_diff (s t : Digits) (k : Nat)
    (hk : ∀ i, i < k → s i = t i) (hne : s k ≠ t k) :
    SameVal s t ↔
      ((t k).val = (s k).val + 1 ∧ ∀ i, k < i → (s i).val = 9 ∧ (t i).val = 0) ∨
      ((s k).val = (t k).val + 1 ∧ ∀ i, k < i → (t i).val = 9 ∧ (s i).val = 0) := by
  have hk' : ∀ i, i < k → t i = s i := fun i hi => (hk i hi).symm
  have hv : (s k).val ≠ (t k).val := fun h => hne (Fin.ext h)
  constructor
  · intro h
    obtain ⟨c, hs, ht⟩ := digitsa_approx_split hk
    have h1 := (h k).1
    have h2 := (h k).2
    rcases Nat.lt_or_gt_of_ne hv with hlt | hgt
    · have hup : (t k).val = (s k).val + 1 := by omega
      exact Or.inl ⟨hup, (digitsa_sameVal_up hk hup).1 h⟩
    · have hup : (s k).val = (t k).val + 1 := by omega
      exact Or.inr ⟨hup, (digitsa_sameVal_up hk' hup).1 (digitsa_sameVal_symm h)⟩
  · rintro (⟨hup, htail⟩ | ⟨hup, htail⟩)
    · exact (digitsa_sameVal_up hk hup).2 htail
    · exact digitsa_sameVal_symm ((digitsa_sameVal_up hk' hup).2 htail)

/-- 定理 J.15(d)：整数部が同じなら、値が同じ ⇔ 小数部の値が同じ。 -/
theorem isameVal_same_int (n : Nat) (s t : Digits) :
    ISameVal ⟨n, s⟩ ⟨n, t⟩ ↔ SameVal s t := by
  constructor
  · intro h N
    have h1 := (h N).1
    have h2 := (h N).2
    change n * 10 ^ (N + 1) + approx s N ≤ n * 10 ^ (N + 1) + approx t N + 1 at h1
    change n * 10 ^ (N + 1) + approx t N ≤ n * 10 ^ (N + 1) + approx s N + 1 at h2
    constructor <;> omega
  · intro h N
    have h1 := (h N).1
    have h2 := (h N).2
    show n * 10 ^ (N + 1) + approx s N ≤ n * 10 ^ (N + 1) + approx t N + 1 ∧
      n * 10 ^ (N + 1) + approx t N ≤ n * 10 ^ (N + 1) + approx s N + 1
    constructor <;> omega

private theorem digitsa_approx_lt (s : Digits) (N : Nat) : approx s N + 1 ≤ 10 ^ (N + 1) := by
  induction N with
  | zero =>
    show (s 0).val + 1 ≤ 10
    have := (s 0).isLt
    omega
  | succ n ih =>
    show 10 * approx s n + (s (n + 1)).val + 1 ≤ 10 ^ (n + 1 + 1)
    rw [Nat.pow_succ]
    have := (s (n + 1)).isLt
    omega

private theorem digitsa_digit_le (s : Digits) (N : Nat) : (s N).val ≤ approx s N := by
  cases N with
  | zero => exact Nat.le_refl _
  | succ n =>
    show (s (n + 1)).val ≤ 10 * approx s n + (s (n + 1)).val
    omega

private theorem digitsa_approx_all9 {s : Digits} (h : ∀ i, (s i).val = 9) (N : Nat) :
    approx s N + 1 = 10 ^ (N + 1) := by
  induction N with
  | zero =>
    show (s 0).val + 1 = 10
    rw [h 0]
  | succ n ih =>
    show 10 * approx s n + (s (n + 1)).val + 1 = 10 ^ (n + 1 + 1)
    rw [Nat.pow_succ, h (n + 1)]
    omega

private theorem digitsa_approx_all0 {s : Digits} (h : ∀ i, (s i).val = 0) (N : Nat) :
    approx s N = 0 := by
  induction N with
  | zero => exact h 0
  | succ n ih =>
    show 10 * approx s n + (s (n + 1)).val = 0
    rw [ih, h (n + 1)]

private theorem digitsa_all9_of {s : Digits} (h : ∀ N, approx s N + 1 = 10 ^ (N + 1)) :
    ∀ i, (s i).val = 9 := by
  intro i
  cases i with
  | zero =>
    have h0 := h 0
    change (s 0).val + 1 = 10 at h0
    omega
  | succ n =>
    have h1 := h n
    have h2 := h (n + 1)
    change 10 * approx s n + (s (n + 1)).val + 1 = 10 ^ (n + 1 + 1) at h2
    rw [Nat.pow_succ] at h2
    omega

/-- 定理 J.15(d)：整数部が違う（n < m）なら、値が同じ ⇔ m = n + 1 で、
n の側の小数部が全部 9、m の側が全部 0（整数部への繰り上がり n.(9) = (n+1).(0)）。 -/
theorem isameVal_carry_iff (n m : Nat) (h : n < m) (s t : Digits) :
    ISameVal ⟨n, s⟩ ⟨m, t⟩ ↔ m = n + 1 ∧ ∀ i, (s i).val = 9 ∧ (t i).val = 0 := by
  have key : ∀ N, ISameVal ⟨n, s⟩ ⟨m, t⟩ →
      approx t N = 0 ∧ approx s N + 1 = 10 ^ (N + 1) := by
    intro N hs
    have h1 := (hs N).2
    change m * 10 ^ (N + 1) + approx t N ≤ n * 10 ^ (N + 1) + approx s N + 1 at h1
    have hA := digitsa_approx_lt s N
    have hm : (n + 1) * 10 ^ (N + 1) ≤ m * 10 ^ (N + 1) := Nat.mul_le_mul_right _ h
    rw [Nat.succ_mul] at hm
    constructor <;> omega
  constructor
  · intro hs
    refine ⟨?_, fun i => ⟨digitsa_all9_of (fun N => (key N hs).2) i, ?_⟩⟩
    · have h1 := (hs 0).2
      change m * 10 ^ (0 + 1) + approx t 0 ≤ n * 10 ^ (0 + 1) + approx s 0 + 1 at h1
      have hA := digitsa_approx_lt s 0
      rcases Nat.lt_or_ge m (n + 2) with hm | hm
      · omega
      · have h2 := Nat.mul_le_mul_right (10 ^ (0 + 1)) hm
        rw [Nat.add_mul] at h2
        omega
    · have h1 := digitsa_digit_le t i
      have h2 := (key i hs).1
      omega
  · rintro ⟨rfl, hd⟩ N
    have hA := digitsa_approx_all9 (fun i => (hd i).1) N
    have hB := digitsa_approx_all0 (fun i => (hd i).2) N
    show n * 10 ^ (N + 1) + approx s N ≤ (n + 1) * 10 ^ (N + 1) + approx t N + 1 ∧
      (n + 1) * 10 ^ (N + 1) + approx t N ≤ n * 10 ^ (N + 1) + approx s N + 1
    rw [Nat.succ_mul]
    constructor <;> omega

/-- 定理 J.15(d)：0.(9) と 1.(0) は値が同じ（9/9 の名前は2つ）。 -/
theorem isameVal_nines_one : ISameVal ⟨0, fun _ => 9⟩ ⟨1, zeros⟩ :=
  (isameVal_carry_iff 0 1 (by decide) _ _).2 ⟨rfl, fun _ => ⟨rfl, rfl⟩⟩

/-! ### J.16 循環小数は φ_B の不動点：1/9 … 9/9 -/

/-- p 桁で書いた塊 B を繰り返す名前 0.(B)。 -/
def rep (p B : Nat) : Digits :=
  fun i => ⟨(B / 10 ^ (p - 1 - i % p)) % 10, Nat.mod_lt _ (by decide)⟩

/-- 名前の側の φ_B：p 桁の塊 B を前に置く。 -/
def prepend (p B : Nat) (s : Digits) : Digits :=
  fun i => if i < p then rep p B i else s (i - p)

/-- 値の側の φ_B(x) = (B + x) / 10^p（core の Rat）。 -/
def phi (p B : Nat) (x : Rat) : Rat := ((B : Rat) + x) / ((10 : Rat) ^ p)

/-- k / d は有限小数（分母を 10^j で払える）。 -/
def IsDecFracNat (k d : Nat) : Prop := ∃ m j, k * 10 ^ j = d * m

private theorem digitsa_rep_period (p B j : Nat) : rep p B (j + p) = rep p B j := by
  apply Fin.ext
  show (B / 10 ^ (p - 1 - (j + p) % p)) % 10 = (B / 10 ^ (p - 1 - j % p)) % 10
  rw [Nat.add_mod_right]

/-- 定理 J.16(a)：0.(B) は名前の側の φ_B の不動点。 -/
theorem prepend_rep (p B : Nat) (i : Nat) : prepend p B (rep p B) i = rep p B i := by
  show (if i < p then rep p B i else rep p B (i - p)) = rep p B i
  rcases Nat.lt_or_ge i p with h | h
  · rw [ite_eq_left h]
  · rw [ite_eq_right (Nat.not_lt.mpr h)]
    obtain ⟨j, rfl⟩ : ∃ j, i = j + p := ⟨i - p, by omega⟩
    rw [Nat.add_sub_cancel, digitsa_rep_period]

/-- 定理 J.16(a)：p ≥ 1 なら、名前の側の φ_B の不動点は 0.(B) だけ。 -/
theorem prepend_fixed_unique (p B : Nat) (hp : 0 < p) (s : Digits)
    (h : ∀ i, prepend p B s i = s i) : ∀ i, s i = rep p B i := by
  have key : ∀ n, ∀ i, i < n → s i = rep p B i := by
    intro n
    induction n with
    | zero => intro i hi; exact absurd hi (Nat.not_lt_zero i)
    | succ n ih =>
      intro i hi
      have hi' := h i
      change (if i < p then rep p B i else s (i - p)) = s i at hi'
      rcases Nat.lt_or_ge i p with hlt | hge
      · rw [ite_eq_left hlt] at hi'
        exact hi'.symm
      · rw [ite_eq_right (Nat.not_lt.mpr hge)] at hi'
        obtain ⟨j, rfl⟩ : ∃ j, i = j + p := ⟨i - p, by omega⟩
        rw [Nat.add_sub_cancel] at hi'
        rw [← hi', ih j (by omega), digitsa_rep_period]
  exact fun i => key (i + 1) i (Nat.lt_succ_self i)

private theorem digitsa_approx_prefix (p B : Nat) (hB : B < 10 ^ p) (s : Digits) :
    ∀ j, j < p → approx (prepend p B s) j = B / 10 ^ (p - 1 - j) := by
  intro j
  induction j with
  | zero =>
    intro hp
    show (if 0 < p then rep p B 0 else s (0 - p)).val = B / 10 ^ (p - 1 - 0)
    rw [ite_eq_left hp]
    show (B / 10 ^ (p - 1 - 0 % p)) % 10 = B / 10 ^ (p - 1 - 0)
    rw [Nat.zero_mod]
    apply Nat.mod_eq_of_lt
    rw [Nat.div_lt_iff_lt_mul (Nat.pow_pos (by decide)), Nat.mul_comm, ← Nat.pow_succ]
    have e : (p - 1 - 0).succ = p := by omega
    rw [e]
    exact hB
  | succ j ih =>
    intro hj
    show 10 * approx (prepend p B s) j + (prepend p B s (j + 1)).val =
      B / 10 ^ (p - 1 - (j + 1))
    rw [ih (by omega)]
    show 10 * (B / 10 ^ (p - 1 - j)) + (if j + 1 < p then rep p B (j + 1) else s (j + 1 - p)).val =
      B / 10 ^ (p - 1 - (j + 1))
    rw [ite_eq_left hj]
    show 10 * (B / 10 ^ (p - 1 - j)) + (B / 10 ^ (p - 1 - (j + 1) % p)) % 10 =
      B / 10 ^ (p - 1 - (j + 1))
    rw [Nat.mod_eq_of_lt hj]
    have e : p - 1 - j = (p - 1 - (j + 1)) + 1 := by omega
    rw [e, Nat.pow_succ, ← Nat.div_div_eq_div_mul]
    exact Nat.div_add_mod _ _

/-- 定理 J.16(a)：名前の側の φ_B は値の側の φ_B と合う（B < 10^p）。 -/
theorem approx_prepend (p B : Nat) (hB : B < 10 ^ p) (s : Digits) (N : Nat) :
    approx (prepend p B s) (N + p) = B * 10 ^ (N + 1) + approx s N := by
  cases p with
  | zero =>
    have hB0 : B = 0 := by
      change B < 1 at hB
      omega
    subst hB0
    rw [Nat.zero_mul, Nat.zero_add, Nat.add_zero]
    apply digitsa_approx_congr
    intro i _
    show (if i < 0 then rep 0 0 i else s (i - 0)) = s i
    rw [ite_eq_right (Nat.not_lt_zero i), Nat.sub_zero]
  | succ q =>
    have hq := digitsa_approx_prefix (q + 1) B hB s q (Nat.lt_succ_self q)
    rw [show q + 1 - 1 - q = 0 by omega, Nat.pow_zero, Nat.div_one] at hq
    induction N with
    | zero =>
      rw [show 0 + (q + 1) = q + 1 from Nat.zero_add _]
      show 10 * approx (prepend (q + 1) B s) q + (prepend (q + 1) B s (q + 1)).val =
        B * 10 ^ (0 + 1) + (s 0).val
      rw [hq]
      show 10 * B + (if q + 1 < q + 1 then rep (q + 1) B (q + 1) else s (q + 1 - (q + 1))).val =
        B * 10 ^ (0 + 1) + (s 0).val
      rw [ite_eq_right (Nat.lt_irrefl _), Nat.sub_self]
      show 10 * B + (s 0).val = B * 10 + (s 0).val
      omega
    | succ n ih =>
      rw [show n + 1 + (q + 1) = (n + (q + 1)) + 1 by omega]
      show 10 * approx (prepend (q + 1) B s) (n + (q + 1)) +
          (prepend (q + 1) B s (n + (q + 1) + 1)).val =
        B * 10 ^ (n + 1 + 1) + (10 * approx s n + (s (n + 1)).val)
      rw [ih]
      show 10 * (B * 10 ^ (n + 1) + approx s n) +
          (if n + (q + 1) + 1 < q + 1 then rep (q + 1) B (n + (q + 1) + 1)
            else s (n + (q + 1) + 1 - (q + 1))).val =
        B * 10 ^ (n + 1 + 1) + (10 * approx s n + (s (n + 1)).val)
      rw [ite_eq_right (by omega), show n + (q + 1) + 1 - (q + 1) = n + 1 by omega,
        Nat.pow_succ (m := n + 1), ← Nat.mul_assoc]
      omega

/-- 定理 J.16(b)：値の側の φ_B の不動点はただ1つで、B / (10^p − 1)。
core の Rat の補題（`Rat.mul_comm` ほか）と `grind` は `Classical.choice` を使うので、この形の印は〔L〕。
選択なしの形は `fixed_int_form`。 -/
theorem phi_fixed_iff (p B : Nat) (hp : 0 < p) (x : Rat) :
    phi p B x = x ↔ x = (B : Rat) / ((10 : Rat) ^ p - 1) := by
  have hn : 10 ≤ 10 ^ p := by
    obtain ⟨q, rfl⟩ : ∃ q, p = q + 1 := ⟨p - 1, by omega⟩
    rw [Nat.pow_succ]
    have := Nat.pow_pos (n := q) (show 0 < 10 by decide)
    omega
  have hc : ((10 ^ p : Nat) : Rat) = (10 : Rat) ^ p := by rw [Rat.natCast_pow]; rfl
  have h1 : (10 : Rat) ^ p ≠ 0 := by
    intro h
    have : ((10 ^ p : Nat) : Rat) = ((0 : Nat) : Rat) := by rw [hc, h]; rfl
    have := Rat.natCast_inj.mp this
    omega
  have h2 : (10 : Rat) ^ p - 1 ≠ 0 := by
    intro h
    have : ((10 ^ p : Nat) : Rat) = ((1 : Nat) : Rat) := by rw [hc]; grind
    have := Rat.natCast_inj.mp this
    omega
  unfold phi
  grind

/-- 定理 J.16(b)：不動点の式の ℤ の形（a / c が不動点）。 -/
theorem fixed_int_form (p B : Nat) (a c : Int) :
    (B : Int) * c + a = a * 10 ^ p ↔ a * (10 ^ p - 1) = B * c := by
  rw [Int.mul_sub, Int.mul_one]
  constructor
  · intro h
    omega
  · intro h
    omega

/-- 定理 J.16(b)：0.(B) の値は B / (10^p − 1)。 -/
theorem hasVal_rep (p B : Nat) (hp : 0 < p) (hB : B < 10 ^ p) :
    HasVal (rep p B) B (10 ^ p - 1) := by
  have hfix : prepend p B (rep p B) = rep p B := funext (prepend_rep p B)
  have hX1 : 10 ≤ 10 ^ p := by
    obtain ⟨q, rfl⟩ : ∃ q, p = q + 1 := ⟨p - 1, by omega⟩
    rw [Nat.pow_succ]
    have := Nat.pow_pos (n := q) (show 0 < 10 by decide)
    omega
  have hc : 10 ^ p - 1 + 1 = 10 ^ p := by omega
  refine ⟨by omega, ?_⟩
  have key : ∀ n N, N < n → (10 ^ p - 1) * approx (rep p B) N ≤ B * 10 ^ (N + 1) ∧
      B * 10 ^ (N + 1) ≤ (10 ^ p - 1) * approx (rep p B) N + (10 ^ p - 1) := by
    intro n
    induction n with
    | zero => intro N h; exact absurd h (Nat.not_lt_zero N)
    | succ n ih =>
      intro N hN
      rcases Nat.lt_or_ge N p with hlt | hge
      · have ha : approx (rep p B) N = B / 10 ^ (p - 1 - N) := by
          rw [← hfix]
          exact digitsa_approx_prefix p B hB (rep p B) N hlt
        rw [ha]
        have hq : 0 < 10 ^ (p - 1 - N) := Nat.pow_pos (by decide)
        have hX : 10 ^ (p - 1 - N) * 10 ^ (N + 1) = 10 ^ p := by
          rw [← Nat.pow_add]
          congr 1
          omega
        have hdm := Nat.div_add_mod B (10 ^ (p - 1 - N))
        have he : B % 10 ^ (p - 1 - N) < 10 ^ (p - 1 - N) := Nat.mod_lt _ hq
        have hd : B / 10 ^ (p - 1 - N) < 10 ^ (N + 1) := by
          rw [Nat.div_lt_iff_lt_mul hq, Nat.mul_comm, hX]
          exact hB
        have hBQ : B * 10 ^ (N + 1) = B / 10 ^ (p - 1 - N) * 10 ^ p +
            B % 10 ^ (p - 1 - N) * 10 ^ (N + 1) := by
          conv => lhs; rw [← hdm]
          rw [Nat.add_mul, Nat.mul_comm (10 ^ (p - 1 - N)) (B / 10 ^ (p - 1 - N)),
            Nat.mul_assoc, hX]
        have hcd : (10 ^ p - 1) * (B / 10 ^ (p - 1 - N)) + B / 10 ^ (p - 1 - N) =
            B / 10 ^ (p - 1 - N) * 10 ^ p := by
          conv => rhs; rw [← hc]
          rw [Nat.mul_add, Nat.mul_one, Nat.mul_comm (10 ^ p - 1) (B / 10 ^ (p - 1 - N))]
        have heQ : (B % 10 ^ (p - 1 - N) + 1) * 10 ^ (N + 1) ≤
            10 ^ (p - 1 - N) * 10 ^ (N + 1) := Nat.mul_le_mul_right _ he
        rw [Nat.succ_mul, hX] at heQ
        constructor <;> omega
      · obtain ⟨M, rfl⟩ : ∃ M, N = M + p := ⟨N - p, by omega⟩
        have ha : approx (rep p B) (M + p) = B * 10 ^ (M + 1) + approx (rep p B) M := by
          have := approx_prepend p B hB (rep p B) M
          rwa [hfix] at this
        obtain ⟨ih1, ih2⟩ := ih M (by omega)
        rw [ha]
        have h1 : B * 10 ^ (M + p + 1) =
            (10 ^ p - 1) * (B * 10 ^ (M + 1)) + B * 10 ^ (M + 1) := by
          rw [show M + p + 1 = (M + 1) + p by omega, Nat.pow_add, ← Nat.mul_assoc]
          conv => lhs; rw [← hc]
          rw [Nat.mul_add, Nat.mul_one, Nat.mul_comm (B * 10 ^ (M + 1))]
        rw [h1, Nat.mul_add]
        constructor <;> omega
  intro N
  have := key (N + 1) N (Nat.lt_succ_self N)
  rw [Nat.mul_add, Nat.mul_one]
  exact this

private theorem digitsa_const_aux (k : Fin 10) (N : Nat) :
    9 * approx (fun _ => k) N + k.val = k.val * 10 ^ (N + 1) := by
  induction N with
  | zero =>
    show 9 * k.val + k.val = k.val * 10
    omega
  | succ n ih =>
    show 9 * (10 * approx (fun _ => k) n + k.val) + k.val = k.val * 10 ^ (n + 1 + 1)
    rw [Nat.pow_succ (m := n + 1), ← Nat.mul_assoc]
    omega

/-- 定理 J.16(c)：0.(k) の部分和は k · (10^(N+1) − 1) / 9。 -/
theorem approx_const (k : Fin 10) (N : Nat) :
    9 * approx (fun _ => k) N = k.val * (10 ^ (N + 1) - 1) := by
  have := digitsa_const_aux k N
  rw [Nat.mul_sub_one]
  omega

/-- 定理 J.16(c)：0.(k) の値は k / 9。 -/
theorem hasVal_const (k : Fin 10) : HasVal (fun _ => k) k.val 9 := by
  refine ⟨by decide, fun N => ?_⟩
  have := digitsa_const_aux k N
  have := k.isLt
  constructor <;> omega

/-- 定理 J.16(c)：0.(9) の値は 1。近似はどの桁でも 1 のちょうど1単位下。 -/
theorem approx_nines (N : Nat) : approx (fun _ => 9) N + 1 = 10 ^ (N + 1) := by
  have h : 9 * approx (fun _ => (9 : Fin 10)) N + 9 = 9 * 10 ^ (N + 1) := digitsa_const_aux 9 N
  omega

private theorem digitsa_pow_mod9 (j : Nat) : 10 ^ j % 9 = 1 := by
  induction j with
  | zero => rfl
  | succ j ih =>
    rw [Nat.pow_succ, Nat.mul_mod, ih]

/-- 定理 J.16(c)：k / 9 が有限小数 ⇔ 9 ∣ k。 -/
theorem ninths_decFrac_iff (k : Nat) : IsDecFracNat k 9 ↔ 9 ∣ k := by
  constructor
  · rintro ⟨m, j, h⟩
    apply Nat.dvd_of_mod_eq_zero
    have h1 : k * 10 ^ j % 9 = 9 * m % 9 := by rw [h]
    rw [Nat.mul_mod, digitsa_pow_mod9] at h1
    omega
  · rintro ⟨l, rfl⟩
    exact ⟨l, 0, by rw [Nat.pow_zero, Nat.mul_one]⟩

/-- 定理 J.16(c)：1 ≤ k ≤ 9 で、k / 9 が有限小数 ⇔ k = 9。 -/
theorem ninths_finite_iff (k : Nat) (h1 : 1 ≤ k) (h9 : k ≤ 9) : IsDecFracNat k 9 ↔ k = 9 := by
  rw [ninths_decFrac_iff]
  constructor
  · rintro ⟨l, rfl⟩
    omega
  · rintro rfl
    exact ⟨1, rfl⟩

private theorem digitsa_eq_of_approx {s t : Digits} (h : ∀ N, approx s N = approx t N) :
    ∀ i, s i = t i := by
  intro i
  apply Fin.ext
  cases i with
  | zero => exact h 0
  | succ n =>
    have h1 := h n
    have h2 := h (n + 1)
    change 10 * approx s n + (s (n + 1)).val = 10 * approx t n + (t (n + 1)).val at h2
    omega

/-- 定理 J.16(c)：k ≤ 9 のどれでも、値 k / 9 の名前（[0,1] の桁の列）は 0.(k) だけ。 -/
theorem hasVal_ninths_unique (k : Fin 10) (s : Digits)
    (h : HasVal s k.val 9) : ∀ i, s i = k := by
  apply digitsa_eq_of_approx (t := fun _ => k)
  intro N
  have hc := digitsa_const_aux k N
  have hs := h.2 N
  have hl := digitsa_approx_lt s N
  have hk := k.isLt
  rcases Nat.eq_zero_or_pos k.val with hk0 | hk0
  · rw [hk0, Nat.zero_mul] at hc hs
    omega
  · rcases Nat.lt_or_ge k.val 9 with hk9 | hk9
    · omega
    · have h9 : k.val = 9 := by omega
      rw [h9] at hc hs
      omega

/-- 定理 J.16(c)：k ≤ 8 なら、整数部つきの名前でも、値 k / 9 の名前は 0.(k) だけ。 -/
theorem isameVal_ninths_unique (k : Fin 10) (hk : k.val ≤ 8) (x : IName)
    (h : ISameVal x ⟨0, fun _ => k⟩) : x.int = 0 ∧ ∀ i, x.frac i = k := by
  obtain ⟨n, s⟩ := x
  have h0 := (h 0).1
  change n * 10 + (s 0).val ≤ 0 * 10 + k.val + 1 at h0
  have hn : n = 0 := by omega
  subst hn
  refine ⟨rfl, ?_⟩
  have hsv : SameVal s (fun _ => k) := (isameVal_same_int 0 s (fun _ => k)).1 h
  show ∀ i, s i = k
  apply digitsa_eq_of_approx (t := fun _ => k)
  intro N
  have h1 := hsv N
  have h2 := hsv (N + 1)
  change 10 * approx s N + (s (N + 1)).val ≤ 10 * approx (fun _ => k) N + k.val + 1 ∧
    10 * approx (fun _ => k) N + k.val ≤ 10 * approx s N + (s (N + 1)).val + 1 at h2
  have := (s (N + 1)).isLt
  rcases Nat.eq_zero_or_pos k.val with hk0 | hk0
  · have hc := digitsa_const_aux k N
    rw [hk0, Nat.zero_mul] at hc
    omega
  · omega

private theorem digitsa_zero_of_sameVal_zeros {s : Digits} (h : SameVal s zeros) :
    ∀ i, (s i).val = 0 := by
  have hz : ∀ N, approx zeros N = 0 := digitsa_approx_all0 (fun _ => rfl)
  have ha : ∀ N, approx s N = 0 := by
    intro N
    have h1 := (h (N + 1)).1
    change 10 * approx s N + (s (N + 1)).val ≤ approx zeros (N + 1) + 1 at h1
    rw [hz] at h1
    omega
  intro i
  have h1 := digitsa_digit_le s i
  have h2 := ha i
  omega

/-- 定理 J.16(c)：値 1（= 9/9）の整数部つきの名前は、0.(9) と 1.(0) のちょうど2つ。 -/
theorem isameVal_one_names (x : IName) (h : ISameVal x ⟨1, zeros⟩) :
    (x.int = 0 ∧ ∀ i, (x.frac i).val = 9) ∨ (x.int = 1 ∧ ∀ i, (x.frac i).val = 0) := by
  obtain ⟨n, s⟩ := x
  have h0 := (h 0).1
  change n * 10 + (s 0).val ≤ 1 * 10 + 0 + 1 at h0
  have hn : n = 0 ∨ n = 1 := by omega
  rcases hn with rfl | rfl
  · exact Or.inl ⟨rfl, fun i => (((isameVal_carry_iff 0 1 (by decide) s zeros).1 h).2 i).1⟩
  · exact Or.inr ⟨rfl, digitsa_zero_of_sameVal_zeros ((isameVal_same_int 1 s zeros).1 h)⟩

/-! ### J.17 列の上の比べの代金 -/

/-- LLPO：1 が高々1つの列は、偶数の所が全部偽か、奇数の所が全部偽。 -/
def LLPO : Prop :=
  ∀ a : Nat → Bool, (∀ m n, a m = true → a n = true → m = n) →
    (∀ n, a (2 * n) = false) ∨ (∀ n, a (2 * n + 1) = false)

/-- Sign の比べの形：成り立てば左を返し、`!_` でない答えを返すのは成り立つ時だけ
（value_spec.md 91・94 行）。`<` で LPO が出るのは後の半分から。 -/
def IsSignCmp (R : Digits → Digits → Prop) (cmp : Digits → Digits → Option Digits) : Prop :=
  ∀ s t, (R s t → cmp s t = some s) ∧ (cmp s t ≠ none → R s t)

-- 0/1 の列 a から作る桁 0・1 の列
private def digitsa_ofBool (a : Nat → Bool) : Digits := fun i => cond (a i) 1 0

private theorem digitsa_ofBool_false {a : Nat → Bool} {i : Nat} (h : a i = false) :
    (digitsa_ofBool a i).val = 0 := by
  show (cond (a i) (1 : Fin 10) 0).val = 0
  rw [h]
  rfl

private theorem digitsa_ofBool_true {a : Nat → Bool} {i : Nat} (h : a i = true) :
    (digitsa_ofBool a i).val = 1 := by
  show (cond (a i) (1 : Fin 10) 0).val = 1
  rw [h]
  rfl

private theorem digitsa_zeros_approx (N : Nat) : approx zeros N = 0 :=
  digitsa_approx_all0 (fun _ => rfl) N

private theorem digitsa_ofBool_zero {a : Nat → Bool} (h : ∀ n, a n = false) (N : Nat) :
    approx (digitsa_ofBool a) N = 0 :=
  digitsa_approx_all0 (fun i => digitsa_ofBool_false (h i)) N

private theorem digitsa_ofBool_big {a : Nat → Bool} {n : Nat} (h : a n = true) :
    10 ≤ approx (digitsa_ofBool a) (n + 1) := by
  have h1 := digitsa_digit_le (digitsa_ofBool a) n
  rw [digitsa_ofBool_true h] at h1
  show 10 ≤ 10 * approx (digitsa_ofBool a) n + (digitsa_ofBool a (n + 1)).val
  omega

private theorem digitsa_exists_of_approx_pos {s : Digits} {N : Nat} (h : 0 < approx s N) :
    ∃ i, i ≤ N ∧ 0 < (s i).val := by
  induction N with
  | zero => exact ⟨0, Nat.le_refl 0, h⟩
  | succ n ih =>
    change 0 < 10 * approx s n + (s (n + 1)).val at h
    rcases Nat.eq_zero_or_pos (s (n + 1)).val with h0 | hpos
    · obtain ⟨i, hi, hi'⟩ := ih (by omega)
      exact ⟨i, Nat.le_succ_of_le hi, hi'⟩
    · exact ⟨n + 1, Nat.le_refl _, hpos⟩

private theorem digitsa_ofBool_exists {a : Nat → Bool} {N : Nat}
    (h : 0 < approx (digitsa_ofBool a) N) : ∃ n, a n = true := by
  obtain ⟨i, _, hi⟩ := digitsa_exists_of_approx_pos h
  cases ha : a i
  · rw [digitsa_ofBool_false ha] at hi
    exact absurd hi (Nat.lt_irrefl 0)
  · exact ⟨i, ha⟩

private theorem digitsa_ofBool_valLE {a : Nat → Bool} (h : ValLE (digitsa_ofBool a) zeros) :
    ∀ n, a n = false := by
  intro n
  cases ha : a n
  · rfl
  · exfalso
    have h1 := h (n + 1)
    rw [digitsa_zeros_approx] at h1
    have := digitsa_ofBool_big ha
    omega

private theorem digitsa_ofBool_sameVal {a : Nat → Bool} (h : ∀ n, a n = false) :
    SameVal (digitsa_ofBool a) zeros := by
  intro N
  rw [digitsa_ofBool_zero h, digitsa_zeros_approx]
  exact ⟨Nat.zero_le _, Nat.zero_le _⟩

/-- 定理 J.17(a)：値の等しさが決まる ⇔ WLPO。 -/
theorem sameVal_dec_iff_WLPO :
    (∀ s t : Digits, SameVal s t ∨ ¬ SameVal s t) ↔ WLPO := by
  constructor
  · intro hd a
    rcases hd (digitsa_ofBool a) zeros with h | h
    · exact Or.inl (digitsa_ofBool_valLE (fun N => (h N).1))
    · exact Or.inr (fun hall => h (digitsa_ofBool_sameVal hall))
  · intro w s t
    rcases w (fun N => decide (¬ (approx s N ≤ approx t N + 1 ∧ approx t N ≤ approx s N + 1)))
      with h | h
    · exact Or.inl (fun N => Decidable.byContradiction (of_decide_eq_false (h N)))
    · exact Or.inr (fun hs => h (fun N => decide_eq_false (fun hn => hn (hs N))))

/-- 定理 J.17(a)：値の ≤ が決まる ⇔ WLPO。 -/
theorem valLE_dec_iff_WLPO :
    (∀ s t : Digits, ValLE s t ∨ ¬ ValLE s t) ↔ WLPO := by
  constructor
  · intro hd a
    rcases hd (digitsa_ofBool a) zeros with h | h
    · exact Or.inl (digitsa_ofBool_valLE h)
    · exact Or.inr (fun hall => h (fun N => (digitsa_ofBool_sameVal hall N).1))
  · intro w s t
    rcases w (fun N => decide (¬ (approx s N ≤ approx t N + 1))) with h | h
    · exact Or.inl (fun N => Decidable.byContradiction (of_decide_eq_false (h N)))
    · exact Or.inr (fun hs => h (fun N => decide_eq_false (fun hn => hn (hs N))))

/-- 定理 J.17(a)：値の < が決まる ⇔ LPO。 -/
theorem valLT_dec_iff_LPO :
    (∀ s t : Digits, ValLT s t ∨ ¬ ValLT s t) ↔ LPO := by
  constructor
  · intro hd a
    rcases hd zeros (digitsa_ofBool a) with ⟨N, hN⟩ | h
    · rw [digitsa_zeros_approx] at hN
      exact Or.inl (digitsa_ofBool_exists (N := N) (by omega))
    · refine Or.inr (fun n => ?_)
      cases ha : a n
      · rfl
      · exfalso
        apply h
        refine ⟨n + 1, ?_⟩
        rw [digitsa_zeros_approx]
        have := digitsa_ofBool_big ha
        omega
  · intro L s t
    rcases L (fun N => decide (approx s N + 2 ≤ approx t N)) with ⟨N, hN⟩ | h
    · exact Or.inl ⟨N, of_decide_eq_true hN⟩
    · refine Or.inr (fun ⟨N, hN⟩ => ?_)
      have := h N
      rw [decide_eq_true hN] at this
      cases this

/-- 定理 J.17(b)：Sign の `<`（成り立てば左、外れたら `!_`）が列の上に在れば LPO。 -/
theorem signLt_to_LPO : (∃ cmp, IsSignCmp ValLT cmp) → LPO := by
  rintro ⟨cmp, hc⟩ a
  cases hca : cmp zeros (digitsa_ofBool a) with
  | none =>
    refine Or.inr (fun n => ?_)
    cases ha : a n
    · rfl
    · exfalso
      have hlt : ValLT zeros (digitsa_ofBool a) := by
        refine ⟨n + 1, ?_⟩
        rw [digitsa_zeros_approx]
        have := digitsa_ofBool_big ha
        omega
      have := (hc zeros (digitsa_ofBool a)).1 hlt
      rw [hca] at this
      cases this
  | some u =>
    have hlt := (hc zeros (digitsa_ofBool a)).2 (by rw [hca]; intro h; cases h)
    obtain ⟨N, hN⟩ := hlt
    rw [digitsa_zeros_approx] at hN
    exact Or.inl (digitsa_ofBool_exists (N := N) (by omega))

-- PSum の左なら左を返し、右なら `!_`
private def digitsa_pick {P Q : Prop} (x : Digits) : PSum P Q → Option Digits
  | .inl _ => some x
  | .inr _ => none

/-- 定理 J.17(b)：LPO の振り分けがあれば、列の上の Sign の `<` が作れる。 -/
theorem signLt_of_LPOd (L : LPOd) : Nonempty {cmp // IsSignCmp ValLT cmp} := by
  refine ⟨⟨fun s t => digitsa_pick s (L (fun N => decide (approx s N + 2 ≤ approx t N))), ?_⟩⟩
  intro s t
  constructor
  · rintro ⟨N, hN⟩
    show digitsa_pick s (L (fun N => decide (approx s N + 2 ≤ approx t N))) = some s
    cases L (fun N => decide (approx s N + 2 ≤ approx t N)) with
    | inl _ => rfl
    | inr h =>
      have := h N
      rw [decide_eq_true hN] at this
      cases this
  · show digitsa_pick s (L (fun N => decide (approx s N + 2 ≤ approx t N))) ≠ none → ValLT s t
    cases L (fun N => decide (approx s N + 2 ≤ approx t N)) with
    | inl h =>
      intro _
      obtain ⟨N, hN⟩ := h
      exact ⟨N, of_decide_eq_true hN⟩
    | inr _ =>
      intro h
      exact absurd rfl h

/-- 定理 J.17(b)：Sign の `<=` が列の上に在れば WLPO。 -/
theorem signLe_to_WLPO : (∃ cmp, IsSignCmp ValLE cmp) → WLPO := by
  rintro ⟨cmp, hc⟩ a
  cases hca : cmp (digitsa_ofBool a) zeros with
  | none =>
    refine Or.inr (fun hall => ?_)
    have := (hc _ _).1 (fun N => (digitsa_ofBool_sameVal hall N).1)
    rw [hca] at this
    cases this
  | some u =>
    exact Or.inl (digitsa_ofBool_valLE ((hc _ _).2 (by rw [hca]; intro h; cases h)))

/-- 定理 J.17(b)：WLPO の振り分けがあれば、列の上の Sign の `<=` が作れる。 -/
theorem signLe_of_WLPOd (W : WLPOd) : Nonempty {cmp // IsSignCmp ValLE cmp} := by
  refine ⟨⟨fun s t => digitsa_pick s (W (fun N => decide (¬ (approx s N ≤ approx t N + 1)))),
    ?_⟩⟩
  intro s t
  constructor
  · intro hle
    show digitsa_pick s (W (fun N => decide (¬ (approx s N ≤ approx t N + 1)))) = some s
    cases W (fun N => decide (¬ (approx s N ≤ approx t N + 1))) with
    | inl _ => rfl
    | inr h => exact absurd (fun N => decide_eq_false (fun hn => hn (hle N))) h
  · show digitsa_pick s (W (fun N => decide (¬ (approx s N ≤ approx t N + 1)))) ≠ none →
      ValLE s t
    cases W (fun N => decide (¬ (approx s N ≤ approx t N + 1))) with
    | inl h =>
      intro _ N
      exact Decidable.byContradiction (of_decide_eq_false (h N))
    | inr _ =>
      intro h
      exact absurd rfl h

/-- 定理 J.17(b)：Sign の `==`（値が同じなら左）が列の上に在れば WLPO。 -/
theorem signEq_to_WLPO : (∃ cmp, IsSignCmp SameVal cmp) → WLPO := by
  rintro ⟨cmp, hc⟩ a
  cases hca : cmp (digitsa_ofBool a) zeros with
  | none =>
    refine Or.inr (fun hall => ?_)
    have := (hc _ _).1 (digitsa_ofBool_sameVal hall)
    rw [hca] at this
    cases this
  | some u =>
    have hs := (hc _ _).2 (by rw [hca]; intro h; cases h)
    exact Or.inl (digitsa_ofBool_valLE (fun N => (hs N).1))

/-- 定理 J.17(b)：WLPO の振り分けがあれば、列の上の Sign の `==` が作れる。 -/
theorem signEq_of_WLPOd (W : WLPOd) : Nonempty {cmp // IsSignCmp SameVal cmp} := by
  refine ⟨⟨fun s t => digitsa_pick s (W (fun N =>
    decide (¬ (approx s N ≤ approx t N + 1 ∧ approx t N ≤ approx s N + 1)))), ?_⟩⟩
  intro s t
  constructor
  · intro hs
    show digitsa_pick s (W (fun N =>
      decide (¬ (approx s N ≤ approx t N + 1 ∧ approx t N ≤ approx s N + 1)))) = some s
    cases W (fun N => decide (¬ (approx s N ≤ approx t N + 1 ∧ approx t N ≤ approx s N + 1))) with
    | inl _ => rfl
    | inr h => exact absurd (fun N => decide_eq_false (fun hn => hn (hs N))) h
  · show digitsa_pick s (W (fun N =>
      decide (¬ (approx s N ≤ approx t N + 1 ∧ approx t N ≤ approx s N + 1)))) ≠ none →
      SameVal s t
    cases W (fun N => decide (¬ (approx s N ≤ approx t N + 1 ∧ approx t N ≤ approx s N + 1))) with
    | inl h =>
      intro _ N
      exact Decidable.byContradiction (of_decide_eq_false (h N))
    | inr _ =>
      intro h
      exact absurd rfl h

private theorem digitsa_and_true {b : Bool} {P : Prop} [Decidable P] (hb : b = true) (hP : P) :
    (b && decide P) = true := by
  rw [hb]
  exact decide_eq_true hP

private theorem digitsa_and_false_of {b : Bool} {P : Prop} [Decidable P] (h : b = true → ¬ P) :
    (b && decide P) = false := by
  cases b with
  | false => rfl
  | true => exact decide_eq_false (h rfl)

-- 有界の探し：段 N までに p が真になる最初の段
private theorem digitsa_first (p : Nat → Bool) (N : Nat) :
    (∀ K, K ≤ N → p K = false) ∨ (∃ M, M ≤ N ∧ p M = true ∧ ∀ K, K < M → p K = false) := by
  induction N with
  | zero =>
    cases h : p 0
    · exact Or.inl (fun K hK => by rw [show K = 0 by omega]; exact h)
    · exact Or.inr ⟨0, Nat.le_refl 0, h, fun K hK => absurd hK (Nat.not_lt_zero K)⟩
  | succ n ih =>
    rcases ih with hall | ⟨M, hM, hpM, hpre⟩
    · cases h : p (n + 1)
      · refine Or.inl (fun K hK => ?_)
        rcases Nat.lt_or_ge K (n + 1) with h1 | h1
        · exact hall K (by omega)
        · rw [show K = n + 1 by omega]; exact h
      · exact Or.inr ⟨n + 1, Nat.le_refl _, h, fun K hK => hall K (by omega)⟩
    · exact Or.inr ⟨M, Nat.le_succ_of_le hM, hpM, hpre⟩

-- s が t より2単位以上大きい段
private def digitsa_gap1 (s t : Digits) (N : Nat) : Bool := decide (approx t N + 2 ≤ approx s N)

private def digitsa_gap (s t : Digits) (N : Nat) : Bool := digitsa_gap1 s t N || digitsa_gap1 t s N

-- 最初の離れの段 N で、s が上なら 2N、t が上なら 2N + 1 に 1 を置く列
private def digitsa_llpoSeq (s t : Digits) (n : Nat) : Bool :=
  decide (∀ K, K < n / 2 → digitsa_gap s t K = false) &&
    (if n % 2 = 0 then digitsa_gap1 s t (n / 2) else digitsa_gap1 t s (n / 2))

private theorem digitsa_gap1_spec {s t : Digits} {N : Nat} (h : digitsa_gap1 s t N = true) :
    approx t N + 2 ≤ approx s N := of_decide_eq_true h

private theorem digitsa_gap_of1 {s t : Digits} {N : Nat} (h : digitsa_gap1 s t N = true) :
    digitsa_gap s t N = true := by
  unfold digitsa_gap
  rw [h]
  rfl

private theorem digitsa_gap_of2 {s t : Digits} {N : Nat} (h : digitsa_gap1 t s N = true) :
    digitsa_gap s t N = true := by
  unfold digitsa_gap
  rw [h, Bool.or_true]

private theorem digitsa_gap1_excl {s t : Digits} {N : Nat} (h1 : digitsa_gap1 s t N = true)
    (h2 : digitsa_gap1 t s N = true) : False := by
  have := digitsa_gap1_spec h1
  have := digitsa_gap1_spec h2
  omega

private theorem digitsa_gap_prop {s t : Digits} {M : Nat} (h : approx s M + 2 ≤ approx t M)
    (d : Nat) : approx s (M + d) + 2 ≤ approx t (M + d) := by
  induction d with
  | zero => exact h
  | succ n ih =>
    show 10 * approx s (M + n) + (s (M + n + 1)).val + 2 ≤
      10 * approx t (M + n) + (t (M + n + 1)).val
    have := (s (M + n + 1)).isLt
    omega

private theorem digitsa_llpoSeq_spec {s t : Digits} {n : Nat} (h : digitsa_llpoSeq s t n = true) :
    (∀ K, K < n / 2 → digitsa_gap s t K = false) ∧
      (n % 2 = 0 → digitsa_gap1 s t (n / 2) = true) ∧
      (n % 2 = 1 → digitsa_gap1 t s (n / 2) = true) := by
  unfold digitsa_llpoSeq at h
  rw [Bool.and_eq_true] at h
  obtain ⟨h1, h2⟩ := h
  refine ⟨of_decide_eq_true h1, fun he => ?_, fun ho => ?_⟩
  · rwa [ite_eq_left he] at h2
  · rwa [ite_eq_right (by omega)] at h2

private theorem digitsa_llpoSeq_even (s t : Digits) (M : Nat) :
    digitsa_llpoSeq s t (2 * M) =
      (decide (∀ K, K < M → digitsa_gap s t K = false) && digitsa_gap1 s t M) := by
  have h1 : 2 * M / 2 = M := by omega
  have h2 : 2 * M % 2 = 0 := by omega
  unfold digitsa_llpoSeq
  rw [ite_eq_left h2, h1]

private theorem digitsa_llpoSeq_odd (s t : Digits) (M : Nat) :
    digitsa_llpoSeq s t (2 * M + 1) =
      (decide (∀ K, K < M → digitsa_gap s t K = false) && digitsa_gap1 t s M) := by
  have h1 : (2 * M + 1) / 2 = M := by omega
  have h2 : ¬ (2 * M + 1) % 2 = 0 := by omega
  unfold digitsa_llpoSeq
  rw [ite_eq_right h2, h1]

/-- 定理 J.17(c)：値の全順序の形（s ≤ t か t ≤ s）⇔ LLPO。 -/
theorem valLE_total_iff_LLPO :
    (∀ s t : Digits, ValLE s t ∨ ValLE t s) ↔ LLPO := by
  constructor
  · intro htot a hu
    rcases htot (digitsa_ofBool (fun j => a j && decide (j % 2 = 1)))
        (digitsa_ofBool (fun j => a j && decide (j % 2 = 0))) with h | h
    · refine Or.inr (fun n => ?_)
      cases ha : a (2 * n + 1)
      · rfl
      · exfalso
        have hbig := digitsa_ofBool_big (a := fun j => a j && decide (j % 2 = 1))
          (n := 2 * n + 1) (digitsa_and_true ha (by omega))
        have hz := digitsa_ofBool_zero (a := fun j => a j && decide (j % 2 = 0))
          (fun j => digitsa_and_false_of (fun hj => by have := hu _ _ hj ha; omega))
          (2 * n + 1 + 1)
        have := h (2 * n + 1 + 1)
        omega
    · refine Or.inl (fun n => ?_)
      cases ha : a (2 * n)
      · rfl
      · exfalso
        have hbig := digitsa_ofBool_big (a := fun j => a j && decide (j % 2 = 0))
          (n := 2 * n) (digitsa_and_true ha (by omega))
        have hz := digitsa_ofBool_zero (a := fun j => a j && decide (j % 2 = 1))
          (fun j => digitsa_and_false_of (fun hj => by have := hu _ _ hj ha; omega))
          (2 * n + 1)
        have := h (2 * n + 1)
        omega
  · intro hL s t
    have hu : ∀ m n, digitsa_llpoSeq s t m = true → digitsa_llpoSeq s t n = true → m = n := by
      intro m n hm hn
      obtain ⟨pm, em, om⟩ := digitsa_llpoSeq_spec hm
      obtain ⟨pn, en, onn⟩ := digitsa_llpoSeq_spec hn
      have gm : digitsa_gap s t (m / 2) = true := by
        rcases Nat.mod_two_eq_zero_or_one m with h | h
        · exact digitsa_gap_of1 (em h)
        · exact digitsa_gap_of2 (om h)
      have gn : digitsa_gap s t (n / 2) = true := by
        rcases Nat.mod_two_eq_zero_or_one n with h | h
        · exact digitsa_gap_of1 (en h)
        · exact digitsa_gap_of2 (onn h)
      have hmn : m / 2 = n / 2 := by
        rcases Nat.lt_trichotomy (m / 2) (n / 2) with h | h | h
        · rw [pn _ h] at gm
          exact absurd gm (by decide)
        · exact h
        · rw [pm _ h] at gn
          exact absurd gn (by decide)
      rcases Nat.mod_two_eq_zero_or_one m with hm2 | hm2 <;>
        rcases Nat.mod_two_eq_zero_or_one n with hn2 | hn2
      · omega
      · exfalso
        have h1 := em hm2
        rw [hmn] at h1
        exact digitsa_gap1_excl h1 (onn hn2)
      · exfalso
        have h1 := om hm2
        rw [hmn] at h1
        exact digitsa_gap1_excl (en hn2) h1
      · omega
    rcases hL (digitsa_llpoSeq s t) hu with he | ho
    · refine Or.inl (fun N => ?_)
      have hn : ¬ (approx t N + 2 ≤ approx s N) := by
        intro hg
        rcases digitsa_first (digitsa_gap s t) N with hall | ⟨M, hMN, hM, hpre⟩
        · have := hall N (Nat.le_refl N)
          rw [digitsa_gap_of1 (decide_eq_true hg)] at this
          exact absurd this (by decide)
        · unfold digitsa_gap at hM
          rw [Bool.or_eq_true] at hM
          rcases hM with h1 | h2
          · have := he M
            rw [digitsa_llpoSeq_even, decide_eq_true hpre, h1] at this
            exact absurd this (by decide)
          · obtain ⟨d, rfl⟩ : ∃ d, N = M + d := ⟨N - M, by omega⟩
            have hp := digitsa_gap_prop (digitsa_gap1_spec h2) d
            omega
      omega
    · refine Or.inr (fun N => ?_)
      have hn : ¬ (approx s N + 2 ≤ approx t N) := by
        intro hg
        rcases digitsa_first (digitsa_gap s t) N with hall | ⟨M, hMN, hM, hpre⟩
        · have := hall N (Nat.le_refl N)
          rw [digitsa_gap_of2 (decide_eq_true hg)] at this
          exact absurd this (by decide)
        · unfold digitsa_gap at hM
          rw [Bool.or_eq_true] at hM
          rcases hM with h1 | h2
          · obtain ⟨d, rfl⟩ : ∃ d, N = M + d := ⟨N - M, by omega⟩
            have hp := digitsa_gap_prop (digitsa_gap1_spec h1) d
            omega
          · have := ho M
            rw [digitsa_llpoSeq_odd, decide_eq_true hpre, h2] at this
            exact absurd this (by decide)
      omega

/-- 定理 J.17(c)：WLPO ⇒ LLPO。 -/
theorem WLPO_to_LLPO : WLPO → LLPO := by
  intro w a hu
  rcases w (fun n => a (2 * n)) with h | h
  · exact Or.inl h
  · refine Or.inr (fun n => ?_)
    cases ha : a (2 * n + 1)
    · rfl
    · exfalso
      apply h
      intro m
      show a (2 * m) = false
      cases hm : a (2 * m)
      · rfl
      · exact absurd (hu _ _ hm ha) (by omega)

/-- 定理 J.17(d)：名前の辞書式の三分 ⇔ LPO。 -/
theorem lex_trichotomy_iff_LPO :
    (∀ s t : Digits, LexLt s t ∨ s = t ∨ LexLt t s) ↔ LPO := by
  constructor
  · intro htri a
    rcases htri zeros (digitsa_ofBool a) with ⟨k, _, hk⟩ | heq | ⟨k, _, hk⟩
    · left
      cases ha : a k
      · rw [digitsa_ofBool_false ha] at hk
        exact absurd hk (Nat.lt_irrefl 0)
      · exact ⟨k, ha⟩
    · right
      intro n
      cases ha : a n
      · rfl
      · have := congrArg Fin.val (congrFun heq n)
        rw [digitsa_ofBool_true ha] at this
        exact absurd this Nat.zero_ne_one
    · exact absurd hk (Nat.not_lt_zero _)
  · intro L s t
    rcases L (fun i => decide (¬ s i = t i)) with ⟨n, hn⟩ | h
    · rcases digitsa_first (fun i => decide (¬ s i = t i)) n with hall | ⟨M, _, hM, hpre⟩
      · have := hall n (Nat.le_refl n)
        rw [hn] at this
        exact absurd this (by decide)
      · have hpre' : ∀ i, i < M → s i = t i :=
          fun i hi => Decidable.byContradiction (of_decide_eq_false (hpre i hi))
        have hne : (s M).val ≠ (t M).val := fun h => of_decide_eq_true hM (Fin.ext h)
        rcases Nat.lt_or_gt_of_ne hne with hlt | hgt
        · exact Or.inl ⟨M, hpre', hlt⟩
        · exact Or.inr (Or.inr ⟨M, fun i hi => (hpre' i hi).symm, hgt⟩)
    · exact Or.inr (Or.inl (funext fun i =>
        Decidable.byContradiction (of_decide_eq_false (h i))))

/-- 符号つきの桁（−9〜9）の部分和。 -/
def approxZ (e : Nat → Int) : Nat → Int
  | 0 => e 0
  | N + 1 => 10 * approxZ e N + e (N + 1)

/-- 符号つきの名前 e と標準の名前 s の値が同じ（部分和の差がどの桁でも2単位以内）。 -/
def MixedSame (e : Nat → Int) (s : Digits) : Prop :=
  ∀ N, -2 ≤ approxZ e N - (approx s N : Int) ∧ approxZ e N - (approx s N : Int) ≤ 2

-- e = (1, ε₀, ε₁, …)：a n が真なら n の偶奇で ε_n = +1・−1、ほかは 0
private def digitsa_eps (a : Nat → Bool) : Nat → Int
  | 0 => 1
  | n + 1 => cond (a n) (cond (decide (n % 2 = 0)) 1 (-1)) 0

private theorem digitsa_eps_false {a : Nat → Bool} {n : Nat} (h : a n = false) :
    digitsa_eps a (n + 1) = 0 := by
  show cond (a n) (cond (decide (n % 2 = 0)) 1 (-1)) 0 = 0
  rw [h]
  rfl

private theorem digitsa_eps_even {a : Nat → Bool} {n : Nat} (h : a n = true) (he : n % 2 = 0) :
    digitsa_eps a (n + 1) = 1 := by
  show cond (a n) (cond (decide (n % 2 = 0)) 1 (-1)) 0 = 1
  rw [h, decide_eq_true he]
  rfl

private theorem digitsa_eps_odd {a : Nat → Bool} {n : Nat} (h : a n = true) (ho : n % 2 = 1) :
    digitsa_eps a (n + 1) = -1 := by
  show cond (a n) (cond (decide (n % 2 = 0)) 1 (-1)) 0 = -1
  rw [h, decide_eq_false (by omega)]
  rfl

private theorem digitsa_eps_bound (a : Nat → Bool) (i : Nat) :
    -9 ≤ digitsa_eps a i ∧ digitsa_eps a i ≤ 9 := by
  cases i with
  | zero => exact ⟨show (-9 : Int) ≤ 1 by decide, show (1 : Int) ≤ 9 by decide⟩
  | succ n =>
    cases h : a n
    · rw [digitsa_eps_false h]
      exact ⟨by decide, by decide⟩
    · rcases Nat.mod_two_eq_zero_or_one n with h2 | h2
      · rw [digitsa_eps_even h h2]
        exact ⟨by decide, by decide⟩
      · rw [digitsa_eps_odd h h2]
        exact ⟨by decide, by decide⟩

private theorem digitsa_approxZ_pow (a : Nat → Bool) (K : Nat) (hz : ∀ j, j < K → a j = false) :
    ∀ N, N ≤ K → approxZ (digitsa_eps a) N = ((10 ^ N : Nat) : Int) := by
  intro N
  induction N with
  | zero => intro _; rfl
  | succ n ih =>
    intro hN
    show 10 * approxZ (digitsa_eps a) n + digitsa_eps a (n + 1) = ((10 ^ (n + 1) : Nat) : Int)
    rw [ih (by omega), digitsa_eps_false (hz n (by omega)), Nat.pow_succ]
    omega

private theorem digitsa_approx_lt0 {s : Digits} (h : (s 0).val = 0) (N : Nat) :
    approx s N + 1 ≤ 10 ^ N := by
  induction N with
  | zero =>
    show (s 0).val + 1 ≤ 1
    omega
  | succ n ih =>
    show 10 * approx s n + (s (n + 1)).val + 1 ≤ 10 ^ (n + 1)
    rw [Nat.pow_succ]
    have := (s (n + 1)).isLt
    omega

private theorem digitsa_approx_ge1 {s : Digits} (h : 1 ≤ (s 0).val) (N : Nat) :
    10 ^ N ≤ approx s N := by
  induction N with
  | zero =>
    show 1 ≤ (s 0).val
    exact h
  | succ n ih =>
    show 10 ^ (n + 1) ≤ 10 * approx s n + (s (n + 1)).val
    rw [Nat.pow_succ]
    omega

/-- 定理 J.17(f)：頭の桁が 1 以上の（だから値が [0, 1] に入る）符号つきの名前のどれにも、
値の同じ標準の名前があれば LLPO。 -/
theorem LLPO_of_signed_names :
    (∀ e : Nat → Int, 1 ≤ e 0 → (∀ i, -9 ≤ e i ∧ e i ≤ 9) → ∃ s : Digits, MixedSame e s) →
      LLPO := by
  intro H a hu
  obtain ⟨s, hsame⟩ := H (digitsa_eps a) (by show (1 : Int) ≤ 1; decide) (digitsa_eps_bound a)
  rcases Nat.eq_zero_or_pos (s 0).val with hs0 | hs0
  · refine Or.inl (fun n => ?_)
    cases ha : a (2 * n)
    · rfl
    · exfalso
      have hz : ∀ j, j < 2 * n → a j = false := by
        intro j hj
        cases hj' : a j
        · rfl
        · exact absurd (hu _ _ hj' ha) (by omega)
      have hpow := digitsa_approxZ_pow a (2 * n) hz (2 * n) (Nat.le_refl _)
      have he1 : digitsa_eps a (2 * n + 1) = 1 := digitsa_eps_even ha (by omega)
      have ha' : a (2 * n + 1) = false := by
        cases h' : a (2 * n + 1)
        · rfl
        · exact absurd (hu _ _ h' ha) (by omega)
      have he2 : digitsa_eps a (2 * n + 1 + 1) = 0 := digitsa_eps_false ha'
      have hZ : approxZ (digitsa_eps a) (2 * n + 1 + 1) =
          100 * ((10 ^ (2 * n) : Nat) : Int) + 10 := by
        show 10 * (10 * approxZ (digitsa_eps a) (2 * n) + digitsa_eps a (2 * n + 1)) +
          digitsa_eps a (2 * n + 1 + 1) = _
        rw [hpow, he1, he2]
        omega
      have hs := digitsa_approx_lt0 hs0 (2 * n + 1 + 1)
      rw [Nat.pow_succ, Nat.pow_succ] at hs
      have hm := (hsame (2 * n + 1 + 1)).2
      rw [hZ] at hm
      omega
  · refine Or.inr (fun n => ?_)
    cases ha : a (2 * n + 1)
    · rfl
    · exfalso
      have hz : ∀ j, j < 2 * n + 1 → a j = false := by
        intro j hj
        cases hj' : a j
        · rfl
        · exact absurd (hu _ _ hj' ha) (by omega)
      have hpow := digitsa_approxZ_pow a (2 * n + 1) hz (2 * n + 1) (Nat.le_refl _)
      have he1 : digitsa_eps a (2 * n + 1 + 1) = -1 := digitsa_eps_odd ha (by omega)
      have ha' : a (2 * n + 1 + 1) = false := by
        cases h' : a (2 * n + 1 + 1)
        · rfl
        · exact absurd (hu _ _ h' ha) (by omega)
      have he2 : digitsa_eps a (2 * n + 1 + 1 + 1) = 0 := digitsa_eps_false ha'
      have hZ : approxZ (digitsa_eps a) (2 * n + 1 + 1 + 1) =
          100 * ((10 ^ (2 * n + 1) : Nat) : Int) - 10 := by
        show 10 * (10 * approxZ (digitsa_eps a) (2 * n + 1) + digitsa_eps a (2 * n + 1 + 1)) +
          digitsa_eps a (2 * n + 1 + 1 + 1) = _
        rw [hpow, he1, he2]
        omega
      have hs := digitsa_approx_ge1 hs0 (2 * n + 1 + 1 + 1)
      rw [Nat.pow_succ, Nat.pow_succ] at hs
      have hm := (hsame (2 * n + 1 + 1 + 1)).1
      rw [hZ] at hm
      omega

/-- 値を 9 倍する：x の値が s の値の 9 倍（部分和の区間 [9·approx, 9·approx + 9] と
[iapprox, iapprox + 1] が、どの桁でも交わる。ℝ の 9 倍と同じ、`Reals.lean`）。 -/
def Times9 (s : Digits) (x : IName) : Prop :=
  ∀ N, 9 * approx s N ≤ iapprox x N + 1 ∧ iapprox x N ≤ 9 * approx s N + 9

/-- 名前の写像 F の答えの整数部が、入力の有限の桁で決まる（連続。計算できる写像はこの形）。 -/
def IntLocal (F : Digits → IName) : Prop :=
  ∀ s, ∃ M, ∀ t : Digits, (∀ i, i < M → t i = s i) → (F t).int = (F s).int

/-- 定理 J.17(g)：0.(1) の 9 倍には、1.(0) と 0.(9) のどちらの名前も当たる。 -/
theorem times9_ones : Times9 (fun _ => 1) ⟨1, zeros⟩ ∧ Times9 (fun _ => 1) ⟨0, fun _ => 9⟩ :=
  by
  have hc : ∀ N, 9 * approx (fun _ => (1 : Fin 10)) N + 1 = 1 * 10 ^ (N + 1) :=
    fun N => digitsa_const_aux 1 N
  constructor
  · intro N
    have h := hc N
    show 9 * approx (fun _ => (1 : Fin 10)) N ≤ 1 * 10 ^ (N + 1) + approx zeros N + 1 ∧
      1 * 10 ^ (N + 1) + approx zeros N ≤ 9 * approx (fun _ => (1 : Fin 10)) N + 9
    rw [digitsa_zeros_approx]
    constructor <;> omega
  · intro N
    have h := hc N
    have h9 := approx_nines N
    show 9 * approx (fun _ => (1 : Fin 10)) N ≤
        0 * 10 ^ (N + 1) + approx (fun _ => (9 : Fin 10)) N + 1 ∧
      0 * 10 ^ (N + 1) + approx (fun _ => (9 : Fin 10)) N ≤
        9 * approx (fun _ => (1 : Fin 10)) N + 9
    constructor <;> omega

private theorem digitsa_ones_prefix {t : Digits} {N : Nat} (h : ∀ i, i ≤ N → (t i).val = 1) :
    9 * approx t N + 1 = 10 ^ (N + 1) := by
  rw [digitsa_approx_congr (t := fun _ => (1 : Fin 10)) (fun i hi => Fin.ext (h i hi))]
  have := digitsa_const_aux 1 N
  change 9 * approx (fun _ => (1 : Fin 10)) N + 1 = 1 * 10 ^ (N + 1) at this
  omega

private theorem digitsa_ones_then {t : Digits} {M : Nat} (h : ∀ i, i < M → (t i).val = 1) :
    9 * approx t M + 10 = 10 ^ (M + 1) + 9 * (t M).val := by
  cases M with
  | zero =>
    show 9 * (t 0).val + 10 = 10 + 9 * (t 0).val
    omega
  | succ K =>
    have := digitsa_ones_prefix (N := K) (fun i hi => h i (by omega))
    show 9 * (10 * approx t K + (t (K + 1)).val) + 10 = 10 ^ (K + 1 + 1) + 9 * (t (K + 1)).val
    rw [Nat.pow_succ (m := K + 1)]
    omega

/-- 定理 J.17(g)：値を 9 倍する名前の写像は、0.(1) の近くで整数部を有限の桁で決められない。
どの M でも、頭の M 桁が 0.(1) と同じで、答えの整数部が F 0.(1) と違う名前がある。 -/
theorem times9_int_jumps (F : Digits → IName) (hF : ∀ s, Times9 s (F s)) (M : Nat) :
    ∃ t : Digits, (∀ i, i < M → t i = 1) ∧ (F t).int ≠ (F (fun _ => 1)).int := by
  have hc : (F (fun _ => 1)).int ≤ 1 := by
    have h := (hF (fun _ => 1) 0).2
    change (F (fun _ => 1)).int * 10 + approx (F (fun _ => 1)).frac 0 ≤ 9 * 1 + 9 at h
    omega
  rcases Nat.eq_zero_or_pos (F (fun _ => 1)).int with h0 | h1
  · refine ⟨fun i => if i < M then 1 else 2, fun i hi => ite_eq_left hi, fun heq => ?_⟩
    have h := (hF (fun i => if i < M then 1 else 2) M).1
    have ht := digitsa_ones_then (t := fun i => if i < M then (1 : Fin 10) else 2) (M := M)
      (fun i hi => by
        show (if i < M then (1 : Fin 10) else 2).val = 1
        rw [ite_eq_left hi]
        rfl)
    have htM : (if M < M then (1 : Fin 10) else 2).val = 2 := by
      rw [ite_eq_right (Nat.lt_irrefl M)]
      rfl
    change 9 * approx (fun i => if i < M then (1 : Fin 10) else 2) M + 10 =
      10 ^ (M + 1) + 9 * (if M < M then (1 : Fin 10) else 2).val at ht
    rw [htM] at ht
    have hl := digitsa_approx_lt (F (fun i => if i < M then 1 else 2)).frac M
    unfold iapprox at h
    rw [heq, h0, Nat.zero_mul] at h
    omega
  · have h1' : (F (fun _ => 1)).int = 1 := by omega
    refine ⟨fun i => if i < M then 1 else 0, fun i hi => ite_eq_left hi, fun heq => ?_⟩
    have h := (hF (fun i => if i < M then 1 else 0) M).2
    have ht := digitsa_ones_then (t := fun i => if i < M then (1 : Fin 10) else 0) (M := M)
      (fun i hi => by
        show (if i < M then (1 : Fin 10) else 0).val = 1
        rw [ite_eq_left hi]
        rfl)
    have htM : (if M < M then (1 : Fin 10) else 0).val = 0 := by
      rw [ite_eq_right (Nat.lt_irrefl M)]
      rfl
    change 9 * approx (fun i => if i < M then (1 : Fin 10) else 0) M + 10 =
      10 ^ (M + 1) + 9 * (if M < M then (1 : Fin 10) else 0).val at ht
    rw [htM] at ht
    unfold iapprox at h
    rw [heq, h1', Nat.one_mul] at h
    omega

/-- 定理 J.17(g)：十進の名前の上で、値の 9 倍を返す連続な写像は無い（1/9 から 9/9 への所）。 -/
theorem no_local_times9 : ¬ ∃ F : Digits → IName, (∀ s, Times9 s (F s)) ∧ IntLocal F := by
  rintro ⟨F, hF, hL⟩
  obtain ⟨M, hM⟩ := hL (fun _ => 1)
  obtain ⟨t, ht, hne⟩ := times9_int_jumps F hF M
  exact hne (hM t ht)

/-! ### J.18 数の段の梯子：字面の正規形と木の同一性 -/

/-- 数の字面 `-?[0-9]+.?[0-9]*`（sign.pegjs 177 行）。`fpart` は `.` が無ければ `none`。 -/
structure Lit where
  neg : Bool
  ipart : List (Fin 10)
  fpart : Option (List (Fin 10))
  deriving DecidableEq

/-- 桁の並びの値（10 進）。 -/
def digitsVal (l : List (Fin 10)) : Nat := l.foldl (fun a d => 10 * a + d.val) 0

/-- 小数点の後ろの桁（`.` が無ければ空）。 -/
def Lit.frac (l : Lit) : List (Fin 10) := l.fpart.getD []

/-- 字面の値 num / 10^exp の分子。 -/
def Lit.num (l : Lit) : Int :=
  if l.neg then -((digitsVal (l.ipart ++ l.frac) : Nat) : Int)
  else ((digitsVal (l.ipart ++ l.frac) : Nat) : Int)

/-- 字面の値 num / 10^exp の 10 の冪。 -/
def Lit.exp (l : Lit) : Nat := l.frac.length

/-- 2つの字面の値が同じ（ℤ[1/10] の等しさ）。 -/
def SameLitVal (l₁ l₂ : Lit) : Prop := l₁.num * 10 ^ l₂.exp = l₂.num * 10 ^ l₁.exp

/-- 字面の値の等しさは決まる（Int の等しさ）。 -/
instance (l₁ l₂ : Lit) : Decidable (SameLitVal l₁ l₂) :=
  inferInstanceAs (Decidable (l₁.num * 10 ^ l₂.exp = l₂.num * 10 ^ l₁.exp))

/-- 頭の 0 を落とす。 -/
def dropLeadingZeros : List (Fin 10) → List (Fin 10)
  | [] => []
  | d :: ds => if d.val = 0 then dropLeadingZeros ds else d :: ds

/-- 末尾の 0 を落とす。 -/
def dropTrailingZeros (l : List (Fin 10)) : List (Fin 10) := (dropLeadingZeros l.reverse).reverse

/-- 字面の正規形：整数部の頭の 0 と小数部の末尾の 0 を落とし、空の小数部は `.` ごと落とし、
`-0` は `0` にする。 -/
def Lit.norm (l : Lit) : Lit :=
  let i := dropLeadingZeros l.ipart
  let f := dropTrailingZeros l.frac
  { neg := l.neg && !(i.isEmpty && f.isEmpty)
    ipart := if i.isEmpty then [(0 : Fin 10)] else i
    fpart := if f.isEmpty then none else some f }

-- 桁の並びの値：畳み込みと連結
private theorem digitsa_foldl (l : List (Fin 10)) (acc : Nat) :
    l.foldl (fun a d => 10 * a + d.val) acc =
      acc * 10 ^ l.length + l.foldl (fun a d => 10 * a + d.val) 0 := by
  induction l generalizing acc with
  | nil =>
    show acc = acc * 10 ^ 0 + 0
    rw [Nat.pow_zero, Nat.mul_one, Nat.add_zero]
  | cons d ds ih =>
    show ds.foldl (fun a d => 10 * a + d.val) (10 * acc + d.val) =
      acc * 10 ^ (ds.length + 1) + ds.foldl (fun a d => 10 * a + d.val) (10 * 0 + d.val)
    rw [ih (10 * acc + d.val), ih (10 * 0 + d.val), Nat.pow_succ, Nat.add_mul, Nat.add_mul,
      Nat.mul_assoc 10 acc, ← Nat.mul_assoc acc, Nat.mul_zero, Nat.zero_mul, Nat.zero_add]
    omega

private theorem digitsa_val_append (l m : List (Fin 10)) :
    digitsVal (l ++ m) = digitsVal l * 10 ^ m.length + digitsVal m := by
  unfold digitsVal
  rw [List.foldl_append, digitsa_foldl m (List.foldl (fun a d => 10 * a + d.val) 0 l)]

private theorem digitsa_val_cons (d : Fin 10) (ds : List (Fin 10)) :
    digitsVal (d :: ds) = d.val * 10 ^ ds.length + digitsVal ds := by
  show ds.foldl (fun a d => 10 * a + d.val) (10 * 0 + d.val) = _
  rw [digitsa_foldl ds (10 * 0 + d.val), Nat.mul_zero, Nat.zero_add]
  rfl

private theorem digitsa_val_snoc (ds : List (Fin 10)) (d : Fin 10) :
    digitsVal (ds ++ [d]) = digitsVal ds * 10 + d.val := by
  rw [digitsa_val_append, digitsa_val_cons]
  show digitsVal ds * 10 ^ 1 + (d.val * 10 ^ 0 + 0) = digitsVal ds * 10 + d.val
  rw [Nat.pow_one, Nat.pow_zero, Nat.mul_one, Nat.add_zero]

private theorem digitsa_val_lt (l : List (Fin 10)) : digitsVal l < 10 ^ l.length := by
  induction l with
  | nil => exact Nat.zero_lt_one
  | cons d ds ih =>
    rw [digitsa_val_cons, List.length_cons, Nat.pow_succ]
    have hd : d.val * 10 ^ ds.length ≤ 9 * 10 ^ ds.length :=
      Nat.mul_le_mul_right _ (Nat.le_of_lt_succ d.isLt)
    omega

private theorem digitsa_val_replicate (k : Nat) :
    digitsVal (List.replicate k (0 : Fin 10)) = 0 := by
  induction k with
  | zero => rfl
  | succ k ih =>
    rw [List.replicate_succ, digitsa_val_cons, ih]
    exact Nat.zero_mul _

private theorem digitsa_val_zeros (l : List (Fin 10)) (k : Nat) :
    digitsVal (l ++ List.replicate k 0) = digitsVal l * 10 ^ k := by
  rw [digitsa_val_append, digitsa_val_replicate, List.length_replicate, Nat.add_zero]

private theorem digitsa_lead_ge (d : Fin 10) (ds : List (Fin 10)) (hd : d.val ≠ 0) :
    10 ^ ds.length ≤ digitsVal (d :: ds) := by
  rw [digitsa_val_cons]
  have : 1 * 10 ^ ds.length ≤ d.val * 10 ^ ds.length := Nat.mul_le_mul_right _ (by omega)
  omega

-- 頭の 0・末尾の 0
private theorem digitsa_dlz_cons_eq {d : Fin 10} {ds : List (Fin 10)} (hd : d.val = 0) :
    dropLeadingZeros (d :: ds) = dropLeadingZeros ds := by
  show (if d.val = 0 then dropLeadingZeros ds else d :: ds) = _
  rw [ite_eq_left hd]

private theorem digitsa_dlz_cons_ne {d : Fin 10} {ds : List (Fin 10)} (hd : d.val ≠ 0) :
    dropLeadingZeros (d :: ds) = d :: ds := by
  show (if d.val = 0 then dropLeadingZeros ds else d :: ds) = _
  rw [ite_eq_right hd]

private theorem digitsa_dlz_val (l : List (Fin 10)) :
    digitsVal (dropLeadingZeros l) = digitsVal l := by
  induction l with
  | nil => rfl
  | cons d ds ih =>
    rcases Nat.eq_zero_or_pos d.val with hd | hd
    · rw [digitsa_dlz_cons_eq hd, ih, digitsa_val_cons, hd, Nat.zero_mul, Nat.zero_add]
    · rw [digitsa_dlz_cons_ne (by omega)]

private theorem digitsa_dlz_form (l : List (Fin 10)) :
    dropLeadingZeros l = [] ∨ ∃ d ds, dropLeadingZeros l = d :: ds ∧ d.val ≠ 0 := by
  induction l with
  | nil => exact Or.inl rfl
  | cons d ds ih =>
    rcases Nat.eq_zero_or_pos d.val with hd | hd
    · rw [digitsa_dlz_cons_eq hd]
      exact ih
    · exact Or.inr ⟨d, ds, digitsa_dlz_cons_ne (by omega), by omega⟩

private theorem digitsa_dlz_split (l : List (Fin 10)) :
    ∃ k, l = List.replicate k 0 ++ dropLeadingZeros l := by
  induction l with
  | nil => exact ⟨0, rfl⟩
  | cons d ds ih =>
    rcases Nat.eq_zero_or_pos d.val with hd | hd
    · obtain ⟨k, hk⟩ := ih
      refine ⟨k + 1, ?_⟩
      rw [digitsa_dlz_cons_eq hd, List.replicate_succ, List.cons_append, ← hk,
        show d = 0 from Fin.ext hd]
    · refine ⟨0, ?_⟩
      show d :: ds = [] ++ dropLeadingZeros (d :: ds)
      rw [digitsa_dlz_cons_ne (by omega), List.nil_append]

private theorem digitsa_dtz_split (l : List (Fin 10)) :
    ∃ k, l = dropTrailingZeros l ++ List.replicate k 0 := by
  obtain ⟨k, hk⟩ := digitsa_dlz_split l.reverse
  refine ⟨k, ?_⟩
  have := congrArg List.reverse hk
  rw [List.reverse_reverse, List.reverse_append, List.reverse_replicate] at this
  exact this

private theorem digitsa_dtz_form (l : List (Fin 10)) :
    dropTrailingZeros l = [] ∨ ∃ ds d, dropTrailingZeros l = ds ++ [d] ∧ d.val ≠ 0 := by
  unfold dropTrailingZeros
  rcases digitsa_dlz_form l.reverse with h | ⟨d, ds, h, hd⟩
  · rw [h]
    exact Or.inl rfl
  · rw [h, List.reverse_cons]
    exact Or.inr ⟨ds.reverse, d, rfl, hd⟩

private theorem digitsa_dtz_idem (l : List (Fin 10)) :
    dropTrailingZeros (dropTrailingZeros l) = dropTrailingZeros l := by
  rcases digitsa_dtz_form l with h | ⟨ds, d, h, hd⟩
  · rw [h]
    rfl
  · rw [h]
    unfold dropTrailingZeros
    rw [List.reverse_append, List.reverse_singleton, List.singleton_append,
      digitsa_dlz_cons_ne hd, List.reverse_cons, List.reverse_reverse]

private theorem digitsa_isEmpty_snoc (ds : List (Fin 10)) (d : Fin 10) :
    (ds ++ [d]).isEmpty = false := by
  cases ds <;> rfl

-- 正規形の欄
private theorem digitsa_norm_neg (l : Lit) : l.norm.neg =
    (l.neg && !((dropLeadingZeros l.ipart).isEmpty && (dropTrailingZeros l.frac).isEmpty)) := rfl

private theorem digitsa_norm_ipart (l : Lit) : l.norm.ipart =
    if (dropLeadingZeros l.ipart).isEmpty then [(0 : Fin 10)] else dropLeadingZeros l.ipart := rfl

private theorem digitsa_norm_fpart (l : Lit) : l.norm.fpart =
    if (dropTrailingZeros l.frac).isEmpty then none else some (dropTrailingZeros l.frac) := rfl

private theorem digitsa_getD_ite (f : List (Fin 10)) :
    (if f.isEmpty then none else some f).getD [] = f := by
  cases f <;> rfl

private theorem digitsa_norm_frac (l : Lit) : l.norm.frac = dropTrailingZeros l.frac :=
  digitsa_getD_ite _

private theorem digitsa_ipart_val (i : List (Fin 10)) :
    digitsVal (if i.isEmpty then [(0 : Fin 10)] else i) = digitsVal i := by
  cases i <;> rfl

private theorem digitsa_norm_val (l : Lit) :
    digitsVal (l.norm.ipart ++ l.norm.frac) =
      digitsVal (dropLeadingZeros l.ipart) * 10 ^ (dropTrailingZeros l.frac).length +
        digitsVal (dropTrailingZeros l.frac) := by
  rw [digitsa_val_append, digitsa_norm_frac, digitsa_norm_ipart, digitsa_ipart_val]

private theorem digitsa_val_split (ip fr : List (Fin 10)) :
    ∃ k, fr.length = (dropTrailingZeros fr).length + k ∧
      digitsVal (ip ++ fr) = (digitsVal (dropLeadingZeros ip) * 10 ^ (dropTrailingZeros fr).length +
        digitsVal (dropTrailingZeros fr)) * 10 ^ k := by
  obtain ⟨k, hk⟩ := digitsa_dtz_split fr
  refine ⟨k, ?_, ?_⟩
  · revert hk
    generalize dropTrailingZeros fr = f
    intro hk
    subst hk
    rw [List.length_append, List.length_replicate]
  · rw [digitsa_dlz_val]
    revert hk
    generalize dropTrailingZeros fr = f
    intro hk
    subst hk
    rw [← List.append_assoc, digitsa_val_zeros, digitsa_val_append]

private theorem digitsa_num_false {l : Lit} (h : l.neg = false) :
    l.num = ((digitsVal (l.ipart ++ l.frac) : Nat) : Int) := by
  unfold Lit.num
  rw [h, ite_eq_right Bool.false_ne_true]

private theorem digitsa_num_true {l : Lit} (h : l.neg = true) :
    l.num = -((digitsVal (l.ipart ++ l.frac) : Nat) : Int) := by
  unfold Lit.num
  rw [h, ite_eq_left rfl]

private theorem digitsa_natAbs_num (l : Lit) : l.num.natAbs = digitsVal (l.ipart ++ l.frac) := by
  cases h : l.neg
  · rw [digitsa_num_false h, Int.natAbs_natCast]
  · rw [digitsa_num_true h, Int.natAbs_neg, Int.natAbs_natCast]

private theorem digitsa_norm_sameVal (l : Lit) : SameLitVal l l.norm := by
  obtain ⟨k, hlen, hval⟩ := digitsa_val_split l.ipart l.frac
  have hnv := digitsa_norm_val l
  have hexp_n : l.norm.exp = (dropTrailingZeros l.frac).length := by
    unfold Lit.exp
    rw [digitsa_norm_frac]
  have hexp_l : l.exp = (dropTrailingZeros l.frac).length + k := hlen
  have EN : digitsVal (l.ipart ++ l.frac) * 10 ^ l.norm.exp =
      digitsVal (l.norm.ipart ++ l.norm.frac) * 10 ^ l.exp := by
    rw [hval, hnv, hexp_n, hexp_l, Nat.pow_add, Nat.mul_assoc, Nat.mul_comm (10 ^ k)]
  have E : ((digitsVal (l.ipart ++ l.frac) : Nat) : Int) * 10 ^ l.norm.exp =
      ((digitsVal (l.norm.ipart ++ l.norm.frac) : Nat) : Int) * 10 ^ l.exp := by
    have := congrArg (fun x : Nat => (x : Int)) EN
    simp only [Int.natCast_mul, Int.natCast_pow] at this
    exact this
  unfold SameLitVal
  cases hneg : l.neg
  · have hn : l.norm.neg = false := by rw [digitsa_norm_neg, hneg]; rfl
    rw [digitsa_num_false hneg, digitsa_num_false hn]
    exact E
  · cases hc : ((dropLeadingZeros l.ipart).isEmpty && (dropTrailingZeros l.frac).isEmpty)
    · have hn : l.norm.neg = true := by rw [digitsa_norm_neg, hneg, hc]; rfl
      rw [digitsa_num_true hneg, digitsa_num_true hn, Int.neg_mul, Int.neg_mul, E]
    · have hn : l.norm.neg = false := by rw [digitsa_norm_neg, hneg, hc]; rfl
      rw [Bool.and_eq_true, List.isEmpty_iff, List.isEmpty_iff] at hc
      have hz : digitsVal (l.norm.ipart ++ l.norm.frac) = 0 := by
        rw [hnv, hc.1, hc.2]
        rfl
      have hz' : digitsVal (l.ipart ++ l.frac) = 0 := by
        rw [hval, hc.1, hc.2]
        exact Nat.zero_mul _
      rw [digitsa_num_true hneg, digitsa_num_false hn, hz, hz']
      rw [Int.natCast_zero, Int.neg_zero, Int.zero_mul, Int.zero_mul]

private theorem digitsa_lit_symm {a b : Lit} (h : SameLitVal a b) : SameLitVal b a := h.symm

private theorem digitsa_pow10_ne (n : Nat) : (10 : Int) ^ n ≠ 0 := by
  have h : ((10 ^ n : Nat) : Int) = (10 : Int) ^ n := Int.natCast_pow 10 n
  have hp : 0 < 10 ^ n := Nat.pow_pos (by decide)
  rw [← h]
  omega

private theorem digitsa_lit_trans {a b c : Lit} (h1 : SameLitVal a b) (h2 : SameLitVal b c) :
    SameLitVal a c := by
  unfold SameLitVal at *
  apply Int.eq_of_mul_eq_mul_right (digitsa_pow10_ne b.exp)
  rw [Int.mul_right_comm, h1, Int.mul_right_comm, h2, Int.mul_right_comm]

-- 正規形の性質
private def digitsa_IsNorm (n : Lit) : Prop :=
  (n.ipart = [0] ∨ ∃ d ds, n.ipart = d :: ds ∧ d.val ≠ 0) ∧
  (n.fpart = none ∨ ∃ ds d, n.fpart = some (ds ++ [d]) ∧ d.val ≠ 0) ∧
  (n.neg = true → digitsVal (n.ipart ++ n.frac) ≠ 0)

private theorem digitsa_isNorm_norm (l : Lit) : digitsa_IsNorm l.norm := by
  refine ⟨?_, ?_, ?_⟩
  · rw [digitsa_norm_ipart]
    rcases digitsa_dlz_form l.ipart with h | ⟨d, ds, h, hd⟩
    · rw [h]
      exact Or.inl rfl
    · rw [h]
      exact Or.inr ⟨d, ds, rfl, hd⟩
  · rw [digitsa_norm_fpart]
    rcases digitsa_dtz_form l.frac with h | ⟨ds, d, h, hd⟩
    · rw [h]
      exact Or.inl rfl
    · rw [h, digitsa_isEmpty_snoc, ite_eq_right Bool.false_ne_true]
      exact Or.inr ⟨ds, d, rfl, hd⟩
  · intro hneg
    rw [digitsa_norm_neg, Bool.and_eq_true] at hneg
    obtain ⟨_, hc⟩ := hneg
    rw [digitsa_norm_val]
    cases hA : (dropLeadingZeros l.ipart).isEmpty
    · rcases digitsa_dlz_form l.ipart with h | ⟨d, ds, h, hd⟩
      · rw [h] at hA
        exact absurd hA (by decide)
      · have h1 := digitsa_lead_ge d ds hd
        rw [← h] at h1
        have h2 : 0 < digitsVal (dropLeadingZeros l.ipart) *
            10 ^ (dropTrailingZeros l.frac).length :=
          Nat.mul_pos (by have := Nat.pow_pos (n := ds.length) (show 0 < 10 by decide); omega)
            (Nat.pow_pos (by decide))
        omega
    · cases hB : (dropTrailingZeros l.frac).isEmpty
      · rcases digitsa_dtz_form l.frac with h | ⟨ds, d, h, hd⟩
        · rw [h] at hB
          exact absurd hB (by decide)
        · have h1 := digitsa_val_snoc ds d
          rw [← h] at h1
          omega
      · rw [hA, hB] at hc
        exact absurd hc (by decide)

private theorem digitsa_divmod_unique {a b c d P : Nat} (h : a * P + b = c * P + d) (hb : b < P)
    (hd : d < P) : a = c ∧ b = d := by
  have hac : a = c := by
    rcases Nat.lt_trichotomy a c with h1 | h1 | h1
    · have := Nat.mul_le_mul_right P (Nat.succ_le_of_lt h1)
      rw [Nat.succ_mul] at this
      omega
    · exact h1
    · have := Nat.mul_le_mul_right P (Nat.succ_le_of_lt h1)
      rw [Nat.succ_mul] at this
      omega
  subst hac
  exact ⟨rfl, by omega⟩

private theorem digitsa_inj_len :
    ∀ (l m : List (Fin 10)), l.length = m.length → digitsVal l = digitsVal m → l = m
  | [], [], _, _ => rfl
  | [], _ :: _, h, _ => absurd h.symm (Nat.succ_ne_zero _)
  | _ :: _, [], h, _ => absurd h (Nat.succ_ne_zero _)
  | d :: ds, e :: es, h, hv => by
    rw [digitsa_val_cons, digitsa_val_cons] at hv
    have hlen : ds.length = es.length := Nat.succ.inj h
    rw [hlen] at hv
    have hlt : digitsVal ds < 10 ^ es.length := by
      rw [← hlen]
      exact digitsa_val_lt ds
    obtain ⟨h1, h2⟩ := digitsa_divmod_unique hv hlt (digitsa_val_lt es)
    rw [Fin.ext h1, digitsa_inj_len ds es hlen h2]

private theorem digitsa_ipart_unique {I₁ I₂ : List (Fin 10)}
    (h₁ : I₁ = [0] ∨ ∃ d ds, I₁ = d :: ds ∧ d.val ≠ 0)
    (h₂ : I₂ = [0] ∨ ∃ d ds, I₂ = d :: ds ∧ d.val ≠ 0)
    (hv : digitsVal I₁ = digitsVal I₂) : I₁ = I₂ := by
  rcases h₁ with rfl | ⟨d, ds, rfl, hd⟩ <;> rcases h₂ with rfl | ⟨e, es, rfl, he⟩
  · rfl
  · exfalso
    have h1 := digitsa_lead_ge e es he
    have h2 := Nat.pow_pos (n := es.length) (show 0 < 10 by decide)
    change 0 = digitsVal (e :: es) at hv
    omega
  · exfalso
    have h1 := digitsa_lead_ge d ds hd
    have h2 := Nat.pow_pos (n := ds.length) (show 0 < 10 by decide)
    change digitsVal (d :: ds) = 0 at hv
    omega
  · apply digitsa_inj_len _ _ _ hv
    have h1 := digitsa_lead_ge d ds hd
    have h2 := digitsa_val_lt (d :: ds)
    have h3 := digitsa_lead_ge e es he
    have h4 := digitsa_val_lt (e :: es)
    rw [List.length_cons] at h2 h4
    show ds.length + 1 = es.length + 1
    rcases Nat.lt_trichotomy ds.length es.length with hl | hl | hl
    · exfalso
      have := Nat.pow_le_pow_right (show 10 > 0 by decide) (show ds.length + 1 ≤ es.length from hl)
      omega
    · rw [hl]
    · exfalso
      have := Nat.pow_le_pow_right (show 10 > 0 by decide) (show es.length + 1 ≤ ds.length from hl)
      omega

private theorem digitsa_fpart_of_norm {n : Lit}
    (h : n.fpart = none ∨ ∃ ds d, n.fpart = some (ds ++ [d]) ∧ d.val ≠ 0) :
    n.fpart = if n.frac.isEmpty then none else some n.frac := by
  unfold Lit.frac
  rcases h with h | ⟨ds, d, h, _⟩
  · rw [h]
    rfl
  · rw [h]
    show some (ds ++ [d]) = if (ds ++ [d]).isEmpty then none else some (ds ++ [d])
    rw [digitsa_isEmpty_snoc, ite_eq_right Bool.false_ne_true]

private theorem digitsa_last_digit {n : Lit}
    (h : n.fpart = none ∨ ∃ ds d, n.fpart = some (ds ++ [d]) ∧ d.val ≠ 0) (hpos : 0 < n.exp) :
    digitsVal (n.ipart ++ n.frac) % 10 ≠ 0 := by
  rcases h with h | ⟨ds, d, h, hd⟩
  · exfalso
    have : n.exp = 0 := by
      unfold Lit.exp Lit.frac
      rw [h]
      rfl
    omega
  · have hf : n.frac = ds ++ [d] := by
      unfold Lit.frac
      rw [h]
      rfl
    rw [hf, ← List.append_assoc, digitsa_val_snoc]
    have := d.isLt
    omega

private theorem digitsa_cancel_exp {Va Vb ea eb : Nat} (h : Va * 10 ^ eb = Vb * 10 ^ ea)
    (hlt : ea < eb) : Vb % 10 = 0 := by
  obtain ⟨r, rfl⟩ : ∃ r, eb = ea + (r + 1) := ⟨eb - ea - 1, by omega⟩
  rw [Nat.pow_add] at h
  have h1 : Va * 10 ^ (r + 1) * 10 ^ ea = Vb * 10 ^ ea := by
    rw [← h, Nat.mul_assoc, Nat.mul_comm (10 ^ (r + 1))]
  have h2 := Nat.eq_of_mul_eq_mul_right (Nat.pow_pos (by decide)) h1
  rw [← h2, Nat.pow_succ, ← Nat.mul_assoc]
  omega

private theorem digitsa_lit_ext {a b : Lit} (h1 : a.neg = b.neg) (h2 : a.ipart = b.ipart)
    (h3 : a.fpart = b.fpart) : a = b := by
  cases a
  cases b
  cases h1
  cases h2
  cases h3
  rfl

private theorem digitsa_normal_unique {a b : Lit} (ha : digitsa_IsNorm a) (hb : digitsa_IsNorm b)
    (h : SameLitVal a b) : a = b := by
  obtain ⟨hA1, hA2, hA3⟩ := ha
  obtain ⟨hB1, hB2, hB3⟩ := hb
  have hN : digitsVal (a.ipart ++ a.frac) * 10 ^ b.exp =
      digitsVal (b.ipart ++ b.frac) * 10 ^ a.exp := by
    have := congrArg Int.natAbs h
    rw [Int.natAbs_mul, Int.natAbs_mul, Int.natAbs_pow, Int.natAbs_pow, digitsa_natAbs_num,
      digitsa_natAbs_num] at this
    exact this
  have hexp : a.exp = b.exp := by
    rcases Nat.lt_trichotomy a.exp b.exp with hlt | heq | hgt
    · exact absurd (digitsa_cancel_exp hN hlt) (digitsa_last_digit hB2 (by omega))
    · exact heq
    · exact absurd (digitsa_cancel_exp hN.symm hgt) (digitsa_last_digit hA2 (by omega))
  have hV : digitsVal (a.ipart ++ a.frac) = digitsVal (b.ipart ++ b.frac) := by
    rw [hexp] at hN
    exact Nat.eq_of_mul_eq_mul_right (Nat.pow_pos (by decide)) hN
  have hlen : a.frac.length = b.frac.length := hexp
  have hV' := hV
  rw [digitsa_val_append, digitsa_val_append, hlen] at hV'
  have hla : digitsVal a.frac < 10 ^ b.frac.length := by
    rw [← hlen]
    exact digitsa_val_lt a.frac
  obtain ⟨hi, hf⟩ := digitsa_divmod_unique hV' hla (digitsa_val_lt b.frac)
  have hfrac : a.frac = b.frac := digitsa_inj_len _ _ hlen hf
  have hip : a.ipart = b.ipart := digitsa_ipart_unique hA1 hB1 hi
  have hfp : a.fpart = b.fpart := by
    rw [digitsa_fpart_of_norm hA2, digitsa_fpart_of_norm hB2, hfrac]
  have hneg : a.neg = b.neg := by
    rcases Nat.eq_zero_or_pos (digitsVal (a.ipart ++ a.frac)) with h0 | hpos
    · have ha : a.neg = false := by
        cases hn : a.neg
        · rfl
        · exact absurd h0 (hA3 hn)
      have hb : b.neg = false := by
        cases hn : b.neg
        · rfl
        · exact absurd (hV ▸ h0) (hB3 hn)
      rw [ha, hb]
    · have hnum : a.num = b.num := by
        have hs : a.num * 10 ^ b.exp = b.num * 10 ^ a.exp := h
        rw [hexp] at hs
        exact Int.eq_of_mul_eq_mul_right (digitsa_pow10_ne _) hs
      cases ha : a.neg <;> cases hb : b.neg
      · rfl
      · exfalso
        rw [digitsa_num_false ha, digitsa_num_true hb] at hnum
        omega
      · exfalso
        rw [digitsa_num_true ha, digitsa_num_false hb] at hnum
        omega
      · rfl
  exact digitsa_lit_ext hneg hip hfp

/-- 定理 J.18(a)：字面の値が同じ ⇔ 正規形の綴りが同じ。 -/
theorem lit_sameVal_iff_norm (l₁ l₂ : Lit) : SameLitVal l₁ l₂ ↔ l₁.norm = l₂.norm := by
  constructor
  · intro h
    exact digitsa_normal_unique (digitsa_isNorm_norm l₁) (digitsa_isNorm_norm l₂)
      (digitsa_lit_trans (digitsa_lit_symm (digitsa_norm_sameVal l₁))
        (digitsa_lit_trans h (digitsa_norm_sameVal l₂)))
  · intro h
    have h1 := digitsa_norm_sameVal l₁
    have h2 := digitsa_norm_sameVal l₂
    rw [← h] at h2
    exact digitsa_lit_trans h1 (digitsa_lit_symm h2)

/-- 定理 J.18(a)：正規形は値を変えない。 -/
theorem lit_norm_sameVal (l : Lit) : SameLitVal l l.norm := digitsa_norm_sameVal l

private theorem digitsa_dlz_norm (x : List (Fin 10)) :
    dropLeadingZeros (if (dropLeadingZeros x).isEmpty then [(0 : Fin 10)]
      else dropLeadingZeros x) = dropLeadingZeros x := by
  rcases digitsa_dlz_form x with h | ⟨d, ds, h, hd⟩
  · rw [h]
    rfl
  · rw [h]
    show dropLeadingZeros (d :: ds) = d :: ds
    exact digitsa_dlz_cons_ne hd

private theorem digitsa_bool_aux (x y : Bool) : ((x && y) && y) = (x && y) := by
  cases x <;> cases y <;> rfl

/-- 定理 J.18(a)：正規形はもう一度取っても変わらない。 -/
theorem lit_norm_idem (l : Lit) : l.norm.norm = l.norm := by
  have hi : dropLeadingZeros l.norm.ipart = dropLeadingZeros l.ipart := by
    rw [digitsa_norm_ipart]
    exact digitsa_dlz_norm l.ipart
  have hf : dropTrailingZeros l.norm.frac = dropTrailingZeros l.frac := by
    rw [digitsa_norm_frac]
    exact digitsa_dtz_idem l.frac
  apply digitsa_lit_ext
  · rw [digitsa_norm_neg l.norm, hi, hf, digitsa_norm_neg l]
    exact digitsa_bool_aux _ _
  · rw [digitsa_norm_ipart l.norm, hi]
    rfl
  · rw [digitsa_norm_fpart l.norm, hf]
    rfl

-- 長さ k の桁で r を書く（r < 10^k なら値は r）
private def digitsa_fix : Nat → Nat → List (Fin 10)
  | 0, _ => []
  | k + 1, r => digitsa_fix k (r / 10) ++ [⟨r % 10, Nat.mod_lt _ (by decide)⟩]

private theorem digitsa_fix_length (k r : Nat) : (digitsa_fix k r).length = k := by
  induction k generalizing r with
  | zero => rfl
  | succ k ih =>
    show (digitsa_fix k (r / 10) ++ [(⟨r % 10, Nat.mod_lt _ (by decide)⟩ : Fin 10)]).length = k + 1
    rw [List.length_append, ih]
    rfl

private theorem digitsa_fix_val (k r : Nat) (h : r < 10 ^ k) : digitsVal (digitsa_fix k r) = r := by
  induction k generalizing r with
  | zero =>
    change r < 1 at h
    show 0 = r
    omega
  | succ k ih =>
    show digitsVal (digitsa_fix k (r / 10) ++ [(⟨r % 10, Nat.mod_lt _ (by decide)⟩ : Fin 10)]) = r
    have hr : r / 10 < 10 ^ k := by
      rw [Nat.div_lt_iff_lt_mul (by decide)]
      rw [Nat.pow_succ] at h
      exact h
    rw [digitsa_val_snoc, ih (r / 10) hr]
    exact Nat.div_add_mod' r 10

private theorem digitsa_lt_pow (v j : Nat) : v < 10 ^ (v + 1 + j) := by
  induction v with
  | zero => exact Nat.pow_pos (by decide)
  | succ v ih =>
    rw [show v + 1 + 1 + j = (v + 1 + j) + 1 by omega, Nat.pow_succ]
    omega

private theorem digitsa_split_val (v j : Nat) :
    ∃ ip fr : List (Fin 10), ip ≠ [] ∧ fr.length = j ∧ digitsVal (ip ++ fr) = v := by
  refine ⟨(digitsa_fix (v + 1 + j) v).take (v + 1), (digitsa_fix (v + 1 + j) v).drop (v + 1),
    ?_, ?_, ?_⟩
  · intro h
    have := congrArg List.length h
    rw [List.length_take, digitsa_fix_length] at this
    change min (v + 1) (v + 1 + j) = 0 at this
    omega
  · rw [List.length_drop, digitsa_fix_length]
    omega
  · rw [List.take_append_drop, digitsa_fix_val _ _ (digitsa_lt_pow v j)]

/-- 定理 J.18(a)：ℤ[1/10] のどの元 m / 10^j も、文法に合う字面（整数部が空でない）の値。 -/
theorem lit_onto (m : Int) (j : Nat) :
    ∃ l : Lit, l.ipart ≠ [] ∧ l.num * 10 ^ j = m * 10 ^ l.exp := by
  cases m with
  | ofNat v =>
    obtain ⟨ip, fr, hip, hfr, hv⟩ := digitsa_split_val v j
    refine ⟨⟨false, ip, some fr⟩, hip, ?_⟩
    have hexp : (⟨false, ip, some fr⟩ : Lit).exp = j := hfr
    have hnum : (⟨false, ip, some fr⟩ : Lit).num = Int.ofNat v := by
      rw [digitsa_num_false rfl]
      show ((digitsVal (ip ++ fr) : Nat) : Int) = _
      rw [hv]
      rfl
    rw [hexp, hnum]
  | negSucc v =>
    obtain ⟨ip, fr, hip, hfr, hv⟩ := digitsa_split_val (v + 1) j
    refine ⟨⟨true, ip, some fr⟩, hip, ?_⟩
    have hexp : (⟨true, ip, some fr⟩ : Lit).exp = j := hfr
    have hnum : (⟨true, ip, some fr⟩ : Lit).num = Int.negSucc v := by
      rw [digitsa_num_true rfl]
      show -((digitsVal (ip ++ fr) : Nat) : Int) = _
      rw [hv, Int.negSucc_eq]
      omega
    rw [hexp, hnum]

/-- 定理 J.18(a)：`01` と `1`、`1.`・`1.0` と `1`、`-0` と `0` は、綴りが違って値が同じ。 -/
theorem lit_examples :
    let one : Lit := ⟨false, [1], none⟩
    let zero : Lit := ⟨false, [0], none⟩
    (⟨false, [0, 1], none⟩ : Lit) ≠ one ∧ SameLitVal ⟨false, [0, 1], none⟩ one ∧
    (⟨false, [1], some []⟩ : Lit) ≠ one ∧ SameLitVal ⟨false, [1], some []⟩ one ∧
    (⟨false, [1], some [0]⟩ : Lit) ≠ one ∧ SameLitVal ⟨false, [1], some [0]⟩ one ∧
    (⟨true, [0], none⟩ : Lit) ≠ zero ∧ SameLitVal ⟨true, [0], none⟩ zero := by
  decide

/-- 1変数の関数の木（`x`・数・`+`）。 -/
inductive FTm where
  | var : FTm
  | lit : Nat → FTm
  | add : FTm → FTm → FTm
  deriving DecidableEq

/-- 木の値（関数としての外延）。 -/
def FTm.eval : FTm → Nat → Nat
  | .var, x => x
  | .lit n, _ => n
  | .add a b, x => a.eval x + b.eval x

/-- 定理 J.18(b)：`x + 1` と `1 + x` は木が違い（木の同一性は決まる）、関数としては同じ。 -/
theorem tree_ne_ext_eq :
    FTm.add .var (.lit 1) ≠ FTm.add (.lit 1) .var ∧
      ∀ x, (FTm.add .var (.lit 1)).eval x = (FTm.add (.lit 1) .var).eval x :=
  ⟨by decide, fun x => Nat.add_comm x 1⟩

/-! ### J.19 格子への丸めは包含の随伴 -/

/-- 格子 4ℤ への切り下げ（`/` は Int.ediv で、4 > 0 なので床）。 -/
def down4 (x : Int) : Int := 4 * (x / 4)
/-- 格子 4ℤ への切り上げ。 -/
def up4 (x : Int) : Int := -down4 (-x)
/-- 格子 4ℤ への最近接（同点は 8 の倍数へ。偶数への丸めの模型）。 -/
def near4 (x : Int) : Int :=
  if x % 4 < 2 then down4 x
  else if 2 < x % 4 then down4 x + 4
  else if (x / 4) % 2 = 0 then down4 x else down4 x + 4
/-- 格子 4ℤ への 0 への切り捨て（Sign の Int の `/` の形、value_spec.md 74 行）。 -/
def zero4 (x : Int) : Int := 4 * x.tdiv 4

/-- r は包含 4ℤ ⊆ ℤ の右随伴（下の最大）。 -/
def IsRightAdj (r : Int → Int) : Prop :=
  (∀ x, r x % 4 = 0) ∧ ∀ f x, f % 4 = 0 → (f ≤ x ↔ f ≤ r x)
/-- l は包含 4ℤ ⊆ ℤ の左随伴（上の最小）。 -/
def IsLeftAdj (l : Int → Int) : Prop :=
  (∀ x, l x % 4 = 0) ∧ ∀ f x, f % 4 = 0 → (l x ≤ f ↔ x ≤ f)

/-- 定理 J.19(a)：切り下げは包含の右随伴。 -/
theorem down4_right : IsRightAdj down4 := by
  refine ⟨fun x => ?_, fun f x hf => ?_⟩
  · unfold down4
    omega
  · unfold down4
    constructor
    · intro h
      omega
    · intro h
      omega

/-- 定理 J.19(a)：切り上げは包含の左随伴。 -/
theorem up4_left : IsLeftAdj up4 := by
  refine ⟨fun x => ?_, fun f x hf => ?_⟩
  · unfold up4 down4
    omega
  · unfold up4 down4
    constructor
    · intro h
      omega
    · intro h
      omega

/-- 定理 J.19(b)：右随伴は切り下げだけ。 -/
theorem right_adj_unique (r : Int → Int) (h : IsRightAdj r) : ∀ x, r x = down4 x := by
  intro x
  -- r x ≤ x、だから r x ≤ down4 x
  have h1 : r x ≤ x := (h.2 (r x) x (h.1 x)).mpr (Int.le_refl _)
  have h2 : r x ≤ down4 x := (down4_right.2 (r x) x (h.1 x)).mp h1
  -- down4 x ≤ x、だから down4 x ≤ r x
  have h3 : down4 x ≤ x := (down4_right.2 (down4 x) x (down4_right.1 x)).mpr (Int.le_refl _)
  have h4 : down4 x ≤ r x := (h.2 (down4 x) x (down4_right.1 x)).mp h3
  exact Int.le_antisymm h2 h4

/-- 定理 J.19(b)：左随伴は切り上げだけ。 -/
theorem left_adj_unique (l : Int → Int) (h : IsLeftAdj l) : ∀ x, l x = up4 x := by
  intro x
  -- x ≤ l x、だから up4 x ≤ l x
  have h1 : x ≤ l x := (h.2 (l x) x (h.1 x)).mp (Int.le_refl _)
  have h2 : up4 x ≤ l x := (up4_left.2 (l x) x (h.1 x)).mpr h1
  -- x ≤ up4 x、だから l x ≤ up4 x
  have h3 : x ≤ up4 x := (up4_left.2 (up4 x) x (up4_left.1 x)).mp (Int.le_refl _)
  have h4 : l x ≤ up4 x := (h.2 (up4 x) x (up4_left.1 x)).mpr h3
  exact Int.le_antisymm h4 h2

/-- 定理 J.19(c)：最近接はどちらの随伴でもない（near4 3 = 4、near4 1 = 0）。 -/
theorem near4_not_adj : ¬ IsRightAdj near4 ∧ ¬ IsLeftAdj near4 := by
  refine ⟨fun h => ?_, fun h => ?_⟩
  · have h1 : near4 3 ≤ 3 := (h.2 (near4 3) 3 (h.1 3)).mpr (Int.le_refl _)
    have e : near4 3 = 4 := by decide
    rw [e] at h1
    exact absurd h1 (by decide)
  · have h1 : 1 ≤ near4 1 := (h.2 (near4 1) 1 (h.1 1)).mp (Int.le_refl _)
    have e : near4 1 = 0 := by decide
    rw [e] at h1
    exact absurd h1 (by decide)

/-- 定理 J.19(c)：0 への切り捨てはどちらの随伴でもない（zero4 (−1) = 0、zero4 1 = 0）。 -/
theorem zero4_not_adj : ¬ IsRightAdj zero4 ∧ ¬ IsLeftAdj zero4 := by
  refine ⟨fun h => ?_, fun h => ?_⟩
  · have h1 : zero4 (-1) ≤ -1 := (h.2 (zero4 (-1)) (-1) (h.1 (-1))).mpr (Int.le_refl _)
    have e : zero4 (-1) = 0 := by decide
    rw [e] at h1
    exact absurd h1 (by decide)
  · have h1 : 1 ≤ zero4 1 := (h.2 (zero4 1) 1 (h.1 1)).mp (Int.le_refl _)
    have e : zero4 1 = 0 := by decide
    rw [e] at h1
    exact absurd h1 (by decide)

/-- 間の幅が変わる格子 {0, 1, 2, 4, 8} への切り下げ。 -/
def roundP2 (n : Nat) : Nat := if 8 ≤ n then 8 else if 4 ≤ n then 4 else if 2 ≤ n then 2 else n

/-- 定理 J.19(d)：roundP2 は格子 {0, 1, 2, 4, 8} ⊆ ℕ の包含の右随伴。 -/
theorem roundP2_right (x : Nat) :
    (roundP2 x = 0 ∨ roundP2 x = 1 ∨ roundP2 x = 2 ∨ roundP2 x = 4 ∨ roundP2 x = 8) ∧
    ∀ f, (f = 0 ∨ f = 1 ∨ f = 2 ∨ f = 4 ∨ f = 8) → (f ≤ x ↔ f ≤ roundP2 x) := by
  refine ⟨?_, fun f hf => ?_⟩
  · unfold roundP2
    split
    · exact Or.inr (Or.inr (Or.inr (Or.inr rfl)))
    · split
      · exact Or.inr (Or.inr (Or.inr (Or.inl rfl)))
      · split
        · exact Or.inr (Or.inr (Or.inl rfl))
        · omega
  · unfold roundP2
    constructor
    · intro h
      split
      · omega
      · split
        · omega
        · split
          · omega
          · exact h
    · intro h
      split at h
      · omega
      · split at h
        · omega
        · split at h
          · omega
          · exact h

/-- 定理 J.19(d)：随伴の丸めでも、幅の変わる格子の上の丸めた足し算は結合的でない。 -/
theorem roundP2_not_assoc :
    roundP2 (roundP2 (1 + 1) + 2) ≠ roundP2 (1 + roundP2 (1 + 2)) := by decide

/-! ## J-4. 対角線と不動点 -/

/-! ### J.21 対角線：名前の段と値の段 -/

/-- 定理 J.21(a)：不動点の無い自己写像 g : B → B があれば、A → (A → B) の全射は無い
（Lawvere の定理の対偶の、選択なしの形）。 -/
theorem cantor_of_fpf {A : Type u} {B : Type v} (g : B → B) (hg : ∀ b, g b ≠ b)
    (φ : A → A → B) : ¬ Function.Surjective φ := by
  intro hs
  obtain ⟨a, ha⟩ := hs (fun x => g (φ x x))
  exact hg (φ a a) (congrFun ha a).symm

/-- 定理 J.21(a)：数え上げた名前の表は、どれも全部の名前に届かない（g(d) = d + 1 mod 10）。 -/
theorem names_not_onto (v : Nat → Digits) : ¬ Function.Surjective v := by
  refine cantor_of_fpf (fun d : Fin 10 => ⟨(d.val + 1) % 10, Nat.mod_lt _ (by decide)⟩)
    (fun d h => ?_) v
  have e : (d.val + 1) % 10 = d.val := congrArg Fin.val h
  have hd := d.isLt
  omega

/-- 0 と 9 を避けた対角線：表の n 行目の n 桁目が 4 なら 5、ほかは 4。 -/
def diag (v : Nat → Digits) : Digits := fun n => if (v n n).val = 4 then 5 else 4

/-- 0 と 9 を使う対角線：n 桁目に 1 を足して 10 で割った余り。 -/
def naiveDiag (v : Nat → Digits) : Digits :=
  fun n => ⟨((v n n).val + 1) % 10, Nat.mod_lt _ (by decide)⟩

-- 対角線の桁は 4 か 5 で、表の対角の桁と違う
private theorem digitsb_diag_val (v : Nat → Digits) (n : Nat) :
    4 ≤ (diag v n).val ∧ (diag v n).val ≤ 5 ∧ (diag v n).val ≠ (v n n).val := by
  unfold diag
  by_cases h : (v n n).val = 4
  · rw [ite_eq_left h]
    refine ⟨by decide, by decide, ?_⟩
    rw [h]
    decide
  · rw [ite_eq_right h]
    exact ⟨by decide, by decide, fun e => h e.symm⟩

/-- 定理 J.21(b)：0 と 9 を避けた対角線は、表のどの行とも値が違う。 -/
theorem diag_not_sameVal (v : Nat → Digits) (m : Nat) : ¬ SameVal (diag v) (v m) := by
  intro hs
  -- 桁が 4〜5 の列と値が同じなら、部分和はどの桁でも等しい
  have eqN : ∀ N, approx (diag v) N = approx (v m) N := by
    intro N
    have h1 := hs (N + 1)
    have e1 : approx (diag v) (N + 1) = 10 * approx (diag v) N + (diag v (N + 1)).val := rfl
    have e2 : approx (v m) (N + 1) = 10 * approx (v m) N + (v m (N + 1)).val := rfl
    have d := digitsb_diag_val v (N + 1)
    have t9 := (v m (N + 1)).isLt
    omega
  cases m with
  | zero =>
    have e : (diag v 0).val = (v 0 0).val := eqN 0
    exact (digitsb_diag_val v 0).2.2 e
  | succ k =>
    have a := eqN (k + 1)
    have b := eqN k
    have e1 : approx (diag v) (k + 1) = 10 * approx (diag v) k + (diag v (k + 1)).val := rfl
    have e2 : approx (v (k + 1)) (k + 1) =
        10 * approx (v (k + 1)) k + (v (k + 1) (k + 1)).val := rfl
    have d := digitsb_diag_val v (k + 1)
    omega

/-- 定理 J.21(c)：0 と 9 を使う対角線も、表のどの行とも名前は違う。 -/
theorem naiveDiag_ne (v : Nat → Digits) (m : Nat) : naiveDiag v ≠ v m := by
  intro h
  have e : ((v m m).val + 1) % 10 = (v m m).val := congrArg Fin.val (congrFun h m)
  have hd := (v m m).isLt
  omega

private theorem digitsb_approx_tenth (N : Nat) : approx tenth N = 10 ^ N := by
  induction N with
  | zero => rfl
  | succ N ih =>
    have e : approx tenth (N + 1) = 10 * approx tenth N + (tenth (N + 1)).val := rfl
    have z : (tenth (N + 1)).val = 0 := rfl
    rw [e, z, ih, Nat.pow_succ]
    omega

private theorem digitsb_approx_nines0 (N : Nat) : approx nines0 N + 1 = 10 ^ N := by
  induction N with
  | zero => rfl
  | succ N ih =>
    have e : approx nines0 (N + 1) = 10 * approx nines0 N + (nines0 (N + 1)).val := rfl
    have z : (nines0 (N + 1)).val = 9 := rfl
    rw [e, z, Nat.pow_succ, ← ih]
    omega

-- 0.1000… と 0.0999… は値が同じ（J.15(a) と同じ事実を、この節の中で示す）
private theorem digitsb_sameVal_tenth_nines0 : SameVal tenth nines0 := by
  intro N
  have a := digitsb_approx_tenth N
  have b := digitsb_approx_nines0 N
  constructor
  · omega
  · omega

private theorem digitsb_naiveDiag_nines0 : naiveDiag (fun _ => nines0) = tenth := by
  funext n
  apply Fin.ext
  cases n with
  | zero => rfl
  | succ k =>
    show ((nines0 (k + 1)).val + 1) % 10 = (tenth (k + 1)).val
    have a : (nines0 (k + 1)).val = 9 := rfl
    have b : (tenth (k + 1)).val = 0 := rfl
    rw [a, b]

/-- 定理 J.21(c)：全部 0.0999… の表の対角線は 0.1000… で、値は表の行と同じ（9/9 の罠）。 -/
theorem naiveDiag_trap :
    naiveDiag (fun _ => nines0) = tenth ∧ SameVal (naiveDiag (fun _ => nines0)) nines0 := by
  refine ⟨digitsb_naiveDiag_nines0, ?_⟩
  rw [digitsb_naiveDiag_nines0]
  exact digitsb_sameVal_tenth_nines0

/-- 定理 J.21(c)：0 と 9 を使う対角線は、値の段へ降りない（行の値が同じ表で、対角線の値が違う）。 -/
theorem naiveDiag_not_on_values :
    ∃ v w : Nat → Digits, (∀ m, SameVal (v m) (w m)) ∧ ¬ SameVal (naiveDiag v) (naiveDiag w) := by
  refine ⟨fun _ => nines0, fun _ => tenth, fun _ => ?_, fun h => ?_⟩
  · intro N
    have p := digitsb_sameVal_tenth_nines0 N
    exact ⟨p.2, p.1⟩
  · -- 対角線は 0.1000… と 0.2111…：2桁で切ると 10 と 21
    have h1 := (h 1).2
    have e1 : approx (naiveDiag (fun _ => nines0)) 1 = 10 := by decide
    have e2 : approx (naiveDiag (fun _ => tenth)) 1 = 21 := by decide
    omega

/-! ### J.21(e)〜(g) 写し Δ と捨てる射 -/

/-- 部分写像 f の後に写す（Δ ∘ f）。部分写像は `Option` への写像で、`none` が `!_`。 -/
def copyAfter {α : Type u} {β : Type v} (f : α → Option β) (a : α) : Option (β × β) :=
  (f a).bind fun b => some (b, b)

/-- 写してから両方に f を当てる（(f ⊗ f) ∘ Δ。⊗ は、両方に値がある時だけ値）。 -/
def copyBefore {α : Type u} {β : Type v} (f : α → Option β) (a : α) : Option (β × β) :=
  (f a).bind fun b => (f a).bind fun b' => some (b, b')

/-- 定理 J.21(e)：写し Δ は、どの部分写像とも可換。 -/
theorem copy_natural_opt {α : Type u} {β : Type v} (f : α → Option β) :
    copyAfter f = copyBefore f := by
  funext a
  unfold copyAfter copyBefore
  cases f a with
  | none => rfl
  | some b => rfl

/-- 定理 J.21(f)：部分写像が捨てる射と可換 ⇔ 全域。 -/
theorem discard_natural_iff_total {α : Type u} {β : Type v} (f : α → Option β) :
    (∀ a, (f a).bind (fun _ => some ()) = some ()) ↔ ∀ a, ∃ b, f a = some b := by
  constructor
  · intro h a
    have ha := h a
    cases hfa : f a with
    | none =>
      rw [hfa] at ha
      cases ha
    | some b => exact ⟨b, rfl⟩
  · intro h a
    obtain ⟨b, hb⟩ := h a
    rw [hb]
    rfl

/-- 状態つきの計算 σ → α × σ。入力の流れを読む計算では、状態は読んだ位置。 -/
def StM (σ : Type u) (α : Type v) : Type (max u v) := σ → α × σ

/-- 状態つきの計算の合成。 -/
def StM.bind {σ : Type u} {α : Type v} {β : Type w} (m : StM σ α) (k : α → StM σ β) :
    StM σ β :=
  fun s => k (m s).1 (m s).2

/-- 状態つきの f の後に写す（Δ ∘ f）。 -/
def copyAfterS {σ : Type u} {α : Type v} {β : Type w} (f : α → StM σ β) (a : α) :
    StM σ (β × β) :=
  StM.bind (f a) fun b s => ((b, b), s)

/-- 写してから両方に状態つきの f を当てる（(f ⊗ f) ∘ Δ、左から順に走る）。 -/
def copyBeforeS {σ : Type u} {α : Type v} {β : Type w} (f : α → StM σ β) (a : α) :
    StM σ (β × β) :=
  StM.bind (f a) fun b => StM.bind (f a) fun b' s => ((b, b'), s)

/-- 状態を読むだけで、進めない計算。 -/
def peekS {σ : Type u} {α : Type v} {β : Type w} (h : α → σ → β) : α → StM σ β :=
  fun a s => (h a s, s)

/-- 入力の流れ ι の次を読んで、位置を1つ進める計算。 -/
def readNext {A : Type u} (ι : Nat → A) : Unit → StM Nat A := fun _ p => (ι p, p + 1)

/-- 定理 J.21(g)：状態を読むだけの計算は、写し Δ と可換。 -/
theorem copy_natural_peek {σ : Type u} {α : Type v} {β : Type w} (h : α → σ → β) :
    copyAfterS (peekS h) = copyBeforeS (peekS h) := by
  funext a s
  rfl

/-- 定理 J.21(g)：入力を読んで進める計算は、写し Δ と可換でない。1回読んで写すのと、2回読むのとで、
進んだ位置が違い、流れの頭の2つが違えば値も違う。 -/
theorem copy_not_natural_read {A : Type u} (ι : Nat → A) :
    copyAfterS (readNext ι) () ≠ copyBeforeS (readNext ι) () ∧
      (ι 0 ≠ ι 1 → (copyAfterS (readNext ι) () 0).1 ≠ (copyBeforeS (readNext ι) () 0).1) := by
  refine ⟨fun h => ?_, fun hne h => ?_⟩
  · -- 位置 0 から走らせると、進んだ位置が 1 と 2
    have e : (1 : Nat) = 2 := congrArg Prod.snd (congrFun h 0)
    cases e
  · -- 値は (ι 0, ι 0) と (ι 0, ι 1)
    exact hne (congrArg Prod.snd h)

/-! ### J.22 証人つきの否定と嘘つきの方程式 -/

/-- 証人 v つきの否定：`!_` なら v、値なら `!_`（Sign の `o ; v`、V7）。 -/
def negW {α : Type u} (v : α) (o : Option α) : Option α := xorO o (some v)

/-- 定理 J.22(a)：証人つきの否定に不動点は無い。 -/
theorem negW_ne {α : Type u} (v : α) (o : Option α) : negW v o ≠ o := by
  cases o with
  | none => intro h; cases h
  | some a => intro h; cases h

/-- 定理 J.22(a)：証人つきの否定は基点を動かすので、Set* の射でない（D.5）。 -/
theorem negW_moves_base {α : Type u} (v : α) : negW v none ≠ none := negW_ne v none

/-- 定理 J.22(b)：12 本の自然な演算の右に値を固定した写像に不動点が無い ⇔ (値, 値) ↦ `!_` で、
(`!_`, 値) ↦ 値。 -/
theorem rightFed_fpf_iff (c : Fin 3 × Bool × Bool) {α : Type u} (v : α) :
    (∀ o : Option α, (buildOp.{u} c).1 α o (some v) ≠ o) ↔ (c.1 = 0 ∧ c.2.2 = true) := by
  rcases c with ⟨⟨_ | _ | _ | k, hk⟩, b1, b2⟩
  · cases b2
    · exact ⟨fun h => absurd rfl (h none), fun h => Bool.noConfusion h.2⟩
    · refine ⟨fun _ => ⟨rfl, rfl⟩, fun _ o => ?_⟩
      cases o with
      | none => intro h; cases h
      | some x => intro h; cases h
  · exact ⟨fun h => absurd rfl (h (some v)),
      fun h => (Nat.succ_ne_zero _ (congrArg Fin.val h.1)).elim⟩
  · exact ⟨fun h => absurd rfl (h (some v)),
      fun h => (Nat.succ_ne_zero _ (congrArg Fin.val h.1)).elim⟩
  · exact absurd hk (by omega)

/-- 定理 J.22(b)：左に値を固定した写像に不動点が無い ⇔ (値, 値) ↦ `!_` で、(値, `!_`) ↦ 値。 -/
theorem leftFed_fpf_iff (c : Fin 3 × Bool × Bool) {α : Type u} (v : α) :
    (∀ o : Option α, (buildOp.{u} c).1 α (some v) o ≠ o) ↔ (c.1 = 0 ∧ c.2.1 = true) := by
  rcases c with ⟨⟨_ | _ | _ | k, hk⟩, b1, b2⟩
  · cases b1
    · exact ⟨fun h => absurd rfl (h none), fun h => Bool.noConfusion h.2⟩
    · refine ⟨fun _ => ⟨rfl, rfl⟩, fun _ o => ?_⟩
      cases o with
      | none => intro h; cases h
      | some x => intro h; cases h
  · exact ⟨fun h => absurd rfl (h (some v)),
      fun h => (Nat.succ_ne_zero _ (congrArg Fin.val h.1)).elim⟩
  · exact ⟨fun h => absurd rfl (h (some v)),
      fun h => (Nat.succ_ne_zero _ (congrArg Fin.val h.1)).elim⟩
  · exact absurd hk (by omega)

/-- 定理 J.22(b)：右固定で不動点の無い写像は、どれも証人つきの否定。 -/
theorem rightFed_eq_negW (b : Bool) {α : Type u} (v : α) (o : Option α) :
    (buildOp.{u} (0, b, true)).1 α o (some v) = negW v o := by
  cases o <;> cases b <;> rfl

/-- 定理 J.22(b)：左固定で不動点の無い写像も、どれも証人つきの否定。 -/
theorem leftFed_eq_negW (b : Bool) {α : Type u} (v : α) (o : Option α) :
    (buildOp.{u} (0, true, b)).1 α (some v) o = negW v o := by
  cases o <;> cases b <;> rfl

/-- 名前の付いた否定 `neg : x ? x ; v` の本体（口1つ）。 -/
def negBody {α : Type u} (v : α) : List α → Option α
  | [x] => negW v (some x)
  | _ => none

/-- 定理 J.22(c)：名前の付いた否定は行の模型で零射（実引数が値でも `!_` でも、行の値は空）。 -/
theorem named_neg_is_zero {α : Type u} (v : α) (o : Option α) :
    row 1 (negBody v) [] [o] = [] := by
  cases o <;> rfl

/-- 定理 J.22(d)：値 v があれば、A → (A → α₊) の全射は無い（証人つきの否定で Cantor）。 -/
theorem no_surj_opt {A : Type u} {α : Type v} (v : α) (φ : A → A → Option α) :
    ¬ Function.Surjective φ :=
  cantor_of_fpf (negW v) (negW_ne v) φ

/-- 定理 J.22(e)：同じ実引数の嘘つき liar(x) = liar(x) ; v には、全域の解が無い。 -/
theorem liar_no_solution {X : Type u} {α : Type v} (x₀ : X) (v : α) :
    ¬ ∃ f : X → Option α, Sol (fun x => some x) (fun _ o => negW v o) f := by
  rintro ⟨f, hf⟩
  exact negW_ne v (f x₀) (hf x₀).symm

/-- 偶数の所が `!_`、奇数の所が v の列。 -/
def alt0 {α : Type u} (v : α) (y : Nat) : Option α := if y % 2 = 0 then none else some v
/-- 偶数の所が v、奇数の所が `!_` の列。 -/
def alt1 {α : Type u} (v : α) (y : Nat) : Option α := if y % 2 = 0 then some v else none

-- 解の値は `!_` か v
private theorem digitsb_liar2_range {α : Type u} (v : α) (f : Nat → Option α)
    (hf : ∀ y, f y = negW v (f (y + 1))) (y : Nat) : f y = none ∨ f y = some v := by
  rw [hf y]
  cases f (y + 1) with
  | none => exact Or.inr rfl
  | some _ => exact Or.inl rfl

/-- 定理 J.22(f)：実引数の変わる嘘つき liar2(y) = liar2(y + 1) ; v の全域の解は、ちょうど
alt0 と alt1 の2つ（解が1つに決まらない側、I.12(b)）。 -/
theorem liar2_solutions {α : Type u} (v : α) (f : Nat → Option α) :
    Sol (fun y => some (y + 1)) (fun _ o => negW v o) f ↔
      (∀ y, f y = alt0 v y) ∨ (∀ y, f y = alt1 v y) := by
  constructor
  · intro hf
    have hf' : ∀ y, f y = negW v (f (y + 1)) := hf
    -- 隣の値は入れ替わる
    have step : ∀ y, (f y = none → f (y + 1) = some v) ∧ (f y = some v → f (y + 1) = none) := by
      intro y
      refine ⟨fun h => ?_, fun h => ?_⟩
      · cases digitsb_liar2_range v f hf' (y + 1) with
        | inl h1 =>
          rw [hf' y, h1] at h
          cases h
        | inr h1 => exact h1
      · cases digitsb_liar2_range v f hf' (y + 1) with
        | inl h1 => exact h1
        | inr h1 =>
          rw [hf' y, h1] at h
          cases h
    cases digitsb_liar2_range v f hf' 0 with
    | inl h0 =>
      refine Or.inl (fun y => ?_)
      induction y with
      | zero => exact h0
      | succ y ih =>
        unfold alt0 at ih ⊢
        by_cases hy : y % 2 = 0
        · rw [ite_eq_left hy] at ih
          rw [ite_eq_right (by omega)]
          exact (step y).1 ih
        · rw [ite_eq_right hy] at ih
          rw [ite_eq_left (by omega)]
          exact (step y).2 ih
    | inr h0 =>
      refine Or.inr (fun y => ?_)
      induction y with
      | zero => exact h0
      | succ y ih =>
        unfold alt1 at ih ⊢
        by_cases hy : y % 2 = 0
        · rw [ite_eq_left hy] at ih
          rw [ite_eq_right (by omega)]
          exact (step y).2 ih
        · rw [ite_eq_right hy] at ih
          rw [ite_eq_left (by omega)]
          exact (step y).1 ih
  · intro h y
    show f y = negW v (f (y + 1))
    cases h with
    | inl h =>
      rw [h y, h (y + 1)]
      unfold alt0
      by_cases hy : y % 2 = 0
      · rw [ite_eq_left hy, ite_eq_right (by omega)]
        rfl
      · rw [ite_eq_right hy, ite_eq_left (by omega)]
        rfl
    | inr h =>
      rw [h y, h (y + 1)]
      unfold alt1
      by_cases hy : y % 2 = 0
      · rw [ite_eq_left hy, ite_eq_right (by omega)]
        rfl
      · rw [ite_eq_right hy, ite_eq_left (by omega)]
        rfl

/-- 深さ N で内側の呼び出しを切って `!_` を置いた liar2 の評価（今の alpha1 の読み、V10）。 -/
def liarCut {α : Type u} (v : α) : Nat → Nat → Option α
  | 0, _ => none
  | N + 1, y => negW v (liarCut v N (y + 1))

/-- 定理 J.22(g)：切った所に `!_` を置くと、答えは切った深さの偶奇で決まる。 -/
theorem liarCut_parity {α : Type u} (v : α) (N y : Nat) :
    liarCut v N y = if N % 2 = 0 then none else some v := by
  induction N generalizing y with
  | zero => rfl
  | succ N ih =>
    show negW v (liarCut v N (y + 1)) = _
    rw [ih]
    by_cases h : N % 2 = 0
    · have h' : ¬ (N + 1) % 2 = 0 := by omega
      rw [ite_eq_left h, ite_eq_right h']
      rfl
    · have h' : (N + 1) % 2 = 0 := by omega
      rw [ite_eq_right h, ite_eq_left h']
      rfl

end SignMath
