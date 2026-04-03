/**
 * Mobile version check middleware module — Issue #1090
 *
 * Reads `X-App-Version` header from mobile clients and returns 426 Upgrade Required
 * when the version is below the configured minimum. This ensures security patches
 * are enforced — outdated mobile apps cannot bypass fixes.
 *
 * Version comparison uses semver-style major.minor.patch (numeric only).
 * The minimum version is configurable via `MIN_MOBILE_VERSION` env var.
 */

import { NextRequest, NextResponse } from "next/server";

/** Mobile API path prefix — only mobile endpoints are checked */
const MOBILE_API_PREFIX = "/api/auth/mobile/";

/** Read minimum version at request time to support dynamic config updates */
function getMinVersion(): string {
  return process.env.MIN_MOBILE_VERSION ?? "1.0.0";
}

/**
 * Parse a semver string into [major, minor, patch].
 * Returns null if the string is not a valid version.
 */
function parseSemver(version: string): [number, number, number] | null {
  const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

/**
 * Compare two semver tuples.
 * Returns negative if a < b, 0 if equal, positive if a > b.
 */
function compareSemver(
  a: [number, number, number],
  b: [number, number, number]
): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/**
 * Check mobile app version against the minimum required version.
 *
 * Only applies to requests with an `X-App-Version` header targeting mobile API
 * endpoints. Non-mobile requests and requests without the header pass through.
 *
 * @returns NextResponse with 426 if version is too old
 * @returns null if the request should proceed
 */
export function checkMobileVersion(req: NextRequest): NextResponse | null {
  const pathname = req.nextUrl.pathname;

  // Only check mobile API endpoints
  if (!pathname.startsWith(MOBILE_API_PREFIX)) {
    return null;
  }

  const appVersion = req.headers.get("x-app-version");

  // No version header = not a mobile client or very old app → block
  if (!appVersion) {
    return NextResponse.json(
      {
        error: "UpgradeRequired",
        message: "請更新至最新版本的 TITAN Mobile",
        minimumVersion: getMinVersion(),
      },
      { status: 426 }
    );
  }

  const clientVersion = parseSemver(appVersion);
  const minVersion = parseSemver(getMinVersion());

  // Invalid version format → block (fail-closed)
  if (!clientVersion || !minVersion) {
    return NextResponse.json(
      {
        error: "UpgradeRequired",
        message: "無效的版本格式，請更新至最新版本",
        minimumVersion: getMinVersion(),
      },
      { status: 426 }
    );
  }

  // Version too old → 426
  if (compareSemver(clientVersion, minVersion) < 0) {
    return NextResponse.json(
      {
        error: "UpgradeRequired",
        message: `目前版本 ${appVersion} 已不支援，請更新至 ${getMinVersion()} 或以上`,
        minimumVersion: getMinVersion(),
      },
      { status: 426 }
    );
  }

  return null;
}
