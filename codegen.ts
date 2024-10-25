import type { CodegenConfig } from "@graphql-codegen/cli";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
// NOTE: use basic auth with application password to authenticate (Authorization header)
const config: CodegenConfig = {
  ignoreNoDocuments: true,
  overwrite: true,
  schema: {
    [process.env.GRAPHQL_URL ?? ""]: {
      headers: {
        Authorization: process.env.AUTH_HEADER ?? "",
      },
    },
  },
  documents: ["src/**/*.tsx"],
  generates: {
    "./src/gql/introspection.json": {
      plugins: ["urql-introspection"],
    },
    "./src/gql/": {
      preset: "client",
    },
    // "./src/gql/types.ts": {
    //   plugins: ["typescript"],
    //   config: {
    //     avoidOptionals: true,
    //   },
    // },
  },
};
export default config;
