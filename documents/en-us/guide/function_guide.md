# Function Definitions and Function Types

> [!NOTE]
> **The canonical source is the Japanese document [function_guide.md](../../ja-jp/guide/function_guide.md).**
> This English copy is a *derived translation* and is **behind** the canonical text
> (user ruling, 2026-09-21: "en-us is the older one"). Where the two disagree, the
> Japanese side wins — including against this file. Do not cite this file as the
> specification; read it as a reading aid, and fix the Japanese side when you find a gap.

Sign provides versatile and flexible mechanisms for defining functions.  
This document outlines the various ways to define functions in Sign with concrete examples.

## Point-Free Notation

To treat operators as first-class functions, enclose the operator in parentheses or brackets.  
- Prefix operators are written as `[<op>_]`
- Postfix operators are written as `[_<op>]`  
- Point-free binary operators consume and apply across arguments greedily.  
- Point-free forms with a trailing comma `,` apply element-wise across streams/lists.

```sign
` Equivalent to Sum
[+] 1 2 3 4 5

` Equivalent to Map (* 2)
[* 2,] 1 2 3 4 5

` Negation function
[!_] (2 < 3)

` Factorial function
[_!] 5
```

Point-free forms are **functions**, not operations. If any written argument is `__`, the result is `__` (the totality axiom, user ruling 2026-10-05).
An infix operation reads `__` as its unit (`1 + __` is `1`), so the values of a point-free form and the infix form split exactly on `__`.
The exceptions are the point-free forms of the catching `|`: the fold `[|]` ("at least one true") returns the leftmost argument that is not `__`, and is `__` only when every argument is `__` (2026-10-06); the map `[| d,]` catches `__` element by element (2026-10-07). `[&]` ("all true") follows the totality axiom and otherwise returns the rightmost argument.
Being a function, a point-free form does not short-circuit: every written argument is evaluated once, in the written order. A spread of `__` is an empty spread and adds no argument (2026-10-06). Any other spread argument (`xs~`) puts its elements in as written arguments.
A `__` written inside a literal container vanishes when the container is built, so it does not count as a written argument (ja-jp `kan_extensions.md` §3.7.4).

```sign
` A function: a written __ makes the result __
[+] 1 __ 3

` Sections too. The infix 1 + __ is 1 (an operation), but this is __
[[+] 1 __]

` Maps too
[* 2,] 1 __ 3

` [&] is "all true": a __ makes it __ (otherwise the rightmost)
[&] 1 __ 3

` [|] is the exception: the leftmost value that is not __ (__ only when all are __)
[|] __ 5

` [| d,] catches __ element by element ([1 0 3])
[| 0,] 1 __ 3

` Spreading __ adds no argument (4)
[+] 1 __~ 3

` A __ inside a container vanishes when the container is built (folds [1 3], so 4)
[+] [1 __ 3]
```

## Definition Using the `?` Operator

The `?` (lambda) operator interprets its left operand as the parameter list and its right operand as the function body.

```sign
f : x y ? x + y
```

### Pattern Matching (`match_case`)

Placing a newline and indented block to the right of `?` turns the `:` operators inside the body into `match_case` pattern matching clauses.

```sign
f : x y ?
	x > 3 : x - y
	y < 3 : x + y
	x y
```

### Default Arguments (Local Variable Emulation)

Placing an indented block to the left of `?` turns the `:` operators into default parameter bindings.

```sign
f :
		x
		y : x + 1
		z : y + 1
	? x y z
```

Indent the parameter block two steps and the `?` row one step. When the body is written as a block, indent the body two steps as well. A bracketed parameter block (`[` … `]`) is indented the same way. A `?` at column 0 is refused by name. Not only at column 0, these placements are refused by name too: a `?` at or above the depth of the definition line, at the depth of the parameter rows, or two or more steps in after one-line parameters; parameter rows that are not all two steps in (a row three or more steps in); and a `?` following the closing row of a bracket written over several rows. Leading spaces do not count as indentation.

> [!IMPORTANT]
> **Default argument expressions permit pure values and Input operations. IO and Output store operators (`#`) are strictly prohibited.**
>
> Infix `#` (Store) cannot be written inside default argument blocks.  
> Expressions dependent on preceding parameters (e.g., `y : x + 1`) are resolved statically during compilation via monomorphization/specialization as pure compile-time values (zero runtime side effects).  
> Consequently, Output (`#`), which stores at run time, is incompatible; Input (`@`) is not. All store operations must be declared inside the function body (right of `?`).
>
> ```sign
> some_ptr : 0x40011000
>
> ` ❌ Prohibited: Output (#) in a default argument block
> bad :
> 		x : some_ptr # 42
> 	? x
>
> ` ✅ Allowed: Input (@) can be written in a default argument block
> good_in :
> 		x : @some_ptr
> 	? x
>
> ` ✅ Correct: Output belongs in the body
> good_out :
> 		x
> 	? some_ptr # x
> ```

### Combining Default Arguments and `match_case`

Default argument blocks and `match_case` clauses can co-exist within the same function definition.

```sign
f :
		x
		y : x + 1
		z : y + 1
	?
		x > 3 : x - y
		y < 3 : x + y
		z
```

## Function Application Behavior

Function application exhibits unique, predictable behavior when invoking functions with default arguments.

```sign
` Standard partial application (desugared to lambda via static transformation)
` A hole _ stands in an ordinary argument position
` Equivalent to $p0 $p1 ? add5 $p0 $p1 3 4 5
add5 : a b c d e ? a + b + c + d + e
f : add5 _ _ 3 4 5
` Result: 15
f 1 2

g :
		x
		y : x + 1
		z : y + 1
	? x y z

` g has default arguments, which are excluded from required arity calculations.
` Providing positional arguments for non-default parameters automatically triggers evaluation.
` Result: 3 4 5
g 3

` If an unexpected evaluation yields __ (Unit), functions without default arguments collapse to __
` (Unit propagation / Short-circuit collapse)
` 3 < 2 yields __, turning f into f __ 1, collapsing result to __
f (3 < 2) 1

` Passing __ into a parameter with a default value triggers fallback to the default expression.
` 3 < 2 yields __, giving g 1 __, so y falls back to x + 1 (2).
g 1 (3 < 2)
` Result: 1 2 3
```

## Bracketed Parameter Lists (Implicit Tilde Omission)

Enclosing the entire parameter list in brackets allows the function to receive passed lists or structs directly without requiring caller-side expansion tildes (`~`).
When receiving multiple reference structures, nesting brackets clarifies boundary boundaries for reference expansions.
Default parameters and `match_case` clauses remain fully compatible.

```sign
` Parameter list enclosed in brackets
` Parenthesize the recursive call — application (tier 10) binds looser than addition (tier 13),
` so without them x + sum_list xs reads as (x + sum_list) xs
sum_list : [x ~xs] ? xs & x + (sum_list xs) | x

` Caller passes a list directly without ~
` Result: 15
sum_list [1 2 3 4 5]

` Coexistence with default parameters and match_case
func_mixed :
		[
			x
			y : x + 1
			~z
		]
	?
		x > 3 : x - y
		y

` Result: -1 (x=5, y=6. Since x > 3, evaluates 5 - 6 = -1)
func_mixed [5]
` Result: 3  (x=2, y=3. Since x > 3 is __, returns y)
func_mixed [2]
` Result: 10 (x=2, y=10. Since x > 3 is __, returns y)
func_mixed [2 10]
```

## Automatic Struct / Record Key Binding

When a struct (dictionary) is passed to a function whose parameter list is enclosed in `[ ]`, matching member names (keys) automatically bind to parameter names regardless of field ordering.

```sign
` Function accepting struct fields. ~obj is optional, used when retaining unmapped fields.
calc_diff : [foo bar ~obj] ? foo - bar

` Pass struct directly with matching field names
calc_diff [
	bar : 20
	foo : 100
]
` Result: 80 (foo = 100, bar = 20 bind automatically by name)

func_mixed :
		[
			foo
			bar : foo * 2
			~obj
		]
	?
		foo > 3 : foo - bar
		bar

func_mixed [
	foo : 4
]
` Result: 8 (foo = 4, bar = 8. Since foo > 3 is True, evaluates foo - bar)
```
