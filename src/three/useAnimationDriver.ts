import { useRef, useCallback } from 'react';
import { MouthAnimator } from '@/lib/avatarControls';

export function useAnimationDriver() {
  const animatorRef = useRef(new MouthAnimator());
  const intervalRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const startTalking = useCallback((onUpdate: (mouthOpen: number) => void) => {
    const animator = animatorRef.current;
    
    // Random mouth movement pattern
    const updatePattern = () => {
      const randomOpen = Math.random() * 0.5 + 0.3; // 0.3-0.8
      animator.setTarget(randomOpen);
      
      setTimeout(() => {
        animator.setTarget(0.1);
      }, Math.random() * 100 + 50);
    };

    // Start random pattern
    intervalRef.current = window.setInterval(updatePattern, 150 + Math.random() * 100);
    
    // Animation loop
    const animate = () => {
      const value = animator.update();
      onUpdate(value);
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animate();
  }, []);

  const stopTalking = useCallback((onUpdate: (mouthOpen: number) => void) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    const animator = animatorRef.current;
    animator.setTarget(0);
    
    // Smoothly close mouth
    const finish = () => {
      const value = animator.update();
      onUpdate(value);
      
      if (value > 0.01) {
        animationFrameRef.current = requestAnimationFrame(finish);
      } else {
        animator.reset();
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      }
    };
    finish();
  }, []);

  const cleanup = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  }, []);

  return { startTalking, stopTalking, cleanup };
}
