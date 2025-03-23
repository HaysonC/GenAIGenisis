"use client"

import { useRef, useEffect } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader"

const ThreeViewer = ({ modelUrl }) => {
  const containerRef = useRef(null)
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const rendererRef = useRef(null)
  const controlsRef = useRef(null)
  const modelRef = useRef(null)
  const animationFrameRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Initialize scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf5c518) // LEGO yellow background
    sceneRef.current = scene

    // Initialize camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000,
    )
    camera.position.z = 5
    cameraRef.current = camera

    // Initialize renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Add orbit controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controlsRef.current = controls

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
    directionalLight.position.set(1, 1, 1)
    directionalLight.castShadow = true
    scene.add(directionalLight)

    // Add LEGO-style grid
    const gridSize = 20
    const gridDivisions = 20
    const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0xd01012, 0x8d1b1b)
    gridHelper.position.y = -2
    scene.add(gridHelper)

    // Add LEGO base plate
    const basePlateGeometry = new THREE.BoxGeometry(15, 0.5, 15)
    const basePlateMaterial = new THREE.MeshStandardMaterial({
      color: 0xd01012, // LEGO red
      roughness: 0.3,
      metalness: 0.2,
    })
    const basePlate = new THREE.Mesh(basePlateGeometry, basePlateMaterial)
    basePlate.position.y = -2.25
    basePlate.receiveShadow = true
    scene.add(basePlate)

    // Add LEGO studs to base plate
    const studGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16)
    const studMaterial = new THREE.MeshStandardMaterial({
      color: 0xd01012, // LEGO red
      roughness: 0.3,
      metalness: 0.2,
    })

    for (let x = -6; x <= 6; x += 1.5) {
      for (let z = -6; z <= 6; z += 1.5) {
        const stud = new THREE.Mesh(studGeometry, studMaterial)
        stud.position.set(x, -2, z)
        stud.castShadow = true
        stud.receiveShadow = true
        scene.add(stud)
      }
    }

    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate)
      controls.update()

      // Rotate the model slightly for a more dynamic presentation
      if (modelRef.current) {
        modelRef.current.rotation.y += 0.002
      }

      renderer.render(scene, camera)
    }
    animate()

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current) return

      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(containerRef.current.clientWidth / containerRef.current.clientHeight)
    }
    window.addEventListener("resize", handleResize)

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize)
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement)
      }
      if (modelRef.current) {
        scene.remove(modelRef.current)
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!modelUrl || !sceneRef.current) return

    // Clear previous model
    if (modelRef.current) {
      sceneRef.current.remove(modelRef.current)
      modelRef.current = null
    }

    // Load new model
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.5/")

    const loader = new GLTFLoader()
    loader.setDRACOLoader(dracoLoader)

    // Add loading animation
    const loadingManager = new THREE.LoadingManager()

    loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
      const progress = (itemsLoaded / itemsTotal) * 100
      console.log(`Loading model: ${progress.toFixed(2)}% loaded`)
    }

    // This line is causing the error - loader.setManager is not a function
    // loader.setManager(loadingManager)

    // Instead, create a new GLTFLoader with the loadingManager
    const gltfLoader = new GLTFLoader(loadingManager)
    gltfLoader.setDRACOLoader(dracoLoader)

    gltfLoader.load(
      modelUrl,
      (gltf) => {
        const model = gltf.scene

        // Apply LEGO-like material to the model
        model.traverse((child) => {
          if (child.isMesh) {
            // Create a random LEGO color
            const legoColors = [
              0xd01012, // red
              0xf5c518, // yellow
              0x0d69ab, // blue
              0x00852b, // green
              0x05131d, // black
              0xffffff, // white
            ]

            const randomColor = legoColors[Math.floor(Math.random() * legoColors.length)]

            child.material = new THREE.MeshStandardMaterial({
              color: randomColor,
              roughness: 0.3,
              metalness: 0.2,
            })

            child.castShadow = true
            child.receiveShadow = true
          }
        })

        // Center model
        const box = new THREE.Box3().setFromObject(model)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())

        model.position.x = -center.x
        model.position.y = -center.y
        model.position.z = -center.z

        // Add a small animation to make it appear like it's being built
        model.scale.set(0.01, 0.01, 0.01)

        // Animate the model scaling up
        const scaleUp = () => {
          if (model.scale.x < 1) {
            model.scale.x += 0.02
            model.scale.y += 0.02
            model.scale.z += 0.02
            setTimeout(scaleUp, 20)
          }
        }

        scaleUp()

        // Adjust camera
        const maxDim = Math.max(size.x, size.y, size.z)
        const fov = cameraRef.current.fov * (Math.PI / 180)
        let cameraDistance = maxDim / (2 * Math.tan(fov / 2))

        // Add some margin
        cameraDistance *= 1.5

        cameraRef.current.position.z = cameraDistance
        const orbitTarget = new THREE.Vector3(0, 0, 0)
        controlsRef.current.target.copy(orbitTarget)
        controlsRef.current.update()

        sceneRef.current.add(model)
        modelRef.current = model
      },
      (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + "% loaded")
      },
      (error) => {
        console.error("Error loading model:", error)
      },
    )
  }, [modelUrl])

  return <div ref={containerRef} style={{ width: "100%", height: "400px", borderRadius: "8px" }} />
}

export default ThreeViewer

