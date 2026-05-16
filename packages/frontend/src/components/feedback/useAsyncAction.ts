import { useState, useEffect, useRef, useCallback } from 'react';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  errorDetails?: string;
}

export interface UseAsyncActionReturn<T> extends AsyncState<T> {
  execute: (...args: any[]) => Promise<T | null>;
  reset: () => void;
  retry: () => Promise<T | null>;
}

function extractErrorDetails(error: unknown): { message: string; details?: string } {
  if (error instanceof Error) {
    // Try to extract structured error from API responses
    const err = error as any;
    if (err.response?.data?.error) {
      return {
        message: err.response.data.error,
        details: err.response.data.details ?? err.response.data.message ?? undefined,
      };
    }
    return {
      message: error.message,
      details: err.details ?? err.stack ?? undefined,
    };
  }
  if (typeof error === 'string') {
    return { message: error };
  }
  return { message: 'An unknown error occurred' };
}

function useAsyncAction<T>(
  fn: (...args: any[]) => Promise<T>,
  options?: {
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
    immediate?: boolean;
    immediateArgs?: any[];
  }
): UseAsyncActionReturn<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: options?.immediate ?? false,
    error: null,
  });

  const latestArgsRef = useRef<any[]>([]);
  const mountedRef = useRef(true);
  const fnRef = useRef(fn);
  const optionsRef = useRef(options);

  // Keep refs up to date
  fnRef.current = fn;
  optionsRef.current = options;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = useCallback(async (...args: any[]): Promise<T | null> => {
    latestArgsRef.current = args;

    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
      errorDetails: undefined,
    }));

    try {
      const result = await fnRef.current(...args);

      if (!mountedRef.current) return null;

      setState({
        data: result,
        loading: false,
        error: null,
      });

      optionsRef.current?.onSuccess?.(result);
      return result;
    } catch (err: any) {
      if (!mountedRef.current) return null;

      const { message, details } = extractErrorDetails(err);

      setState({
        data: null,
        loading: false,
        error: message,
        errorDetails: details,
      });

      optionsRef.current?.onError?.(err);
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
    });
  }, []);

  const retry = useCallback(async (): Promise<T | null> => {
    return execute(...latestArgsRef.current);
  }, [execute]);

  // Immediate execution on mount
  useEffect(() => {
    const opts = optionsRef.current;
    if (opts?.immediate) {
      execute(...(opts.immediateArgs ?? []));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    errorDetails: state.errorDetails,
    execute,
    reset,
    retry,
  };
}

export default useAsyncAction;
