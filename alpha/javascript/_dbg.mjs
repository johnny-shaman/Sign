import { compile } from "./compile.js";
import { generateAsm } from "./pass4.js";
const src = process.argv[2];
const { nodes, env } = compile(src, { charset: "ascii" });
const r = generateAsm(nodes, env, { target: "aarch64_qemu", charset: "ascii", layer: 1 });
console.log(r.diagnostics.map((d) => d.message).join("\n"));
