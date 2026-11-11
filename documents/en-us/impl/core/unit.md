# Complete Specification of Unit (`!_`) in Sign

> [!NOTE]
> **The canonical source is the Japanese document [unit.md](../../../ja-jp/impl/core/unit.md).**
> This English copy is a *derived translation* and is **behind** the canonical text
> (user ruling, 2026-09-21: "en-us is the older one"). Where the two disagree, the
> Japanese side wins — including against this file. Do not cite this file as the
> specification; read it as a reading aid, and fix the Japanese side when you find a gap.

## 0. Quick Reference & Core Invariants

### 0.1 Convergence of Undefined Identifiers to Unit (Zero Reserved Words)

Sign contains zero reserved words (`null`, `nil`, `false` do not exist).
**Any identifier undefined in the current scope evaluates to `!_` (Unit).**

#### Virtual Keywords
Users may use arbitrary identifiers as zero-cost virtual keywords:
```sign
@lazy tick
@iterator next
```
Undefined identifiers (`tick`, `next`) evaluate safely to `!_`, functioning as natural readable markers.

### 0.2 Isomorphism of Unit and False under Short-Circuiting

Logical AND (`&`) and OR (`|`) evaluate via short-circuiting:
```sign
append : [x ~xs] [y ~ys] ?
	xs & x (append xs (y ys)) | @x y ys
```
- Non-empty `xs` (truthy) evaluates the recursive step.
- Empty `xs` (`!_` / falsy) evaluates the right-hand termination branch.

### 0.3 Operator Invalidation

```sign
[+] : a b ? !_
```
Taking the two operands `a` `b` and explicitly returning `!_` safely collapses the expression to `!_`.
(This used to absorb the operands with a variadic `~x`; a bare `~x` outside brackets — a bare stream parameter — was abolished on 2026-10-04.)

This is scoped operator overloading, not only invalidation (user, 2026-10-05): the override applies only inside the block where it
is written and in the limited scope that imports it; the operator table itself does not change. Returning `!_` disables the
operator there; returning another expression gives it another meaning there (inside `[+] : a b ? a * b`, `2 + 3` is 6). An override
written in a file stays inside that file's function; only `#`-exported overrides reach importers. Scopes and imports are resolved
at compile time, so each operator resolves statically to its definition — no runtime cost.

### 0.4 `$!_` and `@!_` Behavior: Unit Absorbs All Operators

> [!CAUTION]
> **`!_` (void) cannot be written in user source** (user ruling 2026-11-10). `!_`, `$!_` and `@!_` in this document are specification notation. `!_` has its own address, so it also has the face of an Address, and `$!_ = !_ = @!_` ([`value_representation.md`](value_representation.md) §3.3) holds.

`$` (Address-Of) and `@` (Dereference) absorb `!_`:
```sign
$!_   = !_
@!_   = !_
@$!_  = !_
```

---

## 1. Introduction & Categorical Foundation

`!_` represents the **Zero Object** ($\mathbf{0} \cong \mathbf{1}$) of Sign as a Category:

$$\mathbf{0} \cong \text{Initial Object} \cong \text{Terminal Object}$$

| Category Role | Operation | Semantics |
|:---:|:---:|---|
| **Terminal Object** (Absorbing in Product) | `&`, `+`, `*`, ... | `!_ op x = !_` |
| **Initial Object** (Identity in Coproduct) | `|`, `;`, ` `, `,` | `!_ op x = x` |

---

## 2. Bialgebraic Foundation

### 2.1 Basic Properties

- **Zero Object**: Convergence of initial and terminal objects in Category Theory.
- **Identity of Bialgebra**: Identity element for both List structures (coalgebra) and function composition (algebra).
- **Value Semantics**: `!_ = []` (Isomorphic to empty list).
- **Function Semantics**: Passes through operations as coproduct identity element.

### 2.2 Bialgebra Structure Definition

Lists in Sign form a bialgebra $(L, \text{unit}, \text{join}, \text{extract}, \text{duplicate})$:

#### Monad Structure
- $\text{unit} : A \to \text{List } A$ where $\text{unit}(x) = [x]$
- $\text{join} : \text{List}(\text{List } A) \to \text{List } A$ where $\text{join}([[a_1, a_2], [b_1, b_2]]) = [a_1, a_2, b_1, b_2]$

#### Coalgebra Structure
- $\text{extract} : \text{List } A \to A$ where $\text{extract}([x]) = x$, $\text{extract}([]) = \mathbf{1}$
- $\text{duplicate} : \text{List } A \to \text{List}(\text{List } A)$ where $\text{duplicate}([a, b]) = [[a], [b]]$, $\text{duplicate}([]) = [[]]$

---

## 3. Complete Operator Specifications for Unit

### 3.1 Arithmetic Asymmetric Unit Propagation Rules

- `!_ + X -> !_` (LHS Unit acts as zero morphism / absorbing element)
- `X + !_ -> X` (RHS Unit acts as identity morphism / transparent pass-through)

### 3.2 Comparison Operator Absorption Rules

- Both LHS and RHS Unit collapse to `!_` in comparison operations (`<`, `<=`, `=`, `>=`, `>`).
- Exception: `X != !_` returns `X` when `X` is non-Unit (Logically True).

### 3.3 Function Application & Arity

- Unsaturated functions applied to `!_` collapse to `!_` (Completeness Axiom: $f\ \mathbf{1} = \mathbf{1}$).
- Functions with declared default arguments fallback to default expressions upon receiving `!_`.

---

## 4. Assembly & ARM64 Implementation Mapping

- **Null Pointer**: `!_` is represented physically as a NULL pointer (`0x00`).
- **Binary Wire Format**: `\x00` in raw input streams signals Unit type tokens without requiring 2-byte ASCII `!_`.

---

## 5. Unit Traceability & Dynamic Payload in Debug Environments

In production environments and bare-metal Layer 0 execution, Unit (`!_`) operates as a zero-overhead zero object with immediate register-level collapse. In **scriptable high-resolution debug layers (Scriptable/Debug Layer)**, Sign provides a dynamic payload mechanism to trace the **Causal Trajectory** of a collapsed Unit:

1. **Causal Trajectory Retention**:
   - Captures recent pattern matching history and local variable stack frames.
   - Preserves clear `Text` descriptions generated by failed `match_case` assertions.
2. **Low-Level Hardware Clock & Sequence ID Reconciliation**:
   - Includes hardware-clocked timestamps and sequence IDs within the payload to reconcile scriptable trace data with Layer 0 execution logs without corrupting zero-overhead bare-metal layers.
3. **Elimination of Log Landfills**:
   - Eliminates bloated stack traces and log files ("landfills") by embedding minimal diagnostic context directly into the Unit's propagation path, accessible on-demand via reactive snapshots.

This ensures seamless dual-mode operation: zero-overhead bare-metal performance in production, and deterministic observability in debug layers.
