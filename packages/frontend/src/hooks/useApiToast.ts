/**
 * useApiToast — Hook that wraps API calls with automatic toast notifications.
 *
 * Usage:
 *   const { callApi } = useApiToast();
 *   const result = await callApi(
 *     () => createProject({ name: 'Test' }),
 *     { successMessage: 'Proyecto creado', errorMessage: 'Error al crear proyecto' }
 *   );
 */
import { useCallback } from 'react';
import { useToast } from '../components/ToastProvider';
import { getErrorMessage, getErrorDetails } from '../api/client';

interface ApiToastOptions {
  /** Message shown on success (omit to skip success toast) */
  successMessage?: string;
  /** Message shown on error (defaults to extracted API error message) */
  errorMessage?: string;
  /** If true, adds a retry button to the error toast */
  retryable?: boolean;
}

export function useApiToast() {
  const { addToast } = useToast();

  const callApi = useCallback(
    async <T>(
      fn: () => Promise<T>,
      options?: ApiToastOptions,
    ): Promise<T | null> => {
      try {
        const result = await fn();
        if (options?.successMessage) {
          addToast(options.successMessage, 'success');
        }
        return result;
      } catch (error) {
        const message = options?.errorMessage || getErrorMessage(error);
        const details = getErrorDetails(error);

        addToast(message, 'error', {
          details,
          onRetry: options?.retryable
            ? () => callApi(fn, options)
            : undefined,
        });

        return null;
      }
    },
    [addToast],
  );

  return { callApi, addToast };
}
