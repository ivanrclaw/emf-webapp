/**
 * ImportResolver — Resolves [import] directives between project files.
 * Maintains an index of module names → file content, and provides:
 * - Module name resolution (including qualified path imports like common::utils)
 * - Public template/query extraction from imported modules
 * - Circular import detection
 * - Cross-file symbol lookup
 * - Module extends chain resolution and inherited symbol access
 */

export interface ModuleInfo {
  fileId: string;
  filename: string;
  moduleName: string;
  templates: TemplateSymbol[];
  queries: QuerySymbol[];
  imports: string[]; // module names this module imports
  extends?: string; // parent module name (if this module extends another)
}

export interface TemplateSymbol {
  name: string;
  visibility: 'public' | 'private' | 'protected';
  params: string; // e.g., "(c : EClass)"
  line: number;
}

export interface QuerySymbol {
  name: string;
  visibility: 'public' | 'private' | 'protected';
  params: string;
  returnType: string;
  line: number;
}

export interface ImportDiagnostic {
  line: number;
  col: number;
  endCol: number;
  message: string;
  severity: 'error' | 'warning';
  code: string;
}

export class ImportResolver {
  private modules: Map<string, ModuleInfo> = new Map(); // moduleName → ModuleInfo
  private qualifiedPaths: Map<string, ModuleInfo> = new Map(); // qualified::path → ModuleInfo
  private fileModules: Map<string, string> = new Map(); // fileId → moduleName

  /**
   * Update the index with all project files.
   * Call this whenever files change.
   */
  updateIndex(files: Array<{ id: string; filename: string; content: string }>): void {
    this.modules.clear();
    this.qualifiedPaths.clear();
    this.fileModules.clear();

    for (const file of files) {
      const info = this.parseModuleInfo(file.id, file.filename, file.content);
      if (info) {
        this.modules.set(info.moduleName, info);
        this.fileModules.set(file.id, info.moduleName);

        // Also index by qualified path: convert filename like "common/utils.mtl" → "common::utils"
        const qualifiedKey = file.filename.replace(/\.mtl$/, '').replace(/\//g, '::');
        this.qualifiedPaths.set(qualifiedKey, info);
      }
    }
  }

  /**
   * Get all modules available for import from a given file.
   */
  getAvailableModules(excludeFileId?: string): ModuleInfo[] {
    const result: ModuleInfo[] = [];
    this.modules.forEach((info) => {
      if (info.fileId !== excludeFileId) {
        result.push(info);
      }
    });
    return result;
  }

  /**
   * Resolve an import name to a module.
   * Supports: exact module name, filename without extension, and qualified paths (common::utils).
   */
  resolveImport(importName: string): ModuleInfo | null {
    // Try exact match by module name first
    if (this.modules.has(importName)) {
      return this.modules.get(importName)!;
    }

    // Try qualified path match (e.g., "common::utils" → key in qualifiedPaths)
    if (this.qualifiedPaths.has(importName)) {
      return this.qualifiedPaths.get(importName)!;
    }

    // Try converting :: to / and matching by filename
    if (importName.includes('::')) {
      const asPath = importName.replace(/::/g, '/') + '.mtl';
      let found: ModuleInfo | null = null;
      this.modules.forEach((info) => {
        if (found) return;
        if (info.filename === asPath) {
          found = info;
        }
      });
      if (found) return found;
    }

    // Try matching by filename (without extension)
    let found: ModuleInfo | null = null;
    this.modules.forEach((info) => {
      if (found) return;
      const baseName = info.filename.replace(/\.mtl$/, '');
      if (baseName === importName) {
        found = info;
      }
    });
    return found;
  }

  /**
   * Get the extends chain for a module (ordered list of ancestor module names).
   * Returns empty array if no extends, or if the chain is broken.
   */
  getExtendsChain(fileId: string): string[] {
    const chain: string[] = [];
    const visited = new Set<string>();
    const moduleName = this.fileModules.get(fileId);
    if (!moduleName) return chain;

    let current = this.modules.get(moduleName);
    if (!current) return chain;

    // Walk up the extends chain (skip the module itself)
    let parentName = current.extends;
    while (parentName) {
      if (visited.has(parentName)) break; // circular, stop
      visited.add(parentName);

      const parentModule = this.resolveImport(parentName);
      if (!parentModule) break; // unresolved parent, stop

      chain.push(parentModule.moduleName);
      parentName = parentModule.extends;
    }

    return chain;
  }

  /**
   * Get inherited symbols (public + protected) from parent modules in the extends chain.
   */
  getInheritedSymbols(fileId: string): { templates: TemplateSymbol[]; queries: QuerySymbol[] } {
    const templates: TemplateSymbol[] = [];
    const queries: QuerySymbol[] = [];
    const chain = this.getExtendsChain(fileId);

    for (const ancestorName of chain) {
      const ancestorModule = this.modules.get(ancestorName);
      if (!ancestorModule) continue;

      for (const t of ancestorModule.templates) {
        if (t.visibility === 'public' || t.visibility === 'protected') {
          templates.push(t);
        }
      }
      for (const q of ancestorModule.queries) {
        if (q.visibility === 'public' || q.visibility === 'protected') {
          queries.push(q);
        }
      }
    }

    return { templates, queries };
  }

  /**
   * Get accessible symbols from targetFileId as seen from fromFileId.
   * - Same module: ALL symbols
   * - Extends relationship: public + protected
   * - Import relationship: public only
   */
  getAccessibleSymbols(
    fromFileId: string,
    targetFileId: string,
  ): { templates: TemplateSymbol[]; queries: QuerySymbol[] } {
    const targetModuleName = this.fileModules.get(targetFileId);
    if (!targetModuleName) return { templates: [], queries: [] };

    const targetModule = this.modules.get(targetModuleName);
    if (!targetModule) return { templates: [], queries: [] };

    // Same module — all symbols
    if (fromFileId === targetFileId) {
      return { templates: [...targetModule.templates], queries: [...targetModule.queries] };
    }

    // Check if fromFileId extends targetFileId (directly or transitively)
    const extendsChain = this.getExtendsChain(fromFileId);
    const isExtending = extendsChain.includes(targetModuleName);

    if (isExtending) {
      // public + protected
      return {
        templates: targetModule.templates.filter((t) => t.visibility !== 'private'),
        queries: targetModule.queries.filter((q) => q.visibility !== 'private'),
      };
    }

    // Import relationship — public only
    return {
      templates: targetModule.templates.filter((t) => t.visibility === 'public'),
      queries: targetModule.queries.filter((q) => q.visibility === 'public'),
    };
  }

  /**
   * Get all public symbols available from imports in a given file.
   * Uses visibility-aware access rules (public for imports, public+protected for extends).
   */
  getImportedSymbols(
    fileContent: string,
    fileId: string,
  ): { templates: TemplateSymbol[]; queries: QuerySymbol[]; sourceFiles: Map<string, string> } {
    const imports = this.extractImports(fileContent);
    const templates: TemplateSymbol[] = [];
    const queries: QuerySymbol[] = [];
    const sourceFiles = new Map<string, string>(); // symbolName → filename

    for (const imp of imports) {
      const resolved = this.resolveImport(imp.name);
      if (resolved && resolved.fileId !== fileId) {
        const accessible = this.getAccessibleSymbols(fileId, resolved.fileId);
        for (const t of accessible.templates) {
          templates.push(t);
          sourceFiles.set(t.name, resolved.filename);
        }
        for (const q of accessible.queries) {
          queries.push(q);
          sourceFiles.set(q.name, resolved.filename);
        }
      }
    }

    // Also include inherited symbols from extends chain
    const inherited = this.getInheritedSymbols(fileId);
    const extendsChain = this.getExtendsChain(fileId);
    for (const t of inherited.templates) {
      if (!templates.some((existing) => existing.name === t.name)) {
        templates.push(t);
        // Find which ancestor provides this symbol
        for (const ancestorName of extendsChain) {
          const ancestor = this.modules.get(ancestorName);
          if (ancestor?.templates.some((at) => at.name === t.name)) {
            sourceFiles.set(t.name, ancestor.filename);
            break;
          }
        }
      }
    }
    for (const q of inherited.queries) {
      if (!queries.some((existing) => existing.name === q.name)) {
        queries.push(q);
        for (const ancestorName of extendsChain) {
          const ancestor = this.modules.get(ancestorName);
          if (ancestor?.queries.some((aq) => aq.name === q.name)) {
            sourceFiles.set(q.name, ancestor.filename);
            break;
          }
        }
      }
    }

    return { templates, queries, sourceFiles };
  }

  /**
   * Validate imports and extends in a file and return diagnostics.
   */
  validateImports(fileContent: string, fileId: string): ImportDiagnostic[] {
    const diagnostics: ImportDiagnostic[] = [];
    const imports = this.extractImports(fileContent);

    // Check for unresolved imports
    for (const imp of imports) {
      const resolved = this.resolveImport(imp.name);
      if (!resolved) {
        diagnostics.push({
          line: imp.line,
          col: imp.col,
          endCol: imp.col + imp.name.length,
          message: `Cannot resolve import '${imp.name}' — no module with that name found in the project`,
          severity: 'error',
          code: 'MTL104',
        });
      } else if (resolved.fileId === fileId) {
        diagnostics.push({
          line: imp.line,
          col: imp.col,
          endCol: imp.col + imp.name.length,
          message: `Module '${imp.name}' imports itself`,
          severity: 'warning',
          code: 'MTL105',
        });
      }
    }

    // Check for circular imports
    const moduleName = this.fileModules.get(fileId);
    if (moduleName) {
      const cycle = this.findCycle(moduleName);
      if (cycle) {
        // Find the import line that starts the cycle
        const nextInCycle = cycle.length > 1 ? cycle[1] : cycle[0];
        for (const imp of imports) {
          const resolved = this.resolveImport(imp.name);
          if (resolved && resolved.moduleName === nextInCycle) {
            diagnostics.push({
              line: imp.line,
              col: imp.col,
              endCol: imp.col + imp.name.length,
              message: `Circular import detected: ${cycle.join(' → ')}`,
              severity: 'warning',
              code: 'MTL106',
            });
          }
        }
      }
    }

    // Validate extends target
    const extendsInfo = this.extractExtends(fileContent);
    if (extendsInfo) {
      const resolved = this.resolveImport(extendsInfo.name);
      if (!resolved) {
        diagnostics.push({
          line: extendsInfo.line,
          col: extendsInfo.col,
          endCol: extendsInfo.col + extendsInfo.name.length,
          message: `Module extends '${extendsInfo.name}' but no module named '${extendsInfo.name}' was found`,
          severity: 'error',
          code: 'MTL107',
        });
      } else {
        // Check for circular extends
        const extendsCycle = this.findExtendsCycle(moduleName || '');
        if (extendsCycle) {
          diagnostics.push({
            line: extendsInfo.line,
            col: extendsInfo.col,
            endCol: extendsInfo.col + extendsInfo.name.length,
            message: `Circular extends chain detected: ${extendsCycle.join(' → ')}`,
            severity: 'error',
            code: 'MTL108',
          });
        }
      }
    }

    return diagnostics;
  }

  /**
   * Find which file defines a given template/query name.
   */
  findDefinitionFile(symbolName: string): { fileId: string; filename: string; line: number } | null {
    let result: { fileId: string; filename: string; line: number } | null = null;
    this.modules.forEach((info) => {
      if (result) return;
      const template = info.templates.find((t) => t.name === symbolName);
      if (template) {
        result = { fileId: info.fileId, filename: info.filename, line: template.line };
        return;
      }
      const query = info.queries.find((q) => q.name === symbolName);
      if (query) {
        result = { fileId: info.fileId, filename: info.filename, line: query.line };
      }
    });
    return result;
  }

  /**
   * Get module info for a specific file.
   */
  getModuleForFile(fileId: string): ModuleInfo | null {
    const moduleName = this.fileModules.get(fileId);
    if (!moduleName) return null;
    return this.modules.get(moduleName) || null;
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private findCycle(startModule: string): string[] | null {
    const visited = new Set<string>();
    const path: string[] = [];

    const dfs = (current: string): string[] | null => {
      if (path.includes(current)) {
        return [...path.slice(path.indexOf(current)), current];
      }
      if (visited.has(current)) return null;

      visited.add(current);
      path.push(current);

      const info = this.modules.get(current);
      if (info) {
        for (const imp of info.imports) {
          const resolved = this.resolveImport(imp);
          if (resolved) {
            const cycle = dfs(resolved.moduleName);
            if (cycle) return cycle;
          }
        }
      }

      path.pop();
      return null;
    };

    return dfs(startModule);
  }

  private findExtendsCycle(startModule: string): string[] | null {
    const path: string[] = [];
    let current: string | undefined = startModule;

    while (current) {
      if (path.includes(current)) {
        return [...path.slice(path.indexOf(current)), current];
      }
      path.push(current);

      const info = this.modules.get(current);
      if (!info || !info.extends) break;

      const parent = this.resolveImport(info.extends);
      current = parent?.moduleName;
    }

    return null;
  }

  private parseModuleInfo(fileId: string, filename: string, content: string): ModuleInfo | null {
    const lines = content.split('\n');

    // Find module declaration: [module name('uri')/] or [module name('uri') extends parentName/]
    let moduleName = filename.replace(/\.mtl$/, ''); // default to filename
    let extendsName: string | undefined;
    const moduleRe = /\[module\s+(\w+)\s*\([^)]*\)\s*(?:extends\s+(\S+?))?\s*\/\s*\]/;
    for (const line of lines) {
      const m = moduleRe.exec(line);
      if (m) {
        moduleName = m[1];
        if (m[2]) {
          extendsName = m[2];
        }
        break;
      }
    }

    // Fallback: try simpler module regex without extends
    if (moduleName === filename.replace(/\.mtl$/, '')) {
      const simpleModuleRe = /\[module\s+(\w+)\s*\(/;
      for (const line of lines) {
        const m = simpleModuleRe.exec(line);
        if (m) {
          moduleName = m[1];
          break;
        }
      }
    }

    // Extract templates
    const templates: TemplateSymbol[] = [];
    const templateRe = /\[template\s+(public|private|protected)\s+(\w+)\s*(\([^)]*\))/;
    for (let i = 0; i < lines.length; i++) {
      const m = templateRe.exec(lines[i]);
      if (m) {
        templates.push({
          name: m[2],
          visibility: m[1] as 'public' | 'private' | 'protected',
          params: m[3],
          line: i + 1,
        });
      }
    }

    // Extract queries
    const queries: QuerySymbol[] = [];
    const queryRe = /\[query\s+(public|private|protected)\s+(\w+)\s*(\([^)]*\))\s*:\s*(\w+)/;
    for (let i = 0; i < lines.length; i++) {
      const m = queryRe.exec(lines[i]);
      if (m) {
        queries.push({
          name: m[2],
          visibility: m[1] as 'public' | 'private' | 'protected',
          params: m[3],
          returnType: m[4],
          line: i + 1,
        });
      }
    }

    // Extract imports
    const imports = this.extractImports(content).map((imp) => imp.name);

    return { fileId, filename, moduleName, templates, queries, imports, extends: extendsName };
  }

  private extractImports(content: string): Array<{ name: string; line: number; col: number }> {
    const imports: Array<{ name: string; line: number; col: number }> = [];
    const lines = content.split('\n');
    const importRe = /\[import\s+(\S+?)\s*\/?\s*\]/;

    for (let i = 0; i < lines.length; i++) {
      const m = importRe.exec(lines[i]);
      if (m) {
        const col = lines[i].indexOf(m[1], m.index) + 1;
        imports.push({ name: m[1], line: i + 1, col });
      }
    }

    return imports;
  }

  private extractExtends(content: string): { name: string; line: number; col: number } | null {
    const lines = content.split('\n');
    const extendsRe = /\[module\s+\w+\s*\([^)]*\)\s*extends\s+(\S+?)\s*\/\s*\]/;

    for (let i = 0; i < lines.length; i++) {
      const m = extendsRe.exec(lines[i]);
      if (m) {
        const col = lines[i].indexOf(m[1], m.index) + 1;
        return { name: m[1], line: i + 1, col };
      }
    }

    return null;
  }
}
