# Sign言語 実装者向けドキュメント

コンパイラ・インタープリタ・ツールチェーンを実装する人向けのドキュメント集。

## 必読の順番

1. **[syntax/operator_table.md](syntax/operator_table.md)** — 演算子テーブル（言語の骨格）
2. **[syntax/grammar.pegjs](syntax/grammar.pegjs)** — PEG文法仕様
3. **[core/unit.md](core/unit.md)** — Unit（`__`）完全仕様（全フェーズに影響）
4. **[core/coproduct_resolver.md](core/coproduct_resolver.md)** — 余積リゾルバー（スペース演算子の意味解決）
5. **[core/execution_model.md](core/execution_model.md)** — 実行モデル（ファイル=関数、ヒープレス）

---

## ディレクトリ構造

```
impl/
├── layer_relations.md ← 演算子と層の関係（何を要求するかで層が決まる・実測表）
├── idiom_to_instructions.md ← 字面と命令の対応（Sign で Sign を書くための土台・実測表）
│
├── syntax/            ← 字句・構文フェーズ
│   ├── operator_table.md    演算子テーブル（優先順位・位置・Unit挙動）
│   ├── grammar.pegjs        PEG文法仕様（パーサーの原型）
│   ├── hole_desugaring.md   Hole（_）の静的脱糖アルゴリズム
│   ├── match_case.md        match_case の脱糖・実装
│   └── operator_table.js    演算子テーブル実装参照
│
├── core/              ← 意味論フェーズ
│   ├── unit.md              Unit（__）完全仕様（数学的基盤 + 実装規則）
│   ├── coproduct_resolver.md 余積リゾルバーアルゴリズム
│   ├── execution_model.md   実行モデル（main内部関数展開）
│   ├── tco.md               末尾呼び出し最適化（TCO/TCE）
│   ├── system_semantics.md  $/@/# のレイヤー別意味論
│   ├── value_representation.md 値のビット表現・ニッチ最適化
│   └── integer_overflow.md  オーバーフロー挙動の実装規則
│
├── type/              ← 型システムフェーズ
│   ├── type_system.md       型推論（Algorithm W）・型検査
│   ├── list_model.md        リストモデル・型変換・多次元配列
│   ├── comparison.md        比較演算子の値返却ルール
│   └── zero_cost_abstraction.md ゼロコスト抽象化の実装方針
│
├── build/             ← ビルドシステム・コード生成
│   ├── system_architecture.md  レイヤー意味論・アーキテクチャ全体図
│   ├── build_system.md         option.ms ビルドシステム仕様
│   ├── option_ms_schema.md     option.ms スキーマ完全定義
│   ├── entry_point.md          エントリポイント（boot.sn）仕様
│   ├── link_strategy.md        リンク戦略
│   └── preprocessor.md         プリプロセッサ実装ガイド
│
├── memory/            ← メモリ管理
│   ├── stack_abi.md         スタックABI・レンジ式の実装
│   └── memory_management.md RC/ARC管理・Shared-Heap
│
└── appendix/          ← 理論的背景（参照用）
    ├── kan_extensions.md    Kan拡張による演算子の統一的対応検証
    ├── categorical_truth.md 圏論的真偽値の数学的基盤
    └── motivation.md        Sign言語の設計背景・動機
```

---

## コンパイルパイプライン

> [!NOTE]
> 下記はLexer/Parser実装ファイル名との対応を示す概要図。型解決のPass構成（Pass 1～4）の
> 正確な定義は [`type/type_system.md` §5](type/type_system.md#5-型決定アルゴリズムコンパイラ実装指針) と
> [`core/compiler_pipeline.md`](core/compiler_pipeline.md) を参照。型推論はHindley-Milner/Algorithm Wの
> 制約ソルビングではなく、演算子テーブルに基づくO(n)の線形スキャンで完結する（§7.1参照）。

```
.sn ファイル
  ↓
[Pass 1 の一部: Lexer]         lexer.js
  前処理：中置演算子前後に空白挿入、インデント→\x02/\x03
  ↓
[Pass 1 の一部: Parser と識別子テーブル収集]  parse/minimal.pegjs → minimal.js
  PEG構文解析 → AST生成。全識別子の構造型（Lambda/Atom）とアリティを線形スキャンで確定（`.ist`をメモリ上に構築）
  ↓
[Pass 2: Coproduct Resolver]   semanticize/coproduct_resolver.js
  スペース演算子の型ベース意味解決（apply/compose/concat/reverse_apply）
  ↓
[Pass 3: Type Propagation]  （実装中）
  左辺優先ルールによる Layer 2 型伝播
  ↓
[Pass 4: Code Generator]
  wasm_codegen.js / aarch64.js / js_codegen.js
  ↓
.wasm / .o / .js
```
