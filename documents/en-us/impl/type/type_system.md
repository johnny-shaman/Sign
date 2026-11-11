# Sign Language Type System Specification

> [!NOTE]
> **The canonical source is the Japanese document [type_system.md](../../../ja-jp/impl/type/type_system.md).**
> This English copy is a *derived translation* and is **behind** the canonical text
> (user ruling, 2026-09-21: "en-us is the older one"). Where the two disagree, the
> Japanese side wins — including against this file. Do not cite this file as the
> specification; read it as a reading aid, and fix the Japanese side when you find a gap.

## 1. Design Principles: Types Emerge Deterministically from Syntax

The type system of Sign possesses a fundamental invariant:

> **Types are not labels annotated onto data; they are determined uniquely and deterministically from operators and AST topology.**

Consequently, constraint-solving algorithms like Hindley-Milner are absent. Type inference resolves via a single linear $O(n)$ scan across the AST.

> **Types are not declared targets; they are the static reflection of computational operations performed by code.**
>
> Dedicated declaration syntax for traits/interfaces does not exist in Sign. This is not an omission. Information regarding what operations an identifier permits is expressed directly by the code consuming that identifier. `.st` signature files do not "declare" types; they simply extract and record static information from code.

---

## 2. Two-Layer Type Hierarchy

Sign's type system consists of two independent layers:

### Layer 1: Structural Types

Structural types govern space-operator resolution and are **determined directly from syntax**:

| Structural Type | Definition / Condition |
|:---:|---|
| `Lambda` | Expressions containing `?` (lambda definition) or brackets forming partial applications |
| `Atom` | All other values and expressions (Numbers, Strings, Lists, Structs, Addresses, Unit) |

#### Structural Resolution Rules:

```sign
` → Lambda  (Presence of ?)
x y ? body
` → Lambda  (Partial application bracket)
[+ 2]
` → Lambda  (Function address encapsulation)
[f]
` → Atom    (Address-Of always yields Atom(Address))
$expr
` → Inherits target domain
@expr

` → Atom    (Numeric literal)
42
` → Atom    (String literal)
`hello`
` → Atom    (Arithmetic result)
x + y
` → Atom    (Value list block)
[1 2 3]
` → Atom    (Unit)
!_
```

> [!IMPORTANT]
> **Asymmetry of `$` and `@`**
>
> `$expr` always returns `Atom(Address)` regardless of whether `expr` is a Lambda or Atom.
> The one exception is `$!_`, which is the point: there is no place for nothing, so the address of the zero object is the zero object itself, typed `Unit` (`$!_ + 3` is `!_ + 3`, i.e. 3).
> `@expr` dereferences the address and inherits the structural domain of the target (returns `Lambda` if calling a function, or `Atom` if loading data).

### Layer 2: Atom Subtypes

Atom Subtypes govern binary operator semantics and type casts:

| Subtype | Description | Example Literal | Minimum `layer` Required |
|:---:|---|---|:---:|
| `Int` | Signed integer: ℤ held in one GPR word, −(2^63−1) … 2^63−1 (`INT64_MIN` is the `!_` niche). A result that does not fit the word traps (`wfi`); division by zero is `!_` | `42`, `-1` | **0+** |
| `UInt` | Wrapping unsigned integer, the ring ℤ/2^64ℤ; bit strings (`0r`, `0b`) and the home of bit operations. It has no niche: a value that may be `!_` is carried as a (value, flag) pair, the one exception to "one bit representation per width class" (ja type_system §2). Division by zero is `!_` | `0rFF`, `0b1010` | 0+ |
| `Float` | Floating-point number | `3.14`, `1.0` | **2+** |
| `String` | Unicode string (Isomorphic to `List(0u)`) | `` `hello` ``, `\a` | 0+ |
| `Vector` | SIMD Vector type | `[1.0 2.0 3.0 4.0]` | **3+** |
| `List` | Homogeneous 1D array (a comma chain whose elements unify to one type is one too) | `1 2 3`, `[1 2 3]`, `1, 2, 3` | 0+ |
| `Struct` | Heterogeneous Product structure (a comma chain whose elements do not unify) | `` 1, `a`, 2.5 `` | 0+ |
| `Dict` | Key-Value structure | `[key : val]` | 0+ |
| `Unit` | Zero object / Empty / Null | `!_` | 0+ |
| `Address` | Pointer location | `0x00`, `$expr` | 0+ |

> [!NOTE]
> **alpha today (not a rule).** Every statement in this document about `UInt`, `Int` traps and division by zero still answers by the old rules in alpha: it types `0r`/`0b` as `Int` (there is no `UInt` yet), wraps `Int` at 64 bits without trapping, and divides by zero to quotient 0 and remainder = dividend (user rulings 2026-10-11; they land in a later slice). It also still types as a `Struct` a comma chain that unifies only by promotion (`1, 2.5`), one holding `!_` (`x , !_`), a scalar beside a container (`1 , [2 3]`), and containers of different lengths — the values are already right.

---

## 3. Typing Rules

### 3.1 Four Semantics of the Space Operator (Layer 1 Dependent)

After resolving Layer 1 Structural Types, space juxtaposition resolves into one of four operations:

| Precedence | Left Type | Right Type | Resolved Semantics | Typing Rule |
|:---:|:---:|:---:|---|---|
| 10.5 | `Lambda` | `Lambda` | `compose` (Function composition) | $\text{Lambda}(A \to B) \to \text{Lambda}$ |
| 10.4 | `Lambda` | `Atom` | `apply` (Function application) | $\text{Lambda}(A \to B) \to B$ |
| 10.3 | `Atom` | `Lambda` | `apply_reverse` (Reverse application) | $\text{Lambda}(A \to B) \to B$ |
| 10.0 | `Atom` | `Atom` | `concat` (List / Tuple concatenation) | $\text{Atom} \to \text{List}$ |

### 3.2 Left-Hand Priority Rule (Layer 2 Dependent)

**The return type of a binary operation is determined by the Atom Subtype of the left-hand operand ($LHS$).**

$$\text{typeof}(L \text{ op } R) = \text{typeof}(L)$$

### 3.3 Asymmetric Unit Propagation Rules

- **Zero Object Absorption**:
  - `!_ & x = !_` / `x & !_ = !_` (Terminal object in Product)
  - `!_ | x = x` / `x | !_ = x` (Initial object in Coproduct)
  - `!_ ; x = x` / `x ; !_ = x` (Initial object in XOR)

- **Asymmetric Arithmetic Propagation**:
  - `!_ + x = !_` (LHS Unit acts as zero morphism / error propagation)
  - `x + !_ = x` (RHS Unit acts as identity morphism / transparent pass-through)

### 3.4 The Completeness Axiom ($f\ \mathbf{1} = \mathbf{1}$)

> **Any function application whose argument evaluates to `!_` (Unit) in an unsaturated state collapses to `!_`.**

$$\forall f, f\ \mathbf{1} = \mathbf{1}$$

Functions with declared default arguments represent an exception: passing `!_` triggers fallback to declared default parameter expressions.

---

## 4. Complete Operator Type Signatures

| Symbol | Position | Type Signature |
| :------: | :------: | ------ |
| `#` | Prefix* | `R -> Implicit(R)` |
| `##` | Prefix* | `R -> Implicit(R)` |
| `###` | Prefix* | `R -> Implicit(R)` |
| `:` | Infix* | `(Identifier -> R) -> R` |
| `?` | Infix* | `(List -> R) -> Lambda(R)` |
| `#` | Infix* | `(Address -> R) -> (Address \| !_)` |
| `;` | Infix | `(L -> R) -> (L \| R \| !_)` |
| `\|` | Infix | `(L -> R) -> (L \| R \| !_)` |
| `&` | Infix | `(L -> R) -> (R \| !_)` |
| `==` | Infix | `(L -> R) -> (L \| !_)` |
| `!==` | Infix | `(L -> R) -> (L \| !_)` |
| `,` | Infix* | `(L -> R) -> List` |
| `<` `<=` `=` `>=` `>` `!=` | Infix | `(L(Scalar) -> R(Scalar)) -> (L \| R \| !_)` |
| `+` `-` | Infix | `(L(Scalar) -> R(Scalar)) -> L` |
| `*` `/` `%` | Infix | `(L(Scalar) -> R(Scalar)) -> L` |
| `^` | Infix* | `(L(Scalar) -> R(Scalar)) -> L` |
| `$` | Prefix* | `Any -> Atom(Address)` |
| `@` | Prefix* | `Atom(Address) -> (Lambda \| Atom)` |

---

## 5. Type Resolution Algorithm (Compiler Implementation Guidelines)

### Pass 1: Identifier Table Pre-pass
Scans source linearly to collect structural types (`Lambda` vs `Atom`) and parameter arities for all identifiers into an in-memory `.ist` table.

### Pass 2: Coproduct Space Resolution
Resolves space juxtaposition into `compose`, `apply`, `apply_reverse`, or `concat` AST nodes based on Pass 1 categories.

### Pass 3: Layer 2 Atom Type Propagation
Propagates concrete Layer 2 Atom subtypes across AST nodes using Left-Hand Priority rules.

### Pass 4: Code Generation
Emits ISA machine instructions by consuming the type ledger.

---

## 6. `.st` Files & Structural Hom-Set Equivalence

- **`.st` (Public Signature Files)**: Written to disk upon build completion for exported `#` symbols.
- **Structural `==` Comparison**: Structural comparison `==` checks Hom-set equivalence (matching fields/properties), independent of constructor names.
- **Constructor Origin Opt-In (`' _`)**: Inspects whether an instance originated from a specific constructor binding address (`p ' _ = $Point`).
