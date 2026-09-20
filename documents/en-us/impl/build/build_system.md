# Sign Build System Specification: `option.ms` & Compilation Layers

> [!NOTE]
> **The canonical source is the Japanese document [build_system.md](../../../ja-jp/impl/build/build_system.md).**
> This English copy is a *derived translation* and is **behind** the canonical text
> (user ruling, 2026-09-21: "en-us is the older one"). Where the two disagree, the
> Japanese side wins — including against this file. Do not cite this file as the
> specification; read it as a reading aid, and fix the Japanese side when you find a gap.

## 1. Overview

> [!IMPORTANT]
> **Build configurations in Sign are governed exclusively by `option.ms` (MetaObjectForSign) files.**
> This is a natural consequence of Sign's self-hosting philosophy: using Sign's data representation syntax to configure its own compiler.

Core principles:
1. **Declarative File Configuration**: CLI arguments serve purely for temporary overrides.
2. **Directory-Scoped Rules**: `option.ms` is placed only in directories requiring configuration changes.
3. **Lexical Inheritance**: Child subdirectories implicitly inherit parent configurations and override specified keys.
4. **Static Schema Isolation**: Dynamic options are prohibited; option keys are defined by strict static schemas.

---

## 2. The `ms` Format (MetaObjectForSign)

`ms` uses Sign's Product type syntax to represent build metadata.

| JSON | `ms` Equivalent |
|---|---|
| `"key": value` | `key : value` |
| Quoted string required | Identifiers as bare words, strings enclosed in backticks (`` `string` ``) |
| `null` / `false` | `__` (Unit) |
| Comments prohibited | Backtick comments at line start (`` ` Comment ``) |

---

## 3. Directory Inheritance Model

```
project/
  option.ms              ← Root config (Project defaults)
  │
  ├── kernel/
  │     option.ms        ← Overrides layer: 0 for kernel
  │     ├── drivers/
  │     │    └── uart.sn ← Inherits kernel/ settings
  │     └── mm/
  │           option.ms  ← Overrides optimize: 3
  │
  └── userspace/
        option.ms        ← Resets layer: 4 for host applications
```

---

## 4. Hardware Capability Layers (`layer`)

The `layer` configuration declares the hardware abstraction capabilities available to the compiler. Using capabilities disabled in a layer triggers a static compile-time error.

| Layer Number | Alias | Floating-Point | SIMD / Vector | Dynamic Allocations | Dynamic Linking |
|:---:|---|:---:|:---:|:---:|:---:|
| **0** | `bare` | ❌ Compile Error | ❌ Compile Error | ❌ Compile Error | ❌ Prohibited |
| **1** | `alloc` | ❌ Compile Error | ❌ Compile Error | ✅ `heap: max` | ❌ Prohibited |
| **2** | `fpu` | ✅ `Float` enabled | ❌ Compile Error | ✅ Enabled | ❌ Prohibited |
| **3** | `simd` | ✅ `Float` enabled | ✅ `Vector` enabled | ✅ Enabled | ❌ Prohibited |
| **4** | `std` | ✅ `Float` enabled | ✅ `Vector` enabled | ✅ Enabled | ✅ Dynamic / Static |

> [!IMPORTANT]
> **Inter-Layer Import Invariant**: A module cannot import another module with a higher `layer` requirement than its own.
