# Sign String Literals and Comment Syntax

## Overview

Strings in Sign are always enclosed within backticks (`` ` ``).
Which one a backtick starts is decided by a **lookahead rule at the start of a line** (see section 2).

---

## 1. String Literals

### Definition

```
string = ` [^\n\r`]* `
```

Any sequence of characters delimited by backticks on both ends, excluding newlines (`\n`/`\r`) and backticks themselves.

```sign
` bind a string to greeting
greeting : `Hello, World!`
message  : `Sign is elegant`
```

### Characteristics

- Strings are single-line (cannot span across newline boundaries directly).
- Empty strings are isomorphic to `__` (Unit).
- Backticks cannot be directly embedded inside strings (to prevent ambiguity with comment starts).

---

## 2. Comment Syntax

### Definition (Lookahead Rule)

```
comment = SOL ` !([^\n\r`]* ` [@~! ]) [^\n\r]* EOL   ← a backtick at SOL is a comment by default
string  =     ` [^\n\r`]* `                          ← anywhere but SOL, always a string literal
```

> [!IMPORTANT]
> **Lookahead rule**: **a backtick at the start of a line begins an expression only
> when the closing backtick is immediately followed by a postfix operator
> (`@` `~` `!`) or a space.** Everything else is a comment.
>
> - **No closing backtick** → comment (extends to EOL)
> - **Closes, but what follows is neither a postfix operator nor a space** → comment
> - **Closes, and a postfix operator or a space follows** → expression (the line starts with a string)
>
> A backtick anywhere other than SOL is always a string literal; this rule does not apply to it.

```text
`This is a comment (never closed)
`This is a comment too`         ← closes, but EOL follows → comment
`quoting `x` inside prose`      ← the first closer is followed by `x` → comment (quoting works)
`main.sn`@~                     ← the closer is followed by postfix `@` → expression (import path)
`Hello, ` name                  ← the closer is followed by a space → expression (tier-10 coproduct)
x : `Hello`                     ← not at SOL → string literal
```

### Why "a postfix operator or a space"

**An expression that starts with a string at column 1 is either an import or a concatenation.**
An import has postfix `@` adjacent to the closing backtick; a concatenation continues with a
space — the tier-10 coproduct operator. Either way, what follows the closer is an **operator**.
That is what the decision rests on.

In prose, what follows the *first* closing backtick is the material being quoted, not a space
(in `` `quoting `x` inside prose` `` the first closer is followed by `x`). So the two separate
statically.

> [!NOTE]
> **The discriminator has been narrowed twice.**
>
> 1. It first looked only at whether a closer existed on the same line. That rule exists so an
>    import path can start a line, but it made **every closed comment a string literal** — writing
>    a backtick inside a comment became a syntax error.
> 2. Next it asked whether the line closed *and had something after the closer*. Closed comments
>    became comments again, but `` `quoting `x` inside prose` `` still fell through to an
>    expression (something does follow its closer), so a comment still could not quote code.
> 3. It now asks whether an **operator** follows the closer. **Explaining the language's syntax is
>    what comments are for, so being unable to quote that syntax was a real cost** — this resolves
>    all three at once: imports parse, closed comments stay comments, and comments can quote.

> [!WARNING]
> **One shape remains unwritable.** Prose whose *first* closing backtick is immediately followed
> by a space is read as a concatenation and becomes a syntax error:
>
> ```text
> `here ` it is       ← the first closer is followed by a space → read as an expression, error
> ```
>
> Move the space outside the closer and it parses (`` `here` it is ``). It **fails loudly rather
> than silently meaning something else**, so principle 4 (a statically detectable violation is
> rejected, not silently reinterpreted) still holds.

> [!WARNING]
> **On the final line of a file, this decision picks the return value.**
>
> A file scope returns its last expression, so a string written there becomes the file's return
> value (what the importer receives). A backtick at the start of the final line therefore sits
> exactly on the comment / return-value boundary.
>
> - **To write a comment, do not close it on the final line** (an unclosed backtick is always a comment)
> - **To return a string, bind it to a name first** (`` r : `result` `` on one line, `r` on the next)
>
> Under any version of the rule, this one point is the writer's call — whether a bare closed string
> is a return value or a comment is not determined by what was written. Both spellings above read
> as intended under either rule.

---

## 3. Indented Backticks (Docstrings)

When a backtick follows an indent (tab/spaces) it is not at SOL, so it is never a comment.
A backtick anywhere other than SOL is always a string literal; the lookahead rule does not apply:

```sign
calc_func : x ?
\t`Docstring (after tab, closing backtick present → evaluated as string but discarded)`
\tx * 2
```

The string is evaluated and then discarded, so it functions as documentation. Sign has no inline comments; this is a string that happens to be unused.

---

## 4. Final Line Return Value

In Sign's execution model, **every file is a function** (see [impl/core/execution_model.md](../impl/core/execution_model.md)).

Therefore, **the final line (the last non-comment expression) of a file is the return value of that file**.

```sign
` greet.sn
name : `World`
`Hello, {name}!`    ← Final line: return value of this file
```

```sign
` calc.sn
add : x y ? x + y
mul : x y ? x * y

add 3 4    ← Final line: 7 is the return value of this file
```

---

## 5. Multiline Strings

Strings in Sign are **single-line** by default.

To work with multiline strings, use lists of strings or the coproduct concatenation operator (space):

```sign
` Constructing multiple strings
lines : `Line 1` `Line 2` `Line 3`   ` List construction

` Explicit newline character handling
text  : `Line 1` \
 `Line 2`
```

Note: In Sign, there is no need for traditional escape sequences. Any character immediately following `\` is treated literally as a character.

---

## 6. Relationship with Unicode

Strings can be treated as sequences of `0u` literals (Unicode Code Points):

```sign
` ASCII string
hello : `Hello`

` Accessing individual code points
h : `hello` ' 0   ` → \h (0u48)
```

---

## 7. Grammar Specification (Compiler Notes)

- Comment lines may be stripped at the lexing stage (a comment returns the equivalent of Unit).
- Syntax highlighters and language servers should color **a backtick at SOL whose closer is followed by neither a postfix operator (`@` `~` `!`) nor a space** as a comment.
- PEG decides this with a **negative lookahead**. Excluding the backtick itself from the scanned character class is the load-bearing part: PEG's `*` does not backtrack, so without the exclusion the scan eats to end-of-line and cannot find a closer that is sitting right there.
- **The same rule is written down in seven places. Fix them together:**
  - `alpha/javascript/sign.pegjs` (the implementation; `parser.js` is generated from it)
  - `documents/ja-jp/impl/syntax/grammar.pegjs` / `documents/en-us/impl/syntax/grammar.pegjs` (the normative grammar)
  - `documents/ja-jp/guide/string_and_comment.md` / `documents/en-us/guide/string_and_comment.md` (this document)
  - `tools/vscode/syntaxes/sign.tmLanguage.json` / `tools/emacs/lisp/sign-mode.el` (editor support)

---

## Design Rationale

- **Single backtick for both strings and comments** → Minimizes punctuation symbols without introducing reserved words or dedicated quote pairs.
- **Line scoping** → Enables static line-by-line token boundary parsing by the compiler.
- **A comment is at SOL; only an operator right after the closer makes it an expression** → Visually explicit, zero reserved words, and a comment can quote the language it describes.
- **Final line return** → Aligns directly with the "File = Function" execution model.
