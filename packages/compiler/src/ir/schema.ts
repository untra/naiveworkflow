import { z } from 'zod';
import type { IRNode } from './types.js';

export const phaseSchema = z.object({
  title: z.string(),
  detail: z.string().optional(),
});

export const metaSchema = z.object({
  name: z.string().nullable(),
  description: z.string().nullable(),
  phases: z.array(phaseSchema),
});

export const multiplicitySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('static'), n: z.number().int().nonnegative() }),
  z.object({ kind: z.literal('symbolic'), sourceText: z.string() }),
]);

export const repeatSchema = z.object({
  kind: z.enum(['while', 'until', 'for']),
  conditionText: z.string(),
});

const base = {
  id: z.string(),
  phase: z.string().optional(),
  source: z.string().optional(),
};

/**
 * Recursive node schema. `z.infer` cannot derive a recursive type, so the
 * canonical TS type is the hand-written `IRNode` and this schema is annotated
 * `z.ZodType<IRNode>` — TS checks the two against each other.
 */
export const irNodeSchema: z.ZodType<IRNode> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({
      ...base,
      kind: z.literal('agent'),
      prompt: z.string().nullable(),
      label: z.string().optional(),
      model: z.string().optional(),
      agentType: z.string().optional(),
      isolation: z.string().optional(),
      hasSchema: z.boolean().optional(),
    }),
    z.object({ ...base, kind: z.literal('sequence'), children: z.array(irNodeSchema) }),
    z.object({ ...base, kind: z.literal('parallel'), children: z.array(irNodeSchema) }),
    z.object({
      ...base,
      kind: z.literal('pipeline'),
      items: multiplicitySchema,
      stages: z.array(irNodeSchema),
    }),
    z.object({
      ...base,
      kind: z.literal('fanout'),
      op: z.enum(['map', 'flatMap', 'filter', 'forEach']),
      multiplicity: multiplicitySchema,
      body: irNodeSchema,
    }),
    z.object({ ...base, kind: z.literal('loop'), repeat: repeatSchema, body: irNodeSchema }),
    z.object({
      ...base,
      kind: z.literal('branch'),
      conditionText: z.string(),
      consequent: irNodeSchema,
      alternate: irNodeSchema.nullable().optional(),
    }),
    z.object({ ...base, kind: z.literal('terminal'), reason: z.enum(['return', 'exit']) }),
    z.object({
      ...base,
      kind: z.literal('phase'),
      title: z.string(),
      children: z.array(irNodeSchema),
    }),
    z.object({
      ...base,
      kind: z.literal('workflow'),
      name: z.string().nullable(),
      args: z.string().optional(),
    }),
    z.object({ ...base, kind: z.literal('note'), text: z.string().nullable() }),
    z.object({ ...base, kind: z.literal('code'), source: z.string(), note: z.string().optional() }),
  ]),
);

export const irGraphSchema = z.object({
  root: irNodeSchema,
});
