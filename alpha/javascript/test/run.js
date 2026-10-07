/**
 * テストランナー。test/ 配下の *.test.js をすべて実行する。
 *
 * 各テストファイルは独立したプロセスとして起動する。テストごとに peggy で
 * sign.pegjs を都度ビルドしており（ビルド済み parser.js には依存しない）、
 * グローバルな状態も持たないため、プロセスを分けても取りこぼしは無い。
 * 逆にプロセスを分けることで、1本が落ちても残りの結果が取れる。
 *
 * テストファイル側の規約:
 *   - 最終行に `N/M passed` を出力する
 *   - 全件通れば終了コード0、1件でも落ちれば非0
 * 新しいテストは test/ に `*.test.js` として置けば、ここへの登録は要らない。
 *
 * 実行: npm test
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(__dirname).filter((f) => f.endsWith(".test.js")).sort();

if (files.length === 0) {
	console.log("テストファイルが1つも見つかりません（test/*.test.js）");
	process.exit(1);
}

const width = Math.max(...files.map((f) => f.length));
let failedFiles = 0;
let passed = 0;
let total = 0;
let unsummarized = 0;

for (const file of files) {
	const started = Date.now();
	// Sign にはループが無く**再帰しか無い**ので、素直に書いたコードほど深く積む。
	// 末尾再帰は TCO（トランポリン）で平らになるが、余積の中の再帰呼び出しは末尾位置に
	// 無いため入力の大きさぶんフレームを使う——`preprocess.sn` が自分自身（5000文字超）を
	// 処理できるかは、Node の既定スタック（約1MB＝Sign の約1000フレーム）では測れない。
	// これは JS インタプリタ側の都合であって Sign の言語仕様ではないので、テストでは
	// スタックを広げて意味論そのものを見る。
	//
	// **広げられるのは、糸の本当のスタックの手前まで。** `--stack-size` は V8 に「ここまで積んでよい」と言うだけで、
	// 糸のスタックそのものは広げない。この機械の node（Windows、v24.16）の主の糸は 8 MiB で、`--stack-size=8150`
	// までは深い再帰が RangeError で止まるが、8180 以上では V8 が本当の端を踏み越え、プロセスごと終了コード 127 で
	// 落ちる——集計行も理由も出ない（2026-10-07 に測った）。以前の 16000 では、8 MiB を超えて積んだテストは
	// RangeError ではなく 127 で落ちていた。8000 は端の手前に余裕を残す値である（16000 で通っていたテストは、
	// 8000 でも全部同じ件数で通る）。これより深く積む検査は、`Worker` の `resourceLimits.stackSizeMb`（糸の
	// スタックそのものを取る）で回す——layout_sn・selfhost_sn がそうしている。
	const result = spawnSync(process.execPath, ["--stack-size=8000", path.join(__dirname, file)], { encoding: "utf8" });
	const elapsed = Date.now() - started;
	const output = (result.stdout || "") + (result.stderr || "");
	// 規約の `N/M passed` を拾う。最後のものを採る（テスト本文が同じ形を出す場合に備えて）
	const summary = [...output.matchAll(/^(\d+)\/(\d+) passed$/gm)].pop();
	if (summary) {
		passed += Number(summary[1]);
		total += Number(summary[2]);
	} else {
		unsummarized++;
	}

	const ok = result.status === 0 && !result.error;
	if (!ok) failedFiles++;
	const count = summary ? `${summary[1]}/${summary[2]}` : "集計行なし";
	console.log(`${ok ? "OK  " : "FAIL"} ${file.padEnd(width)}  ${count.padStart(11)}  ${String(elapsed).padStart(5)}ms`);

	// 落ちたときだけ全出力を見せる。通ったテストの詳細は個別実行で見ればよい
	if (!ok) {
		if (result.error) console.log(`     起動に失敗: ${result.error.message}`);
		console.log(output.replace(/\r/g, "").replace(/^/gm, "     ").replace(/\s+$/, ""));
	}
}

console.log(`\n${files.length - failedFiles}/${files.length} ファイル / ${passed}/${total} ケース`);
if (unsummarized > 0) console.log(`（うち ${unsummarized} 本は \`N/M passed\` を出しておらず、ケース数に含まれていない）`);
process.exit(failedFiles === 0 ? 0 : 1);
