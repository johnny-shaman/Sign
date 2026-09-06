/**
 * **演算子表を Sign で書いた形へ落とす。**
 *
 * 同じ表がリポジトリに4本ある——仕様の md、その隣の .js、実装の手写し、そして Sign 側。
 * 手で写すと必ずズレる（実際、`===` の廃止と `||` の除外で2件ズレていた）ので、Sign 側は
 * 仕様の .js から生成する。
 *
 * **鍵は演算子の綴りそのものである。** 綴りが静的に書けるなら 0 命令で引け、実行時に
 * 決まるなら名前を探す——同じ表が構造体にも連想配列にもなる。並列のリストで持つより
 * 素直で、2本を同期させる必要も無い。
 *
 * 走らせ方: node tools/gen_operator_table.mjs
 */
import fs from "fs";
import { OPERATOR_BY_PRECEDENCE, getStrictInfixOperators } from "../documents/ja-jp/impl/syntax/operator_table.js";
const BQ = String.fromCharCode(96), BS = String.fromCharCode(92), T = "\t";
const s = (x) => BQ + x + BQ;
// **書けるかどうかは「バッククォートで囲めるか」である。**
//
// 空白（段10 の余積）は綴りが1文字の空白であって、`` ` ` `` と書けば長さ1の String に
// なる——0x20 を弾いていたので表から落ちていた。落とすべきなのは**文字列に書けないもの**
// だけ、つまり改行とタブである（文字列は同一行で閉じる必要がある）。
//
// 前後に空白を入れてよいか（strict_infix）は別の問いで、そちらは空白そのものと
// | / ||（囲みの区切り）を除く——getStrictInfixOperators が既にそう答えている。
const writable = (sym) => /^[ -~]+$/.test(sym) && sym !== BS + "n";
const rows = [];
for (let i = 0; i < OPERATOR_BY_PRECEDENCE.length; i++)
  for (const [sym, def] of Object.entries(OPERATOR_BY_PRECEDENCE[i] || {})) {
    if (def.position !== "infix" || def.removed || !writable(sym)) continue;
    rows.push({ sym, tier: i + 1 });
  }
const RIGHT = new Set([",", "@", "^", "#", ":", "?"]);
const strict = getStrictInfixOperators().filter(writable);
const L = [
  s("Sign の演算子表。仕様から生成している——手で写さない"),
  s("生成もと documents/ja-jp/impl/syntax/operator_table.js / 生成器 tools/gen_operator_table.mjs"),
  "",
  s("鍵は演算子の綴りそのものである。綴りが静的に書けるなら 0 命令で引け、実行時に決まる"),
  s("なら名前を探す——同じ表が構造体にも連想配列にもなる"),
  "",
  s("段番号は仕様の段番号そのものであって、配列の添字ではない"),
  "",
  s("--- 段 ---"),
  "",
  "#tier :",
  ...rows.map((r) => T + s(r.sym) + " : " + r.tier),
  "",
  s("--- 右結合か（凡例「右結合は位置表記内に※あり」）---"),
  "",
  "#right :",
  ...rows.map((r) => T + s(r.sym) + " : " + (RIGHT.has(r.sym) ? 1 : 0)),
  "",
  s("--- 曖昧でない中置：前後に空白を入れてよいもの ---"),
  s("前置・後置・囲みにもなる綴りは入っていない"),
  s("| と || は囲みの区切りでもあるので入れない——空白を入れるとノルムが壊れる"),
  s("所属の問いなので綴りを鍵にした集合で持つ。無ければ __ が返る"),
  "",
  "#strict_infix :",
  ...strict.map((x) => T + s(x) + " : 1"),
  "",
];
fs.writeFileSync(new URL("../alpha/sign/operator_table.sn", import.meta.url), L.join("\n") + "\n");
console.log("書いた: " + rows.length + " 中置 / " + strict.length + " 曖昧でない中置");
