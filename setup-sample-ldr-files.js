/**
 * Script to copy sample LDR files to the public directory 
 * for the LDR viewer page to access them
 */

const fs = require('fs');
const path = require('path');

// Paths
const samplesDir = path.join(__dirname, 'my-app', 'public', 'samples');
const ldrFile1 = path.join(__dirname, 'lego_model.ldr');
const ldrFile2 = path.join(__dirname, 'lego_model2.ldr');

// Create samples directory if it doesn't exist
if (!fs.existsSync(samplesDir)) {
  console.log(`Creating samples directory: ${samplesDir}`);
  fs.mkdirSync(samplesDir, { recursive: true });
}

// Copy the LDR files
function copyFile(source, dest) {
  try {
    if (fs.existsSync(source)) {
      const filename = path.basename(source);
      const destination = path.join(dest, filename);
      
      fs.copyFileSync(source, destination);
      console.log(`Copied ${filename} to ${destination}`);
    } else {
      console.error(`Source file not found: ${source}`);
    }
  } catch (err) {
    console.error(`Error copying file ${source}:`, err);
  }
}

// Copy both files
copyFile(ldrFile1, samplesDir);
copyFile(ldrFile2, samplesDir);

console.log('Sample LDR files setup complete.'); 