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
- **Continuation inside a block.** Of the TABs after `\` + newline, as many as the current block depth are dropped as indentation, and the space after them is the coproduct. Inside a bracket every TAB is dropped (indentation inside brackets never meant anything). Whether it is inside a bracket is decided at the position of the `\` + newline, counting brackets opened or closed earlier on the same processing line.
- **Every stage after this pass sees only CR.** Splitting lines, joining a line to the next, placing the block marks (`\x02` / `\x03`) and counting bracket depth all work per processing line (a line cut at CR). LF travels as a character inside the line; the lexer pairs it with `\` into one character literal (the `Char` U+000A).
- **Empty processing lines are dropped.** A line holding only TABs and spaces is empty, and empty lines inside blocks and brackets are dropped the same way.
- **CR as a value** can only be written as `0u000D`. A newline inside a value is LF, and the newline that `#` writes out is LF too.
- **End of file.** A `\` with nothing after it is a syntax error. Ending with `\` + newline ends with the LF character. Whether the last line is a comment or the return value is decided on the last processing line cut at CR ([`string_and_comment.md`](../../guide/string_and_comment.md) section 2).

> [!NOTE]
> With a single code, a column-0 line after `\` + newline was also a boundary, and the value changed silently (the `` `L2` `` continuing `` `L1` `` became a comment). Joining a line to the next replaced LF with a space, so `a : \` + newline + `+ 1` became `!`. A character literal could eat a block mark and cause a syntax error, and whether a leading space was allowed was guessed from the raw text (`prevEndsWithEscape`). All of these came from a later stage guessing which role a newline played.
>
> The comment decision also lived in two places. The preprocessor looked at the raw text; the grammar looked at the text after spaces were inserted around infix operators, and never tried inside brackets or blocks. When they disagreed, the newline after `\` stayed CR, was eaten as a character, and CR ended up in a value. The decision now lives only in this pass, and the grammar's character rule no longer takes CR.

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
