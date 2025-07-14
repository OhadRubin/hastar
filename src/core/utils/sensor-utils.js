/**
 * Sensor utilities for exploration algorithms
 * Reusable sensor scanning functionality
 */

import { SensorManager, DirectionalConeSensor } from '../sensors/index.js';

/**
 * Advanced robot sensor scanning using DirectionalConeSensor with line-of-sight
 * Returns positions that would be visible to the robot's sensors
 */
export const scanWithSensors = (robotPosition, sensorRange, maze, robotDirection = 0) => {
  const SIZE = maze.length;
  const sensorManager = new SensorManager(SIZE, SIZE);
  sensorManager.addSensor('cone', new DirectionalConeSensor(SIZE, SIZE));
  
  // Convert 2D maze to flat array for SensorManager (required format)
  const flatMaze = new Uint8Array(SIZE * SIZE);
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      flatMaze[r * SIZE + c] = maze[r][c];
    }
  }
  
  // Get sensor positions with line-of-sight checking
  const positions = sensorManager.getAllSensorPositions(
    robotPosition.col, // Note: SensorManager expects x,y (col,row)
    robotPosition.row, 
    robotDirection, 
    { sensorRange }
  );
  
  // Filter positions that have line of sight and convert back to row/col format
  const visiblePositions = positions.filter(([x, y]) => 
    sensorManager.hasLineOfSight(flatMaze, 
      Math.floor(robotPosition.col), Math.floor(robotPosition.row), x, y)
  ).map(([x, y]) => ({ row: y, col: x }));
  
  return visiblePositions;
};