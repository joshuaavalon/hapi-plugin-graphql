import { isBoom } from "@hapi/boom";
import {
  execute,
  formatError,
  GraphQLSchema,
  parse,
  Source,
  specifiedRules,
  validate,
  validateSchema
} from "graphql";

import { getGraphQLParams } from "./parse-request";
import { graphqlError, isGraphQLError } from "./error";

import type { Lifecycle, Request } from "@hapi/hapi";
import type {
  DocumentNode,
  ExecutionResult,
  FormattedExecutionResult,
  ValidationRule
} from "graphql";
import type { GraphqlOptions, GraphQLParams, Options } from "./type";

const resolveOptions = async (
  options: Options["graphql"],
  request: Request,
  requestParams?: GraphQLParams
): Promise<GraphqlOptions> =>
  typeof options === "function" ? options(request, requestParams) : options;

const validateGraphQLSchema = (schema: GraphQLSchema): void => {
  const validationErrors = validateSchema(schema);
  if (validationErrors.length > 0) {
    // Return 500: Internal Server Error if invalid schema.
    throw graphqlError(500, "Invalid GraphQL schema", undefined, {
      validationErrors
    });
  }
};

const parseQuery = (query: string): DocumentNode => {
  try {
    return parse(new Source(query, "request"));
  } catch (e) {
    // Return 400: Bad Request if any syntax errors errors exist.
    throw graphqlError(400, "GraphQL syntax error", e);
  }
};

const validateDocumentAST = (
  schema: GraphQLSchema,
  documentAST: DocumentNode,
  validationRules: readonly ValidationRule[]
): void => {
  const validationErrors = validate(schema, documentAST, [
    ...specifiedRules,
    ...validationRules
  ]);
  if (validationErrors.length > 0) {
    // Return 400: Bad Request if any validation errors exist.
    throw graphqlError(400, "Invalid GraphQL", undefined, {
      validationErrors
    });
  }
};

export const route =
  (options: Options["graphql"]): Lifecycle.Method =>
  async (request, h) => {
    let params: GraphQLParams;
    let formatErrorFn = formatError;
    let result: ExecutionResult;
    let statusCode = 200;
    let okStatusOnError = true;
    try {
      try {
        params = await getGraphQLParams(request);
      } catch (error) {
        // When we failed to parse the GraphQL parameters, we still need to get
        // the options object, so make an options call to resolve just that.
        const optionsData = await resolveOptions(options, request);
        formatErrorFn = optionsData.customFormatErrorFn ?? formatErrorFn;
        okStatusOnError = optionsData.okStatusOnError ?? okStatusOnError;
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
        context = { request, h, server },
        okStatusOnError: okStatusOnErrorUser = true
      } = optionsData;
      okStatusOnError = okStatusOnErrorUser;
      formatErrorFn = optionsData.customFormatErrorFn ?? formatErrorFn;

      const { query, variables, operationName } = params;

      // If there is no query, but GraphiQL will be displayed, do not produce
      // a result, otherwise return a 400: Bad Request.
      if (query === null) {
        throw graphqlError(400, "Missing query");
      }

      // Validate Schema
      validateGraphQLSchema(schema);

      // Parse source to AST, reporting any syntax error.
      const documentAST = parseQuery(query);

      // Validate AST, reporting any errors.
      validateDocumentAST(schema, documentAST, validationRules);

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
      } catch (e) {
        // Return 400: Bad Request if any execution context errors exist.
        throw graphqlError(400, "Failed to execute GraphQL", e);
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
    } catch (e) {
      if (isBoom(e)) {
        statusCode = e.output.statusCode;
      } else {
        // If an error was caught, report the httpError status, or 500.
        statusCode = (e as any).status ?? (e as any).statusCode ?? 500;
      }
      result = { data: undefined, errors: [e] };
      if (isGraphQLError(e)) {
        result.extensions = e.extensions;
      }
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

    return h
      .response(formattedResult)
      .type("application/json")
      .code(okStatusOnError ? 200 : statusCode);
  };
