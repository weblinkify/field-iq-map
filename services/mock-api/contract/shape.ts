/** Structural fingerprint of a JSON value: keys and value types, not values. */
export type Shape = string | Shape[] | { [key: string]: Shape };

export function shape(value: unknown): Shape {
  if (value === null) return 'null';
  if (Array.isArray(value)) return value.length === 0 ? 'array:empty' : ['array', shape(value[0])];
  if (typeof value === 'object') {
    const out: Record<string, Shape> = {};
    for (const key of Object.keys(value as object).sort())
      out[key] = shape((value as Record<string, unknown>)[key]);
    return out;
  }
  return typeof value;
}
