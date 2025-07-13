/**
 * Core Components and Utilities
 * 
 * Central exports for shared infrastructure components.
 */

// Rendering
export { CanvasRenderer, useViewport } from './rendering/index.js';

// Utilities
export { findConnectedComponents } from './utils/index.js';

// Sensors
export { 
  SensorManager, 
  DirectionalConeSensor, 
  LaserSensor, 
  SonarSensorArray 
} from './sensors/index.js';

// Frontier Detection
export { WavefrontFrontierDetection } from './frontier/index.js';