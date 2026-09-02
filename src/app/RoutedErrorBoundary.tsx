import { useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

/**
 * Wraps the routed screens. Navigating away clears the error, so one broken
 * screen never strands the tester — the header and navigation stay usable.
 */
export function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <ErrorBoundary area="screen" resetKey={location.pathname + location.search}>
      {children}
    </ErrorBoundary>
  );
}
