# Sign Standard Library Memory Allocation & Lifetime Specification

> [!NOTE]
> **The canonical source is the Japanese document [memory_management.md](../../../ja-jp/impl/memory/memory_management.md).**
> This English copy is a *derived translation* and is **behind** the canonical text
> (user ruling, 2026-09-21: "en-us is the older one"). Where the two disagree, the
> Japanese side wins — including against this file. Do not cite this file as the
> specification; read it as a reading aid, and fix the Japanese side when you find a gap.

This document defines the **Standard Library Memory Allocation Models** (Project-Arena / Shared-Heap / Pinned-Area), binding rules, reference counting (RC/ARC), and module unloading policies.

---

## 1. Architectural Memory Pools

- **Project-Arena**: Per-project memory pool. Allocated via bump allocation and deallocated en masse upon module unload.
- **Shared-Heap**: Process-wide shared heap managed via reference counting (RC/ARC).
- **Pinned-Area**: Memory locked to fixed physical/virtual addresses for hardware IO buffers and FFI boundaries (unload prohibited).

---

## 2. Operator Syntactic Mappings

- **Prefix `#` (Project Allocation)**: Allocates within Project-Arena (`#expr`). Enabled in `layer >= 1`.
- **Prefix `##` (Shared / ARC Allocation)**: Allocates RC/ARC managed memory within Shared-Heap (`##expr`). Enabled in `layer >= 1`.
- **Prefix `###` (Pinned Allocation)**: Allocates non-relocatable buffer within Pinned-Area (`###expr`). Enabled in `layer >= 1`.
- **Infix `#` (Store)**: Writes value to target address (`ptr # val`). Functions as `write_volatile` in `layer: 0`.
- **Prefix `@` (Load)**: Reads value from target address (`@ptr`). Functions as `read_volatile` in `layer: 0`.

| Operator | layer: 0 | layer: 1+ |
|:---:|:---:|:---:|
| **Infix `#` (Store)** | ✅ `write_volatile` | ✅ Standard Store |
| **Prefix `@` (Load)** | ✅ `read_volatile` | ✅ Standard Load |
| **Prefix `#` (Project Alloc)** | ❌ Compile Error | ✅ Enabled |
| **Prefix `##` (Shared Alloc)** | ❌ Compile Error | ✅ Enabled |
| **Prefix `###` (Pin Alloc)** | ❌ Compile Error | ✅ Enabled |

---

## 3. Top-Level Evaluation & Binding Rules

1. **`name : #e` (Project-Arena Allocation)**:
   - Evaluates `e` to value `v`.
   - Allocates location `l` in project-arena, sets `store[l] := v`.
   - Binds `G[name] := ref(l)`.

2. **`name : ##e` (Shared-Heap Promotion)**:
   - Evaluates `e` to value `v`.
   - Allocates location `l` in shared-heap, sets `shared[l] := v`, `rc[l] := 1`.
   - Registers symbol in module export table.

3. **`name : ###e` (Pinned Allocation)**:
   - Allocates non-relocatable location `l_pin` in static pinned-area.
   - Binds `G[name] := ref(l_pin)`. Unload is prohibited.

---

## 4. Small-Step Operational Semantics Rules

$$\text{(Allocation)} \quad \frac{G, \rho \vdash e \Downarrow v \quad l \text{ fresh in project-arena} \quad \sigma' = \sigma[l \mapsto v]}{\text{load\_top}([: \text{name}, \#e], G, \sigma) \Rightarrow G[\text{name} \mapsto \text{ref}(l)], \sigma'}$$

$$\text{(Deref)} \quad \frac{G \vdash r \Downarrow \text{ref}(l) \quad \text{store}(l) = v}{\langle [@, r], G, \sigma \rangle \to \langle v, G, \sigma \rangle}$$

$$\text{(Store)} \quad \frac{G \vdash \text{lhs} \Downarrow \text{ref}(l) \quad G \vdash \text{rhs} \Downarrow v \quad \sigma' = \sigma[l \mapsto v]}{\langle [\#, \text{lhs}, \text{rhs}], G, \sigma \rangle \to \langle v, G, \sigma' \rangle}$$

---

## 5. Unloading & Lifetime Management Policies

- **Project-Arena Unload**: Released en masse when the module unloads, provided no external references remain.
- **Shared-Heap RC/ARC**: Decrements `rc` when references go out of scope. Deallocates when `rc == 0`.
- **Pinned-Area**: Locked in place permanently; unload prohibited without explicit loader override.
- **Strongly Connected Component (SCC) Unloading**: Mutual module dependencies unload atomically by SCC unit.

---

## 6. Standard Library APIs

- `inc(ref)` / `dec(ref)`: Non-atomic increment / decrement of reference counts.
- `atomic_inc(ref)` / `atomic_dec(ref)`: Thread-safe atomic reference count updates for `layer 1+`.
- `deref(ref)`: Equivalent to `@ref`.
- `assign(ref, value)`: Equivalent to `ref # value`.
