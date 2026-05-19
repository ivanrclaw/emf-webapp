/**
 * MTLDiagnosticEngine — Real-time validation of MTL/Acceleo templates.
 * Produces diagnostics (errors, warnings, info) with line/col positions.
 */
import { MetamodelSchemaProvider } from './MetamodelSchemaProvider';
import { ImportResolver } from './ImportResolver';
import { MTLTypeInference } from './MTLTypeInference';

export interface Diagnostic {
  line: number;
  col: number;
  endLine: number;
  endCol: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  code?: string;
}

interface TagInfo {
  tag: string;
  line: number;
  col: number;
  endCol: number;
}

export class MTLDiagnosticEngine {
  private schema: MetamodelSchemaProvider | null;
  private importResolver: ImportResolver | null;

  constructor(schema: MetamodelSchemaProvider | null, importResolver?: ImportResolver | null) {
    this.schema = schema;
    this.importResolver = importResolver || null;
  }

  updateSchema(schema: MetamodelSchemaProvider | null): void {
    this.schema = schema;
  }

  updateImportResolver(resolver: ImportResolver | null): void {
    this.importResolver = resolver;
  }

  analyze(text: string, fileId?: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    diagnostics.push(...this.checkUnclosedBlocks(text));
    if (this.schema) {
      diagnostics.push(...this.checkTypeErrors(text));
    }
    diagnostics.push(...this.checkWarnings(text));
    // Validate imports if resolver is available
    if (this.importResolver && fileId) {
      const importDiags = this.importResolver.validateImports(text, fileId);
      for (const d of importDiags) {
        diagnostics.push({
          line: d.line,
          col: d.col,
          endLine: d.line,
          endCol: d.endCol,
          message: d.message,
          severity: d.severity,
          code: d.code,
        });
      }
      // Check visibility violations (MTL109)
      diagnostics.push(...this.checkVisibilityViolations(text, fileId));
    }
    return diagnostics.sort((a, b) => a.line - b.line || a.col - b.col);
  }

  private checkVisibilityViolations(text: string, fileId: string): Diagnostic[] {
    if (!this.importResolver) return [];
    const diagnostics: Diagnostic[] = [];
    const lines = text.split('\n');

    // Find template calls: patterns like templateName(args) that reference other modules' templates
    const templateCallRe = /\b(\w+)\s*\(/g;

    // Get the current module's own template names to exclude
    const currentModule = this.importResolver.getModuleForFile(fileId);
    const ownTemplateNames = new Set(currentModule?.templates.map((t) => t.name) || []);
    const ownQueryNames = new Set(currentModule?.queries.map((q) => q.name) || []);

    // Get all modules to check against
    const allModules = this.importResolver.getAvailableModules();

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      templateCallRe.lastIndex = 0;
      let m;
      while ((m = templateCallRe.exec(line)) !== null) {
        const calledName = m[1];

        // Skip own symbols and keywords
        if (ownTemplateNames.has(calledName) || ownQueryNames.has(calledName)) continue;
        if (this.isKeywordOrBuiltin(calledName)) continue;

        // Check if this name matches a private template/query in another module
        for (const mod of allModules) {
          if (mod.fileId === fileId) continue;

          const privateTemplate = mod.templates.find(
            (t) => t.name === calledName && t.visibility === 'private',
          );
          if (privateTemplate) {
            // Verify this module is actually imported or extended by the current file
            const accessible = this.importResolver!.getAccessibleSymbols(fileId, mod.fileId);
            const isAccessible = accessible.templates.some((t) => t.name === calledName);
            if (!isAccessible) {
              // Check if the module is referenced (imported or extended)
              const importedSymbols = this.importResolver!.getImportedSymbols(text, fileId);
              const isReferenced =
                importedSymbols.sourceFiles.has(calledName) ||
                mod.templates.some((t) => t.name === calledName);

              if (isReferenced || this.isModuleReferenced(text, mod.moduleName)) {
                diagnostics.push({
                  line: lineIdx + 1,
                  col: m.index + 1,
                  endLine: lineIdx + 1,
                  endCol: m.index + 1 + calledName.length,
                  message: `Cannot access private template '${calledName}' from module '${mod.moduleName}'`,
                  severity: 'error',
                  code: 'MTL109',
                });
              }
            }
          }

          const privateQuery = mod.queries.find(
            (q) => q.name === calledName && q.visibility === 'private',
          );
          if (privateQuery && !privateTemplate) {
            const accessible = this.importResolver!.getAccessibleSymbols(fileId, mod.fileId);
            const isAccessible = accessible.queries.some((q) => q.name === calledName);
            if (!isAccessible && this.isModuleReferenced(text, mod.moduleName)) {
              diagnostics.push({
                line: lineIdx + 1,
                col: m.index + 1,
                endLine: lineIdx + 1,
                endCol: m.index + 1 + calledName.length,
                message: `Cannot access private template '${calledName}' from module '${mod.moduleName}'`,
                severity: 'error',
                code: 'MTL109',
              });
            }
          }
        }
      }
    }

    return diagnostics;
  }

  private isModuleReferenced(fileContent: string, moduleName: string): boolean {
    // Check if the module is imported or extended in the file content
    const importRe = new RegExp(`\\[import\\s+${moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*/?\\s*\\]`);
    const extendsRe = new RegExp(`\\[module\\s+\\w+\\s*\\([^)]*\\)\\s*extends\\s+${moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
    return importRe.test(fileContent) || extendsRe.test(fileContent);
  }

  private isKeywordOrBuiltin(name: string): boolean {
    const keywords = [
      'if', 'for', 'let', 'template', 'query', 'module', 'import', 'file',
      'protected', 'trace', 'comment', 'else', 'elseif', 'self',
      'true', 'false', 'null', 'not', 'and', 'or', 'xor',
      'select', 'reject', 'collect', 'forAll', 'exists', 'sortedBy',
      'one', 'isUnique', 'any', 'closure', 'collectNested',
      'size', 'isEmpty', 'notEmpty', 'first', 'last', 'at',
      'includes', 'excludes', 'sum', 'asSet', 'asSequence', 'flatten',
      'append', 'prepend', 'union', 'intersection', 'including', 'excluding',
      'toUpper', 'toLower', 'toUpperFirst', 'toLowerFirst', 'trim',
      'substring', 'startsWith', 'endsWith', 'contains', 'replaceAll',
      'concat', 'indexOf', 'matches', 'tokenize', 'toString',
      'abs', 'floor', 'round', 'div', 'mod', 'max', 'min', 'length',
      'oclIsKindOf', 'oclIsTypeOf', 'oclAsType', 'separator',
    ];
    return keywords.includes(name);
  }

  private checkUnclosedBlocks(text: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const lines = text.split('\n');
    const stack: TagInfo[] = [];

    // Regex for opening block tags: [template ...], [for ...], [if ...], etc.
    const openRegex = /\[(template|for|if|let|file|protected|trace)\b/g;
    // Regex for closing tags: [/template], [/for], etc.
    const closeRegex = /\[\/(template|for|if|let|file|protected|trace)\]/g;
    // Regex for self-closing tags (end with /]): [module .../], [query .../], [comment .../]
    const selfCloseRegex = /\[[^\]]*\/\]/g;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      const lineNum = lineIdx + 1;

      // Find self-closing tags first to exclude them from open tag detection
      const selfClosePositions = new Set<number>();
      let scMatch;
      selfCloseRegex.lastIndex = 0;
      while ((scMatch = selfCloseRegex.exec(line)) !== null) {
        for (let i = scMatch.index; i < scMatch.index + scMatch[0].length; i++) {
          selfClosePositions.add(i);
        }
      }

      // Find opening tags
      openRegex.lastIndex = 0;
      let match;
      while ((match = openRegex.exec(line)) !== null) {
        // Skip if this position is inside a self-closing tag
        if (selfClosePositions.has(match.index)) continue;
        stack.push({
          tag: match[1],
          line: lineNum,
          col: match.index + 1,
          endCol: match.index + match[0].length + 1,
        });
      }

      // Find closing tags
      closeRegex.lastIndex = 0;
      while ((match = closeRegex.exec(line)) !== null) {
        const closeTag = match[1];
        if (stack.length === 0) {
          diagnostics.push({
            line: lineNum,
            col: match.index + 1,
            endLine: lineNum,
            endCol: match.index + match[0].length + 1,
            message: `Orphan closing tag [/${closeTag}] without matching opening tag`,
            severity: 'error',
            code: 'MTL002',
          });
        } else {
          const top = stack[stack.length - 1];
          if (top.tag === closeTag) {
            stack.pop();
          } else {
            // Mismatched
            stack.pop();
            diagnostics.push({
              line: lineNum,
              col: match.index + 1,
              endLine: lineNum,
              endCol: match.index + match[0].length + 1,
              message: `Mismatched closing tag: expected [/${top.tag}] but found [/${closeTag}]`,
              severity: 'error',
              code: 'MTL003',
            });
          }
        }
      }
    }

    // Remaining unclosed tags
    for (const unclosed of stack) {
      diagnostics.push({
        line: unclosed.line,
        col: unclosed.col,
        endLine: unclosed.line,
        endCol: unclosed.endCol,
        message: `Unclosed [${unclosed.tag}] block — missing [/${unclosed.tag}]`,
        severity: 'error',
        code: 'MTL001',
      });
    }

    return diagnostics;
  }

  private checkTypeErrors(text: string): Diagnostic[] {
    if (!this.schema) return [];
    const diagnostics: Diagnostic[] = [];
    const lines = text.split('\n');
    const typeInference = new MTLTypeInference();

    // Build scope map: for each line, what variables are in scope
    // We'll compute scope lazily per expression found

    // ── 1. Check unknown types in declarations ──
    const typeUsageRegex =
      /\[\s*(?:for\s*\(\s*\w+\s*:\s*(\w+)|let\s+\w+\s*:\s*(\w+)|template\s+(?:public|private|protected)\s+\w+\([^)]*:\s*(\w+))/g;
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      typeUsageRegex.lastIndex = 0;
      let m;
      while ((m = typeUsageRegex.exec(line)) !== null) {
        const typeName = m[1] || m[2] || m[3];
        if (typeName && !this.isKnownType(typeName)) {
          const col = line.indexOf(typeName, m.index) + 1;
          diagnostics.push({
            line: lineIdx + 1,
            col,
            endLine: lineIdx + 1,
            endCol: col + typeName.length,
            message: `Unknown type '${typeName}' — not found in metamodel`,
            severity: 'error',
            code: 'MTL005',
          });
        }
      }
    }

    // ── 2. Full expression chain type checking ──
    // Match expressions: var.member, var.member.sub, expr->op(), expr.oclAsType(T)
    // We look for navigation chains inside [template body] regions
    const expressionRegex = /\b(\w+(?:\.\w+(?:\([^)]*\))?|->(?:\w+)(?:\([^)]*\))?)+)/g;
    // Simpler approach: find dot/arrow chains and validate each segment
    const chainRegex = /\b(\w+)((?:\.\w+(?:\([^)]*\))?|->(?:\w+)(?:\([^)]*\))?)+)/g;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      // Skip comment lines and tag-only lines
      if (/^\s*\[comment\b/.test(line)) continue;

      chainRegex.lastIndex = 0;
      let m;
      while ((m = chainRegex.exec(line)) !== null) {
        const fullExpr = m[0];
        const startVar = m[1];

        // Skip keywords and builtins as start
        if (this.isKeywordOrBuiltin(startVar)) continue;

        // Get scope at this line
        const scope = typeInference.getVariablesInScope(text, lineIdx + 1, m.index + 1);
        const scopeVar = scope.find((v) => v.name === startVar);
        if (!scopeVar) continue; // Unknown variable, skip

        // Parse the chain segments
        const segments = this.parseChainSegments(fullExpr);
        if (segments.length < 2) continue;

        let currentType = scopeVar.type.typeName;
        let isCollection = scopeVar.type.isCollection;
        let chainBroken = false;

        for (let i = 1; i < segments.length; i++) {
          const seg = segments[i];

          // Handle oclAsType(Type) — cast
          if (seg.name === 'oclAsType' && seg.args) {
            const castType = seg.args.trim();
            if (castType && this.schema!.getClass(castType)) {
              // Validate cast is compatible (target must be in hierarchy)
              const isCompatible = this.isTypeCompatible(currentType, castType);
              if (!isCompatible) {
                const segCol = line.indexOf(seg.name, m.index) + 1;
                diagnostics.push({
                  line: lineIdx + 1,
                  col: segCol,
                  endLine: lineIdx + 1,
                  endCol: segCol + seg.name.length + seg.args.length + 2,
                  message: `Suspicious cast: '${castType}' is not in the type hierarchy of '${currentType}'`,
                  severity: 'warning',
                  code: 'MTL006',
                });
              }
              currentType = castType;
              isCollection = false;
            } else if (castType && !this.isKnownType(castType)) {
              const segCol = line.indexOf(castType, m.index) + 1;
              if (segCol > 0) {
                diagnostics.push({
                  line: lineIdx + 1,
                  col: segCol,
                  endLine: lineIdx + 1,
                  endCol: segCol + castType.length,
                  message: `Unknown cast target type '${castType}'`,
                  severity: 'error',
                  code: 'MTL007',
                });
              }
              chainBroken = true;
              break;
            }
            continue;
          }

          // Handle oclIsKindOf/oclIsTypeOf — returns boolean, validates type arg
          if ((seg.name === 'oclIsKindOf' || seg.name === 'oclIsTypeOf') && seg.args) {
            const checkType = seg.args.trim();
            if (checkType && !this.isKnownType(checkType)) {
              const segCol = line.indexOf(checkType, m.index) + 1;
              if (segCol > 0) {
                diagnostics.push({
                  line: lineIdx + 1,
                  col: segCol,
                  endLine: lineIdx + 1,
                  endCol: segCol + checkType.length,
                  message: `Unknown type '${checkType}' in ${seg.name}() check`,
                  severity: 'error',
                  code: 'MTL008',
                });
              }
            }
            currentType = 'EBoolean';
            isCollection = false;
            continue;
          }

          // Handle arrow operations (collection ops)
          if (seg.isArrow) {
            // Validate arrow on non-collection
            if (!isCollection) {
              const segCol = line.indexOf('->' + seg.name, m.index) + 1;
              if (segCol > 0) {
                diagnostics.push({
                  line: lineIdx + 1,
                  col: segCol,
                  endLine: lineIdx + 1,
                  endCol: segCol + seg.name.length + 2,
                  message: `Arrow operator '->' used on '${currentType}' which is not a collection`,
                  severity: 'error',
                  code: 'MTL009',
                });
              }
              chainBroken = true;
              break;
            }
            // Resolve collection op result type
            const opValidation = typeInference.validateOperation(currentType, seg.name, isCollection, true);
            if (opValidation) {
              const segCol = line.indexOf(seg.name, m.index + startVar.length) + 1;
              if (segCol > 0) {
                diagnostics.push({
                  line: lineIdx + 1,
                  col: segCol,
                  endLine: lineIdx + 1,
                  endCol: segCol + seg.name.length,
                  message: opValidation,
                  severity: 'error',
                  code: 'MTL010',
                });
              }
              chainBroken = true;
              break;
            }
            // Update type after collection op
            const resolved = typeInference.resolveExpressionType(
              fullExpr.substring(0, this.getSegmentEndOffset(segments, i, fullExpr)),
              scope,
              this.schema!,
            );
            if (resolved) {
              currentType = resolved.typeName;
              isCollection = resolved.isCollection;
            }
            continue;
          }

          // Handle dot access — check type-operation compatibility
          const opError = typeInference.validateOperation(currentType, seg.name, isCollection, false);
          if (opError) {
            const segCol = line.indexOf('.' + seg.name, m.index + startVar.length);
            if (segCol >= 0) {
              diagnostics.push({
                line: lineIdx + 1,
                col: segCol + 2, // after the dot
                endLine: lineIdx + 1,
                endCol: segCol + 2 + seg.name.length,
                message: opError,
                severity: 'error',
                code: 'MTL011',
              });
            }
            chainBroken = true;
            break;
          }

          // Check if it's a builtin method
          if (typeInference.isBuiltinOperation(seg.name)) {
            const retType = typeInference.getBuiltinReturnType(seg.name, { typeName: currentType, isCollection });
            if (retType) {
              currentType = retType.typeName;
              isCollection = retType.isCollection;
            }
            continue;
          }

          // Check metamodel feature access
          if (this.schema!.getClass(currentType)) {
            const features = this.schema!.getFeaturesOf(currentType);
            const attr = features.attributes.find((a) => a.name === seg.name);
            const ref = features.references.find((r) => r.name === seg.name);

            if (!attr && !ref) {
              const segCol = line.indexOf('.' + seg.name, m.index + startVar.length);
              if (segCol >= 0) {
                const available = [
                  ...features.attributes.map((a) => a.name),
                  ...features.references.map((r) => r.name),
                ];
                diagnostics.push({
                  line: lineIdx + 1,
                  col: segCol + 2,
                  endLine: lineIdx + 1,
                  endCol: segCol + 2 + seg.name.length,
                  message: `'${seg.name}' is not a feature of '${currentType}'. Available: ${available.join(', ') || 'none'}`,
                  severity: 'error',
                  code: 'MTL004',
                });
              }
              chainBroken = true;
              break;
            }

            if (attr) {
              currentType = attr.type;
              isCollection = false;
            } else if (ref) {
              currentType = ref.targetClass;
              isCollection = ref.isMany;
            }
          } else {
            // Primitive type — no metamodel features
            if (!typeInference.isBuiltinOperation(seg.name)) {
              chainBroken = true;
              break;
            }
          }
        }
      }
    }

    // ── 3. Template/query call arity checking ──
    if (this.importResolver) {
      diagnostics.push(...this.checkCallArity(text, lines));
    }

    return diagnostics;
  }

  /**
   * Parse a chain expression into segments.
   * E.g., "self.deps->select(x|x.active).nombre" →
   *   [{name:'self'}, {name:'deps'}, {name:'select', isArrow:true, args:'x|x.active'}, {name:'nombre'}]
   */
  private parseChainSegments(expr: string): Array<{ name: string; isArrow: boolean; args?: string }> {
    const segments: Array<{ name: string; isArrow: boolean; args?: string }> = [];
    let i = 0;

    // First segment (variable name)
    let current = '';
    while (i < expr.length && /\w/.test(expr[i])) {
      current += expr[i];
      i++;
    }
    if (current) segments.push({ name: current, isArrow: false });

    while (i < expr.length) {
      let isArrow = false;

      if (expr[i] === '-' && expr[i + 1] === '>') {
        isArrow = true;
        i += 2;
      } else if (expr[i] === '.') {
        i++;
      } else {
        break;
      }

      // Read segment name
      current = '';
      while (i < expr.length && /\w/.test(expr[i])) {
        current += expr[i];
        i++;
      }

      // Read optional args in parens
      let args: string | undefined;
      if (i < expr.length && expr[i] === '(') {
        let depth = 1;
        i++; // skip opening paren
        const argStart = i;
        while (i < expr.length && depth > 0) {
          if (expr[i] === '(') depth++;
          else if (expr[i] === ')') depth--;
          if (depth > 0) i++;
        }
        args = expr.substring(argStart, i);
        i++; // skip closing paren
      }

      if (current) segments.push({ name: current, isArrow, args });
    }

    return segments;
  }

  private getSegmentEndOffset(
    segments: Array<{ name: string; isArrow: boolean; args?: string }>,
    upToIndex: number,
    _fullExpr: string,
  ): number {
    // Approximate: just return the full expression length up to this segment
    let offset = segments[0].name.length;
    for (let i = 1; i <= upToIndex; i++) {
      offset += segments[i].isArrow ? 2 : 1; // -> or .
      offset += segments[i].name.length;
      if (segments[i].args !== undefined) {
        offset += segments[i].args!.length + 2; // parens
      }
    }
    return offset;
  }

  /**
   * Check if targetType is in the type hierarchy of sourceType (up or down).
   */
  private isTypeCompatible(sourceType: string, targetType: string): boolean {
    if (!this.schema) return true;
    if (sourceType === targetType) return true;

    // Check if target is a subtype of source
    const targetCls = this.schema.getClass(targetType);
    if (targetCls) {
      if (targetCls.superTypes.includes(sourceType)) return true;
      // Check transitive supertypes
      for (const sup of targetCls.superTypes) {
        if (this.isTypeCompatible(sourceType, sup)) return true;
      }
    }

    // Check if source is a subtype of target (downcast)
    const sourceCls = this.schema.getClass(sourceType);
    if (sourceCls) {
      if (sourceCls.superTypes.includes(targetType)) return true;
      for (const sup of sourceCls.superTypes) {
        if (this.isTypeCompatible(sup, targetType)) return true;
      }
    }

    return false;
  }

  /**
   * Check template/query call arity and parameter types.
   */
  private checkCallArity(text: string, lines: string[]): Diagnostic[] {
    if (!this.importResolver) return [];
    const diagnostics: Diagnostic[] = [];

    // Find template/query invocations: name(args) inside template bodies
    // Pattern: [templateName(arg1, arg2)/] or templateName(arg) in expressions
    const callRegex = /\b(\w+)\s*\(([^)]*)\)\s*(?:\/\])?/g;

    // Collect all known templates/queries with their param counts
    const allModules = this.importResolver.getAvailableModules();
    const symbolMap = new Map<string, { params: string; moduleName: string; kind: 'template' | 'query' }[]>();

    for (const mod of allModules) {
      for (const t of mod.templates) {
        if (!symbolMap.has(t.name)) symbolMap.set(t.name, []);
        symbolMap.get(t.name)!.push({ params: t.params, moduleName: mod.moduleName, kind: 'template' });
      }
      for (const q of mod.queries) {
        if (!symbolMap.has(q.name)) symbolMap.set(q.name, []);
        symbolMap.get(q.name)!.push({ params: q.params, moduleName: mod.moduleName, kind: 'query' });
      }
    }

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      // Skip module/template/for/let declarations
      if (/\[\s*(module|template|for|let|query|import)\b/.test(line)) continue;

      callRegex.lastIndex = 0;
      let m;
      while ((m = callRegex.exec(line)) !== null) {
        const calledName = m[1];
        const argsStr = m[2].trim();

        // Skip keywords and builtins
        if (this.isKeywordOrBuiltin(calledName)) continue;
        if (calledName === 'file' || calledName === 'protected') continue;

        const symbols = symbolMap.get(calledName);
        if (!symbols || symbols.length === 0) continue;

        // Count provided args
        const providedArgs = argsStr ? argsStr.split(',').length : 0;

        // Check against known definitions
        const expectedCounts = symbols.map((s) => {
          if (!s.params || s.params === '()') return 0;
          // Parse params: "(a : Type, b : Type)" → count commas + 1
          const inner = s.params.replace(/^\(/, '').replace(/\)$/, '').trim();
          if (!inner) return 0;
          return inner.split(',').length;
        });

        // If none of the definitions match the provided arity
        const matchesAny = expectedCounts.some((expected) => expected === providedArgs);
        if (!matchesAny && expectedCounts.length > 0) {
          const expected = Array.from(new Set(expectedCounts)).join(' or ');
          diagnostics.push({
            line: lineIdx + 1,
            col: m.index + 1,
            endLine: lineIdx + 1,
            endCol: m.index + 1 + calledName.length,
            message: `'${calledName}' expects ${expected} argument(s) but ${providedArgs} provided`,
            severity: 'error',
            code: 'MTL012',
          });
        }
      }
    }

    return diagnostics;
  }

  private checkWarnings(text: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Check for @main
    const hasTemplate = /\[template\b/.test(text);
    const hasMain = /\[comment\s+@main\s*\/?\s*\]/.test(text);
    if (hasTemplate && !hasMain) {
      diagnostics.push({
        line: 1,
        col: 1,
        endLine: 1,
        endCol: 2,
        message: 'No @main template marker found — add [comment @main/] before the entry template',
        severity: 'warning',
        code: 'MTL101',
      });
    }

    // Check for empty template bodies
    const emptyTemplateRegex = /\[template\s+[^\]]+\]\s*\[\/template\]/g;
    let m;
    while ((m = emptyTemplateRegex.exec(text)) !== null) {
      const pos = this.offsetToLineCol(text, m.index);
      diagnostics.push({
        line: pos.line,
        col: pos.col,
        endLine: pos.line,
        endCol: pos.col + 10,
        message: 'Empty template body',
        severity: 'warning',
        code: 'MTL102',
      });
    }

    // Check for template without file block
    const templateBlockRegex = /\[template\s+[^\]]+\]([\s\S]*?)\[\/template\]/g;
    while ((m = templateBlockRegex.exec(text)) !== null) {
      const body = m[1];
      if (!body.includes('[file') && body.trim().length > 0) {
        const pos = this.offsetToLineCol(text, m.index);
        diagnostics.push({
          line: pos.line,
          col: pos.col,
          endLine: pos.line,
          endCol: pos.col + 10,
          message: 'Template has no [file] block — output will not be written to a file',
          severity: 'info',
          code: 'MTL201',
        });
      }
    }

    return diagnostics;
  }

  private isKnownType(name: string): boolean {
    const builtins = [
      'EString',
      'EInt',
      'EInteger',
      'EIntegerObject',
      'EBoolean',
      'EFloat',
      'EFloatObject',
      'EDouble',
      'EDate',
      'ELong',
      'EShort',
      'EByte',
      'EChar',
      'EObject',
      'EBooleanObject',
      'EEnum',
      'EEnumLiteral',
      'EOperation',
      'EPackage',
      'EClass',
      'EAttribute',
      'EReference',
      'EDataType',
      'ETypedElement',
      'ENamedElement',
      'EModelElement',
      'EObject',
      'String',
      'Integer',
      'Boolean',
      'Real',
      'OclAny',
      'Collection',
      'Sequence',
      'Set',
      'OrderedSet',
      'Bag',
      'Tuple',
    ];
    if (builtins.includes(name)) return true;
    if (this.schema?.getClass(name)) return true;
    if (this.schema?.getEnum(name)) return true;
    return false;
  }

  private isBuiltinMethod(name: string): boolean {
    const methods = [
      'toUpper',
      'toLower',
      'toUpperFirst',
      'toLowerFirst',
      'trim',
      'size',
      'substring',
      'startsWith',
      'endsWith',
      'contains',
      'replaceAll',
      'concat',
      'indexOf',
      'matches',
      'tokenize',
      'toString',
      'abs',
      'floor',
      'round',
      'div',
      'mod',
      'max',
      'min',
      'length',
      'oclIsKindOf',
      'oclIsTypeOf',
      'oclAsType',
    ];
    return methods.includes(name);
  }

  private offsetToLineCol(text: string, offset: number): { line: number; col: number } {
    let line = 1;
    let col = 1;
    for (let i = 0; i < offset && i < text.length; i++) {
      if (text[i] === '\n') {
        line++;
        col = 1;
      } else {
        col++;
      }
    }
    return { line, col };
  }
}
