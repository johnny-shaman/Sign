# Unified Verification Specification of Sign Operators & Lambdas via Kan Extensions

> [!NOTE]
> **The canonical source is the Japanese document [kan_extensions.md](../../../ja-jp/impl/appendix/kan_extensions.md).**
> This English copy is a *derived translation* and is **behind** the canonical text
> (user ruling, 2026-09-21: "en-us is the older one"). Where the two disagree, the
> Japanese side wins — including against this file. Do not cite this file as the
> specification; read it as a reading aid, and fix the Japanese side when you find a gap.

## 1. Overview

In Sign's language design, built-in operators (`+`, `*`, `<`, `&`, `,`) and user-defined lambdas (`?`) are not distinguished. Through cumulative implementation, it has been **inductively confirmed** that all operational behaviors structurally correspond to a single universal concept in Category Theory: **Kan Extensions**.

This document uses Left Kan Extensions ($\text{Lan}$) and Right Kan Extensions ($\text{Ran}$) to verify how Sign's operator and lambda semantics align cleanly with Kan extension frameworks.

> [!NOTE]
> **Direction of Formulation**
>
> The correspondence with Kan extensions describes observed structural convergence. It does not imply that Sign was inductively derived top-down from category theory proofs; rather, Sign's observed operational semantics align strictly with category-theoretic limits, colimits, and adjunctions.

---

## 2. Mathematical Foundation: All Concepts Are Kan Extensions

For arbitrary functors $K: \mathcal{A} \rightarrow \mathcal{B}$ and $F: \mathcal{A} \rightarrow \mathcal{C}$, Left Kan Extensions ($\text{Lan}_K F$) and Right Kan Extensions ($\text{Ran}_K F$) are functors $\mathcal{B} \rightarrow \mathcal{C}$ defined by universal mapping properties (adjunctions).

### 2.1 Kan Extensions

#### 2.1.1 Left Kan Extension ($\text{Lan}_K F$)

Colimit extension along $K$. Characterized by the natural isomorphism:

$$\text{Nat}(\text{Lan}_K F, G) \;\cong\; \text{Nat}(F, G \circ K)$$

This implies a natural transformation $\eta: F \Rightarrow \text{Lan}_K F \circ K$ (unit) exists such that for any natural transformation $\alpha: F \Rightarrow G \circ K$, a unique natural transformation $\sigma: \text{Lan}_K F \Rightarrow G$ satisfies $\alpha = (\sigma * K) \circ \eta$.

![Left Kan Extension](./images/LeftKanExtension.png)

#### 2.1.2 Right Kan Extension ($\text{Ran}_K F$)

Limit extension along $K$. Characterized by the natural isomorphism:

$$\text{Nat}(G, \text{Ran}_K F) \;\cong\; \text{Nat}(G \circ K, F)$$

This implies a natural transformation $\epsilon: \text{Ran}_K F \circ K \Rightarrow F$ (counit) exists such that for any natural transformation $\alpha: G \circ K \Rightarrow F$, a unique natural transformation $\sigma: G \Rightarrow \text{Ran}_K F$ satisfies $\alpha = \epsilon \circ (\sigma * K)$.

![Right Kan Extension](./images/RightKanExtension.png)

### 2.2 Kan Lifts

For a functor $p: \mathcal{B} \rightarrow \mathcal{C}$ acting on codomains, lifting (pulling back) a functor $F: \mathcal{A} \rightarrow \mathcal{C}$ is termed a Kan Lift.

#### 2.2.1 Left Kan Lift ($\text{Llift}_p F$)

Left Kan Lift is a universal construction accompanied by unit natural transformation $\eta: F \Rightarrow p \circ \text{Llift}_p F$.

![Left Kan Lift](./images/LeftKanLift.png)

#### 2.2.2 Right Kan Lift ($\text{Rlift}_p F$)

Right Kan Lift is a universal construction accompanied by counit natural transformation $\epsilon: p \circ \text{Rlift}_p F \Rightarrow F$.

![Right Kan Lift](./images/RightKanLift.png)

### 2.3 Pullback & Pushforward Duality

A functor $K: \mathcal{A} \rightarrow \mathcal{B}$ induces a precomposition (pullback) functor $K^*: [\mathcal{B}, \mathcal{C}] \to [\mathcal{A}, \mathcal{C}]$ defined by $K^*(G) = G \circ K$.
Kan extensions represent left and right adjoints to precomposition:

$$\text{Lan}_K \;\dashv\; K^* \;\dashv\; \text{Ran}_K$$

- **Left Kan Extension ($\text{Lan}_K$)**: Left adjoint to $K^*$ (Colimit pushforward).
- **Right Kan Extension ($\text{Ran}_K$)**: Right adjoint to $K^*$ (Limit pushforward).

### 2.4 Four Universal Constructions: Complete Kan Duality Grid

| Construction | Position of Given Functor | Universal 2-cell Direction | Adjunction Relationship |
| :--- | :--- | :--- | :--- |
| **Left Kan Extension** ($\text{Lan}_K F$) | Domain Side $K: \mathcal{A} \rightarrow \mathcal{B}$ | $\eta: F \Rightarrow \text{Lan}_K F \circ K$ | $\text{Nat}(\text{Lan}_K F, G) \cong \text{Nat}(F, G \circ K)$ |
| **Right Kan Extension** ($\text{Ran}_K F$) | Domain Side $K: \mathcal{A} \rightarrow \mathcal{B}$ | $\epsilon: \text{Ran}_K F \circ K \Rightarrow F$ | $\text{Nat}(G, \text{Ran}_K F) \cong \text{Nat}(G \circ K, F)$ |
| **Left Kan Lift** ($\text{Llift}_p F$) | Codomain Side $p: \mathcal{B} \rightarrow \mathcal{C}$ | $\eta: F \Rightarrow p \circ \text{Llift}_p F$ | $\text{Nat}(\text{Llift}_p F, G) \cong \text{Nat}(F, p \circ G)$ |
| **Right Kan Lift** ($\text{Rlift}_p F$) | Codomain Side $p: \mathcal{B} \rightarrow \mathcal{C}$ | $\epsilon: p \circ \text{Rlift}_p F \Rightarrow F$ | $\text{Nat}(G, \text{Rlift}_p F) \cong \text{Nat}(p \circ G, F)$ |

---

## 3. Unified Proof Specifications of Operators and Lambdas

### 3.1 Identity Morphism `__` and Partial Application (Adjunction)

Partial application (`_` / Hole desugaring) is uniquely derived as a Right Kan Extension of the Identity Functor $\text{Id}_{\mathcal{C}}$ along functor $F$:

$$G \;\cong\; \text{Ran}_{F} \text{Id}_{\mathcal{C}}$$

### 3.2 Derivation of Coproduct (Space) and Product (Comma)

List concatenation (Coproduct $\amalg$) and pairing (Product $\times$) derive as Kan extensions along the unique functor $!: \mathcal{J} \to \mathbf{1}$:

1. **Coproduct (Space ` `)**: Left Kan Extension (Colimit)
   $$\text{colim } D \;\cong\; \text{Lan}_{!} D$$
2. **Product (Comma `,`)**: Right Kan Extension (Limit)
   $$\text{lim } D \;\cong\; \text{Ran}_{!} D$$

#### Biproduct Isomorphism in Scalar Domains

In scalar domains, `1, 2, 3` (Product) and `1 2 3` (Coproduct) exhibit equivalent operational behavior, corresponding to the existence of a **Biproduct**:

$$\text{Lan}_{!} D \;\cong\; \text{Ran}_{!} D$$

### 3.3 Role of `__` (Unit) in Static Land

`__` functions as the absolute Zero Object ($\mathbf{0} \cong \mathbf{1}$) of Sign:
- Identity element under Coproduct (Space ` `): `__ f` $\to f$, `f __` $\to f$.
- Identity element under Product (Comma `,`): `__ , x` $\to x$, `x , __` $\to x$.

### 3.4 Derived Functors for Arithmetic and Logic Operators

Arithmetic and logical operators exist as **Derived Functors** mapped from core Coproduct and Product constructs:

- **Addition `+`**: Derived functor of Coproduct (Space ` `) mapped to the numeric domain.
- **Multiplication `*`**: Derived functor of Product (Comma `,`) mapped to the numeric domain.
- **Comparison `<`**: Unital Derived Functor mapped to Unit (`__`) on failure (zero morphism) or identity value on success (unit morphism $\eta: \text{Id} \to F$).

### 3.5 Role of `__` in Derived Categories & Homological Extensionality

In derived categories $\mathcal{D}(\mathcal{C})$, values exist as complexes $X^\bullet$:
- **Absolute Zero Object `__`**: Zero complex $\mathbf{0}^\bullet$.
- **Scalar Values `0` and `1`**: Single-point complexes $S(0)$ and $S(1)$ non-zero at degree 0.

Thus, `__` $\neq 0$ ($\mathbf{0}^\bullet \neq S(0)$) holds strictly, preserving scalar `0` as truthy while treating `__` as falsy.

#### Topos Theory and Boolean Elimination

In Topos Theory via Subobject Classifiers $\Omega$, truth values are embedded in exactness of complexes:
- **False**: Exact complex ($H^*(C^\bullet) = 0 \iff C^\bullet \cong \mathbf{0}^\bullet$).
- **True**: Non-exact complex ($H^*(C^\bullet) \neq 0 \iff C^\bullet \neq \mathbf{0}^\bullet$).

Boolean primitives are eliminated because comparison operations directly measure exactness.

---

## 4. Compiler Verification via Kan Extensions

The compiler's type checker verifies operation correctness via two universal meta-rules:
1. **Commutative Diagram Verification**: Validates whether juxtaposition meets colimit/limit universal properties.
2. **Zero Object Descent Verification**: Validates that zero object `__` propagates cleanly across derived domain operations.
