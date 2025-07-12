import { useReducer, useCallback } from 'react';

// Animation state machine phases
export const ANIMATION_PHASES = {
  IDLE: 'IDLE',
  GENERATING: 'GENERATING', 
  PATHFINDING: 'PATHFINDING',
  ANIMATING: 'ANIMATING',
  COUNTDOWN: 'COUNTDOWN'
};

// Action types for atomic state updates
export const MAZE_ACTIONS = {
  // Maze generation
  START_GENERATION: 'START_GENERATION',
  SET_MAZE_DATA: 'SET_MAZE_DATA',
  
  // Pathfinding
  START_PATHFINDING: 'START_PATHFINDING',
  SET_PATH_DATA: 'SET_PATH_DATA',
  CLEAR_PATHS: 'CLEAR_PATHS',
  
  // Animation
  START_ANIMATION: 'START_ANIMATION',
  UPDATE_CHARACTER_POSITION: 'UPDATE_CHARACTER_POSITION',
  ANIMATION_COMPLETE: 'ANIMATION_COMPLETE',
  
  // Countdown
  START_COUNTDOWN: 'START_COUNTDOWN',
  UPDATE_COUNTDOWN: 'UPDATE_COUNTDOWN',
  COUNTDOWN_COMPLETE: 'COUNTDOWN_COMPLETE',
  
  // Settings
  UPDATE_ANIMATION_SPEED: 'UPDATE_ANIMATION_SPEED',
  TOGGLE_ABSTRACT_PATH: 'TOGGLE_ABSTRACT_PATH',
  
  // Reset
  RESET_TO_IDLE: 'RESET_TO_IDLE'
};

// Initial state structure
const initialState = {
  // Animation phase
  phase: ANIMATION_PHASES.IDLE,
  
  // Maze data
  maze: [],
  coloredMaze: [],
  componentGraph: null,
  totalComponents: 0,
  
  // Path data
  start: null,
  end: null,
  abstractPath: [],
  detailedPath: [],
  
  // Animation state
  characterPosition: null,
  currentStep: 0,
  
  // Countdown state
  countdown: 0,
  
  // Settings
  animationSpeed: 50,
  showAbstractPath: true,
  
  // Error handling
  error: null
};

// Reducer for atomic state updates
const mazeReducer = (state, action) => {
  switch (action.type) {
    case MAZE_ACTIONS.START_GENERATION:
      return {
        ...state,
        phase: ANIMATION_PHASES.GENERATING,
        error: null,
        // Clear previous data
        maze: [],
        coloredMaze: [],
        componentGraph: null,
        totalComponents: 0,
        start: null,
        end: null,
        abstractPath: [],
        detailedPath: [],
        characterPosition: null,
        currentStep: 0,
        countdown: 0
      };

    case MAZE_ACTIONS.SET_MAZE_DATA:
      return {
        ...state,
        phase: ANIMATION_PHASES.PATHFINDING,
        maze: action.payload.maze,
        coloredMaze: action.payload.coloredMaze,
        componentGraph: action.payload.componentGraph,
        totalComponents: action.payload.totalComponents,
        start: action.payload.start,
        end: action.payload.end
      };

    case MAZE_ACTIONS.SET_PATH_DATA:
      return {
        ...state,
        phase: ANIMATION_PHASES.ANIMATING,
        abstractPath: action.payload.abstractPath,
        detailedPath: action.payload.detailedPath,
        characterPosition: action.payload.start, // Set initial character position
        currentStep: 0
      };

    case MAZE_ACTIONS.CLEAR_PATHS:
      return {
        ...state,
        phase: ANIMATION_PHASES.IDLE,
        abstractPath: [],
        detailedPath: [],
        characterPosition: null,
        currentStep: 0
      };

    case MAZE_ACTIONS.UPDATE_CHARACTER_POSITION:
      return {
        ...state,
        characterPosition: action.payload.position,
        currentStep: action.payload.step
      };

    case MAZE_ACTIONS.ANIMATION_COMPLETE:
      return {
        ...state,
        phase: ANIMATION_PHASES.COUNTDOWN,
        countdown: 3
      };

    case MAZE_ACTIONS.START_COUNTDOWN:
      return {
        ...state,
        phase: ANIMATION_PHASES.COUNTDOWN,
        countdown: action.payload.countdown
      };

    case MAZE_ACTIONS.UPDATE_COUNTDOWN:
      return {
        ...state,
        countdown: action.payload.countdown
      };

    case MAZE_ACTIONS.COUNTDOWN_COMPLETE:
      return {
        ...state,
        phase: ANIMATION_PHASES.PATHFINDING,
        countdown: 0
      };

    case MAZE_ACTIONS.UPDATE_ANIMATION_SPEED:
      return {
        ...state,
        animationSpeed: action.payload.speed
      };

    case MAZE_ACTIONS.TOGGLE_ABSTRACT_PATH:
      return {
        ...state,
        showAbstractPath: !state.showAbstractPath
      };

    case MAZE_ACTIONS.RESET_TO_IDLE:
      return {
        ...state,
        phase: ANIMATION_PHASES.IDLE,
        characterPosition: null,
        currentStep: 0,
        countdown: 0
      };

    default:
      console.warn('Unknown action type:', action.type);
      return state;
  }
};

// Custom hook for maze state management
export const useMazeState = () => {
  const [state, dispatch] = useReducer(mazeReducer, initialState);

  // Action creators for type safety and convenience
  const actions = {
    startGeneration: useCallback(() => {
      dispatch({ type: MAZE_ACTIONS.START_GENERATION });
    }, []),

    setMazeData: useCallback((mazeData) => {
      dispatch({ 
        type: MAZE_ACTIONS.SET_MAZE_DATA,
        payload: mazeData
      });
    }, []),

    setPathData: useCallback((pathData) => {
      dispatch({
        type: MAZE_ACTIONS.SET_PATH_DATA,
        payload: pathData
      });
    }, []),

    clearPaths: useCallback(() => {
      dispatch({ type: MAZE_ACTIONS.CLEAR_PATHS });
    }, []),

    updateCharacterPosition: useCallback((position, step) => {
      dispatch({
        type: MAZE_ACTIONS.UPDATE_CHARACTER_POSITION,
        payload: { position, step }
      });
    }, []),

    animationComplete: useCallback(() => {
      dispatch({ type: MAZE_ACTIONS.ANIMATION_COMPLETE });
    }, []),

    updateCountdown: useCallback((countdown) => {
      dispatch({
        type: MAZE_ACTIONS.UPDATE_COUNTDOWN,
        payload: { countdown }
      });
    }, []),

    countdownComplete: useCallback(() => {
      dispatch({ type: MAZE_ACTIONS.COUNTDOWN_COMPLETE });
    }, []),

    updateAnimationSpeed: useCallback((speed) => {
      dispatch({
        type: MAZE_ACTIONS.UPDATE_ANIMATION_SPEED,
        payload: { speed }
      });
    }, []),

    toggleAbstractPath: useCallback(() => {
      dispatch({ type: MAZE_ACTIONS.TOGGLE_ABSTRACT_PATH });
    }, []),

    resetToIdle: useCallback(() => {
      dispatch({ type: MAZE_ACTIONS.RESET_TO_IDLE });
    }, [])
  };

  // Computed values for convenience
  const computed = {
    isGenerating: state.phase === ANIMATION_PHASES.GENERATING,
    isPathfinding: state.phase === ANIMATION_PHASES.PATHFINDING,
    isAnimating: state.phase === ANIMATION_PHASES.ANIMATING,
    isCountingDown: state.phase === ANIMATION_PHASES.COUNTDOWN,
    isIdle: state.phase === ANIMATION_PHASES.IDLE,
    canGenerateNewMaze: state.phase === ANIMATION_PHASES.IDLE,
    hasPath: state.detailedPath.length > 0,
    hasAbstractPath: state.abstractPath.length > 0
  };

  return {
    state,
    actions,
    computed
  };
};