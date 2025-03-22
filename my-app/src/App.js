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
} from "react-icons/fa"

const API_BASE_URL = "http://localhost:5001"

function App() {
  // Add these new state variables at the top of the App component
  const [debugMode, setDebugMode] = useState(false)
  const [debugLogs, setDebugLogs] = useState([])
  const debugLogRef = useRef(null)

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

  // Add this function to add debug logs
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

  // Add this function to clear debug logs
  const clearDebugLogs = () => {
    setDebugLogs([])
  }

  // Add this function to toggle debug mode
  const toggleDebugMode = () => {
    setDebugMode(!debugMode)
  }

  // Animation for LEGO bricks in progress bar
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

  // Update the handleFileChange function to add debug logs
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

  // Update the handleUploadImage function to add debug logs
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

  // Update the handleConvertToLDR function to add debug logs
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
          ldrFilePath: response.data.ldrFilePath,
        })
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

  // Update the handleGenerateFromImageToLDR function to add debug logs
  const handleGenerateFromImageToLDR = async () => {
    try {
      setCurrentStep("generate")
      setGenerationProgress(30)
      setConversionProgress(0)
      addDebugLog("Starting image to 3D model to LDR pipeline")

      // Generate LDR directly from image
      addDebugLog("Sending generate-ldr-from-image request to server")
      const response = await axios.post(`${API_BASE_URL}/generate-ldr-from-image`, {
        options: {
          guidance_scale: 15.0,
          num_steps: 24,
        },
      })
      addDebugLog("Received generate-ldr-from-image response", response.data)

      // Set the description and model information
      setDescription(response.data.description)
      setModelUrl(response.data.model.url)
      setModelId(response.data.model.filename)
      setModelType("3d")
      setCurrentStep("view")
      setGenerationProgress(100)
      addDebugLog("3D model generation successful", {
        description: response.data.description,
        modelUrl: response.data.model.url,
        modelId: response.data.model.filename,
      })

      // Check if LDR conversion was successful (it won't be since not implemented)
      if (response.data.ldr) {
        setLdrUrl(response.data.ldr.url)
        setLdrFilePath(response.data.ldr.ldrFilePath)
        addDebugLog("LDR conversion successful", {
          ldrUrl: response.data.ldr.url,
          ldrFilePath: response.data.ldr.ldrFilePath,
        })
      } else if (response.data.ldrConversionError) {
        addDebugLog("LDR conversion not available", {
          error: response.data.ldrConversionError,
        })
        // Don't set an error, just log it, since the 3D model was generated successfully
      }
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

  // Update the handleGenerateFromTextToLDR function to add debug logs
  const handleGenerateFromTextToLDR = async () => {
    try {
      setDescription(`Creating a LEGO model based on: "${textPrompt}"`)
      setCurrentStep("generate")
      setGenerationProgress(30)
      setConversionProgress(0)
      addDebugLog("Starting text to 3D model to LDR pipeline", { textPrompt })

      // Generate LDR directly from text
      addDebugLog("Sending generate-ldr-from-text request to server")
      const response = await axios.post(`${API_BASE_URL}/generate-ldr-from-text`, {
        prompt: textPrompt,
        options: {
          guidance_scale: 15.0,
          num_steps: 64,
        },
      })
      addDebugLog("Received generate-ldr-from-text response", response.data)

      // Set the model information
      setModelUrl(response.data.model.url)
      setModelId(response.data.model.filename)
      setModelType("3d")
      setCurrentStep("view")
      setGenerationProgress(100)
      addDebugLog("3D model generation successful", {
        modelUrl: response.data.model.url,
        modelId: response.data.model.filename,
      })

      // Check if LDR conversion was successful (it won't be since not implemented)
      if (response.data.ldr) {
        setLdrUrl(response.data.ldr.url)
        setLdrFilePath(response.data.ldr.ldrFilePath)
        addDebugLog("LDR conversion successful", {
          ldrUrl: response.data.ldr.url,
          ldrFilePath: response.data.ldr.ldrFilePath,
        })
      } else if (response.data.ldrConversionError) {
        addDebugLog("LDR conversion not available", {
          error: response.data.ldrConversionError,
        })
        // Don't set an error, just log it, since the 3D model was generated successfully
      }
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

  // Update the handleProcessLDR function to add debug logs
  const handleProcessLDR = async () => {
    console.log("Processing LDR file:", selectedFile)
    addDebugLog("Starting LDR file processing", {
      fileName: selectedFile?.name,
      fileSize: selectedFile?.size,
    })

    try {
      // Simulate processing delay
      setLoading(true)
      setGenerationProgress(50)

      // Call API to process LDR file
      const formData = new FormData()
      formData.append("ldrFile", selectedFile)
      addDebugLog("Sending process-ldr request to server")

      const response = await axios.post(`${API_BASE_URL}/process-ldr`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      addDebugLog("Received process-ldr response", response.data)

      if (response.data.viewPaths) {
        // Update state with the generated views
        setLdrViews(response.data.viewPaths)
        setModelType("ldr")
        setCurrentStep("view")
        setGenerationProgress(100)
        addDebugLog("LDR processing successful", {
          viewCount: response.data.viewPaths.length,
          modelId: response.data.modelId,
        })
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

  // Update the handleGenerateModel function to add debug logs
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
    setGenerationProgress(25)
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

  // Add this function to download the LDR file
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

  // Update the handleImproveModel function to add debug logs
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
  }

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

  // Create LEGO bricks for progress bar
  const renderLegoBricks = () => {
    const bricks = []
    const numBricks = 10
    for (let i = 0; i < numBricks; i++) {
      bricks.push(<div key={i} className="lego-brick" style={{ opacity: 0 }}></div>)
    }
    return bricks
  }

  const toggleContrast = () => {
    setHighContrast(!highContrast)
  }

  // Render LDR views
  const renderLdrViews = () => {
    if (!ldrViews || ldrViews.length === 0) return null

    return (
      <div className="ldr-views-container">
        <h3>LDR Model Views</h3>
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

  // Add this debug panel component to render at the bottom of the App component, just before the UploadModal
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
        <h1>LEGO 3D Model Creator</h1>
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

        {(isImageUploaded || currentStep !== "upload" || modelUrl) && (
          <div className="process-container">
            {previewUrl && (inputMode === "image" || inputMode === "ldr") && (
              <div className="image-section">
                <h2>{inputMode === "image" ? "Your Image" : "Your LDR File"}</h2>
                <div className="image-preview">
                  {inputMode === "image" ? (
                    <img src={previewUrl || "/placeholder.svg"} alt="Your uploaded image" />
                  ) : (
                    <div className="ldr-file-preview">
                      <FaDiceD6 style={{ fontSize: "4rem", color: "#D01012" }} />
                      <p>{selectedFile?.name}</p>
                    </div>
                  )}
                </div>
                <div className="image-info">
                  <p>File name: {selectedFile?.name}</p>
                  <p>File type: {selectedFile?.type || "LDR file"}</p>
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
                      Next step: Click the "{inputMode === "ldr" ? "Process LDR File" : "Build 3D Model"}" button below
                      to start {inputMode === "ldr" ? "processing" : "creating"} your LEGO model.
                    </p>
                    {inputMode === "image" && <p>This will analyze your image and create a 3D model based on it.</p>}
                  </div>
                </div>
              )
            )}

            {modelType === "3d" && modelUrl && (
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

            {modelType === "ldr" && ldrViews.length > 0 && (
              <div className="model-section ldr-model-section">{renderLdrViews()}</div>
            )}

            {isChatOpen && (
              <div className="chat-container">
                <ChatBox onSendMessage={handleImproveModel} />
              </div>
            )}
          </div>
        )}

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
      </main>

      {loading && (
        <div className="bottom-progress-container">
          <div className="progress-status">
            <div className="spinning-brick"></div>
            {isConverting && <p>Converting 3D Model to LDR Format... {conversionProgress}%</p>}
            <p>
              {currentStep === "describe"
                ? "Reading LEGO Instructions..."
                : currentStep === "generate"
                  ? "Building LEGO Bricks..."
                  : "Assembling Your Model..."}
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

