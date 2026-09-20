# Value Representation Specification: Character Boxing & Physical Unit Representation

> [!NOTE]
> **The canonical source is the Japanese document [value_representation.md](../../../ja-jp/impl/core/value_representation.md).**
> This English copy is a *derived translation* and is **behind** the canonical text
> (user ruling, 2026-09-21: "en-us is the older one"). Where the two disagree, the
> Japanese side wins — including against this file. Do not cite this file as the
> specification; read it as a reading aid, and fix the Japanese side when you find a gap.

## 1. Overview

The `Char` type in Sign adopts **Standard UTF-8 (RFC 3629 compliant)** encoding. Modified UTF-8 (MUTF-8) or overlong sequences are strictly prohibited. 

> [!IMPORTANT]
> **Character "Boxing" in Sign refers directly to standard UTF-8 lead-byte bit patterns (`0xxxxxxx` / `110xxxxx` / `1110xxxx` / `11110xxx`).**
> Byte sequence length information is obtained with zero overhead directly from UTF-8 self-describing bit patterns.

---

## 2. Standard UTF-8 Encoding Rules

| Code Point Range | Byte Sequence | Lead Byte Pattern |
| --- | --- | --- |
| `U+0001` to `U+007F` | `0xxxxxxx` | 1 byte (ASCII compatible) |
| `U+0080` to `U+07FF` | `110xxxxx 10xxxxxx` | 2 bytes |
| `U+0800` to `U+FFFF` (Excluding surrogates) | `1110xxxx 10xxxxxx 10xxxxxx` | 3 bytes |
| `U+10000` to `U+10FFFF` | `11110xxx 10xxxxxx 10xxxxxx 10xxxxxx` | 4 bytes |

> [!NOTE]
> `U+0000` and surrogate ranges (`U+D800`–`U+DFFF`) are strictly excluded from valid `Char` code points.

---

## 3. `__` (Unit) and `U+0000` Niche Optimization

### 3.1 Basic Principle

Because `U+0000` carries no practical text utility in modern string semantics, Sign structurally excludes this single value from the `Char` domain:

$$\text{Char Domain} := \{ U+0001, \dots, U+D7FF \} \cup \{ U+E000, \dots, U+10FFFF \}$$

The single excluded bit pattern of `U+0000` is reused in `Char` contexts to represent **`__` (Unit)** as a zero-cost **niche optimization** (isomorphic to Rust's `Option<char>`).

### 3.2 Allocation Convention: `.rodata + 0x00 = $0u00`

The compiler reserves the niche slot at offset `0x00` of the `.rodata` section:

$$\$0u00 = \text{Start Address of } .rodata + 0x00$$

### 3.3 Boot-Up Fixed Point: $\$__ = @__ = __$

By initializing the niche slot to contain its own address, the following fixed point holds:

$$\$__ = @__ = __$$

- **Layer 0 (Bare-Metal)**: Resolved statically by the linker as a relative relocation (`R_*_RELATIVE`) written into Flash/ROM.
- **Layer 1+ (OS)**: Self-relocated by the loader before setting page protections (`mprotect`).

---

## 4. Strict Separation of `Char` and `Byte` Types

Binary data requiring full 8-bit coverage (`0x00`–`0xFF`) is handled by the **`Byte` type** rather than `Char`.

| Feature | `Char` Type | `Byte` Type |
| --- | --- | --- |
| **Domain** | Unicode Scalar Values (Excl. `U+0000`, Surrogates) | Complete `0x00`–`0xFF` range |
| **Niche Optimization** | Yes (`U+0000` represents `__`) | None |
| **Termination Form** | No sentinel required (`__` is niche) | Externalized length (`[len ~bytes]`) |
| **Primary Use Cases** | Human text, Strings | Raw binary, FFI boundaries, Images |

---

## 5. Identity Morphism (`!__`) Dispatch

The identity function `!__` (`∀A. A -> A`) is synthesized directly by the compiler as a pure identity lambda without taking up encoding space in string buffers.
