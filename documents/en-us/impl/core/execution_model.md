# Sign Execution Model: Every Function is an Inlined Inner Function of `main`

> [!NOTE]
> **The canonical source is the Japanese document [execution_model.md](../../../ja-jp/impl/core/execution_model.md).**
> This English copy is a *derived translation* and is **behind** the canonical text
> (user ruling, 2026-09-21: "en-us is the older one"). Where the two disagree, the
> Japanese side wins — including against this file. Do not cite this file as the
> specification; read it as a reading aid, and fix the Japanese side when you find a gap.

## Core Principle

> **Every function in Sign is statically inlined as an inner function of a single top-level entry function: `main.sn`.**

This is the foundational invariant of Sign's execution model.

---

## 1. File Name = Entry Point = Function Name

In Sign, `.sn` files are function definitions. The file name dictates the function identifier.

```
add.sn       →  Definition of function `add`
multiply.sn  →  Definition of function `multiply`
main.sn      →  Program entry point
```

`main.sn` forms the outermost scope of the binary. All imported `.sn` files are brought into scope as inner functions nested inside `main`.

> [!IMPORTANT]
> **One file is one function — a rule, not a metaphor** (user, 2026-10-04). A `.sn` file defines exactly one
> function, named after the file. Every other definition in the file is an inner definition of that function and is
> invisible outside. Only the exports written with prefix `#` inside the function's block are visible; the export set
> is built from those `#` lines. The only exception is `main.sn`: `main` is the outermost scope itself, so it exists
> only as a file. Reading "a file runs like one function" as a metaphor (any number of top-level definitions, all
> visible) is rejected; name clashes between helpers of different files come only from that reading.

---

## 2. Imports as Inner Function Definitions

```sign
` ← Imports add.sn
`add.sn`@~
```

This operation does not dynamically load a file at runtime; it statically binds `add` as an inner function in the local scope.

Both import spellings resolve at compile time: `` `math.sn`@ `` is the function `math` itself (its exports are
looked up by name: `` add @ `math.sn`@ ``), and `` `math.sn`@~ `` defines `math` and spreads its **exports** into the
current scope. Inner helpers are never spread. (alpha has not landed this yet: it spreads every top-level binding,
and the unspread form returns the literal text.)

---

## 3. Partial Application via Compile-Time Monomorphization

```sign
add3 : add 3
` → 8
add3 5
```

`add3` does not allocate a runtime closure object. Instead, the compiler generates a specialized static function `add3` inlined into `main`.

---

## 4. Elimination of Closure Escaping Issues

Dangling pointer issues caused by closures outliving stack frames do not exist in Sign:
- All "closures" are static functions monomorphized during compilation.
- Inner function lifetime = `main` lifetime = Duration of program execution.
- Heap allocation and GC are absent by design.

---

## 5. Result: Zero Heap Allocation

| Construct | Allocation Mechanism | Rationale |
|------|---------|------|
| Fully-Applied Function Calls | Register Passing | Statically determined |
| Partial Application | Compile-Time Monomorphization | Zero runtime closure objects |
| Arrays / Structs (`layer >= 1`) | `alloca` Contiguous Block | Automatically reclaimed at scope exit |
| Scoped Variables | `main` Stack Frame | Lifetime equals program execution |
