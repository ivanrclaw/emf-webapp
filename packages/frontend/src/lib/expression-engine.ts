/**
 * @emf-webapp/frontend — Expression Engine
 *
 * Lightweight, safe expression evaluator for Sirius-like label expressions
 * and boolean predicates. Evaluates against a semantic element (self).
 *
 * Supported syntax:
 *   self.property              → attribute access
 *   self.ref->size()           → collection size
 *   self.ref->notEmpty()       → boolean (collection not empty)
 *   self.ref->isEmpty()        → boolean (collection empty)
 *   self.prop = 'value'        → equality
 *   self.prop != 'value'       → inequality
 *   self.prop > N              → numeric comparison
 *   self.prop < N              → numeric comparison
 *   self.prop >= N             → numeric comparison
 *   self.prop <= N             → numeric comparison
 *   not EXPR                   → negation
 *   EXPR and EXPR              → logical AND
 *   EXPR or EXPR               → logical OR
 *   'literal'                  → string literal
 *   N                          → numeric literal
 *   true / false               → boolean literal
 *   EXPR + EXPR                → string concatenation or numeric addition
 *   self.prop.subProp          → nested access
 */

export interface EvalContext {
  self: Record<string, unknown>;
  /** Additional variables (e.g. container, source, target) */
  vars?: Record<string, unknown>;
}

type Token =
  | { type: 'identifier'; value: string }
  | { type: 'string'; value: string }
  | { type: 'number'; value: number }
  | { type: 'boolean'; value: boolean }
  | { type: 'operator'; value: string }
  | { type: 'dot' }
  | { type: 'arrow' }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'eof' };

/* ─── Tokenizer ─────────────────────────────────────────────────────────────── */

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    // Skip whitespace
    if (/\s/.test(expr[i])) { i++; continue; }

    // Arrow operator ->
    if (expr[i] === '-' && expr[i + 1] === '>') {
      tokens.push({ type: 'arrow' });
      i += 2;
      continue;
    }

    // Operators: !=, >=, <=, =, >, <, +
    if (expr[i] === '!' && expr[i + 1] === '=') {
      tokens.push({ type: 'operator', value: '!=' });
      i += 2;
      continue;
    }
    if (expr[i] === '>' && expr[i + 1] === '=') {
      tokens.push({ type: 'operator', value: '>=' });
      i += 2;
      continue;
    }
    if (expr[i] === '<' && expr[i + 1] === '=') {
      tokens.push({ type: 'operator', value: '<=' });
      i += 2;
      continue;
    }
    if (expr[i] === '=') {
      tokens.push({ type: 'operator', value: '=' });
      i++;
      continue;
    }
    if (expr[i] === '>') {
      tokens.push({ type: 'operator', value: '>' });
      i++;
      continue;
    }
    if (expr[i] === '<') {
      tokens.push({ type: 'operator', value: '<' });
      i++;
      continue;
    }
    if (expr[i] === '+') {
      tokens.push({ type: 'operator', value: '+' });
      i++;
      continue;
    }

    // Dot
    if (expr[i] === '.') {
      tokens.push({ type: 'dot' });
      i++;
      continue;
    }

    // Parentheses
    if (expr[i] === '(') {
      tokens.push({ type: 'lparen' });
      i++;
      continue;
    }
    if (expr[i] === ')') {
      tokens.push({ type: 'rparen' });
      i++;
      continue;
    }

    // String literal (single or double quotes)
    if (expr[i] === "'" || expr[i] === '"') {
      const quote = expr[i];
      i++;
      let str = '';
      while (i < expr.length && expr[i] !== quote) {
        if (expr[i] === '\\') { i++; }
        str += expr[i];
        i++;
      }
      i++; // skip closing quote
      tokens.push({ type: 'string', value: str });
      continue;
    }

    // Number
    if (/[0-9]/.test(expr[i]) || (expr[i] === '-' && /[0-9]/.test(expr[i + 1] || ''))) {
      let num = '';
      if (expr[i] === '-') { num += '-'; i++; }
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i];
        i++;
      }
      tokens.push({ type: 'number', value: parseFloat(num) });
      continue;
    }

    // Identifier (includes keywords: self, not, and, or, true, false)
    if (/[a-zA-Z_$]/.test(expr[i])) {
      let id = '';
      while (i < expr.length && /[a-zA-Z0-9_$]/.test(expr[i])) {
        id += expr[i];
        i++;
      }
      if (id === 'true') {
        tokens.push({ type: 'boolean', value: true });
      } else if (id === 'false') {
        tokens.push({ type: 'boolean', value: false });
      } else if (id === 'not' || id === 'and' || id === 'or') {
        tokens.push({ type: 'operator', value: id });
      } else {
        tokens.push({ type: 'identifier', value: id });
      }
      continue;
    }

    // Unknown character — skip
    i++;
  }

  tokens.push({ type: 'eof' });
  return tokens;
}

/* ─── Parser + Evaluator ────────────────────────────────────────────────────── */

class ExprParser {
  private tokens: Token[];
  private pos = 0;
  private ctx: EvalContext;

  constructor(tokens: Token[], ctx: EvalContext) {
    this.tokens = tokens;
    this.ctx = ctx;
  }

  private peek(): Token {
    return this.tokens[this.pos] || { type: 'eof' };
  }

  private advance(): Token {
    const t = this.tokens[this.pos];
    this.pos++;
    return t;
  }

  private expect(type: string): Token {
    const t = this.advance();
    if (t.type !== type) {
      throw new Error(`Expected ${type}, got ${t.type}`);
    }
    return t;
  }

  parse(): unknown {
    const result = this.parseOr();
    return result;
  }

  private parseOr(): unknown {
    let left = this.parseAnd();
    while (this.peek().type === 'operator' && (this.peek() as any).value === 'or') {
      this.advance();
      const right = this.parseAnd();
      left = Boolean(left) || Boolean(right);
    }
    return left;
  }

  private parseAnd(): unknown {
    let left = this.parseNot();
    while (this.peek().type === 'operator' && (this.peek() as any).value === 'and') {
      this.advance();
      const right = this.parseNot();
      left = Boolean(left) && Boolean(right);
    }
    return left;
  }

  private parseNot(): unknown {
    if (this.peek().type === 'operator' && (this.peek() as any).value === 'not') {
      this.advance();
      const val = this.parseNot();
      return !val;
    }
    return this.parseComparison();
  }

  private parseComparison(): unknown {
    let left = this.parseAddition();
    const t = this.peek();
    if (t.type === 'operator' && ['=', '!=', '>', '<', '>=', '<='].includes((t as any).value)) {
      const op = (this.advance() as any).value as string;
      const right = this.parseAddition();
      switch (op) {
        case '=': return left === right;
        case '!=': return left !== right;
        case '>': return (left as number) > (right as number);
        case '<': return (left as number) < (right as number);
        case '>=': return (left as number) >= (right as number);
        case '<=': return (left as number) <= (right as number);
      }
    }
    return left;
  }

  private parseAddition(): unknown {
    let left = this.parseAccess();
    while (this.peek().type === 'operator' && (this.peek() as any).value === '+') {
      this.advance();
      const right = this.parseAccess();
      if (typeof left === 'number' && typeof right === 'number') {
        left = left + right;
      } else {
        left = String(left ?? '') + String(right ?? '');
      }
    }
    return left;
  }

  private parseAccess(): unknown {
    let value = this.parsePrimary();

    while (true) {
      if (this.peek().type === 'dot') {
        this.advance();
        const prop = this.expect('identifier') as { type: 'identifier'; value: string };
        if (value == null) return undefined;
        if (typeof value === 'object') {
          value = (value as Record<string, unknown>)[prop.value];
        } else {
          return undefined;
        }
      } else if (this.peek().type === 'arrow') {
        this.advance();
        const method = this.expect('identifier') as { type: 'identifier'; value: string };
        this.expect('lparen');
        this.expect('rparen');
        value = this.applyCollectionMethod(value, method.value);
      } else {
        break;
      }
    }

    return value;
  }

  private parsePrimary(): unknown {
    const t = this.peek();

    if (t.type === 'string') {
      this.advance();
      return (t as any).value;
    }
    if (t.type === 'number') {
      this.advance();
      return (t as any).value;
    }
    if (t.type === 'boolean') {
      this.advance();
      return (t as any).value;
    }
    if (t.type === 'identifier') {
      const id = (t as any).value as string;
      this.advance();
      if (id === 'self') {
        return this.ctx.self;
      }
      // Check vars
      if (this.ctx.vars && id in this.ctx.vars) {
        return this.ctx.vars[id];
      }
      // Could be a standalone identifier used as a property name
      return id;
    }
    if (t.type === 'lparen') {
      this.advance();
      const val = this.parseOr();
      this.expect('rparen');
      return val;
    }

    // Fallback
    this.advance();
    return undefined;
  }

  private applyCollectionMethod(value: unknown, method: string): unknown {
    const arr = Array.isArray(value) ? value : (value != null ? [value] : []);
    switch (method) {
      case 'size': return arr.length;
      case 'notEmpty': return arr.length > 0;
      case 'isEmpty': return arr.length === 0;
      case 'first': return arr[0];
      case 'last': return arr[arr.length - 1];
      default: return undefined;
    }
  }
}

/* ─── Public API ────────────────────────────────────────────────────────────── */

/**
 * Evaluate an expression against a semantic element.
 *
 * @param expression - The expression string (e.g. "self.name")
 * @param context - The evaluation context with `self` and optional `vars`
 * @returns The evaluated value
 *
 * @example
 * evaluate('self.name', { self: { name: 'Person' } }) // → 'Person'
 * evaluate('self.children->size()', { self: { children: [1,2,3] } }) // → 3
 * evaluate('self.abstract = true', { self: { abstract: true } }) // → true
 */
export function evaluate(expression: string, context: EvalContext): unknown {
  if (!expression || expression.trim() === '') return undefined;

  try {
    const tokens = tokenize(expression);
    const parser = new ExprParser(tokens, context);
    return parser.parse();
  } catch {
    // On parse error, return the expression as-is (graceful degradation for labels)
    return expression;
  }
}

/**
 * Evaluate an expression and coerce to string (for labels).
 */
export function evaluateLabel(expression: string, context: EvalContext): string {
  const result = evaluate(expression, context);
  if (result == null) return '';
  return String(result);
}

/**
 * Evaluate an expression and coerce to boolean (for predicates/preconditions).
 */
export function evaluatePredicate(expression: string, context: EvalContext): boolean {
  if (!expression || expression.trim() === '') return true; // empty = always true
  const result = evaluate(expression, context);
  return Boolean(result);
}
