import prepareCategoryPageCache from "@/actions/cache/prepare-category-page-cache";
import prepareProductsCache from "@/actions/cache/prepare-products-cache";
import categoryId from "@/actions/fetch-data/category-id";
import categoryProducts from "@/actions/fetch-data/category-products";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

// export const revalidate = process.env.NODE_ENV === "production" ? 300 : 0;
export const revalidate = 0;

export default async function CategoryPage({
  params,
}: {
  params: { category: string[] };
}) {
  function resolveSlugs() {
    const len = params.category.length;
    if (len > 2) {
      const beforeLast = params.category[len - 2];
      if (beforeLast === "page") {
        const productSlugs = params.category.slice(0, -2);
        const page = Number(params.category[len - 1]);

        if (isNaN(page)) {
          return redirect(`/categoria-produto/${productSlugs.join("/")}`);
        }

        return {
          productSlugs,
          page,
        };
      }
    }

    return {
      productSlugs: params.category,
      page: 1,
    };
  }

  const { productSlugs, page } = resolveSlugs();

  // 1. convert slug to id
  const id = await categoryId(productSlugs);
  if (!id) return notFound();
  // 2. fetch products from category
  const { products, totalPages, totalProducts } = await categoryProducts(
    id,
    page
  );

  if (page > totalPages) {
    return redirect(`/categoria-produto/${productSlugs.join("/")}`);
  }

  // asynchronously prepare next page cache
  if (page < totalPages) prepareCategoryPageCache(id, page + 1);
  // asynchronously prepare product pages cache
  prepareProductsCache(products.map((x) => [x.slug, x.id]));

  return (
    <div>
      <h1>Total products: {totalProducts}</h1>
      <h2>
        Page: {page} of {totalPages}
      </h2>
      <div className="flex gap-4">
        {page > 1 && (
          <Link
            href={`/categoria-produto/${productSlugs.join("/")}/page/${
              page - 1
            }`}
          >
            Anterior
          </Link>
        )}
        {page < totalPages && (
          <Link
            href={`/categoria-produto/${productSlugs.join("/")}/page/${
              page + 1
            }`}
          >
            Próximo
          </Link>
        )}
      </div>
      <ul>
        {products.map((x, i) => (
          <li key={i}>
            <Link href={`/produto/${x.slug}`}>
              {x.name}{" "}
              <span dangerouslySetInnerHTML={{ __html: x.price_html }} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
