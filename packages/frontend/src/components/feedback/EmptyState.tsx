import React from 'react';
import { Package } from '../icons';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CONFIG: Record<
  NonNullable<EmptyStateProps['size']>,
  { iconSize: number; titleSize: number }
> = {
  sm: { iconSize: 32, titleSize: 14 },
  md: { iconSize: 48, titleSize: 16 },
  lg: { iconSize: 64, titleSize: 18 },
};

const buttonBaseStyle: React.CSSProperties = {
  height: 32,
  padding: '0 16px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 13,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  whiteSpace: 'nowrap',
};

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  secondaryAction,
  size = 'md',
}) => {
  const { iconSize, titleSize } = SIZE_CONFIG[size];

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
  };

  const iconStyle: React.CSSProperties = {
    width: iconSize,
    height: iconSize,
    color: 'var(--text-muted)',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: titleSize,
    fontWeight: 700,
    color: 'var(--text)',
    margin: '16px 0 8px',
    textAlign: 'center',
    lineHeight: 1.3,
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--text-secondary)',
    textAlign: 'center',
    margin: 0,
    lineHeight: 1.4,
    maxWidth: 400,
  };

  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    gap: 12,
    marginTop: 8,
  };

  const defaultIcon = <Package style={iconStyle} />;

  return (
    <div style={containerStyle}>
      <div style={iconStyle}>
        {icon ?? defaultIcon}
      </div>

      <p style={titleStyle}>{title}</p>

      {description && <p style={descriptionStyle}>{description}</p>}

      {(action || secondaryAction) && (
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
        </div>
      )}
    </div>
  );
};

export default EmptyState;
