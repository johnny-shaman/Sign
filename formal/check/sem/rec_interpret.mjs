// 試験が読む ../interpret.js の代わり（hook.mjs が付け替える）。本物をそのまま出し、interpret に来た源を覚える。
import * as R from "../../../alpha1/javascript/interpret.js";
import { note } from "./rec_store.mjs";
export * from "../../../alpha1/javascript/interpret.js";

export function interpret(source, ...rest) {
  note("interpret", source);
  return R.interpret(source, ...rest);
}
