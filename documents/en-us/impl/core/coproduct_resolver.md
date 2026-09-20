# Coproduct Resolver Specification

> [!NOTE]
> **The canonical source is the Japanese document [coproduct_resolver.md](../../../ja-jp/impl/core/coproduct_resolver.md).**
> This English copy is a *derived translation* and is **behind** the canonical text
> (user ruling, 2026-09-21: "en-us is the older one"). Where the two disagree, the
> Japanese side wins — including against this file. Do not cite this file as the
> specification; read it as a reading aid, and fix the Japanese side when you find a gap.

This document defines the deterministic algorithm that reduces flat space-separated token sequences (`coproduct_block`) into binary AST trees immediately after parsing, based on type category precedence.

---

## 1. Overview

In Sign, space juxtaposition represents a **Coproduct**, which reduces to `reverse_apply`, `apply`, `compose`, or `concat` based on operand type categories.

Constructing ASTs prior to Hindley-Milner type inference avoids circular dependency deadlocks by using **pre-inference type categories (`Lambda` vs `Atom`)** attached to nodes during parsing.

---

## 2. Term Category Classification (`getCategory`)

Nodes are classified into pre-inference categories (`Lambda` or `Atom`):

- **`Lambda` Category**:
  - Node has explicit `isLambda` flag.
  - `?` (lambda definition), `compose` nodes, or partially-applied operator nodes.
  - Built-in function identifiers (`print`, `_`).
  - Terms prefixed with `@`.
- **`Atom` Category**:
  - Numeric literals, string literals.
  - Identifiers registered in environment map as `Atom`.
  - Arithmetic and structural list `concat` nodes.

---

## 3. Precedence Definitions

Juxtaposed pairs `(LHS, RHS)` reduce to these nodes:

| Name | Left Category (`leftCat`) | Right Category (`rightCat`) | Reduced AST Node | Semantics |
| :--- | :--- | :--- | :--- | :--- |
| **10.5** | `Lambda` | `Lambda` | `compose` | Function composition |
| **10.4** | `Lambda` | `Atom` | `apply` | Function application |
| **10.3** | `Atom` | `Lambda` | `apply` (operands swapped) | Reverse application; see §3.1 |
| **10.2** | `Atom \| List \| Struct` | `List~ \| Struct~` | `concat` | Splice the right side in |
| **10.1** | `Atom \| List \| Struct` | `Atom \| List \| Struct` | `unshift` | Add the right side as one element |
| **10.0** | `Atom` | `Atom` | `construct` | Coproduct (list construction) |

> [!IMPORTANT]
> **`10.x` is a name for a reduction, not a resolution order.** The numbering is historical
> and other documents reference it as a name, so it stays. **The order is given by §3.0.**

### 3.0 Resolution order

**Function application binds looser than construction.** In `f a b`, `a b` becomes a container
first and is then handed to `f`. Eating one argument at a time (`(f a) b`) would be saying that
application sits inside construction.

**Except that a function still short of arguments eats first.** For `g : a b ? …`, writing
`g 1 2` and building `1 2` into a container first would leave `g` with only one argument. While
the arity says "one more is needed" the application is inner; once saturated it yields to
construction. The order is not decided by the static tier alone — it asks the function's arity.

**And composition is innermost of all.** `double inc 5` means "double, then inc": once two
morphisms sit side by side the composition is settled first, and the value flows into it. Put
composition after the unsaturated apply and `inc 5` collapses first, giving `double (inc 5)`
— **the order comes out backwards.**

Innermost first:

| Order | Pair | Condition | Reduction |
| :--- | :--- | :--- | :--- |
| 1 | `Lambda` `Lambda` | — | `compose` |
| 2 | `Lambda` `Atom` | **unsaturated** (still needs one after this) | `apply` |
| 3 | `Atom` `Atom` | — | `concat` / `unshift` / `construct` (shape decides; 10.2–10.0) |
| 4 | `Lambda` `Atom` | saturated | `apply` |
| 5 | `Atom` `Lambda` | point-free excluded (§3.1) | `apply` (operands swapped) |

Measured against `alpha/javascript` (trees as produced):

```text
d : x ? x * 10        arity 1

d 1 2   ->  construct(apply(d, 1), 2)   2 takes one; the leftover goes to 3
1 d 2   ->  construct(1, apply(d, 2))    no Atom-Atom pair, so 4 fires

f : x y ? x           arity 2

f 1 2   ->  apply(apply(f, 1), 2)       unsaturated, so 2 fires twice
f 1 2 3 ->  construct(apply(apply(f, 1), 2), 3)  once saturated it yields to 3

double : x ? x * 2    inc : x ? x + 1

double inc 5 ->  apply(compose(double, inc), 5) = 11   1 settles the composition first
```

> [!NOTE]
> **This order is the reverse of what it once was.** For a time correctness was put ahead of
> optimization and resolution followed the numbering 10.5 down to 10.0; construction is now
> inside application. Reading the numbers as an order makes `d 1 2` come out as `(d 1) 2`,
> which disagrees with the implementation (`COPRODUCT_PHASES` in `pass2.js`).
> **The number is not the order.**


---

## 4. Reduction Scan Algorithm

For a flat token list `items`:

1. **Walk the phases**: Iterate through the resolution order of §3.0 (1 through 5), not through the `10.x` numbering. Composition is innermost; construction sits inside application.
2. **Left-Associative Scan**: Scan adjacent pairs `(items[i], items[i+1])` from left to right.
3. **Match & Reduce**: On matching category pairs, collapse into a single binary AST node and re-scan from the beginning to preserve left-associativity.
4. **Convergence**: Scan terminates when `items` reduces to a single root AST node.
