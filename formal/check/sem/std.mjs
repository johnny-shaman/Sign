// formal/check/dump.mjs の withStd と同じ STD の付け方
export const STD = ["inc : x ? x + 1", "double : x ? x * 2", "d : x ? x * 10", "g : x ? x * 10", "add : x y ? x + y", "f2 : x y ? x - y", "k1 : x y ? x", "mul : a b ? a * b", "use : f x ? @f x", "f3 : a b c ? a + b + c", "f4 : a b c e ? a + b + c + e", "adder : m ? $[+ m]", "map : f [x ~y] ? x", "n : [~x] ? x", "fs : $inc , $double , 3", "vs : 1 , 2 , 3", "i : _", "pw : [a : 1]", "w : pw ' zz"];
export function withStd(s0) {
  if (s0.startsWith("#raw\n")) return s0.slice(5);
  const defined = new Set(s0.split(/\r?\n/).map((l) => (l.match(/^(\S+) :/) || [])[1]).filter(Boolean));
  const words = new Set(s0.match(/[A-Za-z_][A-Za-z0-9_]*/g) || []);
  const pre = STD.filter((d) => { const nm = d.split(" ")[0]; return words.has(nm) && !defined.has(nm); });
  if (pre.includes("w : pw ' zz") && !pre.includes("pw : [a : 1]")) pre.unshift("pw : [a : 1]");
  return pre.length ? pre.join("\n") + "\n" + s0 : s0;
}
