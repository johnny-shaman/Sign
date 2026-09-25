/**
 * **段1の答え合わせ用の中間語を、pass2 の木から作る。**
 *
 * `alpha/sign/lower.sn`（段1）は字面を parser.sn と同じ歩き方で割って後置の語を積む。ここは
 * 同じ語の列を **pass2 が組んだ木**から作る——字面の割り方を2通りで持ち、突き合わせることで、
 * 段2の出力が食い違ったときに故障が段1（割り方）にあるのか段2（命令）にあるのかが分かれる。
 *
 * 部分集合の外に出たら投げる（`codegen_sn.test.js` は、そのとき Sign の側も `!` で断っていることを見る）。
 * 語の形は lower.sn と同じ：`F 仮引数の数 名前` / `C 引数の数 名前` / `J 引数の数 名前` / `G` / `D` / `Q` ほか。
 */
const bare = (v) => (typeof v === "string" && v.startsWith("<") && v.endsWith(">") ? v.slice(1, -1) : String(v));
const isDef = (n) => n && n.type === "operation" && n.name === "define";
const unwrap = (n) => {
	while (n && Array.isArray(n.lines) && n.lines.length === 1 && !isDef(n.lines[0])) n = n.lines[0];
	return n;
};
const ALU = new Set(["+", "-", "*", "/"]);
const COND = new Set(["<", "<=", "=", ">=", ">", "!="]);
const out = (n) => {
	throw new Error("部分集合の外: " + JSON.stringify({ type: n && n.type, kind: n && n.kind, name: n && n.name, op: n && n.op }));
};
const kindOf = (n0) => {
	const n = unwrap(n0);
	if (!n) return out(n0);
	if (Array.isArray(n.lines) && n.lines.some(isDef)) return "match";
	if (n.type === "atom" && n.kind === "number" && /^[0-9]+$/.test(n.value)) return "num";
	if (n.type === "atom" && (n.value === "__" || n.value === "_")) return "unit";
	if (n.type === "atom" && n.kind === "identifier") return "ident";
	if (n.type === "operation" && n.position === "infix" && ALU.has(n.op) && n.name !== "equal") return "op";
	if (n.type === "operation" && n.position === "infix" && COND.has(n.op)) return "op";
	if (n.type === "operation" && n.name === "apply") return "apply";
	return out(n);
};
const chain = (n) => {
	const args = [];
	n = unwrap(n);
	while (n && n.name === "apply") {
		args.unshift(n.right);
		n = unwrap(n.left);
	}
	return { f: bare(n.value), args };
};
const paramsOf = (p) => {
	const u = unwrap(p);
	if (u.type === "atom") return [u.value];
	if (u.type === "params" && u.entries.every((e) => !e.rest && !e.default)) return u.entries.map((e) => e.name);
	if (u.name === "apply") {
		const c = chain(u);
		return [`<${c.f}>`, ...c.args.map((a) => unwrap(a).value)];
	}
	return out(u);
};

function il(n, cx, tail) {
	const u = unwrap(n);
	switch (kindOf(u)) {
		case "num":
			return [`N ${u.value}`];
		case "unit":
			return ["U"];
		case "ident": {
			const i = cx.params.indexOf(u.value);
			if (i >= 0) return [`P ${i}`];
			// 定数は中身を撒き、「__ になり得る」の印を付ける。
			return [...il(cx.consts.get(u.value) ?? out(u), cx, false), "X"];
		}
		case "op":
			return [...il(u.left, cx, false), ...il(u.right, cx, false), `O ${u.op}`];
		case "apply": {
			const { f, args } = chain(u);
			if (args.length > 8) out(u);
			return [...args.flatMap((a) => il(a, cx, false)), `${tail ? "J" : "C"} ${args.length} ${f}`];
		}
		case "match": {
			const L = ["M"];
			const val = (v) => (kindOf(v) === "unit" ? ["V"] : il(v, cx, tail));
			for (const l of u.lines) {
				if (!isDef(l)) {
					L.push("W", ...val(l));
					break;
				}
				L.push("A", ...il(l.left, cx, false), "T", "W", ...val(l.right), "E");
			}
			return [...L, "Z"];
		}
	}
	return out(u);
}

export function lowerReference(nodes) {
	const consts = new Map();
	for (const n of nodes) if (isDef(n) && !(n.right && n.right.name === "lambda")) consts.set(n.left.value, n.right);
	const fns = [];
	const main = [];
	for (const n of nodes) {
		if (n.type === "atom" && n.kind === "string") continue;
		if (!(isDef(n) && n.right && n.right.name === "lambda")) {
			main.push(isDef(n) ? n.right : n);
			continue;
		}
		const name = bare(n.left.value);
		const params = paramsOf(n.right.left);
		const body = n.right.right;
		fns.push(`F ${params.length} ${name}`, ...il(body, { params, consts }, true), kindOf(body) === "apply" ? "Q" : "R");
	}
	return [...fns, "G", ...main.flatMap((e) => [...il(e, { params: [], consts }, false), "S"]), "D"];
}
