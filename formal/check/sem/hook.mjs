// NODE_OPTIONS=--import=<この file の URL>：試験（と試験が起こす子のプロセス）が import する alpha1 の lexer.js・resolve.js・interpret.js を、
// 来た源を覚える包み（rec_*.mjs）に付け替える。試験の file は変えない。
// alpha1 の中の import（interpret.js → resolve.js → lexer.js）と包み自身の import は本物のまま（中の呼び出しは外から来た源と同じ源なので数えない）。
import { registerHooks } from "node:module";

const JS = new URL("../../../alpha1/javascript/", import.meta.url).href.toLowerCase();
const REAL = new Set(["lexer.js", "resolve.js", "interpret.js", "operator_table.js", "errors.js"].map((f) => JS + f));
const WRAP = {
  "lexer.js": new URL("./rec_lexer.mjs", import.meta.url).href,
  "resolve.js": new URL("./rec_resolve.mjs", import.meta.url).href,
  "interpret.js": new URL("./rec_interpret.mjs", import.meta.url).href,
};
const WRAPS = new Set(Object.values(WRAP).map((u) => u.toLowerCase()));

registerHooks({
  resolve(specifier, context, nextResolve) {
    const r = nextResolve(specifier, context);
    const u = r.url.toLowerCase();
    if (!u.startsWith(JS)) return r;
    const name = u.slice(JS.length);
    if (!(name in WRAP)) return r;
    const parent = (context.parentURL || "").toLowerCase();
    if (REAL.has(parent) || WRAPS.has(parent)) return r;
    return { ...r, url: WRAP[name], shortCircuit: true };
  },
});
