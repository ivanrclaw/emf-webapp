/**
 * OCLConformance — Reglas de conformidad de tipos OCL 2.4
 *
 * Implementa las reglas del estándar OMG:
 * 1. Reflexiva: T conforms to T
 * 2. Integer conforms to Real
 * 3. UnlimitedNatural conforms to Integer
 * 4. OclVoid conforms to all (except OclInvalid)
 * 5. OclInvalid conforms to all (including OclVoid)
 * 6. All user classes conform to OclAny
 * 7. Covariance: Set(T2) conforms to Set(T1) if T2 conforms to T1
 * 8. Tuple conformance: same part names, conforming types
 * 9. Transitivity
 */
import { OCLType } from './OCLTypes.js';
/**
 * Optional class hierarchy for resolving inheritance.
 * Maps class name → list of direct supertype names.
 */
export type ClassHierarchy = Map<string, string[]>;
/**
 * Check if typeA conforms to typeB (i.e., typeA is assignable to typeB).
 *
 * "A conforms to B" means: wherever B is expected, A can be used.
 */
export declare function conformsTo(typeA: OCLType, typeB: OCLType, hierarchy?: ClassHierarchy): boolean;
/**
 * Find the most specific common supertype of two types.
 * Used for type inference in if-then-else, collection unions, etc.
 */
export declare function commonSupertype(a: OCLType, b: OCLType, hierarchy?: ClassHierarchy): OCLType;
//# sourceMappingURL=OCLConformance.d.ts.map