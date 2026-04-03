"use client";

import { useState } from "react";
import type { DataSource } from "../lib/sources";

type Status = "idle" | "loading" | "success" | "error";

interface CredentialsFormProps {
  source: DataSource;
}

export default function CredentialsForm({ source }: CredentialsFormProps) {
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: source.id, api_key: apiKey }),
      });

      if (!response.ok) {
        setStatus("error");
        setMessage("APIキーの保存に失敗しました。キーを確認してください。");
        return;
      }

      setStatus("success");
      setMessage(`${source.label} APIキーを保存しました。`);
      setApiKey("");
    } catch {
      setStatus("error");
      setMessage("サーバーに接続できませんでした。");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="mb-1 text-sm font-medium text-gray-500">データソース</p>
        <p className="font-medium text-gray-900">{source.label}</p>
      </div>

      <div>
        <label
          htmlFor={`api-key-${source.id}`}
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          アプリケーションID
        </label>
        <input
          id={`api-key-${source.id}`}
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={`${source.label} アプリケーションIDを入力`}
          aria-required="true"
          aria-describedby={`api-key-hint-${source.id} api-key-status-${source.id}`}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div id={`api-key-status-${source.id}`} aria-live="polite" aria-atomic="true">
        {status === "success" && (
          <p role="status" className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">
            {message}
          </p>
        )}

        {status === "error" && (
          <p role="alert" className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
            {message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={!apiKey || status === "loading"}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
      >
        {status === "loading" ? "保存中…" : "保存"}
      </button>
    </form>
  );
}
