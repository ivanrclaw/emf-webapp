import { useState, useEffect, useMemo } from 'react';
import { X, Wand2, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { useIDEStore, type IDEFile } from './useIDEStore';

interface TemplateWizardProps {
  open: boolean;
  onClose: () => void;
}

type GenerationPattern = 'one-per-class' | 'single-file' | 'package-based';
type OutputFormat = 'java' | 'typescript' | 'sql' | 'markdown' | 'custom';

const PATTERN_LABELS: Record<GenerationPattern, { label: string; description: string }> = {
  'one-per-class': {
    label: 'One file per class',
    description: 'Iterates over all EClass instances and generates a separate file for each',
  },
  'single-file': {
    label: 'Single file',
    description: 'Generates one output file containing all content',
  },
  'package-based': {
    label: 'Package-based',
    description: 'Groups generation by EPackage, one file per package',
  },
};

const FORMAT_LABELS: Record<OutputFormat, { label: string; extension: string }> = {
  java: { label: 'Java', extension: '.java' },
  typescript: { label: 'TypeScript', extension: '.ts' },
  sql: { label: 'SQL', extension: '.sql' },
  markdown: { label: 'Markdown', extension: '.md' },
  custom: { label: 'Custom', extension: '.txt' },
};

function generateSkeleton(
  rootClass: string,
  pattern: GenerationPattern,
  format: OutputFormat,
): string {
  const ext = FORMAT_LABELS[format].extension;
  const moduleUri = "'http://www.eclipse.org/emf/2002/Ecore'";

  if (pattern === 'one-per-class') {
    return `[comment encoding = UTF-8 /]
[module generate(${moduleUri})]

[template public generate(c : EClass)]
[file (c.name.concat('${ext}'), false, 'UTF-8')]
${getFormatSkeleton(format, 'c')}
[/file]
[/template]
`;
  }

  if (pattern === 'single-file') {
    const filename = rootClass ? rootClass.toLowerCase() + ext : 'output' + ext;
    return `[comment encoding = UTF-8 /]
[module generate(${moduleUri})]

[template public generate(p : EPackage)]
[file ('${filename}', false, 'UTF-8')]
${getFormatSkeletonPackage(format, 'p')}
[/file]
[/template]
`;
  }

  // package-based
  return `[comment encoding = UTF-8 /]
[module generate(${moduleUri})]

[template public generate(p : EPackage)]
[file (p.name.concat('${ext}'), false, 'UTF-8')]
${getFormatSkeletonPackage(format, 'p')}
[/file]
[/template]
`;
}

function getFormatSkeleton(format: OutputFormat, varName: string): string {
  switch (format) {
    case 'java':
      return `package [${varName}.ePackage.name/];

public class [${varName}.name/] {
[for (attr : EAttribute | ${varName}.eAllAttributes)]
    private [attr.eType.name/] [attr.name/];
[/for]
}`;
    case 'typescript':
      return `export interface [${varName}.name/] {
[for (attr : EAttribute | ${varName}.eAllAttributes)]
  [attr.name/]: [attr.eType.name/];
[/for]
}`;
    case 'sql':
      return `CREATE TABLE [${varName}.name.toLower()/] (
    id SERIAL PRIMARY KEY[for (attr : EAttribute | ${varName}.eAllAttributes)],
    [attr.name/] TEXT[/for]
);`;
    case 'markdown':
      return `# [${varName}.name/]

[for (attr : EAttribute | ${varName}.eAllAttributes)]
- **[attr.name/]**: [attr.eType.name/]
[/for]`;
    default:
      return `[comment TODO: Add your generation logic here /]
[${varName}.name/]`;
  }
}

function getFormatSkeletonPackage(format: OutputFormat, varName: string): string {
  switch (format) {
    case 'java':
      return `package [${varName}.name/];

[for (c : EClass | ${varName}.eClassifiers->filter(EClass))]
// Class: [c.name/]
[/for]`;
    case 'typescript':
      return `// Generated from package [${varName}.name/]

[for (c : EClass | ${varName}.eClassifiers->filter(EClass))]
export interface [c.name/] {
[for (attr : EAttribute | c.eAllAttributes)]
  [attr.name/]: [attr.eType.name/];
[/for]
}

[/for]`;
    case 'sql':
      return `-- Schema for [${varName}.name/]

[for (c : EClass | ${varName}.eClassifiers->filter(EClass)->select(c | not c.abstract))]
CREATE TABLE [c.name.toLower()/] (
    id SERIAL PRIMARY KEY
);

[/for]`;
    case 'markdown':
      return `# [${varName}.name.toUpperFirst()/]

[for (c : EClass | ${varName}.eClassifiers->filter(EClass))]
## [c.name/]

[for (attr : EAttribute | c.eAllAttributes)]
- [attr.name/]: [attr.eType.name/]
[/for]

[/for]`;
    default:
      return `[comment TODO: Add your generation logic here /]
[for (c : EClass | ${varName}.eClassifiers->filter(EClass))]
[c.name/]
[/for]`;
  }
}

export function TemplateWizard({ open, onClose }: TemplateWizardProps) {
  const { state, addFile } = useIDEStore();
  const { metamodelContent } = state;

  const [step, setStep] = useState(1);
  const [rootClass, setRootClass] = useState('');
  const [pattern, setPattern] = useState<GenerationPattern>('one-per-class');
  const [format, setFormat] = useState<OutputFormat>('java');

  // Extract class names from metamodel content
  const classNames = useMemo(() => {
    if (!metamodelContent) return [];
    const names: string[] = [];
    function extract(obj: unknown) {
      if (obj && typeof obj === 'object') {
        const record = obj as Record<string, unknown>;
        if (record.eClass === 'http://www.eclipse.org/emf/2002/Ecore#//EClass' || record.type === 'EClass') {
          if (typeof record.name === 'string') {
            names.push(record.name);
          }
        }
        if (Array.isArray(record.eClassifiers)) {
          for (const c of record.eClassifiers) {
            extract(c);
          }
        }
        if (Array.isArray(record.eSubpackages)) {
          for (const p of record.eSubpackages) {
            extract(p);
          }
        }
        // Handle flat array of classifiers
        if (Array.isArray(obj)) {
          for (const item of obj) {
            extract(item);
          }
        }
      }
    }
    extract(metamodelContent);
    // If no classes found, provide some defaults
    if (names.length === 0) {
      names.push('EClass', 'EPackage', 'EAttribute');
    }
    return names;
  }, [metamodelContent]);

  useEffect(() => {
    if (open) {
      setStep(1);
      setRootClass(classNames[0] || '');
      setPattern('one-per-class');
      setFormat('java');
    }
  }, [open, classNames]);

  const preview = useMemo(
    () => generateSkeleton(rootClass, pattern, format),
    [rootClass, pattern, format],
  );

  const handleConfirm = () => {
    const ext = FORMAT_LABELS[format].extension;
    const filename = `generate${rootClass || 'Template'}${ext === '.java' ? '.mtl' : '.mtl'}`;
    const newFile: IDEFile = {
      id: crypto.randomUUID(),
      filename,
      content: preview,
      language: 'mtl',
      isDirty: true,
      hasErrors: false,
      isNew: true,
    };
    addFile(newFile);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Template Wizard"
    >
      {/* Backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />

      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '90%',
          maxWidth: 580,
          maxHeight: '80vh',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wand2 size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
              Template Wizard
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: 4,
            }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Step indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '12px 20px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {[1, 2, 3, 4].map((s) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 600,
                  background: s <= step ? 'var(--accent)' : 'var(--surface)',
                  color: s <= step ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${s <= step ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                {s < step ? <Check size={12} /> : s}
              </div>
              {s < 4 && (
                <div
                  style={{
                    width: 32,
                    height: 2,
                    background: s < step ? 'var(--accent)' : 'var(--border)',
                    borderRadius: 1,
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          {step === 1 && (
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>
                Select Root Class
              </h3>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 14px' }}>
                Choose the EClass that will be the entry point for code generation.
              </p>
              <select
                value={rootClass}
                onChange={(e) => setRootClass(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: 13,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text)',
                  outline: 'none',
                }}
              >
                {classNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              {classNames.length <= 3 && (
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8 }}>
                  Tip: Load a metamodel to see its classes here.
                </p>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>
                Generation Pattern
              </h3>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 14px' }}>
                How should the template iterate over model elements?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(Object.entries(PATTERN_LABELS) as [GenerationPattern, { label: string; description: string }][]).map(
                  ([key, { label, description }]) => (
                    <label
                      key={key}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 6,
                        border: `1px solid ${pattern === key ? 'var(--accent)' : 'var(--border)'}`,
                        background: pattern === key ? 'var(--accent)11' : 'var(--surface)',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="pattern"
                        value={key}
                        checked={pattern === key}
                        onChange={() => setPattern(key)}
                        style={{ marginTop: 2 }}
                      />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>
                          {label}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {description}
                        </div>
                      </div>
                    </label>
                  ),
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>
                Output Format
              </h3>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 14px' }}>
                What language/format should the generated code be in?
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {(Object.entries(FORMAT_LABELS) as [OutputFormat, { label: string; extension: string }][]).map(
                  ([key, { label, extension }]) => (
                    <button
                      key={key}
                      onClick={() => setFormat(key)}
                      style={{
                        padding: '12px',
                        borderRadius: 6,
                        border: `1px solid ${format === key ? 'var(--accent)' : 'var(--border)'}`,
                        background: format === key ? 'var(--accent)11' : 'var(--surface)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>
                        {label}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        {extension}
                      </div>
                    </button>
                  ),
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>
                Preview & Confirm
              </h3>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 6px' }}>
                Root: <strong>{rootClass}</strong> · Pattern: <strong>{PATTERN_LABELS[pattern].label}</strong> · Format: <strong>{FORMAT_LABELS[format].label}</strong>
              </p>
              <pre
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: 12,
                  fontSize: 11,
                  color: 'var(--text)',
                  overflow: 'auto',
                  maxHeight: 260,
                  whiteSpace: 'pre-wrap',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {preview}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="btn btn-ghost btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <ChevronLeft size={13} />
            Back
          </button>
          {step < 4 ? (
            <button
              onClick={() => setStep((s) => Math.min(4, s + 1))}
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              Next
              <ChevronRight size={13} />
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Check size={13} />
              Create Template
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
