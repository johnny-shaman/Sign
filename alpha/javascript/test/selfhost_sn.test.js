/**
 * **自己適用の門：Sign で書いたコンパイラに、自分自身の関数を通す。**
 *
 * 対象は「コンパイラ本体」——段1 `alpha/sign/lower.sn` ＋ 段2 `codegen.sn` と、その取り込み先
 * （parser.sn・lexer.sn・asm_text.sn・operator_table.sn・target_info.sn）を1つに束ねたもの。
 * 駆動は `g_run (lw_prog …)`（`codegen_sn.test.js` と同じ鎖）で、その駆動から届く関数ごとに:
 *
 *   段1   `lw_fst`（`lw_fns` が文ごとに当てるもの）で後置の語を出す
 *   段2   `g_run` で命令にする
 *   比較  `judge`：Sign の出力の字面を asmdiff の `normalizeAsm` に通し、その関数の区画を、素の pass4
 *         （regAlloc と peepholes を切り、身元は alpha/sign/option.ms）の区画と比べる。関数の**置かれた節**
 *         （関数ラベルに効いている `.text`・`.section …` などの節を替える指示の字面）も比べる。比べる前に、
 *         区画の中で定義されたローカルラベルを出た順に振り直し、区画の外で定義されたデータのラベル（`.LstrN`
 *         `.LanonN`、名前の付いた像も）を**像**——置かれた節・直前の整列・ラベルに続くデータの行（中の参照も
 *         像へ）——に置き換える。中身が同じ像も別の物なので、像には中身ごとに区画の中で出た順の番号を付ける
 *         （`adrp` と `:lo12:` の組の食い違い・2つの物を1つに潰す・1つを2つに割るを見る）。番号は束ねた全体と
 *         1関数とで振り方が違うからで、ほかに落とすのは normalizeAsm が落とすもの（注釈・空行・引用符の外の
 *         空白の連なり）だけ。区画の中の行は、整列も nop も読み飛ばさない。
 *   勘定  Sign の出力の行はどれも、その関数の区画・`_.main` の区画・その2つが引く像・節の指示のどれかに入る
 *         （`unaccountedOf`）。比べない所——関数の後ろに足された名前付きのコード、節の後の裸の命令、誰も
 *         引かない像——に何かが紛れ込んだら、比較とは別にここで名指しする。
 *
 * どちらの段も解釈器の上で走る（codegen_sn.test.js と同じ）。型は pass3 の `.ist`（`generateSignType` の
 * `scope: "ist"`）をプロセスの中で作って渡す——ディスクへは書かない（compiler_pipeline.md §4）。
 * 門は `lw_prog` を通らずに `lw_fst` を直に呼ぶので、`lw_prog` の最初の行（身元の検査 `lw_optck`）は
 * pass4 に渡したのと同じ option.ms の字面で別に通す。
 *
 * ## 毎片の門（利用者 2026-10-07）
 *
 * どの片も、この門を通してから着地する。自己適用の崩れを、崩した片の中で捕まえるためである（e6acea7a で
 * same が 35 本から 28 本に減ったのは、10-05 に測り直すまで誰も気付かなかった）。決まりは3つ：
 *
 *   1. differs（と unrefused・sign-only・empty）は 0 本のまま。1本でも出たら落ちる——golden を書き直しても
 *      通らない（`--update` は門の検査が全部通ったときしか書かない）。
 *   2. 断り → same は直した結果なので通してよい。ただし golden を `--update` で書き直し、**その片と同じ commit に**
 *      入れる。書き直さなければ、この門が「断りが一致になった」と名指しして落ちる。
 *   3. same → 断り・differs は、golden がそう変わっていない限り落ちる（閉じた集合が縮んだら別に名指しする）。
 *      golden を書き直して通すのは、その片がわざとそこを断りへ倒したときだけで、言い分を commit に書く。
 *
 * golden は HEAD 7437adeb（2026-10-07。alpha/ は ea281f4f と同じ）で取った：届く 247 本・same 28 本・閉じる 25 本・
 * differs 0 本。
 *
 * ## 段と時間
 *
 * `npm test`（test/run.js）が回す速い段に置く。1周は約 30 秒（2026-10-07、ワーカー全体：読み込み 4 秒・
 * 歩き 19 秒（うち対照 7 秒）・メモ無しの見本 3 秒）で、目安の2分に収まる。HEAD 7437adeb の解釈器と parser.sn
 * では 421 秒だった——解釈器の `s ' i` が引くたびに全文を広げていたのと、parser.sn の op_word が語を1字ずつ
 * 数えていたのを直して縮んだ。2分を超えるようになったら、速い段から外して自分の段へ移し、どの片の検証でも
 * 別に回す、と頭と alpha/javascript/README.md に書き直す。走り終わりに「1周」の行で時間を出す。
 *
 * 仕事は `resourceLimits.stackSizeMb`（256）を広げたワーカー1本で回す。今の門は `lw_prog` を通らず関数ごとに
 * `lw_fst` を呼ぶので、既定のスタックでも通る（2026-10-07、広げるのを外して確かめた）。広げてあるのは、段1の
 * 非末尾の再帰（`lw_fns`・`lw_lines` は文・行ごとに1段積む）を束ごと回す日の備えで、主の糸の `--stack-size` は
 * 本当のスタック（8 MiB）より深くできない（test/run.js の注記）。
 *
 * ## 範囲の外（codegen_sn の代わりではない）
 *
 *   区画の外    節の指示は、比べる関数と、その関数が引く像の置かれた節としてだけ比べる（codegen.sn の g_ro が
 *               像の節を `.section .rodata` から `.data` に替えると、その像を引く関数が differs になる。g_ro の
 *               「添字あり・文字列なし」の枝は codegen_sn のコーパスが踏まず、ここでは has が踏む）。記号の指示
 *               （`.global _.main`）と、比べる物を何も置かない節の指示は見ない（勘定が見るのは、区画の外に節の
 *               指示と像しか無いことまで）。`lw_prog`・`lw_fns`・`lw_main` のつなぎと `_.main` の区画（中身も
 *               置かれた節も）も見ない（g_run に渡すのは関数の語と空の `G`・`D` だけ）——そこは codegen_sn の
 *               全文の比較の受け持ち。関数の前に整列を置く出力になったら、整列は前の関数の区画の終わりに入り、
 *               1関数ずつの Sign の出力と食い違って名指しで落ちる——そのときは切り方を決め直す。
 *   踏まない道  入力はコンパイラ自身の字面だけなので、その字面が通らない枝（例：lw_hv の小文字の16進の枝）を
 *               壊しても、pass4 に渡す字面と Sign 側が同じだけ動いて緑のまま。そこは codegen_sn と各段の
 *               テストの受け持ち。
 *   値          走らせていない。命令が pass4 と同じことまでで、値は見ない。
 *
 * ## 取り込みの平らにし
 *
 * `lw_prog` は前処理した字面を1本読むので、取り込みは字面の段で平らにする。規則は compile.js の
 * `resolveImports` と同じ：取り込みの文の場所で撒く・同じファイルは一度だけ・取り込み先からは定義だけ・
 * 公開の印（`#` `##` `###`）は剥ぐ。**平らにした束が compile と同じ名前の定義を持つことを最初に確かめる**
 * ——名前の並び・定義でない文の数・公開の印・先勝ちで落ちた名前。これは名前の水準の突き合わせで、文の中身は
 * compile の展開と比べない。中身が崩れたら段1・段2は崩れた字面を下ろし、compile した pass4 の区画と食い違って
 * 黙った誤答の検出器か golden で落ちる。文の切れ目は Sign 側（`lw_next`）の歩きとも突き合わせる。
 *
 * ## 状態
 *
 *   same        pass4 の区画と一致
 *   ! 理由      段1か段2が名指しで断った（段1は `!` で始まる語、段2は `.err` の行）
 *   differs     Sign が命令を出し、pass4 の区画と違う——**黙った誤答の検出器**。1本でも出たら落ちる
 *   unrefused   pass4 が出せない関数（区画に「出せない」の注釈がある・その関数の阻む診断がある）に、
 *               Sign が断らずに命令を出した（pass4 が断るものは Sign も断る、codegen_sn と同じ）
 *   sign-only   pass4 に区画が無いのに Sign が命令を出した
 *   empty       段1が何も出さなかった
 *
 * differs・unrefused・sign-only・empty は golden に置けない（`--update` も書かずに落ちる）。
 *
 * ## golden（`selfhost_sn.golden.json`）
 *
 * 関数ごとの状態、pass4 が出せない関数の一覧、数（pass4 が出せる範囲と出せない範囲に分けて）、閉じた
 * 集合（same で、呼び先を推移的に辿った関数がすべて same——呼び先まで含めて、束ねて1回で出した Sign の
 * 出力の区画が pass4 と同じ関数。実機で走らせてはいない）。
 * 一致が断りに化けても、断りが一致に化けても、断りの理由が変わっても、関数が増えても減っても落ちる。
 * 閉じた集合が縮んだら名指しする。直して増えたなら `--update` で書き直す。
 *
 * **golden はコンパイラ本体の字面にも従う。** 門が通すのはコンパイラ自身なので、lower.sn・codegen.sn を
 * 直すと、届く関数や断りの理由が変わって golden と食い違う（直したら `--update` が普通の手順）。
 * 本体の誤りを捕まえる本当の合図は、golden との食い違いではなく、黙った誤答の検出器（differs など）と
 * 出力の行の勘定と束ねて1回の比較、それに下の対照である。
 *
 * **閉じるかは推移的に見る。** 直の呼び先だけを見ると、digit_run（same）を呼ぶ g_fk が閉じて見えるが、
 * digit_run の呼び先 is_digit は `&` で断られている——g_fk は Sign の出力だけでは走らない
 * （直の呼び先だけで数えると、閉じていない関数が閉じた集合に混ざる）。
 *
 * **pass4 が出せないかは区画の注釈も見る。** 阻む診断を構文木の持ち主で関数に帰すと、定数を撒いた先で
 * 断った形（lw_cst_st の中の lw_none の積）を定数の側へ帰してしまう。区画に「出せない」があれば出せない。
 *
 * ## 束ねて1回
 *
 * 関数を1本ずつ g_run に通すと、関数をまたぐ状態（`.Lstr` の番号・ラベルの番号）が一度も動かない
 * ——文字列の番号を常に 0 にする codegen.sn の誤り（g_lbl）は、09-30 の same の 35 本がどれも文字列を1つしか
 * 引かないので、1本ずつの比較を素通りした。それで same の関数の語を歩いた順につなぎ（`lw_fns` と
 * 同じ並び）、g_run に1回だけ通して、関数ごとの区画をもう一度 pass4 と比べる。束の中の違う文字列の
 * 像を回した表でも比べ、引いている関数がどれも「違う」になること（この比較が空振りでないこと）と、
 * 束の中でラベルを2度定義しないことも見る。
 *
 * 関数ごとの比較は区画の中の像の身元しか見ないので、束では**関数をまたいだ身元**も突き合わせる
 * （`identityClashes`：same の区画ごとに番号を付けた順の像のラベルを pass4 と組にし、束全体で1対1か）。
 * pass4 で2つの関数が引く1つの像を、Sign が関数ごとの写しに割った形（書ける像なら片方の書き込みがもう片方に
 * 見えない）は、どの区画も同じと言われてここで落ちる。2つ以上の関数が引く像を1つの関数の分だけ写しへ割る
 * 対照で、この突き合わせが空振りでないことも毎回見る。
 *
 * ## 比べる側を疑う（毎回回す対照）
 *
 * 門は作った直後が一番嘘をつく。same になった関数ごとに、Sign の出力の**生の行**（字下げだけを落とした
 * もの）へわざと傷を1本入れ、判定と同じ `judge`——normalizeAsm・区画の切り方（sectionsOf）・像の引き方
 * （dataTable）・canon・firstDiff——に通して「違う」と言われることを見る。傷は正規化の**前**に入れる。
 * 多を一に潰す正規化（引用符の外の `!` や `-` を落とす、`w` を `x` に均す…）は、その類の傷が潰れて「同じ」
 * と言われて落ちる（正規化の後の行に傷を入れると、潰れた形を傷が足し戻すので、緩んだ正規化と、潰れる形を
 * 出す codegen.sn の誤りの組が緑のまま通る）。
 *
 * 傷は `CONTROL_KINDS` の類ごとに、当てられる**すべての位置**へ1本ずつ入れる（HEAD 7437adeb の same 28 本で
 * 約 3.7 万本）：
 *
 *   行      落とす・写しを足す・隣と入れ替える・区画に無い行（nop・`.word 0`・整列）を足す
 *   命令    ニーモニックの最後の字と語彙の中の別の命令・条件の裏・即値の最後の桁と符号・レジスタの番号と
 *           幅・シフトの種類・再配置の指定・名前の最後の字・呼び先をこの区画の関数へ・名前の字の大小・
 *           書き戻しの `!`・前置と後置の番地の形
 *   並び    可換でない命令の隣り合う被演算子（`sub`・`sdiv`・`cmp`・`csel`・`lsl`・`stp`…。`add` などの
 *           2つの源は除く）・角括弧の中の隣り合う要素（レジスタ2つだけの足し算は除く）
 *   ラベル  参照を同じ種類／別の種類の別のラベルへ
 *   像      文字列と文字列でない像の各行・文字列の字の大小・置く指示・像の行の数・像の中の隣り合う違う
 *           行・`.byte` などの並びの隣り合う違う要素・整列（数と指示）・像に無い行（`.zero 1`・整列）を
 *           ラベルの後と行の間に足す
 *   節      関数と、区画が引く像を、置き場の違う節（`.text`・`.data`・`.section .rodata`・`.bss`）へ移す
 *           ——直前に節の指示を足す・効いている節の指示を替える
 *   身元    区画の中で2回以上引かれる像の、引く所の1つを、同じ中身の写し（新しいラベル）へ向ける
 *           ——`adrp` と `:lo12:` の組が食い違う形、1つの物を2つに割る形
 *
 * 字を替える傷は同じ類の別の字へ（数字は数字、英字は英字）、長さも変えない——字を別の類へ替える傷は、
 * その類を消す正規化（即値を `#` に均すなど）を素通しする。閉じた語彙（ニーモニック・シフト・再配置・
 * 置く指示）には語彙の中の本物の隣へ替える傷も置く（字を替えるだけでは、`lsl`/`lsr` を1つに均す形と
 * `:lo12:` を消す形を素通しする）。どの傷も、pass4 と同じと言ってはならない区画を作る——並んだラベルの
 * 入れ替え・`#` の有無・可換な2つの源の入れ替え・大小を区別しないニーモニックやレジスタや指定の大小の
 * ような、意味の変わらない書き換えは作らない。足す行は、命令の列か像の中身を変える行（nop・`.word 0`・
 * `.zero 1`・0 で埋める整列）と配置を変えうる整列で、比べ方が区画や像の行を読み飛ばさないかを問う
 * （区画の切り方が整列の行を読み飛ばすと、0 で埋める整列——実行すれば udf——を足した出力が緑になる）。
 *
 * **確かめているのは列挙した類だけ**で、類の外の緩みは見えない。見つけたら類を足す——類の足りない対照は、
 * その類を見ない比べ方（即値・条件・ニーモニック・行の順・シフト・再配置・被演算子の順・像と並びの順・
 * 字の大小・足された行・置かれた節・像の身元）を素通しする。合成の見本にも全類が当たる区画を置き、絞った回（`--only`）でも
 * 比べ方の緩みはそこで落ちる。比べない所は、対照ではなく上の勘定（`unaccountedOf`）が見る——pass4 の
 * 全文（区画・像・節の指示だけ）、Sign の出力の1関数ずつと束。
 *
 * **正規化の釘。** normalizeAsm が落としてよいのは注釈・空行・引用符の外の空白の連なりだけ（asmdiff.mjs の
 * 冒頭の一線）。その一線を `plainNormalize` として別に書き、pass4 の出力と Sign の出力（1関数ずつと束）で
 * 行ごとに突き合わせる。Sign の出力は注釈も空白の連なりも持たないので、字下げを落とした生の行とも同じはず
 * ——対照の傷を生の行へ入れてよい前提がこれで、崩れたら名指しで落ちる。釘は対照と違う向きから効く：
 * 潰す形が Sign の出力に1つも無くても（codegen.sn の誤りで消えていても）、pass4 の側で食い違う。
 *
 * ## 速さ（メモは記号表 S3 の代わり、この門だけが使う）
 *
 * 段1は呼び出しのたびに全文を読み直す（記号表 S3 がまだ無い）。その代わりに、この門の中だけで、
 * 純粋な Sign 関数（`lw_stoks` `lw_next` `lw_lfend` `lw_arity` `lw_cst` `lw_sig`）の結果を、**実引数
 * すべて**を鍵にしてメモする。答えは毎回 Sign の関数そのものが出したもので、JS で書き直した規則は
 * 無い（表から答える形は置かない）。鍵は種類ごとに分ける——`__`（UNIT）・undefined・空の並び・空の
 * 文字列・数と文字列・`-0` と `0` を混ぜない。鍵にできない値（文字列・数・`__`・その並び以外）が来たら
 * メモせずに呼ぶ。`lw_dup` は文の位置ごとに1回しか呼ばれず当たりが 0 だったので、メモしない。
 *
 * メモが透明である（答えが、メモ無しで呼んだときと同じ）ための条件は3つで、それぞれ別の所で見る：
 *
 *   鍵が実引数を取りこぼさない     **当たりのたびに**、覚えた関数と実引数を、今の関数と実引数と、鍵とは別の
 *                                  書き方（`sameValue`）で突き合わせる。食い違ったら覚えた答えは返さずに元の
 *                                  関数を呼び、名指しして落ちる。見るのはすべての当たり
 *   配った答えを誰も書き換えない   覚えた答えは同じ値を何度も配るので、走り終わってから綴り直し、覚えたときと
 *                                  同じかを見る。見るのはすべての答え
 *   関数が純粋                     メモした6本は、読むと実引数だけで答えが決まる（`#` の書き込みもストリーム形
 *                                  の仮引数も無い）。これは機械では確かめず、見本の関数をメモ無しで下ろして、
 *                                  関数ごとの結果——段1の語の列と、それを段2に通した命令の字面——がメモ付きと
 *                                  同じことで端から端まで見る。見本は数本だけで、見本の外の崩れは golden と
 *                                  黙った誤答の検出器が受け止める
 *
 * 既定の見本は、束で最初に一致した関数（段1＋段2を通しで）・lower.sn の最初の関数・メモした関数のうち
 * まだ誰も呼んでいないものを呼ぶ最初の関数——メモした6本がどれも見本の中で1回以上呼ばれることも見る
 * （`--memo-check 0` で切る、`--memo-check N` で N 本まで足す、`--memo-check-names f,g` で名指し）。
 * 見本がどれも束の前の方にあるのは、メモ無しの重さが文の位置でほぼ決まるから（先勝ちの確かめ lw_dup が
 * 前の文を全部読み直す）。ワーカーは1本だけで回す（並べない——重い検査は1本ずつ）。
 *
 * 時間の内訳（2026-10-07）：文の歩きと 247 関数の下ろし・対照約 3.7 万本で 19 秒（対照は解釈器を回さないので、
 * 傷ごとに judge を正規化から通しても 7 秒）、束ねて1回は 1 秒未満、メモ無しの見本3本（has・lw_1・op1）で 3 秒。
 *
 * 実行: npm test（速い段）、または node test/selfhost_sn.test.js [--update] [--memo-check N]
 *       [--memo-check-names f,g] [--only f,g]
 *       （--only は golden の関数ごとの状態だけを見る。数と閉じた集合は見ない——直している最中の確かめ用。
 *       頼んだ関数が1本でも下ろされなければ落ちる）
 *       このファイルを import しても門は走らない（走るのは node で直に起動したときだけ）。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import { UNIT } from "../runtime_kind.js";
import { normalizeAsm } from "../asmdiff.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SIGN = path.join(__dirname, "..", "..", "sign");
const GOLDEN = path.join(__dirname, "selfhost_sn.golden.json");
const DRIVER = "g_run (lw_prog `1` `x` `y`)";
// メモ無しで下ろし直す見本の数の下限（既定）。見本は下の決まりで選び、足りなければ一致と断りから足す。
const MEMO_CHECK_DEFAULT = 2;
const MEMOIZED = ["lw_stoks", "lw_next", "lw_lfend", "lw_arity", "lw_cst", "lw_sig"];

const readImport = (p) => fs.readFileSync(path.join(SIGN, p), "utf8").replace(/\r\n/g, "\n");

// ---------------------------------------------------------------------------------------------
// 字面の段の取り込み（compile.js の resolveImports と同じ規則）
// ---------------------------------------------------------------------------------------------

/** 前処理した字面を、深さ 0 の CR で文に割る（文字の字面と文字列の中は数えない）。 */
export function splitStatements(p) {
	const out = [];
	let d = 0;
	let start = 0;
	for (let i = 0; i < p.length; i++) {
		const c = p[i];
		if (c === "\\") {
			i++;
			continue;
		}
		if (c === "`") {
			const j = p.indexOf("`", i + 1);
			i = j < 0 ? p.length : j;
			continue;
		}
		if ("[({\u0002".includes(c)) d++;
		else if ("])}\u0003".includes(c)) d--;
		else if (c === "\r" && d === 0) {
			out.push(p.slice(start, i));
			start = i + 1;
		}
	}
	out.push(p.slice(start));
	return out.filter((s) => s.trim() !== "");
}
/** `` `x.sn`@~ `` の文なら道を返す（compile の importPathOf）。 */
export const importOf = (st) => {
	const m = st.trim().match(/^`([^`]+)`@~$/);
	return m ? m[1] : null;
};
/** 定義の文なら名前と公開の印を返す（compile の definedNameOf）。 */
export const definedOf = (st) => {
	const m = st.match(/^\s*(#{0,3})([A-Za-z_][A-Za-z_0-9]*)\s+:(?=[\s\u0002]|$)/);
	return m ? { name: m[2], exported: m[1].length > 0 } : null;
};
const dirOf = (p) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
const joinRel = (base, rel) => path.posix.normalize(base ? base + "/" + rel : rel);

/**
 * 入口の字面を束ねる。取り込みはその場で撒き、同じファイルは一度だけ、取り込み先からは定義だけを
 * 公開の印を剥いで持ってくる。入口の文はそのまま（印も残す）。
 */
export function bundleOf(entry, entryName, read, preprocess) {
	const done = new Set();
	const walk = (src, top, from) => {
		const out = [];
		for (const st of splitStatements(preprocess(src))) {
			const rel = importOf(st);
			if (rel !== null) {
				const full = joinRel(top ? "" : dirOf(from), rel);
				if (done.has(full)) continue;
				done.add(full);
				for (const x of walk(read(full), false, full)) out.push(x);
				continue;
			}
			if (!top) {
				const d = definedOf(st);
				if (!d) continue;
				out.push({ text: d.exported ? st.replace(/^(\s*)#{1,3}/, "$1") : st, from });
				continue;
			}
			out.push({ text: st, from });
		}
		return out;
	};
	const stmts = walk(entry, true, entryName);
	return { stmts, flat: stmts.map((s) => s.text).join("\r") };
}

// ---------------------------------------------------------------------------------------------
// 区画の比べ方（正規化した行の上で）
// ---------------------------------------------------------------------------------------------

// 節を替える指示。関数と像は、その行に効いている節を替える指示の字面を「置かれた節」として比べる
const SECTION_SWITCH = /^\.(section|text|data|bss|rodata|pushsection|popsection|previous|subsection)\b/;
// 節の指示（区画の切れ目）：節を替える指示と、記号の指示（`.global`・`.hidden`。記号の指示は比べない）
const SECTION_DIRECTIVE = /^\.(section|text|data|bss|rodata|pushsection|popsection|previous|subsection|global|hidden)\b/;
const NO_SECTION = "(節なし)";

/** 行ごとに、その行に効いている節を替える指示（前に無ければ「節なし」）。 */
export function homeAt(lines) {
	const out = new Array(lines.length);
	let h = NO_SECTION;
	for (let i = 0; i < lines.length; i++) {
		out[i] = h;
		if (SECTION_SWITCH.test(lines[i])) h = lines[i];
	}
	return out;
}

/**
 * 関数ラベルから次の節の指示・関数ラベルまでを、その関数の区画にする（区画ごとに、行の位置の並び）。
 * 間の行は1つも読み飛ばさない——整列（`.p2align`）も nop も区画の行として比べる。
 */
export function sectionIndex(lines) {
	const secs = new Map();
	let cur = null;
	lines.forEach((l, i) => {
		const m = l.match(/^("?)([^".][^"]*)\1:$/);
		if (m && !l.startsWith(".")) {
			cur = m[2];
			secs.set(cur, [i]);
			return;
		}
		if (SECTION_DIRECTIVE.test(l)) {
			cur = null;
			return;
		}
		if (cur) secs.get(cur).push(i);
	});
	return secs;
}
/** 区画ごとの行（sectionIndex の位置を行に引いたもの）。 */
export function sectionsOf(lines) {
	return new Map([...sectionIndex(lines)].map(([k, is]) => [k, is.map((i) => lines[i])]));
}

// データを置く指示（像の中身の行）と整列の指示
const DATA_DIRECTIVE = /^\.(quad|xword|dword|8byte|word|4byte|long|int|hword|2byte|short|byte|ascii|asciz|string|zero|space|fill)\b/;
const ALIGN_DIRECTIVE = /^\.(balign|p2align|align)\b/;
const TEXT_DIRECTIVE = /^\.(ascii|asciz|string)\b/;
const LOCAL_DEF = /^(\.L[A-Za-z_]+\d+):$/;
const LOCAL_REF = /^\.L[A-Za-z_]+\d+$/;
// 被演算子の中の名前（引用符で括った綴りも1つの名前）。数の途中（`0x1f` の `x1f`）からは始めない
const OPERAND_NAME = /"(?:[^"\\]|\\.)*"|(?<![A-Za-z0-9_$.])\.?[A-Za-z_][A-Za-z0-9_$.]*/g;
const NO_ALIGN = "(整列なし)";

/**
 * データのラベルの像の置き場。ラベル（`.LstrN` `.LanonN`・名前の付いた像）ごとに、置かれた節（ラベルに効いている
 * 節を替える指示の字面）、直前の整列の行の位置（無ければ -1）と、ラベルに続くデータの行の位置の並び。データの
 * 行が続かないラベル（命令が続く）は載せない。
 */
export function dataIndex(lines) {
	const t = new Map();
	let home = NO_SECTION;
	for (let i = 0; i < lines.length; i++) {
		const l = lines[i];
		if (SECTION_SWITCH.test(l)) home = l;
		if (!l.endsWith(":") || l.includes(" ")) continue;
		const body = [];
		for (let k = i + 1; k < lines.length && DATA_DIRECTIVE.test(lines[k]); k++) body.push(k);
		if (body.length === 0) continue;
		t.set(l.slice(0, -1), { home, align: i > 0 && ALIGN_DIRECTIVE.test(lines[i - 1]) ? i - 1 : -1, body });
	}
	return t;
}
/** データのラベルの像を引く表：置かれた節、直前の整列の行（無ければ「整列なし」）と、ラベルに続くデータの行の並び。 */
export function dataTable(lines) {
	return new Map([...dataIndex(lines)].map(([k, d]) => [k, { home: d.home, align: d.align < 0 ? NO_ALIGN : lines[d.align], body: d.body.map((i) => lines[i]) }]));
}

/** 行の被演算子の中の名前を `f` で置き換える（ラベルの行と文字列の中身の行は触らない）。 */
function mapOperandNames(l, f) {
	if (l.endsWith(":") && !l.includes(" ")) return l;
	if (TEXT_DIRECTIVE.test(l)) return l;
	const k = l.indexOf(" ");
	if (k < 0) return l;
	return l.slice(0, k) + l.slice(k).replace(OPERAND_NAME, f);
}

/** 区画が引いているデータのラベル（区画の中で定義されたものを除く）を、出た順に1つずつ。 */
export function dataRefsOf(sec, data) {
	const local = new Set(sec.map((l) => (l.match(LOCAL_DEF) || [])[1]).filter(Boolean));
	const out = [];
	for (const l of sec)
		mapOperandNames(l, (t) => {
			if (!local.has(t) && data.has(t) && !out.includes(t)) out.push(t);
			return t;
		});
	return out;
}

/**
 * 区画を比べられる形にする。区画の中で定義されたローカルラベルは出た順に振り直し、区画の外で
 * 定義されたデータのラベルは像——置かれた節・直前の整列・データの行（中の参照も像へ）——に置き換える。
 * どちらでもない `.L` の参照は `?` を付けてそのまま——番号が合わなければ違うと言う側へ倒す。
 *
 * **像の身元。** 中身が同じ像が2つあっても別の物なので、像には中身ごとに出た順の番号を付ける
 * （`DATA<…>#0`・`#1`。区画の行を順に読み、像を読み終えた順）。`adrp x9, .Lstr0` と `add x9, x9, :lo12:.Lstr1`
 * のように組が食い違った形（中身が同じでも番地は page(.Lstr0)+lo12(.Lstr1)）も、2つの物を1つに潰した形も、
 * 1つの物を2つに割った形も、ここで違う綴りになる。`labels` は番号を付けた順のラベル（束の身元の突き合わせ用）。
 */
export function canonOf(sec, data) {
	const local = new Set(sec.map((l) => (l.match(LOCAL_DEF) || [])[1]).filter(Boolean));
	const map = new Map();
	const renum = (lab) => {
		if (!map.has(lab)) map.set(lab, `.L${lab.slice(2).replace(/\d+$/, "")}#${map.size}`);
		return map.get(lab);
	};
	const tok = new Map();
	const nth = new Map();
	const labels = [];
	const image = (key, trail) => {
		if (tok.has(key)) return tok.get(key);
		if (trail.includes(key)) return `DATA<循環 ${key}>`;
		const d = data.get(key);
		const inner = [...trail, key];
		const lines = d.body.map((l) => mapOperandNames(l, (t) => (data.has(t) ? image(t, inner) : LOCAL_REF.test(t) ? "?" + t : t)));
		const c = `DATA<${d.home} | ${d.align} | ${lines.join(" | ")}>`;
		const k = nth.get(c) ?? 0;
		nth.set(c, k + 1);
		tok.set(key, `${c}#${k}`);
		labels.push(key);
		return tok.get(key);
	};
	const lines = sec.map((l) => {
		const def = l.match(LOCAL_DEF);
		if (def) return renum(def[1]) + ":";
		return mapOperandNames(l, (t) => {
			if (local.has(t)) return renum(t);
			if (data.has(t)) return image(t, []);
			return LOCAL_REF.test(t) ? "?" + t : t;
		});
	});
	return { lines, labels };
}
export const canon = (sec, data) => canonOf(sec, data).lines;
const insnCount = (sec) => sec.filter((l) => !l.endsWith(":") && !l.startsWith(".")).length;
/** 2つの区画を比べる。同じなら null、違えば最初に食い違った行。 */
export function firstDiff(psec, pdata, ssec, sdata) {
	const a = canon(psec, pdata);
	const b = canon(ssec, sdata);
	let k = 0;
	while (k < a.length && k < b.length && a[k] === b[k]) k++;
	if (k === a.length && k === b.length) return null;
	return { at: k, p4: a[k] ?? "(end)", sign: b[k] ?? "(end)" };
}

/** 区画ごとの置かれた節（関数ラベルに効いている節を替える指示の字面）。 */
export function homesOf(lines) {
	const H = homeAt(lines);
	return new Map([...sectionIndex(lines)].map(([k, is]) => [k, H[is[0]]]));
}
/** pass4 の出力を judge が引く形にする（normalizeAsm の行の区画・区画の置かれた節・像の表）。 */
export function pass4Side(text) {
	const lines = normalizeAsm(text);
	return { lines, secs: sectionsOf(lines), homes: homesOf(lines), data: dataTable(lines) };
}
/**
 * **判定の道。** Sign の出力の字面（生）を normalizeAsm に通し、区画を切り、像を引き、pass4 の区画と比べる。
 * 関数の置かれた節も pass4 と比べる（像の置かれた節は像の綴りに入っている）。同じなら null、違えば最初に
 * 食い違った行。関数ごとの判定も対照の傷もこの1本を通る——傷を正規化の前に入れるので、正規化・区画の
 * 切り方・像の引き方の緩みも対照に見える。
 */
export function judge(text, name, p4) {
	const lines = normalizeAsm(text);
	const si = sectionIndex(lines).get(name);
	if (!si) return { at: 0, p4: (p4.secs.get(name) || [])[0] ?? "(end)", sign: "(区画が無い)" };
	const sh = homeAt(lines)[si[0]];
	const ph = p4.homes.get(name) ?? NO_SECTION;
	if (sh !== ph) return { at: 0, p4: `（置かれた節）${ph}`, sign: `（置かれた節）${sh}` };
	return firstDiff(p4.secs.get(name) || [], p4.data, si.map((i) => lines[i]), dataTable(lines));
}
/**
 * **束の像の身元。** 関数ごとの canon は区画の中の身元しか見ないので、関数をまたいで1つの物を2つに割った形
 * （pass4 は f と g が同じ像を引き、Sign はそれぞれ中身が同じ別の像を引く）や、2つを1つに潰した形は、どの
 * 区画も同じと言われる。canon が同じと言った区画ごとに、番号を付けた順のラベルを pass4 と Sign で組にし、
 * 束全体で組が1対1かを見る。食い違った組を返す（空なら1対1）。区画が違う関数は数えない（judge が名指しする）。
 */
export function identityClashes(names, p4, lines) {
	const secs = sectionsOf(lines);
	const data = dataTable(lines);
	const s2p = new Map();
	const p2s = new Map();
	const out = [];
	for (const nm of names) {
		const ps = p4.secs.get(nm);
		const ss = secs.get(nm);
		if (!ps || !ss) continue;
		const a = canonOf(ps, p4.data);
		const b = canonOf(ss, data);
		if (a.lines.join("\n") !== b.lines.join("\n")) continue;
		a.labels.forEach((p, i) => {
			const s = b.labels[i];
			if (s2p.has(s) && s2p.get(s) !== p) out.push(`${nm}: Sign の ${s} が pass4 の ${s2p.get(s)} と ${p} に当たる`);
			if (p2s.has(p) && p2s.get(p) !== s) out.push(`${nm}: pass4 の ${p} が Sign の ${p2s.get(p)} と ${s} に当たる`);
			s2p.set(s, p);
			p2s.set(p, s);
		});
	}
	return out;
}

// ---------------------------------------------------------------------------------------------
// 正規化の釘
// ---------------------------------------------------------------------------------------------

/**
 * normalizeAsm が落としてよいもの（注釈・空行・引用符の外の空白の連なり、asmdiff.mjs の冒頭の一線）を、
 * 別の書き方で落とした行の列。引用符（`\"` は閉じない）の中は写し、外は `//` から先を落として空白の
 * 連なりを1つに潰す。
 */
export function plainNormalize(text) {
	const out = [];
	for (const raw of String(text).split("\n")) {
		let s = "";
		const parts = raw.split(/("(?:[^"\\]|\\.)*")/);
		for (let k = 0; k < parts.length; k++) {
			if (k % 2 === 1) {
				s += parts[k];
				continue;
			}
			const c = parts[k].indexOf("//");
			s += (c < 0 ? parts[k] : parts[k].slice(0, c)).replace(/[ \t\r]+/g, " ");
			if (c >= 0) break;
		}
		s = s.trim();
		if (s !== "") out.push(s);
	}
	return out;
}
/** 生の行（字下げと行末の空白だけを落とし、空行を除く）。対照の傷はこの行へ入れる。 */
export const viewOf = (text) =>
	String(text)
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l !== "");
/**
 * 正規化の釘：normalizeAsm と plainNormalize が行ごとに同じ（Sign の出力なら、生の行とも同じ）。
 * 同じなら null、食い違えば最初の行の言い分。
 */
export function pinOf(text, sign) {
	const a = normalizeAsm(text);
	const b = plainNormalize(text);
	const c = sign ? viewOf(text) : b;
	for (let i = 0; i < Math.max(a.length, b.length, c.length); i++)
		if (a[i] !== b[i] || b[i] !== c[i]) return `@${i} normalizeAsm「${a[i] ?? "(end)"}」/ 参照「${b[i] ?? "(end)"}」${sign ? ` / 生「${c[i] ?? "(end)"}」` : ""}`;
	return null;
}

// ---------------------------------------------------------------------------------------------
// 比べる側への傷（対照）
// ---------------------------------------------------------------------------------------------

/** 1字を**同じ類**の別の字へ（数字は次の数字、英字は次の英字、`_` は `a`、ほかの記号は `_`）。 */
export function bumpChar(c) {
	if (/^[0-8a-yA-Y]$/.test(c)) return String.fromCharCode(c.charCodeAt(0) + 1);
	if (c === "9") return "0";
	if (c === "z") return "a";
	if (c === "Z") return "A";
	return c === "_" ? "a" : "_";
}
/** 数の綴りの最後の桁を、同じ基数の別の桁へ（`0x3f` → `0x30`、`-16` → `-17`、`9` → `0`）。数でなければ null。 */
export function bumpNumber(tok) {
	const h = /^(-?0[xX][0-9a-fA-F]*)([0-9a-fA-F])$/.exec(tok);
	if (h) {
		const d = ((parseInt(h[2], 16) + 1) % 16).toString(16);
		return h[1] + (/[A-F]/.test(h[2]) ? d.toUpperCase() : d);
	}
	const m = /^(-?\d*)(\d)$/.exec(tok);
	return m ? m[1] + ((Number(m[2]) + 1) % 10) : null;
}
// 条件の綴りと、その裏
const FLIP = { eq: "ne", ne: "eq", cs: "cc", cc: "cs", hs: "lo", lo: "hs", mi: "pl", pl: "mi", vs: "vc", vc: "vs", hi: "ls", ls: "hi", ge: "lt", lt: "ge", gt: "le", le: "gt" };
const REGISTER = /^(?:[xw](?:[12]?\d|30)|sp|wsp|xzr|wzr)$/;
// 浮動小数点・ベクタも含めたレジスタの綴り（大小を区別しないので、字の大小の傷を当てない。記号がこう読める
// 綴りなら pass4 は引用符で括る）
const ANY_REGISTER = /^(?:[xwbhsdqv](?:[12]?\d|3[01])(?:\.\d*[bhsdq])?|w?sp|[xw]zr)$/i;
const REG_NEXT = { sp: "xzr", xzr: "sp", wsp: "wzr", wzr: "wsp" };
const REG_WIDTH = { sp: "wsp", wsp: "sp", xzr: "wzr", wzr: "xzr" };
// 閉じた語彙の中の、意味の違う**本物の**隣。字を1つ替える傷は語彙の外へ出るので、語彙ごと均す正規化
// （`lsl`/`lsr` を1つに、`add`/`sub` を1つに…）を素通しする——それで語彙の中の別の語へ替える傷も置く
const MNEM_ALT = {
	add: "sub", sub: "add", adds: "subs", subs: "adds", and: "orr", orr: "eor", eor: "and", ands: "bics",
	ldr: "str", str: "ldr", ldrb: "strb", strb: "ldrb", ldrh: "strh", strh: "ldrh", ldp: "stp", stp: "ldp", ldur: "stur", stur: "ldur", ldrsb: "ldrsh", ldrsh: "ldrsb", ldrsw: "ldr",
	cmp: "cmn", cmn: "cmp", tst: "cmp", mov: "mvn", mvn: "mov", movz: "movn", movn: "movz", movk: "movz", neg: "mvn",
	csel: "csinc", csinc: "csel", csinv: "csneg", csneg: "csinv", cset: "csetm", csetm: "cset", cinc: "cneg", cneg: "cinc", ccmp: "ccmn", ccmn: "ccmp",
	b: "bl", bl: "b", br: "blr", blr: "br", ret: "eret", cbz: "cbnz", cbnz: "cbz", tbz: "tbnz", tbnz: "tbz",
	mul: "smulh", smulh: "umulh", umulh: "smulh", madd: "msub", msub: "madd", sdiv: "udiv", udiv: "sdiv",
	lsl: "lsr", lsr: "lsl", asr: "lsr", ror: "lsr", sxtw: "uxtw", uxtw: "sxtw", sxtb: "uxtb", uxtb: "sxtb", sxth: "uxth", uxth: "sxth",
	adr: "adrp", adrp: "adr",
};
const SHIFT_ALT = { lsl: "lsr", lsr: "lsl", asr: "lsr", ror: "lsl", uxtw: "sxtw", sxtw: "uxtw", uxtb: "sxtb", sxtb: "uxtb", uxth: "sxth", sxth: "uxth", uxtx: "sxtx", sxtx: "uxtx" };
// （`.zero`・`.space`・`.fill` は互いに同じ意味になりうるので置かない）
const DIRECTIVE_ALT = { ".quad": ".word", ".xword": ".word", ".dword": ".word", ".8byte": ".4byte", ".word": ".quad", ".4byte": ".8byte", ".long": ".quad", ".int": ".quad", ".hword": ".byte", ".2byte": ".byte", ".short": ".byte", ".byte": ".hword", ".ascii": ".asciz", ".asciz": ".ascii", ".string": ".ascii", ".balign": ".p2align", ".p2align": ".balign", ".align": ".balign" };
const withDirective = (l) => {
	const d = l.split(" ")[0];
	return DIRECTIVE_ALT[d] ? DIRECTIVE_ALT[d] + l.slice(d.length) : null;
};
// 再配置の指定（`:lo12:` など）
const RELOC = /:([a-z_][a-z_0-9]*):/g;
// 命令の即値（`#` の後の数）と、行の中の独り立ちの数（名前の途中の桁は数えない）
const IMMEDIATE = /#(-?(?:0[xX][0-9a-fA-F]+|\d+))(?![0-9A-Za-z_])/g;
const NUMBER = /(?<![A-Za-z0-9_$.])-?(?:0[xX][0-9a-fA-F]+|\d+)(?![0-9A-Za-z_$.])/g;
const QUOTED_LAST = /"((?:[^"\\]|\\.)*)"(?!.*")/;
const isLabelLine = (l) => l.endsWith(":") && !l.includes(" ");
const isInsnLine = (l) => !l.endsWith(":") && !l.startsWith(".");
const isZero = (t) => /^-?(0[xX]0+|0+)$/.test(t);

/** 行の被演算子の中で re に当たる所ごとに、そこだけを f(当たり) に替えた行を1本ずつ（f が null なら飛ばす）。 */
function eachOperand(l, re, f) {
	const k = l.indexOf(" ");
	if (k < 0) return [];
	const head = l.slice(0, k);
	const ops = l.slice(k);
	const out = [];
	for (const m of ops.matchAll(re)) {
		const to = f(m);
		if (to === null || to === undefined) continue;
		out.push(head + ops.slice(0, m.index) + to + ops.slice(m.index + m[0].length));
	}
	return out;
}
/** 像の1行への傷：引用符の中の最後の字、無ければ最後の独り立ちの数。どちらも無ければ null。 */
function bumpDataLine(l) {
	const q = QUOTED_LAST.exec(l);
	if (q) {
		const s = q[1];
		const t = s === "" ? "a" : s.slice(0, -1) + bumpChar(s.slice(-1));
		return l.slice(0, q.index) + `"${t}"` + l.slice(q.index + q[0].length);
	}
	const ms = [...l.matchAll(NUMBER)];
	if (ms.length === 0) return null;
	const m = ms[ms.length - 1];
	return l.slice(0, m.index) + bumpNumber(m[0]) + l.slice(m.index + m[0].length);
}

/** 対照の類。どの類も「その類だけが違う区画」を作り、比べる道（judge）がその類を見落とすと捕まる。 */
export const CONTROL_KINDS = ["drop", "dup", "swap", "insert", "mnem", "mnemAlt", "cond", "imm", "sign", "reg", "width", "shift", "reloc", "name", "callee", "case", "wb", "addr", "opSwap", "memSwap", "labelSame", "labelOther", "str", "data", "dir", "imgLen", "imgSwap", "imgInsert", "listSwap", "align", "home", "imgSplit"];

// 置き場の違う節（実行・読むだけ・書ける・中身を持たない）。同じ置き場の別の綴り（`.data` と `.section .data`）は
// 意味が同じなので、傷ではその綴りへ替えない
const HOMES = [".text", ".data", ".section .rodata", ".bss"];
const homeKind = (h) => {
	const m = /^\.section\s+([^\s,]+)/.exec(h);
	return (m ? m[1] : h).replace(/^\.(text|data|bss|rodata)(?:\..*)?$/, ".$1");
};
/** 置かれた節 h と置き場の違う節の指示。 */
export const homeAlts = (h) => HOMES.filter((x) => homeKind(x) !== homeKind(h));

// 区画に**無い**行（比べ方が行を読み飛ばさないかを問う）。命令の列を変える行（nop・`.word 0`・0 で埋める整列）と、
// 配置を変えうる整列。どれも区画のどの位置に足しても pass4 の区画とは違う
const FOREIGN_TEXT = ["nop", ".word 0", ".p2align 4, 0", ".p2align 4", ".balign 16", ".align 3"];
// 像に無い行：像の中身を変える `.zero 1` と、ラベルと中身の間・中身の途中に詰め物を入れうる整列
const FOREIGN_DATA = [".zero 1", ".balign 16", ".p2align 4"];

// 入れ替えても意味の変わらない被演算子の組（位置 j と j+1）：加算・論理演算・乗算の2つの源と、cmn・tst の2つ。
// ここに無い命令（sub・sdiv・cmp・csel・lsl・stp…）は、隣り合う被演算子を入れ替えると意味が変わる
const COMMUTES = { add: 1, adds: 1, and: 1, ands: 1, orr: 1, eor: 1, mul: 1, mneg: 1, smulh: 1, umulh: 1, smull: 1, umull: 1, madd: 1, msub: 1, smaddl: 1, umaddl: 1, smsubl: 1, umsubl: 1, cmn: 0, tst: 0 };

/** 命令の被演算子を、角括弧と引用符の外の `,` で割る。`, ` でつなぎ直して元の行に戻るときだけ返す（ほかは null）。 */
function operandsOf(l) {
	const k = l.indexOf(" ");
	if (k < 0) return null;
	const s = l.slice(k + 1);
	const ops = [];
	let depth = 0;
	let quoted = false;
	let start = 0;
	for (let i = 0; i < s.length; i++) {
		const c = s[i];
		if (quoted) {
			if (c === "\\") i++;
			else if (c === '"') quoted = false;
		} else if (c === '"') quoted = true;
		else if (c === "[") depth++;
		else if (c === "]") depth--;
		else if (c === "," && depth === 0) {
			ops.push(s.slice(start, i).trim());
			start = i + 1;
		}
	}
	ops.push(s.slice(start).trim());
	const mn = l.slice(0, k);
	return mn + " " + ops.join(", ") === l ? { mn, ops } : null;
}
/** 最後の英字（`\` の直後の字は除く）の大小を入れ替える。英字が無ければ null。 */
export function flipLastLetter(t) {
	for (let p = t.length - 1; p >= 0; p--) {
		if (!/[A-Za-z]/.test(t[p]) || t[p - 1] === "\\") continue;
		const c = t[p];
		return t.slice(0, p) + (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()) + t.slice(p + 1);
	}
	return null;
}

/**
 * 像 `key` の写し：どのラベルとも重ならない新しいラベル `fresh`、写しの行（直前の整列・新しいラベル・同じデータの
 * 行）、置く位置 `after`（元の像の最後の行の直後——同じ節・同じ整列に置く）。
 */
export function imageCopyOf(lines, di, key) {
	const taken = new Set(lines.filter(isLabelLine).map((l) => l.slice(0, -1)));
	const base = LOCAL_REF.test(key) ? key.replace(/\d+$/, "") : key + "_";
	let k = 900;
	while (taken.has(base + k)) k++;
	const fresh = base + k;
	const d = di.get(key);
	return { fresh, copy: [...(d.align >= 0 ? [lines[d.align]] : []), fresh + ":", ...d.body.map((p) => lines[p])], after: d.body[d.body.length - 1] + 1 };
}

/**
 * **比べる側への傷。** Sign の出力の生の行 `lines`（viewOf）の、関数 `name` の区画と、区画が引く像へ、
 * 当てられる**すべての位置**で1つずつ傷を入れた行の列の並び（`{ kind, at, lines }`）。どれも judge で
 * 「違う」と言われなければならない（傷は正規化の前に入る）。
 *
 * どの傷も意味の違う区画を作る（同じ番地を指すラベルの並べ替え・`#` の有無・`[x9]` と `[x9, #0]`・
 * 可換な2つの源の入れ替え・大小を区別しない綴りの大小のような、意味の変わらない書き換えは作らない）。
 * 行の類：落とす・写しを足す・隣と入れ替える（並んだラベルどうしと、canon した綴りが同じ2行は除く）・
 * 区画に無い行（`FOREIGN_TEXT`）をラベルの後から最後の行の後までのすべての位置へ足す。
 * 命令の中の類：ニーモニックの最後の字と語彙の中の別の命令・条件の裏・即値の最後の桁・即値の符号・
 * レジスタの番号・レジスタの幅・シフトと拡張の種類・再配置の指定（外す・別の指定へ）・名前（レジスタ・
 * 条件・ラベル以外——呼び先・`lsl`・`lo12` など）の最後の字・呼び先をこの区画の関数へ・記号（呼び先・
 * ラベル・像の名前）の字の大小・書き戻しの `!`・前置と後置の番地の形。並びの類：可換でない命令の隣り合う
 * 被演算子・角括弧の中の隣り合う要素。ラベルの類：参照を同じ種類／別の種類の別のラベルへ。像の類：
 * 文字列と文字列でない像の各行（字も数も同じ類の別の字へ、長さは変えない）・文字列の字の大小・置く指示・
 * 像の行の数・像の中の隣り合う違う行・並び（`.byte 97, 34`）の隣り合う違う要素・整列（数と指示）・
 * 像に無い行（`FOREIGN_DATA`）をラベルの後と行の間へ足す。節の類：関数と区画が引く像を、置き場の違う節
 * （`homeAlts`）へ——直前に節の指示を足す・効いている節の指示を替える。身元の類：区画の中で2回以上引かれる
 * 像の、引く所の1つを同じ中身の写しへ向ける（1回しか引かれない像を写しへ向けても、区画の中の身元の形は
 * 変わらないので置かない。関数をまたぐ身元は束の突き合わせと、その対照が見る）。
 *
 * 字を1つ替える傷は語彙の外へ出るので、語彙ごと均す正規化（`lsl`/`lsr` を1つに、`:lo12:` を消す…）を
 * 素通しする（変異で確かめた）。閉じた語彙（ニーモニック・条件・レジスタ・シフト・再配置・置く指示）には
 * 語彙の中の本物の隣へ替える傷も置く。
 */
export function mutantsOf(lines, name) {
	const si = sectionIndex(lines).get(name);
	if (!si) return [];
	const di = dataIndex(lines);
	const sdata = dataTable(lines);
	const ssec = si.map((p) => lines[p]);
	const out = [];
	const put = (kind, at, ls) => out.push({ kind, at, lines: ls });
	// 位置 p の行を替える・落とす・写しを足す、位置 p と q の行を入れ替える
	const setAt = (p, l) => lines.map((x, k) => (k === p ? l : x));
	const dropAt = (p) => lines.filter((_, k) => k !== p);
	const dupAt = (p) => [...lines.slice(0, p + 1), lines[p], ...lines.slice(p + 1)];
	const insertAt = (p, l) => [...lines.slice(0, p), l, ...lines.slice(p)];
	const swapAt = (p, q) => lines.map((x, k) => (k === p ? lines[q] : k === q ? lines[p] : x));
	const n = ssec.length;
	// ---- 行の並び（0 行目は区画の名前のラベル）----
	for (let i = 1; i < n; i++) put("drop", i, dropAt(si[i]));
	for (let i = 1; i < n; i++) if (!isLabelLine(ssec[i])) put("dup", i, dupAt(si[i]));
	// 区画に無い行を、ラベルの後から最後の行の後までのすべての位置へ（読み飛ばす行の規則はここで落ちる）
	for (let i = 1; i <= n; i++) for (const f of FOREIGN_TEXT) put("insert", `${i}${f}`, insertAt(i < n ? si[i] : si[n - 1] + 1, f));
	const C = canon(ssec, sdata);
	for (let i = 1; i + 1 < n; i++) {
		if (isLabelLine(ssec[i]) && isLabelLine(ssec[i + 1])) continue; // 並んだラベルは同じ番地を指す
		if (C[i] === C[i + 1]) continue;
		put("swap", i, swapAt(si[i], si[i + 1]));
	}
	// ---- 命令の中 ----
	const defs = [...new Set(ssec.filter((l) => LOCAL_DEF.test(l)).map((l) => l.slice(0, -1)))];
	const local = new Set(defs);
	const kindL = (d) => d.replace(/\d+$/, "");
	const plainName = (t) => !REGISTER.test(t) && !FLIP[t] && !local.has(t) && !LOCAL_REF.test(t) && !sdata.has(t);
	const self = ssec[0].slice(0, -1);
	for (let i = 1; i < n; i++) {
		const l = ssec[i];
		if (!isInsnLine(l)) continue;
		const withLine = (_, x) => setAt(si[i], x);
		const each = (kind, re, f) => {
			for (const x of eachOperand(l, re, f)) put(kind, i, withLine(i, x));
		};
		// ニーモニック（`b.eq` なら `b` の方）の最後の字
		const base = l.split(" ")[0].split(".")[0];
		put("mnem", i, withLine(i, base.slice(0, -1) + bumpChar(base.slice(-1)) + l.slice(base.length)));
		// ニーモニックを語彙の中の別の命令へ（`add` → `sub`。条件付きの `b.cc` は条件の傷が受け持つ）
		const mn = l.split(" ")[0];
		if (MNEM_ALT[mn]) put("mnemAlt", i, withLine(i, MNEM_ALT[mn] + l.slice(mn.length)));
		// 条件：`b.cc` の cc と、最後の被演算子の cc（csel・cset・ccmp …）
		const bc = /^b\.([a-z]{2})(?= |$)/.exec(l);
		if (bc && FLIP[bc[1]]) put("cond", i, withLine(i, "b." + FLIP[bc[1]] + l.slice(4)));
		const lc = /, ([a-z]{2})$/.exec(l);
		if (lc && FLIP[lc[1]]) put("cond", i, withLine(i, l.slice(0, -2) + FLIP[lc[1]]));
		// 即値：最後の桁と符号（0 の符号は意味を変えないので除く）
		each("imm", IMMEDIATE, (m) => "#" + bumpNumber(m[1]));
		each("sign", IMMEDIATE, (m) => (isZero(m[1]) ? null : "#" + (m[1].startsWith("-") ? m[1].slice(1) : "-" + m[1])));
		// レジスタ：番号と幅
		each("reg", OPERAND_NAME, (m) => (!REGISTER.test(m[0]) ? null : REG_NEXT[m[0]] ?? m[0][0] + (Number(m[0].slice(1)) === 30 ? 29 : Number(m[0].slice(1)) ^ 1)));
		each("width", OPERAND_NAME, (m) => (!REGISTER.test(m[0]) ? null : REG_WIDTH[m[0]] ?? (m[0][0] === "x" ? "w" : "x") + m[0].slice(1)));
		// シフト・拡張の種類を語彙の中の別の種類へ（`lsl #48` → `lsr #48`）
		each("shift", OPERAND_NAME, (m) => SHIFT_ALT[m[0]] ?? null);
		// 再配置の指定（`:lo12:`）を外す・別の指定へ
		each("reloc", RELOC, () => "");
		each("reloc", RELOC, (m) => (m[1] === "got_lo12" ? ":lo12:" : ":got_lo12:"));
		// 名前（呼び先・シフトの種類・再配置の指定など）の最後の字
		each("name", OPERAND_NAME, (m) => {
			const t = m[0];
			if (!plainName(t)) return null;
			const b = t.endsWith('"') && t.length >= 3 ? t.slice(0, -2) + bumpChar(t.slice(-2, -1)) + '"' : t.slice(0, -1) + bumpChar(t.slice(-1));
			return plainName(b) ? b : null;
		});
		// 名前を、在る別の関数（この区画の関数そのもの）へ。知っている名前だけを均す正規化も捕まえる
		const inReloc = (m) => m.input[m.index - 1] === ":" && m.input[m.index + m[0].length] === ":";
		each("callee", OPERAND_NAME, (m) => (plainName(m[0]) && !SHIFT_ALT[m[0]] && !inReloc(m) && m[0] !== self ? self : null));
		// 番地の形：書き戻しの `!` の有無、前置（`[r, #n]`）と後置（`[r], #n`）
		each("wb", /\[([^\]]*), (#[^\]]+)\](!?)/g, (m) => `[${m[1]}, ${m[2]}]${m[3] ? "" : "!"}`);
		each("addr", /\[([^\]]*), (#[^\]]+)\]!?/g, (m) => `[${m[1]}], ${m[2]}`);
		each("addr", /\[([^\],]*)\], (#[^\s,\]]+)/g, (m) => `[${m[1]}, ${m[2]}]`);
		// 飛び先のラベルを、区画の中の別のラベルへ。**同じ種類のラベル**（.Larm3 → .Larm5）へ移す傷は、ラベルを
		// 種類だけに均す正規化（番号を捨てる）でも見分けられるかを問う（変異で確かめた）
		each("labelSame", OPERAND_NAME, (m) => (local.has(m[0]) ? defs.find((d) => d !== m[0] && kindL(d) === kindL(m[0])) : null));
		each("labelOther", OPERAND_NAME, (m) => (local.has(m[0]) ? defs.find((d) => kindL(d) !== kindL(m[0])) : null));
		// 記号（呼び先・ラベル・像の名前）の字の大小。記号は大小を区別する——ニーモニック・レジスタ・条件・
		// シフト・再配置の指定は区別しないので替えない
		each("case", OPERAND_NAME, (m) => (REGISTER.test(m[0]) || ANY_REGISTER.test(m[0]) || FLIP[m[0]] || /^(al|nv)$/i.test(m[0]) || SHIFT_ALT[m[0]] || inReloc(m) ? null : flipLastLetter(m[0])));
		// 並び：可換でない命令の隣り合う被演算子（`sub x9, x10, x9`・`cmp x10, x9`・`stp x30, x29, …`）
		const o = operandsOf(l);
		if (o)
			for (let j = 0; j + 1 < o.ops.length; j++) {
				if (o.ops[j] === o.ops[j + 1] || COMMUTES[o.mn] === j) continue;
				const ys = [...o.ops];
				[ys[j], ys[j + 1]] = [ys[j + 1], ys[j]];
				put("opSwap", i, withLine(i, o.mn + " " + ys.join(", ")));
			}
		// 角括弧の中の隣り合う要素（`[x29, #16]` → `[#16, x29]`）。基底と添字のレジスタ2つだけなら足し算なので除く
		for (const m of l.matchAll(/\[([^\]]*)\]/g)) {
			const xs = m[1].split(", ");
			if (xs.length === 2 && REGISTER.test(xs[0]) && REGISTER.test(xs[1])) continue;
			for (let j = 0; j + 1 < xs.length; j++) {
				if (xs[j] === xs[j + 1]) continue;
				const ys = [...xs];
				[ys[j], ys[j + 1]] = [ys[j + 1], ys[j]];
				put("memSwap", i, withLine(i, l.slice(0, m.index) + "[" + ys.join(", ") + "]" + l.slice(m.index + m[0].length)));
			}
		}
	}
	// ---- 像：区画が引く像の行へ入れる ----
	const isStr = (k) => /^\.Lstr\d+$/.test(k);
	const canonLine = (l) => canon([l], sdata)[0];
	for (const key of dataRefsOf(ssec, sdata)) {
		const d = di.get(key);
		const body = d.body.map((p) => lines[p]);
		body.forEach((l, j) => {
			const p = d.body[j];
			const b = bumpDataLine(l);
			if (b !== null) put(isStr(key) ? "str" : "data", `${key}#${j}`, setAt(p, b));
			// 置く指示を語彙の中の別の指示へ（`.quad` → `.word`、`.ascii` → `.asciz`）
			const dl = withDirective(l);
			if (dl !== null) put("dir", `${key}#${j}`, setAt(p, dl));
			// 文字列の字の大小
			const q = TEXT_DIRECTIVE.test(l) ? QUOTED_LAST.exec(l) : null;
			const f = q ? flipLastLetter(q[1]) : null;
			if (f !== null) put("case", `${key}#${j}`, setAt(p, l.slice(0, q.index) + `"${f}"` + l.slice(q.index + q[0].length)));
			// 並び（`.byte 97, 34, 98`）の隣り合う違う要素。像を指す要素どうしは中身が同じことがあるので除く
			const k = l.indexOf(" ");
			const xs = k < 0 || TEXT_DIRECTIVE.test(l) ? [] : l.slice(k + 1).split(", ");
			for (let a = 0; a + 1 < xs.length; a++) {
				if (xs[a] === xs[a + 1] || (sdata.has(xs[a]) && sdata.has(xs[a + 1]))) continue;
				const ys = [...xs];
				[ys[a], ys[a + 1]] = [ys[a + 1], ys[a]];
				put("listSwap", `${key}#${j}`, setAt(p, l.slice(0, k + 1) + ys.join(", ")));
			}
			// 像の中の隣り合う違う行
			if (j + 1 < body.length && canonLine(l) !== canonLine(body[j + 1])) put("imgSwap", `${key}#${j}`, swapAt(p, d.body[j + 1]));
			// 像に無い行を、ラベルと最初の行の間・行と行の間へ（最後の行の後の整列は次の像の前の詰め物で、この像の
			// 中身を変えないので置かない。最後の行の後の `.zero 1` は imgLen+ と同じ形）
			for (const f of FOREIGN_DATA) put("imgInsert", `${key}#${j}${f}`, insertAt(p, f));
		});
		const last = d.body[d.body.length - 1];
		put("imgLen", `${key}-`, dropAt(last));
		put("imgLen", `${key}+`, dupAt(last));
		if (d.align >= 0) {
			const al = lines[d.align];
			const a = bumpDataLine(al);
			if (a !== null) put("align", key, setAt(d.align, a));
			const da = withDirective(al);
			if (da !== null) put("align", `${key}.dir`, setAt(d.align, da));
		}
	}
	// ---- 置かれた節：関数と、区画が引く像を、置き場の違う節へ移す（直前に節の指示を足す・効いている指示を替える）----
	const H = homeAt(lines);
	const switchBefore = (at) => {
		for (let k = at - 1; k >= 0; k--) if (SECTION_SWITCH.test(lines[k])) return k;
		return -1;
	};
	const moves = [[name, si[0]], ...dataRefsOf(ssec, sdata).map((key) => [key, di.get(key).align >= 0 ? di.get(key).align : di.get(key).body[0] - 1])];
	for (const [what, first] of moves) {
		const g = switchBefore(first);
		for (const alt of homeAlts(H[first])) {
			put("home", `${what}<${alt}`, insertAt(first, alt));
			if (g >= 0) put("home", `${what}=${alt}`, setAt(g, alt));
		}
	}
	// ---- 像の身元：区画の中で2回以上引かれる像の、引く所の1つを、同じ中身の写し（新しいラベル、元の像の直後）へ。
	// adrp と :lo12: の組が食い違う（1つの物を2つに割る）形 ----
	const uses = new Map();
	for (let i = 1; i < n; i++) {
		if (!isInsnLine(ssec[i])) continue;
		mapOperandNames(ssec[i], (t) => {
			if (!local.has(t) && sdata.has(t)) uses.set(t, (uses.get(t) ?? 0) + 1);
			return t;
		});
	}
	for (const [key, count] of uses) {
		if (count < 2 || key.startsWith('"')) continue;
		const { fresh, copy, after } = imageCopyOf(lines, di, key);
		for (let i = 1; i < n; i++) {
			if (!isInsnLine(ssec[i])) continue;
			eachOperand(ssec[i], OPERAND_NAME, (m) => (m[0] === key ? fresh : null)).forEach((x, o) => {
				const ls = setAt(si[i], x);
				ls.splice(after, 0, ...copy);
				put("imgSplit", `${key}@${i}.${o}`, ls);
			});
		}
	}
	return out;
}

/**
 * **出力の行の勘定。** 行はどれも、(1) 名前が `allowed` にある区画、(2) 像（直前の整列・ラベル・データの行）、
 * (3) 節の指示、のどれかに入らなければならない。入らない行を `@位置 行` で返す（空なら勘定が合う）。
 *
 * `allowed` が Set なら、そこに無い区画は像だけでできていなければならず（余分な区画——関数の後ろに足された
 * 名前付きのコード——はここで出る）、像はどれも `allowed` の区画から（像の中の参照も辿って）引かれて
 * いなければならない。`allowed` が null なら区画はどれも入ってよく、像は引かれていなくてよい（pass4 の全文）。
 * 比べるのは区画だけなので、比べない所に命令が紛れ込んでいないかを、切り方とは別の勘定で見る。
 */
export function unaccountedOf(lines, allowed) {
	const si = sectionIndex(lines);
	const di = dataIndex(lines);
	const ok = new Set();
	for (const [k, is] of si) if (!allowed || allowed.has(k)) for (const i of is) ok.add(i);
	// 像の行。allowed が Set なら、allowed の区画から引かれた像だけ
	let used = null;
	if (allowed) {
		const data = dataTable(lines);
		used = new Set();
		const q = [];
		for (const k of allowed) if (si.has(k)) q.push(...dataRefsOf(si.get(k).map((i) => lines[i]), data));
		while (q.length) {
			const k = q.pop();
			if (used.has(k)) continue;
			used.add(k);
			q.push(...dataRefsOf(data.get(k).body, data));
		}
	}
	for (const [k, d] of di) {
		if (used && !used.has(k)) continue;
		if (d.align >= 0) ok.add(d.align);
		ok.add(d.body[0] - 1);
		for (const i of d.body) ok.add(i);
	}
	const out = [];
	lines.forEach((l, i) => {
		if (!ok.has(i) && !SECTION_DIRECTIVE.test(l)) out.push(`@${i} ${l}`);
	});
	return out;
}

// ---------------------------------------------------------------------------------------------
// メモの鍵（種類ごとに分ける）
// ---------------------------------------------------------------------------------------------

/**
 * 値の綴り（JSON の木）。文字列はそのまま、数・`__`・undefined は札付き、並びは並び。できなければ null。
 * `__`（UNIT）と undefined と空の並び `[]` と空の文字列は、`isUnit` ではどれも真だが種類が違う
 * （runtime_kind の `kindOf` は List と Unit を分ける）ので、綴りも分ける。
 */
export function encValue(v) {
	if (typeof v === "string") return v;
	if (typeof v === "number") return { n: Object.is(v, -0) ? "-0" : String(v) };
	if (typeof v === "bigint") return { b: String(v) };
	if (v === UNIT) return { u: "UNIT" };
	if (v === undefined) return { u: "undefined" };
	if (Array.isArray(v) && Object.getPrototypeOf(v) === Array.prototype && Object.keys(v).length === v.length) {
		const parts = [];
		for (const x of v) {
			const e = encValue(x);
			if (e === null) return null;
			parts.push(e);
		}
		return parts;
	}
	return null;
}
/**
 * 鍵の1つぶん：札と値の組（どちらも文字列）。札で引くので、文字列の "1" と数の 1、文字列と並びの綴りは
 * 混ざらない。鍵にできない値なら null。
 */
export function keyPart(v) {
	if (typeof v === "string") return ["s", v];
	if (typeof v === "number") return ["n", Object.is(v, -0) ? "-0" : String(v)];
	if (typeof v === "bigint") return ["b", String(v)];
	if (v === UNIT) return ["u", "UNIT"];
	if (v === undefined) return ["u", "undefined"];
	if (Array.isArray(v)) {
		const e = encValue(v);
		return e === null ? null : ["a", JSON.stringify(e)];
	}
	return null;
}
/**
 * 2つの値が同じ値か（鍵とは別の書き方で）：文字列は字面、数は `Object.is`（`-0` と `0` は別）、並びは要素ごと、
 * ほか（`__`・undefined）は同じ物か。文字列と並び、数と文字列は同じにならない。
 */
export function sameValue(x, y) {
	if (typeof x === "string" || typeof y === "string") return x === y;
	if (typeof x === "number" && typeof y === "number") return Object.is(x, y);
	if (Array.isArray(x) && Array.isArray(y)) return x.length === y.length && x.every((v, i) => sameValue(v, y[i]));
	if (Array.isArray(x) || Array.isArray(y)) return false;
	return x === y;
}
const sameArgs = (a, b) => a.length === b.length && a.every((v, i) => sameValue(v, b[i]));

/**
 * メモの表（メモする関数ごとに1つ）。鍵は実引数の数と、実引数ひとつずつの札と値（`keyOf`、既定は keyPart）。
 * 覚えた答えは、覚えた関数の名前と実引数と組で置き、**当たりは、引く関数が覚えた関数と同じで、今の実引数が
 * 覚えた実引数と値として同じ（sameValue）ときだけ**返す。鍵が実引数を取りこぼしていて別の実引数が同じ鍵に
 * 落ちたら（表を関数どうしで分け合って、別の関数の答えに当たったときも）、当たりにせず `clash`（覚えた実引数）を
 * 返す。get の答え：`{ hit: true, r }`・`{ hit: false, node }`（覚える場所。鍵にできない実引数なら null）・
 * `{ hit: false, node: null, clash, by }`（by は覚えた関数）。
 */
export function memoTable(keyOf = keyPart) {
	const root = new Map();
	return {
		get(name, args) {
			let node = root.get(args.length);
			if (!node) root.set(args.length, (node = new Map()));
			for (const a of args) {
				const kp = keyOf(a);
				if (kp === null) return { hit: false, node: null };
				let t = node.get(kp[0]);
				if (!t) node.set(kp[0], (t = new Map()));
				let nx = t.get(kp[1]);
				if (!nx) t.set(kp[1], (nx = new Map()));
				node = nx;
			}
			if (!node.has("=")) return { hit: false, node };
			const e = node.get("=");
			return e.name === name && sameArgs(e.args, args) ? { hit: true, r: e.r } : { hit: false, node: null, clash: e.args, by: e.name };
		},
		set(node, name, args, r) {
			node.set("=", { name, args: [...args], r });
		},
	};
}

// ---------------------------------------------------------------------------------------------
// 束の関数の呼び合い（pass2 の木から）
// ---------------------------------------------------------------------------------------------
const idOf = (n) => (n && n.type === "atom" && n.kind === "identifier" ? String(n.value).replace(/^<|>$/g, "") : null);
function graphOf(nodes) {
	const defs = new Map();
	const roots = [];
	for (const t of nodes) {
		if (t && t.type === "operation" && t.name === "define") {
			const nm = idOf(t.left);
			if (!defs.has(nm)) defs.set(nm, t);
		} else roots.push(t);
	}
	const refs = (n) => {
		const out = new Set();
		const seen = new Set();
		const st = [n];
		while (st.length) {
			const x = st.pop();
			if (!x || typeof x !== "object" || seen.has(x)) continue;
			seen.add(x);
			if (Array.isArray(x)) {
				x.forEach((y) => st.push(y));
				continue;
			}
			const id = idOf(x);
			if (id && defs.has(id)) out.add(id);
			for (const [k, v] of Object.entries(x)) if (!["binding", "valueNode", "scope", "parent"].includes(k) && v && typeof v === "object") st.push(v);
		}
		return out;
	};
	const direct = new Map();
	for (const [id, d] of defs) direct.set(id, refs(d.right));
	const isFn = (id) => {
		const d = defs.get(id);
		return !!d && d.right && d.right.type === "operation" && d.right.name === "lambda";
	};
	const reach = new Set();
	const q = [];
	for (const r of roots) for (const id of refs(r)) q.push(id);
	while (q.length) {
		const id = q.pop();
		if (reach.has(id)) continue;
		reach.add(id);
		for (const x of direct.get(id)) q.push(x);
	}
	// 関数が直に呼ぶ関数（定数は段1が中身を撒くので、定数を通り抜けて数える）
	const calls = new Map();
	for (const id of defs.keys()) {
		if (!isFn(id)) continue;
		const out = new Set();
		const seen = new Set();
		const qq = [...direct.get(id)];
		while (qq.length) {
			const x = qq.pop();
			if (seen.has(x)) continue;
			seen.add(x);
			if (isFn(x)) out.add(x);
			else for (const y of direct.get(x) || []) qq.push(y);
		}
		out.delete(id);
		calls.set(id, out);
	}
	return { defs, roots, reach, isFn, calls };
}

// ---------------------------------------------------------------------------------------------
// ワーカー：束ね、pass4、段1・段2
// ---------------------------------------------------------------------------------------------
async function work(cfg) {
	const log = (line) => parentPort.postMessage({ log: line });
	const peggy = (await import("peggy")).default;
	const { compile } = await import("../compile.js");
	const { generateAsm } = await import("../pass4.js");
	const { generateSignType } = await import("../st.js");
	const { readOptionMs } = await import("../option_ms.js");
	const { blockingOf } = await import("../errors.js");
	const { preprocess } = await import("../lexer.js");
	const { evaluate, newRuntimeEnv, envDefine, isUnit, observe } = await import("../interpreter.js");
	const tStart = performance.now();
	const parser = peggy.generate(fs.readFileSync(path.join(__dirname, "..", "sign.pegjs"), "utf8"));
	const res = { checks: [], functions: [], timing: {} };
	const check = (note, got, want) => res.checks.push({ note, got, want });

	// ---- 束 ----
	const SRC = readImport("lower.sn") + "\n" + readImport("codegen.sn") + "\n" + DRIVER + "\n";
	const ENTRY = "lower.sn+codegen.sn";
	const { stmts, flat: FLAT } = bundleOf(SRC, ENTRY, readImport, preprocess);
	const c = compile(SRC, { parse: parser.parse, readImport, charset: "ascii" });
	check("束の compile の診断が 0 件（先勝ちの断りも無い）", c.diagnostics.map((d) => String(d.message).slice(0, 80)), []);
	const G = graphOf(c.nodes);
	// 入口の文が lower.sn と codegen.sn のどちらのものか（見本の選び方と表示のため）
	const namesIn = (file) => new Set(splitStatements(preprocess(readImport(file))).map(definedOf).filter(Boolean).map((d) => d.name));
	const lowerNames = namesIn("lower.sn");
	const codegenNames = namesIn("codegen.sn");
	const sideOf = (nm, from) => (from !== ENTRY ? from : lowerNames.has(nm) ? "lower.sn" : codegenNames.has(nm) ? "codegen.sn" : from);

	// 平らにした束が compile の展開と同じ定義を持つか
	{
		const flatDefs = stmts.map((s) => definedOf(s.text)).filter(Boolean);
		const seen = new Set();
		const firstWins = flatDefs.filter((d) => (seen.has(d.name) ? false : seen.add(d.name)));
		const dups = flatDefs.length - firstWins.length;
		const cDefs = c.nodes.filter((t) => t && t.type === "operation" && t.name === "define");
		const lambdasC = cDefs.filter((t) => G.isFn(idOf(t.left))).map((t) => idOf(t.left));
		const lambdasF = firstWins.map((d) => d.name).filter((n) => G.isFn(n));
		check("束の関数の定義が compile と同じ名前・同じ順", lambdasF.length === lambdasC.length && lambdasF.every((n, i) => n === lambdasC[i]) ? "同じ" : { flat: lambdasF.length, compile: lambdasC.length, firstMismatch: lambdasF.findIndex((n, i) => n !== lambdasC[i]) }, "同じ");
		const valsC = cDefs.filter((t) => !G.isFn(idOf(t.left))).map((t) => idOf(t.left)).sort();
		const valsF = firstWins.map((d) => d.name).filter((n) => !G.isFn(n)).sort();
		check("束の値の定義が compile と同じ名前の集まり", JSON.stringify(valsF) === JSON.stringify(valsC) ? "同じ" : { onlyFlat: valsF.filter((x) => !valsC.includes(x)), onlyCompile: valsC.filter((x) => !valsF.includes(x)) }, "同じ");
		check("束の後に書いた同名の定義の数が compile の先勝ちの断りと同じ", dups, c.diagnostics.filter((d) => d.reason === "redefinition-refused").length);
		check("束の定義でない文の数が compile と同じ", stmts.filter((s) => !definedOf(s.text)).length, c.nodes.length - cDefs.length);
		const expC = cDefs.filter((t) => t.exported || (t.left && t.left.exported) || (t.right && t.right.exported)).map((t) => idOf(t.left)).sort();
		const expF = firstWins.filter((d) => d.exported).map((d) => d.name).sort();
		check("束の公開の印が compile と同じ", expF, expC);
		res.bundle = { statements: stmts.length, bytes: FLAT.length, files: [...new Set(stmts.map((s) => s.from))] };
	}

	// ---- pass4（素）と .ist ----
	const OPT = readImport("option.ms");
	const conf = readOptionMs(OPT);
	check("alpha/sign/option.ms が読める（警告 0 件）・身元は段1が通すもの", [conf.target, conf.layer, conf.charset, conf.warnings], ["aarch64_qemu", 1, "ascii", []]);
	const g4 = generateAsm(c.nodes, c.env, { target: conf.target, charset: conf.charset, layer: conf.layer, regAlloc: false, peepholes: false });
	const ist = generateSignType(c.nodes, c.env, { scope: "ist" }).text;
	const P4 = pass4Side(g4.text);
	const { lines: p4lines, secs: p4secs, data: p4data } = P4;
	check("pass4 の行はどれも、どこかの区画・像・節の指示に入る（区画の切り方が行を取りこぼさない）", unaccountedOf(p4lines, null).slice(0, 8), []);
	check("pass4 の出力で normalizeAsm が落とすのは注釈・空行・引用符の外の空白の連なりだけ（正規化の釘）", pinOf(g4.text, false), null);
	// pass4 が出せない関数：区画に「出せない」の注釈があるか、その関数の阻む診断がある
	const blocked = new Set();
	{
		let cur = null;
		for (const l of g4.text.split("\n")) {
			const m = l.match(/^("?)([^".\s][^"]*)\1:$/);
			if (m) cur = m[2];
			else if (/^\s*\.(section|data|text|global|hidden)\b/.test(l)) cur = null;
			else if (cur && l.includes("// 出せない:")) blocked.add(cur);
		}
		const owner = new Map();
		for (const [nm, d] of G.defs) {
			const seen = new Set();
			const st = [d];
			while (st.length) {
				const n = st.pop();
				if (!n || typeof n !== "object" || seen.has(n)) continue;
				seen.add(n);
				if (!owner.has(n)) owner.set(n, nm);
				if (Array.isArray(n)) n.forEach((x) => st.push(x));
				else for (const [k, v] of Object.entries(n)) if (!["binding", "valueNode", "scope", "parent", "atomType", "elementType"].includes(k) && v && typeof v === "object") st.push(v);
			}
		}
		const unattributed = [];
		for (const x of blockingOf(g4.diagnostics)) {
			const byPrefix = (String(x.message).match(/^([A-Za-z_][A-Za-z_0-9]*):/) || [])[1];
			const fn = owner.get(x.node) || (byPrefix && G.defs.has(byPrefix) ? byPrefix : null);
			if (fn) blocked.add(fn);
			else unattributed.push(String(x.message).slice(0, 100));
		}
		res.p4 = { diagnostics: g4.diagnostics.length, blocking: blockingOf(g4.diagnostics).length, unattributed };
	}

	// ---- 段1・段2を1つの環境に ----
	const tLoad = performance.now();
	const lib = compile(readImport("lower.sn") + "\n" + readImport("codegen.sn") + "\n", { parse: parser.parse, readImport, charset: "ascii" });
	check("段1・段2の compile の診断が 0 件", lib.diagnostics.map((d) => String(d.message).slice(0, 60)), []);
	const env = newRuntimeEnv(null, "ascii");
	for (const n of lib.nodes) evaluate(n, env);
	for (const n of compile("sh_pair : a b ? a , b\n", { parse: parser.parse, charset: "ascii" }).nodes) evaluate(n, env);
	res.timing.loadMs = Math.round(performance.now() - tLoad);
	let seq = 0;
	const call = (fn, ...vs) => {
		let node = { type: "atom", kind: "identifier", value: `<${fn}>` };
		for (const v of vs) {
			const nm = `<__sh${seq++}__>`;
			envDefine(env, nm, v);
			node = { type: "operation", name: "apply", left: node, right: { type: "atom", kind: "identifier", value: nm } };
		}
		return evaluate(node, env);
	};
	const obs = (v) => (isUnit(v) ? null : observe(v));

	// ---- 段1の身元の検査（lw_prog の最初の行）。pass4 に渡したのと同じ字面を通す ----
	check("段1の身元の検査 lw_optck が alpha/sign/option.ms を通す（pass4 に渡したのと同じ字面）", obs(call("lw_optck", OPT)), null);
	{
		const bad = OPT.replace(/^(target\s*:\s*)aarch64_qemu\s*$/m, "$1riscv64");
		check("lw_optck は target の違う身元を名指しで断る（上の検査が空振りでない）", [bad !== OPT, obs(call("lw_optck", bad))], [true, "! option target"]);
	}

	// ---- メモ：実引数すべてを鍵に、Sign の関数が出した答えを覚える ----
	const memo = { hits: 0, misses: 0, bypass: 0, clashes: [], byName: {} };
	const wrappers = new Map();
	const originals = new Map();
	// 覚えた答えと、覚えたときの綴り（走り終わってから、誰もその場で書き換えていないかを見る）
	const stored = [];
	const bindKey = (name) => [...env.bindings.keys()].find((k) => k === `<${name}>` || k === name);
	const brief = (xs) => xs.map((a) => (typeof a === "string" ? JSON.stringify(a.length > 24 ? a.slice(0, 24) + "…" : a) : Array.isArray(a) ? `[${a.length} 要素]` : String(JSON.stringify(encValue(a))))).join(", ");
	for (const name of MEMOIZED) {
		const k = bindKey(name);
		if (!k) throw new Error(`束縛が無い: ${name}`);
		const orig = env.bindings.get(k);
		originals.set(name, { k, orig });
		envDefine(env, `<__orig_${name}>`, orig);
		const table = memoTable();
		const st = (memo.byName[name] = { hits: 0, misses: 0, bypass: 0 });
		const wrapper = (...args) => {
			const g = table.get(name, args);
			if (g.hit) {
				memo.hits++;
				st.hits++;
				return g.r;
			}
			// 鍵が同じで実引数が違う：覚えた答えは返さず、名指しして元の関数を呼ぶ
			if (g.clash) memo.clashes.push(`覚えた ${g.by}(${brief(g.clash)}) / 今 ${name}(${brief(args)})`);
			// 元の関数を、自分の名前も元へ戻して呼ぶ（中の再帰は素の Sign のまま、末尾呼び出しも潰れない）
			env.bindings.set(k, orig);
			let r;
			try {
				r = call(`__orig_${name}`, ...args);
			} finally {
				env.bindings.set(k, wrapper);
			}
			if (g.node) {
				memo.misses++;
				st.misses++;
				table.set(g.node, name, args, r);
				const e = encValue(r);
				stored.push({ name, r, snap: e === null ? null : JSON.stringify(e) });
			} else if (!g.clash) {
				memo.bypass++;
				st.bypass++;
			}
			return r;
		};
		wrappers.set(name, wrapper);
	}
	const memoOn = () => {
		for (const [name, { k }] of originals) env.bindings.set(k, wrappers.get(name));
	};
	const memoOff = () => {
		for (const { k, orig } of originals.values()) env.bindings.set(k, orig);
	};
	const memoCalls = () => MEMOIZED.map((x) => memo.byName[x].hits + memo.byName[x].misses + memo.byName[x].bypass);
	memoOn();

	const P = call("sh_pair", FLAT, ist);

	// ---- 文を Sign の歩き（lw_next）で辿る。切れ目は JS の束と同じはず ----
	const tWalk = performance.now();
	const offsets = [];
	for (let i = 0; i < FLAT.length; ) {
		offsets.push(i);
		i = call("lw_next", FLAT, i);
		if (typeof i !== "number") throw new Error("lw_next が数を返さない");
	}
	{
		const js = [];
		let o = 0;
		for (const s of stmts) {
			js.push(o);
			o += s.text.length + 1;
		}
		check("Sign の文の歩き（lw_next）が束の文の切れ目と同じ", JSON.stringify(offsets) === JSON.stringify(js) ? "同じ" : { sign: offsets.length, js: js.length, first: offsets.findIndex((x, i) => x !== js[i]) }, "同じ");
	}

	const reachFns = [...G.reach].filter((x) => G.isFn(x));
	const only = cfg.only ? new Set(cfg.only) : null;
	const seenDef = new Set();
	const wordsOf = new Map();
	let idx = 0;
	for (const i of offsets) {
		const stFrom = stmts[idx++]?.from;
		const tsv = call("lw_stoks", FLAT, i);
		const ts = obs(tsv) || [];
		const first = Array.isArray(ts) ? ts[0] : ts;
		const nm = typeof first === "string" ? first.replace(/^#+/, "") : null;
		const isDef = Array.isArray(ts) && ts[1] === ":";
		if (!isDef || seenDef.has(nm)) continue;
		seenDef.add(nm);
		if (!G.reach.has(nm) || !G.isFn(nm)) continue;
		if (only && !only.has(nm)) continue;
		const from = sideOf(nm, stFrom);
		const t0 = performance.now();
		const before = memoCalls();
		const rv = call("lw_fst", tsv, P, FLAT, i);
		const after = memoCalls();
		const words = obs(rv);
		const wl = words == null ? [] : Array.isArray(words) ? words : [words];
		wordsOf.set(nm, { i, words: JSON.stringify(wl) });
		// この関数を下ろす間に呼ばれた、メモした関数（見本の選び方に使う）
		const memoUse = MEMOIZED.filter((x, k) => after[k] > before[k]);
		const r = { name: nm, from, p4: blocked.has(nm) ? "blocked" : "emits", lowerMs: Math.round(performance.now() - t0), memoUse };
		const bad = wl.find((w) => typeof w === "string" && w.startsWith("!"));
		if (bad) {
			r.status = "refused";
			r.reason = "! " + bad.replace(/^!\s*/, "");
			r.stage = 1;
		} else if (wl.length === 0) r.status = "empty";
		else {
			const t1 = performance.now();
			const asm = String(obs(call("g_run", [...wl, "G", "D"])) ?? "");
			r.codegenMs = Math.round(performance.now() - t1);
			// 段2の出力も関数ごとの結果として残す（メモ無しの見本と突き合わせる）
			wordsOf.get(nm).asm = asm;
			// 正規化の釘（Sign の出力は注釈も空白の連なりも持たない——生の行・normalizeAsm・参照が同じ）
			r.pin = pinOf(asm, true);
			const errs = asm.split("\n").filter((l) => l.trim().startsWith(".err"));
			if (errs.length) {
				r.status = "refused";
				r.reason = "! " + (errs[0].trim().replace(/^\.err\s*/, "").replace(/^!\s*/, "") || "(.err)");
				r.stage = 2;
			} else {
				const slines = normalizeAsm(asm);
				const ssecs = sectionsOf(slines);
				const ssec = ssecs.get(nm) || [];
				const psec = p4secs.get(nm);
				// 出力の行の勘定：比べるこの関数の区画・`_.main`（範囲の外）・その2つが引く像・節の指示だけ
				r.unaccounted = unaccountedOf(slines, new Set([nm, "_.main"]));
				r.signInsn = insnCount(ssec);
				if (!psec) r.status = "sign-only";
				else if (blocked.has(nm)) r.status = "unrefused";
				else {
					r.p4Insn = insnCount(psec);
					const d = judge(asm, nm, P4);
					if (d) {
						r.status = "differs";
						r.diff = d;
					} else if (r.signInsn === 0) {
						r.status = "differs";
						r.diff = { at: 0, p4: "(命令が無い区画)", sign: "(命令が無い区画)" };
					} else {
						r.status = "same";
						// 対照：生の行へ傷を1本入れた出力は、どの位置のどの傷でも「違う」と言われなければならない。
						// 比べるのは判定と同じ judge（傷は正規化の前に入るので、正規化の緩みも同じ道で問う）
						r.controls = {};
						r.controlsMissed = [];
						const tc = performance.now();
						for (const m of mutantsOf(viewOf(asm), nm)) {
							const c = (r.controls[m.kind] ??= [0, 0]);
							c[0]++;
							if (judge(m.lines.join("\n"), nm, P4) !== null) c[1]++;
							else r.controlsMissed.push(`${m.kind}@${m.at}`);
						}
						res.timing.controlsMs = (res.timing.controlsMs ?? 0) + (performance.now() - tc);
					}
				}
			}
		}
		res.functions.push(r);
		log(`     ${(r.status === "refused" ? r.reason : r.status).padEnd(44)} ${nm} [${from}] ${r.lowerMs}ms${r.codegenMs !== undefined ? "+" + r.codegenMs + "ms" : ""}`);
	}
	res.timing.walkMs = Math.round(performance.now() - tWalk);

	// ---- 束ねて1回：same の関数の語を歩いた順につなぎ（lw_prog の lw_fns と同じ並び）、g_run に1回だけ通す ----
	// 関数を1本ずつ出すと、関数をまたぐ状態（文字列の番号・ラベルの番号）が一度も動かない。束ねた出力の
	// 区画も pass4 と比べる（`_.main` の中身と lw_prog のつなぎは見ない——codegen_sn が受け持つ）
	{
		const sameRows = res.functions.filter((r) => r.status === "same");
		const all = sameRows.flatMap((r) => JSON.parse(wordsOf.get(r.name).words));
		const t2 = performance.now();
		const asmAll = String(obs(call("g_run", [...all, "G", "D"])) ?? "");
		const lines = normalizeAsm(asmAll);
		const secs = sectionsOf(lines);
		const data = dataTable(lines);
		const w = { functions: sameRows.length, words: all.length, errs: lines.filter((l) => l.startsWith(".err")), unaccounted: unaccountedOf(lines, new Set([...sameRows.map((r) => r.name), "_.main"])).slice(0, 8), pin: pinOf(asmAll, true), bad: [] };
		for (const r of sameRows) {
			if (!secs.get(r.name)) {
				w.bad.push(`${r.name}: 区画が無い`);
				continue;
			}
			const d = judge(asmAll, r.name, P4);
			if (d) w.bad.push(`${r.name} @${d.at} pass4「${d.p4}」/ sign「${d.sign}」`);
		}
		// 同じラベルを2度定義した束はアセンブラが断る——番号を関数ごとに振り直していないか
		const defsAll = lines.filter(isLabelLine).map((l) => l.slice(0, -1));
		w.dupDefs = [...new Set(defsAll.filter((x, i) => defsAll.indexOf(x) !== i))];
		// 束の像の身元：関数をまたいでも、Sign の像と pass4 の像が1対1
		const sameNames = sameRows.map((r) => r.name);
		w.identity = identityClashes(sameNames, P4, lines).slice(0, 8);
		// 対照：2つ以上の関数が引く像を、1つの関数の分だけ同じ中身の写しへ割る。関数ごとの judge は同じと言う形で、
		// 身元の突き合わせが名指ししなければならない
		{
			const di = dataIndex(lines);
			const si = sectionIndex(lines);
			const users = new Map();
			for (const nm of sameNames) if (secs.get(nm)) for (const k of dataRefsOf(secs.get(nm), data)) users.set(k, [...(users.get(k) ?? []), nm]);
			const tried = [];
			const missed = [];
			let judgedSame = 0;
			for (const [key, fns] of users) {
				if (key.startsWith('"')) continue;
				for (const fn of fns.slice(1)) {
					const { fresh, copy, after } = imageCopyOf(lines, di, key);
					const mine = new Set(si.get(fn));
					const ls = lines.map((l, i) => (mine.has(i) ? mapOperandNames(l, (t) => (t === key ? fresh : t)) : l));
					ls.splice(after, 0, ...copy);
					tried.push(`${key}→${fn}`);
					if (judge(ls.join("\n"), fn, P4) === null) judgedSame++;
					if (identityClashes(sameNames, P4, ls).length === 0) missed.push(`${key}→${fn}`);
				}
			}
			w.identitySplit = { tried: tried.length, judgedSame, missed };
		}
		// 対照：束の中の違う文字列の像を回す（.Lstr の番号の取り違えを作る）と、引いている関数はどれも「違う」
		const refsOf = (r) => (secs.get(r.name) ? dataRefsOf(secs.get(r.name), data) : []);
		const strKeys = [...new Set(sameRows.flatMap(refsOf))].filter((k) => /^\.Lstr\d+$/.test(k));
		const imgOf = (k) => JSON.stringify(data.get(k));
		const distinct = strKeys.filter((k, i) => strKeys.findIndex((j) => imgOf(j) === imgOf(k)) === i);
		w.strings = distinct.length;
		if (distinct.length >= 2) {
			const rotated = new Map(data);
			distinct.forEach((k, i) => rotated.set(k, data.get(distinct[(i + 1) % distinct.length])));
			const users = sameRows.filter((r) => refsOf(r).some((k) => distinct.includes(k)));
			w.rotation = { users: users.map((r) => r.name), missed: users.filter((r) => firstDiff(p4secs.get(r.name), p4data, secs.get(r.name), rotated) === null).map((r) => r.name) };
		}
		w.ms = Math.round(performance.now() - t2);
		res.whole = w;
		log(`     束ねて1回：same ${w.functions} 本・${w.words} 語・違う文字列 ${w.strings}（${w.ms}ms）`);
	}
	res.reachFns = reachFns;
	res.reachOrder = res.functions.map((r) => r.name);
	res.calls = Object.fromEntries(reachFns.map((f) => [f, [...G.calls.get(f)].filter((g) => G.reach.has(g))]));
	res.memo = memo;

	// ---- メモの透明さ：見本をメモ無しで下ろし直し、語の列が同じか ----
	const n = cfg.memoCheck;
	if (n > 0 || cfg.memoNames) {
		let pick;
		if (cfg.memoNames) pick = cfg.memoNames.filter((x) => wordsOf.has(x));
		else {
			// 見本：束で最初に一致した関数（段1＋段2を通しで）、lower.sn の最初の関数、それでもまだ見本の中で
			// 呼ばれていないメモした関数を呼ぶ最初の関数。メモ無しの重さは文の位置でほぼ決まる（先勝ちの
			// 確かめ lw_dup が前の文を全部読み直す）ので、どれも束の前の方から採る
			pick = [];
			const add = (r) => r && !pick.includes(r.name) && pick.push(r.name);
			add(res.functions.find((r) => r.status === "same"));
			add(res.functions.find((r) => r.from === "lower.sn"));
			const used = () => new Set(pick.flatMap((nm) => res.functions.find((r) => r.name === nm).memoUse));
			for (;;) {
				const u = used();
				const missing = MEMOIZED.filter((x) => !u.has(x));
				const r = missing.length ? res.functions.find((r) => !pick.includes(r.name) && r.memoUse.some((x) => missing.includes(x))) : null;
				if (!r) break;
				add(r);
			}
			// 数を増やしたら、一致したものと断ったものから交互に
			const same = res.functions.filter((r) => r.status === "same");
			const refd = res.functions.filter((r) => r.status === "refused");
			for (let k = 0; pick.length < n && (k < same.length || k < refd.length); k++) {
				if (k < same.length && pick.length < n) add(same[k]);
				if (k < refd.length && pick.length < n) add(refd[k]);
			}
			// メモ付きの回で見本が呼んだメモした関数。メモ無しの回はここに載る呼び出しをすべて（当たりの中の
			// 呼び出しも）素の Sign で辿るので、ここに無い名前は見本がメモを素通りしている
			const u = used();
			res.memoCoverage = { uncovered: MEMOIZED.filter((x) => !u.has(x)) };
		}
		memoOff();
		const tM = performance.now();
		res.memoCheck = [];
		for (const nm of pick) {
			const { i, words, asm } = wordsOf.get(nm);
			const t0 = performance.now();
			const tsv = call("lw_stoks", FLAT, i);
			const wl = obs(call("lw_fst", tsv, P, FLAT, i));
			const wl2 = wl == null ? [] : Array.isArray(wl) ? wl : [wl];
			const w2 = JSON.stringify(wl2);
			// 関数ごとの結果は、段1の語の列と、断りが無ければそれを段2に通した命令の字面。メモ付きの回が段2を
			// 通した関数（asm がある）はメモ無しの語の列も段2に通し、字面ごと突き合わせる
			const asm2 = asm === undefined ? undefined : String(obs(call("g_run", [...wl2, "G", "D"])) ?? "");
			const r = res.functions.find((x) => x.name === nm);
			const same = w2 === words && asm2 === asm;
			res.memoCheck.push({ name: nm, from: r.from, same, stage2: asm !== undefined, ms: Math.round(performance.now() - t0) });
			log(`     メモ無し ${nm} [${r.from}]（${r.memoUse.join(" ")}）: ${w2 !== words ? "語の列が違う" : asm2 !== asm ? "命令が違う" : asm === undefined ? "語の列が同じ（段1で断る）" : "語の列も命令も同じ"}（${Math.round(performance.now() - t0)}ms）`);
		}
		res.timing.memoCheckMs = Math.round(performance.now() - tM);
		memoOn();
	}
	// 覚えた答えは同じ値を何度も配るので、配った先でその場で書き換えられたら、後の呼び出しが壊れた値を
	// 受け取る。走り終わってから綴り直し、覚えたときと同じかを見る（綴れない値は数だけ出す）
	{
		const changed = [];
		for (const s of stored) {
			if (s.snap === null) continue;
			const e = encValue(s.r);
			if (e === null || JSON.stringify(e) !== s.snap) changed.push(s.name);
		}
		memo.unverifiable = stored.filter((s) => s.snap === null).length;
		check("覚えた答えが走り終わっても書き換えられていない（配った値を誰もその場で壊していない）", changed, []);
		// 当たりは毎回、覚えたときの実引数と値として同じかを見ている。食い違いは鍵の取りこぼし（別の実引数に
		// 覚えた答えを配りかけた）
		check(`メモの当たり（${memo.hits} 回）はどれも、覚えたときと同じ実引数で引かれた（鍵が実引数を取りこぼしていない）`, memo.clashes.length ? [`${memo.clashes.length} 件`, ...memo.clashes.slice(0, 4)] : [], []);
		memo.clashes = memo.clashes.length;
	}
	res.timing.totalMs = Math.round(performance.now() - tStart);
	parentPort.postMessage({ done: res });
}

// ---------------------------------------------------------------------------------------------
// 親：ワーカーの結果を golden と突き合わせる
// ---------------------------------------------------------------------------------------------
const SILENT = new Set(["differs", "unrefused", "sign-only", "empty"]);
const statusOf = (r) => (r.status === "refused" ? r.reason : r.status);

/** 断りの理由の類（数える用）。段1・段2の断りの綴りから拾った語なら類、それ以外は葉の語そのもの（leaf）。 */
function classesFromSource() {
	const src = readImport("lower.sn") + "\n" + readImport("codegen.sn");
	const out = new Set();
	for (const m of src.matchAll(/`! ([a-z][a-z-]*)/g)) out.add(m[1]);
	for (const m of src.matchAll(/lw_no \(?`([a-z][a-z-]*)/g)) out.add(m[1]);
	return out;
}
function classOf(reason, known) {
	const w = reason.replace(/^!\s*/, "").split(" ");
	if (!known.has(w[0])) return "leaf";
	if (["op", "width", "container-op", "char-alu", "unit-alu"].includes(w[0]) && w[1] && known.has(w[0])) {
		if (w[0] !== "width" || w[1] === "arm" || w[1] === "cond") return w[0] + " " + w[1];
	}
	return w[0];
}

/** 閉じた集合：その関数から呼び出しを推移的に辿って届く関数（自分を含む）が、すべて same。 */
function closedSet(statusByName, calls) {
	return Object.keys(statusByName).filter((f) => {
		const seen = new Set([f]);
		const q = [f];
		while (q.length) {
			const x = q.pop();
			if (statusByName[x] !== "same") return false;
			for (const y of calls[x] || []) if (!seen.has(y)) seen.add(y), q.push(y);
		}
		return true;
	});
}

function summarize(res) {
	const known = classesFromSource();
	const byName = Object.fromEntries(res.functions.map((r) => [r.name, statusOf(r)]));
	const closed = closedSet(byName, res.calls);
	const ranges = { emits: res.functions.filter((r) => r.p4 === "emits"), blocks: res.functions.filter((r) => r.p4 === "blocked") };
	const cnt = (rows, st) => rows.filter((r) => r.status === st).length;
	const counts = {
		reachable: res.functions.length,
		"pass4-emits": {
			functions: ranges.emits.length,
			same: cnt(ranges.emits, "same"),
			refused: cnt(ranges.emits, "refused"),
			closed: closed.filter((f) => res.functions.find((r) => r.name === f).p4 === "emits").length,
		},
		"pass4-blocks": { functions: ranges.blocks.length, same: cnt(ranges.blocks, "same"), refused: cnt(ranges.blocks, "refused") },
		same: cnt(res.functions, "same"),
		refused: cnt(res.functions, "refused"),
		closed: closed.length,
	};
	for (const s of SILENT) counts[s] = cnt(res.functions, s);
	const reasons = {};
	for (const r of res.functions.filter((r) => r.status === "refused")) {
		const k = classOf(r.reason, known);
		reasons[k] ??= { "pass4-emits": 0, "pass4-blocks": 0 };
		reasons[k][r.p4 === "emits" ? "pass4-emits" : "pass4-blocks"]++;
	}
	const sortedReasons = Object.fromEntries(Object.entries(reasons).sort((a, b) => b[1]["pass4-emits"] + b[1]["pass4-blocks"] - (a[1]["pass4-emits"] + a[1]["pass4-blocks"]) || (a[0] < b[0] ? -1 : 1)));
	return {
		note: "test/selfhost_sn.test.js が書く（--update）。関数ごとの状態は same か「! 理由」。数の範囲は pass4 が出せる関数（pass4-emits）と出せない関数（pass4-blocks）で分ける。",
		driver: DRIVER,
		types: "pass3 .ist (generateSignType scope ist, in memory)",
		counts,
		reasons: sortedReasons,
		closed,
		pass4Blocked: res.functions.filter((r) => r.p4 === "blocked").map((r) => r.name),
		functions: byName,
	};
}

/** golden の状態と食い違ったときの言い分。黙った誤答（SILENT）と断りを分けて書く。 */
export function mismatchNote(got, want) {
	const was = want === "same" ? "一致" : "断り";
	if (SILENT.has(got)) return `（${was}が ${got} に化けた——黙った誤答）`;
	if (want === "same") return "（一致が断りに化けた——わざと断りへ倒したのでなければ、直すのは本体の側）";
	if (got === "same") return "（断りが一致になった——直したなら --update で golden を書き直し、その片と同じ commit に入れる）";
	return "（断りの理由が変わった）";
}

/** 比べる側の見本（合成）。ワーカーを待たずに、区画の切り方・像の引き方・メモの鍵を確かめる。 */
export function syntheticChecks(check) {
	// 区画の切り方。関数の直後に節が来たら、節の中身（文字列の字面）を関数へ混ぜない
	// ——今の出力はどちらも関数の後に次のラベルが来るので、実物では見えない形
	{
		const L = ["f:", "mov x0, #1", "cbz x0, .Larm1", "ret", ".p2align 4, 0", ".Larm1:", "mov x0, #2", "nop", "ret", ".section .rodata", ".Lstr0:", '.ascii "ab"', ".text", "g:", "ret"];
		const S = sectionsOf(L);
		check(
			"区画は節の指示で閉じ、間の行は整列も nop も読み飛ばさない（合成の見本：関数の直後に .rodata、ret の後のローカルラベルは同じ区画）",
			[[...S], unaccountedOf(L, null)],
			[
				[
					["f", ["f:", "mov x0, #1", "cbz x0, .Larm1", "ret", ".p2align 4, 0", ".Larm1:", "mov x0, #2", "nop", "ret"]],
					["g", ["g:", "ret"]],
				],
				[],
			]
		);
	}
	// 出力の行の勘定（合成の見本）。f が引く像（名前の付いた k も）と `_.main` と節の指示だけなら勘定が合い、関数の
	// 後ろに足された名前付きのコード・節の後の裸の命令・誰も引かない像は、どれも名指しされる
	{
		const B = ["f:", "adrp x9, .Lstr0", "adrp x10, k", "ret", ".global _.main", "_.main:", "ret", ".section .rodata", ".balign 1", ".Lstr0:", '.ascii "ab"', ".balign 8", "k:", ".quad 3"];
		const allowed = new Set(["f", "_.main"]);
		const tail = [...B.slice(0, 4), "tail_0:", "mov x0, #7", "ret", ...B.slice(4)];
		const unref = B.map((l) => (l === "adrp x10, k" ? "nop" : l));
		check(
			"出力の行の勘定（合成の見本）：余分な区画・節の後の裸の命令・引かれない像を名指しする",
			[unaccountedOf(B, allowed), unaccountedOf(tail, allowed), unaccountedOf([...B, ".section .rodata", "mov x1, #3"], allowed), unaccountedOf(unref, allowed), unaccountedOf(tail, null)],
			[[], ["@4 tail_0:", "@5 mov x0, #7", "@6 ret"], ["@15 mov x1, #3"], ["@11 .balign 8", "@12 k:", "@13 .quad 3"], []]
		);
	}
	// 像の引き方。pass4 の束は番号が進んでいて（.Lanon7・.Lstr9）、Sign の1関数は 0 から振る
	const fn = (anon, done, str) => ["f:", `adrp x9, ${anon}`, `add x9, x9, :lo12:${anon}`, `adrp x10, ${str}`, `b ${done}`, `${done}:`, "ret"];
	const ro = (anon, str, img, al = ".balign 8", s = '.ascii "ab"', nested = null) => [".section .rodata", ".balign 1", `${str}:`, s, al, `${anon}:`, ...img, ...(nested ? [".balign 8", `${nested[0]}:`, `.quad ${nested[1]}`] : [])];
	// 判定と同じ道（judge）で：左が pass4 の側、右が Sign の側
	const same = (a, b) => judge(b.join("\n"), "f", pass4Side(a.join("\n"))) === null;
	const P = [...fn(".Lanon7", ".Ldone3", ".Lstr9"), ...ro(".Lanon7", ".Lstr9", [".quad 0x8000000000000000", ".quad 0"])];
	check(
		"像は番号ではなく中身で比べる（合成の見本：整列・データの行・文字列・入れ子の参照）",
		[
			same(P, [...fn(".Lanon0", ".Ldone0", ".Lstr0"), ...ro(".Lanon0", ".Lstr0", [".quad 0x8000000000000000", ".quad 0"])]),
			same(P, [...fn(".Lanon0", ".Ldone0", ".Lstr0"), ...ro(".Lanon0", ".Lstr0", [".quad 0x8000000000000001", ".quad 0"])]),
			same(P, [...fn(".Lanon0", ".Ldone0", ".Lstr0"), ...ro(".Lanon0", ".Lstr0", [".quad 0x8000000000000000", ".quad 1"])]),
			same(P, [...fn(".Lanon0", ".Ldone0", ".Lstr0"), ...ro(".Lanon0", ".Lstr0", [".quad 0x8000000000000000"])]),
			same(P, [...fn(".Lanon0", ".Ldone0", ".Lstr0"), ...ro(".Lanon0", ".Lstr0", [".quad 0x8000000000000000", ".quad 0"], ".balign 4")]),
			same(P, [...fn(".Lanon0", ".Ldone0", ".Lstr0"), ...ro(".Lanon0", ".Lstr0", [".quad 0x8000000000000000", ".quad 0"], ".balign 8", '.ascii "ac"')]),
			same(P, [...fn(".Lanon0", ".Ldone0", ".Lstr0"), ...ro(".Lanon0", ".Lstr0", [".quad 0x8000000000000000", ".quad 0"], ".balign 8", '.ascii "abc"')]),
			// 像の中の参照も像へ：.Lanon の中身が別のラベルを指す形
			same([...fn(".Lanon7", ".Ldone3", ".Lstr9"), ...ro(".Lanon7", ".Lstr9", [".quad .Lanon8"], ".balign 8", '.ascii "ab"', [".Lanon8", "5"])], [...fn(".Lanon0", ".Ldone0", ".Lstr0"), ...ro(".Lanon0", ".Lstr0", [".quad .Lanon1"], ".balign 8", '.ascii "ab"', [".Lanon1", "5"])]),
			same([...fn(".Lanon7", ".Ldone3", ".Lstr9"), ...ro(".Lanon7", ".Lstr9", [".quad .Lanon8"], ".balign 8", '.ascii "ab"', [".Lanon8", "5"])], [...fn(".Lanon0", ".Ldone0", ".Lstr0"), ...ro(".Lanon0", ".Lstr0", [".quad .Lanon1"], ".balign 8", '.ascii "ab"', [".Lanon1", "6"])]),
			// 片側にしか像が無い（Sign が置き場を書き忘れた）
			same(P, fn(".Lanon0", ".Ldone0", ".Lstr0")),
			// 区画の中にも像にも無いラベル（ほかの関数の中など）は番号を振り直さない——番号が違えば違う
			same(["f:", "b .Lext3", "ret"], ["f:", "b .Lext0", "ret"]),
			same(["f:", "b .Lext3", "ret"], ["f:", "b .Lext3", "ret"]),
		],
		[true, false, false, false, false, false, false, true, false, false, false, true]
	);
	// 置かれた節：関数は関数ラベルに、像はラベルに効いている節を替える指示で比べる。記号の指示（`.global`）は節を替えない
	{
		const IMG = [".quad 0x8000000000000000", ".quad 0"];
		const PH = [".text", ...fn(".Lanon7", ".Ldone3", ".Lstr9"), ...ro(".Lanon7", ".Lstr9", IMG)];
		const S = [".text", ...fn(".Lanon0", ".Ldone0", ".Lstr0"), ...ro(".Lanon0", ".Lstr0", IMG)];
		const at = (xs, i, l) => [...xs.slice(0, i), l, ...xs.slice(i)];
		check(
			"関数と像の置かれた節も比べる（合成の見本：同じ節・像の節の指示を .data へ・1つの像の前に .data・関数を .data へ・節の無い関数・.global は節を替えない）",
			[
				same(PH, S),
				same(PH, S.map((l) => (l === ".section .rodata" ? ".data" : l))),
				same(PH, at(S, S.indexOf(".balign 8"), ".data")),
				same(PH, [".data", ...S.slice(1)]),
				same(PH, S.slice(1)),
				same(PH, at(S, 1, ".global f")),
			],
			[true, false, false, false, false, true]
		);
	}
	// 像の身元：中身が同じ像も別の物。組の食い違い・2つを1つに潰す・1つを2つに割るは違い、番号とファイルの中の
	// 並びが違うだけなら同じ
	{
		const pair = (r, x) => [`adrp ${r}, ${x}`, `add ${r}, ${r}, :lo12:${x}`];
		const img = (x, v) => [".balign 8", `${x}:`, `.quad ${v}`];
		const f2 = (a, b, c, d) => ["f:", ...pair("x9", a).slice(0, 1), `add x9, x9, :lo12:${b}`, ...pair("x10", c).slice(0, 1), `add x10, x10, :lo12:${d}`, "ret", ".section .rodata"];
		const P1 = [...f2(".Lanon7", ".Lanon7", ".Lanon7", ".Lanon7"), ...img(".Lanon7", 3)];
		const P2 = [...f2(".Lanon7", ".Lanon7", ".Lanon8", ".Lanon8"), ...img(".Lanon7", 3), ...img(".Lanon8", 3)];
		check(
			"像の身元（合成の見本：同じ形・組の食い違い（adrp .Lanon0 と :lo12:.Lanon1）・2つを1つに潰す・1つを2つに割る・番号とファイルの並びだけが違う）",
			[
				same(P1, [...f2(".Lanon0", ".Lanon0", ".Lanon0", ".Lanon0"), ...img(".Lanon0", 3)]),
				same(P1, [...f2(".Lanon0", ".Lanon1", ".Lanon0", ".Lanon0"), ...img(".Lanon0", 3), ...img(".Lanon1", 3)]),
				same(P2, [...f2(".Lanon0", ".Lanon0", ".Lanon0", ".Lanon0"), ...img(".Lanon0", 3)]),
				same(P1, [...f2(".Lanon0", ".Lanon0", ".Lanon1", ".Lanon1"), ...img(".Lanon0", 3), ...img(".Lanon1", 3)]),
				same(P2, [...f2(".Lanon0", ".Lanon0", ".Lanon1", ".Lanon1"), ...img(".Lanon1", 3), ...img(".Lanon0", 3)]),
				same(P2, [...f2(".Lanon0", ".Lanon0", ".Lanon1", ".Lanon0"), ...img(".Lanon0", 3), ...img(".Lanon1", 3)]),
			],
			[true, false, false, false, true, false]
		);
		// 束の身元：関数ごとの judge はどれも同じと言うが、関数をまたいで割る・潰すと identityClashes が名指しする
		const g2 = (a, name) => [`${name}:`, ...pair("x9", a), "ret"];
		const B = (x, y, imgs) => [".text", ...g2(x, "f"), ...g2(y, "g"), ".section .rodata", ...imgs.flatMap(([k, v]) => img(k, v))];
		const PB1 = pass4Side(B(".Lanon7", ".Lanon7", [[".Lanon7", 3]]).join("\n"));
		const PB2 = pass4Side(B(".Lanon7", ".Lanon8", [[".Lanon7", 3], [".Lanon8", 3]]).join("\n"));
		const both = (p4, ls) => [judge(ls.join("\n"), "f", p4), judge(ls.join("\n"), "g", p4), identityClashes(["f", "g"], p4, ls).length > 0];
		check(
			"束の像の身元（合成の見本：同じ形は名指ししない・関数をまたいで1つを2つに割る・2つを1つに潰す——どれも関数ごとの judge は同じと言う）",
			[both(PB1, B(".Lanon0", ".Lanon0", [[".Lanon0", 3]])), both(PB1, B(".Lanon0", ".Lanon1", [[".Lanon0", 3], [".Lanon1", 3]])), both(PB2, B(".Lanon0", ".Lanon0", [[".Lanon0", 3]])), both(PB2, B(".Lanon1", ".Lanon0", [[".Lanon0", 3], [".Lanon1", 3]]))],
			[
				[null, null, false],
				[null, null, true],
				[null, null, true],
				[null, null, false],
			]
		);
	}
	// 名前の付いた像も同じ（`adrp x9, k` の k の中身）。区画の中の名前は像へ、命令の綴りは触らない
	check(
		"名前の付いた像も中身で比べる（合成の見本）",
		[
			same(["f:", "adrp x9, k", "ret", ".section .rodata", ".balign 8", "k:", ".quad 3"], ["f:", "adrp x9, k", "ret", ".section .rodata", ".balign 8", "k:", ".quad 3"]),
			same(["f:", "adrp x9, k", "ret", ".section .rodata", ".balign 8", "k:", ".quad 3"], ["f:", "adrp x9, k", "ret", ".section .rodata", ".balign 8", "k:", ".quad 4"]),
			same(["f:", "adrp x9, k", "ret", ".section .rodata", ".balign 8", "k:", ".quad 3"], ["f:", "adrp x9, k", "ret"]),
		],
		[true, false, false]
	);
	// 正規化の釘（合成の見本）：落とすのは注釈・字下げ・空行・引用符の外の空白の連なりだけ。引用符の中の `//` と
	// 空白の連なり、`\"` は写す。`!`・`-`・`w` のレジスタ・字の大小は残る（多を一に潰す正規化はここで落ちる）
	{
		const T = ['\t.ascii "a  //  b"    // 注釈', "\tmov   x0,\t#1   // c", "// 注釈だけの行", "   ", '\t.ascii "q\\"  r"', "\tstp x29, x30, [sp, #-32]!  // 前置き", "\tldrb w14, [x9]", "\tbl g_fK", "Lab:"].join("\n");
		const want = ['.ascii "a  //  b"', "mov x0, #1", '.ascii "q\\"  r"', "stp x29, x30, [sp, #-32]!", "ldrb w14, [x9]", "bl g_fK", "Lab:"];
		check("正規化の釘の見本（合成）：normalizeAsm も参照も、注釈・字下げ・空行・引用符の外の空白の連なりだけを落とす", [normalizeAsm(T), plainNormalize(T), pinOf(T, false)], [want, want, null]);
	}
	// 対照そのもの（合成の見本）：どの類の傷も1本以上当たり、当たった傷はどれも judge で「違う」と言われる。
	// 実物の same が少ない絞った回（--only）でも、比べ方と正規化の緩みはここで落ちる
	{
		const F = [
			".text",
			"f:",
			"stp x29, x30, [sp, #-32]!",
			"mov x29, sp",
			".Lloop0:",
			"str x0, [x29, #16]",
			"ldr x9, [x29, #16]",
			"movz x12, #0x8000, lsl #48",
			"cmp x9, x12",
			"b.eq .Lunit1",
			"cmp x9, #0",
			"b.ge .Larm5",
			"adrp x13, .Lanon2",
			"add x13, x13, :lo12:.Lanon2",
			"csel x9, x9, x13, lo",
			"ldrb w14, [x9]",
			"adrp x10, .Lstr3",
			"add x10, x10, :lo12:.Lstr3",
			"adrp x11, .Lstr7",
			"add x11, x11, :lo12:.Lstr7",
			"bl g_fK",
			"b .Larm6",
			".Larm5:",
			"subs x9, x9, x10",
			".Larm6:",
			"csel x9, x9, xzr, pl",
			"b .Ldone4",
			".Lunit1:",
			"movz x0, #0x8000, lsl #48",
			".Ldone4:",
			"ldp x29, x30, [sp], #32",
			"ret",
			".section .rodata",
			".balign 1",
			".Lstr3:",
			'.ascii "a//b"',
			".balign 1",
			".Lstr7:",
			".byte 97, 34, 98",
			".balign 8",
			".Lanon2:",
			".quad 0x8000000000000000",
			".quad 0",
		];
		// pass4 の側は pass4 の姿（字下げと行末の注釈）、Sign の側は Sign の姿（字下げだけ）
		const PF = F.map((l) => (isLabelLine(l) ? l : `\t${l}    // 注釈`)).join("\n");
		const SF = F.map((l) => (isLabelLine(l) ? l : `\t${l}`)).join("\n");
		const P4F = pass4Side(PF);
		const ms = mutantsOf(viewOf(SF), "f");
		check(
			"対照の見本（合成）：傷の無い出力は同じと言われ、両側とも正規化の釘を満たし、どの類の傷も1本以上当たる",
			[judge(SF, "f", P4F), pinOf(PF, false), pinOf(SF, true), CONTROL_KINDS.filter((k) => !ms.some((m) => m.kind === k)), [...new Set(ms.map((m) => m.kind))].filter((k) => !CONTROL_KINDS.includes(k))],
			[null, null, null, [], []]
		);
		const missed = ms.filter((m) => judge(m.lines.join("\n"), "f", P4F) === null).map((m) => `${m.kind}@${m.at}`);
		check(`対照の見本（合成）：${ms.length} 本の傷がどれも「違う」と言われる（比べ方と正規化の緩みは、どの回でもここで落ちる）`, missed, []);
	}
	// メモの鍵。isUnit が真になる4つ（UNIT・undefined・[]・""）も、入れ子の中でも、数と文字列も混ぜない
	const vals = [UNIT, undefined, [], "", [[]], [UNIT], [undefined], [""], [[], []], [[UNIT]], 0, -0, "0", 1, "1", 1n, [1], ["1"], [0], [-0], "a", ["a"], [["a"]], ["a", "b"], ["a,b"], [["a"], "b"], NaN, Infinity];
	const keys = vals.map((v) => JSON.stringify(keyPart(v)));
	check("メモの鍵は種類を混ぜない（__・undefined・[]・\"\"・入れ子・数と文字列・-0 と 0）", keys.filter((k, i) => keys.indexOf(k) !== i || k === "null"), []);
	check("メモの鍵は同じ中身の別の並びを同じに引き、鍵にできない値は null", [JSON.stringify(keyPart([1, ["a", UNIT]])) === JSON.stringify(keyPart([1, ["a", UNIT]])), keyPart(() => 1), keyPart({ a: 1 }), keyPart([1, { a: 1 }])], [true, null, null, null]);
	// 当たりの実引数の突き合わせ（sameValue）も同じ値の種類を混ぜず、中身が同じ別の並びは同じと言う
	const copyOf = (v) => (Array.isArray(v) ? v.map(copyOf) : v);
	check(
		"当たりの実引数の突き合わせ（sameValue）は、上の値どうしでは自分とだけ同じで、中身が同じ別の並びとは同じ",
		vals.flatMap((v, i) => vals.map((u, j) => [i, j, sameValue(v, u)]).filter(([a, b, s]) => s !== (a === b)).map(([a, b]) => `${a}~${b}`)).concat(vals.filter((v) => !sameValue(v, copyOf(v))).map(String)),
		[]
	);
	// メモの表（合成の見本）：覚えた実引数と同じなら当たり、鍵が違えば外れ。鍵が実引数を取りこぼす作り方（ここでは文字列を
	// 全部同じ鍵に落とす）なら、別の実引数は当たりにならず食い違いとして返る。別の関数が覚えた答えにも当たらない
	{
		const t = memoTable();
		const g0 = t.get("f", [1, "a"]);
		t.set(g0.node, "f", [1, "a"], "A");
		const lossy = memoTable((v) => (typeof v === "string" ? ["s", ""] : keyPart(v)));
		lossy.set(lossy.get("f", [1, "a"]).node, "f", [1, "a"], "A");
		const g1 = lossy.get("f", [1, "b"]);
		const g2 = t.get("g", [1, "a"]);
		check(
			"メモの表（合成の見本）：同じ実引数は当たり・違う実引数は外れ・鍵が取りこぼすと当たりにせず食い違いを返す・別の関数の答えは返さない",
			[g0.hit, t.get("f", [1, "a"]), t.get("f", [1, "b"]).hit, t.get("f", [-0, "a"]).hit, lossy.get("f", [1, "a"]), [g1.hit, g1.node, g1.clash], [g2.hit, g2.clash]],
			[false, { hit: true, r: "A" }, false, false, { hit: true, r: "A" }, [false, null, [1, "a"]], [false, [1, "a"]]]
		);
	}
}

async function main() {
	const argv = process.argv.slice(2);
	const UPDATE = argv.includes("--update");
	const memoCheck = argv.includes("--memo-check") ? Number(argv[argv.indexOf("--memo-check") + 1]) : MEMO_CHECK_DEFAULT;
	const only = argv.includes("--only") ? argv[argv.indexOf("--only") + 1].split(",") : null;
	const memoNames = argv.includes("--memo-check-names") ? argv[argv.indexOf("--memo-check-names") + 1].split(",") : null;
	const t0 = Date.now();
	let passed = 0;
	let total = 0;
	const check = (note, got, want) => {
		total++;
		const ok = JSON.stringify(got) === JSON.stringify(want);
		if (ok) passed++;
		console.log(`${ok ? "OK  " : "FAIL"} ${note}`);
		if (!ok) console.log(`     got:  ${JSON.stringify(got)}\n     want: ${JSON.stringify(want)}`);
		return ok;
	};
	syntheticChecks(check);
	const res = await new Promise((resolve, reject) => {
		const w = new Worker(new URL(import.meta.url), { workerData: { selfhostSn: true, memoCheck, only, memoNames }, resourceLimits: { stackSizeMb: 256, maxOldGenerationSizeMb: 4096 } });
		let got = null;
		w.on("message", (m) => {
			if (m.log) console.log(m.log);
			if (m.done) got = m.done;
		});
		w.once("error", reject);
		w.once("exit", (code) => (got && code === 0 ? resolve(got) : reject(new Error(`ワーカーが答えを返さずに終わった（終了コード ${code}）`))));
	}).catch((e) => {
		console.log(`FAIL ワーカー: ${e.message}`);
		console.log(`\n${passed}/${total + 1} passed`);
		process.exit(1);
	});

	for (const c of res.checks) check(c.note, c.got, c.want);
	console.log(`（束：${res.bundle.statements} 文・${res.bundle.bytes} 字、${res.bundle.files.join(" ")}。pass4 の診断 ${res.p4.diagnostics}・阻む ${res.p4.blocking}）`);
	check("pass4 の阻む診断はどれも関数に帰せる", res.p4.unattributed, []);

	const lowered = new Set(res.functions.map((r) => r.name));
	// 束の歩きで見つからない関数は、どの数にも入らずに消える
	if (!only) check("駆動から届く関数（pass2 の木で辿った）をすべて下ろした", res.reachFns.filter((f) => !lowered.has(f)), []);
	// 絞った回も、頼んだ関数を下ろさずに緑にはならない（歩きが文を飛ばしたら、ここで名指しして落ちる）
	else check(`--only で頼んだ関数をすべて下ろした（${only.length} 本）`, only.filter((f) => !lowered.has(f)), []);

	// 黙った誤答の検出器
	const silent = res.functions.filter((r) => SILENT.has(r.status));
	check("differs・unrefused・sign-only・empty が 0 本（黙った誤答の検出器）", silent.map((r) => `${r.name}: ${r.status}${r.diff ? ` @${r.diff.at} pass4「${r.diff.p4}」/ sign「${r.diff.sign}」` : ""}`), []);
	{
		const counted = res.functions.filter((r) => r.unaccounted !== undefined);
		check(
			`Sign の出力（${counted.length} 本）の行はどれも、その関数の区画・\`_.main\`・その2つが引く像・節の指示のどれかに入る（余分な区画も、区画の外の命令も、引かれない像も無い）`,
			counted.filter((r) => r.unaccounted.length).map((r) => `${r.name}: ${r.unaccounted.slice(0, 3).join(" / ")}`),
			[]
		);
	}
	{
		const pinned = res.functions.filter((r) => r.pin !== undefined);
		check(`Sign の出力（${pinned.length} 本）はどれも、生の行・normalizeAsm・参照の3つが同じ（正規化の釘）`, pinned.filter((r) => r.pin !== null).map((r) => `${r.name} ${r.pin}`), []);
	}

	// 束ねて1回で出した出力
	{
		const w = res.whole;
		check(`same の関数を束ねて1回で出しても、どれも pass4 と同じ区画（${w.functions} 本・${w.words} 語）`, w.bad, []);
		check("束ねた出力に断り（.err）が無く、行はどれも same の区画・`_.main`・引かれる像・節の指示に入り、ラベルを2度定義せず、正規化の釘も満たす", [w.errs, w.unaccounted, w.dupDefs, w.pin], [[], [], [], null]);
		if (w.rotation) check(`束の違う文字列 ${w.strings} 個の像を回すと、引いている関数（${w.rotation.users.length} 本）はどれも「違う」（束の比べ方が空振りでない）`, [w.rotation.users.length > 0, w.rotation.missed], [true, []]);
		// 絞った回では文字列を引く関数が1本も無いことがある
		else if (!only) check("束ねた出力が違う文字列を2つ以上引いている（番号の取り違えが見える）", w.strings, "2 以上");
		check("束の像の身元：関数をまたいでも Sign の像と pass4 の像が1対1（1つの物を割っても、2つを1つに潰してもいない）", w.identity, []);
		const sp = w.identitySplit;
		if (sp.tried) check(`束で2つ以上の関数が引く像を、1つの関数の分だけ同じ中身の写しへ割ると（${sp.tried} 形。関数ごとの judge は ${sp.judgedSame} 形を同じと言う）、身元の突き合わせがどれも名指しする`, sp.missed, []);
		// 絞った回では像を分け合う関数が無いことがある
		else if (!only) check("束の中に2つ以上の関数が引く像がある（身元の対照が空振りでない）", sp.tried, "1 以上");
	}

	// 比べる側への対照
	{
		const same = res.functions.filter((r) => r.status === "same");
		const missed = [];
		const applied = Object.fromEntries(CONTROL_KINDS.map((k) => [k, 0]));
		let total = 0;
		for (const r of same) {
			for (const [k, [a]] of Object.entries(r.controls)) {
				applied[k] = (applied[k] ?? 0) + a;
				total += a;
			}
			for (const x of r.controlsMissed) missed.push(`${r.name}/${x}`);
			if (!r.controls.drop || !r.controls.reg) missed.push(`${r.name}/当てられない`);
		}
		console.log(`（対照：same ${same.length} 本に ${total} 本の傷——${Object.entries(applied).map(([k, v]) => `${k} ${v}`).join("・")}）`);
		check("傷を入れた区画はどれも「違う」と言われる（比べる側が緩んでいない）", missed.length ? [`${missed.length} 件`, ...missed.slice(0, 12)] : [], []);
		// 絞った回（--only）では same が少なく、ラベルや像を持たないことがある（合成の見本はどの回でも全類を見る）
		if (!only) check("対照の傷がどの類にも1本以上当たっている", CONTROL_KINDS.filter((k) => !(applied[k] > 0)), []);
	}

	if (res.memoCheck) {
		check(`メモ無しで下ろした見本 ${res.memoCheck.length} 本の関数ごとの結果（語の列と、段2まで通した ${res.memoCheck.filter((m) => m.stage2).length} 本は命令の字面）がメモ付きと同じ（${res.memoCheck.map((m) => `${m.name}[${m.from}]`).join(" ")}）`, res.memoCheck.filter((m) => !m.same).map((m) => m.name), []);
		// 見本が0本なら上の検査は空振り——頼んだ名前が下ろされていなければ名指しして落ちる
		if (memoNames) check("--memo-check-names で頼んだ関数をすべてメモ無しで下ろし直した", memoNames.filter((f) => !res.memoCheck.some((m) => m.name === f)), []);
		else check("メモ無しの見本を1本以上下ろし直した", res.memoCheck.length > 0, true);
		if (res.memoCoverage && !only) check("メモした関数がどれもメモ無しの見本の中で呼ばれた（見本がメモを素通りしていない）", res.memoCoverage.uncovered, []);
	}

	const g = summarize(res);
	const m = res.memo;
	console.log(`（メモ：当たり ${m.hits}・外れ ${m.misses}・鍵にできず素通し ${m.bypass}・鍵が同じで実引数が違う ${m.clashes}・答えが綴れず書き換えを見られない ${m.unverifiable}。${Object.entries(m.byName).map(([k, v]) => `${k} ${v.hits}/${v.misses}/${v.bypass}`).join("、")}）`);
	console.log(`（時間：読み込み ${res.timing.loadMs}ms・歩き ${Math.round(res.timing.walkMs / 1000)}s（うち対照 ${Math.round((res.timing.controlsMs ?? 0) / 1000)}s）${res.timing.memoCheckMs !== undefined ? `・メモ無しの見本 ${Math.round(res.timing.memoCheckMs / 1000)}s（${res.memoCheck.map((x) => `${x.name} ${Math.round(x.ms / 1000)}s`).join("・")}）` : ""}・ワーカー全体 ${Math.round(res.timing.totalMs / 1000)}s・壁時計 ${Math.round((Date.now() - t0) / 1000)}s）`);
	console.log(`（数：届く関数 ${g.counts.reachable}＝pass4 が出せる ${g.counts["pass4-emits"].functions}＋出せない ${g.counts["pass4-blocks"].functions}。same ${g.counts.same}（出せる範囲 ${g.counts["pass4-emits"].same}）・閉じる ${g.counts.closed}（出せる範囲 ${g.counts["pass4-emits"].closed}））`);
	// 1周の時間（速い段に置く目安は2分。頭の「段と時間」）
	console.log(`（1周 ${Math.round((Date.now() - t0) / 1000)} 秒）`);

	if (only) {
		const golden = fs.existsSync(GOLDEN) ? JSON.parse(fs.readFileSync(GOLDEN, "utf8")) : { functions: {} };
		for (const r of res.functions) {
			const want = golden.functions[r.name];
			const got = statusOf(r);
			check(`${r.name}: ${want ?? "(golden に無い)"}${want !== undefined && got !== want ? mismatchNote(got, want) : ""}`, got, want);
		}
		console.log(`\n（--only：golden の数と閉じた集合は見ない）\n${passed}/${total} passed`);
		process.exit(passed === total ? 0 : 1);
	}

	if (UPDATE) {
		if (passed !== total) {
			console.log(`\n門の検査が落ちているので golden は書かない`);
			console.log(`${passed}/${total} passed`);
			process.exit(1);
		}
		fs.writeFileSync(GOLDEN, JSON.stringify(g, null, "\t") + "\n");
		console.log(`golden を書いた：${path.relative(process.cwd(), GOLDEN)}`);
		console.log(`\n${passed}/${total} passed`);
		process.exit(0);
	}

	if (!fs.existsSync(GOLDEN)) {
		check("golden がある（--update で作る）", false, true);
		console.log(`\n${passed}/${total} passed`);
		process.exit(1);
	}
	const golden = JSON.parse(fs.readFileSync(GOLDEN, "utf8"));
	check("駆動と型の出どころが golden と同じ", [g.driver, g.types], [golden.driver, golden.types]);
	// 関数ごと：golden の並びと届く関数が1対1
	const names = Object.keys(g.functions);
	const gnames = Object.keys(golden.functions);
	check("届く関数が golden と1対1（増えても減っても落ちる）", { added: names.filter((x) => !(x in golden.functions)), dropped: gnames.filter((x) => !(x in g.functions)) }, { added: [], dropped: [] });
	for (const nm of names) {
		const got = g.functions[nm];
		const want = golden.functions[nm];
		if (want === undefined) continue;
		check(`${nm}: ${want}${got !== want ? mismatchNote(got, want) : ""}`, got, want);
	}
	check("pass4 が出せない関数が golden と同じ", g.pass4Blocked, golden.pass4Blocked);
	const shrunk = golden.closed.filter((f) => !g.closed.includes(f));
	check("閉じた集合が縮んでいない", shrunk, []);
	check("閉じた集合が golden と同じ（増えたなら --update）", g.closed, golden.closed);
	check("数が golden と同じ（範囲は pass4 が出せる／出せない）", g.counts, golden.counts);
	check("断りの類の数が golden と同じ", g.reasons, golden.reasons);
	console.log(`\n${passed}/${total} passed`);
	process.exit(passed === total ? 0 : 1);
}

// node で直に起動したときだけ門を回す（import しただけでは走らない）。ワーカーは印で見分ける
const invokedDirectly = () => {
	if (!process.argv[1]) return false;
	const norm = (p) => {
		let q = path.resolve(p);
		try {
			q = fs.realpathSync(q);
		} catch {}
		return process.platform === "win32" ? q.toLowerCase() : q;
	};
	return norm(process.argv[1]) === norm(__filename);
};
if (!isMainThread && workerData && workerData.selfhostSn) await work(workerData);
else if (isMainThread && invokedDirectly()) await main();
