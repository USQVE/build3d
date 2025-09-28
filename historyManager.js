

import * as THREE from 'three';

export class HistoryManager {
  constructor(worldsmith) {
    this.worldsmith = worldsmith;
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistorySize = 100;
    
    // Guard flags to prevent re-entrant recording
    this.isExecutingUndo = false;
    this.isExecutingRedo = false;
    this.isRecording = true;
    
    // Transaction coalescing for interactive operations
    this.currentTransaction = null;
    this.coalescingTimer = null;
    this.coalescingInterval = 100; // 10 Hz sampling
    
    // Object tracking for change detection
    this.trackedObjects = new Map(); // id -> object reference
    this.nextObjectId = 1;
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Listen for object modifications to track changes
    document.addEventListener('objectCreated', (e) => {
      if (this.isRecording && !this.isExecutingUndo && !this.isExecutingRedo && e.detail.object) {
        this.recordObjectCreation(e.detail.object);
      }
    });

    document.addEventListener('objectDeleted', (e) => {
      if (this.isRecording && !this.isExecutingUndo && !this.isExecutingRedo && e.detail.object) {
        this.recordObjectDeletion(e.detail.object, e.detail.snapshot);
      }
    });
  }

  // Generate unique ID for objects
  generateObjectId() {
    return 'obj_' + (this.nextObjectId++);
  }

  // Get or assign ID to an object
  getObjectId(object) {
    if (!object.userData.historyId) {
      object.userData.historyId = this.generateObjectId();
    }
    this.trackedObjects.set(object.userData.historyId, object);
    return object.userData.historyId;
  }

  // Create a snapshot of an object's current state
  createObjectSnapshot(object) {
    const snapshot = {
      id: this.getObjectId(object),
      position: { x: object.position.x, y: object.position.y, z: object.position.z },
      rotation: { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z },
      scale: { x: object.scale.x, y: object.scale.y, z: object.scale.z },
      userData: JSON.parse(JSON.stringify(object.userData)),
      visible: object.visible
    };

    // Store material properties if available
    if (object.material) {
      snapshot.material = {
        color: object.material.color ? object.material.color.getHex() : null,
        transparent: object.material.transparent,
        opacity: object.material.opacity
      };
    }

    // Store geometry type and parameters for reconstruction
    if (object.geometry) {
      snapshot.geometry = this.serializeGeometry(object.geometry, object);
    }

    return snapshot;
  }

  serializeGeometry(geometry, object) {
    // Store geometry information for reconstruction
    const geoData = {
      type: geometry.type || 'unknown'
    };

    // Store common geometry parameters based on userData
    if (object.userData.shapeType) {
      geoData.shapeType = object.userData.shapeType;
    }
    if (object.userData.assetType) {
      geoData.assetType = object.userData.assetType;
    }
    if (object.userData.description) {
      geoData.description = object.userData.description;
    }

    return geoData;
  }

  // Restore object from snapshot
  restoreObjectFromSnapshot(snapshot) {
    let restoredObject;

    // Recreate object based on stored type information
    if (snapshot.userData.shapeType) {
      restoredObject = this.worldsmith.objectCreator.createShape(snapshot.userData.shapeType);
    } else if (snapshot.userData.assetType) {
      restoredObject = this.worldsmith.objectCreator.createAsset(snapshot.userData.assetType);
    } else if (snapshot.userData.description) {
      restoredObject = this.worldsmith.objectCreator.createFromDescription(snapshot.userData.description);
    } else {
      // Fallback to basic cube
      restoredObject = this.worldsmith.objectCreator.createShape('cube');
    }

    if (!restoredObject) return null;

    // Restore transform
    restoredObject.position.set(snapshot.position.x, snapshot.position.y, snapshot.position.z);
    restoredObject.rotation.set(snapshot.rotation.x, snapshot.rotation.y, snapshot.rotation.z);
    restoredObject.scale.set(snapshot.scale.x, snapshot.scale.y, snapshot.scale.z);
    restoredObject.visible = snapshot.visible;

    // Restore material properties
    if (snapshot.material && restoredObject.material) {
      if (snapshot.material.color !== null) {
        restoredObject.material.color.setHex(snapshot.material.color);
      }
      restoredObject.material.transparent = snapshot.material.transparent;
      restoredObject.material.opacity = snapshot.material.opacity;
    }

    // Restore userData
    restoredObject.userData = { ...snapshot.userData };
    restoredObject.userData.historyId = snapshot.id;

    // Register with tracking
    this.trackedObjects.set(snapshot.id, restoredObject);

    return restoredObject;
  }

  // Start a new transaction
  startTransaction(label) {
    if (this.isExecutingUndo || this.isExecutingRedo) return;

    this.currentTransaction = {
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      label: label,
      timestamp: Date.now(),
      changes: []
    };
  }

  // Add a change to the current transaction
  addChange(change) {
    if (this.isExecutingUndo || this.isExecutingRedo || !this.isRecording) return;

    if (!this.currentTransaction) {
      this.startTransaction('Unknown Action');
    }

    this.currentTransaction.changes.push(change);
  }

  // Commit the current transaction to history
  commitTransaction() {
    if (!this.currentTransaction || this.currentTransaction.changes.length === 0) {
      this.currentTransaction = null;
      return;
    }

    // Add to undo stack
    this.undoStack.push(this.currentTransaction);
    
    // Clear redo stack (new action invalidates redo history)
    this.redoStack = [];
    
    // Limit history size
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift();
    }

    this.currentTransaction = null;
    this.updateUI();
  }

  // Record object creation
  recordObjectCreation(object) {
    if (!object) return;
    const snapshot = this.createObjectSnapshot(object);
    this.addChange({
      type: 'create',
      id: snapshot.id,
      snapshotNew: snapshot
    });
  }

  // Record object deletion
  recordObjectDeletion(object, snapshot = null) {
    if (!object) return;
    if (!snapshot) {
      snapshot = this.createObjectSnapshot(object);
    }
    
    this.addChange({
      type: 'delete',
      id: snapshot.id,
      snapshotOld: snapshot
    });
  }

  // Record transform change
  recordTransformChange(object, prevTransform, nextTransform) {
    this.addChange({
      type: 'xform',
      id: this.getObjectId(object),
      prev: prevTransform,
      next: nextTransform
    });
  }

  // Record property change
  recordPropertyChange(object, key, prevValue, nextValue) {
    this.addChange({
      type: 'prop',
      id: this.getObjectId(object),
      key: key,
      prev: prevValue,
      next: nextValue
    });
  }

  // Start coalescing for interactive operations (drag, etc.)
  startCoalescing(label) {
    if (this.currentTransaction) {
      this.commitTransaction();
    }
    
    this.startTransaction(label);
    
    // Set up periodic sampling
    if (this.coalescingTimer) {
      clearInterval(this.coalescingTimer);
    }
    
    this.coalescingTimer = setInterval(() => {
      // Sample current state - this would be called by drag handlers
    }, this.coalescingInterval);
  }

  // Stop coalescing and commit
  stopCoalescing() {
    if (this.coalescingTimer) {
      clearInterval(this.coalescingTimer);
      this.coalescingTimer = null;
    }
    
    this.commitTransaction();
  }

  // Execute undo operation
  undo() {
    if (this.undoStack.length === 0 || this.isExecutingUndo || this.isExecutingRedo) {
      return false;
    }

    this.isExecutingUndo = true;
    
    try {
      const transaction = this.undoStack.pop();
      
      // Apply changes in reverse order
      for (let i = transaction.changes.length - 1; i >= 0; i--) {
        this.reverseChange(transaction.changes[i]);
      }
      
      // Move to redo stack
      this.redoStack.push(transaction);
      
      this.updateUI();
      this.worldsmith.updateObjectCount();
      this.worldsmith.showToast(`Undone: ${transaction.label}`, 'info');
      
      return true;
    } finally {
      this.isExecutingUndo = false;
    }
  }

  // Execute redo operation
  redo() {
    if (this.redoStack.length === 0 || this.isExecutingUndo || this.isExecutingRedo) {
      return false;
    }

    this.isExecutingRedo = true;
    
    try {
      const transaction = this.redoStack.pop();
      
      // Apply changes in original order
      for (const change of transaction.changes) {
        this.applyChange(change);
      }
      
      // Move back to undo stack
      this.undoStack.push(transaction);
      
      this.updateUI();
      this.worldsmith.updateObjectCount();
      this.worldsmith.showToast(`Redone: ${transaction.label}`, 'info');
      
      return true;
    } finally {
      this.isExecutingRedo = false;
    }
  }

  // Reverse a change (for undo)
  reverseChange(change) {
    switch (change.type) {
      case 'create':
        this.reverseCreate(change);
        break;
      case 'delete':
        this.reverseDelete(change);
        break;
      case 'xform':
        this.reverseTransform(change);
        break;
      case 'prop':
        this.reverseProperty(change);
        break;
    }
  }

  // Apply a change (for redo)
  applyChange(change) {
    switch (change.type) {
      case 'create':
        this.applyCreate(change);
        break;
      case 'delete':
        this.applyDelete(change);
        break;
      case 'xform':
        this.applyTransform(change);
        break;
      case 'prop':
        this.applyProperty(change);
        break;
    }
  }

  // Reverse create = delete object
  reverseCreate(change) {
    const object = this.trackedObjects.get(change.id);
    if (object) {
      this.worldsmith.scene.remove(object);
      const index = this.worldsmith.createdObjects.indexOf(object);
      if (index > -1) {
        this.worldsmith.createdObjects.splice(index, 1);
      }
      this.trackedObjects.delete(change.id);
    }
  }

  // Apply create = restore object
  applyCreate(change) {
    const restoredObject = this.restoreObjectFromSnapshot(change.snapshotNew);
    if (restoredObject) {
      this.worldsmith.scene.add(restoredObject);
      this.worldsmith.createdObjects.push(restoredObject);
    }
  }

  // Reverse delete = restore object
  reverseDelete(change) {
    const restoredObject = this.restoreObjectFromSnapshot(change.snapshotOld);
    if (restoredObject) {
      this.worldsmith.scene.add(restoredObject);
      this.worldsmith.createdObjects.push(restoredObject);
    }
  }

  // Apply delete = remove object
  applyDelete(change) {
    const object = this.trackedObjects.get(change.id);
    if (object) {
      this.worldsmith.scene.remove(object);
      const index = this.worldsmith.createdObjects.indexOf(object);
      if (index > -1) {
        this.worldsmith.createdObjects.splice(index, 1);
      }
      this.trackedObjects.delete(change.id);
    }
  }

  // Reverse transform
  reverseTransform(change) {
    const object = this.trackedObjects.get(change.id);
    if (object && change.prev) {
      object.position.set(change.prev.pos.x, change.prev.pos.y, change.prev.pos.z);
      object.rotation.set(change.prev.rot.x, change.prev.rot.y, change.prev.rot.z);
      object.scale.set(change.prev.scale.x, change.prev.scale.y, change.prev.scale.z);
    }
  }

  // Apply transform
  applyTransform(change) {
    const object = this.trackedObjects.get(change.id);
    if (object && change.next) {
      object.position.set(change.next.pos.x, change.next.pos.y, change.next.pos.z);
      object.rotation.set(change.next.rot.x, change.next.rot.y, change.next.rot.z);
      object.scale.set(change.next.scale.x, change.next.scale.y, change.next.scale.z);
    }
  }

  // Reverse property change
  reverseProperty(change) {
    const object = this.trackedObjects.get(change.id);
    if (object) {
      this.setObjectProperty(object, change.key, change.prev);
    }
  }

  // Apply property change
  applyProperty(change) {
    const object = this.trackedObjects.get(change.id);
    if (object) {
      this.setObjectProperty(object, change.key, change.next);
    }
  }

  // Helper to set object property
  setObjectProperty(object, key, value) {
    if (key === 'color' && object.material) {
      object.material.color.setHex(value);
    } else if (key === 'visible') {
      object.visible = value;
    } else if (key === 'name') {
      object.userData.name = value;
    }
    // Add more property types as needed
  }

  // Update UI elements
  updateUI() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');

    if (undoBtn) {
      undoBtn.disabled = this.undoStack.length === 0;
      undoBtn.textContent = `↶ Undo${this.undoStack.length > 0 ? ` (${this.undoStack.length})` : ''}`;
      undoBtn.title = this.undoStack.length > 0 ? `Undo: ${this.undoStack[this.undoStack.length - 1].label}` : 'Nothing to undo';
    }

    if (redoBtn) {
      redoBtn.disabled = this.redoStack.length === 0;
      redoBtn.textContent = `↷ Redo${this.redoStack.length > 0 ? ` (${this.redoStack.length})` : ''}`;
      redoBtn.title = this.redoStack.length > 0 ? `Redo: ${this.redoStack[this.redoStack.length - 1].label}` : 'Nothing to redo';
    }
  }

  // Clear all history
  clearHistory() {
    this.undoStack = [];
    this.redoStack = [];
    this.currentTransaction = null;
    this.trackedObjects.clear();
    this.nextObjectId = 1;
    this.updateUI();
  }

  // Serialize history for saving
  serializeHistory() {
    return {
      undoStack: this.undoStack,
      redoStack: this.redoStack,
      nextObjectId: this.nextObjectId
    };
  }

  // Deserialize history from save data
  deserializeHistory(data) {
    if (data && data.undoStack && data.redoStack) {
      this.undoStack = data.undoStack || [];
      this.redoStack = data.redoStack || [];
      this.nextObjectId = data.nextObjectId || 1;
      
      // Rebuild object tracking from current scene
      this.rebuildObjectTracking();
      this.updateUI();
    }
  }

  // Rebuild object tracking after loading
  rebuildObjectTracking() {
    this.trackedObjects.clear();
    
    this.worldsmith.createdObjects.forEach(object => {
      if (object.userData.historyId) {
        this.trackedObjects.set(object.userData.historyId, object);
      }
    });
  }

  // Group multiple actions into one transaction (for AI agent)
  executeGroupedAction(label, actionFn) {
    this.startTransaction(label);
    
    try {
      actionFn();
    } finally {
      this.commitTransaction();
    }
  }
}

