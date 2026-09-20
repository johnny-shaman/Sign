# Sign Tail Call Optimization (TCO / TCE) Specification

> [!NOTE]
> **The canonical source is the Japanese document [tco.md](../../../ja-jp/impl/core/tco.md).**
> This English copy is a *derived translation* and is **behind** the canonical text
> (user ruling, 2026-09-21: "en-us is the older one"). Where the two disagree, the
> Japanese side wins — including against this file. Do not cite this file as the
> specification; read it as a reading aid, and fix the Japanese side when you find a gap.

## Overview

Sign lacks dedicated imperative loop keywords (`for` / `while`). Iteration is expressed via **recursion** and **range expressions**.

Guaranteeing that tail recursion never causes stack overflow is a **core architectural invariant of the language**. The compiler converts calls in tail positions to unconditional jump instructions (`JMP`) rather than subroutine calls (`CALL`) (**Tail Call Elimination - TCE**).

---

## 1. Tail Position Definition

In a function body, a call is in **tail position** if its evaluation result is directly returned as the function's return value.

In Sign, the right-hand side of `?` forms the evaluation body, and expressions evaluated at the termination of `&` / `|` branches are tail positions.

### Tail Position Example

```sign
` Tail-recursive loop
loop : n acc ?
	n = 0 & acc |          ` ← acc returned (base case)
	 loop (n - 1) (acc + n)  ` ← loop is in tail position → TCE applied
```

### Non-Tail Position Example

```sign
` Result used in subsequent operation
bad : n ?
	(f n) + 1   ` ← Result of f n is added to 1 → Not in tail position
```

---

## 2. Short-Circuit Logic (`&` / `|`) and Tail Positions

Sign conditional branching `cond & then | else` evaluates both `then` and `else` branches in **tail position**.

```sign
` Tail-recursive Collatz sequence
collatz : n steps ?
	n = 1     & steps            |  ` Base case
	 n % 2 = 0 & collatz (n / 2)  (steps + 1) |  ` Even branch → TCE applied
	             collatz (n * 3 + 1) (steps + 1)   ` Odd branch → TCE applied
```

Every tail call in individual `|` clauses is optimized independently.

---

## 3. Mutual Tail Recursion

Mutual recursion between multiple functions is also fully optimized via TCE when calls reside in tail positions:

```sign
is_even : n ? n = 0 & 1  | is_odd  (n - 1)
is_odd  : n ? n = 0 & __ | is_even (n - 1)
```

Both calls transform into unconditional jumps, consuming a constant single stack frame ($O(1)$ stack space).
