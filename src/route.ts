import { badImplementation, badRequest, boomify, internal } from "@hapi/boom";
import {
  execute,
  formatError,
  GraphQLError,
  parse,
  Source,
  specifiedRules,
  validate,
  validateSchema
} from "graphql";
import { parseBody } from "./parse-body";

import type { Lifecycle, Request } from "@hapi/hapi";
import type {
  DocumentNode,
  ExecutionResult,
  FormattedExecutionResult
} from "graphql";
import type { GraphqlOptions, GraphQLParams, Options } from "./type";

const getGraphQLParams = async (request: Request): Promise<GraphQLParams> => {
  const { query: urlData } = request;
  const bodyData = await parseBody(request);

  // GraphQL Query string.
  let query: string | null = urlData["query"] ?? bodyData.query;

  if (typeof query !== "string") {
    query = null;
  }

  // Parse the variables if needed.
  let variables = (urlData["variables"] ?? bodyData.variables) as {
    readonly [name: string]: unknown;
  } | null;
  if (typeof variables === "string") {
    try {
      variables = JSON.parse(variables);
    } catch {
      throw badRequest("Variables are invalid JSON.");
    }
  } else if (typeof variables !== "object") {
    variables = null;
  }

  // Name of GraphQL operation to execute.
  let operationName =
    urlData["operationName"] ?? (bodyData.operationName as string | null);
  if (typeof operationName !== "string") {
    operationName = null;
  }

  const raw = urlData["raw"] !== null || bodyData.raw !== undefined;

  return { query, variables, operationName, raw };
};

const resolveOptions = async (
  options: Options["graphql"],
  request: Request,
  requestParams?: GraphQLParams
): Promise<GraphqlOptions> => {
  const optionsResult = await Promise.resolve(
    typeof options === "function" ? options(request, requestParams) : options
  );
  return optionsResult;
};

export const route =
  (options: Options["graphql"]): Lifecycle.Method =>
  async (request, h) => {
    let params: GraphQLParams;
    let formatErrorFn = formatError;
    let result: ExecutionResult;
    let statusCode = 200;
    try {
      try {
        params = await getGraphQLParams(request);
      } catch (error: unknown) {
        // When we failed to parse the GraphQL parameters, we still need to get
        // the options object, so make an options call to resolve just that.
        const optionsData = await resolveOptions(options, request);
        formatErrorFn = optionsData.customFormatErrorFn ?? formatErrorFn;
        throw error;
      }
      const { server } = request;
      const optionsData = await resolveOptions(options, request, params);
      const {
        schema,
        rootValue,
        validationRules = [],
        fieldResolver,
        typeResolver,
        extensions: extensionsFn,
        context = { request, h, server }
      } = optionsData;
      formatErrorFn = optionsData.customFormatErrorFn ?? formatErrorFn;

      const { query, variables, operationName } = params;

      // If there is no query, but GraphiQL will be displayed, do not produce
      // a result, otherwise return a 400: Bad Request.
      if (query === null) {
        throw badRequest("Must provide query string.");
      }

      // Validate Schema
      const schemaValidationErrors = validateSchema(schema);
      if (schemaValidationErrors.length > 0) {
        // Return 500: Internal Server Error if invalid schema.
        throw badImplementation("GraphQL schema validation error.", {
          graphqlErrors: schemaValidationErrors
        });
      }

      // Parse source to AST, reporting any syntax error.
      let documentAST: DocumentNode;
      try {
        documentAST = parse(new Source(query, "GraphQL request"));
      } catch (syntaxError: unknown) {
        // Return 400: Bad Request if any syntax errors errors exist.
        throw badRequest("GraphQL syntax error.", {
          graphqlErrors: [syntaxError]
        });
      }

      // Validate AST, reporting any errors.
      const validationErrors = validate(schema, documentAST, [
        ...specifiedRules,
        ...validationRules
      ]);

      if (validationErrors.length > 0) {
        // Return 400: Bad Request if any validation errors exist.
        throw badRequest("GraphQL validation error.", {
          graphqlErrors: validationErrors
        });
      }

      // Perform the execution, reporting any errors creating the context.
      try {
        result = await execute({
          schema,
          document: documentAST,
          rootValue,
          contextValue: context,
          variableValues: variables,
          operationName,
          fieldResolver,
          typeResolver
        });
      } catch (contextError: unknown) {
        // Return 400: Bad Request if any execution context errors exist.
        throw badRequest("GraphQL execution context error.", {
          graphqlErrors: [contextError]
        });
      }

      // Collect and apply any metadata extensions if a function was provided.
      // https://graphql.github.io/graphql-spec/#sec-Response-Format
      if (extensionsFn) {
        const extensions = await extensionsFn({
          document: documentAST,
          variables,
          operationName,
          result,
          context
        });

        if (extensions) {
          result = { ...result, extensions };
        }
      }
    } catch (rawError: unknown) {
      // If an error was caught, report the httpError status, or 500.
      statusCode =
        (rawError as any).status ?? (rawError as any).statusCode ?? 500;
      const error =
        rawError instanceof Error
          ? boomify(rawError, { statusCode })
          : internal(String(rawError));

      const graphqlError = new GraphQLError(
        error.message,
        undefined,
        undefined,
        undefined,
        undefined,
        error
      );
      result = { data: undefined, errors: [graphqlError] };
    }
    // If no data was included in the result, that indicates a runtime query
    // error, indicate as such with a generic status code.
    // Note: Information about the error itself will still be contained in
    // the resulting JSON payload.
    // https://graphql.github.io/graphql-spec/#sec-Data

    if (statusCode === 200 && !result.data) {
      statusCode = 500;
    }

    const formattedResult: FormattedExecutionResult = {
      ...result,
      errors: result.errors?.map(formatErrorFn)
    };

    return h.response(formattedResult).type("application/json");
  };
