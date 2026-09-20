# Sign Module Design: Eliminating Code Duplication and Linking Overhead

> [!NOTE]
> **The canonical source is the Japanese document [link_strategy.md](../../../ja-jp/impl/build/link_strategy.md).**
> This English copy is a *derived translation* and is **behind** the canonical text
> (user ruling, 2026-09-21: "en-us is the older one"). Where the two disagree, the
> Japanese side wins — including against this file. Do not cite this file as the
> specification; read it as a reading aid, and fix the Japanese side when you find a gap.

## Issues with C/C++ Header Include Models

1. **Duplicate Code Generation**:
   - Header files expand recursively in every translation unit.
   - Massive code duplication is emitted during compilation.
   - While linkers deduplicate code later, it introduces build process inefficiency.

2. **Ambiguity of Static Data**:
   - `static` variables risk duplication across translation units.
   - Combining inline functions with static data creates subtle bugs.

3. **Limitations of Text Preprocessors**:
   - Macro text-substitution introduces global symbol collisons and scope leaking.

---

## The Sign Language Approach

Sign eliminates these issues via an explicit symbol-based module architecture using `@` (Import) and `#` (Export):

1. **Symbol-Based Import**:
   - Import specific symbols rather than raw header inclusion.
   - Code duplication is eliminated; exactly one static instance exists in memory.

2. **Explicit Export Marking**:
   - Only symbols prefixed with `#` are visible outside the module boundary.
   - Prevents accidental symbol leaks.

3. **Entity-Based Compilation**:
   - Eliminates artificial header vs implementation file splits.
   - Emits code strictly required by the dependency graph.

This model fundamentally resolves multi-definition issues, providing predictable memory layouts and efficient build pipelines.
