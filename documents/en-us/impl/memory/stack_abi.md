# Range List Allocation & Stack ABI Specification

> [!NOTE]
> **The canonical source is the Japanese document [stack_abi.md](../../../ja-jp/impl/memory/stack_abi.md).**
> This English copy is a *derived translation* and is **behind** the canonical text
> (user ruling, 2026-09-21: "en-us is the older one"). Where the two disagree, the
> Japanese side wins — including against this file. Do not cite this file as the
> specification; read it as a reading aid, and fix the Japanese side when you find a gap.

This document defines how range list expressions (`[start ~ end]`, `[start ~+ step ~ end]`), function applications, and partial applications lower into pure stack allocations (`alloca`) and zero-overhead System V register calls without dynamic heap usage.

---

## 1. Core Principles: Non-Escaping Local Allocation

In Sign, functions operate without runtime heap closures because all internal functions are monomorphized statically into `main.sn`. Stack frames do not outlive their caller context.

- **Stack-First (`alloca`) Guarantee**: Arrays, vectors, and closures allocate on the execution stack via `alloca`.
- **System V Register ABI**: Fully-saturated function calls pass arguments purely through registers (`rdi`, `rsi`, `rdx`, `rcx`, `r8`, `r9`), requiring zero stack frame overhead.

---

## 2. Range Expressions (`~`) & Iterators

Range expressions (`[1 ~ 5]`, `[0 ~+ 2 ~ 10]`) are **Iterator Structs** `{ start, step, end }` allocated statically. Memory is never expanded for elements.

```sign
sum : [1 ~ 5]
```

Compiles to an inline loop:
```c
// Lowered C-equivalent loop representation
int sum = 0;
for (int i = 1; i <= 5; i += 1) {
    sum += i;
}
```

Open-ended ranges (`c : [0 ~+ 1]`) compile into tight loop counter registers (`inc rax; jmp .loop`).

---

## 3. Function Application ABI: Fully Saturated vs Partial

### 3.1 Fully Saturated Applications (Zero Overhead Register Pass)

When function parameters are satisfied statically:
```sign
add 3 5
```

```assembly
; System V ABI Register Pass
mov rdi, 3
mov rsi, 5
call add
```

### 3.2 Partial Applications (Contiguous Struct + Function Pointer)

When fewer arguments are passed than required, the partial application lowers to a contiguous struct on the stack via `alloca`:

```sign
add3 : add 3   ` Partial application
add3 5         ` Full application
```

```c
// Stack Closure Allocation
struct {
    void (*fn)(int, int);
    int captured_a;
} *closure = alloca(sizeof(*closure));

closure->fn = &add;
closure->captured_a = 3;

// Invocation
closure->fn(closure->captured_a, 5);
```

This structure matches the Linux Kernel VFS `file_operations` idiom:
```c
struct file_operations {
    ssize_t (*read)(struct file *f, char __user *buf, size_t len);
};
```

---

## 4. `alloca` Dual Allocation Strategies

| Data Kind | `alloca` Target Form | Purpose / Characteristics |
|---|---|---|
| **Partial Application Closure** | Closure Struct `{ fn_ptr, captured_args... }` | Random access $O(1)$, context passing |
| **`List` / `Array`** | Contiguous Element Memory Block | SIMD Vectorization, Cache locality |
| **`Struct` / `Dict`** | Fixed Offset Block | Statically computed alignment and fields |
| **Multi-Dimensional Slice** | Row-Major Contiguous Block | Zero-copy indexing via `'` chain |

---

## 5. Multi-Dimensional Slicing & Zero-Copy `'` Chain

Slicing multi-dimensional matrices via `'` computes index offsets statically without copying memory:

```sign
matrix ' [1 ~ 2] ' [0 ~ 3]
```

Lowers directly to pointer offset arithmetic (`base + 1 * cols * sizeof(elem)`), supporting SIMD vectorization at `layer >= 3`.
