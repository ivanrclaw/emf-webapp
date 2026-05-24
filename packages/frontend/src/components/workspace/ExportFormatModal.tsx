import React from 'react';

interface ExportFormatModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (format: 'json' | 'eclipse') => void;
}

export function ExportFormatModal({ open, onClose, onSelect }: ExportFormatModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose export format"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '24px',
          width: '100%',
          maxWidth: '480px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
        }}
      >
        <h2
          style={{
            margin: '0 0 8px 0',
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--text)',
          }}
        >
          Export Format
        </h2>
        <p
          style={{
            margin: '0 0 20px 0',
            fontSize: '14px',
            color: 'var(--text-secondary)',
          }}
        >
          Choose the format for your project export.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* JSON Card */}
          <button
            type="button"
            aria-label="Export as JSON internal format"
            onClick={() => onSelect('json')}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '14px',
              padding: '16px',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'border-color 0.15s, background-color 0.15s',
              width: '100%',
              color: 'var(--text)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.backgroundColor = 'var(--primary-bg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.backgroundColor = 'var(--surface)';
            }}
          >
            <div
              style={{
                flexShrink: 0,
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                backgroundColor: 'var(--primary-bg)',
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1" />
                <path d="M16 3h1a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2 2 2 0 0 0-2 2v5a2 2 0 0 1-2 2h-1" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: 'var(--text)',
                  marginBottom: '4px',
                }}
              >
                JSON (Internal)
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.4',
                }}
              >
                Portable JSON format for emf-webapp. Includes all project data.
              </div>
            </div>
          </button>

          {/* Eclipse Card */}
          <button
            type="button"
            aria-label="Export as Eclipse Project zip"
            onClick={() => onSelect('eclipse')}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '14px',
              padding: '16px',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'border-color 0.15s, background-color 0.15s',
              width: '100%',
              color: 'var(--text)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.backgroundColor = 'var(--primary-bg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.backgroundColor = 'var(--surface)';
            }}
          >
            <div
              style={{
                flexShrink: 0,
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                backgroundColor: 'var(--primary-bg)',
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                <line x1="12" y1="11" x2="12" y2="17" />
                <line x1="9" y1="14" x2="15" y2="14" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: 'var(--text)',
                  marginBottom: '4px',
                }}
              >
                Eclipse Project
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.4',
                }}
              >
                Full Eclipse bundle (.ecore, .genmodel, .odesign, .ocl, .mtl, .emf, .aird + PDE
                metadata)
              </div>
            </div>
          </button>
        </div>

        {/* Cancel button */}
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            aria-label="Cancel export"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              backgroundColor: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--text-secondary)';
              e.currentTarget.style.color = 'var(--text)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
