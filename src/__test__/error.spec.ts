import { server } from "@hapi/hapi";
import { script } from "@hapi/lab";
import { expect } from "@hapi/code";
import { buildSchema, GraphQLError } from "graphql";
import { plugin } from "../index";

import type { Server } from "@hapi/hapi";

const schema = buildSchema(`
  type Query {
    hello: String
  }
`);

const rootValue = {
  hello: () => {
    throw new GraphQLError(
      "hello",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        code: "world"
      }
    );
  }
};

export const lab = script();

const { after, before, describe, test } = lab;

describe("error", () => {
  let app: Server;

  before(async () => {
    app = server();
    app.register({
      plugin,
      options: { graphql: { schema, rootValue, okStatusOnError: false } }
    });
  });

  after(async () => {
    await app.stop();
  });

  test("invalid query", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/graphql",
      payload: '{"query": "{ hello"}',
      headers: {
        "content-type": "application/json"
      }
    });
    expect(res.statusCode, "statusCode").to.equal(400);
    const { errors } = JSON.parse(res.payload);
    console.log(res.payload);
    expect(errors[0].message, "error message").to.equal("GraphQL syntax error");
  });

  test("extensions", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/graphql",
      payload: "{ hello }",
      headers: {
        "content-type": "application/graphql"
      }
    });
    expect(res.statusCode, "statusCode").to.equal(200);
    const { errors } = JSON.parse(res.payload);
    expect(errors[0].message, "error message").to.equal("hello");
    expect(errors[0].extensions.code, "extensions").to.equal("world");
  });
});
