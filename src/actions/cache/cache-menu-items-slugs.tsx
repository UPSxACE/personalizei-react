"use server";

import { getRedisInstance, getRedisMutex } from "@/lib/redis";
import { NodeSchemaType } from "../_schemas/menu-item-schema";
import prepareSlugsCache from "./prepare-slugs-cache";

/** NOTE: Be careful with racing conditions (it calls prepareSlugCache function) */
export async function cacheMenuItemsSlugs(
  nodes: NodeSchemaType[],
  onBackground: boolean = true
) {
  const keyValuePairs: {
    category: (string | number)[];
    tag: (string | number)[];
  } = { category: [], tag: [] };
  nodes.forEach((node) => {
    const type = node.uri?.startsWith("/categoria-produto")
      ? "category"
      : node.uri?.startsWith("/produto-etiqueta")
      ? "tag"
      : "other";

    if (type !== "other" && node.connectedNode && node.uri) {
      const id = node.connectedNode.node.databaseId;
      const slug =
        type === "category"
          ? node.uri.replace("/categoria-produto/", "")
          : node.uri.replace("/produto-etiqueta/", "");
      keyValuePairs[type].push(slug, id);
    }
  });

  await prepareSlugsCache("category", keyValuePairs["category"], onBackground);
  await prepareSlugsCache("tag", keyValuePairs["tag"], onBackground);
}

/** NOTE: This version does not have an issue with racing conditions, but it adquires
 *        it's own MUTEX and WATCH command. Be CAREFUL to not DEAD LOCK the server.
 *
 *        It will only attempt once, and errors will be silent.
 */
export async function cacheMenuItemsSlugsSafe(
  nodes: NodeSchemaType[],
  onBackground: boolean = true
) {
  const redis = getRedisInstance(onBackground);
  const mutex = getRedisMutex(onBackground);

  redis.watch("personalizei:category-slugs");
  redis.watch("personalizei:tag-slugs");

  await mutex
    .runExclusive(async () => {
      const keyValuePairs: {
        category: (string | number)[];
        tag: (string | number)[];
      } = { category: [], tag: [] };
      nodes.forEach((node) => {
        const type = node.uri?.startsWith("/categoria-produto")
          ? "category"
          : node.uri?.startsWith("/produto-etiqueta")
          ? "tag"
          : "other";

        if (type !== "other" && node.connectedNode && node.uri) {
          const id = node.connectedNode.node.databaseId;
          const slug =
            type === "category"
              ? node.uri.replace("/categoria-produto/", "")
              : node.uri.replace("/produto-etiqueta/", "");
          keyValuePairs[type].push(slug, id);
        }
      });

      await prepareSlugsCache(
        "category",
        keyValuePairs["category"],
        onBackground
      );
      await prepareSlugsCache("tag", keyValuePairs["tag"], onBackground);
    })
    .then(async (result) => {
      await redis.unwatch();
      return result;
    })
    .catch(async (err) => {
      await redis.unwatch();
      throw err;
    });
}
