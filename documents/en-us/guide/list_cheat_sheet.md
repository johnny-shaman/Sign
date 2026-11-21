# List & String Manipulation Cheat Sheet

> [!NOTE]
> **The canonical source is the Japanese document [list_cheat_sheet.md](../../ja-jp/guide/list_cheat_sheet.md).**
> This English copy is a *derived translation* and is **behind** the canonical text
> (user ruling, 2026-09-21: "en-us is the older one"). Where the two disagree, the
> Japanese side wins — including against this file. Do not cite this file as the
> specification; read it as a reading aid, and fix the Japanese side when you find a gap.

| Objective | Operation | Example | Result |
| ------ | ------ | ---- | ------ |
| Length / Count | `\|\|list\|\|` | `\|\|1 2 3\|\|` | `3` |
| Prepend Element | `element list` | `0 [1 2 3]` | `[0 1 2 3]` |
| Append Element | `list element` | `[1 2 3] 4` | `[1 2 3 4]` |
| Prepend a String (cons) | `string strings` | `` `ab` ts `` (`` ts : `cd` , `ef` ``) | `` [`ab` , `cd` , `ef`] `` |
| Add a Row to a Matrix | `matrix row` | `m [5 6]` (`m : 1 2 , 3 4`) | `[1 2 , 3 4 , 5 6]` |
| Concatenate Lists | `list1 list2` | `xs ys` (`xs : 1 2`, `ys : 3 4`) | `[1 2 3 4]` |
| Get Head Element | `list ' 0` | `[1 2 3] ' 0` | `1` |
| Get Head Element | `0 @ list` | `0 @ [1 2 3]` | `1` |
| Get Tail Element | `list ' -1` | `[1 2 3] ' -1` | `3` |
| Get Tail Element | `-1 @ list` | `-1 @ [1 2 3]` | `3` |
| Get Rest | `list ' 1~` | `[1 2 3] ' 1~` | `[2 3]` |
| Get Rest (still a container at length 1) | `list ' 2~` | `[1 2 3] ' 2~` | a container holding only `3` (`' 0` gives `3`) |
| Get Rest | `1~ @ list` | `1~ @ [1 2 3]` | `[2 3]` |
| Get Rest (position is an identifier's contents) | `list ' @i~` | `i : 1` → `[1 2 3] ' @i~` | `[2 3]` |
| Get Rest (position is an identifier's contents) | `@i~ @ list` | `i : 1` → `@i~ @ [1 2 3]` | `[2 3]` |
| Element At Index | `list ' index` | `[1 2 3] ' 1` | `2` |
| Element At an identifier's **contents** | `list ' @i` | `i : 1` → `[1 2 3] ' @i` | `2` |
| Element At Index | `index @ list` | `1 @ [1 2 3]` | `2` |
| Slice Range | `list ' [start ~ end]` | `[1 2 3 4] ' [1 ~ 3]` | `[2 3 4]` |
| Slice Range | `[start ~ end] @ list` | `[1 ~ 3] @ [1 2 3 4]` | `[2 3 4]` |
| Repeat Elements | `list * count` | `[0 1] * 3` | `[0 1 0 1 0 1]` |
| Lift Repeats | `list ^ count` | `[0 1] ^ 3` | `[0 1 , 0 1 , 0 1]` |
| Lift One Level | `~list` | `~[1 2]` | a matrix with `1 2` as its one row (`' 0` gives `[1 2]`) |
| Lower One Level (Flatten) | `list~` | `[1 2 , 3 4]~` | `[1 2 3 4]` |
| Construct N-dim Matrix | `list , list` | `1 2 3 , 4 5 6` | `[1 2 3 , 4 5 6]` |
| Split into Groups | `list / count` | `[1 2 3 4] / 2` | `[1 2 , 3 4]` |
| Range Construction | `[start ~ end]` | `[1 ~ 5]` | `[1 2 3 4 5]` |
| Map (Pointfree) | `[pointfree,] list` | `[* 2,] [1 2 3]` | `[2 4 6]` |
| Filter (Pointfree) | `[pointfree,] list` | `[< 3,] [1 2 3]` | `[1 2]` |
| Fold (Pointfree) | `[pointfree] list` | `[+] [1 2 3 4]` | `10` |

> [!NOTE]
> **Whitespace stacks things on one level; `,`, the line breaks of a bracket of two or more lines, and
> prefix `~` raise the level; postfix `~` lowers it.** Items placed side by side with whitespace are
> first brought to the level of the deepest one, then stacked from the left. A number or a character is
> on level 0; stacked with whitespace, it is lifted into a container of length 1, so
> `0 [1 2 3]` is `[0 1 2 3]`, `m [5 6]` gains one row, and `m 5 6` gains two rows of length 1.
> Items on the same level join flat, so writing `[[1 2] [3 4]]` gives `[1 2 3 4]` (a warning is
> reported where it is written). Write two dimensions as `1 2 , 3 4`, or as a bracket with one row per
> line. Postfix `~` on a one-level list does nothing (and reports nothing). On a list of length 1, `^`
> clashes with exponentiation, so lift one level with prefix `~` instead.
>
> ```sign
> ` a matrix with 2 rows
> m : 1 2 , 3 4
>
> ` result: [1 2 , 3 4 , 5 6]   adds one row
> m [5 6]
>
> ` result: [1 2 3 4]   lowers one level
> m~
>
> ` result: a matrix with 1 2 as its one row   prefix ~ lifts one level
> ~[1 2]
> ```

> [!NOTE]
> **When a list (a string, or a name holding a list, too) is passed to a function, its bare parameters
> and its bracket parameters that are not in the last position take the elements from the front.** With `add : x y ? x + y`, `add [1 2]` is `3`.
> Only a bracket parameter in the last position (`f : [~xs] ? …`) receives the rest of the sequence as
> one list. To pass a container as it is to a bracket parameter that is not in the last position, the
> caller separates the containers with `,`, as in `pair [xs , ys]`.
> If two or more bare parameters receive a list whose length cannot be seen (such as the rest received
> with `~t`), the result is `!_` and a warning is reported where it is written (receive it with a
> bracket parameter).

> [!NOTE]
> **The base case of a recursion that stacks rows lifts one level with prefix `~`.** Without it, the
> bottom row stays one-dimensional and joins flat with the row above it, since both sit on the same
> level; this carries upward, and the whole result becomes the flat `[1 2 3 4 5 6]`.
>
> ```sign
> pairs : [a b ~rest] ?
> 	rest : [a b] (pairs rest)
> 	a : ~[a b]
>
> ` result: [1 2 , 3 4 , 5 6]   into rows of two
> pairs [1 2 3 4 5 6]
> ```
>
> When the number of groups is fixed, splitting into groups, `list / n` (n groups), also does it:
> `[1 2 3 4 5 6] / 3` gives the same three rows.

> [!NOTE]
> **There is no dedicated operator for reversing a list.** A computation that walks a list from the end
> is written as destructuring from the end, using the positional generalization of rest notation
> ([`list_model.md` §2.5](../../ja-jp/impl/type/list_model.md#25-rest記法の位置一般化末尾両端からの分割代入),
> Japanese only), not a dedicated operator.
> ```text
> ` pop from the end (head = the rest from the front, tail = the last element)
> f : [~head tail] ? ...
> ```
> When you do need to reverse a one-dimensional list explicitly, write it yourself as a recursive
> function (`reverse : [x ~y] ? (reverse y) x`).

> [!IMPORTANT]
> **The marks in the key position are read from the spelling of the key alone.** The type on the left
> need not be known: the written form alone settles how the key is read. In the key position, each mark
> has one meaning.
>
> - An identifier with no mark is a **field name**: `list ' i` looks up the field named `i`, so on a
>   List it is `!_`.
> - Prefix `@` is the **contents**: `list ' @i` pulls one element out, using what `i` holds (`1` for `i : 1`) as
>   the index.
> - Postfix `~` is **from there to the end**: `list ' 1~` slices from position 1 onward.
> - With both, `list ' @i~` slices from the position that `i` holds onward.
>
> Slicing does not change the level (even at length 1 the result stays a container). A slice that comes
> out empty is `!_`.
>
> The spelling for looking up a struct by a runtime key (an identifier whose contents are a name) is
> undecided.
>
> ```sign
> p : [
> 	a : 1
> 	b : 2
> ]
>
> ` result: 1   looks up by the name a
> p ' a
> ```
>
> Struct fields go on **block lines** (inside `[…]` or indented), one per line. With a single field,
> `[a : 1]` is a struct too. Putting two or more on one line, as in `[a : 1, b : 2]`, does not build a
> struct with two fields: `,` binds tighter than `:`, so the only field is the first one, a, and b does
> not become a field. Structs placed side by side with whitespace do not merge their fields; each one is
> a single element of the sequence.
