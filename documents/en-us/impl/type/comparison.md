# Comparison Return Values and Chained Evaluation Specification

> [!NOTE]
> **The canonical source is the Japanese document [comparison.md](../../../ja-jp/impl/type/comparison.md).**
> This English copy is a *derived translation* and is **behind** the canonical text
> (user ruling, 2026-09-21: "en-us is the older one"). Where the two disagree, the
> Japanese side wins — including against this file. Do not cite this file as the
> specification; read it as a reading aid, and fix the Japanese side when you find a gap.

## 1. Overview

Comparison operations in Sign (`<`, `>`, `<=`, `>=`, `=`, `!=`) return concrete values on True and collapse to `__` (Unit) on False.

> [!NOTE]
> - `_` (Hole): Syntactic placeholder desugared at compile time.
> - `__` (Unit): Runtime value representing "absence / falsy".

Comparison return rules use **Value-Based Algebraic Dispatch** rather than AST syntax inspects, satisfying Referential Transparency while preserving intuitive chained comparisons (`1 < x < 10` returns central term $x$).

---

## 2. Evaluation Rules & Algebraic Dispatch

For $V = \text{eval}(LHS \text{ op } RHS)$:

$$ V = \begin{cases} 
\text{select}(LHS, RHS) & (\text{Condition is True}) \\
\mathbf{1}\ (\text{__}) & (\text{Condition is False})
\end{cases} $$

Where:

$$\text{select}(LHS, RHS) = \begin{cases} 
RHS & (\text{value}(LHS) \in \{0, 1\}) \\
LHS & (\text{Otherwise})
\end{cases}$$

- **Identity Rule**: If evaluated LHS integer equals `0` (additive identity) or `1` (multiplicative identity), return **$RHS$**.
- **Standard Rule**: Otherwise, return **$LHS$**.

---

## 3. Referential Transparency

Because operand selection depends on evaluated **values** rather than AST node types, bound variables preserve referential transparency:

$$\text{Given } a = 1 \implies \text{eval}(1 < 5) = \text{eval}(a < 5) = 5$$

---

## 4. Chained Comparison (`ChainCompare`)

Ternary chains (`L < C < R`) parse into dedicated AST nodes: `ChainCompare(L, <, C, <, R)`:
1. Validated statically: All operators in chain must be identical.
2. Validated statically: The operator must be **transitive**, so that `a R b` and `b R c` imply `a R c`. Only `<` `<=` `=` `>=` `>` qualify; **`!=` cannot be chained** (syntax error), since `3 != 5 != 3` satisfies both adjacent pairs while the outer terms are equal. Write `(a != b) & (b != c)` explicitly instead.
3. If all adjacent comparisons evaluate to True, unconditionally return **Central Term $C$**.
4. If any comparison evaluates to False, immediately return **`__`** (Unit). Evaluation short-circuits at the first zero morphism, so terms to its right are not evaluated.
