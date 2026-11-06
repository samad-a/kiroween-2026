/**
 * Encode an SVG string as a base64 data URL. Phaser's loader decodes data URLs
 * with atob, so percent-encoding does not work here.
 */
export function svgUrl(svg: string): string {
  const bytes = new TextEncoder().encode(svg);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}
