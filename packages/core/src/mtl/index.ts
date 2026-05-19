/**
 * @emf-webapp/core — MTL Module
 *
 * Exporta el motor de plantillas MTL (Acceleo/MTL-like) para generación
 * de código/texto a partir de instancias de modelos EMF.
 */

export type {
  MTLNode,
  MTLModule,
  MTLTemplate,
  MTLQuery,
  MTLFile,
  MTLText,
  MTLExpression,
  MTLFor,
  MTLIf,
  MTLElseIf,
  MTLLet,
  MTLProtectedArea,
  MTLComment,
  MTLTrace,
  Visibility,
  MTLParam,
  MTLExecutionResult,
  ExecutionLogEntry,
  TraceEntry,
} from './MTLTypes.js';

export { MTLParser } from './MTLParser.js';
export { MTLExecutor } from './MTLExecutor.js';
export { MTLFileManager } from './MTLFileManager.js';
export type { GeneratedFile } from './MTLFileManager.js';
