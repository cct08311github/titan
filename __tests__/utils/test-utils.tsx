import React, { ReactElement } from "react";
import { render, RenderOptions } from "@testing-library/react";

// Wrapper with any necessary providers
function AllProviders({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

// Helper: create a mock NextRequest
export function createMockRequest(
  url: string,
  options?: {
    method?: string;
    body?: unknown;
    searchParams?: Record<string, string>;
  }
) {
  const fullUrl = url.startsWith("http") ? url : `http://localhost${url}`;
  const requestUrl = new URL(fullUrl);
  if (options?.searchParams) {
    Object.entries(options.searchParams).forEach(([k, v]) =>
      requestUrl.searchParams.set(k, v)
    );
  }
  return {
    url: requestUrl.toString(),
    method: options?.method ?? "GET",
    json: jest.fn(() => Promise.resolve(options?.body ?? {})),
    headers: new Headers(),
    nextUrl: requestUrl,
  } as unknown as import("next/server").NextRequest;
}

// Helper: parse NextResponse JSON
export async function parseResponse(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export * from "@testing-library/react";
export { renderWithProviders as render };
