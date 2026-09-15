# 構文・対象集合・記号翻訳表

**状態:** ドラフト（`impl/` の既存定義を記述するためのメタ記法）。

**正本:** [`../impl/1_definition.md`](../impl/1_definition.md)、[`../impl/syntax/grammar.pegjs`](../impl/syntax/grammar.pegjs)、[`../impl/syntax/operator_table.md`](../impl/syntax/operator_table.md)、[`../impl/core/coproduct_resolver.md`](../impl/core/coproduct_resolver.md)、[`../impl/core/unit.md`](../impl/core/unit.md)、[`../impl/type/type_system.md`](../impl/type/type_system.md)。

## 1. 目的と非目的

本書は、Sign の意味を集合論へ還元するものではない。Sign が採る圏論的な語彙と操作的な規則を、仕様文書が曖昧なく記述するために、**集合・写像・関係・等価関係**をメタ言語として導入する。以後の形式仕様は、本書の記法を使って `impl/` の既存定義を整理する。

> **正本の原則:** 本書が `impl/` にない新しい演算・値・評価順序を追加することはない。ここでの集合は、既存の PEG、演算子表、型システム、Unit 規則に現れる要素の**担い手**を明示するためのものである。

本書はまだ、評価器の完全な小ステップ意味論、型健全性の証明、あるいは機械検証を与えない。とくに、圏論的な説明が具体的な対象・射・関手としてどこまで固定されているかは、各 `impl/` 文書の記載を超えて決めない。[1] [2]

## 2. メタ記法

以下の記号は、Sign の source code ではなく、**この仕様を記述する側**の記号である。

| 記法 | 読み | 用途 |
|---|---|---|
| `x ∈ X` | x は X の要素 | 値・構文・識別子などの所属を表す |
| `X ⊆ Y` | X は Y の部分集合 | 受理形・値域の包含を表す |
| `X ⊎ Y` | X と Y のタグ付き直和 | 異なる構文種や値種を混同せず併記する |
| `X × Y` | X と Y の直積 | 二項演算子の入力対、環境 entry を表す |
| `X*` | X の有限列全体 | token 列、式列、仮引数列を表す |
| `𝒫(X)` | X の冪集合 | 参照集合、許容集合、到達可能集合を表す |
| `f : X → Y` | 全域写像 f | 定義域の全要素に結果がある変換 |
| `f : X ⇀ Y` | 部分写像 f | 未定義・診断・規則不成立を持つ変換 |
| `R ⊆ X × Y` | 二項関係 R | reduction、評価、同型、参照を表す |
| `x ≡ y` | 規定した等価関係で等しい | 文字列の同一性ではなく、仕様上の同型・同値を表す |
| `Γ[x ↦ b]` | 環境 Γ を x に b で拡張 | 静的な束縛表の更新を表す |
| `ρ[x ↦ v]` | 実行時環境 ρ を x に v で拡張 | 実行時の値束縛を表す |
| `μ[ℓ ↦ v]` | store μ を location ℓ に v で更新 | `$`、`@`、`#` を扱う際の場所の更新を表す |

`⊎` は「実装上のメモリ表現が必ず互いに異なる」ことを主張しない。仕様上、どの constructor で生じた要素かを識別する必要があるときにだけ使う。逆に、`≡` は JavaScript の同一性や数値の `=` を意味しない。どの同型・同値を採るかは、常に対象となる `impl/` の規則で指定する。

## 3. source と構文対象集合

### 3.1 source の文字列と字句素

`Char` を source file を構成する文字の集合、`Src = Char*` を有限 source string の集合とする。Sign の字句素は識別子、リテラル、演算子からなり、予約語を持たない。[1]

PEG が直接規定する source-level の集合を次のように記す。

```text
IdSrc       = { ASCII identifier が grammar.pegjs の identifier 規則に一致するもの }
StrLit      = { `s` | s に backquote・改行を含まない }
CharLit     = { \c | c ∈ Char ∖ {CR} }
NumLit      = { -? d+ .? d* | d ∈ {0,…,9} }
AddrLit     = { 0x h+ | h ∈ Hex }
RegLit      = { 0r h+ } ∪ { 0b b+ | b ∈ {0,1} }
UnicodeLit  = { 0u h+ | h ∈ Hex }
UnitLit     = { __, \x00 }
HoleLit     = { _ }
Lit         = StrLit ⊎ CharLit ⊎ NumLit ⊎ AddrLit ⊎ RegLit ⊎ UnicodeLit ⊎ UnitLit
AtomSrc     = Lit ⊎ IdSrc ⊎ HoleLit
```

PEG の集合は、前処理の最初の走査を通した後のテキストの上で読む。その走査はディスク上の改行を、`\` の直後なら LF（文字の改行）に、それ以外は CR（処理の区切り）に分け、行頭のコメントを読み捨てる（`impl/build/preprocessor.md` §0）。だから `\` + 改行は `\` + LF の `CharLit` であり、CR は `CharLit` の c に入らない。

ここで `HoleLit` は PEG の `Atom` に現れるが、実行時の値ではない。`_` は静的脱糖の対象であり、`__` は実行時に流通する Unit である。この区別は既存の Unit 仕様でも明示されている。[2] [3]

`(`、`)`、`[`、`]`、`{`、`}` は `impl/1_definition.md` で同義の字句素とされる。したがって、source-level の delimiter 集合を

```text
Open  = { (, [, { }
Close = { ), ], } }
Delim = Open ∪ Close
```

と置く。ただし、PEG の ordered choice と semantic action が block をどの parse representation に写すかは、この字句上の同義性から自動的には導かれない。concrete syntax の正本は PEG であり、BNF への書き換えは PEG の先読み・順序・action を失わない場合に限る。[1] [4]

### 3.2 PEG が区別する構文層

`grammar.pegjs` は、少なくとも `Program`、`Line`、`Expression`、`Term`、`Core`、`Block`、`Atom` を区別する。[4] 以後、これらの担い手を次のように書く。

```text
Prog        : Program の parse tree / parse result の集合
Line        : Line の parse tree / parse result の集合
Expr        : Expression の parse tree / parse result の集合
Term        : Term の parse tree / parse result の集合
Core        : Core の parse tree / parse result の集合
Block       : Block の parse tree / parse result の集合
Atom        : Atom の parse tree / parse result の集合
```

PEG の重要な規定は、半角 space 一個以上が単なる separator ではなく coproduct operator であり、`Expression` が space で区切られた `Term` のフラットな列を返すことである。[4] そのため、`Expr` の意味論的入力を、必要に応じて

```text
CoproductBlock = Term*
```

と書く。これは「任意の Term 列が正しい Sign expression である」とは主張しない。PEG の `Expression` 規則と block / line context を通過して得られた列だけが、後段の余積リゾルバーの入力である。

### 3.3 位置で区別される演算子出現

同じ glyph は位置によって異なる意味を持つ。PEG は密着する prefix を `op_`、postfix を `_op` として raw term 列に印付けし、space で隔てられた glyph を infix operator として残す。[4]

```text
Pos  = { Prefix, Infix, Postfix, Enclosure }
Op   = grammar.pegjs の operator または prefix / postfix 規則で受理される glyph の集合
Occ  = Op × Pos
```

したがって、仕様が意味を割り当てる最小単位は glyph 単独ではなく、原則として `Occ` の要素である。たとえば `@` は `(@, Prefix)`、`(@, Infix)`、`(@, Postfix)` で別の出現であり、`~` と `!` も複数の `Pos` を持つ。[4] [5]

## 4. 型・値・環境の対象集合

### 4.1 構造型と Atom 内部型

`impl/type/type_system.md` は、まず space の意味を決める Layer 1 structural type と、Atom の演算規則を決める Layer 2 subtype を分ける。[6]

```text
Cat  = { Lambda, Atom }

Ty₂  = { Address, Float, String, Vector, Unit }
       ⊎ { List(τ), Implicit(τ), Iterator(τ) | τ ∈ Ty₂ }
       ⊎ { Struct(S) | S は slot の有限な型記述 }
```

この `Ty₂` は型システムに現れる constructor を仕様記述用に列挙したものだ。`Struct(S)` の slot 記述、`Vector` の要素型、target layer ごとの有効範囲などの詳細は、この文書で勝手に固定しない。既存の型表が `Address`、`Float`、`String`、`Vector`、`List`、`Struct`、`Implicit`、`Iterator`、`Unit` を規定し、layer 制約を持つことだけをここで参照する。[6]

Layer 1 のカテゴリ付けは、構文と識別子表から得る部分写像として書ける。

```text
κ : Term × Γ ⇀ Cat
```

ここで `κ(t, Γ) = Lambda` となる代表形は、`?` を含む関数定義、部分操作の bracket、Lambda 同士の compose、アリティ不足の適用である。`κ(t, Γ) = Atom` は、数値・文字列・Unit・通常の算術演算などに対応する。[6] この記法は category 決定の結果を表すだけで、型変数の単一化を導入しない。

### 4.2 値の担い手と Unit

`Val` を、評価済み Sign 値のメタレベルの担い手とする。既存の型仕様に対応させるため、少なくとも次の tagged carrier を区別する。

```text
Val  = VAddr ⊎ VFloat ⊎ VString ⊎ VVector ⊎ VList ⊎ VStruct
       ⊎ VImplicit ⊎ VIterator ⊎ VUnit ⊎ VClosure

unit ∈ VUnit
```

この分割は、すべての backend が別々の object representation を使うことを主張しない。`List` と `Struct` の実装上の違い、`Address` と `Float` の layer 条件、`Iterator` の固定サイズ表現などは既存の型仕様に従う。[6]

Sign の source literal `__` が表す distinguished value を `unit` と書く。既存の Unit 仕様は、これを零対象として初対象と終対象の一致に置き、空リストとの等価を規定する。[2]

```text
parse(__) ⇓ unit
unit ≡ []
```

この `≡` は、文字列 `__` と空 block の字面が同じであることを意味しない。Unit 仕様が規定する値・構造上の同型を表す。`unit ≠ 0` は同じ仕様の明示的な制約である。[2]

### 4.3 静的環境 Γ

Sign の静的環境は、単一の「変数名から値への map」では足りない。Pass 1a は全 identifier の構造型・arity を収集し、call site も記録する。[6] そこで、静的束縛 entry と環境を次の record と部分写像で表す。

```text
Bind   = Cat × Arity × Ty₂? × Export × Status
Γ      : IdSrc ⇀ Bind

Arity  = ℕ ∪ {∞}
Export = { Internal, External, Pin, None }
Status = { Resolved, Pending, Cyclic, Unbound }
```

`Ty₂?` は Layer 2 subtype がまだ未決定であり得ること、`Pending` は call-site specialization を待つ generic parameter があり得ることを表す。`Cyclic` は自己参照・相互参照を Lambda と誤認せず Atom に倒す既存規則を記録するための状態である。[6]

識別子の定義は、メタ記法では次のように環境を拡張する。

```text
Γ' = Γ[x ↦ bind]
```

これは source-level `x : e` の意味そのものを一行で尽くす定義ではない。`:` の結合性、export marker、右辺の category 算出、前方参照は演算子表・型決定規則に従う。ここでは「仕様が参照する identifier table は部分写像である」ことだけを固定する。[5] [6]

### 4.4 呼び出しサイトと具体化

Pass 1a は各 coproduct application の call site を記録し、Pass 1b は generic parameter を distinct argument-category signature ごとに具体化する。[6] これを次の二つの写像で表す。

```text
ArgSig   = Cat*
CallSite : IdSrc ⇀ 𝒫(ArgSig)
Spec     : IdSrc × ArgSig ⇀ Bind
```

`CallSite(f)` は関数 `f` に観測された argument category sequence の集合、`Spec(f, σ)` はその signature `σ` に対する具体化済み binding である。これは Hindley–Milner の型変数・単一化を仮定しない。既存仕様が明記する「call graph 上の具体化」を、集合と部分写像として書き直しただけである。[6]

### 4.5 実行時環境と場所

静的環境 `Γ` と、実行中の値束縛 `ρ` は分ける。`$`、`@`、`#` の意味を記す将来の文書では、さらに場所と store を分ける必要がある。

```text
ρ : IdSrc ⇀ Val
Loc : addressable location の集合
μ : Loc ⇀ Val
addr : IdSrc ⊎ Expr ⇀ Loc
load : Loc ⇀ Val
store : Loc × Val ⇀ Loc
```

ここで `addr`、`load`、`store` はメタ言語の**署名**であり、現時点で totality、物理 address、エラー処理、layer 依存を確定していない。`operator_table.md` と `system_semantics.md` が `$` をアドレス取得、`@` を参照、`#` を書込みとして定義しているため、その意味を一貫して書くには、値・場所・store を分離する必要がある。[5] [7]

未定義 identifier が `unit` に収束する規則は、静的環境の absence と実行時の値を混同しないよう、評価判断側で書く。

```text
x ∉ dom(ρ)
───────────────  [UNBOUND-UNIT]
ρ ⊢ x ⇓ unit
```

この規則は `impl/core/unit.md` の「現在スコープにおいて定義されていない識別子は `__` として評価される」を、big-step 評価記法で表すドラフトである。[2] `Γ` に未登録であることと `ρ` に値がないことの関係、診断の severity、TCO 位置の例外は、この一規則だけでは完結しないため Unit / execution 文書で補う。

## 5. 基本関係と判断

本書で先に名前だけを固定する関係を次に示す。各 relation の具体的な rule set は対応する `impl/` 文書を形式化する章で与える。

| 判断・関係 | 読み | 正本 | この段階で固定すること |
|---|---|---|---|
| `s ⇓ₚ p` | source `s` が PEG により parse representation `p` を得る | grammar.pegjs | PEG が concrete syntax の正本 |
| `Γ ⊢ t : κ` | term `t` の Layer 1 category は `κ` | type_system.md | `κ ∈ Cat` |
| `Γ ⊢ t : τ` | term `t` の Layer 2 subtype は `τ` | type_system.md | `τ ∈ Ty₂` |
| `Γ ⊢ b ↝ b'` | coproduct block `b` が縮約される | coproduct_resolver.md | space は category により operation を選ぶ |
| `ρ; μ ⊢ e ⇓ v; μ'` | expression `e` が value `v` と更新後 store `μ'` に評価される | execution / system semantics | effect を持つ評価の署名 |
| `v ≡ w` | `v` と `w` は規定した同型・同値 | unit.md 等 | `unit ≡ []` のような規定済み同型 |

`⇓ₚ` と `⇓` を分ける理由は、PEG parse と実行時評価を混同しないためである。また、`↝` は余積リゾルバーの**変換**、`⇓` は値への**評価**であり、同じ矢印記法へ潰さない。

## 6. 空白の余積と category による翻訳

source-level space を集合論の literal concatenation として理解してはならない。PEG は一個以上の space を coproduct operator として expression の flat term 列を作り、余積リゾルバーは category pair によって operation を選ぶ。[4] [8]

```text
⊙ : Cat × Cat ⇀ OpName

⊙(Lambda, Lambda) = compose
⊙(Lambda, Atom)   = apply
⊙(Atom, Lambda)   = apply_reverse
⊙(Atom, Atom)     = construct
```

`List~` / `Struct~` を含む `push`、`unshift`、`concat` は、後置 `~` と型条件をさらに必要とする。したがって上の `⊙` は最小の category translation であり、完全な space resolution table ではない。[5] [8]

余積縮約は、`CoproductBlock` 上の部分関係として書く。

```text
↝Γ  ⊆ CoproductBlock × CoproductBlock
```

優先順位と左結合スキャンに従って隣接 pair を operation node へ置換し、単一 root へ収束させる規則は `coproduct_resolver.md` を正本とする。本書は、空白を「見た目の separator」と「圏論的余積」と「category-based operation selection」の三層で区別する。[8]

## 7. 記号翻訳表

### 7.1 翻訳の単位

Sign の記号は、自然言語の読み、圏論的な説明、操作的意味を一対一に単純化できない。translation の対象は glyph そのものではなく、position と context を含む occurrence `o ∈ Occ` である。

```text
ℑ : Occ ⇀ Natural × Categorical × Operational
```

- `Natural` は、利用者が記号を読むときの自然言語的な手掛かりである。
- `Categorical` は、既存の `impl/` が明示する零対象、恒等射、積、余積、射、合成などの説明である。
- `Operational` は、parser・resolver・runtime が行う処理の要約である。

`Categorical` 欄が「未固定」の行は、圏論的意味がないという意味ではない。現在の `impl/` が一般の対象・射・関手としてまだ固定していないため、本書が推測で埋めないことを示す。

### 7.2 基本記号

| occurrence | 自然言語的な読み | 圏論的・型的な対応 | 操作的な対応 | 正本 |
|---|---|---|---|---|
| `__` | 見える無、空 | 零対象。初対象と終対象の一致。空リストとの同型 | Unit 値。未定義 identifier の収束先。多くの operation の零射または単位元条件を起動する | [2] [5] |
| `_` | 穴、欠落した引数 slot | 値ではなく compile-time placeholder。`__` と別 | 静的脱糖の対象。部分適用に関わる | [2] [9] |
| ` ` as infix | 並べる、連接 | 余積。category pair により射の適用・合成または構造構築へ解釈される | PEG が flat term 列を作り、resolver が `apply` / `apply_reverse` / `compose` / `construct` 等へ縮約する | [4] [5] [8] |
| `,` as infix | 積、構造的組み立て | 直積。Unit に対する規則は表の恒等射欄に従う | 右結合の構造構築 | [5] |
| `:` as infix | 即ち、A ならば B | 名前・条件と右辺を結ぶ binding / definition の構成 | 左辺を右辺 expression へ束縛し、identifier 宣言では型情報も生成する | [1] [5] |
| `?` as infix | 問いかけ、どうするか | Lambda / 射の構成 | 関数定義。左側は仮引数束縛列、右側は body | [1] [5] [6] |
| `&` as infix | かつ、結合 | 積における零対象の規則 | 左側が零射へ落ちれば右側を評価せず `__`。両側 Unit の扱いは演算子表に従う | [2] [5] |
| `|` as infix | または、通路 | 余積における Unit の単位元 | 左側が非Unitなら右側を評価せず左値を返す。左側 Unit なら右側へ進む | [2] [5] |
| `;` as infix | 排他的関係 | 余積の差分 | 両側の Unit / 非Unit により identity または相殺を選ぶ。`|` と異なり短絡しない | [5] |
| `!` as prefix | 否定 | `__` から Id 射、非Unit から零射への翻訳 | `!__` は数値 Boolean でなく、評価予定が確定した非Unit の Id 射。`!expr` は Unit へ落とす | [2] [10] |
| `!` as postfix | 階乗 | 一般の圏論的対応は本書では未固定 | 階乗演算。右 operand を取らない | [5] |
| `~` as infix | その辺り、範囲 | range / iterator の構成 | range、等差・等比・等冪系列を指定する | [5] |
| `~` as prefix | 末尾へ、連続 | 連続 list / iterator の構成 | continuous list construction | [5] |
| `~` as postfix | 冒頭から展開 | list / struct の明示的展開 | expand。List / Struct の concat、argument distribution に条件を与える | [5] [8] |

### 7.3 参照・出力・取得を表す記号

| occurrence | 自然言語的な読み | 圏論的・型的な対応 | 操作的な対応 | 正本 |
|---|---|---|---|---|
| `$` as prefix | 価値を場所として扱う、アドレスを取る | `Lambda` / `Atom` から `Atom(Address)` への変換 | named binding または匿名式の address を取得する | [5] [6] [7] |
| `@` as prefix | 〜において、参照する | reference 先の category を継承する | address を dereference する | [5] [6] [7] |
| `#` as infix | 関連付け、書き込む | effect を持つ store 操作。結果は address 側に残る | address に data を入れ、成功時に address を返す | [5] [7] |
| `#` / `##` / `###` as prefix | 公開・発見可能にする | public signature / lifetime policy に関わる marker | internal export / external export / pin export を表す | [5] [6] |
| `'` as infix | 所有格、〜の | 構造から値を選ぶ projection | List / Struct から value を取得する | [5] |
| `@` as infix | 〜において | index と構造による projection | 構造から value を取得する | [5] |
| `@` as postfix | 〜から | import / external source | file から取得する | [5] |

### 7.4 比較と証拠を返す真理値

既存の真理値設計では、`unit` / 空リストは false、その他の値（数値 `0` を含む）は true とされる。比較は Boolean を新設せず、成功時に値を証拠として返し、失敗時に `unit` を返す。[10]

```text
truth(unit)       = false
truth(v)          = true    (v ∈ Val \ VUnit)
compare-success   ↦ witness value
compare-failure   ↦ unit
```

この `truth` は仕様の補助的な述語であり、Sign source の組み込み Boolean 関数を導入するものではない。比較演算子ごとの witness selection、連鎖比較、`!=` の例外は [`../impl/type/comparison.md`](../impl/type/comparison.md) を正本として別文書で定義する。

## 8. Unit と `$__` に関する未解決の差分

`operator_table.md` は `$__` を「有効な非Unit のアドレス」とし、遅延サスペンドを表すと記す。一方、`unit.md` は `$__ = __`、`@__ = __` とし、独立した `$__` の実体は存在しないと記す。[2] [5]

この二つの記載は、少なくともメタ言語上は同じ等式として同時に採用できない。したがって本書は、以下を**未決**として保留する。

```text
addr(unit) = unit       か
addr(unit) ∈ VAddr \ VUnit か
```

この差分を解消するまでは、`addr` の値域を `Loc` へ全域的に固定せず、`addr : IdSrc ⊎ Expr ⇀ Loc` を仮署名として扱う。これは集合論が設計を上書きするためではなく、既存の二つの仕様記述を同じ記号の下で曖昧に混ぜないためである。

## 9. 次の文書で確定すること

本書を前提に、次の文書は以下の順で作成する。

| 文書 | ここから引き継ぐ対象 | 最初に確定する規則 |
|---|---|---|
| `01_concrete_syntax.md` | `Src`、`AtomSrc`、`Occ`、`Prog`〜`Block` | PEG の受理関係と source / token / parse-result の対応 |
| `02_operator_semantics.md` | `Occ`、`ℑ`、`unit`、継続規則 | 演算子表を glyph・位置・priority・input category・Unit・evaluation continuation の表へ正規化 |
| `03_coproduct_resolution.md` | `Cat`、`Γ`、`CoproductBlock`、`↝Γ` | category pair、priority、left-associative reduction |
| `04_unit_and_control.md` | `Val`、`unit`、`truth`、`ρ` | Unit 伝播、短絡、比較 witness、未定義 identifier |
| `05_system_semantics.md` | `ρ`、`Loc`、`μ`、`addr` / `load` / `store` | `$`、`@`、`#` と layer 依存の意味 |

## References

[1]: [`../impl/1_definition.md`](../impl/1_definition.md) — 字句・構文の定義
[2]: [`../impl/core/unit.md`](../impl/core/unit.md) — Unit の数学的基盤と実装規則
[3]: [`../impl/syntax/hole_desugaring.md`](../impl/syntax/hole_desugaring.md) — Hole の静的脱糖
[4]: [`../impl/syntax/grammar.pegjs`](../impl/syntax/grammar.pegjs) — PEG 文法仕様
[5]: [`../impl/syntax/operator_table.md`](../impl/syntax/operator_table.md) — 演算子記号表
[6]: [`../impl/type/type_system.md`](../impl/type/type_system.md) — Layer 1 / Layer 2 と型決定
[7]: [`../impl/core/system_semantics.md`](../impl/core/system_semantics.md) — `$`、`@`、`#` の意味
[8]: [`../impl/core/coproduct_resolver.md`](../impl/core/coproduct_resolver.md) — 余積リゾルバー
[9]: [`../impl/syntax/hole_desugaring.md`](../impl/syntax/hole_desugaring.md) — Hole の静的脱糖
[10]: [`../impl/appendix/categorical_truth.md`](../impl/appendix/categorical_truth.md) — 圏論的真偽値
