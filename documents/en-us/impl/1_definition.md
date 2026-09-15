# Language Specification Definitions

## Lexical Definitions

1. Lexemes consist of Identifiers, Literals, and Operators.
2. Reserved words do not exist; semantics are determined purely by operators and syntactic structure.
3. Six enclosing bracket tokens are defined (`(`, `)`, `[`, `]`, `{`, `}`), all of which share identical syntactic and semantic meaning.
4. Indentation is formed exclusively via tab characters. Spaces may not substitute for tabs.
5. Lexemes are delimited by whitespace.
6. String literals are enclosed within backticks (`` `...` ``).
7. Whitespace embedded within string or character literals does not act as a lexeme delimiter.
8. Character literals representing special symbols are preceded by a backslash (`\c`).
9. Traditional escape sequences are not used inside string literals.
10. Including backslashes, quotes, or newlines inside strings is accomplished via explicit concatenation of character and string literals.

---

## Syntactic Definitions

1. The grammar consists exclusively of **Expressions**.
2. Expressions are constructed from Literals, Identifiers, and Operators.
3. Expression boundaries are defined by newlines, except that a line starting with a space or one of the infix operators listed in section 0 continues the previous one ([`preprocessor.md`](build/preprocessor.md) section 0).
4. Groupings of expressions form **Blocks**:
   1. The start of a block is delimited by increasing the indentation level.
   2. All expressions within a block must share identical indentation depth.
   3. The end of a block is delimited by decreasing the indentation level.
5. Operators are formally defined in the Operator Table:
   1. Operators are classified as Prefix, Infix, or Postfix.
   2. Infix operators must be placed between operands and delimited by whitespace.
   3. Prefix operators must be placed immediately before the target operand without whitespace.
   4. Postfix operators must be placed immediately after the target operand without whitespace.
   5. Operator precedence is specified in the Operator Table.
   6. Operator associativity is specified in the Operator Table.
6. Parameter lists differ from general body expressions in that they represent **order-dependent, sequentially evaluated scoped binding sequences**:
   1. Default argument expressions within a parameter list can only reference **identifiers declared prior to them** within the same parameter list.
   2. Due to this order-dependent evaluation, parameter lists represent a controlled exception to the "expressions only" principle of Rule 2.
   3. Function bodies and top-level declarations are truly declarative, resolving forward references via Compiler Pass 1.
   4. Default argument expressions undergo re-evaluation per invocation site (enabling IO monad semantics), inherently requiring sequential ordering.

**Detailed References**:
* [0_design_principles.md](0_design_principles.md)
* [type_system.md](type/type_system.md)

---

## Type Definitions

Types in Sign function as a zero-cost compile-time accounting ledger. For complete algebraic and category-theoretic definitions, see [type_system.md](type/type_system.md).
