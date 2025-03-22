// testLDRSampler.js
require("dotenv").config()
const fs = require("fs")
const path = require("path")
const LDRSampler = require("./sampleFromLDR") // Fixed import path
const GeminiImageToText = require("./GeminiImageToText")

async function testLDRSampling(ldrFilePath) {
  try {
    console.log("Starting LDR sampling test...")

    // Initialize the LDR sampler
    const sampler = new LDRSampler()

    // Sample views from the LDR file
    console.log(`Sampling views from: ${ldrFilePath}`)
    let result

    // Try the primary method first, fall back to LDView if available
    try {
      result = await sampler.sampleViews(ldrFilePath)
      console.log("Successfully used placeholder view generation")
    } catch (error) {
      console.log("Falling back to LDView method...")
      try {
        result = sampler.sampleViewsWithLDView(ldrFilePath)
        console.log("Successfully used LDView for view generation")
      } catch (ldViewError) {
        console.error("Both view generation methods failed:", error, ldViewError)
        throw new Error(`Failed to generate views: ${error.message} | ${ldViewError.message}`)
      }
    }

    console.log("View sampling complete!")
    console.log(`Model ID: ${result.modelId}`)
    console.log(`Generated ${result.viewPaths.length} views:`)
    result.viewPaths.forEach((path) => console.log(`- ${path}`))

    // Initialize Gemini for instruction generation
    console.log("\nGenerating instructions from views...")
    const gemini = new GeminiImageToText()

    // Generate instructions based on the views
    const instructions = await gemini.generateInstructions(result.viewPaths)

    // Save the instructions to files
    const instructionsDir = path.join(__dirname, "instructions", result.modelId)
    if (!fs.existsSync(instructionsDir)) {
      fs.mkdirSync(instructionsDir, { recursive: true })
    }

    for (const [type, text] of Object.entries(instructions)) {
      const filePath = path.join(instructionsDir, `${type}.txt`)
      fs.writeFileSync(filePath, text)
      console.log(`Saved ${type} instructions to: ${filePath}`)
    }

    // Print a sample of each instruction type
    console.log("\n=== ENGINEERING INSTRUCTIONS (SAMPLE) ===")
    console.log(instructions.engineering.substring(0, 300) + "...\n")

    console.log("=== BUILDING INSTRUCTIONS (SAMPLE) ===")
    console.log(instructions.building.substring(0, 300) + "...\n")

    console.log("=== STYLE INSTRUCTIONS (SAMPLE) ===")
    console.log(instructions.style.substring(0, 300) + "...\n")

    console.log("Test completed successfully!")
    return result.modelId
  } catch (error) {
    console.error("Test failed:", error)
    throw error
  }
}

// Check if a file path was provided as a command-line argument
if (process.argv.length < 3) {
  console.log("Usage: node testLDRSampler.js <path-to-ldr-file>")
  process.exit(1)
}

const ldrFilePath = process.argv[2]
testLDRSampling(ldrFilePath)
  .then((modelId) => {
    console.log(`\nAll processing complete for model: ${modelId}`)
  })
  .catch((error) => {
    console.error("Error in test:", error)
    process.exit(1)
  })

