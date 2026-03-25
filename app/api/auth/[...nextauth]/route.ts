/**
 * Auth.js v5 API route handler — Issue #200
 *
 * All configuration is in /auth.ts. This file only re-exports the handlers.
 */
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
