# Sign言語 形式仕様

## 1. 目的

このディレクトリは、Sign の言語仕様を新しく設計し直す場所ではない。`documents/ja-jp/impl/` にすでにある **PEG 文法、演算子表、変換規則、Unit 規則、比較規則**を正本として、その中で説明的に書かれている箇所を、必要に応じて BNF / PEG、演算子意味表、変換規則、判断規則へ整形する場所である。

> **正本の原則:** `formal_spec/` の文書は `impl/` の定義を変更しない。新しい形式記法が既存の `impl/` と異なる結果を導く場合、その文書は未採用とし、まず `impl/` 側の定義または差分を確認する。

alpha JavaScript の実装は、ここで定められる仕様の観測対象・適合確認に使うが、形式仕様の一次資料ではない。実装から逆算して、既存の言語定義を置き換えない。

## 2. 既存の一次資料

`impl/README.md` が示す必読順を、このディレクトリでも形式化の依存順として採用する。[1]

| 順序 | 既存の正本 | すでに形式的な部分 | formal_spec で行うこと |
|---:|---|---|---|
| 1 | [`../impl/syntax/operator_table.md`](../impl/syntax/operator_table.md) | 優先順位、位置、型の組合せ、機能、自然な意味、操作的意味、左右 Unit 規則 | 記号ごとの入力形・結合性・結果・継続規則を表として曖昧なく参照する |
| 2 | [`../impl/syntax/grammar.pegjs`](../impl/syntax/grammar.pegjs) | PEG による受理構文と parse action | PEG を canonical concrete syntax として固定し、必要な BNF は PEG の情報を落とさない範囲でのみ併記する |
| 3 | [`../impl/core/unit.md`](../impl/core/unit.md) | `!_`、零対象、同型、完全性、診断の規則 | Unit の規則を演算子表と矛盾しない判断・表へ分離する |
| 4 | [`../impl/core/coproduct_resolver.md`](../impl/core/coproduct_resolver.md) | 空白の category-based resolution と phase | 余積の縮約を入力 category・出力 operation・phase 順序で定義する |
| 5 | [`../impl/core/execution_model.md`](../impl/core/execution_model.md) | ファイル、関数、遅延評価、実行の全体モデル | 他の規則を結ぶ実行モデルとして参照する |

以下は、上の核を補完する既存の形式度が高い資料である。

| 領域 | 既存の正本 | 形式化で使う内容 |
|---|---|---|
| Hole | [`../impl/syntax/hole_desugaring.md`](../impl/syntax/hole_desugaring.md) | `_` の静的脱糖手順、適用位置、禁止形 |
| 分岐 | [`../impl/syntax/match_case.md`](../impl/syntax/match_case.md) | `?`、indent block、default arm の構文と制約 |
| 比較 | [`../impl/type/comparison.md`](../impl/type/comparison.md) | 値返却規則、連鎖比較、許容演算子、短絡 |
| システム演算子 | [`../impl/core/system_semantics.md`](../impl/core/system_semantics.md) | `$`、`@`、`#` の layer 別意味 |
| 型 | [`../impl/type/type_system.md`](../impl/type/type_system.md) | Layer 1 / Layer 2、型決定、型伝播 |
| リスト・積 | [`../impl/type/list_model.md`](../impl/type/list_model.md) | 空白、カンマ、range、rest、Struct の規則 |

## 3. 書き方の規則

形式仕様文書は、既存の `impl/` のどの節を形式化するかを冒頭で明記する。文書は次の順に書く。

1. **原文の対象範囲**を、参照先と節番号で固定する。
2. **入力の形**を PEG / BNF、または演算子表の位置・型組合せで示す。
3. **出力または変換結果**を、表・等式・変換規則・判断のいずれかで記す。
4. **Unit と継続**を、operator table の左右 Unit 欄と継続規則に従って記す。
5. **例外・禁止形・未決事項**を、既存文書の記載から削らずに残す。
6. 最後に **impl 対応表**を置き、形式化した規則が正本のどこに由来するかを示す。

この手順の目的は、数学的な記号を増やすことではない。実装者が同じ source を同じ parser・同じ operator resolution・同じ短絡規則で扱えるよう、既存定義の入力・条件・出力を明示することである。

## 4. 整備する文書

まず、集合論は Sign の意味を置き換えない仕様メタ言語として導入する。そのうえで、既存の正本を形式的な参照文書へ整える。

| 順序 | 文書 | 正本 | 目的 |
|---:|---|---|---|
| 0 | [`syntax_and_sets.md`](syntax_and_sets.md) | PEG、operator table、Unit、coproduct resolver、type system | メタ記法、対象集合、環境写像、評価・縮約の判断、記号翻訳表を定義する |
| 1 | `01_concrete_syntax.md` | `impl/syntax/grammar.pegjs`、`impl/1_definition.md` | PEG を正本とした concrete syntax の定義。BNF を併記する場合も ordered choice と semantic action を省略しない |
| 2 | `02_operator_semantics.md` | `impl/syntax/operator_table.md` | 各 operator の glyph、位置、優先順位、結合性、型組合せ、結果、Unit、継続を一つの参照表にする |
| 3 | `03_coproduct_resolution.md` | `impl/core/coproduct_resolver.md` | 空白の phase と category による縮約を変換規則として記す |
| 4 | `04_unit_and_control.md` | `impl/core/unit.md`、`impl/type/comparison.md` | Unit、短絡、値返却、比較連鎖を規則と表で記す |
| 5 | `05_syntactic_desugaring.md` | `impl/syntax/hole_desugaring.md`、`impl/syntax/match_case.md` | Hole と match_case の source-to-source / AST 変換を記す |
| 6 | `06_system_semantics.md` | `impl/core/system_semantics.md` | `$`、`@`、`#` の場所・store・layer 依存を記す |

## 5. 今の状態

前の誤った方針に基づく文書は削除済みである。現在は、`impl/` を正本に戻したうえで、[`syntax_and_sets.md`](syntax_and_sets.md) を追加した。この文書は新しい意味論を決めず、既存定義を厳密に書くための対象集合と記号翻訳を与える。

ここで `$_` の意味について `operator_table.md` と `unit.md` に差分があることを明示した。この差分は本ディレクトリで勝手に解決せず、system semantics を形式化する前に `impl/` 側で裁定する対象として残す。

次の作業は、PEG を書き直したり alpha AST から再構成したりすることではない。`impl/syntax/grammar.pegjs` の各 rule と `impl/1_definition.md` の字句・構文規約の対応を、情報を落とさず `01_concrete_syntax.md` に整理することである。

## References

[1]: [`../impl/README.md`](../impl/README.md) — Sign言語 実装者向けドキュメント
