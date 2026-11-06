/**
 * 余積（空白）の解決（alpha1 の意味解析の最初の段）。
 *
 * 仕様は alpha1/docs/coproduct_spec.md（設計 workflow の最終版）。ここに書くのは、確信度 91% 以上の規則
 * （§4 の R1〜R48（R18 と R30 は 2026-10-21 に廃止。R6 の強さの順と R35〜R37 の組み立て直しの部分は 2026-10-23 に、左からの畳み込み
 * R40〜R43 に替えて廃止。R44〜R46 は同じ日の、口の外の `!_` は恒等射・恒等射は `,` の単位。R12・R14・R37 は 2026-10-24 に、逆適用の
 * 廃止（R47）で廃止。R48 は同じ日の、余ったラムダの診断。R49〜R51 は同じ日に試しで入れ（番地は指す関数を運ぶ・`[F,]` の写像・撒いた並びは
 * 流れの1項。利用者「試しにやってみよう！…悪ければロールバックしよう。」）、2026-10-25 に決定にした（口が1つの関数への流れは写像から書き下しに
 * 直した。§7.31）。R52 は同じ日の、評価する所の外でも、値の上に
 * 積まれて何も受けずに閉じた関数は余ったラムダ。同じ日の §5 Q50〜Q52・Q44 の答えで、`:` の右辺にも当て、`$[…]` の中身は遅延した式で
 * 判定せず、知らせの重さは warning。R53 は同じ日の、`$` は関数だけを運ぶ（G20）。R54〜R57 は 2026-10-25 の、`$` の先は
 * 書いた所で1つの関数と言い切れること（局所の定義・別名の印・`$_` は零射 `$[x ? _]`・後置の印は断り、前置の印の組み合わせは先で決める。classifyDollar）。
 * 同じ日の §5 Q56 の答えで、`$!_` と恒等射の別名の `$i` は1引数の恒等射 `[x ? x]` を指す印を持つ。R58〜R61 は同じ日の §5 Q58・Q53・Q54・Q41 の
 * 答え：合成に来た流れは合成全体の口の数で受ける（streamInto）・`$[…]` の中身に余る関数があれば G20・`$` は Reader と Writer を作る接頭辞で値の先も
 * 値を読む参照として通す（classifyDollar）・`,` の被演算子の書いた `_` は積の単位（resolveProduct）。同じ日の確かめの直しで、Reader を値の演算子に
 * 置く形を綴りに依らず断り（valueOperand・readerAtPlain・paramTag）、`$[…]` の中身を単位律で縮めて見て（unitReduced）、括りの関数の本体の仮引数を
 * 含まない行を読み（deadInPatternBody）、名前の先の本体を覗くのは木を残す段だけにした（deadOfDef）。R62・R63 は 2026-10-26 の §5 Q59・Q64 の
 * 答え：番地の点と差（`$` の値の参照と点として置いた `0x…` は点、点どうしの差と点に足し引きする `0x…` は差。どちらも Address 型で Int・UInt と混ぜない。
 * 点 ± 差は点・点 − 点は差・差 ± 差は差・点 + 点は断る。addressOp・G21）と、書いた `_` と分かる値を括りの関数の実体へ渡しても `$` は零射の番地
 * （印 zero、dollarNameTarget）。同じ日の確かめの直しで、番地の算術で作った点・差が印を落とす所（関数の答え・素の関数の口・論理と `#`・要素の
 * 形の揃わない器・括りの仮引数に直に）に入れば G21（hasAddr・refuseAddressDrop）、本体の行に隠された名前の番地の顔は使わない（shadowFace。寄せ1 の R128 で外した）、
 * 消えた余りのラムダの残り1項の印は持ち越す（vanishedOne））。R64〜R72 は同じ日の、2026-10-25 の答えの片：括りの名前は射影（括りの口は行の残りを
 * 1つの List で受け、撒いた流れ1つも同じ List。名前の無い要素は受けずに information で名指し。closeKind・noteExcess）、実行時の `_` は口の種類で読みが
 * 分かれる（R65、値の段）、最後の口が参照の口なら `f 1 , 2 , 3` は `f (1 , 2 , 3)`（R66、productIntoRefPort）、仮引数の裸の `~xs` は断る（R67、G22）、
 * 既定値のある関数の既定値の無い口の内側の `_` はカリー化（R68、curryAt）、前から n 個の外の `!_` は閉じた後ろの恒等射（R69）、空の流れを口1つへ渡すと
 * 余ったラムダで `_`（R70、closeEmpty。閉じるのは後ろに何も続かない評価する所・本体の根・値の上だけで、ほかは G19、emptyClosable）、`_ , !_` は `_`（R71）、
 * `$[…]` の中身で値の上に余った恒等射は即時に消える（R72）。同じ日の確かめの直しで、`,` の右の要素が2項以上の並び（`f 1 , 2 3`）は R66 の外（G3、
 * rightChainHasSeq。2026-10-27 の R93 で外し、書いた形のまま通す）、既定値と組んだ前置 `~` の仮引数も G22、名前の無い要素の知らせは文字列・合成の段・部分適用でも同じに数える（noteExcess）、
 * R73〜R79 は同じ日の、2026-10-25 の答えの2つ目の片：`$v` の輪は、Reader が v をその場で評価しないので通す（R73、selfReaderTarget。輪の中で `@` で開けば・v が
 * 値でなければ今のまま name-cycle）、恒等射で始まる合成は単位律で恒等射が消える（R74、foldStep）、`$` で物にした括りの関数を呼んだ実体の本体で値の上に余る関数は
 * G20 で、言い分で `$inc` と書く道を案内する（R75、dollarOpened・asValueAdvice）、比べ・論理の被演算子と2行以上の手続きの本体の行は評価する所（R76、evaluatePlace）、
 * 段18 の点なし `[' k]` は口1つ（R77、fnShape）、先の分かる `@x` は位置に依らない（R78。実装は R49・R60 の片から。G6 の言い分）、前置 `~` は単一の対象を
 * 要素1つの List に持ち上げる（R79、classify。`~_` だけ G4。2026-10-27 の R88 で G4 を廃止し、`~_` も `[_]` と同じ項）。同じ日の確かめの直しで、`$v` の輪の見直しは写しを歩き（自分の右辺が門に当たる `v : $v + 1` で
 * 落ちていた。v の右辺の門はその門で断る、selfReaderHolds）、輪の中で仮に通した参照から `'` で引けば name-cycle（pickSelfReader）、字下げの本体の返す所
 * （1行だけの本体・枝の値・枝の後の既定の行）は1行の本体の根と同じく G16（resolveBlockBody・returnGate。片イの R125 から `_` と知らせ）、2行以上の手続きの `!_` だけの行は G7
 * （refuseProcedureHole）、裸のラムダの行も評価する所、R76 の所の丸ごとの関数は R59・R75 の受け皿に拾わない（leftoverUnit）、`~$x` は `[$x]`（classify）、
 * R80〜R82 は同じ日の、2026-10-25 の §5 Q10・Q45 の答えの片：枝の無い関数の本体の、左が名前1つの `:` の行は局所の定義で、どの使い方でも右辺の種類で読む
 * （R80、localInfo。名前の desc と付きの物はファイルの値の定義と同じ valueOfRoot。局所の定義の行は手続きの行に数えない。局所の値の輪は name-cycle。2026-11-04 の
 * 寄せ1 の R128 で R80 ごと外した：本体の `:` の行は左が何でも枝）、素の関数も
 * 実引数の印（関数の番地・値を読む参照・番地の点と差・書いた `_`）で実体を作る（R81、monoKind・instantiate。印の無い実引数は今のまま本体を1回だけ）、前置 `@` の
 * 値の定義の名前も右辺の印を読む（R82、peekDesc。`@p` は `@[p]` と同じ）、同じ日の確かめの直しで、穴の関数も頭と書いた実引数と穴の位置を持ち越して頭の実体を
 * 作り（holeFnOf・plainApplyKind・restHoleKind。法則6）、仮引数の別名はその名前と同じ物（paramAliasOf。本体の局所の別名なので寄せ1 の R128 で外した）、単相化の実体の印の無い仮引数は定義の行の読みのまま
 * （bindParams）、深さの上限は素の関数も数え（writtenDepth）、印の鍵は番号の DAG（internPlainMarks）、外の局所の名前を隠す内の行は今のまま断り（scanLocals）、
 * `$` の辺のある局所の輪はどこから解いても local-cycle（localInfo。この2つは寄せ1 の R128 で R80 と一緒に外した）、G6 の言い分は届かない理由を言う（inputWhy。片イの R126 で G6 と一緒に外した）、
 * R83〜R93 は 2026-10-27 の片：`_` は置かれた演算の単位（R83。値の口は穴、既定値のある口は既定値、括りの口は空の器。木の段で変わる所は下の物だけ）、
 * 長さ 0 の流れ `[]~`・`_~` は書いた `_` と同じ印（R84、emptyMark。括りの関数の最後の括りが流れ1つを丸ごと受ける所だけ元の流れ、markStep）、書いた `[]` を値の口に
 * 置いた形は G5（R85。同じ日の R94 で廃止）、関数を挟んで値が続く `_` は穴（R86、tryHoleRow）、値の演算子の被演算子は評価する所（R87、classifyInfix・
 * classifyEvaluated）、`~_` は書いた `[_]` と同じ項（R88、R79 のまま。G4 は廃止）、閉じた頭の後ろの口の外の `!_`・`_` は並びの単位（R89、g13Of・holeRefusal）、頭の名前がある
 * 括りに空の List か `_` と分かる値が来たら本体を読まずに `_`（R90、instantiate）、書いた時点で長さの分かる List の足りない名前は `_`（R91、bindParams・
 * argDescOf）、番地と言える物どうしで顔が1つに決まる組（R92、ADDR_ADD・ADDR_SUB）、`,` の積は書いた形のまま括りの口へ（R93、productIntoRefPort）、
 * 同じ日の確かめの直しで、R86 は `_` より前に関数がある並び（合成の頭）を今のまま断り（tryHoleRow）、前置 `~` の葉の中身と `_` を指すかは括り1つの `[x]` と同じに
 * 読み（isLiftTerm）、`_` と分かる値・長さ 0 と分かる List を撒けば空の流れで、中置の被演算子の空の流れも書いた `_`（isKnownEmpty・classifyInfix）、空の文字列も
 * R90、実体の中の残りの名前は長さを持たない（bindBracket の withoutLen）、
 * R94・R95 は 2026-10-27 の片6：値の口に着いた書いた `[]`（と `[[]]`・`~[]`・`[_]`・`~_` など、中身が詰まって `[]` になる書いた括り）は、同じ位置に書いた `_` と同じ
 * （R94、classifyItems の印 writtenEmpty・readWrittenEmpty の読み直し・valuePortOf・emptyArgsAtValue。既定値のある関数の値の口は otherFn の bareAt。名前は R63 の `_` と
 * 分かる値のまま）、点なしの可変長の口（`[* 2,]`・`[inc,]`・`[+]`・恒等射）に来た長さ 0 の流れも書いた `_` と同じ（R95、markStep。元の流れで読むのは括りの関数の
 * 最後の括り（と R34 の穴の関数の最後の括り）だけ）、綴りで並びの形を見る所も長さ 0 の流れを書いた `_` に数える（R95、isUnitLikeTerm）、同じ片の確かめの直しで、
 * 書いた `_` の後ろの書いた `[]` は着く口を先に数え（writtenEmptyAhead。位置を保つ読みで全部値の口に着く所だけ）、括りの中の長さ 0 の流れも詰め（`[_~]`・`[[]~]`、
 * isWrittenEmptyCore）、R34 が読まない並びの前から n 個の口も先に見る（holeMismatch）、
 * R96〜R98 は 2026-10-27 の片7：算術の中の `0x…` は差と読める所ではいつも差（R96、addressOp。`0x…` どうしの和も字面として点か差の隣で差と読み（hexOperand）、
 * `0x… - 差` は差、`0x… - 点` は点としか読めないので断る、refuseHexMinusPoint）、点 ± 差で点の要素の幅（値を読む参照の先が Int か Int の List なら 8 byte、
 * intTree・classifyDollar の w）と差の書いた時点の値（`0x…` の字面とその畳み込み、hexOperand）が分かり、差が幅の倍数でなければ断る（R97、refuseWidth。値は倍数で
 * 字面のどれかが倍数でない所は §5 Q77。幅は名前・括り1つ・中置の鎖と、点の顔と同じく仮引数・揃った器の要素・欄に運び、実体の鍵に入れる）、`差 / Int` は数（R98）、
 * R99〜R104 は 2026-10-27 の片8：`$` は必ず持ち上げで先の種類では断らない（R99、classifyDollar・classifyLift。先の種類の分からない先は印 lift の持ち上げ）・関数以外を
 * 持ち上げたら warning の dollar-non-function（R100、reportLift）・単位律の後にも `,` の残る書いた積の `$` は G20（R101、refuseDollarProduct）・`$x ' 0` は x（R102、
 * lowerPick）・持ち上げだけを通る輪は通し、定義の時に下ろす所を通る輪は断る（R103。classifyDollar の輪の握りつぶしと selfReaderHolds。2026-10-28 の確かめの直しから、
 * 輪の定義から定義の時に下ろす所が見えれば握りつぶさない、liftRingLowering）・`$[]~` は `$_`（R104、emptyStreamTerm）、
 * R105〜R110 は 2026-10-28 の片9：値の口の書いた `_` は単位律 `f _ = f` で消えて口を使わない（R105、markStep・unitArgs。書いた `_` の穴（R16・R38・R68・R86）は廃止、
 * 穴は `!_` だけ。既定値のある関数は左から数えた口で読み、既定値のある口だけ既定値、defaultUnits。tryHoleRow・peelTail・curryAt・writtenEmptyAhead・defaultKeep を外した）、
 * 実行時に来た `_` も値の口では消える（R106、値の段の規則で木は変えない）、評価する所で既定値の口だけが開いた部分適用は既定値で埋める（R107、fillDefaults）、
 * `(!_ _)` は書いた項どおり恒等射（R108、pointfreeOf の negTail）、空は `_` と書く（R109、instanceError の G16 の言い分。片イの R125 で G16 と一緒に無くなった、§5 Q85 (g)）、評価する所では種類の未知な項の後ろの `_` も
 * 消える（R110、reduceItems。同じ日の確かめの直しで、適用の結果と分かる項だけ、appliedResult）、既定値のある関数から作った穴の関数は穴の数を持つ（holeFnOf の holeOf。
 * 穴の口は値の口、穴の外の `_` は G5）、評価する所（R76 の所も）の `,` が単位で消えて残った並びはその評価する所の並び（同じ日の確かめの直し、resolveEvaluatedSide）、
 * R111〜R116 は 2026-10-28 の片9b：取り込みの無い範囲の未定義の名前は `un : _` の un と同じ「`_` と分かる値」（印 zero。R111、lookup・pointsToMark・dollarNameTarget）、
 * 値の口に着いた `_` と分かる名前と括りは同じ位置に書いた `_` と同じ（R112、classifyItems の isKnownUnitItem で R94 の読み直しの道に乗せる。評価する所の値の隣の
 * 未定義の名前も同じ、undefinedLikeName）、`x : _` は書かなかったことと同じ（R113、ファイルの定義は定義の表に入れず、構造体の欄は rowsInfo。外の x が見える欄は
 * information の erased-unit-shadow。枝の無い本体の局所の定義の分（erasedRowsOf）は寄せ1 の R128・R129 で外した：本体の `x : _` は値が `_` の枝で、消えて次へ進む）、
 * 既定値に書いた `_` の仮引数は G22（R114、unitDefaultParam）、
 * 無い欄は `_`（R115、bindBracket・pickDesc）、`#` の右の被演算子は評価する所（R116、evaluatePlace の "#r"）、
 * R117 は 2026-11-01 の片ア：続きの印は行頭の空白だけ（前処理、lexer.js）、
 * R118〜R127 は 2026-11-03 の片イ：2項以上の並びの節は書いた項の並び `written` を持ち、木の `apply`・`construct` は畳みの予想で値を言わない（R118、reduceItems）、
 * 読む段（文字 → 木 | `_`）の断りはファイルごと止め、値の段（木 → 値 | `_`）は知らせて走る（R119。比べの連鎖 refuseChain・括りの中の区間の並び sectionInSeq・
 * 1行の括りの片側の欠けた `:`・`?`（makeCore）・名前でない仮引数 nonNameParam・使う所の `#`（refuseExportMarkUse）・括りの関数の本体の綴り refuseDeferredSpelling）、
 * 種類の未知な項は断らず左から畳む予想（R120。G2(a) と種類の未知な G7 は廃止、名前の読みが決まらない項だけ G7、refuseUndecided）、`,` の辺も左から畳む（R121、G3 は廃止）、
 * 計算の `_` と書いた `[]` は括りの口で受け、空で本体を読まないのは最後の括りと残りを受ける括りだけ（R122、instantiate・bindParams）、`,` の被演算子に丸ごと残った関数は
 * `_`（R123、productOperand）、器の要素の既定値の口だけが開いた部分適用は値の段で埋める（R124）、本体の返す所の裸の関数は `_` と information（R125、bareReturnUnit。
 * G16 は廃止）、G15・G6 は廃止、G18 は単位律で恒等射を消して畳み直す（R126、defaultUnit・reduceFold。読まない所から括りの関数を呼ぶ G7 は残す、§5 Q85 (j)）、
 * 断りと知らせは元のソースの行 `line` を持つ（R127、withLine・rowRefusal）、
 * R128〜R130 は 2026-11-04 の寄せ1：関数の本体（と枝の値のブロック）の `:` の行は左が何でも枝で、本体に局所の定義は無く（R128。R80 と local-* の門を外し、局所の
 * 名前を持つのは括りと構造体の範囲 local-field だけ。枝の条件は `&` の左と同じに解く、resolveBranch・resolveBranchCondition）、値が `_` の枝は消えて次へ進む（R129、
 * 値の段。最後でない枝の bare-function-return の言い分）、枝のある本体の最後でない裸の行は読む段で止める（R130、refuseBareRowBetween の body-bare-row-between）、
 * R131 は 2026-11-04 の寄せ2：仮引数の括り（参照の口）に既定値は書けず、括りの中に `:` のある仮引数と、仮引数のブロックの左に括りのある `:` の行は読む段で止める
 * （bracketDefault・refuseBracketDefault の param-default-bracket。checkParamNames）。既定値は字下げの仮引数のブロックの `名前 : 既定値` の行だけなので、
 * defaultsBare・defaultsSlots・defaultsArity・unitDefaultParam・bareRestParam・visitDefaults もブロックの行だけを見る、
 * R134 は 2026-11-06 の寄せ5：字下げの仮引数のブロックで書いた関数は名前の定義（ファイルの定義と構造体の欄）の綴りで、枝の値と既定値の値に置いたら読む段で止める
 * （paramBlockLambda・refuseParamBlockPlace の param-block-position。checkParamNames の置き場）、
 * §1.2 の P1〜P3、§2 の表の「する」の行）だけである。90% 以下の所は §6.2 の
 * 門（G1〜G22（G14 は 2026-10-21、G17 と G1 は 2026-10-22、G12 は 2026-10-23、G8 と G9 は 2026-10-24、G4 は 2026-10-27 に廃止。G19 は 2026-10-24 の R51（2026-10-25 に決定）、G20 は同じ日の R53。2026-10-25 に R54〜R57 で G20 の当たる形を直し、同じ日の R58〜R61 で G19・G20 の当たる形を直した。G21 は 2026-10-26 の R62、G22 は同じ日の R67）、P2 の門）で名指しで断る。決まっていない形を黙ってどれかの読みに倒すと、後で利用者の
 * 答えが出たときに、その形が黙った誤答として残るからである。断った形は、答えが出たら試験の「断られる」側から「通る」側へ移す。
 *
 * 入り口は `resolve(source)` の1つで、`{ trees, diagnostics, rows, lineOf }` を返す（rows は書いた行の木、lineOf は行の木から元のソースの行を引く関数で、値の段 interpret.js が読む）。trees は1行に1つの木、diagnostics は
 * 止めない診断（information の undefined-name・pointfree-not-folded・bracket-excess・erased-unit-shadow・bare-function-return・name-shadow（R133）と、warning の leftover-lambda・dollar-non-function。各要素は元のソースの行 line を持つ、R127。重さは DIAG_SEVERITY の1か所）。門に当たったら OperationError を投げる（reason は §6.2 の名前、
 * spec は `…§6.2 G2(a)` のように門の番号まで、`gate` に門の番号）。
 *
 * **木の書き方（`show`）**。§1.3・§6.3 の S 式に合わせ、無い所はここで決めた。
 * - 節：`(construct a b …)`・`(compose f g …)`・`(apply h x)`・`(? [$p0 …] (apply h …))`。穴の口の足りない
 *   並び（R34）は、最後の仮引数を括りで書いて `(? [$p0 [~$p1]] (apply h (construct $p0 … $p1~)))`。実引数がアリティより多い適用は、
 *   前から n 個を当てた適用の後ろに余りを並べた構築 `(construct (apply h x1 … xn) xn+1 …)`（R35）。
 * - 左からの畳み込み（R40）で、後ろの関数が並びの項を受けた合成は、各関数が受けた物の見える入れ子の適用で書く（`f2 3 f2 5 6` は
 *   `(apply f2 (construct (apply f2 (construct 3 5)) 6))`）。後ろの関数が前の結果だけを受けた合成は前と同じ `(apply (compose f g) x)`。
 *   並びの項を全部書いた後に合成した後ろの関数も、入れ子の適用で書く（`n 1 2 inc` は `(apply inc (apply n (construct 1 2)))`。
 *   2026-10-23 までは逆適用の綴り `(apply inc (apply n (construct 1 2)) ·rev)` だった。逆適用の廃止（R47、2026-10-24）で `·rev` の綴りは
 *   無くなった。renderEntry の注）。
 * - 並びの最後の書いた `_`（後ろに書いた `_` か関数しか続かない `_`）は、R15 と同じく消える印で、木に書かない（R28、2026-10-26 に書き直した。
 *   `add 3 _` は `add 3` と同じ木、`(add 3 _) 5` は 8。前は「ここで終わる」印で `(apply add (construct 3 _))`）。markStep・peelTail の注。
 * - 評価する所（定義でない行の根の並び、R42）の終わりに残った未評価のラムダは `_` になり、木では元の木を `(unit …)` で包む
 *   （`inc add 5` は `(unit (apply (compose inc add) 5))`、種類は A。`5 inc` は `(construct 5 (unit inc))`）。恒等射でなければ、
 *   warning の leftover-lambda で知らせる（R48。重さは 2026-10-24 の §5 Q44 の答えで information から上げた）。評価する所の外でも、値の上に
 *   積まれて口の開いたまま閉じた関数（何も受けない物も、受けた後の物も、穴の関数も）は同じく `(unit …)` で包み、知らせる（R52、2026-10-24。
 *   `(5 inc)` の中身は `(construct 5 (unit inc))`、`(5 add 1)` は `(construct 5 (unit (apply add 1)))`、種類は A）。左が名前1つの `:` の右辺の
 *   並びも同じ（`v : 5 inc` の右辺は `(construct 5 (unit inc))` で、v は 5。§5 Q50 の答え）。除くのは `$[…]` の中身の並びだけで、遅延した式
 *   なので書いたとおり（§5 Q52 の答え）。同じ日の R53 で中身が関数でない `$[5 inc]` は G20 になり、中身が関数なら中身の並びに余るラムダは
 *   無い。中身の項の中（`$[add (5 inc)]`・`$[x ? x inc]`）の余るラムダは、2026-10-25 の R59（§5 Q53 の答え）から G20（classifyDollar）。構築の中の
 *   `(unit …)` は値の形・要素・数に入れない（vanishedOne）。
 * - 葉は項そのもの。名前は `<>` を外した綴り、字面は書いたまま、印は核に付けて書く（`$inc`・`xs~`・`-x!`・`!_`）。
 * - 中置の項は綴りを頭にした `(+ 1 2)`。欠けた被演算子は `·`。
 * - 括りは書いたとおりに、いつも `[…]` で書く。前段は `[…]`・`(…)`・`{…}` を1つの印にまとめて種類を残さない
 *   （利用者 2026-08-05「カッコの意味って統一されているから種類を問うていない」）ので、綴りを1つにするしかない。
 *   それに S 式の `(…)` は節の印なので、括りを `(…)` で書くと節と見分けが付かない。§6.3 の `(f3 1)` は `[f3 1]` になる。
 *   括りの中の行は ` ⏎ ` でつなぎ、行末の `,`（貪欲の印）は前の語に付ける（`[* 2,]`）。括りの中は書いたとおりで、
 *   解いた木は葉の `view.inner` に持つ。絶対値は `|…|`、ノルムは `||…||`。
 * - 字下げのブロックは、解いた行を並べて `(block 行 行 …)`。書いたとおりに書く所（括りの中・`?` の左）では `{行 ⏎ 行}`。
 * - 段1〜9 の中置は `(== 左 右)`・`(, 左 右)`（`,` は右結合のまま入れ子にする）。
 * - `:` は `(: 左 右)`。左が1項なら解かない（P3）ので、その項をそのまま書く。
 * - `?` は `(? [仮引数を書いたとおり] 本体)`。`?` の左は解かない（P3）。
 * - 括りの関数（R24）は、その `?` を通って呼ばれた実体を形の綴りの順に並べて `(? [仮引数] (inst 形 本体) …)`。
 *   一度も呼ばれなければ、本体を書いたまま `(? [仮引数] (defer {本体}))`（R25。字下げの本体は行を ` ⏎ ` でつなぐ）。
 *   どの `?` を通って呼ばれたかは書いた `?` ごとに数える。同じ綴りの別の関数（`a : [say] ? say 21` と
 *   `b : [say] ? say 21`）は本体の答えを共有するが、呼ばれていない方は defer のまま（R25「一度も呼ばれない」）。
 *
 * **形の綴り**（`inst` の形。R24 の「渡された物の生まれ」を書く）。
 * - 中身の見えない A は `A`、関数は `L`、未知は `U`。
 * - 書いた空の括り `[]`（R24 では List に数えない中身の見えない A。R51 の撒いた流れでは空の流れ）は `A[]`。空と読む所があるので、`A` とは別の
 *   実体にする（2026-10-25、internDesc の注）。
 * - 関数を指す番地（`$inc`・`$[* 2]`。指す関数を印に持つ A、R49）は `$L`。裸の仮引数に渡っても `$L` と書く（印は
 *   実体の鍵に入る。`map $inc vs` と `map $double vs` は、同じ綴りの `$L [N…]` の実体が2つ並ぶ）。
 * - 数（数・文字の字面と、それに値の印や値の演算子を当てた物。長さ1の List と同型）は `N`。数の List は `[N…]`。
 *   番地の字面（`0x…`・`NxHHHH`）は数に入れず、中身の見えない A（SCALAR の注）。
 * - 構造体とも List とも読めないが中身の見える器（行の混ざった括り・同じ名前の欄が2つある構造体など）で、中身に
 *   関数か未知が見える物は `A(U)`。名前で受ければ未知、`~rest` で受ければ中身の見えたまま（撒けば §3.3 の手順1 の
 *   G7）なので、`A` とは別の実体にする。
 * - 構造体は欄を書いた順に `{say:L other:A}`。List は要素の形に `…` を付けて `[A…]`（長さは書かない。形は長さに
 *   依らないので、長さの違う同じ要素の List は同じ実体になる）。入れ子は `{greet:{hello:L} world:[A…]}`・`[[A…]…]`。
 * - 仮引数が2つ以上なら、仮引数ごとの形を空白で並べる（`A [A…]`）。裸の仮引数はいつも A なので `A`。
 * - 関数の欄は、どの関数でも `L` と書く。実体の鍵には関数の出どころ（書いた本体と、定義した所の範囲）まで入れて
 *   いるので、本体の根の違う関数が同じ実体になることはない。同じ綴りの実体が2つ並んだら、関数が違う。
 * - 綴りが SHAPE_TEXT_MAX 字を超えたら、そこで切って `⋯` を付ける（同じ物を欄どうしで共有する形は、木として書くと
 *   深さごとに倍になる）。切っても実体の鍵は切らない（鍵は canonKey の注）。
 *
 * **種類**は A（値）・L（関数）・U（未知）の3つ。畳み込みの1歩は、いちばん上の項と次の項の種類で決まる（R47）：
 * いちばん上が L で次が A なら適用（評価射）、次も L なら合成、いちばん上が A か空なら次の項を積む（次が A なら構築、零対象の
 * ある圏での標準の射 A ⊔ B → A × B。次が L でも積み、積んだ L はその後に来る項を右から受ける）。2026-10-23 までは A·L が逆適用
 * （評価射の前に対称の同型を置いたもの）だった。U はどの対にもならないので、2項以上の並びでは門で断っていた（根なら通す）。2026-11-03 の片イ（R120）から
 * 断らず、U の上の次の項は積む予想、頭が U で後ろ1項なら当てる予想で木を組み、値は値の段が書いた項の並び（written）を左から畳んで決める。
 * 積んだ L から並びの終わりまでは、括った `(L …)` と同じ1つの並びなので、穴と `_` の規則（§3.3 の手順2）もそこで頭の並びとして見る
 * （subHole、2026-10-24 の確かめの直し）。
 * R51（2026-10-24 の試し、2026-10-25 に決定）：いちばん上が L で次が撒く項（`xs~`）なら、撒いた並びは流れの1項で、L のいちばん最初の閉じていない
 * 段の残りの口の数で受ける：口が2つなら左からの畳み込み（段は閉じ、結果は次の段へ）、口が1つなら書き下し（流れの頭を当てて段を閉じ、残りは
 * 後ろに積む。`[+ 1] [1 2 3]~` は `([+ 1] 1) 2 3`。試しの版は写像だった）、最後の口が可変長なら丸ごと、ほか（3つ以上・分からない・固定の口の
 * 後ろに可変長の口）は G19（streamStep・writeOut）。写像は `[f,]` だけ（R50）。木は今までどおり、撒く項を実引数に書いた `(apply L xs~)`。
 * 同じ日の確かめの直しでは、流れを受けた段の後ろに合成の段があり、合成全体の口の数がその段の口の数と違えば G19（§5 Q58）にしていた。§5 Q58 の
 * 答え（R58）から、合成は1つの関数なので、流れは合成全体の残りの口の数で受ける（2つなら合成全体の畳み込み、1つなら書き下し、3つ以上か分からなければ
 * G19。streamInto）。
 */
import peggy from "peggy";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { preprocessWithLines } from "./lexer.js";
import { OPERATOR_DICT } from "./operator_table.js";
import { OperationError } from "./errors.js";

const SPEC = "alpha1/docs/coproduct_spec.md";

// ---------------------------------------------------------------------------
// 前段
// ---------------------------------------------------------------------------

// 文法は1回だけ組み立てる。試験は何十も resolve を呼ぶので、呼ぶたびに peggy.generate すると遅い。
let parser = null;
// 前段の行（語の並び。括りと字下げのブロックの中の行も）→ 元のソースの行（1 から）。resolve が前段を通す間だけ置き、parseRow が断りに行を持たせる（R127）。
let rowLineOf = null;
// parseRow が作った行の木（括りと字下げのブロックの中の行も）→ 元のソースの行。木を組んだ後に読む段で見る所（checkParamNames・refuseExportMarkUse）が、
// 中の行で断ったときにその行を持たせる（R127 の「括りの中の行・字下げのブロックの行は、その中の行」。2026-11-03 の片イの確かめの直し：前はその2つだけ
// いちばん外の行を名指しし、parseRow の段で見る compare-chain などは中の行を名指しして割れていた）。
const rowTreeLine = new WeakMap();
// 行の木 row の中を f で見て、断れば row の元の行を持たせる（先に持たせた、より内の行は残る。withLine）。
function inRowLine(row, f) {
  try {
    f();
  } catch (e) {
    throw withLine(e, row && typeof row === "object" ? rowTreeLine.get(row) : undefined);
  }
}
// 前段を通して、行（語の並び）の並びと、行から元のソースの行を引く関数を返す（R127）。前処理と文法の断りも行を持って出る。
function frontEnd(source) {
  if (!parser) {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    parser = peggy.generate(fs.readFileSync(path.join(dir, "sign.pegjs"), "utf8"));
  }
  const { text, lineAt } = preprocessWithLines(source);
  const rowAt = new WeakMap();
  let rows;
  try {
    rows = parser.parse(text, { rowAt });
  } catch (e) {
    throw withLine(e, e && e.location ? lineAt(e.location.start.offset) : undefined);
  }
  return { rows, lineOf: (row) => (rowAt.has(row) ? lineAt(rowAt.get(row)) : undefined) };
}
// 断りに元のソースの行（1 から）を持たせる（R127）。先に持たせた行（いちばん内の行・前処理が読んでいた行）を残す。message は変えない（試験が行の順を
// 替えて言い分を比べる所がある。coproduct.test.js の「行の順に依らない」）。
function withLine(e, line) {
  if (e && typeof e === "object" && e.line === undefined && line !== undefined) e.line = line;
  return e;
}

// ---------------------------------------------------------------------------
// 門と名前の断り
// ---------------------------------------------------------------------------

const GATE_REASON = {
  // G1（coproduct-reverse-of-many）は 2026-10-22 に廃止した（§5 Q6 の答え、U〔答え〕10-21 23:23。U の時刻は UTC）。断っていた
  // 逆適用の左の構築（`1 2 inc`）は、一番近い1項だけを取って残りを前に積む（R37。2026-10-23 からは左からの畳み込みで、逆適用は
  // いちばん上の値だけを取る、R40）。2026-10-24 に逆適用そのものを廃止した（R47）：`1 2 inc` の inc は積まれて、根なら `_`。
  // G2（coproduct-partial-neighbor）と G3（coproduct-beside-product）は、片イ（2026-11-03）に廃止した。G2(a)（種類の未知な物のいちばん上に次の項）は R120 で、
  // 積む予想（値か空の上）か当てる予想（頭が未知で後ろ1項）の木にして、値は値の段が書いた項の並び（written）を左から畳んで決める（問3「左から読む」）。G3（`,` の
  // 辺の2項以上の並びに関数か未知）は R121 で、辺も左から畳み、辺の終わりに余った関数は `_` と leftover-lambda（問4「同じ」）。
  // G4（coproduct-prefix-tilde）は 2026-10-27 に廃止した（R88、§5 Q14 の残りの答え：`~_` は `_`。R79 のとおり書いた `[_]` と同じ項で、`_` と分かる値）。
  // 2026-10-26 の R79 から当たるのは `~_` だけだった。
  G5: "coproduct-unit-position",
  // G6（coproduct-input-position）は、片イ（R126、2026-11-03）に廃止した：先の分からない `@x` は種類の未知な項（R120）と同じに畳む（foldItems）。
  // 片イから G7 で断るのは、名前の読み（どの定義を指すか）が決まらない項（R120 の例外、refuseUndecided。名前の読みを種類に持ち越す印 `~`・`@`・`'`・中置 `@` を付けた物と
  // 印の付いた括りも、carriedName）・読まない所（枝の条件・既定値）から括りの関数を呼ぶ形（F3、1行の括りに包んだ名前も。peekUnreadNames・peekDefaults。§5 Q85 (j)）・
  // 器の中身に関数か未知が見える写像と撒き（refuseMapped・
  // 撒く項、§5 Q20。オの片）・`$` が作った関数の番地を値の演算子に当てる形（refuseReaderOperand、R62。ウの片）・穴まわりと点なしの形の後ろの `_`（§5 Q15・Q81。
  // カの片）・実体の守りの鍵の深さと総数だけ。種類の未知な項そのもの（前の G7 の本体）は断らない（R120）。
  G7: "coproduct-unknown-kind",
  // G8（coproduct-reverse-arity）と G9（coproduct-reverse-spread）は 2026-10-24 に廃止した（逆適用の廃止、R47。U [2026-10-23 13:12 ebf18260]
  // 「逆適用は廃止しよう」）。主語の口が決まらない逆適用（`5 f2 1`、§5 Q5）は `5 (f2 1)`、撒く項の後ろの関数（`vs~ inc`、R14）は
  // 積まれる。
  // G10（coproduct-reverse-pointfree）は 2026-10-23 に廃止した（R13 の廃止。決定の文面の `1 2 [+] 3 4` は `1 ([+] 2 3 4)`、§5 Q36）。
  G11: "coproduct-no-reading",
  // G12（coproduct-excess-neighbor）は 2026-10-23 に廃止した（左からの畳み込み、R40〜R43）。(a)（余りを積んだ値の後ろの逆適用）と
  // (c)（合成の流れの余りが並び全体を受ける関数に届く）は、畳み込みで答えが1つに決まる（`inc [+] 5 6` は `[+] (inc 5) 6`。`inc 1 2 inc`
  // は 2026-10-23 は `(inc 1) (inc 2)`、2026-10-24 の R47 から `(inc 1) 2` で inc は積まれる）。(b)（本体の根が値でない関数に実引数が
  // 多い）は、種類の未知な物がいちばん上にあるときに次の項が来る形で、G2(a) が断る。(a)・(c) の恒等射の枝（`i 1 2 inc`・`i inc 1 2`）は G18。
  // 片イ（2026-11-03）から、(b) の形は G2(a) と一緒に断らず積む予想（R120）、恒等射の枝は単位律で恒等射を消して畳み直す（R126）。
  G13: "coproduct-hole-arity",
  // G14（coproduct-pointfree-unit）は 2026-10-21 に廃止した。断っていた `[-_]`・`[!!_]`・`[_!]` は単項の点なし（pointfreeOf）。
  // G15（coproduct-default-unit）は、片イ（R126、問2）に廃止した：既定値のある関数の実引数に書いた `_` で、仮引数の外の内側の物（`go 1 2 _ 3`）と位置の
  // 数えられない物（`gz _ 3`）は、木では消える予想で、既定値の口に当たるかは値の段が書いた項の並びを読んで決める（markStep・defaultUnits）。
  // G16（coproduct-bare-function-return）は、片イ（R125）に廃止した：本体の返す所の裸の関数は `_` で、information の bare-function-return で知らせる。
  // G18（coproduct-identity-row）は、片イ（R126）から外へ出さない：恒等射の項が割れ目を作る並びは、単位律でその恒等射を消して畳み直す（reduceFold が
  // identityGate の印 unitLaw を拾う。消せる恒等射が見つからない所だけ、今までどおり外へ出る）。
  G18: "coproduct-identity-row",
  // G19 は 2026-10-24 の R51（試しで入れ、2026-10-25 に決定）：撒いた流れ（`xs~`）を受ける関数の残りの口が、1つ（書き下し。2026-10-24 の試しは
  // 写像）・2つ（左からの畳み込み）・最後の可変長の口（丸ごと）のどれでもない（口が3つ以上か、口の数が分からない）。口が2つでも、畳まない2項の
  // 点なし（R32）は畳まない（試しの確かめ、§5 Q49）。2026-10-25 から、口が1つの書き下しで答えが割れる所（空の流れ、§5 Q57）も。同じ日の確かめの
  // 直しから、合成に来た流れで、合成全体の口の数が流れを受けた段の口の数と違う所（§5 Q58。前は頭で閉じた段の後ろの合成の段が口2つ以上で余りを
  // 受ける所だけを §5 Q57 で断っていた）も。口が3つ以上か分からない所の言い分は §5 Q46 を名指しする。§5 Q58 の答え（R58）から、合成に来た流れは
  // 合成全体の口で受け、断るのは合成全体の口が3つ以上か分からない所と、合成全体を畳むと畳まない2項の点なしで畳む所（§5 Q49）だけ。
  G19: "coproduct-stream-arity",
  // G20 は 2026-10-24（R53）：`$` の先（名前か括りの中身。同じ日の確かめの直しから、字面・ほかの印と組んだ `$5`・`$$inc`・`$vs~` の先も）が
  // 関数でない（値か未知）。`$` は関数だけを運ぶ（U〔答え〕10-24 12:34
  // 「…だから全部の$で良いはずだ。」）。値の束縛の番地の綴りは §5 Q54。
  // 2026-10-25（R54〜R57）から、`$` の先を書いた所で1つの関数と言い切れない（U [2026-10-24 16:52 8dfc006e] の条件、classifyDollar の注）：書いた `_` は
  // 零射 `$[x ? _]` で通り（R56）、局所の定義は右辺で決め（R54。関数の本体の分は寄せ1 の R128 で無くなった）、後置の印の付いた形（`$inc~`・`$fs~`・`$inc!`）は断る（R57）。
  // 同じ日の R59・R60（§5 Q53・Q54 の答え）から、`$` の先は1つの Reader（関数か、値を読む参照）と言い切れること：値の先は通り（R60）、中身に余る関数の
  // ある `$[…]` は断る（R59）。名前の reason（coproduct-dollar-value）は試験と法則が読むので変えない。
  // 2026-10-27 の片8（R99〜R104）から、`$` は必ず持ち上げで先の種類では断らない（関数以外は warning、R100）。当たるのは、後置の印と組んだ形（R57。`$[]~` は R104 で
  // `$_`）・中で余る関数（R59・R75）・単位律の後にも `,` の残る書いた積（R101）と、先の名前の読みが決まらない所（R54 の理由、§5 Q10・Q78）だけ。
  G20: "coproduct-dollar-value",
  // G21 は 2026-10-26（R62、§5 Q59 の答え）：番地の点と差の算術・比べで、決まっていない組か、決まって断る組。点（`$` が作った値を読む参照と、
  // それをずらした物）と差（点どうしの差）はどちらも Address 型で、点 ± 差は点・点 − 点は差・差 ± 差は差・点どうしと差どうしの比べは通る。点 + 点と、
  // Address と数（Int・UInt・文字）を混ぜた算術・比べは断る（決まって断る組）。ほかの組（差に `0x…`・点の左の `0x…`・差 + 点・点と差の比べ・顔の
  // 分からない値・書いた `_`・`*` などの演算）と、中置の外の綴り（区間・点なし・絶対値・値の印・素の関数の口）で番地を受けた形は §5 Q66。
  // 関数を指す番地（`$inc`）を動かす・比べる形は、今までどおり G7（R53 の外）。同じ日の確かめの直しから、番地の算術で作った点・差が印を落とす所に入る
  // 形（refuseAddressDrop）・点・差を中に持つ器に値の演算子を当てる形も G21（§5 Q66。本体の行に隠された名前の点・差の shadowFace は寄せ1 の R128 で無くなった）。
  G21: "coproduct-address-arith",
  // G22 は 2026-10-26（R67）：仮引数の括りの外の前置 `~`（裸の `~xs`。`gx : a ~y ? a`・仮引数のブロックの行 `~y`。同じ日の確かめの直しから、既定値と組んだ
  // `~y : 3`・`[~y : 5]` も）。2026-10-04 に廃止した綴り
  // （名指しで断る門は古い alpha で 10-05 に着地）で、2026-10-19 に alpha1 でも U「以前は撒いて渡す時の仮引数は、裸の　x ~xs だったんだ。それを廃止に
  // して問題ない事が解ったので、その方向で！」（§4 R24 の出どころ）。前は口の数の分からない関数（other）として通っていた。言い分で `[x ~xs]` を案内する。
  G22: "coproduct-bare-rest-param",
  // G17（coproduct-manual-curry）は 2026-10-22 に廃止した（§5 Q35 の答え、U〔答え〕10-21 22:46。U の時刻は UTC）。断っていた `$` で包んだ入れ子の `?`（`add : x ? $[y ? x + y]`）は、
  // `$[+ m]` と同じく `$` で値にした関数を返す形で、本体の根は A で通る（R33）。
};

// 門の番号（`G2(a)` のように枝まで）から断りを作る。reason は門ごとの名前で、枝は spec と gate で見分ける。
function gate(id, message) {
  const base = id.replace(/\(.\)$/, "");
  const e = new OperationError(message, { spec: `${SPEC} §6.2 ${id}`, reason: GATE_REASON[base] });
  e.gate = id;
  return e;
}

// 余積の門か。本体の根の種類を仮に解くとき（下の bodyRootOf）は、門に当たっても止めずに「未知」にする。
// 名前の門（P2）は仮に解いても答えが変わらないので止める。
// 実体の守りの断り（guardRefusal）も門に数える。根の種類を解く所では未知にし、覚えた断りを resolve の最後に投げる。
function isGate(e) {
  return e instanceof OperationError && typeof e.reason === "string" && (e.reason.startsWith("coproduct-") || !!e.guard);
}

function nameError(reason, message) {
  const e = new OperationError(message, { spec: `${SPEC} §1.2 P2`, reason });
  e.gate = "P2";
  return e;
}

// 前段は通るが、木にできない形。余積の規則ではないので門には数えない。
function shapeError(reason, message, where = "§1.2 P1") {
  return new OperationError(message, { spec: `${SPEC} ${where}`, reason });
}

// 字下げのブロックは並びの項にならない（§2、92）。仕様は「前段が中置の右にだけ置く」ことを前提にしているが、
// 前段はブロックを閉じた後の行頭の空白の行（前の行の続き）をつなぐので、ブロックが並びの項や中置の左に来る形も
// 通す（`v :` ⏎ `→inc` ⏎ ` 5`）。前提が崩れた所でブロックを項として読むと、本体の種類（全部の行が A のときだけ A）を
// 素通りして構造体の A になり、黙って木が変わる。だから中置の右でない所のブロックは断る。
function isBareIndent(term) {
  return !!term && term.type === "atom" && term.pre.length === 0 && term.post.length === 0 && term.core.c === "indent";
}
function refuseIndentBlock(where) {
  return shapeError(
    "indent-block-position",
    `字下げのブロックが${where}にあります。ブロックは中置の右にだけ置けます（前の行の続きを書くなら、ブロックの中に書きます）。`,
    "§2"
  );
}

// ---------------------------------------------------------------------------
// P1：語を項に寄せ、中置を畳む
// ---------------------------------------------------------------------------

// 前段の語の見分け方（§1.1）。前置の印は記号の並び＋末尾 `_`、後置の印は `_`＋記号1つ。
const PREFIX_MARK = /^(###|##|#|-|~|!!|!|\$|@)_$/;
const POSTFIX_MARK = /^_[!~@]$/;
const OPERATOR_WORD = /^[!"#$%&'\-=^~|@;+:*,<>/?]+$/;
const isNameWord = (w) => typeof w === "string" && w.length > 2 && w[0] === "<" && w[w.length - 1] === ">";
const isInfixWord = (w) => typeof w === "string" && OPERATOR_WORD.test(w);

const BLOCK_TAG = { '"BRACKET_"': "bracket", '"ABS_"': "abs", '"NORM_"': "norm", '"INDENT_"': "indent" };

// 値の演算子の印（§2「A の核に前置 `-` `!` `!!`・後置 `!`」）。
const VALUE_PREFIX = new Set(["-", "!", "!!"]);

// 畳む2項の点なしの記号（R31、pointfreeOf）。算術（`^` だけ右から）・ビット・論理・比較。`<<`・`>>`・get・set・範囲・`!=`・
// `!==`・中置の `#` は畳まず、素の2引数の関数として読む（R32、§5 Q34 の答え）。
const FOLD_SYMS = new Set(["+", "-", "*", "/", "%", "^", "||", ";;", "&&", "|", "&", ";", "<", "<=", "=", ">=", ">", "=="]);
// そのうち論理（段5〜7）の物。値の演算子ではないので、Reader を受けても断らない（中置の `;`・`|`・`&` と同じ。R60 の細かい所。番地の点と差の規則 R62 も
// 当てない）。
const LOGIC_FOLD_SYMS = new Set(["|", "&", ";"]);

function makeCore(w) {
  if (Array.isArray(w)) {
    const c = BLOCK_TAG[w[0]];
    if (!c) throw shapeError("front-end-shape", `前段の囲みの印を読めません: ${JSON.stringify(w[0])}`);
    // 欠けた被演算子を許すのは括りの行だけ（P1「括りの1行が中置で始まるか終わる形」）。
    const rows = w[1].map((row) => parseRow(row, { inBracket: c === "bracket" }));
    // R119（2026-11-03 の片イ）：1行の括りの、片側の欠けた `:`・`?`（`[:]`・`[?]`・`[z ?]`・`[? z]`）は木を書く記法の点なしで、alpha1 では作らない（§2、§5 Q19）。
    // 前は種類の決まらない項として並びで G7、1項なら未知で通った（`ff : [z ?]` は定義の行が通り、`ff 5` で G7）。読みが無い綴りなので、どこに書いても読む段でファイルごと
    // 止める（問2 の答え、parseRow の注。1項の綴りも止めるのは R .70）。2行以上の括りの行（`[1 ⏎ z ?]`）は見ない（2行の括りの値は器の片で未決）。
    const r0 = rows.length === 1 ? rows[0] : null;
    if (c === "bracket" && r0 && r0.type === "op" && (r0.sym === ":" || r0.sym === "?") && (!r0.left || !r0.right)) {
      const how = r0.sym === "?" ? "関数なら左に仮引数、右に本体を書きます（`[z ? z]`）" : "欄なら左に名前、右に値を書きます（`[k : 5]`）";
      throw shapeError(
        "pointfree-tree-notation",
        `括り \`[${writeTree(r0)}]\` は、片側の欠けた \`${r0.sym}\` の点なし（木を書く記法の \`[${r0.sym}]\`）です。alpha1 では作らない（§2、§5 Q19）ので、読む段で止めます（§4 R119。前は並びの中で G7）。${how}。`,
        "§4 R119"
      );
    }
    return { c, rows, raw: w };
  }
  if (w === "_") return { c: "unit" };
  if (isNameWord(w)) return { c: "name", name: w.slice(1, -1) };
  return { c: "lit", text: w };
}

// 1行の語を、項（前置の印・核・後置の印をまとめた物）と中置の演算子の並びにする（R2：印は隣の核1つに付く）。
function tokenize(words) {
  const toks = [];
  let i = 0;
  while (i < words.length) {
    const w = words[i];
    if (isInfixWord(w)) {
      const def = (OPERATOR_DICT[w] || []).find((d) => d.position === "infix");
      if (!def) throw shapeError("operator-unknown", `\`${w}\` は中置の演算子として表にありません。`);
      if (def.removed) throw shapeError("operator-removed", `\`${w}\` は廃止されました（${def.removed}）。`);
      toks.push({ t: "op", sym: w, stage: def.precedence, assoc: def.assoc || "left" });
      i++;
      continue;
    }
    const pre = [];
    while (typeof words[i] === "string" && PREFIX_MARK.test(words[i])) pre.push(words[i++].slice(0, -1));
    if (i >= words.length) throw shapeError("front-end-shape", "前置の印の後ろに核がありません。");
    const core = makeCore(words[i++]);
    const post = [];
    while (typeof words[i] === "string" && POSTFIX_MARK.test(words[i])) post.push(words[i++].slice(1));
    toks.push({ t: "atom", term: { type: "atom", pre, core, post } });
  }
  return toks;
}

// 1行を木にする。段1〜9 は並びを切り（R1・R20）、段12〜22 は項の中へ先に畳む（P1）。段10 の前置 `~` と
// 段23〜25 の印は、前段が核に密着させて返すので、項の印として tokenize が持つ。
//
// 木：{type:'op', sym, stage, left, right}（段1〜9）か {type:'seq', terms}（余積の並び）。
// 項：{type:'atom', pre, core, post} か {type:'infix', sym, stage, left, right}。
function parseRow(words, { inBracket = false } = {}) {
  let toks;
  try {
    toks = tokenize(words);
  } catch (e) {
    throw rowRefusal(e, words); // 括りの中の行で断れば、その行が先に行を持つ（withLine）
  }
  let pos = 0;
  const peek = () => toks[pos];
  const isLow = (t) => t && t.t === "op" && t.stage <= 9;
  const isHigh = (t) => t && t.t === "op" && t.stage >= 12;

  function parseLow(minStage) {
    let left = parseSegment();
    while (isLow(peek()) && peek().stage >= minStage) {
      const op = toks[pos++];
      const right = parseLow(op.assoc === "right" ? op.stage : op.stage + 1);
      left = { type: "op", sym: op.sym, stage: op.stage, left, right };
    }
    return left;
  }
  function parseSegment() {
    const terms = [];
    while (pos < toks.length && !isLow(peek())) terms.push(parseHigh(12));
    return terms.length ? { type: "seq", terms } : null;
  }
  function parseHigh(minStage) {
    let left = null;
    if (peek() && peek().t === "atom") left = toks[pos++].term;
    while (isHigh(peek()) && peek().stage >= minStage) {
      const op = toks[pos++];
      const next = op.assoc === "right" ? op.stage : op.stage + 1;
      const right = peek() && (peek().t === "atom" || isHigh(peek())) ? parseHigh(next) : null;
      left = { type: "infix", sym: op.sym, stage: op.stage, left, right };
    }
    return left;
  }

  const tree = parseLow(1);
  if (tree && rowLineOf) {
    const line = rowLineOf(words);
    if (line !== undefined) rowTreeLine.set(tree, line);
  }
  const allowMissing = inBracket && words.length > 0 && (isInfixWord(words[0]) || isInfixWord(words[words.length - 1]));
  if (!allowMissing && hasMissing(tree)) {
    throw rowRefusal(shapeError("infix-missing-operand", `中置の演算子の被演算子が欠けています（点なしは括りの中でだけ書けます）: \`${writeRow(words)}\``), words);
  }
  // R119（2026-11-03 の片イ）：点なしの被演算子は1項に限る（§2）。括りの行が中置で始まるか終わっても、被演算子の欠けた項（区間）が2項以上の並びの中にあれば
  // 点なしの形ではなく、その中置の左か右が欠けた並び（括りの外の `+ 16` と同じ、§1.2 P1）。前は種類の決まらない項として並びで G7（`(+ 1 2)`・`(1 2 +)`・
  // 2行の括りの行 `+ 2 3`）か、点なしの形の後ろの `_` の G7（`(+ 1 _)`・`(<< _ _)`、refusePfTail）だった。文法に無い形なので、読む段でファイルごと止める
  // （問2 の答え、U〔答え〕[2026-11-01 12:09 159479c9]「ファイルごと止める」。区間の後ろに項が続く並びを文法に無い形と読むのは R .75、`+ 16` と同じ線）。
  // `(+ 1 , 2)`・`[* 2,]` の `,` の辺は1項の並びなので当たらない。段1〜9 の片側の欠けた形（`[| 5]`・`[== 3]`）は並びの項でないので見ない（値の段）。
  if (allowMissing) {
    const hit = sectionInSeq(tree);
    if (hit) {
      const op = missingInfix(hit.term);
      const side = op.left === null ? "左" : "右";
      const sec = writeTerm(hit.term);
      const at = hit.seq.terms.indexOf(hit.term);
      const near = at === 0 ? "後ろ" : at === hit.seq.terms.length - 1 ? "前" : "前と後ろ";
      const tail = at === 0 && hit.seq.terms.slice(1).every(isUnitTerm) ? `点なしなら \`_\` を書かずに \`[${sec}]\` と書きます。` : "";
      throw rowRefusal(
        shapeError(
          "infix-missing-operand",
          `点なしの被演算子は1項に限ります（§2）。括りの行 \`${writeRow(words)}\` は、区間 \`${sec}\` の${near}にも項が並ぶので点なしの形ではなく、中置 \`${op.sym}\` の${side}の被演算子が欠けています（括りの外の \`+ 16\` と同じ、§1.2 P1）。文法に無い形なので、読む段で止めます（§4 R119。前は G7）。${tail}`,
          "§4 R119"
        ),
        words
      );
    }
  }
  refuseMixedAssoc(tree, words);
  return tree;
}
// 2項以上の並びの中の、被演算子の欠けた項（R119、parseRow）。見つかれば {seq, term}、無ければ null。
function sectionInSeq(tree) {
  if (!tree) return null;
  if (tree.type === "seq") {
    const term = tree.terms.length >= 2 ? tree.terms.find(hasMissingTerm) : null;
    return term ? { seq: tree, term } : null;
  }
  return sectionInSeq(tree.left) || sectionInSeq(tree.right);
}
// 項の中の、被演算子の欠けた中置。
function missingInfix(term) {
  if (!term || term.type !== "infix") return null;
  if (term.left === null || term.right === null) return term;
  return missingInfix(term.left) || missingInfix(term.right);
}
// 前段の行の断りに、その行の元のソースの行を持たせる（R127）。
function rowRefusal(e, words) {
  return withLine(e, rowLineOf ? rowLineOf(words) : undefined);
}

function hasMissing(tree) {
  if (tree === null) return true;
  if (tree.type === "seq") return tree.terms.some(hasMissingTerm);
  return hasMissing(tree.left) || hasMissing(tree.right);
}
function hasMissingTerm(term) {
  if (term === null) return true;
  if (term.type === "infix") return hasMissingTerm(term.left) || hasMissingTerm(term.right);
  return false;
}

// 同じ段に結合の向きの違う中置が続く形（段18 の `'` は左、`@` は右）は、表の段と向きだけでは畳み方が決まらない
// （P1 は「表の段と結合の向きのとおり」としか言わない）。どちらかに倒すと黙って割れるので断る。
// 比べの連鎖（R119、refuseChain）もここで見る。括りの行・字下げのブロックの行も parseRow を通るので、呼ばれない本体と既定値の中でも止まる。
function refuseMixedAssoc(tree, words) {
  const visitTerm = (term) => {
    if (!term || term.type !== "infix") return;
    if (COMPARE_HIGH.has(term.sym)) refuseChain(term, words);
    for (const child of [term.left, term.right]) {
      if (child && child.type === "infix" && child.stage === term.stage && assocOf(child.sym) !== assocOf(term.sym)) {
        throw rowRefusal(shapeError("infix-mixed-assoc", `同じ段で結合の向きが違う中置（\`${child.sym}\` と \`${term.sym}\`）が続いています。括りで分けて書きます。`), words);
      }
      visitTerm(child);
    }
  };
  const visit = (t) => {
    if (!t) return;
    if (t.type === "seq") t.terms.forEach(visitTerm);
    else {
      // 段8 の `==`・`!==` は項の中の中置ではなく並びを切る節（parseLow）なので、visitTerm に入らない。ここで見る。
      if (COMPARE_LOW.has(t.sym)) refuseChain(t, words);
      visit(t.left);
      visit(t.right);
    }
  };
  visit(tree);
}

// 比べの連鎖（R119）。中置の比べ（段13 の `<`・`<=`・`=`・`>=`・`>`・`!=` と段8 の `==`・`!==`）が括りを挟まずに2つ以上続く形は、括らない3項の
// `a < b < c` と `a > b > c` だけを通す（木は今のまま `(< (< a b) c)`。median は値の段が読む）。ほかは文法に無い形として読む段で断る（問2、ファイルごと止める）。
// → 2026-11-06 の寄せ5 で広げた（下の refuseChain の注）。この段の下の R の所の `<=`・`>=` と `=` の読みは、前の記録。
// 根拠：U [2026-10-27 23:33 438d5b1a]「中置の比べの連鎖は、3値のmedianを取りたいだけだろう？」、U [23:34]「4つ以上はエラーね」（どちらも打った言葉）、続けて
// U〔答え〕[23:36]「断る。向きが揃わない3つの連鎖（x > 0 < 10、== や != を混ぜた物）もエラー。median になるのは a < b < c と a > b > c の向きが揃った物だけ。」
// （ボタンの文は主の Claude の物）。
// R（主の Claude の読み、未決）：`<=`・`>=` を含む3項（`a < b <= c`・`a <= b <= c`）は読みが決まっていないので断る側に置く。`=`・`!==` は `==`・`!=` と同じく
// 向きの無い比べに数える。段8 の辺が比べの項1つだけの並び（`a == b < c` の木は `(== a [b < c])`）も、書いた字面どおり3項の連鎖に数えて断る。
// 括った比べ（`(a < b) < c`）は葉なので連鎖ではない。
const COMPARE_HIGH = new Set(["<", "<=", "=", ">=", ">", "!="]);
const COMPARE_LOW = new Set(["==", "!=="]);
// 2026-11-06 の寄せ5（§5 Q85 (a) を閉じた）：同じ種類の比べの連鎖は通す。`=` だけ・`==` だけの連鎖は何項でも（全部等しければ一番左、どこかが違えば `_`）、
// 向きの揃った範囲（`<` と `<=`、`>` と `>=`。混ぜてもいい）は3項まで（成り立てば真ん中、外れれば `_`）。木は今のまま左の背骨（`(< (<= 0 i) n)`）で、値は値の段が読む。
// 根拠：U [2026-11-05 15:52 de332d62]「比較演算の種類が同じなら通せる。/ 不等号、以上、以下の連鎖は3項までで、範囲を示すため。/ = と == は、何連鎖でも行けるよね。」、
// U〔答え〕[15:55]「範囲なら通す」（ボタンの文は主の Claude の物）。断るのは、4項以上の範囲・`<` と `>` の混ぜ・`=` と `==` の混ぜ・比べと等しさの混ぜ・`!=` と `!==` の連鎖・`!==` を混ぜた物
// （`!=`・`!==` は推移的でない。`1 != 2 != 1` は隣どうしが全部違っても両端が等しい）。`!=`・`!==` の連鎖と、`=` と `==`・範囲と `=`・`!==` を混ぜた物を断るのは
// 主の Claude の読みで、寄せ5 の文面の承認 U [2026-11-06 11:41 de332d62]。
function refuseChain(t, words) {
  const syms = chainSyms(t);
  if (syms.length < 2) return;
  if (syms.every((s) => s === "=") || syms.every((s) => s === "==")) return;
  const up = (s) => s === "<" || s === "<=";
  const down = (s) => s === ">" || s === ">=";
  if (syms.length === 2 && (syms.every(up) || syms.every(down))) return;
  let why;
  if (syms.every(up) || syms.every(down)) why = `${syms.length + 1}項です（範囲の連鎖は3項までです）`;
  else if (syms.every((s) => up(s) || down(s))) why = "向きが揃っていません";
  else if (syms.every((s) => s === "!=") || syms.every((s) => s === "!==")) why = `\`${syms[0]}\` の連鎖です（\`${syms[0]}\` は推移的でないので、\`1 ${syms[0]} 2 ${syms[0]} 1\` は隣どうしが全部違っても両端が等しくなります）`;
  else why = "種類の違う比べを混ぜています";
  throw rowRefusal(
    shapeError(
      "compare-chain",
      `比べの連鎖（\`${t.type === "infix" ? writeTerm(t) : writeTree(t)}\`）は${why}。通る比べの連鎖は、3項までの範囲（\`a < b < c\`・\`0 <= i < n\`・\`a > b >= c\`）と、\`=\` だけ・\`==\` だけの連鎖です。比べを分けるなら括りで書きます。`,
      "§4 R119"
    ),
    words
  );
}
// 括りを挟まずに続く比べの記号。段13 も段8 も左結合なので左の背骨を辿り、段8 の辺が比べの項1つだけの並びなら、その比べの背骨も数える。
function chainSyms(t) {
  const syms = [];
  const high = (u) => {
    for (; u && u.type === "infix" && COMPARE_HIGH.has(u.sym); u = u.left) syms.push(u.sym);
  };
  const only = (s) => (s && s.type === "seq" && s.terms.length === 1 ? s.terms[0] : null);
  if (t.type === "infix") high(t);
  else {
    let u = t;
    for (; u && u.type === "op" && COMPARE_LOW.has(u.sym); u = u.left) {
      syms.push(u.sym);
      high(only(u.right));
    }
    high(only(u));
  }
  return syms;
}
function assocOf(sym) {
  const def = (OPERATOR_DICT[sym] || []).find((d) => d.position === "infix");
  return (def && def.assoc) || "left";
}

// ---------------------------------------------------------------------------
// 書いたとおりの綴り（括りの葉・`?` の左）
// ---------------------------------------------------------------------------

function writeRow(words) {
  const parts = [];
  let pending = "";
  for (const w of words) {
    if (Array.isArray(w)) {
      parts.push(pending + writeBlock(w));
      pending = "";
    } else if (PREFIX_MARK.test(w)) {
      pending += w.slice(0, -1);
    } else if (POSTFIX_MARK.test(w) && parts.length) {
      parts[parts.length - 1] += w.slice(1);
    } else {
      parts.push(pending + (isNameWord(w) ? w.slice(1, -1) : w));
      pending = "";
    }
  }
  // 行末の `,` は貪欲の印なので前の語に付ける（§6.3 の `[* 2,]`・`[< 3,]`）。
  if (parts.length >= 2 && parts[parts.length - 1] === ",") {
    parts.pop();
    parts[parts.length - 1] += ",";
  }
  return parts.join(" ");
}

function writeBlock(b) {
  const inner = b[1].map(writeRow).join(" ⏎ ");
  switch (BLOCK_TAG[b[0]]) {
    case "bracket":
      return `[${inner}]`;
    case "abs":
      return `|${inner}|`;
    case "norm":
      return `||${inner}||`;
    default:
      return `{${inner}}`;
  }
}

function writeCore(core) {
  if (core.c === "name") return core.name;
  if (core.c === "lit") return core.text;
  if (core.c === "unit") return "_";
  return writeBlock(core.raw);
}

function writeTerm(term) {
  if (!term) return "";
  if (term.type === "infix") return [writeTerm(term.left), term.sym, writeTerm(term.right)].filter((s) => s !== "").join(" ");
  return term.pre.join("") + writeCore(term.core) + term.post.join("");
}

function writeTree(tree) {
  if (!tree) return "";
  if (tree.type === "seq") return tree.terms.map(writeTerm).join(" ");
  return [writeTree(tree.left), tree.sym, writeTree(tree.right)].filter((s) => s !== "").join(" ");
}

// 解かない項（`:` の左の1項）の S 式。中置は畳んであるので S 式で書く（P1 は解かない所にも当たる）。
function rawView(term) {
  if (!term) return null;
  if (term.type === "infix") return { v: "infix", sym: term.sym, left: rawView(term.left), right: rawView(term.right) };
  return { v: "atom", text: writeTerm(term) };
}

// ---------------------------------------------------------------------------
// 木の歩き方（P2 の名前集め・括りと構造体の欄の名前・取り込みの範囲）
// ---------------------------------------------------------------------------

function bareName(term) {
  return term && term.type === "atom" && term.pre.length === 0 && term.post.length === 0 && term.core.c === "name" ? term.core.name : null;
}
function singleBareName(tree) {
  return tree && tree.type === "seq" && tree.terms.length === 1 ? bareName(tree.terms[0]) : null;
}
function isBareBlock(term, c) {
  return term && term.type === "atom" && term.pre.length === 0 && term.post.length === 0 && term.core.c === c;
}

// 仮引数の並びの中の名前（P2）。`:` の右に書いた物は既定値で、仮引数ではないので数えない。
// 既定値の右の名前まで数えると、`z : inc` の `inc` を仮引数と読み、ファイルの定義を隠すと誤って知らせる（寄せ3 の R133 から name-shadow は知らせ。前は誤って断った）。2026-11-04 の寄せ2（R131）から括りの中の `:` は読む段で
// 止める（bracketDefault）ので、答えに出る `:` は字下げの仮引数のブロックの、左が名前1つでない既定値の行（`a b : inc`。parseParams）だけ（読む段より前に定義を
// 集める所 asDefinition には括りの中の `:` も来るが、その源は読む段で止まる）。
function forEachParamNameInTree(tree, cb) {
  if (!tree) return;
  if (tree.type === "seq") return tree.terms.forEach((t) => forEachParamNameInTerm(t, cb));
  forEachParamNameInTree(tree.left, cb);
  if (tree.sym !== ":") forEachParamNameInTree(tree.right, cb);
}
function forEachParamNameInTerm(term, cb) {
  if (!term) return;
  if (term.type === "infix") {
    forEachParamNameInTerm(term.left, cb);
    forEachParamNameInTerm(term.right, cb);
  } else if (term.core.c === "name") cb(term.core.name);
  else if (term.core.rows) term.core.rows.forEach((r) => forEachParamNameInTree(r, cb));
}

function forEachNameInTree(tree, cb) {
  if (!tree) return;
  if (tree.type === "seq") tree.terms.forEach((t) => forEachNameInTerm(t, cb));
  else {
    forEachNameInTree(tree.left, cb);
    forEachNameInTree(tree.right, cb);
  }
}
function forEachNameInTerm(term, cb) {
  if (!term) return;
  if (term.type === "infix") {
    forEachNameInTerm(term.left, cb);
    forEachNameInTerm(term.right, cb);
  } else if (term.core.c === "name") cb(term.core.name);
  else if (term.core.rows) term.core.rows.forEach((r) => forEachNameInTree(r, cb));
}

// 木の中の項を全部訪ねる。`?` の右（入れ子の関数の本体）は、skipLambda なら入らない。
function forEachTerm(tree, cb, { skipLambda = false } = {}) {
  const visitTree = (t) => {
    if (!t) return;
    if (t.type === "seq") t.terms.forEach(visitTerm);
    else if (t.sym === "?" && skipLambda) return;
    else {
      visitTree(t.left);
      visitTree(t.right);
    }
  };
  const visitTerm = (term) => {
    if (!term) return;
    cb(term);
    if (term.type === "infix") {
      visitTerm(term.left);
      visitTerm(term.right);
    } else if (term.core.rows) term.core.rows.forEach(visitTree);
  };
  visitTree(tree);
}

// 取り込み（後置 `@`）のある範囲か（P2）。範囲は関数の本体か、ファイルのいちばん外。
function hasImportIn(tree) {
  let found = false;
  forEachTerm(tree, (term) => {
    if (term.type === "atom" && term.post.includes("@")) found = true;
  }, { skipLambda: true });
  return found;
}

// 仮引数の並び（`?` の左）を読む。素の関数（§3.4）は、仮引数が全部裸の名前（既定値なし・前置 `~` なし・
// 括りなし）の関数である。字下げの仮引数のブロック（前段は `?` の左に1つのブロックとして返す）は1行に1つ。
function parseParams(left) {
  const names = [];
  let plain = true;
  const other = (n) => names.push({ name: n, cls: "other" });
  if (!left) return { plain: false, names };
  if (left.type !== "seq") {
    forEachParamNameInTree(left, other);
    return { plain: false, names };
  }
  if (left.terms.length === 1 && isBareBlock(left.terms[0], "indent")) {
    for (const row of left.terms[0].core.rows) {
      const n = singleBareName(row);
      if (n) names.push({ name: n, cls: "bare" });
      else if (row && row.type === "op" && row.sym === ":" && singleBareName(row.left)) {
        other(singleBareName(row.left)); // 既定値のある仮引数。既定値の右は `?` の左なので解かない（P3）
        plain = false;
      } else {
        forEachParamNameInTree(row, other);
        plain = false;
      }
    }
    return { plain: plain && names.length > 0, names };
  }
  for (const t of left.terms) {
    const n = bareName(t);
    if (n) names.push({ name: n, cls: "bare" });
    else {
      // 括りの中の名前・前置 `~` の名前は、ここでは未知。括りの関数（R24：仮引数が裸の名前と括りだけで既定値が無い）
      // なら、実体の範囲では lookup が先に仮引数の desc（渡された物の生まれ）を見て、実体の外では本体を読まない（R25）。
      // 既定値のある関数（前は `[x : 1] ? …` もそうだったが、2026-11-04 の寄せ2（R131）から既定値は字下げの仮引数のブロックだけで、その行はこの上で読む）は括りの関数ではないので、今までどおり定義の行で本体を読み、ここで未知にした名前は並びで G7 になる。片イ（R120）から、その名前は並びでも G7 で断らず、種類の未知な項として畳む（foldStep）。
      // 括りの外の前置 `~` の関数（`a ~y ? …`）は、2026-10-26 から定義の所で G22 で断る（R67、resolveLambda。前はここの「other」で通っていた）。
      forEachParamNameInTerm(t, other);
      plain = false;
    }
  }
  return { plain: plain && names.length > 0, names };
}
// 字下げの仮引数のブロックの1行が書く仮引数の名前（parseParams と同じ読み：名前1つの行・`名前 : 既定値` の行の左・ほかの行の中の名前）。
function blockRowParamNames(row) {
  const n = singleBareName(row);
  if (n) return [n];
  if (row && row.type !== "seq" && row.sym === ":" && singleBareName(row.left)) return [singleBareName(row.left)];
  const out = [];
  forEachParamNameInTree(row, (x) => out.push(x));
  return out;
}
// `?` の仮引数が縛る範囲（2026-11-04 の寄せ3、R133「内側が勝つ」）。仮引数は、ファイルの定義や外の関数の仮引数と同じ綴りでも、その関数の中では仮引数を指す。
// 既定値の行の右（`y : 式` の式）には前の仮引数までが見え（D documents/en-us/guide/function_guide.md:104 の "preceding parameters"、ja-jp の同じ所の `y : x + 1` ⏎
// `z : y + 1`）、本体には全部の仮引数が見える。{tree, bound, body} の並び（既定値の行の右が書いた順に先、本体が最後）。bound はその木で縛られる仮引数の名前、
// body は本体か（既定値の行の右なら row にその行）。仮引数の名前そのもの（`?` の左の名前）は入らない。2026-11-04 の寄せ2（R131）から既定値は字下げの仮引数のブロックの行だけに書く（括りの中の
// `:` は読む段で止める）ので、ブロックでない左には既定値の木が無い。
function lambdaScopes(op) {
  const parts = [];
  const l = op.left;
  if (l && l.type === "seq" && l.terms.length === 1 && isBareBlock(l.terms[0], "indent")) {
    const prev = [];
    for (const row of l.terms[0].core.rows) {
      if (row && row.type !== "seq" && row.sym === ":") parts.push({ tree: row.right, bound: [...prev], body: false, row });
      prev.push(...blockRowParamNames(row));
    }
  }
  parts.push({ tree: op.right, bound: parseParams(l).names.map((p) => p.name), body: true });
  return parts;
}
// 木の中の、縛られていない名前（入れ子の `?` の仮引数が縛る名前を除く。lambdaScopes。forEachNameInTree は縛られた名前と仮引数の名前も数える）。
function forEachFreeNameInTree(tree, cb, bound = new Set()) {
  if (!tree) return;
  if (tree.type === "seq") return tree.terms.forEach((t) => forEachFreeNameInTerm(t, cb, bound));
  if (tree.sym === "?") {
    for (const part of lambdaScopes(tree)) forEachFreeNameInTree(part.tree, cb, part.bound.length ? new Set([...bound, ...part.bound]) : bound);
    return;
  }
  forEachFreeNameInTree(tree.left, cb, bound);
  forEachFreeNameInTree(tree.right, cb, bound);
}
function forEachFreeNameInTerm(term, cb, bound) {
  if (!term) return;
  if (term.type === "infix") {
    forEachFreeNameInTerm(term.left, cb, bound);
    forEachFreeNameInTerm(term.right, cb, bound);
  } else if (term.core.c === "name") {
    if (!bound.has(term.core.name)) cb(term.core.name);
  } else if (term.core.rows) term.core.rows.forEach((r) => forEachFreeNameInTree(r, cb, bound));
}

// R67（2026-10-26、G22）：仮引数の括りの外の前置 `~`（裸の `~xs`）。`?` の左の並びの項（`gx : a ~y ? a`）と、字下げの仮引数のブロックの、項1つの行
// （`gw :` ⏎ `⇥⇥a` ⏎ `⇥⇥~y` ⏎ `⇥? a`）を見る。括りの中の `[~c]`・`[x ~xs]` は残りを受ける綴りで、当たらない。見つかれば書いた綴り、無ければ null。
// 裸の `~xs` は 2026-10-04 に廃止した綴りで、残りの並びは最後の括り（`[x ~xs]`）が受ける（R24。U 2026-10-19「以前は撒いて渡す時の仮引数は、裸の　x ~xs
// だったんだ。それを廃止にして問題ない事が解ったので、その方向で！」）。前は口の数の分からない関数（other）として通り、前置 `~` の仮引数は n を決めない形
// （defaultsArity）として残っていた（U [2026-10-25 22:45 c8ccdd69]「後、仮引数リスト上で括りのない ~xs という表記、多分もう使ってないんじゃないかな…？」）。
// 既定値と組んだ形（仮引数のブロックの行 `~y : 3`・その1行の綴りの既定値の括り `[~y : 5]`）も見る：既定値の括りは残りを受ける括り（参照の口）ではなく、
// 既定値のある関数は括りの関数でもないので、名前の前置 `~` は括りの外の `~xs` と同じ（2026-10-26 の確かめの直し。最初の版はどちらも素通しし、
// `gd : x [~y : 5] ? x` の `gd _ 2` に R68 のカリー化を当てていた。既定値つきの残りという綴りを作るかは §5 Q72）。見つかれば {text, withDefault}、無ければ null。
// 2026-11-04 の寄せ2（R131）から、括りの既定値（`[~y : 5]` も）は読む段で止める（bracketDefault）ので、ここで見る既定値と組んだ形はブロックの行 `~y : 3` だけ。
function bareRestParam(left) {
  if (!left || left.type !== "seq") return null;
  const tilde = (t) => (!!t && t.type === "atom" && t.pre.includes("~") ? writeTerm(t) : null);
  // `名前 : 既定値` の行の左の名前の前置 `~`。
  const defaultTilde = (row) =>
    row && row.type !== "seq" && row.sym === ":" && row.left && row.left.type === "seq" ? row.left.terms.map(tilde).find(Boolean) || null : null;
  const found = (text, withDefault) => (text ? { text, withDefault } : null);
  if (left.terms.length === 1 && isBareBlock(left.terms[0], "indent")) {
    for (const row of left.terms[0].core.rows) {
      const hit = row && row.type === "seq" ? found(row.terms.map(tilde).find(Boolean), false) : found(defaultTilde(row), true);
      if (hit) return hit;
    }
    return null;
  }
  for (const t of left.terms) {
    const bare = tilde(t);
    if (bare) return found(bare, false);
  }
  return null;
}
// R114（2026-10-28 の片9b、G22）：既定値が書いた `_` だけの仮引数（1行の綴りの既定値の括り `[y : _]`、括りの中の行 `y : _`、字下げの仮引数のブロックの行 `y : _`）。
// 既定値に `_` を置くのは、既定値の口を「値の口と同じく `_` を受ける口」にするためで、`y`（値の口）か `[y]`（参照の口）と書けば済む。見つかれば {text, name}、無ければ null。
// 括りの値の欄 `[s : _]`（R113。構造体の欄は書かなかったことと同じ）とは別の物：こちらは `?` の左の仮引数の並びで、既定値の綴り。
// 根拠：U [2026-10-27 14:47 58a809c9]「なぜ既定値にワザと未定義を入れてまで再帰を回さなければならないか…？ / かな、筋が悪いと思う…」、主の Claude の問い「既定値の
// `[y : _]` は断って、`y` か `[y]` と書くよう案内する、でいい？」（14:48 UTC）に U〔答え〕[14:49]（ボタンの文は主の Claude の物）「それでいい。既定値の [y : _] は
// [~rest : _] と同じく断って、y か [y] と書くよう案内する。片9 に入れて。」。
// 2026-10-28 の片9b の確かめの直し：括りを重ねた既定値の括り（`[[y : _]]`・`([y : _])`）と、字下げの仮引数のブロックの括りの行（`⇥⇥[y : _]`）も同じ既定値の括り（[x] ≅ x。
// 解決器も中に `:` のある括りを既定値の口に数えていた、defaultsSlots。寄せ2 の前）なので、1行1項の括りを剥がしてから見る。前は1行の綴りの `[y : _]` とブロックの `y : _` の行だけを見ていて、
// `gz : x [[y : _]] ? x + y` は既定値のある口として黙って通った（確かめる人の指摘）。
// 同じ確かめの直しで、既定値が書いた `_` でなくても `_` と分かる値（未定義の名前・書かなかったことにした `x : _` の名前（R111・R113）・単位律で書いた `_` に縮む綴り
// `_~`・`[]`・`[_]`・`(_)`・`~_`・`_ , _`・`_ , !_`・`_ _`・右辺がそれらのファイルの値の定義の名前）なら、断る側に倒して G22 で名指しする（unitLikeDefault、§5 Q84）。
// 2026-11-06 の寄せ5 で §5 Q84 を閉じた：`_` と分かる値を既定値に置いた行も、書いた `_` と同じく全部断る（U〔答え〕[2026-11-05 15:18 de332d62]「全部断る」）。
// 動きは前と同じで、言い分から「決まっていない」を外した。返す物の unit は書いた `_` 以外の `_` と分かる既定値の綴り（言い分を分ける）。
// 2026-11-04 の寄せ2（R131）から、括りの既定値（1行の `[y : _]`・重ねた `[[y : _]]`・丸い `([y : _])`・ブロックの括りの行 `⇥⇥[y : _]`・括りの中の行）は読む段で止める
// （bracketDefault）ので、ここで見るのは字下げの仮引数のブロックの `名前 : 既定値` の行だけ（1行の並びには既定値が無い）。
function unitDefaultParam(left, ctx) {
  if (!left || left.type !== "seq" || left.terms.length !== 1 || !isBareBlock(left.terms[0], "indent")) return null;
  // 既定値の中の名前がこの関数の前の仮引数（`x` ⏎ `y : x` の行の x）なら、値は呼ばれた所で決まるので見ない（unitLikeDefault）。
  // R133（2026-11-04 の寄せ3）：既定値の行の右に見えるのは前の仮引数まで（lambdaScopes の既定値の範囲と同じ）。後ろの仮引数と自分の名前は外の名前を指すので、
  // 外の名前として見る（`e0 : []` ⏎ `t :` ⏎ `⇥⇥y : e0` ⏎ `⇥⇥e0` ⏎ `⇥? y` の e0 はファイルの `[]` で G22）。寄せ3 の確かめの直し：前はこの関数の仮引数を全部見える側に
  // 数えていて、後ろの仮引数か自分の名前をファイルの定義と同じ綴りにすると、G22 が name-shadow の知らせだけになって黙って通った（α 同値の5つ目の割れ）。
  const prev = new Set();
  for (const row of left.terms[0].core.rows) {
    const name = isColonRow(row) ? singleBareName(row.left) : null;
    if (name) {
      if (isUnitRhs(row.right)) return { text: writeTree(row), name };
      if (ctx && !prev.has(singleBareName(row.right)) && unitLikeDefault(row.right, ctx)) return { text: writeTree(row), name, unit: writeTree(row.right) };
    }
    for (const n of blockRowParamNames(row)) prev.add(n);
  }
  return null;
}
// 既定値の右辺 rhs が、書いた `_` でない `_` と分かる値か（unitDefaultParam、§5 Q84）：単位律で書いた `_` に縮む綴り（unitSpelled）か、名前が未定義の名前（取り込みの無い範囲。
// 書かなかったことにした `x : _` の名前も、R111・R113）か、右辺がそれらのファイルの値の定義の名前（`e0 : []`・`q : [_]`・`w : no`）。仮引数・局所の名前（呼ばれた所で値が
// 決まる）と取り込みのある範囲の未定義の名前（未知、§5 Q10）は当てない。既定値は `?` の左なので解かず（P3）、綴りと名前の表だけで見る。
function unitLikeDefault(rhs, ctx, depth = 0) {
  if (!rhs || depth > 16) return false;
  if (unitSpelled(rhs)) return true;
  const n = singleBareName(rhs);
  if (!n) return false;
  let imported = false;
  for (let s = ctx.scope; s; s = s.parent) {
    if ((s.descs && s.descs.has(n)) || (s.params && s.params.has(n)) || (s.locals && s.locals.has(n))) return false;
    if (s.hasImport) imported = true;
  }
  const def = ctx.F.defs.get(n);
  if (def) return !def.lambda && unitLikeDefault(def.rhs, { F: ctx.F, scope: ctx.F.fileScope }, depth + 1);
  return !imported;
}
// 単位律で書いた `_` に縮む綴り（書いた `_`・空の流れ `_~`・`[]~`（R84）・中身が詰まって `[]` になる括り（R94。`[]`・`[_]`・`(_)`・`~_`・`~[]`・`[_ _]`）・`_ _`（R15）・
// `_ , _`（R61）・`_ , !_` と `!_ , _`（R71・R45））。名前は見ない（unitLikeDefault が見る）。
function unitSpelled(tree) {
  if (!tree) return false;
  if (tree.type === "seq") return tree.terms.length > 0 && tree.terms.every(unitSpelledTerm);
  if (tree.sym !== ",") return false;
  const hole = (t) => !!t && t.type === "seq" && t.terms.length === 1 && isHoleTerm(t.terms[0]);
  return (unitSpelled(tree.left) && (unitSpelled(tree.right) || hole(tree.right))) || (hole(tree.left) && unitSpelled(tree.right));
}
function unitSpelledTerm(t) {
  if (!t || t.type !== "atom") return false;
  if (t.post.length > 1 || (t.post.length === 1 && t.post[0] !== "~")) return false;
  if (t.pre.length > 1 || (t.pre.length === 1 && t.pre[0] !== "~")) return false;
  if (t.core.c === "unit") return true;
  return t.core.c === "bracket" && t.core.rows.every(unitSpelled);
}
function refuseUnitDefault(u, label) {
  if (u.unit) {
    return gate(
      "G22",
      `${label}の仮引数 \`${u.text}\` の既定値 \`${u.unit}\` は、\`_\` と分かる値（未定義の名前・書かなかったことにした \`x : _\` の名前・単位律で書いた \`_\` に縮む綴り・右辺がそれらの名前）です。既定値に書いた \`_\` を置いた仮引数と同じく断ります。値で受けるなら \`${u.name}\`（値の口）、参照で受けるなら \`[${u.name}]\`（参照の口）と書きます（§4 R114、§5 Q84）。`
    );
  }
  return gate(
    "G22",
    `${label}の仮引数 \`${u.text}\` は、既定値に書いた \`_\` を置いています。既定値に \`_\` を置いた仮引数は、\`~rest : _\` と同じく断ります。値で受けるなら \`${u.name}\`（値の口）、参照で受けるなら \`[${u.name}]\`（参照の口）と書きます（§4 R114）。`
  );
}
function refuseBareRest(bare, label) {
  const what = bare.withDefault ? "既定値と組んでいますが（仮引数のブロックの `名前 : 既定値` の行は、残りを受ける括りではありません）、" : "";
  return gate(
    "G22",
    `${label}の仮引数 \`${bare.text}\` は、${what}括りの外に前置 \`~\` を付けた裸の仮引数です。裸の \`~xs\` は廃止しました。残りの並びを受けるなら、\`[x ~xs]\` と括って書きます（最後の括りが残りの並び全体を1つの List として受けます。§4 R24・R67${bare.withDefault ? "、§5 Q72" : ""}）。`
  );
}

// 括りの関数（R24 の言葉）の仮引数の並び。括りの関数でなければ null。
// 括りの関数は、仮引数が裸の名前と括りだけで（括りが1つ以上）、既定値が無い（括りの中にも `:` が無い）関数である。2026-11-04 の寄せ2（R131）から、中に `:` のある
// 括りの仮引数は読む段で止める（bracketDefault）。下の treeHasColon は、読む段より前にファイルの定義を集める所（asDefinition）ではまだ当たるが、その源は読む段で
// 止まるので答えには出ない（寄せ2 の確かめ）。括りの関数と読まないように残す。
// 印の付いた仮引数は、R24 の言葉に入らないので今までどおりアリティの分からない関数（other）にする。括りの外の前置 `~`（2026-10-04 に廃止した
// 裸の `~xs`）も前はここで other にしていたが、2026-10-26 から定義の所で G22 で断る（R67、bareRestParam）。字下げの仮引数のブロックも、行が裸の名前か
// 既定値なので今までどおり。
//
// 返す物：[{kind:'bare', name} | {kind:'bracket', simple, names, rest, all}]。アリティは並びの長さ（括りは1つで1）。
// simple は R24 の表で読める括り（1行で、裸の名前が並び、末尾にだけ `~rest` が1つ）。それ以外の括り（入れ子の括り
// `[[a b] c]`・2行の括り・`~rest` が途中にある括り）の中の名前は、どの言葉も読み方を決めていないので、決めずに
// 未知にする（all がその名前）。未知にした名前は、並びで使えば G7 で断られるので、黙ってどれかの読みにはならない。片イ（R120）から並びでも断らず、種類の未知な項として畳む（木は予想で、値は値の段が書いた項の並び written を左から読んで決める）。
function patternParamsOf(left) {
  if (!left || left.type !== "seq") return null;
  if (left.terms.length === 1 && isBareBlock(left.terms[0], "indent")) return null;
  const params = [];
  let hasBracket = false;
  for (const t of left.terms) {
    const n = bareName(t);
    if (n) {
      params.push({ kind: "bare", name: n });
      continue;
    }
    if (!isBareBlock(t, "bracket") || t.core.rows.some(treeHasColon)) return null;
    hasBracket = true;
    params.push(bracketParamOf(t));
  }
  return hasBracket ? params : null;
}
function treeHasColon(tree) {
  if (!tree) return false;
  if (tree.type === "seq") return tree.terms.some(termHasColon);
  return tree.sym === ":" || treeHasColon(tree.left) || treeHasColon(tree.right);
}
function termHasColon(term) {
  if (!term) return false;
  if (term.type === "infix") return termHasColon(term.left) || termHasColon(term.right);
  return !!term.core.rows && term.core.rows.some(treeHasColon);
}
function bracketParamOf(term) {
  const all = [];
  forEachParamNameInTerm(term, (n) => all.push(n));
  const rows = term.core.rows;
  const notSimple = { kind: "bracket", simple: false, all };
  if (rows.length === 0) return { kind: "bracket", simple: true, names: [], rest: null, all };
  if (rows.length !== 1 || !rows[0] || rows[0].type !== "seq") return notSimple;
  const names = [];
  let rest = null;
  const terms = rows[0].terms;
  for (let i = 0; i < terms.length; i++) {
    const t = terms[i];
    const n = bareName(t);
    if (n) names.push(n);
    else if (i === terms.length - 1 && t.type === "atom" && t.pre.length === 1 && t.pre[0] === "~" && !t.post.length && t.core.c === "name") rest = t.core.name;
    else return notSimple;
  }
  return { kind: "bracket", simple: true, names, rest, all };
}

// 定義の右辺から `?` を取り出す。1行の括りや字下げのブロックで包んだ `?`（`f : [x ? x]`、字下げの仮引数の
// ブロックの `f :` ⏎ … ⏎ `? …`）も関数の定義に数える。包みを開かないと、名前の種類を決めるのに本体を解く
// ことになり、本体が自分の名前を呼ぶだけで輪（name-cycle）に見えてしまう。
// 片側の欠けた `?`（`[z ?]`・`[? z]`）は関数の定義ではなく `[?]` の点なしで、種類は未知（§2、Q19）。括りの外では
// 前段の後の畳み込み（P1）が欠けた被演算子を断るので、ここに来るのは括りの中の形だけである。名前を通したときだけ
// 関数と読むと、`[z ?] 5` は断るのに `ff : [z ?]` の `ff 5` は通る、という食い違いになる。
// 2026-11-03 の片イ（R119）から、1行の括りの `[z ?]`・`[? z]` は読む段で止める（makeCore）。ここに片側の欠けた `?` が来るのは、2行以上の括りの行（`[1 ⏎ z ?]`）だけ。
function isSection(op) {
  return !op.left || !op.right;
}
function unwrapLambda(rhs) {
  let t = rhs;
  while (t && t.type === "seq" && t.terms.length === 1) {
    const term = t.terms[0];
    if (!(isBareBlock(term, "bracket") || isBareBlock(term, "indent")) || term.core.rows.length !== 1) break;
    t = term.core.rows[0];
  }
  return t && t.type === "op" && t.sym === "?" && !isSection(t) ? t : null;
}

// R113（2026-10-28 の片9b）：右辺が書いた `_` 1つだけか（`x : _`）。`[_]`・`[]`・`_ , _`・`(_)`・`_ _`・`_~` は当てない（定義のまま席を取る。使う所の読みは R111・R112）。
function isUnitRhs(rhs) {
  return !!rhs && rhs.type === "seq" && rhs.terms.length === 1 && isUnitTerm(rhs.terms[0]);
}
// `x : _` の行（左が名前1つ、右辺が書いた `_` 1つだけ）か。
function isUnitDefRow(row) {
  return !!row && row.type === "op" && row.sym === ":" && !!singleBareName(row.left) && isUnitRhs(row.right);
}

function asDefinition(line) {
  if (!line || line.type !== "op" || line.sym !== ":" || !line.left || line.left.type !== "seq" || line.left.terms.length !== 1) return null;
  const t = line.left.terms[0];
  // `#` は公開の印で、名前空間の話（余積の外）。定義する名前は核の名前である。
  if (t.type !== "atom" || t.core.c !== "name" || t.post.length || t.pre.length > 1 || (t.pre.length === 1 && !/^#+$/.test(t.pre[0]))) return null;
  const lambda = unwrapLambda(line.right);
  const def = { name: t.core.name, rhs: line.right, lambda };
  if (lambda) {
    const p = parseParams(lambda.left);
    def.plain = p.plain;
    def.n = p.names.length;
    def.pattern = patternParamsOf(lambda.left);
  }
  return def;
}

// P2：同じ範囲の同じ名前（同じ関数の仮引数どうし）を、解く前に全部見て名指しで断る（name-duplicate。ファイルのいちばん外の2つ目は定義を集める所）。
// 仮引数がファイルの定義や外の関数の仮引数と同じ名前なら、内側が勝つ（2026-11-04 の寄せ3、R133。U〔答え〕[2026-10-29 12:12:33 32fe4b9c]「内側が勝つ」。
// 押したボタンの文は「仮引数も局所の定義も内側が勝つ。断りは information に下げる。」で、文は主の Claude の物）：断らずに information の知らせ name-shadow を出して
// 走る（前は断っていた）。知らせの見つけ方と行は前の断りと同じ（R127。行の粒度は §5 Q85 (n)）。隠す名前1つにつき1つ出し（最初の1つで止めない）、呼ばれない
// 括りの関数の本体でも出す（R25）。外の関数の仮引数とファイルの定義の両方を隠すなら、近い方（外の関数の仮引数）を名指す。
// 仮引数の既定値の中の関数（`p :` ⏎ `⇥⇥x` ⏎ `⇥⇥z : [w : x 3 ? x]` ⏎ `⇥? x`）にも同じ P2 を当てる（寄せ3 で §5 Q85 (m) を閉じた。前は名前でない仮引数（R119）
// だけを見ていた：隠しを断るか決めていなかったため）。既定値の行の右から見える外の仮引数は、前の仮引数まで（lambdaScopes）。
function checkParamNames(lines, F) {
  // 今見ている行（R127）。知らせ name-shadow はこの行を持つ。断りは inRowLine と下の catch が持たせる（同じ行になる）。
  let at;
  const inRow = (row, f) =>
    inRowLine(row, () => {
      const prev = at;
      const l = row && typeof row === "object" ? rowTreeLine.get(row) : undefined;
      if (l !== undefined) at = l;
      try {
        f();
      } finally {
        at = prev;
      }
    });
  const reportShadow = (name, hid) => {
    pushDiag(F, "name-shadow", name, `仮引数 \`${name}\` は${hid} \`${name}\` を隠します。この関数の中の \`${name}\` は仮引数です（内側が勝つ。§4 R133）。`);
    withLine(F.diag[F.diag.length - 1], at);
  };
  // place は木の置き場（R134、2026-11-06 の寄せ5）：def（名前の定義の右辺。ファイルの定義と構造体の欄）・body（関数の本体）・branch（枝の値。本体と枝の値のブロックの
  // `:` の行の右）・default（仮引数のブロックの既定値の値）。字下げのブロックの本体と枝の値は、行ごとに置き場を決める（`:` の行の右は枝の値、ほかの行は本体）。
  // 1行のブロックは、その行の置き場のまま（名前の定義の右辺と既定値の値の `m :` ⏎ `⇥…` も、その行で見る）。括りの中の行は置き場を持たない（欄の右辺はまた def）。
  const visitTree = (t, outer, place) => {
    if (!t) return;
    if (t.type === "seq") {
      if (place && isBlockSeq(t)) {
        const rows = t.terms[0].core.rows;
        if (rows.length === 1 && !(place !== "def" && place !== "default" && isColonRow(rows[0]))) return inRow(rows[0], () => visitTree(rows[0], outer, place));
        if (place === "branch" || place === "body") {
          return rows.forEach((r) => inRow(r, () => (isColonRow(r) ? (visitTree(r.left, outer), visitTree(r.right, outer, "branch")) : visitTree(r, outer, "body"))));
        }
      }
      return t.terms.forEach((term) => visitTerm(term, outer));
    }
    if (t.sym === "?") {
      // R134（2026-11-06 の寄せ5、§5 Q86 を閉じた）：字下げの仮引数のブロックで書いた関数は、名前の定義（ファイルの定義と構造体の欄）の綴り。枝の値（どの深さでも）と
      // 既定値の値（どの関数でも）に置いたら、文法に無い形として読む段でファイルごと止め、そのブロックを持つ `:` の行を名指す（at。R127）。同じ `?` では R119・R131・P2 より先。
      // 本体の入れ子の `?` の右（`f : x ?` ⏎ `⇥⇥y : 1` ⏎ `⇥? x + y`）は当てない（§5 Q88）。
      if (paramBlockLambda(t) && (place === "branch" || place === "default")) throw withLine(refuseParamBlockPlace(t, place), at);
      // R119（2026-11-03 の片イ）：仮引数の並びに名前でない項（`g : x 3 ? x` の 3）があれば、文法に無い形なので読む段でファイルごと止める（問2 の答え、parseRow の注。R .92）。
      // 前は口の数の分からない関数（parseParams の other）として通った。括りの関数の本体の中の `?` も、ここで定義の所で止まる。
      const bad = nonNameParam(t.left);
      const who = F.namedLambdas.has(t) ? `関数 \`${F.namedLambdas.get(t).name}\`` : `関数 \`[${cutShape(writeTree(t))}]\``;
      if (bad) {
        const e = shapeError(
          "param-not-name",
          `${who} の仮引数の並び \`${writeTree(t.left)}\` に、名前でない項 \`${writeTerm(bad.term)}\` があります。仮引数は名前（値の口）か括り（参照の口・残りの並び）で書きます（§3.4・R24）。文法に無い形なので、読む段で止めます（§4 R119）。`,
          "§4 R119"
        );
        // 仮引数のブロックの行なら、その行（R127。2026-11-03 の片イの再確かめの直し：前は `p :` の定義の行を指し、同じブロックの既定値の行の断りと割れた）。
        throw withLine(e, bad.row ? rowTreeLine.get(bad.row) : undefined);
      }
      // R131（2026-11-04 の寄せ2）：仮引数の括り（参照の口）に既定値は書けない。綴りに依らず、読む段でファイルごと止めて、既定値の行を名指す（R127 の行）。
      // P2 より前に見るので、括りの綴りのまま書いた name-duplicate・既定値の中の param-not-name・export-mark-position より先に当たる（この `?` の name-shadow の知らせも出ない）。
      const dflt = bracketDefault(t.left);
      if (dflt) throw withLine(refuseBracketDefault(dflt, who, F.namedLambdas.has(t) ? F.namedLambdas.get(t).name : null), rowTreeLine.get(dflt.row));
      const seen = new Set();
      const { names } = parseParams(t.left);
      for (const { name } of names) {
        if (seen.has(name)) throw nameError("name-duplicate", `仮引数 \`${name}\` が同じ関数に2つあります。`);
        seen.add(name);
        // R133：内側が勝つ。近い方（外の関数の仮引数）を名指す。
        const hid = outer.has(name) ? "外の関数の仮引数" : F.defs.has(name) ? "ファイルの定義" : null;
        if (hid) reportShadow(name, hid);
      }
      visitDefaults(t, outer);
      return visitTree(t.right, new Set([...outer, ...seen]), "body");
    }
    visitTree(t.left, outer);
    visitTree(t.right, outer, t.sym === ":" ? "def" : undefined);
  };
  const visitTerm = (term, outer) => {
    if (!term) return;
    if (term.type === "infix") {
      visitTerm(term.left, outer);
      visitTerm(term.right, outer);
    } else if (term.core.rows) term.core.rows.forEach((r) => inRow(r, () => visitTree(r, outer)));
  };
  // 字下げの仮引数のブロックの行の、既定値（`:` の行の右）。外の仮引数に前の仮引数を足した範囲で見る（R133、lambdaScopes）。2026-11-04 の寄せ2（R131）から、
  // 括りの中の既定値はこの上の bracketDefault が止めるので、括りの中へは降りない（前は括りの行の `:` の右も見ていた）。
  const visitDefaults = (op, outer) => {
    for (const part of lambdaScopes(op)) {
      if (!part.body) inRow(part.row, () => visitTree(part.tree, part.bound.length ? new Set([...outer, ...part.bound]) : outer, "default"));
    }
  };
  for (const line of lines) {
    at = F.rowLines.get(line);
    try {
      visitTree(line, new Set());
    } catch (e) {
      throw withLine(e, F.rowLines.get(line)); // R127
    }
  }
}
// R134（2026-11-06 の寄せ5）：字下げの仮引数のブロックで書いた関数（`?` の左が字下げのブロック1つ）。checkParamNames が置き場を見て断る。
function paramBlockLambda(t) {
  return !!t && t.type !== "seq" && t.sym === "?" && !!t.left && t.left.type === "seq" && t.left.terms.length === 1 && isBareBlock(t.left.terms[0], "indent");
}
function refuseParamBlockPlace(t, place) {
  const where = place === "branch" ? "枝の値" : "仮引数の既定値の値";
  return shapeError(
    "param-block-position",
    `${where}に、字下げの仮引数のブロックで書いた関数 \`[${cutShape(writeTree(t))}]\` があります。仮引数のブロックは名前の定義（ファイルの定義と構造体の欄）の綴りです。関数をファイルの名前の定義にして、その名前を書きます（既定値が無ければ、1行の括り \`[x ? …]\` でも書けます）。文法に無い形なので、読む段で止めます（§4 R134）。`,
    "§4 R134"
  );
}
// 仮引数の並び（`?` の左）の、名前でない項（R119、checkParamNames）。名前・括り（中は見ない）・前置 `~` の項（括りの外の `~xs` は G22 が名指しする、R67）は当たらない。
// 字下げの仮引数のブロックは、項の行の項と `名前 : 既定値` の行の左を見る。並びでない左（`x , y ? …`）は見ない。見つかれば {term, row}（row は仮引数のブロックの行、
// 並びの左なら null）、無ければ null。
function nonNameParam(left) {
  if (!left || left.type !== "seq") return null;
  const ok = (t) => bareName(t) !== null || isBareBlock(t, "bracket") || (t.type === "atom" && t.pre.includes("~"));
  const bad = (terms) => terms.find((t) => !ok(t)) || null;
  if (left.terms.length === 1 && isBareBlock(left.terms[0], "indent")) {
    for (const row of left.terms[0].core.rows) {
      if (!row) continue;
      const hit = row.type === "seq" ? bad(row.terms) : row.sym === ":" && row.left && row.left.type === "seq" ? bad(row.left.terms) : null;
      if (hit) return { term: hit, row };
    }
    return null;
  }
  const hit = bad(left.terms);
  return hit ? { term: hit, row: null } : null;
}

// R131（2026-11-04 の寄せ2）：仮引数の括りに書いた既定値（checkParamNames）。既定値は字下げの仮引数のブロックの `名前 : 既定値` の行に書き（ファイルの名前の定義・
// 構造体の欄。枝の値のブロックと仮引数のブロックの既定値の値の関数は、2026-11-06 の寄せ5（R134、§5 Q86 を閉じた）から読む段の param-block-position で止まる）、括りは
// 参照の口（呼ぶ側の器を指す口）なので既定値を持たない。当てるのは2つ（並びでない左 `x , [y : 1]`・演算の行・前置の印の付いた括り・中置の項の中も、findTree が見る）：
//  - inside：仮引数の括り（`[…]`・`(…)`。前置の印に依らない）の中のどこか（入れ子の括りも）に `:` がある。`?` の左の並びの項（1行の `gq : x [y : 1] ? x + y`・
//    重ねた `[[y : 1]]`・丸い `([y : 1])`・`[~y : 5]`・`[#z : 1]`・`[y : _]`・名前の無い `[x [y : 1] ? x + y]`）と、仮引数のブロックの行の項（`⇥⇥[y : 1]`・複数行の括りの
//    中の行・カンマの `[foo, bar : foo * 2, ~obj]`）。`:` の有無は、前に既定値のある口に数えていた所（defaultsSlots の withDefault）と同じ treeHasColon で見る。
//  - left：仮引数のブロックの `:` の行で、左に括りがある（`[x ~xs] : [1 2 3]`・`[y] : 1`・`(y) : 1`。function_guide.md の「分解の形の仮引数にデフォルト値は書けない」）。
// 当てない物：中に `:` の無い括り（参照の口 `[a b c]`・`[x ~xs]`・`[[a b] c]`）と、ブロックの既定値の右辺（`z : [a : 1]` の `[a : 1]`。右辺へは降りない）。
// 根拠：U〔答え〕[2026-10-29 13:04:19 32fe4b9c]「外して断る」、U〔答え〕[2026-11-04 06:36:16 159479c9]「断る」（複数行の括りの中の欄の既定値も）、
// U [2026-11-04 06:42:23 159479c9]「参照の口は、既定値を取れない。 / 理由は、アドレスの直差しをしたければ、本当にアドレスを渡せという話になると考えてる。」。
// D documents/ja-jp/guide/pattern_guide.md:49「括りの中の仮引数には既定値を書けない（利用者 2026-10-18）」。
// 見つかれば {term, row, kind, block}（term は名指す括り、row は名指す行で R127 の行を引く、kind は "inside" か "left"、block は `?` の左が字下げの仮引数の
// ブロックか）、無ければ null。
function bracketDefault(left) {
  if (!left) return null;
  const isBracket = (t) => !!t && t.type === "atom" && t.core.c === "bracket";
  const inside = (t) => (isBracket(t) && t.core.rows.some(treeHasColon) ? { term: t, row: colonRowIn(t.core.rows), kind: "inside" } : null);
  // 木の項（中置の両側も。括りの中へは降りない：中は inside が見る）を左から見て、f が返した最初の物。
  const findTerm = (term, f) => (!term ? null : term.type === "infix" ? findTerm(term.left, f) || findTerm(term.right, f) : f(term));
  const findTree = (tree, f) => {
    if (!tree) return null;
    if (tree.type === "seq") {
      for (const term of tree.terms) {
        const h = findTerm(term, f);
        if (h) return h;
      }
      return null;
    }
    return findTree(tree.left, f) || findTree(tree.right, f);
  };
  if (left.type === "seq" && left.terms.length === 1 && isBareBlock(left.terms[0], "indent")) {
    for (const row of left.terms[0].core.rows) {
      if (!row) continue;
      if (isColonRow(row)) {
        // 既定値の行：左の括りは left、右辺（既定値）へは降りない。
        const b = findTree(row.left, (t) => (isBracket(t) ? t : null));
        if (b) return { term: b, row, kind: "left", block: true };
        continue;
      }
      const h = findTree(row, inside);
      if (h) return { ...h, block: true };
    }
    return null;
  }
  const h = findTree(left, inside);
  return h ? { ...h, block: false } : null;
}
// 括りの行 rows の中で、`:` を持ついちばん内の行（R127 の行の粒度。入れ子の括りの中の行も）。行の木でない所の `:` なら、それを含む行。
function colonRowIn(rows) {
  for (const row of rows) {
    if (!treeHasColon(row)) continue;
    if (isColonRow(row)) return row;
    return innerColonRow(row) || row;
  }
  return null;
}
function innerColonRow(tree) {
  if (!tree) return null;
  if (tree.type === "seq") {
    for (const term of tree.terms) {
      const r = termColonRow(term);
      if (r) return r;
    }
    return null;
  }
  return innerColonRow(tree.left) || innerColonRow(tree.right);
}
function termColonRow(term) {
  if (!term) return null;
  if (term.type === "infix") return termColonRow(term.left) || termColonRow(term.right);
  return term.core.rows ? colonRowIn(term.core.rows) : null;
}
function refuseBracketDefault(hit, who, name) {
  const term = cutShape(writeTerm(hit.term));
  const row = cutShape(writeTree(hit.row));
  const slot = isColonRow(hit.row) ? singleBareName(hit.row.left) : null;
  // 書き直す先。既定値が `_` と書いた綴り（`[y : _]`・`[y] : _`。書いた `_`・単位律で `_` に縮む綴り）なら、既定値の行へ移しても R114（G22）が断るので、口の綴りを
  // 見せる（§4 R114。寄せ2 の確かめの直し）。ファイルの名前の定義なら、その名前で書き直す先を見せる。`?` の左がもう字下げの仮引数のブロック（構造体の欄と、
  // R134 が当てない置き場（§5 Q88）。枝の値・既定値の値そのものの関数は、2026-11-06 の寄せ5 から同じ `?` で R134 の param-block-position が先に当たる）なら、
  // そのブロックの行を言う。ほか（括りの `?`・`$[…]`）は仮引数のブロックの綴りが無いので、名前の定義にするよう言う。
  const unitRhs = isColonRow(hit.row) && (isUnitRhs(hit.row.right) || unitSpelled(hit.row.right));
  const where = unitRhs
    ? slot && hit.kind === "inside"
      ? `既定値に \`_\` を置く口は要りません。値で受けるなら \`${slot}\`（値の口）、参照で受けるなら \`[${slot}]\`（参照の口）と書きます（§4 R114）`
      : `既定値に \`_\` を置く口は要りません。参照で受けるなら \`${term}\` とだけ書きます（§4 R114）`
    : name
      ? `既定値は、字下げの仮引数のブロックの行に書きます（\`${name} :\` ⏎ \`⇥⇥${slot ? row : "名前 : 既定値"}\` ⏎ \`⇥? …\`）`
      : hit.block
        ? "既定値は、この仮引数のブロックの `名前 : 既定値` の行に書きます"
        : "既定値は、字下げの仮引数のブロックの行（`名前 : 既定値`）に書きます。括りの `?` と `$[…]` には仮引数のブロックの綴りが無いので、既定値を使うなら名前の定義にします";
  const what =
    hit.kind === "left"
      ? `${who} の仮引数のブロックの行 \`${row}\` は、括り \`${term}\` に既定値を付けています。`
      : `${who} の仮引数の括り \`${term}\` に、既定値の行 \`${row}\` があります。`;
  return shapeError(
    "param-default-bracket",
    `${what}括りは参照の口（呼ぶ側の器を指す口）で、既定値を持ちません。番地を直に指したいなら、呼ぶ側が番地を渡します。${where}。文法に無い形なので、読む段で止めます（§4 R131）。`,
    "§4 R131"
  );
}

// R119（2026-11-03 の片イ）：前置 `#` は公開の印で、定義する名前（1項の `:` の左）に付ける（asDefinition・isNameTarget）。使う所の前置 `#` の項（`#zq 5`・`5 #zq`・
// `[#_] 5`）の読みは決まっていない（§5 Q10・Q33）。前は種類の決まらない項として並びで G7、1項なら未知で通った。文法に無い位置なので、読む段でファイルごと止める
// （問2 の答え、parseRow の注。1項の `#zq`・`p : #zq` も止めるのは R .60）。`?` の左の仮引数（P3。名前でない項は checkParamNames が止める）と1項の `:` の左の名前
// （定義する名前・欄の名前、P3。isNameTarget）は見ない。2026-11-03 の片イの確かめの直し：既定値（`[z : #zq]`・仮引数のブロックの `z : #zq` の行）と、名前でない1項の
// `:` の左（枝の条件 `(#zq 1) : 1`）も使う所なので見る（前は `?` の左と1項の `:` の左を丸ごと飛ばして通った。HEAD も通っていた）。
// 2026-11-04 の寄せ1（R128）から、関数の本体（と枝の値のブロック）の `:` の行は枝で、左は1項でも名前1つでも使う所（`&` の左と同じに解く）なので、全部見る
// （`⇥#x : 5` の `#x` も。visitBody）。
function refuseExportMarkUse(lines, F) {
  const visitTree = (t) => {
    if (!t) return;
    if (t.type === "seq") return t.terms.forEach(visitTerm);
    if (t.sym === "?") {
      visitDefaults(t.left);
      return isSection(t) ? visitTree(t.right) : visitBody(t.right);
    }
    if (t.sym === ":" && t.left && t.left.type === "seq" && t.left.terms.length === 1) {
      if (!isNameTarget(t.left.terms[0])) visitTerm(t.left.terms[0]);
    } else visitTree(t.left);
    visitTree(t.right);
  };
  // 関数の本体：字下げのブロックなら、`:` の行は枝（左も見て、右が字下げのブロックなら枝の値のブロックとして同じに見る）。
  const visitBody = (right) => {
    if (!isBlockSeq(right)) return visitTree(right);
    for (const row of right.terms[0].core.rows) {
      inRowLine(row, () => {
        if (!isColonRow(row)) return visitTree(row);
        visitTree(row.left);
        visitBody(row.right);
      });
    }
  };
  // 字下げの仮引数のブロックの行の、既定値（`:` の行の右）だけを見る。括りの中の既定値は、先に checkParamNames が止める（R131、2026-11-04 の寄せ2）。
  const visitDefaults = (left) => {
    if (!left || left.type !== "seq" || left.terms.length !== 1 || !isBareBlock(left.terms[0], "indent")) return;
    for (const row of left.terms[0].core.rows) {
      inRowLine(row, () => {
        if (isColonRow(row)) visitTree(row.right);
      });
    }
  };
  const visitTerm = (term) => {
    if (!term) return;
    if (term.type === "infix") {
      visitTerm(term.left);
      visitTerm(term.right);
      return;
    }
    if (term.pre.some((p) => /^#+$/.test(p))) {
      throw shapeError(
        "export-mark-position",
        `前置 \`#\` の項 \`${writeTerm(term)}\` が使う所にあります。\`#\` は公開の印で、定義する名前に付けます（\`#名前 : …\`）。使う所の前置 \`#\` の読みは決まっていない（§5 Q10・Q33）ので、読む段で止めます（§4 R119。前は並びの中で G7）。使うなら \`#\` を付けずに名前で書きます。`,
        "§4 R119"
      );
    }
    if (term.core.rows) term.core.rows.forEach((r) => inRowLine(r, () => visitTree(r)));
  };
  for (const line of lines) {
    try {
      visitTree(line);
    } catch (e) {
      throw withLine(e, F.rowLines.get(line)); // R127
    }
  }
}

// 括りと、関数の本体でない字下げのブロック（構造体）の行で `:` の左に1語で置かれた名前（P2、blockScope）。仮引数でもファイルの定義でもなければ、その範囲の名前
// （欄の名前）に数える。種類は今のまま未知（括りの行は欄か局所の定義か決まっていない、local-field。§5 Q10）。入れ子の関数の本体は数えない。
// 2026-11-04 の寄せ1（R128）から、関数の本体の範囲（makeLambda）では数えない：本体の字下げの `:` の行は左が何でも枝（match_case）で、本体に局所の定義は無い
// （U〔答え〕[2026-10-29 12:18:19 32fe4b9c]「ガイドに戻す」）。前（2026-10-26 の R80）は、枝の無い本体の左が名前1つの `:` の行を局所の定義と読み、その名前を
// 関数の範囲に数えていた（局所の名前の読みと隠しの見張り、localInfo・localDefsOf は寄せ1 で外した）。
function scanLocals(tree, scope, F) {
  if (!tree) return;
  if (scope.erasedRows && scope.erasedRows.has(tree)) return; // 書かなかったことにした構造体の欄 `x : _` の行（R113、erasedFieldRows）
  if (tree.type === "seq") return tree.terms.forEach((t) => scanLocalsTerm(t, scope, F));
  if (tree.sym === "?") return;
  if (tree.sym === ":") {
    const n = singleBareName(tree.left);
    if (n) {
      if (!paramInChain(scope, n) && !F.defs.has(n) && (scope.field || !localInChain(scope.parent, n))) scope.locals.add(n);
    } else scanLocals(tree.left, scope, F);
    return scanLocals(tree.right, scope, F);
  }
  scanLocals(tree.left, scope, F);
  scanLocals(tree.right, scope, F);
}
function scanLocalsTerm(term, scope, F) {
  if (!term) return;
  if (term.type === "infix") {
    scanLocalsTerm(term.left, scope, F);
    scanLocalsTerm(term.right, scope, F);
  } else if (term.core.rows) {
    // 入れ子の構造体の、右辺が書いた `_` だけの欄（R113）は書かなかったことと同じなので、外の範囲（外の括り）の名前にも数えない（2026-10-28 の片9b の
    // 確かめの直し。前は外の範囲が欄の名前を局所の名前に数え、`t9 : y ? hs [s : _]` の s が t9 の局所の名前になっていた）。
    const erased = erasedFieldRows(term.core.rows);
    for (const r of term.core.rows) if (!erased || !erased.has(r)) scanLocals(r, scope, F);
  }
}
function paramInChain(scope, name) {
  for (let s = scope; s; s = s.parent) if (s.params && s.params.has(name)) return true;
  return false;
}
function localInChain(scope, name) {
  for (let s = scope; s; s = s.parent) if (s.locals && s.locals.has(name)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// 種類
// ---------------------------------------------------------------------------
//
// desc：{k:'A'|'L'|'U', fn?, spread?, elements?, shape?}
//   fn（L のとき）：
//     {type:'plain', origin:'plain'|'partial'|'hole', n, getBodyRoot, idKey, rest?, restAt?}  素の関数・部分適用・穴（§3.4）。穴の
//       部分適用は 'hole' のまま（partialFn）。rest は R34 の k < n で作った穴の関数とその部分適用（holeMismatch）で、restAt は最後の
//       括り `[~c]` の前に残る裸の口の数
//     {type:'pattern', n, idKey, label, op, scopeKey, lastBracket, bareAt, instantiate}  括りの関数（R24）。n は仮引数の数
//       （括りは1つで1）。lastBracket は最後の仮引数が括りの関数（最後の括りは可変長の口で、残りの並び全体を1つの List として
//       受ける、fnShape・closeKind）。bareAt は仮引数ごとに裸か。op と scopeKey は書いた `?` と、それを解いた範囲（定義の行の木に、
//       その `?` を通って呼ばれた実体だけを描くため）
//     {type:'pattern', n, label, lastBracket, base, bound, instantiate}  括りの関数の部分適用（patternPartial）。n は残りの
//       仮引数の数、base は元の括りの関数、bound は当てた物の desc（前から）。instantiate は bound を前に足して base の
//       実体を作る。鍵は idKey ではなく base の出どころと当てた物の形（internPartial）
//     {type:'pfUnary'|'pfGreedyUnary'|'pfUnknownArity', pointfree:true}  点なし（§2、pointfreeOf の注）
//     {type:'pfFold', pointfree:true, sym}  畳む2項の点なし（`[+]`・`[&]`・`[<]` など、R31）。sym は書いた記号
//     {type:'pfBinary', pointfree:true, sym, n, root}  畳まない2項の点なし（`[<<]`・`[']`・`[!=]` など、R32）。素の2引数の
//       関数と同じに読む。n は残りの口の数（書いたままなら 2、1つ当てた足りない適用なら 1）、root は足りた適用の種類（値を
//       返す演算は 'A'、get・set は 'U'）
//     {type:'pfPick', pointfree:true, sym, key}  段18 の点なし。key は `[' 0]`・`[' say]` の鍵（R26）、ほかは null
//     {type:'compose', fns, partial}  合成（`||f||` は f の後に norm を並べた合成、R27）
//     {type:'id'}  穴 `!_` 1つ（恒等射、§3.5）。並び全体を受ける
//     {type:'norm'}  ノルム（`||f||` の合成の最後の関数。1つ受けて A、R27）
//     {type:'input'}  頭の前置 `@`
//     {type:'other', defaults?, n?}  アリティの分からない関数。既定値のある関数は defaults と仮引数の数 n を持つ（otherFn）
//   idKey：関数の出どころ（書いた `?` の綴りと、定義した所の範囲の鍵）。実体の鍵（fnKey）に使う。
//   envDepth：定義した所の範囲の、いちばん内の実体の深さ（無ければ 0）。鍵の深さ（fnDepth、実体の深さの守り）に使う。
//     pfGreedyUnary は map を持つことがある：`[F,]` の写像（R50）。map は `,` の左の、口が1つ残った関数の fn
//   ref（A のとき）：関数を指す番地の印（R49）。`$名前`（名前が関数）・`$[…]`（括りが関数）の desc は A のまま、
//     指す関数の fn を ref に持つ。`@x` の x の desc に ref があれば、`@x` は L でその fn（refOf・classify）。括りの関数の実体で裸の
//     仮引数に渡れば、仮引数の desc に持ち越し、実体の鍵に入る（bindParams・internDesc）。
//   spread：後置 `~` で撒く項。of は撒いた器の desc（R51 の書き下しと畳み込み・`[f,]` の写像が要素の desc を読む、elemsOfContainer）。elements：中身の
//     見える器の要素の種類（§2「中身が見える器」）。
//   shape（A のとき）：中身の形（R24）。{s:'struct', fields:[{name, desc}]}・{s:'list', elem}・{s:'scalar'}（数）。無ければ
//     中身の見えない A。
//     shape のある desc は、いつも elements も持つ。elements は撒く項の門（§3.3 の手順1）が見る「中身に L か未知が
//     見えるか」で、shape から読める答えと食い違わないようにする（elementsOfShape・deepKind）。

const A = () => ({ k: "A" });
const U = () => ({ k: "U" });
// 関数を指す番地の desc（R49）なら、その desc。ほかは null。
const refOf = (d) => (!!d && d.k === "A" && !d.spread && !d.shape && !!d.ref ? d : null);
// 値を読む参照（R60、2026-10-25。`$名前` の名前が値・`$[…]` の中身が値・`$5` の字面）の desc なら、その desc。ほかは null。
// 参照は値（A）で、指す値の desc を vref に持つ（`@x` の x に vref があれば、`@x` はその値。番地は読む環境の実装の1つで、意味には出ない）。
const vrefOf = (d) => (!!d && d.k === "A" && !d.spread && !d.shape && !!d.vref ? d : null);
// 番地の点と差（R62、2026-10-26。§5 Q59 の答え）のうち、算術で作った物の desc なら、その desc。ほかは null。印 addr は 'pt'（点をずらした点：
// `$x + 0x10`）か 'diff'（点どうしの差：`$foo - $bar`）。どちらも Address 型の値（A）で、Int・UInt と混ぜない。ずらした点が指す物は解決器の段では
// 分からない（差が指す物の要素の幅の倍数かと一緒に型の段で決まる）ので、指す値の印 vref は持たない（`@` で開けば G21、§5 Q66）。
const addrOf = (d) => (!!d && d.k === "A" && !d.spread && !d.shape && (d.addr === "pt" || d.addr === "diff") ? d : null);
// 番地の顔（R62）：値を読む参照（R60 の vref）とずらした点は 'pt'（点）、点どうしの差は 'diff'（差）。ほかは null。関数を指す番地（ref）は顔に数えない
// （1つの関数と言い切れる番地で、動かす・比べるのは R53 の外。G7）。
const addrFace = (d) => (vrefOf(d) ? "pt" : addrOf(d) ? d.addr : null);
// R97（2026-10-27 の片7）：番地の点の要素の幅 w（幅の倍数の門、addressOp）。
// - w：点の指す要素の幅（byte）が木の段で分かるとき。分かるのは、値を読む参照の先が数（Int）の要素だと書いた所から分かるとき（`v : 5` の `$v`・
//   `vs : 1 , 2 , 3` の `$vs`・`$5`・`$[1 2]`。intTree、classifyDollar が付ける）と、それを書いた時点で値の決まる差（`0x…` の字面とその畳み込み、hexOperand）で
//   ずらした点。幅は Int の語の 8 byte（INT_WORD）。主の Claude の読み（R）：利用者は `$vs + 0x3` を「通るのはダメ」と答えた（U〔答え〕[2026-10-27 12:46 58a809c9]）
//   ので、数の要素の幅は 3 の約数ではない。言語の Int は 64 bit の語なので 8 と置く。値の決まらない差（点 − 点の差・仮引数・実行時の値）でずらした点は w を持たない。
// - 差の書いた時点の値は desc に持たない：書いた時点で値の決まる差は `0x…` の字面とその `+`・`-` の畳み込みだけで、`0x…` の顔は置かれた所で書いた綴りから見る
//   （hexOperand、R62）。だから値も同じ所で綴りから読む（同じ日の確かめの直し。最初の版は畳み込みの答えに差の印と値を持たせ、仮引数・器で値を落として門を素通りした）。
// w は名前（`:` はメタ）・括り1つ（[x] ≅ x）・消えた余りのラムダの残り1項・中置の鎖と、点の顔と同じ所（括りの関数の実体の裸の仮引数と欄・揃った器の要素、R62）に
// 運び、実体の鍵に入れる（同じ日の確かめの直し。最初の版は仮引数と器に運ばず、`hb [1] $vs`（hb は `[k] f ? (f + 0x3) == $vs`）が、本体に書き込んだ
// `($vs + 0x3) == $vs`（断る）と割れて通った）。鍵に入れないと、`hb [1] $vs` と `hb [1] $st` が実体を分け合い、先に解いた方の答えを後の方が使う。
const INT_WORD = 8;
const ptWidthOf = (d) => (!!d && (vrefOf(d) || (addrOf(d) && d.addr === "pt")) && d.w) || null;
// 幅 w を外した desc（揃った器の要素を比べる所、mergeElems）。顔（pt・diff・vref）はそのまま。
function withoutWidth(d) {
  if (!d || typeof d !== "object" || d.w === undefined) return d;
  const { w, ...rest } = d;
  return rest;
}
// `$` が作った物（関数を指す番地か、値を読む参照）と、R62 の番地の算術で作った物（ずらした点・差）。`$` が作った物は1つの Reader（R60）で、数では
// ない。実体の鍵に入れ（裸の仮引数でも、bindParams・internPartial）、素の関数の口に渡せば札で見て（readerAtPlain）、写像では1つの要素（elemsOfContainer）。
// 2026-10-27 の片8 から、先の種類の分からない持ち上げ（印 lift、liftOf）も `$` が作った物に数える（実体の鍵・素の関数の印・撒く所の R57・素の関数の口）。
const liftOf = (d) => (!!d && d.k === "A" && !d.spread && !d.shape && !!d.lift ? d : null);
const readerOf = (d) => refOf(d) || vrefOf(d) || addrOf(d) || liftOf(d);
// 書いた `_` を指すと分かっている値（R63、2026-10-26。§5 Q64 の答え）：欄の右辺の `_`（`[s : _]`）・`_` だけの括り（`[_]`）・書いた `_` を右辺に持つ
// ファイルの値の定義の名前（`un : _`）の desc に印 zero を付け、括りの関数の実体へ欄・要素・裸の仮引数で渡しても持ち越す（実体の鍵 `_`）。実体の中の
// `$s` は、`$_` と同じ零射 `$[x ? _]` の番地（dollarNameTarget）。印の無い形の見えない値は、今のまま `_` か言い切れない（G20）。
// 2026-10-28 の片9b から、取り込みの無い範囲の未定義の名前（R111）・無い欄の名前と無い欄を引いた物（R115）も印 zero を持つ。欄の `[s : _]` は R113 で書かなかったことと
// 同じ（`[]`）なので、印 zero の欄にはならない。値の口に着いた印 zero の名前と括りは、書いた `_` と同じに読む（R112、isKnownUnitItem）。
const zeroOf = (d) => (!!d && d.k === "A" && !d.spread && !d.shape && !!d.zero && !d.ref && !d.vref && !d.addr ? d : null);
const zeroDesc = () => ({ k: "A", zero: true });
// 番地の算術で作った点・差（R62）が、desc の中のどこか（それ自身・揃った器の要素・欄）にあるか（2026-10-26 の確かめの直し）。点・差の印を落とさずに
// 運べるのは、名前（`:` はメタ）・括り1つ（[x] ≅ x。消えた余りのラムダの残り1項も、vanishedOne）・括りの関数の実体の裸の仮引数と欄・揃った器の要素と、
// 中置の値の演算子（addressOp）だけである。印を落とす所に入ると、答えは中身の見えない値になり、数と黙って混ざる（`gi : y ? y` ⏎ `(gi ($x + 0x10)) + 1`。
// HEAD は中の算術を G7 で断っていた）。だから印を落とす所に入る所で断る（§5 Q66）：関数の答え（resolveBody。字下げの本体の枝の値も）・
// 素の関数の口（readerAtPlain）・論理の `;` `|` `&` と書き込み `#` の被演算子（resolveTree）・要素の形の揃わない器（mergeElems）・括りの仮引数に直に渡した物
// （bindParams）。値を読む参照（`$vs`、vref）は R60 の届かない所のまま（§5 Q66 の届かない所）。
function hasAddr(d, depth = 0) {
  if (!d || depth > 32) return false;
  if (addrOf(d)) return true;
  const sh = d.k === "A" && !d.spread ? d.shape : null;
  if (!sh) return false;
  if (sh.s === "list") return hasAddr(sh.elem, depth + 1);
  if (sh.s === "struct") return sh.fields.some((f) => hasAddr(f.desc, depth + 1));
  return false;
}
// 解いた木の値に番地の算術で作った点・差があるか（hasAddr。構築の中の消えた余りのラムダは消してから見る、descOfTree）。
const treeHasAddr = (t) => !!t && hasAddr(descOfTree(t));

// 素の関数の裸の仮引数の印（R60 の細かい所。2026-10-25 の確かめの直し。2026-10-26 の R62 から、番地の点と差を口に渡した物は G21、関数を指す番地は G7、
// §5 Q66）。素の関数は実体を作らず、本体を1回だけ、裸の仮引数を A として
// 解く（§3.4）ので、`inc $5` の本体の `x + 1` は Reader を見ない。β で `inc $5` は `$5 + 1` と同じ形なので、本体を解く所で、裸の仮引数の desc に
// 印 pv（その関数の書いた `?` と仮引数の位置の札）を付け、札に「値の演算子の被演算子に置かれた（numeric）」と「別の素の関数の口へそのまま渡された
// （edges）」を覚える。Reader を素の関数の口に渡した呼び出しは、札から値の演算子に届くなら G7（readerAtPlain）。
// - 札は関数の出どころ（書いた `?` と定義した範囲の鍵、fn.idKey）ごと・位置ごとに1つ（paramTag）。括りの関数の実体の本体に書いた無名の `?` は、実体ごとに
//   範囲の鍵が違うので別の札になる（実体ごとに本体の読みが違いうるので、札を分け合うと、先に解いた実体の答えを後の実体が使い、答えが定義の順で割れる）。
//   同じ出どころの本体を何度解いても同じ札に足す（覚えるのは「どこかで置かれた」だけ）。
// - 札は実体に持ち込まない（bindParams が外す）：実体は鍵で分け合われ、本体は1回しか解かないので、持ち込むと先に呼んだ側の札だけに覚え、
//   答えが定義の順で割れる。
// - 届かない所（決めずに残した。2026-10-26 から §5 Q66）：素の関数が返した値（`id2 : x ? x` の `id2 $5` の結果）・本体の中で器に入れた物・括りの関数や既定値のある
//   関数や前置 `@` の項の口へ渡した物・穴の関数（`f3 !_ 2`）の口。どれも、器の中身に値の演算子を当てる形（`(inc , 1) + 1` は今も A）と同じく、
//   値の演算子が直に見ない所である。2026-10-26 の確かめの直しから、番地の算術で作った点・差については、印を落とす所に入る所で断る（hasAddr の注）。
//   値を読む参照は今のまま届かない。
// - 2026-10-26 の R81（§5 Q45 の答え）から、印のある実引数（関数の番地・値を読む参照・番地の点と差・書いた `_`）で呼んだ素の関数は、その印で実体を作り、本体の中の
//   規則（addressOp・refuseReaderOperand・括りの関数の口へ渡した物の実体）で読む（monoKind）。札で見る（readerAtPlain）のは、印を持たない実引数（番地の点・差を
//   中に持つ器）だけになった。穴の関数の口に書いた物・後から当てた物も、同じ日の確かめの直しから、頭の素の関数の実引数に並べ直して実体を作る（holeFnOf）。
const PARAM_TAGS = new WeakMap();
function paramTag(op, key, i) {
  let m = PARAM_TAGS.get(op);
  if (!m) PARAM_TAGS.set(op, (m = new Map()));
  const k = `${key}#${i}`;
  let t = m.get(k);
  if (!t) m.set(k, (t = { op, i, numeric: false, edges: new Set(), fn: null }));
  return t;
}
// 値の演算子 sym の被演算子の desc d（R60 の細かい所、R62）：関数を指す番地なら G7、番地の点・差（値を読む参照・ずらした点・差）なら G21 で断り
// （中置の `+`・`-`・比べは、ここより前に addressOp が点と差の規則で読む。ここに来るのは中置の外の綴り：区間・点なし・絶対値・値の印と、R62 で
// 決めていない中置の記号は addressOp が先に断る）、素の関数の裸の仮引数（印 pv）なら札に覚える。text は断るときの被演算子の綴り（作るのは断るときだけ）。
function valueOperand(d, sym, text) {
  if (!d) return;
  if (refOf(d)) throw refuseReaderOperand(sym, text());
  if (liftOf(d)) throw refuseLiftOperand(sym, text());
  // 番地の点・差と、算術で作った点・差を中に持つ器（hasAddr、2026-10-26 の確かめの直し。operandFace の box と同じ）。
  if (addrFace(d) || hasAddr(d)) throw refuseAddressSpelling(sym, text());
  if (d.pv) d.pv.numeric = true;
}
// 札 tag の仮引数が、本体から（別の素の関数の口を通っても）値の演算子の被演算子に届くか。届く先の本体がまだ解かれていなければ解く（解けなければ
// 届かないと見る。門は、その定義の行で出る）。
function numericParam(tag) {
  const seen = new Set();
  const walk = (t) => {
    if (seen.has(t)) return false;
    seen.add(t);
    if (t.fn && t.fn.getBodyRoot) {
      try {
        t.fn.getBodyRoot();
      } catch (e) {
        if (!(e instanceof OperationError)) throw e;
      }
    }
    if (t.numeric) return true;
    for (const u of t.edges) if (walk(u)) return true;
    return false;
  };
  return walk(tag);
}
// 実体に持ち込む desc から、素の関数の裸の仮引数の印を外す（paramTag の注）。器の形の要素・欄（shape）の中の印も外す（`hb [s : x]` の欄 s）。
const STRIP_MEMO = new WeakMap(); // 同じ desc を指す欄は、外した後も同じ desc を指す（hasTag の注）
function stripTag(d) {
  if (!d || typeof d !== "object" || !hasTag(d)) return d;
  const memo = STRIP_MEMO.get(d);
  if (memo) return memo;
  const { pv, ...rest } = d;
  STRIP_MEMO.set(d, rest);
  if (rest.shape) rest.shape = stripShapeTag(rest.shape);
  if (rest.vref) rest.vref = stripTag(rest.vref);
  if (rest.of) rest.of = stripTag(rest.of);
  return rest;
}
function stripShapeTag(sh) {
  if (sh.s === "struct") return { ...sh, fields: sh.fields.map((f) => ({ ...f, desc: stripTag(f.desc) })) };
  if (sh.s === "list" && sh.elem) return { ...sh, elem: stripTag(sh.elem) };
  return sh;
}
// 形は欄どうしで同じ desc を指す（`m1 : [p : m0 ⏎ q : m0]`、internDesc の注）ので、desc ごとに答えを覚える（覚えないと入れ子の深さで指数になり、
// 再帰の `f [p : r ⏎ q : r]` が止まらなかった。作る途中に見つけた）。desc は作った後に書き換えないので、覚えた答えは古くならない。
const TAG_MEMO = new WeakMap();
function hasTag(d) {
  if (!d || typeof d !== "object") return false;
  if (d.pv) return true;
  const memo = TAG_MEMO.get(d);
  if (memo !== undefined) return memo;
  TAG_MEMO.set(d, false); // 輪の守り
  const sh = d.shape;
  const out =
    (!!d.vref && hasTag(d.vref)) ||
    (!!d.of && hasTag(d.of)) ||
    (!!sh && (sh.s === "struct" ? sh.fields.some((f) => hasTag(f.desc)) : sh.s === "list" && !!sh.elem && hasTag(sh.elem)));
  TAG_MEMO.set(d, out);
  return out;
}

// ---- 形（R24・R26） ----
//
// 形は「渡された物の生まれ」を書く。構造体は、全部の行が `名前 : 値` の括りか字下げのブロック（rowsShape）。List は、
// 構築の並び・`,` の並び・2行以上の値の括りか字下げのブロック（1行が1要素、rowsShape）・文字列の字面。数（SCALAR）は
// 長さ1の List と同型。それ以外は中身の見えない A（shape なし）。
// List の要素の desc は長さに依らない（mergeElems）。長さを形に入れると、再帰で長さごとに実体ができ、`f [1 2 3]` と
// `f [1 2]` が別の実体になる（R24「同じ形なら同じ実体」に反する）。

// 器の1つの要素の、深く見た種類（elementKind と同じ答え）。A でも、中身に L か未知が見えれば U。
function deepKind(d) {
  if (!d || d.k !== "A") return d ? d.k : "U";
  if (d.elements) return d.elements.some((k) => k !== "A") ? "U" : "A";
  if (d.shape) return elementsOfShape(d.shape).some((k) => k !== "A") ? "U" : "A";
  return "A";
}
function elementsOfShape(shape) {
  if (shape.s === "scalar") return ["A"];
  if (shape.s === "struct") return shape.fields.map((f) => deepKind(f.desc));
  return shape.elem ? [deepKind(shape.elem)] : [];
}
function withShape(shape) {
  return { k: "A", shape, elements: elementsOfShape(shape) };
}

// 数（R24）：数・文字の字面と、それに値の印（`-`・`!!`・後置 `!`）や値の演算子（段13〜16・19〜22）を当てた物。前置 `!` は
// 入れない（`!_` は恒等射なので、`!x` は `_` か関数で、数にならない。classify の値の印の枝）。
// `[x]≅x` なので長さ1の List と同型で、括りで受ければ名前はその数、`~rest` は同じ要素の List（利用者 2026-10-19
// 「数や `[3]` を `[x ~xs]` に渡したら、長さ1の List（x は 3、xs は空）として分解していい？」に「それでいいはずだよ」）。
// 中身の見えない A（裸の仮引数・適用の結果・`$` の番地）は数と決まっていないので、ここに入れない：器かもしれず、
// 器なら要素に関数が見えるかもしれない。段12（`~` の範囲）は List を作るので数にしない。
// 番地の字面（`0x…`・`NxHHHH`）も入れない。R24 の数は「数・文字の字面」で、§2 の字面の行は番地を数と別に挙げ、
// 型でも番地の字面は `$` が返す値と同じ Address（type_system.md §2 の Atom 内部型）なので、指す先が器かもしれない
// のは `$` の番地と同じである。数と決めると、番地を受けた名前を黙って値と読む（数の確かめ 2026-10-19 の F1）。
// `0r`・`0b` は符号なしの数（UInt）、`0u` は文字（Char）なので数に入れる。
const SCALAR = { s: "scalar" };
const scalarDesc = () => ({ k: "A", shape: SCALAR, elements: ["A"] });
const isScalar = (d) => !!d && d.k === "A" && !d.spread && !!d.shape && d.shape.s === "scalar";
const SCALAR_INFIX_STAGES = new Set([13, 14, 15, 16, 19, 20, 21, 22]);
// 番地の字面（sign.pegjs の address と同じ形）。
const ADDRESS_LIT = /^[0-9]+x[0-9a-fA-F]+$/;

// List の要素の desc。要素の形が全部同じならそれ、全部 A だが形が違えば中身の見えない A、中身に L か未知が見え
// れば U（R24「要素に L が見えたら、名前は未知」。既存の elements が深く見て U にするので、それと揃える）。
function mergeElems(descs) {
  if (!descs.length) return null;
  if (descs.some((d) => deepKind(d) !== "A")) return U();
  const k0 = internDesc(descs[0]);
  if (descs.every((d) => internDesc(d) === k0)) return descs[0];
  // 点の幅（R97）だけが違う要素（`[($vs + 0x8) ($vs + ($five - $vs))]`）は、幅を外して揃える（ptWidthOf の注。幅の分からない点が混ざれば、要素の幅は分からない）。
  // 幅の分からない側へ倒すので、要素から引いた点は幅の門を見ない（断らない側。§5 Q77）。
  const bare = descs.map(withoutWidth);
  const b0 = internDesc(bare[0]);
  if (bare.every((d) => internDesc(d) === b0)) return bare[0];
  // 番地の算術で作った点・差（R62）を、形の揃わない要素と並べた（2026-10-26 の確かめの直し）：要素は中身の見えない A にまとまり、`[x ~xs]` の x や
  // `' 0` で引いた物から点・差の印が落ちる（hasAddr の注）。断る側に倒した（§5 Q66）。
  if (descs.some((d) => hasAddr(d))) throw refuseAddressDrop("mixed", descs.map((d) => descText(d)).join(" "));
  return A();
}

function isSpreadNode(t) {
  return !!t && t.t === "leaf" && !!t.desc.spread;
}
function listShapeOf(items) {
  // 撒く項を含む並び（`[vs~ 4]`）の要素は、撒いた器の要素と並べた項が混ざり、要素の位置が数えられない。決めずに
  // 中身の見えない A にする（名前は未知、`~rest` は A）。
  if (items.some(isSpreadNode)) return null;
  return { s: "list", elem: mergeElems(items.map(descOfTree)) };
}
// `,` の積の要素の木。被演算子の `(unit …)`（R121 の辺の終わりに余った関数・R123 の丸ごとの関数）は `_` で、積の単位として消える（`_ , 2` は 2、R61）ので数えない
// （`fs : inc , double , 3` の fs は1要素の 3、`q1 : f3 1 , 2` の q1 は 2。[x] ≅ x と、全部が消えた積は vanishedOne が先に読む）。
function commaItems(tree) {
  return liveItems(commaAll(tree));
}
// `,` の積の被演算子を、消える `(unit …)` も含めて書いた順に並べた物。
function commaAll(tree) {
  const out = [];
  let t = tree;
  while (t && t.t === "op" && t.sym === ",") {
    out.push(t.left);
    t = t.right;
  }
  out.push(t);
  return out;
}

// 構築の中の余ったラムダ `(unit …)`（R42・R48・R52）は、R15 のとおり並びの中で消える（`1 2 f2` の値は `1 2`）ので、構築の値の形・要素・
// 数には入れない。消えた後に1項だけ残れば、構築の値はその項そのもの（`(5 inc)` は `(5 _)` と同じく 5。[x] ≅ x）。構築の中に `(unit …)` が
// 入るのは、2026-10-24 の R52 までは行の根だけで、根の木の形はどこからも読まれなかった。R52 で括りの中・本体の根にも入るので、ここで消す。
// 消えた項が無ければ null（構築のまま見る）。
// `,` の積も同じ（R123、2026-11 の片イ）：被演算子の `(unit …)` は積の単位で消え、1つだけ残ればその要素そのもの（`(, (unit inc) 2)` は 2）。全部が消えた積
// （`inc , double`）は、`(unit …)` 1つと同じ中身の見えない値に読む（R の所：値は `_ , _` で `_` だが、`_` と分かる値（印 zero、R63）に読むかは決めずに、数も形も言わない側）。
function vanishedOne(tree) {
  const items = !tree ? null : tree.t === "construct" ? tree.items : tree.t === "op" && tree.sym === "," ? commaAll(tree) : null;
  if (!items || !items.some(isUnitTree)) return null;
  const live = items.filter((x) => !isUnitTree(x));
  if (live.length === 1) return live[0];
  return !live.length && tree.t === "op" ? items[items.length - 1] : null;
}
const isUnitTree = (x) => !!x && x.t === "unit";
const liveItems = (items) => items.filter((x) => !isUnitTree(x));

// 解いた木の中身の形。見えなければ null。
function shapeOfTree(tree) {
  if (!tree || tree.kind.k !== "A") return null;
  const one = vanishedOne(tree);
  if (one) return shapeOfTree(one);
  if (tree.t === "construct") return listShapeOf(liveItems(tree.items));
  if (tree.t === "op" && tree.sym === ",") return listShapeOf(commaItems(tree));
  if ((tree.t === "leaf" && tree.cat === "plain" && !tree.desc.spread) || tree.t === "apply") return tree.kind.shape || null;
  return null;
}

// 解いた木を、値として渡したときの desc（構築と `,` の並びは、ここで形と要素を付ける）。
function descOfTree(tree) {
  if (!tree) return U();
  const one = vanishedOne(tree);
  if (one) return descOfTree(one);
  if (tree.t === "construct" || (tree.t === "op" && tree.sym === ",")) {
    const d = { k: "A" };
    const sh = shapeOfTree(tree);
    if (sh) d.shape = sh;
    const el = visibleElements(tree);
    if (el) d.elements = el;
    return d;
  }
  return tree.kind;
}

// 括りか字下げのブロックを解いた行から、中身の形。構造体は、全部の行が「1語の名前 : 値」で、名前が重ならないもの
// （重なれば、どの行の欄か決まらないので中身の見えない A）。欄の desc は右辺の生まれ（R24）。欄と値の混ざった行や
// 枝の行は、構造体とも List とも言えないので中身の見えない A にする。欄の右辺が撒く項（`k : vs~`）なら、欄で受けた
// 名前が撒く項として並びに入ることになり、それはどの言葉にも無いので、構造体ごと中身の見えない A にする（listShapeOf
// の撒く項と同じ）。
// 字下げのブロックも括りと同じに読む：2行以上の値の行は List で、1行が1要素（利用者 2026-10-19「値の行を並べた字下げの
// ブロックを、括りと同じ List（1行が1要素）として受けていい？」に「それでいいよ」）。
function rowsShape(trees) {
  const isField = (t) => !!t && t.t === "op" && t.sym === ":" && !!t.fieldName;
  if (trees.every(isField)) {
    const names = trees.map((t) => t.fieldName);
    if (new Set(names).size !== names.length || trees.some((t) => isSpreadNode(t.right))) return null;
    // 欄の右辺が書いた `_`（`[s : _]`）なら、`_` を指す印 zero を付ける（R63。実体の中の `$s` が零射の番地と分かる）。
    return { s: "struct", fields: trees.map((t) => ({ name: t.fieldName, desc: isMark(t.right) ? zeroDesc() : descOfTree(t.right) })) };
  }
  if (trees.length === 1) return shapeOfTree(trees[0]);
  if (trees.some((t) => !t || (t.t === "op" && t.sym === ":"))) return null;
  return listShapeOf(trees);
}

// R26：`x ' k` の鍵。字面の整数か裸の名前だけ。裸の名前の鍵は、いつも欄の名前（R26「裸の名前の鍵は、いつも欄の名前
// である」）なので、名前として引かない（引くと、欄の名前に「定義されていません」と出る）。
function pickKeyOf(term) {
  if (!term || term.type !== "atom" || term.pre.length || term.post.length) return null;
  if (term.core.c === "name") return { name: term.core.name };
  if (term.core.c === "lit" && /^[0-9]+$/.test(term.core.text)) return { int: Number(term.core.text) };
  return null;
}
// R102（2026-10-27 の片8）：`$x ' 0` は x。`$` は持ち上げ（R99）で、`$x` は x 1つの領域を指す番地なので、`' 0` は `@` と同じく下ろして x そのもの（C の `(&v)[0]`）。
// 持ち上げた物（関数を指す番地 ref・値を読む参照 vref、名前・括り・仮引数で運んだ物も）の desc から引く：関数なら指す関数（L。`@[$inc]` と同じ dollarOpened）、
// 値なら指す値の desc（`@[$v]` と同じ openSelfReader。`$v` の輪の中なら、下ろす所を通る輪で name-cycle、R103）。字面の `' k` の k が 0 でなければ、1つの物の
// 領域の外なので `_`（印 zero の値）。持ち上げでない物・先の種類の分からない持ち上げ（lift）・番地の算術で作った点と差・名前や式の鍵は今のまま（null を返し、
// pickDesc が読む）。`$_`（と `_` を指す名前・`$[]~`）は `_` の持ち上げではなく零射 `[x ? _]` の番地（R56・R63・R104）なので、`' 0` は零射そのもの（`@[$_]` と同じ）。
// 括り1つで運んだ持ち上げ（`[$five] ' 0`）も下ろす：括り1つは [x] ≅ x で `$five` と同じ印を持つ（R49・R60。`[vs] ' 0` が `vs ' 0` と読むのと同じで、解決器は
// `[x] ' 0` を x とは読まない。`[5] ' 0` は未知）。主の Claude の 10:17 の例え「`[v] ' 0` が v なのと同じ」は規則にしていない（§5 Q78 (f)）。
// 根拠：主の Claude の読み「`$v ' 0` は、持ち上げてから0番目を取るので v そのもの。`[v] ' 0` が v なのと同じで、C の `(&v)[0]` とも同じ。」「`$v ' 1` は1つ分の
// 領域の外なので `_`。」（2026-10-27 10:17 UTC、58a809c9）と、U〔答え〕[2026-10-27 10:56 58a809c9] のボタンの文「…`$v ' 0` は v、下ろす所を通る輪だけ断る。…」
// （主の Claude の文）。前は未知。
function lowerPick(d, key, ctx) {
  if (!key || key.int === undefined) return null;
  const r = refOf(d);
  const v = vrefOf(d);
  if (!r && !v) return null;
  if (key.int !== 0) return zeroDesc();
  if (r) return { k: "L", fn: dollarOpened(r.ref) };
  return openSelfReader(v.vref, ctx);
}
// 引いた物の desc（R26）。構造体＋裸の名前は同じ名前の欄（無ければ `_`、R115）、List＋字面の整数は要素。ほかは未知。
// 2026-10-28 の片9b（R115）：構造体に無い欄を `'` で引いたら `_`（印 zero）。欄が無い＝定義が無い＝`_`（R111）。根拠：主の Claude の 2026-10-27 14:46 UTC の文「`'` で引いて
// 無い欄も `_` にする（9-05 の君の案「外れれば `__`」）。」（R。D c90433a）。前は未知。
function pickDesc(desc, key) {
  // 欄の無い物（空の括り `[]`・`_` と分かる値。`[s : _]` は R113 で `[]`）を名前で引いても `_`（無い欄は `_`、R115）。字面の整数で引く形は今のまま未知。
  if (key && key.name !== undefined && (isEmptyBracket(desc) || zeroOf(desc))) return zeroDesc();
  if (!desc || desc.k !== "A" || desc.spread || !desc.shape || !key) return U();
  const sh = desc.shape;
  if (sh.s === "struct" && key.name !== undefined) {
    const f = sh.fields.find((x) => x.name === key.name);
    return f ? f.desc : zeroDesc();
  }
  if (sh.s === "list" && key.int !== undefined) return sh.elem && sh.elem.k === "A" ? sh.elem : U();
  // 数（`5 ' 0`・`[' 0] 3`）からは引かない。R26 の文面は x の形を「R24 の構造体か List」と書き、R24 は数をそのどちらとも
  // 別の行に置く（数を長さ1の List として読むのは、括りで受けるときの文面）。`[x]≅x` から引けると読むかは決めていない
  // ので、未知にする（断る側、数の確かめ 2026-10-19 の F2）。数を `~rest` で受けた物は R24 の List なので、そこからは引ける。
  return U();
}

// ---- 実体の鍵と形の綴り（R24） ----
//
// 実体の鍵は「関数の出どころ・渡された物の desc」の正規の文字列。L の desc は関数の出どころ（書いた `?` の綴りと、
// 定義した所の範囲の鍵）まで入れる——本体の根が違う関数を同じ実体にすると、片方の本体の読みでもう片方を読むことに
// なる。出どころを物の同一性（何番目に見たか）ではなく綴りで持つのは、呼ぶ行と定義の行の順を入れ替えても鍵と
// 並び順が変わらないようにするため（R25：順序に依らない）。同じ綴りで同じ範囲の関数は、本体を解いた答えも同じである。

const writtenCache = new WeakMap();
function lambdaKey(op, scopeKey) {
  let s = writtenCache.get(op);
  if (s === undefined) {
    s = writeTree(op);
    writtenCache.set(op, s);
  }
  return `λ{${s}}@${scopeKey}`;
}

function fnKey(fn) {
  if (!fn) return "?";
  // 2026-10-23 までは、逆適用で主語がどの口に入ったかが決まっていない関数（印 pending、§5 Q5）と、恒等射の流れで印を付けた段
  // （idSplit）を、同じ関数と分けていた。逆適用の廃止（R47）で、どちらの印も無くなった。
  switch (fn.type) {
    case "plain":
      // rest と restAt は plainKeyText の注。素の関数の部分適用と穴の関数に当てた物の印（R81。印のある物は口が埋まった所で実体を作るので、答えが印で分かれる）は、括りの関数の部分適用と同じく
      // 番号の DAG で鍵にする（internPlainMarks。綴りを文字列に書き写すと、同じ印を2回当てる再帰で段ごとに倍になり、深さの門より先に文字列の長さの上限を
      // 超えて JS の RangeError で落ちた。2026-10-26 の確かめの指摘）。
      if (plainMarksOf(fn)) return canonKey(internPlainMarks(fn));
      return plainKeyText(fn);
    case "pattern":
      return fn.bound ? canonKey(internPartial(fn)) : `pattern:${fn.idKey}`;
    case "compose":
      return canonKey(internCompose(fn));
    case "pfPick":
      return `pfPick:${fn.sym}:${fn.key ? JSON.stringify(fn.key) : ""}`;
    case "pfBinary":
      // 種類は残りの口の数と足りた適用の種類だけで決まる（記号に依らない）。type だけを鍵にすると、`[<<]`（A）と `[']`（未知）を
      // 括りの関数に欄で渡したときに実体を分け合い、先に解いた方の答えをもう片方が黙って使う。記号は鍵に入れないので、実体の
      // 本体から出る言い分にも記号を書かない。
      return `pfBinary:${fn.n}:${fn.root}`;
    case "pfGreedyUnary":
      // `[F,]` の写像（R50）は、写す関数の鍵を持つ。type だけを鍵にすると、`[inc,]` と `[uu,]`（根が A と未知）を括りの関数に欄で
      // 渡したときに実体を分け合う。写す関数の無い `[* 2,]` などは今までどおり type だけ（どれも同じ種類になる）。
      // 2026-10-25（R60 の細かい所、§5 Q59）から、値の演算子の印（vop）のある物とない物（`[-_,]` と `[!_,]`）は、Reader を受けたときの答え（G7 か
      // 通るか）が分かれるので、鍵に印の有無を入れる（記号は入れない。上の pfBinary と同じく、言い分にも記号を書かない）。
      return fn.map ? `pfGreedyUnary:map(${canonKey(internFn(fn.map))})` : `pfGreedyUnary${fn.vop ? ":v" : ""}`;
    case "pfUnary":
    case "pfFold":
      // 値の演算子の印の有無（上の pfGreedyUnary と同じ。`[-_]` と `[!_]`、`[+]` と `[|]`）。
      return `${fn.type}${fn.vop ? ":v" : ""}`;
    case "other":
      // 既定値のある関数は、書いた `_` で既定値か消える（R39・R105。前は G15）、`!_` で仮引数の数 n の穴（tryHole）になり、ほかのアリティの分からない関数
      // （仮引数のブロックの1行に名前が2つある `gq :` ⏎ `⇥⇥a b` ⏎ `⇥? a`。前の例の `gx : a ~y ? a` は、2026-10-26 から定義の所で G22、R67）と振る舞いが分かれる。鍵を `other` 1つにすると、括りの関数に欄で渡したときに実体を分け合い、
      // 先に解いた方の門（G5 か G15）が、もう片方の行の言い分になった（行の順で名指しが入れ替わる）。だから印と n を入れる。
      // 既定値のある口の位置（defaultAt）でも、書いた `_` を当てたときの答え（既定値か消えるか、R39・R105。片イの R126 の前は既定値か G15）が分かれるので入れる。
      // 2026-10-27 の R94 から、括りの仮引数のある物は値の口の位置（bareAt）も入れる（書いた `[]` を当てたときの答え（書いた `_` と同じか、空の器か）が分かれる）。
      // 括りの仮引数の無い物は今までどおりの綴り（どの口も値の口）。
      // 2026-10-28 の R105 の片から、既定値のある関数から作った穴の関数（印 holeOf）は、穴の数で書いた `_` の答え（消えるか G5）が分かれるので、印と数を入れる。
      return fn.defaults
        ? `other:d${fn.n === null ? "?" : fn.n}${fn.defaultAt ? `:${fn.defaultAt.map((b) => (b ? 1 : 0)).join("")}` : ""}${fn.bareAt && fn.bareAt.some((b) => !b) ? `:b${fn.bareAt.map((b) => (b ? 1 : 0)).join("")}` : ""}`
        : fn.holeOf
          ? `other:h${fn.holes}${fn.rest ? "r" : ""}`
          : "other";
    default:
      return fn.idKey ? `${fn.type}:${fn.idKey}` : fn.type;
  }
}

// 形は欄どうしで同じ物を指すことがある（`m1 : [p : m0 ⏎ q : m0]`、再帰の `f [p : r ⏎ q : r]`）。鍵を木として綴ると、
// 入れ子の深さ d で 2^d 個の葉を辿り、文字列も 2^d の長さになる（深さ 20 で秒、25 で文字列の長さの上限を超える）。
// だから形は2段で鍵にする。
// 1. internDesc：中身で番号に寄せる（子は番号で書くので、1つの形につき1回だけ見る）。番号が同じ ⇔ 中身が同じ。
//    ハッシュは使わない（違う形が同じ鍵になると、黙って別の実体の答えを返す）。
// 2. canonKey：番号の DAG を深さ優先で綴り、2回目に出た形は `^n`（n 番目に綴った形）で指す。綴りは中身だけで決まる
//    （番号の振り方＝形を見た順に依らない）ので、行の順を入れ替えても鍵と、鍵で決める並び順は変わらない。長さは形の
//    中の違う物の数に比例する。
// 括りの関数の部分適用の L も同じ2段で鍵にする（internPartial）。当てた物に前の部分適用が入ると（`q1 : pp [f : q0]
// [f : q0]`）、当てた物を葉の文字列に綴れば段ごとに倍になり、22 段で文字列の長さの上限を超えた（部分適用の確かめ
// 2026-10-19 の F1）。
// 合成の L も同じ（internCompose）。子の鍵を文字列でつなぐと、同じ部分適用を2つ並べた合成（`c1 : q1 q1`）を当てた
// 部分適用の鎖で段ごとに倍になり、24 段で文字列の長さの上限を超えた（反証 2026-10-19 の続き）。
// 表は resolve を呼ぶたびに作り直す（resetIntern）。
// 番号には、鍵の入れ子の深さ（depth）も持たせる（実体の深さの守り、INSTANCE_DEPTH_MARGIN の注の1）。深さは綴りだけで決まる。
let internTable = new Map(); // 中身の綴り（子は番号）→ 番号
// 番号 → {leaf} | {s:'struct', fields:[[名前, 番号]]} | {s:'list', elem:番号|null} | {s:'partial', base, bound:[番号]}
//   | {s:'compose', fns:[番号], partial}。どれも depth を持つ。
let internNodes = [];
let internByDesc = new WeakMap();
let internByShape = new WeakMap();
let internByFn = new WeakMap();
let canonMemo = new Map();
function resetIntern() {
  internTable = new Map();
  internNodes = [];
  internByDesc = new WeakMap();
  internByShape = new WeakMap();
  internByFn = new WeakMap();
  canonMemo = new Map();
  identTable = new Map([["·", NO_IDENT]]);
  identByDesc = new WeakMap();
  identByShape = new WeakMap();
  identByFn = new WeakMap();
  opSerial = new WeakMap();
  opCount = 0;
}
function internText(text, node) {
  let id = internTable.get(text);
  if (id === undefined) {
    id = internNodes.length;
    internNodes.push(node);
    internTable.set(text, id);
  }
  return id;
}
// 葉の深さは 1。関数の葉は、書いた所の範囲が実体の中なら、その実体の深さに 1 を足す（fnDepth）。綴りに範囲の鍵（＝実体の
// 鍵）が入っているので、同じ綴りの葉は同じ深さになる。
const internLeaf = (text, depth = 1) => internText(text, { leaf: text, depth });
const depthOf = (id) => internNodes[id].depth;
const maxDepth = (ids) => ids.reduce((m, c) => Math.max(m, depthOf(c)), 0);
function internDesc(d) {
  if (!d) return internLeaf("U");
  const memo = internByDesc.get(d);
  if (memo !== undefined) return memo;
  let id;
  if (d.k === "L") id = internFn(d.fn);
  else if (d.k !== "A") id = internLeaf("U");
  else if (d.spread) id = internLeaf("A~");
  // 関数を指す番地（R49）：指す関数の鍵を持つ。持たないと、`h [f : $inc]` と `h [f : $uu]`（欄の `@f` の口の数・根が違う）が
  // 実体を分け合い、先に解いた方の答えを後の方が黙って使う。深さは指す関数の深さに 1 を足す（閉包を番地で渡し続ける再帰が深さの門に届く）。
  else if (d.ref && !d.shape) {
    const f = internFn(d.ref);
    id = internText(`$#${f}`, { s: "ref", fn: f, depth: 1 + depthOf(f) });
  }
  // 値を読む参照（R60）：指す値の鍵を持つ（関数の番地と同じ理由。`h $vs 0` と `h $five 0` の実体の `@f` は、指す値の形が違う）。深さは指す値の深さに
  // 1 を足す（参照の参照を渡し続ける再帰が深さの門に届く）。
  // 2026-10-27 の片7 の確かめの直しから、点の要素の幅（R97 の w、ptWidthOf の注）も鍵に入れる（`hb [1] $vs` と `hb [1] $st` の実体を分ける）。
  else if (d.vref && !d.shape) {
    const v = internDesc(d.vref);
    id = internText(`$=${d.w ? `${d.w}:` : ""}#${v}`, { s: "vref", val: v, w: d.w || 0, depth: 1 + depthOf(v) });
  }
  // 番地の算術で作った点・差（R62）：ずらした点 `$+`・差 `$-$`。中身の見えない A と別の鍵にする（同じ鍵だと、`hc [1] ($v + 0x10)` と `hc [1] 5` が実体を
  // 分け合い、本体の `f == $v` の答え（点どうしの比べか、顔の分からない値との G21 か）を先に解いた方が決める。hc は `[k] f ? f == $vs`）。ずらした点の幅（R97）も
  // 鍵に入れる（`$+8`。上の値を読む参照と同じ）。
  else if (addrOf(d)) id = internLeaf(d.addr === "pt" ? (d.w ? `$+${d.w}` : "$+") : "$-$");
  // 書いた `_` を指すと分かっている値（R63）：`_`。中身の見えない A と別の鍵にする（同じ鍵だと、`h [s : _]` と `h [s : (inc 5)]` が実体を分け合い、
  // 本体の `$s` が零射の番地か G20 かを、先に解いた方が決める。§5 Q64 の影響）。
  else if (zeroOf(d)) id = internLeaf("_");
  // 先の種類の分からない持ち上げ（2026-10-27 の片8、liftOf）：中身の見えない A と別の鍵（`@` で先を読まない、値の演算子では G21）。
  else if (liftOf(d)) id = internLeaf("$?");
  // 書いた空の括り `[]`（`A[]`、頭の注）は、R51 の撒いた流れが空と読む（elemsOfContainer・foldableContainer）ので、中身の見えない A と別の鍵にする。
  // 同じ鍵だと、`k2 : [~t] ? inc t~` の `k2 []`（空の流れの書き下しで G19）と `k2 (tl vs)`（数の見えない流れで未知）が1つの実体を分け合い、
  // 先に作った方の答えを後の方が黙って使った（2026-10-25 の確かめの指摘。`fold $first []` ⏎ `(fold $first (tl fs)) 5` も、中身の見えない器の
  // 畳み込みを空の流れの `_` と読んで A にしていた。HEAD 41f144af から）。
  else if (isEmptyBracket(d)) id = internLeaf("A[]");
  // 中身の見えない A。中身に関数か未知が見える器（`A(U)`、頭の注）は、`~rest` の読みが違うので別の鍵にする。
  else if (!d.shape) id = internLeaf(deepKind(d) === "A" ? "A" : "A(U)");
  else id = internShape(d.shape);
  internByDesc.set(d, id);
  return id;
}
function internShape(sh) {
  const memo = internByShape.get(sh);
  if (memo !== undefined) return memo;
  let id;
  if (sh.s === "scalar") id = internLeaf("N");
  else if (sh.s === "struct") {
    const fields = sh.fields.map((f) => [f.name, internDesc(f.desc)]);
    const depth = 1 + maxDepth(fields.map(([, c]) => c));
    id = internText(`{${fields.map(([n, c]) => `${n}:#${c}`).join(" ")}}`, { s: "struct", fields, depth });
  } else {
    const elem = sh.elem ? internDesc(sh.elem) : null;
    id = internText(elem === null ? "[]" : `[#${elem}…]`, { s: "list", elem, depth: elem === null ? 1 : 1 + depthOf(elem) });
  }
  internByShape.set(sh, id);
  return id;
}
// 括りの関数の部分適用の鍵：元の関数の出どころと、当てた物の形。裸の仮引数の位置は A にする——実体の鍵（bindParams）が
// 裸の位置の形を見ないので、そこに何を当てても同じ関数である（R24「裸の仮引数の位置は、形に数えない」。素の関数の部分
// 適用の鍵が当てた物を見ないのと同じ）。数えると、同じ実体が2つ描かれ、再帰では同じ形の実体が入れ子になって G7 に
// なった（部分適用の確かめ 2026-10-19 の F2）。綴りは番号で書く（子と同じ。`(` の中は番号だけなので、後ろの出どころと
// 混ざらない）。
function internPartial(fn) {
  const memo = internByFn.get(fn);
  if (memo !== undefined) return memo;
  // 裸の位置でも、関数を指す番地（R49）は印ごと鍵に入れる（実体の鍵 bindParams と同じ）。値を読む参照・番地の点と差（R60・R62）と、書いた `_` を
  // 指す値（R63）も同じ。
  const bound = fn.bound.map((d, i) => (fn.base.bareAt[i] && !readerOf(d) && !zeroOf(d) ? internLeaf("A") : internDesc(d)));
  const depth = 1 + Math.max(fnDepth(fn.base), maxDepth(bound));
  const id = internText(`P(${bound.map((c) => `#${c}`).join(" ")})${fn.base.idKey}`, { s: "partial", base: fn.base.idKey, bound, depth });
  internByFn.set(fn, id);
  return id;
}
// 合成の鍵：中の関数の鍵を、書いた順に番号で並べる（部分適用と同じく、子は番号）。口の開いたまま残った合成（左からの畳み込みで
// 最初の関数が実引数を受けた物、R40）は、最初の関数を受けた分だけ当てた部分適用にしてあるので、当てた物はその鍵に入る（括りの
// 関数の部分適用の bound と同じ）。前の流れの足りない合成の pre（当てた物）は、2026-10-23 に無くなった。
function internCompose(fn) {
  const memo = internByFn.get(fn);
  if (memo !== undefined) return memo;
  const fns = fn.fns.map(internFn);
  const id = internText(`C(${fns.map((c) => `#${c}`).join(" ")})`, {
    s: "compose",
    fns,
    depth: 1 + maxDepth(fns),
  });
  internByFn.set(fn, id);
  return id;
}
// 素の関数の鍵の綴り（印を除く）。R34 の k < n で作った穴の関数（rest）は、書いた `_` で G5 になり、同じアリティの穴の関数と振る舞いが分かれる（"other" の
// 注と同じ割れ）ので、鍵に印を入れる。最後の括りの前に残る裸の口の数（restAt）でも、後から当てた物がどの口に入るかが分かれる（restCloseKind）ので、それも入れる。
function plainKeyText(fn) {
  const rest = fn.rest ? (fn.restAt === undefined ? "+rest" : `+rest@${fn.restAt}`) : "";
  return `plain:${fn.origin}${rest}:${fn.n}:${fn.idKey || ""}`;
}
// 素の関数の部分適用（bound）と穴の関数（holeArgs。穴の位置は □）に当てた物のうち、鍵に入れる物（R81）：印のある物は desc、印の無い物は A。印が1つも無ければ
// null（今までどおり鍵に入れない）。
function plainMarksOf(fn) {
  const slots = fn.holeHead ? [...fn.holeArgs.map((t, i) => (fn.holeAt.includes(i) ? null : descOfTree(t))), ...(fn.holeC || []).map(descOfTree)] : fn.bound;
  if (!slots || !slots.some((d) => d && monoMarked(d))) return null;
  return slots.map((d) => (d === null ? "hole" : monoMarked(d) ? d : "A"));
}
// 素の関数の部分適用・穴の関数の印の鍵の番号（internPartial と同じ2段。深さは当てた物のいちばん深い物に 1 を足す：印を当て続ける再帰が深さの門に届く）。
function internPlainMarks(fn) {
  const memo = internByFn.get(fn);
  if (memo !== undefined) return memo;
  const bound = plainMarksOf(fn).map((d) => (d === "hole" ? internLeaf("□") : d === "A" ? internLeaf("A") : internDesc(d)));
  const base = plainKeyText(fn);
  const depth = 1 + Math.max(fnDepth(fn), maxDepth(bound));
  const id = internText(`PM(${bound.map((c) => `#${c}`).join(" ")})${base}`, { s: "plainMarks", base, bound, depth });
  internByFn.set(fn, id);
  return id;
}
// L の desc の関数の番号。部分適用と合成は中身で番号に寄せ、ほかは fnKey の綴りの葉（短い綴りで決まる）。
function internFn(fn) {
  if (fn && fn.type === "pattern" && fn.bound) return internPartial(fn);
  if (fn && fn.type === "compose") return internCompose(fn);
  if (fn && fn.type === "plain" && plainMarksOf(fn)) return internPlainMarks(fn);
  return internLeaf(`L<${fnKey(fn)}>`, fnDepth(fn));
}
// 関数の葉の深さ：書いた所の範囲の深さ（envDepth。閉包の鍵は書いた所の範囲の鍵を持つので、その段と同じ）。ファイルの範囲の
// 関数と、範囲を鍵に持たない関数（点なし・頭の前置 `@`・アリティの分からない関数・素の関数の部分適用と穴は元の関数のまま）は 1。
function fnDepth(fn) {
  return Math.max(1, (fn && fn.envDepth) || 0);
}
// 範囲の中の、いちばん内の実体の範囲の深さ（実体の範囲は depth を持つ、instScope）。実体の中でなければ 0。
function envDepth(scope) {
  for (let s = scope; s; s = s.parent) if (s.depth !== undefined) return s.depth;
  return 0;
}
function canonKey(id) {
  const memo = canonMemo.get(id);
  if (memo !== undefined) return memo;
  const seen = new Map();
  const walk = (i) => {
    const node = internNodes[i];
    if (node.leaf !== undefined) return node.leaf;
    if (seen.has(i)) return `^${seen.get(i)}`;
    seen.set(i, seen.size);
    if (node.s === "struct") return `{${node.fields.map(([n, c]) => `${n}:${walk(c)}`).join(" ")}}`;
    if (node.s === "ref") return `$${walk(node.fn)}`;
    if (node.s === "vref") return `$=${node.w ? `${node.w}:` : ""}${walk(node.val)}`;
    if (node.s === "partial") return `L<pattern:${node.base}<${node.bound.map(walk).join(" ")}>>`;
    if (node.s === "plainMarks") return `L<${node.base}<${node.bound.map(walk).join(" ")}>>`;
    if (node.s === "compose") return `L<compose(${node.fns.map(walk).join(" ")})>`;
    return node.elem === null ? "[]" : `[${walk(node.elem)}…]`; // `[]` は要素の無い List（空の文字列の字面）
  };
  const s = walk(id);
  canonMemo.set(id, s);
  return s;
}
function descKey(d) {
  return canonKey(internDesc(d));
}

// 形の綴り（頭の注）。人が読む物なので、max 字を超えたら切って `⋯` を付ける。切った所から先は辿らないので、共有の
// 多い形でも max に比例する手間で済む。
const SHAPE_TEXT_MAX = 400;
function descText(d, max = SHAPE_TEXT_MAX) {
  let out = "";
  let cut = false;
  const put = (s) => {
    if (cut) return;
    if (out.length + s.length > max) {
      out += `${s.slice(0, Math.max(0, max - out.length))}⋯`;
      cut = true;
    } else out += s;
  };
  const walk = (x) => {
    if (cut) return;
    if (!x || x.k === "U") return put("U");
    if (x.k === "L") return put("L");
    if (x.spread) return put("A~");
    if (x.ref && !x.shape) return put("$L"); // 関数を指す番地（R49）
    if (x.vref && !x.shape) {
      put("$"); // 値を読む参照（R60）：`$` の後ろに指す値の形（`$N`・`$[N…]`・`$$L`）
      return walk(x.vref);
    }
    if (addrOf(x)) return put(x.addr === "pt" ? "$+" : "$-$"); // 番地の算術で作った点・差（R62。internDesc の注）
    if (liftOf(x)) return put("$?"); // 先の種類の分からない持ち上げ（2026-10-27 の片8。internDesc の注）
    if (zeroOf(x)) return put("_"); // 書いた `_` を指すと分かっている値（R63）
    if (isEmptyBracket(x)) return put("A[]"); // 書いた空の括り（internDesc の注）
    if (!x.shape) return put(deepKind(x) === "A" ? "A" : "A(U)");
    const sh = x.shape;
    if (sh.s === "scalar") return put("N");
    if (sh.s === "struct") {
      put("{");
      sh.fields.forEach((f, i) => {
        if (i) put(" ");
        put(`${f.name}:`);
        walk(f.desc);
      });
      put("}");
    } else if (!sh.elem) put("[]");
    else {
      put("[");
      walk(sh.elem);
      put("…]");
    }
  };
  walk(d);
  return out;
}

// 名前を引く（P2・R21）。仮引数・括りの欄の名前・ファイルの定義の順に探し、無ければ未定義。実体の範囲では、仮引数の
// desc（R24 で当てた物）をそのまま返す。
function lookup(name, ctx) {
  let imported = false;
  for (let s = ctx.scope; s; s = s.parent) {
    if (s.descs && s.descs.has(name)) return s.descs.get(name);
    // 素の関数の裸の仮引数は A で、札の印 pv を付ける（paramTag の注。R60 の細かい所、§5 Q59）。
    if (s.params && s.params.has(name)) return s.params.get(name) === "bare" ? (s.plainOp ? { k: "A", pv: paramTag(s.plainOp, s.plainKey, s.paramIdx.get(name)) } : A()) : U();
    // 括りと構造体のブロックの行の名前（欄か局所の定義か決まっていない、local-field。§5 Q10）は今のまま未知。関数の本体には局所の名前が無い（寄せ1 の R128）。
    if (s.locals && s.locals.has(name)) return U();
    if (s.hasImport) imported = true;
  }
  const def = ctx.F.defs.get(name);
  if (def) return nameKindOf(ctx.F, def);
  if (imported) return U();
  reportUndefined(name, ctx);
  // R111（2026-10-28 の片9b）：取り込みの無い範囲の未定義の名前は、`un : _` の un と同じ「`_` と分かる値」（印 zero、R63）で、使う所で読む（値の口なら書いた `_` と同じ、
  // R112。参照の口なら空の器、R90。撒けば長さ 0 の流れ、R84。`$no` は零射の番地、R56）。前（R21）は印の無い A で、括りの口・撒く所・`$`・名前を通す所で `un` と
  // 割れていた（主の Claude の 2026-10-27 14:46 UTC の調べ：HEAD ce697684 の写しで、ここと pointsToMark・dollarNameTarget の3か所に印を付けると、ファイルと局所の割れが 0）。
  // 根拠：U [2026-10-27 13:44 58a809c9]「…un : _ / と / 定義しない no / は / no = un / が成り立つことを考慮すれば答えは自明だと思う。」、U [14:02]「「定義が無い」という事と、
  // 「解が無い」という事は、同値関係に当たる。」、U [14:06]「…使われればどちらも _ だね」、U〔答え〕[2026-10-15 23:16 444eeb3c]「nop : _ を書いてなくても、 nop を
  // 表現できることにもなる。undefinedなら _ だからだ。」。取り込みのある範囲は今のまま未知（定義が取り込み先にあるかもしれない、§5 Q10）。
  return zeroDesc();
}

// `@名前` の名前の desc（R49）。仮引数・括りの欄の名前・実体の中で渡された物（s.descs）・ファイルの定義を見る。取り込みの範囲の名前と未定義の名前は null（印を読まない）。
// 2026-10-26 の R82（§5 Q45 の残り）から、値の定義の名前（`p : $inc`・`p : $vs`・`q : $vs + 0x10`）も右辺を解いて印を読む：`:` はメタで名前は右辺を指すので、
// `@p` は `@$inc`・`@[p]` と同じ先（[x] ≅ x）。右辺を解くので、輪にも数える（`@[p]` と同じ。値を含む輪は name-cycle）。前（R49 から）は値の定義を解かずに覗き、
// `@p` だけが印の無い前置 `@` の項（入力の項）で、`@[p]` と割れていた（`p : $vs` の `@p 3` は `(apply @p 3)` で未知、`@[p] 3` は構築の A）。括りの欄の名前は
// 今のまま未知（local-field）。
// 2026-10-24 までは `$名前` もここで覗いていた。同じ日の R53 から `$名前` は値の定義の右辺も解いて種類を引き、2026-10-25 の R55 から指す関数の印も
// その種類から付ける（dollarNameTarget。別名 `p : inc` の `$p` も印を持つ）。
function peekDesc(name, ctx) {
  for (let s = ctx.scope; s; s = s.parent) {
    if (s.descs && s.descs.has(name)) return s.descs.get(name);
    if (s.params && s.params.has(name)) return s.params.get(name) === "bare" ? A() : U();
    if (s.locals && s.locals.has(name)) return U();
  }
  const def = ctx.F.defs.get(name);
  return def ? nameKindOf(ctx.F, def) : null;
}

// 名前が `?` の定義（`f : x ? …`・`f : [x ? …]`）を直に指すか。穴の頭（R16）に置けるのは、§3.4 の素の関数（「名前の定義と
// `?` の括りがあたる」）だけである（2026-10-23 までは逆適用の右（R12「名前か `?` の括り」）も。R12 は 2026-10-24 に廃止、R47）。
// 別名（`p : inc`・`q : [inc]`）を素の関数に数えるかは仕様に書かれていないので、断る側に揃えた。別名の適用の種類（§3.4 の表）は
// 今のまま、生まれた関数で決める。括りの欄の名前は数えない（local-field）。
function isLambdaName(name, ctx) {
  for (let s = ctx.scope; s; s = s.parent) {
    if ((s.params && s.params.has(name)) || (s.locals && s.locals.has(name))) return false;
  }
  const def = ctx.F.defs.get(name);
  return !!(def && def.lambda);
}

// 名前がファイルの値の定義を直に指すなら、その右辺の器の数（nameKindOf が F.valueCounts に置く）。仮引数・実体の中で
// 渡された物（s.descs）と括りの欄の名前は数えない（null）：実体は長さを書かない形で共有される（R24）。
function valueCountOf(name, ctx) {
  for (let s = ctx.scope; s; s = s.parent) {
    if ((s.descs && s.descs.has(name)) || (s.params && s.params.has(name)) || (s.locals && s.locals.has(name))) return null;
  }
  const def = ctx.F.defs.get(name);
  if (!def || def.lambda || !ctx.F.valueCounts.has(def)) return null;
  return ctx.F.valueCounts.get(def);
}
// 名前がファイルの値の定義を直に指し、その右辺が文字列（バックスラッシュの無い字面・それを括った物・その名前）なら、文字の数（nameKindOf が
// F.stringCounts に置く）。撒いた流れの数（R51 の書き下し、flowLength）だけが読む：`:` はメタなので、`st : \`abc\`` の `st~` は
// `` `abc`~ `` と同じ数（2026-10-25 の確かめの指摘。前は字面だけを数え、`uu st~` は未知・`uu \`abc\`~` は G2(a) と割れていた）。R34 の
// 最後の括りの数（valueCounts、writtenLength）には入れない：そこでは字面の文字列も数えない（入れると、名前と字面で R34 の答えが割れる）。
function stringCountOf(name, ctx) {
  for (let s = ctx.scope; s; s = s.parent) {
    if ((s.descs && s.descs.has(name)) || (s.params && s.params.has(name)) || (s.locals && s.locals.has(name))) return null;
  }
  const def = ctx.F.defs.get(name);
  if (!def || def.lambda || !ctx.F.stringCounts.has(def)) return null;
  return ctx.F.stringCounts.get(def);
}

// 種類は要らないが、名前を書いた所（`$x`・`@x` など）。未定義なら information だけ出す。
function touchName(name, ctx) {
  let imported = false;
  for (let s = ctx.scope; s; s = s.parent) {
    if ((s.params && s.params.has(name)) || (s.locals && s.locals.has(name))) return;
    if (s.hasImport) imported = true;
  }
  if (!ctx.F.defs.has(name) && !imported) reportUndefined(name, ctx);
}

// 止めない診断の重さ（§6.2 の門の表の「（情報）」「（警告）」の行）。重さはここの1か所で決め、出す所（pushDiag）は名前で引く。
// 2026-10-24 までは、どの診断も information で、出す所ごとに重さを書いていた。leftover-lambda は同じ日の §5 Q44 の答えで warning にした：
// 主の Claude「逆適用を廃止した後は、値の後ろに積まれて余る関数は、まず書き間違い（昔の逆適用の書き癖）だと思う。…warning に上げるのが
// 筋だと僕は思う。」に、U〔答え〕[2026-10-24 09:49 ebf18260]「全てその方向で良いと思う。」。warning でも断らない（止めない）のは今までどおり。
// bracket-excess は 2026-10-26 の R64（括りの名前は射影）：`~rest` の無い括りの仮引数に、名前より多い要素の List が来たと書いた時点で分かる所。
// 名前の無い要素は受けない（積み直さない）ので、黙って消えないように名指しする。断らないので information（主の Claude の案に U〔答え〕10-25 23:41）。
const DIAG_SEVERITY = {
  "undefined-name": "information",
  "pointfree-not-folded": "information",
  "bracket-excess": "information",
  // 2026-10-28 の片9b（R113）：書かなかったことにした構造体の欄 `x : _` の外に x が見える所（reportErasedField）。断らない（U〔答え〕[2026-10-27 14:49 58a809c9]
  // の「外の x が見えてしまう所だけ information で知らせる」）。本体の `x : _` の分は 2026-11-04 の寄せ1 で無くなった（本体の行は枝で何も定義しないので、隠す物が無い。R129）。
  "erased-unit-shadow": "information",
  "leftover-lambda": "warning",
  // 2026-10-27 の片8（R100）：`$` が関数以外を持ち上げた（U [2026-10-27 10:11 UTC 58a809c9]「$が関数以外のものを運んでいたら警告クラスだｗ」）。断らない。
  "dollar-non-function": "warning",
  // 片イ（R125）：本体の根に残った裸の関数は `_`（前の G16。U〔答え〕[2026-10-30 17:58 159479c9]「全部 _」）。重さは U [2026-10-30 15:28 159479c9]「…まぁinfomationは出そう。」
  // （手続きの最後の行への言葉。1行の本体と枝の値にも同じ重さを当てたのは主の Claude の読み）。
  "bare-function-return": "information",
  // 2026-11-04 の寄せ3（R133）：仮引数がファイルの定義か外の関数の仮引数を隠す（前は断り）。U〔答え〕[2026-10-29 12:12:33 32fe4b9c]「内側が勝つ」（押したボタンの文
  // 「…断りは information に下げる。」）。
  "name-shadow": "information",
};
function pushDiag(ctx, reason, name, message) {
  ctx.diag.push({ severity: DIAG_SEVERITY[reason], reason, name, message });
}

function reportUndefined(name, ctx) {
  if (!ctx.diag || ctx.F.reported.has(name)) return;
  // 書かなかったことにした `x : _`（R113）の x は、未定義の名前と同じに読むが、書いた人は名前を `_` と定義しているので知らせない（ファイルの定義と、使う所から見える
  // 構造体の欄）。本体の `x : _` は枝で名前を定義しない（寄せ1 の R128・R129）ので、その x が未定義なら条件の所で知らせる。
  if (ctx.F.erased.has(name)) return;
  for (let s = ctx.scope; s; s = s.parent) if (s.erasedNames && s.erasedNames.has(name)) return;
  ctx.F.reported.add(name);
  // 2026-10-28 の片9b（R111）から、未定義の名前は `_`（定義が無い＝解が無い）。言い分も書き直した（前は「値として読み、値は値の段で決めます（§4 R21）」）。
  pushDiag(ctx, "undefined-name", name, `\`${name}\` は定義されていません。定義が無い名前は \`_\` で、使う所で読みます（値の口では書いた \`_\` と同じ、参照の口では空の器。§4 R21・R111）。`);
}

// 畳まない2項の点なし（R32）を読んだ所。「おすすめは出来ない」（U〔答え〕2026-10-21 10:52「同じに読んでいいけど、おすすめは
// 出来ないという方向で良いと思う。」）を、断らずに information で見せる（この形と文面は決定の規則、主の Claude の案。§4 R32 の
// R の所）。書いた点なし1つにつき1回（row は括りの中の行で、書いた所ごとに1つ）。
// 実体ごとに本体を読み直しても、同じ書いた所なら出し直さない。読まない本体（R25）では出さない（undefined-name と同じ）。
function reportNotFolded(row, sym, ctx) {
  if (!ctx.diag || ctx.F.reportedPf.has(row)) return;
  ctx.F.reportedPf.add(row);
  pushDiag(ctx, "pointfree-not-folded", `[${sym}]`, `\`[${sym}]\` は畳めない2項の点なしなので、素の2引数の関数として読みました。おすすめはしません（§4 R32、§5 Q34）。`);
}

// ---- 仮置きの記録（§3.4「再帰は、A と仮置きして一巡し、食い違えばその関数を未知にし、外れた仮置きに頼った答えは確定した値で解き直す」） ----
//
// 種類（素の関数の本体の根・値の定義の種類・括りの関数の実体の本体の根・無名の素の関数の本体の根）は、定義どうしの依りの
// 上の不動点である。本体の根を解いている途中の関数をもう一度引いたら、A と仮置きして返す。その関数の本体の根が A でなければ、
// 仮置きが外れたので、その関数は未知（§3.4）。仮置きを使って出した答え（途中の関数より上で解いた本体の根や、値の定義の
// 種類）は、仮置きが当たったと分かるまで「仮の答え」として覚える。外れたら、その答えに古い（stale）と印を付け、次に読まれた
// ときに、確定した値で解き直す（freshMemo・collectedRoot）。そうしないと、外れた仮置きの上に立った答えが黙って残る。
//
// 前は、外れた仮置きに頼った答えを全部未知に替えていた。依り（deps）は、解いている途中の関数を引いた所より上の枠の全部に
// 付く（根に使ったかは見ない）ので、根に使っていない本体（`g : y ? (f 1 y) , 1`。根は積）まで未知になり、f と g のどちらを
// 先に解くかで g の根が割れた（§5 Q28。f が先なら `g 5 inc` は G2(a)、g が先なら A）。解き直すなら、依りが広くても、
// 増えるのは解き直しの手間だけで、答えは変わらない（利用者 2026-10-20「コンパイルの時間を早めたければ、定義の順序を
// 見直せとも言えるね！」）。依りを根に使った物だけに狭める（Q28 の案(1)）必要は無い。
//
// 印を付けるのは3つの所である。どれが欠けても、外れた仮置きの上に立った答えが残り、定義の順で答えが割れる。
// 1. 外れた枠の名簿（tentatives）にある答え（finishFrame）。
// 2. 当たった枠の名簿にある答えは、その枠が頼った仮置き（枠の deps）を引き継ぐ（finishFrame）。枠が当たったと言えるのは、
//    その枠が頼った下の仮置きも当たったときだけだからである。前は引き継がず、O・M・N の順に枠が積まれ、N が M の仮置きを、
//    M が O の仮置きを使い、M が A で閉じた後で O が外れると、N の答えが古いまま残った（確かめ 2026-10-20 の F1：
//    `h : x ? ⏎ ⇥f x ⏎ ⇥inc`・`f : x ? ⏎ ⇥g x ⏎ ⇥h x`・`g : x ? f x` は、h を f・g より先に置くと `g 5 inc` が A、ほかの並べ方は
//    G2(a)。A の側は黙った誤答。HEAD からある）。
// 3. 例外（門ではない例外。名前の輪など）で抜けた枠の名簿にある答え（abortFrame）。仮置きが当たったか確かめられないから
//    である。前は付けず、namesPattern が輪を握りつぶす道で、仮置きの上で A と出した関数の答えが残った（確かめ 2026-10-20 の
//    Q28V-3：`k : x ? h x` の h が未知なのに、w を v より先に置くと `k 5 inc` が A。HEAD からある）。輪の依りを持つ記録は、
//    根の答えが未知でも印を付ける（「値を含む輪」の注の、例外で抜けた枠）。
//
// 根の答えが未知なら、印を付けず、依りも持たせない（entryOf）。未知はいちばん下で、下の「単調」により、確定した値で解き
// 直しても未知のままだからである。前は未知の答えにも印を付けていたので、解き直しの中で外の枠がまた仮置きされて外れ直し、
// 同じ記録の解き直しが関数の数の指数で増えた（確かめ 2026-10-20 の Q28V-1・F3：f1〜f5 が後ろの f と g を呼び、g が積で
// f1〜f5 を呼ぶ形で、g の解き直しが 31 回。関数 16 個で 65535 回）。値の定義の種類は A・L・U と中身の形を持つので、根と
// 同じ「いちばん下」は言わず、いつも解き直す（値の定義は仮置きされないので、解き直しても外れは増えない）。値を含む輪を
// 断るようにした（§5 Q30、「値を含む輪」の注）後は、値の定義が仮置きを読めば断るので、値の定義の記録は仮置きに頼らず、
// 古くならない（この道は守りとして残す）。
//
// 答えが定義の順に依らない理由（P2「順序には依らない」）：根の種類で答えに効くのは「A か、A でないか」だけ（doneKind・
// instantiate）で、§3.4 の表の行は、引いた根が A のときだけ A を返し、A でなければ未知か門（門に当たった本体の根は未知）に
// する。だから引いた根が A から A でないへ下がっても、どの本体の根も上がらない（単調）。仮置きは A（上）から始め、外れたら
// 確定した値（A でない）で解き直すので、各関数の値は A から一度だけ下がる。下げるのは、上の仮置き（どれも本当の値より
// 下がっていない）のもとでも A にならないと分かった時だけなので、確定した値は、いちばん大きい不動点の値より下がらない。
// 外れた仮置きに頼った答えは、上の3つの印で全部解き直すので、着いた所は不動点である。だから、どの順に解いても、いちばん
// 大きい不動点に着く。解き直しの手間だけが順に依る。
// この理屈は、門が本体と前提の値だけで決まることを使っている。実体の深さの守りは、作る実体の鍵（渡された形）だけで決まる
// 普通の門なので、この理屈の中にある。実体の総数の守りは、確定した実体（最後の木の実体）だけを数えるので、断るかは
// 最後の木だけで決まる。理屈の外に残るのは、止まるための上限（作った実体の全部）だけである（INSTANCE_DEPTH_MARGIN の注、
// §5 Q25）。
//
// 解き直しの手間：外れた記録は未知に下がり、二度と枠を積まないので、各記録の仮置きが外れるのは一度だけである。印は外れか
// 例外のたびにしか付かないので、同じ記録の解き直しは、それまでの外れと例外の数を超えない（外れは記録の数まで）。上の
// Q28V-1 の形は、g の解き直しが関数の数（5 回）で済む。単調でない所（未知を受けると A になる所）があっても、未知の根は
// 解き直さないので、根が上がって振動することは無い（確かめ 2026-10-20 では、単調でない所は見つかっていない）。

// 同じ記録の解き直しの守り（実装の守り。値は言語の規則ではない）。上の「解き直しの手間」により、同じ記録の解き直しは、
// 外れの数（枠を積んだ鍵の数 F.frameKeys まで）と例外の数の和を超えない。例外は名前の輪のような止まる誤りで、続くのは
// namesPattern が握りつぶす所だけなので、鍵の数を超えて解き直すのは、例外が繰り返したか、上の理屈が破れたときである。
// そのときは読みを決めずに、名指しして断る（未知に固定して黙って進めると、断る側でも言い分が別の門になり、理由が見えない）。
// 前は 16 回で未知に固定していたが、未知の答えにも印を付けて解き直しが指数で増えたので、関数5つの普通のプログラムが上限を
// 踏み、定義の順で割れた（確かめ 2026-10-20 の Q28V-1・F2）。
function guardAgain(F, count, label) {
  if (count <= F.frameKeys.size) return;
  const e = new OperationError(
    `${label} の種類を、仮置きが外れたので ${count} 回解き直しました（枠を積んだ記録の数 ${F.frameKeys.size} を超えました）。解き直しが終わるかを決めないので、読みを決めません（§3.4）。`,
    { spec: `${SPEC} §3.4`, reason: "resolve-again-limit" }
  );
  withLine(e, F.line); // 解いていた行（R127）
  F.againRefused = F.againRefused || e; // namesPattern が握りつぶしても、resolve の最後に断る
  throw e;
}
function recordLabel(F, key) {
  if (key.isInst) return `括りの関数 \`${key.label}\` の実体（形 ${key.shapeText}）`;
  const fn = F.namedLambdas.get(key);
  if (fn) return `関数 \`${fn.name}\``;
  return F.defs.get(key.name) === key ? `定義 \`${key.name}\`` : "名前の無い関数";
}

// 枠：deps は仮置きの依り、cyc は輪の依り（「値を含む輪」の注。読んだ途中の枠から、そこまでの道筋への表）、tentatives・
// cycEntries はそれぞれを持つ記録の名簿。
function pushFrame(F, key) {
  const frame = { key, deps: new Set(), cyc: new Map(), cycEntries: [], consulted: false, failed: false, tentatives: [] };
  F.stack.push(frame);
  F.inProgress.set(key, frame);
  F.frameKeys.add(key);
  return frame;
}
function popFrame(F, frame) {
  const i = F.stack.lastIndexOf(frame);
  if (i >= 0) F.stack.splice(i, 1);
  F.inProgress.delete(frame.key);
}
// 例外で抜けた枠（「仮置きの記録」の注の3）。この枠を輪の依りに持つ記録は、未知でも古いと印を付ける（「値を含む輪」の注の、
// 例外で抜けた枠）。
function abortFrame(F, frame) {
  popFrame(F, frame);
  for (const t of frame.cycEntries) {
    if (!t.cyc.has(frame)) continue;
    t.cyc.delete(frame);
    t.stale = true;
  }
  for (const t of frame.tentatives) {
    t.deps.delete(frame);
    if (t.value !== "U") t.stale = true;
  }
  // この枠に頼って作った実体は、外れたのと同じに扱う（INSTANCE_DEPTH_MARGIN の注の3）。
  if (frame.pendingCalls) settlePending(F, frame, true, []);
  if (frame.tainted) taint(F); // 汚れは、抜けた先の計算に移る（refusalOf）
}
// 守りの断りの汚れ（INSTANCE_DEPTH_MARGIN の注の5、refusalOf）。守りに当たった所は門として未知になり、当たった `?` の新しい実体は
// 作らないので、それを捕まえた枠の答えと、その答えを読んだ計算は、守りが無いときの答えと違いうる。汚れた計算で出た門と値を
// 含む輪は、作り物かもしれないので、守りの断りより後に言う。汚れた計算の呼び出しは、確定した実体に数えない（noteCall）。
// いまの計算に汚れを付ける：解いている途中の枠か、枠が空なら、いま解いている行。
function taint(F) {
  if (F.stack.length) F.stack[F.stack.length - 1].tainted = true;
  else F.lineTainted = true;
}
const taintedNow = (F) => F.lineTainted || F.stack.some((f) => f.tainted);
// 解いている途中の枠 target の仮置きを読む。via は、記録を通して読んだときの、その記録から target までの道筋（一歩の
// 綴りの配列を返す関数。言い分を作るときだけ呼ぶ）。
// target より上に値の定義の枠があれば、仮置きで閉じずに断る（「値を含む輪」の注）。
function consult(F, target, via) {
  const i = F.stack.indexOf(target);
  if (i >= 0) for (let j = i + 1; j < F.stack.length; j++) if (F.stack[j].isValue) throw cycleError(F, i, via);
  target.consulted = true;
  if (i < 0) return;
  addCycle(F, i, target, via, true);
}
// 記録の輪の依りにある、解いている途中の枠 target を通る（「値を含む輪」の注の輪の依り）。consult と同じく、target より上に
// 値の定義の枠があれば断るが、仮置きの依りには入れない（解き直しは今までどおり）。
function passThrough(F, target, via) {
  const i = F.stack.indexOf(target);
  if (i < 0) return;
  for (let j = i + 1; j < F.stack.length; j++) if (F.stack[j].isValue) throw cycleError(F, i, via);
  addCycle(F, i, target, via, false);
}
// target（枠の並びの i）より上の枠と無名の関数の本体に、target への依りを足す。輪の依りには、そこから target までの道筋
// （上の一歩と via）も覚える（言い分の道筋。記録を通して見つけた輪でも、記録の中の段を抜かさない）。
function addCycle(F, i, target, via, tentative) {
  const chain = chainFrom(F, i);
  for (let at = 1; at < chain.length; at++) {
    const s = chain[at];
    if (tentative) s.deps.add(target);
    if (!s.cyc.has(target)) s.cyc.set(target, () => [...chain.slice(at + 1).map((u) => stepText(F, u)), ...(via ? via() : [])]);
  }
}
// 枠の並びの i から上の一歩：枠と、その間で解いている無名の素の関数の本体（beginCollect。枠を積まない）を、呼んだ順に。
function chainFrom(F, i) {
  const inner = F.collectors.filter((c) => c.start > i);
  const chain = [];
  for (let j = i; j < F.stack.length; j++) {
    chain.push(F.stack[j]);
    for (const c of inner) if (c.start === j + 1) chain.push(c);
  }
  return chain;
}

// ---- 値を含む輪（§5 Q30） ----
//
// 値の定義の種類を解いている途中に、その外側（枠の並びで下）で解いている途中の枠を仮置きで読んだら（consult）、輪に値の
// 定義が入っている。外側の枠の計算から値の定義へ入ったのだから外側はこの値に頼り、この値は外側を読んだのだから外側に
// 頼るからである。だから仮置きで閉じずに、名前の輪（name-cycle）で断る。値の定義から入った輪（nameKindOf の「解いている
// 途中」）と同じ断りで、どこから入っても同じ答えになる。
// 前は、値の定義から入れば断り、関数から入れば仮置きで閉じていた。`a : f 1`・`v : f 1`・`f : x ? v` は、v が先なら
// name-cycle、a が先なら f の仮置きで輪が閉じて、v が自分に頼っているのが見えず、黙って通った（§5 Q30）。v = f 1 = v で、
// 値はいつまでもできない（主の Claude「本当の欠陥は a が先だと通ってしまうほう」、利用者 2026-10-20「明らかにそうだと思う」）。
// 解決器の役目は、意味を決めることではなく、書いた人が見落とした輪（長い輪）を、入口に依らずに必ず見つけて、輪の道筋を
// 名指しすることである（利用者 2026-10-20「エンジニアかAIなら、書いていて気付くと思うし、それに気づきやすい言語だと
// 思ってるんだ」）。だから言い分に、輪に入っている枠を並べて書く（cycleError）。
// 輪に値の定義が無い物（関数どうしの再帰・括りの関数の実体の輪）は、今までどおり A と仮置きして閉じる（§3.4）。`$` で
// 遅らせた名前（`f : x ? x , $v`）は種類を引かない（touchName。前置 `@`・前置 `~` の名前も同じ）ので、輪に数えなかった。
// 2026-10-24 の R53（`$` は関数だけを運ぶ）から、`$v` は v が関数かを見るために v の種類を引く（classify の lookup）ので、輪に数える：
// `v : f 1`・`f : x ? x , $v` は、どの並べ方でも name-cycle（前は通った。v は積の A）。解いている途中の v を G20 で切ると、v から解き
// 始めれば G20、v を呼ぶ別の値（`a : f 1`）から解き始めれば輪になって、入口で門が割れる。前置 `@`・前置 `~` の名前は今のまま引かない。
// 名前が括りの関数かを覗く所（namesPattern。既定値と1項の `:` の左は解かない（P3）ので、G7 を探すためだけに名前の種類を
// 引く。peekUnreadNames）のうち、既定値を覗いた所を通る輪は輪に数えない（値はできる。namesPattern の注）。
// 値の定義の記録は、これで仮置きに頼らない（仮置きを読めば断るので、記録の依りは空のまま）。だから値の定義の記録が古く
// なることも無い（freshMemo の値の定義の道は、守りとして残す）。
//
// 輪の依り（cyc）。仮置きの依り（deps）は解き直しのための物で、根の答えが未知の記録には持たせない（entryOf。未知は解き
// 直さない）。だが輪を見つけるには、未知の記録も、計算の途中で読んだ解いている途中の枠を覚えていなければならない。覚えないと、
// 輪を値の定義の無い所で先に閉じ、閉じた関数の答えが未知だったとき、後で値の定義がその記録を読んでも、解いている途中の外の
// 枠を通ったことが見えない（`a : g 1`・`g : x ? ⏎ ⇥k x ⏎ ⇥vk`・`k : x ? ⏎ ⇥g x ⏎ ⇥k x ⏎ ⇥inc`・`vk : k 1` は、vk が先なら
// name-cycle、a が先なら k が未知で閉じて黙って通った。上の規則だけでは直らず、HEAD からある。2026-10-20 の確かめで、生成器の
// 4 万本のうち 9 本が、上の規則だけでは入口で割れた。1本は通る並べ方があった）。
// だから記録は、仮置きの依りとは別に、輪の依り（計算の途中で読んだ、解いている途中の枠。仮置きの依りを含む）を持ち、読む
// ときに通る（passThrough）。輪の依りは、値の定義の枠より下の枠を通れば断るためだけに使い、仮置きの依りには入れない。古い
// という印（stale）に使うのは、下の「例外で抜けた枠」だけで、そこでも未知を未知に解き直すだけである。だから断らないプログラム
// の答えは、輪の依りを足す前と同じである。閉じた枠の輪の依りは、その枠を
// 読んだ記録が引き継ぐ（finishFrame。「仮置きの記録」の注の2と同じ理由：記録 → 閉じた枠 → その枠が読んだ途中の枠）。
// 輪の依りは、途中の枠までの道筋も覚える（addCycle・finishFrame）。記録を通して見つけた輪の言い分に、記録の中の段（記録が
// 閉じる前に通った枠と、引き継いだ枠）を書くためである。前は記録の持ち主の1歩しか書かず、入口で言い分が替わり、無い辺を
// 名指しした（確かめ 2026-10-20 の Q30-V2：`a : g 1`・`g : x ? ⏎ ⇥m x ⏎ ⇥vk`・`m : x ? k x`・`k : x ? g x`・`vk : m 1` は、
// a が先なら「`vk` → `m` の本体 → `g` の本体」で、m の本体は g を引かない）。
//
// 例外で抜けた枠（abortFrame）。例外で抜けた枠は閉じないので、その枠を輪の依りに持つ記録へ、その枠が読んだ途中の枠を
// 引き継がない。未知の記録は古いと印を付けない（「仮置きの記録」の注）ので、そのままだと、輪の依りの欠けた記録が残る。
// 今それが起きるのは、namesPattern が例外（既定値を覗いた所を通る名前の輪と、名前の輪でない止まる誤り）を握りつぶすとき
// だけである（覗いた定義から上の枠が抜ける）。
// `a : g 1`・`g : x ? [[y : v 2] ? 5] x`・`v : h 1`・`h : x ? ⏎ ⇥k x ⏎ ⇥g x ⏎ ⇥vk ⏎ ⇥inc`・`k : x ? ⏎ ⇥h x ⏎ ⇥inc`・`vk : k 1` は、
// a が先なら、覗いた v の中で k が h を読んで未知で閉じ、h の行 `g x` が覗いた所を通る輪で抜ける。後で vk が k の記録を読んでも
// h を通ったことが見えず、vk → k → h → vk の輪が黙って抜けた（7 文の並べ方 5040 のうち 1680）。だから、例外で抜けた枠を
// 輪の依りに持つ記録には、未知でも古いと印を付け、次に読まれたときに解き直す。未知の記録を解き直しても、「仮置きの記録」の
// 注の「単調」により未知のままなので、答えは変わらない（変わるのは、輪を見つけるかだけ）。
// 2026-11-04 の寄せ2（R131）から、名前の無い関数（括りの `?`・`$[…]`）は既定値を持てない（`[[y : v 2] ? 5]` は読む段で止まる）。試験の dz の形（`dz :` ⏎
// `⇥⇥y : v 2` ⏎ `⇥? 5` と `g : x ? dz x`）は同じ輪を断るが、dz の既定値を覗くのは dz の定義の行なので、例外で抜けた枠を通らない（この印を外す変異でも通る）。
// この印を試すのは、構造体の欄に仮引数のブロックで書いた関数（`g : x ? o` ⏎ `o :` ⏎ `⇥m :` ⏎ `⇥⇥⇥y : v 2` ⏎ `⇥⇥? 5`）の形。寄せ2 の確かめでは、枝の値のブロックの
// 形（`g : x ?` ⏎ `⇥x > 0 :` ⏎ `⇥⇥⇥y : v 2` ⏎ `⇥⇥? 5` ⏎ `⇥0`）で試していたが、2026-11-06 の寄せ5（R134）からその形は読む段で止まるので、欄の形に移した
// （§5 Q86 は枝の値の形を「唯一の綴り」と書いていたが、欄の形も同じ所へ届いていた）。
//
// 残る割れ（§5 Q30 の未決、HEAD から）：輪を閉じる道が、仮置きの上でだけ通る形。`pb : [y ~ys] ? y + 1`・`g : x ? ⏎ ⇥pb [k x]
// ⏎ ⇥ek`・`k : x ? pb [g x]`・`ek : k 1`・`pf : g 1` は、ek が先なら k の仮置き（A）の上で g の本体が行 `ek` まで進んで
// name-cycle、pf が先なら確定した k（未知）で g の本体が1行目の G7 に当たり、行 `ek` を読まないので輪が無い。どちらも断る
// （黙った誤答ではない）が、言い分が入口で割れる。確定した値の上では輪が無いので、輪を見つけた道が仮置きに頼ったかまで見て
// 断りを遅らせるか、書いた名前だけで輪を見るか（`$` の無い名前。呼ばれない関数の値を欄に入れた `v : [s : p]` まで断る）は、
// 決めていない。

// 輪の言い分。輪は枠の並びの i から上の全部（i の計算が上の枠を順に呼び、いちばん上が i を読んだ）で、via があれば
// その記録（記録の持ち主と、記録が覚えた道筋）を通して i へ戻る。無名の素の関数の本体（枠を積まずに解く、collectedRoot）も、その間に挟む。書き始めは、輪の
// 中の値の定義のうち、ファイルに先に書いた物にする（同じ輪なら、どこから入っても言い分が替わらない）。
// 言い分を作ったら覚え（F.cycleRefused）、握りつぶされても resolve の最後に断る（guardAgain の againRefused と同じ作り）。
function cycleError(F, i, via) {
  const frames = chainFrom(F, i);
  const steps = frames.map((s) => ({ text: stepText(F, s), def: s.isValue ? s.key : null }));
  if (via) for (const text of via()) steps.push({ text, def: null });
  let at = steps.findIndex((s) => s.def);
  for (const d of F.defs.values()) {
    const k = steps.findIndex((s) => s.def === d);
    if (k >= 0) {
      at = k;
      break;
    }
  }
  const ring = [...steps.slice(at), ...steps.slice(0, at)];
  const path = [...ring, ring[0]].map((s) => s.text).join(" → ");
  const e = nameError(
    "name-cycle",
    `定義 \`${ring[0].def.name}\` の種類が、並びを通して自分の種類に依っています（輪：${path}）。輪に値の定義があるので、その値はいつまでもできません（§5 Q30）。`
  );
  e.cycle = ring.map((s) => s.text);
  withLine(e, F.defLines.get(ring[0].def) ?? F.line); // 言い分が名指しする定義の行（R127）
  e.cycleFrom = i; // 輪のいちばん下の枠（namesPattern が、覗いた所を通る輪かを見る）
  // 輪の値の定義（2026-10-28 の片8 の確かめの直し、R103：持ち上げを通る輪を通すかを、輪の定義から定義の時に下ろす所が見えるかで決める。ringDefsOf）
  e.cycleDefs = new Set(frames.filter((s) => s.isValue && s.key).map((s) => s.key));
  // 汚れた計算（守りの断りを捕まえた答えを読んだ所）で見つけた輪は、作り物かもしれない（taint、refusalOf）。汚れていない輪を先に覚える。
  e.suspect = taintedNow(F);
  if (!F.cycleRefused || (F.cycleRefused.suspect && !e.suspect)) F.cycleRefused = e;
  return e;
}
// 輪の道筋の一歩（枠の持ち主か、枠を積まない無名の素の関数の本体）。
function stepText(F, frame) {
  if (!frame.key) return frame.label || "名前の無い関数の本体";
  const k = frame.key;
  if (frame.isValue) return `\`${k.name}\``;
  if (k.isInst) return `\`${frame.label || k.label}\` を形 ${cutShape(k.shapeText)} で呼んだ実体の本体`;
  const fn = F.namedLambdas.get(k);
  if (fn) return `\`${fn.name}\` の本体`;
  return k.label || "名前の無い関数の本体";
}
function cutShape(text) {
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

// 無名の素の関数（`[w ? f [1 2]]`）の本体の根。名前の無い関数は自分を引けないので枠（pushFrame）は積まないが、本体を
// 解いている間に引いた仮置き（解いている途中の外の関数）は覚える（collector）。根は閉包で関数の desc に乗り、欄として
// 別の括りの関数の実体へ渡る。仮置きを覚えずに `() => root` で持つと、仮置きが外れても根が古いまま残り、それを読んだ
// 実体の答え（instMemo）も古いまま残る。行の順で、同じ関数が通ったり G7 になったりした（確かめ 2026-10-19 の A-F1）。
// 覚えた仮置きは名前つきの関数の根（bodyRootOf）と同じく記録に載せ、読むたびに consult する（readMemo）。
// 名前が無いので記録の地図（bodyMemo）には載らない。だから記録は閉包が持ち、本体を同じ範囲で解き直す手段（again）も持つ。
// 仮置きが外れて古くなったら、読まれたときに枠を積んで解き直す（bodyRootOf と同じく根だけ。枠を積むので F.stack は空に
// ならず、実体の木（materialize）も呼んだ記録（recordCall）も作らない。門に当たれば未知）。解き直している途中に、ほかの
// 関数の本体（欄で受けた実体など）を通ってまた読まれたら、bodyRootOf と同じく A と仮置きする（§3.4。枠を積み直すと、
// 同じ鍵の枠が2つ積まれ、内の枠を閉じたときに外の枠が解いている途中の印から消える）。
// label は輪の道筋に書く一歩（cycleError。無名の関数は書いた所で名指しする）。
function beginCollect(F, label) {
  const c = { start: F.stack.length, deps: new Set(), cyc: new Map(), label };
  F.collectors.push(c);
  return c;
}
function endCollect(F, c) {
  const i = F.collectors.lastIndexOf(c);
  if (i >= 0) F.collectors.splice(i, 1);
}
function collectedRoot(F, c, value, again) {
  const live = (d) => F.stack.includes(d);
  const cell = { entry: entryOf(value, [...c.deps].filter(live), [...c.cyc].filter(([d]) => live(d))), count: 0, label: c.label };
  for (const d of cell.entry.deps) d.tentatives.push(cell.entry);
  for (const d of cell.entry.cyc.keys()) d.cycEntries.push(cell.entry);
  const memo = { set: (_, entry) => (cell.entry = entry) };
  // 解き直しで本体が門に当たったら、読んだ側の枠の後ろは最後の木の道に無い（木では、書いた所で本体が門に当たる。
  // INSTANCE_DEPTH_MARGIN の注の2。instantiate の、門に当たる実体を呼んだ所と同じ）。
  const gate = (root) => {
    if (cell.gated && F.stack.length) F.stack[F.stack.length - 1].gated = true;
    return root;
  };
  return () => {
    const running = F.inProgress.get(cell);
    if (running) {
      consult(F, running);
      return "A";
    }
    if (!cell.entry.stale) return gate(readMemo(F, cell.entry, () => cell.label));
    guardAgain(F, ++cell.count, "名前の無い関数");
    const frame = pushFrame(F, cell);
    let root;
    let gated = false;
    try {
      root = again();
    } catch (e) {
      if (!isGate(e)) {
        abortFrame(F, frame);
        throw e;
      }
      root = "U";
      gated = true;
      if (e.guard) frame.tainted = true; // 守りの断りを捕まえた（汚れ、refusalOf）
    }
    cell.gated = gated || !!frame.gated;
    finishFrame(F, frame, memo, root);
    return gate(root);
  };
}
// owner は記録の持ち主（輪の道筋に書く一歩を返す関数）。記録から途中の枠までの道筋は、持ち主の一歩と、記録が覚えた道筋。
function readMemo(F, entry, owner) {
  const via = (d) => () => [owner(), ...(entry.cyc.has(d) ? entry.cyc.get(d)() : [])];
  for (const d of entry.deps) consult(F, d, via(d));
  for (const d of entry.cyc.keys()) if (!entry.deps.has(d)) passThrough(F, d, via(d));
  if (entry.tainted) taint(F); // 汚れた記録を読んだ（taint）
  return entry.value;
}
// 記録を引く。古ければ記録を消して null を返し、呼んだ側が解き直す（そのときには、外れた仮置きの関数の記録は確定して
// いる）。解き直しの回数は guardAgain が見る。
function freshMemo(F, memo, key) {
  const entry = memo.get(key);
  if (!entry || !entry.stale) return entry || null;
  memo.delete(key);
  const n = (F.againCounts.get(key) || 0) + 1;
  F.againCounts.set(key, n);
  guardAgain(F, n, recordLabel(F, key));
  return null;
}
// 記録。根の答えが未知なら依りを持たせない（「仮置きの記録」の注：未知は解き直さない。読んだ側にも依りを渡さない）。
// 輪の依り（cyc、「値を含む輪」の注）は、未知でも持たせる。
// cyc は [途中の枠, そこまでの道筋] の並び。
function entryOf(value, deps, cyc) {
  return { value, deps: new Set(value === "U" ? [] : deps), cyc: new Map(cyc) };
}
// 枠を閉じて記録に載せる（「仮置きの記録」の注の1・2）。この枠の仮置きが外れたら（failed）、それに頼った答えに古いと印を
// 付ける（解き直しは読まれた時）。当たったら、それに頼った答えは、この枠が頼った仮置きを引き継ぐ。
function finishFrame(F, frame, memo, value) {
  popFrame(F, frame);
  const entry = entryOf(
    value,
    [...frame.deps].filter((d) => d !== frame),
    [...frame.cyc].filter(([d]) => d !== frame)
  );
  if (frame.tainted) entry.tainted = true; // 汚れた答え（taint）
  memo.set(frame.key, entry);
  for (const d of entry.deps) d.tentatives.push(entry);
  for (const d of entry.cyc.keys()) d.cycEntries.push(entry);
  // 輪の依りは、当たっても外れても引き継ぐ（記録はこの枠の答えを読んだので、この枠が読んだ途中の枠も通っている）。道筋は、
  // 記録からこの枠まで、この枠の一歩、この枠からその途中の枠まで。
  for (const t of frame.cycEntries) {
    const toFrame = t.cyc.get(frame);
    if (!toFrame) continue;
    t.cyc.delete(frame);
    for (const [d, toD] of entry.cyc) {
      if (t.cyc.has(d)) continue;
      t.cyc.set(d, () => [...toFrame(), stepText(F, frame), ...toD()]);
      d.cycEntries.push(t);
    }
  }
  for (const t of frame.tentatives) {
    t.deps.delete(frame);
    if (t.stale || t.value === "U") continue;
    if (frame.failed) {
      t.stale = true;
      continue;
    }
    for (const d of entry.deps) {
      if (t.deps.has(d)) continue;
      t.deps.add(d);
      d.tentatives.push(t);
    }
  }
  // この枠に頼って作った実体（INSTANCE_DEPTH_MARGIN の注の2・3）。外れたら作った実体の数から外し、当たったら、この枠が頼った
  // 仮置きに頼り直す。外れたかは仮置きの記録と同じ（読まれて A でない）。最後に置く（総数の門に当たっても、記録は済んでいる）。
  // 汚れた答えは、それを読んだ呼んだ側の計算と、仮置きを読んで頼った答えにも移る（taint）。
  if (frame.tainted) {
    taint(F);
    for (const t of frame.tentatives) t.tainted = true;
    for (const c of frame.pendingCalls || []) c.onPath = false; // 汚れた答えに頼った呼び出しは数えない
  }
  if (frame.pendingCalls) settlePending(F, frame, frame.failed || (frame.consulted && value !== "A"), entry.deps);
}

// 素の関数でも括りの関数でもない関数（アリティの分からない関数）の fn。既定値のある関数（`?` の左に `:` がある）には印と
// 仮引数の数を付ける：書いた `_` を実引数に当てた形は、既定値のある口なら既定値（R39）、ほかは消える（R105。最初は全部 G15 で断り（値は既定値だが種類は
// §5 Q8 で未決、U〔答え〕10-21 03:11）、片イの R126 で G15 は無くなった）、
// 穴 `!_` は既定値があっても穴にする（tryHole）。仮引数の数は defaultsArity。数え方で振る舞い（既定値か消えるか・穴の k = n と k ≠ n）が分かれるので、
// 実体の鍵（fnKey）にも印と数を入れる。
// 既定値のある口の位置（defaultAt、R39）：前から数えた仮引数ごとに、既定値のある仮引数か。n が数えられなければ null。書いた `_` が
// 既定値のある口に当たれば既定値という値（defaultUnit・tryHole）、ほかは消える（片イの R126 の前は、位置が数えられなければ G15）ので、実体の鍵にも入れる。
// 値の口の位置（bareAt、2026-10-27 の R94）：前から数えた仮引数ごとに、値の口（裸の名前か、既定値のある口）か。括りの仮引数（`[a b]`）は参照の口で false。
// 書いた `[]` が値の口に着いたら、同じ位置に書いた `_` と同じに読む（R94、valuePortOf・emptyArgsAtValue）ので、どの口が値の口かを持つ。n が数えられなければ null。
// 2026-11-04 の寄せ2（R131）から、既定値を書けるのは字下げの仮引数のブロックの `名前 : 既定値` の行だけ（括りの中の既定値は読む段で止める、bracketDefault）。
// だから既定値のある関数の `?` の左はいつも仮引数のブロックで、defaultsBare・defaultsSlots・defaultsArity もブロックの行だけを数える（前は1行の並びの中に `:` の
// ある括り `[x : 1]` も既定値のある口に数えていた）。
function otherFn(left) {
  if (!left || !treeHasColon(left)) return { type: "other" };
  const n = defaultsArity(left);
  return { type: "other", defaults: true, n, defaultAt: n === null ? null : defaultsSlots(left), bareAt: n === null ? null : defaultsBare(left) };
}

// 既定値のある関数の、仮引数ごとの「値の口か」（R94）。数え方は defaultsArity・defaultsSlots と同じで、値の口は、裸の名前の行と `名前 : 既定値` の行。
// 括りの行（`[a b]`）は括りの仮引数（参照の口）。
function defaultsBare(left) {
  return left.terms[0].core.rows.map((row) => row.type === "op" || !!bareName(row.terms[0]));
}

// 既定値のある関数の、仮引数ごとの「既定値のある口か」（R39）。数え方は defaultsArity と同じで、既定値のある口は、仮引数の
// ブロックの `名前 : 既定値` の行。
function defaultsSlots(left) {
  return left.terms[0].core.rows.map((row) => row.type === "op");
}

// 既定値のある関数の仮引数の数（§3.4 の言葉。既定値のある仮引数も1つ）。1つと数えるのは、裸の名前・括り（R24 と同じく
// 中身に依らず1つ）・字下げの仮引数のブロックの、裸の名前か括り1つの行と `名前 : 既定値` の行だけ。ほかの形（ブロックの
// 1行に名前が2つある行 `a b` など）は、parseParams が名前を別に数えるので数が割れる（前置 `~` の仮引数は、2026-10-26 から定義の所で G22、R67）。割れたまま n を決めると、
// 穴がどの口を占めるかを外れた n で決める（`gz :` ⏎ `⇥⇥a b` ⏎ `⇥⇥c : 3` ⏎ `⇥? a` の `gz !_ 3` が、仮引数3つの関数を
// k = 2 の穴にした）ので、決めない（null。`!_` は G7 で断る）。
function defaultsArity(left) {
  // 既定値のある関数の左は仮引数のブロック（R131。上の otherFn の注）。ブロックでなければ数えない。
  if (!left || left.type !== "seq" || left.terms.length !== 1 || !isBareBlock(left.terms[0], "indent")) return null;
  const isParamTerm = (t) => !!bareName(t) || isBareBlock(t, "bracket");
  const one = (row) =>
    !!row && ((row.type === "seq" && row.terms.length === 1 && isParamTerm(row.terms[0])) || (row.type === "op" && row.sym === ":" && !!singleBareName(row.left)));
  const rows = left.terms[0].core.rows;
  return rows.every(one) ? rows.length : null;
}

// 名前の種類（§2「ファイルの定義の名前」）。`?` なら L、それ以外は右辺を解いた根の種類。値なら中身の形も持つ（R24：
// 名前を通して渡しても、生まれは右辺のもの）。
function nameKindOf(F, def) {
  if (def.lambda) {
    if (def.pattern) return { k: "L", fn: patternFn(F, def.lambda, def.pattern, F.fileScope, def.name) };
    if (!def.plain) return { k: "L", fn: otherFn(def.lambda.left) };
    // op・label は、裸の仮引数の札（paramTag）と、Reader を口に渡した呼び出しの言い分のため（readerAtPlain）。
    const fn = { type: "plain", origin: "plain", n: def.n, getBodyRoot: () => bodyRootOf(F, def.lambda), idKey: lambdaKey(def.lambda, F.fileScope.key), op: def.lambda, label: def.name };
    plainInstantiable(F, fn, def.lambda, F.fileScope);
    return { k: "L", fn };
  }
  const memo = freshMemo(F, F.valueMemo, def);
  if (memo) return readMemo(F, memo, () => `\`${def.name}\``);
  // 解いている途中の値の定義をもう一度引いた：値を含む輪（「値を含む輪」の注）。輪はその枠から上の全部。
  const running = F.inProgress.get(def);
  if (running) throw cycleError(F, F.stack.indexOf(running));
  const frame = pushFrame(F, def);
  frame.isValue = true; // 値の定義の枠（consult が、この枠より下の仮置きを読ませない）
  const restoreNest = freshNest(F);
  let value;
  try {
    // 定義の行（resolveDefine）と同じ道で右辺を解く。右辺は閉じた1つの項で、ほかの並びと同じく R52 を当てる（`v : 5 inc` の v は 5。§5 Q50 の
    // 答え、resolveDefine の注）。片方だけ当てると、定義の行と名前の種類が割れる（R52 の最初の版で作る途中に見つけた）。
    // 受け皿 dead：右辺に値の上に積まれて口が開いたまま閉じた関数があるか（R59、`$名前` の先。deadOfDef）。
    const dead = [];
    const root = resolveTree(def.rhs, { F, scope: F.fileScope, diag: null, dead });
    // 右辺そのものの余る関数と、右辺の木（別名の引き継ぎは、引く所で木から見る。deadOfDef・aliasDeadOfTree）。
    F.deadDefs.set(def, dead[0] || null);
    F.defRoots.set(def, root);
    // 右辺の木から名前の desc と付きの物を作るのは valueOfRoot の1か所。
    const v = valueOfRoot(F, root, F.fileScope);
    value = v.value;
    if (v.count !== null) F.valueCounts.set(def, v.count);
    else F.valueCounts.delete(def);
    if (v.chars !== null) F.stringCounts.set(def, v.chars);
    else F.stringCounts.delete(def);
    F.unitDefs.set(def, v.unit);
    F.hexDefs.set(def, v.hex);
    F.intDefs.set(def, v.int);
  } catch (e) {
    abortFrame(F, frame);
    throw e;
  } finally {
    restoreNest();
  }
  finishFrame(F, frame, F.valueMemo, value);
  return value;
}

// 値の定義の右辺を解いた木 root から、名前の desc（value）と、名前の葉に付ける物（器の数 count・文字の数 chars）・書いた `_` を指すか（unit）・番地の字面か（hex）。
// ファイルの値の定義（nameKindOf）の1か所（前は関数の本体の局所の定義（R80）も使っていた。寄せ1 の R128 で本体に局所の定義は無くなった）。scope は右辺を解いた
// 範囲（`_` と番地の字面を名前の先まで辿る所）。
function valueOfRoot(F, root, scope) {
  const value = { k: root.kind.k, fn: root.kind.fn };
  {
    // `:` はメタなので、名前は右辺の式の印を持ち越す（R42 の読み7）：`w : vs~` の w は撒く項のまま（`inc w` は `inc vs~` と同じく
    // 未知、`w inc` は `vs~ inc` と同じく inc を積む。2026-10-23 までは G9）。前は撒く印が落ちて、`inc w` が A、`inc vs~` が未知で割れていた。
    // 2026-10-24 の R51 からは、撒いた器の desc（of）も持ち越す（`inc w` は `inc vs~` と同じ書き下しで、要素の desc を読む）。
    if (root.kind.spread) {
      value.spread = true;
      if (root.kind.of) value.of = root.kind.of;
    }
    // 関数を指す番地の印（R49）も持ち越す（`p : $inc` の `map p vs` は `map $inc vs` と同じ）。値を読む参照の印（R60）も同じ（`q : $vs` の q は `$vs`）。
    if (refOf(root.kind)) value.ref = root.kind.ref;
    if (liftOf(root.kind)) value.lift = true; // 先の種類の分からない持ち上げ（2026-10-27 の片8）も同じ
    // 2026-10-27 の片7 の確かめの直しから、値を読む参照の印も、構築の中の余ったラムダが消えて1項だけ残った右辺（`w : $vs !_`、vanishedOne）から持ち越す
    // （下の点・差の印と同じ。前は落ちて、`w + 1` が `$vs + 1` と割れて黙って通った。HEAD から）。
    const vrefRoot = vrefOf(root.kind) || vrefOf(vanishedOne(root) ? descOfTree(root) : null);
    if (vrefRoot) value.vref = vrefRoot.vref;
    // 番地の算術で作った点・差の印（R62）も同じ（`p : $vs + 0x10` の `p - $vs` は `($vs + 0x10) - $vs` と同じ差）。構築の中の余ったラムダが消えて1項だけ
    // 残った右辺（`w : ($vs + 0x10) !_`、vanishedOne）からも持ち越す（括り1つの rowsInfo と同じ。2026-10-26 の確かめの直し）。
    const addrRoot = addrOf(root.kind) || addrOf(vanishedOne(root) ? descOfTree(root) : null);
    if (addrRoot) value.addr = addrRoot.addr;
    // 点の幅（R97）も、名前は持ち越す（`p : $vs` の `p + 0x3` は `$vs + 0x3` と同じ）。
    const marked = vrefRoot || addrRoot;
    if (marked && marked.w) value.w = marked.w;
    // 右辺が中身の見える器なら、撒いたときの数（R34 の最後の括り `[~c]` に1つで入ったとき、[x] ≅ x で数える。restCloseKind）。
    // 数は desc に入れず、名前の葉にだけ付ける（valueCountOf）。desc に入れると、括りの関数に渡した desc に乗って、括りの仮引数
    // （`[~r]`・`[x ~xs]` の尾）に器全体の数が入り、しかも実体の鍵（descKey）は数を見ないので、長さの違う器が1つの実体を分け合って
    // 先に作った方の答えを後の方が黙って使った（確かめで見つかった、2026-10-23。`ap : [~r] ? (f4 !_) 1 r` の `ap vs`・`ap ws` の
    // 答えが行の順で変わった）。実体の中では長さを書かない（R24）ので、仮引数の名前は数えない（未知）。
    // 右辺が撒く項（`w : vs~`）なら、撒いた器の数（R51 の書き下しが `inc w` で `inc vs~` と同じ数を見る。flowCount）。
    const count = root.kind.spread ? flowCount(root) : writtenLength(root);
    // 右辺が文字列なら、文字の数（撒いた流れの数だけが読む。stringCountOf）。
    const chars = root.kind.spread ? null : stringLength(root);
    const el = visibleElements(root);
    if (el) value.elements = el;
    const sh = shapeOfTree(root);
    if (sh) value.shape = sh;
    // 右辺が書いた `_` を指すか（R56、2026-10-25）。`q : _` の `$q` は `$_` と同じ零射の番地。2026-10-26 の R63（§5 Q64 の答え）から、desc にも印 zero を
    // 付け、実体の鍵に入れる（括りの関数に欄・要素・裸の仮引数で渡しても、実体の中の `$s` が零射の番地と分かる。internDesc の `_`）。R56 の片では desc に
    // 入れなかった（入れると実体の鍵が見ない印が実体を跨いで分け合われうる、pointsToMark の注。R63 で鍵に入れたので、その心配は無い）。
    // 2026-10-28 の片9b の確かめの直し：右辺の木そのものが印 zero を持つ物（無い欄を引いた `ob ' c`・`no ' s`（R115）、`$v ' 1` の領域の外（R102））も、名前は同じ印を
    // 持ち越す（`:` はメタ。括り1つの rowsInfo の `zeroOf(root.kind)` と同じ）。前は木で `_` を指す物（pointsToMark）だけを見ていて、`w : ob ' c` の w が印を落とし、
    // `inc (ob ' c) 5` は `(apply inc 5)`、`inc w 5` は `(construct (apply inc w) 5)` と割れ、本体の根の G16 も名前1つ挟むだけで抜けていた（確かめる人の指摘）。
    const unit = pointsToMark(root, { F, scope }) || !!zeroOf(root.kind);
    if (unit && value.k === "A" && !value.shape && !value.spread && !value.ref && !value.vref && !value.addr) value.zero = true;
    // 右辺が番地の字面か（R62）：`n : 0x10` の `$x + n` は `$x + 0x10` と同じく、点に足す差（hexOperand）。desc には入れない（番地の字面は中身の見えない
    // A のまま、解決器は今の扱い。顔は位置で決まり、点に足し引きする所でだけ差と読む）。
    const hex = hexTree(root, { F, scope });
    // 右辺の値が Int か Int の List と書いた所から分かるか（R97：`$名前` の指す要素の幅。"scalar"・"list"・null、intName が読む）。
    const int = intTree(root, { F, scope });
    return { value, count, chars, unit, hex, int };
  }
}

// 素の名前つき関数の、本体の根の種類（§3.4）。
function bodyRootOf(F, lambdaOp) {
  const memo = freshMemo(F, F.bodyMemo, lambdaOp);
  if (memo) return readMemo(F, memo, () => `\`${F.namedLambdas.get(lambdaOp).name}\` の本体`);
  const running = F.inProgress.get(lambdaOp);
  if (running) {
    consult(F, running);
    return "A";
  }
  const frame = pushFrame(F, lambdaOp);
  const restoreNest = freshNest(F);
  let value;
  try {
    // 受け皿 dead：本体に値の上に積まれて口が開いたまま閉じた関数があるか（R59、`$名前` の先。deadOfDef）。
    const dead = [];
    const ctx = { F, scope: F.fileScope, diag: null, dead };
    const lam = makeLambda(lambdaOp, ctx);
    value = resolveBody(lambdaOp.right, { ...ctx, scope: lam.scope }).rootKind;
    F.deadBodies.set(lambdaOp, dead[0] || null);
  } catch (e) {
    if (!isGate(e)) {
      abortFrame(F, frame);
      throw e;
    }
    value = "U"; // 本体が門に当たる。根は決まらない（行を解くときに同じ門で断る）
    if (e.guard) frame.tainted = true; // 守りの断りを捕まえた（汚れ、refusalOf）
  } finally {
    restoreNest();
  }
  if (frame.consulted && value !== "A") {
    value = "U";
    frame.failed = true;
  }
  finishFrame(F, frame, F.bodyMemo, value);
  return value;
}

// ---------------------------------------------------------------------------
// 括りの関数の実体（R24・R25）
// ---------------------------------------------------------------------------
//
// 括りの関数の本体の読み（適用か構築か）は、渡された物の生まれで決まる（R24）。だから本体は、呼ばれて形が決まった
// ときにだけ、形ごとに解く（実体）。定義の所では解かない（R25）。呼ばれる前に読みを1つに決めるのは、関係より先に
// 対象を定めることで、`__` の短絡と同じ誤りになる。一度も呼ばれない関数は `_` と同型で、矛盾ではないので断らない。
//
// 実体は2段で解く。素の関数の本体（bodyRootOf と、定義の行を解くとき）と同じ分け方である。
// 1. 根の種類（instRootOf）：再帰は A と仮置きして一巡し、食い違えば未知（§3.4・R24）。門に当たれば未知にして
//    止めない。仮置きの上で解いた木は、仮置きが外れると黙って違う木になるので、ここでは木を残さない。
// 2. 木（materialize）：解いている途中の種類が無い（F.stack が空）ときに、仮置きの済んだ答えで本体をもう一度解き、
//    木か門を残す。門に当たった実体は、呼んだ行で断る（R25）。呼んだ所が別の実体の本体の中なら、その実体も同じ門で
//    失敗し、いちばん外の呼んだ行で1回だけ、関数の名前と形を足して投げ直す。
//    分け合った実体を、まだ歩いていない物（callIdent）で呼んだら、本体をその物で歩き直して記録だけを足す（walkCalls）。
//
// 定義の行の木（`(inst 形 本体)` の並び）は、ファイルの全部の行を解き終えてから埋める（resolve の最後）。だから
// 呼ぶ行が定義の前でも後でも、定義の行の木は同じになる。行を前もって全部解いて実体を集める段は要らない。
//
// 実体（の答え）は鍵（書いた `?` の綴り・範囲・渡された物の形）で共有するが、定義の行に描くのは、その `?` を
// 通って呼ばれた実体だけにする（F.calls、recordCall）。同じ綴りの別の関数の呼び出しで描くと、呼ばれていない関数の
// 行に inst が出て、R25 の「一度も呼ばれない括りの関数は defer」が破れる。逆に、分け合った実体の本体の中の呼び出しを
// 作った側の物でしか記録しないと、呼ばれた方の行が defer のまま残る（呼んだ物の同一性、callIdent の注）。門の名指しも、
// 呼んだ行で使った関数の名前にする（instanceError）。実体を最初に作った関数の名前にすると、ほかの行の有無で名指しが変わる。

// 形を変えながら自分（か、自分を呼ぶ関数の輪）を呼び続ける再帰（`f : [x ~xs] ? f [xs xs]`）は、実体が有限に収まら
// ない。名指しせずに未知や仮置きのまま止めると黙って違う木になるので、守りに当たったら読みを決めずに断る。守りは4つある。
// 1と2は実体の鍵（渡された形）と確定した答えだけで決め、枠の積み方や作った実体の履歴では決めない。だから当たるかは、
// ほかの門と同じく本体と前提の値だけで決まり、「仮置きの記録」の理屈（どの順に解いても同じ不動点に着く）の中にある。
// 3と4は止まるための資源の守りで、計算の道で決まる（理屈の外。別の reason で断る）。
// どの守りも、当たったら門として投げる（根の種類を解く所では未知になり、そこから先は浅く止まる）。1 は普通の門で、呼んだ行
// で名指しする。2〜4 は覚えて（guardRefusal）、resolve の最後に言う。当たった `?` では、それから新しい実体を作らない（ほかの
// `?` は解き続ける）。前段（名前の種類と素の関数の本体の根）でも行でも、断ってもその先を解き続け（解き直しの守りと値を含む輪
// だけは、そこで止める）、言うのは、解き直しの守り → 値を含む輪 → 2（ファイル全体の最後の木で決まる）→ 最初に断った行の門 →
// 3・4 → 汚れた所の輪と門の順（refusalOf、注の5）。3・4 は計算の道で決まり、当たった後は実体を作らせないので、汚れていない最後の
// 木の門を先に言う。断る行が2つ以上なら行の順に言うのは今までどおりで、資源の守りの前後では、断るかが解く順に依りうる（§5 Q25 の
// 未決）。
//
// 1. 深さ（INSTANCE_DEPTH_MARGIN）：作る実体の鍵の入れ子の深さ（instanceDepth）が上限（F.depthLimit）を超えたら、その実体を
//    作らずに G7 で断る。根の種類を解く所（instRootOf）では未知になり、木を残す段（materialize）が同じ鍵にまた当たって、呼んだ行で
//    名指しする（R25）。深さは鍵の綴りだけで決まり（番号に持たせる、depthOf）、上限は解く前にソースだけから決める（writtenDepth）
//    ので、どの定義・行から先に解いても、記録を引いても同じになる。
//    数え方：中身の見えない A・未知・数の葉は 1、構造体と List は中身のいちばん深い物に 1 を足す。関数の葉は、書いた所の
//    範囲の深さ（実体の中で書いた閉包の鍵は、書いた所の範囲の鍵＝実体の鍵を持つ。fnDepth）で、ファイルの範囲なら 1。括りの
//    関数の部分適用と合成は、元の関数と当てた物（裸の仮引数の位置は A）・中の関数のいちばん深い物に 1 を足す。素の関数の
//    部分適用と穴は、元の関数と同じ（鍵に当てた物が入らない）。門で見る実体の深さは、括りの仮引数に当てた物のいちばん深い物
//    （裸の仮引数は A なので 1）。関数を書いた所の深さは入れない（書いた所の実体は、その実体の門で見てある）。実体の範囲の
//    深さ（中で書く閉包の深さ）は、当てた物の深さと、書いた所の範囲の深さの大きい方。
//    上限：（この数 × 書いた括りの関数の数（2026-10-26 の R81 から、実体を作る素の関数も数える） + 1）× 書いたいちばん深い形（writtenDepth。名前を通した深さ、前の定義を指して深く
//    なる鎖も書いた分）。呼んだ行に書いた形はいちばん深い形まで（ここで + 1）で、入れ子の道（実体の本体が実体を作る道）で括りの
//    関数を1つ通るたびに、呼んだ所に書いた形の分（いちばん深い形まで）しか深くならない（受けた物を、書いた形の中に入れて渡す
//    だけ）。だから、どの括りの関数もこの数の回までしか通り直さない道（括りの関数を この数 × 書いた括りの関数の数 回まで通る道）
//    は、上限までしか届かない。前の版の深さの守り（同じ `?` の実体の入れ子 32）を通った形は、どれも上限を越えない。
//    越えるのは、同じ `?` を何十回も通り直して形が深くなり続ける再帰だけである（前の「この数 ×（括りの関数の数 + 1）× いちばん深い形」
//    は、この道の届く深さより 31 × いちばん深い形だけ大きく、深くなり続ける再帰をその分遅く断った）。書いた字面・書いた部分適用と合成の鎖
//    （`q1 : pp [f : q0] [f : q0]`…）・値や閉包を欄で渡す別々の関数の鎖・減っていく形の再帰・輪の中で深くなってから戻る有限の
//    再帰は断らない。形が深くなり続ける再帰（`f : [x ~xs] ? f [xs xs]`、閉包が前の実体の中で書かれる `f : [s] ? f [s : [y ? s y]]`
//    など）は、書いた形が浅ければ深さの門で、上限が大きければ先に入れ子の数の守り（注の4）で断る。前（同じ日のまとめ直しの
//    後）は上限を固定の 32 にしていたので、32 段より深い字面や書いた鎖を、有限で値の決まる形でも断った（主の Claude の指摘、
//    利用者の承認で直した。2026-10-20）。
//    その前は同じ `?` の実体の入れ子を数え、どの順に解いても同じ段になるよう数え直していた（枠の並びの数え方・記録の下の
//    入れ子・輪の頭の段・当たった記録を resolve の最後に断る作り。2026-10-20 の自己点検の SC-1・SC-2）。それでも輪の中は
//    近似で、上限のちょうど上では入口で割れえたうえ、当たるかが枠の積み方で決まるので、理屈の外に置いていた。
//    穴（前から、§5 Q25 の未決）：合成の子の合成は開く（R8）ので、同じ合成を2つ並べて渡す再帰（`f : [g] ? f [g : g g]`）は、
//    合成の中の関数の数が倍々になっても深さが増えない。総数の上限に届く前に鍵の長さが溢れ、内部の例外になる（ヒープが尽きてプロセス
//    ごと落ちることもある）。2026-10-24 から、合成の幅の資源の守り（注の6、COMPOSE_WIDTH_LIMIT）で断る。深さに数えるかは未決のまま。
// 2. 総数（INSTANCE_TOTAL_LIMIT）：深さに上限があっても、形が枝ごとに増えると実体は 2^深さ になり、解決が止まらない。同じ
//    `?`（書いた所。どの範囲で書いた物も1つ）を通って呼んだ、確定した実体の数がこの数を超えたら G7 で断る。同じ綴りの関数は
//    実体を分け合うが、呼んだ `?` のそれぞれで数える（綴りで数えると、別々に書いた2つの関数が上限を分け合った。確かめ
//    2026-10-20）。確定した実体とは、最後の木の道にあると言える呼び出しの実体である（noteCall）：呼んだときに、解いている途中の
//    どの枠も仮置きに頼っておらず（pendingNow）、門に当たる実体を呼んだ後でもない（gated）物、頼っていた枠が全部当たって閉じた
//    物（settlePending）、枠が空のとき（木を残す段）に呼んだ物。確定した値だけを読んで辿った道は木を残す段がもう一度辿るので、
//    どれも最後の木の実体である。門に当たる実体を呼んだ後ろは、木を残す段がそこで呼んだ行ごと断るので、最後の木に無い（根の
//    種類を解く所は、門を未知にして先へ進む）。外れた仮置きの上でだけ作った実体も、確定した値の上では作られないので数えない。
//    だから断るのは「最後の木の実体の数が上限を超える」ときで、どの順に解いても同じになる。前は作った実体の全部を数えたので、
//    上限の前後で断るかが定義の順で割れた（`g : x ? ⏎ ⇥f x ⏎ ⇥inc` と `f : x ? p [s : (g x)]` に、p の実体を 511 個作る行を
//    足すと、g が先なら仮置きの上の p|{s:A} も数えて G7、f が先なら通る。§5 Q25 の SC-3）。門に当たる実体の後ろの実体も数えて
//    いたので、`t : x ? (bad [y : 1]) , (p [m : 1])` と p の実体を 512 個作る行は、行の順で G5 と総数の G7 に割れた（前の版も）。
//    枝ごとに形が増える再帰（`g : [x ~xs] ? (g [[a : xs] [a : xs]]) , (g [[b : xs] [b : xs]])`）は、最初の枝を深さ優先で降りて
//    深さの門に当たるので、最後の木はそこで断る形で、残りの枝は最後の木に無い。根の種類を解く所の増え方は 3 で止まる。最後の木の
//    深さの門は、3 に当たった答えを読んだ所（汚れた計算、注の5）で出るので作り物と見分けられず、3 を言う（refusalOf）。
// 3. 作った実体の数（INSTANCE_WORK_LIMIT）：2 で数えない実体（仮置きに頼った物と、門に当たる実体の後ろの物）は、増え続けても
//    2 では止まらない（`g : [x ~xs] ? (g xs) , (g [[a : xs] [a : xs]]) , (g [[b : xs] [b : xs]])` は、同じ形で自分を引いた後なので、
//    後ろの実体はどれも g の仮置きに頼る）。だから同じ `?` で作って外れていない実体（確定した物と、まだ仮置きに頼っている物と、
//    門の後ろの物）にも 2 の 2 倍の上限を置く（instance-work-limit）。頼っていた枠の仮置きが外れたら、その実体は数から外す
//    （discard）。外さないと、外れた仮置きの世界ごとに実体が積み増し、上限の前後で定義の順で割れた（f が g と h の仮置きの上で
//    同じ p の実体を 342 個ずつ作り、g → h → f の順に解く並べ方だけ 1026 個で断る。確かめ 2026-10-20）。外した後に残る割れは、
//    まだ外れると分かっていない仮置きの上の実体と門の後ろの実体が、同時に 2 との差（512 個）を埋めるときである（§5 Q25 の未決）。
// 4. 入れ子の数（INSTANCE_NEST_LIMIT）：形が深くならないまま、解いている途中の実体が長く入れ子になる再帰（欄 7 つの並べ替え。
//    形は 5040 通り）や、それを関数を跨いで呼び合う再帰は、JS のスタックを溢れさせ、解き直しと輪の記録（仮置きの依り・輪の依り）
//    の手間も入れ子の長さの2乗ほどで増えた（前の深さの守り「同じ `?` の実体の入れ子 32」を外した後。確かめ 2026-10-20）。だから、
//    再帰の入れ子（根の種類を解いている実体と木を解いている実体のうち、同じ `?` の2つ目から先の数の和）に上限を置く
//    （instance-nest-limit、enterNest）。値だけを渡す別々の関数の鎖（それぞれの `?` は1つずつ）は数えない：重いのは再帰で、
//    鎖は前の版と同じく何段でも通す。数えるのは、素の名前つき関数の本体と値の定義を解く枠の間だけで、その枠に入ると数え直す
//    （freshNest。前の版の深さの守り stretchOf は、括りの関数の実体でない枠（名前の無い関数の解き直しの枠も）で数えるのを止めて
//    いた。ここで数え直すのは、1つずつしか積まれない枠だけ）。どちらの枠も枠の並びに1つずつしか積まれないので、再帰の入れ子の
//    和は（その数 + 1）× 上限までに収まる（実体の入れ子の長さそのものは、別々の `?` の鎖で何段でも伸びる）。前は枠を跨いで数えたので、素の関数を挟む hb の
//    鎖（`fi : x ? hb [s : f(i+1)]`）を 257 個で断った（前の版は通す。確かめ 2026-10-20 の6回目）。数え直す所が多いと遅くなる
//    （素の関数で区切った欄 6 つの並べ替えの再帰を 64 個つなぐと、`--stack-size=8000` で 16 秒。前の版は 3 秒。既定のスタック
//    では溢れて 0.1 秒で resolve-stack-limit。§5 Q25 の未決）。前の版を通った物は、素の関数の枠の間で同じ `?` を 32 段より深く
//    入れ子にしないので、その間で 9 つ以上の `?` が同時に深く再帰しない限り、ここも通る（9 つの `?` が 30 段ずつ再帰する有限の
//    形は、前の版は通し、ここで断る。和を 512 にするか、
//    `?` ごとに 32 段を超えるまで断らないと、関数を跨ぐ並べ替えの再帰が、関数 16 個で 37 秒、32 個で 5 分を超えた。重いのは
//    解き直しと輪の記録で、入れ子の長さの2乗ほどで増える。確かめ 2026-10-20、§5 Q25 の未決）。入れ子の長さは、先に作った
//    実体の記録を引くかで変わるので、上限の前後では定義の順で割れうる（§5 Q25 の未決）。全部の入れ子でも数えると、関数を跨ぐ
//    並べ替えの再帰が 1024 段で 3.8GB を使い、`?` ごとに数えると、関数 8 つで 2048 段になりヒープが尽きた（2026-10-20）。
//    スタックが溢れたら（鎖が長いか、実体1段の本体が重い）、内部の例外にせず、資源の守りとして断る（resolve-stack-limit、
//    stackRefusal。どこで溢れるかは、同じプロセスで前に何を解いたかでも変わる）。
// 5. 汚れ（taint）：守りに当たった所は門として未知になり、当たった `?` の新しい実体は作らないので、守りの断りを捕まえた枠の答え
//    と、その答えを読んだ計算は、守りが無いときと違いうる。だから、守りの断りを捕まえた枠と、汚れた答えを読んだ計算に印を付け
//    （frame.tainted・記録の tainted・行の F.lineTainted）、汚れた計算の呼び出しは 2 に数えず、汚れた計算で出た門と値を含む輪は
//    作り物かもしれないので、3・4 の後に言う（refusalOf）。前は、入れ子の数の守りで未知になった根から出た G2(a) を、最後の木の
//    門として先に言った（入れ子の数の守りに当たる再帰を本体で呼ぶ `fz : x ? r …` と `fz 5 inc`。確かめ 2026-10-20）。
// どの値も言語の規則ではなく実装の守りで、値は決めていない。
const INSTANCE_DEPTH_MARGIN = 32;
const INSTANCE_TOTAL_LIMIT = 512;
const INSTANCE_WORK_LIMIT = 2 * INSTANCE_TOTAL_LIMIT;
const INSTANCE_NEST_LIMIT = 256;
// 6. 合成の幅（COMPOSE_WIDTH_LIMIT、2026-10-24）：合成の子の合成は開く（R8）ので、同じ合成を2つ並べて渡す再帰は、合成の中の関数の数が
//    段ごとに倍になっても鍵の深さが増えず、深さの門にも入れ子の数の守りにも届く前にヒープが尽きて、プロセスごと落ちた（注の1の「穴」、
//    §5 Q25 の前からの穴。欄の `dg : [f] [~t] ? dg [f : f f] t` の `dg [f : inc] vs` は HEAD d78ce73c でも落ちる）。2026-10-24 の試し（R49）で、
//    実体の中の `@f` が指す関数そのものになったので、番地の道（`deep7 : f [~t] ? deep7 $[@f @f] t` の `deep7 $inc vs`。前は `@f` が頭以外で
//    G6）からも入れるようになった（試しの確かめで見つかった）。だから、関数の項の段（開いた合成の中の関数）の数に上限を置き、超えたら資源の
//    守りとして断る（compose-width-limit、widthRefusal。スタックの溢れと同じく、解いている途中のどこで当たっても行の外まで投げ上げる）。
//    合成の長さを深さに数えるか（R8 の、左からの畳み込みの深さ）は決めていない（§5 Q25）ので、門ではなく資源の守りにした。値は決めていない。
const COMPOSE_WIDTH_LIMIT = 1024;

// 書いた形の深さ（注の1）。解く前に、ソースだけから決める（解いている途中に分かる深さで決めると、また定義の順に依る）。
// deepest は、ファイルに書いたどの形（括り・字下げのブロック・並び・`,` の並び、関数の本体の中も）よりも深い数：書いた形の
// 深さを、実体の鍵の深さと同じく数える（括りと並びと `,` は中身に 1 を足す。名前は、ファイルの値の定義なら右辺の書いた
// 深さを通す。定義が前の定義を指して深くなる鎖（`q1 : pp [f : q0] [f : q0]`…）も書いた分に数える。輪は 0 で切る）。
// 数え方は鍵の深さより浅くならない側に倒す（1行の括りにも 1 を足す、関数の本体の枝の条件（`:` の左）に書いた形も数える、
// 文字列の字面は文字の List なので 2、など）。`x ' k` の右が裸の名前か字面の整数なら鍵（欄の名前か位置、R26）なので名前として
// 辿らず、ほかの右（`x @ k` の右も）は解くので数える。brackets は、書いた括りの関数（括りの
// 仮引数を持つ `?`）と、2026-10-26 の R81 から素の関数（仮引数が全部裸の `?`）の数。
function writtenDepth(lines, F) {
  let deepest = 1;
  const lambdas = new Set();
  // 値の定義の書いた深さ。右辺の値の形だけを数える：関数の本体（`?` の右）と `:` の左は値の形に入らず、印の付いた名前（`$w`・
  // `@w`・前置 `~`・後置 `@` は種類を引かない。値の印・後置 `~` を付けた物も、鍵では形の無い値か撒く項で深さ 1）は辿らない。
  // だから、ここで辿る名前の輪は種類の輪（値を含む輪で、どの並べ方でも name-cycle で断る。§5 Q30）だけで、そこを 0 で切っても、
  // 断らないプログラムの答えは並べ方に依らない。
  const memo = new Map(); // 値の定義 → 書いた深さ（解いている途中は 0）
  const nameDepth = (name) => {
    const def = F.defs.get(name);
    if (!def || def.lambda) return 1;
    if (memo.has(def)) return memo.get(def);
    memo.set(def, 0);
    const d = treeDepth(def.rhs, true);
    memo.set(def, d);
    return d;
  };
  // inValue：値の定義の右辺の形を数えている（関数の本体には入らず、deepest も動かさない）。
  const termDepth = (t, inValue) => {
    if (!t) return 1;
    // 2026-10-25 の R60 から、`$` は値の先も通し、値を読む参照は指す値の深さに 1 を足した鍵を持つ（internDesc の vref）。括りでない先（名前・字面・
    // ほかの前置の印の組み合わせ）は、`$` を外した先の深さに 1 を足す（関数の名前 `$inc`・`$_`・`$@f` は今までどおり 2）。括りの先は下の行の数え方のまま。
    if (t.type === "atom" && t.pre.length && t.pre[0] === "$" && !t.post.length && !t.core.rows) return 1 + termDepth({ ...t, pre: t.pre.slice(1) }, inValue);
    // `x ' k` の右が裸の名前か字面の整数なら鍵（欄の名前か位置）で、名前として引かない（R26、pickKeyOf。classifyInfix と同じ）。
    // ほかの右（`x @ k` の右も）は解くので、書いた形を数える。
    if (t.type === "infix") return 1 + Math.max(termDepth(t.left, inValue), t.sym === "'" && pickKeyOf(t.right) ? 1 : termDepth(t.right, inValue));
    // `$名前` は、名前が関数なら指す関数の印を持つ番地で、鍵の深さは 2（R49。internDesc の ref）。浅くならない側に倒して 2 と数える。
    // 2026-10-25 の R55〜R57 から、印を持つ番地は `$名前` のほかにも、`$_`（零射、R56）と、前置の印の組み合わせ `$@f`（R57）がある。どれも 2 と数える。
    if (t.core.c === "name") return t.pre.length || t.post.length ? (t.pre[0] === "$" && !t.post.length ? 2 : 1) : nameDepth(t.core.name);
    if (t.core.c === "unit" && t.pre.length === 1 && t.pre[0] === "$" && !t.post.length) return 2;
    if (t.core.rows) return 1 + t.core.rows.reduce((m, r) => Math.max(m, treeDepth(r, inValue)), 0);
    if (t.core.c === "lit" && t.core.text.startsWith("`")) return 2; // 文字列は文字の List（鍵では 2 段）
    return 1;
  };
  const treeDepth = (t, inValue) => {
    if (!t) return 1;
    let d;
    if (t.type === "seq") d = t.terms.length === 1 ? termDepth(t.terms[0], inValue) : 1 + Math.max(...t.terms.map((x) => termDepth(x, inValue)));
    else if (t.sym === "?") {
      if (!inValue && !lambdas.has(t)) {
        lambdas.add(t);
        const body = treeDepth(t.right, false); // 本体に書いた形（先に数える：中の括り・枝の条件・`?` でも deepest が上がる）
        deepest = Math.max(deepest, body);
      }
      d = 1;
    } else if (t.sym === ":") {
      // 左は値の形に入らない（定義・欄の名前、枝の条件）。ただ2項以上の枝の条件は解くので、そこに書いた形も数える。
      if (!inValue) treeDepth(t.left, false);
      d = treeDepth(t.right, inValue);
    }
    else if (t.sym === ",") d = 1 + Math.max(treeDepth(t.left, inValue), treeDepth(t.right, inValue));
    else d = Math.max(treeDepth(t.left, inValue), treeDepth(t.right, inValue));
    if (!inValue) deepest = Math.max(deepest, d);
    return d;
  };
  for (const line of lines) treeDepth(line, false);
  // 実体を作る `?` の数：括りの関数と、2026-10-26 の R81 から素の関数（仮引数が全部裸の `?`。印のある実引数で実体を作る）も数える。数えないと、括りの関数の
  // 無いファイルでは上限が書いた形の深さそのものになり、`$` で包んで渡す再帰しない素の関数の鎖（`a1 : f ? a2 $f` ⏎ `a2 : g ? a3 $g` ⏎ … ⏎ `a1 $inc`）まで、
  // 鎖が3段を超えると深さの門で断り、関係の無い括りの関数を1つ足すと通った（2026-10-26 の確かめの指摘）。上限の理屈（実体を作る関数をそれぞれこの数の回まで
  // 通り直す道の届く深さ）は、素の関数の実体にもそのまま当たる。
  const brackets = [...lambdas].filter((op) => op.left && (patternParamsOf(op.left) || parseParams(op.left).plain)).length;
  return { deepest, brackets };
}

// 作る実体の門で見る鍵の深さ（注の1）：括りの仮引数に当てた物のいちばん深い物（裸の仮引数は A なので数えない）。関数を
// 書いた所の深さは入れない（書いた所の実体は、その実体の門で見てある。入れると、深い実体の中で書いた `[[b] ? b] [1]` まで
// 断る）。params と argDescs は bindParams と同じ。
function instanceDepth(params, argDescs) {
  let depth = 1;
  params.forEach((p, i) => {
    // 裸の仮引数に渡った、関数を指す番地（R49）も鍵に入るので数える。括りの仮引数に直に渡った番地は、鍵では A（bindParams）。
    const d = argDescs[i];
    if (p.kind === "bare") {
      if (readerOf(d) || zeroOf(d)) depth = Math.max(depth, depthOf(internDesc(d))); // 値を読む参照（R60）・番地の点と差（R62）・`_` を指す値（R63）も鍵に入る
    } else depth = Math.max(depth, depthOf(internDesc(readerOf(d) ? A() : d)));
  });
  return depth;
}
function depthGate(label, shapeText, depth, limit, plain = false) {
  const e = gate(
    "G7",
    `${plain ? "素の関数（印のある実引数で実体を作る所、R81）" : "括りの関数"} \`${label}\` を形 ${cutShape(shapeText)} で呼ぶと、渡した物の鍵の入れ子（形と、欄の関数を書いた所の実体の鍵）が ${limit} 段を超えます（${depth} 段。上限は、実体を作る関数（括りの関数と素の関数）をそれぞれ ${INSTANCE_DEPTH_MARGIN} 回まで通り直したときに、書いた形から届く深さ）。形を変えながら自分か、自分を呼ぶ関数の輪を呼び続けると、実体が有限に収まるかを決めないので、本体の読みを決めません（R24）。`
  );
  e.instance = { fn: label, shape: shapeText };
  e.instances = [e.instance];
  return e;
}

// いまの呼び出しが最後の木の道にあると言えるか（注の2）。言えないのは、解いている途中の枠が仮置きに頼っているとき
// （pendingNow。仮置きを読まれた枠 consulted と、枠と無名の関数の本体が頼っている枠 deps）と、枠の計算が門に当たった実体を
// 呼んだ後のとき（gated）。根の種類を解く所は、実体の本体が門に当たっても未知にして先へ進むが、木を残す段はそこで呼んだ行
// ごと断るので、その後ろで作る実体は最後の木に入らない（門に当たる `bad [y : 1]` の後ろの `p [m : 1]`。確かめ 2026-10-20）。
function pendingNow(F) {
  const s = new Set();
  for (const f of F.stack) {
    if (f.consulted) s.add(f);
    for (const d of f.deps) s.add(d);
  }
  for (const c of F.collectors) for (const d of c.deps) s.add(d);
  return s;
}
const gatedNow = (F) => F.stack.some((f) => f.gated);
// 括りの関数 fn（書いた `?` は op）を通って実体 inst を呼んだ（注の2・3）。made なら、この呼び出しが実体を作った（か、外した
// 実体を作り直した）。最後の木の道にあると言えれば、op の確定した実体に数える。仮置きに頼っていれば、頼っている枠に覚えさせ、
// 枠が閉じたときに決める（settlePending）。門に当たった実体を呼んだ後なら数えない（木を残す段で、呼んだ所が数える）。
function noteCall(F, inst, op, label, made) {
  const set = F.instanceTotals.get(op);
  if (set && set.has(inst)) return;
  // 同じ `?` からの控えが残っていれば、足さない（控えは `?` ごとに1つ。頼っている枠の全部へ呼ぶたびに足すと、輪で何度も
  // 呼び直す再帰で控えが入れ子の長さの2乗ほどに増えた。足さずに数え漏れても、木を残す段の呼び出しが数える）。
  if (!made && inst.pendingOps && inst.pendingOps.has(op)) return;
  const pend = pendingNow(F);
  const onPath = !gatedNow(F) && !taintedNow(F);
  if (!pend.size) {
    if (onPath) countSettled(F, inst, op, label);
    return;
  }
  const entry = { inst, op, label, made, onPath, pendingOn: pend };
  for (const f of pend) (f.pendingCalls || (f.pendingCalls = [])).push(entry);
  (inst.pendingOps || (inst.pendingOps = new Set())).add(op);
}
// 作って外れていない実体の数（注の3）。作った `?`（か、外した実体を作り直した `?`）で数える。
function makeLive(F, inst, op, label) {
  const made = (F.instancesMade.get(op) || 0) + 1;
  if (made > INSTANCE_WORK_LIMIT) throw guardRefusal(F, "work", label, op, inst.plain);
  F.instancesMade.set(op, made);
  inst.liveOp = op;
}
// 外れた仮置きの上でだけ作った実体を、作った実体の数から外す（注の3）。鍵の記録（F.instances）には残し、また呼ばれたら
// 作り直したと数える（instantiate）。確定した実体は外さない。
function discard(F, inst) {
  if (!inst.liveOp || inst.final) return;
  F.instancesMade.set(inst.liveOp, F.instancesMade.get(inst.liveOp) - 1);
  inst.liveOp = null;
}
// 解いている途中の枠 frame が閉じた（failed なら仮置きが外れた）ときの、frame に頼った呼び出し。外れたら、その呼び出しが作った
// 実体を作った実体の数から外し、当たったら frame が頼っていた枠（deps）に頼り直す。どの枠にも頼らなくなったら確定した実体
// （総数に数える）。数えるのは最後にまとめて（総数の門に当たっても、frame の後片付けを終えてから投げる）。
function settlePending(F, frame, failed, deps) {
  const now = [];
  for (const entry of frame.pendingCalls || []) {
    if (!entry.pendingOn || !entry.pendingOn.has(frame)) continue;
    entry.pendingOn.delete(frame);
    if (failed) {
      entry.pendingOn = null;
      entry.inst.pendingOps.delete(entry.op);
      if (entry.made) discard(F, entry.inst);
      continue;
    }
    for (const d of deps) {
      if (entry.pendingOn.has(d)) continue;
      entry.pendingOn.add(d);
      (d.pendingCalls || (d.pendingCalls = [])).push(entry);
    }
    if (entry.pendingOn.size) continue;
    entry.pendingOn = null;
    entry.inst.pendingOps.delete(entry.op);
    if (entry.onPath) now.push(entry);
  }
  frame.pendingCalls = null;
  for (const e of now) countSettled(F, e.inst, e.op, e.label);
}
// 確定した実体を、呼んだ `?` ごとに数える（注の2）。同じ綴りの関数が分け合う実体は、呼んだ `?` のそれぞれで1つ。上限を
// 超えたら断る。確定した実体は、作った実体の数でも外さない。
function countSettled(F, inst, op, label) {
  let set = F.instanceTotals.get(op);
  if (!set) F.instanceTotals.set(op, (set = new Set()));
  if (set.has(inst)) return;
  if (set.size + 1 > INSTANCE_TOTAL_LIMIT) throw guardRefusal(F, "total", label, op, inst.plain);
  set.add(inst);
  if (!inst.liveOp) makeLive(F, inst, op, label);
  inst.final = true;
}
// 守りの断り（注の2〜4）。当たった実体と行は解く順に依るので、書いた `?` の名前（名前の定義なら名前、括りなら綴り）だけを
// 言う。ほかの門と同じく投げ（根の種類を解く所では未知になり、そこから先は浅く止まる）、覚えて resolve の最後に断る。覚えた物が
// 2つ以上なら、名前のいちばん小さい物。総数は G7（断るかは最後の木だけで決まる）、作った実体の数と入れ子の数は資源の守り
// なので、別の reason にする。
const GUARD = {
  total: { reason: GATE_REASON.G7, gate: "G7", what: () => `確定した実体が ${INSTANCE_TOTAL_LIMIT} 個を超えました` },
  work: { reason: "instance-work-limit", gate: "", what: () => `作った実体（仮置きの上で作った物も数える）が ${INSTANCE_WORK_LIMIT} 個を超えました` },
  nest: { reason: "instance-nest-limit", gate: "", what: () => `実体を解いている途中に、再帰の入れ子（同じ \`?\` の2つ目から先の実体の数の和）が ${INSTANCE_NEST_LIMIT} を超えました` },
};
function guardRefusal(F, kind, label, op, plain = false) {
  const g = GUARD[kind];
  const e = new OperationError(
    `${plain ? "素の関数（印のある実引数で実体を作る所、R81）" : "括りの関数"} \`${label}\` の${g.what()}（形を変えながら増え続けています）。実体が有限に収まるかを決めないので、本体の読みを決めません（§5 Q25）。`,
    { spec: `${SPEC} §4 R24`, reason: g.reason }
  );
  e.gate = g.gate;
  e.guard = kind; // isGate に数える（ほかの門と同じく、根の種類を解く所では未知）
  e.label = label;
  e.instance = { fn: label, shape: "" }; // 名指しは `?` の名前だけ（形は言わない）
  e.instances = [e.instance];
  withLine(e, F.line); // 守りに当たった時に解いていた行（R127）
  const old = F.guards[kind];
  if (!old || label < old.label) F.guards[kind] = e;
  if (!F.guardStops.has(op)) F.guardStops.set(op, e); // この `?` では新しい実体を作らない（instantiate）
  return e;
}
// 覚えた守りの断り（resolve の最後）。総数・作った実体の数・入れ子の数の順。
function guardRefused(F) {
  return F.guards.total || F.guards.work || F.guards.nest || null;
}
// 解いている途中の実体（根の種類を解いている物と、木を解いている物）の入れ子に入る（注の4）。出るのは呼んだ側（instRootOf・
// materialize）。
function enterNest(F, inst) {
  const n = F.instNest.get(inst.lambda) || 0;
  if (n >= 1 && F.instRecur >= INSTANCE_NEST_LIMIT) throw guardRefusal(F, "nest", inst.label, inst.lambda, inst.plain);
  F.instNest.set(inst.lambda, n + 1);
  if (n >= 1) F.instRecur++;
}
function leaveNest(F, inst) {
  const n = F.instNest.get(inst.lambda) - 1;
  F.instNest.set(inst.lambda, n);
  if (n >= 1) F.instRecur--;
}
// 素の名前つき関数の本体と値の定義を解く間は、入れ子を数え直す（注の4）。どちらも枠に1つしか積まれない（解いている途中に
// また引けば、仮置きか値を含む輪）ので、数え直しても再帰の入れ子の和は「（その数 + 1）× 上限」までに収まる。前の版の深さの
// 守り（stretchOf）は、括りの関数の実体でない枠（名前の無い関数の解き直しの枠も）で数えるのを止めていた。返すのは、元の数に戻す関数。
function freshNest(F) {
  const { instNest, instRecur } = F;
  F.instNest = new Map();
  F.instRecur = 0;
  return () => {
    F.instNest = instNest;
    F.instRecur = instRecur;
  };
}
// JS のスタックが溢れた（注の4）：入れ子の数の守りの内でも、実体1段の本体が重い（括弧の深い入れ子）と溢れる。内部の例外の
// まま出さず、資源の守りとして断る（どこで溢れるかは、同じプロセスで前に何を解いたかでも変わる）。
function stackRefusal(e) {
  if (!(e instanceof RangeError) || !/call stack/i.test(e.message)) return null;
  const s = new OperationError("解決の途中で JS のスタックが溢れました（実体の入れ子か、本体の入れ子が深すぎます）。読みを決めません（§5 Q25）。", {
    spec: `${SPEC} §4 R24`,
    reason: "resolve-stack-limit",
  });
  s.guard = "stack"; // 資源の守り（refusalOf）
  return s;
}
// 合成の幅の守り（注の6）。関数の項の段の数が上限を超えたら、OperationError でない印の例外を投げる：門ではないので、根の種類を解く所や
// 門を握りつぶす所（isGate）で未知に化けずに、スタックの溢れと同じく resolve の行の外まで投げ上がり、そこで資源の守りの断りにする。
class ComposeWidthOverflow extends Error {}
function widthRefusal(e) {
  if (!(e instanceof ComposeWidthOverflow)) return null;
  const s = new OperationError(
    `合成の中の関数が ${COMPOSE_WIDTH_LIMIT} 個を超えました（同じ合成を並べて渡す再帰で、合成の幅が増え続けています）。合成の長さを深さに数えるかを決めていないので、実体が有限に収まるかを決めず、読みを決めません（§5 Q25）。`,
    { spec: `${SPEC} §4 R24`, reason: "compose-width-limit" }
  );
  s.guard = "width"; // 資源の守り（refusalOf）
  return s;
}
// 断る理由を1つ選ぶ（resolve の最後）。e は覚えた行の断り（資源の守りから来ていない、汚れていない物を先に覚えた物）。
// 解き直しの守り → 値を含む輪（汚れていない物）→ 実体の総数（G7、ファイル全体の最後の木で決まる）→ 行の門（汚れていない、
// 最初に断った行）→ 資源の守り（作った実体の数・入れ子の数・スタック）→ 汚れた輪・汚れた行の断りの順。資源の守りに当たった後の
// 計算は、当たった `?` の新しい実体を作らず、それを捕まえた答えは守りが無いときと違いうる（taint）ので、汚れた所で出た門は
// 資源の守りの後に置く。汚れていない門は最後の木の門なので、資源の守りより先に言う。
function refusalOf(F, e) {
  if (F.againRefused) return F.againRefused;
  const cycle = F.cycleRefused;
  if (cycle && !cycle.suspect) return cycle;
  if (F.guards.total) return F.guards.total;
  if (e && !e.guard && !e.suspect) return e;
  return F.guards.work || F.guards.nest || F.stackRefused || cycle || e;
}

function patternFn(F, op, params, defScope, label) {
  const fn = { type: "pattern", n: params.length, idKey: lambdaKey(op, defScope.key), label, op, scopeKey: defScope.key, params };
  fn.lastBracket = params[params.length - 1].kind !== "bare"; // 残りの並びを最後の括りが受ける形（fnShape・closeKind）
  fn.bareAt = params.map((p) => p.kind === "bare"); // 裸の仮引数の位置（部分適用の鍵で A にする、internPartial）
  fn.env = scopeIdent(defScope); // 書いた範囲の同一性（callIdent）
  fn.envDepth = envDepth(defScope); // 鍵の深さ（fnDepth）
  fn.instantiate = (argDescs) => instantiate(F, fn, op, params, defScope, argDescs);
  return fn;
}

// ---- 素の関数の単相化（R81、2026-10-26。§5 Q45 の答え） ----
//
// 素の関数（括りの仮引数の無い関数）も、実引数が持つ印で実体を作る。印は、関数を指す番地（R49・R55）・値を読む参照（R60）・番地の算術で作った点と差（R62）・
// 書いた `_` と分かる値（R63）。印の無い実引数では今のまま、本体を1回だけ、裸の仮引数を A として解く（中身の見えない A。bodyRootOf）。実体の鍵・深さ・輪・
// 守りと、本体の門を呼んだ行で名指しする所は、括りの関数の実体（R24・R25、instantiate）と同じ仕組みに乗せる（仮引数は全部裸：bindParams が印だけを持ち越し、
// 印ごと鍵に入れる）。答えは括りの関数の実体と同じく、本体の根が A なら A、ほかは未知（本体の根の点・差の印は持たない。持たせるかは §5 Q66 の残り）。
// これで `use : f x ? @f x` ⏎ `use $inc 5` の `@f` は inc（A）、`gg : f ? map $f vs` ⏎ `gg un` の実体の `$f` は零射の番地。`tg : g ? @g vs~` ⏎ `tg $add` は、
// tg の定義の行（印の無い1回の読み）が G19 で断るので閉じない（§5 Q45 の残り）。
// 定義の行の木には実体を描かない（素の関数の本体は、印の無い1回の木のまま）。部分適用は当てた物（bound）を持ち越し、口が全部埋まった所で実体を作る（partialFn）。
// 穴の関数（`(use $inc !_) 5`・`(ff !_) $5`）は、頭と、書いた実引数と穴の位置を持ち越し、口が埋まった所で頭の適用として作る（holeFnOf、2026-10-26 の確かめの直し）。
// 根拠：主の Claude の問いの表「Q45 | 括りの仮引数が無い素の関数（`use : f x ? @f x`）にも、引数で実体を作る（単相化する）か。今は番地の印が届かず、`@f` が
// 未知 | 単相化する（引数で決まる多相は単相化の線）」（2026-10-25 07:43 UTC）に、U〔答え〕[2026-10-25 08:44 c8ccdd69]「Q10 と Q45 は、君の傾きを採用できそうだと
// 思う。」。
const monoMarked = (d) => !!readerOf(d) || !!zeroOf(d);
// 素の関数の仮引数（全部裸）を、括りの関数の仮引数の並びの形（bindParams・instanceDepth・callIdent が読む）にする。
function plainParamsOf(op) {
  return parseParams(op.left).names.map((p) => ({ kind: "bare", name: p.name }));
}
// 素の関数の fn に、実体を作る口を付ける（R81）。defScope は書いた範囲（閉包の外の名前を引く所）。
function plainInstantiable(F, fn, op, defScope) {
  fn.env = scopeIdent(defScope); // 書いた範囲の同一性（callIdent）
  fn.instantiate = (argDescs) => instantiate(F, fn, op, plainParamsOf(op), defScope, argDescs);
  return fn;
}
// 素の関数 fn（部分適用なら当てた物 bound を前に足す）の口が、trees で全部埋まった。実引数のどれかが印を持てば、実体の答え（R81）。ほかは null（今までどおり）。
function monoKind(fn, trees) {
  const base = fn.base || fn;
  if (!base.instantiate || fn.origin === "hole" || fn.rest) return null;
  const descs = [...(fn.bound || []), ...trees.map(descOfTree)];
  if (descs.length !== base.n || !descs.some(monoMarked)) return null;
  return base.instantiate(descs).kind;
}

// 括りの関数の部分適用（口の開いたまま残った段、partialFn）。残りの仮引数は後ろの n − k 個なので、最後の仮引数が括りかは元の関数の
// まま。当てた物（bound）は元の関数（base）の前から並べて覚え、残りが来たら合わせて元の関数の実体を作る。部分適用の
// 部分適用（`(t3 1) 2`）も、元の関数に当てた物を足していく。
// 鍵は当てた物の形を入れ、木のまま持つ（internPartial）——当てた物の違う部分適用を同じ関数として扱わない（欄に入れて
// 括りの関数に渡したときの実体の鍵）。
function patternPartial(fn, args) {
  const base = fn.base || fn;
  const bound = [...(fn.bound || []), ...args];
  return {
    type: "pattern",
    n: base.n - bound.length,
    label: base.label,
    lastBracket: base.lastBracket,
    base,
    bound,
    instantiate: (argDescs) => base.instantiate([...bound, ...argDescs]),
  };
}

// その `?` を通って、木まで解く実体を呼んだ（定義の行の木に描く物。resolve の最後）。
function recordCall(F, fn, inst) {
  let byScope = F.calls.get(fn.op);
  if (!byScope) F.calls.set(fn.op, (byScope = new Map()));
  let set = byScope.get(fn.scopeKey);
  if (!set) byScope.set(fn.scopeKey, (set = new Set()));
  set.add(inst);
}

// ---- 呼んだ物の同一性（R25 の描き方） ----
//
// 実体の答えは綴りの鍵で分け合うが、記録（recordCall）は「その `?` を通って呼ばれたか」なので、どの `?` かという物の
// 同一性で取る。分け合った実体の本体の中で呼ぶ関数（欄に入れて渡した関数・実体の中の括った `?`）は、実体を作った側の
// 物ではなく、いま呼んだ側の物である。直す前は、使い回したときに本体の中の呼び出しを記録しなかったので、
// `h [f : pair]` と `h [f : pair2]`（pair と pair2 は同じ綴り）で、どちらの定義の行に inst が出るかが行の順で入れ替わった。
// 値の定義が先に作った実体を別の行が木にすると、門の名指しも作った側の名前になった（反証 2026-10-19 の続き）。
// だから呼び出しごとに、呼んだ物の同一性を番号に寄せ（callIdent）、実体ごとに、まだ歩いていない番号で呼ばれたら、本体を
// その物で歩いて記録を足す（materialize・walkCalls）。答えは綴りで決まるので、歩き直しても木・種類・門は変わらない。
// 同一性は、実引数の中と、関数を書いた範囲（実体の範囲なら、その実体を呼んだ物）の中の括りの関数の `?` で決まる。
// 素の関数と点なしは数えない（NO_IDENT）：素の関数の本体は定義の行で解き、呼んでも本体を歩かない。合成は中の関数を数える。
// 番号は歩きを重ねないためだけに使い、鍵にも並び順にも入れない。番号の振り方は見た順に依るが、記録される `?` と実体の
// 組は依らない。比べるのは同じ実体（同じ鍵）を呼んだ物どうしだけで、鍵が各位置の関数の綴りと範囲の鍵を決めているので、
// 番号には書いた `?` と、書いた範囲の同一性だけを入れる。
const NO_IDENT = 0; // 括りの関数が見えない物
let identTable = new Map([["·", NO_IDENT]]); // 綴り（子は番号）→ 番号
let identByDesc = new WeakMap();
let identByShape = new WeakMap();
let identByFn = new WeakMap();
let opSerial = new WeakMap(); // 書いた `?` → 番号（物の同一性）
let opCount = 0;
function identText(text) {
  let id = identTable.get(text);
  if (id === undefined) identTable.set(text, (id = identTable.size));
  return id;
}
function identDesc(d) {
  if (!d) return NO_IDENT;
  const memo = identByDesc.get(d);
  if (memo !== undefined) return memo;
  const id = d.k === "L" ? identFn(d.fn) : refOf(d) ? identFn(d.ref) : vrefOf(d) ? identDesc(d.vref) : d.k === "A" && d.shape ? identShape(d.shape) : NO_IDENT;
  identByDesc.set(d, id);
  return id;
}
function identShape(sh) {
  const memo = identByShape.get(sh);
  if (memo !== undefined) return memo;
  let id = NO_IDENT;
  if (sh.s === "struct") {
    const fields = sh.fields.map((f) => [f.name, identDesc(f.desc)]);
    if (fields.some(([, c]) => c !== NO_IDENT)) id = identText(`{${fields.map(([n, c]) => `${n}:#${c}`).join(" ")}}`);
  } else if (sh.s === "list" && sh.elem) {
    const c = identDesc(sh.elem);
    if (c !== NO_IDENT) id = identText(`[#${c}…]`);
  }
  identByShape.set(sh, id);
  return id;
}
function identFn(fn) {
  if (!fn) return NO_IDENT;
  const memo = identByFn.get(fn);
  if (memo !== undefined) return memo;
  let id = NO_IDENT;
  if (fn.type === "pattern" && fn.bound) {
    // 部分適用：元の関数と当てた物。裸の仮引数の位置は、実体の中で A なので呼べない（internPartial と同じ）。
    const bound = fn.bound.map((d, i) => (fn.base.bareAt[i] && !readerOf(d) ? NO_IDENT : identDesc(d)));
    id = identText(`P#${identFn(fn.base)}(${bound.map((c) => `#${c}`).join(" ")})`);
  } else if (fn.type === "pattern") {
    let n = opSerial.get(fn.op);
    if (n === undefined) opSerial.set(fn.op, (n = opCount++));
    id = identText(`F${n}#${fn.env}`);
  } else if (fn.type === "compose") {
    const fns = fn.fns.map(identFn);
    if (fns.some((c) => c !== NO_IDENT)) id = identText(`C(${fns.map((c) => `#${c}`).join(" ")})`);
  } else if (fn.type === "pfGreedyUnary" && fn.map) {
    id = identFn(fn.map); // `[F,]` の写像（R50）は、写す関数を呼ぶ
  } else if (fn.type === "plain" && (fn.bound || fn.holeHead)) {
    // 素の関数の部分適用と穴の関数（R81）：当てた物の印が指す括りの関数を、口が埋まった所の実体で呼ぶ。
    const marks = plainMarksOf(fn) || [];
    const bound = marks.map((d) => (d === "hole" || d === "A" ? NO_IDENT : identDesc(d)));
    if (bound.some((c) => c !== NO_IDENT)) id = identText(`PP(${bound.map((c) => `#${c}`).join(" ")})`);
  }
  identByFn.set(fn, id);
  return id;
}
// 呼んだ物の同一性：関数を書いた範囲の同一性と、括りの仮引数に当てた物の同一性（裸の仮引数の位置は A なので数えない）。
function callIdent(fn, params, argDescs) {
  // 裸の仮引数でも、関数を指す番地（R49）は本体の `@x` で呼べるので数える。
  const args = params.map((p, i) => (p.kind === "bare" && !readerOf(argDescs[i]) ? NO_IDENT : identDesc(argDescs[i])));
  return identText(`${fn.env}(${args.map((c) => `#${c}`).join(" ")})`);
}
// 範囲の同一性。実体の範囲は、その実体を呼んだ物の同一性を持つ（instScope）。ほかの範囲は外の範囲のもの。
function scopeIdent(scope) {
  for (let s = scope; s; s = s.parent) if (s.ident !== undefined) return s.ident;
  return NO_IDENT;
}
// 実体の範囲：仮引数に当てた desc（R24）と、呼んだ物の同一性と、鍵の深さ（中で書いた関数の深さ、fnDepth）を持つ。
function instScope(F, op, defScope, b, key, ident) {
  const lam = makeLambda(op, { F, scope: defScope });
  lam.scope.descs = b.descs;
  lam.scope.key = key;
  lam.scope.ident = ident;
  lam.scope.depth = b.depth;
  // 素の関数の単相化（R81）の実体：印の無い実引数の裸の仮引数は仮引数のまま読む（bindParams）が、札（paramTag）は実体に持ち込まない（実体は鍵で分け合われ、
  // 本体を印の分だけ別に解くので、札に足すと定義の行の印の無い読みの答えが実体の読みで変わる。paramTag の注）。
  if (b.plain) lam.scope.plainOp = null;
  return lam.scope;
}

// 仮引数に渡された物を当てる（R24 の表）。返す物は {descs（名前 → desc）, key, text}。
// plain は素の関数の単相化（R81）の実体（仮引数は全部裸。言い分だけが違う）。
function bindParams(params, argDescs, plain = false) {
  const descs = new Map();
  const keys = [];
  const texts = [];
  params.forEach((p, i) => {
    const d = stripTag(argDescs[i]); // 素の関数の裸の仮引数の札は、実体に持ち込まない（paramTag の注）
    if (p.kind === "bare") {
      // 裸の仮引数は、今までどおり A（R24）。渡された物の形を見ないので、鍵も A にする。
      // ただし関数を指す番地（`$inc`、R49）は、印を仮引数の desc に持ち越し（本体の `@f` が指す関数の口の数を知る）、
      // 印ごと鍵に入れる：`map $inc vs` と `map $uu vs` が実体を分け合うと、先に解いた方の答えを後の方が黙って使う。
      if (refOf(d)) {
        descs.set(p.name, { k: "A", ref: d.ref });
        keys.push(descKey(d));
        texts.push(descText(d));
        return;
      }
      // 値を読む参照（R60）も同じ（本体の `@f` が指す値を読む。`h $vs 0` と `h $five 0` が実体を分け合うと、先に解いた方の答えを後の方が使う）。
      // 2026-10-27 の片7 の確かめの直しから、点の要素の幅（R97 の w）も持ち越す（鍵に入っている。ptWidthOf の注）。
      if (vrefOf(d)) {
        descs.set(p.name, d.w ? { k: "A", vref: d.vref, w: d.w } : { k: "A", vref: d.vref });
        keys.push(descKey(d));
        texts.push(descText(d));
        return;
      }
      // 先の種類の分からない持ち上げ（2026-10-27 の片8）も、印を持ち越して鍵に入れる（本体の `@f` は先を読まず、`f + 1` は G21）。
      if (liftOf(d)) {
        descs.set(p.name, liftDesc());
        keys.push(descKey(d));
        texts.push(descText(d));
        return;
      }
      // 番地の算術で作った点・差（R62）と、書いた `_` を指す値（R63）も、印を持ち越して鍵に入れる（本体の `f - $v` が差か、`$f` が零射の番地か）。
      if (addrOf(d) || zeroOf(d)) {
        descs.set(p.name, addrOf(d) ? (d.w ? { k: "A", addr: d.addr, w: d.w } : { k: "A", addr: d.addr }) : zeroDesc());
        keys.push(descKey(d));
        texts.push(descText(d));
        return;
      }
      // 番地の算術で作った点・差を要素・欄に持つ器（hasAddr）は、裸の仮引数では形を見ずに A で受ける（R24）ので、中の印が落ちる。断る側に倒した
      // （2026-10-26 の確かめの直し、§5 Q66。括りの仮引数で受ければ要素・欄の印は見える）。
      if (hasAddr(d)) throw refuseAddressDrop("bare", descText(d), { plain });
      // 素の関数の単相化（R81）の実体では、印の無い実引数を受けた裸の仮引数は descs に入れず、定義の行の読みと同じ裸の仮引数のまま読む（lookup が仮引数として A を
      // 返し、`$x` は値を読む参照。札は実体に持ち込まない、instScope）。括りの関数の実体の「渡された形の見えない値」（isInstOpaque、`$x` は G20）にすると、関係の無い
      // 別の口の印で実体を作っただけで x の読みが割れた（`pz : f x ? $x` の `pz $inc 5` が G20、`pz 1 5`・β の `$5` は A。2026-10-26 の確かめの指摘）。
      if (!plain) descs.set(p.name, A());
      keys.push("A");
      texts.push("A");
      return;
    }
    // 括りの仮引数に直に渡った、関数を指す番地（R49）は、中身の見えない A と同じに受ける（名前は未知、`~rest` は A。bindBracket）ので、
    // 印は本体から見えない。鍵と綴りも今までどおり `A` にする（同じ実体を分け合ってよい）。器の要素や欄の番地は、名前で受けると見えるので
    // 鍵に入れたまま（`[$L…]`・`{f:$L}`）。
    // 値を読む参照（R60）・番地の点と差（R62）・`_` を指す値（R63）も、括りの仮引数に直に渡れば同じ（中身の見えない A。名前は未知で、印は本体から見えない）
    // 2026-10-26 の確かめの直し：番地の算術で作った点・差（R62）が直に渡ったら、名前が未知になって印が落ちる（hasAddr の注）ので断る（§5 Q66）。器の要素・
    // 欄の点・差は名前で受けると見える（bindBracket）ので今のまま。
    if (addrOf(d)) throw refuseAddressDrop("bracket", descText(d));
    const dk = readerOf(d) || zeroOf(d) ? A() : d;
    // R91（2026-10-27、§5 Q71 の答え）：書いた時点で長さの分かる List（len、projLen）が名前より短ければ、足りない後ろの名前は木の段でも `_`（印 zero、R63 と同じ線）。
    // 実体は長さで分ける（鍵と形の綴りに長さを足す。名前が全部足りる長さなら今のまま、長さで分けない）。
    const short = p.simple && p.names.length > 0 && typeof d.len === "number" && d.len < p.names.length && d.k === "A" && !!d.shape && (d.shape.s === "list" || d.shape.s === "scalar");
    // 片イ（R122）：空で席を取った括り（最後でなく `~` も無い括りに、空の List か `_` と分かる値が来た。instantiate の R90 の注）の名前は、射影が足りないので全部 `_`
    // （印 zero、R91 の足りない名前と同じ線）。前は R90 で本体を読まなかった所。鍵と綴りに長さ 0 を足す（`<0`・`(0)`）：`_` と分かる値の鍵は中身の見えない A と同じ
    // `A` なので、足さないと `pb2 un 1` と `pb2 (inc 5) 1` が実体を分け合い、先に解いた方の答え（名前が `_` か未知か）を後の方が黙って使う。
    const empty = !short && p.simple && p.names.length > 0 && isKnownEmpty(d);
    keys.push(descKey(dk) + (short ? `<${d.len}` : empty ? "<0" : ""));
    texts.push(descText(dk) + (short ? `(${d.len})` : empty ? "(0)" : ""));
    if (!p.simple) {
      for (const n of p.all) descs.set(n, U()); // 入れ子の分解など、読み方が決まっていない括り（patternParamsOf の注）
      return;
    }
    bindBracket(p, d, descs);
    if (short) p.names.slice(d.len).forEach((n) => descs.set(n, zeroDesc()));
    if (empty) p.names.forEach((n) => descs.set(n, zeroDesc()));
  });
  return { descs, key: keys.join(" "), text: texts.join(" "), plain };
}
function bindBracket(p, d, descs) {
  const setNames = (f) => p.names.forEach((n) => descs.set(n, f(n)));
  if (!d || d.k !== "A" || d.spread) {
    // L か未知：どの名前も未知。
    setNames(() => U());
    if (p.rest) descs.set(p.rest, U());
    return;
  }
  const sh = d.shape;
  if (!sh) {
    // 中身の見えない A：裸の名前は未知、`~rest` は A。
    // 形では構造体とも List とも読めないが §2 では中身の見える器（行の混ざった括り・同じ名前の欄が2つある構造体・欄の
    // 右辺が撒く項の構造体・撒く項を含む並び）は、`~rest` に中身（elements）を持ち
    // 越す。R24 の表の「中身の見えない A」は裸の仮引数・`$` の番地と番地の字面・範囲・適用の結果のように中身が本当に
    // 見えない物の行で（数の字面は 2026-10-19 に R24 の数の行へ移した）、ここで A() にすると、関数の見える中身を
    // `r~` で撒いても門（§3.3 の手順1）を素通りした（確かめ 2026-10-19 の F2）。
    // 何が残りに入るかは決まらないので、元の器の中身を全部持ち越す（断る側）。
    setNames(() => U());
    if (p.rest) descs.set(p.rest, d.elements ? { k: "A", elements: d.elements } : A());
    return;
  }
  if (sh.s === "scalar") {
    // 数：長さ1の List として受ける（SCALAR の注）。名前はその数、`~rest` は同じ要素の List（形は長さに依らない）。
    setNames(() => scalarDesc());
    if (p.rest) descs.set(p.rest, withShape({ s: "list", elem: scalarDesc() }));
    return;
  }
  if (sh.s === "struct") {
    // 構造体：裸の名前は同じ名前の欄の生まれ。`~rest` は受けなかった欄の構造体。
    // 同じ名前の欄が無ければ `_`（印 zero、R115。2026-10-28 の片9b）：名前付きスロットには順序が無いので、前から当てる読みは取らない。欄が無い＝定義が無い＝`_`（R111）。
    // 根拠：主の Claude の 2026-10-27 14:50 UTC の文「構造体を括りの名前で受けて、同じ名前の欄が無いとき：その名前は `_`。名前付きスロットには順序が無いから、前から当てる
    // 読みは取らない。」（R。「違ったら止めて」と書いて片9 に入れた）。D c90433a（名前付きスロット、「外れれば `__`」）。前は未知（名前で当たらなかった名前を前から当てるかは、
    // どの言葉にも無い、R24）。
    setNames((n) => {
      const f = sh.fields.find((x) => x.name === n);
      return f ? f.desc : zeroDesc();
    });
    if (p.rest) descs.set(p.rest, withShape({ s: "struct", fields: sh.fields.filter((f) => !p.names.includes(f.name)) }));
    return;
  }
  // List：裸の名前は要素の生まれ（要素に L か未知が見えれば未知。mergeElems）、`~rest` は同じ要素の List。
  setNames(() => (sh.elem && sh.elem.k === "A" ? sh.elem : U()));
  // 残りの名前は長さ（len、R91）を持たない（2026-10-27 の確かめの直し）：実体は長さで分けない（R24 の線。R91 は名前の足りない長さだけを鍵に足す）ので、実体の中の
  // 名前に長さを持たせると、長さの違う呼び出しが1つの実体を分け合い、先に解いた方の答えを後の方が黙って使う。最初の版は List 全体の len をそのまま残りの名前に
  // 持たせていて、`g : [x ~xs] ? fe xs` の `g [1 2 3 4]` の後の `g [1 2]` が A（`g [1 2]` だけなら G7、しかも残りの長さを 1 でなく 2 と読んでいた）だった。
  if (p.rest) descs.set(p.rest, withoutLen(d));
}
const withoutLen = (d) => {
  if (!d || d.len === undefined) return d;
  const { len, ...rest } = d;
  return rest;
};

// 括りの関数の適用（§3.4 の括りの関数の行）。k = n のとき（前から順に当てる）と、最後の仮引数が括りで k > n の
// とき（残りの並び全体を最後の括りが1つの List として受ける、R24）と、最後の仮引数が裸で k > n のとき（前から n 個
// だけを当てる。余りは鍵に入れない）に実体を作る（呼ぶのは doneKind・closeKind）。部分適用は、残りが来たときに当てた物と
// 合わせて、元の関数のこの3つのどれかで作る（patternPartial）。
function instantiate(F, fn, op, params, defScope, argDescs) {
  const plain = fn.type === "plain"; // 素の関数の単相化（R81）。言い分の名指しだけが違う
  // R90（2026-10-27、§5 Q70 の答え）：頭の名前がある括り（`[a b c]`・`[x ~xs]`。名前が1つ以上の素直な括り）に空の List（書いた `[]`・`e : []` の e・空の流れ
  // `[]~` を丸ごと受けた物、R64）が来たら、分解が立たないので本体を走らせずに `_`（A。実体は作らない）。R64 の値の段の読み「空の List が来たら、頭の名前がある括りは
  // 分解が立たず、本体を走らせずに `_`」を木の段でも読む。根拠：主の Claude の傾き「Q70 | `f [] `（頭の名前がある括り）の木の種類 | A（値は `_`）。`[] = _` で分解が
  // 立たないだけ」（2026-10-26 11:57 の表の A）に、利用者は異議を言わなかった（傾きで受けた、R）。前は `[]` が中身の見えない A なので名前が未知で、`f []` は未知の根
  // （後ろに項が来れば G2(a)）。`[~xs]` だけの括りは空でも立つので、今のまま本体を読む。
  // 書いた `_` と分かる値（印 zero、R63・R91。`un`・`[_]`・`~_`）が括りの口に直に来た形も同じ：参照の口の `_` は空の器 `[]`（R83、R65 の値の段の読みを木の段でも）。
  // 前（R63）は中身の見えない A と同じに受けて、名前が未知だった。
  // 2026-10-27 の確かめの直し：書いた時点で長さ 0 と分かる List・文字列（len 0。空の文字列 `` `` `` は String ≅ List(Char) の空の List、括りの残りの名前が空の物）も
  // 同じ。前は形のある desc を空と見ず、`fe ``` は R91 の長さ 0 の実体で本体を全部 `_` の名前で読み（G7）、`len ``` は本体を読んでいた。
  // 片イ（R122、戻2 で R90 を狭めた）：本体を読まないのは、残りを受ける括り（`[x ~xs]`。どの位置でも）と最後の仮引数の括り（`[a b c]`・`second` の `[b]`）に空が来た時
  // だけ。最後でなく `~` も無い括り（`second : [a] [b] ? b` の `[a]`）は、空で席を取って本体を読む（名前は `_`、bindParams）。`[~xs]` だけの括りは今のまま空でも読む。
  // 根拠：書いた `[]` は括りの口に届く物のまま（U [2026-11-01 22:19 159479c9]「…そう考えると、届くもののままで良い。」、`second [] 1` は 1。問5）。線そのものは、問5 と
  // R64 の出どころ（空なら本体を走らせない、`f : [a b c]` の話）を両方残す一番狭い線として主の Claude が閉じた物（R .80）。前は最後でない `[a]` にも当てて、
  // `second [] 1` は本体を読まずに `_`（A）で、木は答えと同じ形に見えて中身が逆だった。
  if (!plain && params.some((p, i) => p.kind === "bracket" && p.simple && p.names.length && (i === params.length - 1 || p.rest) && isKnownEmpty(argDescs[i]))) return { kind: A(), inst: null };
  const label = fn.label || (plain ? `[${cutShape(writeTree(op))}]` : fn.label); // 無名の素の関数は書いた綴りで名指しする
  const b = bindParams(params, argDescs, plain);
  const key = `${fnKey(fn)}|${b.key}`;
  const ident = callIdent(fn, params, argDescs);
  let inst = F.instances.get(key);
  if (!inst) {
    // 実体の守り（INSTANCE_DEPTH_MARGIN の注）。深さは鍵だけで決まる普通の門で、超える実体は作らない。守りに当たった `?` では、
    // 新しい実体を作らない（作り続けると、当たった後の枝を全部解いて遅かった）。止めるのは当たった `?` だけにする：全部を
    // 止めると、ほかの `?` の守りや、新しい実体を通る値を含む輪が見つからず、言うことが定義の順で割れた（確かめ 2026-10-20）。
    // 深さの門は止める所より先に見る（鍵だけで決まる門なので、木を残す段が守りに当たった後でも同じ所で断り、最後の木の門を
    // 言える。refusalOf）。
    const depth = instanceDepth(params, argDescs);
    if (depth > F.depthLimit) throw depthGate(label, b.text, depth, F.depthLimit, plain);
    const stopped = F.guardStops.get(op);
    if (stopped) throw stopped;
    // 範囲の深さ（中で書いた閉包の深さ、fnDepth）は、当てた物の深さと書いた所の範囲の深さの大きい方。
    b.depth = Math.max(depth, envDepth(defScope));
    // scope は作った側の物の範囲（根の種類を出す、instRootOf）。walked は本体を歩いて記録した物の同一性（callIdent の注）。
    const scope = instScope(F, op, defScope, b, key, ident);
    inst = { isInst: true, key, label: label, shapeText: b.text, depth: b.depth, lambda: op, scope, walked: new Set(), cycleDeps: new Set(), liveOp: null, plain };
    makeLive(F, inst, op, label);
    F.instances.set(key, inst);
    noteCall(F, inst, op, label, true);
  } else if (!inst.liveOp) {
    // 外れた仮置きの上でだけ作った実体を、また呼んだ：作り直したと数える（注の3）。
    makeLive(F, inst, op, label);
    noteCall(F, inst, op, label, true);
  } else noteCall(F, inst, op, label, false);
  b.depth = inst.depth; // 呼んだ側の物の範囲も、同じ深さを持つ（scopeOf）
  const root = instRootOf(F, inst, label);
  // 本体が門に当たる実体を呼んだ：木を残す段はここで呼んだ行ごと断るので、この枠の計算の後ろは最後の木の道に無い（注の2）。
  if (inst.gated && F.stack.length) F.stack[F.stack.length - 1].gated = true;
  if (F.stack.length === 0) {
    recordCall(F, fn, inst);
    // 木と、本体の中の呼び出しの記録は、いま呼んだ側の物の範囲で歩く。実体を作ったのが木を残さない所（値の定義の種類を
    // 出す所など）でも、門は呼んだ行で渡した物の名前で名指しする。
    const scopeOf = () => (ident === inst.scope.ident ? inst.scope : instScope(F, op, defScope, b, key, ident));
    materialize(F, inst, scopeOf);
    if (inst.error) {
      if (!F.matStack.length) throw instanceError(inst, label);
      // 別の実体の本体の中から呼んだ：その実体も同じ門で失敗する。どの実体を、どの名前で呼んで門に当たったかを
      // 覚えておき、いちばん外の呼んだ行で、呼んだ順に名指しする（instanceError）。
      F.matStack[F.matStack.length - 1].via = { inst, label: label };
      throw inst.error;
    }
    // 分け合った実体を、まだ歩いていない物で呼んだ：その物で本体を歩き、呼んだ `?` を記録する（R25）。
    if (!inst.walked.has(ident)) walkCalls(F, inst, scopeOf());
  }
  // 実体の本体の根が A なら A、ほかは未知（§3.4 の素の関数の k = n と同じ）。結果は中身の見えない A。inst は、`$` で物にした括りの関数を呼んだ所が本体の
  // 余る関数を見るため（R75、dollarOpened）。
  return { kind: root === "A" ? A() : U(), inst };
}

// 実体の本体の根の種類（bodyRootOf と同じ仕組み）。label は呼んだ名前（輪の道筋の一歩、stepText）。
function instRootOf(F, inst, label) {
  const memo = freshMemo(F, F.instMemo, inst);
  if (memo) return readMemo(F, memo, () => `\`${label || inst.label}\` を形 ${cutShape(inst.shapeText)} で呼んだ実体の本体`);
  const running = F.inProgress.get(inst);
  if (running) {
    consult(F, running); // 同じ形で自分を呼んだ：同じ実体の仮置き（R24）
    return "A";
  }
  enterNest(F, inst);
  const frame = pushFrame(F, inst);
  frame.label = label;
  let value;
  let gated = false;
  try {
    // 受け皿 dead：本体に値の上に積まれて口が開いたまま閉じた関数（恒等射を除く）があるか。`$` で物にした括りの関数を呼んだ所が見る（R75、dollarOpened）。
    const dead = [];
    const body = resolveBody(inst.lambda.right, { F, scope: inst.scope, diag: null, dead });
    inst.dead = dead[0] || null;
    value = body.rootKind;
  } catch (e) {
    if (!isGate(e)) {
      leaveNest(F, inst);
      abortFrame(F, frame);
      throw e;
    }
    // 本体が門に当たる。木を残す段（materialize）で同じ門に当たり、呼んだ行で断る（深さの守りも、鍵だけで決まる門なので
    // 同じ。INSTANCE_DEPTH_MARGIN の注の1）。
    value = "U";
    gated = true;
    if (e.guard) frame.tainted = true; // 守りの断りを捕まえた（汚れ、refusalOf）
  }
  leaveNest(F, inst);
  // 本体が門に当たるか、門に当たる実体を呼んだ実体は、木を残す段で断る（呼んだ側の枠の後ろは最後の木に無い、instantiate）。
  // 本体の根に残った裸の関数・区間の綴りは、片イ（R125）から `_` にして通す（前は G16 で、ここで門に当たる実体に数えていた）。根が L になるのは
  // 自分の仮置きを読んだ時だけで、そのときは下で未知になる。
  inst.gated = gated || !!frame.gated;
  if (frame.consulted && value !== "A") {
    value = "U";
    frame.failed = true;
  }
  finishFrame(F, frame, F.instMemo, value);
  return value;
}

// 実体の木（R25）。解いている途中の種類が無いときにだけ呼ぶ。本体の中の未定義の名前は、ここで1回だけ information を
// 出す（F.reported）。定義の所では本体を解かないので、呼ばれない本体の中の名前は出さない（読まないので）。
// 範囲（scopeOf）は、はじめて木にした呼び出しの物のもの。その物の分の記録も、この歩きで取る（walked）。
// 木まで解く実体は最後の木の実体で、呼んだ所（instantiate の noteCall。枠が空なので確定した呼び出し）で確定した実体に数えて
// ある（INSTANCE_DEPTH_MARGIN の注の2）。
function materialize(F, inst, scopeOf) {
  if (inst.materializing) {
    // 木を解いている途中の実体を、本体の中からもう一度呼んだ（再帰）。根の種類は仮置きの済んだ答えを使い、木は
    // 外側の1回で作る。外側が門に当たったら、間にある実体（どれも外側を呼んでいる）も同じ門で失敗にする。
    const i = F.matStack.indexOf(inst);
    for (let j = i + 1; j < F.matStack.length; j++) inst.cycleDeps.add(F.matStack[j]);
    return;
  }
  if (inst.done) return;
  enterNest(F, inst);
  const scope = scopeOf();
  inst.walked.add(scope.ident);
  inst.materializing = true;
  F.matStack.push(inst);
  try {
    const body = resolveBody(inst.lambda.right, { F, scope, diag: F.diag });
    inst.tree = body.tree;
  } catch (e) {
    if (!isGate(e)) throw e;
    inst.error = e;
  } finally {
    leaveNest(F, inst);
    F.matStack.pop();
    inst.materializing = false;
    inst.done = true;
  }
  if (inst.error) failDependents(inst);
}
// 分け合った実体の本体を、いま呼んだ側の物（scope）で歩き直し、本体の中の呼び出しだけを記録する（callIdent の注）。
// 木と information は残さない：答えは綴りで決まるので、木は materialize の1回と同じになり、未定義の名前も同じである。
// 歩く前に印を付けるので、同じ物で自分を呼ぶ再帰は1回で止まる。本体の中の実体は、同じ綴りの鍵で materialize の
// 歩きがもう作っている。
function walkCalls(F, inst, scope) {
  inst.walked.add(scope.ident);
  resolveBody(inst.lambda.right, { F, scope, diag: null });
}
// 守り：実体が門に当たると、その門は呼んだ行まで投げ上がり、resolve 全体が断る（materialize は F.stack が空のときにだけ
// 走り、そこから上で門を捕まえる所は無い）。だから輪の途中の実体に付けた失敗は、今は誰にも読まれない（確かめ
// 2026-10-19 で観測できなかった）。門を捕まえて続ける所を足したとき、輪の途中の実体を成功のまま残さないために置く。
// 名指しの名前は、実体を最初に作った関数のもの（その実体を呼んだ名前は、ここでは分からない）。
function failDependents(inst) {
  for (const d of inst.cycleDeps) {
    if (d.error) continue;
    d.error = inst.error;
    d.via = { inst, label: inst.label };
    failDependents(d);
  }
}

// 呼んだ行で断る（R25）。門の番号と reason は本体で当たった門のまま、言い分に関数の名前と形を足す。label は呼んだ行で
// 使った関数の名前（実体は同じ綴りの関数で共有するので、実体を作った関数の名前ではない）。実体の本体の中で別の括りの
// 関数を呼んで門に当たったなら、通った実体を呼んだ順に並べる（e.instance はいちばん外、e.instances は全部）。
function instanceError(inst, label) {
  const e0 = inst.error;
  const chain = [{ fn: label, shape: inst.shapeText }];
  const seen = new Set([inst]);
  for (let v = inst.via; v && !seen.has(v.inst); v = v.inst.via) {
    seen.add(v.inst);
    chain.push({ fn: v.label, shape: v.inst.shapeText });
  }
  const cut = (s) => (s.length > 60 ? `${s.slice(0, 60)}…` : s);
  const seg = (c) => `\`${c.fn}\` を形 ${cut(c.shape)} で`;
  const J = "呼んだ実体の本体で、";
  const named =
    chain.length > 4
      ? `${chain.slice(0, 3).map(seg).join(J)}${J}…（ほか ${chain.length - 4} 段）…、${seg(chain[chain.length - 1])}`
      : chain.map(seg).join(J);
  // 素の関数の単相化（R81）の実体は「素の関数」と名指す（いちばん外の実体で決める）。
  const what = inst.plain ? "素の関数（印のある実引数で実体を作る所、R81）" : "括りの関数";
  // R109（2026-10-28 の片9、§5 Q75 (f) の答え）は、空の List（形 `A[]`）を受けた実体の本体の根に関数が残った G16（`fold $add []`・`k2 []`）に、空を `_` と書く
  // 案内を足していた。片イ（R125）で G16 を廃止し、その所は `_` と bare-function-return の知らせになったので、案内を足す断りが無くなった（知らせに添えるかは §5 Q85）。
  const e = new OperationError(`${what} ${named}呼んだ実体の本体が、門に当たりました（R25：呼んだ行で断る）。${e0.message}`, {
    spec: e0.spec,
    reason: e0.reason,
  });
  e.gate = e0.gate;
  e.guard = e0.guard; // 守りの断りから来た物か（refusalOf）
  e.instance = chain[0];
  e.instances = chain;
  return e;
}

// 中身の見える器（字面の括り・`,` の並び・構築の並び）の要素の種類。見えなければ null。
// 前置 `~` だけで持ち上げた項（R79：書いた `[x]` と同じ項）。中身の見え方（visibleElements）と `_` を指すか（pointsToMark）は、括り1つの `[x]` と同じに読む
// （2026-10-27 の確かめの直し：前は前置の印のある葉として中身を見ず、`e8 : ~[]` の e8 が `[[]]` の空と割れ、`e6 : ~_` の e6 が `[_]` の印 zero を落としていた）。
const isLiftTerm = (term) => !!term && term.type === "atom" && term.pre.length === 1 && term.pre[0] === "~" && !term.post.length && term.core.c !== "indent";
function visibleElements(tree) {
  if (!tree) return null;
  const one = vanishedOne(tree); // 余ったラムダは消える（vanishedOne の注）
  if (one) return visibleElements(one);
  if (tree.t === "construct") return liveItems(tree.items).map(elementKind);
  if (tree.t === "op" && tree.sym === ",") return commaItems(tree).map(elementKind); // 消える `(unit …)` は数えない（R123）
  if (tree.t === "leaf" && tree.cat === "plain" && tree.desc.elements && tree.term && tree.term.type === "atom" && (!tree.term.pre.length || isLiftTerm(tree.term)) && !tree.term.post.length) {
    return tree.desc.elements;
  }
  // `'` で引いた物（R26）と `[' 0] xs` の適用は、形が見えれば要素も持つ。ここで見ないと、中身に関数の見える欄を
  // 引いて撒く形（`[m ' greet]~`）が、形では関数が見えるのに撒く項の門を素通りする。
  if ((tree.t === "leaf" && tree.cat === "plain" && tree.term && tree.term.type === "infix") || tree.t === "apply") {
    return tree.kind.k === "A" && tree.kind.elements ? tree.kind.elements : null;
  }
  return null;
}

// 器の1つの要素の種類。要素が A でも、それ自体が中身の見える器なら中身まで見て、L か未知があれば未知に数える。
// 構築の値を平らにするか（§5 Q12）が決まっていないので、`[fs 1]~` は平らにすれば `fs` の中の関数を撒く。
// 1段だけ見ると、ここを素通しする（§3.3 の手順1「中身に L か未知が見えるもの → G7」）。欄（`k : inc`）は、
// 行の種類は A でも中身は右辺なので、右辺を見る。
function elementKind(node) {
  if (!node) return "U";
  if (node.t === "op" && node.sym === ":") return elementKind(node.right);
  if (node.kind.k !== "A") return node.kind.k;
  const inner = visibleElements(node);
  return inner && inner.some((k) => k !== "A") ? "U" : "A";
}

// ---------------------------------------------------------------------------
// 項の種類（§2、手順の 0）
// ---------------------------------------------------------------------------
//
// 返す物：{cat, desc, view, isLambdaName?, isQBracket?}
//   cat：'plain'（ふつうの葉）・'unit'（書いた `_`＝印。長さ 0 の流れ `[]~`・`_~` も、R84・emptyMark）・'hole'（括らない `!_`＝穴）・'input'（前置 `@`）
//   （'ptilde'（`~_`）は 2026-10-27 の R88 で無くなった。`~_` は書いた `[_]` と同じ plain の葉、R79）
//   印と穴は位置で読みが決まる（§3.5、markStep・tryHole）ので、葉の desc は未知にしておく。決まった所でだけ A（印）か L（恒等射）にする。

function classify(term, ctx) {
  if (term.type === "infix") return classifyInfix(term, ctx);
  const { pre, core, post } = term;
  const view = { v: "atom", text: writeTerm(term) };
  const plain = (desc, extra = {}) => ({ cat: "plain", desc, view, ...extra });

  if (pre.length === 0 && post.length === 0) {
    switch (core.c) {
      case "lit":
        // 文字列の字面は List（R24。String ≅ List(Char)）。要素は文字で、文字は Int と同じ扱いの数（README の法則 B）。
        // 番地の字面は数でない（SCALAR の注）ので中身の見えない A。ほかは数・文字の字面（litDesc）。
        return plain(litDesc(core));
      case "unit":
        return { cat: "unit", desc: U(), view };
      case "name": {
        const desc = lookup(core.name, ctx);
        const extra = { isLambdaName: isLambdaName(core.name, ctx), count: valueCountOf(core.name, ctx), strCount: stringCountOf(core.name, ctx) };
        // 名前の読み（どの定義を指すか）が決まらない名前には印 undecided を付ける（片イ、R120 の例外。reduceFold の前検査が読む）。
        if (desc.k === "U") {
          const why = undecidedWhy(core.name, ctx);
          if (why) extra.undecided = why;
        }
        return plain(desc, extra);
      }
      case "bracket": {
        const b = bracketInfo(core, ctx);
        return { cat: "plain", desc: b.desc, view: { ...view, inner: b.trees }, isQBracket: b.isQ };
      }
      case "abs":
      case "norm": {
        const a = enclosureInfo(core, ctx);
        return { cat: "plain", desc: a.desc, view: { ...view, inner: a.trees } };
      }
      case "indent": {
        const b = blockInfo(core, ctx);
        return { cat: "plain", desc: b.desc, view: { v: "block", rows: b.trees } };
      }
    }
  }
  // `$` が前に付いた項は、`$` の先を1つの関数と言い切れるときだけ値（関数を物にした番地。§2、96）。言い切れなければ G20（classifyDollar）。
  if (pre[0] === "$" && core.c !== "indent") return classifyDollar(term, ctx, plain);
  // 前置 `@`：種類は並びの位置で決まる（§2、G6）。片イ（R126）から G6 で断らず、頭以外か頭ですぐ右が関数の入力の項は種類の未知な項として畳む（foldItems）。
  // R49（2026-10-24）：x の desc が関数を指す番地の印（ref）を持てば、`@x` はその関数そのもの（L、口の数が分かる。前置 `@` の
  // 項ではないので G6 にも当たらない）。印が無ければ今までどおり（入力の項）。
  // R60（2026-10-25）：x の desc が値を読む参照の印（vref）を持てば、`@x` は指す値を読む（`@p` は p が指す値。開いた後の並びは今の規則のまま）。
  if (post.length === 0 && pre.length === 1 && pre[0] === "@" && (core.c === "name" || core.c === "bracket")) {
    const pd = pointedDesc(core, ctx);
    const d = refOf(pd);
    if (d) return plain({ k: "L", fn: dollarOpened(d.ref) }); // `$` で物にした括りの関数は、呼んだ実体の余る関数を見る（R75、dollarOpened）
    const v = vrefOf(pd);
    if (v) return plain(openSelfReader(v.vref, ctx));
    // 番地の算術で作った点・差（R62）を開く：ずらした点が指す物は、差が指す物の要素の幅の倍数かと一緒に型の段で決まるので、解決器の段では分からない。
    // 差は位置ではないので読めない。印の無い前置 `@`（入力の項）に倒さずに断る（§5 Q66）。
    if (addrOf(pd)) throw refuseOpenAddress(writeTerm(term), pd);
    return { cat: "input", desc: { k: "L", fn: { type: "input" } }, view };
  }
  // 後置 `~`（撒く項）。
  if (pre.length === 0 && post.length === 1 && post[0] === "~") return classifySpread(term, view, ctx);
  // 前置 `~`（R79、2026-10-26。§5 Q14 の答え）：前置の印は単一の対象か括りの式にだけ係るので、`~x` は x を要素1つの List に持ち上げた物で、書いた
  // `[x]` と同じ項（[x] ≅ x。種類と desc は1行の括り `[x]` のもの）。`~1 2 3` は `(~1) 2 3`、つまり `[1] 2 3`。根拠：U〔答え〕[2026-10-25 22:42 c8ccdd69]「Q14
  // 持ち上げたいなら積の形も使えるからね、一般の式の中なら使う意図が , と被るのは確か。どうしても一要素だけリストに持ち上げたいときの前置~は有りだと思う。
  // 前置演算子のルールは前にも述べたが、カッコ付きの式か単一の対象。つまり単一の対象と言えるものだけが範囲。」、主の Claude の 22:43 の受け取り（`~1 2 3` は
  // `[1] 2 3`、G4 は外す）に U〔答え〕[22:45]「その方向でお願い。」。前は種類を決めず、2項以上の並びにあれば G4 だった。
  // 書いた `_` の持ち上げ（`~_`）は、`[_]` が閉じた1つの項（R56・R61）か、並びの単位として消える印かが答えの文から決まらないので、今のまま種類を決めず、
  // 2項以上の並びにあれば G4（§5 Q14 の残り）。→ 2026-10-27 の R88 で G4 を廃止し、`~_` も書いた `[_]` と同じ項にした（下の `~` の枝の注）。
  // `~$x`（2026-10-26 の確かめの直し）：前置の印は核に近い物から結ぶ（R53・R57）ので `~($x)`。`$x` は単一の対象（関数を指す番地か値を読む参照、R60）なので、
  // `[$x]` と同じ項（関数を値として持つ List を作るなら `$` を付ける、R75 の案内と同じ線）。前は前置の印2つの表に無い組み合わせで、未知（並びの中で G7）。
  // ほかの印との組み合わせ（`~-5`・`~!x`・入力の `~@uart`）は今のまま表に無い組み合わせ（§5 Q14 の残り）。
  if (post.length === 0 && pre.length === 2 && pre[0] === "~" && pre[1] === "$" && core.c !== "indent") {
    const b = bracketInfo({ c: "bracket", rows: [{ type: "seq", terms: [{ type: "atom", pre: ["$"], core, post: [] }] }] }, ctx);
    return { cat: "plain", desc: b.desc, view: { ...view, inner: b.trees }, isQBracket: b.isQ };
  }
  if (post.length === 0 && pre.length === 1 && pre[0] === "~") {
    // `~_`（R88、2026-10-27。§5 Q14 の残りの答え）：R79 のとおり書いた `[_]` と同じ項（下の bracketInfo の道）。`[_]` は R63 の文面の「書いた `_` と分かる値」（印 zero）
    // なので、`~_` も `_` と分かる値：値の口では `inc [_]` と同じく書いた `_` と同じ（R94、2026-10-27 の片6。書いた括りの `[_]`・`~_` は中身が詰まって `[]` で、
    // 値の口では同じ位置に書いた `_`。片5 の間は `inc un` と同じ A だった）、括りの口では R90 の A、並びの中では閉じた1つの項
    // （R63 の「名前・括りを通した `_` は閉じた1つの項」）、撒けば長さ 0 の流れ（R84）。根拠：主の Claude の傾き「Q14 の残り | `~_` | `_`。持ち上げた `[_]` は、List の中の
    // `_` が連結の単位で消えて `[]`、つまり `_`」（2026-10-26 11:57 の表の A）に、利用者は A の行に異議を言わなかった（U [2026-10-26 23:35 c8ccdd69] は B の行と R39 だけに
    // 答えた。主の Claude は、傾きと違う物だけ言う取り決めどおり傾きで受けた、R）。前は種類を決めず、2項以上の並びで G4（`[_]` が閉じた1つの項か、並びの単位として消える
    // 印かが決まらない）。2026-10-27 の確かめの直し：最初の版は `~_` を書いた `[]`（空の括り）にしていて、書いた `[_]` と答えが割れた（`inc ~_` は G5、`inc [_]` は A）。
    // `[_]` を `[]` と同じにする読み（傾きの途中の式）は、片5 では値の口で R85 の割れに入るかが決まらないので §5 Q75 (a) に残し、片6 の R94 で値の口では `[]` と同じ
    // （書いた `_` と同じ）に決まった。値の口でない所（並びの中・括りの口・名前の右辺）は今のまま R63 の `_` と分かる値。
    if (core.c === "indent") {
      touchCore(core, ctx);
      return { cat: "plain", desc: U(), view }; // 字下げのブロックの持ち上げは表に無い組み合わせ（未知。前は `~_` と同じ ptilde の G4）
    }
    const b = bracketInfo({ c: "bracket", rows: [{ type: "seq", terms: [{ type: "atom", pre: [], core, post: [] }] }] }, ctx);
    return { cat: "plain", desc: b.desc, view: { ...view, inner: b.trees }, isQBracket: b.isQ };
  }
  // 括らない `!_`：穴（その口の恒等射、§3.5）。読みは位置で決まる（口の中は穴：tryHole・holeRefusal、口の外は恒等射：holeStep、R44・R46）。
  if (post.length === 0 && pre.length === 1 && pre[0] === "!" && core.c === "unit") return { cat: "hole", desc: U(), view };
  // 値の演算子の印：A の核なら A、L・未知・`_` の核なら未知（§2、Q22）。
  if (pre.every((p) => VALUE_PREFIX.has(p)) && post.every((p) => p === "!")) {
    if (core.c === "unit") return plain(U());
    const inner = classify({ type: "atom", pre: [], core, post: [] }, ctx);
    // 核の view（括りなら解いた中の木 inner を持つ）を、印の付いた項の view にも置く（R97 の intTerm が `-(5)`・`!!(2 + 3)` の核を読む。2026-10-27 の片7 の確かめの直し）。
    view.coreView = inner.view;
    // 値の印（前置 `-`・`!!`・後置 `!`）は値の演算子：核が関数を指す番地なら G7、番地の点・差なら G21（R62、§5 Q66）、素の関数の裸の仮引数なら札に覚える（R60 の細かい所。
    // valueOperand）。前置 `!` だけの項（`!p`）は否定で、値の演算子ではないので今のまま。
    const mark = pre.find((p) => p !== "!") || (post.length ? "!" : null);
    // R87（2026-10-27、§5 Q73 の答え）：値の印（前置 `-`・`!!`・後置 `!`）の核に丸ごとの関数があれば、中置の値の演算子の被演算子と同じく評価する所で `_` になり、
    // 恒等射でなければ知らせる（`-inc` は `-_` の値、A）。葉は書いたまま（`(unit …)` を書く所が無い）。前置 `!` だけの否定（`!f`）は値の演算子ではないので今のまま未知。
    if (mark && inner.cat === "plain" && inner.desc.k === "L") {
      reportLeftover({ t: "leaf", view: inner.view, kind: inner.desc }, ctx, term, "place-op");
      return plain(A());
    }
    if (mark && inner.cat === "plain") valueOperand(inner.desc, mark, () => inner.view.text);
    if (!(inner.cat === "plain" && inner.desc.k === "A" && !inner.desc.spread)) return plain(U());
    // 数に値の印を当てても数（SCALAR の注）。ただし前置 `!` は外す：`!_` は恒等射（穴、§3.5）で、`_` でない物に当てると
    // `_` になる。だから `!x` は数にならず、x が `_` になる物（`1 < 0`・`/ 0`）なら関数になる。数と読むと、
    // `f !(1 < 0)` の実体で `h 5` を黙って構築と読む。
    return plain(isScalar(inner.desc) && !pre.includes("!") ? scalarDesc() : A());
  }
  // 後置 `@`（取り込み）・前置 `#`・表に無い印の組み合わせ（`@f~` など。`$` が前に付いた項は、印の組み合わせに依らず上の `$` の枝
  // classifyDollar で決める）は未知（§2、G7）。片イ（R120）から、その未知は並びの中でも G7 で断らず畳む（foldStep）。
  touchCore(core, ctx);
  return plain(U());
}

// ---- `$` の先は1つの関数（R53・R54〜R57、G20） ----
//
// `$X` は、X を書いた所で1つの関数と言い切れるときだけ値（関数を物にした番地、A）。言い切れなければ G20（refuseDollar）。
// 根拠：U [2026-10-24 16:52 8dfc006e]「そもそも、$が指定できるのは、一つの関数だと言い切れることが条件。」。主の Claude はこの条件で通す物と断る物を
// 分け、「この条件（`$` の先は1つの関数と言い切れること）で入れていい？」と訊いた（16:53 UTC）。続く U [2026-10-25 00:08 8dfc006e]「_は、実は、
// [x ? _] と同じだから / $_ は $[x ? _]」。主の Claude は、並びの中の `_` は余積の単位の顔で、`$` で物にする所で関数の顔（零射）が出る、と読み、
// 「この読みで、`$` の条件（1つの関数と言い切れること）と一緒に入れていい？」と訊いた（00:09 UTC）。U〔答え〕[2026-10-25 00:25 8dfc006e]
// 「正確にはそうなるね。 / 圏論は準同型しか見てないから、すごく大雑把なところがあるのは認める。 / $!_ も同じ理屈で、$に渡せる。 / 後はすべて君の言う通り。」。
// 2026-10-24 の R53（`$` は関数だけを運ぶ）は種類が L かだけを見ていた。この片（2026-10-25）で、言い切れる物を足し（R54 局所の定義、R55 別名の印、
// R56 `$_` は零射、R57 `$` とほかの前置の印の組み合わせで先が関数の物）、言い切れない形（後置の印の付いた物）を断る側に決めた（R57）。
// - 後置の印（`~`・`!`・`@`）が付いた項（`$vs~`・`$inc~`・`$fs~`・`$inc!`・`$5!`・`$x@`・`$!_~`）：`$` と後置の印のどちらが先に結ぶ読みでも、
//   1つの関数と言い切れない（撒いた形は並びで、`!` は値の印、`@` は取り込み）。前（R53）は、核が関数か読みの先が門に当たる物（`$inc~`・`$fs~`・
//   `$inc!`）を表に無い組み合わせの未知にして、根・`,` の辺・`:` の右辺では通していた（§5 Q55）。
// - 書いた `_` の `$_`：`$[x ? _]`（零射。何を受けても `_` を返す1引数の関数）を物にした番地（R56）。指す関数の印（R49）は ZERO_FN。
//   名前・括りを通して書いた `_` を指す物（`$[_]`・`$[[_]]`・`q : _` ⏎ `$q`・`q : _` ⏎ `$[q]`）も同じ（[x] ≅ x、`:` はメタで名前は右辺を指す。
//   pointsToMark）。並びの中の `_` は今までどおり余積の単位（R15）で、`_` を `[x ? _]` と読むのは `$` で物にする所だけ。`_` を指すかは desc に
//   入れず（入れると実体の鍵が見ない印が実体を跨いで分け合われる）、書いた所の木と名前の定義で見る。括りの関数の実体で仮引数に `_` が
//   渡った名前（`h : [s] ? $s` ⏎ `h [s : _]`）は、渡された物の desc だけを見るので今のまま G20（断る側）。
// - `$!_` は恒等射を物にした番地（今までどおり A）。U〔答え〕[2026-10-25 00:25 8dfc006e]「$!_ も同じ理屈で、$に渡せる。」。指す関数の印（R49）は
//   1引数の恒等射 `[x ? x]`（ID1_FN。`$_` が `[x ? _]` の ZERO_FN なのと対）。恒等射の別名（`i : !_` の `$i`、局所の `h : !_` の `$h`、`$[i]`・
//   `$[i , !_]`）も同じ印（下の isRowIdentity。i 自身の種類は、R29 の並び全体を受ける恒等射のまま）。2026-10-25 の §5 Q56 の答え：主の Claude の問い
//   「…Q56 は `$!_` が `[x ? x]` を指す、でいい？」（07:29 UTC）に U〔答え〕[2026-10-25 07:34 2772473e]「そうか分かった！ map : f [~l] ? [@f,] l~ に
//   対して、 map $!_ .. と map $[!_] .. で分かれる。 安心した。」。`map $!_ vs` は恒等射の写像で vs、`map $[!_] vs` は否定の写像（`[!_]` は否定の
//   点なし）。その前（R54〜R57 の片）は、並び全体を受ける恒等射か1引数かが決まっていないので印を付けず、開いた所の `@f` は口の数の分からない
//   前置 `@` の項だった（`map $!_ vs` は実体の `[@f,]` で G7、`map2 $!_ vs` は G19）。作る途中の版は並び全体を受ける恒等射の印を付けていて、
//   `tw : f [~r] ? @f 1 2` ⏎ `tw $!_ vs` の実体が `(apply @f (construct 1 2))` と決まり、`tw $[x ? x] vs` の `(construct (apply @f 1) 2)` と黙って
//   割れていた（同じ日の確かめの指摘）。今は `$[x ? x]` と同じ答え（法則18）。
// - 名前：dollarNameTarget。括り：中身を解いた種類（遅延した式、§5 Q52 の答え）。前置の印がほかにもある（`$$inc`・`$@f`・`$-inc`）か、核が字面・
//   囲み（`$5`・`$||inc||`）：`$` の先は残り全部（前置の印は核に近い物から結ぶ）で、それが L なら通す（R57。指す関数の印も付ける）。
// - R59（2026-10-25、§5 Q53 の答え）：`$[…]` の中身のどこか（入れ子の括り・囲み・欄・`?` の本体を含む）で、値の上に積まれて口が開いたまま閉じた関数
//   （R52 の余ったラムダ。恒等射を除く）があれば、中身は2つの関数を括った形で1つの関数と言い切れないので G20（`$[add (5 inc)]`・`$[x ? x inc]`）。中身を
//   解く所に受け皿（ctx.dead）を置き、余ったラムダを `_` にした所（leftoverUnit）で拾う。名前の先（`p : add (5 inc)` ⏎ `$p`）も、名前は右辺を指す
//   （`:` はメタ）ので、右辺・本体で同じに拾う（dollarNameTarget、deadOfDef。断る側に倒した細かい所、§5 Q62）。中身から名前で指した別の定義の中は
//   見ない（その定義の行で知らせる）。同じ日の確かめの直しから、中身が単位律と [x] ≅ x で名前1つに縮むなら、その名前の物を引き継ぎ（aliasDeadOfTree）、
//   括りの関数の本体（R25：呼ばれるまで読まない）は仮引数を含まない行だけを読み（deadInPatternBody、§5 Q65）、名前の先の本体を覗くのは木を残す段だけ
//   （deadOfDef の注）。
//   根拠：主の Claude「`$[add (5 inc)]` の中身には add と inc の2つの関数がある。…`$[…]` の中のどこかで値の上に積まれて余る関数があれば、中身は
//   1つの関数と言い切れないので G20 で断る。…これで Q53 を閉じる、でいい？」（2026-10-25 07:43 UTC）。その前に U [2026-10-25 07:42 533071da]
//   「Q53は、逆適用が無くなったから危険な形式になったと思う。多分2つの関数を$で括ってるよね？」、答えは U〔答え〕[2026-10-25 07:48 533071da]
//   「Q53はそれで閉じれる。大丈夫！」。前（R52 の片の読み (1)）は、中身の項の中に今のまま R52 を当てて書いた所で知らせ、通していた。
// - R60（2026-10-25、§5 Q54 の答え）：`$` は Reader と Writer を作る接頭辞で、`$名前`（名前が値）・`$[…]`（中身が値）・`$5`（字面）は、その値を読み書きする
//   参照（1つの Reader）として通す（A。指す値の desc を印 vref に持つ。`@x` は指す値を読む）。`$` の先は「1つの Reader（関数か、値を読む参照）と言い
//   切れること」で、言い切れない物（取り込みの名前・枝で選ぶ物・種類が未知・撒いた形・後置の印）は今のまま G20。番地は読む環境の実装の1つで、
//   番地の計算は意味に出ない。Reader は数ではないので、値の演算子の被演算子にする形（`$vs - $vs`・`$x + 1`・`$x == $y`）は名指しで断る（G7、
//   refuseReaderOperand、§5 Q59。同じ日の確かめの直しから、区間・点なし・絶対値・値の印・素の関数の口の綴りでも、valueOperand・readerAtPlain）。
//   → 2026-10-26 の R62（§5 Q59 の答え）から、値を読む参照は番地の点で、中置の `+`・`-`・比べは点と差の規則で読む（addressOp）。断るのは G21。関数を
//   指す番地は今のまま G7。
//   同じ日の確かめの直しから、形の見えない値で中身に関数か未知が見える物（枝で選ぶ括り `$[5 > 1 : inc]`、形の綴り `A(U)`）と、括りの関数の実体で
//   渡された形の見えない値の名前（`h [s : _]` の `$s`、§5 Q64。dollarNameTarget）は G20。→ 2026-10-26 の R63（§5 Q64 の答え）から、書いた `_` と
//   分かる値（印 zero）は零射の番地で通る。印の無い形の見えない値は今のまま G20。
//   根拠：U [2026-10-25 07:51 533071da]「よく考えるんだ。 / $ は Reader と Writer のための単なる接頭辞として、それが偶々アドレスを渡すと読むと同じ読みが
//   出来るだけと読み替えるとおもしろいはずだ。」。主の Claude の問い「`$` を Reader と Writer を作る接頭辞と読み替えて、`$値` も参照として通す（Q54 は
//   これで閉じる）、でいい？」（07:57 UTC）に、U〔答え〕[2026-10-25 08:37 533071da]「それで不都合が起きなければ。 / 細かい問題が起きるなら、もう一度
//   圏論的な視点を。」。Reader は環境 S から読む S ⇒ A、番地は環境をメモリ・番地を鍵にした実装の1つ、`@` は読む（ask）・`#` は書く（Writer の tell・
//   State の put）、という読みは主の Claude の物。前（R53〜R57）は「`$` の先は1つの関数と言い切れること」で、値の先は G20 だった。
// - 2026-10-27 の片8（R99〜R104）：`$` は必ず持ち上げ（R99）。下ろすのは `@` と `' i`。R53・R60 の「`$` の先は1つの Reader と言い切れること」の門は、警告の重さに
//   読み替えた：先が関数なら今までどおり（指す関数の印 ref）、関数でない物（値・字面・値の器・足りた適用・非同期の手形）は今までどおり値を読む参照（印 vref）で
//   通し、warning の dollar-non-function で知らせる（R100、reportLift。async に例外は作らない）。先の種類が書いた所で分からない物（取り込みのある範囲の名前・根の
//   未知な適用・枝で選ぶ括りなど形の見えない値で中身に関数か未知が見える物・括りの関数の実体で渡された形の見えない値）は、持ち上げた番地（印 lift、liftOf）で通す：
//   関数の番地か値の番地の点かは決まらないので、`@` は印の無い前置 `@` と同じく先を読まず、値の演算子に置けば G21、撒けば R57 と同じ G20。警告は、実体で値と分かった所
//   （括りの関数の実体で渡された形の見えない値）だけ出す。G20 に残るのは、後置の印と組んだ形（R57）・中で余る関数（R59・R75。中身の並びそのものの値の上に積まれた
//   関数 `$[5 inc]` も）・書いた `,` の積（R101、単位律の後）と、先の名前の読みが決まらない所（括りの欄の名前の R54 の理由。§5 Q10・Q78）だけ。長さ 0 と分かる流れに
//   後置の `~` を付けた形（`$[]~`・`$[[]~]`）は `[]~ = _`（R84）で `$_` と同じ零射の番地（R104、§5 Q75 (d)）。持ち上げの中身を解いている途中に、持ち上げより前から
//   解いている名前へ戻る輪は、持ち上げを通る輪で値の輪ではないので通す（R103。classifyDollar の輪の握りつぶし。輪の定義から定義の時に下ろす所が見えれば
//   通さない、liftRingLowering）。
//   根拠：U [2026-10-27 10:11 UTC 58a809c9]「$が関数以外のものを運んでいたら警告クラスだｗ」「…$は必ず持ち上げだと読んでごらん。 / 筋が通る」、U [10:24]「この段階で,が
//   ついてるので無し。 / [$v , 1] なら、その意味になりそうだと理解できる」、U [10:51]「heavyは関数じゃない / 非同期なら / @heavy / だと思うけどね…」、主の Claude の
//   まとめに U〔答え〕[10:56]「それでいい。async も例外なしで、`$` が関数以外を運んだら警告、書いた `,` の積の `$` は断って `[$v , 1]` を案内。`$v ' 0` は v、下ろす所を
//   通る輪だけ断る。片 7 の次に片 8 として入れて。」（文はボタンの文で、主の Claude の物）。
function classifyDollar(term, ctx, plain) {
  const { pre, core, post } = term;
  if (post.length) {
    // R104：長さ 0 と分かる流れ（`$[]~`・`$_~`・`$[_]~`・`e0 : []` の `$e0~`）は `[]~ = _`（R84）なので `$_`。ほかの後置の印は R57 の G20。
    if (emptyStreamTerm({ type: "atom", pre: pre.slice(1), core, post }, ctx)) return plain({ k: "A", ref: ZERO_FN });
    throw refuseDollar(term, null, ctx, { where: "post" });
  }
  if (pre.length === 1 && core.c === "unit") return plain({ k: "A", ref: ZERO_FN });
  if (pre.length === 2 && pre[1] === "!" && core.c === "unit") return plain({ k: "A", ref: ID1_FN });
  // R103：持ち上げの中身を解いている途中で、持ち上げより前から解いている名前へ戻る輪（輪のいちばん下の枠が、ここに来る前から積まれている）は、持ち上げを通る輪。
  // 持ち上げは中身を評価しないので、値の輪ではない。輪を握りつぶし、中身はその輪の答えが出るまで分からない値を読む参照（印 selfOf、R73 の `$v` と同じ）で通す。
  // 輪の中でその参照を `@`・`' i` で下ろせば、下ろす所を通る輪なので name-cycle（openSelfReader・pickSelfReader）。木を残す段では名前は解き終えているので、
  // ここには来ない（中身をふつうに解いて、種類で警告を決める）。名前の先（`$v`）の輪は selfReaderTarget が先に拾う。
  // 2026-10-28 の片8 の確かめの直し：通してよいのは、輪の定義（輪の値の定義と、名前で辿るその先）から定義の時に下ろす所（持ち上げの外の `@`・`' i`）が見えない
  // ときだけ（liftRingLowering）。見えれば、下ろす所を通る輪と同じ name-cycle（liftRingRefusal）。持ち上げた物の印は関数の返値を通ると落ちる（実体の根は中身の
  // 見えない A）ので、下ろす所で仮の参照を見るだけでは、`wk : r ? $[g9 r]` ⏎ `v : 1 , @(wk $v)` が黙って通った（確かめの指摘。HEAD は name-cycle）。
  // 前は関数の本体の局所の定義の輪がこの持ち上げを通る所を局所の `$名前` の輪と同じ G20 にしていた（R80、F.liftLocal。§5 Q78 (b)）。寄せ1（R128）で本体に局所の定義は
  // 無くなったので外した。
  const F = ctx.F;
  const liftStart = F.stack.length;
  const beforeCycle = F.cycleRefused;
  try {
    return classifyLift(term, ctx, plain);
  } catch (e) {
    if (!(e instanceof OperationError) || e.reason !== "name-cycle" || !(e.cycleFrom < liftStart) || e.liftRing) throw e;
    const defs = ringDefsOf(F, e);
    const site = liftRingLowering(F, defs);
    if (site) throw liftRingRefusal(F, e, site);
    F.cycleRefused = beforeCycle;
    // 書いた `,` の積（R101）は、中身を丸ごとは解かずに、綴りの上で解いた中身と同じ読みを辿って見る（writtenProductRow。輪の外と同じ答え）。
    const comma = core.c === "bracket" ? writtenProductRow(core, ctx, liftStart) : null;
    if (comma) throw refuseDollarProduct(term, comma, ctx);
    return plain({ k: "A", vref: { k: "A", selfOf: { def: null, frame: F.stack[e.cycleFrom], error: e, defs } } });
  }
}
// `$` の先を解いて、持ち上げた物の desc を返す（classifyDollar の本体。R99〜R104）。
function classifyLift(term, ctx, plain) {
  const { pre, core } = term;
  let target;
  const named = pre.length === 1 ? bracketedName(core) : null;
  // 先の値が Int と書いた所から分かるか（R97：値を読む参照の指す要素の幅、int）。名前は intName、括りは中身の行、字面は intTerm で見る。
  if (named) target = { ...dollarNameTarget(named, ctx), name: named, int: () => !!intName(named, ctx) };
  else if (pre.length === 1 && core.c === "bracket") {
    // 中身が1項だけで、その項に後置の印が付いている（`$[vs~]`・`$[5!]`・`$[[x@]]`）：[x] ≅ x で、括らない `$vs~`・`$5!` と同じ先（R57 の G20）。R60 で
    // 値の先が通るので、ここで見ないと、括った綴りだけが値の参照で通り、括らない綴りの G20 と割れる（法則17 の (a')）。
    // 2026-10-28 の片8 の確かめの直し：その項が `$` の項（`$[$[]~]`・`$[$vs~]`）なら、後置の印はその `$` の項の物で、内側の classifyDollar が決める（`$[]~` は R104 で
    // `$_`、`$vs~` は R57 の G20）。前はここで外側の R57 として断り、`$[$[]~]` が `$[$_]`（値の持ち上げで警告）と割れた（確かめの指摘）。
    const marked = dollarFree(postMarkedInside(core));
    if (marked) {
      // R104：中身が長さ 0 と分かる流れ1つ（`$[[]~]`・`$[_~]`）なら、`$[_]` と同じ零射の番地（[x] ≅ x と `[]~ = _`）。
      if (emptyStreamTerm(marked, ctx)) return plain({ k: "A", ref: ZERO_FN });
      throw refuseDollar(term, null, ctx, { where: "post", inner: marked });
    }
    const dead = [];
    const b = bracketInfo(core, { ...ctx, dead }, true);
    // 中身が単位律（R44・R45・R61）と [x] ≅ x で項1つに縮むなら、その項で見る（2026-10-25 の確かめの直し）：後置の印の付いた項・撒いた形の名前に
    // 縮む中身（`$[vs~ , _]`・`$[5! , !_]`・`w : vs~` ⏎ `$[w , !_]`）は、`$[vs~]`・`$[5!]`・`$w` と同じ G20（R57）。名前1つに縮む中身（`$[p , !_]`・
    // `$[_ , p]`・`$[!_ p]`・`i : !_` ⏎ `$[i p]`）は、`$p` と同じく名前の先の余る関数を引き継ぐ（R59、§5 Q62）。前は書いた字面の1項（postMarkedInside）と
    // 名前1つの字面（deadOfAlias）だけを見て、縮む綴りが値の参照で通った（確かめの指摘）。
    const one = b.trees.length === 1 ? unitReduced(b.trees[0]) : null;
    const leafTerm = dollarFree(one && one.t === "leaf" && one.term && one.term.type === "atom" ? one.term : null);
    if (leafTerm && leafTerm.post.length) {
      if (emptyStreamTerm(leafTerm, ctx)) return plain({ k: "A", ref: ZERO_FN }); // R104（`$[[]~ , !_]` は `$[[]~]`）
      throw refuseDollar(term, null, ctx, { where: "post", inner: leafTerm });
    }
    if (one && one.kind && one.kind.k === "A" && one.kind.spread) throw refuseDollar(term, one.kind, ctx, { where: "spread" });
    // R101（2026-10-27 の片8）：単位律（R45・R61・R71）を当てた後にも中身の根に `,` の積が残れば、書いた `,` の積を持ち上げた形で断る（`$[v , 1]`・`$[inc , double]`）。
    // `$[inc , !_]`・`$[_ , 5]` は単位律で1項に縮むので、その項で見る。積が名前を通して初めて見える所（`p : v , 1` ⏎ `$p`）は、名前の先の値で R100 の警告。
    if (one && one.t === "op" && one.sym === ",") {
      let els = null;
      try {
        els = writtenProductRow(core, ctx);
      } catch (e) {
        if (!(e instanceof OperationError)) throw e;
      }
      throw refuseDollarProduct(term, els, ctx);
    }
    // 中身が名前1つに縮み、その名前が括りの関数の実体で渡された形の見えない値なら、`$名前` と同じ（`$[s , !_]`・`$[_ , s]` は `$s`。2026-10-26 の R63 の片で
    // 見つけた：R60 の確かめの片は名前1つの綴り `$s`・`$[s]` だけを断り、縮む綴りは値を読む参照で通っていた。書いた `_` と分かる値は下の zero で零射）。
    // 2026-10-27 の片8 から、G20 でなく持ち上げた番地で通して警告する（R100。dollarNameTarget の opaque）。
    const oneName = one && one.t === "leaf" && one.term && one.term.type === "atom" && !one.term.pre.length && !one.term.post.length && one.term.core.c === "name" ? one.term.core.name : null;
    const opaque = !!oneName && instOpaqueName(oneName, ctx);
    // 書いた `_` を指すか（R56）は、木で見る（pointsToMark）か、中身の desc の印 zero で見る（R63。括りの関数の実体の中の `$[s , !_]` の s は、名前の木では
    // 見えない）。
    target = {
      kind: opaque ? U() : b.desc,
      opaque,
      name: opaque ? oneName : undefined,
      unit: (b.trees.length === 1 && pointsToMark(b.trees[0], ctx)) || !!zeroOf(b.desc),
      // 2026-10-27 の片8 から、中身の並びそのものの値の上に積まれて口の開いた関数（`$[5 inc]`。遅延した積み上げ、§5 Q52）も、中で余る関数（R59）。前は種類が
      // 未知で、R53・R60 の「1つの Reader と言い切れない」の G20 だった。
      dead: dead[0] || stackedLeftover(one) || (one ? aliasDeadOfTree(ctx.F, one, ctx.scope) : null),
      // 中身が1行なら [x] ≅ x でその行、2行以上なら行が要素の List。
      int: () => (one ? !!intTree(one, ctx) : allScalar(b.trees, ctx)),
    };
  } else {
    const atom = { type: "atom", pre: pre.slice(1), core, post: [] };
    const inner = classify(atom, ctx);
    target = { kind: inner.cat === "plain" ? inner.desc : U(), int: () => !!intTerm(atom, inner.view, ctx) };
  }
  if (target.dead) throw refuseDollar(term, target.kind, ctx, { ...target, where: "dead" });
  if (target.unit) return plain({ k: "A", ref: ZERO_FN });
  const kind = target.kind;
  // 撒いた形を指す名前（`w : vs~` の `$w`）は、`:` はメタで `$vs~` と同じ形なので、R57 と同じく G20。
  if (kind && kind.k === "A" && kind.spread) throw refuseDollar(term, kind, ctx, { ...target, where: target.where || "spread" });
  // 先の名前の読みが決まらない所（R54 の理由：括りと構造体のブロックの行の名前、local-field）は、今のまま G20（§5 Q10・Q78）。種類ではなく、名前がどの定義を
  // 指すかが決まらない所なので、R99 の読み替えの外に置いた。寄せ1（R128）の前は、関数の本体の局所の名前の理由（入れ子の括りの中だけ・枝のある本体・隠し・同じ範囲に
  // 2つ・局所の `$` の輪・それを裸で書いた別名）もここだった。本体の行は何も定義しないので、`$名前` は本体の行を見ずに仮引数・ファイルの定義・未定義の名前を引く。
  if (target.where && NAME_UNDECIDED.has(target.where)) throw refuseDollar(term, kind, ctx, target);
  // 括りの関数の実体で渡された形の見えない値（R63 の印の無い物）：実体では値と分かるので警告する（R100）。`_` か `_` でない値かは分からない（`$_` は零射の番地、
  // 値は値を読む参照で、`@f 1` の読みが割れる、§5 Q64）ので、持ち上げた番地（印 lift）で通す。前は G20。
  // 2026-10-28 の片8 の確かめの直し：渡された物の中身に関数か未知が見える（形の綴り `A(U)`。枝で選ぶ括り `[5 > 1 : inc]`）なら、書いた所に直に置いた `$[5 > 1 : inc]`
  // と同じく関数かもしれないので知らせない（下の A(U) の枝と同じ）。前は実体を通すと「関数ではありません」と言い切り、包み方で知らせが割れた（確かめの指摘）。
  if (target.opaque) {
    if (deepKind(target.opaque) === "A") reportLift(term, ctx, target, "opaque");
    return plain(liftDesc());
  }
  // 先の種類が書いた所で分からない物（取り込みのある範囲の名前・根の未知な適用・遅延した式の未知）と、形の見えない値で中身に関数か未知が見える物（形の綴り
  // `A(U)`。枝で選ぶ括り `$[5 > 1 : inc]`・欄と値の混ざった行）は、持ち上げた番地（印 lift）で通し、警告しない（関数かもしれない）。前は R53・R60 の G20。
  // 形の見える器（`$fs`）は値を読む参照（下）。
  if (!kind || kind.k === "U" || (kind.k === "A" && !kind.shape && !readerOf(kind) && deepKind(kind) !== "A")) return plain(liftDesc());
  // R60：先が値なら、その値を読む参照。2026-10-27 の R97 から、先が Int と書いた所から分かれば、指す要素の幅 w（Int の語の 8 byte）を持つ（幅の倍数の門、
  // addressOp）。2026-10-27 の片8（R100）から、関数以外を持ち上げたので警告する（`$v` の輪で仮に置いた参照 selfOf は、v を解き終えた木を残す段で決める）。
  if (kind.k === "A") {
    if (!kind.selfOf) reportLift(term, ctx, target, "value");
    return plain(target.int && target.int() ? { k: "A", vref: kind, w: INT_WORD } : { k: "A", vref: kind });
  }
  // 指す関数の印（R49）。2026-10-25 の R55 から、値の定義の名前（別名 `p : inc` の `$p`）にも付ける（前は覗いた物だけで、別名には付けなかった。§5 Q45）。
  // 恒等射（`i : !_` の i）の印は、`$!_` と同じ1引数の恒等射（上の `$!_` の注、§5 Q56 の答え）。
  return plain(kind.fn ? { k: "A", ref: isRowIdentity(kind.fn) ? ID1_FN : kind.fn } : A());
}

// 先の名前の読みが決まらない所（R54 の理由、dollarNameTarget の where）。2026-10-27 の片8 でも G20 に残す（§5 Q78）。寄せ1（R128）から括りの欄の名前（local-field）だけ。
const NAME_UNDECIDED = new Set(["local-field"]);
// 先の種類の分からない持ち上げ（R99・R100、2026-10-27 の片8）の desc：印 lift。関数の番地（ref）か値を読む参照（vref）かは決まらない。
const liftDesc = () => ({ k: "A", lift: true });

// R100（2026-10-27 の片8）：`$` が関数以外（値・字面・値の器・足りた適用・非同期の手形）を持ち上げた所を、warning の dollar-non-function で知らせる。断らない。
// 書いた所（`$` の項）ごとに1回（括りの関数の実体ごとに本体を読み直しても、同じ書いた所なら出し直さない。reportLeftover と同じ）。読まない本体（R25）と、
// 種類を出すだけの段（diag が null）では出さない。what は "value"（値）か "opaque"（括りの関数の実体で渡された形の見えない値）。
function reportLift(term, ctx, target, what) {
  if (!ctx.diag || ctx.F.reportedLift.has(term)) return;
  ctx.F.reportedLift.add(term);
  const text = writeTerm(term);
  const inner = writeTerm({ ...term, pre: term.pre.slice(1) });
  const opaque =
    what === "opaque"
      ? `（括りの関数の実体で渡された値です。書いた \`_\` と分かれば \`$_\` と同じ零射の番地で知らせませんが、形の見えない値はどちらか分からないので、\`@\` で開いても先を読みません。§5 Q64）`
      : "";
  pushDiag(
    ctx,
    "dollar-non-function",
    text,
    `\`${text}\` の \`$\` は持ち上げで、先 \`${inner}\` は関数ではありません${opaque}。関数以外を持ち上げると、番地が現れるだけです。値が欲しいなら \`$\` を外して \`${inner}\` と書き、非同期の手形を待つなら \`@\` で下ろします（§4 R99・R100）。`
  );
}

// R104（2026-10-27 の片8、§5 Q75 (d)）：項 t（`$` を外した先）が、後置の `~` 1つで長さ 0 と分かる流れか（`[]~`・`_~`・`[_]~`・`[[]]~`・`e0 : []` の `e0~`）。
// `[]~ = _~ = _`（R84）なので、`$` で持ち上げれば `$_` と同じ零射の番地。撒く項の読み（classifySpread）の数と isKnownEmpty で見る（classifyInfix の unitIfEmpty と同じ）。
// 撒く項に読めない物（関数・Reader を撒く形）は false（R57 の G20 のまま）。
// 2026-10-28 の片8 の確かめの直し：撒く名前を解いている途中の輪に当たったら（`v : 1 , $v~`）、長さ 0 とは言えないので false。探りで作った輪の断り（F.cycleRefused）は
// 戻す（探りの前から解いている名前へ戻る輪だけ。writtenProductRow と同じ）。前は戻さず、R57 の G20 を投げた後に resolve の最後が name-cycle で断り、輪の外の綴り
// （`u : vs` ⏎ `v : 1 , $u~`）の G20 と割れた（確かめの指摘）。
function emptyStreamTerm(t, ctx) {
  if (!t || t.type !== "atom" || t.pre.length || t.post.length !== 1 || t.post[0] !== "~") return false;
  const F = ctx.F;
  const start = F.stack.length;
  const before = F.cycleRefused;
  try {
    const x = classify(t, ctx);
    return x.cat === "unit" || (x.cat === "plain" && !!x.desc && !!x.desc.spread && (x.count === 0 || isKnownEmpty(x.desc.of)));
  } catch (e) {
    if (!(e instanceof OperationError)) throw e;
    if (F.cycleRefused !== before && F.cycleRefused && F.cycleRefused.cycleFrom < start) F.cycleRefused = before;
    return false;
  }
}

// R59 の根（2026-10-27 の片8）：`$[…]` の中身の並びそのものの、値の上に積まれて口の開いたまま残った関数（`$[5 inc]` の inc。中身は遅延した式で R52 の判定を
// しない（§5 Q52）ので、finishTrees は構築のいちばん上に関数を残し、種類を未知にする）。恒等射は R72 で即時に消えているので、ここに来ない。無ければ null。
function stackedLeftover(one) {
  if (!one || one.t !== "construct" || !Array.isArray(one.items) || one.items.length < 2) return null;
  const last = one.items[one.items.length - 1];
  return last && last.kind && last.kind.k === "L" && !isIdentityKind(last.kind) ? last : null;
}

// R101（2026-10-27 の片8）：`$[…]` の中身が、1行の括りを開いた先（[x] ≅ x）で書いた `,` の積なら、単位律の後に残る要素（綴りの木、2つ以上）。ほかは null。
// 輪の中（classifyDollar）でも同じ答えにするため、中身を丸ごと解かずに、resolveProduct と同じ読みを綴りの上で辿る（writtenElements）。輪の断り（F.cycleRefused）は、
// 持ち上げより前から解いている輪なら戻す（R103）。
// 2026-10-28 の片8 の確かめの直し：前は単位になりうる綴り（vanishedSeq）だけを `,` の辺の端で消し、長さ 0 と分かる流れ（`$[[]~ , v]`）・鎖の中ほどの単位
// （`$[five , i , 1]` の案内）・`,` のすぐ左の並びが参照の口に入る適用（R66 の `$[fl v , 2]`）を見ず、輪の中でだけ書いた積と読んだ（確かめの指摘、§5 Q78 (g) を閉じた）。
function writtenProductRow(core, ctx, liftStart = null) {
  const F = ctx.F;
  const before = F.cycleRefused;
  try {
    let c = core;
    for (;;) {
      if (!c || c.c !== "bracket" || c.rows.length !== 1) return null;
      const row = c.rows[0];
      const els = row && row.type !== "seq" && row.sym === "," ? writtenElements(row, ctx, liftStart) : [row];
      if (els.length >= 2) return els;
      const one = els.length === 1 ? els[0] : null;
      if (!one || one.type !== "seq" || one.terms.length !== 1) return null;
      const t = one.terms[0];
      if (t.type !== "atom" || t.pre.length || t.post.length || t.core.c !== "bracket") return null;
      c = t.core;
    }
  } finally {
    const after = F.cycleRefused;
    if (after !== before && after && (liftStart === null || after.cycleFrom < liftStart)) F.cycleRefused = before;
  }
}
// `,` の鎖 node を resolveProduct と同じく読んで、残る要素（綴りの木）の並び：単位（`_`・`!_`・恒等射の名前。R45・R61・R71）と長さ 0 と分かる流れ（`[]~`・`_~`・
// `e0~`。R84）は消え、片方が単位なら関数を含む並びも残り（`inc 5 , !_`）、`,` のすぐ左の並びが括りの関数の最後の括りに入れば `F … (x , R)` の適用で要素1つ（R66・R93）、
// ほかの関数を含む並びも1つの要素で残る（問4、2026-11-01。前は G3）。右の `,` の鎖は、resolveProduct が右辺を解き直すのと同じく、その所でもう一度読む。項の種類は classify で見て、
// 輪の中（liftStart がある）で持ち上げより前から解いている名前へ戻った項は値（R103 の仮の参照と同じ、中身の見えない A）と読む。
function writtenElements(node, ctx, liftStart) {
  if (!node || node.type === "seq" || node.sym !== ",") return [node];
  if (node.right === null) return [node]; // `[F,]`・`[* 2,]` は点なしで、積ではない
  const multi = (s) => !!s && s.type === "seq" && s.terms.length >= 2;
  const items = (s) => (multi(s) ? s.terms.map((t) => writtenItem(t, ctx, liftStart)) : null);
  const both = [node.left, node.right];
  const sides = both.map(items);
  const g3 = sides.map((it) => !!it && it.some((c) => c.cat !== "unit" && c.desc.k !== "A"));
  const j = g3.indexOf(true);
  if (j >= 0) {
    const o = 1 - j;
    if (!g3[o] && !multi(both[o]) && writtenUnit(both[o], ctx)) return [both[j]];
    if (j === 0 && productIntoRefPort(sides[0])) return [node];
  }
  const left = writtenUnit(node.left, ctx) ? [] : [node.left];
  const right = node.right.type !== "seq" && node.right.sym === "," ? writtenElements(node.right, ctx, liftStart) : writtenUnit(node.right, ctx) ? [] : [node.right];
  return [...left, ...right];
}
// 綴りの辺 side が `,` の単位か（R45・R61・R71：単位になりうる綴りだけを解いて見る、vanishedSeq と同じ。R84：長さ 0 と分かる流れ）。輪に当たったら単位ではない。
function writtenUnit(side, ctx) {
  if (mayBeUnit(side)) {
    try {
      if (isUnitOperand(resolveTree(side, ctx))) return true;
    } catch (e) {
      if (!(e instanceof OperationError)) throw e;
    }
  }
  return !!side && side.type === "seq" && side.terms.length === 1 && emptyStreamTerm(side.terms[0], ctx);
}
// 並びの項 t の葉（classifyItems と同じ）。輪の中で持ち上げより前から解いている名前へ戻ったら、値の葉（中身の見えない A）。
function writtenItem(t, ctx, liftStart) {
  try {
    return emptyMark(leafOf(t, classify(t, ctx)));
  } catch (e) {
    if (liftStart === null || !(e instanceof OperationError) || e.reason !== "name-cycle" || !(e.cycleFrom < liftStart) || e.liftRing) throw e;
    return { t: "leaf", term: t, cat: "plain", desc: A(), kind: A(), view: { v: "atom", text: writeTerm(t) }, isLambdaName: false, isQBracket: false, count: null, strCount: null };
  }
}

// R101 の断り（G20）：書いた `,` の積を持ち上げた。言い分で、要素ごとに持ち上げる綴り（`[$v , 1]`・`[$inc , $double]`）を案内する。els は単位律の後に残る要素
// （writtenProductRow。綴りの見えない所は null で、利用者の例の綴りを案内する）。
// 2026-10-28 の片8 の確かめの直し：案内した綴りがそれ自体断られないように、要素の書いた積（`$[(five , 1) , 2]` の `(five , 1)`）は要素ごとに持ち上げた括り
// （`[[$five , 1] , 2]`）、後置の印の付いた要素（`vs~`。`$vs~` は R57）と `$` の項はそのまま、単位律で消えた要素（`$[five , i , 1]` の i）は書かない。
// 前は名前と括りに一律で `$` を付け、`[$[five , 1] , 2]`・`[$five , $[vs~]]`・`[$five , $i , 1]` を案内した（確かめの指摘）。
function productAdvice(els, ctx) {
  return els.map((e) => {
    const one = e && e.type === "seq" && e.terms.length === 1 && e.terms[0].type === "atom" ? e.terms[0] : null;
    if (one && !one.pre.length && !one.post.length) {
      if (one.core.c === "lit") return writeTerm(one);
      if (one.core.c === "bracket") {
        let inner = null;
        try {
          inner = writtenProductRow(one.core, ctx);
        } catch (err) {
          if (!(err instanceof OperationError)) throw err;
        }
        if (inner) return `[${productAdvice(inner, ctx).join(" , ")}]`;
      }
      if (one.core.c === "name" || one.core.c === "bracket") return `$${writeTerm(one)}`;
    }
    if (one && (one.post.length || one.pre[0] === "$")) return writeTerm(one);
    return `$[${writeTree(e)}]`;
  });
}
function refuseDollarProduct(term, els, ctx) {
  const text = writeTerm(term);
  const advice = els && els.length >= 2 ? `\`[${productAdvice(els, ctx).join(" , ")}]\`` : "`[$v , 1]`";
  return gate(
    "G20",
    `\`${text}\` の \`$\` の先は、書いた \`,\` の積です（単位律の後にも \`,\` が残ります）。\`$\` は持ち上げで、積の外に付けると、どの要素を持ち上げるつもりか読めません。要素ごとに持ち上げるなら、持ち上げたい要素にだけ \`$\` を付けて ${advice} と書きます（字面の要素は \`$\` を付けずにそのまま）。積を名前に置いて \`$名前\` と書けば、名前の先の値の持ち上げで警告です（§4 R101・R100）。`
  );
}

// 並び全体を受ける恒等射の fn（R29。穴 `!_` 1つ・`i : !_`・局所の `h : !_`・`[i , !_]` の中身）。`$` で物にした所では、指す関数を1引数の恒等射
// `[x ? x]`（ID1_FN）にする（§5 Q56 の答え、2026-10-25）。2026-10-25 の R54〜R57 の片では、ここで印を付けなかった（isHeldIdentity）。
function isRowIdentity(fn) {
  return !!fn && fn.type === "id";
}

// `$` の先が名前1つか、名前1つを1行で括った物（`[sq]`・`[[sq]]`・`(sq)`）なら、その名前。[x] ≅ x なので `$[N]` は `$N` と同じ先を見る
// （2026-10-25 の R54 から。括りの中を解いて引くと、局所の名前は lookup で未知になり、`$sq` は通るのに `$[sq]` は G20 と割れる。この片の作る途中に
// 見つけた）。1行が名前1つの括りには局所の名前が無い（`:` の行が無い）ので、括りの範囲も外と同じ。
function bracketedName(core) {
  if (core.c === "name") return core.name;
  if (core.c !== "bracket" || core.rows.length !== 1) return null;
  const row = core.rows[0];
  if (!row || row.type !== "seq" || row.terms.length !== 1) return null;
  const t = row.terms[0];
  return t.type === "atom" && !t.pre.length && !t.post.length && (t.core.c === "name" || t.core.c === "bracket") ? bracketedName(t.core) : null;
}
// 項 t が `$` の項（前置の印のいちばん外が `$`）でなければ t、`$` の項なら null（後置の印は内側の `$` の項の物。classifyLift の注）。
const dollarFree = (t) => (t && t.pre.length && t.pre[0] === "$" ? null : t);
// 括りの中身が1行で、その行が項1つで、その項（1行の括りを開いた先も）に後置の印（`~`・`!`・`@`）が付いていれば、その項（R57・R60）。ほかは null。
function postMarkedInside(core) {
  if (core.c !== "bracket" || core.rows.length !== 1) return null;
  const row = core.rows[0];
  if (!row || row.type !== "seq" || row.terms.length !== 1) return null;
  const t = row.terms[0];
  if (t.type !== "atom") return null;
  if (t.post.length) return t;
  return !t.pre.length && t.core.c === "bracket" ? postMarkedInside(t.core) : null;
}

// `$_` が指す関数（R56）：`[x ? _]` の零射。口は1つで、何を受けても本体は書いた `_`（印＝値、本体の根は A。`[x ? _] 5` は A）。
// 出どころ（idKey）は綴りの無い定数で、書いた `$[x ? _]` とは実体の鍵が別になる（答えの木は同じ。法則18）。
const ZERO_FN = { type: "plain", origin: "plain", n: 1, getBodyRoot: () => "A", idKey: "零射[x ? _]" };
// `$!_`（と恒等射の別名の `$i`）が指す関数（§5 Q56 の答え、2026-10-25）：1引数の恒等射 `[x ? x]`。口は1つで、本体は受けた裸の仮引数（素の関数の
// 裸の仮引数は A、本体の根は A。書いた `[x ? x]` と同じ）。出どころ（idKey）は綴りの無い定数で、書いた `$[x ? x]` とは実体の鍵が別になる（答えの
// 木は同じ。法則18）。
const ID1_FN = { type: "plain", origin: "plain", n: 1, getBodyRoot: () => "A", idKey: "恒等射[x ? x]" };

// 解いた木が、書いた `_` を指すか（R56）：書いた `_` の葉（印）、それを1行で括った物（`[_]`・`[[_]]`。中の行が `_` に縮む `[_ _]`・`[_ , !_]` も）、
// 書いた `_` を右辺に持つファイルの値の定義（F.unitDefs、nameKindOf が置く）。
// 2026-10-28 の片9b から、取り込みの無い範囲の未定義の名前も `_` を指す（R111）。`x : _` は R113 で書かなかったことと同じなので、その x も未定義の名前として指す。
// 括りの中の名前（`[w : w ⏎ $w]`）は今のまま辿らない（"local-field"）。2026-10-26 の R80 から寄せ1（R128）までは、関数の本体の局所の名前も右辺で辿っていた
// （localInfo の unit）。本体の行は何も定義しないので、本体の行の左の名前は仮引数・ファイルの定義・未定義の名前として指す。
function pointsToMark(t, ctx) {
  if (isMark(t)) return true;
  if (t && t.t === "leaf" && isLiftTerm(t.term)) return !!t.view && Array.isArray(t.view.inner) && t.view.inner.length === 1 && pointsToMark(t.view.inner[0], ctx); // `~_` は `[_]`（R79）
  if (!t || t.t !== "leaf" || !t.term || t.term.type !== "atom" || t.term.pre.length || t.term.post.length) return false;
  const c = t.term.core;
  if (c.c === "bracket") return !!t.view && Array.isArray(t.view.inner) && t.view.inner.length === 1 && pointsToMark(t.view.inner[0], ctx);
  if (c.c !== "name") return false;
  for (let s = ctx.scope; s; s = s.parent) {
    if ((s.descs && s.descs.has(c.name)) || (s.params && s.params.has(c.name)) || (s.locals && s.locals.has(c.name))) return false;
  }
  const def = ctx.F.defs.get(c.name);
  // 2026-10-28 の片9b（R111）：取り込みの無い範囲の未定義の名前も `_` を指す（lookup の注。書かなかったことにした `x : _` の x も、R113）。前は未定義の名前は指さず、
  // `v : no` の `$v` が値を読む参照で、`v : un` の `$v`（零射の番地）と割れていた。
  if (!def) {
    for (let s = ctx.scope; s; s = s.parent) if (s.hasImport) return false;
    return true;
  }
  return !def.lambda && !!ctx.F.unitDefs.get(def);
}

// `$名前` の先（R53・R54・R55）。返す物は {kind, where, unit}。kind は名前の種類（lookup と同じ順に探す）、where は G20 の言い分のための出どころ、
// unit は書いた `_` を指す名前か（R56）。
// - 仮引数・実体の中で渡された物：今の desc（素の関数の裸の仮引数は A、括りの関数の実体では渡された物の生まれ、R24）。
// - 括りと構造体のブロックの行の名前（`:` の左の名前）：未知で G20（"local-field"。R54：括りは器で、その行は欄かもしれず、局所の定義と読むかは決まっていない、§5 Q10）。
// - ファイルの定義：nameKindOf（`?` なら L、ほかは右辺を解いた種類。値を含む輪は name-cycle、R53）。
// - 取り込みのある範囲の未定義の名前は未知（このファイルから中身が見えない）、未定義の名前は `_`（2026-10-28 の片9b の R111。`$no` は `$_` と同じ零射の番地、
//   information を出す。前は R21 の値で、R60 の値を読む参照）。
// 関数の本体の行は見ない（寄せ1 の R128：本体の字下げの `:` の行は枝で、何も定義しない。細目7）。前（R54・R80）は、本体の局所の定義の右辺で読み（localTarget）、
// 本体の行が仮引数かファイルの定義の名前を左に置けば隠しの G20（"local-shadow"）にしていた。`tt : x ?` ⏎ `\tinc : z ? z * z` ⏎ `\t$inc` の `$inc` はファイルの inc。
function dollarNameTarget(name, ctx) {
  let imported = false;
  for (let s = ctx.scope; s; s = s.parent) {
    if (s.descs && s.descs.has(name)) {
      // 括りの関数の実体で渡された、形の見えない値（`h : [s] ? $s` ⏎ `h [s : _]` の s・`[x ~xs]` で受けた `[un 5]` の要素・値を受けた裸の仮引数）：渡された
      // 物が書いた `_` なら R56 の零射の番地、ほかの値なら値を読む参照で、desc からはどちらか言い切れない（R56 の R の所が「断る側への割れ」として G20 に
      // 残していた形。R60 の片で値を読む参照として通り、`rd1 $s 0` の実体が `(construct @f 1)` で、同じ `_` の `rd1 $_ 0` の `(apply @f 1)` と割れていた。
      // 2026-10-25 の確かめの指摘、§5 Q64）。形の見える値（`{s:N}`・`[N…]`）と番地・参照は今のまま通す。
      // 2026-10-26 の R63（§5 Q64 の答え）：渡された物が書いた `_` と分かっていれば（印 zero：欄の `[s : _]`・`[s : un]`・`[s : [_]]`、要素が全部 `_` の
      // List、`_` を指す名前を受けた裸の仮引数）、`$_` と同じ零射 `$[x ? _]` の番地（`@f 1` は零射を当てた `_` で、`_ 1` の並びではない）。印の無い形の
      // 見えない値は、今のまま `_` か言い切れない（G20）。番地の算術で作った点・差（R62）は `_` でないので、値を読む参照で通る。
      const d = s.descs.get(name);
      if (zeroOf(d)) return { kind: d, unit: true };
      if (isInstOpaque(d)) return { kind: U(), where: "inst-opaque", opaque: d }; // 2026-10-27 の片8 から持ち上げた番地で通して警告（classifyLift）
      return { kind: d };
    }
    if (s.params && s.params.has(name)) return { kind: s.params.get(name) === "bare" ? A() : U() };
    if (s.locals && s.locals.has(name)) return { kind: U(), where: "local-field" };
    if (s.hasImport) imported = true;
  }
  const def = ctx.F.defs.get(name);
  if (def) {
    const self = def.lambda ? null : selfReaderTarget(ctx.F, def);
    if (self) return self;
    const kind = nameKindOf(ctx.F, def);
    return { kind, unit: !def.lambda && !!ctx.F.unitDefs.get(def), dead: deadOfDef(ctx.F, def) };
  }
  if (imported) return { kind: U(), where: "imported" };
  reportUndefined(name, ctx);
  // 2026-10-28 の片9b（R111）：未定義の名前の `$no` は `$un` と同じ零射の番地（R56）。前は R60 の値を読む参照で、R100 の警告（dollar-non-function）を出していた。
  return { kind: zeroDesc(), unit: true };
}

// ---- `$v` の輪（R73、2026-10-26。§5 Q60 の答え） ----
//
// 値の定義 v の種類を引いたら、値を含む輪（§5 Q30 の name-cycle）が、この `$v` の所を通って閉じた（輪のいちばん下の枠が、`$v` を解き始める前から解いている
// 途中）。Reader（`$`）は v をその場で評価しない（v は自分を読む参照を含む値）ので、この辺は種類の輪ではない：v の種類を引かずに、v を読む参照（A、印 vref）と
// して通す。指す値の形は v を解き終えるまで分からないので、中身の見えない A（印 selfOf に、輪のいちばん下の枠と v を持つ）。引いた途中で積んだ枠は、
// 例外で抜けた枠として閉じる（abortFrame）。作った言い分（F.cycleRefused）は引く前に戻す（namesPattern の既定値の輪と同じ作り）。
// 境目（§5 Q30 との）：
// - 輪がこの `$v` の所を通らない（輪のいちばん下の枠が、`$v` を引いてから積んだ物）なら、`$` の外の本物の輪なので、今までどおり name-cycle。同じ輪に `$` の無い
//   v も書いてあれば（`f : x ? x , $v , v`）、その v の所で name-cycle。
// - 輪の中で、その参照を `@` で開いた（v の値を読んだ）なら、v の値が自分に依るので name-cycle（`v : f 1`・`f : x ? @[$v]`。pointedDesc の selfOf）。
// - v を解き終えた種類が、値を読む参照の読み（`$v` は値の Reader）と合わなければ（v が関数・未知・撒いた形・余る関数を持つ・書いた `_`）、仮に置いた参照の読みが
//   外れたので、引いた所で出た name-cycle で断る（resolve の最後、selfReaderHolds）。合えば、木を残す段で `$v` はふつうに v の種類を引く（そのときには v は
//   解き終えている）ので、木と形の綴りは輪の無い `$v` と同じ。
// 根拠：主の Claude の傾き「Q60 | `$v` の輪（`v : f 1`・`f : x ? x , $v`） | 通す。Reader は v をその場で評価しない」に U〔答え〕[2026-10-25 21:56 c8ccdd69]「他は全部、
// 君の傾き通り。」。前（R53 の片から）は、`$v` が v の種類を引くので輪に数え、どの並べ方でも name-cycle だった。
// 2026-10-28 の片8 の確かめの直し（R103）：輪の定義から定義の時に下ろす所が見えれば、ここでも通さずに name-cycle（liftRingLowering。classifyDollar の握りつぶしと
// 同じ）。前は下ろす所で仮の参照を見るだけで、関数の返値を通ると印が落ちるので、`f8 : x ? $v` ⏎ `v : 1 , @(f8 1)` が HEAD から黙って通った（確かめの指摘）。
function selfReaderTarget(F, def) {
  const start = F.stack.length;
  const before = F.cycleRefused;
  try {
    nameKindOf(F, def);
    return null;
  } catch (e) {
    if (!(e instanceof OperationError) || e.reason !== "name-cycle" || !(e.cycleFrom < start) || e.liftRing) throw e;
    const defs = ringDefsOf(F, e);
    const site = liftRingLowering(F, defs);
    if (site) throw liftRingRefusal(F, e, site);
    F.cycleRefused = before;
    // 見直しの所（resolve の最後）は v ごとに1つ。v の右辺が断られると、v を引くたびに解き直して同じ `$v` に来るので、足すのは初めの1回だけ（確かめ 2026-10-26：
    // 足し続けると、最後の見直しのループが足した所を歩き続け、`v : $v + 1` でプロセスがヒープを使い切って落ちた）。
    if (!F.selfReaders.some((r) => r.def === def)) F.selfReaders.push({ def, error: e });
    return { kind: { k: "A", selfOf: { def, frame: F.stack[e.cycleFrom], error: e, defs } }, self: true };
  }
}
// 値を読む参照が指す値を `@` で開く（R60）。`$v` の輪で仮に通した参照（R73、印 selfOf）を、輪のいちばん下の枠がまだ解いている途中に開いたら、v の値が
// 自分に依るので、その輪の name-cycle で断る（§5 Q30 の境目）。解き終えた後に開いたら、指す値は中身の見えない A（v は自分を読む参照を含む値で、形を
// 中に書くと形が限りなく深くなる）。
// 2026-10-28 の片8 の確かめの直し：仮の参照は名前の束縛に固まる（`w : $[v + 1]` を先に解くと、w の枠が輪のいちばん下で、v を後で解き直すときには閉じている）ので、
// 輪のいちばん下の枠が閉じた後でも、輪の値の定義（selfOf.defs）のどれかを解いている途中に開いたら、同じく name-cycle（前は枠だけを見て、`v : 1 , @w` が並べ方で
// 割れた）。関数の返値を通ると印が落ちる所は、ここでは拾えないので、仮の参照を作る前に綴りで断る（liftRingLowering）。
function openSelfReader(target, ctx) {
  if (!target || !target.selfOf) return target;
  const F = ctx.F;
  const s = target.selfOf;
  if (F.stack.includes(s.frame)) {
    // 言い分は、`$v` を引いた所で見つけた輪の物（輪の道筋に v が入っている。いまの枠の並びには、例外で抜けた v の枠が無いことがある）。
    if (!F.cycleRefused || (F.cycleRefused.suspect && !s.error.suspect)) F.cycleRefused = s.error;
    throw s.error;
  }
  if (s.defs) {
    const i = F.stack.findIndex((f) => f.isValue && s.defs.has(f.key));
    if (i >= 0) throw cycleError(F, i);
  }
  return A();
}
// 輪の値の定義（R103）：輪を作った所の枠の並び（cycleError の cycleDefs）と、いま積まれている輪のいちばん下から上の値の定義の枠。
function ringDefsOf(F, e) {
  const defs = new Set(e.cycleDefs || []);
  if (typeof e.cycleFrom === "number") for (const f of F.stack.slice(e.cycleFrom)) if (f.isValue && f.key) defs.add(f.key);
  return defs;
}
// R103（2026-10-28 の片8 の確かめの直し）：輪の値の定義 defs の右辺から、定義の時に輪の持ち上げを下ろしうる所（持ち上げの外の前置 `@`・中置の `'`・`@`）が見えるか。
// 名前はファイルの定義を辿り（値なら右辺、`?` なら仮引数の並びと本体）、`$` の付いた項の中（持ち上げの中身、`$名前` の先）は定義の時に評価しないので見ない。見えた所
// {text, def, root} か null。書いた綴りだけで決める（どの並べ方で輪に入っても同じ答え）。
// 輪の中で持ち上げた物は、名前・括り・仮引数を通るなら仮の参照の印で運べる（openSelfReader）が、関数の返値を通ると落ちる（実体の根は中身の見えない A）ので、
// 下ろす所で仮の参照を見るだけでは足りない。下ろす物が輪の持ち上げを運びうるかを綴りで見て、運びうれば断る側に倒す（§5 Q78 (h)）。
// 輪の持ち上げを運びうる所だけを見る（書いた綴りで決める、どれも断る側に倒した近似）：
// - 輪へ届く定義（reach）：輪の値の定義と、右辺・本体のどこか（持ち上げの中も）に輪へ届く定義の名前がある定義（不動点まで）。輪へ届かない定義の値は輪に依らない。
// - 運びうる式（carries）：輪へ届く定義の名前か、関数の本体の中の仮引数・局所の名前（何を受けたか書いた所で分からない）がある式。関数の本体の外のファイルの定義でない
//   名前は未定義の名前で値（R21）なので運ばない。運ばない式は、その中も、そこから呼ぶ関数の本体も見ない（呼ぶ関数は輪へ届かず、渡す物も運ばないので）。
// - 下ろす所は、下ろす物（前置 `@` の核・中置の左）が運びうる式のときだけ数える（`v : 1 , $v , (vs ' 0)` の `vs ' 0` は輪の持ち上げを下ろさない）。
// - 関数の本体の外で、下ろす物が印で運べる式（tracked：名前・`$` の項・字面・それを1行で括った物・それどうしの `,` で、名前は右辺も同じく印で運べる値の定義）なら
//   数えない：仮の参照の印が名前・括りに運ばれるので、下ろす所で openSelfReader が見る（輪の物を下ろせば name-cycle、ほかを下ろせば通る。`w : 1 , $v` ⏎
//   `v : 1 , (w ' 0)` は 1 を引くだけで、HEAD と同じく通る）。関数の適用を通る式・中置で引いた要素（`(w ' 1) ' 0`。印が要素まで運ばれない）と、関数の本体の中の
//   下ろす所は数える。
function liftRingLowering(F, defs) {
  const reach = new Set(defs);
  const namesOf = new Map();
  // 縛られていない名前だけを辿る（2026-11-04 の寄せ3、R133：仮引数はファイルの定義と同じ綴りでも仮引数で、その定義へは届かない。前は仮引数の名前も数え、
  // `h : v ? v , 5` が輪の値の定義 v へ届くと読んで偽の輪で断った）。
  const names = (def) => {
    if (!namesOf.has(def)) {
      const s = new Set();
      forEachFreeNameInTree(def.lambda || def.rhs, (n) => s.add(n));
      namesOf.set(def, s);
    }
    return namesOf.get(def);
  };
  for (let grew = true; grew; ) {
    grew = false;
    for (const def of F.defs.values()) {
      if (reach.has(def)) continue;
      for (const n of names(def)) {
        const d = F.defs.get(n);
        if (d && reach.has(d)) {
          reach.add(def);
          grew = true;
          break;
        }
      }
    }
  }
  // 関数の本体の中で `:` の左に書いた名前（欄と枝の条件）。ファイルの定義と同じ綴りでも、関数の本体の中では運びうる側に数える。寄せ1（R128）から本体の `:` の行は
  // 何も定義しない（その名前はファイルの定義を指す）ので、ここは断る側に倒した近似のまま残した（前は局所の定義の名前を数えていた、R80）。
  const colonNames = (tree) => {
    const s = new Set();
    const vt = (x) => {
      if (!x) return;
      if (x.type === "seq") return x.terms.forEach(vm);
      if (x.type === "atom" || x.type === "infix") return vm(x);
      if (x.sym === ":") {
        const n = singleBareName(x.left);
        if (n) s.add(n);
      }
      vt(x.left);
      vt(x.right);
    };
    const vm = (x) => {
      if (!x) return;
      if (x.type === "infix") {
        vm(x.left);
        vm(x.right);
      } else if (x.type !== "atom") vt(x);
      else if (x.core.rows) x.core.rows.forEach(vt);
    };
    vt(tree);
    return s;
  };
  // 関数 op の中の木と、そこで運びうる側に数える名前（R133 の範囲、lambdaScopes）：本体は外の ll・op の中の `:` の左・全部の仮引数、既定値の行の右は外の ll・
  // その右の中の `:` の左・前の仮引数まで。前（寄せ3 の前）は仮引数を数えず、ファイルの定義と同じ綴りの仮引数（`g9 : [inc] ? inc ' 0` の inc）を輪へ届かない
  // ファイルの定義と読んで、下ろす所を見落とした（黙った通り）。
  const lambdaParts = (op, ll) => {
    const body = new Set([...(ll || []), ...colonNames(op), ...parseParams(op.left).names.map((p) => p.name)]);
    return lambdaScopes(op).map((part) => [part.tree, part.body ? body : new Set([...(ll || []), ...colonNames(part.tree), ...part.bound])]);
  };
  // ll：関数の本体の外なら null、中ならその本体の局所の名前の集まり。
  const carries = (t, ll) => {
    let r = false;
    const vt = (x, l) => {
      if (!x || r) return;
      if (x.type === "seq") return x.terms.forEach((u) => vm(u, l));
      if (x.type === "atom" || x.type === "infix") return vm(x, l);
      if (x.sym === "?") {
        // 仮引数は何を受けたか書いた所で分からないので運びうる側：仮引数のある関数は運びうる式（前は `?` の左の名前を本体と同じ集まりで見て、ファイルの定義と
        // 同じ綴りの仮引数だけを外していた）。
        if (parseParams(x.left).names.length) return void (r = true);
        for (const [y, s] of lambdaParts(x, l)) vt(y, s);
        return;
      }
      vt(x.left, l);
      vt(x.right, l);
    };
    const vm = (x, l) => {
      if (!x || r) return;
      if (x.type === "infix") {
        vm(x.left, l);
        vm(x.right, l);
        return;
      }
      if (x.type !== "atom") return vt(x, l);
      if (x.core.c === "name") {
        const d = F.defs.get(x.core.name);
        if (l && (l.has(x.core.name) || !d)) r = true;
        else if (d && reach.has(d)) r = true;
      } else if (x.core.rows) x.core.rows.forEach((row) => vt(row, l));
    };
    vt(t, ll);
    return r;
  };
  // 関数の本体の中の下ろしは、下ろす物が印で運べる式でも数える：仮引数に印の付いた実引数が来て実体ができても、実体は鍵で分け合われ、輪の外で同じ鍵の実体を先に
  // 作っていると本体を読み直さない（`x1 : g9 $u` ⏎ `v : 1 , (g9 $v)` で u が形の見えない値なら鍵が同じで、並べ方で黙って通った。HEAD から）。
  const trackedMemo = new Map();
  const trackedTree = (x) => {
    if (!x) return false;
    if (x.type === "seq") return x.terms.length === 1 && trackedTerm(x.terms[0]);
    if (x.type === "atom" || x.type === "infix") return trackedTerm(x);
    return x.sym === "," && x.right !== null && trackedTree(x.left) && trackedTree(x.right);
  };
  const trackedTerm = (t) => {
    if (!t) return false;
    if (t.type !== "atom" || t.post.length) return false; // 中置で引いた要素は、仮の参照の印が要素まで運ばれないので運べない側
    if (t.pre.length) return t.pre.every((p) => p === "$"); // 持ち上げそのもの（`$x`・`$[…]`・`$$x`）
    if (t.core.c === "lit" || t.core.c === "unit") return true;
    if (t.core.c === "bracket") return t.core.rows.length === 1 && trackedTree(t.core.rows[0]);
    if (t.core.c !== "name") return false;
    const d = F.defs.get(t.core.name);
    if (!d) return true; // 関数の本体の外の未定義の名前は値（R21）
    if (d.lambda) return false;
    if (trackedMemo.has(d)) return trackedMemo.get(d);
    trackedMemo.set(d, false); // 名前の輪は運べない側（断る側）に倒す
    const r = trackedTree(d.rhs);
    trackedMemo.set(d, r);
    return r;
  };
  const counts = (operand, ll) => carries(operand, ll) && !(ll === null && trackedTerm(operand));
  const seen = new Set();
  let found = null;
  let at = null;
  let root = null;
  const visitDef = (def) => {
    if (!def || seen.has(def) || found) return;
    if (!def.lambda && !reach.has(def)) return; // 輪へ届かない値の定義の値は、輪に依らない
    seen.add(def);
    const prev = at;
    at = def;
    visitTree(def.lambda || def.rhs, null);
    at = prev;
  };
  const visitTree = (t, ll) => {
    if (!t || found || !carries(t, ll)) return;
    if (t.type === "seq") t.terms.forEach((u) => visitTerm(u, ll));
    else if (t.type === "atom" || t.type === "infix") visitTerm(t, ll);
    else if (t.sym === "?") {
      // 仮引数の名前（`?` の左）は辿らない（仮引数で、同じ綴りのファイルの定義ではない。R133）。既定値の行の右と本体を、それぞれの範囲で見る。
      for (const [y, s] of lambdaParts(t, ll)) visitTree(y, s);
    } else {
      visitTree(t.left, ll);
      visitTree(t.right, ll);
    }
  };
  const visitTerm = (t, ll) => {
    if (!t || found) return;
    if (t.type === "infix") {
      if ((t.sym === "'" || t.sym === "@") && counts(t.left, ll)) {
        found = { text: writeTerm(t), def: at, root };
        return;
      }
      visitTerm(t.left, ll);
      visitTerm(t.right, ll);
      return;
    }
    if (t.type !== "atom") return visitTree(t, ll);
    // 前置の印は核に近い物から結ぶ（R57）ので、`$` より外の印は持ち上げた物に当たり、`$` より内は持ち上げの中身。
    const k = t.pre.indexOf("$");
    if ((k < 0 ? t.pre : t.pre.slice(0, k)).includes("@") && counts({ ...t, pre: t.pre.slice(t.pre.indexOf("@") + 1), post: [] }, ll)) {
      found = { text: writeTerm(t), def: at, root };
      return;
    }
    if (k >= 0) return;
    if (t.core.c === "name") {
      if (!(ll && ll.has(t.core.name))) visitDef(F.defs.get(t.core.name));
    } else if (t.core.rows) t.core.rows.forEach((row) => visitTree(row, ll));
  };
  for (const def of defs) {
    root = def;
    visitDef(def);
  }
  return found;
}
// R103 の断り：持ち上げを通る輪で、輪の定義から定義の時に下ろす所が見える（liftRingLowering）。輪の言い分 e に、見えた所を足した name-cycle。
function liftRingRefusal(F, e, site) {
  const where = site.def === site.root ? `輪の定義 \`${site.root.name}\` に` : `輪の定義 \`${site.root.name}\` から名前で辿った \`${site.def.name}\` に`;
  const r = nameError(
    "name-cycle",
    `${e.message}輪は持ち上げ（\`$\`）を通りますが、${where}、定義の時に下ろす所 \`${site.text}\`（持ち上げの外の \`@\`・\`' i\`）があり、下ろす物が輪の持ち上げを運びうる（輪へ届く定義の名前か、関数の本体の中の仮引数・局所の名前を含む）ので、下ろす所を通る輪と同じく断ります（§4 R103）。持ち上げた物の印は関数の返値を通ると落ちるので、運びうるかは書いた綴りで見て断る側に倒しています（§5 Q78 (h)）。`
  );
  r.cycle = e.cycle;
  r.cycleFrom = e.cycleFrom;
  r.cycleDefs = e.cycleDefs;
  r.suspect = e.suspect;
  r.liftRing = true;
  if (!F.cycleRefused || F.cycleRefused === e || (F.cycleRefused.suspect && !r.suspect)) F.cycleRefused = r;
  return r;
}
// 仮に値を読む参照として通した `$v`（R73）の v が、解き終えた種類で値を読む参照の読みと合うか（classifyDollar の名前の先の読みで vref になるか）。
// 答えは true（合う）・false（合わない：v が関数・未知など、仮に置いた読みが外れた）・"gate"（v を解き直すと輪の外の門で断られる：v の右辺そのものが
// 断られる形で、`$v` を輪の外の値の `$u` に替えても同じ門に当たる。resolve の最後は、その門の行の断りを言う。確かめ 2026-10-26、法則25）。
function selfReaderHolds(F, def) {
  try {
    const ctx = { F, scope: F.fileScope, diag: null };
    const t = dollarNameTarget(def.name, ctx);
    if (t.self) return false;
    // 2026-10-27 の片8（R103）：持ち上げは中身を評価しないので、v を解き終えた種類が値でなくても（関数・未知・書いた `_`・形の見えない値）、持ち上げだけを通る
    // 輪は通す。木を残す段で `$v` を v の種類でふつうに読み直す（関数なら指す関数の印、値なら値を読む参照で R100 の警告、`_` なら零射の番地）。`$v` そのものが断ら
    // れる形（中で余る関数 R59・撒いた形 R57）は、その門の行の断り。前（R73）は値を読む参照の読みと合う v（値）だけを通し、ほかは name-cycle だった。
    if (t.dead || (t.kind && t.kind.k === "A" && t.kind.spread)) return "gate";
    return true;
  } catch (e) {
    if (!(e instanceof OperationError)) throw e;
    return e.reason === "name-cycle" ? false : "gate";
  }
}
// 段18 の中置（`'`・`@`）の左が、`$v` の輪で仮に通した参照（R73）。2026-10-26 の確かめの直しの時は、`'` で引く・`@` で引く形が参照の先を読むかが決まって
// いなかった（`$vs ' 0` は未知）ので、輪の中では断る側に倒した。2026-10-27 の片8 の R102 から `$x ' 0` は x で、`' i` は下ろす所（R99）なので、輪の中で下ろせば
// `@[$v]` と同じ name-cycle（openSelfReader）。ノルム（`||$v||`）は数えるだけで先を読まない（`||$_||` は 1、R56）ので当てない。
function pickSelfReader(l, ctx) {
  if (l && l.cat === "plain" && vrefOf(l.desc)) openSelfReader(l.desc.vref, ctx);
}

// 括りの関数の実体で渡された、形の見えない値の desc（§5 Q64。`$` の先にすると G20）：形も番地・参照・点と差の印も、書いた `_` を指す印（R63）も無い A。
const isInstOpaque = (d) => !!d && d.k === "A" && !d.shape && !d.ref && !d.vref && !d.addr && !d.lift && !d.spread && !zeroOf(d) && !isEmptyBracket(d);
// 名前 name が、いちばん近い範囲で括りの関数の実体に渡された形の見えない値か（dollarNameTarget と同じ順に探す。仮引数・括りの欄の名前が先に見つかれば違う）。
// 2026-10-28 の片8 の確かめの直しから、そうならその desc（形の見えない値の中身に関数か未知が見えるか、classifyLift が見る）、違えば false。
function instOpaqueName(name, ctx) {
  for (let s = ctx.scope; s; s = s.parent) {
    if (s.descs && s.descs.has(name)) return isInstOpaque(s.descs.get(name)) ? s.descs.get(name) : false;
    if ((s.params && s.params.has(name)) || (s.locals && s.locals.has(name))) return false;
  }
  return false;
}

// ファイルの定義の右辺（値の定義）か本体（素の `?` の定義と、既定値のある `?` の定義）に、値の上に積まれて口が開いたまま閉じた関数（R52 の余った
// ラムダ。恒等射を除く）があれば、その木（R59、`$名前` が `$[右辺]` と同じ先を見るため。§5 Q62）。無ければ null。
// - 値の定義：nameKindOf が右辺を解くときに受け皿で拾い、F.deadDefs に置く。右辺が名前1つ（`p : q`・`p : [q]`）なら、その名前の物を引き継ぐ（[x] ≅ x、
//   `:` はメタ。右辺の名前は lookup で別の定義として解くので、受け皿には入らない）。
// - 素の `?` の定義：bodyRootOf が本体を解くときに拾い、F.deadBodies に置く（記録が古くなれば解き直すので、同じ答えになる）。
// - 既定値のある `?` の定義：本体の根を解く所が無いので、ここで本体を解いて拾う（門に当たれば、その定義の行が同じ門で断るので null）。
// - 括りの関数（R24）：本体は呼ばれるまで読まない（R25）。仮引数の名前を1つも含まない行だけは、どの実体でも同じに読むので読んで拾う
//   （deadInPatternBody。2026-10-25 の確かめの直し、§5 Q65）。
// 関数の定義の本体を覗くのは、解いている途中の種類が無い所（F.stack が空）だけ（2026-10-25 の確かめの直し）：`$` は名前の先を評価しないので、値の
// 定義の右辺を解いている途中に本体を覗くと、`p : $sq` ⏎ `sq : x ? use p x`（`$` で自分を指す表を持つ再帰）が、覗いた所を通る輪で name-cycle になった
// （R59 の片の書く人の版。HEAD は通す）。途中の所で覗かなくても、`$名前` の書かれた所は、どれも木を残す段（定義の行・行の根・実体の木、F.stack が空）で
// もう一度解かれるので、そこで同じ G20 に当たる（R33 の G16 を木を残す段で断るのと同じ作り）。G16 は片イ（R125）に廃止し、本体の根の裸の関数は `_` と bare-function-return の知らせになった（resolveBody）。
// 値の定義は、名前の種類を引くときに右辺を解く（R53 から、輪に数える）ので、右辺の余る関数はいつも拾う。右辺が単位律と [x] ≅ x で名前1つに縮むなら
// （`q : p`・`q : [p]`・`q : p , !_`・`q : _ , p`）、その名前の物を引き継ぐ（aliasDeadOfTree）。
function deadOfDef(F, def) {
  if (!def.lambda) {
    nameKindOf(F, def);
    const own = F.deadDefs.get(def);
    if (own) return own;
    if (F.deadBusy.has(def)) return null; // 別名の輪（`p : q` ⏎ `q : p` は name-cycle で、ここには来ない。守りだけ）
    F.deadBusy.add(def);
    try {
      return aliasDeadOfTree(F, F.defRoots.get(def), F.fileScope);
    } finally {
      F.deadBusy.delete(def);
    }
  }
  if (F.stack.length) return null;
  const op = def.lambda;
  if (def.pattern) {
    if (!F.deadBodies.has(op)) F.deadBodies.set(op, deadInPatternBody(F, op, F.fileScope));
    return F.deadBodies.get(op) || null;
  }
  if (def.plain) {
    bodyRootOf(F, op);
    return F.deadBodies.get(op) || null;
  }
  if (F.deadBusy.has(op)) return null; // 本体の中から自分を `$` で指した（本体を解き終えた外側が拾う）
  F.deadBusy.add(op);
  // 本体を解く間は枠を積む（実体を作っても、木の記録に入れない。deadInPatternBody と同じ）。
  const frame = pushFrame(F, { probe: op });
  try {
    const dead = [];
    const lam = makeLambda(op, { F, scope: F.fileScope });
    resolveBody(op.right, { F, scope: lam.scope, diag: null, dead });
    return dead[0] || null;
  } catch (e) {
    if (!isGate(e)) throw e;
    return null;
  } finally {
    abortFrame(F, frame);
    F.deadBusy.delete(op);
  }
}
// 解いた木 t が単位律（R44・R45・R61）と [x] ≅ x で縮んだ項（`p !_`・`!_ p`・`i p`・`[p]`・`(p)` は p。`,` の単位は resolveProduct が先に消す）。
function unitReduced(t) {
  for (;;) {
    if (!t) return t;
    // `,` の積の `(unit …)`（R123）では縮めない：`$[inc , 1]` を `$1` と読むか（R101 の単位律に R123 を重ねる）は `$` の片で決める。今のまま G20（R101）。
    const one = t.t === "construct" ? vanishedOne(t) : null;
    if (one) {
      t = one;
      continue;
    }
    if (t.t === "apply" && isIdentity(t.head) && t.arg && t.arg.t !== "construct") {
      t = t.arg;
      continue;
    }
    // 恒等射との合成（`p !_`・`!_ p`・`i p` で p が関数）：恒等射を消して1つだけ残れば、それ（単位律、R44）。
    if (t.t === "compose" && Array.isArray(t.items)) {
      const live = t.items.filter((x) => !isIdentity(x));
      if (live.length === 1 && live.length < t.items.length) {
        t = live[0];
        continue;
      }
    }
    if (t.t === "leaf" && t.term && t.term.type === "atom" && !t.term.pre.length && !t.term.post.length && t.term.core.c === "bracket" && t.view && Array.isArray(t.view.inner) && t.view.inner.length === 1) {
      t = t.view.inner[0];
      continue;
    }
    return t;
  }
}
// 解いた木 t が単位律と [x] ≅ x で名前1つ（`q`・`[q]`・`q , !_`・`_ , q`・`!_ q`）に縮み、その名前がファイルの定義を指すなら、その定義の deadOfDef
// （引き継ぎ、R59・§5 Q62）。範囲 s で仮引数・実体で渡された物・括りの欄の名前に当たれば null（仮引数は書いた物を持たない。括りの欄の名前を裸で書いた別名は
// R54 の G20）。前（R59 の片）は右辺の字面が名前1つのときだけ引き継ぎ、単位律で縮む綴りが通った（2026-10-25 の確かめの指摘）。
function aliasDeadOfTree(F, t, s) {
  const one = unitReduced(t);
  if (!one || one.t !== "leaf" || !one.term || one.term.type !== "atom" || one.term.pre.length || one.term.post.length || one.term.core.c !== "name") return null;
  const n = one.term.core.name;
  for (let q = s; q; q = q.parent) {
    if ((q.descs && q.descs.has(n)) || (q.params && q.params.has(n)) || (q.locals && q.locals.has(n))) return null;
  }
  const def = F.defs.get(n);
  return def ? deadOfDef(F, def) : null;
}
// 括りの関数の本体のうち、仮引数の名前を1つも含まない行（本体そのもの・括り・囲み・字下げのブロックの中の行・中置の辺）の余る関数（R59、2026-10-25 の
// 確かめの直し）。括りの関数の本体は呼ばれるまで読まない（R25）が、それは本体の読み（適用か構築か）が渡された物の生まれで決まる（R24）からで、
// 仮引数を含まない行の読みは渡された物に依らず、どの実体でも同じなので、`$` の先を見る所で読んでよい（`$[[x] ? f2 (5 inc) 1]` の `(5 inc)` は、どの x でも
// inc が 5 の上で余る）。仮引数を含む行（`$[[x] ? x inc]`）は今のまま読まない（x が関数なら合成、値なら余る。§5 Q65）。
// 読む間は枠を積んで、作った実体を木の記録に入れない（呼ばれない括りの関数の本体が呼ぶ物を、定義の行の木に描かない。外れた枠と同じに扱う）。
// 門と輪は握りつぶして（輪の言い分も戻す）、読めなかった行は拾わない。
function deadInPatternBody(F, op, scope) {
  const names = new Set();
  forEachParamNameInTree(op.left, (n) => names.add(n));
  // 入れ子の `?` が同じ綴りの仮引数で縛り直した名前は、この関数の仮引数を含まない（2026-11-04 の寄せ3、R133 の範囲。lambdaScopes）。前は入れ子の仮引数の名前も
  // 「含む」に数え、`g : [x] ? [x ? x (5 inc)] 1` の `$g` で余る inc（G20）が、内の x を別の名前にした形と割れて黙って消えた。
  const without = (b, own) => (own.some((n) => b.has(n)) ? new Set([...b].filter((n) => !own.includes(n))) : b);
  const mentions = (t, b = names) => {
    if (!t) return false;
    if (t.type === "seq") return t.terms.some((x) => termMentions(x, b));
    if (t.sym === "?") return lambdaScopes(t).some((part) => mentions(part.tree, without(b, part.bound)));
    return mentions(t.left, b) || mentions(t.right, b);
  };
  const termMentions = (term, b) => {
    if (!term) return false;
    if (term.type === "infix") return termMentions(term.left, b) || termMentions(term.right, b);
    if (term.core.c === "name") return b.has(term.core.name);
    return !!term.core.rows && term.core.rows.some((r) => mentions(r, b));
  };
  const rows = [];
  const visit = (t) => {
    if (!t) return;
    if (!mentions(t)) return void rows.push(t);
    if (t.type === "seq") t.terms.forEach(visitTerm);
    else if (t.sym !== "?") {
      visit(t.left);
      visit(t.right);
    }
  };
  const visitTerm = (term) => {
    if (!term) return;
    if (term.type === "infix") {
      visitTerm(term.left);
      visitTerm(term.right);
    } else if (term.core.rows) term.core.rows.forEach(visit);
  };
  visit(op.right);
  if (!rows.length) return null;
  const lam = makeLambda(op, { F, scope });
  const before = F.cycleRefused;
  for (const row of rows) {
    const dead = [];
    const frame = pushFrame(F, { probe: row });
    try {
      resolveTree(row, { F, scope: lam.scope, diag: null, dead });
    } catch (e) {
      if (!(e instanceof OperationError)) {
        abortFrame(F, frame);
        throw e;
      }
      F.cycleRefused = before;
    }
    abortFrame(F, frame);
    if (dead.length) return dead[0];
  }
  return null;
}

// ---- 関数の本体の局所の定義（R54・R80）は寄せ1（R128、2026-11-04）で外した ----
//
// 2026-10-25 の R54 と 2026-10-26 の R80 は、枝の無い関数の本体の、左が名前1つの `:` の行を局所の定義と読み、その名前を右辺の種類で読んでいた（localTarget・
// localInfo・localDefsOf ほか）。読めない所（入れ子の括りの中だけ・枝のある本体・外の名前を隠す行・同じ範囲に2つ・局所の `$` の輪・局所の関数の再帰・それを裸で
// 書いた別名）は G20・G7・name-cycle で断っていた（local-nested・local-branch・local-shadow・local-twice・local-cycle・local-recursion・local-alias）。
// R128（U〔答え〕[2026-10-29 12:18:19 32fe4b9c]「ガイドに戻す」、D function_guide.md:89-106）から、本体の字下げの `:` の行は左が何でも枝（match_case）で、本体に
// 局所の定義は無い（局所の値は仮引数のブロックの既定値へ、補助の関数はファイルの定義へ置く）。だから本体の行の左の名前は何も定義せず、使う所の名前は仮引数・
// ファイルの定義・未定義の名前（`_`、R111）としてふつうに引く。残るのは括りと構造体のブロックの行の名前（local-field、blockScope）だけ。

// `$x` の x が1つの Reader（関数か、値を読む参照）と言い切れない（R53・R54〜R57・R59・R60、G20）。kind は x の種類（後置の印の付いた項は null）、
// target.where は出どころ。先が名前1つなら、名前がなぜその種類かを添える（取り込みのある範囲の名前は未知、括りの欄の名前は R54 の言い切れない理由。
// 2026-10-24 の確かめの指摘：局所の名前を別の問いへ向けると開ける問いが違う）。2026-10-25 の R60 から、先が値なら通る（値を読む参照）ので、
// 値の先の言い分（「値です」・データの番地の綴りは §5 Q54）は無くなった。
// 2026-10-27 の片8（R99）から、`$` は必ず持ち上げで、先の種類では断らない（関数以外は R100 の警告）。ここに来るのは、後置の印と組んだ形（R57）・撒いた形を指す名前
// （R57、`:` はメタ）・中で余る関数（R59・R75）と、先の名前の読みが決まらない所（R54 の理由、§5 Q10・Q78）だけ。書いた `,` の積（R101）は refuseDollarProduct。
// 前の「先が値か未知」の言い分（未定義の名前・取り込みのある範囲の名前・形の見えない値・枝で選ぶ括り・括りの関数の実体で渡された形の見えない値）は無くなった。
function refuseDollar(term, kind, ctx, target = {}) {
  const text = writeTerm(term);
  const name = target.name || null;
  const where = target.where || null;
  const tail =
    "`$` は持ち上げで、先の種類では断りません（関数以外は警告、§4 R99・R100）。断るのは、後置の印と組んだ形（R57）・中で余る関数（R59・R75）・書いた `,` の積（R101）と、先の名前の読みが決まらない所（§5 Q10・Q78）です";
  if (where === "post") {
    const marked = target.inner ? writeTerm(target.inner) : null;
    const post = target.inner ? target.inner.post.join("") : term.post.join("");
    return gate(
      "G20",
      `\`${text}\` の \`$\` の先は後置の印 \`${post}\` の付いた形${marked ? `（括りの中の \`${marked}\`。[x] ≅ x で、括らずに \`$${marked}\` と書いたのと同じ先）` : ""}で、\`$\` と後置の印のどちらが先に結ぶ読みでも、持ち上げる物が1つに決まりません（撒いた形は並び、\`!\` は値の印（先に \`$\` が結べば、数でない番地に値の印を当てることになる）、\`@\` は取り込み）。${tail}（§4 R57・R99）。`
    );
  }
  if (where === "dead") {
    // 言い分の案内（R75、2026-10-26。§5 Q62 の答え）：関数を値として並べる・渡すなら、書く人が `$` を付けて表明する（U〔答え〕[2026-10-25 21:56 c8ccdd69]
    // 「Q62,65 incに$を付けるというアサーションをしてもいい。」）。前の言い分は「逆適用の廃止の後の書き癖」と書いていた（同じ答えの「逆適用の事はいい加減
    // 忘れて欲しい。」で外した）。
    return gate(
      "G20",
      `\`${text}\` の \`$\` の先${name ? `（名前 \`${name}\` の右辺か本体）` : "の中身"}に、値の上に積まれて口が開いたまま閉じた関数 \`${cutShape(show(target.dead))}\` があります（§4 R52）。中身は2つの関数を括った形で、余った方は黙って落ちるので、1つの関数と言い切れません。${asValueAdvice(target.dead)}${tail}（§4 R59・R75、§5 Q53 の答え${name ? "・Q62 の答え" : ""}）。`
    );
  }
  if (where === "spread") {
    return gate("G20", `\`${text}\` の \`$\` の先${name ? ` \`${name}\` ` : ""}は撒いた形（並び）で、\`:\` はメタなので \`$\` の項に後置の \`~\` を付けた形と同じく、持ち上げる物が1つに決まりません。${tail}（§4 R57・R99）。`);
  }
  // 先の名前の読みが決まらない所は、寄せ1（R128）から括りの欄の名前（local-field）だけ。関数の本体の局所の名前の理由（local-nested・local-branch・local-shadow・
  // local-twice・local-cycle・local-alias・local-recursion）は、本体の行が何も定義しなくなったので無くなった。
  const why =
    where === "local-field"
      ? `（\`${name}\` は括りか、関数の本体でない字下げのブロックの中の \`:\` の左の名前です。括りは器で、その行は欄かもしれず、局所の定義と読むかが決まっていません。§4 R54、§5 Q10）`
      : "";
  return gate("G20", `\`${text}\` の \`$\` の先の名前は、どの定義を指すか（局所の定義と読むか）が決まりません${why}。${tail}（§4 R54・R99、§5 Q10・Q78）。`);
}

// 余った関数を値として並べるつもりなら `$` を付ける、という案内（R75）。余ったのが書いた項1つ（印の無い名前・括り）なら `$inc`・`$[…]`、ほか（受けた後の
// 関数・合成）は書いた綴りが木に無いので、括って `$[…]` と書く道を言う。
function asValueAdvice(dead) {
  const one = dead && dead.t === "leaf" && dead.term && dead.term.type === "atom" && !dead.term.pre.length && !dead.term.post.length;
  const spelled = one ? `\`$\` を付けて \`$${writeTerm(dead.term)}\` と書きます` : "括って `$[…]` と書きます";
  return `その関数を値として並べる・渡すつもりなら、${spelled}（§4 R75）。`;
}

// ---- `$` で物にした括りの関数を呼んだ実体（R75、2026-10-26。§5 Q65 の答え） ----
//
// 括りの関数の本体は、呼ばれるまで読まない（R25）ので、仮引数に依って値の上に積まれて余る関数（`$[[x] ? x inc]` の inc：x が値なら余り、関数なら合成）は、
// `$` を書いた所では分からない（R59 が読むのは仮引数を含まない行だけ）。だから `$` で物にした括りの関数（関数を指す番地の印 ref。`@f` で開いた所）を呼んで
// 実体を作ったら、その実体の本体に値の上で余った関数（恒等射を除く）があるかを見て、あれば G20（`$` の先は、呼んだ形で1つの関数と言い切れない）。x が関数の
// 形で呼べば合成で余らないので通る（本体の根が裸の関数なら、今までどおり実体の G16）。片イ（R125）からは、実体の本体の根の裸の関数も G16 でなく `_` と bare-function-return の知らせ（materialize の resolveBody）。`$` を通さずに呼ぶ所（`bq 5`・`[[x] ? x inc] 5`）は今までどおり R52 の
// 知らせ（warning）：`$` の無い名前（`p : add (5 inc)` ⏎ `p 3`）が知らせで通るのと同じ線で、断るのは `$` で1つの関数と表明した所だけ。
// 根拠：主の Claude の傾き「Q65 | `$[[x] ? x inc]` | 呼んだ実体で余ったときだけ断る」と、答え U〔答え〕[2026-10-25 21:56 c8ccdd69]「Q62,65 incに$を付けるという
// アサーションをしてもいい。逆適用の事はいい加減忘れて欲しい。泣くぞｗ」。言い分で `$inc` と書く道を案内する（asValueAdvice）。前は本体を呼んだ所で R52 の知らせを
// 出して通していた（`map $[[x] ? x inc] vs` は warning だけ）。
// 開いた関数は、元の関数の写しに印 dollar を付け、実体を作る口（instantiate）を包む（部分適用は写しを元にするので、残りを当てた所でも同じに見る）。実体の鍵・
// 同一性は元の関数と同じ綴り（fnKey・identFn は中身で決まる）なので、実体は分け合い、答えの違いは呼んだ所の G20 だけ。
function dollarOpened(fn) {
  if (!fn || fn.type !== "pattern" || fn.dollar) return fn;
  if (fn.bound) {
    const base = dollarOpened(fn.base);
    return { ...fn, base, dollar: true, instantiate: (argDescs) => base.instantiate([...fn.bound, ...argDescs]) };
  }
  const w = { ...fn, dollar: true };
  w.instantiate = (argDescs) => {
    const r = fn.instantiate(argDescs);
    if (r.inst && r.inst.dead) {
      throw gate(
        "G20",
        `\`$\` で物にした括りの関数 \`${fn.label}\` を形 ${cutShape(r.inst.shapeText)} で呼んだ実体の本体に、値の上に積まれて口が開いたまま閉じた関数 \`${cutShape(show(r.inst.dead))}\` があります（§4 R52）。呼んだ形では、本体は2つの関数を括った形で、余った方は黙って落ちるので、\`$\` の先を1つの関数と言い切れません（§4 R59・R75、§5 Q65 の答え）。${asValueAdvice(r.inst.dead)}`
      );
    }
    return r;
  };
  return w;
}

// R60 の細かい所（§5 Q59）：`$` が作った物（関数を指す番地・値を読む参照。どちらも1つの Reader）が、値の演算子（算術・ビット・範囲の段12〜16・19〜22、
// 比較の段13 と段8 の `==`・`!==`）の被演算子にある。Reader は数ではないので、数として当てる読み（場所どうしの距離 `$foo - $bar` など、2026-09-30 の
// 番地の裁定）は決めずに断る。根拠：U [2026-10-25 07:48 533071da]「…AddressはAddress同士でしか計算は出来ないが、なるべくそういう処理が要らないように
// するために、参照渡しをspreadする仮引数の書き方を提供している。 / つまり、fooのアドレスやbarのアドレスが取れないと困る場面が具体化していないと、
// このQ54は本当に必要かどうか測れない。」。Reader を値の演算子に渡す形は、関数を値の演算子に渡す形（§5 Q22）と同じ門（G7）で断る。
// 前（R53〜R57）は、`$vs` が G20 で先に断り、関数の番地 `$inc + 1` は値（A）の演算として通っていた。
// 同じ日の確かめの直しから、中置の項のほかの綴りでも同じに断る（valueOperand）：区間の被演算子（`[+ $5]`）・値の演算子の点なしが受けた実引数
// （`[+ 1] $vs`・`[+] $vs 1`・`[-_] $vs`・`[* 2,] $vs`。argOperand）・絶対値の囲み（`|$vs|`。enclosureInfo）・値の印（`-p`・`!!p`・`p!`、p : $vs）・
// 素の関数の口（`inc $5`。readerAtPlain）。前は中置の項の所だけで、ほかの綴りは通った（確かめの指摘）。sym が null なら点なしが受けた所で、記号は書かない。
// 2026-10-26 の R62（§5 Q59 の答え）から、ここで断るのは関数を指す番地（`$inc`・`p : $inc` の p・`$inc` を受けた仮引数）だけ：1つの関数と言い切れる
// 番地を動かす・比べるのは R53 の外（R の印）。値を読む参照（`$vs`）は番地の点で、点と差の規則（addressOp）で読む。
// 2026-10-27 の片8：先の種類の分からない持ち上げ（印 lift）を値の演算子の被演算子に置いた。関数を指す番地なら G7（R62 の外）、値を読む参照なら番地の点で、
// どちらの規則で読むか決まらないので G21 で断る（§5 Q78）。
function refuseLiftOperand(sym, operand) {
  return gate(
    "G21",
    `\`${operand}\` は、\`$\` の先の種類が書いた所で分からない持ち上げ（関数の番地か、値の番地の点か決まらない）で、${sym === null ? "値の演算子の点なし" : `値の演算子 \`${sym}\` `}の被演算子にあります。関数の番地を動かす・比べる形は断り（G7）、値の番地は点と差の規則で読む（§4 R62）ので、どちらで読むか言い切れません（§4 R99・R100、§5 Q78）。`
  );
}
function refuseReaderOperand(sym, operand) {
  return gate(
    "G7",
    `\`$\` が作った \`${operand}\` は関数を指す番地で、${sym === null ? "値の演算子の点なし" : `値の演算子 \`${sym}\` `}の被演算子にあります。関数を指す番地は1つの関数と言い切れる番地で（§4 R53）、値の演算子で動かす・比べる形は、その外なので断ります（§4 R62。番地の点と差の規則は、値を読む参照とそれをずらした点・点どうしの差に当てます）。`
  );
}

// ---- 番地の点と差（R62、2026-10-26。§5 Q59 の答え） ----
//
// `$` の値の参照（R60）と、点として置かれた `0x…` の字面は「番地の点」、点どうしの差と、点に足し引きする `0x…` は「番地の差」。どちらも Address 型の値で、
// Int・UInt と混ぜない。決まった組（主の Claude の表に U〔答え〕[2026-10-25 21:15 c8ccdd69]「その表のとおりで良い。」）：
// - 点 ± 差 → 点（`$x + 0x10`・`$x - ($b - $a)`）、点 − 点 → 差（`$foo - $bar`）、差 ± 差 → 差。点 + 点 → 断る。
// - Address と数（Int・UInt・文字。数の desc、SCALAR の注）を混ぜた算術と比べ（`$x + 1`・`$x - 8`・`$x == 0`）→ 断る（言い分「ずらしは `0x…` で書く」。
//   U [2026-10-25 07:48 533071da]「Q54は、Address型とint UIntを混ぜるなって話になるのだと見てる。AddressはAddress同士でしか計算は出来ない…」）。
// - 番地どうしの比べ（点どうし・点と `0x…`・差どうし。段13 の `<` `<=` `=` `>=` `>` `!=` と段8 の `==` `!==`）→ 通す（A。R の印：Address どうしなので）。
// `0x…` の字面は位置で顔が決まる：点の右に足し引きするなら差、比べの相手なら点。解決器は字面を今のまま中身の見えない A で持ち（SCALAR の注）、
// 点の相手の所でだけ書いた綴り（字面・括り1つ・右辺がそれの名前）から見る（hexOperand）。
// 決まっていない組は断る（§5 Q66）：差 ± `0x…`（差か点か）・点の左の `0x…`（`0x10 + $x`・`0x1000 - $x`）・差 ± 点・点と差の比べ・顔の分からない値（裸の
// 仮引数・適用の結果・器・書いた `_`）・`*` `/` `%` `^`・ビット・範囲（差を要素の幅で割って数にする道は §5 Q67 → 2026-10-27 の R98 で `差 / 数` は数）。中置の外の綴り（区間・点なし・
// 絶対値・値の印・素の関数の口）で番地を受けた形は、答えに点・差の印を持たせられないので断る（refuseAddressSpelling・readerAtPlain、§5 Q66）。
// 差が指す物の要素の幅の倍数か（U [2026-10-25 21:12 c8ccdd69]「…メモリアドレスの倍数の加法だと確定できるなら何とかなると思う。」）は、解決器が幅を
// 持たないので型の段で確かめる（仕様 §4 R62。決められる所は見つからなかった）。→ 2026-10-27 の R97 から、点の幅と差の書いた時点の値が見える所は解決器で断る
// （ptWidthOf の注・refuseWidth）。ほかは今のまま型の段と値の段。
// 圏論の読み（主の Claude、R）：位置は差の群が働く torsor（アフィン空間）。`$x` はメモリの1点に焦点を合わせたストアの位置で、`@` は extract、`#` は put、
// `$x + 0x10` は seek。Reader を関手で持ち上げる読み（読んでから当てる）は採らない。
// 2026-09-30 の「番地−番地は Int（距離）」「ずらしは Int で書く」は、差を Address 型にする形で上書きした。
// R92（2026-10-27、§5 Q66 の答え）：番地どうしの計算は、どちらの被演算子もきちんと番地（Address）と言える物（点・差・`0x…` の字面）に限り（U〔答え〕[2026-10-26 23:35
// c8ccdd69]「アドレス同士の計算は、きちんとアドレス値だと言いえるものだけに限定する原則が重要！」）、その中で顔が1つに決まる組だけを足した：差 + 点は点（差の群の作用は
// 可換なので左からも書ける、R）・`0x…` + 点は点（点の相手の `0x…` は差）・差 ± `0x…` と `0x…` + 差は差（差の隣の `0x…` は差、R）。`0x… - 点`（`0x…` を点と読めば差、差と
// 読めば差 − 点で決まらない）・`0x… - 差`・差 − 点・点と差の比べ・差と `0x…` の比べは今のまま断る（§5 Q66 の残り）。
const ADDR_ADD = new Map([
  ["pt+diff", "pt"],
  ["pt+hex", "pt"],
  ["diff+diff", "diff"],
  ["diff+pt", "pt"],
  ["hex+pt", "pt"],
  ["diff+hex", "diff"],
  ["hex+diff", "diff"],
]);
// R96（2026-10-27 の片7、§5 Q66 の算術の所の答え）：`0x… - 差` は差（`0x…` は差と読める所ではいつも差。U〔答え〕[2026-10-27 09:53 58a809c9]「…`0x… − 差` も
// 差で通して。…」）。`0x… - 点` は差と読むと差 − 点で行が無く、点としか読めないので断る。`0x… ± 0x…`（点も差も無い組）の答えは、`0x…` の字面と同じく中身の見えない
// A のままで、点か差の隣に置いた所で書いた綴りから字面の和として見る（hexOperand。`$vs + (0x10 + 0x8)` は点 + 差）。同じ日の確かめの直し：最初の版は和の答えに差の
// 印を付けたので、和を仮引数・器に渡すと印だけ運んで値を落とし（幅の倍数の門を素通り）、比べ・数と混ぜる所・関数の口では `0x18` と答えが割れた。
const ADDR_SUB = new Map([
  ["pt-diff", "pt"],
  ["pt-hex", "pt"],
  ["pt-pt", "diff"],
  ["diff-diff", "diff"],
  ["diff-hex", "diff"],
  ["hex-diff", "diff"],
]);
function gcdBig(a, b) {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y) [x, y] = [y, x % y];
  return x;
}
const hexText = (n) => (n < 0n ? `-0x${(-n).toString(16).toUpperCase()}` : `0x${n.toString(16).toUpperCase()}`);
// R97：点 ± 差で、点の要素の幅 w が分かり、差の値が書いた時点で決まる（`0x…` の字面とその `+`・`-` の畳み込み。h は hexOperand の答え：値 v と、足し引きした字面の
// 絶対値の最大公約数 g）。
// - 値 h.v が幅の倍数でない：要素の途中を指す点になる（R97、決まって断る）。
// - 値は幅の倍数だが、足し引きした字面のどれかが倍数でない（`$vs + (0x4 + 0x4)`）：字面ごとに見るか値で見るかは決まっていない（§5 Q77）。値で見ると、同じ字面の組の
//   `($vs + 0x4) + 0x4` は内の `$vs + 0x4` で断られ、畳み込みの順で答えが割れる。断る側に倒した（前の答えも G21、§5 Q66。同じ日の確かめの直しで言い分を分けた：
//   最初の版はこの形も「幅の倍数でない差」「要素の途中を指す点」と言い、利用者の答えを根拠に引いていた）。
function refuseWidth(t, sym, w, h, diffText) {
  const verb = sym === "+" ? "足して" : "引いて";
  const how = `ずらしは幅の倍数の \`0x…\` で書きます（\`$x + 0x${w.toString(16).toUpperCase()}\`）。`;
  if (h.v % BigInt(w) !== 0n) {
    return gate(
      "G21",
      `\`${t}\` は、要素の幅が ${w} byte（Int の語）と分かる番地の点に、幅の倍数でない差 \`${diffText}\`（値 ${hexText(h.v)}）を${verb}います。要素の途中を指す点になり、保証できる加法ではないので断ります（§4 R97。U〔答え〕[2026-10-27 12:46 58a809c9]「これが通るのはダメだと思う。」）。${how}`
    );
  }
  return gate(
    "G21",
    `\`${t}\` は、要素の幅が ${w} byte（Int の語）と分かる番地の点に、\`0x…\` の字面を足し引きした差 \`${diffText}\`（値 ${hexText(h.v)} は幅の倍数）を${verb}います。足し引きした字面の最大公約数は ${hexText(h.g)} で、字面のどれかが幅の倍数ではありません。差を字面ごとに見るか、畳み込んだ値で見るかは決まっていないので、断る側に倒しました（§4 R97 の R の所、§5 Q77）。${how}`
  );
}
// R96：`0x… - 点`。算術の中の `0x…` は差と読むが、差 − 点は表に行が無い。`0x…` を点（生の番地）と読めば点 − 点で差だが、その点には領域が無く、保証は層0にしか立たない。
function refuseHexMinusPoint(t) {
  return gate(
    "G21",
    `\`${t}\` は \`0x…\` から番地の点を引く形です。算術の中の \`0x…\` は差（ずらし量）と読みますが、差 − 点は番地の点と差の表（§4 R62）に行がありません。\`0x…\` を点（生の番地）と読めば点 − 点で差になりますが、生の番地には領域が無く、その加法の保証は層0にしか立たないので断ります（§4 R96。点としか読めない所は断る）。点からのずれが欲しいなら、点の側から \`$x - $y\` と書きます。`
  );
}
// 番地と数を混ぜた算術の言い分の後ろ（R98）：割る・余り・掛ける所の決まった所と残り。差 / 数 で割る数が Int と書いた所から分かる物（intTerm）は、ここに来る前に
// 数で通る。同じ日の確かめの直しから、割る数がほかの数（小数・文字・`0u`・`0r`・`0b`。数の desc はどれも数に数える）の 差 / 数 は、今までどおり断って §5 Q76 を名指しする
// （最初の版は数の desc で見て通した。主の Claude の Q67 の行への U〔答え〕[2026-10-26 23:46 29bed94e] の「論外」の所）。
function mixedNumNote(sym, lf, rf) {
  const pt = lf === "pt" || rf === "pt";
  if (sym === "/") {
    if (pt) return "割って数にできるのは差 / 数だけで、点は割れません（§4 R98）。";
    if (lf === "diff") return "差を割って数にするのは、割る数が Int と書いた所から分かる形（`($b - $a) / 8`、§4 R98）だけで、ほかの数（小数・文字・`0u…`・`0r…`・`0b…` など）で割る形は決まっていません（§5 Q76）。";
    return "数 / 差は決まっていません（§5 Q76）。";
  }
  if (pt) return "";
  if (sym === "%") return `${lf === "diff" ? "差 % 数" : "数 % 差"}は決まっていません（§5 Q76）。`;
  if (sym === "*") return "差と数を掛ける形は決まっていません（§5 Q76）。";
  return "";
}
const ADDR_CMP_SYMS = new Set(["<", "<=", "=", ">=", ">", "!=", "==", "!=="]);
const ADDR_CMP_OK = new Set(["pt|pt", "pt|hex", "hex|pt", "diff|diff"]);
const FACE_TEXT = {
  pt: "番地の点",
  diff: "番地の差",
  hex: "`0x…` の字面",
  num: "数（Int・UInt・文字）",
  unit: "書いた `_`",
  fnv: "関数（番地でも数でもない）",
  box: "番地の算術で作った点・差を中に持つ器",
  other: "点か差か数か分からない値",
  lift: "先の種類の分からない持ち上げ（関数の番地か値の番地の点か決まらない）",
  none: "書いていない被演算子",
};
// 被演算子の顔：書いた `_`（unit）・関数を指す番地（fn）・関数（fnv）・番地の点（pt）・差（diff）・番地の字面（hex）・数（num）・ほか（other）。被演算子が
// 無ければ none。関数（L）は言い分で名指しするためだけに分ける（2026-10-26 の確かめの指摘：前は「点か差か数か分からない値」と言っていた）。答えは「ほか」と同じ。
function operandFace(isUnit, desc, hex) {
  if (isUnit) return "unit";
  if (!desc) return "none";
  if (refOf(desc)) return "fn";
  if (liftOf(desc)) return "lift"; // 先の種類の分からない持ち上げ（2026-10-27 の片8）
  if (desc.k === "L") return "fnv";
  const f = addrFace(desc);
  if (f) return f;
  // 番地の算術で作った点・差を要素・欄に持つ器（hasAddr。2026-10-26 の確かめの直し）：器の中身に値の演算子を当てる形は、器の中の番地の顔が答えに残らない
  // （`([($x + 0x10) ($x + 0x10)] ' 0)` を包んで `[…] + 1`）ので断る（addressOp、§5 Q66）。
  if (hasAddr(desc)) return "box";
  if (hex) return "hex";
  if (isScalar(desc)) return "num";
  return "other";
}
// 値の演算子 sym の被演算子の顔 lf・rf（R62）。どちらにも番地の点か差が無ければ null（今までの読み）。読めれば答えの desc（点・差、比べは A）。
// 関数を指す番地は G7、決まって断る組と決まっていない組は G21。text は項の綴り、operand[i] は i 番目の被演算子の綴り（作るのは断るときだけ）。
// info[i] は i 番目の被演算子の幅と値（R97、2026-10-27 の片7）：点なら {w}（要素の幅、分からなければ null）、`0x…` の字面（とその和）なら {lit}（hexOperand の
// 書いた時点の値）、数なら {int}（Int と書いた所から分かるか、R98）。比べの所（resolveTree）は渡さない。
// 2026-10-27 の片7（R96〜R98。U〔答え〕[2026-10-27 09:53 58a809c9]「それでいい。算術の中の `0x…` は差と読める所ではいつも差（ずらし量で、生の番地じゃないので
// どの層でも書ける）、点としか読めない所は断る。`0x… − 差` も差で通して。…」。文はボタンの文で、主の Claude の物）：
// - R96：中置の `+`・`-` の被演算子の `0x…`（括り1つ・名前と、`0x…` どうしの `+`・`-` の和も。hexOperand）は、差と読めば表に行のある所ではいつも差。`0x… - 差` は差。
//   差と読むと行が無く点としか読めない `0x… - 点` は断る（言い分は保証できる加法か、refuseHexMinusPoint）。点と差の顔の無い `0x… ± 0x…`・`0x… ± 数` と、`0x…` の
//   比べは今まで（ここでは見ない。比べの相手の和は字面の和として見ない、hexFace）。
// - R97：点 ± 差で、点の要素の幅 w と差の書いた時点の値 lit が分かり、差が幅の倍数でなければ断る（refuseWidth。値が倍数でも字面のどれかが倍数でなければ §5 Q77）。
// - R98：`差 / Int` は数（`($b - $a) / 8`・`0x10 / 2`）。層に依らない。
function addressOp(sym, lf, rf, text, operand, info = [null, null]) {
  if (lf === "fn" || rf === "fn") throw refuseReaderOperand(sym, operand[lf === "fn" ? 0 : 1]());
  if (lf === "lift" || rf === "lift") throw refuseLiftOperand(sym, operand[lf === "lift" ? 0 : 1]());
  if (lf === "box" || rf === "box") {
    throw gate(
      "G21",
      `\`${text()}\` の \`${sym}\` の被演算子（左は${FACE_TEXT[lf]}、右は${FACE_TEXT[rf]}）に、番地の算術で作った点・差を中に持つ器があります。器の中身に値の演算子を当てる形は、答えに中の番地の点・差の印を持たせられないので、断る側に倒しました（器の中の番地は \`' 0\` で引いてから中置で書けば、§4 R62 で読みます。§5 Q66）。`
    );
  }
  const isAddr = (f) => f === "pt" || f === "diff";
  const litAt = (i) => (info[i] && info[i].lit) || null;
  // R98：割る数が Int と書いた所から分かるか（intTerm。数の desc は小数・文字・`0u`・`0r`・`0b` も数に数えるので、desc では見ない）。
  const intDivisor = sym === "/" && rf === "num" && !!info[1] && !!info[1].int;
  if (!isAddr(lf) && !isAddr(rf)) {
    // R98：`0x… / Int` は差 / 数で数（`0x…` は差と読める所）。割る数が Int と分からなければ今まで（点も差も無い組、ここでは見ない）。
    if (intDivisor && lf === "hex") return scalarDesc();
    return null;
  }
  const out = sym === "+" ? ADDR_ADD.get(`${lf}+${rf}`) : sym === "-" ? ADDR_SUB.get(`${lf}-${rf}`) : null;
  if (out === "diff") return { k: "A", addr: "diff" };
  if (out === "pt") {
    // 点の側と差の側（`0x…` は差）。点 ± 差・差 + 点・`0x…` + 点で、点はいつも片側だけ。
    const p = lf === "pt" ? 0 : 1;
    const w = (info[p] && info[p].w) || null;
    const lit = litAt(1 - p);
    // R97：幅の倍数の門。足し引きした字面の最大公約数 g が幅の倍数でなければ断る（値が倍数でない所は R97、値は倍数で字面のどれかが倍数でない所は §5 Q77）。
    if (w && lit && lit.g % BigInt(w) !== 0n) throw refuseWidth(text(), sym, w, lit, operand[1 - p]());
    // ずらした点は、幅と書いた時点の値の差でずらしたときだけ幅を持つ（値の決まらない差でずらした点は、指す要素が分からない）。
    return w && lit ? { k: "A", addr: "pt", w } : { k: "A", addr: "pt" };
  }
  if (ADDR_CMP_SYMS.has(sym) && ADDR_CMP_OK.has(`${lf}|${rf}`)) return A();
  // R98：差 / Int は数（要素の数。層の門は作らない）。
  if (intDivisor && lf === "diff") return scalarDesc();
  const t = text();
  const pair = `左は${FACE_TEXT[lf]}、右は${FACE_TEXT[rf]}`;
  if (lf === "num" || rf === "num") {
    const cmp = ADDR_CMP_SYMS.has(sym);
    throw gate(
      "G21",
      `\`${t}\` は番地（Address）と数を混ぜた${cmp ? "比べ" : "算術"}です（${pair}）。Address と Int は混ぜません。${cmp ? "番地と比べるのは番地（`0x…` の字面・点・差）です" : "ずらしは `0x…` で書きます（`$x + 0x10`）"}（§4 R62）。${mixedNumNote(sym, lf, rf)}`
    );
  }
  if (sym === "+" && lf === "pt" && rf === "pt") {
    throw gate("G21", `\`${t}\` は番地の点どうしを足す形です。点に足せるのは差（\`0x…\` の字面か、点どうしの差）だけで、点 + 点は意味がないので断ります（§4 R62）。`);
  }
  if (sym === "-" && lf === "hex" && rf === "pt") throw refuseHexMinusPoint(t);
  throw gate(
    "G21",
    `\`${t}\` の \`${sym}\` の組（${pair}）は、番地の点と差の規則（点 ± 差は点、点 − 点は差、差 ± 差は差、点どうし・差どうし・点と \`0x…\` の比べ。§4 R62）で決まっていません（§5 Q66）。`
  );
}
// 中置の外の綴り（区間の被演算子・値の演算子の点なしが受けた実引数・絶対値・値の印）で、番地の点か差を値の演算子の被演算子にした（R62）。中置の項と違って
// 答えに点・差の印を持たせられない（区間・点なしの適用の答えは中身の見えない A で、実体の鍵も記号と被演算子を見ない）ので、中置で書けば通る組も断る
// （断る側に倒した、§5 Q66）。sym が null なら点なしが受けた所で、記号は書かない（refuseReaderOperand の注）。
function refuseAddressSpelling(sym, operand) {
  return gate(
    "G21",
    `\`${operand}\` は番地（\`$\` が作った値を読む参照か、それをずらした点か、点どうしの差）か、番地の算術で作った点・差を中に持つ器で、${sym === null ? "値の演算子の点なしが受けた所" : `値の演算子 \`${sym}\` の被演算子（区間・点なし・絶対値・値の印の綴り）`}にあります。番地の点と差の規則（§4 R62）を当てるのは中置で書いた \`+\`・\`-\` と比べだけで、この綴りは決まっていません（中置で書けば R62 で読みます。§5 Q66）。`
  );
}
// `@x` で、番地の算術で作った点・差を開いた（R62。classify の前置 `@` の枝）。
function refuseOpenAddress(text, d) {
  return gate(
    "G21",
    `\`${text}\` は、番地の算術で作った${d.addr === "pt" ? "点（ずらした番地）" : "差"}を \`@\` で開いています。${d.addr === "pt" ? "ずらした点が指す物は、差が指す物の要素の幅の倍数かと一緒に型の段で決まるので、解決器の段では分かりません" : "差は位置ではないので、読む物がありません"}（§4 R62、§5 Q66）。`
  );
}
// 番地の算術で作った点・差（R62）が、印を落とす所に入った（hasAddr の注。2026-10-26 の確かめの直し）。where は入った所、text は綴り（器なら要素の形）。
// どれも、印を持ち越すかは決まっていない（§5 Q66）ので、断る側に倒した。HEAD は中の算術を G7 で断っていた。
function refuseAddressDrop(where, text, extra = {}) {
  const tail = "印を持ち越すか（答えに点・差を持たせるか）は決まっていないので、断る側に倒しました（§4 R62、§5 Q66）。";
  const why = {
    return: `\`${text}\` は関数の本体が返す値（字下げの本体なら、枝の値と行の値も）で、番地の算術で作った点か差を含みます。関数の答えは本体の根の種類だけで持ち（素の関数と括りの関数の実体の答えは中身の見えない A。印のある実引数で作った素の関数の実体も同じ、R81）、点・差の印を答えに持たせられないので、返した番地が数と黙って混ざります（\`gw : y ? $x + 0x10\` ⏎ \`(gw 1) + 1\`）。`,
    // 2026-10-26 の確かめの指摘から、点・差そのものと、それを中に持つ器で言い分を分ける（点・差そのものは印で実体を作る（R81）ので、ここに来るのは実体を
    // 作らない口だけ）。
    plain: extra.direct
      ? `番地の算術で作った点か差 ${text} を、素の関数 \`${extra.label}\` の前から ${extra.at} 番目の口に渡しました。この口は印で実体を作らない所（R81 の外）で、素の関数の本体は裸の仮引数を番地と見ずに1回だけ解くので、本体がその口を返しても値の演算子に置いても、点・差の印を持たせられません。`
      : `番地の算術で作った点か差を中に持つ ${text} を、素の関数 \`${extra.label}\` の前から ${extra.at} 番目の口に渡しました。素の関数の裸の仮引数は器の中を見ずに受ける（印のある実引数で実体を作る所でも、器は中身の見えない A、R81）ので、本体がその口を返しても値の演算子に置いても、中の点・差の印を持たせられません（\`gi : y ? y\` ⏎ \`((gi (($x + 0x10) , 1)) ' 0) + 1\` が黙って通る）。`,
    logic: `\`${text}\` の論理の \`${extra.sym}\` の被演算子 \`${extra.operand}\` は、番地の算術で作った点か差を含みます。論理の答えは通った側の値で、点・差の印を持たせられないので、番地が数と黙って混ざります（\`(c & ($x + 0x10) | $y) + 1\`）。`,
    writeTo: `\`${text}\` は、番地の算術で作った${extra.pt ? "点（ずらした番地）" : "差"}に \`#\` で書いています。${extra.pt ? "ずらした点が指す物（書く所の型）は、差が指す物の要素の幅の倍数かと一緒に型の段で決まるので、解決器の段では分かりません" : "差は位置ではないので、書く所がありません"}（\`@\` で開く形と同じ）。`,
    writeOf: `\`${text}\` は、番地の算術で作った点か差を \`#\` で書いています。書いた物は置き場の中身になり、解決器は置き場の中身と \`#\` の答えに点・差の印を持たせられません。`,
    mixed: `番地の算術で作った点か差を、要素の形の揃わない器（List・積。要素の形 ${cutShape(text)}）に入れました。形の揃わない要素は中身の見えない値にまとまり（\`[x ~xs]\` の x・\`' 0\` で引いた物）、点・差の印を持たせられないので、番地が数と黙って混ざります（\`([($x + 0x10) 5] ' 0) + 1\`）。`,
    bracket: `番地の算術で作った点か差（形 ${text}）を、括りの関数の括りの仮引数に直に渡しました。括りの仮引数に直に渡った番地は中身の見えない値として受ける（名前は未知）ので、点・差の印を本体に持ち越せません（裸の仮引数か欄で渡せば持ち越します）。`,
    other: `番地の算術で作った点か差 ${text} を、既定値のある関数（か、口の読みの決まっていない関数）の口に渡しました。その関数の答えは未知で（§3.4）、点・差の印を持たせられません。`,
    bare: `番地の算術で作った点・差を中に持つ器（形 ${cutShape(text)}）を、${extra.plain ? "素の関数（印のある実引数で実体を作る所、R81）" : "括りの関数"}の裸の仮引数に渡しました。裸の仮引数は形を見ずに中身の見えない A で受ける（R24）ので、中の点・差の印が本体で落ちます（括りの仮引数で受ければ、要素・欄の印は見えます）。`,
  }[where];
  return gate("G21", `${why}${tail}`);
}
// 片イ（R120 の例外）：名前 name の読み（どの定義を指すか）が決まらない理由（lookup と同じ順に探す）。括りと構造体のブロックの行の名前（R54 の local-field）と、
// 取り込みのある範囲の定義されていない名前（"imported"）。ほかは null。寄せ1（R128）の前は、関数の本体の局所の名前の読めない所（local-nested・local-branch・
// local-twice）もここだった（本体の行は何も定義しなくなったので無くなった）。
// R120 で種類の未知な項は断らなくなったが、これらは種類でなく名前の読みが決まらない（値の段の問いではなく、名前を解く段の問い。§5 Q10、取り込みはキの片）ので、
// 2項以上の並びに置けば今までどおり G7 で断る（reduceFold の前検査）。
function undecidedWhy(name, ctx) {
  let imported = false;
  for (let s = ctx.scope; s; s = s.parent) {
    if ((s.descs && s.descs.has(name)) || (s.params && s.params.has(name))) return null;
    if (s.locals && s.locals.has(name)) return "local-field";
    if (s.hasImport) imported = true;
  }
  return imported && !ctx.F.defs.get(name) ? "imported" : null;
}
// 項（葉）が、読みの決まらない名前（undecidedWhy）か、それを1行で括った物（[x] ≅ x）なら {name, why}。ほかは null。
// 2026-11-03 の片イの確かめの直し：名前の読みで項の種類（関数か値か）が変わる印を付けた名前（後置 `~` の撒き・前置 `@` の読み・中置 `'` の左。`w~ 2`・`@w 5`・
// `(w ' 0) 2`）も同じ（§5 Q85 (k)。広げた形は carriedName の注）。前は裸の名前と1行の括りだけを見て、印を付けると種類の未知な項として通った（HEAD は G7 か G6。頭の
// 位置の前置 `@`（`@w 5`・`@[w] 5`）だけは HEAD でも通った）。値の印（`-w`・`!w`・`||w||`・算術）は、
// 名前の読みに依らず値か `_` なので見ない（§5 Q85 (i)）。ctx は今の範囲（印の付いた名前は classify が印 undecided を付けないので、ここで undecidedWhy を引く）。
// 括りの入れ子の深さに上限は置かない（再確かめ 2026-11-03：上限 16 を超えた `[[…[w]…]] 2` が黙って通った。木は有限で、深すぎれば行の解き方と同じく stackRefusal）。
function undecidedOf(item, ctx) {
  if (!item || item.t !== "leaf") return null;
  const term = item.term;
  if (!term) return null;
  if (term.type === "atom" && !term.pre.length && !term.post.length) {
    if (item.undecided && term.core.c === "name") return { name: term.core.name, why: item.undecided };
    const inner = item.view && item.view.inner;
    if (term.core.c === "bracket" && Array.isArray(inner) && inner.length === 1) return undecidedOf(inner[0], ctx);
    return null;
  }
  const n = carriedName(term);
  const why = n && undecidedWhy(n, ctx);
  return why ? { name: n, why } : null;
}
// 項が、名前の読みを種類に持ち越す形（裸の名前・持ち越す印（前置・後置の `~`、前置 `@`・`$`）だけを付けた名前・左がそれの中置 `'`・`@`・それを1行で括った物）なら、
// その名前。ほかは null（undecidedOf）。
// 2026-11-03 の片イの再確かめの直し：前置 `~`（`~w` は書いた `[w]` と同じ項、R79）と印の付いた括り（`@[w]` は `@w`、R82）は、もう G7 の形と同じ項なので数える
// （前は印1つの名前と、印の無い括りだけを見て通った。HEAD は G7 か G6 で、頭の位置の `@[w] 5` だけは通った）。印の組み合わせ（`@w~`・`w~~`・`@$w`）・中置 `@` の左
// （`(w @ 0)`、§2 で `'` と同じ引き）・印の付いた括りの中の持ち越す形（`@[w ' 0]`）も、名前の読みで種類が変わるので数える（`@$w` は w が関数なら関数、値なら `$値` の
// `_`。`$w`・`@($w)` は G20 で断るのに、組み合わせの `@$w` だけが種類の未知な項で通っていた）。答えが名指ししていない所で、断る側に倒した（HEAD も G7 か G6。§5 Q85 (k)）。
// 入れ子の深さに上限は置かない（undecidedOf の注）。
function carriedName(term) {
  if (!term) return null;
  if (term.type === "infix") return term.sym === "'" || term.sym === "@" ? carriedName(term.left) : null;
  if (term.type !== "atom") return null;
  if (!term.pre.every((p) => p === "~" || p === "@" || p === "$") || !term.post.every((p) => p === "~")) return null;
  if (term.core.c === "name") return term.core.name;
  if (term.core.c === "bracket" && term.core.rows.length === 1) {
    const row = term.core.rows[0];
    return row && row.type === "seq" && row.terms.length === 1 ? carriedName(row.terms[0]) : null;
  }
  return null;
}
// 読みの決まらない名前を2項以上の並びに置いた所の G7（片イ、R120 の例外）。
function refuseUndecided(u) {
  if (u.why === "imported") {
    return gate(
      "G7",
      `名前 \`${u.name}\` は、取り込みのある範囲の定義されていない名前で、どの定義を指すかがこのファイルから見えません。読みの決まらない名前は値の段に渡せないので、2項以上の並びには置けません（§4 R120、§5 Q10・Q45 の残り。取り込みはキの片）。`
    );
  }
  // 寄せ1（R128）から、ここに来る局所の理由は括りの欄の名前（local-field）だけ。
  const where = u.why === "local-field" ? "括りか、関数の本体でない字下げのブロックの行の名前で、その行は欄かもしれません" : u.why;
  return gate(
    "G7",
    `名前 \`${u.name}\` は、どの定義を指すか（局所の定義と読むか）が決まりません（${where}）。読みの決まらない名前は値の段に渡せないので、2項以上の並びには置けません（§4 R54・R120、§5 Q10）。`
  );
}
// 寄せ1（R128）の前は、関数の本体の `:` の行に隠されたファイルの定義の名前（shadowedName・shadowFace）を、番地の点と差の顔で断っていた（G21、§5 Q10・Q66）。
// 本体の行は何も定義しないので、隠しは無くなり、名前はファイルの定義の顔のまま読む。
// 番地の字面の項（R62）：書いた `0x…`・`NxHHHH`（ADDRESS_LIT）、それを1行で括った物（[x] ≅ x。中身の `,` の単位は解いた木で消えている）、右辺がそれの
// ファイルの値の定義の名前（`:` はメタ。F.hexDefs、nameKindOf が置く）。仮引数・実体で渡された物・括りの欄の名前は見ない（顔が分からない、§5 Q66）。
// 2026-10-27 の片7 の R96・R97 から、答えは字面の値 {v, g, sum}（BigInt。v は値、g は足し引きした字面の絶対値の最大公約数で幅の倍数の門が読む、sum は字面どうしの
// `+`・`-` の和か）。番地の字面でなければ null。字面どうしの和（`0x10 + 0x8`・`(0x10 + 0x8)`・`w8 : 0x10 + 0x8` の w8。どちらの被演算子もこの関数で字面と読める
// 中置の `+`・`-`）も字面の値として読む（R96：「`0x…` どうしの算術の結果」も `0x…` と同じく、差と読める所では差。決定の文の括り方）。比べの相手では和を見ない
// （hexFace。`0x…` を含む比べは今まで）。
function hexOperand(term, view, ctx) {
  if (!term) return null;
  if (term.type === "infix") {
    if ((term.sym !== "+" && term.sym !== "-") || !view || view.v !== "infix") return null;
    const a = hexOperand(term.left, view.left, ctx);
    const b = a && hexOperand(term.right, view.right, ctx);
    return b ? { v: term.sym === "+" ? a.v + b.v : a.v - b.v, g: gcdBig(a.g, b.g), sum: true } : null;
  }
  if (term.type !== "atom" || term.pre.length || term.post.length) return null;
  const c = term.core;
  if (c.c === "lit") {
    if (!ADDRESS_LIT.test(c.text)) return null;
    const v = hexLitValue(c.text);
    return { v, g: v, sum: false };
  }
  if (c.c === "bracket") return !!view && Array.isArray(view.inner) && view.inner.length === 1 ? hexTree(view.inner[0], ctx) : null;
  if (c.c === "name") return hexName(c.name, ctx);
  return null;
}
function hexTree(t, ctx) {
  return !!t && t.t === "leaf" && !!t.term ? hexOperand(t.term, t.view, ctx) : null;
}
// 被演算子の `0x…` の顔（operandFace の hex）：比べ（cmp）の相手では、字面どうしの和を字面と読まない（R96 の決定の文「`0x…` を含む比べは今のまま」。前は和が中身の
// 見えない値で、`(0x10 + 0x8) == $vs` は G21、`(0x10 + 0x8) == 0x18` は A。同じ日の確かめの直し：最初の版は和を差にして、`(0x10 + 0x8) == ($vs - $five)` を差どうしの
// 比べで通した）。
const hexFace = (h, cmp) => (h && !(cmp && h.sum) ? h : null);
// 番地の字面の値（R97）：`0x…`・`NxHHHH` の `x` の後ろの16進の数。`x` の前の数字（幅、`0` は未指定）は値に入れない。
const hexLitValue = (text) => BigInt(`0x${text.slice(text.indexOf("x") + 1)}`);
function hexName(name, ctx) {
  for (let s = ctx.scope; s; s = s.parent) {
    // 寄せ1（R128）の前は、関数の本体の `:` の行がファイルの定義の名前を隠す所と、本体の局所の定義の右辺もここで見ていた。本体の行は何も定義しないので、外した。
    if ((s.descs && s.descs.has(name)) || (s.params && s.params.has(name)) || (s.locals && s.locals.has(name))) return null;
  }
  const def = ctx.F.defs.get(name);
  if (!def || def.lambda) return null;
  nameKindOf(ctx.F, def);
  return ctx.F.hexDefs.get(def) || null;
}

// ---- 値が Int と書いた所から分かるか（R97、2026-10-27 の片7） ----
//
// 値を読む参照 `$x` の指す要素の幅（ptWidthOf の注）が木の段で分かるのは、x の値が Int（"scalar"）か、Int を並べた List（"list"）だと書いた所から分かるとき。
// Int は、Int の字面（`5`・`-3`。小数点・番地・文字・文字コード `0u…`・`0r`・`0b` の字面は入れない）・Int どうしの値の演算（算術 `+` `-` `*` `/` `%` `^` と
// ビット `<<` `>>` `||` `;;` `&&`）の答え・Int に当てた値の印（前置 `-`・`!!`・後置 `!`）と絶対値 `|x|`・括り1つ（[x] ≅ x）・前置 `~`（R79、`~x` は `[x]`）・右辺がそれの
// 名前（ファイルの値の定義。`:` はメタ）。List は、Int を並べた構築・`,` の積・2行以上の括り（`vs : 1 , 2 , 3`・`[1 2]`）。
// 同じ日の確かめの直し：最初の版は前置 `-` を名前にだけ当て（`-five` は Int、`-(5)`・`-(five)` は分からない）、ビット・`!!`・`!`・`|x|`・`~x` を数えず、包み方で答えが割れた。
// ノルム `||x||` と `差 / 数`（R98）の答えは数えない（§5 Q77）。
// 要素が List の器（`[1 2] , [3 4]`）は、要素が Int でないので入れない。数の desc（SCALAR）は文字と文字列の要素も数に数えるので、desc ではなく書いた木で見る。
// 仮引数・実体で渡された物・ほかの物は分からない（幅を見ない、R97 の決定の文「幅が木の段で分からない所」）。答えは "scalar"・"list"・null。
const INT_LIT = /^-?[0-9]+$/;
const INT_OPS = new Set(["+", "-", "*", "/", "%", "^", "<<", ">>", "||", ";;", "&&"]);
const INT_MARKS = new Set(["-", "!!"]);
const allScalar = (ts, ctx) => ts.length > 0 && ts.every((x) => intTree(x, ctx) === "scalar");
function intTree(t, ctx) {
  if (!t) return null;
  const one = vanishedOne(t);
  if (one) return intTree(one, ctx);
  if (t.t === "construct") return allScalar(liveItems(t.items), ctx) ? "list" : null;
  if (t.t === "op" && t.sym === ",") return allScalar(commaItems(t), ctx) ? "list" : null;
  return t.t === "leaf" && !!t.term ? intTerm(t.term, t.view, ctx) : null;
}
function intTerm(term, view, ctx) {
  if (!term) return null;
  if (term.type === "infix") {
    const ok = INT_OPS.has(term.sym) && !!view && view.v === "infix" && intTerm(term.left, view.left, ctx) === "scalar" && intTerm(term.right, view.right, ctx) === "scalar";
    return ok ? "scalar" : null;
  }
  if (term.type !== "atom") return null;
  const c = term.core;
  const { pre, post } = term;
  if (pre.length || post.length) {
    // 前置 `~` だけ（R79）：書いた `[x]` と同じ項で、view.inner は `[x]` の中の木（classify）。
    if (pre.length === 1 && pre[0] === "~" && !post.length) return !!view && Array.isArray(view.inner) && view.inner.length === 1 ? intTree(view.inner[0], ctx) : null;
    // 値の印（前置 `-`・`!!`・後置 `!`）：Int に当てれば Int。核の view は classify が coreView に置く。
    if (!pre.every((p) => INT_MARKS.has(p)) || !post.every((p) => p === "!")) return null;
    return intTerm({ type: "atom", pre: [], core: c, post: [] }, view ? view.coreView : null, ctx) === "scalar" ? "scalar" : null;
  }
  if (c.c === "lit") return INT_LIT.test(c.text) ? "scalar" : null;
  if (c.c === "name") return intName(c.name, ctx);
  if (c.c === "abs") return !!view && Array.isArray(view.inner) && view.inner.length === 1 && intTree(view.inner[0], ctx) === "scalar" ? "scalar" : null;
  if (c.c !== "bracket" || !view || !Array.isArray(view.inner) || !view.inner.length) return null;
  if (view.inner.length === 1) return intTree(view.inner[0], ctx);
  return allScalar(view.inner, ctx) ? "list" : null;
}
// 名前の右辺の値が Int と書いた所から分かるか（hexName と同じ順に探す。仮引数・実体で渡された物・括りの欄の名前は分からない）。ここからは名前を解かず、もう解いた
// 名前の答え（intDefs）だけを読む：`$名前` の先（dollarNameTarget）と木の中の名前は、ここより前に解いてある。解き終えていない名前（`$v` の輪、
// R73 の指す値は中身の見えない A）は分からない側（解かせると、R73 が通す輪を name-cycle にした。`a : f 1` ⏎ `v : f 1` ⏎ `f : x ? x , $v`）。
function intName(name, ctx) {
  const F = ctx.F;
  for (let s = ctx.scope; s; s = s.parent) {
    if ((s.descs && s.descs.has(name)) || (s.params && s.params.has(name)) || (s.locals && s.locals.has(name))) return null;
  }
  const def = F.defs.get(name);
  return (!!def && !def.lambda && F.intDefs.get(def)) || null;
}

// `@x` の x の desc（R49）。名前は peekDesc で引き（2026-10-26 の R82 から、値の定義も右辺を解いて印を読み、輪に数える。前は解かずに覗いた。未定義なら
// information だけ出す、touchName）、括りは解く（前の touchCore と同じ）。`@x` の x は開く所なので、括りの中身は遅延した式にしない。`$x` の x は classifyDollar が見る
// （2026-10-24 までは、ここで delayed の印を付けて `$x` の x も見ていた）。
function pointedDesc(core, ctx) {
  if (core.c === "name") {
    touchName(core.name, ctx);
    return peekDesc(core.name, ctx);
  }
  return bracketInfo(core, ctx).desc;
}

function touchCore(core, ctx) {
  if (core.c === "name") touchName(core.name, ctx);
  else if (core.c === "bracket") bracketInfo(core, ctx);
  else if (core.c === "abs" || core.c === "norm") enclosureInfo(core, ctx);
  else if (core.rows) core.rows.forEach((r) => resolveTree(r, ctx));
}

// `|…|`・`||…||`（§2、R27）。囲みは値の演算子（絶対値・ノルム）なので、中の行の根が全部値なら A にする。書いた `_` だけの
// 行は印（値）なので A のまま（`||_||` は 0、`||$_||`・`||$!_||` は 1。U 10-21 02:54・U〔答え〕03:01）。
// ノルムの中が1行で根が関数 f なら、f の後にノルムを当てる合成（L）にする（R27、U〔答え〕10-21 03:01「多分筋が良いのは合成」）：
// `||f|| x` は `||f x||`（x が f のアリティ分のとき。k > n は左からの畳み込み（R40）で、ノルムは口を1つと数えて余りを後ろに積む。
// `||inc|| 1 2` は `||inc 1||` の後ろに 2、fnShape）。合成は適用の繰り返し（R11）なので、fns に f と「1つ受けて A」のノルム
// （NORM_FN）を並べる。f が合成なら開いて並べる（口の開いたまま残った合成も、最初の関数を部分適用にした合成なので開いてよい。
// entryFn）。`||!_||` は恒等射の後にノルムで、並び全体を受けて数える（`[~x] ? ||x||`、U 10-21 02:54）。
// ほか（中に未知・2行以上で L・絶対値の囲み `|f|`・`|!_|`）は、値の演算子に関数が来た項（§5 Q22）と同じく読みが決まらないので
// 未知にする。中が関数のときまで A と読むと、`|inc| 5` が黙って構築になる。撒く項だけの行（`|vs~|`）は、中置の被演算子の
// 撒く項（classifyInfix の注）と同じ理由で未知にする。
const NORM_FN = { type: "norm" };
function enclosureInfo(core, ctx) {
  const trees = core.rows.map((r) => resolveTree(r, ctx));
  // 絶対値は値の演算子：中に関数を指す番地があれば G7、番地の点・差があれば G21（R62、§5 Q66）、素の関数の裸の仮引数なら札に覚える（R60 の細かい所。valueOperand）。
  // ノルム（数える）は今のまま（`||$_||` は 1、R56）。
  if (core.c === "abs") for (const t of trees) if (t && t.kind) valueOperand(t.kind, "|…|", () => show(t));
  const isValue = (t) => !!t && t.kind.k === "A" && !(t.t === "leaf" && t.desc.spread);
  if (trees.length && trees.every(isValue)) return { desc: A(), trees };
  const root = trees.length === 1 ? trees[0] : null;
  if (core.c === "norm" && root && root.kind.k === "L" && root.kind.fn) {
    const f = root.kind.fn;
    const fns = f.type === "compose" ? [...f.fns, NORM_FN] : [f, NORM_FN];
    return { desc: { k: "L", fn: { type: "compose", fns } }, trees };
  }
  return { desc: U(), trees };
}

// 括らない `!_` を、読みの決まる位置の外で見つけたとき（§3.5、Q15）。読みの決まる位置は、口を埋める穴（素の関数か既定値のある関数の
// 実引数の並び、R16・R34）・口の外の恒等射（並びの頭・値の後ろ・`!_` だけの行・`,` の被演算子。R29・R44・R45）・口の中で穴と読んでも
// 恒等射と読んでも同じ関数になる所（口の数の決まった関数に口が1つだけ残った所、R46）・`||!_||`。`!_` だけの行は括らない行（`x : !_`・
// 本体・2行以上の括りの中の行）で、1行の括り `[!_]`・`(!_)` は否定の点なし（R29、§2）。言い分にもそう書く（`!_ + 1` を `(!_) + 1` に
// 書き直すと、恒等射ではなく否定になるので）。
function refuseHole(where) {
  return gate(
    "G7",
    `括らない \`!_\` が${where}にあります。\`!_\` の読みが決まるのは、口を埋める穴（素の関数か既定値のある関数（名前の定義か \`?\` の括り）の実引数の並びで、撒く項が無く、ほかの項が全部 A のとき。k = n なら最後の項が書いた \`_\` でないとき（R16）、k ≠ n なら書いた \`_\` が無く、k > n なら \`!_\` が前から n 個の中にあるとき（R34））と、口の外の恒等射（並びの頭・値の後ろ・括らない \`!_\` だけの行・\`,\` の被演算子。\`i : !_\` の i と同じ。R29・R44・R45）と、口の中で、穴と読んでも恒等射と読んでも同じ関数になる所（口の数の決まった関数に、口が1つだけ残っている所。R46）と、\`||!_||\` だけです。1行の括り \`[!_]\`・\`(!_)\` は恒等射ではなく否定の点なしです。それ以外の位置の読みは決まっていません（§3.5、§5 Q15）。`
  );
}

// 段4〜8 の中置の被演算子が、括らない `!_` 1つの並び（`!_ == 1`・`1 & !_`）。中置の被演算子は §3.5 の決定で G7 のまま（`!_ + 1` と
// 同じ。段12〜22 の項の中は classifyInfix が見る）。被演算子の `!_` を恒等射と読むかは決めていない（§5 Q15）。`,`（段9）の被演算子の
// 恒等射は、積の単位で消える（R45、resolveProduct）。
function refuseOperandHole(tree, sym) {
  if (tree && tree.t === "leaf" && tree.cat === "hole") throw refuseHole(`中置 \`${sym}\` の被演算子`);
}
// 2行以上の手続きの本体（と、枝の間の裸の行）の、括らない `!_` だけの行（`t : a ?` ⏎ `⇥!_` ⏎ `⇥a`）。手続きは `l1 & … & ln`（evaluatePlace の注）なので、
// この行は中置 `&` の被演算子の `!_`（`!_ & a`、refuseOperandHole）と同じ所で、恒等射と読む（評価する所で `_` になり、手続きがそこで止まる）かが決まって
// いない（§5 Q15）。2026-10-26 の R76 の最初の版は、評価する所で黙って `(unit !_)` にしていた（恒等射は知らせない、R48。だが `&` の鎖では `_` が鎖を止める
// ので、R48 の「落としても当てても値が同じ」が成り立たない。確かめ 2026-10-26）。その前（R29 の R の所）は恒等射の行で、本体の根は未知だった。
// 1行だけの本体の `⇥!_` と枝の値の `!_` は、本体の返す所なので1行の `t : a ? !_` と同じく G16（resolveBody）。片イ（R125）から、そこは G16 でなく `_` にした木 `(unit !_)` で、恒等射なので知らせない（bareReturnUnit）。
function refuseProcedureHole() {
  return gate(
    "G7",
    "括らない `!_` だけの行が、2行以上の手続きの本体の行にあります。手続きの本体は `l1 & … & ln`（途中の `_` で止まる）なので、この行は中置 `&` の被演算子の `!_`（`!_ & a`）と同じ所です。そこで `!_` を恒等射と読む（評価する所で `_` になり、手続きがそこで止まる）かは決まっていません（§4 R29・R76、§5 Q15・Q37）。"
  );
}

// 段12〜22 の中置の項（§2）。値の演算子（段12〜16・19〜22）は被演算子が全部 A のときだけ A。書いた `_` の被演算子は
// 印（値）なので A に数える（`_ + 1`・`1 * _`。値は値の段で演算子表の Unit の欄が読む。§3.5、U〔答え〕10-14 03:32）。
// 穴 `!_` の被演算子は G7（穴の位置の外）、未知があれば未知。丸ごとの関数は 2026-10-27 の R87 から評価する所で `_`（前は未知）。段18 の `x ' k` は、x の形が見えて k が字面の整数か裸の名前なら、
// 引いた物の生まれ（R26、pickDesc）。引いた物が関数なら L で、名前の欄と同じく呼べる。ほかの鍵（`k~`・範囲・式）と
// `x @ k` は、何を引いたか決まらないので未知（§2）。`x ' a ' b` の鎖は、左の `x ' a` の desc からもう一度引く。
// 撒く項（`vs~ + 1`）も未知にする。§2 は撒く項を「A（撒く印つき）」とするが、撒いた中身を2項の演算子にどう渡すか
// （要素ごとか、並びとして渡すか）は仕様に無い。結果が撒かれた並びのままなら、適用の実引数の数 k が数えられない
// （2026-10-23 までは逆適用の左にも置けなかった、R12・G9）が、1つの値なら数えられる。読みで木が変わるので、値の段には回せない。
function classifyInfix(term, ctx) {
  if (isBareIndent(term.left)) throw refuseIndentBlock(`中置 \`${term.sym}\` の左`);
  // R84（2026-10-27 の確かめの直し）：長さ 0 と分かる撒いた流れの被演算子（`[]~ + 1`・`_~ + 1`・`e0~ + 1`）は、書いた `_` の被演算子と同じ（`[]~ = _~ = _`。値で A に
  // 数える）。前は並びの項（emptyMark）にだけ当てていて、撒く項の被演算子として未知（`inc ([]~ + 1)` は G7、`inc (_ + 1)` は通る）だった。
  const unitIfEmpty = (x) => (x && x.cat === "plain" && x.desc.spread && (x.count === 0 || isKnownEmpty(x.desc.of)) ? { cat: "unit", desc: U(), view: x.view } : x);
  const l = term.left ? unitIfEmpty(classify(term.left, ctx)) : null;
  if (term.stage === 18) pickSelfReader(l, ctx); // `$v` の輪の中で、仮に通した参照から引く（R73 の残り）
  const key = term.sym === "'" && term.left ? pickKeyOf(term.right) : null;
  if (key) {
    // 鍵は名前として引かない（pickKeyOf の注）。書いたとおりの葉にする。
    if (l.cat === "hole") throw refuseHole(`中置 \`${term.sym}\` の被演算子`);
    // 書いた `_`（と長さ 0 の流れ）を名前で引けば、無い欄なので `_`（R115。`un ' s`・`[] ' s` と同じ）。
    const desc = l.cat === "plain" ? lowerPick(l.desc, key, ctx) || pickDesc(l.desc, key) : l.cat === "unit" ? pickDesc(zeroDesc(), key) : U();
    return { cat: "plain", desc, view: { v: "infix", sym: term.sym, left: l.view, right: rawView(term.right) } };
  }
  const r = term.right ? unitIfEmpty(classify(term.right, ctx)) : null;
  if ((l && l.cat === "hole") || (r && r.cat === "hole")) throw refuseHole(`中置 \`${term.sym}\` の被演算子`);
  const view = { v: "infix", sym: term.sym, left: l ? l.view : null, right: r ? r.view : null };
  if (term.stage === 18) return { cat: "plain", desc: U(), view };
  // 番地の点と差（R62、2026-10-26。§5 Q59 の答え）：被演算子に番地の点か差があれば、点と差の規則で読む（addressOp。答えは点・差か、比べの A）。
  // 関数を指す番地は G7（R53 の外）。被演算子に番地の顔が無ければ今までの読み。
  // 比べの相手では、`0x…` どうしの和を字面と読まない（hexFace、R96）。寄せ1（R128）の前は、関数の本体の `:` の行に隠された名前の点・差の顔も断っていた（shadowFace）。
  const cmp = ADDR_CMP_SYMS.has(term.sym);
  const face = (x, side) => operandFace(x && x.cat === "unit", x && x.cat === "plain" ? x.desc : null, !!x && x.cat === "plain" && hexFace(hexOperand(side, x.view, ctx), cmp));
  // 被演算子の幅と値（R97・R98）：点なら要素の幅、`0x…` の字面（とその和）ならその値（差と読む所の値）、数なら Int と書いた所から分かるか（割る数）。
  const info = (x, side, f) => {
    if (!x || x.cat !== "plain") return null;
    if (f === "pt") return { w: ptWidthOf(x.desc) };
    if (f === "hex") return { lit: hexOperand(side, x.view, ctx) };
    if (f === "num") return { int: intTerm(side, x.view, ctx) === "scalar" };
    return null;
  };
  const lf = face(l, term.left);
  const rf = face(r, term.right);
  const addr = addressOp(term.sym, lf, rf, () => writeTerm(term), [l, r].map((x) => () => showView(x.view)), [info(l, term.left, lf), info(r, term.right, rf)]);
  if (addr) return { cat: "plain", desc: addr, view };
  // R87（2026-10-27、§5 Q73 の答え）：値の演算子（段12〜16・19〜22。算術・比べの `<` など・ビット・範囲）の被演算子も評価する所（R42・R76 と同じ）。そこに丸ごと残った
  // 関数は `_` になり、恒等射でなければ知らせる（`inc + 1` は `(+ (unit inc) 1)` で、`_ + 1`）。`x + sum _` は `(x + sum) _` で、`x + sum` → `x + _` → x（U〔答え〕
  // [2026-10-25 22:11 e20e5341]「x + sum _ = x + sum = x + _ だから x だけが返る…と言いたいな。」）。根拠：主の Claude の傾き「Q73 | 値の演算子の被演算子も評価する所に
  // するか（`inc + 1`） | 広げる。…ただし Q22（値の演算子に関数が来た形）は「今のまま断る」から「`_` にして知らせる」へ変わる」（2026-10-26 11:57 の表の A）に、利用者は
  // 異議を言わなかった（傾きで受けた、R）。被演算子が両方ある中置だけ（区間・点なしの欠けた口は関数を受ける口で、今のまま）。段18 の `'`・`@`（引く器の側）と段4 の `#`
  // は今のまま（§5 Q73 の残り）。番地の点と差の組（上の addressOp）は、関数の被演算子を「関数」と名指しして先に断る。前は被演算子に関数があれば項の種類が未知
  // （根の1項なら通り、2項以上の並びの中なら G7。§5 Q22 の答え「今のまま断る」）。
  const ev = (x, side) => {
    if (!x || x.cat !== "plain" || x.desc.k !== "L" || term.stage === 18) return x;
    reportLeftover({ t: "leaf", view: x.view, kind: x.desc }, ctx, side, "place-op");
    return { cat: "unit", desc: U(), view: { v: "atom", text: `(unit ${showView(x.view)})` } };
  };
  if (l && r) {
    const l2 = ev(l, term.left);
    const r2 = ev(r, term.right);
    if (l2 !== l || r2 !== r) return classifyEvaluated(term, l2, r2);
  }
  // 値の演算子（段12〜16・19〜22）の被演算子の素の関数の裸の仮引数は、その札に覚える（valueOperand・paramTag）。`$` が作った Reader・番地の点と差は、
  // 上の addressOp が先に読むか断る。
  for (const x of [l, r]) if (x && x.cat === "plain") valueOperand(x.desc, term.sym, () => showView(x.view));
  const isA = (x) => x && (x.cat === "unit" || (x.cat === "plain" && x.desc.k === "A" && !x.desc.spread));
  if (!(isA(l) && isA(r))) return { cat: "plain", desc: U(), view };
  // 数どうしの値の演算子の結果は数（SCALAR の注）。段12（範囲）は List を作るので入れない。
  const scalar = SCALAR_INFIX_STAGES.has(term.stage) && isScalar(l.desc) && isScalar(r.desc);
  return { cat: "plain", desc: scalar ? scalarDesc() : A(), view };
}

// R87：被演算子の丸ごとの関数を `_`（評価した印、cat "unit"。葉の綴りは `(unit f)`）に替えた中置の項。ほかの被演算子は今までどおり読む（`_` は値で A に数える）。
function classifyEvaluated(term, l, r) {
  for (const x of [l, r]) if (x.cat === "plain") valueOperand(x.desc, term.sym, () => showView(x.view));
  const view = { v: "infix", sym: term.sym, left: l.view, right: r.view };
  const isA = (x) => x.cat === "unit" || (x.cat === "plain" && x.desc.k === "A" && !x.desc.spread);
  return { cat: "plain", desc: isA(l) && isA(r) ? A() : U(), view };
}

// 後置 `~` の項（§2）。核が「中身が見えて要素が全部 A の器」か「裸の仮引数」か「中身の見えない物」なら撒く印つき
// の A。中身に関数か未知が見えれば、項の数に依らず G7（§5 Q20：中身の関数をその場で解くか値の段で解くか未決）。
//
// 名前の種類が未知のとき（`q : use $inc 5` の `q~`）は、撒く印つきの A にせず未知の葉にする（2項以上の並びで G7）。
// §2 は適用の結果を「中身の見えない物」に数えるが、種類が未知の物は L かもしれず、L の核を撒く形は G7（Q20）で
// ある。どちらの行に当たるか決まらないので、断る側に倒した。中身が見える名前は、種類を見る前に中身を見る
// （`q : [use $inc 5]` の `q~` は、括りの `[use $inc 5]~` と同じく位置に依らず G7）。片イ（R120）から、上の未知の葉は2項以上の並びでも G7 で断らず、種類の未知な項として畳む（foldStep）。
function classifySpread(term, view, ctx) {
  const { core } = term;
  // of：撒いた器の desc（R51 の畳み込みと書き下しが要素の desc を読む）。鍵（internDesc）と形の綴りは今までどおり `A~`。
  // count：撒いた器の中身の数（書いた器の数、writtenLength。数えられなければ null）。口が1つの関数の書き下し（R51、2026-10-25）が、流れの頭が
  // あるか・余りがあるかを見る。数は desc に入れず、葉にだけ付ける（valueCountOf の注と同じ理由：desc に入れると実体の鍵が見ない数が実体を
  // 跨いで分け合われる）。
  // 2026-10-25 の確かめの直しから、文字列を右辺に持つ名前（`st : \`abc\`` の `st~`）と、括った文字列（`[\`abc\`]~`、[x] ≅ x）も文字の数で数える
  // （flowLength。前は字面の `` `abc`~ `` だけを数え、名前と括りは数えられない流れで、字面と答えが割れていた）。
  const spread = (of, count = null) => ({ cat: "plain", desc: { k: "A", spread: true, of }, view, count });
  const countOf = (desc, extra = {}) =>
    flowLength({ t: "leaf", term: { type: "atom", pre: [], core, post: [] }, cat: "plain", desc, kind: desc, view: extra.view || view, count: extra.count ?? null, strCount: extra.strCount ?? null });
  const refuse = () => gate("G7", `\`${writeTerm(term)}\` は中身に関数か種類の未知な物が見える器を撒いています。撒いた中身をどの段で解くかは決まっていません（§5 Q20）。`);
  // 撒く物が `$` の作った Reader（`[$vs]~`・`[$inc]~`・`p : $vs` ⏎ `p~`）：[x] ≅ x と `:` はメタで、`$vs~`・`$inc~` と同じ形なので、R57 と同じく G20
  // （2026-10-25 の確かめの直し。前は `$vs~` が G20 で、括りと名前を通した綴りは撒く項で通った。関数の番地の `[$inc]~` は HEAD から）。
  // 2026-10-28 の片8 の確かめの直しから、言い分を R99 の語（持ち上げ）で言う（refuseDollar の R57 の言い分と同じ。前は「1つの Reader と言い切れません」で、語が遅れていた）。
  const refuseReader = () =>
    gate(
      "G20",
      `\`${writeTerm(term)}\` が撒く物は \`$\` で持ち上げた物（か、それをずらした番地・番地の差。§4 R62）です。[x] ≅ x と \`:\` はメタなので、\`$\` の項に後置の \`~\` を付けた形（\`$vs~\`・\`$inc~\`）と同じで、撒いた形（並び）では持ち上げる物が1つに決まりません（§4 R57・R99）。`
    );
  if (core.c === "lit") return spread(litDesc(core), countOf(litDesc(core)));
  // 書いた `_~`（R84、2026-10-27）：`_~ = _`（`[]~ = _~ = _`）。書いた `[]` を撒いた `[]~` と同じ、長さ 0 の流れ（並びでは emptyMark が書いた `_` の印にする）。
  // 前は表に無い組み合わせで未知（2項以上の並びで G7）。
  if (core.c === "unit") return spread({ k: "A", elements: [] }, 0);
  if (core.c === "abs" || core.c === "norm") {
    const a = enclosureInfo(core, ctx);
    return a.desc.k === "A" ? spread(a.desc, countOf(a.desc)) : { cat: "plain", desc: U(), view };
  }
  if (core.c === "name") {
    const d = lookup(core.name, ctx);
    if (d.k === "L") throw refuse();
    if (readerOf(d)) throw refuseReader();
    if (d.elements && d.elements.some((k) => k !== "A")) throw refuse();
    if (d.k === "U") return { cat: "plain", desc: U(), view };
    // 撒く項の名前をもう一度撒く（`w : vs~` の `w~`）は、どの言葉にも無いので未知（2項以上の並びで G7）。片イ（R120）から並びでも断らず畳む。
    if (d.spread) return { cat: "plain", desc: U(), view };
    return spread(d, countOf(d, { count: valueCountOf(core.name, ctx), strCount: stringCountOf(core.name, ctx) }));
  }
  if (core.c === "bracket") {
    const b = bracketInfo(core, ctx);
    if (readerOf(b.desc)) throw refuseReader();
    if (b.desc.k !== "A" || (b.desc.elements && b.desc.elements.some((k) => k !== "A"))) throw refuse();
    const inner = { ...view, inner: b.trees };
    const s = spread(b.desc, countOf(b.desc, { view: inner }));
    return { ...s, view: inner };
  }
  return { cat: "plain", desc: U(), view };
}
// 撒いた流れの数（R51 の書き下し、classifySpread）：書いた器の数（writtenLength）か、文字列の文字の数（stringLength）。数えられなければ null。
function flowLength(t) {
  const n = writtenLength(t);
  return n !== null ? n : stringLength(t);
}
// 書いた文字列の文字の数：バックスラッシュの無い字面・それを1行で括った物（[x] ≅ x）・文字列を右辺に持つファイルの値の定義の名前（strCount、
// stringCountOf）。ほかは null。
function stringLength(t) {
  if (!t || t.t !== "leaf" || t.cat !== "plain" || !t.term || t.term.type !== "atom" || t.term.pre.length || t.term.post.length) return null;
  const c = t.term.core;
  if (c.c === "lit") return stringCount(c);
  if (c.c === "name") return t.strCount === undefined ? null : t.strCount;
  if (c.c === "bracket" || c.c === "indent") {
    const rows = c.c === "bracket" ? t.view.inner : t.view.rows;
    return rows && rows.length === 1 ? stringLength(rows[0]) : null;
  }
  return null;
}
// 文字列の字面の文字の数（撒いた流れの数、classifySpread）。バックスラッシュのある字面は、エスケープで数が変わりうるので数えない（null）。
// 文字列でなければ null。
function stringCount(core) {
  const t = core.text;
  if (!(t.length >= 2 && t[0] === "`" && t[t.length - 1] === "`")) return null;
  const inner = t.slice(1, -1);
  return /[\\`]/.test(inner) ? null : [...inner].length;
}
// 字面の desc（classify の字面の枝と同じ）。文字列の字面は List（R24）、番地の字面は中身の見えない A、ほかは数。
function litDesc(core) {
  if (core.text.length >= 2 && core.text[0] === "`" && core.text[core.text.length - 1] === "`") {
    return withShape({ s: "list", elem: core.text.length > 2 ? scalarDesc() : null });
  }
  return ADDRESS_LIT.test(core.text) ? A() : scalarDesc();
}

// 括りの種類（§2）。点なしを先に見る（点なしの行は被演算子が欠けているので、並びとしては解けない）。
// delayed は `$[…]` の中身（遅延した式で、行の並びに R52 の判定をしない。resolveDelayed）。
function bracketInfo(core, ctx, delayed = false) {
  if (core.rows.length === 0) return { desc: { k: "A", elements: [] }, trees: [], isQ: false };
  if (core.rows.length === 1) {
    const pf = pointfreeOf(core.rows[0], ctx);
    if (pf) return { desc: pf, trees: [], isQ: false };
  }
  return rowsInfo(core.rows, ctx, delayed);
}

// 字下げのブロック（`?` の本体でない所。構造体や中置の右）。点なしは括りでだけ書けるので見ない。
function blockInfo(core, ctx) {
  return rowsInfo(core.rows, ctx);
}

function rowsInfo(rows, ctx, delayed = false) {
  const scope = blockScope(rows, ctx);
  const inner = scope ? { ...ctx, scope } : ctx;
  const trees = rows.map((r) => (delayed ? resolveDelayed(r, inner) : resolveTree(r, inner)));
  // R113（2026-10-28 の片9b）：構造体（全部の行が `名前 : 値` の欄）の、右辺が書いた `_` だけの欄 `s : _` は書かなかったことと同じ（席を取らない）。`[s : _]` は `[]` と
  // 同じ空の括り、`[a : 1 ⏎ s : _]` は `[a : 1]` と同じ構造体（形・要素・実体の鍵）。木は書いたまま。行の混ざった括り（欄か局所の定義か決まらない行、§5 Q10）は今のまま。
  // 根拠：主の Claude の 2026-10-27 14:50 UTC の文「「どこでも」には構造体の欄の `s : _` も入ると読んで、…`[s : _]` は `[]` と同じ」（R。「違ったら止めて」と書いて片9 に
  // 入れた。利用者は止めていないが、答えではない）。前（R63）は欄に印 zero を付けて席を取っていた（`h : [s] ? $s` ⏎ `h [s : _]` の s は `_` を受けた名前）。
  // 2026-10-28 の片9b の確かめの直し：消す欄は、ファイルと本体の局所の定義と同じく書いた行で見る（erasedFieldRows。右辺が書いた `_` 1つだけ）。前は解いた木の印（isMark）で
  // 見ていて、単位律で `_` に縮む `s : _ , _`・`s : _ _`・`s : _ , !_` の欄も消え、ファイルの `x : _ , _`（定義のまま席を取る）と割れていた（確かめる人の指摘）。
  // 欄の名前は括りの中の名前の範囲（blockScope）からも外す（`[a : s ⏎ s : _]` は `[a : s]` と同じ）。外の局所の名前が見えるようになる所は知らせる（reportErasedField）。
  const erasedF = erasedFieldRows(rows);
  if (erasedF) {
    for (const r of erasedF) reportErasedField(r, rows, erasedF, ctx);
    const kept = trees.filter((t, i) => !erasedF.has(rows[i]));
    if (!kept.length) return { desc: { k: "A", elements: [] }, trees, isQ: false };
    const sh = rowsShape(kept);
    return { desc: sh ? { k: "A", elements: kept.map(elementKind), shape: sh } : { k: "A", elements: kept.map(elementKind) }, trees, isQ: false };
  }
  if (trees.length >= 2) {
    const desc = { k: "A", elements: trees.map(elementKind) };
    const sh = rowsShape(trees);
    if (sh) desc.shape = sh;
    return { desc, trees, isQ: false };
  }
  const root = trees[0];
  // 1行なら、中の行を解いた根の種類（頂が `?` なら L、`:`・`,` なら A、段4〜8 なら被演算子が全部 A のとき A）。
  // 括りは1つの項（`[inc 1 2] inc` の後ろの inc は、括りの値の後ろに積まれる。R47）。形は、1行の `名前 : 値` なら欄1つの構造体、ほかは
  // 中の行の形（長さ1のリストはスカラと同型なので、`[m]` は m の形、`[1 2 3]` は構築の並びの形）。
  const desc = { k: root.kind.k };
  if (root.kind.fn) desc.fn = root.kind.fn;
  // 関数を指す番地の印（R49）は、括り1つでも持ち越す（[x] ≅ x。`[$inc]` は `$inc`）。値を読む参照の印（R60）も同じ（`[$vs]` は `$vs`）。
  if (refOf(root.kind)) desc.ref = root.kind.ref;
  if (liftOf(root.kind)) desc.lift = true; // 先の種類の分からない持ち上げ（2026-10-27 の片8）も同じ（`[$zz]` は `$zz`）
  // 値を読む参照の印は、2026-10-27 の片7 の確かめの直しから、消えた余りのラムダの残り1項（`($vs !_)`）からも持ち越す（valueOfRoot の注。前は落ちて、
  // `($vs !_) + 1` が `$vs + 1` と割れて黙って通った。HEAD から）。
  const vrefRoot = vrefOf(root.kind) || vrefOf(vanishedOne(root) ? descOfTree(root) : null);
  if (vrefRoot) desc.vref = vrefRoot.vref;
  // 番地の算術で作った点・差の印（R62）と、書いた `_` を指す印（R63。`[_]`・`[un]`）も、括り1つなら持ち越す（[x] ≅ x）。
  // 点・差の印は、構築の中の余ったラムダが消えて1項だけ残った物（`(($x + 0x10) !_)`、vanishedOne）からも持ち越す（descOfTree と同じ読み。2026-10-26 の確かめの
  // 指摘：前は落ちて、`(($x + 0x10) !_) + 1` が黙って通った）。
  const addrRoot = addrOf(root.kind) || addrOf(vanishedOne(root) ? descOfTree(root) : null);
  if (addrRoot) desc.addr = addrRoot.addr;
  // 点の幅（R97）も、括り1つなら持ち越す（`($vs) + 0x3` は括らない `$vs + 0x3` と同じ）。
  const marked = vrefRoot || addrRoot;
  if (marked && marked.w) desc.w = marked.w;
  if (isMark(root) || zeroOf(root.kind)) desc.zero = true;
  desc.elements = visibleElements(root) || [elementKind(root)];
  if (desc.k === "A") {
    const sh = rowsShape(trees);
    if (sh) desc.shape = sh;
  }
  return { desc, trees, isQ: root.t === "lambda" && root.kind.k === "L" };
}

// 括りと字下げのブロック（関数の本体と枝の値のブロックでない物、つまり構造体の `名前 :` のブロックと中置の右）の中で `:` の左に1語で置いた名前（P2）。
// 括り（`[sq : z ? z * z ⏎ sq 5]`）の行は、局所の定義か欄か決まっていない（§5 Q10）。ここを未定義の名前（A）と読むと、同じ字面が置き場所で別の木になり、
// 定義した行の隣で「定義されていません」と出る。だから仮引数でもファイルの定義でもなければ、その括りの中で未知に
// する。範囲を括りの中に限るのは、括りの外では欄の名前を裸で読まない（欄は分解して受ける関数で読む）からである。
// 関数の本体（`?` の右の字下げのブロック）と、その中の枝の値のブロック（括りで囲まない、枝の行の下の字下げのブロック）はここを通らない：行は枝か手続きで、
// 何も定義しない（寄せ1 の R128、resolveBlockBody）。
// R113 の構造体の欄（2026-10-28 の片9b と同じ日の確かめの直し）：全部の行が、左が名前1つの `:` の行（構造体の欄）の括り・ブロックで、右辺が書いた `_` 1つだけの欄の行
// （isUnitDefRow。ファイルの定義と同じ綴りの判定）。当たらなければ null。行の混ざった括り（欄か局所の定義か決まらない行、§5 Q10）は今のまま。
function erasedFieldRows(rows) {
  if (!rows || !rows.length || !rows.every((r) => isColonRow(r) && !!singleBareName(r.left))) return null;
  const unit = rows.filter(isUnitDefRow);
  return unit.length ? new Set(unit) : null;
}
// 消した欄の名前が、括りの外の局所の名前（外の括りの欄）と同じなら、括りの中のその名前は外の名前を指すようになるので information で知らせる
// （「外の x が見えてしまう所だけ information」）。仮引数とファイルの定義の名前は、欄が書いた値でも括りの中の名前に数えない
// （scanLocals）ので、消しても見え方は変わらず、知らせない。書いた行ごとに1回。寄せ1（R128）の前は、外の関数の本体の局所の定義の名前と、本体の局所の `x : _`
// （reportErasedShadow）も知らせていた。本体の行は何も定義しないので、本体の分は無くなった（R129）。
// 同じ括りに同じ名前の消えない欄が残っていれば（`[s : _ ⏎ s : 5]`）、括りの中の名前はその欄で、外は見えないので知らせない。
function reportErasedField(row, rows, erased, ctx) {
  const name = singleBareName(row.left);
  if (!ctx.diag || !name || ctx.F.reportedErased.has(row)) return;
  if (rows.some((r) => !erased.has(r) && singleBareName(r.left) === name)) return;
  if (paramInChain(ctx.scope, name) || ctx.F.defs.has(name) || !localInChain(ctx.scope, name)) return;
  ctx.F.reportedErased.add(row);
  pushDiag(ctx, "erased-unit-shadow", name, `構造体の欄 \`${name} : _\` は書かなかったのと同じ（右辺が書いた \`_\` だけの欄は席を取りません）なので、括りの中の \`${name}\` は外の \`${name}\`（外の局所の名前）を指します。外の \`${name}\` を隠すつもりなら、別の名前を使います（§4 R113）。`);
}
function blockScope(rows, ctx) {
  // field は、この範囲の局所の名前を `$` の先で局所の定義と読まない印（R54。括りは器で、行は欄かもしれない。dollarNameTarget の "local-field"、§5 Q10）。
  // 寄せ1（R128）から、局所の名前の範囲はここ（field）だけ。括りの行が外の名前と同じ名前の欄（`[inc : 5 ⏎ $inc]`）は、
  // R54 が括りの行を局所の定義と読まないので、今までどおり外の名前（ファイルの inc）を指す（裸で書いた `[inc : 5 ⏎ inc 3]` と同じ、§5 Q10）。
  const scope = { parent: ctx.scope, params: null, locals: new Set(), hasImport: false, field: true };
  // 構造体の、右辺が書いた `_` だけの欄（R113、erasedFieldRows）は書かなかったことと同じなので、括りの中の名前に数えない（scanLocals が飛ばす）。その名前は使う所で
  // 外の名前か未定義の名前で、undefined-name は知らせない（ファイルの `x : _` と同じ。reportUndefined の erasedNames）。消した欄がある括りは、ほかに局所の名前が無くても
  // 範囲を作る（知らせを抑える印を置くため）。
  const erasedF = erasedFieldRows(rows);
  if (erasedF) {
    scope.erasedRows = erasedF;
    scope.erasedNames = new Set([...erasedF].map((r) => singleBareName(r.left)));
  }
  for (const r of rows) scanLocals(r, scope, ctx.F);
  if (!scope.locals.size && !erasedF) return null;
  // 範囲の鍵（実体の鍵に入る関数の出どころ。lambdaKey の注）。中身は書いた行と外の範囲で決まる。
  scope.key = `${ctx.scope.key}/b{${rows.map(writeTree).join(" ⏎ ")}}`;
  return scope;
}

// 点なしの括り（§2）。返す物は desc、点なしでなければ null。
//
// 種類（§3.4 の行）：
// - pfUnary（`[+ 1]` と前置・後置の点なし `[-_]`・`[!_]` など）・pfGreedyUnary（`[* 2,]` など、と前置・後置の点なしの写像
//   `[-_,]`・`[!_,]`・`[!!_,]`・`[_!,]`。U〔答え〕2026-10-21 10:09「前置・後置の点なしにも , を付けて、[* 2,] と同じ要素ごとの
//   写像と読む。」）。
// - pfFold：畳む2項の点なし（R31）。両側の欠けた中置で、記号が FOLD_SYMS のどれか（`[+]`・`[-]`・`[*]`・`[/]`・`[%]`・`[^]`・
//   `[||]`・`[;;]`・`[&&]`・`[|]`・`[&]`・`[;]`・`[<]`・`[<=]`・`[=]`・`[>=]`・`[>]`・`[==]`）。`[op] x1 … xn` は、`x1 op … op xn`
//   を演算子表の結合の向きどおりに並べた物と同じ（U〔答え〕2026-10-21 09:15）。比べは除く：比べの点なしは積で、`[<]`・`[<=]` は
//   min、`[>]`・`[>=]` は max、`[==]`・`[=]` は全部等しければその値、`_` は単位（R31、2026-11-05 の寄せ4）。種類と実体の鍵は記号に
//   依らないので、ここでは変わらない。前は `[+]` だけが貪欲な2項（pfGreedyBinary）で、
//   ほかはアリティの分からない点なしだった。可変長の口で、並びの終わりで閉じる（fnShape・closeKind）。書いた `_` は markStep。
//   値の後ろでは、ほかの関数と同じく積まれ、後ろの項を受ける（R47。`1 2 [+] 3 4` は `1 2 ([+] 3 4)`。2026-10-23 は逆適用で
//   `1 ([+] 2 3 4)`、その前は R13 の G10）。
// - pfBinary：畳まない2項の点なし（R32）。両側の欠けた中置で、記号が畳まない物（段12〜22 の `[<<]`・`[>>]`・`[']`・`[@]`・範囲の
//   `[~]`・`[~+]` など・`[!=]` と、段1〜9 の `[!==]`・中置の `[#]`）。素の2引数の関数と同じに読む（U〔答え〕2026-10-21 10:52
//   「同じに読んでいいけど、おすすめは出来ないという方向で良いと思う。」）。足りた適用の種類は、値を返す演算なら A、get・set
//   （`'`・`@`・中置の `#`）は何を引いたか・何をしたかが決まらないので未知（root）。「おすすめは出来ない」は断らずに information
//   で見せる（reportNotFolded）。足りた適用の種類と information の形は決定の規則（主の Claude の案）。値の後ろでは、ほかの関数と
//   同じく積まれる（R47）。2026-10-23 は逆適用で主語を取り、口が2つなので主語の口が決まらなかった（§5 Q5、G8）。その前は、点なしなので
//   逆適用の右では G10 だった（R13）。前は段12〜22 の物がアリティの分からない点なし、段1〜9 の物が未知の葉（どちらも Q34）だった。
// - pfUnknownArity：アリティの分からない点なし。`[,]`（U 10-11「[,] ... は、[!__,] と同じ」）だけ。適用の種類は未知。段1〜9 のほかの
//   点なし（`[:]`・`[?]`・片側の欠けた `[| 5]` など）は、今までどおり葉ごと未知（Q19）。
// - pfPick：段18（`'`・`@`）の片側の欠けた点なし（`[' 0]`・`[@ 0]`）。`[' k]` で k が字面の整数か裸の名前なら、`x ' k` と
//   同じ射なので、`[' k] x` の適用は `x ' k` と同じ desc にする（R26、§3.4 の段18 の行）。そのために鍵を fn に持たせる。
//   ほかの形（`[@ 0]`・`[x ']`・鍵が式）は、§2 の `x @ k` と同じく何を引いたか決まらないので未知。A と読むと、
//   `[' 0] fs` が `inc`（L）を引くのに `[' 0] fs inc` が黙って `inc` に関数を渡す。値の後ろでは、ほかの関数と同じく積まれる
//   （`vs [' 0]` は vs の後ろに `[' 0]` が余り、根なら `_`。R47。2026-10-23 は、書いていない左の被演算子の口に主語が入る逆適用で
//   `[' 0] vs` と同じだった）。
function pointfreeOf(row, ctx) {
  const L = (type) => ({ k: "L", fn: { type, pointfree: true } });
  const unaryInfix = (t) => {
    if (!t || t.type !== "seq" || t.terms.length !== 1) return null;
    const term = t.terms[0];
    return term.type === "infix" && term.stage >= 12 && term.stage <= 22 && (term.left === null) !== (term.right === null) ? term : null;
  };
  // 点なしの被演算子は1項に限り、A でなければ（関数や未知なら）点なしとしても未知にする。書いた `_` の被演算子は、中置の
  // 被演算子と同じく印（値）なので A に数える（`[_ +]`、classifyInfix の注）。未知にしても綴りは区間なので、関数の本体の根に
  // 置けば G16 で断る（sectionSpelled。根の未知を通すと、区間を返す本体が黙って通る）。片イ（R125）からは断らず、`_` にして bare-function-return で知らせる（bareReturned・bareReturnUnit）。
  // 値の演算子の点なし（段18 の get を除く区間・前置 `!` を除く前置・後置の点なし・値の記号で畳む点なし・値を返す畳まない点なし）は、印 vop に
  // 記号を持つ：受けた実引数と書いた被演算子が関数を指す番地なら、中置の `$inc + 1` と同じく G7、番地の点・差なら G21（答えに点・差の印を持たせられない
  // ので、中置なら通る `[+ 0x10] $5` も断る。R62、§5 Q66）（R60 の細かい所。argOperand・
  // valueOperand。区間は位置で被演算子を取るので `[+ $5] 1` は `1 + $5`、`[+ 1] $5` は `$5 + 1`）。
  const withOperand = (term, type) => {
    const c = classify(term.left || term.right, ctx);
    if (c.cat === "hole") throw refuseHole(`点なし \`[${writeTerm(term)}]\` の被演算子`);
    if (!(c.cat === "unit" || (c.cat === "plain" && c.desc.k === "A" && !c.desc.spread))) return U();
    if (term.stage === 18) return { k: "L", fn: { type: "pfPick", pointfree: true, sym: term.sym, key: null } };
    if (c.cat === "plain") valueOperand(c.desc, term.sym, () => showView(c.view));
    return { k: "L", fn: { type, pointfree: true, vop: term.sym } };
  };
  // 前置・後置の点なしの印の記号（前置 `!` は否定で、値の演算子ではないので印を付けない。`$` の項の前置 `!` と同じく今のまま）。
  const markVop = (t) => (t.pre.length === 1 && t.pre[0] === "!" ? null : t.pre.length ? t.pre[0] : t.post[0]);
  // 畳む2項の点なし（R31）。記号は値の段（どの演算で畳むか・比較の畳み込みか）のために持つだけで、種類（closeKind）と実体の
  // 鍵（fnKey は型の名前だけ）は記号に依らない（どの記号でも同じ種類になる）。論理の `[|]`・`[&]`・`[;]` は値の演算子ではない（vop なし）。
  const fold = (sym) => ({ k: "L", fn: { type: "pfFold", pointfree: true, sym, vop: LOGIC_FOLD_SYMS.has(sym) ? null : sym } });
  // 畳まない2項の点なし（R32）。root は足りた適用の種類：get・set（段18 の `'`・`@` と、段4 の中置の `#`）は未知、ほかは A。値を返す物（root A）だけが
  // 値の演算子（vop）。
  const binary = (sym, root) => {
    reportNotFolded(row, sym, ctx);
    return { k: "L", fn: { type: "pfBinary", pointfree: true, sym, n: 2, root, vop: root === "A" ? sym : null } };
  };
  // 値の演算子の前置・後置の点なしの項：値の前置の印1つ（`-`・`!`・`!!`）か後置の `!` 1つと、核の書いた `_` だけ（`-_`・`!_`・
  // `!!_`・`_!`）。
  const valueMarkUnit = (t) =>
    !!t && t.type === "atom" && t.core.c === "unit" && t.pre.length + t.post.length === 1 &&
    ((t.pre.length === 1 && VALUE_PREFIX.has(t.pre[0])) || (t.post.length === 1 && t.post[0] === "!"));
  // 点なしの形の項（前置・後置の点なし `!_`・`-_`・`!!_`・`_!` と、段12〜22 の区間 `+ 1`・`<< _`）の後ろに、書いた `_` だけが続く並び（`(!_ _)`・`(-_ _)`・
  // `(+ 1 _)`・`[!_ _ ,]` の `,` の左）は断る（G7）。末尾の `_` を消してから括りの形を見れば点なし（`(!_ _)` は `(!_)` で否定の点なし、§2・R28）、書いた項で
  // 見れば1項でないので点なしの形でなく、中の並びの読み（括らない `!_` は恒等射 R29、ほかは種類の未知な項）になり、読みが割れる（`double (!_ _) 5` は
  // 否定なら double (!5)、恒等射なら 10）。2026-10-26 の確かめの直し（最初の版は中の並びの読みで `(!_ _)` を恒等射にしていた。§5 Q74）。
  // 2026-10-27 の R95 の片：長さ 0 と分かる流れ（`(!_ []~)`・`(!_ e0~)`）も書いた `_` と同じに数える（R84 の `[]~ = _`、isUnitLikeTerm。法則31 を点なしの口に広げて
  // 見つかった。前は書いた `_` の綴りだけを見ていて、`(!_ []~) 7` は恒等射の読みで通り、`(!_ _) 7` は G7 と割れていた）。
  // R108（2026-10-28 の片9、§5 Q74 (c) を閉じた）：`!_` の後ろに書いた `_` だけが続く括り（`(!_ _)`・`[!_ _]`・`(!_ []~)`）は、書いた項どおり読む。括りの形は
  // 1項でないので否定の点なしではなく、中の並び `!_ _` は R28 で `!_` 1つと同じ恒等射（R29。評価する所なら、ほかの恒等射と同じく R42 の余ったラムダ）。否定の区間は裸の `[!_]` だけ。
  // 根拠：主の Claude の問い「Q74 (c)：(!_ _) が否定の点なしなのか、恒等射なのか。」に U〔答え〕[2026-10-27 12:46 58a809c9]「これ、本質的じゃないって理解できてる？」。
  // 読みを書いた項どおりに決めたのは主の Claude の読み（R）。ほかの点なしの形（`(-_ _)`・`(+ 1 _)`・`,` を付けた `[!_ _ ,]`）は今のまま G7。§5 Q74 は閉じたので、
  // 言い分はその残りを受け持つ §5 Q81 を指す（2026-10-28 の確かめの直し。最初の版は閉じた Q74 を指したままだった）。
  // 2026-11-03 の片イ（R119）：段12〜22 の区間の後ろに項が続く並び（`(+ 1 _)`・`(<< _ _)`）は、読む段（parseRow の sectionInSeq）で infix-missing-operand で止めるので、
  // ここに来るのは前置・後置の点なしの形の項（`(-_ _)`・`[!_ _ ,]`）だけになった（pfHead は valueMarkUnit だけ）。
  const negTail = (seq, comma) => !comma && seq.terms[0].type === "atom" && seq.terms[0].pre.length === 1 && seq.terms[0].pre[0] === "!" && !seq.terms[0].post.length;
  const pfHead = valueMarkUnit;
  const refusePfTail = (seq, comma = "") => {
    if (!seq || seq.type !== "seq" || seq.terms.length < 2 || !pfHead(seq.terms[0]) || !seq.terms.slice(1).every((t) => isUnitLikeTerm(t, ctx))) return;
    if (negTail(seq, comma)) return;
    const pf = `[${writeTerm(seq.terms[0])}${comma}]`;
    const flow = seq.terms.slice(1).some((t) => !isUnitTerm(t)) ? "（長さ 0 の流れも同じ、§4 R84・R95）" : "";
    throw gate(
      "G7",
      `1行の括りの中が、点なしの形 \`${pf}\`（§2）の項の後ろに書いた \`_\`${flow || " "}だけが続く並び \`${seq.terms.map(writeTerm).join(" ")}\` です。末尾の \`_\` を消してから括りの形を見れば点なし \`${pf}\`（§4 R28）、書いた項で見れば点なしの形ではなく中の並びの読み（括らない \`!_\` は恒等射 §4 R29、ほかは種類の決まらない項）で、読みが割れます（§5 Q81。\`,\` の無い括りの \`(!_ _)\` だけは書いた項どおり恒等射、§4 R108）。点なしなら \`_\` を書かずに \`${pf}\` と書きます。`
    );
  };
  if (row.type === "op") {
    if (row.sym === "," && row.right === null) refusePfTail(row.left, ",");
    if (row.sym === "," && row.right === null) {
      // 貪欲な単項：`[* 2,]`・`[< 3,]`
      const u = unaryInfix(row.left);
      if (u) return withOperand(u, "pfGreedyUnary");
      // 前置・後置の点なしの写像：`[-_,]`・`[!_,]`・`[!!_,]`・`[_!,]` は `[* 2,]` と同じ要素ごとの写像（U〔答え〕2026-10-21 10:09）。
      // `$`・`@`・`#`・`~` の印には点なしを作らない（U〔答え〕09:21）ので、`[$_,]`・`[@_,]` などは下で未知のまま。
      if (row.left && row.left.type === "seq" && row.left.terms.length === 1 && valueMarkUnit(row.left.terms[0])) {
        return { k: "L", fn: { type: "pfGreedyUnary", pointfree: true, vop: markVop(row.left.terms[0]) } };
      }
      // `[F,]` の写像（R50）：`,` の左が、口が1つ残った関数の項（名前・`@x`・括り・部分適用・合成）なら、`[* 2,]` と
      // 同じ要素ごとの写像。
      const m = mapPointfree(row.left, ctx);
      if (m) return m;
    }
    if (row.left === null || row.right === null) {
      if (row.left === null && row.right === null) {
        // `[|]`・`[&]`・`[;]`・`[==]` は畳む（R31。`[&] a b c` は c、U 2026-10-21 08:50）。`[,]` はアリティの分からない点なし
        // （L、91）。
        if (FOLD_SYMS.has(row.sym)) return fold(row.sym);
        if (row.sym === ",") return L("pfUnknownArity");
        // 畳まない `[!==]`（値を返す）と中置の `[#]`（set）は、素の2引数の関数（R32）。
        if (row.sym === "!==") return binary(row.sym, "A");
        if (row.sym === "#") return binary(row.sym, "U");
      }
      // 段1〜9 のほかの点なしは未知：片側の欠けた `[| 5]`・`[== 3]` など（Q19。1行の括りの `[:]`・`[?]` と片側の欠けた `:`・`?` は、読む段で止める、makeCore・R119）。
      // 前置・後置の印に `,` を付けた、値の演算子でない写像（`[$_,]`・`[@_,]` など）も、ここで未知。
      return U();
    }
    return null;
  }
  refusePfTail(row);
  if (row.terms.length !== 1) return null;
  const t = row.terms[0];
  if (t.type === "infix" && t.stage >= 12 && t.stage <= 22) {
    if (t.left === null && t.right === null) {
      // 畳む記号なら R31。ほか（`[<<]`・`[>>]`・`[']`・`[@]`・範囲・`[!=]`）は素の2引数の関数（R32）で、段18 の get は未知を返す。
      return FOLD_SYMS.has(t.sym) ? fold(t.sym) : binary(t.sym, t.stage === 18 ? "U" : "A");
    }
    if (t.left === null || t.right === null) {
      // `[' 0]`・`[' say]`：鍵は名前として引かない（pickKeyOf の注）ので、被演算子を解かない。
      const key = t.sym === "'" && t.left === null ? pickKeyOf(t.right) : null;
      if (key) return { k: "L", fn: { type: "pfPick", pointfree: true, sym: t.sym, key } };
      return withOperand(t, "pfUnary"); // `[+ 1]`・`[2 *]`・`[@ 0]`（pfPick、鍵なし）
    }
    return null;
  }
  // 前置・後置の点なし。値の演算子（`[-_]`・`[!_]`・`[!!_]`・`[_!]`）だけを L にする。書いた `_` は、
  // 被演算子を書いていない口の印である（前置・後置の印は隣接で位置が決まるので、隣に何かが要る。主の Claude の読み）。
  // 括った `[!_]` は否定の点なしで、恒等射は括らない `!_`（R29。U 2026-10-21 08:24「[!_] は否定の点無しにしないの？ 恒等射なら
  // 括らなくていい。」）。`( … )` も同じ括り（前段は同じ印で渡す）なので `(!_)` も否定の点なし。2行以上の括りの中の `!_` の行
  // （`[!_ ⏎ 1]`）は、ここに来ず、行として恒等射（R29、single）。
  // 同じ日の R30（未定義の名前を被演算子に書く `[-a]`）と、`_` の綴りを断った G14 は廃止した（U〔答え〕08:20）。`[-a]` は
  // R30 の前と同じく、値の印を当てた項の括り（a が未定義なら A で、information は R21 の文面）。
  if (valueMarkUnit(t)) return { k: "L", fn: { type: "pfUnary", pointfree: true, vop: markVop(t) } };
  // `$`・`@`・`#`・`~` の印には点なしを作らない（U〔答え〕2026-10-21 09:21「良いと思う。」。Q33 の答え）。`[$_]` は値 `$_` の括りで A、
  // `[@_]`・`[#_]`・`[_@]`・`[_~]`・`[~_]` は点なしではなく、ふつうの括りの項で、その印の項の読み（前置 `@` は Q9、前置 `~` は
  // Q14、後置 `@`・前置 `#` は Q10、撒く `_~` は classifySpread）に従う。どれも行として解き（rowsInfo）、`$_` のほかは今は未知。
  return null;
}

// R50（2026-10-24）：`[F,]` の F が、要素1つに当てて閉じる関数の項（口が1つ残った関数か、可変長の口だけの関数、takesOne）なら、F を
// 写す貪欲な単項（`[* 2,]` と同じ種類で、写す関数 map を持つ）。
// 根拠：U [2026-10-24 03:39 ebf18260]「…実はね、map は 裏技あるよね。」と `map : f [~t] ? [@f,] t~`。主の Claude の問い「`[F,]` の写像を、
// 区間だけでなく関数の項（`inc`・`@f`・括りの関数）全部に広げる、でいい？」に U〔答え〕[2026-10-24 03:43 ebf18260]「それでいいと思う。」。
// `[f,]` は List の関手を射 f に当てた物（fmap）で、区間だけに限るのは部分を見た制限（主の Claude の読み）。
// 口が2つ以上・口の数が分からない関数（`[add,]`・`[@g,]` で g が素の関数の仮引数・`[gd,]`）・固定の口の後ろに可変長の口がある関数・可変長の口の
// ある合成は今のまま未知（並びの中で G7）。片イ（R120）から並びの中でも断らず、種類の未知な項として畳む。`[@_,]`・`[$_,]`
// （§5 Q33、印の点なし）とは別物：ここの F は口の埋まった関数の項で、`@` の区間ではない。F を解いて門に当たったら、今までどおり未知（前は
// F を解かずに未知にしていた。門を握りつぶすのは、前と同じ答え（未知）を返すため）。ただし `$` の先が関数でない G20（R53）は握りつぶさない：
// 握りつぶすと `[$vs,]` が根で未知のまま通り、書いた `$vs` が黙って残る（`$` は書いた所のどこでも関数だけを運ぶ。2026-10-24）。
function mapPointfree(left, ctx) {
  if (!left || left.type !== "seq" || !left.terms.length) return null;
  let t;
  try {
    t = resolveTree(left, ctx);
  } catch (e) {
    if (isGate(e) && e.gate !== "G20") return null;
    throw e;
  }
  const fn = t && t.kind && t.kind.k === "L" ? t.kind.fn : null;
  if (!fn || !takesOne(fn)) return null;
  return { k: "L", fn: { type: "pfGreedyUnary", pointfree: true, map: fn, envDepth: depthOf(internFn(fn)) } };
}

// `[F,]` の F が、要素1つに当てて閉じるか（R50）：口が1つ残った関数（mouthsOf が 1）か、口が可変長の口だけの関数（前に固定の口が無い）。
// `[F,] a b` は `F a , F b` で、`,` の辺の `F a` は1つの行なので、可変長の口は a 1つを受けて閉じる（行 `F a` と同じ。R24 の最後の括りに1つ、
// R31 の k = 1、R26 の1つ受けた点なし、R29 の k = 1）。最後の仮引数が括りで仮引数が1つの括りの関数（`hd : [y ~ys] ? y` の `[hd,] ws`）とその
// 部分適用（`pq : x [b] ? x + b` の `[(pq 1),] vs`）・畳む2項の点なし（`[[+],] ws`）・段18 の点なし（`[[' 0],] ws`）・貪欲な単項・恒等射。
// 2026-10-24 の試しの確かめで見つかった断りすぎの直し（R50 の出どころの問いは「関数の項（`inc`・`@f`・括りの関数）全部」で、最初の版は
// 可変長の口の関数を口の数の分からない物と一緒に断っていた）。固定の口の後ろに可変長の口がある関数（`nn : a [~c] ? a`。`nn e` は足りない
// 適用）と、可変長の口のある合成は今のまま（未知、並びの中で G7）。片イ（R120）から並びの中でも断らず畳む。
function takesOne(fn) {
  if (mouthsOf(fn) === 1) return true;
  if (!fn || fn.type === "compose") return false;
  if (fn.type === "pfPick") return true;
  const sh = fnShape(fn);
  return !sh.unknown && !!sh.varying && sh.fixed === 0;
}

// 関数の残りの口の数（R50・R51）。数えられるのは、口の数の決まった関数と、その合成（後ろの関数は前の結果で口を1つ埋める）だけ。
// 可変長の口（最後の括り・`[~c]`・畳む点なし・貪欲な単項・恒等射）と、口の数の分からない関数（前置 `@`・`[,]`・既定値のある関数・段18 の
// 点なし）は null。
function mouthsOf(fn) {
  switch (fn && fn.type) {
    case "plain":
      return fn.rest ? null : fn.n;
    case "pfUnary":
    case "norm":
    case "pfPick": // 段18 の点なしは口1つ（R77）
      return 1;
    case "pfBinary":
      return fn.n;
    case "pattern":
      return fn.lastBracket ? null : fn.n;
    case "compose": {
      let total = null;
      for (const f of fn.fns) {
        const m = mouthsOf(f);
        if (m === null || m < 1) return null;
        total = total === null ? m : total + m - 1;
      }
      return total;
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// 行を解く（P3）
// ---------------------------------------------------------------------------

function resolveTree(tree, ctx) {
  if (tree === null) return null;
  if (tree.type === "seq") return resolveSeq(tree.terms, ctx);
  switch (tree.sym) {
    case "?":
      return resolveLambda(tree, ctx);
    case ":":
      return resolveDefine(tree, ctx);
    case ",":
      return resolveProduct(tree, ctx);
    default: {
      // 段4〜8：被演算子が全部 A なら A、そうでなければ未知（§2）。
      if (isBlockSeq(tree.left)) throw refuseIndentBlock(`\`${tree.sym}\` の左`);
      // R76（2026-10-26、§5 Q37 の答え）：比べと論理（段5〜8 の `;`・`|`・`&`・`==`・`!==`）の被演算子の並びは評価する所（evaluatePlace）。被演算子の `,` が
      // 恒等射か書いた `_` で消えて片方の並びだけが残れば、その並びも評価する所（resolveEvaluatedSide。2026-10-28 の片9 の確かめの直し、法則12）。
      // R116（2026-10-28 の片9b、§5 Q73 の `#` の答え）：書き込み `#` の右の被演算子（書き込む値）も評価する所（印 "#r"）。左（書き込む先）は今のまま。
      const l = resolveEvaluatedSide(tree.left, tree.sym, ctx);
      const r = resolveEvaluatedSide(tree.right, tree.sym === "#" ? "#r" : tree.sym, ctx);
      refuseOperandHole(l, tree.sym);
      refuseOperandHole(r, tree.sym);
      // 論理（段5〜7 の `;`・`|`・`&`）の被演算子と、書き込み（段4 の `#`）の被演算子に、番地の算術で作った点・差（R62）があれば断る（2026-10-26 の
      // 確かめの直し。hasAddr の注）：論理の答えは通った側の値で、`#` は置き場に書くので、どちらも点・差の印を持たせられない。`#` の左のずらした点・差は、
      // `@` で開く形（refuseOpenAddress）と同じ理由でも言い切れない（ストアの余モナドの読みでは `@` が extract、`#` が put。§5 Q66）。
      // 値を読む参照（`$vs # 5`・`$vs & 1`）は今のまま。
      if (tree.sym === ";" || tree.sym === "|" || tree.sym === "&") {
        for (const x of [l, r]) if (treeHasAddr(x)) throw refuseAddressDrop("logic", writeTree(tree), { sym: tree.sym, operand: show(x) });
      }
      if (tree.sym === "#") {
        const ld = l ? descOfTree(l) : null;
        if (addrOf(ld)) throw refuseAddressDrop("writeTo", writeTree(tree), { pt: ld.addr === "pt" });
        if (treeHasAddr(l) || treeHasAddr(r)) throw refuseAddressDrop("writeOf", writeTree(tree));
      }
      // 比較（段8 の `==`・`!==`）の被演算子に `$` が作った Reader があれば断っていた（R60 の細かい所、§5 Q59）。論理（`;`・`|`・`&`）と書き込み（`#`、Writer）は今のまま。
      // 素の関数の裸の仮引数なら、その札に覚える（valueOperand・paramTag）。
      // 2026-10-26 の R62 から、番地どうしの比べ（点どうし・差どうし・点と `0x…`）は通り、関数を指す番地は G7、点と差・番地と数は G21（addressOp）。
      if (tree.sym === "==" || tree.sym === "!==") {
        const face = (x) => operandFace(isMark(x), x ? x.kind : null, hexFace(hexTree(x, ctx), true));
        if (!addressOp(tree.sym, face(l), face(r), () => writeTree(tree), [l, r].map((x) => () => show(x)))) {
          for (const x of [l, r]) if (x && x.kind) valueOperand(x.kind, tree.sym, () => show(x));
        }
      }
      return { t: "op", sym: tree.sym, left: l, right: r, kind: l && r && l.kind.k === "A" && r.kind.k === "A" ? A() : U() };
    }
  }
}

// ---- 評価する所を広げる（R76、2026-10-26。§5 Q37 の答え） ----
//
// 評価する所（R42：終わりに残った未評価のラムダが `_` になり、恒等射でなければ warning で知らせる、R48）は、行の根の並びのほかに、次の並び：
// - 比べと論理の被演算子（段5〜8 の `;`・`|`・`&`・`==`・`!==`）。`inc == 5` は `(== (unit inc) 5)`、`inc add 5 == x` の左は `(unit (apply (compose inc add) 5))`、
//   `(inc add 5) == x` の左は被演算子の括りそのものが丸ごとの関数なので `(unit [inc add 5])`（括りの中は評価する所でないので、中身は書いたまま）、`c & inc | double` の
//   inc と double は `_`。
// - 関数の本体が字下げの手続き（枝の行の無い、2行以上のブロック）なら、その各行。手続きは `l1 & … & ln`（途中の `_` で止まる）なので、各行は `&` の被演算子と
//   同じ所（主の Claude の「1. **そこで止まって `__`（おすすめ）**。ブロックは `l1 & l2 & … & ln` と同じになる。」に U〔答え〕[2026-09-28 01:43 9ef332e0]「1」）。
//   最後の行も `&` の右の被演算子なので、1行の `t : a ? a & inc` と同じく `_`。裸のラムダの行（`⇥z ? z + a`）も、括った行（`⇥[z ? z + a]`）と同じく丸ごとの
//   関数（[x] ≅ x）。括らない `!_` だけの行は、`!_ & a` と同じく G7（§5 Q15、refuseProcedureHole）。`:` の行は手続きの本体に無い（`:` の行が1つでもあれば
//   枝のある本体で、寄せ1 の R128・R130）。
// - 本体の返す所（1行だけの字下げの本体・枝の値・枝の後の既定の行）は評価する所にしない。1行の本体の根と同じ所で、丸ごとの関数が残れば G16（R33、
//   resolveBody の返す所）。前の版（同じ日）は返す所も評価する所にしていて、同じ本体が字下げのしかただけで G16 と `_` に割れた（確かめ 2026-10-26）。片イ（R125）から、返す所に残った丸ごとの関数は G16 でなく `_` と bare-function-return の知らせ（bareReturnUnit）。
// 除くのは、`:` の右辺の並び（左が名前1つ。`c1 : inc inc` の c1 は今のまま L、Q50）、`$[…]` の中身の並び（遅延、Q52）、括りの中、関数を値として渡す口
// （`$` の先・関数を受ける口・`[f,]` の f・器の要素）。`,` の被演算子もここでは除き、resolveProduct が読む：辺の2項以上の並びは R121 で評価する所（辺の終わりに
// 余った関数は `_`）、丸ごとの関数1つは R123 で `_`（productOperand。前の版のこの注は、`,` の辺の1項の関数を器の要素として関数を値として持つ所に数えていた。
// `inc , 3` は `(, inc 3)` で、Q20 の `fs~` は中身に関数が見えるので断っていた）。段4 の `#`（書き込み）の被演算子は比べでも
// 論理でもなく、右は書き込む値なので今のまま（§5 Q73 の残り）。値の演算子の被演算子（段12〜16・19〜22。`inc + 1`）は、2026-10-27 の R87（§5 Q73 の答え）から
// 評価する所で、項を作る所（classifyInfix）が読む（前は葉なら未知、2項以上の並びの中なら G7。§5 Q22 の答え「今のまま断る」）。
// `?` の本体の根の並びも評価する所だが、そこに丸ごと関数が残る形（`t : y ? inc`）は今までどおり G16（R33。U〔答え〕[2026-10-21 16:02 e2047fb9]「実際には断る形
// なんだよ。」：関数を返す本体は、警告で通さずに断る、§5 Q21）が先に読む。片イ（R125）から、その形も断らず `(unit inc)` で bare-function-return の知らせ（resolveBody）。
// 根拠：主の Claude の傾き「Q37 | 評価する所を、演算子の辺・本体へ広げるか | 広げる。辺に丸ごと関数が残ったら `_` にして知らせる」に U〔答え〕[2026-10-25 21:56
// c8ccdd69]「他は全部、君の傾き通り。」。同じ日の別のセッションで、主の Claude の「で、聞きたい。「評価する所」を値の演算子の被演算子まで広げる、で行く？」に
// U〔答え〕[2026-10-25 22:11 e20e5341]「x + sum _ = x + sum = x + _ だから x だけが返る…と言いたいな。」（実行時の `_` で口の開いた関数が値の演算子の被演算子に
// 残る形で、値の段の話、§3.7。sum の口 `[x ~xs]` は、その後の参照の口の条件化（R65）で分解が立たずに `_` になる形になった）。前（R42 の読み1）は、評価する所は
// 行の根の並びだけで、被演算子と本体の行に残った丸ごとの関数は L のまま（中置の種類は未知、ブロックの本体の根は未知）だった。
// 印 evaluate の sym は、置かれた所の中置（知らせの言い分を分ける：比べ `==`・`!==` の被演算子には `$` を付けた番地を置けないので、`$` の案内をしない）。
// 評価する所（R76 の比べ・論理の被演算子と、2行以上の手続きの本体の行）の被演算子 side を解く。side が `,` で、恒等射か書いた `_` で消えて片方の並びだけが
// 残れば（R45・R61、vanishedSeq）、残る並びをその評価する所の並びとして解く（行の根と同じ。R107 の既定値の口を埋めるのも、余ったラムダの `_` も、並びを
// そこに書いたときと同じにする。法則12）。残る並びが単位そのもの（恒等射か書いた `_`。`!_ , i`・`_ , !_`）なら、どちらの単位を残すかの規則（R45・R71、
// resolveProduct）があるので、括らない `!_` 1つ（の後ろに `_` だけ）が残る形（G7、loneHole）と同じく、今までどおり `,` として解く。
// 2026-10-28 の片9 の確かめの直し：前は行の根でだけ解き直していて、`gq 1 , !_ == 2` が `(apply gq 1)`、`gq 1 == 2` が既定値を埋めた木と割れていた（余ったラムダの
// `add 1 , !_ == 2` と `add 1 == 2` は HEAD から割れていた）。行の根は、単位になりうる綴り（名前1つも）の残りを `,` として解いてから余ったラムダを包み直す
// （evaluated）が、被演算子には包み直しが無いので、名前1つの残り（`add , !_ == 7`）も、単位そのものでなければ解き直す（unitRest）。
function resolveEvaluatedSide(side, sym, ctx) {
  if (side && side.type !== "seq" && side.sym === "," && sym !== "#" && !isBlockSeq(side.left)) {
    const rest = vanishedSeq(side, ctx);
    if (rest && rest !== side && rest.type === "seq" && !loneHole(rest.terms, ctx) && !unitRest(rest, ctx)) return resolveTree(rest, evaluatePlace(rest, sym, ctx));
  }
  return resolveTree(side, evaluatePlace(side, sym, ctx));
}
// 残る並び rest が `,` の単位そのもの（恒等射か書いた `_`）か。単位になりうる綴り（mayBeUnit）だけを解いて見る（vanishedSeq の idOf と同じ）。解いて断られたら、
// 今までどおり `,` として解く側（そこで同じ断りになる）。
// 2026-10-28 の片9a の確かめの直し（片9b の確かめで見た）：R108 で書いた項どおり恒等射になる括り（`(!_ _)`・`(!_ []~)`、holeGroup）も、単位になりうる綴りに数える。前は綴り
// （mayBeUnit）だけで見ていて、`(!_ _) , !_ == 2` が評価する所の並びとして解き直されて通り、`i , !_ == 2` の G7 と割れていた（resolveProduct は `(!_ _)` を恒等射と
// 認め、恒等射×恒等射は断る側の `!_` に揃える。確かめる人の指摘）。
function unitRest(rest, ctx) {
  if (!mayBeUnit(rest) && !holeGroup(rest, ctx)) return false;
  try {
    return isUnitOperand(resolveTree(rest, ctx));
  } catch (e) {
    if (!(e instanceof OperationError)) throw e;
    return true;
  }
}
// 並び tree が、括らない `!_` の後ろに書いた `_` か長さ 0 の流れだけが続く行1つの括り（`(!_ _)`・`(!_ []~)`。R108 で恒等射）か、それを1行1項で括った物（[x] ≅ x）か。
// `(!_)` は否定の点なし（R29）なので当てない（行が2項以上）。
function holeGroup(tree, ctx, depth = 0) {
  if (!tree || depth > 16 || tree.type !== "seq" || tree.terms.length !== 1 || !isBareBlock(tree.terms[0], "bracket") || tree.terms[0].core.rows.length !== 1) return false;
  const row = tree.terms[0].core.rows[0];
  if (!row || row.type !== "seq") return false;
  return (row.terms.length >= 2 && loneHole(row.terms, ctx)) || holeGroup(row, ctx, depth + 1);
}
// 2026-10-28 の片9b（R116）：書き込み `#` の右の被演算子（sym "#r"）も評価する所。裸の関数を置けば評価されて `_` になり、知らせて `$inc` と書くよう案内する
// （finishTrees の "place-write"）。左（sym "#"、書き込む先）は今のまま。根拠：主の Claude の 2026-10-27 12:51 UTC の表の読み A「書き込む値の所を、評価する所に入れる。
// 裸の inc は食われて `_` になり、知らせて `$inc` と書くよう案内する。box には `_` が入る。」と、問い（12:51 UTC）に U〔答え〕[2026-10-27 12:54 58a809c9]（ボタンの文は
// 主の Claude の物）「A でいい。p # inc の inc は評価する所で _ になって、知らせて $inc を案内する。」。前は書き込む値も評価する所の外で、`p # inc` は `(# p inc)` の未知。
function evaluatePlace(side, sym, ctx) {
  if (!side || side.type !== "seq" || sym === "#") return ctx;
  // 中置の被演算子の括らない `!_` 1つ（`!_ == 1`・`1 & !_`）は、今のまま G7（R44、§5 Q15：中置の被演算子の `!_` を恒等射と読むかは決まっていない。refuseOperandHole）。
  // 評価する所にすると `(unit !_)` になって G7 を素通りする。手続きの行の `!_` は、resolveBody が先に断る（refuseProcedureHole）。
  if (loneHole(side.terms, ctx)) return ctx;
  return { ...ctx, evaluate: { at: side, sym } };
}
const isHoleTerm = (t) => !!t && t.type === "atom" && t.pre.length === 1 && t.pre[0] === "!" && !t.post.length && t.core.c === "unit";
const isUnitTerm = (t) => !!t && t.type === "atom" && !t.pre.length && !t.post.length && t.core.c === "unit";
// 書いた `_` か、長さ 0 と分かる撒いた流れ（R84：`[]~`・`_~`・`e0 : []` の `e0~` など。並びの項では emptyMark が書いた `_` と同じ印にする）の項。綴りで並びの形を
// 見る所（loneHole・点なしの括りの refusePfTail）が、並びの項と同じ数え方をするため（2026-10-27 の R95 の片で、法則31 を点なしの口に広げて見つかった。R95 で恒等射が
// 受ける長さ 0 の流れも書いた `_` と同じになり、綴りだけを見ると `!_ []~ == 1` は評価する所で `(unit !_)`、`!_ _ == 1` は G7 と割れる）。項を作るのと同じ classify で
// 流れの長さを見るので、呼ぶ側は頭の形（`!_`・点なしの形）を先に見てから呼ぶ。
const isUnitLikeTerm = (t, ctx) =>
  isUnitTerm(t) || (!!t && t.type === "atom" && !t.pre.length && t.post.length === 1 && t.post[0] === "~" && isEmptyFlow(leafOf(t, classify(t, ctx))));
// 並びが括らない `!_` 1つか（後ろに書いた `_` しか続かない `!_ _` も：並びの終わりの `_` は消える、R28。2026-10-26 に書き直した R28 から。前は `!_ _` を恒等射の
// 「終わり」で A にしていて、`1 & !_ _` は通り、`1 & !_` は G7 と割れていた）。長さ 0 と分かる流れも書いた `_` と同じに数える（isUnitLikeTerm、R95）。
function loneHole(terms, ctx) {
  if (!terms.length || !isHoleTerm(terms[0])) return false;
  let end = terms.length;
  while (end > 1 && isUnitLikeTerm(terms[end - 1], ctx)) end--;
  return end === 1;
}

// `:`（R3、P3）。関数の本体（と枝の値のブロック）の行の `:` は枝（寄せ1 の R128）で、resolveBranch が読む。ほかの `:` の左は、1項なら解かない（定義・欄・
// 既定値の左はいつも1項で、名前を置く所）。2項以上なら枝の条件として解く（括りの中の行など、器の片）。
// fieldName は左が1語の裸の名前のときの名前で、括りやブロックの行なら構造体の欄の名前になる（rowsShape、R24）。
// 右辺は、左が名前1つの `:`（定義・欄）でも枝でも、ほかの並びと同じく解き、R52 を当てる。名前は右辺を閉じた1つの項として
// 指す（R42 の読み7）：`v : 5 inc` の右辺は `(construct 5 (unit inc))` で v は 5、inc は定義の行で知らせ、`v 3` は `5 3`。右辺が丸ごと
// 関数（`c1 : inc inc`・`a1 : add 1`）は、値の上に積まれていないので今のまま L（`c1 5`・`a1 5` は当たる）。
// 根拠：§5 Q50 で主の Claude は、字面どおり（`v 3` を `5 (inc 3)`）に読むと名前が自分の値を持たない・括ると意味が変わる・使う所ごとに解き
// 直す・得る物が小さいと挙げ、「閉じた1つの項として読む（v は 5、定義の所で inc を知らせる）に傾いてる」と書いた（2026-10-24 09:48 UTC）。
// U〔答え〕[2026-10-24 09:49 ebf18260]「全てその方向で良いと思う。」。2026-10-24 の R52 の最初の版から同じ日のこの片までは、左が名前1つの
// `:` の右辺の並びを R52 の外にしていた（印 pointsTo。U〔答え〕10-22 22:14 のボタンの文「`:` はメタなので、右辺の余ったラムダは `_` に
// しない」から。その文は主の Claude の物で、右辺が丸ごと関数の形について今も残り、値の上に積まれた形は Q50 の答えで上書きされた）。
// 枝の値も同じく当てる（§5 Q51 は、今の答えのまま閉じた）。
function resolveDefine(tree, ctx) {
  let left = null;
  let fieldName = null;
  const oneLeft = !!(tree.left && tree.left.type === "seq" && tree.left.terms.length === 1);
  if (oneLeft) {
    const term = tree.left.terms[0];
    // 名前でない1項（括りの中の行の枝の条件）の中で括りの関数を呼べば、実体が作れないので名指しで断る（F3 の G7、peekUnreadNames。§5 Q85 (j)）。関数の本体の
    // 枝の条件は、寄せ1（R128）から解く（resolveBranch）ので、ここに来ない。
    if (!isNameTarget(term)) {
      const label = peekUnreadNames(ctx, (visitTree, visitTerm) => visitTerm(term), false);
      if (label) {
        throw gate(
          "G7",
          `\`:\` の左の1項 \`${writeTerm(term)}\` の中で括りの関数 \`${label}\` を呼んでいます。1項の \`:\` の左は解かない（P3）ので、ここで呼んでも実体が作れず、本体の読みが決まりません（R25、§5 Q85 (j)）。条件を2項以上で書くか、条件の外で呼びます。`
        );
      }
    }
    // 片イ（R118 の続き）：解かない左にも書いた項（前段の項）を持たせる。1項の枝の条件（`x > 0 : 1`・`(x < 0) : 2`）は木に view の綴りしか無く、値の段（解釈器）が
    // 条件を読めなかった（view の綴りから項を組み直すことになる）。名前の定義・欄の左も同じ節なので、どれも同じに持つ。綴り（show）は view のままで変わらない。
    left = { t: "raw", view: rawView(term), term };
    fieldName = bareName(term);
  } else left = resolveTree(tree.left, ctx);
  // 定義・欄・括りの中の行の右辺は、名前の定義として返す所の外（§5 Q50）。
  const right = resolveTree(tree.right, ctx);
  return { t: "op", sym: ":", left, right, kind: A(), fieldName };
}
// 関数の本体（と枝の値のブロック）の行の `:`：枝（match_case の枝。寄せ1 の R128、U〔答え〕[2026-10-29 12:18:19 32fe4b9c]「ガイドに戻す」、D function_guide.md:89-106）。
// 左が何でも（名前1つでも、それが仮引数・ファイルの定義・未定義の名前でも）枝で、何も定義しない。
// - 条件は `&` の左と同じ式として解く（P3 を変えた。1項でも、名前1つでも。resolveBranchCondition）。名前は普通に引くので、未定義の名前は `_` で undefined-name
//   （information、R21・R111）、条件に残った関数は評価する所の関数で `_`（V4）で、`&` の左に置いた時と同じ知らせ（leftover-lambda）。前（P3）は1項の左を解かず、
//   名前でない1項の中で括りの関数を呼べば G7 で断っていた（§5 Q85 (j)。条件を解くので実体が作れ、閉じた）。
// - 値は本体の返す所（R125。印 bodyRoot は1行の本体の根と同じ、R70）。2026-10-26 の R76 の最初の版は、枝の値を評価する所（丸ごとの関数は `_`）にしていたが、
//   1行の本体の根の G16 と字下げのしかたで割れたので、返す所に直した（確かめ 2026-10-26、§5 Q35）。値が `_` の枝は消えて次の枝へ進む（R129、値の段 V8）が、
//   解決器は値を知らないので木は変えない。返す所に残った裸の関数の `_` は resolveBlockBody が包む（bareReturnUnit）。
// - 値が括りで囲まない字下げのブロック（枝の値のブロック）なら、本体と同じ規則（枝・手続き・R130）で読む（resolveBlockBody。U 2026-09-28「枝の先の入れ子のブロックも
//   同じ」、細目1）。前は構造体のブロックと同じく欄の範囲（blockScope）で読んでいた。notLast は、この枝の値が `_` なら消えて次へ進む所か（resolveBlockBody）。
// fieldName は持たない（枝の左は欄の名前ではない）。呼ぶのは resolveBlockBody だけ（resolveTree の `:` は resolveDefine）。
function resolveBranch(tree, ctx, notLast) {
  const left = resolveBranchCondition(tree, ctx);
  const right = isBlockSeq(tree.right) ? resolveBlockBody(tree.right, ctx, notLast).tree : resolveTree(tree.right, tree.right && tree.right.type === "seq" ? { ...ctx, bodyRoot: true } : ctx);
  return { t: "op", sym: ":", left, right, kind: A() };
}
// 枝の条件を `&` の左と同じに解く（R128、細目3・4。resolveTree の中置の枝の `&` の左の所と同じ：評価する所で解き（resolveEvaluatedSide）、括らない `!_` は G7
// （refuseOperandHole）、番地の算術で作った点・差は G21（refuseAddressDrop の logic））。作るのは新しい断りや知らせではなく、`&` の左の扱いをそのまま当てる。
function resolveBranchCondition(tree, ctx) {
  if (isBlockSeq(tree.left)) throw refuseIndentBlock("`:` の左");
  const l = resolveEvaluatedSide(tree.left, "&", ctx);
  refuseOperandHole(l, "&");
  if (treeHasAddr(l)) throw refuseAddressDrop("logic", writeTree(tree), { sym: "&", operand: show(l) });
  return l;
}
// 字下げの本体の行が `:` の行か（寄せ1 の R128 から、本体の `:` の行は左が何でも枝）。
const isColonRow = (r) => !!r && r.type !== "seq" && r.sym === ":";

// `$[…]` の中身の行を解く（rowsInfo の delayed）。`$` は物にする＝遅延なので、中身は書いた所では評価しない遅延した式で、R52 の判定をしない：
// 値の上に積まれて口の開いたまま閉じた関数も、ラムダのまま書いたとおりに残し、知らせない（`p : $[5 inc]` の中身は `(construct 5 inc)`）。
// 判定は `@` で開いた所でする（開いた所の読みは §5 Q50 の閉じた1つの項。今の解決器では、中身が関数でない `$[5 inc]` の `@p` は開けず、
// 今のまま未知。§5 Q9）。だからその形では、書いた所の判定を外した上に開く所で判定する道も無く、知らせはどこにも出ない（HEAD a70fb89b では
// 定義の行で1つ出ていた。開けない `@p` の所で知らせるかは §5 Q44 の残り。2026-10-24 の確かめの指摘）。
// 根拠：U [2026-10-24 09:46 ebf18260]「Q52は最初からそのつもりだったしその方が良いと考えてたけど…違うなら違うと言って」（問いは
// 「`$[…]` の中身も、式を指すだけと読むか」）。主の Claude「`$` は「物にする＝遅延」なので、`$[…]` を書いた所では中身を評価しない。
// 評価しない所で「余った」と判定するのは筋違いだね。…判定は、`@p` で開いた所ですればいい。」（09:48 UTC）に、U〔答え〕[2026-10-24 09:49
// ebf18260]「全てその方向で良いと思う。」。
// 印 delayed（closeIdle を外す）を付けるのは、行が並びか `,` のときだけで、効くのは行の並びそのものと、`,` が恒等射で消えて残った並び
// （R45：`$[5 inc , !_]` は `$[5 inc]` と同じ。resolveProduct）だけ。中身の項の中（入れ子の括り `$[(5 inc) 3]`・1項を括っただけの
// `$[(5 inc)]`・囲み・`?` の本体 `$[x ? x inc]`・段4〜8 の辺 `$[5 inc == 6]`・消えない `,` の辺）は、ほかの所と同じく R52 を当てる（遅延が
// 中まで及ぶかは訊いていない、§5 Q53。今のまま）。中身の行が段2 の `:`（欄 `$[k : 5 inc]`・枝 `$[5 > 1 : 5 inc]`）なら、印は付けず、右辺は
// ほかの `:` の右辺と同じく当てる（resolveDefine。これも §5 Q53）。枝の値は今のままだが、欄の右辺は R52 の片では印 pointsTo で外だったので、
// §5 Q50 の答えから新しく知らせる（HEAD では黙っていた。2026-10-24 の確かめの指摘）。`$` に別の印の付いた括り（`$[…]~` など、表に無い
// 組み合わせで未知）も今のまま。
// 2026-10-24 の R52 の片では、同じ印を pointsTo の名前で左が名前1つの `:` の右辺に付けていた（§5 Q50 の答えで外した）。
// 同じ日の R53（`$` は関数だけを運ぶ）から、classify は中身の種類が L でなければ G20 で断る。中身が関数なら、中身の並びに値の上に積まれて
// 閉じた関数は残らない（残れば中身は値か未知）ので、この印は通る形の答えを変えない（変異で確かめた、仕様 §7.28 の M8。変わるのは G20 の
// 言い分の「値です」と「種類が決まらない」だけ）。上の「中身の項の中は今のまま当てる」のうち、中身が値の形（`$[(5 inc) 3]`・`$[(5 inc)]`・
// `$[5 inc == 6]`・`$[k : 5 inc]`）は書けなくなり、§5 Q44 の残り その2 は閉じた。中身が関数の `$[…]` の中の項（`$[add (5 inc)]` の `(5 inc)`・
// `$[add ||5 inc||]`・`$[add [k : 5 inc]]`）と `?` の本体（`$[x ? x inc]`）は、今のまま当てて書いた所で知らせる（`$` の無い `[add (5 inc)]` と
// 同じ）。R53 が保証するのは中身の根が関数であることだけなので、遅延が中まで及ぶかの §5 Q53 は狭まって残る（R53 の片では「閉じた」と書き、
// 確かめの指摘で直した。M8 で差が出ないのは、遅延の有無に依らず中身の項の中を当てているから）。`$` に別の印の付いた括りは、確かめの直しから、
// どの読みでも先が関数でない `$[5 inc]~` は G20（classify の `$` の組み合わせの枝）。2026-10-25 の R57 から、後置の印の付いた `$` の項は先に依らず
// G20（`$[inc]~` も。classifyDollar）。
// 同じ日の R59（§5 Q53 の答え）から、中身の項の中（入れ子の括り・囲み・欄・`?` の本体）で余るラムダがあれば、知らせて通すのではなく G20 で断る
// （classifyDollar の受け皿 dead）。中身の並びそのもの（この印が効く所）の値と関数の積み上げは、今までどおり判定せず種類を決めない構築（未知）で、
// R60（値の先も通す）の後も、種類が未知なので G20（`$[5 inc]`）。
function resolveDelayed(row, ctx) {
  if (row && row.type === "seq") return resolveSeq(row.terms, { ...ctx, delayed: true });
  if (row && row.sym === ",") return resolveTree(row, { ...ctx, delayed: true });
  return resolveTree(row, ctx);
}

// 1項の `:` の左が名前（定義・欄の左。公開の `#` 付きも）か。名前でない1項（括りの中の行の `(t [1 2]) : 1`）は枝の
// 条件だが、P3 は2項以上のときだけ枝の条件として解くので、読まない。関数の本体の枝の条件は、寄せ1（R128）から1項でも解く（resolveBranch）。
function isNameTarget(term) {
  return term.type === "atom" && term.core.c === "name" && !term.post.length && (term.pre.length === 0 || (term.pre.length === 1 && /^#+$/.test(term.pre[0])));
}

// 読まない所（名前でない1項の `:` の左＝枝の条件と、既定値。P3）の中で、括りの関数（名前か、括った `?`）を呼んでいれば、その名前（見つからなければ null）。
// R25 の「一度も呼ばれない括りの関数は defer で断らない」は、本体を読まないのが呼ばれていないからである。読まない所から呼ぶと、書いた呼び出しがあるのに
// 実体が作れず、関数は defer になって本体の門が黙って消える（確かめ 2026-10-19 の F3。n_queens.sn の `(conflict col 1 board) : …` がそうだった）。
// 1項の左を条件として解くかは P3 の話で、仕様が決めていないので、ここでは読まずに名指しで断る（G7、断る側）。2026-11-04 の寄せ1（R128、細目3）から、関数の本体
// （と枝の値のブロック）の枝の条件は1項でも `&` の左と同じに解く（resolveBranch）ので実体が作れ、その分（n_queens の形も）はここに来ない。残るのは括りの中の行の
// 1項の `:` の左と既定値（仮引数のブロックの行 `z : pb1 [1]`。2026-11-04 の寄せ2（R131）の前は括りの `[z : pb1 [1]]` も）。
// 片イ（R126）の作る途中の版は、素の関数なら同じ所から呼んでも通るので解決器の遅れと読んで、この G7 を外していた（そこからしか呼ばれない括りの関数は defer の
// まま「走らない」とした）。枝の条件は呼ばれた関数が条件を確かめるたびに、既定値はその口が空のたびに値の段で走るので「走らない」は成り立たず、本体の門
// （`bad : [y] ? [[g5] ? g5] !_ 1` の G5）が黙って消えた（2026-11-03 の片イの確かめの指摘）。外すのは実体を作れるようにしてから（§5 Q85 (j)）。
// 「呼んでいる」は、解かずに字面で見る：括りの関数が2項以上の並びの項にある（適用・合成のどれかになる。値の後ろに積まれて何も受けない形（`5 h`）も、
// 字面では見分けないので断る側に数える）。1項だけ（既定値の行 `z : inc` の inc、`(t)`）は関数を値として書いただけで、`$` で渡すのと同じく実体を作らないので断らない。
// 素の関数は定義の行で本体を読むので、ここには関わらない。
// 覗くのは namesPattern で、輪（§5 Q30）も見る：枝の条件を覗いた所を通る輪は断り（未決、断る側）、既定値を覗いた所を通る輪は輪に数えない（namesPattern の注）。
// 括りの関数を見つけた所で止める（前の G7 を探す所と同じ順）。
// visitTree は並びの木、visitTerm は項を歩く（start に渡す）。inDefault は既定値の中を見ているか（namesPattern）。
function peekUnreadNames(ctx, start, inDefault) {
  let found = null;
  // 入れ子の `?` の仮引数（2026-11-04 の寄せ3、R133：同じ綴りのファイルの定義より内側が勝つ）。前はファイルの定義を引いて、`[bad ? bad 1]` の bad を括りの関数と
  // 読み、内を別の名前にした形が通るのに G7 で断った。
  const bound = [];
  // 項が括りの関数を指せば（裸の名前か、括った `?`。それを1行の括りで包んだ物も）、その名前。2026-11-03 の片イの再確かめの直し：包んだ名前（`([bad] [x]) : 1`・
  // `((bad) [x]) : 1`・既定値の `[bad] [1]`）は、読む所に置けば `bad [x]` と同じく実体を作る（[x] ≅ x）のに、裸の名前だけを見て通り、本体の門が黙って消えた（HEAD から）。
  // 前置 `~` だけの項（`~bad [x]`・`~[bad] [x]`）も同じ（`~x` は書いた `[x]` と同じ項、R79。2026-11-03 の2回目の再確かめ）。入れ子の深さに上限は置かない（undecidedOf の注）。
  const calledName = (x) => {
    const n = bareName(x);
    if (n) return !bound.some((b) => b.has(n)) && namesPattern(n, ctx, inDefault) ? n : null;
    if (!x || x.type !== "atom" || x.post.length) return null;
    if (x.pre.length) return x.pre.every((p) => p === "~") ? calledName({ ...x, pre: [] }) : null;
    const op = unwrapLambda({ type: "seq", terms: [x] });
    if (op) return patternParamsOf(op.left) ? `[${writeTree(op)}]` : null;
    const row = x.core.c === "bracket" && x.core.rows.length === 1 ? x.core.rows[0] : null;
    return row && row.type === "seq" && row.terms.length === 1 ? calledName(row.terms[0]) : null;
  };
  // 2項以上の並びの項のうち、括りの関数を指す物。
  const calledIn = (terms) => {
    for (const x of terms) {
      const n = calledName(x);
      if (n) return n;
    }
    return null;
  };
  const visitTree = (t) => {
    if (found || !t) return;
    if (t.type === "seq") {
      if (t.terms.length >= 2) found = calledIn(t.terms);
      return t.terms.forEach(visitTerm);
    }
    if (t.sym === "?") {
      // 入れ子の関数の本体も読まない所にある。左（仮引数）は名前だけで、本体ではその名前が仮引数を指す。
      bound.push(new Set(parseParams(t.left).names.map((p) => p.name)));
      try {
        visitTree(t.right);
      } finally {
        bound.pop();
      }
      return;
    }
    visitTree(t.left);
    visitTree(t.right);
  };
  const visitTerm = (x) => {
    if (found || !x) return;
    if (x.type === "infix") {
      visitTerm(x.left);
      visitTerm(x.right);
    } else if (x.core.rows) x.core.rows.forEach(visitTree);
  };
  start(visitTree, visitTerm);
  return found;
}
// 関数 op の仮引数の既定値（字下げの仮引数のブロックの `:` の行の右）の中で括りの関数を呼んでいれば、その名前（peekUnreadNames）。既定値の右は全部を見る。
// `?` の左は解かない（P3）ので、1項の `:` の左と同じ理由（R25 の「一度も呼ばれない」に当たらないのに、実体が作れない）で断る。
// 既定値の行の右は、外の範囲に前の仮引数を足した範囲で引く（2026-11-04 の寄せ3、R133。lambdaScopes）。前は外の範囲で引き、ファイルの定義と同じ綴りの仮引数
// （`t :` ⏎ `⇥⇥bad` ⏎ `⇥⇥w : bad 1` の bad）を括りの関数と読んで G7 で断った。後ろの仮引数と自分の名前は見えないので、外の名前として引く。
// 2026-11-04 の寄せ2（R131）から括りの中の既定値は読む段で止まるので、ブロックでない左には既定値が無い。
function peekDefaults(op, ctx) {
  for (const part of lambdaScopes(op)) {
    if (part.body) continue;
    const scope = part.bound.length ? { parent: ctx.scope, params: new Map(part.bound.map((n) => [n, "other"])), locals: new Set(), key: ctx.scope.key } : ctx.scope;
    const found = peekUnreadNames({ ...ctx, scope }, (visitTree) => visitTree(part.tree), true);
    if (found) return found;
  }
  return null;
}
// 名前が括りの関数を指すか（lookup と同じ順に探す。未定義の information は出さない）。inDefault は、既定値の中を覗いて
// いるか（peekDefaults）。
function namesPattern(name, ctx, inDefault) {
  const isPattern = (d) => !!d && d.k === "L" && !!d.fn && d.fn.type === "pattern";
  for (let s = ctx.scope; s; s = s.parent) {
    if (s.descs && s.descs.has(name)) return isPattern(s.descs.get(name));
    if (s.params && s.params.has(name)) return false;
    // 括りと構造体のブロックの行の名前（local-field）は種類が未知なので、括りの関数と言わない。寄せ1（R128）の前は、関数の本体の局所の定義（R80）なら右辺の
    // 種類で見ていた（本体の行は何も定義しなくなった）。
    if (s.locals && s.locals.has(name)) return false;
  }
  const F = ctx.F;
  const def = F.defs.get(name);
  if (!def) return false;
  if (def.lambda) return !!def.pattern;
  const start = F.stack.length;
  const before = F.cycleRefused;
  try {
    return isPattern(nameKindOf(F, def)); // 別名（`p : t`）
  } catch (e) {
    if (!(e instanceof OperationError)) throw e;
    if (e.guard) taint(F); // 守りの断りを握りつぶす：この先の計算は汚れる（taint）
    if (e.reason !== "name-cycle") return false; // 門は、その定義の行を解くときに出る
    // 名前の輪（§5 Q30）。既定値の中を覗いた所を通る輪（輪のいちばん下の枠が、覗く前から解いている途中）は、種類の輪では
    // ない。既定値は解かず（P3）、値の無で呼ばれたときにだけ評価する（§3.7）ので、値はできる（寄せ2 の前の `v : g 1`・`g : x ? [[y : v 2]
    // ? 5] x` は v = 5。R131 から名前の無い関数は既定値を持てないので、今ここに届くのは構造体の欄の仮引数のブロックの関数の既定値
    // （`g : x ? o` ⏎ `o :` ⏎ `⇥m :` ⏎ `⇥⇥⇥y : v 2` ⏎ `⇥⇥? 5`）など。枝の値のブロックの形（`g : x ?` ⏎ `⇥x > 0 :` ⏎ `⇥⇥⇥y : v 2` ⏎ `⇥⇥? 5` ⏎ `⇥0`）は、
    // 2026-11-06 の寄せ5（R134）から読む段で止まる。§5 Q86 はそれを「唯一の綴り」と書いたが、欄の形も届いていた。名前の関数の既定値は、その定義の行（枠が空）でしか覗かない）。覗くのは G7（R25）を探すためだけで、行を解く段（枠が空）で、確定した種類でもう一度覗く。だから
    // 握りつぶして「括りの関数ではない」と読み、作った言い分（F.cycleRefused）も覗く前に戻す。前（2026-10-20 の作り直し）は
    // 投げ直していて、HEAD がどの並べ方でも通していた、値のできるプログラムを name-cycle で断った（確かめ 2026-10-20 の
    // Q30-V1・ADV-1）。
    // 覗いた定義の計算の中だけで閉じる輪（輪のいちばん下の枠が、覗いてから積んだ物）は、覗いた所を通らない本物の輪なので、
    // 投げ直す（`a : g 1`・`g : x ? [[y : v 2] ? 5] x`・`v : h 1`・`h : x ? ⏎ ⇥k x ⏎ ⇥vk ⏎ ⇥inc`・`k : x ? ⏎ ⇥h x ⏎ ⇥inc`・
    // `vk : k 1` の vk → k → h → vk）。前の作り（例外で抜けた枠を輪の依りに持つ記録に印を付けない）で全部を握りつぶすと、a が先
    // なら黙って通った（5040 のうち 1680）。g の本体の無名の関数の綴りは寄せ2（R131）の前の物で、今の試験は名前の関数 `dz` にした形（上の「例外で抜けた枠」の注）。
    // 今は、握りつぶしても後の計算が印から同じ輪をもう一度見つける（確かめ 2026-10-20、
    // 生成器 1 万本で、全部を握りつぶす写しと答え・輪の道筋が同じ）が、見つけた本物の輪を捨てる理由が無いので、断る側に置く。
    // 1項の `:` の左（枝の条件）を覗いた所を通る輪は、投げ直す（断る側。§5 Q30 の未決）。枝の条件も解かない（P3）が、本体を
    // 実行すれば評価するので、値は本当にできない（`v : (g 1) , 1`・`g : x ? ⏎ ⇥(v 2) : 1`）。ただ、覗くのは値の定義の名前だけ
    // なので、関数を1つ挟む（`(f 2) : 1`・`f : x ? v`）と HEAD のまま通る。
    if (inDefault && e.cycleFrom < start) {
      F.cycleRefused = before;
      return false;
    }
    throw e;
  }
}

// `,`（R19・G3）。値だけの並びはそのまま `,` の内に置く。関数か未知を含む2項以上の並びが括らずに直の被演算子に
// なると、`(f x) , …` と `f (x , …)` のどちらかが決まらない（§5 Q3）ので断る。片イ（R121）から断らない：辺の並びも評価する所で左から畳み、辺の終わりに余った関数は `_` と leftover-lambda（sideEval）。
//
// 2項以上の辺は、項の種類を1回だけ付けて G3 を見、付けた項のまま縮める。種類を付けると括りの中まで解けるので、
// G3 を見るためだけに付けて捨て、縮めるときにもう一度付けると、各段に `,` のある括りの入れ子で1段ごとに倍の時間が
// かかる（深さ 20 で数秒）。前置 `@`（L）と括らない `!_`（未知）は、種類が A でないのでここで断られる。片イ（R121）から G3 で断らず、g3 は単位の辺を消すか（R45・R61）・参照の口に読むか（R66・R93）・辺を評価する所にするか（sideEval）を分けるのに使う。
//
// 恒等射（`!_` 1つ・`i : !_` の i。種類が恒等射の葉）は積の単位で、`,` の被演算子にあれば消え、もう片方の被演算子が答え（木も、もう片方の
// 木そのもの）：`!_ , 5`・`5 , !_`・`i , 5` は 5、`1 , !_ , 2` は `1 , 2`、`!_ , !_` は `!_`（R45。U〔答え〕2026-10-22 23:48「5 !_ / 5 , !_
// も追加で、 全部5になるはず…」。恒等射の型 0 ⇒ 0 ≅ 1 は終対象で、1 × A ≅ A・A × 1 ≅ A。書いた `_` が余積の並びから消える 0 ⊕ A ≅ A
// （R15）の双対）。片方が恒等射なら G3 の割れも消える：`inc 1 , !_` は `(inc 1) , !_` と読んでも `inc (1 , !_)` と読んでも `inc 1`
// なので、もう片方の並びをそのまま解く。恒等射かを見るために先に解く被演算子は、恒等射になりうる綴り（`!_`・名前・それだけを括った物・
// その `,`）だけで、解けなければ G3 で断る（前と同じ断り）。片イ（R121）からは、単位で消えなければ辺を評価する所で左から畳む。恒等射を器に残したいなら `$!_`（A）と書く。
//
// 辺が `,` で、その中の `,` が恒等射で消えて並びだけが残るなら（`2 , !_ , inc 1` の右の `!_ , inc 1` は `inc 1`）、G3 はその並びで見る
// （vanishedSeq。単位律で `2 , !_ , inc 1` は `2 , inc 1` で G3。2026-10-24 の確かめで直した。前は中の `,` が消えた後の並びを外の `,` が
// 見直さず、`(, 2 (apply inc 1))` で通していた）。片イ（R121）から G3 は無く、その並びをこの `,` の辺として評価する所で畳む（`2 , inc 1` と同じ、下の sideEval の注）。
//
// 印 ctx.delayed（`$[…]` の中身の行の `,`、resolveDelayed）：`,` が恒等射で消えて並びだけが残れば、その並びは中身の行の並びそのもの（R45）
// なので、遅延した式として R52 の判定をしない（reduceItems の closeIdle を外す）。中の `,` の辺（右結合の `5 inc , !_ , !_` の右）にも印を
// 渡す。消えない `,` の辺と、辺の項の中（括り・中置の辺）は中身の行の並びそのものではないので、印を外して解く（R52 を当てる）。
// 2026-10-24 の R52 の片では、同じ印を pointsTo の名前で左が名前1つの `:` の右辺に付けていた（§5 Q50 の答えで外した、resolveDefine の注）。
//
// R61（2026-10-25、§5 Q41 の答え）：`,` の被演算子に書いた `_` も積の単位で、恒等射と同じく消え、もう片方の被演算子の木が答え（`_ , 5`・`5 , _` は 5、
// `1 , _ , 2` は `1 , 2`。片方が `_` なら G3 の割れも消える：`_ , inc 1` は `inc 1`）。根拠：U [2026-10-25 08:41 533071da]「Q41 / _ , 5 も 5 , _ も 5 に
// なるはずだ。」。主の Claude の読み：Sign は点付きの側（Par）にいて、`_` は零対象（始対象かつ終対象）で、終対象は積の単位なので `_ , 5` ≅ 5（前の
// 「0 × A ≅ 0 で `_`」は点の無い集合の圏の読みで、圏を取り違えていた）。消えるのは書いた `_`（印）だけで、名前や括りを通した `_`（`un : _` の un・
// `[_]`）は今までどおり閉じた1つの項（R56 の R の所と同じ、並びの中の `[_] 5` が `(construct [_] 5)` なのと揃える）。
// 両方とも単位なら（R の所）：両方とも書いた `_`（`_ , _`）は `_`（どちらを残しても同じ葉）。書いた `_` と恒等射（`_ , !_`・`!_ , _`・`_ , i`）は、
// 2026-10-26 の R71（§5 Q61 の答え、U〔答え〕[2026-10-25 21:56 c8ccdd69]「Q61 / _ に落としていい」）から `_` に落とす（書いた `_` の葉が答え。`$[_ , !_]` は
// 零射の番地、R56）。R61 の片では、`_` が消えれば恒等射が残り、恒等射が消えれば `_` が残るので、残る物で答えが割れるとして G7 で断っていた。前（R45 だけ）は
// 恒等射が消えて `_` が残り、今と同じ答え。
//
// R66（2026-10-26、§5 Q3 の答え）：左の被演算子が関数を含む余積の並びでも、その最後の項 x が、括りの関数 F（最後の仮引数が括り）の最後の括りに最初に入る
// 項なら（F の前は値だけ、F の後ろは値だけで、その数が F の残りの口の数）、`F … x , R` は `F … (x , R)`：積で List を組んで、その口に渡す（`f 1 , 2 , 3` は
// `f (1 , 2 , 3)`、`map $inc 1 , 2 , 3` は `map $inc (1 , 2 , 3)`）。木は括って書いた `F … (x , R)` と同じ（productIntoRefPort）。参照の口では余積の並びと積の
// 並びが同じ List になる（双積の点、主の Claude の読み、R）。値の口（`inc 1 , 2`・`f3 1 , 2`）と、最後の括りがもう x の前の項を受けている形（`f 1 2 , 3`。
// `[1 2 3]` か `[[1 2] 3]` かが決まらない）・x が最後の括りでない口に入る形（`pb 1 , 2`）・F の前後に関数か印のある形は、今のまま G3。片イ（R121）から、これらは G3 でなく辺を左から畳む（`f3 1 , 2` は辺の終わりの関数が `_` で、値は 2）。
// 根拠：U [2026-10-25 22:42 c8ccdd69]「f : [x ~xs] ? ... / であれば、 1 , 2 , 3 はリストを組んであげたいね…」、主の Claude の 22:43 の問い「最後の口が参照の口なら
// `f 1 , 2 , 3` は `f (1 , 2 , 3)`、値の口なら今のまま G3、でいい？」に U〔答え〕[22:45]「その方向でお願い。」。09-23 の「`f : x ~xs ? ...` に `f 1, 2, 3` は断る
// べき」は、廃止した裸の `~xs` の話だった（主の Claude の 22:46 の文、R67）。
// R93（2026-10-27、§5 Q68 の答え）：書いた形がそのまま実引数の形で、その形で受けられるかは仮引数の括りの形が決める。最後の括りがもう x の前の項を受けている
// `f 1 2 , 3`（f は `[a b c]`）は、`,` が空白より緩く結ぶ表のとおり `(1 2) , 3` で、`f (1 2 , 3)` の `[[1 2] 3]` を渡す（Q12 の構造は保つ。R19 の `1 2 , 3 4` と同じ木）。
// `[a b c]` は射影で a が `[1 2]`、b が 3、c が `_`（R91）。鏡の `fab 1 , 2 3` は `fab (1 , 2 3)` の `[1 [2 3]]`（括った `fab 1 , (2 3)` と同じ値）。`,` のすぐ左の
// 書いた `_`（`fp _ , 1 , 2`）は積の頭の `_`（R61 で消える）で `fp (1 , 2)`。根拠：U〔答え〕[2026-10-26 23:39 29bed94e]「その読みでいい。書いた形のまま `[[1 2] 3]` を渡し、
// 付けた括りの形（`[a b c]` か `[[a b] c]` か）が受けられるかを決める。次の片に入れて。」（主の Claude の問い「Q68 は「書いた形のまま `[[1 2] 3]` を渡し、括りの形が
// 受けられるかを決める」で合ってる？」へのボタンの答え。ボタンの文は主の Claude の物）。その前の U [2026-10-26 23:35 c8ccdd69]「Q68 / f の 仮引数の受け方によって、
// その形で受けれるかどうかが決まる。」。前（R66）は x が最後の括りに最初に入る形だけで、`f 1 2 , 3`・`fab 1 , 2 3`・`fp _ , 1 , 2` は G3。
// 返す物：括りに入る項の数 m（`,` のすぐ左の m 項を括りの中の左の要素にする）。当たらなければ 0。最後でない括りに入る `pb 1 , 2`・合成の `f inc 1 , 2`・撒く項の
// `f vs~ , 4`・後ろに関数の `f 1 inc , 2`・値の口だけの `f3 1 , 2 , 3` は今のまま G3（§5 Q68 の残り）。片イ（R121）から、これらも G3 でなく辺を評価する所で左から畳む（resolveProduct の sideEval）。
const Q3_PAREN = new WeakMap(); // 書いた `,` の木 → 括って書いた形の項（同じ木を実体ごとに解き直しても、同じ項にする）
function productIntoRefPort(items) {
  let p = -1;
  for (let i = items.length - 1; i >= 0; i--) if (!isMark(items[i]) && items[i].kind && items[i].kind.k !== "A") { p = i; break; }
  if (p < 0) return 0;
  const F = items[p];
  const fn = F.cat === "plain" && F.kind.k === "L" ? F.kind.fn : null;
  if (!fn || fn.type !== "pattern" || !fn.lastBracket) return 0;
  const after = items.slice(p + 1);
  const fixed = fn.n - 1;
  const into = after.slice(fixed);
  if (!items.slice(0, p).every(isValueItem) || !after.slice(0, fixed).every(isValueItem) || !into.length) return 0;
  return into.every((t) => isValueItem(t) || isMark(t)) ? into.length : 0;
}
// （2026-10-26 の確かめの直しから 2026-10-27 まで、R66 の `,` の右の要素に2項以上の余積の並び（`fab 1 , 2 3` の `2 3`）があれば G3 にしていた（rightChainHasSeq：
// 構造を保つ `[1 [2 3]]` と平らな `[1 2 3]` で割れる、§5 Q68）。R93 の答え（書いた形のまま）で `[1 [2 3]]` に決まったので外した。）
function intoRefPort(tree, items, ctx, m = 1) {
  let paren = Q3_PAREN.get(tree);
  if (!paren) {
    const terms = tree.left.terms;
    const row = { type: "op", sym: tree.sym, stage: tree.stage, left: { type: "seq", terms: terms.slice(terms.length - m) }, right: tree.right };
    paren = { type: "atom", pre: [], post: [], core: { c: "bracket", rows: [row], raw: ['"BRACKET_"', [[writeTree(row)]]] } };
    Q3_PAREN.set(tree, paren);
  }
  return [...items.slice(0, -m), leafOf(paren, classify(paren, ctx))];
}
function resolveProduct(tree, ctx) {
  if (isBlockSeq(tree.left)) throw refuseIndentBlock("`,` の左");
  const delayed = !!ctx.delayed;
  const cx = delayed ? { ...ctx, delayed: false } : ctx;
  const sideCtx = (side) => (delayed && side && side.type !== "seq" && side.sym === "," ? ctx : cx);
  const both = [tree.left, tree.right];
  const isMulti = (side) => !!side && side.type === "seq" && side.terms.length >= 2;
  const multi = both.map(isMulti);
  const eff = both.map((side, j) => (multi[j] ? side : vanishedSeq(side, cx)));
  const sides = eff.map((side) => (isMulti(side) ? classifyItems(side.terms, cx) : null));
  const g3 = sides.map((items) => !!items && items.some((c) => c.cat !== "unit" && c.desc.k !== "A"));
  const j = g3.indexOf(true);
  if (j >= 0) {
    const o = 1 - j;
    if (!g3[o] && !multi[o] && mayBeUnit(both[o])) {
      let other = null;
      try {
        other = resolveTree(both[o], cx);
      } catch (e) {
        if (!(e instanceof OperationError)) throw e;
      }
      if (isUnitOperand(other)) return reduceItems(sides[j], cx, false, !delayed);
    }
    // 最後の口が参照の口（R66・R93）：`F … x , R` を `F … (x , R)` と読む。x は最後の括りに入る項の並び（R93 から2項以上・書いた `_` も）、R の要素は書いた形のまま。
    const m = j === 0 && multi[0] && tree.right ? productIntoRefPort(sides[0]) : 0;
    if (m) return reduceItems(intoRefPort(tree, sides[0], cx, m), cx, false, !delayed);
  }
  // 関数か種類の未知な物を含む辺の並びは、評価する所（問4、2026-11-01）：既定値の口だけが開いた部分適用は埋め（R107）、辺の終わりに余った関数は `_`（`f3 1 , 2` は 2）。
  // 辺の中の `,` が単位で消えて残った並び（eff。`7 , !_ , gq 5` の右の `gq 5`）も、この `,` の辺として同じに解く（法則12：`7 , gq 5` と同じ。G3 の頃と同じく、消えた後の
  // 並びに外の `,` が当たる）。前（R121 の片）は書いた辺が2項以上のときだけ評価し、消えて残った並びは中の `,` の答え（評価しない）のまま外に渡っていた（R の所）。
  const sideEval = (k) => (g3[k] ? { at: both[k], sym: "," } : false);
  const left = sides[0] ? reduceItems(sides[0], cx, sideEval(0)) : resolveTree(tree.left, sideCtx(tree.left));
  const right = sides[1] ? reduceItems(sides[1], cx, sideEval(1)) : resolveTree(tree.right, sideCtx(tree.right));
  // 両方とも恒等射（1 × 1 ≅ 1）なら、`!_` の葉を残す（無ければ右）。どちらを残しても恒等射だが、段4〜8 の中置の被演算子では `!_` は
  // G7（§5 Q15）、名前の i は通るので、残す方を並べた順で選ぶと `!_ , i == 1` と `i , !_ == 1` が割れる（確かめで見つかった、2026-10-23）。
  // 断る側の `!_` に揃える。
  if (isIdentity(left) && isIdentity(right)) return left.cat === "hole" ? left : right;
  // 書いた `_` も積の単位（R61）。両方とも `_` なら `_`、片方が恒等射なら `_` に落とす（R71、上の注、§5 Q61 の答え）。
  const lu = isMark(left);
  const ru = isMark(right);
  if (lu && ru) return left;
  if (lu && isIdentity(right)) return left;
  if (ru && isIdentity(left)) return right;
  if (lu || isIdentity(left)) return right;
  if (ru || isIdentity(right)) return left;
  return { t: "op", sym: ",", left: productOperand(left, tree.left, ctx), right: productOperand(right, tree.right, ctx), kind: A() };
}

// R123（戻4）：消えずに残った `,` の被演算子が丸ごと関数（L。恒等射は上で単位として消える）なら、関数に演算子を直接充てた所で、評価して `_`（R87 の値の演算子の
// 被演算子と同じ）。木は `(, (unit inc) 2)`（R87 の `(+ (unit inc) 1)` と同じ形）で、値は `_ , 2` で 2（R61）。恒等射でなければ知らせて `$inc` を案内する。
// 根拠：U [2026-10-30 17:53]「関数に演算子を直接充てることは禁止！」。決まった値は `inc , 2` が 2、`fs : inc , double , 3` の fs が 3（関数を積に入れるのは `$inc`）。
// 「禁止」は解なしの `_` で、断りではない（問2 の線：木は組めて射が無い所）。2項以上の辺の終わりに余った関数は R121（評価する所の辺、`f3 1 , 2`）が先に `_` にする。
// R の所：被演算子が `,` の単位で消える形（`inc , !_`・`_ , inc`。R45・R61 で `,` ごと消えて inc が残る）には当てない：`v : inc , !_` は `v : inc` と同じ（法則12）。
// 消えた後に残った関数が外の `,` の被演算子になれば当てる（`7 , !_ , _ inc` は `7 , _ inc` と同じ `(, 7 (unit inc))`）。種類の未知な被演算子（仮引数の f）は今のまま。
// 書いた所（side）ごとに1回だけ知らせる（括りの関数の実体ごとに読み直しても重ならない、reportLeftover）。
function productOperand(t, side, ctx) {
  if (!t || !t.kind || t.kind.k !== "L" || isIdentityKind(t.kind)) return t;
  reportLeftover(t, ctx, side, "place-product");
  return { t: "unit", inner: t, kind: A() };
}

// `,` の辺 side の中の `,` が恒等射で消えて残る並び（R45）。side が `,` で、片方の辺が恒等射なら、もう片方の辺（それも `,` なら、さらに
// その中）。消えなければ side そのもの。恒等射かを見るのは resolveProduct と同じく、恒等射になりうる綴り（mayBeIdentity）だけ。
// `,` の辺は、両辺が恒等射のときだけ恒等射（1 × 1 ≅ 1。resolveProduct の答えと同じ）なので、`,` を丸ごと解かずに辺ごとに見る：
// 丸ごと解くと、名前の `,` の鎖で1段ごとに残りの鎖を解き直し、深さ 40 で数分かかった（2026-10-24 の確かめの直しの後に見つけた）。
function vanishedSeq(side, ctx) {
  if (!side || side.type === "seq" || side.sym !== ",") return side;
  const idOf = (t) => {
    if (!mayBeUnit(t)) return false;
    if (t.type !== "seq") return idOf(t.left) && idOf(t.right);
    try {
      return isUnitOperand(resolveTree(t, ctx));
    } catch (e) {
      if (!(e instanceof OperationError)) throw e;
      return false;
    }
  };
  if (idOf(side.left)) return vanishedSeq(side.right, ctx);
  if (idOf(side.right)) return vanishedSeq(side.left, ctx);
  return side;
}

// 恒等射の葉（`!_` 1つ・`i : !_` の i・それを括った物。R29・R44・R45）。
function isIdentity(t) {
  return !!t && t.t === "leaf" && !!t.kind && t.kind.k === "L" && !!t.kind.fn && t.kind.fn.type === "id";
}
// `,` の単位の葉（R45・R61）：恒等射か、書いた `_`（印）。
function isUnitOperand(t) {
  return isIdentity(t) || isMark(t);
}
// `,` の単位になりうる綴り（R45・R61）：恒等射になりうる綴り（mayBeIdentity）と、書いた `_` 1つ。それどうしの `,` も。
function mayBeUnit(tree) {
  if (!tree) return false;
  if (tree.type !== "seq") return tree.sym === "," && mayBeUnit(tree.left) && mayBeUnit(tree.right);
  if (tree.terms.length === 1) {
    const t = tree.terms[0];
    if (t.type === "atom" && !t.pre.length && !t.post.length && t.core.c === "unit") return true;
  }
  return mayBeIdentity(tree);
}
// 恒等射になりうる綴り（resolveProduct が、G3 の前に解いて見る物）：`!_`・裸の名前・それだけを1行で括った物・それどうしの `,`。
// 関数を呼ぶ形を含まないので、解いても実体を作らない。片イ（R121）から G3 は無く、辺を評価する所で畳む前に見る。
function mayBeIdentity(tree) {
  if (!tree) return false;
  if (tree.type !== "seq") return tree.sym === "," && mayBeIdentity(tree.left) && mayBeIdentity(tree.right);
  if (tree.terms.length !== 1) return false;
  const t = tree.terms[0];
  if (t.type !== "atom" || t.post.length) return false;
  if (t.pre.length) return t.pre.length === 1 && t.pre[0] === "!" && t.core.c === "unit";
  if (t.core.c === "name") return true;
  return t.core.c === "bracket" && t.core.rows.length === 1 && mayBeIdentity(t.core.rows[0]);
}

// 根の `,` が恒等射で消えて片方の並びだけが残った行（R45）。その行の根は残った並びで、評価する所（R42）なので、並びを根に書いたときと
// 同じく、いちばん上に残った未評価のラムダを `_` にする（`!_ , !_` は `(unit !_)`、`inc add 5 , !_` は `inc add 5` と同じ `(unit …)`）。
// 被演算子は評価する所の外で解いてある（finishTrees の evaluate なし）ので、ここで包み直す：構築ならいちばん後ろの項、ほかは木そのもの。
// 余ったラムダを知らせるのも、行の根に書いたときと同じ（R48）。
function evaluated(tree, ctx) {
  if (!tree || !tree.kind) return tree;
  if (tree.t === "construct") {
    const last = tree.items[tree.items.length - 1];
    if (last.kind.k !== "L") return tree;
    const items = [...tree.items.slice(0, -1), leftoverUnit(last, ctx)];
    return { t: "construct", items, kind: items.some((x) => x.kind.k !== "A") ? U() : A() };
  }
  return tree.kind.k === "L" ? leftoverUnit(tree, ctx) : tree;
}

function isBlockSeq(tree) {
  return !!tree && tree.type === "seq" && tree.terms.length === 1 && isBareIndent(tree.terms[0]);
}

// 関数の範囲。鍵は外の範囲と書いた `?` で決まる（仮引数は書いた綴りで決まる）。
// 実体の範囲は、この鍵を実体の鍵で置き換え、仮引数に当てた desc を持つ（instantiate）。
// 関数の範囲は局所の名前を持たない（locals は空のまま）：2026-11-04 の寄せ1（R128）から、本体の字下げの `:` の行は左が何でも枝で、何も定義しない
// （U〔答え〕[2026-10-29 12:18:19 32fe4b9c]「ガイドに戻す」）。前（2026-10-26 の R80）は本体の行から局所の定義を探し（defRows・scanLocals）、枝の無い本体の
// `x : _` を書かなかったことにしていた（R113 の erasedRowsOf）。本体の `x : _` は今は値が `_` の枝で、消えて次へ進む（R129）。
function makeLambda(op, ctx) {
  const params = parseParams(op.left);
  const scope = {
    parent: ctx.scope,
    params: new Map(params.names.map((p) => [p.name, p.cls])),
    locals: new Set(),
    hasImport: hasImportIn(op.right),
    key: `${ctx.scope.key}/${lambdaKey(op, "")}`,
  };
  // 素の関数なら、裸の仮引数の札（paramTag）のために書いた `?` と位置を持つ（lookup）。
  if (params.plain) {
    scope.plainOp = op;
    scope.plainKey = lambdaKey(op, ctx.scope.key); // 関数の出どころ（fn.idKey と同じ綴り）
    scope.paramIdx = new Map(params.names.map((p, i) => [p.name, i]));
  }
  return { params, scope };
}

// G16（R33、§5 Q21 の答え）：`?` で作る関数の本体の根が裸の関数（L）。関数を返すなら `$` を明示する（U 09-11 23:58「関数を返す
// 関数なら、$は明示というルール」、U 10-21 12:50「adder が返すべきは [+ m] じゃなくて $[+ m]」。U〔答え〕10-21 15:58：書く人が `$` を
// 書く）。カリー化はシステムの側が持つ（U〔答え〕10-21 16:02「実際には断る形なんだよ。 / 理由は、カリー化はシステムの側で持つべき。」）
// ので、入れ子の `?` も断る。警告で通さないのは、裸の関数は書いた行の中でしか生きない（U 09-11 03:47）ので、返した時にはもう無く、
// 本体のコードが作れないから（主の Claude の読み。警告の案に U 10-21 15:59「それって、コンパイラの状態で可能なの？ / 普通に止まると
// 思うんだけど…」）。呼ばれない定義でも断る（本体そのものがコードにできない。公開 `#` すればコンパイルされる）。
// 根は、解き終えた所（解いている途中の種類が無い、F.stack が空）で解いた本体の木の根で見る：名前の定義と無名の `?` は行を解く
// 所（resolveLambda）、括りの関数の実体は木を残す段（materialize）。§3.4 の仮置きの上（根の種類を解く所）では断らない。仮置きの
// 上でだけ L になる根（`h : x ? [s : [+ [k x]]] ' s`・`k : x ? h x` の h は、k の仮置き A の上では引いた区間で L、確定した値の上では
// 未知）で断ると、どの定義から解くかで断るかが割れ、門で未知にした根が外の本体の答えまで変える（「仮置きの記録」の注の単調は、
// 根が A か A でないかだけを見る）。自分を呼ぶ再帰で仮置きが外れた関数は、§3.4 の根は未知だが、解き終えた木の根が L なら断る
// （`f : x ? [y ? f y]`。本体は裸の関数のままで、コードにできない。断る側。実装する人の読み）。
// 種類のほかに綴りも見る：根の綴りが区間（sectionSpelled）なら、種類が未知でも断る。§2 の表は区間を被演算子の種類に依らず L
// （94）にするが、pointfreeOf は被演算子が A でなければ区間の種類を未知にする（当てた結果の読みが §5 Q22 で決まっていないので、
// 並びの中では G7 にする側）。その未知が根では G16 をすり抜けて、区間を返す本体（`ww : x ? [+ [uu x]]`・`q : x ? [+ inc]`。前の
// `h : x ? [+ [k x]]` も）を黙って通していた（確かめ 2026-10-22。直す人の読み）。綴りは仮置きに依らないので、どの定義から解いても同じ。
// what は名指し（「関数 `adder` の」。実体は呼んだ行で instanceError が関数と形を足すので空）。
// 言い分：入れ子の `?`（`add : x ? y ? x + y`）は手で書いたカリー化なので、`$` を勧めず、仮引数を並べる書き方だけを勧める
// （U〔答え〕10-21 16:02「理由は、カリー化はシステムの側で持つべき。 / ユーザーが明示はね…」）。
// `$` で包んだ入れ子の `?`（`add : x ? $[y ? x + y]`）は当たらない：`$[+ m]` と同じく、外の仮引数を掴んだ関数を `$` で物にして返す
// 形で、本体の根は A（U〔答え〕10-21 22:46「通して不都合がないなら通していいよ。」。不都合が無いという見立ては主の Claude の物。
// 前は G17 で断っていた）。
// block（2026-10-26 の確かめの直し）：字下げの本体の返す所（1行だけの手続きの行・枝の値・枝の後の既定の行。resolveBody）に残った裸の関数も、1行の本体の根と
// 同じ（§5 Q35）。
// 片イ（R125、U〔答え〕[2026-10-30 17:58 159479c9]「全部 _」）から断らない：返す所に残った裸の関数・区間の綴りは `_` にした木 `(unit …)` で、恒等射でなければ
// information の bare-function-return で知らせる（前は G16 で断っていた。上の注の「断る」は G16 の頃の言葉で、見分ける所は今も同じ）。本体は括りの関数の実体ごとに
// 読み直すので、書いた所（at）ごとに1回だけ知らせる（reportLeftover と同じ）。区間の未知を「並びの中では G7 にする側」と書いた所も、片イ（R120）から並びの中で断らず、種類の未知な項として畳む。
// goesOn（寄せ1 の R129）：返す所が最後でない枝の値（値が `_` なら消えて次の枝へ進む所、resolveBlockBody）なら、言い分を「この枝は消えて次へ進みます」にする。
function bareReturnUnit(tree, ctx, at, goesOn = false) {
  if (ctx && ctx.diag && ctx.F && !isIdentityKind(tree.kind) && !ctx.F.reportedBare.has(at)) {
    ctx.F.reportedBare.add(at);
    const name = cutShape(show(tree));
    const nested = tree.t === "lambda" || !!tree.isQBracket;
    const advice = nested
      ? "カリー化はシステムの側が持つので、入れ子の `?` で関数を返さずに、仮引数を並べて書きます（`x y ? x + y`。足りない適用は自動で部分適用になります）"
      : "関数を返すなら `$` を付けて持ち上げます（`$[+ m]`、§4 R33）。カリー化はシステムの側が持つので、関数を返す代わりに仮引数を並べて書けば、足りない適用は自動で部分適用になります（`x y ? x + y`）";
    const what = goesOn
      ? `本体の最後でない枝の値に裸の関数 \`${name}\` が残ったので、その値は \`_\` で、この枝は消えて次へ進みます（§4 R125・R129。前は G16 で断っていた）`
      : `本体の返す所に裸の関数 \`${name}\` が残ったので、関数は \`_\` を返します（§4 R125。前は G16 で断っていた）`;
    pushDiag(ctx, "bare-function-return", name, `${what}。${advice}。`);
  }
  return { t: "unit", inner: tree, kind: A() };
}
// 返す所の木 t が、裸の関数か区間の綴りか（R125。前の G16 の見分け）。
const bareReturned = (t) => !!t && (t.kind.k === "L" || sectionSpelled(t));
// 根の綴りが区間（段12〜22 の片側の欠けた点なし `[+ X]`・`[X +]`・`[@ X]` と、貪欲な `[* X,]`。1行の括りに包んだ `[[+ X]]`・
// `([+ X])` も）か。被演算子の種類は見ない（G16 の注）。
function sectionSpelled(tree) {
  return !!tree && tree.t === "leaf" && !!tree.term && sectionTerm(tree.term);
}
function sectionTerm(term) {
  if (!isBareBlock(term, "bracket") || term.core.rows.length !== 1) return false;
  const row = term.core.rows[0];
  const one = (t) => (t && t.type === "seq" && t.terms.length === 1 ? t.terms[0] : null);
  const unary = (x) => !!x && x.type === "infix" && x.stage >= 12 && x.stage <= 22 && (x.left === null) !== (x.right === null);
  if (row.type === "op") return row.sym === "," && row.right === null && unary(one(row.left));
  const x = one(row);
  return unary(x) || sectionTerm(x);
}

// `?`（P3：左は解かず、右を関数の範囲で解く）。片側の欠けた `?` は点なし（unwrapLambda の注）なので、種類は未知。
// 括りの関数は、ここでは本体を解かない（R25）。木は resolve の最後に、集めた実体で埋める（patternNode）。
// 本体の根に残った裸の関数か区間の綴りは、resolveBody が `_` にする（R125。前は G16）。
// 片イ（R118 の続き）：lambda の節は、どれも書いた `?`（前段の項）を op に持つ（括りの関数は pattern.op と同じ物）。値の段（解釈器）が実引数を当てて本体を読む時、
// 仮引数の並びと既定値（`?` の左は解かない、P3）を木から辿るため。前は既定値のある関数（仮引数のブロックの `y : 1` の行。寄せ2（R131）の前は括りの `gf : [y : 1] ? y` も）の仮引数が paramsText の
// 綴りにしか無く（fn も op を持たない、otherFn）、綴りを読み直すしかなかった。綴り（show）は変わらない。
function resolveLambda(op, ctx) {
  if (isSection(op)) {
    return { t: "lambda", op, paramsText: op.left ? writeTree(op.left) : "", body: op.right ? resolveTree(op.right, ctx) : null, kind: U() };
  }
  // 仮引数の裸の `~xs` は、定義の所で断る（R67、G22。呼ばれない定義でも断る：綴りそのものが廃止）。
  const bare = bareRestParam(op.left);
  const label = () => (ctx.F.namedLambdas.has(op) ? `関数 \`${ctx.F.namedLambdas.get(op).name}\` ` : `関数 \`[${cutShape(writeTree(op))}]\` `);
  if (bare) throw refuseBareRest(bare, label());
  // 既定値が書いた `_` の仮引数（`[y : _]`・仮引数のブロックの `y : _` の行）も、定義の所で断る（R114、G22。2026-10-28 の片9b）。
  const unitDefault = unitDefaultParam(op.left, ctx);
  if (unitDefault) throw refuseUnitDefault(unitDefault, label());
  const pattern = patternParamsOf(op.left);
  if (pattern) {
    // 括りの関数の本体は解かない（R25）が、本体の中の G22 と字下げのブロックの位置は定義の所で止める（R119、refuseDeferredSpelling）。
    refuseDeferredSpelling(op, ctx, label());
    return patternNode(op, pattern, ctx);
  }
  // 既定値の中で括りの関数を呼べば、実体が作れないので名指しで断る（F3 と同じ穴の G7、peekDefaults。§5 Q85 (j)）。
  const inDefault = peekDefaults(op, ctx);
  if (inDefault) {
    throw gate(
      "G7",
      `仮引数の既定値の中で括りの関数 \`${inDefault}\` を呼んでいます。\`?\` の左は解かない（P3）ので、ここで呼んでも実体が作れず、本体の読みが決まりません（R25、§5 Q85 (j)）。`
    );
  }
  const lam = makeLambda(op, ctx);
  const named = ctx.F.namedLambdas.has(op);
  // 無名の素の関数は、本体を解く間に引いた仮置きを覚える（collectedRoot の注）。
  const col = lam.params.plain && !named ? beginCollect(ctx.F, `無名の関数 \`[${cutShape(writeTree(op))}]\` の本体`) : null;
  let body;
  try {
    body = resolveBody(op.right, { ...ctx, scope: lam.scope });
  } finally {
    if (col) endCollect(ctx.F, col);
  }
  let fn = otherFn(op.left);
  if (lam.params.plain) {
    fn = {
      type: "plain",
      origin: "plain",
      n: lam.params.names.length,
      getBodyRoot: named
        ? () => bodyRootOf(ctx.F, op)
        : collectedRoot(ctx.F, col, body.rootKind, () => resolveBody(op.right, { ...ctx, scope: lam.scope, diag: null }).rootKind),
      idKey: lambdaKey(op, ctx.scope.key),
      envDepth: envDepth(ctx.scope), // 鍵の深さ（fnDepth）
      op, // 裸の仮引数の札（paramTag）と、Reader を口に渡した呼び出しの言い分（readerAtPlain）
      label: named ? ctx.F.namedLambdas.get(op).name : null, // 無名なら書いた綴り（断るときだけ作る、readerAtPlain）
    };
    plainInstantiable(ctx.F, fn, op, ctx.scope);
  }
  return { t: "lambda", op, paramsText: op.left ? writeTree(op.left) : "", body: body.tree, kind: { k: "L", fn } };
}

// R119（2026-11-03 の片イ）：括りの関数の本体は呼ばれるまで解かない（R25）ので、本体の中の G22（R67 の裸の `~xs`・R114 の既定値の `_`）と字下げのブロックの位置（§2）は、
// 呼ばれた所で実体の断りになるか、呼ばれなければ黙って通っていた（`bad : [y] ? [a9 ~z9 ? a9] 1` は `bad [1]` で初めて断る）。素の関数は定義の行で断るので、括りの関数も
// 定義の行で止める（問2 の答え、parseRow の注。定義の所へ移すのは R .85）。本体は解かずに、綴りと、仮引数と局所の名前だけを置いた範囲（makeLambda・blockScope。既定値の名前の読み
// unitLikeDefault が引く）で見る。見る所は解く所（resolveTree・classifyItems・classifyInfix・resolveProduct）と同じ：`?` の左と、定義・欄・既定値の `:` の左は解かない所（P3）なので見ない。
// owner は外の関数の名指し（resolveLambda の label）。実体の範囲（仮引数に当てた desc）では見ないので、既定値が `_` と分かる値か（§5 Q84）の読みは、仮引数の名前を
// 仮引数として見る（実体の範囲と同じく当てない）。
// 2026-11-04 の寄せ1：関数の本体（と枝の値のブロック）の `:` の行は枝（R128）で、左は1項でも使う所なので見る。枝のある本体の最後でない裸の行（R130）も、素の関数の
// 本体（resolveBlockBody）と同じく定義の行で止める（visitBody。R119 と同じ線で、呼ばれない括りの関数でも止める）。
function refuseDeferredSpelling(op, ctx, owner) {
  const visitBody = (right, cx) => {
    if (!isBlockSeq(right)) return visitTree(right, cx);
    const rows = right.terms[0].core.rows;
    if (rows.some(isColonRow)) refuseBareRowBetween(rows);
    for (const row of rows) {
      if (!isColonRow(row)) visitTree(row, cx);
      else {
        visitTree(row.left, cx);
        visitBody(row.right, cx);
      }
    }
  };
  const visitTree = (t, cx) => {
    if (!t) return;
    if (t.type === "seq") {
      if (t.terms.length >= 2 && t.terms.some(isBareIndent)) throw refuseIndentBlock(`${owner}の本体の余積の並びの項`);
      return t.terms.forEach((term) => visitTerm(term, cx));
    }
    if (t.sym === "?") {
      if (isSection(t)) return visitTree(t.right, cx);
      const label = `${owner}の本体の関数 \`[${cutShape(writeTree(t))}]\` `;
      const bare = bareRestParam(t.left);
      if (bare) throw refuseBareRest(bare, label);
      const unitDefault = unitDefaultParam(t.left, cx);
      if (unitDefault) throw refuseUnitDefault(unitDefault, label);
      return visitBody(t.right, { ...cx, scope: makeLambda(t, cx).scope });
    }
    if (t.sym === ":") {
      if (!(t.left && t.left.type === "seq" && t.left.terms.length === 1)) visitTree(t.left, cx);
      return visitTree(t.right, cx);
    }
    if (isBlockSeq(t.left)) throw refuseIndentBlock(`${owner}の本体の \`${t.sym}\` の左`);
    visitTree(t.left, cx);
    visitTree(t.right, cx);
  };
  const visitTerm = (term, cx) => {
    if (!term) return;
    if (term.type === "infix") {
      if (isBareIndent(term.left)) throw refuseIndentBlock(`${owner}の本体の中置 \`${term.sym}\` の左`);
      visitTerm(term.left, cx);
      visitTerm(term.right, cx);
    } else if (term.core.rows) {
      const scope = blockScope(term.core.rows, cx);
      term.core.rows.forEach((r) => visitTree(r, scope ? { ...cx, scope } : cx));
    }
  };
  visitBody(op.right, { ...ctx, scope: makeLambda(op, ctx).scope });
}

// 括りの関数の `?` の木。名前の定義なら名前で、`?` の括りなら書いた綴りで名指しする（呼んだ行で断るときの言い分）。
// 本体の中の名前は読まないので、未定義でも information を出さない（R25：読まない本体）。
function patternNode(op, pattern, ctx) {
  const def = ctx.F.namedLambdas.get(op);
  const label = def ? def.name : `[${writeTree(op)}]`;
  const fn = patternFn(ctx.F, op, pattern, ctx.scope, label);
  const body = op.right;
  const deferText =
    body && body.type === "seq" && body.terms.length === 1 && isBareBlock(body.terms[0], "indent")
      ? body.terms[0].core.rows.map(writeTree).join(" ⏎ ")
      : writeTree(body);
  const node = { t: "lambda", op, paramsText: writeTree(op.left), pattern: { op, scopeKey: ctx.scope.key, deferText, insts: null }, kind: { k: "L", fn } };
  ctx.F.patternNodes.push(node);
  // `$` の先を解いている所（受け皿 ctx.dead、R59）で書いた括りの関数（`$[[x] ? f2 (5 inc) 1]`）は、仮引数を含まない行の余る関数を拾う（deadInPatternBody。
  // 覗くのは木を残す段だけ、deadOfDef の注）。
  if (ctx.dead && !ctx.F.stack.length) {
    const dead = deadInPatternBody(ctx.F, op, ctx.scope);
    if (dead) ctx.dead.push(dead);
  }
  return node;
}

// 関数の本体を解く。返す物は {tree, rootKind}。字下げのブロックの本体は、全部の行（枝なら値の側）の根が A の
// ときだけ A（§3.4）。本体の根（字下げの本体なら返す所：1行だけの手続きの行・枝の値・枝の後の既定の行）に裸の関数か区間の綴りが残れば `_`（R125、
// bareReturnUnit。前は G16）。
function resolveBody(right, ctx) {
  // 字下げの本体は resolveBlockBody（分けておくのは、本体を解く入れ子が深い鎖でこの関数の枠を小さく保つため。素の関数を挟む 300 個の鎖が JS のスタックの
  // 内に収まる、確かめ 2026-10-26）。
  if (right && right.type === "seq" && right.terms.length === 1 && isBareBlock(right.terms[0], "indent")) return resolveBlockBody(right, ctx);
  // 本体の根の並びには印 bodyRoot を付ける（空の流れの余ったラムダを閉じてよい所、R70、closeEmpty）。根が中置・`,`・`:` なら付けない。
  const resolved = resolveTree(right, right && right.type === "seq" ? { ...ctx, bodyRoot: true } : ctx);
  const tree = bareReturned(resolved) ? bareReturnUnit(resolved, ctx, right) : resolved;
  refuseReturnedAddress([tree]);
  return { tree, rootKind: tree ? tree.kind.k : "U" };
}
// 字下げの本体（2026-10-26 の R76 と、同じ日の確かめの直し。§5 Q35・Q37）と枝の値のブロック（寄せ1、細目1）：`:` の行（枝、R128）があれば match_case、
// 無ければ手続き（`l1 & … & ln`、evaluatePlace の注）。
// - 返す所：1行だけの手続きの行（本体の根そのもの）・枝の値（resolveBranch）・枝の後の既定の行（最後の行が `:` の行でない）。1行の本体の
//   根と同じく解き（印 bodyRoot、R70）、丸ごとの関数か区間の綴りが残れば、1行の本体の根と同じく `_`（R125、bareReturnUnit。前は G16 で、U〔答え〕
//   [2026-10-21 16:02 e2047fb9]「実際には断る形なんだよ。」は U〔答え〕[2026-10-30 17:58 159479c9]「全部 _」で上書きされた）。
//   前の版（同じ日の R76）は、返す所も評価する所にしていて、`adder2 : m ?` ⏎ `⇥[+ m]` が `_` で通り、1行の `adder2 : m ? [+ m]` の G16 と割れた。
// - 2行以上の手続きの行：評価する所（R76、evaluatePlace）。裸のラムダの行（`⇥z ? z + a`）は、括った行（`⇥[z ? z + a]`）と同じく
//   丸ごとの関数で `_`（[x] ≅ x。前の版は括った行だけ `_` で、裸の行は L のまま残った）。括らない `!_` だけの行は G7（refuseProcedureHole）。
// - 枝のある本体の、最後の行でない裸の行（枝の前・枝の間・最後の枝の後の2つ目からの既定の行）は、読む段で名指しして止める（R130、refuseBareRowBetween）。
//   前（R76）は評価する所として通し、値の段が「まだ」（枝の間に置いた既定の行）で止めていた。
// 2026-11-04 の寄せ1（R128）から、`:` の行は左が何でも枝で、本体の行は何も定義しない。前（2026-10-26 の R80）は左が名前1つの `:` の行を局所の定義と読み
// （isQualifiedDef）、手続きの行にも枝の行にも数えなかった（法則27）。
// notLast は、このブロックが最後でない枝の値（値が `_` なら消えて次の枝へ進む所、R129）か。返す所の bare-function-return の言い分を分ける。
function resolveBlockBody(right, ctx, notLast = false) {
  const src = right.terms[0].core.rows;
  const branched = src.some(isColonRow);
  if (branched) refuseBareRowBetween(src);
  const returnsAt = (i) => !isColonRow(src[i]) && (branched ? i === src.length - 1 : src.length === 1);
  // 返す所の値が `_` なら消えて次の枝へ進むか（R129）：最後でない枝の値と、最後でない枝の値のブロックの中の返す所。
  const goesOn = (i) => notLast || (isColonRow(src[i]) && i !== src.length - 1);
  const resolvedRows = src.map((r, i) => {
    if (isColonRow(r)) return resolveBranch(r, ctx, goesOn(i));
    if (returnsAt(i)) return resolveTree(r, r && r.type === "seq" ? { ...ctx, bodyRoot: true } : ctx);
    if (r && r.type === "seq" && loneHole(r.terms, ctx)) throw refuseProcedureHole();
    // 行が `,` で、恒等射か書いた `_` で消えて片方の並びだけが残れば、その並びも評価する所（resolveEvaluatedSide、2026-10-28 の片9 の確かめの直し）。
    const t = r && r.type !== "seq" && r.sym === "," ? resolveEvaluatedSide(r, "row", ctx) : resolveTree(r, r && r.type === "seq" ? evaluatePlace(r, "row", ctx) : ctx);
    // 行の `,` が恒等射どうしで括らない `!_` 1つに縮んだ（`!_ , !_`・`i , !_`・`!_ , i`。resolveProduct が断る側の `!_` に揃える）なら、`!_` だけの行と同じ G7（中置 `&` の
    // 被演算子の `!_` と同じ所。`!_ , !_ & a` は refuseOperandHole の G7）。2026-10-28 の片9a の確かめの直し（片9b の確かめで見た）：前は `(block !_ a)` で黙って通っていた
    // （HEAD からの穴。手続きの行の法則12 が X = `!_` で割れていた）。
    if (r && r.type !== "seq" && r.sym === "," && t && t.t === "leaf" && t.cat === "hole") throw refuseProcedureHole();
    return r && r.type !== "seq" && r.sym === "?" && t && t.kind.k === "L" ? leftoverUnit(t, ctx, r, "place") : t;
  });
  // 返す所（枝の値・返す行）に残った裸の関数・区間の綴りは `_`（R125）。最後でない枝の値なら、その枝は消えて次へ進む（R129）。
  const rows = resolvedRows.map((t, i) => {
    if (isColonRow(src[i])) return bareReturned(t.right) ? { ...t, right: bareReturnUnit(t.right, ctx, src[i], goesOn(i)) } : t;
    return returnsAt(i) && bareReturned(t) ? bareReturnUnit(t, ctx, src[i], goesOn(i)) : t;
  });
  refuseReturnedAddress(rows);
  const k = blockBodyKind(rows);
  const term = right.terms[0];
  return { tree: { t: "leaf", term, cat: "plain", desc: { k }, kind: { k }, view: { v: "block", rows } }, rootKind: k };
}
// R130（寄せ1）：枝のある本体（と枝の値のブロック）で、裸の行（`:` の行でない行）を置けるのは最後の1行（既定の行）だけ。枝の前か間の裸の行と、2つ目からの
// 既定の行は、読む段で名指しして止める（最初に当たった裸の行の行を持たせる、R127）。値の段に回すと、手続きの行（`l1 & … & ln`）と枝（`(c1 & v1) | …`）の
// どちらで読むかが決まらない。根拠：戻7（2026-11-01、09-28 の match_case §5 と問2「ファイルごと止める」）と、寄せ1 の文面の R130（U〔答え〕2026-11-04「入って」）。
// 前は評価する所として通し、値の段が「まだ」（枝の間に置いた既定の行）で止めていた。
function refuseBareRowBetween(src) {
  const at = src.findIndex((r, i) => i < src.length - 1 && !isColonRow(r));
  if (at < 0) return;
  const row = src[at];
  const where = src.slice(at + 1).some(isColonRow) ? "枝の前か間" : "最後の枝の後（既定の行が2つ以上）";
  const e = shapeError(
    "body-bare-row-between",
    `枝（\`:\` の行）のある本体の、${where}に裸の行 \`${cutShape(writeTree(row))}\` があります。枝のある本体で裸の行を置けるのは、最後の1行（既定の行）だけです（§4 R130）。手続きの行と枝の行を混ぜた本体は、どちらで読むかが決まらないので、読む段で止めます。`,
    "§4 R130"
  );
  throw withLine(e, row && typeof row === "object" ? rowTreeLine.get(row) : undefined);
}

// 関数の本体が返しうる値（根。字下げの本体なら全部の行の値の側：枝の値・行そのもの。入れ子のブロックはその行）に、番地の算術で作った
// 点・差（R62）があれば断る（2026-10-26 の確かめの直し、hasAddr の注）。関数の答えは本体の根の種類だけで持つ（素の関数の getBodyRoot・括りの関数の
// instRootOf は "A"/"U"）ので、印を答えに持たせられない。HEAD（2026-10-26）は中の算術を G7 で断っていた。
// 2026-10-26 の R80 から寄せ1（R128）までは、関数の本体の局所の定義の行（isQualifiedDef）を見なかった（局所の名前が右辺の desc を持った）。本体の行は今は何も
// 定義しないので、`:` の行は全部、枝の値を見る。
function refuseReturnedAddress(rows) {
  const valueSide = (t) => (t && t.t === "op" && t.sym === ":" ? t.right : t);
  for (const row of rows) {
    const v = valueSide(row);
    if (v && v.t === "leaf" && v.view && v.view.v === "block") {
      refuseReturnedAddress(v.view.rows);
      continue;
    }
    if (treeHasAddr(v)) throw refuseAddressDrop("return", cutShape(show(v)));
  }
}

// 字下げの本体の種類：全部の行の値の側（枝の値・行そのもの。入れ子のブロックはその行）が A のときだけ A（§3.4）。行が1つも無ければ未知。
// 2026-10-26 の R80 から寄せ1（R128）までは、局所の定義の行（isQualifiedDef）を本体の値の行に数えず（法則27）、今のまま断る所の左が名前1つの行を A に数えなかった。
// 本体の `:` の行は今は全部枝なので、値の側で数える。
function blockBodyKind(rows) {
  const valueKind = (t) => {
    if (!t) return "U";
    if (t.t === "leaf" && t.view.v === "block") return blockBodyKind(t.view.rows);
    return t.kind.k;
  };
  const rowKind = (row) => valueKind(row && row.t === "op" && row.sym === ":" ? row.right : row);
  return rows.length && rows.every((r) => rowKind(r) === "A") ? "A" : "U";
}

// ---------------------------------------------------------------------------
// 余積の並びを解く（§3.3 の手順、R40〜R43・R47・R48）：並びを左から1項ずつ畳む
// ---------------------------------------------------------------------------
//
// 余積は1つの演算子で、左結合（R40）。並びは左から1項ずつ畳み、溜まった物は積み上げで、次の項はいちばん上の項とだけ結ぶ。
// 畳み込みの1歩は3行（R47、2026-10-24）：
// - いちばん上 L・次 A：適用。口を1つ埋める。全部埋まれば、本体の根の種類になる
// - いちばん上 L・次 L：合成。後から来る物は、最初の関数から順に流れ込む
// - いちばん上 A か空：次の項を積む（次が A なら構築。次が L も積み、積まれた L は、その後に来る項を右から受ける。関数は右からだけ受ける）
// 可変長の口（最後の括り `[~c]`、畳む点なし、`[* 2,]` など）は並びの終わりまで受け、1つ以上受けていれば終わりで閉じる（R41）。
// 評価する所（`:` の右辺でない行の根の並び）で、終わりに未評価のラムダが残れば `_` になり、並びの中では消える（R42・R15）。そのとき
// 恒等射でなければ warning で知らせる（R48、reportLeftover）。評価する所の外でも（`:` の右辺も。除くのは `$[…]` の中身の並びだけ）、終わりに
// 値の上に積まれて口の開いたまま閉じた関数が残れば、同じく `_` で、知らせる（R52、2026-10-24。受けた後の関数・穴の関数も、手順7）。
// 書いた `_` と `!_` は、口を1つ埋める所で読む（R43）。
// 根拠：U [2026-10-23 13:12 ebf18260]「いやこれ、むしろ2引数を断るなら逆適用の意味が余計に薄い上に構文が乱れる元だから、廃止だね。
// 逆適用は廃止しよう」。主の Claude の問い「A の後の L は積む（関数は右からだけ受ける）。根でラムダが余って `_` になったら診断で知らせる。
// これでいい？」に、U〔答え〕[2026-10-23 15:32 ebf18260]「合ってる。 それでOK！」。左結合そのものは U 2026-10-22 11:24 ebf18260「…余積は
// 左結合で解決できるはずだと睨んでた。」と、規則の文面へのボタン「作り直す」（U〔答え〕10-22 22:15）。
// 2026-10-23 までの4行目は「いちばん上 A・次 L：逆適用。L が、いちばん上の A を取る」で、主の Claude の問い「左結合なら、`5 inc 3` は
// `(inc 5) 3`（値は [6 3]）でいい？」への U〔答え〕10-22 11:24「そう、合ってる。」は、逆適用がある前提の答えだった。R47 で上書きされ、
// `5 inc 3` は `5 (inc 3)`。
// 前（2026-10-22 まで）は、強さの順（合成 > 適用 > 逆適用、R6）で対を探して縮め、一度まとめた並びを後でほどき直していた（take・
// leftover・流れの組み立て直し・restAt）。どれも、強さの順で先にまとめた物を、左からの読みに戻すための仕組みだった。

function leafOf(term, c) {
  return {
    t: "leaf",
    term,
    cat: c.cat,
    desc: c.desc,
    kind: c.desc,
    view: c.view,
    isLambdaName: !!c.isLambdaName,
    isQBracket: !!c.isQBracket,
    count: c.count === undefined ? null : c.count,
    strCount: c.strCount === undefined ? null : c.strCount,
    ...(c.undecided ? { undecided: c.undecided } : {}), // 名前の読みが決まらない理由（片イ、R120 の例外。undecidedWhy）
  };
}

// 評価する所（R42）は、resolve が行の根の並びに付けた印 ctx.evaluate と、R76 で広げた所（比べ・論理の被演算子・2行以上の手続きの本体の行。evaluatePlace）。
// 項の中（括り・囲み・値の演算子の中置）は評価する所でないので、
// 印を外してから項を作る。
// 印 ctx.delayed は、`$[…]` の中身の行の並び（resolveDelayed）。そこだけは遅延した式なので、値の上に積まれて口の開いたまま閉じた関数を
// ラムダのまま残す（R52 の判定をしない、§5 Q52 の答え）。項の中は中身の行の並びそのものではないので、これも外してから項を作る。
// 印 ctx.bodyRoot は、関数の本体の根の並び（resolveBody。字下げの本体の行は付けない）。空の流れの余ったラムダ（R70、closeEmpty）だけが読む。
// 項の中は本体の根の並びそのものではないので、これも外してから項を作る。
function resolveSeq(terms, ctx) {
  // 印 evaluate は、行の根なら true、R76 で広げた評価する所（比べ・論理の被演算子・手続きの行）なら書いた所 {at, sym}（知らせを書いた所ごとに1回にする、finishTrees）。
  const evaluate = ctx.evaluate || false;
  const delayed = !!ctx.delayed;
  const bodyRoot = !!ctx.bodyRoot;
  const inner = evaluate || delayed || bodyRoot ? { ...ctx, evaluate: false, delayed: false, bodyRoot: false } : ctx;
  return reduceItems(classifyItems(terms, inner), inner, evaluate, !delayed, bodyRoot);
}

// 0. 項を作る。字下げのブロックは並びの項にならない（§2、refuseIndentBlock の注）。
// R84（2026-10-27、§5 Q69 の答え）：長さが 0 と分かる撒いた流れ（`[]~`・`e : []` の `e~`・書いた `_~`）は、書いた `_` と同じ印の葉にする（emptyMark）。
// `[]~ = _~ = _`（U〔答え〕[2026-10-26 11:35 c8ccdd69]「…[]~ = _~ = _ / [] = _ / をきちんと念頭に」）：展開は List から並びへのモノイド準同型なので、単位を単位へ
// 送る（主の Claude の読み、R）。印になった後は、着いた口で読む（R83）：値の口は穴（R16・R38）か消える（R28）、既定値のある口は既定値（R39）、括りの受ける並びの中は
// 消える（R15）。元の流れは emptyFrom に持ち、括りの関数の最後の括りが流れ1つだけを丸ごと受ける所（R64 の `f []~` は `f []`）でだけ元の流れで読む（markStep）。
// 点なしの可変長の口（`[* 2,]`・`[+]`・恒等射）は 2026-10-27 の R95 から書いた `_` と同じ（前は R51 の丸ごと）。
// 前（R51・R70）は流れの1項で、口2つの `add []~` は畳み込みの `_`、口1つの `inc []~` は後ろに何も続かない所だけ余ったラムダの `_`、ほかは G19 だった。
// R94（2026-10-27、§5 Q75 (a) の答え）：書いた `[]` と、中身が連結の単位で詰まって `[]` になる書いた括り（isWrittenEmptyTerm）の葉には、印 writtenEmpty（番号）を
// 付ける。器の葉のまま畳み、値の口に着いた所でだけ、同じ位置に書いた `_` と同じに読み直す（reduceItems・WrittenEmptyAtValue）。
let writtenEmptySeq = 0;
function classifyItems(terms, ctx) {
  if (terms.length >= 2 && terms.some(isBareIndent)) throw refuseIndentBlock("余積の並びの項");
  return terms.map((t) => {
    const leaf = emptyMark(leafOf(t, classify(t, ctx)));
    if (leaf.cat !== "plain") return leaf;
    if (isWrittenEmptyTerm(t, ctx)) return { ...leaf, writtenEmpty: ++writtenEmptySeq };
    // R112（2026-10-28 の片9b）：書いた時点で `_` と分かる名前と括り（isKnownUnitItem）も、値の口に着いたら同じ位置に書いた `_` と同じに読む（書いた `[]` と同じ印
    // writtenEmpty で、値の口の所でだけ読み直す。R94 と同じ道）。未定義の名前（undefinedLikeName）は、評価する所で値の隣に着いた所でも読み直す（rootUnit、foldStep）。
    if (isKnownUnitItem(t, leaf)) return { ...leaf, writtenEmpty: ++writtenEmptySeq, knownUnit: true, ...(undefinedLikeName(t, ctx) ? { rootUnit: true } : {}) };
    return leaf;
  });
}
// R112（2026-10-28 の片9b）：書いた時点で `_` と分かる名前と括り（desc が印 zero か空の括り：未定義の名前（R111）・`e0 : []` の e0・`q : [_]` の q・`e8 : ~[]` の e8・
// `e6 : ~_` の e6・R61・R71 で `_` に縮む `(_ , _)`・`(_ , !_)`・それを括った物と前置 `~` で持ち上げた物（R79）・括りの関数の実体で `_` を受けた名前・R91 の足りない射影の
// 名前）は、値の口（素の関数の口・括りの関数の裸の口・点なしの口・既定値のある関数の口・穴の関数の穴の口、valuePortOf）に着いたら、同じ位置に書いた `_` と同じに
// 読む：値の口なら単位律で消え（R105）、既定値のある口なら既定値（R39）。値の口でない所（値の隣・括りの口・`,` の被演算子・中置の被演算子）の答えは変えない（参照の口は
// R90・R65 のまま、空の器として席を取る）。木の段が書いた時点で `_` と知っている所なので、計算の `_` の §5 Q79 の外。
// 根拠：主の Claude の問い「10-14 の (1) は R83 で置き換わったと読んで、`(inc un) 5` は 6 にしていい？」（2026-10-27 15:06 UTC）に U〔答え〕[2026-10-27 15:21 58a809c9]
// （ボタンの文は主の Claude の物。前半の「10-14 の (1) は R83 で置き換わったと読む。」は主の Claude が 15:49 UTC に取り下げた）の後半「…値の口では un も未定義の名前も
// 書いた _ と同じ形で、(inc un) 5 は 6。参照の口は R90 のまま。片9 に入れて。」と、U〔答え〕[15:59]（ボタンの文は主の Claude の物）「…書いた・名前・計算の _ は値の口で
// どれも同じ。穴は !_ だけ。…」。前（R94 の片）は名前と名前を括った物を当てず、`inc un 5` は `(construct (apply inc un) 5)`、`inc [_] 5` は `(apply inc 5)` で割れていた
// （§5 Q75 (e)）。
function isKnownUnitItem(t, leaf) {
  if (!t || t.type !== "atom" || t.post.length) return false;
  if (t.pre.length && !(t.pre.length === 1 && t.pre[0] === "~")) return false;
  if (t.core.c !== "name" && t.core.c !== "bracket") return false;
  const d = leaf.desc;
  return !!zeroOf(d) || isEmptyBracket(d);
}
// R112 の根の読み：項 t が、取り込みの無い範囲の未定義の名前（R111。書かなかったことにした `x : _` の x も、R113）か、右辺がそれ1つの名前（`w : no` の w。`:` はメタ。
// ファイルの値の定義。寄せ1（R128）の前は関数の本体の局所の定義も）か、右辺が単位律で書いた `_` に縮む名前（`v : _ , !_`、aliasOfUndefined）か。評価する所（行の根と R76 の所）で値の隣（積み上げが空か、いちばん上が値）に着いたら、同じ位置に書いた `_` と同じに
// 読む（`no 5` は `_ 5` と同じ 5）。定義のある名前（`e0 : []`・`q : [_]`）は右辺の綴り（`[] 5`・`[_] 5`）と同じく、値の隣では読み直さない（R94 の線）。
// 根拠：この片の決定の文（主の Claude の指示）の「根の `no 5` は `_ 5` と同じ」。評価する所に限ったのは作る側の読み（R）：括りの中・`:` の右辺・本体の根の並びで読み直すと、
// 書いた括りの中身の数が変わり、括りの口が行の残りを1つの List で受ける読み（R64：`fq no 1 2` は `fq [no 1 2]`）と、参照の口の未定義の名前が席を取る読み（R90）が割れる。
// 評価する所の外は今のまま（§5 Q83）。
function undefinedLikeName(t, ctx, depth = 0) {
  if (!t || depth > 16 || t.type !== "atom" || t.pre.length || t.post.length || t.core.c !== "name") return false;
  const name = t.core.name;
  let imported = false;
  for (let s = ctx.scope; s; s = s.parent) {
    if ((s.descs && s.descs.has(name)) || (s.params && s.params.has(name))) return false;
    // 括りと構造体のブロックの行の名前（local-field）は、欄か局所の定義か決まっていない（§5 Q10）ので当てない。寄せ1（R128）の前は、関数の本体の局所の定義（R80）なら
    // 右辺の木で見ていた。
    if (s.locals && s.locals.has(name)) return false;
    if (s.hasImport) imported = true;
  }
  const def = ctx.F.defs.get(name);
  if (def) return !def.lambda && aliasOfUndefined(ctx.F.defRoots.get(def), { F: ctx.F, scope: ctx.F.fileScope }, depth);
  return !imported;
}
// 右辺の木が書いた `_` の印（単位律で `_` に縮む `_ , !_`・`_ , _`・`_ _`。R61・R71・R15）の名前も、右辺が `_` そのものなので同じに読む（法則12 の `v : _ , !_` と
// `v : _` が同じ答え。`v : _` は R113 で書かなかったことと同じで未定義の名前）。括り（`[_]`・`(_ , _)`）は R94 の線で当てない。
const aliasOfUndefined = (root, ctx, depth) => !!root && (isMark(root) || (root.t === "leaf" && !!root.term && undefinedLikeName(root.term, ctx, depth + 1)));
// R94：書いた `[]` と、中身が連結の単位で詰まって `[]` になる書いた括り。List の中の書いた `_` は連結の単位で消える（U〔答え〕[2026-10-26 11:35 c8ccdd69]「…[]~ = _~ = _
// / [] = _ / をきちんと念頭に」）ので、`[_]`・`[_ _]` は `[]`。要素1つの括りは中身と同じ（[x] ≅ x）ので、`[[]]`・`[[_]]`・`([])` も `[]`。前置 `~` は書いた `[x]` と
// 同じ項（R79・R88）なので、`~_`・`~[]` も `[]`。名前（`e0 : []` の e0・`un : _` の un）と名前を括った物（`[e0]`）は当てない：名前を通した `_` は R63 の「`_` と分かる値」
// のまま（§5 Q75 (e)）→ 2026-10-28 の片9b の R112 で、名前と名前を括った物も値の口では同じ印で読み直す（isKnownUnitItem。§5 Q75 (e) の値の口の所を閉じた）。
// 行の中の `[] 5` の `[]` のような要素は消さない（`[[] 5]` は2要素のまま。値の口でない所の答えは変えない）。
// 括りの中の長さ 0 と分かる流れ（`[]~`・`_~`・`e0~` など）も、書いた `_` と同じに消える（R84 の `[]~ = _~ = _`、isUnitLikeTerm）ので、`[_~]`・`[[]~]`・`([]~)` も `[]`
// （2026-10-27 の片6 の確かめの直し。最初の版は書いた `_` だけを消し、`inc [_~]` が器の A で `inc [_]` の `(unit inc)` と割れていた。片5 までは同じ答えだった）。
function isWrittenEmptyTerm(t, ctx, depth = 0) {
  if (!t || t.type !== "atom" || t.post.length || depth > 64) return false;
  if (t.pre.length === 1 && t.pre[0] === "~") return t.core.c === "unit" || isWrittenEmptyCore(t.core, ctx, depth);
  return !t.pre.length && isWrittenEmptyCore(t.core, ctx, depth);
}
function isWrittenEmptyCore(core, ctx, depth) {
  if (!core || core.c !== "bracket") return false;
  if (!core.rows.length) return true;
  if (core.rows.length !== 1) return false;
  const row = core.rows[0];
  if (!row || row.type !== "seq") return false;
  const rest = row.terms.filter((u) => !isUnitLikeTerm(u, ctx));
  return rest.length === 0 || (rest.length === 1 && isWrittenEmptyTerm(rest[0], ctx, depth + 1));
}
// 長さが 0 と分かる撒いた流れの葉を、書いた `_` と同じ印（cat "unit"）にする（R84）。長さの分からない流れは今のまま流れの1項。
// 長さは、書いた数（flowCount）か、撒いた器の desc が長さ 0 と分かる物（isEmptyFlowOf）。
function emptyMark(leaf) {
  if (!isEmptyFlow(leaf)) return leaf;
  return { ...leaf, cat: "unit", desc: U(), kind: U(), count: null, emptyFrom: leaf };
}
const isEmptyFlow = (leaf) => isSpreadNode(leaf) && (flowCount(leaf) === 0 || isKnownEmpty(leaf.desc.of));
// 長さ 0（`_`）と書いた時点で分かる器の desc（撒けば長さ 0 の流れ、R84。頭の名前がある括りに来れば分解が立たない、R90）：空の括り（書いた `[]`・`e0 : []` の e0・
// 括りの関数の実体で `[]` を受けた仮引数）、書いた `_` と分かる値（印 zero、R63・R91：`un : _` の un・`[_]`・`~_`・足りない射影の名前。`_~ = _`）、書いた時点で長さ 0 と
// 分かる List・文字列（len、R91・bindBracket の残りの名前）。
// 2026-10-27 の確かめの直し：最初の版は R84 が空の括りだけを、R90 が空の括りと印 zero だけを見て、`[_]~`・`un~`・`fat : [a b c] ? inc c~ 5` ⏎ `fat 1 2` の `c~`・
// `g : [x ~xs] ? inc xs~` ⏎ `g [1]` の `xs~` が数えられない流れのまま（G2(a) か未知）、`fe ``` が R91 の長さ 0 の実体で、`[]~`・`e0~`・`fe []` と割れていた。
function isKnownEmpty(d) {
  return isEmptyBracket(d) || !!zeroOf(d) || (!!d && d.k === "A" && !d.spread && d.len === 0);
}

// R94（2026-10-27、§5 Q75 (a) の答え）：書いた `[]`（と、中身が詰まって `[]` になる書いた括り。印 writtenEmpty、classifyItems）が値の口に着いたら、同じ位置に書いた
// `_` と同じに読む。値の口かは畳み込みの段（いちばん上の関数の今の口）で決まるので、1回目は器の葉のまま畳み、値の口に着いた所（foldStep の valuePortOf と、手順2 の
// 穴の規則が組んだ口の emptyArgsAtValue）で WrittenEmptyAtValue を投げる。その葉を書いた並び（いちばん外の、その葉を項に持つ reduceItems）が受けて、葉を書いた `_` の
// 印（writtenEmptyMark）に替え、並びを初めから読み直す。手順2 の穴の規則（R34）も畳み込みの印の読み（R28・R39・R43・R105）も、書いた `_` と同じに当たる。
// 1回の読み直しで印が1つ以上減るので、読み直しは項の数で止まる。知らせは出す所ごとに1回（reportUndefined などの印）なので、読み直しても重ならない。
// 2026-10-27 の片6 の確かめの直しから 2026-10-28 までは、書いた `_` の後ろに葉が続く所は、葉の着く口を先に数えていた（markStep の writtenEmptyAhead）。R105 で
// 値の口の `_` は消えて口を使わないので、葉は畳み込みの1歩が着いた口で読み直せばよく、先回りは外した。
// 根拠：主の Claude の問い1（値の口に書いた `[]`、`inc []`・`map inc []`）「`[] = _` と読めば穴になる。でも 10-04 の「自明に TypeError で良い」とも読めるので、今は G5 で
// 断っている（Q75 (a)）。」（2026-10-27 02:35 UTC）に、U〔答え〕[2026-10-27 09:25 df447414]「1. _ と読んで断らない方向で問題無ければどうぞ」。前（R85）は G5 で断っていた。
// 葉は1つ（畳み込みの1歩・手順2 の穴の規則で着いた葉）。いくつかまとめて読み直す形（writtenEmptyAhead）は 2026-10-28 に外した。
class WrittenEmptyAtValue extends Error {
  constructor(ids) {
    super("R94: written [] at a value port");
    this.writtenEmptyIds = [].concat(ids);
  }
}
const reduceOwners = []; // 読み直す印を持つ項の並びのうち、いま読んでいる物（外から順）
function writtenEmptyMark(leaf) {
  const { writtenEmpty, ...rest } = leaf;
  return { ...rest, cat: "unit", desc: U(), kind: U(), count: null, strCount: null, writtenEmptyFrom: leaf };
}
// 書いた `[]` を書いた `_` と読み直した印（writtenEmptyMark）が門に当たったら、言い分にそう書き添える（書いた綴りは `[]` なので）。
// 2026-10-28 の片9b から、`_` と分かる名前・括り（R112）も同じ印で読み直すので、出どころの規則を分けて言う。
const writtenEmptyNote = (x) =>
  x && x.writtenEmptyFrom
    ? x.writtenEmptyFrom.knownUnit
      ? `\`${writeTerm(x.writtenEmptyFrom.term)}\` は書いた時点で \`_\` と分かる値なので、値の口では同じ位置に書いた \`_\` と同じに読みます（§4 R112）。`
      : `書いた \`${writeTerm(x.writtenEmptyFrom.term)}\` は、値の口では同じ位置に書いた \`_\` と同じに読みます（§4 R94）。`
    : "";
// 書いた `[]` の葉（印 writtenEmpty）のある並びを、値の口に着いた葉を読み直しながら畳む（R94。reduceItems が rereading の印を付けて呼び直す）。
function readWrittenEmpty(items, ctx, evaluate, closeIdle, bodyRoot) {
  for (;;) {
    reduceOwners.push(items);
    try {
      return reduceItems(items, ctx, evaluate, closeIdle, bodyRoot, true);
    } catch (e) {
      if (!(e instanceof WrittenEmptyAtValue)) throw e;
      const ids = new Set(e.writtenEmptyIds);
      const has = (list) => list.some((t) => t && ids.has(t.writtenEmpty));
      // 葉を書いた並びは、その葉を項に持ついちばん外の並び（穴の関数の本体のように、同じ葉を並べ直して読む内の並びは、外へ返す）。
      if (!has(items) || reduceOwners.slice(0, -1).some(has)) throw e;
      items = items.map((t) => (t && ids.has(t.writtenEmpty) ? writtenEmptyMark(t) : t));
    } finally {
      reduceOwners.pop();
    }
  }
}
// R110（reduceItems）の当たる項か：種類の決まらない項 item が、1つ以上受けた適用の結果と分かるか（2026-10-28 の片9 の確かめの直し）。分かるのは、1行の括りで中の木が
// 適用（`(gq 1)`）か、それを中身に持つ括り・名前（深さ 16 まで）と、ファイルの値の定義の名前で右辺の木が適用（`w : gq 1` の w）の所。名前は、仮引数・実体の中で
// 渡された物に隠されていないときだけ見る。括りと構造体のブロックの行の名前（local-field）は見ない。2026-10-28 の片9b の確かめの直しから寄せ1（R128）までは、
// 枝の無い本体の局所の定義（R80）の名前も右辺の木で見て、本体の行が外の名前を隠しうる範囲の名前（localDefsOf の shadow）は見なかった（本体の `⇥w : @$gf` ⏎ `⇥w _`
// が通っていた穴の直し）。本体の行は今は何も定義しない（その w はファイルの w）。前置の印のある項（`@$gf`）・囲み・合成・構築・中置は見ない（分からない側）。
function appliedResult(item, ctx, depth = 0) {
  if (!item || depth > 16) return false;
  if (item.t === "apply") return true;
  if (item.t !== "leaf") return false;
  const inner = item.view && item.view.inner;
  const term = item.term;
  if (!term || term.type !== "atom" || term.pre.length || term.post.length) return false;
  if (term.core.c === "bracket") return Array.isArray(inner) && inner.length === 1 && appliedResult(inner[0], ctx, depth + 1);
  if (term.core.c !== "name") return false;
  const name = term.core.name;
  for (let s = ctx.scope; s; s = s.parent) {
    if ((s.descs && s.descs.has(name)) || (s.params && s.params.has(name))) return false;
    if (s.locals && s.locals.has(name)) return false;
  }
  const def = ctx.F.defs.get(name);
  return !!def && !def.lambda && appliedResult(ctx.F.defRoots.get(def), ctx, depth + 1);
}
// closeIdle は、値の上に積まれて口の開いたまま閉じた関数を余ったラムダにする並びか（R52。`$[…]` の中身の行の並びと、その `,` が恒等射で
// 消えて残った並びだけ false。遅延した式、§5 Q52 の答え。resolveDelayed）。bodyRoot は、関数の本体の根の並びか（R70 の closeEmpty だけが読む）。
// 書いた `[]` の葉（印 writtenEmpty）のある並びは、readWrittenEmpty が読み直しながら畳む（R94）。無い並び（ほとんど全部）は、読み直しの枠を積まずにここで直に畳む
// （深い入れ子でスタックの段を増やさないため）。
// 片イ（R118）：2項以上の並びの木には、書いた項の並び（written）をそのまま持たせる（書いた `_`・`!_`・`[]` と書いた順も）。行の値は値の段がこの並びを左から2つずつ
// 畳んで決め、木の `apply`・`construct` は実体と種類を作るための畳みの予想で、値を言わない（切り方は値が来るまで決まらない：`add 1 2 3` と `sub (3 < 2) 1 2` は
// 同じ形の木で、値は `3 3` と -1）。読み直し（rereading）は、外の並びが written を持つので付けない。
function reduceItems(items, ctx, evaluate = false, closeIdle = true, bodyRoot = false, rereading = false) {
  const tree = reduceFold(items, ctx, evaluate, closeIdle, bodyRoot, rereading);
  if (rereading || items.length < 2 || !tree || typeof tree !== "object") return tree;
  if (tree.t === "leaf") return { ...tree, written: items };
  tree.written = items;
  return tree;
}
function reduceFold(items, ctx, evaluate = false, closeIdle = true, bodyRoot = false, rereading = false) {
  if (!rereading && items.some((t) => t && t.writtenEmpty)) return readWrittenEmpty(items, ctx, evaluate, closeIdle, bodyRoot);
  // 片イ（R126）：恒等射の割れ（identityGate。前は G18）は、問3（左から2つずつ）で単位律の側に決まる。割れた所の恒等射の項を書いた並びがここなら、その項を
  // 単位律で消した並び（withoutIdentity）を畳み直す（`P i S` は `P S`、法則13）。消すたびに恒等射が1つ減るので、畳み直しは恒等射の数で止まる。書いた項の並び（written）は
  // 消す前の並びのまま（reduceItems が付ける）。ここに無ければ外へ投げ、どこにも無ければ今のまま G18 で断る。
  try {
    return foldItems(items, ctx, evaluate, closeIdle, bodyRoot);
  } catch (err) {
    const next = err && err.unitLaw ? withoutIdentity(items, err.unitLaw) : null;
    if (!next) throw err;
    return reduceFold(next, ctx, evaluate, closeIdle, bodyRoot, rereading);
  }
}
// 片イ（R126）：恒等射の割れで投げた組の項 item を、並び items から単位律（id ; f = f = f ; id、恒等射を当てた物は当てた物）で消した並び。恒等射だけの項（`i`・`!_`・
// `(i)`・恒等射どうしの合成。R46 で口の中の恒等射にした `!_` も、書いた `!_` の葉）は並びから消し、恒等射を含む合成の項（`ci : inc i` の ci・`(inc i)`）は恒等射の段を
// 外した項に替える。並びに無ければ null。
function withoutIdentity(items, item) {
  const at = items.findIndex((t) => t === item || (!!t && !!t.term && t.term === item.term));
  if (at < 0) return null;
  if (isIdentityKind(item.kind)) return [...items.slice(0, at), ...items.slice(at + 1)];
  const fn = item.kind && item.kind.k === "L" ? item.kind.fn : null;
  const fns = fn && fn.type === "compose" ? fn.fns.filter((f) => !(f && f.type === "id")) : null;
  if (!fns || !fns.length || fns.length === fn.fns.length) return null;
  const k = { k: "L", fn: fns.length === 1 ? fns[0] : { ...fn, fns } };
  return items.map((t, j) => (j === at ? { ...t, desc: k, kind: k } : t));
}
function foldItems(items, ctx, evaluate, closeIdle, bodyRoot) {
  // 1項の並びは、その項そのもの（手順の3）。`!_` 1つは恒等射（L）、書いた `_` 1つは印（A）にする（single）。
  if (items.length === 1) return finishTrees([single(items[0])], evaluate, ctx);
  // 片イ（R120 の例外）：名前の読み（どの定義を指すか）が決まらない項（undecidedOf）は、2項以上の並びにあれば今までどおり G7。種類の未知な項とは別で、
  // 値の段に渡せない（§5 Q10）。後ろが書いた `_` だけの所（下の single1）でも同じ。
  for (const it of items) {
    const u = undecidedOf(it, ctx);
    if (u) throw refuseUndecided(u);
  }
  // 書いた `_` の前が1項だけ（`foo _`・`@f _`・`~_ _`・`!_ _`）：その1項が値か、印の無い前置 `@` の項か、`~_` か、括らない `!_` なら、後ろの `_` は値の隣でも（R43）
  // 関数の口の引数の並びの終わりでも（R28、2026-10-26 に書き直した）消えるので、1項の並びと同じ（R28 の書き直しの前は、印の無い前置 `@` の項は、関数なら終わりの印、
  // 値なら消える印と読みが割れて G5 だった）。関数なら、口で読む規則（R31 の印・R39 の既定値・R28 で消える）があるので畳む。
  // 種類の未知な項（`(gq 1)`・`w : gq 1` の w・`5 + inc`・`(+ 1)` の区間の綴り）の後ろの `_` は、既定値のある関数の部分適用なら既定値のある口に当たって既定値（R39）、
  // 値か既定値の無い口なら消える（R43・R105）。R110（2026-10-28 の片9）：評価する所（evaluate。R42・R76）で、その項が適用の結果と分かるとき（appliedResult）は、
  // 既定値の口だけが開いた部分適用は既定値で埋まる（R107）ので、1項の並びと同じ。
  // 片イ（R120、問3「左から読む」・Q80 の閉じ。2026-11-01）から、ほかの所でも断らない：`_` の読みは値の段で、書いた項の並び（written）が `_` を持つ（`(gq 1) _` は 2、
  // `@$gf _` は 1。U〔答え〕[2026-10-27 23:12 438d5b1a]）。木は種類の未知な適用の予想（前は G7）。
  const single1 = items.findIndex((t, j) => j > 0 && items.slice(j).every(isMark)) === 1;
  const head1 = items[0];
  if (single1 && head1.cat === "plain" && head1.desc.k === "U") {
    if (evaluate && appliedResult(head1, ctx)) return finishTrees([single(head1)], evaluate, ctx);
    return finishTrees([{ t: "apply", head: head1, arg: single(items[1]), kind: U() }], evaluate, ctx);
  }
  if (single1 && !isMark(head1) && !(head1.cat === "plain" && head1.kind.k === "L")) return finishTrees([single(head1)], evaluate, ctx);

  // 1. 前検査
  // 種類の決まらない項が並びにあっても断らない（片イ、R120。前は G7）：隣とどう結ぶかは値の段が左から2つずつ決め（問3）、木は畳みの予想（feed の注）。
  // 前置 `~` は 2026-10-26 から、単一の対象を要素1つの List に持ち上げた項（R79、classify）。2026-10-27 の R88（§5 Q14 の残りの答え）から、書いた `_` を持ち上げた
  // `~_` も書いた `[_]` と同じ項（R79）で、ここに残る物は無い（G4 は廃止。前は `~_` が2項以上の並びにあれば G4）。
  // 前置 `@`（R78、2026-10-26。§5 Q9 の答え）：先の分かる `@x`（`$` の印が届く x。関数を指す番地なら指す関数、値を読む参照なら指す値。classify の `@` の枝）は、
  // 並びのどこに置いてもその先として読む（入力の項 cat "input" にならない）。ここで断っていたのは、先の分からない `@x`（印の無い入力の項）だけ。根拠：主の Claude の
  // 21:58 の案「先が分かる `@x` は、その先そのもの（関数なら関数、値なら値）として、どこに置いてもいい。分からない `@x` だけ、今の G6 で断る。」に U〔答え〕
  // [2026-10-25 22:42 c8ccdd69]「Q9 提案受理」。先の分かる `@x` は R49・R60 の片から入力の項でなく、HEAD でもこの門に当たらなかった（答えが実装に追い付いた）。
  // 2026-10-26 の R81・R82 から、素の関数の仮引数は印のある実引数で呼んだ実体で、値の定義の名前の `@p` は右辺の印で、先が分かる。印が届かないのは、印の無い
  // 実引数で読む本体（素の関数の定義の行の1回の読みも）と、未定義・取り込みの名前（§5 Q45 の残り）。
  // G6 の言い分は、その `@x` の先に印が届かない本当の理由を言っていた（inputWhy。2026-10-26 の確かめの指摘：前は未定義の名前・括りの関数の実体の値にも、素の関数の R81 を理由に挙げた）。
  // 片イ（R126、問3「左から読む」。2026-11-01）から、先の分からない `@x` も断らない（前は G6：頭以外か、頭ですぐ右が関数）。その所の `@x` は、種類の未知な項（R120）と
  // 同じ項にして畳む：いちばん上が値か空なら積み、関数なら口に当てる（foldStep）。先が関数か値かで隣との結び方は変わるが、それは値の段が書いた項の並び（written）を
  // 左から2つずつ畳んで決める（問3）。木はこの読みの予想で、値を言わない。頭の `@x` の後ろに値が続く所（`@f 1 2`）は G6 に当たらなかった所で、今までどおり口の数の
  // 分からない関数の適用の予想。すぐ右は、引数の並びの終わりの書いた `_` を飛ばして見る（`@f _ inc` は `@f inc` と同じ。並びの終わりの `_` は消える、R28）。
  items = items.map((it, i) => {
    if (it.cat !== "input") return it;
    let j = 1;
    while (i === 0 && isMark(items[j])) j++;
    const r = i === 0 ? items[j] : null;
    return i !== 0 || (r && r.cat === "plain" && r.desc.k === "L") ? { ...it, cat: "plain", desc: U(), kind: U() } : it;
  });

  // 2. 穴 `!_`（§3.5、R16・R34。2026-10-28 の R105 から、書いた `_` は穴に数えない：値の口では単位律で消える）。穴の規則の中身（頭の後ろの並びが全部その
  //    実引数の並びで、穴でない項が全部 A・撒く項が無い）は、頭から並びの終わりまでの形の条件なので、畳む前に見る（R43。中身は今のまま）。
  //    読める並びなら穴の関数（か、穴を埋めた適用）がそのまま答え。括りの関数の実引数の `!_`（G5）と、穴と実引数の数が合わないのに
  //    R34 が読まない並び（G13）は断る（holeSeq）。値の後ろに積まれた関数の並びも同じに見る（手順3〜6 の subHole、R47）。
  //    残った `!_` は畳み込みの1歩で読む（holeStep）：口の外は恒等射（R44）、口の中は穴と恒等射が同じ関数になる所だけ通す（R46）。
  const hole = holeSeq(items, ctx);
  if (hole) return finishTrees([hole], evaluate, ctx);

  // 3〜6. 左から畳む（R40・R47）。いちばん上が値か空の所に関数 F が来たら、F と後ろの並び Y は、括った `(F Y)` と同じ1つの並び
  //    （R47：積まれた関数は後ろの項を右から受け、前の値は取らない）なので、手順2 の穴の規則も、その並びを頭 F の並びとして見る
  //    （subHole、2026-10-24 の確かめで直した。前は並び全体の頭だけを見ていて、`5 inc _ 7` が G5・`5 (inc _ 7)` が `5 (inc 7)`、
  //    `5 add 1 2 !_` が通り・`5 (add 1 2 !_)` が G13 と、括るかどうかで割れていた）。
  const st = { stack: [], mark: null, items, topAt: null };
  const marked = suffixMarked(items);
  // 畳み込みの1歩は ctx を持たないので、知らせ（R64 の余った要素・R70 の空の流れ）を出す所をここで置く（foldCtx の注）。空の流れを閉じてよいかを
  // 見る並びの置き場（R70、foldSeq の注）も同じく置く。
  const outer = foldCtx;
  const outerSeq = foldSeq;
  foldCtx = ctx;
  foldSeq = { st, at: -1, evaluate, closeIdle, bodyRoot };
  let trees;
  try {
    for (let i = 0; i < items.length; i++) {
      foldSeq.at = i;
      const sub = i > 0 && marked[i] ? subHole(st, i, ctx) : null;
      if (sub) {
        st.stack.push(sub);
        st.topAt = items[i].term || items[i]; // 穴の関数を積んだ項の書いた所（R52 の知らせ、手順7）
        break;
      }
      foldStep(st, i);
    }
    if (evaluate) fillDefaults(st);
    trees = st.stack.map((e) => (e.t === "fn" ? closeEntry(e) : e));
  } finally {
    foldCtx = outer;
    foldSeq = outerSeq;
  }
  // 7. 終わり：可変長の口を閉じ（R41）、残った関数は評価する所なら `_`（R42）で、知らせる（R48）。評価する所の外でも、値の上に積まれて
  //    口が開いたまま閉じた関数は `_` で、知らせる（R52）。
  //    積み上げが2項以上なら、いちばん上の関数は値の上に積まれた物（積み上げの中で関数がいられるのは、いちばん上だけ。finishTrees の注）。
  //    その関数が値の上で何かを受けた後（`5 add 1`）でも、穴の関数（`5 f2 !_`）でも同じ：値の上に積まれたのは `(F Y)` の1項（法則5：`X F Y`
  //    は括った `X (F Y)` と同じ）で、括った `(add 1)`・`(f2 !_)` は値の上で何も受けずに閉じた関数そのもの（R52 の文面）なので、括らない綴りも
  //    同じ答えでなければならない（2026-10-24 の確かめの指摘。前は「何も受けない」を積み上げの項の中の記録で見て、`(5 add 1) 3` が G7・
  //    `(5 (add 1)) 3` が A と割れていた）。知らせる所は、その関数を積んだ項の書いた所（st.topAt）。
  //    R72（2026-10-26、§5 Q63 の答え）：`$[…]` の中身の並び（closeIdle なし、遅延した式）でも、値の上に積まれて何も受けずに閉じた恒等射は、即時に消す
  //    （`$[5 !_]` の中身は `(construct 5 (unit !_))` で、括った `$[(5 !_)]` と同じ 5 を読む参照。恒等射は落としても当てても値が同じなので知らせない）。
  //    恒等射でない関数（`$[5 inc]`）は今のまま遅延した積み上げで G20（R59・§5 Q52）。
  const idleId = !closeIdle && trees.length >= 2 && isIdentityKind(trees[trees.length - 1].kind);
  const at = (closeIdle || idleId) && st.stack.length >= 2 ? st.topAt : null;
  if (!trees.length) return single(st.mark); // 書いた `_` だけの並び（R15。`_ _` は `_`）
  return finishTrees(trees, evaluate, ctx, at);
}

// 手順2：穴 `!_`（§3.5、R16・R34）を、頭 items[0] の並びとして見る。読める並びなら、穴の関数（か、穴を埋めた適用）の木を返す。括りの関数の頭の口を
// 値で埋めた後ろの `!_`（G5）と、穴と実引数の数が合わないのに R34 が読まない並び（G13）は断る（holeRefusal・g13Of）。当たらなければ null（畳み込みの1歩が読む）。
// 2026-10-28 の R105 から、書いた `_` は穴にならない（値の口では単位律 `f _ = f` で消える）ので、`!_` の無い並びは見ない（書いた `_` は畳み込みの1歩が読む）。
// `!_` のある並びは、頭の実引数の並びの書いた `_` を、着く口で先に読んでから見る（unitArgs）。前（2026-10-21〜27）は、最後の項でない書いた `_` も穴に数え
// （R16・R38・R68 のカリー化）、関数を挟んで値が続く `_` も穴（R86、tryHoleRow）だった。
function holeSeq(items, ctx) {
  if (!items.some(isHoleItem)) return null;
  items = unitArgs(items);
  const hole = tryHole(items, ctx);
  if (hole) return hole;
  const refusal = holeRefusal(items);
  if (refusal) throw refusal;
  return null;
}

// 手順2 の穴の規則が読む頭（名前の定義か `?` の括りの素の関数・括りの関数・既定値のある関数）の実引数の並びの書いた `_` を、着く口で読んだ並び（R105・R39・R28）。
// 素の関数と括りの関数の頭は、書いた `_` を全部外す：値の口では単位律で消え（R105）、括りの口では連結の単位で消え（R15）、口が閉じた後ろでは値の隣で消える
// （R43・R89）ので、どこに着いても口を使わない。既定値のある関数の頭は、前から数えた口で読む（defaultUnits：既定値のある口なら既定値という値、ほかの口なら消える、
// 仮引数の外と位置の数えられない所も消える。片イの R126 の前は、仮引数の外は並びの終わりだけ消え、ほかは G15）。ほかの頭（別名・括った頭・点なし）は手順2 が読まない
// （holeHeadArity が null）ので、そのまま返す。
// 2026-10-26〜27 の peelTail（並びの終わりの書いた `_` だけを外し、既定値のある関数の頭は右から見て既定値のある口に当たる `_` で止めた）に替えた。
function unitArgs(items) {
  if (!items.some(isMark)) return items;
  const h = items[0];
  const fn = h.cat === "plain" && h.kind.k === "L" && (h.isLambdaName || h.isQBracket) ? h.kind.fn : null;
  if (!fn) return items;
  const ts = items.slice(1);
  if (isPlainHead(h) || fn.type === "pattern") return [h, ...ts.filter((t) => !isMark(t))];
  if (fn.type !== "other" || !fn.defaults) return items;
  return [h, ...defaultUnits(fn, ts)];
}

// i から後ろに `!_` があるか（subHole を呼ぶかの目安。2026-10-28 の R105 から書いた `_` は手順2 が読まないので数えない）。
function suffixMarked(items) {
  const out = new Array(items.length + 1).fill(false);
  for (let i = items.length - 1; i >= 0; i--) out[i] = out[i + 1] || isHoleItem(items[i]);
  return out;
}

// 畳み込みの i 番目に関数 F が来て、いちばん上が値か空（前の値は F に届かない、R47）なら、F と後ろの並びを1つの並びとして手順2 で見る
// （holeSeq。`X F Y` と `X (F Y)` は同じ、法則5）。いちばん上が関数（F は合成の後ろ）か、種類の未知な値（G2(a) は畳み込みが言う）なら見ない。片イ（R120）から G2(a) は無く、種類の未知な値の上の F は畳み込みが積む予想にする（foldStep）。
function subHole(st, i, ctx) {
  const x = st.items[i];
  if (x.cat !== "plain" || x.kind.k !== "L") return null;
  const top = st.stack[st.stack.length - 1];
  if (top && (top.t === "fn" || top.kind.k !== "A")) return null;
  return holeSeq(st.items.slice(i), ctx);
}

// 積み上げを木にする。評価する所（R42）で、いちばん上に未評価のラムダが残れば `_`：木では元の木を `(unit …)` で包む（§1.3）。
// そのとき、恒等射でなければ warning で知らせる（R48、reportLeftover）。
// 評価する所の外（`:` の右辺も。`$[…]` の中身の並びを除く）でも、いちばん上が値の上に積まれて口の開いたまま閉じた関数（at がある）なら、
// 同じく `_` にして知らせる（R52、2026-10-24）。逆適用は無い（R47）ので、値の後ろの関数は前の値を取らず、並びが閉じた後に実引数を受ける
// 道も無い（`(5 inc) 3` の 3 は括りの外の項で、括りの中の inc には届かない）。値の上で受けた後の関数（`(5 add 1)`）と穴の関数（`(5 f2 !_)`）も
// 同じ（法則5 で `(5 (add 1))`・`(5 (f2 !_))` と同じ、reduceItems の手順7）。並び全体が1つの関数（下に値が無い）なら、評価する所の外では
// 今までどおりラムダのまま残す（括りの中なら後から当てられる）。2026-10-26 の R76（§5 Q37 の答え）から、比べと論理の被演算子・2行以上の手続きの本体の行も
// 評価する所（evaluatePlace の注）。そこでも、値の上に積まれた関数（at がある）は R52 の余り（`$[5 inc == 6]` は R59 の G20 のまま。確かめ 2026-10-26：
// 最初の版は R76 の所の余りとして数え、`$` の先の受け皿に拾わずに通していた）で、丸ごとの関数（at が無い）だけが R76 の所の余り（why "place"・"place-cmp"）。
// 2項以上なら構築（R8：子の構築は開いて並べる）。いちばん上が関数で下に値がある構築が残るのは、`$[…]` の中身の並び（`$[5 inc]`。遅延した
// 式で R52 の判定をしない）だけで、種類を決めない（未知）：値の並びの後ろに、まだ口の開いた関数が残った物（§5 Q38・Q52）。2026-10-24 の
// §5 Q50 の答えまでは、左が名前1つの `:` の右辺の並び（`v : 5 inc`）もここだった。
// 積み上げの中で口の開いた関数が残るのは、いちばん上だけである：積んだ関数は次の項を受けるか合成し（R47）、口が全部埋まれば値になる。
function finishTrees(trees, evaluate, ctx, at = null) {
  const last = trees.length - 1;
  if (trees[last].kind.k === "L") {
    // R76 で広げた評価する所（evaluate が {at, sym}）は、本体の行・被演算子が括りの関数の実体ごとに読み直されるので、書いた所ごとに1回だけ知らせる（R52 と同じ）。
    if (evaluate === true) trees[last] = leftoverUnit(trees[last], ctx);
    else if (at) trees[last] = leftoverUnit(trees[last], ctx, at);
    // `,` の辺（R121）が恒等射の葉1つに縮んだ並び（`_ i`・`!_ _`）は包まない：恒等射は `,` の単位で、辺ごと消える（R45。resolveProduct の isIdentity）。包むと `7 , _ i` が
    // `(, 7 (unit !_))`、`7 , !_ , _ i` が 7 と割れていた（法則12。R の所）。恒等射どうしの合成（`!_ i`）は resolveProduct が単位と見ないので、今までどおり包む。
    else if (evaluate && !(evaluate.sym === "," && trees.length === 1 && isIdentity(trees[last]))) trees[last] = leftoverUnit(trees[last], ctx, evaluate.at, evaluate.sym === "==" || evaluate.sym === "!==" ? "place-cmp" : evaluate.sym === "#r" ? "place-write" : evaluate.sym === "," ? "place-comma" : "place");
  }
  if (trees.length === 1) return trees[0];
  const items = trees.flatMap((g) => (g.t === "construct" ? g.items : [g]));
  return { t: "construct", items, kind: trees.some((t) => t.kind.k !== "A") ? U() : A() };
}

// 評価する所の終わりに余った未評価のラムダ（R42）を `_` にした木 `(unit …)`。恒等射でなければ知らせる（R48）。
// at は R52 で包んだときの、積まれた関数の書いた所（知らせるのは書いた所ごとに1回、reportLeftover）。評価する所（根）では null。
function leftoverUnit(tree, ctx, at = null, why = null) {
  // `$` の先を解いている所（受け皿 ctx.dead がある、R59）なら、余ったラムダを拾う（恒等射は落としても当てても値が同じなので拾わない）。
  // R76 で広げた評価する所に丸ごと残った関数（why が "place"・"place-cmp"）は拾わない：R59・R75 が断るのは、値の上に積まれて余る関数（`$[…]` の中身が2つの関数を
  // 括った形）で、比べ・論理の被演算子や手続きの行に丸ごと残った関数は、`$` の先を1つの関数と言い切れなくする物ではない（`$[x ? inc == x]` は1つの関数。
  // 確かめ 2026-10-26。前の版は拾って G20 にし、言い分も「値の上に積まれた」と事実と違っていた）。
  if (ctx && ctx.dead && !isIdentityKind(tree.kind) && why !== "place" && why !== "place-cmp" && why !== "place-write" && why !== "place-comma") ctx.dead.push(tree);
  reportLeftover(tree, ctx, at, why);
  return { t: "unit", inner: tree, kind: A() };
}

// R48：評価する所の終わりに余った未評価のラムダは、断らずに知らせる（`5 inc` を 6 のつもりで書いても、黙って 5 に
// なる所。主の Claude の問い「…根でラムダが余って `_` になったら診断で知らせる。これでいい？」に U〔答え〕[2026-10-23 15:32 ebf18260]
// 「合ってる。 それでOK！」）。重さは warning（DIAG_SEVERITY。2026-10-24 の §5 Q44 の答えで information から上げた。断らないのは今までどおり）。
// 名前と言い分は実装する人が決めた。
// 知らせないのは、余ったのが恒等射のとき（`!_`・`i : !_` の i・恒等射どうしの合成。落としても当てても値が同じなので、失う物が無い。
// `5 !_` は 5、根に1つの `!_` は `_` で、U [2026-10-22 23:41 ebf18260]「…!_ だけを評価したら _ に戻るのは都合がいいねって話。」）。
// 恒等射どうしの合成（`i i`）を恒等射に数えるのは、圏の単位律（id ; id = id）から（R）。
// R52（at がある）：評価する所の外で、値の上に積まれて口の開いたまま閉じた関数。名前と重さは R48 と同じで、言い分だけ置かれた所を言う。
// 本体は括りの関数の実体ごとに読み直す（materialize）ので、書いた所（at）ごとに1回だけ知らせる（reportNotFolded と同じ）。
// why "empty"（R70）：空の流れを口が1つの関数が受け、何も当たらずに余ったラムダ。評価する所でもその外でも、流れを書いた所（at）で知らせる。
function reportLeftover(tree, ctx, at = null, why = null) {
  if (!ctx || !ctx.diag || isIdentityKind(tree.kind)) return;
  if (at && ctx.F) {
    if (ctx.F.reportedLeft.has(at)) return;
    ctx.F.reportedLeft.add(at);
  }
  const name = show(tree);
  pushDiag(
    ctx,
    "leftover-lambda",
    name,
    why === "empty"
      ? `空の流れを口が1つの関数が受け、何も当たらずに未評価のラムダ \`${name}\` が余ったので、\`_\` になりました。並びの中では消えます（§4 R48・R70、§5 Q57）。`
      : why === "place"
      ? `未評価のラムダ \`${name}\` が評価する所（論理の被演算子か、字下げの本体の手続きの行）の終わりに余ったので、\`_\` になりました（§4 R42・R48・R76、§5 Q37 の答え）。当てるつもりなら、実引数を関数の後ろに書きます。関数を値として置くつもりなら、\`$\` を付けて番地にします（§4 R75）。`
      : why === "place-op"
      ? `未評価のラムダ \`${name}\` が評価する所（値の演算子の被演算子）に丸ごと残ったので、\`_\` になりました（§4 R42・R48・R87、§5 Q73 の答え）。当てるつもりなら、実引数を関数の後ろに書いて括ります（\`(inc 1) + 1\`）。`
      : why === "place-write"
      ? `未評価のラムダ \`${name}\` が評価する所（書き込み \`#\` の右の被演算子、書き込む値）に丸ごと残ったので、\`_\` になりました（§4 R42・R48・R116、§5 Q73 の答え）。関数を書き込むなら、\`$\` で持ち上げて \`${tree.t === "leaf" ? `$${name}` : "$[…]"}\` と書きます（§4 R53・R99）。当てるつもりなら、実引数を関数の後ろに書きます。`
      : why === "place-comma"
      ? `未評価のラムダ \`${name}\` が \`,\` の辺の終わりに余ったので、\`_\` になりました（§4 R42・R48・R121、問4 の答え：\`f3 1 , 2\` は 2）。当てるつもりなら、実引数を関数の後ろに書いて括ります。関数を積の要素にするなら、\`$\` を付けて持ち上げます（\`$inc , 2\`、§4 R123）。`
      : why === "place-product"
      ? `未評価のラムダ \`${name}\` が \`,\` の被演算子に丸ごと残ったので、\`_\` になりました（§4 R42・R48・R123：関数に演算子を直接充てない。\`inc , 2\` は 2）。関数を積の要素にするなら、\`$\` を付けて持ち上げます（\`$inc , 2\`）。当てるつもりなら、実引数を関数の後ろに書いて括ります（\`(inc 1) , 2\`）。`
      : why === "place-cmp"
      ? `未評価のラムダ \`${name}\` が評価する所（比べの被演算子）の終わりに余ったので、\`_\` になりました（§4 R42・R48・R76、§5 Q37 の答え）。当てるつもりなら、実引数を関数の後ろに書きます。比べの被演算子に関数を値として置く綴りはありません（\`$\` を付けた関数の番地を比べに置く形も断ります、§4 R62）。`
      : at
      ? `未評価のラムダ \`${name}\` が値の上に積まれ、口が開いたまま並びが閉じたので、\`_\` になりました。並びの中では消えます（§4 R48・R52）。逆適用は廃止なので（R47）、値の後ろの関数は前の値を取らず、並びが閉じた後に実引数を受けることもありません。当てるつもりなら、実引数を関数の後ろに書きます。`
      : `未評価のラムダ \`${name}\` が評価する所の終わりに余ったので、\`_\` になりました。並びの中では消えます（§4 R42・R48）。当てるつもりなら、実引数を関数の後ろに書きます（逆適用は廃止、R47）。`
  );
}

// 種類が恒等射（`!_`・`i : !_` の i・恒等射だけの合成）か。
function isIdentityKind(kind) {
  const fn = kind && kind.k === "L" ? kind.fn : null;
  if (!fn) return false;
  if (fn.type === "id") return true;
  return fn.type === "compose" && fn.fns.length > 0 && fn.fns.every((f) => !!f && f.type === "id");
}

// 1項の並びは、その項そのもの。前置 `@`・前置 `~` が1つだけの根は、種類を決めない。書いた `_` 1つは印で値（A。`x : _`、R15）。
// `!_` 1つ（`x : !_`・本体が `!_`・2行以上の括りの中の行）は、頭の無い穴で恒等射（L、並び全体を受ける。R29）。
// 1行の括り `[!_]` は否定の点なしで、ここに来ない（pointfreeOf）。段1〜9 の中置の被演算子になった `!_` 1つは、ここでは恒等射の
// まま返し、`,` の被演算子なら積の単位として消え（R45、resolveProduct）、段4〜8 の被演算子なら中置の側（refuseOperandHole）が G7 で断る。
function single(item) {
  if (item.cat === "input") return { ...item, kind: U() };
  if (item.cat === "unit") return { ...item, desc: A(), kind: A() };
  if (item.cat === "hole") {
    const d = { k: "L", fn: { type: "id" } };
    return { ...item, desc: d, kind: d };
  }
  return item;
}

// 書いた `_`（印）の葉か・穴 `!_` の葉か。既定値のある口に書いた `_`（R39）は印ではなく、既定値という値の葉（cat "default"、A）。
const isMark = (x) => !!x && x.t === "leaf" && x.cat === "unit";
const isHoleItem = (x) => !!x && x.t === "leaf" && x.cat === "hole";
// 穴の並びで、値の項として数える葉（撒く項でない A。既定値という値の葉も含む）。
const isValueItem = (x) => !!x && (x.cat === "plain" || x.cat === "default") && x.desc.k === "A" && !x.desc.spread;
const asValueMark = (x) => ({ ...x, desc: A(), kind: A() });

// ---- 畳み込みの1歩（R40・R47） ----
//
// 積み上げの項は、値（A・未知の木）か、口の開いた関数（t "fn" の項。閉じた所で木にする）。関数の項は、書いた関数を段（stage）に
// 開いて持つ：合成は後ろに段を足すだけで、次の項は「いちばん最初の、まだ閉じていない段」に入る（後から来る物は、最初の関数から
// 順に流れ込む）。段が埋まれば、その結果が次の段の最初の口に入る。合成の名前や括り（`c1 : inc inc`・`[f2 3 f2]`）は、その綴りの
// まま1つの組（group）にし、中の関数を段に開く（木では組の綴りに当てた形で書く）。
// いちばん上が値か空なら、次の項は値でも関数でも積む（R47）。積んだ関数は、その後に来る項を右から受ける（関数は右からだけ受ける）。
// 2026-10-23 までは、値の後ろの関数はその値を逆適用で主語に取っていた（reverseEntry。主語の口が決まらなければ印 pending で G8、
// 主語が撒く項なら G9）。
//
// foldCtx：いま畳んでいる並びの ctx（reduceItems が置き、終われば前の物に戻す）。畳み込みの1歩・段・組は ctx を持たないので、そこで出す知らせ（R64 の
// 括りの名前の無い要素 bracket-excess・R70 の空の流れの余ったラムダ）はここに出す。実体の本体を解く入れ子の reduceItems は自分の ctx を置き直す。
// 書いた所の無い当て方（applyKind：写像・畳み込みの中で要素の desc を当てる所）では null にして、知らせない。
// foldSeq：いま畳んでいる並びの置き場（積み上げ st・いま畳んでいる項の位置 at・評価する所か evaluate・R52 を当てる並びか closeIdle・本体の根の並びか
// bodyRoot）。空の流れを受けた関数を閉じてよいか（R70、closeEmpty）だけが読む。applyKind では null（書いた並びが無い）。
let foldCtx = null;
let foldSeq = null;
function foldStep(st, i) {
  let x = st.items[i];
  const stack = st.stack;
  const top = stack[stack.length - 1];
  if (isMark(x)) return markStep(st, i, top);
  if (isHoleItem(x)) x = holeStep(st, i, top);
  if (x.kind.k === "A") {
    // いちばん上が種類の未知な値でも積む（片イ、R120。前は G2(a)）：それが関数なら x を受けるが、どちらかは値の段が左から2つずつ決める（問3）。
    if (!top || top.t !== "fn") {
      // R112 の根の読み（2026-10-28 の片9b）：評価する所で値の隣に着いた未定義の名前は、同じ位置に書いた `_` と同じに読み直す（`no 5` は `_ 5`、undefinedLikeName）。
      if (x.rootUnit && foldSeq && foldSeq.evaluate) throw new WrittenEmptyAtValue(x.writtenEmpty);
      return void stack.push(x);
    }
    if (x.writtenEmpty && valuePortOf(curStage(top))) throw new WrittenEmptyAtValue(x.writtenEmpty); // R94・R112：書いた `_` と同じに読み直す（reduceItems）
    // 撒く項は流れの1項で、関数の残りの口の数で受ける（R51）。書き下しか畳み込みで段が閉じ、全部閉じれば値。
    if (isSpreadNode(x) && streamStep(top, x)) {
      if (entryDone(top)) stack[stack.length - 1] = renderEntry(top);
      return;
    }
    feed(top, x);
    if (entryDone(top)) stack[stack.length - 1] = renderEntry(top);
    return;
  }
  // 種類の未知な項（片イ、R120。前は G7・G2(a)）：いちばん上が値か空なら積み、関数なら口に当てる。それが値か関数かで隣との結び方は変わるが、それは値の段が
  // 書いた項の並び（written）を左から2つずつ畳んで決める（問3）。木はこの読みの予想。
  if (x.cat === "plain" && x.kind.k === "U") {
    if (!top || top.t !== "fn") return void stack.push(x);
    feed(top, x);
    if (entryDone(top)) stack[stack.length - 1] = renderEntry(top);
    return;
  }
  // x は関数（L）。いちばん上が空か値なら積む（R47）。種類の未知な値の後ろでも積む（片イ、R120。前は G2(a)、R40 の読み6）。
  // 関数の項を積んだ所（st.topAt）は、並びの終わりに値の上で口が開いたまま閉じたときの知らせの書いた所（R52、reduceItems の手順7）。
  if (!top) {
    st.topAt = x.term || x;
    return void stack.push(newEntry(x));
  }
  if (top.t !== "fn") {
    st.topAt = x.term || x;
    stack.push(newEntry(x));
    return;
  }
  // 合成：いちばん上の関数の後ろに、x の段を足す。いちばん上の段が、アリティの分からない関数（前置 `@`・`[,]`・既定値のある関数・
  // 撒く項を受けた関数）で、もう実引数を受けていれば、その関数が終わったのか（閉じて値になり、x は積まれる）、まだ
  // 受けるのか（x は合成）は値の段が決める（片イ、R120。前は G2(a)）。木は閉じて積む予想。
  // 段18 の点なし（`[' 0]`）は、2026-10-24 の R47 から 2026-10-26 までここで G2(a) だった（`[' 0] [1 2 3] inc`：閉じた読みでは inc が引いた値の後ろに積まれ、
  // 開いた読みでは合成）。2026-10-26 の R77（§5 Q39 の答え）から口1つの関数なので、1つ受ければ閉じて値になり、inc は積まれる（閉じた読みに決まった）。
  // その前（2026-10-23 まで）は、引いた物が値なら通していた（閉じてから逆適用しても、開いたまま合成しても同じ答えだった）。
  const s = curStage(top);
  if (s && stageShape(s).unknown && s.recv.length) {
    stack[stack.length - 1] = closeEntry(top);
    st.topAt = x.term || x;
    stack.push(newEntry(x));
    return;
  }
  // R74（2026-10-26、§5 Q13 の答え）：恒等射で始まる合成は、単位律（id ; f = f）で恒等射が消える。いちばん上の関数の項が、まだ何も受けていない恒等射
  // （`!_`・`i : !_` の i・それを括った物・その合成）だけで、x が恒等射でない関数なら、恒等射の項を x の項に置き換える（木も x から始まる）：`i inc 1 2` は
  // `inc 1 2`（`(inc 1) 2`）、`!_ inc 1 2` も同じ、`5 i inc 1 2` は `5 (inc 1) 2`。根拠：主の Claude の傾き「Q13 | `i inc 1 2`（恒等射で始まる合成） |
  // 単位律で i が消えて `inc 1 2`」に U〔答え〕[2026-10-25 21:56 c8ccdd69]「他は全部、君の傾き通り。」。前は恒等射が並び全体を受けて1つの値で inc へ
  // 渡す読み（R29）と割れるので G18 だった。恒等射が受けた後に来た関数（`i 5 inc`）・合成の途中の恒等射（`inc i double 1 2`）・`||!_||` の中の恒等射は
  // 「始まる」形ではないのでここでは消さない（§5 Q13 の残り）。片イ（R126）から、それらで読みが割れる所は、並びの終わりで閉じる所（identityGate）が見つけて、
  // 書いた並び（reduceFold）が恒等射を消して畳み直す（前は G18）。
  if (isFreshIdentityEntry(top) && !isIdentityKind(x.kind)) {
    stack[stack.length - 1] = newEntry(x);
    st.topAt = x.term || x;
    return;
  }
  addGroup(top, x);
  top.log.push({ k: "compose", group: top.groups.length - 1 });
}

// R94（2026-10-27、§5 Q75 (a) の答え）：段 s の次の口が値の口か（素の関数・穴の関数の裸の口・単項と畳まない2項の点なしの口・括りの関数の裸の仮引数・既定値のある関数の
// 裸の仮引数と既定値のある口。合成の中で値の口に入る所も、いちばん上の関数の今の段で見る）。書いた `[]`（印 writtenEmpty）がここに着いたら、同じ位置に書いた `_` と同じに
// 読み直す（reduceItems）。2026-10-04 の裁定（主の Claude の問い「1. 裸の仮引数にリストが来たら、名指しで断る、でいい？」に U〔答え〕[2026-10-04 00:23 c89225be]
// 「1. その通り、自明にTypeErrorで良い。…」）は、空でない器の話として残る（`inc [1 2]` は木の段では今のまま A で、型の段の話）。`[] = _` は器ではなく単位（主の Claude の読み、R）。
// 前（R85、2026-10-27 の片5）は、2つの読み（穴か TypeError か）が割れるとして G5 で断り、名前（`e0 : []` の e0・`e8 : ~[]` の e8）も同じに断っていた。名前は R63 の
// 「`_` と分かる値」の今の読み（A）に戻した（§5 Q75 (e)）。2026-10-28 の片9b の R112 から、名前（と未定義の名前）も値の口では書いた `_` と同じに読み直す（classifyItems）。
// 既定値のある関数は、仮引数の数が数えられ、前の実引数が全部1つの口に入る値のときだけ見る（defaultUnit と同じ数え方。値の口の位置は otherFn の bareAt）。
// 2026-10-28 の R105 の片から、既定値のある関数から作った穴の関数の穴の口（`(go !_ 2) []` の `[]`）は値の口に数える（穴の関数に印 holeOf と穴の数を持たせたので
// 数えられる。書いた `_` の `(go !_ 2) _` と同じ答えにする、法則40）。
// 当てない所（今のまま）：括りの口（`fq []` は R90、最後でない括りの `pb2 [] 1`・R34 の穴の関数の最後の括り `(f3 !_ 2) 1 []` も器のまま）・可変長の口（貪欲な単項・畳む2項の
// 点なし・恒等射の `[* 2,] []`・`[+] []`・`i []` は器を受ける）・口の数の分からない関数（前置 `@`・既定値のある関数から作った穴の関数の穴の外・仮引数の数えられない
// 既定値のある関数）・口でない所（値の隣 `[] 5`・閉じた値の後ろ `inc 5 []`）。
function valuePortOf(s) {
  return !!s && valuePortAt(s, s.recv.length);
}
// 段 s の前から p 番目の口（s がもう受けた物も数える）が値の口か（valuePortOf。2026-10-28 までは writtenEmptyAhead も）。
function valuePortAt(s, p) {
  const fn = s && s.fn;
  if (!fn || s.tainted) return false;
  switch (fn.type) {
    case "plain":
      return p < (fn.rest ? fn.restAt || 0 : fn.n);
    case "pfUnary":
    case "pfBinary":
      return p < fnShape(fn).fixed;
    case "pattern": {
      const base = fn.base || fn;
      const used = (fn.bound ? fn.bound.length : 0) + p;
      return !!base.bareAt && !!base.bareAt[used];
    }
    case "other": {
      // 既定値のある関数から作った穴の関数（holeFnOf の holeOf、2026-10-28 の R105 の片）：穴の口は `!_` の口で値の口。穴の外は数えない（今のまま器）。
      if (fn.holeOf) return p < fn.holes;
      const at = fn.defaults ? fn.bareAt : null;
      const slot = (t) => !!t.kind && t.kind.k === "A" && !isSpreadNode(t);
      return !!at && s.recv.every(slot) && p < at.length && at[p];
    }
    default:
      return false;
  }
}
// 手順2 の穴の規則（tryHole・holeMismatch）が組んだ、頭の口に前から順に入る実引数の並び args に、値の口（素の関数の口・既定値のある関数の bareAt の口）に着く書いた `[]`
// （印 writtenEmpty）があれば、同じ位置に書いた `_` と同じに読み直す（R94。前は R85 の G5 で、素の関数の頭だけを見ていた）。
function emptyArgsAtValue(h, args) {
  const fn = h.kind && h.kind.fn;
  const plain = !!fn && fn.type === "plain";
  const at = !!fn && fn.type === "other" && fn.defaults ? fn.bareAt : null;
  if (!plain && !at) return;
  const e = args.find((t, i) => !!t && !!t.writtenEmpty && (plain || (i < at.length && at[i])));
  if (e) throw new WrittenEmptyAtValue(e.writtenEmpty);
}

// 関数の項が、まだ何も受けていない恒等射の段だけでできているか（R74）。
function isFreshIdentityEntry(e) {
  return e.stages.length > 0 && e.stages.every((s) => !!s.fn && s.fn.type === "id" && !s.recv.length && !s.done) && !e.log.some((ev) => ev.k === "arg");
}

// 括らない `!_`（R44・R46）。穴の規則（R16・R34、tryHole）が読まなかった `!_` は、畳み込みの1歩で、入る所で読む（R43）。
// - 口の外（積み上げが空か、いちばん上が値）：恒等射。`i : !_` の i（R29、fn.type id）と同じ葉にする。`:` はメタなので、並びの頭と値の
//   後ろの `!_ X` と `i X`・`5 !_ X` と `5 i X` は同じ答え（法則11。U [2026-10-22 23:42 ebf18260]「!_ 5 とか !_ , 5 とかも確かめておいた方が
//   良いね。」、U〔答え〕[2026-10-22 23:48 ebf18260]「5 !_ / 5 , !_ も追加で、 全部5になるはず…」）：`!_ 5` は `(apply !_ 5)`、`5 !_` は
//   5 の後ろに恒等射が積まれて余り、根なら `_` で消える（`(construct 5 (unit !_))`、値は 5。R47・R48。2026-10-23 は逆適用の
//   `(apply !_ 5 ·rev)`）、`5 !_ 3` は `5 i 3` と同じ `5 (!_ 3)`、`!_ inc` は合成（根なら `_`）、`!_ 1 2 inc` は `i 1 2 inc` と同じ（片イの R126 から、恒等射を消した並びで畳み直す。前は G18）。前（U〔答え〕
//   2026-10-21 23:47）は G7 で断っていた。同じ答えにならない所は名指しで断る側：頭の関数の口を値で埋めた後ろに値と並ぶ `!_`（`inc 5 !_ 6` の G13・
//   `pq 1 2 !_ 5` の G5。2026-10-26 の R69 から、外が `!_` だけの `inc 5 !_`・`pq 1 2 !_` はここに来て口の外の恒等射で、`inc 5 i`・`pq 1 2 i` と同じ。§5 Q40）と、
//   中置の被演算子（`!_ == 1` の G7。`i == 1` は通る、§5 Q15）。
// - 口の中（いちばん上が口の開いた関数、R46）：`!_` はその関数のいちばん最初の閉じていない段の口に入る。穴と読む（その口に置いた λ：
//   `x ? f … x`。λ はその段の適用だけを包む、R16・R34 の穴と同じ）と、恒等射と読む（f の後ろに合成）で同じ関数になる所だけ通す：
//   口の数の決まった段（素の関数・単項の点なし・畳まない2項の点なし・ノルム）に、口が1つだけ残っている所。λ がその段の口を埋め切る
//   ので、η で部分適用そのもの（`inc !_ inc` は `inc inc`、`[+ 1] !_` は `[+ 1]`、`[<<] 1 !_` は `[<<] 1`）。後ろに値が来ても、穴の λ
//   なら値がその穴を埋め（R34 の k > n と同じ）、恒等射なら同じ口に入るので同じ。
//   口が2つ以上残った段（`[<<] !_ 2`・`add !_ vs~`。`add !_ _` は 2026-10-26 の R28 の書き直しから、手順2 が末尾の `_` を外して `add !_` の R34 で読むので
//   ここに来ない）は、後ろの値が穴の後ろの口に入るか（穴）、穴の口に入るか（恒等射）で
//   割れ、可変長の口（`[+] !_ 5`・`[+ 1,] !_`・`i !_`）・口の数の分からない関数（`gz !_ 3`）は λ の閉じ方で割れるので、G7 のまま。
//   値の後ろに積まれた関数の口も同じに見る（`5 f2 !_` は f2 の口が2つ残るので G7。2026-10-23 は主語の口が決まらない逆適用の口で
//   G7）。括りの関数の口は G5（穴は素の関数だけ、§3.5）：`io1 !_ 5`・`5 io1 !_`・`io1 inc !_`・`inc io1 5 !_`
//   （`!_` の入る段が括りの関数）。`!_` のすぐ前に括りの関数があっても、`!_` が入るのが前の段なら、その段で見る（`inc io1 !_` は inc の
//   口で、R46 で通る。`(inc io1) !_` と同じ）。
//   R46 で通した恒等射の後ろに値が2つ以上入る形（恒等射が並びを受ける、R29）と、恒等射が受けた後に合成された関数へ流れる形は、
//   並びの終わりで閉じる所（identityGate）が単位律と比べて見る（割れれば、片イの R126 から単位律の側で畳み直す。前は G18）。
function holeStep(st, i, top) {
  const x = st.items[i];
  const id = { k: "L", fn: { type: "id" } };
  const out = { ...x, desc: id, kind: id };
  if (!top || top.t !== "fn") return out;
  const s = curStage(top);
  const item = top.groups[s.group].item;
  if (s.fn && s.fn.type === "pattern") {
    throw gate("G5", `括りの関数 \`${show(item)}\` の実引数に穴 \`!_\` があります。穴は素の関数の実引数にだけ書けます（§3.5、U〔答え〕10-14 22:23）。`);
  }
  const sh = stageShape(s);
  const left = sh.fixed - s.recv.length;
  const why = sh.unknown
    ? "口の数の分からない関数の口です"
    : sh.varying
      ? "並びの終わりまで受ける可変長の口です"
      : left >= 2
        ? `口が ${left} つ残っていて、後ろの値が穴の後ろの口に入るか（穴の読み）、穴の口に入るか（恒等射の読み）が割れます`
        : null;
  if (why) {
    throw gate(
      "G7",
      `括らない \`!_\` が、関数 \`${show(item)}\` の口に入る位置にあります。穴と読む（その口に置いた λ）と恒等射と読む（後ろに合成）で同じ関数になるのは、口の数の決まった関数に口が1つだけ残っている所だけで、ここは${why}（§4 R46、§5 Q15）。`
    );
  }
  return out;
}

// 書いた `_`（R43）。いちばん上が値か空なら、並びの単位として消える（R15：0 ⊕ A ≅ A を両側に。畳み込みは単位から始まるので、
// 頭の `_` も消える。`_ inc 5` は `(apply inc 5)`、U〔答え〕10-21 03:19 の表）。いちばん上が関数なら、その口の印として、口を
// 埋める所の規則で読む：畳む2項の点なしなら被演算子の印（R31）、既定値のある口なら既定値（R39）、引数の並びの終わりの `_` なら消える（R28）、
// 括りの関数なら消える（R15）、ほかは G5。
// R105（2026-10-28 の片9）：値の口（素の関数の口・括りの関数の裸の口・点なしの口・既定値のある関数の既定値の無い口）に置いた書いた `_` は、単位律 `f _ = f` で
// その段の適用の単位として消え、口を使わない（次の項が同じ口に入る）。括りの口（参照の口）の `_` は R15 で消えて詰まるので、どちらの口でも消える。だから G5 は無くなり、
// 消えないのは、畳む2項の点なしの被演算子の印（R31）と、既定値のある口の既定値（R39）と、既定値のある関数から作った
// 穴の関数の穴の外の口（G5、下の holeOf）だけ（位置の数えられない既定値のある関数の口は、片イの R126 から消える予想。前は G15）。書いた `_` の穴（R16・R38・R68・R86 のカリー化と位置を保つ読み）は廃止した（穴は `!_` だけ、R34）。
// 根拠：主の Claude の問い「値の口の書いた `_` も単位律で消える（穴は `!_` だけ）を、片9 の初めに入れていい？」のボタンの答え U〔答え〕[2026-10-27 15:59 58a809c9]
// 「それでいい。値の口の書いた _ も単位律 f _ = f で消えて、sub _ 1 2 は -1。書いた・名前・計算の _ は値の口でどれも同じ。穴は !_ だけ。mx _ 1 は mx 1。片9 の初めに入れて。」
// （ボタンの文は主の Claude の物）。その前の U [2026-10-27 15:50 58a809c9]「sub _ 1 2 / が / なぜ新しいラムダを生成しているそぶりを前提にしているの？」。
// 前（R83・R86、2026-10-27）は値の口の `_` を「その段に当てない」穴と読み、位置を保っていた（`sub _ 1 2` は `sub 2 1`）。
// R28（2026-10-26 に書き直した）：並びの最後の書いた `_` は、R15 と同じく消える印。消した後に残る部分適用・合成・関数そのものは、関数のまま残り（L）、
// 評価する所（R42・R76）か値の上（R52）で何も受けずに残れば `_` になって知らせる（R48）。括りで閉じても評価しない（`(add 3 _) 5` は `(add 3) 5` で 8）。
// 根拠：主の Claude の問い「`(add 3 _) 5` も Q18 と同じく `_` が消えて `add 3` が残り、8 でいい？」に、ボタンの答え U〔答え〕[2026-10-26 10:15 c8ccdd69]
// 「8 でいい。末尾の書いた `_` は消えて、部分適用も合成も関数のまま残る。最後まで評価されなければ初めて `_`（R42）。R28 をそう直して、次の片に入れて。」
// （ボタンの文は主の Claude の物）。合成（§5 Q18）は U〔答え〕[2026-10-25 21:56 c8ccdd69]「Q18 まだ inc inc の関数として残し、最後の結果で inc inc が
// 評価されなければ初めて _」。
// 消えるのは、後ろに書いた `_` しか続かない `_` と、後ろが並びの終わりまで関数と書いた `_` だけの `_`（引数の並びの終わり、argRun。`add 3 _`・`add _ _`・
// `inc inc _`・`[* 2,] 1 _`・`io1 _`・`add _ inc`）。どの頭でも消えるだけなので、頭のアリティを数えない。後ろのどこかに値か `!_` が続く内側の `_`
// （関数を挟んで値が続く `_` も、§5 Q74 (a)）は、2026-10-28 の R105 から値の口でも消える（`_` を消した綴りと同じ）。前はカリー化（手順2 の R16・R38・R68・R86）か G5。
// 前（2026-10-21〜2026-10-26 の R28）は、並びの最後の `_` を「ここで終わる」印と読み、足りなければ A で値は `_`（`add 3 _` は `(apply add (construct 3 _))`、
// 括りで閉じた `(add 3 _) 5` は 5）にしていた。合成の頭（`inc inc _`、§5 Q18）・アリティの数えられない頭（`[* 2,] 1 _`）・終わりの後ろに関数が続く形
// （`add _ inc`）・括りの関数の頭で足りない形（`io1 _`・`pb 1 _ inc`、終わりと R15 の消える印が割れる）は G5、既定値の無い口の最後の `_` は G15 だった。
function markStep(st, i, top) {
  const x = st.items[i];
  // いちばん上が種類の未知な値（片イ、R120）でも、木の予想では値の隣の印と同じに消す（R28・R105 の木と揃う、法則9・法則30）。それが既定値のある関数なら
  // `_` は既定値の口に当たる（R39）が、それは書いた項の並び（written）を読む値の段が決める。
  if (!top || top.t !== "fn") {
    if (!st.mark) st.mark = x;
    return;
  }
  const s = curStage(top);
  const fn = s.fn;
  // R84（2026-10-27）：長さ 0 の流れの印（emptyMark）は、書いた `_` と同じに読む。ただし括りの関数の最後の括り（参照の口）が、その流れ1つだけを丸ごと受ける所
  // （最後の括りがまだ何も受けておらず、後ろに書いた `_` か関数しか続かない）では、元の流れのまま受ける：撒いた器そのもの（R64：`f []~` は `f []`）。書いた `f _` は
  // R28 で f のまま（§5 Q75 (b) の参照の口）。R34 の穴の関数の最後の括り（`fn.rest`）も参照の口なので同じ。
  // R95（2026-10-27、§5 Q75 (b) の点なしの所の答え）：点なしの可変長の口（貪欲な単項 `[* 2,]`・写像 `[inc,]`・畳む2項の点なし `[+]`・恒等射 `i`・`!_`）と、それを頭にした
  // 合成は、ここに当てない（同じ位置に書いた `_` と同じ。`[* 2,] []~` は `[* 2,] _` と同じく点なしの関数が残る `(unit [* 2,])`）。根拠：主の Claude の問い4（可変長の口が
  // 流れ1つを受ける形、`[* 2,] []~` と `[* 2,] _`）「値はどちらも `_` で、木だけが割れている（Q75 (b)）。」（2026-10-27 02:35 UTC）に、U〔答え〕[2026-10-27 09:25 df447414]
  // 「4. それは点無しの関数が残るはず。」。前（R84 の最初の版、片5）は R51 の丸ごとで、`[* 2,] []~` は空の List の写像の A だった。
  const refPort = !!fn && (fn.type === "pattern" || (fn.type === "plain" && !!fn.rest));
  if (x.emptyFrom && refPort && streamMouths(s) === "whole" && s.recv.length === stageShape(s).fixed && argRun(st.items, i).end) {
    feed(top, x.emptyFrom);
    if (entryDone(top)) st.stack[st.stack.length - 1] = renderEntry(top);
    return;
  }
  // 2026-10-23 までは、主語の口が決まらない逆適用（§5 Q5）の後の `_` をここで先に見ていた（`5 f2 _` は R28 の終わりで A、ほかは G8）。
  // 逆適用の廃止（R47）で、値の後ろの関数は積まれて口が全部開いているので、`_` はほかの関数の口と同じ規則で読む（`5 f2 _` は
  // `5 (f2 _)` で、2026-10-26 の R28 の書き直しから末尾の `_` が消えて `5 f2`（f2 は値の上で何も受けずに閉じて R52 の `_`）。`5 gd _ 3` は `5 (gd _ 3)` で、前は G15。2026-10-28 の R105 から `_` は gd の既定値の無い口で消える）。
  if (fn && fn.type === "pfFold") {
    feed(top, asValueMark(x), false); // 中置の被演算子と同じ印（R31）。末尾でも消さない（`[+] 1 _` は `1 + _`）
    return;
  }
  if (fn && fn.type === "other" && fn.defaults) {
    // 既定値のある関数（R39・R105）：前から数えた口（s がもう受けた数。2026-10-28 の R105 から、消えた `_` は口を使わないので数えない）で読む。
    // 既定値のある口なら既定値という値（R39。引数の並びの終わりでも残す）。既定値の無い口（裸の値の口と括りの口）なら消える（R105 の単位律と R15）。
    // 仮引数の外も消える（引数の並びの終わりなら R28、内側なら口が閉じた後ろの値の隣の R43・R89。`go 1 2 _ 3` は `go 1 2 3` と同じ木）。位置が数えられない形
    // （n が数えられない `gz _ 3`・撒く項か値でない項を受けた後）も、木では消える予想にする。
    // 片イ（R126、問2「木が組めて射が無い所は値の段の _」）から、仮引数の外の内側の `_` と位置の数えられない `_` を断らない（前は G15。G15 の断りは、閉じたかと
    // 口の位置が解決器に数えられないという解決器の都合で、文法に無い形ではない）。書いた `_` は書いた項の並び（written、R118）に残るので、その口が既定値のある口か
    // （R39）・口が閉じた後ろか（R43）は、値の段が written を左から2つずつ読んで決める（問3、R120）。木は予想で値を言わない。
    // 前（2026-10-26〜27）は、引数の並びの終わりの `_` を右から見て既定値のある口に当たる `_` まで残し（defaultKeep）、既定値の無い口の内側の `_` は手順2 で
    // R68 のカリー化、ほかは G15 だった（`gd _ _` は後ろの `_` が zs の既定値で前の `_` がカリー化。今は左から読んで両方消え gd、§5 Q74 (d)）。
    const u = defaultUnit(s, x);
    if (u) feed(top, u, false);
    return;
  }
  const run = argRun(st.items, i);
  if (run.end) return; // 引数の並びの終わりの `_` は消える（R28）
  // 既定値のある関数から作った穴の関数（holeFnOf の holeOf）：穴の口は値の口で消える（R105）。最後の括りで残りを受ける形（R34 の k < n）の残りの口も括りの口で消える
  // （R15）。穴を全部埋めた後の口は、既定値のある関数の適用（種類が決まらない、§5 Q8）の後ろで、既定値のある口に当たるかが数えられないので断る（G5。前は全部 G5）。
  if (fn && fn.type === "other" && fn.holeOf && !fn.rest && s.recv.length >= fn.holes) {
    throw gate(
      "G5",
      `既定値のある関数から作った穴の関数 \`${show(renderEntry(top))}\` の、穴を全部埋めた後ろに書いた \`_\` があります。その口は既定値のある関数の適用（種類が決まっていない、§5 Q8）の後ろで、既定値のある口に当たる（既定値、§4 R39）か、ほかの口で消える（§4 R105）かが数えられません（§3.5、§5 Q8）。${writtenEmptyNote(x)}${emptyAheadNote(st.items, i)}`
    );
  }
  // R105：ほかの口は全部消える。値の口（素の関数・穴の関数の穴・単項と畳まない2項の点なし・段18 の点なし・ノルム・括りの関数の裸の仮引数）は単位律 `f _ = f`、
  // 括りの口（括りの関数の括りの仮引数・R34 の穴の関数の最後の括り）は連結の単位（R15）、可変長の口（貪欲な単項・写像・恒等射・`[,]`）は並びの単位（R15・R61）で、
  // どれも口を使わない（`mx _ 1` は `mx 1`、`(f3 !_ 2) _ 1` は `(f3 !_ 2) 1`、`[<<] _ 2` は `[<<] 2`、`[* 2,] 1 _ 3` は `[* 2,] 1 3`）。撒く項を受けて口の数えられない段
  // （tainted）も、どの口でも消えるので同じ。前（2026-10-21〜27）は、素の関数の内側の `_` が手順2 のカリー化（R16・R38）か穴（R86）、括りの関数の裸の口と
  // R34 の穴の関数の口と、ほかの関数の内側の `_` は G5（詰めるか位置を保つかが割れる、§5 Q7・Q74 (a)）だった。
}

// 書いた `_` の items[i] から続く書いた `_` の数（len）と、その `_` が引数の並びの終わりか（end、R28）。end は、後ろが並びの終わりまで、書いた `_` と
// 関数（L）だけのとき。後ろのどこかに値・撒く項・`!_`・種類の未知な項があれば end でない（内側の `_`）。
// 2026-10-28 の R105 から、end でない内側の `_` も値の口では消える（`_` を消した綴りと同じ）ので、end で答えが分かれるのは、既定値のある関数から作った穴の関数の
// 穴の外の `_`（end なら消え、内側なら G5）だけ（既定値のある関数の仮引数の外の `_` も、片イの R126 の前は end なら消え、内側なら G15 だった）。前（2026-10-26〜27）は、関数を挟んで値が
// 続く `_` を、消える読み（値は `_` の口へ）と穴の読み（値は次の口へ）で割れるとして end にせず、§5 Q74 (a)（R86 で穴の読み）にしていた。
function argRun(items, i) {
  let j = i;
  while (j < items.length && isMark(items[j])) j++;
  const rest = items.slice(j);
  return { len: j - i, end: rest.every((t) => isMark(t) || (!isHoleItem(t) && !!t.kind && t.kind.k === "L")) };
}

// 書いた `_` の門（G5。片イの R126 の前は G15 も）の言い分の添え書き：後ろに続く値が書いた `[]` の葉だけの所。門の `_` の口が数えられないので、葉の着く口も数えられず、器のまま数えた。
// 2026-10-27 の片6 の確かめの直しから 2026-10-28 までは、書いた `_` の読み（穴で位置を保つか、消えて詰めるか）で葉の着く口が変わる所（§5 Q75 (g)）を先に数えていた
// （writtenEmptyAhead・leavesAtValue）。R105 で値の口の `_` はいつも消えて口を使わないので、葉は畳み込みの1歩が着いた口で読み直し（R94）、先回りは要らなくなった。
function emptyAheadNote(items, i) {
  const leaves = [];
  for (let j = i + 1; j < items.length; j++) {
    const t = items[j];
    if (t.writtenEmpty) leaves.push(t);
    else if (!isMark(t) && (isHoleItem(t) || !t.kind || t.kind.k !== "L")) return "";
  }
  if (!leaves.length) return "";
  return `後ろの書いた ${leaves.map((t) => `\`${writeTerm(t.term)}\``).join("・")} は、この \`_\` の口が数えられないので着く口も数えられず、同じ位置に書いた \`_\` とは読まずに器のまま数えました（§4 R94）。`;
}

// R39：既定値のある関数の段 s に書いた `_` x。前から数えた位置（s がもう受けた数）が既定値のある口（fn.defaultAt）なら、既定値という
// 値の葉（cat "default"、A）。合成の段でも同じ（合成は左から実行する、R11）。ほかは null で、markStep で消える：既定値の無い口（R105）・仮引数の外（R28・R43・R89）と、
// 位置が数えられない形（撒く項か値でない項を受けた後・n が数えられない）。仮引数の外の内側の `_` と位置が数えられない形は、片イ（R126）の前は G15 で断っていた。
function defaultUnit(s, x) {
  const at = s.fn.defaultAt;
  const i = s.recv.length;
  const slot = (t) => !!t.kind && t.kind.k === "A" && !isSpreadNode(t);
  return at && i < at.length && s.recv.every(slot) && at[i] ? { ...x, cat: "default", desc: A(), kind: A() } : null;
}
// R107（2026-10-28 の片9、§5 Q74 (b) の答え）：評価する所（R42。R76 で広げた所も、reduceItems の evaluate）で、いちばん上の関数の今の段が既定値のある関数で、
// 1つ以上受けていて、まだ開いている口が全部既定値のある口なら、その口を既定値で埋めて値にする。木は、開いた口に書いた `_` を書き足した綴り（R39 の既定値という値の
// 葉。`gq 1` は `gq 1 _` と同じ `(apply gq (construct 1 _))`）と同じ（法則39）。種類は書き足した綴りと同じ（既定値のある関数の適用の種類は §5 Q8 の残りで未知）。
// 根拠：主の Claude の問い「Q74 (b)：gq 1 のように既定値の口を開けたまま部分適用した物は、関数なのか、既定値で埋めた値なのか。Q8 の残りと同じ問い。」に
// U〔答え〕[2026-10-27 12:46 58a809c9]「既定値で埋める。 / 埋めないなら、 !_ で穴であると明示」。
// 埋めるのは評価する所だけ（主の Claude の読み、R）：並びの中で後ろに実引数が続けばその口に入る（`gq 1 5` は y が 5。左結合でも内側は評価する所ではない）。
// 「既定値でない口が全部埋まった時」に埋めると、左結合の `gq 1 5` で y に実引数を渡せなくなる。評価する所の外（括りの中・`:` の右辺）は部分適用のまま（`w : gq 1` の w）。
// 埋めずに関数として残すなら `!_` で穴を明示する（`gq 1 !_` は穴の関数で、評価する所では余ったラムダの `_`、R42）。何も受けていない関数（既定値の口だけの `gf :` ⏎ `⇥⇥y : 1` ⏎ `⇥? y`
// の `gf`）は部分適用ではないので埋めない（R42 の余ったラムダ。§5 の問いに残した）。位置の数えられない段（撒く項を受けた・n が数えられない）も埋めない。
function fillDefaults(st) {
  const top = st.stack[st.stack.length - 1];
  if (!top || top.t !== "fn") return;
  const s = curStage(top);
  const fn = s && s.fn;
  if (!fn || fn.type !== "other" || !fn.defaults || !fn.defaultAt || s.tainted) return;
  const at = fn.defaultAt;
  const p = s.recv.length;
  if (!p || p >= at.length || !s.recv.every((t) => !!t.kind && t.kind.k === "A" && !isSpreadNode(t)) || !at.slice(p).every(Boolean)) return;
  for (let j = p; j < at.length; j++) feed(top, { t: "leaf", term: null, cat: "default", desc: A(), kind: A(), view: { v: "atom", text: "_" } }, false);
}


// ---- 関数の項・段・組 ----

function newEntry(item) {
  const e = { t: "fn", groups: [], stages: [], log: [] };
  addGroup(e, item);
  return e;
}
function addGroup(e, item) {
  const g = e.groups.length;
  const fn = item.kind.fn;
  const fns = fn && fn.type === "compose" ? fn.fns : [fn];
  // 合成の幅の守り（COMPOSE_WIDTH_LIMIT の注の6）。
  if (e.stages.length + fns.length > COMPOSE_WIDTH_LIMIT) throw new ComposeWidthOverflow();
  e.groups.push({ item, args: [], flowIn: false, result: null, first: e.stages.length });
  for (const f of fns) e.stages.push({ fn: f, group: g, recv: [], done: false, result: null, tainted: false });
}
const curStage = (e) => e.stages.find((s) => !s.done) || null;
const entryDone = (e) => e.stages.every((s) => s.done);

// 段の口：fixed は数えられる口の数、varying は最後に可変長の口があるか、unknown はアリティが分からないか（並びの続く間は受け、
// 終わりで閉じる）。撒く項を受けた段（tainted）は、埋まったかが数えられないので unknown にする（R24「撒く項があれば k は数えない」）。
function stageShape(s) {
  if (s.tainted) return { fixed: 0, varying: false, unknown: true };
  return fnShape(s.fn);
}
function fnShape(fn) {
  switch (fn && fn.type) {
    case "plain":
      return fn.rest ? { fixed: fn.restAt || 0, varying: true } : { fixed: fn.n };
    case "pfUnary":
    case "norm":
      return { fixed: 1 };
    // 段18 の片側の欠けた点なし（`[' 0]`・`[@ 0]`・`[fs ']`）は、書いていない被演算子の口が1つ（R77、2026-10-26。§5 Q39 の答え：主の Claude の傾き
    // 「1つ（`[+ 1]` と同じ）」に U〔答え〕[2026-10-25 21:56 c8ccdd69]「Q39 アリティ1という意味なら合ってる。」）。`[' 0] [1 2] 5` は `([' 0] [1 2]) 5`（余りは
    // 後ろに積む、R35）、`[' 0] [1 2 3] inc` は引いた値の後ろに inc が積まれて余る（R47）。前（R41 の読み8）は口の数の分からない関数として並びの終わりまで
    // 受け、1つで閉じれば引いた物・2つ以上なら未知、受けた後に関数が来たら G2(a) だった。
    case "pfPick":
      return { fixed: 1 };
    case "pfBinary":
      return { fixed: fn.n };
    case "pattern":
      return fn.lastBracket ? { fixed: fn.n - 1, varying: true } : { fixed: fn.n };
    case "pfGreedyUnary":
    case "pfFold":
    case "id":
      return { fixed: 0, varying: true };
    default:
      // 前置 `@`・`[,]`・既定値のある関数・アリティの分からない関数（並びの終わりまで受けて閉じる。受けた後に関数が来たら、閉じて値になった後ろに積む
      // 読みか、まだ受けていて合成する読みかが決まらない：G2(a)。R41 の読み8・R47）。段18 の点なしは 2026-10-26 から上の口1つ（R77）。片イ（R120）から G2(a) で断らず、
      // 木は閉じて積む予想で、どちらかは値の段が決める（foldStep）。
      return { fixed: 0, unknown: true };
  }
}

// 実引数を1つ、いちばん最初の閉じていない段に入れる（R40 の適用）。
function feed(e, tree) {
  const s = curStage(e);
  e.log.push({ k: "arg", tree, group: s.group });
  e.groups[s.group].args.push({ tree });
  putArg(e, s, tree);
}
// 恒等射の段は、受けた物ごとに、受けた時の書いた順の位置（log の長さ）を持つ（at）。並びの終わりで閉じるときに、後ろの関数が受けた
// 後に合成されたか（単位律の読みでは、その関数は値の後ろに積まれて受けた物を取らない、R47）を見る（identityGate）。
// 2026-10-23 までは、段18 の点なしが1つ受けた後に合成した関数の後ろから、値がその点なしの口に入る所（印 held）もここで G2(a) に
// していた。R47 で、点なしが受けた後に関数が来た所（foldStep）で G2(a) になったので、印は要らない。
function putArg(e, s, tree) {
  argOperand(s, tree);
  if (s.fn && s.fn.type === "id") (s.at || (s.at = [])).push({ at: e.log.length });
  s.recv.push(tree);
  const sh0 = fnShape(s.fn);
  // 撒く項が数えられる口に入った：その段がいくつの口を埋めたかが数えられない（可変長の口に入った撒く項は、閉じたときに未知）。
  if (isSpreadNode(tree) && !sh0.unknown && s.recv.length <= sh0.fixed) s.tainted = true;
  const sh = stageShape(s);
  if (!sh.varying && !sh.unknown && s.recv.length >= sh.fixed) settle(e, s, doneKind(s));
}

// 段 s が実引数 tree を受ける所の、Reader と札（R60 の細かい所。2026-10-25 の確かめの直し。2026-10-26 の R62 から、番地の点と差は G21、§5 Q66）。
// - 値の演算子の点なし（印 vop：`[+ 1]`・`[1 +]`・`[-_]`・`[!!_]`・`[_!]`・`[+]`・`[==]`・`[<<]`・`[~]`・`[!=]`・`[!==]`・`[* 2,]`・`[-_,]`）が Reader を受けたら、
//   中置で書いた `$x + 1` と同じく G7（区間は位置で被演算子を取る：`[+ 1] x` は `x + 1`、R31・R32）。前は中置の項の所だけで見ていて、
//   `[+ 1] $vs`・`[+] $vs 1` が通った（確かめの指摘）。素の関数の裸の仮引数を受けたら、その札に覚える（valueOperand）。
// - 素の関数の口（印 op）に、ほかの素の関数の裸の仮引数をそのまま渡したら、札から札へ辺を張る（numericParam が辿る）。
function argOperand(s, tree) {
  const fn = s.fn;
  if (!fn) return;
  // 既定値のある関数（とほかの「other」の関数）の答えは未知（doneKind）で、口に渡した番地の算術の点・差の印を持たせられない（2026-10-26 の確かめの直し、
  // hasAddr の注。素の関数の口の readerAtPlain と同じ線、§5 Q66）。
  if (fn.type === "other" && treeHasAddr(tree)) throw refuseAddressDrop("other", readerText(tree));
  // 言い分に点なしの記号は書かない（点なしは実体の鍵に記号を入れないので、分け合った実体の本体から出る言い分が記号で割れる。fnKey の注）。
  // 畳む点なしは、1項だけなら演算を当てない（`[+] 5` は 5、R31 の foldOneKind）ので、ここでは見ず、2項以上で閉じた所で見る（closeKind）。
  if (fn.vop && fn.type !== "pfFold") return void valueOperand(descOfTree(tree), null, () => readerText(tree, false));
  if (fn.type === "plain" && fn.op) {
    const d = descOfTree(tree);
    if (d && d.pv) {
      const to = paramTag(fn.op, fn.idKey, (fn.at || 0) + s.recv.length);
      if (!to.fn) to.fn = fn;
      d.pv.edges.add(to);
    }
  }
}
// Reader の葉の綴り（言い分のため）。写像・畳み込み・流れの中で当てた物は書いた綴りが無い（`·`）ので、形の綴りで言う。quote なら `…` で囲む。
function readerText(tree, quote = true) {
  const t = show(tree);
  if (t !== "·") return quote ? `\`${t}\`` : t;
  return `形 ${descText(descOfTree(tree))} の要素`;
}
// 素の関数の口で見る実引数（readerAtPlain・partialFn の readers）：`$` が作った Reader と、番地の算術で作った点・差を含む物（R62、hasAddr）。
const plainReaderArg = (d) => !!readerOf(d) || hasAddr(d);
// 素の関数 fn（印 op）の口が足りた：前に当てた Reader（部分適用の readers）と、いま当てた trees の Reader の口の札が、本体から値の演算子に届くなら
// G7（paramTag の注。β で `inc $5` は `$5 + 1` と同じ形）。届かない口（`use : f x ? @f x` の f）に渡した Reader は今までどおり通る。
function readerAtPlain(fn, trees) {
  if (!fn || fn.type !== "plain" || !fn.op) return;
  const here = trees.map((t, i) => (plainReaderArg(descOfTree(t)) ? { i: (fn.at || 0) + i, tree: t } : null)).filter(Boolean);
  for (const r of [...(fn.readers || []), ...here]) {
    const label = fn.label || `[${cutShape(writeTree(fn.op))}]`;
    // 番地の算術で作った点・差（R62。器の要素・欄にあっても）は、口が値の演算子に届かなくても断る（2026-10-26 の確かめの直し、hasAddr の注）：素の関数の
    // 答えは本体の根の種類だけなので、本体がその口を返せば（`gi : y ? y`）印が落ちる。値を読む参照は今のまま、届く口だけ断る（§5 Q66 の届かない所）。
    if (treeHasAddr(r.tree)) throw refuseAddressDrop("plain", readerText(r.tree), { label, at: r.i + 1, direct: !!addrOf(descOfTree(r.tree)) });
    const tag = paramTag(fn.op, fn.idKey, r.i);
    if (!tag.fn) tag.fn = fn;
    if (!numericParam(tag)) continue;
    const head = `${readerText(r.tree)} を、素の関数 \`${label}\` の前から ${r.i + 1} 番目の口に渡しました。\`${label}\` の本体はその口を（別の素の関数の口を通っても）値の演算子の被演算子に置くので、β で、`;
    // 関数を指す番地は G7（R53 の外）。番地の点と差（値を読む参照・ずらした点・差）は G21：素の関数の本体は裸の仮引数を A として1回だけ解くので、β の形
    // （`$5 + 1` は数と混ぜた G21、`$5 + 0x10` は点）を本体の中で読み分けられず、答えに点・差の印も持たせられない（断る側に倒した、§5 Q66）。
    if (refOf(descOfTree(r.tree))) {
      throw gate("G7", `\`$\` が作った ${head}関数を指す番地を値の演算子に当てる形（\`$inc + 1\` など）と同じです。関数を指す番地を動かす・比べる形は §4 R53 の外なので断ります（§4 R62）。`);
    }
    throw gate(
      "G21",
      `番地 ${head}番地を値の演算子に当てる形（\`$5 + 1\`・\`$5 + 0x10\` など）と同じです。素の関数の本体は裸の仮引数を番地と見ずに1回だけ解くので、番地の点と差の規則（§4 R62）を本体の中で当てられません（中置で書けば R62 で読みます。§5 Q66）。`
    );
  }
}

// 段 s が閉じて、結果 r になった。r が値なら、次の段の最初の口に入る（合成は適用の繰り返し、R11）。値でなければ（未知か、引いた
// 関数）、そこから先は未知で、後ろの括りの関数は未知を受けて実体を作る（R25、§5 Q24・Q27。ほかの関数の本体の根は引かない、Q28）。
function settle(e, s, r) {
  s.done = true;
  s.result = r;
  const idx = e.stages.indexOf(s);
  const next = e.stages[idx + 1];
  if (!next || next.group !== s.group) e.groups[s.group].result = r;
  if (!next) return;
  if (r.k !== "A") {
    for (let j = idx + 1; j < e.stages.length; j++) {
      const t = e.stages[j];
      if (t.fn && t.fn.type === "pattern" && t.fn.n === 1) t.fn.instantiate([U()]);
      t.done = true;
      t.result = U();
      const g = e.groups[t.group];
      if (g.first === j) g.flowIn = true;
      g.result = U();
    }
    return;
  }
  if (next.group !== s.group) e.groups[next.group].flowIn = true;
  putArg(e, next, composeLeaf(r));
}

// 2026-10-23 までは、ここに逆適用（reverseEntry：値の後ろの関数がその値を主語に取る。主語が撒く項なら G9、主語の口が1つに決まらなければ
// 印 pending を付けて後から実引数が来たら G8、pendingGate）があった。逆適用は 2026-10-24 に廃止した（R47。U [2026-10-23 13:12 ebf18260]
// 「…廃止だね。 逆適用は廃止しよう」）。値の後ろの関数は積まれて、後ろの項を右から受ける（foldStep）。

// 並びの終わり（R41）：可変長の口・アリティの分からない関数で、1つ以上受けた段を閉じる。閉じた結果は次の段に入り、次の段も可変長
// なら、それも閉じる。1つも受けていない段は L のまま残る（`(f3 !_ 2)` は L。根なら `_`、R42）。恒等射の段が閉じるときは、R29 の流れと
// 単位律が割れないかを見る（identityGate）。
// 2026-10-23 までは、主語の口が決まらない逆適用の段（pending）を閉じずに残し、口の数の分からない関数なら未知にしていた（`5 gd`）。
// R47 で、値の後ろの関数は何も受けていない（`5 gd` の gd は L のまま、根なら `_`）。
function closeEntry(e) {
  for (;;) {
    const s = curStage(e);
    if (!s) break;
    const sh = stageShape(s);
    if (!(sh.varying || sh.unknown) || s.recv.length <= sh.fixed) break;
    identityGate(e, s);
    if (passStream(e, s)) continue; // 恒等射が受けた撒いた流れは、そのまま次の段へ（R51）
    settle(e, s, closeKind(s));
  }
  // 可変長の口が並びを受けている間に来た関数は、合成の後ろに入っている（L·L、R40。規則の文面の `[+] 1 2 inc 3` は `inc ([+] 1 2 3)`）。
  // ここで閉じた値は、その合成の流れとして後ろの関数に入る：閉じた値が未知でも G2(a)（次の項を当てるか積むかが決まらない、R40 の
  // 読み6）には当たらず、合成の中の未知として節ごと未知（法則1）。後ろの関数が点なしでも通る（`n 1 2 [+ 1]`）。木は入れ子の適用
  // （renderEntry。2026-10-23 までは、後ろの関数が並びから何も受けていなければ逆適用と同じ綴り `·rev` にしていた）。
  return renderEntry(e);
}

// 関数の項の書いた順の形：合成の前に最初の組が受けたか（preG0）、合成の後に受けたか（postG0）、後ろの組が並びから受けたか（laterArgs）。
function logShape(e) {
  let composed = false;
  let preG0 = false;
  let postG0 = false;
  let laterArgs = false;
  for (const ev of e.log) {
    if (ev.k === "compose") composed = true;
    else if (ev.group > 0 && !ev.whole) laterArgs = true; // 合成全体が受けた流れ（R58、closeWhole）は、後ろの組が受けた物に数えない
    else if (composed) postG0 = true;
    else preG0 = true;
  }
  return { preG0, postG0, laterArgs };
}

// 恒等射の段 s が受けた物を持って閉じる所（R29・R41）。恒等射が受けた物を1つの値で後ろの関数へ流す読み（R29、主の Claude の読み）と、
// 単位律（恒等射を消した並びと同じ。`i inc 1 2` は `inc 1 2`、`i 5 inc` は `5 inc`）で答えが割れる所を見つける（前は G18 で断っていた。片イの R126 から単位律の側で畳み直す、下の注。§5 Q13 の恒等射の問い。
// 法則13 が `P i S` と `P S` を比べる）。恒等射が続くなら、その先の最初の恒等射でない段で見る（後ろの恒等射は単位律で消え、流れを
// そのまま通す）。割れるのは：
// - 恒等射が受けた後に合成された関数（`i 5 inc`・`!_ 5 f2`・`i 1 2 inc`・`i 1 [* 2,] 2`・`inc !_ 5 inc`・`!_ 1 2 ||!_||`）。流れの読みでは
//   その関数が恒等射の結果を受けるが、単位律の読みでは、受けた値の後ろにその関数が積まれて、値を取らない（R47。`5 inc` の inc は 5 を
//   取らない）。2026-10-23 までは、単位律の読みの関数は逆適用で値を主語に取ったので、主語の口が1つに決まる関数（`i 5 inc`・
//   `!_ 5 [* 2,]`）と、1つ受けた後の貪欲な単項（`i 1 [* 2,] 2`）は割れずに通していた。主語の口が決まらない関数（`5 !_ f2` の形）は
//   印 idSplit で残して後から実引数が来たら G18、撒く項の主語は G9 の代わりの G18 だった。R47 で、どれも同じ1つの割れになった。
// - 恒等射が2項以上を受け、その前に合成されていた関数が並び全体を受けない（`inc i double 1 2`。単位律では double が受けた物を1つずつ
//   受ける）。並び全体を受ける貪欲な単項・ノルムは通す。2026-10-26 の R74（§5 Q13 の答え）から、恒等射で始まる合成（`i inc 1 2`・`i f2 1 2`・
//   `i [* 2,] 1 2`）は単位律で恒等射が消える（foldStep）ので、ここに来るのは恒等射が合成の途中にある形だけ（前は `i inc 1 2` がここの G18）。
// - 恒等射が1つ受け、その前に合成されていた関数が口の数の分からない関数（`[,]`・既定値のある関数。段18 の点なしは 2026-10-26 の R77 から口1つ。R51（2026-10-24）の
//   前は、撒く項を受けた固定の口の関数も、R24 で数えられなくなるのでここだった。R51 からは、撒いた流れを受けた口が1つか2つの関数は閉じて
//   値を渡すので、上の「受けた後に合成された関数」で見る）で、その後に関数が合成されている（`i [,] 5 inc`）。単位律の読みでは、その関数が受けた後に
//   関数が来て G2(a)（閉じたか、まだ受けるかが決まらない、R40 の読み6）だが、流れの読みでは恒等射が開いている間に合成されて通る。
//   ここは 2026-10-24 に足した（逆適用の廃止の確かめで、HEAD でも同じ割れが通っていたのが見つかった。断る側）。片イ（R120）から、単位律の読みのその所も G2(a) でなく閉じて積む予想（foldStep）。
// ほか（受けた物が無い・後ろに関数が無い・受ける前に合成された関数が流れでも単位律でも同じ物を受ける）は通す（`5 !_ inc` は恒等射が
// 何も受けず、`5 inc` と同じく inc が積まれて余る）。`||!_||` の中の恒等射は見ない（isNormIdentity）。
// 片イ（R126、問3「左から読む」。2026-11-01）から断らない：左から2つずつの読みでは、恒等射を当てた物は当てた物で、恒等射との合成はその関数なので、上の割れはどれも
// 単位律の側に決まる（R29 の「並び全体を受けて1つの値で渡す」は主の Claude の読みで、問3 の答えと割れる。gates.md §2.8 の読み）。割れる所では、恒等射の段の組の項を
// 印 unitLaw に持たせて投げ、その項を書いた並び（reduceFold）が単位律で消して畳み直す：`inc i double 1 2` は `inc double 1 2`、`inc i add 5 6` は `inc add 5 6`、
// 恒等射が受けた後に関数が来る形も、恒等射を消した並びと同じ木（法則13 の比べがそのまま答え）。書いた並びの見つからない所だけ、今のまま G18 で断る（split）。
function identityGate(e, s) {
  if (!s.fn || s.fn.type !== "id" || !s.recv.length || !s.at || isNormIdentity(e, s)) return;
  const first = s.at[0].at;
  const k = s.recv.length;
  const item0 = s.recv[0];
  const name = (t) => show(e.groups[t.group].item);
  const split = (message) => Object.assign(gate("G18", message), { unitLaw: e.groups[s.group].item });
  const idx = e.stages.indexOf(s);
  let prev = null; // 直前の、恒等射でない段（流れでも単位律でも、受けた1つで閉じた段）
  for (let j = idx + 1; j < e.stages.length; j++) {
    const t = e.stages[j];
    if (t.fn && t.fn.type === "id") continue;
    const boundary = !prev || t.group !== prev.group;
    const c = t.group === s.group ? -1 : composeAt(e, t.group);
    if (boundary && c >= first) {
      throw split(
        `恒等射が \`${show(item0)}\`${k > 1 ? ` ほか（${k} 項）` : ""}を受けた後に、関数 \`${name(t)}\` が合成されています。恒等射の結果を流れとして渡す読み（R29）では \`${name(t)}\` がそれを受けますが、恒等射を消した並び（単位律）では \`${name(t)}\` は値の後ろに積まれて、前の値を取りません（R47）。読みが割れます（§4 R29、§5 Q13）。`
      );
    }
    const type = t.fn && t.fn.type;
    if (!prev && k >= 2) {
      if (type === "pfGreedyUnary" || type === "norm") return;
      throw split(
        `恒等射が並び（${k} 項）を受けて、後ろに関数 \`${name(t)}\` が続きます。恒等射が並び全体を受けて1つの値で渡す読み（R29）と、単位律で恒等射の無い並びと同じに見る読み（\`${name(t)}\` が項を1つずつ受ける）で割れます（§4 R29、§5 Q13）。`
      );
    }
    // 単位律の読みでは、t は受けた1つ（!prev なら恒等射が受けた物、ほかは前の段の結果）をその場で受ける。
    // R51（2026-10-24）：受けた1つが撒いた流れなら、t は流れの1項として受ける（どちらの読みでも、passStream と streamInto が同じ段で
    // 受ける）。口が1つか2つなら書き下し（2026-10-25 から。試しの版は写像）か畳み込みで閉じて値を次へ渡すので、固定の口1つの段と同じく次の段で
    // 見る（`i inc vs~ double`・`i f2 vs~ inc` は、単位律では書き下し・畳み込みの値の後ろに関数が積まれて値を取らず、流れでは受けるので、上の
    // 「受けた後に合成された関数」の G18）。最後の口が可変長なら丸ごと受けて開いたままで、後ろの関数はどちらの読みでも合成。ほか（口が3つ以上・分からない・固定の口の後ろに
    // 可変長の口）は、どちらの読みでも G19 なので、ここでは断らない（passStream が G19）。前（R51 の前）は、撒く項を固定の口に受ければ埋まった
    // かが数えられない（R24、putArg の tainted）ので、口の数の分からない関数と同じに見て、後ろに関数があれば G18 にしていた。
    const sh0 = stageShape(t);
    if (!prev && isSpreadNode(item0)) {
      const m = streamMouths(t);
      if (m !== 1 && m !== 2) return;
      prev = t;
      continue;
    }
    if (sh0.unknown) {
      const later = e.stages.slice(j + 1).some((u) => !(u.fn && u.fn.type === "id") && u.group !== t.group && composeAt(e, u.group) >= first);
      if (later) {
        throw split(
          `恒等射が受けた物を、口の数の分からない関数 \`${name(t)}\` が受け、その後に関数が合成されています。恒等射を消した並び（単位律）では、\`${name(t)}\` が受けた後に関数が来るので、閉じたか、まだ受けるかが決まらず G2(a) ですが（R40 の読み6・R47）、流れとして渡す読み（R29）では通ります。読みが割れます（§4 R29、§5 Q13）。`
        );
      }
      return;
    }
    // 単位律の読みで、この段が受けた1つで閉じて値を次へ渡すのは、固定の口1つの段だけ。可変長・口が2つ以上の段は開いたままで、
    // 後ろの関数はどちらの読みでも合成になる。
    if (sh0.varying || sh0.fixed !== 1) return;
    prev = t;
  }
}

// `||!_||` の中の恒等射（同じ組で、すぐ後ろがノルムの段。enclosureInfo）。`||!_||` は1つの関数で、並び全体を受けて数える（利用者の式
// `||!_|| = [~x] ? ||x||`、U 10-21 02:54）ので、中の恒等射は単位律で消す物ではない（`5 ||!_|| 6` は `n : [~x] ? x` の `5 n 6` と同じく
// 並び全体を受ける）。
function isNormIdentity(e, s) {
  const nx = e.stages[e.stages.indexOf(s) + 1];
  return !!nx && nx.group === s.group && nx.fn === NORM_FN;
}

// 合成で足した組 g の、書いた順の位置（log の compose の位置）。関数の項を作った時からある組（組 0）は -1。
function composeAt(e, g) {
  return e.log.findIndex((ev) => ev.k === "compose" && ev.group === g);
}

// 固定の口が全部埋まった段の種類（§3.4、R9）。
function doneKind(s) {
  const fn = s.fn;
  switch (fn.type) {
    case "plain":
      // 実引数のどれかが印を持てば、印で実体を作る（R81、monoKind）。本体はその印で解くので、Reader・番地の点と差を値の演算子に置く形も本体の中の規則で読む。
      // 穴の関数は、穴に当てた物を頭に当てた実引数の並びに入れて、頭の素の関数の適用として読む（法則6。holeFnOf の注）。
      // R34 の k < n の関数（rest）は最後の括りが閉じた所（restCloseKind）で読む。
      if (fn.holeHead && !fn.rest) return plainApplyKind(fn.holeHead, holeFill(fn, s.recv));
      return plainApplyKind(fn, s.recv);
    case "pfUnary":
    case "norm":
      return A();
    case "pfPick":
      // 段18 の点なし（R77）：口1つが埋まれば `x ' k` と同じ desc（R26）。鍵が式・`[@ 0]`・`[x ']` は何を引いたか決まらないので未知（§2 の `x @ k`）。
      return fn.key ? pickDesc(descOfTree(s.recv[0]), fn.key) : U();
    case "pfBinary":
      return fn.root === "A" ? A() : U();
    case "pattern":
      noteExcess(fn, s.recv);
      return fn.instantiate(s.recv.map(argDescOf)).kind;
    default:
      return U();
  }
}

// R64（2026-10-26）：括りの名前は、括りが受けた List の前からの射影。`~rest` の無い括りの仮引数に、名前より多い要素の List が来たと書いた時点で分かる
// （書き並べた行の項の数・字面の List・数えられるファイルの値の名前・数えられる撒いた流れ。writtenLength・flowCount）なら、名前の無い要素は受けない
// （積み直さない）ことを information の bracket-excess で名指しする（重さは DIAG_SEVERITY の1か所）。最後の括りは並びの残りの全部、ほかの括りは実引数1つを
// 見る。書いた所の無い当て方（写像・畳み込みの要素、composeLeaf）では数えない。書いた所（括りに入った最初の実引数の項）ごとに1回。
// 根拠：主の Claude の案「余りは受けず、書いた時点で分かる形は information で名指し、残りが欲しければ `[a b ~c]`」に U〔答え〕[2026-10-25 23:41 c8ccdd69]
// 「キレイにまとまったね！」。
function noteExcess(fn, args) {
  const ctx = foldCtx;
  const base = fn.base || fn;
  if (!ctx || !ctx.diag || !ctx.F || !base.params) return;
  const off = fn.bound ? fn.bound.length : 0;
  base.params.forEach((p, i) => {
    if (i < off || p.kind !== "bracket" || !p.simple || p.rest || !p.names.length) return;
    const j = i - off;
    const items = i === base.params.length - 1 ? args.slice(j) : args.slice(j, j + 1);
    // 書いた所（知らせを1回にする鍵）は、括りに入った実引数のうち最初の書いた項。合成の前の段の結果（`inc fab 1 2 3` の `inc 1`）は書いた項を持たないので、
    // その次の書いた項を鍵にする（2026-10-26 の確かめの直し。前は書いた項を持たない物が1つでもあれば数えず、`fab (inc 1) 2 3` だけが知らせた）。
    const at = items.find((t) => !!t.term);
    if (!items.length || !at) return;
    // 1項なら、書いた器の数か文字列の文字の数（flowLength：String ≅ List(Char)、撒いた `` `abcd`~ `` の flowCount と同じ数え方。2026-10-26 の確かめの直し。
    // 前は writtenLength だけで、`` fab `abcd` `` は知らせず `` fab `abcd`~ `` だけが知らせた）。
    const count = items.length >= 2 ? (items.some(isSpreadNode) ? null : items.length) : isSpreadNode(items[0]) ? flowCount(items[0]) : excessLength(items[0], ctx);
    if (count === null || count <= p.names.length) return;
    if (ctx.F.reportedExcess.has(at.term)) return;
    ctx.F.reportedExcess.add(at.term);
    const names = `[${p.names.join(" ")}]`;
    const restHint = `[${[...p.names.slice(0, -1), `~${p.names[p.names.length - 1]}`].join(" ")}]`;
    pushDiag(
      ctx,
      "bracket-excess",
      base.label,
      `括りの関数 \`${base.label}\` の括り \`${names}\` は名前が ${p.names.length} つで、受けた List の要素は ${count} つです。名前は List の前からの射影で、名前の無い要素は受けません（積み直しません。§4 R64）。残りが欲しければ \`${restHint}\` と書きます。`
    );
  });
}

// noteExcess の1項の数：書いた器の数（writtenLength）か、文字列の文字の数。文字列も、余ったラムダが消えて残った1項（`` (`ab` inc) ``）はその1項で数える
// （writtenLength と同じく vanishedOne を通す。法則16：括りの中で値の上に積まれて閉じた関数は消えるので、`` pp (`ab` inc) 1 `` と `` pp (`ab`) 1 `` は同じ知らせ）。
// ファイルの値の定義を直に指す名前も、右辺の木で同じに数える（`` w : `ab` inc `` の w。器の数の valueCounts が writtenLength で vanishedOne を通すのと同じ。
// `:` はメタで、名前は右辺を閉じた1つの項として指す、R42 の読み7）。撒いた流れの数（flowLength・stringLength・stringCountOf）は変えない（知らせだけの数え方）。
function excessLength(t, ctx) {
  const n = writtenLength(t);
  return n !== null ? n : stringLengthThrough(t, ctx);
}
function stringLengthThrough(t, ctx) {
  const one = vanishedOne(t);
  if (one) return stringLengthThrough(one, ctx);
  if (t && t.t === "leaf" && t.cat === "plain" && t.term && t.term.type === "atom" && !t.term.pre.length && !t.term.post.length) {
    const c = t.term.core;
    if (c.c === "bracket" || c.c === "indent") {
      const rows = c.c === "bracket" ? t.view.inner : t.view.rows;
      return rows && rows.length === 1 ? stringLengthThrough(rows[0], ctx) : null;
    }
    if (c.c === "name" && (t.strCount === null || t.strCount === undefined) && ctx && ctx.F) {
      // 仮引数・括りと構造体のブロックの行の名前（local-field）に隠されていない、ファイルの値の定義（stringCountOf と同じ順に探す）。右辺に余ったラムダが消えた
      // 1項があれば、その1項で数える。寄せ1（R128）の前は、関数の本体の局所の定義（R80）も右辺の木で同じに数えていた。
      const hidden = (() => {
        for (let s = ctx.scope; s; s = s.parent) {
          if ((s.descs && s.descs.has(c.name)) || (s.params && s.params.has(c.name))) return true;
          if (s.locals && s.locals.has(c.name)) return true;
        }
        return false;
      })();
      const def = hidden ? null : ctx.F.defs.get(c.name);
      const root = def && !def.lambda ? ctx.F.defRoots.get(def) : null;
      const inner = root ? vanishedOne(root) : null;
      if (inner) return stringLengthThrough(inner, ctx);
    }
  }
  return stringLength(t);
}

// R91（§5 Q71 の答え）：括りの関数に当てる実引数の desc に、書いた時点で分かる長さ（len）を付ける（bindParams の短い括りの名前）。長さは、撒いた流れなら流れの数、
// ほかは flowLength（書いた器の数・文字列の文字の数・数は1）。分からなければ付けない。len は形にも実体の鍵（internDesc）にも入らず、名前が足りないときだけ鍵に足す。
const withLen = (d, n) => (typeof n === "number" && !!d && d.k === "A" ? { ...d, len: n } : d);
const argDescOf = (t) => withLen(descOfTree(t), isSpreadNode(t) ? flowCount(t) : flowLength(t));

// 並びの終わりで閉じた段の種類（R41）。撒く項を受けていれば、k を数えないので未知（R24。括りの関数は実体を作らない、§5 Q29）。
function closeKind(s) {
  const fn = s.fn;
  const args = s.recv;
  const k = args.length;
  // 貪欲な単項（`[* 2,]`・`[F,]`）は、撒いた流れを丸ごと受けても結果は List（R51。撒いた並びは流れの1項で、流れは
  // いくつでも1項。空の流れの写像は空の List。`[inc,] [1 2 3]~` は `[2 3 4]`、U [2026-10-25 07:37 2772473e]「[ink,] [1 2 3]~ が [2 3 4] になるのも
  // 大事だと思う。」）。前（2026-10-24 の R51 の前）は撒く項があれば k を数えないので未知だった（R24）。写す関数があれば、要素ごとに当てた
  // 種類が全部 A のときだけ A（mapOver）。
  // 写す関数の無い貪欲な単項も、写す器の中身に関数か未知が見えれば G7（`[[* 2],] fs` と揃える。mapOver の注）。
  if (fn && fn.type === "pfGreedyUnary" && !s.tainted) return mapOver(fn.map || null, args);
  // R64（2026-10-26）：括りの関数の最後の括り（参照の口）に入ったのが撒いた流れ1つだけ（`f vs~`・`map $inc vs~`・`f [1 2 3]~`）なら、流れの要素を書き並べた
  // 行（`f 1 2 3`）と同じ1つの List、つまり撒いた器そのもの（`f vs`・`f [1 2 3]`）を受ける。参照の口では余積の並びと積の並びが同じ List（双積の点、R）で、
  // R51 の「最後の口が可変長なら丸ごと受ける」の丸ごとはこの List。前（R51 の決定）は撒く項で k を数えない（R24）ので未知で、`f vs` の A と割れていた
  // （主の Claude の 2026-10-25 22:54 の文が名指しした割れ）。流れと書いた実引数の混ざった形（`f 1 vs~`）は今のまま未知（§5 Q29）。
  if (fn && fn.type === "pattern" && fn.lastBracket && !s.tainted && k === fn.n && isSpreadNode(args[k - 1]) && args[k - 1].desc.of && !args.slice(0, -1).some(isSpreadNode)) {
    noteExcess(fn, args);
    return fn.instantiate([...args.slice(0, -1).map(argDescOf), withLen(args[k - 1].desc.of, flowCount(args[k - 1]))]).kind;
  }
  if (s.tainted || args.some(isSpreadNode)) return U();
  switch (fn && fn.type) {
    case "pfGreedyUnary":
      return A();
    case "pfFold":
      // 畳む2項の点なし（R31）：k ≥ 2 は中置の値の演算子と同じく A。k = 1 は foldOneKind。
      // k ≥ 2 の値の記号の畳み込みは、実引数の関数を指す番地を G7、番地の点・差を G21 で断る（R60 の細かい所・R62、§5 Q66。argOperand の注）。
      if (k >= 2 && fn.vop) for (const t of args) valueOperand(descOfTree(t), null, () => readerText(t, false));
      // 2026-10-26 の確かめの直し（hasAddr の注）：1項の器を畳む形（`[+] [($x + 0x10) ($x + 0x10)]`）は、器の中の点・差に値の記号を当てるので、k ≥ 2 と同じく
      // G21。論理の記号の畳み込み（`[|]`・`[&]`・`[;]`）は、中置の論理と同じく、答えが通った側の値で点・差の印が落ちるので G21（§5 Q66）。
      // 1項の点・差そのもの（`[+] ($x + 0x10)`）は演算を当てない（R31 の foldOneKind）ので、今のまま未知。
      if (fn.vop && k === 1 && hasAddr(descOfTree(args[0])) && !addrOf(descOfTree(args[0]))) throw refuseAddressSpelling(null, readerText(args[0], false));
      if (!fn.vop) for (const t of args) if (treeHasAddr(t)) throw refuseAddressDrop("logic", readerText(t, false), { sym: `[${fn.sym}]`, operand: readerText(t, false) });
      return k === 1 ? foldOneKind(args[0]) : A();
    // 段18 の点なし（`[' k]`）は 2026-10-26 から口1つの関数で、口が埋まった所（doneKind）で閉じるので、ここには来ない（R77。前は並びの終わりで閉じ、
    // 1つなら `x ' k` と同じ desc、2つ以上なら未知だった）。
    case "id":
      // 恒等射（R29）：1項なら受けた物そのもの（desc ごと）、2項以上なら並び（中身の見えない A）。
      return k === 1 ? descOfTree(args[0]) : A();
    case "pattern": {
      // 最後の仮引数が括りの関数（R24）：前の仮引数に1つずつ当て、残りの並び全体を最後の括りが1つの List として受ける（R64：名前はその List の射影）。
      noteExcess(fn, args);
      if (k === fn.n) return fn.instantiate(args.map(argDescOf)).kind;
      const front = args.slice(0, fn.n - 1).map(argDescOf);
      const restTree = { t: "construct", items: args.slice(fn.n - 1), kind: A() };
      const rest = withLen(descOfTree(restTree), writtenLength(restTree)); // 長さは括って書いた `[e1 … em]`・積の `e1 , … , em` と同じ数え方（法則23）
      return fn.instantiate([...front, rest]).kind;
    }
    case "plain":
      return restCloseKind(fn, args);
    default:
      return U(); // 前置 `@`・`[,]`・既定値のある関数（§5 Q8）・アリティの分からない関数
  }
}

// R34 の k < n で作った関数（`a [~c] ? f3 a 2 c~`）の最後の括り `[~c]` が閉じた。c に入った物の数だけ、元の関数の書いていない口を
// 埋める。1つだけ入った物は、[x] ≅ x でその中身の並び（R24。`(f3 !_) 1 [1 2]` は `f3 1 1 2`）。数が数えられなければ未知。足りなければ
// 元の関数の部分適用（L）、ちょうどなら本体の根、多ければ元の関数の余り（後ろに積む、R35）。元の関数の本体の根が値でないのに
// 余りがあれば種類の未知な物（片イ、R120：結果に当てるか積むかは値の段が左から決める。前は G2(a)。穴を埋めた綴りと同じ、法則6）。
function restCloseKind(fn, args) {
  const len = cLength(args.slice(fn.restAt || 0));
  if (len === null) return U();
  const m = fn.n - (fn.restAt || 0);
  if (fn.holeHead) {
    const mono = restHoleKind(fn, args, len, m);
    if (mono) return mono;
  }
  if (len < m) return { k: "L", fn: { type: "plain", origin: "partial", n: m - len, getBodyRoot: fn.getBodyRoot, idKey: fn.idKey, envDepth: fn.envDepth } };
  const root = fn.getBodyRoot();
  return root === "A" ? A() : U();
}
// 最後の括りに入った物の、撒いたときの数。数えられなければ null。
function cLength(C) {
  if (!C.length || C.some(isSpreadNode)) return null;
  if (C.length >= 2) return C.length;
  return writtenLength(C[0]);
}
// 書いた器の中身の数（[x] ≅ x）。数は 1。中身が見えて、要素が全部値のときだけ数える。
function writtenLength(t) {
  const d = descOfTree(t);
  if (isScalar(d)) return 1;
  const allA = (xs) => xs.every((x) => !!x && !isSpreadNode(x) && elementKind(x) === "A");
  const one = vanishedOne(t); // 余ったラムダは消える（vanishedOne の注）
  if (one) return writtenLength(one);
  if (t.t === "construct") {
    const live = liveItems(t.items);
    return allA(live) ? live.length : null;
  }
  if (t.t === "op" && t.sym === ",") {
    const xs = commaItems(t);
    return allA(xs) ? xs.length : null;
  }
  if (t.t === "leaf" && t.cat === "plain" && !t.desc.spread && t.term && t.term.type === "atom" && !t.term.pre.length && !t.term.post.length) {
    const c = t.term.core.c;
    // 名前は、ファイルの値の定義を直に指すときだけ、右辺の器の数（nameKindOf・valueCountOf）。仮引数は数えない。
    if (c === "name") return t.count !== null && t.count !== undefined && deepKind(t.desc) === "A" ? t.count : null;
    if (c === "bracket" || c === "indent") {
      const rows = c === "bracket" ? t.view.inner : t.view.rows;
      if (!rows) return null;
      if (!rows.length) return t.desc.k === "A" ? 0 : null;
      if (rows.length >= 2) return rows.every((r) => !!r && !(r.t === "op" && r.sym === ":")) && allA(rows) ? rows.length : null;
      return writtenLength(rows[0]);
    }
  }
  return null;
}
// writtenLength で数えた物の、要素の木の並び（数えたのと同じ道。[x] ≅ x で1つの数・1行の括りはその中身）。名前（ファイルの値の定義の右辺の数）は木が無いので null。
function writtenItems(t) {
  if (isScalar(descOfTree(t))) return [t];
  const one = vanishedOne(t);
  if (one) return writtenItems(one);
  if (t.t === "construct") return liveItems(t.items);
  if (t.t === "op" && t.sym === ",") return commaItems(t);
  if (t.t === "leaf" && t.cat === "plain" && t.term && t.term.type === "atom" && !t.term.pre.length && !t.term.post.length) {
    const c = t.term.core.c;
    if (c === "bracket" || c === "indent") {
      const rows = c === "bracket" ? t.view.inner : t.view.rows;
      if (!rows) return null;
      if (rows.length !== 1) return rows;
      return writtenItems(rows[0]);
    }
  }
  return null;
}
// desc が印（R81 の4つ）を持つか、中身（List の要素・構造体の欄）に印か番地の点・差を持つか。
function markedDeep(d, depth = 0) {
  if (!d || depth > 32) return false;
  if (monoMarked(d) || addrOf(d)) return true;
  const sh = d.k === "A" && !d.spread ? d.shape : null;
  if (!sh) return false;
  if (sh.s === "list") return markedDeep(sh.elem, depth + 1);
  if (sh.s === "struct") return sh.fields.some((f) => markedDeep(f.desc, depth + 1));
  return false;
}
// R34 の k < n で作った穴の関数（rest）を閉じた所で、頭に当てた実引数の並び（書いた物・穴に当てた物・最後の括りに入った物）に印があれば、頭の素の関数の
// 適用として読む（R81、2026-10-26 の確かめの直し。法則6：`(f3 !_ 2) 1 $5` は `f3 1 2 $5`）。印が無ければ null（restCloseKind の今の読み）。
// 最後の括りに入った物の要素の木が無い（[x] ≅ x で数えた名前の中身）のに印があれば、どの口に入るかを実体の口に並べ直せないので G7 で断る（§5 Q45 の残り）。
function restHoleKind(fn, args, len, m) {
  const at = fn.restAt || 0;
  const filled = holeFill(fn, args.slice(0, at));
  const C = [...(fn.holeC || []), ...args.slice(at)];
  // 印は、最後の括りに入った物を [x] ≅ x で開いた要素ごとに見る（`(f3 !_) 1 [2 $5]` は `f3 1 2 $5`。開く前の器の desc は、形の揃わない要素の印を混ぜて落とす）。
  const items = C.length >= 2 ? C : C.length === 1 ? writtenItems(C[0]) : null;
  const opened = !fn.holeC && !!items && items.length === len;
  if (![...filled, ...(opened ? items : C)].some((t) => markedDeep(descOfTree(t)))) return null;
  const label = fn.holeHead.label || `[${cutShape(writeTree(fn.holeHead.op))}]`;
  if (!opened) {
    throw gate(
      "G7",
      `R34 の k < n で作った関数（素の関数 \`${label}\` の穴の関数。書いていない後ろの口を最後の括りで受ける）の口に、印（関数の番地・値を読む参照・番地の点と差・書いた \`_\`）を持つ物が入りましたが、最後の括りに入った物の中身の木が見えないので、元の関数のどの口に入るかを並べ直せません。印で実体を作る（R81）読みに並べ直す作りが無いので、断る側に倒しました（§4 R34・R81、§5 Q45 の残り）。`
    );
  }
  const full = [...filled, ...items.slice(0, m)];
  if (len < m) {
    // 足りない：元の関数の部分適用（L）。当てた物を持ち越し、残りが来たら印で実体を作る（partialFn の部分適用と同じ形）。
    const head = fn.holeHead;
    const out = { type: "plain", origin: "partial", n: head.n - full.length, getBodyRoot: head.getBodyRoot, idKey: head.idKey, envDepth: head.envDepth, base: head, bound: full.map(descOfTree) };
    if (head.op) {
      out.op = head.op;
      out.label = head.label;
      out.at = full.length;
      out.readers = full.map((t, i) => (plainReaderArg(descOfTree(t)) ? { i, tree: t } : null)).filter(Boolean);
    }
    return { k: "L", fn: out };
  }
  const kind = plainApplyKind(fn.holeHead, full);
  if (len === m || kind.k === "A") return kind.k === "A" ? A() : kind;
  return U(); // 余りがあって結果が値と分からない：種類の未知な物（片イ、R120。前は G2(a)）
}

// ---- 撒いた並びは流れの1項（R51）と `[F,]` の写像（R50） ----
//
// 根拠：U [2026-10-24 04:27 ebf18260]「2引数の関数に対して、list~ を渡したら畳み込みってのは？」。主の Claude の問い「撒いた並びは流れの1項で、
// 関数は残りの口が1つなら写像、2つなら畳み込み、で読んでいい？」に U〔答え〕[2026-10-24 04:30 ebf18260]「試しにやってみよう！…悪ければ
// ロールバックしよう。」（試し）。2026-10-25 に、口が1つの所を書き下しに直して決定にした：U [2026-10-25 07:24 2772473e]「…渡されたリストに後置~が
// 指定される場合、 アリティ2の関数は畳み込み演算と見做せる アリティ1の関数の後ろに , 演算子を置いた関数は、写像と見做せる。…」、
// U [2026-10-25 07:27 2772473e]「飽くまで、[+ 1,] [1 2 3]~ が [2 3 4] であるべきで、 [+ 1] [1 2 3]~ は [2 2 3] になるはずだと答えたつもりだった。…」。
// 主の Claude の問い「撒いた流れは、口2つなら畳み込み、口1つなら書き下し（写像は `[f,]` だけ）。R51 をこう直して試しの印を外し、Q56 は `$!_` が
// `[x ? x]` を指す、でいい？」（07:29 UTC）に U〔答え〕[2026-10-25 07:34 2772473e]「そうか分かった！ map : f [~l] ? [@f,] l~ に対して、 map $!_ .. と
// map $[!_] .. で分かれる。 安心した。」。試し（2026-10-24）の「口が1つなら写像」は主の Claude が足した物で、U〔答え〕[2026-09-28 00:58 023dec41]
// 「どちらも [2 2 3] じゃない？」（`,` の無い `[+ 1] [1 2 3]~` の答え）とぶつかっていた。
// 種類は、要素の desc で関数を当てた種類で決める（写像は要素ごとに1つ、畳み込みは2つ、書き下しは流れの頭に1つ）。結果は中身の見えない A（R24 の
// 適用の結果）。

// 器の要素の desc の代表（形は長さに依らないので、List は要素の desc 1つ）。空の器は []。中身に関数か未知が見える器は null。
// 中身の見えない器（裸の仮引数・適用の結果・`$` の番地）の要素は、中身の見えない A（裸の仮引数と同じ扱い）。
function elemsOfContainer(d) {
  if (!d) return [A()];
  if (d.k !== "A") return null;
  // `$` が作った Reader は、[x] ≅ x でそれ1つを要素にする（`[inc,] $5` は `inc $5` と同じく、写した関数が Reader を受ける）。Reader に関数を写す
  // 読み（fmap、読んでから当てる）は §5 Q59 の割れる読みの1つで、2026-10-26 の答え（R62）でも採らなかったので、Reader を受けた関数の所で断る側に揃える（R60 の細かい所。
  // 前は中身の見えない器と同じ A の要素で、写した関数が Reader を見ずに通った）。
  if (readerOf(d)) return [d];
  if (d.elements && d.elements.some((k) => k !== "A")) return null;
  if (isEmptyBracket(d)) return []; // 書いた空の括り `[]`（bracketInfo の desc は形が無く、要素が空）
  if (d.shape) {
    if (d.shape.s === "list") {
      if (!d.shape.elem) return [];
      return deepKind(d.shape.elem) === "A" ? [d.shape.elem] : null;
    }
    if (d.shape.s === "scalar") return [scalarDesc()]; // 数は長さ1の List（[x] ≅ x）
    if (d.shape.s === "struct") return d.shape.fields.every((f) => deepKind(f.desc) === "A") ? [A()] : null;
  }
  return [A()];
}
// 貪欲な単項が受けた物の要素の desc。1つだけ受けた器は、その要素（`[* 2,] \`ab\`` は文字ごと）。撒く項は、撒いた器の要素。ほかは受けた物
// そのもの。数えられなければ null。
function elemsOfItems(args) {
  if (args.length === 1 && !isSpreadNode(args[0])) return elemsOfContainer(descOfTree(args[0]));
  const out = [];
  for (const t of args) {
    if (!isSpreadNode(t)) {
      out.push(descOfTree(t));
      continue;
    }
    const es = elemsOfContainer(t.desc.of);
    if (es === null) return null;
    out.push(...es);
  }
  return out;
}
// 畳み込み（R51）の結果を、要素の側の値と言える器か（R31 の foldOneKind が A にする物と同じ線）：数と、中身の見える List で深く見て要素が
// 全部 A の物（空の List・文字列も）。中身の見えない器（裸の仮引数・適用の結果・`$` の番地）は、器なら要素に関数があるかもしれず、要素が
// 1つなら左からの畳み込みは関数を当てずにその要素を返す（foldl1）ので、結果が関数でありうる。構造体は欄を畳む読みがどの言葉にも無い。
// どちらも、畳んだ種類を未知にする（2026-10-24 の試しの反証で見つかった黙った誤答の直し：`first : x y ? x`・`tl : [y ~ys] ? ys`・
// `fs : inc , double , inc` の `first (tl fs)~ 5` を構築の A と読んでいた。`tl fs` は `[double inc]` なので畳んだ値は double（関数）で、5 は
// それに当たる。中身の見えない A の要素を A と読む elemsOfContainer は写像の読みで、写した結果はいつも List なので、写像には効かない）。
function foldableContainer(d) {
  if (!d) return false;
  if (isScalar(d) || isEmptyBracket(d)) return true; // 空の流れは `_`（R51）
  return d.k === "A" && !d.spread && !!d.shape && d.shape.s === "list" && deepKind(d) === "A";
}
const isEmptyBracket = (d) => !!d && d.k === "A" && !d.spread && !d.shape && !d.ref && !d.vref && !!d.elements && d.elements.length === 0;
// 関数 fn に desc の並びを前から当てた種類（足りた所で止める）。足りなければ未知。合成も括りの関数（実体を作る）も、並びに書いて当てたのと
// 同じ仕組み（feed）で解く。close なら、当て終えた所で並びの終わりとして閉じる（可変長の口だけの関数を要素1つに当てる `[F,]` の写像、R50。
// `[hd,] ws` の `hd w` は、行 `hd w` と同じく最後の括りが w 1つを受けて閉じる）。
function applyKind(fn, descs, close = false) {
  const outer = foldCtx;
  const outerSeq = foldSeq;
  foldCtx = null; // 書いた所の無い当て方では知らせない（foldCtx の注）
  foldSeq = null;
  try {
    const e = newEntry({ t: "leaf", term: null, cat: "plain", desc: { k: "L", fn }, kind: { k: "L", fn }, view: { v: "atom", text: "·" } });
    for (const d of descs) {
      if (entryDone(e)) return U();
      feed(e, composeLeaf(d));
    }
    if (close && !entryDone(e)) closeEntry(e);
    return entryDone(e) ? e.stages[e.stages.length - 1].result : U();
  } finally {
    foldCtx = outer;
    foldSeq = outerSeq;
  }
}
// 同じ desc（鍵で見る）を1つにまとめる。
function distinctDescs(ds) {
  const seen = new Map();
  for (const d of ds) seen.set(descKey(d), d);
  return [...seen.values()];
}
function refuseMapped(what) {
  return gate("G7", `${what}の中身に、関数か種類の未知な物が見えます。写すか畳むか書き下すかを、中身の関数をどの段で解くかと一緒に決めていません（§5 Q20、§4 R50・R51）。`);
}
// 写像（R50。`[f,]` が撒いた流れを丸ごと受けた所も、R51）：要素ごとに fn を1つ当てた種類が全部 A なら A（List）、ほかは未知。空の器は A（空の List）。fn が無い（写す関数を持たない
// 貪欲な単項 `[* 2,]`・`[-_,]`）なら、要素を見て A。写す器の中身に関数か未知が見えれば、どちらも G7（`[[* 2],] fs` と `[* 2,] fs` は同じ
// 写像なので、同じ答えにする。2026-10-24 の試しの反証で見つかった綴りの割れの直し。前は `[* 2,] fs` だけ A で、要素の `inc * 2` は G7 の形）。
function mapOver(fn, args) {
  const elems = elemsOfItems(args);
  if (elems === null) throw refuseMapped("写す器");
  if (!fn) return A();
  for (const e of distinctDescs(elems)) if (applyKind(fn, [e], true).k !== "A") return U();
  return A();
}
// 左からの畳み込み（foldl1、R51）：要素の desc で fn を2つ当てた種類。括りの関数は渡した形で答えが変わりうるので、前の結果を左に当て直して
// 形の鍵が落ち着くまで見る（素の関数は1回で落ち着く）。落ち着かなければ未知。空の流れは `_`（単位）で A。撒いた器が、畳んだ結果を要素の側の
// 値と言える器でなければ未知（foldableContainer）。
const FOLD_SETTLE_LIMIT = 8;
function foldOver(fn, args) {
  const elems = elemsOfItems(args);
  if (elems === null) throw refuseMapped("畳む器");
  if (args.some((t) => isSpreadNode(t) && !foldableContainer(t.desc.of))) return U();
  if (!elems.length) return A();
  const reps = distinctDescs(elems);
  for (const e of reps) {
    let acc = applyKind(fn, [e, e]);
    for (let i = 0; ; i++) {
      if (acc.k !== "A") return U();
      const next = applyKind(fn, [acc, e]);
      if (next.k !== "A") return U();
      if (descKey(next) === descKey(acc)) break;
      if (i >= FOLD_SETTLE_LIMIT) return U();
      acc = next;
    }
  }
  return A();
}
// 段 s の、撒いた流れを受ける口（R51）：'whole'（可変長の口で、その前の固定の口が埋まっている＝丸ごと受ける）・残りの固定の口の数・
// null（口の数が分からない・固定の口の後ろに可変長の口がある）。
function streamMouths(s) {
  const sh = stageShape(s);
  if (sh.unknown) return null;
  if (sh.varying) return s.recv.length >= sh.fixed ? "whole" : null;
  return sh.fixed - s.recv.length;
}
// 畳み込みの1歩で、いちばん上の関数 top に撒く項 x が来た（R51）。x は、いちばん最初の閉じていない段から後ろの関数全体（合成ならカリー化された
// 1つの関数、R58）の残りの口の数で受ける：2つなら左からの畳み込みで関数の項は閉じ（`add inc vs~` は g(x, y) = inc (add x y) の畳み込み）、1つなら
// 書き下し（writeOut）。受けたら true。丸ごと受けるなら false（今までどおり、その段の可変長の口に入れる）。ほかは G19。
function streamStep(top, x) {
  const s = curStage(top);
  if (streamMouths(s) === "whole") return false;
  top.log.push({ k: "arg", tree: x, group: s.group });
  top.groups[s.group].args.push({ tree: x });
  streamInto(top, s, x);
  return true;
}
// 段 s に撒いた流れ x を入れる（R51・R58）：丸ごとなら可変長の口に入れ（putArg）、s から後ろの関数全体の口が2つなら、その関数全体の畳み込みで
// 関数の項を閉じ（closeWhole）、口が1つなら書き下す（writeOut）。ほかは G19。書いた実引数の記録（log）は呼ぶ側が付ける（恒等射から流れてきた
// 流れは、書いた実引数ではない）。
function streamInto(e, s, x) {
  const m = streamMouths(s);
  if (m === "whole") return void putArg(e, s, x);
  if (m !== 1 && m !== 2) {
    // 印の無い `@x`（素の関数の定義の行と印の無い実引数で読む本体の仮引数。R49 の印が届かない所。印のある実引数の実体は R81 で届く）は、口の数が分からない
    // 前置 `@` の項のまま（§5 Q45 の残り）。言い分でそれを名指しする
    // （2026-10-24 の確かめ。そのときは別名の `cc : add inc` の `fold $cc vs` もここで断っていたが、2026-10-25 の R55 で通る。恒等射の `$!_`・`$i` も
    // 同じ日の Q56 の答えで1引数の恒等射の印を持ち、ここに来ない）。
    const input = !!s.fn && s.fn.type === "input";
    const why =
      m === null
        ? input
          ? "前置 `@` の項が指す名前に、関数を指す番地の印（R49）が届いていないので、口の数が分かりません。印は `$名前`（関数の定義・別名・恒等射）・`$[…]`・`$_`・`$!_` が持ち、括りの関数の実体と、印のある実引数で呼んだ素の関数の実体（R81）の裸の仮引数・欄・器の要素に渡れば届きますが、素の関数の定義の行の読み（印の無い実引数の読み）には届きません（§5 Q45 の残り）"
          : "口の数が分からないか、固定の口の後ろに可変長の口があります"
        : `口が ${m} つ残っています`;
    // 口が3つ以上・分からない・固定の口の後ろに可変長の口がある関数の読み（前から詰める・3つずつ畳む・断る）は、2026-10-25 の答えに無いので
    // §5 Q46 に残っている（同じ日の確かめの指摘で、言い分に名指しを足した）。口が3つ以上の所は、2026-10-25 21:56 の答え（U〔答え〕[c8ccdd69]「f3 vs~ は、
    // 確かにListを参照で渡す関数にしてくれという話に出来ると思う。つまりStream（余積）とConstruct（積）の間に境界線を引けるという事になるから、その傾きで
    // 合ってる」）で断るに決まった。2026-10-26 から、言い分で参照の口を案内する（主の Claude の 2026-10-25 22:48 の文「言い分に「リストを渡すなら、仮引数を
    // 括り（`[a b c]`）にして参照で受ける」を足しておくね」）。案内を付けるのは、口の数が3つ以上と数えられる所だけ（2026-10-26 の確かめの直し。最初の版は
    // 口の数の分からない関数・固定の口の後ろに可変長の口がある関数（もう括りで受けている `pb2 vs~`・既定値のある `go vs~`）にも付けていた）。
    const hint = typeof m === "number" && m >= 3 ? `リストを位置どおりに分けて渡すなら、仮引数を括り（\`[a b c]\`）にして参照で受けます（\`g : [a b c] ? f3 a b c\` ⏎ \`g vs\`。§4 R64）。` : "";
    throw gate(
      "G19",
      `撒いた流れ \`${show(x)}\` を受ける関数 \`${show(e.groups[s.group].item)}\` の、撒いた流れを受ける口の数が決まりません（${why}）。撒いた流れは、残りの口が1つなら書き下し、2つなら左からの畳み込み、最後の口が可変長なら丸ごと受けます。口が3つ以上か分からない関数がどう受けるかは決まっていないので断ります（§4 R51、§5 Q46）。${hint}`
    );
  }
  const fn = partialFn(s);
  // 畳まない2項の点なし（R32。`[<<]`・`[>>]`・`[!=]`・範囲・get・set）は口が2つでも畳まない：利用者が畳めないと言った記号を、撒いた流れで
  // 黙って畳まない（U [2026-10-21 08:55 cfb4de1d]「ビットシフトとget set は 畳めないね。」。2026-10-24 の試しの反証で見つかった。前は畳んで A、
  // しかも同じ行に「畳めない」の information が出ていた）。1つ当てた部分適用（`([<<] 1) vs~`）は口が1つの書き下しで、畳まないので通す。§5 Q49。
  if (m === 2 && fn && fn.type === "pfBinary") {
    throw gate(
      "G19",
      `撒いた流れ \`${show(x)}\` を、畳まない2項の点なし \`${show(e.groups[s.group].item)}\` が受けました。口は2つですが、\`[${fn.sym}]\` は畳めない点なし（§4 R32）なので、左からの畳み込み（R51）で読むかは決まっていません（§4 R51、§5 Q49）。`
    );
  }
  // 合成に来た流れ（R58、§5 Q58 の答え）：合成は1つの関数なので、撒いた流れは、流れを受ける段から後ろの合成全体（カリー化された1つの関数）の
  // 残りの口の数で受ける。2つなら合成全体を2引数の関数として左から畳み（`inc add vs~` は g(x, y) = add (inc x) y の畳み込みで値は 8、`add inc vs~` は
  // g(x, y) = inc (add x y) で 8）、1つなら書き下し（`inc double vs~` は `(inc double 1) 2 3`）、3つ以上か分からなければ G19（`inc f3 vs~`、§5 Q46）。
  // 名前や括りで包んだ合成（`g2 : inc add` ⏎ `g2 vs~`）も、組の中の関数を段に開いてあるので同じ答え。書き並べた実引数が合成を流れるのは今のまま
  // （R40・R11。`inc add 1 2 3` は `add (inc 1) 2` の後ろに 3）。
  // 根拠：主の Claude の問い「合成に入った流れは、合成全体を1つの関数として口の数で受ける、でいい？」（2026-10-25 10:06 UTC）に、利用者は主の Claude が
  // 用意したボタン「合成全体で受ける」を選んだ（U〔答え〕[2026-10-25 14:39 533071da]。ボタンの文は主の Claude の物：「合成は1つの関数なので、撒いた流れは
  // 合成全体の口の数で受ける（2つなら畳み込み、1つなら書き下し、3つ以上は G19）。」）。
  // 前（R51 の決定の片の確かめの直し、2026-10-25）は、読みが3つ（(a) 書き並べ・(b) 合成は適用の繰り返し・(c) 合成全体）に割れるので、合成全体の口が
  // 流れを受けた段の口と違えば G19 で断り（§5 Q58）、同じなら最初の段だけを畳むか書き下して結果を次の段へ流していた（`add inc vs~` は `inc (add vs~)` の 7。
  // 木と種類は (c) と同じ）。
  const later = e.stages.slice(e.stages.indexOf(s) + 1);
  const c = later.length ? composedMouths(m, later) : m;
  if (c !== 1 && c !== 2) throw refuseComposedStream(e, s, x, m, c);
  if (c === 1) return void writeOut(e, s, x, flowCount(x));
  // 合成全体の口が2つ：畳むのは口が2つの段の関数なので、その段が畳まない2項の点なし（R32）なら、上の段1つのときと同じく畳まない（§5 Q49）。
  const whole = later.length ? { type: "compose", fns: [fn, ...later.map((t) => t.fn)] } : fn;
  const pair = later.find((t) => mouthsOf(t.fn) === 2);
  if (pair && pair.fn.type === "pfBinary") {
    throw gate(
      "G19",
      `撒いた流れ \`${show(x)}\` を受ける合成の、口が2つの段 \`${show(e.groups[pair.group].item)}\` は畳まない2項の点なし（§4 R32）です。合成全体を2引数の関数として畳むと、その点なしで畳むことになりますが、畳めない記号を撒いた流れで畳むかは決まっていません（§4 R51・R58、§5 Q49）。`
    );
  }
  closeWhole(e, s, x, foldOver(whole, [x]));
}
// 流れを受けた段の口 m と、その後ろの段から、合成全体の口の数（mouthsOf の合成と同じ数え方：後ろの関数は前の結果で口を1つ埋める）。後ろの段に
// 口の数の分からない関数か可変長の口の関数があれば null。
function composedMouths(m, later) {
  let total = m;
  for (const t of later) {
    const k = mouthsOf(partialFn(t));
    if (k === null || k < 1) return null;
    total += k - 1;
  }
  return total;
}
// 合成全体の畳み込み（R58）で、流れを受けた段 s から後ろの段を全部閉じる。種類は合成全体を畳んだ種類 kind で、いちばん後ろの段の結果に置く。
// 間の段は合成全体の中で畳まれていて、段ごとの結果を持たない（未知にしておく。描くのは renderEntry で、根の種類はいちばん後ろの段の結果）。
// 後ろの組は前の組の結果を1つの値として受けたのではない（合成全体が流れを受けた）ので、流れの印（flowIn）は付けない。
// 木（renderEntry）は、流れを合成全体に当てた書いた順の綴りにする（`inc add 5 f2 vs~` は `(apply (compose (apply (compose inc add) 5) f2) vs~)`）：
// 流れを書いた実引数の記録（log）に印 whole を付け、後ろの組が並びから受けた（入れ子の綴りにする）とは数えない（logShape）。
function closeWhole(e, s, x, kind) {
  s.recv.push(x);
  const ev = e.log.findLast((v) => v.k === "arg" && v.tree === x);
  if (ev && e.stages.indexOf(s) < e.stages.length - 1) ev.whole = true;
  const idx = e.stages.indexOf(s);
  for (let j = idx; j < e.stages.length; j++) {
    const t = e.stages[j];
    const last = j === e.stages.length - 1;
    t.done = true;
    t.result = last ? kind : U();
    e.groups[t.group].result = last ? kind : U();
  }
}
// 撒いた流れを受ける合成全体の口が、1つ・2つのどちらでもない（R58。口が3つ以上か、口の数が分からない：§5 Q46）。
function refuseComposedStream(e, s, x, m, c) {
  const whole = e.groups.map((g) => show(g.item)).join(" ");
  return gate(
    "G19",
    `撒いた流れ \`${show(x)}\` が、合成 \`${whole}\` の閉じていない段 \`${show(e.groups[s.group].item)}\`（残りの口 ${m} つ）に入りました。合成は1つの関数なので、流れは合成全体の残りの口の数で受けます（1つなら書き下し、2つなら左からの畳み込み、§4 R58）が、合成全体の口は${c === null ? "数が分からない（口の数の分からない関数か、可変長の口の関数が後ろの段にある）" : ` ${c} つ`}です。口が3つ以上か分からない関数がどう受けるかは決まっていないので断ります（§4 R51・R58、§5 Q46）。${typeof c === "number" && c >= 3 ? "リストを位置どおりに分けて渡すなら、仮引数を括り（`[a b c]`）にして参照で受けます（§4 R64）。" : ""}`
  );
}
// 撒いた流れの書き下し（R51、2026-10-25 の決定。口が1つの段）：流れの頭を段の口に当て（段は閉じ、結果は次の段の最初の口に入る、settle）、残りは
// 後ろに積む（R47・R35）。書いた `[+ 1] 1 2 3` と同じく、`[+ 1] [1 2 3]~` は `([+ 1] 1) 2 3`（値は `[2 2 3]`、U〔答え〕09-28 00:58）、`inc vs~` は
// `(inc 1) 2 3`、`add 1 vs~` は `(add 1 1) 2 3`。写像は `[f,]` だけ（R50。`[f,] xs~` は可変長の口が丸ごと受けて写す）。
// n は流れの要素の数（flowCount。数えられなければ null）。木は今までどおり、撒く項を実引数に書いた `(apply L xs~)`。
// - 頭の種類は、要素の desc で関数を当てた種類（段の口に入れて閉じる。括りの関数なら要素の desc で実体を作る）。関数の項が閉じたら、余りの要素は
//   値（elemsOfContainer が A と言った物）なので、項は頭の結果と余りを積んだ構築と同じ形（書いた `inc 1 2 3` の `(construct (apply inc 1) 2 3)` と
//   同じく、頭の結果と余りの要素の desc を合わせた List の形 `[A…]`。2026-10-25 の確かめの指摘で直した。前は形の見えない A で、`io1 (inc vs~)` が
//   G7、書いた `io1 (inc 1 2 3)` が A と割れていた）。余りの要素は器の要素の代表（形は長さに依らない）なので、中身の形の混ざった器では、書き並べより
//   見える物が少ない（断る側・未知の側。§5 Q57）。頭の結果の種類が決まらないのに余りがあれば、書いた `uu 1 2 3` と同じく種類の未知な物（片イ、R120。前は G2(a)）。
// - 数えられない流れ（裸の仮引数・括りの仮引数・適用の結果を撒いた物）は、頭があるか（空の流れか）・余りがあるかが決まらないので、段から先を未知に
//   する（根なら通り、後ろに項が来れば G2(a)。試しの写像は数えずに A だった）。ただし頭の要素の desc で段の関数を当てて、括りの関数なら実体を作り
//   本体を読む（R25。2026-10-25 の確かめの指摘で直した。前は当てずに未知で閉じ、`bb : [a] y ? [+ 1] _ _` の `(bb [1]) (tl vs)~` が本体の G5 を
//   読まずに通った）。流れが空でなければ頭は必ず当たり、空なら下の空の流れの G19 の割れなので、どちらでも本体の門は当たってよい。片イ（R120）から、未知にした後ろに項が来ても G2(a) で断らず、種類の未知な物として畳む予想（foldStep）。
// - 空の流れ（`inc []~`）は、2026-10-26 の R70（§5 Q57 (a) の答え）から、何も当たらずにラムダが余るので、その所で `_`（`(unit (apply inc []~))`、A）に
//   なり、warning の leftover-lambda で知らせる（closeEmpty。R48・R52 と同じ名前と重さ）。主の Claude の問いの表「Q57 | 空の流れを口1つへ（`inc []~`） |
//   何も当たらずラムダが余るので `_`（知らせる）」に U〔答え〕[2026-10-25 21:56 c8ccdd69]「他は全部、君の傾き通り。」。前（R51 の決定の片）は G19：書き下すと
//   何も書いていない `inc`（L のまま）とも、空の流れを単位 `_` と読むとも読め、答えが割れるとしていた。口が2つの空の流れ（`add []~`、畳み込みで `_`）は今のまま
//   （別のセッションの読み「`[]~` が消えて add が残り、根で R42 の `_`」と割れる所、§5 Q69）。同じ日の確かめの直しから、閉じるのは2つの読みが同じ答えになる所
//   （後ろに何も続かず、評価する所・本体の根・値の上に積まれた所。emptyClosable）だけで、後ろに項が続く `inc []~ 5`・括りの中の `(inc []~)`・`:` の右辺の
//   `w : inc []~` などは G19（§5 Q69）。
// - 合成に入った流れを書き下すのは、合成全体の口が1つのとき（後ろの段が全部口1つ。R58、streamInto）。合成全体を1つの関数として書き下すので、
//   頭は合成全体に当たって後ろの段を閉じながら流れ、余りは関数の項の後ろに積まれる：`inc double vs~` は `(inc double 1) 2 3` で、形は合成で
//   ない書き下しと同じ `[A…]`（頭の結果、つまりいちばん後ろの段の結果と、余りの要素）。前（R51 の決定の片の確かめの直し）は、合成に来た流れの
//   読みが3つに割れて形も割れる（(b) の合成は適用の繰り返しの読みでは形の見えない A）ので、形の見えない A にしていた（§5 Q58 の答えで (c) に
//   決まった）。
function writeOut(e, s, x, n) {
  const elems = elemsOfContainer(x.desc.of);
  if (elems === null) throw refuseMapped("書き下す器");
  if (n === 0 || !elems.length) return void closeEmpty(e, s, x);
  if (n === null) {
    applyKind(partialFn(s), [elems[0]]); // 頭に当てて、括りの関数の本体を読む（上の注）。種類は使わない
    s.recv.push(x);
    settle(e, s, U());
    return;
  }
  putArg(e, s, composeLeaf(elems[0]));
  if (n >= 2 && entryDone(e)) {
    // 頭で関数の項が閉じた：余りは後ろに積む。項の種類は、頭の結果と余りを積んだ List の形（上の注）。頭を当てた結果の種類が決まらなければ、書いた
    // `uu 1 2 3` と同じく、余りを当てるか積むかは値の段が決める（片イ、R120。前は G2(a)）：項は種類の未知な物で閉じる。
    const last = e.stages[e.stages.length - 1];
    if (!last.result || last.result.k !== "A") {
      last.result = U();
      e.groups[last.group].result = last.result;
      return;
    }
    last.result = withShape({ s: "list", elem: mergeElems([last.result, elems[0]]) });
    e.groups[last.group].result = last.result;
    return;
  }
  if (n === 1 || entryDone(e)) return;
  // 上の注のとおり、ここには来ない（後ろの段が口1つでない合成は、streamInto が R58 の合成全体の口で読む）。来たら、口の数の分からない合成と同じ門で断る。
  throw refuseComposedStream(e, s, x, 1, null);
}
// R70：空の流れ x を、口が1つ（合成全体で1つ、R58）の段 s が受けた。何も当たらずにラムダ（s の今の部分適用と後ろの段の合成）が余るので、段から後ろを
// 全部閉じて `_`：関数の項は `(unit 余ったラムダ)`（A）で描く（renderEntry）。余ったラムダの木は、流れを書いた実引数に記録した今の形（`(apply inc []~)`）。
// 知らせは R48・R52 と同じ leftover-lambda（warning。書いた流れの所ごとに1回、実体ごとに本体を読み直しても出し直さない）。`$` の先を解いている所
// （受け皿 ctx.dead、R59）では、ほかの余ったラムダと同じく拾う。
// 閉じるのは、空の流れを受けた所と、評価する所で余ったラムダが `_` になる所（決定の文面「評価する所で `_` になり知らせる（R48・R52）」）が同じになる所
// だけ（emptyClosable）。ほかは G19 で断る（refuseEmptyStream、§5 Q69）。2026-10-26 の確かめの直し：最初の版は流れを受けた所ならどこでも閉じ、`inc []~ 5` を
// `_` の後ろの 5（値 5）、`(inc []~) 5`・`w : inc []~` ⏎ `w 3` も閉じた `_` に決めて通していたが、空の流れが並びの単位として消えて inc が開いたまま残る読み
// （別のセッションの読み、§5 Q69）では `inc 5`（6）・括りの中と `:` の右辺は L のままで、答えが割れる。
function closeEmpty(e, s, x) {
  if (!emptyClosable(e)) throw refuseEmptyStream(e, s, x);
  const inner = renderEntry(e); // 流れは書いた実引数の記録（log）にだけあり、段の口には入れない（何も当たっていない）
  const idx = e.stages.indexOf(s);
  for (let j = idx; j < e.stages.length; j++) {
    const t = e.stages[j];
    t.done = true;
    t.result = A();
    e.groups[t.group].result = A();
  }
  e.emptyOut = inner;
  const ctx = foldCtx;
  if (ctx && ctx.dead && !isIdentityKind(inner.kind)) ctx.dead.push(inner);
  reportLeftover(inner, ctx, x.term || x, "empty");
}
// 空の流れを受けた関数の項 e を、受けた所で `_` に閉じてよいか（R70）。2つの読み（受けた所で閉じる・空の流れが並びの単位として消えて関数が開いたまま
// 残り、評価する所で `_`）が同じ答えになる所だけ true：流れが並びの最後の項で（後ろに何も続かない）、その並びが評価する所（行の根、R42・R48。2026-10-26 の
// R76 から、比べと論理の被演算子・2行以上の手続きの本体の行も）か関数の本体の根（決定の例 `map2 $!_ []`。同じ日の確かめの直しから、字下げの本体の返す所
// （1行だけの本体の行・枝の値・枝の後の既定の行）も本体の根の印 bodyRoot で解く）か、e が値の上に積まれている（R52。`$[…]` の中身の
// 並びを除く）。括りの中・`:` の右辺・`,` の被演算子・値の演算子の被演算子で並び全体が1つの関数の所は、消える読みでは関数が L のまま残るので false（§5 Q37 の
// 「括りの中身が丸ごと関数の形は広げる候補に入れない」）。書いた並びの外（applyKind の写像・畳み込みの中、foldSeq が null）も false。
// R76 の前は比べ・論理の被演算子（`inc []~ == 1`）と字下げの本体の行も false で G19（§5 Q69）だった。
// 流れの後ろに書いた `_` しか続かない（`inc []~ _`）のも「後ろに何も続かない」に数える（2026-10-26 の R28 の書き直し：並びの終わりの `_` は消える印で、
// どちらの読みでも消えるので、`inc []~` と同じ答え。前は後ろに項が続く形の G19）。
function emptyClosable(e) {
  const q = foldSeq;
  if (!q || q.st.items.slice(q.at + 1).some((t) => !isMark(t))) return false;
  const stack = q.st.stack;
  if (stack[stack.length - 1] !== e) return false;
  if (q.evaluate || q.bodyRoot) return true;
  return q.closeIdle && stack.length >= 2;
}
function refuseEmptyStream(e, s, x) {
  const q = foldSeq;
  const follows = !!q && q.st.items.slice(q.at + 1).some((t) => !isMark(t)); // 後ろに書いた `_` しか無ければ続かない（R28、emptyClosable）
  const why = follows
    ? "後ろに項が続きます。受けた所で閉じる読みでは閉じた `_` の後ろに次の項が積まれ（`inc []~ 5` は 5）、空の流れが並びの単位として消える読みでは関数が次の項を受けます（`inc []~ 5` は `inc 5`）"
    : "ここは評価する所（行の根）でも関数の本体の根でもなく、関数は値の上にも積まれていません（括りの中・`:` の右辺・中置と `,` の被演算子・字下げの本体の行・`$[…]` の中身・写像や畳み込みの中）。受けた所で閉じる読みでは `_`、空の流れが並びの単位として消える読みでは関数が L のまま残ります";
  return gate(
    "G19",
    `空の流れ \`${show(x)}\` を、口が1つの関数 \`${show(e.groups[s.group].item)}\` が受けました。${why}。2つの読みで答えが割れるので断ります。空の流れの余ったラムダを \`_\` にするのは、後ろに何も続かず、評価する所・関数の本体の根・値の上に積まれた所だけです（§4 R51・R70、§5 Q69）。`
  );
}

// 撒く項 t の流れの要素の数（classifySpread が葉に付けた数）。数えられなければ null。
function flowCount(t) {
  if (!isSpreadNode(t)) return null;
  return t.count === undefined ? null : t.count;
}
// 恒等射の段 s が、撒いた流れ1つだけを受けて閉じる（R51・R29）：恒等射は受けた1項そのものを渡す（R29 の k = 1）ので、流れはそのまま次の段に
// 流れの1項として入る（単位律：`i inc vs~` は `inc vs~`、`i gd vs~` は `gd vs~` と同じ G19。法則13）。次の段が無ければ今までどおり（未知）。
// 渡したら true。
function passStream(e, s) {
  if (!s.fn || s.fn.type !== "id" || s.recv.length !== 1 || !isSpreadNode(s.recv[0])) return false;
  // `||!_||` の中の恒等射は、`||!_||` が1つの関数で並び全体を受けて数える（`[~x] ? ||x||`、R27）ので渡さない（isNormIdentity）。
  if (isNormIdentity(e, s)) return false;
  const idx = e.stages.indexOf(s);
  const next = e.stages[idx + 1];
  if (!next) return false;
  s.done = true;
  s.result = U();
  if (next.group !== s.group) {
    e.groups[s.group].result = U();
    e.groups[next.group].flowIn = true;
  }
  streamInto(e, next, s.recv[0]);
  return true;
}

// 畳む2項の点なし（R31）に実引数が1項のときの種類。1項が数なら、その数そのもの（`[+] 5` は 5）。List 1つなら、要素を並びと
// して畳んだ物（`[+] [1 2 3]` は 6）で、値は一番右か一番左の要素か、要素どうしの演算の結果になる（`[&]` は一番右、`[|]` は一番
// 左、`[<]`・`[<=]` はいちばん小さい要素、`[>]`・`[>=]` はいちばん大きい要素、`[==]`・`[=]` は全部等しければその要素。R31 の
// 2026-11-05 の寄せ4。前は、比較は一番右か `_`）。だから要素に関数が混ざれば、畳んだ結果は関数になりうる（`gs : 1 , inc` の
// `[&] gs` は inc）。
// - A：書いた `_`（印。中置の被演算子と同じ、R15）・数（R24）・中身の見える List で、深く見て要素が全部 A の物（`[1 2 3]`・
//   `vs`・`[' 0]` で引いた List）。
// - 未知：ほかの全部。要素に L か未知が見える器（`gs`・`(inc , 1)`。並びの中では G7）、中身の見えない A（裸の仮引数・適用の
//   結果・`$` の番地。器かもしれず、器なら要素に関数が見えるかもしれない）、構造体（欄を畳む読みは決まっていない）。
//   括り1つの `(y)`・`([< 3,] 1 5 2)` も、中の行の形が見えなければ未知（`[x]≅x` なので `(y)` は y と同じ）。
// 前（2026-10-21 の R31 の最初の版）は1項ならいつも A にしていて、`z : [&] gs` の `z 5` を黙って構築と読んだ（確かめで見つかった
// 黙った誤答。R31 の前の `[&]` はアリティの分からない点なしで、未知か G7 だった）。中置で書いた同じ物（`gs ' 0 & gs ' 1`）・
// 同じ器を撒く形（`gs~`、Q20）・`[' 0] fs` も未知か G7 なので、それと揃える。
// k ≥ 2 は中置と同じく A（`[&] 1 gs` は `1 & gs` と同じで、gs は器の値）。
function foldOneKind(arg) {
  if (isMark(arg)) return A();
  const d = descOfTree(arg);
  if (isScalar(d)) return A();
  if (d.k === "A" && !d.spread && d.shape && d.shape.s === "list" && deepKind(d) === "A") return A();
  return U();
}

// 段の今の関数（受けた実引数の分を当てた部分適用）。口の開いたまま残った関数の項の desc（括りや名前で包んだときの種類）に使う。
function partialFn(s) {
  const fn = s.fn;
  const k = s.recv.length;
  let out = fn;
  if (k && fn) {
    if (fn.type === "plain") {
      const origin = fn.origin === "hole" ? "hole" : "partial";
      out = { type: "plain", origin, n: fn.n - k, getBodyRoot: fn.getBodyRoot, idKey: fn.idKey, envDepth: fn.envDepth };
      if (fn.rest) {
        out.rest = true;
        out.restAt = (fn.restAt || 0) - k;
      }
      // 裸の仮引数の札（paramTag）：部分適用は、元の `?` と、当てた口の数（at）と、Reader を当てた口の位置（readers）を持ち越す。足りた所で
      // まとめて見る（readerAtPlain）。
      if (fn.op) {
        out.op = fn.op;
        out.label = fn.label;
        out.at = (fn.at || 0) + k;
        const rs = s.recv.map((t, i) => (plainReaderArg(descOfTree(t)) ? { i: (fn.at || 0) + i, tree: t } : null)).filter(Boolean);
        out.readers = [...(fn.readers || []), ...rs];
      }
      // 素の関数の単相化（R81）：部分適用は元の関数（base）と当てた物の desc（bound）を持ち越し、口が全部埋まった所で、印があれば実体を作る（monoKind）。
      // 鍵は当てた物の印を入れる（fnKey）。
      if ((fn.base || fn).instantiate && origin !== "hole" && !fn.rest) {
        out.base = fn.base || fn;
        out.bound = [...(fn.bound || []), ...s.recv.map(descOfTree)];
      }
      // 穴の関数の部分適用は、頭と、当てた物を穴に入れた並びを持ち越す（holeFnOf の注、2026-10-26 の確かめの直し）。R34 の k < n の関数で、裸の口より多く
      // 当てた物は、最後の括りに入った物（holeC）。
      if (fn.holeHead) {
        const P = fn.holeAt.length;
        out.holeHead = fn.holeHead;
        out.holeArgs = holeFill(fn, s.recv.slice(0, P));
        out.holeAt = fn.holeAt.slice(Math.min(k, P));
        const extra = [...(fn.holeC || []), ...s.recv.slice(P)];
        if (extra.length) out.holeC = extra;
      }
    } else if (fn.type === "pfBinary") out = { ...fn, n: fn.n - k };
    // 括りの関数の部分適用で当てた括りの実引数も、名前の無い要素を知らせる（R64、noteExcess）。当てた所で知らせるので、括った `(pb2 [1 2 3]) [4]`・名前を
    // 通した `pa : pb2 [1 2 3]` ⏎ `pa [4]` も、書き並べた `pb2 [1 2 3] [4]` と同じく1回（2026-10-26 の確かめの直し。前は残りを当てた所で、当てた括りを
    // 数えずに飛ばしていた）。
    else if (fn.type === "pattern") {
      noteExcess(fn, s.recv);
      out = patternPartial(fn, s.recv.map(argDescOf));
    }
  }
  return out;
}
// 口の開いたまま残った関数の項の fn：いまの段の部分適用と、後ろの段を並べた合成（1つならその関数）。
// 2026-10-26 の R28 の書き直しの前は、前の段が閉じて、いまの段1つが残った物（`q : inc add 5` の q）に、合成の頭だった印 composed を付けていた（並びの最後の
// `_` を「終わり」で読まず G5 にする、§5 Q18）。末尾の `_` はどの頭でも消えるようになったので、印は要らない。
function entryFn(e) {
  const i = e.stages.findIndex((s) => !s.done);
  const fns = [partialFn(e.stages[i]), ...e.stages.slice(i + 1).map((s) => s.fn)];
  if (fns.length > 1) return { type: "compose", fns };
  return fns[0];
}

// ---- 関数の項の木（§1.3） ----
//
// 各関数がどの項を受けたかが木から読めるように書く。意味の変わらない形は前の木の形のまま。
// - 実引数を書いた順に並べ、合成するたびに、それまでを `(apply …)` で閉じて `(compose … f)` にする（前の木と同じ：`f2 1 g 2` は
//   `(apply (compose (apply f2 1) g) 2)`、`[+] inc 5 6` は `(apply (compose [+] inc) (construct 5 6))`）。
// - 後ろの関数が並びの項を受けた（`f2 3 f2 5 6`・`inc [+] 5 6`）か、可変長の口が合成の前と後の両方で受けて、可変長の口に
//   2つ以上入った（`[+] 1 2 inc 3`）か、終わりで閉じた関数の後ろの関数が並びから何も受けていない（`[+] 1 inc 2`・`n 1 2 inc`・
//   `[* 2,] 1 2 3 inc double`・`head inc [5 6 7] double`）なら、合成の綴りでは誰が何を受けたかが隠れるので、入れ子の適用で書く：
//   `(apply f2 (construct (apply f2 (construct 3 5)) 6))`・`(apply inc (apply n (construct 1 2)))`。
// - 2026-10-23 までは、並びの項を全部書いた後に合成した後ろの組が並びから何も受けていない形（`n 1 2 inc`）と、値の後ろの逆適用が続く形
//   （`5 inc inc`）を、逆適用の綴り `(apply inc (apply n (construct 1 2)) ·rev)`・`(apply (compose inc inc) 5 ·rev)` で書いていた
//   （trailingFrom）。逆適用の廃止（R47）で `·rev` の綴りは無くなり、前の形は入れ子の適用で、後の形は `5` の後ろに積んだ `inc inc` になった。
function renderEntry(e) {
  // 空の流れで閉じた関数の項（R70、closeEmpty）は、余ったラムダを `(unit …)` で包んだ `_`。
  if (e.emptyOut) return { t: "unit", inner: e.emptyOut, kind: A() };
  const done = entryDone(e);
  const kind = done ? e.stages[e.stages.length - 1].result : { k: "L", fn: entryFn(e) };
  // 2026-10-26 の R28 の書き直しの前は、並びの最後の「終わり」の `_`（印 endMark）を、最後の組の実引数の後ろに書いていた（`add 3 _` は
  // `(apply add (construct 3 _))`）。末尾の `_` は消えるので、木に書かない（`add 3 _` は `add 3` と同じ木）。
  const tuple = (xs) => (xs.length === 1 ? xs[0] : { t: "construct", items: xs, kind: A() });
  const app = (head, args, k) => ({ t: "apply", head, arg: tuple(args.map((a) => a.tree)), kind: k });
  const compose = (head, f) => ({ t: "compose", items: head.t === "compose" ? [...head.items, f] : [head, f], kind: { k: "L" } });
  const g0 = e.groups[0];
  const { preG0, postG0, laterArgs } = logShape(e);
  const sh0 = stageShape(e.stages[0]);
  const lastEv = e.log[e.log.length - 1];
  // 可変長の口が合成の前と後の両方で受けても、可変長の口に入ったのが1つだけなら、固定の口と同じく書いた順の綴りで誰が何を受けたかが
  // 読める（`pair [1] inc 5` は `(apply (compose (apply pair [1]) inc) 5)`、括りを外した素の関数と同じ木。法則4）。
  const spread0 = sh0.unknown || (sh0.varying && e.stages[0].recv.length > sh0.fixed + 1);
  const nested = laterArgs || (spread0 && preG0 && postG0) || (done && lastEv && lastEv.k === "compose");
  if (!nested) {
    // 書いた順：合成するたびに、それまでを閉じる。
    let T = g0.item;
    let pend = [];
    for (const ev of e.log) {
      if (ev.k === "arg") pend.push(ev);
      else {
        T = compose(pend.length ? app(T, pend, { k: "L" }) : T, e.groups[ev.group].item);
        pend = [];
      }
    }
    if (pend.length) return app(T, pend, kind);
    return T === g0.item ? T : { ...T, kind };
  }
  // 入れ子の適用：各組が、前の組の結果（流れ）と、自分が並びから受けた物を当てた適用。
  let node = null;
  for (let g = 0; g < e.groups.length; g++) {
    const grp = e.groups[g];
    if (g > 0 && !grp.flowIn && !grp.args.length) {
      node = compose(node, grp.item); // まだ流れの届いていない後ろの関数
      continue;
    }
    const args = [...(grp.flowIn && node ? [{ tree: node }] : []), ...grp.args];
    node = args.length ? app(grp.item, args, grp.result || { k: "L" }) : grp.item;
  }
  return { ...node, kind };
}

// 合成の中で、前の関数の結果を次の関数へ渡す1項の実引数。descOfTree がそのまま読む葉にする。
function composeLeaf(desc) {
  return { t: "leaf", term: null, cat: "plain", desc, kind: desc, view: { v: "atom", text: "·" } };
}

// ---- 穴（R16・R34・R38） ----

// 素の関数の頭（R16：名前の定義か `?` の括りで、出どころが素の物。2026-10-23 までは R12 の逆適用の右も）。
function isPlainHead(h) {
  const fn = h && h.kind && h.kind.fn;
  return !!fn && h.cat === "plain" && h.kind.k === "L" && fn.type === "plain" && fn.origin === "plain" && (h.isLambdaName || h.isQBracket);
}

// 穴 `!_` を書ける頭のアリティ（R16・R34）。素の関数の頭は n。既定値のある関数の頭（名前の定義か `?` の括り）は仮引数の数
// （defaultsArity。数えられなければ null）。ほかの頭は null。
function holeHeadArity(h) {
  const fn = h && h.kind && h.kind.fn;
  if (isPlainHead(h)) return fn.n;
  if (fn && h.cat === "plain" && h.kind.k === "L" && fn.type === "other" && fn.defaults && (h.isLambdaName || h.isQBracket)) return fn.n;
  return null;
}

// 穴が tryHole で読めなかった並び（§3.5）を、畳む前に並び全体で見て断る所。穴を書ける頭（素の関数か既定値のある関数）の
// 実引数の並びで、穴でない項が全部書いた `_` でない A で k ≠ n なのに R34（holeMismatch）が読まなかった形は G13：撒く項がある（k が
// 数えられないので、穴に入れる実引数も余りも決まらない。`go !_ vs~`・`f3 !_ vs~`）か、k > n で前から n 個の外に `!_` がある（R34 は
// 残りの実引数を前から穴へ入れるが、入れる物が穴の読みは決まっていない。`inc 5 !_`・`add !_ 1 !_`）。前（Q31 の答えの前）は k ≠ n の
// 全部を G13 で断っていた（U〔答え〕10-15 23:16 は「go !_ xs は go xs と読む」に「そうなるね！」だったが、穴の読みでは go の口を穴が
// 埋めて xs が余る、と割れた）。R34 の k < n で作った関数に後から当てる所の G13（最後の括りに1つで入る数でない値）は、2026-10-23 に
// 無くなった（[x] ≅ x で、入った物の中身の並び。restCloseKind）。
// 2026-10-28 の R105 から、書いた `_` は穴に数えない（holeSeq が先に unitArgs で着く口に読む。素の関数・括りの関数の頭では全部消える）。前（R38）は、既定値の無い
// 素の関数の頭の、最後の項でない書いた `_` も穴と同じに数えていた（`inc 1 _ 2` は G13、今は `inc 1 2` で `(inc 1) 2`）。
// 前から n 個の外の `!_`：2026-10-26 の R69（§5 Q40 の答え）から、前から n 個に穴が無く、外が `!_` だけの `inc 5 !_` は、閉じた `inc 5` の後ろの口の外の
// 恒等射（R44）で `inc 5`（g13Of が外し、畳み込みの1歩が読む）。外に値がある `inc 5 !_ 6` は、R34 が並び全体で頭の実引数に数える形で、内側の `_` の
// `inc 5 _ 6`（R38 の G13）と揃えて G13 のまま断る（§5 Q40 の残り）。
// 括りの関数の頭（名前の定義か `?` の括り）の同じ形（前から n 個が全部値で、その外に `!_` がある `pq 1 2 !_`・`pt [1] 2 !_ 5`。
// pq は `[a] y ? y`）も同じで、外が `!_` だけの `pq 1 2 !_` は R69 で通り、外に値がある `pq 1 2 !_ 5` は G5 のまま（§5 Q40 の残り）。括りの関数の口に入る `!_`（`io1 !_ 5`・`5 io1 !_`・`io1 inc !_`）は、
// 畳み込みの1歩が G5 で断る（holeStep。穴は素の関数だけ、括りの仮引数の関数では `_` が括りの受ける並びの中の印になる、U〔答え〕10-14
// 22:23）。前（2026-10-23 の最初の版）は、`!_` のすぐ前の値の並びの頭が括りの関数なら、ここで並び全体を G5 で断っていて、`!_` が
// 括りの関数の口でなく前の関数の口に入る `inc io1 !_`（`(inc io1) !_` は R46 で通る）と、括りの頭でない `(pq 1) 2 !_`（`(add 1) 2 !_`
// は通る）まで断っていた（確かめで見つかった、2026-10-23）。
// ほかの位置の `!_` は断らず、畳み込みの1歩で読む（holeStep。口の外は恒等射（R44）、口の中は穴と恒等射が同じ関数になる所だけ通す
// （R46））。前は、ほかの位置を全部 G7 で断っていた（U〔答え〕2026-10-21 23:47）。
function holeRefusal(items) {
  const h = items[0];
  const fn = h.cat === "plain" && h.kind.k === "L" && (h.isLambdaName || h.isQBracket) ? h.kind.fn : null;
  if (fn && fn.type === "pattern" && !fn.lastBracket) {
    const ts = items.slice(1);
    const n = fn.n;
    const beyond = ts.slice(n);
    // R69（§5 Q40 の答え）：外にあるのが `!_` だけ（`pq 1 2 !_`）なら、閉じた `pq 1 2` の後ろの口の外の恒等射で、畳み込みの1歩が読む（R44）。
    if (beyond.length && beyond.every(isHoleItem)) return g13Of(items);
    // R89（2026-10-27、§5 Q40 の残りの答え）：外に値もある `pq 1 2 !_ 5` も、素の関数の頭の `inc 5 !_ 6` と同じく、閉じた `pq 1 2` の後ろの口の外の恒等射（R44）で、
    // 畳み込みの1歩が読む（`(pq 1 2) (!_ 5)`）。前は G5（下の言い分。記録として残す）。
    if (beyond.length && ts.slice(0, n).every(isValueItem) && beyond.every((t) => isHoleItem(t) || isMark(t) || isValueItem(t))) return g13Of(items);
    if (beyond.some(isHoleItem) && ts.slice(0, n).every(isValueItem) && beyond.every((t) => isHoleItem(t) || isMark(t) || isValueItem(t))) {
      return gate(
        "G5",
        `括りの関数 \`${showView(h.view)}\` の口（${n}）を値で埋めた後ろに、括らない \`!_\` があります。畳み込みでは閉じた値の後ろの口の外の恒等射（R44）とも、括りの関数の実引数の穴（穴は素の関数の実引数にだけ書けます、U〔答え〕10-14 22:23）とも読めます。素の関数の頭の同じ形（\`inc 5 !_\`、G13）と同じ問いで、決まっていません（§3.5、§5 Q40）。`
      );
    }
  }
  return g13Of(items);
}

// G13（R34 が読まない、穴と実引数の数が合わない並び）か。当たらなければ null。穴は `!_` だけ（R105。前は既定値の無い素の関数の頭の、最後の項でない書いた `_` も、R38）。
function g13Of(items) {
  const h = items[0];
  const ts = items.slice(1);
  const n = holeHeadArity(h);
  if (n === null || !ts.length) return null;
  const isHole = isHoleItem;
  if (!ts.some(isHole) || ts.length === n || !ts.every((t) => isHole(t) || (t.cat === "plain" && t.desc.k === "A"))) return null;
  // R69（§5 Q40 の答え）：前から n 個に穴が無く、その外が `!_` だけ（`inc 5 !_`）なら、閉じた `inc 5` の後ろの口の外の恒等射（R44）で、畳み込みの1歩が読む
  // （`(construct (apply inc 5) (unit !_))`、値は `inc 5`。括った `(inc 5) !_`・`inc 5 i` と同じ）。外に値がある `inc 5 !_ 6` は、内側の `_` の `inc 5 _ 6`（R38）と
  // 揃えて今のまま断る（§5 Q40 の残り）。既定値のある関数の頭（`gd 1 2 !_`）は、適用の種類が決まっていない（§5 Q8）ので「閉じた」と言えず、今のまま断る。
  // R89（2026-10-27、§5 Q40 の残りの答え）：外に値もある `inc 5 !_ 6`・`inc 5 _ 6` も、前から n 個に穴が無ければ閉じた `inc 5` の後ろで、口の外の `!_` と `_` は
  // 並びの単位（`!_` は R44 の口の外の恒等射、`_` は R43 の値の隣で消える）なので、`(inc 5) 6` と同じ（畳み込みの1歩が読む：`!_ 6` は R44 の恒等射に当てた 6、
  // `_` は消える）。根拠：主の Claude の傾き「Q40 の残り | `inc 5 !_ 6` | `(inc 5) 6`。inc の口は 5 で埋まっていて、`!_` は口の外の恒等射なので消える。`inc 5 _ 6` も、
  // 口の外の `_` は消えるので同じ」（2026-10-26 11:57 の表の A）に、利用者は異議を言わなかった（傾きで受けた、R）。前は外に値があれば G13（R34 が並び全体で頭の実引数に
  // 数える形と揃えて断る）。
  // 前から n 個に撒く項があれば「閉じた」と言えない（数が数えられない）ので、外に値のある形は今までどおり下の G13（外が `!_` だけの R69 は前のまま）。
  const closedHead = isPlainHead(h) && ts.length > n && !ts.slice(0, n).some(isHole);
  if (closedHead && ts.slice(n).every(isHoleItem)) return null;
  if (closedHead && !ts.some(isSpreadNode) && ts.slice(n).every((t) => isHole(t) || isValueItem(t))) return null;
  const what = isPlainHead(h) ? "素の関数" : "既定値のある関数";
  const arity = isPlainHead(h) ? `${n}` : `${n}。既定値のある仮引数も1つと数える`;
  const spread = ts.some((t) => t.cat === "plain" && t.desc.spread);
  const why = spread
    ? "撒く項があるので実引数の数が数えられず、穴に入れる実引数と余りが決まりません"
    : `前から ${n} 個の外に穴があります。余った実引数は前から順に穴へ入れますが、入れる物が穴の読みは決まっていません`;
  // 書いた数は、書いた `_` を着く口で読んだ後の数（unitArgs。値の口の `_` は消えて数えない、R105）。
  return gate(
    "G13",
    `${what} \`${showView(h.view)}\` の実引数の並びに穴 \`!_\` があり、実引数の数（${ts.length}。値の口の書いた \`_\` は消えるので数えません、§4 R105）がアリティ（${arity}）と違います。${why}（§4 R34、§5 Q31）。`
  );
}

// R39・R105：既定値のある関数 fn の頭の実引数の並び ts（手順2、`!_` のある並び）の書いた `_` を、前から数えた口で読む（markStep と同じ読み）。既定値のある口
// （fn.defaultAt）なら既定値という値の葉（cat "default"、A）で、口を1つ使う。ほかは消えて口を使わない：既定値の無い口（裸の値の口と括りの口）は R105 の単位律と R15、
// 仮引数の外は R28・R43・R89。位置が数えられない形（撒く項か、値でない項が前にある・n が数えられない）も、markStep と同じく消える予想にする。
// 穴 `!_` と値は口を1つ使う（tryHole、R16・R34）。
// 片イ（R126）から、仮引数の外で後ろに値か `!_` が続く `_`（`go 1 2 _ !_`）と位置が数えられない `_`（`gz _ !_`）も断らない（前は G15）。markStep の G15 だけを外すと、
// 埋めた `go 1 2 _ 3` は通り、穴に後から当てた `[go 1 2 _ !_] 3` だけが G15 で残る（前は両方 G15 で同じ門だった）。法則6（穴に後から当てるのは埋めた適用と同じ）の
// 比べの外は前から n 個の外の `!_`（G13 か G7）なので、G15 で残る割れは法則6 と食い違う。仮引数の数えられない頭では、既定値のある口に書いた `gz !_ 2 _` が G15、
// 数を書いた `gz !_ 2 5` が G7 と門が割れ、法則8（既定値のある口に書いた `_` は数を書いたのと同じ）とも食い違っていた。ここで消すと、並びは `_` を書かなかった並び
// （`go 1 2 !_` の G13・`gz !_` の G7）と同じになり、残る断りは穴の片（カ）の門だけ。
// 前（2026-10-21〜27）は、書いた `_` も口を1つに数え（`gd _ _` の前の `_` は ys の口）、既定値の無い口の内側の `_` はカリー化の穴（R68、curryAt）、並びの終わりの `_` は
// 右から見て既定値のある口に当たる物まで残していた（peelTail）。R105 で左から読むと、前の `_` が消えて後ろの `_` も同じ口に着く（`gd _ _` は gd、§5 Q74 (d)）。
function defaultUnits(fn, ts) {
  const at = fn.defaultAt;
  const slot = (t) => isHoleItem(t) || (!!t.kind && t.kind.k === "A" && !(t.t === "leaf" && t.desc && t.desc.spread));
  const out = [];
  let p = 0;
  let countable = !!at;
  for (const t of ts) {
    if (!isMark(t)) {
      if (!slot(t)) countable = false;
      out.push(t);
      p++;
    } else if (countable && p < at.length && at[p]) {
      out.push({ ...t, cat: "default", desc: A(), kind: A() });
      p++;
    }
  }
  return out;
}

// R16：穴。並び全体が `h t1 … tn` で、h が素の関数（名前の定義か `?` の括り）・撒く項が無い・k = n（穴も数える）・穴でない
// ti が全部 A のとき、各穴を生成名に替えて `(? [$p0 …] (apply h …))` にする。種類は L、アリティは穴の数。
// 穴は `!_`（その口の恒等射）だけ（R34。`!_` は最後の項でもよい、η：`add 1 !_` は `add 1`、`inc !_` は `inc`）。書いた `_` は、呼ぶ側の holeSeq が先に着く口で
// 読む（unitArgs：素の関数の頭では全部消え、既定値のある関数の頭では既定値のある口なら既定値という値、ほかの口なら消える）。2026-10-28 の R105 から、書いた `_` は
// 穴にならない（`f4 _ 2 !_ 3` は `f4 2 !_ 3` と同じ R34）。前（2026-10-21〜27）は、最後の項でない書いた `_` も穴（カリー化。U 10-14 03:10「f _ 10 は a ? f a 10」、
// R16・R38、既定値のある関数の既定値の無い口は R68）で、`add _ 10` は `(? [$p0] (apply add (construct $p0 10)))` だった。今は `add 10`。10-14 03:10 の式は、
// 説明のための式で仕組みではなかった（U [2026-10-27 15:50 58a809c9]「そうか、分かりやすい例えのために使った式に引きずられてるのか…」）。
// `!_` は既定値があっても穴（仮引数の数 n で k = n を見る。n が数えられなければ穴にしない、defaultsArity）。その関数の適用の
// 種類は未知（§5 Q8）なので、穴の関数もアリティの分からない関数（other）にする。アリティは数えない（§3.4 の
// 穴の行。`(gd !_ 3) 5` は未知、`(gd !_ 3) _` は末尾の `_` が消えて `(gd !_ 3)`。2026-10-26 の R28 の書き直しの前は、終わりの頭のアリティが数えられないので G5）。
// 穴の規則の条件（並び全体が頭の実引数の並び・穴でない項が全部 A・撒く項が無い）は並び全体の形なので、畳む前に並び全体で見る（R43。中身は今のまま）。
// 読めた並びは、穴の関数か、穴を全部埋めた適用（の後ろに余り）がそのまま答え。
// items は並び全体か、値の後ろに積まれた関数から並びの終わりまで（subHole、R47。`X F Y` の `F Y` は括った `(F Y)` と同じ並び）。
// k ≠ n は R34（holeMismatch）。`!_` が読めずに残れば holeRefusal が G5・G13 を見て、残りは畳み込みの1歩が読む（holeStep、R44・R46）。
// R86（2026-10-27、関数を挟んで値が続く書いた `_` は位置を保つ穴、tryHoleRow）は、2026-10-28 の R105 で廃止した（`_` を消した綴りと同じ）。
function tryHole(items, ctx) {
  const h = items[0];
  const fn = h.kind.fn;
  if (h.cat !== "plain" || h.kind.k !== "L" || !fn) return null;
  const ts = items.slice(1);
  if (!ts.some(isHoleItem)) return null;
  const n = holeHeadArity(h);
  if (n === null) return null;
  if (ts.length !== n) return holeMismatch(h, ts, n, ctx);
  if (!ts.every((t) => isHoleItem(t) || isValueItem(t))) return null;
  const params = [];
  const args = ts.map((t) => {
    if (!isHoleItem(t)) return t;
    const name = holeName(ctx, params.length);
    params.push(name);
    return holeParamLeaf(name);
  });
  emptyArgsAtValue(h, args);
  const body = holeApply(h, args);
  return { t: "hole", params, body, kind: { k: "L", fn: holeFnOf(fn, params.length, undefined, args, body) } };
}

// 穴の書き換えの本体と、穴を全部埋めた適用：頭に口の数だけ当てた適用（§3.4 の k = n）。既定値のある関数の適用は未知（§5 Q8）。
// 素の関数の頭は、口が全部埋まった適用と同じ（plainApplyKind）：書いた実引数に印があれば、印で実体を作る（R81）。穴の残る形の本体は、穴の口を印の無い A
// （穴の生成名の葉）にした実体で、`$p ? h … $p …` の定義の行の読みと同じ（`(use $inc !_)` の本体は `use $inc A` の実体）。
// 2026-10-26 の確かめの直し：R81 の片の作る途中の版は、穴を全部埋めた適用だけで実体を作り、穴の関数は書いた印も後から当てた印も持ち越さなかった。だから
// `ff : x ? pq [1] x` の `(ff !_) $5` が本体の根の A で通り、`ff $5`（実体で G21）と法則6 で割れた（`ii : x ? x + 1` の `(ii !_) $5` も、HEAD から A で
// `ii $5` の G21 と割れていた：穴の関数は札の op も持たず、後から当てた Reader を見なかった）。
function holeApply(h, args) {
  const fn = h.kind.fn;
  // 穴の関数の実引数に書いた Reader・番地も、口に渡した物（R60 の細かい所・R62。`f3 $5 !_ 2`）。既定値のある関数の適用は未知（§5 Q8）。
  const kind = fn.type === "plain" ? plainApplyKind(fn, args) : U();
  return { t: "apply", head: h, arg: args.length === 1 ? args[0] : { t: "construct", items: args, kind: A() }, kind };
}
// 素の関数 fn の口が trees で全部埋まった適用の種類：実引数のどれかが印を持てば実体の答え（R81、monoKind）、ほかは本体の根（§3.4）で、Reader・番地を口に
// 渡した呼び出しを札で見る（readerAtPlain。R60 の細かい所・R62）。
function plainApplyKind(fn, trees) {
  const mono = monoKind(fn, trees);
  if (mono) return mono;
  const root = fn.getBodyRoot();
  readerAtPlain(fn, trees);
  return root === "A" ? A() : U();
}

// 穴の生成名と、それを実引数の位置に置いた葉（A。印 holeParam は、穴の関数の口の位置を覚える所 holeFnOf が見る）。
const holeName = (ctx, i) => `$${ctx.F.holePrefix}${i}`;
const holeParamLeaf = (name) => ({ t: "leaf", term: null, cat: "plain", desc: A(), kind: A(), view: { v: "atom", text: name }, holeParam: true });
// 穴の関数の fn。頭が既定値のある関数なら、アリティの分からない関数（tryHole の注）。素の関数なら、出どころ "hole" のアリティ n の
// 素の関数。restAt は R34 の k < n で作った関数（最後の括りの仮引数で残りを受ける、holeMismatch）のときだけ
// 渡し、印 rest と、最後の括り `[~c]` の前に残る裸の口の数 restAt を付ける。
// 2026-10-26 の確かめの直しから、頭の素の関数（holeHead）と、頭に当てた実引数の並び（holeArgs。穴の位置は穴の生成名の葉）と、穴の位置（holeAt、穴の順）を
// 持ち越す（R81）：口が埋まった所（doneKind・restCloseKind）で、穴に当てた物を holeArgs の穴の位置に入れた並びを頭に当て、印があれば実体を作る（`(ff !_) $5` は
// `ff $5` と同じ。法則6）。本体の根は、書いた実引数に印があれば本体（body）の実体の答え、無ければ頭のもの。鍵には書いた実引数の印を入れる（plainMarksOf）。
// 2026-10-28 の R105 の片から、頭が既定値のある関数の穴の関数には印 holeOf と穴の数 holes（R34 の k < n なら最後の括りの前の穴の数と印 rest）を付ける。
// 穴の口と最後の括りに来た書いた `_` は消え（R105・R15）、穴を全部埋めた後ろの口は数えられないので G5（markStep）。前は印が無く、どの口の `_` も G5 だった。
function holeFnOf(fn, n, restAt, args, body) {
  if (fn.type === "other") return restAt !== undefined ? { type: "other", holeOf: true, holes: restAt, rest: true } : { type: "other", holeOf: true, holes: n };
  const out = { type: "plain", origin: "hole", n, getBodyRoot: fn.getBodyRoot, idKey: fn.idKey, envDepth: fn.envDepth };
  if (restAt !== undefined) {
    out.rest = true;
    out.restAt = restAt;
  }
  if (args && fn.instantiate) {
    out.holeHead = fn;
    out.holeArgs = args;
    out.holeAt = args.map((t, i) => (t.holeParam ? i : -1)).filter((i) => i >= 0);
    if (body && plainMarksOf(out)) out.getBodyRoot = () => (body.kind && body.kind.k === "A" ? "A" : "U");
  }
  return out;
}
// 穴の関数 fn の穴に、前から trees を入れた実引数の並び（R81。trees が穴より少なければ、残りの穴は穴の生成名の葉のまま）。
function holeFill(fn, trees) {
  const full = fn.holeArgs.slice();
  fn.holeAt.forEach((pos, j) => {
    if (j < trees.length) full[pos] = trees[j];
  });
  return full;
}


// R34：穴 `!_` があって、実引数の数 k が頭のアリティ n と違う（§5 Q31 の答え）。頭は R16 と同じ（素の関数か、n が数えられる
// 既定値のある関数。名前の定義か `?` の括り）。穴でない項は全部 A で撒く項が無いときだけ読む。書いた `_` は、呼ぶ側の holeSeq が先に着く口で読んである
// （unitArgs。2026-10-28 の R105 から穴に数えない。前は既定値の無い素の関数の頭の、最後の項でない書いた `_` も穴に数えた（R38。`f2 _ 3 4` は `f2 4 3`、
// `f3 _ 2` は `a [~c] ? f3 a 2 c~`。今は `f2 3 4` の `(f2 3 4)`・`f3 2` の部分適用））。
// - k > n：前から n 個で穴の関数を作り（R16）、残りの実引数を前から順にその穴へ入れる（U〔答え〕10-21 22:51「合ってる。Bだね」。
//   主の Claude の問いの (B)「`go !_` は穴で `a ? go a`、後ろの xs がその穴を埋めて `go xs`。`f !_ 3 4`（f は2引数）は
//   `(a ? f a 3) 4` で `f 4 3`。括った `[f !_ 3] 4` と同じ答え」）。左からの畳み込みでは、穴の関数がいちばん上にあり、後ろの値が
//   1つずつ穴を埋める（R40 の適用）。穴より残りが多ければ、穴を全部埋めた適用の後ろに余りを積む（R35）。適用の種類が値でなければ、
//   その後ろに項が来るので G2(a)（R40 の読み6。前は G12(b)）。片イ（R120）から断らず、後ろに積む予想（下の「埋めた後の余り」）。穴が残れば、残った穴を待つ穴の関数（L）。木は埋めた所を値に替えた形
//   （`go !_ xs` は `(apply go xs)`、`f !_ 3 4` は `(apply f (construct 4 3))`。決定の規則）。既定値のある関数は、アリティが分からない
//   （§5 Q8）ので、余りも実引数に入れる（前と同じ。`gd !_ 3 4 5` は `(apply gd (construct 4 3 5))`、未知）。
// - k < n：穴を前から順に裸の仮引数にし、書いていない後ろの n − k 個の口を、最後の括りの仮引数 `[~c]` 1つで受けて後ろへ撒く
//   関数にする（U〔答え〕10-21 22:55「`a [~c] ? f3 a 2 c~` / という、足りない分は全部後ろへっていう変換がかかる。」）。木は
//   `(? [$p0 [~$p1]] (apply f3 (construct $p0 2 $p1~)))`。印 rest と、最後の括りの前に残る裸の口の数 restAt を持つ（holeFnOf）。
//   最後の括りは可変長の口で、並びの終わりまで受けて閉じる（R41、restCloseKind）。1つだけ入った物は [x] ≅ x でその中身の並び
//   （`(f3 !_) 1 [1 2]` は `f3 1 1 2`）。前は、最後の括りにちょうど1つで入る数でない値を G13 で断っていた（R34 の k < n の G13）。
//   後から当てた実引数の書いた `_` は、穴の口（値の口、R105）でも最後の括り（括りの口、R15）でも消える（markStep。2026-10-28 の R105 の前は、内側の `_` が
//   括りの受ける並びの中の消える印とも、裸の口のカリー化とも読めて G5）。引数の並びの終わりの `_` は消える（R28、2026-10-26 に書き直した）。
// 読まない形（null を返し、holeRefusal か g13Of が G13 で断る）：撒く項がある（k が数えられない）・k > n で前から n 個の外に穴がある
// （残りの実引数を穴へ入れる、の「入れる物」が穴になる。前から n 個に穴の無い `inc 5 !_ 6` も、内側の `_` の `inc 5 _ 6` と揃えて断る、§5 Q40 の残り。
// 外が `!_` だけの `inc 5 !_` は、2026-10-26 の R69 から g13Of が外して、畳み込みの1歩が口の外の恒等射で読む）。
function holeMismatch(h, ts, n, ctx) {
  // 穴は `!_` だけ（R105。書いた `_` は holeSeq の unitArgs が着く口で読んである：素の関数の頭では消え、既定値のある関数の頭では既定値のある口なら値の葉）。
  const isHole = isHoleItem;
  if (!ts.every((t) => isHole(t) || isValueItem(t))) return null;
  const fn = h.kind.fn;
  const params = [];
  const param = () => {
    const name = holeName(ctx, params.length);
    params.push(name);
    return holeParamLeaf(name);
  };
  if (ts.length > n) {
    const rest = ts.slice(n);
    // 前から n 個は位置で頭の口に入るので、そこの値の口に着いた書いた `[]` は、R34 が読まない形（余りに穴がある、下の G13）でも先に読み直す（R94。2026-10-27 の
    // 片6 の確かめの直し：前は `gq [] 1 !_` が G13 で、同じ位置に書いた `_` の `gq _ 1 !_` は G15 と、門が割れていた）。
    if (rest.some(isHole)) {
      emptyArgsAtValue(h, ts.slice(0, n));
      return null;
    }
    let r = 0;
    const filled = ts.slice(0, n).map((t) => (!isHole(t) ? t : r < rest.length ? rest[r++] : param()));
    const extra = rest.slice(r);
    emptyArgsAtValue(h, filled);
    if (params.length) {
      const body = holeApply(h, filled);
      return { t: "hole", params, body, kind: { k: "L", fn: holeFnOf(fn, params.length, undefined, filled, body) } };
    }
    if (fn.type === "other") return holeApply(h, [...filled, ...extra]);
    const app = holeApply(h, filled);
    if (!extra.length) return app;
    // 埋めた後の余り：結果が値と分からなくても後ろに積む予想（片イ、R120。前は G2(a)。埋めた綴りの畳み込みと同じ、法則6）。
    return { t: "construct", items: [app, ...extra], kind: app.kind.k === "A" ? A() : U() };
  }
  const args = ts.map((t) => (isHole(t) ? param() : t));
  emptyArgsAtValue(h, args);
  const c = holeName(ctx, params.length);
  const spread = { k: "A", spread: true };
  const items = [...args, { t: "leaf", term: null, cat: "plain", desc: spread, kind: spread, view: { v: "atom", text: `${c}~` } }];
  const body = { t: "apply", head: h, arg: { t: "construct", items, kind: A() }, kind: U() };
  // 書いた実引数の Reader・番地は、穴の関数を閉じた所（restCloseKind）で、埋めた並びを頭に当てて読む（R81。holeFnOf の注）。
  return { t: "hole", params: [...params, `[~${c}]`], body, kind: { k: "L", fn: holeFnOf(fn, params.length + n - ts.length, params.length, args) } };
}

// ---------------------------------------------------------------------------
// 入り口
// ---------------------------------------------------------------------------

/**
 * ソースを前段に通し、余積を解いた木を返す。
 * @param {string} source
 * @returns {{ trees: object[], diagnostics: object[], rows: object[], lineOf: (row: object) => (number|undefined) }}
 */
export function resolve(source) {
  let lines;
  // 行の木 → 元のソースの行（1 から）。断りと知らせに行を持たせる（R127。行の木を解く所で、今の行を F.line に置く）。
  const rowLines = new Map();
  try {
    const front = frontEnd(source);
    rowLineOf = front.lineOf;
    try {
      lines = front.rows.map((words) => parseRow(words));
    } finally {
      rowLineOf = null;
    }
    lines.forEach((t, i) => rowLines.set(t, front.lineOf(front.rows[i])));
  } catch (e) {
    throw stackRefusal(e) || e; // 前段の深い括弧の入れ子でも、スタックの溢れは内部の例外にしない（stackRefusal の注）
  }

  const diagnostics = [];
  const F = {
    defs: new Map(),
    namedLambdas: new Map(),
    valueMemo: new Map(),
    valueCounts: new Map(), // 値の定義 → 右辺の器の数（nameKindOf・valueCountOf）
    stringCounts: new Map(), // 値の定義 → 右辺の文字列の文字の数（nameKindOf・stringCountOf。撒いた流れの数だけが読む）
    bodyMemo: new Map(),
    stack: [],
    inProgress: new Map(),
    fileScope: null,
    holePrefix: "p",
    reported: new Set(),
    // 畳まない2項の点なしの information を出した、書いた所（reportNotFolded）。
    reportedPf: new Set(),
    // 評価する所の外で余ったラムダ（R52）の warning を出した、積まれた関数の書いた所（reportLeftover）。
    reportedLeft: new Set(),
    // 本体の返す所に残った裸の関数（R125）の information を出した、書いた所（bareReturnUnit）。
    reportedBare: new Set(),
    // `$` が関数以外を持ち上げた（R100）warning を出した、書いた `$` の項（reportLift）。
    reportedLift: new Set(),
    // 括りの名前の無い要素（R64）の information を出した、括りに入った最初の実引数の書いた所（noteExcess）。
    reportedExcess: new Set(),
    // 括りの関数の実体（R24・R25）：鍵 → 実体、書いた `?` → 範囲の鍵 → その `?` を通って呼んだ実体（recordCall）、
    // 根の種類の仮置きの記録、木を解いている途中の実体、定義の行の `?` の木（最後に実体で埋める）、実体の本体の
    // 診断の出し先。
    instances: new Map(),
    // 書いた `?` → それを通って呼んだ確定した実体の集まり（INSTANCE_TOTAL_LIMIT）、作って外れていない実体の数
    // （INSTANCE_WORK_LIMIT）。
    instanceTotals: new Map(),
    instancesMade: new Map(),
    calls: new Map(),
    instMemo: new Map(),
    matStack: [],
    patternNodes: [],
    // 値の定義 → 右辺が書いた `_` を指すか（R56、nameKindOf が置き、pointsToMark・dollarNameTarget が読む）。
    unitDefs: new Map(),
    // 書かなかったことにした、ファイルのいちばん外の `x : _` の名前（R113、2026-10-28 の片9b）。使う所では未定義の名前と同じで、undefined-name の知らせだけを出さない。
    erased: new Set(),
    // 書かなかったことにした構造体の欄の `x : _` で、外の x が見えると知らせた行（R113 の information、reportErasedField）。寄せ1（R128）の前は、本体の局所の
    // `x : _` の行（reportErasedShadow）も。
    reportedErased: new Set(),
    // 値の定義 → 右辺が番地の字面（`0x…`・`NxHHHH`。括り1つ・別名を通しても）か（R62、nameKindOf が置き、hexName が読む）。2026-10-27 の R97 から、字面の値
    // （{v, g, sum}、hexOperand。`0x…` どうしの和も。無ければ null）。
    hexDefs: new Map(),
    // 値の定義 → 右辺の値が Int か Int の List と書いた所から分かるか（R97。"scalar"・"list"・null、nameKindOf が置き、intName が読む）。
    intDefs: new Map(),
    // 値の定義 → 右辺の余ったラムダ（R59、nameKindOf が置く）、素の `?` の定義 → 本体の余ったラムダ（bodyRootOf が置く）と括りの関数の定義 → 仮引数を
    // 含まない行の余ったラムダ（deadOfDef・deadInPatternBody）、既定値のある `?` の定義の本体を解いている途中の印と別名を辿っている途中の印（deadOfDef）。
    deadDefs: new Map(),
    deadBodies: new Map(),
    deadBusy: new Set(),
    // 値の定義 → 右辺を解いた木（R59 の別名の引き継ぎ、aliasDeadOfTree。nameKindOf が置く）。
    defRoots: new Map(),
    diag: diagnostics,
    // 無名の素の関数の本体を解いている間に引いた仮置き（collectedRoot）。
    collectors: [],
    // 記録の鍵 → 古くなって解き直した回数（freshMemo）、枠を積んだ鍵、解き直しの守りで断った誤り（guardAgain）。
    againCounts: new Map(),
    frameKeys: new Set(),
    againRefused: null,
    // 値を含む輪で断った誤り（cycleError）。
    cycleRefused: null,
    // `$v` の輪で、v の種類を引かずに値を読む参照として通した所（R73、selfReaderTarget）：v と、引いた所で出た輪の断り。最後に、v を解き終えた種類で合うかを見る。
    selfReaders: [],
    // 実体の守りで断った誤り（guardRefusal。total・work・nest）と、解いている途中の実体の入れ子の数（enterNest）。
    guards: {},
    guardStops: new Map(), // 守りに当たった `?` → その断り（新しい実体を作らない、instantiate）
    instNest: new Map(), // 書いた `?` → 解いている途中の実体の入れ子の数（enterNest）
    instRecur: 0, // 再帰の入れ子：同じ `?` の、解いている途中の2つ目から先の実体の数の和（enterNest）
    depthLimit: 0, // 実体の深さの上限（writtenDepth）
    // いま解いている行（か前段の定義）の計算が、守りの断りの汚れを読んだか（taint）。JS のスタックの溢れの断り（stackRefusal）。
    lineTainted: false,
    stackRefused: null,
    // 元のソースの行（1 から。R127）：行の木 → 行、定義 → その行、いま解いている行（か前もって解く定義の行）。輪・解き直し・守りの断りは作った所で、
    // 行の門は行のループで、知らせは行を解き終えた所でこれを持つ（withLine）。
    rowLines,
    defLines: new Map(),
    line: undefined,
  };
  resetIntern();

  // P2：ファイルのいちばん外の定義を、先に全部集める（順序に依らない）。
  for (const line of lines) {
    const def = asDefinition(line);
    if (!def) continue;
    // R113（2026-10-28 の片9b）：右辺が書いた `_` だけの定義（`x : _`）は、書かなかったことと同じ（席を取らない）。定義の表に入れないので、同じ名前の2つ目にも
    // （`x : _` ⏎ `x : 5` の x は 5、順を逆にしても同じ）、仮引数の隠し（R133 の知らせ name-shadow）にも、輪にもならず、使う所では未定義の名前（R111 の `_`）と同じに読む。知らせ
    // （undefined-name）だけは出さない（書いた人は名前を `_` と定義している。reportUndefined）。行の木は今のまま `(: x _)`。
    // 根拠：U [2026-10-27 14:07 58a809c9]「つまり、 / un : _ / は書かなかったことに出来る。」、U [15:48]「…未定義を定義する / un : _ / つまり、定義が未定義という不動点に
    // 至ってる。 / だから、 / un : _ / は書かなかったことと同じ。」、主の Claude の問い「同じ名前がほかにある所でも、`x : _` は席を取らずに消える、でいい？」（14:49 UTC）に
    // U〔答え〕[14:49]（ボタンの文は主の Claude の物）「席を取らないでいい。x : _ はどこでも書かなかったことにして、外の x が見えてしまう所だけ information で知らせる。片9 に入れて。」。
    if (isUnitRhs(def.rhs)) {
      F.erased.add(def.name);
      continue;
    }
    if (F.defs.has(def.name)) throw withLine(nameError("name-duplicate", `\`${def.name}\` がファイルのいちばん外で2回定義されています。`), rowLines.get(line));
    F.defs.set(def.name, def);
    F.defLines.set(def, rowLines.get(line));
    if (def.lambda) F.namedLambdas.set(def.lambda, def);
  }
  try {
    checkParamNames(lines, F);
    refuseExportMarkUse(lines, F);
  } catch (e) {
    // 深い括弧の入れ子を歩いて溢れても、内部の例外にしない（stackRefusal の注。2026-11-03 の片イの再確かめの直し：この2つは守りの外にあり、HEAD でも温めた
    // プロセスではここで RangeError が出ることがあった。行を指す inRowLine で入れ子1段のフレームが増え、前段と行を解く所より先にここで溢れやすくなった）。
    throw stackRefusal(e) || e;
  }
  F.fileScope = { parent: null, params: null, locals: null, hasImport: lines.some(hasImportIn), key: "file" };
  // 実体の深さの上限（INSTANCE_DEPTH_MARGIN の注の1）：入れ子の道で、括りの関数をそれぞれ余り（32）回まで通り直したときに届く
  // 深さ。呼んだ行に書いた形と、括りの関数を1つ通るたびに足される形は、書いたいちばん深い形までしか深くない。解く前にソースだけから決める。
  let written;
  try {
    written = writtenDepth(lines, F);
  } catch (e) {
    throw stackRefusal(e) || e; // 値の定義の長い鎖を辿って溢れても、内部の例外にしない（stackRefusal の注）
  }
  F.depthLimit = (INSTANCE_DEPTH_MARGIN * written.brackets + 1) * written.deepest;

  // 穴の生成名は、ソースの名前と衝突しない綴りにする（`$p0` が `p0` の番地と読めないように）。
  const names = new Set();
  for (const line of lines) forEachNameInTree(line, (n) => names.add(n));
  while ([...names].some((n) => new RegExp(`^${F.holePrefix}\\d+$`).test(n))) F.holePrefix += "_";

  // 種類を計算する順（§6.4 の1）：名前の種類、次に各「素の」関数の本体の根。ここで輪（name-cycle）を先に見つける。
  // 括りの関数の本体は、ここでは解かない（R25：実体を作るとき＝呼ばれたときにだけ解く）。§6.4 の1の3は「各関数の
  // 本体の根」と書いたままだが、R25 が後から決まったので、素の関数に読む。
  // 門はここでは止めない——その行を解くときに、行の順に同じ門で断る。
  // 解き直しの守り（guardAgain）で断ったら、ほかの誤りより先に、その言い分で断る（握りつぶされても、ほかの門に化けても）。
  // 値を含む輪（cycleError）で断ったら、その次に、その言い分で断る（輪は種類を計算する所で見つかるので、普通は行を解く
  // 前に、輪の言い分のまま投げ上がる）。
  // 実体の総数の守りに当たったら、その次に、行の門より先に断る。作った実体の数と入れ子の数の守り（資源の守り）は、行の門の
  // 後に言う（refusalOf。当たった所は門として未知になり、根の種類を解く所や namesPattern に握りつぶされても、覚えた断りは残る）。
  // 輪より後に置くのは、守りの断りが解く順に依らずに見つかる輪を覆わないため（前は総数の守りが先に投げ上がり、輪を見る前に
  // 止まる並べ方があった。確かめ 2026-10-20）。実体の深さの守りは、鍵だけで決まる普通の門なので、ほかの門と同じく行を解くとき
  // に断る（INSTANCE_DEPTH_MARGIN の注の1）。
  let trees;
  let lineError = null;
  // 断りの順（refusalOf）：資源の守りから来た断り（当たった `?` の実体を作らせなかった所）・汚れた計算で出た断りより、ほかの
  // 断りを先に覚える。資源の守りに当たる前に作った実体の門を、守りに当たった行が先に来る並べ方でも言う（確かめ 2026-10-20）。
  const rank = (e) => (e.guard ? 2 : e.suspect ? 1 : 0);
  const noteLineError = (e) => {
    if (!e.guard && F.lineTainted) e.suspect = true;
    if (!lineError || rank(e) < rank(lineError)) lineError = e;
  };
  // 前段（名前の種類と素の関数の本体の根）の断りでも止めず、残りの定義と行を解く。その断りは、定義の行を解くときにまた出る
  // （前は門でない断りで止めたので、総数を超えるかが定義の順で割れた。確かめ 2026-10-20）。解き直しの守りと値を含む輪に
  // 当たったら止める（それを言うので。解き続けると、抜けた枠の解き直しで解き直しの守りに当たった）。
  const ahead = (def, f) => {
    F.lineTainted = false;
    F.line = F.defLines.get(def);
    try {
      f();
    } catch (e) {
      if (!(e instanceof OperationError) || F.againRefused || F.cycleRefused) throw withLine(e, F.line);
    }
  };
  try {
    for (const def of F.defs.values()) if (!def.lambda) ahead(def, () => nameKindOf(F, def));
    for (const def of F.defs.values()) if (def.lambda && def.plain) ahead(def, () => bodyRootOf(F, def.lambda));

    // 各行を解く。括りの関数の実体は、呼んだ所で作って木まで解く（instantiate）。断る行があっても、残りの行を解き続ける：
    // 実体の総数はファイル全体の木の性質なので、断る行で止めると、総数を超えるかが行の順で割れた（門のある行と、合わせて
    // 総数を超える2つの行。確かめ 2026-10-20）。断る行は、最初の物を覚える（行の門が2つあれば、行の順に断る。今までどおり）。
    trees = [];
    for (const line of lines) {
      F.lineTainted = false;
      // R127：行の門は、その行（括りの関数の実体の中の門は呼んだ行）を持つ。この行で出た知らせも同じ行を持つ（下の finally）。
      F.line = rowLines.get(line);
      const diagFrom = diagnostics.length;
      try {
        // 評価する所（R42）は、定義でない行の根の並び（ここ）と、R76 で広げた比べ・論理の被演算子・字下げの本体の行（evaluatePlace）。`:` の右辺・`,` の辺・
        // 括りの中は今のまま。根の `,` が恒等射で
        // 消えて片方の並びだけが残れば、その並びが行の根なので評価する所（R45、evaluated）。
        const ctx0 = { F, scope: F.fileScope, diag: diagnostics, evaluate: !!line && line.type === "seq" };
        // 2026-10-28 の R107 の片：根の `,` が恒等射か書いた `_` で消えて片方の並びだけが残る行（R45・R61）は、残る並びを行の根として評価する所で解く（R107 の既定値の
        // 口を埋めるのも、R110 も、並びを根に書いたときと同じにする。法則12）。前は `,` の辺として評価する所の外で解いてから、余ったラムダだけを包み直していた（evaluated）。
        const rest = !!line && line.type !== "seq" && line.sym === "," && !isBlockSeq(line.left) ? vanishedSeq(line, ctx0) : null;
        // 残る側も単位になりうる綴り（`!_ , i`・`_ , !_`）は、どちらの単位を残すかの規則（R45・R71、resolveProduct）があるので、今までどおり `,` として解く。
        if (rest && rest !== line && rest.type === "seq" && !mayBeUnit(rest)) {
          trees.push(resolveTree(rest, { ...ctx0, evaluate: true }));
          continue;
        }
        const t = resolveTree(line, ctx0);
        const collapsed = !!line && line.type !== "seq" && line.sym === "," && !!t && !(t.t === "op" && t.sym === ",");
        trees.push(collapsed ? evaluated(t, { diag: diagnostics }) : t);
      } catch (e) {
        withLine(e, F.line);
        if (!(e instanceof OperationError) || F.againRefused || F.cycleRefused) throw e;
        noteLineError(e);
        trees.push(null);
      } finally {
        for (let k = diagFrom; k < diagnostics.length; k++) withLine(diagnostics[k], F.line);
      }
    }
  } catch (e) {
    // 合成の幅の守り（widthRefusal）も、スタックの溢れと同じ資源の守りの席に置く。
    const stack = stackRefusal(e) || widthRefusal(e);
    if (!stack && !(e instanceof OperationError)) throw e; // 内部の誤りは、覚えた断りで覆わない
    if (stack) F.stackRefused = withLine(stack, F.line);
    else noteLineError(e);
    throw refusalOf(F, lineError);
  }
  // `$v` の輪で仮に値を読む参照として通した所（R73）：v を解き終えた種類が値を読む参照の読みと合わなければ、引いた所で出た輪の断り（name-cycle）で断る。
  // 見直しは写しを歩く（v を解き直すと、また `$v` を引く。確かめ 2026-10-26）。v の右辺が輪の外の門で断られた形（selfReaderHolds が "gate"。`v : $v + 1` は
  // `$v + 1` の G7）は、その門の行の断りを言う（`$v` を `$u` に替えた形と同じ。行の断りが無ければ、今までどおり輪の断り）。
  for (const s of [...F.selfReaders]) {
    const held = selfReaderHolds(F, s.def);
    if (held === true || (held === "gate" && lineError)) continue;
    if (!F.cycleRefused || (F.cycleRefused.suspect && !s.error.suspect)) F.cycleRefused = s.error;
  }
  if (lineError || F.againRefused || F.cycleRefused || guardRefused(F)) throw refusalOf(F, lineError);

  // 括りの関数の `?` の木を、ファイル全体で集めた実体で埋める（R25）。全部の行を解き終えてから埋めるので、呼ぶ行が
  // 定義の前でも後でも同じ木になる。並べるのは、その `?` を通って呼ばれ（recordCall）、木まで解けた実体だけ：門に
  // 当たった実体は呼んだ行で断る（定義の行では断らず、描かない）。根の種類を出すときだけ仮に作った実体（仮置きの上で
  // 作った形）も、木まで解かれないので描かない。並び順は形の綴り、同じ綴りなら鍵（どちらも書いた物だけで決まる。
  // 鍵は canonKey なので、形を見た順に依らない）。
  for (const node of F.patternNodes) {
    const byScope = F.calls.get(node.pattern.op);
    const called = byScope && byScope.get(node.pattern.scopeKey);
    const insts = [...(called || [])].filter((i) => i.done && !i.error && i.tree);
    insts.sort((a, b) => (a.shapeText < b.shapeText ? -1 : a.shapeText > b.shapeText ? 1 : a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    node.pattern.insts = insts;
  }
  // 値の段（interpret.js）へ、書いた行の木（parseRow の行）と、行の木（括りと字下げのブロックの中の行も）から元のソースの行を引く関数も渡す。値は書いた項の並びを
  // 左から畳んで決める（R118）ので、木の予想ではなく行を読む。知らせは `_` の生まれた行を持つ。
  return { trees, diagnostics, rows: lines, lineOf: (row) => rowTreeLine.get(row) };
}

// ---------------------------------------------------------------------------
// 木を文字列にする
// ---------------------------------------------------------------------------

function showView(v) {
  if (!v) return "·";
  if (v.v === "atom") return v.text;
  if (v.v === "block") return `(block ${v.rows.map(show).join(" ")})`;
  return `(${v.sym} ${showView(v.left)} ${showView(v.right)})`;
}

/** 解いた木を S 式の文字列にする（書き方はファイルの頭の注）。 */
export function show(tree) {
  if (tree === null || tree === undefined) return "·";
  switch (tree.t) {
    case "leaf":
      return showView(tree.view);
    case "raw":
      return showView(tree.view);
    case "construct":
      return `(construct ${tree.items.map(show).join(" ")})`;
    case "compose":
      return `(compose ${tree.items.map(show).join(" ")})`;
    case "apply":
      return `(apply ${show(tree.head)} ${show(tree.arg)})`;
    case "hole":
      return `(? [${tree.params.join(" ")}] ${show(tree.body)})`;
    case "unit":
      return `(unit ${show(tree.inner)})`;
    case "lambda":
      if (tree.pattern) {
        const insts = tree.pattern.insts || [];
        if (!insts.length) return `(? [${tree.paramsText}] (defer {${tree.pattern.deferText}}))`;
        return `(? [${tree.paramsText}] ${insts.map((i) => `(inst ${i.shapeText} ${show(i.tree)})`).join(" ")})`;
      }
      return `(? [${tree.paramsText}] ${show(tree.body)})`;
    case "op":
      return `(${tree.sym} ${show(tree.left)} ${show(tree.right)})`;
    default:
      throw new Error(`知らない節: ${tree.t}`);
  }
}

/** 木の根の種類：'A'・'L'・'未知'。 */
export function kindOf(tree) {
  const k = tree && tree.kind && tree.kind.k;
  return k === "A" ? "A" : k === "L" ? "L" : k === "U" ? "未知" : null;
}
