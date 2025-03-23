import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import './LdrViewer.css';

// Create a map of available brick definitions
const AVAILABLE_BRICKS = [
  '3001.dat', // Brick 2 x 4
  '3003.dat', // Brick 2 x 2
  '3004.dat', // Brick 1 x 2
  '3005.dat', // Brick 1 x 1
  '3010.dat', // Brick 1 x 4
  '87079.dat' // Brick 2 x 4 with Pins
];

// LDR colors mapping (expanded and refined)
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
  // More colors can be added as needed
};

/* 
 * LDraw Units (LDU) to millimeters conversion:
 * 1 LDU = 0.4 mm (approximate)
 * 
 * Standard LEGO dimensions in LDU:
 * 1 brick width/depth = 20 LDU (8mm)
 * 1 brick height = 24 LDU (9.6mm)
 * 1 plate height = 8 LDU (3.2mm)
 * 1 stud diameter = 12 LDU (4.8mm)
 * 1 stud height = 4 LDU (1.6mm)
 */

// Brick definitions with names from the dat files
const BRICK_NAMES = {
  '3001.dat': 'Brick 2 x 4',
  '3003.dat': 'Brick 2 x 2',
  '3004.dat': 'Brick 1 x 2',
  '3005.dat': 'Brick 1 x 1',
  '3010.dat': 'Brick 1 x 4',
  '87079.dat': 'Brick 2 x 4 with Pins',
  // Add other brick names as needed
};

// Common brick dimensions in LDraw Units (LDU)
const COMMON_BRICKS = {
  // Available bricks from user with accurate LDU dimensions
  '3001.dat': { width: 2*20, height: 24, depth: 4*20 },   // 2x4 Brick: 40x24x80 LDU
  '2456.dat': { width: 4*20, height: 24, depth: 2*20 },   // 4x2 Brick: 80x24x40 LDU
  '3004.dat': { width: 1*20, height: 24, depth: 2*20 },   // 1x2 Brick: 20x24x40 LDU
  '3069b.dat': { width: 2*20, height: 24, depth: 1*20 },  // 2x1 Brick: 40x24x20 LDU
  '3005.dat': { width: 1*20, height: 24, depth: 1*20 },   // 1x1 Brick: 20x24x20 LDU
  '3003.dat': { width: 2*20, height: 24, depth: 2*20 },   // 2x2 Brick: 40x24x40 LDU
  '3010.dat': { width: 1*20, height: 24, depth: 4*20 },   // 1x4 Brick: 20x24x80 LDU
  '3002.dat': { width: 2*20, height: 24, depth: 3*20 },   // 2x3 Brick: 40x24x60 LDU
  '3622.dat': { width: 1*20, height: 24, depth: 3*20 },   // 1x3 Brick: 20x24x60 LDU
  '87079.dat': { width: 2*20, height: 24, depth: 4*20 },  // 2x4 Brick with Pins: 40x24x80 LDU
};

// Default brick dimensions to use when no match is found (in LDU)
const DEFAULT_BRICK = { width: 2*20, height: 24, depth: 4*20 }; // Default to 2x4 brick (40x24x80 LDU)

// Unit scale (LDU to Three.js units) - calibrated for accurate representation
// 1 LDU = 0.4mm, we use a scale factor to convert to Three.js world units
const UNIT_SCALE = 0.15; // Increased from 0.075 to make models larger

// Height of one layer in LDU
const LAYER_HEIGHT = 24; // One brick height

// Map to track created brick geometries to avoid recreation
const brickGeometryCache = new Map();

const LdrViewer = ({ ldrFile }) => {
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [layers, setLayers] = useState([]);
  const [maxLayer, setMaxLayer] = useState(0);
  const [visibleLayers, setVisibleLayers] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [totalPieces, setTotalPieces] = useState(0);
  const [totalBrickCounts, setTotalBrickCounts] = useState({});

  // Three.js references
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const modelRef = useRef(null);

  // Set up Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    // Save the current containerRef value
    const container = containerRef.current;

    // Initialize scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);
    sceneRef.current = scene;

    // Initialize camera
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      2000
    );
    camera.position.set(50, 100, 200);
    cameraRef.current = camera;

    // Initialize renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Add orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controlsRef.current = controls;

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(100, 200, 100);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Add a secondary light from another direction to better showcase the studs
    const secondaryLight = new THREE.DirectionalLight(0xffffff, 0.6);
    secondaryLight.position.set(-100, 50, -100);
    secondaryLight.castShadow = true;
    scene.add(secondaryLight);

    // Add grid helper for orientation but make it subtle
    const gridHelper = new THREE.GridHelper(1000, 100, 0xcccccc, 0xdddddd);
    gridHelper.position.y = -0.5; // Position it below the model
    gridHelper.material.opacity = 0.5;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle window resize
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Determine part dimensions
  const getBrickDimensions = (partRef) => {
    // Extract just the part name without the path
    const partName = partRef.split('/').pop().toLowerCase();
    let brickType = '';
    
    // Check if we have this part in our available bricks list
    for (const brick of AVAILABLE_BRICKS) {
      if (partName.includes(brick.toLowerCase())) {
        brickType = brick;
        break;
      }
    }
    
    // If found in available bricks, use those dimensions
    if (brickType && COMMON_BRICKS[brickType]) {
      return {
        ...COMMON_BRICKS[brickType],
        brickType,
        brickName: BRICK_NAMES[brickType] || brickType.replace('.dat', '')
      };
    }
    
    // Check if we have this part in our common bricks library
    for (const [key, dimensions] of Object.entries(COMMON_BRICKS)) {
      if (partName.includes(key.toLowerCase())) {
        return {
          ...dimensions,
          brickType: key,
          brickName: BRICK_NAMES[key] || key.replace('.dat', '')
        };
      }
    }
    
    // If no match is found, check brick dimensions and map to nearest available brick
    // Extract any numbers from the part name to guess dimensions
    const numbers = partName.match(/\d+/g);
    if (numbers && numbers.length >= 2) {
      const dim1 = parseInt(numbers[0], 10);
      const dim2 = parseInt(numbers[1], 10);
      
      // Check against available brick sizes
      const availableSizes = [
        { width: 2*20, depth: 4*20, key: '3001.dat' }, // 2x4
        { width: 4*20, depth: 2*20, key: '2456.dat' }, // 4x2
        { width: 2*20, depth: 1*20, key: '3069b.dat' }, // 2x1
        { width: 1*20, depth: 2*20, key: '3004.dat' }, // 1x2
        { width: 1*20, depth: 1*20, key: '3005.dat' }, // 1x1
        { width: 2*20, depth: 2*20, key: '3003.dat' }, // 2x2
        { width: 1*20, depth: 4*20, key: '3010.dat' }, // 1x4
      ];
      
      // Find the closest match
      for (const size of availableSizes) {
        if ((size.width === dim1*20 && size.depth === dim2*20) || 
            (size.width === dim2*20 && size.depth === dim1*20)) {
          return {
            width: size.width,
            height: 24,
            depth: size.depth,
            brickType: size.key,
            brickName: BRICK_NAMES[size.key] || size.key.replace('.dat', '')
          };
        }
      }
    }
    
    // Return default brick dimensions if no match is found
    return {
      ...DEFAULT_BRICK,
      brickType: '3001.dat',
      brickName: BRICK_NAMES['3001.dat'] || '2x4 Brick'
    };
  };

  // Create a more detailed brick mesh using the parameters
  const createBrickMesh = (dimensions, color, isNewestLayer) => {
    const { width, height, depth, brickType } = dimensions;
    
    // Check if we have a cached geometry for this brick type
    const cacheKey = `${brickType}_${width}_${height}_${depth}`;
    let geometry;
    
    if (brickGeometryCache.has(cacheKey)) {
      geometry = brickGeometryCache.get(cacheKey);
    } else {
      // Create a BoxGeometry with the right dimensions
      geometry = new THREE.BoxGeometry(
        width * UNIT_SCALE,
        height * UNIT_SCALE,
        depth * UNIT_SCALE
      );
      
      // Special case for tile (87079) which doesn't have studs
      if (brickType !== '87079.dat') {
        // Add studs on top
        const studDiameter = 12 * UNIT_SCALE; // Stud diameter in LDU (12 LDU = 4.8mm)
        const studHeight = 4 * UNIT_SCALE; // Stud height in LDU (4 LDU = 1.6mm)
        
        // Create cylinder for stud - cylinder's height is along Y-axis in Three.js
        const studGeometry = new THREE.CylinderGeometry(
          studDiameter / 2,
          studDiameter / 2,
          studHeight,
          16, // More segments for smoother circles
          1,  // Height segments
          false // Open-ended
        );
        
        // Calculate stud positions
        const widthStuds = Math.round(width / 20); // Number of studs along width
        const depthStuds = Math.round(depth / 20); // Number of studs along depth
        
        // Distance between studs in LDU (each stud is 20 LDU apart center to center)
        const studSpacing = 20 * UNIT_SCALE;
        
        // Get the actual rendered dimensions
        const actualHeight = height * UNIT_SCALE;
        
        // Starting position for the first stud
        // For proper centering based on the brick dimensions
        const startX = widthStuds % 2 === 0 ? 
                      -((widthStuds - 1) * studSpacing) / 2 : 
                      -Math.floor(widthStuds / 2) * studSpacing;
                         
        const startZ = depthStuds % 2 === 0 ? 
                      -((depthStuds - 1) * studSpacing) / 2 : 
                      -Math.floor(depthStuds / 2) * studSpacing;
        
        // For each stud position, create and merge the geometry
        for (let x = 0; x < widthStuds; x++) {
          for (let z = 0; z < depthStuds; z++) {
            // Calculate the stud position
            const studX = startX + x * studSpacing;
            const studZ = startZ + z * studSpacing;
            
            // Position the stud on top of the brick
            // Height/2 gets us to the top face, then add half the stud height
            const studY = actualHeight / 2 + studHeight / 2;
            
            // Clone the stud geometry
            const studBufferGeometry = studGeometry.clone();
            
            // First: translate to the correct position
            const matrix = new THREE.Matrix4().makeTranslation(studX, studY, studZ);
            
            // Apply the transformation to the geometry
            studBufferGeometry.applyMatrix4(matrix);
            
            // Merge with the main geometry
            geometry = mergeBufferGeometries([geometry, studBufferGeometry]);
          }
        }
      }
      
      // Cache the geometry for future use
      brickGeometryCache.set(cacheKey, geometry);
    }
    
    // Create the material with optional highlight for newest layer
    const material = new THREE.MeshStandardMaterial({ 
      color: isNewestLayer ? new THREE.Color(color).lerp(new THREE.Color(0xFFFFFF), 0.2) : color,
      roughness: 0.4,
      metalness: 0.2,
      emissive: isNewestLayer ? new THREE.Color(color).lerp(new THREE.Color(0xFFFFFF), 0.1) : 0x000000,
      emissiveIntensity: isNewestLayer ? 0.3 : 0
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    return mesh;
  };

  // Helper function to merge buffer geometries
  const mergeBufferGeometries = (geometries) => {
    // Simple approach: use the first geometry and add attributes from others
    if (geometries.length === 0) return null;
    if (geometries.length === 1) return geometries[0];
    
    // For simplicity, we'll implement a basic merge that works for our case
    const baseGeometry = geometries[0];
    
    // Create arrays to store all vertices, normals, etc.
    let positions = Array.from(baseGeometry.attributes.position.array);
    let normals = baseGeometry.attributes.normal ? 
      Array.from(baseGeometry.attributes.normal.array) : [];
    let uvs = baseGeometry.attributes.uv ? 
      Array.from(baseGeometry.attributes.uv.array) : [];
    
    // Get the number of initial vertices
    let baseVertexCount = positions.length / 3;
    
    // Arrays to store indices
    let indices = [];
    
    // Add base geometry indices
    if (baseGeometry.index) {
      indices = Array.from(baseGeometry.index.array);
    } else {
      // If no index, create sequential indices
      for (let i = 0; i < baseVertexCount; i++) {
        indices.push(i);
      }
    }
    
    // Process each additional geometry
    for (let i = 1; i < geometries.length; i++) {
      const geo = geometries[i];
      
      // Add positions
      const posArr = Array.from(geo.attributes.position.array);
      positions = positions.concat(posArr);
      
      // Add normals if they exist
      if (geo.attributes.normal) {
        const normArr = Array.from(geo.attributes.normal.array);
        normals = normals.concat(normArr);
      }
      
      // Add UVs if they exist
      if (geo.attributes.uv) {
        const uvArr = Array.from(geo.attributes.uv.array);
        uvs = uvs.concat(uvArr);
      }
      
      // Add indices with offset
      if (geo.index) {
        const geoIndices = Array.from(geo.index.array);
        const offset = baseVertexCount;
        for (let j = 0; j < geoIndices.length; j++) {
          indices.push(geoIndices[j] + offset);
        }
      } else {
        // If no index, create sequential indices with offset
        for (let j = 0; j < posArr.length / 3; j++) {
          indices.push(baseVertexCount + j);
        }
      }
      
      // Update base vertex count
      baseVertexCount += posArr.length / 3;
    }
    
    // Create a new BufferGeometry
    const mergedGeometry = new THREE.BufferGeometry();
    
    // Set attributes
    mergedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    if (normals.length > 0) {
      mergedGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    }
    if (uvs.length > 0) {
      mergedGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    }
    
    // Set indices
    mergedGeometry.setIndex(indices);
    
    // Compute normals if needed
    if (normals.length === 0) {
      mergedGeometry.computeVertexNormals();
    }
    
    return mergedGeometry;
  };

  // Parse LDR file
  const parseLdrFile = (fileContent) => {
    console.log("Parsing LDR file...");
    
    const lines = fileContent.split('\n');
    const partsByLayer = {};
    let maxLayerFound = 0;
    let lineCount = 0;
    let parsedPartsCount = 0;
    
    // We'll gather all parts first
    const allParts = [];

    // Track total counts by type
    const totalBrickCounts = {
      '2x4': 0,
      '4x2': 0,
      '2x1': 0,
      '1x2': 0,
      '1x1': 0,
      '2x2': 0,
      'tile': 0,
      'other': 0
    };

    // Parse each line
    lines.forEach((line, index) => {
      line = line.trim();
      lineCount++;
      
      // Skip empty lines and comments
      if (!line || line.startsWith('0 ')) {
        return;
      }

      // Parse part lines (type 1)
      if (line.startsWith('1 ')) {
        const parts = line.split(/\s+/);
        
        if (parts.length >= 14) {
          try {
            const color = parseInt(parts[1], 10);
            const x = parseFloat(parts[2]);
            const y = parseFloat(parts[3]);
            const z = parseFloat(parts[4]);
            
            // Get transformation matrix
            const a = parseFloat(parts[5]);
            const b = parseFloat(parts[6]);
            const c = parseFloat(parts[7]);
            const d = parseFloat(parts[8]);
            const e = parseFloat(parts[9]);
            const f = parseFloat(parts[10]);
            const g = parseFloat(parts[11]);
            const h = parseFloat(parts[12]);
            const i = parseFloat(parts[13]);
            
            // Get part reference
            const partRef = parts[14];
            
            // Get the brick dimensions
            const dimensions = getBrickDimensions(partRef);
            
            // Store all part information regardless of layer
            allParts.push({
              line,
              color,
              position: { x, y, z },
              matrix: [a, b, c, d, e, f, g, h, i],
              partRef,
              dimensions
            });
            
            parsedPartsCount++;
          } catch (err) {
            console.error(`Error parsing line ${index + 1}: ${line}`, err);
          }
        }
      }
    });
    
    // In LDraw, negative Y is up, so we sort parts by Y position (descending) 
    // to identify layers from bottom to top
    allParts.sort((a, b) => b.position.y - a.position.y);
    
    // Calculate Y ranges to determine layers
    let minY = Infinity;
    let maxY = -Infinity;
    
    allParts.forEach(part => {
      minY = Math.min(minY, part.position.y);
      maxY = Math.max(maxY, part.position.y);
    });
    
    // Height of a 1x1 brick in LDU
    const brickHeight = 24; // Standard brick height in LDU

    // If we have at least one part, ensure valid min/max values
    if (allParts.length > 0) {
      // If min and max are the same, adjust to avoid dividing by zero
      if (minY === maxY) {
        maxY += brickHeight; // Add one brick height
      }
      
      // Adjust range to ensure we have enough separation
      const yRange = maxY - minY;
      
      // Calculate how many layers would fit in this Y range if each layer is one brick height
      const possibleLayerCount = Math.ceil(yRange / brickHeight);
      
      // Use a reasonable number of layers (between 1 and 15)
      const targetLayerCount = Math.min(15, Math.max(1, possibleLayerCount));
      
      // Calculate the thickness of each layer based on the total Y range
      const layerThickness = yRange / targetLayerCount;
      
      console.log(`Min Y: ${minY}, Max Y: ${maxY}, Range: ${yRange}, Possible Layers: ${possibleLayerCount}, Target Layers: ${targetLayerCount}`);
      
      // Distribute parts into layers (from bottom to top)
      allParts.forEach(part => {
        // Calculate which layer this part belongs to
        // In LDraw, negative Y is up, so higher values of y are lower in the model
        const normalizedY = part.position.y - minY;
        const layerIndex = Math.min(targetLayerCount - 1, Math.floor(normalizedY / layerThickness));
        
        // Initialize layer array if not exists
        if (!partsByLayer[layerIndex]) {
          partsByLayer[layerIndex] = [];
        }
        
        partsByLayer[layerIndex].push(part);
        
        // Update max layer 
        maxLayerFound = Math.max(maxLayerFound, layerIndex);
      });
    }

    // Create brick count statistics for each layer
    const layerStats = {};
    
    for (let i = 0; i <= maxLayerFound; i++) {
      const layerParts = partsByLayer[i] || [];
      const brickCounts = {
        '2x4': 0,
        '4x2': 0,
        '2x1': 0,
        '1x2': 0,
        '1x1': 0,
        '2x2': 0,
        'tile': 0,
        'other': 0
      };
      
      layerParts.forEach(part => {
        const dim = part.dimensions;
        const brickType = part.dimensions.brickType || '';
        
        if (brickType.includes('87079')) {
          brickCounts['tile']++;
          totalBrickCounts['tile']++;
        } else if (dim.width === 2*20 && dim.depth === 4*20) {
          brickCounts['2x4']++;
          totalBrickCounts['2x4']++;
        } else if (dim.width === 4*20 && dim.depth === 2*20) {
          brickCounts['4x2']++;
          totalBrickCounts['4x2']++;
        } else if (dim.width === 2*20 && dim.depth === 1*20) {
          brickCounts['2x1']++;
          totalBrickCounts['2x1']++;
        } else if (dim.width === 1*20 && dim.depth === 2*20) {
          brickCounts['1x2']++;
          totalBrickCounts['1x2']++;
        } else if (dim.width === 1*20 && dim.depth === 1*20) {
          brickCounts['1x1']++;
          totalBrickCounts['1x1']++;
        } else if (dim.width === 2*20 && dim.depth === 2*20) {
          brickCounts['2x2']++;
          totalBrickCounts['2x2']++;
        } else {
          brickCounts['other']++;
          totalBrickCounts['other']++;
        }
      });
      
      layerStats[i] = brickCounts;
    }

    console.log(`Parsed ${lineCount} lines, found ${parsedPartsCount} parts in ${maxLayerFound + 1} layers`);
    setDebugInfo({
      lineCount,
      parsedPartsCount,
      layerCount: maxLayerFound + 1
    });

    // Create the layers array (now in reverse order for the slider to work correctly)
    const layersArray = [];
    for (let i = maxLayerFound; i >= 0; i--) {
      layersArray.push({
        layer: maxLayerFound - i, // Keep original layer number for display
        parts: partsByLayer[i] || [],
        partsCount: (partsByLayer[i] || []).length,
        originalLayerIndex: i, // Store original index
        brickCounts: layerStats[i] // Add brick counts statistics
      });
    }

    return {
      layers: layersArray,
      maxLayer: maxLayerFound + 1,
      totalPieces: parsedPartsCount,
      totalBrickCounts: totalBrickCounts
    };
  };

  // Render LDR model based on layers
  const renderLdrModel = (layersData, visibleLayersCount) => {
    if (!sceneRef.current) return;
    console.log(`Rendering LDR model with ${visibleLayersCount} layers visible out of ${layersData.layers.length} total layers`);

    // Clear existing model
    if (modelRef.current) {
      sceneRef.current.remove(modelRef.current);
    }

    // Create a group to hold all parts
    const modelGroup = new THREE.Group();
    let totalParts = 0;
    
    // Process visible layers - now in the right order for building from bottom to top
    for (let i = 0; i < Math.min(visibleLayersCount, layersData.layers.length); i++) {
      const layer = layersData.layers[i];
      
      // Create a layer group
      const layerGroup = new THREE.Group();
      layerGroup.name = `Layer ${layer.layer}`;
      
      // Check if this is the most recently added layer
      const isNewestLayer = i === Math.min(visibleLayersCount, layersData.layers.length) - 1;
      
      // Add parts to the layer
      layer.parts.forEach(part => {
        const color = LDR_COLORS[part.color] || 0xCCCCCC; // Default to grey if color not found
        
        // Use enhanced brick creation with studs
        const mesh = createBrickMesh(part.dimensions, color, isNewestLayer);
        
        // In LDraw coordinate system:
        // - X goes right
        // - Y goes up (but negative Y is up in their files)
        // - Z goes out of the screen
        
        // Apply the LDraw position (scaled)
        mesh.position.set(
          part.position.x * UNIT_SCALE,
          -part.position.y * UNIT_SCALE, // Flip Y axis (negative Y is up in LDraw)
          part.position.z * UNIT_SCALE
        );
        
        // Apply the LDraw transformation matrix
        // LDraw matrices use a row-major format, while Three.js uses column-major
        // So we need to transpose the matrix values
        const matrix = new THREE.Matrix4().set(
          part.matrix[0], part.matrix[3], part.matrix[6], 0,
          part.matrix[1], part.matrix[4], part.matrix[7], 0,
          part.matrix[2], part.matrix[5], part.matrix[8], 0,
          0, 0, 0, 1
        );
        
        // Apply the matrix to the mesh
        mesh.applyMatrix4(matrix);
        
        // Add to layer group
        layerGroup.add(mesh);
        
        // Count the total parts rendered
        totalParts++;
      });
      
      // Add layer group to model group
      modelGroup.add(layerGroup);
    }
    
    console.log(`Rendered ${totalParts} parts`);
    
    // Add model to scene
    sceneRef.current.add(modelGroup);
    modelRef.current = modelGroup;
    
    // Center camera on model
    const box = new THREE.Box3().setFromObject(modelGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    // Update controls target to center of model
    if (controlsRef.current) {
      controlsRef.current.target.copy(center);
      controlsRef.current.update();
    }
    
    // Position camera to see the entire model
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = cameraRef.current.fov * (Math.PI / 180);
    let cameraDistance = maxDim / (2 * Math.tan(fov / 2));
    cameraDistance *= 1.5; // Add some margin
    
    // Set camera position to be at an angle to better show the 3D model
    const cameraTheta = Math.PI / 4; // 45 degrees angle
    const cameraPhi = Math.PI / 6;   // 30 degrees elevation
    
    const offsetX = cameraDistance * Math.sin(cameraTheta) * Math.cos(cameraPhi);
    const offsetY = cameraDistance * Math.sin(cameraPhi);
    const offsetZ = cameraDistance * Math.cos(cameraTheta) * Math.cos(cameraPhi);
    
    // Set camera position
    cameraRef.current.position.set(
      center.x + offsetX,
      center.y + offsetY,
      center.z + offsetZ
    );
    
    cameraRef.current.lookAt(center);
  };

  // Handle file selection
  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setLoading(true);
    setError(null);
    setDebugInfo(null);
    
    console.log(`Selected file: ${selectedFile.name}, size: ${selectedFile.size} bytes`);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        console.log("File loaded successfully");
        const fileContent = e.target.result;
        const parsedData = parseLdrFile(fileContent);
        
        if (parsedData.layers.length === 0 || parsedData.maxLayer === 0) {
          throw new Error("No valid parts found in the LDR file");
        }
        
        setLayers(parsedData.layers);
        setMaxLayer(parsedData.maxLayer);
        setVisibleLayers(parsedData.maxLayer);
        setTotalPieces(parsedData.totalPieces);
        setTotalBrickCounts(parsedData.totalBrickCounts);
        
        // Render the model
        renderLdrModel(parsedData, parsedData.maxLayer);
        setLoading(false);
      } catch (err) {
        console.error('Error parsing LDR file:', err);
        setError('Failed to parse LDR file: ' + err.message);
        setLoading(false);
      }
    };
    
    reader.onerror = (e) => {
      console.error('Error reading file:', e);
      setError('Failed to read file');
      setLoading(false);
    };
    
    reader.readAsText(selectedFile);
  };

  // Handle layer slider change
  const handleLayerChange = (e) => {
    const newValue = parseInt(e.target.value, 10);
    setVisibleLayers(newValue);
    renderLdrModel({ layers }, newValue);
  };

  // Handle increment layer button click
  const handleIncrementLayer = () => {
    if (visibleLayers < maxLayer) {
      const newValue = visibleLayers + 1;
      setVisibleLayers(newValue);
      
      renderLdrModel({ layers }, newValue);
    }
  };

  // Handle decrement layer button click
  const handleDecrementLayer = () => {
    if (visibleLayers > 1) {
      const newValue = visibleLayers - 1;
      setVisibleLayers(newValue);
      
      renderLdrModel({ layers }, newValue);
    }
  };

  // Calculate visible pieces based on visible layers
  const visiblePieces = useMemo(() => {
    if (!layers.length) return 0;
    return layers
      .slice(0, visibleLayers)
      .reduce((sum, layer) => sum + layer.partsCount, 0);
  }, [layers, visibleLayers]);

  // Use effect to load LDR file if provided as prop
  useEffect(() => {
    if (ldrFile && ldrFile instanceof File) {
      setFile(ldrFile);
      setLoading(true);
      setError(null);
      setDebugInfo(null);
      
      console.log(`Processing provided file: ${ldrFile.name}, size: ${ldrFile.size} bytes`);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          console.log("File loaded successfully");
          const fileContent = e.target.result;
          const parsedData = parseLdrFile(fileContent);
          
          if (parsedData.layers.length === 0 || parsedData.maxLayer === 0) {
            throw new Error("No valid parts found in the LDR file");
          }
          
          setLayers(parsedData.layers);
          setMaxLayer(parsedData.maxLayer);
          setVisibleLayers(parsedData.maxLayer);
          setTotalPieces(parsedData.totalPieces);
          setTotalBrickCounts(parsedData.totalBrickCounts);
          
          // Render the model
          renderLdrModel(parsedData, parsedData.maxLayer);
          setLoading(false);
        } catch (err) {
          console.error('Error parsing LDR file:', err);
          setError('Failed to parse LDR file: ' + err.message);
          setLoading(false);
        }
      };
      
      reader.onerror = (e) => {
        console.error('Error reading file:', e);
        setError('Failed to read file');
        setLoading(false);
      };
      
      reader.readAsText(ldrFile);
    }
  }, [ldrFile]);

  return (
    <div className="ldr-viewer">
      <div className="ldr-viewer-header">
        <h2>LDR Viewer</h2>
        
        <div className="file-input">
          <label htmlFor="ldr-file-input">Load LDR File: </label>
          <input
            id="ldr-file-input"
            type="file"
            accept=".ldr,.dat"
            onChange={handleFileSelect}
            ref={fileInputRef}
          />
        </div>
      </div>

      {layers.length > 0 && (
        <div className="layer-controls">
          <label>
            Layer Visibility
            <span className="layer-count">{visibleLayers} / {maxLayer}</span>
          </label>
          <div className="slider-with-controls">
            <button 
              className={`slider-arrow ${visibleLayers <= 1 ? 'disabled' : ''}`}
              onClick={handleDecrementLayer}
              disabled={visibleLayers <= 1}
            >
              &#9664;
            </button>
            <input
              type="range"
              className="custom-slider"
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
              &#9654;
            </button>
          </div>
        </div>
      )}

      {loading && <div className="loading">Loading...</div>}
      {error && <div className="error">{error}</div>}

      <div className="canvas-container" ref={containerRef}>
        {/* Piece Summary Section - positioned inside canvas container */}
        {totalPieces > 0 && (
          <div className="piece-summary">
            <h3>Piece Summary</h3>
            <p><strong>Total Pieces:</strong> {totalPieces}</p>
            <p><strong>Visible Pieces:</strong> {visiblePieces}</p>
            <div className="brick-counts">
              {Object.entries(totalBrickCounts)
                .filter(([_, count]) => count > 0)
                .sort((a, b) => b[1] - a[1]) // Sort by count, highest first
                .map(([type, count]) => (
                  <div key={type} className="brick-count-item">
                    <span className="brick-type">{type}</span>
                    <span className="brick-count">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Layer Information Section */}
      {layers.length > 0 && (
        <div className="layer-info">
          <h3>Layer Information</h3>
          <div className="layers-list">
            {layers.map((layer, index) => (
              <div 
                key={index}
                className={`layer-item ${index < visibleLayers ? 'visible' : 'hidden'}`}
              >
                <div className="layer-header">
                  <span className="layer-number">Layer {index + 1}</span>
                  <span className="parts-count">{layer.partsCount} parts</span>
                </div>
                {layer.brickCounts && index < visibleLayers && (
                  <div className="brick-counts">
                    {Object.entries(layer.brickCounts)
                      .filter(([_, count]) => count > 0)
                      .map(([type, count]) => (
                        <div key={type} className="brick-type">
                          <span className="brick-name">{type}</span>
                          <span className="brick-count">{count}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LdrViewer;