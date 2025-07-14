#!/usr/bin/env python3

import math

def test_diagonal_sensor():
    # Simulate the current sensor logic
    robotGridX, robotGridY = 10, 10  # Robot at center
    sensorRange = 6
    
    # Test NORTHEAST direction (robotDirection = 1)
    dirX, dirY = 1, -1  # NORTHEAST vector
    
    print("Testing NORTHEAST diagonal sensor pattern:")
    print("Robot at (10, 10), direction: NORTHEAST")
    print()
    
    # Create a grid to visualize
    grid = [['.' for _ in range(21)] for _ in range(21)]
    grid[robotGridY][robotGridX] = 'R'  # Robot position
    
    # Apply current sensor logic
    for dist in range(0, sensorRange + 1):
        frontX = robotGridX + dirX * dist
        frontY = robotGridY + dirY * dist
        halfWidth = dist
        
        for side in range(-halfWidth, halfWidth + 1):
            # Current logic: perpendicular to diagonal
            perpX = -dirY  # = 1
            perpY = dirX   # = 1
            
            x = frontX + perpX * side
            y = frontY + perpY * side
            
            if 0 <= x < 21 and 0 <= y < 21:
                if grid[y][x] == '.':
                    grid[y][x] = '#'
    
    # Print the pattern
    for row in grid:
        print(''.join(row))
    
    print("\nExpected pattern should look like a triangle pointing NORTHEAST")
    print("Does this look like the triangular cones you showed?")

if __name__ == "__main__":
    test_diagonal_sensor()