/**
 * Polyfills for Jest + jsdom environment.
 *
 * Prisma 7 client runtime bundles @noble/hashes which requires
 * TextEncoder/TextDecoder. These are not available in jsdom by default.
 *
 * isomorphic-dompurify (#1326) loads jsdom v29 which requires ReadableStream,
 * WritableStream, TransformStream, and MessageChannel. These are available in
 * Node 18+ but jsdom resets globals, so we restore them explicitly.
 *
 * This file runs via jest.config.ts `setupFiles` — before the test
 * environment is fully initialized and before any module imports.
 */
if (typeof globalThis.TextEncoder === "undefined") {
  const { TextEncoder, TextDecoder } = require("util");
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;
}

// Restore Web Streams API globals removed by jsdom environment
// (required by isomorphic-dompurify → jsdom v29 → undici)
if (typeof globalThis.ReadableStream === "undefined") {
  const { ReadableStream, WritableStream, TransformStream } = require("stream/web");
  globalThis.ReadableStream = ReadableStream;
  globalThis.WritableStream = WritableStream;
  globalThis.TransformStream = TransformStream;
}

if (typeof globalThis.MessageChannel === "undefined") {
  const { MessageChannel } = require("worker_threads");
  globalThis.MessageChannel = MessageChannel;
}
