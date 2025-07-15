#!/usr/bin/env node

// CLI Exploration Runner - A simple demonstration of the CLIExplorationDemo class
import { CLIExplorationDemo } from './src/demos/exploration-demo/CLIExplorationDemo.js';

async function runExplorationDemo() {
  console.log('🚀 Starting CLI Exploration Demo...\n');
  
  try {
    // Create the demo instance
    const demo = new CLIExplorationDemo();
    
    // Generate a maze
    console.log('📦 Generating maze...');
    await demo.generateNewMaze();
    
    if (demo.state.maze.length === 0) {
      console.log('❌ Failed to generate maze');
      return;
    }
    
    console.log('✅ Maze generated successfully!');
    console.log(`   Size: ${demo.state.maze.length}x${demo.state.maze.length}`);
    console.log(`   Start: (${demo.state.start?.row}, ${demo.state.start?.col})`);
    console.log(`   Components: ${demo.state.totalComponents}`);
    
    // Show initial maze state
    console.log('\n🗺️  Initial maze state:');
    demo.printMaze();
    
    // Wait for user input
    console.log('\nPress Enter to start exploration...');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', async (key) => {
      // Exit on Ctrl+C
      if (key[0] === 3) {
        console.log('\n👋 Goodbye!');
        process.exit(0);
      }
      
      // Start exploration on Enter
      if (key[0] === 13) {
        console.log('\n🤖 Starting exploration...');
        
        // Start the exploration algorithm
        await demo.startExploration();
        
        console.log('\n🎉 Exploration completed!');
        console.log(`   Final coverage: ${demo.explorationState.coverage?.toFixed(1) || '0.0'}%`);
        console.log(`   Iterations: ${demo.explorationState.iteration || 0}`);
        
        // Show final maze state
        console.log('\n🗺️  Final maze state:');
        demo.printMaze();
        
        console.log('\n✅ Demo completed successfully!');
        process.exit(0);
      }
    });
    
  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Goodbye!');
  process.exit(0);
});

runExplorationDemo();