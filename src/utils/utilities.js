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

function getKey(cell) {
  return `${cell.row},${cell.col}`;
}

export { UnionFind, heuristicString, heuristicObject, getKey };
