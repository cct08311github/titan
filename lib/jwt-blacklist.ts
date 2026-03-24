/**
 * JWT Blacklist — Issue #153
 *
 * In-memory store of revoked JWT tokens (and userId-based keys for suspended
 * users). Lives in its own module so it can be imported by service-layer code
 * (e.g. UserService) without pulling in next/server.
 *
 * Production deployments should back this with Redis so the blacklist is
 * shared across multiple instances.
 */
export class JwtBlacklist {
  private static readonly _set = new Set<string>();

  /** Add a token or userId key to the blacklist. */
  static add(token: string): void {
    this._set.add(token);
  }

  /** Check whether a token/key is blacklisted. */
  static has(token: string): boolean {
    return this._set.has(token);
  }

  /** Remove a token/key from the blacklist (e.g. on unsuspend). */
  static remove(token: string): void {
    this._set.delete(token);
  }

  /** Clear all entries — used in tests. */
  static clear(): void {
    this._set.clear();
  }

  /** Return the current size — used in tests. */
  static get size(): number {
    return this._set.size;
  }
}
