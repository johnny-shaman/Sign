/-!
# M. 処理系から見た木と意味：出力の跡（Mathlib を使わない）

閉じた木の言語 `Prog K` を置く。`K` は計算の節の木の型。節は次の7つ。
- 出力 `emit v`
- 何もしない `skip`
- 状態を変える計算 `act f`（出力しない）
- 計算の節 `call c`（出力しない）
- 続け `seq p q`
- 状態を読む場合分け `branch b p q`
- 輪 `loop b body`

状態は自然数1つで、入力は始めの状態だけ。走りの途中で読む流れは持たない。

意味 `run ev n p s` は、燃料 n での（出力の跡, 止まった時の状態）の組。燃料が尽きるか、
計算の節の意味が `none` なら、状態は `none`。燃料を食うのは輪の周回だけ。計算の節 `call c` は、
今の燃料 n で区切った意味 `ev n c` で走り、後ろへ渡す燃料は減らさない。`ev` は抽象の引数で、
M.4(a) の Code の形と M.4(e) では `Nat.Partrec.Code.evaln` を当てる（`Machine/Code.lean`）。
跡 `trace` は組の1つ目で、止まったかは跡に入れない。いつか出力する `EventuallyEmits` は
このファイルで定める。

「末尾」は、閉じた木の全体で見た末尾で、`eraseTail` の3つの場合で決める。輪の本体の中は
末尾に数えない。

このファイルの宣言は Mathlib を使わない。どの証明も `Classical.choice` を使わない（`#print axioms` で
確かめる）。次を示す。
- M.4(a) 木が出力の節を含むか（`hasEmit`）は、構造の再帰で計算する。計算の節が、ある燃料で
  値を持てば燃料を足しても同じ値を持つなら、跡は燃料について後ろへ延びる（少ない燃料の跡が
  頭に残る。`trace_prefix_le`）。
- M.4(b) 出力の節を含まない木の跡は、どの入力・燃料でも空で、何もしない木の跡と同じ
  （`trace_noEmit_eq_skip`）。止まるかは違うことがある（輪、`noEmit_halting_differs`）。
- M.4(c) `eraseTail p` は、どの燃料と入力でも p と同じ跡（`trace_eraseTail`）。
- M.4(d) 出力の前にある、出力の節を含まない部分木で、消すと跡が変わる例を2つ示す。止まらない輪
  `spin`（`spin_not_erasable`）と、止まって出力しないが状態を変え、それを後ろの場合分けが読む計算
  （`halting_not_enough`）。
- M.5 燃料を固めた意味の形。
  - (a) `Traced X = List Nat × Option X` は、跡を保ったまま、値が無いこと（`none`）を、後ろを
    走らせずに結果まで持ち越すモナドで、モナドの律を満たす。
  - (b) 燃料を固めると、続けは、どの木でも Kleisli の合成で、何もしない木はその単位
    （`run_seq`・`run_skip`）。
  - (c) 輪は燃料を1つ下げた意味から作る（`run_loop_succ`）。燃料を固めた等しさは、続けと
    場合分けについては合同（`congr_seq_fixed`・`congr_branch_fixed`）。輪については、燃料 1 で
    合同でない例がある（`loop_not_congruence`。燃料 0 の輪は本体を見ない）。燃料ごとに全部
    等しいことは、輪についても合同（`congr_loop`）。この等しさでも、輪がその1回の展開と違う例が
    ある（`unfold_fails_fixed_fuel`。毎回 1 を出力する輪 `loopE`）。
  - (d) 跡の成分だけの等しさは、続けについて合同でない（`trace_not_congruence`）。前が値を
    持たなければ、続けの意味は前の意味と同じで、前の跡は残る（`run_seq_of_none`。例は
    `trace_kept_without_halting`）。
  - (e) 出力しない計算を入れる `silent` と、跡を捨てる `dropTrace` は、Kleisli の合成と単位を保ち、
    `dropTrace ∘ silent` は恒等。出力の節を含まない木の意味は `silent` の像に入る
    （`noEmit_factors_silent`）。
-/

namespace SignMath.Machine

/-- 定義 M.4：閉じた木。`K` は計算の節の木の型。 -/
inductive Prog (K : Type) where
  | emit (v : Nat)
  | skip
  | act (f : Nat → Nat)
  | call (c : K)
  | seq (p q : Prog K)
  | branch (b : Nat → Bool) (p q : Prog K)
  | loop (b : Nat → Bool) (body : Prog K)

/-- 定義 M.5(a)：跡を保ったまま、値が無いこと（`none`）を、後ろを走らせずに結果まで持ち越す型。 -/
abbrev Traced (X : Type) : Type := List Nat × Option X

/-- 定義 M.4：走りの結果。出力の跡と、止まった時の状態（止まらなければ `none`）。 -/
abbrev Res := Traced Nat

section Model

variable {K : Type}

/-- 定義 M.4(a)：木が出力の節を含むか（構造の再帰）。 -/
def hasEmit : Prog K → Bool
  | .emit _ => true
  | .skip => false
  | .act _ => false
  | .call _ => false
  | .seq p q => hasEmit p || hasEmit q
  | .branch _ p q => hasEmit p || hasEmit q
  | .loop _ b => hasEmit b

/-- 定義 M.4：続け。前が止まっていれば、その状態から後ろを走らせ、跡をつなぐ。 -/
def andThen (r : Res) (k : Nat → Res) : Res :=
  match r with
  | (o, none) => (o, none)
  | (o, some s) => (o ++ (k s).1, (k s).2)

variable (ev : Nat → K → Nat → Option Nat)

/-- 定義 M.4：1段の意味。`k` は燃料を1つ下げた意味で、輪の周回だけが使う。 -/
def step (n : Nat) (k : Prog K → Nat → Res) : Prog K → Nat → Res
  | .emit v, s => ([v], some s)
  | .skip, s => ([], some s)
  | .act f, s => ([], some (f s))
  | .call c, s => ([], ev n c s)
  | .seq p q, s => andThen (step n k p s) (step n k q)
  | .branch b p q, s => if b s then step n k p s else step n k q s
  | .loop b body, s => if b s then andThen (k body s) (k (.loop b body)) else ([], some s)

/-- 定義 M.4：燃料 n での意味。 -/
def run : Nat → Prog K → Nat → Res
  | 0 => step ev 0 (fun _ _ => ([], none))
  | n + 1 => step ev (n + 1) (run n)

/-- 定義 M.4：燃料 n での出力の跡。 -/
def trace (n : Nat) (p : Prog K) (s : Nat) : List Nat := (run ev n p s).1

/-- 定義 M.4(e)：いつか出力する。ある燃料で跡が空でない。 -/
def EventuallyEmits (p : Prog K) (s : Nat) : Prop := ∃ n, trace ev n p s ≠ []

/-- 燃料 0 の意味は、燃料が尽きた意味を下に置いた1段。 -/
theorem run_zero : run ev 0 = step ev 0 (fun _ _ => ([], none)) := rfl

/-- 燃料 n + 1 の意味は、燃料 n の意味を下に置いた1段。 -/
theorem run_succ (n : Nat) : run ev (n + 1) = step ev (n + 1) (run ev n) := rfl

/-- 何もしない木は、どの燃料でも出力せずに止まる。 -/
theorem run_skip_eq (n s : Nat) : run ev n (.skip : Prog K) s = ([], some s) := by
  cases n <;> rfl

/-- 出力の節は、どの燃料でも1つ出力して止まる。 -/
theorem run_emit_eq (n v s : Nat) : run ev n (.emit v : Prog K) s = ([v], some s) := by
  cases n <;> rfl

/-- 場合分けは、どの燃料でも、条件で選んだ枝の意味。 -/
theorem run_branch (n : Nat) (b : Nat → Bool) (p q : Prog K) (s : Nat) :
    run ev n (.branch b p q) s = if b s then run ev n p s else run ev n q s := by
  cases n <;> rfl

end Model

/-! ## M.4(a) 跡は燃料について後ろへ延びる -/

section Extend

variable {K : Type} (ev : Nat → K → Nat → Option Nat)

/-- `r'` は `r` を延ばした物：止まっていれば同じ、止まっていなければ跡が後ろへ延びる。 -/
def Ext (r r' : Res) : Prop :=
  match r.2 with
  | some _ => r' = r
  | none => ∃ t, r'.1 = r.1 ++ t

/-- 延ばした物の跡は、もとの跡を頭に持つ。 -/
theorem ext_prefix {r r' : Res} (h : Ext r r') : ∃ t, r'.1 = r.1 ++ t := by
  rcases r with ⟨o, _ | s⟩
  · exact h
  · have h' : r' = (o, some s) := h
    exact ⟨[], by rw [h', List.append_nil]⟩

/-- 続けは、延ばすことを保つ。 -/
theorem ext_andThen {r r' : Res} {k k' : Nat → Res} (h : Ext r r')
    (hk : ∀ s, Ext (k s) (k' s)) : Ext (andThen r k) (andThen r' k') := by
  rcases r with ⟨o, _ | s⟩
  · obtain ⟨t, ht⟩ := h
    show ∃ t, (andThen r' k').1 = o ++ t
    rcases r' with ⟨o', _ | s'⟩
    · exact ⟨t, ht⟩
    · exact ⟨t ++ (k' s').1, by simp only [andThen] at ht ⊢; rw [ht, List.append_assoc]⟩
  · have h' : r' = (o, some s) := h
    subst h'
    have hks := hk s
    simp only [andThen]
    unfold Ext at hks ⊢
    rcases hk2 : (k s).2 with _ | v
    · rw [hk2] at hks
      obtain ⟨t, ht⟩ := hks
      exact ⟨t, by simp only; rw [ht, List.append_assoc]⟩
    · rw [hk2] at hks
      simp only
      rw [hks, hk2]

/-- 計算の節が、ある燃料で値を持てば燃料を足しても同じ値を持ち、下の意味が延びるなら、1段の意味も
延びる。 -/
theorem step_ext (hev : ∀ n c s v, ev n c s = some v → ev (n + 1) c s = some v)
    (n : Nat) (k k' : Prog K → Nat → Res) (hk : ∀ p s, Ext (k p s) (k' p s)) :
    ∀ p s, Ext (step ev n k p s) (step ev (n + 1) k' p s) := by
  intro p
  induction p with
  | emit v => intro s; rfl
  | skip => intro s; rfl
  | act f => intro s; rfl
  | call c =>
      intro s
      show Ext ([], ev n c s) ([], ev (n + 1) c s)
      unfold Ext
      rcases h : ev n c s with _ | v
      · exact ⟨[], rfl⟩
      · rw [hev n c s v h]
  | seq p q ihp ihq => intro s; exact ext_andThen (ihp s) ihq
  | branch b p q ihp ihq =>
      intro s; simp only [step]; cases b s
      · exact ihq s
      · exact ihp s
  | loop b body _ =>
      intro s; simp only [step]; cases b s
      · rfl
      · exact ext_andThen (hk body s) (hk _)

/-- 同じ仮定の下で、燃料を1つ足した意味は、もとの意味を延ばした物。 -/
theorem run_ext (hev : ∀ n c s v, ev n c s = some v → ev (n + 1) c s = some v) :
    ∀ n p s, Ext (run ev n p s) (run ev (n + 1) p s) := by
  intro n
  induction n with
  | zero => exact step_ext ev hev 0 _ _ (fun _ _ => ⟨_, rfl⟩)
  | succ n ih => exact step_ext ev hev (n + 1) _ _ ih

/-- 定理 M.4(a)：計算の節が、ある燃料で値を持てば燃料を足しても同じ値を持つなら、
燃料を1つ足した跡は、もとの跡を頭に持つ。 -/
theorem trace_prefix (hev : ∀ n c s v, ev n c s = some v → ev (n + 1) c s = some v)
    (n : Nat) (p : Prog K) (s : Nat) : ∃ t, trace ev (n + 1) p s = trace ev n p s ++ t :=
  ext_prefix (run_ext ev hev n p s)

/-- 定理 M.4(a)：計算の節が、ある燃料で値を持てば燃料を足しても同じ値を持つなら、
多い燃料の跡は、少ない燃料の跡を頭に持つ。 -/
theorem trace_prefix_le (hev : ∀ n c s v, ev n c s = some v → ev (n + 1) c s = some v)
    {n m : Nat} (h : n ≤ m) (p : Prog K) (s : Nat) :
    ∃ t, trace ev m p s = trace ev n p s ++ t := by
  induction h with
  | refl => exact ⟨[], (List.append_nil _).symm⟩
  | step _ ih =>
      obtain ⟨t, ht⟩ := ih
      obtain ⟨u, hu⟩ := trace_prefix ev hev _ p s
      exact ⟨t ++ u, by rw [hu, ht, List.append_assoc]⟩

end Extend

/-! ## M.4(b) 出力の節を含まない木の跡は空 -/

section NoEmit

variable {K : Type} (ev : Nat → K → Nat → Option Nat)

/-- 前と後ろの跡が空なら、続けの跡も空。 -/
theorem andThen_nil {r : Res} {k : Nat → Res} (h1 : r.1 = []) (h2 : ∀ s, (k s).1 = []) :
    (andThen r k).1 = [] := by
  rcases r with ⟨o, _ | s⟩
  · exact h1
  · simp only [andThen] at h1 ⊢
    rw [h1, h2]; rfl

/-- 下の意味が、出力の節を含まない木で空の跡なら、1段の意味もそう。 -/
theorem step_noEmit (n : Nat) (k : Prog K → Nat → Res)
    (hk : ∀ p s, hasEmit p = false → (k p s).1 = []) :
    ∀ p s, hasEmit p = false → (step ev n k p s).1 = [] := by
  intro p
  induction p with
  | emit v => intro s h; simp [hasEmit] at h
  | skip => intro s _; rfl
  | act f => intro s _; rfl
  | call c => intro s _; rfl
  | seq p q ihp ihq =>
      intro s h
      simp only [hasEmit, Bool.or_eq_false_iff] at h
      exact andThen_nil (ihp s h.1) (fun s => ihq s h.2)
  | branch b p q ihp ihq =>
      intro s h
      simp only [hasEmit, Bool.or_eq_false_iff] at h
      simp only [step]
      split
      · exact ihp s h.1
      · exact ihq s h.2
  | loop b body _ =>
      intro s h
      simp only [step]
      split
      · exact andThen_nil (hk body s h) (fun s => hk _ s h)
      · rfl

/-- 定理 M.4(b)：出力の節を含まない木の跡は、どの入力・燃料でも空。 -/
theorem trace_noEmit : ∀ n (p : Prog K) s, hasEmit p = false → trace ev n p s = [] := by
  intro n
  induction n with
  | zero => exact step_noEmit ev 0 _ (fun _ _ _ => rfl)
  | succ n ih => exact step_noEmit ev (n + 1) (run ev n) ih

/-- 定理 M.4(b)：出力の節を含まない木の跡は、何もしない木の跡と同じ。 -/
theorem trace_noEmit_eq_skip (n : Nat) (p : Prog K) (s : Nat) (h : hasEmit p = false) :
    trace ev n p s = trace ev n .skip s := by
  rw [trace_noEmit ev n p s h]; cases n <;> rfl

/-- 定義 M.4(b)：本体が何もしない木の、止まらない輪 `spin`。 -/
def spin : Prog K := .loop (fun _ => true) .skip

/-- `spin` は、どの燃料でも出力せず、止まらない。 -/
theorem run_spin : ∀ n s, run ev n (spin : Prog K) s = ([], none) := by
  intro n
  induction n with
  | zero => intro s; rfl
  | succ n ih =>
      intro s
      show andThen (run ev n .skip s) (run ev n spin) = ([], none)
      rw [run_skip_eq]; simp [andThen, ih]

/-- 定理 M.4(b)：止まるかは違うことがある。`spin` は出力の節を含まず止まらないが、何もしない木は
止まる。 -/
theorem noEmit_halting_differs :
    hasEmit (spin : Prog K) = false ∧
      ∀ n s, (run ev n (spin : Prog K) s).2 = none ∧ (run ev n (.skip : Prog K) s).2 = some s :=
  ⟨rfl, fun n s => ⟨by rw [run_spin], by rw [run_skip_eq]⟩⟩

end NoEmit

/-! ## M.4(c) 末尾の、出力の節を含まない部分木は消してよい -/

section EraseTail

variable {K : Type} (ev : Nat → K → Nat → Option Nat)

/-- 定義 M.4(c)：末尾の位置にある、出力の節を含まない部分木を、落とすか何もしない木に替える
（場合分けは節を残し、枝ごとに替える）。末尾は次の3つの場合で決める。続けでは後ろが末尾で、後ろが出力の節を含まなければ、後ろを落として
前を末尾にする。場合分けでは、節を残して両方の枝を末尾にする。ほかの節は、出力の節を含まなければ
何もしない木に替える。 -/
def eraseTail : Prog K → Prog K
  | .seq p q => if hasEmit q then .seq p (eraseTail q) else eraseTail p
  | .branch b p q => .branch b (eraseTail p) (eraseTail q)
  | p => if hasEmit p then p else .skip

/-- 燃料 n の意味は、出力の節を含まない木で空の跡を返す下の意味を持つ1段。 -/
theorem run_eq_step (n : Nat) : ∃ k, run ev n = step ev n k ∧
    ∀ (p : Prog K) s, hasEmit p = false → (k p s).1 = [] := by
  cases n with
  | zero => exact ⟨_, rfl, fun _ _ _ => rfl⟩
  | succ n => exact ⟨run ev n, rfl, trace_noEmit ev n⟩

/-- 定理 M.4(c)：`eraseTail p` は、どの燃料と入力でも p と同じ跡。 -/
theorem trace_eraseTail (n : Nat) :
    ∀ (p : Prog K) s, trace ev n (eraseTail p) s = trace ev n p s := by
  obtain ⟨k, hk, hk0⟩ := run_eq_step ev n
  have hskip : ∀ (p : Prog K) s, hasEmit p = false →
      (step ev n k p s).1 = (step ev n k .skip s).1 := by
    intro p s h; rw [step_noEmit ev n k hk0 p s h]; rfl
  unfold trace; rw [hk]
  intro p
  induction p with
  | seq p q ihp ihq =>
      intro s
      by_cases hq : hasEmit q = true
      · simp only [eraseTail, hq, ↓reduceIte, step]
        rcases hr : step ev n k p s with ⟨o, _ | s'⟩
        · rfl
        · simp only [andThen]; rw [ihq]
      · have hq' : hasEmit q = false := by simpa using hq
        simp only [eraseTail, hq', Bool.false_eq_true, ↓reduceIte]
        rw [ihp]
        show (step ev n k p s).1 = (andThen (step ev n k p s) (step ev n k q)).1
        rcases hr : step ev n k p s with ⟨o, _ | s'⟩
        · rfl
        · simp only [andThen]; rw [step_noEmit ev n k hk0 q s' hq']; simp
  | branch b p q ihp ihq =>
      intro s
      simp only [eraseTail, step]
      split
      · exact ihp s
      · exact ihq s
  | emit v => intro s; rfl
  | skip => intro s; simp [eraseTail, hasEmit]
  | act f => intro s; simp only [eraseTail, hasEmit]; rfl
  | call c => intro s; simp only [eraseTail, hasEmit]; rfl
  | loop b body _ =>
      intro s
      by_cases hb : hasEmit body = true
      · simp [eraseTail, hasEmit, hb]
      · have hb' : hasEmit body = false := by simpa using hb
        simp only [eraseTail, hasEmit, hb', Bool.false_eq_true, ↓reduceIte]
        exact (hskip (.loop b body) s hb').symm

end EraseTail

/-! ## M.4(d) 出力の前の、出力の節を含まない部分木は、消すと跡が変わることがある -/

section Before

variable {K : Type} (ev : Nat → K → Nat → Option Nat)

/-- `spin` の後ろの `emit 1` は、どの燃料でも出ない。 -/
theorem spin_blocks (n s : Nat) : trace ev n (.seq spin (.emit 1) : Prog K) s = [] := by
  cases n with
  | zero => rfl
  | succ n =>
      show (andThen (run ev (n + 1) spin s) (run ev (n + 1) (.emit 1))).1 = []
      rw [run_spin]; rfl

/-- `emit 1` の跡は、どの燃料でも `[1]`。 -/
theorem emit_one (n s : Nat) : trace ev n (.emit 1 : Prog K) s = [1] := by
  cases n <;> rfl

/-- 定理 M.4(d)：1つ目の例。`spin` は出力の節を含まないが、後ろの `emit 1` の前から消すと、
どの燃料でも跡が変わる。 -/
theorem spin_not_erasable :
    hasEmit (spin : Prog K) = false ∧
      (∀ n s, trace ev n (.seq spin (.emit 1) : Prog K) s = []) ∧
      (∀ n s, trace ev n (.emit 1 : Prog K) s = [1]) :=
  ⟨rfl, spin_blocks ev, emit_one ev⟩

/-- 定義 M.4(d)：状態を1つ進める計算（出力しない）。 -/
def bump : Prog K := .act (· + 1)

/-- 定義 M.4(d)：状態が 0 の時だけ 1 を出力する場合分け。 -/
def emitIfZero : Prog K := .branch (fun s => s == 0) (.emit 1) .skip

/-- 定理 M.4(d)：2つ目の例。止まって出力しない計算 `bump` の変えた状態を、後ろの場合分けが読む。
状態 0 から、`bump` を消すと、どの燃料でも跡が変わる。 -/
theorem halting_not_enough :
    hasEmit (bump : Prog K) = false ∧ (∀ n s, (run ev n (bump : Prog K) s).2 = some (s + 1)) ∧
      (∀ n, trace ev n (.seq bump emitIfZero : Prog K) 0 = []) ∧
      (∀ n, trace ev n (emitIfZero : Prog K) 0 = [1]) :=
  ⟨rfl, fun n s => by cases n <;> rfl, fun n => by cases n <;> rfl, fun n => by cases n <;> rfl⟩

end Before

/-! ## M.5 燃料を固めた意味の形 -/

section Kleisli

namespace Traced

/-- 定義 M.5(a)：値を1つ、跡なしで返す。 -/
protected def ret {X : Type} (x : X) : Traced X := ([], some x)

/-- 定義 M.5(a)：前に値があれば後ろを走らせ、跡をつなぐ。前に値が無ければ、後ろを走らせず、跡と
`none` をそのまま返す。 -/
protected def bind {X Y : Type} (r : Traced X) (k : X → Traced Y) : Traced Y :=
  match r with
  | (o, none) => (o, none)
  | (o, some x) => (o ++ (k x).1, (k x).2)

/-- 定理 M.5(a)：左の単位律。 -/
theorem bind_ret_left {X Y : Type} (x : X) (k : X → Traced Y) :
    Traced.bind (Traced.ret x) k = k x := by
  simp [Traced.bind, Traced.ret]

/-- 定理 M.5(a)：右の単位律。 -/
theorem bind_ret_right {X : Type} (r : Traced X) : Traced.bind r Traced.ret = r := by
  rcases r with ⟨o, _ | x⟩ <;> simp [Traced.bind, Traced.ret]

/-- 定理 M.5(a)：結合律。 -/
protected theorem bind_assoc {X Y Z : Type} (r : Traced X) (f : X → Traced Y) (g : Y → Traced Z) :
    Traced.bind (Traced.bind r f) g = Traced.bind r (fun x => Traced.bind (f x) g) := by
  rcases r with ⟨o, _ | x⟩
  · rfl
  · cases hf : f x with
    | mk o' r' =>
      cases r' with
      | none => simp [Traced.bind, hf]
      | some y => simp [Traced.bind, hf, List.append_assoc]

/-- 定義 M.5(a)：Kleisli の合成（図の順：f の後に g）。 -/
protected def kcomp {X Y Z : Type} (f : X → Traced Y) (g : Y → Traced Z) : X → Traced Z :=
  fun x => Traced.bind (f x) g

/-- 定理 M.5(a)：Kleisli の合成の結合律。 -/
theorem kcomp_assoc {W X Y Z : Type} (f : W → Traced X) (g : X → Traced Y) (h : Y → Traced Z) :
    Traced.kcomp (Traced.kcomp f g) h = Traced.kcomp f (Traced.kcomp g h) :=
  funext fun w => Traced.bind_assoc (f w) g h

/-- 定理 M.5(a)：Kleisli の合成の左の単位律。 -/
theorem kcomp_ret_left {X Y : Type} (f : X → Traced Y) : Traced.kcomp Traced.ret f = f :=
  funext fun x => bind_ret_left x f

/-- 定理 M.5(a)：Kleisli の合成の右の単位律。 -/
theorem kcomp_ret_right {X Y : Type} (f : X → Traced Y) : Traced.kcomp f Traced.ret = f :=
  funext fun x => bind_ret_right (f x)

end Traced

/-- 続け `andThen` は、`Traced` の bind と同じ。 -/
theorem andThen_eq_bind (r : Res) (k : Nat → Res) : andThen r k = Traced.bind r k := by
  rcases r with ⟨o, _ | s⟩ <;> rfl

variable {K : Type} (ev : Nat → K → Nat → Option Nat)

/-- 定理 M.5(b)：燃料を固めると、続けは、どの木でも Kleisli の合成。 -/
theorem run_seq (n : Nat) (p q : Prog K) :
    run ev n (.seq p q) = Traced.kcomp (run ev n p) (run ev n q) := by
  funext s; cases n <;> exact andThen_eq_bind _ _

/-- 定理 M.5(b)：燃料を固めると、何もしない木は Kleisli の単位。 -/
theorem run_skip (n : Nat) : run ev n (.skip : Prog K) = Traced.ret := by
  funext s; cases n <;> rfl

/-- 燃料を固めると、続けは結合的。 -/
theorem run_seq_assoc (n : Nat) (p q r : Prog K) :
    run ev n (.seq (.seq p q) r) = run ev n (.seq p (.seq q r)) := by
  simp only [run_seq, Traced.kcomp_assoc]

/-- 燃料を固めると、前の何もしない木は落とせる。 -/
theorem run_seq_skip_left (n : Nat) (p : Prog K) : run ev n (.seq .skip p) = run ev n p := by
  rw [run_seq, run_skip, Traced.kcomp_ret_left]

/-- 燃料を固めると、後ろの何もしない木は落とせる。 -/
theorem run_seq_skip_right (n : Nat) (p : Prog K) : run ev n (.seq p .skip) = run ev n p := by
  rw [run_seq, run_skip, Traced.kcomp_ret_right]

/-- 定理 M.5(c)：輪は燃料を1つ下げた意味から作る。 -/
theorem run_loop_succ (n : Nat) (b : Nat → Bool) (body : Prog K) (s : Nat) :
    run ev (n + 1) (.loop b body) s =
      if b s then Traced.kcomp (run ev n body) (run ev n (.loop b body)) s
      else Traced.ret s := by
  show (if b s then andThen (run ev n body s) (run ev n (.loop b body)) else ([], some s)) = _
  rw [andThen_eq_bind]; rfl

/-- 定理 M.5(c)：燃料を固めた等しさは、続けについて合同。 -/
theorem congr_seq_fixed (n : Nat) {p p' q q' : Prog K} (hp : run ev n p = run ev n p')
    (hq : run ev n q = run ev n q') : run ev n (.seq p q) = run ev n (.seq p' q') := by
  rw [run_seq, run_seq, hp, hq]

/-- 定理 M.5(c)：燃料を固めた等しさは、場合分けについて合同。 -/
theorem congr_branch_fixed (n : Nat) (b : Nat → Bool) {p p' q q' : Prog K}
    (hp : run ev n p = run ev n p') (hq : run ev n q = run ev n q') :
    run ev n (.branch b p q) = run ev n (.branch b p' q') := by
  funext s; rw [run_branch, run_branch, hp, hq]

/-- 定理 M.5(c)：燃料ごとに全部等しい本体は、輪の中でも燃料ごとに全部等しい。 -/
theorem congr_loop (b : Nat → Bool) {body body' : Prog K}
    (h : ∀ n, run ev n body = run ev n body') :
    ∀ n, run ev n (.loop b body) = run ev n (.loop b body') := by
  intro n
  induction n with
  | zero => rfl
  | succ n ih =>
      funext s
      rw [run_loop_succ, run_loop_succ, h n, ih]

/-- 定義 M.5(c)：毎回 1 を出力する、止まらない輪。 -/
def loopE : Prog K := .loop (fun _ => true) (.emit 1)

/-- 定理 M.5(c)：燃料 1 では、毎回 1 を出力する輪 `loopE` と、その1回の展開が、状態 0 から違う。 -/
theorem unfold_fails_fixed_fuel :
    run ev 1 (loopE : Prog K) 0 = ([1], none) ∧
    run ev 1 (.branch (fun _ => true) (.seq (.emit 1) loopE) .skip : Prog K) 0 =
      ([1, 1], none) :=
  ⟨rfl, rfl⟩

/-- 定義 M.5(c)：状態 0 を 1 にし、ほかはそのままにする計算。 -/
def p0 : Prog K := .act (fun s => bif s == 0 then 1 else s)

/-- 定義 M.5(c)：状態が 0 の間、状態を1つ進める輪。 -/
def p1 : Prog K := .loop (fun s => s == 0) (.act (· + 1))

/-- `p0` と `p1` は燃料 1 で同じ意味。 -/
theorem same_at_fuel_one : run ev 1 (p0 : Prog K) = run ev 1 p1 := by
  funext s
  cases s with
  | zero => rfl
  | succ s => rfl

/-- 定理 M.5(c)：燃料 1 で等しいのに、燃料 1 の輪の中で違う2つの本体 `p0`・`p1` がある。燃料 1 で
固めた等しさは、輪について合同でない。 -/
theorem loop_not_congruence :
    run ev 1 (p0 : Prog K) = run ev 1 p1 ∧
    run ev 1 (.loop (fun s => s == 0) p0 : Prog K) 0 = ([], some 1) ∧
    run ev 1 (.loop (fun s => s == 0) p1 : Prog K) 0 = ([], none) :=
  ⟨same_at_fuel_one ev, rfl, rfl⟩

/-- 定理 M.5(d)：跡の成分だけの等しさは、続けについて合同でない。`bump` と何もしない木は
どの燃料でも同じ跡だが、後ろに `emitIfZero` を続けると、状態 0 から、どの燃料でも跡が違う。 -/
theorem trace_not_congruence :
    (∀ n s, trace ev n (bump : Prog K) s = trace ev n .skip s) ∧
    (∀ n, trace ev n (.seq bump emitIfZero : Prog K) 0 = []) ∧
    (∀ n, trace ev n (.seq .skip emitIfZero : Prog K) 0 = [1]) :=
  ⟨fun n s => by cases n <;> rfl, fun n => by cases n <;> rfl, fun n => by cases n <;> rfl⟩

/-- 定理 M.5(d)：前が値を持たなければ、続けの意味は前の意味と同じ。止まらなくても、前の跡は残る
（跡は組の1つ目に置く）。 -/
theorem run_seq_of_none (n : Nat) (p q : Prog K) (s : Nat) (h : (run ev n p s).2 = none) :
    run ev n (.seq p q) s = run ev n p s := by
  rw [run_seq]
  show Traced.bind (run ev n p s) (run ev n q) = run ev n p s
  rcases hr : run ev n p s with ⟨o, _ | x⟩
  · rfl
  · rw [hr] at h; cases h

/-- 定理 M.5(d)：例。`emit 1` の後に `spin` を続けると、燃料 1 で止まらないが、前の跡 `[1]` は
残る。 -/
theorem trace_kept_without_halting :
    run ev 1 (.seq (.emit 1) spin : Prog K) 0 = ([1], none) := rfl

/-- 定義 M.5(e)：出力しない部分の計算の Kleisli の合成（`Row.lean` の `kc` と同じ式）。 -/
def optKcomp {X Y Z : Type} (f : X → Option Y) (g : Y → Option Z) : X → Option Z :=
  fun x => (f x).bind g

/-- 定義 M.5(e)：出力しない計算を、跡なしで入れる。 -/
def silent {X Y : Type} (f : X → Option Y) : X → Traced Y := fun x => ([], f x)

/-- 定義 M.5(e)：跡を捨てる。 -/
def dropTrace {X Y : Type} (f : X → Traced Y) : X → Option Y := fun x => (f x).2

/-- 定理 M.5(e)：`silent` は Kleisli の合成を保つ。 -/
theorem silent_comp {X Y Z : Type} (f : X → Option Y) (g : Y → Option Z) :
    silent (optKcomp f g) = Traced.kcomp (silent f) (silent g) := by
  funext x
  cases h : f x <;> simp [silent, optKcomp, Traced.kcomp, Traced.bind, h]

/-- 定理 M.5(e)：`silent` は Kleisli の単位を保つ。 -/
theorem silent_id {X : Type} : silent (X := X) some = Traced.ret := rfl

/-- 定理 M.5(e)：`dropTrace` は Kleisli の合成を保つ。 -/
theorem dropTrace_comp {X Y Z : Type} (f : X → Traced Y) (g : Y → Traced Z) :
    dropTrace (Traced.kcomp f g) = optKcomp (dropTrace f) (dropTrace g) := by
  funext x
  cases h : f x with
  | mk o r =>
    cases r <;> simp [dropTrace, Traced.kcomp, optKcomp, Traced.bind, h]

/-- 定理 M.5(e)：`dropTrace` は Kleisli の単位を保つ。 -/
theorem dropTrace_id {X : Type} : dropTrace (Traced.ret (X := X)) = some := rfl

/-- 定理 M.5(e)：`dropTrace ∘ silent` は恒等。 -/
theorem dropTrace_silent {X Y : Type} (f : X → Option Y) : dropTrace (silent f) = f := rfl

/-- 定理 M.5(e)：出力の節を含まない木の意味は、`silent` の像に入る。 -/
theorem noEmit_factors_silent (n : Nat) (p : Prog K) (h : hasEmit p = false) :
    run ev n p = silent (dropTrace (run ev n p)) := by
  funext s
  exact Prod.ext (trace_noEmit ev n p s h) rfl

end Kleisli

end SignMath.Machine
