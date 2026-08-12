/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * ATTENTION: AI-generated (by Claude Fable 5 on 'max' reasoning)
 */

/*
 * MD5 (RFC 1321) is used only to derive stable offline account UUIDs
 * from nicknames, exactly like the desktop 'hash_md5' command does.
 * SubtleCrypto does not implement MD5, hence this tiny implementation
 */

// Left rotate amounts: one row of four per round
const RoundShifts: Array<Array<number>> = [
  [7, 12, 17, 22],
  [5, 9, 14, 20],
  [4, 11, 16, 23],
  [6, 10, 15, 21],
];

// The binary integer parts of the sines of integers: floor(|sin(index + 1)| * 2^32)
const SineTable: Array<number> = Array.from(
  { "length": 64 },
  (_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * (2 ** 32)),
);

function toLittleEndianHex(word: number): string {
  let hex: string = "";

  for (let byteIndex = 0; byteIndex < 4; byteIndex++) {
    hex = hex + ((word >>> (byteIndex * 8)) & 0xFF)
      .toString(16)
      .padStart(2, "0");
  }

  return hex;
}

function mixWord(index: number, b: number, c: number, d: number): [number, number] {
  if (index < 16) {
    return [(b & c) | (~b & d), index];
  }

  if (index < 32) {
    return [(d & b) | (~d & c), ((5 * index) + 1) % 16];
  }

  if (index < 48) {
    return [b ^ c ^ d, ((3 * index) + 5) % 16];
  }

  return [c ^ (b | ~d), (7 * index) % 16];
}

export function digestMd5(bytes: Uint8Array): string {
  // The message is padded with a '1' bit, zeros, and its 64-bit little-endian bit length
  const paddedLength: number = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded: Uint8Array = new Uint8Array(paddedLength);

  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const view: DataView = new DataView(padded.buffer);

  view.setUint32(paddedLength - 8, (bytes.length * 8) >>> 0, true);
  view.setUint32(paddedLength - 4, Math.floor(bytes.length / (2 ** 29)), true);

  // The '>>> 0' parts below keep every sum wrapped to 32 bits
  let a0: number = 0x67_45_23_01;
  let b0: number = 0xEF_CD_AB_89;
  let c0: number = 0x98_BA_DC_FE;
  let d0: number = 0x10_32_54_76;

  for (let chunk = 0; chunk < paddedLength; chunk += 64) {
    const words: Array<number> = [];

    for (let wordIndex = 0; wordIndex < 16; wordIndex++) {
      words.push(view.getUint32(chunk + (wordIndex * 4), true));
    }

    let a: number = a0;
    let b: number = b0;
    let c: number = c0;
    let d: number = d0;

    for (let index = 0; index < 64; index++) {
      const [mixed, wordIndex] = mixWord(index, b, c, d);
      const shift: number = RoundShifts[Math.floor(index / 16)][index % 4];
      const sum: number = (a + mixed + SineTable[index] + words[wordIndex]) >>> 0;
      const rotated: number = ((sum << shift) | (sum >>> (32 - shift))) >>> 0;
      const previousD: number = d;

      d = c;
      c = b;
      b = (b + rotated) >>> 0;
      a = previousD;
    }

    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  return (
    toLittleEndianHex(a0) +
    toLittleEndianHex(b0) +
    toLittleEndianHex(c0) +
    toLittleEndianHex(d0)
  );
}
