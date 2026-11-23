// node ex.mjs <spec.md> <out.json> : 規則の例の行から源を組み、dump.mjs の入力（源の JSON 配列）と、仕様の答えの一覧（<out.json>.meta）を書く
import fs from "fs";
const md = fs.readFileSync(process.argv[2], "utf8").split(/\r?\n/);
const srcs = [], meta = [];
let rule = "";
const un = (s) => s.replace(/⏎/g, "\n").replace(/⇥/g, "\t").replace(/␠/g, " ");
const ticks = (s) => [...s.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
const SHARED = {
  gq: "gq :\n\t\tx\n\t\ty : 1\n\t? x + y",
  gd: "gd :\n\t\tys\n\t\tzs : 3\n\t? ys + zs",
};
for (const line of md) {
  const h = line.match(/^#### (R\d+)/);
  if (h) { rule = h[1]; continue; }
  if (/^## [56]/.test(line)) rule = "";
  if (!rule || !/^- `/.test(line) || !line.includes("→")) continue;
  const [lhs, ...rest] = line.slice(2).split("→");
  let main = lhs.trim(), ctx = [];
  const m = main.match(/^(.*?)（(.*)）\s*$/);
  if (m && m[2].includes("`")) {
    main = m[1].trim();
    // 「、」で別の定義、1つの定義の中のバッククォートの区切りは改行
    ctx = m[2].split("、").map((p) => ticks(p).join("\n")).filter(Boolean);
  }
  const parts = main.split(/\s*⏎\s*/).map((p) => (p === "空行" ? "" : p.replace(/^`|`$/g, "")));
  const body = un(parts.join("\n"));
  // 1行の定義は続けて並べ、字下げのブロックで終わる定義の後にだけ空行を置く
  const cs = ctx.map(un);
  const sep = (p) => (/\n\t[^\n]*$/.test(p) ? "\n\n" : "\n");
  const c = cs.reduce((a, p, i) => (i ? a + sep(cs[i - 1]) : "") + p, "");
  const all = c + "\n" + body;
  const extra = Object.entries(SHARED)
    .filter(([nm]) => new RegExp("\\b" + nm + "\\b").test(all) && !new RegExp("(^|\\n)" + nm + " :").test(all))
    .map(([, d]) => d);
  const c2 = [...extra, c].filter(Boolean).join("\n\n");
  srcs.push((c2 ? c2 + sep(c2) : "") + body);
  meta.push({ rule, expect: rest.join("→").trim() });
}
fs.writeFileSync(process.argv[3], JSON.stringify(srcs));
fs.writeFileSync(process.argv[3] + ".meta", JSON.stringify(meta));
console.log(srcs.length);
