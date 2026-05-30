import { zodToJsonSchema } from 'zod-to-json-schema';
import { irGraphSchema } from './schema.js';

/**
 * The IR as a standalone JSON Schema (draft 7) — for documentation, editor
 * validation, and non-JS consumers of the IR JSON.
 */
export function irJsonSchema(): object {
  return zodToJsonSchema(irGraphSchema, { name: 'NaiveWorkflowIR', $refStrategy: 'root' });
}
