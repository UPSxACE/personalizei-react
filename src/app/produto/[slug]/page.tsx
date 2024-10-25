import product from "@/actions/fetch-data/product";
import Image from "next/image";
import { notFound } from "next/navigation";

export default async function ProductPage({
  params,
}: {
  params: { slug: string };
}) {
  const productData = await product(params.slug).catch(() => null);
  if (!productData) {
    return notFound();
  }

  const { name, price_html, images, description } = productData;

  return (
    <div className="max-w-screen-sm flex flex-col gap-3">
      <div className="flex">
        <h1>{name}</h1>
        <div
          className="ml-auto"
          dangerouslySetInnerHTML={{ __html: price_html }}
        />
      </div>
      {images.length > 0 && (
        <Image
          width={300}
          height={300}
          className="object-contain"
          src={images[0].src}
          alt={images[0].alt}
        />
      )}
      <div dangerouslySetInnerHTML={{ __html: description }} />
    </div>
  );
}
