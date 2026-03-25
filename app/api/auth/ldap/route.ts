/**
 * LDAP Authentication API Endpoint (Stub)
 * Sprint 2 — Task 19
 *
 * POST /api/auth/ldap
 * Body: { username: string, password: string }
 *
 * Returns 501 Not Implemented until LDAP is connected.
 */

import { NextRequest, NextResponse } from "next/server";
import { LdapClient } from "@/lib/auth/ldap-client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Missing username or password" },
        { status: 400 }
      );
    }

    const client = new LdapClient();

    try {
      const result = await client.authenticate(username, password);

      if (result.success && result.user) {
        return NextResponse.json({
          success: true,
          user: {
            name: result.user.displayName,
            email: result.user.mail,
            department: result.user.department,
          },
        });
      }

      // Stub returns 501 until real LDAP is configured
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Authentication failed",
          stub: true,
        },
        { status: 501 }
      );
    } finally {
      await client.disconnect();
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
