import SignSem.Front
import SignSem.JStr
import SignSem.JV

/-!
# 公理の確かめ

前段の入口と JS の文字列の道具と JSON の読み手が、どの公理に依るかを `#print axioms` の出力ごと固める。`lake build` がこの file を組む度に
照らし、出力が1字でも変われば組み立てが止まる。

- 的は Classical.choice に依らないこと（formal/sem/README.md の `#print axioms` の項）。Lean 4.36 では String・Int・UInt16 の
  `==`、`String.toList`・`String.length`・`String.startsWith` が choice を引き込む（JStr.lean の `instBEqUInt16Decide` の注）。
- 変わった時：出力に Classical.choice が無ければ、新しい出力に書き直してよい（propext・Quot.sound が増えた・減っただけの時）。
  choice が出たら、写しの側で引き込んだ所を探して直す。
-/

/-- info: 'SignSem.Front.front' depends on axioms: [propext, Quot.sound] -/
#guard_msgs in
#print axioms SignSem.Front.front

/-- info: 'SignSem.Lex.preprocess' depends on axioms: [propext, Quot.sound] -/
#guard_msgs in
#print axioms SignSem.Lex.preprocess

/-- info: 'SignSem.Peg.parse' depends on axioms: [propext] -/
#guard_msgs in
#print axioms SignSem.Peg.parse

/-- info: 'SignSem.Tree.rows' depends on axioms: [propext, Quot.sound] -/
#guard_msgs in
#print axioms SignSem.Tree.rows

/-- info: 'SignSem.JStr.ofString' does not depend on any axioms -/
#guard_msgs in
#print axioms SignSem.JStr.ofString

/-- info: 'SignSem.JStr.beq' does not depend on any axioms -/
#guard_msgs in
#print axioms SignSem.JStr.beq

/-- info: 'SignSem.JStr.lt' depends on axioms: [propext] -/
#guard_msgs in
#print axioms SignSem.JStr.lt

/-- info: 'SignSem.JStr.jsonStringify' depends on axioms: [propext] -/
#guard_msgs in
#print axioms SignSem.JStr.jsonStringify

/-- info: 'SignSem.JStr.toString?' depends on axioms: [propext] -/
#guard_msgs in
#print axioms SignSem.JStr.toString?

/-! JS の値としての JSON の読み手（`JV.parse` は燃料で止まる普通の定義なので、`#print axioms` は中身を辿る）。 -/

/-- info: 'SignSem.JV.parse' depends on axioms: [propext] -/
#guard_msgs in
#print axioms SignSem.JV.parse
