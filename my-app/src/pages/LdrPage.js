import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import LdrViewer from '../components/LdrViewer';
import './LdrPage.css';
import axios from 'axios';

const API_BASE_URL = "http://localhost:5001";

const LdrPage = () => {
  const [ldrFile, setLdrFile] = useState(null);
  const [ldrFileUrl, setLdrFileUrl] = useState('');
  const [ldrFilePath, setLdrFilePath] = useState('');
  const [modelId, setModelId] = useState('');
  const [conversionError, setConversionError] = useState('');
  const [description, setDescription] = useState('');
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  
  // Use the data passed via navigation state when component mounts
  useEffect(() => {
    console.log('LdrPage mounted, checking for state data');
    setIsLoading(true);
    
    if (location.state) {
      console.log('LdrPage received state:', location.state);
      
      // Set description if available
      if (location.state.description) {
        setDescription(location.state.description);
      }
      
      // Set error message if LDR conversion failed
      if (location.state.conversionError) {
        setConversionError(location.state.conversionError);
      }
      
      // Set model ID if available
      if (location.state.modelId) {
        setModelId(location.state.modelId);
      }
      
      // If we have a ldrFilePath and ldrUrl from navigation
      if (location.state.ldrFilePath && location.state.ldrUrl) {
        setLdrFilePath(location.state.ldrFilePath);
        
        // Fetch the LDR file content from the server using the path
        const fetchLdrFile = async () => {
          try {
            // Construct the full URL to fetch the LDR file
            const fileUrl = `${API_BASE_URL}${location.state.ldrUrl}`;
            
            console.log('Fetching LDR file from:', fileUrl);
            const response = await fetch(fileUrl);
            
            if (!response.ok) {
              throw new Error(`Failed to fetch LDR file: ${response.statusText}`);
            }
            
            const text = await response.text();
            const blob = new Blob([text], { type: 'text/plain' });
            const filename = location.state.ldrFilePath.split('/').pop() || 'model.ldr';
            const file = new File([blob], filename, { type: 'text/plain' });
            
            setLdrFile(file);
            console.log('LDR file loaded automatically from navigation state');
            setIsLoading(false);
          } catch (error) {
            console.error('Error loading LDR file from navigation state:', error);
            setIsLoading(false);
            // Don't show alert, just log the error
            console.log(`Error loading LDR file: ${error.message}`);
          }
        };
        
        fetchLdrFile();
      }
      // If we only have ldrFilePath without URL (direct file upload case)
      else if (location.state.ldrFilePath) {
        setLdrFilePath(location.state.ldrFilePath);
        
        // Try to get LDR file directly using the path
        const getLdrFileFromPath = async () => {
          try {
            console.log('Attempting to get LDR file using path:', location.state.ldrFilePath);
            const response = await axios.get(`${API_BASE_URL}/get-ldr-file`, {
              params: { filePath: location.state.ldrFilePath }
            });
            
            if (response.data && response.data.content) {
              const blob = new Blob([response.data.content], { type: 'text/plain' });
              const filename = location.state.ldrFilePath.split('/').pop() || 'model.ldr';
              const file = new File([blob], filename, { type: 'text/plain' });
              
              setLdrFile(file);
              console.log('LDR file loaded from server using file path');
            }
            setIsLoading(false);
          } catch (error) {
            console.error('Error getting LDR file from path:', error);
            setIsLoading(false);
          }
        };
        
        getLdrFileFromPath();
      }
      else {
        // If we don't have an LDR file but have a model URL, we can still show the model
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
      console.log('No state passed to LdrPage');
    }
  }, [location]);
  
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
        {description && (
          <div className="model-description">
            <h3>Model Description</h3>
            <p>{description}</p>
          </div>
        )}
        <p>
          {ldrFilePath 
            ? `Viewing: ${ldrFilePath.split('/').pop()}` 
            : 'Upload an LDR file to view it in 3D with layer controls'}
        </p>
        {conversionError && (
          <div className="conversion-error">
            <p>Note: The 3D model was generated, but LDR conversion encountered an issue: {conversionError}</p>
            <p>You can still view the 3D model, but layer-by-layer viewing is not available.</p>
          </div>
        )}
      </div>
      
      {isLoading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading LDR file and model data...</p>
        </div>
      ) : (
        <>
          {!ldrFile && !location.state?.modelUrl && (
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
          )}
          
          <div className="ldr-viewer-container">
            <LdrViewer 
              ldrFile={ldrFile} 
              modelUrl={location.state?.modelUrl} 
              modelId={modelId}
              apiBaseUrl={API_BASE_URL}
            />
          </div>
        </>
      )}
      
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