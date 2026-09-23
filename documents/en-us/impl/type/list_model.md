# Sign List Model & N-Dimensional Matrix Specification

> [!NOTE]
> **The canonical source is the Japanese document [list_model.md](../../../ja-jp/impl/type/list_model.md).**
> This English copy is a *derived translation* and is **behind** the canonical text
> (user ruling, 2026-09-21: "en-us is the older one"). Where the two disagree, the
> Japanese side wins — including against this file. Do not cite this file as the
> specification; read it as a reading aid, and fix the Japanese side when you find a gap.

## 1. Core Principles: Two Operators Represent All List Operations

All list operations in Sign are expressed using two fundamental operators:

| Operator | Symbol | Categorical Meaning | Operational Semantics |
|--------|------|-----------|-----------|
| Space ` ` | Coproduct ($\amalg$) | Juxtaposition / Concatenation | "Prepend / Append" |
| Comma `,` | Product ($\times$) | Structural Construction | "Construct Pair / N-dim matrix" |

Coproduct (Space) and Product (Comma) form an **Adjunction Pair** in Category Theory ($L \dashv R$).

---

## 2. Coproduct (Space): 1D List Construction & Concatenation

### 2.1 Scalar Juxtaposition

```sign
` Comma separated (for scalar types, commas can be omitted)
1, 2, 3, 4, 5

` Space juxtaposition yields identical 1D list
1 2 3 4 5

` All three forms are equivalent
myPairs  : 1 2 3 4 5
myPairs0 : [,] 1 2 3 4 5
myPairs1 : 1, 2, 3, 4, 5

myPairs = myPairs0 = myPairs1
```

### 2.2 List Concatenation & Postfix Tilde (`~`)

```sign
` Space is a coproduct: extend within the same dimension.
` Without a tilde the right operand is added as ONE element.
m : 1 2 , 3 4
` [[[1,2],[3,4]],[5,6]]   the right operand stays one item; m~ [5 6] lowers the left ([1 2 3 4 [5 6]])
m [5 6]

` With a postfix tilde the right operand is spread and joined.
[1 2]~ [3 4]~  = 1 2 3 4

` Comma is a product: it raises the dimension (see §3).
` [[[1,2],[3,4]],[5,6]]
m , [5 6]
```

> [!IMPORTANT]
> **Space is always the coproduct.** Per the table in §1, space extends within the current
> dimension and comma raises it. That correspondence never changes with the operand types.
>
> The postfix `~` has exactly one meaning: **lower me by one dimension** (§3.2). Where it is
> written, that operand's contents flow into the surrounding coproduct; without it the operand
> is added as a single item. **The rule is the same on both sides** — the left operand is not
> special. For `m : [1 2] , [3 4]`:
>
> | spelling | value | items |
> |---|---|---|
> | `m [5 6]` | `[[[1,2],[3,4]],[5,6]]` | 2 |
> | `m~ [5 6]` | `[1,2,3,4,[5,6]]` | 5 |
> | `m [5 6]~` | `[[[1,2],[3,4]],5,6]` | 3 |
> | `m~ [5 6]~` | `[1,2,3,4,5,6]` | **6** |
> | `m~ 5 6` | `[1,2,3,4,5,6]` | 6 |
>
> The last row needs no brackets: you bracket something to make it **one item**, and a flat
> sequence has no reason to be bracketed.

> [!CAUTION]
> **`[1 2] [3 4]` has the same shape as `1 2 , 3 4` (two dimensions).** Both sides are
> bracketed, so each is one item. Widths that do not agree are not an error — they make the
> type a `Struct` ([`type_system.md` §2](type_system.md): what separates `List` from `Struct`
> is whether the widths are uniform). To join them flat, lower both (`[1 2]~ [3 4]~`) or leave
> the left unbracketed (`1 2 [3 4]~`); lowering only one gives `[[1 2] 3 4]`, not `[1 2 3 4]`.
>
> **Sharing a shape is not the same as changing an operator.** This section previously read
> `[1 2] [3 4] = 1 2 , 3 4`, treating space **as a product** for list-list pairs alone. That
> made a symbol's meaning depend on the combination it appeared in. Space is always the
> coproduct now; the shapes merely coincide because a bracket makes one item.

---

## 3. Product (Comma): Multi-Dimensional Matrices

Commas `,` lift dimensions to form multi-dimensional matrices:

```sign
` 2D Matrix (2x3)
1 2 3 , 4 5 6

` 3D Matrix (2x2x2)
[1 2 , 3 4] , [5 6 , 7 8]

` Tensor multiplication and exponentiation
` Flat duplication
[1 2 3 4] * 2 = 1 2 3 4 1 2 3 4
` Dimension lifting
[1 2 3 4] ^ 2 = 1 2 3 4 , 1 2 3 4
```

---

## 4. Left-Hand Priority Type Conversion Rule

In binary operations, **the left-hand operand type determines the type of the operation**:

$$\text{typeof}(L \text{ op } R) = \text{typeof}(L)$$

There is **no implicit type conversion**: if the right-hand operand is outside the domain the left-hand one chose, the operation collapses to `__` (diagnosed at information level).

```sign
` __   arithmetic does not swallow String (information: a String operand of '+')
0 + `123`

` __   the same with the operands swapped — the direction is not what decides
`123` + 0
```

To join a string and a number, use juxtaposition (coproduct) rather than arithmetic: `` `123` 0 `` is `` `1230` ``.

---

## 5. Struct / Dict Destructuring Pattern Matching & Safe Merging

### 5.1 Destructuring Arguments

```sign
` Extracting key 'foo' and collecting remainder into 'obj'
f : x [foo ~obj] y ?
	foo

` A struct literal is written as a block even for one entry (`:` binds looser than `,`)
f 10 [
	foo : 1
	bar : 2
	baz : 3
] 20
```

### 5.2 Struct Merging via Coproduct

```sign
dict3 : [ foo : 100, bar : 200 ]~ [ fooo : 100, bar : 500, baz : 300 ]~
```
Duplicate keys (`bar`) are merged safely at compile-time if their types match. Conflicting types trigger static compile-time errors.
