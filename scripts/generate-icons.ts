/**
 * Generate Claudit icons - A smiley "C" icon
 * Run with: npx tsx scripts/generate-icons.ts
 */

import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ICONS_DIR = path.join(__dirname, "../src-tauri/icons");

// Ensure directory exists
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

// SVG for the smiley C icon (app icon with background)
// The "C" IS the smile/mouth of the face
function createAppIconSVG(size: number): string {
  const centerX = size / 2;
  const centerY = size / 2;

  // C-mouth parameters - positioned as the smile
  const cRadius = size * 0.28;
  const cCenterY = centerY + size * 0.08; // Lower than center (it's the mouth)
  const strokeWidth = size * 0.09;

  // Eye positions - above the C mouth
  const eyeRadius = size * 0.065;
  const eyeOffsetX = size * 0.15;
  const eyeY = centerY - size * 0.12;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background with rounded corners -->
  <rect x="0" y="0" width="${size}" height="${size}" rx="${size * 0.22}" fill="#18181b"/>

  <!-- Gradient for the face -->
  <defs>
    <linearGradient id="cGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#34d399"/>
      <stop offset="100%" style="stop-color:#059669"/>
    </linearGradient>
  </defs>

  <!-- Left eye -->
  <circle cx="${centerX - eyeOffsetX}" cy="${eyeY}" r="${eyeRadius}" fill="url(#cGradient)"/>

  <!-- Right eye -->
  <circle cx="${centerX + eyeOffsetX}" cy="${eyeY}" r="${eyeRadius}" fill="url(#cGradient)"/>

  <!-- The C shape as the MOUTH/SMILE -->
  <path d="M ${centerX + cRadius * Math.cos(0.2 * Math.PI)} ${cCenterY + cRadius * Math.sin(0.2 * Math.PI)}
           A ${cRadius} ${cRadius} 0 1 0
           ${centerX + cRadius * Math.cos(1.8 * Math.PI)} ${cCenterY + cRadius * Math.sin(1.8 * Math.PI)}"
        fill="none"
        stroke="url(#cGradient)"
        stroke-width="${strokeWidth}"
        stroke-linecap="round"/>
</svg>`;
}

// SVG for the tray icon (monochrome, no background)
// The "C" IS the smile/mouth of the face
function createTrayIconSVG(size: number): string {
  const centerX = size / 2;
  const centerY = size / 2;

  // C-mouth parameters - positioned as the smile
  const cRadius = size * 0.32;
  const cCenterY = centerY + size * 0.08;
  const strokeWidth = size * 0.12;

  // Eye positions - above the C mouth
  const eyeRadius = size * 0.08;
  const eyeOffsetX = size * 0.18;
  const eyeY = centerY - size * 0.14;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Left eye -->
  <circle cx="${centerX - eyeOffsetX}" cy="${eyeY}" r="${eyeRadius}" fill="#000000"/>

  <!-- Right eye -->
  <circle cx="${centerX + eyeOffsetX}" cy="${eyeY}" r="${eyeRadius}" fill="#000000"/>

  <!-- The C shape as the MOUTH/SMILE -->
  <path d="M ${centerX + cRadius * Math.cos(0.15 * Math.PI)} ${cCenterY + cRadius * Math.sin(0.15 * Math.PI)}
           A ${cRadius} ${cRadius} 0 1 0
           ${centerX + cRadius * Math.cos(1.85 * Math.PI)} ${cCenterY + cRadius * Math.sin(1.85 * Math.PI)}"
        fill="none"
        stroke="#000000"
        stroke-width="${strokeWidth}"
        stroke-linecap="round"/>
</svg>`;
}

async function generateIcon(svg: string, outputPath: string, size: number) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(outputPath);
  console.log(`Generated: ${path.basename(outputPath)}`);
}

async function main() {
  console.log("Generating Claudit icons...\n");

  // Generate tray icon (22x22 for macOS menu bar)
  const traySvg = createTrayIconSVG(44); // 2x for retina
  await generateIcon(traySvg, path.join(ICONS_DIR, "tray-icon.png"), 22);

  // Generate app icons
  const sizes = [
    { size: 32, name: "32x32.png" },
    { size: 128, name: "128x128.png" },
    { size: 256, name: "128x128@2x.png" },
    { size: 512, name: "icon-512.png" }, // For icns generation
    { size: 1024, name: "icon-1024.png" }, // For icns generation
  ];

  for (const { size, name } of sizes) {
    const svg = createAppIconSVG(size);
    await generateIcon(svg, path.join(ICONS_DIR, name), size);
  }

  console.log("\n✅ PNG icons generated!");
  console.log("\nTo generate icon.icns (macOS), run:");
  console.log("  mkdir -p icon.iconset");
  console.log("  cp src-tauri/icons/32x32.png icon.iconset/icon_32x32.png");
  console.log("  cp src-tauri/icons/128x128.png icon.iconset/icon_128x128.png");
  console.log("  cp src-tauri/icons/128x128@2x.png icon.iconset/icon_128x128@2x.png");
  console.log("  cp src-tauri/icons/icon-512.png icon.iconset/icon_256x256@2x.png");
  console.log("  cp src-tauri/icons/icon-512.png icon.iconset/icon_512x512.png");
  console.log("  cp src-tauri/icons/icon-1024.png icon.iconset/icon_512x512@2x.png");
  console.log("  iconutil -c icns icon.iconset -o src-tauri/icons/icon.icns");
  console.log("  rm -rf icon.iconset");
  console.log("\nFor icon.ico (Windows), use an online converter or:");
  console.log("  convert src-tauri/icons/icon-512.png src-tauri/icons/icon.ico");
}

main().catch(console.error);
