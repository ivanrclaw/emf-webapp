/**
 * @emf-webapp/frontend — model-import
 *
 * Import utilities for M1 models: JSON and XMI formats.
 */

interface SemanticObject {
  id: string;
  eClass: string;
  attributes: Record<string, unknown>;
  references: Record<string, string[]>;
}

interface ImportResult {
  objects: SemanticObject[];
  positions: Record<string, { x: number; y: number }>;
  error?: string;
}

/* ------------------------------------------------------------------ */
/*  JSON Import                                                        */
/* ------------------------------------------------------------------ */

export function importJSON(content: string): ImportResult {
  try {
    const data = JSON.parse(content);

    // Support both formats: { objects, positions } or just array of objects
    if (Array.isArray(data)) {
      return {
        objects: data.map(normalizeObject),
        positions: {},
      };
    }

    if (data.objects && Array.isArray(data.objects)) {
      return {
        objects: data.objects.map(normalizeObject),
        positions: data.positions || {},
      };
    }

    return { objects: [], positions: {}, error: 'Invalid JSON format: expected { objects: [...] } or array' };
  } catch (e) {
    return { objects: [], positions: {}, error: `JSON parse error: ${(e as Error).message}` };
  }
}

/* ------------------------------------------------------------------ */
/*  XMI Import                                                         */
/* ------------------------------------------------------------------ */

export function importXMI(content: string): ImportResult {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/xml');

    // Check for parse errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      return { objects: [], positions: {}, error: `XMI parse error: ${parseError.textContent?.slice(0, 100)}` };
    }

    const objects: SemanticObject[] = [];
    const root = doc.documentElement;

    // Get namespace prefix for xsi:type
    const children = root.children;
    for (let i = 0; i < children.length; i++) {
      const el = children[i];
      const obj = parseXMIElement(el);
      if (obj) objects.push(obj);
    }

    // Auto-layout positions (grid)
    const positions: Record<string, { x: number; y: number }> = {};
    const cols = Math.ceil(Math.sqrt(objects.length));
    objects.forEach((obj, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      positions[obj.id] = { x: 100 + col * 200, y: 100 + row * 150 };
    });

    return { objects, positions };
  } catch (e) {
    return { objects: [], positions: {}, error: `XMI import error: ${(e as Error).message}` };
  }
}

function parseXMIElement(el: Element): SemanticObject | null {
  // Determine eClass from xsi:type or tag name
  const xsiType = el.getAttribute('xsi:type');
  let eClass = el.tagName;
  if (xsiType) {
    // xsi:type="prefix:ClassName" → extract ClassName
    const parts = xsiType.split(':');
    eClass = parts.length > 1 ? parts[1] : parts[0];
  }

  // Get or generate ID
  const id = el.getAttribute('xmi:id') || el.getAttribute('id') || `obj_${Math.random().toString(36).slice(2, 10)}`;

  // Parse attributes (non-namespace, non-id attributes)
  const attributes: Record<string, unknown> = {};
  const references: Record<string, string[]> = {};
  const skipAttrs = new Set(['xmi:id', 'xsi:type', 'xmlns', 'id']);

  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes[i];
    if (skipAttrs.has(attr.name) || attr.name.startsWith('xmlns:')) continue;

    const value = attr.value;
    // Heuristic: if value contains spaces, it might be a multi-valued reference
    if (value.includes(' ') && !value.includes('"')) {
      references[attr.name] = value.split(/\s+/);
    } else {
      attributes[attr.name] = value;
    }
  }

  return { id, eClass, attributes, references };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function normalizeObject(obj: any): SemanticObject {
  return {
    id: obj.id || `obj_${Math.random().toString(36).slice(2, 10)}`,
    eClass: obj.eClass || obj.type || 'Unknown',
    attributes: obj.attributes || {},
    references: obj.references || {},
  };
}

/* ------------------------------------------------------------------ */
/*  File Reader Helper                                                 */
/* ------------------------------------------------------------------ */

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Detect format from file extension or content.
 */
export function detectFormat(filename: string, content: string): 'json' | 'xmi' | 'unknown' {
  if (filename.endsWith('.json')) return 'json';
  if (filename.endsWith('.xmi') || filename.endsWith('.xml')) return 'xmi';
  // Try to detect from content
  const trimmed = content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  if (trimmed.startsWith('<?xml') || trimmed.startsWith('<xmi:')) return 'xmi';
  return 'unknown';
}
