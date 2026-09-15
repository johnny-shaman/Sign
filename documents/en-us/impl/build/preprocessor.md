# Sign Preprocessor Architecture & Transformations

## 0. The Two Roles of a Newline (the First Pass)

A newline has two roles: the **processing boundary** (an operator meaning "this line may now be evaluated"; see the basic principles of [`operator_table.md`](../syntax/operator_table.md)) and the **newline character** (the one character right after `\`). Making one byte carry both roles leaves the later stages guessing from context. So the preprocessor makes one left-to-right pass first and splits the two into different codes (the user's decision, 2026-09-15).

| On disk | Right after `\` | Otherwise |
|---|---|---|
| CRLF, LF, CR | **LF** (U+000A, the newline character) | **CR** (U+000D, the processing boundary) |

- **A newline counts as one character.** Even for CRLF, "the one character right after `\`" is a single newline ("any one character right after" in [`reference.md`](../../guide/reference.md) is read this way).
- **Strings pass through unchanged.** A `\` inside them is an ordinary character, so the newline is not turned into LF.
- **Start of line means "right after a CR, or the start of the file".** It is not physical column 0. The line after `\` + newline continues the same processing line even when it starts at column 0: without a space, adjacency applies (two terms touching is a syntax error); with a leading space, that space is read as the coproduct.
- **Line-leading comments are decided in this pass and dropped.** Later stages never decide again. The decision is made on the raw text as in [`string_and_comment.md`](../../guide/string_and_comment.md) section 2, and only the start of a processing line outside any bracket can be a comment (after a TAB is not the start of a line, section 3). The newline after a `\` at the end of a comment line stays CR.
- **TABs after `\` + newline.** All of them are dropped as alignment, and the space after them is the coproduct. This is the same treatment as the deeper TABs of a continuation line below (indentation is counted only at the head of a processing line).
- **One TAB is one level** (the user's decision, 2026-09-15). If the head of a processing line has n more TABs than the current depth, n blocks open (n `\x02`); if it has n fewer, n blocks close (n `\x03`). A line indented two TABs deeper at once therefore sits in a **nested block**: a block one level deeper stands in for a bracket block (see the default-argument example below). Levels open one at a time and close one at a time, so a line never returns to a depth that was not opened. Three lines `a`, `b`, `c` whose TABs go `0→2→1` close the second level and continue the first-level block: `a\x02\x02b\x03`, CR, `c\x03`. The first line of a file is counted the same way. TABs inside a bracket are not levels.
- **Continuation lines.** If the line after a CR starts, apart from its TABs, with a **space** or an **infix operator**, that line continues the previous line and the CR before it is not a processing boundary (the user's decision, 2026-09-15). It is joined to the end of the previous line with one space in between (any run of spaces is one coproduct). The infix operators that continue a line are those starting with `?` `+` `*` `/` `,` `=` `<` `>` `;` `%` `&` `^` `!=`, a `|` or `||` followed by a space, and a `~` followed by a space or `+` `-` `*` `/` `^`. A line starting with a symbol not in this list (such as `-` `!` `@` `#` `$` `'` `:`) does not continue; to continue such a line, put a space in front of it.
  - **A leading space is the coproduct** (or the space in front of an infix operator), and its left operand is on the previous line. So ` 1` after `1 +` is `1 + 1`, and ` * 2` after `]` applies to the whole bracket. A space is never indentation (only TABs indent).
  - If the continuation line has fewer TABs than the current depth, **one block is closed for each level it leaves**, and then the line is joined. A ` * 2` at column 0 after a block applies to the whole block; `\t * 2` applies to its last line (a block of match_case arms is not a value, so it cannot be the left operand of a continuation). TABs deeper than the current depth are dropped as alignment and open no level.
  - **The same holds inside brackets.** TABs inside a bracket mean nothing, but a leading space or infix operator marks a continuation there just as outside.
  - **A trailing space means nothing.** It cannot be seen on screen, so it never marks a continuation.
  - Blank lines and comment lines are bridged. A leading space with no line to continue (the start of the file, or after nothing but comment lines) is a syntax error.
- **Every stage after this pass sees only CR.** Splitting lines, joining a line to the next, placing the block marks (`\x02` / `\x03`) and counting bracket depth all work per processing line (a line cut at CR). LF travels as a character inside the line; the lexer pairs it with `\` into one character literal (the `Char` U+000A).
- **A string never spans lines.** A backtick that does not close by the end of its line is a syntax error, even if a closer turns up after continuation lines are joined.
- **Empty processing lines are dropped.** A line holding only TABs and spaces is empty, and empty lines inside blocks and brackets are dropped the same way.
- **CR as a value** can only be written as `0u000D`. A newline inside a value is LF, and the newline that `#` writes out is LF too.
- **End of file.** A `\` with nothing after it is a syntax error. Ending with `\` + newline ends with the LF character. Whether the last line is a comment or the return value is decided on the last processing line cut at CR; comments are decided in this pass, before continuation lines are joined ([`string_and_comment.md`](../../guide/string_and_comment.md) section 2).

The default-argument form ([`function_guide.md`](../../guide/function_guide.md), Default Arguments) is read with this count. The right side of `go :` is the first-level block, the parameter list is the second-level block inside it, and the one-TAB `?` closes the second level before it continues the line.

```sign
go :
		acc : 0
		rest : __
	?
		(rest) : go (acc + (rest ' 0)) (rest ' 1~)
		acc
```

| Line | TABs | Marks placed before it |
|---|---|---|
| `go :` | 0 | none |
| `acc : 0` | 2 | `\x02\x02` (opens two levels) |
| `rest : __` | 2 | none |
| `?` (continuation) | 1 | `\x03` (closes one level, then joins the previous line) |
| `(rest) : go …` | 2 | `\x02` (opens one level) |
| `acc` | 2 | none |
| the next column-0 line (or the end of the file) | 0 | `\x03\x03` (closes two levels) |

**When the right side of a definition is a block holding a single line, and that line is a lambda, the right side is that lambda** (a one-element literal is the element itself, `[x] ≅ x`). The same holds however deeply such single-line blocks nest, so the whole form written one TAB deeper (parameters at three TABs, `?` at two) is the same function. A line of the form `name : …` is not unwrapped: that is a one-entry struct. The compiler unwraps once, at the token level (`inlineSoloLambdaBlocks` in `compile.js`).

> [!NOTE]
> With a single code, a column-0 line after `\` + newline was also a boundary, and the value changed silently (the `` `L2` `` continuing `` `L1` `` became a comment). Joining a line to the next replaced LF with a space, so `a : \` + newline + `+ 1` became `!`. A character literal could eat a block mark and cause a syntax error, and whether a leading space was allowed was guessed from the raw text (`prevEndsWithEscape`). All of these came from a later stage guessing which role a newline played.
>
> The comment decision also lived in two places. The preprocessor looked at the raw text; the grammar looked at the text after spaces were inserted around infix operators, and never tried inside brackets or blocks. When they disagreed, the newline after `\` stayed CR, was eaten as a character, and CR ended up in a value. The decision now lives only in this pass, and the grammar's character rule no longer takes CR.
>
> The leading space was wrongly narrowed twice: first "allowed only after `\` + newline", then "a space at the head of a processing line is always rejected" (as space indentation). Both rejected ` 1` after `1 +`. Inside brackets, the space was silently stripped instead, so ` + 1` after `(1` became the pair of `1` and the section `(+ 1)`, and operator-led lines did not join inside brackets at all.
>
> Indentation used to push the number of TABs actually deepened onto a stack, as Python does. Any jump produced a single `\x02`, and returning to a depth in the middle of a jump closed the block and opened a separate one (the three lines `a`, `b`, `c` above became `a\x02b\x03\x02c\x03`). The Sign-side preprocessor (`preprocess.sn`) did not reopen there (`a\x02b\x03`, CR, `c`), so the two implementations built different trees. The same single `\x02` is why two-TAB parameters used to read as one block; once levels are counted the right side becomes a single-line block, and without unwrapping it `go 6 [4]` silently returns `[6 4]`.

## 1. Parameter Standardization via Position-Based Alpha Renaming

The Sign preprocessor renames authored parameter names into positional identifiers (`_0`, `_1`, `_2`...) to unify internal compiler representations and simplify downstream optimizations.

```sign
` Authored Source
increment : n ? n + 1
add : x y ? x + y

L : x ? x
R : _ ~x ? x

map : f x ~y ? @f x , map y~
map $[* 2] 1 2 3 4 5

` Desugared Output
increment : _0 ? _0 + 1
add : _0 _1 ? _0 + _1

L : _0 ? _0
R : _0 ~_1 ? _1

map : _0 _1 ~_2 ? @_0 _1 , map _2~
map $[* 2] 1 2 3 4 5
```

---

## 2. Partial Application and Hole Desugaring

```sign
` Authored Source
twice : f ? f f
flip : f x y ? f y x
f : x y z ? x * y + z
g : f 2 _ 3

` Desugared Output
twice : _0 ? _0 _0
flip : _0 _1 _2 ? _0 _2 _1
f : _0 _1 _2 ? _0 * _1 + _2
g : _0 ? f 2 _0 3
```

---

## 3. General Block Normalization (Automatic Trailing Comma Insertion)

For pure structural block construction (blocks containing no `:` condition operators), the preprocessor automatically appends product `,` operators at the end of each line (except the final line).

```sign
` Authored Source
buildData :
	readFile `data1.txt`
	processRaw input
	validateData processed
	saveResult final

` Desugared Output
buildData :
	(readFile `data1.txt`),
	(processRaw input),
	(validateData processed),
	(saveResult final)
```
