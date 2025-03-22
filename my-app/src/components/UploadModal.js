"use client"

import { useRef } from "react"
import { FaTimes, FaCubes, FaInfoCircle } from "react-icons/fa"

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
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <FaTimes />
        </button>

        <h2>Upload Your Image</h2>
        <p>Choose an image to transform into a LEGO 3D model</p>

        <div className="format-info modal-format-info">
          <FaInfoCircle />
          <span>Acceptable formats: PNG, JPG</span>
        </div>

        <div className={`upload-area ${selectedFile ? "has-file" : ""}`} onClick={handleFileClick}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg"
            onChange={handleFileChange}
            className="file-input"
            aria-label="Upload image file (PNG or JPG)"
          />

          {selectedFile ? (
            <div className="file-preview">
              <img
                src={URL.createObjectURL(selectedFile) || "/placeholder.svg"}
                alt="Preview of selected image"
                className="preview-image"
              />
              <p className="file-name">{selectedFile.name}</p>
              <p className="file-type">Type: {selectedFile.type}</p>
            </div>
          ) : (
            <div className="upload-placeholder">
              <FaCubes style={{ fontSize: "3rem", color: "#D01012" }} />
              <p>Click to select a PNG or JPG image</p>
              <p className="upload-instruction">You can click anywhere in this box to open the file selector</p>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="cancel-button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="upload-button"
            onClick={onUpload}
            disabled={!selectedFile}
            aria-label={selectedFile ? "Upload image" : "Upload button (disabled until an image is selected)"}
          >
            Upload Image
          </button>
        </div>
      </div>
    </div>
  )
}

export default UploadModal
