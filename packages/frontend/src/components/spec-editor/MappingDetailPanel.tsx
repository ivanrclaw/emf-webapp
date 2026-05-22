/**
 * MappingDetailPanel — Central panel with form-based editor
 * for the currently selected mapping. Uses tabs for different aspects.
 */
import React, { useState, useEffect } from 'react';
import type {
  Layer,
  NodeMapping,
  ContainerMapping,
  EdgeMapping,
  NodeStyle,
  EdgeStyleSpec,
  ToolSection,
  ConditionalStyle,
} from '../spec-diagram/types';
import type { MappingSelection } from './MappingNavigator';
import { NodeStyleEditor } from './editors/NodeStyleEditor';
import { EdgeStyleEditor } from './editors/EdgeStyleEditor';
import { NodeConditionalStylesEditor, EdgeConditionalStylesEditor } from './editors/ConditionalStylesEditor';
import { ToolMappingEditor } from './editors/ToolMappingEditor';
import { FormField, TextInput, Select, SectionDivider, MultiSelect, Slider, Toggle, NumberInput } from './shared/FormControls';
import { Box, Link2, Wrench, Layers } from '../icons';

// ─── Props ────────────────────────────────────────────────────────────────────

interface MappingDetailPanelProps {
  selection: MappingSelection | null;
  layer: Layer;
  allLayers: Layer[];
  onUpdateNodeMapping: (id: string, patch: Partial<NodeMapping>) => void;
  onUpdateContainerMapping: (id: string, patch: Partial<ContainerMapping>) => void;
  onUpdateEdgeMapping: (id: string, patch: Partial<EdgeMapping>) => void;
  onUpdateToolSections: (sections: ToolSection[]) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MappingDetailPanel({
  selection,
  layer,
  allLayers,
  onUpdateNodeMapping,
  onUpdateContainerMapping,
  onUpdateEdgeMapping,
  onUpdateToolSections,
}: MappingDetailPanelProps) {
  const [activeTab, setActiveTab] = useState('general');

  // Reset tab when selection changes
  useEffect(() => {
    setActiveTab('general');
  }, [selection?.id, selection?.type]);

  if (!selection) {
    return <EmptyState />;
  }

  switch (selection.type) {
    case 'node': {
      const mapping = layer.nodeMappings.find((m) => m.id === selection.id);
      if (!mapping) return <EmptyState />;
      return (
        <NodeMappingDetail
          mapping={mapping}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onUpdate={(patch) => onUpdateNodeMapping(selection.id, patch)}
          toolSections={layer.toolSections}
          onUpdateToolSections={onUpdateToolSections}
        />
      );
    }
    case 'container': {
      const mapping = layer.containerMappings.find((m) => m.id === selection.id);
      if (!mapping) return <EmptyState />;
      return (
        <ContainerMappingDetail
          mapping={mapping}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onUpdate={(patch) => onUpdateContainerMapping(selection.id, patch)}
          toolSections={layer.toolSections}
          onUpdateToolSections={onUpdateToolSections}
          layer={layer}
        />
      );
    }
    case 'edge': {
      const mapping = layer.edgeMappings.find((m) => m.id === selection.id);
      if (!mapping) return <EmptyState />;
      return (
        <EdgeMappingDetail
          mapping={mapping}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onUpdate={(patch) => onUpdateEdgeMapping(selection.id, patch)}
          toolSections={layer.toolSections}
          onUpdateToolSections={onUpdateToolSections}
          layer={layer}
        />
      );
    }
    case 'tool-section': {
      const section = layer.toolSections.find((s) => s.id === selection.id);
      if (!section) return <EmptyState />;
      return <ToolSectionDetail section={section} allSections={layer.toolSections} onUpdate={onUpdateToolSections} />;
    }
    case 'layer': {
      const l = allLayers.find((ly) => ly.id === selection.id);
      if (!l) return <EmptyState />;
      return <LayerDetail layer={l} />;
    }
    default:
      return <EmptyState />;
  }
}

// ─── Node Mapping Detail ──────────────────────────────────────────────────────

function NodeMappingDetail({
  mapping,
  activeTab,
  onTabChange,
  onUpdate,
  toolSections,
  onUpdateToolSections,
}: {
  mapping: NodeMapping;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onUpdate: (patch: Partial<NodeMapping>) => void;
  toolSections: ToolSection[];
  onUpdateToolSections: (sections: ToolSection[]) => void;
}) {
  const tabs = ['general', 'style', 'conditional', 'tools'];

  return (
    <div style={styles.panel}>
      <DetailHeader icon={<Box size={14} />} title={mapping.domainClass} subtitle="Node Mapping" />
      <TabBar tabs={tabs} active={activeTab} onChange={onTabChange} />

      <div style={styles.form}>
        {activeTab === 'general' && (
          <>
            <FormField label="Domain Class">
              <TextInput value={mapping.domainClass} readOnly />
            </FormField>
            <FormField label="Label Expression">
              <TextInput
                value={mapping.labelExpression}
                onChange={(v) => onUpdate({ labelExpression: v })}
                placeholder="self.name"
                monospace
              />
            </FormField>
            <FormField label="Semantic Candidates">
              <TextInput
                value={mapping.semanticCandidatesExpression}
                onChange={(v) => onUpdate({ semanticCandidatesExpression: v })}
                placeholder="self"
                monospace
              />
            </FormField>
            <FormField label="Precondition">
              <TextInput
                value={mapping.preconditionExpression || ''}
                onChange={(v) => onUpdate({ preconditionExpression: v || undefined })}
                placeholder="(optional)"
                monospace
              />
            </FormField>
          </>
        )}

        {activeTab === 'style' && (
          <NodeStyleEditor
            style={mapping.defaultStyle}
            onChange={(patch) => onUpdate({ defaultStyle: { ...mapping.defaultStyle, ...patch } })}
          />
        )}

        {activeTab === 'conditional' && (
          <NodeConditionalStylesEditor
            conditionalStyles={mapping.conditionalStyles}
            onChange={(cs) => onUpdate({ conditionalStyles: cs })}
          />
        )}

        {activeTab === 'tools' && (
          <ToolMappingEditor
            mappingId={mapping.id}
            mappingType="node"
            domainClass={mapping.domainClass}
            toolSections={toolSections}
            onUpdateToolSections={onUpdateToolSections}
          />
        )}
      </div>
    </div>
  );
}

// ─── Container Mapping Detail ─────────────────────────────────────────────────

function ContainerMappingDetail({
  mapping,
  activeTab,
  onTabChange,
  onUpdate,
  toolSections,
  onUpdateToolSections,
  layer,
}: {
  mapping: ContainerMapping;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onUpdate: (patch: Partial<ContainerMapping>) => void;
  toolSections: ToolSection[];
  onUpdateToolSections: (sections: ToolSection[]) => void;
  layer: Layer;
}) {
  const tabs = ['general', 'style', 'children', 'conditional', 'tools'];

  // Available node/container mappings for sub-mapping selection (exclude self)
  const availableNodeMappings = layer.nodeMappings
    .filter((m) => m.id !== mapping.id)
    .map((m) => ({ value: m.id, label: m.domainClass }));
  const availableContainerMappings = layer.containerMappings
    .filter((m) => m.id !== mapping.id)
    .map((m) => ({ value: m.id, label: m.domainClass }));

  return (
    <div style={styles.panel}>
      <DetailHeader icon={<Box size={14} />} title={mapping.domainClass} subtitle="Container Mapping" />
      <TabBar tabs={tabs} active={activeTab} onChange={onTabChange} />

      <div style={styles.form}>
        {activeTab === 'general' && (
          <>
            <FormField label="Domain Class">
              <TextInput value={mapping.domainClass} readOnly />
            </FormField>
            <FormField label="Label Expression">
              <TextInput
                value={mapping.labelExpression}
                onChange={(v) => onUpdate({ labelExpression: v })}
                placeholder="self.name"
                monospace
              />
            </FormField>
            <FormField label="Semantic Candidates">
              <TextInput
                value={mapping.semanticCandidatesExpression}
                onChange={(v) => onUpdate({ semanticCandidatesExpression: v })}
                placeholder="self"
                monospace
              />
            </FormField>
            <FormField label="Precondition">
              <TextInput
                value={mapping.preconditionExpression || ''}
                onChange={(v) => onUpdate({ preconditionExpression: v || undefined })}
                placeholder="(optional)"
                monospace
              />
            </FormField>
          </>
        )}

        {activeTab === 'style' && (
          <NodeStyleEditor
            style={mapping.defaultStyle}
            onChange={(patch) => onUpdate({ defaultStyle: { ...mapping.defaultStyle, ...patch } })}
          />
        )}

        {activeTab === 'children' && (
          <>
            <FormField label="Children Presentation">
              <Select
                value={mapping.childrenPresentation}
                onChange={(v) => onUpdate({ childrenPresentation: v as any })}
                options={[
                  { value: 'FreeForm', label: 'Free Form' },
                  { value: 'List', label: 'List' },
                  { value: 'HorizontalStack', label: 'Horizontal Stack' },
                  { value: 'VerticalStack', label: 'Vertical Stack' },
                ]}
              />
            </FormField>

            <SectionDivider label="Layout" />
            <FormField label="Children Spacing">
              <Slider
                value={mapping.childrenSpacing ?? 8}
                onChange={(v) => onUpdate({ childrenSpacing: v })}
                min={0}
                max={32}
                step={2}
                suffix="px"
              />
            </FormField>
            <FormField label="Padding">
              <Slider
                value={mapping.padding ?? 12}
                onChange={(v) => onUpdate({ padding: v })}
                min={0}
                max={40}
                step={2}
                suffix="px"
              />
            </FormField>
            <Toggle
              value={mapping.borderedCompartments ?? false}
              onChange={(v) => onUpdate({ borderedCompartments: v })}
              label="Bordered compartments"
            />

            <SectionDivider label="Sub-Node Mappings" />
            <MultiSelect
              options={availableNodeMappings}
              selected={mapping.subNodeMappingIds}
              onChange={(ids) => onUpdate({ subNodeMappingIds: ids })}
              emptyText="No node mappings available"
            />

            <SectionDivider label="Sub-Container Mappings" />
            <MultiSelect
              options={availableContainerMappings}
              selected={mapping.subContainerMappingIds}
              onChange={(ids) => onUpdate({ subContainerMappingIds: ids })}
              emptyText="No container mappings available"
            />
          </>
        )}

        {activeTab === 'conditional' && (
          <NodeConditionalStylesEditor
            conditionalStyles={mapping.conditionalStyles}
            onChange={(cs) => onUpdate({ conditionalStyles: cs })}
          />
        )}

        {activeTab === 'tools' && (
          <ToolMappingEditor
            mappingId={mapping.id}
            mappingType="container"
            domainClass={mapping.domainClass}
            toolSections={toolSections}
            onUpdateToolSections={onUpdateToolSections}
          />
        )}
      </div>
    </div>
  );
}

// ─── Edge Mapping Detail ──────────────────────────────────────────────────────

function EdgeMappingDetail({
  mapping,
  activeTab,
  onTabChange,
  onUpdate,
  toolSections,
  onUpdateToolSections,
  layer,
}: {
  mapping: EdgeMapping;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onUpdate: (patch: Partial<EdgeMapping>) => void;
  toolSections: ToolSection[];
  onUpdateToolSections: (sections: ToolSection[]) => void;
  layer: Layer;
}) {
  const tabs = ['general', 'style', 'conditional', 'tools'];

  // All node + container mappings as options for source/target
  const allMappingOptions = [
    ...layer.nodeMappings.map((m) => ({ value: m.id, label: `${m.domainClass} (node)` })),
    ...layer.containerMappings.map((m) => ({ value: m.id, label: `${m.domainClass} (container)` })),
  ];

  return (
    <div style={styles.panel}>
      <DetailHeader
        icon={<Link2 size={14} />}
        title={mapping.sourceReference || mapping.domainClass || 'Edge'}
        subtitle="Edge Mapping"
      />
      <TabBar tabs={tabs} active={activeTab} onChange={onTabChange} />

      <div style={styles.form}>
        {activeTab === 'general' && (
          <>
            <FormField label="Type">
              <Select
                value={mapping.type}
                onChange={(v) => onUpdate({ type: v as any })}
                options={[
                  { value: 'relation-based', label: 'Relation-based' },
                  { value: 'element-based', label: 'Element-based' },
                ]}
              />
            </FormField>
            {mapping.type === 'relation-based' && (
              <FormField label="Source Reference">
                <TextInput
                  value={mapping.sourceReference || ''}
                  onChange={(v) => onUpdate({ sourceReference: v })}
                  placeholder="referenceName"
                  monospace
                />
              </FormField>
            )}
            {mapping.type === 'element-based' && (
              <>
                <FormField label="Domain Class">
                  <TextInput
                    value={mapping.domainClass || ''}
                    onChange={(v) => onUpdate({ domainClass: v })}
                    placeholder="EdgeClassName"
                  />
                </FormField>
                <FormField label="Semantic Candidates">
                  <TextInput
                    value={mapping.semanticCandidatesExpression || ''}
                    onChange={(v) => onUpdate({ semanticCandidatesExpression: v })}
                    placeholder="self.edges"
                    monospace
                  />
                </FormField>
                <FormField label="Source Finder">
                  <TextInput
                    value={mapping.sourceFinderExpression || ''}
                    onChange={(v) => onUpdate({ sourceFinderExpression: v || undefined })}
                    placeholder="self.source"
                    monospace
                  />
                </FormField>
              </>
            )}
            <FormField label="Target Finder Expression">
              <TextInput
                value={mapping.targetFinderExpression}
                onChange={(v) => onUpdate({ targetFinderExpression: v })}
                placeholder="self.refName"
                monospace
              />
            </FormField>
            <SectionDivider label="Mapping Connections" />
            <FormField label="Source Mappings">
              <MultiSelect
                options={allMappingOptions}
                selected={mapping.sourceMappingIds}
                onChange={(ids) => onUpdate({ sourceMappingIds: ids })}
                emptyText="No mappings available (create node mappings first)"
              />
            </FormField>
            <FormField label="Target Mappings">
              <MultiSelect
                options={allMappingOptions}
                selected={mapping.targetMappingIds}
                onChange={(ids) => onUpdate({ targetMappingIds: ids })}
                emptyText="No mappings available (create node mappings first)"
              />
            </FormField>
            <FormField label="Precondition">
              <TextInput
                value={mapping.preconditionExpression || ''}
                onChange={(v) => onUpdate({ preconditionExpression: v || undefined })}
                placeholder="(optional)"
                monospace
              />
            </FormField>
          </>
        )}

        {activeTab === 'style' && (
          <EdgeStyleEditor
            style={mapping.defaultStyle}
            onChange={(patch) => onUpdate({ defaultStyle: { ...mapping.defaultStyle, ...patch } })}
          />
        )}

        {activeTab === 'conditional' && (
          <EdgeConditionalStylesEditor
            conditionalStyles={mapping.conditionalStyles}
            onChange={(cs) => onUpdate({ conditionalStyles: cs })}
          />
        )}

        {activeTab === 'tools' && (
          <ToolMappingEditor
            mappingId={mapping.id}
            mappingType="edge"
            domainClass={mapping.sourceReference || mapping.domainClass || 'Edge'}
            toolSections={toolSections}
            onUpdateToolSections={onUpdateToolSections}
          />
        )}
      </div>
    </div>
  );
}

// ─── Tool Section Detail ──────────────────────────────────────────────────────

function ToolSectionDetail({
  section,
  allSections,
  onUpdate,
}: {
  section: ToolSection;
  allSections: ToolSection[];
  onUpdate: (sections: ToolSection[]) => void;
}) {
  const handleRename = (newLabel: string) => {
    onUpdate(allSections.map((s) => (s.id === section.id ? { ...s, label: newLabel } : s)));
  };

  return (
    <div style={styles.panel}>
      <DetailHeader icon={<Wrench size={14} />} title={section.label} subtitle="Tool Section" />
      <div style={styles.form}>
        <FormField label="Section Label">
          <TextInput value={section.label} onChange={handleRename} />
        </FormField>
        <SectionDivider label="Tools" />
        {section.tools.length === 0 && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
            No tools in this section
          </div>
        )}
        {section.tools.map((tool) => (
          <div key={tool.id} style={styles.toolItem}>
            <span style={{ ...styles.toolDot, background: getToolColor(tool.type) }} />
            <span style={{ flex: 1, fontSize: '12px' }}>{tool.label}</span>
            <span style={styles.toolType}>{tool.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Layer Detail ─────────────────────────────────────────────────────────────

function LayerDetail({ layer }: { layer: Layer }) {
  return (
    <div style={styles.panel}>
      <DetailHeader icon={<Layers size={14} />} title={layer.name} subtitle="Layer" />
      <div style={styles.form}>
        <FormField label="Name">
          <TextInput value={layer.name} readOnly />
        </FormField>
        <SectionDivider label="Summary" />
        <div style={styles.summary}>
          <SummaryRow label="Node Mappings" value={layer.nodeMappings.length} />
          <SummaryRow label="Container Mappings" value={layer.containerMappings.length} />
          <SummaryRow label="Edge Mappings" value={layer.edgeMappings.length} />
          <SummaryRow label="Tool Sections" value={layer.toolSections.length} />
        </div>
        <SectionDivider label="Status" />
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {layer.isDefault ? 'Default layer (always active)' : layer.activeByDefault ? 'Active by default' : 'Hidden by default'}
        </div>
      </div>
    </div>
  );
}

// ─── Shared Sub-components ────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={styles.emptyState}>
      <div style={styles.emptyIcon}>
        <Box size={32} style={{ opacity: 0.3 }} />
      </div>
      <div style={styles.emptyTitle}>No mapping selected</div>
      <div style={styles.emptyDesc}>
        Select a mapping from the navigator to edit its properties
      </div>
    </div>
  );
}

function DetailHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div style={styles.header}>
      <div style={styles.headerIcon}>{icon}</div>
      <div>
        <div style={styles.headerTitle}>{title}</div>
        <div style={styles.headerSubtitle}>{subtitle}</div>
      </div>
    </div>
  );
}

function TabBar({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div style={styles.tabs}>
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          style={{
            ...styles.tab,
            ...(active === tab ? styles.tabActive : {}),
          }}
        >
          {tab.charAt(0).toUpperCase() + tab.slice(1)}
        </button>
      ))}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.summaryRow}>
      <span>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function getToolColor(type: string): string {
  switch (type) {
    case 'nodeCreation':
    case 'containerCreation':
      return '#3b82f6';
    case 'edgeCreation':
      return '#f59e0b';
    case 'delete':
      return '#ef4444';
    case 'directEdit':
      return '#10b981';
    default:
      return '#6b7280';
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 16px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface)',
    flexShrink: 0,
  },
  headerIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    background: 'var(--primary-bg, rgba(99, 102, 241, 0.12))',
    color: 'var(--primary)',
  },
  headerTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text)',
  },
  headerSubtitle: {
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
  tabs: {
    display: 'flex',
    gap: '0',
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface)',
    flexShrink: 0,
    padding: '0 12px',
    overflowX: 'auto',
  },
  tab: {
    padding: '8px 14px',
    border: 'none',
    borderBottom: '2px solid transparent',
    background: 'none',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text-muted)',
    transition: 'color 0.15s, border-color 0.15s',
    whiteSpace: 'nowrap',
  },
  tabActive: {
    color: 'var(--primary)',
    borderBottomColor: 'var(--primary)',
    fontWeight: 600,
  },
  form: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  summary: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: 'var(--text)',
    padding: '3px 0',
  },
  toolItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 0',
  },
  toolDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  toolType: {
    fontSize: '9px',
    fontWeight: 600,
    padding: '1px 4px',
    borderRadius: '3px',
    background: 'var(--bg-hover, rgba(255,255,255,0.05))',
    color: 'var(--text-muted)',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '8px',
    padding: '24px',
  },
  emptyIcon: {
    marginBottom: '8px',
    color: 'var(--text-muted)',
  },
  emptyTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
  },
  emptyDesc: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    textAlign: 'center',
  },
};

export default MappingDetailPanel;
