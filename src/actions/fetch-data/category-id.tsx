"use server";

import { cachedHashValue } from "@/lib/redis";
import serverApi from "@/lib/server-api";
import { z } from "zod";

export default async function categoryId(categorySlugs: string[]) {
  return cachedHashValue(
    `personalizei:category-slugs`,
    `${categorySlugs.join("/")}`,
    z.number(),
    async () => {
      const lastSlug = categorySlugs[categorySlugs.length - 1];
      if (!lastSlug) return null;

      const id = await serverApi
        .get<Record<string, unknown>[]>("/wp-json/wc/v3/products/categories", {
          params: {
            slug: lastSlug,
          },
        })
        .then(({ data }: { data: Record<string, unknown>[] }) => {
          return data?.[0]?.id;
        });

      if (typeof id === "number") return id;

      return null;
    }
  );
}
