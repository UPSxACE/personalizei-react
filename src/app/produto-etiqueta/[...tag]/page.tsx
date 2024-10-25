import prepareProductsCache from "@/actions/cache/prepare-products-cache";
import prepareTagPageCache from "@/actions/cache/prepare-tag-page-cache";
import tagId from "@/actions/fetch-data/tag-id";
import tagProducts from "@/actions/fetch-data/tag-products";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

// export const revalidate = process.env.NODE_ENV === "production" ? 300 : 0;
export const revalidate = 0;

export default async function TagPage({
  params,
}: {
  params: { tag: string[] };
}) {
  function resolveSlugs() {
    const len = params.tag.length;
    if (len > 2) {
      const beforeLast = params.tag[len - 2];
      if (beforeLast === "page") {
        const productSlugs = params.tag.slice(0, -2);
        const page = Number(params.tag[len - 1]);

        if (isNaN(page)) {
          return redirect(`/produto-etiqueta/${productSlugs.join("/")}`);
        }

        return {
          productSlugs,
          page,
        };
      }
    }

    return {
      productSlugs: params.tag,
      page: 1,
    };
  }

  const { productSlugs, page } = resolveSlugs();

  // 1. convert slug to id
  const id = await tagId(productSlugs);
  if (!id) return notFound();
  // 2. fetch products from category
  const { products, totalPages, totalProducts } = await tagProducts(id, page);

  if (page > totalPages) {
    return redirect(`/produto-etiqueta/${productSlugs.join("/")}`);
  }

  // asynchronously prepare next page cache
  if (page < totalPages) prepareTagPageCache(id, page + 1);
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
            href={`/produto-etiqueta/${productSlugs.join("/")}/page/${
              page - 1
            }`}
          >
            Anterior
          </Link>
        )}
        {page < totalPages && (
          <Link
            href={`/produto-etiqueta/${productSlugs.join("/")}/page/${
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
