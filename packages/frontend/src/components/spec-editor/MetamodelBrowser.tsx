import React, { useState } from 'react';
import { Plus, Check, ChevronDown, ChevronRight, Box, Link2 } from '../icons';

interface EAttribute {
  name: string;
  eType?: string;
}

interface EReference {
  name: string;
  eType?: string;
  containment?: boolean;
  upperBound?: number;
}

interface EClassInfo {
  name: string;
  abstract?: boolean;
  interface?: boolean;
  eAttributes?: EAttribute[];
  eReferences?: EReference[];
}

interface MetamodelBrowserProps {
  eclasses: EClassInfo[];
  existingMappings: string[];
  onAddNodeMapping: (className: string) => void;
  onAddEdgeMapping: (sourceClass: string, refName: string, targetClass: string) => void;
}

export function MetamodelBrowser({
  eclasses,
  existingMappings,
  onAddNodeMapping,
  onAddEdgeMapping,
}: MetamodelBrowserProps) {
  const [classesExpanded, setClassesExpanded] = useState(true);
  const [refsExpanded, setRefsExpanded] = useState(true);

  // Collect all references with source/target info
  const allReferences = eclasses.flatMap((ec) =>
    ((ec.eReferences ?? [])).map((ref) => ({
      sourceClass: ec.name,
      refName: ref.name,
      targetClass: ref.eType || 'EObject',
      containment: ref.containment ?? false,
    }))
  );

  const handleDragStartClass = (e: React.DragEvent, className: string) => {
    e.dataTransfer.setData('application/x-metamodel-class', className);
    e.dataTransfer.setData('text/plain', className);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragStartRef = (
    e: React.DragEvent,
    sourceClass: string,
    refName: string,
    targetClass: string
  ) => {
    const payload = JSON.stringify({ sourceClass, refName, targetClass });
    e.dataTransfer.setData('application/x-metamodel-reference', payload);
    e.dataTransfer.setData('text/plain', `${sourceClass}.${refName}`);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Classes Section */}
      <SectionHeader
        label="Classes"
        icon={<Box size={12} />}
        expanded={classesExpanded}
        onToggle={() => setClassesExpanded(!classesExpanded)}
        count={eclasses.length}
      />
      {classesExpanded && (
        <div style={{ flex: '1 1 auto', overflowY: 'auto', padding: '2px 0' }}>
          {eclasses.map((ec) => {
            const isMapped = existingMappings.includes(ec.name);
            const isConcrete = !ec.abstract && !ec.interface;

            return (
              <div
                key={ec.name}
                draggable={isConcrete}
                onDragStart={(e) => handleDragStartClass(e, ec.name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 8px',
                  fontSize: '12px',
                  cursor: isConcrete ? 'grab' : 'default',
                  opacity: isMapped ? 0.55 : 1,
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <Box size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span
                  style={{
                    flex: 1,
                    color: 'var(--text)',
                    fontWeight: isConcrete ? 500 : 400,
                    fontStyle: ec.abstract || ec.interface ? 'italic' : 'normal',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {ec.name}
                </span>

                {/* Badges */}
                {ec.abstract && (
                  <Badge label="A" title="Abstract" />
                )}
                {ec.interface && (
                  <Badge label="I" title="Interface" />
                )}
                {((ec.eAttributes ?? [])).length > 0 && (
                  <span
                    style={{
                      fontSize: '10px',
                      color: 'var(--text-muted)',
                      flexShrink: 0,
                    }}
                    title={`${((ec.eAttributes ?? [])).length} attribute(s)`}
                  >
                    {((ec.eAttributes ?? [])).length} attr
                  </span>
                )}

                {/* Action button */}
                {isMapped ? (
                  <Check
                    size={13}
                    style={{ color: 'var(--success)', flexShrink: 0 }}
                  />
                ) : isConcrete ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddNodeMapping(ec.name);
                    }}
                    title={`Add node mapping for ${ec.name}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '18px',
                      height: '18px',
                      border: '1px solid var(--border)',
                      borderRadius: '3px',
                      background: 'var(--surface)',
                      cursor: 'pointer',
                      padding: 0,
                      flexShrink: 0,
                      color: 'var(--primary)',
                    }}
                  >
                    <Plus size={12} />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* References Section */}
      <SectionHeader
        label="References"
        icon={<Link2 size={12} />}
        expanded={refsExpanded}
        onToggle={() => setRefsExpanded(!refsExpanded)}
        count={allReferences.length}
      />
      {refsExpanded && (
        <div style={{ flex: '1 1 auto', overflowY: 'auto', padding: '2px 0' }}>
          {allReferences.map((ref) => {
            const key = `${ref.sourceClass}.${ref.refName}.${ref.targetClass}`;
            return (
              <div
                key={key}
                draggable
                onDragStart={(e) =>
                  handleDragStartRef(e, ref.sourceClass, ref.refName, ref.targetClass)
                }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 8px',
                  fontSize: '11px',
                  cursor: 'grab',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <Link2 size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span
                  style={{
                    flex: 1,
                    color: 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={`${ref.sourceClass}.${ref.refName} → ${ref.targetClass}`}
                >
                  <span style={{ color: 'var(--text)' }}>{ref.sourceClass}</span>
                  .{ref.refName}{' '}
                  <span style={{ color: 'var(--text-muted)' }}>→</span>{' '}
                  <span style={{ color: 'var(--text)' }}>{ref.targetClass}</span>
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddEdgeMapping(ref.sourceClass, ref.refName, ref.targetClass);
                  }}
                  title={`Add edge mapping for ${ref.sourceClass}.${ref.refName}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '18px',
                    height: '18px',
                    border: '1px solid var(--border)',
                    borderRadius: '3px',
                    background: 'var(--surface)',
                    cursor: 'pointer',
                    padding: 0,
                    flexShrink: 0,
                    color: 'var(--primary)',
                  }}
                >
                  <Plus size={12} />
                </button>
              </div>
            );
          })}
          {allReferences.length === 0 && (
            <div
              style={{
                padding: '8px',
                fontSize: '11px',
                color: 'var(--text-muted)',
                textAlign: 'center',
              }}
            >
              No references in metamodel
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Collapsible section header */
function SectionHeader({
  label,
  icon,
  expanded,
  onToggle,
  count,
}: {
  label: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  count: number;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        width: '100%',
        padding: '5px 8px',
        border: 'none',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        cursor: 'pointer',
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        textAlign: 'left',
      }}
    >
      {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      {icon}
      <span style={{ flex: 1 }}>{label}</span>
      <span
        style={{
          fontSize: '10px',
          color: 'var(--text-muted)',
          fontWeight: 400,
        }}
      >
        {count}
      </span>
    </button>
  );
}

/** Small inline badge */
function Badge({ label, title }: { label: string; title: string }) {
  return (
    <span
      title={title}
      style={{
        fontSize: '9px',
        fontWeight: 600,
        padding: '0 3px',
        borderRadius: '2px',
        border: '1px solid var(--border)',
        color: 'var(--text-muted)',
        lineHeight: '14px',
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}
