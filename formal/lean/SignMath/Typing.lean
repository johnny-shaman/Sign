import SignMath.Row

/-!
# J-1. 区切りと演算の組で付く種類（Mathlib を使わない）

種類を、葉の字面の印と、節の区切り・演算子の表の畳みとして書く。
`!_` は I の節と同じく `Option` の `none` に置き、値の演算子から見た2点（void と carried）だけを `KVal` で分ける。
この節の宣言は Mathlib を使わない。どの証明も `Classical.choice` を使わない（排中律も使わない）。
-/

namespace SignMath

universe u v w

/-! ## J.1 型付けは畳み -/

/-- 項の木：字面 `L`・名前 `N`・2項の演算子 `O`。
並置の行は J.3、`,` の単位律は J.4 で見る。括り（`[x] ≅ x`）と改行（別の行の根）は節にしない。 -/
inductive OpTm (L N O : Type u) : Type u where
  | lit : L → OpTm L N O
  | name : N → OpTm L N O
  | op : O → OpTm L N O → OpTm L N O → OpTm L N O

/-- 畳み：葉は `μ`（字面の印）と `ρ`（名前の種類）、節は `τ`（演算子ごとの表）。 -/
def OpTm.fold {L N O : Type u} {K : Type v} (μ : L → K) (ρ : N → K) (τ : O → K → K → K) :
    OpTm L N O → K
  | .lit l => μ l
  | .name i => ρ i
  | .op o a b => τ o (OpTm.fold μ ρ τ a) (OpTm.fold μ ρ τ b)

/-- 葉の字面を写す。 -/
def OpTm.mapLit {L L' N O : Type u} (f : L → L') : OpTm L N O → OpTm L' N O
  | .lit l => .lit (f l)
  | .name i => .name i
  | .op o a b => .op o (OpTm.mapLit f a) (OpTm.mapLit f b)

/-- 定理 J.1(a)：字面・名前・演算子の3つの等式を満たす写像は畳みだけ。 -/
theorem OpTm.fold_unique {L N O : Type u} {K : Type v} (μ : L → K) (ρ : N → K)
    (τ : O → K → K → K) (h : OpTm L N O → K) (hl : ∀ l, h (.lit l) = μ l)
    (hn : ∀ i, h (.name i) = ρ i) (ho : ∀ o a b, h (.op o a b) = τ o (h a) (h b)) :
    ∀ t, h t = OpTm.fold μ ρ τ t := by
  intro t
  induction t with
  | lit l => exact hl l
  | name i => exact hn i
  | op o a b iha ihb =>
    show h (.op o a b) = τ o (OpTm.fold μ ρ τ a) (OpTm.fold μ ρ τ b)
    rw [ho, iha, ihb]

/-- 定理 J.1(b)：葉と表が関係 `sat` を保てば、どの項でも値は種類を満たす（健全さは畳みで運ばれる）。 -/
theorem OpTm.fold_sound {L N O : Type u} {D : Type v} {K : Type w} (sat : D → K → Prop)
    (δ : L → D) (η : N → D) (ev : O → D → D → D) (μ : L → K) (ρ : N → K)
    (τ : O → K → K → K) (hl : ∀ l, sat (δ l) (μ l)) (hn : ∀ i, sat (η i) (ρ i))
    (ho : ∀ o d₁ d₂ k₁ k₂, sat d₁ k₁ → sat d₂ k₂ → sat (ev o d₁ d₂) (τ o k₁ k₂)) :
    ∀ t, sat (OpTm.fold δ η ev t) (OpTm.fold μ ρ τ t) := by
  intro t
  induction t with
  | lit l => exact hl l
  | name i => exact hn i
  | op o a b iha ihb => exact ho o _ _ _ _ iha ihb

/-- 定理 J.1(c)：種類は、葉を印に置き換えた木を表で畳んだ物（字面は印を通してだけ入る）。 -/
theorem OpTm.fold_mapLit {L N O K : Type u} (μ : L → K) (ρ : N → K) (τ : O → K → K → K)
    (t : OpTm L N O) : OpTm.fold μ ρ τ t = OpTm.fold (fun k => k) ρ τ (t.mapLit μ) := by
  induction t with
  | lit l => rfl
  | name i => rfl
  | op o a b iha ihb =>
    show τ o (OpTm.fold μ ρ τ a) (OpTm.fold μ ρ τ b) =
      τ o (OpTm.fold (fun k => k) ρ τ (a.mapLit μ)) (OpTm.fold (fun k => k) ρ τ (b.mapLit μ))
    rw [iha, ihb]

/-- 定理 J.1(c)：印を変えない字面の置き換えは、種類を変えない。 -/
theorem OpTm.fold_mark_invariant {L N O : Type u} {K : Type v} (μ : L → K) (ρ : N → K)
    (τ : O → K → K → K) (f : L → L) (hf : ∀ l, μ (f l) = μ l) (t : OpTm L N O) :
    OpTm.fold μ ρ τ (t.mapLit f) = OpTm.fold μ ρ τ t := by
  induction t with
  | lit l => exact hf l
  | name i => rfl
  | op o a b iha ihb =>
    show τ o (OpTm.fold μ ρ τ (a.mapLit f)) (OpTm.fold μ ρ τ (b.mapLit f)) =
      τ o (OpTm.fold μ ρ τ a) (OpTm.fold μ ρ τ b)
    rw [iha, ihb]

/-- 数の字面の類（綴りで決まる。文字列と文字の字面は外）。 -/
inductive LitClass where
  /-- 印の無い整数。 -/
  | dec
  /-- 小数点 `.` のある数。 -/
  | point
  /-- `0x…`・`NxHHHH`（`w` は幅、`0` は未指定）。 -/
  | hex (w : Nat)
  /-- `0u…`・`NuHHHH`。 -/
  | u0 (w : Nat)
  /-- `0r…`。 -/
  | r0
  /-- `0b…`。 -/
  | b0

/-- 葉の種類。`point`・`r0`・`b0` は印だけで、値の段の意味は「まだ」（value_spec V12）。
`funAddr` は名前に前置の `$` を当てた項の種類で、字面の印ではない。 -/
inductive SKind where
  | int | addr | charCode | point | r0 | b0 | funAddr
  deriving DecidableEq

/-- 字面の印 μ：綴りだけで決まる（幅は入らない）。 -/
def LitClass.mark : LitClass → SKind
  | .dec => .int
  | .point => .point
  | .hex _ => .addr
  | .u0 _ => .charCode
  | .r0 => .r0
  | .b0 => .b0

/-- 幅を未指定に戻す。 -/
def LitClass.dropWidth : LitClass → LitClass
  | .hex _ => .hex 0
  | .u0 _ => .u0 0
  | c => c

/-- 定理 J.1(c)：幅の接頭辞は種類を変えない。 -/
theorem fold_width_invariant {N O : Type} {K : Type v} (ρ : N → K)
    (τ : O → K → K → K) (μ : SKind → K) (t : OpTm LitClass N O) :
    OpTm.fold (fun l => μ l.mark) ρ τ (t.mapLit LitClass.dropWidth) =
      OpTm.fold (fun l => μ l.mark) ρ τ t := by
  exact OpTm.fold_mark_invariant _ ρ τ _ (by intro l; cases l <;> rfl) t

/-! ## J.2 再帰の名前の種類：いちばん大きい不動点 -/

/-- 名前 `n` 個の種類の仮置き：`true` は A、`false` は未知。 -/
abbrev Guess (n : Nat) : Type := Fin n → Bool

/-- 名前ごとの順（未知 ≤ A）。 -/
def Guess.le {n : Nat} (x y : Guess n) : Prop := ∀ i, x i = true → y i = true

/-- 全部を A と仮置きした所。 -/
def Guess.top (n : Nat) : Guess n := fun _ => true

/-- 本体の読みが単調（仮置きを未知へ下げても、答えが A へ上がらない）。 -/
def GMono {n : Nat} (F : Guess n → Guess n) : Prop :=
  ∀ x y : Guess n, Guess.le x y → Guess.le (F x) (F y)

/-- 全部 A から、全部の本体を一巡ずつ読み直す列。 -/
def gIter {n : Nat} (F : Guess n → Guess n) : Nat → Guess n
  | 0 => Guess.top n
  | k + 1 => F (gIter F k)

/-- 名前 `i` だけを読み直す。 -/
def gUpdate {n : Nat} (F : Guess n → Guess n) (x : Guess n) (i : Fin n) : Guess n :=
  fun j => if j = i then F x j else x j

/-- 全部 A から、名前を `s` の順に1つずつ読み直す。 -/
def gRun {n : Nat} (F : Guess n → Guess n) (s : List (Fin n)) : Guess n :=
  s.foldl (gUpdate F) (Guess.top n)

/-- 定理 J.2(a)：全部 A から始めた列は下がる。 -/
theorem gIter_desc {n : Nat} (F : Guess n → Guess n) (hF : GMono F) :
    ∀ k, Guess.le (gIter F (k + 1)) (gIter F k) := by
  intro k
  induction k with
  | zero => intro i _; rfl
  | succ k ih => exact hF _ _ ih

-- A と仮置きした名前の数
private def typing_gCount : (n : Nat) → Guess n → Nat
  | 0, _ => 0
  | n + 1, x => (if x 0 = true then 1 else 0) + typing_gCount n (fun i => x i.succ)

private theorem typing_gCount_le : ∀ (n : Nat) (x y : Guess n), Guess.le x y →
    typing_gCount n x ≤ typing_gCount n y := by
  intro n
  induction n with
  | zero => intro x y _; exact Nat.le_refl 0
  | succ n ih =>
    intro x y h
    have ht := ih (fun i => x i.succ) (fun i => y i.succ) (fun i hi => h i.succ hi)
    show (if x 0 = true then 1 else 0) + typing_gCount n (fun i => x i.succ) ≤
      (if y 0 = true then 1 else 0) + typing_gCount n (fun i => y i.succ)
    cases hx : x 0 <;> cases hy : y 0
    · simp only [Bool.false_eq_true, ite_false]; omega
    · simp only [Bool.false_eq_true, ite_false, ite_true]; omega
    · exact absurd (h 0 hx) (by rw [hy]; exact Bool.false_ne_true)
    · simp only [ite_true]; omega

private theorem typing_gCount_eq : ∀ (n : Nat) (x y : Guess n), Guess.le x y →
    typing_gCount n x = typing_gCount n y → x = y := by
  intro n
  induction n with
  | zero => intro x y _ _; funext i; exact i.elim0
  | succ n ih =>
    intro x y h hc
    have hle := typing_gCount_le n (fun i => x i.succ) (fun i => y i.succ)
      (fun i hi => h i.succ hi)
    have hc' : (if x 0 = true then 1 else 0) + typing_gCount n (fun i => x i.succ) =
      (if y 0 = true then 1 else 0) + typing_gCount n (fun i => y i.succ) := hc
    have h0 : x 0 = y 0 := by
      cases hx : x 0 <;> cases hy : y 0
      · rfl
      · rw [hx, hy] at hc'; simp only [Bool.false_eq_true, ite_false, ite_true] at hc'; omega
      · exact absurd (h 0 hx) (by rw [hy]; exact Bool.false_ne_true)
      · rfl
    have htail : (fun i : Fin n => x i.succ) = (fun i => y i.succ) := by
      apply ih _ _ (fun i hi => h i.succ hi)
      rw [h0] at hc'
      omega
    funext i
    refine Fin.cases ?_ ?_ i
    · exact h0
    · intro j; exact congrFun htail j

private theorem typing_gCount_bound : ∀ (n : Nat) (x : Guess n), typing_gCount n x ≤ n := by
  intro n
  induction n with
  | zero => intro _; exact Nat.le_refl 0
  | succ n ih =>
    intro x
    have := ih (fun i => x i.succ)
    show (if x 0 = true then 1 else 0) + typing_gCount n (fun i => x i.succ) ≤ n + 1
    cases x 0 <;> simp only [Bool.false_eq_true, ite_false, ite_true] <;> omega

private theorem typing_gIter_stable {n : Nat} (F : Guess n → Guess n) (j : Nat)
    (hj : gIter F (j + 1) = gIter F j) : ∀ m, gIter F (j + m + 1) = gIter F (j + m) := by
  intro m
  induction m with
  | zero => exact hj
  | succ m ih =>
    show F (gIter F (j + m + 1)) = F (gIter F (j + m))
    rw [ih]

/-- 定理 J.2(a)：名前の数 `n` だけ巡れば不動点に着く。 -/
theorem gIter_fixed {n : Nat} (F : Guess n → Guess n) (hF : GMono F) :
    F (gIter F n) = gIter F n := by
  have P : ∀ k, (∃ j, j ≤ k ∧ gIter F (j + 1) = gIter F j) ∨
      typing_gCount n (gIter F k) + k ≤ n := by
    intro k
    induction k with
    | zero => exact Or.inr (by have := typing_gCount_bound n (gIter F 0); omega)
    | succ k ih =>
      rcases ih with ⟨j, hjk, hj⟩ | hc
      · exact Or.inl ⟨j, Nat.le_succ_of_le hjk, hj⟩
      · have hle : typing_gCount n (gIter F (k + 1)) ≤ typing_gCount n (gIter F k) :=
          typing_gCount_le n _ _ (gIter_desc F hF k)
        cases Nat.decEq (typing_gCount n (gIter F (k + 1))) (typing_gCount n (gIter F k)) with
        | isTrue e =>
          exact Or.inl ⟨k, Nat.le_succ k, typing_gCount_eq n _ _ (gIter_desc F hF k) e⟩
        | isFalse hne => right; omega
  rcases P n with ⟨j, hjn, hj⟩ | hc
  · have := typing_gIter_stable F j hj (n - j)
    have e : j + (n - j) = n := by omega
    rw [e] at this
    exact this
  · have hle : typing_gCount n (F (gIter F n)) ≤ typing_gCount n (gIter F n) :=
      typing_gCount_le n _ _ (gIter_desc F hF n)
    exact typing_gCount_eq n _ _ (gIter_desc F hF n) (by omega)

/-- 定理 J.2(b)：その不動点は、どの後不動点（`y ≤ F y`）よりも大きい。 -/
theorem gIter_greatest {n : Nat} (F : Guess n → Guess n) (hF : GMono F) (y : Guess n)
    (hy : Guess.le y (F y)) : Guess.le y (gIter F n) := by
  have : ∀ k, Guess.le y (gIter F k) := by
    intro k
    induction k with
    | zero => intro i _; rfl
    | succ k ih => exact fun i hi => hF _ _ ih i (hy i hi)
  exact this n

private theorem typing_le_antisymm {n : Nat} (x y : Guess n) (h1 : Guess.le x y)
    (h2 : Guess.le y x) : x = y := by
  funext i
  cases hx : x i <;> cases hy : y i
  · rfl
  · exact absurd (h2 i hy) (by rw [hx]; exact Bool.false_ne_true)
  · exact absurd (h1 i hx) (by rw [hy]; exact Bool.false_ne_true)
  · rfl

/-- 定理 J.2(b)：いちばん大きい不動点はただ1つ。 -/
theorem gfp_unique {n : Nat} (F : Guess n → Guess n) (hF : GMono F) (z : Guess n)
    (hz : F z = z) (hg : ∀ y, Guess.le y (F y) → Guess.le y z) : z = gIter F n := by
  apply typing_le_antisymm
  · exact gIter_greatest F hF z (by rw [hz]; exact fun i h => h)
  · apply hg; rw [gIter_fixed F hF]; exact fun i h => h

/-- 定理 J.2(c)：名前を読み直す順をどう選んでも、不動点で止まれば答えは同じ（順に依らない）。 -/
theorem gRun_eq {n : Nat} (F : Guess n → Guess n) (hF : GMono F) (s : List (Fin n))
    (h : F (gRun F s) = gRun F s) : gRun F s = gIter F n := by
  have inv : ∀ (s : List (Fin n)) (x : Guess n), Guess.le (gIter F n) x →
      Guess.le (gIter F n) (s.foldl (gUpdate F) x) := by
    intro s
    induction s with
    | nil => intro x hx; exact hx
    | cons i s ih =>
      intro x hx
      apply ih
      intro j hj
      show (if j = i then F x j else x j) = true
      cases instDecidableEqFin n j i with
      | isTrue hji =>
        rw [ite_eq_left hji]
        have hfix := gIter_fixed F hF
        have : F (gIter F n) j = true := by rw [hfix]; exact hj
        exact hF _ _ hx j this
      | isFalse hji => rw [ite_eq_right hji]; exact hx j hj
  apply typing_le_antisymm
  · apply gIter_greatest F hF; rw [h]; exact fun i h => h
  · exact inv s _ (fun i _ => rfl)

/-! ## J.3 空白（並置）の表と適用の畳み -/

/-- 読む段の近似：`none` は「まだ分からない」。 -/
def Approx {K : Type v} (x : Option K) (k : K) : Prop := x = none ∨ x = some k

/-- 1つの表についての、読む段の表の健全さ。 -/
def SoundBin {K : Type v} {S : Type w} (τ : K → K → S)
    (τR : Option K → Option K → Option S) : Prop :=
  ∀ x y k₁ k₂, Approx x k₁ → Approx y k₂ → Approx (τR x y) (τ k₁ k₂)

/-- 並置から見た種類：値 A と関数 L。 -/
inductive Kd where
  | A | L
  deriving DecidableEq

/-- 隣り合う2項の読み（coproduct_spec §0.4）：構築・合成・適用・読みを持たない。 -/
inductive Step where
  | build | comp | app | noRead
  deriving DecidableEq

/-- 空白の表 τ_space：値値は構築、関数関数は合成、関数値は適用、値関数は読みを持たない（R47）。 -/
def tauSpace : Kd → Kd → Step
  | .A, .A => .build
  | .L, .L => .comp
  | .L, .A => .app
  | .A, .L => .noRead

/-- 行の畳みの動き（value_spec V3）。 -/
inductive Act where
  | push | comp | app
  deriving DecidableEq

/-- 構築と「読みを持たない」は、どちらも積む。 -/
def Step.act : Step → Act
  | .build => .push
  | .noRead => .push
  | .comp => .comp
  | .app => .app

/-- 積みの上と次の項の種類で選ぶ動き。 -/
def actSpace (a b : Kd) : Act := (tauSpace a b).act

/-- いちばん多く決める読む段の表：両側が分かる時と、上が A と分かる時だけ決める。 -/
def actBest : Option Kd → Option Kd → Option Act
  | some a, some b => some (actSpace a b)
  | some .A, none => some .push
  | _, _ => none

/-- 定理 J.3(a)：τ_space は全単射（4つの対にちょうど1つずつの読み）。 -/
theorem tauSpace_bij :
    (∀ a b c d, tauSpace a b = tauSpace c d → a = c ∧ b = d) ∧
    (∀ s, ∃ a b, tauSpace a b = s) := by
  refine ⟨?_, ?_⟩
  · intro a b c d h
    cases a <;> cases b <;> cases c <;> cases d <;> first | exact ⟨rfl, rfl⟩ | cases h
  · intro s
    cases s
    · exact ⟨.A, .A, rfl⟩
    · exact ⟨.L, .L, rfl⟩
    · exact ⟨.L, .A, rfl⟩
    · exact ⟨.A, .L, rfl⟩

private theorem typing_approx_some {K : Type v} {a k : K} (h : Approx (some a) k) : a = k := by
  rcases h with h | h
  · cases h
  · exact Option.some.inj h

/-- 定理 J.3(b)：片側でも A か L が分からなければ、健全な読む段の表は読みを決められない。 -/
theorem space_defer (τR : Option Kd → Option Kd → Option Step) (hR : SoundBin tauSpace τR)
    (x y : Option Kd) (s : Step) (h : τR x y = some s) :
    x.isSome = true ∧ y.isSome = true := by
  have key : ∀ k₁ k₂, Approx x k₁ → Approx y k₂ → s = tauSpace k₁ k₂ := by
    intro k₁ k₂ h₁ h₂
    have := hR x y k₁ k₂ h₁ h₂
    rw [h] at this
    exact typing_approx_some this
  constructor
  · cases x with
    | some _ => rfl
    | none =>
      exfalso
      have e : ∀ b, Approx y b → False := by
        intro b hb
        have h1 := key .A b (Or.inl rfl) hb
        have h2 := key .L b (Or.inl rfl) hb
        cases b <;> rw [h1] at h2 <;> cases h2
      cases y with
      | none => exact e .A (Or.inl rfl)
      | some b => exact e b (Or.inr rfl)
  · cases y with
    | some _ => rfl
    | none =>
      exfalso
      have e : ∀ a, Approx x a → False := by
        intro a ha
        have h1 := key a .A ha (Or.inl rfl)
        have h2 := key a .L ha (Or.inl rfl)
        cases a <;> rw [h1] at h2 <;> cases h2
      cases x with
      | none => exact e .A (Or.inl rfl)
      | some a => exact e a (Or.inr rfl)

/-- 定理 J.3(c)：動きで見ると、読む段が決められるのは両側が分かる時と、上が A と分かる時だけ。 -/
theorem act_defer (τR : Option Kd → Option Kd → Option Act) (hR : SoundBin actSpace τR)
    (x y : Option Kd) (s : Act) (h : τR x y = some s) :
    (x.isSome = true ∧ y.isSome = true) ∨ x = some .A := by
  have key : ∀ k₁ k₂, Approx x k₁ → Approx y k₂ → s = actSpace k₁ k₂ := by
    intro k₁ k₂ h₁ h₂
    have := hR x y k₁ k₂ h₁ h₂
    rw [h] at this
    exact typing_approx_some this
  cases x with
  | none =>
    exfalso
    have e : ∀ b, Approx y b → False := by
      intro b hb
      have h1 := key .A b (Or.inl rfl) hb
      have h2 := key .L b (Or.inl rfl) hb
      cases b <;> rw [h1] at h2 <;> cases h2
    cases y with
    | none => exact e .A (Or.inl rfl)
    | some b => exact e b (Or.inr rfl)
  | some a =>
    cases y with
    | some b => exact Or.inl ⟨rfl, rfl⟩
    | none =>
      cases a with
      | A => exact Or.inr rfl
      | L =>
        exfalso
        have h1 := key .L .A (Or.inr rfl) (Or.inl rfl)
        have h2 := key .L .L (Or.inr rfl) (Or.inl rfl)
        rw [h1] at h2
        cases h2

/-- 定理 J.3(c)：その範囲を全部決める表は健全。 -/
theorem actBest_sound : SoundBin actSpace actBest := by
  intro x y k₁ k₂ h₁ h₂
  rcases h₁ with rfl | rfl <;> rcases h₂ with rfl | rfl
  · exact Or.inl rfl
  · exact Or.inl rfl
  · cases k₁
    · cases k₂ <;> exact Or.inr rfl
    · exact Or.inl rfl
  · exact Or.inr rfl

/-- 行の項：値か関数（口1つ）。 -/
inductive Item (V : Type u) (F : Type v) : Type (max u v) where
  | val : V → Item V F
  | fn : F → Item V F

/-- 項の並置の種類。 -/
def Item.kd {V : Type u} {F : Type v} : Item V F → Kd
  | .val _ => .A
  | .fn _ => .L

/-- 畳みの1歩（value_spec V3。積みの上はリストの頭）：
上が関数で次が値なら適用、次も関数なら合成（左の関数から実行する、R11）、ほかは積む。 -/
def rowStep {V : Type u} (st : List (Item V (V → V))) (it : Item V (V → V)) :
    List (Item V (V → V)) :=
  match st, it with
  | .fn f :: s, .val x => .val (f x) :: s
  | .fn f :: s, .fn g => .fn (fun x => g (f x)) :: s
  | s, it => it :: s

/-- 行の畳み（左から）。答えは積みで、上が頭。 -/
def rowFold {V : Type u} (w : List (Item V (V → V))) : List (Item V (V → V)) :=
  w.foldl rowStep []

/-- 定理 J.3(d)：1歩の後の積みの長さは、上と次の種類で選んだ動きだけで決まる。 -/
theorem rowStep_length {V : Type u} (top : Item V (V → V)) (s : List (Item V (V → V)))
    (it : Item V (V → V)) :
    (rowStep (top :: s) it).length =
      (match actSpace top.kd it.kd with
        | .push => s.length + 2
        | _ => s.length + 1) := by
  cases top <;> cases it <;> rfl

/-- 項の値と種類の関係：値は種類を満たし、関数は種類の表 `K → K`（印ごとの実体）を満たす。 -/
def ItemSat {D : Type u} {K : Type v} (sat : D → K → Prop) :
    Item D (D → D) → Item K (K → K) → Prop
  | .val d, .val k => sat d k
  | .fn f, .fn φ => ∀ d k, sat d k → sat (f d) (φ k)
  | _, _ => False

/-- 2つのリストを項ごとに関係づける（Mathlib の `List.Forall₂` と同じ形）。 -/
inductive Rel2 {α : Type u} {β : Type v} (R : α → β → Prop) : List α → List β → Prop where
  | nil : Rel2 R [] []
  | cons {a : α} {b : β} {as : List α} {bs : List β} :
      R a b → Rel2 R as bs → Rel2 R (a :: as) (b :: bs)

-- 1歩ごとに、関係づけた積みと項は、関係づけた積みへ移る
private theorem typing_rowStep_sound {D : Type u} {K : Type v} (sat : D → K → Prop)
    (st : List (Item D (D → D))) (sk : List (Item K (K → K))) (it : Item D (D → D))
    (ik : Item K (K → K)) (hs : Rel2 (ItemSat sat) st sk) (hi : ItemSat sat it ik) :
    Rel2 (ItemSat sat) (rowStep st it) (rowStep sk ik) := by
  cases hs with
  | nil =>
    exact Rel2.cons hi Rel2.nil
  | cons hab hrest =>
    rename_i a b as bs
    cases a with
    | val d =>
      cases b with
      | val k => exact Rel2.cons hi (Rel2.cons hab hrest)
      | fn φ => exact absurd hab id
    | fn f =>
      cases b with
      | val k => exact absurd hab id
      | fn φ =>
        cases it with
        | val x =>
          cases ik with
          | val kx => exact Rel2.cons (hab x kx hi) hrest
          | fn ψ => exact absurd hi id
        | fn g =>
          cases ik with
          | val kx => exact absurd hi id
          | fn ψ =>
            exact Rel2.cons (fun d k hdk => hi _ _ (hab d k hdk)) hrest

/-- 定理 J.3(d)：関数の種類を `K → K` にした種類の畳みは、値の畳みについて健全。 -/
theorem row_sound {D : Type u} {K : Type v} (sat : D → K → Prop) (w : List (Item D (D → D)))
    (wk : List (Item K (K → K))) (h : Rel2 (ItemSat sat) w wk) :
    Rel2 (ItemSat sat) (rowFold w) (rowFold wk) := by
  unfold rowFold
  suffices H : ∀ (st : List (Item D (D → D))) (sk : List (Item K (K → K))),
      Rel2 (ItemSat sat) st sk →
        Rel2 (ItemSat sat) (w.foldl rowStep st) (wk.foldl rowStep sk) from
    H [] [] Rel2.nil
  induction h with
  | nil => intro st sk hs; exact hs
  | cons hab _ ih =>
    intro st sk hs
    exact ih _ _ (typing_rowStep_sound sat st sk _ _ hs hab)

/-- 定理 J.3(e)：`double inc 5` は 11（合成は左から実行する）。 -/
theorem row_double_inc :
    rowFold ([.fn (fun x => x * 2), .fn (fun x => x + 1), .val 5] : List (Item Nat (Nat → Nat)))
      = [.val 11] := by
  rfl

/-- 定理 J.3(e)：先頭が A か L かで、行の項の数も変わる（`inc 5` は1項、`3 5` は2項）。 -/
theorem row_shape_depends :
    (rowFold ([.fn (fun x => x + 1), .val 5] : List (Item Nat (Nat → Nat)))).length = 1 ∧
    (rowFold ([.val 3, .val 5] : List (Item Nat (Nat → Nat)))).length = 2 := by
  exact ⟨rfl, rfl⟩

/-! ## J.4 自分で種類が付く区切り -/

/-- Int の 64 bit の上端。 -/
def MAX64 : Int := 9223372036854775807

/-- Int の 64 bit の下端。 -/
def MIN64 : Int := -9223372036854775808

/-- 値の段の Int の `+`（value_spec V5）：`!_` は両側の単位、溢れは `!_`。 -/
def plusV : Option Int → Option Int → Option Int
  | none, y => y
  | some a, none => some a
  | some a, some b => if MIN64 ≤ a + b ∧ a + b ≤ MAX64 then some (a + b) else none

/-- 中置の `==`（value_spec V6）：等しければ左、ほかは `!_`。 -/
def eqO {α : Type u} [DecidableEq α] : Option α → Option α → Option α
  | some a, some b => if a = b then some a else none
  | _, _ => none

/-- 中置の `<`（value_spec V6）：成り立てば左、ほかは `!_`。 -/
def ltO : Option Int → Option Int → Option Int
  | some a, some b => if a < b then some a else none
  | _, _ => none

/-- 定理 J.4(a)（I.7(b) の系）：どの種類の付けとも交換する演算は、ちょうど 12 本の1つ。 -/
theorem self_typed_iff (op : ∀ α : Type u, Option α → Option α → Option α) :
    (∀ (V S : Type u) (κ : V → S) (a b : Option V),
      (op V a b).map κ = op S (a.map κ) (b.map κ)) ↔ ∃ c, op = (buildOp.{u} c).1 := by
  constructor
  · intro h
    obtain ⟨c, hc⟩ := natOptOp_classify ⟨op, h⟩
    exact ⟨c, congrArg Subtype.val hc⟩
  · rintro ⟨c, rfl⟩
    exact (buildOp.{u} c).2

/-- 定理 J.4(b)：`!_` を消す δ（並びの単位・`,` の単位律）は、種類を付ける前でも後でも同じ。 -/
theorem dropVoid_kind {V S : Type u} (κ : V → S) (w : List (Option V)) :
    (dropVoid w).map κ = dropVoid (w.map (Option.map κ)) := by
  induction w with
  | nil => rfl
  | cons a w ih =>
    cases a with
    | none => exact ih
    | some x => exact congrArg (κ x :: ·) ih

/-- 定理 J.4(c)：自分で種類が付く演算の答えは、左か右か `!_` で、新しい値を作らない。 -/
theorem natOp_no_new (o : NatOptOp.{u}) {α : Type u} (a b : Option α) :
    o.1 α a b = a ∨ o.1 α a b = b ∨ o.1 α a b = none := by
  obtain ⟨c, rfl⟩ := natOptOp_classify o
  rcases c with ⟨⟨_ | _ | _ | k, hk⟩, l, r⟩
  · cases a <;> cases b <;> cases l <;> cases r <;> simp [buildOp]
  · cases a <;> cases b <;> cases l <;> cases r <;> simp [buildOp]
  · cases a <;> cases b <;> cases l <;> cases r <;> simp [buildOp]
  · exact absurd hk (by omega)

/-- 定理 J.4(c)：`+` は新しい値を作り、`==`・`<` は種類を潰す付けと交換しない。 -/
theorem value_ops_not_self_typed :
    plusV (some 1) (some 2) = some 3 ∧
    (eqO (some (1 : Int)) (some 2)).map (fun _ => ()) ≠ eqO (some ()) (some ()) ∧
    (ltO (some 1) (some 2)).map (fun _ => (0 : Int)) ≠ ltO (some 0) (some 0) := by
  decide

/-- 定理 J.4(c)：`==`・`<` の答えは、いつも左か `!_`。 -/
theorem eqO_ltO_left_or_none :
    (∀ a b : Option Int, eqO a b = a ∨ eqO a b = none) ∧
    (∀ a b : Option Int, ltO a b = a ∨ ltO a b = none) := by
  refine ⟨?_, ?_⟩
  · intro a b
    cases a with
    | none => exact Or.inr rfl
    | some x =>
      cases b with
      | none => exact Or.inr rfl
      | some y =>
        show (if x = y then some x else none) = some x ∨ (if x = y then some x else none) = none
        cases Int.decEq x y with
        | isTrue h => rw [ite_eq_left h]; exact Or.inl rfl
        | isFalse h => rw [ite_eq_right h]; exact Or.inr rfl
  · intro a b
    cases a with
    | none => exact Or.inr rfl
    | some x =>
      cases b with
      | none => exact Or.inr rfl
      | some y =>
        show (if x < y then some x else none) = some x ∨ (if x < y then some x else none) = none
        cases Int.decLt x y with
        | isTrue h => rw [ite_eq_left h]; exact Or.inl rfl
        | isFalse h => rw [ite_eq_right h]; exact Or.inr rfl

/-! ## J.5 種類の違う両辺と区切り -/

/-- 左を `A₊`、右を `B₊` から取った時、座標 `c` の演算の答えがいつも左の種類。 -/
def DetLeft (c : Fin 3 × Bool × Bool) (A B : Type u) : Prop :=
  ∀ (x : Option A) (y : Option B) (v : A ⊕ B),
    (buildOp.{u} c).1 (A ⊕ B) (x.map Sum.inl) (y.map Sum.inr) = some v → v.isLeft = true

/-- 同じく、答えがいつも右の種類。 -/
def DetRight (c : Fin 3 × Bool × Bool) (A B : Type u) : Prop :=
  ∀ (x : Option A) (y : Option B) (v : A ⊕ B),
    (buildOp.{u} c).1 (A ⊕ B) (x.map Sum.inl) (y.map Sum.inr) = some v → v.isRight = true

/-- 粗く決まる座標：左の元も右の元も出る、の否定。 -/
def detB (c : Fin 3 × Bool × Bool) : Bool :=
  !((c.1.val == 1 || c.2.1) && (c.1.val == 2 || c.2.2))

/-- 12 本の座標。 -/
def allCoords : List (Fin 3 × Bool × Bool) :=
  [(0, false, false), (0, false, true), (0, true, false), (0, true, true),
   (1, false, false), (1, false, true), (1, true, false), (1, true, true),
   (2, false, false), (2, false, true), (2, true, false), (2, true, true)]

/-- 定理 J.5(a)：座標の一覧は 12 本を1回ずつ持つ。 -/
theorem allCoords_spec :
    (∀ c : Fin 3 × Bool × Bool, c ∈ allCoords) ∧ allCoords.length = 12 ∧ allCoords.Nodup := by
  refine ⟨?_, by decide, by decide⟩
  rintro ⟨⟨_ | _ | _ | k, hk⟩, l, r⟩
  rotate_left 3
  · exact absurd hk (by omega)
  all_goals cases l <;> cases r <;> unfold allCoords <;>
    repeat (first | exact List.Mem.head _ | apply List.Mem.tail)

/-- 定理 J.5(a)：答えが1つの種類に決まる座標は 7 本。 -/
theorem det_count :
    allCoords.filter detB =
      [(0, false, false), (0, false, true), (0, true, false), (1, false, false),
       (1, true, false), (2, false, false), (2, false, true)] := by
  decide

/-- 定理 J.5(a)：両辺の種類が空でなければ、答えが1つの種類に決まる ⇔ `detB`。 -/
theorem det_iff (c : Fin 3 × Bool × Bool) {A B : Type u} (a : A) (b : B) :
    (DetLeft c A B ∨ DetRight c A B) ↔ detB c = true := by
  rcases c with ⟨⟨_ | _ | _ | k, hk⟩, l, r⟩
  rotate_left 3
  · exact absurd hk (by omega)
  all_goals cases l <;> cases r
  all_goals first
    | (constructor
       · intro _; rfl
       · intro _
         first
         | (left; intro x y v hv; cases x <;> cases y <;> simp [buildOp] at hv <;> subst hv <;> rfl)
         | (right; intro x y v hv; cases x <;> cases y <;> simp [buildOp] at hv <;> subst hv <;> rfl))
    | (constructor
       · rintro (h | h)
         · first
           | exact absurd (h none (some b) (.inr b) rfl) (by simp)
           | exact absurd (h (some a) (some b) (.inr b) rfl) (by simp)
         · first
           | exact absurd (h (some a) none (.inl a) rfl) (by simp)
           | exact absurd (h (some a) (some b) (.inl a) rfl) (by simp)
       · intro h; cases h)

/-- 定理 J.5(b)：`!_` が両側の単位の演算は、自然かどうかに依らず、答えの種類が決まらない。 -/
theorem unit_not_det {A B : Type u}
    (star : Option (A ⊕ B) → Option (A ⊕ B) → Option (A ⊕ B))
    (hl : ∀ y, star none y = y) (hr : ∀ x, star x none = x) (a : A) (b : B) :
    ¬ ((∀ (x : Option A) (y : Option B) v,
          star (x.map .inl) (y.map .inr) = some v → v.isLeft = true) ∨
       (∀ (x : Option A) (y : Option B) v,
          star (x.map .inl) (y.map .inr) = some v → v.isRight = true)) := by
  rintro (h | h)
  · have := h none (some b) (.inr b) (hl _); cases this
  · have := h (some a) none (.inl a) (hr _); cases this

/-! ## J.6 二つの段：読む段の種類は値の段の近似 -/

/-- 演算子ごとの表についての、読む段の表の健全さ。 -/
def SoundTable {O : Type u} {K : Type v} (τ : O → K → K → K)
    (τR : O → Option K → Option K → Option K) : Prop :=
  ∀ o, SoundBin (τ o) (τR o)

/-- 定理 J.6(a)：表・字面・名前が健全なら、読む段の種類は値の段の種類を近似する。 -/
theorem readStage_sound {L N O : Type u} {K : Type v} (μ : L → K) (ρ : N → K)
    (τ : O → K → K → K) (μR : L → Option K) (ρR : N → Option K)
    (τR : O → Option K → Option K → Option K) (hτ : SoundTable τ τR)
    (hμ : ∀ l, Approx (μR l) (μ l)) (hρ : ∀ i, Approx (ρR i) (ρ i)) :
    ∀ t, Approx (OpTm.fold μR ρR τR t) (OpTm.fold μ ρ τ t) := by
  exact OpTm.fold_sound (fun x k => Approx x k) μR ρR τR μ ρ τ hμ hρ
    (fun o x y k₁ k₂ h₁ h₂ => hτ o x y k₁ k₂ h₁ h₂)

/-- 定理 J.6(b)：分かる組で表が正確で、葉が全部分かれば、読む段は値の段と同じ種類を言う。 -/
theorem readStage_complete {L N O : Type u} {K : Type v} (μ : L → K) (ρ : N → K)
    (τ : O → K → K → K) (μR : L → Option K) (ρR : N → Option K)
    (τR : O → Option K → Option K → Option K)
    (hτ : ∀ o k₁ k₂, τR o (some k₁) (some k₂) = some (τ o k₁ k₂))
    (hμ : ∀ l, μR l = some (μ l)) (hρ : ∀ i, ρR i = some (ρ i)) :
    ∀ t, OpTm.fold μR ρR τR t = some (OpTm.fold μ ρ τ t) := by
  intro t
  induction t with
  | lit l => exact hμ l
  | name i => exact hρ i
  | op o a b iha ihb =>
    show τR o (OpTm.fold μR ρR τR a) (OpTm.fold μR ρR τR b) =
      some (τ o (OpTm.fold μ ρ τ a) (OpTm.fold μ ρ τ b))
    rw [iha, ihb, hτ]

/-- 定理 J.6(c)：片側だけで答えを言う健全な表は、その行が定数の時に限る。 -/
theorem decided_needs_const {K : Type v} {S : Type w} (τ : K → K → S)
    (τR : Option K → Option K → Option S) (hτ : SoundBin τ τR) (z : K) (c : S)
    (h : τR (some z) none = some c) : ∀ k, τ z k = c := by
  intro k
  have := hτ (some z) none z k (Or.inr rfl) (Or.inl rfl)
  rw [h] at this
  exact (typing_approx_some this).symm

/-- 定理 J.6(c)：右だけで答えを言う健全な表も、その列が定数の時に限る。 -/
theorem decided_needs_const_right {K : Type v} {S : Type w} (τ : K → K → S)
    (τR : Option K → Option K → Option S) (hτ : SoundBin τ τR) (z : K) (c : S)
    (h : τR none (some z) = some c) : ∀ k, τ k z = c := by
  intro k
  have := hτ none (some z) k z (Or.inl rfl) (Or.inr rfl)
  rw [h] at this
  exact (typing_approx_some this).symm

/-- 定理 J.6(c)：左単位の行は、種類が2つあれば定数でない。 -/
theorem unit_row_not_const {K : Type v} (τ : K → K → K) (z : K) (hu : ∀ k, τ z k = k)
    (k₁ k₂ : K) (hne : k₁ ≠ k₂) : ¬ ∃ c, ∀ k, τ z k = c := by
  rintro ⟨c, hc⟩
  exact hne (((hu k₁).symm.trans (hc k₁)).trans ((hc k₂).symm.trans (hu k₂)))

/-- 吸収元だけを片側で答える読む段の表。 -/
def liftAbs {O : Type u} {K : Type v} (τ : O → K → K → K) (ab : O → K → Bool) :
    O → Option K → Option K → Option K
  | o, some a, some b => some (τ o a b)
  | o, some a, none => if ab o a then some a else none
  | o, none, some b => if ab o b then some b else none
  | _, none, none => none

/-- 定理 J.6(c)：両側の吸収元を片側で答える表は健全。 -/
theorem liftAbs_sound {O : Type u} {K : Type v} (τ : O → K → K → K) (ab : O → K → Bool)
    (hab : ∀ o a, ab o a = true → ∀ k, τ o a k = a ∧ τ o k a = a) :
    SoundTable τ (liftAbs τ ab) := by
  intro o x y k₁ k₂ h₁ h₂
  rcases h₁ with rfl | rfl <;> rcases h₂ with rfl | rfl
  · exact Or.inl rfl
  · show Approx (if ab o k₂ then some k₂ else none) _
    cases hb : ab o k₂
    · exact Or.inl rfl
    · exact Or.inr (congrArg some (hab o k₂ hb k₁).2.symm)
  · show Approx (if ab o k₁ then some k₁ else none) _
    cases ha : ab o k₁
    · exact Or.inl rfl
    · exact Or.inr (congrArg some (hab o k₁ ha k₂).1.symm)
  · exact Or.inr rfl

/-- 一つの段の評価：演算子の値の意味を、来た値の種類 `κ` で選ぶ。 -/
def eval1 {L N O : Type u} {D : Type v} {K : Type w} (κ : D → K) (δ : L → D) (η : N → D)
    (ev : O → K → K → D → D → D) : OpTm L N O → D
  | .lit l => δ l
  | .name i => η i
  | .op o a b => ev o (κ (eval1 κ δ η ev a)) (κ (eval1 κ δ η ev b))
      (eval1 κ δ η ev a) (eval1 κ δ η ev b)

/-- 二つの段の評価：読む段が種類を知っていればそれで、知らなければ来た値の種類で選ぶ
（coproduct_spec R62「読む段が種類を知らない被演算子…を持つ組は、値の段が来た物で決める」）。 -/
def eval2 {L N O : Type u} {D : Type v} {K : Type w} (κ : D → K) (δ : L → D) (η : N → D)
    (ev : O → K → K → D → D → D) (tyR : OpTm L N O → Option K) : OpTm L N O → D
  | .lit l => δ l
  | .name i => η i
  | .op o a b =>
    ev o ((tyR a).getD (κ (eval2 κ δ η ev tyR a))) ((tyR b).getD (κ (eval2 κ δ η ev tyR b)))
      (eval2 κ δ η ev tyR a) (eval2 κ δ η ev tyR b)

/-- 値の演算子から見て、2つの種類の札が区別できない。 -/
def KIndist {O : Type u} {D : Type v} {K : Type w} (ev : O → K → K → D → D → D)
    (k k' : K) : Prop :=
  ∀ o k₂ d₁ d₂, ev o k k₂ d₁ d₂ = ev o k' k₂ d₁ d₂ ∧ ev o k₂ k d₁ d₂ = ev o k₂ k' d₁ d₂

/-- 定理 J.6(d)：読む段が言う種類が、値の種類と値の演算子から見て区別できなければ、
二つの段の値は一つの段の値と同じ。 -/
theorem eval2_eq_eval1 {L N O : Type u} {D : Type v} {K : Type w} (κ : D → K) (δ : L → D)
    (η : N → D) (ev : O → K → K → D → D → D) (tyR : OpTm L N O → Option K)
    (hs : ∀ t k, tyR t = some k → KIndist ev k (κ (eval1 κ δ η ev t))) :
    ∀ t, eval2 κ δ η ev tyR t = eval1 κ δ η ev t := by
  intro t
  induction t with
  | lit l => rfl
  | name i => rfl
  | op o a b iha ihb =>
    show ev o ((tyR a).getD (κ (eval2 κ δ η ev tyR a))) ((tyR b).getD (κ (eval2 κ δ η ev tyR b)))
        (eval2 κ δ η ev tyR a) (eval2 κ δ η ev tyR b) =
      ev o (κ (eval1 κ δ η ev a)) (κ (eval1 κ δ η ev b)) (eval1 κ δ η ev a) (eval1 κ δ η ev b)
    rw [iha, ihb]
    have e1 : ev o ((tyR a).getD (κ (eval1 κ δ η ev a))) ((tyR b).getD (κ (eval1 κ δ η ev b)))
        (eval1 κ δ η ev a) (eval1 κ δ η ev b) =
        ev o (κ (eval1 κ δ η ev a)) ((tyR b).getD (κ (eval1 κ δ η ev b)))
        (eval1 κ δ η ev a) (eval1 κ δ η ev b) := by
      cases h : tyR a with
      | none => rfl
      | some k => exact (hs a k h o _ _ _).1
    rw [e1]
    cases h : tyR b with
    | none => rfl
    | some k => exact (hs b k h o _ _ _).2

/-- 定理 J.6(d)：とくに、読む段が言う種類がいつも値の種類なら、値は同じ。 -/
theorem eval2_eq_eval1_of_exact {L N O : Type u} {D : Type v} {K : Type w} (κ : D → K)
    (δ : L → D) (η : N → D) (ev : O → K → K → D → D → D) (tyR : OpTm L N O → Option K)
    (hs : ∀ t k, tyR t = some k → κ (eval1 κ δ η ev t) = k) :
    ∀ t, eval2 κ δ η ev tyR t = eval1 κ δ η ev t := by
  exact eval2_eq_eval1 κ δ η ev tyR (fun t k h => by
    rw [hs t k h]; intro o k₂ d₁ d₂; exact ⟨rfl, rfl⟩)

/-- 定理 J.6(e)：読む段が値と区別できる種類を言い、相手の種類を知らないか正しく知る所では、値が変わりうる。 -/
theorem eval2_ne_eval1 {L N O : Type u} {D : Type v} {K : Type w} (κ : D → K) (δ : L → D)
    (η : N → D) (ev : O → K → K → D → D → D) (tyR : OpTm L N O → Option K) (o : O)
    (t s : OpTm L N O) (k : K) (ht : tyR t = some k)
    (hs : (tyR s).getD (κ (eval1 κ δ η ev s)) = κ (eval1 κ δ η ev s))
    (et : eval2 κ δ η ev tyR t = eval1 κ δ η ev t)
    (es : eval2 κ δ η ev tyR s = eval1 κ δ η ev s)
    (hne : ev o k (κ (eval1 κ δ η ev s)) (eval1 κ δ η ev t) (eval1 κ δ η ev s) ≠
      ev o (κ (eval1 κ δ η ev t)) (κ (eval1 κ δ η ev s)) (eval1 κ δ η ev t) (eval1 κ δ η ev s)) :
    eval2 κ δ η ev tyR (.op o t s) ≠ eval1 κ δ η ev (.op o t s) := by
  show ev o ((tyR t).getD (κ (eval2 κ δ η ev tyR t))) ((tyR s).getD (κ (eval2 κ δ η ev tyR s)))
      (eval2 κ δ η ev tyR t) (eval2 κ δ η ev tyR s) ≠ _
  rw [et, es, ht, hs]
  exact hne

/-- 値の演算子から見た種類 K_val = S ⊔ {void, carried}。
void は素の `!_`（計算の `!_`・`!_` と分かる値・裸の関数の `!_`）、carried は運ばれる `!_`。 -/
inductive KVal (S : Type u) : Type u where
  | kind (s : S)
  | void
  | carried
  deriving DecidableEq

/-- 区切りが見る種類 q : K_val → S₊：void と carried を同じ `!_` に送る。 -/
def KVal.collapse {S : Type u} : KVal S → Option S
  | .kind s => some s
  | .void => none
  | .carried => none

/-- `+` の表で使う種類：Int・Address・関数の番地。 -/
inductive SK3 where
  | int | addr | fn
  deriving DecidableEq

/-- `+` の種類の表（coproduct_spec §0.4・R62、value_spec V5 からの読み）。
carried と関数の番地は吸う。void は Int の単位で、Address には吸われる。Int と Address の混ぜは carried。 -/
def plusK : KVal SK3 → KVal SK3 → KVal SK3
  | .carried, _ => .carried
  | _, .carried => .carried
  | .kind .fn, _ => .carried
  | _, .kind .fn => .carried
  | .void, .void => .void
  | .void, .kind .int => .kind .int
  | .kind .int, .void => .kind .int
  | .kind .int, .kind .int => .kind .int
  | .kind .addr, .kind .addr => .kind .addr
  | _, _ => .carried

/-- 定理 J.6(f)：区切りは void と carried を1点に潰し、`+` は2つを分ける。carried は `+` の両側の吸収元。 -/
theorem void_carried :
    KVal.collapse (KVal.void : KVal SK3) = KVal.collapse KVal.carried ∧
    plusK .void (.kind .int) = .kind .int ∧ plusK .carried (.kind .int) = .carried ∧
    plusK .void (.kind .addr) = .carried ∧
    (∀ k, plusK .carried k = .carried ∧ plusK k .carried = .carried) := by
  refine ⟨rfl, rfl, rfl, rfl, ?_⟩
  intro k; rcases k with (_ | _ | _) | _ | _ <;> exact ⟨rfl, rfl⟩

/-! ## J.7 結合の並べ替え：種類の畳みは保ち、値の畳みは保たない -/

/-- 演算子 `o` の結合の並べ替えで生成した、項の上の合同。 -/
inductive Reassoc {L N O : Type u} (o : O) : OpTm L N O → OpTm L N O → Prop where
  | step (a b c : OpTm L N O) : Reassoc o (.op o (.op o a b) c) (.op o a (.op o b c))
  | refl (t : OpTm L N O) : Reassoc o t t
  | symm {s t : OpTm L N O} : Reassoc o s t → Reassoc o t s
  | trans {s t r : OpTm L N O} : Reassoc o s t → Reassoc o t r → Reassoc o s r
  | congL (o' : O) {s t : OpTm L N O} (r : OpTm L N O) :
      Reassoc o s t → Reassoc o (.op o' s r) (.op o' t r)
  | congR (o' : O) (r : OpTm L N O) {s t : OpTm L N O} :
      Reassoc o s t → Reassoc o (.op o' r s) (.op o' r t)

/-- 定理 J.7(a)：表が結合的なら、畳みは結合の並べ替えで変わらない。 -/
theorem fold_reassoc {L N O : Type u} {K : Type v} (μ : L → K) (ρ : N → K)
    (τ : O → K → K → K) (o : O) (hassoc : ∀ x y z, τ o (τ o x y) z = τ o x (τ o y z))
    {s t : OpTm L N O} (h : Reassoc o s t) : OpTm.fold μ ρ τ s = OpTm.fold μ ρ τ t := by
  induction h with
  | step a b c => exact hassoc _ _ _
  | refl => rfl
  | symm _ ih => exact ih.symm
  | trans _ _ ih₁ ih₂ => exact ih₁.trans ih₂
  | congL o' r _ ih =>
    show τ o' _ _ = τ o' _ _
    rw [ih]
  | congR o' r _ ih =>
    show τ o' _ _ = τ o' _ _
    rw [ih]

/-- 定理 J.7(b)：`+` の種類の表は結合的で可換。 -/
theorem plusK_assoc_comm :
    (∀ x y z : KVal SK3, plusK (plusK x y) z = plusK x (plusK y z)) ∧
    (∀ x y : KVal SK3, plusK x y = plusK y x) := by
  constructor
  · intro x y z
    rcases x with (_ | _ | _) | _ | _ <;> rcases y with (_ | _ | _) | _ | _ <;>
      rcases z with (_ | _ | _) | _ | _ <;> rfl
  · intro x y
    rcases x with (_ | _ | _) | _ | _ <;> rcases y with (_ | _ | _) | _ | _ <;> rfl

/-- 定理 J.7(c)：値の段の Int の `+` は結合的でない：(MAX + 1) + 1 は 1、MAX + (1 + 1) は `!_`。 -/
theorem plusV_not_assoc :
    plusV (plusV (some MAX64) (some 1)) (some 1) = some 1 ∧
    plusV (some MAX64) (plusV (some 1) (some 1)) = none := by
  decide

/-- 定理 J.7(c)：だから値の畳みは、結合の並べ替えで変わる。 -/
theorem value_fold_not_reassoc :
    ∃ s t : OpTm Int Empty Unit, Reassoc () s t ∧
      OpTm.fold (fun n => some n) (fun e => e.elim) (fun _ => plusV) s ≠
        OpTm.fold (fun n => some n) (fun e => e.elim) (fun _ => plusV) t := by
  refine ⟨.op () (.op () (.lit MAX64) (.lit 1)) (.lit 1),
    .op () (.lit MAX64) (.op () (.lit 1) (.lit 1)), Reassoc.step _ _ _, ?_⟩
  show plusV (plusV (some MAX64) (some 1)) (some 1) ≠ plusV (some MAX64) (plusV (some 1) (some 1))
  rw [plusV_not_assoc.1, plusV_not_assoc.2]
  intro h; cases h

end SignMath
