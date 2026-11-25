# sem：alpha1 の前段の答えを書き出し、Lean の写しに当てる道具

alpha1 の前段（B1 前処理・B2 文法・B3 行の木）が源ごとに返す物を JSON Lines で書き出し、Lean の写し（`formal/sem` の `SignSem`）に当てる。
node（v24.16.0 で確かめた）で回す。出力は `formal/check/out/sem/` に書き、git には入れない（`formal/check/.gitignore` の `/out/`）。`alpha1/` の下は読むだけ。

## ファイル

- `record.mjs`：源を集める。試験一式（`alpha1/javascript/test/*.test.js` の全部を、`run.js` と同じ並び・`--stack-size=8000`・cwd で）を `hook.mjs` を入れて走らせ、`resolve`・`interpret`・`preprocess`・`preprocessWithLines` に来た源を覚える。仕様の例（`../ex.mjs` で `alpha1/docs/coproduct_spec.md` から取り出し、`std.mjs` の withStd で STD を前に付けた物）を足し、重複を除く。
- `hook.mjs`・`rec_store.mjs`・`rec_lexer.mjs`・`rec_resolve.mjs`・`rec_interpret.mjs`：試験の file を変えずに、試験（と試験が起こす子のプロセス）の import を、来た源を覚える包みに付け替える（`NODE_OPTIONS=--import=…`）。alpha1 の中の呼び出し（interpret → resolve → preprocessWithLines）は外から来た源と同じ源なので数えない。alpha1 の道はこの file の置き場から相対で引く。
- `gen_front.mjs`：`resolve.js` の写しを `out/sem/gen/` に作り、末尾に `frontRows(source)` を足す。中身は `resolve()` の頭（`frontEnd` と行ごとの `parseRow`、前段の catch まで）を字のまま写した物で、`resolve` と同じ形の `{rows, lineOf}` を返し、後の段は走らせない。置き換えはどれもちょうど1回当たることを確かめ、外れたら止める。版の印（`frontStamp()`）と、dump.mjs を走らせるスタックの大きさ（`STACK_ARG`、`--stack-size=8000`）もここ。
- `dump.mjs`：源ごとに B1・B2・B3 を走らせて書き、門（本物の resolve との照らし）を当てる。
- `rowsjson.mjs`：rows を JSON にする・戻す（`core.raw` を落とし、行の木に `"line"`）。`std.mjs`：`formal/check/dump.mjs` の withStd と同じ STD の付け方。
- `gen/`：揺さぶりの源の集まりを作る道具。`gen/all.mjs` が全部を決まった引数と種で順に作る（並びと引数は `gen/all.mjs` の頭）。
- `gate.mjs`：門の一式。signsem の組み立てが今の源から組んだ物かを見て、自己試験を走らせ、stages の集まりの全部に `signsem check` を当て、終わりの印（本数・単位・版・源の集まり・dump.mjs の門）と指紋（`gate_expect.json`）を照らす（下の「門」）。
- `gate_expect.json`：集まりごとの指紋（`gate.mjs --update-expect` が書く）。
- `gunzip.mjs`：標準入力の gzip を解いて標準出力へ流す。Windows の pipe では、書き手（`gzip -dc`）の長さ 0 の書き込みが Lean の読む側に EOF に見えることがあるので、手で流す時はこちらを使う（`gate.mjs` は node の中で解く）。

## 走らせ方

リポジトリの頭で、1本ずつ：

```sh
node formal/check/sem/record.mjs          # 約 4 分
(cd formal/sem && lake build)
node formal/check/sem/gate.mjs --dump     # 全部を書き直してから当てる（約 43 分）
node formal/check/sem/gate.mjs            # 今ある stages に当てる（約 9 分）
```

`gate.mjs --dump` は、main を `node --stack-size=8000 dump.mjs --sources sources.jsonl --out stages.jsonl.gz` で書き（約 8 分）、`gen/all.mjs` で源の集まりと前処理を通さない text の集まりを作り直し（約 1 分。fuzz・rawfuzz は stages.jsonl.gz の頭を種に使う）、残りの源の集まりを `dump.mjs` で書いてから（約 25 分。うち treerev_big が約 15 分）、全部に当てる（約 9 分）。`record.mjs` は走らせないので、試験一式か仕様の例が変わったら先に `record.mjs` を回す。

- `record.mjs --merge-only` は試験を走らせず、覚えた `out/sem/rec/` と今の仕様の例を合わせ直す。
- `dump.mjs` は `node --stack-size=8000` で走らせる（`gen_front.mjs` の `STACK_ARG`。スタックの大きさは版の印に入り、ほかの大きさで書いた stages は門の版の照らしで落ちる）。引数：`--limit-mb 200`・`--skip N`・`--max N`・`--out 名前.jsonl`（`.jsonl.gz` なら gzip の塊を続けて書き、`--limit-mb` は書いた gzip の大きさに当てる）・`--no-write`・`--sources 名前.jsonl`（`out/sem` の下の源の集まり、既定 `sources.jsonl`）。
- `gate.mjs` の引数：`--dump`（全部を書き直してから当てる。`--only` に依らず全部）・`--exe 道`（当てる signsem。組み立ての確かめは飛ばす）・`--fail-fast`・`--max-diffs N`（集まりの `signsem check` に、混ぜた行の分を足して渡す。自己試験には渡さない。止めた集まりは落ちる）・`--only 名前,…`・`--update-expect`（通った集まりの指紋だけを書き、変わった指紋を出す。組み立て・書き直し・自己試験のどれかが落ちた時は何も書かない。`--max-diffs` とは一緒に使えない）。
- 1つの集まりを手で当てる：`node formal/check/sem/gunzip.mjs < formal/check/out/sem/stages.jsonl.gz | formal/sem/.lake/build/bin/signsem check`。`signsem check` の引数（`--show N`・`--no-end`・`--allow-partial`・`--max-diffs N`・`--force-internal ID`）は `formal/sem/Main.lean` の頭。

## 出力

- `sources.jsonl`：1行 `{id, from, source}`。id は 0 から、先に仕様の例（from は `"spec"`、試験にも出る例も）、その後に試験の file の並び。from は源が最初に出た所。
- `sources_counts.json`：file ごとの呼ばれた回数・違う源の数・試験の通った数。
- `stages.jsonl.gz`（と揺さぶりの集まりの `<名前>_stages.jsonl.gz`）：1行 `{id, source, b1, b2, b3}`（gzip）。
  - `b1`：`{text, lineAt}` か `{err}`。`lineAt` は text の位置 0..`text.length` の全部での lineAt の値の配列（大きさは `text.length + 1`）。
  - `b2`：`{rows}` か `{err}`。行は `{at, line, q, w}`：`at` は書き始めの位置、`line` は `lineAt(at)`、`q` は `?` の語の位置の並び、`w` は語の並び。語は文字列か `{tag, rows}`（`tag` は `"\"BRACKET_\""`・`"\"ABS_\""`・`"\"NORM_\""`・`"\"INDENT_\""` の字そのまま）。INDENT の3つ目（いつも `"\"_DEDENT\""`）は書かない。
  - `b3`：`{rows}` か `{err}`。rows は `exportRows` の形（`core.raw` を落とし、行の木に `"line"`）。
  - b1 が err なら b2・b3 は `{skip:true}`。b2 が err でも b3 は走らせる（frontRows の中の前段も同じ断りを投げる。ただし frontRows は resolve と同じく stackRefusal で包むので、JS のスタックの溢れは b2 では生の RangeError、b3 では resolve-stack-limit になる）。
  - `err` は `{name, reason, line, message}`（無い欄は null）。peggy の断りの line は `lineAt(e.location.start.offset)`。
  - 最後の行は終わりの印 `{"end":true,"units":"utf16","lines":N,"complete":B,"stamp":S,"sources":R,"gate":G}`。units は位置の数え方（UTF-16 の符号単位）で、`signsem check` は units が `"utf16"` でない印を断る。N は書いた行の数、B は源の全部を書いたか。S は版（`gen_front.mjs` の `frontStamp()`）で、前段の JS の答えを決める alpha1 の file（前段の import の全部：lexer.js・sign.pegjs・resolve.js・operator_table.js・errors.js）の sha1 の頭と peggy の版、stages を書く道具（dump.mjs・rowsjson.mjs・gen_front.mjs・gen/fuzz.mjs・gen/rawfuzz.mjs）の sha1 の頭、node の版とスタックの大きさ（`--stack-size`。どちらも JS のスタックの溢れの所を変える）。R は読んだ源の集まり `{name, lines, sha1}`（sha1 は file の中身の sha1 の頭）。G は dump.mjs の門の結果（`rowsDiffer`・`resolveOkButFrontErr`・`rowCountDiffer`・`frontErrUnexcused` の数と、JS のスタックの溢れとして許した組の id の `frontErrExcused`）。G の4つの数のどれかが 0 でなければ、dump.mjs は 1 で終わる。
- `peg_fuzz_stages.jsonl`・`peg_rawfuzz_stages.jsonl`・`peg_rawfuzz2_stages.jsonl`：前処理を通さない text を文法に当てた行（`gen/all.mjs` が直に書く。`source` は fuzz では text と同じ字、rawfuzz では空で、`b3` は null）。終わりの印は `{"end":true,"units":"utf16","lines":N,"complete":true,"stamp":S}`（源の集まりと門の結果は無い）。
- `<名前>_counts.json`：段ごとの err の数と理由ごとの数、門の結果、欄ごとの大きさ。

位置（`at`・`q`・`lineAt` の添え字）は JS の文字列の位置（UTF-16 の符号単位の番号。peggy の offset と lexer.js の lineAt が受ける位置）そのまま。サロゲートの対は2単位、対になっていないサロゲートは1単位で、対の間（後ろの半分）の位置も1つの位置。行（`line`・`err.line`）は元のソースの行の番号（1 から）。書く行はどれも `JSON.stringify` の文で、対の無いサロゲートは escape（`\udxxx`）で書く。

## 門（`gate.mjs` と `signsem check`）

`signsem check` は1行ごとに4つを比べる。行は JS の値としての JSON（`JV`、`formal/sem/SignSem/JV.lean`）に読み、写しの答えも `JV` にして、`JV` の `==` で比べる（文字列は UTF-16 の単位ごと、数は整数、物は鍵の順に依らない）。

- 前処理：`Lex.preprocess source` を b1 と。
- 文法：b1 の `{text, lineAt}` から `Peg.parse` を b2 と。
- 木：b2 の語の行から `Tree.rows` を b3 と。
- 通し：`Front.front source` を、b1 が断れば b1 の断り、そうでなければ b3 と。

段の入力にした b1・b2 が `toJson ∘ fromJson` で同じ `JV` に戻ることも見る。b3 が null の行は文法だけを比べる。

外す物は JS のスタックの溢れだけ（期待が生の RangeError「Maximum call stack size exceeded」か resolve-stack-limit）。Lean の写しはスタックの溢れを写さない。

対の無いサロゲートは、行の escape（`\udxxx`）から1つの単位のまま読み、段の入力にも答えにもそのまま渡して比べる（ほかの字に替えない）。だから比べが合うのは、その行の入力で、写しの答えが JS の答えと単位まで同じ時。そういう行は2つに分けて数える。

- 入る側（`loneIn`）：段の入力にある行（源に。b3 が null の行では b1 の text に）。集まりの中では lexrev_hand・pegrev_randastral の源と、peg_rawfuzz・peg_rawfuzz2 の text。
- 答え（`loneOut`）：入る側に無く、b1・b2・b3 のどこかにある行（peggy の断りの文の found が対の片方の時など）。

`signsem check` が 1 を返すのは、違い・読めない行・InternalError がある時と、終わりの印が無い・印の units が `"utf16"` でない・印の本数が読んだ行と違う・印が部分の書き出し・印の後に行がある（2つ目の印も印の後の行に数え、照らすのは最初の印）・行が 0 の時（`--no-end` なら印も units も見ない）。`gate.mjs` は順に次を見て、どれかが崩れたら 1 で終わる。

1. 組み立て：`--exe` が無ければ `formal/sem` で `lake build --no-build` を走らせ、signsem が今の Lean の源から組んだ物かを見る。
2. `--dump` の時：全部を書き直す（上の「走らせ方」）。dump.mjs は自分の門が崩れたら 1 で終わる。
3. 自己試験（毎回）：種の集まり（peg・lexrev_hand・peg_rawfuzz の頭 4 MiB と、main・treerev_big のいちばん長い 3 本）の行から、期待を壊した行を作り、同じ集まりのほかの行（100 行まで）の頭と終わりに置いて流す。壊した並びは 1 を返し、違いが出るはずの段にちょうど1つの違いが出て、合うはずの段は合い、読めない行が無く、InternalError がそのとおりの段にだけ出るかを見る。壊さない同じ並びは 0 を返すかも見る。`signsem check` は 4 本まで同時に走らせる。壊し方は 53 種（並びと種の行の選び方は `gate.mjs` の頭）。
   - 段の欄（16）：前処理の lineAt の頭・文法が引かない lineAt の全部・text の単位1つ・対の下の半分の位置の lineAt（lexrev_hand の、対の下の半分の位置が行の書き始めでない行で。位置を符号位置に寄せて比べる写しは、そこを見ない）、前処理と通しの b1 の断りの文、文法の行の line・後ろの行の at・`?` の位置・後ろの行の語・peggy の断りの文（Expected）・b3 が null の行の行を空に、木と通しの行の line・断りの文・後ろの行の奥の葉・行を空に・空の行に足す。文法が引かない lineAt と b2 の行の at・q を壊す物は、後ろの段が合うことで、そこがどの段の入力にもならないことも見る。
   - 対の無いサロゲート（14。上の半分と下の半分で7つずつ）：出る側（b2 の断りの文の対の無いサロゲートを U+FFFD に・対のもう片方に）、入る側（b3 が null の行の text の物を同じ半分の別の値に）、源から（源・b1 の text・b2 の語・b3 のどれか1つで、源の対の無いサロゲートが届いた単位を同じ半分の別の値に）。
   - 源の U+FFFD（6）：対の無いサロゲートでない、ふつうの字の U+FFFD を源に持つ lexrev_hand の行で、源・b1 の text・b2 の語・b3 に U+FFFD が届く行の lineAt の頭（前処理）・b2 の行の line（文法）・b3 の行の line（木と通し）、b1 が断る行の断りの文（前処理と通し）、b2 の断りの文の found が U+FFFD の行の断りの文（文法）と、peg_rawfuzz の頭の、b3 が null で text に U+FFFD がある行の b2 の行の line（文法）。U+FFFD のある行で比べを飛ばす写しが、どの段でも落ちる。
   - 対の向き（3）：b1 の text・b2 の語・b3 のどれか1つで、対の2つの単位を入れ替える。
   - 形（4）：期待の rows と err を入れ替える（b3 で2向き、b3 が null の行の b2 で2向き）。
   - InternalError（2）：`signsem check --force-internal` で、4つの段が走る行と b3 が null の行の答えを InternalError にする。
   - 長い行（8）：main と treerev_big の、当たる中でいちばん長い行で、後ろの段が入力に使う欄（混ぜる行では壊さない欄）を行の後ろの方で壊す（後ろの行の書き始めの lineAt・text の単位・後ろの行の line・後ろの行の語）。

   綴りの試し（2）：lexrev_hand の全部と peg_rawfuzz の頭の 200 行を、値を変えずに綴りだけ替えて（物の鍵の順、`\/` と 16 進の escape の対などの文字列の書き方、空白）流し、0 を返し、結果の行（数と digest）が元の綴りの物と同じかを見る。
   終わりの印（8）：lexrev_hand の全部の行で、行を1つ落とす・印を消す・complete を偽にする・印の後に行を置く・行を 0 にする・units を消す・units を別の値（`"utf8"`）にする・印を2つ置く、を流し、狙った知らせだけが出て 1 を返すかを見る（印のとおりの並びは 0）。
4. 集まりごと：stages を流す途中で、でたらめに選んだ 8 つの位置と、いちばん長い（バイトの多い）3 本の行の位置で、行の期待を壊して混ぜる（位置が壊せない行に当たれば次の壊せる行に回す。少なくなるのは終わりの近くの位置だけ）。壊すのはどの段の答えも依らない欄なので、写しの答えは変わらない。でたらめな位置の行は、違いが出る段の組を1つでたらめに選び、その組の種類と葉をでたらめに選んで1か所だけ壊す。いちばん長い行は、段の組の全部で1か所ずつ壊す。
   - b3 が null の行：b2 の葉・b2 の行を空に・b2 の行に足す・b2 の形を返す（文法）。
   - b1 が断る行：b1 の断りの葉（前処理と通し）。
   - b1 が通る行：b3 の葉・b3 の行を空に・b3 の行に足す・b3 の形を返す（b2 が通れば木と通し、断れば通し）。文法が引かない位置の lineAt（前処理。文法が lineAt を引くのは返す行の書き始めと断りの位置だけなので、b2 が通れば行の at でない位置、断れば値が断りの line と違う位置）。b2 が通れば b2 の行の at・q の葉、断れば b2 の断りの葉（文法）。

   壊すと対の無いサロゲートの数え方（loneIn・loneOut）が変わる行と、壊した断りが JS のスタックの溢れに見える行は壊さない。壊した段にちょうど混ぜた数の違いが出て、ほかに違い・読めない行・InternalError が無いかを見る。混ぜた行の元（壊す前の行）は別に流して、合うことを見る（元が合わない行に混ぜると、その違いが混ぜた分に紛れるので）。位置は走らせるたびに変わるので、何行目から先は比べない（期待を返す）写しも、どの段でも捕まえる。いちばん長い行はいつも全部の段の組で壊すので、長い行でだけ比べを飛ばす写しも捕まえる。`gate.mjs` は `STACK_ARG` を付けた node で自分を走らせ直すので、treerev_big の深い行（5,008 段）も JSON.stringify で壊せる。

   そして終わりの印：本数が signsem の読んだ行と同じで complete が真で units が `"utf16"` か（signsem とは別に見る）。`stamp` が今の版と同じか（stages を作った後に、alpha1 の前段の file・peggy・道具・node・スタックの大きさのどれかが変われば落とす）。源の集まり（gen/all.mjs が直に書く3つの他）では、`sources` が今の源の file と同じか（源を作り直した後に stages を書き直していなければ落とす）と、`gate` があって4つの数が 0 か。stages が読めない（0 バイトや切れた gzip）時も、その集まりを落として表は出す。

   最後に指紋：集まりごとに、行の数、対の無いサロゲートのある行の数（`loneIn`・`loneOut`）、段ごとの走らせた数・通った数・断りの数・外した id・写しの答えのハッシュ（`digest`）、dump.mjs が許したスタックの溢れの id（`dumpExcused`）を、`gate_expect.json` と照らす（混ぜた行は壊す前の期待で数え直す）。数は期待の形だけで決まり、写しの答えに依らない。写しの答えが変わったことは `digest` が捕まえる。混ぜた行は写しの答えを変えないので、`digest` は混ぜても同じ。

alpha1 が変わって数が変わったら、`--dump --update-expect` で書き直し、出た指紋の差を見てから commit する。

### 落ちることを確かめた壊した写し

`formal/sem` を写して壊して組み、`gate.mjs --exe` で当てて 1 で終わることを確かめた物（括弧は名前）。

2026-11-24：

- 比べを空にした写し（vac）。
- 比べを空にし、Lex の二分探索の `≤` を `<` にした写し（vac_m1）。
- 1行目の後は比べない写し（first_only）。
- 101 行目の後は全部の段で期待を返す写し（late_expect）。
- 101 行目の後は前処理だけで期待を返す写し（pre_after101）。
- 101 行目の後は文法だけで期待を返す写し（peg_after101）。
- 101 行目の後は木だけで期待を返す写し（tree_after101）。
- b3 が null の行で文法の期待を返す写し（raw_peg_self）。
- 源に U+FFFD がある行で比べを飛ばす写し（src_fffd）。
- b3 が null の行の text に U+FFFD がある行で文法を飛ばす写し（text_fffd）。
- 木の断りの期待なら期待を返す写し（tree_err_subst）。
- 文法の断りの期待なら期待を返す写し（peg_err_subst）。
- 通しの断りの期待なら期待を返す写し（front_err_subst）。
- 通しの期待を取り違える写し（g1_front_expect_b3）。
- 外す物を断りの全部に広げる写し（g2_exclude_every_err）。
- 木の段を飛ばす写し（g3_skip_tree_stage）。
- 印の本数を見ない写し（g5_end_count_ignored）。
- 期待が空の行なら期待を返す写し（empty_rows）。
- 行の数と1行目が合えば期待を返す写し（rows0_only）。

2026-11-25：

- 比べる前に、写しの答えと期待の両方の対の無いサロゲートを U+FFFD に替える写し（out_phi）。
- 同じことを対の無い下の半分だけにする写し（out_phi_low）。
- 同じことを前処理の比べだけでする写し（pre_out_phi）。
- 同じことを木と通しの比べだけでする写し（tree_out_phi）。
- 段に渡す文字列（源・b1 の text・b2 の語）の対の無いサロゲートを U+FFFD に替える写し（in_phi）。
- 行の全部の対の無いサロゲートを U+FFFD に替えてから読む写し（in_phi_all）。
- b3 が null でない行でだけ、段に渡す文字列の対の無いサロゲートを U+FFFD に替える写し（nonraw_phi）。
- 前処理と通しに渡す源の対の無いサロゲートだけを U+FFFD に替える写し（src_phi）。
- 写しの答えが InternalError か、rows と err の形が期待と違えば期待を返す写し（shape_swap）。
- 形が期待と違えば期待を返す写し（shape_only）。
- InternalError なら期待を返す写し（internal_only）。
- 源が 23,000 単位より長い行で期待を返す写し（size_liar）。
- 前処理の比べが text を見ない写し（text_ignored）。
- 源が 20,000 単位より長い行でだけ、前処理の比べが text を見ない写し（text_ignored_long）。
- 源が 20,000 単位より長い行でだけ、通しが期待を返す写し（front_long_liar）。
- 写しの答えを JS の綴りで書き、行のバイトと比べる写し（bytes）。
- JSON の読み手が大文字の 16 進の escape を取り違え、それを見る `#guard` も外した写し（upper_hex_noguard）。
- 終わりの印の units を見ない写し（units_skip）。
- 終わりの印の units が文字列なら、値を見ずに通す写し（units_any）。
- 2つ目の印を印の後の行に数えず、後の印で上書きする写し（two_marks）。
- 比べる前に、写しの答えと期待の両方の位置（前処理の lineAt、文法の行の at・q）を符号位置に寄せる写し（cp_compare）。
- 源に U+FFFD（対の無いサロゲートでない、ふつうの字）がある行で、どの段でも期待を返す写し（src_fffd_skip）。
- b1 の text に U+FFFD がある行で、文法が期待を返す写し（text_fffd_skip）。

捕まえると言い切れない物：源の大きさが決まった窓の中（たとえば 700〜1000 単位）の行でだけ期待を返す写し（src_liar700）は、混ぜる行の選び方（でたらめな 8 つと、バイトの多い 3 本）に当たった時だけ落ちる。選ぶ行を決めて足しても窓が動くだけなので、窓で嘘をつく写しは偶然でしか捕まらない。「何単位より長い行で」嘘をつく写しは、いちばん長い行がいつも混ざるので捕まる（size_liar・text_ignored_long・front_long_liar）。

## 集まり

| 集まり | 作る道具 | 行 | 主に当たる所 |
|---|---|---:|---|
| main | record.mjs | 354,751 | 試験一式と仕様の例に来た源 |
| lex | gen/gen_lex_sources.mjs | 30,138 | 前処理の枝（字下げ・括り・引用符・CR・CRLF・`\` の続き） |
| lexrev_hand・chars・lines・frames | gen/gen_lexrev.mjs | 201・453,673・558,174・65,392 | 前処理の境目の字（BMP の外の字と源の対の無いサロゲートと U+FFFD を含む）、字の並びの総当たり、行の型の総当たり（`\` で続けた行の lineAt）、括りの中の `?` の行（CRLF を含む） |
| lexrev_astral | gen/gen_lexrev_astral.mjs | 982,759 | BMP の外の字 |
| peg・pegrev・pegrev_astral | gen/peg_sources.mjs・pegrev_sources.mjs | 36・189・7 | 文法の生成物の枝 |
| pegrev_rand・pegrev_randastral | gen/gen_src.mjs | 40,000・10,000 | 文法に沿った乱れた源 |
| tree・treerev・treerev_big | gen/tree_src.mjs・treerev_src.mjs・treerev_big.mjs | 162・134・26 | 行の木の枝、長い行と深い入れ子 |
| treerev_fuzz・treerev_fuzz2 | gen/treerev_fuzz.mjs | 30,000・60,000 | 語の並びの組み合わせ（`^` の続きを含む） |
| peg_fuzz・peg_rawfuzz・peg_rawfuzz2 | gen/fuzz.mjs・rawfuzz.mjs | 155,903・150,000・100,000 | 前処理を通さない text（BMP の外の字・対の無いサロゲートを含む） |

main の源には CR が無く、`\` の直後に改行がある源は2本、`^`・空白・語・空白・`^` の並びは無い。そこは揺さぶりの集まりが押さえる。数は源の字の並びで数えた本数（文字列やコメントの中も数える）で、CRLF は lex 5,108・lexrev_chars 9,282・lexrev_frames 5,874 本、CR だけの改行（`\r` の後が `\n` でない）は lex 4,685・lexrev_chars 123,375 本、`\` の直後の改行は lexrev_lines 52,808・lexrev_chars 19,028・lex 6,760 本、`^` の並びは treerev_fuzz 115・treerev_fuzz2 247 本。数えたのは main・lex・lexrev_hand・lexrev_chars・lexrev_lines・lexrev_frames・treerev_fuzz・treerev_fuzz2・pegrev_rand の源だけで、ほかの集まり（lexrev_astral など）は数えていない。

## 数（2026-11-25、resolve.js の sha1 の頭 a92e674aba13、node v24.16.0・peggy 4.2.0）

- 試験 7 file は hook を入れても全部通る（6550・52・1655 ほか）。呼ばれた回数は resolve 344,607・interpret 39,076・preprocess 55・preprocessWithLines 0。違う源は 354,751（仕様の例 529、うち 61 は試験にも出る。from が coproduct_laws.test.js の源が 311,393 で、その file の違う源は 315,522）。
- main の b1 の err 123（param-block-bracket 87 ほか）、b2 の err 9（peggy 8、JS のスタックの溢れ 1）、b3 の err 56（compare-chain 21・infix-missing-operand 15・pointfree-tree-notation 8 ほか、b2 の 9 を含む）。
- dump.mjs の門：resolve が通る 305,436 本で、b3 の rows は resolve の rows と全部同じ。b2 と b3 の行の数と行の並びは 354,572 本で全部合う。前段の断り 179 本のうち 178 本は resolve の断りと同じで、残る 1 本（id 1193、括り 2 万段）は b2 が生の RangeError、resolve と b3 は stackRefusal の resolve-stack-limit。
- main を全部書くと 1.84 GB（b3 が 1.32 GB）で、gzip の `stages.jsonl.gz` は 31.6 MB。
- gate.mjs：20 個の集まり、2,991,545 行。段を当てた行は前処理 2,585,642・文法 2,064,130・木 713,935・通し 2,585,641 で、混ぜた行のほかは、どの段も違い 0・読めない行 0・InternalError 0（混ぜた行の元も全部合う）。外したのは main の id 1193（文法と通し）だけ。
- 対の無いサロゲートのある行は 343,893。入る側（loneIn）53,870：peg_rawfuzz 31,998・peg_rawfuzz2 21,854・lexrev_hand 17・pegrev_randastral 1。答えだけ（loneOut）290,023：lexrev_astral 265,849・peg_rawfuzz 19,701・peg_rawfuzz2 4,305・pegrev_randastral 154・lexrev_hand 10・pegrev_astral 4。
- 時：`gate.mjs` は約 9 分（558 秒。集まりの `signsem check` で長いのは main 約 230 秒・lexrev_astral 約 55 秒・lexrev_lines 約 38 秒）。`gate.mjs --dump` は約 43 分（2,568 秒。main の書き出し 468 秒・gen/all.mjs 約 1 分・残りの書き出し約 25 分（treerev_big 924 秒）・当てる所約 9 分）。
