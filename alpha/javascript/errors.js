/**
 * Sign コンパイラが投げるエラーの種別。
 *
 * 種別は「なぜ止まるのか」で分ける。値が `__` へ収束すべきものはそもそも例外にしない
 * ——型が合わないことは「その対象間に射が無い」ということだが、`__` は零対象であり
 * 零射 `A → __ → B` は常に存在するため、結果は `__` であって停止理由ではない
 * （0_design_principles.md 原理4 の「型が合わないことは違反ではない」）。
 *
 * | 種別 | 意味 | 例 |
 * |---|---|---|
 * | `SyntaxError` | そもそもプログラムが存在しない。射を書けていない | 縮約しきれない式、連鎖比較の混在 |
 * | `OperationError` | プログラムは在るが、その位置でその操作が許されていない | 仮引数部での `#`（Output） |
 * | （例外にしない） | 射が無い＝零射。`__` へ収束し、Pass 3b が理由を記録する | `` `abc` + 1 ``、範囲の端点が List |
 *
 * `TypeError` を `OperationError` の代わりに使わないこと。「型が合わない」は上の表の
 * 3行目であり、停止させない側である。名前を分けることで、停止する違反と `__` へ落ちる
 * 収束とがエラー種別だけで見分けられる。
 */

/**
 * 静的に判定できる「その位置でその操作は許されない」違反（原理4）。
 * 型の不一致ではないため `__` へは落とさず、コンパイルを停止する。
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

/**
 * **その診断は止めるものか。**
 *
 * 重さの綴りは段で分かれている——前段（`compile`）と解釈器は `level`、後段（`generateAsm`）は
 * `severity` である。読む側がどちらか片方しか見ないと、**止めない診断を止まったと読む**
 * （実際、上界が見積もりであることを information で言い始めたら、機械の検査が 59 件
 * 「出せない」に化けた）。重さの読み方は1か所で決める。
 *
 * `information` は止めない。「危険は書けるが、気付ける」側の報せであって、出力は在る
 * （sret の上界が見積もりであること、など）。`warning` と `error` は止める側に数える
 * ——今のところ後段は `error` しか積まない。
 */
export const isBlocking = (d) => !!d && (d.severity || d.level || "error") !== "information";

/** 止める診断だけを残す。`[]` なら出力は在る。 */
export const blockingOf = (diagnostics) => (diagnostics || []).filter(isBlocking);
