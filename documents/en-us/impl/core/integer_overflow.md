# Sign Integer Overflow & Boundary Behavior Specification

> [!NOTE]
> **The canonical source is the Japanese document [integer_overflow.md](../../../ja-jp/impl/core/integer_overflow.md).**
> This English copy is a *derived translation* and is **behind** the canonical text
> (user ruling, 2026-09-21: "en-us is the older one"). Where the two disagree, the
> Japanese side wins — including against this file. Do not cite this file as the
> specification; read it as a reading aid, and fix the Japanese side when you find a gap.

## Overview

One of C's foundational vulnerabilities is **signed integer overflow undefined behavior (UB)**.
Sign structurally eliminates this problem by making overflow semantics **statically deterministic** based on literal types and layer constraints.

---

## 1. Literal Types and Overflow Behaviors

Literal types in Sign determine overflow semantics via explicit prefixes:

| Literal Prefix | Semantic Meaning | Overflow Semantics | Architectural Rationale |
|---------|---------|-----------------|------|
| `0` | Standard Decimal Integer (`Int`) | **Trap (`wfi`)** | ℤ held in one word: an overflowing answer exists in ℤ but does not fit the word, like running out of a resource |
| `0r00` (also `0b01`) | Register / Raw Binary Bits (`UInt`) | **Wraparound** | The ring ℤ/2^64ℤ: wrapping is the arithmetic itself (crypto/hashing) |
| `0x00` | Memory Address Pointer | **Collapse to `!_` (Unit)** | Prevents out-of-bounds invalid memory address access |
| `0u00` | Unicode Code Point | **Collapse to `!_` (Unit)** | Prevents invalid scalar code point propagation |

**Rule** (user rulings, 2026-10-11):
- The answer is **not in the domain** (division by zero, an address at or above 2^64 or below 0, a code point outside the charset) $\implies$ **Collapse to Unit (`!_`)**. Addresses and code points are positions: one outside the domain does not exist
- The answer **is in ℤ but does not fit the word** (`Int` overflow, including a result that lands exactly on `INT64_MIN`) $\implies$ **Trap (`wfi`)**. Overflow is resource exhaustion, not a value, so it is not mixed with `!_` (the same reasoning as an sret placement overflow)
- The values are **the ring ℤ/2^64ℤ** (`UInt`) $\implies$ **Wraparound**; there is no overflow event to check

Division by zero (quotient and remainder) is `!_` for `Int` and `UInt` (neither ℤ nor ℤ/2^64ℤ has an inverse of 0; catch it with `|`), IEEE 754 for `Float`, and `!_` for an address divided by 0 or less; it never traps. A decimal literal outside the `Int` range is a compile-time error that names it. This replaces the earlier rules "a non-fatal overflow wraps" and "integer division by zero gives quotient 0, remainder = dividend".

> [!NOTE]
> **alpha today (not a rule).** alpha still wraps `Int` at 64 bits without trapping, wraps out-of-range decimal literals, types `0r`/`0b` as `Int`, and answers integer division by zero with quotient 0 and remainder = dividend. The new rules land in a later slice.

---

## 2. Comparison with C

### C Signed Integer Overflow (Undefined Behavior - UB)

```c
int x = INT_MAX;  // 2147483647
int y = x + 1;    // UB: Compiler optimizes assuming overflow "never happens"
```

In C, signed integer overflow is UB, enabling aggressive compiler passes to break runtime logic.

### Sign Integer Semantics (Fully Deterministic)

```sign
` Standard Integer (0) — Defined: traps outside the Int range
x : 9223372036854775807
` → trap (9223372036854775808 is in ℤ but does not fit an Int)
y : x + 1

` Raw Binary (0r) — Defined Wraparound modulo 2^64 (UInt)
b : 0rFFFFFFFFFFFFFFFF
` → 0
c : b + 0r01

` Address Pointer (0x) — Collapse to Unit (!_)
addr : 0xFFFFFFFFFFFFFFFF
` → !_ (Unit, past the end of the address space)
next : addr + 1
```

**Undefined Behavior does not exist in Sign.**
