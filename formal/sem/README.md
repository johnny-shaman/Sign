# SignSem：alpha1 の挙動を Lean で

alpha1 の実装（`alpha1/javascript/`）の挙動を、Lean 4 の全域の関数で写す。Mathlib は使わない（`formal/lean` の `SignMath` とは別の package）。
的は仕様の文でなく実装の挙動で、断りの名前・理由・行・文まで同じ物を返す。`alpha1/` の下は読むだけ。Lean は v4.36.0（`lean-toolchain`）。

## 今あるもの：前段（源 → 行の木）

| file | 写す物 |
|---|---|
| `SignSem.lean` | 下の `SignSem/` の全部を読み込む入口 |
| `SignSem/JStr.lean` | JS の文字列（`JStr`、UTF-16 の符号単位の並び）と、その道具（単位ごとの `==`、単位の辞書式の `JStr.lt`、`slice`・`trim`、ES2019 の `JSON.stringify` の `jsonStringify`、`toString?` など） |
| `SignSem/Syntax.lean` | 行の木（`Row`・`Term`・`Core`）、文法の語の行（`WRow`・`Word`）、前処理の答え（`Pre`）、断り（`FrontErr`） |
| `SignSem/JV.lean` | JS の値としての JSON（`JV`）と、その読み手 `JV.parse`（UTF-8 のバイトから。文字列は `JStr` のまま）、`==`・`hash`・`compress` |
| `SignSem/Json.lean` | 上の型と `JV` の行き来（`formal/check/sem/dump.mjs` が書く stages と同じ形） |
| `SignSem/Lex.lean` | `Lex.preprocess`：lexer.js の preprocessWithLines |
| `SignSem/Peg.lean` | `Peg.parse`：sign.pegjs から peggy 4.2.0 が作る構文解析器 |
| `SignSem/Tree.lean` | `Tree.rows`：resolve.js の tokenize・makeCore・parseRow（ファイルの行ごと） |
| `SignSem/Front.lean` | `Front.front`：上の3つをつないだ物（resolve.js の resolve() の頭） |
| `SignSem/Axioms.lean` | 入口と道具の `#print axioms` の出力を固める（変われば組み立てが止まる） |
| `Main.lean` | `signsem check`：JS の答えに段ごとに当てる道具（使い方と比べの意味は file の頭）。`signsem bench` は `JV.parse` の速さを測る |

- 段の file（`JStr`・`Syntax`・`Lex`・`Peg`・`Tree`・`Front`）は `partial def` を使わない（使うのは `Json.lean`・`JV.lean`（読み手の
  `JV.parse` のほか）・`Main.lean` だけ）。構造で止まらない所は燃料を引数にする。燃料が切れた所と、写しの前提が崩れた所は、名前
  `InternalError` の断りを返す（JS には無い断りで、下の集まりでは1つも出ない）。
- JS のスタックの溢れ（括り 2 万段など）は写さない。写しは燃料と構造の再帰で止まり、木を返す。

## 文字列と位置

- 文字列はどれも `JStr`（JS の文字列）で、源から段の答えまで単位の並びのまま運ぶ。対の無いサロゲートも1つの単位で、ほかの字
  （U+FFFD など）に替えない。peggy の断りの文の found が対の片方の時も、源や text に対の無いサロゲートがある時も、JS と同じ単位を返す。
- 長さ・切り出し・字の比べは単位で数える（JS の `.length`・`slice`・`charCodeAt`）。alpha1 の正規表現には u の印が無いので、写しも
  1単位ずつ当てる（BMP の外の字は上の半分と下の半分を別に見る）。
- 位置（`WRow` の `start`・`qs`、断りの位置、`Pre.lineAt` の添え字）は UTF-16 の単位の番号で、peggy の offset のまま。`Pre.lineAt` は
  位置 0〜`text` の単位の数の全部で引く表で、大きさは単位の数 + 1（`Pre.fromJson` はほかの大きさを読まない）。
- JSON は `JV.parse` が UTF-8 のバイトから読む。`\uXXXX` はちょうど1単位、4 バイトの字は対の2単位。崩れた UTF-8（サロゲートを
  UTF-8 にした物も）・小数・安全な整数の外の数は断る。物は鍵の順に並べて持ち（`JStr.lt`）、同じ鍵は後の物を残す（JS の `JSON.parse` と同じ）。
- Lean の String に直すのは `JStr.toString?` だけで、対の無いサロゲートのある文字列は直さない（none を返す）。表示と `JV.compress` は
  `jsonStringify` した文（対の無いサロゲートは `\udxxx`）を直すので、字を失わない（`JStr.quote`）。断りの文などに書く字面は
  `Coe String JStr`（`JStr.ofString`、公理なし）で JStr にする。

## `#print axioms`

的は Classical.choice に依らないこと。Lean 4.36 では String・Int・UInt16 の `==`、`String.toList`・`String.length` が choice を
引き込むので、写しは JStr の `==`（`JStr.beq`、UInt16 の比べは `instBEqUInt16Decide`）で比べ、字は自前の UTF-8 の読みで取る。
`SignSem/Axioms.lean` が次の出力を `#guard_msgs` で固める。

| 定義 | 公理 |
|---|---|
| `Front.front`・`Lex.preprocess`・`Tree.rows` | `[propext, Quot.sound]` |
| `Peg.parse`・`JStr.lt`・`JStr.jsonStringify`・`JStr.toString?`・`JV.parse` | `[propext]` |
| `JStr.ofString`・`JStr.beq` | 無し |

## 確かめたこと（2026-11-25）

定理はまだ無い。確かめは2つ。

- 各 file の `#guard`：node v24.16.0 で lexer.js・peggy の parser・`JSON.parse`・`JSON.stringify` から取った値に当てる（対の無いサロゲート、
  BMP の外の字、escape の大文字と小文字、深い入れ子など）。`lake build` が組む度に照らす。
- `signsem check`：`formal/check/sem/gate.mjs` の 20 個の集まり（主の例と揺さぶりの源）の 2,991,545 行に、段ごとに JS の答えを当てる。
  比べは JV の値の `==` で、文字列は単位ごと、位置は単位の番号のまま。段を当てた行は前処理 2,585,642・文法 2,064,130・木 713,935・
  通し 2,585,641 で、違い・読めない行・写しの InternalError は 0。外したのは、JS がスタックの溢れ（RangeError）で止まる主の例の
  id 1193（括り 2 万段）の文法と通しだけ。対の無いサロゲートのある行は、段の入力にある物 53,870 行、答えだけにある物 290,023 行で、
  どれもそのまま比べて合う。

## 組み立てと突き合わせ

```sh
cd formal/sem && lake build
cd ../.. && node formal/check/sem/gate.mjs          # 今ある stages に当てる（約 9 分）
node formal/check/sem/gate.mjs --dump               # stages を alpha1 から書き直してから当てる（約 43 分）
```

1つの集まりだけを当てる時：

```sh
node formal/check/sem/gunzip.mjs < formal/check/out/sem/stages.jsonl.gz | formal/sem/.lake/build/bin/signsem check
```

`gate.mjs` は、signsem の組み立てが今の源から組んだ物か（`lake build --no-build`）を見て、期待を壊した行と終わりの印を崩した入力で自己試験をし、
`formal/check/out/sem` の stages の集まり（20 個）の全部に、期待を壊した行を混ぜて `signsem check` を当て、終わりの印（本数・
単位 `"units": "utf16"`・alpha1 と道具の版・源の集まり・dump.mjs の門）と指紋（行の数・対の無いサロゲートのある行の数・段ごとの数と
写しの答えのハッシュ、`formal/check/sem/gate_expect.json`）を照らす。集まりの作り方・門の決まり・数は `formal/check/sem/README.md`。

## まだ無いもの

- 読む段の後ろの段（種類と断り）。
- 値の段（interpret.js）。
- `formal/lean` の模型と、ここの定義をつなぐ定理。
