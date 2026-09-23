# List & String Manipulation Cheat Sheet

> [!NOTE]
> **The canonical source is the Japanese document [list_cheat_sheet.md](../../ja-jp/guide/list_cheat_sheet.md).**
> This English copy is a *derived translation* and is **behind** the canonical text
> (user ruling, 2026-09-21: "en-us is the older one"). Where the two disagree, the
> Japanese side wins — including against this file. Do not cite this file as the
> specification; read it as a reading aid, and fix the Japanese side when you find a gap.

| Objective | Operation | Example | Result |
| ------ | ------ | ---- | ------ |
| Head Address | `$list` | `$[1 2 3]` | `0x1000` |
| Length / Count | `\|list\|` | `\|1 2 3\|` | `3` |
| Prepend Element | `element list` | `0 [1 2 3]` | `[0 1 2 3]` |
| Append Element | `list element` | `[1 2 3] 4` | `[1 2 3 4]` |
| Get Head Element | `list ' 0` | `[1 2 3] ' 0` | `1` |
| Get Head Element | `0 @ list` | `0 @ [1 2 3]` | `1` |
| Get Tail Element | `list ' -1` | `[1 2 3] ' -1` | `3` |
| Get Tail Element | `-1 @ list` | `-1 @ [1 2 3]` | `3` |
| Get Rest (Tail List) | `list ' 1~` | `[1 2 3] ' 1~` | `[2 3]` |
| Get Rest (one element stays a list) | `list ' 2~` | `[1 2 3] ' 2~` | a list holding only `3` (`' 0` gives `3`) |
| Get Rest (Tail List) | `1~ @ list` | `1~ @ [1 2 3]` | `[2 3]` |
| Get Rest (position in an identifier) | `list ' i~~` | `i : 1` → `[1 2 3] ' i~~` | `[2 3]` |
| Get Rest (position in an identifier) | `i~~ @ list` | `i : 1` → `i~~ @ [1 2 3]` | `[2 3]` |
| Element At Index | `list ' index` | `[1 2 3] ' 1` | `2` |
| Element At an identifier's **contents** | `list ' i~` | `i : 1` → `[1 2 3] ' i~` | `2` |
| Same morphism, prefix spelling | `list ' @i` | `i : 1` → `[1 2 3] ' @i` | `2` |
| Struct lookup by a runtime key | `struct ' k~` | `k : ` `` `b` `` → `p ' k~` (`p` is defined in the note below) | `2` |
| Element At Index | `index @ list` | `1 @ [1 2 3]` | `2` |
| Slice Range | `list ' [start ~ end]` | `[1 2 3 4] ' [1 ~ 3]` | `[2 3 4]` |
| Slice Range | `[start ~ end] @ list` | `[1 ~ 3] @ [1 2 3 4]` | `[2 3 4]` |
| Repeat Elements | `list * count` | `[0 1] * 3` | `[0 1 0 1 0 1]` |
| Lift Repeats | `list ^ count` | `[0 1] ^ 3` | `[[0 1] [0 1] [0 1]]` |
| Construct N-dim Matrix | `list , list` | `1 2 3 , 4 5 6` | `[[1 2 3],[4 5 6]]` |
| Concatenate Lists | `list1~ list2~` | `[1 2]~ [3 4]~` | `[1 2 3 4]` |
| Chunk List | `list / count` | `[1 2 3 4] / 2` | `[[1 2],[3 4]]` |
| Flatten List | `list~` | `[1 2,3 4]~` | `[1 2 3 4]` |
| Streamify 1D List | `list~` | `[1 2 3]~` | `1 2 3` |
| Reverse List | `><list` | `><[1 2 3]~` | `[3 2 1]` |
| Range Construction | `[start ~ end]` | `[1 ~ 5]` | `[1 2 3 4 5]` |
| Map (Pointfree) | `[pointfree,] list or stream` | `[* 2,] [1 2 3]~` | `[2 4 6]` |
| Filter (Pointfree) | `[pointfree,] list or stream` | `[< 3,] [1 2 3]~` | `[1 2]` |
| Fold (Pointfree) | `[pointfree] list or stream` | `[+] [1 2 3 4]~` | `10` |

> [!IMPORTANT]
> **In the key position, `~` reads differently on a literal than on an identifier.** `~` always means
> "bring out the contents"; what changes is **whose contents**.
>
> - `list ' 1~` **slices**. The contents of a literal are the literal itself, so "take the contents"
>   collapses to the identity and only the spreading reading survives.
> - `list ' i~` **pulls one element out by the contents of the key** — what `i` holds (`1`) becomes the
>   index. It is the same morphism as prefix `@` on the key (`list ' @i`).
> - `list ' i~~` **takes the contents and then spreads**. This is the spelling for slicing at an
>   identifier.
>
> Because the spelling of the key settles this without knowing the type on the left, reading the source
> still tells you the instruction ([`type_system.md`](../impl/type/type_system.md) §3.5, ruling of
> 2026-09-23).
>
> A runtime key into a struct is always written `struct ' k~` — prefix `@` spells an ordinal, so it does
> not line up with name-ordered slots and is refused by name. Named slots have no order, so `p ' k~~`
> yields the same value as `p ' k~`.
>
> ```sign
> p : [
> 	a : 1
> 	b : 2
> ]
> k : `b`
>
> p ' k~     ` result: 2   looks up by the contents of k (b)
> p ' @k     ` error: a named slot cannot be indexed with prefix @
> ```
>
> Struct fields go on **block lines** (inside `[…]` or indented). A one-line spelling such as
> `[a : 1, b : 2]` does not build a struct.
