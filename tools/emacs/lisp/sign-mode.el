;;; sign-mode.el --- Major mode for Sign programming language

(defgroup sign nil
  "Sign language support."
  :group 'languages)

(defcustom sign-tab-width 4
  "Sign言語でのタブの表示幅。言語仕様によりインデントはタブ文字に固定されます。"
  :type 'integer
  :group 'sign)

;; ---------------------------------------------------------
;; 1. ハイライト（色付け）のルール定義
;; ---------------------------------------------------------
(defvar sign-font-lock-keywords
  `(
    ;; 【文字列 (VS Codeのオレンジ色)】
    ;; まず、すべての ` 〜 ` (または行末まで) を文字列リテラルとして色付け
    ("`[^`\n]*`?" 0 font-lock-string-face t)

    ;; 【コメント (VS Codeの緑色)】
    ;; string_and_comment.md §2: 行頭のバッククォートは、閉じの直後が後置演算子
    ;; （@ ~ !）か空白のときだけ式になる。それ以外はすべてコメントである。
    ;; 同じ規則が alpha/javascript/sign.pegjs, documents/{ja-jp,en-us}/impl/syntax/
    ;; grammar.pegjs, documents/{ja-jp,en-us}/guide/string_and_comment.md,
    ;; tools/vscode/syntaxes/sign.tmLanguage.json にもある——直すときは全部直す。
    ;;
    ;; Emacs の正規表現には先読みが無いので、否定を展開して書く：
    ;;   閉じない | 閉じて行末 | 閉じて直後が @ ~ ! 空白 のいずれでもない
    ;; インデント後のバッククォート（ドキュメント文字列）は §3 の通り文字列だが、
    ;; 事実上コメントとして働くので、ここでは今までどおりコメント色で上書きする。
    ("^[ \t]*\\(`[^`\n]*\\(?:`\\(?:[^@~! \n][^\n]*\\)?\\)?\\)$" 1 font-lock-comment-face t)

    ;; 【エスケープ文字リテラル】
    ;; \ (バックスラッシュ) とその直後の1文字
    ("\\\\." . font-lock-string-face)

    ;; 【境界・メタ・アクセス系演算子】 (目立たせる)
    (,(regexp-opt '("###" "##" "#" "@" "$" "'")) . font-lock-keyword-face)
    
    ;; 【束縛・関数定義系演算子】 (関数名などの色)
    (,(regexp-opt '(":" "?")) . font-lock-function-name-face)

    ;; 【リスト構築・展開・範囲系演算子】 (型などの色)
    (,(regexp-opt '("~^" "~/" "~*" "~-" "~+" "~" ",")) . font-lock-type-face)

    ;; 【比較演算子】
    (,(regexp-opt '("==" "=" "<=" ">=" "<" ">" "!=")) . font-lock-builtin-face)

    ;; 【論理・ビット演算子】
    (,(regexp-opt '("||" "&&" ";;" "!!" "|" "&" ";" "!")) . font-lock-builtin-face)

    ;; 【算術・シフト演算子】
    (,(regexp-opt '("<<" ">>" "+" "-" "*" "/" "%" "^")) . font-lock-constant-face)

    ;; 【特殊な値 (Unit)】
    ;; 単語の境界にある _ のみ
    ("\\_<_\\_>" . font-lock-constant-face)
    )
  "Highlighting rules for `sign-mode'.")

;; ---------------------------------------------------------
;; 2. 文字と記号の構文ルール（Syntax Table）
;; ---------------------------------------------------------
(defvar sign-mode-syntax-table
  (let ((st (make-syntax-table)))
    (modify-syntax-entry ?\( "()" st)
    (modify-syntax-entry ?\) ")(" st)
    (modify-syntax-entry ?\{ "(}" st)
    (modify-syntax-entry ?\} "){" st)
    (modify-syntax-entry ?\[ "(]" st)
    (modify-syntax-entry ?\] ")[" st)
    
    ;; バッククォートは単なる記号として扱い、色付けは上の font-lock ルールに任せる
    (modify-syntax-entry ?\` "." st)
    st)
  "Syntax table for `sign-mode'.")

;; ---------------------------------------------------------
;; 3. 空白・タブの可視化設定
;; ---------------------------------------------------------
(defun sign-setup-whitespace ()
  "Setup visible whitespace for Sign's coproduct and indent operators."
  (require 'whitespace)
  ;; 可視化する対象（タブとスペース）
  (setq-local whitespace-style '(face tabs spaces tab-mark space-mark))
  ;; どう表示するか（スペースを「・」、タブを「→」に設定）
  (setq-local whitespace-display-mappings
              '(
                (space-mark ?\  [?・] [?.])
                (tab-mark   ?\t [?→ ?\t] [?\\ ?\t])
                ))
  ;; whitespace-modeをオンにする
  (whitespace-mode 1))

;; ---------------------------------------------------------
;; 4. インデント計算エンジンと改行処理
;; ---------------------------------------------------------
(defun sign-calculate-indentation ()
  "現在の行の適切なインデント幅（カラム数）を計算する。"
  (save-excursion
    (beginning-of-line)
    (if (bobp)
        0
      (let ((is-closing (looking-at "^[ \t]*[}\\])]"))
            (prev-indent 0)
            (extra-indent 0))
        (if is-closing
            (let ((state (syntax-ppss)))
              (if (nth 1 state)
                  (save-excursion
                    (goto-char (nth 1 state))
                    (current-indentation))
                0))
          (save-excursion
            (forward-line -1)
            (while (and (looking-at "^[ \t]*$") (not (bobp)))
              (forward-line -1))
            (setq prev-indent (current-indentation))
            (end-of-line)
            (skip-chars-backward " \t")
            (when (memq (char-before) '(?: ?? ?{ ?\[ ?\())
              (setq extra-indent sign-tab-width)))
          (+ prev-indent extra-indent))))))

(defun sign-indent-line ()
  "計算されたインデント（タブのみ）を現在の行に適用する。"
  (interactive)
  (let ((indent-col (sign-calculate-indentation)))
    (if (<= (current-column) (current-indentation))
        (indent-line-to indent-col)
      (save-excursion
        (indent-line-to indent-col)))))

(defun sign-newline-and-indent ()
  "Sign言語用の改行コマンド。"
  (interactive)
  (let ((is-empty (save-excursion
                    (beginning-of-line)
                    (looking-at "^[ \t]*$"))))
    (if is-empty
        (let ((current-indent (current-indentation)))
          (delete-region (line-beginning-position) (line-end-position))
          (newline)
          (indent-to (max 0 (- current-indent sign-tab-width))))
      (newline)
      (sign-indent-line))))

;; ---------------------------------------------------------
;; 5. モードマップ（キーバインド）の設定
;; ---------------------------------------------------------
(defvar sign-mode-map
  (let ((map (make-sparse-keymap)))
    (define-key map (kbd "RET") 'sign-newline-and-indent)
    map)
  "Keymap for `sign-mode'.")

;; ---------------------------------------------------------
;; 6. メジャーモード本体の定義
;; ---------------------------------------------------------
;;;###autoload
(define-derived-mode sign-mode prog-mode "Sign"
  "Sign言語のための構造的編集に特化したメジャーモード"
  
  ;; 構文ルールとハイライトの適用
  :syntax-table sign-mode-syntax-table
  (setq font-lock-defaults '(sign-font-lock-keywords))
  
  ;; インデント設定
  (setq-local indent-tabs-mode t)
  (setq-local tab-width sign-tab-width)
  (setq-local indent-line-function 'sign-indent-line)
  
  ;; カッコの自動補完
  (setq-local electric-pair-pairs
              '((?\{ . ?\})
                (?\[ . ?\])
                (?\( . ?\))))
  (electric-pair-local-mode 1)
  
  ;; Emacs標準のコメント機能をオフにする（Signのバッククォート仕様と合わないため）
  (setq-local comment-start nil)
  
  (sign-setup-whitespace)
  
  ;; 自動補完をオフにする
  (when (bound-and-true-p company-mode)
    (company-mode -1))
  
  (message "Sign mode loaded. Syntax coloring like VS Code is applied!"))


;; ---------------------------------------------------------
;; 7. ワンタッチ・コメントアウト機能
;; ---------------------------------------------------------
(defun sign-toggle-comment ()
  "選択範囲または現在の行のSignコメント（`）をトグルする"
  (interactive)
  (let ((start (if (use-region-p) (region-beginning) (line-beginning-position)))
        (end (if (use-region-p) (region-end) (line-end-position))))
    (save-excursion
      (goto-char start)
      (beginning-of-line)
      ;; 選択範囲の各行に対してループ処理
      (while (< (point) end)
        (save-excursion
          (skip-chars-forward " \t") ; インデントをスキップして文字の先頭へ
          (if (char-equal (char-after) ?`)
              (delete-char 1)        ; すでに ` があれば削除（アンコメント）
            (insert "`")))           ; なければ ` を挿入（コメントアウト）
        (forward-line 1)))))

;; モードマップ（キーバインド）に登録
(define-key sign-mode-map (kbd "C-c c") 'sign-toggle-comment)



(provide 'sign-mode)