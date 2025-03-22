"use client"

import { useRef } from "react"
import { FaTimes, FaCubes, FaInfoCircle, FaDiceD6 } from "react-icons/fa"

const UploadModal = ({ isOpen, onClose, onFileChange, onUpload, selectedFile, inputMode = "image" }) => {
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

  const isLdrMode = inputMode === "ldr"

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <FaTimes />
        </button>

        <h2>{isLdrMode ? "Upload Your LDR File" : "Upload Your Image"}</h2>
        <p>
          {isLdrMode
            ? "Choose an LDR file to process and generate views"
            : "Choose an image to transform into a LEGO 3D model"}
        </p>

        <div className="format-info modal-format-info">
          <FaInfoCircle />
          <span>{isLdrMode ? "Acceptable formats: LDR, MPD, DAT" : "Acceptable formats: PNG, JPG"}</span>
        </div>

        <div className={`upload-area ${selectedFile ? "has-file" : ""}`} onClick={handleFileClick}>
          <input
            ref={fileInputRef}
            type="file"
            accept={isLdrMode ? ".ldr,.mpd,.dat" : "image/png, image/jpeg"}
            onChange={handleFileChange}
            className="file-input"
            aria-label={isLdrMode ? "Upload LDR file (LDR, MPD, or DAT)" : "Upload image file (PNG or JPG)"}
          />

          {selectedFile ? (
            <div className="file-preview">
              {isLdrMode ? (
                <div className="ldr-file-preview">
                  <FaDiceD6 style={{ fontSize: "4rem", color: "#D01012" }} />
                  <p className="file-name">{selectedFile.name}</p>
                </div>
              ) : (
                <>
                  <img
                    src={URL.createObjectURL(selectedFile) || "/placeholder.svg"}
                    alt="Preview of selected image"
                    className="preview-image"
                  />
                  <p className="file-name">{selectedFile.name}</p>
                </>
              )}
              <p className="file-type">Type: {selectedFile.type || "LDR file"}</p>
            </div>
          ) : (
            <div className="upload-placeholder">
              {isLdrMode ? (
                <FaDiceD6 style={{ fontSize: "3rem", color: "#D01012" }} />
              ) : (
                <FaCubes style={{ fontSize: "3rem", color: "#D01012" }} />
              )}
              <p>{isLdrMode ? "Click to select an LDR, MPD, or DAT file" : "Click to select a PNG or JPG image"}</p>
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
            aria-label={
              selectedFile
                ? isLdrMode
                  ? "Upload LDR file"
                  : "Upload image"
                : `Upload button (disabled until a${isLdrMode ? "n LDR file" : "n image"} is selected)`
            }
          >
            {isLdrMode ? "Upload LDR File" : "Upload Image"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default UploadModal

