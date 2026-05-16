/**
 * @emf-webapp/core — XmiInstanceImporter
 *
 * Imports M1 .xmi instance files (model instances conforming to a metamodel)
 * and exports them back to valid XMI 2.0.
 *
 * Supported format (Eclipse EMF instance export):
 *   <prefix:ClassName xmi:version="2.0" xmlns:xmi="..." xmlns:prefix="nsURI" ...>
 *     <containmentRef xsi:type="prefix:Type" attr="value">
 *       <nonContainmentRef href="#//@feature.index"/>
 *     </containmentRef>
 *   </prefix:ClassName>
 */
import type { SerializableEPackage } from './SerializableToEcoreConverter.js';
export interface XmiInstance {
    eClass: string;
    attributes: Record<string, any>;
    references: Record<string, XmiInstanceRef[]>;
    children: Record<string, XmiInstance[]>;
}
export interface XmiInstanceRef {
    type: 'internal' | 'external';
    path: string;
}
export interface XmiInstanceDocument {
    root: XmiInstance;
    nsURI: string;
    nsPrefix: string;
    allInstances: XmiInstance[];
}
/**
 * Parses an XMI instance document and validates it against the provided metamodel.
 * @throws Error if the XML is invalid or doesn't conform to the metamodel
 */
export declare function importXmiInstance(xml: string, metamodel: SerializableEPackage): XmiInstanceDocument;
/**
 * Exports an XmiInstanceDocument to a valid XMI 2.0 string.
 */
export declare function exportXmiInstance(document: XmiInstanceDocument, metamodel: SerializableEPackage): string;
/**
 * Generates a fragment path for an instance within a document.
 * Format: #//@featureName.index
 */
export declare function generateFragmentPath(document: XmiInstanceDocument, target: XmiInstance): string;
/**
 * Resolves a fragment path to an XmiInstance within a document.
 * Supports paths like: #//@books.0, #//@authors.1
 */
export declare function resolveFragmentPath(document: XmiInstanceDocument, path: string): XmiInstance | null;
//# sourceMappingURL=XmiInstanceImporter.d.ts.map