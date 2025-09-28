

import * as THREE from 'three';
import { ThirdPersonCameraController } from './rosieControls.js';
import { ObjectCreator } from './objectCreator.js';
import { WorldData } from './worldData.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AIAgent } from './aiAgent.js';
import { HistoryManager } from './historyManager.js';

export class Worldsmith {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.cameraController = null;
    this.objectCreator = null;
    this.worldData = null;
    
    this.player = null;
    this.clock = new THREE.Clock();
    this.frameCount = 0;
    this.lastFPSUpdate = 0;
    
    this.selectedObject = null;
    this.previewObject = null;
    this.createdObjects = [];
    this.isRunning = false;
    
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    this.assetLoader = new GLTFLoader();
    this.loadedAssets = new Map();
    
    // Immersive UI mode state
    this.immersiveMode = true; // Start in immersive mode
    this.hideHUD = false;
    this.showConsoleTimeout = null;
    this.hidePropertiesTimeout = null;
    this.controlHintsTimeout = null;
    this.quickPeekTimeout = null;
    
    // Drag operation state for history coalescing
    this.isDragging = false;
    this.dragStartTransform = null;
  }

  async init() {
    await this.setupScene();
    this.setupPlayer();
    this.setupControls();
    this.setupLighting();
    this.setupEnvironment();
    this.setupUI();
    
    this.objectCreator = new ObjectCreator(this.scene, this.assetLoader, this.loadedAssets);
    this.worldData = new WorldData();
    
    // Initialize AI Agent
    this.aiAgent = new AIAgent(this);
    
    // Initialize History Manager
    this.historyManager = new HistoryManager(this);
    
    await this.preloadAssets();
    this.setupImmersiveUI();
    this.loadUIState();
    this.setupUIAutoHide();
    this.setupCommandBarBehavior();
    this.setupRecordingWidget();
    this.setupTitleFadeout();
  }
  setupScene() {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog = new THREE.Fog(0x87CEEB, 100, 800);
    // Create camera
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.set(0, 10, 20);
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    
    document.getElementById('gameContainer').appendChild(this.renderer.domElement);
    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());
  }

  setupPlayer() {
    // Create invisible player object for camera following
    const playerGeometry = new THREE.CapsuleGeometry(0.3, 1.2);
    const playerMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x00ff00, 
      transparent: true, 
      opacity: 0 
    });
    this.player = new THREE.Mesh(playerGeometry, playerMaterial);
    this.player.position.set(0, 1, 8);
    this.scene.add(this.player);
  }

  setupControls() {
    this.cameraController = new ThirdPersonCameraController(
      this.camera, 
      this.player, 
      this.renderer.domElement,
      {
        distance: 12,
        height: 6,
        rotationSpeed: 0.005
      }
    );

    // Setup keyboard controls for player movement
    this.keys = {};
    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
    });
    document.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Mouse interaction
    this.renderer.domElement.addEventListener('click', (e) => this.onMouseClick(e));
    
    // Global hotkey handlers
    document.addEventListener('keydown', (e) => this.handleGlobalHotkeys(e));
    document.addEventListener('keyup', (e) => this.handleGlobalHotkeysUp(e));
  }

  setupLighting() {
    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 200;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    this.scene.add(directionalLight);

    // Additional fill light
    const fillLight = new THREE.DirectionalLight(0x87CEEB, 0.3);
    fillLight.position.set(-30, 50, -30);
    this.scene.add(fillLight);
  }

  setupEnvironment() {
    this.createIslandTerrain();
    this.createOcean();
    this.createSkybox();
  }
  createIslandTerrain() {
    // Create 1x1 km island terrain
    const terrainSize = 1000; // 1km = 1000m
    const terrainResolution = 128;
    
    const geometry = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainResolution - 1, terrainResolution - 1);
    
    // Generate height map for realistic island terrain
    const vertices = geometry.attributes.position.array;
    for (let i = 0, j = 0; i < vertices.length; i++, j += 3) {
      const x = vertices[j];
      const z = vertices[j + 2];
      
      // Distance from center
      const distance = Math.sqrt(x * x + z * z);
      const maxDistance = terrainSize * 0.4;
      
      // Island height falloff
      let height = 0;
      if (distance < maxDistance) {
        const falloff = 1 - (distance / maxDistance);
        // Add some noise for natural terrain
        const noise = Math.sin(x * 0.01) * Math.cos(z * 0.01) * 5 +
                     Math.sin(x * 0.02) * Math.cos(z * 0.02) * 3 +
                     Math.sin(x * 0.05) * Math.cos(z * 0.05) * 1;
        height = falloff * (15 + noise);
      }
      
      vertices[j + 1] = Math.max(0, height);
    }
    
    geometry.computeVertexNormals();
    
    // Island material with texture-like appearance
    const material = new THREE.MeshLambertMaterial({ 
      color: 0x8B7355,
      vertexColors: false
    });
    
    this.terrain = new THREE.Mesh(geometry, material);
    this.terrain.rotation.x = -Math.PI / 2;
    this.terrain.receiveShadow = true;
    this.terrain.userData.type = 'terrain';
    this.scene.add(this.terrain);
  }
  createOcean() {
    // Create ocean around the island
    const oceanGeometry = new THREE.PlaneGeometry(2000, 2000);
    const oceanMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x006994,
      transparent: true,
      opacity: 0.8
    });
    
    this.ocean = new THREE.Mesh(oceanGeometry, oceanMaterial);
    this.ocean.rotation.x = -Math.PI / 2;
    this.ocean.position.y = -2;
    this.ocean.userData.type = 'ocean';
    this.scene.add(this.ocean);
  }
  createSkybox() {
    // Simple gradient sky
    const skyGeometry = new THREE.SphereGeometry(1500, 32, 32);
    const skyMaterial = new THREE.MeshBasicMaterial({
      color: 0x87CEEB,
      side: THREE.BackSide
    });
    
    this.sky = new THREE.Mesh(skyGeometry, skyMaterial);
    this.sky.userData.type = 'sky';
    this.scene.add(this.sky);
  }

  createAmbientElements() {
    // Create some floating particles for atmosphere
    const particleGeometry = new THREE.SphereGeometry(0.05);
    const particleMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffffff, 
      transparent: true, 
      opacity: 0.6 
    });

    for (let i = 0; i < 20; i++) {
      const particle = new THREE.Mesh(particleGeometry, particleMaterial);
      particle.position.set(
        (Math.random() - 0.5) * 100,
        Math.random() * 20 + 5,
        (Math.random() - 0.5) * 100
      );
      this.scene.add(particle);
    }
  }

  async preloadAssets() {
    const assetUrls = {
      wizard: 'https://play.rosebud.ai/assets/Wizard.glb?xipg',
      dragon: 'https://play.rosebud.ai/assets/Dragon.glb?IGw9',
      ghost: 'https://play.rosebud.ai/assets/Ghost Skull.glb?zT3V',
      cube_guy: 'https://play.rosebud.ai/assets/Cube Guy Character.glb?zDUS'
    };

    for (const [key, url] of Object.entries(assetUrls)) {
      try {
        const gltf = await this.assetLoader.loadAsync(url);
        this.loadedAssets.set(key, gltf);
      } catch (error) {
        console.warn(`Failed to load asset ${key}:`, error);
      }
    }
  }

  setupUI() {
    // Category buttons
    document.querySelectorAll('.category-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.showCategoryItems(btn.dataset.category);
      });
    });
    
    // Item buttons with different click behaviors
    this.setupItemButtons();
    
    // Quick action buttons
    this.setupQuickActions();
    // Command input
    document.getElementById('executeBtn').addEventListener('click', () => {
      this.executeCommand();
    });
    document.getElementById('commandInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.executeCommand();
      }
    });
    // Action buttons
    document.getElementById('undoBtn').addEventListener('click', () => {
      this.historyManager.undo();
    });
    document.getElementById('redoBtn').addEventListener('click', () => {
      this.historyManager.redo();
    });
    document.getElementById('clearAllBtn').addEventListener('click', () => {
      this.clearAll();
    });
    // Property inputs
    this.setupPropertyInputs();
    
    // Setup edge tab interactions
    this.setupEdgeTabs();
    
    // Setup command palette
    this.setupCommandPalette();
    
    // Setup on-screen controls
    this.setupOnScreenControls();
  }
  setupPropertyInputs() {
    const inputs = ['posX', 'posY', 'posZ', 'rotX', 'rotY', 'rotZ', 'scale'];
    inputs.forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('change', () => this.updateSelectedObjectProperty(id, input.value));
      }
    });
    const colorInput = document.getElementById('objColor');
    if (colorInput) {
      colorInput.addEventListener('change', () => this.updateSelectedObjectColor(colorInput.value));
    }
  }
  setupImmersiveUI() {
    // Apply immersive mode by default
    document.body.classList.add('immersive-mode');
  }
  setupEdgeTabs() {
    // Library tab
    document.getElementById('libraryTab').addEventListener('click', () => {
      this.togglePanel('library');
    });
    
    document.getElementById('libraryTab').addEventListener('mouseenter', () => {
      this.showPanel('library');
    });
    
    document.getElementById('libraryPanel').addEventListener('mouseleave', () => {
      this.hidePanel('library');
    });
    
    // Properties tab
    document.getElementById('propertiesTab').addEventListener('click', () => {
      this.togglePanel('properties');
    });
    
    document.getElementById('propertiesTab').addEventListener('mouseenter', () => {
      this.showPanel('properties');
    });
    
    document.getElementById('propertiesPanel').addEventListener('mouseleave', () => {
      this.hidePanel('properties');
    });
  }
  setupCommandPalette() {
    const palette = document.getElementById('commandPalette');
    
    // Palette items
    document.querySelectorAll('.palette-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        this.executeCommandPaletteAction(action);
        this.hideCommandPalette();
      });
    });
    
    // Click outside to close
    palette.addEventListener('click', (e) => {
      if (e.target === palette) {
        this.hideCommandPalette();
      }
    });
  }
  setupOnScreenControls() {
    // UI Toggle Button
    document.getElementById('uiToggleBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleImmersiveMode();
    });
    // HUD Toggle Button
    document.getElementById('hudToggleBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleHUD();
    });
    // Console Button - focus input
    document.getElementById('consoleBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('commandInput').focus();
    });
    // Palette Button
    document.getElementById('paletteBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.showCommandPalette();
    });
    // Screenshot Button
    document.getElementById('screenshotBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.takeCleanScreenshot();
    });
  }
  
  setupItemButtons() {
    let clickTimer = null;
    let clickCount = 0;
    
    document.querySelectorAll('.item-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const isShiftClick = e.shiftKey;
        
        if (isShiftClick) {
          // Shift+Click: show preset picker
          this.showPresetPicker(btn);
          return;
        }
        
        // Handle single/double click detection
        clickCount++;
        
        if (clickCount === 1) {
          clickTimer = setTimeout(() => {
            // Single click: prefill command bar
            this.prefillCommandBar(btn);
            clickCount = 0;
          }, 300);
        } else if (clickCount === 2) {
          // Double click: execute immediately
          clearTimeout(clickTimer);
          this.executeItemAction(btn);
          clickCount = 0;
        }
      });
    });
  }
  
  setupQuickActions() {
    // Screenshot button
    document.getElementById('quickScreenshot').addEventListener('click', () => {
      this.disableLibraryButtons();
      this.takeCleanScreenshot();
      setTimeout(() => this.enableLibraryButtons(), 1000);
    });
    
    // Save World button
    document.getElementById('quickSaveWorld').addEventListener('click', () => {
      this.disableLibraryButtons();
      this.quickSaveWorld();
      setTimeout(() => this.enableLibraryButtons(), 500);
    });
    
    // Load World button
    document.getElementById('quickLoadWorld').addEventListener('click', () => {
      this.disableLibraryButtons();
      this.quickLoadWorld();
      setTimeout(() => this.enableLibraryButtons(), 500);
    });
  }
  
  showCategoryItems(category) {
    // Hide all category items first
    document.querySelectorAll('.category-items').forEach(div => {
      div.style.display = 'none';
    });
    // Show selected category items
    const categoryDiv = document.getElementById(category + 'Items');
    if (categoryDiv) {
      categoryDiv.style.display = 'grid';
    }
  }
  executeCommand() {
    const input = document.getElementById('commandInput');
    const command = input.value.trim();
    
    if (!command) return;
    
    // Use AI Agent for enhanced processing
    this.aiAgent.processCommand(command);
    
    input.value = '';
  }
  parseNaturalLanguage(command) {
    const lowerCommand = command.toLowerCase();
    
    // Environment commands
    if (lowerCommand.includes('night') || lowerCommand.includes('dark')) {
      this.setTimeOfDay('night');
      this.showRosieResponse("Setting to nighttime with moonlight and stars.");
    } else if (lowerCommand.includes('day') || lowerCommand.includes('morning') || lowerCommand.includes('dawn')) {
      this.setTimeOfDay('day');
      this.showRosieResponse("Setting to daytime with bright sunlight.");
    } else if (lowerCommand.includes('rain') || lowerCommand.includes('storm')) {
      this.addWeatherEffect('rain');
      this.showRosieResponse("Adding rain effect with storm clouds.");
    } else if (lowerCommand.includes('fog') || lowerCommand.includes('mist')) {
      this.addWeatherEffect('fog');
      this.showRosieResponse("Adding atmospheric fog.");
    } 
    // Object creation commands
    else if (lowerCommand.includes('tree') || lowerCommand.includes('forest')) {
      this.createVegetation(command, lowerCommand);
    } else if (lowerCommand.includes('house') || lowerCommand.includes('building') || lowerCommand.includes('structure')) {
      this.createBuilding(command, lowerCommand);
    } else if (lowerCommand.includes('bridge')) {
      this.createBridge(command, lowerCommand);
    } else if (lowerCommand.includes('car') || lowerCommand.includes('vehicle')) {
      this.createVehicle(command, lowerCommand);
    } else {
      // General object creation
      this.createFromDescription(command);
      this.showRosieResponse(`Creating: ${command}`);
    }
  }
  setTimeOfDay(timeOfDay) {
    if (timeOfDay === 'night') {
      this.scene.background = new THREE.Color(0x191970);
      this.scene.fog.color = new THREE.Color(0x191970);
      // Reduce light intensity
      this.scene.children.forEach(child => {
        if (child.isDirectionalLight) {
          child.intensity = 0.3;
          child.color = new THREE.Color(0x4169E1);
        }
      });
    } else {
      this.scene.background = new THREE.Color(0x87CEEB);
      this.scene.fog.color = new THREE.Color(0x87CEEB);
      // Restore day lighting
      this.scene.children.forEach(child => {
        if (child.isDirectionalLight) {
          child.intensity = 0.8;
          child.color = new THREE.Color(0xffffff);
        }
      });
    }
  }
  addWeatherEffect(effect) {
    if (effect === 'rain') {
      this.scene.fog.density = 0.02;
      this.scene.fog.near = 50;
      this.scene.fog.far = 300;
    } else if (effect === 'fog') {
      this.scene.fog.density = 0.01;
      this.scene.fog.near = 20;
      this.scene.fog.far = 200;
    }
  }
  createVegetation(command, lowerCommand) {
    let treeCount = 1;
    if (lowerCommand.includes('forest')) treeCount = 20;
    else if (lowerCommand.includes('grove')) treeCount = 10;
    
    for (let i = 0; i < treeCount; i++) {
      const tree = this.objectCreator.createFromDescription('tall pine tree');
      if (tree) {
        // Spread trees around
        tree.position.x = (Math.random() - 0.5) * 100;
        tree.position.z = (Math.random() - 0.5) * 100;
        tree.position.y = 0;
        this.createdObjects.push(tree);
      }
    }
    
    this.showRosieResponse(`Created ${treeCount} trees. ${treeCount > 10 ? 'That\'s a nice forest!' : 'Looking good!'}`);
    this.updateObjectCount();
  }
  createBuilding(command, lowerCommand) {
    const building = this.objectCreator.createFromDescription(command);
    if (building) {
      this.placeObject(building);
      this.showRosieResponse("Building created! Click and drag to position it where you'd like.");
    }
  }
  createBridge(command, lowerCommand) {
    // Extract length if specified
    let length = 30;
    const lengthMatch = command.match(/(\d+)\s*m/);
    if (lengthMatch) {
      length = parseInt(lengthMatch[1]);
    }
    
    const bridge = this.objectCreator.createComplexObject(`bridge ${length}m long`, {});
    if (bridge) {
      this.placeObject(bridge);
      this.showRosieResponse(`Created a ${length}m bridge! Perfect for crossing water.`);
    }
  }
  createVehicle(command, lowerCommand) {
    const vehicle = this.objectCreator.createFromDescription(command);
    if (vehicle) {
      this.placeObject(vehicle);
      this.showRosieResponse("Vehicle created! It has basic physics and can be driven with WASD keys when selected.");
    }
  }
  showRosieResponse(message) {
    const responseDiv = document.getElementById('rosieResponse');
    responseDiv.textContent = `Rosie: ${message}`;
    responseDiv.style.display = 'block';
    
    // Hide after 5 seconds
    setTimeout(() => {
      responseDiv.style.display = 'none';
    }, 5000);
  }
  handleGlobalHotkeys(e) {
    // Prevent default behavior for our hotkeys
    switch(e.code) {
      case 'KeyZ':
        if (e.ctrlKey && !e.shiftKey) {
          e.preventDefault();
          this.historyManager.undo();
        } else if (e.ctrlKey && e.shiftKey) {
          e.preventDefault();
          this.historyManager.redo();
        }
        break;
      case 'KeyY':
        if (e.ctrlKey) {
          e.preventDefault();
          this.historyManager.redo();
        }
        break;
      case 'F1':
        e.preventDefault();
        this.togglePanel('library');
        break;
      case 'F2':
        e.preventDefault();
        this.togglePanel('properties');
        break;
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
          this.takeCleanScreenshot();
        }
        break;
      case 'KeyK':
        if (e.ctrlKey) {
          e.preventDefault();
          this.showCommandPalette();
        }
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
      case 'Delete':
        if (e.ctrlKey) {
          e.preventDefault();
          this.clearAll();
        }
        break;
      case 'Escape':
        this.hideCommandPalette();
        this.hideQuickPeek();
        break;
      case 'F1':
        e.preventDefault();
        this.quickPeekPanel('library');
        break;
      case 'F2':
        e.preventDefault();
        this.quickPeekPanel('properties');
        break;
      case 'F3':
        if (e.shiftKey) {
          e.preventDefault();
          this.toggleAISuggestions();
        }
        break;
    }
  }
  handleGlobalHotkeysUp(e) {
    // No special handling needed for Tab anymore
  }
  toggleImmersiveMode() {
    this.immersiveMode = !this.immersiveMode;
    
    if (this.immersiveMode) {
      document.body.classList.add('immersive-mode');
    } else {
      document.body.classList.remove('immersive-mode');
      this.hideAllPanels();
    }
    
    // Update UI control button state
    this.updateUIControlButtons();
    
    this.showToast(`UI ${this.immersiveMode ? 'Hidden' : 'Shown'}`, 'info');
    this.saveUIState();
  }
  toggleHUD() {
    this.hideHUD = !this.hideHUD;
    
    if (this.hideHUD) {
      document.body.classList.add('hide-hud');
    } else {
      document.body.classList.remove('hide-hud');
    }
    
    // Update UI control button state
    this.updateUIControlButtons();
    
    this.showToast(`HUD ${this.hideHUD ? 'Hidden' : 'Shown'}`, 'info');
    this.saveUIState();
  }
  showPanel(panelType) {
    const panel = document.getElementById(panelType + 'Panel');
    if (panel) {
      panel.classList.add('force-show');
    }
  }
  hidePanel(panelType) {
    const panel = document.getElementById(panelType + 'Panel');
    if (panel) {
      panel.classList.remove('force-show');
    }
  }
  togglePanel(panelType) {
    const panel = document.getElementById(panelType + 'Panel');
    if (panel) {
      panel.classList.toggle('force-show');
    }
  }
  hideAllPanels() {
    document.getElementById('libraryPanel').classList.remove('force-show');
    document.getElementById('propertiesPanel').classList.remove('force-show');
    this.hideQuickPeek();
  }
  quickPeekPanel(panelType) {
    const panel = document.getElementById(panelType + 'Panel');
    if (!panel) return;
    
    // Clear any existing quick peek
    this.hideQuickPeek();
    
    // Show panel with quick peek style
    panel.classList.add('quick-peek');
    
    // Set up mouse leave handler
    const handleMouseLeave = () => {
      this.hideQuickPeek();
      panel.removeEventListener('mouseleave', handleMouseLeave);
    };
    panel.addEventListener('mouseleave', handleMouseLeave);
    
    // Auto-hide after 3 seconds
    this.quickPeekTimeout = setTimeout(() => {
      this.hideQuickPeek();
      panel.removeEventListener('mouseleave', handleMouseLeave);
    }, 3000);
    
    this.showToast(`Quick peek: ${panelType} panel`, 'info');
  }
  hideQuickPeek() {
    document.getElementById('libraryPanel').classList.remove('quick-peek');
    document.getElementById('propertiesPanel').classList.remove('quick-peek');
    
    if (this.quickPeekTimeout) {
      clearTimeout(this.quickPeekTimeout);
      this.quickPeekTimeout = null;
    }
  }
  showCommandPalette() {
    document.getElementById('commandPalette').classList.add('show');
  }
  hideCommandPalette() {
    document.getElementById('commandPalette').classList.remove('show');
  }
  executeCommandPaletteAction(action) {
    switch(action) {
      case 'screenshot':
        this.takeCleanScreenshot();
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
        this.clearAll();
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
  takeCleanScreenshot() {
    // Hide all UI elements temporarily
    const originalImmersive = this.immersiveMode;
    const originalHUD = this.hideHUD;
    
    // Apply screenshot mode
    document.body.classList.add('screenshot-mode', 'immersive-mode', 'hide-hud');
    this.hideAllPanels();
    this.hideQuickPeek();
    
    // Temporarily hide console for screenshot
    const console = document.getElementById('consolePanel');
    const originalConsoleDisplay = console.style.display;
    console.style.display = 'none';
    
    // Wait a frame for UI to hide, then capture
    requestAnimationFrame(() => {
      const canvas = this.renderer.domElement;
      const link = document.createElement('a');
      link.download = `worldsmith_screenshot_${Date.now()}.png`;
      link.href = canvas.toDataURL();
      link.click();
      
      // Restore UI state
      document.body.classList.remove('screenshot-mode');
      console.style.display = originalConsoleDisplay;
      
      if (!originalImmersive) {
        document.body.classList.remove('immersive-mode');
      }
      if (!originalHUD) {
        document.body.classList.remove('hide-hud');
      }
      
      this.showToast("Clean screenshot saved!", 'success');
    });
  }
  saveWorld() {
    const historyData = this.historyManager.serializeHistory();
    this.worldData.saveWorld(this.createdObjects, historyData);
    this.showToast("World saved successfully!", 'success');
  }
  loadWorld() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          const worldData = await this.worldData.loadWorld(file, this.objectCreator, this.scene, this.createdObjects);
          if (worldData && worldData.historyData) {
            this.historyManager.deserializeHistory(worldData.historyData);
          } else {
            this.historyManager.clearHistory();
          }
          this.updateObjectCount();
          this.showToast("World loaded successfully!", 'success');
        } catch (error) {
          this.showToast("Failed to load world: " + error.message, 'warning');
        }
      }
    });
    input.click();
  }
  showAIHelp() {
    this.aiAgent.respond(`🤖 Hi! I'm your AI co-creator. Here's what I can help you with:
✨ **Natural Language Creation**: Just tell me what you want! Examples:
• "Create a red house with a blue roof"
• "Build a bridge 30 meters long"
• "Add a forest on the north side"
🎛️ **Smart Modifications**: Select objects and ask me to change them:
• "Make it bigger and green"
• "Move it to the center"
🌍 **Environment Control**: 
• "Make it night time"
• "Add rain and fog"
🔄 **Duplication**: 
• "Copy this 5 times in a circle"
• "Create 10 trees in a line"
Just speak naturally - I understand context and can help bring your creative vision to life!`);
  }
  toggleAISuggestions() {
    const enabled = !this.aiAgent.autonomousBehaviors.enabled;
    this.aiAgent.enableAutonomousBehavior(enabled);
    this.showToast(`AI Suggestions ${enabled ? 'Enabled' : 'Disabled'}`, 'info');
  }
  // Toast notification system
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // Trigger animation
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
  // UI State persistence
  saveUIState() {
    const uiState = {
      immersiveMode: this.immersiveMode,
      hideHUD: this.hideHUD
    };
    localStorage.setItem('worldsmith_ui_state', JSON.stringify(uiState));
  }
  loadUIState() {
    try {
      const saved = localStorage.getItem('worldsmith_ui_state');
      if (saved) {
        const uiState = JSON.parse(saved);
        this.immersiveMode = uiState.immersiveMode !== undefined ? uiState.immersiveMode : true;
        this.hideHUD = uiState.hideHUD !== undefined ? uiState.hideHUD : false;
        
        // Apply loaded state
        if (this.immersiveMode) {
          document.body.classList.add('immersive-mode');
        } else {
          document.body.classList.remove('immersive-mode');
        }
        
        if (this.hideHUD) {
          document.body.classList.add('hide-hud');
        } else {
          document.body.classList.remove('hide-hud');
        }
        
        this.updateUIControlButtons();
      }
    } catch (error) {
      console.warn('Failed to load UI state:', error);
    }
  }
  updateUIControlButtons() {
    const uiBtn = document.getElementById('uiToggleBtn');
    const hudBtn = document.getElementById('hudToggleBtn');
    
    if (uiBtn) {
      uiBtn.style.opacity = this.immersiveMode ? '0.6' : '1';
      uiBtn.textContent = this.immersiveMode ? 'UI-' : 'UI+';
    }
    
    if (hudBtn) {
      hudBtn.style.opacity = this.hideHUD ? '0.6' : '1';
      hudBtn.textContent = this.hideHUD ? 'HUD-' : 'HUD+';
    }
  }
  createShape(shapeType) {
    const obj = this.objectCreator.createShape(shapeType);
    if (obj) {
      this.placeObject(obj);
    }
  }

  createAsset(assetType) {
    const obj = this.objectCreator.createAsset(assetType);
    if (obj) {
      this.placeObject(obj);
    }
  }

  createFromDescription(description) {
    this.historyManager.startTransaction(`Create: ${description}`);
    const obj = this.objectCreator.createFromDescription(description);
    if (obj) {
      this.placeObject(obj);
      // Record creation in history
      this.dispatchObjectEvent('objectCreated', { object: obj });
    }
    this.historyManager.commitTransaction();
  }

  placeObject(object) {
    // Position object in front of player
    const playerDirection = new THREE.Vector3();
    this.player.getWorldDirection(playerDirection);
    
    object.position.copy(this.player.position);
    object.position.add(playerDirection.multiplyScalar(5));
    object.position.y = 1;
    
    this.createdObjects.push(object);
    this.updateObjectCount();
    
    // Dispatch creation event
    this.dispatchObjectEvent('objectCreated', { object: object });
  }

  onMouseClick(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.createdObjects, true);
    if (intersects.length > 0) {
      const clickedObject = intersects[0].object;
      // Find root object
      let rootObject = clickedObject;
      while (rootObject.parent && rootObject.parent !== this.scene) {
        rootObject = rootObject.parent;
      }
      
      if (this.selectedObject === rootObject) {
        // Delete object on second click
        this.deleteObject(rootObject);
      } else {
        // Select object
        this.selectObject(rootObject);
      }
    } else {
      this.deselectObject();
    }
  }

  selectObject(object) {
    this.deselectObject();
    this.selectedObject = object;
    
    // Add selection indicator
    const box = new THREE.BoxHelper(object, 0x00ff00);
    box.name = 'selectionBox';
    this.scene.add(box);
    object.userData.selectionBox = box;
    
    // Show properties panel
    this.showObjectProperties(object);
    
    // Clear any existing hide timeout
    if (this.hidePropertiesTimeout) {
      clearTimeout(this.hidePropertiesTimeout);
      this.hidePropertiesTimeout = null;
    }
    // Setup drag handling for history coalescing
    this.setupObjectDragHandling(object);
  }
  showObjectProperties(object) {
    const propertiesDiv = document.getElementById('objectProperties');
    propertiesDiv.style.display = 'block';
    
    // Fill in current values
    document.getElementById('objName').value = object.userData.name || 'Untitled';
    document.getElementById('posX').value = object.position.x.toFixed(1);
    document.getElementById('posY').value = object.position.y.toFixed(1);
    document.getElementById('posZ').value = object.position.z.toFixed(1);
    document.getElementById('rotX').value = THREE.MathUtils.radToDeg(object.rotation.x).toFixed(0);
    document.getElementById('rotY').value = THREE.MathUtils.radToDeg(object.rotation.y).toFixed(0);
    document.getElementById('rotZ').value = THREE.MathUtils.radToDeg(object.rotation.z).toFixed(0);
    document.getElementById('scale').value = object.scale.x.toFixed(1);
    
    // Set color if object has material
    if (object.material && object.material.color) {
      document.getElementById('objColor').value = '#' + object.material.color.getHexString();
    }
  }
  updateSelectedObjectProperty(property, value) {
    if (!this.selectedObject) return;
    
    const obj = this.selectedObject;
    const oldTransform = {
      pos: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
      rot: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
      scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z }
    };
    
    const numValue = parseFloat(value);
    
    switch(property) {
      case 'posX': obj.position.x = numValue; break;
      case 'posY': obj.position.y = numValue; break;
      case 'posZ': obj.position.z = numValue; break;
      case 'rotX': obj.rotation.x = THREE.MathUtils.degToRad(numValue); break;
      case 'rotY': obj.rotation.y = THREE.MathUtils.degToRad(numValue); break;
      case 'rotZ': obj.rotation.z = THREE.MathUtils.degToRad(numValue); break;
      case 'scale': obj.scale.setScalar(numValue); break;
    }
    
    const newTransform = {
      pos: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
      rot: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
      scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z }
    };
    
    // Record transform change
    this.historyManager.startTransaction(`Modify ${property}`);
    this.historyManager.recordTransformChange(obj, oldTransform, newTransform);
    this.historyManager.commitTransaction();
    
    // Update selection box
    if (obj.userData.selectionBox) {
      obj.userData.selectionBox.update();
    }
  }
  updateSelectedObjectColor(hexColor) {
    if (!this.selectedObject || !this.selectedObject.material) return;
    
    const oldColor = this.selectedObject.material.color.getHex();
    const newColor = parseInt(hexColor.replace('#', '0x'));
    
    this.selectedObject.material.color.setHex(newColor);
    
    // Record property change
    this.historyManager.startTransaction('Change Color');
    this.historyManager.recordPropertyChange(this.selectedObject, 'color', oldColor, newColor);
    this.historyManager.commitTransaction();
  }

  deselectObject() {
    // Clear selection gizmor
    if (this.selectedObject && this.selectedObject.userData.selectionBox) {
      this.scene.remove(this.selectedObject.userData.selectionBox);
      delete this.selectedObject.userData.selectionBox;
    }
    this.selectedObject = null;
    
    // Hide properties panel after 3 seconds
    if (this.hidePropertiesTimeout) {
      clearTimeout(this.hidePropertiesTimeout);
    }
    
    this.hidePropertiesTimeout = setTimeout(() => {
      document.getElementById('objectProperties').style.display = 'none';
      this.hidePanel('properties');
    }, 3000);
  }

  deleteObject(object) {
    const index = this.createdObjects.indexOf(object);
    if (index > -1) {
      // Record deletion in history
      this.historyManager.startTransaction('Delete Object');
      const snapshot = this.historyManager.createObjectSnapshot(object);
      
      this.createdObjects.splice(index, 1);
      this.scene.remove(object);
      if (this.selectedObject === object) {
        this.selectedObject = null;
      }
      
      this.dispatchObjectEvent('objectDeleted', { object: object, snapshot: snapshot });
      this.historyManager.commitTransaction();
      this.updateObjectCount();
    }
  }

  clearAll() {
    if (this.createdObjects.length === 0) return;
    
    this.historyManager.startTransaction('Clear All Objects');
    
    // Record deletion of all objects
    this.createdObjects.forEach(obj => {
      const snapshot = this.historyManager.createObjectSnapshot(obj);
      this.historyManager.addChange({
        type: 'delete',
        id: snapshot.id,
        snapshotOld: snapshot
      });
      this.scene.remove(obj);
    });
    
    this.createdObjects = [];
    this.selectedObject = null;
    this.historyManager.commitTransaction();
    this.updateObjectCount();
  }

  updateObjectCount() {
    document.getElementById('objectCount').textContent = this.createdObjects.length;
    
    // Update triangle count estimate
    let triangleCount = 0;
    this.createdObjects.forEach(obj => {
      if (obj.geometry) {
        triangleCount += obj.geometry.attributes.position.count / 3;
      }
    });
    document.getElementById('triangleCount').textContent = Math.floor(triangleCount);
  }

  updatePlayerMovement(deltaTime) {
    const moveSpeed = 8;
    const movement = new THREE.Vector3();
    
    if (this.keys['KeyW'] || this.keys['ArrowUp']) movement.z -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) movement.z += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) movement.x -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) movement.x += 1;
    
    if (movement.length() > 0) {
      movement.normalize();
      movement.multiplyScalar(moveSpeed * deltaTime);
      this.player.position.add(movement);
    }
  }

  updateFPS() {
    this.frameCount++;
    const now = performance.now();
    
    if (now - this.lastFPSUpdate >= 1000) {
      const fps = Math.round(this.frameCount * 1000 / (now - this.lastFPSUpdate));
      document.getElementById('fps').textContent = fps;
      this.frameCount = 0;
      this.lastFPSUpdate = now;
    }
  }

  update() {
    if (!this.isRunning) return;

    const deltaTime = this.clock.getDelta();
    
    this.updatePlayerMovement(deltaTime);
    this.cameraController.update();
    this.updateFPS();
    
    // AI Agent autonomous behavior check
    this.aiAgent.checkForAutonomousSuggestions();
    
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.update());
  }

  setupObjectDragHandling(object) {
    // This would be enhanced with actual drag detection
    // For now, we'll use property changes as proxies for drag operations
  }
  // Dispatch custom events for history tracking
  dispatchObjectEvent(eventType, detail) {
    const event = new CustomEvent(eventType, { detail });
    document.dispatchEvent(event);
  }
  start() {
    this.isRunning = true;
    this.updateUIControlButtons();
    this.historyManager.updateUI();
    this.update();
  }

  pause() {
    this.isRunning = false;
  }

  resume() {
    if (!this.isRunning) {
      this.isRunning = true;
      this.clock.start();
      this.update();
    }
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  // Library functionality methods
  getItemTemplate(category, item) {
    const templates = {
      environment: {
        terrain: "Add gentle hills around me; flatten a 10 m circle under the player",
        water: "Create a lake 40 m wide in front of me; shore slope 15°",
        sky: "Set time to sunrise with warm light",
        weather: "Enable light fog and wind 3 m/s"
      },
      buildings: {
        house: "Create a stone house 6x8x4 m with one door and one window, 5 m ahead",
        wall: "Build a stone wall 10 m long and 3 m high",
        tower: "Construct a round stone tower 15 m tall",
        castle: "Build a medieval castle with walls and towers"
      },
      vegetation: {
        tree: "Add a tall oak tree",
        forest: "Add a pine forest on the north half, density 0.6",
        grass: "Create a grassy meadow 20 m wide",
        flowers: "Plant colorful wildflowers in patches"
      },
      props: {
        table: "Place a round wooden table, 1.2 m diameter, near the entrance",
        chair: "Add a wooden chair beside the table",
        lamp: "Place a torch lamp for lighting",
        barrel: "Add a wooden storage barrel"
      },
      npcs: {
        guard: "Spawn a guard NPC patrolling between the house and the bridge",
        villager: "Add a friendly villager NPC",
        merchant: "Place a merchant NPC with a cart",
        animal: "Spawn a horse near the stable"
      },
      vehicles: {
        boat: "Spawn a small boat at the lake shore",
        cart: "Place a wooden cart on the path",
        carriage: "Add an elegant horse carriage",
        wagon: "Spawn a supply wagon"
      },
      fx: {
        torch: "Add torches along the bridge every 5 m",
        particles: "Create magical sparkle effects",
        smoke: "Add smoke rising from the chimney",
        magic: "Place glowing magic runes"
      }
    };
    
    return templates[category]?.[item] || `Create a ${item}`;
  }
  
  getItemPresets(category, item) {
    const presets = {
      environment: {
        terrain: [
          "Add rolling hills with gentle slopes",
          "Create dramatic mountain peaks nearby",
          "Flatten the area and add small mounds"
        ],
        water: [
          "Create a small pond 10 m across",
          "Add a flowing river through the scene",
          "Build a large lake 80 m wide"
        ],
        sky: [
          "Set to bright noon with clear skies",
          "Create a dramatic sunset scene",
          "Make it a starry night"
        ],
        weather: [
          "Add light morning mist",
          "Create a gentle rain shower",
          "Enable strong winds and storm clouds"
        ]
      },
      buildings: {
        house: [
          "Small cottage with thatched roof",
          "Large manor house with multiple rooms",
          "Medieval stone house with tower"
        ]
      },
      vegetation: {
        forest: [
          "Dense dark forest",
          "Light birch grove",
          "Mixed woodland with clearings"
        ]
      }
    };
    
    const categoryPresets = presets[category]?.[item];
    return categoryPresets || [
      `Small ${item}`,
      `Medium ${item}`,
      `Large ${item}`
    ];
  }
  
  prefillCommandBar(btn) {
    const category = btn.dataset.category;
    const item = btn.dataset.item;
    const template = this.getItemTemplate(category, item);
    
    const commandInput = document.getElementById('commandInput');
    commandInput.value = template;
    commandInput.classList.add('prefilled');
    commandInput.focus();
    
    // Remove prefilled styling after 8 seconds
    setTimeout(() => {
      commandInput.classList.remove('prefilled');
    }, 8000);
    
    this.showToast(`Template loaded: ${item}`, 'info');
  }
  
  executeItemAction(btn) {
    const category = btn.dataset.category;
    const item = btn.dataset.item;
    const template = this.getItemTemplate(category, item);
    
    this.disableLibraryButtons();
    
    // Execute the command through AI agent
    this.aiAgent.processCommand(template);
    
    setTimeout(() => {
      this.enableLibraryButtons();
    }, 1000);
    
    this.showToast(`Executing: ${item}`, 'success');
  }
  
  showPresetPicker(btn) {
    const category = btn.dataset.category;
    const item = btn.dataset.item;
    const presets = this.getItemPresets(category, item);
    
    const picker = document.getElementById('presetPicker');
    const title = document.getElementById('presetTitle');
    const options = document.getElementById('presetOptions');
    
    title.textContent = `${item.charAt(0).toUpperCase() + item.slice(1)} Options`;
    options.innerHTML = '';
    
    presets.forEach((preset, index) => {
      const button = document.createElement('button');
      button.className = 'preset-option';
      button.textContent = preset;
      button.addEventListener('click', () => {
        this.executePreset(preset);
        this.hidePresetPicker();
      });
      options.appendChild(button);
    });
    
    picker.classList.add('show');
    
    // Close on click outside
    const closeHandler = (e) => {
      if (!picker.contains(e.target)) {
        this.hidePresetPicker();
        document.removeEventListener('click', closeHandler);
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', closeHandler);
    }, 100);
  }
  
  hidePresetPicker() {
    document.getElementById('presetPicker').classList.remove('show');
  }
  
  executePreset(presetCommand) {
    this.disableLibraryButtons();
    this.aiAgent.processCommand(presetCommand);
    setTimeout(() => {
      this.enableLibraryButtons();
    }, 1000);
    this.showToast('Preset executed!', 'success');
  }
  
  disableLibraryButtons() {
    document.querySelectorAll('.item-btn, #quickScreenshot, #quickSaveWorld, #quickLoadWorld').forEach(btn => {
      btn.disabled = true;
    });
  }
  
  enableLibraryButtons() {
    document.querySelectorAll('.item-btn, #quickScreenshot, #quickSaveWorld, #quickLoadWorld').forEach(btn => {
      btn.disabled = false;
    });
  }
  
  quickSaveWorld() {
    try {
      // Save with history and UI state
      const historyData = this.historyManager.serializeHistory();
      const uiState = {
        immersiveMode: this.immersiveMode,
        hideHUD: this.hideHUD
      };
      
      const worldData = {
        name: 'Worldsmith Save',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        objects: [],
        historyData: historyData,
        uiState: uiState
      };
      
      // Serialize objects
      this.createdObjects.forEach(obj => {
        const objectData = {
          type: obj.userData.type || 'unknown',
          position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
          rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
          scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z }
        };
        
        if (obj.userData.shapeType) objectData.shapeType = obj.userData.shapeType;
        if (obj.userData.assetType) objectData.assetType = obj.userData.assetType;
        if (obj.userData.description) objectData.description = obj.userData.description;
        if (obj.material && obj.material.color) objectData.color = obj.material.color.getHex();
        
        worldData.objects.push(objectData);
      });
      
      // Save to localStorage
      localStorage.setItem('worldSave', JSON.stringify(worldData));
      
      // Download as file
      const dataStr = JSON.stringify(worldData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = 'world.json';
      link.click();
      
      this.showToast('World saved!', 'success');
    } catch (error) {
      this.showToast('Failed to save world', 'warning');
      console.error('Save error:', error);
    }
  }
  
  quickLoadWorld() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          await this.loadWorldFromFile(file);
        } catch (error) {
          this.showToast('Failed to load world file', 'warning');
        }
      } else {
        // No file selected, try localStorage
        this.loadWorldFromLocalStorage();
      }
    });
    
    // Trigger file picker
    input.click();
  }
  
  async loadWorldFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const worldData = JSON.parse(e.target.result);
          this.applyLoadedWorld(worldData);
          this.showToast('World loaded!', 'success');
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
  
  loadWorldFromLocalStorage() {
    try {
      const savedData = localStorage.getItem('worldSave');
      if (savedData) {
        const worldData = JSON.parse(savedData);
        this.applyLoadedWorld(worldData);
        this.showToast('World loaded from auto-save!', 'success');
      } else {
        this.showToast('No auto-save found', 'info');
      }
    } catch (error) {
      this.showToast('Failed to load auto-save', 'warning');
    }
  }
  
  applyLoadedWorld(worldData) {
    // Clear existing objects
    this.createdObjects.forEach(obj => {
      this.scene.remove(obj);
    });
    this.createdObjects = [];
    
    // Load objects
    worldData.objects.forEach(objData => {
      let newObj;
      
      if (objData.type === 'shape') {
        newObj = this.objectCreator.createShape(objData.shapeType);
      } else if (objData.type === 'asset') {
        newObj = this.objectCreator.createAsset(objData.assetType);
      } else if (objData.type === 'complex') {
        newObj = this.objectCreator.createFromDescription(objData.description);
      }
      
      if (newObj) {
        newObj.position.set(objData.position.x, objData.position.y, objData.position.z);
        newObj.rotation.set(objData.rotation.x, objData.rotation.y, objData.rotation.z);
        newObj.scale.set(objData.scale.x, objData.scale.y, objData.scale.z);
        
        if (objData.color && newObj.material) {
          newObj.material.color.setHex(objData.color);
        }
        
        this.createdObjects.push(newObj);
      }
    });
    
    // Restore history if available
    if (worldData.historyData) {
      this.historyManager.deserializeHistory(worldData.historyData);
    } else {
      this.historyManager.clearHistory();
    }
    
    // Restore UI state if available
    if (worldData.uiState) {
      this.immersiveMode = worldData.uiState.immersiveMode;
      this.hideHUD = worldData.uiState.hideHUD;
      this.updateUIControlButtons();
    }
    
    this.updateObjectCount();
  }
  
  // UI Auto-hide system
  setupUIAutoHide() {
    let mouseTimer;
    const uiControls = document.getElementById('uiControls');
    
    const handleMouseMove = (e) => {
      const rect = window.innerWidth;
      const height = window.innerHeight;
      const distanceFromEdge = Math.min(
        rect - e.clientX,  // distance from right edge
        height - e.clientY // distance from bottom edge
      );
      
      if (distanceFromEdge <= 80) {
        uiControls.classList.add('show');
        clearTimeout(mouseTimer);
      } else {
        clearTimeout(mouseTimer);
        mouseTimer = setTimeout(() => {
          uiControls.classList.remove('show');
        }, 1000);
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
  }
  
  // Command bar behavior
  setupCommandBarBehavior() {
    const consolePanel = document.getElementById('consolePanel');
    let hideTimer;
    
    const showCommandBar = () => {
      consolePanel.classList.add('show');
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        consolePanel.classList.remove('show');
      }, 6000);
    };
    
    const hideCommandBar = () => {
      clearTimeout(hideTimer);
      consolePanel.classList.remove('show');
    };
    
    // Show on Enter key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !consolePanel.classList.contains('show')) {
        e.preventDefault();
        showCommandBar();
        document.getElementById('commandInput').focus();
      }
    });
    
    // Show on CMD button click
    document.getElementById('consoleBtn').addEventListener('click', () => {
      if (consolePanel.classList.contains('show')) {
        hideCommandBar();
      } else {
        showCommandBar();
        document.getElementById('commandInput').focus();
      }
    });
    
    // Reset timer on interaction
    document.getElementById('commandInput').addEventListener('focus', showCommandBar);
    document.getElementById('commandInput').addEventListener('input', showCommandBar);
  }
  
  // Recording widget
  setupRecordingWidget() {
    let isRecording = false;
    let recordingStartTime = 0;
    let recordingTimer;
    
    const widget = document.getElementById('recordingWidget');
    const timeDisplay = document.getElementById('recordingTime');
    
    const updateTimer = () => {
      const elapsed = Date.now() - recordingStartTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'r' || e.key === 'R') {
        if (!isRecording) {
          // Start recording
          isRecording = true;
          recordingStartTime = Date.now();
          widget.classList.add('show');
          recordingTimer = setInterval(updateTimer, 1000);
          this.showToast('Recording started', 'info');
        } else {
          // Stop recording
          isRecording = false;
          widget.classList.remove('show');
          clearInterval(recordingTimer);
          this.showToast('Recording stopped', 'info');
        }
      }
    });
  }
  
  // Title fadeout
  setupTitleFadeout() {
    const title = document.getElementById('title');
    
    // Fade out title after 3 seconds in immersive mode
    setTimeout(() => {
      if (this.immersiveMode) {
        title.classList.add('fade-out');
      }
    }, 3000);
  }
  
  // Update UI control button states
  updateUIControlButtons() {
    const uiBtn = document.getElementById('uiToggleBtn');
    const hudBtn = document.getElementById('hudToggleBtn');
    
    if (uiBtn) {
      if (this.immersiveMode) {
        uiBtn.classList.remove('active');
      } else {
        uiBtn.classList.add('active');
      }
    }
    
    if (hudBtn) {
      if (this.hideHUD) {
        hudBtn.classList.remove('active');
      } else {
        hudBtn.classList.add('active');
      }
    }
  }
}

