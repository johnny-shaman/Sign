# Sign Binary Entry Point Specification

## Overview

In Sign's execution model, `main.sn` is the logical entry point. However, during bare-metal execution, a physical entry address (the initial address jumped to by the CPU) is required.

Physical entry addresses and initial stack pointers are declared via `entry` and `stack` in `option.ms`. The compiler generates the **startup stub automatically**, eliminating the need for `crt0.s` or custom assembly.

---

## 1. Schema Extensions in `option.ms`

```ms
target : x86_bios
layer  : 0
entry  : 0x7C00
stack  : 0x7BFF
```

| Field | Type | Description |
|---|---|---|
| `entry` | Address | Physical memory address jumped to by the CPU |
| `stack` | Address | Initial stack pointer value set by the startup stub |
| `target` | Identifier | Target architecture (supplies defaults when omitted) |

---

## 2. Target Architecture Defaults

| Target | `entry` Default | `stack` Default | Primary Use Case |
|---|---|---|---|
| `x86_bios` | `0x7C00` | `0x7BFF` | MBR BIOS bootloader |
| `x86_firmware` | `0xFFFFFFF0` | `0x00090000` | CPU Reset Vector (UEFI replacement) |
| `aarch64_rpi` | `0x80000` | `0x80000` | Raspberry Pi 3/4 bare metal |
| `aarch64_qemu` | `0x40080000` | `0x40200000` | QEMU virt board |
| `cortex_m` | `rom.origin` | `ram.origin + ram.length` | STM32 Cortex-M microcontrollers |
| `riscv64` | `0x80000000` | `0x80200000` | QEMU / SiFive RISC-V |

---

## 3. Compiler-Generated Startup Stubs

### 3.1 x86_bios Stub (Assembly Concept)
```asm
BITS 16
ORG 0x7C00

_start:
    cli
    xor ax, ax
    mov ds, ax
    mov es, ax
    mov ss, ax
    mov sp, 0x7BFF
    sti
    jmp _.main
```

### 3.2 `x86_firmware` Stub: Transition from Reset Vector to Long Mode
For `x86_firmware`, the generated `boot.sn` initializes Real Mode, transitions to 32-bit Protected Mode (GDT load, `CR0.PE`), enables PAE and Long Mode (`CR4.PAE`, `EFER.LME`, `CR0.PG`), and sets the 64-bit stack pointer before calling `main.sn`.

---

## 4. Comparison: C vs Sign

| Responsibility | C Ecosystem | Sign Language |
|---|---|---|
| **Entry Address** | Linker script (`.ld`) | `entry` in `option.ms` |
| **Initial Stack Pointer** | Manual in `crt0.s` | `stack` in `option.ms` |
| **Startup Stub** | Handwritten `crt0.s` | **Compiler Auto-Generated (`boot.sn`)** |
