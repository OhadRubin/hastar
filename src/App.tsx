import React, { useState } from 'react';
import './App.css';
import PathfindingDemo from './demos/pathfinding-demo';
import { ExplorationDemo } from './demos/exploration-demo';

function App() {
  const [demoMode, setDemoMode] = useState('exploration');

  return (
    <div>
      {/* Demo Mode Switcher */}
      <div className="fixed top-4 left-4 z-50 bg-white rounded-lg shadow-lg p-4">
        <h3 className="text-lg font-semibold mb-2">Demo Mode</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="pathfinding"
              checked={demoMode === 'pathfinding'}
              onChange={(e) => setDemoMode(e.target.value)}
              className="text-blue-600"
            />
            <span>HAA* Pathfinding</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="exploration"
              checked={demoMode === 'exploration'}
              onChange={(e) => setDemoMode(e.target.value)}
              className="text-blue-600"
            />
            <span>Component-Based Exploration</span>
          </label>
        </div>
      </div>

      {/* Render the selected demo */}
      {demoMode === 'pathfinding' ? <PathfindingDemo /> : <ExplorationDemo />}
    </div>
  );
}

export default App;
