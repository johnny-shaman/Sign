# Sign Language User Guide

> [!NOTE]
> **The canonical source is the Japanese document [README.md](../../ja-jp/guide/README.md).**
> This English copy is a *derived translation* and is **behind** the canonical text
> (user ruling, 2026-09-21: "en-us is the older one"). Where the two disagree, the
> Japanese side wins — including against this file. Do not cite this file as the
> specification; read it as a reading aid, and fix the Japanese side when you find a gap.

A documentation suite designed for **authors writing code in Sign**.

---

## 3 Essential Documents to Read First

| Document | Content |
|---|---|
| **[operator_table.md](operator_table.md)** | Precedence, semantics, and Unit behavior of all operators. **The core architecture of the language**. |
| **[list_cheat_sheet.md](list_cheat_sheet.md)** | Cheat sheet for commonly used list operations. |
| **[example.sn](example.sn)** | Fully runnable Sign code. Reading this lets you write Sign code immediately. |

---

## Core Understanding: The 6 Fundamentals

When in doubt, return to these 6 fundamental definitions:

| Symbol | Semantics | Example |
|------|------|----|
| `__` | Unit (Identity element in coproduct) | `__ 5 = 5` |
| `_` | Hole (Placeholder for partial application) | `f _ 3 = $p0 ? f $p0 3` |
| Space | Coproduct (Function composition, application, list construction) | `f g x = g(f(x))` |
| `,` | Product (Structural list construction) | `1, 2, 3` |
| `?` | Lambda (Function definition) | `x ? x + 1` |
| `:` | Definition (Binding) | `add : x y ? x + y` |

**These 6 symbols cannot be overloaded** (they define the type inference rules themselves).

---

## Document Index

```
guide/
├── README.md              ← This file
├── operator_table.md      Complete operator table (Precedence & Unit behavior)
├── function_guide.md      Writing function definitions (`?` operator, match_case, default args)
├── list_cheat_sheet.md    List manipulation cheat sheet
├── string_and_comment.md  String literals and comment syntax
├── pattern_guide.md       Idiomatic pattern guide (Maybe/List/Either/IO, etc.)
├── reference.md           Sign Language Complete Reference Manual
└── example.sn             Runnable sample code
```

---

## Data Flow: filter → map → fold

```sign
[> 0,] [* 2,] [+] data
 ↓      ↓      ↓
filter  map   fold
```

Function composition flows **from left to right**.

---

## Frequently Used Patterns

### Basic Function Definition
```sign
add : x y ? x + y
add 3 5   ` → 8
```

### Pattern Matching (`match_case`)
```sign
f : x ?
	x > 0 : x * 2
	x < 0 : x * -1
	0
```

### List Manipulation
```sign
` map: Double each element
[* 2,] [1 2 3 4 5]~   ` → [2 4 6 8 10]

` filter: Positive numbers only
[> 0,] [1 -2 3 -4 5]~  ` → [1 3 5]

` fold: Sum
[+] [1 2 3 4 5]~       ` → 15
```

### Recursion
```sign
sum : x ~xs ?
	xs & x + sum xs | x

sum [1 2 3 4 5]   ` → 15
```
