import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import axios from 'axios';
import './EnhancedLdrPage.css';

// Constants for LDR rendering - copied from LdrViewer component
const LDR_COLORS = {
  0: 0x000000,   // Black
  1: 0x0055BF,   // Blue
  2: 0x00852B,   // Green
  3: 0x009A4E,   // Dark Turquoise
  4: 0xD01012,   // Red
  5: 0xF5C518,   // Yellow
  6: 0x02838F,   // Teal
  7: 0xD67572,   // Pink
  8: 0x8E5597,   // Purple
  9: 0x57615B,   // Dark Gray
  10: 0xF17626,  // Orange
  11: 0x9DC9CA,  // Light Turquoise
  14: 0xEEEEEE,  // White
  15: 0x6B5A5A,  // Brown
  16: 0xD3BB4C,  // Medium Nougat
  17: 0x0E3E9A,  // Dark Blue
  18: 0x069D9F,  // Dark Turquoise
  19: 0x058547,  // Dark Green
  20: 0x802E41,  // Dark Pink
  21: 0xA5371F,  // Dark Red
  22: 0x8C5C20,  // Dark Brown
  23: 0x9BA19D,  // Medium Gray
  24: 0xCDCDCD,  // Light Gray
  25: 0xA06EB9,  // Lavender
  26: 0xE4ADC8,  // Light Pink
  27: 0xD67240,  // Medium Orange
  28: 0xF3CF9B,  // Tan
  29: 0xBDC6AD,  // Light Green
  36: 0xE4CD9E,  // Bright Green
};

// API base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:3001";

const EnhancedLdrPage = ({ 
  modelUrl,         // URL to the generated OBJ model
  ldrFilePath,      // Path to the generated LDR file
  description,      // Original description from Gemini
  instructions = {} // Instructions for the model
}) => {
  // State for layer management
  const [layers, setLayers] = useState([]);
  const [maxLayer, setMaxLayer] = useState(0);
  const [visibleLayers, setVisibleLayers] = useState(1);
  const [currentLayerInstructions, setCurrentLayerInstructions] = useState('');
  const [layerInstructions, setLayerInstructions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Refs for 3D rendering
  const objContainerRef = useRef(null);
  const ldrContainerRef = useRef(null);
  
  // OBJ Viewer refs
  const objSceneRef = useRef(null);
  const objCameraRef = useRef(null);
  const objRendererRef = useRef(null);
  const objControlsRef = useRef(null);
  const objModelRef = useRef(null);
  const objAnimationFrameRef = useRef(null);
  
  // LDR Viewer refs
  const ldrSceneRef = useRef(null);
  const ldrCameraRef = useRef(null);
  const ldrRendererRef = useRef(null);
  const ldrControlsRef = useRef(null);
  const ldrModelRef = useRef(null);
  const ldrAnimationFrameRef = useRef(null);
  
  // Set up OBJ Viewer scene
  useEffect(() => {
    if (!objContainerRef.current || !modelUrl) return;
    
    // Initialize scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);
    objSceneRef.current = scene;
    
    // Initialize camera
    const camera = new THREE.PerspectiveCamera(
      75,
      objContainerRef.current.clientWidth / objContainerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 5;
    objCameraRef.current = camera;
    
    // Initialize renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(objContainerRef.current.clientWidth, objContainerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    objContainerRef.current.appendChild(renderer.domElement);
    objRendererRef.current = renderer;
    
    // Add orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    objControlsRef.current = controls;
    
    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    // Animation loop
    const animate = () => {
      objAnimationFrameRef.current = requestAnimationFrame(animate);
      
      if (objControlsRef.current) {
        objControlsRef.current.update();
      }
      
      if (objRendererRef.current && objSceneRef.current && objCameraRef.current) {
        objRendererRef.current.render(objSceneRef.current, objCameraRef.current);
      }
    };
    
    animate();
    
    // Load the OBJ model
    const objLoader = new OBJLoader();
    objLoader.load(
      modelUrl,
      (obj) => {
        // Clear previous model if any
        if (objModelRef.current) {
          objSceneRef.current.remove(objModelRef.current);
        }
        
        // Set a default material if none exists
        obj.traverse((child) => {
          if (child.isMesh) {
            if (!child.material) {
              child.material = new THREE.MeshStandardMaterial({
                color: 0xCCCCCC,
                roughness: 0.5,
                metalness: 0.2
              });
            }
          }
        });
        
        // Calculate bounding box to center and scale model
        const bbox = new THREE.Box3().setFromObject(obj);
        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());
        
        // Center model
        obj.position.x = -center.x;
        obj.position.y = -center.y;
        obj.position.z = -center.z;
        
        // Scale model to fit view
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 2) {
          const scale = 2 / maxDim;
          obj.scale.set(scale, scale, scale);
        }
        
        // Add model to scene
        objSceneRef.current.add(obj);
        objModelRef.current = obj;
        
        // Update controls target
        const orbitTarget = new THREE.Vector3(0, 0, 0);
        objControlsRef.current.target.copy(orbitTarget);
        objControlsRef.current.update();
      },
      (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + '% loaded');
      },
      (error) => {
        console.error('Error loading OBJ model:', error);
        setError('Failed to load OBJ model');
      }
    );
    
    // Clean up
    return () => {
      cancelAnimationFrame(objAnimationFrameRef.current);
      if (objRendererRef.current && objRendererRef.current.domElement && objContainerRef.current) {
        objContainerRef.current.removeChild(objRendererRef.current.domElement);
      }
    };
  }, [modelUrl]);
  
  // Set up LDR Viewer scene
  useEffect(() => {
    if (!ldrContainerRef.current || !ldrFilePath) return;
    
    // Initialize scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);
    ldrSceneRef.current = scene;
    
    // Initialize camera
    const camera = new THREE.PerspectiveCamera(
      75,
      ldrContainerRef.current.clientWidth / ldrContainerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 5;
    ldrCameraRef.current = camera;
    
    // Initialize renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(ldrContainerRef.current.clientWidth, ldrContainerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    ldrContainerRef.current.appendChild(renderer.domElement);
    ldrRendererRef.current = renderer;
    
    // Add orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    ldrControlsRef.current = controls;
    
    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    // Animation loop
    const animate = () => {
      ldrAnimationFrameRef.current = requestAnimationFrame(animate);
      
      if (ldrControlsRef.current) {
        ldrControlsRef.current.update();
      }
      
      if (ldrRendererRef.current && ldrSceneRef.current && ldrCameraRef.current) {
        ldrRendererRef.current.render(ldrSceneRef.current, ldrCameraRef.current);
      }
    };
    
    animate();
    
    // Clean up
    return () => {
      cancelAnimationFrame(ldrAnimationFrameRef.current);
      if (ldrRendererRef.current && ldrRendererRef.current.domElement && ldrContainerRef.current) {
        ldrContainerRef.current.removeChild(ldrRendererRef.current.domElement);
      }
    };
  }, [ldrFilePath]);
  
  // Load LDR file and parse layers
  useEffect(() => {
    if (!ldrFilePath) return;
    
    setLoading(true);
    
    // Call API to get layers data for the LDR file
    axios.post(`${API_BASE_URL}/get-ldr-layers`, { ldrFilePath })
      .then(response => {
        const { layers, maxLayer } = response.data;
        setLayers(layers);
        setMaxLayer(maxLayer);
        setVisibleLayers(1); // Start with just the first layer visible
        
        // Generate instructions for each layer using Gemini
        return axios.post(`${API_BASE_URL}/generate-layer-instructions`, {
          ldrFilePath,
          description,
          layersCount: maxLayer
        });
      })
      .then(instructionsResponse => {
        const layerInstructions = instructionsResponse.data.instructions;
        setLayerInstructions(layerInstructions);
        
        // Set instructions for the first layer
        if (layerInstructions.length > 0) {
          setCurrentLayerInstructions(layerInstructions[0]);
        }
        
        setLoading(false);
      })
      .catch(error => {
        console.error('Error loading LDR layers:', error);
        setError('Failed to load LDR model layers');
        setLoading(false);
      });
  }, [ldrFilePath, description]);
  
  // Update visible layers based on slider
  useEffect(() => {
    if (layers.length === 0) return;
    
    // Render the LDR model with visible layers
    renderLdrModel(visibleLayers);
    
    // Update current layer instructions
    if (layerInstructions.length >= visibleLayers) {
      setCurrentLayerInstructions(layerInstructions[visibleLayers - 1]);
    }
  }, [visibleLayers, layers, layerInstructions]);
  
  // Render LDR model with specified number of visible layers
  const renderLdrModel = (visibleLayersCount) => {
    if (!ldrSceneRef.current || layers.length === 0) return;
    
    // Clear existing model
    if (ldrModelRef.current) {
      ldrSceneRef.current.remove(ldrModelRef.current);
    }
    
    // Create a group to hold all parts
    const modelGroup = new THREE.Group();
    
    // Initialize geometry cache
    const geometryCache = {};
    
    // Add visible layers
    for (let i = 0; i < Math.min(visibleLayersCount, layers.length); i++) {
      const layer = layers[i];
      
      // Create a layer group
      const layerGroup = new THREE.Group();
      layerGroup.name = `Layer ${layer.layer}`;
      
      // Check if this is the most recently added layer
      const isNewestLayer = i === Math.min(visibleLayersCount, layers.length) - 1;
      
      // Add parts to the layer
      layer.parts.forEach(part => {
        // Create a simple mesh for each brick
        const dimensions = part.dimensions || { width: 1, height: 0.5, depth: 1 };
        const color = LDR_COLORS[part.color] || 0xCCCCCC;
        
        // Create a simple brick
        let geometry;
        
        // Try to get from cache
        const cacheKey = `${dimensions.width}_${dimensions.height}_${dimensions.depth}`;
        if (geometryCache[cacheKey]) {
          geometry = geometryCache[cacheKey];
        } else {
          geometry = new THREE.BoxGeometry(dimensions.width, dimensions.height, dimensions.depth);
          geometryCache[cacheKey] = geometry;
        }
        
        const material = new THREE.MeshStandardMaterial({
          color: color,
          roughness: 0.5,
          metalness: 0.2,
          // Highlight the newest layer
          emissive: isNewestLayer ? new THREE.Color(0x222222) : new THREE.Color(0x000000)
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        
        // Set position and rotation based on part data
        if (part.position) {
          mesh.position.set(
            part.position.x,
            part.position.y,
            part.position.z
          );
        }
        
        if (part.rotation) {
          mesh.rotation.set(
            part.rotation.x,
            part.rotation.y,
            part.rotation.z
          );
        }
        
        // Apply matrix if available
        if (part.matrix) {
          const matrix = new THREE.Matrix4().set(
            part.matrix[0], part.matrix[3], part.matrix[6], 0,
            part.matrix[1], part.matrix[4], part.matrix[7], 0,
            part.matrix[2], part.matrix[5], part.matrix[8], 0,
            0, 0, 0, 1
          );
          mesh.applyMatrix4(matrix);
        }
        
        // Add to layer group
        layerGroup.add(mesh);
      });
      
      // Add layer group to model group
      modelGroup.add(layerGroup);
    }
    
    // Add model to scene
    ldrSceneRef.current.add(modelGroup);
    ldrModelRef.current = modelGroup;
    
    // Center camera on model
    const box = new THREE.Box3().setFromObject(modelGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    // Update controls target to center of model
    if (ldrControlsRef.current) {
      ldrControlsRef.current.target.copy(center);
      ldrControlsRef.current.update();
    }
    
    // Position camera to see the entire model
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = ldrCameraRef.current.fov * (Math.PI / 180);
    let cameraDistance = maxDim / (2 * Math.tan(fov / 2));
    cameraDistance *= 1.5; // Add some margin
    
    // Set camera position to be at an angle
    const cameraTheta = Math.PI / 4; // 45 degrees angle
    const cameraPhi = Math.PI / 6;   // 30 degrees elevation
    
    const offsetX = cameraDistance * Math.sin(cameraTheta) * Math.cos(cameraPhi);
    const offsetY = cameraDistance * Math.sin(cameraPhi);
    const offsetZ = cameraDistance * Math.cos(cameraTheta) * Math.cos(cameraPhi);
    
    // Set camera position
    ldrCameraRef.current.position.set(
      center.x + offsetX,
      center.y + offsetY,
      center.z + offsetZ
    );
    
    ldrCameraRef.current.lookAt(center);
  };
  
  // Handle layer slider change
  const handleLayerChange = (e) => {
    setVisibleLayers(parseInt(e.target.value));
  };
  
  // Handle increment layer button
  const handleIncrementLayer = () => {
    if (visibleLayers < maxLayer) {
      setVisibleLayers(visibleLayers + 1);
    }
  };
  
  // Handle decrement layer button
  const handleDecrementLayer = () => {
    if (visibleLayers > 1) {
      setVisibleLayers(visibleLayers - 1);
    }
  };
  
  return (
    <div className="enhanced-ldr-page">
      <div className="enhanced-ldr-page-header">
        <h1>LEGO Model Builder</h1>
        <div className="description-box">
          <h2>Model Description</h2>
          <p>{description}</p>
        </div>
      </div>
      
      <div className="model-viewers">
        <div className="model-viewer-section">
          <h2>3D Model Preview</h2>
          <div className="model-viewer-container" ref={objContainerRef}></div>
          <p className="model-viewer-caption">Original 3D model - You can rotate and zoom using your mouse</p>
        </div>
        
        <div className="model-viewer-section">
          <h2>LEGO Instructions</h2>
          <div className="model-viewer-container" ref={ldrContainerRef}></div>
          
          {layers.length > 0 && (
            <div className="layer-controls">
              <div className="layer-info">
                <span>Layer: </span>
                <span className="layer-count">{visibleLayers} / {maxLayer}</span>
              </div>
              
              <div className="slider-controls">
                <button 
                  className={`slider-arrow ${visibleLayers <= 1 ? 'disabled' : ''}`}
                  onClick={handleDecrementLayer}
                  disabled={visibleLayers <= 1}
                >
                  ◀
                </button>
                <input
                  type="range"
                  className="layer-slider"
                  min={1}
                  max={maxLayer}
                  step={1}
                  value={visibleLayers}
                  onChange={handleLayerChange}
                />
                <button 
                  className={`slider-arrow ${visibleLayers >= maxLayer ? 'disabled' : ''}`}
                  onClick={handleIncrementLayer}
                  disabled={visibleLayers >= maxLayer}
                >
                  ▶
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="layer-instructions">
        <h2>Building Instructions - Layer {visibleLayers}</h2>
        <div className="instructions-content">
          {loading ? (
            <p className="loading-message">Loading instructions...</p>
          ) : error ? (
            <p className="error-message">{error}</p>
          ) : (
            <p>{currentLayerInstructions || "No instructions available for this layer."}</p>
          )}
        </div>
      </div>
      
      <div className="enhanced-ldr-page-footer">
        <h3>Model Information</h3>
        <p>
          This model was automatically generated using AI. The building instructions are
          generated layer-by-layer to help you construct this model physically if desired.
        </p>
        <p>
          Total layers: {maxLayer} | 
          Current progress: {Math.round((visibleLayers / maxLayer) * 100)}%
        </p>
      </div>
    </div>
  );
};

export default EnhancedLdrPage; 