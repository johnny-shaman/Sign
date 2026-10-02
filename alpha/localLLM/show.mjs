/**
 * 値の見せ方を1つに決める（値を当てる課題と、書かせる課題の採点で共有する）。
 * `__` は `__`、器は `[a b c]`、構造体は `[k : v ...]`、文字列と数はそのまま。
 */
export function show(v, I) {
	if (I.isUnit(v)) return "__";
	const o = I.observe(v);
	const go = (x) => {
		if (x === undefined || x === null) return "__";
		if (Array.isArray(x)) return `[${x.map(go).join(" ")}]`;
		if (typeof x === "object") return `[${Object.entries(x).map(([k, y]) => `${k} : ${go(y)}`).join(" ")}]`;
		return String(x);
	};
	return go(o);
}
