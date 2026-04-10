#!/usr/bin/env bash
# generate-icons.sh — Generate PWA icons for TITAN
# Usage: ./scripts/generate-icons.sh
# Requires: ImageMagick (convert) or rsvg-convert, or falls back to Node.js

set -euo pipefail

OUTDIR="$(dirname "$0")/../public/icons"
mkdir -p "$OUTDIR"

SVG_FILE="/tmp/titan-icon.svg"

cat > "$SVG_FILE" << 'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="64" fill="#4f46e5"/>
  <text x="256" y="320" text-anchor="middle" font-size="300" font-weight="bold"
        fill="white" font-family="system-ui, -apple-system, sans-serif">T</text>
</svg>
SVG

if command -v convert &>/dev/null; then
  echo "Using ImageMagick..."
  convert -background none "$SVG_FILE" -resize 192x192 "$OUTDIR/icon-192.png"
  convert -background none "$SVG_FILE" -resize 512x512 "$OUTDIR/icon-512.png"
  echo "Generated icon-192.png and icon-512.png via ImageMagick"

elif command -v rsvg-convert &>/dev/null; then
  echo "Using rsvg-convert..."
  rsvg-convert -w 192 -h 192 "$SVG_FILE" -o "$OUTDIR/icon-192.png"
  rsvg-convert -w 512 -h 512 "$SVG_FILE" -o "$OUTDIR/icon-512.png"
  echo "Generated icon-192.png and icon-512.png via rsvg-convert"

elif command -v node &>/dev/null; then
  echo "Using Node.js fallback (solid color PNG)..."
  node - <<'NODEEOF'
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function createSolidPNG(width, height, r, g, b) {
  function crc32(buf) {
    const table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c;
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
      crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function chunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crcBuf = Buffer.concat([typeBytes, data]);
    const crcVal = Buffer.alloc(4);
    crcVal.writeUInt32BE(crc32(crcBuf));
    return Buffer.concat([len, typeBytes, data, crcVal]);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const rawData = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = y * (1 + width * 3) + 1 + x * 3;
      rawData[offset] = r; rawData[offset + 1] = g; rawData[offset + 2] = b;
    }
  }
  const compressed = zlib.deflateSync(rawData, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

const outDir = process.env.OUTDIR || 'public/icons';
fs.mkdirSync(outDir, { recursive: true });
// Indigo #4f46e5 = rgb(79, 70, 229)
fs.writeFileSync(path.join(outDir, 'icon-192.png'), createSolidPNG(192, 192, 79, 70, 229));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), createSolidPNG(512, 512, 79, 70, 229));
console.log('Generated solid-color icons (indigo #4f46e5)');
NODEEOF

else
  echo "ERROR: No icon generation tool found (tried: ImageMagick, rsvg-convert, node)"
  echo "Install one of: brew install imagemagick  OR  brew install librsvg"
  exit 1
fi

echo "Icons written to $OUTDIR"
