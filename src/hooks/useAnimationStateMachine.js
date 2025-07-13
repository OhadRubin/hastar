import { useEffect, useRef, useCallback } from 'react';

/**
 * Animation state machine hook using requestAnimationFrame
 * Fixes stale closure issues and provides smooth 60fps animations
 * Eliminates race conditions through proper state machine design
 */
export const useAnimationStateMachine = (state, actions) => {
  const animationRef = useRef(null);
  const lastFrameTimeRef = useRef(0);
  const countdownIntervalRef = useRef(null);
  
  const { 
    phase, 
    detailedPath, 
    currentStep, 
    animationSpeed, 
    countdown 
  } = state;
  
  const { 
    updateCharacterPosition, 
    markCellVisited,
    animationComplete, 
    updateCountdown, 
    countdownComplete 
  } = actions;

  // Cancel any ongoing animations
  const cancelAnimation = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  // Smooth animation using requestAnimationFrame
  const animate = useCallback((currentTime) => {
    // Check if enough time has passed based on animation speed
    if (currentTime - lastFrameTimeRef.current >= animationSpeed) {
      const nextStep = currentStep + 1;
      
      if (nextStep < detailedPath.length) {
        // Move to next position
        const nextPosition = detailedPath[nextStep];
        updateCharacterPosition(nextPosition, nextStep);
        
        // Mark the cell as visited
        markCellVisited(nextPosition.row, nextPosition.col);
        
        lastFrameTimeRef.current = currentTime;
        
        // Schedule next frame
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete
        animationRef.current = null;
        
        // Small delay before triggering completion
        setTimeout(() => {
          animationComplete();
        }, 1000);
      }
    } else {
      // Not enough time passed, schedule next frame
      animationRef.current = requestAnimationFrame(animate);
    }
  }, [currentStep, detailedPath, animationSpeed, updateCharacterPosition, markCellVisited, animationComplete]);

  // Start countdown with proper cleanup
  const startCountdown = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    
    countdownIntervalRef.current = setInterval(() => {
      const newCountdown = countdown - 1;
      if (newCountdown <= 0) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
        countdownComplete();
      } else {
        updateCountdown(newCountdown);
      }
    }, 1000);
  }, [countdown, updateCountdown, countdownComplete]);

  // Handle phase transitions
  useEffect(() => {
    switch (phase) {
      case 'ANIMATING':
        if (detailedPath.length > 0 && currentStep < detailedPath.length) {
          // Mark starting position as visited
          if (detailedPath[0]) {
            markCellVisited(detailedPath[0].row, detailedPath[0].col);
          }
          
          // Start animation
          cancelAnimation(); // Cancel any existing animation
          lastFrameTimeRef.current = performance.now();
          animationRef.current = requestAnimationFrame(animate);
        }
        break;
        
      case 'COUNTDOWN':
        if (countdown > 0) {
          startCountdown();
        }
        break;
        
      case 'IDLE':
      case 'GENERATING':
      case 'PATHFINDING':
        // Cancel any ongoing animations
        cancelAnimation();
        break;
        
      default:
        break;
    }
    
    // Cleanup on phase change
    return () => {
      if (phase === 'ANIMATING') {
        cancelAnimation();
      }
    };
  }, [phase, detailedPath.length, detailedPath, currentStep, countdown, animate, startCountdown, cancelAnimation, markCellVisited]);

  // Handle animation speed changes during animation
  useEffect(() => {
    if (phase === 'ANIMATING' && animationRef.current) {
      // Speed changed during animation - restart with new speed
      cancelAnimation();
      lastFrameTimeRef.current = performance.now();
      animationRef.current = requestAnimationFrame(animate);
    }
  }, [animationSpeed, phase, animate, cancelAnimation]);

  // Cleanup on unmount
  useEffect(() => {
    return cancelAnimation;
  }, [cancelAnimation]);

  // Return animation controls and status
  return {
    isAnimating: phase === 'ANIMATING',
    isCountingDown: phase === 'COUNTDOWN',
    currentAnimationStep: currentStep,
    
    // Manual controls (for edge cases)
    cancelAnimation,
    
    // Animation state for debugging
    animationState: {
      phase,
      currentStep,
      totalSteps: detailedPath.length,
      hasActiveAnimation: animationRef.current !== null,
      hasActiveCountdown: countdownIntervalRef.current !== null
    }
  };
};