import { z } from "zod";

// based on NodeWithChildren from getMenuItems()
export const NodeBaseSchema = z.object({
  id: z.string(),
  databaseId: z.number(),
  parentId: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
  uri: z.string().nullable().optional(),
  isRestricted: z.boolean().nullable().optional(),
  connectedNode: z
    .object({ node: z.object({ id: z.string(), databaseId: z.number() }) })
    .nullable()
    .optional(),
});
export type NodeSchemaType = z.infer<typeof NodeBaseSchema> & {
  children?: NodeSchemaType[];
};
export const NodeSchema: z.ZodType<NodeSchemaType> = NodeBaseSchema.extend({
  children: z.lazy(() => NodeSchema.array().optional()),
});
export const NodeArraySchema = NodeSchema.array();
