# Sign Language Architectural Motivation & Vision

> [!NOTE]
> **The canonical source is the Japanese document [motivation.md](../../../ja-jp/impl/appendix/motivation.md).**
> This English copy is a *derived translation* and is **behind** the canonical text
> (user ruling, 2026-09-21: "en-us is the older one"). Where the two disagree, the
> Japanese side wins — including against this file. Do not cite this file as the
> specification; read it as a reading aid, and fix the Japanese side when you find a gap.

## Core Vision: Why Create Sign?

In short, Sign is designed as:

> **"A language for AI systems to generate robust bare-metal and system-level software."**

---

## 1. Target Audience

The primary user of Sign is **AI systems (Large Language Models and automated code generators)**.
Human software engineers serve as secondary users responsible for reviewing architectural intent.

Humans can comfortably read Sign once familiarized, though few humans would proactively author raw Sign by hand. This is an intentional design choice rather than a limitation.

AI code generation systems require:
- Mathematical and category-theoretic structural determinism.
- Exception-free, predictable evaluation semantics.
- Minimal syntactic ambiguity.
- Static compile-time hardware capability validation (`layer`).
- Execution models capable of running bare-metal without an operating system or C runtime.

Sign delivers on all five requirements.

---

## 2. Why Bare Metal & OS-Independent Ecosystems?

Sign operates independently of the traditional C standard library ecosystem:
- BIOS / UEFI boot sequences can be expressed natively.
- FPU and SIMD state initialization are verified via `layer` constraints.
- Ram can be allocated as linear stacks and project arenas.

AI systems can emit code running on bare metal without OS dependencies, paving the way for autonomous hardware control firmware generation.

---

## 3. Design Principles vs AI Affinities

| Sign Design Choice | Advantage for AI Code Generation |
|-------------|-----------------|
| **Zero Reserved Words** | Eliminates keyword collision risks and reserved keyword checking. |
| **Unit (`__`) Propagation** | Exception-free, mathematically deterministic semantics. |
| **Linear Type Inference ($O(n)$)** | Syntax tree shape directly resolves types without constraint solvers. |
| **`layer` Constraints** | Using float literals in `layer < 2` triggers static compile errors. |
| **`'` Composition Chain** | Multi-dimensional indexing translates to composition of maps. |
| **Zero Heap Allocation** | Currying and partial application require zero runtime dynamic closures. |

---

## 4. Human-AI Collaboration Model

Sign establishes a cooperative workflow model:
- **AI**: Generates Sign source code with mathematical correctness.
- **Human**: Defines high-level architecture and reviews emitted Sign.
- **Compiler**: Statically enforces hardware layer and type safety invariants.
