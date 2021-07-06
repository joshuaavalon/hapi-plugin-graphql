import { GraphQLError } from "graphql";
import { Boom, boomify } from "@hapi/boom";

type Maybe<T> = null | undefined | T;

export const graphqlError = (
  statusCode: number,
  message: string,
  originalError?: Maybe<Error & GraphQLError>,
  extensions?: Maybe<Record<string, unknown>>
): GraphQLError & Boom => {
  const error = new GraphQLError(
    message,
    undefined,
    undefined,
    undefined,
    undefined,
    originalError,
    extensions
  );
  return boomify(error, { statusCode });
};
