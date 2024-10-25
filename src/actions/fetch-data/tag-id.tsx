"use server";

import { cachedHashValue } from "@/lib/redis";
import serverApi from "@/lib/server-api";
import { z } from "zod";

export default async function tagId(tagSlugs: string[]) {
  return cachedHashValue(
    `personalizei:tag-slugs`,
    `${tagSlugs.join("/")}`,
    z.number(),
    async () => {
      const lastSlug = tagSlugs[tagSlugs.length - 1];
      if (!lastSlug) return null;

      const id = await serverApi
        .get<Record<string, unknown>[]>("/wp-json/wc/v3/products/tags", {
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
