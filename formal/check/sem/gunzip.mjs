// 標準入力の gzip（連なった塊も）をほどいて標準出力へ流す（ディスクにほどかない）。
import zlib from "zlib";
process.stdin.pipe(zlib.createGunzip()).pipe(process.stdout);
