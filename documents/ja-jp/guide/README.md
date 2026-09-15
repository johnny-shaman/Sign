# Sign言語 ユーザーガイド

Sign言語を**書く人**向けのドキュメント集。

---

## まず読むべき3つ

| ドキュメント | 内容 |
|---|---|
| **[operator_table.md](operator_table.md)** | 全演算子の優先順位・意味・Unit挙動。**言語の骨格** |
| **[list_cheat_sheet.md](list_cheat_sheet.md)** | よく使うリスト操作の一覧表 |
| **[examples/](examples/)** | 完結した実プログラム（Nクイーンなど）。動く例はこちら |
| ~~[example.sn](example.sn)~~ | **古い。参照しないこと**——今は止まる綴りが混ざっている |

---

## 核心理解：6つの定義

理解に困ったら、この6つに戻る：

| 記号 | 意味 | 例 |
|------|------|----|
| `__` | Unit（余積における恒等元） | `__ 5 = 5` |
| `_` | Hole（部分適用のプレースホルダ） | `f _ 3 = $p0 ? f $p0 3` |
| スペース | 余積（関数合成・適用・リスト構築） | `f g x = g(f(x))` |
| `,` | 積（構造的リスト構築） | `1, 2, 3` |
| `?` | ラムダ（関数定義） | `x ? x + 1` |
| `:` | 定義（束縛） | `add : x y ? x + y` |

**これら6つはオーバーロード不可**（型推論規則そのもの）

---

## ドキュメント一覧

```
guide/
├── README.md              ← このファイル
├── operator_table.md      全演算子表（優先順位・Unit挙動）
├── function_guide.md      関数定義の書き方（?演算子・match_case・デフォルト引数）
├── list_cheat_sheet.md    リスト操作チートシート
├── string_and_comment.md  文字列・コメントの書き方
├── pattern_guide.md       慣用パターン集（Maybe/List/Either/IO等）
├── reference.md           Sign言語リファレンス（完全版）
├── example.sn             古い断片集（参照しないこと）
└── examples/              完結した実プログラムの例
    └── n-queen/           Nクイーン問題（バックトラック探索）
        ├── n_queens.sn            解説コメント付き
        └── n_queens.nocomment.sn  コードのみ
```

---

## データフロー：filter → map → fold

```sign
[> 0,] [* 2,] [+] data
 ↓      ↓      ↓
filter  map   fold
```

関数合成は**左から右へデータが流れる**。

---

## よく使うパターン

### 基本的な関数定義
```sign
add : x y ? x + y
` → 8
add 3 5
```

### match_case（条件分岐）
```sign
f : x ?
	x > 0 : x * 2
	x < 0 : x * -1
	0
```

### リスト操作
```sign
` map: 各要素を2倍
` → [2 4 6 8 10]
[* 2,] [1 2 3 4 5]~

` filter: 正の数だけ
` → [1 3 5]
[> 0,] [1 -2 3 -4 5]~

` fold: 合計
` → 15
[+] [1 2 3 4 5]~
```

### 再帰
```sign
sum : x ~xs ?
	xs & x + sum xs | x

` → 15
sum [1 2 3 4 5]
```
