import { createRequire } from 'module'; globalThis.require = createRequire(import.meta.url); const require = globalThis.require;

// node_modules/@hono/node-server/dist/index.mjs
import { Http2ServerRequest as Http2ServerRequest2, constants as h2constants } from "http2";
import { Http2ServerRequest } from "http2";
import { Readable } from "stream";
import crypto2 from "crypto";
var RequestError = class extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "RequestError";
  }
};
var toRequestError = (e) => {
  if (e instanceof RequestError) {
    return e;
  }
  return new RequestError(e.message, { cause: e });
};
var GlobalRequest = global.Request;
var Request2 = class extends GlobalRequest {
  constructor(input, options) {
    if (typeof input === "object" && getRequestCache in input) {
      input = input[getRequestCache]();
    }
    if (typeof options?.body?.getReader !== "undefined") {
      ;
      options.duplex ??= "half";
    }
    super(input, options);
  }
};
var newHeadersFromIncoming = (incoming) => {
  const headerRecord = [];
  const rawHeaders = incoming.rawHeaders;
  for (let i = 0; i < rawHeaders.length; i += 2) {
    const { [i]: key, [i + 1]: value } = rawHeaders;
    if (key.charCodeAt(0) !== /*:*/
    58) {
      headerRecord.push([key, value]);
    }
  }
  return new Headers(headerRecord);
};
var wrapBodyStream = /* @__PURE__ */ Symbol("wrapBodyStream");
var newRequestFromIncoming = (method, url, headers, incoming, abortController) => {
  const init = {
    method,
    headers,
    signal: abortController.signal
  };
  if (method === "TRACE") {
    init.method = "GET";
    const req = new Request2(url, init);
    Object.defineProperty(req, "method", {
      get() {
        return "TRACE";
      }
    });
    return req;
  }
  if (!(method === "GET" || method === "HEAD")) {
    if ("rawBody" in incoming && incoming.rawBody instanceof Buffer) {
      init.body = new ReadableStream({
        start(controller) {
          controller.enqueue(incoming.rawBody);
          controller.close();
        }
      });
    } else if (incoming[wrapBodyStream]) {
      let reader;
      init.body = new ReadableStream({
        async pull(controller) {
          try {
            reader ||= Readable.toWeb(incoming).getReader();
            const { done, value } = await reader.read();
            if (done) {
              controller.close();
            } else {
              controller.enqueue(value);
            }
          } catch (error) {
            controller.error(error);
          }
        }
      });
    } else {
      init.body = Readable.toWeb(incoming);
    }
  }
  return new Request2(url, init);
};
var getRequestCache = /* @__PURE__ */ Symbol("getRequestCache");
var requestCache = /* @__PURE__ */ Symbol("requestCache");
var incomingKey = /* @__PURE__ */ Symbol("incomingKey");
var urlKey = /* @__PURE__ */ Symbol("urlKey");
var headersKey = /* @__PURE__ */ Symbol("headersKey");
var abortControllerKey = /* @__PURE__ */ Symbol("abortControllerKey");
var getAbortController = /* @__PURE__ */ Symbol("getAbortController");
var requestPrototype = {
  get method() {
    return this[incomingKey].method || "GET";
  },
  get url() {
    return this[urlKey];
  },
  get headers() {
    return this[headersKey] ||= newHeadersFromIncoming(this[incomingKey]);
  },
  [getAbortController]() {
    this[getRequestCache]();
    return this[abortControllerKey];
  },
  [getRequestCache]() {
    this[abortControllerKey] ||= new AbortController();
    return this[requestCache] ||= newRequestFromIncoming(
      this.method,
      this[urlKey],
      this.headers,
      this[incomingKey],
      this[abortControllerKey]
    );
  }
};
[
  "body",
  "bodyUsed",
  "cache",
  "credentials",
  "destination",
  "integrity",
  "mode",
  "redirect",
  "referrer",
  "referrerPolicy",
  "signal",
  "keepalive"
].forEach((k) => {
  Object.defineProperty(requestPrototype, k, {
    get() {
      return this[getRequestCache]()[k];
    }
  });
});
["arrayBuffer", "blob", "clone", "formData", "json", "text"].forEach((k) => {
  Object.defineProperty(requestPrototype, k, {
    value: function() {
      return this[getRequestCache]()[k]();
    }
  });
});
Object.defineProperty(requestPrototype, /* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom"), {
  value: function(depth, options, inspectFn) {
    const props = {
      method: this.method,
      url: this.url,
      headers: this.headers,
      nativeRequest: this[requestCache]
    };
    return `Request (lightweight) ${inspectFn(props, { ...options, depth: depth == null ? null : depth - 1 })}`;
  }
});
Object.setPrototypeOf(requestPrototype, Request2.prototype);
var newRequest = (incoming, defaultHostname) => {
  const req = Object.create(requestPrototype);
  req[incomingKey] = incoming;
  const incomingUrl = incoming.url || "";
  if (incomingUrl[0] !== "/" && // short-circuit for performance. most requests are relative URL.
  (incomingUrl.startsWith("http://") || incomingUrl.startsWith("https://"))) {
    if (incoming instanceof Http2ServerRequest) {
      throw new RequestError("Absolute URL for :path is not allowed in HTTP/2");
    }
    try {
      const url2 = new URL(incomingUrl);
      req[urlKey] = url2.href;
    } catch (e) {
      throw new RequestError("Invalid absolute URL", { cause: e });
    }
    return req;
  }
  const host = (incoming instanceof Http2ServerRequest ? incoming.authority : incoming.headers.host) || defaultHostname;
  if (!host) {
    throw new RequestError("Missing host header");
  }
  let scheme;
  if (incoming instanceof Http2ServerRequest) {
    scheme = incoming.scheme;
    if (!(scheme === "http" || scheme === "https")) {
      throw new RequestError("Unsupported scheme");
    }
  } else {
    scheme = incoming.socket && incoming.socket.encrypted ? "https" : "http";
  }
  const url = new URL(`${scheme}://${host}${incomingUrl}`);
  if (url.hostname.length !== host.length && url.hostname !== host.replace(/:\d+$/, "")) {
    throw new RequestError("Invalid host header");
  }
  req[urlKey] = url.href;
  return req;
};
var responseCache = /* @__PURE__ */ Symbol("responseCache");
var getResponseCache = /* @__PURE__ */ Symbol("getResponseCache");
var cacheKey = /* @__PURE__ */ Symbol("cache");
var GlobalResponse = global.Response;
var Response2 = class _Response {
  #body;
  #init;
  [getResponseCache]() {
    delete this[cacheKey];
    return this[responseCache] ||= new GlobalResponse(this.#body, this.#init);
  }
  constructor(body, init) {
    let headers;
    this.#body = body;
    if (init instanceof _Response) {
      const cachedGlobalResponse = init[responseCache];
      if (cachedGlobalResponse) {
        this.#init = cachedGlobalResponse;
        this[getResponseCache]();
        return;
      } else {
        this.#init = init.#init;
        headers = new Headers(init.#init.headers);
      }
    } else {
      this.#init = init;
    }
    if (typeof body === "string" || typeof body?.getReader !== "undefined" || body instanceof Blob || body instanceof Uint8Array) {
      ;
      this[cacheKey] = [init?.status || 200, body, headers || init?.headers];
    }
  }
  get headers() {
    const cache = this[cacheKey];
    if (cache) {
      if (!(cache[2] instanceof Headers)) {
        cache[2] = new Headers(
          cache[2] || { "content-type": "text/plain; charset=UTF-8" }
        );
      }
      return cache[2];
    }
    return this[getResponseCache]().headers;
  }
  get status() {
    return this[cacheKey]?.[0] ?? this[getResponseCache]().status;
  }
  get ok() {
    const status = this.status;
    return status >= 200 && status < 300;
  }
};
["body", "bodyUsed", "redirected", "statusText", "trailers", "type", "url"].forEach((k) => {
  Object.defineProperty(Response2.prototype, k, {
    get() {
      return this[getResponseCache]()[k];
    }
  });
});
["arrayBuffer", "blob", "clone", "formData", "json", "text"].forEach((k) => {
  Object.defineProperty(Response2.prototype, k, {
    value: function() {
      return this[getResponseCache]()[k]();
    }
  });
});
Object.defineProperty(Response2.prototype, /* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom"), {
  value: function(depth, options, inspectFn) {
    const props = {
      status: this.status,
      headers: this.headers,
      ok: this.ok,
      nativeResponse: this[responseCache]
    };
    return `Response (lightweight) ${inspectFn(props, { ...options, depth: depth == null ? null : depth - 1 })}`;
  }
});
Object.setPrototypeOf(Response2, GlobalResponse);
Object.setPrototypeOf(Response2.prototype, GlobalResponse.prototype);
async function readWithoutBlocking(readPromise) {
  return Promise.race([readPromise, Promise.resolve().then(() => Promise.resolve(void 0))]);
}
function writeFromReadableStreamDefaultReader(reader, writable, currentReadPromise) {
  const cancel = (error) => {
    reader.cancel(error).catch(() => {
    });
  };
  writable.on("close", cancel);
  writable.on("error", cancel);
  (currentReadPromise ?? reader.read()).then(flow, handleStreamError);
  return reader.closed.finally(() => {
    writable.off("close", cancel);
    writable.off("error", cancel);
  });
  function handleStreamError(error) {
    if (error) {
      writable.destroy(error);
    }
  }
  function onDrain() {
    reader.read().then(flow, handleStreamError);
  }
  function flow({ done, value }) {
    try {
      if (done) {
        writable.end();
      } else if (!writable.write(value)) {
        writable.once("drain", onDrain);
      } else {
        return reader.read().then(flow, handleStreamError);
      }
    } catch (e) {
      handleStreamError(e);
    }
  }
}
function writeFromReadableStream(stream, writable) {
  if (stream.locked) {
    throw new TypeError("ReadableStream is locked.");
  } else if (writable.destroyed) {
    return;
  }
  return writeFromReadableStreamDefaultReader(stream.getReader(), writable);
}
var buildOutgoingHttpHeaders = (headers) => {
  const res = {};
  if (!(headers instanceof Headers)) {
    headers = new Headers(headers ?? void 0);
  }
  const cookies = [];
  for (const [k, v] of headers) {
    if (k === "set-cookie") {
      cookies.push(v);
    } else {
      res[k] = v;
    }
  }
  if (cookies.length > 0) {
    res["set-cookie"] = cookies;
  }
  res["content-type"] ??= "text/plain; charset=UTF-8";
  return res;
};
var X_ALREADY_SENT = "x-hono-already-sent";
if (typeof global.crypto === "undefined") {
  global.crypto = crypto2;
}
var outgoingEnded = /* @__PURE__ */ Symbol("outgoingEnded");
var incomingDraining = /* @__PURE__ */ Symbol("incomingDraining");
var DRAIN_TIMEOUT_MS = 500;
var MAX_DRAIN_BYTES = 64 * 1024 * 1024;
var drainIncoming = (incoming) => {
  const incomingWithDrainState = incoming;
  if (incoming.destroyed || incomingWithDrainState[incomingDraining]) {
    return;
  }
  incomingWithDrainState[incomingDraining] = true;
  if (incoming instanceof Http2ServerRequest2) {
    try {
      ;
      incoming.stream?.close?.(h2constants.NGHTTP2_NO_ERROR);
    } catch {
    }
    return;
  }
  let bytesRead = 0;
  const cleanup = () => {
    clearTimeout(timer);
    incoming.off("data", onData);
    incoming.off("end", cleanup);
    incoming.off("error", cleanup);
  };
  const forceClose = () => {
    cleanup();
    const socket = incoming.socket;
    if (socket && !socket.destroyed) {
      socket.destroySoon();
    }
  };
  const timer = setTimeout(forceClose, DRAIN_TIMEOUT_MS);
  timer.unref?.();
  const onData = (chunk) => {
    bytesRead += chunk.length;
    if (bytesRead > MAX_DRAIN_BYTES) {
      forceClose();
    }
  };
  incoming.on("data", onData);
  incoming.on("end", cleanup);
  incoming.on("error", cleanup);
  incoming.resume();
};
var handleRequestError = () => new Response(null, {
  status: 400
});
var handleFetchError = (e) => new Response(null, {
  status: e instanceof Error && (e.name === "TimeoutError" || e.constructor.name === "TimeoutError") ? 504 : 500
});
var handleResponseError = (e, outgoing) => {
  const err = e instanceof Error ? e : new Error("unknown error", { cause: e });
  if (err.code === "ERR_STREAM_PREMATURE_CLOSE") {
    console.info("The user aborted a request.");
  } else {
    console.error(e);
    if (!outgoing.headersSent) {
      outgoing.writeHead(500, { "Content-Type": "text/plain" });
    }
    outgoing.end(`Error: ${err.message}`);
    outgoing.destroy(err);
  }
};
var flushHeaders = (outgoing) => {
  if ("flushHeaders" in outgoing && outgoing.writable) {
    outgoing.flushHeaders();
  }
};
var responseViaCache = async (res, outgoing) => {
  let [status, body, header] = res[cacheKey];
  let hasContentLength = false;
  if (!header) {
    header = { "content-type": "text/plain; charset=UTF-8" };
  } else if (header instanceof Headers) {
    hasContentLength = header.has("content-length");
    header = buildOutgoingHttpHeaders(header);
  } else if (Array.isArray(header)) {
    const headerObj = new Headers(header);
    hasContentLength = headerObj.has("content-length");
    header = buildOutgoingHttpHeaders(headerObj);
  } else {
    for (const key in header) {
      if (key.length === 14 && key.toLowerCase() === "content-length") {
        hasContentLength = true;
        break;
      }
    }
  }
  if (!hasContentLength) {
    if (typeof body === "string") {
      header["Content-Length"] = Buffer.byteLength(body);
    } else if (body instanceof Uint8Array) {
      header["Content-Length"] = body.byteLength;
    } else if (body instanceof Blob) {
      header["Content-Length"] = body.size;
    }
  }
  outgoing.writeHead(status, header);
  if (typeof body === "string" || body instanceof Uint8Array) {
    outgoing.end(body);
  } else if (body instanceof Blob) {
    outgoing.end(new Uint8Array(await body.arrayBuffer()));
  } else {
    flushHeaders(outgoing);
    await writeFromReadableStream(body, outgoing)?.catch(
      (e) => handleResponseError(e, outgoing)
    );
  }
  ;
  outgoing[outgoingEnded]?.();
};
var isPromise = (res) => typeof res.then === "function";
var responseViaResponseObject = async (res, outgoing, options = {}) => {
  if (isPromise(res)) {
    if (options.errorHandler) {
      try {
        res = await res;
      } catch (err) {
        const errRes = await options.errorHandler(err);
        if (!errRes) {
          return;
        }
        res = errRes;
      }
    } else {
      res = await res.catch(handleFetchError);
    }
  }
  if (cacheKey in res) {
    return responseViaCache(res, outgoing);
  }
  const resHeaderRecord = buildOutgoingHttpHeaders(res.headers);
  if (res.body) {
    const reader = res.body.getReader();
    const values = [];
    let done = false;
    let currentReadPromise = void 0;
    if (resHeaderRecord["transfer-encoding"] !== "chunked") {
      let maxReadCount = 2;
      for (let i = 0; i < maxReadCount; i++) {
        currentReadPromise ||= reader.read();
        const chunk = await readWithoutBlocking(currentReadPromise).catch((e) => {
          console.error(e);
          done = true;
        });
        if (!chunk) {
          if (i === 1) {
            await new Promise((resolve) => setTimeout(resolve));
            maxReadCount = 3;
            continue;
          }
          break;
        }
        currentReadPromise = void 0;
        if (chunk.value) {
          values.push(chunk.value);
        }
        if (chunk.done) {
          done = true;
          break;
        }
      }
      if (done && !("content-length" in resHeaderRecord)) {
        resHeaderRecord["content-length"] = values.reduce((acc, value) => acc + value.length, 0);
      }
    }
    outgoing.writeHead(res.status, resHeaderRecord);
    values.forEach((value) => {
      ;
      outgoing.write(value);
    });
    if (done) {
      outgoing.end();
    } else {
      if (values.length === 0) {
        flushHeaders(outgoing);
      }
      await writeFromReadableStreamDefaultReader(reader, outgoing, currentReadPromise);
    }
  } else if (resHeaderRecord[X_ALREADY_SENT]) {
  } else {
    outgoing.writeHead(res.status, resHeaderRecord);
    outgoing.end();
  }
  ;
  outgoing[outgoingEnded]?.();
};
var getRequestListener = (fetchCallback, options = {}) => {
  const autoCleanupIncoming = options.autoCleanupIncoming ?? true;
  if (options.overrideGlobalObjects !== false && global.Request !== Request2) {
    Object.defineProperty(global, "Request", {
      value: Request2
    });
    Object.defineProperty(global, "Response", {
      value: Response2
    });
  }
  return async (incoming, outgoing) => {
    let res, req;
    try {
      req = newRequest(incoming, options.hostname);
      let incomingEnded = !autoCleanupIncoming || incoming.method === "GET" || incoming.method === "HEAD";
      if (!incomingEnded) {
        ;
        incoming[wrapBodyStream] = true;
        incoming.on("end", () => {
          incomingEnded = true;
        });
        if (incoming instanceof Http2ServerRequest2) {
          ;
          outgoing[outgoingEnded] = () => {
            if (!incomingEnded) {
              setTimeout(() => {
                if (!incomingEnded) {
                  setTimeout(() => {
                    drainIncoming(incoming);
                  });
                }
              });
            }
          };
        }
        outgoing.on("finish", () => {
          if (!incomingEnded) {
            drainIncoming(incoming);
          }
        });
      }
      outgoing.on("close", () => {
        const abortController = req[abortControllerKey];
        if (abortController) {
          if (incoming.errored) {
            req[abortControllerKey].abort(incoming.errored.toString());
          } else if (!outgoing.writableFinished) {
            req[abortControllerKey].abort("Client connection prematurely closed.");
          }
        }
        if (!incomingEnded) {
          setTimeout(() => {
            if (!incomingEnded) {
              setTimeout(() => {
                drainIncoming(incoming);
              });
            }
          });
        }
      });
      res = fetchCallback(req, { incoming, outgoing });
      if (cacheKey in res) {
        return responseViaCache(res, outgoing);
      }
    } catch (e) {
      if (!res) {
        if (options.errorHandler) {
          res = await options.errorHandler(req ? e : toRequestError(e));
          if (!res) {
            return;
          }
        } else if (!req) {
          res = handleRequestError();
        } else {
          res = handleFetchError(e);
        }
      } else {
        return handleResponseError(e, outgoing);
      }
    }
    try {
      return await responseViaResponseObject(res, outgoing, options);
    } catch (e) {
      return handleResponseError(e, outgoing);
    }
  };
};

// node_modules/hono/dist/compose.js
var compose = (middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
  };
};

// node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/hono/dist/utils/buffer.js
var bufferToFormData = (arrayBuffer, contentType) => {
  const response = new Response(arrayBuffer, {
    headers: {
      // Normalize the media type (case-insensitive) while keeping parameters like the boundary
      "Content-Type": contentType.replace(/^[^;]+/, (mediaType) => mediaType.toLowerCase())
    }
  });
  return response.formData();
};

// node_modules/hono/dist/utils/body.js
var MAX_NESTING_DEPTH = 32;
var MAX_NESTED_OBJECTS = 1e4;
var isRawRequest = (request) => "headers" in request;
var parseBody = async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = isRawRequest(request) ? request.headers : request.raw.headers;
  const contentType = headers.get("Content-Type");
  const mediaType = contentType?.split(";")[0].trim().toLowerCase();
  if (mediaType === "multipart/form-data" || mediaType === "application/x-www-form-urlencoded") {
    return parseFormData(request, { all, dot });
  }
  return {};
};
async function parseFormData(request, options) {
  if (!isRawRequest(request) && request.bodyCache.formData) {
    return convertFormDataToBodyData(
      await request.bodyCache.formData,
      options
    );
  }
  const headers = isRawRequest(request) ? request.headers : request.raw.headers;
  const arrayBuffer = await request.arrayBuffer();
  const formDataPromise = bufferToFormData(arrayBuffer, headers.get("Content-Type") || "");
  if (!isRawRequest(request)) {
    request.bodyCache.formData = formDataPromise;
  }
  const formData = await formDataPromise;
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  const nestingState = { count: 0 };
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value, nestingState);
        delete form[key];
      }
    });
  }
  return form;
}
var handleParsingAllValues = (form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
};
var handleParsingNestedValues = (form, key, value, state) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form;
  const keys = key.split(".", MAX_NESTING_DEPTH + 2);
  if (keys.length > MAX_NESTING_DEPTH + 1) {
    throwNestingLimitExceeded();
  }
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        if (state.count++ >= MAX_NESTED_OBJECTS) {
          throwNestingLimitExceeded();
        }
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
};
var throwNestingLimitExceeded = () => {
  throw new Error("Nesting limit exceeded");
};

// node_modules/hono/dist/utils/url.js
var splitPath = (path4) => {
  const paths = path4.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
};
var splitRoutingPath = (routePath) => {
  const { groups, path: path4 } = extractGroupsFromPath(routePath);
  const paths = splitPath(path4);
  return replaceGroupMarks(paths, groups);
};
var extractGroupsFromPath = (path4) => {
  const groups = [];
  path4 = path4.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path: path4 };
};
var replaceGroupMarks = (paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
};
var patternCache = {};
var getPattern = (label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey2 = `${label}#${next}`;
    if (!patternCache[cacheKey2]) {
      if (match2[2]) {
        patternCache[cacheKey2] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey2, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey2] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey2];
  }
  return null;
};
var tryDecode = (str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
};
var tryDecodeURI = (str) => tryDecode(str, decodeURI);
var getPath = (request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path4 = url.slice(start, end);
      return tryDecodeURI(path4.includes("%25") ? path4.replace(/%25/g, "%2525") : path4);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
};
var getPathNoStrict = (request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
};
var mergePath = (base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
};
var checkOptionalParameter = (path4) => {
  if (path4.charCodeAt(path4.length - 1) !== 63 || !path4.includes(":")) {
    return null;
  }
  const segments = path4.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (segment.charCodeAt(segment.length - 1) === 63) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.slice(0, -1);
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
};
var tryDecodeURIComponent = (str) => str.indexOf("%") !== -1 ? tryDecode(str, decodeURIComponent_) : str;
var _decodeURI = (value) => {
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return tryDecodeURIComponent(value);
};
var _getQueryParam = (url, key, multiple) => {
  const hashIndex = url.indexOf("#", 8);
  if (hashIndex !== -1) {
    url = url.slice(0, hashIndex);
  }
  let encoded;
  if (!multiple && key && key.indexOf("%") === -1 && key.indexOf("+") === -1) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = /* @__PURE__ */ Object.create(null);
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
};
var getQueryParam = _getQueryParam;
var getQueryParams = (url, key) => {
  return _getQueryParam(url, key, true);
};
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var HonoRequest = class {
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path4 = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path4;
    this.#matchResult = matchResult;
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex]?.[1][key];
    const param = this.#getParamValue(paramKey);
    return param && tryDecodeURIComponent(param);
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex]?.[1] ?? {});
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = tryDecodeURIComponent(value);
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = /* @__PURE__ */ Object.create(null);
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = (key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    for (const anyCachedKey in bodyCache) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  };
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * `.bytes()` parses the request body as a `Uint8Array`.
   *
   * @see {@link https://hono.dev/docs/api/request#bytes}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.bytes()
   * })
   * ```
   */
  bytes() {
    return this.#cachedBody("arrayBuffer").then((buffer) => new Uint8Array(buffer));
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    ;
    (this.#validatedData ??= {})[target] = data;
  }
  valid(target) {
    return this.#validatedData?.[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = (value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
};
var resolveCallback = async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
};

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = (contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
};
var createResponseInstance = (body, init) => new Response(body, init);
var Context = class {
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = (...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  };
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = (layout) => this.#layout = layout;
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = () => this.#layout;
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = (renderer) => {
    this.#renderer = renderer;
  };
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   // Append multiple headers using the append option (e.g. Vary)
   *   c.header('Vary', 'Accept-Encoding', { append: true })
   *   c.header('Vary', 'User-Agent', { append: true })
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = (name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  };
  status = (status) => {
    this.#status = status;
  };
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = (key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  };
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = (key) => {
    return this.#var ? this.#var.get(key) : void 0;
  };
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    let responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders;
    if (typeof arg === "object" && arg.headers) {
      responseHeaders ??= new Headers();
      for (const [key, value] of new Headers(arg.headers)) {
        if (key === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      if (!responseHeaders) {
        let count = 0;
        for (const k in headers) {
          if (++count > 1 || typeof headers[k] !== "string") {
            responseHeaders = new Headers();
            break;
          }
        }
      }
      if (responseHeaders) {
        for (const k in headers) {
          const v = headers[k];
          if (typeof v === "string") {
            responseHeaders.set(k, v);
          } else {
            responseHeaders.delete(k);
            for (const v2 of v) {
              responseHeaders.append(k, v2);
            }
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, {
      status,
      headers: responseHeaders ?? headers
    });
  }
  newResponse = (...args) => this.#newResponse(...args);
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = (data, arg, headers) => this.#newResponse(data, arg, headers);
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = (text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  };
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = (object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  };
  html = (html, arg, headers) => {
    const res = (html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers));
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  };
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = (location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  };
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = () => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  };
};

// node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch", "query"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
};

// node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/hono-base.js
var notFoundHandler = (c) => {
  return c.text("404 Not Found", 404);
};
var errorHandler = (err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
};
var Hono = class _Hono {
  get;
  post;
  put;
  delete;
  options;
  patch;
  query;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        const methodName = method.toUpperCase();
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(methodName, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(methodName, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path4, ...handlers) => {
      for (const p of [path4].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          const methodName = m.toUpperCase();
          for (const handler of handlers) {
            this.#addRoute(methodName, this.#path, handler);
          }
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path4, app2) {
    const subApp = this.basePath(path4);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res;
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler, r.basePath);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path4) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path4);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = (handler) => {
    this.errorHandler = handler;
    return this;
  };
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = (handler) => {
    this.#notFoundHandler = handler;
    return this;
  };
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path4, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = (request) => request;
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path4);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = this.getPath(request).slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    };
    this.#addRoute(METHOD_NAME_ALL, mergePath(path4, "*"), handler);
    return this;
  }
  #addRoute(method, path4, handler, baseRoutePath) {
    path4 = mergePath(this._basePath, path4);
    const r = {
      basePath: baseRoutePath !== void 0 ? mergePath(this._basePath, baseRoutePath) : this._basePath,
      path: path4,
      method,
      handler
    };
    this.router.add(method, path4, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path4 = this.getPath(request, { env });
    const matchResult = this.router.match(method, path4);
    const c = new Context(request, {
      path: path4,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} env - env Object
   * @param {ExecutionContext} executionCtx - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = (request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  };
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = (input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  };
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = () => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  };
};

// node_modules/hono/dist/router/utils.js
var createNullObject = () => /* @__PURE__ */ Object.create(null);

// node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path4) {
  const matchers = this.buildAllMatchers();
  const match2 = ((method2, path22) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path22];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path22.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  });
  this.match = match2;
  return match2(method, path4);
}

// node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return b === TAIL_WILDCARD_REG_EXP_STR ? -1 : 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
var Node = class _Node {
  // handler index of a dynamic path, or -1 for a static path terminal
  #index;
  #varIndex;
  #children = createNullObject();
  insert(tokens, index, paramMap, context, isStatic) {
    let node = this;
    for (let i = 0, len = tokens.length; i < len; i++) {
      const token = tokens[i];
      const pattern = token.length === 1 ? token === "*" ? i === len - 1 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : null : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
      let nextNode;
      if (pattern) {
        const name = pattern[1];
        let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
        if (name && pattern[2]) {
          if (regexpStr === ".*") {
            throw PATH_ERROR;
          }
          regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
          if (/\((?!\?:)/.test(regexpStr)) {
            throw PATH_ERROR;
          }
          if (regexpStr.length === 1 && regExpMetaChars.has(regexpStr)) {
            throw PATH_ERROR;
          }
        }
        nextNode = node.#children[regexpStr];
        if (!nextNode) {
          if (regexpStr !== ONLY_WILDCARD_REG_EXP_STR && regexpStr !== TAIL_WILDCARD_REG_EXP_STR) {
            for (const k in node.#children) {
              if (
                // a single-char pattern coexists with single-char literals as a literal does
                (regexpStr.length > 1 || k.length > 1) && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
              ) {
                throw PATH_ERROR;
              }
            }
          }
          nextNode = node.#children[regexpStr] = new _Node();
        }
        if (name !== "") {
          nextNode.#varIndex ??= context.varIndex++;
          paramMap.push([name, nextNode.#varIndex]);
        }
      } else {
        nextNode = node.#children[token];
        if (!nextNode) {
          for (const k in node.#children) {
            if (k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR) {
              throw PATH_ERROR;
            }
          }
          nextNode = node.#children[token] = new _Node();
        }
      }
      node = nextNode;
    }
    if (node.#index !== void 0) {
      throw PATH_ERROR;
    }
    node.#index = isStatic ? -1 : index;
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      const childStr = c.buildRegExpStr();
      return childStr === "" ? "" : (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + childStr;
    }).filter(Boolean);
    if (typeof this.#index === "number" && this.#index !== -1) {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  #context = { varIndex: 0 };
  #root = new Node();
  #index = 0;
  // dynamic path -> [handler index, param assoc]; static paths are not registered
  paths = createNullObject();
  insert(path4, isStatic) {
    if (isStatic) {
      this.#root.insert(path4.split(""), 0, [], this.#context, true);
      return;
    }
    const paramAssoc = [];
    const groups = [];
    let markedPath = path4;
    for (let i = 0; ; ) {
      let replaced = false;
      markedPath = markedPath.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = markedPath.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, this.#index, paramAssoc, this.#context, false);
    this.paths[path4] = [this.#index++, paramAssoc];
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// node_modules/hono/dist/router/reg-exp-router/router.js
var wildcardRegExpCache = createNullObject();
function buildWildcardRegExp(path4) {
  return wildcardRegExpCache[path4] ??= new RegExp(
    `^${path4.replace(
      /\/:[^/{}]+(?:\{\[\^\/]\+})?(?=[/{]|$)|\/?\*$|([.\\+*[^\]$()?{}|])/g,
      (match2, metaChar) => metaChar ? `\\${metaChar}` : match2 === "/*" ? TAIL_WILDCARD_REG_EXP_STR : match2 === "*" ? ONLY_WILDCARD_REG_EXP_STR : `/:${LABEL_REG_EXP_STR}`
    )}$`
  );
}
function findMiddleware(middleware, path4) {
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path4)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
var RegExpRouter = class {
  name = "RegExpRouter";
  #middleware;
  #routes;
  #tries;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: createNullObject() };
    this.#routes = { [METHOD_NAME_ALL]: createNullObject() };
    this.#tries = { [METHOD_NAME_ALL]: new Trie() };
  }
  #insertPath(method, path4) {
    try {
      this.#tries[method].insert(path4, !/\*|\/:/.test(path4));
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path4) : e;
    }
  }
  add(method, path4, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      this.#tries[method] = new Trie();
      for (const handlerMap of [middleware, routes]) {
        handlerMap[method] = createNullObject();
        for (const p in handlerMap[METHOD_NAME_ALL]) {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
          this.#insertPath(method, p);
        }
      }
    }
    if (path4 === "/*") {
      path4 = "*";
    }
    const methods = method === METHOD_NAME_ALL ? Object.keys(middleware) : [method];
    if (/\*$/.test(path4)) {
      const re = buildWildcardRegExp(path4);
      for (const m of methods) {
        if (!middleware[m][path4]) {
          this.#insertPath(m, path4);
          middleware[m][path4] = findMiddleware(middleware[m], path4) || findMiddleware(middleware[METHOD_NAME_ALL], path4) || [];
        }
      }
      for (const handlerMap of [middleware, routes]) {
        for (const m of methods) {
          for (const p in handlerMap[m]) {
            re.test(p) && handlerMap[m][p].push([handler, path4]);
          }
        }
      }
      return;
    }
    const paths = checkOptionalParameter(path4) || [path4];
    for (const path22 of paths) {
      for (const m of methods) {
        if (!routes[m][path22]) {
          this.#insertPath(m, path22);
          routes[m][path22] = findMiddleware(middleware[m], path22) || findMiddleware(middleware[METHOD_NAME_ALL], path22) || [];
        }
        routes[m][path22].push([handler, path22]);
      }
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = createNullObject();
    for (const method of Object.keys(this.#routes)) {
      matchers[method] = this.#buildMatcher(method);
    }
    this.#middleware = this.#routes = this.#tries = void 0;
    wildcardRegExpCache = createNullObject();
    return matchers;
  }
  #buildMatcher(method) {
    const middleware = this.#middleware[method];
    const routes = this.#routes[method];
    const trie = this.#tries[method];
    const staticMap = createNullObject();
    const handlerData = [];
    const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
    for (const r of [middleware, routes]) {
      for (const path4 in r) {
        const handlers = r[path4];
        const pathData = trie.paths[path4];
        if (!pathData) {
          staticMap[path4] = [handlers.map(([h]) => [h, createNullObject()]), emptyParam];
          continue;
        }
        handlerData[pathData[0]] = handlers.map(([h, handlerPath]) => [
          h,
          trie.paths[handlerPath][1].reduceRight((map, [key], i) => {
            map[key] = paramReplacementMap[pathData[1][i][1]];
            return map;
          }, createNullObject())
        ]);
      }
    }
    return [regexp, indexReplacementMap.map((i) => handlerData[i]), staticMap];
  }
};

// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path4, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path4, handler]);
  }
  match(method, path4) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path4);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// node_modules/hono/dist/router/trie-router/node.js
var emptyParams = createNullObject();
var order = 0;
var Node2 = class _Node2 {
  #methods = [];
  #children = createNullObject();
  #patterns = [];
  #pattern;
  #params = emptyParams;
  insert(method, path4, handler) {
    let curNode = this;
    const parts = splitRoutingPath(path4);
    const possibleKeys = /* @__PURE__ */ new Set();
    let i = 0;
    for (const p of parts) {
      const nextP = parts[++i];
      const pattern = getPattern(p, nextP) || (nextP === void 0 && p && p.indexOf("*") === p.length - 1 ? p : null);
      const isParam = Array.isArray(pattern);
      const key = isParam ? pattern[0] : pattern || p;
      const child = curNode.#children[key] ||= new _Node2();
      if (pattern && !child.#pattern) {
        child.#pattern = pattern;
        curNode.#patterns.push(child);
      }
      curNode = child;
      if (isParam) {
        possibleKeys.add(pattern[1]);
      }
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: [...possibleKeys],
        score: ++order
      }
    });
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      if (handlerSet) {
        handlerSet.params = createNullObject();
        handlerSets.push(handlerSet);
        for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
          const key = handlerSet.possibleKeys[i2];
          handlerSet.params[key] = params?.[key] && !i2 ? params[key] : nodeParams[key] ?? params?.[key];
        }
      }
    }
  }
  search(method, path4) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path4);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (const child of node.#patterns) {
          const pattern = child.#pattern;
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (typeof pattern === "string") {
            if (pattern === "*" || part.startsWith(pattern.slice(0, -1))) {
              this.#pushHandlerSets(handlerSets, child, method, node.#params);
              if (pattern === "*") {
                child.#params = params;
                tempNodes.push(child);
              }
            }
            continue;
          }
          const [, name, matcher] = pattern;
          if (!part && matcher === true) {
            continue;
          }
          if (matcher !== true) {
            if (!partOffsets) {
              partOffsets = [];
              let offset = path4[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path4.slice(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (m[0].length === restPathString.length && child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  node.#params,
                  params
                );
              }
              for (const _ in child.#children) {
                child.#params = params;
                const componentCount = m[0].match(/\//g)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
                break;
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets[1]) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  name = "TrieRouter";
  #node = new Node2();
  add(method, path4, handler) {
    for (const result of checkOptionalParameter(path4) || [path4]) {
      this.#node.insert(method, result, handler);
    }
  }
  match(method, path4) {
    return this.#node.search(method, path4);
  }
};

// node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// node_modules/hono/dist/utils/compress.js
var COMPRESSIBLE_CONTENT_TYPE_REGEX = /^\s*(?:text\/(?!event-stream(?:[;\s]|$))[^;\s]+|application\/(?:javascript|json|xml|xml-dtd|ecmascript|dart|msgpack|postscript|rtf|tar|toml|vnd\.dart|vnd\.ms-fontobject|vnd\.ms-opentype|vnd\.msgpack|wasm|x-httpd-php|x-javascript|x-msgpack|x-ns-proxy-autoconfig|x-sh|x-tar|x-virtualbox-hdd|x-virtualbox-ova|x-virtualbox-ovf|x-virtualbox-vbox|x-virtualbox-vdi|x-virtualbox-vhd|x-virtualbox-vmdk|x-www-form-urlencoded)|font\/(?:otf|ttf)|image\/(?:bmp|vnd\.adobe\.photoshop|vnd\.microsoft\.icon|vnd\.ms-dds|x-icon|x-ms-bmp)|message\/rfc822|model\/gltf-binary|x-shader\/x-fragment|x-shader\/x-vertex|[^;\s]+?\+(?:json|text|xml|yaml|msgpack))(?:[;\s]|$)/i;

// node_modules/hono/dist/utils/mime.js
var getMimeType = (filename, mimes = baseMimes) => {
  const regexp = /\.([a-zA-Z0-9]+?)$/;
  const match2 = filename.match(regexp);
  if (!match2) {
    return;
  }
  return mimes[match2[1].toLowerCase()];
};
var _baseMimes = {
  aac: "audio/aac",
  avi: "video/x-msvideo",
  avif: "image/avif",
  av1: "video/av1",
  bin: "application/octet-stream",
  bmp: "image/bmp",
  css: "text/css; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  eot: "application/vnd.ms-fontobject",
  epub: "application/epub+zip",
  gif: "image/gif",
  gz: "application/gzip",
  htm: "text/html; charset=utf-8",
  html: "text/html; charset=utf-8",
  ico: "image/x-icon",
  ics: "text/calendar; charset=utf-8",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  js: "text/javascript; charset=utf-8",
  json: "application/json",
  jsonld: "application/ld+json",
  map: "application/json",
  mid: "audio/x-midi",
  midi: "audio/x-midi",
  mjs: "text/javascript; charset=utf-8",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  mpeg: "video/mpeg",
  oga: "audio/ogg",
  ogv: "video/ogg",
  ogx: "application/ogg",
  opus: "audio/opus",
  otf: "font/otf",
  pdf: "application/pdf",
  png: "image/png",
  rtf: "application/rtf",
  svg: "image/svg+xml; charset=utf-8",
  tif: "image/tiff",
  tiff: "image/tiff",
  ts: "video/mp2t",
  ttf: "font/ttf",
  txt: "text/plain; charset=utf-8",
  wasm: "application/wasm",
  webm: "video/webm",
  weba: "audio/webm",
  webmanifest: "application/manifest+json",
  webp: "image/webp",
  woff: "font/woff",
  woff2: "font/woff2",
  xhtml: "application/xhtml+xml; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  zip: "application/zip",
  "3gp": "video/3gpp",
  "3g2": "video/3gpp2",
  gltf: "model/gltf+json",
  glb: "model/gltf-binary"
};
var baseMimes = _baseMimes;

// node_modules/hono/dist/middleware/serve-static/path.js
var defaultJoin = (...paths) => {
  let result = paths.filter((p) => p !== "").join("/");
  result = result.replace(/(?<=\/)\/+/g, "");
  const segments = result.split("/");
  const resolved = [];
  for (const segment of segments) {
    if (segment === ".." && resolved.length > 0 && resolved.at(-1) !== "..") {
      resolved.pop();
    } else if (segment !== ".") {
      resolved.push(segment);
    }
  }
  return resolved.join("/") || ".";
};

// node_modules/hono/dist/middleware/serve-static/index.js
var ENCODINGS = {
  br: ".br",
  zstd: ".zst",
  gzip: ".gz"
};
var ENCODINGS_ORDERED_KEYS = Object.keys(ENCODINGS);
var DEFAULT_DOCUMENT = "index.html";
var serveStatic = (options) => {
  const root = options.root ?? "./";
  const optionPath = options.path;
  const join = options.join ?? defaultJoin;
  return async (c, next) => {
    if (c.finalized) {
      return next();
    }
    let filename;
    if (options.path) {
      filename = options.path;
    } else {
      try {
        filename = tryDecodeURI(c.req.path);
        if (/(?:^|[\/\\])\.{1,2}(?:$|[\/\\])|[\/\\]{2,}|\\/.test(filename)) {
          throw new Error();
        }
      } catch {
        await options.onNotFound?.(c.req.path, c);
        return next();
      }
    }
    let path4 = join(
      root,
      !optionPath && options.rewriteRequestPath ? options.rewriteRequestPath(filename) : filename
    );
    if (options.isDir && await options.isDir(path4)) {
      path4 = join(path4, DEFAULT_DOCUMENT);
    }
    const getContent = options.getContent;
    let content = await getContent(path4, c);
    if (content instanceof Response) {
      return c.newResponse(content.body, content);
    }
    if (content != null) {
      const mimeType = options.mimes && getMimeType(path4, options.mimes) || getMimeType(path4);
      c.header("Content-Type", mimeType || "application/octet-stream");
      if (options.precompressed && (!mimeType || COMPRESSIBLE_CONTENT_TYPE_REGEX.test(mimeType))) {
        const acceptEncodingSet = new Set(
          c.req.header("Accept-Encoding")?.split(",").map((encoding) => encoding.trim())
        );
        for (const encoding of ENCODINGS_ORDERED_KEYS) {
          if (!acceptEncodingSet.has(encoding)) {
            continue;
          }
          const compressedContent = await getContent(path4 + ENCODINGS[encoding], c);
          if (compressedContent) {
            content = compressedContent;
            c.header("Content-Encoding", encoding);
            c.header("Vary", "Accept-Encoding", { append: true });
            break;
          }
        }
      }
      await options.onFound?.(path4, c);
      return c.body(content);
    }
    await options.onNotFound?.(path4, c);
    await next();
    return;
  };
};

// node_modules/hono/dist/adapter/cloudflare-workers/utils.js
var getContentFromKVAsset = async (path4, options) => {
  let ASSET_MANIFEST;
  if (options && options.manifest) {
    if (typeof options.manifest === "string") {
      ASSET_MANIFEST = JSON.parse(options.manifest);
    } else {
      ASSET_MANIFEST = options.manifest;
    }
  } else {
    if (typeof __STATIC_CONTENT_MANIFEST === "string") {
      ASSET_MANIFEST = JSON.parse(__STATIC_CONTENT_MANIFEST);
    } else {
      ASSET_MANIFEST = __STATIC_CONTENT_MANIFEST;
    }
  }
  let ASSET_NAMESPACE;
  if (options && options.namespace) {
    ASSET_NAMESPACE = options.namespace;
  } else {
    ASSET_NAMESPACE = __STATIC_CONTENT;
  }
  const key = ASSET_MANIFEST[path4];
  if (!key) {
    return null;
  }
  const content = await ASSET_NAMESPACE.get(key, { type: "stream" });
  if (!content) {
    return null;
  }
  return content;
};

// node_modules/hono/dist/adapter/cloudflare-workers/serve-static.js
var serveStatic2 = (options = {}) => {
  return async function serveStatic22(c, next) {
    const getContent = async (path4) => {
      return getContentFromKVAsset(path4, {
        manifest: options.manifest,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        namespace: options.namespace ? options.namespace : c.env ? c.env.__STATIC_CONTENT : void 0
      });
    };
    return serveStatic({
      ...options,
      getContent
    })(c, next);
  };
};

// node_modules/hono/dist/adapter/cloudflare-workers/serve-static-module.js
var module = (options) => {
  return serveStatic2(options);
};

// node_modules/hono/dist/helper/websocket/index.js
var WSContext = class {
  #init;
  constructor(init) {
    this.#init = init;
    this.raw = init.raw;
    this.url = init.url ? new URL(init.url) : null;
    this.protocol = init.protocol ?? null;
  }
  send(source, options) {
    this.#init.send(source, options ?? {});
  }
  raw;
  binaryType = "arraybuffer";
  get readyState() {
    return this.#init.readyState;
  }
  url;
  protocol;
  close(code, reason) {
    this.#init.close(code, reason);
  }
};
var defineWebSocketHelper = (handler) => {
  return ((...args) => {
    if (typeof args[0] === "function") {
      const [createEvents, options] = args;
      return async function upgradeWebSocket2(c, next) {
        const events = await createEvents(c);
        const result = await handler(c, events, options);
        if (result) {
          return result;
        }
        await next();
      };
    } else {
      const [c, events, options] = args;
      return (async () => {
        const upgraded = await handler(c, events, options);
        if (!upgraded) {
          throw new Error("Failed to upgrade WebSocket");
        }
        return upgraded;
      })();
    }
  });
};

// node_modules/hono/dist/adapter/cloudflare-workers/websocket.js
var upgradeWebSocket = defineWebSocketHelper(async (c, events) => {
  const upgradeHeader = c.req.header("Upgrade");
  if (upgradeHeader !== "websocket") {
    return;
  }
  const webSocketPair = new WebSocketPair();
  const client = webSocketPair[0];
  const server = webSocketPair[1];
  const wsContext = new WSContext({
    close: (code, reason) => server.close(code, reason),
    get protocol() {
      return server.protocol;
    },
    raw: server,
    get readyState() {
      return server.readyState;
    },
    url: server.url ? new URL(server.url) : null,
    send: (source) => server.send(source)
  });
  if (events.onClose) {
    server.addEventListener("close", (evt) => events.onClose?.(evt, wsContext));
  }
  if (events.onMessage) {
    server.addEventListener("message", (evt) => events.onMessage?.(evt, wsContext));
  }
  if (events.onError) {
    server.addEventListener("error", (evt) => events.onError?.(evt, wsContext));
  }
  server.accept?.();
  return new Response(null, {
    status: 101,
    // @ts-expect-error - webSocket is not typed
    webSocket: client
  });
});

// node_modules/hono/dist/middleware/cors/index.js
var cors = (options) => {
  const opts = {
    origin: "*",
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH", "QUERY"],
    allowHeaders: [],
    exposeHeaders: [],
    ...options
  };
  const exposeHeadersStr = opts.exposeHeaders?.length ? opts.exposeHeaders.join(",") : void 0;
  const allowHeadersStr = opts.allowHeaders?.length ? opts.allowHeaders.join(",") : void 0;
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") {
        return () => optsOrigin;
      } else {
        return (origin) => optsOrigin === origin ? origin : null;
      }
    } else if (typeof optsOrigin === "function") {
      return optsOrigin;
    } else {
      return (origin) => optsOrigin.includes(origin) ? origin : null;
    }
  })(opts.origin);
  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === "function") {
      return async (origin, c) => (await optsAllowMethods(origin, c)).join(",");
    } else if (Array.isArray(optsAllowMethods)) {
      const methodsStr = optsAllowMethods.join(",");
      return () => methodsStr;
    } else {
      return () => "";
    }
  })(opts.allowMethods);
  return async function cors2(c, next) {
    function set(key, value) {
      c.res.headers.set(key, value);
    }
    const allowOrigin = await findAllowOrigin(c.req.header("origin") || "", c);
    if (allowOrigin) {
      set("Access-Control-Allow-Origin", allowOrigin);
    }
    if (opts.credentials) {
      set("Access-Control-Allow-Credentials", "true");
    }
    if (exposeHeadersStr) {
      set("Access-Control-Expose-Headers", exposeHeadersStr);
    }
    if (c.req.method === "OPTIONS") {
      if (opts.origin !== "*") {
        c.res.headers.append("Vary", "Origin");
      }
      if (opts.maxAge != null) {
        set("Access-Control-Max-Age", opts.maxAge.toString());
      }
      const allowMethods = await findAllowMethods(c.req.header("origin") || "", c);
      if (allowMethods) {
        set("Access-Control-Allow-Methods", allowMethods);
      }
      let headersStr = allowHeadersStr;
      if (!headersStr) {
        const requestHeaders = c.req.header("Access-Control-Request-Headers");
        if (requestHeaders) {
          headersStr = requestHeaders.split(",").map((h) => h.trim()).join(",");
        }
      }
      if (headersStr) {
        set("Access-Control-Allow-Headers", headersStr);
        c.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c.res.headers.delete("Content-Length");
      c.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
    if (opts.origin !== "*") {
      c.header("Vary", "Origin", { append: true });
    }
  };
};

// src/middleware/security.ts
var securityHeaders = async (c, next) => {
  await next();
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("X-Frame-Options", "SAMEORIGIN");
  c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  c.res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  c.res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
      "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
      "img-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join("; ")
  );
};
var corsMiddleware = cors({
  origin: (origin) => {
    if (!origin) return origin;
    try {
      const u = new URL(origin);
      if (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname.endsWith(".pages.dev") || u.hostname.endsWith(".vercel.app") || u.hostname === "alsharif.law") {
        return origin;
      }
    } catch {
    }
    return null;
  },
  credentials: true,
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"]
});
var staticCacheMiddleware = async (c, next) => {
  await next();
  if (c.res.status === 200) {
    c.res.headers.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
  }
};
var apiNoCacheMiddleware = async (c, next) => {
  await next();
  c.res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  c.res.headers.set("Pragma", "no-cache");
};

// node_modules/hono/dist/utils/cookie.js
var validCookieNameRegEx = /^[\w!#$%&'*.^`|~+-]+$/;
var relaxedCookieNameRegEx = /^[!#-:<>-[\]-~]+$/;
var validCookieValueRegEx = /^[ !#-:<-[\]-~]*$/;
var trimCookieWhitespace = (value) => {
  let start = 0;
  let end = value.length;
  while (start < end) {
    const charCode = value.charCodeAt(start);
    if (charCode !== 32 && charCode !== 9) {
      break;
    }
    start++;
  }
  while (end > start) {
    const charCode = value.charCodeAt(end - 1);
    if (charCode !== 32 && charCode !== 9) {
      break;
    }
    end--;
  }
  return start === 0 && end === value.length ? value : value.slice(start, end);
};
var parse = (cookie, name) => {
  if (name && cookie.indexOf(name) === -1) {
    return {};
  }
  const pairs = cookie.split(";");
  const parsedCookie = /* @__PURE__ */ Object.create(null);
  for (const pairStr of pairs) {
    const valueStartPos = pairStr.indexOf("=");
    if (valueStartPos === -1) {
      continue;
    }
    const cookieName = trimCookieWhitespace(pairStr.substring(0, valueStartPos));
    if (name && name !== cookieName || !relaxedCookieNameRegEx.test(cookieName) || cookieName in parsedCookie) {
      continue;
    }
    let cookieValue = trimCookieWhitespace(pairStr.substring(valueStartPos + 1));
    if (cookieValue.startsWith('"') && cookieValue.endsWith('"')) {
      cookieValue = cookieValue.slice(1, -1);
    }
    if (validCookieValueRegEx.test(cookieValue)) {
      parsedCookie[cookieName] = tryDecodeURIComponent(cookieValue);
      if (name) {
        break;
      }
    }
  }
  return parsedCookie;
};
var _serialize = (name, value, opt = {}) => {
  if (!validCookieNameRegEx.test(name)) {
    throw new Error("Invalid cookie name");
  }
  let cookie = `${name}=${value}`;
  if (name.startsWith("__Secure-") && !opt.secure) {
    throw new Error("__Secure- Cookie must have Secure attributes");
  }
  if (name.startsWith("__Host-")) {
    if (!opt.secure) {
      throw new Error("__Host- Cookie must have Secure attributes");
    }
    if (opt.path !== "/") {
      throw new Error('__Host- Cookie must have Path attributes with "/"');
    }
    if (opt.domain) {
      throw new Error("__Host- Cookie must not have Domain attributes");
    }
  }
  for (const key of ["domain", "path", "sameSite", "priority"]) {
    if (opt[key] && /[;\r\n]/.test(opt[key])) {
      throw new Error(`${key} must not contain ";", "\\r", or "\\n"`);
    }
  }
  if (opt && typeof opt.maxAge === "number" && opt.maxAge >= 0) {
    if (opt.maxAge > 3456e4) {
      throw new Error(
        "Cookies Max-Age SHOULD NOT be greater than 400 days (34560000 seconds) in duration."
      );
    }
    cookie += `; Max-Age=${opt.maxAge | 0}`;
  }
  if (opt.domain && opt.prefix !== "host") {
    cookie += `; Domain=${opt.domain}`;
  }
  if (opt.path) {
    cookie += `; Path=${opt.path}`;
  }
  if (opt.expires) {
    if (opt.expires.getTime() - Date.now() > 3456e7) {
      throw new Error(
        "Cookies Expires SHOULD NOT be greater than 400 days (34560000 seconds) in the future."
      );
    }
    cookie += `; Expires=${opt.expires.toUTCString()}`;
  }
  if (opt.httpOnly) {
    cookie += "; HttpOnly";
  }
  if (opt.secure) {
    cookie += "; Secure";
  }
  if (opt.sameSite) {
    cookie += `; SameSite=${opt.sameSite.charAt(0).toUpperCase() + opt.sameSite.slice(1)}`;
  }
  if (opt.priority) {
    cookie += `; Priority=${opt.priority.charAt(0).toUpperCase() + opt.priority.slice(1)}`;
  }
  if (opt.partitioned) {
    if (!opt.secure) {
      throw new Error("Partitioned Cookie must have Secure attributes");
    }
    cookie += "; Partitioned";
  }
  return cookie;
};
var serialize = (name, value, opt) => {
  value = encodeURIComponent(value);
  return _serialize(name, value, opt);
};

// node_modules/hono/dist/helper/cookie/index.js
var getCookie = (c, key, prefix) => {
  const cookie = c.req.raw.headers.get("Cookie");
  if (typeof key === "string") {
    if (!cookie) {
      return void 0;
    }
    let finalKey = key;
    if (prefix === "secure") {
      finalKey = "__Secure-" + key;
    } else if (prefix === "host") {
      finalKey = "__Host-" + key;
    }
    const obj2 = parse(cookie, finalKey);
    return obj2[finalKey];
  }
  if (!cookie) {
    return {};
  }
  const obj = parse(cookie);
  return obj;
};
var generateCookie = (name, value, opt) => {
  let cookie;
  if (opt?.prefix === "secure") {
    cookie = serialize("__Secure-" + name, value, { path: "/", ...opt, secure: true });
  } else if (opt?.prefix === "host") {
    cookie = serialize("__Host-" + name, value, {
      ...opt,
      path: "/",
      secure: true,
      domain: void 0
    });
  } else {
    cookie = serialize(name, value, { path: "/", ...opt });
  }
  return cookie;
};
var setCookie = (c, name, value, opt) => {
  const cookie = generateCookie(name, value, opt);
  c.header("Set-Cookie", cookie, { append: true });
};
var deleteCookie = (c, name, opt) => {
  const deletedCookie = getCookie(c, name, opt?.prefix);
  setCookie(c, name, "", { ...opt, maxAge: 0 });
  return deletedCookie;
};

// src/config/constants.ts
var SESSION_COOKIE_NAME = "sharif_session";
var SESSION_DURATION_DAYS = 14;
var SESSION_DURATION_MS = SESSION_DURATION_DAYS * 24 * 60 * 60 * 1e3;
var RATE_LIMIT_WINDOW_MS = 15 * 60 * 1e3;
var RATE_LIMIT_MAX_ATTEMPTS = 10;
var ALLOWED_ROLES = ["managing_partner", "partner", "senior", "lawyer", "intern", "admin", "accountant", "secretary"];
var ALLOWED_CLIENT_STATUSES = ["active", "vip", "inactive"];
var ALLOWED_CASE_STATUSES = ["\u0645\u062A\u062F\u0627\u0648\u0644\u0629", "\u0645\u062D\u062C\u0648\u0632\u0629 \u0644\u0644\u062D\u0643\u0645", "\u0645\u0648\u0642\u0648\u0641\u0629", "\u0645\u0646\u062A\u0647\u064A\u0629"];
var ALLOWED_CASE_PRIORITIES = ["\u0639\u0627\u062C\u0644\u0629", "\u0639\u0627\u0644\u064A\u0629", "\u0639\u0627\u062F\u064A\u0629", "\u0645\u0646\u062E\u0641\u0636\u0629"];
var ALLOWED_INVOICE_STATUSES = ["\u0645\u0633\u0648\u062F\u0629", "\u0635\u0627\u062F\u0631\u0629", "\u062C\u0632\u0626\u064A", "\u0645\u0633\u062F\u062F\u0629", "\u0645\u062A\u0623\u062E\u0631\u0629", "\u0645\u0644\u063A\u0627\u0629"];
var ALLOWED_POA_STATUSES = ["\u0633\u0627\u0631\u064A", "\u0645\u0646\u062A\u0647\u064D", "\u0645\u0644\u063A\u0649"];
var ALLOWED_HEARING_STATUSES = ["\u0642\u0627\u062F\u0645\u0629", "\u062A\u0645\u062A", "\u062A\u0623\u062C\u064A\u0644", "\u0634\u0637\u0628", "\u062D\u062C\u0632 \u0644\u0644\u062D\u0643\u0645"];
var ALLOWED_CASE_DEGREES = ["\u0627\u0628\u062A\u062F\u0627\u0626\u064A", "\u0627\u0633\u062A\u0626\u0646\u0627\u0641", "\u0646\u0642\u0636", "\u0625\u062F\u0627\u0631\u064A", "\u062A\u062D\u0643\u064A\u0645", "\u062A\u0646\u0641\u064A\u0630"];
var ALLOWED_CLIENT_TYPES = ["individual", "company"];
var MAX_TEXT_LENGTH = 1e3;
var MAX_NAME_LENGTH = 200;
var MAX_NOTE_LENGTH = 5e3;

// src/middleware/rate-limiter.ts
var rateLimitMap = /* @__PURE__ */ new Map();
var lastCleanup = 0;
function cleanupExpired() {
  const now = Date.now();
  if (now - lastCleanup < RATE_LIMIT_WINDOW_MS) return;
  lastCleanup = now;
  for (const [key, record] of rateLimitMap) {
    if (now > record.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}
function checkRateLimit(key) {
  cleanupExpired();
  const now = Date.now();
  const record = rateLimitMap.get(key);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (record.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    return false;
  }
  record.count++;
  return true;
}

// src/middleware/auth.ts
function safeUser(u) {
  if (!u) return null;
  const { password_hash, ...rest } = u;
  return rest;
}
async function getCurrentUser(c) {
  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (!token) return null;
  const user = await c.env.DB.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > datetime('now') AND u.is_active = 1`
  ).bind(token).first();
  return user || null;
}
async function requireUser(c) {
  const user = await getCurrentUser(c);
  if (!user) {
    return c.json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" }, 401);
  }
  return user;
}
function requireAdminOrPartner(user, c) {
  if (!["managing_partner", "partner", "admin"].includes(user.role)) {
    return c.json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u2014 \u0635\u0644\u0627\u062D\u064A\u0629 \u0634\u0631\u0643\u0627\u0621 \u0648\u0625\u062F\u0627\u0631\u0629 \u0641\u0642\u0637" }, 403);
  }
  return null;
}

// src/utils/crypto.ts
async function sha2562(text) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function generateToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function hashPassword(password) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const iterations = 1e5;
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256"
    },
    keyMaterial,
    256
    // 32 bytes
  );
  const saltHex = [...salt].map((b) => b.toString(16).padStart(2, "0")).join("");
  const hashHex = [...new Uint8Array(derivedBits)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${iterations}$${saltHex}$${hashHex}`;
}
async function verifyPassword(password, stored) {
  if (!stored || !password) return false;
  if (stored.includes("$")) {
    const parts = stored.split("$");
    if (parts.length !== 3) return false;
    const iterations = parseInt(parts[0], 10);
    const saltHex = parts[1];
    const expectedHashHex = parts[2];
    if (isNaN(iterations) || !saltHex || !expectedHashHex) return false;
    const matches = saltHex.match(/.{1,2}/g);
    if (!matches) return false;
    const salt = new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations,
        hash: "SHA-256"
      },
      keyMaterial,
      256
    );
    const computedHashHex = [...new Uint8Array(derivedBits)].map((b) => b.toString(16).padStart(2, "0")).join("");
    if (computedHashHex.length !== expectedHashHex.length) return false;
    let diff2 = 0;
    for (let i = 0; i < computedHashHex.length; i++) {
      diff2 |= computedHashHex.charCodeAt(i) ^ expectedHashHex.charCodeAt(i);
    }
    return diff2 === 0;
  }
  const legacyHash = await sha2562(password);
  if (legacyHash.length !== stored.length) return false;
  let diff = 0;
  for (let i = 0; i < legacyHash.length; i++) {
    diff |= legacyHash.charCodeAt(i) ^ stored.charCodeAt(i);
  }
  return diff === 0;
}
function generateRandomPassword(length = 16) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

// src/utils/logger.ts
async function logActivity(db, userId, entityType, entityId, action, detail) {
  try {
    await db.prepare(
      `INSERT INTO activities (user_id, entity_type, entity_id, action, detail) VALUES (?, ?, ?, ?, ?)`
    ).bind(userId, entityType, entityId, action, detail).run();
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
}

// src/services/auth.service.ts
var AuthService = class {
  /**
   * Authenticates user credentials using PBKDF2 verification.
   * Manages single-session policy and expired session cleanup.
   */
  static async login(db, { email, password, ip = "local" }) {
    const cleanEmail = String(email).trim().toLowerCase();
    const user = await db.prepare(
      `SELECT * FROM users WHERE email = ? AND is_active = 1`
    ).bind(cleanEmail).first();
    if (!user) {
      throw new Error("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    }
    const valid = await verifyPassword(String(password), user.password_hash);
    if (!valid) {
      await logActivity(db, null, "auth", user.id, "\u0641\u0634\u0644_\u062F\u062E\u0648\u0644", `\u0645\u062D\u0627\u0648\u0644\u0629 \u062F\u062E\u0648\u0644 \u0641\u0627\u0634\u0644\u0629 \u0645\u0646 ${ip}`);
      throw new Error("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    }
    await db.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(user.id).run().catch(() => {
    });
    await db.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`).run().catch(() => {
    });
    const sessionToken = generateToken();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString().slice(0, 19).replace("T", " ");
    await db.prepare(
      `INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`
    ).bind(sessionToken, user.id, expiresAt).run();
    await logActivity(db, user.id, "auth", user.id, "\u062F\u062E\u0648\u0644", "\u062A\u0633\u062C\u064A\u0644 \u062F\u062E\u0648\u0644 \u0625\u0644\u0649 \u0627\u0644\u0646\u0638\u0627\u0645");
    return {
      user: safeUser(user),
      sessionToken,
      expiresAt
    };
  }
  /**
   * Terminates active session token
   */
  static async logout(db, token) {
    if (token) {
      await db.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
    }
  }
  /**
   * Resolves user by session token
   */
  static async getUserFromToken(db, token) {
    if (!token) return null;
    const user = await db.prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > datetime('now') AND u.is_active = 1`
    ).bind(token).first();
    return user || null;
  }
  /**
   * Cleans up expired sessions
   */
  static async pruneExpiredSessions(db) {
    const res = await db.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`).run();
    return res.meta?.changes || 0;
  }
};

// src/routes/auth.ts
var authRoutes = new Hono2();
authRoutes.post("/login", async (c) => {
  const ip = c.req.header("cf-connecting-ip") || c.req.header("x-real-ip") || (c.req.header("x-forwarded-for") ? c.req.header("x-forwarded-for").split(",")[0].trim() : "local");
  if (!checkRateLimit(ip)) {
    return c.json({ error: "\u062A\u0645 \u062A\u062C\u0627\u0648\u0632 \u0639\u062F\u062F \u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u0627\u0644\u0645\u0633\u0645\u0648\u062D \u0628\u0647\u0627. \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 15 \u062F\u0642\u064A\u0642\u0629." }, 429);
  }
  const body = await c.req.json().catch(() => ({}));
  const { email, password } = body;
  if (!email || !password) {
    return c.json({ error: "\u0627\u0644\u0628\u0631\u064A\u062F \u0648\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0645\u0637\u0644\u0648\u0628\u0627\u0646" }, 400);
  }
  try {
    const result = await AuthService.login(c.env.DB, { email, password, ip });
    const isHttps = c.req.url.startsWith("https://") || c.req.header("x-forwarded-proto") === "https";
    setCookie(c, SESSION_COOKIE_NAME, result.sessionToken, {
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: isHttps,
      maxAge: SESSION_DURATION_DAYS * 86400
    });
    return c.json({ user: result.user });
  } catch (err) {
    return c.json({ error: err.message || "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" }, 401);
  }
});
authRoutes.post("/logout", async (c) => {
  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (token) {
    await AuthService.logout(c.env.DB, token);
  }
  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
  return c.json({ ok: true });
});
authRoutes.get("/me", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ user: null });
  return c.json({ user: safeUser(user) });
});

// src/utils/validation.ts
function escapeLike(input) {
  return input.replace(/[%_\\]/g, (c) => "\\" + c);
}
function isAllowed(value, allowedValues) {
  return allowedValues.includes(value);
}
function cleanString(value, maxLength) {
  if (value === null || value === void 0) return null;
  const str = String(value).trim();
  if (str.length === 0) return null;
  return str.slice(0, maxLength);
}
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

// src/services/dashboard.service.ts
var DashboardService = class {
  /**
   * High-performance aggregated KPIs, agenda, and workload metrics.
   */
  static async getDashboardMetrics(db, user) {
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const [
      casesRow,
      hearingsToday,
      openTasks,
      invoiceStats,
      monthPaid,
      byStatus,
      byType,
      upcomingHearings,
      recentAct,
      teamLoad,
      expiringPoa,
      monthExp
    ] = await Promise.all([
      db.prepare(`SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status IN ('\u0645\u062A\u062F\u0627\u0648\u0644\u0629','\u0645\u062D\u062C\u0648\u0632\u0629 \u0644\u0644\u062D\u0643\u0645','\u0645\u0648\u0642\u0648\u0641\u0629') THEN 1 ELSE 0 END) AS open,
        SUM(CASE WHEN status = '\u0645\u0646\u062A\u0647\u064A\u0629' THEN 1 ELSE 0 END) AS closed,
        SUM(CASE WHEN priority IN ('\u0639\u0627\u062C\u0644\u0629','\u0639\u0627\u0644\u064A\u0629') AND status != '\u0645\u0646\u062A\u0647\u064A\u0629' THEN 1 ELSE 0 END) AS urgent
        FROM cases`).first(),
      db.prepare(`SELECT COUNT(*) AS n FROM hearings WHERE hearing_date = ? AND status = '\u0642\u0627\u062F\u0645\u0629'`).bind(today).first(),
      db.prepare(`SELECT COUNT(*) AS n FROM tasks WHERE status IN ('\u0645\u0641\u062A\u0648\u062D\u0629','\u062C\u0627\u0631\u064A\u0629')`).first(),
      db.prepare(`SELECT
        COUNT(CASE WHEN status IN ('\u0635\u0627\u062F\u0631\u0629','\u062C\u0632\u0626\u064A','\u0645\u062A\u0623\u062E\u0631\u0629') AND due_date IS NOT NULL AND due_date < date('now') THEN 1 END) AS overdue_count,
        COALESCE(SUM(CASE WHEN status IN ('\u0635\u0627\u062F\u0631\u0629','\u062C\u0632\u0626\u064A','\u0645\u062A\u0623\u062E\u0631\u0629') AND due_date IS NOT NULL AND due_date < date('now') THEN total-paid ELSE 0 END), 0) AS overdue_amount,
        COALESCE(SUM(CASE WHEN status IN ('\u0635\u0627\u062F\u0631\u0629','\u062C\u0632\u0626\u064A','\u0645\u062A\u0623\u062E\u0631\u0629') THEN total-paid ELSE 0 END), 0) AS outstanding_amount,
        COALESCE(SUM(CASE WHEN issue_date >= date('now','start of month') AND status != '\u0645\u0644\u063A\u0627\u0629' THEN total ELSE 0 END), 0) AS month_invoiced
        FROM invoices`).first(),
      db.prepare(`SELECT COALESCE(SUM(amount),0) AS n FROM payments WHERE paid_at >= date('now','start of month')`).first(),
      db.prepare(`SELECT status, COUNT(*) AS n FROM cases GROUP BY status`).all(),
      db.prepare(`SELECT ct.category AS name, COUNT(*) AS n FROM cases c LEFT JOIN case_types ct ON ct.id = c.case_type_id WHERE c.status != '\u0645\u0646\u062A\u0647\u064A\u0629' GROUP BY ct.category`).all(),
      db.prepare(`SELECT h.*, cs.case_no, cs.year, cs.title AS case_title, cl.name AS client_name, u.name AS lawyer_name, co.name AS court_name
        FROM hearings h
        JOIN cases cs ON cs.id = h.case_id
        JOIN clients cl ON cl.id = cs.client_id
        LEFT JOIN users u ON u.id = h.lawyer_id
        LEFT JOIN courts co ON co.id = h.court_id
        WHERE h.hearing_date >= date('now') AND h.status IN ('\u0642\u0627\u062F\u0645\u0629','\u062D\u062C\u0632 \u0644\u0644\u062D\u0643\u0645')
        ORDER BY h.hearing_date, h.hearing_time LIMIT 10`).all(),
      db.prepare(`SELECT a.*, u.name AS user_name, u.initials, u.color FROM activities a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC LIMIT 8`).all(),
      db.prepare(`SELECT u.id, u.name, u.initials, u.color, u.role, u.title,
        (SELECT COUNT(*) FROM cases WHERE lead_lawyer_id = u.id AND status != '\u0645\u0646\u062A\u0647\u064A\u0629') AS open_cases,
        (SELECT COUNT(*) FROM tasks WHERE assignee_id = u.id AND status IN ('\u0645\u0641\u062A\u0648\u062D\u0629','\u062C\u0627\u0631\u064A\u0629')) AS open_tasks
        FROM users u WHERE u.is_active = 1 AND u.role NOT IN ('accountant','secretary') ORDER BY open_cases DESC LIMIT 6`).all(),
      db.prepare(`SELECT p.*, cl.name AS client_name FROM powers_of_attorney p JOIN clients cl ON cl.id = p.client_id
        WHERE p.status = '\u0633\u0627\u0631\u064A' AND p.expiry_date IS NOT NULL AND p.expiry_date <= date('now','+45 days')
        ORDER BY p.expiry_date LIMIT 6`).all(),
      db.prepare(`SELECT COALESCE(SUM(amount),0) AS n FROM expenses WHERE expense_date >= date('now','start of month')`).first()
    ]);
    return {
      kpis: {
        open_cases: casesRow?.open || 0,
        total_cases: casesRow?.total || 0,
        closed_cases: casesRow?.closed || 0,
        urgent_cases: casesRow?.urgent || 0,
        hearings_today: hearingsToday?.n || 0,
        open_tasks: openTasks?.n || 0,
        overdue_invoices: invoiceStats?.overdue_count || 0,
        overdue_amount: invoiceStats?.overdue_amount || 0,
        month_collected: monthPaid?.n || 0,
        month_invoiced: invoiceStats?.month_invoiced || 0,
        outstanding: invoiceStats?.outstanding_amount || 0,
        overdue: invoiceStats?.overdue_amount || 0,
        month_expenses: monthExp?.n || 0
      },
      by_status: byStatus.results || [],
      by_type: byType.results || [],
      upcoming_hearings: upcomingHearings.results || [],
      activity: recentAct.results || [],
      team: teamLoad.results || [],
      expiring_poa: expiringPoa.results || [],
      me: safeUser(user)
    };
  }
  /**
   * Returns lookup dictionaries (courts, case types, users, clients, cases)
   */
  static async getLookups(db) {
    const [courts, types, users, clients, cases] = await Promise.all([
      db.prepare(`SELECT * FROM courts ORDER BY name`).all(),
      db.prepare(`SELECT * FROM case_types ORDER BY category, name`).all(),
      db.prepare(`SELECT id, name, title, role, initials, color, department FROM users WHERE is_active = 1 ORDER BY name`).all(),
      db.prepare(`SELECT id, name, type, status FROM clients ORDER BY name`).all(),
      db.prepare(`SELECT id, case_no, year, title FROM cases ORDER BY id DESC LIMIT 200`).all()
    ]);
    return {
      courts: courts.results || [],
      case_types: types.results || [],
      users: users.results || [],
      clients: clients.results || [],
      cases: cases.results || []
    };
  }
  /**
   * Fast global search across cases, clients, and powers of attorney
   */
  static async globalSearch(db, rawQuery) {
    const q = (rawQuery || "").trim();
    if (q.length < 2) {
      return { cases: [], clients: [], poas: [] };
    }
    const like = `%${escapeLike(q)}%`;
    const [cases, clients, poas] = await Promise.all([
      db.prepare(`SELECT c.id, c.case_no, c.year, c.title, c.status, cl.name AS client_name
        FROM cases c JOIN clients cl ON cl.id = c.client_id
        WHERE c.title LIKE ? ESCAPE '\\' OR c.case_no LIKE ? ESCAPE '\\' OR cl.name LIKE ? ESCAPE '\\' OR c.opposing_name LIKE ? ESCAPE '\\' LIMIT 8`).bind(like, like, like, like).all(),
      db.prepare(`SELECT id, name, type, phone, city FROM clients WHERE name LIKE ? ESCAPE '\\' OR national_id LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' LIMIT 6`).bind(like, like, like).all(),
      db.prepare(`SELECT p.id, p.poa_no, p.type, cl.name AS client_name FROM powers_of_attorney p JOIN clients cl ON cl.id = p.client_id WHERE p.poa_no LIKE ? ESCAPE '\\' OR cl.name LIKE ? ESCAPE '\\' LIMIT 4`).bind(like, like).all()
    ]);
    return {
      cases: cases.results || [],
      clients: clients.results || [],
      poas: poas.results || []
    };
  }
};

// src/routes/dashboard.ts
var dashboardRoutes = new Hono2();
dashboardRoutes.get("/dashboard", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const data = await DashboardService.getDashboardMetrics(c.env.DB, user);
  return c.json(data);
});
dashboardRoutes.get("/lookups", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const lookups = await DashboardService.getLookups(c.env.DB);
  return c.json(lookups);
});
dashboardRoutes.get("/search", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const results = await DashboardService.globalSearch(c.env.DB, c.req.query("q") || "");
  return c.json(results);
});

// src/services/users.service.ts
var UsersService = class {
  /**
   * Lists firm team members sorted by hierarchy and name
   */
  static async getUsers(db) {
    const { results } = await db.prepare(
      `SELECT id, name, title, email, phone, role, department, bar_number, bar_year, hourly_rate, bio, initials, color, is_active, created_at
       FROM users ORDER BY
        CASE role WHEN 'managing_partner' THEN 1 WHEN 'partner' THEN 2 WHEN 'senior' THEN 3 WHEN 'lawyer' THEN 4 WHEN 'intern' THEN 5 ELSE 6 END, name`
    ).all();
    return results || [];
  }
  /**
   * Retrieves user profile, assigned open cases, and workload hours
   */
  static async getUserProfile(db, id) {
    const user = await db.prepare(
      `SELECT id, name, title, email, phone, role, department, bar_number, bar_year, hourly_rate, bio, initials, color, is_active
       FROM users WHERE id = ?`
    ).bind(id).first();
    if (!user) return null;
    const [cases, hours, tasks] = await Promise.all([
      db.prepare(
        `SELECT c.*, cl.name AS client_name FROM cases c JOIN clients cl ON cl.id = c.client_id
         WHERE c.lead_lawyer_id = ? ORDER BY c.updated_at DESC LIMIT 50`
      ).bind(id).all(),
      db.prepare(
        `SELECT COALESCE(SUM(hours),0) AS n FROM time_entries WHERE user_id = ? AND work_date >= date('now','start of month')`
      ).bind(id).first(),
      db.prepare(
        `SELECT COUNT(*) AS n FROM tasks WHERE assignee_id = ? AND status IN ('\u0645\u0641\u062A\u0648\u062D\u0629','\u062C\u0627\u0631\u064A\u0629')`
      ).bind(id).first()
    ]);
    return {
      ...user,
      cases: cases.results || [],
      month_hours: hours?.n || 0,
      open_tasks: tasks?.n || 0
    };
  }
  /**
   * Creates a new user account with hashed password
   */
  static async createUser(db, data, currentUserId) {
    const name = cleanString(data.name, MAX_NAME_LENGTH);
    const email = cleanString(data.email, 254);
    if (!name || !email) {
      throw new Error("\u0627\u0644\u0627\u0633\u0645 \u0648\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0645\u0637\u0644\u0648\u0628\u0627\u0646");
    }
    if (!isValidEmail(email)) {
      throw new Error("\u0635\u064A\u063A\u0629 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    }
    const cleanEmail = email.toLowerCase();
    const existing = await db.prepare(`SELECT id FROM users WHERE email = ?`).bind(cleanEmail).first();
    if (existing) {
      throw new Error("\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u0641\u0639\u0644");
    }
    const role = data.role && isAllowed(data.role, [...ALLOWED_ROLES]) ? data.role : "lawyer";
    const rawPassword = data.password || generateRandomPassword(16);
    const hash = await hashPassword(rawPassword);
    const result = await db.prepare(
      `INSERT INTO users (name, title, email, phone, password_hash, role, department, bar_number, bar_year, hourly_rate, bio, initials, color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      name,
      cleanString(data.title, MAX_TEXT_LENGTH),
      cleanEmail,
      cleanString(data.phone, 30),
      hash,
      role,
      cleanString(data.department, MAX_TEXT_LENGTH),
      cleanString(data.bar_number, 50),
      data.bar_year ? Number(data.bar_year) : null,
      Number(data.hourly_rate || 0),
      cleanString(data.bio, MAX_TEXT_LENGTH),
      cleanString(data.initials, 5) || name.slice(0, 2),
      data.color || "#1F4E79"
    ).run();
    const id = result.meta.last_row_id;
    await logActivity(db, currentUserId, "user", id, "\u0625\u0646\u0634\u0627\u0621", `\u0645\u0633\u062A\u062E\u062F\u0645 \u062C\u062F\u064A\u062F: ${name}`);
    return id;
  }
  /**
   * Updates user details with role-based field restrictions
   */
  static async updateUser(db, targetId, data, currentUser) {
    const isSelf = currentUser.id === Number(targetId);
    const isPrivileged = ["managing_partner", "partner", "admin"].includes(currentUser.role);
    if (!isSelf && !isPrivileged) {
      throw new Error("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645");
    }
    const existing = await db.prepare(
      `SELECT id, name, title, email, phone, role, department, bar_number, bar_year, hourly_rate, bio, initials, color, is_active FROM users WHERE id = ?`
    ).bind(targetId).first();
    if (!existing) {
      throw new Error("\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    }
    const name = data.name !== void 0 ? cleanString(data.name, MAX_NAME_LENGTH) || existing.name : existing.name;
    const title = data.title !== void 0 ? cleanString(data.title, MAX_TEXT_LENGTH) : existing.title;
    const phone = data.phone !== void 0 ? cleanString(data.phone, 30) : existing.phone;
    const bio = data.bio !== void 0 ? cleanString(data.bio, MAX_TEXT_LENGTH) : existing.bio;
    const initials = data.initials !== void 0 ? cleanString(data.initials, 5) : existing.initials;
    const color = data.color !== void 0 ? data.color : existing.color;
    const department = data.department !== void 0 ? cleanString(data.department, MAX_TEXT_LENGTH) : existing.department;
    const bar_number = data.bar_number !== void 0 ? cleanString(data.bar_number, 50) : existing.bar_number;
    const bar_year = data.bar_year !== void 0 ? data.bar_year ? Number(data.bar_year) : null : existing.bar_year;
    const role = isPrivileged && data.role !== void 0 && isAllowed(data.role, [...ALLOWED_ROLES]) ? data.role : existing.role;
    const is_active = isPrivileged && data.is_active !== void 0 ? Number(data.is_active) : existing.is_active;
    const hourly_rate = isPrivileged && data.hourly_rate !== void 0 ? Number(data.hourly_rate) : existing.hourly_rate;
    const email = isPrivileged && data.email !== void 0 ? String(data.email).trim().toLowerCase() : existing.email;
    await db.prepare(
      `UPDATE users SET name=?, title=?, email=?, phone=?, role=?, department=?, bar_number=?, bar_year=?, hourly_rate=?, bio=?, initials=?, color=?, is_active=? WHERE id=?`
    ).bind(name, title, email, phone, role, department, bar_number, bar_year, hourly_rate, bio, initials, color, is_active, targetId).run();
    if (data.password) {
      if (typeof data.password !== "string" || data.password.length < 6) {
        throw new Error("\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u064A\u062C\u0628 \u0623\u0644\u0627 \u062A\u0642\u0644 \u0639\u0646 6 \u0623\u062D\u0631\u0641");
      }
      if (!isPrivileged) {
        if (!data.current_password) {
          throw new Error("\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0644\u062A\u063A\u064A\u064A\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631");
        }
        const fullUser = await db.prepare(`SELECT password_hash FROM users WHERE id = ?`).bind(targetId).first();
        if (!fullUser || !await verifyPassword(String(data.current_password), fullUser.password_hash)) {
          throw new Error("\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
        }
      }
      const newHash = await hashPassword(String(data.password));
      await db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).bind(newHash, targetId).run();
    }
    await logActivity(db, currentUser.id, "user", Number(targetId), "\u062A\u062D\u062F\u064A\u062B", `\u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 ${name}`);
    return true;
  }
};

// src/routes/users.ts
var userRoutes = new Hono2();
userRoutes.get("/", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const users = await UsersService.getUsers(c.env.DB);
  return c.json(users);
});
userRoutes.get("/:id", async (c) => {
  const currentUser = await requireUser(c);
  if (currentUser instanceof Response) return currentUser;
  const profile = await UsersService.getUserProfile(c.env.DB, c.req.param("id"));
  if (!profile) return c.json({ error: "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" }, 404);
  return c.json(profile);
});
userRoutes.post("/", async (c) => {
  const currentUser = await requireUser(c);
  if (currentUser instanceof Response) return currentUser;
  const forbidden = requireAdminOrPartner(currentUser, c);
  if (forbidden) return forbidden;
  const body = await c.req.json().catch(() => ({}));
  try {
    const id = await UsersService.createUser(c.env.DB, body, currentUser.id);
    return c.json({ id });
  } catch (err) {
    return c.json({ error: err.message }, 400);
  }
});
userRoutes.put("/:id", async (c) => {
  const currentUser = await requireUser(c);
  if (currentUser instanceof Response) return currentUser;
  const body = await c.req.json().catch(() => ({}));
  try {
    await UsersService.updateUser(c.env.DB, c.req.param("id"), body, currentUser);
    return c.json({ ok: true });
  } catch (err) {
    let status = 400;
    if (err.message.includes("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D")) status = 403;
    else if (err.message === "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F") status = 404;
    return c.json({ error: err.message }, status);
  }
});

// src/utils/pagination.ts
function parsePaginationParams(query = {}) {
  const isRawAll = query.all === "true" || query.all === "1";
  let page = parseInt(String(query.page || 1), 10);
  if (isNaN(page) || page < 1) page = 1;
  let limit = parseInt(String(query.limit || 20), 10);
  if (isNaN(limit) || limit < 1) limit = 20;
  if (limit > 100) limit = 100;
  const offset = (page - 1) * limit;
  const search = String(query.search || query.q || "").trim();
  return { page, limit, offset, search, isRawAll };
}
function createPaginationEnvelope(data, total, page, limit) {
  const totalSafe = Math.max(0, total || 0);
  const totalPages = limit > 0 ? Math.ceil(totalSafe / limit) : 0;
  const hasMore = page < totalPages;
  return {
    data: data || [],
    pagination: {
      total: totalSafe,
      page,
      limit,
      totalPages,
      hasMore
    }
  };
}

// src/utils/query-builder.ts
var SqlQueryBuilder = class {
  conditions = ["1=1"];
  binds = [];
  /**
   * Adds an unconditional WHERE clause and binds.
   */
  where(condition, ...binds) {
    this.conditions.push(condition);
    this.binds.push(...binds);
    return this;
  }
  /**
   * Conditionally appends a WHERE clause if the condition evaluated is truthy.
   */
  whereIf(condition, shouldAdd, ...binds) {
    if (Boolean(shouldAdd)) {
      this.conditions.push(condition);
      this.binds.push(...binds);
    }
    return this;
  }
  /**
   * Appends multi-column substring search with wildcard escaping.
   * Format: AND (col1 LIKE ? ESCAPE '\' OR col2 LIKE ? ESCAPE '\' ...)
   */
  whereSearch(columns, search) {
    if (!search || !search.trim() || columns.length === 0) return this;
    const escapedTerm = `%${escapeLike(search.trim())}%`;
    const clauses = columns.map((col) => `${col} LIKE ? ESCAPE '\\'`);
    this.conditions.push(`(${clauses.join(" OR ")})`);
    for (let i = 0; i < columns.length; i++) {
      this.binds.push(escapedTerm);
    }
    return this;
  }
  /**
   * Builds the formatted WHERE clause string and parameter bindings.
   */
  buildWhere() {
    return {
      whereSql: `WHERE ${this.conditions.join(" AND ")}`,
      binds: [...this.binds]
    };
  }
  /**
   * Executes both count and paginated data queries using the builder,
   * returning the standardized PaginatedResponse envelope.
   */
  static async executePaginated(db, opts) {
    const { whereSql, binds } = opts.whereBuilder.buildWhere();
    const countSql = `SELECT COUNT(*) AS total FROM ${opts.fromClause} ${whereSql}`;
    const countRow = await db.prepare(countSql).bind(...binds).first();
    const total = Number(countRow?.total || 0);
    const orderClause = opts.orderBy ? `ORDER BY ${opts.orderBy}` : "";
    const dataSql = `SELECT ${opts.selectColumns} FROM ${opts.fromClause} ${whereSql} ${orderClause} LIMIT ? OFFSET ?`;
    const dataBinds = [...binds, opts.limit, opts.offset];
    const { results } = await db.prepare(dataSql).bind(...dataBinds).all();
    return createPaginationEnvelope(results || [], total, opts.page, opts.limit);
  }
};

// src/services/clients.service.ts
var ClientsService = class {
  /**
   * Returns a paginated list of clients with calculated cases_count and balance using SqlQueryBuilder
   */
  static async getPaginatedClients(db, params = {}) {
    const { page, limit, offset, search } = parsePaginationParams(params);
    const { status, type, lawyer } = params;
    const qb = new SqlQueryBuilder().whereSearch([
      "cl.name",
      "cl.phone",
      "cl.national_id",
      "cl.tax_id",
      "cl.commercial_reg",
      "cl.email",
      "cl.city"
    ], search).whereIf("cl.status = ?", status && isAllowed(status, [...ALLOWED_CLIENT_STATUSES]), status).whereIf("cl.type = ?", type && isAllowed(String(type), [...ALLOWED_CLIENT_TYPES]), String(type)).whereIf("cl.assigned_lawyer_id = ?", lawyer, Number(lawyer));
    return SqlQueryBuilder.executePaginated(db, {
      fromClause: `clients cl LEFT JOIN users u ON u.id = cl.assigned_lawyer_id`,
      selectColumns: `cl.*, u.name AS lawyer_name,
        (SELECT COUNT(*) FROM cases WHERE client_id = cl.id) AS cases_count,
        (SELECT COALESCE(SUM(total-paid),0) FROM invoices WHERE client_id = cl.id AND status NOT IN ('\u0645\u0644\u063A\u0627\u0629','\u0645\u0633\u062F\u062F\u0629')) AS balance`,
      whereBuilder: qb,
      orderBy: "CASE cl.status WHEN 'vip' THEN 0 ELSE 1 END, cl.name",
      page,
      limit,
      offset
    });
  }
  /**
   * Lists clients with keyword and status filtering (backward compatible array return)
   */
  static async getClients(db, filters = {}) {
    const res = await this.getPaginatedClients(db, { ...filters, limit: filters.limit || 100 });
    return res.data;
  }
  /**
   * Fetches single client details including linked cases, invoices, POAs, and notes
   */
  static async getClientById(db, id) {
    const client = await db.prepare(
      `SELECT cl.*, u.name AS lawyer_name FROM clients cl LEFT JOIN users u ON u.id = cl.assigned_lawyer_id WHERE cl.id = ?`
    ).bind(id).first();
    if (!client) return null;
    const [cases, invoices, poas, notes] = await Promise.all([
      db.prepare(
        `SELECT c.*, ct.name AS type_name, co.name AS court_name, u.name AS lawyer_name
         FROM cases c
         LEFT JOIN case_types ct ON ct.id=c.case_type_id
         LEFT JOIN courts co ON co.id=c.court_id
         LEFT JOIN users u ON u.id=c.lead_lawyer_id
         WHERE c.client_id=? ORDER BY c.created_at DESC`
      ).bind(id).all(),
      db.prepare(`SELECT * FROM invoices WHERE client_id=? ORDER BY issue_date DESC LIMIT 50`).bind(id).all(),
      db.prepare(
        `SELECT p.*, u.name AS lawyer_name FROM powers_of_attorney p LEFT JOIN users u ON u.id=p.lawyer_id WHERE p.client_id=? ORDER BY p.issue_date DESC`
      ).bind(id).all(),
      db.prepare(
        `SELECT n.*, u.name AS user_name FROM notes n LEFT JOIN users u ON u.id=n.user_id WHERE n.client_id=? ORDER BY n.pinned DESC, n.created_at DESC LIMIT 50`
      ).bind(id).all()
    ]);
    return {
      ...client,
      cases: cases.results || [],
      invoices: invoices.results || [],
      poas: poas.results || [],
      notes: notes.results || []
    };
  }
  /**
   * Registers a new client
   */
  static async createClient(db, data, currentUserId) {
    const name = cleanString(data.name, MAX_NAME_LENGTH);
    if (!name) {
      throw new Error("\u0627\u0633\u0645 \u0627\u0644\u0645\u0648\u0643\u0644 \u0645\u0637\u0644\u0648\u0628");
    }
    const clientType = data.type && isAllowed(data.type, [...ALLOWED_CLIENT_TYPES]) ? data.type : "individual";
    const status = data.status && isAllowed(data.status, [...ALLOWED_CLIENT_STATUSES]) ? data.status : "active";
    const result = await db.prepare(
      `INSERT INTO clients (type,name,national_id,tax_id,commercial_reg,nationality,phone,phone2,email,address,city,occupation,company_rep,notes,status,assigned_lawyer_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      clientType,
      name,
      cleanString(data.national_id, 30),
      cleanString(data.tax_id, 30),
      cleanString(data.commercial_reg, 30),
      cleanString(data.nationality, 50) || "\u0645\u0635\u0631\u064A",
      cleanString(data.phone, 30),
      cleanString(data.phone2, 30),
      cleanString(data.email, 254),
      cleanString(data.address, MAX_TEXT_LENGTH),
      cleanString(data.city, 100),
      cleanString(data.occupation, 100),
      cleanString(data.company_rep, MAX_NAME_LENGTH),
      cleanString(data.notes, MAX_NOTE_LENGTH),
      status,
      data.assigned_lawyer_id ? Number(data.assigned_lawyer_id) : null
    ).run();
    const id = result.meta.last_row_id;
    await logActivity(db, currentUserId, "client", id, "\u0625\u0646\u0634\u0627\u0621", `\u0645\u0648\u0643\u0644 \u062C\u062F\u064A\u062F: ${name}`);
    return id;
  }
  /**
   * Updates client profile safely without overriding missing attributes
   */
  static async updateClient(db, id, data, currentUserId) {
    const existing = await db.prepare(`SELECT * FROM clients WHERE id = ?`).bind(id).first();
    if (!existing) {
      throw new Error("\u0627\u0644\u0645\u0648\u0643\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    }
    const type = data.type !== void 0 && isAllowed(data.type, [...ALLOWED_CLIENT_TYPES]) ? data.type : existing.type;
    const name = data.name !== void 0 ? cleanString(data.name, MAX_NAME_LENGTH) || existing.name : existing.name;
    const national_id = data.national_id !== void 0 ? cleanString(data.national_id, 30) : existing.national_id;
    const tax_id = data.tax_id !== void 0 ? cleanString(data.tax_id, 30) : existing.tax_id;
    const commercial_reg = data.commercial_reg !== void 0 ? cleanString(data.commercial_reg, 30) : existing.commercial_reg;
    const nationality = data.nationality !== void 0 ? cleanString(data.nationality, 50) : existing.nationality;
    const phone = data.phone !== void 0 ? cleanString(data.phone, 30) : existing.phone;
    const phone2 = data.phone2 !== void 0 ? cleanString(data.phone2, 30) : existing.phone2;
    const email = data.email !== void 0 ? cleanString(data.email, 254) : existing.email;
    const address = data.address !== void 0 ? cleanString(data.address, MAX_TEXT_LENGTH) : existing.address;
    const city = data.city !== void 0 ? cleanString(data.city, 100) : existing.city;
    const occupation = data.occupation !== void 0 ? cleanString(data.occupation, 100) : existing.occupation;
    const company_rep = data.company_rep !== void 0 ? cleanString(data.company_rep, MAX_NAME_LENGTH) : existing.company_rep;
    const notes = data.notes !== void 0 ? cleanString(data.notes, MAX_NOTE_LENGTH) : existing.notes;
    const status = data.status !== void 0 && isAllowed(data.status, [...ALLOWED_CLIENT_STATUSES]) ? data.status : existing.status;
    const assigned_lawyer_id = data.assigned_lawyer_id !== void 0 ? data.assigned_lawyer_id ? Number(data.assigned_lawyer_id) : null : existing.assigned_lawyer_id;
    await db.prepare(
      `UPDATE clients SET type=?, name=?, national_id=?, tax_id=?, commercial_reg=?, nationality=?, phone=?, phone2=?, email=?, address=?, city=?, occupation=?, company_rep=?, notes=?, status=?, assigned_lawyer_id=? WHERE id=?`
    ).bind(type, name, national_id, tax_id, commercial_reg, nationality, phone, phone2, email, address, city, occupation, company_rep, notes, status, assigned_lawyer_id, id).run();
    await logActivity(db, currentUserId, "client", Number(id), "\u062A\u062D\u062F\u064A\u062B", `\u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0648\u0643\u0644 ${name}`);
    return true;
  }
};

// src/routes/clients.ts
var clientRoutes = new Hono2();
clientRoutes.get("/", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const query = c.req.query();
  const result = await ClientsService.getPaginatedClients(c.env.DB, query);
  if (query.all === "true" || query.all === "1" || query.raw === "true") {
    return c.json(result.data);
  }
  return c.json(result);
});
clientRoutes.get("/:id", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const client = await ClientsService.getClientById(c.env.DB, c.req.param("id"));
  if (!client) return c.json({ error: "\u0627\u0644\u0645\u0648\u0643\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" }, 404);
  return c.json(client);
});
clientRoutes.post("/", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({}));
  try {
    const id = await ClientsService.createClient(c.env.DB, body, user.id);
    return c.json({ id });
  } catch (err) {
    return c.json({ error: err.message, ...err.details ? { details: err.details } : {} }, 400);
  }
});
clientRoutes.put("/:id", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({}));
  try {
    await ClientsService.updateClient(c.env.DB, c.req.param("id"), body, user.id);
    return c.json({ ok: true });
  } catch (err) {
    const status = err.message === "\u0627\u0644\u0645\u0648\u0643\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" ? 404 : 400;
    return c.json({ error: err.message }, status);
  }
});

// src/services/hearings.service.ts
var HearingsService = class {
  /**
   * Returns a paginated list of hearings with count and metadata using SqlQueryBuilder
   */
  static async getPaginatedHearings(db, params = {}) {
    const { page, limit, offset, search } = parsePaginationParams(params);
    const from = params.from || "2000-01-01";
    const to = params.to || "2099-12-31";
    const { lawyer, status, case_id, court_id } = params;
    const qb = new SqlQueryBuilder().where("h.hearing_date BETWEEN ? AND ?", from, to).whereSearch([
      "cs.title",
      "cs.case_no",
      "cl.name",
      "h.purpose",
      "h.circuit",
      "co.name"
    ], search).whereIf("h.lawyer_id = ?", lawyer, Number(lawyer)).whereIf("h.status = ?", status && isAllowed(status, [...ALLOWED_HEARING_STATUSES]), status).whereIf("h.case_id = ?", case_id, Number(case_id)).whereIf("h.court_id = ?", court_id, Number(court_id));
    return SqlQueryBuilder.executePaginated(db, {
      fromClause: `hearings h
        JOIN cases cs ON cs.id = h.case_id
        JOIN clients cl ON cl.id = cs.client_id
        LEFT JOIN users u ON u.id = h.lawyer_id
        LEFT JOIN courts co ON co.id = h.court_id`,
      selectColumns: `h.*, cs.case_no, cs.year, cs.title AS case_title, cs.priority, cl.name AS client_name, u.name AS lawyer_name, u.initials, u.color, co.name AS court_name`,
      whereBuilder: qb,
      orderBy: "h.hearing_date, h.hearing_time",
      page,
      limit,
      offset
    });
  }
  /**
   * Lists court session hearings (backward compatible array return)
   */
  static async getHearings(db, filters = {}) {
    const res = await this.getPaginatedHearings(db, { ...filters, limit: filters?.limit || 200 });
    return res.data;
  }
  /**
   * Schedules a court hearing session
   */
  static async scheduleHearing(db, data, currentUserId) {
    if (!data.case_id || !data.hearing_date) {
      throw new Error("\u0627\u0644\u0642\u0636\u064A\u0629 \u0648\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u062C\u0644\u0633\u0629 \u062D\u0642\u0648\u0644 \u0625\u062C\u0628\u0627\u0631\u064A\u0629");
    }
    const status = data.status && isAllowed(data.status, [...ALLOWED_HEARING_STATUSES]) ? data.status : "\u0642\u0627\u062F\u0645\u0629";
    const result = await db.prepare(
      `INSERT INTO hearings (case_id, hearing_date, hearing_time, court_id, circuit, type, purpose, lawyer_id, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      data.case_id,
      data.hearing_date,
      cleanString(data.hearing_time, 20),
      data.court_id || null,
      cleanString(data.circuit, 100),
      cleanString(data.type, 50) || "\u0645\u0631\u0627\u0641\u0639\u0629",
      cleanString(data.purpose, 500),
      data.lawyer_id || null,
      status,
      cleanString(data.notes, 2e3)
    ).run();
    return Number(result.meta.last_row_id);
  }
  /**
   * Updates hearing decision, attendance lawyer, or roll-over date
   */
  static async updateHearing(db, id, data) {
    const existing = await db.prepare(`SELECT * FROM hearings WHERE id=?`).bind(id).first();
    if (!existing) throw new Error("\u0627\u0644\u062C\u0644\u0633\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
    const status = data.status && isAllowed(data.status, [...ALLOWED_HEARING_STATUSES]) ? data.status : existing.status;
    await db.prepare(
      `UPDATE hearings SET hearing_date=?, hearing_time=?, court_id=?, circuit=?, type=?, purpose=?, result=?, next_date=?, lawyer_id=?, status=?, notes=? WHERE id=?`
    ).bind(
      data.hearing_date || existing.hearing_date,
      data.hearing_time !== void 0 ? cleanString(data.hearing_time, 20) : existing.hearing_time,
      data.court_id !== void 0 ? data.court_id : existing.court_id,
      data.circuit !== void 0 ? cleanString(data.circuit, 100) : existing.circuit,
      data.type !== void 0 ? cleanString(data.type, 50) : existing.type,
      data.purpose !== void 0 ? cleanString(data.purpose, 500) : existing.purpose,
      data.result !== void 0 ? cleanString(data.result, 1e3) : existing.result,
      data.next_date !== void 0 ? data.next_date : existing.next_date,
      data.lawyer_id !== void 0 ? data.lawyer_id : existing.lawyer_id,
      status,
      data.notes !== void 0 ? cleanString(data.notes, 2e3) : existing.notes,
      id
    ).run();
    return true;
  }
};

// src/services/cases.service.ts
var CasesService = class {
  /**
   * Returns a paginated list of cases with total counts and metadata using SqlQueryBuilder
   */
  static async getPaginatedCases(db, params = {}) {
    const { page, limit, offset, search } = parsePaginationParams(params);
    const { status, lawyer, type, priority, category, client_id } = params;
    const qb = new SqlQueryBuilder().whereSearch(["c.title", "c.case_no", "cl.name", "c.opposing_name", "c.subject"], search).whereIf("c.status = ?", status && isAllowed(status, [...ALLOWED_CASE_STATUSES]), status).whereIf("c.lead_lawyer_id = ?", lawyer, Number(lawyer)).whereIf("c.case_type_id = ?", type, Number(type)).whereIf("ct.category = ?", category, cleanString(category, 50)).whereIf("c.priority = ?", priority && isAllowed(priority, [...ALLOWED_CASE_PRIORITIES]), priority).whereIf("c.client_id = ?", client_id, Number(client_id));
    return SqlQueryBuilder.executePaginated(db, {
      fromClause: `cases c
        JOIN clients cl ON cl.id=c.client_id
        LEFT JOIN case_types ct ON ct.id=c.case_type_id
        LEFT JOIN courts co ON co.id=c.court_id
        LEFT JOIN users u ON u.id=c.lead_lawyer_id`,
      selectColumns: `c.*, cl.name AS client_name, cl.type AS client_type, ct.name AS type_name, ct.category,
        co.name AS court_name, u.name AS lawyer_name, u.initials AS lawyer_initials, u.color AS lawyer_color,
        (SELECT MIN(hearing_date) FROM hearings h WHERE h.case_id=c.id AND h.hearing_date>=date('now') AND h.status IN ('\u0642\u0627\u062F\u0645\u0629','\u062D\u062C\u0632 \u0644\u0644\u062D\u0643\u0645')) AS next_hearing`,
      whereBuilder: qb,
      orderBy: "CASE c.priority WHEN '\u0639\u0627\u062C\u0644\u0629' THEN 0 WHEN '\u0639\u0627\u0644\u064A\u0629' THEN 1 WHEN '\u0639\u0627\u062F\u064A\u0629' THEN 2 ELSE 3 END, c.updated_at DESC",
      page,
      limit,
      offset
    });
  }
  /**
   * Searches and lists cases (backward compatible array return)
   */
  static async getCases(db, filters = {}) {
    const res = await this.getPaginatedCases(db, { ...filters, limit: filters.limit || 150 });
    return res.data;
  }
  /**
   * Fetches complete case dossier with all linked records
   */
  static async getCaseById(db, id) {
    const caseRecord = await db.prepare(
      `SELECT c.*, cl.name AS client_name, cl.phone AS client_phone, cl.type AS client_type, cl.email AS client_email,
        ct.name AS type_name, ct.category, co.name AS court_name, u.name AS lawyer_name, u.initials AS lawyer_initials, u.color AS lawyer_color
       FROM cases c
       JOIN clients cl ON cl.id=c.client_id
       LEFT JOIN case_types ct ON ct.id=c.case_type_id
       LEFT JOIN courts co ON co.id=c.court_id
       LEFT JOIN users u ON u.id=c.lead_lawyer_id
       WHERE c.id=?`
    ).bind(id).first();
    if (!caseRecord) return null;
    const [hearings, docs, notes, lawyers, invoices, expenses, times, tasks, poas] = await Promise.all([
      db.prepare(`SELECT h.*, u.name AS lawyer_name, co.name AS court_name FROM hearings h LEFT JOIN users u ON u.id=h.lawyer_id LEFT JOIN courts co ON co.id=h.court_id WHERE h.case_id=? ORDER BY h.hearing_date DESC LIMIT 50`).bind(id).all(),
      db.prepare(`SELECT d.*, u.name AS uploader FROM documents d LEFT JOIN users u ON u.id=d.uploaded_by WHERE d.case_id=? ORDER BY d.created_at DESC LIMIT 50`).bind(id).all(),
      db.prepare(`SELECT n.*, u.name AS user_name, u.initials, u.color FROM notes n LEFT JOIN users u ON u.id=n.user_id WHERE n.case_id=? ORDER BY n.pinned DESC, n.created_at DESC LIMIT 50`).bind(id).all(),
      db.prepare(`SELECT u.id, u.name, u.title, u.initials, u.color, clw.role FROM case_lawyers clw JOIN users u ON u.id=clw.user_id WHERE clw.case_id=?`).bind(id).all(),
      db.prepare(`SELECT * FROM invoices WHERE case_id=? ORDER BY issue_date DESC LIMIT 50`).bind(id).all(),
      db.prepare(`SELECT * FROM expenses WHERE case_id=? ORDER BY expense_date DESC LIMIT 50`).bind(id).all(),
      db.prepare(`SELECT t.*, u.name AS user_name FROM time_entries t JOIN users u ON u.id=t.user_id WHERE t.case_id=? ORDER BY t.work_date DESC LIMIT 50`).bind(id).all(),
      db.prepare(`SELECT t.*, u.name AS assignee_name FROM tasks t LEFT JOIN users u ON u.id=t.assignee_id WHERE t.case_id=? ORDER BY t.due_date LIMIT 50`).bind(id).all(),
      db.prepare(`SELECT p.*, u.name AS lawyer_name FROM powers_of_attorney p LEFT JOIN users u ON u.id=p.lawyer_id WHERE p.case_id=? OR (p.case_id IS NULL AND p.client_id=?) LIMIT 50`).bind(id, caseRecord.client_id).all()
    ]);
    return {
      ...caseRecord,
      hearings: hearings.results || [],
      documents: docs.results || [],
      notes: notes.results || [],
      lawyers: lawyers.results || [],
      invoices: invoices.results || [],
      expenses: expenses.results || [],
      time_entries: times.results || [],
      tasks: tasks.results || [],
      poas: poas.results || []
    };
  }
  /**
   * Creates a new case record
   */
  static async createCase(db, data, currentUserId) {
    const case_no = cleanString(data.case_no, 50);
    const title = cleanString(data.title, MAX_NAME_LENGTH);
    if (!case_no || !data.year || !title || !data.client_id) {
      throw new Error("\u0631\u0642\u0645 \u0627\u0644\u062F\u0639\u0648\u0649 \u0648\u0627\u0644\u0633\u0646\u0629 \u0648\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u062F\u0639\u0648\u0649 \u0648\u0627\u0644\u0645\u0648\u0643\u0644 \u062D\u0642\u0648\u0644 \u0625\u062C\u0628\u0627\u0631\u064A\u0629");
    }
    const status = data.status && isAllowed(data.status, [...ALLOWED_CASE_STATUSES]) ? data.status : "\u0645\u062A\u062F\u0627\u0648\u0644\u0629";
    const priority = data.priority && isAllowed(data.priority, [...ALLOWED_CASE_PRIORITIES]) ? data.priority : "\u0639\u0627\u062F\u064A\u0629";
    const degree = data.degree && isAllowed(data.degree, [...ALLOWED_CASE_DEGREES]) ? data.degree : "\u0627\u0628\u062A\u062F\u0627\u0626\u064A";
    const result = await db.prepare(
      `INSERT INTO cases (case_no, year, title, case_type_id, court_id, circuit, degree, status, priority, client_id, opposing_name, opposing_lawyer, lead_lawyer_id, subject, claim_value, currency, filing_date, next_action)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      case_no,
      Number(data.year),
      title,
      data.case_type_id ? Number(data.case_type_id) : null,
      data.court_id ? Number(data.court_id) : null,
      cleanString(data.circuit, 100),
      degree,
      status,
      priority,
      Number(data.client_id),
      cleanString(data.opposing_name, MAX_NAME_LENGTH),
      cleanString(data.opposing_lawyer, MAX_NAME_LENGTH),
      data.lead_lawyer_id ? Number(data.lead_lawyer_id) : null,
      cleanString(data.subject, MAX_TEXT_LENGTH),
      Number(data.claim_value || 0),
      data.currency || "EGP",
      data.filing_date || null,
      cleanString(data.next_action, MAX_TEXT_LENGTH)
    ).run();
    const id = result.meta.last_row_id;
    if (data.lead_lawyer_id) {
      await db.prepare(`INSERT OR IGNORE INTO case_lawyers (case_id, user_id, role) VALUES (?, ?, '\u0631\u0626\u064A\u0633')`).bind(id, data.lead_lawyer_id).run();
    }
    await logActivity(db, currentUserId, "case", id, "\u0625\u0646\u0634\u0627\u0621", `\u0642\u0636\u064A\u0629 \u062C\u062F\u064A\u062F\u0629 ${case_no} \u0644\u0633\u0646\u0629 ${data.year}`);
    return id;
  }
  /**
   * Updates case details
   */
  static async updateCase(db, id, data, currentUserId) {
    const existing = await db.prepare(`SELECT * FROM cases WHERE id = ?`).bind(id).first();
    if (!existing) {
      throw new Error("\u0627\u0644\u0642\u0636\u064A\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
    }
    const case_no = data.case_no !== void 0 ? cleanString(data.case_no, 50) || existing.case_no : existing.case_no;
    const year = data.year !== void 0 ? Number(data.year) : existing.year;
    const title = data.title !== void 0 ? cleanString(data.title, MAX_NAME_LENGTH) || existing.title : existing.title;
    const case_type_id = data.case_type_id !== void 0 ? data.case_type_id ? Number(data.case_type_id) : null : existing.case_type_id;
    const court_id = data.court_id !== void 0 ? data.court_id ? Number(data.court_id) : null : existing.court_id;
    const circuit = data.circuit !== void 0 ? cleanString(data.circuit, 100) : existing.circuit;
    const degree = data.degree !== void 0 && isAllowed(data.degree, [...ALLOWED_CASE_DEGREES]) ? data.degree : existing.degree;
    const status = data.status !== void 0 && isAllowed(data.status, [...ALLOWED_CASE_STATUSES]) ? data.status : existing.status;
    const priority = data.priority !== void 0 && isAllowed(data.priority, [...ALLOWED_CASE_PRIORITIES]) ? data.priority : existing.priority;
    const client_id = data.client_id !== void 0 ? Number(data.client_id) : existing.client_id;
    const opposing_name = data.opposing_name !== void 0 ? cleanString(data.opposing_name, MAX_NAME_LENGTH) : existing.opposing_name;
    const opposing_lawyer = data.opposing_lawyer !== void 0 ? cleanString(data.opposing_lawyer, MAX_NAME_LENGTH) : existing.opposing_lawyer;
    const lead_lawyer_id = data.lead_lawyer_id !== void 0 ? data.lead_lawyer_id ? Number(data.lead_lawyer_id) : null : existing.lead_lawyer_id;
    const subject = data.subject !== void 0 ? cleanString(data.subject, MAX_TEXT_LENGTH) : existing.subject;
    const claim_value = data.claim_value !== void 0 ? Number(data.claim_value || 0) : existing.claim_value;
    const currency = data.currency !== void 0 ? data.currency || "EGP" : existing.currency || "EGP";
    const filing_date = data.filing_date !== void 0 ? data.filing_date : existing.filing_date;
    const next_action = data.next_action !== void 0 ? cleanString(data.next_action, MAX_TEXT_LENGTH) : existing.next_action;
    const outcome = data.outcome !== void 0 ? cleanString(data.outcome, MAX_TEXT_LENGTH) : existing.outcome;
    const closed_at = data.closed_at !== void 0 ? data.closed_at : existing.closed_at;
    await db.prepare(
      `UPDATE cases SET case_no=?, year=?, title=?, case_type_id=?, court_id=?, circuit=?, degree=?, status=?, priority=?, client_id=?, opposing_name=?, opposing_lawyer=?, lead_lawyer_id=?, subject=?, claim_value=?, currency=?, filing_date=?, next_action=?, outcome=?, closed_at=?, updated_at=datetime('now') WHERE id=?`
    ).bind(case_no, year, title, case_type_id, court_id, circuit, degree, status, priority, client_id, opposing_name, opposing_lawyer, lead_lawyer_id, subject, claim_value, currency, filing_date, next_action, outcome, closed_at, id).run();
    await logActivity(db, currentUserId, "case", Number(id), "\u062A\u062D\u062F\u064A\u062B", `\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0642\u0636\u064A\u0629 ${case_no}`);
    return true;
  }
  /**
   * Assigns a lawyer to a case
   */
  static async assignLawyer(db, caseId, lawyerId, role = "\u0645\u0633\u0627\u0639\u062F") {
    await db.prepare(`INSERT OR REPLACE INTO case_lawyers (case_id, user_id, role) VALUES (?, ?, ?)`).bind(caseId, lawyerId, cleanString(role, 50) || "\u0645\u0633\u0627\u0639\u062F").run();
  }
  /**
   * Returns a paginated list of hearings with count and metadata
   */
  static async getPaginatedHearings(db, params = {}) {
    return HearingsService.getPaginatedHearings(db, params);
  }
  /**
   * Lists court session hearings (backward compatible array return)
   */
  static async getHearings(db, filters = {}) {
    return HearingsService.getHearings(db, filters);
  }
  /**
   * Schedules a court hearing
   */
  static async scheduleHearing(db, data, currentUserId) {
    return HearingsService.scheduleHearing(db, data, currentUserId);
  }
  /**
   * Updates hearing outcome or details
   */
  static async updateHearing(db, id, data) {
    return HearingsService.updateHearing(db, id, data);
  }
};

// src/routes/cases.ts
var caseRoutes = new Hono2();
caseRoutes.get("/cases", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const query = c.req.query();
  const result = await CasesService.getPaginatedCases(c.env.DB, query);
  if (query.all === "true" || query.all === "1" || query.raw === "true") {
    return c.json(result.data);
  }
  return c.json(result);
});
caseRoutes.get("/cases/:id", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const caseData = await CasesService.getCaseById(c.env.DB, c.req.param("id"));
  if (!caseData) return c.json({ error: "\u0627\u0644\u0642\u0636\u064A\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" }, 404);
  return c.json(caseData);
});
caseRoutes.post("/cases", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({}));
  try {
    const id = await CasesService.createCase(c.env.DB, body, user.id);
    return c.json({ id });
  } catch (err) {
    return c.json({ error: err.message, ...err.details ? { details: err.details } : {} }, 400);
  }
});
caseRoutes.put("/cases/:id", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({}));
  try {
    await CasesService.updateCase(c.env.DB, c.req.param("id"), body, user.id);
    return c.json({ ok: true });
  } catch (err) {
    const status = err.message === "\u0627\u0644\u0642\u0636\u064A\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" ? 404 : 400;
    return c.json({ error: err.message }, status);
  }
});
caseRoutes.post("/cases/:id/lawyers", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({}));
  if (!body.user_id) return c.json({ error: "\u0627\u0644\u0645\u062D\u0627\u0645\u064A \u0645\u0637\u0644\u0648\u0628" }, 400);
  await CasesService.assignLawyer(c.env.DB, c.req.param("id"), body.user_id, body.role);
  return c.json({ ok: true });
});
caseRoutes.get("/hearings", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const query = c.req.query();
  const result = await CasesService.getPaginatedHearings(c.env.DB, query);
  if (query.all === "true" || query.all === "1" || query.raw === "true") {
    return c.json(result.data);
  }
  return c.json(result);
});
caseRoutes.post("/hearings", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({}));
  try {
    const id = await CasesService.scheduleHearing(c.env.DB, body, user.id);
    return c.json({ id });
  } catch (err) {
    return c.json({ error: err.message }, 400);
  }
});
caseRoutes.put("/hearings/:id", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({}));
  try {
    await CasesService.updateHearing(c.env.DB, c.req.param("id"), body);
    return c.json({ ok: true });
  } catch (err) {
    const status = err.message === "\u0627\u0644\u062C\u0644\u0633\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" ? 404 : 400;
    return c.json({ error: err.message }, status);
  }
});

// src/services/tasks.service.ts
var TasksService = class {
  /**
   * Lists tasks with filtering by status, assignee, or mine flag
   */
  static async getTasks(db, filters = {}) {
    const { status, assignee, mine, currentUserId } = filters;
    let sql = `SELECT t.*, u.name AS assignee_name, u.initials, u.color, cs.title AS case_title, cs.case_no, cs.year, cl.name AS client_name
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assignee_id
      LEFT JOIN cases cs ON cs.id = t.case_id
      LEFT JOIN clients cl ON cl.id = COALESCE(t.client_id, cs.client_id)
      WHERE 1=1`;
    const binds = [];
    if (status) {
      sql += ` AND t.status = ?`;
      binds.push(status);
    }
    if (assignee) {
      sql += ` AND t.assignee_id = ?`;
      binds.push(assignee);
    }
    if (mine && currentUserId) {
      sql += ` AND t.assignee_id = ?`;
      binds.push(currentUserId);
    }
    sql += ` ORDER BY CASE t.status WHEN '\u062C\u0627\u0631\u064A\u0629' THEN 0 WHEN '\u0645\u0641\u062A\u0648\u062D\u0629' THEN 1 ELSE 2 END, CASE t.priority WHEN '\u0639\u0627\u062C\u0644\u0629' THEN 0 WHEN '\u0639\u0627\u0644\u064A\u0629' THEN 1 ELSE 2 END, t.due_date LIMIT 150`;
    const { results } = await db.prepare(sql).bind(...binds).all();
    return results || [];
  }
  /**
   * Creates a new task assignment
   */
  static async createTask(db, data, currentUserId) {
    const title = data.title?.trim();
    if (!title) {
      throw new Error("\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0645\u0647\u0645\u0629 \u0645\u0637\u0644\u0648\u0628");
    }
    const result = await db.prepare(
      `INSERT INTO tasks (title, description, case_id, client_id, assignee_id, creator_id, due_date, due_time, priority, status, category)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      title,
      data.description || null,
      data.case_id ? Number(data.case_id) : null,
      data.client_id ? Number(data.client_id) : null,
      data.assignee_id ? Number(data.assignee_id) : null,
      currentUserId,
      data.due_date || null,
      data.due_time || null,
      data.priority || "\u0639\u0627\u062F\u064A\u0629",
      data.status || "\u0645\u0641\u062A\u0648\u062D\u0629",
      data.category || null
    ).run();
    return result.meta.last_row_id;
  }
  /**
   * Updates task status, priority, due date, or assignee
   */
  static async updateTask(db, id, data) {
    const existing = await db.prepare(`SELECT * FROM tasks WHERE id = ?`).bind(id).first();
    if (!existing) {
      throw new Error("\u0627\u0644\u0645\u0647\u0645\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
    }
    const title = data.title !== void 0 ? data.title?.trim() || existing.title : existing.title;
    const description = data.description !== void 0 ? data.description : existing.description;
    const case_id = data.case_id !== void 0 ? data.case_id ? Number(data.case_id) : null : existing.case_id;
    const client_id = data.client_id !== void 0 ? data.client_id ? Number(data.client_id) : null : existing.client_id;
    const assignee_id = data.assignee_id !== void 0 ? data.assignee_id ? Number(data.assignee_id) : null : existing.assignee_id;
    const due_date = data.due_date !== void 0 ? data.due_date : existing.due_date;
    const due_time = data.due_time !== void 0 ? data.due_time : existing.due_time;
    const priority = data.priority !== void 0 ? data.priority : existing.priority;
    const status = data.status !== void 0 ? data.status : existing.status;
    const category = data.category !== void 0 ? data.category : existing.category;
    const completed = status === "\u0645\u0643\u062A\u0645\u0644\u0629" ? existing.completed_at || (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ") : null;
    await db.prepare(
      `UPDATE tasks SET title=?, description=?, case_id=?, client_id=?, assignee_id=?, due_date=?, due_time=?, priority=?, status=?, category=?, completed_at=? WHERE id=?`
    ).bind(title, description, case_id, client_id, assignee_id, due_date, due_time, priority, status, category, completed, id).run();
    return true;
  }
};

// src/routes/tasks.ts
var taskRoutes = new Hono2();
taskRoutes.get("/", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const query = c.req.query();
  const tasks = await TasksService.getTasks(c.env.DB, {
    status: query.status,
    assignee: query.assignee,
    mine: query.mine === "1",
    currentUserId: user.id
  });
  return c.json(tasks);
});
taskRoutes.post("/", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({}));
  try {
    const id = await TasksService.createTask(c.env.DB, body, user.id);
    return c.json({ id });
  } catch (err) {
    return c.json({ error: err.message }, 400);
  }
});
taskRoutes.put("/:id", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({}));
  try {
    await TasksService.updateTask(c.env.DB, c.req.param("id"), body);
    return c.json({ ok: true });
  } catch (err) {
    const status = err.message === "\u0627\u0644\u0645\u0647\u0645\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" ? 404 : 400;
    return c.json({ error: err.message }, status);
  }
});

// src/services/documents.service.ts
var DocumentsService = class {
  /**
   * Returns a paginated list of electronic files and documents using SqlQueryBuilder
   */
  static async getPaginatedDocuments(db, params = {}) {
    const { page, limit, offset, search } = parsePaginationParams(params);
    const { doc_type, category, case_id, client_id } = params;
    const qb = new SqlQueryBuilder().whereSearch([
      "d.title",
      "d.ref_no",
      "d.file_name",
      "cs.title",
      "cs.case_no",
      "cl.name"
    ], search);
    const docTypeFilter = doc_type || category;
    if (docTypeFilter) {
      qb.where("d.doc_type = ?", cleanString(docTypeFilter, 50));
    }
    if (case_id) {
      qb.where("d.case_id = ?", Number(case_id));
    }
    if (client_id) {
      qb.where("COALESCE(d.client_id, cs.client_id) = ?", Number(client_id));
    }
    return SqlQueryBuilder.executePaginated(db, {
      fromClause: `documents d
        LEFT JOIN cases cs ON cs.id=d.case_id
        LEFT JOIN clients cl ON cl.id=COALESCE(d.client_id, cs.client_id)
        LEFT JOIN users u ON u.id=d.uploaded_by`,
      selectColumns: "d.*, cs.title AS case_title, cs.case_no, cs.year, cl.name AS client_name, u.name AS uploader",
      whereBuilder: qb,
      orderBy: "d.created_at DESC",
      page,
      limit,
      offset
    });
  }
  /**
   * Lists electronic files and documents (backward compatible array return)
   */
  static async getDocuments(db, filters = {}) {
    const res = await this.getPaginatedDocuments(db, { ...filters, limit: filters?.limit || 150 });
    return res.data;
  }
  /**
   * Fetches a single document by ID
   */
  static async getDocumentById(db, id) {
    const doc = await db.prepare(
      `SELECT d.*, cs.title AS case_title, cs.case_no, cs.year, cl.name AS client_name, u.name AS uploader
       FROM documents d
       LEFT JOIN cases cs ON cs.id=d.case_id
       LEFT JOIN clients cl ON cl.id=COALESCE(d.client_id, cs.client_id)
       LEFT JOIN users u ON u.id=d.uploaded_by
       WHERE d.id = ?`
    ).bind(id).first();
    return doc || null;
  }
  /**
   * Creates a new document record
   */
  static async createDocument(db, data, currentUserId) {
    const title = cleanString(data.title, MAX_NAME_LENGTH);
    if (!title) {
      throw new Error("\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0645\u0633\u062A\u0646\u062F \u0645\u0637\u0644\u0648\u0628");
    }
    const result = await db.prepare(
      `INSERT INTO documents (
         case_id, client_id, title, doc_type, ref_no, date_issued, pages, notes, uploaded_by,
         file_url, file_name, file_size, mime_type, storage_key
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      data.case_id ? Number(data.case_id) : null,
      data.client_id ? Number(data.client_id) : null,
      title,
      cleanString(data.doc_type, 50) || "\u0623\u062E\u0631\u0649",
      cleanString(data.ref_no, 100),
      data.date_issued || null,
      data.pages ? Number(data.pages) : null,
      cleanString(data.notes, MAX_NOTE_LENGTH),
      currentUserId,
      data.file_url ? cleanString(data.file_url, 1e3) : null,
      data.file_name ? cleanString(data.file_name, 255) : null,
      data.file_size ? Number(data.file_size) : null,
      data.mime_type ? cleanString(data.mime_type, 100) : null,
      data.storage_key ? cleanString(data.storage_key, 500) : null
    ).run();
    const id = result.meta.last_row_id;
    await logActivity(db, currentUserId, "document", id, "\u0625\u0646\u0634\u0627\u0621", `\u0645\u0633\u062A\u0646\u062F \u062C\u062F\u064A\u062F: ${title}`);
    return id;
  }
  /**
   * Lists powers of attorney
   */
  static async getPoas(db) {
    const { results } = await db.prepare(
      `SELECT p.*, cl.name AS client_name, u.name AS lawyer_name, cs.title AS case_title
       FROM powers_of_attorney p
       JOIN clients cl ON cl.id=p.client_id
       LEFT JOIN users u ON u.id=p.lawyer_id
       LEFT JOIN cases cs ON cs.id=p.case_id
       ORDER BY CASE p.status WHEN '\u0633\u0627\u0631\u064A' THEN 0 WHEN '\u0645\u0646\u062A\u0647\u064D' THEN 1 ELSE 2 END, p.expiry_date LIMIT 150`
    ).all();
    return results || [];
  }
  /**
   * Fetches a single POA by ID
   */
  static async getPoaById(db, id) {
    const poa = await db.prepare(
      `SELECT p.*, cl.name AS client_name, u.name AS lawyer_name, cs.title AS case_title
       FROM powers_of_attorney p
       JOIN clients cl ON cl.id=p.client_id
       LEFT JOIN users u ON u.id=p.lawyer_id
       LEFT JOIN cases cs ON cs.id=p.case_id
       WHERE p.id = ?`
    ).bind(id).first();
    return poa || null;
  }
  /**
   * Registers a new Power of Attorney
   */
  static async createPoa(db, data, currentUserId) {
    const poa_no = cleanString(data.poa_no, 100);
    if (!poa_no || !data.client_id) {
      throw new Error("\u0631\u0642\u0645 \u0627\u0644\u062A\u0648\u0643\u064A\u0644 \u0648\u0627\u0644\u0645\u0648\u0643\u0644 \u062D\u0642\u0648\u0644 \u0625\u062C\u0628\u0627\u0631\u064A\u0629");
    }
    const status = data.status && isAllowed(data.status, [...ALLOWED_POA_STATUSES]) ? data.status : "\u0633\u0627\u0631\u064A";
    const result = await db.prepare(
      `INSERT INTO powers_of_attorney (
         poa_no, client_id, case_id, lawyer_id, type, notary_office, issue_date, expiry_date,
         status, scope, notes, file_url, file_name, file_size, mime_type, storage_key
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      poa_no,
      Number(data.client_id),
      data.case_id ? Number(data.case_id) : null,
      data.lawyer_id ? Number(data.lawyer_id) : null,
      cleanString(data.type, 50) || "\u0639\u0627\u0645 \u0642\u0636\u0627\u064A\u0627",
      cleanString(data.notary_office, MAX_TEXT_LENGTH),
      data.issue_date || null,
      data.expiry_date || null,
      status,
      cleanString(data.scope, MAX_TEXT_LENGTH),
      cleanString(data.notes, MAX_NOTE_LENGTH),
      data.file_url ? cleanString(data.file_url, 1e3) : null,
      data.file_name ? cleanString(data.file_name, 255) : null,
      data.file_size ? Number(data.file_size) : null,
      data.mime_type ? cleanString(data.mime_type, 100) : null,
      data.storage_key ? cleanString(data.storage_key, 500) : null
    ).run();
    const id = result.meta.last_row_id;
    await logActivity(db, currentUserId, "poa", id, "\u0625\u0646\u0634\u0627\u0621", `\u062A\u0648\u0643\u064A\u0644 \u062C\u062F\u064A\u062F: ${poa_no}`);
    return id;
  }
  /**
   * Updates Power of Attorney
   */
  static async updatePoa(db, id, data, currentUserId) {
    const existing = await db.prepare(`SELECT * FROM powers_of_attorney WHERE id = ?`).bind(id).first();
    if (!existing) {
      throw new Error("\u0627\u0644\u062A\u0648\u0643\u064A\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    }
    const poa_no = data.poa_no !== void 0 ? cleanString(data.poa_no, 100) || existing.poa_no : existing.poa_no;
    const client_id = data.client_id !== void 0 ? Number(data.client_id) : existing.client_id;
    const case_id = data.case_id !== void 0 ? data.case_id ? Number(data.case_id) : null : existing.case_id;
    const lawyer_id = data.lawyer_id !== void 0 ? data.lawyer_id ? Number(data.lawyer_id) : null : existing.lawyer_id;
    const type = data.type !== void 0 ? cleanString(data.type, 50) || existing.type : existing.type;
    const notary_office = data.notary_office !== void 0 ? cleanString(data.notary_office, MAX_TEXT_LENGTH) : existing.notary_office;
    const issue_date = data.issue_date !== void 0 ? data.issue_date : existing.issue_date;
    const expiry_date = data.expiry_date !== void 0 ? data.expiry_date : existing.expiry_date;
    const status = data.status !== void 0 && isAllowed(data.status, [...ALLOWED_POA_STATUSES]) ? data.status : existing.status;
    const scope = data.scope !== void 0 ? cleanString(data.scope, MAX_TEXT_LENGTH) : existing.scope;
    const notes = data.notes !== void 0 ? cleanString(data.notes, MAX_NOTE_LENGTH) : existing.notes;
    const file_url = data.file_url !== void 0 ? data.file_url : existing.file_url;
    const file_name = data.file_name !== void 0 ? data.file_name : existing.file_name;
    const file_size = data.file_size !== void 0 ? data.file_size ? Number(data.file_size) : null : existing.file_size;
    const mime_type = data.mime_type !== void 0 ? data.mime_type : existing.mime_type;
    const storage_key = data.storage_key !== void 0 ? data.storage_key : existing.storage_key;
    await db.prepare(
      `UPDATE powers_of_attorney SET
         poa_no=?, client_id=?, case_id=?, lawyer_id=?, type=?, notary_office=?, issue_date=?, expiry_date=?,
         status=?, scope=?, notes=?, file_url=?, file_name=?, file_size=?, mime_type=?, storage_key=?
       WHERE id=?`
    ).bind(
      poa_no,
      client_id,
      case_id,
      lawyer_id,
      type,
      notary_office,
      issue_date,
      expiry_date,
      status,
      scope,
      notes,
      file_url,
      file_name,
      file_size,
      mime_type,
      storage_key,
      id
    ).run();
    await logActivity(db, currentUserId, "poa", Number(id), "\u062A\u062D\u062F\u064A\u062B", `\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u062A\u0648\u0643\u064A\u0644: ${poa_no}`);
    return true;
  }
  /**
   * Appends a memo or quick note
   */
  static async createNote(db, data, currentUserId) {
    const content = cleanString(data.content, MAX_NOTE_LENGTH);
    if (!content) {
      throw new Error("\u0645\u062D\u062A\u0648\u0649 \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0629 \u0645\u0637\u0644\u0648\u0628");
    }
    const result = await db.prepare(
      `INSERT INTO notes (case_id, client_id, user_id, content, pinned) VALUES (?, ?, ?, ?, ?)`
    ).bind(
      data.case_id ? Number(data.case_id) : null,
      data.client_id ? Number(data.client_id) : null,
      currentUserId,
      content,
      data.pinned ? 1 : 0
    ).run();
    return result.meta.last_row_id;
  }
};

// src/storage/config.ts
import path from "node:path";
import fs from "node:fs";

// src/config/env.ts
function getRawEnv(key) {
  const p = globalThis.process?.env;
  if (!p) return void 0;
  const val = p[key];
  return typeof val === "string" ? val.trim() : void 0;
}
function loadAppConfig() {
  const rawNodeEnv = getRawEnv("NODE_ENV") || "development";
  const nodeEnv = rawNodeEnv === "production" || rawNodeEnv === "test" ? rawNodeEnv : "development";
  const rawPort = getRawEnv("PORT");
  const port = rawPort ? parseInt(rawPort, 10) : 3e3;
  const remoteUrl = getRawEnv("TURSO_DATABASE_URL") || getRawEnv("DATABASE_URL") || getRawEnv("LIBSQL_URL");
  const authToken = getRawEnv("TURSO_AUTH_TOKEN") || getRawEnv("DATABASE_AUTH_TOKEN");
  const localPath = getRawEnv("SQLITE_PATH") || getRawEnv("DATABASE_PATH") || "./data/law_firm.db";
  const isRemote = Boolean(remoteUrl && !remoteUrl.startsWith("file:"));
  const bucketName = getRawEnv("R2_BUCKET_NAME") || getRawEnv("S3_BUCKET_NAME") || getRawEnv("AWS_S3_BUCKET");
  const accessKeyId = getRawEnv("R2_ACCESS_KEY_ID") || getRawEnv("AWS_ACCESS_KEY_ID");
  const secretAccessKey = getRawEnv("R2_SECRET_ACCESS_KEY") || getRawEnv("AWS_SECRET_ACCESS_KEY");
  const accountId = getRawEnv("R2_ACCOUNT_ID");
  const endpoint = getRawEnv("R2_ENDPOINT") || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : getRawEnv("S3_ENDPOINT"));
  const region = getRawEnv("AWS_REGION") || getRawEnv("R2_REGION") || "auto";
  const publicUrl = getRawEnv("R2_PUBLIC_URL") || getRawEnv("S3_PUBLIC_URL");
  const isCloudConfigured = Boolean(bucketName && accessKeyId && secretAccessKey);
  return Object.freeze({
    nodeEnv,
    isProduction: nodeEnv === "production",
    isTest: nodeEnv === "test",
    port: isNaN(port) ? 3e3 : port,
    database: Object.freeze({
      url: remoteUrl,
      authToken,
      localPath,
      isRemote
    }),
    storage: Object.freeze({
      bucketName,
      accessKeyId,
      secretAccessKey,
      endpoint,
      region,
      publicUrl,
      isCloudConfigured
    })
  });
}
var config = loadAppConfig();

// src/storage/config.ts
var ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png"
];
var MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;
function getStorageConfig() {
  const bucketName = config.storage.bucketName;
  const accessKeyId = config.storage.accessKeyId;
  const secretAccessKey = config.storage.secretAccessKey;
  const endpoint = config.storage.endpoint;
  const region = config.storage.region;
  const publicUrl = config.storage.publicUrl;
  const isCloudConfigured = config.storage.isCloudConfigured;
  const localUploadDir = path.resolve(process.cwd(), "data", "uploads");
  if (!isCloudConfigured) {
    try {
      if (!fs.existsSync(localUploadDir)) {
        fs.mkdirSync(localUploadDir, { recursive: true });
      }
    } catch {
    }
  }
  return {
    bucketName,
    endpoint,
    region,
    accessKeyId,
    secretAccessKey,
    publicUrl,
    maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
    allowedMimeTypes: ALLOWED_MIME_TYPES,
    isCloudConfigured,
    localUploadDir
  };
}

// src/storage/service.ts
import crypto3 from "node:crypto";
import path2 from "node:path";
import fs2 from "node:fs";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
var cachedS3Client = null;
var StorageService = class {
  /**
   * Sanitizes user-provided filenames to prevent path traversal and shell injection.
   */
  static sanitizeFilename(rawName) {
    if (!rawName || !rawName.trim()) return "document.pdf";
    const base = path2.basename(rawName.trim());
    const sanitized = base.replace(/[^\w\u0600-\u06FF.-]/g, "_").replace(/\.{2,}/g, ".").trim();
    return sanitized || "document.pdf";
  }
  /**
   * Enforces server-side file security constraints.
   */
  static validateFile(size, mimeType, filename) {
    if (!size || size <= 0) {
      return { valid: false, error: "\u0627\u0644\u0645\u0644\u0641 \u0641\u0627\u0631\u063A \u0623\u0648 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D" };
    }
    if (size > MAX_FILE_SIZE_BYTES) {
      return { valid: false, error: "\u062D\u062C\u0645 \u0627\u0644\u0645\u0644\u0641 \u064A\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0627\u0644\u0645\u0633\u0645\u0648\u062D \u0628\u0647 (15 \u0645\u064A\u062C\u0627\u0628\u0627\u064A\u062A)" };
    }
    const cleanMime = (mimeType || "").toLowerCase().trim();
    if (!ALLOWED_MIME_TYPES.includes(cleanMime)) {
      return {
        valid: false,
        error: "\u0646\u0648\u0639 \u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645. \u0627\u0644\u0635\u064A\u063A \u0627\u0644\u0645\u062F\u0639\u0648\u0645\u0629 \u0647\u064A: PDF (\u0645\u0633\u062A\u0646\u062F\u0627\u062A), JPEG, PNG (\u0635\u0648\u0631)"
      };
    }
    const ext = path2.extname(filename).toLowerCase();
    const validExtensions = {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"]
    };
    const expectedExts = validExtensions[cleanMime] || [];
    if (!expectedExts.includes(ext)) {
      return {
        valid: false,
        error: `\u0627\u0645\u062A\u062F\u0627\u062F \u0627\u0644\u0645\u0644\u0641 (${ext}) \u0644\u0627 \u064A\u062A\u0637\u0627\u0628\u0642 \u0645\u0639 \u0646\u0648\u0639 \u0627\u0644\u0645\u062D\u062A\u0648\u0649 (${cleanMime})`
      };
    }
    return { valid: true };
  }
  /**
   * Lazily initializes and caches the S3Client instance for Cloudflare R2 / AWS S3.
   */
  static getS3Client() {
    const config3 = getStorageConfig();
    if (!config3.isCloudConfigured) return null;
    if (!cachedS3Client) {
      cachedS3Client = new S3Client({
        region: config3.region,
        endpoint: config3.endpoint,
        credentials: {
          accessKeyId: config3.accessKeyId,
          secretAccessKey: config3.secretAccessKey
        }
      });
    }
    return cachedS3Client;
  }
  /**
   * Uploads a file to Cloudflare R2 / AWS S3 or the local persistent storage fallback.
   */
  static async uploadFile(input) {
    const config3 = getStorageConfig();
    const sanitizedName = this.sanitizeFilename(input.filename);
    const validation = this.validateFile(input.buffer.length, input.mimeType, sanitizedName);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    const folder = (input.folder || "documents").replace(/[^a-zA-Z0-9_-]/g, "");
    const randHex = Array.from(crypto3.randomBytes(6)).map((b) => b.toString(16).padStart(2, "0")).join("");
    const uniquePrefix = `${Date.now()}-${randHex}`;
    const storageKey = `${folder}/${uniquePrefix}-${sanitizedName}`;
    const s3 = this.getS3Client();
    if (s3 && config3.bucketName) {
      await s3.send(
        new PutObjectCommand({
          Bucket: config3.bucketName,
          Key: storageKey,
          Body: input.buffer,
          ContentType: input.mimeType,
          Metadata: {
            "original-filename": encodeURIComponent(sanitizedName),
            "uploaded-at": (/* @__PURE__ */ new Date()).toISOString()
          }
        })
      );
      const file_url = config3.publicUrl ? `${config3.publicUrl.replace(/\/$/, "")}/${storageKey}` : `/api/files/${storageKey}`;
      return {
        file_url,
        file_name: sanitizedName,
        file_size: input.buffer.length,
        mime_type: input.mimeType,
        storage_key: storageKey
      };
    } else {
      const targetPath = path2.resolve(config3.localUploadDir, storageKey);
      const targetDir = path2.dirname(targetPath);
      if (!fs2.existsSync(targetDir)) {
        fs2.mkdirSync(targetDir, { recursive: true });
      }
      fs2.writeFileSync(targetPath, Buffer.from(input.buffer));
      return {
        file_url: `/api/files/${storageKey}`,
        file_name: sanitizedName,
        file_size: input.buffer.length,
        mime_type: input.mimeType,
        storage_key: storageKey
      };
    }
  }
  /**
   * Retrieves a file for streaming or preview.
   */
  static async getFile(storageKey) {
    const config3 = getStorageConfig();
    if (!storageKey || storageKey.includes("..") || path2.isAbsolute(storageKey)) {
      throw new Error("\u0645\u0633\u0627\u0631 \u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0647");
    }
    const normalizedKey = path2.normalize(storageKey).replace(/\\/g, "/");
    if (normalizedKey.includes("..") || path2.isAbsolute(normalizedKey)) {
      throw new Error("\u0645\u0633\u0627\u0631 \u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0647");
    }
    const s3 = this.getS3Client();
    if (s3 && config3.bucketName) {
      try {
        const response = await s3.send(
          new GetObjectCommand({
            Bucket: config3.bucketName,
            Key: normalizedKey
          })
        );
        if (!response.Body) return null;
        const bytes = await response.Body.transformToByteArray();
        const filename = this.sanitizeFilename(path2.basename(normalizedKey));
        return {
          data: Buffer.from(bytes),
          mimeType: response.ContentType || "application/octet-stream",
          filename,
          size: Number(response.ContentLength || bytes.length)
        };
      } catch (err) {
        if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
          return null;
        }
        throw err;
      }
    } else {
      const localPath = path2.resolve(config3.localUploadDir, normalizedKey);
      if (!fs2.existsSync(localPath)) {
        return null;
      }
      const data = fs2.readFileSync(localPath);
      const ext = path2.extname(localPath).toLowerCase();
      const mimes = {
        ".pdf": "application/pdf",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png"
      };
      return {
        data,
        mimeType: mimes[ext] || "application/octet-stream",
        filename: path2.basename(localPath),
        size: data.length
      };
    }
  }
  /**
   * Deletes a file from storage.
   */
  static async deleteFile(storageKey) {
    const config3 = getStorageConfig();
    const normalizedKey = path2.normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, "");
    const s3 = this.getS3Client();
    if (s3 && config3.bucketName) {
      try {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: config3.bucketName,
            Key: normalizedKey
          })
        );
        return true;
      } catch {
        return false;
      }
    } else {
      const localPath = path2.resolve(config3.localUploadDir, normalizedKey);
      if (fs2.existsSync(localPath)) {
        fs2.unlinkSync(localPath);
        return true;
      }
      return false;
    }
  }
};

// src/utils/errors.ts
var AppError = class extends Error {
  statusCode;
  details;
  isOperational;
  constructor(message, statusCode = 500, details) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
};

// src/utils/validators.ts
function validateFileUploadMetadata(data) {
  const errors = [];
  if (!data.filename || typeof data.filename !== "string" || !data.filename.trim()) {
    errors.push({ field: "filename", message: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0644\u0641 \u0625\u062C\u0628\u0627\u0631\u064A" });
  } else {
    const name = data.filename.trim();
    if (name.length > 255) {
      errors.push({ field: "filename", message: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0644\u0641 \u0637\u0648\u064A\u0644 \u062C\u062F\u0627\u064B (\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 255 \u062D\u0631\u0641)" });
    }
    if (name.includes("\0") || name.includes("..") || /[<>:"/\\|?*]/.test(name)) {
      errors.push({ field: "filename", message: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0644\u0641 \u064A\u062D\u062A\u0648\u064A \u0639\u0644\u0649 \u0631\u0645\u0648\u0632 \u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D \u0628\u0647\u0627 \u0623\u0648 \u0645\u062D\u0627\u0648\u0644\u0629 \u0627\u062C\u062A\u064A\u0627\u0632 \u0645\u0633\u0627\u0631" });
    }
  }
  const cleanMime = typeof data.mimeType === "string" ? data.mimeType.toLowerCase().trim() : "";
  if (!cleanMime) {
    errors.push({ field: "mimeType", message: "\u0646\u0648\u0639 \u0627\u0644\u0645\u0644\u0641 (MIME Type) \u0625\u062C\u0628\u0627\u0631\u064A" });
  } else if (!ALLOWED_MIME_TYPES.includes(cleanMime)) {
    errors.push({
      field: "mimeType",
      message: `\u0646\u0648\u0639 \u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645 (${cleanMime}). \u0627\u0644\u0635\u064A\u063A \u0627\u0644\u0645\u062F\u0639\u0648\u0645\u0629 \u0641\u0642\u0637: PDF, JPEG, PNG`
    });
  }
  const size = Number(data.size);
  if (data.size !== void 0 && (isNaN(size) || size <= 0)) {
    errors.push({ field: "size", message: "\u062D\u062C\u0645 \u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D" });
  } else if (size > MAX_FILE_SIZE_BYTES) {
    errors.push({
      field: "size",
      message: `\u062D\u062C\u0645 \u0627\u0644\u0645\u0644\u0641 (${(size / (1024 * 1024)).toFixed(1)}MB) \u064A\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0627\u0644\u0645\u0633\u0645\u0648\u062D \u0628\u0647 (15MB)`
    });
  }
  const folder = typeof data.folder === "string" && data.folder.trim() ? data.folder.trim() : "documents";
  if (!/^[a-zA-Z0-9_-]+$/.test(folder) || folder.length > 50) {
    errors.push({ field: "folder", message: "\u0627\u0633\u0645 \u0627\u0644\u0645\u062C\u0644\u062F \u063A\u064A\u0631 \u0635\u0627\u0644\u062D" });
  }
  if (errors.length > 0) {
    return { success: false, errors };
  }
  return {
    success: true,
    data: {
      filename: String(data.filename).trim(),
      mimeType: cleanMime,
      size: isNaN(size) ? 0 : size,
      folder
    }
  };
}

// src/routes/documents.ts
var documentRoutes = new Hono2();
documentRoutes.post("/upload", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  try {
    const contentType = c.req.header("content-type") || "";
    let buffer = null;
    let filename = "";
    let mimeType = "";
    let folder = "documents";
    if (contentType.includes("application/json")) {
      const body = await c.req.json().catch(() => ({}));
      if (!body.base64 || !body.filename) {
        return c.json({ error: "\u064A\u0631\u062C\u0649 \u062A\u0642\u062F\u064A\u0645 \u0645\u062D\u062A\u0648\u0649 \u0627\u0644\u0645\u0644\u0641 \u0628\u0635\u064A\u063A\u0629 base64 \u0648\u0627\u0633\u0645 \u0627\u0644\u0645\u0644\u0641" }, 400);
      }
      buffer = Buffer.from(body.base64, "base64");
      filename = body.filename;
      mimeType = body.mime_type || body.mimeType || "application/pdf";
      folder = body.folder || "documents";
    } else {
      const body = await c.req.parseBody();
      const rawFile = body["file"];
      if (!rawFile || !(rawFile instanceof File)) {
        return c.json({ error: "\u0644\u0645 \u064A\u062A\u0645 \u062A\u0648\u0641\u064A\u0631 \u0623\u064A \u0645\u0644\u0641 \u0644\u0644\u0631\u0641\u0639" }, 400);
      }
      const arrayBuf = await rawFile.arrayBuffer();
      buffer = Buffer.from(arrayBuf);
      filename = rawFile.name;
      mimeType = rawFile.type || "application/octet-stream";
      folder = typeof body["folder"] === "string" ? body["folder"] : "documents";
    }
    if (!buffer) {
      return c.json({ error: "\u0644\u0645 \u064A\u062A\u0645 \u062A\u0648\u0641\u064A\u0631 \u0623\u064A \u0645\u0644\u0641 \u0644\u0644\u0631\u0641\u0639" }, 400);
    }
    const validation = validateFileUploadMetadata({
      filename,
      mimeType,
      size: buffer.length,
      folder
    });
    if (!validation.success) {
      return c.json({
        error: validation.errors?.[0]?.message || "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629",
        details: validation.errors
      }, 400);
    }
    const uploaded = await StorageService.uploadFile({
      buffer,
      filename: validation.data.filename,
      mimeType: validation.data.mimeType,
      folder: validation.data.folder
    });
    return c.json(uploaded, 201);
  } catch (err) {
    return c.json({
      error: err.message || "\u0641\u0634\u0644 \u0631\u0641\u0639 \u0627\u0644\u0645\u0644\u0641",
      ...err.details ? { details: err.details } : {}
    }, 400);
  }
});
documentRoutes.get("/files/:folder/:filename", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) {
    return c.json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0645\u0644\u0641" }, 401);
  }
  const folder = c.req.param("folder");
  const filename = c.req.param("filename");
  const storageKey = `${folder}/${filename}`;
  try {
    const fileResult = await StorageService.getFile(storageKey);
    if (!fileResult) {
      return c.json({ error: "\u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" }, 404);
    }
    const isDownload = c.req.query("download") === "1";
    const disposition = isDownload ? "attachment" : "inline";
    return new Response(new Uint8Array(fileResult.data), {
      headers: {
        "Content-Type": fileResult.mimeType,
        "Content-Length": String(fileResult.size),
        "Content-Disposition": `${disposition}; filename="${encodeURIComponent(fileResult.filename)}"`,
        "Cache-Control": "private, max-age=3600"
      }
    });
  } catch (err) {
    return c.json({ error: err.message || "\u062A\u0639\u0630\u0631 \u062C\u0644\u0628 \u0627\u0644\u0645\u0644\u0641" }, 400);
  }
});
documentRoutes.delete("/files/:folder/:filename", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const folder = c.req.param("folder");
  const filename = c.req.param("filename");
  const storageKey = `${folder}/${filename}`;
  try {
    const deleted = await StorageService.deleteFile(storageKey);
    return c.json({ ok: deleted });
  } catch (err) {
    return c.json({ error: err.message || "\u062A\u0639\u0630\u0631 \u062D\u0630\u0641 \u0627\u0644\u0645\u0644\u0641" }, 400);
  }
});
documentRoutes.get("/documents", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const query = c.req.query();
  const result = await DocumentsService.getPaginatedDocuments(c.env.DB, query);
  if (query.all === "true" || query.all === "1" || query.raw === "true") {
    return c.json(result.data);
  }
  return c.json(result);
});
documentRoutes.get("/documents/:id", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const doc = await DocumentsService.getDocumentById(c.env.DB, c.req.param("id"));
  if (!doc) {
    return c.json({ error: "\u0627\u0644\u0645\u0633\u062A\u0646\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" }, 404);
  }
  return c.json(doc);
});
documentRoutes.post("/documents", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({}));
  try {
    const id = await DocumentsService.createDocument(c.env.DB, body, user.id);
    return c.json({ id });
  } catch (err) {
    return c.json({ error: err.message, ...err.details ? { details: err.details } : {} }, 400);
  }
});
documentRoutes.get("/poas", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const poas = await DocumentsService.getPoas(c.env.DB);
  return c.json(poas);
});
documentRoutes.get("/poas/:id", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const poa = await DocumentsService.getPoaById(c.env.DB, c.req.param("id"));
  if (!poa) {
    return c.json({ error: "\u0627\u0644\u062A\u0648\u0643\u064A\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" }, 404);
  }
  return c.json(poa);
});
documentRoutes.post("/poas", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({}));
  try {
    const id = await DocumentsService.createPoa(c.env.DB, body, user.id);
    return c.json({ id });
  } catch (err) {
    return c.json({ error: err.message, ...err.details ? { details: err.details } : {} }, 400);
  }
});
documentRoutes.put("/poas/:id", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({}));
  try {
    await DocumentsService.updatePoa(c.env.DB, c.req.param("id"), body, user.id);
    return c.json({ ok: true });
  } catch (err) {
    const status = err.message === "\u0627\u0644\u062A\u0648\u0643\u064A\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" ? 404 : 400;
    return c.json({ error: err.message, ...err.details ? { details: err.details } : {} }, status);
  }
});
documentRoutes.post("/notes", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({}));
  try {
    const id = await DocumentsService.createNote(c.env.DB, body, user.id);
    return c.json({ id });
  } catch (err) {
    return c.json({ error: err.message, ...err.details ? { details: err.details } : {} }, 400);
  }
});

// src/services/finance.service.ts
var FinanceService = class {
  /**
   * Lists invoices with optional status filtering
   */
  static async getInvoices(db, status) {
    let sql = `SELECT i.*, cl.name AS client_name, cs.title AS case_title, cs.case_no, cs.year
      FROM invoices i JOIN clients cl ON cl.id=i.client_id LEFT JOIN cases cs ON cs.id=i.case_id WHERE 1=1`;
    const binds = [];
    if (status && isAllowed(status, [...ALLOWED_INVOICE_STATUSES])) {
      sql += ` AND i.status = ?`;
      binds.push(status);
    }
    sql += ` ORDER BY i.issue_date DESC LIMIT 150`;
    const { results } = await db.prepare(sql).bind(...binds).all();
    return results || [];
  }
  /**
   * Fetches single invoice details with line items and historical payments
   */
  static async getInvoiceById(db, id) {
    const inv = await db.prepare(
      `SELECT i.*, cl.name AS client_name, cl.address, cl.tax_id, cl.phone, cl.email, cs.title AS case_title, cs.case_no, cs.year
       FROM invoices i JOIN clients cl ON cl.id=i.client_id LEFT JOIN cases cs ON cs.id=i.case_id WHERE i.id=?`
    ).bind(id).first();
    if (!inv) return null;
    const [items, pays] = await Promise.all([
      db.prepare(`SELECT * FROM invoice_items WHERE invoice_id=?`).bind(id).all(),
      db.prepare(`SELECT * FROM payments WHERE invoice_id=? ORDER BY paid_at`).bind(id).all()
    ]);
    return {
      ...inv,
      items: items.results || [],
      payments: pays.results || []
    };
  }
  /**
   * Generates sequential invoice number for a given year (e.g. INV-2026-001)
   */
  static async generateInvoiceNumber(db, year) {
    const last = await db.prepare(
      `SELECT invoice_no FROM invoices WHERE invoice_no LIKE ? ORDER BY id DESC LIMIT 1`
    ).bind(`INV-${year}-%`).first();
    let seq = 1;
    if (last?.invoice_no) {
      const parts = String(last.invoice_no).split("-");
      const parsed = parseInt(parts[parts.length - 1] || "0", 10);
      if (!isNaN(parsed) && parsed > 0) {
        seq = parsed + 1;
      }
    }
    return `INV-${year}-${String(seq).padStart(3, "0")}`;
  }
  /**
   * Issues a new legal fee invoice with sequential numbering and line items
   */
  static async createInvoice(db, data, currentUserId) {
    if (!data.client_id) {
      throw new Error("\u0627\u0644\u0645\u0648\u0643\u0644 \u0645\u0637\u0644\u0648\u0628 \u0644\u0625\u0635\u062F\u0627\u0631 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629");
    }
    const issueDate = data.issue_date || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const year = new Date(issueDate).getFullYear() || (/* @__PURE__ */ new Date()).getFullYear();
    const invoiceNo = await this.generateInvoiceNumber(db, year);
    const items = Array.isArray(data.items) && data.items.length ? data.items : [{ description: data.desc || "\u0623\u062A\u0639\u0627\u0628 \u0645\u0647\u0646\u064A\u0629", qty: 1, unit_price: Number(data.amount || 0), amount: Number(data.amount || 0) }];
    const subtotal = items.reduce((s, it) => s + Number(it.amount || (it.qty || 1) * (it.unit_price || 0)), 0);
    const tax = data.tax !== void 0 ? Number(data.tax) : Math.round(subtotal * 0.14 * 100) / 100;
    const discount = Number(data.discount || 0);
    const total = Math.max(0, subtotal + tax - discount);
    const invoiceStatus = data.status && isAllowed(data.status, [...ALLOWED_INVOICE_STATUSES]) ? data.status : "\u0635\u0627\u062F\u0631\u0629";
    const result = await db.prepare(
      `INSERT INTO invoices (invoice_no, client_id, case_id, issue_date, due_date, subtotal, tax, discount, total, paid, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
    ).bind(
      invoiceNo,
      Number(data.client_id),
      data.case_id ? Number(data.case_id) : null,
      issueDate,
      data.due_date || null,
      subtotal,
      tax,
      discount,
      total,
      invoiceStatus,
      cleanString(data.notes, MAX_NOTE_LENGTH),
      currentUserId
    ).run();
    const id = result.meta.last_row_id;
    if (items.length) {
      const itemStatements = items.map((it) => {
        const qty = Number(it.qty || 1);
        const amount = Number(it.amount || qty * Number(it.unit_price || 0));
        const unit_price = Number(it.unit_price !== void 0 ? it.unit_price : qty ? amount / qty : amount);
        return db.prepare(
          `INSERT INTO invoice_items (invoice_id, description, qty, unit_price, amount) VALUES (?, ?, ?, ?, ?)`
        ).bind(id, cleanString(it.description, MAX_TEXT_LENGTH) || "\u0628\u0646\u062F \u0623\u062A\u0639\u0627\u0628", qty, unit_price, amount);
      });
      await db.batch(itemStatements);
    }
    await logActivity(db, currentUserId, "invoice", id, "\u0625\u0635\u062F\u0627\u0631", `\u0641\u0627\u062A\u0648\u0631\u0629 ${invoiceNo}`);
    return { id, invoice_no: invoiceNo };
  }
  /**
   * Updates invoice status, notes, or due date
   */
  static async updateInvoice(db, id, data) {
    const existing = await db.prepare(`SELECT * FROM invoices WHERE id = ?`).bind(id).first();
    if (!existing) {
      throw new Error("\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
    }
    const status = data.status !== void 0 && isAllowed(data.status, [...ALLOWED_INVOICE_STATUSES]) ? data.status : existing.status;
    const notes = data.notes !== void 0 ? cleanString(data.notes, MAX_NOTE_LENGTH) : existing.notes;
    const due_date = data.due_date !== void 0 ? data.due_date : existing.due_date;
    await db.prepare(`UPDATE invoices SET status=?, notes=?, due_date=? WHERE id=?`).bind(status, notes, due_date, id).run();
    return true;
  }
  /**
   * Lists payments
   */
  static async getPayments(db) {
    const { results } = await db.prepare(
      `SELECT p.*, cl.name AS client_name, i.invoice_no
       FROM payments p JOIN clients cl ON cl.id=p.client_id LEFT JOIN invoices i ON i.id=p.invoice_id
       ORDER BY p.paid_at DESC LIMIT 100`
    ).all();
    return results || [];
  }
  /**
   * Records payment and reconciles invoice status
   */
  static async recordPayment(db, data, currentUserId) {
    const amount = Number(data.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error("\u0645\u0628\u0644\u063A \u0627\u0644\u062A\u062D\u0635\u064A\u0644 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0631\u0642\u0645\u0627\u064B \u0645\u0648\u062C\u0628\u0627\u064B");
    }
    let clientId = data.client_id ? Number(data.client_id) : null;
    let invoice = null;
    if (data.invoice_id) {
      invoice = await db.prepare(`SELECT * FROM invoices WHERE id=?`).bind(data.invoice_id).first();
      if (!invoice) {
        throw new Error("\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0645\u062D\u062F\u062F\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
      }
      if (!clientId) {
        clientId = invoice.client_id;
      }
    }
    if (!clientId) {
      throw new Error("\u0627\u0644\u0645\u0648\u0643\u0644 \u0645\u0637\u0644\u0648\u0628 \u0644\u0642\u064A\u062F \u0627\u0644\u062A\u062D\u0635\u064A\u0644");
    }
    const paidAt = data.paid_at || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const result = await db.prepare(
      `INSERT INTO payments (invoice_id, client_id, amount, method, paid_at, reference, notes, received_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      data.invoice_id ? Number(data.invoice_id) : null,
      clientId,
      amount,
      cleanString(data.method, 30) || "\u062A\u062D\u0648\u064A\u0644",
      paidAt,
      cleanString(data.reference, 100),
      cleanString(data.notes, MAX_NOTE_LENGTH),
      currentUserId
    ).run();
    if (invoice) {
      const paid = Math.round((Number(invoice.paid || 0) + amount) * 100) / 100;
      const status = paid >= Number(invoice.total) - 0.5 ? "\u0645\u0633\u062F\u062F\u0629" : "\u062C\u0632\u0626\u064A";
      await db.prepare(`UPDATE invoices SET paid=?, status=? WHERE id=?`).bind(paid, status, data.invoice_id).run();
    }
    await logActivity(db, currentUserId, "payment", result.meta.last_row_id, "\u062A\u062D\u0635\u064A\u0644", `\u062A\u062D\u0635\u064A\u0644 \u0645\u0628\u0644\u063A ${amount} \u062C.\u0645`);
    return result.meta.last_row_id;
  }
  /**
   * Lists expenses
   */
  static async getExpenses(db) {
    const { results } = await db.prepare(
      `SELECT e.*, cs.title AS case_title, cs.case_no, cs.year
       FROM expenses e LEFT JOIN cases cs ON cs.id=e.case_id ORDER BY e.expense_date DESC LIMIT 100`
    ).all();
    return results || [];
  }
  /**
   * Records a new expense
   */
  static async createExpense(db, data, currentUserId) {
    const amount = Number(data.amount);
    const title = cleanString(data.title, MAX_NAME_LENGTH);
    if (!title || isNaN(amount) || amount <= 0) {
      throw new Error("\u0628\u064A\u0627\u0646 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0648\u0642\u064A\u0645\u0629 \u0635\u0627\u0644\u062D\u0629 \u0645\u0637\u0644\u0648\u0628\u0627\u0646");
    }
    const expenseDate = data.expense_date || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const result = await db.prepare(
      `INSERT INTO expenses (case_id, title, category, amount, expense_date, billable, billed, vendor, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      data.case_id ? Number(data.case_id) : null,
      title,
      cleanString(data.category, 50) || "\u0623\u062E\u0631\u0649",
      amount,
      expenseDate,
      data.billable ? 1 : 0,
      0,
      cleanString(data.vendor, MAX_NAME_LENGTH),
      cleanString(data.notes, MAX_NOTE_LENGTH),
      currentUserId
    ).run();
    return result.meta.last_row_id;
  }
  /**
   * Lists time entries
   */
  static async getTimeEntries(db) {
    const { results } = await db.prepare(
      `SELECT t.*, u.name AS user_name, cs.title AS case_title, cs.case_no, cs.year
       FROM time_entries t JOIN users u ON u.id=t.user_id LEFT JOIN cases cs ON cs.id=t.case_id
       ORDER BY t.work_date DESC LIMIT 150`
    ).all();
    return results || [];
  }
  /**
   * Records billable time with RBAC authorization
   */
  static async logTime(db, data, currentUser) {
    const hours = Number(data.hours);
    if (isNaN(hours) || hours <= 0) {
      throw new Error("\u0639\u062F\u062F \u0627\u0644\u0633\u0627\u0639\u0627\u062A \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0631\u0642\u0645\u0627\u064B \u0645\u0648\u062C\u0628\u0627\u064B");
    }
    let targetUserId = currentUser.id;
    if (data.user_id && Number(data.user_id) !== currentUser.id) {
      const isPrivileged = ["managing_partner", "partner", "admin"].includes(currentUser.role);
      if (!isPrivileged) {
        throw new Error("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u2014 \u0644\u0627 \u064A\u0645\u0643\u0646\u0643 \u062A\u0633\u062C\u064A\u0644 \u0633\u0627\u0639\u0627\u062A \u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0622\u062E\u0631");
      }
      targetUserId = Number(data.user_id);
    }
    const rate = data.rate !== void 0 ? Number(data.rate) : currentUser.hourly_rate || 0;
    const workDate = data.work_date || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const result = await db.prepare(
      `INSERT INTO time_entries (user_id, case_id, work_date, hours, description, billable, billed, rate)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
    ).bind(
      targetUserId,
      data.case_id ? Number(data.case_id) : null,
      workDate,
      hours,
      cleanString(data.description, MAX_TEXT_LENGTH),
      data.billable === 0 ? 0 : 1,
      rate
    ).run();
    return result.meta.last_row_id;
  }
  /**
   * Lists contracts
   */
  static async getContracts(db) {
    const { results } = await db.prepare(
      `SELECT co.*, cl.name AS client_name FROM contracts co JOIN clients cl ON cl.id=co.client_id ORDER BY co.start_date DESC LIMIT 100`
    ).all();
    return results || [];
  }
  /**
   * Registers a new retainer agreement / contract
   */
  static async createContract(db, data) {
    const title = cleanString(data.title, MAX_NAME_LENGTH);
    if (!title || !data.client_id) {
      throw new Error("\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0639\u0642\u062F \u0648\u0627\u0644\u0645\u0648\u0643\u0644 \u0645\u0637\u0644\u0648\u0628\u0627\u0646");
    }
    const result = await db.prepare(
      `INSERT INTO contracts (title, client_id, type, start_date, end_date, value, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      title,
      Number(data.client_id),
      cleanString(data.type, 50) || "\u0623\u062A\u0639\u0627\u0628",
      data.start_date || null,
      data.end_date || null,
      Number(data.value || 0),
      data.status || "\u0633\u0627\u0631\u064A",
      cleanString(data.notes, MAX_NOTE_LENGTH)
    ).run();
    return result.meta.last_row_id;
  }
  /**
   * Computes financial report metrics
   */
  static async getFinanceReport(db) {
    const months = await db.prepare(`
      SELECT strftime('%Y-%m', issue_date) AS m,
        SUM(total) AS invoiced,
        SUM(paid) AS paid
      FROM invoices WHERE status != '\u0645\u0644\u063A\u0627\u0629' AND issue_date >= date('now','-11 months','start of month')
      GROUP BY m ORDER BY m
    `).all();
    const byClient = await db.prepare(`
      SELECT cl.name, SUM(i.total) AS invoiced, SUM(i.paid) AS paid, SUM(i.total-i.paid) AS due
      FROM invoices i JOIN clients cl ON cl.id=i.client_id WHERE i.status != '\u0645\u0644\u063A\u0627\u0629'
      GROUP BY cl.id ORDER BY due DESC LIMIT 8
    `).all();
    const unbilled = await db.prepare(`
      SELECT COALESCE(SUM(hours*rate),0) AS time_value,
        (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE billable=1 AND billed=0) AS exp_value
      FROM time_entries WHERE billable=1 AND billed=0
    `).first();
    return {
      months: months.results || [],
      by_client: byClient.results || [],
      unbilled
    };
  }
};

// src/routes/finance.ts
var financeRoutes = new Hono2();
financeRoutes.get("/invoices", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const invoices = await FinanceService.getInvoices(c.env.DB, c.req.query("status"));
  return c.json(invoices);
});
financeRoutes.get("/invoices/:id", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const invoice = await FinanceService.getInvoiceById(c.env.DB, c.req.param("id"));
  if (!invoice) return c.json({ error: "\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" }, 404);
  return c.json(invoice);
});
financeRoutes.post("/invoices", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({}));
  try {
    const result = await FinanceService.createInvoice(c.env.DB, body, user.id);
    return c.json(result);
  } catch (err) {
    return c.json({ error: err.message }, 400);
  }
});
financeRoutes.put("/invoices/:id", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({}));
  try {
    await FinanceService.updateInvoice(c.env.DB, c.req.param("id"), body);
    return c.json({ ok: true });
  } catch (err) {
    const status = err.message === "\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" ? 404 : 400;
    return c.json({ error: err.message }, status);
  }
});
financeRoutes.get("/payments", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const payments = await FinanceService.getPayments(c.env.DB);
  return c.json(payments);
});
financeRoutes.post("/payments", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({}));
  try {
    const id = await FinanceService.recordPayment(c.env.DB, body, user.id);
    return c.json({ id });
  } catch (err) {
    return c.json({ error: err.message }, 400);
  }
});
financeRoutes.get("/expenses", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const expenses = await FinanceService.getExpenses(c.env.DB);
  return c.json(expenses);
});
financeRoutes.post("/expenses", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({}));
  try {
    const id = await FinanceService.createExpense(c.env.DB, body, user.id);
    return c.json({ id });
  } catch (err) {
    return c.json({ error: err.message }, 400);
  }
});
financeRoutes.get("/time", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const timeEntries = await FinanceService.getTimeEntries(c.env.DB);
  return c.json(timeEntries);
});
financeRoutes.post("/time", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({}));
  try {
    const id = await FinanceService.logTime(c.env.DB, body, user);
    return c.json({ id });
  } catch (err) {
    const status = err.message.includes("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D") ? 403 : 400;
    return c.json({ error: err.message }, status);
  }
});
financeRoutes.get("/contracts", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const contracts = await FinanceService.getContracts(c.env.DB);
  return c.json(contracts);
});
financeRoutes.post("/contracts", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({}));
  try {
    const id = await FinanceService.createContract(c.env.DB, body);
    return c.json({ id });
  } catch (err) {
    return c.json({ error: err.message }, 400);
  }
});
financeRoutes.get("/reports/finance", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const report = await FinanceService.getFinanceReport(c.env.DB);
  return c.json(report);
});

// src/views/layout.ts
function renderAppLayout() {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0"/>
  <meta name="theme-color" content="#0B1F3A"/>
  <meta name="description" content="\u0646\u0638\u0627\u0645 \u0625\u062F\u0627\u0631\u0629 \u0645\u0643\u062A\u0628 \u0627\u0644\u0634\u0631\u064A\u0641 \u0648\u0634\u0631\u0643\u0627\u0647 \u0644\u0644\u0645\u062D\u0627\u0645\u0627\u0629 \u2014 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0642\u0636\u0627\u064A\u0627\u060C \u0627\u0644\u062C\u0644\u0633\u0627\u062A\u060C \u0627\u0644\u062A\u0648\u0643\u064A\u0644\u0627\u062A\u060C \u0648\u0627\u0644\u0623\u062A\u0639\u0627\u0628"/>
  <title>\u0627\u0644\u0634\u0631\u064A\u0641 \u0648\u0634\u0631\u0643\u0627\u0647 \u2014 \u0646\u0638\u0627\u0645 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0643\u062A\u0628</title>
  <link rel="icon" href="/static/img/logo.png"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Amiri:wght@400;700&family=Cormorant+Garamond:wght@600;700&display=swap" rel="stylesheet"/>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.2/css/all.min.css" rel="stylesheet"/>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js" defer></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            navy: { 950:'#070F1C', 900:'#0B1F3A', 800:'#12284A', 700:'#1A3A63', 600:'#1F4E79' },
            gold: { 500:'#C9A227', 400:'#E0C36A', 300:'#F0D78C', 700:'#8B6914' },
            ivory:'#F6F1E7', ink:'#1A140A', walnut:'#3B2A1A'
          },
          fontFamily: { cairo:['Cairo','sans-serif'], amiri:['Amiri','serif'], corm:['Cormorant Garamond','serif'] }
        }
      }
    }
  </script>
  <link href="/static/style.css" rel="stylesheet"/>
</head>
<body class="font-cairo bg-ivory text-ink antialiased selection:bg-gold-500 selection:text-navy-950">
  <div id="app"></div>
  <script type="module" src="/static/js/main.js"></script>
</body>
</html>`;
}

// src/db/config.ts
import path3 from "node:path";
import fs3 from "node:fs";
function getDatabaseConfig() {
  const remoteUrl = config.database.url;
  if (remoteUrl && !remoteUrl.startsWith("file:")) {
    return {
      url: remoteUrl,
      authToken: config.database.authToken,
      isRemote: true
    };
  }
  const localPath = config.database.localPath;
  const isMemory = localPath === ":memory:" || localPath === "file::memory:";
  let url = localPath;
  if (!url.startsWith("file:") && !isMemory) {
    url = `file:${localPath}`;
  }
  if (url.startsWith("file:") && !isMemory) {
    try {
      const cleanPath = url.replace(/^file:/, "");
      const resolved = path3.resolve(cleanPath);
      const dir = path3.dirname(resolved);
      if (!fs3.existsSync(dir)) {
        fs3.mkdirSync(dir, { recursive: true });
      }
    } catch {
    }
  }
  return {
    url,
    isRemote: false
  };
}

// src/db/schema.ts
var SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  title TEXT,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'lawyer',
  department TEXT,
  bar_number TEXT,
  bar_year INTEGER,
  hourly_rate REAL DEFAULT 0,
  bio TEXT,
  initials TEXT,
  color TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS courts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT,
  city TEXT,
  circuit TEXT,
  address TEXT
);

CREATE TABLE IF NOT EXISTS case_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  code TEXT
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL DEFAULT 'individual',
  name TEXT NOT NULL,
  national_id TEXT,
  tax_id TEXT,
  commercial_reg TEXT,
  nationality TEXT DEFAULT '\u0645\u0635\u0631\u064A',
  phone TEXT,
  phone2 TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  occupation TEXT,
  company_rep TEXT,
  notes TEXT,
  status TEXT DEFAULT 'active',
  assigned_lawyer_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (assigned_lawyer_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_no TEXT NOT NULL,
  case_number TEXT GENERATED ALWAYS AS (case_no) VIRTUAL,
  year INTEGER NOT NULL,
  title TEXT NOT NULL,
  case_type_id INTEGER,
  court_id INTEGER,
  circuit TEXT,
  degree TEXT DEFAULT '\u0627\u0628\u062A\u062F\u0627\u0626\u064A',
  status TEXT DEFAULT '\u0645\u062A\u062F\u0627\u0648\u0644\u0629',
  priority TEXT DEFAULT '\u0639\u0627\u062F\u064A\u0629',
  client_id INTEGER NOT NULL,
  opposing_name TEXT,
  opposing_lawyer TEXT,
  lead_lawyer_id INTEGER,
  subject TEXT,
  claim_value REAL DEFAULT 0,
  currency TEXT DEFAULT 'EGP',
  filing_date TEXT,
  next_action TEXT,
  outcome TEXT,
  closed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (case_type_id) REFERENCES case_types(id) ON DELETE SET NULL,
  FOREIGN KEY (court_id) REFERENCES courts(id) ON DELETE SET NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (lead_lawyer_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS case_lawyers (
  case_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT DEFAULT '\u0645\u0633\u0627\u0639\u062F',
  PRIMARY KEY (case_id, user_id),
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hearings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL,
  hearing_date TEXT NOT NULL,
  hearing_time TEXT,
  court_id INTEGER,
  circuit TEXT,
  type TEXT DEFAULT '\u0645\u0631\u0627\u0641\u0639\u0629',
  purpose TEXT,
  result TEXT,
  next_date TEXT,
  lawyer_id INTEGER,
  status TEXT DEFAULT '\u0642\u0627\u062F\u0645\u0629',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (court_id) REFERENCES courts(id) ON DELETE SET NULL,
  FOREIGN KEY (lawyer_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  case_id INTEGER,
  client_id INTEGER,
  assignee_id INTEGER,
  creator_id INTEGER,
  due_date TEXT,
  due_time TEXT,
  priority TEXT DEFAULT '\u0639\u0627\u062F\u064A\u0629',
  status TEXT DEFAULT '\u0645\u0641\u062A\u0648\u062D\u0629',
  category TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER,
  client_id INTEGER,
  title TEXT NOT NULL,
  doc_type TEXT,
  ref_no TEXT,
  date_issued TEXT,
  pages INTEGER,
  notes TEXT,
  uploaded_by INTEGER,
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  storage_key TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS powers_of_attorney (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poa_no TEXT NOT NULL,
  client_id INTEGER NOT NULL,
  case_id INTEGER,
  lawyer_id INTEGER,
  type TEXT NOT NULL,
  notary_office TEXT,
  issue_date TEXT,
  expiry_date TEXT,
  status TEXT DEFAULT '\u0633\u0627\u0631\u064A',
  scope TEXT,
  notes TEXT,
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  storage_key TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL,
  FOREIGN KEY (lawyer_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Transparent view and triggers for 'poas' table name compatibility
CREATE VIEW IF NOT EXISTS poas AS SELECT * FROM powers_of_attorney;

CREATE TRIGGER IF NOT EXISTS trg_poas_insert INSTEAD OF INSERT ON poas
BEGIN
  INSERT INTO powers_of_attorney (id, poa_no, client_id, case_id, lawyer_id, type, notary_office, issue_date, expiry_date, status, scope, notes, file_url, file_name, file_size, mime_type, storage_key, created_at)
  VALUES (new.id, new.poa_no, new.client_id, new.case_id, new.lawyer_id, new.type, new.notary_office, new.issue_date, new.expiry_date, new.status, new.scope, new.notes, new.file_url, new.file_name, new.file_size, new.mime_type, new.storage_key, coalesce(new.created_at, datetime('now')));
END;

CREATE TRIGGER IF NOT EXISTS trg_poas_update INSTEAD OF UPDATE ON poas
BEGIN
  UPDATE powers_of_attorney SET
    poa_no = new.poa_no,
    client_id = new.client_id,
    case_id = new.case_id,
    lawyer_id = new.lawyer_id,
    type = new.type,
    notary_office = new.notary_office,
    issue_date = new.issue_date,
    expiry_date = new.expiry_date,
    status = new.status,
    scope = new.scope,
    notes = new.notes,
    file_url = new.file_url,
    file_name = new.file_name,
    file_size = new.file_size,
    mime_type = new.mime_type,
    storage_key = new.storage_key
  WHERE id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_poas_delete INSTEAD OF DELETE ON poas
BEGIN
  DELETE FROM powers_of_attorney WHERE id = old.id;
END;

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT NOT NULL UNIQUE,
  client_id INTEGER NOT NULL,
  case_id INTEGER,
  issue_date TEXT NOT NULL,
  due_date TEXT,
  subtotal REAL DEFAULT 0,
  tax REAL DEFAULT 0,
  discount REAL DEFAULT 0,
  total REAL DEFAULT 0,
  paid REAL DEFAULT 0,
  status TEXT DEFAULT '\u0645\u0633\u0648\u062F\u0629',
  notes TEXT,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  qty REAL DEFAULT 1,
  unit_price REAL DEFAULT 0,
  amount REAL DEFAULT 0,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER,
  client_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  method TEXT DEFAULT '\u062A\u062D\u0648\u064A\u0644',
  paid_at TEXT NOT NULL,
  reference TEXT,
  notes TEXT,
  received_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER,
  title TEXT NOT NULL,
  category TEXT,
  amount REAL NOT NULL,
  expense_date TEXT NOT NULL,
  billable INTEGER DEFAULT 1,
  billed INTEGER DEFAULT 0,
  vendor TEXT,
  notes TEXT,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  case_id INTEGER,
  work_date TEXT NOT NULL,
  hours REAL NOT NULL,
  description TEXT,
  billable INTEGER DEFAULT 1,
  billed INTEGER DEFAULT 0,
  rate REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  client_id INTEGER NOT NULL,
  type TEXT,
  start_date TEXT,
  end_date TEXT,
  value REAL DEFAULT 0,
  status TEXT DEFAULT '\u0633\u0627\u0631\u064A',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER,
  client_id INTEGER,
  user_id INTEGER,
  content TEXT NOT NULL,
  pinned INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  entity_type TEXT,
  entity_id INTEGER,
  action TEXT,
  detail TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  title TEXT NOT NULL,
  remind_at TEXT NOT NULL,
  case_id INTEGER,
  is_done INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

-- ========================================================
-- Indexes & Performance Accelerators
-- ========================================================

-- Mandatory Required Indexes
CREATE INDEX IF NOT EXISTS idx_cases_case_number_client ON cases(case_number, client_id);
CREATE INDEX IF NOT EXISTS idx_cases_case_no_client ON cases(case_no, client_id);
CREATE INDEX IF NOT EXISTS idx_hearings_hearing_date_case ON hearings(hearing_date, case_id);
CREATE INDEX IF NOT EXISTS idx_documents_case_id ON documents(case_id);

-- Query Acceleration & Relational Indexes
CREATE INDEX IF NOT EXISTS idx_cases_client ON cases(client_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_lawyer ON cases(lead_lawyer_id);
CREATE INDEX IF NOT EXISTS idx_cases_lawyer_status ON cases(lead_lawyer_id, status);
CREATE INDEX IF NOT EXISTS idx_hearings_date ON hearings(hearing_date);
CREATE INDEX IF NOT EXISTS idx_hearings_case ON hearings(case_id);
CREATE INDEX IF NOT EXISTS idx_hearings_upcoming ON hearings(hearing_date, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status_due ON invoices(status, due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_poas_client ON powers_of_attorney(client_id);
CREATE INDEX IF NOT EXISTS idx_poas_expiry ON powers_of_attorney(expiry_date);
CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at);
CREATE INDEX IF NOT EXISTS idx_expenses_case ON expenses(case_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_billable ON expenses(billable, billed);
CREATE INDEX IF NOT EXISTS idx_time_user ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_billable ON time_entries(billable, billed);
`;

// src/utils/embedded-data.ts
var SEED_SQL = "-- \u0628\u064A\u0627\u0646\u0627\u062A \u062A\u062C\u0631\u064A\u0628\u064A\u0629 \u2014 \u0645\u0643\u062A\u0628 \u0627\u0644\u0634\u0631\u064A\u0641 \u0648\u0634\u0631\u0643\u0627\u0647 \u0644\u0644\u0645\u062D\u0627\u0645\u0627\u0629\n-- \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0644\u0643\u0644 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646: sharif2026\n-- \u0627\u0644\u0647\u0627\u0634\u0627\u062A \u0645\u0648\u0644\u0651\u062F\u0629 \u0628\u0627\u0633\u062A\u062E\u062F\u0627\u0645 PBKDF2-SHA256 (100,000 \u062A\u0643\u0631\u0627\u0631) \u0628\u0623\u0645\u0644\u0627\u062D \u0639\u0634\u0648\u0627\u0626\u064A\u0629 \u0644\u0643\u0644 \u0645\u0633\u062A\u062E\u062F\u0645\n\nINSERT OR IGNORE INTO users (id, name, title, email, phone, password_hash, role, department, bar_number, bar_year, hourly_rate, bio, initials, color, is_active) VALUES\n(1, '\u0627\u0644\u0645\u0633\u062A\u0634\u0627\u0631 \u0623\u062D\u0645\u062F \u0639\u0628\u062F\u0627\u0644\u0639\u0632\u064A\u0632 \u0627\u0644\u0634\u0631\u064A\u0641', '\u0627\u0644\u0634\u0631\u064A\u0643 \u0627\u0644\u0645\u062F\u064A\u0631', 'ahmed@alsharif.law', '01000001001', '100000$ebde639c3cf68e46c6c1c07b7b02ec1a$55527c1aeba063609c3391ab9c72bda9e42ab50cae08c03bbfbc22c791e64684', 'managing_partner', '\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0643\u062A\u0628', '12345', 1988, 4500, '\u0645\u062D\u0627\u0645\u064D \u0623\u0645\u0627\u0645 \u0645\u062D\u0643\u0645\u0629 \u0627\u0644\u0646\u0642\u0636 \u0648\u0627\u0644\u062F\u0633\u062A\u0648\u0631\u064A\u0629 \u0627\u0644\u0639\u0644\u064A\u0627. \u0623\u0643\u062B\u0631 \u0645\u0646 35 \u0639\u0627\u0645\u0627\u064B \u0641\u064A \u0627\u0644\u062A\u0642\u0627\u0636\u064A \u0627\u0644\u062A\u062C\u0627\u0631\u064A \u0648\u0627\u0644\u062C\u0646\u0627\u0626\u064A \u0627\u0644\u0646\u0648\u0639\u064A.', '\u0623\u0634', '#C9A227', 1),\n(2, '\u0623.\u062F. \u0645\u0646\u0649 \u0639\u0628\u062F\u0627\u0644\u0641\u062A\u0627\u062D \u062D\u0633\u0646\u064A', '\u0634\u0631\u064A\u0643\u0629 \u0623\u0648\u0644\u0649 \u2014 \u0645\u062F\u0646\u064A \u0648\u062A\u062C\u0627\u0631\u064A', 'mona@alsharif.law', '01000001002', '100000$8fa5ad09dd78af039b5feb1bc601e959$e5359673b5620781d14e7e0513e6ab665fc0ef9ef3fc72efcd60ed38b16d60b1', 'partner', '\u0627\u0644\u0645\u062F\u0646\u064A \u0648\u0627\u0644\u062A\u062C\u0627\u0631\u064A', '23456', 1996, 3800, '\u0623\u0633\u062A\u0627\u0630\u0629 \u0627\u0644\u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u0645\u062F\u0646\u064A \u0628\u062C\u0627\u0645\u0639\u0629 \u0627\u0644\u0642\u0627\u0647\u0631\u0629. \u0645\u062A\u062E\u0635\u0635\u0629 \u0641\u064A \u0645\u0646\u0627\u0632\u0639\u0627\u062A \u0627\u0644\u0634\u0631\u0643\u0627\u062A \u0648\u0627\u0644\u0639\u0642\u0648\u062F \u0627\u0644\u062F\u0648\u0644\u064A\u0629.', '\u0645\u062D', '#8B6914', 1),\n(3, '\u0627\u0644\u0623\u0633\u062A\u0627\u0630 \u0643\u0631\u064A\u0645 \u062D\u0633\u0646\u064A \u0645\u0646\u0635\u0648\u0631', '\u0634\u0631\u064A\u0643 \u2014 \u0627\u0644\u062C\u0646\u0627\u0626\u064A', 'karim@alsharif.law', '01000001003', '100000$0632224b8725cdc86cf256cf7558503e$92c988e088998d6d2fe6a9563b7f1f72b34179650bb9d08483d0bb922ef43e19', 'partner', '\u0627\u0644\u062C\u0646\u0627\u0626\u064A', '34567', 2004, 3200, '\u0645\u062D\u0627\u0645\u064D \u062C\u0646\u0627\u0626\u064A \u0646\u0648\u0639\u064A \u0623\u0645\u0627\u0645 \u0627\u0644\u062C\u0646\u0627\u064A\u0627\u062A \u0648\u0627\u0644\u0646\u0642\u0636. \u062E\u0628\u0631\u0629 \u0641\u064A \u0642\u0636\u0627\u064A\u0627 \u0627\u0644\u0623\u0645\u0648\u0627\u0644 \u0627\u0644\u0639\u0627\u0645\u0629 \u0648\u0627\u0644\u062C\u0631\u0627\u0626\u0645 \u0627\u0644\u0627\u0642\u062A\u0635\u0627\u062F\u064A\u0629.', '\u0643\u0645', '#1F4E79', 1),\n(4, '\u0627\u0644\u0623\u0633\u062A\u0627\u0630\u0629 \u0646\u0627\u062F\u064A\u0629 \u0641\u0624\u0627\u062F \u0633\u0627\u0644\u0645', '\u0645\u062D\u0627\u0645\u064A\u0629 \u0623\u0648\u0644\u0649 \u2014 \u0623\u062D\u0648\u0627\u0644 \u0634\u062E\u0635\u064A\u0629', 'nadia@alsharif.law', '01000001004', '100000$5bc5ae0151ec9782ce88e5a5b32cef0b$26fbfbd225566bbb08e70933fb98ac85a2249ee80980f4f3d6285d19709dc765', 'senior', '\u0627\u0644\u0623\u062D\u0648\u0627\u0644 \u0627\u0644\u0634\u062E\u0635\u064A\u0629', '45678', 2009, 2200, '\u0645\u062A\u062E\u0635\u0635\u0629 \u0641\u064A \u0645\u0633\u0627\u0626\u0644 \u0627\u0644\u0623\u0633\u0631\u0629 \u0648\u0627\u0644\u0648\u0644\u0627\u064A\u0629 \u0639\u0644\u0649 \u0627\u0644\u0645\u0627\u0644 \u0648\u0627\u0644\u0645\u0648\u0627\u0631\u064A\u062B \u0623\u0645\u0627\u0645 \u0645\u062D\u0627\u0643\u0645 \u0627\u0644\u0623\u0633\u0631\u0629.', '\u0646\u0641', '#6B3FA0', 1),\n(5, '\u0627\u0644\u0623\u0633\u062A\u0627\u0630 \u064A\u0648\u0633\u0641 \u0627\u0644\u0645\u0646\u0634\u0627\u0648\u064A', '\u0645\u062D\u0627\u0645\u064D \u2014 \u0625\u062F\u0627\u0631\u064A \u0648\u062F\u0633\u062A\u0648\u0631\u064A', 'youssef@alsharif.law', '01000001005', '100000$0375178bdab038878169668204f0b1b6$dff63891f3733f7ff040f1e2ebaabebe478781c434821f5fb4c51e8a2692954e', 'lawyer', '\u0627\u0644\u0625\u062F\u0627\u0631\u064A', '56789', 2015, 1800, '\u0645\u0646\u0627\u0632\u0639\u0627\u062A \u0645\u062C\u0644\u0633 \u0627\u0644\u062F\u0648\u0644\u0629 \u0648\u0627\u0644\u0639\u0642\u0648\u062F \u0627\u0644\u0625\u062F\u0627\u0631\u064A\u0629 \u0648\u0627\u0644\u062A\u0639\u0648\u064A\u0636\u0627\u062A \u0639\u0646 \u0627\u0644\u0642\u0631\u0627\u0631\u0627\u062A \u0627\u0644\u0625\u062F\u0627\u0631\u064A\u0629.', '\u064A\u0645', '#2E5A3C', 1),\n(6, '\u0627\u0644\u0623\u0633\u062A\u0627\u0630\u0629 \u0633\u0644\u0645\u0649 \u0631\u0636\u0648\u0627\u0646 \u0639\u0644\u064A', '\u0645\u062D\u0627\u0645\u064A\u0629 \u2014 \u0639\u0645\u0644 \u0648\u062A\u0623\u0645\u064A\u0646\u0627\u062A', 'salma@alsharif.law', '01000001006', '100000$cdacd3184ae52d214e10b4137f874438$fb5d9da4e97814b2d474c7e69ce4cdd17dfc8d5b84b28a5c7164dbfcfc51c8f6', 'lawyer', '\u0627\u0644\u0639\u0645\u0644', '67890', 2018, 1500, '\u0642\u0636\u0627\u064A\u0627 \u0627\u0644\u0639\u0645\u0644 \u0627\u0644\u062C\u0645\u0627\u0639\u064A \u0648\u0627\u0644\u0641\u0635\u0644 \u0627\u0644\u062A\u0639\u0633\u0641\u064A \u0648\u0627\u0644\u062A\u0623\u0645\u064A\u0646\u0627\u062A \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639\u064A\u0629.', '\u0633\u0631', '#8B3A3A', 1),\n(7, '\u0627\u0644\u0623\u0633\u062A\u0627\u0630 \u0647\u0634\u0627\u0645 \u0646\u0628\u064A\u0644 \u0639\u0637\u064A\u0629', '\u0645\u062D\u0627\u0645\u064D \u062A\u062D\u062A \u0627\u0644\u062A\u0645\u0631\u064A\u0646', 'hesham@alsharif.law', '01000001007', '100000$9adfafb127a4cc31bdd9dfbe116210eb$879c5b389c052cf940da98eb2b3bc513bd2f688ce7507f0751720b7f917c5a60', 'intern', '\u0627\u0644\u062A\u062F\u0631\u064A\u0628', NULL, 2025, 400, '\u062F\u0641\u0639\u0629 2024 \u0643\u0644\u064A\u0629 \u0627\u0644\u062D\u0642\u0648\u0642 \u2014 \u062C\u0627\u0645\u0639\u0629 \u0639\u064A\u0646 \u0634\u0645\u0633.', '\u0647\u0646', '#4A5568', 1),\n(8, '\u0627\u0644\u0623\u0633\u062A\u0627\u0630\u0629 \u0641\u0627\u0637\u0645\u0629 \u062C\u0644\u0627\u0644 \u0645\u062D\u0645\u0648\u062F', '\u0645\u062F\u064A\u0631\u0629 \u0627\u0644\u0645\u0643\u062A\u0628', 'fatma@alsharif.law', '01000001008', '100000$2380d9667bcb3de3304443f36069d905$edb04be0da999d471f06d0c03450ccaac5fa2a39a6015bd68bce9d0bf57df2ae', 'secretary', '\u0627\u0644\u0633\u0643\u0631\u062A\u0627\u0631\u064A\u0629', NULL, NULL, 0, '\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0648\u0627\u0639\u064A\u062F \u0648\u0627\u0644\u0623\u0631\u0634\u064A\u0641 \u0648\u0627\u0644\u062A\u0648\u0643\u064A\u0644\u0627\u062A \u0648\u0627\u0644\u0625\u0639\u0644\u0627\u0646\u0627\u062A.', '\u0641\u062C', '#B8860B', 1),\n(9, '\u0627\u0644\u0623\u0633\u062A\u0627\u0630 \u0639\u0645\u0631\u0648 \u0634\u0627\u0647\u064A\u0646', '\u0627\u0644\u0645\u062D\u0627\u0633\u0628 \u0627\u0644\u0645\u0627\u0644\u064A', 'amr@alsharif.law', '01000001009', '100000$028206bbb9773d39218432f7a69a855d$cd228e2da485cff32b63fb361f034e6485e35d1695aab5996f8266b3f7604664', 'accountant', '\u0627\u0644\u0645\u0627\u0644\u064A\u0629', NULL, NULL, 0, '\u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u0648\u0627\u0644\u062A\u062D\u0635\u064A\u0644 \u0648\u0627\u0644\u0636\u0631\u0627\u0626\u0628 \u0648\u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062A \u0627\u0644\u0642\u0636\u0627\u0626\u064A\u0629.', '\u0639\u0634', '#2C5282', 1);\n\nINSERT OR IGNORE INTO courts (id, name, type, city, circuit, address) VALUES\n(1, '\u0645\u062D\u0643\u0645\u0629 \u062C\u0646\u0648\u0628 \u0627\u0644\u0642\u0627\u0647\u0631\u0629 \u0627\u0644\u0627\u0628\u062A\u062F\u0627\u0626\u064A\u0629', '\u0627\u0628\u062A\u062F\u0627\u0626\u064A', '\u0627\u0644\u0642\u0627\u0647\u0631\u0629', '\u0645\u062F\u0646\u064A', '\u062F\u0627\u0631 \u0627\u0644\u0642\u0636\u0627\u0621 \u0627\u0644\u0639\u0627\u0644\u064A \u2014 \u0648\u0633\u0637 \u0627\u0644\u0628\u0644\u062F'),\n(2, '\u0645\u062D\u0643\u0645\u0629 \u0634\u0645\u0627\u0644 \u0627\u0644\u0642\u0627\u0647\u0631\u0629 \u0627\u0644\u0627\u0628\u062A\u062F\u0627\u0626\u064A\u0629', '\u0627\u0628\u062A\u062F\u0627\u0626\u064A', '\u0627\u0644\u0642\u0627\u0647\u0631\u0629', '\u0645\u062F\u0646\u064A', '\u0634\u0628\u0631\u0627'),\n(3, '\u0645\u062D\u0643\u0645\u0629 \u062C\u0646\u0627\u064A\u0627\u062A \u0627\u0644\u0642\u0627\u0647\u0631\u0629', '\u062C\u0646\u0627\u064A\u0627\u062A', '\u0627\u0644\u0642\u0627\u0647\u0631\u0629', '\u0627\u0644\u062C\u0646\u0627\u064A\u0627\u062A', '\u0645\u062F\u064A\u0646\u0629 \u0646\u0635\u0631 \u2014 \u0645\u062C\u0645\u0639 \u0627\u0644\u0645\u062D\u0627\u0643\u0645'),\n(4, '\u0645\u062D\u0643\u0645\u0629 \u062C\u0646\u062D \u0642\u0635\u0631 \u0627\u0644\u0646\u064A\u0644', '\u062C\u0646\u062D', '\u0627\u0644\u0642\u0627\u0647\u0631\u0629', '\u062C\u0646\u062D', '\u0642\u0635\u0631 \u0627\u0644\u0646\u064A\u0644'),\n(5, '\u0645\u062D\u0643\u0645\u0629 \u0627\u0644\u0623\u0633\u0631\u0629 \u2014 \u0645\u0635\u0631 \u0627\u0644\u062C\u062F\u064A\u062F\u0629', '\u0623\u0633\u0631\u0629', '\u0627\u0644\u0642\u0627\u0647\u0631\u0629', '\u0623\u0633\u0631\u0629', '\u0645\u0635\u0631 \u0627\u0644\u062C\u062F\u064A\u062F\u0629'),\n(6, '\u0645\u062D\u0643\u0645\u0629 \u0627\u0633\u062A\u0626\u0646\u0627\u0641 \u0627\u0644\u0642\u0627\u0647\u0631\u0629', '\u0627\u0633\u062A\u0626\u0646\u0627\u0641', '\u0627\u0644\u0642\u0627\u0647\u0631\u0629', '\u0627\u0633\u062A\u0626\u0646\u0627\u0641', '\u062F\u0627\u0631 \u0627\u0644\u0642\u0636\u0627\u0621 \u0627\u0644\u0639\u0627\u0644\u064A'),\n(7, '\u0645\u062D\u0643\u0645\u0629 \u0627\u0644\u0646\u0642\u0636', '\u0646\u0642\u0636', '\u0627\u0644\u0642\u0627\u0647\u0631\u0629', '\u0646\u0642\u0636', '\u062F\u0627\u0631 \u0627\u0644\u0642\u0636\u0627\u0621 \u0627\u0644\u0639\u0627\u0644\u064A'),\n(8, '\u0645\u062D\u0643\u0645\u0629 \u0627\u0644\u0642\u0636\u0627\u0621 \u0627\u0644\u0625\u062F\u0627\u0631\u064A', '\u0625\u062F\u0627\u0631\u064A', '\u0627\u0644\u0642\u0627\u0647\u0631\u0629', '\u0645\u062C\u0644\u0633 \u0627\u0644\u062F\u0648\u0644\u0629', '\u0642\u0635\u0631 \u0627\u0644\u0639\u064A\u0646\u064A'),\n(9, '\u0627\u0644\u0645\u062D\u0643\u0645\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u064A\u0629 \u0627\u0644\u0639\u0644\u064A\u0627', '\u0625\u062F\u0627\u0631\u064A \u0639\u0644\u064A\u0627', '\u0627\u0644\u0642\u0627\u0647\u0631\u0629', '\u0645\u062C\u0644\u0633 \u0627\u0644\u062F\u0648\u0644\u0629', '\u0642\u0635\u0631 \u0627\u0644\u0639\u064A\u0646\u064A'),\n(10, '\u0645\u062D\u0643\u0645\u0629 \u0639\u0645\u0627\u0644 \u062C\u0646\u0648\u0628 \u0627\u0644\u0642\u0627\u0647\u0631\u0629', '\u0639\u0645\u0627\u0644', '\u0627\u0644\u0642\u0627\u0647\u0631\u0629', '\u0639\u0645\u0627\u0644', '\u0627\u0644\u0633\u064A\u062F\u0629 \u0632\u064A\u0646\u0628'),\n(11, '\u0645\u062D\u0643\u0645\u0629 \u0627\u0642\u062A\u0635\u0627\u062F\u064A \u0627\u0644\u0642\u0627\u0647\u0631\u0629', '\u0627\u0642\u062A\u0635\u0627\u062F\u064A', '\u0627\u0644\u0642\u0627\u0647\u0631\u0629', '\u0627\u0642\u062A\u0635\u0627\u062F\u064A', '\u0627\u0644\u062A\u062C\u0645\u0639 \u0627\u0644\u062E\u0627\u0645\u0633'),\n(12, '\u0645\u062D\u0643\u0645\u0629 \u062A\u0646\u0641\u064A\u0630 \u062C\u0646\u0648\u0628 \u0627\u0644\u0642\u0627\u0647\u0631\u0629', '\u062A\u0646\u0641\u064A\u0630', '\u0627\u0644\u0642\u0627\u0647\u0631\u0629', '\u062A\u0646\u0641\u064A\u0630', '\u0627\u0644\u0633\u064A\u062F\u0629 \u0632\u064A\u0646\u0628');\n\nINSERT OR IGNORE INTO case_types (id, name, category, code) VALUES\n(1, '\u0645\u062F\u0646\u064A \u0643\u0644\u064A', '\u0645\u062F\u0646\u064A', 'CIV'),\n(2, '\u0645\u062F\u0646\u064A \u062C\u0632\u0626\u064A', '\u0645\u062F\u0646\u064A', 'CIVP'),\n(3, '\u062A\u062C\u0627\u0631\u064A \u0643\u0644\u064A', '\u062A\u062C\u0627\u0631\u064A', 'COM'),\n(4, '\u0634\u0631\u0643\u0627\u062A', '\u062A\u062C\u0627\u0631\u064A', 'CO'),\n(5, '\u062C\u0646\u062D', '\u062C\u0646\u0627\u0626\u064A', 'MIS'),\n(6, '\u062C\u0646\u0627\u064A\u0627\u062A', '\u062C\u0646\u0627\u0626\u064A', 'FEL'),\n(7, '\u0646\u0642\u0636 \u062C\u0646\u0627\u0626\u064A', '\u062C\u0646\u0627\u0626\u064A', 'CASS'),\n(8, '\u0623\u062D\u0648\u0627\u0644 \u0634\u062E\u0635\u064A\u0629 \u0644\u0644\u0645\u0633\u0644\u0645\u064A\u0646', '\u0623\u0633\u0631\u0629', 'FAM'),\n(9, '\u0648\u0644\u0627\u064A\u0629 \u0639\u0644\u0649 \u0627\u0644\u0645\u0627\u0644', '\u0623\u0633\u0631\u0629', 'GRD'),\n(10, '\u0625\u0644\u063A\u0627\u0621 \u0642\u0631\u0627\u0631 \u0625\u062F\u0627\u0631\u064A', '\u0625\u062F\u0627\u0631\u064A', 'ADM'),\n(11, '\u062A\u0639\u0648\u064A\u0636 \u0625\u062F\u0627\u0631\u064A', '\u0625\u062F\u0627\u0631\u064A', 'ADT'),\n(12, '\u0641\u0635\u0644 \u062A\u0639\u0633\u0641\u064A', '\u0639\u0645\u0644', 'LAB'),\n(13, '\u0623\u0645\u0648\u0627\u0644 \u0639\u0627\u0645\u0629', '\u062C\u0646\u0627\u0626\u064A', 'PUB'),\n(14, '\u0634\u064A\u0643 \u0628\u062F\u0648\u0646 \u0631\u0635\u064A\u062F', '\u062C\u0646\u0627\u0626\u064A', 'CHK'),\n(15, '\u062A\u0646\u0641\u064A\u0630 \u0645\u0648\u0636\u0648\u0639\u064A', '\u062A\u0646\u0641\u064A\u0630', 'EXE'),\n(16, '\u062A\u062D\u0643\u064A\u0645 \u062A\u062C\u0627\u0631\u064A', '\u062A\u062D\u0643\u064A\u0645', 'ARB');\n\nINSERT OR IGNORE INTO clients (id, type, name, national_id, tax_id, commercial_reg, nationality, phone, phone2, email, address, city, occupation, company_rep, notes, status, assigned_lawyer_id) VALUES\n(1, 'company', '\u0645\u062C\u0645\u0648\u0639\u0629 \u0627\u0644\u0646\u064A\u0644 \u0627\u0644\u0642\u0627\u0628\u0636\u0629 \u0634.\u0645.\u0645', NULL, '204-123-456', '12345 \u0642\u0627\u0647\u0631\u0629', '\u0645\u0635\u0631\u064A', '0225791000', '01011112222', 'legal@nileholding.com', '\u0623\u0628\u0631\u0627\u062C \u0646\u0627\u064A\u0644 \u0633\u064A\u062A\u064A \u2014 \u0643\u0648\u0631\u0646\u064A\u0634 \u0627\u0644\u0646\u064A\u0644', '\u0627\u0644\u0642\u0627\u0647\u0631\u0629', '\u0642\u0627\u0628\u0636\u0629 \u0627\u0633\u062A\u062B\u0645\u0627\u0631\u064A\u0629', '\u0627\u0644\u0645\u0647\u0646\u062F\u0633 \u062D\u0633\u0627\u0645 \u0641\u0631\u064A\u062F \u2014 \u0627\u0644\u0639\u0636\u0648 \u0627\u0644\u0645\u0646\u062A\u062F\u0628', '\u0639\u0645\u064A\u0644 \u0627\u0633\u062A\u0631\u0627\u062A\u064A\u062C\u064A \u0645\u0646\u0630 2014. \u0627\u062A\u0641\u0627\u0642\u064A\u0627\u062A \u0623\u062A\u0639\u0627\u0628 \u0633\u0646\u0648\u064A\u0629.', 'vip', 1),\n(2, 'company', '\u0634\u0631\u0643\u0629 \u0627\u0644\u0634\u0631\u0642 \u0644\u0644\u0625\u0646\u0634\u0627\u0621\u0627\u062A', NULL, '211-888-321', '77821 \u062C\u064A\u0632\u0629', '\u0645\u0635\u0631\u064A', '0233451000', '01022223333', 'contracts@sharq-con.com', '\u0627\u0644\u0645\u0647\u0646\u062F\u0633\u064A\u0646 \u2014 \u0627\u0644\u062C\u064A\u0632\u0629', '\u0627\u0644\u062C\u064A\u0632\u0629', '\u0645\u0642\u0627\u0648\u0644\u0627\u062A \u0639\u0627\u0645\u0629', '\u0627\u0644\u0645\u0647\u0646\u062F\u0633 \u0637\u0627\u0631\u0642 \u0628\u0647\u062C\u062A', '\u0646\u0632\u0627\u0639\u0627\u062A \u0645\u0642\u0627\u0648\u0644\u0627\u062A \u0648\u062A\u062D\u0643\u064A\u0645 FIDIC.', 'vip', 2),\n(3, 'company', '\u0628\u0646\u0643 \u0627\u0644\u062F\u0644\u062A\u0627 \u0627\u0644\u062A\u062C\u0627\u0631\u064A', NULL, '100-001-900', '90 \u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u0645\u0631\u0643\u0632\u064A', '\u0645\u0635\u0631\u064A', '0223990000', NULL, 'litigation@delta-bank.com', '\u0634\u0627\u0631\u0639 \u0642\u0635\u0631 \u0627\u0644\u0646\u064A\u0644', '\u0627\u0644\u0642\u0627\u0647\u0631\u0629', '\u0628\u0646\u0643', '\u0627\u0644\u0645\u0633\u062A\u0634\u0627\u0631 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A \u0627\u0644\u062F\u0627\u062E\u0644\u064A: \u0623. \u0644\u064A\u0644\u0649 \u062D\u0645\u062F\u064A', '\u062A\u062D\u0635\u064A\u0644 \u0645\u062D\u0627\u0641\u0638 \u0648\u0628\u0637\u0627\u0642\u0627\u062A \u0627\u0626\u062A\u0645\u0627\u0646 \u0648\u0642\u0636\u0627\u064A\u0627 \u0634\u064A\u0643\u0627\u062A.', 'active', 3),\n(4, 'individual', '\u0627\u0644\u0644\u0648\u0627\u0621 \u0645\u062D\u0645\u062F \u0635\u0644\u0627\u062D \u0627\u0644\u062F\u064A\u0646 \u0641\u0647\u0645\u064A', '26501011234567', NULL, NULL, '\u0645\u0635\u0631\u064A', '01033334444', '01223334444', 'msf.family@mail.com', '\u0627\u0644\u0632\u0645\u0627\u0644\u0643 \u2014 \u0634\u0627\u0631\u0639 \u0645\u062D\u0645\u062F \u0645\u0638\u0647\u0631', '\u0627\u0644\u0642\u0627\u0647\u0631\u0629', '\u0636\u0627\u0628\u0637 \u0645\u062A\u0642\u0627\u0639\u062F', NULL, '\u0642\u0636\u0627\u064A\u0627 \u0623\u0633\u0631\u0629 \u0648\u0645\u064A\u0631\u0627\u062B \u0639\u0642\u0627\u0631\u064A \u0641\u064A \u0627\u0644\u0645\u0647\u0646\u062F\u0633\u064A\u0646.', 'vip', 4),\n(5, 'individual', '\u0627\u0644\u0633\u064A\u062F\u0629 \u0647\u0627\u0644\u0629 \u0645\u062D\u0645\u0648\u062F \u0627\u0644\u0634\u0631\u064A\u0641', '28403151234567', NULL, NULL, '\u0645\u0635\u0631\u064A', '01055556666', NULL, 'hala.sherif@mail.com', '\u0627\u0644\u0645\u0639\u0627\u062F\u064A \u2014 \u062F\u062C\u0644\u0629', '\u0627\u0644\u0642\u0627\u0647\u0631\u0629', '\u0637\u0628\u064A\u0628\u0629', NULL, '\u0637\u0644\u0627\u0642 \u0644\u0644\u0636\u0631\u0631 \u0648\u0646\u0641\u0642\u0629 \u0648\u062D\u0636\u0627\u0646\u0629.', 'active', 4),\n(6, 'company', '\u0645\u0635\u0627\u0646\u0639 \u0627\u0644\u062F\u0644\u062A\u0627 \u0644\u0644\u063A\u0632\u0644', NULL, '188-440-210', '44120 \u0645\u062D\u0644\u0629', '\u0645\u0635\u0631\u064A', '0402221100', '01077778888', 'hr@delta-spin.com', '\u0627\u0644\u0645\u062D\u0644\u0629 \u0627\u0644\u0643\u0628\u0631\u0649', '\u0627\u0644\u063A\u0631\u0628\u064A\u0629', '\u0635\u0646\u0627\u0639\u0629 \u0646\u0633\u064A\u062C', '\u0623. \u0645\u062C\u062F\u064A \u0639\u0631\u0641\u0629 \u2014 \u0645\u062F\u064A\u0631 \u0627\u0644\u0645\u0648\u0627\u0631\u062F', '\u062F\u0639\u0627\u0648\u0649 \u0639\u0645\u0627\u0644\u064A\u0629 \u062C\u0645\u0627\u0639\u064A\u0629 \u0628\u0639\u062F \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0647\u064A\u0643\u0644\u0629.', 'active', 6),\n(7, 'individual', '\u0627\u0644\u0645\u0647\u0646\u062F\u0633 \u0648\u0627\u0626\u0644 \u0639\u0628\u062F\u0627\u0644\u0631\u062D\u0645\u0646', '27809181234567', NULL, NULL, '\u0645\u0635\u0631\u064A', '01088889999', NULL, 'wael.abdelrahman@mail.com', '\u0627\u0644\u062A\u062C\u0645\u0639 \u0627\u0644\u062E\u0627\u0645\u0633', '\u0627\u0644\u0642\u0627\u0647\u0631\u0629', '\u0645\u0637\u0648\u0631 \u0639\u0642\u0627\u0631\u064A', NULL, '\u0646\u0632\u0627\u0639 \u062A\u0639\u0627\u0642\u062F \u0645\u0639 \u0645\u0642\u0627\u0648\u0644 \u0628\u0627\u0637\u0646 + \u0634\u064A\u0643\u0627\u062A.', 'active', 2),\n(8, 'company', '\u0627\u0644\u0647\u064A\u0626\u0629 \u0627\u0644\u0639\u0627\u0645\u0629 \u0644\u0644\u062A\u0646\u0645\u064A\u0629 \u0627\u0644\u0635\u0646\u0627\u0639\u064A\u0629', NULL, '\u062D\u0643\u0648\u0645\u064A', NULL, '\u0645\u0635\u0631\u064A', '0227940000', NULL, 'legal@ida.gov.eg', '\u0627\u0644\u062A\u062C\u0645\u0639 \u0627\u0644\u0623\u0648\u0644', '\u0627\u0644\u0642\u0627\u0647\u0631\u0629', '\u0647\u064A\u0626\u0629 \u0639\u0627\u0645\u0629', '\u0627\u0644\u0645\u0633\u062A\u0634\u0627\u0631 \u0623\u062D\u0645\u062F \u0631\u0627\u0636\u064A', '\u0637\u0639\u0648\u0646 \u0625\u0644\u063A\u0627\u0621 \u0642\u0631\u0627\u0631\u0627\u062A \u062A\u062E\u0635\u064A\u0635 \u0623\u0631\u0627\u0636\u064D.', 'active', 5),\n(9, 'individual', '\u0627\u0644\u0623\u0633\u062A\u0627\u0630\u0629 \u062F\u064A\u0646\u0627 \u0643\u0645\u0627\u0644 \u064A\u0648\u0633\u0641', '29007021234567', NULL, NULL, '\u0645\u0635\u0631\u064A', '01112223344', NULL, 'dina.ky@mail.com', '\u0645\u0635\u0631 \u0627\u0644\u062C\u062F\u064A\u062F\u0629 \u2014 \u0634\u0627\u0631\u0639 \u0627\u0644\u062B\u0648\u0631\u0629', '\u0627\u0644\u0642\u0627\u0647\u0631\u0629', '\u0645\u062D\u0627\u0633\u0628\u0629', NULL, '\u0627\u0633\u062A\u0631\u062F\u0627\u062F \u062D\u064A\u0627\u0632\u0629 \u0634\u0642\u0629 + \u0637\u0631\u062F \u063A\u0627\u0635\u0628.', 'active', 2),\n(10, 'company', '\u0645\u062C\u0645\u0648\u0639\u0629 \u0633\u0641\u0646\u0643\u0633 \u0644\u0644\u0633\u064A\u0627\u062D\u0629', NULL, '199-330-010', '33010 \u0642\u0627\u0647\u0631\u0629', '\u0645\u0635\u0631\u064A', '0227350000', '01099990000', 'ceo@sphinx-tr.com', '\u0627\u0644\u0645\u0647\u0646\u062F\u0633\u064A\u0646 \u2014 \u0634\u0627\u0631\u0639 \u062C\u0627\u0645\u0639\u0629 \u0627\u0644\u062F\u0648\u0644', '\u0627\u0644\u062C\u064A\u0632\u0629', '\u0633\u064A\u0627\u062D\u0629 \u0648\u0637\u064A\u0631\u0627\u0646', '\u0627\u0644\u0633\u064A\u062F \u0639\u0645\u0631 \u0644\u0637\u0641\u064A', '\u062A\u062D\u0643\u064A\u0645 \u063A\u0631\u0641\u0629 \u0627\u0644\u0642\u0627\u0647\u0631\u0629 + \u0639\u0642\u062F \u0625\u062F\u0627\u0631\u0629 \u0641\u0646\u062F\u0642.', 'vip', 1),\n(11, 'individual', '\u0627\u0644\u0633\u064A\u062F \u062D\u0633\u064A\u0646 \u0639\u0628\u062F\u0627\u0644\u0639\u0627\u0644', '25512101234567', NULL, NULL, '\u0645\u0635\u0631\u064A', '01012131415', NULL, NULL, '\u0634\u0628\u0631\u0627 \u0627\u0644\u062E\u064A\u0645\u0629', '\u0627\u0644\u0642\u0644\u064A\u0648\u0628\u064A\u0629', '\u062A\u0627\u062C\u0631', NULL, '\u062C\u0646\u062D\u0629 \u0634\u064A\u0643 + \u0625\u0641\u0644\u0627\u0633 \u0641\u0631\u062F\u064A.', 'active', 3);\n\nINSERT OR IGNORE INTO cases (id, case_no, year, title, case_type_id, court_id, circuit, degree, status, priority, client_id, opposing_name, opposing_lawyer, lead_lawyer_id, subject, claim_value, currency, filing_date, next_action, outcome, closed_at, created_at, updated_at) VALUES\n(1, '1842', 2025, '\u0645\u062C\u0645\u0648\u0639\u0629 \u0627\u0644\u0646\u064A\u0644 / \u0634\u0631\u0643\u0629 \u0623\u0637\u0644\u0633 \u0644\u0644\u062A\u062C\u0627\u0631\u0629 \u2014 \u0641\u0633\u062E \u0639\u0642\u062F \u062A\u0648\u0631\u064A\u062F', 3, 11, '\u0627\u0644\u062F\u0627\u0626\u0631\u0629 4 \u0627\u0642\u062A\u0635\u0627\u062F\u064A', '\u0627\u0628\u062A\u062F\u0627\u0626\u064A', '\u0645\u062A\u062F\u0627\u0648\u0644\u0629', '\u0639\u0627\u0644\u064A\u0629', 1, '\u0634\u0631\u0643\u0629 \u0623\u0637\u0644\u0633 \u0644\u0644\u062A\u062C\u0627\u0631\u0629 \u0627\u0644\u062F\u0648\u0644\u064A\u0629', '\u0623. \u0645\u062D\u0645\u0648\u062F \u0635\u0628\u0631\u064A', 2, '\u0641\u0633\u062E \u0639\u0642\u062F \u062A\u0648\u0631\u064A\u062F \u0645\u0639\u062F\u0627\u062A \u0637\u0627\u0642\u0629 \u0628\u0642\u064A\u0645\u0629 48 \u0645\u0644\u064A\u0648\u0646 \u062C\u0646\u064A\u0647 \u0648\u0627\u0644\u062A\u0639\u0648\u064A\u0636 \u0639\u0646 \u0627\u0644\u062A\u0623\u062E\u064A\u0631.', 48000000, 'EGP', '2025-03-12', '\u0625\u064A\u062F\u0627\u0639 \u0645\u0630\u0643\u0631\u0629 \u062A\u0639\u0642\u064A\u0628 \u0642\u0628\u0644 \u062C\u0644\u0633\u0629 21 \u0633\u0628\u062A\u0645\u0628\u0631', NULL, NULL, '2025-03-12 10:00:00', '2026-09-16 18:00:00'),\n(2, '771', 2024, '\u0627\u0644\u0634\u0631\u0642 \u0644\u0644\u0625\u0646\u0634\u0627\u0621\u0627\u062A / \u0647\u064A\u0626\u0629 \u0627\u0644\u0645\u062C\u062A\u0645\u0639\u0627\u062A \u2014 \u0645\u0633\u062A\u062D\u0642\u0627\u062A FIDIC', 16, NULL, '\u062A\u062D\u0643\u064A\u0645 \u063A\u0631\u0641\u0629 \u0627\u0644\u0642\u0627\u0647\u0631\u0629', '\u062A\u062D\u0643\u064A\u0645', '\u0645\u062A\u062F\u0627\u0648\u0644\u0629', '\u0639\u0627\u062C\u0644\u0629', 2, '\u0647\u064A\u0626\u0629 \u0627\u0644\u0645\u062C\u062A\u0645\u0639\u0627\u062A \u0627\u0644\u0639\u0645\u0631\u0627\u0646\u064A\u0629', '\u0647\u064A\u0626\u0629 \u0642\u0636\u0627\u064A\u0627 \u0627\u0644\u062F\u0648\u0644\u0629', 1, '\u062A\u062D\u0643\u064A\u0645 \u062A\u062C\u0627\u0631\u064A \u0639\u0646 \u0645\u0633\u062A\u062D\u0642\u0627\u062A \u0645\u0634\u0631\u0648\u0639 \u0627\u0644\u0639\u0627\u0635\u0645\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u064A\u0629 \u2014 \u0639\u0642\u062F \u0641\u064A\u062F\u064A\u0643 \u0623\u062D\u0645\u0631.', 126500000, 'EGP', '2024-11-02', '\u062C\u0644\u0633\u0629 \u0645\u0631\u0627\u0641\u0639\u0629 \u062E\u062A\u0627\u0645\u064A\u0629 24 \u0633\u0628\u062A\u0645\u0628\u0631', NULL, NULL, '2024-11-02 09:00:00', '2026-09-15 12:00:00'),\n(3, '4521', 2026, '\u0628\u0646\u0643 \u0627\u0644\u062F\u0644\u062A\u0627 / \u0627\u0644\u0645\u062A\u0647\u0645 \u0643\u0645\u0627\u0644 \u0639\u0628\u062F\u0627\u0644\u0633\u062A\u0627\u0631 \u2014 \u0634\u064A\u0643 \u0628\u062F\u0648\u0646 \u0631\u0635\u064A\u062F', 14, 4, '\u0627\u0644\u062F\u0627\u0626\u0631\u0629 7 \u062C\u0646\u062D', '\u0627\u0628\u062A\u062F\u0627\u0626\u064A', '\u0645\u062A\u062F\u0627\u0648\u0644\u0629', '\u0639\u0627\u062F\u064A\u0629', 3, '\u0643\u0645\u0627\u0644 \u0639\u0628\u062F\u0627\u0644\u0633\u062A\u0627\u0631 \u0625\u0628\u0631\u0627\u0647\u064A\u0645', '\u0623. \u062D\u0633\u0627\u0645 \u0627\u0644\u062F\u064A\u0646 \u0639\u0644\u064A', 3, '\u062C\u0646\u062D\u0629 \u0634\u064A\u0643 \u0628\u062F\u0648\u0646 \u0631\u0635\u064A\u062F \u0628\u0645\u0628\u0644\u063A 2.4 \u0645\u0644\u064A\u0648\u0646 \u062C\u0646\u064A\u0647.', 2400000, 'EGP', '2026-01-18', '\u062D\u0636\u0648\u0631 \u0627\u0644\u062C\u0644\u0633\u0629 \u0648\u062A\u0642\u062F\u064A\u0645 \u0623\u0635\u0644 \u0627\u0644\u0634\u064A\u0643', NULL, NULL, '2026-01-18 11:00:00', '2026-09-10 09:00:00'),\n(4, '908', 2025, '\u0627\u0644\u0646\u064A\u0627\u0628\u0629 \u0627\u0644\u0639\u0627\u0645\u0629 / \u0627\u0644\u0645\u062A\u0647\u0645\u064A\u0646 \u0641\u064A \u0642\u0636\u064A\u0629 \u0623\u0645\u0648\u0627\u0644 \u0639\u0627\u0645\u0629', 13, 3, '\u0627\u0644\u062F\u0627\u0626\u0631\u0629 3 \u062C\u0646\u0627\u064A\u0627\u062A \u0623\u0645\u0648\u0627\u0644 \u0639\u0627\u0645\u0629', '\u062C\u0646\u0627\u064A\u0627\u062A', '\u0645\u062D\u062C\u0648\u0632\u0629 \u0644\u0644\u062D\u0643\u0645', '\u0639\u0627\u062C\u0644\u0629', 1, '\u0627\u0644\u0646\u064A\u0627\u0628\u0629 \u0627\u0644\u0639\u0627\u0645\u0629', NULL, 3, '\u0627\u0644\u062F\u0641\u0627\u0639 \u0639\u0646 \u0639\u0636\u0648 \u0645\u062C\u0644\u0633 \u0625\u062F\u0627\u0631\u0629 \u0645\u062C\u0645\u0648\u0639\u0629 \u0627\u0644\u0646\u064A\u0644 \u0641\u064A \u0627\u062A\u0647\u0627\u0645 \u062A\u0631\u0628\u0651\u062D.', 0, 'EGP', '2025-06-04', '\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0646\u0637\u0642 \u0628\u0627\u0644\u062D\u0643\u0645 28 \u0633\u0628\u062A\u0645\u0628\u0631', NULL, NULL, '2025-06-04 08:30:00', '2026-09-01 16:00:00'),\n(5, '2104', 2026, '\u0647\u0627\u0644\u0629 \u0645\u062D\u0645\u0648\u062F \u0627\u0644\u0634\u0631\u064A\u0641 / \u0637\u0627\u0631\u0642 \u0623\u0646\u0648\u0631 \u2014 \u0637\u0644\u0627\u0642 \u0644\u0644\u0636\u0631\u0631', 8, 5, '\u0627\u0644\u062F\u0627\u0626\u0631\u0629 2 \u0623\u0633\u0631\u0629', '\u0627\u0628\u062A\u062F\u0627\u0626\u064A', '\u0645\u062A\u062F\u0627\u0648\u0644\u0629', '\u0639\u0627\u0644\u064A\u0629', 5, '\u0637\u0627\u0631\u0642 \u0623\u0646\u0648\u0631 \u0645\u062D\u0645\u062F', '\u0623. \u0633\u0646\u0627\u0621 \u0639\u0628\u062F\u0627\u0644\u062D\u0645\u064A\u062F', 4, '\u0637\u0644\u0627\u0642 \u0644\u0644\u0636\u0631\u0631 \u0648\u0646\u0641\u0642\u0629 \u0632\u0648\u062C\u064A\u0629 \u0648\u0645\u0633\u0643\u0646 \u062D\u0636\u0627\u0646\u0629 \u0644\u0637\u0641\u0644\u062A\u064A\u0646.', 0, 'EGP', '2026-02-11', '\u0645\u0646\u0627\u0642\u0634\u0629 \u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0623\u062E\u0635\u0627\u0626\u064A \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639\u064A', NULL, NULL, '2026-02-11 10:00:00', '2026-09-14 11:00:00'),\n(6, '331', 2025, '\u0627\u0644\u0644\u0648\u0627\u0621 \u0641\u0647\u0645\u064A \u0648\u0648\u0631\u062B\u0629 \u2014 \u0642\u0633\u0645\u0629 \u0639\u0642\u0627\u0631\u064A\u0629', 1, 1, '\u0627\u0644\u062F\u0627\u0626\u0631\u0629 12 \u0645\u062F\u0646\u064A \u0643\u0644\u064A', '\u0627\u0628\u062A\u062F\u0627\u0626\u064A', '\u0645\u062A\u062F\u0627\u0648\u0644\u0629', '\u0639\u0627\u062F\u064A\u0629', 4, '\u0648\u0631\u062B\u0629 \u0627\u0644\u0645\u0631\u062D\u0648\u0645\u0629 \u0632\u064A\u0646\u0628 \u0641\u0647\u0645\u064A', '\u0623. \u0639\u0627\u062F\u0644 \u0645\u0646\u0635\u0648\u0631', 4, '\u0642\u0633\u0645\u0629 \u0639\u0642\u0627\u0631 \u0627\u0644\u0645\u0647\u0646\u062F\u0633\u064A\u0646 \u0648\u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u0634\u064A\u0648\u0639 \u0645\u0639 \u062A\u0639\u0648\u064A\u0636 \u0639\u0646 \u0627\u0644\u0631\u064A\u0639.', 18500000, 'EGP', '2025-09-01', '\u0646\u062F\u0628 \u062E\u0628\u064A\u0631 \u0645\u0633\u0627\u062D\u0629', NULL, NULL, '2025-09-01 12:00:00', '2026-08-20 10:00:00'),\n(7, '1190', 2026, '\u0639\u0645\u0627\u0644 \u0645\u0635\u0627\u0646\u0639 \u0627\u0644\u062F\u0644\u062A\u0627 / \u0627\u0644\u0634\u0631\u0643\u0629 \u2014 \u0641\u0635\u0644 \u062A\u0639\u0633\u0641\u064A \u062C\u0645\u0627\u0639\u064A', 12, 10, '\u0627\u0644\u062F\u0627\u0626\u0631\u0629 1 \u0639\u0645\u0627\u0644', '\u0627\u0628\u062A\u062F\u0627\u0626\u064A', '\u0645\u062A\u062F\u0627\u0648\u0644\u0629', '\u0639\u0627\u0644\u064A\u0629', 6, '42 \u0639\u0627\u0645\u0644\u0627\u064B \u0645\u0645\u062B\u0644\u064A\u0646 \u0628\u0646\u0642\u0627\u0628\u0629 \u0627\u0644\u063A\u0632\u0644', '\u0623. \u0641\u062A\u062D\u064A \u0627\u0644\u062C\u0645\u0644', 6, '\u062F\u0641\u0627\u0639 \u0627\u0644\u0634\u0631\u0643\u0629 \u0641\u064A \u062F\u0639\u0627\u0648\u0649 \u0641\u0635\u0644 \u0628\u0639\u062F \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0647\u064A\u0643\u0644\u0629.', 0, 'EGP', '2026-04-22', '\u062A\u0642\u062F\u064A\u0645 \u0643\u0634\u0648\u0641 \u0627\u0644\u062A\u0623\u0645\u064A\u0646\u0627\u062A \u0648\u0647\u064A\u0643\u0644 \u0627\u0644\u0631\u0648\u0627\u062A\u0628', NULL, NULL, '2026-04-22 09:15:00', '2026-09-12 14:00:00'),\n(8, '67', 2025, '\u0648\u0627\u0626\u0644 \u0639\u0628\u062F\u0627\u0644\u0631\u062D\u0645\u0646 / \u0634\u0631\u0643\u0629 \u0628\u0646\u0627\u0629 \u0627\u0644\u0623\u0647\u0631\u0627\u0645 \u2014 \u0641\u0633\u062E \u0645\u0642\u0627\u0648\u0644\u0629', 3, 11, '\u0627\u0644\u062F\u0627\u0626\u0631\u0629 2 \u0627\u0642\u062A\u0635\u0627\u062F\u064A', '\u0627\u0628\u062A\u062F\u0627\u0626\u064A', '\u0645\u062A\u062F\u0627\u0648\u0644\u0629', '\u0639\u0627\u0644\u064A\u0629', 7, '\u0634\u0631\u0643\u0629 \u0628\u0646\u0627\u0629 \u0627\u0644\u0623\u0647\u0631\u0627\u0645 \u0644\u0644\u0645\u0642\u0627\u0648\u0644\u0627\u062A', '\u0623. \u0634\u0631\u064A\u0641 \u0639\u0632\u062A', 2, '\u0641\u0633\u062E \u0639\u0642\u062F \u0645\u0642\u0627\u0648\u0644\u0629 \u0641\u064A\u0644\u0627 \u0648\u0627\u0644\u062A\u062C\u0645\u0639 \u0648\u0627\u0644\u062A\u0639\u0648\u064A\u0636 \u0639\u0646 \u0627\u0644\u0639\u064A\u0648\u0628.', 9200000, 'EGP', '2025-12-07', '\u062A\u0639\u0642\u064A\u0628 \u0639\u0644\u0649 \u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u062E\u0628\u064A\u0631 \u0627\u0644\u0647\u0646\u062F\u0633\u064A', NULL, NULL, '2025-12-07 13:00:00', '2026-09-08 17:00:00'),\n(9, '445', 2024, '\u0633\u0641\u0646\u0643\u0633 \u0644\u0644\u0633\u064A\u0627\u062D\u0629 / \u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u0633\u064A\u0627\u062D\u0629 \u2014 \u0625\u0644\u063A\u0627\u0621 \u0642\u0631\u0627\u0631', 10, 8, '\u0627\u0644\u062F\u0627\u0626\u0631\u0629 7 \u0642\u0636\u0627\u0621 \u0625\u062F\u0627\u0631\u064A', '\u0625\u062F\u0627\u0631\u064A', '\u0645\u062A\u062F\u0627\u0648\u0644\u0629', '\u0639\u0627\u062F\u064A\u0629', 10, '\u0648\u0632\u064A\u0631 \u0627\u0644\u0633\u064A\u0627\u062D\u0629 \u0628\u0635\u0641\u062A\u0647', '\u0647\u064A\u0626\u0629 \u0642\u0636\u0627\u064A\u0627 \u0627\u0644\u062F\u0648\u0644\u0629', 5, '\u0625\u0644\u063A\u0627\u0621 \u0642\u0631\u0627\u0631 \u0633\u062D\u0628 \u062A\u0631\u062E\u064A\u0635 \u062A\u0634\u063A\u064A\u0644 \u0641\u0646\u062F\u0642 \u0628\u0627\u0644\u0633\u0627\u062D\u0644 \u0627\u0644\u0634\u0645\u0627\u0644\u064A.', 0, 'EGP', '2024-08-19', '\u062D\u062C\u0632 \u0627\u0644\u062F\u0639\u0648\u0649 \u0644\u0644\u062D\u0643\u0645', NULL, NULL, '2024-08-19 10:00:00', '2026-07-30 09:00:00'),\n(10, '8022', 2023, '\u062F\u064A\u0646\u0627 \u0643\u0645\u0627\u0644 / \u0627\u0644\u062D\u0627\u0626\u0632 \u0628\u062F\u0648\u0646 \u0633\u0646\u062F \u2014 \u0637\u0631\u062F \u0644\u0644\u063A\u0635\u0628', 1, 2, '\u0627\u0644\u062F\u0627\u0626\u0631\u0629 5 \u0645\u062F\u0646\u064A \u0643\u0644\u064A', '\u0627\u0628\u062A\u062F\u0627\u0626\u064A', '\u0645\u0646\u062A\u0647\u064A\u0629', '\u0639\u0627\u062F\u064A\u0629', 9, '\u0645\u062D\u0645\u0648\u062F \u0627\u0644\u0633\u064A\u062F \u0639\u0637\u0627', NULL, 2, '\u0637\u0631\u062F \u0644\u0644\u063A\u0635\u0628 \u0648\u0627\u0633\u062A\u0631\u062F\u0627\u062F \u062D\u064A\u0627\u0632\u0629 \u0634\u0642\u0629 \u0645\u0635\u0631 \u0627\u0644\u062C\u062F\u064A\u062F\u0629.', 0, 'EGP', '2023-11-14', NULL, '\u062D\u0643\u0645 \u0628\u0627\u0644\u0637\u0631\u062F \u0648\u0627\u0633\u062A\u0644\u0627\u0645 \u0628\u062A\u0627\u0631\u064A\u062E 2026-05-12', '2026-05-12', '2023-11-14 11:00:00', '2026-05-12 15:00:00'),\n(11, '155', 2026, '\u062D\u0633\u064A\u0646 \u0639\u0628\u062F\u0627\u0644\u0639\u0627\u0644 \u2014 \u0645\u0639\u0627\u0631\u0636\u0629 \u0641\u064A \u062D\u0643\u0645 \u0634\u064A\u0643', 14, 4, '\u0627\u0644\u062F\u0627\u0626\u0631\u0629 3 \u062C\u0646\u062D', '\u0627\u0628\u062A\u062F\u0627\u0626\u064A', '\u0645\u062A\u062F\u0627\u0648\u0644\u0629', '\u0645\u0646\u062E\u0641\u0636\u0629', 11, '\u0628\u0646\u0643 \u0627\u0644\u062F\u0644\u062A\u0627 \u0627\u0644\u062A\u062C\u0627\u0631\u064A', '\u0625\u062F\u0627\u0631\u0629 \u0642\u0636\u0627\u064A\u0627 \u0627\u0644\u0628\u0646\u0643', 3, '\u0645\u0639\u0627\u0631\u0636\u0629 \u0641\u064A \u062D\u0643\u0645 \u063A\u064A\u0627\u0628\u064A \u0628\u0627\u0644\u062D\u0628\u0633 \u0641\u064A \u062C\u0646\u062D\u0629 \u0634\u064A\u0643.', 380000, 'EGP', '2026-06-03', '\u062D\u0636\u0648\u0631 \u0627\u0644\u0645\u0639\u0627\u0631\u0636\u0629 \u0648\u062A\u0642\u062F\u064A\u0645 \u0623\u0633\u0628\u0627\u0628', NULL, NULL, '2026-06-03 09:00:00', '2026-09-05 10:00:00'),\n(12, '29', 2026, '\u0645\u062C\u0645\u0648\u0639\u0629 \u0627\u0644\u0646\u064A\u0644 \u2014 \u0627\u0633\u062A\u0626\u0646\u0627\u0641 \u062D\u0643\u0645 \u062A\u0639\u0648\u064A\u0636', 3, 6, '\u0627\u0644\u062F\u0627\u0626\u0631\u0629 8 \u062A\u062C\u0627\u0631\u064A', '\u0627\u0633\u062A\u0626\u0646\u0627\u0641', '\u0645\u062A\u062F\u0627\u0648\u0644\u0629', '\u0639\u0627\u0644\u064A\u0629', 1, '\u0634\u0631\u0643\u0629 \u0627\u0644\u0628\u062D\u0631 \u0627\u0644\u0645\u062A\u0648\u0633\u0637 \u0644\u0644\u0634\u062D\u0646', '\u0623. \u0646\u0628\u064A\u0644 \u0642\u0627\u0633\u0645', 1, '\u0627\u0633\u062A\u0626\u0646\u0627\u0641 \u062D\u0643\u0645 \u0625\u0644\u0632\u0627\u0645 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629 \u0628\u062A\u0639\u0648\u064A\u0636 11 \u0645\u0644\u064A\u0648\u0646.', 11000000, 'EGP', '2026-03-28', '\u0645\u0631\u0627\u0641\u0639\u0629 \u0627\u0633\u062A\u0626\u0646\u0627\u0641\u064A\u0629', NULL, NULL, '2026-03-28 12:00:00', '2026-09-11 16:00:00'),\n(13, '512', 2025, '\u0627\u0644\u0647\u064A\u0626\u0629 \u0627\u0644\u0635\u0646\u0627\u0639\u064A\u0629 / \u0645\u0633\u062A\u062B\u0645\u0631 \u2014 \u062A\u062E\u0635\u064A\u0635 \u0623\u0631\u0636', 10, 8, '\u0627\u0644\u062F\u0627\u0626\u0631\u0629 4 \u0642\u0636\u0627\u0621 \u0625\u062F\u0627\u0631\u064A', '\u0625\u062F\u0627\u0631\u064A', '\u0645\u0648\u0642\u0648\u0641\u0629', '\u0639\u0627\u062F\u064A\u0629', 8, '\u0634\u0631\u0643\u0629 \u0627\u0644\u0631\u0645\u0627\u0644 \u0627\u0644\u0630\u0647\u0628\u064A\u0629', '\u0623. \u0643\u0645\u0627\u0644 \u062F\u0631\u0648\u064A\u0634', 5, '\u0627\u0644\u062F\u0641\u0627\u0639 \u0639\u0646 \u0642\u0631\u0627\u0631 \u062A\u062E\u0635\u064A\u0635 \u0623\u0631\u0636 \u0628\u0627\u0644\u0639\u0627\u0634\u0631 \u0645\u0646 \u0631\u0645\u0636\u0627\u0646.', 0, 'EGP', '2025-01-09', '\u0648\u0642\u0641 \u062A\u0639\u0644\u064A\u0642\u064A\u0627\u064B \u0644\u062D\u064A\u0646 \u0627\u0644\u0641\u0635\u0644 \u0641\u064A \u062F\u0639\u0648\u0649 \u0645\u0631\u062A\u0628\u0637\u0629', NULL, NULL, '2025-01-09 10:00:00', '2026-04-01 10:00:00');\n\nINSERT OR IGNORE INTO case_lawyers (case_id, user_id, role) VALUES\n(1, 2, '\u0631\u0626\u064A\u0633'), (1, 7, '\u0645\u0633\u0627\u0639\u062F'), (1, 1, '\u0625\u0634\u0631\u0627\u0641'),\n(2, 1, '\u0631\u0626\u064A\u0633'), (2, 2, '\u0645\u0631\u0627\u0641\u0639\u0629'), (2, 5, '\u0628\u062D\u0648\u062B'),\n(3, 3, '\u0631\u0626\u064A\u0633'), (3, 7, '\u0645\u0633\u0627\u0639\u062F'),\n(4, 3, '\u0631\u0626\u064A\u0633'), (4, 1, '\u0625\u0634\u0631\u0627\u0641'), (4, 7, '\u0623\u0631\u0634\u064A\u0641'),\n(5, 4, '\u0631\u0626\u064A\u0633'), (5, 8, '\u0645\u062A\u0627\u0628\u0639\u0629'),\n(6, 4, '\u0631\u0626\u064A\u0633'), (6, 2, '\u0627\u0633\u062A\u0634\u0627\u0631\u0629 \u0639\u0642\u0627\u0631\u064A\u0629'),\n(7, 6, '\u0631\u0626\u064A\u0633'), (7, 7, '\u0645\u0633\u0627\u0639\u062F'),\n(8, 2, '\u0631\u0626\u064A\u0633'), (8, 7, '\u0645\u0633\u0627\u0639\u062F'),\n(9, 5, '\u0631\u0626\u064A\u0633'), (9, 1, '\u0625\u0634\u0631\u0627\u0641'),\n(10, 2, '\u0631\u0626\u064A\u0633'),\n(11, 3, '\u0631\u0626\u064A\u0633'),\n(12, 1, '\u0631\u0626\u064A\u0633'), (12, 2, '\u0645\u0631\u0627\u0641\u0639\u0629'),\n(13, 5, '\u0631\u0626\u064A\u0633');\n\nINSERT OR IGNORE INTO hearings (id, case_id, hearing_date, hearing_time, court_id, circuit, type, purpose, result, next_date, lawyer_id, status, notes) VALUES\n(1, 1, '2026-09-21', '09:30', 11, '\u0627\u0644\u062F\u0627\u0626\u0631\u0629 4 \u0627\u0642\u062A\u0635\u0627\u062F\u064A', '\u0645\u0631\u0627\u0641\u0639\u0629', '\u062A\u0639\u0642\u064A\u0628 \u0639\u0644\u0649 \u0645\u0630\u0643\u0631\u0629 \u0627\u0644\u062E\u0635\u0645 \u0648\u062A\u0642\u062F\u064A\u0645 \u0623\u0635\u0648\u0644 \u0627\u0644\u0639\u0642\u0648\u062F', NULL, NULL, 2, '\u0642\u0627\u062F\u0645\u0629', '\u0625\u062D\u0636\u0627\u0631 \u0623\u0635\u0644 \u0639\u0642\u062F \u0627\u0644\u062A\u0648\u0631\u064A\u062F + \u0645\u0631\u0627\u0633\u0644\u0627\u062A \u0627\u0644\u062A\u0623\u062E\u064A\u0631'),\n(2, 2, '2026-09-24', '11:00', NULL, '\u063A\u0631\u0641\u0629 \u0627\u0644\u0642\u0627\u0647\u0631\u0629 \u0644\u0644\u062A\u062D\u0643\u064A\u0645', '\u0645\u0631\u0627\u0641\u0639\u0629', '\u0645\u0631\u0627\u0641\u0639\u0629 \u062E\u062A\u0627\u0645\u064A\u0629 \u0623\u0645\u0627\u0645 \u0647\u064A\u0626\u0629 \u0627\u0644\u062A\u062D\u0643\u064A\u0645', NULL, NULL, 1, '\u0642\u0627\u062F\u0645\u0629', '\u062B\u0644\u0627\u062B \u0646\u0633\u062E \u0645\u0646 \u0627\u0644\u0645\u0630\u0643\u0631\u0629 \u0627\u0644\u062E\u062A\u0627\u0645\u064A\u0629 + \u062D\u0627\u0641\u0638\u0629 \u0645\u0633\u062A\u0646\u062F\u0627\u062A'),\n(3, 3, '2026-09-17', '10:00', 4, '\u0627\u0644\u062F\u0627\u0626\u0631\u0629 7 \u062C\u0646\u062D', '\u062A\u062D\u0642\u064A\u0642', '\u062A\u0642\u062F\u064A\u0645 \u0623\u0635\u0644 \u0627\u0644\u0634\u064A\u0643 \u0648\u0633\u0645\u0627\u0639 \u0627\u0644\u0634\u0647\u0648\u062F', NULL, NULL, 3, '\u0642\u0627\u062F\u0645\u0629', '\u0623\u0635\u0644 \u0627\u0644\u0634\u064A\u0643 \u0641\u064A \u062E\u0632\u064A\u0646\u0629 \u0627\u0644\u0645\u0643\u062A\u0628 \u2014 \u062A\u0633\u0644\u0645\u0647 \u0641\u0627\u0637\u0645\u0629 \u0635\u0628\u0627\u062D\u0627\u064B'),\n(4, 4, '2026-09-28', '09:00', 3, '\u062C\u0646\u0627\u064A\u0627\u062A \u0623\u0645\u0648\u0627\u0644 \u0639\u0627\u0645\u0629', '\u062D\u0643\u0645', '\u0627\u0644\u0646\u0637\u0642 \u0628\u0627\u0644\u062D\u0643\u0645', NULL, NULL, 3, '\u0642\u0627\u062F\u0645\u0629', '\u062D\u0636\u0648\u0631 \u0627\u0644\u0645\u0633\u062A\u0634\u0627\u0631 \u0627\u0644\u0634\u0631\u064A\u0641 \u0634\u062E\u0635\u064A\u0627\u064B'),\n(5, 5, '2026-09-18', '11:30', 5, '\u0627\u0644\u062F\u0627\u0626\u0631\u0629 2 \u0623\u0633\u0631\u0629', '\u062A\u062D\u0642\u064A\u0642', '\u0645\u0646\u0627\u0642\u0634\u0629 \u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0623\u062E\u0635\u0627\u0626\u064A \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639\u064A', NULL, NULL, 4, '\u0642\u0627\u062F\u0645\u0629', '\u0625\u062D\u0636\u0627\u0631 \u0627\u0644\u0645\u0648\u0643\u0644\u0629 \u0648\u0627\u0644\u0637\u0641\u0644\u062A\u064A\u0646 \u0625\u0646 \u0644\u0632\u0645'),\n(6, 7, '2026-09-22', '09:00', 10, '\u0627\u0644\u062F\u0627\u0626\u0631\u0629 1 \u0639\u0645\u0627\u0644', '\u0645\u0631\u0627\u0641\u0639\u0629', '\u062A\u0642\u062F\u064A\u0645 \u0643\u0634\u0648\u0641 \u0627\u0644\u062A\u0623\u0645\u064A\u0646\u0627\u062A \u0648\u0647\u064A\u0643\u0644 \u0627\u0644\u0623\u062C\u0648\u0631', NULL, NULL, 6, '\u0642\u0627\u062F\u0645\u0629', NULL),\n(7, 8, '2026-09-20', '10:15', 11, '\u0627\u0644\u062F\u0627\u0626\u0631\u0629 2 \u0627\u0642\u062A\u0635\u0627\u062F\u064A', '\u062E\u0628\u0631\u0629', '\u062A\u0639\u0642\u064A\u0628 \u0639\u0644\u0649 \u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u062E\u0628\u064A\u0631 \u0627\u0644\u0647\u0646\u062F\u0633\u064A', NULL, NULL, 2, '\u0642\u0627\u062F\u0645\u0629', '\u0627\u0644\u062A\u0646\u0633\u064A\u0642 \u0645\u0639 \u0627\u0644\u0645\u0647\u0646\u062F\u0633 \u0627\u0644\u0627\u0633\u062A\u0634\u0627\u0631\u064A \u0643\u0645\u0627\u0644'),\n(8, 12, '2026-09-23', '09:45', 6, '\u0627\u0644\u062F\u0627\u0626\u0631\u0629 8 \u062A\u062C\u0627\u0631\u064A', '\u0645\u0631\u0627\u0641\u0639\u0629', '\u0645\u0631\u0627\u0641\u0639\u0629 \u0627\u0633\u062A\u0626\u0646\u0627\u0641\u064A\u0629', NULL, NULL, 1, '\u0642\u0627\u062F\u0645\u0629', NULL),\n(9, 11, '2026-09-17', '12:00', 4, '\u0627\u0644\u062F\u0627\u0626\u0631\u0629 3 \u062C\u0646\u062D', '\u0645\u0631\u0627\u0641\u0639\u0629', '\u0645\u0639\u0627\u0631\u0636\u0629 \u0641\u064A \u062D\u0643\u0645 \u063A\u064A\u0627\u0628\u064A', NULL, NULL, 3, '\u0642\u0627\u062F\u0645\u0629', '\u0625\u0639\u0644\u0627\u0646 \u0627\u0644\u062E\u0635\u0648\u0645 \u062A\u0645 \u0641\u064A 3 \u0633\u0628\u062A\u0645\u0628\u0631'),\n(10, 6, '2026-10-05', '09:00', 1, '\u0627\u0644\u062F\u0627\u0626\u0631\u0629 12 \u0645\u062F\u0646\u064A \u0643\u0644\u064A', '\u062E\u0628\u0631\u0629', '\u0646\u062F\u0628 \u062E\u0628\u064A\u0631 \u0645\u0633\u0627\u062D\u0629', NULL, NULL, 4, '\u0642\u0627\u062F\u0645\u0629', NULL),\n(11, 9, '2026-08-12', '10:00', 8, '\u0627\u0644\u062F\u0627\u0626\u0631\u0629 7 \u0642\u0636\u0627\u0621 \u0625\u062F\u0627\u0631\u064A', '\u062D\u0643\u0645', '\u062D\u062C\u0632 \u0644\u0644\u062D\u0643\u0645', '\u062D\u062C\u0632\u062A \u0644\u0644\u062D\u0643\u0645 \u0644\u062C\u0644\u0633\u0629 12 \u0623\u0643\u062A\u0648\u0628\u0631', '2026-10-12', 5, '\u062A\u0645\u062A', NULL),\n(12, 1, '2026-08-24', '09:30', 11, '\u0627\u0644\u062F\u0627\u0626\u0631\u0629 4 \u0627\u0642\u062A\u0635\u0627\u062F\u064A', '\u0645\u0631\u0627\u0641\u0639\u0629', '\u062A\u0642\u062F\u064A\u0645 \u062D\u0627\u0641\u0638\u0629 \u0645\u0633\u062A\u0646\u062F\u0627\u062A', '\u062A\u0623\u062C\u064A\u0644 \u0644\u0644\u0625\u0637\u0644\u0627\u0639', '2026-09-21', 2, '\u062A\u0623\u062C\u064A\u0644', NULL),\n(13, 5, '2026-08-06', '11:00', 5, '\u0627\u0644\u062F\u0627\u0626\u0631\u0629 2 \u0623\u0633\u0631\u0629', '\u062A\u062D\u0642\u064A\u0642', '\u0634\u0647\u0627\u062F\u0629 \u0627\u0644\u0634\u0647\u0648\u062F', '\u0633\u064F\u0645\u0639 \u0634\u0627\u0647\u062F\u0627\u0646 \u0644\u0644\u0645\u0648\u0643\u0644\u0629', '2026-09-18', 4, '\u062A\u0645\u062A', NULL),\n(14, 3, '2026-07-15', '10:00', 4, '\u0627\u0644\u062F\u0627\u0626\u0631\u0629 7 \u062C\u0646\u062D', '\u0645\u0631\u0627\u0641\u0639\u0629', '\u0623\u0648\u0644 \u062C\u0644\u0633\u0629', '\u062A\u0623\u062C\u064A\u0644 \u0644\u0625\u0639\u0644\u0627\u0646 \u0627\u0644\u0645\u062A\u0647\u0645', '2026-09-17', 3, '\u062A\u0623\u062C\u064A\u0644', NULL),\n(15, 7, '2026-08-18', '09:00', 10, '\u0627\u0644\u062F\u0627\u0626\u0631\u0629 1 \u0639\u0645\u0627\u0644', '\u0645\u0631\u0627\u0641\u0639\u0629', '\u0631\u062F \u0639\u0644\u0649 \u0635\u062D\u064A\u0641\u0629 \u0627\u0644\u062F\u0639\u0648\u0649', '\u062A\u0623\u062C\u064A\u0644 \u0644\u062A\u0642\u062F\u064A\u0645 \u0645\u0633\u062A\u0646\u062F\u0627\u062A \u0627\u0644\u0634\u0631\u0643\u0629', '2026-09-22', 6, '\u062A\u0623\u062C\u064A\u0644', NULL),\n(16, 2, '2026-06-30', '11:00', NULL, '\u063A\u0631\u0641\u0629 \u0627\u0644\u0642\u0627\u0647\u0631\u0629 \u0644\u0644\u062A\u062D\u0643\u064A\u0645', '\u062E\u0628\u0631\u0629', '\u0645\u0646\u0627\u0642\u0634\u0629 \u0627\u0644\u062E\u0628\u064A\u0631 \u0627\u0644\u0641\u0646\u064A', '\u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u062A\u0642\u0631\u064A\u0631 \u062C\u0632\u0626\u064A\u0627\u064B', '2026-09-24', 1, '\u062A\u0645\u062A', NULL),\n(17, 10, '2026-05-12', '09:30', 2, '\u0627\u0644\u062F\u0627\u0626\u0631\u0629 5 \u0645\u062F\u0646\u064A \u0643\u0644\u064A', '\u062D\u0643\u0645', '\u0646\u0637\u0642 \u0628\u0627\u0644\u062D\u0643\u0645', '\u062D\u0643\u0645 \u0628\u0627\u0644\u0637\u0631\u062F \u0644\u0644\u063A\u0635\u0628', NULL, 2, '\u062A\u0645\u062A', '\u062A\u0645 \u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u0641\u064A \u064A\u0648\u0646\u064A\u0648 2026'),\n(18, 12, '2026-07-21', '09:45', 6, '\u0627\u0644\u062F\u0627\u0626\u0631\u0629 8 \u062A\u062C\u0627\u0631\u064A', '\u0645\u0631\u0627\u0641\u0639\u0629', '\u062A\u0628\u0627\u062F\u0644 \u0627\u0644\u0645\u0630\u0643\u0631\u0627\u062A', '\u062A\u0623\u062C\u064A\u0644 \u0644\u0644\u0645\u0631\u0627\u0641\u0639\u0629', '2026-09-23', 1, '\u062A\u0623\u062C\u064A\u0644', NULL),\n(19, 4, '2026-07-08', '09:00', 3, '\u062C\u0646\u0627\u064A\u0627\u062A \u0623\u0645\u0648\u0627\u0644 \u0639\u0627\u0645\u0629', '\u0645\u0631\u0627\u0641\u0639\u0629', '\u0645\u0631\u0627\u0641\u0639\u0629 \u0627\u0644\u062F\u0641\u0627\u0639 \u0627\u0644\u062E\u062A\u0627\u0645\u064A\u0629', '\u062D\u062C\u0632 \u0644\u0644\u062D\u0643\u0645', '2026-09-28', 3, '\u062D\u062C\u0632 \u0644\u0644\u062D\u0643\u0645', NULL),\n(20, 8, '2026-07-02', '10:15', 11, '\u0627\u0644\u062F\u0627\u0626\u0631\u0629 2 \u0627\u0642\u062A\u0635\u0627\u062F\u064A', '\u062E\u0628\u0631\u0629', '\u0627\u0646\u062A\u0642\u0627\u0644 \u0627\u0644\u062E\u0628\u064A\u0631 \u0644\u0644\u0645\u0639\u0627\u064A\u0646\u0629', '\u0623\u064F\u0648\u062F\u0639 \u0627\u0644\u062A\u0642\u0631\u064A\u0631', '2026-09-20', 2, '\u062A\u0645\u062A', NULL);\n\nINSERT OR IGNORE INTO tasks (id, title, description, case_id, client_id, assignee_id, creator_id, due_date, due_time, priority, status, category) VALUES\n(1, '\u0635\u064A\u0627\u063A\u0629 \u0645\u0630\u0643\u0631\u0629 \u062A\u0639\u0642\u064A\u0628 \u2014 \u0642\u0636\u064A\u0629 \u0623\u0637\u0644\u0633', '\u062A\u0639\u0642\u064A\u0628 \u0642\u0627\u0646\u0648\u0646\u064A \u0639\u0644\u0649 \u062F\u0641\u0639 \u0639\u062F\u0645 \u0627\u0644\u0627\u062E\u062A\u0635\u0627\u0635 \u0627\u0644\u0646\u0648\u0639\u064A \u0645\u0639 \u062D\u0627\u0641\u0638\u0629 \u0645\u0633\u062A\u0646\u062F\u0627\u062A \u062C\u062F\u064A\u062F\u0629.', 1, 1, 2, 1, '2026-09-19', '17:00', '\u0639\u0627\u062C\u0644\u0629', '\u062C\u0627\u0631\u064A\u0629', '\u0635\u064A\u0627\u063A\u0629'),\n(2, '\u0637\u0628\u0627\u0639\u0629 \u0627\u0644\u0645\u0630\u0643\u0631\u0629 \u0627\u0644\u062E\u062A\u0627\u0645\u064A\u0629 \u0644\u0644\u062A\u062D\u0643\u064A\u0645 \u2014 6 \u0646\u0633\u062E', '\u062A\u062C\u0644\u064A\u062F \u0641\u0627\u062E\u0631 + \u062A\u0628\u0644\u064A\u063A \u0627\u0644\u0633\u0643\u0631\u062A\u0627\u0631\u064A\u0629 \u0628\u063A\u0631\u0641\u0629 \u0627\u0644\u062A\u062D\u0643\u064A\u0645.', 2, 2, 8, 1, '2026-09-23', '12:00', '\u0639\u0627\u062C\u0644\u0629', '\u0645\u0641\u062A\u0648\u062D\u0629', '\u0625\u062F\u0627\u0631\u064A'),\n(3, '\u0627\u0633\u062A\u0644\u0627\u0645 \u0623\u0635\u0644 \u0627\u0644\u0634\u064A\u0643 \u0645\u0646 \u0627\u0644\u062E\u0632\u064A\u0646\u0629', '\u0642\u0636\u064A\u0629 \u0628\u0646\u0643 \u0627\u0644\u062F\u0644\u062A\u0627 \u2014 \u062C\u0644\u0633\u0629 \u0627\u0644\u064A\u0648\u0645.', 3, 3, 8, 3, '2026-09-17', '08:30', '\u0639\u0627\u062C\u0644\u0629', '\u062C\u0627\u0631\u064A\u0629', '\u0625\u062F\u0627\u0631\u064A'),\n(4, '\u0625\u0639\u062F\u0627\u062F \u0645\u0631\u0627\u0641\u0639\u0629 \u0627\u0644\u0646\u0637\u0642 \u0628\u0627\u0644\u062D\u0643\u0645 \u2014 \u0623\u0645\u0648\u0627\u0644 \u0639\u0627\u0645\u0629', '\u0646\u0642\u0627\u0637 \u0627\u0644\u0645\u0631\u0627\u0641\u0639\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u0625\u0630\u0627 \u0637\u064F\u0644\u0628 \u062A\u0648\u0636\u064A\u062D.', 4, 1, 3, 1, '2026-09-27', '18:00', '\u0639\u0627\u0644\u064A\u0629', '\u0645\u0641\u062A\u0648\u062D\u0629', '\u0645\u0631\u0627\u0641\u0639\u0629'),\n(5, '\u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0623\u062E\u0635\u0627\u0626\u064A \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639\u064A \u2014 \u0623\u0633\u0631\u0629 \u0645\u0635\u0631 \u0627\u0644\u062C\u062F\u064A\u062F\u0629', '\u0637\u0644\u0628 \u0646\u0633\u062E\u0629 \u0627\u0644\u062A\u0642\u0631\u064A\u0631 \u0642\u0628\u0644 \u0627\u0644\u062C\u0644\u0633\u0629.', 5, 5, 4, 4, '2026-09-17', '15:00', '\u0639\u0627\u0644\u064A\u0629', '\u0645\u0641\u062A\u0648\u062D\u0629', '\u0628\u062D\u062B'),\n(6, '\u062A\u062C\u0645\u064A\u0639 \u0643\u0634\u0648\u0641 \u0627\u0644\u062A\u0623\u0645\u064A\u0646\u0627\u062A \u2014 \u0645\u0635\u0627\u0646\u0639 \u0627\u0644\u062F\u0644\u062A\u0627', '\u0645\u0646 2022 \u062D\u062A\u0649 2026 + \u0642\u0631\u0627\u0631\u0627\u062A \u0627\u0644\u0647\u064A\u0643\u0644\u0629.', 7, 6, 6, 6, '2026-09-21', '14:00', '\u0639\u0627\u0644\u064A\u0629', '\u062C\u0627\u0631\u064A\u0629', '\u0628\u062D\u062B'),\n(7, '\u0627\u062C\u062A\u0645\u0627\u0639 \u0645\u0639 \u0627\u0644\u062E\u0628\u064A\u0631 \u0627\u0644\u0627\u0633\u062A\u0634\u0627\u0631\u064A \u0643\u0645\u0627\u0644', '\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0639\u0644\u0649 \u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u062E\u0628\u0631\u0629 \u0627\u0644\u0647\u0646\u062F\u0633\u064A\u0629.', 8, 7, 2, 2, '2026-09-18', '16:00', '\u0639\u0627\u0644\u064A\u0629', '\u0645\u0641\u062A\u0648\u062D\u0629', '\u062E\u0628\u0631\u0629'),\n(8, '\u0625\u0639\u0644\u0627\u0646 \u0627\u0644\u062E\u0635\u0648\u0645 \u0628\u0635\u0648\u0631\u0629 \u0627\u0644\u062D\u0643\u0645 \u2014 \u0637\u0631\u062F \u0627\u0644\u063A\u0635\u0628', '\u0645\u062A\u0627\u0628\u0639\u0629 \u0645\u062D\u0636\u0631 \u0627\u0644\u062A\u0646\u0641\u064A\u0630.', 10, 9, 7, 2, '2026-09-25', '12:00', '\u0639\u0627\u062F\u064A\u0629', '\u0645\u0641\u062A\u0648\u062D\u0629', '\u062A\u0646\u0641\u064A\u0630'),\n(9, '\u062A\u062C\u062F\u064A\u062F \u0627\u0644\u062A\u0648\u0643\u064A\u0644 \u0627\u0644\u0639\u0627\u0645 \u2014 \u0645\u062C\u0645\u0648\u0639\u0629 \u0627\u0644\u0646\u064A\u0644', '\u064A\u0646\u062A\u0647\u064A \u0641\u064A 30 \u0623\u0643\u062A\u0648\u0628\u0631 2026.', 1, 1, 8, 1, '2026-10-10', '12:00', '\u0639\u0627\u0644\u064A\u0629', '\u0645\u0641\u062A\u0648\u062D\u0629', '\u0625\u062F\u0627\u0631\u064A'),\n(10, '\u0645\u0631\u0627\u062C\u0639\u0629 \u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0634\u0631\u0642 \u0644\u0644\u0625\u0646\u0634\u0627\u0621\u0627\u062A', '\u0631\u0628\u0637 \u0627\u0644\u0633\u0627\u0639\u0627\u062A \u063A\u064A\u0631 \u0627\u0644\u0645\u0641\u0648\u062A\u0631\u0629 \u0628\u0634\u0647\u0631 \u0623\u063A\u0633\u0637\u0633.', 2, 2, 9, 1, '2026-09-18', '11:00', '\u0639\u0627\u062F\u064A\u0629', '\u062C\u0627\u0631\u064A\u0629', '\u0625\u062F\u0627\u0631\u064A'),\n(11, '\u0628\u062D\u062B \u0633\u0648\u0627\u0628\u0642 \u0627\u0644\u0646\u0642\u0636 \u0641\u064A \u0627\u0644\u0634\u064A\u0643\u0627\u062A', '\u0644\u062F\u0639\u0645 \u0645\u0631\u0627\u0641\u0639\u0629 \u0627\u0644\u0645\u0639\u0627\u0631\u0636\u0629.', 11, 11, 7, 3, '2026-09-17', '09:00', '\u0639\u0627\u062F\u064A\u0629', '\u0645\u0643\u062A\u0645\u0644\u0629', '\u0628\u062D\u062B'),\n(12, '\u0635\u064A\u0627\u063A\u0629 \u0625\u0646\u0630\u0627\u0631 \u0639\u0631\u0636 \u2014 \u0648\u0627\u0626\u0644 \u0639\u0628\u062F\u0627\u0644\u0631\u062D\u0645\u0646', '\u0625\u0646\u0630\u0627\u0631 \u0631\u0633\u0645\u064A \u0644\u0644\u0645\u0642\u0627\u0648\u0644 \u0628\u062A\u0633\u0644\u064A\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u0644\u0635 \u0627\u0644\u062E\u062A\u0627\u0645\u064A.', 8, 7, 2, 2, '2026-09-26', '17:00', '\u0639\u0627\u062F\u064A\u0629', '\u0645\u0641\u062A\u0648\u062D\u0629', '\u0635\u064A\u0627\u063A\u0629'),\n(13, '\u0623\u0631\u0634\u0641\u0629 \u0645\u0633\u062A\u0646\u062F\u0627\u062A \u0627\u0644\u062C\u0646\u0627\u064A\u0627\u062A', '\u062A\u062C\u0647\u064A\u0632 \u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u062C\u0644\u0633\u0629 \u0627\u0644\u0623\u062E\u064A\u0631\u0629.', 4, 1, 7, 3, '2026-09-20', '16:00', '\u0639\u0627\u062F\u064A\u0629', '\u0645\u0641\u062A\u0648\u062D\u0629', '\u0625\u062F\u0627\u0631\u064A'),\n(14, '\u0645\u062A\u0627\u0628\u0639\u0629 \u0633\u062F\u0627\u062F \u0641\u0627\u062A\u0648\u0631\u0629 \u0633\u0641\u0646\u0643\u0633', '\u0627\u0644\u0645\u062A\u0628\u0642\u064A 185 \u0623\u0644\u0641 \u062C\u0646\u064A\u0647.', NULL, 10, 9, 1, '2026-09-20', '12:00', '\u0639\u0627\u0644\u064A\u0629', '\u0645\u0641\u062A\u0648\u062D\u0629', '\u0625\u062F\u0627\u0631\u064A'),\n(15, '\u062A\u062C\u0647\u064A\u0632 \u0639\u0631\u0636 \u0623\u062A\u0639\u0627\u0628 \u0644\u0639\u0645\u064A\u0644 \u062C\u062F\u064A\u062F \u2014 \u0634\u0631\u0643\u0629 \u0645\u064A\u0631\u0643\u0627\u062A\u0648', '\u0627\u0633\u062A\u0634\u0627\u0631\u0629 \u062D\u0648\u0643\u0645\u0629 \u0634\u0631\u0643\u0627\u062A.', NULL, NULL, 2, 1, '2026-09-19', '13:00', '\u0639\u0627\u062F\u064A\u0629', '\u0645\u0641\u062A\u0648\u062D\u0629', '\u0635\u064A\u0627\u063A\u0629');\n\nINSERT OR IGNORE INTO documents (id, case_id, client_id, title, doc_type, ref_no, date_issued, pages, notes, uploaded_by) VALUES\n(1, 1, 1, '\u0639\u0642\u062F \u0627\u0644\u062A\u0648\u0631\u064A\u062F \u0627\u0644\u0645\u0624\u0631\u062E 12 \u064A\u0646\u0627\u064A\u0631 2024', '\u0639\u0642\u062F', 'ATL-2024-12', '2024-01-12', 48, '\u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0623\u0635\u0644\u064A\u0629 \u0645\u0648\u062F\u0639\u0629 \u0628\u0627\u0644\u062E\u0632\u064A\u0646\u0629', 2),\n(2, 1, 1, '\u0635\u062D\u064A\u0641\u0629 \u0627\u0644\u062F\u0639\u0648\u0649 \u0627\u0644\u0627\u0642\u062A\u0635\u0627\u062F\u064A\u0629', '\u0635\u062D\u064A\u0641\u0629', '1842/2025', '2025-03-12', 22, NULL, 2),\n(3, 2, 2, '\u0639\u0642\u062F \u0641\u064A\u062F\u064A\u0643 \u0627\u0644\u0623\u062D\u0645\u0631 \u2014 \u0627\u0644\u0639\u0627\u0635\u0645\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u064A\u0629', '\u0639\u0642\u062F', 'FIDIC-NUCA-19', '2019-04-01', 210, '\u0646\u0633\u062E\u0629 \u0645\u062A\u0631\u062C\u0645\u0629 \u0648\u0645\u0639\u062A\u0645\u062F\u0629', 1),\n(4, 2, 2, '\u0627\u0644\u0645\u0630\u0643\u0631\u0629 \u0627\u0644\u0627\u0641\u062A\u062A\u0627\u062D\u064A\u0629 \u0644\u0644\u062A\u062D\u0643\u064A\u0645', '\u0645\u0630\u0643\u0631\u0629', 'ARB-771', '2024-11-02', 86, NULL, 1),\n(5, 3, 3, '\u0623\u0635\u0644 \u0627\u0644\u0634\u064A\u0643 \u0631\u0642\u0645 441209', '\u0623\u062E\u0631\u0649', 'CHQ-441209', '2025-12-01', 1, '\u0641\u064A \u062E\u0632\u064A\u0646\u0629 \u0627\u0644\u0645\u0643\u062A\u0628', 3),\n(6, 4, 1, '\u0623\u0645\u0631 \u0627\u0644\u0625\u062D\u0627\u0644\u0629 \u0645\u0646 \u0627\u0644\u0646\u064A\u0627\u0628\u0629', '\u0623\u062E\u0631\u0649', 'PA-908-2025', '2025-06-01', 34, NULL, 3),\n(7, 4, 1, '\u0645\u0630\u0643\u0631\u0629 \u0627\u0644\u062F\u0641\u0627\u0639 \u0627\u0644\u062E\u062A\u0627\u0645\u064A\u0629', '\u0645\u0630\u0643\u0631\u0629', 'DEF-908', '2026-07-08', 64, NULL, 3),\n(8, 5, 5, '\u0639\u0642\u062F \u0627\u0644\u0632\u0648\u0627\u062C \u0648\u0635\u0648\u0631 \u0634\u0647\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u064A\u0644\u0627\u062F', '\u0623\u062E\u0631\u0649', NULL, '2016-05-20', 6, NULL, 4),\n(9, 5, 5, '\u0635\u062D\u064A\u0641\u0629 \u062F\u0639\u0648\u0649 \u0627\u0644\u0637\u0644\u0627\u0642 \u0644\u0644\u0636\u0631\u0631', '\u0635\u062D\u064A\u0641\u0629', '2104/2026', '2026-02-11', 14, NULL, 4),\n(10, 10, 9, '\u0635\u0648\u0631\u0629 \u0627\u0644\u062D\u0643\u0645 \u0628\u0627\u0644\u0637\u0631\u062F', '\u062D\u0643\u0645', '8022/2023', '2026-05-12', 9, '\u0646\u0633\u062E\u0629 \u062A\u0646\u0641\u064A\u0630\u064A\u0629', 2),\n(11, 7, 6, '\u0642\u0631\u0627\u0631\u0627\u062A \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0647\u064A\u0643\u0644\u0629', '\u0623\u062E\u0631\u0649', 'HR-2026-04', '2026-04-01', 18, NULL, 6),\n(12, NULL, 1, '\u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u062A\u062C\u0627\u0631\u064A \u0648\u0627\u0644\u062A\u0648\u0643\u064A\u0644 \u0627\u0644\u0639\u0627\u0645', '\u062A\u0648\u0643\u064A\u0644', 'POA-2014-77', '2014-02-01', 4, NULL, 8);\n\nINSERT OR IGNORE INTO powers_of_attorney (id, poa_no, client_id, case_id, lawyer_id, type, notary_office, issue_date, expiry_date, status, scope, notes) VALUES\n(1, '4412 \u0644\u0633\u0646\u0629 2024 \u062A\u0648\u062B\u064A\u0642 \u0642\u0635\u0631 \u0627\u0644\u0646\u064A\u0644', 1, NULL, 1, '\u0639\u0627\u0645 \u0642\u0636\u0627\u064A\u0627', '\u0645\u0643\u062A\u0628 \u062A\u0648\u062B\u064A\u0642 \u0642\u0635\u0631 \u0627\u0644\u0646\u064A\u0644', '2024-10-30', '2026-10-30', '\u0633\u0627\u0631\u064A', '\u0627\u0644\u062D\u0636\u0648\u0631 \u0623\u0645\u0627\u0645 \u062C\u0645\u064A\u0639 \u0627\u0644\u0645\u062D\u0627\u0643\u0645 \u0648\u0627\u0644\u0646\u064A\u0627\u0628\u0627\u062A \u0648\u0647\u064A\u0626\u0627\u062A \u0627\u0644\u062A\u062D\u0643\u064A\u0645 \u0648\u0627\u0644\u062A\u0648\u0642\u064A\u0639 \u0639\u0644\u0649 \u0627\u0644\u0645\u0630\u0643\u0631\u0627\u062A.', '\u064A\u062D\u062A\u0627\u062C \u062A\u062C\u062F\u064A\u062F \u0642\u0628\u0644 \u0646\u0647\u0627\u064A\u0629 \u0623\u0643\u062A\u0648\u0628\u0631'),\n(2, '118 \u0644\u0633\u0646\u0629 2025 \u062A\u0648\u062B\u064A\u0642 \u0627\u0644\u062C\u064A\u0632\u0629', 2, 2, 1, '\u062E\u0627\u0635', '\u0645\u0643\u062A\u0628 \u062A\u0648\u062B\u064A\u0642 \u0627\u0644\u062C\u064A\u0632\u0629', '2025-01-15', NULL, '\u0633\u0627\u0631\u064A', '\u062A\u0645\u062B\u064A\u0644 \u0627\u0644\u0634\u0631\u0643\u0629 \u0641\u064A \u062A\u062D\u0643\u064A\u0645 \u063A\u0631\u0641\u0629 \u0627\u0644\u0642\u0627\u0647\u0631\u0629 \u0631\u0642\u0645 771 \u0644\u0633\u0646\u0629 2024.', NULL),\n(3, '902 \u0644\u0633\u0646\u0629 2023 \u062A\u0648\u062B\u064A\u0642 \u0639\u0627\u0628\u062F\u064A\u0646', 3, NULL, 3, '\u0639\u0627\u0645 \u0642\u0636\u0627\u064A\u0627', '\u0645\u0643\u062A\u0628 \u062A\u0648\u062B\u064A\u0642 \u0639\u0627\u0628\u062F\u064A\u0646', '2023-06-01', '2027-06-01', '\u0633\u0627\u0631\u064A', '\u0642\u0636\u0627\u064A\u0627 \u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u062C\u0646\u0627\u0626\u064A\u0629 \u0648\u0627\u0644\u0645\u062F\u0646\u064A\u0629 \u0627\u0644\u0645\u062A\u0639\u0644\u0642\u0629 \u0628\u0627\u0644\u0634\u064A\u0643\u0627\u062A.', NULL),\n(4, '55 \u0644\u0633\u0646\u0629 2026 \u062A\u0648\u062B\u064A\u0642 \u0645\u0635\u0631 \u0627\u0644\u062C\u062F\u064A\u062F\u0629', 5, 5, 4, '\u062E\u0627\u0635', '\u0645\u0643\u062A\u0628 \u062A\u0648\u062B\u064A\u0642 \u0645\u0635\u0631 \u0627\u0644\u062C\u062F\u064A\u062F\u0629', '2026-02-08', NULL, '\u0633\u0627\u0631\u064A', '\u062F\u0639\u0648\u0649 \u0637\u0644\u0627\u0642 \u0648\u0646\u0641\u0642\u0629 \u0648\u062D\u0636\u0627\u0646\u0629 \u0641\u0642\u0637.', NULL),\n(5, '210 \u0644\u0633\u0646\u0629 2025 \u062A\u0648\u062B\u064A\u0642 \u0627\u0644\u0632\u0645\u0627\u0644\u0643', 4, 6, 4, '\u0639\u0627\u0645 \u0642\u0636\u0627\u064A\u0627', '\u0645\u0643\u062A\u0628 \u062A\u0648\u062B\u064A\u0642 \u0627\u0644\u0632\u0645\u0627\u0644\u0643', '2025-08-20', '2028-08-20', '\u0633\u0627\u0631\u064A', '\u0627\u0644\u0642\u0633\u0645\u0629 \u0627\u0644\u0639\u0642\u0627\u0631\u064A\u0629 \u0648\u0645\u0627 \u064A\u062A\u0641\u0631\u0639 \u0639\u0646\u0647\u0627.', NULL),\n(6, '77 \u0644\u0633\u0646\u0629 2022 \u062A\u0648\u062B\u064A\u0642 \u0627\u0644\u0645\u0647\u0646\u062F\u0633\u064A\u0646', 10, 9, 5, '\u0631\u0633\u0645\u064A \u0639\u0627\u0645', '\u0645\u0643\u062A\u0628 \u062A\u0648\u062B\u064A\u0642 \u0627\u0644\u0645\u0647\u0646\u062F\u0633\u064A\u0646', '2022-03-11', '2026-03-11', '\u0645\u0646\u062A\u0647\u064D', '\u062A\u0645\u062B\u064A\u0644 \u0627\u0644\u0634\u0631\u0643\u0629 \u0623\u0645\u0627\u0645 \u0645\u062C\u0644\u0633 \u0627\u0644\u062F\u0648\u0644\u0629.', '\u064A\u062D\u062A\u0627\u062C \u062A\u062C\u062F\u064A\u062F \u0641\u0648\u0631\u064A'),\n(7, '330 \u0644\u0633\u0646\u0629 2024 \u062A\u0648\u062B\u064A\u0642 \u0627\u0644\u0645\u062D\u0644\u0629', 6, 7, 6, '\u0639\u0627\u0645 \u0642\u0636\u0627\u064A\u0627', '\u0645\u0643\u062A\u0628 \u062A\u0648\u062B\u064A\u0642 \u0627\u0644\u0645\u062D\u0644\u0629 \u0627\u0644\u0643\u0628\u0631\u0649', '2024-12-01', '2027-12-01', '\u0633\u0627\u0631\u064A', '\u0627\u0644\u062F\u0639\u0627\u0648\u0649 \u0627\u0644\u0639\u0645\u0627\u0644\u064A\u0629.', NULL),\n(8, '12 \u0644\u0633\u0646\u0629 2021 \u062A\u0648\u062B\u064A\u0642 \u0642\u0635\u0631 \u0627\u0644\u0646\u064A\u0644', 1, NULL, 2, '\u0631\u0633\u0645\u064A \u0639\u0627\u0645', '\u0645\u0643\u062A\u0628 \u062A\u0648\u062B\u064A\u0642 \u0642\u0635\u0631 \u0627\u0644\u0646\u064A\u0644', '2021-01-10', '2024-01-10', '\u0645\u0644\u063A\u0649', '\u0623\u064F\u0644\u063A\u064A \u0628\u0639\u062F \u0635\u062F\u0648\u0631 \u062A\u0648\u0643\u064A\u0644 2024.', NULL);\n\nINSERT OR IGNORE INTO invoices (id, invoice_no, client_id, case_id, issue_date, due_date, subtotal, tax, discount, total, paid, status, notes, created_by) VALUES\n(1, 'INV-2026-014', 1, 4, '2026-07-15', '2026-08-15', 850000, 119000, 0, 969000, 969000, '\u0645\u0633\u062F\u062F\u0629', '\u0623\u062A\u0639\u0627\u0628 \u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u062C\u0646\u0627\u064A\u0627\u062A \u062D\u062A\u0649 \u0627\u0644\u0645\u0631\u0627\u0641\u0639\u0629 \u0627\u0644\u062E\u062A\u0627\u0645\u064A\u0629', 9),\n(2, 'INV-2026-018', 2, 2, '2026-08-01', '2026-09-01', 420000, 58800, 20000, 458800, 250000, '\u062C\u0632\u0626\u064A', '\u0634\u0631\u064A\u062D\u0629 \u0627\u0644\u062A\u062D\u0643\u064A\u0645 \u0627\u0644\u062B\u0627\u0644\u062B\u0629', 9),\n(3, 'INV-2026-021', 10, 9, '2026-08-20', '2026-09-20', 180000, 25200, 0, 205200, 20000, '\u0645\u062A\u0623\u062E\u0631\u0629', '\u0623\u062A\u0639\u0627\u0628 \u0645\u062C\u0644\u0633 \u0627\u0644\u062F\u0648\u0644\u0629 \u2014 \u0627\u0644\u0631\u0628\u0639 \u0627\u0644\u062B\u0627\u0644\u062B', 9),\n(4, 'INV-2026-022', 5, 5, '2026-09-01', '2026-09-30', 45000, 0, 0, 45000, 45000, '\u0645\u0633\u062F\u062F\u0629', '\u0623\u062A\u0639\u0627\u0628 \u0627\u0641\u062A\u062A\u0627\u062D \u062F\u0639\u0648\u0649 \u0627\u0644\u0623\u0633\u0631\u0629', 9),\n(5, 'INV-2026-023', 7, 8, '2026-09-05', '2026-10-05', 110000, 15400, 0, 125400, 0, '\u0635\u0627\u062F\u0631\u0629', '\u0623\u062A\u0639\u0627\u0628 \u0627\u0644\u062E\u0628\u0631\u0629 \u0648\u0627\u0644\u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629', 9),\n(6, 'INV-2026-024', 6, 7, '2026-09-10', '2026-10-10', 75000, 10500, 0, 85500, 0, '\u0635\u0627\u062F\u0631\u0629', '\u0623\u062A\u0639\u0627\u0628 \u0627\u0644\u062F\u0639\u0627\u0648\u0649 \u0627\u0644\u0639\u0645\u0627\u0644\u064A\u0629 \u2014 \u0633\u0628\u062A\u0645\u0628\u0631', 9),\n(7, 'INV-2026-025', 3, 3, '2026-09-12', '2026-10-12', 28000, 3920, 0, 31920, 0, '\u0645\u0633\u0648\u062F\u0629', '\u062C\u0646\u062D\u0629 \u0627\u0644\u0634\u064A\u0643 \u2014 \u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u062A\u062D\u0642\u064A\u0642', 9),\n(8, 'INV-2025-088', 9, 10, '2026-05-20', '2026-06-20', 35000, 0, 5000, 30000, 30000, '\u0645\u0633\u062F\u062F\u0629', '\u0623\u062A\u0639\u0627\u0628 \u0627\u0644\u0637\u0631\u062F \u0648\u0627\u0644\u062A\u0646\u0641\u064A\u0630', 9);\n\nINSERT OR IGNORE INTO invoice_items (id, invoice_id, description, qty, unit_price, amount) VALUES\n(1, 1, '\u0623\u062A\u0639\u0627\u0628 \u0627\u0644\u0645\u0631\u0627\u0641\u0639\u0629 \u0623\u0645\u0627\u0645 \u062C\u0646\u0627\u064A\u0627\u062A \u0627\u0644\u0623\u0645\u0648\u0627\u0644 \u0627\u0644\u0639\u0627\u0645\u0629', 1, 700000, 700000),\n(2, 1, '\u0633\u0627\u0639\u0627\u062A \u0628\u062D\u062B \u0642\u0627\u0646\u0648\u0646\u064A (40 \u0633\u0627\u0639\u0629)', 40, 3750, 150000),\n(3, 2, '\u0634\u0631\u064A\u062D\u0629 \u062A\u062D\u0643\u064A\u0645 \u2014 \u0627\u0644\u0645\u0631\u0627\u0641\u0639\u0629 \u0627\u0644\u062E\u062A\u0627\u0645\u064A\u0629', 1, 350000, 350000),\n(4, 2, '\u0623\u062A\u0639\u0627\u0628 \u0627\u0644\u062E\u0628\u064A\u0631 \u0627\u0644\u0627\u0633\u062A\u0634\u0627\u0631\u064A (\u0625\u0639\u0627\u062F\u0629 \u062A\u062D\u0645\u064A\u0644)', 1, 70000, 70000),\n(5, 3, '\u0623\u062A\u0639\u0627\u0628 \u0631\u0628\u0639 \u0633\u0646\u0648\u064A\u0629 \u2014 \u0642\u0636\u0627\u0621 \u0625\u062F\u0627\u0631\u064A', 1, 180000, 180000),\n(6, 4, '\u0623\u062A\u0639\u0627\u0628 \u0627\u0641\u062A\u062A\u0627\u062D \u062F\u0639\u0648\u0649 \u0637\u0644\u0627\u0642 \u0648\u0646\u0641\u0642\u0629', 1, 45000, 45000),\n(7, 5, '\u0623\u062A\u0639\u0627\u0628 \u0627\u0644\u0645\u0631\u062D\u0644\u0629 \u062D\u062A\u0649 \u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u062E\u0628\u0631\u0629', 1, 110000, 110000),\n(8, 6, '\u0623\u062A\u0639\u0627\u0628 \u062A\u0645\u062B\u064A\u0644 \u0641\u064A 42 \u062F\u0639\u0648\u0649 \u0639\u0645\u0627\u0644\u064A\u0629 \u2014 \u0633\u0628\u062A\u0645\u0628\u0631', 1, 75000, 75000),\n(9, 7, '\u0623\u062A\u0639\u0627\u0628 \u062D\u0636\u0648\u0631 \u0648\u062A\u062D\u0642\u064A\u0642 \u062C\u0646\u062D\u0629 \u0634\u064A\u0643', 1, 28000, 28000),\n(10, 8, '\u0623\u062A\u0639\u0627\u0628 \u062F\u0639\u0648\u0649 \u0627\u0644\u0637\u0631\u062F \u0648\u0627\u0644\u062A\u0646\u0641\u064A\u0630', 1, 35000, 35000);\n\nINSERT OR IGNORE INTO payments (id, invoice_id, client_id, amount, method, paid_at, reference, notes, received_by) VALUES\n(1, 1, 1, 969000, '\u062A\u062D\u0648\u064A\u0644', '2026-08-02', 'TRX-NILE-88021', '\u0633\u062F\u0627\u062F \u0643\u0627\u0645\u0644', 9),\n(2, 2, 2, 250000, '\u0634\u064A\u0643', '2026-08-18', 'CHQ-44190', '\u062F\u0641\u0639\u0629 \u0623\u0648\u0644\u0649', 9),\n(3, 3, 10, 20000, '\u062A\u062D\u0648\u064A\u0644', '2026-08-28', 'TRX-SPH-1022', '\u062F\u0641\u0639\u0629 \u0631\u0645\u0632\u064A\u0629', 9),\n(4, 4, 5, 45000, '\u0646\u0642\u062F\u064A', '2026-09-01', NULL, '\u0633\u062F\u0627\u062F \u0628\u0645\u0642\u0631 \u0627\u0644\u0645\u0643\u062A\u0628', 8),\n(5, 8, 9, 30000, '\u062A\u062D\u0648\u064A\u0644', '2026-06-01', 'TRX-DK-55', NULL, 9);\n\nINSERT OR IGNORE INTO expenses (id, case_id, title, category, amount, expense_date, billable, billed, vendor, notes, created_by) VALUES\n(1, 1, '\u0631\u0633\u0648\u0645 \u0625\u064A\u062F\u0627\u0639 \u0635\u062D\u064A\u0641\u0629 \u0627\u0642\u062A\u0635\u0627\u062F\u064A\u0629', '\u0631\u0633\u0648\u0645 \u0645\u062D\u0643\u0645\u0629', 12500, '2025-03-12', 1, 1, '\u0645\u062D\u0643\u0645\u0629 \u0627\u0642\u062A\u0635\u0627\u062F\u064A \u0627\u0644\u0642\u0627\u0647\u0631\u0629', NULL, 9),\n(2, 2, '\u0631\u0633\u0648\u0645 \u063A\u0631\u0641\u0629 \u0627\u0644\u062A\u062D\u0643\u064A\u0645 \u2014 \u0627\u0644\u0634\u0631\u064A\u062D\u0629 \u0627\u0644\u062B\u0627\u0644\u062B\u0629', '\u0631\u0633\u0648\u0645 \u0645\u062D\u0643\u0645\u0629', 85000, '2026-08-01', 1, 1, 'CRCICA', NULL, 9),\n(3, 5, '\u0625\u0639\u0644\u0627\u0646 \u0639\u0644\u0649 \u064A\u062F \u0645\u062D\u0636\u0631', '\u0625\u0639\u0644\u0627\u0646\u0627\u062A', 850, '2026-02-15', 1, 1, '\u0642\u0644\u0645 \u0627\u0644\u0645\u062D\u0636\u0631\u064A\u0646', NULL, 8),\n(4, 8, '\u0623\u062A\u0639\u0627\u0628 \u062E\u0628\u064A\u0631 \u0647\u0646\u062F\u0633\u064A \u0627\u0633\u062A\u0634\u0627\u0631\u064A', '\u062E\u0628\u0631\u0629', 18000, '2026-07-10', 1, 0, '\u0645. \u0643\u0645\u0627\u0644 \u0639\u0628\u062F\u0627\u0644\u0646\u0648\u0631', '\u0644\u0645 \u062A\u064F\u0631\u062D\u0651\u064E\u0644 \u0628\u0639\u062F \u0639\u0644\u0649 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629', 9),\n(5, 4, '\u062A\u0635\u0648\u064A\u0631 \u0648\u062A\u062C\u0644\u064A\u062F \u062D\u0648\u0627\u0641\u0638 \u0627\u0644\u062C\u0646\u0627\u064A\u0627\u062A', '\u062A\u0635\u0648\u064A\u0631', 2400, '2026-07-05', 1, 1, '\u0645\u0631\u0643\u0632 \u0627\u0644\u0646\u064A\u0644 \u0644\u0644\u062A\u0635\u0648\u064A\u0631', NULL, 8),\n(6, 2, '\u062A\u0631\u062C\u0645\u0629 \u0645\u0639\u062A\u0645\u062F\u0629 \u0644\u0639\u0642\u062F \u0641\u064A\u062F\u064A\u0643', '\u062A\u0631\u062C\u0645\u0629', 14500, '2024-10-20', 1, 1, '\u0645\u0643\u062A\u0628 \u0623\u0644\u0633\u0646 \u0627\u0644\u0645\u0639\u062A\u0645\u062F', NULL, 9),\n(7, NULL, '\u0627\u0646\u062A\u0642\u0627\u0644\u0627\u062A \u0623\u0633\u0628\u0648\u0639 14 \u0633\u0628\u062A\u0645\u0628\u0631', '\u0627\u0646\u062A\u0642\u0627\u0644\u0627\u062A', 3200, '2026-09-14', 0, 0, '\u0633\u0627\u0626\u0642 \u0627\u0644\u0645\u0643\u062A\u0628', '\u063A\u064A\u0631 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u062A\u0631\u062D\u064A\u0644', 8),\n(8, 7, '\u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0643\u0634\u0648\u0641 \u062A\u0623\u0645\u064A\u0646\u0627\u062A', '\u0623\u062E\u0631\u0649', 600, '2026-09-08', 1, 0, '\u0627\u0644\u062A\u0623\u0645\u064A\u0646\u0627\u062A \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639\u064A\u0629', NULL, 6);\n\nINSERT OR IGNORE INTO time_entries (id, user_id, case_id, work_date, hours, description, billable, billed, rate) VALUES\n(1, 2, 1, '2026-09-16', 4.5, '\u0635\u064A\u0627\u063A\u0629 \u0645\u0630\u0643\u0631\u0629 \u0627\u0644\u062A\u0639\u0642\u064A\u0628 \u2014 \u0627\u0644\u062F\u0641\u0639 \u0628\u0639\u062F\u0645 \u0627\u0644\u0627\u062E\u062A\u0635\u0627\u0635', 1, 0, 3800),\n(2, 1, 2, '2026-09-15', 6.0, '\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0645\u0630\u0643\u0631\u0629 \u0627\u0644\u062E\u062A\u0627\u0645\u064A\u0629 \u0644\u0644\u062A\u062D\u0643\u064A\u0645', 1, 0, 4500),\n(3, 3, 4, '2026-09-14', 3.0, '\u062A\u062D\u0636\u064A\u0631 \u0646\u0642\u0627\u0637 \u0627\u0644\u0645\u0631\u0627\u0641\u0639\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629', 1, 1, 3200),\n(4, 4, 5, '2026-09-13', 2.0, '\u0645\u0631\u0627\u062C\u0639\u0629 \u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0623\u062E\u0635\u0627\u0626\u064A \u0648\u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0645\u0648\u0643\u0644\u0629', 1, 0, 2200),\n(5, 6, 7, '2026-09-12', 5.0, '\u062C\u0631\u062F \u0645\u0644\u0641\u0627\u062A \u0627\u0644\u0639\u0645\u0627\u0644 \u0648\u0645\u0637\u0627\u0628\u0642\u0629 \u0627\u0644\u062A\u0623\u0645\u064A\u0646\u0627\u062A', 1, 0, 1500),\n(6, 2, 8, '2026-09-11', 3.5, '\u062F\u0631\u0627\u0633\u0629 \u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u062E\u0628\u0631\u0629 \u0627\u0644\u0647\u0646\u062F\u0633\u064A\u0629', 1, 0, 3800),\n(7, 5, 9, '2026-09-10', 2.5, '\u0645\u0630\u0643\u0631\u0629 \u062A\u0639\u0642\u064A\u0628 \u0623\u062E\u064A\u0631\u0629 \u0623\u0645\u0627\u0645 \u0627\u0644\u0642\u0636\u0627\u0621 \u0627\u0644\u0625\u062F\u0627\u0631\u064A', 1, 1, 1800),\n(8, 7, 1, '2026-09-16', 3.0, '\u062A\u062C\u0647\u064A\u0632 \u062D\u0627\u0641\u0638\u0629 \u0627\u0644\u0645\u0633\u062A\u0646\u062F\u0627\u062A \u0648\u062A\u0635\u0648\u064A\u0631\u0647\u0627', 0, 0, 400),\n(9, 1, 12, '2026-09-11', 4.0, '\u0625\u0639\u062F\u0627\u062F \u0627\u0644\u0645\u0631\u0627\u0641\u0639\u0629 \u0627\u0644\u0627\u0633\u062A\u0626\u0646\u0627\u0641\u064A\u0629', 1, 0, 4500),\n(10, 3, 3, '2026-09-16', 1.5, '\u0645\u0631\u0627\u062C\u0639\u0629 \u0645\u0644\u0641 \u0627\u0644\u0634\u064A\u0643 \u0642\u0628\u0644 \u062C\u0644\u0633\u0629 \u0627\u0644\u063A\u062F', 1, 0, 3200);\n\nINSERT OR IGNORE INTO contracts (id, title, client_id, type, start_date, end_date, value, status, notes) VALUES\n(1, '\u0627\u062A\u0641\u0627\u0642\u064A\u0629 \u0623\u062A\u0639\u0627\u0628 \u0633\u0646\u0648\u064A\u0629 \u2014 \u0645\u062C\u0645\u0648\u0639\u0629 \u0627\u0644\u0646\u064A\u0644 \u0627\u0644\u0642\u0627\u0628\u0636\u0629', 1, '\u0623\u062A\u0639\u0627\u0628', '2026-01-01', '2026-12-31', 2400000, '\u0633\u0627\u0631\u064A', '\u0634\u0631\u0627\u0626\u062D \u0631\u0628\u0639 \u0633\u0646\u0648\u064A\u0629 + \u0623\u062A\u0639\u0627\u0628 \u0646\u062C\u0627\u062D \u0641\u064A \u0627\u0644\u062A\u062D\u0643\u064A\u0645'),\n(2, '\u0627\u062A\u0641\u0627\u0642\u064A\u0629 \u062A\u062D\u0643\u064A\u0645 \u2014 \u0627\u0644\u0634\u0631\u0642 \u0644\u0644\u0625\u0646\u0634\u0627\u0621\u0627\u062A', 2, '\u0623\u062A\u0639\u0627\u0628', '2024-11-01', '2027-11-01', 1800000, '\u0633\u0627\u0631\u064A', '\u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u0642\u0636\u064A\u0629 CRCICA 771'),\n(3, '\u0639\u0642\u062F \u0627\u0633\u062A\u0634\u0627\u0631\u0629 \u0642\u0627\u0646\u0648\u0646\u064A\u0629 \u2014 \u0628\u0646\u0643 \u0627\u0644\u062F\u0644\u062A\u0627', 3, '\u0627\u0633\u062A\u0634\u0627\u0631\u0629', '2025-01-01', '2026-12-31', 480000, '\u0633\u0627\u0631\u064A', '\u0642\u0636\u0627\u064A\u0627 \u0627\u0644\u0634\u064A\u0643\u0627\u062A \u0641\u0642\u0637 \u2014 \u062E\u0627\u0631\u062C \u0646\u0637\u0627\u0642 \u0627\u0644\u0627\u0626\u062A\u0645\u0627\u0646'),\n(4, '\u0627\u062A\u0641\u0627\u0642 \u0623\u062A\u0639\u0627\u0628 \u0623\u0633\u0631\u0629 \u2014 \u0647\u0627\u0644\u0629 \u0627\u0644\u0634\u0631\u064A\u0641', 5, '\u0623\u062A\u0639\u0627\u0628', '2026-02-08', NULL, 90000, '\u0633\u0627\u0631\u064A', '\u0645\u0631\u062D\u0644\u062A\u0627\u0646: \u0627\u0628\u062A\u062F\u0627\u0626\u064A \u062B\u0645 \u0627\u0633\u062A\u0626\u0646\u0627\u0641 \u0625\u0646 \u0644\u0632\u0645'),\n(5, '\u0639\u0642\u062F \u0625\u062F\u0627\u0631\u0629 \u0641\u0646\u062F\u0642 \u2014 \u0633\u0641\u0646\u0643\u0633 (\u0645\u0631\u0627\u062C\u0639\u0629)', 10, '\u0623\u062E\u0631\u0649', '2023-06-01', '2028-06-01', 0, '\u0633\u0627\u0631\u064A', '\u0646\u062D\u0646 \u0627\u0644\u0645\u0633\u062A\u0634\u0627\u0631 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A \u0644\u0644\u0637\u0631\u0641 \u0627\u0644\u0623\u0648\u0644');\n\nINSERT OR IGNORE INTO notes (id, case_id, client_id, user_id, content, pinned) VALUES\n(1, 2, 2, 1, '\u0647\u064A\u0626\u0629 \u0627\u0644\u062A\u062D\u0643\u064A\u0645 \u062A\u0645\u064A\u0644 \u0644\u0642\u0628\u0648\u0644 \u0645\u0637\u0627\u0644\u0628\u0629 \u062A\u0645\u062F\u064A\u062F \u0627\u0644\u0645\u062F\u0629. \u0646\u0631\u0643\u0651\u0632 \u0627\u0644\u0645\u0631\u0627\u0641\u0639\u0629 \u0627\u0644\u062E\u062A\u0627\u0645\u064A\u0629 \u0639\u0644\u0649 \u0628\u0646\u0648\u062F 8.4 \u064820.1 \u0645\u0646 \u0627\u0644\u0641\u064A\u062F\u064A\u0643.', 1),\n(2, 4, 1, 3, '\u0627\u0644\u0634\u0627\u0647\u062F \u0627\u0644\u062B\u0627\u0646\u064A \u0644\u0644\u0646\u064A\u0627\u0628\u0629 \u062A\u0636\u0627\u0631\u0628 \u0641\u064A \u0623\u0642\u0648\u0627\u0644\u0647 \u0628\u062A\u0627\u0631\u064A\u062E 8 \u064A\u0648\u0644\u064A\u0648. \u0646\u0639\u064A\u062F \u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0645\u062D\u0636\u0631 \u0642\u0628\u0644 \u0627\u0644\u0646\u0637\u0642.', 1),\n(3, 5, 5, 4, '\u0627\u0644\u0645\u0648\u0643\u0644\u0629 \u062A\u0631\u0641\u0636 \u0627\u0644\u0639\u0631\u0636 \u0627\u0644\u0645\u0627\u0644\u064A \u0627\u0644\u062D\u0627\u0644\u064A (8 \u0622\u0644\u0627\u0641 \u0646\u0641\u0642\u0629). \u0646\u0637\u0644\u0628 14 \u0623\u0644\u0641\u0627\u064B \u0645\u0639 \u0627\u0633\u062A\u0645\u0631\u0627\u0631 \u0645\u0633\u0643\u0646 \u0627\u0644\u062D\u0636\u0627\u0646\u0629.', 0),\n(4, 1, 1, 2, '\u062E\u0635\u0645 \u0623\u0637\u0644\u0633 \u062F\u0641\u0639 \u0628\u0639\u062F\u0645 \u0627\u062E\u062A\u0635\u0627\u0635 \u0627\u0644\u0627\u0642\u062A\u0635\u0627\u062F\u064A. \u0627\u0644\u0633\u0648\u0627\u0628\u0642 \u0645\u0639\u0646\u0627 \u2014 \u0639\u0642\u062F \u062A\u0648\u0631\u064A\u062F \u062A\u062C\u0627\u0631\u064A \u0628\u062D\u062A.', 0),\n(5, NULL, 1, 1, '\u0627\u062C\u062A\u0645\u0627\u0639 \u0631\u0628\u0639 \u0633\u0646\u0648\u064A \u0645\u0639 \u0627\u0644\u0639\u0636\u0648 \u0627\u0644\u0645\u0646\u062A\u062F\u0628 \u0644\u0645\u062C\u0645\u0648\u0639\u0629 \u0627\u0644\u0646\u064A\u0644 \u064A\u0648\u0645 29 \u0633\u0628\u062A\u0645\u0628\u0631 \u0627\u0644\u0633\u0627\u0639\u0629 5 \u0645\u0633\u0627\u0621\u064B \u0641\u064A \u0646\u0627\u064A\u0644 \u0633\u064A\u062A\u064A.', 1);\n\nINSERT OR IGNORE INTO activities (id, user_id, entity_type, entity_id, action, detail, created_at) VALUES\n(1, 2, 'case', 1, '\u062A\u062D\u062F\u064A\u062B', '\u0623\u064F\u0636\u064A\u0641\u062A \u062D\u0627\u0641\u0638\u0629 \u0645\u0633\u062A\u0646\u062F\u0627\u062A \u062C\u062F\u064A\u062F\u0629 \u0648\u0623\u064F\u0639\u062F\u0651\u062A \u0645\u0633\u0648\u062F\u0629 \u0627\u0644\u062A\u0639\u0642\u064A\u0628', '2026-09-16 18:12:00'),\n(2, 1, 'hearing', 2, '\u062C\u062F\u0648\u0644\u0629', '\u062A\u0623\u0643\u064A\u062F \u062C\u0644\u0633\u0629 \u0627\u0644\u0645\u0631\u0627\u0641\u0639\u0629 \u0627\u0644\u062E\u062A\u0627\u0645\u064A\u0629 \u0641\u064A CRCICA', '2026-09-15 11:40:00'),\n(3, 8, 'poa', 1, '\u062A\u0646\u0628\u064A\u0647', '\u062A\u0648\u0643\u064A\u0644 \u0645\u062C\u0645\u0648\u0639\u0629 \u0627\u0644\u0646\u064A\u0644 \u064A\u0646\u062A\u0647\u064A \u062E\u0644\u0627\u0644 43 \u064A\u0648\u0645\u0627\u064B', '2026-09-16 09:00:00'),\n(4, 9, 'invoice', 3, '\u062A\u062D\u0635\u064A\u0644', '\u0633\u062F\u0627\u062F \u062C\u0632\u0626\u064A 20,000 \u062C\u0646\u064A\u0647 \u0645\u0646 \u0633\u0641\u0646\u0643\u0633', '2026-08-28 14:22:00'),\n(5, 3, 'hearing', 3, '\u062A\u062D\u0636\u064A\u0631', '\u0645\u0644\u0641 \u062C\u0646\u062D\u0629 \u0627\u0644\u0634\u064A\u0643 \u062C\u0627\u0647\u0632 \u0644\u062C\u0644\u0633\u0629 \u0627\u0644\u064A\u0648\u0645', '2026-09-16 19:05:00'),\n(6, 4, 'case', 5, '\u0645\u0644\u0627\u062D\u0638\u0629', '\u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0623\u062E\u0635\u0627\u0626\u064A \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639\u064A \u0648\u0635\u0644 \u0644\u0644\u0645\u0643\u062A\u0628', '2026-09-14 16:30:00'),\n(7, 6, 'task', 6, '\u0628\u062F\u0621', '\u0628\u062F\u0623 \u062C\u0631\u062F \u0643\u0634\u0648\u0641 \u0627\u0644\u062A\u0623\u0645\u064A\u0646\u0627\u062A', '2026-09-12 10:15:00'),\n(8, 1, 'client', 1, '\u0627\u062C\u062A\u0645\u0627\u0639', '\u0627\u062A\u0635\u0627\u0644 \u0645\u0639 \u0627\u0644\u0639\u0636\u0648 \u0627\u0644\u0645\u0646\u062A\u062F\u0628 \u0628\u062E\u0635\u0648\u0635 \u0642\u0636\u064A\u0629 \u0627\u0644\u0623\u0645\u0648\u0627\u0644 \u0627\u0644\u0639\u0627\u0645\u0629', '2026-09-13 17:00:00'),\n(9, 5, 'hearing', 11, '\u0646\u062A\u064A\u062C\u0629', '\u062D\u064F\u062C\u0632\u062A \u062F\u0639\u0648\u0649 \u0633\u0641\u0646\u0643\u0633 \u0627\u0644\u0625\u062F\u0627\u0631\u064A\u0629 \u0644\u0644\u062D\u0643\u0645', '2026-08-12 12:10:00'),\n(10, 2, 'case', 10, '\u0625\u063A\u0644\u0627\u0642', '\u062A\u0646\u0641\u064A\u0630 \u062D\u0643\u0645 \u0627\u0644\u0637\u0631\u062F \u0648\u0627\u0633\u062A\u0644\u0627\u0645 \u0627\u0644\u0634\u0642\u0629', '2026-06-18 13:00:00');\n\nINSERT OR IGNORE INTO reminders (id, user_id, title, remind_at, case_id, is_done) VALUES\n(1, 3, '\u062C\u0644\u0633\u0629 \u062C\u0646\u062D \u0642\u0635\u0631 \u0627\u0644\u0646\u064A\u0644 \u2014 \u0623\u0635\u0644 \u0627\u0644\u0634\u064A\u0643', '2026-09-17 08:00', 3, 0),\n(2, 4, '\u0623\u0633\u0631\u0629 \u0645\u0635\u0631 \u0627\u0644\u062C\u062F\u064A\u062F\u0629 \u2014 \u063A\u062F\u0627\u064B 11:30', '2026-09-18 08:00', 5, 0),\n(3, 1, '\u062A\u062C\u062F\u064A\u062F \u062A\u0648\u0643\u064A\u0644 \u0627\u0644\u0646\u064A\u0644 \u0627\u0644\u0642\u0627\u0628\u0636\u0629', '2026-10-10 09:00', 1, 0),\n(4, 2, '\u062A\u0633\u0644\u064A\u0645 \u062A\u0639\u0642\u064A\u0628 \u0623\u0637\u0644\u0633', '2026-09-19 16:00', 1, 0),\n(5, 9, '\u0645\u062A\u0627\u0628\u0639\u0629 \u062A\u062D\u0635\u064A\u0644 \u0641\u0627\u062A\u0648\u0631\u0629 \u0633\u0641\u0646\u0643\u0633 \u0627\u0644\u0645\u062A\u0623\u062E\u0631\u0629', '2026-09-20 10:00', 9, 0);\n";

// src/db/seed.ts
async function seedDatabase(client, force = false) {
  try {
    if (!force) {
      const checkResult2 = await client.execute("SELECT COUNT(*) as count FROM case_types;");
      const count2 = Number(checkResult2.rows[0]?.count || 0);
      if (count2 > 0) {
        return { seeded: false, count: count2 };
      }
    }
    await client.executeMultiple(SEED_SQL);
    const checkResult = await client.execute("SELECT COUNT(*) as count FROM case_types;");
    const count = Number(checkResult.rows[0]?.count || 0);
    return { seeded: true, count };
  } catch (err) {
    console.error("Error seeding database:", err);
    throw err;
  }
}

// src/db/migrations.ts
async function runMigrations(client) {
  try {
    await client.executeMultiple(SCHEMA_SQL);
    const columnsAdded = [];
    const docColsRes = await client.execute(`PRAGMA table_info(documents);`);
    const docCols = new Set(docColsRes.rows.map((r) => String(r.name).toLowerCase()));
    const requiredDocCols = [
      { name: "file_url", type: "TEXT" },
      { name: "file_name", type: "TEXT" },
      { name: "file_size", type: "INTEGER" },
      { name: "mime_type", type: "TEXT" },
      { name: "storage_key", type: "TEXT" }
    ];
    for (const col of requiredDocCols) {
      if (!docCols.has(col.name)) {
        await client.execute(`ALTER TABLE documents ADD COLUMN ${col.name} ${col.type};`);
        columnsAdded.push(`documents.${col.name}`);
      }
    }
    const poaColsRes = await client.execute(`PRAGMA table_info(powers_of_attorney);`);
    const poaCols = new Set(poaColsRes.rows.map((r) => String(r.name).toLowerCase()));
    const requiredPoaCols = [
      { name: "file_url", type: "TEXT" },
      { name: "file_name", type: "TEXT" },
      { name: "file_size", type: "INTEGER" },
      { name: "mime_type", type: "TEXT" },
      { name: "storage_key", type: "TEXT" }
    ];
    let poaUpdated = false;
    for (const col of requiredPoaCols) {
      if (!poaCols.has(col.name)) {
        await client.execute(`ALTER TABLE powers_of_attorney ADD COLUMN ${col.name} ${col.type};`);
        columnsAdded.push(`powers_of_attorney.${col.name}`);
        poaUpdated = true;
      }
    }
    if (poaUpdated) {
      await client.executeMultiple(`
        DROP TRIGGER IF EXISTS trg_poas_insert;
        DROP TRIGGER IF EXISTS trg_poas_update;
        DROP TRIGGER IF EXISTS trg_poas_delete;
        DROP VIEW IF EXISTS poas;

        CREATE VIEW IF NOT EXISTS poas AS SELECT * FROM powers_of_attorney;

        CREATE TRIGGER IF NOT EXISTS trg_poas_insert INSTEAD OF INSERT ON poas
        BEGIN
          INSERT INTO powers_of_attorney (id, poa_no, client_id, case_id, lawyer_id, type, notary_office, issue_date, expiry_date, status, scope, notes, file_url, file_name, file_size, mime_type, storage_key, created_at)
          VALUES (new.id, new.poa_no, new.client_id, new.case_id, new.lawyer_id, new.type, new.notary_office, new.issue_date, new.expiry_date, new.status, new.scope, new.notes, new.file_url, new.file_name, new.file_size, new.mime_type, new.storage_key, coalesce(new.created_at, datetime('now')));
        END;

        CREATE TRIGGER IF NOT EXISTS trg_poas_update INSTEAD OF UPDATE ON poas
        BEGIN
          UPDATE powers_of_attorney SET
            poa_no = new.poa_no,
            client_id = new.client_id,
            case_id = new.case_id,
            lawyer_id = new.lawyer_id,
            type = new.type,
            notary_office = new.notary_office,
            issue_date = new.issue_date,
            expiry_date = new.expiry_date,
            status = new.status,
            scope = new.scope,
            notes = new.notes,
            file_url = new.file_url,
            file_name = new.file_name,
            file_size = new.file_size,
            mime_type = new.mime_type,
            storage_key = new.storage_key
          WHERE id = old.id;
        END;

        CREATE TRIGGER IF NOT EXISTS trg_poas_delete INSTEAD OF DELETE ON poas
        BEGIN
          DELETE FROM powers_of_attorney WHERE id = old.id;
        END;
      `);
    }
    const tableResult = await client.execute(
      `SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name;`
    );
    const tablesCreated = tableResult.rows.map((r) => String(r.name));
    const indexResult = await client.execute(
      `SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name;`
    );
    const indexesCreated = indexResult.rows.map((r) => String(r.name));
    return {
      success: true,
      tablesCreated,
      indexesCreated,
      columnsAdded,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch (err) {
    console.error("Migration failed:", err);
    throw err;
  }
}

// src/db/adapter.ts
var LibSqlPreparedStatement = class _LibSqlPreparedStatement {
  sql;
  binds = [];
  client;
  constructor(client, sql, binds = []) {
    this.client = client;
    this.sql = sql;
    this.binds = binds;
  }
  bind(...args) {
    const sanitized = args.map((a) => a === void 0 ? null : a);
    return new _LibSqlPreparedStatement(this.client, this.sql, sanitized);
  }
  async first(colName) {
    const res = await this.client.execute({ sql: this.sql, args: this.binds });
    const row = res.rows[0];
    if (!row) return null;
    if (colName) {
      return row[colName] ?? null;
    }
    return row;
  }
  async all() {
    const res = await this.client.execute({ sql: this.sql, args: this.binds });
    return {
      results: res.rows || [],
      success: true,
      meta: {
        changes: Number(res.rowsAffected || 0),
        last_row_id: Number(res.lastInsertRowid !== void 0 ? res.lastInsertRowid : 0)
      }
    };
  }
  async run() {
    const res = await this.client.execute({ sql: this.sql, args: this.binds });
    return {
      success: true,
      meta: {
        last_row_id: Number(res.lastInsertRowid !== void 0 ? res.lastInsertRowid : 0),
        changes: Number(res.rowsAffected || 0)
      }
    };
  }
};
var LibSqlD1Adapter = class {
  client;
  constructor(client) {
    this.client = client;
  }
  prepare(sql) {
    return new LibSqlPreparedStatement(this.client, sql);
  }
  async batch(statements) {
    const stmts = statements.map((s) => ({
      sql: s.sql,
      args: s.binds || []
    }));
    const results = await this.client.batch(stmts, "write");
    return results.map((r) => ({
      success: true,
      meta: {
        last_row_id: Number(r.lastInsertRowid !== void 0 ? r.lastInsertRowid : 0),
        changes: Number(r.rowsAffected || 0)
      },
      results: r.rows
    }));
  }
  async exec(sql) {
    await this.client.executeMultiple(sql);
  }
  async dump() {
    throw new Error("dump is not supported in LibSQL serverless adapter");
  }
  withSession(token) {
    return this;
  }
  get _raw() {
    return this.client;
  }
};

// src/db/client.ts
import { createClient } from "@libsql/client";
var cachedClient = null;
var cachedAdapter = null;
var initPromise = null;
function getLibSqlClient(options) {
  if (cachedClient && !options) {
    return cachedClient;
  }
  const config3 = options ? { ...getDatabaseConfig(), ...options } : getDatabaseConfig();
  const client = createClient({
    url: config3.url,
    authToken: config3.authToken
  });
  if (!options) {
    cachedClient = client;
  }
  return client;
}
async function ensureDatabaseInitialized(client) {
  const targetClient = client || getLibSqlClient();
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const check = await targetClient.execute(
          `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='clients';`
        );
        const exists = Number(check.rows[0]?.count || 0) > 0;
        if (!exists) {
          await runMigrations(targetClient);
          await seedDatabase(targetClient);
        }
      } catch (err) {
        initPromise = null;
        throw err;
      }
    })();
  }
  await initPromise;
}
function getD1Database(options) {
  if (cachedAdapter && !options) {
    return cachedAdapter;
  }
  const client = getLibSqlClient(options);
  const adapter = new LibSqlD1Adapter(client);
  if (!options) {
    cachedAdapter = adapter;
  }
  return adapter;
}

// src/app.ts
var app = new Hono2();
app.use("*", async (c, next) => {
  if (!c.env?.DB) {
    await ensureDatabaseInitialized();
    const db = getD1Database();
    c.env = { ...c.env, DB: db };
  }
  await next();
});
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({
      error: err.message,
      ...err.details ? { details: err.details } : {}
    }, err.statusCode);
  }
  console.error("Unhandled server error:", err);
  return c.json({ error: "\u062D\u062F\u062B \u062E\u0637\u0623 \u063A\u064A\u0631 \u0645\u062A\u0648\u0642\u0639 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" }, 500);
});
app.use("*", securityHeaders);
app.use("/api/*", corsMiddleware);
app.use("/api/*", apiNoCacheMiddleware);
app.use("/static/*", staticCacheMiddleware);
app.use("/static/*", async (c, next) => {
  if (c.env?.ASSETS || c.env?.__STATIC_CONTENT) {
    return module({ root: "./public" })(c, next);
  }
  try {
    const fs4 = await import("node:fs");
    const path4 = await import("node:path");
    const rel = c.req.path.replace(/^\/static\//, "");
    const file = path4.resolve(process.cwd(), "public", "static", rel);
    if (fs4.existsSync(file) && fs4.statSync(file).isFile()) {
      const ext = path4.extname(file).toLowerCase();
      const mimes = {
        ".css": "text/css; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon"
      };
      const data = fs4.readFileSync(file);
      return new Response(data, {
        headers: { "Content-Type": mimes[ext] || "application/octet-stream" }
      });
    }
  } catch {
  }
  await next();
});
app.route("/api", authRoutes);
app.route("/api", dashboardRoutes);
app.route("/api/users", userRoutes);
app.route("/api/clients", clientRoutes);
app.route("/api", caseRoutes);
app.route("/api/tasks", taskRoutes);
app.route("/api", documentRoutes);
app.route("/api", financeRoutes);
app.get("/", (c) => c.html(renderAppLayout()));
app.get("/login", (c) => c.html(renderAppLayout()));
app.get("/app", (c) => c.html(renderAppLayout()));
app.get("/app/*", (c) => c.html(renderAppLayout()));
app.notFound((c) => {
  if (c.req.path.startsWith("/api/")) {
    return c.json({ error: "\u0627\u0644\u0645\u0633\u0627\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" }, 404);
  }
  return c.html(renderAppLayout());
});
var app_default = app;

// src/index.tsx
var src_default = app_default;

// api/entry.ts
var config2 = {
  runtime: "nodejs"
};
var entry_default = getRequestListener(src_default.fetch);
export {
  config2 as config,
  entry_default as default
};
