// 試験が読む ../lexer.js の代わり（hook.mjs が付け替える）。本物をそのまま出し、preprocess・preprocessWithLines に来た源を覚える。
import * as R from "../../../alpha1/javascript/lexer.js";
import { note } from "./rec_store.mjs";
export * from "../../../alpha1/javascript/lexer.js";

export function preprocess(input, ...rest) {
  note("preprocess", input);
  return R.preprocess(input, ...rest);
}
export function preprocessWithLines(input, ...rest) {
  note("preprocessWithLines", input);
  return R.preprocessWithLines(input, ...rest);
}
