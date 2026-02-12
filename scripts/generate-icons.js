/**
 * PWA Icon Generator Script
 * Run with: node scripts/generate-icons.js
 * 
 * This creates simple PNG icons for PWA installation.
 * Uses a canvas-like approach to generate minimal PNG files.
 */

const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const outputDir = path.join(__dirname, '..', 'public', 'icons');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Create a minimal PNG file with the YolTakip logo
// This generates a valid PNG with a blue circle and white road icon
function createPNG(size) {
    // PNG header
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    // Create image data (RGBA)
    const pixels = Buffer.alloc(size * size * 4);
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size * 0.45;
    const innerRadius = size * 0.35;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const idx = (y * size + x) * 4;
            const dx = x - centerX;
            const dy = y - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= radius) {
                // Blue circle background (#2563EB)
                pixels[idx] = 37;     // R
                pixels[idx + 1] = 99; // G
                pixels[idx + 2] = 235; // B
                pixels[idx + 3] = 255; // A

                // White road/navigation icon in center
                const roadWidth = size * 0.06;
                const roadLength = size * 0.3;

                // Vertical road
                if (Math.abs(dx) < roadWidth && Math.abs(dy) < roadLength) {
                    pixels[idx] = 255;
                    pixels[idx + 1] = 255;
                    pixels[idx + 2] = 255;
                    pixels[idx + 3] = 255;
                }

                // Navigation arrow top
                const arrowY = -roadLength * 0.6;
                const arrowDy = dy - arrowY;
                if (arrowDy > -roadWidth * 4 && arrowDy < 0 && Math.abs(dx) < (-arrowDy * 1.2)) {
                    pixels[idx] = 255;
                    pixels[idx + 1] = 255;
                    pixels[idx + 2] = 255;
                    pixels[idx + 3] = 255;
                }

                // Small dot at bottom
                const dotY = roadLength * 0.7;
                const dotDist = Math.sqrt(dx * dx + (dy - dotY) * (dy - dotY));
                if (dotDist < roadWidth * 1.5) {
                    pixels[idx] = 255;
                    pixels[idx + 1] = 255;
                    pixels[idx + 2] = 255;
                    pixels[idx + 3] = 255;
                }
            } else {
                // Transparent background
                pixels[idx] = 0;
                pixels[idx + 1] = 0;
                pixels[idx + 2] = 0;
                pixels[idx + 3] = 0;
            }
        }
    }

    // Compress with basic zlib (deflate)
    const zlib = require('zlib');

    // Add filter byte (0 = None) at start of each row
    const rawData = Buffer.alloc(size * (size * 4 + 1));
    for (let y = 0; y < size; y++) {
        rawData[y * (size * 4 + 1)] = 0; // Filter: None
        pixels.copy(rawData, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
    }

    const compressed = zlib.deflateSync(rawData);

    // Build PNG chunks
    function createChunk(type, data) {
        const length = Buffer.alloc(4);
        length.writeUInt32BE(data.length);

        const typeBuffer = Buffer.from(type);
        const crcData = Buffer.concat([typeBuffer, data]);

        const crc = Buffer.alloc(4);
        crc.writeUInt32BE(crc32(crcData));

        return Buffer.concat([length, typeBuffer, data, crc]);
    }

    // CRC32 calculation
    function crc32(buf) {
        let crc = 0xFFFFFFFF;
        const table = [];
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) {
                c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            }
            table[i] = c;
        }
        for (let i = 0; i < buf.length; i++) {
            crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    // IHDR chunk
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);  // width
    ihdr.writeUInt32BE(size, 4);  // height
    ihdr[8] = 8;  // bit depth
    ihdr[9] = 6;  // color type (RGBA)
    ihdr[10] = 0; // compression
    ihdr[11] = 0; // filter
    ihdr[12] = 0; // interlace

    // IEND chunk
    const iendData = Buffer.alloc(0);

    const png = Buffer.concat([
        signature,
        createChunk('IHDR', ihdr),
        createChunk('IDAT', compressed),
        createChunk('IEND', iendData)
    ]);

    return png;
}

// Generate all sizes
for (const size of sizes) {
    const png = createPNG(size);
    const filename = `icon-${size}x${size}.png`;
    fs.writeFileSync(path.join(outputDir, filename), png);
    console.log(`✅ Generated ${filename} (${png.length} bytes)`);
}

// Generate maskable icon (with padding/safe area)
function createMaskablePNG(size) {
    const zlib = require('zlib');
    const pixels = Buffer.alloc(size * size * 4);
    const centerX = size / 2;
    const centerY = size / 2;
    // Maskable icons should have safe area (inner 80%)
    const radius = size * 0.35;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const idx = (y * size + x) * 4;
            const dx = x - centerX;
            const dy = y - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Full blue background for maskable
            pixels[idx] = 37;     // R
            pixels[idx + 1] = 99; // G
            pixels[idx + 2] = 235; // B
            pixels[idx + 3] = 255; // A

            // White icon in center (smaller for safe area)
            const roadWidth = size * 0.04;
            const roadLength = size * 0.22;

            if (Math.abs(dx) < roadWidth && Math.abs(dy) < roadLength) {
                pixels[idx] = 255;
                pixels[idx + 1] = 255;
                pixels[idx + 2] = 255;
            }

            const arrowY = -roadLength * 0.6;
            const arrowDy = dy - arrowY;
            if (arrowDy > -roadWidth * 4 && arrowDy < 0 && Math.abs(dx) < (-arrowDy * 1.2)) {
                pixels[idx] = 255;
                pixels[idx + 1] = 255;
                pixels[idx + 2] = 255;
            }

            const dotY = roadLength * 0.7;
            const dotDist = Math.sqrt(dx * dx + (dy - dotY) * (dy - dotY));
            if (dotDist < roadWidth * 1.5) {
                pixels[idx] = 255;
                pixels[idx + 1] = 255;
                pixels[idx + 2] = 255;
            }
        }
    }

    const rawData = Buffer.alloc(size * (size * 4 + 1));
    for (let y = 0; y < size; y++) {
        rawData[y * (size * 4 + 1)] = 0;
        pixels.copy(rawData, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
    }

    const compressed = zlib.deflateSync(rawData);

    function createChunk(type, data) {
        const length = Buffer.alloc(4);
        length.writeUInt32BE(data.length);
        const typeBuffer = Buffer.from(type);
        const crcData = Buffer.concat([typeBuffer, data]);
        const crc = Buffer.alloc(4);
        crc.writeUInt32BE(crc32(crcData));
        return Buffer.concat([length, typeBuffer, data, crc]);
    }

    function crc32(buf) {
        let crc = 0xFFFFFFFF;
        const table = [];
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) {
                c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            }
            table[i] = c;
        }
        for (let i = 0; i < buf.length; i++) {
            crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);
    ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;

    return Buffer.concat([
        signature,
        createChunk('IHDR', ihdr),
        createChunk('IDAT', compressed),
        createChunk('IEND', Buffer.alloc(0))
    ]);
}

const maskable = createMaskablePNG(512);
fs.writeFileSync(path.join(outputDir, 'maskable-512x512.png'), maskable);
console.log(`✅ Generated maskable-512x512.png (${maskable.length} bytes)`);

console.log('\n🎉 All PWA icons generated successfully!');
