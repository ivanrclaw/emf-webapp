import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';

const STORAGE_KEY = 'emf-onboarding-done';

interface TourStep {
  selector: string | null; // data-tour attribute value, null = centered
  title: string;
  description: string;
}

const STEPS: TourStep[] = [
  {
    selector: 'sidebar',
    title: 'Explorer',
    description: 'Your projects and metamodels live here. Expand a project to see its metamodels and open them in tabs.',
  },
  {
    selector: 'tabbar',
    title: 'Tabs',
    description: 'Each tool opens in a tab. You can have multiple tabs open and switch between them with Ctrl+Tab.',
  },
  {
    selector: null,
    title: 'Command Palette',
    description: 'Press Ctrl+P to quickly search and open anything — metamodels, actions, and settings.',
  },
];

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 100000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.6)',
  zIndex: 100000,
};

const cardStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 100002,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '16px 20px',
  maxWidth: 320,
  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
};

const spotlightStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 100001,
  borderRadius: 4,
  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
  transition: 'all 0.3s ease',
  pointerEvents: 'none',
};

export function OnboardingTour() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      // Small delay to let the layout render
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const finish = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setVisible(false);
  }, []);

  const next = useCallback(() => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      finish();
    }
  }, [step, finish]);

  useEffect(() => {
    if (!visible) return;
    const currentStep = STEPS[step];
    if (currentStep.selector) {
      const el = document.querySelector(`[data-tour="${currentStep.selector}"]`);
      if (el) {
        setSpotlightRect(el.getBoundingClientRect());
      } else {
        setSpotlightRect(null);
      }
    } else {
      setSpotlightRect(null);
    }
  }, [step, visible]);

  if (!visible) return null;

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // Position card next to spotlight or centered
  const cardPosition: React.CSSProperties = spotlightRect
    ? {
        top: spotlightRect.top + spotlightRect.height / 2 - 60,
        left: spotlightRect.right + 16,
      }
    : {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };

  return ReactDOM.createPortal(
    <>
      {/* Backdrop (only when no spotlight) */}
      {!spotlightRect && <div style={backdropStyle} onClick={finish} />}

      {/* Spotlight cutout */}
      {spotlightRect && (
        <div
          style={{
            ...spotlightStyle,
            top: spotlightRect.top - 4,
            left: spotlightRect.left - 4,
            width: spotlightRect.width + 8,
            height: spotlightRect.height + 8,
          }}
        />
      )}

      {/* Card */}
      <div style={{ ...cardStyle, ...cardPosition }}>
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: 6,
            }}
          >
            {currentStep.title}
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}
          >
            {currentStep.description}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
            }}
          >
            {step + 1} / {STEPS.length}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={finish}
              style={{
                padding: '4px 10px',
                fontSize: 12,
                border: '1px solid var(--border)',
                borderRadius: 4,
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Skip
            </button>
            <button
              onClick={next}
              style={{
                padding: '4px 12px',
                fontSize: 12,
                border: 'none',
                borderRadius: 4,
                background: 'var(--primary)',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              {isLast ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

export default OnboardingTour;
