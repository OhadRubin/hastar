/**
 * Core Application Constants
 * 
 * Central configuration constants for the entire application.
 */

/**
 * Default region size for component-based algorithms.
 * This value controls the size of regions used in pathfinding and exploration algorithms.
 */
export const DEFAULT_REGION_SIZE = 16;

/**
 * Default maze size
 */
export const DEFAULT_MAZE_SIZE = 256;

/**
 * CLI ASCII Viewport Configuration
 * 
 * Controls the size of the ASCII viewport window for large maze rendering.
 * Common terminal sizes:
 * - 80x24 (traditional terminal)
 * - 100x30 (wider terminal)
 * - 120x40 (large terminal)
 * - 160x50 (very large terminal)
 */
export const CLI_VIEWPORT_WIDTH = 80;    // Terminal width in characters
export const CLI_VIEWPORT_HEIGHT = 24;   // Terminal height in characters  
export const CLI_VIEWPORT_BUFFER = 3;    // Buffer cells around viewport for smooth scrolling