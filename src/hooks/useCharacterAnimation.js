import { useState, useEffect } from 'react';

export const useCharacterAnimation = (detailedPath, start, onAnimationComplete, speed = 200) => {
  const [characterPosition, setCharacterPosition] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (detailedPath.length > 0 && !isAnimating && start) {
      setCharacterPosition(start);
      setIsAnimating(true);
      setCurrentStep(0);
      
      const animate = () => {
        setCurrentStep(prev => {
          const next = prev + 1;
          if (next < detailedPath.length) {
            setCharacterPosition(detailedPath[next]);
            setTimeout(animate, speed);
          } else {
            setIsAnimating(false);
            setTimeout(onAnimationComplete, 1000);
          }
          return next;
        });
      };
      
      setTimeout(animate, speed);
    }
  }, [detailedPath, start, speed, isAnimating, onAnimationComplete]);

  return { characterPosition, isAnimating };
};