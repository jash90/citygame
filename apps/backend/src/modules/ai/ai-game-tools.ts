import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  blueprintEndingSchema,
  blueprintTaskSchema,
  blueprintTransitionSchema,
  narrativeBeatSchema,
  storyBibleSchema,
} from '@citygame/shared';
import type { TaskType } from '@citygame/shared';
import { z } from 'zod';

// `zod-to-json-schema` over deeply-nested superRefine() chains hits
// "type instantiation excessively deep" if we let TS infer through it.
// `any` is fine here because we treat the result as a JSON Schema literal.
//
// We deliberately avoid `target: 'openApi3'` because that emits the legacy
// boolean form `{ exclusiveMinimum: true, minimum: 0 }` which Anthropic's
// tool API (draft-07+ JSON Schema) rejects with HTTP 400. Default `jsonSchema7`
// gives the correct numeric `exclusiveMinimum`. `$refStrategy: 'none'`
// inlines definitions because Anthropic also rejects $ref-based schemas.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toToolParameters(schema: any): Record<string, unknown> {
  const json = zodToJsonSchema(schema, { $refStrategy: 'none' }) as Record<
    string,
    unknown
  >;
  delete json.$schema;
  delete json.definitions;
  return json;
}

// Anthropic's structured-output JSON Schema dialect (used by OpenRouter when
// response_format.type === 'json_schema') rejects numeric/length constraints
// and requires `additionalProperties: false` on every object. Empirically the
// Bedrock-routed Claude provider also rejects schemas with optional properties
// (the Anthropic docs claim a 24-optional cap but Bedrock returns 400 for
// schemas with any optionals). To work around this we follow the OpenAI strict
// pattern: every property is added to `required`, and originally-optional
// properties have `null` added to their type so the model can emit `null`
// when a field doesn't apply. The response goes through `stripNulls` before
// Zod sees it, so the Zod schema can keep its `.optional()` declarations.
const STRIPPED_KEYWORDS = new Set([
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minLength',
  'maxLength',
  'maxItems',
  'pattern',
  'format',
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeNullable(typeNode: any): any {
  if (!typeNode || typeof typeNode !== 'object') return typeNode;
  if (Array.isArray(typeNode.anyOf)) {
    if (typeNode.anyOf.some((o: { type?: string }) => o?.type === 'null')) {
      return typeNode;
    }
    return { ...typeNode, anyOf: [...typeNode.anyOf, { type: 'null' }] };
  }
  return { anyOf: [typeNode, { type: 'null' }] };
}

/**
 * Schema-walk path. Uses ".items" for array element schemas to mirror JSON
 * Schema's structure, e.g. "tasks.items.expectedAnswer".
 */
type SchemaPath = string;

function joinPath(parent: SchemaPath, segment: string): SchemaPath {
  return parent ? `${parent}.${segment}` : segment;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripStrictUnsupported(
  node: any,
  path: SchemaPath,
  artificialNullPaths: Set<SchemaPath>,
): any {
  if (Array.isArray(node)) {
    return node.map((v) =>
      stripStrictUnsupported(v, path, artificialNullPaths),
    );
  }
  if (!node || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (STRIPPED_KEYWORDS.has(key)) continue;
    if (key === 'minItems') {
      const num = typeof value === 'number' ? value : 0;
      if (num >= 1) out.minItems = 1;
      continue;
    }
    if (key === 'items') {
      out.items = stripStrictUnsupported(
        value,
        joinPath(path, 'items'),
        artificialNullPaths,
      );
      continue;
    }
    if (key === 'properties' && value && typeof value === 'object') {
      const propsOut: Record<string, unknown> = {};
      for (const [propKey, propVal] of Object.entries(
        value as Record<string, unknown>,
      )) {
        propsOut[propKey] = stripStrictUnsupported(
          propVal,
          joinPath(path, propKey),
          artificialNullPaths,
        );
      }
      out.properties = propsOut;
      continue;
    }
    out[key] = stripStrictUnsupported(value, path, artificialNullPaths);
  }
  if (
    out.type === 'object' &&
    out.properties &&
    typeof out.properties === 'object'
  ) {
    out.additionalProperties = false;
    const props = out.properties as Record<string, unknown>;
    const originalRequired = new Set(
      Array.isArray(out.required) ? (out.required as string[]) : [],
    );
    const allKeys = Object.keys(props);
    out.required = allKeys;
    for (const k of allKeys) {
      if (!originalRequired.has(k)) {
        const before = props[k];
        const after = makeNullable(before);
        if (after !== before) {
          // The original Zod schema marked this field `.optional()`. We added
          // `null` to its type purely to satisfy the API; its `null` value
          // should be stripped before Zod sees it.
          artificialNullPaths.add(joinPath(path, k));
        }
        props[k] = after;
      }
    }
  }
  return out;
}

/**
 * Walks `value` in lockstep with the JSON Schema paths recorded in
 * `artificialNullPaths` and removes only those `null`s that we introduced for
 * the API. Naturally-nullable fields (Zod `.nullable()`) keep their nulls,
 * so the existing Zod schemas validate the response unchanged.
 */
export function stripArtificialNulls<T>(
  value: T,
  artificialNullPaths: ReadonlySet<SchemaPath>,
  path: SchemaPath = '',
): T {
  if (Array.isArray(value)) {
    const itemPath = joinPath(path, 'items');
    return value.map((v) =>
      stripArtificialNulls(v, artificialNullPaths, itemPath),
    ) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const childPath = joinPath(path, k);
      if (v === null && artificialNullPaths.has(childPath)) continue;
      out[k] = stripArtificialNulls(v, artificialNullPaths, childPath);
    }
    return out as T;
  }
  return value;
}

export interface StructuredFormat {
  type: 'json_schema';
  json_schema: {
    name: string;
    strict: true;
    schema: Record<string, unknown>;
  };
  /** Paths whose `null` values were introduced by the strict-mode rewrite and
   *  should be stripped before Zod validation. Not sent to the API. */
  artificialNullPaths: ReadonlySet<string>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toStructuredFormat(schema: any, name: string): StructuredFormat {
  const artificialNullPaths = new Set<string>();
  const cleaned = stripStrictUnsupported(
    toToolParameters(schema),
    '',
    artificialNullPaths,
  );
  return {
    type: 'json_schema',
    json_schema: {
      name,
      strict: true,
      schema: cleaned,
    },
    artificialNullPaths,
  };
}

const outlineSchema = z.object({
  title: z.string(),
  description: z.string(),
  city: z.string(),
  flowType: z.enum(['LINEAR', 'BRANCHING', 'OPEN_WORLD', 'MIXED']),
  theme: z.string(),
  prologue: z.string().optional(),
  pois: z
    .array(
      z.object({
        index: z.number().int().min(1),
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        role: z.enum([
          'START',
          'HUB',
          'PUZZLE',
          'CIPHER_SOURCE',
          'CIPHER_LOCK',
          'FINAL',
        ]),
        summary: z.string(),
        // Story-bible-driven enrichment (added in v2). The model assigns each
        // POI a narrative beat + a list of recurring-character ids that appear
        // there + concrete clue strings to plant in the task body. Per-POI
        // task generation reads these and folds them into its prompt so the
        // parallel calls converge on a coherent narrative.
        narrativeBeat: narrativeBeatSchema.optional(),
        recurringCharacterIds: z.array(z.string()).optional(),
        plantedClues: z.array(z.string()).optional(),
      }),
    )
    .min(3)
    .max(20),
  endingHints: z
    .array(
      z.object({
        slug: z.string(),
        title: z.string(),
        flavour: z.string(),
      }),
    )
    .min(1)
    .max(6),
});

const tasksSchema = z.object({
  tasks: z.array(blueprintTaskSchema).min(1).max(20),
  transitions: z.array(blueprintTransitionSchema).min(1),
});

const singleTaskSchema = z.object({ task: blueprintTaskSchema });

const transitionsSchema = z.object({
  transitions: z.array(blueprintTransitionSchema).min(1),
});

const endingsSchema = z.object({
  endings: z.array(blueprintEndingSchema).min(1).max(6),
});

export const outlineFormat = toStructuredFormat(outlineSchema, 'gameOutline');
export const singleTaskFormat = toStructuredFormat(singleTaskSchema, 'singleTask');
export const transitionsFormat = toStructuredFormat(
  transitionsSchema,
  'gameTransitions',
);
export const endingsFormat = toStructuredFormat(endingsSchema, 'gameEndings');
export const storyBibleFormat = toStructuredFormat(
  storyBibleSchema,
  'storyBible',
);

/**
 * Returns a `singleTaskFormat` whose `task.type` enum is narrowed to
 * `allowedTaskTypes`. The default format permits every `TaskType`; when the
 * admin has narrowed the allowed set, the prompt alone isn't a strong enough
 * guard (the model sometimes emits disallowed types anyway), so we shrink the
 * JSON Schema enum sent through `response_format` and let the structured-
 * output API enforce the constraint token-by-token. Falls back to the static
 * format when the admin hasn't narrowed anything.
 */
export function buildSingleTaskFormat(
  allowedTaskTypes?: ReadonlyArray<TaskType>,
): StructuredFormat {
  if (!allowedTaskTypes || allowedTaskTypes.length === 0) {
    return singleTaskFormat;
  }
  const allowed = [...new Set(allowedTaskTypes)];
  const cloned = JSON.parse(JSON.stringify(singleTaskFormat.json_schema.schema)) as Record<string, unknown>;
  // The schema is { type: 'object', properties: { task: { type: 'object',
  // properties: { type: { type: 'string', enum: [...] }, … } } } } — narrow
  // the inner `type.enum`.
  const properties = cloned.properties as Record<string, unknown> | undefined;
  const taskNode = properties?.task as Record<string, unknown> | undefined;
  const taskProps = taskNode?.properties as Record<string, unknown> | undefined;
  const typeNode = taskProps?.type as Record<string, unknown> | undefined;
  if (typeNode && Array.isArray(typeNode.enum)) {
    typeNode.enum = allowed;
  }
  return {
    type: 'json_schema',
    json_schema: {
      name: singleTaskFormat.json_schema.name,
      strict: true,
      schema: cloned,
    },
    artificialNullPaths: singleTaskFormat.artificialNullPaths,
  };
}

export type OutlineToolPayload = z.infer<typeof outlineSchema>;
export type TasksToolPayload = z.infer<typeof tasksSchema>;
export type SingleTaskPayload = z.infer<typeof singleTaskSchema>;
export type TransitionsPayload = z.infer<typeof transitionsSchema>;
export type EndingsToolPayload = z.infer<typeof endingsSchema>;
export type StoryBibleToolPayload = z.infer<typeof storyBibleSchema>;

export {
  endingsSchema,
  outlineSchema,
  singleTaskSchema,
  storyBibleSchema,
  tasksSchema,
  transitionsSchema,
};
