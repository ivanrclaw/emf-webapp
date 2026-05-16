import React, { useCallback } from 'react';
import { CircleX, CircleAlert, Info, X } from '../icons';

interface ErrorPanelAction {
  label: string;
  onClick: () => void;
}

interface ErrorPanelProps {
  type?: 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  details?: string;
  action?: ErrorPanelAction;
  secondaryAction?: ErrorPanelAction;
  onCopy?: () => void;
  compact?: boolean;
}

const TYPE_STYLES: Record<
  NonNullable<ErrorPanelProps['type']>,
  { borderColor: string; iconColor: string; Icon: React.FC<React.SVGProps<SVGSVGElement>> }
> = {
  error: {
    borderColor: 'var(--danger)',
    iconColor: 'var(--danger)',
    Icon: CircleX,
  },
  warning: {
    borderColor: 'var(--warning)',
    iconColor: 'var(--warning)',
    Icon: CircleAlert,
  },
  info: {
    borderColor: 'var(--primary)',
    iconColor: 'var(--primary)',
    Icon: Info,
  },
};

const buttonBaseStyle: React.CSSProperties = {
  height: 28,
  padding: '0 12px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 12,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  whiteSpace: 'nowrap',
};

const ErrorPanel: React.FC<ErrorPanelProps> = ({
  type = 'error',
  title,
  message,
  details,
  action,
  secondaryAction,
  onCopy,
  compact = false,
}) => {
  const { borderColor, iconColor, Icon } = TYPE_STYLES[type];

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: compact ? 8 : 12,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderLeft: `4px solid ${borderColor}`,
    borderRadius: 'var(--radius)',
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--text)',
    margin: 0,
    lineHeight: 1.4,
  };

  const messageStyle: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--text-secondary)',
    margin: '4px 0 0',
    lineHeight: 1.4,
  };

  const detailsStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--text-secondary)',
    fontFamily: 'monospace',
    margin: '6px 0 0',
    padding: 6,
    background: 'var(--bg)',
    borderRadius: 4,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    lineHeight: 1.4,
  };

  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  };

  return (
    <div style={containerStyle} role="alert">
      <div style={{ flexShrink: 0, width: 20, height: 20, color: iconColor, marginTop: 1 }}>
        <Icon width={20} height={20} />
      </div>

      <div style={contentStyle}>
        <p style={titleStyle}>{title}</p>

        {message && <p style={messageStyle}>{message}</p>}

        {details && <pre style={detailsStyle}>{details}</pre>}

        <div style={actionsStyle}>
          {action && (
            <button style={buttonBaseStyle} onClick={action.onClick}>
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button style={buttonBaseStyle} onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </button>
          )}
          {onCopy && (
            <button style={buttonBaseStyle} onClick={onCopy}>
              Copy details
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorPanel;
