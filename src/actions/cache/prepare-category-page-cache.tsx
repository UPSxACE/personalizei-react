"use server";

import categoryProducts from "../fetch-data/category-products";

export default async function prepareCategoryPageCache(
  categoryId: number,
  pageNumber: number = 1
) {
  //   console.log(
  //     `Preparing cache for category ${categoryId}, page ${pageNumber}...`
  //   );
  await categoryProducts(categoryId, pageNumber, true);
  //   console.log(`Finished caching category ${categoryId}, page ${pageNumber}!`);
}
