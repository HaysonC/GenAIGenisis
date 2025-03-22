// ShapeGenerator.js
require("dotenv").config()
const axios = require("axios")
const fs = require("fs")
const path = require("path")

class ShapeGenerator {
  constructor() {
    this.apiUrl = process.env.SHAPE_API_URL || "http://localhost:8000"
    this.modelsDir = path.join(__dirname, "models")

    // Create models directory if it doesn't exist
    if (!fs.existsSync(this.modelsDir)) {
      fs.mkdirSync(this.modelsDir)
    }
  }

  async generateModel(prompt, options = {}) {
    try {
      const payload = {
        prompt: prompt,
        guidance_scale: options.guidance_scale || 15.0,
        num_steps: options.num_steps || 64,
      }

      console.log(`Generating 3D model with prompt: "${prompt}"`)

      // Check API health
      try {
        await axios.get(`${this.apiUrl}/health`, { timeout: 5000 })
        console.log("Shape API health check successful")
      } catch (error) {
        console.warn(`Shape API health check failed: ${error.message}`)
      }

      // Make the API request
      const response = await axios({
        method: "post",
        url: `${this.apiUrl}/generate`,
        data: payload,
        responseType: "arraybuffer",
        timeout: 120000, // 2 minutes timeout
      })

      if (response.status !== 200) {
        throw new Error(`API returned status code ${response.status}`)
      }

      // Generate a unique filename
      const timestamp = Date.now()
      const filename = `model_${timestamp}.glb`
      const filePath = path.join(this.modelsDir, filename)

      // Save the model file
      fs.writeFileSync(filePath, response.data)
      console.log(`3D model saved to ${filePath}`)

      return {
        filename,
        filePath,
        url: `/models/${filename}`,
      }
    } catch (error) {
      console.error("Error generating 3D model:", error)
      throw new Error(`Failed to generate 3D model: ${error.message}`)
    }
  }

  async improveModel(modelId, instructions) {
    // This would be implemented to handle model improvements
    // For now, we'll just generate a new model with the instructions
    try {
      return await this.generateModel(instructions)
    } catch (error) {
      console.error("Error improving 3D model:", error)
      throw new Error(`Failed to improve 3D model: ${error.message}`)
    }
  }
}

module.exports = ShapeGenerator

