# Partial Application (Hole `_`) Static Desugaring Specification

> [!NOTE]
> **The canonical source is the Japanese document [hole_desugaring.md](../../../ja-jp/impl/syntax/hole_desugaring.md).**
> This English copy is a *derived translation* and is **behind** the canonical text
> (user ruling, 2026-09-21: "en-us is the older one"). Where the two disagree, the
> Japanese side wins — including against this file. Do not cite this file as the
> specification; read it as a reading aid, and fix the Japanese side when you find a gap.

## 1. Background & Purpose

In early Sign iterations, `_` served a dual role:
1. **Unit as Value**: Empty lists, logical "false", Nothing (absence of value).
2. **Hole for Partial Application**: Placeholder inside function applications, creating closures/lambdas.

To resolve semantic conflicts between runtime values (`__`) and syntactic placeholders (`_`), Sign enforces strict separation:
- **Syntactically written `_`** is desugared at compile time into lambda expressions (`?`) representing Holes.
- **Runtime values** are represented by `__` (Unit).

---

## 2. Specification Rules

### 2.1 Compile-Time: Static Desugaring Algorithm

During AST construction, the compiler inspects argument slots of function application nodes:

- If a slot contains **literal `_` (Hole)**, it is treated as a partial application placeholder.
- The expression is desugared into a lambda:

#### Algorithm:
1. Count holes $N$ in the application expression.
2. Generate $N$ unique compiler variables $P_0, \dots, P_{N-1}$ (e.g., `$p0`, `$p1`).
3. Replace each $i$-th `_` with $P_i$.
4. Wrap the expression in a lambda taking $P_0, \dots, P_{N-1}$.

| Authored Source | Desugared AST Representation |
|--------------|----------------|
| `f _ 3` | `$p0 ? f $p0 3` |
| `f _ _` | `$p0 $p1 ? f $p0 $p1` |
| `[+ 1,] _` | `$p0 ? [+ 1,] $p0` |
