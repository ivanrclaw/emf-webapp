import { useState, useEffect, useRef } from 'react';
import { X, BookOpen, Code, Keyboard, Lightbulb, Terminal } from 'lucide-react';
import { useIDEStore, type IDEFile } from './useIDEStore';

type HelpTab = 'reference' | 'ocl' | 'examples' | 'shortcuts';

interface HelpPanelProps {
  open: boolean;
  onClose: () => void;
}

export function HelpPanel({ open, onClose }: HelpPanelProps) {
  const [activeTab, setActiveTab] = useState<HelpTab>('reference');
  const panelRef = useRef<HTMLDivElement>(null);
  const { addFile } = useIDEStore();

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleInsertExample = (content: string, filename: string) => {
    const newFile: IDEFile = {
      id: crypto.randomUUID(),
      filename,
      content,
      language: 'mtl',
      isDirty: true,
      hasErrors: false,
    };
    addFile(newFile);
    onClose();
  };

  const tabs: Array<{ id: HelpTab; label: string; icon: React.ReactNode }> = [
    { id: 'reference', label: 'Quick Reference', icon: <BookOpen size={14} /> },
    { id: 'ocl', label: 'OCL Operations', icon: <Code size={14} /> },
    { id: 'examples', label: 'Examples', icon: <Lightbulb size={14} /> },
    { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard size={14} /> },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
        }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        style={{
          position: 'relative',
          width: 560,
          maxWidth: '90vw',
          height: '100%',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.2)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Terminal size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
              Acceleo/MTL Help
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
              borderRadius: 4,
              display: 'flex',
            }}
            aria-label="Close help panel"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            padding: '0 12px',
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: activeTab === tab.id ? 600 : 400,
                color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {activeTab === 'reference' && <QuickReferenceTab />}
          {activeTab === 'ocl' && <OCLOperationsTab />}
          {activeTab === 'examples' && <ExamplesTab onInsert={handleInsertExample} />}
          {activeTab === 'shortcuts' && <ShortcutsTab />}
        </div>
      </div>
    </div>
  );
}

// ── Quick Reference Tab ─────────────────────────────────────────────────

function QuickReferenceTab() {
  const entries = [
    { label: 'Module declaration', syntax: "[module name('metamodel-uri')/]" },
    { label: 'Import', syntax: '[import moduleName/]' },
    { label: 'Template (public)', syntax: '[template public name(param : Type)]\n  ...\n[/template]' },
    { label: 'Template (private)', syntax: '[template private name(param : Type)]\n  ...\n[/template]' },
    { label: 'Query', syntax: "[query public name(param : Type) : ReturnType = expression/]" },
    { label: 'For loop', syntax: '[for (var : Type | collection)]\n  ...\n[/for]' },
    { label: 'If / elseif / else', syntax: '[if (condition)]\n  ...\n[elseif (cond)]\n  ...\n[else]\n  ...\n[/if]' },
    { label: 'Let binding', syntax: '[let var : Type = expr]\n  ...\n[/let]' },
    { label: 'File output', syntax: "[file ('path', false, 'UTF-8')]\n  ...\n[/file]" },
    { label: 'Expression', syntax: '[expr/]  or  [var.attr/]' },
    { label: 'Comment', syntax: '[comment] ... [/comment]' },
    { label: 'Main marker', syntax: '[comment @main/]' },
    { label: 'Protected area', syntax: "[protected ('id')]\n  ...\n[/protected]" },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
        Acceleo/MTL syntax quick reference. All blocks use square brackets.
      </p>
      {entries.map((entry) => (
        <div key={entry.label} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
            {entry.label}
          </div>
          <pre
            style={{
              margin: 0,
              padding: '6px 10px',
              background: 'var(--bg)',
              borderRadius: 4,
              fontSize: 11,
              fontFamily: 'monospace',
              color: 'var(--text)',
              whiteSpace: 'pre-wrap',
              overflowX: 'auto',
            }}
          >
            {entry.syntax}
          </pre>
        </div>
      ))}
    </div>
  );
}

// ── OCL Operations Tab ──────────────────────────────────────────────────

function OCLOperationsTab() {
  const groups = [
    {
      title: 'String Operations',
      ops: [
        { name: 'concat(s)', desc: 'Concatenate strings' },
        { name: 'size()', desc: 'String length' },
        { name: 'substring(start, end)', desc: 'Extract substring' },
        { name: 'toLower()', desc: 'Convert to lowercase' },
        { name: 'toUpper()', desc: 'Convert to uppercase' },
        { name: 'toUpperFirst()', desc: 'Capitalize first letter' },
        { name: 'toLowerFirst()', desc: 'Lowercase first letter' },
        { name: 'trim()', desc: 'Remove whitespace' },
        { name: 'contains(s)', desc: 'Check if contains substring' },
        { name: 'startsWith(s)', desc: 'Check prefix' },
        { name: 'endsWith(s)', desc: 'Check suffix' },
        { name: 'replaceAll(regex, rep)', desc: 'Replace all matches' },
      ],
    },
    {
      title: 'Collection Operations',
      ops: [
        { name: 'select(expr)', desc: 'Filter elements matching condition' },
        { name: 'reject(expr)', desc: 'Filter elements not matching' },
        { name: 'collect(expr)', desc: 'Transform each element' },
        { name: 'forAll(expr)', desc: 'True if all match' },
        { name: 'exists(expr)', desc: 'True if any matches' },
        { name: 'size()', desc: 'Number of elements' },
        { name: 'isEmpty()', desc: 'True if empty' },
        { name: 'notEmpty()', desc: 'True if not empty' },
        { name: 'first()', desc: 'First element' },
        { name: 'last()', desc: 'Last element' },
        { name: 'sortedBy(expr)', desc: 'Sort by expression' },
        { name: 'includes(e)', desc: 'True if contains element' },
        { name: 'excludes(e)', desc: 'True if does not contain' },
        { name: 'union(coll)', desc: 'Union of two collections' },
        { name: 'intersection(coll)', desc: 'Intersection' },
        { name: 'flatten()', desc: 'Flatten nested collections' },
      ],
    },
    {
      title: 'Numeric Operations',
      ops: [
        { name: '+ - * /', desc: 'Arithmetic operators' },
        { name: 'mod', desc: 'Modulo' },
        { name: 'abs()', desc: 'Absolute value' },
        { name: 'max(n)', desc: 'Maximum of two' },
        { name: 'min(n)', desc: 'Minimum of two' },
        { name: 'round()', desc: 'Round to nearest integer' },
        { name: 'floor()', desc: 'Round down' },
      ],
    },
    {
      title: 'Boolean Operations',
      ops: [
        { name: 'and', desc: 'Logical AND' },
        { name: 'or', desc: 'Logical OR' },
        { name: 'not', desc: 'Logical NOT' },
        { name: 'xor', desc: 'Exclusive OR' },
        { name: 'implies', desc: 'Logical implication' },
      ],
    },
    {
      title: 'Type Operations',
      ops: [
        { name: 'oclIsTypeOf(Type)', desc: 'Exact type check' },
        { name: 'oclIsKindOf(Type)', desc: 'Type or subtype check' },
        { name: 'oclAsType(Type)', desc: 'Cast to type' },
      ],
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {groups.map((group) => (
        <div key={group.title}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--accent)',
              marginBottom: 8,
            }}
          >
            {group.title}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '4px 12px',
              fontSize: 11,
            }}
          >
            {group.ops.map((op) => (
              <div
                key={op.name}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 6,
                  padding: '3px 0',
                }}
              >
                <code
                  style={{
                    fontFamily: 'monospace',
                    color: 'var(--text)',
                    background: 'var(--bg)',
                    padding: '1px 4px',
                    borderRadius: 3,
                    fontSize: 10,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {op.name}
                </code>
                <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{op.desc}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Examples Tab ────────────────────────────────────────────────────────

const EXAMPLES = [
  {
    title: 'Basic Class Generation',
    description: 'Generate a Java class for each EClass',
    filename: 'basicClass.mtl',
    content: `[comment @main/]
[module basicClass('http://www.eclipse.org/emf/2002/Ecore')/]

[template public generate(c : EClass)]
[file (c.name.concat('.java'), false, 'UTF-8')]
public class [c.name/] {
[for (attr : EAttribute | c.eAllAttributes)]
    private [attr.eType.name/] [attr.name/];
[/for]
}
[/file]
[/template]
`,
  },
  {
    title: 'Collection Iteration',
    description: 'Iterate and filter collections with OCL',
    filename: 'collections.mtl',
    content: `[comment @main/]
[module collections('http://www.eclipse.org/emf/2002/Ecore')/]

[template public generate(c : EClass)]
[file (c.name.concat('_report.txt'), false, 'UTF-8')]
Class: [c.name/]
Attributes ([c.eAllAttributes->size()/]):
[for (attr : EAttribute | c.eAllAttributes->sortedBy(name))]
  - [attr.name/] : [attr.eType.name/]
[/for]

Required attributes:
[for (attr : EAttribute | c.eAllAttributes->select(a | a.lowerBound > 0))]
  * [attr.name/]
[/for]
[/file]
[/template]
`,
  },
  {
    title: 'Conditional Output',
    description: 'Use if/elseif/else for conditional generation',
    filename: 'conditional.mtl',
    content: `[comment @main/]
[module conditional('http://www.eclipse.org/emf/2002/Ecore')/]

[template public generate(c : EClass)]
[file (c.name.concat('.ts'), false, 'UTF-8')]
[if (c.abstract)]
export abstract class [c.name/] {
[elseif (c.interface)]
export interface [c.name/] {
[else]
export class [c.name/] {
[/if]
[for (attr : EAttribute | c.eAllAttributes)]
  [attr.name/]: [attr.eType.name/];
[/for]
}
[/file]
[/template]
`,
  },
  {
    title: 'File Per Class Pattern',
    description: 'Generate one file per class with imports',
    filename: 'filePerClass.mtl',
    content: `[comment @main/]
[module filePerClass('http://www.eclipse.org/emf/2002/Ecore')/]

[template public generate(p : EPackage)]
[for (c : EClass | p.eClassifiers->filter(EClass))]
[generateClass(c)/]
[/for]
[/template]

[template private generateClass(c : EClass)]
[file (c.name.toLowerFirst().concat('.ts'), false, 'UTF-8')]
// Generated from [c.name/]
[for (ref : EReference | c.eAllReferences)]
import { [ref.eType.name/] } from './[ref.eType.name.toLowerFirst()/]';
[/for]

export class [c.name/] {
[for (attr : EAttribute | c.eAllAttributes)]
  [attr.name/]: [attr.eType.name/];
[/for]
}
[/file]
[/template]
`,
  },
  {
    title: 'Cross-File Import',
    description: 'Use imports to share templates between files',
    filename: 'withImport.mtl',
    content: `[comment @main/]
[module withImport('http://www.eclipse.org/emf/2002/Ecore')/]

[import utils/]

[template public generate(c : EClass)]
[file (c.name.concat('.java'), false, 'UTF-8')]
// Using imported template
[greet(c)/]

public class [c.name/] {
}
[/file]
[/template]
`,
  },
];

function ExamplesTab({ onInsert }: { onInsert: (content: string, filename: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
        Click an example to insert it as a new file in your project.
      </p>
      {EXAMPLES.map((example) => (
        <div
          key={example.title}
          onClick={() => onInsert(example.content, example.filename)}
          style={{
            padding: 12,
            background: 'var(--bg)',
            borderRadius: 6,
            border: '1px solid var(--border)',
            cursor: 'pointer',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
            {example.title}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
            {example.description}
          </div>
          <pre
            style={{
              margin: 0,
              padding: '8px 10px',
              background: 'var(--surface)',
              borderRadius: 4,
              fontSize: 10,
              fontFamily: 'monospace',
              color: 'var(--text)',
              whiteSpace: 'pre-wrap',
              maxHeight: 120,
              overflow: 'auto',
            }}
          >
            {example.content.trim()}
          </pre>
        </div>
      ))}
    </div>
  );
}

// ── Shortcuts Tab ───────────────────────────────────────────────────────

function ShortcutsTab() {
  const shortcuts = [
    { category: 'General', items: [
      { keys: 'Ctrl+Shift+P', desc: 'Command Palette' },
      { keys: 'Ctrl+P', desc: 'Quick Open File' },
      { keys: 'F1', desc: 'Open Help' },
      { keys: 'Escape', desc: 'Close panel / dialog' },
    ]},
    { category: 'File', items: [
      { keys: 'Ctrl+S', desc: 'Save All' },
      { keys: 'Ctrl+Enter', desc: 'Generate Output' },
      { keys: 'F5', desc: 'Generate Output (alt)' },
    ]},
    { category: 'Editor', items: [
      { keys: 'Ctrl+W', desc: 'Close Active Tab' },
      { keys: 'Ctrl+Tab', desc: 'Next Tab' },
      { keys: 'Ctrl+Shift+Tab', desc: 'Previous Tab' },
      { keys: 'Ctrl+D', desc: 'Select Next Occurrence' },
      { keys: 'Ctrl+/', desc: 'Toggle Comment' },
      { keys: 'Ctrl+Shift+K', desc: 'Delete Line' },
      { keys: 'Alt+Up/Down', desc: 'Move Line Up/Down' },
    ]},
    { category: 'Autocomplete', items: [
      { keys: 'Ctrl+Space', desc: 'Trigger Suggestions' },
      { keys: 'Tab', desc: 'Accept Suggestion' },
      { keys: 'Escape', desc: 'Dismiss Suggestions' },
    ]},
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {shortcuts.map((group) => (
        <div key={group.category}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--accent)',
              marginBottom: 8,
            }}
          >
            {group.category}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {group.items.map((item) => (
              <div
                key={item.keys}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 8px',
                  borderRadius: 4,
                  background: 'var(--bg)',
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--text)' }}>{item.desc}</span>
                <kbd
                  style={{
                    fontSize: 11,
                    fontFamily: 'monospace',
                    padding: '2px 6px',
                    borderRadius: 3,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {item.keys}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
