/**
 * Deterministic decorative placeholder for listings without a real photo —
 * a gradient generated from a hash of the listing's id, never presented as
 * an actual photo. Used on the listing detail page's premium gallery and
 * the homepage sponsor cards.
 */
function hashHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function placeholderGradient(seed: string, offset = 0): string {
  const hue = (hashHue(seed) + offset * 40) % 360;
  return `linear-gradient(135deg, hsl(${hue} 45% 38%), hsl(${(hue + 30) % 360} 45% 55%))`;
}
