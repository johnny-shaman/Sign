# Sign System Architecture Specification: Layer Semantics & Adjunction Integration

> [!NOTE]
> **The canonical source is the Japanese document [system_architecture.md](../../../ja-jp/impl/build/system_architecture.md).**
> This English copy is a *derived translation* and is **behind** the canonical text
> (user ruling, 2026-09-21: "en-us is the older one"). Where the two disagree, the
> Japanese side wins — including against this file. Do not cite this file as the
> specification; read it as a reading aid, and fix the Japanese side when you find a gap.

## 1. Introduction & First Principles

Sign models low-level hardware control (such as OS kernels) up through high-level declarative logic within a single unified syntax.
This consistency rests upon **"Layer-based Semantic Shifting"** and **"Adjunctions between Export (Prefix) and Import (Postfix)"**.

Traditional languages split memory management, module resolution, linking strategies, and volatile hardware IO into separate features and external tools. Sign unifies them into the type system and operator adjunctions, resolved statically via build configuration (`option.ms`).

---

## 2. Automatic Link & Memory Derivation via Adjunctions

Export (prefix) and Demand (postfix) in Sign form a category-theoretic **Adjunction** ($L \dashv R$):

```
[Export] (Prefix / Declaration)   ⊣   [Demand] (Postfix / Reference)
      # / ## / ###                           @
```

### 2.1 Adjunction Pair Mapping

The compiler maps prefixed `#` export operators and postfixed `@` demand operators to physical memory layouts and linking models based on `layer` and `link` strategies:

| Export | Demand | Memory Allocation | Link Strategy |
| :--- | :--- | :--- | :--- |
| **`#foo : expr`** (Rc) | **`foo@`** | project-arena (Local Bump / Stack) | Static resolution (Inlined or same object) |
| **`##foo : expr`** (Arc) | **`foo@`** | shared-heap (Shared Virtual Memory) | Static link (`link: static`) or Dynamic (`link: dynamic`) |
| **`###foo : expr`** (Pin) | **`foo@`** | pinned-area (Fixed Physical / Virtual Memory) | Static/Dynamic FFI boundaries or Pinned sections |

---

## 3. Semantic Shifting via Layers (`layer`)

Declaring `layer` in `option.ms` (`0`: bare, `1`: alloc, `2`: fpu, `3`: simd, `4`: std) shifts operator semantics cleanly between bare-metal physical hardware and high-level OS runtimes.

### 3.1 Operator Shifting for `@` (Load/Demand) and `#` (Store/Allocation)

#### Layer 0 (bare): Bare Metal / Hardware Control Layer
- **Prefix `@` (`@ptr`) / Infix `#` (`ptr # val`)**: Shift implicitly to **volatile read / volatile write**. Prevents compiler optimization from dropping MMIO registers.
- **Prefix `#` (`#expr`) / `##`**: **Compile Error**. Heap memory is unavailable; `Rc`/`Arc` allocation is prohibited.
- **Postfix `@` (`foo@`)**: Static symbol resolution only.

#### Layer 1 (alloc) / Layer 2 (fpu) / Layer 3 (simd): Virtual Memory / Local Allocator Layers
- **Prefix `@` / Infix `#`**: Standard memory load/store (`*ptr` / `*ptr = val`).
- **Prefix `#` / `##`**: Enabled (`Rc<RefCell<T>>` / `Arc<Mutex<T>>`).
- **Postfix `@`**: Static symbol link resolution only.

#### Layer 4 (std): OS & Dynamic Runtime Layer
- **Prefix `@` / Infix `#`**: Standard memory load/store.
- **Prefix `#` / `##`**: Enabled.
- **Postfix `@`**: Dynamic runtime symbol resolution (`dlopen` equivalent).

### 3.2 Layer Semantic Shift Matrix

| Operator Form | layer 0 (bare) | layer 1–3 (alloc/fpu/simd) | layer 4 (std) |
| :--- | :--- | :--- | :--- |
| **Infix `#`** (`ptr # val`) | `write_volatile` | `*ptr = val` | `*ptr = val` |
| **Prefix `@`** (`@ptr`) | `read_volatile` | `*ptr` | `*ptr` |
| **Prefix `#` / `##`** (alloc) | ❌ Compile Error | ✅ `Rc` / `Arc` Allocation | ✅ `Rc` / `Arc` Allocation |
| **Postfix `@` (link: static)** | ✅ Static Symbol Resolution | ✅ Static Symbol Resolution | ✅ Static Symbol Resolution |
| **Postfix `@` (link: dynamic)**| ❌ Compile Error | ❌ Compile Error | ✅ Dynamic Shared Symbol Resolution |
