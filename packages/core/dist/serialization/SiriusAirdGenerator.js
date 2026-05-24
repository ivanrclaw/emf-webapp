/**
 * @emf-webapp/core — SiriusAirdGenerator
 *
 * Generates Eclipse Sirius .aird (Analysis/Representation) files.
 * The .aird file stores:
 *   - References to semantic resources (.ecore, .xmi)
 *   - Viewpoint activations
 *   - Diagram representations (layout, visibility state)
 *
 * This generates a minimal .aird that references the model and activates
 * the viewpoint defined in the .odesign file.
 *
 * Namespace: http://www.eclipse.org/sirius/1.1.0
 */
// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════
const SIRIUS_NS = 'http://www.eclipse.org/sirius/1.1.0';
const SIRIUS_DIAG_NS = 'http://www.eclipse.org/sirius/diagram/1.1.0';
const VIEWPOINT_NS = 'http://www.eclipse.org/sirius/description/1.1.0';
const XMI_NS = 'http://www.omg.org/XMI';
const NOTATION_NS = 'http://www.eclipse.org/gmf/runtime/1.0.3/notation';
// ═══════════════════════════════════════════════════════════════
// Main Generator
// ═══════════════════════════════════════════════════════════════
/**
 * Generates a minimal Sirius .aird file.
 *
 * This creates a valid .aird that:
 * 1. References the semantic model (.xmi or .ecore)
 * 2. Activates the specified viewpoint
 * 3. Contains a blank diagram representation ready to be opened in Sirius
 */
export function generateAird(options) {
    const repName = options.representationName || `${options.diagramName} diagram`;
    const lines = [];
    // XML header
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    // Root: xmi:XMI wrapper (Sirius .aird uses XMI wrapper for multiple root elements)
    lines.push(`<xmi:XMI xmi:version="2.0"`);
    lines.push(`    xmlns:xmi="${XMI_NS}"`);
    lines.push(`    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`);
    lines.push(`    xmlns:description="${VIEWPOINT_NS}"`);
    lines.push(`    xmlns:diagram="${SIRIUS_DIAG_NS}"`);
    lines.push(`    xmlns:notation="${NOTATION_NS}"`);
    lines.push(`    xmlns:viewpoint="${SIRIUS_NS}">`);
    // DAnalysis — the main analysis element
    lines.push(`  <viewpoint:DAnalysis`);
    lines.push(`      selectedViews="//@ownedViews.0"`);
    lines.push(`      version="14.5.1.202311011200">`);
    // Semantic resources
    lines.push(`    <semanticResources>${escapeXml(options.semanticModelPath)}</semanticResources>`);
    lines.push(`    <semanticResources>${escapeXml(options.ecorePath)}</semanticResources>`);
    // Owned views (viewpoint activation)
    lines.push(`    <ownedViews>`);
    lines.push(`      <viewpoint xsi:type="description:Viewpoint"`);
    lines.push(`          href="${escapeXml(options.odesignPath)}#/${escapeXml(options.viewpointName)}"/>`);
    // Owned representation descriptors
    lines.push(`      <ownedRepresentationDescriptors xsi:type="viewpoint:DRepresentationDescriptor"`);
    lines.push(`          name="${escapeXml(repName)}"`);
    lines.push(`          repPath="//@ownedViews.0/@ownedRepresentations.0"/>`);
    // Owned representations (the actual diagram)
    lines.push(`      <ownedRepresentations xsi:type="diagram:DSemanticDiagram"`);
    lines.push(`          name="${escapeXml(repName)}">`);
    lines.push(`        <description xsi:type="description:DiagramDescription"`);
    lines.push(`            href="${escapeXml(options.odesignPath)}#//@ownedViewpoints.0/@ownedRepresentations.0"/>`);
    lines.push(`      </ownedRepresentations>`);
    lines.push(`    </ownedViews>`);
    // Close DAnalysis
    lines.push(`  </viewpoint:DAnalysis>`);
    // Close XMI wrapper
    lines.push(`</xmi:XMI>`);
    lines.push('');
    return lines.join('\n');
}
// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════
function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
//# sourceMappingURL=SiriusAirdGenerator.js.map