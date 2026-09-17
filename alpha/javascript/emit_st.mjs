/**
 * SignType を書き出すドライバ。
 *
 *   node emit_st.mjs <file.sn>                `.st` を標準出力へ
 *   node emit_st.mjs <file.sn> --write        `.st` を <file>.st として書く（ビルド成果物）
 *   node emit_st.mjs <file.sn> ist [--write]  `.ist`（全識別子）。--write で <file>.ist
 *
 * ファイルに触るのはドライバの仕事である（`build_system.md` §4.2——`compile.js` は fs に
 * 触らない）。だからここが `.st` を置く唯一の場所になる。
 *
 * ## `.ist` は書いてよい。守る線は「配らない」である
 *
 * 利用者の決定（2026-09-18）：「`.ist` がファイルじゃなくても読み取れるなら問題ない。
 * ディスクへ書いてもいいけど、あとで消せばいいぐらいの柔らかい話」。
 *
 * `compiler_pipeline.md` §4 は `.ist` を**プロセス内メモリのみ**と定め、内部識別子名・内部
 * struct のフィールド構成が漏れることを理由に挙げている。ただし **`.ist` の隣には `.sn` が
 * 在る**——その名前も欄もソースにそのまま書いてあるので、普通の配置では `.ist` は新しく
 * 漏らすものを持っていない。効くのは「ソース無しで配る」場合だけで、そこで配るのは `.st` である。
 *
 * だから `.ist` は**中間物**として扱う。書いてよい、消してよい、**配る物には入れない**。
 * （この節と §4 の食い違いは利用者へ提案済み。条文が直るまでここが実装側の記録である。）
 */
import fs from "fs";
import path from "path";
import { compile } from "./compile.js";
import { generateSignType } from "./st.js";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && a !== "st" && a !== "ist");
const scope = args.includes("ist") ? "ist" : "st";
const write = args.includes("--write");

if (!file) {
	console.error("使い方: node emit_st.mjs <file.sn> [ist] [--write]");
	process.exit(1);
}

const dir = path.dirname(path.resolve(file));
const { nodes, env } = compile(fs.readFileSync(file, "utf8"), {
	sourcePath: file,
	// インポートは `.sn` の隣から解く。読むのはドライバの仕事である（§4.2）。
	readImport: (f) => fs.readFileSync(path.join(dir, f), "utf8").replace(/\r\n/g, "\n"),
});
const r = generateSignType(nodes, env, { scope, source: path.basename(file) });

if (write) {
	const out = file.replace(/\.sn$/, "") + (scope === "ist" ? ".ist" : ".st");
	fs.writeFileSync(out, r.text);
	console.error(
		`${out} に書いた（${r.entries} エントリ / 未解決 ${r.unresolved} / ${Buffer.byteLength(r.text)} バイト）` +
			(scope === "ist" ? "——中間物です。配る物には入れないこと" : "")
	);
} else {
	process.stdout.write(r.text);
	console.error(`${r.entries} エントリ / 未解決 ${r.unresolved}`);
}
