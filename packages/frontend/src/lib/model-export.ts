/**
 * @emf-webapp/frontend — model-export
 *
 * Export utilities for M1 models: JSON, XMI, SVG, PNG.
 */

interface SemanticObject {
  id: string;
  eClass: string;
  attributes: Record<string, unknown>;
  references: Record<string, string[]>;
}

interface ExportOptions {
  objects: SemanticObject[];
  positions: Record<string, { x: number; y: number }>;
  metamodelName?: string;
  metamodelNsUri?: string;
  modelName?: string;
}

/* ------------------------------------------------------------------ */
/*  JSON Export                                                         */
/* ------------------------------------------------------------------ */

export function exportJSON(options: ExportOptions): string {
  return JSON.stringify({
    modelName: options.modelName || 'Model',
    metamodel: options.metamodelName || 'Unknown',
    exportedAt: new Date().toISOString(),
    objects: options.objects,
    positions: options.positions,
  }, null, 2);
}

/* ------------------------------------------------------------------ */
/*  XMI Export                                                         */
/* ------------------------------------------------------------------ */

export function exportXMI(options: ExportOptions): string {
  const nsUri = options.metamodelNsUri || 'http://www.example.org/metamodel';
  const nsPrefix = options.metamodelName?.toLowerCase() || 'model';

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<xmi:XMI xmi:version="2.0"`,
    `  xmlns:xmi="http://www.omg.org/XMI"`,
    `  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`,
    `  xmlns:${nsPrefix}="${nsUri}">`,
  ];

  // Build containment tree
  const contained = new Set<string>();
  for (const obj of options.objects) {
    for (const targets of Object.values(obj.references)) {
      for (const t of targets) {
        // Mark as contained if the reference is containment
        // (simplified: we treat all refs as potential containment for XMI)
      }
    }
  }

  for (const obj of options.objects) {
    const attrs = Object.entries(obj.attributes)
      .filter(([_, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${k}="${escapeXml(String(v))}"`)
      .join(' ');

    const refs = Object.entries(obj.references)
      .filter(([_, targets]) => targets.length > 0)
      .map(([refName, targets]) => `${refName}="${targets.join(' ')}"`)
      .join(' ');

    const allAttrs = [
      `xmi:id="${obj.id}"`,
      `xsi:type="${nsPrefix}:${obj.eClass}"`,
      attrs,
      refs,
    ].filter(Boolean).join(' ');

    lines.push(`  <${obj.eClass} ${allAttrs}/>`);
  }

  lines.push('</xmi:XMI>');
  return lines.join('\n');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/* ------------------------------------------------------------------ */
/*  SVG Export                                                         */
/* ------------------------------------------------------------------ */

export function exportSVG(): string | null {
  const viewport = document.querySelector('.react-flow__viewport');
  if (!viewport) return null;

  const svgEl = viewport.cloneNode(true) as Element;
  const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  wrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  wrapper.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  // Get bounding box
  const nodes = document.querySelectorAll('.react-flow__node');
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach((node) => {
    const rect = node.getBoundingClientRect();
    const flowRect = document.querySelector('.react-flow')?.getBoundingClientRect();
    if (flowRect) {
      const x = rect.left - flowRect.left;
      const y = rect.top - flowRect.top;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + rect.width);
      maxY = Math.max(maxY, y + rect.height);
    }
  });

  const padding = 40;
  const width = Math.max(maxX - minX + padding * 2, 800);
  const height = Math.max(maxY - minY + padding * 2, 600);

  wrapper.setAttribute('width', String(width));
  wrapper.setAttribute('height', String(height));
  wrapper.setAttribute('viewBox', `0 0 ${width} ${height}`);

  // Add background
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', '100%');
  bg.setAttribute('height', '100%');
  bg.setAttribute('fill', '#0f0f14');
  wrapper.appendChild(bg);
  wrapper.appendChild(svgEl);

  return wrapper.outerHTML;
}

/* ------------------------------------------------------------------ */
/*  PNG Export                                                          */
/* ------------------------------------------------------------------ */

export async function exportPNG(): Promise<Blob | null> {
  const svgString = exportSVG();
  if (!svgString) return null;

  return new Promise((resolve) => {
    const img = new Image();
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width * 2; // 2x for retina
      canvas.height = img.height * 2;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((pngBlob) => {
          URL.revokeObjectURL(url);
          resolve(pngBlob);
        }, 'image/png');
      } else {
        URL.revokeObjectURL(url);
        resolve(null);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
}

/* ------------------------------------------------------------------ */
/*  Download Helper                                                     */
/* ------------------------------------------------------------------ */

export function downloadBlob(content: string | Blob, filename: string, mimeType?: string) {
  const blob = typeof content === 'string'
    ? new Blob([content], { type: mimeType || 'text/plain' })
    : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
