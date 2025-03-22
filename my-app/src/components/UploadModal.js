"use client"

import { useRef } from "react"
import { FaUpload, FaTimes } from "react-icons/fa"

const UploadModal = ({ isOpen, onClose, onFileChange, onUpload, selectedFile }) => {
  const fileInputRef = useRef(null)

  if (!isOpen) return null

  const handleFileClick = () => {
    fileInputRef.current.click()
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onFileChange(e.target.files[0])
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="modal-close" onClick={onClose}>
          <FaTimes />
        </button>

        <h2>Upload an Image</h2>
        <p>Upload an image to generate a 3D model</p>

        <div className={`upload-area ${selectedFile ? "has-file" : ""}`} onClick={handleFileClick}>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="file-input" />

          {selectedFile ? (
            <div className="file-preview">
              <img
                src={URL.createObjectURL(selectedFile) || "/placeholder.svg"}
                alt="Preview"
                className="preview-image"
              />
              <p>{selectedFile.name}</p>
            </div>
          ) : (
            <div className="upload-placeholder">
              <FaUpload className="upload-icon" />
              <p>Click to select or drag an image here</p>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="cancel-button" onClick={onClose}>
            Cancel
          </button>
          <button className="upload-button" onClick={onUpload} disabled={!selectedFile}>
            Generate 3D Model
          </button>
        </div>
      </div>
    </div>
  )
}

export default UploadModal

