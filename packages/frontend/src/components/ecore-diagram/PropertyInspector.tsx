/**
 * @emf-webapp/frontend — Property Inspector Panel
 *
 * Panel lateral derecho que muestra formulario de propiedades según el
 * tipo de elemento seleccionado en el editor (class, attribute, reference,
 * enum, dataType o edge).
 */
import React, { useCallback, useMemo } from 'react';
import type {
  SerializableEPackage,
  SerializableEClass,
  SerializableEEnum,
  SerializableEDataType,
  SerializableEAttribute,
  SerializableEReference,
} from './types';

// ── Helpers ─────────────────────────────────────────────────────

function isEClass(c: unknown): c is SerializableEClass {
  return typeof c === 'object' && c !== null && 'eAttributes' in c && 'eReferences' in c;
}

function isEEnum(c: unknown): c is SerializableEEnum {
  return typeof c === 'object' && c !== null && 'eLiterals' in c;
}

function isEDataType(c: unknown): c is SerializableEDataType {
  return typeof c === 'object' && c !== null && 'instanceClassName' in c && !('eLiterals' in c);
}

/** Tipos de datos EMF estándar */
const STANDARD_DATATYPES = ['EString', 'EBoolean', 'EInt', 'ELong', 'EFloat', 'EDouble', 'EBigDecimal', 'EDate'];

/** Nombres para mostrar de bounds */
function boundDisplay(value: number): string {
  if (value === -1) return '*';
  return String(value);
}

function parseBound(value: string): number {
  if (value === '*' || value === '') return -1;
  const n = parseInt(value, 10);
  return isNaN(n) ? 0 : n;
}

// ── Types ───────────────────────────────────────────────────────

export interface PropertyInspectorProps {
  /** ID del elemento seleccionado */
  selectedId: string | null;
  /** Tipo del elemento seleccionado */
  selectedType: 'class' | 'attribute' | 'reference' | 'enum' | 'dataType' | 'edge' | null;
  /** El EPackage completo para búsqueda de referencias */
  pkg: SerializableEPackage;
  /** Callback cuando se modifica un classifier */
  onClassifierChange: (id: string, updates: Partial<SerializableEClass | SerializableEEnum | SerializableEDataType>) => void;
  /** Callback para añadir atributo (desde el inspector) */
  onAddAttribute?: (classId: string) => void;
  /** Callback para añadir referencia (desde el inspector) */
  onAddReference?: (classId: string) => void;
}

// ── Sub-components ──────────────────────────────────────────────

/** Input de texto controlado */
const TextInput: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ label, value, onChange, placeholder }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280' }}>{label}</label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%',
        padding: '6px 8px',
        fontSize: 13,
        border: '1px solid #d1d5db',
        borderRadius: 4,
        outline: 'none',
        background: '#fff',
      }}
    />
  </div>
);

/** Checkbox controlado */
const Checkbox: React.FC<{
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', cursor: 'pointer', userSelect: 'none' }}>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      style={{ borderRadius: 4, border: '1px solid #d1d5db', accentColor: '#2563eb' }}
    />
    {label}
  </label>
);

/** Dropdown de texto */
const SelectInput: React.FC<{
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}> = ({ label, value, options, onChange }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280' }}>{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '6px 8px',
        fontSize: 13,
        border: '1px solid #d1d5db',
        borderRadius: 4,
        outline: 'none',
        background: '#fff',
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

/** Sección de propiedades agrupadas */
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: 12, marginBottom: 12 }}>
    <h4 style={{
      fontSize: 11,
      fontWeight: 600,
      color: '#9ca3af',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      marginBottom: 8,
    }}>{title}</h4>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
  </div>
);

// ── Formularios ─────────────────────────────────────────────────

interface EClassFormProps {
  cls: SerializableEClass;
  pkg: SerializableEPackage;
  onChange: (updates: Partial<SerializableEClass>) => void;
  onAddAttribute?: (classId: string) => void;
  onAddReference?: (classId: string) => void;
}

const EClassForm: React.FC<EClassFormProps> = ({ cls, pkg, onChange, onAddAttribute, onAddReference }) => {
  const otherClasses = useMemo(
    () => pkg.eClassifiers.filter((c) => c.id !== cls.id && isEClass(c)) as SerializableEClass[],
    [pkg, cls.id],
  );

  const availableSuperTypes = useMemo(
    () => otherClasses.filter((c) => c.id !== cls.id && !cls.eSuperTypes.includes(c.id)),
    [otherClasses, cls.id],
  );

  const addSuperType = useCallback(
    (superId: string) => {
      if (!cls.eSuperTypes.includes(superId)) {
        onChange({ eSuperTypes: [...cls.eSuperTypes, superId] });
      }
    },
    [cls.eSuperTypes, onChange],
  );

  const removeSuperType = useCallback(
    (superId: string) => {
      onChange({ eSuperTypes: cls.eSuperTypes.filter((s) => s !== superId) });
    },
    [cls.eSuperTypes, onChange],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Section title="General">
        <TextInput label="Name" value={cls.name} onChange={(v) => onChange({ name: v })} />
        <div style={{ display: 'flex', gap: 16 }}>
          <Checkbox label="Abstract" checked={cls.abstract} onChange={(v) => onChange({ abstract: v })} />
          <Checkbox label="Interface" checked={cls.interface} onChange={(v) => onChange({ interface: v })} />
        </div>
      </Section>

      <Section title="Super Types">
        {cls.eSuperTypes.length === 0 && (
          <p style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>No super types</p>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {cls.eSuperTypes.map((superId) => {
            const superCls = pkg.eClassifiers.find((c) => c.id === superId);
            return (
              <span
                key={superId}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  fontSize: 11,
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  borderRadius: 9999,
                  border: '1px solid #bfdbfe',
                }}
              >
                {superCls?.name ?? superId}
                <button
                  type="button"
                  onClick={() => removeSuperType(superId)}
                  style={{ color: '#60a5fa', fontWeight: 700, lineHeight: 1, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                  title="Remove super type"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
        {availableSuperTypes.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) addSuperType(e.target.value);
            }}
            style={{
              width: '100%',
              padding: '6px 8px',
              fontSize: 13,
              border: '1px solid #d1d5db',
              borderRadius: 4,
              outline: 'none',
              background: '#fff',
              marginTop: 4,
            }}
          >
            <option value="">+ Add super type…</option>
            {availableSuperTypes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </Section>

      <Section title="Features">
        <div style={{ display: 'flex', gap: 8 }}>
          {onAddAttribute && (
            <button
              type="button"
              onClick={() => onAddAttribute(cls.id)}
              style={{
                flex: 1,
                padding: '6px 8px',
                fontSize: 11,
                fontWeight: 500,
                color: '#fff',
                background: '#2563eb',
                borderRadius: 4,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              + Attribute
            </button>
          )}
          {onAddReference && (
            <button
              type="button"
              onClick={() => onAddReference(cls.id)}
              style={{
                flex: 1,
                padding: '6px 8px',
                fontSize: 11,
                fontWeight: 500,
                color: '#fff',
                background: '#16a34a',
                borderRadius: 4,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              + Reference
            </button>
          )}
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af' }}>
          {cls.eAttributes.length} attribute{cls.eAttributes.length !== 1 ? 's' : ''},{' '}
          {cls.eReferences.length} reference{cls.eReferences.length !== 1 ? 's' : ''}
        </div>
      </Section>
    </div>
  );
};

const AttributeForm: React.FC<{
  attr: SerializableEAttribute;
  onChange: (updates: Partial<SerializableEAttribute>) => void;
}> = ({ attr, onChange }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <Section title="General">
      <TextInput label="Name" value={attr.name} onChange={(v) => onChange({ name: v })} />
      <SelectInput
        label="eType"
        value={attr.eType}
        options={STANDARD_DATATYPES.map((t) => ({ value: t, label: t }))}
        onChange={(v) => onChange({ eType: v })}
      />
    </Section>

    <Section title="Bounds">
      <div style={{ display: 'flex', gap: 12 }}>
        <TextInput
          label="Lower Bound"
          value={boundDisplay(attr.lowerBound)}
          onChange={(v) => onChange({ lowerBound: parseBound(v) })}
        />
        <TextInput
          label="Upper Bound"
          value={boundDisplay(attr.upperBound)}
          onChange={(v) => onChange({ upperBound: parseBound(v) })}
        />
      </div>
    </Section>

    <Section title="Options">
      <Checkbox label="ID" checked={attr.iD} onChange={(v) => onChange({ iD: v })} />
      <Checkbox label="Changeable" checked={attr.changeable} onChange={(v) => onChange({ changeable: v })} />
      <Checkbox label="Derived" checked={attr.derived} onChange={(v) => onChange({ derived: v })} />
      <Checkbox label="Transient" checked={attr.transient} onChange={(v) => onChange({ transient: v })} />
    </Section>

    <Section title="Default">
      <TextInput
        label="Default Value Literal"
        value={attr.defaultValueLiteral}
        onChange={(v) => onChange({ defaultValueLiteral: v })}
        placeholder="(empty)"
      />
    </Section>
  </div>
);

const ReferenceForm: React.FC<{
  ref: SerializableEReference;
  pkg: SerializableEPackage;
  onChange: (updates: Partial<SerializableEReference>) => void;
}> = ({ ref, pkg, onChange }) => {
  const targetOptions = useMemo(
    () =>
      pkg.eClassifiers
        .filter((c) => isEClass(c))
        .map((c) => ({ value: c.id, label: c.name })),
    [pkg],
  );

  const currentTarget = pkg.eClassifiers.find((c) => c.id === ref.targetId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Section title="General">
        <TextInput label="Name" value={ref.name} onChange={(v) => onChange({ name: v })} />
        <SelectInput
          label="Target Type"
          value={ref.targetId}
          options={targetOptions}
          onChange={(v) => onChange({ targetId: v })}
        />
        {currentTarget && (
          <p style={{ fontSize: 11, color: '#9ca3af' }}>
            → {currentTarget.name} ({ref.targetId.slice(0, 12)}…)
          </p>
        )}
      </Section>

      <Section title="Bounds">
        <div style={{ display: 'flex', gap: 12 }}>
          <TextInput
            label="Lower Bound"
            value={boundDisplay(ref.lowerBound)}
            onChange={(v) => onChange({ lowerBound: parseBound(v) })}
          />
          <TextInput
            label="Upper Bound"
            value={boundDisplay(ref.upperBound)}
            onChange={(v) => onChange({ upperBound: parseBound(v) })}
          />
        </div>
      </Section>

      <Section title="Options">
        <Checkbox label="Containment" checked={ref.containment} onChange={(v) => onChange({ containment: v })} />
        <Checkbox label="Changeable" checked={ref.changeable} onChange={(v) => onChange({ changeable: v })} />
        <Checkbox label="Derived" checked={ref.derived} onChange={(v) => onChange({ derived: v })} />
      </Section>

      {ref.eOpposite && (
        <Section title="Opposite">
          <p style={{ fontSize: 11, color: '#4b5563' }}>
            eOpposite: <code style={{ background: '#f3f4f6', padding: '0 4px', borderRadius: 4 }}>{ref.eOpposite}</code>
          </p>
        </Section>
      )}
    </div>
  );
};

const EnumForm: React.FC<{
  enm: SerializableEEnum;
  onChange: (updates: Partial<SerializableEEnum>) => void;
}> = ({ enm, onChange }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <Section title="General">
      <TextInput label="Name" value={enm.name} onChange={(v) => onChange({ name: v })} />
    </Section>

    <Section title="Literals">
      {enm.eLiterals.length === 0 && (
        <p style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>No literals defined</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {enm.eLiterals.map((lit) => (
          <div
            key={lit.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 8px',
              fontSize: 11,
              background: '#f9fafb',
              borderRadius: 4,
              border: '1px solid #e5e7eb',
            }}
          >
            <span style={{ fontFamily: 'monospace', color: '#6b7280' }}>{lit.value}</span>
            <span style={{ color: '#374151' }}>{lit.name}</span>
          </div>
        ))}
      </div>
    </Section>
  </div>
);

const DataTypeForm: React.FC<{
  dt: SerializableEDataType;
  onChange: (updates: Partial<SerializableEDataType>) => void;
}> = ({ dt, onChange }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <Section title="General">
      <TextInput label="Name" value={dt.name} onChange={(v) => onChange({ name: v })} />
      <TextInput
        label="Instance Class Name"
        value={dt.instanceClassName}
        onChange={(v) => onChange({ instanceClassName: v })}
        placeholder="java.lang.String"
      />
      <Checkbox label="Serializable" checked={dt.serializable} onChange={(v) => onChange({ serializable: v })} />
    </Section>
  </div>
);

const EdgeForm: React.FC<{
  edgeId: string;
  pkg: SerializableEPackage;
}> = ({ edgeId, pkg }) => {
  // Parse edge id: ref_<refId> or inh_<sourceId>_<targetId>
  const refMatch = edgeId.match(/^ref_(.+)/);
  const inhMatch = edgeId.match(/^inh_(.+)_(.+)/);

  const ref = refMatch
    ? (() => {
        for (const c of pkg.eClassifiers) {
          if (isEClass(c)) {
            const found = c.eReferences.find((r) => r.id === refMatch[1]);
            if (found) return { ref: found, className: c.name };
          }
        }
        return null;
      })()
    : null;

  const inheritance = inhMatch
    ? {
        sourceId: inhMatch[1],
        targetId: inhMatch[2],
        sourceName: pkg.eClassifiers.find((c) => c.id === inhMatch[1])?.name ?? inhMatch[1],
        targetName: pkg.eClassifiers.find((c) => c.id === inhMatch[2])?.name ?? inhMatch[2],
      }
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Section title="Edge">
        <div style={{ fontSize: 11, color: '#6b7280', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p>
            <span style={{ fontWeight: 500 }}>ID:</span>{' '}
            <code style={{ background: '#f3f4f6', padding: '0 4px', borderRadius: 4 }}>{edgeId}</code>
          </p>
          {ref && (
            <>
              <p>
                <span style={{ fontWeight: 500 }}>Type:</span> Reference
              </p>
              <p>
                <span style={{ fontWeight: 500 }}>Name:</span> {ref.ref.name}
              </p>
              <p>
                <span style={{ fontWeight: 500 }}>From:</span> {ref.className}
              </p>
              <p>
                <span style={{ fontWeight: 500 }}>To:</span>{' '}
                {pkg.eClassifiers.find((c) => c.id === ref.ref.targetId)?.name ?? ref.ref.targetId}
              </p>
              <p>
                <span style={{ fontWeight: 500 }}>Containment:</span>{' '}
                {ref.ref.containment ? 'Yes' : 'No'}
              </p>
            </>
          )}
          {inheritance && (
            <>
              <p>
                <span style={{ fontWeight: 500 }}>Type:</span> Inheritance
              </p>
              <p>
                <span style={{ fontWeight: 500 }}>From:</span> {inheritance.sourceName}
              </p>
              <p>
                <span style={{ fontWeight: 500 }}>To:</span> {inheritance.targetName}
              </p>
            </>
          )}
        </div>
      </Section>
    </div>
  );
};

const NoSelection: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af' }}>
    <svg style={{ width: 40, height: 40, marginBottom: 8 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M15 15l-2 5H9l2-5m4.5-4.5a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
    <p style={{ fontSize: 14 }}>Select an element</p>
    <p style={{ fontSize: 11 }}>to inspect its properties</p>
  </div>
);

// ── Main Component ──────────────────────────────────────────────

export const PropertyInspector: React.FC<PropertyInspectorProps> = ({
  selectedId,
  selectedType,
  pkg,
  onClassifierChange,
  onAddAttribute,
  onAddReference,
}) => {
  // Encontrar el elemento seleccionado en el modelo
  const { classifier, attribute, reference } = useMemo(() => {
    if (!selectedId || !selectedType) return { classifier: null, attribute: null, reference: null };

    // Para edges, no hay classifier asociado
    if (selectedType === 'edge') return { classifier: null, attribute: null, reference: null };

    // Buscar classifier por ID
    const cls = pkg.eClassifiers.find((c) => c.id === selectedId) ?? null;

    if (selectedType === 'attribute' || selectedType === 'reference') {
      // Buscar dentro de EClasses
      for (const c of pkg.eClassifiers) {
        if (isEClass(c)) {
          if (selectedType === 'attribute') {
            const attr = c.eAttributes.find((a) => a.id === selectedId);
            if (attr) return { classifier: c, attribute: attr, reference: null };
          } else {
            const ref = c.eReferences.find((r) => r.id === selectedId);
            if (ref) return { classifier: c, attribute: null, reference: ref };
          }
        }
      }
    }

    return { classifier: cls, attribute: null, reference: null };
  }, [selectedId, selectedType, pkg]);

  // ── Handlers específicos (MUST be before early returns!) ──
  const handleClassifierChange = useCallback(
    (updates: Partial<SerializableEClass | SerializableEEnum | SerializableEDataType>) => {
      if (classifier) {
        onClassifierChange(classifier.id, updates);
      }
    },
    [classifier, onClassifierChange],
  );

  const handleAttributeChange = useCallback(
    (updates: Partial<SerializableEAttribute>) => {
      if (classifier && attribute && isEClass(classifier)) {
        const newAttributes = classifier.eAttributes.map((a) =>
          a.id === attribute.id ? { ...a, ...updates } : a,
        );
        onClassifierChange(classifier.id, { eAttributes: newAttributes } as Partial<SerializableEClass>);
      }
    },
    [classifier, attribute, onClassifierChange],
  );

  const handleReferenceChange = useCallback(
    (updates: Partial<SerializableEReference>) => {
      if (classifier && reference && isEClass(classifier)) {
        const newReferences = classifier.eReferences.map((r) =>
          r.id === reference.id ? { ...r, ...updates } : r,
        );
        onClassifierChange(classifier.id, { eReferences: newReferences } as Partial<SerializableEClass>);
      }
    },
    [classifier, reference, onClassifierChange],
  );

  // Renderizar formulario según tipo
  const renderForm = () => {
    switch (selectedType) {
      case 'class':
        return classifier && isEClass(classifier) ? (
          <EClassForm
            cls={classifier}
            pkg={pkg}
            onChange={handleClassifierChange}
            onAddAttribute={onAddAttribute}
            onAddReference={onAddReference}
          />
        ) : (
          <p style={{ fontSize: 13, color: '#ef4444' }}>Selected element is not a class</p>
        );

      case 'attribute':
        return attribute ? (
          <AttributeForm attr={attribute} onChange={handleAttributeChange} />
        ) : (
          <p style={{ fontSize: 13, color: '#ef4444' }}>Attribute not found</p>
        );

      case 'reference':
        return reference ? (
          <ReferenceForm ref={reference} pkg={pkg} onChange={handleReferenceChange} />
        ) : (
          <p style={{ fontSize: 13, color: '#ef4444' }}>Reference not found</p>
        );

      case 'enum':
        return classifier && isEEnum(classifier) ? (
          <EnumForm enm={classifier} onChange={handleClassifierChange} />
        ) : (
          <p style={{ fontSize: 13, color: '#ef4444' }}>Selected element is not an enum</p>
        );

      case 'dataType':
        return classifier && isEDataType(classifier) ? (
          <DataTypeForm dt={classifier} onChange={handleClassifierChange} />
        ) : (
          <p style={{ fontSize: 13, color: '#ef4444' }}>Selected element is not a data type</p>
        );

      case 'edge':
        return selectedId ? <EdgeForm edgeId={selectedId} pkg={pkg} /> : null;

      default:
        return <NoSelection />;
    }
  };

  return (
    <div style={{ width: 320, background: '#fff', borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(to right, #f9fafb, #fff)' }}>
        <h2 style={{
          fontSize: 13,
          fontWeight: 600,
          color: '#374151',
          textTransform: 'uppercase',
          letterSpacing: '0.025em',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <svg style={{ width: 16, height: 16, color: '#6366f1' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Properties
        </h2>
        {classifier && (
          <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {classifier.name}
            {selectedType !== 'class' && selectedType !== 'enum' && selectedType !== 'dataType' && (
              <> · {selectedType}</>
            )}
          </p>
        )}
      </div>

      {/* Form */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {!selectedId || !selectedType ? <NoSelection /> : renderForm()}
      </div>
    </div>
  );
};

export default PropertyInspector;
