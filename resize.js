const Jimp = require('jimp-compact');

async function makeSquare() {
  try {
    const image = await Jimp.read('G:/Styrka_app/styrka-logo.png');
    
    // We want a square image, but we also want padding so it doesn't get cut off by adaptive icon masks.
    const canvasSize = 1536; // 1.5x of 1024
    
    // Create transparent background
    const background = new Jimp(canvasSize, canvasSize, 0x00000000);
    
    // Center the original 1024x652 image
    const x = (canvasSize - 1024) / 2;
    const y = (canvasSize - 652) / 2;
    
    background.composite(image, x, y);
    
    // Resize down to exactly 1024x1024 for Expo
    background.resize(1024, 1024);
    
    await background.writeAsync('G:/Styrka_app/styrka-icon.png');
    console.log('Square padded icon created successfully!');
  } catch (err) {
    console.error('Error creating icon:', err);
  }
}

makeSquare();
