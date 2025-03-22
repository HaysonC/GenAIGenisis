require("dotenv").config()
const express = require("express")
const multer = require("multer")
const fs = require("fs")
const path = require("path")
const cors = require("cors")
const GeminiImageToText = require("./GeminiImageToText")
const ShapeGenerator = require("./ShapeGenerator")
const LDRSampler = require("./sampleFromLDR") // Fixed import path
const app = express()
const { spawn } = require("child_process") // Add this for the checkCommandExists method

app.use(express.json())
app.use(cors())

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "uploads")
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir)
}

// Create models directory if it doesn't exist
const modelsDir = path.join(__dirname, "models")
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir)
}

// Create views directory if it doesn't exist
const viewsDir = path.join(__dirname, "views")
if (!fs.existsSync(viewsDir)) {
  fs.mkdirSync(viewsDir)
}

// Define the directory for storing instructions
const instructionsDir = path.join(__dirname, "instructions")
if (!fs.existsSync(instructionsDir)) {
  fs.mkdirSync(instructionsDir)
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname)
  },
})

const upload = multer({ storage: storage })

// Initialize models
const geminiModel = new GeminiImageToText()
const shapeGenerator = new ShapeGenerator()
const ldrSampler = new LDRSampler()

// Serve static files from the models directory
app.use("/models", express.static(modelsDir))

// Serve static files from the views directory with proper MIME types
app.use(
  "/views",
  (req, res, next) => {
    // Set the correct content type for image files
    if (req.path.endsWith(".jpg") || req.path.endsWith(".jpeg")) {
      res.type("image/jpeg")
    } else if (req.path.endsWith(".png")) {
      res.type("image/png")
    }
    next()
  },
  express.static(path.join(__dirname, "views")),
)

// Serve static files from the instructions directory
app.use("/instructions", express.static(instructionsDir))

// Image upload endpoint
app.post("/upload-image", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No image provided" })
  }

  const imagePath = req.file.path
  const result = geminiModel.attachImage(imagePath)
  res.json({ message: result, imagePath })
})

// Prediction endpoint
app.get("/predict", async (req, res) => {
  try {
    const result = await geminiModel.predict()
    res.json({ text: result })
  } catch (error) {
    console.error("Error predicting:", error)
    res.status(500).json({ message: "Error generating prediction" })
  }
})

// Generate 3D model endpoint
app.post("/generate-model", async (req, res) => {
  try {
    const { prompt, options } = req.body

    if (!prompt) {
      return res.status(400).json({ message: "No prompt provided" })
    }

    const result = await shapeGenerator.generateModel(prompt, options)
    res.json(result)
  } catch (error) {
    console.error("Error generating 3D model:", error)
    res.status(500).json({ message: "Error generating 3D model" })
  }
})

// Improve 3D model endpoint
app.post("/improve-model", async (req, res) => {
  try {
    const { modelId, instructions } = req.body

    if (!instructions) {
      return res.status(400).json({ message: "No instructions provided" })
    }

    const result = await shapeGenerator.improveModel(modelId, instructions)
    res.json(result)
  } catch (error) {
    console.error("Error improving 3D model:", error)
    res.status(500).json({ message: "Error improving 3D model" })
  }
})

// Process LDR file endpoint
app.post("/process-ldr", upload.single("ldrFile"), async (req, res) => {
  console.log("Received request to /process-ldr")

  // Set the content type to JSON
  res.setHeader("Content-Type", "application/json")

  if (!req.file) {
    console.log("No LDR file provided in request")
    return res.status(400).json({ message: "No LDR file provided" })
  }

  console.log(`Processing LDR file: ${req.file.originalname}, size: ${req.file.size} bytes, path: ${req.file.path}`)

  try {
    const ldrFilePath = req.file.path

    // Check if file exists and is readable
    try {
      fs.accessSync(ldrFilePath, fs.constants.R_OK)
      console.log(`LDR file exists and is readable: ${ldrFilePath}`)
    } catch (accessError) {
      console.error(`LDR file access error: ${accessError.message}`)
      return res.status(500).json({
        message: "Cannot access uploaded LDR file",
        error: accessError.message,
        path: ldrFilePath,
      })
    }

    // Sample views from the LDR file
    let result
    console.log("LDRSampler instance:", typeof ldrSampler, Object.keys(ldrSampler))

    try {
      console.log("Attempting to sample views...")
      if (typeof ldrSampler.sampleViews !== "function") {
        throw new Error("sampleViews method is not a function")
      }

      result = await ldrSampler.sampleViews(ldrFilePath)
      console.log("View sampling succeeded")
    } catch (error) {
      console.error(`View sampling failed: ${error.message}`)
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
      return res.status(500).json({
        message: "Failed to generate view paths",
        error: "No view paths were created",
        result: result || "No result",
      })
    }

    console.log(`Successfully generated ${result.viewPaths.length} views for model ${result.modelId}`)
    console.log("View paths:", result.viewPaths)

    // TEMPORARILY SKIP INSTRUCTION GENERATION
    console.log("Skipping instruction generation for now to focus on view rendering")

    // Return the results without instructions
    const response = {
      modelId: result.modelId,
      viewPaths: result.viewPaths.map((p) => `/views/${result.modelId}/${path.basename(p)}`),
      instructions: {
        engineering: "Instruction generation temporarily disabled",
        building: "Instruction generation temporarily disabled",
        style: "Instruction generation temporarily disabled",
      },
    }

    console.log("Sending successful response")
    return res.status(200).json(response)

    /* COMMENTED OUT INSTRUCTION GENERATION
    // Generate instructions based on the views
    try {
      console.log("Generating instructions from views...")

      // Check if Gemini API key is set
      if (!process.env.GEMINI_API_KEY) {
        console.error("GEMINI_API_KEY environment variable is not set")
        return res.status(500).json({
          message: "Gemini API key is not configured",
          error: "GEMINI_API_KEY environment variable is missing",
        })
      }

      const instructions = await geminiModel.generateInstructions(result.viewPaths)
      console.log("Successfully generated instructions")

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

      // Return the results
      const response = {
        modelId: result.modelId,
        viewPaths: result.viewPaths.map((p) => `/views/${result.modelId}/${path.basename(p)}`),
        instructions,
      }

      console.log("Sending successful response")
      return res.status(200).json(response)
    } catch (instructionsError) {
      console.error("Error generating instructions:", instructionsError)
      return res.status(500).json({
        message: "Failed to generate instructions",
        error: instructionsError.message,
        stack: instructionsError.stack,
        viewPaths: result.viewPaths,
      })
    }
    */
  } catch (error) {
    console.error("Error processing LDR file:", error)
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

// Add this route to serve the test HTML page
app.get("/test-ldr", (req, res) => {
  res.sendFile(path.join(__dirname, "testLDR.html"))
})

// Serve static React app in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../my-app/build")))
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../my-app/build", "index.html"))
  })
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err)
  res.status(500).json({
    message: "Internal server error",
    error: err.message,
  })
})

// Handle 404 errors
app.use((req, res) => {
  res.status(404).json({
    message: "Endpoint not found",
  })
})

const PORT = process.env.PORT || 5001
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

