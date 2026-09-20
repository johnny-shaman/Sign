# Zero-Cost Domain Abstraction Specification

> [!NOTE]
> **The canonical source is the Japanese document [zero_cost_abstraction.md](../../../ja-jp/impl/type/zero_cost_abstraction.md).**
> This English copy is a *derived translation* and is **behind** the canonical text
> (user ruling, 2026-09-21: "en-us is the older one"). Where the two disagree, the
> Japanese side wins — including against this file. Do not cite this file as the
> specification; read it as a reading aid, and fix the Japanese side when you find a gap.

This document details the design philosophy of **Zero-Cost Domain Abstraction** in the Sign language.

---

## Concept & Vision

**Zero-Cost Domain Abstraction**:
- Provides abstractions spanning multiple computational domains (bare-metal, systems, scripting, WebAssembly, vector SIMD).
- Translates identical syntactic constructs into optimal target machine instructions without runtime abstraction overhead.
- Unifies systems programming, hardware control, and mathematical modeling under a single homogeneous syntax.

---

## Architectural Realization

1. **Unified List Model**:
   - List-based data structures provide a single abstraction model across all layers.
   - Target-specific optimizations are applied silently by the compiler backend.

2. **Automatic Domain Adaptation**:
   - Compiler automatically selects execution models (`layer 0` to `4`) based on option configuration.
   - Code monomorphizes cleanly for target architectures.

3. **Direct Hardware Instruction Mapping**:
   - Bitwise operators (`<<`, `>>`, `||`, `&&`, `;;`, `!!`) map directly to CPU registers and SIMD instructions.
   - Bypasses language runtime overhead to achieve C-equivalent bare-metal execution speed.
