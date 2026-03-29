import { useRef, useCallback } from 'react';

export function useSwipeDismiss(onDismiss: () => void, threshold = 150) {
  const startY = useRef(0);
  const currentY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const el = containerRef.current;
    // Only activate swipe-to-dismiss when scrolled near the top
    if (el && el.scrollTop > 10) return;
    startY.current = e.touches[0].clientY;
    currentY.current = startY.current;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (startY.current === 0) return;
    currentY.current = e.touches[0].clientY;
    const delta = currentY.current - startY.current;
    if (delta > 0 && containerRef.current) {
      containerRef.current.style.transform = `translateY(${Math.min(delta, 300)}px)`;
      containerRef.current.style.opacity = `${1 - Math.min(delta / 400, 0.5)}`;
      containerRef.current.style.transition = 'none';
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    const delta = currentY.current - startY.current;
    if (containerRef.current) {
      containerRef.current.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    }
    if (delta > threshold) {
      if (containerRef.current) {
        containerRef.current.style.transform = 'translateY(100%)';
        containerRef.current.style.opacity = '0';
      }
      setTimeout(onDismiss, 200);
    } else if (containerRef.current) {
      containerRef.current.style.transform = '';
      containerRef.current.style.opacity = '';
    }
    startY.current = 0;
  }, [onDismiss, threshold]);

  return { containerRef, onTouchStart, onTouchMove, onTouchEnd };
}
