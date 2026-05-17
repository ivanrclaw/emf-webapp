/**
 * @emf-webapp/frontend — ErrorBoundary
 *
 * Captura errores de renderizado de React (incluyendo Error #310)
 * y muestra un panel profesional de recuperación con acciones contextuales.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ChevronDown, ChevronRight, Copy, Trash2 } from './icons';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  tabId?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  stackExpanded: boolean;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      stackExpanded: false,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught:', error.message, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, stackExpanded: false, copied: false });
  };

  handleReloadTab = (): void => {
    const { tabId } = this.props;
    this.setState({ hasError: false, error: null, stackExpanded: false, copied: false });
    if (tabId) {
      window.dispatchEvent(new CustomEvent('reload-tab', { detail: { tabId } }));
    }
  };

  handleReloadSession = (): void => {
    window.location.reload();
  };

  handleClearStorage = (): void => {
    // Clear all web storage
    try { localStorage.clear(); } catch {}
    try { sessionStorage.clear(); } catch {}

    // Clear all cookies
    document.cookie.split(';').forEach((c) => {
      document.cookie = c
        .replace(/^ +/, '')
        .replace(/=.*/, `=;expires=${new Date(0).toUTCString()};path=/`);
    });

    // Also attempt to clear IndexedDB databases (name is app-specific)
    if ('indexedDB' in window) {
      indexedDB.databases?.().then((dbs) => {
        dbs.forEach((db) => {
          if (db.name) indexedDB.deleteDatabase(db.name);
        });
      }).catch(() => {});
    }

    // Reload fresh
    window.location.reload();
  };

  handleReportError = (): void => {
    const { error } = this.state;
    if (!error) return;

    const details = [
      `Message: ${error.message}`,
      `Name: ${error.name}`,
      `Stack: ${error.stack || '(no stack)'}`,
    ].join('\n');

    navigator.clipboard.writeText(details).catch(() => {});

    this.setState({ copied: true });
    setTimeout(() => {
      this.setState({ copied: false });
    }, 2000);
  };

  toggleStackTrace = (): void => {
    this.setState((prev) => ({ stackExpanded: !prev.stackExpanded }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const { error, stackExpanded, copied } = this.state;
      const hasStack = !!error?.stack;

      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            background: 'var(--bg)',
            padding: 20,
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              maxWidth: 480,
              width: '100%',
              padding: 40,
              textAlign: 'center',
              background: 'var(--surface)',
              borderRadius: 12,
              border: '1px solid var(--border)',
            }}
          >
            {/* Icon */}
            <div style={{ color: 'var(--danger)', marginBottom: 16 }}>
              <AlertTriangle size={48} />
            </div>

            {/* Title */}
            <h2
              style={{
                margin: '0 0 8px',
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--text)',
              }}
            >
              Ha ocurrido un error en el editor
            </h2>

            {/* Error message */}
            <p
              style={{
                margin: '0 0 20px',
                fontSize: 14,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              {error?.message || 'Se produjo un error inesperado.'}
            </p>

            {/* Stack trace (collapsible) */}
            {hasStack && (
              <div
                style={{
                  background: 'var(--bg)',
                  borderRadius: 8,
                  padding: 12,
                  marginTop: 16,
                  marginBottom: 20,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
                onClick={this.toggleStackTrace}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') this.toggleStackTrace();
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    color: 'var(--text-muted)',
                    fontWeight: 500,
                    userSelect: 'none',
                  }}
                >
                  {stackExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>Detalles técnicos</span>
                </div>

                {stackExpanded && (
                  <pre
                    style={{
                      margin: '8px 0 0',
                      fontSize: 12,
                      fontFamily: 'monospace',
                      color: 'var(--text-muted)',
                      maxHeight: 200,
                      overflowY: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      lineHeight: 1.4,
                    }}
                  >
                    {error?.stack}
                  </pre>
                )}
              </div>
            )}

            {/* Buttons */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                alignItems: 'center',
              }}
            >
              {/* Primary: Recargar pestaña */}
              <button
                onClick={this.handleReloadTab}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  height: 36,
                  padding: '0 20px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  border: 'none',
                  background: 'var(--primary)',
                  color: '#fff',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                <RefreshCw size={16} />
                Recargar pestaña
              </button>

              {/* Secondary: Recargar sesión completa */}
              <button
                onClick={this.handleReloadSession}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  height: 36,
                  padding: '0 20px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 500,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                Recargar sesión completa
              </button>

              {/* Tertiary: Limpiar almacenamiento */}
              <button
                onClick={this.handleClearStorage}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  height: 36,
                  padding: '0 20px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  border: '1px solid var(--danger)',
                  background: 'transparent',
                  color: 'var(--danger)',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                <Trash2 size={14} />
                Limpiar almacenamiento y recargar
              </button>

              {/* Quaternary: Reportar error */}
              <button
                onClick={this.handleReportError}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  height: 36,
                  padding: '0 20px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 400,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                <Copy size={14} />
                {copied ? 'Copiado' : 'Reportar error'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
