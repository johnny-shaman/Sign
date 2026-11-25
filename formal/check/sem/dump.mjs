// node --stack-size=8000 formal/check/sem/dump.mjs [--limit-mb 200] [--skip N] [--max N] [--out stages.jsonl|stages.jsonl.gz] [--no-write] [--sources sources.jsonl]
// out/sem/sources.jsonl の源ごとに、alpha1 の前段の3つの段の答えを out/sem/stages.jsonl に1行ずつ書く：{id, source, b1, b2, b3}。
//   b1：lexer.js の preprocessWithLines(source) → {text, lineAt}（lineAt は text の位置 0..長さ の全部での lineAt の値）か {err}。
//   b2：sign.pegjs を peggy.generate した parser の parse(text, {rowAt, qAt}) → {rows} か {err}。行は {at, line, q, w}：at は書き始めの位置、
//       line は lineAt(at)、q は行の `?` の語の位置の並び（無ければ []）、w は語の並び。語は文字列か {tag, rows}（tag は "\"BRACKET_\"" などの印の
//       文字列そのまま）。INDENT の3つ目の要素（いつも "\"_DEDENT\""、違えば止める）は書かない。
//   b3：resolve.js の写し（gen_front.mjs）の frontRows(source)（frontEnd と行ごとの parseRow）→ {rows} か {err}。rows は rowsjson.mjs の exportRows の形
//       （core.raw を落とし、行の木に "line"）。
//   b1 が err なら b2・b3 は {skip:true}。b2 が err でも b3 は走らせる（frontRows の中の前段も同じ断りを投げる。ただし frontRows は resolve と同じく
//   stackRefusal で包むので、JS のスタックの溢れは b2 では生の RangeError、b3 では resolve-stack-limit になる）。
//   err は {name, reason, line, message}（無い欄は null）。peggy の断り（location を持つ物）の line は frontEnd と同じく lineAt(e.location.start.offset)。
//
// 位置：at・q・lineAt の添え字は、JS の文字列の位置（UTF-16 の符号単位の番号。peggy の offset と lexer.js の lineAt が受ける位置）そのまま。
//   lineAt の配列の k 番目は lineAt(k)（k = 0..text.length。大きさは text.length + 1 で、lexer.js:774 が位置を切り詰める範囲と同じ）。
//   サロゲートの対は2単位、対になっていないサロゲートは1単位で、対の間（後ろの半分）の位置も1つの位置。at・q が整数で 0..text.length に
//   あることは確かめる（外なら止める）。BMP の外の字（と対になっていないサロゲート）を含む源の数を数える。
// 行（line・err.line）は元のソースの行の番号（1 から）。
// 書く行はどれも JSON.stringify の文で、対の無いサロゲートは escape（\udxxx）で書くので、書く前に isWellFormed() を確かめる（UTF-8 にする時に
//   字のままの対の無いサロゲートが U+FFFD に替わらないこと）。
//
// 門：書いた行の b3.rows を JSON から rowsjson.mjs の importRows で戻し、本物の resolve(source) が通る源では、その rows と同じ物か（deep equal。resolve の側の
//   core.raw は見ない、行の木の行も比べる）を見る。resolve が断る源では、b3（b1 が err なら b1）の err と、b2 が err ならその err も、resolve の断りと同じか、
//   b3 が通るなら後の段の断りとして理由ごとに数える。また b2 の行（括りと字下げの中の行も）の数・並びと、b3 の行の木（"line" を持つ物）の数・行の並びが合うかを見る。
// 1件ずつ try で囲む。段の断り（段の呼び出しの中で投げた物）は err に書き、道具の誤り（位置の確かめ・写し・書き出しの中で投げた物）は id を言って止める。
// 書く量が --limit-mb（既定 200、MB は 10^6 バイト）を超える行の手前（.jsonl.gz なら、超える塊（ほどいて約 16 MB）の手前）で書くのを止める（id の順の頭だけが残る）。数と門は書くのを止めた後も全部の源で数え、
//   全部を書いたときの大きさ（bytesIfAllWritten）と欄ごとの大きさ（fieldBytes）を出す。--skip N は頭の N 本を飛ばし、--max N は N 本だけ、--out は out/sem の下の名前、
//   --no-write は書かずに数えるだけ、--sources は out/sem の下の源の集まりの名前（既定 sources.jsonl）。数は out/sem/<out の名前>_counts.json に書き、標準出力にも出す。
// 最後に終わりの印の行 {"end":true,"units":"utf16","lines":N,"complete":B,"stamp":S,"sources":R,"gate":G} を書く。units は位置の数え方（UTF-16 の符号単位。
//   signsem check は units が "utf16" でない印を断る）、N は書いた行の数、B は源の全部を書いたか（--skip・--max・上限で欠けたら偽）、
//   S は gen_front.mjs の frontStamp()（alpha1 の前段の file の sha1 の頭・peggy の版・stages を書く道具の sha1 の頭・node の版とスタックの大きさ）、
//   R は読んだ源の集まり {name, lines, sha1}（sha1 は file の中身の sha1 の頭 12 字）、G は門の結果（rowsDiffer・resolveOkButFrontErr・rowCountDiffer・frontErrUnexcused・
//   frontErrExcused）。G の4つの数のどれかが 0 でなければ、数を書いた後に 1 で終わる。frontErrExcused は JS のスタックの溢れの組の id。
import fs from "fs";
import zlib from "zlib";
import path from "path";
import { pathToFileURL, fileURLToPath } from "url";
import { genFront, frontStamp, sha1Head, JS, PEGGY_URL } from "./gen_front.mjs";
import { exportRows, importRows } from "./rowsjson.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "..", "out", "sem");
const STAMP = frontStamp(); // 走らせ始めの版（alpha1 の前段の file・peggy・道具・node・スタック。読み込んだ物と同じ）
const args = process.argv.slice(2);
const opt = { limitMb: 200, skip: 0, max: Infinity, out: "stages.jsonl", write: true, sources: "sources.jsonl" };
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--limit-mb") opt.limitMb = Number(args[++i]);
  else if (args[i] === "--skip") opt.skip = Number(args[++i]);
  else if (args[i] === "--max") opt.max = Number(args[++i]);
  else if (args[i] === "--out") opt.out = args[++i];
  else if (args[i] === "--no-write") opt.write = false;
  else if (args[i] === "--sources") opt.sources = args[++i];
  else throw new Error(`知らない引数 ${args[i]}`);
}
if (!/^[\w.-]+\.jsonl(\.gz)?$/.test(opt.out)) throw new Error("--out は out/sem の下の .jsonl か .jsonl.gz の名前");
// .jsonl.gz なら gzip の塊を続けて書く（gzip -dc で1本の JSONL に戻る）。--limit-mb は書いた gzip の大きさに当てる。
const GZ = opt.out.endsWith(".gz");
let pend = [], pendBytes = 0, pendCount = 0, pendLast = null;
const LIMIT = opt.limitMb * 1e6;

const { preprocessWithLines } = await import(pathToFileURL(JS + "/lexer.js").href);
const peggy = (await import(PEGGY_URL)).default;
const parser = peggy.generate(fs.readFileSync(JS + "/sign.pegjs", "utf8"));
const { resolve } = await import(pathToFileURL(JS + "/resolve.js").href);
const { frontRows } = await import(pathToFileURL(genFront()).href);

class ToolError extends Error {}
const tool = (m) => {
  throw new ToolError(m);
};

// --- 位置と字 ---
// 位置 o（UTF-16 の符号単位の番号）が整数で 0..n（n は text.length）にあれば o そのまま
const posOf = (n, o, what) => {
  if (!Number.isInteger(o) || o < 0 || o > n) tool(`${what} の位置 ${o} が text の外`);
  return o;
};
// s のサロゲートの対（上の半分の直後に下の半分）の数と、対の無いサロゲートの数
function surrogates(s) {
  let pairs = 0, lone = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length && (s.charCodeAt(i + 1) & 0xfc00) === 0xdc00) (pairs++, i++);
    else if (c >= 0xd800 && c <= 0xdfff) lone++;
  }
  return { pairs, lone };
}
// 書く文を UTF-8 のバイトに（字のままの対の無いサロゲートがあれば、UTF-8 で U+FFFD に替わるので止める）
const utf8Of = (s, what) => {
  if (!s.isWellFormed()) tool(`${what}に字のままの対の無いサロゲートがある`);
  return Buffer.from(s, "utf8");
};

const isPeggy = (e) => !!e && typeof e === "object" && !!e.location && !!e.location.start;
function errOf(e, line) {
  const o = e !== null && typeof e === "object";
  return {
    name: o && typeof e.name === "string" ? e.name : typeof e,
    reason: o && typeof e.reason === "string" ? e.reason : null,
    line: line !== undefined ? line : o && e.line !== undefined ? e.line : null,
    message: o && e.message !== undefined ? String(e.message) : String(e),
  };
}
const keyOf = (err, peg) => err.reason || (peg ? (/^Expected /.test(err.message) ? "(peggy) Expected … found" : `(peggy error()) ${err.message.slice(0, 40)}`) : `(${err.name}) ${err.message.split(/[:：]/)[0].slice(0, 60)}`);

const TAGS = new Set(['"BRACKET_"', '"ABS_"', '"NORM_"', '"INDENT_"']);
function b2Rows(rows, rowAt, qAt, lineAt, n) {
  const row = (r) => {
    if (!Array.isArray(r)) tool("b2 の行が配列でない");
    if (!rowAt.has(r)) tool("b2 の行に rowAt が無い");
    const o = posOf(n, rowAt.get(r), "行の書き始め");
    return { at: o, line: lineAt(o), q: (qAt.get(r) || []).map((x) => posOf(n, x, "`?`")), w: r.map(word) };
  };
  const word = (w) => {
    if (typeof w === "string") return w;
    if (!Array.isArray(w) || !TAGS.has(w[0]) || !Array.isArray(w[1])) tool(`b2 の語の形が知らない形 ${JSON.stringify(w).slice(0, 80)}`);
    if (w[0] === '"INDENT_"') {
      if (w.length !== 3 || w[2] !== '"_DEDENT"') tool(`INDENT の3つ目が "\\"_DEDENT\\"" でない ${JSON.stringify(w[2])}`);
    } else if (w.length !== 2) tool(`囲み ${w[0]} の要素が2つでない`);
    return { tag: w[0], rows: w[1].map(row) };
  };
  return rows.map(row);
}

// b2 の行（中の行も）の行の番号を前から順に、b3 の行の木の "line" を前から順に。
function b2Lines(rows, acc = []) {
  for (const r of rows) {
    acc.push(r.line);
    for (const w of r.w) if (typeof w !== "string") b2Lines(w.rows, acc);
  }
  return acc;
}
function b3Lines(n, acc = []) {
  if (n === null || typeof n !== "object") return acc;
  if (Array.isArray(n)) {
    for (const x of n) b3Lines(x, acc);
    return acc;
  }
  if ("line" in n) acc.push(n.line);
  for (const [k, v] of Object.entries(n)) if (k !== "line") b3Lines(v, acc);
  return acc;
}

// importRows で戻した rows（a、lineOf は la）と resolve の rows（b、lb）の deep equal。b の core.raw は見ない。違えば最初の場所を返す。
function diffRows(a, la, b, lb) {
  const onPath = new Set();
  const go = (x, y, p) => {
    if (x === null || typeof x !== "object" || y === null || typeof y !== "object") return x === y ? null : `${p}: ${JSON.stringify(x)} と ${typeof y === "object" ? "物" : JSON.stringify(y)}`;
    if (onPath.has(y)) return `${p}: resolve の側が循環`;
    if (Array.isArray(x) !== Array.isArray(y)) return `${p}: 配列かが違う`;
    onPath.add(y);
    try {
      if (Array.isArray(x)) {
        if (x.length !== y.length) return `${p}: 長さ ${x.length} と ${y.length}`;
        for (let i = 0; i < x.length; i++) {
          const d = go(x[i], y[i], `${p}[${i}]`);
          if (d) return d;
        }
        return null;
      }
      const kx = Object.keys(x).sort();
      const ky = Object.keys(y).filter((k) => k !== "raw").sort();
      if (kx.join(",") !== ky.join(",")) return `${p}: 鍵 {${kx}} と {${ky}}`;
      if (Object.getOwnPropertySymbols(y).length) return `${p}: resolve の側に Symbol の鍵`;
      if (la(x) !== lb(y)) return `${p}: 行 ${la(x)} と ${lb(y)}`;
      for (const k of kx) {
        const d = go(x[k], y[k], `${p}.${k}`);
        if (d) return d;
      }
      return null;
    } finally {
      onPath.delete(y);
    }
  };
  return go(a, b, "rows");
}
const sameErr = (x, y) => x.name === y.name && x.reason === y.reason && x.line === y.line && x.message === y.message;

// --- 回す ---
if (!/^[\w.-]+\.jsonl$/.test(opt.sources)) throw new Error("--sources は out/sem の下の .jsonl の名前");
const srcBuf = fs.readFileSync(path.join(OUT, opt.sources));
const srcLines = srcBuf.toString("utf8").split("\n").filter(Boolean);
const SRC = { name: opt.sources, lines: srcLines.length, sha1: sha1Head(srcBuf) }; // 終わりの印で stages を源の集まりに結ぶ
const C = {
  sources: srcLines.length,
  done: 0,
  written: 0,
  writtenBytes: 0,
  lastWrittenId: null,
  stoppedWritingAtLimit: false,
  bytesIfAllWritten: 0,
  fieldBytes: { id: 0, source: 0, "b1.text": 0, "b1.lineAt": 0, "b1.err": 0, b2: 0, b3: 0 },
  maxLineBytes: 0,
  b1: { ok: 0, err: 0, reasons: {} },
  b2: { ok: 0, err: 0, skip: 0, reasons: {} },
  b3: { ok: 0, err: 0, skip: 0, reasons: {} },
  bmp: { astralSources: 0, astralChars: 0, loneSurrogateSources: 0 },
  gate: {
    resolveOk: 0,
    rowsEqual: 0,
    rowsDiffer: 0,
    resolveOkButFrontErr: 0,
    resolveErr: 0,
    frontErrSame: 0,
    frontErrDiffer: 0,
    frontErrExcused: [],
    laterStage: {},
    rowCount: { checked: 0, topSame: 0, allSame: 0, linesSame: 0, differ: 0 },
  },
  examples: { rowsDiffer: [], frontErrDiffer: [], rowCountDiffer: [], resolveOkButFrontErr: [] },
};
const bump = (o, k) => (o[k] = (o[k] || 0) + 1);
const ex = (list, x) => list.length < 10 && list.push(x);
const fd = opt.write ? fs.openSync(path.join(OUT, opt.out), "w") : null;
function flushGz() {
  if (!pendCount) return;
  const z = zlib.gzipSync(utf8Of(pend.join(""), "書く塊"));
  if (C.writtenBytes + z.length > LIMIT) C.stoppedWritingAtLimit = true;
  else {
    fs.writeSync(fd, z);
    C.written += pendCount;
    C.writtenBytes += z.length;
    C.lastWrittenId = pendLast;
  }
  pend = [];
  pendBytes = 0;
  pendCount = 0;
}
const t0 = Date.now();
for (let li = opt.skip; li < srcLines.length && C.done < opt.max; li++) {
  const { id, source } = JSON.parse(srcLines[li]);
  try {
    if (typeof source !== "string") tool("源が文字列でない");
    const rec = { id, source, b1: null, b2: null, b3: null };
    const sm = surrogates(source);
    if (sm.pairs) (C.bmp.astralSources++, (C.bmp.astralChars += sm.pairs));
    if (sm.lone) C.bmp.loneSurrogateSources++;
    // B1
    let pre = null, b1err = null;
    try {
      pre = preprocessWithLines(source);
    } catch (e) {
      b1err = errOf(e);
    }
    if (pre) {
      if (typeof pre.text !== "string" || typeof pre.lineAt !== "function") tool("preprocessWithLines の返す物の形が違う");
      const la = Array.from({ length: pre.text.length + 1 }, (_, o) => pre.lineAt(o));
      for (const l of la) if (!Number.isSafeInteger(l)) tool(`lineAt が整数でない ${l}`);
      rec.b1 = { text: pre.text, lineAt: la };
      C.b1.ok++;
    } else {
      rec.b1 = { err: b1err };
      C.b1.err++;
      bump(C.b1.reasons, keyOf(b1err, false));
    }
    // B2
    let b2err = null;
    if (!pre) {
      rec.b2 = { skip: true };
      C.b2.skip++;
    } else {
      const rowAt = new WeakMap(), qAt = new WeakMap();
      let parsed = null;
      try {
        parsed = parser.parse(pre.text, { rowAt, qAt });
      } catch (e) {
        b2err = errOf(e, isPeggy(e) ? pre.lineAt(e.location.start.offset) : undefined);
        rec.b2 = { err: b2err };
        C.b2.err++;
        bump(C.b2.reasons, keyOf(b2err, isPeggy(e)));
      }
      if (parsed) {
        if (!Array.isArray(parsed)) tool("parse の返す物が配列でない");
        rec.b2 = { rows: b2Rows(parsed, rowAt, qAt, pre.lineAt, pre.text.length) };
        C.b2.ok++;
      }
    }
    // B3
    let b3err = null;
    if (!pre) {
      rec.b3 = { skip: true };
      C.b3.skip++;
    } else {
      let fr = null;
      try {
        fr = frontRows(source);
      } catch (e) {
        b3err = errOf(e);
        rec.b3 = { err: b3err };
        C.b3.err++;
        bump(C.b3.reasons, keyOf(b3err, isPeggy(e)));
      }
      if (fr) {
        rec.b3 = { rows: exportRows(fr.rows, fr.lineOf) };
        C.b3.ok++;
      }
    }
    // 書く（欄ごとに JSON にして繋ぐ。JSON.stringify(rec) と同じ字になることを頭の 50 本で確かめる）
    const J = { id: JSON.stringify(id), source: JSON.stringify(source), b2: JSON.stringify(rec.b2), b3: JSON.stringify(rec.b3) };
    let b1json;
    if (rec.b1.err) b1json = J["b1.err"] = JSON.stringify(rec.b1);
    else {
      J["b1.text"] = JSON.stringify(rec.b1.text);
      J["b1.lineAt"] = JSON.stringify(rec.b1.lineAt);
      b1json = `{"text":${J["b1.text"]},"lineAt":${J["b1.lineAt"]}}`;
    }
    const text = `{"id":${J.id},"source":${J.source},"b1":${b1json},"b2":${J.b2},"b3":${J.b3}}`;
    if (C.done < 50 && text !== JSON.stringify(rec)) tool("欄ごとに繋いだ JSON が JSON.stringify(rec) と違う");
    for (const [k, v] of Object.entries(J)) C.fieldBytes[k] += Buffer.byteLength(v);
    const bytes = Buffer.byteLength(text) + 1;
    C.bytesIfAllWritten += bytes;
    C.maxLineBytes = Math.max(C.maxLineBytes, bytes);
    if (fd !== null && GZ && !C.stoppedWritingAtLimit) {
      pend.push(text + "\n");
      pendBytes += bytes;
      pendCount++;
      pendLast = id;
      if (pendBytes > 16e6) flushGz();
    } else if (fd !== null && !C.stoppedWritingAtLimit) {
      if (C.writtenBytes + bytes > LIMIT) C.stoppedWritingAtLimit = true;
      else {
        fs.writeSync(fd, utf8Of(text + "\n", "書く行"));
        C.written++;
        C.writtenBytes += bytes;
        C.lastWrittenId = id;
      }
    }
    C.done++;
    // 門（書いた行の字から戻す）
    const back = JSON.parse(text);
    if (back.b2.rows && back.b3.rows) {
      const l2 = b2Lines(back.b2.rows), l3 = b3Lines(back.b3.rows);
      const g = C.gate.rowCount;
      g.checked++;
      const top = back.b2.rows.length === back.b3.rows.length, all = l2.length === l3.length, same = top && all && l2.every((x, i) => x === l3[i]);
      if (top) g.topSame++;
      if (all) g.allSame++;
      if (same) g.linesSame++;
      else (g.differ++, ex(C.examples.rowCountDiffer, { id, top: [back.b2.rows.length, back.b3.rows.length], all: [l2.length, l3.length] }));
    }
    let rs = null, rerr = null;
    try {
      rs = resolve(source);
    } catch (e) {
      rerr = errOf(e);
    }
    if (rs) {
      C.gate.resolveOk++;
      if (!back.b3.rows) (C.gate.resolveOkButFrontErr++, ex(C.examples.resolveOkButFrontErr, { id }));
      else {
        const { rows, lineOf } = importRows(back.b3.rows);
        const d = diffRows(rows, lineOf, rs.rows, rs.lineOf);
        if (d === null) C.gate.rowsEqual++;
        else (C.gate.rowsDiffer++, ex(C.examples.rowsDiffer, { id, at: d.slice(0, 300) }));
      }
    } else {
      C.gate.resolveErr++;
      const front = b1err || b3err;
      if (front) {
        if (sameErr(front, rerr) && (!b2err || sameErr(b2err, rerr))) C.gate.frontErrSame++;
        else {
          C.gate.frontErrDiffer++;
          ex(C.examples.frontErrDiffer, { id, front, b2: b2err, resolve: rerr });
          // JS のスタックの溢れの組（b2 は生の RangeError、front と resolve は stackRefusal の resolve-stack-limit）だけは許す
          if (sameErr(front, rerr) && rerr.reason === "resolve-stack-limit" && b2err && b2err.name === "RangeError" && b2err.message === "Maximum call stack size exceeded") C.gate.frontErrExcused.push(id);
        }
      } else bump(C.gate.laterStage, rerr.reason || `(${rerr.name})`);
    }
  } catch (e) {
    if (fd !== null) fs.closeSync(fd);
    console.error(`道具の誤りで止めた（id ${id}、源の頭 ${JSON.stringify(String(source).slice(0, 80))}）：${e && e.stack}`);
    process.exit(2);
  }
  if (C.done % 20000 === 0) console.error(`${C.done} 本 ${(C.bytesIfAllWritten / 1e6).toFixed(1)} MB ${((Date.now() - t0) / 1000).toFixed(0)} 秒`);
}
if (fd !== null && GZ && !C.stoppedWritingAtLimit) flushGz();
// 終わりの印の行：書いた行の数・源の全部を書いたか・版（frontStamp）・源の集まり（名前・本数・sha1 の頭）・門の結果。読む側（signsem check と gate.mjs）が照らす。上限に関わらず書く。
const gateEnd = {
  rowsDiffer: C.gate.rowsDiffer,
  resolveOkButFrontErr: C.gate.resolveOkButFrontErr,
  rowCountDiffer: C.gate.rowCount.differ,
  frontErrUnexcused: C.gate.frontErrDiffer - C.gate.frontErrExcused.length,
  frontErrExcused: C.gate.frontErrExcused,
};
if (fd !== null) {
  const end = utf8Of(JSON.stringify({ end: true, units: "utf16", lines: C.written, complete: C.written === C.sources && !C.stoppedWritingAtLimit, stamp: STAMP, sources: SRC, gate: gateEnd }) + "\n", "終わりの印");
  fs.writeSync(fd, GZ ? zlib.gzipSync(end) : end);
  fs.closeSync(fd);
}
C.seconds = Math.round((Date.now() - t0) / 1000);
fs.writeFileSync(path.join(OUT, opt.out.replace(/\.jsonl(\.gz)?$/, "") + "_counts.json"), JSON.stringify(C, null, 2) + "\n");
console.log(JSON.stringify(C, null, 2));
if (C.stoppedWritingAtLimit) console.log(`書く量が ${opt.limitMb} MB を超える手前で書くのを止めた（${C.written} 本、id ${C.lastWrittenId} まで）。数と門は全部の源で数えた。`);
// 門が崩れたら 1 で終わる（b3 が本物の resolve と違う・行の数が違う・許さない断りの違い）
if (gateEnd.rowsDiffer || gateEnd.resolveOkButFrontErr || gateEnd.rowCountDiffer || gateEnd.frontErrUnexcused) {
  console.error(`dump.mjs の門が崩れた：${JSON.stringify(gateEnd)}`);
  process.exit(1);
}
