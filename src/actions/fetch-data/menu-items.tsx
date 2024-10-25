"use server";
import { graphql } from "@/gql";
import gqlApi from "@/lib/gql-api";
import { cachedValue } from "@/lib/redis";
import { Hashmap } from "@/lib/utils/hashmap";
// import axios from "axios";
import "server-only";
import { z } from "zod";
import prepareSlugsCache from "../cache/prepare-slugs-cache";
import { NodeArraySchema, NodeSchemaType } from "../_schemas/menu-item-schema";

const menuItemsFlatQueryDocument = graphql(`
  query AllMenuItemsFlatQuery($cursor: String) {
    menuItems(where: { location: PRIMARY }, first: 100, after: $cursor) {
      nodes {
        id
        databaseId
        parentId
        label
        uri
        isRestricted
        connectedNode {
          node {
            id
            databaseId
          }
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`);

const menuItemsMetaQueryDocument = graphql(`
  query MenuItemsMetaQuery($ids: [Int]!) {
    getMenuItemMeta(menuItemIds: $ids) {
      canSee
      id: postId
      whichUsers
      roles
    }
  }
`);

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

export async function getMenuItems() {
  return await cachedValue(
    "personalizei:menu-items",
    NodeArraySchema,
    async () => {
      const client = gqlApi();
      // fetch menuItem nodes
      const menuItemsDocs = await client.query(menuItemsFlatQueryDocument, {
        cursor: null,
      });
      let nodes = menuItemsDocs.data?.menuItems?.nodes ?? [];
      let cursor = menuItemsDocs.data?.menuItems?.pageInfo?.endCursor;
      while (cursor) {
        // continue fetching in case there is more pages
        const result = await client.query(menuItemsFlatQueryDocument, {
          cursor,
        });
        nodes = [...nodes, ...(result.data?.menuItems?.nodes ?? [])];
        cursor = result.data?.menuItems?.pageInfo?.endCursor;
      }

      // fetch the metadata to get the access control info
      const ids = nodes.map((x) => x.databaseId);
      const menuItemMetaDocs = await client.query(menuItemsMetaQueryDocument, {
        ids,
      });

      const menuItemMetaNodes = menuItemMetaDocs.data?.getMenuItemMeta ?? [];
      const menuItemMetaNodesHashmap = menuItemMetaNodes.reduce<
        Hashmap<number, number>
      >((acc, curr, index) => {
        // maps id to index in array
        acc[curr.id] = index;
        return acc;
      }, {});

      const nodesWithUriTrimmed = nodes.map((node) => {
        if (node.uri && node.uri.length > 1 && node.uri.slice(-1) === "/") {
          node.uri = node.uri.slice(0, -1);
        }
        return node;
      });

      // attach metadata to nodes
      const nodesWithMeta = nodesWithUriTrimmed.map((node) => {
        if (node.databaseId in menuItemMetaNodesHashmap) {
          const index = menuItemMetaNodesHashmap[node.databaseId];
          return { ...node, meta: menuItemMetaNodes[index] };
        }
        return node;
      });

      // Use this opportunity to cache all the slugs

      // NOTE
      // There will be no racing condition due to the fact that this callback will be executed
      // AFTER the WATCH but BEFORE the EXEC.
      // In case menu-items was updated, this callback will be rerun with the newest up to date values
      await cacheMenuItemsSlugs(nodesWithMeta);

      // build hierarchy
      type NodeWithMeta = (typeof nodesWithMeta)[0];
      type NodeWithChildren = NodeWithMeta & { children?: NodeWithChildren[] };
      const nodesWithChildren: NodeWithChildren[] = nodesWithMeta;
      const nodesWithMetaHashmap = nodesWithMeta.reduce<
        Hashmap<string, number>
      >((acc, curr, index) => {
        // maps id to index in array
        acc[curr.id] = index;
        return acc;
      }, {});
      const nodesTree: NodeWithChildren[] = [];
      nodesWithChildren.forEach((node) => {
        const parentId = node.parentId;

        // if parentless, then its toplevel
        if (!parentId) return nodesTree.push(node);

        // if has parent, then set children on the parent
        const index = nodesWithMetaHashmap[parentId];
        if (!nodesWithChildren[index].children) {
          nodesWithChildren[index].children = [];
        }
        nodesWithChildren[index].children.push(node);
      });

      return nodesTree;
    }
  );
}
