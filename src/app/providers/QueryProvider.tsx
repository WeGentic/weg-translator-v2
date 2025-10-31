/**
 * React Query provider for subscription status caching and query management.
 * Wraps the application with QueryClientProvider for react-query hooks.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { type ReactNode } from 'react';

// Create a client instance with default configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Default stale time: 5 minutes for subscription status
      staleTime: 5 * 60 * 1000,
      // Default cache time (gcTime): 10 minutes
      gcTime: 10 * 60 * 1000,
      // Retry configuration: 3 retries with exponential backoff
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Refetch on window focus to ensure fresh data
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});

// Export queryClient for programmatic cache invalidation
export { queryClient };

interface QueryProviderProps {
  children: ReactNode;
}

/**
 * QueryProvider wraps the application with React Query context.
 * Must be placed above any components using react-query hooks.
 *
 * @example
 * ```tsx
 * <QueryProvider>
 *   <AuthProvider>
 *     <App />
 *   </AuthProvider>
 * </QueryProvider>
 * ```
 */
export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* DevTools only in development */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
