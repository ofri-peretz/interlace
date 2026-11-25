/**
 * @interlace/ui — games/qr-model
 *
 * A QR code encoder with no dependencies, so a join link turns into a code
 * on the server, in a worker or in the browser, and the same text always
 * gives the same matrix. It follows ISO/IEC 18004: byte mode (UTF-8),
 * versions 1 to 40, the four error-correction levels, and the mask with the
 * lowest penalty score.
 *
 * `encodeQr` returns the matrix; `qrPath` turns it into one SVG path, so a
 * renderer draws it with a single element.
 */

export type QrErrorCorrection = 'L' | 'M' | 'Q' | 'H';

export interface QrMatrix {
  /** Modules per side, without the quiet zone. */
  size: number;
  /** 1 to 40. */
  version: number;
  errorCorrection: QrErrorCorrection;
  /** The mask the encoder chose, 0 to 7. */
  mask: number;
  /** `modules[y][x]` is true for a dark module. */
  modules: boolean[][];
}

export interface EncodeQrOptions {
  /** How much damage the code survives: L 7%, M 15%, Q 25%, H 30%. @default 'M' */
  errorCorrection?: QrErrorCorrection;
  /** The smallest version to use. @default 1 */
  minVersion?: number;
}

// Indexed by level, then version (index 0 unused). From the standard's table 9.
const LEVEL_INDEX: Record<QrErrorCorrection, number> = {
  L: 0,
  M: 1,
  Q: 2,
  H: 3,
};
const FORMAT_BITS: Record<QrErrorCorrection, number> = {
  L: 1,
  M: 0,
  Q: 3,
  H: 2,
};

const ECC_PER_BLOCK: readonly (readonly number[])[] = [
  [
    -1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30,
    30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
  [
    -1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28,
    28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
  ],
  [
    -1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30,
    30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
  [
    -1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30,
    30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
];

const BLOCKS: readonly (readonly number[])[] = [
  [
    -1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19,
    19, 20, 21, 22, 24, 25,
  ],
  [
    -1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31,
    33, 35, 37, 38, 40, 43, 45, 47, 49,
  ],
  [
    -1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43,
    45, 48, 51, 53, 56, 59, 62, 65, 68,
  ],
  [
    -1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48,
    51, 54, 57, 60, 63, 66, 70, 74, 77, 81,
  ],
];

/** Bits available for data and error correction in a version. */
function rawModules(version: number): number {
  let n = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    n -= (25 * align - 10) * align - 55;
    if (version >= 7) n -= 36;
  }
  return n;
}

function dataCodewords(version: number, level: QrErrorCorrection): number {
  const l = LEVEL_INDEX[level];
  return Math.floor(rawModules(version) / 8) - ECC_PER_BLOCK[l]![version]! * BLOCKS[l]![version]!;
}

/** Byte-mode capacity in bytes, for a version and level. */
export function qrCapacity(version: number, level: QrErrorCorrection = 'M'): number {
  const countBits = version <= 9 ? 8 : 16;
  return Math.floor((dataCodewords(version, level) * 8 - 4 - countBits) / 8);
}

// --- Reed-Solomon over GF(2^8), polynomial 0x11D ------------------------------

function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree: number): number[] {
  const result: number[] = Array.from({ length: degree }, () => 0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMul(result[j]!, root);
      if (j + 1 < degree) result[j] = result[j]! ^ result[j + 1]!;
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function rsRemainder(data: readonly number[], divisor: readonly number[]): number[] {
  const result: number[] = Array.from({ length: divisor.length }, () => 0);
  for (const b of data) {
    const factor = b ^ result.shift()!;
    result.push(0);
    divisor.forEach((d, i) => {
      result[i] = result[i]! ^ gfMul(d, factor);
    });
  }
  return result;
}

// --- Data ---------------------------------------------------------------------

function dataWithEcc(bytes: readonly number[], version: number, level: QrErrorCorrection): number[] {
  const bits: number[] = [];
  const put = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  put(0b0100, 4); // byte mode
  put(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) put(b, 8);

  const capacityBits = dataCodewords(version, level) * 8;
  put(0, Math.min(4, capacityBits - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) put(pad, 8);

  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j]!;
    data.push(byte);
  }

  const l = LEVEL_INDEX[level];
  const blockCount = BLOCKS[l]![version]!;
  const eccLength = ECC_PER_BLOCK[l]![version]!;
  const raw = Math.floor(rawModules(version) / 8);
  const shortBlocks = blockCount - (raw % blockCount);
  const shortLength = Math.floor(raw / blockCount);
  const divisor = rsDivisor(eccLength);

  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < blockCount; i++) {
    const length = shortLength - eccLength + (i < shortBlocks ? 0 : 1);
    const block = data.slice(k, k + length);
    k += length;
    const ecc = rsRemainder(block, divisor);
    if (i < shortBlocks) block.push(0); // placeholder, skipped when interleaving
    blocks.push(block.concat(ecc));
  }

  const out: number[] = [];
  for (let i = 0; i < blocks[0]!.length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortLength - eccLength || j >= shortBlocks) out.push(block[i]!);
    });
  }
  return out;
}

// --- Matrix -------------------------------------------------------------------

function alignmentPositions(version: number): number[] {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const result = [6];
  for (let pos = version * 4 + 10; result.length < count; pos -= step) result.splice(1, 0, pos);
  return result;
}

const MASKS: readonly ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

class Grid {
  readonly modules: boolean[][];
  readonly fixed: boolean[][];
  constructor(readonly size: number) {
    this.modules = Array.from({ length: size }, () => Array.from({ length: size }, () => false));
    this.fixed = Array.from({ length: size }, () => Array.from({ length: size }, () => false));
  }
  set(x: number, y: number, dark: boolean) {
    this.modules[y]![x] = dark;
    this.fixed[y]![x] = true;
  }
}

function drawFunctionPatterns(g: Grid, version: number) {
  const { size } = g;
  for (let i = 0; i < size; i++) {
    g.set(6, i, i % 2 === 0);
    g.set(i, 6, i % 2 === 0);
  }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        g.set(x, y, d !== 2 && d !== 4);
      }
    }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);

  const align = alignmentPositions(version);
  const n = align.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          g.set(align[i]! + dx, align[j]! + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }

  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      g.set(a, b, dark);
      g.set(b, a, dark);
    }
  }
}

function drawFormat(g: Grid, level: QrErrorCorrection, mask: number) {
  const data = (FORMAT_BITS[level] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const bit = (i: number) => ((bits >>> i) & 1) === 1;
  const { size } = g;

  for (let i = 0; i <= 5; i++) g.set(8, i, bit(i));
  g.set(8, 7, bit(6));
  g.set(8, 8, bit(7));
  g.set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) g.set(14 - i, 8, bit(i));

  for (let i = 0; i < 8; i++) g.set(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) g.set(8, size - 15 + i, bit(i));
  g.set(8, size - 8, true);
}

function drawData(g: Grid, codewords: readonly number[]) {
  const { size } = g;
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (g.fixed[y]![x] || i >= codewords.length * 8) continue;
        g.modules[y]![x] = ((codewords[i >>> 3]! >>> (7 - (i & 7))) & 1) === 1;
        i++;
      }
    }
  }
}

function applyMask(g: Grid, mask: number) {
  const fn = MASKS[mask]!;
  for (let y = 0; y < g.size; y++) {
    for (let x = 0; x < g.size; x++) {
      if (!g.fixed[y]![x] && fn(x, y)) g.modules[y]![x] = !g.modules[y]![x];
    }
  }
}

const FINDER_LIKE = [
  [true, false, true, true, true, false, true, false, false, false, false],
  [false, false, false, false, true, false, true, true, true, false, true],
] as const;

/** The standard's four penalty rules; the mask with the lowest score wins. */
function penalty(modules: readonly (readonly boolean[])[]): number {
  const size = modules.length;
  let score = 0;
  const line = (get: (i: number) => boolean) => {
    let run = 1;
    for (let i = 1; i <= size; i++) {
      if (i < size && get(i) === get(i - 1)) run++;
      else {
        if (run >= 5) score += 3 + (run - 5);
        run = 1;
      }
    }
    for (let i = 0; i + 11 <= size; i++) {
      for (const pattern of FINDER_LIKE) {
        if (pattern.every((dark, k) => get(i + k) === dark)) score += 40;
      }
    }
  };
  for (let y = 0; y < size; y++) line((x) => modules[y]![x]!);
  for (let x = 0; x < size; x++) line((y) => modules[y]![x]!);

  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = modules[y]![x];
      if (c === modules[y]![x + 1] && c === modules[y + 1]![x] && c === modules[y + 1]![x + 1]) score += 3;
    }
  }

  let dark = 0;
  for (const row of modules) for (const m of row) if (m) dark++;
  const total = size * size;
  score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return score;
}

/**
 * Encode text as a QR code. Throws a RangeError when the text does not fit
 * a version-40 code at the chosen level.
 */
export function encodeQr(text: string, options: EncodeQrOptions = {}): QrMatrix {
  const errorCorrection = options.errorCorrection ?? 'M';
  const bytes = Array.from(new TextEncoder().encode(text));
  let version = Math.max(1, Math.min(40, Math.floor(options.minVersion ?? 1)));
  while (version <= 40 && qrCapacity(version, errorCorrection) < bytes.length) version++;
  if (version > 40) throw new RangeError(`Text is too long for a QR code (${bytes.length} bytes).`);

  const codewords = dataWithEcc(bytes, version, errorCorrection);
  const size = version * 4 + 17;

  let best: { mask: number; modules: boolean[][]; score: number } | null = null;
  for (let mask = 0; mask < 8; mask++) {
    const g = new Grid(size);
    drawFunctionPatterns(g, version);
    drawFormat(g, errorCorrection, mask); // reserves the format areas before data
    drawData(g, codewords);
    applyMask(g, mask);
    const score = penalty(g.modules);
    if (!best || score < best.score) best = { mask, modules: g.modules, score };
  }

  return {
    size,
    version,
    errorCorrection,
    mask: best!.mask,
    modules: best!.modules,
  };
}

/**
 * One SVG path for the dark modules, as horizontal runs, offset by a quiet
 * zone of `margin` modules. Draw it in a `0 0 size+2m size+2m` viewBox.
 */
export function qrPath(matrix: Pick<QrMatrix, 'size' | 'modules'>, margin = 4): string {
  const parts: string[] = [];
  matrix.modules.forEach((row, y) => {
    let x = 0;
    while (x < matrix.size) {
      if (!row[x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < matrix.size && row[x]) x++;
      parts.push(`M${start + margin} ${y + margin}h${x - start}v1h${start - x}z`);
    }
  });
  return parts.join('');
}
