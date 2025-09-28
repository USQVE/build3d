

import * as THREE from 'three';

export class AIAgent {
  constructor(worldsmith) {
    this.worldsmith = worldsmith;
    this.personality = {
      name: "Rosie",
      traits: ["helpful", "creative", "encouraging", "knowledgeable"],
      mood: "enthusiastic"
    };
    
    // Conversation context and memory
    this.conversationHistory = [];
    this.worldContext = {
      objectCount: 0,
      lastCreatedObject: null,
      userPreferences: {},
      commonPatterns: new Map()
    };
    
    // Natural language processing patterns
    this.commandPatterns = this.initializeCommandPatterns();
    this.suggestionEngine = new SuggestionEngine(this);
    
    // Autonomous behavior system
    this.autonomousBehaviors = {
      enabled: true,
      lastSuggestionTime: 0,
      suggestionInterval: 30000, // 30 seconds
      helpfulHints: true
    };
    
    this.initializeAgent();
  }

  initializeAgent() {
    // Show welcome message
    setTimeout(() => {
      this.respond("Welcome to Worldsmith! I'm Rosie, your AI co-creator. Tell me what you'd like to build and I'll help bring your vision to life!");
    }, 2000);
  }

  initializeCommandPatterns() {
    return {
      // Creation verbs
      creation: [
        /^(create|make|build|add|spawn|generate|place)\s+(.+)/i,
        /^i\s+(want|need)\s+(.+)/i,
        /^let's\s+(make|create|build)\s+(.+)/i
      ],
      
      // Modification verbs
      modification: [
        /^(modify|change|edit|update|transform)\s+(.+)/i,
        /^make\s+(.+)\s+(bigger|smaller|taller|wider|different)/i
      ],
      
      // Movement and positioning
      movement: [
        /^(move|relocate|position)\s+(.+)\s+(to|at|near)\s+(.+)/i,
        /^put\s+(.+)\s+(on|in|at|near|beside|behind|in front of)\s+(.+)/i
      ],
      
      // Duplication and patterns
      duplication: [
        /^(copy|duplicate|clone)\s+(.+)(\s+(\d+)\s+times?)?/i,
        /^create\s+(\d+)\s+(.+)\s+in\s+a\s+(line|grid|circle|row)/i
      ],
      
      // Environment modifications
      environment: [
        /^(set|make it|change to)\s+(day|night|dawn|dusk|morning|evening)/i,
        /^add\s+(rain|snow|fog|wind|storm|sunshine)/i,
        /^(clear|remove)\s+(weather|fog|rain)/i
      ],
      
      // Questions and help
      questions: [
        /^(what|how|why|when|where|can you)\s+(.+)/i,
        /^(help|assist|show me|explain)\s*(.*)/i
      ]
    };
  }

  // Enhanced natural language processing
  processCommand(input) {
    const command = input.trim();
    const lowerCommand = command.toLowerCase();
    
    // Add to conversation history
    this.conversationHistory.push({
      type: 'user',
      content: command,
      timestamp: Date.now()
    });

    // Analyze command intent
    const intent = this.analyzeIntent(command);
    const entities = this.extractEntities(lowerCommand);
    const context = this.getContext();

    // Process based on intent
    switch(intent.type) {
      case 'creation':
        return this.handleCreation(intent, entities, context);
      case 'modification':
        return this.handleModification(intent, entities, context);
      case 'movement':
        return this.handleMovement(intent, entities, context);
      case 'duplication':
        return this.handleDuplication(intent, entities, context);
      case 'environment':
        return this.handleEnvironment(intent, entities, context);
      case 'question':
        return this.handleQuestion(intent, entities, context);
      default:
        return this.handleGeneral(command, entities, context);
    }
  }

  analyzeIntent(command) {
    for (const [intentType, patterns] of Object.entries(this.commandPatterns)) {
      for (const pattern of patterns) {
        const match = command.match(pattern);
        if (match) {
          return {
            type: intentType,
            confidence: 0.9,
            matches: match,
            originalCommand: command
          };
        }
      }
    }
    
    return {
      type: 'general',
      confidence: 0.5,
      originalCommand: command
    };
  }

  extractEntities(command) {
    const entities = {
      objects: [],
      colors: [],
      sizes: [],
      positions: [],
      quantities: [],
      materials: []
    };

    // Object detection
    const objectKeywords = [
      'house', 'building', 'tree', 'car', 'table', 'chair', 'bridge', 'tower',
      'castle', 'boat', 'plane', 'rock', 'flower', 'bush', 'fence', 'wall',
      'door', 'window', 'roof', 'garden', 'pond', 'fountain', 'statue'
    ];
    
    objectKeywords.forEach(obj => {
      if (command.includes(obj)) {
        entities.objects.push(obj);
      }
    });

    // Color detection
    const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'black', 'white', 'brown', 'gray', 'gold', 'silver'];
    colors.forEach(color => {
      if (command.includes(color)) {
        entities.colors.push(color);
      }
    });

    // Size detection
    const sizes = ['tiny', 'small', 'medium', 'large', 'big', 'huge', 'massive', 'giant'];
    sizes.forEach(size => {
      if (command.includes(size)) {
        entities.sizes.push(size);
      }
    });

    // Position detection
    const positions = ['center', 'middle', 'left', 'right', 'front', 'back', 'behind', 'beside', 'near', 'far', 'north', 'south', 'east', 'west'];
    positions.forEach(pos => {
      if (command.includes(pos)) {
        entities.positions.push(pos);
      }
    });

    // Quantity detection
    const numberMatch = command.match(/(\d+)/g);
    if (numberMatch) {
      entities.quantities = numberMatch.map(n => parseInt(n));
    }

    return entities;
  }

  getContext() {
    return {
      ...this.worldContext,
      objectCount: this.worldsmith.createdObjects.length,
      selectedObject: this.worldsmith.selectedObject,
      cameraPosition: this.worldsmith.camera.position.clone(),
      recentCommands: this.conversationHistory.slice(-5)
    };
  }

  handleCreation(intent, entities, context) {
    const objectToCreate = entities.objects[0] || intent.matches[2] || 'cube';
    
    // Build enhanced description
    let description = objectToCreate;
    if (entities.colors.length > 0) {
      description = `${entities.colors[0]} ${description}`;
    }
    if (entities.sizes.length > 0) {
      description = `${entities.sizes[0]} ${description}`;
    }

    // Create the object using grouped action for history
    this.worldsmith.historyManager.executeGroupedAction(`Rosie: ${description}`, () => {
      this.worldsmith.createFromDescription(description);
    });
    
    // Smart response based on context
    let response = `Created a ${description}! `;
    
    if (entities.positions.length > 0) {
      response += `I placed it ${entities.positions[0]} as requested. `;
    }
    
    // Provide helpful suggestions
    const suggestions = this.suggestionEngine.getCreationSuggestions(objectToCreate, context);
    if (suggestions.length > 0) {
      response += `💡 Suggestion: ${suggestions[0]}`;
    }

    this.respond(response);
    
    // Update world context
    this.worldContext.lastCreatedObject = objectToCreate;
    this.updatePatterns('creation', objectToCreate);
  }

  handleModification(intent, entities, context) {
    if (!context.selectedObject) {
      this.respond("Please select an object first by clicking on it, then I can help you modify it!");
      return;
    }

    const modification = intent.matches[2] || 'changed';
    
    // Apply modifications based on entities
    if (entities.colors.length > 0) {
      const color = this.getColorHex(entities.colors[0]);
      if (context.selectedObject.material) {
        context.selectedObject.material.color.setHex(color);
      }
    }

    if (entities.sizes.length > 0) {
      const sizeMultiplier = this.getSizeMultiplier(entities.sizes[0]);
      context.selectedObject.scale.multiplyScalar(sizeMultiplier);
    }

    this.respond(`Modified the selected object as requested! The ${context.selectedObject.userData.name || 'object'} has been ${modification}.`);
  }

  handleMovement(intent, entities, context) {
    if (!context.selectedObject) {
      this.respond("Please select an object first, then I can help you move it!");
      return;
    }

    // Move object based on position entities
    if (entities.positions.length > 0) {
      const position = entities.positions[0];
      const newPos = this.calculatePosition(position, context);
      context.selectedObject.position.copy(newPos);
      
      this.respond(`Moved the object to ${position}. You can also drag objects by clicking and holding!`);
    }
  }

  handleDuplication(intent, entities, context) {
    if (!context.selectedObject) {
      this.respond("Please select an object to duplicate first!");
      return;
    }

    const count = entities.quantities[0] || 3;
    const pattern = intent.matches[3] || 'line';
    
    this.createDuplicates(context.selectedObject, count, pattern);
    this.respond(`Created ${count} duplicates in a ${pattern} pattern! Looking great!`);
  }

  handleEnvironment(intent, entities, context) {
    const environmentChange = intent.matches[2] || intent.matches[1];
    
    if (environmentChange.includes('night') || environmentChange.includes('dark')) {
      this.worldsmith.setTimeOfDay('night');
      this.respond("🌙 Setting to nighttime. The moonlight creates such a peaceful atmosphere!");
    } else if (environmentChange.includes('day') || environmentChange.includes('morning')) {
      this.worldsmith.setTimeOfDay('day');
      this.respond("☀️ Brightening to daytime! Perfect lighting for building.");
    } else if (environmentChange.includes('rain') || environmentChange.includes('storm')) {
      this.worldsmith.addWeatherEffect('rain');
      this.respond("🌧️ Adding rain effect. The sound of rain makes everything more atmospheric!");
    }
  }

  handleQuestion(intent, entities, context) {
    const question = intent.matches[2] || intent.matches[1] || '';
    
    // Handle undo/redo text commands
    if (question.includes('undo') || question.includes('undo last')) {
      if (this.worldsmith.historyManager.undo()) {
        this.respond("✅ Undone! Use Ctrl+Z for quick undo.");
      } else {
        this.respond("Nothing to undo right now.");
      }
      return;
    }
    
    if (question.includes('redo')) {
      if (this.worldsmith.historyManager.redo()) {
        this.respond("✅ Redone! Use Ctrl+Y for quick redo.");
      } else {
        this.respond("Nothing to redo right now.");
      }
      return;
    }
    
    // Contextual help based on question content
    if (question.includes('control') || question.includes('move')) {
      this.respond("🎮 Use WASD to move around, mouse to look, and Space to jump. Click objects to select them, and click again to delete. You can also drag selected objects!");
    } else if (question.includes('create') || question.includes('build')) {
      this.respond("✨ Just tell me what you want to create! For example: 'create a red house', 'build a bridge 20m long', or 'add a forest on the north side'. I understand natural language!");
    } else if (question.includes('save') || question.includes('load')) {
      this.respond("💾 Use Ctrl+S to save your world or Ctrl+K to open the command palette with more options. Your creations will be saved as a JSON file!");
    } else if (question.includes('undo') || question.includes('redo') || question.includes('history')) {
      this.respond("🔄 Use Ctrl+Z to undo and Ctrl+Y to redo. I group my actions so undoing 'build bridge' removes the entire bridge!");
    } else {
      this.respond("I'm here to help you create amazing worlds! Ask me to build anything, modify objects, or change the environment. What would you like to create?");
    }
  }

  handleGeneral(command, entities, context) {
    // Group AI actions for history
    this.worldsmith.historyManager.executeGroupedAction(`Rosie: ${command}`, () => {
      // Fall back to original parsing for unrecognized commands
      this.worldsmith.parseNaturalLanguage(command);
    });
    
    // Add encouraging response
    const encouragements = [
      "Great idea! Let me work on that for you.",
      "I love your creativity! Creating that now.",
      "Excellent choice! Building that right away.",
      "That sounds wonderful! Making it happen."
    ];
    
    const response = encouragements[Math.floor(Math.random() * encouragements.length)];
    this.respond(response);
  }

  // Autonomous behavior system
  checkForAutonomousSuggestions() {
    if (!this.autonomousBehaviors.enabled) return;
    
    const now = Date.now();
    if (now - this.autonomousBehaviors.lastSuggestionTime < this.autonomousBehaviors.suggestionInterval) {
      return;
    }

    const context = this.getContext();
    const suggestion = this.suggestionEngine.getAutonomousSuggestion(context);
    
    if (suggestion) {
      this.respond(`💡 ${suggestion}`, 'suggestion');
      this.autonomousBehaviors.lastSuggestionTime = now;
    }
  }

  // Response system
  respond(message, type = 'normal') {
    const response = {
      type: 'agent',
      content: message,
      timestamp: Date.now(),
      responseType: type
    };
    
    this.conversationHistory.push(response);
    this.worldsmith.showRosieResponse(message);
    
    // Limit conversation history
    if (this.conversationHistory.length > 50) {
      this.conversationHistory = this.conversationHistory.slice(-25);
    }
  }

  // Utility methods
  getColorHex(colorName) {
    const colors = {
      red: 0xff0000, blue: 0x0000ff, green: 0x00ff00, yellow: 0xffff00,
      purple: 0x8000ff, orange: 0xff8000, pink: 0xff69b4, black: 0x333333,
      white: 0xffffff, brown: 0x8B4513, gray: 0x808080, gold: 0xffd700,
      silver: 0xc0c0c0
    };
    return colors[colorName] || 0xffffff;
  }

  getSizeMultiplier(sizeName) {
    const sizes = {
      tiny: 0.3, small: 0.6, medium: 1.0, large: 1.5,
      big: 2.0, huge: 3.0, massive: 4.0, giant: 5.0
    };
    return sizes[sizeName] || 1.0;
  }

  calculatePosition(positionName, context) {
    const basePos = context.cameraPosition.clone();
    const offsets = {
      center: new THREE.Vector3(0, 0, 0),
      left: new THREE.Vector3(-10, 0, 0),
      right: new THREE.Vector3(10, 0, 0),
      front: new THREE.Vector3(0, 0, -10),
      back: new THREE.Vector3(0, 0, 10),
      north: new THREE.Vector3(0, 0, -15),
      south: new THREE.Vector3(0, 0, 15),
      east: new THREE.Vector3(15, 0, 0),
      west: new THREE.Vector3(-15, 0, 0)
    };
    
    return basePos.add(offsets[positionName] || offsets.center);
  }

  createDuplicates(originalObject, count, pattern) {
    const clones = [];
    
    for (let i = 1; i <= count; i++) {
      const clone = originalObject.clone();
      
      switch(pattern) {
        case 'line':
          clone.position.x = originalObject.position.x + (i * 3);
          break;
        case 'grid':
          const gridSize = Math.ceil(Math.sqrt(count));
          clone.position.x = originalObject.position.x + ((i % gridSize) * 3);
          clone.position.z = originalObject.position.z + (Math.floor(i / gridSize) * 3);
          break;
        case 'circle':
          const angle = (i / count) * Math.PI * 2;
          const radius = 5;
          clone.position.x = originalObject.position.x + Math.cos(angle) * radius;
          clone.position.z = originalObject.position.z + Math.sin(angle) * radius;
          break;
      }
      
      this.worldsmith.scene.add(clone);
      this.worldsmith.createdObjects.push(clone);
      clones.push(clone);
    }
    
    this.worldsmith.updateObjectCount();
    return clones;
  }

  updatePatterns(action, object) {
    const key = `${action}_${object}`;
    const current = this.worldContext.commonPatterns.get(key) || 0;
    this.worldContext.commonPatterns.set(key, current + 1);
  }

  // Public methods
  enableAutonomousBehavior(enabled = true) {
    this.autonomousBehaviors.enabled = enabled;
    this.respond(enabled ? "Autonomous suggestions enabled! I'll offer helpful tips as you create." : "Autonomous suggestions disabled.");
  }

  getConversationHistory() {
    return this.conversationHistory;
  }

  clearHistory() {
    this.conversationHistory = [];
    this.respond("Conversation history cleared! Ready for new adventures!");
  }
}

// Suggestion Engine for contextual recommendations
class SuggestionEngine {
  constructor(aiAgent) {
    this.aiAgent = aiAgent;
    this.suggestionTemplates = this.initializeSuggestionTemplates();
  }

  initializeSuggestionTemplates() {
    return {
      creation: [
        "How about adding some {complementary} nearby?",
        "A {material} {object} would look great with that!",
        "Consider placing some {decoration} around it.",
        "You could create a whole {scene} with a few more objects!"
      ],
      
      environment: [
        "The lighting could be enhanced with some {lighting}.",
        "Adding {weather} would create more atmosphere.",
        "A {terrain} feature might complement this scene."
      ],
      
      general: [
        "Try using different colors to make objects stand out!",
        "Grouping similar objects can create interesting patterns.",
        "Don't forget you can scale and rotate objects for variety!",
        "Consider the rule of thirds when positioning key objects."
      ]
    };
  }

  getCreationSuggestions(objectType, context) {
    const suggestions = [];
    
    // Suggest complementary objects
    const complementary = this.getComplementaryObjects(objectType);
    if (complementary.length > 0) {
      suggestions.push(`Consider adding ${complementary[0]} to complete the scene.`);
    }
    
    // Suggest based on object count
    if (context.objectCount < 3) {
      suggestions.push("Your world is just getting started! Add more objects to bring it to life.");
    } else if (context.objectCount > 10) {
      suggestions.push("Wow, you're building quite a world! You might want to group similar objects together.");
    }
    
    return suggestions;
  }

  getAutonomousSuggestion(context) {
    if (context.objectCount === 0) {
      return "Ready to start creating? Try saying 'create a house' or 'build a tree'!";
    }
    
    if (context.objectCount > 0 && context.objectCount < 5) {
      return "Your world is taking shape! How about adding some environmental elements like trees or rocks?";
    }
    
    if (context.objectCount >= 5 && Math.random() < 0.3) {
      const tips = [
        "Pro tip: Use Ctrl+K to access the command palette with advanced tools!",
        "You can select objects and modify their properties in the Properties panel (F2).",
        "Try changing the time of day by saying 'make it night' or 'set to dawn'.",
        "Group related objects together to create themed areas in your world!"
      ];
      return tips[Math.floor(Math.random() * tips.length)];
    }
    
    return null;
  }

  getComplementaryObjects(objectType) {
    const complements = {
      house: ['garden', 'fence', 'mailbox', 'driveway'],
      tree: ['bush', 'flowers', 'rock', 'bench'],
      car: ['road', 'garage', 'streetlight', 'sign'],
      bridge: ['river', 'railing', 'pathway', 'lamp'],
      table: ['chair', 'lamp', 'decoration', 'rug'],
      tower: ['wall', 'gate', 'flag', 'moat']
    };
    
    return complements[objectType] || [];
  }
}

