import { useState, useEffect, useRef } from 'react';

export const useSmoothLocation = (targetLat: number, targetLng: number, targetHeading?: number, duration: number = 2000) => {
  const [currentCoord, setCurrentCoord] = useState({ latitude: targetLat, longitude: targetLng, heading: targetHeading || 0 });
  
  const animationRef = useRef<number | null>(null);
  const startCoordRef = useRef({ latitude: targetLat, longitude: targetLng, heading: targetHeading || 0 });
  const targetCoordRef = useRef({ latitude: targetLat, longitude: targetLng, heading: targetHeading || 0 });
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (
      targetCoordRef.current.latitude === targetLat && 
      targetCoordRef.current.longitude === targetLng &&
      targetCoordRef.current.heading === targetHeading
    ) {
      return;
    }

    startCoordRef.current = { ...currentCoord };
    targetCoordRef.current = { latitude: targetLat, longitude: targetLng, heading: targetHeading || 0 };
    
    let currentHeading = startCoordRef.current.heading;
    let newHeading = targetCoordRef.current.heading;
    
    let diff = newHeading - currentHeading;
    while (diff < -180) diff += 360;
    while (diff > 180) diff -= 360;
    
    targetCoordRef.current.heading = currentHeading + diff;
    startTimeRef.current = performance.now();

    const animate = (time: number) => {
      const elapsed = time - startTimeRef.current;
      let progress = Math.min(elapsed / duration, 1);
      
      const easeProgress = progress * (2 - progress);

      const newLat = startCoordRef.current.latitude + (targetCoordRef.current.latitude - startCoordRef.current.latitude) * easeProgress;
      const newLng = startCoordRef.current.longitude + (targetCoordRef.current.longitude - startCoordRef.current.longitude) * easeProgress;
      const newHeadingVal = startCoordRef.current.heading + (targetCoordRef.current.heading - startCoordRef.current.heading) * easeProgress;

      setCurrentCoord({
        latitude: newLat,
        longitude: newLng,
        heading: newHeadingVal
      });

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setCurrentCoord(prev => ({
           ...prev,
           heading: prev.heading % 360
        }));
      }
    };

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [targetLat, targetLng, targetHeading, duration]);

  return currentCoord;
};
