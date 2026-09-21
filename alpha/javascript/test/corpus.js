/**
 * **門が覆う `.sn` の一覧。ここが唯一の表である。**
 *
 * これまではテストごとに `.sn` を自分で拾っていた（`sign_programs` は `alpha/sign` を、
 * `preprocess_sn` はその3本を、8クイーンは documents を）。増やしたとき片方だけ増える
 * ——実際に `emit.sn` はしばらく1本のテストからしか見られていなかった。表を1つにする。
 *
 * **診断は「0件」ではなく、そのファイルの既知の1件そのものを書く。** `n_queens.sn` は sret の
 * 上界が出せない1件を持っている。除外すると「直った」ことも隠れるので、**既知として
 * 記録して覆う**。数ではなく重さと言い分で書くのは、**数が動かないまま理由が変わる**からで、
 * 実際そうなる: `em.fail` がこの1件を積まないようにすると、同じ節の下の
 * `まだ出せない式です` が代わりに積まれて**数は 1 のまま**だった。数だけ見ていると、
 * 止まった場所が動いたことを見逃す。
 *
 * 命令数と**命令列の指紋**（`asmdiff.mjs` の `digestOf`）は golden（この値そのものを見る）。
 * 後段を直せば動く値なので、動いたら**その場で書き換える**ためのものである。
 * 「桁が変わったら気づく」幅ではなく値で置くのは、自己ホストの比較が命令1つの差を問うからで、
 * 幅で見ていると門の側が先に鈍る。
 *
 * **数と指紋は別の物を見ている。** 数は長さだけで、命令数を変えずに中身を変える直し方
 * （即値・レジスタ・条件・`add`→`sub`・`.rodata` の並び・`.section`・`.balign`）は
 * 全部その外を通る。実測でコーパスの正規化後 10899 行のうち命令は 6355 行、残り 41.7% は
 * 数が見ていない。指紋がその残りを見る。数を残すのは、**落ちたときにどちらへ動いたか
 * （増えた/減った/長さは同じ）を指紋が言えない**からで、2つで1組である。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.join(__dirname, "..", "..", "..");
export const SIGN_DIR = path.join(ROOT, "alpha", "sign");

// **インポートを解く手段は呼ぶ側が渡す**（build_system.md §4.2——`compile.js` は fs に触らない）。
export const readImport = (p) => fs.readFileSync(path.join(SIGN_DIR, p), "utf8").replace(/\r\n/g, "\n");

/** 機械へ落とすときの既定。**層は 1**——理由は `asm_gate.test.js` の頭に書いた。 */
export const ASM_OPT = { target: "aarch64_qemu", charset: "ascii", layer: 1 };

/**
 * @property rel    リポジトリの根からの道
 * @property front  前段（`compile`）の診断の数
 * @property asm    機械（`generateAsm`）の既知の診断。`{ severity, includes }` の並びで、
 *                  並び・重さ・言い分をそのまま見る（数だけでは理由の入れ替わりを見逃す）
 * @property insn   命令数。`full` は既定、`plain` は `{regAlloc:false, peepholes:false}`
 * @property digest 命令列の指紋（`digestOf`）。命令だけでなくディレクティブとラベルも入る
 *
 * ## 2026-09-18、引く側3枚の指紋が動いた。命令は1つも動いていない
 *
 * `resolveImports` が撒かれてきた定義の `#` を落とすようになった（`compile.js`）。
 * 実測の差は `.s` の 12822 行のうち **128 行だけ**で、内訳は:
 *
 *   消えた 80 行  `.global` 40 ＋ `.hidden` 40（引く側が引いた表を公開していた分）
 *   動いた 48 行  ラベルの綴りが `infix` から `.Lbind_infix` へ戻った分
 *                 （定義行と、それを指す `adrp` / `add :lo12:`）
 *
 * **命令は1つも動いていない**——`insn` は 6枚とも前後で同じ値で、`mnemonicCounts` を
 * 種別ごとに比べても**動いたのはディレクティブ2種だけ**である:
 * preprocess `.global` 15→1・`.hidden` 14→0、parser と emit は `.global` 14→1・`.hidden` 13→0、
 * 残り3枚は違い 0。**命令の綴りの差は 6枚とも 0**。
 *
 * 指紋だけが動くのは `digestOf` が正規化後の行を**ディレクティブとラベルごと**束ねるからで、
 * まさにそのために置いてある（頭の注記の「数と指紋は別の物を見ている」）。
 * **数が動かないまま指紋だけが動いた実例**がこの3枚である。
 *
 * ## 2026-09-21、`target_info.sn` が +2 命令。**6枚のうち1枚だけが動いた**
 *
 * `Int` の算術も溢れて `__`（niche）になる、と `cannotBeUnit` に認めさせた
 * （`pass4.js` の `OVERFLOWS_TO_NICHE`）。機械は自分が出した niche を次の算術で数として
 * 扱っており、`(max + 1) + 5` が**解釈 5 ／ 機械 -9223372036854775803、診断ゼロ**で割れていた。
 *
 * **この直しは「吸収」ではない。** 選ぶのは niche ではなく残った辺、つまり完全性公理を
 * 機械にも出させる側である。吸収にすると `1 + (d rest)` で終端する畳み込みが全部 `__` へ
 * 潰れ、`preprocess.sn` が 88/88 → 38/88 になる（実測）。
 *
 * **動いたのが1枚だけなのが、この直しの狭さの証拠である。** 検査が出るのは「溢れうる算術を
 * 辺に持つ所」だけで、素の `Int + Int` は今までどおり `add` 1命令である
 * （`project_sign_critical_overflow` の「critical か否かで検査を払う」はそのまま）。
 * 残り5枚は命令数も指紋も1つも動いていない。
 */
export const CORPUS = [
	{ rel: "alpha/sign/preprocess.sn", front: 0, asm: [], insn: { full: 3711, plain: 5628 }, digest: { full: "8e35f8d0a07dc74a", plain: "2494ff932efb4e17" } },
	// **語 ＝ 次の空白まで**（文字列の中と括りの中は数えない）。規則1つで `is_digit` も `<=` も
	// `[a ~b]` も1語になる——空白が余積演算子そのものだから、空白で割ることが余積の項を取り
	// 出すことになる。括りは1語のまま返し、中身を字句へ投げ返すのは構文解析の仕事である。
	//
	// **`tokens` は長さだけ合っていた時期がある。** `take_while` が作った語の本体が `tokens`
	// 自身の枠に在り、返るときに捨てられていた——器へ入るのはその番地なので `len` は正しく、
	// 中身だけが死ぬ。`expr (tokens `1 + 2`)` は長さ 9 のまま `[[+] <00> <01>]` を返していた。
	// いまは記述子の後ろに中身の置き場を取って、呼び先にそこへ書かせる。
	{ rel: "alpha/sign/lexer.sn", front: 0, asm: [], insn: { full: 933, plain: 1631 }, digest: { full: "605c5a6293ccc524", plain: "72b517df53975bc3" } },
	{ rel: "alpha/sign/parser.sn", front: 0, asm: [], insn: { full: 1013, plain: 1378 }, digest: { full: "7616b47db9dce7c1", plain: "04f2d2defe573048" } },
	// 表だけの1枚。命令は `_.main` の `ret` 1つきりで、正規化後 824 行のうち
	// **823 行がディレクティブとラベル**である。ディレクティブを落とす比べ方なら、この1枚は
	// 「`ret` が1つ」としか言わない——`asmdiff` がディレクティブを残す理由も、命令数だけの
	// golden では足りない理由も、そのままこの行に立っている。
	{ rel: "alpha/sign/operator_table.sn", front: 0, asm: [], insn: { full: 1, plain: 1 }, digest: { full: "0a54415ea5f080d3", plain: "0a54415ea5f080d3" } },
	{ rel: "alpha/sign/emit.sn", front: 0, asm: [], insn: { full: 576, plain: 849 }, digest: { full: "f4688041c2f40252", plain: "458fded99a28e667" } },
	// 型システムと Pass 4 の継ぎ目。表が8つと、そこから1つの還元、それに字面のプリフィックスを
	// 分ける小さな走査が乗る。**表だけの枚（`operator_table.sn`）と歩く枚（`preprocess.sn`）の
	// 中間**で、その両方の代金がこの1枚に立っている——`.rodata` に行く表と、`s ' i` で歩く
	// match_case の鎖である。`target_info_sn.test.js` が JS 側と答えを突き合わせる。
	{ rel: "alpha/sign/target_info.sn", front: 0, asm: [], insn: { full: 1295, plain: 2055 }, digest: { full: "69375f472b243370", plain: "fa42d490d1e02f89" } },
	{
		rel: "documents/ja-jp/guide/examples/n-queen/n_queens.sn",
		front: 0,
		asm: [{ severity: "error", includes: "器の構築はまだ出せません" }],
		insn: { full: 226, plain: 391 },
		digest: { full: "f40e1e70a03df736", plain: "6841c046561dfe3e" },
	},
	// 注釈を落とした版。**同じ命令列が出るはず**で、比べる側（`asmdiff`）が注釈を落とす
	// 根拠そのものである（注釈は命令を出さない）。指紋も同じ値になる。
	{
		rel: "documents/ja-jp/guide/examples/n-queen/n_queens.nocomment.sn",
		front: 0,
		asm: [{ severity: "error", includes: "器の構築はまだ出せません" }],
		insn: { full: 226, plain: 391 },
		digest: { full: "f40e1e70a03df736", plain: "6841c046561dfe3e" },
	},
];

/**
 * 覆っていない `.sn` と、その理由。**空白ではなく名指しで残す**——覆っていないことと、
 * 忘れていることは別である。
 *
 * `throws` は「まだ通らない」ことの証拠で、門がそこも見る。**理由が消えたら表が古くなる**
 * ——前段が直って通るようになった日に、誰も表を書き換えなければ、この2本は永久に門の外に
 * 置かれたままになる。通ったら落として「コーパスへ入れろ」と言わせる。
 */
export const NOT_COVERED = [
	{ rel: "documents/ja-jp/guide/example.sn", why: "パースできない（文字列が行をまたいでいる）", throws: "文字列が行の終わりまでに閉じていません" },
	{ rel: "documents/en-us/guide/example.sn", why: "パースできない（`(` の位置）", throws: 'but "(" found' },
];

/**
 * **コーパスが実際に出した綴りの全部**（既定と最適化を切った側の和）。
 *
 * 門が捕まえられる上限はここで決まる——コーパスが一度も出さない命令は、pass4 の側を
 * どう壊しても門は緑のままである。実測で確かめた: `udiv` の後に付く `csel` の条件を
 * `eq`→`ne` に裏返しても、**コーパスの出力は1バイトも変わらない**（指紋も動かない）。
 * **門の穴ではなく、道が無い**のである。
 *
 * pass4 の emit に字面で書かれている綴りは 39 あり、そのうち **13 は一度も出ない**:
 * `adcs adds asr b.ls cneg cset ldar madd movk smulh udiv umulh`。
 * **割り算・掛け算・溢れの検査・`cset`・広い即値**がまるごと門の外にある。後段のその部分を
 * Sign へ移すときは、先に**それを踏む `.sn` をコーパスへ入れる**こと。
 *
 * 綴りで見るのは目安で、本当の上限は**呼び出し地点**である（同じ綴りでも出す場所は複数ある）。
 * 実測: pass4 の emit 呼び出しは 503 か所、コーパスが踏むのは 259 か所＝**51%**。
 * 綴りの表で見張れるのはその外側だけなので、地点の数はここに書き置く（測り直す道具は
 * 常設していない——行番号は動くので golden に向かない）。
 *
 * 増える分には直せばよい値である（golden と同じ扱い——踏む道が増えたら書き足す）。
 */
export const REACHED_MNEMONICS = [
	"add", "adrp", "and", "b", "b.eq", "b.ge", "b.gt", "b.hi", "b.lt", "b.ne", "b.vs", "bl",
	"cbz", "ccmp", "cmp", "csel", "ldp", "ldr", "ldrb", "lsr", "mov", "movn", "movz", "mul",
	"negs", "sdiv", "stp", "str", "strb", "sub", "subs",
];

/**
 * **`.st` 経由で合流したときの門の表**（`st_gate.test.js`）。
 *
 * `.st` は長らく誰にも読まれていなかった。値を葉に載せて読む側（`st_read.js`）を置いた今、
 * 見るべきは「**ソースを読まずに `.st` だけで同じ `.s` が出るか**」である。門は2枚あり、
 * **どちらか一方では足りない**——実測で、片方が緑のままもう片方だけが赤になる壊し方が
 * 両向きに在った（下の表）。
 *
 * ## 自写（`selfCopy`）が成り立つのは1枚だけである
 *
 * `X.sn` → `.st` → 起こした `.sn` → `.s` が元と同じ指紋になるのは、**その枚が丸ごとデータ
 * のとき**に限る。`.st` は関数の本体を持たないからで、6枚のうち `operator_table.sn` だけが
 * これに当たる。残り5枚は自分の `#` を1つも持たない（`own` が空）ので `.st` は見出しだけ
 * になり、起こすと**空のプログラム**になる（`raised` がその指紋＝`7be35452c61194ea`）。
 * `own` を golden に置くのは、**どれかの枚が自分の `#` を持った日に言わせる**ためである。
 *
 * ## 引く側の `.st` が 14 → 0 になった（2026-09-18）
 *
 * それまで `preprocess` / `parser` / `emit` の `.st` は 14 エントリ・8千バイト台を持っていたが、
 * **中身は1つも自分のものではなく、`operator_table` の表の素通し**だった（`own` が空、という
 * 欄が既にそれを言っている）。`resolveImports` が撒かれてきた `#` を落とすようにしたので、
 * 素通しは消えて 0 になった。`.s` の側で `.global` が消えたのと**同じ1つの事実**である
 * ——「この枚が公開するもの」が `.s` と `.st` で食い違わない、という形にした。
 *
 * > [!CAUTION]
 * > **落ちた性質がある。** 素通しが在った頃は、第三の枚が `parser.st` **だけ**を読んで
 * > `infix` の表を引けた（実測で通っていた）。いまは同じ形が
 * > `error: まだ出せない識別子です（infix）` で落ちる——しかも**前段の診断は 0 件**で、
 * > 名指しするのは pass4 だけである。「この `.st` では足りない、`operator_table.st` も要る」
 * > と言える綴り（C の `#include` に当たるもの）も、前段の診断も、まだ無い。
 * > **黙った誤答ではなく遅い断り**なので通しているが、穴として名前を付けて残す
 * > （`test/export_symbol.test.js` の §8 がこの形そのものを見ている）。
 *
 * ## `.st` 自身も golden にする（`.s` の門だけでは足りない）
 *
 * `.st` が黙って痩せたとき、`.s` の門だけでは**どこが痩せたか**が出ない。実測: `.st` から
 * `#strict_infix` を丸ごと落としても、自写の門も `parser` の門も `emit` の門も**緑のまま**
 * である（`strict_infix` を読むのは `preprocess.sn` だけ）。逆に `.st` の sha だけを見て
 * いると、`.st` が同じでも読む側が壊れた場合を見逃す。2つで1組である。
 *
 * @property st       `.st` テキストそのものの golden（sha は sha256 の頭16桁）
 * @property own      その枚が**自分で** `#` した名前。素通しは数えない
 * @property selfCopy 自写の門（G1）が成り立つか
 * @property raised   `.st` から起こした `.sn` が出す `.s` の指紋。`selfCopy` なら
 *                    `CORPUS` の `digest.full` と同じ値になる（同じ事実を2か所に書かない）
 */
export const ST_BOUNDARY = [
	{ rel: "alpha/sign/preprocess.sn", st: { sha: "ccedc347ea8256f7", bytes: 99, entries: 0, unresolved: 0 }, own: [], selfCopy: false, raised: "7be35452c61194ea" },
	{ rel: "alpha/sign/lexer.sn", st: { sha: "044de038718c7429", bytes: 94, entries: 0, unresolved: 0 }, own: [], selfCopy: false, raised: "7be35452c61194ea" },
	{ rel: "alpha/sign/parser.sn", st: { sha: "5e73c5151d3d9647", bytes: 95, entries: 0, unresolved: 0 }, own: [], selfCopy: false, raised: "7be35452c61194ea" },
	{
		rel: "alpha/sign/operator_table.sn",
		st: { sha: "46a3e2b0f23e2540", bytes: 8075, entries: 14, unresolved: 0 },
		own: ["infix", "prefix", "postfix", "enclosure", "asm_infix_width", "asm_infix_shape", "asm_infix_signed", "asm_prefix_shape", "asm_prefix_place", "asm_prefix_width", "asm_postfix_shape", "asm_enclosure_signed", "asm_enclosure_shape", "strict_infix"],
		selfCopy: true,
		raised: "0a54415ea5f080d3",
	},
	{ rel: "alpha/sign/emit.sn", st: { sha: "85cbca180facc0b9", bytes: 93, entries: 0, unresolved: 0 }, own: [], selfCopy: false, raised: "7be35452c61194ea" },
	{ rel: "alpha/sign/target_info.sn", st: { sha: "be05332cb5937e52", bytes: 100, entries: 0, unresolved: 0 }, own: [], selfCopy: false, raised: "7be35452c61194ea" },
];

/**
 * **境界の門**。`operator_table.sn` を引く3本を、読み手が `.st` **しか**返さない状態で
 * 合流させる。期待する指紋は `CORPUS` の `digest.full` そのもの——ここに値を写さないのは、
 * 同じ事実を2か所に置くと片方だけ動いて黙って食い違うからである。
 *
 * **`preprocess.sn` はここで初めて `.st` 経由が測られた枚である。** そして実測では、
 * `strict_infix`（29鍵・全部 Int）を見ている門は**この1本だけ**だった:
 *
 * | 壊し方（`operator_table.st` を1か所） | 自写 | parser | emit | preprocess |
 * |---|---|---|---|---|
 * | 葉の値（String / Int） | 赤 | 赤 | 赤 | 赤 |
 * | スロットを1つ落とす | 赤 | 赤 | 赤 | 赤 |
 * | 鍵の綴りを変える（`parser.sn` が `' 鍵` で引く鍵） | **緑** | 赤 | 緑 | 緑 |
 * | 鍵の綴りを変える（**それ以外の鍵**） | **緑** | **緑** | **緑** | **緑** |
 * | 連番を2つ入れ替える | **緑** | 赤 | 緑 | 緑 |
 * | `strict_infix` の値・スロット・エントリ | **緑** | **緑** | **緑** | 赤 |
 * | 名前順の並びを崩す | 緑 | 緑 | 緑 | 緑 |
 * | 型の綴りだけ変える | 緑 | 緑 | 緑 | 緑 |
 *
 * 鍵と連番が自写の門から見えないのは、**鍵の名前が機械語に残らない**からである
 * （スロットは番地の隔たりで引く）。読む側がそれを使う枚——`parser.sn` が `' assoc` で
 * 引く所——で初めて荷重が出る。
 *
 * > [!CAUTION]
 * > **`.s` の門で赤くなる鍵は、`parser.sn` が静的に `' 鍵` で引く鍵だけである。**
 * > 鍵を1つずつ 75 通りリネームして4枚へ通すと、**23 通りが4枚とも緑**だった（実測）:
 * > `prefix` / `postfix` / `enclosure` の外側の鍵 18 本（＝演算子の綴りそのもの）、
 * > 各表の内側の `name`、asm_* 8枚の内側の `form` 全部、ほか。
 * > **`.s` は原理的に鍵を運ばない**ので、`.s` の門をいくつ並べてもここは埋まらない。
 * >
 * > `ST_BOUNDARY` の `st.sha` は**書く側にしか効かない**——読む側が鍵を化けさせた場合、
 * > `.st` は素のままなので sha は動かない（実測: `st_read.js` が `form` を `formX` と
 * > 読むようにしても、4枚の門も sha も全部緑）。だから `st_gate.test.js` の §5 に
 * > **`.st` → 起こした `.sn` → `.st'` の往復**を置いてある。鍵は `.st` の中に字面で在るので、
 * > 書く側が落としても読む側が化けさせても、そこで割れる。逆に `strict_infix` は `operator_table.sn` 単独では
 * 一度も使われず、平らな器なので `.rodata` にも出ない。**自写と境界は包含ではなく相補**
 * であり、片方だけ置いたら塞がらない穴がそれぞれに在る。
 *
 * 最後の2行は**荷重が無いことの記録**である。並びは読む側が連番で並べ直すので起こした
 * `.sn` がバイト一致する。型の綴りも同じで、起こす側が書くのは**値の字面だけ**——Sign に
 * 型注釈の構文が無い以上、葉の型はテキストを通ると必ず値から推論し直される。
 * 綴りが化けたことは `.s` では出ないので、**`ST_BOUNDARY` の `st.sha`（書く側）と
 * `st_gate.test.js` §5 の往復（読む側）の2つ**がそこを見る。
 *
 * @property blind その門が見ない `.st` のエントリ（落としても緑のままになるもの）
 */
export const ST_EDGES = [
	{ rel: "alpha/sign/parser.sn", via: "operator_table.sn", blind: ["strict_infix"] },
	{ rel: "alpha/sign/emit.sn", via: "operator_table.sn", blind: ["strict_infix"] },
	{ rel: "alpha/sign/preprocess.sn", via: "operator_table.sn", blind: [] },
];

export const sourceOf = (entry) => fs.readFileSync(path.join(ROOT, entry.rel), "utf8");

/**
 * 命令の数え方。ディレクティブ（`\t.ascii`）とラベルは数えない
 * ——`idiom_to_instructions.md §1` の規則と同じ数になる。
 */
export const countInstructions = (text) => (text.match(/^\t[a-z]/gm) || []).length;
