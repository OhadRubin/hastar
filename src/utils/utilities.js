class UnionFind {
  constructor(size) {
    this.parent = new Array(size);
    this.rank = new Array(size);
    for (let i = 0; i < size; i++) {
      this.parent[i] = i;
      this.rank[i] = 0;
    }
  }

  find(x) {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]);
    }
    return this.parent[x];
  }

  union(x, y) {
    const rootX = this.find(x);
    const rootY = this.find(y);
    
    if (rootX === rootY) return false;
    
    if (this.rank[rootX] < this.rank[rootY]) {
      this.parent[rootX] = rootY;
    } else if (this.rank[rootX] > this.rank[rootY]) {
      this.parent[rootY] = rootX;
    } else {
      this.parent[rootY] = rootX;
      this.rank[rootX]++;
    }
    return true;
  }
}

function heuristicString(a, b) {
  const [r1, c1] = a.split(',').map(Number);
  const [r2, c2] = b.split(',').map(Number);
  return Math.abs(r1 - r2) + Math.abs(c1 - c2);
}

function heuristicObject(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

function heuristicStringChebyshev(a, b) {
  const [r1, c1] = a.split(',').map(Number);
  const [r2, c2] = b.split(',').map(Number);
  const dx = Math.abs(r1 - r2);
  const dy = Math.abs(c1 - c2);
  return Math.max(dx, dy);
}

function heuristicObjectChebyshev(a, b) {
  const dx = Math.abs(a.row - b.row);
  const dy = Math.abs(a.col - b.col);
  return Math.max(dx, dy);
}

function getKey(cell) {
  return `${cell.row},${cell.col}`;
}

/**
 * 8-directional movement constants for diagonal movement support
 */
export const DIRECTIONS = {
  NORTH: 0,
  NORTHEAST: 1,
  EAST: 2,
  SOUTHEAST: 3,
  SOUTH: 4,
  SOUTHWEST: 5,
  WEST: 6,
  NORTHWEST: 7
};

export { UnionFind, heuristicString, heuristicObject, heuristicStringChebyshev, heuristicObjectChebyshev, getKey };
