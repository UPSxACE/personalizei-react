"use server";

import { getRedisInstance } from "@/lib/redis";
import SECONDS from "@/lib/utils/seconds";
import categoryProducts from "../fetch-data/category-products";
import { getMenuItems } from "../fetch-data/menu-items";
import tagProducts from "../fetch-data/tag-products";
import { cacheMenuItemsSlugsSafe } from "./cache-menu-items-slugs";

type MenuItems = Awaited<ReturnType<typeof getMenuItems>>;
export default async function prepareAllCategoriesCache(menuItems: MenuItems) {
  let checkSlugs = true;

  const redis = getRedisInstance(true);

  const ids: string[] = [];
  const flatMenuItems: MenuItems = [];
  const recursiveLookup = (item: MenuItems[0]) => {
    const type = item.uri?.startsWith("/categoria-produto")
      ? "category"
      : item.uri?.startsWith("/produto-etiqueta")
      ? "tag"
      : "other";

    if (type !== "other" && item.connectedNode) {
      const transformCategory = (id: number) =>
        `personalizei:category-products:${id}`;
      const transformTag = (id: number) => `personalizei:tag-products:${id}`;

      const id = item.connectedNode.node.databaseId;
      ids.push(type === "category" ? transformCategory(id) : transformTag(id));
    }

    flatMenuItems.push(item);
    item.children?.forEach(recursiveLookup);
  };
  menuItems.forEach(recursiveLookup);

  const missingKeys = await redis.missingKeys(ids.length, ...ids);

  if (missingKeys && missingKeys.length > 0) {
    console.log(
      "Total of category/tag cached pages missing:",
      missingKeys.length
    );

    const now = String(Date.now());
    const prepareLock = await redis.get(
      "personalizei:prepare-category-tag-pages-lock"
    );
    if (prepareLock) {
      console.log("prepare-category-tag-pages-lock is locked");
      return;
    }

    await redis.setex(
      "personalizei:prepare-category-tag-pages-lock",
      5 * SECONDS.minute,
      now
    );
    const checkContinue = async () => {
      const continueFetching =
        now ===
        (await redis.get("personalizei:prepare-category-tag-pages-lock"));

      return continueFetching;
    };

    let count = 0;

    console.log(
      `Preparing cache for ${missingKeys.length} category/tag pages from the menu items...`
    );

    try {
      for (const key of missingKeys) {
        if (key.startsWith("personalizei:category-products:")) {
          await categoryProducts(
            Number(key.replace("personalizei:category-products:", "")),
            1,
            true,
            checkContinue
          );
        }
        if (key.startsWith("personalizei:tag-products:")) {
          await tagProducts(
            Number(key.replace("personalizei:tag-products:", "")),
            1,
            true,
            checkContinue
          );
        }
        count++;
        console.log(
          `Finished caching the page for ${key}! (${count} of ${missingKeys.length} done)`
        );
      }
    } catch (error) {
      checkSlugs = false;

      console.log(
        "The lock was removed (or an unexpected error occurred). Interrupted caching."
      );
    }

    // NOTE: very small chance of a harmless racing condition (would interrupt the preparation of cache)
    await redis.del("personalizei:prepare-category-tag-pages-lock");
  }

  if (checkSlugs) {
    // regenerate slugs
    await cacheMenuItemsSlugsSafe(flatMenuItems, true);
  }
}
