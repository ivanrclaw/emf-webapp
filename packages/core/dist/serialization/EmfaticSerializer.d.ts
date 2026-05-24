/**
 * @emf-webapp/core — EmfaticSerializer
 *
 * Serializes SerializableEPackage to Emfatic textual syntax and
 * parses Emfatic text back to SerializableEPackage.
 *
 * Emfatic is a human-readable textual syntax for Ecore metamodels
 * used by Eclipse EMF.
 */
import type { SerializableEPackage } from './SerializableToEcoreConverter.js';
/**
 * Converts a SerializableEPackage to Emfatic textual syntax.
 */
export declare function serializeToEmfatic(pkg: SerializableEPackage): string;
/**
 * Parses Emfatic textual syntax back to a SerializableEPackage.
 */
export declare function parseEmfatic(text: string): SerializableEPackage;
//# sourceMappingURL=EmfaticSerializer.d.ts.map