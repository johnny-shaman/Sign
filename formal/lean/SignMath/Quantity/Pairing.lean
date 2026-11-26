import Mathlib.LinearAlgebra.DirectSum.Finsupp
import Mathlib.Data.Finsupp.Weight
import Mathlib.Logic.Equiv.Fin.Basic

/-!
# L. 計算の量の像（その3：データの対は ⊗、一緒に見る演算は ⊕ から書けない）

量の側の模型は、A 節と同じ自由可換モノイド `A →₀ ℕ` である。
集合 `A` の点 `a` は `single a 1` に行く。
データの対（直積 `A × B`）の像は、像どうしのテンソル積 `(A →₀ ℕ) ⊗[ℕ] (B →₀ ℕ)` である。
直積の像から、像どうしの直積（双積 ⊕）への比べの写像は、一般には単射でも全射でもない。
`Bool` どうしでは、どちらも破れる。
2つの値を一緒に見る演算 `op : A → B → C` を、⊕ からの加法的な写像で書くと、長方形の律が要る。
論理積と、点を持つ型の上のリストの連結は、この律を破る。
どの `op` も、⊗ からの線形写像としては書ける。
形の決まったリストの連結は、⊗ から像への同型である。
長さの決まらないリストの連結は、⊗ から書けるが、点を持つ型の上では単射でない。
リストを要素ごとの区画に並べて持つ形（区画の双積）では、形の決まった連結は区画を並べ直すだけの
加法的な同型である。長さの決まらない連結は、この形でも ⊕ からの加法的な写像で書けない。
-/

namespace SignMath.Quantity

open TensorProduct Finsupp

universe u v w

section Pairing

/-- 定義 L.5a：データの対の量の像。`A × B →₀ ℕ` から `(A →₀ ℕ) ⊗[ℕ] (B →₀ ℕ)` への
`ℕ` 線形同型である。Mathlib の `finsuppTensorFinsupp'` の逆として取る。 -/
noncomputable def pairTensor (A : Type u) (B : Type v) :
    (A × B →₀ ℕ) ≃ₗ[ℕ] (A →₀ ℕ) ⊗[ℕ] (B →₀ ℕ) :=
  (finsuppTensorFinsupp' ℕ A B).symm

/-- 定理 L.5a（データの対は ⊗ へ）：`pairTensor` は対の点 `single (a, b) 1` を
`single a 1 ⊗ₜ single b 1` へ送る。 -/
theorem pairTensor_single {A : Type u} {B : Type v} (a : A) (b : B) :
    pairTensor A B (single (a, b) 1) = single a 1 ⊗ₜ[ℕ] single b 1 :=
  finsuppTensorFinsupp'_symm_single_eq_single_one_tmul ℕ A B (a, b) 1

/-- 定義 L.5b：直積の像から、像どうしの直積（双積）への比べの写像。
`v` を `(mapDomain Prod.fst v, mapDomain Prod.snd v)` へ送る。 -/
noncomputable def pairCompare (A : Type u) (B : Type v) :
    (A × B →₀ ℕ) →+ (A →₀ ℕ) × (B →₀ ℕ) :=
  (mapDomain.addMonoidHom Prod.fst).prod (mapDomain.addMonoidHom Prod.snd)

theorem pairCompare_apply {A : Type u} {B : Type v} (v : A × B →₀ ℕ) :
    pairCompare A B v = (mapDomain Prod.fst v, mapDomain Prod.snd v) :=
  rfl

/-- 定理 L.5b（比べは単射でない、一般形）：`a ≠ a'` かつ `b ≠ b'` なら、`pairCompare A B` は単射でない。
`(a, b)` と `(a', b')` の点の和と、`(a, b')` と `(a', b)` の点の和は、同じ像を持つ。 -/
theorem pairCompare_not_injective_of_ne {A : Type u} {B : Type v} {a a' : A} (ha : a ≠ a')
    {b b' : B} (hb : b ≠ b') : ¬ Function.Injective (pairCompare A B) := by
  intro h
  have key : pairCompare A B (single (a, b) 1 + single (a', b') 1) =
      pairCompare A B (single (a, b') 1 + single (a', b) 1) := by
    simp only [map_add, pairCompare_apply, mapDomain_single, Prod.mk_add_mk]
    exact Prod.ext rfl (add_comm _ _)
  have e := congrArg (fun v => v (a, b)) (h key)
  simp [ha.symm, hb.symm] at e

/-- 定理 L.5b（比べは単射でない）：`pairCompare Bool Bool` は単射でない。 -/
theorem pairCompare_not_injective : ¬ Function.Injective (pairCompare Bool Bool) :=
  pairCompare_not_injective_of_ne (a := true) (a' := false) (by decide)
    (b := true) (b' := false) (by decide)

/-- 定理 L.5b（比べは全射でない、一般形）：`A` に点 `a` があれば、`pairCompare A B` は全射でない。
`mapDomain` は重みの総和を保つ。だから `(single a 1, 0)` は像に無い。 -/
theorem pairCompare_not_surjective_of {A : Type u} (B : Type v) (a : A) :
    ¬ Function.Surjective (pairCompare A B) := by
  intro h
  obtain ⟨v, hv⟩ := h (single a 1, 0)
  have h1 := congrArg (fun p => degree p.1) hv
  have h2 := congrArg (fun p => degree p.2) hv
  simp only [pairCompare_apply, degree_mapDomain, degree_single, map_zero] at h1 h2
  exact one_ne_zero (h1.symm.trans h2)

/-- 定理 L.5b（比べは全射でない）：`pairCompare Bool Bool` は全射でない。 -/
theorem pairCompare_not_surjective : ¬ Function.Surjective (pairCompare Bool Bool) :=
  pairCompare_not_surjective_of Bool true

end Pairing

section Joint

/-- 定理 L.6a（長方形の律）：⊕ からの加法的な写像 `L` が、点の対 `(single a 1, single b 1)` を
`single (op a b) 1` へ送るとする。
すると、どの `a a' b b'` でも、`op a b` と `op a' b'` の点の和は、`op a b'` と `op a' b` の点の和に等しい。 -/
theorem rectangle_law {A : Type u} {B : Type v} {C : Type w} {op : A → B → C}
    {L : ((A →₀ ℕ) × (B →₀ ℕ)) →+ (C →₀ ℕ)}
    (hL : ∀ a b, L (single a 1, single b 1) = single (op a b) 1) (a a' : A) (b b' : B) :
    single (op a b) 1 + single (op a' b') 1 = single (op a b') 1 + single (op a' b) 1 := by
  have key : ((single a 1, single b 1) : (A →₀ ℕ) × (B →₀ ℕ)) + (single a' 1, single b' 1) =
      (single a 1, single b' 1) + (single a' 1, single b 1) := by
    simp only [Prod.mk_add_mk]
    exact Prod.ext rfl (add_comm _ _)
  have e := congrArg L key
  rwa [map_add, map_add, hL, hL, hL, hL] at e

/-- 定理 L.6b（論理積は ⊕ から書けない）：⊕ からの加法的な写像 `L` で、どの `a b : Bool` でも
`(single a 1, single b 1)` を `single (a && b) 1` へ送るものは無い。
長方形の律を `a = b = true`、`a' = b' = false` で破る。 -/
theorem and_not_additive :
    ¬ ∃ L : ((Bool →₀ ℕ) × (Bool →₀ ℕ)) →+ (Bool →₀ ℕ),
      ∀ a b, L (single a 1, single b 1) = single (a && b) 1 := by
  rintro ⟨L, hL⟩
  have e := congrArg (fun v => v true) (rectangle_law hL true false true false)
  simp at e

/-- 定義 L.6b：演算 `op : A → B → C` の、⊗ からの線形写像としての像。
対の点 `single a 1 ⊗ₜ single b 1` を、値の点 `single (op a b) 1` へ送る。 -/
noncomputable def tensorLift {A : Type u} {B : Type v} {C : Type w} (op : A → B → C) :
    (A →₀ ℕ) ⊗[ℕ] (B →₀ ℕ) →ₗ[ℕ] (C →₀ ℕ) :=
  lmapDomain ℕ ℕ (fun p : A × B => op p.1 p.2) ∘ₗ (finsuppTensorFinsupp' ℕ A B).toLinearMap

/-- 定理 L.6b（どの演算も ⊗ から書ける）：`tensorLift op` は `single a 1 ⊗ₜ single b 1` を
`single (op a b) 1` へ送る。 -/
theorem tensorLift_single {A : Type u} {B : Type v} {C : Type w} (op : A → B → C) (a : A) (b : B) :
    tensorLift op (single a 1 ⊗ₜ[ℕ] single b 1) = single (op a b) 1 := by
  have h : finsuppTensorFinsupp' ℕ A B (single a 1 ⊗ₜ[ℕ] single b 1) = single (a, b) 1 := by
    rw [finsuppTensorFinsupp'_single_tmul_single, mul_one]
  exact (congrArg (mapDomain fun p : A × B => op p.1 p.2) h).trans mapDomain_single

/-- 定理 L.6b（どの演算も ⊗ から書ける、存在の形）：どの `op : A → B → C` にも、
⊗ からの `ℕ` 線形写像 `L` で、`single a 1 ⊗ₜ single b 1` を `single (op a b) 1` へ送るものがある。 -/
theorem exists_tensor_linear {A : Type u} {B : Type v} {C : Type w} (op : A → B → C) :
    ∃ L : (A →₀ ℕ) ⊗[ℕ] (B →₀ ℕ) →ₗ[ℕ] (C →₀ ℕ),
      ∀ a b, L (single a 1 ⊗ₜ[ℕ] single b 1) = single (op a b) 1 :=
  ⟨tensorLift op, tensorLift_single op⟩

/-- 定理 L.6b（論理積は ⊗ を通る）：⊗ からの `ℕ` 線形写像 `L` で、どの `a b : Bool` でも
`single a 1 ⊗ₜ single b 1` を `single (a && b) 1` へ送るものがある。 -/
theorem and_through_tensor :
    ∃ L : (Bool →₀ ℕ) ⊗[ℕ] (Bool →₀ ℕ) →ₗ[ℕ] (Bool →₀ ℕ),
      ∀ a b, L (single a 1 ⊗ₜ[ℕ] single b 1) = single (a && b) 1 :=
  exists_tensor_linear fun a b => a && b

/-- 定理 L.6c（リストの連結は ⊕ から書けない）：`a ≠ a'` なら、⊕ からの加法的な写像 `L` で、
どの `u v : List A` でも `(single u 1, single v 1)` を `single (u ++ v) 1` へ送るものは無い。
長方形の律を `[a]`、`[a']` で破る。`[a, a]` は左辺にあり、右辺の `[a, a']`、`[a', a]` には無い。 -/
theorem list_append_not_additive {A : Type u} {a a' : A} (h : a ≠ a') :
    ¬ ∃ L : ((List A →₀ ℕ) × (List A →₀ ℕ)) →+ (List A →₀ ℕ),
      ∀ u v, L (single u 1, single v 1) = single (u ++ v) 1 := by
  rintro ⟨L, hL⟩
  have e := congrArg (fun w => w [a, a]) (rectangle_law hL [a] [a'] [a] [a'])
  simp [h] at e

/-- 定理 L.6c（長さだけで破れる）：`A` に点 `a` が1つあれば、同じことが言える。
長方形の律を `[]`、`[a]` で破る。`[]` は左辺にあり、右辺の `[a]`、`[a]` には無い。 -/
theorem list_append_not_additive_of_point {A : Type u} (a : A) :
    ¬ ∃ L : ((List A →₀ ℕ) × (List A →₀ ℕ)) →+ (List A →₀ ℕ),
      ∀ u v, L (single u 1, single v 1) = single (u ++ v) 1 := by
  rintro ⟨L, hL⟩
  have e := congrArg (fun w => w []) (rectangle_law hL [] [a] [] [a])
  simp at e

/-- 定理 L.6c（⊗ からは書けるが単射でない）：`A` に点 `a` があれば、リストの連結の
⊗ からの像 `tensorLift (· ++ ·)` は単射でない。
`single [] 1 ⊗ₜ single [a] 1` と `single [a] 1 ⊗ₜ single [] 1` は、ともに `single [a] 1` へ行く。 -/
theorem list_append_tensor_not_injective {A : Type u} (a : A) :
    ¬ Function.Injective (tensorLift fun u v : List A => u ++ v) := by
  intro h
  have e := h ((tensorLift_single (fun u v : List A => u ++ v) [] [a]).trans
    (tensorLift_single (fun u v : List A => u ++ v) [a] []).symm)
  have e2 := congrArg (finsuppTensorFinsupp' ℕ (List A) (List A)) e
  simp only [finsuppTensorFinsupp'_single_tmul_single, mul_one] at e2
  have e3 := single_left_injective (one_ne_zero : (1 : ℕ) ≠ 0) e2
  simp at e3

/-- 定義 L.6d：形の決まった連結の量の像。`(Fin n → A) × (Fin m → A) →₀ ℕ` から
`(Fin (n + m) → A) →₀ ℕ` への `ℕ` 線形同型である。点の対 `(u, v)` を `Fin.append u v` へ移す。 -/
noncomputable def appendLin (A : Type u) (n m : ℕ) :
    ((Fin n → A) × (Fin m → A) →₀ ℕ) ≃ₗ[ℕ] ((Fin (n + m) → A) →₀ ℕ) :=
  Finsupp.domLCongr (Fin.appendEquiv n m)

/-- 定理 L.6d（形の決まった連結は同型）：`appendLin` は `single (u, v) 1` を
`single (Fin.append u v) 1` へ送る。 -/
theorem appendLin_single {A : Type u} {n m : ℕ} (u : Fin n → A) (v : Fin m → A) :
    appendLin A n m (single (u, v) 1) = single (Fin.append u v) 1 := by
  rw [appendLin, domLCongr_single]
  rfl

/-- 定義 L.6d：⊗ からの、形の決まった連結の量の像。
`((Fin n → A) →₀ ℕ) ⊗[ℕ] ((Fin m → A) →₀ ℕ)` から `(Fin (n + m) → A) →₀ ℕ` への `ℕ` 線形同型である。
L.5a の同型の逆と `appendLin` をつないで作る。 -/
noncomputable def appendTensor (A : Type u) (n m : ℕ) :
    ((Fin n → A) →₀ ℕ) ⊗[ℕ] ((Fin m → A) →₀ ℕ) ≃ₗ[ℕ] ((Fin (n + m) → A) →₀ ℕ) :=
  (pairTensor (Fin n → A) (Fin m → A)).symm.trans (appendLin A n m)

/-- 定理 L.6d（⊗ からの連結は同型）：`appendTensor` は `single u 1 ⊗ₜ single v 1` を
`single (Fin.append u v) 1` へ送る。 -/
theorem appendTensor_single {A : Type u} {n m : ℕ} (u : Fin n → A) (v : Fin m → A) :
    appendTensor A n m (single u 1 ⊗ₜ[ℕ] single v 1) = single (Fin.append u v) 1 := by
  rw [appendTensor, LinearEquiv.trans_apply, ← pairTensor_single, LinearEquiv.symm_apply_apply,
    appendLin_single]

/-- 定理 L.6d（L.6b の像と一致する）：`appendTensor` は、`Fin.append` の ⊗ からの像
`tensorLift Fin.append` と同じ写像である。 -/
theorem appendTensor_apply {A : Type u} {n m : ℕ}
    (x : ((Fin n → A) →₀ ℕ) ⊗[ℕ] ((Fin m → A) →₀ ℕ)) :
    appendTensor A n m x =
      tensorLift (fun (u : Fin n → A) (v : Fin m → A) => Fin.append u v) x := by
  simp only [appendTensor, appendLin, pairTensor, LinearEquiv.trans_apply, domLCongr_apply,
    domCongr_apply, equivMapDomain_eq_mapDomain, tensorLift]
  rfl

/-- 定理 L.6d（形の決まった連結は ⊗ から全単射）：`tensorLift Fin.append` は全単射である。
長さの決まらない連結（L.6c）と違い、どこで切れるかが形から読める。 -/
theorem tensorLift_append_bijective {A : Type u} (n m : ℕ) :
    Function.Bijective (tensorLift (fun (u : Fin n → A) (v : Fin m → A) => Fin.append u v)) := by
  have hf : ⇑(tensorLift (fun (u : Fin n → A) (v : Fin m → A) => Fin.append u v)) =
      ⇑(appendTensor A n m) := funext fun x => (appendTensor_apply x).symm
  rw [hf]
  exact (appendTensor A n m).bijective

end Joint

section Blocks

/-- 定義 L.6e：形の決まったリストの、区画に並べた量の像。長さ `n` のリスト `u` を、
`n` 個の区画 `Fin n → (A →₀ ℕ)`（`A →₀ ℕ` の `n` 個の双積）に置く。
`i` 番目の区画には `single (u i) 1` を置く。 -/
noncomputable def blocks {A : Type u} {n : ℕ} (u : Fin n → A) : Fin n → (A →₀ ℕ) :=
  fun i => single (u i) 1

/-- 定義 L.6e：区画の並べ直し。`n` 個の区画と `m` 個の区画の双積を、`n + m` 個の区画へ並べ直す
加法的な同型である。下にある写像は `Fin.append` である。 -/
def blockAppend (M : Type u) [AddCommMonoid M] (n m : ℕ) :
    (Fin n → M) × (Fin m → M) ≃+ (Fin (n + m) → M) where
  toEquiv := Fin.appendEquiv n m
  map_add' p q := by
    funext i
    refine Fin.addCases (fun i => ?_) (fun j => ?_) i
    · simp [Fin.append_left]
    · simp [Fin.append_right]

/-- 定理 L.6e（形の決まった連結は ⊕ の並べ直し）：`blockAppend` は、区画に並べた `u` と `v` の対を、
区画に並べた `Fin.append u v` へ送る。 -/
theorem blockAppend_blocks {A : Type u} {n m : ℕ} (u : Fin n → A) (v : Fin m → A) :
    blockAppend (A →₀ ℕ) n m (blocks u, blocks v) = blocks (Fin.append u v) := by
  funext i
  refine Fin.addCases (fun i => ?_) (fun j => ?_) i
  · simp [blockAppend, blocks, Fin.append_left]
  · simp [blockAppend, blocks, Fin.append_right]

/-- 定義 L.6e：長さの決まらないリストの、区画に並べた量の像。区画の鍵は（長さ, 位置, 要素）である。
`u` は `Σᵢ single (u.length, i, u[i]) 1` へ行く。空のリストは `0` へ行く。 -/
noncomputable def dynBlocks {A : Type u} (u : List A) : ℕ × ℕ × A →₀ ℕ :=
  ∑ i : Fin u.length, single (u.length, (i : ℕ), u.get i) 1

/-- 定理 L.6e（長さの決まらない連結は、区画の形でも ⊕ から書けない）：`A` に点 `a` があれば、
⊕ からの加法的な写像 `L` で、どの `u v : List A` でも `(dynBlocks u, dynBlocks v)` を
`dynBlocks (u ++ v)` へ送るものは無い。
`(dynBlocks [a], dynBlocks [a])` は `(dynBlocks [a], 0)` と `(0, dynBlocks [a])` の和である。
だから `L` はそれを長さ 1 の区画2つへ送るが、`dynBlocks [a, a]` は長さ 2 の区画にある。 -/
theorem dynBlocks_append_not_additive {A : Type u} (a : A) :
    ¬ ∃ L : ((ℕ × ℕ × A →₀ ℕ) × (ℕ × ℕ × A →₀ ℕ)) →+ (ℕ × ℕ × A →₀ ℕ),
      ∀ u v : List A, L (dynBlocks u, dynBlocks v) = dynBlocks (u ++ v) := by
  rintro ⟨L, hL⟩
  have h0 : dynBlocks ([] : List A) = 0 := by simp [dynBlocks]
  have split : ((dynBlocks [a], dynBlocks [a]) : (ℕ × ℕ × A →₀ ℕ) × (ℕ × ℕ × A →₀ ℕ)) =
      (dynBlocks [a], dynBlocks []) + (dynBlocks [], dynBlocks [a]) := by
    simp [h0]
  have e := hL [a] [a]
  rw [split, map_add, hL, hL] at e
  have e2 := congrArg (fun w => w (2, 0, a)) e
  simp [dynBlocks, Fin.sum_univ_two] at e2

end Blocks

end SignMath.Quantity
