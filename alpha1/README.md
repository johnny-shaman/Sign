# alpha1

alpha を作り直す2本目の実装である。`_` は id、`!_` は void で、`!_` は id の否定から導いた綴りである（`docs/coproduct_spec.md` の R138）。
前処理・構文・演算子の表の構文の欄・`OperationError` は、alpha（c3b203fc）の JavaScript から持ってきた。

## 今あるもの

| ファイル | 中身 |
|---|---|
| `javascript/lexer.js` | 前処理（`separateInfix`・`classifyNewlines`・`preprocess`・`preprocessWithLines`） |
| `javascript/sign.pegjs` | 文法。1行を語の平たい配列で返す。`_` は id の字面1つ、括り（`[…]`・`{…}`・`(…)`）は印 `BRACKET_` の1項 |
| `javascript/operator_table.js` | 演算子の表のうち、構文が使う欄（段・位置・名前・結合の向き・廃止の印） |
| `javascript/errors.js` | `OperationError`。`lexer.js`・`resolve.js`・`interpret.js` が使う |
| `javascript/resolve.js` | 読む段（余積の解決）。`resolve(source)` は木と知らせを返し、断る形は投げる（読む段の断りは理由 `reason` つき、前処理と文法の構文の誤りは `SyntaxError`） |
| `javascript/interpret.js` | 値の段の片1。`interpret(source)` は resolve を通してから、定義でない行の値を返す |
| `javascript/package.json` | peggy だけに依る。`npm test` と `npm run build:parser` |
| `docs/coproduct_spec.md` | 読む段の規則（R 番号）・門と断り・問い |
| `docs/value_spec.md` | 値の段の規則（V1〜V12） |
| `docs/law_map.md` | 解決器の部品を仕様の R と試験の法則に当てた索引と、実装の注意 |

`javascript/test/`：

| ファイル | 見る物 |
|---|---|
| `parser.test.js` | 文法が返す語の列 |
| `block_rules.test.js` | 字下げのブロックの置き場所・定義の終わりの空行・続きの行 |
| `comment_discriminator.test.js` | 行頭のバッククォートの読み分けが、alpha1 の文法・documents/ の文法2本・エディタの文法2本で揃うか |
| `editor_char.test.js` | 文字の字面（`\` と直後の1字）を、エディタが文字として塗るか |
| `coproduct.test.js` | 読む段の見本（仕様 §6.3）を、木・種類・断りで |
| `coproduct_laws.test.js` | 読む段の法則。期待値を書かずに、同じ射の2つの綴りを比べる |
| `interpret.test.js` | 値の段の答え・法則・木との突き合わせ・知らせ・まだ・資源 |
| `run.js` | `test/*.test.js` を全部回す |

## 決まったこと

読む段の規則は `docs/coproduct_spec.md`、値の段の規則は `docs/value_spec.md` にある。ここに書くのは、どちらにも無い決まりだけである。

### 前処理

- **行末の中置とブロック**（R）：空白で区切られた行末の `-`・`~`・`#`・`@` は中置で、その右に字下げのブロックを開ける（`n : 1 -` ⏎ `⇥2` の右辺は `(- 1 (block 2))`）。
- **定義の終わりの空行**（U・U〔答え〕）：いちばん外の定義が字下げのブロックで終わったら、続きの行でない次の行の前に空行を1行置く。無ければ `definition-end-blank-line` で断る。
  - 定義かどうかは、いちばん外の行（続きの行をつないだ物）に括りの外の `:` があるかで見る。値の定義（`n : 1 +` ⏎ `⇥2`）も同じ。
  - 空行が要らない所：ブロックの途中の深さの変わり目、ブロックの中の定義の終わり、1行で書き終えた定義、仮引数のブロックの後の `?` の行の前、
    括りで行をまたいだ定義（`p : [` … `]`）、ファイルの終わり。
  - 行頭のコメントの行は空行に数えない。ブロックの中の空行と、1行の定義どうしの間の空行は読み捨てる。

### 書き方

- **構造体と取り込み**（U・U〔答え〕）：構造体は1つずつが実体で、型の名前を付けて拡張しない。範囲を限った取り込みは関数で書く。関数の本体を範囲にし、取り込んだ物をその関数に当てて、
  使う名前は仮引数（`[say]`・`[say ~rest]`・`[~rest]`）で受ける。IO は関数がする。
- **ブロックの中の欄**（U〔答え〕。糖衣を作らないのは R）：分解して受ける関数で読み（`greeting : [greet world] ? (greet ' welcome) world`）、書き換えは組み直しで書く。糖衣は作らない。
- 例は `documents/ja-jp/guide/pattern_guide.md`（IO Reader Writer）・`guide/example.sn`・`impl/type/list_model.md` §5.3.1 にある。

### 文字

- `0uXXXX` は符号位置 XXXX（16 進）の文字の字面である（U〔答え〕）。
- 文字は Int と同じ扱いで、違うのは入出力のときだけ。文字は位置で、文字 − 文字 は Int（距離）、文字 ± Int は文字（U〔答え〕）。
- 型の段と値の段の決まりで、値の段の文字は `docs/value_spec.md` V12 のまだ。

### 文法

- **囲みの中の定義**（U・R）：絶対値・ノルムの囲み（`|…|`・`||…||`）のすぐ中の行には `:` を置けず、文法が断る（`:` は値を返さないので囲みの域に入らない）。括りに入れた構造体（`|[x : 1] ' x|`）は値なので通る。

## alpha との違い

- `sign.pegjs` の規則 `unit = "_"` は id の字面1つで、規則の名は alpha のまま。同じ名でも、木の節 `(unit X)`（仕様 §1.3）と `interpret.js` の `UNIT` は void で、値は `!_`。
- `lexer.js` は alpha の前処理に、字下げのブロックの置き場所（`block-after-value`）・定義の終わりの空行（`definition-end-blank-line`）・括りの中の `?` の行（`param-block-bracket`、R135）の断りと、元のソースの行を返す `preprocessWithLines`（R127）を足した。続きの行は行頭に空白のある行だけ（R117）。
- `operator_table.js` は、命令の綴り（`asm` 欄）と `NOT_YET`・`NOT_AN_INSTRUCTION` を持ってこなかった。機械の側で要る物で、alpha の表に残っている。

## documents/ との食い違い

documents/ のうち「旧仕様」の印の無い所で、alpha1 と食い違うもの：

- `impl/syntax/grammar.pegjs`（ja-jp・en-us）は、単位を `unit = "__" / "\x00"`、穴を `hole = "_"` で持つ。
- `guide/example.sn`（ja-jp・en-us）は `_` を void に使い（`nop : _`・`none : _`・`unit : _`）、空の器を手で書く（`none : []`・`unit : none : []`。alpha1 では empty-written、R138）。
- `impl/build/preprocessor.md`（ja-jp・en-us）に、字下げのブロックの置き場所と定義の終わりの空行の規則が無い。
- `guide/function_guide.md`（ja-jp・en-us）の完全性公理（書いた実引数に `!_` が1つでもあれば結果は `!_`）は、仕様 R83・R31・§3.7 と食い違う。
- guide の例（`function_guide.md`・`reference.md`、ja-jp・en-us）は `!_` を手で書く（`[+] 1 !_ 3`・`nop : !_`）。alpha1 では読む段が断る（void-written、R138）。

## まだ無いもの

- 型の段。
- 値の段の残り（`docs/value_spec.md` V12）。
- 機械（pass4）と、自己ホストの `.sn`。
- 読む段で決まっていない所は `docs/coproduct_spec.md` §5.1 にある。

## 試験

```bash
cd alpha1/javascript && npm test
```

- `test/run.js` が `test/*.test.js` を1本ずつ別のプロセス（`--stack-size=8000`）で回し、ファイルごとの件数と合計を出す。
  1本だけなら `node --stack-size=8000 test/<名前>.test.js`。新しい試験は `test/` に `*.test.js` で置き、最終行に `N/M passed` を出す。
- 試験と `resolve.js` は `sign.pegjs` をその場で組み立てるので、`build:parser` の `parser.js` には依らない。
- `comment_discriminator.test.js` は documents/ の文法と tools/ のエディタの文法を、`editor_char.test.js` は tools/ のエディタの文法を読む。
