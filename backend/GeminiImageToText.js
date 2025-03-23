// GeminiImageToText.js
require("dotenv").config()
const fs = require("fs")
const axios = require("axios")
const path = require("path")

class GeminiImageToText {
  constructor(taskType = "default") {
    this.apiKey = process.env.GEMINI_API_KEY
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY not found in environment variables")
    }

    this.baseUrl = "https://generativelanguage.googleapis.com/v1"
    this.modelName = "gemini-1.5-pro"
    this.imageParts = []
    this.prompts = {}
    this.taskType = taskType

    // Load the prompts during initialization
    this.loadPrompts()
  }

  loadPrompts() {
    const promptsDir = path.join(__dirname, "prompt")

    // Define the prompt files to load
    const promptFiles = {
      default: "geminiPrompt.txt",
      engineering: "ePrompt.txt",
      building: "bPrompt.txt",
      style: "sPrompt.txt",
    }

    // Load each prompt file
    for (const [key, filename] of Object.entries(promptFiles)) {
      const promptPath = path.join(promptsDir, filename)

      if (!fs.existsSync(promptPath)) {
        console.warn(`Prompt file not found: ${promptPath}`)
        continue
      }

      try {
        this.prompts[key] = fs.readFileSync(promptPath, "utf8")
        console.log(`Loaded ${key} prompt successfully`)
      } catch (error) {
        console.error(`Failed to load ${key} prompt: ${error.message}`)
      }
    }

    if (Object.keys(this.prompts).length === 0) {
      throw new Error("No prompts were loaded successfully")
    }
  }

  attachImage(imagePath) {
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`)
    }

    try {
      const imageBuffer = fs.readFileSync(imagePath)
      const base64Image = imageBuffer.toString("base64")

      const imagePart = {
        inlineData: {
          data: base64Image,
          mimeType: this.getMimeType(imagePath),
        },
      }

      this.imageParts = [imagePart]
      return "Image attached successfully"
    } catch (error) {
      throw new Error(`Failed to attach image: ${error.message}`)
    }
  }

  attachImages(imagePaths) {
    if (!Array.isArray(imagePaths) || imagePaths.length === 0) {
      throw new Error("No image paths provided")
    }

    this.imageParts = []

    for (const imagePath of imagePaths) {
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`)
      }

      try {
        const imageBuffer = fs.readFileSync(imagePath)
        const base64Image = imageBuffer.toString("base64")

        const imagePart = {
          inlineData: {
            data: base64Image,
            mimeType: this.getMimeType(imagePath),
          },
        }

        this.imageParts.push(imagePart)
      } catch (error) {
        throw new Error(`Failed to attach image ${imagePath}: ${error.message}`)
      }
    }

    return `${this.imageParts.length} images attached successfully`
  }

  getMimeType(filePath) {
    const extension = path.extname(filePath).toLowerCase()

    switch (extension) {
      case ".jpg":
      case ".jpeg":
        return "image/jpeg"
      case ".png":
        return "image/png"
      case ".gif":
        return "image/gif"
      case ".webp":
        return "image/webp"
      default:
        return "image/jpeg" // Default to JPEG
    }
  }

  async predict(promptType = "default", customPrompt = null) {
    if (this.imageParts.length === 0) {
      throw new Error("No images attached. Please attach at least one image first.")
    }

    // Use the custom prompt if provided, otherwise use the loaded prompt
    const promptText = customPrompt || this.prompts[promptType]
    if (!promptText) {
      throw new Error(`No prompt loaded for type: ${promptType}`)
    }

    try {
      const url = `${this.baseUrl}/models/${this.modelName}:generateContent?key=${this.apiKey}`

      // Prepare the parts array with the prompt text first
      const parts = [{ text: promptText }]

      // Add all image parts
      this.imageParts.forEach((imagePart) => {
        parts.push(imagePart)
      })

      const requestBody = {
        contents: [
          {
            parts: parts,
          },
        ],
      }

      const response = await axios.post(url, requestBody)

      if (!response.data || !response.data.candidates || response.data.candidates.length === 0) {
        throw new Error("No response generated from the API")
      }

      return response.data.candidates[0].content.parts[0].text
    } catch (error) {
      console.error("Gemini API Error:", error.response?.data || error.message)

      if (error.response?.data?.error) {
        throw new Error(`Gemini API error: ${error.response.data.error.message}`)
      } else {
        throw new Error(`Failed to generate text: ${error.message}`)
      }
    }
  }

  async generateInstructions(viewPaths, originalDescription = "") {
    try {
      console.log("Generating instructions from views...")

      // Validate input
      if (!viewPaths || !Array.isArray(viewPaths) || viewPaths.length === 0) {
        throw new Error("No view paths provided for instruction generation")
      }

      // Attach all the view images
      try {
        await this.attachImages(viewPaths)
        console.log(`Successfully attached ${viewPaths.length} view images`)
      } catch (error) {
        console.error("Error attaching images:", error)
        throw new Error(`Failed to attach images: ${error.message}`)
      }

      // Prepare the results object
      const results = {}

      // Store the original description
      results.original = originalDescription || ""
      console.log(`Using original description: "${results.original}"`)

      // Generate instructions using different prompts with the original description
      try {
        // Engineering instructions - include original description in the prompt
        const engineeringPrompt = this.prompts.engineering || ""
        const enhancedEngineeringPrompt = originalDescription
          ? `The following is a description of the object: "${originalDescription}"\n\n${engineeringPrompt}`
          : engineeringPrompt

        results.engineering = await this.predict("engineering", enhancedEngineeringPrompt)
        console.log("Generated engineering instructions")

        // Building instructions - include original description in the prompt
        const buildingPrompt = this.prompts.building || ""
        const enhancedBuildingPrompt = originalDescription
          ? `The following is a description of the object: "${originalDescription}"\n\n${buildingPrompt}`
          : buildingPrompt

        results.building = await this.predict("building", enhancedBuildingPrompt)
        console.log("Generated building instructions")

        // Style/supplier instructions - include original description in the prompt
        const stylePrompt = this.prompts.style || ""
        const enhancedStylePrompt = originalDescription
          ? `The following is a description of the object: "${originalDescription}"\n\n${stylePrompt}`
          : stylePrompt

        results.style = await this.predict("style", enhancedStylePrompt)
        console.log("Generated style/supplier instructions")

        return results
      } catch (error) {
        console.error("Error generating instructions:", error)
        throw new Error(`Failed to generate instructions: ${error.message}`)
      }
    } catch (error) {
      console.error("Error in generateInstructions:", error)
      throw new Error(`Failed to generate instructions: ${error.message}`)
    }
  }

  /**
   * Generate text using Gemini
   * @param {string} prompt - The prompt to send to Gemini
   * @returns {Promise<string>} The generated text
   */
  async generateText(prompt) {
    try {
      // If it's a custom prompt, use it directly without image parts
      const endpoint = `${this.baseUrl}/models/${this.modelName}:generateContent?key=${this.apiKey}`
      
      const requestBody = {
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 8192
        }
      }

      const response = await axios.post(endpoint, requestBody)
      
      // Extract and return the generated text
      if (
        response.data &&
        response.data.candidates &&
        response.data.candidates[0] &&
        response.data.candidates[0].content &&
        response.data.candidates[0].content.parts &&
        response.data.candidates[0].content.parts[0]
      ) {
        return response.data.candidates[0].content.parts[0].text
      } else {
        throw new Error("Unexpected response structure from Gemini API")
      }
    } catch (error) {
      console.error("Error generating text with Gemini:", error.message)
      throw error
    }
  }
}

module.exports = GeminiImageToText

