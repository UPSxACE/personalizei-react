"use server";

import { getRedisInstance } from "@/lib/redis";

// NOTE: this one doesn't use redis MUTEX!! Be careful with racing conditions.
export default async function prepareSlugsCache(
  type: "category" | "tag",
  keyValuePairs: (string | number)[],
  onBackground: boolean = true
) {
  const redis = getRedisInstance(onBackground);

  const hash =
    type === "category"
      ? "personalizei:category-slugs"
      : "personalizei:tag-slugs";

  const keysOnly = keyValuePairs.filter((x, i) => i % 2 === 0);

  const allReady =
    (await redis.allHashFieldsExist(keysOnly.length + 1, hash, ...keysOnly)) ===
    1;
  if (!allReady) console.log("Regenerating slugs...");
  if (!allReady) await redis.hmset(hash, ...keyValuePairs);
}
