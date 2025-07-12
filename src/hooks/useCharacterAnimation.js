import { useState, useEffect, useRef } from 'react';

export const useCharacterAnimation = (detailedPath, start, onAnimationComplete, speed = 200) => {
  const [characterPosition, setCharacterPosition] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const callbackRef = useRef(onAnimationComplete);
  const timeoutsRef = useRef([]);
  
  // Update callback ref without causing re-renders
  callbackRef.current = onAnimationComplete;
  
  // Cleanup function
  const cleanup = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  };

  useEffect(() => {
    cleanup(); // Clear any pending timeouts
    
    if (detailedPath.length === 0) {
      setCharacterPosition(null);
      setIsAnimating(false);
    } else if (detailedPath.length > 0 && !isAnimating && start) {
      setCharacterPosition(start);
      setIsAnimating(true);
      setCurrentStep(0);
      
      const animate = () => {
        setCurrentStep(prev => {
          const next = prev + 1;
          if (next < detailedPath.length) {
            setCharacterPosition(detailedPath[next]);
            const timeout = setTimeout(animate, speed);
            timeoutsRef.current.push(timeout);
          } else {
            setIsAnimating(false);
            const timeout = setTimeout(() => callbackRef.current(), 1000);
            timeoutsRef.current.push(timeout);
          }
          return next;
        });
      };
      
      const timeout = setTimeout(animate, speed);
      timeoutsRef.current.push(timeout);
    }
    
    return cleanup; // Cleanup on unmount
  }, [detailedPath, start, speed]); // Removed isAnimating and onAnimationComplete

  return { characterPosition, isAnimating };
};