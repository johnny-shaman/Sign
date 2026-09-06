{
  // Depth tracking is delegated entirely to the lexer's preprocessing step,
  // so this grammar needs no global state.
}

Start = Program

// --- Whitespace and line breaks ---
// !! A space is NOT a cosmetic delimiter; a space IS the coproduct operator !!
// One or more spaces = the coproduct operator of Sign.
// This "space as an operator" is what builds the flat list at the Expression
// layer, and that list is the input handed to the shunting-yard (operator table).
__ = " "+ { return null; } / &"\x02" { return null; } // coproduct operator (the lookahead admits an indented block that follows an operator with no space between; \x02 itself is not consumed -- Block consumes it)
_  = " "* { return null; } // optional (used only at line edges)
_e = (" " / EOL)* { return null; } // the edge of a block (right after `[`, right before `]`). Only here is EOL allowed
SOL = &{ return location().start.column === 1; }
EOL = "\r\n" / "\r" / "\n"
EOF = !.

// string_and_comment.md section 2, "lookahead rule": **a backtick at the start of
// a line begins an expression only when the closing backtick is immediately
// followed by a postfix operator (@ ~ !) or a space. Everything else is a comment.**
//
// An expression that starts with a string at column 1 is either an import
// (`` `path`@~ ``) or a concatenation (a space is the tier-10 coproduct). In prose,
// what follows the first closing backtick is the material being quoted -- a
// non-space -- so the two separate cleanly. This is what lets a comment contain
// backticks: explaining the language's syntax is what comments are for, so being
// unable to quote that syntax was a real cost.
//
// Excluding the backtick itself from the character class inside the negative
// lookahead is the load-bearing part. PEG's `*` does not backtrack (once it commits
// greedily it never gives characters back), so without the exclusion the scan eats
// to end-of-line and keeps concluding "there is no closer" even when one is there.
comment = SOL "`" !([^\r\n`]* "`" [@~! ]) [^\r\n]* (EOL / EOF) { return null; }

// --- Program and lines ---
// Each line may be either a comment or a Line, so code and comments can share one
// file. (Previously a program was all-code lines or all-comment lines, so a single
// comment mixed into code was an immediate parse error.) `comment` returns
// `{ return null; }` -- the equivalent of Unit -- so nulls are filtered out at the
// end, the same way asList filters Unit out of list construction.
Program = lines:(SOL @(comment / Line) EOL*)* EOF { return lines.filter((l) => l !== null); }

Line
  = _ expr:Expression _ { return expr; }

// --- The core of coproduct (space) flattening ---
// A run of space-separated Terms is returned as a flat array.
// That array is the input to the shunting-yard (operator table).
// Which meaning applies (apply / compose / concat) is settled later, in the
// semantic phase.
Expression
  = head:Term tail:(__ @Term)* {
      // [fixed] flat() is applied whether or not the expression is a solo term, to
      // pair with Term's own wrapping rule. flat() used to be skipped for solo
      // terms, so the result had a different shape depending on whether a Block was
      // the only term or one of several.
      return [head, ...tail].flat();
  }

// --- Adjacency binding (Syntax = Type) ---
// No space = same Term = "adjacent".
// The same symbol therefore changes role purely by the presence of a space:
//   @x    -> prefix (symbolized as @_): adjacent to the left of core
//   x @ y -> infix: spaced, so it joins the coproduct run at the Expression layer
//   x@    -> postfix (symbolized as _@): adjacent to the right of core
// A prefix symbol gets a trailing "_", a postfix symbol a leading "_", so the
// shunting-yard can identify each one's role uniquely inside the flat list.
Term
  = pre:Prefixes core:Core post:Postfixes {
      // Neither a prefix nor a postfix
      if (pre.length === 0 && post.length === 0) {
          // [fixed] When core is an array (a Block), wrap it one level so its
          // contents do not leak through Expression's .flat(). It used to be
          // returned bare, so a Block mixed into an Expression alongside other
          // terms had its contents flattened out.
          return Array.isArray(core) ? [core] : core;
      }

      // Adjacent: return a flat array.
      // Expression's flat() dissolves it into the surrounding list.
      return [...pre, core, ...post];
  }
  / operator

// A prefix operator gets a trailing "_" (e.g. "@" -> "@_")
// -> the shunting-yard can tell "this @ is a prefix"
Prefixes
  = pre:prefix* { return pre.map(p => p + "_"); }

// A postfix operator gets a leading "_" (e.g. "@" -> "_@")
// -> the shunting-yard can tell "this @ is a postfix"
Postfixes
  = post:postfix* { return post.map(p => "_" + p); }

Core
  = Block
  / Atom

// --- Spatial arrangement (nesting) ---
Block
  = "[" _e exprs:Expressions _e "]" { return exprs; }
  / "{" _e exprs:Expressions _e "}" { return exprs; }
  / "(" _e exprs:Expressions _e ")" { return exprs; }
  // Empty blocks (`[]` / `{}` / `()`). Per unit.md ("`__ = []`, equal to the empty
  // list"), the empty list is isomorphic to Unit, so `none : []` has to be
  // writable (guide/example.sn line 37). Expressions demands at least one element,
  // so the empty-only alternatives sit *after* the non-empty ones -- PEG choice is
  // ordered, so the non-empty reading is still tried first.
  / "[" _e "]" { return []; }
  / "{" _e "}" { return []; }
  / "(" _e ")" { return []; }
  // Norm (element count). **Which reading applies is decided by where the spaces
  // are** -- exactly the rule absolute value (`|x|`) already follows. Adjacent means
  // a bracket; separated by spaces means an infix operator (`||` is tier 22,
  // `bit_or`):
  //
  //   ||xs||     norm (element count)
  //   a || b     bitwise or
  //
  // It is separate from absolute value because **there is no one-element container**.
  // Since `[5]` is isomorphic to `5`, reading `|[5]|` as absolute value gives 5 and
  // as element count gives 1: the same symbol changes meaning at length 1 --
  // `count : xs ? |xs|` was returning 7 for `[7]`.
  //
  // **Tried before absolute value.** After it, `||5||` would read as `|` + `|5|` + `|`.
  / "||" exprs:Expressions "||" &(__ / EOL / EOF / "]" / "}" / ")" / "\x03") { return [`"NORM_"`, exprs]; }
  / "|" exprs:Expressions "|" &(__ / EOL / EOF / "]" / "}" / ")" / "\x03") { return [`"ABS_"`, exprs]; }
  // Indented blocks, delimited by the control bytes the lexer inserts.
  // (Adjust "\x02" / "\x03" to match the actual lexer.)
  // [fixed] These used to be spliced in as ...exprs, one protective layer thinner
  // than the bracket forms (which return exprs as-is), which let the contents leak
  // through Expression's .flat() when mixed with other terms. Keeping exprs as a
  // single element matches the bracket forms' one layer of protection.
  / "\x02" _ exprs:Expressions _ "\x03" { return [`"INDENT_"`, exprs, `"_DEDENT"`]; }

// Multi-line expressions inside a block
Expressions
  = head:Expression tail:(EOL _ @Expression)* {
      return [head, ...tail].filter(e => e !== null);
  }

// --- Atoms ---
Atom
  = string / charactor / address / register / unicode / number / identifier / unit / hole

string = $("`" [^`\r\n]* "`")
charactor = $("\\".)
number = $("-"? [0-9]+ "."? [0-9]*)
address = $([0-9]+ "x" Hex+)
register = $("0r" Hex+) / $("0b" ("0" / "1")+)
unicode = $([0-9]+ "u" Hex+)
// "__" (Unit) alone is routed to unit rather than identifier: the &{} predicate
// rejects it so Atom falls through to the next alternative. Without this,
// "_" [a-zA-Z0-9_]+ also matches "__" and unit is never reached.
identifier = id:( $([a-zA-Z][a-zA-Z0-9_]*) / $("_" [a-zA-Z0-9_]+) ) &{ return id !== "__"; } {return `<${id}>`}
Hex = [0-9a-fA-F]
unit = "__" / "\x00"
hole = "_"

// --- Operators and symbols (prefix / postfix / infix behaviour is settled by the shunting-yard) ---
prefix
  = "###" / "##" / "#" / ("-" &(Block / identifier)) / "~" / "!!" / "!" / "$" / "@"

postfix
  = "!" / "~" / "@"

operator
  = $[!"#$%&'\-=^~\|@;+:*,<>/?]+
