import prepareAllCategoriesCache from "@/actions/cache/prepare-all-categories-cache";
import { getMenuItems } from "@/actions/fetch-data/menu-items";
import Link from "next/link";
import { Fragment } from "react";

export default async function Header() {
  const menuItems = await getMenuItems();
  prepareAllCategoriesCache(menuItems);

  // console.log(menuItems);
  const renderList: Parameters<typeof menuItems.map<JSX.Element>>[0] = (
    x,
    i
  ) => {
    return (
      <Fragment key={i}>
        <li className="ml-7">
          <Link href={x.uri ?? "#"}>{x.label}</Link>
        </li>
        {x.children && (
          <ul className="list-disc ml-7">{x.children.map(renderList)}</ul>
        )}
      </Fragment>
    );
  };

  return (
    <header>
      <ul className="list-disc">{menuItems.map(renderList)}</ul>
    </header>
  );
}
