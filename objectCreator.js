

import * as THREE from 'three';

export class ObjectCreator {
  constructor(scene, assetLoader, loadedAssets) {
    this.scene = scene;
    this.assetLoader = assetLoader;
    this.loadedAssets = loadedAssets;
  }

  createShape(shapeType) {
    let geometry;
    
    switch (shapeType) {
      case 'sphere':
        geometry = new THREE.SphereGeometry(1, 32, 32);
        break;
      case 'cube':
        geometry = new THREE.BoxGeometry(2, 2, 2);
        break;
      case 'pyramid':
        geometry = new THREE.ConeGeometry(1, 2, 4);
        break;
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(1, 1, 2, 32);
        break;
      case 'torus':
        geometry = new THREE.TorusGeometry(1, 0.4, 16, 100);
        break;
      case 'cone':
        geometry = new THREE.ConeGeometry(1, 2, 32);
        break;
      case 'octahedron':
        geometry = new THREE.OctahedronGeometry(1);
        break;
      case 'tetrahedron':
        geometry = new THREE.TetrahedronGeometry(1);
        break;
      case 'dodecahedron':
        geometry = new THREE.DodecahedronGeometry(1);
        break;
      case 'icosahedron':
        geometry = new THREE.IcosahedronGeometry(1);
        break;
      default:
        geometry = new THREE.BoxGeometry(1, 1, 1);
    }

    const material = new THREE.MeshLambertMaterial({
      color: this.getRandomColor()
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.type = 'shape';
    mesh.userData.shapeType = shapeType;
    
    this.scene.add(mesh);
    return mesh;
  }

  createAsset(assetType) {
    const asset = this.loadedAssets.get(assetType);
    if (!asset) {
      console.warn(`Asset ${assetType} not loaded`);
      return this.createShape('cube'); // Fallback
    }

    const clone = asset.scene.clone();
    clone.scale.setScalar(2);
    clone.userData.type = 'asset';
    clone.userData.assetType = assetType;
    
    // Enable shadows
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    this.scene.add(clone);
    return clone;
  }

  createFromDescription(description) {
    // AI simulation - analyze description and create appropriate object
    const analyzed = this.analyzeDescription(description.toLowerCase());
    
    if (analyzed.assetType) {
      return this.createAsset(analyzed.assetType);
    } else if (analyzed.shapeType) {
      const obj = this.createShape(analyzed.shapeType);
      if (analyzed.color) {
        obj.material.color.setHex(analyzed.color);
      }
      if (analyzed.scale) {
        obj.scale.setScalar(analyzed.scale);
      }
      return obj;
    } else {
      // Create complex object based on description
      return this.createComplexObject(description, analyzed);
    }
  }

  analyzeDescription(description) {
    const analysis = {
      shapeType: null,
      assetType: null,
      color: null,
      scale: 1
    };

    // Shape detection
    if (description.includes('ball') || description.includes('sphere') || description.includes('round')) {
      analysis.shapeType = 'sphere';
    } else if (description.includes('box') || description.includes('cube') || description.includes('square')) {
      analysis.shapeType = 'cube';
    } else if (description.includes('pyramid') || description.includes('triangle')) {
      analysis.shapeType = 'pyramid';
    } else if (description.includes('cylinder') || description.includes('tube') || description.includes('can')) {
      analysis.shapeType = 'cylinder';
    } else if (description.includes('torus') || description.includes('donut') || description.includes('ring')) {
      analysis.shapeType = 'torus';
    } else if (description.includes('cone') || description.includes('funnel')) {
      analysis.shapeType = 'cone';
    }

    // Asset detection
    if (description.includes('wizard') || description.includes('mage') || description.includes('magic')) {
      analysis.assetType = 'wizard';
    } else if (description.includes('dragon') || description.includes('beast') || description.includes('monster')) {
      analysis.assetType = 'dragon';
    } else if (description.includes('ghost') || description.includes('spirit') || description.includes('skull')) {
      analysis.assetType = 'ghost';
    } else if (description.includes('robot') || description.includes('cube guy') || description.includes('character')) {
      analysis.assetType = 'cube_guy';
    }

    // Color detection
    if (description.includes('red')) analysis.color = 0xff0000;
    else if (description.includes('blue')) analysis.color = 0x0000ff;
    else if (description.includes('green')) analysis.color = 0x00ff00;
    else if (description.includes('yellow')) analysis.color = 0xffff00;
    else if (description.includes('purple')) analysis.color = 0x8000ff;
    else if (description.includes('orange')) analysis.color = 0xff8000;
    else if (description.includes('pink')) analysis.color = 0xff69b4;
    else if (description.includes('black')) analysis.color = 0x333333;
    else if (description.includes('white')) analysis.color = 0xffffff;
    else if (description.includes('gold')) analysis.color = 0xffd700;
    else if (description.includes('silver')) analysis.color = 0xc0c0c0;

    // Size detection
    if (description.includes('big') || description.includes('large') || description.includes('huge')) {
      analysis.scale = 2;
    } else if (description.includes('small') || description.includes('tiny') || description.includes('mini')) {
      analysis.scale = 0.5;
    }

    return analysis;
  }

  createComplexObject(description, analysis) {
    // Create composite objects for complex descriptions
    const group = new THREE.Group();
    
    if (description.includes('car') || description.includes('vehicle')) {
      // Create a simple car
      const body = this.createCarBody();
      const wheels = this.createCarWheels();
      group.add(body);
      wheels.forEach(wheel => group.add(wheel));
      
    } else if (description.includes('house') || description.includes('building')) {
      // Create a simple house
      const base = this.createHouseBase();
      const roof = this.createHouseRoof();
      group.add(base);
      group.add(roof);
      
    } else if (description.includes('tree') || description.includes('plant')) {
      // Create a simple tree
      const trunk = this.createTreeTrunk();
      const leaves = this.createTreeLeaves();
      group.add(trunk);
      group.add(leaves);
      
    } else if (description.includes('tower') || description.includes('castle')) {
      // Create a tower
      const base = this.createTowerBase();
      const top = this.createTowerTop();
      group.add(base);
      group.add(top);
      
    } else if (description.includes('bridge')) {
      // Create a bridge
      const bridge = this.createBridge(description);
      group.add(bridge);
      
    } else if (description.includes('table')) {
      // Create a table
      const table = this.createTable(description);
      group.add(table);
      
    } else if (description.includes('chair')) {
      // Create a chair
      const chair = this.createChair(description);
      group.add(chair);
      
    } else {
      // Default to a colorful cube
      const cube = this.createShape('cube');
      if (analysis.color) {
        cube.material.color.setHex(analysis.color);
      }
      return cube;
    }
    group.userData.type = 'complex';
    group.userData.description = description;
    group.userData.name = this.generateObjectName(description);
    
    // Enable shadows for all children
    group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    
    this.scene.add(group);
    return group;
  }
  generateObjectName(description) {
    const words = description.split(' ');
    return words.slice(0, 2).map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }
  createBridge(description) {
    // Extract length from description
    let length = 30;
    const lengthMatch = description.match(/(\d+)\s*m/);
    if (lengthMatch) {
      length = parseInt(lengthMatch[1]);
    }
    
    // Bridge deck
    const deckGeometry = new THREE.BoxGeometry(length, 0.5, 4);
    const deckMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const deck = new THREE.Mesh(deckGeometry, deckMaterial);
    deck.position.y = 2;
    
    return deck;
  }
  createTable(description) {
    const group = new THREE.Group();
    
    // Extract diameter if specified
    let diameter = 1.2;
    const diameterMatch = description.match(/(\d+\.?\d*)\s*m/);
    if (diameterMatch) {
      diameter = parseFloat(diameterMatch[1]);
    }
    
    // Table top
    const topGeometry = new THREE.CylinderGeometry(diameter/2, diameter/2, 0.05, 32);
    const topMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const top = new THREE.Mesh(topGeometry, topMaterial);
    top.position.y = 0.75;
    group.add(top);
    
    // Table legs
    const legGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.75, 8);
    const legMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
    
    const legPositions = [
      [diameter/3, 0.375, diameter/3],
      [-diameter/3, 0.375, diameter/3],
      [diameter/3, 0.375, -diameter/3],
      [-diameter/3, 0.375, -diameter/3]
    ];
    
    legPositions.forEach(pos => {
      const leg = new THREE.Mesh(legGeometry, legMaterial);
      leg.position.set(...pos);
      group.add(leg);
    });
    
    return group;
  }
  createChair(description) {
    const group = new THREE.Group();
    
    // Chair seat
    const seatGeometry = new THREE.BoxGeometry(0.5, 0.05, 0.5);
    const seatMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const seat = new THREE.Mesh(seatGeometry, seatMaterial);
    seat.position.y = 0.45;
    group.add(seat);
    
    // Chair back
    const backGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.05);
    const backMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const back = new THREE.Mesh(backGeometry, backMaterial);
    back.position.set(0, 0.7, -0.225);
    group.add(back);
    
    // Chair legs
    const legGeometry = new THREE.BoxGeometry(0.05, 0.45, 0.05);
    const legMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
    
    const legPositions = [
      [0.2, 0.225, 0.2],
      [-0.2, 0.225, 0.2],
      [0.2, 0.225, -0.2],
      [-0.2, 0.225, -0.2]
    ];
    
    legPositions.forEach(pos => {
      const leg = new THREE.Mesh(legGeometry, legMaterial);
      leg.position.set(...pos);
      group.add(leg);
    });
    
    return group;
  }

  createCarBody() {
    const geometry = new THREE.BoxGeometry(3, 1, 1.5);
    const material = new THREE.MeshLambertMaterial({ color: 0xff0000 });
    const body = new THREE.Mesh(geometry, material);
    body.position.y = 0.5;
    body.castShadow = true;
    return body;
  }

  createCarWheels() {
    const wheels = [];
    const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16);
    const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
    
    const positions = [
      [-1, 0.3, -0.8],
      [1, 0.3, -0.8],
      [-1, 0.3, 0.8],
      [1, 0.3, 0.8]
    ];
    
    positions.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.position.set(...pos);
      wheel.rotation.z = Math.PI / 2;
      wheel.castShadow = true;
      wheels.push(wheel);
    });
    
    return wheels;
  }

  createHouseBase() {
    const geometry = new THREE.BoxGeometry(3, 2, 3);
    const material = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const base = new THREE.Mesh(geometry, material);
    base.position.y = 1;
    base.castShadow = true;
    return base;
  }

  createHouseRoof() {
    const geometry = new THREE.ConeGeometry(2.2, 1.5, 4);
    const material = new THREE.MeshLambertMaterial({ color: 0x654321 });
    const roof = new THREE.Mesh(geometry, material);
    roof.position.y = 2.75;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    return roof;
  }

  createTreeTrunk() {
    const geometry = new THREE.CylinderGeometry(0.2, 0.3, 2, 8);
    const material = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const trunk = new THREE.Mesh(geometry, material);
    trunk.position.y = 1;
    trunk.castShadow = true;
    return trunk;
  }

  createTreeLeaves() {
    const geometry = new THREE.SphereGeometry(1.2, 16, 16);
    const material = new THREE.MeshLambertMaterial({ color: 0x228B22 });
    const leaves = new THREE.Mesh(geometry, material);
    leaves.position.y = 2.5;
    leaves.castShadow = true;
    return leaves;
  }

  createTowerBase() {
    const geometry = new THREE.CylinderGeometry(1, 1.2, 4, 16);
    const material = new THREE.MeshLambertMaterial({ color: 0x708090 });
    const base = new THREE.Mesh(geometry, material);
    base.position.y = 2;
    base.castShadow = true;
    return base;
  }

  createTowerTop() {
    const geometry = new THREE.ConeGeometry(1.2, 1.5, 16);
    const material = new THREE.MeshLambertMaterial({ color: 0x4169E1 });
    const top = new THREE.Mesh(geometry, material);
    top.position.y = 4.75;
    top.castShadow = true;
    return top;
  }

  getRandomColor() {
    const colors = [
      0xff6b6b, 0x4ecdc4, 0x45b7d1, 0xf9ca24, 0xf0932b,
      0xeb4d4b, 0x6c5ce7, 0xa29bfe, 0xfd79a8, 0x00b894
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}

