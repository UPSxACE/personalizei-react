"use server";

import { cachedHashValue } from "@/lib/redis";
import serverApi from "@/lib/server-api";
import { AxiosResponse } from "axios";
import { z } from "zod";

const ProductPreviewSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    slug: z.string(),
    catalog_visibility: z.string(),
    price: z.string().or(z.number()),
    price_html: z.string(),
    link: z.string(),
  })
  .array();

const CategoryProductsSchema = z.object({
  products: ProductPreviewSchema,
  totalProducts: z.number(),
  totalPages: z.number(),
});

export default async function categoryProducts(
  categoryId: number,
  pageNumber: number = 1,
  inBackground?: boolean,
  checkContinue?: () => Promise<boolean>
) {
  return cachedHashValue(
    `personalizei:category-products:${categoryId}`,
    `${pageNumber}`,
    CategoryProductsSchema,
    async () => {
      return await serverApi
        .get<Record<string, unknown>[]>("/wp-json/wc/v3/products", {
          params: {
            category: categoryId,
            page: pageNumber,
            per_page: 20,
            status: "publish",
          },
        })
        .then(({ data, headers }: AxiosResponse<Record<string, unknown>[]>) => {
          const products = data?.map((x) => {
            const { id, name, slug, catalog_visibility, price, price_html } = x;

            // @ts-expect-error: typescript is annoying, no error will be raised here
            const link: unknown | undefined = x?._links?.self?.[0]?.href;

            return {
              id,
              name,
              slug,
              catalog_visibility,
              price,
              price_html,
              link,
            };
          });

          const totalProducts = JSON.parse(headers["x-wp-total"]);
          const totalPages = JSON.parse(headers["x-wp-totalpages"]);

          return CategoryProductsSchema.parse({
            products,
            totalProducts,
            totalPages,
          });
        });
    },
    { inBackground, checkContinue }
  );
}
