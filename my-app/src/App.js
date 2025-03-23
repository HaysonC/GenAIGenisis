"use client"

import { useState, useRef, useEffect } from "react"
import "./App.css"
import axios from "axios"
import UploadModal from "./components/UploadModal"
import LdrPage from "./pages/LdrPage"
import { useNavigate } from "react-router-dom"
import {
  FaCube,
  FaTools,
  FaCubes,
  FaInfoCircle,
  FaImage,
  FaUpload,
  FaSpinner
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
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [currentStep, setCurrentStep] = useState("upload") // upload, processing, complete
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState("")
  const [imageDescription, setImageDescription] = useState("") 
  const [modelUrl, setModelUrl] = useState("")
  const [modelId, setModelId] = useState("")
  const [ldrUrl, setLdrUrl] = useState("")
  const [ldrFilePath, setLdrFilePath] = useState("")

  // Refs
  const bricksRef = useRef(null)

  // Navigation
  const navigate = useNavigate()

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
  }, [loading, progress])

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

      // Check if file is PNG or JPG
      const fileType = file.type
      if (fileType !== "image/png" && fileType !== "image/jpeg") {
        setError("Please select a PNG or JPG image file")
        addDebugLog("Invalid file type", { fileType })
        return
      }

      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      setError("")
    }
  }

  /**
   * Handle file upload and start processing pipeline
   */
  const handleUploadImage = async () => {
    if (!selectedFile) {
      setError("Please select a file first")
      addDebugLog("Upload attempted without file selection")
      return
    }

    setLoading(true)
    setError("")
    setProgress(5)
    setProgressMessage("Uploading image...")
    addDebugLog("Starting image upload", {
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
    })

    try {
      // Create form data for file upload
      const formData = new FormData()
      formData.append("image", selectedFile)
      addDebugLog("Sending image upload request to server")

      // Step 1: Generate image description
      setProgress(20)
      setProgressMessage("Generating description from image...")
      const descriptionResponse = await axios.post(`${API_BASE_URL}/process-image`, formData)
      
      setProgress(30)
      setProgressMessage("Description generated successfully")
      addDebugLog("Image description generated", {
        description: descriptionResponse.data.description
      })
      
      // Step 2: Generate a 3D model from the description
      setProgress(40)
      setProgressMessage("Generating 3D model from description...")
      
      // Step 3: Convert the model to LDR format and get the result
      setProgress(60)
      setProgressMessage("Converting 3D model to LDR format...")
      
      const generateResponse = await axios.post(
        `${API_BASE_URL}/generate-ldr-from-image`,
        { imageUrl: descriptionResponse.data.imageUrl },
        { 
          onUploadProgress: progressEvent => {
            // Only update if we get progress events
            if (progressEvent.loaded && progressEvent.total) {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
              // Map the upload percentage to our 40-70% range
              const mappedProgress = 40 + (percentCompleted * 0.3)
              setProgress(mappedProgress)
            }
          }
        }
      )

      addDebugLog("Received model generation response", generateResponse.data)

      // Set the model information
      setModelUrl(generateResponse.data.model.url)
      setModelId(generateResponse.data.model.filename)

      // Step 4: Check if LDR conversion was successful
      if (generateResponse.data.ldr) {
        setLdrUrl(generateResponse.data.ldr.url)
        setLdrFilePath(generateResponse.data.ldr.ldrFilePath)
        addDebugLog("LDR conversion successful", {
          ldrUrl: generateResponse.data.ldr.url,
          ldrFilePath: generateResponse.data.ldr.ldrFilePath,
        })

        setProgress(90)
        setProgressMessage("Preparing to display LDR model...")

        // Step 5: Navigate to the LDR viewer page
        navigate('/ldr-viewer', { 
          state: { 
            ldrFilePath: generateResponse.data.ldr.ldrFilePath,
            ldrUrl: generateResponse.data.ldr.url,
            modelUrl: generateResponse.data.model.url,
            description: descriptionResponse.data.description
          } 
        })
        
        addDebugLog("Navigating to LDR viewer page", {
          ldrFilePath: generateResponse.data.ldr.ldrFilePath,
          ldrUrl: generateResponse.data.ldr.url
        })
      } else if (generateResponse.data.ldrConversionError) {
        addDebugLog("LDR conversion failed", {
          error: generateResponse.data.ldrConversionError,
        })
        
        throw new Error(`LDR conversion failed: ${generateResponse.data.ldrConversionError}`)
      }

      setProgress(100)
      setProgressMessage("Complete!")
      setCurrentStep("complete")
      
      // Close modal after processing
      setIsModalOpen(false)
    } catch (err) {
      console.error("Error in processing pipeline:", err)
      const errorMessage = err.response?.data?.message || err.message || "An error occurred during processing"
      setError(errorMessage)
      addDebugLog("Error in processing pipeline", {
        message: errorMessage,
        response: err.response?.data,
        status: err.response?.status,
      })
    } finally {
      setLoading(false)
    }
  }

  /**
   * Reset the process
   */
  const resetProcess = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setImageDescription("")
    setModelUrl("")
    setModelId("")
    setLdrUrl("")
    setLdrFilePath("")
    setCurrentStep("upload")
    setProgress(0)
    setProgressMessage("")
    setError("")
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
    <div className="App">
      <header className="App-header">
        <h1>LEGOFIKS</h1>
        <p>Upload an image to create your own 3D LEGO model!</p>
        <button
          className={`debug-toggle ${debugMode ? "active" : ""}`}
          onClick={toggleDebugMode}
          title="Toggle debug mode"
        >
          <FaTools />
        </button>
      </header>

      <main className="App-content">
        {currentStep === "upload" && !loading && (
          <div className="upload-container">
            <div className="upload-card" onClick={() => setIsModalOpen(true)}>
              <FaImage className="upload-icon" />
              <h2>Start Building!</h2>
              <p>Click here to upload an image</p>
              <div className="format-info">
                <FaInfoCircle />
                <span>Acceptable formats: PNG, JPG</span>
              </div>
            </div>
            <div className="instructions-panel">
              <h3>How It Works:</h3>
              <ol>
                <li>Upload an image of an object</li>
                <li>The AI will analyze your image</li>
                <li>A 3D model will be created based on your image</li>
                <li>The model will be converted to LEGO bricks</li>
                <li>View and interact with your LEGO creation</li>
              </ol>
            </div>
          </div>
        )}

        {previewUrl && currentStep === "upload" && !loading && (
          <div className="image-section">
            <h2>Your Image</h2>
            <div className="image-preview">
              <img src={previewUrl} alt="Your uploaded image" />
            </div>
            <div className="image-info">
              <p>File name: {selectedFile?.name}</p>
              <p>File type: {selectedFile?.type}</p>
            </div>
            <button className="process-button" onClick={handleUploadImage}>
              <FaCube /> Build LEGO Model
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
      </main>

      {loading && (
        <div className="bottom-progress-container">
          <div className="progress-status">
            <div className="spinning-brick"></div>
            <p>{progressMessage || "Processing your request..."}</p>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }}></div>
              <div className="lego-bricks" ref={bricksRef} style={{ left: `${progress - 10}%` }}>
                {renderLegoBricks()}
              </div>
              <div className="progress-text">{progress}% Complete</div>
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
        inputMode="image"
      />
    </div>
  )
}

export default App

