import sharp from 'sharp';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = resolve(__dirname, '../client/public/icon.svg');
const outDir = resolve(__dirname, '../client/public');

const svgBuffer = readFileSync(svgPath);

const sizes = [
  { name: 'favicon.png', size: 64 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
];

for (const { name, size } of sizes) {
  await sharp(svgBuffer, { density: Math.round(72 * size / 512 * 4) })
    .resize(size, size)
    .png()
    .toFile(resolve(outDir, name));
  console.log(`Generated ${name} (${size}x${size})`);
}

console.log('Done!');
