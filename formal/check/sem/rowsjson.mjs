// rows（resolve の書いた行の木）を JSON にし、戻す。
// - 行の木（type が seq か op で、lineOf が行を返す物）に "line" を足す。lineOf は WeakMap なので、木の写しに書き込むしかない。
// - core.raw（前段の語の並び）は値の段が読まないので落とす。
// - Symbol・BigInt・関数・undefined・循環・共有が来たら投げる（今の rows には無いことを確かめるため）。
export function exportRows(rows, lineOf) {
  const onPath = new Set();
  const seen = new Set();
  const enc = (n, path) => {
    if (n === null) return null;
    const ty = typeof n;
    if (ty === "string" || ty === "boolean") return n;
    if (ty === "number") {
      if (!Number.isSafeInteger(n)) throw new Error(`安全でない数 ${n} @ ${path}`);
      return n;
    }
    if (ty !== "object") throw new Error(`JSON にできない ${ty} @ ${path}`);
    if (onPath.has(n)) throw new Error(`循環 @ ${path}`);
    if (seen.has(n)) throw new Error(`共有 @ ${path}`);
    seen.add(n);
    onPath.add(n);
    try {
      if (Array.isArray(n)) return n.map((x, i) => enc(x, `${path}[${i}]`));
      if (Object.getOwnPropertySymbols(n).length) throw new Error(`Symbol の鍵 @ ${path}`);
      const o = {};
      for (const [k, v] of Object.entries(n)) {
        if (k === "raw") continue;
        if (v === undefined) throw new Error(`undefined @ ${path}.${k}`);
        o[k] = enc(v, `${path}.${k}`);
      }
      const l = lineOf(n);
      if (l !== undefined) {
        if (n.type !== "seq" && n.type !== "op") throw new Error(`行の木でない物に行 @ ${path}`);
        if (!Number.isSafeInteger(l)) throw new Error(`行が整数でない @ ${path}`);
        o.line = l;
      }
      return o;
    } finally {
      onPath.delete(n);
    }
  };
  return rows.map((r, i) => enc(r, `rows[${i}]`));
}

// JSON から rows と lineOf を戻す（"line" は外して WeakMap に置く。値の段に元と同じ形を渡す）。
export function importRows(json) {
  const lines = new WeakMap();
  const dec = (n) => {
    if (n === null || typeof n !== "object") return n;
    if (Array.isArray(n)) {
      n.forEach(dec);
      return n;
    }
    if ("line" in n) {
      lines.set(n, n.line);
      delete n.line;
    }
    for (const v of Object.values(n)) dec(v);
    return n;
  };
  const rows = dec(json);
  return { rows, lineOf: (row) => lines.get(row) };
}
