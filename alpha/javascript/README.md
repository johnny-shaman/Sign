# alpha/javascript

Sign言語の lexer/parser 再実装（JavaScript版）。**正式仕様は
`documents/ja-jp/impl/syntax/grammar.pegjs`**（peggy記法、優先順位をPEGに埋め込まず
フラットな空白区切りリストを構築する方式）＋`coproduct_resolver.md`（Pass2: フラットリスト→
二分木ASTへの縮約アルゴリズム）であり、ここではそれをそのまま実装する。
pre-alpha 実装はアーカイブへ退避した（`documents/ja-jp/impl/appendix/pre_alpha.md` 参照）。

以前このディレクトリに置いていた「16段階優先順位を手でエンコードする古典的PEG方式」の
`sign.pegjs`は不採用の遺物（`LanguageServer/src/sign.pegjs`と同じ立ち位置）と判明したため、
正式仕様に差し替え済み。

## 構成

- `compile.js` — **Pass 1〜3 の単一ドライバ**（`compiler_pipeline.md` §3 のフロントエンド）。
  `compile(source)` が `preprocess → parse → buildEnv(Pass 1a) → reduceAll(Pass 2) →
  specializeGenericParams(Pass 1b) → annotateTypes(Pass 3)` を通し、
  `{ nodes, env, specializations, diagnostics }` を返す。**各ノードには `atomType`
  （Layer 2 型）が載り、`diagnostics` には Pass 3b（`__` へ収束する経路の静的記録）が入る**。
  Pass 3b の各項目は機械可読な `reason`（`arithmetic-type-mismatch` 等）と人間向けの
  `message` を持つ——形式手法へ橋を架けるとき読むのは前者。`__` は零対象なので
  あらゆる崩壊が同じ値に潰れるが「なぜ潰れたか」は全く異なる、という非対称を
  値ではなく帳簿の側で埋めるのが役割（`type_system.md` §5 Pass 3b）。
  実行時側の対応物は `unit.md` §7.3（デバッグ層の Unit Payload）で、こちらは
  `runtimeEnv.diagnostics` に入る。両者は補完関係にある。
  これを作るまで、各テストと playground が同じ手順をそれぞれコピーして持っており、
  **`pass1b.js` と `pass3.js` はどこからも呼ばれていなかった**（型を出しても消費者が
  存在しない状態）。パーサーは `options.parse` で差し替え可能——テストは
  `sign.pegjs`（正式仕様）から peggy で都度ビルドしたものを渡す。ビルド済み `parser.js`
  は実際に一度8/4時点で止まったまま `sign.pegjs` の修正が反映されていなかったことがあり、
  テストが文法ソースを直接検証する性質は保つ必要があるため。
  **Passの順序が `type_system.md` §5 と食い違っている点**：§5 は Pass 1a → 1b → 2 → 3 の
  順を書いているが、実装では Pass 1b が Pass 2 の**後**に走る。呼び出しサイトが何であるかは、
  Pass 2 が余積を apply/compose/concat のどれに解決するか決めるまで確定しないため
  （トークン列の段階では `f x` が関数適用かリスト構築か判定できない）。
  B-1・B-3 と同じ「§5 の記述が実装より単純化されている」系の食い違いで、仕様側の修正候補。
- `lexer.js` — 前処理（`separateInfix` + `markBlock`）。pre-alpha 実装から無改変で移植（引き継いだ唯一の資産。appendix/pre_alpha.md 参照）。
  **ブラケット深さ追跡を追加**（`bracketDelta`）：`markBlock`はタブ深さの変化のみでINDENT/DEDENTを
  挿入するためブラケットの存在を考慮しておらず、`function_guide.md`の`func_mixed`例のように
  `[`を定義行より深くインデントして複数行で書くと、ブラケットの中に本来無いはずのインデント
  ブロックが二重に差し込まれてパースが壊れる問題があった。他の多くの言語のオフサイドルールと
  同様、ブラケットが未クローズの間はインデント/デデントの意味を一時的に無効化することで解消
  （`test/param_list.test.js`で確認）。
  **`?` の行の字下げを見る**（`refuseMisplacedQuestionRow`・`questionAfterClose`、利用者の裁定 2026-10-05）：`?` の行は
  定義の行から1段だけ字下げする（仮引数のブロックは2段、`?` は1段、本体のブロックも2段。括りの仮引数を複数の行に
  書いたら `?` は閉じの次の行）。続きの行は前の行へつないでから後の段へ渡るので、`?` の行の深さを見られるのは
  前処理だけである。定義の行と同じ深さ以下（0桁目を含む）・仮引数の行と同じ深さ・1行の仮引数の後で2段以上下げた `?`、
  仮引数の行が定義の行から2段でない（3段以上、または3段から2段へ戻した）ブロックの `?`、複数の行に書いた括りの
  閉じの行に続けた `?` を名指しで断る（`OperationError`、`question-row-indent`、`test/question_row_indent.test.js`。
  Sign 側は `alpha/sign/preprocess.sn` の `q_bad` で、`test/preprocess_sn.test.js` が同じ表で突き合わせる。
  preprocess.sn の門は書いた行の深さを Int の桁に持つので、TAB 61 個より深い行があれば断る）。
- `operator_table.js` — 演算子定義。`documents/ja-jp/impl/syntax/operator_table.js`から移植（正式仕様）。
  **`buildLexerRegex()`のバグを修正済み**：ダブルクォート文字列内の`(\\.|[^"\r\n])*`が捕捉
  グループのままだったため、`lexer.js`の`separateInfix`が読むグループ番号が1つずれ、
  演算子（`,`・`+`・`<`等）の前後への自動スペース挿入が**事実上ずっと機能していなかった**
  （既存テストは全てソース側に手でスペースを入れていたため気づかれていなかった）。非捕捉
  グループ`(?:...)`に変更して解消。
  **`OPERATOR_DICT`構築ループのオフバイワンも修正済み**：`for (let prec = 1; ...)`が配列
  index 0（コメント上の優先順位"1"：改行・前置export`#`/`##`/`###`）を一生読み飛ばしていた
  ため、これらが`OPERATOR_DICT`に一切登録されず、かつ他の全演算子もコメント表記より
  1つ小さい優先順位で格納されていた（相対順序は一律ズレのため偶然壊れなかったが、
  `pass2.js`の`reduceOnce`がハードコードする`tier === 10`（余積/スペース）が、本来は
  コメント優先順位"11"のレンジ演算子`~+`等と衝突していた）。`prec = 0`から開始し
  `precedence: prec + 1`でコメント表記と一致させて解消（`documents/ja-jp/impl/syntax/
  operator_table.js`本体にも同時反映済み）。
  **後置`@`（import）の優先順位を22→24に修正**（`documents/ja-jp/impl/syntax/
  operator_table.js`本体にも同時反映済み）：`.md`表記（tier24、前置`@`のtier23より
  高い）と`.js`実装（tier22、tier23より低い）が食い違っていた。「importしてから
  input」（`@\`add.sn\`@` → `input(import(...))`、resolveDensityで実測確認）という
  意図と、tier番号が大きいほど先に結合される（優先度が高い）という慣習には`.md`側の
  配置の方が整合するため、`.js`側を`.md`に合わせた（resolveDensityは前置/後置演算子では
  precedence数値自体を参照しないため、この修正は現状のパース挙動には影響しない——
  あくまで仕様記述としての正確さの修正）。同時に前置`-`（negate）の行を`.md`側
  （`impl/syntax/operator_table.md`・`guide/operator_table.md`の両方）に追加：
  符号反転は算術演算のため、代数式の優先順位に従いべき乗（tier15）より優先度が高い
  tier23に位置する。
  **`!==`（tier8、構造比較）の内部名を"not_equal"→"xnot_equal"に改名**：以前は
  tier12の`!=`と`.name`が完全に衝突しており（`.op`で区別する既存の回避策で凌いでいた、
  `pass3.js`/`interpreter.js`参照）、`documents/ja-jp/impl/syntax/operator_table.md`が
  元々使っていた"xnot_equal"という名前と食い違っていた。`.js`側を`.md`に合わせて改名し、
  実装内の名前衝突・`.js`と`.md`の食い違いを同時に解消した（既存の`.op`ベースの区別
  ロジックは引き続き正しく動くため挙動に影響は無い、`1 !== 2`のエラーメッセージが
  `未対応の演算 'not_equal'`から`未対応の演算 'xnot_equal'`へ変わっただけ）。
  なお、`=`（tier12、"assign_equal"）・`'`/`@`（tier17、"get_prop"/"get_at"）も
  `.md`の「機能」欄では同じ単語（それぞれ"equal"・"get"）が複数行で使い回されているが、
  `.js`側は元々別名になっており実装上の衝突は無い——`.md`の自然文としての語の再利用に
  過ぎないため、これらは修正不要と判断した。
- `sign.pegjs` — `documents/ja-jp/impl/syntax/grammar.pegjs`そのもの（正式仕様、**根本バグ修正済み**）。
  **peggy記法**（`@`ラベル等）を使用しているため、`pegjs`ではなく`peggy`パッケージでビルドする必要がある。
  **`identifier`規則のバグも修正済み**：`"_" [a-zA-Z0-9_]+`が`__`（Unit）にもマッチしてしまい
  `unit`規則へ一生到達しなかった問題を、`&{ id !== "__" }`述語で除外して解消
  （`documents/ja-jp/impl/syntax/grammar.pegjs`本体にも同時反映済み）。
- `pass1.js` — Pass1（最小実装）。ブロック階層に沿ってネストした識別子環境（env連鎖）を構築し、Pass2のgetCategoryに渡す。
  `<id> : <リテラル1個>`という単純な定義行からLayer 2 Atom内部型（`atomType`）も静的に読み取る。
  前置export記号（`#`/`##`/`###`）も検出し、Bindingの`exported`フィールドに記録する。単純な
  空白区切りの複数パラメータ（rest・ブラケット無し）の**アリティ**も`arity`フィールドに記録する。
- `pass2.js` — Pass2（`coproduct_resolver.md`）の実装。フラットなTerm列を二分木ASTへ縮約する。
  **多引数関数の呼び出しが正しく飽和するよう修正済み**：`getCategory`が`apply`ノードを
  問答無用でAtom扱いしていたため、`f : x y ? x + y`に対し`f 3 5`が
  `construct[apply[f,3], 5]`（fを3だけに適用した結果と5をタプル化）に誤って縮約されて
  いた（単一パラメータの関数では表面化しない、多引数特有のバグ）。`applyChainInfo`で
  左に伸びるapplyチェーンの深さを数え、`pass1.js`の`arity`に届くまでLambdaのまま扱う
  ことで、`apply[apply[f,3],5]`という正しく飽和したチェーンになるよう修正
  （`test/multi_arg_apply.test.js`で確認）。アリティを超える余分な引数は、飽和した
  呼び出し結果の後ろに`construct`でタプル化される（仕様として意図された挙動）。
  **tier=10（余積）の縮約を、仕様通りの段階的マルチパス（compose→apply→apply_reverse→
  concat/push/construct）に修正済み**：以前はcompose/apply/apply_reverse/concat/push/construct
  の区別なく、隣接ペアを左から見て最初にマッチしたものを即座に縮約する単一グリーディ
  スキャンになっており、`coproduct_resolver.md`§4が規定する優先順位（10.5→10.0）が
  守られていなかった（例: `inc:x?x+1`として`5 inc 3`が、本来tier10.4(apply)で先に
  `inc 3`が縮約され`construct[5, apply[inc,3]]`になるべきところ、実際は左端の`5 inc`が
  tier10.3(apply_reverse)として先に縮約されてしまっていた）。`COPRODUCT_PHASES`で
  4段階に明示的に分割し、各段階を使い尽くしてから次へ進むよう修正（`test/interpreter.test.js`
  で確認）。8/5の設計討論で、apply_reverse（`x f`記法）はSVOの中置呼び出し（主語=第1引数、
  Option A）ではなく、UFCS的なreceiver記法（`f : [foo bar ~this] ? ...`のようなオブジェクト
  指向的呼び出しを想定、Option B）と結論づけた——この修正により、apply_reverseは「そのLambda
  が右側に通常適用できるAtomを持たない場合のみ」発動するフォールバックになり、両隣にAtomが
  あるLambda（`5 inc 3`）ではapplyが先に確定してapply_reverseが途中のAtomを横取りしない。
- `pass3.js` — Pass3（`type_system.md`§2〜§3.2の型伝播）の実装。Pass2が返す二分木ASTを歩いて
  左辺優先ルール（`typeof(L op R) = typeof(L)`）でLayer 2型を推論する。
- `pass1b.js` — Pass1b（`type_system.md`§5、`@ref`ジェネリック仮引数の具体化）の実装。
  `@`前置演算子で参照される仮引数を検出し、プログラム全体の呼び出しサイトから実引数の
  カテゴリ（Lambda/Atom）を静的に収集する。
- `runtime_kind.js` — **実行時の種類**の唯一の置き場（RTTI の裁定 2026-09-27：動的な側は RTTI に頼り、
  静的な側は動的な側が付けた型を信じて RTTI なしで走る）。`UNIT`・`isUnit`・恒等射 `IDENTITY` と、値の形を
  見る述語（`isIterator`・`isNamedSlots`）、値の種類を pass3 の型の名前で答える `kindOf` を持つ。JS の値で
  区別できない2組（`Num` ＝ `Int`/`Address`/`Float`、`Chr1` ＝ `Char`/長さ1の `String`）は箱が入るまで割れて
  いない。`interpreter.js` は `UNIT`・`isUnit` を出し直すので、引いている試験は変わらない。算術の結果の型は
  `layout.js` の `arithDomain`（表は1つ、読む側は pass3・解釈器・機械の3つ）が決める。
- `interpreter.js` — 最小インタプリタ（初実装）。`evaluate(node, runtimeEnv)`でPass2/Pass1bの
  ASTを実際に評価する。完全性公理（`f __ = __`）、デフォルト引数・restパラメータへのUnit
  フォールバック、算術/比較演算子のUnit伝播則、`&`/`|`/`;`の短絡評価、多引数関数の一括適用
  （apply連鎖を遡って引数を集めてから1回だけ本体を評価）を実装。`$`/`@`/`#`（アドレス操作）は
  メモリモデルが未設計のため未対応。type_system.md §3.3/§3.4の具体例をそのまま実行して
  値が一致することを確認（`test/interpreter.test.js`、17/17 pass）。
  **副産物のバグ修正**：`pass1.js`の`arity`計算がインデントブロック形のデフォルト引数
  （`g :\n x\n y:x+1\n ? x+y`のような形）に対応してなかった（裸の`x y z`形のみ対応）ため、
  デフォルト引数を持つ多引数関数の呼び出しが多引数バグと同様に壊れていた。`countArity`が
  ネストした仮引数部も再帰的に数えるよう拡張して解消。
  **関数合成（compose）を追加、かつ合成順序のバグを修正**：`documents/ja-jp/guide/example.sn`
  の`[+ 1] [* 2] 5 = [* 2]([+ 1] 5) = 12`が示す通り、Signの`f g`は数学記法の`f∘g`
  （gが先）ではなく**左→右のパイプライン順**（`(f g)(x) = g(f(x))`、fが先）。実装時に
  一度逆に実装してしまい、指摘を受けて修正した。
  **文字列（String）の挙動を修正**：算術演算子の左辺がStringの場合、型エラーで`__`に
  収束する（`type_system.md`§3.2の表を正とした——`list_model.md`§4.4の文面「`+`で
  コードポイントが露出する」は自身の例で実証されておらず、既知の食い違いとして記録）。
  スペース（余積）で左辺がStringの場合は、右辺を文字列化してテキスト連結する
  （`` `123` 123 = `123123` ``、list_model.md）。
  **再帰を確認、後置~の引数展開が未実装だったのを修正**：`type_system.md`§3.3の
  `sum : x ~xs ? x + (sum xs~)` を実行したところ無限再帰でスタックオーバーフローした。
  原因は後置~（`xs~`）が「配列を複数の位置引数へ展開する」という意味（pattern_guide.md
  「関数にListを渡すときは必ず後置~を使う」）を実装してなかったこと——`xs`という1個の
  配列値がそのまま1個の引数として渡り続け、restが空にならず終端しなかった。`apply`の
  引数収集時に後置~を検出して展開するよう修正して解消（`sum 1 2 3 = 6`を確認）。
  なお、この式は括弧が必須（`+`の優先順位13はスペース適用10より高いため、括弧無しの
  `x + sum xs~`だと`x`と`sum`（関数値そのもの）が直接結合されてしまう——`type_system.md`
  §3.3の例自体にこの括弧が欠けていたため、そちらにも追記済み）。
  **辞書リテラルが独立したスコープを持つよう修正**：全行が`define`のブロック（`[foo:1,
  bar:2]`改行形）は、以前は「ブロックの値＝最後の文の値」として評価してしまい、辞書
  オブジェクトにならず`foo`/`bar`が呼び出し元のenvへ漏れていた（`pass3.js`のDict判定と
  同じ基準：全行defineなら独立した子envで評価しJSオブジェクトとして返す、キーは漏れない）。
  **未定義識別子のUnit収束をinformation診断として記録**：`unit.md`§0.1「未定義識別子は
  `__`として評価される」を実装済み（`envGet`が例外を投げず`UNIT`にフォールバック）。加えて
  この収束が起きた箇所を`env.diagnostics`（ルートenvから子envへ共有される配列、`{level:
  "information", message, identifier}`）に記録するようにした。仮想キーワードとしての意図的な
  利用（`@lazy tick`等）を妨げないよう、warning/cautionへは格上げしない（`test/interpreter.test.js`
  で確認）。末尾位置での未定義識別子呼び出しをwarningにする規則（`tco.md`§3）はTCO解析が
  無い本インタプリタでは対象外。
  **`apply_reverse`の評価を追加**：`pass2.js`のtier=10マルチパス化と対で、`x f`（UFCS的な
  receiver記法）の評価が今まで未対応（`未対応の演算 'apply_reverse'`）だったのを実装した。
  `applyClosure(evaluate(f), [x])`——通常の`apply`と全く同じ`bindParams`経路（完全性公理・
  デフォルト引数フォールバック込み）を通すだけで、receiver専用の特別なロジックは無い
  （`f : [foo bar ~this] ? ...`のような構造体destructuringも通常呼び出しと同じ仕組みで
  解決される、という8/5の設計合意通り）。
  **左側は常に1個の値に制限（複数引数化しない）**：`apply`は後置~（expand）で渡された
  引数をList内容へ展開して複数の位置引数に分配するが、`apply_reverse`は同じ展開を行わない
  ——`[1 2]~ pair`（`pair:a b?a`）は`pair`に`[1,2]`を**1個の値**として渡すだけで、
  `pair(1,2)`のように展開されない（bが埋まらず完全性公理で`__`に収束、
  `test/interpreter.test.js`で確認）。8/5の設計合意「apply_reverseは複数引数を取らない」
  を反映。
  **ブラケット仮引数リスト（`[x ~xs]`等、list_model.md §2.4のEagerパターン）への単一
  List/Dict実引数の分割代入を実装**：以前は`bindParams`がブラケット形式か裸形式かを
  区別せず、渡された実引数を単純に位置順で束縛していたため、`sum_list : [x ~xs] ? ...`に
  `sum_list [1 2 3 4 5]`を渡すと（本来 x=1, xs=[2,3,4,5] に分割されるべきところ）List
  **全体**が最初の仮引数`x`にまるごと束縛され、restが常に空になって再帰が終端せず
  スタックオーバーフローしていた。同根の原因で`calc_diff : [foo bar ~obj] ? ...`への
  辞書渡し（キー名一致の自動バインド、function_guide.md「構造体メンバーの一致による
  自動バインディング」）も`__`に崩壊していた。
  `pass2.js`側に`isBracketParamList()`を追加し、`params`ノードへ`bracket: true/false`
  フラグを持たせるようにした（func_mixedのようにブラケットが定義行より深くインデントされ、
  grammarのTerm規則で1階層余分にラップされるケースも正しく判定——README「Lambda仮引数部
  の専用処理」参照）。裸の複数行デフォルト引数形式（`g:\n x\n y:x+1\n?...`）は`bracket:
  false`のままで、既存のstream/pull型の位置引数束縛を維持する（8/5の設計合意：ブラケット
  無しは参照ではなくストリームとして処理する）。
  `interpreter.js`の`bindParams`は、`bracket:true`かつ実引数がちょうど1個でList/Dict
  （非Lambda）なら`bindBracketParams`へ分岐する。Listは先頭から非restエントリへ位置的に
  配り、restエントリが残り全部をスライスで受け取る。Dictはエントリ名とキー名の一致で
  （順序に関わらず）値を引き、restエントリがあれば名前が一致しなかった残りのキーを
  まとめた新しいオブジェクトを渡す。`test/interpreter.test.js`で`sum_list [1 2 3 4 5]
  → 15`・`calc_diff`のキー順不同渡し`→ 80`・`pattern_guide.md`のStore例（`get_age dict
  → 20`）を確認、既存のList destructuring（`get_age [1 2 3] → 1`）・裸の複数引数
  （`f 3 5 → 8`）にも回帰なし。
  【`.st`/`.ist`への含み、8/5の設計合意】`bindBracketParams`が参照する`entries`の名前列挙は、
  将来`.st`生成（`type_system.md`§6.2「関数仮引数のフィールド要求」、`{x, y}`のような
  構造的フィールド要求集合）を実装する際、そのまま再利用できる想定で実装した。
  **match_caseを実装**：`function_guide.md`「`?`の右辺を改行・インデントブロックを挟むことで、
  本体内の`:`演算子はmatch_caseとなる」を実装した。以前は本体ブロック内の`cond : result`行
  （例: `x > 3 : x - y`）が、左辺が識別子でない普通の`define`ノードとしてAST上は正しく
  構築されていたが、`envDefine(env, undefined, ...)`という無意味な副作用を起こすだけで
  評価結果は捨てられ、ブロック評価は常に「最後の行の値」を返すだけだった（`func_mixed [5]`が
  `-1`ではなく`6`になっていた）。ブロック評価で、defineノードのうち左辺が識別子でない
  （＝実質的には条件式の）行を「条件:結果」の短絡評価テストとして扱うよう修正：条件を評価し
  非Unit（真）なら即座にその行の右辺を返してブロック全体を打ち切り、Unit（偽）なら束縛を
  一切行わず次の行へ進む。左辺が識別子の行は今まで通り変数定義として扱う。
  **副産物のバグ修正**：Dict判定（`node.lines.every(isDefineNode)`）が左辺の識別子チェックを
  していなかったため、フォールバック行の無いmatch_case連鎖（全行が`cond:result`）を
  Dictと誤判定して`line.left.value`（存在しない）にアクセスしクラッシュしうる状態だった
  ——`isIdentifierNode(l.left)`も要求するよう修正。
  `test/interpreter.test.js`で`func_mixed`（3パターン）・`pattern_guide.md`のEither例
  （3パターン、条件の短絡確認込み）・辞書リテラルの回帰なしを確認。
  **`'`（get_prop）を追加**：`d ' foo`のように、右辺が識別子の場合は変数として評価せず
  「キー名そのもの」として辞書から引く（数値なら通常通り評価してListのインデックスに使う）。
  **`push`/`unshift`（list_cheat_sheet.md「先頭/末尾に要素追加」）を実装**：評価ケース自体が
  無く「未対応の演算」で例外になっていた。`pass2.js`側の命名はJS配列メソッドとは意味が
  逆（優先度10.1の方向性は仕様に明記が無く実装時の仮定、`pass2.js`冒頭コメント参照）
  ——`push(a,b)`はb側がList（`0 [1 2 3]`）で「aを先頭へ」、`unshift(a,b)`はa側がList
  （`[1 2 3] 4`）で「bを末尾へ」。
  **`|list|`（abs、list_cheat_sheet.md「要素数の取得」）を実装**：`abs`ブロックとしては
  以前から正しくパースされていたが、評価側で長さ/絶対値の計算をしておらず中身がそのまま
  返っていた。List/Stringなら`.length`、数値なら`Math.abs`（絶対値とリスト要素数を
  同じ記号で表す設計、list_cheat_sheet.mdの命名がそのまま実装のヒントになった）。
  **`,`（product、n次元配列構築）の左右非対称バグを修正**：ASTは元から正しかったが
  （`1 2 3 , 4 5 6`は`product[[1,2,3]の塊, [4,5,6]の塊]`という綺麗な形）、評価が
  `[...asList(l), r]`（左だけ展開し右を1要素として追加）になっており`[1,2,3,[4,5,6]]`
  という非対称な結果になっていた。単純に`[l, r]`にすると、list_model.md §2.1の
  「`1,2,3,4,5`はスペース区切りと等価なフラットリスト」（`,`は左結合の連鎖）が壊れる
  （`product[product[1,2],3]`のような連鎖が展開されず深くネストしてしまう）ため、
  「左辺自身が同じproductノード（＝連鎖の続き）なら展開して連結、そうでなければ
  （スペースで構築済みの塊やリテラル単体なら）互いに対等な要素として2要素リストにする」
  という判定に修正（`test/interpreter.test.js`で両ケースを確認）。
  **List左辺の算術演算子（`*`/`^`/`/`、list_cheat_sheet.md「重複した要素の作成/リフト/分割」）
  を実装**：以前はList値がそのままScalar用の`ARITH_OPS`（JSの`*`/`^`/`/`演算子）に渡り、
  JSの配列→文字列強制変換で静かに`NaN`を返していた（例外にもならず、一見それらしい値も
  返らない、気付きにくいバグだった）。`evalArith`に`Array.isArray(l)`の分岐を追加し、
  `*`=repeat（`l`を`r`回連結）、`^`=lift（`l`のコピーを`r`個持ち上げる）、`/`=split
  （`l`を`r`個のグループへ均等分割）を実装。list_cheat_sheetに例が無いList左辺の
  `+`/`-`/`%`は、Stringの場合（§3.2）と同様に型エラーとして`__`へ収束する。
  **range（`[start ~ end]`・派生演算子`~+`等、list_model.md §2.3）を実装**：以前は
  "range"/"range_arithmetic"ノードの評価ケースが無く「未対応の演算」で例外になっていた。
  仕様上レンジ式の実体は常にイテレータ（`{start,step,end}`の固定サイズ構造体）だが、
  本インタプリタは値を全て実体化する単純な評価器のため、**3項セット**
  `[start 演算子 step 演算子 end]`（「即座に全消費」、例: `[2 ~+ 2 ~ 10] → [2 4 6 8 10]`）
  ・**単純形式**`[start ~ end]`（step省略、`start<=end`なら+1・降順なら-1、例:
  `[1 ~ 5] → [1 2 3 4 5]`）は配列へ即座に展開する。**2項指定**`[start ~+ step]`
  （終端なし、仕様上は終端の無いPull型無限ストリーム）は実体化のしようが無いため、
  無限ループにする代わりに明示的に未対応のエラーを投げる（`test/interpreter.test.js`で
  例外になることを確認）。`get_prop`（`'`）もrange（配列）を右辺に取れるよう拡張し、
  `[1 2 3 4] ' [1 ~ 3] → [2 3 4]`（範囲インデックスでの一括取得、list_cheat_sheet.md）
  を実装。
  **ポイントフリー記述（function_guide.md「任意のカッコで演算子を囲むことで関数として扱う」）
  を実装**：`[+]`（左右とも欠落）・`[+ 1]`（右辺だけ束縛）が全く機能していなかった
  ——縮約しきれず残った裸の中置演算子トークン（`"+"`という生の文字列）は`getCategory`に
  一度も拾われず常にAtom扱いで、`1 2 [+] 3 4`のような式は`+`を一度も呼ばずに静かに
  変な値を返していた。`pass2.js`の`reduceAll`終端に、縮約しきれず残った「演算子1個
  だけ」「演算子＋右オペランド1個（左辺無し）」を`partial:true`の中置演算ノードへ
  変換する処理を追加（`getCategory`の既存の`if (node.partial) return "Lambda"`則で
  自動的にLambda扱いになる）。`getCategory`のblock判定も、1行だけのbracket系ブロック
  （`[+]`はブロック{lines:[partialノード]}という形になる）なら中身のカテゴリを継承する
  よう修正（`unwrapSoloBlock`）。
  **複数引数の貪欲な畳み込み（`[+] 1 2 3 4 5 → 15`）に特例は要らない。** かつては
  `COPRODUCT_PHASES` に `extendPointfree` という旗を立て、`reduceOnce` が「基点が裸の
  ポイントフリー演算子なら右の Atom を取り込む」を直接処理していた。**構築が適用より
  内側**になった時点（c93ff2e）で、並んだ実引数が先に器になってから畳み込みへ渡るように
  なったので、旗も特例も消してある。`getCategory` 本体で「常に Lambda」にしてはいけない
  という点だけは変わらない——既に確定した計算結果（`[+](3)(4)`）がまた関数として呼ばれ
  ようとする（`1 2 [+] 3 4` で実際に踏んだ）。
  **ポイントフリー由来のLambdaはapply_reverse（Phase3）の対象から除外**（8/5の設計合意、
  演算子の種類を問わず一律）：ポイントフリーは常に前置適用（`[+ 1] 5`）という一つの
  呼び出し方だけを持ち、UFCS的なreceiver記法（`x f`）という別経路を重ねない——
  `isPointfreeLambda`でapply連鎖の根本まで遡って判定し、Phase3のmatch関数から除外する。
  `interpreter.js`側は`makePointfreeClosure`/`applyPointfree`を追加：`evaluate()`は
  `node.partial`なノードを見たら即座にクロージャ値として返す（算術演算のディスパッチへ
  素通りしてUnitに収束するのを防ぐ）。適用時は、両辺欠落なら`Array.reduce`で複数引数を
  畳み込み、右辺だけ束縛なら欠けている左辺を呼び出し引数で埋める（`combine`は
  `ARITH_OPS`/`COMPARE_OPS`両対応、後者は§4の真偽/値返却規則を再現）。
  `test/interpreter.test.js`で畳み込み・部分適用・合成連鎖の例（`documents/ja-jp/guide/
  example.sn`）・元凶だった`1 2 [+] 3 4`・apply_reverse除外の動作・既存のapply_reverse
  （`5 inc`系）や通常の多引数関数への回帰なしを確認。
  **既知の追加課題（未着手）**：後置`~`（expand）が単なる素通しの実装のため、`[1 2,3 4]~`
  のようなネストしたリストのフラット化（list_cheat_sheet.md「リストのフラット」）は
  1階層剥がれない（`[[1 2] [3 4]]`のまま）。`[1 2 3] ' -1`（負のインデックスで末尾要素を
  取得）も`get_prop`が負数を考慮しておらず未対応のまま（list_cheat_sheet.md「末尾要素の取得」）。
  **ポイントフリー記述の前置/後置版（`[!_]`＝前置否定、`[_!]`＝後置階乗、
  function_guide.md「前置演算子は`[<op>_]` 後置演算子は`[_<op>]`」）を実装**：`_`（hole）は
  `resolveDensity`で既に普通の前置/後置演算ノードのoperandとしてそのまま構造化されていた
  （中置と違い、ブラケットのアンラップも新規ノード形状も不要）——operandが直接holeの
  場合にその演算子ノードへ`partial:true`を付けるだけで、既存の`getCategory`のpartial判定に
  乗った。`interpreter.js`は前置/後置の単項演算ロジックを`evalUnaryOp(name, v)`として
  抽出し、通常の評価経路（`node.operand`を評価してから渡す）と`applyPointfree`のhole適用
  経路（呼び出し引数をそのまま`v`として渡す）の両方から共有する。`[!_] 2 < 3`は
  `2 < 3`という比較式全体を1引数として受け取ってから否定する（比較演算子の優先順位が
  スペース適用より高いため、`([!_] 2) < 3`ではなく`[!_] (2 < 3)`という意図通りの結合に
  なる、`test/interpreter.test.js`で確認）。中置と違いarityは常に1固定（holeは1個だけ）
  なので、Phase2の貪欲消費特例（`isBarePointfreeChainBase`）は対象外——通常のarity-1
  Lambdaと同じ経路で自然に飽和する。apply_reverse除外（`isPointfreeLambda`）は位置を
  問わず判定するため、前置/後置のポイントフリーにも変更無く適用される。
  **末尾カンマによる写像糖衣構文（`[* 2,]`＝map、`[< 3,]`＝select、function_guide.md
  「単項式の後ろに`,`を付けたポイントフリー記述は、そのすべてに適用される」）を実装**：
  `,`は右にオペランドが無い（末尾）ため通常のproduct縮約が素通りし、「演算子＋右辺1個＋
  末尾の裸`,`」という3要素が縮約しきれずに残っていた。`reduceAll`にこの形を拾う3番目の
  分岐を追加し、`pointfreeMap:true`フラグを立てる。複数の引数を貪欲に集める必要がある
  （`[* 2,] 1 2 3 4 5`は5個の位置引数すべてに適用される）ため、`isBarePointfreeChainBase`
  （Phase2専用の貪欲消費特例）の対象条件に`pointfreeMap`も追加した。`applyPointfree`は
  `pointfreeMap`なら`argValues`の各要素へ演算を適用し、結果からUnitを取り除いて返す——
  比較演算子（`[< 3,]`）は真の場合のみ値を返す（§4）ため、このUnit除去だけで「選択写像」
  （select、偽だった要素の除外）が自然に得られる（余積のUnit除去則と同型）。
  **ポイントフリーの比較演算子は、通常の中置比較と単位元の見方を変える（8/5の設計合意）**：
  `[< 3,] [1 2 3]~`が`[1,2]`ではなく`[3,2]`になっていた原因は、`combine`が`evalCompare`の
  §4規則「左辺が算術単位元(0/1)なら右辺、それ以外は左辺を返す」をそのまま再利用していた
  ことだった（`1 < 3`は素の中置比較でも既に`3`を返す——これはこれで正しい既存挙動）。
  「ポイントフリーはListのfold/map/filterが前提のため、単位元の見方も算術側(0/1)ではなく
  List側に移る」という指摘を受け、`combine`のCOMPARE_OPS分岐だけ「真なら常に左辺(要素)
  そのものを返す」という別規則に変更した（0/1の特殊扱いを外す）。fold/map/filterでは
  「元の要素を残す/捨てる」ことが目的であり、算術チェーンの「次に運ぶ値」を選ぶための
  §4規則とは目的が異なるため。`evalCompare`本体（通常の中置比較）は変更していない
  ——`1 < 3`は引き続き`3`を返す。`[< 3,] [1 2 3]~ → [1,2]`（list_cheat_sheet.md通り）を
  `test/interpreter.test.js`で確認。
  **List同士を後置~無しで並べたとき、静かにUnitへ収束するバグを修正**：`coproduct_resolver.md`
  §5.2-2「~なしのList同士の並置はマージせず、独立したAtom（2つの参照のリスト）として保たれる」
  の実装（`coproductReduce`）が、この「保たれる」を「そのまま未縮約で放置する」（`null`を
  返す）と誤って実装していた。`[1 2 3] [1 2 3]`のようにこの2項だけで行全体が構成される
  場合、`items.length !== 1`のまま`unresolved`へ落ち、評価側で静かに`__`へ収束していた
  （2次元配列にならず消えるバグ、johnnyさんの指摘で発覚）。`list_model.md`§2.2が明言する
  等価性「`[1 2] [3 4]` = `1 2 , 3 4`」に従い、`null`ではなくproduct（カンマ）と同じ
  ノードを返すよう修正——`[1 2] [3 4]`と`1 2 , 3 4`が完全に同じ結果になる
  （`test/interpreter.test.js`で確認、双方~のconcatや`sum_list`等の既存挙動に回帰なし）。
  **`~`（rest記法）の位置一般化（list_model.md §2.5、末尾・両端からの分割代入）を実装**：
  `><`（リスト反転）を導入するかの議論の中で、「リストを反転する専用演算子」ではなく
  「リストを末尾から辿るための分割代入パターン」の方が本質的に必要なものだった、という
  結論に至った（johnnyさんの発案）。`bindBracketParams`のList分割代入を、`~name`が
  entries内のどの位置にあってもよいよう一般化：`~name`より前の非restエントリは先頭から、
  後の非restエントリは**末尾から**順に対応し、`~name`自身はその間の残り全部を受け取る。
  `[x ~xs]`（従来通り先頭分割）・`[~head tail]`（末尾からのpop）・`[first ~mid last]`
  （両端からの分割代入）が同じロジックで自然に表現される。`test/interpreter.test.js`で、
  末尾からの再帰的な畳み込み（`sum_rev : [~head tail] ? head & (sum_rev head) + tail | tail`）
  がリスト反転無しで動くことを確認、`[x ~xs]`の既存挙動にも回帰なし。
  **`><`（リスト反転）を演算子テーブルから撤去**：上記の結論を受け、`documents/ja-jp/impl/
  syntax/operator_table.js`・`alpha/javascript/operator_table.js`の両方からtier23の`><`
  エントリを削除した（元々interpreter.js側の評価ケースも無く動いていなかった機能）。加えて
  `><`（`<>`の鏡像）は古いBASIC/Pascal/SQLで「等しくない」を表す記号として広く定着して
  おり、Signの「記号の自然な意味と操作的意味の一致」という設計原則にも反していた
  （そもそも「等しくない」はSignでは`!=`が既に担っている）ため、二重の理由で撤去が妥当と
  判断。`documents/ja-jp/guide/list_cheat_sheet.md`の「リストの反転」行も削除し、代わりに
  §2.5への参照と`reference.md`の再帰的な`reverse`関数の例を案内するノートを追加した。
  **`!=`（tier12）が一度もevalCompareへ到達しないバグを修正**：`test/pass2.test.js`が
  "x == y"のAST構築だけ確認して「動作確認済み」と誤認させていたが、実は`==`/`===`/`!==`/
  `!=`は評価層（`evaluate()`）では**一つも実装されていなかった**（`><`撤去の確認作業中に
  `1 != 2`が例外になることに気付いて発覚）。`!=`は`node.name`が"not_equal"で、tier8の
  `!==`と名前が衝突するため`COMPARE_OPS`にキーを持たせられず（既存の`.op`で区別する慣習、
  `test/pass3_param_usage.test.js`参照）、`if (COMPARE_OPS[node.name])`という外側の
  ディスパッチ判定だけでは`!=`が一生`evalCompare`に到達しなかった。`evalCompare`自体は
  既に`op === "!="`専用の分岐（§4の例外規則、`x != __ = x`単位元・`__ != x = __`吸収元）を
  持っていたため、ディスパッチ条件に`node.op === "!="`を追加するだけの狙い撃ちの修正で
  済んだ。`!==`（構造比較）・`==`・`===`は依然未実装のまま——スコープを広げず`!=`だけを
  直した（`test/interpreter.test.js`で§4の例外規則込みで確認）。
- `test/run.js` — テストランナー。`test/*.test.js` を列挙して1本ずつ別プロセスで実行し、
  ファイル数とケース数を集計する。落ちたテストだけ全出力を表示する。新しいテストは
  `test/` に `*.test.js` として置けばよく、ここへの登録は要らない。
- `test/parser.test.js` — パーサー単体の動作確認。`preprocess()` を通した入力が
  フラットなTerm列になること（コプロダクト、define、前置・後置の密着、`'`、`$`/`#`の非対称性）。
- `test/interpreter.test.js` — 評価器の動作確認。最大のテストで、演算子表の各欄・Unitの
  振る舞い・ポイントフリー・部分適用・分割代入・短絡評価・TCOなど、言語の挙動全般を見る。
- `test/sign_programs.test.js` — **`alpha/sign/` に置いた「Sign 自身で書いたプログラム」**
  （字句解析器・再帰下降パーサ）の動作確認。処理系の単体テストと違い、まとまった量の
  実プログラムが壊れていないかを見る（8-Queensと同じ役割）。実際この2本を書く過程で
  `pass2.js` の余積解決のバグが1件見つかった——`isListLike` が中身を見ずに括弧を全て
  List 扱いしていたため `` `x` (`y`) `` が construct ではなく push へ落ち、String の
  連結が起きなかった。同じ問題は8-Queensの時にも一度発覚して `isRealListValue` が
  作られていたが、`coproductReduce` の 10.1/10.2 判定だけ古い判定のまま残っていた。
- `test/compile.test.js` — `compile.js`（Pass 1〜3 の単一ドライバ）の動作確認。全ノードへの
  `atomType` 注釈、数値の昇格格子（識別子経由を含む）、算術族の型不一致、List左辺の算術、
  余積族、`&`/`|`、define/lambda/Dict判定、Pass 1b がパイプラインに載っていること。
- `test/pass2.test.js` — Pass2単体（envなし）の動作確認。
- `test/multi_arg_apply.test.js` — 多引数関数の呼び出しがapplyチェーンとして正しく飽和し、
  余分な引数がconstructでタプル化されることの確認。
- `test/pass3.test.js` — Pass3の型伝播（左辺優先ルール、String+算術演算子→Unit、リテラルからの
  atomType解決、List/Struct/Dictの区別）の動作確認。
- `test/pass3_param_usage.test.js` — 仮引数のatomType自動導出（本体の算術演算子・比較演算子
  使用箇所からのScalar逆算、`type_system.md`§7.1）の動作確認。
- `test/pass1b.test.js` — Pass1b（`@ref`ジェネリック仮引数の検出、呼び出しサイト収集、
  exportされたジェネリック関数に呼び出しサイトが無い場合のコンパイルエラー）の動作確認。
- `test/nested_scope.test.js` — Pass1+Pass2を通した、ブロックスコープの連鎖の動作確認。
- `test/multiline_block.test.js` — 複数行ブロックが1つのブロック内の複数文として正しく解決されることの確認。
- `test/bare_stream_param.test.js` — 裸のストリーム仮引数（括りの外の `~名前`、`f : x ~xs ?`・`f : ~this ?`・
  ブロックの `~xs` の行）を仮引数の並びを組む所で名指しで断ること（`bare-stream-param`、利用者の裁定 2026-10-04）と、
  括りの形（`[x ~xs]`・`[~xs]`）が通ることの確認。
- `test/question_row_indent.test.js` — `?` の行を定義の行から1段でない所に置く・仮引数の行を2段でない所に置く・
  複数の行に書いた括りの閉じの行に `?` を続けると前処理が名指しで断ること（`question-row-indent`、利用者の裁定
  2026-10-05）と、正しい字下げ（仮引数2段・`?` 1段・本体2段、1行の仮引数なら `?` の行は1段）が通ることの確認。
  綴りの表は `test/question_rows.js` の1つで、`test/preprocess_sn.test.js` も同じ表で JS と preprocess.sn の両方が
  断ることを見る。
- `test/param_list.test.js` — Lambda定義行の仮引数部（`params[]`）が総当たり縮約に誤って
  素通しされず、専用処理されることの確認（裸の複数仮引数・rest・ブラケット形式・
  インデントブロック形のデフォルト引数とlet*的な逐次スコープ）。
- `playground/` — ブラウザ上でソース→AST→評価結果を確認できる簡易UI（`node playground/serve.mjs`
  で起動、またはリポジトリルートの`install_alpha.ps1`/`sign_alpha_web.ps1`を使う——詳細は
  ルートの`README.md`「Playground」節を参照）。**見た目はpre-alpha期のplaygroundと
  同じデザイン言語（ガラス背景・Sign ロゴ・パネルカード、`playground.css`）に統一**しつつ、
  出力パネルはalphaの実態に合わせてResult/ASTの2分割、Templateドロップダウンもalphaで
  実際に動く機能だけで作り直した（2026-08-08）。**フォント（種別・サイズ・合字の有無）を
  選べるツールバーを追加**：Signは
  `~+`/`!=`/`<=`のような複合記号が多く、合字（ligature）でグリフが結合されると個々の記号が
  読み取りにくくなる場合があるため、合字はデフォルト無効（`font-variant-ligatures: none`）
  にしつつ、フォントによっては合字表示を見たい場合もあるためチェックボックスでON/OFFを
  選べるようにした。選択内容は`localStorage`に保存され、リロードをまたいで保持される。

## セットアップ

```
npm install
npm test                         # test/*.test.js を全て実行（件数は実行結果を見ること）
node test/pass2.test.js          # 個別に実行することもできる
npm run build:parser             # sign.pegjs から parser.js を生成（--format es、都度生成、コミット対象外）
```

`npm test`（`test/run.js`）は `test/` 配下の `*.test.js` を列挙して1本ずつ別プロセスで
実行し、最後にファイル数とケース数を集計する。落ちたテストだけ全出力を表示する。
テストは各自 `sign.pegjs` を peggy で都度ビルドしており（ビルド済み `parser.js` には
依存しない）グローバルな状態も持たないため、プロセスを分けても取りこぼしは無い。
**新しいテストは `test/` に `*.test.js` という名前で置けばよく、ランナーへの登録は要らない。**

## `grammar.pegjs`の根本修正（正式仕様ファイル自体を修正済み）

実装を進める中で、正式仕様`documents/ja-jp/impl/syntax/grammar.pegjs`自体に、**Blockが他の項と
同じExpression内に混在すると中身が漏れる**というバグを発見した。原因は`Term`/`Expression`/`Block`の
3箇所にまたがる「配列ラップの非対称性」で、以下の3点をセットで修正することで根本的に解消した
（`documents/ja-jp/impl/syntax/grammar.pegjs`本体・`alpha/javascript/sign.pegjs`の両方に反映済み）。

1. **`Term`**：`pre`/`post`が空でも、`core`が配列（Block）なら1階層ラップして返す
2. **`Expression`**：soloかどうかに関わらず常に`.flat()`する（以前はsolo時にスキップしていた）
3. **`Block`**：indent/abs系も`exprs`を`...`展開せず1要素として保持する（bracket系と対称に。
   以前はindent/abs系だけ`...exprs`と展開しており、bracket系より保護膜が1階層薄かった）

この修正により、単一行ブロックだけでなく複数行ブロックも正しく「1つのブロック内の複数文」として
解決されるようになった（`test/multiline_block.test.js`で確認—以前は単一行ブロックがたまたま
正しく見えていただけで、複数行ブロックは誤解釈されていた可能性がある、未検証のまま埋もれていた懸念だった）。

以前このファイルにあった`repairLeakedBlocks()`という対症療法的な回避策（漏れたマーカーを
検出して復元する）は、この根本修正により不要になり撤去済み。`resolveBlock`も新しい一貫した
構造（bracket系: `term`がそのまま`exprs`、indent/abs系: `term[1]`が`exprs`）に合わせて書き直した。

## 現状（動作確認済み）

**Pass2（`coproduct_resolver.md`実装）**：9/9 pass。フラットなTerm列を二分木ASTへ縮約する。

- Shunting Yard（`operator_table.js`の優先順位1〜26に基づく演算子の結合。tier26=escapeから
  tier1=exportまで高い方から処理）
- Lambda/Atomカテゴリの判定（`getCategory`）とcompose/apply/apply_reverse/concatの優先度
  10.5〜10.0での総当たり縮約（`coproduct_resolver.md`§3-4）
- List/Structの`~`必須マージルール（`coproduct_resolver.md`§5）
- 裸のストリーム仮引数（括りの外の `~名前`、`x ~xs ? ...`）を仮引数の並びを組む所で名指しで拒否
  （`OperationError`、`bare-stream-param`、利用者の裁定 2026-10-04、`test/bare_stream_param.test.js`で確認）。
  器は括り（`[x ~xs] ? ...`・`[~xs] ? ...`）で受ける
- `$expr → Atom(Address)` / `@expr → 参照先の圏を継承`（`type_system.md`§2）を踏まえた、
  `$`/`@`の意味論的な扱い
- 実例：`1+2*3`の優先順位、`f : x ? x + 1`のdefine/lambdaネスト、`$[array ' 0] # 3`の
  非対称性、GetLeft、比較演算子・構造比較（`==`）

**Pass1（ブロック階層に沿ったスコープ連鎖）**：実測確認済み。`getCategory`が必要とする識別子環境（env）を、
ブロック階層（`grammar.pegjs`が既にネストさせてくれる構造）に沿って`{ bindings: Map, parent: env|null }`という
連鎖で構築する。各ブロック（`[...]` `{...}` `(...)`やインデントブロック）に入るたびに
`pass2.js`の`resolveBlock`が子スコープ（親=呼び出し時のenv）を自動生成するため、外側スコープの
識別子は常に内側のブロックから参照できる（`test/nested_scope.test.js`で実測確認済み）。

`g : x ? x + 1` を外側で定義し、`f : y ? \x02g y\x03`（インデントブロック内で`g y`を呼ぶ）という
ソースで、内側ブロックから`g`が`apply[g, y]`として正しく解決されることを確認済み。

### ブロックスコープの設計根拠（`execution_model.md`/`tco.md`との整合）

- **ファイル単位スコープ vs main.sn統括**は、`execution_model.md`が既に「Signの全関数は`main.sn`の内部関数として静的展開される」と明言しているため、**main.sn統括で既に決着済み**（ファイルごとの独立した名前空間は存在しない、`` `add.sn`@~ `` はファイル読み込みではなく内部関数の静的定義）
- **ストレージ/寿命の面はTCOによってほぼスタックポインタの挙動整理だけで説明できる**：末尾再帰は`JMP`に変換され深さO(1)に収束し、レンジ式は`LOOP`/`JNZ`に直接変換されスタックを使わない。部分適用クロージャの`alloca`も「静的サイズの単一mainアリーナ」（`tco.md`§8.2、実験的提案）に収まる。例外は**末尾位置でない再帰**だけで、ここは本物の`CALL`/`RET`で動的にスタックが伸びる（言語仕様上エラーにはしていない、warningで議論中）
- この上で残っているのは**名前解決（シャドーイングルール、可視性）**の面で、こちらはスタックポインタとは独立なコンパイル時シンボルテーブルの話であり、今回実装した`pass1.js`の連鎖envはまさにこの面を担う

### Pass1の既知の制限

- スコープ検査（未定義識別子の参照エラー等）は一切行っていない。
- 同一スコープ内での再定義は後勝ちで単純に上書きする。
- 本来のPass1（`compiler_pipeline.md`）が持つべき`.ist`（`type_system.md`§5 Pass1a）は
  `{ category, restParam }`という一部分のみを先取り実装済み（`restParam`は仮引数列の
  `~xs`がブラケット内かを見て`'bracket'|null`を判定、Pass 4 で使用。裸の`~xs`は2026-10-04に廃止——Pass2が断る）。
  `arity`・`atom_type`・`callsites`（Pass1b、`@ref`のジェネリック具体化）・export印（`#`/`##`/`###`）は未実装。

## Lambda仮引数部の専用処理（`params[]`ノード、デフォルト引数対応）

`:`(define, precedence=1)と`?`(lambda, precedence=2)は演算子テーブル上もっとも低い優先度で
処理されるため、仮引数部をそのまま総当たり縮約に素通しすると、`?`が実際に処理される**前**に
仮引数部の中身が既存の汎用ルールで誤って確定してしまう問題があった
（`g x` → `construct[g,x]`、`y : x + 1` → `define[y, add[x,1]]`——どちらも「仮引数の宣言」を
「値の式」と誤解決していた）。

`reduceAll`（pass2.js）に、行の中にトップレベルの`?`があれば仮引数部を先に切り出す分岐
（`resolveLambdaLine` / `buildParameterList`）を追加し、以下を実装した。

- 裸の複数仮引数（`g x`）・ブラケット形式（`[x ~xs]`、1行に
  複数の裸パラメータが同居するケース含む）が、`params[]`という専用ノードとして正しく構造化される
- インデントブロック形のデフォルト引数（`function_guide.md`の`y : x + 1`構文）が、`define`文と
  誤解釈されずに「デフォルト式」として解決される
- デフォルト式はlet*的な逐次スコープ（自分より前に束縛済みのパラメータ + 外側スコープのみ参照可能、
  `test/param_list.test.js`で確認）に従う（例: `z : y + 1`が直前の`y`を正しく参照する）
- 単一の裸パラメータ（デフォルト・rest無し、例: `f : x ? x + 1`）は既存の出力形状
  （`identifier(<x>)`単体）を保つよう後方互換を維持している
- ブラケットを仮引数リストの定義行より深くインデントして複数行で書く形式（`func_mixed`例）は、
  grammarのTerm規則（単独のブロックcoreは1階層ラップされる）により仮引数部が余分に入れ子に
  なるため、`flattenParamStatements`で再帰的にラップを剥がして実際のパラメータ行の並びに
  正規化している

- let*的な逐次スコープは、後ろ（または自分自身）の未束縛パラメータへのデフォルト式からの
  参照を`ReferenceError`として拒否する（7月30日の設計スレッドが意図した「通常の未定義識別子
  エラーとしてPass1で弾ける」という設計の実装。`test/param_list.test.js`で確認）
- デフォルト・rest以外の仮引数の数（`requiredArity`）を`params[]`ノードに構造だけから機械的に
  計算して持たせている（値の評価は不要、`function_guide.md`「関数適用時」節のアリティ計算の
  静的な下ごしらえ）

**未実装（`.ist`/`.st`）関連の既知の限界**：

- **本物のインタプリタ・評価器が存在しない**。デフォルト引数を持つ関数のアリティ計算からの
  除外・`__`渡し時のデフォルト値フォールバックといった`function_guide.md`「関数適用時」節の
  意味論は、値を実際に評価しないと確認できないため未実装（`requiredArity`はその静的な
  下ごしらえのみ）
- 裸形式（ブラケット・インデントブロックで囲まれていない）でのデフォルト式は現行仕様に例が
  無いため未対応（`splitBareParamTokens`はrestのみ扱う）
- ブラケット形式とデフォルト引数を組み合わせた複数行の例（`function_guide.md`の`func_mixed`）は
  `flattenParamStatements`（Termの配列ラップを再帰的に剥がす）と`lexer.js`のブラケット深さ
  追跡により解決済み（`test/param_list.test.js`で確認）

## Pass3: 型伝播（`type_system.md`§2〜§3.2）

`pass3.js`が`inferAtomType(node, env)`を実装する。Pass2が返す二分木ASTのノードを受け取り、
Layer 2 Atom内部型（`Address`/`Float`/`String`/`List`/`Unit`等）を推論する。

- **左辺優先ルール**（§3.2）：`typeof(L op R) = typeof(L)`。中置演算ノードは左辺の型を
  再帰的に推論してそのまま結果とする。
- **`String`+算術演算子の例外**（§3.2 NOTE）：左辺が`String`のとき算術演算子（`+ - * / % ^`）が
  来ると、リストに対して算術は効かないため型エラーとして`Unit`に収束する
  （例: `` `123` + 0 → Unit``）。
- **リテラルからのatomType解決**：数値リテラルは小数点の有無で`Address`/`Float`を判定、文字列・
  文字リテラルは`String`、`__`は`Unit`とする。
- **識別子のatomType解決**：`pass1.js`の`buildEnvScope`が`<id> : <リテラル1個>`という最も単純な
  定義行から静的に読み取ったものだけを解決できる（`test/pass3.test.js`で確認）。
- **仮引数のatomType自動導出**（`inferLambdaParamTypes`、`type_system.md`§7.1）：仮引数自身は
  `<id> : expr`という定義行を持たないため、本体の算術演算子（`+ - * / % ^`）・比較演算子
  （`< <= = >= > !=`、§4）使用箇所（左辺・右辺どちらも）から`Scalar`と逆算する。最初に
  見つかった制約を採用する単純な線形スキャンで、HM流の単一化は行わない
  （`test/pass3_param_usage.test.js`で確認）。
  - 比較演算子は`node.name`ではなく`node.op`（記号）で判定する：`!=`（§4対象、precedence 12）と
    `!==`（構造比較、precedence 8）は`name`が両方"not_equal"で衝突するため。`==`/`===`/`!==`は
    Scalarに限定されない構造比較（§4 NOTE）なので逆算の対象外。
- **List/Struct/Dictの区別**（type_system.md §2、list_model.md）：
  - スペース（余積）でAtom同士が結合された演算（`construct`/`concat`/`push`/`unshift`）は`List`。
  - カンマ（`product`、直積）で結合された要素列は、全要素が`define`（key:val）なら`Dict`、
    そうでなければ`Struct`（`1, 2, 3`のような多相リスト/直積構造、type_system.md §2の例）。
  - 単一の`key:val`（`define`）1個だけの場合も`Dict`とする（例: `[foo:1]`）。
  - 複数行のブロックで全行が`define`なら`Dict`（`list_model.md`§5.3・`pattern_guide.md`の
    改行区切り辞書リテラルの形）。それ以外の複数行（関数本体等）は、Dict化せず「ブロックの値＝
    最後の文の値」という通常のブロック式のセマンティクスにフォールバックする
    （`test/pass3.test.js`で確認）。
  - **カンマと`:`を1行に混在させる形（例: `[foo:1, bar:2]`）は意図的に非対応**。
    `list_model.md`/`pattern_guide.md`の辞書リテラル例はすべて改行区切りで、この形は
    ドキュメントのどこにも登場しない。「一つのことを表現する方法は一つ」の方針により、
    辞書は改行区切りの形だけをサポートする（一時的にトップレベルの`,`を先に分割して
    この形も動くようにする修正を入れたが、未定義入力への対症療法だったため撤去した）。

**既知の制限**：

- 仮引数のatomType逆算は算術演算子・比較演算子（`< <= = >= > !=`）のみ対応。`'`（get_prop）等、
  他の演算子からの逆算は未対応。
- 逆算結果は`Scalar`という抽象カテゴリまでで、具体的な`Address`/`Float`の区別までは決まらない
  （§4の`+`/`-`シグネチャ自体が`Scalar`までしか要求しないため）。
- 比較演算子・空間演算子（余積）等、算術演算子以外は一律で左辺優先ルールにフォールバックしており、
  §4の個別の型シグネチャとの細かい整合は未検証。
- `.st`生成・実際のコード生成（Pass4）は未実装のまま。

## Pass1b: `@ref`ジェネリック仮引数の具体化（`type_system.md`§5）

`pass1b.js`が`specializeGenericParams(defineNode, resolvedNodes, env)`を実装する。

- **ジェネリック仮引数の検出**（`detectGenericParams`）：本体で`@`前置演算子が直接かかっている
  仮引数（例: `apply_five : f ? @f 5`の`f`）は、参照先がLambdaかAtomか定義サイト単体では
  決まらないため、ジェネリックとみなす。
- **呼び出しサイトの収集**（`collectCallsites`）：プログラム全体の解決済みASTを走査し、
  `fnName`へのapply連鎖（`apply[apply[...[fnName, a1], a2], ...an]`、多引数呼び出し）を
  根本まで遡って、各呼び出しサイトを「位置順の実引数ノード配列」として集める。
- **具体化**：ジェネリック仮引数の宣言順の位置に対応する実引数だけを各サイトから選び、
  `pass2.js`の`getCategory`でカテゴリ分けして、観測されたカテゴリの集合を返す
  （`test/pass1b.test.js`で確認）。
- **exportされたジェネリック関数に呼び出しサイトが無い場合はコンパイルエラー**（§5、
  `compiler_pipeline.md`§6.3）：`defineNode.exported`（前置export記号、`pass1.js`/`pass2.js`
  が検出）が真かつ呼び出しサイトが0件なら`TypeError`を投げる。exportされていなければ
  デッドコードとして単純に discard（空の結果を返すのみ、エラーにしない）。

**8/6修正：多引数関数のジェネリック仮引数の位置対応**：以前は`collectCallsites`が
`apply[fnName, arg]`という単一階層しか見ておらず、多引数呼び出し（`g 10 $inc` →
`apply[apply[g,10],$inc]`というapply連鎖）では常に**最初の引数だけ**が拾われていた
——ジェネリック仮引数が2番目以降の位置にある場合、正しい実引数が一度も収集されて
いなかった（例えば`g : x ref ? x + @ref 5`の`ref`（2番目）を呼び出しサイト`g 10 $inc`
から具体化しようとすると、誤って`x`の実引数(10)がrefの実引数として扱われていた）。
`collectApplyChain`（pass2.js/interpreter.jsの同名ロジックと同じ）でapply連鎖を根本まで
遡り、各サイトを位置順の実引数配列として返すよう修正。`specializeGenericParams`は
ジェネリック仮引数の宣言順インデックスで対応する実引数だけを選ぶ（`test/pass1b.test.js`
で2引数・3引数の呼び出しサイトが正しい位置順で収集されることを確認、既存の単一引数
ケースにも回帰なし）。

**現状の実装範囲・既知の制限**：

- 呼び出しサイトの収集は、`compiler_pipeline.md`§6が定義する「debugビルドで`test`フォルダを
  実行して得るトレース」ではなく、**`src`（プログラム全体の解決済みAST）に対する静的走査のみ**
  で行う（テストフォルダを実行するインタプリタ自体がまだ存在しないため）。
- 相互再帰するジェネリック関数同士の具体化（§5「本節は将来の検討事項」）は未対応。
- 非Lambdaの単純なexport定義（例: `#add : [+]`）は、`?`が無いため汎用の縮約経路を通り、
  export記号が`define`ノードの`exported`フィールドではなく、`left`側の前置演算ノード
  （`export_internal(...)`等）として現れる（Lambda定義のexportとAST形状が異なる）。
  ただし`env`のBinding（`pass1.js`）は両ケースとも`exported`フィールドで統一的に引ける。

## 逆適用（`x f`）を糖衣構文へ（2026-08-16、`coproduct_resolver.md` §3.1）

`apply_reverse` という固有ノードを廃止し、Pass 2 が左右を入れ替えた**通常の `apply`**
へ展開するようにした。`interpreter.js` の専用 case は削除。適用の意味論は1つになった。

**動機**: 固有ノードである限り、`apply` へ足した機能が逆適用へ届かない取りこぼしが
構造的に起きる。実際に2件起きていた。

| | 従来 | 現在 |
|---|---|---|
| `(5 add) 3`（`add : a b ? a + b`） | **3** | **8** |
| `(n - 1) down` の10万段末尾再帰 | **スタック溢れ** | 0 |

前者が silently-wrong だった。`5 add` は静的な部分適用の印付け（`markUndersaturatedApplies`）
の対象外で、実行時に `applyClosure(f, [x])` を直接呼ぶため引数不足で完全性公理により `__`
へ潰れる。その `__` に 3 を余積で並べると左単位元で 3 になる。後者は TCO の `TailCall`
検出が `name === "apply"` しか見ていなかったため。Sign はループ構文を持たず反復手段が
再帰しかないので、これは表現力に直結する。どちらも糖衣化で自動的に解消した。

**receiver は1オブジェクトとして数えられるものに限る**: 完全に `f x` と同一視はしない。
後置 `~` を receiver に書くのは**構文エラー**にした。`~` は List を複数の位置引数へ
展開する指示であって、数えられる1つの値ではない。`x~ f` と書いた側が「receiver を1個」
のつもりか「複数引数へ展開」のつもりかは静的に確定できないため原理4で弾く
（`f x~` は前置適用なので従来通り通る）。これは以前 `apply_reverse` の評価が
`evalArgValues` を経由しないという**実行時**の制約だったものを、静的な拒否へ移したもの。

**残るもの**: 10.3（`Atom × Lambda`）という解決規則自体は規範に残る——空白がどの縮約へ
落ちるかはカテゴリ対でしか決まらない。ポイントフリー除外（`isPointfreeLambda`）も
Pass 2 の解決規則なので変更なし。`1 2 [+] 3 4` → `[1 2 7]` は回帰なし。

詳細は [`docs/apply_reverse.md`](docs/apply_reverse.md)。

## `!=` は連鎖比較から除外（2026-08-13、`comparison.md` §4.3）

`!=` の連鎖（`a != b != c`）を**構文エラーにした**。連鎖の `!=` だけ二項と挙動が
揃っていないという保留事項があったが、原因は Unit の扱いではなく**推移性**だった。

§4 の連鎖が「中央の項を取り出す」という形で意味を持つのは、隣接ペアの真偽が単一の
関係へ畳めるからである。`5 < 7 < 10` は「7 が 5 と 10 の間にある」というひとつの命題で、
`5 < 10` も導ける。連鎖可能な `<` `<=` `=` `>=` `>` はいずれも推移的でこれが常に成立する。

`!=` は推移的でない。`3 != 5` かつ `5 != 3` は両方真だが `3 != 3` は偽——つまり
`3 != 5 != 3` は「隣接ペアが全て真」を満たす。これを「3項が相異なる」と読んだ書き手は
黙って誤った結果を得る。畳めない以上、中央の項に「両端との関係」という意味を与えられず、
連鎖の目的そのものが成立しない。書き手の意図が静的に確定できないので原理4により弾く。

**実装上の注意**: `CHAIN_COMPARE_OPS` から `!=` を単に外すと連鎖と検出されず、左結合の
二項（`(3 != 5) != 7` → 3）として**黙って値を返してしまう**。そのため集合には残したまま、
`NON_TRANSITIVE_CHAIN_OPS` で検出後に弾いている。これに伴い `interpreter.js` の
`chain_compare` から `!=` 専用分岐と `shortCircuits` フラグが消え、連鎖の継続の規則は
例外なしの一本になった。二項の `!=` は従来通り（`3 != 5` → 3、`__ != 5` → 5）。

## 型システム着工前の挙動監査で見つかった6件の修正（2026-08-08）

型システム（Pass3の本格実装）に着手する前段として、現状の挙動を仕様書と突き合わせて
総ざらいした際に見つかった「静かに間違っている」挙動をまとめて修正した。

### 1. Layer 1 識別子カテゴリ = 右辺式のカテゴリ（`type_system.md` §2）

`pass1.js`の`buildEnvScope`は識別子のLambda/Atomを「その定義行にトップレベルの`?`が
あるか」だけで決めていた。これは`type_system.md` §5 Pass 1aの擬似コード
（`if expr contains '?' at top level`）には忠実だが、**同じ仕様書の §2 の表と矛盾している**
——§2は`[+ 2]`（部分操作のブラケット）をLambdaと定め、§3.1はLambda∘Lambda（compose）を
Lambdaと定めている。その結果、直書きなら動く式が名前に束縛した途端に壊れていた：

```sign
[+ 1] 3        ` → 4   （動く）
inc : [+ 1]
inc 3          ` → [<pointfree> 3]   ← concatに解決されていた
h : f g
h 3            ` → [<compose> 3]     ← 同上
k : f
k 3            ` → [<lambda> 3]      ← 単なるエイリアスすら壊れる
```

**修正方針**: カテゴリは「右辺式のカテゴリ」とする。ただし右辺のカテゴリはトークン列の
ままでは判定できず（縮約後のノードに対する`pass2.js`の`getCategory`が唯一の判定器）、
かつ`pass1.js`は`pass2.js`をimportできない（循環）。そこで**遅延解決**にした：
`pass1.js`は右辺のトークン列を`binding.rhsTokens`として持たせるだけにとどめ、
`pass2.js`の`resolveBindingCategory()`が**最初に参照されたときに一度だけ**縮約して
`getCategory`にかけ、結果を束縛へメモ化する。遅延なので行順に依存せず、Pass1aの
「前方参照を含む全識別子の構造型が確定する」性質は保たれる。自己参照・相互参照は
解決中フラグで打ち切ってAtomに倒す。

カテゴリがLambdaになった場合は`resolveKnownArity`で**残りアリティも引き継ぐ**
（`k : f`のエイリアスや`g : f 1`の部分適用が、あと何個引数を取れるかを知るため）。
また`isBarePointfreeChainBase`/`isPointfreeLambda`に`derefBoundNode`を挟み、
`add : [+]`のように**名前を経由したポイントフリー**も貪欲消費の対象になるようにした
（`type_system.md` §6.1の`#add : [+]` → `add 1 2` = 3）。

> **仕様側の宿題**: `type_system.md` §5 Pass 1a の擬似コードは §2 の表と食い違ったまま
> なので、「識別子のカテゴリ = 右辺式のカテゴリ（`?` / 部分操作のブラケット / `[f]` /
> compose / エイリアス / 未飽和適用）」へ書き換えるべき。

### 2. 前置export記号つきの非ラムダ定義が束縛されていなかった

`#pi : 3`と書くと`pi`が**未定義**になっていた。`resolveLambdaLine`だけが`#`を剥がして
`define.exported`へ畳んでおり、非ラムダのdefineは総当たり縮約に素通しされて
`define(export_internal(<pi>), 3)`という形のまま残る。`interpreter.js`のdefineは
leftを識別子atomと決め打ちして`node.left.value`を読むため、`undefined`をキーに束縛
されていた。`reduceAll`の入口でラムダ側と同じく記号を剥がすようにして、defineノードの
形をラムダ/非ラムダで揃えた。

`type_system.md` §6.1の`#add : [+]`は上記1と合わせ技で完全に死んでおり、
**import成功時のはずのコードが、同§が「import失敗時の壊れ方」として挙げている
`[1 2]`をそのまま出していた**。

### 3. 空リスト`[]`がパースできなかった

`grammar.pegjs`の`Expressions`が1個以上の`Expression`を要求するため、`[]`/`{}`/`()`が
構文エラーになっていた。`unit.md`の「`__ = []`（空リストと等価）」が書けないということで、
`guide/example.sn`は37行目の`unit : none : []`で丸ごとパース不能だった。非空の選択肢の
**後ろ**に空専用の選択肢を追加（PEGは順序付き選択なので既存の解釈順は不変）。
正式仕様の`documents/ja-jp/impl/syntax/grammar.pegjs`にも同時反映済み。
`interpreter.js`側では空ブロックを`[]`（空配列）として評価する——`isUnit([])`が真なので
Unit判定を要求する箇所ではUnitとして振る舞いつつ、`|[]|`が0になる等の「リストとしての」
性質も保てる。

### 4. 三項連鎖比較（ChainCompare、`comparison.md` §4）が未実装

`5 < 7 < 10`が7ではなく5になっていた。専用ASTノードが無く単なる左結合だったため、
1段目の`5 < 7`が§2.1の「左辺が算術単位元(0/1)なら右辺」規則を先に食ってしまう
（`1 < 3 < 5` → 3 は、たまたま左辺が単位元1だったので**偶然**合っていただけ）。

`reduceOnce`のtier12（比較）縮約時に「隣り合う2つの比較演算子」を検出して
`chain_compare`ノードへまとめる。この時点なら、より高い優先順位の演算子は既にノードへ
畳まれ、より低い優先順位の演算子（`&`等）はまだ裸のトークンとして残っているため、
`x < 3 & y > 4`の`<`と`>`は隣り合わず連鎖と誤認しない。§4.1通り、異種演算子の連鎖
（`1 < 2 > 0`）は構文エラー。4項以上は§4が定義していないため明示的にエラーにする
（黙って誤った値を返さない）。構造比較の`==`/`!==`は§2.1が明示的に適用外としているため
連鎖の対象に含めない。

### 5. `!__`がJSの`true`を返していた

Signの値ドメインに真偽値は存在しないのに、JSのbooleanが漏れていた
（`|!__|` → 1 なのに `(!__) == 1` → `__` という不整合つき）。
`categorical_truth.md` §6は明示的に「`!__`に`1`を割り当てるとBoolean型を暗黙に再導入
することになり設計原則と矛盾する」と禁じており、返すべきは**Id射**（SKIのKコンビネータ、
引数をそのまま返す恒等射）である。専用の`IDENTITY`値を導入し、`applyClosure`が
これへの適用を「引数の素通し」として扱うようにした。`getCategory`も`!<Unit>`を
Lambdaに分類する（そうしないと`!__ 5`がapplyに解決されない）。

`guide/operator_table.md` 141〜149行目が挙げる4つの等式が実際に成立することを確認：
`!__ != __` / `!__ !== __` / `__ 5 == !__ 5` / `5 __ == 5 !__`。
後ろ2つのために、**余積の単位元則**（§6.1「関数の位置の`__`は引数を素通しにする」）も
concatで実装した——`__ 5`が`[5]`ではなく`5`になる（2項以上の`__ 1 2` → `[1 2]`は
左結合で畳まれるため§6.1の輸入失敗例のまま変わらない）。同じ理屈で`applyClosure`は
**Unitの呼び出し先をクラッシュではなく素通しにする**（`unit.md` §0.1「未定義識別子は
Unitへ収束、実行は止めない」）。

副次的に、Lambda値がJSの型強制で算術/absへ漏れる穴（`x : !__` → `x + 1`が
`"[object Object]1"`、`|!__|`が`NaN`）も、String/Listと同じ型エラー扱い（`__`収束）で塞いだ。

### 6. `!=`だけ返値選択が左辺固定だった

`comparison.md` §1は`!=`を「§2.1の返値選択規則が適用される比較演算子」として列挙して
おり、§2.1が適用外と明示しているのは構造比較の`==`/`!==`だけ。`0 != 5`は5を返すべき
ところ0を返していた（`< > <= >= =`は元々正しかった）。

---

## `pass2.js`実装時に置いた仮定（仕様に明記なし、要レビュー）

1. 複数の前置/後置演算子が連続する場合（例: `!$x`）の結合順序：coreに近い方から先に結合する
   （`!$x` = `!($x)`）という一般的な慣習を採用。
2. 優先度10.1（Unshift/push）の具体的な演算子名：仕様は「Atom|List~ の組み合わせ」としか
   書いておらず方向性の区別が明記されていない。List~側が右ならpush、左ならunshiftとした。
3. Block（`[...]` `{...}` `(...)`）の種別（paren/brace/bracket）：`grammar.pegjs`側で
   区別を保持しないため、AST上でも区別できていない（kindは"paren"固定、indent/absのみ判別）。

## 未解決・要確認の疑問点（過去分）

1. `~rest`末尾固定の検証、デフォルト式のスコープチェック（n番目・後ろからm番目等の拡張パターンマッチ含む）は将来の別issue。
2. `LanguageServer/`は現段階ではコンパイラパイプラインを実装しない方針のため、`server.js`への
   前処理・新文法の統合は行っていない（`sign.v0.pegjs`ベースのまま）。
