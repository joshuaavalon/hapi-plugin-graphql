import type {
  DocumentNode,
  FormattedExecutionResult,
  GraphQLError,
  GraphQLFieldResolver,
  GraphQLFormattedError,
  GraphQLSchema,
  GraphQLTypeResolver,
  ValidationRule
} from "graphql";
import type { Request, RouteOptions, RouteOptionsCors, Util } from "@hapi/hapi";

type MaybePromise<T> = Promise<T> | T;

export type Options = {
  method?: Util.HTTP_METHODS_PARTIAL | Util.HTTP_METHODS_PARTIAL[];
  /**
   * Path of the Graphql API. Default to "/graphql".
   */
  path?: string;
  vhost?: string;
  route?: RouteOptions;
  cors?: boolean | RouteOptionsCors;
  graphql:
    | ((
        request: Request,
        params?: GraphQLParams
      ) => MaybePromise<GraphqlOptions>)
    | MaybePromise<GraphqlOptions>;
};

export interface GraphqlOptions {
  /**
   * A GraphQL schema from graphql-js.
   */
  schema: GraphQLSchema;
  /**
   * A value to pass as the context to this middleware.
   */
  context?: unknown;

  /**
   * An object to pass as the rootValue to the graphql() function.
   */
  rootValue?: unknown;

  /**
   * An optional array of validation rules that will be applied on the document
   * in additional to those defined by the GraphQL spec.
   */
  validationRules?: ReadonlyArray<ValidationRule>;

  /**
   * An optional function which will be used to format any errors produced by
   * fulfilling a GraphQL operation. If no function is provided, GraphQL's
   * default spec-compliant `formatError` function will be used.
   */
  customFormatErrorFn?: (error: GraphQLError) => GraphQLFormattedError;

  /**
   * An optional function for adding additional metadata to the GraphQL response
   * as a key-value object. The result will be added to "extensions" field in
   * the resulting JSON. This is often a useful place to add development time
   * info such as the runtime of a query or the amount of resources consumed.
   *
   * Information about the request is provided to be used.
   *
   * This function may be async.
   */
  extensions?: (
    info: RequestInfo
  ) => MaybePromise<undefined | { [key: string]: unknown }>;

  /**
   * A resolver function to use when one is not provided by the schema.
   * If not provided, the default field resolver is used (which looks for a
   * value or method on the source value with the field's name).
   */
  fieldResolver?: GraphQLFieldResolver<unknown, unknown>;

  /**
   * A type resolver function to use when none is provided by the schema.
   * If not provided, the default type resolver is used (which looks for a
   * `__typename` field or alternatively calls the `isTypeOf` method).
   */
  typeResolver?: GraphQLTypeResolver<unknown, unknown>;
}

export interface GraphQLParams {
  query: string | null;
  variables: { readonly [name: string]: unknown } | null;
  operationName: string | null;
  raw: boolean;
}

/**
 * All information about a GraphQL request.
 */
export interface RequestInfo {
  /**
   * The parsed GraphQL document.
   */
  document: DocumentNode;

  /**
   * The variable values used at runtime.
   */
  variables: { readonly [name: string]: unknown } | null;

  /**
   * The (optional) operation name requested.
   */
  operationName: string | null;

  /**
   * The result of executing the operation.
   */
  result: FormattedExecutionResult;

  /**
   * A value to pass as the context to the graphql() function.
   */
  context?: unknown;
}
