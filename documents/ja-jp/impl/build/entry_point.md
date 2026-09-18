# Sign バイナリエントリポイント仕様

## 概要

Sign の実行モデルでは `main.sn` が論理的なエントリポイントだが、
ベアメタル実行時には**物理的なエントリアドレス**（CPU が最初にジャンプするアドレス）が別途必要である。

このアドレスは `option.ms` の `entry` および `stack` フィールドで宣言する。
コンパイラはこれを元に**スタートアップスタブを自動生成**し、`crt0.s` は不要になる。

---

## 1. `option.ms` の拡張構文

> [!IMPORTANT]
> **`option.ms` の全フィールド一覧と `target` 別デフォルト値は [`Option_MS_Spec_ja-jp.md`](Option_MS_Spec_ja-jp.md) を参照すること。**
> 本ドキュメントは `entry`/`stack` フィールドの意味とスタートアップスタブ生成の詳細を記述する。

```son
` ターゲット（デフォルト値の供給元）
target : x86_bios
layer  : 0
` 物理エントリアドレス（省略時はtargetのデフォルト）
entry  : 0x7C00
` 初期スタックポインタ（省略時はtargetのデフォルト）
stack  : 0x9000
link :
    static :
        memory :
            rom : origin 0x7C00  length 512
            ram : origin 0x9000  length 512K
```

### フィールド定義

| フィールド | 型 | 意味 |
|-----------|-----|------|
| `entry` | アドレス | CPU がジャンプする物理アドレス（スタートアップスタブの先頭） |
| `stack` | アドレス | 初期スタックポインタ値（スタブが `rsp`/`sp` にセットする値） |
| `target` | 識別子 | ターゲットアーキテクチャ（`entry`/`stack` のデフォルト値を決定） |

---

## 2. ターゲット別デフォルト値

`entry` / `stack` を省略した場合、`target` の値からデフォルトを適用する。

| target | entry（デフォルト） | stack（デフォルト） | 用途 |
|--------|-------------------|-------------------|------|
| `x86_bios` | `0x7C00` | `0x7BFF` | BIOS ブートローダー（MBR ロード先） |
| `x86_firmware` | `0xFFFFFFF0` | `0x00090000` | **CPU リセットベクタから起動**（UEFI 代替ファームウェア） |
| `x86_uefi_app` | （UEFI が決定） | （UEFI が設定） | UEFI アプリケーション（`.efi` ファイル） |
| `aarch64_rpi` | `0x80000` | `0x80000` | Raspberry Pi 3/4 ベアメタル |
| `aarch64_qemu` | `0x40080000` | `0x40200000` | QEMU virt ボード |
| `aarch64_firmware` | `0x0` | `0x80000` | AArch64 リセットベクタ（EL3 例外レベル） |
| `cortex_m` | `rom.origin` | `ram.origin + ram.length` | STM32 等 Cortex-M マイコン |
| `riscv64` | `0x80000000` | `0x80200000` | QEMU / SiFive 等 RISC-V |
| `wasm` | （WASM ランタイムが決定） | （WASM ランタイムが設定） | WebAssembly |

`cortex_m` の場合、スタックは `ram.origin + ram.length`（RAM 末端）が
Cortex-M の慣例（スタックは上位アドレスから下方成長）に従うデフォルト。

> [!NOTE]
> `x86_firmware` は UEFI を**代替する**ファームウェアを書くためのターゲット。
> UEFI アプリケーション（UEFI 上で動く EFI ファイル）を書く場合は `x86_uefi_app` を使う。

---

## 3. コンパイラが生成するスタートアップスタブ

`entry` に配置されるスタートアップスタブは**コンパイラが自動生成**する。
ユーザーがアセンブリを書く必要はない。

### x86_bios の例（生成されるコード概念）

```asm
; コンパイラ自動生成スタートアップ（0x7C00 に配置）
BITS 16
ORG 0x7C00

_start:
    cli                     ; 割り込み禁止
    xor ax, ax
    mov ds, ax              ; セグメントレジスタ初期化
    mov es, ax
    mov ss, ax
    mov sp, 0x7BFF          ; スタックポインタ設定（option.ms の stack 値）
    sti                     ; 割り込み許可
    jmp _.main          ; Sign の main.sn へ

_.main:
    ; main.sn のコードがここに展開される
    ...
    hlt                     ; main 終了後はハルト
```

### AArch64 の例（生成されるコード概念）

```asm
// コンパイラ自動生成スタートアップ（0x80000 に配置）
_start:
    ldr x30, =0x80000       // スタックポインタ設定
    mov sp, x30
    bl _.main           // Sign の main.sn へ

_.main:
    // main.sn のコードがここに展開される
    ...
    wfe                     // main 終了後は省電力待機
```

---

## 3.5 `x86_firmware` ターゲット：リセットベクタからの完全起動

`x86_firmware` は CPU のリセットベクタ（`0xFFFFFFF0`）から始まる
**UEFI 代替ファームウェア**を Sign で記述するためのターゲットである。

### 起動シーケンス（Sign コンパイラが生成する `boot.sn`）

```sign
` boot.sn — コンパイラ自動生成（option.ms: target x86_firmware）
` entry: 0xFFFFFFF0（CPU リセットベクタ）

`"layer:0"
` === 16bit real mode ===
"
	cli
	xor ax, ax
	mov ds, ax
	mov ss, ax
	mov sp, 0x9000

	in al, 0x92
	or al, 0x02
	out 0x92, al

	lgdt [gdt_descriptor]

	mov eax, cr0
	or eax, 0x1
	mov cr0, eax
	jmp 0x08:protected_mode

	protected_mode:

	    mov ax, 0x10
	    mov ds, ax
	    mov ss, ax

	    mov eax, cr4
	    or eax, 0x20
	    mov cr4, eax

	    mov ecx, 0xC0000080
	    rdmsr
	    or eax, 0x100
	    wrmsr

	    mov eax, cr0
	    or eax, 0x80000001
	    mov cr0, eax
	    jmp 0x18:long_mode

	long_mode:
	    mov rsp, 0x00090000
"

` Sign の main.sn に制御を移す
`main.sn`@~
main
```

### `option.ms` の宣言例

```son
target : x86_firmware
layer  : 0
link :
    static :
        memory :
            ` フラッシュROM領域
            rom : origin 0xFFFFF000  length 64K
            ` POST後にメモリマップ確定
            ram : origin 0x00000000  length auto
```

### `x86_bios` との違い

| 観点 | `x86_bios` | `x86_firmware` |
|------|-----------|----------------|
| 開始アドレス | `0x7C00`（BIOS がロード） | `0xFFFFFFF0`（CPU リセット直後） |
| 前提とするファームウェア | BIOS が存在する | **ファームウェア自体を書く** |
| 動作モード | 16bit real mode のまま（または手動移行） | real → protected → long mode 全移行 |
| 目的 | OS ブートローダー | UEFI/BIOS の完全代替 |

---


| 役割 | C | Sign |
|------|---|------|
| 物理エントリアドレス指定 | リンカスクリプト（`.ld` ファイル） | `option.ms` の `entry` |
| 初期スタックポインタ | `crt0.s` で手動設定 | `option.ms` の `stack`（自動生成） |
| スタートアップコード | `crt0.s`（ユーザーが書く） | コンパイラが自動生成 |
| ターゲット切り替え | Makefile / ビルドスクリプト | `option.ms` の `target` を変更するだけ |

Sign では `crt0.s` の代わりにコンパイラがスタートアップスタブを生成し、
`option.ms` の `target` を変えるだけで異なるアーキテクチャに対応できる。

---

## 5. `boot.sn` の自動生成

コンパイラはスタートアップスタブをバイナリに直接埋め込むだけでなく、
**`boot.sn` ファイルとして生成物に出力**する。

これは [type/Type_System_ja-jp.md](../type/Type_System_ja-jp.md) における
`.st` ファイル（構造体型の自動生成）と同じパターンである。

### 生成物の例（target: x86_bios）

```sign
` boot.sn — コンパイラ自動生成（option.ms: target x86_bios）
` entry: 0x7C00 / stack: 0x7BFF
` このファイルを上書き配置することでスタートアップをカスタマイズできる

`"layer:0"
"
	cli
	xor ax, ax
	mov ds, ax
	mov ss, ax
	mov sp, 0x7BFF
	sti
"

`main.sn`@~
main
```

### 生成物の例（target: aarch64_rpi）

```sign
` boot.sn — コンパイラ自動生成（option.ms: target aarch64_rpi）
` entry: 0x80000 / stack: 0x80000

`"layer:0"
"
	ldr x30, =0x80000
	mov sp, x30
"

`main.sn`@~
main
```

### 動作ルール

| 状況 | 動作 |
|------|------|
| `boot.sn` が存在しない | コンパイラが `option.ms` から自動生成 |
| `boot.sn` が存在する | ユーザー提供の `boot.sn` を使用（オーバーライド） |

ユーザーが独自の初期化シーケンス（GDT 設定、ページング初期化など）を
必要とする場合は `boot.sn` を手動で作成することで完全にカスタマイズできる。

---

## 6. Execution Model との整合

[core/Execution_Model_ja-jp.md](./Execution_Model_ja-jp.md) で定義した通り、
Sign の全関数は `main.sn` の内部関数として静的に展開される。

物理エントリポイント（スタートアップスタブ）は `main.sn` の外側に生成される
**コンパイラ管理の唯一の「外部」コード**であり、スタック初期化後に即座に
`main` へジャンプする。それ以降はすべて Sign の実行モデルに従う。

```
[物理エントリ 0x7C00]
    スタートアップスタブ（コンパイラ生成）
        → スタック設定
        → JMP main
            [main.sn の Sign コード]
                → 全内部関数が展開された1つの main
```
