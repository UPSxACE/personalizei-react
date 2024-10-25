"use server";

import tagProducts from "../fetch-data/tag-products";

export default async function prepareTagPageCache(
  tagId: number,
  pageNumber: number = 1
) {
  //   console.log(`Preparing cache for tag ${tagId}, page ${pageNumber}...`);
  await tagProducts(tagId, pageNumber, true);
  //   console.log(`Finished caching tag ${tagId}, page ${pageNumber}!`);
}
