# Sign Implementation Specifications & Developer Guide

> [!NOTE]
> **The canonical source is the Japanese document [README.md](../../ja-jp/impl/README.md).**
> This English copy is a *derived translation* and is **behind** the canonical text
> (user ruling, 2026-09-21: "en-us is the older one"). Where the two disagree, the
> Japanese side wins — including against this file. Do not cite this file as the
> specification; read it as a reading aid, and fix the Japanese side when you find a gap.

Comprehensive documentation suite for implementers of the Sign compiler, interpreter, and toolchain ecosystem.

## Mandatory Reading Order

1. **[syntax/operator_table.md](syntax/operator_table.md)** — Operator Table (Core language framework)
2. **[syntax/grammar.pegjs](syntax/grammar.pegjs)** — PEG Grammar Specification
3. **[core/unit.md](core/unit.md)** — Complete Unit (`__`) Specification (Impacts all compiler passes)
4. **[core/coproduct_resolver.md](core/coproduct_resolver.md)** — Coproduct Resolver (Space operator semantic resolution)
5. **[core/execution_model.md](core/execution_model.md)** — Execution Model (File = Function, Heapless design)

---

## Directory Structure

```
impl/
├── 0_design_principles.md  ← Core Design Principles & RISC As-Is Philosophy
├── 1_definition.md         ← Formal Language Specification Definitions
├── README.md               ← This Index File
│
├── syntax/                 ← Lexical & Syntactic Passes
│   ├── operator_table.md     Operator Table (Precedence, position, Unit behavior)
│   ├── grammar.pegjs         PEG Grammar Spec (Parser baseline)
│   ├── hole_desugaring.md    Hole (_) Static Desugaring Algorithm
│   ├── match_case.md         match_case Desugaring & Implementation
│   └── operator_table.js     Operator Table Implementation Reference
│
├── core/                   ← Semantics & Runtime Model
│   ├── compiler_pipeline.md  Multi-Pass Compiler Pipeline Specification
│   ├── unit.md               Complete Unit (__) Spec (Math foundation & rules)
│   ├── coproduct_resolver.md Coproduct Resolver Algorithm
│   ├── execution_model.md    Execution Model (Main inline expansion)
│   ├── tco.md                Tail Call Optimization (TCO/TCE)
│   ├── system_semantics.md   $/@/# Semantics by Layer
│   ├── value_representation.md Bit-level Value Representation & Niche Optimization
│   └── integer_overflow.md   Integer Overflow Behavior Specification
│
├── type/                   ← Categorical Type System
│   ├── type_system.md        Type System, Monomorphization & Typechecking
│   ├── list_model.md         List Model, Conversions & N-Dim Arrays
│   ├── comparison.md         Scalar & Structural Comparison Return Rules
│   ├── zero_cost_abstraction.md Zero-Cost Abstraction Principles
│   └── operator_types.js     Operator Type Mapping Helper
│
├── build/                  ← Build Infrastructure & Code Generation
│   ├── system_architecture.md Layer Semantics & System Architecture Diagram
│   ├── build_system.md        option.ms Build System Specification
│   ├── option_ms_schema.md    option.ms Schema Definition
│   ├── entry_point.md         Entry Point (boot.sn) Specification
│   ├── link_strategy.md       Static & Dynamic Link Strategy
│   └── preprocessor.md        Preprocessor Implementation Guide
│
├── memory/                 ← Memory Model & ABI
│   ├── stack_abi.md          Low-level Stack Layout, Registers & Range ABI
│   └── memory_management.md  Lifetime Analysis & Memory Layer Allocations
│
└── appendix/               ← Categorical Background & Theory
    ├── kan_extensions.md     Kan Extension Validation of Sign Operators
    ├── categorical_truth.md  Mathematical Foundation of Categorical Truth
    └── motivation.md         Architectural Motivation & Background
```

---

## Compiler Pipeline Overview

> [!NOTE]
> Below is a high-level mapping diagram corresponding to pipeline passes. For exact specifications of Compiler Passes 1–4, see [`type/type_system.md` §5](type/type_system.md) and [`core/compiler_pipeline.md`](core/compiler_pipeline.md).

```
.sn Source Files
  ↓
[Pass 1 Lexer & Parser]       lexer.js & parse/minimal.pegjs
  Preprocess: Infix operator spacing, indent to \x02/\x03
  PEG Parse → AST. Collect identifiers into .ist table in linear O(n) scan.
  ↓
[Pass 2: Coproduct Resolver]   semanticize/coproduct_resolver.js
  Type-based space operator resolution (apply/compose/concat/reverse_apply)
  ↓
[Pass 3: Type Propagation]
  Left-hand priority Layer 2 type propagation
  ↓
[Pass 4: Code Generator]       wasm_codegen.js / aarch64.js / js_codegen.js
  Map type ledger to register templates & emit binary
  ↓
.wasm / .o / .js Output
```
