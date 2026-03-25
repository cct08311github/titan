/**
 * LDAP/AD Configuration Types and Helpers
 * Sprint 2 — Task 19
 *
 * Provides typed configuration for LDAP integration.
 * Environment variables:
 *   LDAP_URL, LDAP_BIND_DN, LDAP_BIND_PASSWORD, LDAP_BASE_DN
 */

export interface LdapConfig {
  /** LDAP server URL (e.g., ldap://ad.bank.local:389) */
  url: string;
  /** Service account DN for LDAP bind */
  bindDn: string;
  /** Service account password */
  bindPassword: string;
  /** Base DN for user search */
  baseDn: string;
  /** LDAP search filter template. Use {{username}} as placeholder */
  searchFilter: string;
  /** Connection timeout in milliseconds */
  connectTimeout: number;
  /** Whether to use TLS (ldaps://) */
  useTls: boolean;
  /** Connection pool size */
  poolSize: number;
}

/** Default configuration — safe fallbacks for development */
export const DEFAULT_LDAP_CONFIG: LdapConfig = {
  url: "ldap://localhost:389",
  bindDn: "cn=admin,dc=example,dc=com",
  bindPassword: "",
  baseDn: "dc=example,dc=com",
  searchFilter: "(&(objectClass=person)(sAMAccountName={{username}}))",
  connectTimeout: 5000,
  useTls: false,
  poolSize: 5,
};

/**
 * Build LDAP config from environment variables.
 * Falls back to DEFAULT_LDAP_CONFIG for missing values.
 */
export function getLdapConfig(): LdapConfig {
  return {
    url: process.env.LDAP_URL || DEFAULT_LDAP_CONFIG.url,
    bindDn: process.env.LDAP_BIND_DN || DEFAULT_LDAP_CONFIG.bindDn,
    bindPassword: process.env.LDAP_BIND_PASSWORD || DEFAULT_LDAP_CONFIG.bindPassword,
    baseDn: process.env.LDAP_BASE_DN || DEFAULT_LDAP_CONFIG.baseDn,
    searchFilter:
      process.env.LDAP_SEARCH_FILTER || DEFAULT_LDAP_CONFIG.searchFilter,
    connectTimeout: parseInt(
      process.env.LDAP_CONNECT_TIMEOUT || String(DEFAULT_LDAP_CONFIG.connectTimeout),
      10
    ),
    useTls: process.env.LDAP_USE_TLS === "true",
    poolSize: parseInt(
      process.env.LDAP_POOL_SIZE || String(DEFAULT_LDAP_CONFIG.poolSize),
      10
    ),
  };
}
