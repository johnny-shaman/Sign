# `option.ms` Configuration Schema Specification

> [!NOTE]
> **The canonical source is the Japanese document [option_ms_schema.md](../../../ja-jp/impl/build/option_ms_schema.md).**
> This English copy is a *derived translation* and is **behind** the canonical text
> (user ruling, 2026-09-21: "en-us is the older one"). Where the two disagree, the
> Japanese side wins — including against this file. Do not cite this file as the
> specification; read it as a reading aid, and fix the Japanese side when you find a gap.

## 1. Overview

`option.ms` is the official configuration format for the Sign compiler build system. It uses the standard `.ms` format (indentation-based map syntax) to define layers, target architectures, memory layouts, and optimization flags.

---

## 2. Minimal Example

```ms
target   : x86_firmware
layer    : 0
optimize : 0
link :
    static :
        memory :
            rom : origin 0xFFFFF000  length 64K
            ram : auto
```

---

## 3. Core Schema Fields

| Field Name | Type | Allowed Values | Default Value | Description |
|---|---|---|---|---|
| `target` | string | `rust`, `x86_bios`, `x86_firmware`, `aarch64_rpi`, `cortex_m`, `wasm`, `custom` | `rust` | Execution target architecture |
| `layer` | integer | `0`, `1`, `2`, `3`, `4` | `4` | Hardware capability restriction layer |
| `optimize` | integer | `0`, `1`, `2`, `3` | `0` | Optimization level |
| `output` | string | `` `exec` ``, `` `static` ``, `` `dynamic` ``, `` `module` `` | `` `exec` `` | Output binary format |
| `entry` | address | Memory address (e.g. `0x7C00`, `0x80000`) | Target-dependent | Program entry point address |
| `stack` | address / spec | Memory address or `top` | `top` | Initial stack pointer location |
| `inherit` | boolean | `true`, `false` | `true` | Inherit parent directory `option.ms` |

---

## 4. Layer Restrictions (`layer`)

| Layer | Name | Floating-Point | SIMD / Vector | Dynamic Allocations | Purpose |
|:---:|---|:---:|:---:|:---:|---|
| **0** | `bare` | ❌ Compile Error | ❌ Compile Error | ❌ Compile Error | BIOS / UEFI bootloaders, bare-metal reset vectors |
| **1** | `core` | ❌ Compile Error | ❌ Compile Error | ✅ Enabled (`heap: max`) | Microcontrollers without FPU (Cortex-M0, etc.) |
| **2** | `fpu` | ✅ `Float` enabled | ❌ Compile Error | ✅ Enabled | Bare-metal environments with FPU |
| **3** | `simd` | ✅ `Float` enabled | ✅ `Vector` enabled | ✅ Enabled | High-performance vector processing |
| **4** | `std` | ✅ `Float` enabled | ✅ `Vector` enabled | ✅ Enabled | OS host environments (Standard library available) |

---

## 5. Linking Configuration (`link`)

### 5.1 Static Linking & Memory Allocation Schema

```ms
layer : 1
link :
    static :
        memory :
            rom  : origin 0x08000000  length 1024K
            ram  : origin 0x20000000  length 128K
            heap : max 32K
```

---

## 6. Directory Hierarchy & Inheritance

Parent `option.ms` configurations are inherited recursively up the directory tree unless `inherit: false` is declared explicitly.

---

## 7. Practical Template Configurations

### 7.1 Host Application (Default)
```ms
target   : rust
layer    : 4
optimize : 0
```

### 7.2 BIOS Bootloader
```ms
target   : x86_bios
layer    : 0
link :
    static :
        memory :
            rom : origin 0x7C00   length 512
            ram : origin 0x9000   length 512K
```

### 7.3 Raspberry Pi 4 Bare Metal
```ms
target   : aarch64_rpi
layer    : 0
link :
    static :
        memory :
            rom : origin 0x80000    length 1M
            ram : origin 0x200000   length 256M
```
