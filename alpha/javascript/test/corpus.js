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
 */
export const CORPUS = [
	{ rel: "alpha/sign/preprocess.sn", front: 0, asm: [], insn: { full: 3711, plain: 5628 }, digest: { full: "a464b50d6457398f", plain: "e220344a01e84e67" } },
	{ rel: "alpha/sign/lexer.sn", front: 0, asm: [], insn: { full: 602, plain: 1004 }, digest: { full: "d0f8e35c843caf67", plain: "74d2762677152598" } },
	{ rel: "alpha/sign/parser.sn", front: 0, asm: [], insn: { full: 1013, plain: 1378 }, digest: { full: "d27cebf79590ae8d", plain: "3ee677fddd359b5b" } },
	// 表だけの1枚。命令は `_sign_main` の `ret` 1つきりで、正規化後 824 行のうち
	// **823 行がディレクティブとラベル**である。ディレクティブを落とす比べ方なら、この1枚は
	// 「`ret` が1つ」としか言わない——`asmdiff` がディレクティブを残す理由も、命令数だけの
	// golden では足りない理由も、そのままこの行に立っている。
	{ rel: "alpha/sign/operator_table.sn", front: 0, asm: [], insn: { full: 1, plain: 1 }, digest: { full: "67d287f67f8b3139", plain: "67d287f67f8b3139" } },
	{ rel: "alpha/sign/emit.sn", front: 0, asm: [], insn: { full: 576, plain: 849 }, digest: { full: "fa2dd3698dc3bbc2", plain: "34d2cebcee03e40e" } },
	// 型システムと Pass 4 の継ぎ目。表が8つと、そこから1つの還元、それに字面のプリフィックスを
	// 分ける小さな走査が乗る。**表だけの枚（`operator_table.sn`）と歩く枚（`preprocess.sn`）の
	// 中間**で、その両方の代金がこの1枚に立っている——`.rodata` に行く表と、`s ' i` で歩く
	// match_case の鎖である。`target_info_sn.test.js` が JS 側と答えを突き合わせる。
	{ rel: "alpha/sign/target_info.sn", front: 0, asm: [], insn: { full: 1293, plain: 2053 }, digest: { full: "db010fbe9c735c49", plain: "cc5d8a20de8e5ca5" } },
	{
		rel: "documents/ja-jp/guide/examples/n-queen/n_queens.sn",
		front: 0,
		asm: [{ severity: "error", includes: "器の構築はまだ出せません" }],
		insn: { full: 226, plain: 391 },
		digest: { full: "e88b013f73de12f5", plain: "f51bbfd101245e54" },
	},
	// 注釈を落とした版。**同じ命令列が出るはず**で、比べる側（`asmdiff`）が注釈を落とす
	// 根拠そのものである（注釈は命令を出さない）。指紋も同じ値になる。
	{
		rel: "documents/ja-jp/guide/examples/n-queen/n_queens.nocomment.sn",
		front: 0,
		asm: [{ severity: "error", includes: "器の構築はまだ出せません" }],
		insn: { full: 226, plain: 391 },
		digest: { full: "e88b013f73de12f5", plain: "f51bbfd101245e54" },
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

export const sourceOf = (entry) => fs.readFileSync(path.join(ROOT, entry.rel), "utf8");

/**
 * 命令の数え方。ディレクティブ（`\t.ascii`）とラベルは数えない
 * ——`idiom_to_instructions.md §1` の規則と同じ数になる。
 */
export const countInstructions = (text) => (text.match(/^\t[a-z]/gm) || []).length;
