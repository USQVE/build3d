import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ObjectCreator } from './objectCreator.js';
import { WorldData } from './worldData.js';
import { HistoryManager } from './historyManager.js';
import { AIAgent } from './aiAgent.js';
import { PlayerController, ThirdPersonCameraController, FirstPersonCameraController } from './rosieControls.js';

export class Worldsmith {
  constructor() {
    // Core systems
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = new THREE.Clock();
    
    // Performance & timing
    this.isRunning = false;
    this.isPaused = false;
    this.lastTime = 0;
    this.accumulator = 0;
    this.fixedTimeStep = 1/60; // 60 Hz physics
    this.maxDeltaTime = 1/20; // Clamp to 50ms max
    this.rafId = null;
    
    // Performance monitoring
    this.frameCount = 0;
    this.lastFPSUpdate = 0;
    this.currentFPS = 60;
    this.lowFPSCounter = 0;
    this.autoLowSpecThreshold = 45;
    this.autoLowSpecDuration = 5000; // 5 seconds
    
    // Graphics settings
    this.graphicsPreset = 'medium'; // low, medium, high
    this.renderScale = 1.0;
    this.shadowMapSize = 1024;
    this.enableSSAO = false;
    this.enableMSAA = true;
    
    // Game objects
    this.createdObjects = [];
    this.selectedObject = null;
    this.player = null;
    this.ground = null;
    
    // Systems
    this.objectCreator = null;
    this.worldData = null;
    this.historyManager = null;
    this.aiAgent = null;
    
    // Controls
    this.playerController = null;
    this.thirdPersonController = null;
    this.firstPersonController = null;
    this.cameraMode = 'third-person';
    
    // Assets
    this.assetLoader = new GLTFLoader();
    this.loadedAssets = new Map();
    
    // UI state
    this.isImmersiveMode = false;
    this.showHUD = true;
    this.showCommandBar = false;
    this.commandBarTimer = null;
    this.commandBarAutoHideDelay = 6000;
    
    // Input handling
    this.keys = {};
    this.isInputFocused = false;
    this.isUIFocused = false;
    this.lastCommandTime = 0;
    this.commandDebounceDelay = 300;
    this.commandQueue = [];
    this.isExecutingCommand = false;
    
    // Environment
    this.timeOfDay = 0.5; // 0 = midnight, 0.5 = noon, 1 = midnight
    this.weather = 'clear';
    this.ambientLight = null;
    this.directionalLight = null;
    
    // Terrain & Lighting settings
    this.terrainSettings = {
      brightness: 1.15,
      contrast: 1.0,
      saturation: 1.0,
      albedoTint: 0xffffff,
      roughness: 0.8,
      normalStrength: 1.0
    };
    
    this.lightingSettings = {
      sunIntensity: 1.2,
      sunElevation: 45,
      ambientIntensity: 0.6,
      exposure: 1.25,
      fogColor: 0x87CEEB,
      fogDensity: 0.002
    };
    
    // Terrain editing
    this.terrainEditor = {
      enabled: false,
      brushSize: 5,
      brushStrength: 0.5,
      brushHardness: 0.8,
      currentTool: 'raise', // raise, lower, smooth, flatten, paint
      isEditing: false,
      editTransaction: null
    };
    
    // Physics (optional)
    this.physicsEnabled = false;
    this.physicsWorld = null;
    this.physicsAccumulator = 0;
    
    // Diagnostics
    this.diagnosticsLog = [];
    this.maxLogEntries = 10;
    this.webglContextLost = false;
    
    // Performance optimization
    this.instancedMeshes = new Map();
    this.frustumCulling = true;
    this.lodEnabled = false;
    
    this.setupEventListeners();
  }

  async init() {
    try {
      await this.initRenderer();
      await this.initScene();
      await this.initSystems();
      await this.initUI();
      await this.loadAssets();
      
      this.log('Worldsmith initialized successfully');
      this.showToast('Worldsmith ready!', 'success');
      
    } catch (error) {
      this.log(`Initialization failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async initRenderer() {
    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: this.enableMSAA && this.graphicsPreset !== 'low',
      powerPreference: 'high-performance',
      stencil: false
    });
    
    // Performance settings
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.lightingSettings.exposure;
    
    // Shadow settings based on preset
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = this.graphicsPreset === 'high' ? 
      THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    
    // WebGL context loss handling
    canvas.addEventListener('webglcontextlost', this.handleContextLost.bind(this));
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored.bind(this));
    
    this.updateRendererSize();
    document.getElementById('gameContainer').appendChild(canvas);
  }

  updateRendererSize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Clamp device pixel ratio
    const pixelRatio = Math.min(window.devicePixelRatio, 1.5);
    
    // Apply render scale for performance
    const renderWidth = Math.floor(width * this.renderScale);
    const renderHeight = Math.floor(height * this.renderScale);
    
    this.renderer.setSize(renderWidth, renderHeight, false);
    this.renderer.setPixelRatio(pixelRatio);
    
    if (this.camera) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
    
    this.log(`Renderer resized: ${renderWidth}x${renderHeight} @ ${pixelRatio}x`);
  }

  async initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog = new THREE.Fog(0x87CEEB, 50, 200);
    
    // Camera
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 5, 10);
    
    // Lighting
    this.setupLighting();
    
    // Ground
    this.createGround();
    
    // Player
    this.createPlayer();
    
    // Setup controls
    this.setupControls();
  }

  setupLighting() {
    // Ambient light
    this.ambientLight = new THREE.AmbientLight(0x404040, this.lightingSettings.ambientIntensity);
    this.scene.add(this.ambientLight);
    
    // Directional light (sun)
    this.directionalLight = new THREE.DirectionalLight(0xFFD8B0, this.lightingSettings.sunIntensity);
    this.directionalLight.position.set(50, 50, 25);
    this.directionalLight.castShadow = true;
    
    // Shadow settings based on preset
    const shadowMapSize = this.graphicsPreset === 'high' ? 2048 : 
                         this.graphicsPreset === 'medium' ? 1024 : 512;
    
    this.directionalLight.shadow.mapSize.width = shadowMapSize;
    this.directionalLight.shadow.mapSize.height = shadowMapSize;
    this.directionalLight.shadow.camera.near = 0.5;
    this.directionalLight.shadow.camera.far = 200;
    this.directionalLight.shadow.camera.left = -50;
    this.directionalLight.shadow.camera.right = 50;
    this.directionalLight.shadow.camera.top = 50;
    this.directionalLight.shadow.camera.bottom = -50;
    
    this.scene.add(this.directionalLight);
    
    // Update fog
    this.scene.fog = new THREE.Fog(this.lightingSettings.fogColor, 50, 200);
    this.scene.fog.density = this.lightingSettings.fogDensity;
    
    this.updateTimeOfDay();
  }

  createGround() {
    const groundGeometry = new THREE.PlaneGeometry(200, 200, 50, 50);
    
    // Add some height variation
    const vertices = groundGeometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
      vertices[i + 2] = Math.sin(vertices[i] * 0.1) * Math.cos(vertices[i + 1] * 0.1) * 2;
    }
    groundGeometry.attributes.position.needsUpdate = true;
    groundGeometry.computeVertexNormals();
    
    // Enhanced terrain material
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: new THREE.Color(0x90EE90).multiplyScalar(1.2), // +20% brighter
      roughness: this.terrainSettings.roughness,
      transparent: false
    });
    
    this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.ground.userData.isGround = true;
    this.ground.userData.isTerrain = true;
    this.scene.add(this.ground);
  }

  createPlayer() {
    const playerGeometry = new THREE.CapsuleGeometry(0.4, 1.2, 4, 8);
    const playerMaterial = new THREE.MeshLambertMaterial({ color: 0x4169E1 });
    
    this.player = new THREE.Mesh(playerGeometry, playerMaterial);
    this.player.position.set(0, 1, 0);
    this.player.castShadow = true;
    this.player.userData.isPlayer = true;
    this.scene.add(this.player);
  }

  setupControls() {
    const canvas = this.renderer.domElement;
    
    // Player controller
    this.playerController = new PlayerController(this.player, {
      moveSpeed: 10,
      jumpForce: 15,
      gravity: 30,
      groundLevel: 1
    });
    
    // Camera controllers
    this.thirdPersonController = new ThirdPersonCameraController(
      this.camera, this.player, canvas, {
        distance: 7,
        height: 3,
        rotationSpeed: 0.003
      }
    );
    
    this.firstPersonController = new FirstPersonCameraController(
      this.camera, this.player, canvas, {
        eyeHeight: 1.6,
        mouseSensitivity: 0.002
      }
    );
    
    this.setCameraMode('third-person');
  }

  async initSystems() {
    // Initialize core systems
    this.objectCreator = new ObjectCreator(this.scene, this.assetLoader, this.loadedAssets);
    this.worldData = new WorldData();
    this.historyManager = new HistoryManager(this);
    this.aiAgent = new AIAgent(this);
    
    this.log('Core systems initialized');
  }

  async initUI() {
    this.setupUIEventListeners();
    this.updateObjectCount();
    this.updatePerformanceStats();
    
    // Initialize UI state
    this.updateUIVisibility();
    
    this.log('UI initialized');
  }

  async loadAssets() {
    const assetPaths = {
      wizard: 'https://threejs.org/examples/models/gltf/Soldier.glb',
      dragon: 'https://threejs.org/examples/models/gltf/Soldier.glb',
      ghost: 'https://threejs.org/examples/models/gltf/Soldier.glb',
      cube_guy: 'https://threejs.org/examples/models/gltf/Soldier.glb'
    };
    
    const loadPromises = Object.entries(assetPaths).map(async ([name, path]) => {
      try {
        const gltf = await this.assetLoader.loadAsync(path);
        this.loadedAssets.set(name, gltf);
        this.log(`Loaded asset: ${name}`);
      } catch (error) {
        this.log(`Failed to load asset ${name}: ${error.message}`, 'error');
      }
    });
    
    await Promise.allSettled(loadPromises);
    this.log(`Assets loaded: ${this.loadedAssets.size}/${Object.keys(assetPaths).length}`);
  }

  setupEventListeners() {
    // Window events
    window.addEventListener('resize', this.handleResize.bind(this));
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
    
    // Page visibility
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    
    // Keyboard events
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('keyup', this.handleKeyUp.bind(this));
    
    // Mouse events
    document.addEventListener('click', this.handleClick.bind(this));
    document.addEventListener('contextmenu', this.handleContextMenu.bind(this));
  }

  setupUIEventListeners() {
    // Command input
    const commandInput = document.getElementById('commandInput');
    if (commandInput) {
      commandInput.addEventListener('focus', () => this.isInputFocused = true);
      commandInput.addEventListener('blur', () => this.isInputFocused = false);
      commandInput.addEventListener('keydown', this.handleCommandInput.bind(this));
    }
    
    // Buttons
    const executeBtn = document.getElementById('executeBtn');
    if (executeBtn) {
      executeBtn.addEventListener('click', this.handleExecuteCommand.bind(this));
    }
    
    const undoBtn = document.getElementById('undoBtn');
    if (undoBtn) {
      undoBtn.addEventListener('click', () => this.historyManager.undo());
    }
    
    const redoBtn = document.getElementById('redoBtn');
    if (redoBtn) {
      redoBtn.addEventListener('click', () => this.historyManager.redo());
    }
    
    const clearAllBtn = document.getElementById('clearAllBtn');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', this.handleClearAll.bind(this));
    }
    
    // UI controls
    const uiToggleBtn = document.getElementById('uiToggleBtn');
    if (uiToggleBtn) {
      uiToggleBtn.addEventListener('click', () => this.toggleImmersiveMode());
    }
    
    const hudToggleBtn = document.getElementById('hudToggleBtn');
    if (hudToggleBtn) {
      hudToggleBtn.addEventListener('click', () => this.toggleHUD());
    }
    
    const screenshotBtn = document.getElementById('screenshotBtn');
    if (screenshotBtn) {
      screenshotBtn.addEventListener('click', () => this.takeScreenshot());
    }
    
    // Command palette
    const paletteBtn = document.getElementById('paletteBtn');
    if (paletteBtn) {
      paletteBtn.addEventListener('click', () => this.toggleCommandPalette());
    }
    
    // Category buttons
    document.querySelectorAll('.category-btn').forEach(btn => {
      btn.addEventListener('click', this.handleCategorySelect.bind(this));
    });
    
    // Item buttons
    document.querySelectorAll('.item-btn').forEach(btn => {
      btn.addEventListener('click', this.handleItemCreate.bind(this));
    });
    
    // Quick actions
    const quickScreenshot = document.getElementById('quickScreenshot');
    if (quickScreenshot) {
      quickScreenshot.addEventListener('click', () => this.takeScreenshot());
    }
    
    const quickSaveWorld = document.getElementById('quickSaveWorld');
    if (quickSaveWorld) {
      quickSaveWorld.addEventListener('click', () => this.saveWorld());
    }
    
    const quickLoadWorld = document.getElementById('quickLoadWorld');
    if (quickLoadWorld) {
      quickLoadWorld.addEventListener('click', () => this.loadWorld());
    }
  }

  handleResize() {
    this.updateRendererSize();
  }

  handleBeforeUnload(e) {
    if (this.createdObjects.length > 0) {
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    }
  }

  handleVisibilityChange() {
    if (document.hidden) {
      this.pause();
    } else {
      this.resume();
    }
  }

  handleKeyDown(e) {
    // Check if UI is focused (inputs, command palette, etc.)
    const isCommandPaletteOpen = document.getElementById('commandPalette')?.classList.contains('show');
    const isConsoleOpen = document.getElementById('consolePanel')?.classList.contains('show');
    
    if (this.isUIFocused || isCommandPaletteOpen || isConsoleOpen) {
      // Only allow certain hotkeys when UI is focused
      if (e.ctrlKey || e.metaKey) {
        switch (e.code) {
          case 'KeyZ':
            e.preventDefault();
            if (e.shiftKey) {
              this.historyManager.redo();
            } else {
              this.historyManager.undo();
            }
            break;
          case 'KeyY':
            e.preventDefault();
            this.historyManager.redo();
            break;
          case 'KeyS':
            e.preventDefault();
            this.saveWorld();
            break;
          case 'KeyO':
            e.preventDefault();
            this.loadWorld();
            break;
          case 'KeyK':
            e.preventDefault();
            this.toggleCommandPalette();
            break;
        }
      }
      
      // Allow F9/F10 but not gameplay keys
      switch (e.code) {
        case 'F9':
          e.preventDefault();
          this.toggleHUD();
          break;
        case 'F10':
          e.preventDefault();
          this.toggleImmersiveMode();
          break;
        case 'Escape':
          e.preventDefault();
          this.handleEscape();
          break;
      }
      
      // Don't set gameplay keys when UI is focused
      return;
    }
    
    // Normal gameplay key handling
    this.keys[e.code] = true;
    
    // Prevent browser defaults for our shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.code) {
        case 'KeyZ':
          e.preventDefault();
          if (e.shiftKey) {
            this.historyManager.redo();
          } else {
            this.historyManager.undo();
          }
          break;
        case 'KeyY':
          e.preventDefault();
          this.historyManager.redo();
          break;
        case 'KeyS':
          e.preventDefault();
          this.saveWorld();
          break;
        case 'KeyO':
          e.preventDefault();
          this.loadWorld();
          break;
        case 'KeyK':
          e.preventDefault();
          this.toggleCommandPalette();
          break;
        case 'Delete':
          e.preventDefault();
          this.clearAll();
          break;
      }
    }
    
    // Function keys
    switch (e.code) {
      case 'F9':
        e.preventDefault();
        this.toggleHUD();
        break;
      case 'F10':
        e.preventDefault();
        this.toggleImmersiveMode();
        break;
      case 'F12':
        if (e.shiftKey) {
          e.preventDefault();
          this.takeScreenshot();
        }
        break;
      case 'Escape':
        e.preventDefault();
        this.handleEscape();
        break;
      case 'Enter':
        if (!this.isInputFocused) {
          e.preventDefault();
          this.showCommandBar();
        }
        break;
      case 'Tab':
        if (!this.isInputFocused) {
          e.preventDefault();
          this.startTabHold();
        }
        break;
      case 'KeyC':
        if (!this.isInputFocused) {
          this.toggleCameraMode();
        }
        break;
    }
  }

  handleKeyUp(e) {
    // Only clear gameplay keys if UI is not focused
    if (!this.isUIFocused) {
      this.keys[e.code] = false;
    }
    
    if (e.code === 'Tab') {
      this.stopTabHold();
    }
  }

  handleClick(e) {
    if (e.target.closest('#gameContainer canvas')) {
      this.handleCanvasClick(e);
    }
  }

  handleCanvasClick(e) {
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);
    
    const intersects = raycaster.intersectObjects(this.createdObjects, true);
    
    if (intersects.length > 0) {
      const clickedObject = this.findRootObject(intersects[0].object);
      
      if (this.selectedObject === clickedObject) {
        // Double click - delete object
        this.deleteObject(clickedObject);
      } else {
        // Single click - select object
        this.selectObject(clickedObject);
      }
    } else {
      // Click on empty space - deselect
      this.selectObject(null);
    }
  }

  handleContextMenu(e) {
    e.preventDefault();
  }

  handleCommandInput(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.handleExecuteCommand();
    }
  }

  handleExecuteCommand() {
    const now = Date.now();
    if (now - this.lastCommandTime < this.commandDebounceDelay) {
      return; // Debounce
    }
    this.lastCommandTime = now;
    
    const commandInput = document.getElementById('commandInput');
    if (!commandInput) return;
    
    const command = commandInput.value.trim();
    if (!command) return;
    
    this.queueCommand(command);
    commandInput.value = '';
  }

  queueCommand(command) {
    this.commandQueue.push(command);
    this.processCommandQueue();
  }

  async processCommandQueue() {
    if (this.isExecutingCommand || this.commandQueue.length === 0) {
      return;
    }
    
    this.isExecutingCommand = true;
    
    try {
      const command = this.commandQueue.shift();
      await this.executeCommand(command);
    } catch (error) {
      this.log(`Command execution failed: ${error.message}`, 'error');
      this.showToast(`Error: ${error.message}`, 'error');
    } finally {
      this.isExecutingCommand = false;
      
      // Process next command if any
      if (this.commandQueue.length > 0) {
        setTimeout(() => this.processCommandQueue(), 100);
      }
    }
  }

  async executeCommand(command) {
    this.log(`Executing command: ${command}`);
    
    try {
      if (this.aiAgent) {
        this.aiAgent.processCommand(command);
      } else {
        this.parseNaturalLanguage(command);
      }
    } catch (error) {
      throw new Error(`Failed to execute command: ${error.message}`);
    }
  }

  handleClearAll() {
    if (confirm('Are you sure you want to clear all objects? This cannot be undone.')) {
      this.clearAll();
    }
  }

  handleEscape() {
    // Blur any focused inputs
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
    
    // Hide command palette
    this.hideCommandPalette();
    
    // Hide command bar
    this.hideCommandBar();
    
    // Deselect object
    this.selectObject(null);
  }

  handleCategorySelect(e) {
    const category = e.target.dataset.category;
    if (!category) return;
    
    // Update active category
    document.querySelectorAll('.category-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    e.target.classList.add('active');
    
    // Show category items
    document.querySelectorAll('.category-items').forEach(items => {
      items.style.display = 'none';
    });
    
    const categoryItems = document.getElementById(`${category}Items`);
    if (categoryItems) {
      categoryItems.style.display = 'grid';
    }
  }

  handleItemCreate(e) {
    const category = e.target.dataset.category;
    const item = e.target.dataset.item;
    
    if (!category || !item) return;
    
    const description = `${item} from ${category}`;
    this.queueCommand(`create ${description}`);
  }

  handleContextLost(e) {
    e.preventDefault();
    this.webglContextLost = true;
    this.pause();
    this.log('WebGL context lost', 'error');
    this.showToast('Graphics context lost. Please reload the page.', 'error');
  }

  handleContextRestored() {
    this.webglContextLost = false;
    this.log('WebGL context restored');
    
    if (confirm('Graphics context restored. Reload the page to continue?')) {
      window.location.reload();
    }
  }

  // Core game loop
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.isPaused = false;
    this.lastTime = performance.now();
    this.accumulator = 0;
    
    this.gameLoop();
    this.log('Game loop started');
  }

  pause() {
    this.isPaused = true;
    this.log('Game paused');
  }

  resume() {
    if (!this.isRunning) return;
    
    this.isPaused = false;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.log('Game resumed');
  }

  stop() {
    this.isRunning = false;
    this.isPaused = false;
    
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    
    this.log('Game stopped');
  }

  gameLoop() {
    if (!this.isRunning || this.webglContextLost) return;
    
    this.rafId = requestAnimationFrame(() => this.gameLoop());
    
    if (this.isPaused) return;
    
    const currentTime = performance.now();
    let deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    
    // Clamp delta time to prevent spiral of death
    deltaTime = Math.min(deltaTime, this.maxDeltaTime);
    
    this.accumulator += deltaTime;
    
    // Fixed timestep updates
    while (this.accumulator >= this.fixedTimeStep) {
      this.fixedUpdate(this.fixedTimeStep);
      this.accumulator -= this.fixedTimeStep;
    }
    
    // Variable timestep updates
    this.update(deltaTime);
    this.render();
    
    // Performance monitoring
    this.updatePerformanceMonitoring(currentTime);
  }

  fixedUpdate(deltaTime) {
    // Physics updates (if enabled)
    if (this.physicsEnabled && this.physicsWorld) {
      this.physicsWorld.step(deltaTime);
    }
    
    // Player controller update
    if (this.playerController) {
      const cameraRotation = this.getCurrentCameraRotation();
      this.playerController.update(deltaTime, cameraRotation);
    }
  }

  update(deltaTime) {
    // Camera controller updates
    if (this.cameraMode === 'third-person' && this.thirdPersonController) {
      this.thirdPersonController.update();
    } else if (this.cameraMode === 'first-person' && this.firstPersonController) {
      this.firstPersonController.update();
    }
    
    // AI agent autonomous behavior
    if (this.aiAgent) {
      this.aiAgent.checkForAutonomousSuggestions();
    }
    
    // Update time of day
    this.updateTimeOfDay();
    
    // Update weather effects
    this.updateWeatherEffects(deltaTime);
    
    // Update instanced meshes
    this.updateInstancedMeshes(deltaTime);
  }

  render() {
    if (!this.renderer || !this.scene || !this.camera) return;
    
    // Frustum culling
    if (this.frustumCulling) {
      this.updateFrustumCulling();
    }
    
    this.renderer.render(this.scene, this.camera);
  }

  updatePerformanceMonitoring(currentTime) {
    this.frameCount++;
    
    if (currentTime - this.lastFPSUpdate >= 1000) {
      this.currentFPS = Math.round((this.frameCount * 1000) / (currentTime - this.lastFPSUpdate));
      this.frameCount = 0;
      this.lastFPSUpdate = currentTime;
      
      this.updatePerformanceStats();
      
      // Auto low-spec detection
      if (this.currentFPS < this.autoLowSpecThreshold) {
        this.lowFPSCounter += 1000;
        if (this.lowFPSCounter >= this.autoLowSpecDuration) {
          this.enableAutoLowSpec();
          this.lowFPSCounter = 0;
        }
      } else {
        this.lowFPSCounter = 0;
      }
    }
  }

  enableAutoLowSpec() {
    if (this.graphicsPreset === 'low') return;
    
    this.log('Auto-enabling low spec mode due to low FPS');
    this.setGraphicsPreset('low');
    this.showToast('Switched to Low graphics for better performance', 'info');
  }

  setGraphicsPreset(preset) {
    this.graphicsPreset = preset;
    
    switch (preset) {
      case 'low':
        this.renderScale = 0.75;
        this.shadowMapSize = 512;
        this.enableSSAO = false;
        this.enableMSAA = false;
        break;
      case 'medium':
        this.renderScale = 1.0;
        this.shadowMapSize = 1024;
        this.enableSSAO = false;
        this.enableMSAA = true;
        break;
      case 'high':
        this.renderScale = 1.0;
        this.shadowMapSize = 2048;
        this.enableSSAO = true;
        this.enableMSAA = true;
        break;
    }
    
    this.updateRendererSize();
    this.updateShadowSettings();
    this.log(`Graphics preset changed to: ${preset}`);
  }

  updateShadowSettings() {
    if (this.directionalLight) {
      this.directionalLight.shadow.mapSize.width = this.shadowMapSize;
      this.directionalLight.shadow.mapSize.height = this.shadowMapSize;
    }
  }

  getCurrentCameraRotation() {
    if (this.cameraMode === 'third-person' && this.thirdPersonController) {
      return this.thirdPersonController.rotation;
    } else if (this.cameraMode === 'first-person' && this.firstPersonController) {
      return this.firstPersonController.rotationY;
    }
    return 0;
  }

  updateFrustumCulling() {
    // Simple frustum culling for created objects
    const frustum = new THREE.Frustum();
    const matrix = new THREE.Matrix4().multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(matrix);
    
    this.createdObjects.forEach(obj => {
      if (obj.geometry && obj.geometry.boundingSphere) {
        obj.visible = frustum.intersectsSphere(obj.geometry.boundingSphere);
      }
    });
  }

  updateInstancedMeshes(deltaTime) {
    // Update any instanced meshes (trees, props, etc.)
    this.instancedMeshes.forEach((mesh, type) => {
      if (mesh.userData.animate) {
        // Simple animation for trees (swaying)
        if (type === 'tree') {
          const time = Date.now() * 0.001;
          mesh.rotation.z = Math.sin(time) * 0.1;
        }
      }
    });
  }

  updateTimeOfDay() {
    if (!this.directionalLight || !this.ambientLight) return;
    
    // Update sun position based on time of day
    const angle = this.timeOfDay * Math.PI * 2;
    const sunHeight = Math.sin(angle) * 50;
    const sunDistance = Math.cos(angle) * 50;
    
    this.directionalLight.position.set(sunDistance, Math.max(sunHeight, 5), 25);
    
    // Update light intensity
    const intensity = Math.max(0.1, Math.sin(angle));
    this.directionalLight.intensity = intensity;
    
    // Update ambient light
    this.ambientLight.intensity = 0.2 + intensity * 0.3;
    
    // Update sky color
    const skyColor = new THREE.Color();
    if (sunHeight > 0) {
      // Day
      skyColor.setHSL(0.6, 0.5, 0.7 + intensity * 0.2);
    } else {
      // Night
      skyColor.setHSL(0.6, 0.8, 0.1);
    }
    
    this.scene.background = skyColor;
    if (this.scene.fog) {
      this.scene.fog.color = skyColor;
    }
  }

  updateWeatherEffects(deltaTime) {
    // Weather effects implementation would go here
    // For now, just a placeholder
  }

  // Object management
  createFromDescription(description) {
    if (!this.objectCreator) return null;
    
    const obj = this.objectCreator.createFromDescription(description);
    if (!obj) return null;
    
    // Position object in front of camera
    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);
    const spawnPosition = this.camera.position.clone().add(cameraDirection.multiplyScalar(5));
    spawnPosition.y = Math.max(spawnPosition.y, 1);
    
    obj.position.copy(spawnPosition);
    
    this.scene.add(obj);
    this.createdObjects.push(obj);
    
    // Record creation for history
    this.historyManager.recordObjectCreation(obj);
    this.historyManager.commitTransaction();
    
    this.updateObjectCount();
    this.log(`Created: ${description}`);
    
    // Dispatch event
    document.dispatchEvent(new CustomEvent('objectCreated', {
      detail: { object: obj, description }
    }));
    
    return obj;
  }

  deleteObject(obj) {
    if (!obj || !this.createdObjects.includes(obj)) return;
    
    // Record deletion for history
    const snapshot = this.historyManager.createObjectSnapshot(obj);
    this.historyManager.startTransaction('Delete Object');
    this.historyManager.recordObjectDeletion(obj, snapshot);
    
    // Remove from scene and arrays
    this.scene.remove(obj);
    const index = this.createdObjects.indexOf(obj);
    if (index > -1) {
      this.createdObjects.splice(index, 1);
    }
    
    // Dispose resources
    this.disposeObject(obj);
    
    // Deselect if selected
    if (this.selectedObject === obj) {
      this.selectObject(null);
    }
    
    this.historyManager.commitTransaction();
    this.updateObjectCount();
    this.log('Object deleted');
    
    // Dispatch event
    document.dispatchEvent(new CustomEvent('objectDeleted', {
      detail: { object: obj, snapshot }
    }));
  }

  disposeObject(obj) {
    obj.traverse((child) => {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(material => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }

  selectObject(obj) {
    // Clear previous selection
    if (this.selectedObject) {
      this.clearObjectHighlight(this.selectedObject);
    }
    
    this.selectedObject = obj;
    
    if (obj) {
      this.highlightObject(obj);
      this.updatePropertiesPanel(obj);
      this.log(`Selected: ${obj.userData.name || 'Object'}`);
    } else {
      this.clearPropertiesPanel();
    }
  }

  highlightObject(obj) {
    // Add wireframe highlight
    const wireframe = new THREE.WireframeGeometry(obj.geometry);
    const line = new THREE.LineSegments(wireframe, new THREE.LineBasicMaterial({ color: 0x00ff00 }));
    line.userData.isHighlight = true;
    obj.add(line);
  }

  clearObjectHighlight(obj) {
    // Remove wireframe highlight
    const highlights = obj.children.filter(child => child.userData.isHighlight);
    highlights.forEach(highlight => {
      obj.remove(highlight);
      if (highlight.geometry) highlight.geometry.dispose();
      if (highlight.material) highlight.material.dispose();
    });
  }

  findRootObject(obj) {
    while (obj.parent && obj.parent !== this.scene) {
      obj = obj.parent;
    }
    return obj;
  }

  clearAll() {
    this.historyManager.startTransaction('Clear All');
    
    // Record all deletions
    this.createdObjects.forEach(obj => {
      const snapshot = this.historyManager.createObjectSnapshot(obj);
      this.historyManager.recordObjectDeletion(obj, snapshot);
    });
    
    // Remove all objects
    this.createdObjects.forEach(obj => {
      this.scene.remove(obj);
      this.disposeObject(obj);
    });
    
    this.createdObjects = [];
    this.selectObject(null);
    
    this.historyManager.commitTransaction();
    this.updateObjectCount();
    this.log('All objects cleared');
    this.showToast('All objects cleared', 'info');
  }

  // Camera controls
  setCameraMode(mode) {
    if (this.cameraMode === mode) return;
    
    // Disable current controller
    if (this.cameraMode === 'third-person' && this.thirdPersonController) {
      this.thirdPersonController.disable();
    } else if (this.cameraMode === 'first-person' && this.firstPersonController) {
      this.firstPersonController.disable();
    }
    
    this.cameraMode = mode;
    
    // Enable new controller
    if (mode === 'third-person' && this.thirdPersonController) {
      this.thirdPersonController.enable();
      // Sync rotation from first-person if switching
      if (this.firstPersonController) {
        this.thirdPersonController.rotation = this.firstPersonController.rotationY;
      }
    } else if (mode === 'first-person' && this.firstPersonController) {
      // Sync rotation from third-person if switching
      if (this.thirdPersonController) {
        this.firstPersonController.rotationY = this.thirdPersonController.rotation;
      }
      this.firstPersonController.enable();
    }
    
    // Update player controller
    if (this.playerController) {
      this.playerController.setCameraMode(mode);
    }
    
    this.log(`Camera mode: ${mode}`);
    this.showToast(`Camera: ${mode}`, 'info');
  }

  toggleCameraMode() {
    const newMode = this.cameraMode === 'third-person' ? 'first-person' : 'third-person';
    this.setCameraMode(newMode);
  }

  // UI management
  toggleImmersiveMode() {
    this.isImmersiveMode = !this.isImmersiveMode;
    this.updateUIVisibility();
    
    const message = this.isImmersiveMode ? 'Immersive mode ON' : 'Immersive mode OFF';
    this.showToast(message, 'info');
    this.log(message);
  }

  toggleHUD() {
    this.showHUD = !this.showHUD;
    this.updateUIVisibility();
    
    const message = this.showHUD ? 'HUD ON' : 'HUD OFF';
    this.showToast(message, 'info');
    this.log(message);
  }

  updateUIVisibility() {
    const body = document.body;
    
    // Immersive mode
    if (this.isImmersiveMode) {
      body.classList.add('immersive-mode');
    } else {
      body.classList.remove('immersive-mode');
    }
    
    // HUD visibility
    if (this.showHUD) {
      body.classList.remove('hide-hud');
    } else {
      body.classList.add('hide-hud');
    }
    
    // UI controls visibility
    const uiControls = document.getElementById('uiControls');
    if (uiControls) {
      if (this.isImmersiveMode || !this.showHUD) {
        uiControls.classList.add('show');
      } else {
        uiControls.classList.remove('show');
      }
    }
  }

  showCommandBar() {
    this.showCommandBar = true;
    const consolePanel = document.getElementById('consolePanel');
    if (consolePanel) {
      consolePanel.classList.add('show');
      const commandInput = document.getElementById('commandInput');
      if (commandInput) {
        commandInput.focus();
      }
    }
    
    // Auto-hide timer
    this.resetCommandBarTimer();
  }

  hideCommandBar() {
    this.showCommandBar = false;
    const consolePanel = document.getElementById('consolePanel');
    if (consolePanel) {
      consolePanel.classList.remove('show');
    }
    
    if (this.commandBarTimer) {
      clearTimeout(this.commandBarTimer);
      this.commandBarTimer = null;
    }
  }

  resetCommandBarTimer() {
    if (this.commandBarTimer) {
      clearTimeout(this.commandBarTimer);
    }
    
    this.commandBarTimer = setTimeout(() => {
      if (!this.isInputFocused) {
        this.hideCommandBar();
      }
    }, this.commandBarAutoHideDelay);
  }

  startTabHold() {
    this.tabHoldTimer = setTimeout(() => {
      this.showCommandBar();
    }, 500);
  }

  stopTabHold() {
    if (this.tabHoldTimer) {
      clearTimeout(this.tabHoldTimer);
      this.tabHoldTimer = null;
    }
  }

  toggleCommandPalette() {
    const palette = document.getElementById('commandPalette');
    if (!palette) return;
    
    if (palette.classList.contains('show')) {
      this.hideCommandPalette();
    } else {
      this.showCommandPalette();
    }
  }

  showCommandPalette() {
    const palette = document.getElementById('commandPalette');
    if (palette) {
      palette.classList.add('show');
      
      // Setup palette item handlers
      palette.querySelectorAll('.palette-item').forEach(item => {
        item.onclick = () => {
          const action = item.dataset.action;
          this.executeCommandPaletteAction(action);
          this.hideCommandPalette();
        };
      });
    }
  }

  hideCommandPalette() {
    const palette = document.getElementById('commandPalette');
    if (palette) {
      palette.classList.remove('show');
    }
  }

  executeCommandPaletteAction(action) {
    switch (action) {
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
        this.toggleImmersiveMode();
        break;
      case 'toggle-hud':
        this.toggleHUD();
        break;
      case 'clear-all':
        this.handleClearAll();
        break;
      case 'undo':
        this.historyManager.undo();
        break;
      case 'redo':
        this.historyManager.redo();
        break;
      case 'ai-help':
        this.showAIHelp();
        break;
      case 'toggle-ai-suggestions':
        this.toggleAISuggestions();
        break;
    }
  }

  // Screenshot functionality
  takeScreenshot() {
    // Hide all UI for clean screenshot
    document.body.classList.add('screenshot-mode');
    
    // Wait a frame for UI to hide
    requestAnimationFrame(() => {
      const canvas = this.renderer.domElement;
      const link = document.createElement('a');
      link.download = `worldsmith_screenshot_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      // Restore UI
      document.body.classList.remove('screenshot-mode');
      
      this.showToast('Screenshot saved!', 'success');
      this.log('Screenshot taken');
    });
  }

  // Save/Load functionality
  saveWorld() {
    try {
      const historyData = this.historyManager.serializeHistory();
      const worldData = this.worldData.saveWorld(this.createdObjects, historyData);
      
      // Also save to localStorage
      localStorage.setItem('worldSave', JSON.stringify(worldData));
      
      this.showToast('World saved!', 'success');
      this.log('World saved successfully');
    } catch (error) {
      this.log(`Save failed: ${error.message}`, 'error');
      this.showToast(`Save failed: ${error.message}`, 'error');
    }
  }

  loadWorld() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        const worldData = await this.worldData.loadWorld(
          file, 
          this.objectCreator, 
          this.scene, 
          this.createdObjects
        );
        
        // Restore history if available
        if (worldData.historyData) {
          this.historyManager.deserializeHistory(worldData.historyData);
        }
        
        this.updateObjectCount();
        this.selectObject(null);
        
        this.showToast('World loaded!', 'success');
        this.log('World loaded successfully');
      } catch (error) {
        this.log(`Load failed: ${error.message}`, 'error');
        this.showToast(`Load failed: ${error.message}`, 'error');
      }
    };
    
    input.click();
  }

  // Natural language processing
  parseNaturalLanguage(input) {
    const command = input.toLowerCase().trim();
    
    // Time of day commands
    if (command.includes('night') || command.includes('dark')) {
      this.setTimeOfDay(0.0);
      this.showRosieResponse("🌙 Setting to nighttime. The stars are beautiful tonight!");
      return;
    }
    
    if (command.includes('day') || command.includes('morning') || command.includes('noon')) {
      this.setTimeOfDay(0.5);
      this.showRosieResponse("☀️ Brightening to daytime! Perfect weather for building.");
      return;
    }
    
    if (command.includes('dawn') || command.includes('sunrise')) {
      this.setTimeOfDay(0.25);
      this.showRosieResponse("🌅 Setting to dawn. What a beautiful sunrise!");
      return;
    }
    
    if (command.includes('dusk') || command.includes('sunset')) {
      this.setTimeOfDay(0.75);
      this.showRosieResponse("🌇 Setting to dusk. The golden hour is magical!");
      return;
    }
    
    // Weather commands
    if (command.includes('rain') || command.includes('storm')) {
      this.setWeather('rain');
      this.showRosieResponse("🌧️ Adding rain effects. I love the sound of rain!");
      return;
    }
    
    if (command.includes('clear') || command.includes('sunny')) {
      this.setWeather('clear');
      this.showRosieResponse("☀️ Clearing the weather. Beautiful clear skies!");
      return;
    }
    
    // Creation commands
    if (command.includes('create') || command.includes('make') || command.includes('build') || command.includes('add')) {
      const obj = this.createFromDescription(command);
      if (obj) {
        this.showRosieResponse(`✨ Created! I love seeing your world come to life.`);
      } else {
        this.showRosieResponse("I'm not sure how to create that. Can you be more specific?");
      }
      return;
    }
    
    // Default response
    this.showRosieResponse("I'm not sure what you mean. Try asking me to create something or change the time of day!");
  }

  setTimeOfDay(time) {
    this.timeOfDay = Math.max(0, Math.min(1, time));
    this.updateTimeOfDay();
    this.log(`Time of day set to: ${this.timeOfDay}`);
  }

  setWeather(weather) {
    this.weather = weather;
    this.log(`Weather set to: ${weather}`);
    // Weather effects would be implemented here
  }

  // AI Agent integration
  showRosieResponse(message) {
    const responseDiv = document.getElementById('rosieResponse');
    if (responseDiv) {
      responseDiv.textContent = `Rosie: ${message}`;
      responseDiv.style.display = 'block';
      
      // Auto-hide after 10 seconds
      setTimeout(() => {
        responseDiv.style.display = 'none';
      }, 10000);
    }
    
    this.log(`Rosie: ${message}`);
  }

  showAIHelp() {
    const helpMessage = `
🤖 AI Assistant Help:

Voice Commands:
• "Create a red house" - Build objects
• "Make it night" - Change time of day  
• "Add rain" - Weather effects
• "Build a bridge 30m long" - Specific sizes

Controls:
• WASD - Move around
• Mouse - Look around
• Space - Jump
• C - Switch camera mode
• Click - Select objects
• Double-click - Delete objects

Shortcuts:
• Ctrl+Z/Y - Undo/Redo
• Ctrl+S - Save world
• F10 - Toggle UI
• F9 - Toggle HUD
• Shift+F12 - Screenshot

Just tell me what you want to create in natural language!
    `;
    
    this.showRosieResponse(helpMessage);
  }

  toggleAISuggestions() {
    if (this.aiAgent) {
      const enabled = !this.aiAgent.autonomousBehaviors.enabled;
      this.aiAgent.enableAutonomousBehavior(enabled);
      
      const message = enabled ? 'AI suggestions enabled' : 'AI suggestions disabled';
      this.showToast(message, 'info');
    }
  }

  // UI updates
  updateObjectCount() {
    const countElement = document.getElementById('objectCount');
    if (countElement) {
      countElement.textContent = this.createdObjects.length;
    }
  }

  updatePerformanceStats() {
    const fpsElement = document.getElementById('fps');
    const triangleElement = document.getElementById('triangleCount');
    
    if (fpsElement) {
      fpsElement.textContent = this.currentFPS;
    }
    
    if (triangleElement) {
      let triangleCount = 0;
      this.scene.traverse((obj) => {
        if (obj.geometry && obj.geometry.attributes.position) {
          triangleCount += obj.geometry.attributes.position.count / 3;
        }
      });
      triangleElement.textContent = Math.floor(triangleCount);
    }
  }

  updatePropertiesPanel(obj) {
    const propertiesPanel = document.getElementById('objectProperties');
    if (!propertiesPanel) return;
    
    propertiesPanel.style.display = 'block';
    
    // Update form fields
    const nameInput = document.getElementById('objName');
    if (nameInput) {
      nameInput.value = obj.userData.name || 'Unnamed Object';
    }
    
    // Position
    const posX = document.getElementById('posX');
    const posY = document.getElementById('posY');
    const posZ = document.getElementById('posZ');
    if (posX) posX.value = obj.position.x.toFixed(2);
    if (posY) posY.value = obj.position.y.toFixed(2);
    if (posZ) posZ.value = obj.position.z.toFixed(2);
    
    // Rotation (convert to degrees)
    const rotX = document.getElementById('rotX');
    const rotY = document.getElementById('rotY');
    const rotZ = document.getElementById('rotZ');
    if (rotX) rotX.value = Math.round(obj.rotation.x * 180 / Math.PI);
    if (rotY) rotY.value = Math.round(obj.rotation.y * 180 / Math.PI);
    if (rotZ) rotZ.value = Math.round(obj.rotation.z * 180 / Math.PI);
    
    // Scale
    const scale = document.getElementById('scale');
    if (scale) scale.value = obj.scale.x.toFixed(2);
    
    // Color
    const colorInput = document.getElementById('objColor');
    if (colorInput && obj.material && obj.material.color) {
      colorInput.value = '#' + obj.material.color.getHexString();
    }
  }

  clearPropertiesPanel() {
    const propertiesPanel = document.getElementById('objectProperties');
    if (propertiesPanel) {
      propertiesPanel.style.display = 'none';
    }
  }

  // Toast notifications
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // Show toast
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  // Logging system
  log(message, level = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
      timestamp,
      level,
      message
    };
    
    this.diagnosticsLog.push(logEntry);
    
    // Keep only last N entries
    if (this.diagnosticsLog.length > this.maxLogEntries) {
      this.diagnosticsLog.shift();
    }
    
    // Console output
    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[consoleMethod](`[${timestamp}] ${message}`);
  }

  // Diagnostics
  copyDiagnostics() {
    const diagnostics = {
      fps: this.currentFPS,
      objects: this.createdObjects.length,
      triangles: this.getTriangleCount(),
      rafCount: this.rafId ? 1 : 0,
      memoryEstimate: this.getMemoryEstimate(),
      graphicsPreset: this.graphicsPreset,
      renderScale: this.renderScale,
      log: this.diagnosticsLog
    };
    
    const diagnosticsText = JSON.stringify(diagnostics, null, 2);
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(diagnosticsText);
      this.showToast('Diagnostics copied to clipboard', 'success');
    } else {
      console.log('Diagnostics:', diagnosticsText);
      this.showToast('Diagnostics logged to console', 'info');
    }
  }

  getTriangleCount() {
    let count = 0;
    this.scene.traverse((obj) => {
      if (obj.geometry && obj.geometry.attributes.position) {
        count += obj.geometry.attributes.position.count / 3;
      }
    });
    return Math.floor(count);
  }

  getMemoryEstimate() {
    // Rough estimate based on objects and textures
    const objectMemory = this.createdObjects.length * 1024; // 1KB per object estimate
    const textureMemory = this.loadedAssets.size * 512 * 1024; // 512KB per asset estimate
    return Math.floor((objectMemory + textureMemory) / 1024) + 'KB';
  }

  // Cleanup
  destroy() {
    this.stop();
    
    // Cleanup controllers
    if (this.playerController) {
      this.playerController.destroy();
    }
    
    // Cleanup objects
    this.createdObjects.forEach(obj => {
      this.disposeObject(obj);
    });
    
    // Cleanup renderer
    if (this.renderer) {
      this.renderer.dispose();
    }
    
    // Clear timers
    if (this.commandBarTimer) {
      clearTimeout(this.commandBarTimer);
    }
    
    if (this.tabHoldTimer) {
      clearTimeout(this.tabHoldTimer);
    }
    
    this.log('Worldsmith destroyed');
  }
}