const sharp = require('sharp');
const path = require('path');

const sizes = [192, 512];
const iconDir = path.join(__dirname, '../public/icons');
const logoPath = path.join(iconDir, 'logo.png');

async function generateIcons() {
    for (const size of sizes) {
        const outputPath = path.join(iconDir, `icon-${size}x${size}.png`);
        await sharp(logoPath)
            .resize(size, size)
            .png()
            .toFile(outputPath);
        console.log(`Generated: ${outputPath}`);
    }
}

generateIcons().catch(console.error);
