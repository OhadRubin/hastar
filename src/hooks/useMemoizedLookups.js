import { useMemo } from 'react';

/**
 * Performance optimization hook that converts O(n) array operations to O(1) lookups
 * Addresses the critical performance bug where detailedPath.some() was called 4,096+ times per render
 */
export const useMemoizedLookups = (state) => {
  const { 
    detailedPath, 
    abstractPath, 
    characterPosition, 
    start, 
    end, 
    showAbstractPath,
    maze 
  } = state;

  // Convert detailed path to Set for O(1) position lookups
  const detailedPathSet = useMemo(() => {
    const pathSet = new Set();
    detailedPath.forEach(pos => {
      pathSet.add(`${pos.row},${pos.col}`);
    });
    return pathSet;
  }, [detailedPath]);

  // Convert abstract path to Set for O(1) region lookups  
  const abstractPathRegions = useMemo(() => {
    const regionSet = new Set();
    abstractPath.forEach(componentNodeId => {
      // Extract region ID from component node ID (format: "regionRow,regionCol_componentId")
      const regionId = componentNodeId.split('_')[0];
      regionSet.add(regionId);
    });
    return regionSet;
  }, [abstractPath]);

  // Pre-compute position strings for special positions
  const specialPositions = useMemo(() => {
    const positions = {
      start: start ? `${start.row},${start.col}` : null,
      end: end ? `${end.row},${end.col}` : null,
      character: characterPosition ? `${characterPosition.row},${characterPosition.col}` : null
    };
    return positions;
  }, [start, end, characterPosition]);

  // Pre-compute region lookup function for abstract path checking
  const isRegionInAbstractPath = useMemo(() => {
    if (!showAbstractPath || abstractPathRegions.size === 0) {
      return () => false;
    }
    return (regionRow, regionCol) => {
      const regionId = `${regionRow},${regionCol}`;
      return abstractPathRegions.has(regionId);
    };
  }, [abstractPathRegions, showAbstractPath]);

  // Optimized cell type checking functions (O(1) operations)
  const cellCheckers = useMemo(() => {
    return {
      // Check if position is in detailed path - O(1) instead of O(n)
      isInDetailedPath: (row, col) => {
        return detailedPathSet.has(`${row},${col}`);
      },

      // Check if position is start point - O(1)
      isStartPoint: (row, col) => {
        return specialPositions.start === `${row},${col}`;
      },

      // Check if position is end point - O(1)  
      isEndPoint: (row, col) => {
        return specialPositions.end === `${row},${col}`;
      },

      // Check if character is at this position - O(1)
      isCharacterPosition: (row, col) => {
        return specialPositions.character === `${row},${col}`;
      },

      // Check if character exists anywhere (for X marker logic) - O(1)
      hasCharacter: () => {
        return characterPosition !== null;
      },

      // Check if region is in abstract path - O(1)
      isRegionInAbstractPath: (regionRow, regionCol) => {
        return isRegionInAbstractPath(regionRow, regionCol);
      },

      // Combined checker for X marker visibility logic
      shouldShowXMarker: (row, col, isAnimating) => {
        return !isAnimating && 
               detailedPathSet.has(`${row},${col}`) && 
               specialPositions.character !== `${row},${col}`;
      },

      // Combined checker for character marker visibility
      shouldShowCharacter: (row, col) => {
        return specialPositions.character === `${row},${col}`;
      }
    };
  }, [detailedPathSet, specialPositions, characterPosition, isRegionInAbstractPath]);

  // Pre-computed color and opacity lookup for regions
  const regionStyles = useMemo(() => {
    const styles = new Map();
    
    // Only compute if we have a maze
    if (maze.length === 0) return styles;
    
    const REGION_SIZE = 8;
    const SIZE = maze.length;
    
    for (let regionRow = 0; regionRow < SIZE / REGION_SIZE; regionRow++) {
      for (let regionCol = 0; regionCol < SIZE / REGION_SIZE; regionCol++) {
        const regionId = `${regionRow},${regionCol}`;
        const isInPath = isRegionInAbstractPath(regionRow, regionCol);
        
        styles.set(regionId, {
          borderColor: isInPath ? '#10B981' : '#4a5568',
          borderWidth: isInPath ? '3px' : '1px',
          overlap: isInPath ? 1 : 0
        });
      }
    }
    
    return styles;
  }, [maze, isRegionInAbstractPath]);

  // Stats for performance monitoring
  const performanceStats = useMemo(() => {
    return {
      detailedPathSize: detailedPath.length,
      abstractPathSize: abstractPath.length,
      detailedPathSetSize: detailedPathSet.size,
      abstractPathRegionsSize: abstractPathRegions.size,
      hasOptimizedLookups: true
    };
  }, [detailedPath.length, abstractPath.length, detailedPathSet.size, abstractPathRegions.size]);

  return {
    // Optimized lookup functions
    cellCheckers,
    
    // Pre-computed data structures
    detailedPathSet,
    abstractPathRegions,
    specialPositions,
    regionStyles,
    
    // Performance monitoring
    performanceStats
  };
};