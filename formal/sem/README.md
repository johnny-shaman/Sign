# SignSem：alpha1 の挙動を Lean で

alpha1 の実装（`alpha1/javascript/`）の挙動を、Lean 4 の全域の関数で写す。Mathlib は使わない（`formal/lean` の `SignMath` とは別の package）。
的は仕様の文でなく実装の挙動で、断りの名前・理由・行・文まで同じ物を返す。`alpha1/` の下は読むだけ。

## 今あるもの：前段（源 → 行の木）

| file | 写す物 |
|---|---|
| `SignSem/Syntax.lean` | 行の木（`Row`・`Term`・`Core`）、文法の語の行（`WRow`・`Word`）、前処理の答え（`Pre`）、断り（`FrontErr`） |
| `SignSem/Json.lean` | 上の型の JSON（`formal/check/sem/dump.mjs` が書く stages と同じ形） |
| `SignSem/Lex.lean` | `Lex.preprocess`：lexer.js の preprocessWithLines |
| `SignSem/Peg.lean` | `Peg.parse`：sign.pegjs から peggy が作る構文解析器 |
| `SignSem/Tree.lean` | `Tree.rows`：resolve.js の tokenize・makeCore・parseRow（ファイルの行ごと） |
| `SignSem/Front.lean` | `Front.front`：上の3つをつないだ物（resolve.js の resolve() の頭） |
| `Main.lean` | `signsem check`：JS の答えに段ごとに当てる道具 |

- 段の file は `partial def` を使わない（使うのは `Json.lean` と `Main.lean` だけ）。構造で止まらない所は燃料を引数にする。燃料が切れた所と、写しの前提が崩れた所は、名前 `InternalError` の断りを返す。
- `#print axioms SignSem.Front.front` は `[propext, Quot.sound]`（`Classical.choice` を使わない）。Lean 4.36 の `String.toList` などは choice に頼るので、字は自前の UTF-8 の読みで取る。
- 位置は Unicode の符号位置で数える（文法は中で UTF-16 の単位で読み、符号位置に直す）。
- Lean の String は対の無いサロゲートを持てない。JS の答えに対の無いサロゲートが出る所（peggy の断りの文の found が対の片方の時など）では U+FFFD を返す。入力（源・text）にある時は、U+FFFD に替えた入力での答えを返す（JS の答えと同じとは限らない。比べの意味は `Main.lean` の頭）。
- JS のスタックの溢れ（括り 2 万段など）は写さない。写しは燃料と構造の再帰で止まり、木を返す。

## 組み立てと突き合わせ

```sh
cd formal/sem && lake build
cd ../.. && node formal/check/sem/gate.mjs
```

`gate.mjs` は、signsem の組み立てが今の源から組んだ物か（`lake build --no-build`）を見て、期待を壊した行と終わりの印を崩した入力で自己試験をし、`formal/check/out/sem` の stages の集まり（主の例と揺さぶりの源、20 個）の全部に、でたらめな位置に期待を壊した行を混ぜて `signsem check` を当て、終わりの印（本数・alpha1 と道具の版・源の集まり・dump.mjs の門）と指紋（数と写しの答えのハッシュ、`formal/check/sem/gate_expect.json`）を照らす。集まりの作り方・門の決まり・数は `formal/check/sem/README.md`。

## まだ無いもの

- 読む段の後ろの段（種類と断り）。
- 値の段（interpret.js）。
- `formal/lean` の模型と、ここの定義をつなぐ定理。
