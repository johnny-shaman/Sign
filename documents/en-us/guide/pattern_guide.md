# Sign Language Design Notes: Monadic and Comonadic Features in Function Definition & Evaluation

> [!NOTE]
> **The canonical source is the Japanese document [pattern_guide.md](../../ja-jp/guide/pattern_guide.md).**
> This English copy is a *derived translation* and is **behind** the canonical text
> (user ruling, 2026-09-21: "en-us is the older one"). Where the two disagree, the
> Japanese side wins — including against this file. Do not cite this file as the
> specification; read it as a reading aid, and fix the Japanese side when you find a gap.

## Maybe (Equivalent to `if ~ then ~ else` in Conventional Languages)

- When `Unit` is implicitly passed to an argument, the function is not executed. (Note: Explicitly passing `Unit` acts as a placeholder and carries a distinct semantic).
- Consequently, the `else` branch corresponds to default argument values (if no default value is explicitly specified, `Unit` is the default).
- Note: If insufficient arguments are supplied, a partially applied function expecting the remaining arguments is returned. Non-executed functions collapse to `Unit`, yielding a `Unit` -> `Unit` propagation.
- In Sign: **Unexecuted Function $\cong$ Unit (Isomorphic to Unit)**.

```sign
f : x y ? x + y

` 3 < 2 evaluates to False (__ Unit), so Unit is returned
f (3 < 2) 2

g :
		x : 0
		y : 0
	?
		x + y

` Default value of x is 0. Even if (3 < 2) returns Unit, x defaults to 0, yielding 2.
g (3 < 2) 2
```

---

## List (Equivalent to Iterators in Conventional Languages)

- To pass a List to a function as a stream/sequence of individual arguments, use the postfix `~` operator.
- Postfix `~` distributes list elements into their respective argument slots.

```sign
f : a b c ? a + b + c

list1 : 1 2 3
list2 : 1 , 2 , 3

` Equivalent to f 1 2 3
f list1~
f list2~
f [1,2,3]~
f [1 2 3]~
```

---

## Either (Equivalent to `try ~ catch ~ finally` in Conventional Languages)

- `match_case` enables conditional branching within function definitions, preventing infinite recursion.
- When an abnormal condition occurs inside `match_case`, returning `Unit` signals failure/early exit (assertion: output error and return `Unit`).
- Normal evaluation and recursive loops can be written concisely.

```sign
f : x y ?
	x < 0 : `Error : x is negative`
	y < 0 : `Error : y is negative`
	x * y

` Returns 6
f 2 3

`
` Returns `Error : x is negative
f -1 -1
f -1 2

`
` Returns `Error : y is negative
f 2 -1
```

---

## State (Equivalent to Variable Definition and Mutation)

- Default argument specifications allow simple expressions for handling state transitions.

```sign
f :
		x : x + 1
		y : x + y
	?
		x > 10 : y
		f x y

` Returns 60
f 0 5
```

---

## IO Reader / Writer

- Default value computations may contain prefix dereference (`@`) expressions.
- Function bodies may similarly include prefix dereference (`@`) and infix store (`#`) expressions.
- Since infix `#` returns an address, passing prefix `@` to the caller composes Reader/Writer functors.
- To pass a bare address without dereferencing, use prefix `$`.

```sign
F : x y ? x # @y
G : f y ? @x y

` Writes and reads, returning 5
G @[F 0x10000 $[+ 2]] 3
```

---

## Zipper (Comonadic Extraction & Extension)

- The rest parameter operator `~` can be placed in front of parameter names (prefix `~`) to lift incoming arguments into a list ($w\ a \to w(w\ a)$ operation).
- Values passed to rest parameters are lifted into a list, enabling indexing via `get` (`'`).

```sign
f : ~a ? a ' 0 + a ' 2 + a ' 3

` 1 2 3 are passed into f as a lifted list [1 2 3]
f 1 2 3
```

- When applying functions, combining postfix `~` with prefix `~` forms a dialgebra, facilitating higher-order list operations.

```sign
map : f x ~y ? (@f x) , (map f y~)

map $[* 2] 1 2 3 4 5
```

---

## Store (Record / Struct Destructuring)

- If a parameter name matches a dictionary key name, the key's value is bound to the parameter.
- To pass a pointer reference (struct), the parameter list must be enclosed in brackets.

```sign
get_age : [age ~obj] ? age

dict :
	name : `Johnny`
	age  : 20

` Executes name ' key extraction
get_age dict
```
