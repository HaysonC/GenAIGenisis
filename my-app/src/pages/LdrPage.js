import React, { useState } from 'react';
import LdrViewer from '../components/LdrViewer';
import './LdrPage.css';

const LdrPage = () => {
  const [ldrFile, setLdrFile] = useState(null);
  const [ldrFileUrl, setLdrFileUrl] = useState('');
  
  // Function to load a sample LDR file
  const loadSampleLdr = async (filename) => {
    try {
      const response = await fetch(`/samples/${filename}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch sample file: ${response.statusText}`);
      }
      
      const text = await response.text();
      const blob = new Blob([text], { type: 'text/plain' });
      const file = new File([blob], filename, { type: 'text/plain' });
      
      setLdrFile(file);
    } catch (error) {
      console.error('Error loading sample LDR file:', error);
      alert(`Error loading sample: ${error.message}`);
    }
  };
  
  return (
    <div className="ldr-page">
      <div className="ldr-page-header">
        <h1>LDR Viewer</h1>
        <p>Upload an LDR file to view it in 3D with layer controls</p>
      </div>
      
      <div className="sample-files">
        <h3>Sample Files</h3>
        <div className="sample-buttons">
          <button 
            onClick={() => loadSampleLdr('lego_model.ldr')}
            className="sample-button"
          >
            Load Sample Model
          </button>
          
          <button 
            onClick={() => loadSampleLdr('lego_model2.ldr')}
            className="sample-button"
          >
            Load Sample Model 2
          </button>
          
          <div className="load-from-url">
            <input 
              type="text" 
              placeholder="Enter LDR file URL" 
              value={ldrFileUrl}
              onChange={(e) => setLdrFileUrl(e.target.value)}
              className="url-input"
            />
            <button 
              onClick={async () => {
                if (!ldrFileUrl) return;
                
                try {
                  const response = await fetch(ldrFileUrl);
                  if (!response.ok) {
                    throw new Error(`Failed to fetch: ${response.statusText}`);
                  }
                  
                  const text = await response.text();
                  const blob = new Blob([text], { type: 'text/plain' });
                  const filename = ldrFileUrl.split('/').pop() || 'model.ldr';
                  const file = new File([blob], filename, { type: 'text/plain' });
                  
                  setLdrFile(file);
                } catch (error) {
                  console.error('Error fetching LDR from URL:', error);
                  alert(`Error loading from URL: ${error.message}`);
                }
              }}
              className="url-button"
              disabled={!ldrFileUrl}
            >
              Load from URL
            </button>
          </div>
        </div>
      </div>
      
      <div className="ldr-viewer-container">
        <LdrViewer ldrFile={ldrFile} />
      </div>
      
      <div className="ldr-page-footer">
        <h3>About LDR Files</h3>
        <p>
          LDR (LDraw) is an open standard for LEGO CAD programs that allow users to create virtual LEGO models.
          The format stores models as a series of parts with positions, orientations, and colors.
        </p>
        <p>
          This viewer allows you to explore LDR files by showing layers of the model incrementally,
          helping you understand how the model is constructed.
        </p>
      </div>
    </div>
  );
};

export default LdrPage; 