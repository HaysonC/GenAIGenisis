"use client"

import { useState, useRef, useEffect } from "react"
import "./App.css"
import axios from "axios"
import ThreeViewer from "./components/ThreeViewer"
import ChatBox from "./components/ChatBox"
import UploadModal from "./components/UploadModal"
import {
  FaCube,
  FaTools,
  FaCubes,
  FaInfoCircle,
  FaKeyboard,
  FaImage,
  FaDiceD6,
  FaDownload,
  FaEye,
  FaList,
  FaFileAlt,
  FaHardHat,
  FaTruck,
} from "react-icons/fa"

/**
 * Base URL for API requests
 * @type {string}
 */
const API_BASE_URL = "http://localhost:5001"

/**
 * Main application component
 * @returns {JSX.Element} The rendered application
 */
function App() {
  // Debug state
  const [debugMode, setDebugMode] = useState(false)
  const [debugLogs, setDebugLogs] = useState([])
  const debugLogRef = useRef(null)

  // Main state
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [description, setDescription] = useState("")
  const [modelUrl, setModelUrl] = useState("")
  const [modelId, setModelId] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [currentStep, setCurrentStep] = useState("upload") // upload, describe, generate, view
  const [generationProgress, setGenerationProgress] = useState(0)
  const [isImageUploaded, setIsImageUploaded] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [highContrast, setHighContrast] = useState(false)
  const [inputMode, setInputMode] = useState("image") // "image", "text", or "ldr"
  const [textPrompt, setTextPrompt] = useState("")
  const [modelType, setModelType] = useState("3d") // "3d" or "ldr"
  const [ldrFile, setLdrFile] = useState(null)
  const [ldrViews, setLdrViews] = useState([])
  const bricksRef = useRef(null)
  const [ldrUrl, setLdrUrl] = useState("")
  const [ldrFilePath, setLdrFilePath] = useState("")
  const [showLdrConversion, setShowLdrConversion] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [conversionProgress, setConversionProgress] = useState(0)
  const [instructions, setInstructions] = useState(null)
  const [partsList, setPartsList] = useState([])
  const [activeTab, setActiveTab] = useState("model") // "model", "instructions", "parts"
  const [viewsData, setViewsData] = useState(null)
  const [imageDescription, setImageDescription] = useState("") // Store the image description

  /**
   * Add a log entry to the debug logs
   * @param {string} message - The log message
   * @param {*} data - Optional data to log
   */
  const addDebugLog = (message, data = null) => {
    if (!debugMode) return

    const timestamp = new Date().toISOString()
    const logEntry = {
      id: Date.now(),
      timestamp,
      message,
      data,
    }

    setDebugLogs((prevLogs) => [...prevLogs, logEntry])

    // Scroll to bottom of debug panel when new log is added
    setTimeout(() => {
      if (debugLogRef.current) {
        debugLogRef.current.scrollTop = debugLogRef.current.scrollHeight
      }
    }, 100)
  }

  /**
   * Clear all debug logs
   */
  const clearDebugLogs = () => {
    setDebugLogs([])
  }

  /**
   * Toggle debug mode on/off
   */
  const toggleDebugMode = () => {
    setDebugMode(!debugMode)
  }

  /**
   * Animate LEGO bricks in progress bar
   */
  useEffect(() => {
    if (bricksRef.current && loading) {
      const bricks = bricksRef.current.children
      for (let i = 0; i < bricks.length; i++) {
        setTimeout(() => {
          bricks[i].style.animation = "buildBrick 0.5s forwards"
        }, i * 100)
      }
    }
  }, [loading, generationProgress])

  /**
   * Handle file selection
   * @param {File} file - The selected file
   */
  const handleFileChange = (file) => {
    if (file) {
      addDebugLog("File selected", {
        name: file.name,
        type: file.type,
        size: file.size,
      })

      // Check if file is PNG or JPG for image mode
      if (inputMode === "image") {
        const fileType = file.type
        if (fileType !== "image/png" && fileType !== "image/jpeg") {
          setError("Please select a PNG or JPG image file")
          addDebugLog("Invalid file type", { fileType })
          return
        }
      }
      // Check if file is LDR for LDR mode
      else if (inputMode === "ldr") {
        const fileName = file.name.toLowerCase()
        if (!fileName.endsWith(".ldr") && !fileName.endsWith(".mpd") && !fileName.endsWith(".dat")) {
          setError("Please select an LDR, MPD, or DAT file")
          addDebugLog("Invalid file type", { fileName })
          return
        }
      }

      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      setError("")
    }
  }

  /**
   * Handle file upload
   */
  const handleUploadImage = async () => {
    if (!selectedFile) {
      setError("Please select a file first")
      addDebugLog("Upload attempted without file selection")
      return
    }

    addDebugLog(`Starting upload of ${inputMode === "image" ? "image" : "LDR file"}`, {
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
    })

    try {
      // Create form data for file upload
      const formData = new FormData()

      if (inputMode === "image") {
        formData.append("image", selectedFile)
        addDebugLog("Sending image upload request to server")

        // Step 1: Upload the image
        const uploadResponse = await axios.post(`${API_BASE_URL}/upload-image`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })

        addDebugLog("Received upload response", uploadResponse.data)

        if (!uploadResponse.data.imagePath) {
          throw new Error("Failed to upload image")
        }

        // Get the image description if available
        try {
          const descriptionResponse = await axios.get(`${API_BASE_URL}/image-description`)
          if (descriptionResponse.data && descriptionResponse.data.description) {
            setImageDescription(descriptionResponse.data.description)
            addDebugLog("Retrieved image description", { description: descriptionResponse.data.description })
          }
        } catch (descError) {
          console.error("Error getting image description:", descError)
          addDebugLog("Error getting image description", { error: descError.message })
        }
      } else if (inputMode === "ldr") {
        formData.append("ldrFile", selectedFile)
        setLdrFile(selectedFile)
        addDebugLog("LDR file prepared for processing")
      }

      // Close modal and show the preview
      setIsModalOpen(false)
      setIsImageUploaded(true)
      setCurrentStep("ready")
      addDebugLog(`${inputMode === "image" ? "Image" : "LDR file"} upload successful, ready for processing`)
    } catch (err) {
      console.error(`Error uploading ${inputMode === "image" ? "image" : "LDR file"}:`, err)
      const errorMessage = err.response?.data?.message || err.message || `An error occurred during upload`
      setError(errorMessage)
      addDebugLog(`Upload error`, {
        message: errorMessage,
        response: err.response?.data,
        status: err.response?.status,
      })
    }
  }

  /**
   * Convert 3D model to LDR format
   */
  const handleConvertToLDR = async () => {
    if (!modelUrl) {
      setError("No 3D model to convert")
      addDebugLog("LDR conversion attempted without model URL")
      return
    }

    setIsConverting(true)
    setError("")
    setConversionProgress(25)
    addDebugLog("Starting 3D model to LDR conversion", { modelUrl })

    try {
      // Extract the model path from the URL
      const modelPath = modelUrl.startsWith("/") ? modelUrl : `/${modelUrl}`
      addDebugLog("Extracted model path", { modelPath })

      // Call the API to convert the model to LDR
      addDebugLog("Sending convert-to-ldr request to server")
      const response = await axios.post(`${API_BASE_URL}/convert-to-ldr`, {
        modelPath,
      })
      addDebugLog("Received convert-to-ldr response", response.data)

      // Check if we got an error about not being implemented
      if (response.data.ldrConversionError) {
        setConversionProgress(100)
        setShowLdrConversion(false)
        setError(`LDR conversion not available: ${response.data.ldrConversionError}`)
        addDebugLog("LDR conversion not implemented", { error: response.data.ldrConversionError })
      } else if (response.data.url) {
        setLdrUrl(response.data.url)
        setLdrFilePath(response.data.ldrFilePath)
        setConversionProgress(100)
        setShowLdrConversion(false)
        addDebugLog("LDR conversion successful", {
          ldrUrl: response.data.url,
          ldrFilePath: response.data.ldr.ldrFilePath,
        })

        // Get parts list for the LDR file
        try {
          const partsResponse = await axios.post(`${API_BASE_URL}/get-parts`, {
            ldrFilePath: response.data.ldr.ldrFilePath,
          })
          setPartsList(partsResponse.data)
          addDebugLog("Retrieved parts list", { parts: partsResponse.data })
        } catch (partsError) {
          console.error("Error getting parts list:", partsError)
          addDebugLog("Error getting parts list", { error: partsError.message })
        }
      } else {
        throw new Error("No LDR URL received")
      }
    } catch (err) {
      console.error("Error converting to LDR:", err)
      let errorMessage = "An error occurred during LDR conversion"

      // Check for specific error about not implemented functionality
      if (err.response?.status === 501) {
        errorMessage = "3D model to LDR conversion is not implemented yet"
        addDebugLog("LDR conversion not implemented (501)", {
          status: err.response?.status,
          data: err.response?.data,
        })
      } else {
        errorMessage = err.response?.data?.message || err.message || errorMessage
        addDebugLog("LDR conversion error", {
          message: errorMessage,
          response: err.response?.data,
          status: err.response?.status,
        })
      }

      setError(errorMessage)
    } finally {
      setIsConverting(false)
      addDebugLog("LDR conversion process completed")
    }
  }

  /**
   * Update progress from server data
   * @param {Object} progressData - Progress data from server
   */
  const updateProgressFromServer = (progressData) => {
    if (progressData && typeof progressData.progress === "number") {
      // Update the progress bar with the server's progress value
      setGenerationProgress(progressData.progress)

      // Add to debug log
      addDebugLog("Progress update from server", progressData)

      // If there's a status message, update the UI
      if (progressData.status) {
        // You could set this to a new state variable to display in the UI
        addDebugLog("Status update from server", progressData.status)
      }
    }
  }

  /**
   * Generate 3D model from image and convert to LDR
   */
  const handleGenerateFromImageToLDR = async () => {
    try {
      setCurrentStep("generate")
      setGenerationProgress(10)
      setConversionProgress(0)
      addDebugLog("Starting image to 3D model to LDR pipeline")

      // Generate LDR directly from image
      addDebugLog("Sending generate-ldr-from-image request to server")

      // Initial progress update
      setGenerationProgress(20)

      // Set up polling for progress updates
      const progressPollId = setInterval(async () => {
        try {
          const progressResponse = await axios.get(`${API_BASE_URL}/generation-progress`)
          if (progressResponse.data) {
            updateProgressFromServer(progressResponse.data)
          }
        } catch (pollError) {
          console.error("Error polling for progress:", pollError)
        }
      }, 2000) // Poll every 2 seconds

      const response = await axios.post(`${API_BASE_URL}/generate-ldr-from-image`, {
        options: {
          guidance_scale: 15.0,
          num_steps: 24,
          resolution: 80,
        },
        originalDescription: imageDescription, // Pass the original image description to the server
      })

      // Clear the polling interval once we get the response
      clearInterval(progressPollId)

      setGenerationProgress(60)
      addDebugLog("Received generate-ldr-from-image response", response.data)

      // Set the description and model information
      setDescription(response.data.description)
      setModelUrl(response.data.model.url)
      setModelId(response.data.model.filename)
      setModelType("3d")

      setGenerationProgress(80)
      addDebugLog("3D model generation successful", {
        description: response.data.description,
        modelUrl: response.data.model.url,
        modelId: response.data.model.filename,
      })

      // Check if LDR conversion was successful
      if (response.data.ldr) {
        setLdrUrl(response.data.ldr.url)
        setLdrFilePath(response.data.ldr.ldrFilePath)
        addDebugLog("LDR conversion successful", {
          ldrUrl: response.data.ldr.url,
          ldrFilePath: response.data.ldr.ldrFilePath,
        })

        // Store views data if available
        if (response.data.views) {
          setViewsData(response.data.views)
          addDebugLog("Views data received", response.data.views)
        }

        // Store instructions if available
        if (response.data.instructions) {
          // Make sure we're properly handling the instructions structure
          const processedInstructions = {
            building: response.data.instructions.building || "",
            engineering: response.data.instructions.engineering || "",
            supplier: response.data.instructions.style || "", // Note: server uses 'style' but we use 'supplier' in the UI
            original: response.data.instructions.original || "",
          }
          setInstructions(processedInstructions)
          addDebugLog("Instructions received and processed", processedInstructions)
        }

        // Get parts list for the LDR file
        try {
          const partsResponse = await axios.post(`${API_BASE_URL}/get-parts`, {
            ldrFilePath: response.data.ldr.ldrFilePath,
          })
          setPartsList(partsResponse.data)
          addDebugLog("Retrieved parts list", { parts: partsResponse.data })
        } catch (partsError) {
          console.error("Error getting parts list:", partsError)
          addDebugLog("Error getting parts list", { error: partsError.message })
        }
      } else if (response.data.ldrConversionError) {
        addDebugLog("LDR conversion failed", {
          error: response.data.ldrConversionError,
        })
        // Don't set an error, just log it, since the 3D model was generated successfully
      }

      setCurrentStep("view")
      setGenerationProgress(100)
    } catch (error) {
      console.error("Error generating from image to LDR:", error)
      addDebugLog("Error in image to 3D model to LDR pipeline", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      })
      throw error
    }
  }

  /**
   * Generate 3D model from text and convert to LDR
   */
  const handleGenerateFromTextToLDR = async () => {
    try {
      setDescription(`Creating a LEGO model based on: "${textPrompt}"`)
      setCurrentStep("generate")
      setGenerationProgress(10)
      setConversionProgress(0)
      addDebugLog("Starting text to 3D model to LDR pipeline", { textPrompt })

      // Generate LDR directly from text
      addDebugLog("Sending generate-ldr-from-text request to server")

      // Update progress as the pipeline progresses
      setGenerationProgress(20)

      const response = await axios.post(`${API_BASE_URL}/generate-ldr-from-text`, {
        prompt: textPrompt,
        options: {
          guidance_scale: 15.0,
          num_steps: 24,
          resolution: 80,
        },
        originalDescription: textPrompt, // Pass the text prompt as the original description
      })

      setGenerationProgress(60)
      addDebugLog("Received generate-ldr-from-text response", response.data)

      // Set the model information
      setModelUrl(response.data.model.url)
      setModelId(response.data.model.filename)
      setModelType("3d")

      setGenerationProgress(80)
      addDebugLog("3D model generation successful", {
        modelUrl: response.data.model.url,
        modelId: response.data.model.filename,
      })

      // Check if LDR conversion was successful
      if (response.data.ldr) {
        setLdrUrl(response.data.ldr.url)
        setLdrFilePath(response.data.ldr.ldrFilePath)
        addDebugLog("LDR conversion successful", {
          ldrUrl: response.data.ldr.url,
          ldrFilePath: response.data.ldr.ldrFilePath,
        })

        // Store views data if available
        if (response.data.views) {
          setViewsData(response.data.views)
          addDebugLog("Views data received", response.data.views)
        }

        // Store instructions if available
        if (response.data.instructions) {
          setInstructions(response.data.instructions)
          addDebugLog("Instructions received", response.data.instructions)
        }

        // Get parts list for the LDR file
        try {
          const partsResponse = await axios.post(`${API_BASE_URL}/get-parts`, {
            ldrFilePath: response.data.ldr.ldrFilePath,
          })
          setPartsList(partsResponse.data)
          addDebugLog("Retrieved parts list", { parts: partsResponse.data })
        } catch (partsError) {
          console.error("Error getting parts list:", partsError)
          addDebugLog("Error getting parts list", { error: partsError.message })
        }
      } else if (response.data.ldrConversionError) {
        addDebugLog("LDR conversion failed", {
          error: response.data.ldrConversionError,
        })
        // Don't set an error, just log it, since the 3D model was generated successfully
      }

      setCurrentStep("view")
      setGenerationProgress(100)
    } catch (error) {
      console.error("Error generating from text to LDR:", error)
      addDebugLog("Error in text to 3D model to LDR pipeline", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      })
      throw error
    }
  }

  /**
   * Process LDR file
   */
  const handleProcessLDR = async () => {
    console.log("Processing LDR file:", selectedFile)
    addDebugLog("Starting LDR file processing", {
      fileName: selectedFile?.name,
      fileSize: selectedFile?.size,
    })

    try {
      // Set loading state and progress
      setLoading(true)
      setGenerationProgress(20)

      // Call API to process LDR file
      const formData = new FormData()
      formData.append("ldrFile", selectedFile)
      addDebugLog("Sending process-ldr request to server")

      setGenerationProgress(40)

      const response = await axios.post(`${API_BASE_URL}/process-ldr`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })

      setGenerationProgress(70)
      addDebugLog("Received process-ldr response", response.data)

      if (response.data.viewPaths) {
        // Update state with the generated views
        setLdrViews(response.data.viewPaths)
        setModelType("ldr")
        setCurrentStep("view")
        setGenerationProgress(90)

        // Store views data
        setViewsData({
          modelId: response.data.modelId,
          viewPaths: response.data.viewPaths,
        })

        // Store instructions if available
        if (response.data.instructions) {
          // Process instructions to ensure correct structure
          const processedInstructions = {
            building: response.data.instructions.building || "",
            engineering: response.data.instructions.engineering || "",
            supplier: response.data.instructions.style || "", // Note: server uses 'style' but we use 'supplier' in the UI
            original: response.data.instructions.original || "",
          }
          setInstructions(processedInstructions)
          addDebugLog("Instructions received and processed", processedInstructions)
        }

        // Get parts list for the LDR file
        try {
          const ldrFilePath = selectedFile.path || selectedFile.name
          const partsResponse = await axios.post(`${API_BASE_URL}/upload-ldr-for-parts`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          })
          setPartsList(partsResponse.data.partList)
          addDebugLog("Retrieved parts list", { parts: partsResponse.data.partList })
        } catch (partsError) {
          console.error("Error getting parts list:", partsError)
          addDebugLog("Error getting parts list", { error: partsError.message })
        }

        addDebugLog("LDR processing successful", {
          viewCount: response.data.viewPaths.length,
          modelId: response.data.modelId,
        })

        setGenerationProgress(100)
      } else {
        throw new Error("No LDR views received")
      }
    } catch (error) {
      console.error("Error processing LDR file:", error)
      setError("Failed to process LDR file")
      addDebugLog("Error processing LDR file", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      })
    } finally {
      setLoading(false)
    }
  }

  /**
   * Fetch instructions for a specific model ID
   * @param {string} modelId - The model ID to fetch instructions for
   */
  const fetchInstructions = async (modelId) => {
    if (!modelId) {
      addDebugLog("Fetch instructions attempted without model ID")
      return
    }

    try {
      addDebugLog("Fetching instructions for model", { modelId })
      const response = await axios.get(`${API_BASE_URL}/get-instructions/${modelId}`)

      if (response.data && response.data.instructions) {
        // Process instructions to ensure correct structure
        const processedInstructions = {
          building: response.data.instructions.building || "",
          engineering: response.data.instructions.engineering || "",
          supplier: response.data.instructions.style || "", // Note: server uses 'style' but we use 'supplier' in the UI
          original: response.data.instructions.original || "",
        }
        setInstructions(processedInstructions)
        addDebugLog("Instructions fetched successfully", processedInstructions)
      } else {
        addDebugLog("No instructions found for model", { modelId })
      }
    } catch (error) {
      console.error("Error fetching instructions:", error)
      addDebugLog("Error fetching instructions", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      })
    }
  }

  /**
   * Main function to handle model generation
   */
  const handleGenerateModel = async () => {
    if (inputMode === "image" && (!selectedFile || !isImageUploaded)) {
      setError("Please upload an image first")
      addDebugLog("Generation attempted without image upload")
      return
    }

    if (inputMode === "text" && !textPrompt.trim()) {
      setError("Please enter a text description first")
      addDebugLog("Generation attempted without text prompt")
      return
    }

    if (inputMode === "ldr" && (!selectedFile || !isImageUploaded)) {
      setError("Please upload an LDR file first")
      addDebugLog("Processing attempted without LDR file upload")
      return
    }

    setLoading(true)
    setError("")
    setCurrentStep("describe")
    setGenerationProgress(5)
    setIsGenerating(true)
    addDebugLog(`Starting ${inputMode} processing pipeline`)

    try {
      if (inputMode === "image") {
        // Generate 3D model and LDR from image
        addDebugLog("Initiating image to 3D model pipeline")
        await handleGenerateFromImageToLDR()
      } else if (inputMode === "text") {
        // Generate 3D model and LDR from text
        addDebugLog("Initiating text to 3D model pipeline")
        await handleGenerateFromTextToLDR()
      } else if (inputMode === "ldr") {
        // Process LDR file
        addDebugLog("Initiating LDR file processing")
        await handleProcessLDR()
      }
    } catch (err) {
      console.error("Error processing:", err)
      const errorMessage = err.response?.data?.message || err.message || "An error occurred during processing"
      setError(errorMessage)
      setCurrentStep("ready")
      setGenerationProgress(0)
      addDebugLog("Processing pipeline error", {
        message: errorMessage,
        response: err.response?.data,
        status: err.response?.status,
      })
    } finally {
      setLoading(false)
      setIsGenerating(false)
      addDebugLog("Processing pipeline completed")
    }
  }

  /**
   * Download LDR file
   */
  const handleDownloadLDR = () => {
    if (!ldrUrl) {
      setError("No LDR file to download")
      return
    }

    // Create a link to download the file
    const link = document.createElement("a")
    link.href = `${API_BASE_URL}${ldrUrl}`
    link.download = ldrUrl.split("/").pop() || "model.ldr"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  /**
   * Download instructions
   * @param {string} type - The type of instructions to download
   */
  const handleDownloadInstructions = (type) => {
    if (!instructions) {
      setError(`No instructions available`)
      return
    }

    // Handle the supplier/style naming difference
    let content
    if (type === "supplier" && !instructions.supplier && instructions.style) {
      content = instructions.style
    } else {
      content = instructions[type]
    }

    if (!content) {
      setError(`No ${type} instructions available`)
      return
    }

    // Create a blob with the instructions text
    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)

    // Create a link to download the file
    const link = document.createElement("a")
    link.href = url
    link.download = `${type}_instructions.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // Clean up
    URL.revokeObjectURL(url)
  }

  /**
   * Download parts list as CSV
   */
  const handleDownloadPartsList = () => {
    if (!partsList || partsList.length === 0) {
      setError("No parts list available")
      return
    }

    // Create CSV content
    let csvContent = "Part Name,Total Count,Color Variations\n"

    partsList.forEach((part) => {
      const colorInfo = part.colorVariations.map((cv) => `${cv.colorCode}:${cv.count}`).join("; ")
      csvContent += `${part.fileName},${part.totalCount},"${colorInfo}"\n`
    })

    // Create a blob with the CSV content
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)

    // Create a link to download the file
    const link = document.createElement("a")
    link.href = url
    link.download = "parts_list.csv"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // Clean up
    URL.revokeObjectURL(url)
  }

  /**
   * Improve model based on chat instructions
   * @param {string} instructions - Instructions for model improvement
   */
  const handleImproveModel = async (instructions) => {
    if (!modelId) {
      setError("No model to improve")
      addDebugLog("Model improvement attempted without model ID")
      return
    }

    setLoading(true)
    setError("")
    setGenerationProgress(50)
    addDebugLog("Starting model improvement", {
      modelId,
      instructions,
    })

    try {
      addDebugLog("Sending improve-model request to server")
      const response = await axios.post(`${API_BASE_URL}/improve-model`, {
        modelId,
        instructions,
      })
      addDebugLog("Received improve-model response", response.data)

      if (response.data.url) {
        setModelUrl(response.data.url)
        setModelId(response.data.filename)
        setGenerationProgress(100)
        addDebugLog("Model improvement successful", {
          newModelUrl: response.data.url,
          newModelId: response.data.filename,
        })
      } else {
        throw new Error("No model URL received")
      }
    } catch (err) {
      console.error("Error improving model:", err)
      const errorMessage = err.response?.data?.message || err.message || "An error occurred during model improvement"
      setError(errorMessage)
      addDebugLog("Model improvement error", {
        message: errorMessage,
        response: err.response?.data,
        status: err.response?.status,
      })
    } finally {
      setLoading(false)
      addDebugLog("Model improvement process completed")
    }
  }

  /**
   * Reset the entire process
   */
  const resetProcess = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setDescription("")
    setModelUrl("")
    setModelId("")
    setCurrentStep("upload")
    setGenerationProgress(0)
    setError("")
    setIsImageUploaded(false)
    setTextPrompt("")
    setLdrViews([])
    setModelType("3d")
    setLdrUrl("")
    setLdrFilePath("")
    setShowLdrConversion(false)
    setIsConverting(false)
    setConversionProgress(0)
    setInstructions(null)
    setPartsList([])
    setActiveTab("model")
    setViewsData(null)
    setImageDescription("") // Reset the image description
  }

  /**
   * Toggle between input modes
   * @param {string} mode - The input mode to switch to
   */
  const toggleInputMode = (mode) => {
    setInputMode(mode)
    setError("")
    if (mode === "image") {
      setTextPrompt("")
    } else if (mode === "text") {
      setSelectedFile(null)
      setPreviewUrl(null)
      setIsImageUploaded(false)
    } else if (mode === "ldr") {
      setTextPrompt("")
      setSelectedFile(null)
      setPreviewUrl(null)
      setIsImageUploaded(false)
    }
  }

  /**
   * Create LEGO bricks for progress bar
   * @returns {Array<JSX.Element>} Array of brick elements
   */
  const renderLegoBricks = () => {
    const bricks = []
    const numBricks = 10
    for (let i = 0; i < numBricks; i++) {
      bricks.push(<div key={i} className="lego-brick" style={{ opacity: 0 }}></div>)
    }
    return bricks
  }

  /**
   * Toggle high contrast mode
   */
  const toggleContrast = () => {
    setHighContrast(!highContrast)
  }

  /**
   * Render LDR views
   * @returns {JSX.Element} The rendered LDR views
   */
  const renderLdrViews = () => {
    if (!ldrViews || ldrViews.length === 0)
      return (
        <div className="ldr-views-container">
          <p className="instructions-note">No LDR views are available for this model.</p>
        </div>
      )

    return (
      <div className="ldr-views-container">
        <h3>LDR Model Views</h3>
        <p>These are different views of your LEGO model generated from the LDR file.</p>
        <div className="ldr-views-grid">
          {ldrViews.map((viewPath, index) => (
            <div key={index} className="ldr-view-item">
              <img
                src={`${API_BASE_URL}${viewPath}`}
                alt={`View ${index + 1}`}
                className="ldr-view-image"
                onError={(e) => {
                  e.target.onerror = null
                  e.target.src = "/placeholder.svg?height=300&width=300"
                  e.target.alt = "Failed to load view"
                }}
              />
              <div className="ldr-view-caption">{viewPath.split("/").pop().replace(".jpg", "").toUpperCase()}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  /**
   * Render instructions tabs
   * @returns {JSX.Element} The rendered instructions tabs
   */
  const renderInstructionsTabs = () => {
    if (!instructions)
      return (
        <div className="instructions-container">
          <p className="instructions-note">No instructions are available for this model.</p>
        </div>
      )

    // Debug the instructions object to see its structure
    console.log("Instructions object:", instructions)
    addDebugLog("Rendering instructions tabs with data", instructions)

    return (
      <div className="instructions-container">
        <div className="instructions-tabs">
          <button
            className={`instructions-tab ${activeTab === "builder" ? "active" : ""}`}
            onClick={() => setActiveTab("builder")}
          >
            <FaHardHat /> Builder
          </button>
          <button
            className={`instructions-tab ${activeTab === "engineering" ? "active" : ""}`}
            onClick={() => setActiveTab("engineering")}
          >
            <FaTools /> Engineering
          </button>
          <button
            className={`instructions-tab ${activeTab === "supplier" ? "active" : ""}`}
            onClick={() => setActiveTab("supplier")}
          >
            <FaTruck /> Supplier
          </button>
          <button
            className={`instructions-tab ${activeTab === "original" ? "active" : ""}`}
            onClick={() => setActiveTab("original")}
          >
            <FaFileAlt /> Original Description
          </button>
        </div>

        <div className="instructions-content">
          {activeTab === "builder" && (
            <div className="instructions-text">
              <h3>Building Instructions</h3>
              <p className="instructions-note">
                These instructions are designed to be clear and simple for autistic children.
              </p>
              {instructions.building ? (
                <>
                  <pre>{instructions.building}</pre>
                  <button className="download-button" onClick={() => handleDownloadInstructions("building")}>
                    <FaDownload /> Download Building Instructions
                  </button>
                </>
              ) : (
                <p>No building instructions available for this model.</p>
              )}
            </div>
          )}

          {activeTab === "engineering" && (
            <div className="instructions-text">
              <h3>Engineering Instructions</h3>
              <p className="instructions-note">
                These instructions are designed to be clear and simple for autistic children.
              </p>
              {instructions.engineering ? (
                <>
                  <pre>{instructions.engineering}</pre>
                  <button className="download-button" onClick={() => handleDownloadInstructions("engineering")}>
                    <FaDownload /> Download Engineering Instructions
                  </button>
                </>
              ) : (
                <p>No engineering instructions available for this model.</p>
              )}
            </div>
          )}

          {activeTab === "supplier" && (
            <div className="instructions-text">
              <h3>Supplier Instructions</h3>
              <p className="instructions-note">
                These instructions are designed to help teachers and parents of autistic children.
              </p>
              {instructions.supplier || instructions.style ? (
                <>
                  <pre>{instructions.supplier || instructions.style}</pre>
                  <button
                    className="download-button"
                    onClick={() => handleDownloadInstructions(instructions.supplier ? "supplier" : "style")}
                  >
                    <FaDownload /> Download Supplier Instructions
                  </button>
                </>
              ) : (
                <p>No supplier instructions available for this model.</p>
              )}
            </div>
          )}

          {activeTab === "original" && (
            <div className="instructions-text">
              <h3>Original Description</h3>
              <p className="instructions-note">This is the original description generated from the image.</p>
              {instructions.original ? (
                <>
                  <pre>{instructions.original}</pre>
                  <button className="download-button" onClick={() => handleDownloadInstructions("original")}>
                    <FaDownload /> Download Original Description
                  </button>
                </>
              ) : (
                <p>No original description available for this model.</p>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  /**
   * Render parts list
   * @returns {JSX.Element} The rendered parts list
   */
  const renderPartsList = () => {
    if (!partsList || partsList.length === 0)
      return (
        <div className="parts-list-container">
          <p className="instructions-note">No parts list is available for this model.</p>
        </div>
      )

    return (
      <div className="parts-list-container">
        <h3>LEGO Parts List</h3>
        <p>This is a list of all the parts needed to build this model.</p>
        <button className="download-button" onClick={handleDownloadPartsList}>
          <FaDownload /> Download Parts List (CSV)
        </button>
        <table className="parts-table">
          <thead>
            <tr>
              <th>Part Name</th>
              <th>Total Count</th>
              <th>Color Variations</th>
            </tr>
          </thead>
          <tbody>
            {partsList.map((part, index) => (
              <tr key={index}>
                <td>{part.fileName}</td>
                <td>{part.totalCount}</td>
                <td>
                  <div className="color-variations">
                    {part.colorVariations.map((colorVar, colorIndex) => (
                      <div key={colorIndex} className="color-variation">
                        <div
                          className="color-swatch"
                          style={{
                            backgroundColor: getLdrawColorHex(colorVar.colorCode),
                            border: "1px solid #ccc",
                          }}
                        ></div>
                        <span>{colorVar.count}x</span>
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  /**
   * Get LDraw color hex code
   * @param {string} colorCode - The LDraw color code
   * @returns {string} The hex color code
   */
  const getLdrawColorHex = (colorCode) => {
    const ldrawColors = {
      0: "#05131D", // Black
      1: "#0055BF", // Blue
      2: "#237841", // Green
      3: "#008F9B", // Dark Turquoise
      4: "#C91A09", // Red
      5: "#C870A0", // Dark Pink
      6: "#583927", // Brown
      7: "#9BA19D", // Light Gray
      8: "#6D6E5C", // Dark Gray
      9: "#B4D2E3", // Light Blue
      10: "#4B9F4A", // Bright Green
      11: "#55A5AF", // Turquoise
      12: "#F2705E", // Salmon
      13: "#FC97AC", // Pink
      14: "#F2CD37", // Yellow
      15: "#FFFFFF", // White
      16: "#FFFFFF", // Clear
      // Add more colors as needed
    }

    return ldrawColors[colorCode] || "#CCCCCC" // Default to gray if color not found
  }

  /**
   * Render debug panel
   * @returns {JSX.Element|null} The rendered debug panel or null
   */
  const renderDebugPanel = () => {
    if (!debugMode) return null

    return (
      <div className="debug-panel">
        <div className="debug-header">
          <h2>Debug Panel</h2>
          <div className="debug-actions">
            <button className="debug-clear-button" onClick={clearDebugLogs}>
              Clear Logs
            </button>
            <button className="debug-close-button" onClick={toggleDebugMode}>
              Close
            </button>
          </div>
        </div>
        <div className="debug-content" ref={debugLogRef}>
          {debugLogs.length === 0 ? (
            <div className="debug-empty">No logs yet. Perform actions to see debug information.</div>
          ) : (
            debugLogs.map((log) => (
              <div key={log.id} className="debug-log-entry">
                <div className="debug-log-timestamp">{log.timestamp}</div>
                <div className="debug-log-message">{log.message}</div>
                {log.data && (
                  <pre className="debug-log-data">
                    {typeof log.data === "object" ? JSON.stringify(log.data, null, 2) : log.data}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`App ${highContrast ? "high-contrast" : ""}`}>
      <header className="App-header">
        <h1>LEGOFIKS</h1>
        <p>Upload an image, enter text, or upload an LDR file to build your own 3D LEGO model!</p>
        <div className="accessibility-controls">
          <button
            className="contrast-toggle"
            onClick={toggleContrast}
            aria-label={highContrast ? "Switch to standard contrast" : "Switch to high contrast"}
          >
            {highContrast ? "Standard Contrast" : "High Contrast"}
          </button>
        </div>
        <button
          className="debug-toggle"
          onClick={toggleDebugMode}
          aria-label="Toggle Debug Panel"
          title="Toggle Debug Panel"
        >
          <FaTools />
        </button>
      </header>

      <main className="App-content">
        {currentStep === "upload" && !isImageUploaded && !modelUrl && (
          <div className="input-mode-selector">
            <button
              className={`mode-button ${inputMode === "image" ? "active" : ""}`}
              onClick={() => toggleInputMode("image")}
            >
              <FaImage /> Image Mode
            </button>
            <button
              className={`mode-button ${inputMode === "text" ? "active" : ""}`}
              onClick={() => toggleInputMode("text")}
            >
              <FaKeyboard /> Text Mode
            </button>
            <button
              className={`mode-button ${inputMode === "ldr" ? "active" : ""}`}
              onClick={() => toggleInputMode("ldr")}
            >
              <FaDiceD6 /> LDR File Mode
            </button>
          </div>
        )}

        {currentStep === "upload" && !isImageUploaded && !modelUrl && inputMode === "image" && (
          <div className="upload-container">
            <div className="upload-card" onClick={() => setIsModalOpen(true)}>
              <FaCubes className="upload-icon" />
              <h2>Start Building!</h2>
              <p>Click here to upload an image</p>
              <div className="format-info">
                <FaInfoCircle />
                <span>Acceptable formats: PNG, JPG</span>
              </div>
            </div>
            <div className="instructions-panel">
              <h3>How to Use Image Mode:</h3>
              <ol>
                <li>Click the box above to upload a PNG or JPG image</li>
                <li>After uploading, click the "Build 3D Model" button</li>
                <li>Wait while the computer creates your 3D model</li>
                <li>View and interact with your 3D LEGO model</li>
                <li>Use the "Modify LEGO Model" button to make changes</li>
              </ol>
            </div>
          </div>
        )}

        {currentStep === "upload" && !modelUrl && inputMode === "text" && (
          <div className="text-input-container">
            <div className="text-input-flex">
              <div className="text-input-card">
                <FaKeyboard className="text-input-icon" />
                <h2>Describe Your LEGO Model</h2>
                <p>Enter a description of what you want to build</p>
                <textarea
                  className="text-prompt-input"
                  value={textPrompt}
                  onChange={(e) => setTextPrompt(e.target.value)}
                  placeholder="Example: a tree, a camera, a castle, etc."
                  rows={4}
                />
                <button
                  className="text-generate-button"
                  onClick={handleGenerateModel}
                  disabled={!textPrompt.trim() || isGenerating}
                >
                  <FaCube /> Build 3D Model
                </button>
              </div>
              <div className="instructions-panel">
                <h3>How to Use Text Mode:</h3>
                <ol>
                  <li>Enter a description of what you want to build</li>
                  <li>Click the "Build 3D Model" button</li>
                  <li>Wait while the computer creates your 3D model</li>
                  <li>View and interact with your 3D LEGO model</li>
                  <li>Use the "Modify LEGO Model" button to make changes</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {currentStep === "upload" && !modelUrl && inputMode === "ldr" && (
          <div className="upload-container">
            <div className="upload-card" onClick={() => setIsModalOpen(true)}>
              <FaDiceD6 className="upload-icon" />
              <h2>Upload LDR File</h2>
              <p>Click here to upload an LDR file</p>
              <div className="format-info">
                <FaInfoCircle />
                <span>Acceptable formats: LDR, MPD, DAT</span>
              </div>
            </div>
            <div className="instructions-panel">
              <h3>How to Use LDR File Mode:</h3>
              <ol>
                <li>Click the box above to upload an LDR, MPD, or DAT file</li>
                <li>After uploading, click the "Process LDR File" button</li>
                <li>Wait while the computer processes your LDR file</li>
                <li>View the generated model views</li>
              </ol>
            </div>
          </div>
        )}

        {/* Show original image before model is generated, show 3D preview after */}
        {(previewUrl || modelUrl) && (inputMode === "image" || inputMode === "ldr") && (
          <div className="image-section">
            <h2>
              {modelUrl && inputMode === "image" ? "3D Guess" : inputMode === "image" ? "Your Image" : "Your LDR File"}
            </h2>
            <div className="image-preview">
              {modelUrl && inputMode === "image" ? (
                // Show 3D model preview when available
                <div className="model-preview-container">
                  <ThreeViewer modelUrl={modelUrl} />
                </div>
              ) : inputMode === "image" ? (
                // Show original image when no model yet
                <img src={previewUrl || "/placeholder.svg"} alt="Your uploaded image" />
              ) : (
                // Show LDR file preview
                <div className="ldr-file-preview">
                  <FaDiceD6 style={{ fontSize: "4rem", color: "#D01012" }} />
                  <p>{selectedFile?.name}</p>
                </div>
              )}
            </div>
            <div className="image-info">
              {modelUrl && inputMode === "image" ? (
                <p className="model-preview-info">You can rotate and zoom this 3D preview</p>
              ) : (
                <>
                  <p>File name: {selectedFile?.name}</p>
                  <p>File type: {selectedFile?.type || "LDR file"}</p>
                </>
              )}
            </div>
          </div>
        )}

        {inputMode === "text" && textPrompt && !modelUrl && (
          <div className="text-section">
            <h2>Your Description</h2>
            <div className="text-preview">
              <p>{textPrompt}</p>
            </div>
          </div>
        )}

        {description ? (
          <div className="description-section">
            <h2>LEGO Instructions</h2>
            <div className="description-text">{description}</div>
          </div>
        ) : (
          isImageUploaded &&
          currentStep === "ready" && (
            <div className="description-section">
              <h2>Ready to Build!</h2>
              <div className="description-text">
                <p>Your {inputMode === "image" ? "image" : "LDR file"} has been uploaded successfully.</p>
                <p>
                  Next step: Click the "{inputMode === "ldr" ? "Process LDR File" : "Build 3D Model"}" button below to
                  start {inputMode === "ldr" ? "processing" : "creating"} your LEGO model.
                </p>
                {inputMode === "image" && <p>This will analyze your image and create a 3D model based on it.</p>}
              </div>
            </div>
          )
        )}

        {currentStep === "view" && (
          <div className="results-tabs">
            <button
              className={`tab-button ${activeTab === "model" ? "active" : ""}`}
              onClick={() => setActiveTab("model")}
            >
              <FaCube /> Model
            </button>
            <button
              className={`tab-button ${activeTab === "instructions" ? "active" : ""}`}
              onClick={() => setActiveTab("instructions")}
              disabled={!instructions}
            >
              <FaFileAlt /> Instructions
            </button>
            <button
              className={`tab-button ${activeTab === "parts" ? "active" : ""}`}
              onClick={() => setActiveTab("parts")}
              disabled={!partsList || partsList.length === 0}
            >
              <FaList /> Parts List
            </button>
          </div>
        )}

        {currentStep === "view" && activeTab === "model" && modelType === "3d" && modelUrl && (
          <div className="model-section">
            <h2>Your 3D LEGO Model</h2>
            <div className="model-viewer">
              <ThreeViewer modelUrl={modelUrl} />
            </div>
            {modelType === "3d" && modelUrl && (
              <div className="model-actions">
                {!ldrUrl ? (
                  <button className="ldr-convert-button" onClick={handleConvertToLDR} disabled={isConverting}>
                    <FaDiceD6 /> Convert to LDR Format
                  </button>
                ) : (
                  <div className="ldr-download-section">
                    <h3>LDR File Generated!</h3>
                    <p>Your 3D model has been converted to LDR format.</p>
                    <button className="ldr-download-button" onClick={handleDownloadLDR}>
                      <FaDownload /> Download LDR File
                    </button>
                    <button
                      className="ldr-view-button"
                      onClick={() => {
                        // Process the LDR file to generate views
                        const formData = new FormData()
                        formData.append(
                          "ldrFile",
                          new File([new Uint8Array()], ldrFilePath, { type: "application/octet-stream" }),
                        )
                        handleProcessLDR(formData)
                      }}
                    >
                      <FaEye /> View LDR Model
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="model-controls">
              <p>You can rotate the model by clicking and dragging. Zoom with the scroll wheel.</p>
              <button className="chat-button" onClick={() => setIsChatOpen(!isChatOpen)}>
                <FaTools /> {isChatOpen ? "Hide LEGO Tools" : "Modify LEGO Model"}
              </button>
            </div>
          </div>
        )}

        {currentStep === "view" && activeTab === "model" && modelType === "ldr" && ldrViews.length > 0 && (
          <div className="model-section ldr-model-section">{renderLdrViews()}</div>
        )}

        {currentStep === "view" && activeTab === "instructions" && (
          <div className="instructions-section">{renderInstructionsTabs()}</div>
        )}

        {currentStep === "view" && activeTab === "parts" && <div className="parts-section">{renderPartsList()}</div>}

        {isChatOpen && (
          <div className="chat-container">
            <ChatBox onSendMessage={handleImproveModel} />
          </div>
        )}
      </main>

      {isImageUploaded && !modelUrl && !isGenerating && (
        <div className="actions-container">
          <button className="generate-button" onClick={handleGenerateModel}>
            {inputMode === "ldr" ? (
              <>
                <FaDiceD6 /> Process LDR File
              </>
            ) : (
              <>
                <FaCube /> Build 3D Model
              </>
            )}
          </button>
        </div>
      )}

      {error && (
        <div className="error-container">
          <div className="error-message">
            <FaInfoCircle /> {error}
          </div>
        </div>
      )}

      {modelUrl && (
        <div className="actions-container">
          <button className="reset-button" onClick={resetProcess}>
            Build Something New
          </button>
        </div>
      )}

      {loading && (
        <div className="bottom-progress-container">
          <div className="progress-status">
            <div className="spinning-brick"></div>
            {isConverting && <p>Converting 3D Model to LDR Format... {conversionProgress}%</p>}
            <p>
              {currentStep === "describe"
                ? "Reading LEGO Instructions..."
                : currentStep === "generate"
                  ? generationProgress < 20
                    ? "Analyzing input and preparing model... (This may take a while)"
                    : generationProgress < 40
                      ? "Creating 3D shape structure... (This may take up to two minutes)"
                      : generationProgress < 60
                        ? "Generating LEGO bricks..."
                        : generationProgress < 80
                          ? "Assembling LEGO model..."
                          : "Finalizing your LEGO creation..."
                  : "Processing your request..."}
            </p>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${generationProgress}%` }}></div>
              <div className="lego-bricks" ref={bricksRef} style={{ left: `${generationProgress - 10}%` }}>
                {renderLegoBricks()}
              </div>
              <div className="progress-text">{generationProgress}% Complete</div>
            </div>
          </div>
        </div>
      )}

      {renderDebugPanel()}

      <UploadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onFileChange={handleFileChange}
        onUpload={handleUploadImage}
        selectedFile={selectedFile}
        inputMode={inputMode}
      />
    </div>
  )
}

export default App

