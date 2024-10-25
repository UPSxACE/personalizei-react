"use server";

import { getRedisInstance, getRedisMutex } from "@/lib/redis";
import serverApi from "@/lib/server-api";
import SECONDS from "@/lib/utils/seconds";
import { AxiosResponse } from "axios";
import { ProductSchema } from "../_schemas/product-schema";

export default async function prepareProductsCache(
  slugIdPairs: [slug: string, id: number][]
) {
  const hashSlugToKey: Record<string, string> = {};
  const hashKeyToSlug: Record<string, string> = {};
  const hashKeyToId: Record<string, number> = {};
  const watchList = slugIdPairs.map((x) => {
    const key = `personalizei:product:${x[0]}`;
    hashSlugToKey[x[0]] = key;
    hashKeyToSlug[key] = x[0];
    hashKeyToId[key] = x[1];
    return key;
  });

  const redis = getRedisInstance(true);
  const mutex = getRedisMutex(true);

  // unlike normal cache actions, because this was made manually, by choice this will only attempt once.
  await mutex
    .runExclusive(async () => {
      await redis.watch(watchList);
      const missingKeys = await redis.missingKeys(
        watchList.length,
        ...watchList
      );

      if (!missingKeys || missingKeys.length === 0) return;

      console.log(`Preparing cache for ${missingKeys.length} products...`);

      const idsToFetch = missingKeys.map((key) => hashKeyToId[key]);
      const products = await serverApi
        .get<Record<string, unknown>[]>("/wp-json/wc/v3/products", {
          params: {
            include: idsToFetch.join(","),
            per_page: missingKeys.length,
            status: "publish",
          },
        })
        .then(({ data, headers }: AxiosResponse<Record<string, unknown>[]>) => {
          const results = data?.map((x) => {
            // @ts-expect-error: typescript is annoying, no error will be raised here
            const link: unknown | undefined = x?._links?.self?.[0]?.href;

            return { ...x, link };
          });

          return ProductSchema.array()
            .length(missingKeys.length)
            .parse(results);
        });

      const transactionKeyValues = products.reduce<(string | number)[]>(
        (acc, curr) => {
          acc.push(hashSlugToKey[curr.slug], JSON.stringify(curr));
          return acc;
        },
        []
      );

      const _transaction = await redis.multi().mset(...transactionKeyValues);
      missingKeys.forEach((key) => _transaction.expire(key, SECONDS.month));
      const transaction = await _transaction.exec();

      if (transaction === null) {
        // operation failed due to WATCH
        throw new Error("Operation failed, due to WATCH statement");
      }
      const [error] = transaction[0];
      if (error) {
        throw error;
      }

      console.log(
        `Finished preparing the cache for ${missingKeys.length} products!`
      );
    })
    .then(async (result) => {
      await redis.unwatch();
      return result;
    })
    .catch(async (err) => {
      await redis.unwatch();
      //   throw err; // NOTE: Silent error
    });
}
