/**
 * Sign コンパイラが投げるエラーの種別（alpha1 の前段で要る分だけ）。
 *
 * alpha/javascript/errors.js（c3b203fc）から `OperationError` だけを持ってきた。型が合わない
 * ときに何が起きるか、診断の重さをどう読むかは意味解析の側の話なので、まだ置かない。
 */

/**
 * 静的に判定できる「その位置でその操作は許されない」違反。コンパイルを止める。
 * 前段では、前処理が `?` の行の字下げを断るときに使う。
 * 元のソースの行（`line`、1 から）は、前処理と resolve が投げる所で後から持たせる（R127。前処理と文法の SyntaxError も同じ鍵を持つ）。
 */
export class OperationError extends Error {
  /**
   * @param {string} message 人間向けの説明
   * @param {{ spec?: string, reason?: string }} [info] 参照すべき規範箇所と機械可読なコード
   */
  constructor(message, info = {}) {
    super(message);
    this.name = "OperationError";
    if (info.spec) this.spec = info.spec;
    if (info.reason) this.reason = info.reason;
  }
}
