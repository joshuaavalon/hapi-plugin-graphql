import { parseBody } from "./parse-body";
import { graphqlError } from "./error";

import type { Request, RequestQuery } from "@hapi/hapi";
import type { GraphQLParams } from "./type";

type Variables = Record<string, unknown>;
type BodyData = Record<string, unknown>;

const parseQuery = (
  requestQuery: RequestQuery,
  bodyData: BodyData
): string | null => {
  const query = requestQuery["query"] ?? bodyData.query;
  return typeof query === "string" ? query : null;
};

const parseVariables = (
  requestQuery: RequestQuery,
  bodyData: BodyData
): Variables => {
  const variables = requestQuery["variables"] ?? bodyData.variables;
  if (typeof variables === "string") {
    try {
      return JSON.parse(variables);
    } catch (e) {
      throw graphqlError(400, "Invalid variables", e);
    }
  }
  return typeof variables === "object" ? variables : {};
};

const parseOperationName = (
  requestQuery: RequestQuery,
  bodyData: BodyData
): string | null => {
  const operationName = requestQuery["operationName"] ?? bodyData.operationName;
  return typeof operationName === "string" ? operationName : null;
};

export const getGraphQLParams = async (
  request: Request
): Promise<GraphQLParams> => {
  const { query: urlData } = request;
  const bodyData = await parseBody(request);

  // GraphQL Query string.
  const query = parseQuery(urlData, bodyData);

  // Parse the variables if needed.
  const variables = parseVariables(urlData, bodyData);

  // Name of GraphQL operation to execute.
  const operationName = parseOperationName(urlData, bodyData);

  const raw = urlData["raw"] !== null || bodyData.raw !== undefined;

  return { query, variables, operationName, raw };
};
