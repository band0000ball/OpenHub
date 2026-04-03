import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CredentialsForm from "../components/CredentialsForm";
import type { DataSource } from "../lib/sources";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const estatSource: DataSource = { id: "estat", label: "e-Stat", requiresApiKey: true };

describe("CredentialsForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders API key input and submit button", () => {
    render(<CredentialsForm source={estatSource} />);
    expect(screen.getByLabelText(/アプリケーションID/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /保存/i })).toBeInTheDocument();
  });

  it("renders source label", () => {
    render(<CredentialsForm source={estatSource} />);
    expect(screen.getAllByText(/e-Stat/i).length).toBeGreaterThan(0);
  });

  it("input type is password", () => {
    render(<CredentialsForm source={estatSource} />);
    const input = screen.getByLabelText(/アプリケーションID/i);
    expect(input).toHaveAttribute("type", "password");
  });

  it("submit button is disabled when input is empty", () => {
    render(<CredentialsForm source={estatSource} />);
    expect(screen.getByRole("button", { name: /保存/i })).toBeDisabled();
  });

  it("submit button is enabled when input has value", async () => {
    render(<CredentialsForm source={estatSource} />);
    fireEvent.change(screen.getByLabelText(/アプリケーションID/i), {
      target: { value: "my-api-key" },
    });
    expect(screen.getByRole("button", { name: /保存/i })).not.toBeDisabled();
  });

  it("shows success message after successful submission", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ source_id: "estat", message: "設定しました" }),
    });

    render(<CredentialsForm source={estatSource} />);
    fireEvent.change(screen.getByLabelText(/アプリケーションID/i), {
      target: { value: "valid-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: /保存/i }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
    expect(screen.getByRole("status").textContent).toMatch(/保存|成功|設定/);
  });

  it("shows error message after failed submission", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "upstream error" }),
    });

    render(<CredentialsForm source={estatSource} />);
    fireEvent.change(screen.getByLabelText(/アプリケーションID/i), {
      target: { value: "bad-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: /保存/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("calls POST /api/credentials with correct body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ source_id: "estat", message: "ok" }),
    });

    render(<CredentialsForm source={estatSource} />);
    fireEvent.change(screen.getByLabelText(/アプリケーションID/i), {
      target: { value: "my-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: /保存/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/credentials");
    const body = JSON.parse(options.body);
    expect(body.source_id).toBe("estat");
    expect(body.api_key).toBe("my-key");
  });
});
