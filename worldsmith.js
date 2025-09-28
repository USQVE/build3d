import * as THREE from 'three';
import { PlayerController, ThirdPersonCameraController, FirstPersonCameraController } from './rosieControls.js';
import { ObjectCreator } from './objectCreator.js';
import { WorldData } from './worldData.js';
import { HistoryManager } from './historyManager.js';
import { AIAgent } from './aiAgent.js';

export class Worldsmith {
  constructor() {
    // Core Three.js components
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = new THREE.Clock();
    
    // Game systems
    this.player = null;
    this.playerController = null;
    this.thirdPersonController = null;
    this.firstPersonController = null;
    this.currentCameraMode = 'third-person';
    
    // World management
    this.createdObjects = [];
    this.selectedObject = null;
    this.objectCreator = null;
    this.worldData = new WorldData();
    this.historyManager = null;
    this.aiAgent = null;
    
    // Asset management
    this.assetLoader = new THREE.GLTFLoader();
    this.loadedAssets = new Map();
    
    // UI state
    this.isImmersiveMode = false;
    this.showHUD = true;
    this.showCommandPalette = false;
    this.currentCategory = 'environment';
    
    // Performance tracking
    this.performanceStats = {
      fps: 0,
      frameCount: 0,
      lastTime: 0,
      triangleCount: 0
    };
    
    // Interaction system
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.isDragging = false;
    this.dragOffset = new THREE.Vector3();
    
    // Environment system
    this.environmentSettings = {
      timeOfDay: 'day',
      weather: 'clear',
      ambientIntensity: 0.4,
      sunIntensity: 1.0,
      fogEnabled: false,
      fogDensity: 0.01
    };
    
    // Lighting system
    this.lights = {
      ambient: null,
      directional: null,
      hemisphere: null
    };
    
    // Physics simulation (basic)
    this.physicsEnabled = false;
    this.gravity = new THREE.Vector3(0, -9.81, 0);
    
    // Audio system
    this.audioListener = null;
    this.audioLoader = new THREE.AudioLoader();
    this.sounds = new Map();
    
    // Particle system
    this.particleSystems = [];
    
    // Animation system
    this.animationMixers = [];
    
    // Terrain system
    this.terrain = null;
    this.terrainSize = 200;
    
    // Water system
    this.waterBodies = [];
    
    // Weather system
    this.weatherSystem = null;
    
    // Day/night cycle
    this.dayNightCycle = {
      enabled: false,
      speed: 1.0,
      currentTime: 12.0 // 12:00 noon
    };
    
    // Screenshot system
    this.screenshotMode = false;
    
    // Recording system
    this.isRecording = false;
    this.recordingStartTime = 0;
    
    // Minimap system
    this.minimapEnabled = false;
    this.minimapCamera = null;
    this.minimapRenderer = null;
    
    // Grid system
    this.gridHelper = null;
    this.showGrid = false;
    
    // Measurement tools
    this.measurementMode = false;
    this.measurementPoints = [];
    
    // Building system
    this.buildingMode = false;
    this.snapToGrid = false;
    this.gridSize = 1;
    
    // Material library
    this.materials = new Map();
    this.initializeMaterials();
    
    // Prefab system
    this.prefabs = new Map();
    this.initializePrefabs();
    
    // Save/Load system
    this.autoSaveEnabled = true;
    this.autoSaveInterval = 300000; // 5 minutes
    this.lastAutoSave = 0;
  }

  async init() {
    await this.initializeRenderer();
    await this.initializeScene();
    await this.initializeLighting();
    await this.initializePlayer();
    await this.initializeCameras();
    await this.initializeAudio();
    await this.initializeTerrain();
    await this.loadAssets();
    await this.initializeUI();
    await this.initializePhysics();
    await this.initializeWeather();
    await this.initializeParticles();
    await this.initializeMinimap();
    
    // Initialize game systems
    this.objectCreator = new ObjectCreator(this.scene, this.assetLoader, this.loadedAssets);
    this.historyManager = new HistoryManager(this);
    this.aiAgent = new AIAgent(this);
    
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
    
    console.log('Worldsmith initialized successfully');
  }

  async initializeRenderer() {
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      preserveDrawingBuffer: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    
    document.getElementById('gameContainer').appendChild(this.renderer.domElement);
  }

  async initializeScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
    
    // Add fog for atmosphere
    this.scene.fog = new THREE.Fog(0x87CEEB, 50, 500);
  }

  async initializeLighting() {
    // Ambient light
    this.lights.ambient = new THREE.AmbientLight(0x404040, this.environmentSettings.ambientIntensity);
    this.scene.add(this.lights.ambient);
    
    // Directional light (sun)
    this.lights.directional = new THREE.DirectionalLight(0xffffff, this.environmentSettings.sunIntensity);
    this.lights.directional.position.set(50, 100, 50);
    this.lights.directional.castShadow = true;
    this.lights.directional.shadow.mapSize.width = 2048;
    this.lights.directional.shadow.mapSize.height = 2048;
    this.lights.directional.shadow.camera.near = 0.5;
    this.lights.directional.shadow.camera.far = 500;
    this.lights.directional.shadow.camera.left = -100;
    this.lights.directional.shadow.camera.right = 100;
    this.lights.directional.shadow.camera.top = 100;
    this.lights.directional.shadow.camera.bottom = -100;
    this.scene.add(this.lights.directional);
    
    // Hemisphere light for natural lighting
    this.lights.hemisphere = new THREE.HemisphereLight(0x87CEEB, 0x362d1d, 0.3);
    this.scene.add(this.lights.hemisphere);
  }

  async initializePlayer() {
    // Create player model
    const playerGeometry = new THREE.CapsuleGeometry(0.4, 1.2, 4, 8);
    const playerMaterial = new THREE.MeshLambertMaterial({ color: 0x4a90e2 });
    this.player = new THREE.Mesh(playerGeometry, playerMaterial);
    this.player.position.set(0, 1, 0);
    this.player.castShadow = true;
    this.scene.add(this.player);
    
    // Initialize player controller
    this.playerController = new PlayerController(this.player, {
      moveSpeed: 12,
      jumpForce: 18,
      gravity: 35,
      groundLevel: 1
    });
  }

  async initializeCameras() {
    // Main camera
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // Camera controllers
    this.thirdPersonController = new ThirdPersonCameraController(
      this.camera, 
      this.player, 
      this.renderer.domElement,
      { distance: 8, height: 4, rotationSpeed: 0.004 }
    );
    
    this.firstPersonController = new FirstPersonCameraController(
      this.camera,
      this.player,
      this.renderer.domElement,
      { eyeHeight: 1.7, mouseSensitivity: 0.003 }
    );
    
    // Set initial camera mode
    this.setCameraMode('third-person');
  }

  async initializeAudio() {
    this.audioListener = new THREE.AudioListener();
    this.camera.add(this.audioListener);
    
    // Load ambient sounds
    this.loadAmbientSounds();
  }

  async initializeTerrain() {
    // Create basic terrain
    const terrainGeometry = new THREE.PlaneGeometry(this.terrainSize, this.terrainSize, 64, 64);
    const terrainMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x3a5f3a,
      transparent: true,
      opacity: 0.8
    });
    
    this.terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
    this.terrain.rotation.x = -Math.PI / 2;
    this.terrain.receiveShadow = true;
    this.terrain.userData.type = 'terrain';
    this.scene.add(this.terrain);
    
    // Add terrain variation
    this.generateTerrainHeights();
  }

  generateTerrainHeights() {
    const vertices = this.terrain.geometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i];
      const z = vertices[i + 1];
      vertices[i + 2] = Math.sin(x * 0.01) * Math.cos(z * 0.01) * 2;
    }
    this.terrain.geometry.attributes.position.needsUpdate = true;
    this.terrain.geometry.computeVertexNormals();
  }

  async loadAssets() {
    const assetPaths = {
      wizard: 'https://threejs.org/examples/models/gltf/Soldier.glb',
      dragon: 'https://threejs.org/examples/models/gltf/Horse.glb',
      ghost: 'https://threejs.org/examples/models/gltf/RobotExpressive.glb',
      cube_guy: 'https://threejs.org/examples/models/gltf/RobotExpressive.glb'
    };

    const loadPromises = Object.entries(assetPaths).map(([name, path]) => {
      return new Promise((resolve) => {
        this.assetLoader.load(path, (gltf) => {
          this.loadedAssets.set(name, gltf);
          console.log(`Loaded asset: ${name}`);
          resolve();
        }, undefined, (error) => {
          console.warn(`Failed to load asset ${name}:`, error);
          resolve();
        });
      });
    });

    await Promise.all(loadPromises);
  }

  async initializeUI() {
    this.setupCategorySystem();
    this.setupPropertiesPanel();
    this.setupCommandPalette();
    this.setupToastSystem();
    this.updateObjectCount();
  }

  async initializePhysics() {
    // Basic physics simulation
    this.physicsObjects = [];
  }

  async initializeWeather() {
    this.weatherSystem = new WeatherSystem(this.scene, this.renderer);
  }

  async initializeParticles() {
    // Initialize particle systems for effects
    this.particleManager = new ParticleManager(this.scene);
  }

  async initializeMinimap() {
    if (this.minimapEnabled) {
      this.minimapCamera = new THREE.OrthographicCamera(-50, 50, 50, -50, 1, 1000);
      this.minimapCamera.position.set(0, 100, 0);
      this.minimapCamera.lookAt(0, 0, 0);
      
      this.minimapRenderer = new THREE.WebGLRenderer({ alpha: true });
      this.minimapRenderer.setSize(200, 200);
      this.minimapRenderer.domElement.style.position = 'absolute';
      this.minimapRenderer.domElement.style.top = '20px';
      this.minimapRenderer.domElement.style.right = '20px';
      this.minimapRenderer.domElement.style.border = '2px solid white';
      this.minimapRenderer.domElement.style.borderRadius = '10px';
      document.body.appendChild(this.minimapRenderer.domElement);
    }
  }

  initializeMaterials() {
    // Create material library
    this.materials.set('wood', new THREE.MeshLambertMaterial({ color: 0x8B4513 }));
    this.materials.set('stone', new THREE.MeshLambertMaterial({ color: 0x708090 }));
    this.materials.set('metal', new THREE.MeshLambertMaterial({ color: 0xC0C0C0 }));
    this.materials.set('glass', new THREE.MeshLambertMaterial({ 
      color: 0x87CEEB, 
      transparent: true, 
      opacity: 0.3 
    }));
    this.materials.set('grass', new THREE.MeshLambertMaterial({ color: 0x228B22 }));
    this.materials.set('water', new THREE.MeshLambertMaterial({ 
      color: 0x006994, 
      transparent: true, 
      opacity: 0.7 
    }));
  }

  initializePrefabs() {
    // Initialize prefab system for complex objects
    this.prefabs.set('medieval_house', {
      name: 'Medieval House',
      description: 'A traditional medieval house with timber framing',
      components: [
        { type: 'shape', shape: 'cube', scale: [3, 2, 3], material: 'wood' },
        { type: 'shape', shape: 'pyramid', scale: [3.5, 1.5, 3.5], position: [0, 2.75, 0], material: 'wood' }
      ]
    });
    
    this.prefabs.set('castle_tower', {
      name: 'Castle Tower',
      description: 'A defensive tower with battlements',
      components: [
        { type: 'shape', shape: 'cylinder', scale: [1, 4, 1], material: 'stone' },
        { type: 'shape', shape: 'cylinder', scale: [1.2, 0.5, 1.2], position: [0, 4.25, 0], material: 'stone' }
      ]
    });
  }

  setupEventListeners() {
    // Window resize
    window.addEventListener('resize', () => this.onWindowResize());
    
    // Mouse events
    this.renderer.domElement.addEventListener('click', (e) => this.onMouseClick(e));
    this.renderer.domElement.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.renderer.domElement.addEventListener('mouseup', (e) => this.onMouseUp(e));
    
    // Touch events for mobile
    this.renderer.domElement.addEventListener('touchstart', (e) => this.onTouchStart(e));
    this.renderer.domElement.addEventListener('touchmove', (e) => this.onTouchMove(e));
    this.renderer.domElement.addEventListener('touchend', (e) => this.onTouchEnd(e));
    
    // UI events
    this.setupUIEventListeners();
  }

  setupUIEventListeners() {
    // Command input
    const commandInput = document.getElementById('commandInput');
    commandInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.executeCommand();
      }
    });
    
    // Buttons
    document.getElementById('executeBtn').addEventListener('click', () => this.executeCommand());
    document.getElementById('undoBtn').addEventListener('click', () => this.historyManager.undo());
    document.getElementById('redoBtn').addEventListener('click', () => this.historyManager.redo());
    document.getElementById('clearAllBtn').addEventListener('click', () => this.clearAll());
    
    // Category buttons
    document.querySelectorAll('.category-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchCategory(e.target.dataset.category);
      });
    });
    
    // Item buttons
    document.querySelectorAll('.item-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.createItemFromUI(e.target.dataset.category, e.target.dataset.item);
      });
    });
    
    // Quick action buttons
    document.getElementById('quickScreenshot').addEventListener('click', () => this.takeScreenshot());
    document.getElementById('quickSaveWorld').addEventListener('click', () => this.saveWorld());
    document.getElementById('quickLoadWorld').addEventListener('click', () => this.loadWorld());
    
    // UI control buttons
    document.getElementById('uiToggleBtn').addEventListener('click', () => this.toggleUI());
    document.getElementById('hudToggleBtn').addEventListener('click', () => this.toggleHUD());
    document.getElementById('screenshotBtn').addEventListener('click', () => this.takeScreenshot());
    document.getElementById('paletteBtn').addEventListener('click', () => this.toggleCommandPalette());
    
    // Edge tabs
    document.getElementById('libraryTab').addEventListener('click', () => this.toggleLibraryPanel());
    document.getElementById('propertiesTab').addEventListener('click', () => this.togglePropertiesPanel());
    
    // Command palette
    document.querySelectorAll('.palette-item').forEach(item => {
      item.addEventListener('click', (e) => {
        this.executePaletteAction(e.currentTarget.dataset.action);
      });
    });
    
    // Properties panel inputs
    this.setupPropertiesEventListeners();
  }

  setupPropertiesEventListeners() {
    const inputs = ['objName', 'posX', 'posY', 'posZ', 'rotX', 'rotY', 'rotZ', 'scale', 'objColor'];
    inputs.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('input', () => this.updateSelectedObjectProperties());
      }
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Prevent shortcuts when typing in input fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      
      switch(e.code) {
        case 'KeyC':
          if (e.ctrlKey) this.setCameraMode(this.currentCameraMode === 'third-person' ? 'first-person' : 'third-person');
          break;
        case 'KeyG':
          this.toggleGrid();
          break;
        case 'KeyM':
          this.toggleMinimap();
          break;
        case 'KeyP':
          this.togglePhysics();
          break;
        case 'KeyT':
          this.cycleDayNight();
          break;
        case 'KeyR':
          if (e.ctrlKey) this.startRecording();
          break;
        case 'KeyS':
          if (e.ctrlKey) {
            e.preventDefault();
            this.saveWorld();
          }
          break;
        case 'KeyO':
          if (e.ctrlKey) {
            e.preventDefault();
            this.loadWorld();
          }
          break;
        case 'KeyZ':
          if (e.ctrlKey) {
            e.preventDefault();
            this.historyManager.undo();
          }
          break;
        case 'KeyY':
          if (e.ctrlKey) {
            e.preventDefault();
            this.historyManager.redo();
          }
          break;
        case 'KeyK':
          if (e.ctrlKey) {
            e.preventDefault();
            this.toggleCommandPalette();
          }
          break;
        case 'Delete':
          if (e.ctrlKey) this.clearAll();
          break;
        case 'F1':
          e.preventDefault();
          this.toggleLibraryPanel();
          break;
        case 'F2':
          e.preventDefault();
          this.togglePropertiesPanel();
          break;
        case 'F3':
          e.preventDefault();
          this.aiAgent.enableAutonomousBehavior(!this.aiAgent.autonomousBehaviors.enabled);
          break;
        case 'F9':
          e.preventDefault();
          this.toggleHUD();
          break;
        case 'F10':
          e.preventDefault();
          this.toggleUI();
          break;
        case 'F12':
          if (e.shiftKey) {
            e.preventDefault();
            this.takeScreenshot();
          }
          break;
        case 'Escape':
          this.deselectObject();
          if (this.showCommandPalette) this.toggleCommandPalette();
          break;
      }
    });
  }

  setupCategorySystem() {
    // Category switching logic is already in setupUIEventListeners
  }

  setupPropertiesPanel() {
    // Properties panel logic is already in setupPropertiesEventListeners
  }

  setupCommandPalette() {
    // Command palette logic is already in setupUIEventListeners
  }

  setupToastSystem() {
    this.toastContainer = document.getElementById('toastContainer');
  }

  start() {
    this.animate();
    this.showToast('Worldsmith loaded! Press F1 for help.', 'success');
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    
    const deltaTime = this.clock.getDelta();
    
    this.update(deltaTime);
    this.render();
    this.updatePerformanceStats();
  }

  update(deltaTime) {
    // Update player
    const cameraRotation = this.updateCameras();
    this.playerController.update(deltaTime, cameraRotation);
    
    // Update physics
    if (this.physicsEnabled) {
      this.updatePhysics(deltaTime);
    }
    
    // Update animations
    this.animationMixers.forEach(mixer => mixer.update(deltaTime));
    
    // Update particles
    this.particleSystems.forEach(system => system.update(deltaTime));
    
    // Update weather
    if (this.weatherSystem) {
      this.weatherSystem.update(deltaTime);
    }
    
    // Update day/night cycle
    if (this.dayNightCycle.enabled) {
      this.updateDayNightCycle(deltaTime);
    }
    
    // Auto-save
    if (this.autoSaveEnabled && Date.now() - this.lastAutoSave > this.autoSaveInterval) {
      this.autoSave();
    }
    
    // AI agent autonomous behavior
    this.aiAgent.checkForAutonomousSuggestions();
  }

  updateCameras() {
    if (this.currentCameraMode === 'third-person') {
      return this.thirdPersonController.update();
    } else {
      return this.firstPersonController.update();
    }
  }

  updatePhysics(deltaTime) {
    this.physicsObjects.forEach(obj => {
      if (obj.userData.physics && obj.userData.physics.type === 'dynamic') {
        obj.userData.velocity = obj.userData.velocity || new THREE.Vector3();
        obj.userData.velocity.add(this.gravity.clone().multiplyScalar(deltaTime));
        obj.position.add(obj.userData.velocity.clone().multiplyScalar(deltaTime));
        
        // Simple ground collision
        if (obj.position.y < 1) {
          obj.position.y = 1;
          obj.userData.velocity.y = 0;
        }
      }
    });
  }

  updateDayNightCycle(deltaTime) {
    this.dayNightCycle.currentTime += this.dayNightCycle.speed * deltaTime;
    if (this.dayNightCycle.currentTime >= 24) {
      this.dayNightCycle.currentTime = 0;
    }
    
    // Update lighting based on time
    const timeNormalized = this.dayNightCycle.currentTime / 24;
    const sunAngle = timeNormalized * Math.PI * 2 - Math.PI / 2;
    
    this.lights.directional.position.x = Math.cos(sunAngle) * 100;
    this.lights.directional.position.y = Math.sin(sunAngle) * 100;
    
    // Adjust light intensity
    const intensity = Math.max(0.1, Math.sin(sunAngle));
    this.lights.directional.intensity = intensity;
    
    // Change sky color
    const skyColor = new THREE.Color();
    if (sunAngle > 0) {
      skyColor.setHSL(0.6, 0.7, 0.5 + intensity * 0.3);
    } else {
      skyColor.setHSL(0.7, 0.9, 0.1);
    }
    this.scene.background = skyColor;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
    
    // Render minimap
    if (this.minimapEnabled && this.minimapRenderer) {
      this.minimapCamera.position.x = this.player.position.x;
      this.minimapCamera.position.z = this.player.position.z;
      this.minimapRenderer.render(this.scene, this.minimapCamera);
    }
  }

  updatePerformanceStats() {
    this.performanceStats.frameCount++;
    const now = performance.now();
    
    if (now - this.performanceStats.lastTime >= 1000) {
      this.performanceStats.fps = this.performanceStats.frameCount;
      this.performanceStats.frameCount = 0;
      this.performanceStats.lastTime = now;
      
      // Update triangle count
      this.performanceStats.triangleCount = this.renderer.info.render.triangles;
      
      // Update UI
      document.getElementById('fps').textContent = this.performanceStats.fps;
      document.getElementById('triangleCount').textContent = this.performanceStats.triangleCount;
    }
  }

  // Event handlers
  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  onMouseClick(event) {
    if (this.isDragging) return;
    
    this.updateMousePosition(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    const intersects = this.raycaster.intersectObjects(this.createdObjects, true);
    
    if (intersects.length > 0) {
      const clickedObject = this.getTopLevelObject(intersects[0].object);
      
      if (this.selectedObject === clickedObject) {
        // Double click - delete object
        this.deleteObject(clickedObject);
      } else {
        // Single click - select object
        this.selectObject(clickedObject);
      }
    } else {
      this.deselectObject();
    }
  }

  onMouseDown(event) {
    if (event.button !== 0) return; // Only left mouse button
    
    this.updateMousePosition(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    const intersects = this.raycaster.intersectObjects(this.createdObjects, true);
    
    if (intersects.length > 0 && this.selectedObject) {
      const clickedObject = this.getTopLevelObject(intersects[0].object);
      
      if (clickedObject === this.selectedObject) {
        this.isDragging = true;
        this.dragOffset.copy(intersects[0].point).sub(this.selectedObject.position);
        
        // Start drag transaction
        this.historyManager.startCoalescing(`Drag ${this.selectedObject.userData.name || 'Object'}`);
      }
    }
  }

  onMouseMove(event) {
    if (!this.isDragging || !this.selectedObject) return;
    
    this.updateMousePosition(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Raycast against terrain
    const terrainIntersects = this.raycaster.intersectObject(this.terrain);
    
    if (terrainIntersects.length > 0) {
      const newPosition = terrainIntersects[0].point.sub(this.dragOffset);
      
      if (this.snapToGrid) {
        newPosition.x = Math.round(newPosition.x / this.gridSize) * this.gridSize;
        newPosition.z = Math.round(newPosition.z / this.gridSize) * this.gridSize;
      }
      
      this.selectedObject.position.copy(newPosition);
      this.updatePropertiesPanel();
    }
  }

  onMouseUp(event) {
    if (this.isDragging) {
      this.isDragging = false;
      this.historyManager.stopCoalescing();
    }
  }

  onTouchStart(event) {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      this.onMouseDown({ button: 0, clientX: touch.clientX, clientY: touch.clientY });
    }
  }

  onTouchMove(event) {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      this.onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    }
  }

  onTouchEnd(event) {
    this.onMouseUp({});
  }

  updateMousePosition(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  getTopLevelObject(object) {
    let current = object;
    while (current.parent && current.parent !== this.scene) {
      current = current.parent;
    }
    return current;
  }

  // Object management
  selectObject(object) {
    this.deselectObject();
    this.selectedObject = object;
    
    // Visual feedback
    this.addSelectionOutline(object);
    
    // Update properties panel
    this.updatePropertiesPanel();
    
    this.showToast(`Selected: ${object.userData.name || 'Object'}`, 'info');
  }

  deselectObject() {
    if (this.selectedObject) {
      this.removeSelectionOutline(this.selectedObject);
      this.selectedObject = null;
      this.hidePropertiesPanel();
    }
  }

  addSelectionOutline(object) {
    // Create outline effect
    const outlineMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      side: THREE.BackSide
    });
    
    object.traverse((child) => {
      if (child.isMesh) {
        const outline = new THREE.Mesh(child.geometry, outlineMaterial);
        outline.scale.multiplyScalar(1.05);
        outline.userData.isOutline = true;
        child.add(outline);
      }
    });
  }

  removeSelectionOutline(object) {
    object.traverse((child) => {
      const outlines = child.children.filter(c => c.userData.isOutline);
      outlines.forEach(outline => child.remove(outline));
    });
  }

  deleteObject(object) {
    if (!object) return;
    
    // Record deletion for history
    const snapshot = this.historyManager.createObjectSnapshot(object);
    this.historyManager.executeGroupedAction(`Delete ${object.userData.name || 'Object'}`, () => {
      this.scene.remove(object);
      const index = this.createdObjects.indexOf(object);
      if (index > -1) {
        this.createdObjects.splice(index, 1);
      }
      
      // Dispatch event for history manager
      document.dispatchEvent(new CustomEvent('objectDeleted', {
        detail: { object, snapshot }
      }));
    });
    
    if (this.selectedObject === object) {
      this.deselectObject();
    }
    
    this.updateObjectCount();
    this.showToast('Object deleted', 'info');
  }

  // Creation methods
  executeCommand() {
    const input = document.getElementById('commandInput');
    const command = input.value.trim();
    
    if (!command) return;
    
    // Process with AI agent
    this.aiAgent.processCommand(command);
    
    input.value = '';
  }

  createFromDescription(description) {
    const obj = this.objectCreator.createFromDescription(description);
    if (obj) {
      this.createdObjects.push(obj);
      this.positionNewObject(obj);
      this.updateObjectCount();
      
      // Dispatch event for history manager
      document.dispatchEvent(new CustomEvent('objectCreated', {
        detail: { object: obj }
      }));
      
      return obj;
    }
  }

  createItemFromUI(category, item) {
    let obj;
    
    // Handle different item types
    switch(item) {
      case 'terrain':
        this.modifyTerrain();
        return;
      case 'water':
        obj = this.createWaterBody();
        break;
      case 'sky':
        this.changeSkybox();
        return;
      case 'weather':
        this.changeWeather();
        return;
      default:
        obj = this.objectCreator.createFromDescription(item);
    }
    
    if (obj) {
      this.createdObjects.push(obj);
      this.positionNewObject(obj);
      this.updateObjectCount();
      
      // Dispatch event for history manager
      document.dispatchEvent(new CustomEvent('objectCreated', {
        detail: { object: obj }
      }));
      
      this.showToast(`Created ${item}`, 'success');
    }
  }

  positionNewObject(obj) {
    // Position object in front of camera
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    
    const position = this.camera.position.clone();
    position.add(direction.multiplyScalar(10));
    position.y = Math.max(1, position.y);
    
    obj.position.copy(position);
  }

  createWaterBody() {
    const waterGeometry = new THREE.PlaneGeometry(20, 20);
    const waterMaterial = this.materials.get('water').clone();
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.5;
    water.userData.type = 'water';
    water.userData.name = 'Water Body';
    
    this.scene.add(water);
    this.waterBodies.push(water);
    
    return water;
  }

  // Environment methods
  setTimeOfDay(timeOfDay) {
    this.environmentSettings.timeOfDay = timeOfDay;
    
    switch(timeOfDay) {
      case 'dawn':
        this.scene.background = new THREE.Color(0xffa500);
        this.lights.directional.intensity = 0.6;
        this.lights.ambient.intensity = 0.3;
        break;
      case 'day':
        this.scene.background = new THREE.Color(0x87CEEB);
        this.lights.directional.intensity = 1.0;
        this.lights.ambient.intensity = 0.4;
        break;
      case 'dusk':
        this.scene.background = new THREE.Color(0xff6347);
        this.lights.directional.intensity = 0.5;
        this.lights.ambient.intensity = 0.2;
        break;
      case 'night':
        this.scene.background = new THREE.Color(0x191970);
        this.lights.directional.intensity = 0.1;
        this.lights.ambient.intensity = 0.1;
        break;
    }
  }

  addWeatherEffect(weatherType) {
    if (this.weatherSystem) {
      this.weatherSystem.setWeather(weatherType);
    }
  }

  modifyTerrain() {
    // Regenerate terrain with different parameters
    this.generateTerrainHeights();
    this.showToast('Terrain modified', 'success');
  }

  changeSkybox() {
    // Cycle through different sky colors
    const skyColors = [0x87CEEB, 0xffa500, 0xff6347, 0x191970, 0x800080];
    const currentColor = this.scene.background.getHex();
    const currentIndex = skyColors.indexOf(currentColor);
    const nextIndex = (currentIndex + 1) % skyColors.length;
    
    this.scene.background = new THREE.Color(skyColors[nextIndex]);
    this.showToast('Sky changed', 'success');
  }

  changeWeather() {
    const weatherTypes = ['clear', 'rain', 'snow', 'fog', 'storm'];
    const currentIndex = weatherTypes.indexOf(this.environmentSettings.weather);
    const nextIndex = (currentIndex + 1) % weatherTypes.length;
    
    this.environmentSettings.weather = weatherTypes[nextIndex];
    this.addWeatherEffect(this.environmentSettings.weather);
    this.showToast(`Weather: ${this.environmentSettings.weather}`, 'success');
  }

  // UI methods
  switchCategory(category) {
    this.currentCategory = category;
    
    // Update active button
    document.querySelectorAll('.category-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.category === category);
    });
    
    // Show/hide category items
    document.querySelectorAll('.category-items').forEach(items => {
      items.style.display = items.id === `${category}Items` ? 'grid' : 'none';
    });
  }

  updatePropertiesPanel() {
    const panel = document.getElementById('objectProperties');
    const placeholder = panel.previousElementSibling;
    
    if (this.selectedObject) {
      placeholder.style.display = 'none';
      panel.style.display = 'block';
      
      // Update form values
      document.getElementById('objName').value = this.selectedObject.userData.name || '';
      document.getElementById('posX').value = this.selectedObject.position.x.toFixed(2);
      document.getElementById('posY').value = this.selectedObject.position.y.toFixed(2);
      document.getElementById('posZ').value = this.selectedObject.position.z.toFixed(2);
      document.getElementById('rotX').value = THREE.MathUtils.radToDeg(this.selectedObject.rotation.x).toFixed(0);
      document.getElementById('rotY').value = THREE.MathUtils.radToDeg(this.selectedObject.rotation.y).toFixed(0);
      document.getElementById('rotZ').value = THREE.MathUtils.radToDeg(this.selectedObject.rotation.z).toFixed(0);
      document.getElementById('scale').value = this.selectedObject.scale.x.toFixed(2);
      
      if (this.selectedObject.material && this.selectedObject.material.color) {
        document.getElementById('objColor').value = '#' + this.selectedObject.material.color.getHexString();
      }
    }
  }

  hidePropertiesPanel() {
    const panel = document.getElementById('objectProperties');
    const placeholder = panel.previousElementSibling;
    
    panel.style.display = 'none';
    placeholder.style.display = 'block';
  }

  updateSelectedObjectProperties() {
    if (!this.selectedObject) return;
    
    const name = document.getElementById('objName').value;
    const posX = parseFloat(document.getElementById('posX').value) || 0;
    const posY = parseFloat(document.getElementById('posY').value) || 0;
    const posZ = parseFloat(document.getElementById('posZ').value) || 0;
    const rotX = THREE.MathUtils.degToRad(parseFloat(document.getElementById('rotX').value) || 0);
    const rotY = THREE.MathUtils.degToRad(parseFloat(document.getElementById('rotY').value) || 0);
    const rotZ = THREE.MathUtils.degToRad(parseFloat(document.getElementById('rotZ').value) || 0);
    const scale = parseFloat(document.getElementById('scale').value) || 1;
    const color = document.getElementById('objColor').value;
    
    // Update object properties
    this.selectedObject.userData.name = name;
    this.selectedObject.position.set(posX, posY, posZ);
    this.selectedObject.rotation.set(rotX, rotY, rotZ);
    this.selectedObject.scale.setScalar(scale);
    
    if (this.selectedObject.material && this.selectedObject.material.color) {
      this.selectedObject.material.color.setHex(color.replace('#', '0x'));
    }
  }

  updateObjectCount() {
    document.getElementById('objectCount').textContent = this.createdObjects.length;
  }

  // Camera methods
  setCameraMode(mode) {
    if (mode === this.currentCameraMode) return;
    
    // Disable current controller
    if (this.currentCameraMode === 'third-person') {
      this.thirdPersonController.disable();
    } else {
      this.firstPersonController.disable();
    }
    
    this.currentCameraMode = mode;
    this.playerController.setCameraMode(mode);
    
    // Enable new controller
    if (mode === 'third-person') {
      this.thirdPersonController.enable();
    } else {
      // Sync rotation before enabling first-person
      this.firstPersonController.rotationY = this.thirdPersonController.rotation;
      this.firstPersonController.enable();
    }
    
    this.showToast(`Camera: ${mode}`, 'info');
  }

  // Utility methods
  toggleUI() {
    this.isImmersiveMode = !this.isImmersiveMode;
    document.body.classList.toggle('immersive-mode', this.isImmersiveMode);
    
    const uiControls = document.getElementById('uiControls');
    uiControls.classList.toggle('show', this.isImmersiveMode);
    
    this.showToast(`UI: ${this.isImmersiveMode ? 'Immersive' : 'Full'}`, 'info');
  }

  toggleHUD() {
    this.showHUD = !this.showHUD;
    document.body.classList.toggle('hide-hud', !this.showHUD);
    this.showToast(`HUD: ${this.showHUD ? 'On' : 'Off'}`, 'info');
  }

  toggleGrid() {
    this.showGrid = !this.showGrid;
    
    if (this.showGrid) {
      if (!this.gridHelper) {
        this.gridHelper = new THREE.GridHelper(100, 100, 0x444444, 0x444444);
        this.gridHelper.position.y = 0.01;
      }
      this.scene.add(this.gridHelper);
    } else {
      if (this.gridHelper) {
        this.scene.remove(this.gridHelper);
      }
    }
    
    this.showToast(`Grid: ${this.showGrid ? 'On' : 'Off'}`, 'info');
  }

  toggleMinimap() {
    this.minimapEnabled = !this.minimapEnabled;
    
    if (this.minimapEnabled) {
      this.initializeMinimap();
    } else {
      if (this.minimapRenderer && this.minimapRenderer.domElement) {
        document.body.removeChild(this.minimapRenderer.domElement);
        this.minimapRenderer = null;
      }
    }
    
    this.showToast(`Minimap: ${this.minimapEnabled ? 'On' : 'Off'}`, 'info');
  }

  togglePhysics() {
    this.physicsEnabled = !this.physicsEnabled;
    this.showToast(`Physics: ${this.physicsEnabled ? 'On' : 'Off'}`, 'info');
  }

  cycleDayNight() {
    const times = ['dawn', 'day', 'dusk', 'night'];
    const currentIndex = times.indexOf(this.environmentSettings.timeOfDay);
    const nextIndex = (currentIndex + 1) % times.length;
    this.setTimeOfDay(times[nextIndex]);
    this.showToast(`Time: ${times[nextIndex]}`, 'info');
  }

  toggleCommandPalette() {
    this.showCommandPalette = !this.showCommandPalette;
    const palette = document.getElementById('commandPalette');
    palette.classList.toggle('show', this.showCommandPalette);
  }

  toggleLibraryPanel() {
    const panel = document.getElementById('libraryPanel');
    panel.classList.toggle('force-show');
  }

  togglePropertiesPanel() {
    const panel = document.getElementById('propertiesPanel');
    panel.classList.toggle('force-show');
  }

  executePaletteAction(action) {
    this.toggleCommandPalette();
    
    switch(action) {
      case 'screenshot':
        this.takeScreenshot();
        break;
      case 'save':
        this.saveWorld();
        break;
      case 'load':
        this.loadWorld();
        break;
      case 'toggle-ui':
        this.toggleUI();
        break;
      case 'toggle-hud':
        this.toggleHUD();
        break;
      case 'clear-all':
        this.clearAll();
        break;
      case 'ai-help':
        this.showAIHelp();
        break;
      case 'toggle-ai-suggestions':
        this.aiAgent.enableAutonomousBehavior(!this.aiAgent.autonomousBehaviors.enabled);
        break;
      case 'undo':
        this.historyManager.undo();
        break;
      case 'redo':
        this.historyManager.redo();
        break;
    }
  }

  // Screenshot and recording
  takeScreenshot() {
    this.screenshotMode = true;
    document.body.classList.add('screenshot-mode');
    
    setTimeout(() => {
      const canvas = this.renderer.domElement;
      const link = document.createElement('a');
      link.download = `worldsmith_screenshot_${Date.now()}.png`;
      link.href = canvas.toDataURL();
      link.click();
      
      this.screenshotMode = false;
      document.body.classList.remove('screenshot-mode');
      this.showToast('Screenshot saved!', 'success');
    }, 100);
  }

  startRecording() {
    if (this.isRecording) {
      this.stopRecording();
      return;
    }
    
    this.isRecording = true;
    this.recordingStartTime = Date.now();
    
    const widget = document.getElementById('recordingWidget');
    widget.classList.add('show');
    
    this.recordingTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
      const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const seconds = (elapsed % 60).toString().padStart(2, '0');
      document.getElementById('recordingTime').textContent = `${minutes}:${seconds}`;
    }, 1000);
    
    this.showToast('Recording started', 'success');
  }

  stopRecording() {
    this.isRecording = false;
    
    const widget = document.getElementById('recordingWidget');
    widget.classList.remove('show');
    
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }
    
    this.showToast('Recording stopped', 'info');
  }

  // Save/Load system
  saveWorld() {
    const historyData = this.historyManager.serializeHistory();
    const worldData = this.worldData.saveWorld(this.createdObjects, historyData);
    this.showToast('World saved!', 'success');
    this.lastAutoSave = Date.now();
  }

  loadWorld() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        this.worldData.loadWorld(file, this.objectCreator, this.scene, this.createdObjects)
          .then((worldData) => {
            // Restore history if available
            if (worldData.historyData) {
              this.historyManager.deserializeHistory(worldData.historyData);
            }
            
            this.updateObjectCount();
            this.showToast('World loaded!', 'success');
          })
          .catch((error) => {
            this.showToast('Failed to load world', 'warning');
            console.error(error);
          });
      }
    };
    
    input.click();
  }

  autoSave() {
    if (this.createdObjects.length > 0) {
      const historyData = this.historyManager.serializeHistory();
      const worldData = {
        name: 'AutoSave',
        version: this.worldData.version,
        timestamp: new Date().toISOString(),
        objects: this.createdObjects.map(obj => ({
          type: obj.userData.type || 'unknown',
          position: obj.position.clone(),
          rotation: obj.rotation.clone(),
          scale: obj.scale.clone(),
          userData: obj.userData
        })),
        historyData: historyData
      };
      
      localStorage.setItem('worldsmith_autosave', JSON.stringify(worldData));
      this.lastAutoSave = Date.now();
      this.showToast('Auto-saved', 'info');
    }
  }

  clearAll() {
    if (this.createdObjects.length === 0) return;
    
    if (confirm('Are you sure you want to clear all objects?')) {
      this.historyManager.executeGroupedAction('Clear All Objects', () => {
        this.createdObjects.forEach(obj => {
          this.scene.remove(obj);
        });
        this.createdObjects.length = 0;
      });
      
      this.deselectObject();
      this.updateObjectCount();
      this.showToast('All objects cleared', 'info');
    }
  }

  // AI and help
  showAIHelp() {
    const helpMessage = `
🤖 AI Assistant Help:

• Natural Language: "create a red house", "build a bridge 20m long"
• Voice Commands: Use your microphone to speak commands
• Smart Suggestions: I'll offer helpful tips as you build
• Context Aware: I remember what you've created
• Undo/Redo: I group my actions for easy undoing

Try saying: "build a medieval village" or "add a forest on the north side"
    `;
    
    this.showRosieResponse(helpMessage);
  }

  showRosieResponse(message) {
    const responseDiv = document.getElementById('rosieResponse');
    responseDiv.textContent = message;
    responseDiv.style.display = 'block';
    
    setTimeout(() => {
      responseDiv.style.display = 'none';
    }, 10000);
  }

  // Toast notifications
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    this.toastContainer.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 100);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  // Audio system
  loadAmbientSounds() {
    const soundPaths = {
      ambient_forest: '/sounds/forest.mp3',
      ambient_water: '/sounds/water.mp3',
      ambient_wind: '/sounds/wind.mp3'
    };
    
    Object.entries(soundPaths).forEach(([name, path]) => {
      this.audioLoader.load(path, (buffer) => {
        const sound = new THREE.Audio(this.audioListener);
        sound.setBuffer(buffer);
        sound.setLoop(true);
        sound.setVolume(0.3);
        this.sounds.set(name, sound);
      }, undefined, (error) => {
        console.warn(`Failed to load sound ${name}:`, error);
      });
    });
  }

  playAmbientSound(soundName) {
    const sound = this.sounds.get(soundName);
    if (sound && !sound.isPlaying) {
      sound.play();
    }
  }

  stopAmbientSound(soundName) {
    const sound = this.sounds.get(soundName);
    if (sound && sound.isPlaying) {
      sound.stop();
    }
  }

  // Natural language processing (enhanced)
  parseNaturalLanguage(input) {
    const command = input.toLowerCase().trim();
    
    // Enhanced parsing with more patterns
    if (command.includes('create') || command.includes('make') || command.includes('build') || command.includes('add')) {
      this.handleCreateCommand(command);
    } else if (command.includes('delete') || command.includes('remove') || command.includes('destroy')) {
      this.handleDeleteCommand(command);
    } else if (command.includes('move') || command.includes('position')) {
      this.handleMoveCommand(command);
    } else if (command.includes('color') || command.includes('paint')) {
      this.handleColorCommand(command);
    } else if (command.includes('scale') || command.includes('size') || command.includes('resize')) {
      this.handleScaleCommand(command);
    } else if (command.includes('rotate') || command.includes('turn')) {
      this.handleRotateCommand(command);
    } else if (command.includes('duplicate') || command.includes('copy') || command.includes('clone')) {
      this.handleDuplicateCommand(command);
    } else if (command.includes('save') || command.includes('export')) {
      this.saveWorld();
    } else if (command.includes('load') || command.includes('import')) {
      this.loadWorld();
    } else if (command.includes('clear') || command.includes('reset')) {
      this.clearAll();
    } else if (command.includes('help')) {
      this.showAIHelp();
    } else {
      // Fallback to object creation
      this.createFromDescription(command);
    }
  }

  handleCreateCommand(command) {
    // Extract object description
    const createWords = ['create', 'make', 'build', 'add', 'spawn', 'place'];
    let description = command;
    
    createWords.forEach(word => {
      const index = description.indexOf(word);
      if (index !== -1) {
        description = description.substring(index + word.length).trim();
      }
    });
    
    if (description) {
      this.createFromDescription(description);
    }
  }

  handleDeleteCommand(command) {
    if (this.selectedObject) {
      this.deleteObject(this.selectedObject);
    } else {
      this.showToast('Please select an object to delete', 'warning');
    }
  }

  handleMoveCommand(command) {
    if (!this.selectedObject) {
      this.showToast('Please select an object to move', 'warning');
      return;
    }
    
    // Extract direction and distance
    const directions = {
      'left': new THREE.Vector3(-1, 0, 0),
      'right': new THREE.Vector3(1, 0, 0),
      'forward': new THREE.Vector3(0, 0, -1),
      'backward': new THREE.Vector3(0, 0, 1),
      'up': new THREE.Vector3(0, 1, 0),
      'down': new THREE.Vector3(0, -1, 0)
    };
    
    let direction = new THREE.Vector3();
    let distance = 5;
    
    // Find direction
    Object.entries(directions).forEach(([word, vec]) => {
      if (command.includes(word)) {
        direction.add(vec);
      }
    });
    
    // Find distance
    const distanceMatch = command.match(/(\d+)\s*(m|meter|unit)/);
    if (distanceMatch) {
      distance = parseInt(distanceMatch[1]);
    }
    
    if (direction.length() > 0) {
      direction.normalize().multiplyScalar(distance);
      this.selectedObject.position.add(direction);
      this.updatePropertiesPanel();
      this.showToast(`Moved object ${distance} units`, 'success');
    }
  }

  handleColorCommand(command) {
    if (!this.selectedObject || !this.selectedObject.material) {
      this.showToast('Please select an object to color', 'warning');
      return;
    }
    
    const colors = {
      'red': 0xff0000, 'blue': 0x0000ff, 'green': 0x00ff00,
      'yellow': 0xffff00, 'purple': 0x8000ff, 'orange': 0xff8000,
      'pink': 0xff69b4, 'black': 0x333333, 'white': 0xffffff,
      'brown': 0x8B4513, 'gray': 0x808080, 'gold': 0xffd700
    };
    
    Object.entries(colors).forEach(([colorName, colorValue]) => {
      if (command.includes(colorName)) {
        this.selectedObject.material.color.setHex(colorValue);
        this.updatePropertiesPanel();
        this.showToast(`Changed color to ${colorName}`, 'success');
      }
    });
  }

  handleScaleCommand(command) {
    if (!this.selectedObject) {
      this.showToast('Please select an object to scale', 'warning');
      return;
    }
    
    let scale = 1;
    
    if (command.includes('bigger') || command.includes('larger')) {
      scale = 1.5;
    } else if (command.includes('smaller') || command.includes('tiny')) {
      scale = 0.7;
    } else if (command.includes('huge') || command.includes('giant')) {
      scale = 3;
    }
    
    // Look for specific scale values
    const scaleMatch = command.match(/(\d+\.?\d*)\s*(times|x)/);
    if (scaleMatch) {
      scale = parseFloat(scaleMatch[1]);
    }
    
    this.selectedObject.scale.multiplyScalar(scale);
    this.updatePropertiesPanel();
    this.showToast(`Scaled object by ${scale}x`, 'success');
  }

  handleRotateCommand(command) {
    if (!this.selectedObject) {
      this.showToast('Please select an object to rotate', 'warning');
      return;
    }
    
    let angle = Math.PI / 4; // 45 degrees default
    
    // Look for specific angles
    const angleMatch = command.match(/(\d+)\s*degrees?/);
    if (angleMatch) {
      angle = THREE.MathUtils.degToRad(parseInt(angleMatch[1]));
    }
    
    if (command.includes('left')) {
      this.selectedObject.rotation.y -= angle;
    } else if (command.includes('right')) {
      this.selectedObject.rotation.y += angle;
    } else {
      this.selectedObject.rotation.y += angle;
    }
    
    this.updatePropertiesPanel();
    this.showToast('Rotated object', 'success');
  }

  handleDuplicateCommand(command) {
    if (!this.selectedObject) {
      this.showToast('Please select an object to duplicate', 'warning');
      return;
    }
    
    const clone = this.selectedObject.clone();
    clone.position.x += 3;
    
    this.scene.add(clone);
    this.createdObjects.push(clone);
    this.updateObjectCount();
    
    this.showToast('Object duplicated', 'success');
  }

  // Lifecycle methods
  pause() {
    // Pause game systems
    this.clock.stop();
  }

  resume() {
    // Resume game systems
    this.clock.start();
  }

  destroy() {
    // Cleanup
    if (this.playerController) {
      this.playerController.destroy();
    }
    
    if (this.minimapRenderer) {
      document.body.removeChild(this.minimapRenderer.domElement);
    }
    
    // Stop any running timers
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
    }
    
    // Dispose of Three.js resources
    this.scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
    
    this.renderer.dispose();
  }
}

// Weather System
class WeatherSystem {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.currentWeather = 'clear';
    this.particles = null;
  }

  setWeather(weatherType) {
    this.clearWeather();
    this.currentWeather = weatherType;
    
    switch(weatherType) {
      case 'rain':
        this.createRain();
        break;
      case 'snow':
        this.createSnow();
        break;
      case 'fog':
        this.createFog();
        break;
      case 'storm':
        this.createStorm();
        break;
    }
  }

  createRain() {
    const particleCount = 1000;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 200;
      positions[i + 1] = Math.random() * 100;
      positions[i + 2] = (Math.random() - 0.5) * 200;
    }
    
    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
      color: 0x87CEEB,
      size: 0.5,
      transparent: true,
      opacity: 0.6
    });
    
    this.particles = new THREE.Points(particles, material);
    this.scene.add(this.particles);
  }

  createSnow() {
    const particleCount = 500;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 200;
      positions[i + 1] = Math.random() * 100;
      positions[i + 2] = (Math.random() - 0.5) * 200;
    }
    
    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2,
      transparent: true,
      opacity: 0.8
    });
    
    this.particles = new THREE.Points(particles, material);
    this.scene.add(this.particles);
  }

  createFog() {
    this.scene.fog = new THREE.Fog(0xcccccc, 10, 100);
  }

  createStorm() {
    this.createRain();
    // Add lightning effects, darker sky, etc.
  }

  clearWeather() {
    if (this.particles) {
      this.scene.remove(this.particles);
      this.particles = null;
    }
    this.scene.fog = new THREE.Fog(0x87CEEB, 50, 500);
  }

  update(deltaTime) {
    if (this.particles) {
      const positions = this.particles.geometry.attributes.position.array;
      
      for (let i = 1; i < positions.length; i += 3) {
        positions[i] -= 50 * deltaTime; // Fall speed
        
        if (positions[i] < 0) {
          positions[i] = 100;
        }
      }
      
      this.particles.geometry.attributes.position.needsUpdate = true;
    }
  }
}

// Particle Manager
class ParticleManager {
  constructor(scene) {
    this.scene = scene;
    this.systems = [];
  }

  createFireEffect(position) {
    // Create fire particle system
    const particleCount = 100;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      positions[i3] = position.x + (Math.random() - 0.5) * 2;
      positions[i3 + 1] = position.y;
      positions[i3 + 2] = position.z + (Math.random() - 0.5) * 2;
      
      colors[i3] = 1; // Red
      colors[i3 + 1] = Math.random() * 0.5; // Green
      colors[i3 + 2] = 0; // Blue
    }
    
    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const material = new THREE.PointsMaterial({
      size: 0.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.8
    });
    
    const system = new THREE.Points(particles, material);
    this.scene.add(system);
    this.systems.push(system);
    
    return system;
  }

  createMagicEffect(position) {
    // Create magical sparkle effect
    const particleCount = 50;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const radius = Math.random() * 3;
      const angle = Math.random() * Math.PI * 2;
      
      positions[i3] = position.x + Math.cos(angle) * radius;
      positions[i3 + 1] = position.y + Math.random() * 5;
      positions[i3 + 2] = position.z + Math.sin(angle) * radius;
    }
    
    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
      color: 0x8000ff,
      size: 1,
      transparent: true,
      opacity: 0.9
    });
    
    const system = new THREE.Points(particles, material);
    this.scene.add(system);
    this.systems.push(system);
    
    return system;
  }

  update(deltaTime) {
    this.systems.forEach(system => {
      // Update particle positions
      const positions = system.geometry.attributes.position.array;
      
      for (let i = 1; i < positions.length; i += 3) {
        positions[i] += 10 * deltaTime; // Rise up
      }
      
      system.geometry.attributes.position.needsUpdate = true;
    });
  }
}