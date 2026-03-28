/**
 * Computes a stable SHA-256 hash for a value that should not be sent in clear text.
 *
 * @param {string} value - Raw value to hash.
 * @returns {Promise<string>} Short hexadecimal digest safe for tracking payloads.
 */
export async function hashValue(value: string): Promise<string> {
  const encodedValue = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encodedValue);
  return toHexString(digest).slice(0, 16);
}

/**
 * Converts a byte buffer into its hexadecimal representation.
 *
 * @param {ArrayBuffer} buffer - Raw digest bytes.
 * @returns {string} Lowercase hexadecimal string.
 */
function toHexString(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}
