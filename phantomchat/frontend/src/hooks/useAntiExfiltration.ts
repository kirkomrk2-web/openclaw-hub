/**
 * Anti-exfiltration hook for PhantomChat.
 *
 * Implements friction-based protections against casual data theft:
 *   1. CSS user-select: none on protected content
 *   2. JS clipboard API blocking for protected messages
 *   3. Blur overlay when window loses focus (hides content on tab switch)
 *
 * IMPORTANT: These measures are NOT bulletproof against screenshots or
 * screen recording. They add FRICTION, not absolute protection.
 * A determined attacker with physical access can always photograph the screen.
 */

import { useEffect, useState, useCallback, useRef } from 'react';

export interface AntiExfiltrationState {
  /** Whether the window currently has focus */
  isWindowFocused: boolean;
  /** Whether the blur overlay is active */
  isBlurred: boolean;
  /** Whether clipboard blocking is active */
  clipboardBlocked: boolean;
}

export interface UseAntiExfiltrationReturn {
  state: AntiExfiltrationState;
  /** CSS class to apply to protected content elements */
  protectedContentClass: string;
  /** Ref callback to attach clipboard blocking to an element */
  protectElement: (element: HTMLElement | null) => void;
  /** Manually toggle blur overlay */
  toggleBlur: (enabled: boolean) => void;
}

export function useAntiExfiltration(): UseAntiExfiltrationReturn {
  const [state, setState] = useState<AntiExfiltrationState>({
    isWindowFocused: true,
    isBlurred: false,
    clipboardBlocked: true,
  });

  const protectedElements = useRef<Set<HTMLElement>>(new Set());

  // Window focus/blur handling — show overlay when user switches tab
  useEffect(() => {
    const handleFocus = () => {
      setState((prev) => ({
        ...prev,
        isWindowFocused: true,
        isBlurred: false,
      }));
    };

    const handleBlur = () => {
      setState((prev) => ({
        ...prev,
        isWindowFocused: false,
        isBlurred: true,
      }));
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Global clipboard blocking for protected elements
  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const element =
        container.nodeType === Node.ELEMENT_NODE
          ? (container as HTMLElement)
          : container.parentElement;

      if (!element) return;

      // Check if the selection is inside a protected element
      for (const protectedEl of protectedElements.current) {
        if (protectedEl.contains(element)) {
          e.preventDefault();
          e.clipboardData?.setData('text/plain', '[Protected content]');
          return;
        }
      }
    };

    const handleCut = (e: ClipboardEvent) => {
      // Same logic as copy
      handleCopy(e);
    };

    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);

    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
    };
  }, []);

  // Block drag events on protected content (prevents drag-to-extract)
  useEffect(() => {
    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      for (const protectedEl of protectedElements.current) {
        if (protectedEl.contains(target)) {
          e.preventDefault();
          return;
        }
      }
    };

    document.addEventListener('dragstart', handleDragStart);
    return () => document.removeEventListener('dragstart', handleDragStart);
  }, []);

  const protectElement = useCallback((element: HTMLElement | null) => {
    if (element) {
      protectedElements.current.add(element);
    }
  }, []);

  const toggleBlur = useCallback((enabled: boolean) => {
    setState((prev) => ({ ...prev, isBlurred: enabled }));
  }, []);

  /**
   * CSS class that applies user-select: none and other protections.
   * This is injected as a Tailwind-compatible class string.
   */
  const protectedContentClass = 'select-none pointer-events-auto';

  return {
    state,
    protectedContentClass,
    protectElement,
    toggleBlur,
  };
}
