import { route } from "./route";

import type { Plugin } from "@hapi/hapi";
import type { Options } from "./type";

export const plugin: Plugin<Options> = {
  pkg: require("../package.json"),
  dependencies: [],
  register: async (server, options) => {
    const { method = "POST", path = "/graphql", graphql, ...others } = options;
    server.route({
      method,
      path,
      handler: route(graphql),
      options: {
        payload: {
          parse: "gunzip",
          allow: ["application/json", "application/graphql"]
        }
      },
      ...others
    });
  }
};
