"use client"

import { useState } from "react"
import "./App.css"
import axios from "axios"
import ThreeViewer from "./components/ThreeViewer"
import ChatBox from "./components/ChatBox"
import UploadModal from "./components/UploadModal"
import { FaUpload, FaRobot, FaSpinner } from "react-icons/fa"

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

  const handleFileChange = (file) => {
    if (file) {
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

    setLoading(true)
    setError("")
    setCurrentStep("describe")
    setGenerationProgress(25)

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

      // Step 2: Get the description from Gemini
      const predictionResponse = await axios.get(`${API_BASE_URL}/predict`)

      if (predictionResponse.data.text) {
        setDescription(predictionResponse.data.text)
        setCurrentStep("generate")
        setGenerationProgress(50)

        // Step 3: Generate 3D model from description
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
      setCurrentStep("upload")
      setGenerationProgress(0)
    } finally {
      setLoading(false)
      setIsModalOpen(false)
    }
  }

  const handleImproveModel = async (instructions) => {
    if (!modelId) {
      setError("No model to improve")
      return
    }

    setLoading(true)
    setError("")

    try {
      const response = await axios.post(`${API_BASE_URL}/improve-model`, {
        modelId,
        instructions,
      })

      if (response.data.url) {
        setModelUrl(response.data.url)
        setModelId(response.data.filename)
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
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>3D Model Generator</h1>
        <p>Upload an image and get an AI-generated 3D model</p>
      </header>

      <main className="App-content">
        {currentStep === "upload" && !modelUrl && (
          <div className="upload-container">
            <div className="upload-card" onClick={() => setIsModalOpen(true)}>
              <FaUpload className="upload-icon" />
              <h2>Upload an Image</h2>
              <p>Upload an image to generate a 3D model</p>
            </div>
          </div>
        )}

        {(currentStep !== "upload" || modelUrl) && (
          <div className="process-container">
            {previewUrl && (
              <div className="image-section">
                <h2>Original Image</h2>
                <div className="image-preview">
                  <img src={previewUrl || "/placeholder.svg"} alt="Preview" />
                </div>
              </div>
            )}

            {description && (
              <div className="description-section">
                <h2>AI Description</h2>
                <div className="description-text">{description}</div>
              </div>
            )}

            {modelUrl && (
              <div className="model-section">
                <h2>3D Model</h2>
                <div className="model-viewer">
                  <ThreeViewer modelUrl={modelUrl} />
                </div>
                <button className="chat-button" onClick={() => setIsChatOpen(!isChatOpen)}>
                  <FaRobot /> {isChatOpen ? "Close Chat" : "Open AI Chat"}
                </button>
              </div>
            )}

            {isChatOpen && (
              <div className="chat-container">
                <ChatBox onSendMessage={handleImproveModel} />
              </div>
            )}

            {loading && (
              <div className="loading-overlay">
                <div className="loading-content">
                  <FaSpinner className="spinner" />
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${generationProgress}%` }}></div>
                  </div>
                  <p>
                    {currentStep === "describe"
                      ? "Analyzing image..."
                      : currentStep === "generate"
                        ? "Generating 3D model..."
                        : "Processing..."}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="error-container">
            <div className="error-message">{error}</div>
          </div>
        )}

        {modelUrl && (
          <div className="actions-container">
            <button className="reset-button" onClick={resetProcess}>
              Start New Project
            </button>
          </div>
        )}
      </main>

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

