/**
 * ASCII Viewport Manager - Plain JavaScript version of useViewport
 * 
 * Handles viewport culling for ASCII rendering of large mazes,
 * centering the view around the robot position.
 */

import { CLI_VIEWPORT_WIDTH, CLI_VIEWPORT_HEIGHT, CLI_VIEWPORT_BUFFER } from '../constants.js';

export class ASCIIViewport {
  constructor(options = {}) {
    // Terminal viewport configuration - use constants as defaults
    this.VIEWPORT_WIDTH = options.width || CLI_VIEWPORT_WIDTH;
    this.VIEWPORT_HEIGHT = options.height || CLI_VIEWPORT_HEIGHT;
    this.BUFFER_CELLS = options.buffer || CLI_VIEWPORT_BUFFER;
    
    // Current camera position (no smoothing for ASCII)
    this.cameraPosition = { row: 0, col: 0 };
    this.initialized = false;
  }

  /**
   * Update viewport to center on character position
   */
  updateCamera(characterPosition, mazeSize) {
    if (!characterPosition) {
      return;
    }

    // Center camera on character
    const targetRow = characterPosition.row - Math.floor(this.VIEWPORT_HEIGHT / 2);
    const targetCol = characterPosition.col - Math.floor(this.VIEWPORT_WIDTH / 2);

    // Clamp to maze boundaries
    this.cameraPosition = {
      row: Math.max(0, Math.min(targetRow, mazeSize - this.VIEWPORT_HEIGHT)),
      col: Math.max(0, Math.min(targetCol, mazeSize - this.VIEWPORT_WIDTH))
    };

    this.initialized = true;
  }

  /**
   * Calculate visible bounds with buffer for efficient rendering
   */
  getVisibleBounds(mazeSize) {
    if (!this.initialized) {
      return {
        startRow: 0,
        endRow: Math.min(this.VIEWPORT_HEIGHT, mazeSize),
        startCol: 0,
        endCol: Math.min(this.VIEWPORT_WIDTH, mazeSize)
      };
    }

    const startRow = Math.max(0, this.cameraPosition.row - this.BUFFER_CELLS);
    const endRow = Math.min(mazeSize, this.cameraPosition.row + this.VIEWPORT_HEIGHT + this.BUFFER_CELLS);
    const startCol = Math.max(0, this.cameraPosition.col - this.BUFFER_CELLS);
    const endCol = Math.min(mazeSize, this.cameraPosition.col + this.VIEWPORT_WIDTH + this.BUFFER_CELLS);

    return { startRow, endRow, startCol, endCol };
  }

  /**
   * Get viewport statistics for debugging
   */
  getViewportStats(mazeSize) {
    const bounds = this.getVisibleBounds(mazeSize);
    const totalCells = mazeSize * mazeSize;
    const visibleCells = (bounds.endRow - bounds.startRow) * (bounds.endCol - bounds.startCol);
    const cullPercentage = ((totalCells - visibleCells) / totalCells * 100).toFixed(1);

    return {
      totalCells,
      visibleCells,
      cullPercentage: `${cullPercentage}%`,
      cameraPosition: this.cameraPosition,
      viewportSize: {
        width: this.VIEWPORT_WIDTH,
        height: this.VIEWPORT_HEIGHT
      },
      visibleBounds: bounds
    };
  }

  /**
   * Check if a cell is within the visible viewport
   */
  isInViewport(row, col) {
    const bounds = this.getVisibleBounds();
    return row >= bounds.startRow && row < bounds.endRow && 
           col >= bounds.startCol && col < bounds.endCol;
  }

  /**
   * Convert world coordinates to viewport relative coordinates
   */
  worldToViewport(row, col) {
    return {
      row: row - this.cameraPosition.row,
      col: col - this.cameraPosition.col
    };
  }

  /**
   * Convert viewport coordinates to world coordinates
   */
  viewportToWorld(row, col) {
    return {
      row: row + this.cameraPosition.row,
      col: col + this.cameraPosition.col
    };
  }
}