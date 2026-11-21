# 解決器の索引

この文書は、解決器（javascript/resolve.js）の部品を、仕様（coproduct_spec.md）の今の R と、試験（javascript/test/coproduct_laws.test.js の「// 法則N：」）に当てる索引である。
仕様と実装の違いは coproduct_spec.md の §6.4、未決の問いは §5 にある。ここに置く注意は、その2つにまだ無い物だけ。
行の番号は resolve.js の関数の頭の行。ずれたら関数名で引く。

## 部品

処理の流れの順：定義を集める → 葉 → 前検査と穴 → 畳み → 口と段 → `,` の積 → 並びの終わり → 実体 → 仮置きと解き直し → 守り。

| 関数（resolve.js:行） | 何をするか | 仕様 | 法則 |
|---|---|---|---|
| resolve（10502）・asDefinition（1087） | いちばん外の定義を先に全部集め（F.defs・F.defLines、同名は name-duplicate）、行の順に依らずに解く | §1.2 P2・§6.4 の1 | 3 |
| checkParamNames（1110） | 仮引数の隠しを name-shadow で知らせ、同じ範囲の同名を name-duplicate で断る | R133 | 47 |
| tokenize（472） | 綴りの `_`（id）と `!_`（void）を内部の木の印に写す1か所。点なしの席の行（seatRows）は写さない | R138 | 11・51 |
| parseParams（881）・bracketParamOf（1047） | 仮引数の並びを読み、括りの仮引数を素直な括り（1行・裸の名前・末尾にだけ `~rest`）とそれ以外に分ける | R24・R64 | 4 |
| resolveLambda（7857）・makeLambda（7762）・lambdaIn（7783） | `?` で関数を作る。外の仮引数は範囲の親（parent）で読む。同じ `?` を同じ外の範囲で読み直す時は、同じ範囲を使う | §1.2 P3・§2 | 4 |
| patternNode（7972） | 括りの関数の節を作り、呼ばれない本体は `(defer …)` のまま置く | R25 | 3 |
| classify（4065）・A（1729）・U（1730）・isTildeSpreadTerm（4263）・liftedSpread（4270）・liftShape（4283）・liftsAsBracket（4288）・spreadShaped（6791） | 葉ごとに種類と desc を付ける。`@x` は ref なら指す関数、vref なら指す値、印 zero なら同じ印 zero の値。括らない `_` は cat hole。`~x~` は、`~x` が `[x]` と読める所で `[x]~` と同じ項（書いた項ごとに1つの写しで、葉の綴りは書いたまま）。撒く項の形（spreadShaped）にも入るので、`$~w~` は `$[w]~` と同じ `!_` と分かる値（試験は coproduct.test.js の SAME_AS_SPREAD） | §2・R78・R79 | 11・17・29・54 |
| classifyStacked（4227）・tailTerm（4248）・liftedBracket（4257）・zeroTail（4294）・seeZeroTail（4307） | `$`・`@` を重ねた項（`@$x`・`@@x`・`~$x`・`~@x`・`!$x`）は、後ろの項（書いた項ごとに1つの写し）が印 zero ならその印 zero の値。`~$x`・`~@x` は `[$x]`・`[@x]` と同じ項 | R56・R57・R78・R79 | 54・55 |
| lookup（2403） | 名前を範囲で引く。裸の仮引数は使う回数に依らず A（素の関数なら札 pv 付き）。取り込みの範囲の外の定義の無い名前は印 zero（`w : pw ' zz` の w と同じ、R21） | §2・R21 | 4・28・52 |
| undefinedNameNotices（1548） | 見える範囲に定義の無い名前を、書いた所ごとに warning の name-undefined で知らせる（呼ばない本体・解かない所も。取り込みのある範囲は P2） | R21 | 52 |
| classifyDollar（4407）・pointedDesc（5792）・openSelfReader（4843）・dollarOpened（5348）・classifyLift（4447）・reportLift（4555） | `$` の持ち上げと先の印（関数の番地・値を読む参照・lift・印 zero の値）、先の分かる `@` の下ろし | R49・R56・R57・R78・R99・R100 | 17・18・29・54・55 |
| classifySpread（5989）・isSpreadNode（1943） | 後置 `~` の項を流れの1項にする。器の中身に関数か未知が見えれば G7 | R51・§6.2 G7 | 15・19 |
| pointfreeOf（6178）・mapPointfree（6320） | 1行の括りの点なし（区間・席・席の写像・畳む2項・畳まない2項・貪欲な単項・`[F,]`・段18）の関数を作る | R31・R32・R35・R41・R50・R77・R95 | 1・5・7・10・15・21・31 |
| pickKeyOf（2034）・lowerPick（2050）・pickDesc（2062）・classifyInfix（5878） | `x ' k` の鍵（字面の整数と裸の名前）と引いた物の desc。構造体に無い欄は `!_`（zeroDesc）、数から引けば未知、`$x ' 0` は x | R26・R77・R102・R115 | 1・3・37 |
| rowsInfo（6088）・rowsShape（2019）・shapeOfTree（1986）・bracketInfo（6073） | 1行の括りは中の行の根の種類と形。2行以上は、全部が欄で名前が重ならなければ構造体、ほかは1行1要素の List | R24・R49 | 10・20 |
| undecidedOf（5637）・refuseUndecided（5671） | 名前の読みが決まらない項が2項以上の並びにあれば G7 | R120・§6.2 G7 | — |
| holeSeq（8536）・subHole（8572） | 並び全体と、値の後ろに積まれた F から終わりまでの並びで穴を探す | R16・R47 | 5・6 |
| tryHole（10349）・holeMismatch（10450）・holeFnOf（10404） | k = n の穴の書き換え、k ≠ n の穴、穴の関数（既定値のある頭は other・holeOf） | R16・R34 | 6 |
| isLambdaName（2445）・isPlainHead（10215）・holeHeadArity（10222） | 穴の頭を、名前の定義と `?` の括りを直に書いた頭に限る | R16・§6.4 の穴の頭 | 6 |
| holeRefusal（10249）・unitArgs（8552） | 口の中の `_` の断り（括りの関数は G5、ほかは G7） | R46・§6.2 G5 | 6 |
| g13Of（10272） | R34・R69・R89 が読まない穴を G13 で断る | R69・R89・§6.2 G13 | 11 |
| defaultUnits（10315） | 既定値のある関数の頭の実引数の並び（穴のある並び）の `!_` と分かる印を前から口で読む（既定値の口なら既定値の葉、ほかは消える） | R16・R83・R112 | 6 |
| reduceItems（8388）・foldItems（8421） | 並びを左から1項ずつ foldStep で畳む | R40・R118 | 7・10 |
| foldStep（8724） | 畳みの1歩：いちばん上と次の項の種類で、適用・合成・積むに分ける。未知の値の上でも積む | R35・R47・R120 | 1・5・7 |
| single（8690） | 1つの項を節にする。括らない `_`（cat hole）は恒等射 `{type:"id"}` | R29 | 11・13 |
| holeStep（8880） | 畳みの中の括らない `_`：口の外は恒等射、口の中は R46（括りの関数の段は G5） | R44・R46 | 11・14 |
| markStep（8932）・isMark（8701）・emptyMark（8297）・writtenEmptyMark（8328）・portShared（8236） | `!_` と分かる値の印を口で読む：値の口では消え、既定値の口では既定値、畳む点なしの口では被演算子、`||_||` の口ではその口に1つで着いた最初の1つを空の器（R27） | R83・R84・R95・R112・R27 | 31・39・50・53 |
| identityGate（9292）・reduceFold（8395）・withoutIdentity（8411） | 恒等射の段を閉じる時に単位律の割れを見つけ、書いた並びで恒等射を消して畳み直す | R74・R126 | 13 |
| refuseHole（5839）・refuseOperandHole（5852） | 中置・点なしの被演算子の `_` を G7 で断る（`,`・`\|`・`;` を除く） | R87・§6.2 G7 | — |
| newEntry（9059）・addGroup（9064）・feed（9114）・putArg（9124） | 関数の項を段に開いて持ち、実引数を最初の閉じていない段の口に1つずつ入れる。後ろに来た関数は段を足す（合成） | R11・R40・R47 | 1・7 |
| fnShape（9082） | 段の口の形（固定の数・可変長・不明）を関数の種類から1か所で決める | R41・R77・§6.4 の4 | 1・7・21 |
| settle（9202）・composeLeaf（10208） | 閉じた段の結果を次の段に流す。結果が A でなければ後ろの段を全部未知で閉じる | R11・R25・R120 | 1 |
| closeEntry（9234）・closeKind（9466）・descOfTree（1997） | 並びの終わりで可変長の口と不明の段を閉じる。最後の括りは残りの並びを1つの List で受ける（撒いた流れ1つなら撒いた器そのもの） | R31・R41・R50・R64 | 1・2・15・23 |
| doneKind（9362） | 固定の口が埋まった段の種類（§3.4 の表。段18 は pickDesc、括りの関数は実体の根） | §3.4・R24・R77 | 2・4・7 |
| plainApplyKind（10385）・restCloseKind（9526）・restHoleKind（9604） | 素の関数と穴の関数の足りた適用の種類は本体の根（A なら A、ほかは未知） | §3.4・R120 | 6・26 |
| applyKind（9703） | desc の並びを feed で当てた種類 | §3.4 | 1 |
| mapOver（9733）・foldOver（9744）・elemsOfContainer（9653）・refuseMapped（9727） | `[F,]`・貪欲な単項・畳む点なしを器の要素ごとに当て、器の中身に関数か未知が見えれば G7 | R31・R50・§6.2 G7 | 15 |
| foldOneKind（10031）・reportNotFolded（2509） | 畳む2項の点なしの k = 1（印 zero の物と長さ 0 の流れは A、R95）と、畳まない2項の点なしの pointfree-not-folded | R31・R32・R95・R84 | 15・21・53 |
| streamStep（9774）・streamInto（9785）・composedMouths（9850） | 撒いた流れを段（合成なら合成全体）の口で受ける。口が数えられなければ G19 | R51・§6.2 G19 | 15・19 |
| partialFn（10040）・patternPartial（3552）・internPartial（2260） | 足りない適用（k < n）の関数。括りの関数は当てた物を覚え、残りが来た所で元の関数の実体を作る | R24・R42 | 2・7 |
| markSaturated（10113） | 口が全部埋まった関数を値にする（余りは foldStep が後ろに積む） | R35 | 7 |
| renderEntry（10161） | 適用・合成の木を書く（実引数が2つ以上なら構築、合成の子は開く） | R8・R47 | 4・7 |
| noteExcess（9393）・excessLength（9427） | `~rest` の無い括りの仮引数に長い List が来た所の bracket-excess | §6.2 | 2・16・23 |
| resolveProduct（7539）・productOperand（7597）・vanishedSeq（7608）・mayBeUnit（7711）・isSieveBracket（6399） | `,` の辺を辺の中で左から畳み、恒等射と `!_` と分かる辺を単位として消す（恒等射かは辺ごとに見る）。印 zero の `$`・`@` の項と `~w` も、単位になりうる綴りとして篩う。単位になりうる綴りの括りは、篩で読んだ答えを同じ所の本体でも使う（memos の seq） | R19・R61・R121・R137 | 12・23・54 |
| commaItems（1954）・listShapeOf（1946） | 書き並べと `,` の積の中身の形を数える（撒く項を含む並びは中身の見えない A、消える `(unit …)` は数えない） | R64・R121 | 23 |
| finishTrees（8594）・leftoverUnit（8619）・reportLeftover（8639）・fillDefaults（9044） | 積み上げを構築の節にする。評価する所に残った口の開いた関数は `(unit …)` で `!_` にして leftover-lambda、既定値の口だけが開いた部分適用は既定値で埋める | R42・R47・R48・R52・R76・R107 | 5・7・24・41 |
| bareReturnUnit（7819） | 本体の返す所の裸の関数を `!_` にして bare-function-return | R125 | 26 |
| writtenKinds（6974）・unitRowRefusals（7243）・peekRead（6957） | 本体の枝の条件と値・既定値の行の項の種類を書いた木で決め、印 zero なら G22。部分の項は本体の読みを実体を作らずに覗いて借り（知らせは捨て、F は写して戻す）、R48 の演算子・段18 の器の側・並びと鎖の読みを重ねる。名前の種類は右辺の書いた木の種類。`$`・`@`・`~` の印の項は peekTerm で読む。覗き読みは自分だけの覚えの表を使い、抜ける時に捨てる。行と項の種類は、書いた木と範囲ごとに1回だけ見る（once。見ている途中の名前に当たった種類は覚えない） | R128・R139・R49・R137 | 52・54 |
| patternFn（3504） | 括りの関数（n は仮引数の数、括り1つで1） | R24 | 2・4 |
| instantiate（3809）・instRootOf（3881） | 渡した形ごとに実体を作る（鍵は fnKey と bindParams の鍵）。答えは実体の根が A なら中身の見えない A、ほかは未知 | R24・R25 | 2・3・4 |
| bindParams（3676） | 仮引数ごとの desc と実体の鍵。裸の口は A、印（関数の番地・値を読む参照・lift・点と差・zero）は印ごと持ち越す。R91・R122 の長さを鍵に足す | R24・R81・R91・R122 | 3・4・28 |
| bindBracket（3752）・withShape（1904）・scalarDesc（1919） | 括りの仮引数の名前に、渡された物の要素・欄を射影する（数は長さ1の List、構造体に無い欄は `!_`） | R24・R64・R115 | 1・2・4・23 |
| mergeElems（1927）・deepKind（1893） | List の要素の desc を1つにまとめる | R24 | 2 |
| fnKey（2095）・lambdaKey（2086） | 実体の鍵：書いた `?` の綴り・範囲の鍵と、答えの分かれる印 | R25 | 3・47 |
| internText（2184）・internDesc（2198）・internShape（2239）・internCompose（2274）・canonKey（2327）・descText（2355） | 形を番号の DAG に寄せた鍵と、形の綴り | §1.3・R24 | 3 |
| recordCall（3567）・identFn（3623）・callIdent（3651） | どの `?` を通って呼ばれたかの記録 | R25 | 3 |
| materialize（3930）・walkCalls（3968）・failDependents（3976） | 実体の木 `(inst 形 本体)` を残す | R25 | 3 |
| instanceError（3989）・withLine（270）・causedLine（286） | 実体の門の名指し（呼んだ行で使った名前と、本体を書いた行）。断りが通った行を覚え、G22 との順は、定義の中で断りを起こした書いた行（実体の中の物は呼んだ行）で比べる | R127 | 3 |
| bodyRootOf（3061）・nameKindOf（2956） | 素の関数の本体の根と、名前の種類。値の定義は仮置きせず、値を含む輪は name-cycle | §3.4・R103 | 3・26・36 |
| pushFrame（2591）・abortFrame（2605）・readMemo（2835）・freshMemo（2844）・entryOf（2857）・finishFrame（2862） | 仮置きの記録：A と仮置きして一巡し、外れたら未知にして、頼った答えを解き直す | §3.4 | 3 |
| consult（2632）・passThrough（2641）・addCycle（2649）・chainFrom（2658） | 仮置きの依り（deps）と輪の依り（cyc）を付ける。値の定義の枠より下を読めば name-cycle | §3.4・R103 | 3・36 |
| beginCollect（2785）・endCollect（2790）・collectedRoot（2794） | 無名の素の関数の本体の根の記録 | §3.4 | 3 |
| cycleError（2732）・stepText（2761） | name-cycle の言い分と道筋（書き始めは、輪の中でファイルに先に書いた値の定義） | R103・R127 | 3・36 |
| resolveDefine（6813）・peekUnreadNames（7385）・peekDefaults（7445）・namesPattern（7456） | 読まない所（既定値の中・1行の括りに包んだ名前）から括りの関数を呼ぶ形を字面で見て G7 | R25・R128・R131・R133・§6.2 G7 | 3・47 |
| guardAgain（2572） | 解き直しの守り resolve-again-limit | §6.2・§5 Q25 | — |
| writtenDepth（3233）・instanceDepth（3302）・depthGate（3313）・internLeaf（2195） | 実体の鍵の深さの門（G7） | R22・§6.2 G7 | 3 |
| pendingNow（3327）・gatedNow（3336）・noteCall（3340）・settlePending（3373）・countSettled（3399） | 同じ `?` の確定した実体 512 の門（G7） | §6.2 G7・§5 Q25 | 3 |
| makeLive（3357）・discard（3365） | 作った実体 1024 の守り instance-work-limit | §5 Q25 | 3 |
| guardRefusal（3417）・enterNest（3441）・leaveNest（3447）・freshNest（3455）・stackRefusal（3468） | 入れ子 256 の守り instance-nest-limit と、スタックの守り resolve-stack-limit | §5 Q25 | 3 |
| widthRefusal（3481）・ComposeWidthOverflow（3480） | 合成の幅 1024（COMPOSE_WIDTH_LIMIT 3223）の守り compose-width-limit。addGroup の 8155 で投げる | §6.2・§5 Q25 | — |
| taint（2624）・taintedNow（2628）・refusalOf（3495） | 守りの断りを捕まえた答えの汚れと、解く段の断りの順 | R127 | 3 |

## 試験の法則

| 法則 | 比べる物 | 仕様 | 主な関数 |
|---|---|---|---|
| 1 | 合成 `f1 … fm x` と入れ子 `fm (… (f1 x))`。「1 の未知の枝」は `P S x` と `[,] S 5` | R11・R25・R74・R120・R126 | foldStep・settle・closeEntry |
| 2 | 最後が括りの `g a… b1 … bm` と `g a… [b1 … bm]` | R24・R64 | closeKind・bindBracket・mergeElems |
| 3 | 同じ文の全部の並べ方どうし（木・種類・診断・門）。守りの5本（Q28・Q30・相互再帰・実体の深さと総数・素の関数を挟む鎖）も | §1.2 P2・§3.4・R25・R103 | bodyRootOf・finishFrame・passThrough・collectedRoot・namesPattern |
| 4 | 括りの関数 `h : [x ~xs] ? B` と素の `h : x ? B` | R24 | lookup・bindBracket・instantiate・renderEntry |
| 5 | 値の後ろの `X F Y` と括った `X (F Y)` | R47・R52 | foldItems・foldStep・subHole・finishTrees |
| 6 | 穴に後から当てた `[h P] E`・`h P E` と埋めた `h P'` | R16・R34 | holeFnOf・holeMismatch・plainApplyKind・restHoleKind・restCloseKind・holeApply・defaultUnits |
| 7 | カリー化・関数の並び・余りの綴りと、括りを開いた綴り | R35・R40・R41・R47 | foldStep・partialFn・renderEntry |
| 10 | `P S` と `(P) S` と `v : P ⏎ v S` | R40・R52 | foldItems・rowsInfo |
| 11 | `_ X` と `i X`、`5 _ X` と `5 i X`、`-_ X` と `-i X` | R44・R87・R137・R138 | classify・single・holeStep |
| 12 | `_ , X`・`X , _`・`i , X` と `ff , X`・`X , ff`、行 X と `w , X` | R61・R48・R137 | resolveProduct・productOperand・resolveEvaluatedSide・finishTrees・resolveBlockBody |
| 13 | `P i S` と恒等射を消した `P S`（根・括り・名前） | R29・R44・R46・R74・R126 | identityGate・reduceFold・withoutIdentity・passStream |
| 14 | 口の中の `Y _ S` と `Y i S`・`[x ? Y x] S` | R46 | holeStep |
| 15 | `map $f xs`・`[f,] xs`・`[f,] xs~`、`f xs~` と畳み込み・書き下し | R31・R49・R50・R51 | classifySpread・mapOver・foldOver・elemsOfContainer・foldOneKind |
| 16 | `C[(X F)]` と `C[X]`、`X F` と `(X F)`・`w : X F`、`$[X F]` と `$[X F , _]`（同じ G20） | R52・R59 | finishTrees・excessLength |
| 17 | `C[$N]` と `C[$[N]]`・`C[$[右辺]]`、`p : $[B]` と `[B]` | R57・R99・R100・R101 | classifyDollar・classifyLift・leftoverUnit・isIdentityKind |
| 18 | `$lf` と開いた `$[R]`、`$_` と `$[x ? x]` と `$i` | R49・R54・R56・R57・R128 | classifyDollar |
| 19 | `F G X~` と `g : F G ⏎ g X~`・`(F G) X~`・`h X~` | R51 | streamStep・composedMouths |
| 20 | `$[X]` と `$[(X)]`・`$[X , wz]`、`$[X , _]` と `$[X , ff]` | R44・R57・R59・R61・R101・R137 | classifyDollar・writtenProductRow |
| 21 | 値を読む参照 R を値の演算子に当てた中置・区間・点なし・口の綴りどうし | R62・R99 | pointfreeOf・classifyInfix・addressOp |
| 22 | `(P + X) - P` と差、`P + (Q - P)` と Q ほか、点と差の綴り | R62 | addressOp・operandFace |
| 23 | `H e1 … em`・`H [e1 , … , em]`・`H [e1 … em]`・`H [e1 … em]~`。括らない `H e1 , … , em` は `[H e1] , … , em` と同じ答え | R64・R121 | closeKind・resolveProduct |
| 24 | 根の F と、比べ・論理の被演算子・手続きの行の F | R42・R48・R76・R137 | finishTrees・leftoverUnit・reportLeftover |
| 25 | `$v` の輪を通す形と、`$v` を `$u25` に替えた形 | R103 | selfReaderHolds |
| 26 | 本体の返す所（字下げの本体・枝の値・枝の後の既定の行）の F と、1行の本体の根の F | R76・R125 | bareReturnUnit・bodyRootOf |
| 28 | 単相化 `F a…` と、β の `bf …` と、同じ本体の括りの関数 `pt a…` | R81 | bindParams・writtenDepth |
| 29 | `C[@p]` と `C[@[p]]`（本体に同じ名前の枝を置いても） | R78・R128 | classify |
| 31 | `!_` と分かる名前 wz の長さ 0 の流れ `C[X[wz~]]` と `C[X[[wz]~]]` | R83・R84・R95 | emptyMark・markStep・pointfreeOf |
| 32 | `F op 1`・`1 op F` と `F == 1`・`1 == F`（並びの項と値の口の算術とビットは `F + 1`・`1 + F`） | R76・R87・R49 | classifyInfix |
| 33 | 番地の組 `L + R` と `R + L`、括り・名前で包んだ物 | R62 | addressOp・hexFace |
| 35 | `(P + A) + B` と `P + (A + B)`、`A + B` と `B + A` ほか | R62・R97 | addressOp |
| 36 | `$` を通る輪と、輪の外の値 u36 に替えた綴り | R103 | nameKindOf・passThrough・selfReaderTarget |
| 37 | `C[($x ' 0)]` と `C[(x)]` と `C[@[$x]]` | R56・R102 | lowerPick |
| 38 | 書いた `,` の積の `$[P]` と、単位律で縮めた `$[R]` | R56・R61・R101 | writtenProductRow・classifyDollar |
| 39 | 値の口の `!_` と分かる値 E（w・`(w)`・`[w]`・`(pw ' zz)`・wr・`($inc ' 1)`・`[wr]`）を置いた `C[X[E]]` と、E を消した `C[X[]]` | R83・R112・R115・R138 | writtenEmptyMark・markStep |
| 41 | 評価する所の `gq 1` などの木と、既定値を埋めた木 | R61・R76・R107 | fillDefaults・resolveEvaluatedSide |
| 45 | 条件が計算の `!_` の枝 `⇥(3 < 2) : V` を差した本体と、差さない本体の値 | R128 | resolveBranchCondition・interpret.js の interpret |
| 46 | 枝 `⇥x : v` と `⇥(x) : v`（木・種類・知らせ・値） | R128 | resolveBranchCondition・interpret.js の interpret |
| 47 | 仮引数を新しい名前 qq にした綴りと、外の名前にした綴り（読む段と値の段） | R133 | checkParamNames・lookup・peekUnreadNames・deadInPatternBody・appliedResult・stringLengthThrough・mayBeFunction |
| 48 | 通る比べの連鎖どうしで、記号を入れ替えた綴り | R119 | refuseChain |
| 49 | 複数行の括りの中の行の頭の TAB を 0〜3 個にした綴り | R135 | lexer.js の refuseBracketQuestionRow（前処理） |
| 50 | 行 X と `w \| X`・`X \| w`・`w ; X`・`X ; w`（`(w)` も） | R137 | logicSide・logicRest・resolveBlockBody |
| 51 | R138 で断る項（`!_`・`$!_`・`[]`・`~[]`）を包みの下に置いた綴りどうし | R138 | refuseWrittenVoid |
| 52 | 未定義の名前と `!_` と分かる名前 w を入れ替えた綴り（木・種類・断りは同じで、未定義の側は name-undefined を書いた所ごとに1つ足す。値の段も） | R21・R49・R128・R139 | undefinedNameNotices・lookup・writtenKinds・interpret.js の known |
| 53 | 点なしの頭（畳む2項の点なし・比べの点なし・`||_||`、それを括った物・番地から開いた物・指す名前・合成）の後ろの並びの項で、w と w~ を入れ替えた綴り（綴りのほかは同じ木・種類・知らせ） | R84・R95・R27 | foldOneKind・markStep・portShared |
| 54 | 印 zero の物に当てた `$`・`@` の形（`$w`・`$q`・`$$w`・`@[$w]`・`@w`・`$w ' 0`・`~$w`・`~@w`・`@$[$w]` ほか 21 形）と、同じ所に w（`~` の形は `~w`）を置いた綴り（綴りのほかは同じ木・種類・知らせ・断りで、PRE の定義の行の木も比べる） | R56・R78・R79・R102 | classifyLift・classify・classifyStacked・mayBeUnit・writtenKinds |
| 55 | `$` の項（`$$vs`・`$-inc`・`$typo`・`~$$vs` ほか 13）を、`,`・`\|`・`;` の辺・名前の右辺・本体・括りの関数の実体2つの本体ほか 26 の文脈に置いた綴りの知らせ（同じ所に字面か w を置いた綴りの知らせに根の X の知らせを足した物と、多重集合で同じ） | R100・R103・R87 | classifyLift・tailTerm・reportLift・reportLeftover |

欠番：8・9・27・30・34・40・42・43・44。

## 実装の注意

### 不動点

- 単調：本体の根を読む所（doneKind・plainApplyKind・restCloseKind・instantiate の `root === "A" ? A() : U()`）は、引いた根が A の時だけ A を返し、ほかは未知か門にする。§3.4 の「いちばん大きい不動点で、順に依らない」は、この単調さと、答えが根の A か否かだけで決まることに依る。単調さは実測の支え（resolve.js 2496〜2511 の注）なので、未知や A でない根を受けて A を返す行を足す時は、その行を通る再帰を法則3 の並べ替えに足す。未知の記録は解き直さない（entryOf）ので、そういう行があると振動はしないが、不動点でない答えが黙って残りうる。（§3.4・P2）
- 未知の記録：entryOf（2857）は根が未知の記録に仮置きの依り（deps）を持たせず、finishFrame は未知の記録に古いの印を付けない（付けると解き直しが関数の数の指数で増える）。輪の依り（cyc）は未知でも持たせる。（§3.4・R103）
- 古いの印を付ける所は3つ：外れた枠の名簿（finishFrame の frame.failed）、当たった枠の名簿が頼った仮置きを引き継ぐ所（finishFrame）、例外で抜けた枠（abortFrame）。どれが欠けても答えが定義の順で割れる。解き直しは読まれた時で、freshMemo（2844）が記録を消し、呼んだ側が解き直す。（§3.4）
- 依りは広く付ける：addCycle（2649）は根に使ったかを見ず、target より上の枠と無名の関数の本体の全部に仮置きの依りを付ける。外れたら答えを下げず、古いと印を付けて解き直す（広い依りで答えを下げると定義の順で割れる）。（§3.4）
- deps と cyc は「この記録が、どの解いている途中の枠に届くか」の2つの写し。違うのは、未知の記録で deps を捨てる所（entryOf）と、枠を閉じる所の扱い。finishFrame は、外れた枠の deps の記録に古いの印を付け、cyc は当たっても外れても引き継ぐ。abortFrame は、cyc の記録には必ず、deps の記録には未知でない時だけ印を付ける。片方を変える時は、finishFrame・abortFrame の2つずつの輪と、readMemo（2835）の consult／passThrough の分けを揃える。（§3.4・R103）
- 無名の素の関数：collectedRoot（2794）は枠を積まず（F.collectors・beginCollect・chainFrom の差し込み・pendingNow の collectors）、記録は閉包の cell が持って bodyMemo に載らず、古くなれば読まれた時に枠を積んで解き直す。手順は bodyRootOf（3061）の写しなので、片方を直す時はもう片方も直す。この閉包は、解き直しの途中に自分の仮置き A を読まれて根が A でなかった時に枠を外れ（failed）にしない（bodyRootOf の 3036・instRootOf の 3863 はする）。その仮置きを読んだ記録が古いの印を受けずに残りうるので、その形を法則3 の並べ替えで確かめる（黙った誤答になるかは未確認）。（§3.4・P2）
- 名前の輪の受け方：cycleError（2732）は name-cycle を作って F.cycleRefused に覚えてから投げる。評価しない所だけがそれを受けて F.cycleRefused を戻す：namesPattern（7456）・classifyDollar（4407）・seeZeroTail（4307）・emptyStreamTerm（4580）・writtenProductRow（4608）・selfReaderTarget（4819）・deadInPatternBody（5220）。評価しない位置や探りを足す時は同じ受け方と戻しが要り、戻さなければ resolve の最後がその輪で断る。（P2・R103）
- 既定値を覗いた所を通る輪：namesPattern は、輪のいちばん下の枠が覗く前から途中の輪（`inDefault && e.cycleFrom < start`）を握りつぶし、F.cycleRefused を覗く前に戻して false を返す。覗いた定義の中だけで閉じる輪は投げ直す。そこへ届くのは構造体の欄の仮引数のブロックの関数の既定値（法則3 の Q30_PASS_FORMS）。§6.2 の name-cycle の行に足す候補。（R25・R103）
- 仮置きの上でだけ通る輪：consult（2632）・passThrough（2641）は、仮置きを読んだ道でも上に値の定義の枠があれば name-cycle にする。そのため輪を閉じる道が仮置きの上でだけ通る形も、入口に依らず同じ言い分で断る：`pb : [y ~ys] ? y + 1`・`g : x ?` ⏎ `⇥pb [k x]` ⏎ `⇥ek`・`k : x ? pb [g x]`・`ek : k 1`・`pf : g 1` は、5つの定義の 120 通りの並べ方のどれでも `ek` の行の name-cycle。resolve.js 2666〜2673 の注は「pf が先なら G7」と書いていて、今の答えと合わないので直す所。（P2・R103）
- 解き直しの守り：guardAgain（2572）の上限は枠を積んだ鍵の数（F.frameKeys.size）。例外が繰り返す形（namesPattern が握りつぶす輪）では、理屈が破れていなくても当たりうる（読みを決めずに断る）。（§6.2 resolve-again-limit・§5 Q25）
- 実体の木：materialize（3930）は解いている途中の枠が無い時（F.stack が空）だけ作り、木は確定した答えの上で残す。failDependents（3976）は、門を捕まえて続ける所を足した時のための守りで、今は誰にも読まれない。（R25）

### 試験の案

- 上の「仮置きの上でだけ通る輪」の形（pb・g・k・ek・pf）を、法則3 の Q30_FORMS（coproduct_laws.test.js 1117）に足す。どの並べ方でも `ek` の行の name-cycle なので、法則3 の比べに入る見込み（名指しの道筋が揃うかは、足す時に試験で見る）。（P2・R103）
- Q30_FORMS（coproduct_laws.test.js 1117）の「1項の `:` の左を覗いた所を通る輪」（`v : (g 1) , 1`・`g : x ?` ⏎ `⇥(v 2) : 1`）の隣に、関数を1つ挟んだ形（`⇥(f 2) : 1`・`f : x ? v`）を置き、直に書いた形と同じ答えかを見る。namesPattern の注（6675〜6677）と coproduct.test.js 2915〜2916 は「挟めば通る」と書くが、関数の本体の枝の条件は resolveBranchCondition（6857）で解くので、今の答えをこの試験で決める。（R128・R103）
- 最大不動点の覗き口：F.bodyMemo・F.valueMemo・F.instMemo を外から読む口を resolve.js に足し、確定した答えで各記録を1回解き直すと同じ答えに戻ること（不動点）と、A でない記録 r を r だけ A に置いて解き直すと A でないに戻ること（局所的な極大）を見る。法則3 が見るのは、順に依らないことまで。（§3.4・P2）
- 同じ覗き口で、⊤（全部 A）から全部の記録を同時に解き直し続ける素朴な全体反復を試験の側に書き、resolve の答えと突き合わせる。入力は法則3 の Q28_FORMS（976）・Q28_REFUSE_FORMS（1010）と coproduct.test.js の Q30_CYCLES（2868）。（§3.4）
- 実体の鍵の印：本体の読みを変える印を desc に足す片では、その印だけが違う2つの呼び出しを並べ替えるプログラムを法則3 に足す（coproduct_laws.test.js 1203 の `ap vs` ⏎ `ap ws` と同じ形）。（R24・R91・P2）
- 穴の η：`add 1 _` と `add 1`、`f3 _ 2 _` と `[a c ? f3 a 2 c]` を、括りの関数の欄に入れて中で当てる形（`hh : [s] ? s 5` の `hh [s : add 1 _]` と `hh [s : add 1]`）で、種類と答えが同じことを法則6 の隣で見る。実体の鍵は別でよいので inst の行は比べない。（R16・R24）
- 法則13 の強め：unitLaw13（2872）は恒等射の側が断れば通す。R74・R126 では恒等射の側も消した側と同じ答えなので、同じ reason と門で断ることまで見て、§6.4 の `inc i inc vs~`（G19）だけを外す。（R74・R126）
- 法則5 と法則10 の比べの外は、どちらも括りが積み上げを1項に閉じる所なので、「次の1歩が、閉じた1項と積み上げとで同じ」の1つの条件に書けば SHAPE5（1720）と SHAPE10（2294）が1つになり、法則10 の語に `[' 0]`・既定値のある関数・恒等射を足せる。（R40・R41・R47・R52・R77）
- 法則41 は木を部分文字列で見るだけなので、種類と知らせの比べを足す。（R107）
- 値の段の点なし（value_spec V12 の解2）で、期待値を書かない法則を interpret.test.js に足す：単位（`[<] a (3 < 2)` と `[<] (3 < 2) a` は a、`[>]`・`[==]` も）、min・max の冪等・可換・結合（`[<] a a` は a、`[<] a b` は `[<] b a`、`[<] a b c` は `[<] ([<] a b) c` とも `[<] a ([<] b c)` とも同じ）、`[==]`・`[=]` の並べ替え不変、中置との橋 `[<] a b ≡ (a < b) | b | a`・`[>] a b ≡ (a > b) | b | a`（a・b に計算の `!_` も入れる）。`!_` を吸う `[&]` の組（`[&] 1 (3 < 2) 3` は `1 & (3 < 2) & 3` と同じ `!_`）を必ず入れる：値の口の計算の `!_` を消す V3 を畳む点なしの実引数に当てる誤りは、`[&]` の組でだけ落ちる。（R31・§3.7・V3）
- 値の段の点なしの席（V12）：`!_` でない値 v ごとに `[!_] v`・`[!_,] v`・`(!_) v` の値が同じ（`!_`）ことを比べる。void を受けた所（`[!_] (3 < 2)`）は比べの外。置き場は interpret.test.js の notYet（693 の `[!_] 5`）を外す片。（R35・R138・V12）

### 整理の候補

- 依りを1つに：deps と cyc の届く先を cyc 1つで持ち、仮置きの依りは読む時に取り出せば、finishFrame・abortFrame の2つずつの輪、readMemo の consult／passThrough の分け、entryOf と collectedRoot の二重の組み立てが1つになる。同じ答えかは法則3 の全部の並べ方で見る。（§3.4・R103）
- 無名の素の関数の記録を bodyMemo に：書いた `?` と範囲の鍵（lambdaKey と同じ）で F.bodyMemo に載せて枠を積めば、F.collectors・beginCollect／endCollect・chainFrom の差し込み・pendingNow の collectors の輪・cell.count と guardAgain の分が消える。範囲の鍵が閉包の環境を言い当てるかは確かめていない。（§3.4）
- entryOf の底：答えに効くのは根が A か否かだけなので、依りを持たせない底を「未知」から「A でない」（L も）に広げれば解き直しが減る見込み。答えが同じかは確かめていない。（§3.4）
- namesPattern の握りつぶし：輪を1つの依りの図で1回判定すれば、握りつぶしと F.cycleRefused の巻き戻しが消える。種類の依りと評価の依りのどちらの図を取るかは決まっていない。（R25・R103・P3）
- 総数の守り（512）を materialize でまとめて数えれば、pendingNow・settlePending の総数の分が消える。代わりに言い分が G7 から instance-work-limit に替わる形が出る。（§6.2 G7・§5 Q25）
- bindBracket の数の枝（3718〜3722）は、数を要素が数の List に持ち上げて List の枝に通した答えと同じなので、持ち上げれば消える。鍵は bindParams の 3685 が持ち上げる前の desc で作るので、N と [N…] の実体は分かれたまま。（R24・R91）
- 言い分の中の閉じた問い：resolve.js:439（Q19）・cycleError の 2695（Q30）・5794 と refuseMapped の 8806（Q20）・identityGate の 8386・8393・8414（Q13）・markStep の 8076（Q8）・9340（Q40）・9376（Q31）・975（Q72）・1366（Q33）・2459（Q34）・4390（Q64）・5136（Q53・Q62）・5183（Q65）・5688・7753・7763（Q37）・6032（Q81）・7751（Q57）・8887・8960（Q46）・8897・8921（Q49）・9064（Q69）が §5.2 の閉じた問いを引く（1366 と 5688 は未決の Q10・Q15 も引く）。8887・8897・8921・8960 は閉じた Q46・Q49 を「決まっていない」と書く。今の答えは §5.2 の表にある。name-cycle の言い分「その値はいつまでもできません」は評価の依りで言い、規則は種類の依りの輪で書く。（P2・R103・§5.2）
- 注が消した法則の番号を引く所：defaultUnits の上の注（9387、法則8）・markStep（8027、法則9・法則30）・7901（法則40）・resolveBlockBody の近く（7190・7267、法則27）。fillDefaults の上の注（8123）の法則39 は、今の法則41。試験の注には resolve.js に無い関数（flowArity・markApply）と注にだけ残る名前（localTarget・unitDefaultParam）を引く所があり、法則4 の注（1471〜1474）は消した法則30 を引く。resolve.js 2666〜2673 の注と coproduct.test.js 2913〜2916 は、閉じた Q30 を「未決」と書く。

### その他

- 内部の木の印：綴りを内部の木に写すのは tokenize（491〜503）の1か所だけ。書いた `_` は前置 `!`＋核 unit（印 nId。classify の 4096 で cat hole、isHoleItem）、書いた `!_` は前置の無い核 unit（印 nVoid。writtenVoidWhole（1427）が void-written に見る）。点なしの席の行（seatRows、402〜414）は写さず、席の `_` は前置の無い核 unit のまま（pointfreeOf の valueMarkUnit は `!core.nId` で席と見分ける）。resolve.js の注には内部の持ち方で書いた所がある。（R138）
- `!_` と分かる値の印（isMark の cat unit の葉）が来るのは、長さ 0 と分かる流れ（emptyMark、R84）と、値の口で読み直した `!_` と分かる名前・括り（writtenEmptyMark、R112）の2つ。markStep・argRun の注の「書いた `!_`」の枝を通るのもこの2つ。（R83・R84・R112）
- 区間の書いた被演算子：A でない（関数か未知）なら、pointfreeOf の withOperand（6192）は括りごと未知の葉にし、知らせない（`[+ inc] 5` は `(construct [+ inc] 5)`、coproduct.test.js 6599）。§2 の区間の行と R87 での読みは §6.4 に足す候補。（R87・§2）
- 合成の途中で未知になった後：settle は前の結果が A でなければ後ろの段を実引数を見ずに全部未知で閉じる（実体を作るのは口1つの括りの関数だけ）。そのため写像・貪欲な単項の G7 は入れ子の綴りにだけ当たる：`uu : x ? [,] x` で `uu [* 2,] 5` は未知で通り、`[* 2,] (uu 5)` は G7。法則1 はこの組を数えるだけで比べの外に置く。（R25・R120・§6.2 G7）
- markStep の G5：既定値のある関数から作った穴の関数で穴を全部埋めた後ろに `!_` と分かる値が来る形（`(go _ 2) 1 w~ 5`）も G5（8072〜8077、coproduct.test.js 3536）。§6.2 の G5 の行（括りの関数の実引数の穴）に足す候補。（R46・R84）
- R126 の畳み直しの合図：identityGate（9292）は割れた所で印 unitLaw つきの G18 を投げ、その項を書いた並び（reduceFold）が拾って withoutIdentity で恒等射を消して畳み直す。G18 は内部の合図。どの並びの withoutIdentity も項を消せなかった時（項が並びに無い、合成の段に恒等射が無い）だけ、外へ出る道が残る（reduceFold の 7500 の注）。§6.4 の G18 の行は「当たらない」と書くので、その道に届く形が無いかを試験で確かめる所。（R74・R126）
- 名前はどこで引いても範囲で引く：輪の下ろし（R103）・読まない所と既定値の中の G7・`$` の G20・G22 も同じ。1か所でも外の表から引くと、隠しのある所で α 同値（法則47）が割れる。（R133）
- 読まない所の「呼んでいる」は、解かずに字面で見る（peekUnreadNames・peekDefaults）：括りの関数（名前・括った `?`・それを1行の括りか前置 `~` で包んだ物）が2項以上の並びの項にあれば G7（値の後ろに積まれて何も受けない `5 h` も）、1項だけ（`z : inc`）は通す。入れ子の `?` の仮引数と既定値の前の仮引数は、範囲で引いてその仮引数を指す。（R25・R133・§6.2 G7）
- 実体の鍵：鍵は綴り（lambdaKey：書いた `?` の綴りと範囲の鍵）と中身の番号（internDesc・canonKey）で作り、物の同一性と見た順は使わない（使うと行の並べ方で鍵が変わる、法則3）。ハッシュも使わず、形を番号の DAG に寄せ、2回目に出た形は `^n` で指す深さ優先の綴りにする。答えの分かれる印（fnKey の vop・n・root・defaultAt・bareAt・holeOf ほか）を鍵から落とすと、括りの関数に渡した時に実体を分け合い、先に解いた答えを後の呼び出しが黙って使う。印を desc に足したら、鍵と形の綴りにも足す。（R24・R25・R91）
- 裸の口は A に揃える：実体の鍵（bindParams）と部分適用の鍵（internPartial）の両方で裸の口の位置を A にし、印（関数の番地・値を読む参照・点と差・lift・zero）の付いた物だけ印ごと入れる。片方だけ形を数えると、同じ実体が2つ描かれて再帰で入れ子になる。括りの関数の部分適用（patternPartial）は実体を作らず、当てた物を覚えて残りが来た所で元の関数の実体を作る。（R24・R42・R81）
- 実体の分け合い：同じ綴り・同じ範囲の `?` の関数は実体の答えを分け合う（lambdaKey・fnKey）。α 同値は保つが、門の行（materialize の lamLine、instanceError の e0.line）は実体を先に作った関数の本体の行になる。名指しの名前は呼んだ所の名前なので、名前と行が別の関数を指すことがある（coproduct.test.js 8512〜8518）。続きの行と、`?` の行に括らずに書いた本体の文法の断りと、使う所の `#` も書き始めの行を指す。R127 の「書いた行」に寄せる所として §6.4 に足す候補。（R25・R127）
- 括りの仮引数の読み：素直な括り（1行で裸の名前が並び、末尾にだけ `~rest` が1つ）を射影で読む。入れ子の括り `[[a b] c]`・2行の括り・途中か2つの `~rest` の括りの名前は、どの実体でも未知（bracketParamOf の notSimple → bindParams の `!p.simple`）で、並びでは種類の未知な項として畳む。実体の鍵は、ほかの括りと同じく渡された物の desc で作る。§2 の「括りの仮引数の中の名前」の行に足す候補。（R24・R64・R91）
- 括りで受けた物の細目（bindBracket）：構造体を `[n… ~rest]` で受けた `~rest` は、名前で受けなかった欄の構造体（欄は書いた順）。List の要素は mergeElems で1つにまとめ、形が揃えばその形、違えば中身の見えない A、関数か未知が1つでも見えれば未知（関数の要素も未知）。長さは形に入れず、R91 の足りない長さだけ鍵に足す。撒く項を含む並び（`[vs~ 4]`）は要素を数えず中身の見えない A（listShapeOf）。中身の見えない A を受けた `~rest` は元の器の elements を持ち越し（`r~` の G7 のため）、名前は未知。（R24・R91・R115・§6.2 G7）
- `,` の辺が恒等射かは辺ごとに見る（vanishedSeq。`,` は両辺が恒等射の時だけ恒等射）。辺を丸ごと解いて捨てると、名前の `,` の鎖で残りを1段ごとに解き直して倍々に遅くなり、coproduct.test.js 4152 の速さの試験（名前 40 個の鎖を 5 秒）が落ちる。（R61・R137）
- 同じ所で解き直す時の覚え（memos：resolveMarkedSeq（6479）の seq・seeZeroTail（4307）の zeroTail・classifyStacked（4227）の stacked）は、速さのためだけの物で、答えは覚えに依らない。seq は、`$`・`@` の項1つの並びと、単位になりうる綴りの括り1つの並び（isSieveBracket（6399））を受ける。鍵は memoPlace（6435）・samePlace（6448）と、ctx の溜め MEMO_ACCS。篩・判定・本体が同じ `$`・`@` の項と `,` の辺の括りを読み直すので、覚えが無いと入れ子が段ごとに倍になる（coproduct.test.js の深さの法則 4194・4224・4285・4320・4351）。無名の本体の積み（F.collectors）は、頂が同じなら同じ所。頂が違っても、どの本体も依り（deps・cyc）を覚えていない積みどうしで、積んだ所と名指しが段ごとに同じなら同じ所（sameCollectors（6442）・memoRecord（6450）。依りは足すだけで減らないので、読み終えて空なら、読む間ずっと空）。覗き読み（peekRead（6957））は、入る所で新しい表にして、抜ける時に外の表に戻す。覚えを足す時は、輪の断り（F.cycleRefused・F.againRefused）が変わった読みと、書いた所を持たない知らせを出した読み（loudPushes）を覚えない。そして、覚え無しの写しで試験と探りが1字も変わらないことを見る。（R56・R78・R61）
- 綴りか範囲だけで決まる物は、1回作って使い回す。次の4つがそう：同じ `?` を同じ外の範囲で読む時の範囲（lambdaIn（7783））・writtenKinds の行と項の種類（once（7149）。書いた木と範囲 cx.scope ごと）・書いた括りの綴り（writeBlock（749））・行の `:` の左に1語で置いた名前（colonNamesOf（1655）。範囲での選びは scanLocals（1648）が毎回やる）。どれも、作った後に書き換えない物だけに使う（範囲に後から書き足す instScope・blockScope は、makeLambda を直に呼ぶ）。これが無いと、入れ子の無名の関数で覚えの鍵（ctx.scope）が合わず、既定値の所の読みが深さの2乗になる。
- 守りの細目：深さの上限は（32 × 書いた括りの関数と実体を作る素の関数の数 + 1）× 書いたいちばん深い形で、解く前にソースだけから決める（INSTANCE_DEPTH_MARGIN 3212。§5 Q25 の値の一覧に 32 を足す候補）。確定した実体 512 が数えるのは、呼んだ時にどの枠も仮置きに頼っておらず門にも汚れにも当たらない物と、頼った枠が全部当たって閉じた物（settlePending）で、単位は呼んだ `?` ごと。作った実体 1024 は、外れた仮置きの上でだけ作った実体を数から外す（discard。鍵の記録 F.instances には残す）。入れ子 256 は同じ `?` の2つ目から先の途中の実体の和で、素の名前つき関数の本体と値の定義の枠に入ると数え直す（freshNest）。JS のスタックの溢れ（RangeError と正規表現の SyntaxError）は resolve-stack-limit。守りに当たった `?` は、それから新しい実体を作らない（F.guardStops）。合成の幅の守りは、スタックの溢れと同じ席（F.stackRefused、resolve の 9794）に置いて、そこで resolve を止める。（§5 Q25・§6.2）
- 解く段の断りの順（refusalOf）：解き直しの守り → 汚れていない値を含む輪 → 総数 → 汚れていない行の門 → 作った数・入れ子・スタックと合成の幅の守り → 汚れた輪と門。守りの断りを捕まえた枠の答えと、それを読んだ計算に汚れを付けて運ぶ（taint）。順に依らないと言えるのは汚れていない物の中だけ。R127 の順に足す候補。（P2・R127）
