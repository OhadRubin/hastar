// Sensor Management System
// Handles different sensor types and fusion for exploration algorithms

export class SensorManager {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.sensors = new Map();
  }

  // Register a sensor type
  addSensor(type, sensor) {
    this.sensors.set(type, sensor);
  }

  // Get all visible positions from all sensors
  getAllSensorPositions(robotX, robotY, robotDirection, options = {}) {
    const allPositions = new Set();
    const robotGridX = Math.floor(robotX);
    const robotGridY = Math.floor(robotY);
    
    // Always add robot position
    allPositions.add(`${robotGridX},${robotGridY}`);
    
    // Get positions from each sensor
    for (const [, sensor] of this.sensors) {
      const positions = sensor.getSensorPositions(robotX, robotY, robotDirection, options);
      positions.forEach(([x, y]) => allPositions.add(`${x},${y}`));
    }
    
    // Convert back to array format
    return Array.from(allPositions).map(pos => {
      const [x, y] = pos.split(',').map(Number);
      return [x, y];
    });
  }

  // Update known map with sensor data and line-of-sight checks
  updateMapWithSensors(knownMap, fullMaze, robotX, robotY, robotDirection, options = {}) {
    const newKnownMap = new Uint8Array(knownMap);
    const robotGridX = Math.floor(robotX);
    const robotGridY = Math.floor(robotY);
    const visiblePositions = [];
    
    const sensorPositions = this.getAllSensorPositions(robotX, robotY, robotDirection, options);
    
    for (const [x, y] of sensorPositions) {
      if (this.hasLineOfSight(fullMaze, robotGridX, robotGridY, x, y)) {
        newKnownMap[y * this.width + x] = fullMaze[y * this.width + x];
        visiblePositions.push([x, y]);
      }
    }
    
    return { knownMap: newKnownMap, visibleSensorPositions: visiblePositions };
  }

  // Line-of-sight calculation using Bresenham's algorithm
  hasLineOfSight(maze, x1, y1, x2, y2) {
    let dx = Math.abs(x2 - x1);
    let dy = Math.abs(y2 - y1);
    let sx = x1 < x2 ? 1 : (x1 > x2 ? -1 : 0);
    let sy = y1 < y2 ? 1 : (y1 > y2 ? -1 : 0);

    let err = dx - dy;
    let x = x1;
    let y = y1;

    while (true) {
      // Stop if a wall is hit before the target
      if (maze[y * this.width + x] === 1 && (x !== x2 || y !== y2)) {
        return false;
      }
      // Reached the target cell
      if (x === x2 && y === y2) {
        return true;
      }

      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }
}

// Directional Cone Sensor (current implementation)
export class DirectionalConeSensor {
  constructor(width, height) {
    this.width = width;
    this.height = height;
  }

  getSensorPositions(robotX, robotY, robotDirection, options = {}) {
    const { sensorRange = 15 } = options;
    const robotGridX = Math.floor(robotX);
    const robotGridY = Math.floor(robotY);
    const sensorPositions = [];
    
    // Direction vectors
    const DIRECTION_VECTORS = {
      0: [0, -1], // NORTH
      1: [1, 0],  // EAST
      2: [0, 1],  // SOUTH
      3: [-1, 0]  // WEST
    };
    
    const [dirX, dirY] = DIRECTION_VECTORS[robotDirection];
    
    // Robot cell
    sensorPositions.push([robotGridX, robotGridY]);
    
    // Add immediate left and right cells
    const leftX = robotGridX + (dirY === 0 ? 0 : -dirY);
    const leftY = robotGridY + (dirX === 0 ? 0 : dirX);
    const rightX = robotGridX + (dirY === 0 ? 0 : dirY);
    const rightY = robotGridY + (dirX === 0 ? 0 : -dirX);
    
    if (leftX >= 0 && leftX < this.width && leftY >= 0 && leftY < this.height) {
      sensorPositions.push([leftX, leftY]);
    }
    if (rightX >= 0 && rightX < this.width && rightY >= 0 && rightY < this.height) {
      sensorPositions.push([rightX, rightY]);
    }

    // Expanding cone pattern
    for (let dist = 0; dist <= sensorRange; dist++) {
      const frontX = robotGridX + dirX * dist;
      const frontY = robotGridY + dirY * dist;
      const halfWidth = dist;

      for (let side = -(halfWidth-1); side <= halfWidth+1; side++) {
        let x, y;

        if (dirX === 0) {           // moving NORTH or SOUTH → widen on X-axis
          x = frontX + side;        // sideways spread
          y = frontY;               // forward distance
        } else {                    // moving EAST or WEST → widen on Y-axis
          x = frontX;               // forward distance
          y = frontY + side;        // sideways spread
        }

        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
          sensorPositions.push([x, y]);
        }
      }
    }
    
    return sensorPositions;
  }
}

// 360-degree Laser Sensor (research paper style)
export class LaserSensor {
  constructor(width, height) {
    this.width = width;
    this.height = height;
  }

  getSensorPositions(robotX, robotY, _robotDirection, options = {}) {
    const { sensorRange = 10, angleResolution = 10 } = options;
    const robotGridX = Math.floor(robotX);
    const robotGridY = Math.floor(robotY);
    const sensorPositions = [];
    
    // 360-degree scan
    for (let angle = 0; angle < 360; angle += angleResolution) {
      const radians = (angle * Math.PI) / 180;
      
      for (let range = 1; range <= sensorRange; range++) {
        const x = Math.round(robotGridX + Math.cos(radians) * range);
        const y = Math.round(robotGridY + Math.sin(radians) * range);
        
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
          sensorPositions.push([x, y]);
        }
      }
    }
    
    return sensorPositions;
  }
}

// Sonar Sensor Array (research paper uses 16 sonar sensors)
export class SonarSensorArray {
  constructor(width, height, numSensors = 16) {
    this.width = width;
    this.height = height;
    this.numSensors = numSensors;
  }

  getSensorPositions(robotX, robotY, _robotDirection, options = {}) {
    const { sensorRange = 5 } = options;
    const robotGridX = Math.floor(robotX);
    const robotGridY = Math.floor(robotY);
    const sensorPositions = [];
    
    // Distribute sensors around robot
    const angleStep = (2 * Math.PI) / this.numSensors;
    
    for (let i = 0; i < this.numSensors; i++) {
      const angle = i * angleStep;
      
      for (let range = 1; range <= sensorRange; range++) {
        const x = Math.round(robotGridX + Math.cos(angle) * range);
        const y = Math.round(robotGridY + Math.sin(angle) * range);
        
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
          sensorPositions.push([x, y]);
        }
      }
    }
    
    return sensorPositions;
  }
}