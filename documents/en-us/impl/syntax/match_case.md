# Pattern Matching (`match_case`) Specification

> [!NOTE]
> **The canonical source is the Japanese document [match_case.md](../../../ja-jp/impl/syntax/match_case.md).**
> This English copy is a *derived translation* and is **behind** the canonical text
> (user ruling, 2026-09-21: "en-us is the older one"). Where the two disagree, the
> Japanese side wins — including against this file. Do not cite this file as the
> specification; read it as a reading aid, and fix the Japanese side when you find a gap.

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

```text
function_def ?
	condition1 : result1
	condition2 : result2
	...
	default_result
```

- Blocks indented with tabs immediately following `?` represent `match_case` expressions. The arms sit one TAB deeper than the line with `?`; a line two TABs deeper at once is inside a nested block, which stands in for a bracket, so it is not an arm ([`preprocessor.md`](../build/preprocessor.md) section 0).
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
