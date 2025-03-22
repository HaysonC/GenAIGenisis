// server.js
require("dotenv").config()
const express = require("express")
const multer = require("multer")
const fs = require("fs")
const path = require("path")
const cors = require("cors")
const GeminiImageToText = require("./GeminiImageToText")
const ShapeGenerator = require("./ShapeGenerator")
const app = express()

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

// Serve static files from the models directory
app.use("/models", express.static(modelsDir))

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

// Serve static React app in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../my-app/build")))
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../my-app/build", "index.html"))
  })
}

const PORT = process.env.PORT || 5001
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

