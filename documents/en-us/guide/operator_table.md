# Sign Language Operator Table (Ordered by Precedence)

## Core Principles

- Prefix operators must be placed immediately before their operand (no intervening space).
- Postfix operators must be placed immediately after their operand (no intervening space).
- Infix operators must be placed between operands, separated by spaces.
- Expressed purely through operators with **zero reserved words**.
- Identifier declaration via definition operators simultaneously introduces a type.
- Direct alignment between natural symbolic meaning and operational semantics.
- Table ordered from lowest precedence (evaluated last) to highest precedence (evaluated first).
- The coproduct operator can be conceptualized as a standard delimiter; all whitespace acts as the coproduct operator.
- Treating whitespace as a delimiter is valid because precedence between coproduct and product operators is determined statically in downstream compiler passes.
- Newlines also function as operators, acting as evaluation boundaries at line scope.
- Absolute value brackets: no space after opening `|`, no space before closing `|`.
- Parentheses/brackets: no space after opening `(`, `[`, `{`, no space before closing `)`, `]`, `}`.
- Relationships between lifting (construct and expand) and lowering (fold) operators comprehensively determine types.
- Lowering (folding) operations cast the result to the type of the left-hand operand.
- Because coproducts can be typed prior to code generation, Sign is a statically typed language.
- **Convergence of Undefined Identifiers to Unit (`__`)**:  
  All undefined identifiers evaluate to `__` (empty coproduct / Unit). This foundational design eliminates reserved words and allows arbitrary identifiers as zero-cost virtual keywords or DSL constructs.
- **Unit Absorption and Asymmetry**: Behaviors match the operator table specifications below.
- **Clear Distinction between `__` (Immediate Collapse) and `$__` (Lazy Suspend)**:
  - `__` is the zero object of function application, immediately collapsing the entire expression upon evaluation.
  - `$__` is the address (reference) of `__`. It is a valid non-Unit value, preventing completeness axiom collapse and representing a suspended state (Promise / Thunk).
- **Duality of `$` Depending on Target**:
  - `$AnonymousExpression` (e.g., `$[x ? x]`, `$!__`): Retrieves the **address of the generated object instance** (similar to C++ `&(new [](x){x})`). Address uniqueness is not guaranteed if compiler deduplication merges identical lambdas.
  - `$NamedIdentifier` (e.g., `$Red`, `$b`): Retrieves the **address of the binding itself** (similar to C++ `&b`). Guaranteed to return a unique, stable address for each named binding.
  - This distinction underpins enum variants. Defining `Red : !__` (`!__` = identity morphism) makes `$Red` the address of the named binding "Red", guaranteed distinct from `$Green`. Conversely, `Red : $!__` uses an anonymous lambda address that compiler deduplication could unify with `$Green`. Therefore, **enum variants must be defined as named lambdas: `Red : !__`**.
- **Type Constructors Must Start with an Uppercase Letter**:
  - Functions starting with an uppercase letter are recognized internally by the compiler as returning a newly defined type.
  - Uppercase identifiers define structs, enums, and constructor functions.

---

## Complete Operator Table

- Position field marked with `*` indicates specific precedence/associativity requirements.

| Precedence | Symbol | Position & Type Combinations | Function | Natural Meaning | Operational Semantics | Left Operand is Unit | Right Operand is Unit |
| :---------: | :------: | :------: | :------: | ----------- | ------------- | ---------- | ---------- |
| 1 | `#` | Prefix* | export | Hashtag (Discoverable) | Makes name discoverable internally within project | / | Exports Unit |
| 1 | `##` | Prefix* | export | Hashtag (Discoverable) | Makes name discoverable externally (ARC compatible) | / | Exports Unit |
| 1 | `###` | Prefix* | export | Hashtag (Discoverable) | Makes name discoverable externally (Pinned memory, non-unloadable) | / | Exports Unit |
| 2 | `:` | Infix* | define | Namely ($A \implies B$) | Binds left-hand name/condition to right-hand expression | Absorbing | `identifier : __` is valid definition |
| 3 | `?` | Infix* | lambda | Question (How to?) | Function definition | Parameterless function | Can define function returning Unit |
| 4 | `#` | Infix* | output | Hashtag (Store) | Stores data to address, returns address on success | Returns Unit | `0x00 # __` does nothing, returns address |
| 5 | `;` | Infix | xor | Exclusive | Exclusive OR | Right operand $X$ (Identity) | Left operand $X$ (Identity) |
| 6 | `\|` | Infix | or | Or (Passage) | Logical OR (Short-circuit) | Right operand $X$ (Identity) | Left operand $X$ (Short-circuit) |
| 7 | `&` | Infix | and | And (Combine) | Logical AND (Short-circuit) | `__` (Short-circuit) | `__` (Absorbing) |
| 8 | `==` | Infix | equal | Equal | Structural equality | `__` (Absorbing) | `__` (Absorbing) |
| 8 | `!==` | Infix | xnot_equal | Not equal | Structural inequality | Right operand $X$ (Identity) | Left operand $X$ (Identity) |
| 9 | `,` | Infix* | product | Product (Structural) | Right-associative list construction | Identity | Identity |
| 10.0 | ` ` | `Atom \| List \| Struct` Infix `Atom \| List \| Struct` | construct | Juxtapose | Structural construction | Identity | Identity |
| 10.1 | ` ` | `Atom \| List~` Infix `Atom \| List~` | push / unshift | Juxtapose | Prepend / Append to list | Identity | Identity |
| 10.2 | ` ` | `List~ \| Struct~` Infix `List~ \| Struct~` | concat | Juxtapose | Concatenate list / struct | Identity | Identity |
| 10.3 | ` ` | `Atom \| List \| Struct` Infix `Lambda` | apply | Reverse apply | Function application | Identity | Identity |
| 10.4 | ` ` | `Lambda` Infix `Atom \| List \| Struct` | apply | Apply | Function application | Identity | Identity |
| 10.5 | ` ` | `Lambda` Infix `Lambda` | compose | Left-associative composition | Function composition | Identity | Identity |
| 11 | `~` | Infix | range | Around | Range list construction | Absorbing | Absorbing |
| 11 | `~+` | Infix | range | Around | Arithmetic progression range | Absorbing | Absorbing |
| 11 | `~-` | Infix | range | Around | Reverse arithmetic progression range | Absorbing | Absorbing |
| 11 | `~*` | Infix | range | Around | Geometric progression range | Absorbing | Absorbing |
| 11 | `~/` | Infix | range | Around | Reverse geometric progression range | Absorbing | Absorbing |
| 11 | `~^` | Infix | range | Around | Exponential progression range | Absorbing | Absorbing |
| 12 | `<` | Infix | less | Less than | Comparison | Absorbing | Absorbing |
| 12 | `<=` | Infix | less_equal | Less or equal | Comparison | Absorbing | Absorbing |
| 12 | `=` | Infix | equal | Equal | Comparison | Absorbing | Absorbing |
| 12 | `>=` | Infix | more_equal | Greater or equal | Comparison | Absorbing | Absorbing |
| 12 | `>` | Infix | more | Greater than | Comparison | Absorbing | Absorbing |
| 12 | `!=` | Infix | not_equal | Not equal | Comparison | Identity | Identity |
| 13 | `+` | Infix | add | Addition | Arithmetic | `__` (Absorbing) | Left operand $X$ |
| 13 | `-` | Infix | sub | Subtraction | Arithmetic | `__` (Absorbing) | Left operand $X$ |
| 14 | `*` | Infix | mul | Multiplication | Arithmetic | `__` (Absorbing) | Left operand $X$ |
| 14 | `/` | Infix | div | Division | Arithmetic | `__` (Absorbing) | Left operand $X$ |
| 14 | `%` | Infix | mod | Modulo | Arithmetic | `__` (Absorbing) | Left operand $X$ |
| 15 | `^` | Infix* | pow | Exponentiation | Exponentiation | `__` (Absorbing) | Left operand $X$ |
| 16 | `\|...\|` | Enclosing | abs | Absolute value | Absolute value | / | Absorbing |
| 17 | `'` | Infix | get | Possessive | Access value from structure | Absorbing | Absorbing |
| 17 | `@` | Infix* | get | At | Access value from structure | Absorbing | Absorbing |
| 18 | `<<` | Infix | Bitwise Left Shift | Bitwise Left Shift | Bitwise Left Shift | `__` (Absorbing) | Left operand $X$ |
| 18 | `>>` | Infix | Bitwise Right Shift | Bitwise Right Shift | Bitwise Right Shift | `__` (Absorbing) | Left operand $X$ |
| 19 | `\|\|` | Infix | Bitwise OR | Bitmask | Bitwise OR | `__` (Absorbing) | Left operand $X$ |
| 20 | `;;` | Infix | Bitwise XOR | Bitmask | Bitwise XOR | `__` (Absorbing) | Left operand $X$ |
| 21 | `&&` | Infix | Bitwise AND | Bitmask | Bitwise AND | `__` (Absorbing) | Left operand $X$ |
| 22 | `!` | Postfix | factorial | Factorial | Factorial operation | Absorbing | / |
| 22 * | `~` | Postfix | expand | Spread | Expansion / Splat | Absorbing | / |
| 23 * | `~` | Prefix* | continuous | Sequence | Continuous list construction | / | Absorbing |
| 23 | `!` | Prefix* | not | Negation | Logical negation | / | Identity morphism (Evaluated Non-Unit True) |
| 23 | `$` | Prefix* | address | Value abstraction | Retrieve address | / | Address of `__` is retrievable |
| 23 | `@` | Prefix* | input | At | Read data from address | / | Absorbing |
| 23 | `!!` | Prefix* | Bitwise NOT | Bitwise inversion | Bitwise NOT | / | Absorbing |
| 24 | `@` | Postfix | import | At | Import module from file path | Absorbing | / |
| 25 | `(...)` | Enclosing | block | Block | Inline block construction | / | Absorbing |
| 25 | `{...}` | Enclosing | block | Block | Inline block construction | / | Absorbing |
| 25 | `[...]` | Enclosing | block | Block | Inline block construction | / | Absorbing |
| 26 | `\t` | Prefix | indent | Indent | Indented block construction | / | Absorbing |

> [!NOTE]
> **Comparison Return Value Rules**: When comparison evaluates to True, if left-hand operand is Int `0` or `1` (arithmetic identity), it returns the right-hand operand; otherwise, it returns the left-hand operand.

> [!NOTE]
> **`;` (XOR) Semantics**:  
> `;` shares short-circuit traits with `|` (OR), but behaves distinctly when both operands are Non-Unit.
>
> | Case | `\|` (OR) | `;` (XOR) |
> |--------|-----------|-----------|
> | Left `__`, Right Non-Unit | Returns Right (Identity) | Returns Right (Identity) |
> | Left Non-Unit, Right `__` | Returns Left (Short-circuit) | Returns Left (Identity) |
> | Both Non-Unit | **Returns Left** (Short-circuit) | **Returns `__`** (Cancellation) |
> | Both `__` | `__` | `__` |
>
> `;` does **not** short-circuit. It evaluates both sides; if exactly one side is Non-Unit, it returns that value; if both sides are Non-Unit, they cancel to `__`. This reflects the algebraic axiom ($A \oplus A = \text{false}$).

- Overwriting `__` via `$__ # expr` corrupts language invariants and causes a fatal error.
- Branching logic is expressed via `match_case` blocks or short-circuit logical operators.
- Right-associative function composition requires explicit parentheses.
- Infix `'` operator syntax: `(list | struct) ' index`.
- Infix `@` operator syntax: `index @ (list | struct)`.

---

## Special Symbols

| Symbol | Function | Natural Meaning | Operational Semantics |
| :------: | :------: | ----------- | ------------- |
| `\` | Character escape | Character literal | Treats immediately following character literally |
| `` `...` `` | String | String literal | List of characters |
| `__` | Unit | Visible Void | Empty list / Identity morphism / Unit element ($\mathbf{1}$) |
| `_` | Hole | Missing part | Placeholder for partial application |
| `"..."` | Volatile | Assembly injection | Block syntax only. Inserts target assembly code directly. Sign variable capture rules are undefined. |

- **`!__` is an identity morphism scheduled for evaluation**:
  - `!__ != __` (Evaluates to True)
  - `!__ !== __` (Structural inequality holds)
  - `__ 5 == !__ 5` (Both evaluate to 5; `__` acts as left identity in coproduct, `!__` acts as identity morphism)
  - `5 __ == 5 !__` (Both evaluate to 5; right identity behavior)

---

## Design Philosophy

- **Universally Understandable Symbols**: Prioritize mathematical clarity and intuitive syntax.
- **Natural Language Parity**: Source code reads as coherent sentences.
- **Elimination of Reserved Words**: Eliminates keyword ambiguity in favor of clean symbol semantics.
- **Meta-language Capabilities**: Enables implementing arbitrary programming paradigms purely as functions.
