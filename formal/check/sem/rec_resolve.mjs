// 試験が読む ../resolve.js の代わり（hook.mjs が付け替える）。本物をそのまま出し、resolve に来た源を覚える。
import * as R from "../../../alpha1/javascript/resolve.js";
import { note } from "./rec_store.mjs";
export * from "../../../alpha1/javascript/resolve.js";

export function resolve(source, ...rest) {
  note("resolve", source);
  return R.resolve(source, ...rest);
}
