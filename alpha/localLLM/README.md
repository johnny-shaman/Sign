# alpha/localLLM — Sign ネイティブな LLM の練習場

Sign を書き、Sign で書いた処理系（セルフホスト）を保守できる小さなローカル LLM を育てる。
ここはその**段階1：練習場**である。モデルはまだ無い。あるのは「課題」と「採点」で、どのモデルを
載せても同じ物差しで測れる。

## 考え方

- **覚えさせるのは Sign だけ。** 仕様は小さい——演算子の表、`__`（零対象：対象として見れば値、
  射として見れば関数）、仮引数の形、match_case と論理演算、再帰と写像・畳み込み。あとはその
  組み合わせである。他の言語の常識を持ち込む余地が無いので、仕様から外れる理由が無い。
- **JS の処理系は採点役であって教材ではない。** 解釈器と、セルフホストを JS と突き合わせる門が
  正しさを決める。JS のコードは問いに見せない。JS の直しも課題にしない——解かせると、モデルが
  覚えるのは Sign ではなく JS になる。
- **問いに付けるのは仕様の核だけ。** `core.md`（数 KB）。`--spec full` で演算子の表を足す。表は
  問うたびに仕様書（`documents/ja-jp/guide/operator_table.md`）から切り出す——仕様は裁定で動くので、
  写しを置くと古くなる。
- **良い課題だけを使う。** 中身を消せば落ち、正解なら通る課題だけが、書いたものを見ている。
- **仕様の裁定は人が決める。** モデルは選択肢と根拠を出すところまで。

## 課題は4種類（易しい順）

| 課題 | 問い | 答え | 採点 | 数 |
|---|---|---|---|---|
| 値（`values.mjs`） | 短い完結したプログラム | 最後の式の値を1行 | 解釈器の値と一致 | 145 |
| 書く・コーパス（`write.mjs`） | プログラムから定義を1つ抜き、見出しと全体の値を見せる | その定義 | 戻して走らせた値が元と一致 | 使える穴 117 |
| 書く・セルフホスト（`write.mjs`） | `alpha/sign/*.sn` から定義を1つ抜き、周りと直前の注を見せる | その定義 | 戻した HEAD の写しで、その枚の門が全部通る | 393（要 validate） |
| 直す（`ask.mjs`） | Sign だけを直した過去のコミットの症状と、直す場所の周り | SEARCH/REPLACE の塊 | そのコミットが足したテスト（隠しテスト）が通る | 判別できる 18（20 件中） |

セルフホストの枚と門：`lower.sn`・`codegen.sn` → codegen_sn、`asm_text.sn`・`emit.sn`・
`operator_table.sn` → emit_sn、`preprocess.sn`・`lexer.sn`・`parser.sn` → preprocess_sn、
`target_info.sn` → target_info_sn、`layout.sn` → layout_sn。1件の採点は数秒（preprocess）〜
数分（layout）。

## 使い方

Node だけで動く（`alpha/javascript` で `npm ci` 済みであること）。直す課題は履歴から作るので、
浅いクローンなら先に `git fetch --unshallow` する。

```sh
cd alpha/localLLM
node values.mjs harvest                       # 値の課題
node write.mjs harvest                        # 書く課題（コーパス・セルフホスト）
node write.mjs validate --kind corpus         # 使える穴を確かめる（数秒）
node write.mjs validate --kind self --file preprocess.sn
node harvest.mjs && node validate.mjs         # 直す課題

node write.mjs ask <穴id> --dry               # 問いを見る（モデル不要）
node write.mjs ask --oracle --limit 5         # 正解を流して道具一式を確かめる
```

モデルを載せたら、OpenAI 互換の口（llama.cpp の `llama-server` など）へ向ける：

```sh
llama-server -m モデル.gguf --port 8080 -c 8192      # 別の端末で
node values.mjs ask --url http://127.0.0.1:8080 --label qwen1.5b
node write.mjs ask --url http://127.0.0.1:8080 --kind corpus --label qwen1.5b
node write.mjs ask --url http://127.0.0.1:8080 --kind self --label qwen1.5b
node ask.mjs --url http://127.0.0.1:8080 --label qwen1.5b
```

結果は `runs/<記録名>.jsonl` に1課題1行で残る。採点では機械の側（clang・qemu）を飛ばす
（`SIGN_NO_QEMU=1`）。qemu は最後の確認に回す（`grade.mjs --qemu`）。

## この機械で（Ryzen 7 5700U・16GB）

- 練習場・採点：CPU で十分。
- 推論：llama.cpp（CPU 版と Vulkan 版の速い方）で 1.5B〜3B の4ビット量子化が目安。
- 学習：手元では現実的でない。学習のときだけ GPU を数時間借り、でき上がったモデルを量子化して
  手元へ戻す。

## この先

1. 既存の小さなモデルで基準を測る（どの課題・どの意味で外すか）。
2. 外す形を狙って、解釈器で合成データを作る（値の課題と書く課題は無限に作れる）。
3. 追加学習し、同じ物差しで測り直す。セルフホストの穴が埋められるようになったら、
   セルフホストの続き（まだ JS にしか無い段）を書かせる。

## ファイル

| ファイル | 役割 |
|---|---|
| `core.md` | 問いに付ける仕様の核 |
| `spec.mjs` | 問いの前置きを組む（核＋仕様書から切り出す演算子の表） |
| `values.mjs` | 値を当てる課題 |
| `write.mjs` | 定義を抜いて書かせる課題（コーパス・セルフホスト） |
| `harvest.mjs` / `validate.mjs` / `ask.mjs` | Sign だけを直した過去のコミットを直す課題 |
| `grade.mjs` | 候補を一時的な作業木（git worktree）に当てて門で採点する |
| `interp.mjs` / `show.mjs` | 解釈器を別プロセスで走らせ、値を1つの形で見せる |
| `lib.mjs` | git・課題の読み書き・パスの分け方 |

`tasks/`・`holes/`・`runs/`・`values.jsonl` は生成物なので git に入れない（いつでも作り直せる）。
