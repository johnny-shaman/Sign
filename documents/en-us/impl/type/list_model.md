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
` Space (coproduct) stacks on one level: unbracketed items are first brought to the
` level of the deepest item, then stacked from the left.
m : 1 2 , 3 4
` [1 2 , 3 4 , 5 6]   [5 6] is brought to the level of m's rows (one more row)
m [5 6]
` [1 2 , 3 4 , 5 , 6]   5 and 6 each become a row of length 1 (two more rows)
m 5 6

` Items on the same level join flat (this line of written brackets gets the warning; the condition is in the NOTE below).
[1 2] [3 4]  = 1 2 3 4

` Postfix ~ lowers by one level.
m~  = 1 2 3 4

` Comma is a product: it raises the dimension (see §3). A level-3 sequence of two
` elements: m, and [5 6] brought to a matrix of one row.
m , [5 6]
```

> [!IMPORTANT]
> **Space is always the coproduct, and it stacks things on one level.** Per the table in §1,
> space extends within the current dimension and comma raises it. That correspondence never
> changes with the operand types.
>
> A bracket is resolved and then removed (`[x] ≅ x`): what is inside is stacked first into one
> value. The unbracketed items of a line are all brought to the level of the deepest item
> (shallower items are raised one level at a time), then stacked from the left. Numbers and
> characters are on level 0; stacked with whitespace, they are lifted into containers of
> length 1. Items on the same level join flat. For `m : 1 2 , 3 4`:
>
> | spelling | value | items |
> |---|---|---|
> | `m [5 6]` | `[1 2 , 3 4 , 5 6]` | 3 |
> | `m 5 6` | `[1 2 , 3 4 , 5 , 6]` | 4 |
> | `5 6 m` | `[5 , 6 , 1 2 , 3 4]` | 4 |
> | `(5 6) m` | `[5 6 , 1 2 , 3 4]` | 3 |
> | `m~` | `[1 2 3 4]` | 4 |
> | `m~ 5 6` | `[1 2 3 4 5 6]` | 6 |
>
> `m [5 6]` and `m 5 6` differ only in the bracket: the bracketed `[5 6]` is stacked first into
> one level-1 value and brought to the level of the rows, while the unbracketed `5` and `6` are
> each brought up as level-0 values. An unbracketed sequence does not depend on order; every item
> is brought to the level of the deepest one (`5 6 m` has four rows too). `m~ [5 6]` is the same
> `[1 2 3 4 5 6]` as `m~ 5 6`, since `m~` and `[5 6]` are both on level 1.
>
> Outside a key position and the spreading import `@~` (both are spellings fixed by the written form),
> the postfix `~` has exactly one meaning: **lower by one level** (μ; see
> §3.2 of the [Japanese canonical text](../../../ja-jp/impl/type/list_model.md)). In a key position
> (right of `'`, left of infix `@`), `l ' 1~` is a separate spelling for the slice from there to the
> end. `m~` is `1 2 3 4`, and `[+] m~` is `10`. On a level-1 sequence (`xs~`) and on a level-0
> number (`5~`), postfix `~` lowers to the value itself, so the value is the same as `xs` and `5`
> and nothing is reported (`m [5 6]~` is the same three rows as `m [5 6]`).
>
> **The rule does not depend on which side is a `List`**: `[1 2] 3` and `1 [2 3]` are both
> `1 2 3`. Numbers and characters are lifted into containers of length 1 when stacked with
> whitespace, so the scalar side follows the same rule. Deciding which side is the container by
> where the brackets are would make one operator change its meaning with the order of its operands.
>
> **Nor on whether the compiler can see inside a name.** A name whose contents are not visible
> at the definition site, such as a parameter, follows the same rule, and its level is decided
> by the value passed in: `f : [x ~xs] ? x xs` applied to `[1 2 3]` gives `1 2 3`. Putting a
> value in a name does not change the answer (with `n : [3 4]`, `[1 2] n` is `1 2 3 4`, the same
> as `[1 2] [3 4]`).
>
> **alpha record (not a rule)**: the alpha interpreter and machine add a container placed side by
> side as one item, and spread only the side that carries a postfix `~` (`m [5 6]` has 2 items,
> `m~ [5 6]~` has 6).

> [!NOTE]
> **`[1 2] [3 4]` is `1 2 3 4`.** A bracket is resolved and then removed (`[x] ≅ x`), so `[1 2]`
> and `[3 4]` are both level-1 sequences, and items on the same level join flat. Leaving the left
> unbracketed (`1 2 [3 4]`) or the right unbracketed (`[1 2] 3 4`) gives the same `1 2 3 4`. The
> value is the same, but `[1 2] [3 4]`, with both sides bracketed, gets the warning below.
>
> For two dimensions, write a comma (`1 2 , 3 4`) or a bracket with one row per line (in a bracket
> of two or more lines each line is one element, and a line holding a single number or character
> becomes a row of length 1) — that is what "comma raises the dimension" means. Writing brackets
> side by side as in `[1 2] [3 4]`, or nesting them as in `[[1 2] [3 4]]`, also gives the flat
> `1 2 3 4`, and the reading stage reports one warning where it is written (its message: "for two
> dimensions write `1 2 , 3 4`; for flat, write `1 2 3 4`"). The warning appears only when every
> item of the sequence is a written bracket of two or more values; `0 [1 2 3]`, `[1 [2 3]]`,
> `1 2 [3 4]` or `[1 2] 3 4` with one side unbracketed, and names joined as `xs ys`
> (`xs : 1 2`, `ys : 3 4`) get none. The warning's name is not decided yet.
>
> **Sharing a shape is not the same as changing an operator.** Space is always the coproduct
> (it stacks on one level) and comma is always the product (it builds a sequence one level above
> the deepest element); a symbol's meaning does not change with the combination it appears in.

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

There is **no implicit type conversion**: if the right-hand operand is outside the domain the left-hand one chose, the operation collapses to `!_` (diagnosed at information level).

```sign
` !_   arithmetic does not swallow String (information: a String operand of '+')
0 + `123`

` !_   the same with the operands swapped — the direction is not what decides
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
