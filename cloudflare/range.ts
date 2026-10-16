export type ByteRange = { offset: number; length: number };
/** Single RFC 9110 byte range. Multipart ranges are deliberately rejected. */
export function parseRange(header: string, size: number): ByteRange | null {
  if (!Number.isSafeInteger(size) || size <= 0) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return null;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    const length = Math.min(size, suffix);
    return { offset: size - length, length };
  }
  const offset = Number(match[1]);
  const end = match[2] ? Number(match[2]) : size - 1;
  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(end) ||
    offset < 0 ||
    offset >= size ||
    end < offset
  )
    return null;
  return { offset, length: Math.min(end, size - 1) - offset + 1 };
}
