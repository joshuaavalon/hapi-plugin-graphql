import { server } from "@hapi/hapi";
import { script } from "@hapi/lab";
import { expect } from "@hapi/code";
import { buildSchema } from "graphql";
import { plugin } from "../index";

import type { Server } from "@hapi/hapi";

const schema = buildSchema(`
  type Query {
    hello: String
  }
`);

const rootValue = {
  hello: () => "Hello world!"
};

export const lab = script();

const { after, before, describe, test } = lab;

describe("query", () => {
  let app: Server;

  before(async () => {
    app = server();
    app.register({
      plugin,
      options: { graphql: { schema, rootValue } }
    });
  });

  after(async () => {
    await app.stop();
  });

  test("application/json", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/graphql",
      payload: '{"query": "{ hello }"}',
      headers: {
        "content-type": "application/json"
      }
    });
    expect(res.statusCode, "statusCode").to.equal(200);
    const { data } = JSON.parse(res.payload);
    expect(data.hello, "data").to.equal("Hello world!");
  });

  test("application/graphql", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/graphql",
      payload: "{ hello }",
      headers: {
        "content-type": "application/graphql"
      }
    });
    expect(res.statusCode, "statusCode").to.equal(200);
    const { data } = JSON.parse(res.payload);
    expect(data.hello, "data").to.equal("Hello world!");
  });
});
