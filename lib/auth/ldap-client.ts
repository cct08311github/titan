/**
 * LDAP Client Stub — Connection Pooling + Auth
 * Sprint 2 — Task 19
 *
 * Stub implementation for LDAP/AD integration.
 * Replace with real ldapjs implementation when AD connectivity is available.
 *
 * Real implementation will use:
 *   npm install ldapjs
 *   import ldap from 'ldapjs';
 */

import { getLdapConfig, type LdapConfig } from "./ldap-config";

export interface LdapAuthResult {
  success: boolean;
  user?: LdapUser | null;
  error?: string;
}

export interface LdapUser {
  dn: string;
  sAMAccountName: string;
  displayName: string;
  mail: string;
  memberOf: string[];
  department?: string;
  title?: string;
}

/**
 * LDAP Client with connection pooling (stub).
 *
 * Usage:
 *   const client = new LdapClient();
 *   const result = await client.authenticate('username', 'password');
 *   await client.disconnect();
 */
export class LdapClient {
  private config: LdapConfig;
  private connected: boolean = false;

  constructor(config?: Partial<LdapConfig>) {
    this.config = { ...getLdapConfig(), ...config };
  }

  /**
   * Authenticate a user against LDAP/AD.
   * Stub: always returns not-implemented error.
   */
  async authenticate(
    username: string,
    _password: string
  ): Promise<LdapAuthResult> {
    // Stub — will be replaced with real LDAP bind + search
    void username;
    return {
      success: false,
      error:
        "LDAP authentication is not implemented yet (stub). " +
        `Waiting for AD connectivity from IT. Server: ${this.config.url}`,
    };
  }

  /**
   * Search for a user by sAMAccountName or email.
   * Stub: always returns null.
   */
  async searchUser(_identifier: string): Promise<LdapUser | null> {
    // Stub — will be replaced with real LDAP search
    return null;
  }

  /**
   * Connect to LDAP server (stub — no-op).
   */
  async connect(): Promise<void> {
    this.connected = true;
  }

  /**
   * Disconnect from LDAP server (stub — no-op).
   */
  async disconnect(): Promise<void> {
    this.connected = false;
  }

  /**
   * Check if connected.
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get current config (for diagnostics).
   */
  getConfig(): Omit<LdapConfig, "bindPassword"> {
    const { bindPassword: _, ...safeConfig } = this.config;
    return safeConfig;
  }
}
