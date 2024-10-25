// import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
// import "server-only";

// const AXIOS_CONFIG = {
//   baseURL: process.env.GRAPHQL_URL,
//   timeout: 10000,
//   withCredentials: true,
// };

// const api = axios.create(AXIOS_CONFIG);

// // wrapper
// const gqlApi = function <
//   T = unknown,
//   R = AxiosResponse<T, unknown>,
//   D = unknown
// >(data?: D, config?: AxiosRequestConfig<{ query: D | undefined }>): Promise<R> {
//   return api.post<T, R, { query: D | undefined }>("", { query: data }, config);
// };

// export default gqlApi;
import introspection from "@/gql/introspection.json";
import { createClient, fetchExchange } from "@urql/core";
import { cacheExchange } from "@urql/exchange-graphcache";
import { registerUrql } from "@urql/next/rsc";
import "server-only";

const makeClient = () => {
  return createClient({
    url: process.env.GRAPHQL_URL ?? "",
    exchanges: [cacheExchange({ schema: introspection }), fetchExchange],
    // fetchOptions: {
    //   headers: {
    //     Authorization: process.env.AUTH_HEADER ?? "",
    //   },
    // },
  });
};

const { getClient } = registerUrql(makeClient);

const gqlApi = getClient;

export default gqlApi;
