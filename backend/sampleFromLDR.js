// sampleFromLDR.js
const fs = require("fs")
const path = require("path")
const { execSync, spawn } = require("child_process")
const util = require("util")
const exec = util.promisify(require("child_process").exec)
const os = require("os")

class LDRSampler {
  constructor() {
    this.viewsDir = path.join(__dirname, "views")
    this.ldrawPartsPath = process.env.LDRAW_PARTS_PATH || path.join(__dirname, "ldraw")
    this.tempDir = path.join(os.tmpdir(), "ldraw_temp")

    // Create necessary directories
    if (!fs.existsSync(this.viewsDir)) {
      fs.mkdirSync(this.viewsDir, { recursive: true })
    }

    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true })
    }

    // Check for LDraw parts library
    this.checkLDrawLibrary()

    console.log(`LDRSampler initialized with views directory: ${this.viewsDir}`)
  }

  // Check if LDraw library is available and download if needed
  async checkLDrawLibrary() {
    if (!fs.existsSync(this.ldrawPartsPath)) {
      console.log("LDraw parts library not found. Creating directory...")
      fs.mkdirSync(this.ldrawPartsPath, { recursive: true })

      console.log(`Please download LDraw library and extract to: ${this.ldrawPartsPath}`)
      console.log("Download from: https://www.ldraw.org/parts/latest-parts.html")
    } else {
      console.log(`Using LDraw parts library at: ${this.ldrawPartsPath}`)
    }
  }

  // Helper method to check if a command exists with timeout
  async checkCommandExists(command, timeout = 3000) {
    return new Promise((resolve) => {
      console.log(`Checking if command exists: ${command}`)

      // Use 'which' command on Unix-like systems or 'where' on Windows
      const checkCmd = os.platform() === "win32" ? "where" : "which"
      const proc = spawn(checkCmd, [command.split(" ")[0]])

      let found = false
      let errorOutput = ""

      proc.stdout.on("data", (data) => {
        console.log(`Command ${command} found at: ${data.toString().trim()}`)
        found = true
      })

      proc.stderr.on("data", (data) => {
        errorOutput += data.toString()
      })

      proc.on("close", (code) => {
        if (found) {
          console.log(`Command ${command} exists`)
          resolve(true)
        } else {
          console.log(`Command ${command} not found (exit code: ${code}) - ${errorOutput}`)
          resolve(false)
        }
      })

      // Set timeout to avoid hanging
      setTimeout(() => {
        if (!found) {
          console.log(`Command check timed out for: ${command}`)
          proc.kill()
          resolve(false)
        }
      }, timeout)
    })
  }

  // Create a unique model directory
  async createModelDirectory() {
    const modelId = Date.now().toString()
    const modelDir = path.join(this.viewsDir, modelId)

    if (!fs.existsSync(modelDir)) {
      fs.mkdirSync(modelDir, { recursive: true })
    }

    return { modelId, modelDir }
  }

  // Method 1: Use LDView if available
  async sampleViewsWithLDView(ldrFilePath) {
    if (!fs.existsSync(ldrFilePath)) {
      throw new Error(`LDR file not found: ${ldrFilePath}`)
    }

    console.log(`Sampling views from LDR file using LDView: ${ldrFilePath}`)

    // Create model directory using the helper method
    let modelId, modelDir
    try {
      const result = await this.createModelDirectory()
      modelId = result.modelId
      modelDir = result.modelDir
    } catch (dirError) {
      console.error("Failed to create model directory:", dirError)
      throw new Error(`Failed to create model directory: ${dirError.message}`)
    }

    try {
      // Check if LDView is installed
      try {
        // First, check if the command exists in the PATH
        const ldviewExists = await this.checkCommandExists("ldview")
        if (!ldviewExists) {
          throw new Error("LDView executable not found in PATH")
        }

        console.log("LDView command found in PATH")
      } catch (error) {
        console.error("Error checking for LDView:", error)
        throw new Error("LDView not available: " + error.message)
      }

      // Define view angles with optimized parameters for better rendering
      const views = [
        {
          name: "front",
          latitude: 0,
          longitude: 0,
        },
        {
          name: "back",
          latitude: 0,
          longitude: 180,
        },
        {
          name: "top",
          latitude: 90,
          longitude: 0,
        },
        {
          name: "bottom",
          latitude: -90,
          longitude: 0,
        },
        {
          name: "left",
          latitude: 0,
          longitude: 90,
        },
        {
          name: "right",
          latitude: 0,
          longitude: -90,
        },
      ]

      const viewPaths = []

      // Generate each view using LDView with optimized parameters
      for (const view of views) {
        const outputPath = path.join(modelDir, `${view.name}.jpg`)

        // Optimized command with the best parameters for visible rendering
        const command = `LDView "${ldrFilePath}" -SaveSnapshot="${outputPath}" -SaveWidth=1920 -SaveHeight=1080 -Background=0xFFFFFF -DefaultLatitude=${view.latitude} -DefaultLongitude=${view.longitude}`
        try {
          console.log(`Executing: ${command}`)

          // Use execSync with timeout to avoid hanging
          execSync(command, { timeout: 60000 })

          if (fs.existsSync(outputPath)) {
            // Check if the file is not empty
            const stats = fs.statSync(outputPath)
            if (stats.size > 1000) {
              // Basic check that file has content
              viewPaths.push(outputPath)
              console.log(`Saved view: ${outputPath} (${stats.size} bytes)`)
            } else {
              console.error(`Generated image is too small: ${outputPath} (${stats.size} bytes)`)
              throw new Error(`Generated image is too small: ${outputPath}`)
            }
          } else {
            throw new Error(`Output file not created: ${outputPath}`)
          }
        } catch (error) {
          console.error(`Error generating ${view.name} view:`, error)
          throw new Error(`Failed to generate ${view.name} view: ${error.message}`)
        }
      }

      if (viewPaths.length === 0) {
        throw new Error("Failed to generate any views with LDView")
      }

      return {
        modelId,
        viewPaths,
      }
    } catch (error) {
      console.error("Error using LDView:", error)
      // Clean up the model directory if it was created but no views were generated
      if (fs.existsSync(modelDir)) {
        try {
          fs.rmdirSync(modelDir, { recursive: true })
          console.log(`Cleaned up empty model directory: ${modelDir}`)
        } catch (cleanupError) {
          console.error(`Failed to clean up model directory: ${cleanupError.message}`)
        }
      }
      throw new Error(`Failed to sample views with LDView: ${error.message}`)
    }
  }

  // Method 2: Use LeoCAD if available
  async sampleViewsWithLeoCAD(ldrFilePath) {
    if (!fs.existsSync(ldrFilePath)) {
      throw new Error(`LDR file not found: ${ldrFilePath}`)
    }

    console.log(`Sampling views from LDR file using LeoCAD: ${ldrFilePath}`)

    // Create model directory using the helper method
    let modelId, modelDir
    try {
      const result = await this.createModelDirectory()
      modelId = result.modelId
      modelDir = result.modelDir
    } catch (dirError) {
      console.error("Failed to create model directory:", dirError)
      throw new Error(`Failed to create model directory: ${dirError.message}`)
    }

    try {
      // Check if LeoCAD is installed
      try {
        const leocadExists = await this.checkCommandExists("leocad")
        if (!leocadExists) {
          throw new Error("LeoCAD executable not found in PATH")
        }
        console.log("LeoCAD command found in PATH")
      } catch (error) {
        console.log("LeoCAD not found in PATH.")
        throw new Error("LeoCAD not available: " + error.message)
      }

      // Define view angles
      const views = [
        { name: "front", args: "--camera-angles=0,0,0" },
        { name: "back", args: "--camera-angles=0,180,0" },
        { name: "top", args: "--camera-angles=90,0,0" },
        { name: "bottom", args: "--camera-angles=-90,0,0" },
        { name: "left", args: "--camera-angles=0,90,0" },
        { name: "right", args: "--camera-angles=0,-90,0" },
      ]

      const viewPaths = []

      // Generate each view using LeoCAD
      for (const view of views) {
        const outputPath = path.join(modelDir, `${view.name}.jpg`)
        const command = `leocad "${ldrFilePath}" ${view.args} --image-width=800 --image-height=600 --export-format=jpg --export="${outputPath}" --ldrawpath="${this.ldrawPartsPath}"`

        try {
          console.log(`Executing: ${command}`)
          execSync(command, { timeout: 30000 })
          viewPaths.push(outputPath)
          console.log(`Saved view: ${outputPath}`)
        } catch (error) {
          console.error(`Error generating ${view.name} view:`, error)
          throw new Error(`Failed to generate ${view.name} view: ${error.message}`)
        }
      }

      if (viewPaths.length === 0) {
        throw new Error("Failed to generate any views with LeoCAD")
      }

      return {
        modelId,
        viewPaths,
      }
    } catch (error) {
      console.error("Error using LeoCAD:", error)
      // Clean up the model directory if it was created but no views were generated
      if (fs.existsSync(modelDir)) {
        try {
          fs.rmdirSync(modelDir, { recursive: true })
          console.log(`Cleaned up empty model directory: ${modelDir}`)
        } catch (cleanupError) {
          console.error(`Failed to clean up model directory: ${cleanupError.message}`)
        }
      }
      throw new Error(`Failed to sample views with LeoCAD: ${error.message}`)
    }
  }

  // Method 3: Use L3P and POV-Ray
  async sampleViewsWithL3P(ldrFilePath) {
    if (!fs.existsSync(ldrFilePath)) {
      throw new Error(`LDR file not found: ${ldrFilePath}`)
    }

    console.log(`Sampling views from LDR file using L3P and POV-Ray: ${ldrFilePath}`)

    // Create model directory using the helper method
    let modelId, modelDir
    try {
      const result = await this.createModelDirectory()
      modelId = result.modelId
      modelDir = result.modelDir
    } catch (dirError) {
      console.error("Failed to create model directory:", dirError)
      throw new Error(`Failed to create model directory: ${dirError.message}`)
    }

    try {
      // Check if L3P and POV-Ray are installed
      try {
        console.log("Checking for L3P and POV-Ray availability...")
        const l3pExists = await this.checkCommandExists("l3p")
        const povrayExists = await this.checkCommandExists("povray")

        if (!l3pExists || !povrayExists) {
          throw new Error("L3P or POV-Ray not available - this is expected if you haven't installed these tools")
        }

        console.log("L3P and POV-Ray are installed and available")
      } catch (error) {
        console.log("L3P or POV-Ray not found in PATH - this is OK if other rendering methods are available")
        throw new Error("L3P or POV-Ray not available: " + error.message)
      }

      // Define view angles
      const views = [
        { name: "front", args: "-b0,0" },
        { name: "back", args: "-b0,180" },
        { name: "top", args: "-b90,0" },
        { name: "bottom", args: "-b-90,0" },
        { name: "left", args: "-b0,90" },
        { name: "right", args: "-b0,-90" },
      ]

      const viewPaths = []

      // Generate each view using L3P and POV-Ray
      for (const view of views) {
        const povPath = path.join(this.tempDir, `${modelId}_${view.name}.pov`)
        const outputPath = path.join(modelDir, `${view.name}.jpg`)

        // Step 1: Convert LDR to POV using L3P
        const l3pCommand = `l3p "${ldrFilePath}" ${view.args} -o"${povPath}" -ldraw="${this.ldrawPartsPath}"`

        // Step 2: Render POV to image using POV-Ray
        const povrayCommand = `povray "${povPath}" +W800 +H600 +A +FJ +O"${outputPath}"`

        try {
          console.log(`Executing L3P: ${l3pCommand}`)
          execSync(l3pCommand, { timeout: 30000 })

          console.log(`Executing POV-Ray: ${povrayCommand}`)
          execSync(povrayCommand, { timeout: 60000 })

          viewPaths.push(outputPath)
          console.log(`Saved view: ${outputPath}`)
        } catch (error) {
          console.error(`Error generating ${view.name} view:`, error)
          throw new Error(`Failed to generate ${view.name} view: ${error.message}`)
        }
      }

      if (viewPaths.length === 0) {
        throw new Error("Failed to generate any views with L3P and POV-Ray")
      }

      return {
        modelId,
        viewPaths,
      }
    } catch (error) {
      console.error("Error using L3P and POV-Ray:", error)
      // Clean up the model directory if it was created but no views were generated
      if (fs.existsSync(modelDir)) {
        try {
          fs.rmdirSync(modelDir, { recursive: true })
          console.log(`Cleaned up empty model directory: ${modelDir}`)
        } catch (cleanupError) {
          console.error(`Failed to clean up model directory: ${cleanupError.message}`)
        }
      }
      throw new Error(`Failed to sample views with L3P and POV-Ray: ${error.message}`)
    }
  }

  // Main method that tries all available methods
  async sampleViews(ldrFilePath) {
    if (!fs.existsSync(ldrFilePath)) {
      throw new Error(`LDR file not found: ${ldrFilePath}`)
    }

    console.log(`Sampling views from LDR file: ${ldrFilePath}`)

    // Try each method in order of preference
    const methods = [
      { name: "LDView", method: this.sampleViewsWithLDView.bind(this) },
      { name: "LeoCAD", method: this.sampleViewsWithLeoCAD.bind(this) },
      { name: "L3P", method: this.sampleViewsWithL3P.bind(this) },
    ]

    const errors = []

    for (const { name, method } of methods) {
      try {
        console.log(`Trying to sample views using ${name}...`)
        const result = await method(ldrFilePath)
        console.log(`Successfully sampled views using ${name}`)
        return result
      } catch (error) {
        console.log(`${name} method not available or failed: ${error.message} - trying next method if available`)
        errors.push(`${name}: ${error.message}`)
      }
    }

    // If all methods fail, throw a comprehensive error
    throw new Error(`Failed to render LDR file. All methods failed: ${errors.join("; ")}`)
  }
}

module.exports = LDRSampler

