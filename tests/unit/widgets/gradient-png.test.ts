import { describe, expect, test } from "bun:test";
import { inflateSync } from "node:zlib";
import { encodeWidgetGradient } from "@/widgets/gradient-png";

const readChunks = (png: Uint8Array) => {
  const view = new DataView(png.buffer);
  const chunks: { type: string; data: Uint8Array }[] = [];
  for (let offset = 8; offset < png.length; ) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...png.slice(offset + 4, offset + 8));
    chunks.push({ type, data: png.slice(offset + 8, offset + 8 + length) });
    offset += 12 + length;
  }
  return chunks;
};

describe("widget gradient png", () => {
  test("is a valid RGB PNG with an accent glow over a dark base", () => {
    const png = encodeWidgetGradient("#22C55E", true, 32);
    expect([...png.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const chunks = readChunks(png);
    expect(chunks.map((chunk) => chunk.type)).toEqual(["IHDR", "IDAT", "IEND"]);
    const pixels = inflateSync(chunks[1].data);
    expect(pixels.length).toBe(32 * (32 * 3 + 1));
    const pixel = (x: number, y: number) =>
      [...pixels.slice(y * 97 + 1 + x * 3, y * 97 + 4 + x * 3)];
    const [red, green] = pixel(0, 0);
    expect(green).toBeGreaterThan(red);
    expect(pixel(31, 31)).toEqual([5, 5, 5]);
  });

  test("draws a light gradient for light mode", () => {
    const pixels = inflateSync(readChunks(encodeWidgetGradient("#22C55E", false, 16))[1].data);
    expect([...pixels.slice(15 * 49 + 1 + 15 * 3, 15 * 49 + 4 + 15 * 3)]).toEqual([239, 239, 239]);
  });

  test("uses a fallback accent for invalid colours", () => {
    expect(encodeWidgetGradient("not-a-colour", true, 8).length).toBeGreaterThan(0);
  });

  test("matches the timetable card's course-colour gradient stops", () => {
    const pixels = inflateSync(readChunks(encodeWidgetGradient("#22C55E", true, 9, "course"))[1].data);
    const pixel = (x: number, y: number) => [...pixels.slice(y * 28 + 1 + x * 3, y * 28 + 4 + x * 3)];
    expect(pixel(0, 0)).toEqual([17, 90, 49]);
    expect(pixel(4, 4)).toEqual([10, 44, 29]);
    expect(pixel(8, 8)).toEqual([4, 7, 13]);
    const violet = encodeWidgetGradient("#A78BFA", true, 9, "course");
    expect(violet).not.toEqual(encodeWidgetGradient("#22C55E", true, 9, "course"));
  });
});
