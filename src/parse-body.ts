import contentType from "content-type";
import { Readable } from "stream";
import { badRequest, entityTooLarge, unsupportedMediaType } from "@hapi/boom";
import getStream, { MaxBufferError } from "get-stream";
import querystring from "querystring";

import type { ParsedMediaType } from "content-type";
import type { Request } from "@hapi/hapi";

/**
 * RegExp to match an Object-opening brace "{" as the first non-space
 * in a string. Allowed whitespace is defined in RFC 7159:
 *
 *     ' '   Space
 *     '\t'  Horizontal tab
 *     '\n'  Line feed or New line
 *     '\r'  Carriage return
 */
const jsonObjRegex = /^[ \t\n\r]*\{/u;

const readBody = async (
  request: Request,
  payload: Buffer | Readable,
  typeInfo: ParsedMediaType
): Promise<string> => {
  const charset = typeInfo.parameters.charset?.toLowerCase() ?? "utf-8";

  // Assert charset encoding per JSON RFC 7159 sec 8.1
  if (charset !== "utf8" && charset !== "utf-8" && charset !== "utf16le") {
    throw unsupportedMediaType(
      `Unsupported charset "${charset.toUpperCase()}".`
    );
  }

  // Get content-encoding (e.g. gzip)
  const contentEncoding = request.headers["content-encoding"];
  const encoding =
    typeof contentEncoding === "string"
      ? contentEncoding.toLowerCase()
      : "identity";
  const maxBuffer = 100 * 1024; // 100kb

  // Read body from stream.
  try {
    const buffer =
      payload instanceof Buffer || encoding === "identity"
        ? payload
        : await getStream.buffer(payload, { maxBuffer });
    return buffer.toString(charset);
  } catch (rawError: unknown) {
    /* istanbul ignore else: Thrown by underlying library. */
    if (rawError instanceof MaxBufferError) {
      throw entityTooLarge("Invalid body: request entity too large.");
    } else {
      const message =
        rawError instanceof Error ? rawError.message : String(rawError);
      throw badRequest(`Invalid body: ${message}.`);
    }
  }
};

export const parseBody = async (
  request: Request
): Promise<Record<string, unknown>> => {
  const { payload } = request;
  // If express has already parsed a body as a keyed object, use it.

  if (
    typeof payload === "object" &&
    !(payload instanceof Buffer) &&
    !(payload instanceof Readable)
  ) {
    return payload as Record<string, unknown>;
  }

  if (request.headers["content-type"] === undefined) {
    return {};
  }

  const typeInfo = contentType.parse(request);

  if (typeof payload === "string" && typeInfo.type === "application/graphql") {
    return { query: payload };
  }

  // Already parsed body we didn't recognise? Parse nothing.
  if (
    payload !== null &&
    !(payload instanceof Buffer) &&
    !(payload instanceof Readable)
  ) {
    return {};
  }

  const rawBody = await readBody(request, payload, typeInfo);
  // Use the correct body parser based on Content-Type header.
  switch (typeInfo.type) {
    case "application/graphql":
      return { query: rawBody };
    case "application/json":
      if (jsonObjRegex.test(rawBody)) {
        try {
          return JSON.parse(rawBody);
        } catch {
          // Do nothing
        }
      }
      throw badRequest("POST body sent invalid JSON.");
    case "application/x-www-form-urlencoded":
      return querystring.parse(rawBody);
  }

  // If no Content-Type header matches, parse nothing.
  return {};
};
