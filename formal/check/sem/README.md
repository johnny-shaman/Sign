# sem：alpha1 の前段の答えを書き出し、Lean の写しに当てる道具

alpha1 の前段（B1 前処理・B2 文法・B3 行の木）が源ごとに返す物を JSON Lines で書き出し、Lean の写し（`formal/sem` の `SignSem`）に当てる。
node（v24.16.0 で確かめた）で回す。出力は `formal/check/out/sem/` に書き、git には入れない（`formal/check/.gitignore` の `/out/`）。`alpha1/` の下は読むだけ。

## ファイル

- `record.mjs`：源を集める。試験一式（`alpha1/javascript/test/*.test.js` の全部を、`run.js` と同じ並び・`--stack-size=8000`・cwd で）を `hook.mjs` を入れて走らせ、`resolve`・`interpret`・`preprocess`・`preprocessWithLines` に来た源を覚える。仕様の例（`../ex.mjs` で `alpha1/docs/coproduct_spec.md` から取り出し、`std.mjs` の withStd で STD を前に付けた物）を足し、重複を除く。
- `hook.mjs`・`rec_store.mjs`・`rec_lexer.mjs`・`rec_resolve.mjs`・`rec_interpret.mjs`：試験の file を変えずに、試験（と試験が起こす子のプロセス）の import を、来た源を覚える包みに付け替える（`NODE_OPTIONS=--import=…`）。alpha1 の中の呼び出し（interpret → resolve → preprocessWithLines）は外から来た源と同じ源なので数えない。alpha1 の道はこの file の置き場から相対で引く。
- `gen_front.mjs`：`resolve.js` の写しを `out/sem/gen/` に作り、末尾に `frontRows(source)` を足す。中身は `resolve()` の頭（`frontEnd` と行ごとの `parseRow`、前段の catch まで）を字のまま写した物で、`resolve` と同じ形の `{rows, lineOf}` を返し、後の段は走らせない。置き換えはどれもちょうど1回当たることを確かめ、外れたら止める。
- `dump.mjs`：源ごとに B1・B2・B3 を走らせて書き、門（本物の resolve との照らし）を当てる。
- `rowsjson.mjs`：rows を JSON にする・戻す（`core.raw` を落とし、行の木に `"line"`）。`std.mjs`：`formal/check/dump.mjs` の withStd と同じ STD の付け方。
- `gen/`：揺さぶりの源の集まりを作る道具。`gen/all.mjs` が全部を決まった引数と種で順に作る（並びと引数は `gen/all.mjs` の頭）。
- `gate.mjs`：門の一式。signsem の組み立てが今の源から組んだ物かを見て、自己試験を走らせ、stages の集まりの全部に `signsem check` を当て、終わりの印（本数・版・源の集まり・dump.mjs の門）と指紋（`gate_expect.json`）を照らす（下の「門」）。
- `gunzip.mjs`：標準入力の gzip を解いて標準出力へ流す。Windows の pipe では、書き手（`gzip -dc`）の長さ 0 の書き込みが Lean の読む側に EOF に見えることがあるので、手で流す時はこちらを使う（`gate.mjs` は node の中で解く）。

## 走らせ方

リポジトリの頭で、1本ずつ：

```sh
node formal/check/sem/record.mjs          # 約 4 分
(cd formal/sem && lake build)
node formal/check/sem/gate.mjs --dump     # 全部を書き直してから当てる
```

`gate.mjs --dump` は、main を `node --stack-size=8000 dump.mjs --sources sources.jsonl --out stages.jsonl.gz` で書き（約 8 分）、`gen/all.mjs` で源の集まりと前処理を通さない text の集まりを作り直し（約 2 分。fuzz・rawfuzz は stages.jsonl.gz の頭を種に使う）、残りの源の集まりを `dump.mjs` で書いてから（約 23 分。うち treerev_big が約 14 分）、全部に当てる（約 19 分）。`record.mjs` は走らせないので、試験一式か仕様の例が変わったら先に `record.mjs` を回す。

- `record.mjs --merge-only` は試験を走らせず、覚えた `out/sem/rec/` と今の仕様の例を合わせ直す。
- `dump.mjs` は `node --stack-size=8000` で走らせる（`gen_front.mjs` の `STACK_ARG`。スタックの大きさは版の印に入り、ほかの大きさで書いた stages は門の版の照らしで落ちる）。引数：`--limit-mb 200`・`--skip N`・`--max N`・`--out 名前.jsonl`（`.jsonl.gz` なら gzip の塊を続けて書き、`--limit-mb` は書いた gzip の大きさに当てる）・`--no-write`・`--sources 名前.jsonl`（`out/sem` の下の源の集まり、既定 `sources.jsonl`）。
- `gate.mjs` の引数：`--dump`（全部を書き直してから当てる。`--only` に依らず全部。書き出し済みなら省いて約 19 分）・`--exe 道`（当てる signsem。組み立ての確かめは飛ばす）・`--fail-fast`・`--max-diffs N`（集まりの `signsem check` に、混ぜた行の分を足して渡す。自己試験には渡さない。止めた集まりは落ちる）・`--only 名前,…`・`--update-expect`（通った集まりの指紋だけを書き、変わった指紋を出す。組み立て・書き直し・自己試験のどれかが落ちた時は何も書かない。`--max-diffs` とは一緒に使えない）。
- 1つの集まりを手で当てる：`node formal/check/sem/gunzip.mjs < formal/check/out/sem/stages.jsonl.gz | formal/sem/.lake/build/bin/signsem check`。

## 出力

- `sources.jsonl`：1行 `{id, from, source}`。id は 0 から、先に仕様の例（from は `"spec"`、試験にも出る例も）、その後に試験の file の並び。from は源が最初に出た所。
- `sources_counts.json`：file ごとの呼ばれた回数・違う源の数・試験の通った数。
- `stages.jsonl.gz`（と揺さぶりの集まりの `<名前>_stages.jsonl.gz`）：1行 `{id, source, b1, b2, b3}`（gzip）。
  - `b1`：`{text, lineAt}` か `{err}`。`lineAt` は text の位置 0..長さ の全部での lineAt の値の配列。
  - `b2`：`{rows}` か `{err}`。行は `{at, line, q, w}`：`at` は書き始めの位置、`line` は `lineAt(at)`、`q` は `?` の語の位置の並び、`w` は語の並び。語は文字列か `{tag, rows}`（`tag` は `"\"BRACKET_\""`・`"\"ABS_\""`・`"\"NORM_\""`・`"\"INDENT_\""` の字そのまま）。INDENT の3つ目（いつも `"\"_DEDENT\""`）は書かない。
  - `b3`：`{rows}` か `{err}`。rows は `exportRows` の形（`core.raw` を落とし、行の木に `"line"`）。
  - b1 が err なら b2・b3 は `{skip:true}`。b2 が err でも b3 は走らせる（frontRows の中の前段も同じ断りを投げる。ただし frontRows は resolve と同じく stackRefusal で包むので、JS のスタックの溢れは b2 では生の RangeError、b3 では resolve-stack-limit になる）。
  - `err` は `{name, reason, line, message}`（無い欄は null）。peggy の断りの line は `lineAt(e.location.start.offset)`。
  - 最後の行は終わりの印 `{"end":true,"lines":N,"complete":B,"stamp":S,"sources":R,"gate":G}`。N は書いた行の数、B は源の全部を書いたか。S は版（`gen_front.mjs` の `frontStamp()`）で、前段の JS の答えを決める alpha1 の file（前段の import の全部：lexer.js・sign.pegjs・resolve.js・operator_table.js・errors.js）の sha1 の頭と peggy の版、stages を書く道具（dump.mjs・rowsjson.mjs・gen_front.mjs・gen/fuzz.mjs・gen/rawfuzz.mjs）の sha1 の頭、node の版とスタックの大きさ（`--stack-size`。どちらも JS のスタックの溢れの所を変える）。R は読んだ源の集まり `{name, lines, sha1}`（sha1 は file の中身の sha1 の頭）。G は dump.mjs の門の結果（`rowsDiffer`・`resolveOkButFrontErr`・`rowCountDiffer`・`frontErrUnexcused` の数と、JS のスタックの溢れとして許した組の id の `frontErrExcused`）。G の4つの数のどれかが 0 でなければ、dump.mjs は 1 で終わる。
- `peg_fuzz_stages.jsonl`・`peg_rawfuzz_stages.jsonl`・`peg_rawfuzz2_stages.jsonl`：前処理を通さない text を文法に当てた行（`gen/all.mjs` が直に書く。`source` は fuzz では text と同じ字、rawfuzz では空で、`b3` は null）。終わりの印は `{"end":true,"lines":N,"complete":true,"stamp":S}`（源の集まりと門の結果は無い）。
- `<名前>_counts.json`：段ごとの err の数と理由ごとの数、門の結果、欄ごとの大きさ。

位置（`at`・`q`・`lineAt` の添え字）は UTF-16 の位置でなく Unicode の符号位置の番号で書く（直し方は `dump.mjs` の頭）。行（`line`・`err.line`）は元のソースの行の番号（1 から）。

## 門（`gate.mjs` と `signsem check`）

`signsem check` は1行ごとに4つを比べる（Lean の Json の BEq）。

- 前処理：`Lex.preprocess source` を b1 と。
- 文法：b1 の `{text, lineAt}` から `Peg.parse` を b2 と。
- 木：b2 の語の行から `Tree.rows` を b3 と。
- 通し：`Front.front source` を、b1 が断れば b1 の断り、そうでなければ b3 と。

段の入力にした b1・b2 が `toJson ∘ fromJson` で Json の値として戻ることも見る。b3 が null の行は文法だけを比べる。

外す物は JS のスタックの溢れだけ（期待が生の RangeError「Maximum call stack size exceeded」か resolve-stack-limit）。Lean の写しはスタックの溢れを写さない。

対の無いサロゲートは Lean の String が持てない。行の JSON に対の無いサロゲートの escape がある時（peggy の断りの文の found が対の片方の時、源や text にある時）、Lean の Json.parse はそれを U+FFFD に替える（この替え方を φ と書く）。そういう行は外さずに比べ、数を「U+FFFD に寄せた」に出す。比べの意味は出る側と入る側で違う。

- 出る側：写しは、JS が対の無いサロゲートを出す所で U+FFFD を出す。期待も φ を通るので、比べは φ(JS の答え) と写しの答えが同じかで、対の無いサロゲートと本物の U+FFFD は分けない。
- 入る側：JS が受けたのは x で、写しが受けるのは φ(x)。比べは 写し(φ(x)) = φ(JS(x)) で、「写しは JS と同じ」と言えるのは φ ∘ JS = φ ∘ JS ∘ φ の時だけ。いつもそうではない（lexer.js の断りの文の一部は源の字を JSON.stringify で載せる（lexer.js:130 など）ので、対の無いサロゲートと U+FFFD で文が変わる）。写しが JS のとおりなら、そういう行では答えが合わず、門は違いとして落とす。集まりの中で、源に対の無いサロゲートがあるのは pegrev_randastral の 1 本、前処理を通さない text にあるのは peg_rawfuzz・peg_rawfuzz2 の行。

`signsem check` が 1 を返すのは、違い・読めない行・InternalError がある時と、終わりの印が無い・印の本数が読んだ行と違う・印が部分の書き出し・印の後に行がある・行が 0 の時。`gate.mjs` は順に次を見て、どれかが崩れたら 1 で終わる。

1. 組み立て：`--exe` が無ければ `formal/sem` で `lake build --no-build` を走らせ、signsem が今の Lean の源から組んだ物かを見る。
2. 自己試験（毎回）：種の集まり（peg・lexrev_hand・peg_rawfuzz の頭・pegrev_randastral）の行から、期待を1か所だけ壊した行を作り、同じ集まりのほかの行（100 行まで）の頭と終わりに置いて流し、壊した段にちょうど1つの違いが出て、壊した欄を使わない段は合い、1 を返すかを見る。壊さない同じ並びは 0 を返すかも見る。壊す所は16種：前処理の lineAt・文法の行・文法の断りの文（peggy の Expected）・木の行・木の断りの文・前処理の断りの文・b2 の断りの文の対の無いサロゲート（出る側）・前処理を通さない text に対の無いサロゲートがある行の文法の行（b3 が null、入る側）・源に対の無いサロゲートがある行の前処理の断りの文（入る側）・文法が引かない lineAt・文法の後ろの行の at・文法の `?` の位置・木の後ろの行の奥の葉・木の行を空に・木の空の行に足す・b3 が null の行の文法の行を空に。文法が引かない lineAt と b2 の行の at・q を壊す物は、後ろの段（文法・木・通し）が合うことで、そこがどの段の入力にもならないことも見る。終わりの印も、lexrev_hand の全部の行で、行を1つ落とす・印を消す・complete を偽にする・印の後に行を置く・行を 0 にする、の5つを流し、狙った知らせだけが出て 1 を返すかを見る。
3. 混ぜた行：集まりを流す途中で、でたらめに選んだ 8 つの位置で行の期待を1か所だけ壊して混ぜる（位置が壊せない行に当たれば次の壊せる行に回すので、混ぜるのは 8 本まで。少なくなるのは終わりの近くの位置だけ）。壊すのはどの段の入力にもならない欄なので、写しの答えは変わらない。行ごとに、違いが出る段の組をでたらめに選び、その組の種類と葉をでたらめに選ぶ。
   - b3 が null の行：b2 の葉・b2 の行を空に・b2 の行に足す（文法）。
   - b1 が断る行：b1 の断りの葉（前処理と通し）。
   - b1 が通る行：b3 の葉・b3 の行を空に・b3 の行に足す（b2 が通れば木と通し、断れば通し）。文法が引かない位置の lineAt（前処理。文法が lineAt を引くのは返す行の書き始めと断りの位置だけなので、b2 が通れば行の at でない位置、断れば値が断りの line と違う位置）。b2 が通れば b2 の行の at・q の葉、断れば b2 の断りの葉（文法。木の段は行の at・q を使わず、b2 が断れば走らない）。

   壊した段にちょうど混ぜた数の違いが出て、ほかに違い・読めない行・InternalError が無いかを見る。混ぜた行の元（壊す前の行）は別に流して、合うことを見る（元が合わない行に混ぜると、その違いが混ぜた分に紛れるので）。位置は走らせるたびに変わるので、何行目から先は比べない（期待を返す）写しも、どの段でも捕まえる。入れ子が深くて JSON.stringify が gate.mjs のスタックで溢れる行（treerev_big の一部）は混ぜない。
4. 終わりの印：本数が signsem の読んだ行と同じで complete が真か（signsem とは別に見る）。`stamp` が今の版と同じか（stages を作った後に、alpha1 の前段の file・peggy・道具・node・スタックの大きさのどれかが変われば落とす）。源の集まり（gen/all.mjs が直に書く3つの他）では、`sources` が今の源の file と同じか（源を作り直した後に stages を書き直していなければ落とす）と、`gate` があって4つの数が 0 か。stages が読めない（0 バイトや切れた gzip）時も、その集まりを落として表は出す。
5. 指紋：集まりごとに、行の数、U+FFFD に寄せた行の数、段ごとの走らせた数・通った数・断りの数・外した id・写しの答えのハッシュ（`digest`）、dump.mjs が許したスタックの溢れの id を、`gate_expect.json` と照らす（混ぜた行は壊す前の期待で数え直す）。数は期待の形だけで決まり、写しの答えに依らない。写しの答えが変わったことは `digest` が捕まえる。混ぜた行は写しの答えを変えないので、`digest` は混ぜても同じ。

比べを空にした写し、1行目の後は比べない写し、101 行目の後は期待を返す写し（全部の段で、前処理だけで、文法だけで）、b3 が null の行や U+FFFD を含む入力で比べを飛ばす写し、文法・木・通しの断りでは期待を返す写し、期待が空の行なら期待を返す写し、行の数と1行目が合えば期待を返す写し、通しの期待を取り違える写し、外す物を断りの全部に広げる写し、木の段を飛ばす写し、印の本数を見ない写しは、どれも 2 か 3 で落ちることを確かめた。

alpha1 が変わって数が変わったら、`--dump --update-expect` で書き直し、出た指紋の差を見てから commit する。

## 集まり

| 集まり | 作る道具 | 行 | 主に当たる所 |
|---|---|---:|---|
| main | record.mjs | 354,751 | 試験一式と仕様の例に来た源 |
| lex | gen/gen_lex_sources.mjs | 30,138 | 前処理の枝（字下げ・括り・引用符・CR・CRLF・`\` の続き） |
| lexrev_hand・chars・lines・frames | gen/gen_lexrev.mjs | 174・453,673・558,174・65,392 | 前処理の境目の字、字の並びの総当たり、行の型の総当たり（`\` で続けた行の lineAt）、括りの中の `?` の行（CRLF を含む） |
| lexrev_astral | gen/gen_lexrev_astral.mjs | 982,759 | BMP の外の字 |
| peg・pegrev・pegrev_astral | gen/peg_sources.mjs・pegrev_sources.mjs | 36・189・7 | 文法の生成物の枝 |
| pegrev_rand・pegrev_randastral | gen/gen_src.mjs | 40,000・10,000 | 文法に沿った乱れた源 |
| tree・treerev・treerev_big | gen/tree_src.mjs・treerev_src.mjs・treerev_big.mjs | 162・134・26 | 行の木の枝、長い行と深い入れ子 |
| treerev_fuzz・treerev_fuzz2 | gen/treerev_fuzz.mjs | 30,000・60,000 | 語の並びの組み合わせ（`^` の続きを含む） |
| peg_fuzz・peg_rawfuzz・peg_rawfuzz2 | gen/fuzz.mjs・rawfuzz.mjs | 155,903・150,000・100,000 | 前処理を通さない text（BMP の外の字・対の無いサロゲートを含む） |

main の源には CR が無く、`\` の直後に改行がある源は2本、`^`・空白・語・空白・`^` の並びは無い。そこは揺さぶりの集まりが押さえる。数は源の字の並びで数えた本数（文字列やコメントの中も数える）で、CRLF は lex 5,108・lexrev_chars 9,282・lexrev_frames 5,874 本、CR だけの改行（`\r` の後が `\n` でない）は lex 4,685・lexrev_chars 123,375 本、`\` の直後の改行は lexrev_lines 52,808・lexrev_chars 19,028・lex 6,760 本、`^` の並びは treerev_fuzz 115・treerev_fuzz2 247 本。数えたのは main・lex・lexrev_hand・lexrev_chars・lexrev_lines・lexrev_frames・treerev_fuzz・treerev_fuzz2・pegrev_rand の源だけで、ほかの集まり（lexrev_astral など）は数えていない。

## 数（2026-11-24、resolve.js の sha1 の頭 a92e674aba13）

- 試験 7 file は hook を入れても全部通る（6550・52・1655 ほか）。呼ばれた回数は resolve 344,607・interpret 39,076・preprocess 55・preprocessWithLines 0。違う源は 354,751（仕様の例 529、うち 61 は試験にも出る。from が coproduct_laws.test.js の源が 311,393 で、その file の違う源は 315,522）。
- main の b1 の err 123（param-block-bracket 87 ほか）、b2 の err 9（peggy 8、JS のスタックの溢れ 1）、b3 の err 56（compare-chain 21・infix-missing-operand 15・pointfree-tree-notation 8 ほか、b2 の 9 を含む）。
- dump.mjs の門：resolve が通る 305,436 本で、b3 の rows は resolve の rows と全部同じ。b2 と b3 の行の数と行の並びは 354,572 本で全部合う。前段の断り 179 本のうち 178 本は resolve の断りと同じで、残る 1 本（id 1193、括り 2 万段）は b2 が生の RangeError、resolve と b3 は stackRefusal の resolve-stack-limit。
- main を全部書くと 1.84 GB（b3 が 1.32 GB）で、gzip の `stages.jsonl.gz` は 31.6 MB。
- gate.mjs：20 個の集まり、2,991,518 行で、混ぜた行のほかは、どの段も違い 0・InternalError 0（混ぜた行の元も全部合う）。外したのは main の id 1193（文法と通し）だけ。U+FFFD に寄せて比べた行は 343,876（lexrev_astral 265,849・peg_rawfuzz 51,699・peg_rawfuzz2 26,159・pegrev_randastral 155・lexrev_hand 10・pegrev_astral 4）。書き出しを除いて約 19 分、`--dump` を含めて約 50 分。
