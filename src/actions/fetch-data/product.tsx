"use server";

import { cachedValue } from "@/lib/redis";
import serverApi from "@/lib/server-api";
import SECONDS from "@/lib/utils/seconds";
import { AxiosResponse } from "axios";
import { ProductSchema } from "../_schemas/product-schema";

// FIXME: fetch variations? calculate prices.

// throws error if not found
export default async function product(slug: string) {
  return cachedValue(
    `personalizei:product:${slug}`,
    ProductSchema,
    async () => {
      return await serverApi
        .get<Record<string, unknown>[]>("/wp-json/wc/v3/products", {
          params: {
            slug,
            per_page: 20,
            status: "publish",
          },
        })
        .then(({ data, headers }: AxiosResponse<Record<string, unknown>[]>) => {
          const results = data?.map((x) => {
            // @ts-expect-error: typescript is annoying, no error will be raised here
            const link: unknown | undefined = x?._links?.self?.[0]?.href;

            return { ...x, link };
          });

          return ProductSchema.parse(results?.[0]);
        });
    },
    { expirationSeconds: SECONDS.month }
  );
}
