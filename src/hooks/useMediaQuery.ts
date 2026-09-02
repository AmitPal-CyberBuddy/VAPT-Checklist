import { useEffect, useState } from 'react';

/**
 * Layout decisions that CSS cannot express — the workspace swaps between a
 * two-pane view and a list/detail flow, which changes what is rendered, not
 * just how it looks.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(query).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);

  return matches;
}

/** The breakpoint at which the workspace can show both panes side by side. */
export const useIsWide = () => useMediaQuery('(min-width: 1024px)');
