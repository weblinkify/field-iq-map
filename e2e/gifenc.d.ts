declare module 'gifenc' {
  const gifenc: {
    quantize: typeof quantize;
    applyPalette: typeof applyPalette;
    GIFEncoder: typeof GIFEncoder;
  };
  export default gifenc;
  export type Palette = number[][];
  export function quantize(rgba: Uint8Array | Buffer, maxColors: number): Palette;
  export function applyPalette(rgba: Uint8Array | Buffer, palette: Palette): Uint8Array;
  export function GIFEncoder(): {
    writeFrame(index: Uint8Array, width: number, height: number, opts: { palette: Palette; delay: number }): void;
    finish(): void;
    bytes(): Uint8Array;
  };
}
