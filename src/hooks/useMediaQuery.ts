import { useState, useEffect } from 'react';

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

/**
 * Hook to detect media queries and responsive breakpoints
 * @param query - CSS media query string or breakpoint name
 * @returns boolean indicating if the media query matches
 */
export function useMediaQuery(query: Breakpoint): boolean {
  const getMatches = (query: string): boolean => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  };

  const mediaQuery = `(min-width: ${BREAKPOINTS[query]}px)`;

  const [matches, setMatches] = useState<boolean>(() => getMatches(mediaQuery));

  useEffect(() => {
    const matchMedia = window.matchMedia(mediaQuery);

    function handleChange() {
      setMatches(matchMedia.matches);
    }

    // Listen for changes
    if (matchMedia.addListener) {
      matchMedia.addListener(handleChange);
    } else {
      matchMedia.addEventListener('change', handleChange);
    }

    // Cleanup
    return () => {
      if (matchMedia.removeListener) {
        matchMedia.removeListener(handleChange);
      } else {
        matchMedia.removeEventListener('change', handleChange);
      }
    };
  }, [mediaQuery]);

  return matches;
}

/**
 * Hook to get current breakpoint information
 */
export function useBreakpoint() {
  const isSm = useMediaQuery('sm');
  const isMd = useMediaQuery('md');
  const isLg = useMediaQuery('lg');
  const isXl = useMediaQuery('xl');
  const is2xl = useMediaQuery('2xl');

  return {
    isSm,
    isMd,
    isLg,
    isXl,
    is2xl,
    // Helpers for common use cases
    isMobile: !isMd, // < md (768px)
    isTablet: isMd && !isLg, // md to lg (768px - 1024px)
    isDesktop: isLg, // >= lg (1024px+)
    isWide: isXl, // >= xl (1280px+)
  };
}