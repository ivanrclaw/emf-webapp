/**
 * Web Worker for MTL diagnostic analysis.
 * Offloads template validation from the main thread.
 */
import { MTLDiagnosticEngine } from './MTLDiagnosticEngine';
import { MetamodelSchemaProvider } from './MetamodelSchemaProvider';

let engine: MTLDiagnosticEngine | null = null;

export interface DiagnosticWorkerMessage {
  type: 'analyze' | 'updateSchema';
  content?: string;
  fileId?: string;
  metamodelContent?: Record<string, unknown> | null;
}

export interface DiagnosticWorkerResult {
  type: 'diagnostics';
  fileId: string;
  diagnostics: Array<{
    line: number;
    col: number;
    endLine: number;
    endCol: number;
    message: string;
    severity: 'error' | 'warning' | 'info';
    code?: string;
  }>;
}

self.onmessage = (e: MessageEvent<DiagnosticWorkerMessage>) => {
  try {
    const { type } = e.data;

    if (type === 'updateSchema') {
      const schema = e.data.metamodelContent
        ? new MetamodelSchemaProvider(e.data.metamodelContent)
        : null;
      if (engine) {
        engine.updateSchema(schema);
      } else {
        engine = new MTLDiagnosticEngine(schema, null);
      }
      return;
    }

    if (type === 'analyze') {
      if (!engine) {
        engine = new MTLDiagnosticEngine(null, null);
      }

      const { content, fileId } = e.data;
      if (!content || !fileId) return;

      const diagnostics = engine.analyze(content, fileId);

      const result: DiagnosticWorkerResult = {
        type: 'diagnostics',
        fileId,
        diagnostics,
      };

      self.postMessage(result);
    }
  } catch (err) {
    // Silently catch worker errors to prevent crashes
    // The main thread will fall back to sync diagnostics
    console.error('[MTL Worker] Error processing message:', err);
    self.postMessage({
      type: 'diagnostics',
      fileId: '',
      diagnostics: [],
    } as DiagnosticWorkerResult);
  }
};
