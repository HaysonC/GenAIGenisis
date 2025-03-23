require("dotenv").config()
const fs = require("fs")
const path = require("path")
const { execSync, spawn } = require("child_process")
const util = require("util")
const exec = util.promisify(require("child_process").exec)
const os = require("os")

class ModelToLDR {
  constructor() {
    this.outputDir = path.join(__dirname, "ldr_output")
    this.tempDir = path.join(os.tmpdir(), "model_to_ldr_temp")
    this.binvoxPath = process.env.BINVOX_PATH || "binvox" // Path to binvox executable
    this.pythonPath = process.env.PYTHON_PATH || "python" // Path to Python executable

    // Create necessary directories
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true })
    }

    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true })
    }

    // Set paths to Python scripts
    this.scriptsDir = path.join(__dirname, "scripts")
    this.objToLdrPath = path.join(this.scriptsDir, "obj_to_ldr.py")
    
    // Verify that Python scripts exist
    if (!fs.existsSync(this.objToLdrPath)) {
      throw new Error(`Required Python script not found: ${this.objToLdrPath}`)
    }

    console.log(`ModelToLDR initialized with output directory: ${this.outputDir}`)
  }

  /**
   * Convert a 3D model (OBJ/GLB) to LDR format
   * @param {string} modelPath - Path to the 3D model file
   * @param {Object} options - Conversion options
   * @param {number} options.resolution - Voxel resolution (default: 80)
   * @returns {Promise<Object>} - Object containing the path to the LDR file and other metadata
   */
  async convertToLDR(modelPath, options = {}) {
    if (!fs.existsSync(modelPath)) {
      throw new Error(`Model file not found: ${modelPath}`)
    }

    console.log(`Converting model to LDR: ${modelPath}`)

    // Get the file extension
    const fileExt = path.extname(modelPath).toLowerCase()
    console.log(`File extension: ${fileExt}`)

    // Check if the file is an OBJ, STL, or GLB
    if (fileExt === ".obj") {
      return await this.convertOBJToLDR(modelPath, options)
    } else if (fileExt === ".stl") {
      console.log("STL file detected. Attempting to convert to OBJ first...")
      // Create a temporary OBJ file path
      const objPath = modelPath.replace(/\.stl$/i, ".obj")

      // Log the conversion attempt
      console.log(`Converting STL to OBJ: ${modelPath} -> ${objPath}`)

      try {
        // Use trimesh to convert STL to OBJ
        const stlToObjScript = `
import trimesh
mesh = trimesh.load('${modelPath.replace(/\\/g, "\\\\")}')
mesh.export('${objPath.replace(/\\/g, "\\\\")}')
print('Conversion successful')
        `
        const tempScriptPath = path.join(this.tempDir, "stl_to_obj.py")
        fs.writeFileSync(tempScriptPath, stlToObjScript)

        const { stdout, stderr } = await exec(`${this.pythonPath} ${tempScriptPath}`)
        console.log("STL to OBJ conversion output:", stdout)

        if (fs.existsSync(objPath)) {
          console.log("STL to OBJ conversion successful")
          return await this.convertOBJToLDR(objPath, options)
        } else {
          throw new Error("STL to OBJ conversion failed: Output file not created")
        }
      } catch (error) {
        console.error("STL to OBJ conversion error:", error)
        throw new Error(`Failed to convert STL to OBJ: ${error.message}`)
      }
    } else if (fileExt === ".glb") {
      throw new Error("GLB to LDR conversion is not implemented yet. This is a placeholder for future functionality.")
    } else {
      throw new Error(`Unsupported file format: ${fileExt}. Only OBJ and STL files are supported.`)
    }
  }

  /**
   * Convert an OBJ file to LDR format using the external Python script
   * @param {string} objPath - Path to the OBJ file
   * @param {Object} options - Conversion options
   * @param {number} options.resolution - Voxel resolution (default: 64)
   * @returns {Promise<Object>} - Object containing the path to the LDR file and other metadata
   */
  async convertOBJToLDR(objPath, options = {}) {
    if (!fs.existsSync(objPath)) {
      throw new Error(`OBJ file not found: ${objPath}`)
    }

    console.log(`Converting OBJ to LDR: ${objPath}`)

    const resolution = options.resolution || 64
    const modelId = Date.now().toString()
    const outputLdrPath = path.join(this.outputDir, `${modelId}.ldr`)

    try {
      // Check if required Python packages are installed
      try {
        await exec(`${this.pythonPath} -c "import numpy, trimesh, scipy, colorsys"`)
        console.log("Required Python packages are available")
      } catch (error) {
        console.warn("Some required Python packages may be missing. Attempting to install...")
        try {
          await exec(`${this.pythonPath} -m pip install numpy trimesh scipy`)
          console.log("Successfully installed required Python packages")
        } catch (pipError) {
          console.error("Failed to install required packages:", pipError)
          throw new Error(
            "Failed to install required Python packages. Please install numpy, trimesh, scipy and colorsys manually.",
          )
        }
      }

      // Run the external Python script directly
      console.log(`Running obj_to_ldr.py with resolution: ${resolution}`)
      console.log(`Input file: ${objPath}`)
      console.log(`Output file: ${outputLdrPath}`)
      
      const command = `${this.pythonPath} "${this.objToLdrPath}" "${objPath}" "${outputLdrPath}" ${resolution}`
      console.log(`Executing command: ${command}`)
      
      const { stdout, stderr } = await exec(command)
      console.log("Python script output:", stdout)
      if (stderr) {
        console.error("Python script error:", stderr)
      }

      // Check if the LDR file was created
      if (!fs.existsSync(outputLdrPath)) {
        console.error("LDR file was not created. Generating placeholder instead.")
        throw new Error("LDR file was not created")
      }

      const fileSize = fs.statSync(outputLdrPath).size
      console.log(`LDR file created: ${outputLdrPath} (${fileSize} bytes)`)

      return {
        ldrFilePath: outputLdrPath,
        url: `/ldr_output/${path.basename(outputLdrPath)}`,
        modelId,
        fileSize,
      }
    } catch (error) {
      console.error("Error converting OBJ to LDR:", error)

      // If conversion fails, generate a placeholder LDR file
      console.log("Generating placeholder LDR file instead")
      const placeholderContent = this.generatePlaceholderLDR(modelId)
      fs.writeFileSync(outputLdrPath, placeholderContent)

      const fileSize = fs.statSync(outputLdrPath).size

      return {
        ldrFilePath: outputLdrPath,
        url: `/ldr_output/${path.basename(outputLdrPath)}`,
        modelId,
        fileSize,
        isPlaceholder: true,
        conversionError: error.message,
      }
    }
  }

  /**
   * Generate a placeholder LDR file with a simple brick
   * @param {string} modelId - Unique ID for the model
   * @returns {string} - LDR file content
   */
  generatePlaceholderLDR(modelId) {
    // This is a very simple LDR file with a 2x4 brick
    // In a real implementation, you would generate this based on the actual 3D model
    return `0 Converted Model ${modelId}
0 Name: model_${modelId}.ldr
0 Author: LEGOFIKS AI Model Converter
0 !LDRAW_ORG Unofficial_Model
0 !LICENSE Redistributable under CCAL version 2.0 : see CAreadme.txt

0 !HISTORY ${new Date().toISOString()} [AI] Generated from 3D model

1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat
1 14 0 -24 0 1 0 0 0 1 0 0 0 1 3001.dat
1 14 0 -48 0 1 0 0 0 1 0 0 0 1 3003.dat
1 4 0 -72 0 1 0 0 0 1 0 0 0 1 3003.dat
1 14 0 -96 0 1 0 0 0 1 0 0 0 1 3002.dat
1 4 0 -120 0 1 0 0 0 1 0 0 0 1 3002.dat
1 14 0 -144 0 1 0 0 0 1 0 0 0 1 3004.dat
1 4 0 -168 0 1 0 0 0 1 0 0 0 1 3004.dat
`
  }

  /**
   * Optimize an LDR file by simplifying the model and reducing part count
   * @param {string} ldrPath - Path to the LDR file
   * @returns {Promise<Object>} - Object containing the path to the optimized LDR file and other metadata
   */
  async optimizeLDR(ldrPath) {
    if (!fs.existsSync(ldrPath)) {
      throw new Error(`LDR file not found: ${ldrPath}`)
    }

    console.log(`Optimizing LDR file: ${ldrPath}`)

    // Create a new file path for the optimized LDR
    const optimizedLdrPath = ldrPath.replace(/\.ldr$/i, "_optimized.ldr")

    try {
      // Read the original LDR file
      const ldrContent = fs.readFileSync(ldrPath, "utf8")
      const lines = ldrContent.split("\n")

      // Simple optimization: remove duplicate bricks at the same position
      const uniqueBricks = new Map()
      const headerLines = []
      const brickLines = []

      lines.forEach((line) => {
        if (line.startsWith("1 ")) {
          // This is a brick line
          const parts = line.split(" ")
          // Use position and part type as a unique key
          const key = `${parts[2]}_${parts[3]}_${parts[4]}_${parts[14]}`
          uniqueBricks.set(key, line)
        } else {
          // This is a header or comment line
          headerLines.push(line)
        }
      })

      // Combine header and unique bricks
      const optimizedContent = [...headerLines, ...Array.from(uniqueBricks.values())].join("\n")

      // Write the optimized file
      fs.writeFileSync(optimizedLdrPath, optimizedContent)

      const fileSize = fs.statSync(optimizedLdrPath).size
      console.log(`Optimized LDR file created: ${optimizedLdrPath} (${fileSize} bytes)`)

      return {
        ldrFilePath: optimizedLdrPath,
        url: `/ldr_output/${path.basename(optimizedLdrPath)}`,
        fileSize,
        originalSize: fs.statSync(ldrPath).size,
        reductionPercent: (((fs.statSync(ldrPath).size - fileSize) / fs.statSync(ldrPath).size) * 100).toFixed(2),
      }
    } catch (error) {
      console.error("Error optimizing LDR file:", error)
      throw new Error(`Failed to optimize LDR file: ${error.message}`)
    }
  }
}

module.exports = ModelToLDR

