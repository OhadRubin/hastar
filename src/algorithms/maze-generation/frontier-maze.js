/**
 * Frontier Maze Generation Algorithm
 * 
 * Creates mazes with larger rooms and corridors using frontier-style algorithm
 */

import { createAlgorithm, createAlgorithmResult, numberParam } from '../algorithm-interface.js';
import { executeAlgorithm } from './shared-utils.js';
import { DEFAULT_REGION_SIZE, DEFAULT_MAZE_SIZE } from '../../core/constants.js';

/**
 * Frontier-style maze generation (adapted from frontier_maze)
 * Creates mazes with larger rooms and corridors
 */
export const generateFrontierMaze = (SIZE) => {
  // Initialize maze with all walls  
  const maze = Array(SIZE).fill(null).map(() => Array(SIZE).fill(1));
  
  const carve3x3 = (x, y) => {
    const endY = Math.min(y + 3, SIZE);
    const endX = Math.min(x + 3, SIZE);
    for (let dy = y; dy < endY; dy++) {
      for (let dx = x; dx < endX; dx++) {
        maze[dy][dx] = 0;
      }
    }
  };
  
  const carveConnection = (x1, y1, x2, y2) => {
    if (x1 === x2) {
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2) + 2;
      const endY = Math.min(maxY + 1, SIZE);
      const endX = Math.min(x1 + 3, SIZE);
      
      for (let y = minY; y < endY; y++) {
        for (let dx = x1; dx < endX; dx++) {
          maze[y][dx] = 0;
        }
      }
    } else {
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2) + 2;
      const endX = Math.min(maxX + 1, SIZE);
      const endY = Math.min(y1 + 3, SIZE);
      
      for (let y = y1; y < endY; y++) {
        for (let x = minX; x < endX; x++) {
          maze[y][x] = 0;
        }
      }
    }
  };
  
  const visited = new Set();
  const toKey = (x, y) => `${x},${y}`;
  
  const stack = [];
  const startX = 2, startY = 2;
  
  carve3x3(startX, startY);
  stack.push([startX, startY]);
  visited.add(toKey(startX, startY));
  
  const directions = [[4, 0], [0, 4], [-4, 0], [0, -4]];
  
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  
  while (stack.length > 0) {
    const [currentX, currentY] = stack[stack.length - 1];
    const shuffledDirs = shuffle([...directions]);
    let found = false;
    
    for (const [dx, dy] of shuffledDirs) {
      const newX = currentX + dx;
      const newY = currentY + dy;
      
      if (newX > 0 && newX < SIZE - 3 && newY > 0 && newY < SIZE - 3) {
        const key = toKey(newX, newY);
        if (!visited.has(key)) {
          carveConnection(currentX, currentY, newX, newY);
          carve3x3(newX, newY);
          visited.add(key);
          stack.push([newX, newY]);
          found = true;
          break;
        }
      }
    }
    
    if (!found) stack.pop();
  }
  
  // Post-processing for rooms, loops, and widening
  const random = Math.random;
  const roomThreshold = 0.002;
  const loopThreshold = 0.005;
  const wideningThreshold = 0.003;
  
  for (let y = 1; y < SIZE - 1; y++) {
    for (let x = 1; x < SIZE - 1; x++) {
      const rand = random();
      
      if (rand < roomThreshold && x < SIZE - DEFAULT_REGION_SIZE && y < SIZE - DEFAULT_REGION_SIZE) {
        const roomWidth = 4 + Math.floor(random() * 3);
        const roomHeight = 4 + Math.floor(random() * 3);
        const maxY = Math.min(y + roomHeight, SIZE - 2);
        const maxX = Math.min(x + roomWidth, SIZE - 2);
        
        for (let dy = y; dy < maxY; dy++) {
          for (let dx = x; dx < maxX; dx++) {
            maze[dy][dx] = 0;
          }
        }
      }
      else if (rand < loopThreshold && maze[y][x] === 1) {
        let paths = 0;
        if (y > 0 && maze[y - 1][x] === 0) paths++;
        if (y < SIZE - 1 && maze[y + 1][x] === 0) paths++;
        if (x > 0 && maze[y][x - 1] === 0) paths++;
        if (x < SIZE - 1 && maze[y][x + 1] === 0) paths++;
        
        if (paths >= 2) maze[y][x] = 0;
      }
      else if (rand < wideningThreshold && maze[y][x] === 0 && x < SIZE - 4 && y < SIZE - 4) {
        const size = random() > 0.5 ? 3 : 4;
        const maxY = Math.min(y + size, SIZE - 1);
        const maxX = Math.min(x + size, SIZE - 1);
        
        for (let dy = y; dy < maxY; dy++) {
          for (let dx = x; dx < maxX; dx++) {
            maze[dy][dx] = 0;
          }
        }
      }
    }
  }
  
  // Add entrance and exit
  for (let i = 0; i < 3; i++) {
    maze[2 + i][0] = 0;
    maze[SIZE - 3 - i][SIZE - 1] = 0;
  }
  
  return maze;
};

/**
 * Frontier Maze Generation Algorithm
 */
export const frontierMazeAlgorithm = createAlgorithm({
  name: 'Frontier Maze Generation',
  type: 'maze-generation',
  description: 'Generates mazes with larger rooms and corridors using frontier-style algorithm',
  parameters: {
    roomThreshold: numberParam(0.001, 0.005, 0.002, 0.001),
    loopThreshold: numberParam(0.003, 0.01, 0.005, 0.001),
    wideningThreshold: numberParam(0.001, 0.005, 0.003, 0.001)
  },
  
  async execute(input, options, onProgress) {
    const { SIZE = DEFAULT_MAZE_SIZE, REGION_SIZE = DEFAULT_REGION_SIZE } = input;
    const result = await executeAlgorithm(generateFrontierMaze, 'Frontier', { SIZE, REGION_SIZE }, options, onProgress);
    return createAlgorithmResult(result.result, result.metrics);
  }
});

export default frontierMazeAlgorithm;