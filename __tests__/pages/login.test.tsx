/**
 * Page tests: Login
 */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import LoginPage from "@/app/(auth)/login/page";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ push: mockPush, replace: jest.fn() })),
}));

jest.mock("next-auth/react", () => ({
  signIn: jest.fn(() => Promise.resolve({ error: null })),
}));

import { signIn } from "next-auth/react";
const mockSignIn = signIn as jest.MockedFunction<typeof signIn>;

describe("Login Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders TITAN brand", () => {
    render(<LoginPage />);
    expect(screen.getByText("TITAN")).toBeInTheDocument();
  });

  it("renders username and password inputs", () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText(/帳號/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/密碼/i)).toBeInTheDocument();
  });

  it("renders login submit button", () => {
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: /登入/i })).toBeInTheDocument();
  });

  it("updates username field on change", () => {
    render(<LoginPage />);
    const usernameInput = screen.getByPlaceholderText(/帳號/i);
    fireEvent.change(usernameInput, { target: { value: "admin" } });
    expect(usernameInput).toHaveValue("admin");
  });

  it("updates password field on change", () => {
    render(<LoginPage />);
    const passwordInput = screen.getByPlaceholderText(/密碼/i);
    fireEvent.change(passwordInput, { target: { value: "secret" } });
    expect(passwordInput).toHaveValue("secret");
  });

  it("calls signIn on form submit", async () => {
    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText(/帳號/i), { target: { value: "admin" } });
    fireEvent.change(screen.getByPlaceholderText(/密碼/i), { target: { value: "secret" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /登入/i }));
    });
    expect(mockSignIn).toHaveBeenCalledWith("credentials", {
      username: "admin",
      password: "secret",
      redirect: false,
    });
  });

  it("redirects to dashboard on successful login", async () => {
    mockSignIn.mockResolvedValue({ error: null } as never);
    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText(/帳號/i), { target: { value: "admin" } });
    fireEvent.change(screen.getByPlaceholderText(/密碼/i), { target: { value: "secret" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /登入/i }));
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows error message on failed login", async () => {
    mockSignIn.mockResolvedValue({ error: "CredentialsSignin" } as never);
    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText(/帳號/i), { target: { value: "admin" } });
    fireEvent.change(screen.getByPlaceholderText(/密碼/i), { target: { value: "wrong" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /登入/i }));
    });
    await waitFor(() => {
      expect(screen.getByText("帳號或密碼錯誤")).toBeInTheDocument();
    });
  });

  it("does not redirect when login fails", async () => {
    mockSignIn.mockResolvedValue({ error: "CredentialsSignin" } as never);
    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText(/帳號/i), { target: { value: "admin" } });
    fireEvent.change(screen.getByPlaceholderText(/密碼/i), { target: { value: "wrong" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /登入/i }));
    });
    expect(mockPush).not.toHaveBeenCalled();
  });
});
