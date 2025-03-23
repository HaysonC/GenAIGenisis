// backend/LDRPartsLists.js
const fs = require("fs");
const path = require("path");

// Parse an LDR file to count parts and return the part list
const parseLDR = (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`LDR file not found: ${filePath}`);
  }

  const data = fs.readFileSync(filePath, "utf-8");
  const partCounts = {};

  const lines = data.split("\n");
  lines.forEach((line) => {
    const match = line.match(/^1 (\d+) .* (\S+)\.dat/); // Regex to match LDraw part line
    if (match) {
      const partFileName = match[2]; // part filename (e.g. 30068)
      if (partCounts[partFileName]) {
        partCounts[partFileName]++;
      } else {
        partCounts[partFileName] = 1;
      }
    }
  });

  return partCounts;
};

// Wrapper function to parse an LDR file and create a part list
const makeLDRparse = async (ldrFilePath) => {
  try {
    const partCounts = parseLDR(ldrFilePath);

    // Create the part list object
    const partList = Object.entries(partCounts).map(([fileName, count]) => ({
      fileName,
      count,
    }));

    return partList;
  } catch (error) {
    throw new Error(`Error parsing LDR file: ${error.message}`);
  }
};

module.exports = {
  parseLDR,
  makeLDRparse,
};
