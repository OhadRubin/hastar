// Wavefront Frontier Detection (WFD) Algorithm
// Based on "Wavefront frontier detection algorithm for autonomous robot exploration" paper

import { CELL_STATES } from '../utils/map-utils.js';

export class WavefrontFrontierDetection {
  constructor(width, height) {
    this.width = width;
    this.height = height;
  }

  // Main WFD algorithm - returns grouped frontiers instead of individual points
  detectFrontiers(knownMap) {
    if (!knownMap) return [];
    
    const frontierPoints = this.findFrontierPoints(knownMap);
    const frontierGroups = this.groupFrontierPoints(frontierPoints, knownMap);
    
    return frontierGroups.map(group => ({
      points: group,
      centroid: this.calculateCentroid(group),
      median: this.calculateMedian(group),
      size: group.length
    }));
  }

  // Find all frontier points using WFD's cell classification approach
  findFrontierPoints(knownMap) {
    const frontierPoints = [];
    const mapOpenList = [];
    const mapCloseList = new Set();
    
    // Initialize: find all known open cells (Map-Open-List)
    for (let y = 1; y < this.height - 1; y++) {
      for (let x = 1; x < this.width - 1; x++) {
        const idx = y * this.width + x;
        if (knownMap[idx] === CELL_STATES.WALKABLE) { // Known open cell
          mapOpenList.push({x, y});
        }
      }
    }

    // BFS through known open cells to find frontiers
    while (mapOpenList.length > 0) {
      const currentCell = mapOpenList.shift();
      const key = `${currentCell.x},${currentCell.y}`;
      
      if (mapCloseList.has(key)) continue;
      mapCloseList.add(key);

      // Check if this open cell is adjacent to unknown space (frontier point)
      if (this.isFrontierPoint(currentCell.x, currentCell.y, knownMap)) {
        frontierPoints.push({x: currentCell.x + 0.5, y: currentCell.y + 0.5});
      }

      // Add unprocessed open neighbors to map-open-list
      const neighbors = this.getNeighbors(currentCell.x, currentCell.y);
      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.x},${neighbor.y}`;
        const idx = neighbor.y * this.width + neighbor.x;
        
        if (!mapCloseList.has(neighborKey) && 
            neighbor.x >= 0 && neighbor.x < this.width && 
            neighbor.y >= 0 && neighbor.y < this.height &&
            knownMap[idx] === CELL_STATES.WALKABLE && 
            !mapOpenList.some(cell => cell.x === neighbor.x && cell.y === neighbor.y)) {
          mapOpenList.push(neighbor);
        }
      }
    }

    return frontierPoints;
  }

  // Check if a cell is a frontier point (open cell adjacent to unknown, not blocked by walls)
  isFrontierPoint(x, y, knownMap) {
    const neighbors = this.getNeighbors(x, y);
    return neighbors.some(neighbor => {
      const idx = neighbor.y * this.width + neighbor.x;
      const cellState = knownMap[idx];
      
      // Frontier point must be adjacent to unknown space, not walls
      return cellState === CELL_STATES.UNKNOWN;
    });
  }

  // Group connected frontier points into frontiers using BFS
  groupFrontierPoints(frontierPoints, knownMap) {
    const visited = new Set();
    const frontierGroups = [];
    
    for (const point of frontierPoints) {
      const key = `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
      if (visited.has(key)) continue;
      
      const group = this.bfsGroupFrontier(point, frontierPoints, visited, knownMap);
      frontierGroups.push(group);

    }
    
    return frontierGroups;
  }

  // BFS to group connected frontier points
  bfsGroupFrontier(startPoint, allFrontierPoints, visited, _knownMap) {
    const group = [];
    const queue = [startPoint];
    const frontierCloseList = new Set();
    
    while (queue.length > 0) {
      const current = queue.shift();
      const key = `${current.x.toFixed(1)},${current.y.toFixed(1)}`;
      
      if (frontierCloseList.has(key)) continue;
      frontierCloseList.add(key);
      visited.add(key);
      group.push(current);
      
      // Find neighboring frontier points
      for (const candidate of allFrontierPoints) {
        const candidateKey = `${candidate.x.toFixed(1)},${candidate.y.toFixed(1)}`;
        if (frontierCloseList.has(candidateKey) || visited.has(candidateKey)) continue;
        
        const distance = Math.sqrt(
          Math.pow(candidate.x - current.x, 2) + 
          Math.pow(candidate.y - current.y, 2)
        );
        
        // Adjacent frontier points (within sqrt(2) distance)
        // if (distance <= 1.5) {
        if (distance < 2) {
          queue.push(candidate);
        }
      }
    }
    
    return group;
  }

  // Calculate centroid of frontier group (research paper's preferred method)
  calculateCentroid(points) {
    if (points.length === 0) return null;
    
    const sumX = points.reduce((sum, p) => sum + p.x, 0);
    const sumY = points.reduce((sum, p) => sum + p.y, 0);
    
    return {
      x: sumX / points.length,
      y: sumY / points.length
    };
  }

  // Calculate median point of frontier group (alternative method)
  calculateMedian(points) {
    if (points.length === 0) return null;
    if (points.length === 1) return points[0];
    
    // Sort by distance from geometric center
    const center = this.calculateCentroid(points);
    const sortedPoints = [...points].sort((a, b) => {
      const distA = Math.sqrt(Math.pow(a.x - center.x, 2) + Math.pow(a.y - center.y, 2));
      const distB = Math.sqrt(Math.pow(b.x - center.x, 2) + Math.pow(b.y - center.y, 2));
      return distA - distB;
    });
    
    const medianIndex = Math.floor(sortedPoints.length / 2);
    return sortedPoints[medianIndex];
  }

  // Get 8-connected neighbors (including diagonals)
  getNeighbors(x, y) {
    const neighbors = [];
    const directions = [
      [0, 1], [1, 0], [0, -1], [-1, 0], // up, right, down, left
      [1, 1], [1, -1], [-1, 1], [-1, -1] // northeast, southeast, northwest, southwest
    ];
    
    for (const [dx, dy] of directions) {
      const newX = x + dx;
      const newY = y + dy;
      
      if (newX >= 0 && newX < this.width && newY >= 0 && newY < this.height) {
        neighbors.push({x: newX, y: newY});
      }
    }
    
    return neighbors;
  }
}