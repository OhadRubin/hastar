#!/usr/bin/env python3

def test_new_diagonal_sensor():
    """Create proper solid triangular cones by filling triangular areas"""
    
    def create_sensor_pattern(robotX, robotY, robotDirection, sensorRange):
        grid = [['.' for _ in range(25)] for _ in range(25)]
        grid[robotY][robotX] = 'R'
        
        positions = set()
        positions.add((robotX, robotY))
        
        if robotDirection == 1:  # NORTHEAST
            # Fill triangular area pointing northeast
            for dist in range(1, sensorRange + 1):
                # Fill a diagonal line at this distance
                for w in range(dist + 1):
                    x = robotX + dist - w
                    y = robotY - w
                    if 0 <= x < 25 and 0 <= y < 25:
                        positions.add((x, y))
                        
        elif robotDirection == 3:  # SOUTHEAST
            # Fill triangular area pointing southeast
            for dist in range(1, sensorRange + 1):
                for w in range(dist + 1):
                    x = robotX + w
                    y = robotY + dist - w
                    if 0 <= x < 25 and 0 <= y < 25:
                        positions.add((x, y))
                        
        elif robotDirection == 5:  # SOUTHWEST
            # Fill triangular area pointing southwest
            for dist in range(1, sensorRange + 1):
                for w in range(dist + 1):
                    x = robotX - dist + w
                    y = robotY + w
                    if 0 <= x < 25 and 0 <= y < 25:
                        positions.add((x, y))
                        
        elif robotDirection == 7:  # NORTHWEST
            # Fill triangular area pointing northwest
            for dist in range(1, sensorRange + 1):
                for w in range(dist + 1):
                    x = robotX - w
                    y = robotY - dist + w
                    if 0 <= x < 25 and 0 <= y < 25:
                        positions.add((x, y))
        
        # Mark all sensor positions
        for x, y in positions:
            if grid[y][x] == '.':
                grid[y][x] = '#'
        
        return grid
    
    robotX, robotY = 12, 12
    sensorRange = 6
    
    directions = [
        (1, "NORTHEAST"),
        (3, "SOUTHEAST"), 
        (5, "SOUTHWEST"),
        (7, "NORTHWEST")
    ]
    
    for direction, name in directions:
        print(f"\n{name}:")
        print("=" * 20)
        grid = create_sensor_pattern(robotX, robotY, direction, sensorRange)
        for row in grid:
            print(''.join(row))

if __name__ == "__main__":
    test_new_diagonal_sensor()