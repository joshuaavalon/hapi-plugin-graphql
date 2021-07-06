import contentType from "content-type";
import { Readable } from "stream";
import getStream, { MaxBufferError } from "get-stream";
import querystring from "querystring";

import { graphqlError } from "./error";

import type { ParsedMediaType } from "content-type";
import type { Request } from "@hapi/hapi";

const readBody = async (
  request: Request,
  payload: Buffer | Readable,
  typeInfo: ParsedMediaType
): Promise<string> => {
  const charset = typeInfo.parameters.charset?.toLowerCase() ?? "utf-8";

  // Assert charset encoding per JSON RFC 7159 sec 8.1
  if (charset !== "utf8" && charset !== "utf-8" && charset !== "utf16le") {
    throw graphqlError(415, `Unsupported charset "${charset.toUpperCase()}".`);
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
  } catch (e) {
    /* istanbul ignore else: Thrown by underlying library. */
    if (e instanceof MaxBufferError) {
      throw graphqlError(413, "Request entity too large");
    } else {
      throw graphqlError(400, "Invalid body", e);
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
      try {
        return JSON.parse(rawBody);
      } catch (e) {
        throw graphqlError(400, "Invalid JSON", e);
      }
    case "application/x-www-form-urlencoded":
      return querystring.parse(rawBody);
  }

  // If no Content-Type header matches, parse nothing.
  return {};
};
