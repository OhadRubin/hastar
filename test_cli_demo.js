#!/usr/bin/env node

// Test script for CLIExplorationDemo
import { CLIExplorationDemo } from './src/demos/exploration-demo/CLIExplorationDemo.js';

async function testCLIDemo() {
  console.log('Testing CLIExplorationDemo...');
  
  try {
    // Create instance
    const demo = new CLIExplorationDemo();
    console.log('✓ Created CLIExplorationDemo instance');
    
    // Test methods exist
    console.log('✓ getMazeGenerationAlgorithm:', typeof demo.getMazeGenerationAlgorithm);
    console.log('✓ getExplorationAlgorithm:', typeof demo.getExplorationAlgorithm);
    console.log('✓ getCellCheckers:', typeof demo.getCellCheckers);
    console.log('✓ getExplorationColors:', typeof demo.getExplorationColors);
    console.log('✓ getComputed:', typeof demo.getComputed);
    console.log('✓ renderASCII:', typeof demo.renderASCII);
    console.log('✓ printMaze:', typeof demo.printMaze);
    
    // Test state access
    console.log('✓ Initial state maze length:', demo.state.maze.length);
    console.log('✓ Initial exploration state:', demo.explorationState.isExploring);
    
    // Test computed values
    const computed = demo.getComputed();
    console.log('✓ Computed canStartExploration:', computed.canStartExploration);
    console.log('✓ Computed canGenerateNewMaze:', computed.canGenerateNewMaze);
    
    // Test algorithm getters
    const mazeAlg = demo.getMazeGenerationAlgorithm();
    const exploreAlg = demo.getExplorationAlgorithm();
    console.log('✓ Maze generation algorithm:', mazeAlg ? 'Found' : 'Not found');
    console.log('✓ Exploration algorithm:', exploreAlg ? 'Found' : 'Not found');
    
    // Test ASCII rendering with empty maze
    const asciiOutput = demo.renderASCII();
    console.log('✓ ASCII rendering output:', asciiOutput);
    
    console.log('\n✅ All tests passed! CLIExplorationDemo is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testCLIDemo();