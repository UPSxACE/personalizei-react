import { z } from "zod";

export const ProductSchema = z.object({
  id: z.number(),
  type: z.string(),
  name: z.string(),
  description: z.string(),
  slug: z.string(),
  catalog_visibility: z.string(),
  price: z.string().or(z.number()),
  price_html: z.string(),
  link: z.string(),
  tax_status: z.string(),
  images: z
    .object({
      id: z.number(),
      src: z.string(),
      name: z.string(),
      alt: z.string(),
    })
    .array(),
  attributes: z
    .object({
      id: z.number(), // often 0
      name: z.string(),
      slug: z.string(),
      position: z.number(),
      visible: z.boolean(),
      variation: z.boolean(),
      options: z.string().array(),
    })
    .array(),
  // TODO: defaultAttributes???
  variations: z.number().array(),
  meta_data: z
    .object({
      id: z.number(),
      key: z.string(),
      value: z.any(),
    })
    .array(),
  stock_status: z.string(),
  has_options: z.boolean(),
  // TODO: tiered pricing
  // TODO: yoast SEO
});
