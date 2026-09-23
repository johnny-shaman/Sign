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
		~rest
	? x y z rest~
```

> [!IMPORTANT]
> **Default argument expressions permit pure values and Input operations. IO and Output store operators (`#`) are strictly prohibited.**
>
> Infix `#` (Store) cannot be written inside default argument blocks.  
> Expressions dependent on preceding parameters (e.g., `y : x + 1`) are resolved statically during compilation via monomorphization/specialization as pure compile-time values (zero runtime side effects).  
> Consequently, runtime IO expressions are incompatible. All IO side effects must be declared inside the function body (right of `?`).
>
> ```sign
> ` ❌ Prohibited: IO in default argument block
> f :
> ` ← Compile Error
> 		x : @some_ptr
> 	? x
>
> ` ✅ Correct: Place IO inside the body
> f :
> 		x
> 	? @some_ptr
> ```

### Combining Default Arguments and `match_case`

Default argument blocks and `match_case` clauses can co-exist within the same function definition.

```sign
f :
		x
		y : x + 1
		z : y + 1
		~rest
	?
		x > 3 : x - y rest~
		y < 3 : x + y rest~
		z rest~
```

## Function Application Behavior

Function application exhibits unique, predictable behavior when invoking functions with default arguments.

```sign
` Standard partial application (desugared to lambda via static transformation)
` Equivalent to $p0 $p1 ? [+] $p0 $p1 3 4 5
f : [+] _ _ 3 4 5
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

` Behavior when passing __ to rest parameters (~rest):
` Rest parameters behave identically to default parameters.
` Passing __ does not collapse the expression; it falls back to the implicit default __ (empty list),
` allowing the function to execute normally.
h : x ~rest ? x rest~
` Result: 1 (__ is treated as empty list and vanishes upon rest~ expansion)
h 1 __
```

## Bracketed Parameter Lists (Implicit Tilde Omission)

Enclosing the entire parameter list in brackets allows the function to receive passed lists or structs directly without requiring caller-side expansion tildes (`~`).
When receiving multiple reference structures, nesting brackets clarifies boundary boundaries for reference expansions.
Default parameters and `match_case` clauses remain fully compatible.

```sign
` Parameter list enclosed in brackets
sum_list : [x ~xs] ? xs & x + sum_list xs | x

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
