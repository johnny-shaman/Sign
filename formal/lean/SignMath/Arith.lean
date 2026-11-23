import SignMath.Row

/-!
# J-2. 字面の印と演算の表：番地と割り算（Mathlib を使わない）

番地は ℕ の元として読む（上限 2^64 と溢れは外した理想の番地。上限を入れるのは、
`!!` の 64 ビットの語（J.8・J.9(d)(e)）と J.13）。
数も ℕ で読む（Int の負を入れても、2項の表の判定は変わらない）。ℤ で読むのは J.11 と、J.12(e)・J.13 の Int。
`!_` は `Option` の `none`。J.12 の2つの `!_` は `Option (Option _)` に置き、外の `none` が運ばれる `!_`、
`some none` が計算の `!_`。
どの証明も `Classical.choice` を使わない（排中律も使わない）。そのために Mathlib を使わない。
-/

namespace SignMath

universe u v

/-! ## J.8 字面の印と演算の表 -/

/-- 単位の取り替え λ ∈ G の下で、型 (d₁, d₂; d) の斉次。`none` は `none` のまま。
`f` は `!_` に落とす前の ℕ の演算（候補の演算）で、いつも `none` の関数はどの次数でも斉次。 -/
def Homog (G : Nat → Prop) (d₁ d₂ d : Nat) (f : Nat → Nat → Option Nat) : Prop :=
  ∀ l, G l → 0 < l → ∀ x y, f (l ^ d₁ * x) (l ^ d₂ * y) = (f x y).map (l ^ d * ·)

/-- 1項の演算の斉次。 -/
def Homog1 (G : Nat → Prop) (d₁ d : Nat) (f : Nat → Option Nat) : Prop :=
  ∀ l, G l → 0 < l → ∀ x, f (l ^ d₁ * x) = (f x).map (l ^ d * ·)

/-- 算術の単位の取り替え（粒度）：ℕ⁺ の全部。 -/
def AllPos : Nat → Prop := fun _ => True

/-- ビットの単位の取り替え（ずらし）：2 の冪。 -/
def Pow2 : Nat → Prop := fun l => ∃ k, l = 2 ^ k

/-- 字面の印が決める種類。 -/
inductive Kind where
  | int
  | addr
  deriving DecidableEq, Repr

/-- 種類の次元：Int は 0、番地は 1。 -/
def Kind.deg : Kind → Nat
  | .int => 0
  | .addr => 1

/-- この部で扱う字面の印：印の無い数字（`16`）、`0x…`、幅つきの `NxHHHH`。`.`・`0r` ほかは J-3。 -/
inductive Mark where
  | dec
  | hex
  | width (w : Nat)
  deriving DecidableEq, Repr

/-- 印から種類へ：印の無い数字は Int、`0x…`・`NxHHHH` は番地。 -/
def Mark.kind : Mark → Kind
  | .dec => .int
  | .hex => .addr
  | .width _ => .addr

/-- 中置の値の演算子（比べは `<` で代表する）。 -/
inductive BinOp where
  | add | sub | mul | div | mod | pow | shl | shr | band | bor | bxor | lt | eq
  deriving DecidableEq, Repr

/-- R62・R98 の種類の表。`none` は `!_`＋warning（番地と数の混ぜか、射の無い番地の演算）。
数どうしは Int（V5・V6。ビットとずらしの値は V12 のまだ）。
`数 % 番地`・`数 ^ 番地`・`数 >> 番地` は、R62 の「ほか」の混ぜと読む。 -/
def r62 : BinOp → Kind → Kind → Option Kind
  | _, .int, .int => some .int
  | .add, .addr, .addr => some .addr
  | .sub, .addr, .addr => some .addr
  | .mul, .addr, .int => some .addr
  | .div, .addr, .addr => some .int
  | .mod, .addr, .addr => some .addr
  | .shl, .addr, .int => some .addr
  | .band, .addr, .addr => some .addr
  | .bor, .addr, .addr => some .addr
  | .bxor, .addr, .addr => some .addr
  | .lt, .addr, .addr => some .addr
  | .eq, .addr, .addr => some .addr
  | _, _, _ => none

/-- 字面の印と演算子の組で決まる答えの種類（`none` は `!_`＋warning）。 -/
def markTable (o : BinOp) (m₁ m₂ : Mark) : Option Kind := r62 o m₁.kind m₂.kind

/-- 引き算：負になれば `!_`。 -/
def subA (x y : Nat) : Option Nat := if y ≤ x then some (x - y) else none
/-- 床の割り算：0 で割れば `!_`。 -/
def divF (x y : Nat) : Option Nat := if 0 < y then some (x / y) else none
/-- 余り：0 で割れば `!_`。 -/
def modA (x y : Nat) : Option Nat := if 0 < y then some (x % y) else none
/-- 比べ：成り立てば左（証人は左）。 -/
def ltW (x y : Nat) : Option Nat := if x < y then some x else none
/-- `==`：等しければ左。 -/
def eqW (x y : Nat) : Option Nat := if x = y then some x else none

/-- 候補の演算（`!_` に落とす前の ℕ の演算）。 -/
def cand : BinOp → Nat → Nat → Option Nat
  | .add, x, y => some (x + y)
  | .sub, x, y => subA x y
  | .mul, x, y => some (x * y)
  | .div, x, y => divF x y
  | .mod, x, y => modA x y
  | .pow, x, y => some (x ^ y)
  | .shl, x, y => some (x <<< y)
  | .shr, x, y => some (x >>> y)
  | .band, x, y => some (x &&& y)
  | .bor, x, y => some (x ||| y)
  | .bxor, x, y => some (x ^^^ y)
  | .lt, x, y => ltW x y
  | .eq, x, y => eqW x y

/-- 測る単位の取り替え：ビットは 2 の冪、ほかは ℕ⁺（`<<`・`>>` はどちらでも同じ、J.8(f)）。 -/
def scale : BinOp → Nat → Prop
  | .band => Pow2
  | .bor => Pow2
  | .bxor => Pow2
  | _ => AllPos

/-- 1項の値の演算子：絶対値・`!!`・後置 `!`・前置 `-`。 -/
inductive UnOp where
  | abs | bnot | fact | neg
  deriving DecidableEq, Repr

/-- R62 の1項の種類の表。 -/
def r62u : UnOp → Kind → Option Kind
  | _, .int => some .int
  | .abs, .addr => some .addr
  | .bnot, .addr => some .addr
  | _, .addr => none

/-- 階乗。 -/
def fact : Nat → Nat
  | 0 => 1
  | n + 1 => (n + 1) * fact n

/-- 64 ビットの `!!`。 -/
def notW (x : Nat) : Option Nat := some (2 ^ 64 - 1 - x)

/-- ℕ の上の前置 `-`：0 でだけ定まる。 -/
def negN (x : Nat) : Option Nat := if x = 0 then some 0 else none

/-- 1項の候補の演算。 -/
def cand1 : UnOp → Nat → Option Nat
  | .abs, x => some x
  | .bnot, x => notW x
  | .fact, x => some (fact x)
  | .neg, x => negN x

/-- 1項の演算を測る単位の取り替え。 -/
def scale1 : UnOp → Nat → Prop
  | .bnot => Pow2
  | _ => AllPos

/-- 定理 J.8(a)：次数を持つ行。番地どうしの `+`・`-`・`%`・比べ・`==` と、`番地 * 数`・`数 * 番地`・
`番地 << 数` は次数 1。番地どうしの `/` は次数 0。番地どうしの `*` は次数 2。ビットは 2 の冪で次数 1。 -/
theorem homog_rows :
    Homog AllPos 1 1 1 (cand .add) ∧ Homog AllPos 1 1 1 (cand .sub) ∧
    Homog AllPos 1 0 1 (cand .mul) ∧ Homog AllPos 0 1 1 (cand .mul) ∧
    Homog AllPos 1 1 2 (cand .mul) ∧ Homog AllPos 1 1 0 (cand .div) ∧
    Homog AllPos 1 1 1 (cand .mod) ∧ Homog AllPos 1 0 1 (cand .shl) ∧
    Homog AllPos 1 1 1 (cand .lt) ∧ Homog AllPos 1 1 1 (cand .eq) ∧
    Homog Pow2 1 1 1 (cand .band) ∧ Homog Pow2 1 1 1 (cand .bor) ∧
    Homog Pow2 1 1 1 (cand .bxor) := by
  refine ⟨?_, ?_, ?_, ?_, ?_, ?_, ?_, ?_, ?_, ?_, ?_, ?_, ?_⟩
  · intro l _ _ x y
    simp only [cand, Nat.pow_one, Option.map_some, Nat.mul_add]
  · intro l _ hl x y
    simp only [cand, subA, Nat.pow_one]
    by_cases h : y ≤ x
    · rw [ite_eq_left h, ite_eq_left ((Nat.mul_le_mul_left_iff hl).2 h), Option.map_some, Nat.mul_sub]
    · rw [ite_eq_right h, ite_eq_right (fun h' => h ((Nat.mul_le_mul_left_iff hl).1 h'))]
      rfl
  · intro l _ _ x y
    simp only [cand, Nat.pow_one, Nat.pow_zero, Nat.one_mul, Option.map_some, Nat.mul_assoc]
  · intro l _ _ x y
    simp only [cand, Nat.pow_one, Nat.pow_zero, Nat.one_mul, Option.map_some]
    rw [Nat.mul_left_comm]
  · intro l _ _ x y
    simp only [cand, Nat.pow_one, Option.map_some]
    rw [Nat.pow_two, Nat.mul_mul_mul_comm]
  · intro l _ hl x y
    simp only [cand, divF, Nat.pow_one]
    by_cases h : 0 < y
    · rw [ite_eq_left h, ite_eq_left (Nat.mul_pos hl h), Option.map_some, Nat.mul_div_mul_left _ _ hl,
        Nat.pow_zero, Nat.one_mul]
    · have hy : y = 0 := by omega
      subst hy
      rw [ite_eq_right h, Nat.mul_zero, ite_eq_right (Nat.lt_irrefl 0)]
      rfl
  · intro l _ hl x y
    simp only [cand, modA, Nat.pow_one]
    by_cases h : 0 < y
    · rw [ite_eq_left h, ite_eq_left (Nat.mul_pos hl h), Option.map_some, Nat.mul_mod_mul_left]
    · have hy : y = 0 := by omega
      subst hy
      rw [ite_eq_right h, Nat.mul_zero, ite_eq_right (Nat.lt_irrefl 0)]
      rfl
  · intro l _ _ x y
    simp only [cand, Nat.pow_one, Nat.pow_zero, Nat.one_mul, Option.map_some, Nat.shiftLeft_eq,
      Nat.mul_assoc]
  · intro l _ hl x y
    simp only [cand, ltW, Nat.pow_one]
    -- `Nat.mul_lt_mul_left` は Classical.choice を引くので、`≤` の側から出す
    have key : l * x < l * y ↔ x < y := by
      rw [← Nat.not_le, ← Nat.not_le, Nat.mul_le_mul_left_iff hl]
    by_cases h : x < y
    · rw [ite_eq_left h, ite_eq_left (key.2 h), Option.map_some]
    · rw [ite_eq_right h, ite_eq_right (fun h' => h (key.1 h'))]
      rfl
  · intro l _ hl x y
    simp only [cand, eqW, Nat.pow_one]
    by_cases h : x = y
    · rw [ite_eq_left h, ite_eq_left (congrArg (l * ·) h), Option.map_some]
    · rw [ite_eq_right h, ite_eq_right (fun h' => h (Nat.eq_of_mul_eq_mul_left hl h'))]
      rfl
  · intro l hl _ x y
    obtain ⟨k, rfl⟩ := hl
    simp only [cand, Nat.pow_one, Option.map_some]
    rw [Nat.mul_comm (2 ^ k) x, Nat.mul_comm (2 ^ k) y, Nat.mul_comm (2 ^ k) (x &&& y),
      ← Nat.shiftLeft_eq, ← Nat.shiftLeft_eq, ← Nat.shiftLeft_eq, Nat.shiftLeft_and_distrib]
  · intro l hl _ x y
    obtain ⟨k, rfl⟩ := hl
    simp only [cand, Nat.pow_one, Option.map_some]
    rw [Nat.mul_comm (2 ^ k) x, Nat.mul_comm (2 ^ k) y, Nat.mul_comm (2 ^ k) (x ||| y),
      ← Nat.shiftLeft_eq, ← Nat.shiftLeft_eq, ← Nat.shiftLeft_eq, Nat.shiftLeft_or_distrib]
  · intro l hl _ x y
    obtain ⟨k, rfl⟩ := hl
    simp only [cand, Nat.pow_one, Option.map_some]
    rw [Nat.mul_comm (2 ^ k) x, Nat.mul_comm (2 ^ k) y, Nat.mul_comm (2 ^ k) (x ^^^ y),
      ← Nat.shiftLeft_eq, ← Nat.shiftLeft_eq, ← Nat.shiftLeft_eq, Nat.shiftLeft_xor_distrib]

/-- 定理 J.8(b)：どの次数 d でも斉次でない行。 -/
theorem not_homog_rows (d : Nat) :
    ¬ Homog AllPos 1 0 d (cand .add) ∧ ¬ Homog AllPos 0 1 d (cand .add) ∧
    ¬ Homog AllPos 1 0 d (cand .sub) ∧ ¬ Homog AllPos 0 1 d (cand .sub) ∧
    ¬ Homog AllPos 1 0 d (cand .div) ∧ ¬ Homog AllPos 0 1 d (cand .div) ∧
    ¬ Homog AllPos 1 0 d (cand .mod) ∧ ¬ Homog AllPos 0 1 d (cand .mod) ∧
    ¬ Homog AllPos 1 0 d (cand .pow) ∧ ¬ Homog AllPos 1 1 d (cand .pow) ∧
    ¬ Homog AllPos 0 1 d (cand .pow) ∧
    ¬ Homog AllPos 1 1 d (cand .shl) ∧ ¬ Homog AllPos 0 1 d (cand .shl) ∧
    ¬ Homog AllPos 1 0 d (cand .shr) ∧ ¬ Homog AllPos 1 1 d (cand .shr) ∧
    ¬ Homog AllPos 0 1 d (cand .shr) ∧
    ¬ Homog AllPos 1 0 d (cand .lt) ∧ ¬ Homog AllPos 0 1 d (cand .lt) ∧
    ¬ Homog AllPos 1 0 d (cand .eq) ∧ ¬ Homog AllPos 0 1 d (cand .eq) ∧
    ¬ Homog Pow2 1 0 d (cand .band) ∧ ¬ Homog Pow2 0 1 d (cand .band) ∧
    ¬ Homog Pow2 1 0 d (cand .bor) ∧ ¬ Homog Pow2 0 1 d (cand .bor) ∧
    ¬ Homog Pow2 1 0 d (cand .bxor) ∧ ¬ Homog Pow2 0 1 d (cand .bxor) ∧
    (d ≠ 2 → ¬ Homog AllPos 1 1 d (cand .mul)) ∧
    ¬ Homog1 AllPos 1 d (cand1 .fact) := by
  refine ⟨?_, ?_, ?_, ?_, ?_, ?_, ?_, ?_, ?_, ?_, ?_, ?_, ?_, ?_, ?_, ?_, ?_, ?_, ?_, ?_, ?_, ?_,
    ?_, ?_, ?_, ?_, ?_, ?_⟩
  -- 2 点に λ = 2 を当て、2^d への食い違う2つの条件を出す
  · intro h
    have e1 := h 2 trivial (by decide) 1 0
    have e2 := h 2 trivial (by decide) 0 1
    generalize 2 ^ d = P at e1 e2
    simp [cand] at e1 e2 <;> omega
  · intro h
    have e1 := h 2 trivial (by decide) 1 0
    have e2 := h 2 trivial (by decide) 0 1
    generalize 2 ^ d = P at e1 e2
    simp [cand] at e1 e2 <;> omega
  · intro h
    have e1 := h 2 trivial (by decide) 1 1
    generalize 2 ^ d = P at e1
    simp [cand, subA] at e1
  · intro h
    have e1 := h 2 trivial (by decide) 1 1
    generalize 2 ^ d = P at e1
    simp [cand, subA] at e1
  · intro h
    have e1 := h 2 trivial (by decide) 1 2
    generalize 2 ^ d = P at e1
    simp [cand, divF] at e1
  · intro h
    have e1 := h 2 trivial (by decide) 1 1
    have e2 := h 2 trivial (by decide) 2 1
    generalize 2 ^ d = P at e1 e2
    simp [cand, divF] at e1 e2 <;> omega
  · intro h
    have e1 := h 2 trivial (by decide) 1 2
    have e2 := h 2 trivial (by decide) 1 3
    generalize 2 ^ d = P at e1 e2
    simp [cand, modA] at e1 e2 <;> omega
  · intro h
    have e1 := h 2 trivial (by decide) 1 1
    generalize 2 ^ d = P at e1
    simp [cand, modA] at e1
  · intro h
    have e1 := h 2 trivial (by decide) 1 0
    have e2 := h 2 trivial (by decide) 1 1
    generalize 2 ^ d = P at e1 e2
    simp [cand] at e1 e2 <;> omega
  · intro h
    have e1 := h 2 trivial (by decide) 1 0
    have e2 := h 2 trivial (by decide) 1 1
    generalize 2 ^ d = P at e1 e2
    simp [cand] at e1 e2 <;> omega
  · intro h
    have e1 := h 2 trivial (by decide) 2 0
    have e2 := h 2 trivial (by decide) 2 1
    generalize 2 ^ d = P at e1 e2
    simp [cand] at e1 e2 <;> omega
  · intro h
    have e1 := h 2 trivial (by decide) 1 0
    have e2 := h 2 trivial (by decide) 1 1
    generalize 2 ^ d = P at e1 e2
    simp [cand] at e1 e2 <;> omega
  · intro h
    have e1 := h 2 trivial (by decide) 1 0
    have e2 := h 2 trivial (by decide) 1 1
    generalize 2 ^ d = P at e1 e2
    simp [cand] at e1 e2 <;> omega
  · intro h
    have e1 := h 2 trivial (by decide) 1 0
    have e2 := h 2 trivial (by decide) 1 1
    generalize 2 ^ d = P at e1 e2
    simp [cand] at e1 e2 <;> omega
  · intro h
    have e1 := h 2 trivial (by decide) 1 0
    have e2 := h 2 trivial (by decide) 2 1
    generalize 2 ^ d = P at e1 e2
    simp [cand] at e1 e2 <;> omega
  · intro h
    have e1 := h 2 trivial (by decide) 1 0
    have e2 := h 2 trivial (by decide) 2 1
    generalize 2 ^ d = P at e1 e2
    simp [cand] at e1 e2 <;> omega
  · intro h
    have e1 := h 2 trivial (by decide) 1 2
    generalize 2 ^ d = P at e1
    simp [cand, ltW] at e1
  · intro h
    have e1 := h 2 trivial (by decide) 1 1
    generalize 2 ^ d = P at e1
    simp [cand, ltW] at e1
  · intro h
    have e1 := h 2 trivial (by decide) 1 1
    generalize 2 ^ d = P at e1
    simp [cand, eqW] at e1
  · intro h
    have e1 := h 2 trivial (by decide) 1 1
    generalize 2 ^ d = P at e1
    simp [cand, eqW] at e1
  · intro h
    have e1 := h 2 (Exists.intro 1 rfl) (by decide) 1 1
    have e2 := h 2 (Exists.intro 1 rfl) (by decide) 1 3
    generalize 2 ^ d = P at e1 e2
    simp [cand] at e1 e2 <;> omega
  · intro h
    have e1 := h 2 (Exists.intro 1 rfl) (by decide) 1 1
    have e2 := h 2 (Exists.intro 1 rfl) (by decide) 3 1
    generalize 2 ^ d = P at e1 e2
    simp [cand] at e1 e2 <;> omega
  · intro h
    have e1 := h 2 (Exists.intro 1 rfl) (by decide) 1 1
    have e2 := h 2 (Exists.intro 1 rfl) (by decide) 1 0
    generalize 2 ^ d = P at e1 e2
    simp [cand] at e1 e2 <;> omega
  · intro h
    have e1 := h 2 (Exists.intro 1 rfl) (by decide) 1 1
    have e2 := h 2 (Exists.intro 1 rfl) (by decide) 0 1
    generalize 2 ^ d = P at e1 e2
    simp [cand] at e1 e2 <;> omega
  · intro h
    have e1 := h 2 (Exists.intro 1 rfl) (by decide) 1 1
    generalize 2 ^ d = P at e1
    simp [cand] at e1
  · intro h
    have e1 := h 2 (Exists.intro 1 rfl) (by decide) 1 1
    generalize 2 ^ d = P at e1
    simp [cand] at e1
  · intro hd h
    have e := h 2 trivial (by decide) 1 1
    simp only [cand, Nat.pow_one, Nat.mul_one, Option.map_some, Option.some.injEq] at e
    rcases d with _ | _ | _ | d
    · simp at e
    · simp at e
    · exact hd rfl
    · rw [Nat.pow_succ, Nat.pow_succ, Nat.pow_succ] at e
      have := Nat.two_pow_pos d
      omega
  · intro h
    have e1 := h 2 trivial (by decide) 0
    have e2 := h 2 trivial (by decide) 1
    generalize 2 ^ d = P at e1 e2
    simp [cand1, fact] at e1 e2 <;> omega

/-- 定理 J.8(c)：ビットは ℕ⁺ で測ると斉次でない（λ = 3、(1, 2) で 3 &&& 6 = 2 ≠ 3·0）。 -/
theorem bit_rows_not_allPos :
    ¬ Homog AllPos 1 1 1 (cand .band) ∧ ¬ Homog AllPos 1 1 1 (cand .bor) ∧
    ¬ Homog AllPos 1 1 1 (cand .bxor) := by
  refine ⟨?_, ?_, ?_⟩
  · intro h
    have e := h 3 trivial (by decide) 1 2
    simp [cand] at e
  · intro h
    have e := h 3 trivial (by decide) 1 2
    simp [cand] at e
  · intro h
    have e := h 3 trivial (by decide) 1 2
    simp [cand] at e

-- 次数 (0, 0; 0) の斉次は、どの演算でも成り立つ。
private theorem aritha_homog_zero (G : Nat → Prop) (f : Nat → Nat → Option Nat) :
    Homog G 0 0 0 f := by
  intro l _ _ x y
  simp only [Nat.pow_zero, Nat.one_mul]
  cases f x y <;> rfl

/-- 定理 J.8(d)：外れの `数 * 番地` のほかでは、R62・R98 の2項の種類の表は斉次の次数で決まる。
答えが種類 k ⇔ 候補の演算が型 (k₁ の次元, k₂ の次元; k の次元) で斉次。 -/
theorem kind_table (o : BinOp) (k₁ k₂ k : Kind) (h : ¬ (o = .mul ∧ k₁ = .int ∧ k₂ = .addr)) :
    r62 o k₁ k₂ = some k ↔ Homog (scale o) k₁.deg k₂.deg k.deg (cand o) := by
  obtain ⟨hadd, hsub, hmul, -, -, hdiv, hmod, hshl, hlt, heq, hband, hbor, hbxor⟩ := homog_rows
  revert h
  cases o <;> cases k₁ <;> cases k₂ <;> cases k <;> simp [r62, scale, Kind.deg]
  -- 残るのは、表が答えを持つ升目の斉次と、ほかの升目の斉次でないこと（λ = 2 を1点に当てる）
  all_goals first
    | exact aritha_homog_zero _ _
    | assumption
    | (intro hh
       first
       | (have e := hh 2 (by first | exact trivial | exact Exists.intro 1 rfl) (by decide) 0 1
          simp [cand, subA, divF, modA, ltW, eqW] at e; done)
       | (have e := hh 2 (by first | exact trivial | exact Exists.intro 1 rfl) (by decide) 1 0
          simp [cand, subA, divF, modA, ltW, eqW] at e; done)
       | (have e := hh 2 (by first | exact trivial | exact Exists.intro 1 rfl) (by decide) 1 1
          simp [cand, subA, divF, modA, ltW, eqW] at e; done)
       | (have e := hh 2 (by first | exact trivial | exact Exists.intro 1 rfl) (by decide) 1 2
          simp [cand, divF, modA, ltW] at e; done)
       | (have e := hh 2 (by first | exact trivial | exact Exists.intro 1 rfl) (by decide) 2 1
          simp [cand] at e; done)
       | (have e := hh 2 (by first | exact trivial | exact Exists.intro 1 rfl) (by decide) 1 3
          simp [cand, subA, divF, modA, ltW, eqW] at e; done)
       | (have e := hh 2 (by first | exact trivial | exact Exists.intro 1 rfl) (by decide) 3 1
          simp [cand, subA, divF, modA, ltW, eqW] at e; done))

-- 1項の次数 (0; 0) の斉次は、どの演算でも成り立つ。
private theorem aritha_homog1_zero (G : Nat → Prop) (f : Nat → Option Nat) : Homog1 G 0 0 f := by
  intro l _ _ x
  simp only [Nat.pow_zero, Nat.one_mul]
  cases f x <;> rfl

/-- 定理 J.8(d)：1項の表も、外れ（`!!` 番地と前置 `-`）のほかでは斉次の次数で決まる。 -/
theorem kind_table1 (o : UnOp) (k k' : Kind) (h : o ≠ .neg) (h' : ¬ (o = .bnot ∧ k = .addr)) :
    r62u o k = some k' ↔ Homog1 (scale1 o) k.deg k'.deg (cand1 o) := by
  have habs : Homog1 AllPos 1 1 (cand1 .abs) := fun _ _ _ _ => rfl
  revert h h'
  cases o <;> cases k <;> cases k' <;> simp [r62u, scale1, Kind.deg]
  all_goals first
    | exact aritha_homog1_zero _ _
    | assumption
    | (intro hh
       first
       | (have e := hh 2 (by first | exact trivial | exact Exists.intro 1 rfl) (by decide) 0
          simp [cand1, notW, fact] at e; done)
       | (have e := hh 2 (by first | exact trivial | exact Exists.intro 1 rfl) (by decide) 1
          simp [cand1, fact] at e; done)
       | (have e := hh 2 (by first | exact trivial | exact Exists.intro 1 rfl) (by decide) 2
          simp [cand1, notW, fact] at e; done))

/-- 定理 J.8(e)：外れ3つ。`数 * 番地` は次数 1 で斉次なのに混ぜ。`!!` 番地はどの次数でも斉次でないのに番地。
ℕ の上の前置 `-` はどの型でも斉次で、斉次性では除けない。 -/
theorem kind_table_outliers :
    r62 .mul .int .addr = none ∧ Homog AllPos 0 1 1 (cand .mul) ∧
    r62u .bnot .addr = some .addr ∧ (∀ d, ¬ Homog1 Pow2 1 d (cand1 .bnot)) ∧
    r62u .neg .addr = none ∧ (∀ d₁ d, Homog1 AllPos d₁ d (cand1 .neg)) := by
  refine ⟨rfl, homog_rows.2.2.2.1, rfl, ?_, rfl, ?_⟩
  · intro d h
    have e1 := h 2 (Exists.intro 1 rfl) (by decide) 0
    have e2 := h 2 (Exists.intro 1 rfl) (by decide) 1
    generalize 2 ^ d = P at e1 e2
    simp [cand1, notW] at e1 e2 <;> omega
  · intro d₁ d l _ hl x
    simp only [cand1, negN]
    cases x with
    | zero => rw [Nat.mul_zero, ite_eq_left rfl, Option.map_some, Nat.mul_zero]
    | succ x =>
      have hx : l ^ d₁ * (x + 1) ≠ 0 :=
        Nat.ne_of_gt (Nat.mul_pos (Nat.pow_pos hl) (Nat.succ_pos x))
      rw [ite_eq_right hx, ite_eq_right (Nat.succ_ne_zero x)]
      rfl

-- ℕ⁺ の全部で斉次なら、どの単位の取り替えでも斉次。
private theorem aritha_homog_of_allPos (G : Nat → Prop) {d₁ d₂ d : Nat}
    {f : Nat → Nat → Option Nat} (h : Homog AllPos d₁ d₂ d f) : Homog G d₁ d₂ d f :=
  fun l _ hl x y => h l trivial hl x y

/-- 定理 J.8(f)：`<<`・`>>` の分類は、ℕ⁺ で測っても 2 の冪で測っても同じ。 -/
theorem shift_scale_free (o : BinOp) (ho : o = .shl ∨ o = .shr) (k₁ k₂ k : Kind) :
    Homog AllPos k₁.deg k₂.deg k.deg (cand o) ↔ Homog Pow2 k₁.deg k₂.deg k.deg (cand o) := by
  refine ⟨aritha_homog_of_allPos Pow2, ?_⟩
  have hshl := homog_rows.2.2.2.2.2.2.2.1
  intro hp
  rcases ho with rfl | rfl <;> cases k₁ <;> cases k₂ <;> cases k <;> simp only [Kind.deg] at hp ⊢
  -- 正しい次数は ℕ⁺ で斉次、ほかは λ = 2（2 の冪）の1点で崩れる
  all_goals first
    | exact aritha_homog_zero _ _
    | exact hshl
    | (exfalso
       first
       | (have e := hp 2 (Exists.intro 1 rfl) (by decide) 1 0
          simp [cand] at e; done)
       | (have e := hp 2 (Exists.intro 1 rfl) (by decide) 1 1
          simp [cand] at e; done)
       | (have e := hp 2 (Exists.intro 1 rfl) (by decide) 2 1
          simp [cand] at e; done))

/-! ## J.9 幅の印 `NxHHHH` -/

/-- 定理 J.9(a)：幅 w の倍数は、番地どうしの `+`・`-`・`%`、`* 数`、`' k~` のずらし（k 語）で閉じる。 -/
theorem width_closed (w a b n : Nat) (ha : a % w = 0) (hb : b % w = 0) :
    (a + b) % w = 0 ∧ (b ≤ a → (a - b) % w = 0) ∧ (a * n) % w = 0 ∧ (n * a) % w = 0 ∧
    (a % b) % w = 0 ∧ (a + n * w) % w = 0 := by
  have ha' : w ∣ a := Nat.dvd_iff_mod_eq_zero.2 ha
  have hb' : w ∣ b := Nat.dvd_iff_mod_eq_zero.2 hb
  refine ⟨?_, ?_, ?_, ?_, ?_, ?_⟩
  · exact Nat.dvd_iff_mod_eq_zero.1 (Nat.dvd_add ha' hb')
  · intro _
    exact Nat.dvd_iff_mod_eq_zero.1 (Nat.dvd_sub ha' hb')
  · exact Nat.dvd_iff_mod_eq_zero.1 (Nat.dvd_mul_right_of_dvd ha' n)
  · exact Nat.dvd_iff_mod_eq_zero.1 (Nat.dvd_mul_left_of_dvd ha' n)
  · exact Nat.dvd_iff_mod_eq_zero.1 ((Nat.dvd_mod_iff hb').2 ha')
  · rw [Nat.add_mul_mod_self_right]
    exact ha

/-- 定理 J.9(b)：幅が 2^k なら、番地どうしの `&&`・`||`・`;;` と、どんな値との `&&` でも閉じる。 -/
theorem width_bits_closed (k a b c : Nat) (ha : a % 2 ^ k = 0) (hb : b % 2 ^ k = 0) :
    (a &&& c) % 2 ^ k = 0 ∧ (c &&& a) % 2 ^ k = 0 ∧ (a ||| b) % 2 ^ k = 0 ∧
    (a ^^^ b) % 2 ^ k = 0 := by
  refine ⟨?_, ?_, ?_, ?_⟩
  · rw [Nat.and_mod_two_pow, ha, Nat.zero_and]
  · rw [Nat.and_mod_two_pow, ha, Nat.and_zero]
  · rw [Nat.or_mod_two_pow, ha, hb, Nat.zero_or]
  · rw [Nat.xor_mod_two_pow, ha, hb, Nat.zero_xor]

/-- 定理 J.9(c)：倍数でない値との `+`・`-` は、倍数の外へ出る（左右どちらに幅があっても）。 -/
theorem width_leave_add (w a c : Nat) (ha : a % w = 0) (hc : c % w ≠ 0) :
    (a + c) % w ≠ 0 ∧ (c + a) % w ≠ 0 ∧ (c ≤ a → (a - c) % w ≠ 0) ∧
    (a ≤ c → (c - a) % w ≠ 0) := by
  have ha' : w ∣ a := Nat.dvd_iff_mod_eq_zero.2 ha
  have hc' : ¬ w ∣ c := fun h => hc (Nat.dvd_iff_mod_eq_zero.1 h)
  refine ⟨?_, ?_, ?_, ?_⟩
  · intro h
    apply hc'
    have h1 := Nat.dvd_sub (Nat.dvd_iff_mod_eq_zero.2 h) ha'
    rwa [Nat.add_sub_cancel_left] at h1
  · intro h
    apply hc'
    have h1 := Nat.dvd_sub (Nat.dvd_iff_mod_eq_zero.2 h) ha'
    rwa [Nat.add_sub_cancel] at h1
  · intro hca h
    apply hc'
    have h1 := Nat.dvd_sub ha' (Nat.dvd_iff_mod_eq_zero.2 h)
    rwa [Nat.sub_sub_self hca] at h1
  · intro hac h
    apply hc'
    have h1 := Nat.dvd_add (Nat.dvd_iff_mod_eq_zero.2 h) ha'
    rwa [Nat.sub_add_cancel hac] at h1

/-- 定理 J.9(d)：幅が 2^k なら、倍数でない値との `||`・`;;` は倍数の外へ出る。 -/
theorem width_leave_bits (k a c : Nat) (ha : a % 2 ^ k = 0) (hc : c % 2 ^ k ≠ 0) :
    (a ||| c) % 2 ^ k ≠ 0 ∧ (a ^^^ c) % 2 ^ k ≠ 0 := by
  constructor
  · rw [Nat.or_mod_two_pow, ha, Nat.zero_or]
    exact hc
  · rw [Nat.xor_mod_two_pow, ha, Nat.zero_xor]
    exact hc

/-- 定理 J.9(d)：幅が 2^k（1 ≤ k ≤ 64）なら、64 ビットの `!!` は倍数の外へ出る。 -/
theorem width_leave_not (k a : Nat) (ha : a % 2 ^ k = 0) (hk : 0 < k) (hk64 : k ≤ 64)
    (h64 : a < 2 ^ 64) : (2 ^ 64 - 1 - a) % 2 ^ k ≠ 0 := by
  -- 2^k が 2^64・a・2^64 − 1 − a を割れば 1 を割る
  intro h
  have hW : 2 ^ k ∣ 2 ^ 64 := Nat.pow_dvd_pow 2 hk64
  have h1 : 2 ^ k ∣ 2 ^ 64 - 1 - a := Nat.dvd_iff_mod_eq_zero.2 h
  have h2 : 2 ^ k ∣ a := Nat.dvd_iff_mod_eq_zero.2 ha
  have h3 : 2 ^ k ∣ 2 ^ 64 - (2 ^ 64 - 1 - a) - a := Nat.dvd_sub (Nat.dvd_sub hW h1) h2
  have h4 : 2 ^ 64 - (2 ^ 64 - 1 - a) - a = 1 := by omega
  rw [h4] at h3
  have h5 := Nat.eq_one_of_dvd_one h3
  have h6 : 2 ^ 1 ≤ 2 ^ k := Nat.pow_le_pow_right (by decide) hk
  rw [Nat.pow_one] at h6
  omega

/-- 定理 J.9(e)：割る数が倍数の外の `%` は外へ出る（`04x1000 % 0x3` は `0x1`）。
2 の冪でない幅 3 では、`!!` は倍数に残り、`&&` が外へ出る（`03x6 && 0x5` は `0x4`）。 -/
theorem width_examples :
    0x1000 % 4 = 0 ∧ 0x1000 % 3 = 1 ∧ (0x1000 % 3) % 4 ≠ 0 ∧
    (2 ^ 64 - 1 - 6) % 3 = 0 ∧ (6 &&& 5) % 3 ≠ 0 := by
  decide

/-! ## J.10 割り算の2つの右随伴と割り切り（ℕ） -/

/-- 天井の割り算 ⌈b/a⌉（a > 0 で、a·− の左随伴）。 -/
def cdiv (b a : Nat) : Nat := (b + a - 1) / a

/-- 割り切り：a > 0 かつ a ∣ b なら b/a、ほかは `!_`（R98 の番地どうしの `/`）。 -/
def divE (b a : Nat) : Option Nat := if 0 < a ∧ b % a = 0 then some (b / a) else none

/-- 定理 J.10(a)：(a, n) ↦ a n には右随伴が2つある（数 → 番地 の側と、番地 → 番地 の側）。
`<< k` ⊣ `>> k` も同じ形。 -/
theorem two_right_adjoints (a n b : Nat) :
    (0 < a → (a * n ≤ b ↔ n ≤ b / a)) ∧ (0 < n → (a * n ≤ b ↔ a ≤ b / n)) ∧
    (∀ k, a <<< k ≤ b ↔ a ≤ b >>> k) := by
  refine ⟨?_, ?_, ?_⟩
  · intro ha
    rw [Nat.le_div_iff_mul_le ha, Nat.mul_comm n a]
  · intro hn
    rw [Nat.le_div_iff_mul_le hn]
  · intro k
    rw [Nat.shiftLeft_eq, Nat.shiftRight_eq_div_pow, Nat.le_div_iff_mul_le (Nat.two_pow_pos k)]

/-- 定理 J.10(b)：随伴は交換を半分だけ運ぶ。L σ ≤ τ L なら σ R ≤ R τ（順序集合の mates）。 -/
theorem lax_of_adj {P : Type u} {Q : Type v} [LE P] [LE Q] (L : P → Q) (R : Q → P)
    (adj : ∀ p q, L p ≤ q ↔ p ≤ R q) (hreflP : ∀ p : P, p ≤ p)
    (htransQ : ∀ q₁ q₂ q₃ : Q, q₁ ≤ q₂ → q₂ ≤ q₃ → q₁ ≤ q₃)
    (σ : P → P) (τ : Q → Q) (hτ : ∀ q q', q ≤ q' → τ q ≤ τ q')
    (hL : ∀ p, L (σ p) ≤ τ (L p)) : ∀ q, σ (R q) ≤ R (τ q) := by
  intro q
  apply (adj _ _).1
  have c : L (R q) ≤ q := (adj _ _).2 (hreflP _)
  exact htransQ _ _ _ (hL _) (hτ _ _ c)

/-- 定理 J.10(b)：等号の側。L σ = τ L で、σ が単調で全射、τ が順序を映し返し、P が反対称なら σ R = R τ。 -/
theorem adj_commute_of_surj {P : Type u} {Q : Type v} [LE P] [LE Q] (L : P → Q) (R : Q → P)
    (adj : ∀ p q, L p ≤ q ↔ p ≤ R q) (hreflP : ∀ p : P, p ≤ p)
    (hantiP : ∀ p p' : P, p ≤ p' → p' ≤ p → p = p')
    (σ : P → P) (τ : Q → Q) (hσ : ∀ p p', p ≤ p' → σ p ≤ σ p') (hsurj : ∀ p, ∃ p', σ p' = p)
    (hτ : ∀ q q', q ≤ q' → τ q ≤ τ q') (hτr : ∀ q q', τ q ≤ τ q' → q ≤ q')
    (hL : ∀ p, L (σ p) = τ (L p)) : ∀ q, σ (R q) = R (τ q) := by
  intro q
  apply hantiP
  · apply (adj _ _).1
    rw [hL]
    exact hτ _ _ ((adj _ _).2 (hreflP _))
  · obtain ⟨p', hp'⟩ := hsurj (R (τ q))
    have c : L (R (τ q)) ≤ τ q := (adj _ _).2 (hreflP _)
    rw [← hp', hL] at c
    have c' := (adj _ _).1 (hτr _ _ c)
    rw [← hp']
    exact hσ _ _ c'

/-- 定理 J.10(c)：番地どうしの商は厳密に次数 0。数で割る商は緩くだけ斉次で、(λ, b, n) = (2, 1, 2) で真に小さい。 -/
theorem div_strict_lax :
    (∀ l a b : Nat, 0 < l → (l * b) / (l * a) = b / a) ∧
    (∀ l n b : Nat, l * (b / n) ≤ (l * b) / n) ∧ 2 * (1 / 2 : Nat) < (2 * 1) / 2 := by
  refine ⟨?_, ?_, by decide⟩
  · intro l a b hl
    exact Nat.mul_div_mul_left b a hl
  · intro l n b
    rcases Nat.eq_zero_or_pos n with hn | hn
    · subst hn
      rw [Nat.div_zero, Nat.div_zero, Nat.mul_zero]
      exact Nat.le_refl 0
    · rw [Nat.le_div_iff_mul_le hn, Nat.mul_assoc]
      exact Nat.mul_le_mul_left l (Nat.div_mul_le_self b n)

/-- 定理 J.10(d)：a > 0 で、a·− の左随伴は天井。 -/
theorem ceil_left_adj (a b n : Nat) (ha : 0 < a) : cdiv b a ≤ n ↔ b ≤ a * n := by
  unfold cdiv
  constructor
  · intro h
    have h1 := (Nat.div_lt_iff_lt_mul ha).1 (Nat.lt_succ_of_le h)
    rw [Nat.succ_mul, Nat.mul_comm n a] at h1
    omega
  · intro h
    apply Nat.le_of_lt_succ
    apply (Nat.div_lt_iff_lt_mul ha).2
    rw [Nat.succ_mul, Nat.mul_comm n a]
    omega

/-- 定理 J.10(d)：割り切れる ⇔ 余単位が恒等 ⇔ 左右の随伴が一致する。余りは余単位の隙間。 -/
theorem exact_iff (a b : Nat) (ha : 0 < a) :
    ((∃ n, a * n = b) ↔ a * (b / a) = b) ∧ ((∃ n, a * n = b) ↔ cdiv b a = b / a) ∧
    b % a + a * (b / a) = b := by
  refine ⟨⟨?_, fun h => ⟨b / a, h⟩⟩, ⟨?_, ?_⟩, Nat.mod_add_div b a⟩
  · rintro ⟨n, rfl⟩
    rw [Nat.mul_div_cancel_left n ha]
  · rintro ⟨n, rfl⟩
    rw [Nat.mul_div_cancel_left n ha]
    apply Nat.le_antisymm
    · exact (ceil_left_adj a (a * n) n ha).2 (Nat.le_refl _)
    · have h1 := Nat.div_le_div_right (c := a) (show a * n ≤ a * n + a - 1 by omega)
      rw [Nat.mul_div_cancel_left n ha] at h1
      exact h1
  · intro h
    refine ⟨b / a, Nat.le_antisymm (Nat.mul_div_le b a) ?_⟩
    exact (ceil_left_adj a b (b / a) ha).1 (Nat.le_of_eq h)

/-- 定理 J.10(d)：割り切りは、左右の随伴が一致する所でだけ値を持つ。 -/
theorem divE_iff (a b q : Nat) : divE b a = some q ↔ 0 < a ∧ b / a = q ∧ cdiv b a = q := by
  unfold divE
  by_cases h : 0 < a ∧ b % a = 0
  · rw [ite_eq_left h]
    have hb : a * (b / a) = b := by
      have h1 := Nat.mod_add_div b a
      rw [h.2, Nat.zero_add] at h1
      exact h1
    have hex : cdiv b a = b / a := ((exact_iff a b h.1).2.1).1 ⟨b / a, hb⟩
    constructor
    · intro e
      have e' := Option.some.inj e
      exact ⟨h.1, e', hex.trans e'⟩
    · rintro ⟨_, h2, _⟩
      rw [h2]
  · rw [ite_eq_right h]
    constructor
    · intro e
      cases e
    · rintro ⟨h1, h2, h3⟩
      apply absurd _ h
      refine ⟨h1, ?_⟩
      obtain ⟨n, hn⟩ := ((exact_iff a b h1).2.1).2 (h3.trans h2.symm)
      rw [← hn, Nat.mul_mod_right]

/-- 定理 J.10(d)：割り切りの分類は床と同じ（番地どうしで次数 0、数と組めばどの次数でも斉次でない）。 -/
theorem divE_homog (d : Nat) :
    Homog AllPos 1 1 0 divE ∧ ¬ Homog AllPos 1 0 d divE ∧ ¬ Homog AllPos 0 1 d divE := by
  refine ⟨?_, ?_, ?_⟩
  · intro l _ hl x y
    simp only [divE, Nat.pow_one, Nat.pow_zero, Nat.one_mul]
    have hc : (0 < l * y ∧ l * x % (l * y) = 0) ↔ (0 < y ∧ x % y = 0) := by
      rw [Nat.mul_mod_mul_left]
      constructor
      · rintro ⟨h1, h2⟩
        refine ⟨Nat.pos_of_ne_zero (fun hy => ?_), ?_⟩
        · rw [hy, Nat.mul_zero] at h1
          exact Nat.lt_irrefl 0 h1
        · exact Nat.eq_of_mul_eq_mul_left hl (h2.trans (Nat.mul_zero l).symm)
      · rintro ⟨h1, h2⟩
        exact ⟨Nat.mul_pos hl h1, by rw [h2, Nat.mul_zero]⟩
    by_cases h : 0 < y ∧ x % y = 0
    · rw [ite_eq_left (hc.2 h), ite_eq_left h, Nat.mul_div_mul_left _ _ hl]
      rfl
    · rw [ite_eq_right (fun h' => h (hc.1 h')), ite_eq_right h]
      rfl
  · intro h
    have e := h 2 trivial (by decide) 1 2
    generalize 2 ^ d = P at e
    simp [divE] at e
  · intro h
    have e := h 2 trivial (by decide) 1 1
    generalize 2 ^ d = P at e
    simp [divE] at e

/-- 定理 J.10(e)：0·− は右随伴を持たず、左随伴も持たない（`0x0` で割る `!_` は随伴の無い所）。 -/
theorem zero_no_adj :
    (¬ ∃ R : Nat → Nat, ∀ n b, 0 * n ≤ b ↔ n ≤ R b) ∧
    (¬ ∃ L : Nat → Nat, ∀ b n, L b ≤ n ↔ b ≤ 0 * n) := by
  constructor
  · rintro ⟨R, hR⟩
    have h1 := (hR (R 0 + 1) 0).1 (by rw [Nat.zero_mul]; exact Nat.le_refl 0)
    omega
  · rintro ⟨L, hL⟩
    have h1 := (hL 1 (L 1)).1 (Nat.le_refl _)
    rw [Nat.zero_mul] at h1
    omega

/-! ## J.11 Int の割り算・ずらし・余り -/

/-- 定理 J.11(a)：ℤ の上で a·− が右随伴を持つ ⇔ a > 0。その時の右随伴は床（Lean の Int の `/` は
Euclid の割り算で、a > 0 では床 `Int.fdiv` と同じ）。a < 0 では反変の接続になる。 -/
theorem int_right_adj_iff (a : Int) :
    ((∃ R : Int → Int, ∀ n b, a * n ≤ b ↔ n ≤ R b) ↔ 0 < a) ∧
    (0 < a → ∀ n b, (a * n ≤ b ↔ n ≤ b / a) ∧ b / a = Int.fdiv b a) ∧
    (a < 0 → ∀ n b, a * n ≤ b ↔ -(b / (-a)) ≤ n) := by
  have hpos : 0 < a → ∀ n b, (a * n ≤ b ↔ n ≤ b / a) := by
    intro ha n b
    rw [Int.le_ediv_iff_mul_le ha, Int.mul_comm]
  refine ⟨⟨?_, ?_⟩, ?_, ?_⟩
  · intro hR'
    obtain ⟨R, hR⟩ := hR'
    rcases Int.lt_or_le 0 a with ha | ha
    · exact ha
    · exfalso
      have h0 : (0 : Int) ≤ R 0 := (hR 0 0).1 (by rw [Int.mul_zero]; exact Int.le_refl 0)
      have h1 : a * (R 0 + 1) ≤ 0 := Int.mul_nonpos_of_nonpos_of_nonneg ha (by omega)
      have h2 := (hR (R 0 + 1) 0).1 h1
      omega
  · intro ha
    exact ⟨fun b => b / a, hpos ha⟩
  · intro ha n b
    exact ⟨hpos ha n b, (Int.fdiv_eq_ediv_of_nonneg b (Int.le_of_lt ha)).symm⟩
  · intro ha n b
    have hc : 0 < -a := by omega
    have e : a * n = -n * (-a) := by rw [Int.neg_mul_neg, Int.mul_comm]
    rw [e]
    constructor
    · intro h
      have := (Int.le_ediv_iff_mul_le hc).2 h
      omega
    · intro h
      have : -n ≤ b / (-a) := by omega
      exact (Int.le_ediv_iff_mul_le hc).1 this

/-- 定理 J.11(b)：V5 の `/`（0 へ切り捨て、`Int.tdiv`）は 2·− の右随伴でない。 -/
theorem tdiv_not_adj : (-3 : Int) ≤ Int.tdiv (-7) 2 ∧ ¬ (2 * (-3 : Int) ≤ -7) := by
  decide

/-- 定理 J.11(c)：a > 0 で、tdiv は b ≥ 0 では床（右随伴）、b ≤ 0 では天井（左随伴）。 -/
theorem tdiv_floor_ceil (a b : Int) (ha : 0 < a) :
    (0 ≤ b → b.tdiv a = b / a) ∧ (b ≤ 0 → b.tdiv a = -((-b) / a)) ∧
    (∀ n, -((-b) / a) ≤ n ↔ b ≤ a * n) := by
  refine ⟨fun hb => Int.tdiv_eq_ediv_of_nonneg hb, fun hb => ?_, fun n => ?_⟩
  · have hb' : 0 ≤ -b := by omega
    rw [← Int.tdiv_eq_ediv_of_nonneg hb', Int.neg_tdiv, Int.neg_neg]
  · constructor
    · intro h
      have h1 : -n ≤ (-b) / a := by omega
      have h2 := (Int.le_ediv_iff_mul_le ha).1 h1
      have e : -n * a = -(a * n) := by rw [Int.neg_mul, Int.mul_comm]
      omega
    · intro h
      have e : -n * a = -(a * n) := by rw [Int.neg_mul, Int.mul_comm]
      have h1 : -n * a ≤ -b := by omega
      have h2 := (Int.le_ediv_iff_mul_le ha).2 h1
      omega

/-- 掛け算でない写像 L_a：n > 0 では a n、n ≤ 0 では a n − a + 1。 -/
def La (a n : Int) : Int := if 0 < n then a * n else a * n - a + 1

/-- 定理 J.11(c)：tdiv(−, a) は L_a の右随伴（掛け算の右随伴ではない）。 -/
theorem tdiv_right_adj (a : Int) (ha : 0 < a) (n b : Int) : La a n ≤ b ↔ n ≤ b.tdiv a := by
  have hfc := tdiv_floor_ceil a b ha
  have e : (-n + 1) * a = -(a * n) + a := by
    rw [Int.add_mul, Int.neg_mul, Int.one_mul, Int.mul_comm]
  have key : n ≤ -((-b) / a) ↔ a * n - a + 1 ≤ b := by
    constructor
    · intro h
      have h1 : (-b) / a ≤ -n := by omega
      have h2 := Int.lt_ediv_add_one_mul_self (-b) ha
      have h3 : ((-b) / a + 1) * a ≤ (-n + 1) * a :=
        Int.mul_le_mul_of_nonneg_right (by omega) (Int.le_of_lt ha)
      rw [Int.add_mul, Int.one_mul] at h2 h3
      omega
    · intro h
      have h4 : ¬ (-n + 1 ≤ (-b) / a) := by
        intro h5
        have := (Int.le_ediv_iff_mul_le ha).1 h5
        omega
      omega
  unfold La
  rcases Int.lt_or_le 0 n with hn | hn
  · rw [ite_eq_left hn]
    rcases Int.le_total 0 b with hb | hb
    · rw [hfc.1 hb, Int.le_ediv_iff_mul_le ha, Int.mul_comm]
    · rw [hfc.2.1 hb, key]
      have h1 : a * 1 ≤ a * n := Int.mul_le_mul_of_nonneg_left (by omega) (Int.le_of_lt ha)
      rw [Int.mul_one] at h1
      constructor
      · intro h
        omega
      · intro h
        omega
  · rw [ite_eq_right (Int.not_lt.2 hn)]
    rcases Int.le_total 0 b with hb | hb
    · rw [hfc.1 hb, Int.le_ediv_iff_mul_le ha]
      have h1 : a * n ≤ 0 := Int.mul_nonpos_of_nonneg_of_nonpos (Int.le_of_lt ha) hn
      have h2 : n * a ≤ 0 := Int.mul_nonpos_of_nonpos_of_nonneg hn (Int.le_of_lt ha)
      constructor
      · intro _
        omega
      · intro _
        omega
    · rw [hfc.2.1 hb, key]

/-- 定理 J.11(d)：Int の床のずらし `>>>` は ·2^k の右随伴。 -/
theorem int_shift_adj (n b : Int) (k : Nat) : n * 2 ^ k ≤ b ↔ n ≤ b >>> k := by
  have e : ((2 ^ k : Nat) : Int) = (2 : Int) ^ k := Int.natCast_pow 2 k
  have hp : (0 : Int) < 2 ^ k := Int.pow_pos (by decide)
  rw [Int.shiftRight_eq_div_pow, e]
  exact (Int.le_ediv_iff_mul_le hp).symm

/-- 定理 J.11(d)：床のずらしと切り捨ての `/ 2` は、負で割れる（`-7 >> 1` は −4、`-7 / 2` は −3）。 -/
theorem shift_vs_tdiv : (-7 : Int) >>> 1 = -4 ∧ Int.tdiv (-7) 2 = -3 := by
  decide

/-- 定理 J.11(e)：V5 の `%`（`Int.tmod`）。a > 0 では、b ≥ 0 で余単位 a⌊b/a⌋ ≤ b の隙間、
b ≤ 0 で単位 b ≤ a⌈b/a⌉ の隙間（符号は負）。 -/
theorem tmod_gap (a b : Int) (ha : 0 < a) :
    a * b.tdiv a + b.tmod a = b ∧
    (0 ≤ b → 0 ≤ b.tmod a ∧ b.tmod a < a ∧ a * (b / a) + b.tmod a = b) ∧
    (b ≤ 0 → -a < b.tmod a ∧ b.tmod a ≤ 0 ∧ a * (-((-b) / a)) + b.tmod a = b) := by
  have hfc := tdiv_floor_ceil a b ha
  have h0 : a * b.tdiv a + b.tmod a = b := Int.mul_tdiv_add_tmod b a
  refine ⟨h0, fun hb => ⟨Int.tmod_nonneg a hb, Int.tmod_lt_of_pos b ha, ?_⟩,
    fun hb => ⟨?_, ?_, ?_⟩⟩
  · rw [← hfc.1 hb]
    exact h0
  · have hb' : 0 ≤ -b := by omega
    have h1 := Int.tmod_lt_of_pos (-b) ha
    rw [Int.neg_tmod] at h1
    omega
  · have hb' : 0 ≤ -b := by omega
    have h1 := Int.tmod_nonneg a hb'
    rw [Int.neg_tmod] at h1
    omega
  · rw [← hfc.2.1 hb]
    exact h0

/-- 定理 J.11(e)：`Int.tmod` の符号は、割る数に依らず割られる数に従う。 -/
theorem tmod_sign (a b : Int) : (0 ≤ b → 0 ≤ b.tmod a) ∧ (b ≤ 0 → b.tmod a ≤ 0) := by
  refine ⟨fun hb => Int.tmod_nonneg a hb, fun hb => ?_⟩
  have hb' : 0 ≤ -b := by omega
  have h1 := Int.tmod_nonneg a hb'
  rw [Int.neg_tmod] at h1
  omega

/-! ## J.12 `!_` の2つの持ち上げと、種類を跨ぐ結合 -/

/-- 単位の持ち上げ U：両方値なら f、片方だけ値ならその値、両方 `!_` なら `!_`。 -/
def liftU {X : Type u} (f : X → X → Option X) : Option X → Option X → Option X
  | some x, some y => f x y
  | some x, none => some x
  | none, b => b

/-- 零の持ち上げ Z：両方値なら f、ほかは `!_`（Kleisli の持ち上げ）。 -/
def liftZ {X : Type u} (f : X → X → Option X) : Option X → Option X → Option X
  | some x, some y => f x y
  | _, _ => none

/-- Kleisli の意味の結合：f(x, y) ≫= f(−, z) = f(y, z) ≫= f(x, −)。 -/
def KAssoc {X : Type u} (f : X → X → Option X) : Prop :=
  ∀ x y z, (f x y).bind (fun w => f w z) = (f y z).bind (fun w => f x w)

/-- 定理 J.12(a)：`|` = U(π₁)、`;` = U(⊥)、`&` = Z(π₂)。 -/
theorem ops_as_lifts {α : Type u} :
    (∀ a b : Option α, orO a b = liftU (fun x _ => some x) a b) ∧
    (∀ a b : Option α, xorO a b = liftU (fun _ _ => none) a b) ∧
    (∀ a b : Option α, andO a b = liftZ (fun _ y => some y) a b) := by
  refine ⟨fun a b => ?_, fun a b => ?_, fun a b => ?_⟩
  · cases a <;> cases b <;> rfl
  · cases a <;> cases b <;> rfl
  · cases a <;> cases b <;> rfl

/-- 定理 J.12(a)：楔への制限は、U が畳み ∇、Z が基点への定数。 -/
theorem wedge_profile {X : Type u} (f : X → X → Option X) (a : Option X) :
    liftU f a none = a ∧ liftU f none a = a ∧ liftZ f a none = none ∧ liftZ f none a = none := by
  cases a <;> exact ⟨rfl, rfl, rfl, rfl⟩

/-- 定理 J.12(a)：`!_` を両側の単位に持つ演算は、ちょうど U f の形。 -/
theorem unit_iff_liftU {X : Type u} (o : Option X → Option X → Option X) :
    (∀ a, o a none = a ∧ o none a = a) ↔ ∃ f, ∀ a b, o a b = liftU f a b := by
  constructor
  · intro h
    refine ⟨fun x y => o (some x) (some y), fun a b => ?_⟩
    cases a with
    | none => exact (h b).2
    | some x =>
      cases b with
      | none => exact (h (some x)).1
      | some y => rfl
  · intro hf' a
    obtain ⟨f, hf⟩ := hf'
    rw [hf, hf]
    cases a <;> exact ⟨rfl, rfl⟩

/-- 定理 J.12(a)：`!_` を両側の零に持つ演算は、ちょうど Z f の形。 -/
theorem zero_iff_liftZ {X : Type u} (o : Option X → Option X → Option X) :
    (∀ a, o a none = none ∧ o none a = none) ↔ ∃ f, ∀ a b, o a b = liftZ f a b := by
  constructor
  · intro h
    refine ⟨fun x y => o (some x) (some y), fun a b => ?_⟩
    cases a with
    | none => exact (h b).2
    | some x =>
      cases b with
      | none => exact (h (some x)).1
      | some y => rfl
  · intro hf' a
    obtain ⟨f, hf⟩ := hf'
    rw [hf, hf]
    cases a <;> exact ⟨rfl, rfl⟩

/-- 定理 J.12(a)：U と Z は f と1対1。 -/
theorem lift_injective {X : Type u} (f g : X → X → Option X) :
    ((∀ a b, liftU f a b = liftU g a b) → f = g) ∧
    ((∀ a b, liftZ f a b = liftZ g a b) → f = g) := by
  refine ⟨fun h => ?_, fun h => ?_⟩
  · funext x y
    exact h (some x) (some y)
  · funext x y
    exact h (some x) (some y)

/-- 定理 J.12(b)：同じ演算の上で、`!_` は単位と零を兼ねられない（値が1つでもあれば）。 -/
theorem unit_ne_zero {X : Type u} (o : Option X → Option X → Option X)
    (hu : ∀ a, o a none = a) (hz : ∀ a, o a none = none) (x : X) : False := by
  have h1 := hu (some x)
  rw [hz (some x)] at h1
  exact nomatch h1

/-- 定理 J.12(c)：Z f が結合的 ⇔ f が Kleisli の意味で結合的。 -/
theorem liftZ_assoc_iff {X : Type u} (f : X → X → Option X) :
    (∀ a b c, liftZ f (liftZ f a b) c = liftZ f a (liftZ f b c)) ↔ KAssoc f := by
  have hl : ∀ m z, liftZ f m (some z) = m.bind (fun w => f w z) := by
    intro m z
    cases m <;> rfl
  have hr : ∀ x m, liftZ f (some x) m = m.bind (fun w => f x w) := by
    intro x m
    cases m <;> rfl
  constructor
  · intro h x y z
    calc (f x y).bind (fun w => f w z) = liftZ f (f x y) (some z) := (hl _ _).symm
      _ = liftZ f (some x) (f y z) := h (some x) (some y) (some z)
      _ = (f y z).bind (fun w => f x w) := hr _ _
  · intro h a b c
    cases a with
    | none => rfl
    | some x =>
      cases b with
      | none => rfl
      | some y =>
        cases c with
        | none =>
          show liftZ f (f x y) none = none
          cases f x y <;> rfl
        | some z =>
          show liftZ f (f x y) (some z) = liftZ f (some x) (f y z)
          rw [hl, hr]
          exact h x y z

/-- 定理 J.12(c)：全域で結合的な g なら、U も結合的。 -/
theorem liftU_assoc_of_total {X : Type u} (g : X → X → X)
    (hg : ∀ x y z, g (g x y) z = g x (g y z)) (a b c : Option X) :
    liftU (fun x y => some (g x y)) (liftU (fun x y => some (g x y)) a b) c =
      liftU (fun x y => some (g x y)) a (liftU (fun x y => some (g x y)) b c) := by
  cases a with
  | none => rfl
  | some x =>
    cases b with
    | none => rfl
    | some y =>
      cases c with
      | none => rfl
      | some z =>
        show some (g (g x y) z) = some (g x (g y z))
        rw [hg]

/-- 値の段の値：数、番地、関数を指す番地（`$inc`。値の演算子はどれもそれへの射を持たない）。 -/
inductive Val (N : Type u) (A : Type v) where
  | num : N → Val N A
  | addr : A → Val N A
  | fn : Val N A
  deriving DecidableEq, Repr

/-- 2つの `!_` の上の `+` の形の演算。外の `none` は運ばれる `!_`（⊥_A）、`some none` は計算の `!_`（⊥_N）。
⊥_A があれば ⊥_A。数と ⊥_N の間では ⊥_N が単位。番地どうしは gA（負と溢れは ⊥_A）。
番地と数か ⊥_N の組、関数を指す番地を当てた組は ⊥_A。 -/
def mixOp {N : Type u} {A : Type v} (gN : N → N → N) (gA : A → A → Option A) :
    Option (Option (Val N A)) → Option (Option (Val N A)) → Option (Option (Val N A))
  | none, _ => none
  | _, none => none
  | some none, some none => some none
  | some none, some (some (.num n)) => some (some (.num n))
  | some (some (.num n)), some none => some (some (.num n))
  | some (some (.num n)), some (some (.num m)) => some (some (.num (gN n m)))
  | some (some (.addr a)), some (some (.addr b)) => (gA a b).map (fun c => some (.addr c))
  | _, _ => none

/-- `!_` が1つの模型：数に対しては単位、番地と関数を指す番地に対しては零、混ぜは `!_`。 -/
def oneOp {N : Type u} {A : Type v} (gN : N → N → N) (gA : A → A → Option A) :
    Option (Val N A) → Option (Val N A) → Option (Val N A)
  | none, some (.num n) => some (.num n)
  | some (.num n), none => some (.num n)
  | some (.num n), some (.num m) => some (.num (gN n m))
  | some (.addr a), some (.addr b) => (gA a b).map .addr
  | _, _ => none

/-- 定理 J.12(d)：2つの `!_` の振る舞い。⊥_A は両側の零。⊥_N は数に対して両側の単位で、番地に来れば吸われて ⊥_A。 -/
theorem mixOp_profile {N : Type u} {A : Type v} (gN : N → N → N) (gA : A → A → Option A)
    (t : Option (Option (Val N A))) (n : N) (a : A) :
    mixOp gN gA none t = none ∧ mixOp gN gA t none = none ∧
    mixOp gN gA (some none) (some (some (.num n))) = some (some (.num n)) ∧
    mixOp gN gA (some (some (.num n))) (some none) = some (some (.num n)) ∧
    mixOp gN gA (some none) (some (some (.addr a))) = none ∧
    mixOp gN gA (some (some (.addr a))) (some none) = none ∧
    mixOp gN gA (some (some (.addr a))) (some (some (.num n))) = none ∧
    mixOp gN gA (some (some (.num n))) (some (some (.addr a))) = none ∧
    mixOp gN gA (some (some .fn)) t = none ∧ mixOp gN gA t (some (some .fn)) = none := by
  refine ⟨rfl, ?_, rfl, rfl, rfl, rfl, rfl, rfl, ?_, ?_⟩
  · rcases t with _ | _ | (_ | _ | _) <;> rfl
  · rcases t with _ | _ | (_ | _ | _) <;> rfl
  · rcases t with _ | _ | (_ | _ | _) <;> rfl

-- 番地だけの3つ組：gA の Kleisli の結合に帰す。
private theorem arithb_addr3 {N : Type u} {A : Type v} (gN : N → N → N) (gA : A → A → Option A)
    (hA : KAssoc gA) (a b c : A) :
    mixOp gN gA (mixOp gN gA (some (some (.addr a))) (some (some (.addr b))))
        (some (some (.addr c))) =
      mixOp gN gA (some (some (.addr a)))
        (mixOp gN gA (some (some (.addr b))) (some (some (.addr c)))) := by
  have hl : ∀ m : Option A,
      mixOp gN gA (m.map (fun d => some (Val.addr d))) (some (some (.addr c))) =
        (m.bind (fun w => gA w c)).map (fun d => some (Val.addr d)) := by
    intro m
    cases m <;> rfl
  have hr : ∀ m : Option A,
      mixOp gN gA (some (some (.addr a))) (m.map (fun d => some (Val.addr d))) =
        (m.bind (fun w => gA a w)).map (fun d => some (Val.addr d)) := by
    intro m
    cases m <;> rfl
  show mixOp gN gA ((gA a b).map (fun d => some (Val.addr d))) (some (some (.addr c))) =
    mixOp gN gA (some (some (.addr a))) ((gA b c).map (fun d => some (Val.addr d)))
  rw [hl, hr, hA a b c]

-- 番地の結果の後に番地でない物が来れば ⊥_A。
private theorem arithb_addr_left {N : Type u} {A : Type v} (gN : N → N → N)
    (gA : A → A → Option A) (m : Option A) (w : Option (Option (Val N A)))
    (hw : ∀ c, w ≠ some (some (.addr c))) :
    mixOp gN gA (m.map (fun d => some (Val.addr d))) w = none := by
  cases m with
  | none => rfl
  | some d =>
    rcases w with _ | _ | (_ | c | _)
    · rfl
    · rfl
    · rfl
    · exact absurd rfl (hw c)
    · rfl

-- 番地でない物の後に番地の結果が来れば ⊥_A。
private theorem arithb_addr_right {N : Type u} {A : Type v} (gN : N → N → N)
    (gA : A → A → Option A) (m : Option A) (s : Option (Option (Val N A)))
    (hs : ∀ c, s ≠ some (some (.addr c))) :
    mixOp gN gA s (m.map (fun d => some (Val.addr d))) = none := by
  cases m with
  | none => rcases s with _ | _ | (_ | _ | _) <;> rfl
  | some d =>
    rcases s with _ | _ | (_ | c | _)
    · rfl
    · rfl
    · rfl
    · exact absurd rfl (hs c)
    · rfl

/-- 定理 J.12(d)：gN が全域で結合的、gA が Kleisli の意味で結合的なら、種類を跨いでも結合的。 -/
theorem mixOp_assoc {N : Type u} {A : Type v} (gN : N → N → N) (gA : A → A → Option A)
    (hN : ∀ x y z, gN (gN x y) z = gN x (gN y z)) (hA : KAssoc gA) :
    ∀ s t w, mixOp gN gA (mixOp gN gA s t) w = mixOp gN gA s (mixOp gN gA t w) := by
  intro s t w
  rcases s with _ | _ | (n | a | _) <;> rcases t with _ | _ | (m | b | _) <;>
    rcases w with _ | _ | (k | c | _)
  all_goals first
    | rfl
    | exact arithb_addr3 gN gA hA _ _ _
    | exact congrArg (fun x => some (some (Val.num x))) (hN _ _ _)
    | exact arithb_addr_left gN gA _ _ (fun _ h => nomatch h)
    | exact (arithb_addr_right gN gA _ _ (fun _ h => by cases h)).symm

/-- 定理 J.12(d)：`!_` が1つだと、種類を跨ぐ結合が (⊥, 番地, 数) で崩れる。 -/
theorem oneOp_not_assoc {N : Type u} {A : Type v} (gN : N → N → N) (gA : A → A → Option A)
    (n : N) (a : A) :
    oneOp gN gA (oneOp gN gA none (some (.addr a))) (some (.num n)) ≠
      oneOp gN gA none (oneOp gN gA (some (.addr a)) (some (.num n))) := by
  intro h
  exact nomatch h

/-- Int の `+` と、上限の無い番地の `+` の2つの `!_` の模型。 -/
def plus2 : Option (Option (Val Int Nat)) → Option (Option (Val Int Nat)) →
    Option (Option (Val Int Nat)) :=
  mixOp (· + ·) (fun a b => some (a + b))

/-- 同じ `+` の、`!_` が1つの模型。 -/
def plus1 : Option (Val Int Nat) → Option (Val Int Nat) → Option (Val Int Nat) :=
  oneOp (· + ·) (fun a b => some (a + b))

/-- 定理 J.12(e)：1039 行の例。`$inc + 1 + 2`・`1 + ($inc + 2)`・`$vs + 0x8 + 0x10` は `!_`、
`(3 < 2) + 1` は 1。`!_` が1つだと、`$inc + 1 + 2` は 2、`1 + ($inc + 2)` は 1 に割れる。 -/
theorem carry_examples :
    plus2 (plus2 (some (some .fn)) (some (some (.num 1)))) (some (some (.num 2))) = none ∧
    plus2 (some (some (.num 1))) (plus2 (some (some .fn)) (some (some (.num 2)))) = none ∧
    plus2 (plus2 (some none) (some (some (.addr 8)))) (some (some (.addr 16))) = none ∧
    plus2 (some none) (some (some (.num 1))) = some (some (.num 1)) ∧
    plus1 (plus1 (some .fn) (some (.num 1))) (some (.num 2)) = some (.num 2) ∧
    plus1 (some (.num 1)) (plus1 (some .fn) (some (.num 2))) = some (.num 1) := by
  decide

/-! ## J.13 溢れと作り話、単調さ -/

/-- 算術の項：字面と、2項の演算の節。 -/
inductive Tm where
  | lit : Int → Tm
  | node : (Int → Int → Int) → Tm → Tm → Tm

/-- 上限の無い値。 -/
def Tm.exact : Tm → Int
  | .lit n => n
  | .node g s t => g s.exact t.exact

/-- 上限 B：B に入れば値、入らなければ `!_`。 -/
def bnd (B : Int → Bool) (v : Int) : Option Int := if B v then some v else none

/-- 零の持ち上げで畳む（溢れの `!_` を零として受ける）。 -/
def Tm.evZ (B : Int → Bool) : Tm → Option Int
  | .lit n => bnd B n
  | .node g s t => liftZ (fun x y => bnd B (g x y)) (s.evZ B) (t.evZ B)

/-- 単位の持ち上げで畳む（溢れの `!_` を単位として受ける。V5 の 87 行）。 -/
def Tm.evU (B : Int → Bool) : Tm → Option Int
  | .lit n => bnd B n
  | .node g s t => liftU (fun x y => bnd B (g x y)) (s.evU B) (t.evU B)

/-- 64 ビットの Int に入るか。 -/
def in64 (v : Int) : Bool := decide (-(2 ^ 63) ≤ v ∧ v ≤ 2 ^ 63 - 1)

/-- 64 ビットの Int の最大。 -/
def maxInt : Int := 2 ^ 63 - 1

/-- V5 の例 `(MAX+2)+(0-2)`。 -/
def tOver : Tm := .node (· + ·) (.node (· + ·) (.lit maxInt) (.lit 2)) (.node (· - ·) (.lit 0) (.lit 2))

/-- 括り直した `MAX+(2+(0-2))`。 -/
def tOver' : Tm :=
  .node (· + ·) (.lit maxInt) (.node (· + ·) (.lit 2) (.node (· - ·) (.lit 0) (.lit 2)))

-- 上限に入って値が出れば、その値は元の値。
private theorem arithb_bnd_some (B : Int → Bool) (x v : Int) (h : bnd B x = some v) : v = x := by
  unfold bnd at h
  split at h
  · exact (Option.some.inj h).symm
  · exact nomatch h

/-- 定理 J.13(a)：零の持ち上げは作り話をしない（値が出れば、上限の無い値と等しい）。 -/
theorem evZ_sound (B : Int → Bool) : ∀ (t : Tm) (v : Int), t.evZ B = some v → v = t.exact := by
  intro t
  induction t with
  | lit n =>
    intro v h
    exact arithb_bnd_some B n v h
  | node g s t ihs iht =>
    intro v h
    show v = g s.exact t.exact
    rw [Tm.evZ] at h
    cases hs : s.evZ B with
    | none =>
      rw [hs] at h
      exact nomatch h
    | some x =>
      cases ht : t.evZ B with
      | none =>
        rw [hs, ht] at h
        exact nomatch h
      | some y =>
        rw [hs, ht] at h
        have hv : v = g x y := arithb_bnd_some B (g x y) v h
        rw [ihs x hs, iht y ht] at hv
        exact hv

/-- 定理 J.13(b)：単位の持ち上げは作り話をする。`(MAX+2)+(0-2)` は −2、括り直すと MAX。 -/
theorem overflow_fabricates :
    tOver.evU in64 = some (-2) ∧ tOver'.evU in64 = some maxInt ∧ tOver.exact = maxInt ∧
    tOver.evZ in64 = none ∧ tOver'.evZ in64 = some maxInt := by
  decide

/-- 定理 J.13(c)：上限つきの番地（符号なし）の `+` は Kleisli の意味で結合的。 -/
theorem uaddB_kassoc (M : Nat) :
    KAssoc (fun a b : Nat => if a + b ≤ M then some (a + b) else none) := by
  have hl : ∀ p q r : Nat, (if p + q ≤ M then some (p + q) else none).bind
      (fun w => if w + r ≤ M then some (w + r) else none) =
      if p + q + r ≤ M then some (p + q + r) else none := by
    intro p q r
    rcases Nat.lt_or_ge M (p + q) with h1 | h1
    · have h2 : ¬ (p + q + r ≤ M) := by omega
      rw [ite_eq_right (Nat.not_le.2 h1), ite_eq_right h2]
      rfl
    · rw [ite_eq_left h1]
      rfl
  have hr : ∀ p q r : Nat, (if q + r ≤ M then some (q + r) else none).bind
      (fun w => if p + w ≤ M then some (p + w) else none) =
      if p + (q + r) ≤ M then some (p + (q + r)) else none := by
    intro p q r
    rcases Nat.lt_or_ge M (q + r) with h1 | h1
    · have h2 : ¬ (p + (q + r) ≤ M) := by omega
      rw [ite_eq_right (Nat.not_le.2 h1), ite_eq_right h2]
      rfl
    · rw [ite_eq_left h1]
      rfl
  intro x y z
  show (if x + y ≤ M then some (x + y) else none).bind
      (fun w => if w + z ≤ M then some (w + z) else none) =
    (if y + z ≤ M then some (y + z) else none).bind
      (fun w => if x + w ≤ M then some (x + w) else none)
  rw [hl, hr, Nat.add_assoc]

/-- 定理 J.13(c)：64 ビットの Int の `+` は Kleisli の意味で結合的でない（(MAX, 1, −1)）。 -/
theorem int64_not_kassoc : ¬ KAssoc (fun a b : Int => bnd in64 (a + b)) := by
  intro h
  exact absurd (h maxInt 1 (-1)) (by decide)

/-- 定理 J.13(d)：平坦な順序で、U f が単調 ⇔ どの x, y でも f(x, y) = x かつ f(x, y) = y。 -/
theorem liftU_mono_iff {X : Type u} (f : X → X → Option X) :
    (∀ a a' b b', flatLE a a' → flatLE b b' → flatLE (liftU f a b) (liftU f a' b')) ↔
      ∀ x y, f x y = some x ∧ f x y = some y := by
  constructor
  · intro h x y
    have h1 : flatLE (some y) (f x y) := h none (some x) (some y) (some y) True.intro rfl
    have h2 : flatLE (some x) (f x y) := h (some x) (some x) none (some y) rfl True.intro
    cases e : f x y with
    | none =>
      rw [e] at h1
      exact (h1 : False).elim
    | some z =>
      rw [e] at h1 h2
      have h1' : y = z := h1
      have h2' : x = z := h2
      exact ⟨congrArg some h2'.symm, congrArg some h1'.symm⟩
  · intro hf a a' b b' ha hb
    cases a with
    | none =>
      cases a' with
      | none => exact hb
      | some x' =>
        cases b with
        | none => exact True.intro
        | some y =>
          cases b' with
          | none => exact (hb : False).elim
          | some y' =>
            show flatLE (some y) (f x' y')
            rw [(hf x' y').2]
            exact hb
    | some x =>
      cases a' with
      | none => exact (ha : False).elim
      | some x' =>
        have hx : x = x' := ha
        subst hx
        cases b with
        | none =>
          cases b' with
          | none => exact (rfl : x = x)
          | some y' =>
            show flatLE (some x) (f x y')
            rw [(hf x y').1]
            exact (rfl : x = x)
        | some y =>
          cases b' with
          | none => exact (hb : False).elim
          | some y' =>
            have hy : y = y' := hb
            subst hy
            show flatLE (f x y) (f x y)
            rw [(hf x y).1]
            exact (rfl : x = x)

/-- 定理 J.13(d)：Z f はいつも単調。 -/
theorem liftZ_mono {X : Type u} (f : X → X → Option X) :
    ∀ a a' b b', flatLE a a' → flatLE b b' → flatLE (liftZ f a b) (liftZ f a' b') := by
  intro a a' b b' ha hb
  cases a with
  | none => exact True.intro
  | some x =>
    cases a' with
    | none => exact (ha : False).elim
    | some x' =>
      have hx : x = x' := ha
      subst hx
      cases b with
      | none => exact True.intro
      | some y =>
        cases b' with
        | none => exact (hb : False).elim
        | some y' =>
          have hy : y = y' := hb
          subst hy
          show flatLE (f x y) (f x y)
          cases f x y with
          | none => exact True.intro
          | some z => exact (rfl : z = z)

end SignMath
