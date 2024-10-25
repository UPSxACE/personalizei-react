import Header from "@/components/layout/header";

// export const revalidate = process.env.NODE_ENV === "production" ? 300 : 0;
export const revalidate = 0;

export default async function Home() {
  return (
    <>
      <Header />
    </>
  );
}
