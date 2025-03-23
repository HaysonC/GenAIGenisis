// ShapeGenerator.js
require("dotenv").config()
const axios = require("axios")
const fs = require("fs")
const path = require("path")

class ShapeGenerator {
  constructor() {
    // Get API endpoint from environment variables or use default
    this.apiEndpoint =
      process.env.SHAPE_API_URL

    // Set up models directory
    this.modelsDir = path.join(__dirname, "models")

    // Create models directory if it doesn't exist
    if (!fs.existsSync(this.modelsDir)) {
      fs.mkdirSync(this.modelsDir, { recursive: true })
    }

    console.log(`ShapeGenerator initialized with API endpoint: ${this.apiEndpoint}`)
  }

  /**
   * Generate a 3D model from a text prompt
   * @param {string} prompt - Text description of the 3D model
   * @param {Object} options - Generation options
   * @param {number} options.guidance_scale - Guidance scale for model generation (default: 15.0)
   * @param {number} options.num_steps - Number of diffusion steps (default: 24)
   * @param {number} options.seed - Random seed for reproducibility (optional)
   * @returns {Promise<Object>} - Object containing filename, filePath, and URL
   */
  async generateModel(prompt, options = {}) {
    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      throw new Error("A valid prompt is required")
    }

    // Set default options
    const guidance_scale = options.guidance_scale || 15.0
    const num_steps = options.num_steps || 24
    const seed = options.seed || null

    console.log(`Generating 3D model for prompt: '${prompt}'`)
    console.log(`Parameters: guidance_scale=${guidance_scale}, num_steps=${num_steps}, seed=${seed}`)

    // Prepare parameters
    const params = {
      prompt: prompt,
      guidance_scale: guidance_scale,
      num_steps: num_steps,
    }

    if (seed !== null) {
      params.seed = seed
    }

    // Generate a safe filename based on the prompt
    const safePrompt = prompt.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30)
    const timestamp = Date.now()
    const filename = `${safePrompt}_${timestamp}.obj`
    const filePath = path.join(this.modelsDir, filename)

    try {
      console.log(`Sending request to ${this.apiEndpoint}`)

      // Send POST request to the API with a 5-minute timeout
      const response = await axios({
        method: "post",
        url: this.apiEndpoint,
        params: params,
        responseType: "arraybuffer",
        timeout: 300000, // 5 minute timeout
      })

      // Check if request was successful
      if (response.status !== 200) {
        throw new Error(`API returned status code ${response.status}`)
      }

      // Get content size
      const contentSize = response.data.length
      console.log(`Received response: ${(contentSize / 1024).toFixed(1)} KB`)

      // Ensure content is not empty
      if (contentSize < 100) {
        throw new Error(`Received suspiciously very small file (${contentSize} bytes)`)
      }

      // Save the content to a file
      fs.writeFileSync(filePath, response.data)

      console.log(`Successfully saved 3D model to ${filePath}`)

      // Get file size
      const fileSize = fs.statSync(filePath).size
      console.log(`File size: ${(fileSize / 1024).toFixed(1)} KB`)

      // Convert STL to GLB for web viewing (this would require a separate conversion utility)
      // For now, we'll just return the STL file path

      return {
        filename,
        filePath,
        url: `/models/${filename}`,
        fileSize: fileSize,
      }
    } catch (error) {
      console.error("Error generating 3D model:", error)

      if (error.response) {
        console.error(`Status: ${error.response.status}`)
        console.error(`Response: ${error.response.data}`)
      }

      throw new Error(`Failed to generate 3D model: ${error.message}`)
    }
  }

  /**
   * Improve an existing 3D model based on text instructions
   * @param {string} modelId - ID of the existing model to improve
   * @param {string} instructions - Text instructions for improvement
   * @returns {Promise<Object>} - Object containing filename, filePath, and URL
   */
  async improveModel(modelId, instructions) {
    // For now, we'll just generate a new model with the instructions
    // In a real implementation, this would use the existing model as a starting point
    console.log(`Improving model ${modelId} with instructions: ${instructions}`)

    try {
      return await this.generateModel(instructions)
    } catch (error) {
      console.error("Error improving 3D model:", error)
      throw new Error(`Failed to improve 3D model: ${error.message}`)
    }
  }

  /**
   * Convert STL file to GLB for web viewing
   * This is a placeholder - actual implementation would require a 3D conversion library
   * @param {string} stlPath - Path to the STL file
   * @returns {Promise<string>} - Path to the converted GLB file
   */
  async convertStlToGlb(stlPath) {
    // This is a placeholder for STL to GLB conversion
    // In a real implementation, you would use a library like meshoptimizer or a service
    console.log(`Converting STL to GLB: ${stlPath}`)

    // For now, we'll just return the original STL path
    return stlPath
  }
}

module.exports = ShapeGenerator

