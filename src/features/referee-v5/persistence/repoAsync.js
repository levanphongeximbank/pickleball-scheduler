/** Normalize sync or async repository return values. */
export async function repoVal(value) {
  return value instanceof Promise ? value : value;
}
