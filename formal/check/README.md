# check：J-1・J-2 の模型を alpha1 の読む段に当てる道具

skeleton.md の J-2 の終わり（〔実〕）の数を出す道具。どれも node で回す（v24.16.0 で確かめた）。出力は `out/` に書き、git には入れない。リポジトリのほかのファイルは書き換えない。

- `model.mjs`：Typing.lean・Arith.lean の定義を JS に写した模型。注の `T:n`・`A:n` は Lean の行。
- `model.test.mjs`：Lean の定理が言う事実を、模型の上で確かめる。
- `mutate.cjs`：模型に変異を入れて、試験が落とすかを見る。
- `ex.mjs`：`alpha1/docs/coproduct_spec.md` の規則の例から、源と仕様の答えを取り出す。
- `dump.mjs`：alpha1 の読む段（`alpha1/javascript/resolve.js`）の木・知らせ・断りを、例ごとに出す。関数を包んだ写しを `out/.gen` に書いて読み、包まない resolve.js と突き合わせる。
- `compare.mjs`：上を合わせて T0〜T3 を比べ、`out/results.json`・`out/mismatches.json`・`out/counts.json` を書く。

手順（このディレクトリで）：

```sh
node model.test.mjs
node mutate.cjs
node --stack-size=8000 compare.mjs --regen
```
