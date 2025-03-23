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
  FaSpinner,
  FaKeyboard,
  FaFileImport
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
  
  // New state for input modes
  const [inputMode, setInputMode] = useState("image") // image, text, ldr
  const [textPrompt, setTextPrompt] = useState("")
  const [showTextInput, setShowTextInput] = useState(false)

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
   * Handle text prompt change
   * @param {Event} e - Event object
   */
  const handleTextChange = (e) => {
    setTextPrompt(e.target.value);
    setError("");
  }

  /**
   * Handle text prompt submission
   */
  const handleTextSubmit = async () => {
    if (!textPrompt.trim()) {
      setError("Please enter a text prompt");
      return;
    }

    setLoading(true);
    setError("");
    setProgress(20);
    setProgressMessage("Generating 3D model from text...");
    addDebugLog("Starting text-to-model generation", {
      prompt: textPrompt
    });

    try {
      // Submit the text prompt to generate a model
      const generateResponse = await axios.post(
        `${API_BASE_URL}/generate-model-from-text`,
        { prompt: textPrompt }
      );

      addDebugLog("Model generation response", generateResponse.data);

      if (!generateResponse.data) {
        throw new Error("Failed to generate model: Invalid server response");
      }

      setProgress(60);
      setProgressMessage("Converting 3D model to LDR format...");

      // Set the model information
      setModelUrl(generateResponse.data.filePath);
      setModelId(generateResponse.data.filename);

      // Check if LDR conversion was included
      if (generateResponse.data.ldrFilePath) {
        setLdrUrl(generateResponse.data.ldrFilePath);
        setLdrFilePath(generateResponse.data.ldrFilePath);
        addDebugLog("LDR conversion successful", {
          ldrFilePath: generateResponse.data.ldrFilePath
        });

        setProgress(100);
        setProgressMessage("Complete!");

        // Navigate to the LDR viewer page
        navigate('/ldr-viewer', { 
          state: { 
            ldrFilePath: generateResponse.data.ldrFilePath,
            modelUrl: generateResponse.data.filePath,
            description: textPrompt // Using the prompt as the description
          } 
        });
        
        addDebugLog("Navigating to LDR viewer page", {
          ldrFilePath: generateResponse.data.ldrFilePath
        });
      } else if (generateResponse.data.ldrConversionError) {
        addDebugLog("LDR conversion failed", {
          error: generateResponse.data.ldrConversionError,
        });
        
        throw new Error(`LDR conversion failed: ${generateResponse.data.ldrConversionError}`);
      }

    } catch (err) {
      console.error("Error in text-to-model pipeline:", err);
      const errorMessage = err.response?.data?.message || err.message || "An error occurred during processing";
      setError(errorMessage);
      addDebugLog("Error in text-to-model pipeline", {
        message: errorMessage,
        response: err.response?.data,
        status: err.response?.status,
      });
    } finally {
      setLoading(false);
    }
  }

  /**
   * Handle LDR file upload and processing
   */
  const handleLdrFileUpload = async () => {
    if (!selectedFile) {
      setError("Please select an LDR file first");
      return;
    }

    setLoading(true);
    setError("");
    setProgress(20);
    setProgressMessage("Processing LDR file...");
    addDebugLog("Starting LDR file processing", {
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
    });

    try {
      // Create form data for file upload
      const formData = new FormData();
      formData.append("ldrFile", selectedFile);
      
      // Upload the LDR file
      const uploadResponse = await axios.post(
        `${API_BASE_URL}/upload-ldr-for-parts`,
        formData
      );
      
      addDebugLog("LDR file upload response", uploadResponse.data);
      
      if (!uploadResponse.data || !uploadResponse.data.filePath) {
        throw new Error("Failed to upload LDR file: Invalid server response");
      }
      
      setProgress(100);
      setProgressMessage("Complete!");
      
      // Navigate to the LDR viewer page
      navigate('/ldr-viewer', { 
        state: { 
          ldrFilePath: uploadResponse.data.filePath,
          showInstructions: true // Flag to show layer-by-layer instructions
        } 
      });
      
      addDebugLog("Navigating to LDR viewer page with LDR file", {
        ldrFilePath: uploadResponse.data.filePath
      });
      
    } catch (err) {
      console.error("Error in LDR processing pipeline:", err);
      const errorMessage = err.response?.data?.message || err.message || "An error occurred during processing";
      setError(errorMessage);
      addDebugLog("Error in LDR processing pipeline", {
        message: errorMessage,
        response: err.response?.data,
        status: err.response?.status,
      });
    } finally {
      setLoading(false);
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
        <p>Upload an image, enter text, or upload an LDR file to build your own 3D LEGO model!</p>
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
          <>
            <div className="mode-selection">
              <button 
                className={`mode-button ${inputMode === "image" ? "active" : ""}`}
                onClick={() => {
                  setInputMode("image");
                  setShowTextInput(false);
                  setError("");
                }}
              >
                <FaImage /> Image Mode
              </button>
              <button 
                className={`mode-button ${inputMode === "text" ? "active" : ""}`}
                onClick={() => {
                  setInputMode("text");
                  setShowTextInput(true);
                  setError("");
                }}
              >
                <FaKeyboard /> Text Mode
              </button>
              <button 
                className={`mode-button ${inputMode === "ldr" ? "active" : ""}`}
                onClick={() => {
                  setInputMode("ldr");
                  setShowTextInput(false);
                  setError("");
                }}
              >
                <FaFileImport /> LDR File Mode
              </button>
            </div>

            {/* Instructions for selected mode */}
            <div className="mode-instructions">
              <h3>How to Use {inputMode === "image" ? "Image" : inputMode === "text" ? "Text" : "LDR File"} Mode:</h3>
              {inputMode === "image" && (
                <ol>
                  <li>Click the box below to upload a PNG or JPG image</li>
                  <li>After uploading, click the "Build 3D Model" button</li>
                  <li>Wait while the computer creates your 3D model</li>
                  <li>View and interact with your 3D LEGO model</li>
                  <li>Use the "Modify LEGO Model" button to make changes</li>
                </ol>
              )}
              {inputMode === "text" && (
                <ol>
                  <li>Enter a detailed description of what you want to build</li>
                  <li>Click the "Generate 3D Model" button</li>
                  <li>Wait while the AI creates your 3D model directly from text</li>
                  <li>View and interact with your 3D LEGO model</li>
                </ol>
              )}
              {inputMode === "ldr" && (
                <ol>
                  <li>Click the box below to upload an LDR file (.ldr, .mpd, or .dat)</li>
                  <li>After uploading, click the "View LDR Model" button</li>
                  <li>The LDR viewer will display your model with layer-by-layer instructions</li>
                </ol>
              )}
            </div>

            {/* Display text input for text mode */}
            {inputMode === "text" && showTextInput && (
              <div className="text-input-container">
                <textarea 
                  className="text-prompt-input"
                  placeholder="Describe what you want to build with LEGO bricks... (e.g., A small red house with a blue roof and windows)"
                  value={textPrompt}
                  onChange={handleTextChange}
                  rows={5}
                />
                <button 
                  className="generate-button"
                  onClick={handleTextSubmit}
                  disabled={!textPrompt.trim()}
                >
                  <FaCube /> Generate 3D Model
                </button>
              </div>
            )}

            {/* Upload card for image or LDR file modes */}
            {(inputMode === "image" || inputMode === "ldr") && (
              <div className="upload-container">
                <div className="upload-card" onClick={() => setIsModalOpen(true)}>
                  {inputMode === "image" ? (
                    <>
                      <FaImage className="upload-icon" />
                      <h2>Start Building!</h2>
                      <p>Click here to upload an image</p>
                      <div className="format-info">
                        <FaInfoCircle />
                        <span>Acceptable formats: PNG, JPG</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <FaFileImport className="upload-icon" />
                      <h2>Upload LDR File</h2>
                      <p>Click here to upload a LEGO Digital Designer file</p>
                      <div className="format-info">
                        <FaInfoCircle />
                        <span>Acceptable formats: LDR, MPD, DAT</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {previewUrl && currentStep === "upload" && !loading && (
          <div className="image-section">
            <h2>Your {inputMode === "ldr" ? "LDR File" : "Image"}</h2>
            <div className="image-preview">
              {inputMode !== "ldr" ? (
                <img src={previewUrl} alt="Your uploaded image" />
              ) : (
                <div className="ldr-file-preview">
                  <FaFileImport style={{ fontSize: "4rem", color: "#D01012" }} />
                  <p className="file-name">{selectedFile?.name}</p>
                </div>
              )}
            </div>
            <div className="image-info">
              <p>File name: {selectedFile?.name}</p>
              <p>File type: {selectedFile?.type || "LDR file"}</p>
            </div>
            <button 
              className="process-button" 
              onClick={inputMode === "ldr" ? handleLdrFileUpload : handleUploadImage}
            >
              <FaCube /> {inputMode === "ldr" ? "View LDR Model" : "Build LEGO Model"}
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
        onUpload={inputMode === "ldr" ? handleLdrFileUpload : handleUploadImage}
        selectedFile={selectedFile}
        inputMode={inputMode}
      />
    </div>
  )
}

export default App

