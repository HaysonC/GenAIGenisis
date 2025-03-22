import React, { useState } from 'react';
import './App.css';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001';

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [prompt, setPrompt] = useState('Describe what you see in this image in detail');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError(''); // Clear any previous errors
    }
  };

  const handleAnalyzeImage = async () => {
    if (!selectedFile) {
      setError('Please select an image first');
      return;
    }

    setLoading(true);
    setError('');
    setResult('');

    try {
      // Create form data for image upload
      const formData = new FormData();
      formData.append('image', selectedFile);

      // Step 1: Upload the image
      const uploadResponse = await axios.post(`${API_BASE_URL}/upload-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (!uploadResponse.data.imagePath) {
        throw new Error('Failed to upload image');
      }

      // Step 2: Set the prompt
      await axios.post(`${API_BASE_URL}/set-prompt`, { text: prompt });

      // Step 3: Get the prediction
      const predictionResponse = await axios.get(`${API_BASE_URL}/predict`);

      if (predictionResponse.data.text) {
        setResult(predictionResponse.data.text);
      } else {
        throw new Error('No prediction result received');
      }
    } catch (err) {
      console.error("Error processing image:", err);
      const errorMessage = err.response?.data?.message || err.message || 'An error occurred during image analysis';
      setError(errorMessage);
      setResult(''); // Clear any partial results
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Image Analysis with Gemini API</h1>
        <p>Upload an image and get AI-powered description</p>
      </header>

      <main className="App-content">
        <div className="upload-section">
          <label htmlFor="image-upload" className="upload-label">
            {previewUrl ? 'Change Image' : 'Upload Image'}
          </label>
          <input
            id="image-upload"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="file-input"
          />

          {previewUrl && (
            <div className="image-preview">
              <img src={previewUrl} alt="Preview" />
            </div>
          )}
        </div>

        <div className="prompt-section">
          <label htmlFor="prompt-input">Custom Prompt:</label>
          <textarea
            id="prompt-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows="3"
            placeholder="Enter instructions for the AI..."
          />
        </div>

        <button
          className="analyze-button"
          onClick={handleAnalyzeImage}
          disabled={!selectedFile || loading}
        >
          {loading ? 'Analyzing...' : 'Analyze Image'}
        </button>

        {error && (
          <div className="error-container">
            <div className="error-message">{error}</div>
          </div>
        )}

        {result && (
          <div className="result-section">
            <h2>Analysis Result</h2>
            <div className="result-text">{result}</div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;