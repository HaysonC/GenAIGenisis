// ldrPartsUtils.js
const fs = require("fs")
const path = require("path")

// Parse an LDR file to count parts and return the part list
const parseLDR = (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`LDR file not found: ${filePath}`)
  }

  const data = fs.readFileSync(filePath, "utf-8")
  const partCounts = {}
  const colorCounts = {}

  const lines = data.split("\n")
  lines.forEach((line) => {
    const match = line.match(/^1 (\d+) .* (\S+)\.dat/) // Regex to match LDraw part line
    if (match) {
      const colorCode = match[1] // color code
      const partFileName = match[2] // part filename (e.g. 30068)

      // Count parts
      if (partCounts[partFileName]) {
        partCounts[partFileName]++
      } else {
        partCounts[partFileName] = 1
      }

      // Count colors for each part
      const colorKey = `${partFileName}_${colorCode}`
      if (colorCounts[colorKey]) {
        colorCounts[colorKey]++
      } else {
        colorCounts[colorKey] = 1
      }
    }
  })

  return { partCounts, colorCounts }
}

// Wrapper function to parse an LDR file and create a part list
const makeLDRparse = async (ldrFilePath) => {
  try {
    const { partCounts, colorCounts } = parseLDR(ldrFilePath)

    // Create the part list object with color information
    const partList = Object.entries(partCounts).map(([fileName, count]) => {
      // Get all color variations for this part
      const colorVariations = Object.entries(colorCounts)
        .filter(([key, _]) => key.startsWith(`${fileName}_`))
        .map(([key, colorCount]) => {
          const colorCode = key.split("_")[1]
          return { colorCode, count: colorCount }
        })

      return {
        fileName,
        totalCount: count,
        colorVariations,
      }
    })

    return partList
  } catch (error) {
    throw new Error(`Error parsing LDR file: ${error.message}`)
  }
}

// Get LDraw color information
const getLDrawColors = () => {
  return {
    // Basic colors
    0: { name: "Black", hex: "#05131D" },
    1: { name: "Blue", hex: "#0055BF" },
    2: { name: "Green", hex: "#237841" },
    3: { name: "Dark Turquoise", hex: "#008F9B" },
    4: { name: "Red", hex: "#C91A09" },
    5: { name: "Dark Pink", hex: "#C870A0" },
    6: { name: "Brown", hex: "#583927" },
    7: { name: "Light Gray", hex: "#9BA19D" },
    8: { name: "Dark Gray", hex: "#6D6E5C" },
    9: { name: "Light Blue", hex: "#B4D2E3" },
    10: { name: "Bright Green", hex: "#4B9F4A" },
    11: { name: "Turquoise", hex: "#55A5AF" },
    12: { name: "Salmon", hex: "#F2705E" },
    13: { name: "Pink", hex: "#FC97AC" },
    14: { name: "Yellow", hex: "#F2CD37" },
    15: { name: "White", hex: "#FFFFFF" },
    16: { name: "Clear", hex: "#FFFFFF" },
    // Add more colors as needed
  }
}

module.exports = {
  parseLDR,
  makeLDRparse,
  getLDrawColors,
}

