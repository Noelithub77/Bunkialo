// Widget backgrounds only accept solid colours, so gradients are drawn into a small
// PNG that the widget layers behind its content.

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const uint32 = (value: number): number[] => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
];

const chunk = (type: string, data: Uint8Array): Uint8Array => {
  const typed = new Uint8Array([...type].map((letter) => letter.charCodeAt(0)));
  const body = new Uint8Array(typed.length + data.length);
  body.set(typed);
  body.set(data, typed.length);
  return new Uint8Array([...uint32(data.length), ...body, ...uint32(crc32(body))]);
};

// Uncompressed zlib stream: the image is tiny, so stored blocks keep this dependency-free.
const zlibStored = (raw: Uint8Array): Uint8Array => {
  const blocks: number[] = [0x78, 0x01];
  for (let offset = 0; offset < raw.length || offset === 0; offset += 65535) {
    const length = Math.min(65535, raw.length - offset);
    const last = offset + length >= raw.length ? 1 : 0;
    blocks.push(last, length & 0xff, length >>> 8, ~length & 0xff, (~length >>> 8) & 0xff);
    for (let index = 0; index < length; index += 1) blocks.push(raw[offset + index]);
    if (last) break;
  }
  let a = 1;
  let b = 0;
  for (const byte of raw) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return new Uint8Array([...blocks, ...uint32(((b << 16) | a) >>> 0)]);
};

const parseHex = (hex: string): [number, number, number] => {
  const value = /^#[\da-f]{6}$/i.test(hex) ? hex : "#A78BFA";
  const channel = (index: number) => Number.parseInt(value.slice(index, index + 2), 16);
  return [channel(1), channel(3), channel(5)];
};

/**
 * Bunkialo's card gradient with a soft accent glow from the top-left corner:
 * #1C1C1C to #050505 in dark mode, white to #EFEFEF in light mode.
 */
export const encodeWidgetGradient = (
  accent: string,
  dark = true,
  size = 96,
): Uint8Array => {
  const [red, green, blue] = parseHex(accent);
  const [from, to, strength] = dark ? [28, 5, 0.3] : [255, 239, 0.2];
  const raw = new Uint8Array(size * (size * 3 + 1));
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const u = x / (size - 1);
      const v = y / (size - 1);
      const base = from + (to - from) * ((u + v) / 2);
      const glow = strength * Math.max(0, 1 - Math.hypot(u, v * 1.15) / 0.95) ** 2;
      const pixel = row + 1 + x * 3;
      raw[pixel] = Math.round(base + (red - base) * glow);
      raw[pixel + 1] = Math.round(base + (green - base) * glow);
      raw[pixel + 2] = Math.round(base + (blue - base) * glow);
    }
  }
  const header = new Uint8Array([...uint32(size), ...uint32(size), 8, 2, 0, 0, 0]);
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", zlibStored(raw)),
    chunk("IEND", new Uint8Array()),
  ];
  const png = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    png.set(part, offset);
    offset += part.length;
  }
  return png;
};
