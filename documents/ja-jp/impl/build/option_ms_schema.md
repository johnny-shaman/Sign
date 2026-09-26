# `option.ms` 完全仕様書（MetaObjectForSign）

> [!IMPORTANT]
> **このドキュメントは `option.ms` の唯一の正規リファレンスである。**
> `Build_System_ja-jp.md`、`Entry_Point_ja-jp.md`、`System_Architecture_ja-jp.md` の
> 各ファイルから `option.ms` 関連の記述を参照する場合、本ドキュメントへのリンクを使用すること。

---

## 1. `ms` フォーマット（MetaObjectForSign）

`ms` は Sign の積型（Product）記法をそのままデータ記述に使ったフォーマット。
コンパイラがビルド時にのみ読み取る**メタ定義ファイル**であり、実行時コードとは明確に分離される。

| 比較項目 | JSON | ms |
|---|---|---|
| キーと値 | `"key": value` | `key : value` |
| 文字列 | `"string"` 必須 | 識別子はそのまま、文字列はバッククォート |
| 空・偽 | `null` / `false` | `__`（Unit に収束） |
| コメント | 不可（標準） | 行頭バッククォート `` ` `` |
| 配列 | `[1, 2, 3]` | `1 2 3` または `1, 2, 3` |
| 動的追加 | 可能 | **スキーマ固定・静的のみ** |

> [!NOTE]
> `*.ms` ファイルはコンパイル時メタデータ、`*.sn` ファイルは実行時コードという静的区分により、
> ツールチェーンの解析精度と安全性を最大化する。

---

## 2. 全フィールド一覧

```ms
` option.ms — 完全フィールド一覧
` （すべてオプション。省略時はデフォルト値が適用される）

` ─── ターゲット ────────────────────────────────────────────────────────
target   : x86_bios
` 指定可能値: x86_bios | x86_firmware | x86_uefi_app
`            aarch64_rpi | aarch64_qemu | aarch64_firmware
`            cortex_m | riscv64 | wasm | wasm32 | wasm64
`            rust（ホストビルド時のデフォルト）
` デフォルト: rust

layer    : 4
` 0=bare | 1=alloc | 2=fpu | 3=simd | 4=std
` デフォルト: 4

charset  : ascii
` ascii | utf32
` メモリ上の Char 1個の幅（ascii=1byte / utf32=4byte）
` デフォルト: ascii
` どちらも固定幅（§4.2 参照）。UTF-8 は IO 境界の転送形式であって選択肢ではない

` ─── エントリポイント ──────────────────────────────────────────────────
entry    : 0x7C00
` 物理エントリアドレス（CPU が最初にジャンプするアドレス）
` 省略時: target のデフォルト値が適用される（§3 参照）

stack    : 0x9000
` 初期スタックポインタ値（スタートアップスタブが sp にセットする値）
` 省略時: target のデフォルト値が適用される（§3 参照）

` ─── ビルド出力 ──────────────────────────────────────────────────────
output   : `app`
` 出力ファイル名（拡張子は target に応じて自動付与）
` デフォルト: メインディレクトリ名

optimize : 2
` 0〜3（デフォルト: 0）
` LTO・デバッグ情報 strip 等は optimize レベルから自動導出（個別指定不要）

` ─── 継承 ─────────────────────────────────────────────────────────────
inherit  : true
` false にすると親 option.ms を無視して独立する（デフォルト: true）

` ─── リンク戦略 ──────────────────────────────────────────────────────
link     : dynamic
` dynamic | static
` デフォルト: dynamic（OS のダイナミックローダーに委ねる）
` static 時のみ、以下のサブブロックでメモリマップを指定する
```

---

## 3. `target` 別デフォルト値

`entry` / `stack` を省略した場合、`target` の値からデフォルトを適用する。

| target | entry（デフォルト） | stack（デフォルト） | 用途 |
|--------|-------------------|-------------------|------|
| `x86_bios` | `0x7C00` | `0x7BFF` | BIOS ブートローダー（MBR ロード先） |
| `x86_firmware` | `0xFFFFFFF0` | `0x00090000` | CPU リセットベクタから起動（UEFI 代替） |
| `x86_uefi_app` | （UEFI が決定） | （UEFI が設定） | UEFI アプリケーション（`.efi`） |
| `aarch64_rpi` | `0x80000` | `0x80000` | Raspberry Pi 3/4 ベアメタル |
| `aarch64_qemu` | `0x40080000` | `0x40200000` | QEMU virt ボード |
| `aarch64_firmware` | `0x0` | `0x80000` | AArch64 リセットベクタ（EL3） |
| `cortex_m` | `rom.origin` | `ram.origin + ram.length` | STM32 等 Cortex-M マイコン |
| `riscv64` | `0x80000000` | `0x80200000` | QEMU / SiFive 等 RISC-V |
| `wasm` | （WASM ランタイムが決定） | （WASM ランタイムが設定） | WebAssembly |
| `rust` | — | — | ホスト向けビルド（OS 上で実行） |

> [!NOTE]
> `x86_firmware` は UEFI を代替するファームウェアを書くためのターゲット。
> UEFI アプリケーションを書く場合は `x86_uefi_app` を使う。
>
> `cortex_m` のスタックは `ram.origin + ram.length`（RAM 末端）がデフォルト。
> Cortex-M の慣例（スタックは上位アドレスから下方成長）に従う。

---

## 4. `layer` フィールド詳細

各 layer は下位 layer を**累積的に包含する**（機能が段階的に追加される）。

| 数値 | 別名 | 説明 | alloca | Int | Float | Vector(SIMD) | 動的モジュール | `@`/`#` 意味論 |
|:---:|:---:|---|:---:|:---:|:---:|:---:|:---:|---|
| `0` | bare | RAM 未初期化。BIOS/UEFI 初期フェーズ相当 | ✗ | ✓ | ✗ | ✗ | ✗ | volatile 自動適用 |
| `1` | alloc | RAM 開通・alloca 有効。`Rc`/`Arc` が使用可能 | ✓ | ✓ | ✗ | ✗ | ✗ | 通常 load/store |
| `2` | fpu | FPU 初期化済み。`Float`/`Double` が使用可能 | ✓ | ✓ | ✓ | ✗ | ✗ | 通常 load/store |
| `3` | simd | SIMD 初期化済み。`Vector` 型が使用可能 | ✓ | ✓ | ✓ | ✓ | ✗ | 通常 load/store |
| `4` | std | OS 依存フル機能層。動的モジュール解決が有効 | ✓ | ✓ | ✓ | ✓ | ✓ | 通常 load/store |

> [!IMPORTANT]
> **layer と使用可能なリテラル型の対応**
>
> | リテラル形式 | 型 | 必要 layer |
> |---|---|:---:|
> | `42`, `-1`（整数） | `Int` | 0以上 |
> | `0x00`, `0xFF`（アドレス） | `Address` | 0以上 |
> | `0r00`（bit列） | raw binary | 0以上 |
> | `0u0000`（Unicode） | `Char` | 0以上 |
> | `` `text` ``（文字列） | `String`（= `List(0u)`） | 0以上 |
> | `3.14`, `1.0`（小数点あり） | `Float` | **2以上** |
> | `[1.0 2.0 ...]`（SIMD指定） | `Vector` | **3以上** |
>
> `layer < 2` で Float リテラルを使用するとコンパイルエラー。

### 4.1 layer 間インポートルール

> [!IMPORTANT]
> **自身より高い layer のコードはインポートできない。**

| 自身 | インポート先 | 結果 |
|:---:|:---:|---|
| layer: 0 | layer: 0 | ✅ 可 |
| layer: 0 | layer: 1 | ❌ コンパイルエラー |
| layer: 2 | layer: 1 | ✅ 可（下位はインポート可） |
| layer: 2 | layer: 3 | ❌ コンパイルエラー |


### 4.2 `charset` フィールド詳細

メモリ上の Char 1 個の幅を選ぶ。

| 値 | Char の幅 | 用途 |
|---|:---:|---|
| `ascii` | 1 byte | **デフォルト。** `layer: 0` の組み込み。UART 出力やブートログに Unicode は要らない |
| `utf32` | 4 byte | 全 Unicode を表現でき、添字は O(1) のまま |

> [!NOTE]
> **既定が `ascii` なのは、Sign が最初に書くのが OS カーネルだからである。**
>
> そこは `layer: 0` の世界であり、1文字1バイトなら `.rodata` もそのままバイト列になる。
> 全 Unicode が要る場面では `charset : `utf32`` と書けばよい。
>
> **この既定は入れ替えうる。** 応用の重心が Unicode を要する側へ移れば、`utf32` を
> 既定に戻して `ascii` を特殊扱いにする方が素直になる。どちらが既定であっても、
> 選択肢が固定幅2つであることと、IO 境界が常に UTF-8 であることは変わらない
> ——`charset` が決めるのは**メモリ上の Char 1個の幅**だけである。
>
> **`charset` に収まらない文字はコンパイルエラーである。** `ascii` を選んで U+0080 以上を
> 書けば止まる。黙って下位バイトへ落とすと、書いた文字と出る文字が違うという一番
> たちの悪い壊れ方をするためである（layer の門番と同じ扱い、§4）。

> [!IMPORTANT]
> **選択肢は固定幅に限る。UTF-8 は入っていない。**
>
> [`type_system.md`](../type/type_system.md) は `List` を「**固定幅要素**の連続領域」と定め、
> `String ≅ List(0u)` の根拠を「**要素幅が同じなら**同一のビット表現」と書いている。
> 可変長の表現を選ぶとこの同型が崩れ、`s ' i` を `base + i × sizeof(T)` の 1 命令で
> 出せなくなる——`String` が `List` でなくなってしまう。
>
> [`value_representation.md`](../core/value_representation.md) が UTF-8 を採るのは
> **境界の話**である。同文書 §4 のタイトルが「外部から届いた Byte 列を Char 列へ変換する
> 境界」と言う通り、UTF-8 の自己記述性（先頭バイトのビットパターンが「何バイト列か」を
> 語るので boxing が無償になる）が効くのは、まさにその変換の場である。
>
> したがって役割は次のように分かれる。
>
> | | 形式 | 決めるもの |
> |---|---|---|
> | メモリ上の `String` | `charset`（固定幅） | 添字と `List` との同型 |
> | IO 境界・保存・転送 | UTF-8（常に） | 自己記述による無償の boxing |
>
> UTF-8 をメモリ表現としても選べるようにするかは**未決**である。必要になった段階で、
> 「`String` が `List` でなくなる」ことの帰結（添字が O(n) になる、`List` の固定幅要件に
> 例外が要る）ごと設計する。

---

## 5. `link` フィールド詳細

### 5.1 `link: dynamic`（デフォルト）

OS のダイナミックローダーに委ねる。`layer: 4`（std）のみで有効。

```ms
link : dynamic
```

### 5.2 `link: static` — 手動メモリマップ（組み込み）

物理メモリ境界を手動で決定する場合。

```ms
link :
    static :
        memory :
            rom : origin 0x08000000  length `1024K`
            ram : origin 0x20000000  length `128K`
```

> [!IMPORTANT]
> **サイズは文字列で書く（`ms` 独自の表記）。**
>
> Sign の数値リテラルに `K`/`M`/`G` 接尾辞は無いので、`length 1024K` と素で書くと字句解析を
> 通らない。接尾辞を言語側へ足すこともできたが、**メモリマップにしか要らない表記のために
> 言語の字句解析を触らない**方を採った。文字列なら Sign の文法のままであり、解釈は `ms` の
> 読み手が担う——`ms` は Sign の積型記法の上に乗る**データ形式**なので、値の読み方を形式の
> 側が決めるのは筋が通っている。
>
> | 書き方 | byte 数 |
> |---|---|
> | `` `1024k` `` / `` `1024K` `` | 1048576（1K = 1024。10進の 1000 ではない） |
> | `` `4M` `` | 4194304 |
> | `` `4096` `` | 4096（接尾辞なしも可） |
>
> 大文字小文字は問わない。`origin` はアドレスなので従来どおり `0x…` の数値で書く
> ——アドレスとサイズは別のものであり、記法でも別れている（type_system.md §3.6）。

### 5.3 `link: static` — 実行時マップ取得（PC/SBC）

UEFI やデバイスツリー経由で実行時にメモリサイズが決定される場合。

```ms
link :
    static :
        memory :
            rom : origin 0x00000000  length `4M`
            `UEFI/デバイスツリーから起動時に自動マッピング`
            ram : auto
```

### 5.4 `link: static` — ヒープ領域の一括確保（`layer: 1+`）

`layer: 1` 以上で動的メモリ管理を行う場合、`heap: max` で起動時に一括確保。
内部はバンプポインタアリーナとして管理（O(1) アロケーション、`free` 不要）。
ヒープの必要サイズは、ソースコード内で前置 `#` や `##` 系の演算子（アロケーション操作）を使用した箇所からコンパイラが静的に導出・決定する。

```ms
layer : 1
link :
    static :
        memory :
            ram  : origin 0x20000000  length `128K`
            `起動時に 64K を一括確保、内部はアリーナで管理`
            heap : max `64K`
```

### 5.5 link サブフィールド一覧

| フィールド | 型 | 意味 |
|---|---|---|
| `static.memory.rom` | `origin <addr> length <size>` | ROM 領域のアドレスとサイズ |
| `static.memory.ram` | `origin <addr> length <size>` または `auto` | RAM 領域。`auto` は実行時決定 |
| `static.memory.heap` | `max <size>` | ヒープ一括確保サイズ（`layer: 1+` のみ） |

`<size>` は**文字列**で書く（§5.2 の IMPORTANT）。単位は `K`（1024）、`M`（1024²）、
`G`（1024³）、接尾辞なし（バイト）。大文字小文字は問わない。`<addr>` は `0x…` の数値。

---

## 6. 継承モデル

### 6.1 ディレクトリ構造と継承

変更がないフォルダには `option.ms` を置く必要はなく、親ディレクトリの設定を暗黙継承する。

```
project/
  option.ms              ← ルート設定（全体のデフォルト）
  │
  ├── kernel/
  │     option.ms        ← layer: 0 に変更あり → 配置必要
  │     ├── drivers/
  │     │    └── uart.sn   ← option.ms なし（kernel/ の設定を継承）
  │     └── mm/
  │           option.ms  ← layer: 1、heap: max 追加 → 配置必要
  │
  ├── userspace/
  │     option.ms        ← layer: 4 に戻す → 配置必要
  │
  └── lib/
        option.ms        ← target: wasm など別ターゲット → 配置必要
```

### 6.2 継承ルール

- 対象ファイルのフォルダからルートに向かって `option.ms` を探索し、スタックして適用
- 近いフォルダで定義されたキーほど優先（上書き）
- `inherit : false` を宣言すると親設定を無視して独立（デフォルト: `true`）

---

## 7. `boot.sn` 自動生成

コンパイラは `entry` / `stack` / `target` の設定から**スタートアップスタブを自動生成**し、
`boot.sn` として出力する。`crt0.s` を手書きする必要はない。

| 状況 | 動作 |
|------|------|
| `boot.sn` が存在しない | コンパイラが `option.ms` から自動生成 |
| `boot.sn` が存在する | ユーザー提供の `boot.sn` を使用（オーバーライド） |

生成される `boot.sn` の役割：
1. スタックポインタの初期化（`stack` フィールドの値を使用）
2. `main.sn` への制御移管（`entry` アドレスに配置）
3. `heap: max` 指定時はヒープアリーナの初期化コードも生成

---

## 8. `@`/`#` 演算子の layer 別意味論

| 演算子の用法 | layer 0 (bare) | layer 1+ |
|:---|:---|:---|
| **中置 `#`** (`ptr # val`) | `write_volatile`（最適化消失を防止） | `*ptr = val`（通常書込み） |
| **前置 `@`** (`@ptr`) | `read_volatile`（最適化消失を防止） | `*ptr`（通常読込み） |
| **前置 `#`** (Project alloc) | ❌ コンパイルエラー | ✅ `Rc<RefCell<T>>` 相当 |
| **前置 `##`** (Shared alloc) | ❌ コンパイルエラー | ✅ `Arc<Mutex<T>>` 相当 |
| **前置 `###`** (Pin alloc) | ❌ コンパイルエラー | ✅ 固定アドレス配置 |
| **後置 `@`** (link: static) | ✅ 静的シンボル解決 | ✅ 静的シンボル解決 |
| **後置 `@`** (link: dynamic) | ❌ コンパイルエラー | ✅（layer: 4 のみ有効） |

詳細は [`System_Architecture_ja-jp.md`](System_Architecture_ja-jp.md) §3 を参照。

---

## 9. 実用テンプレート集

### 9.1 ホスト向けアプリケーション（デフォルト）

```ms
` option.ms — ホスト向け（省略可能：すべてデフォルト値）
target   : rust
layer    : 4
optimize : 0
```

### 9.2 BIOS ブートローダー

```ms
target   : x86_bios
layer    : 0
link :
    static :
        memory :
            rom : origin 0x7C00   length 512
            ram : origin 0x9000   length `512K`
```

### 9.3 UEFI 代替ファームウェア

```ms
target   : x86_firmware
layer    : 0
link :
    static :
        memory :
            rom : origin 0xFFFFF000  length `64K`
            ram : auto
```

### 9.4 Raspberry Pi 4 ベアメタル

```ms
target   : aarch64_rpi
layer    : 0
link :
    static :
        memory :
            rom : origin 0x80000    length `1M`
            ram : origin 0x200000   length `256M`
```

### 9.5 STM32 Cortex-M マイコン

```ms
target   : cortex_m
layer    : 1
optimize : 2
link :
    static :
        memory :
            rom : origin 0x08000000  length `1024K`
            ram : origin 0x20000000  length `128K`
            heap : max `32K`
```

### 9.6 WebAssembly モジュール

```ms
target   : wasm
layer    : 4
output   : `module`
```

### 9.7 OS カーネル（マルチレイヤー構成）

```ms
` kernel/option.ms — カーネルコア（bare metal）
target   : x86_firmware
layer    : 0
link :
    static :
        memory :
            rom : origin 0xFFFFF000  length `64K`
            ram : auto
```

```ms
` kernel/mm/option.ms — メモリ管理モジュール（alloca 有効）
layer    : 1
link :
    static :
        memory :
            heap : max `128K`
```

```ms
` userspace/option.ms — ユーザースペース
layer    : 4
link     : dynamic
```

---

## 10. ビルドコマンド

```sh
sign build .             # カレントディレクトリからビルド（main.sn を起点）
sign build kernel/       # 指定フォルダ以下をビルド
sign build src/main.sn   # 特定ファイルを指定してビルド（最近傍の option.ms を適用）
```

コマンドライン引数によるオーバーライド（一時的な上書き）：

```sh
sign build . --layer 0 --optimize 0
sign build . --target aarch64_rpi
```

> [!NOTE]
> コマンドライン引数はあくまで**緊急時のオーバーライド**。
> 通常のビルド構成は `option.ms` で管理することを推奨する。

---

## 11. 関連ドキュメント

| ドキュメント | 参照すべき内容 |
|---|---|
| [`Build_System_ja-jp.md`](Build_System_ja-jp.md) | ms フォーマット概要、継承モデルの設計思想 |
| [`Entry_Point_ja-jp.md`](Entry_Point_ja-jp.md) | boot.sn 自動生成詳細、target 別スタートアップコード例 |
| [`System_Architecture_ja-jp.md`](System_Architecture_ja-jp.md) | `#`/`@` の layer 別意味論、随伴関係によるリンク自動導出の数学的基盤 |
| [`Integer_Overflow_ja-jp.md`](../core/Integer_Overflow_ja-jp.md) | layer × リテラル型の切り分け詳細 |
