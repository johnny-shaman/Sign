# Sign Language Reference Manual

> [!NOTE]
> **The canonical source is the Japanese document [reference.md](../../ja-jp/guide/reference.md).**
> This English copy is a *derived translation* and is **behind** the canonical text
> (user ruling, 2026-09-21: "en-us is the older one"). Where the two disagree, the
> Japanese side wins — including against this file. Do not cite this file as the
> specification; read it as a reading aid, and fix the Japanese side when you find a gap.

# Introduction

Thank you for your interest in the Sign programming language.
At its root, mathematics is a language, yet it is not universally transparent to everyone. Sign was conceived to express computational ideas in a form that is clean, intuitive, readable, and mathematically rigorous.

Mathematics relies on a rich vocabulary of symbols. So do programming languages.
Consider natural language: can the symbols of natural language be mathematically redefined to construct a programming paradigm?

From that core question, Sign was born.

Programming is an art; it ought to be expressive and enjoyable.
We invite you to join us in shaping a language that thinks clearly, acts predictably, and empowers engineers.

Welcome to Sign—a compact, highly expressive, predictable, and readable language.

Noboru Okazaki

---

# Prerequisites

* **Identity Element**: A value that, when combined with another under a binary operation, leaves the other value unchanged (e.g., Unit `__`).
* **Left Associativity**: Evaluating operations from left to right: $(a \cdot b) \cdot c$.
* **Right Associativity**: Evaluating operations from right to left: $a \cdot (b \cdot c)$.
* **Product (積)**: Stacking or constructing structural lists / tuples (Product category $\times$).
* **Coproduct (余積)**: Unifying, applying, or composing functions / lists (Coproduct category $+$ / $\amalg$).
* **Duality**: Dual operations such as addition and subtraction, or Product and Coproduct.
* **Literal**: Denotational notation for concrete values.
* **Function**: Formal specification of transformation (equivalent to a verb).
* **Prefix Operator**: Operator placed immediately before a literal (e.g., `!5`).
* **Infix Operator**: Operator placed between literals with whitespace delimiters (e.g., `1 + 2`).
* **Postfix Operator**: Operator placed immediately after a literal (e.g., `5!`).
* **Polynomial Expression**: Expression involving multiple operators (e.g., `1 + 2 * 3`).
* **Binary Operation**: Expression consisting of a single infix operator (e.g., `1 + 2`).
* **Scope**: Hierarchical isolation of state transformations to prevent unintended interference and enforce security.

---

# Language Characteristics

Sign differs fundamentally from conventional imperative and functional languages:

* **Enclosing Brackets Are Uniform**: `()`, `[]`, and `{}` share identical semantics; bracket choice is purely aesthetic/stylistic.
* **Zero Reserved Words**: No control keywords (`if`, `while`, `for`, `return`, `class`, `import`) exist.
* **Zero Statements**: Statements do not exist. Every expression yields a value.
* **Tab-Indented Block Syntax**: Scoped blocks are formed exclusively via tab indentation.
* **Whitespace as Coproduct**: Whitespace between tokens represents the coproduct operator (function composition, application, list construction).
* **Left-Associative Function Composition**: Functions juxtaposed via whitespace compose left-associatively.
* **Whitespace Rules for Operators**: Prefix and postfix operators must NOT have whitespace between the symbol and operand. Infix operators require surrounding whitespace.
* **Literal-Only Lines Are Ignored**: Unbound literal lines produce no side effects and are skipped (used for comments).
* **Lexical File Scope**: Each source file possesses a private local scope. No global pollution occurs without explicit `#` export or `@` import.
* **Falsy Definitions**: Empty lists (`__`) and unevaluated lambdas are falsy. All other valid values are truthy. Dedicated boolean primitives are unnecessary.
* **Short-Circuit Logic**: Logical operators (`&`, `|`) evaluate via short-circuiting.
* **Low-Level Bitwise Support**: Built-in bitwise operators (`<<`, `>>`, `||`, `&&`, `;;`, `!!`) map directly to native register operations and SIMD instructions.
* **Homoiconicity & List Model**: Arguments passed to functions are lists. All computational data are lists. Sign source code itself is a list.

---

# Comments

In Sign, lines containing unbound literals produce no runtime side effects.
Therefore, **strings starting at SOL (Start of Line) function as comments**.
Because an unindented line starting with `` ` `` is unambiguously a comment, **closing the backtick is optional**. Unclosed lines extend as comments until EOL.

Conversely, backticks after a TAB indent, or after a leading space (which continues the previous line), are treated as evaluated string literals, not comments.
Because SOL backticks are strictly parsed as comments, placing a bare string literal at SOL requires enclosing it in parentheses `()` or binding it to an identifier.

```sign
`This is a comment with closing backtick`
`This is an unclosed comment extending to EOL

`	Indented comment
	`This is NOT a comment; it is an indented string literal`
```

---

# Literals

Sign supports the following literal forms:

* **Numbers**
  * Unsigned Integers
  * Signed Integers
  * Floating-Point Numbers
  * Fractions
  * Hexadecimal Numbers (`0x...`)
  * Octal Numbers (`0o...`)
  * Binary Numbers (`0b...`)
  * Register Identifiers (`0r...`)
  * Unicode Scalar (`0u...`)
* **Characters** (`\c`)
* **Strings** (`` `...` ``)
* **Lists** (`,`, space)
* **Functions / Lambdas** (`?`, `[...]`)
* **Dictionaries / Structs** (`key : value`)
* **Identifiers**
* **Unit** (`__`)

## Numbers

* **Unsigned Integer**: `57`
* **Signed Integer**: `-57`, `57`
* **Floating-Point**: `3537.45468`, `0.357`, `-187.0235`
* **Hexadecimal**: `0xAF8534`
* **Octal**: `0o3574`
* **Binary**: `0b00101001`
* **Register Identifier**: `0rA`, `0r01` directly specify physical/logical CPU registers (e.g., AArch64 `x1`), bypassing heavy typechecking via pure zero-cost syntax.
* **Unicode Scalar**: `0u3042` (represents 'あ')

## Characters

* Any single character immediately preceded by `\` is treated as a character literal. All symbols (including newlines) follow this rule.
* Inside string literals, `\` is treated as a literal backslash character.

## Strings

* Delimited by backticks: `` `Hello World` ``
* Cannot contain literal newlines directly (use single line or block concatenation).
* Embedded backslashes are supported natively: `` `sign string can contain \` ``

## Lists

* Created by separating literals with commas `,` (Product) or whitespace (Coproduct).
* Heterogeneous tuple lists are supported natively.
* Lists of characters represent strings.
* `__` represents the empty list.
* Comma `,` is the Product operator ($\times$).

## Functions

* Defined via the lambda operator `?`: `x y ? x + y`
* Point-Free operators enclosed in brackets: `[+]`, `[* 2,]`
* Partial Application: `[+ 1]`

## Dictionaries / Structs

* Defined as key-value pairs: `key : value`
* Hierarchically scoped via tab indentation.
* Keys are identifiers, characters, or strings.
* Values can be any valid literal or expression.

## Identifiers

Because Sign has zero reserved words, any string can be used as an identifier, subject to basic lexing rules:
* A single `_` cannot be used as a standalone variable name (it is reserved as Hole).
* General punctuation symbols cannot be standalone identifier names.
* Cannot begin with a digit.
* Can begin with `_` (e.g., `_foo`).
* Accepts alphanumeric characters and non-ASCII Unicode.

## Unit (`__`)

The identity element ($\mathbf{1}$ / $\mathbf{0}$) of lists and functions.
Functions as `null`, `nil`, and `false`.
* Represented as `__`.
* Evaluating `__` yields `__`.
* Acts as identity element under coproduct: `__ x = x` and `x __ = x`.

---

# Operators

Operators are ordered below from lowest precedence to highest precedence.

## Export Operator (`#` Prefix)

Exposes bindings across module boundaries.

```sign
#hello : `hello`
```

## Definition Operator (`:` Infix, Right-Associative)

Binds names or pattern conditions to expressions.

```sign
nop : __
yep : !__

calc :
	additive :
		add : +
		sub : -
	multiply :
		mul : *
		div : /
		mod : %
```

## Output / Store Operator (`#` Infix, Right-Associative)

Writes data to a physical memory address or IO port.

`<address or hex literal> # <expression>`

The left side is an **address** — a place taken with `$` (`$x`, `$(l ' 1)`), a name bound to one, or a hex literal.
A name that holds a value is refused by name: writing through it would read the value as an address.

Returns the address on success, or `__` on failure.

```sign
#stream : s ~t ?
	0xFF00 # s
	output t~
```

## Coproduct Operator (Space Infix, Left-Associative)

Coproduct in Sign represents **function composition**, **function application**, **list prepending**, and **list concatenation**.

```sign
[[+ 2] [* 5] 4] = 30
[[+] [* 2] 1 2 3 4] = 20
[* 2,] [+] 1 2 3 4 = 20
```

## Lambda Construction Operator (`?` Infix, Right-Associative)

Constructs lambdas (anonymous functions): `[Parameter List] ? [Body Expression]`.

### 1. Basic Lambda Construction

```sign
` Named binding
exp2fn : x y ? (x + y) ^ 2
` Result: 25
exp2fn 2 3

` Anonymous immediate evaluation
` Result: 25
[x y ? (x + y) ^ 2] 2 3
```

### 2. Partial Application with Hole (`_`) vs Unit (`__`)

* **Hole `_` (Static Desugaring)**: Placeholders in syntax are transformed into lambdas at compile time.
  ```sign
  add : x y ? x + y
  ` Desugars statically to $p0 ? add 3 $p0
  add_three : add 3 _
  ` Result: 8
  add_three 5
  ```
* **Unit `__` (Runtime Behavior)**:
  * **Unsaturated (Arity incomplete)**: `__` causes immediate short-circuit collapse to `__`.
    ```sign
    ` Result: __
    add 3 __
    ```
  * **Saturated (Arity complete)**: `__` triggers comonadic `extract` (immediate execution).
    ```sign
    ` Result: 5
    add 2 3 __
    ```

### 3. Default Arguments & Arity Exclusion

```sign
g :
		x
		y : x + 1
		z : y + 1
		~rest
	? x y z rest~

` Result: 3 4 5
g 3
` 3 < 2 evaluates to __ (False), y falls back to 1+1=2. Result: 1 2 3
g 1 (3 < 2)
```

### 4. Bracketed Parameters (Implicit Tilde Omission)

```sign
` Parenthesize the recursive call — application (tier 10) binds looser than addition (tier 13),
` so without them x + sum_list xs reads as (x + sum_list) xs
sum_list : [x ~xs] ? xs & x + (sum_list xs) | x
` Result: 15
sum_list [1 2 3 4 5]
```

### 5. Automatic Struct Key Binding

```sign
calc_diff : [foo bar ~obj] ? foo - bar
` Result: 80
calc_diff [
	bar : 20
	foo : 100
]
```

### 6. Pattern Matching (`match_case`)

```sign
ABS : x ?
	x >= 0 : x
	x < 0 : -x

` Result: 5
ABS -5
```

### 7. Recursion & Short-Circuit Termination

```sign
reverse : x ~y ? (reverse y~)~ x
` Result: 3, 2, 1
reverse 1 2 3

length : [~xs] ?
	!xs : 0
	1 + (length (xs ' 1~))
` Result: 3
length 1 2 3
```

### 8. Point-Free Style

```sign
` Result: __
[!_] (2 < 3)
` Result: 120
[_!] 5
` Composition runs left to right: 3 goes through [7 -] (7 - 3 = 4), then [* 5] (4 * 5 = 20)
` Result: 20
[7 -] [* 5] 3
```

### 9. Natural Transformations (Map / Fold)

```sign
` Fold. Result: 10
[+] 1 2 3 4
` Map. Result: 2 4 6 8
[* 2,] 1 2 3 4

map : f x ~y ? @f x, map f y~
` Result: 3, 4, 5, 6
map $[+ 2] 1 2 3 4
```

## Product Operator (`,` Infix, Right-Associative)

Constructs tuple lists (Product category $\times$).

```sign
1 , 2 , 3
F [* 2] , 1 , 2 , 3
```

## Range Construction Operators (`~`, `~+`, `~*`, etc.)

Infix `~` constructs range lists:

```sign
[1 ~ 10]
` [8 10 12]
[* 2,] [1 ~ 10] ' [3 ~ 5]
[\a ~ \z]

` Stepped arithmetic / geometric progressions
` [2 4 6 8 10]
[2 ~+ 2 ~ 10]
` [1 2 4 8 16]
[1 ~* 2 ~ 16]
```

## Logical Operators (`|`, `&`, `;`, `!`)

- `|` (OR): Infix, short-circuits. Returns left operand if truthy, otherwise right operand.
- `&` (AND): Infix, short-circuits. Returns `__` if left is falsy, otherwise evaluates right operand.
- `;` (XOR): Infix, does **not** short-circuit. Returns Non-Unit side if exactly one side is Non-Unit; returns `__` if both sides are Non-Unit.
- `!` (NOT): Prefix, logical negation. Returns identity morphism `!__` when negating `__`.

## Structural Comparison Operators (`==`, `!==`)

- `==`: Structural equality operator (deeply compares lists, dictionaries, structs).
- `!==`: Structural inequality operator.

## Scalar Comparison Operators (`<`, `<=`, `=`, `>=`, `>`, `!=`)

Scalar comparison operators return a value on True and `__` (Unit) on False.

### Return Value Rules (Value-Based Algebra)
When comparison $L \text{ op } R$ evaluates to True:
- If $L \in \{0, 1\}$ (arithmetic identities), returns **$R$** (Right operand).
- Otherwise, returns **$L$** (Left operand).

### Chaining Comparisons (`ChainCompare`)
Ternary comparisons like `1 < x < 10` are parsed as AST `ChainCompare(1, <, x, <, 10)`:
- Requires identical comparison operators in chain.
- If all adjacent pairs evaluate to True, unconditionally returns the **central value**.
- If any pair evaluates to False, immediately returns **`__`** (Unit).

```sign
` (1 < 5) and (5 < 10) are both True → returns central value 5
` Result: 5
1 < 5 < 10
```

## Arithmetic Operators (`+`, `-`, `*`, `/`, `%`, `^`)

Standard arithmetic operations:
- `+`, `-`: Addition, Subtraction
- `*`, `/`, `%`: Multiplication, Division, Modulo
- `^`: Exponentiation (Right-associative). Fractional exponent computes roots.

## Absolute Value (`|...|`)

Absolute value block: `|x + y|`. Delimited from OR by absence of whitespace inside bars.

## Property Access Operators (`'`, `@`)

- `'` (Get Infix): `struct ' key`
- `@` (Get Infix Right-Associative): `key @ struct`

```sign
car :
	brand : `Foo`, `Bar`, `Baz`

car ' brand ' 0 = `Foo`
0 @ brand @ car = `Foo`
```

Because `@` runs in the opposite direction from `'`, **the two cannot be mixed on one line** (syntax error). Brackets do not help: both `brand @ car ' 0` and `(brand @ car) ' 0` are refused — bracketing fixes the reading of the expression, but a reader going left to right along the line misses that the direction flipped. Use one spelling, as in `car ' brand ' 0`, or split the line.

### The spelling of the key decides the reading

An unmarked key is resolved by the left side: a name for a struct, an index for a list or string. On its own that is not enough — reading `target ' ident` does not tell you **whether it looks up by name or by contents**, because that depends on a type you cannot see. So **marking the key makes the spelling alone decide**.

| Spelling of the key | Reading | Example |
|---|---|---|
| Identifier or expression with postfix `~` | Use its **contents** as the key (a name for a struct, an index for a container) | `car ' k~`, `brand ' i~` |
| Prefix `@` | The same morphism. Writable **only for a single value** | `brand ' @i` |
| Literal with postfix `~` | Its contents are itself, so the only reading left is to spread — from there to the end | `brand ' 1~` |
| Two postfix `~` | Take the contents, then spread — from that position to the end | `brand ' i~~` |
| No mark | The left side decides (the types above) | `car ' brand`, `brand ' 0` |

`~` means "bring out the contents" in every position, and the key position is no exception. What changes is **whose contents**: the contents of a literal are the literal itself, so "take the contents" collapses to the identity and only the spreading reading survives. The second `~` is that spread.

```sign
car :
	brand : `Foo`, `Bar`, `Baz`
k : `brand`
i : 1

` result: Foo              unmarked; index 0
car ' brand ' 0
` result: [Foo Bar Baz]    looks up by the contents of k (brand)
car ' k~
` result: Bar              uses the contents of i (1) as the index
car ' brand ' i~
` result: Bar              the same morphism, in prefix form
car ' brand ' @i
` result: [Bar Baz]        a literal, so it can only spread
car ' brand ' 1~
` result: [Bar Baz]        take the contents, then spread
car ' brand ' i~~
```

**A runtime key into a struct is always written `car ' k~`.** Prefix `@` is refused there: a struct's physical layout is name-ordered, so it does not line up with the ordinal that `@` spells. Named slots have no order, so `car ' k~~` yields the same value as `car ' k~` — there is nothing to spread into but the value you pulled out.

```sign
` error: a named slot cannot be indexed with prefix @ (use car ' k~ instead)
car ' @k
```

The key side of infix `@` follows the same rule: `1~ @ l` slices, `i~ @ l` pulls one element by the contents of `i`, and `i~~ @ l` takes the contents and then spreads. Only the direction differs — internally both normalize to the `'` form.

## Bitwise Operators (`<<`, `>>`, `||`, `&&`, `;;`, `!!`)

Mapped directly to hardware register operations:
- `<<` / `>>`: Bitwise Shifts
- `||`: Bitwise OR
- `&&`: Bitwise AND
- `;;`: Bitwise XOR
- `!!`: Bitwise NOT (Prefix)

## Factorial Operator (`!` Postfix)

```sign
5! = 120
```

## Spread & Rest Parameter Operators (`~` Postfix / Prefix)

- **Postfix `~` (Spread / Force Evaluation)**: Flattens lists/dicts or forces evaluation of generators/thunks:
  ```sign
  a : 1 2 3
  f a~
  ```
- **Prefix `~` (Rest Parameters)**: Lifts remaining argument stream into a list parameter:
  ```sign
  tail : x ~y ? y
  ```

### Postfix `~` in the key position

On the right of `'` (or the left of infix `@`) — the **key position** — `~` still means "bring out the contents". What changes is **whose contents**.

- **On an identifier or expression, `~` uses its contents as the key.** `l ' i~` means "use the value `i` holds as the index and pull out one element", not a slice. It is the same morphism as prefix `@` on the key (`l ' @i`).
- **On a literal, `~` becomes a slice.** The contents of a literal are the literal itself, so "take the contents" collapses to the identity and only the spreading reading survives. `l ' 1~` is "from index 1 to the end".
- **Doubling `~` takes the contents and then spreads.** `l ' i~~` is "from the position `i` holds to the end" — this is the spelling for slicing at an identifier.

```sign
l : 10 20 30
i : 1

` result: 20         uses the contents of i (1) as the index
l ' i~
` result: [20 30]    a literal, so it slices
l ' 1~
` result: [20 30]    take the contents, then spread
l ' i~~
```

Struct keys follow the same rule: `s ' k~` looks up by the contents of `k` (see the Property Access section).

## Address Pointer Operator (`$` Prefix)

Retrieves the address of a binding or lambda:
- `$Identifier`: Address of named variable binding.
- `$Expression`: Address of anonymous constructed lambda.

### Three Boundary Operators (`$`, `@`, `#`)

Direct control of the hybrid value/location machine:
- `$` : Value space (Stack) $\to$ Location space (Address pointer)
- `@` : Location space $\to$ Value space (Input dereference)
- `#` : Location space $\to$ Value write (Output store)

```sign
i : `hello`
@$i == `hello`
```

### Truthiness of `$Lambda` vs `Lambda`

- Unevaluated bare lambda `Lambda` is falsy (`__` equivalent).
- Encapsulated address reference `$Lambda` is an instantiated reference and is always truthy.

```sign
result : [$custom_handler | default_handler] args
```

## Module Import Operator (`@` Postfix)

Imports files or modules: `module_name@` or `` `path/to/file`@ ``.

```sign
IO@ ' say `hello`
```

## Assembly / Backend Inline Injection (`"..."`)

Inserts target backend assembly directly:

```text
result : "
   mov     eax, 1
   add     eax, 2
   mov     eax, [ebx]
"
```

## Degeneration Rule for Out-of-Domain Type Deviations

Sign operates on type-agnostic lists (Words). Binary operations enforce **Left-Hand Priority Casting**.
However, if operand data completely deviates from the operation domain (e.g., string addition `` `123` + 0 ``), the expression degenerates to **Unit (`__`)** rather than throwing a runtime error.
