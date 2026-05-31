import type { Node } from 'estree';
import type { Diagnostic } from './ir/types.js';

/** Collects non-fatal events raised while compiling. */
export class DiagnosticSink {
  private readonly items: Diagnostic[] = [];

  add(code: string, message: string, node?: Node): void {
    const loc = node?.loc?.start;
    this.items.push({
      code,
      message,
      ...(loc ? { line: loc.line, column: loc.column } : {}),
    });
  }

  all(): Diagnostic[] {
    return this.items;
  }
}
