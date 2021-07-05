import { GraphQLError } from "graphql";
import { Boom, boomify } from "@hapi/boom";

type Maybe<T> = null | undefined | T;
type GraphQLErrorData = {
  isGraphQLError: true;
};

export const isGraphQLError = (
  error: Boom<any>
): error is GraphQLError & Boom<GraphQLErrorData> =>
  Boolean(error.data?.isGraphQLError);

export const graphqlError = (
  statusCode: number,
  message: string,
  originalError?: Maybe<Error & GraphQLError>,
  extensions: Maybe<Record<string, unknown>> = {}
): GraphQLError & Boom<GraphQLErrorData> => {
  let ext = extensions;
  if (originalError && originalError.extensions) {
    if (typeof originalError.extensions === "object") {
      ext = { ...originalError.extensions, ...extensions };
    }
  }
  const error = new GraphQLError(
    message,
    undefined,
    undefined,
    undefined,
    undefined,
    originalError,
    ext
  );
  return boomify(error, {
    statusCode,
    message,
    data: { isGraphQLError: true }
  });
};
