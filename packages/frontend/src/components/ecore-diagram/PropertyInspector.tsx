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
  <div className="flex flex-col gap-1">
    <label className="text-xs font-medium text-gray-500">{label}</label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded
                 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500
                 bg-white"
    />
  </div>
);

/** Checkbox controlado */
const Checkbox: React.FC<{
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
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
  <div className="flex flex-col gap-1">
    <label className="text-xs font-medium text-gray-500">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded
                 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500
                 bg-white"
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
  <div className="border-b border-gray-200 pb-3 mb-3 last:border-b-0 last:mb-0 last:pb-0">
    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{title}</h4>
    <div className="space-y-2">{children}</div>
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
    <div className="space-y-3">
      <Section title="General">
        <TextInput label="Name" value={cls.name} onChange={(v) => onChange({ name: v })} />
        <div className="flex gap-4">
          <Checkbox label="Abstract" checked={cls.abstract} onChange={(v) => onChange({ abstract: v })} />
          <Checkbox label="Interface" checked={cls.interface} onChange={(v) => onChange({ interface: v })} />
        </div>
      </Section>

      <Section title="Super Types">
        {cls.eSuperTypes.length === 0 && (
          <p className="text-xs text-gray-400 italic">No super types</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {cls.eSuperTypes.map((superId) => {
            const superCls = pkg.eClassifiers.find((c) => c.id === superId);
            return (
              <span
                key={superId}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs
                           bg-blue-50 text-blue-700 rounded-full border border-blue-200"
              >
                {superCls?.name ?? superId}
                <button
                  type="button"
                  onClick={() => removeSuperType(superId)}
                  className="text-blue-400 hover:text-blue-700 font-bold leading-none"
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
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded
                       focus:outline-none focus:ring-1 focus:ring-blue-500
                       bg-white mt-1"
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
        <div className="flex gap-2">
          {onAddAttribute && (
            <button
              type="button"
              onClick={() => onAddAttribute(cls.id)}
              className="flex-1 px-2 py-1.5 text-xs font-medium text-white bg-blue-600
                         rounded hover:bg-blue-700 transition-colors"
            >
              + Attribute
            </button>
          )}
          {onAddReference && (
            <button
              type="button"
              onClick={() => onAddReference(cls.id)}
              className="flex-1 px-2 py-1.5 text-xs font-medium text-white bg-green-600
                         rounded hover:bg-green-700 transition-colors"
            >
              + Reference
            </button>
          )}
        </div>
        <div className="text-xs text-gray-400">
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
  <div className="space-y-3">
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
      <div className="flex gap-3">
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
    <div className="space-y-3">
      <Section title="General">
        <TextInput label="Name" value={ref.name} onChange={(v) => onChange({ name: v })} />
        <SelectInput
          label="Target Type"
          value={ref.targetId}
          options={targetOptions}
          onChange={(v) => onChange({ targetId: v })}
        />
        {currentTarget && (
          <p className="text-xs text-gray-400">
            → {currentTarget.name} ({ref.targetId.slice(0, 12)}…)
          </p>
        )}
      </Section>

      <Section title="Bounds">
        <div className="flex gap-3">
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
          <p className="text-xs text-gray-600">
            eOpposite: <code className="bg-gray-100 px-1 rounded">{ref.eOpposite}</code>
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
  <div className="space-y-3">
    <Section title="General">
      <TextInput label="Name" value={enm.name} onChange={(v) => onChange({ name: v })} />
    </Section>

    <Section title="Literals">
      {enm.eLiterals.length === 0 && (
        <p className="text-xs text-gray-400 italic">No literals defined</p>
      )}
      <div className="space-y-1">
        {enm.eLiterals.map((lit) => (
          <div
            key={lit.id}
            className="flex items-center gap-2 px-2 py-1 text-xs bg-gray-50 rounded border border-gray-200"
          >
            <span className="font-mono text-gray-500">{lit.value}</span>
            <span className="text-gray-700">{lit.name}</span>
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
  <div className="space-y-3">
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
    <div className="space-y-3">
      <Section title="Edge">
        <div className="text-xs text-gray-500 space-y-2">
          <p>
            <span className="font-medium">ID:</span>{' '}
            <code className="bg-gray-100 px-1 rounded">{edgeId}</code>
          </p>
          {ref && (
            <>
              <p>
                <span className="font-medium">Type:</span> Reference
              </p>
              <p>
                <span className="font-medium">Name:</span> {ref.ref.name}
              </p>
              <p>
                <span className="font-medium">From:</span> {ref.className}
              </p>
              <p>
                <span className="font-medium">To:</span>{' '}
                {pkg.eClassifiers.find((c) => c.id === ref.ref.targetId)?.name ?? ref.ref.targetId}
              </p>
              <p>
                <span className="font-medium">Containment:</span>{' '}
                {ref.ref.containment ? 'Yes' : 'No'}
              </p>
            </>
          )}
          {inheritance && (
            <>
              <p>
                <span className="font-medium">Type:</span> Inheritance
              </p>
              <p>
                <span className="font-medium">From:</span> {inheritance.sourceName}
              </p>
              <p>
                <span className="font-medium">To:</span> {inheritance.targetName}
              </p>
            </>
          )}
        </div>
      </Section>
    </div>
  );
};

const NoSelection: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full text-gray-400">
    <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M15 15l-2 5H9l2-5m4.5-4.5a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
    <p className="text-sm">Select an element</p>
    <p className="text-xs">to inspect its properties</p>
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

  // Si no hay selección
  if (!selectedId || !selectedType) {
    return (
      <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Properties</h2>
        </div>
        <div className="flex-1 p-4">
          <NoSelection />
        </div>
      </div>
    );
  }

  // Handlers específicos
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
          <p className="text-sm text-red-500">Selected element is not a class</p>
        );

      case 'attribute':
        return attribute ? (
          <AttributeForm attr={attribute} onChange={handleAttributeChange} />
        ) : (
          <p className="text-sm text-red-500">Attribute not found</p>
        );

      case 'reference':
        return reference ? (
          <ReferenceForm ref={reference} pkg={pkg} onChange={handleReferenceChange} />
        ) : (
          <p className="text-sm text-red-500">Reference not found</p>
        );

      case 'enum':
        return classifier && isEEnum(classifier) ? (
          <EnumForm enm={classifier} onChange={handleClassifierChange} />
        ) : (
          <p className="text-sm text-red-500">Selected element is not an enum</p>
        );

      case 'dataType':
        return classifier && isEDataType(classifier) ? (
          <DataTypeForm dt={classifier} onChange={handleClassifierChange} />
        ) : (
          <p className="text-sm text-red-500">Selected element is not a data type</p>
        );

      case 'edge':
        return selectedId ? <EdgeForm edgeId={selectedId} pkg={pkg} /> : null;

      default:
        return <NoSelection />;
    }
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Properties</h2>
        {classifier && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">
            {classifier.name}
            {selectedType !== 'class' && selectedType !== 'enum' && selectedType !== 'dataType' && (
              <> · {selectedType}</>
            )}
          </p>
        )}
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4">{renderForm()}</div>
    </div>
  );
};

export default PropertyInspector;
