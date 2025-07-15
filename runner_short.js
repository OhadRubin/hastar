#!/usr/bin/env node
class UF {
  constructor(size) {
    this.p = Array.from({length: size}, (_, i) => i);
    this.r = new Array(size).fill(0);
  }
  find(i) { return this.p[i] === i ? i : (this.p[i] = this.find(this.p[i])); }
  union(i, j) {
    let rootI = this.find(i), rootJ = this.find(j);
    if (rootI === rootJ) return false;
    if (this.r[rootI] < this.r[rootJ]) [rootI, rootJ] = [rootJ, rootI];
    this.p[rootJ] = rootI;
    if (this.r[rootI] === this.r[rootJ]) this.r[rootI]++;
    return true;
  }
}
function heuristic(a, b, chebyshev = false) {
  const [r1, c1] = typeof a === 'string' ? a.split(',').map(Number) : [a.row, a.col];
  const [r2, c2] = typeof b === 'string' ? b.split(',').map(Number) : [b.row, b.col];
  const dx = Math.abs(r1 - r2), dy = Math.abs(c1 - c2);
  return chebyshev ? Math.max(dx, dy) : dx + dy;
}
function getKey(cell) { return `${cell.row},${cell.col}`; }
const DIR = { N: 0, NE: 1, E: 2, SE: 3, S: 4, SW: 5, W: 6, NW: 7 };
const C = { UNKNOWN: 2, WALL: 1, WALKABLE: 0 };
const updateKnownMap = (kMap, fMaze, sPos) => {
  const newKMap = kMap.map(r => [...r]);
  const newCells = [];
  for (const p of sPos) {
    if (kMap[p.row][p.col] === C.UNKNOWN) {
      const actual = fMaze[p.row][p.col];
      newKMap[p.row][p.col] = actual;
      newCells.push({ ...p, newState: actual });
    }
  }
  return { kMap: newKMap, newCells };
};
const DEF_REG_SIZE = 16, DEF_MAZE_SIZE = 256;
const CLI_VP_W = 24, CLI_VP_H = 24, CLI_VP_B = 3, CLI_FR_B_S = 50, CLI_SAVE_KEY = 's';
const mkAlgo = (cfg) => ({
  name: cfg.name, type: cfg.type, description: cfg.description || '',
  parameters: cfg.parameters || {},
  async execute(input, opts = {}, onProg = null) { return cfg.execute(input, opts, onProg); },
  createInitialState(input, opts = {}) { return cfg.createInitialState ? cfg.createInitialState(input, opts) : {}; },
  validateParameters(params = {}) {
    const valid = {};
    for (const [key, spec] of Object.entries(this.parameters)) {
      const val = params[key] ?? spec.default;
      valid[key] = spec.min !== undefined && val < spec.min ? spec.min
                 : spec.max !== undefined && val > spec.max ? spec.max
                 : spec.options && !spec.options.includes(val) ? spec.default
                 : val;
    }
    return valid;
  }
});
const mkResult = (res, mets = {}, fState = null) => ({ result: res, metrics: { executionTime: 0, ...mets }, finalState: fState });
const ParamT = { NUM: 'number', STR: 'string', BOOL: 'boolean', SEL: 'select' };
const numP = (min, max, def, step = 1) => ({ type: ParamT.NUM, min, max, default: def, step });
const selP = (opts, def) => ({ type: ParamT.SEL, options: opts, default: def });
const boolP = (def) => ({ type: ParamT.BOOL, default: def });
class SensorManager {
  constructor(w, h) { this.w = w; this.h = h; this.sensors = {}; }
  addSensor(name, instance) { this.sensors[name] = instance; }
  getAllSensorPositions(x, y, dir, opts) {
    return this.sensors.cone?.getVisibleCells(x, y, dir, opts.sensorRange) || [];
  }
  hasLineOfSight(maze, x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1);
    const sx = (x1 < x2) ? 1 : -1, sy = (y1 < y2) ? 1 : -1;
    let err = dx - dy, curX = x1, curY = y1;
    while (true) {
      if ((curX !== x1 || curY !== y1) && (curX !== x2 || curY !== y2) && maze[curY * this.w + curX] === C.WALL) return false;
      if (curX === x2 && curY === y2) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; curX += sx; }
      if (e2 < dx) { err += dx; curY += sy; }
    }
    return true;
  }
}
class DirectionalConeSensor {
  constructor(w, h) { this.w = w; this.h = h; }
  getVisibleCells(startX, startY, dir, range) {
    const visible = [], minX = Math.max(0, startX - range), maxX = Math.min(this.w - 1, startX + range);
    const minY = Math.max(0, startY - range), maxY = Math.min(this.h - 1, startY + range);
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++)
        if (Math.sqrt((x-startX)**2 + (y-startY)**2) <= range) visible.push([x,y]);
    return visible;
  }
}
class WFD {
  constructor(w, h) { this.w = w; this.h = h; }
  detectFrontiers(kMap) {
    if (!kMap) return [];
    const pts = this.findFrontierPoints(kMap);
    const groups = this.groupFrontierPoints(pts);
    return groups.map(g => ({ points: g, centroid: this.calcCentroid(g), median: this.calcMedian(g), size: g.length }));
  }
  findFrontierPoints(kMap) {
    const frontierPts = [], open = [], closed = new Set();
    for (let y=1; y<this.h-1; y++) for (let x=1; x<this.w-1; x++) if (kMap[y*this.w+x]===C.WALKABLE) open.push({x,y});
    while (open.length > 0) {
      const cell = open.shift(), key = `${cell.x},${cell.y}`;
      if (closed.has(key)) continue;
      closed.add(key);
      let isFrontier = false;
      for (const n of this.getNeighbors(cell.x, cell.y)) if (kMap[n.y*this.w+n.x] === C.UNKNOWN) { isFrontier = true; break; }
      if (isFrontier) frontierPts.push({x: cell.x + 0.5, y: cell.y + 0.5});
      for (const n of this.getNeighbors(cell.x, cell.y)) {
        const nKey = `${n.x},${n.y}`, idx = n.y * this.w + n.x;
        if (!closed.has(nKey) && n.x>=0 && n.x<this.w && n.y>=0 && n.y<this.h && kMap[idx]===C.WALKABLE && !open.some(c=>c.x===n.x&&c.y===n.y)) open.push(n);
      }
    }
    return frontierPts;
  }
  groupFrontierPoints(pts) {
    const visited = new Set(), groups = [];
    for (const p of pts) {
      const key = `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      if (visited.has(key)) continue;
      const q = [p], group = [], closeList = new Set();
      while(q.length > 0) {
        const curr = q.shift(), cKey = `${curr.x.toFixed(1)},${curr.y.toFixed(1)}`;
        if(closeList.has(cKey)) continue;
        closeList.add(cKey); visited.add(cKey); group.push(curr);
        for(const cand of pts) {
          const candKey = `${cand.x.toFixed(1)},${cand.y.toFixed(1)}`;
          if(!closeList.has(candKey) && !visited.has(candKey) && Math.sqrt((cand.x-curr.x)**2 + (cand.y-curr.y)**2) < 2) q.push(cand);
        }
      }
      groups.push(group);
    }
    return groups;
  }
  calcCentroid(pts) {
    if (pts.length === 0) return null;
    const sumX = pts.reduce((s, p) => s + p.x, 0), sumY = pts.reduce((s, p) => s + p.y, 0);
    return { x: sumX / pts.length, y: sumY / pts.length };
  }
  calcMedian(pts) {
    if (pts.length === 0) return null;
    if (pts.length === 1) return pts[0];
    const center = this.calcCentroid(pts);
    const sorted = [...pts].sort((a,b) => ((a.x-center.x)**2+(a.y-center.y)**2) - ((b.x-center.x)**2+(b.y-center.y)**2));
    return sorted[Math.floor(sorted.length/2)];
  }
  getNeighbors(x,y) {
    const neighbors = [];
    for (const [dx,dy] of [[0,1],[1,0],[0,-1],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]) {
      const nx = x+dx, ny = y+dy;
      if(nx>=0&&nx<this.w&&ny>=0&&ny<this.h) neighbors.push({x:nx,y:ny});
    }
    return neighbors;
  }
}
const findComps = (maze, startR, startC, REG_SIZE) => {
  const comps = [], visited = Array(REG_SIZE).fill(null).map(() => Array(REG_SIZE).fill(false));
  const fill = (r, c, id) => {
    if (r<0||r>=REG_SIZE||c<0||c>=REG_SIZE||visited[r][c]) return;
    const mR = startR + r, mC = startC + c;
    if (maze[mR][mC] !== C.WALKABLE) return;
    visited[r][c] = true;
    comps[id].push({ row: mR, col: mC });
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]) fill(r+dr, c+dc, id);
  };
  let id = 0;
  for (let r = 0; r < REG_SIZE; r++)
    for (let c = 0; c < REG_SIZE; c++)
      if (!visited[r][c] && maze[startR+r][startC+c] === 0) {
        comps[id] = [];
        fill(r, c, id++);
      }
  return comps;
};
const scanWithSensors = (robotPos, sRange, maze, rDir = 0) => {
  const SIZE = maze.length;
  const sMan = new SensorManager(SIZE, SIZE);
  sMan.addSensor('cone', new DirectionalConeSensor(SIZE, SIZE));
  const fMaze = new Uint8Array(SIZE*SIZE);
  for (let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) fMaze[r*SIZE+c] = maze[r][c];
  const pos = sMan.getAllSensorPositions(robotPos.col, robotPos.row, rDir, { sensorRange:sRange });
  return pos.filter(([x, y]) => sMan.hasLineOfSight(fMaze, Math.floor(robotPos.col), Math.floor(robotPos.row), x, y)).map(([x, y]) => ({ row: y, col: x }));
};
class ASCIIViewport {
  constructor(opts = {}) {
    this.W = opts.width || CLI_VP_W; this.H = opts.height || CLI_VP_H;
    this.B = opts.buffer || CLI_VP_B; this.cam = { row: 0, col: 0 }; this.init = false;
  }
  updateCamera(charPos, mSize) {
    if (!charPos) return;
    this.cam = {
      row: Math.max(0, Math.min(charPos.row-Math.floor(this.H/2), mSize-this.H)),
      col: Math.max(0, Math.min(charPos.col-Math.floor(this.W/2), mSize-this.W))
    }; this.init = true;
  }
  getVisibleBounds(mSize) {
    if(!this.init) return {startR:0,endR:Math.min(this.H,mSize),startC:0,endC:Math.min(this.W,mSize)};
    return {
      startR:Math.max(0,this.cam.row-this.B), endR:Math.min(mSize, this.cam.row+this.H+this.B),
      startC:Math.max(0,this.cam.col-this.B), endC:Math.min(mSize, this.cam.col+this.W+this.B)
    };
  }
}
const buildComponentGraph = (maze, cMaze, SIZE, REG_SIZE) => {
  const nReg = SIZE / REG_SIZE, graph = {};
  for (let rR = 0; rR < nReg; rR++) for (let rC = 0; rC < nReg; rC++) {
    const sR=rR*REG_SIZE, sC=rC*REG_SIZE, cells=new Map();
    for (let r=sR; r<sR+REG_SIZE; r++) for (let c=sC; c<sC+REG_SIZE; c++) {
      if(maze[r][c]===C.WALKABLE) {
        const id=cMaze[r][c];
        if(id!==-1) { if(!cells.has(id)) cells.set(id,[]); cells.get(id).push({row:r,col:c}); }
      }
    }
    for (const [id, cList] of cells) graph[`${rR},${rC}_${id}`] = { rR, rC, id, cells:cList, neighbors:[], transitions:[] };
  }
  const addEdge = (id1, id2, from, to) => {
    if(graph[id1] && graph[id2] && !graph[id1].neighbors.includes(id2)) {
      graph[id1].neighbors.push(id2);
      graph[id1].transitions.push({to:id2, fromCell:from, toCell:to});
    }
  };
  for (let r=0; r<SIZE-1; r++) for (let c=0; c<SIZE-1; c++) {
    if (maze[r][c] === C.WALKABLE) {
      if (maze[r][c+1] === C.WALKABLE) { // Horizontal
        const id1=getCompId({row:r,col:c},cMaze,REG_SIZE), id2=getCompId({row:r,col:c+1},cMaze,REG_SIZE);
        if(id1 && id2 && id1!==id2) { addEdge(id1,id2,{row:r,col:c},{row:r,col:c+1}); addEdge(id2,id1,{row:r,col:c+1},{row:r,col:c}); }
      }
      if (maze[r+1][c] === C.WALKABLE) { // Vertical
        const id1=getCompId({row:r,col:c},cMaze,REG_SIZE), id2=getCompId({row:r+1,col:c},cMaze,REG_SIZE);
        if(id1 && id2 && id1!==id2) { addEdge(id1,id2,{row:r,col:c},{row:r+1,col:c}); addEdge(id2,id1,{row:r+1,col:c},{row:r,col:c}); }
      }
      if (maze[r+1][c+1] === C.WALKABLE && maze[r][c+1] === C.WALKABLE && maze[r+1][c] === C.WALKABLE) { // Diagonal
        const id1=getCompId({row:r,col:c},cMaze,REG_SIZE), id2=getCompId({row:r+1,col:c+1},cMaze,REG_SIZE);
        if(id1 && id2 && id1!==id2) { addEdge(id1,id2,{row:r,col:c},{row:r+1,col:c+1}); addEdge(id2,id1,{row:r+1,col:c+1},{row:r,col:c}); }
      }
    }
  }
  return graph;
};
const getCompId = (pos, cMaze, REG_SIZE) => {
  const rR = Math.floor(pos.row / REG_SIZE), rC = Math.floor(pos.col / REG_SIZE);
  const id = cMaze[pos.row][pos.col];
  return id === -1 ? null : `${rR},${rC}_${id}`;
};
const compHeuristic = (fromId, toId, hType = 'manhattan') => {
  const fromR=fromId.split('_')[0], toR=toId.split('_')[0];
  return heuristic(fromR, toR, hType==='chebyshev');
};
const findAbstractPath = (startId, endId, graph, hType = 'manhattan') => {
  if (!graph[startId] || !graph[endId]) return { path: null };
  if (startId === endId) return { path: [startId] };
  const open = [startId], cameFrom = {}, gScore = { [startId]: 0 };
  const fScore = { [startId]: compHeuristic(startId, endId, hType) };
  while (open.length > 0) {
    let curr = open.reduce((min, n) => fScore[n] < fScore[min] ? n : min);
    if (curr === endId) {
      const path = []; let pathCurr = curr;
      while (pathCurr) { path.unshift(pathCurr); pathCurr = cameFrom[pathCurr]; }
      return { path };
    }
    open.splice(open.indexOf(curr), 1);
    for (const neighbor of graph[curr].neighbors) {
      const tenG = gScore[curr] + 1;
      if (gScore[neighbor] === undefined || tenG < gScore[neighbor]) {
        cameFrom[neighbor] = curr; gScore[neighbor] = tenG;
        fScore[neighbor] = tenG + compHeuristic(neighbor, endId, hType);
        if (!open.includes(neighbor)) open.push(neighbor);
      }
    }
  } return { path: null };
};
const findPathInComp = (start, end, maze, SIZE, compCells, hType = 'manhattan') => {
  const h = (a, b) => heuristic(a, b, hType === 'chebyshev');
  const valid = new Set(compCells.map(c => `${c.row},${c.col}`));
  if (!valid.has(getKey(start))) return { path: null };
  let actualEnd = end;
  if (!valid.has(getKey(end))) {
    let minD = Infinity;
    for (const c of compCells) { const d = h(c,end); if (d < minD) { minD = d; actualEnd = c; } }
  }
  const open=[start], cameFrom={}, gScore={[getKey(start)]:0}, fScore={[getKey(start)]:h(start,actualEnd)};
  const dirs = [[-1,0,1], [1,0,1], [0,-1,1], [0,1,1], [-1,-1,1.414], [-1,1,1.414], [1,-1,1.414], [1,1,1.414]];
  while (open.length > 0) {
    let curr = open.reduce((min, n) => fScore[getKey(n)] < fScore[getKey(min)] ? n : min);
    if (curr.row === actualEnd.row && curr.col === actualEnd.col) {
      const path = []; while (curr) { path.unshift(curr); curr = cameFrom[getKey(curr)]; }
      return { path, actualEnd };
    }
    open.splice(open.findIndex(n => n.row === curr.row && n.col === curr.col), 1);
    for (const [dr, dc, cost] of dirs) {
      const n = {row:curr.row+dr, col:curr.col+dc};
      const nKey = getKey(n);
      if (n.row<0||n.row>=SIZE||n.col<0||n.col>=SIZE||maze[n.row][n.col]!==C.WALKABLE||!valid.has(nKey)) continue;
      const tenG = gScore[getKey(curr)] + cost;
      if (gScore[nKey] === undefined || tenG < gScore[nKey]) {
        cameFrom[nKey]=curr; gScore[nKey]=tenG; fScore[nKey]=tenG+h(n,actualEnd);
        if(!open.some(o=>o.row===n.row&&o.col===n.col)) open.push(n);
      }
    }
  } return { path: null, actualEnd: null };
};
const findHAAStarPath = (start, end, maze, graph, cMaze, REG_SIZE, SIZE, hType = 'manhattan') => {
  const sTime = performance.now();
  const sId = getCompId(start, cMaze, REG_SIZE), eId = getCompId(end, cMaze, REG_SIZE);
  if (!sId || !eId) return { abstractPath: null, detailedPath: null };
  const absPathRes = findAbstractPath(sId, eId, graph, hType);
  const absPath = absPathRes.path;
  if (!absPath) return { abstractPath: null, detailedPath: null };
  const detPath = []; let currPos = start, finalEnd = end;
  for (let i = 0; i < absPath.length; i++) {
    const currCompId = absPath[i], currComp = graph[currCompId];
    let pathRes;
    if (i === absPath.length - 1) {
      pathRes = findPathInComp(currPos, end, maze, SIZE, currComp.cells, hType);
    } else {
      const nextCompId = absPath[i+1];
      const trans = currComp.transitions.find(t => t.to === nextCompId);
      if (!trans) return { abstractPath: absPath, detailedPath: null };
      pathRes = findPathInComp(currPos, trans.fromCell, maze, SIZE, currComp.cells, hType);
    }
    if (pathRes && pathRes.path && pathRes.path.length > 0) {
      const sIdx = (detPath.length > 0 && pathRes.path.length > 0 && detPath[detPath.length-1].row===pathRes.path[0].row && detPath[detPath.length-1].col===pathRes.path[0].col) ? 1 : 0;
      detPath.push(...pathRes.path.slice(sIdx));
      if (i < absPath.length - 1) {
        const trans = currComp.transitions.find(t=>t.to===absPath[i+1]);
        currPos = trans.toCell;
        const lastCell = detPath[detPath.length-1];
        if(!(lastCell.row===currPos.row && lastCell.col===currPos.col)) detPath.push(currPos);
      } else finalEnd = pathRes.actualEnd;
    } else return { abstractPath: absPath, detailedPath: null };
  }
  return { abstractPath: absPath, detailedPath: detPath, actualEnd: finalEnd, executionTime: performance.now() - sTime };
};
const compHAAStarAlgo = mkAlgo({
  name: 'Component-Based Hierarchical A*', type: 'pathfinding',
  description: 'Hierarchical A* using component-based abstraction',
  parameters: {
    regionSize: numP(4, 16, DEF_REG_SIZE, 4),
    hWeight: numP(1, 2, 1, 0.1), hType: selP(['manhattan', 'chebyshev'], 'manhattan')
  },
  async execute(input, opts, onProg) {
    const { maze, cMaze, graph, start, end, SIZE = 256 } = input;
    const { regionSize = DEF_REG_SIZE, hType = 'manhattan' } = opts;
    const sTime = performance.now();
    const res = findHAAStarPath(start, end, maze, graph, cMaze, regionSize, SIZE, hType);
    const eTime = performance.now();
    if(onProg) onProg({type:'path_complete',...res, executionTime:eTime-sTime});
    return mkResult({ ...res, success:res.detailedPath!==null }, {
      executionTime: eTime - sTime,
      pathLength: res.detailedPath ? res.detailedPath.length : 0,
      abstractPathLength: res.abstractPath ? res.abstractPath.length : 0,
    });
  }
});
const findCompPath = (start, goal, kMap, graph, cMaze, REG_SIZE) => {
  const res = findHAAStarPath(start, goal, kMap, graph, cMaze, REG_SIZE, kMap.length);
  return { path: res.detailedPath, actualEnd: res.actualEnd };
};
const updateCompStruct = (kMap, graph, cMaze, newCells, REG_SIZE) => {
  const SIZE = kMap.length, nReg = SIZE/REG_SIZE, toUpdate = new Set();
  newCells.forEach(c => { if(c.newState===C.WALKABLE) toUpdate.add(`${Math.floor(c.row/REG_SIZE)},${Math.floor(c.col/REG_SIZE)}`); });
  const newGraph = { ...graph }, newCMaze = cMaze.map(r=>[...r]);
  for (const regKey of toUpdate) {
    const [rR, rC] = regKey.split(',').map(Number);
    Object.keys(newGraph).forEach(nId => { if(nId.startsWith(`${rR},${rC}_`)) delete newGraph[nId]; });
    const sR=rR*REG_SIZE, sC=rC*REG_SIZE;
    for(let r=sR;r<sR+REG_SIZE;r++) for(let c=sC;c<sC+REG_SIZE;c++) if(r<SIZE&&c<SIZE) newCMaze[r][c]=-1;
    const comps = findComps(kMap, sR, sC, REG_SIZE);
    comps.forEach((comp, id) => {
      if(comp.length === 0) return;
      const nId=`${rR},${rC}_${id}`;
      newGraph[nId] = {rR,rC,id,cells:comp,neighbors:[],transitions:[]};
      comp.forEach(cell => newCMaze[cell.row][cell.col]=id);
    });
  }
  for (const nId of Object.keys(newGraph)) { newGraph[nId].neighbors=[]; newGraph[nId].transitions=[]; }
  const addEdge = (id1, id2, from, to) => {
    if(newGraph[id1] && newGraph[id2] && !newGraph[id1].neighbors.includes(id2)) {
      newGraph[id1].neighbors.push(id2);
      newGraph[id1].transitions.push({to:id2, fromCell:from, toCell:to});
    }
  };
  for(let r=0; r<SIZE-1; r++) for(let c=0; c<SIZE-1; c++){
    if(kMap[r][c] !== C.WALKABLE) continue;
    const checkAndAdd = (nr, nc, isDiag) => {
      if(nr<SIZE && nc<SIZE && kMap[nr][nc]===C.WALKABLE){
        if(isDiag && (kMap[r][nc] !== C.WALKABLE || kMap[nr][c] !== C.WALKABLE)) return;
        if(Math.floor(r/REG_SIZE)!==Math.floor(nr/REG_SIZE) || Math.floor(c/REG_SIZE)!==Math.floor(nc/REG_SIZE)){
          const id1=getCompId({row:r,col:c},newCMaze,REG_SIZE), id2=getCompId({row:nr,col:nc},newCMaze,REG_SIZE);
          if(id1 && id2 && id1!==id2) {
            addEdge(id1,id2,{row:r,col:c},{row:nr,col:nc});
            addEdge(id2,id1,{row:nr,col:nc},{row:r,col:c});
          }
        }
      }
    };
    checkAndAdd(r, c + 1, false);
    checkAndAdd(r + 1, c, false);
    checkAndAdd(r + 1, c + 1, true);
  }
  return { componentGraph: newGraph, coloredMaze: newCMaze };
};
const detectCompAwareFrontiers = (kMap, graph, cMaze, useWFD = true, fStrat = 'centroid', rPos = null) => {
  const SIZE = kMap.length;
  if(useWFD) {
    const wfd = new WFD(SIZE, SIZE);
    const fKMap = new Uint8Array(SIZE*SIZE);
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) fKMap[r*SIZE+c] = kMap[r][c];
    const fGroups = wfd.detectFrontiers(fKMap);
    const compFronts = [];
    for(const g of fGroups) {
      let tP = (fStrat==='centroid' && g.centroid) ? {row:Math.floor(g.centroid.y),col:Math.floor(g.centroid.x)}
             : (fStrat==='median' && g.median) ? {row:Math.floor(g.median.y),col:Math.floor(g.median.x)}
             : {row:Math.floor(g.points[0].y),col:Math.floor(g.points[0].x)};
      if(tP) {
        let assocComp = getCompId(tP, cMaze, DEF_REG_SIZE);
        if(!assocComp) {
          let cComp=null, minD=Infinity;
          for(const [nId,comp] of Object.entries(graph)) for(const cell of comp.cells) {
            const d=heuristic(cell,tP,true); if(d<minD){minD=d;cComp=nId;}
          }
          assocComp = cComp;
        }
        if(rPos && heuristic(tP, rPos) <= 1.5) continue;
        compFronts.push({ row:tP.row, col:tP.col, componentId:assocComp, groupSize: g.size || g.points?.length || 1, points:g.points.map(p=>({row:Math.floor(p.y),col:Math.floor(p.x)}))});
      }
    }
    return compFronts;
  }
  const fronts = [];
  for (const [nId, comp] of Object.entries(graph)) for (const cell of comp.cells) {
    let hasUnk=false;
    for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]) {
      const nr=cell.row+dr, nc=cell.col+dc;
      if(nr>=0&&nr<SIZE&&nc>=0&&nc<SIZE&&kMap[nr][nc]===C.UNKNOWN){hasUnk=true;break;}
    }
    if(hasUnk && (!rPos || heuristic(cell,rPos)>1.5)) fronts.push({row:cell.row,col:cell.col,componentId:nId,groupSize:1});
  }
  return fronts;
};
const isCompReachable = (rComp, tComp, graph) => {
  if (!rComp || !tComp || !graph[rComp]) return false;
  if (rComp === tComp) return true;
  const visited = new Set([rComp]), q = [rComp];
  while (q.length > 0) {
    const curr = q.shift();
    if (curr === tComp) return true;
    const node = graph[curr];
    if (node?.neighbors) for (const n of node.neighbors) if (!visited.has(n)) { visited.add(n); q.push(n); }
  }
  return false;
};
const selectOptimalFrontier = (fronts, rPos, graph, cMaze, prevTargets = [], kMap = null) => {
  if (fronts.length === 0) return null;
  const rComp = getCompId(rPos, cMaze, DEF_REG_SIZE);
  let reachable = fronts.filter(f => isCompReachable(rComp, f.componentId, graph));
  if (reachable.length === 0) return null;
  const recent = prevTargets.slice(-5);
  let available = reachable.filter(f => !recent.some(pT => pT && f.row === pT.row && f.col === pT.col));
  if (available.length === 0) available = reachable;
  const withDists = available.map(f => {
    let pathDist = f.pathDistance || Infinity;
    if (kMap) {
      const pRes = findCompPath(rPos, { row:f.row, col:f.col }, kMap, graph, cMaze, DEF_REG_SIZE);
      if (pRes?.path) pathDist = pRes.path.length;
    }
    return { ...f, pathDist };
  });
  return withDists.sort((a,b) => a.pathDist - b.pathDist)[0];
};
const shouldAbandon = (rPos, currT, fronts, pRes, graph, cMaze, expState, fPaths) => {
  const currCost = pRes?.path ? pRes.path.length : Infinity;
  let newT = null, newPath = null, newCost = Infinity;
  for (const {frontier:f, path, cost} of fPaths) {
    if (!path || cost===Infinity || (f.row===currT.row && f.col===currT.col)) continue;
    const isRecent = (expState.prev_targets?.slice(-3)||[]).some(pT => pT && f.row===pT.row && f.col===pT.col);
    if (!isRecent && isCompReachable(getCompId(rPos, cMaze, DEF_REG_SIZE), f.componentId, graph) && cost < newCost) {
      newT=f; newPath=path; newCost=cost;
    }
  }
  if (newCost < currCost && newT) {
    const isYoyo = (expState.prev_targets.slice(-5)).some(pT => pT && newT && pT.row === newT.row && pT.col === newT.col);
    if (isYoyo) return null;
    expState.prev_targets.push(currT);
    if(expState.prev_targets.length > 20) expState.prev_targets.shift();
    return { target: newT, path: newPath };
  }
  return null;
};
function getRotPath(from, to) {
  if (from === to) return [from];
  const cDist=(to-from+8)%8, ccDist=(from-to+8)%8, path=[from];
  if (cDist<=ccDist) { for(let i=1;i<=cDist;i++) path.push((from+i)%8); }
  else { for(let i=1;i<=ccDist;i++) path.push((from-i+8)%8); }
  return path;
}
function rotateAndSense(currDir, tDir, rPos, sRange, fMaze, kMap, graph, cMaze, regSize) {
  const rotPath = getRotPath(currDir, tDir);
  let cKMap=kMap, cGraph=graph, cCMaze=cMaze, allNewCells=[];
  for (let i=1; i<rotPath.length; i++) {
    const sPos = scanWithSensors(rPos, sRange, fMaze, rotPath[i]);
    const uRes = updateKnownMap(cKMap, fMaze, sPos);
    cKMap = uRes.kMap;
    if(uRes.newCells) allNewCells.push(...uRes.newCells);
  }
  const SIZE=cKMap.length, allWalkable = [];
  for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(cKMap[r][c]===C.WALKABLE) allWalkable.push({row:r,col:c,newState:C.WALKABLE});
  const compUp = updateCompStruct(cKMap, {}, Array(SIZE).fill(null).map(() => Array(SIZE).fill(-1)), allWalkable, regSize);
  return { finalDir:tDir, kMap:cKMap, graph:compUp.componentGraph, cMaze:compUp.coloredMaze };
}
function perform360Scan(rPos, sRange, fMaze, kMap, graph, cMaze, regSize) {
  let cKMap=kMap, allNewCells=[];
  for(let dir=0; dir<8; dir++) {
    const sPos = scanWithSensors(rPos, sRange, fMaze, dir);
    const uRes = updateKnownMap(cKMap, fMaze, sPos);
    cKMap = uRes.kMap;
    if(uRes.newCells) allNewCells.push(...uRes.newCells);
  }
  const SIZE=cKMap.length, allWalkable=[];
  for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(cKMap[r][c]===C.WALKABLE) allWalkable.push({row:r,col:c,newState:C.WALKABLE});
  const compUp = updateCompStruct(cKMap, {}, Array(SIZE).fill(null).map(() => Array(SIZE).fill(-1)), allWalkable, regSize);
  return {kMap: cKMap, graph: compUp.componentGraph, cMaze: compUp.coloredMaze, newCellsCount:allNewCells.length};
}
const initExpState = (input, opts, REG_SIZE) => {
  const { maze:fMaze, start:sPos, SIZE } = input;
  let rPos = { ...sPos }, rDir = 0;
  let kMap = Array(SIZE).fill(null).map(() => Array(SIZE).fill(C.UNKNOWN));
  let cMaze = Array(SIZE).fill(null).map(() => Array(SIZE).fill(-1));
  let graph = {};
  const initSPos = scanWithSensors(rPos, opts.sensorRange, fMaze, rDir);
  const initUpdate = updateKnownMap(kMap, fMaze, initSPos);
  kMap = initUpdate.kMap;
  const initCompUp = updateCompStruct(kMap, graph, cMaze, initUpdate.newCells, REG_SIZE);
  return {
    rPos, rDir, kMap, cMaze, graph, expPos: [{...rPos}],
    iter: 0, lastT: null, sameTCount: 0, currT: null, prevTs: [], recentPos: [],
    lastTSwitchIter: -opts.targetSwitchCooldown
  };
};
const senseAndUpdate = (state, fMaze, sRange, REG_SIZE) => {
  const sPos = scanWithSensors(state.rPos, sRange, fMaze, state.rDir);
  const uRes = updateKnownMap(state.kMap, fMaze, sPos);
  state.kMap = uRes.kMap;
  const compUp = updateCompStruct(state.kMap, state.graph, state.cMaze, uRes.newCells, REG_SIZE);
  state.graph=compUp.componentGraph; state.cMaze=compUp.coloredMaze;
  return { sPos, newCells:uRes.newCells };
};
const calcCoverage = (kMap, fMaze) => {
  let known=0, total=0;
  for(let r=0;r<fMaze.length;r++) for(let c=0;c<fMaze.length;c++) {
    if(fMaze[r][c]===C.WALKABLE){ total++; if(kMap[r][c]===C.WALKABLE) known++; }
  }
  return total > 0 ? (known / total) * 100 : 0;
};
const compExpAlgo = mkAlgo({
  name: 'Component-Based Exploration', type: 'exploration',
  description: 'Dynamic HPA* exploration with online component graph evolution',
  parameters: {
    sRange: numP(5, 30, 15, 1), stepSize: numP(0.5, 2.0, 1.0, 0.1),
    maxIter: numP(100, 50000, 10000, 100), expThresh: numP(80, 100, 100, 1),
    useWFD: selP(['true', 'false'], 'true'), fStrat: selP(['nearest', 'centroid', 'median'], 'median'),
    tSwitchCD: numP(0, 20, 5, 1), scan360: selP(['true', 'false'], 'true'),
  },
  async execute(input, opts, onProg) {
    const { maze:fMaze, SIZE=256 } = input;
    const { expThresh=100, delay=50, maxIter=10000, useWFD='true', fStrat='median', sRange=15, stepSize=1.0, scan360='true' } = opts;
    const REG_SIZE = DEF_REG_SIZE;
    const sTime = performance.now();
    const state = initExpState(input, opts, REG_SIZE);
    while (state.iter < maxIter) {
      state.iter++;
      senseAndUpdate(state, fMaze, sRange, REG_SIZE);
      const coverage = calcCoverage(state.kMap, fMaze);
      if (coverage >= expThresh) { console.log(`Coverage threshold reached`); break; }
      
      let fronts = detectCompAwareFrontiers(state.kMap, state.graph, state.cMaze, useWFD==='true', fStrat, state.rPos);
      if (fronts.length === 0) { console.log(`No more frontiers`); break; }

      const rComp = getCompId(state.rPos, state.cMaze, REG_SIZE);
      fronts = fronts.map(f => ({ ...f, isReachable: isCompReachable(rComp, f.componentId, state.graph) }));

      const needNewT = !state.currT || (state.currT && state.rPos.row === state.currT.row && state.rPos.col === state.currT.col) || (state.currT && !fronts.some(f => f.row === state.currT.row && f.col === state.currT.col));
      
      if(needNewT) {
        state.currT = selectOptimalFrontier(fronts, state.rPos, state.graph, state.cMaze, state.prevTs, state.kMap);
        state.lastTSwitchIter = state.iter;
        if(!state.currT) { console.log(`No reachable frontier`); break; }
      }
      
      let pRes = findCompPath(state.rPos, {row:state.currT.row, col:state.currT.col}, state.kMap, state.graph, state.cMaze, REG_SIZE);

      if (pRes?.path && pRes.path.length > 0) {
        const fPaths = fronts.map(f => {
          const p = findCompPath(state.rPos, {row:f.row, col:f.col}, state.kMap, state.graph, state.cMaze, REG_SIZE);
          return { frontier:f, path: p?.path||null, cost: p?.path ? p.path.length : Infinity };
        });
        const abandon = shouldAbandon(state.rPos, state.currT, fronts, pRes, state.graph, state.cMaze, {prev_targets:state.prevTs}, fPaths);
        if(abandon) {
          state.currT = abandon.target;
          state.lastTSwitchIter = state.iter;
          pRes = abandon.path ? {path:abandon.path, actualEnd:abandon.target} : findCompPath(state.rPos, state.currT, state.kMap, state.graph, state.cMaze, REG_SIZE);
        }
      }
      
      if (!pRes?.path || pRes.path.length === 0) { console.log("Pathfinding failed, continuing"); continue; }

      const tIdx = Math.min(Math.floor(stepSize) + 1, pRes.path.length - 1);
      if(pRes.path.length === 1){
        if(scan360 === 'true') {
          const scanRes = perform360Scan(state.rPos, sRange, fMaze, state.kMap, state.graph, state.cMaze, REG_SIZE);
          state.kMap=scanRes.kMap; state.graph=scanRes.graph; state.cMaze=scanRes.cMaze;
        }
        state.prevTs.push(state.currT);
        if(state.prevTs.length > 5) state.prevTs.shift();
        state.currT = null;
        continue;
      }
      if(tIdx > 0){
        const newPos = {row:pRes.path[tIdx].row, col:pRes.path[tIdx].col};
        const dr=newPos.row-state.rPos.row, dc=newPos.col-state.rPos.col;
        let tDir=state.rDir;
        if(dr!==0&&dc!==0) tDir = dr<0 ? (dc>0?DIR.NE:DIR.NW) : (dc>0?DIR.SE:DIR.SW);
        else if(dr!==0) tDir = dr<0?DIR.N:DIR.S; else if(dc!==0) tDir = dc>0?DIR.E:DIR.W;

        state.rPos = newPos;
        if(state.rDir !== tDir) {
          const rotRes = rotateAndSense(state.rDir,tDir,state.rPos,sRange,fMaze,state.kMap,state.graph,state.cMaze,REG_SIZE);
          state.rDir=rotRes.finalDir; state.kMap=rotRes.kMap; state.graph=rotRes.graph; state.cMaze=rotRes.cMaze;
        }
        state.expPos.push({...state.rPos});
      }
      
      if(onProg) {
        onProg({type:'exp_prog', rPos:state.rPos, rDir:state.rDir, kMap:state.kMap, graph:state.graph, cMaze:state.cMaze, fronts, currT:state.currT, expPos:[...state.expPos], coverage, iter:state.iter, currPath:pRes.path?[...pRes.path]:[], actualEnd:pRes.actualEnd });
        await new Promise(r=>setTimeout(r,delay));
      }
    }
    const eTime = performance.now();
    const finalCov = calcCoverage(state.kMap, fMaze);
    return mkResult({ success:true, expPos:state.expPos, kMap:state.kMap, graph:state.graph, cMaze:state.cMaze, finalCov, rPos:state.rPos, rDir:state.rDir },
      { executionTime:eTime-sTime, iterations:state.iter, posExplored:state.expPos.length, coverage:finalCov, compsFound:Object.keys(state.graph).length, fStrat, useWFD });
  }
});
const algos = { exp: {'comp-exp': compExpAlgo}, path: {'comp-haa': compHAAStarAlgo} };
class CLIDemo {
  constructor() {
    this.state = { maze:[], cMaze:[], graph:{}, start:null, mazeAlgo:'frontier' };
    this.expState = { exploring:false, rPos:null, rDir:0, kMap:null, fronts:[], expPos:[], coverage:0, iter:0, complete:false, currPath:[] };
    this.viewport = new ASCIIViewport({ width:CLI_VP_W, height:CLI_VP_H, buffer:CLI_VP_B });
    if(process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', k => { if (k==='\u0003') process.exit(); });
    }
  }
  async genMaze() {
    const maze = Array(DEF_MAZE_SIZE).fill(null).map(()=>Array(DEF_MAZE_SIZE).fill(1));
    const uf=new UF(DEF_MAZE_SIZE*DEF_MAZE_SIZE), walls=[];
    for(let r=0;r<DEF_MAZE_SIZE;r+=2) for(let c=0;c<DEF_MAZE_SIZE;c+=2){
      maze[r][c]=0;
      if(c+1<DEF_MAZE_SIZE-1) walls.push({x:c+1,y:r,c1:{x:c,y:r},c2:{x:c+2,y:r}});
      if(r+1<DEF_MAZE_SIZE-1) walls.push({x:c,y:r+1,c1:{x:c,y:r},c2:{x:c,y:r+2}});
    }
    for(let i=walls.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[walls[i],walls[j]]=[walls[j],walls[i]];}
    for(const w of walls) if(w.c1&&w.c2&&uf.union(w.c1.y*DEF_MAZE_SIZE+w.c1.x,w.c2.y*DEF_MAZE_SIZE+w.c2.x)) maze[w.y][w.x]=0;
    const walkable=[];
    for(let r=0;r<DEF_MAZE_SIZE;r++)for(let c=0;c<DEF_MAZE_SIZE;c++)if(maze[r][c]===0)walkable.push({row:r,col:c});
    this.state.start=walkable[Math.floor(Math.random()*walkable.length)];
    const cMaze=Array(DEF_MAZE_SIZE).fill(null).map(()=>Array(DEF_MAZE_SIZE).fill(-1));
    for(let rR=0;rR<DEF_MAZE_SIZE/DEF_REG_SIZE;rR++)for(let rC=0;rC<DEF_MAZE_SIZE/DEF_REG_SIZE;rC++){
      const comps=findComps(maze,rR*DEF_REG_SIZE,rC*DEF_REG_SIZE,DEF_REG_SIZE);
      comps.forEach((comp,idx)=>comp.forEach(cell=>cMaze[cell.row][cell.col]=idx));
    }
    this.state.maze=maze; this.state.cMaze=cMaze;
    this.state.graph=buildComponentGraph(maze,cMaze,DEF_MAZE_SIZE,DEF_REG_SIZE);
  }
  async startExp() {
    this.expState.exploring = true; this.expState.complete = false;
    await algos.exp['comp-exp'].execute({maze:this.state.maze, start:this.state.start, SIZE:DEF_MAZE_SIZE},
      { sRange:15, stepSize:1.0, maxIter:500000, expThresh:95, useWFD:'true', fStrat:'nearest', delay:100 },
      (p) => {
        if(p.type==='exp_prog') {
          this.expState = {...this.expState, rPos:p.rPos, rDir:p.rDir, kMap:p.kMap, fronts:p.fronts, expPos:p.expPos, coverage:p.coverage, iter:p.iter, currPath:p.currPath||[]};
          this.state.cMaze=p.cMaze; this.state.graph=p.graph;
          this.print();
          return new Promise(r=>setTimeout(r,200));
        }
      });
    this.expState.exploring = false; this.expState.complete = true;
  }
  getChar(r,c,checks) {
    if(checks.isRobot(r,c))return '@'; if(checks.isPath(r,c))return'*'; if(checks.isFrontier(r,c))return'?';
    if(checks.isExplored(r,c))return' '; if(checks.isUnknown(r,c))return'█';
    return this.state.maze[r]?.[c]===1?'█':'░';
  }
  print(clear=true) {
    if(!this.state.maze.length) { console.log("Loading..."); return; }
    if(clear) process.stdout.write('\x1B[2J\x1B[0f'); else process.stdout.write('\x1B[0f');
    const {rPos,fronts,kMap,currPath}=this.expState, mSize=this.state.maze.length;
    this.viewport.updateCamera(rPos||this.state.start||{r:0,c:0}, mSize);
    const bounds = this.viewport.getVisibleBounds(mSize);
    const fSet=new Set(fronts.map(f=>`${f.row},${f.col}`)), pSet=new Set(currPath.map(p=>`${p.row},${p.col}`));
    const checks={isRobot:(r,c)=>rPos&&rPos.row===r&&rPos.col===c, isFrontier:(r,c)=>fSet.has(`${r},${c}`),
      isExplored:(r,c)=>kMap?.[r]?.[c]===C.WALKABLE, isUnknown:(r,c)=>!kMap?.[r]||kMap[r][c]===C.UNKNOWN, isPath:(r,c)=>pSet.has(`${r},${c}`) };
    let output = '';
    for (let r = bounds.startR; r < bounds.endR; r++) {
      let line = '';
      for (let c = bounds.startC; c < bounds.endC; c++) line += (r>=0&&r<mSize&&c>=0&&c<mSize) ? this.getChar(r,c,checks) : ' ';
      output += line + '\n';
    }
    console.log(`CLI Demo | Coverage: ${this.expState.coverage?.toFixed(1)||'0.0'}% | Iter: ${this.expState.iter||0}`);
    console.log(`Robot: (${rPos?.row||'N/A'}, ${rPos?.col||'N/A'}) | Legend: @=Robot *=Path ?=Frontier  =Explored █=Wall/Unk`);
    console.log('='.repeat(CLI_VP_W+1));
    console.log(output);
  }
}
// Setup signal handling early and ensure it's responsive
process.on('SIGINT', () => { 
  console.log('\n👋 Goodbye!'); 
  process.exit(0); 
});

// Make process responsive to input
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (key) => {
    if (key === '\u0003') { // Ctrl+C
      process.exit(0);
    }
  });
}

async function runDemo() {
  console.log('🚀 Starting CLI Demo...');
  try {
    const demo = new CLIDemo();
    console.log('📦 Generating maze...'); await demo.genMaze();
    if (demo.state.maze.length === 0) { console.log('❌ Failed to generate maze'); return; }
    console.log(`✅ Maze generated! Start: (${demo.state.start?.row}, ${demo.state.start?.col})`);
    demo.print();
    console.log('\n🤖 Starting exploration...'); await demo.startExp();
    console.log('\n🎉 Exploration completed!'); demo.print();
    console.log('\n✅ Demo completed successfully!');
  } catch(e) { console.error('❌ Demo failed:',e.message,e.stack); process.exit(1); }
}

runDemo();