# System Semantics Specification

> [!NOTE]
> **The canonical source is the Japanese document [system_semantics.md](../../../ja-jp/impl/core/system_semantics.md).**
> This English copy is a *derived translation* and is **behind** the canonical text
> (user ruling, 2026-09-21: "en-us is the older one"). Where the two disagree, the
> Japanese side wins — including against this file. Do not cite this file as the
> specification; read it as a reading aid, and fix the Japanese side when you find a gap.

## Overview

Sign supports both high-level functional declarations (Application Layer) and low-level primitive memory operations (System Layer) using a single unified syntax.
This document defines **explicit memory operations** used in system-level implementations (compilers, allocators, bare-metal drivers).

---

## Application Layer vs System Layer

### Application Layer (User Code)

- **Memory Management**: Automatic (no direct `alloc` calls).
- **Direct Address Manipulation**: Supported natively via raw address syntax (`0x00 # 1`, `@0x00`).
- **Prohibitions**: Manual pointer arithmetic increments/decrements are absent by design.

### System Layer (System Function Blocks)

- **Memory Management**: Explicit allocation logic using three boundary operators:
  - `$` **Address-Of**: Obtains pointer location.
  - `@` **Dereference (Load)**: Reads value from address.
  - `#` **Store**: Writes value into target memory location.

---

## Explicit Reference Operations

```text
` Passes function reference without value copying
map $[* 2] ...
` Stores value directly into heap_ptr memory slot
$heap_ptr # ...
```

### Compiler Rules (Pass 4)

- **Identifiers**: Evaluated as R-Values.
- **Store Target (Left of `#`)**: Must be an expression evaluating to an L-Value address (`$x # y`).
- **Explicit Operators**: `$`, `@`, `#` eliminate implicit magical conversions.

---

## Behavior of Literals (`0x00`, `0u00`, `__`) under Pointer Operations

- **`$` (Address-Of)**:
  - `$0x00`: Returns static `.rodata` slot address of Address literal `0x00`.
  - `$0u00`: Returns static address of Char niche slot.
  - `$__`: Evaluates to `__` (Unit).
- **`@` (Dereference)**:
  - `@0x00`: Interprets `0x00` as an address and performs a memory read at `0x00`.
  - `@0u00`: Causes a type error or collapses to `__`.
  - `@__`: Collapses to `__` immediately under the Completeness Axiom.

---

## Layer-Dependent Hardware Access (`layer`)

- **Layer 0 (bare)**: Reads/writes physical memory addresses directly (MMIO registers, interrupt vectors).
- **Layer 1–4 (alloc to std)**: Interacts with virtual memory addresses. Dereferencing `0x00` triggers standard OS segmentation fault signals.
