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
| `0` | Standard Decimal Integer | **Wraparound** | Natural modular arithmetic; safe for algorithms |
| `0r00` | Register / Raw Binary Bits | **Wraparound** | Bitwise ops expect modular wrap (crypto/hashing) |
| `0x00` | Memory Address Pointer | **Collapse to `__` (Unit)** | Prevents out-of-bounds invalid memory address access |
| `0u00` | Unicode Code Point | **Collapse to `__` (Unit)** | Prevents invalid scalar code point propagation |

**Rule**:
- Types where wrap is computationally safe $\implies$ **Wraparound**
- Types where wrap compromises safety $\implies$ **Collapse to Unit (`__`)**

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
` Standard Integer (0) — Defined Wraparound
x : 2147483647
` → Wraps modulo MAX_INT
y : x + 1

` Raw Binary (0r) — Defined Wraparound
` 8-bit: 255
b : 0rFF
` → 0r00
c : b + 0r01

` Address Pointer (0x) — Collapse to Unit (__)
addr : 0xFFFFFFFF
` → __ (Unit, prevents out-of-bounds jump)
next : addr + 0x01
```

**Undefined Behavior does not exist in Sign.**
