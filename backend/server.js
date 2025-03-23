require("dotenv").config()
const express = require("express")
const multer = require("multer")
const fs = require("fs")
const path = require("path")
const cors = require("cors")
const GeminiImageToText = require("./GeminiImageToText")
const ShapeGenerator = require("./ShapeGenerator")
const LDRSampler = require("./sampleFromLDR")
const ModelToLDR = require("./ModelToLDR")
const ldrPartsUtils = require("./ldrPartsUtils")
const app = express()
const { spawn } = require("child_process")
const os = require("os")
const { exec } = require("child_process")

/**
 * Initialize Express server with middleware
 */
app.use(express.json())
app.use(cors())

/**
 * Endpoint for Gemini text analysis
 * @route POST /api/gemini/analyze
 * @param {Object} req.body - Request body
 * @param {string} req.body.prompt - The prompt to send to Gemini
 * @returns {Object} Gemini API response
 */
app.post("/api/gemini/analyze", async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }
    
    // Create a new Gemini client instance
    const gemini = new GeminiImageToText();
    
    // Send the prompt to Gemini and get the response
    const response = await gemini.generateText(prompt);
    
    // Return the response
    res.json({ response });
  } catch (error) {
    console.error("Error in Gemini text analysis:", error);
    res.status(500).json({ error: "Failed to analyze with Gemini" });
  }
});

/**
 * Global variable to track generation progress
 * @type {Object}
 * @property {number} progress - Progress percentage (0-100)
 * @property {string} status - Current status message
 * @property {number} lastUpdated - Timestamp of last update
 */
let generationProgress = {
  progress: 0,
  status: "Idle",
  lastUpdated: Date.now(),
}

/**
 * Endpoint to get the current generation progress
 * @route GET /generation-progress
 * @returns {Object} Current progress information
 */
app.get("/generation-progress", (req, res) => {
  res.json(generationProgress)
})

/**
 * Update the generation progress
 * @param {number} progress - Progress percentage (0-100)
 * @param {string} [status] - Optional status message
 */
function updateProgress(progress, status = null) {
  generationProgress = {
    progress: Math.min(Math.max(0, progress), 100), // Ensure progress is between 0-100
    status: status || generationProgress.status,
    lastUpdated: Date.now(),
  }
  console.log(`Progress updated: ${progress}% - ${status || generationProgress.status}`)
}

/**
 * Create necessary directories if they don't exist
 */
const uploadsDir = path.join(__dirname, "uploads")
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir)
}

const modelsDir = path.join(__dirname, "models")
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir)
}

const viewsDir = path.join(__dirname, "views")
if (!fs.existsSync(viewsDir)) {
  fs.mkdirSync(viewsDir)
}

const instructionsDir = path.join(__dirname, "instructions")
if (!fs.existsSync(instructionsDir)) {
  fs.mkdirSync(instructionsDir)
}

const ldrOutputDir = path.join(__dirname, "ldr_output")
if (!fs.existsSync(ldrOutputDir)) {
  fs.mkdirSync(ldrOutputDir)
}

const partsDir = path.join(__dirname, "parts")
if (!fs.existsSync(partsDir)) {
  fs.mkdirSync(partsDir)
}

/**
 * Configure multer for file uploads
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname)
  },
})

const upload = multer({ storage: storage })

/**
 * Initialize models
 */
const geminiImageToText = new GeminiImageToText()
const shapeGenerator = new ShapeGenerator()
const ldrSampler = new LDRSampler()
const modelToLdr = new ModelToLDR()

/**
 * Serve static files
 */
app.use("/models", express.static(modelsDir))
app.use(
  "/views",
  (req, res, next) => {
    // Set the correct content type for image files
    if (req.path.endsWith(".jpg") || req.path.endsWith(".jpeg")) {
      res.type("image/jpeg")
    } else if (req.path.endsWith(".png")) {
      res.type("image/png")
    } else if (req.path.endsWith(".obj")) {
      res.type("application/octet-stream")
    } else if (req.path.endsWith(".glb")) {
      res.type("model/gltf-binary")
    }
    next()
  },
  express.static(path.join(__dirname, "views")),
)
app.use("/instructions", express.static(instructionsDir))
app.use("/ldr_output", express.static(ldrOutputDir))
app.use("/parts", express.static(partsDir))

/**
 * Endpoint to upload an image
 * @route POST /upload-image
 * @param {File} image - The image file to upload
 * @returns {Object} Message and image path
 */
app.post("/upload-image", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No image provided" })
  }

  const imagePath = req.file.path
  const result = geminiImageToText.attachImage(imagePath)
  res.json({ message: result, imagePath })
})

/**
 * Endpoint to get the description of the uploaded image
 * @route GET /image-description
 * @returns {Object} The generated description
 */
app.get("/image-description", async (req, res) => {
  try {
    const description = await geminiImageToText.predict()
    res.json({ description })
  } catch (error) {
    console.error("Error getting image description:", error)
    res.status(500).json({ message: "Error getting image description", error: error.message })
  }
})

/**
 * Endpoint to process an image - uploads and generates description in one call
 * @route POST /process-image
 * @param {File} image - The image file to upload
 * @returns {Object} Image URL and generated description
 */
app.post("/process-image", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No image provided" })
  }

  try {
    const imagePath = req.file.path
    const imageUrl = `/uploads/${path.basename(imagePath)}`
    
    // Attach the image to the model
    geminiImageToText.attachImage(imagePath)
    
    // Generate the description
    const description = await geminiImageToText.predict()
    
    res.json({ 
      imageUrl, 
      description,
      message: "Image processed successfully" 
    })
  } catch (error) {
    console.error("Error processing image:", error)
    res.status(500).json({ message: "Error processing image", error: error.message })
  }
})

/**
 * Endpoint to generate a prediction from the uploaded image
 * @route GET /predict
 * @returns {Object} The generated prediction text
 */
app.get("/predict", async (req, res) => {
  try {
    const result = await geminiImageToText.predict()
    res.json({ text: result })
  } catch (error) {
    console.error("Error predicting:", error)
    res.status(500).json({ message: "Error generating prediction" })
  }
})

/**
 * Endpoint to generate a 3D model from a prompt
 * @route POST /generate-model
 * @param {string} prompt - The text prompt for model generation
 * @param {Object} options - Generation options
 * @returns {Object} The generated model information
 */
app.post("/generate-model", async (req, res) => {
  try {
    const { prompt, options } = req.body

    if (!prompt) {
      return res.status(400).json({ message: "No prompt provided" })
    }

    console.log(`Received request to generate 3D model with prompt: "${prompt}"`)
    console.log("Options:", options)

    // Generate the 3D model using ShapeGenerator
    const result = await shapeGenerator.generateModel(prompt, options)

    console.log(`3D model generated successfully: ${result.filename}`)
    console.log(`File path: ${result.filePath}`)
    console.log(`File size: ${(result.fileSize / 1024).toFixed(1)} KB`)

    res.json(result)
  } catch (error) {
    console.error("Error generating 3D model:", error)
    res.status(500).json({ message: `Error generating 3D model: ${error.message}` })
  }
})

/**
 * Endpoint to improve an existing 3D model
 * @route POST /improve-model
 * @param {string} modelId - The ID of the model to improve
 * @param {string} instructions - Instructions for improvement
 * @returns {Object} The improved model information
 */
app.post("/improve-model", async (req, res) => {
  try {
    const { modelId, instructions } = req.body

    if (!modelId) {
      return res.status(400).json({ message: "No model ID provided" })
    }

    if (!instructions) {
      return res.status(400).json({ message: "No instructions provided" })
    }

    console.log(`Received request to improve model ${modelId} with instructions: "${instructions}"`)

    // Improve the 3D model using ShapeGenerator
    const result = await shapeGenerator.improveModel(modelId, instructions)

    console.log(`3D model improved successfully: ${result.filename}`)
    console.log(`File path: ${result.filePath}`)
    console.log(`File size: ${(result.fileSize / 1024).toFixed(1)} KB`)

    res.json(result)
  } catch (error) {
    console.error("Error improving 3D model:", error)
    res.status(500).json({ message: `Error improving 3D model: ${error.message}` })
  }
})

/**
 * Endpoint to process an LDR file and generate views and instructions
 * @route POST /process-ldr
 * @param {File} ldrFile - The LDR file to process
 * @returns {Object} Model ID, view paths, and instructions
 */
app.post("/process-ldr", upload.single("ldrFile"), async (req, res) => {
  console.log("Received request to /process-ldr")
  updateProgress(10, "Processing LDR file")

  // Set the content type to JSON
  res.setHeader("Content-Type", "application/json")

  if (!req.file) {
    console.log("No LDR file provided in request")
    updateProgress(0, "No LDR file provided")
    return res.status(400).json({ message: "No LDR file provided" })
  }

  console.log(`Processing LDR file: ${req.file.originalname}, size: ${req.file.size} bytes, path: ${req.file.path}`)
  updateProgress(20, "LDR file received")

  try {
    const ldrFilePath = req.file.path

    // Check if file exists and is readable
    try {
      fs.accessSync(ldrFilePath, fs.constants.R_OK)
      console.log(`LDR file exists and is readable: ${ldrFilePath}`)
      updateProgress(30, "LDR file validated")
    } catch (accessError) {
      console.error(`LDR file access error: ${accessError.message}`)
      updateProgress(0, "Cannot access uploaded LDR file")
      return res.status(500).json({
        message: "Cannot access uploaded LDR file",
        error: accessError.message,
        path: ldrFilePath,
      })
    }

    // Sample views from the LDR file
    let result
    console.log("LDRSampler instance:", typeof ldrSampler, Object.keys(ldrSampler))
    updateProgress(40, "Preparing to sample views")

    try {
      console.log("Attempting to sample views...")
      if (typeof ldrSampler.sampleViews !== "function") {
        throw new Error("sampleViews method is not a function")
      }

      updateProgress(50, "Sampling views from LDR file")
      result = await ldrSampler.sampleViews(ldrFilePath)
      console.log("View sampling succeeded")
      updateProgress(70, "Views sampled successfully")
    } catch (error) {
      console.error(`View sampling failed: ${error.message}`)
      updateProgress(0, "Failed to sample views from LDR file")
      return res.status(500).json({
        message: "Failed to sample views from LDR file",
        error: error.message,
        file: {
          name: req.file.originalname,
          size: req.file.size,
          path: ldrFilePath,
        },
      })
    }

    if (!result || !result.viewPaths || !Array.isArray(result.viewPaths) || result.viewPaths.length === 0) {
      console.error("No view paths were created")
      updateProgress(0, "No view paths were created")
      return res.status(500).json({
        message: "Failed to generate view paths",
        error: "No view paths were created",
        result: result || "No result",
      })
    }

    console.log(`Successfully generated ${result.viewPaths.length} views for model ${result.modelId}`)
    console.log("View paths:", result.viewPaths)
    updateProgress(80, "Views generated successfully")

    // Generate instructions based on the views
    try {
      console.log("Generating instructions from views...")
      updateProgress(85, "Generating instructions from views")

      // Check if Gemini API key is set
      if (!process.env.GEMINI_API_KEY) {
        console.error("GEMINI_API_KEY environment variable is not set")
        updateProgress(0, "Gemini API key is not configured")
        return res.status(500).json({
          message: "Gemini API key is not configured",
          error: "GEMINI_API_KEY environment variable is missing",
        })
      }

      // Get the original description if it exists in the request
      const originalDescription = req.body.originalDescription || ""
      console.log(`Using original description for instructions: "${originalDescription}"`)

      // Pass the original description to the generateInstructions method
      const instructions = await geminiImageToText.generateInstructions(result.viewPaths, originalDescription)
      console.log("Successfully generated instructions")
      updateProgress(90, "Instructions generated successfully")

      // Save the instructions to files
      const modelInstructionsDir = path.join(instructionsDir, result.modelId)
      if (!fs.existsSync(modelInstructionsDir)) {
        fs.mkdirSync(modelInstructionsDir, { recursive: true })
      }

      for (const [type, text] of Object.entries(instructions)) {
        const filePath = path.join(modelInstructionsDir, `${type}.txt`)
        fs.writeFileSync(filePath, text)
        console.log(`Saved ${type} instructions to ${filePath}`)
      }
      updateProgress(95, "Instructions saved to files")

      // Return the results
      const response = {
        modelId: result.modelId,
        viewPaths: result.viewPaths.map((p) => `/views/${result.modelId}/${path.basename(p)}`),
        instructions,
        originalDescription: instructions.original || "",
      }

      console.log("Sending successful response")
      updateProgress(100, "Process completed successfully")
      return res.status(200).json(response)
    } catch (instructionsError) {
      console.error("Error generating instructions:", instructionsError)
      updateProgress(0, "Failed to generate instructions")
      return res.status(500).json({
        message: "Failed to generate instructions",
        error: instructionsError.message,
        stack: instructionsError.stack,
        viewPaths: result.viewPaths,
      })
    }
  } catch (error) {
    console.error("Error processing LDR file:", error)
    updateProgress(0, "Error processing LDR file")
    return res.status(500).json({
      message: "Error processing LDR file",
      error: error.message,
      stack: error.stack,
      file: req.file
        ? {
            name: req.file.originalname,
            size: req.file.size,
            path: req.file.path,
          }
        : "No file info",
    })
  }
})

/**
 * Endpoint to get instructions for a specific model
 * @route GET /get-instructions/:modelId
 * @param {string} modelId - The ID of the model
 * @returns {Object} The instructions for the model
 */
app.get("/get-instructions/:modelId", async (req, res) => {
  try {
    const { modelId } = req.params

    if (!modelId) {
      return res.status(400).json({ message: "No model ID provided" })
    }

    const modelInstructionsDir = path.join(instructionsDir, modelId)

    if (!fs.existsSync(modelInstructionsDir)) {
      return res.status(404).json({ message: `No instructions found for model ID: ${modelId}` })
    }

    // Read all instruction files
    const instructionTypes = ["building", "engineering", "style", "original"]
    const instructions = {}

    for (const type of instructionTypes) {
      const filePath = path.join(modelInstructionsDir, `${type}.txt`)
      if (fs.existsSync(filePath)) {
        instructions[type] = fs.readFileSync(filePath, "utf8")
      }
    }

    if (Object.keys(instructions).length === 0) {
      return res.status(404).json({ message: `No instruction files found for model ID: ${modelId}` })
    }

    res.json({
      modelId,
      instructions,
    })
  } catch (error) {
    console.error("Error getting instructions:", error)
    res.status(500).json({ message: `Error getting instructions: ${error.message}` })
  }
})

/**
 * Endpoint to serve the test HTML page
 * @route GET /test-ldr
 */
app.get("/test-ldr", (req, res) => {
  res.sendFile(path.join(__dirname, "testLDR.html"))
})

/**
 * Endpoint to serve the test LDR parts HTML page
 * @route GET /test-ldr-parts
 */
app.get("/test-ldr-parts", (req, res) => {
  res.sendFile(path.join(__dirname, "testLDRparts.html"))
})

/**
 * Endpoint to convert a 3D model to LDR format
 * @route POST /convert-to-ldr
 * @param {string} modelPath - Path to the 3D model file
 * @returns {Object} The converted LDR file information
 */
app.post("/convert-to-ldr", async (req, res) => {
  try {
    const { modelPath } = req.body

    if (!modelPath) {
      return res.status(400).json({ message: "No model path provided" })
    }

    // Check if the model file exists
    const fullModelPath = path.join(__dirname, modelPath.replace(/^\//, ""))
    if (!fs.existsSync(fullModelPath)) {
      return res.status(404).json({ message: `Model file not found: ${modelPath}` })
    }

    console.log(`Converting model to LDR: ${fullModelPath}`)

    // Check the file extension
    const fileExt = path.extname(fullModelPath).toLowerCase()
    console.log(`File extension detected: ${fileExt}`)

    // If it's an STL file, log a warning
    if (fileExt === ".stl") {
      console.warn(`STL file detected. This may cause issues with conversion: ${fullModelPath}`)
    }

    try {
      // Try to convert the model to LDR
      const result = await modelToLdr.convertToLDR(fullModelPath)
      res.json(result)
    } catch (conversionError) {
      // Return a specific error for the not implemented functionality
      return res.status(501).json({
        message: "3D model to LDR conversion not implemented",
        error: conversionError.message,
      })
    }
  } catch (error) {
    console.error("Error in convert-to-ldr endpoint:", error)
    res.status(500).json({ message: `Error: ${error.message}` })
  }
})

/**
 * Endpoint to optimize an LDR file
 * @route POST /optimize-ldr
 * @param {string} ldrPath - Path to the LDR file
 * @returns {Object} The optimized LDR file information
 */
app.post("/optimize-ldr", async (req, res) => {
  try {
    const { ldrPath } = req.body

    if (!ldrPath) {
      return res.status(400).json({ message: "No LDR path provided" })
    }

    // Check if the LDR file exists
    const fullLdrPath = path.join(__dirname, ldrPath.replace(/^\//, ""))
    if (!fs.existsSync(fullLdrPath)) {
      return res.status(404).json({ message: `LDR file not found: ${ldrPath}` })
    }

    console.log(`Optimizing LDR file: ${fullLdrPath}`)

    try {
      // Try to optimize the LDR file
      const result = await modelToLdr.optimizeLDR(fullLdrPath)
      res.json(result)
    } catch (optimizationError) {
      // Return a specific error if optimization fails
      return res.status(500).json({
        message: "LDR optimization failed",
        error: optimizationError.message,
      })
    }
  } catch (error) {
    console.error("Error optimizing LDR file:", error)
    res.status(500).json({ message: `Error optimizing LDR file: ${error.message}` })
  }
})

/**
 * Endpoint to generate a 3D model and convert to LDR from text
 * @route POST /generate-ldr-from-text
 * @param {string} prompt - The text prompt
 * @param {Object} options - Generation options
 * @param {string} originalDescription - Original description for instructions
 * @returns {Object} The generated model and LDR information
 */
app.post("/generate-ldr-from-text", async (req, res) => {
  try {
    const { prompt, options, originalDescription } = req.body

    if (!prompt) {
      return res.status(400).json({ message: "No prompt provided" })
    }

    console.log(`Received request to generate LDR from text: "${prompt}"`)

    // Step 1: Generate the 3D model
    const modelOptions = {
      guidance_scale: options?.guidance_scale || 15.0,
      num_steps: options?.num_steps || 32, // Updated to 24 as requested
    }

    const modelResult = await shapeGenerator.generateModel(prompt, modelOptions)
    console.log(`3D model generated: ${modelResult.filePath}`)

    // Step 2: Try to convert the 3D model to LDR
    try {
      const ldrResult = await modelToLdr.convertToLDR(modelResult.filePath, {
        resolution: options?.resolution || 80,
      })

      // Step 3: Generate views from the LDR file
      try {
        const viewsResult = await ldrSampler.sampleViews(ldrResult.ldrFilePath)
        console.log(`Generated ${viewsResult.viewPaths.length} views for LDR model`)

        // Step 4: Generate instructions from the views
        try {
          const instructions = await geminiImageToText.generateInstructions(
            viewsResult.viewPaths,
            originalDescription || prompt,
          )
          console.log("Generated instructions from views")

          // Save the instructions to files
          const modelInstructionsDir = path.join(instructionsDir, viewsResult.modelId)
          if (!fs.existsSync(modelInstructionsDir)) {
            fs.mkdirSync(modelInstructionsDir, { recursive: true })
          }

          for (const [type, text] of Object.entries(instructions)) {
            const filePath = path.join(modelInstructionsDir, `${type}.txt`)
            fs.writeFileSync(filePath, text)
            console.log(`Saved ${type} instructions to ${filePath}`)
          }

          // Return all information
          return res.json({
            model: modelResult,
            ldr: ldrResult,
            views: {
              modelId: viewsResult.modelId,
              viewPaths: viewsResult.viewPaths.map((p) => `/views/${viewsResult.modelId}/${path.basename(p)}`),
            },
            instructions,
          })
        } catch (instructionsError) {
          console.error("Error generating instructions:", instructionsError)
          // Return without instructions
          return res.json({
            model: modelResult,
            ldr: ldrResult,
            views: {
              modelId: viewsResult.modelId,
              viewPaths: viewsResult.viewPaths.map((p) => `/views/${viewsResult.modelId}/${path.basename(p)}`),
            },
            instructionsError: instructionsError.message,
          })
        }
      } catch (viewsError) {
        console.error("Error generating views:", viewsError)
        // Return without views
        return res.json({
          model: modelResult,
          ldr: ldrResult,
          viewsError: viewsError.message,
        })
      }
    } catch (conversionError) {
      // Return just the model result with a note about LDR conversion
      return res.json({
        model: modelResult,
        ldrConversionError: conversionError.message,
        message: "3D model generated successfully, but LDR conversion failed: " + conversionError.message,
      })
    }
  } catch (error) {
    console.error("Error generating LDR from text:", error)
    res.status(500).json({ message: `Error generating LDR from text: ${error.message}` })
  }
})

/**
 * Endpoint to generate a 3D model and convert to LDR from an image
 * @route POST /generate-ldr-from-image
 * @param {Object} options - Generation options
 * @param {string} originalDescription - Original description for instructions
 * @returns {Object} The generated model, LDR, views, and instructions
 */
app.post("/generate-ldr-from-image", async (req, res) => {
  try {
    // Reset progress
    updateProgress(10, "Starting image analysis")

    // Step 1: Get the description from Gemini
    let description
    try {
      updateProgress(15, "Generating description from image")
      description = await geminiImageToText.predict()
      console.log(`Generated description from image: "${description}"`)
      updateProgress(25, "Description generated successfully")
    } catch (error) {
      console.error("Error generating description from image:", error)
      updateProgress(0, "Error generating description")
      return res.status(500).json({ message: `Error generating description: ${error.message}` })
    }

    // Step 2: Generate 3D model from the description
    const modelOptions = {
      guidance_scale: req.body.options?.guidance_scale || 15.0,
      num_steps: req.body.options?.num_steps || 32,
    }

    updateProgress(30, "Generating 3D model from description")
    console.log(`Generating 3D model from description: "${description}"`)

    const modelResult = await shapeGenerator.generateModel(description, modelOptions)
    console.log(`3D model generated: ${modelResult.filePath}`)
    updateProgress(60, "3D model generated successfully")

    // Step 3: Try to convert the 3D model to LDR
    try {
      updateProgress(65, "Converting 3D model to LDR format")
      const ldrResult = await modelToLdr.convertToLDR(modelResult.filePath, {
        resolution: req.body.options?.resolution || 80,
      })
      updateProgress(75, "LDR conversion successful")

      // Skip view generation and directly return the results
      updateProgress(95, "Process nearly complete")

      // Return all information
      updateProgress(100, "Process completed successfully")
      res.json({
        description,
        model: modelResult,
        ldr: ldrResult
      })
    } catch (conversionError) {
      // Return just the description and model result with a note about LDR conversion
      updateProgress(100, "3D model generated, but LDR conversion failed")
      return res.json({
        description,
        model: modelResult,
        ldrConversionError: conversionError.message,
        message: "3D model generated successfully, but LDR conversion failed: " + conversionError.message,
      })
    }
  } catch (error) {
    console.error("Error generating LDR from image:", error)
    updateProgress(0, "Error in generation process")
    res.status(500).json({ message: `Error generating LDR from image: ${error.message}` })
  }
})

/**
 * Endpoint to convert an OBJ file to LDR
 * @route POST /convert-obj-to-ldr
 * @param {string} modelPath - Path to the OBJ file
 * @param {Object} options - Conversion options
 * @returns {Object} The converted LDR file information
 */
app.post("/convert-obj-to-ldr", async (req, res) => {
  try {
    const { modelPath, options } = req.body

    if (!modelPath) {
      return res.status(400).json({ message: "No model path provided" })
    }

    // Check if the model file exists
    const fullModelPath = path.join(__dirname, modelPath.replace(/^\//, ""))
    if (!fs.existsSync(fullModelPath)) {
      return res.status(404).json({ message: `Model file not found: ${modelPath}` })
    }

    // Make sure we're handling .obj files, not .stl
    const fileExt = path.extname(fullModelPath).toLowerCase()
    if (fileExt !== ".obj") {
      // If it's an STL file, convert it to OBJ first
      if (fileExt === ".stl") {
        console.log(`Converting STL to OBJ before LDR conversion: ${fullModelPath}`)
        try {
          // Create a temporary OBJ file path
          const objPath = fullModelPath.replace(/\.stl$/i, ".obj")

          // Use trimesh to convert STL to OBJ
          const stlToObjScript = `
import trimesh
mesh = trimesh.load('${fullModelPath.replace(/\\/g, "\\\\")}')
mesh.export('${objPath.replace(/\\/g, "\\\\")}')
print('Conversion successful')
          `
          const tempScriptPath = path.join(os.tmpdir(), "stl_to_obj.py")
          fs.writeFileSync(tempScriptPath, tempScriptPath)

          await exec(`${modelToLdr.pythonPath} ${tempScriptPath}`)

          if (fs.existsSync(objPath)) {
            console.log("STL to OBJ conversion successful")
            return await modelToLdr.convertOBJToLDR(objPath, options || {})
          } else {
            throw new Error("STL to OBJ conversion failed: Output file not created")
          }
        } catch (error) {
          console.error("STL to OBJ conversion error:", error)
          return res.status(400).json({
            message: "Failed to convert STL to OBJ format",
            error: error.message,
          })
        }
      } else {
        return res
          .status(400)
          .json({ message: `Unsupported file format: ${fileExt}. Only OBJ and STL files are supported.` })
      }
    }

    console.log(`Converting OBJ to LDR: ${fullModelPath}`)

    try {
      // Convert the OBJ to LDR using ModelToLDR
      // Add a higher resolution option to ensure taller models are fully converted
      const conversionOptions = { 
        ...options,
        resolution: (options && options.resolution) || 128 // Default to 128 if not specified
      };
      
      const result = await modelToLdr.convertOBJToLDR(fullModelPath, conversionOptions)
      res.json(result)
    } catch (conversionError) {
      console.error("OBJ to LDR conversion error:", conversionError)
      return res.status(500).json({
        message: "Failed to convert OBJ to LDR",
        error: conversionError.message,
      })
    }
  } catch (error) {
    console.error("Error in convert-obj-to-ldr endpoint:", error)
    res.status(500).json({ message: `Error: ${error.message}` })
  }
})

/**
 * Endpoint to generate a 3D model from text
 * @route POST /generate-model-from-text
 * @param {string} prompt - The text prompt
 * @param {Object} options - Generation options
 * @returns {Object} The generated model information
 */
app.post("/generate-model-from-text", async (req, res) => {
  try {
    const { prompt, options } = req.body

    if (!prompt) {
      return res.status(400).json({ message: "No prompt provided" })
    }

    console.log(`Received request to generate 3D model from text: "${prompt}"`)

    // Generate the 3D model using ShapeGenerator
    const result = await shapeGenerator.generateModel(prompt, options)

    console.log(`3D model generated successfully: ${result.filename}`)

    res.json(result)
  } catch (error) {
    console.error("Error generating 3D model from text:", error)
    res.status(500).json({ message: `Error generating 3D model: ${error.message}` })
  }
})

/**
 * Endpoint to generate a 3D model from an image
 * @route POST /generate-model-from-image
 * @param {Object} options - Generation options
 * @returns {Object} The generated model information and description
 */
app.post("/generate-model-from-image", async (req, res) => {
  try {
    // First, get the description from Gemini
    let description
    try {
      description = await geminiImageToText.predict()
      console.log(`Generated description from image: "${description}"`)
    } catch (error) {
      console.error("Error generating description from image:", error)
      return res.status(500).json({ message: `Error generating description: ${error.message}` })
    }

    // Then, use the description to generate a 3D model
    const options = req.body.options || {}

    console.log(`Generating 3D model from description: "${description}"`)
    const result = await shapeGenerator.generateModel(description, options)

    console.log(`3D model generated successfully: ${result.filename}`)

    // Return both the description and the model information
    res.json({
      description,
      ...result,
    })
  } catch (error) {
    console.error("Error in generate-model-from-image flow:", error)
    res.status(500).json({ message: `Error generating 3D model from image: ${error.message}` })
  }
})

/**
 * Parse an LDR file to count parts and return the part list
 * @param {string} filePath - Path to the LDR file
 * @returns {Object} Part counts and color counts
 */
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

/**
 * Wrapper function to parse an LDR file and create a part list
 * @param {string} ldrFilePath - Path to the LDR file
 * @returns {Array} List of parts with color variations
 */
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

/**
 * Endpoint to get parts list from an LDR file
 * @route POST /get-parts
 * @param {string} ldrFilePath - Path to the LDR file
 * @returns {Array} List of parts with color variations
 */
app.post("/get-parts", async (req, res) => {
  try {
    const { ldrFilePath } = req.body

    // Ensure the LDR file path is provided
    if (!ldrFilePath) {
      return res.status(400).json({ error: "LDR file path is required" })
    }

    // Handle both absolute paths and relative paths
    let fullFilePath
    if (path.isAbsolute(ldrFilePath)) {
      fullFilePath = ldrFilePath
    } else {
      // Remove leading slash if present
      const cleanPath = ldrFilePath.replace(/^\//, "")
      fullFilePath = path.join(__dirname, cleanPath)
    }

    console.log(`Parsing LDR file: ${fullFilePath}`)

    // Check if file exists
    if (!fs.existsSync(fullFilePath)) {
      return res.status(404).json({ error: `LDR file not found: ${fullFilePath}` })
    }

    // Call the LDR parsing function to get the parts list
    const partList = await makeLDRparse(fullFilePath)

    // Return the parsed part list
    res.json(partList)
  } catch (error) {
    console.error("Error processing LDR file:", error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Endpoint to upload an LDR file and get parts list
 * @route POST /upload-ldr-for-parts
 * @param {File} ldrFile - The LDR file to process
 * @returns {Object} File information and parts list
 */
app.post("/upload-ldr-for-parts", upload.single("ldrFile"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No LDR file uploaded" })
    }

    const ldrFilePath = req.file.path
    console.log(`Processing uploaded LDR file for parts list: ${ldrFilePath}`)

    // Call the LDR parsing function to get the parts list
    const partList = await makeLDRparse(ldrFilePath)

    // Return the parsed part list along with the file path
    res.json({
      filePath: ldrFilePath,
      fileName: req.file.originalname,
      partList,
    })
  } catch (error) {
    console.error("Error processing uploaded LDR file:", error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get layer information from LDR file
 */
app.post("/get-ldr-layers", async (req, res) => {
  try {
    const { ldrFilePath } = req.body
    
    if (!ldrFilePath) {
      return res.status(400).json({ error: "LDR file path is required" })
    }
    
    // Check if file exists
    const fullPath = ldrFilePath.startsWith("/") ? ldrFilePath : path.join(__dirname, ldrFilePath)
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: "LDR file not found" })
    }
    
    // Create a new instance of the LDR parser
    // Use Python script for parsing LDR file
    const pythonProcess = spawn('python3', ['ldr_parser.py', fullPath]);
    
    let dataString = '';
    let errorString = '';
    
    pythonProcess.stdout.on('data', (data) => {
      dataString += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorString += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python process exited with code ${code}`);
        console.error(errorString);
        return res.status(500).json({ error: "Failed to parse LDR file", details: errorString });
      }
      
      try {
        const layersData = JSON.parse(dataString);
        return res.json(layersData);
      } catch (parseError) {
        console.error("Error parsing JSON from Python script", parseError);
        return res.status(500).json({ error: "Failed to parse layer data from LDR file" });
      }
    });
  } catch (error) {
    console.error("Error in /get-ldr-layers:", error)
    res.status(500).json({
      error: "Failed to process LDR layers",
      message: error.message,
    })
  }
})

/**
 * Generate instructions for each layer using Gemini
 */
app.post("/generate-layer-instructions", async (req, res) => {
  try {
    const { ldrFilePath, description, layersCount } = req.body
    
    if (!ldrFilePath || !description || !layersCount) {
      return res.status(400).json({ 
        error: "Missing required parameters", 
        required: ["ldrFilePath", "description", "layersCount"] 
      })
    }
    
    // Check if file exists
    const fullPath = ldrFilePath.startsWith("/") ? ldrFilePath : path.join(__dirname, ldrFilePath)
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: "LDR file not found" })
    }
    
    // Get model ID from filename
    const modelId = path.basename(ldrFilePath, path.extname(ldrFilePath))
    
    // Check if we already have instructions for this model
    const modelInstructionsDir = path.join(instructionsDir, modelId, "layers")
    let instructions = []
    
    // If directory exists, check if we have layer instructions
    if (fs.existsSync(modelInstructionsDir)) {
      const existingFiles = fs.readdirSync(modelInstructionsDir)
      const layerFiles = existingFiles.filter(file => file.startsWith("layer_") && file.endsWith(".txt"))
      
      // If we have the correct number of layer files, use them
      if (layerFiles.length === parseInt(layersCount)) {
        console.log(`Using existing layer instructions for model ${modelId}`)
        
        // Read each layer file
        for (let i = 0; i < layerFiles.length; i++) {
          const layerNum = i + 1
          const layerFile = path.join(modelInstructionsDir, `layer_${layerNum}.txt`)
          
          if (fs.existsSync(layerFile)) {
            const instructionText = fs.readFileSync(layerFile, "utf-8")
            instructions.push(instructionText)
          } else {
            // If a file is missing, add placeholder
            instructions.push(`Instructions for layer ${layerNum}`)
          }
        }
        
        return res.json({ instructions })
      }
    }
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(modelInstructionsDir)) {
      fs.mkdirSync(modelInstructionsDir, { recursive: true })
    }
    
    // Generate instructions for each layer using Gemini
    console.log(`Generating instructions for ${layersCount} layers for model ${modelId}`)
    
    // Base prompt for Gemini
    const basePrompt = `The following is a LEGO model description: "${description}". 
    This model has ${layersCount} layers of bricks. 
    Generate step-by-step instructions for building layer {LAYER_NUM} of this model. 
    Instructions should be concise and clear, using terminology like "Place a 2x4 brick at the center" or 
    "Add two 1x2 plates to connect the previous sections". 
    Be specific about placement relative to previous layers.`
    
    // Generate instructions for each layer
    for (let i = 0; i < layersCount; i++) {
      const layerNum = i + 1
      const layerPrompt = basePrompt.replace("{LAYER_NUM}", layerNum)
      
      try {
        // Call Gemini API
        const layerInstructions = await geminiImageToText.generateText(layerPrompt)
        
        // Save to file
        const layerFile = path.join(modelInstructionsDir, `layer_${layerNum}.txt`)
        fs.writeFileSync(layerFile, layerInstructions)
        
        // Add to response
        instructions.push(layerInstructions)
      } catch (geminiError) {
        console.error(`Error generating instructions for layer ${layerNum}:`, geminiError)
        
        // Add placeholder
        const placeholder = `Instructions for layer ${layerNum}: Place the bricks according to the model.`
        instructions.push(placeholder)
        
        // Save placeholder to file
        const layerFile = path.join(modelInstructionsDir, `layer_${layerNum}.txt`)
        fs.writeFileSync(layerFile, placeholder)
      }
    }
    
    res.json({ instructions })
  } catch (error) {
    console.error("Error in /generate-layer-instructions:", error)
    res.status(500).json({
      error: "Failed to generate layer instructions",
      message: error.message,
    })
  }
})

/**
 * Serve static React app in production
 */
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../my-app/build")))
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../my-app/build", "index.html"))
  })
}

/**
 * Error handling middleware
 */
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err)
  res.status(500).json({
    message: "Internal server error",
    error: err.message,
  })
})

/**
 * Handle 404 errors
 */
app.use((req, res) => {
  res.status(404).json({
    message: "Endpoint not found",
  })
})

/**
 * Add a new endpoint to get LDR file content by path
 * @route GET /get-ldr-file
 */
app.get("/get-ldr-file", async (req, res) => {
  try {
    const filePath = req.query.filePath;
    
    if (!filePath) {
      return res.status(400).json({ error: "File path is required" });
    }
    
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }
    
    // Read the file content
    const content = fs.readFileSync(filePath, "utf8");
    
    // Return the file content
    res.json({ content });
  } catch (error) {
    console.error("Error getting LDR file:", error);
    res.status(500).json({ error: "Failed to get LDR file" });
  }
});

/**
 * Start the server
 */
const PORT = process.env.PORT || 5001
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

