#!/usr/bin/env python3

def create_triangular_cone(robotX, robotY, dirX, dirY, sensorRange):
    """Create a proper triangular cone pattern like the ASCII examples"""
    grid = [['.' for _ in range(21)] for _ in range(21)]
    grid[robotY][robotX] = 'R'
    
    for dist in range(1, sensorRange + 1):
        # Calculate the forward position
        frontX = robotX + dirX * dist
        frontY = robotY + dirY * dist
        
        # Create triangular spread - width increases with distance
        width = dist  # Triangle gets wider as it goes forward
        
        for w in range(-width, width + 1):
            # For diagonals, we need to spread perpendicular to the direction
            # Calculate perpendicular spread
            if dirX == 1 and dirY == -1:  # NORTHEAST
                x = frontX + w
                y = frontY + w
            elif dirX == 1 and dirY == 1:  # SOUTHEAST  
                x = frontX - w
                y = frontY + w
            elif dirX == -1 and dirY == 1:  # SOUTHWEST
                x = frontX - w  
                y = frontY - w
            elif dirX == -1 and dirY == -1:  # NORTHWEST
                x = frontX + w
                y = frontY - w
            else:
                continue
                
            if 0 <= x < 21 and 0 <= y < 21:
                if grid[y][x] == '.':
                    grid[y][x] = '#'
    
    return grid

def test_all_diagonals():
    robotX, robotY = 10, 10
    sensorRange = 6
    
    directions = [
        (1, -1, "NORTHEAST"),
        (1, 1, "SOUTHEAST"), 
        (-1, 1, "SOUTHWEST"),
        (-1, -1, "NORTHWEST")
    ]
    
    for dirX, dirY, name in directions:
        print(f"\n{name} diagonal cone:")
        grid = create_triangular_cone(robotX, robotY, dirX, dirY, sensorRange)
        for row in grid:
            print(''.join(row))

if __name__ == "__main__":
    test_all_diagonals()