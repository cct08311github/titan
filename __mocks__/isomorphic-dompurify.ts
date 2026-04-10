/**
 * Jest mock for isomorphic-dompurify (#1326).
 *
 * isomorphic-dompurify bundles its own jsdom v29, which can fail to initialise
 * correctly in both `@jest-environment jsdom` and `@jest-environment node`
 * contexts.  Instead, we create a dedicated jsdom window (using the root-level
 * jsdom v26 that jest-environment-jsdom already installs) and pass it to
 * dompurify.  This produces a fully functional DOMPurify instance that works
 * in every Jest environment and whose sanitise output is identical to the
 * production behaviour (same dompurify, same config).
 */
import { JSDOM } from "jsdom";
import createDOMPurify from "dompurify";

const window = new JSDOM("<!DOCTYPE html>").window as unknown as Window;
const DOMPurify = createDOMPurify(window);

// Named exports matching isomorphic-dompurify's public surface
export const sanitize = DOMPurify.sanitize.bind(DOMPurify);
export const addHook = DOMPurify.addHook.bind(DOMPurify);
export const removeHook = DOMPurify.removeHook.bind(DOMPurify);
export const removeHooks = DOMPurify.removeHooks.bind(DOMPurify);
export const removeAllHooks = DOMPurify.removeAllHooks.bind(DOMPurify);
export const setConfig = DOMPurify.setConfig.bind(DOMPurify);
export const clearConfig = DOMPurify.clearConfig.bind(DOMPurify);
export const isValidAttribute = DOMPurify.isValidAttribute.bind(DOMPurify);
export const { version, removed, isSupported } = DOMPurify;

export default DOMPurify;
