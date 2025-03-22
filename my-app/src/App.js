"use client"

import { useState, useRef, useEffect } from "react"
import "./App.css"
import axios from "axios"
import ThreeViewer from "./components/ThreeViewer"
import ChatBox from "./components/ChatBox"
import UploadModal from "./components/UploadModal"
import { FaCube, FaTools, FaCubes, FaInfoCircle } from "react-icons/fa"

const API_BASE_URL = "http://localhost:5001"

function App() {
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
  const bricksRef = useRef(null)

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

  const handleFileChange = (file) => {
    if (file) {
      // Check if file is PNG or JPG
      const fileType = file.type
      if (fileType !== "image/png" && fileType !== "image/jpeg") {
        setError("Please select a PNG or JPG image file")
        return
      }

      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      setError("")
    }
  }

  const handleUploadImage = async () => {
    if (!selectedFile) {
      setError("Please select an image first")
      return
    }

    try {
      // Create form data for image upload
      const formData = new FormData()
      formData.append("image", selectedFile)

      // Step 1: Upload the image
      const uploadResponse = await axios.post(`${API_BASE_URL}/upload-image`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })

      if (!uploadResponse.data.imagePath) {
        throw new Error("Failed to upload image")
      }

      // Close modal and show the image preview
      setIsModalOpen(false)
      setIsImageUploaded(true)
      setCurrentStep("ready")
    } catch (err) {
      console.error("Error uploading image:", err)
      const errorMessage = err.response?.data?.message || err.message || "An error occurred during upload"
      setError(errorMessage)
    }
  }

  const handleGenerateModel = async () => {
    if (!selectedFile || !isImageUploaded) {
      setError("Please upload an image first")
      return
    }

    setLoading(true)
    setError("")
    setCurrentStep("describe")
    setGenerationProgress(25)
    setIsGenerating(true)

    try {
      // Step 1: Get the description from Gemini
      const predictionResponse = await axios.get(`${API_BASE_URL}/predict`)

      if (predictionResponse.data.text) {
        setDescription(predictionResponse.data.text)
        setCurrentStep("generate")
        setGenerationProgress(50)

        // Step 2: Generate 3D model from description
        const modelResponse = await axios.post(`${API_BASE_URL}/generate-model`, {
          prompt: predictionResponse.data.text,
          options: {
            guidance_scale: 15.0,
            num_steps: 64,
          },
        })

        if (modelResponse.data.url) {
          setModelUrl(modelResponse.data.url)
          setModelId(modelResponse.data.filename)
          setCurrentStep("view")
          setGenerationProgress(100)
        } else {
          throw new Error("No model URL received")
        }
      } else {
        throw new Error("No description result received")
      }
    } catch (err) {
      console.error("Error processing image:", err)
      const errorMessage = err.response?.data?.message || err.message || "An error occurred during processing"
      setError(errorMessage)
      setCurrentStep("ready")
      setGenerationProgress(0)
    } finally {
      setLoading(false)
      setIsGenerating(false)
    }
  }

  const handleImproveModel = async (instructions) => {
    if (!modelId) {
      setError("No model to improve")
      return
    }

    setLoading(true)
    setError("")
    setGenerationProgress(50)

    try {
      const response = await axios.post(`${API_BASE_URL}/improve-model`, {
        modelId,
        instructions,
      })

      if (response.data.url) {
        setModelUrl(response.data.url)
        setModelId(response.data.filename)
        setGenerationProgress(100)
      } else {
        throw new Error("No model URL received")
      }
    } catch (err) {
      console.error("Error improving model:", err)
      const errorMessage = err.response?.data?.message || err.message || "An error occurred during model improvement"
      setError(errorMessage)
    } finally {
      setLoading(false)
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

  return (
    <div className={`App ${highContrast ? 'high-contrast' : ''}`}>
      <header className="App-header">
        <h1>LEGO 3D Model Creator</h1>
        <p>Upload an image and build your own 3D LEGO model!</p>
        <div className="accessibility-controls">
          <button
            className="contrast-toggle"
            onClick={toggleContrast}
            aria-label={highContrast ? "Switch to standard contrast" : "Switch to high contrast"}
          >
            {highContrast ? "Standard Contrast" : "High Contrast"}
          </button>
        </div>
      </header>

      <main className="App-content">
        {currentStep === "upload" && !isImageUploaded && (
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
              <h3>How to Use This App:</h3>
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

        {(isImageUploaded || currentStep !== "upload") && (
          <div className="process-container">
            {previewUrl && (
              <div className="image-section">
                <h2>Your Image</h2>
                <div className="image-preview">
                  <img src={previewUrl || "/placeholder.svg"} alt="Your uploaded image" />
                </div>
                <div className="image-info">
                  <p>File name: {selectedFile?.name}</p>
                  <p>File type: {selectedFile?.type}</p>
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
                    <p>Your image has been uploaded successfully.</p>
                    <p>Next step: Click the "Build 3D Model" button below to start creating your LEGO model.</p>
                    <p>This will analyze your image and create a 3D model based on it.</p>
                  </div>
                </div>
              )
            )}

            {modelUrl && (
              <div className="model-section">
                <h2>Your 3D LEGO Model</h2>
                <div className="model-viewer">
                  <ThreeViewer modelUrl={modelUrl} />
                </div>
                <div className="model-controls">
                  <p>You can rotate the model by clicking and dragging. Zoom with the scroll wheel.</p>
                  <button className="chat-button" onClick={() => setIsChatOpen(!isChatOpen)}>
                    <FaTools /> {isChatOpen ? "Hide LEGO Tools" : "Modify LEGO Model"}
                  </button>
                </div>
              </div>
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
              <FaCube /> Build 3D Model
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

      <UploadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onFileChange={handleFileChange}
        onUpload={handleUploadImage}
        selectedFile={selectedFile}
      />
    </div>
  )
}

export default App
