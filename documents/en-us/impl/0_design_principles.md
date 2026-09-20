# Sign Design Principles

> [!NOTE]
> **The canonical source is the Japanese document [0_design_principles.md](../../ja-jp/impl/0_design_principles.md).**
> This English copy is a *derived translation* and is **behind** the canonical text
> (user ruling, 2026-09-21: "en-us is the older one"). Where the two disagree, the
> Japanese side wins — including against this file. Do not cite this file as the
> specification; read it as a reading aid, and fix the Japanese side when you find a gap.

> [!IMPORTANT]
> This document should be read prior to `1_definition.md`. Individual specifications (operator tables, type systems, compiler pipelines, etc.) are concrete instantiations of the principles declared herein. When reading specific rules and asking "why is it designed this way?", return to this document first.

All design decisions in Sign can be explained as concrete instantiations of one or more of the following 5 core principles. Conversely, when considering adding or modifying language features, verify alignment against these 5 principles. Features failing to align likely deviate from Sign's design philosophy.

---

## Principle 1: RISC As-Is — Operators Must be Transparent to Hardware Instructions

The symbol selections in Sign's operator table are designed **as-is** relative to target RISC processors (initial targets: AArch64 and RISC-V). The sequence of operators emits almost directly into target machine instruction sequences without intermediate abstraction layers smoothing them over.

The language provides an explicit escape hatch: `"..."` (assembly inline injection), allowing backend assembly insertion. This design assumes that "all behavior can ultimately be directly authored by the user at the machine level." Whether an individual operator maps directly to a single instruction (e.g., `^` exponentiation or `!` factorial act as syntactic sugar rather than single ISA instructions) does not impede language design. Because the ultimate fallback always exists, distinguishing core operators from syntactic sugar depends on Principles 2 and 3 rather than strict 1-to-1 ISA mapping.

**Related Document**: [compiler_pipeline.md §1](core/compiler_pipeline.md#1-design-motivation-as-is-compiler-for-risc-processors)

---

## Principle 2: Types as Ledger, Physical Constraints as Truth

> Principles like heapless allocation and static monomorphic typing are analytical descriptions, not ultimate ends. The physical truth is that RISC hardware only possesses fixed-width registers and fixed-width memory; heapless guarantees and type safety are simply high-level linguistic reframings of these physical constraints.

From this perspective, the type system is positioned as follows:

- Types are a **zero-cost compile-time ledger** (transient accounting records existing exclusively during compilation). They do not exist at runtime and carry zero execution overhead.
- Absolute static type safety guarantees are intentionally eschewed at structural boundaries. Detecting accidental confusion between structs sharing identical field layouts (such as `Point` vs `Vector2D`) is not the responsibility of the type system, but the **caller's explicit responsibility** (treated similarly to C unions).

Passes 1–3 of the compiler (Identifier Collection, Coproduct Resolution, Type Propagation) exist solely to build this "ledger" and pass it to Pass 4 (Code Generation). Pass 4 discards semantic type names (struct names, enum names) entirely, selecting fixed-width register operations and jump instruction templates exclusively.

**Related Documents**: [compiler_pipeline.md §2, §3](core/compiler_pipeline.md), [type_system.md](type/type_system.md)

---

## Principle 3: Danger Requires Explicit Opt-In

Throughout Sign's design, a recurring pattern manifests: **Safe default syntax exists by default; performing risky operations requires stepping into distinct, visually explicit opt-in syntax.**

| Domain | Safe Default | Risky Opt-In |
|---|---|---|
| Code Generation | Standard Compilation | `"..."` (Direct Inline Assembly Injection) |
| Constructor Origin Verification | Static Type Ledger | `' !__` (Explicit Origin Inspection) |
| Rest Arguments (`list`) | Bare `~xs` (Stream, pull-based, non-concurrent access) | `[x ~xs]` (Pass-by-reference, allows concurrent multi-address access) |
| Parameter Block IO | `@address` Default Reads (Single-shot, visible effect types) | `#` (Output/Store) inside parameter blocks is **strictly prohibited** |
| Function Body IO | — | `@` (Input), `#` (Output), and `$` (Address-Of) allow arbitrary IO. Using explicit non-arithmetic symbols continuously alerts the author that "this code touches the physical world rather than pure calculation." |

As demonstrated in this table, **this principle does not forbid dangerous operations**. Sign permits low-level operations (concurrent access via raw pointers, raw assembly insertion, arbitrary IO). However, such code must be written so that stepping outside safe defaults is visually explicit.

Concrete Example: Bracketed rest syntax `[foo bar ~struct]` achieves functionality similar to store patterns, but by forbidding `#` in parameter blocks (Principle 3), grammar restricts its existence exclusively to **explicit pass-by-reference forms**.

**Related Documents**: [operator_table.md](../guide/operator_table.md)

---

## Principle 4: Statically Determinable Violations Must Be Rejected Early

While Principle 2 states "types are a ledger, safety is caller responsibility," this is not unrestricted laissez-faire. **Violations statically determinable at compile time must be emitted as compile errors rather than deferred to runtime.** Caller responsibility applies exclusively to statically indeterminable domains (behaviors dependent on dynamic runtime values).

Statically Enforced Rejection Rules:

1. Use of floating-point or SIMD literals in layers below required capability (statically detects unsupported hardware target features).
2. Use of stream-type identifiers inside bracketed rest parameter blocks `[...]` (statically enforces Principle 3's stream vs pass-by-reference distinction).
3. Use of `#` (Output/Store) inside parameter blocks (statically enforces Principle 3's store safety rule).

Because Passes 1–3 resolve the type ledger statically, these rules are checked mechanically without incurring runtime execution cost.

---

## Principle 5: The Completeness Axiom Benefits Both Speed and Safety

The Completeness Axiom $f\ \mathbf{1} = \mathbf{1}$ (`f __ = __`: a function applied to Unit skips its body and returns Unit immediately) appears as a compact rule, yet achieves two distinct architectural goals simultaneously:

- **Performance**: The function call sequence (prologue, epilogue, `call`/`ret`) is skipped entirely. On register-rich RISC architectures (AArch64/RISC-V), caller-side early-out checks bypass full call sequences, providing optimizations when non-tail recursion or inlining/TCO are inapplicable.
- **Safety**: Guarantees that fatal memory overwrite patterns like `$__ # expr` (corrupting Unit) are structurally unreachable during execution. For instance, recursive list writers like `update : [x ~xs] ? $x # x * 2 update xs` collapse via the completeness axiom the moment `xs = __` is reached, terminating without ever entering the function body `$x # ...`.

A single simple axiom simultaneously yields performance optimization and execution safety.

---

## Design Check Checklist

When evaluating new language features or syntactic additions, verify:

- [ ] Does this map cleanly to target hardware instructions (Principle 1)? If not, does an escape hatch like `"..."` exist?
- [ ] Is proposed type information required at runtime, or is compile-time ledger tracking sufficient (Principle 2)?
- [ ] Is risky behavior prevented by default (Principle 3)? Are dangerous operations restricted to explicit opt-in syntax?
- [ ] Are statically determinable violations emitted as compile-time errors (Principle 4)?
- [ ] Is recursive/loop termination anchored to the Completeness Axiom, or does it require ad-hoc termination logic (Principle 5)?
