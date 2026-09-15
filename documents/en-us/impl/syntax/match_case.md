# Pattern Matching (`match_case`) Specification

## Overview

> [!IMPORTANT]
> **Block Disambiguation Immediately Following `?`**
>
> | Block Syntax Immediately Following `?` | Interpretation | Primary Purpose |
> |---|---|---|
> | **Indented Block** (Tab-indented) | `match_case` Expression | Conditional Branching |
> | **`[...]` Bracket Block** | Struct / List Literal | Struct Constructor returning multiple fields |

---

## 1. Syntax

```sign
function_def ?
\tcondition1 : result1
\tcondition2 : result2
\t...
\tdefault_result
```

- Blocks indented with tabs immediately following `?` represent `match_case` expressions.
- Each arm takes the form `condition : result`.
- **The final line contains an unconditioned `result` expression** representing the default fallback.

---

## 2. Operator Precedence

Within condition expressions, scalar or structural comparison operators apply:

- `=` / `!=` / `<` / `<=` / `>` / `>=` (Precedence 12: Scalar Comparison)
- `==` / `!==` (Precedence 8: Structural Comparison)
- `:` (Precedence 2: Arm Separator)

Because comparison operators carry higher precedence than `:`, condition expressions resolve unambiguously.

---

## 3. Examples

```sign
compare : x y ?
	x = y : `equal`
	x < y : `less`
	`greater`
```

```sign
collatz : n steps ?
	n = 1       : steps
	n % 2 = 0   : collatz (n / 2)      (steps + 1)
	collatz (n * 3 + 1) (steps + 1)
```
