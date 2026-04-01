import type { NextConfig } from "next";

/**
 * Amplify Hosting Classic は CloudFront + Lambda@Edge で SSR を処理する。
 * Lambda@Edge は環境変数をサポートしないため、process.env を実行時に参照できない。
 *
 * `env` フィールドに列挙した変数は next build 時に文字列リテラルとして
 * サーバーバンドルに埋め込まれる（process.env.X → "実際の値" に置換）。
 * Amplify Console の環境変数はビルド時（CodeBuild）に利用可能なため、
 * この方法でランタイムに値を届けることができる。
 *
 * セキュリティ注記:
 * - `env` の値はサーバーバンドルに埋め込まれる。auth.ts は server-only
 *   コードのため、クライアントバンドルには含まれない。
 * - output: 'standalone' は Amplify SSR 互換性問題が解消されれば有効化を検討。
 */
const nextConfig: NextConfig = {
  env: {
    AUTH_COGNITO_DOMAIN: process.env.AUTH_COGNITO_DOMAIN ?? "",
    AUTH_COGNITO_ISSUER: process.env.AUTH_COGNITO_ISSUER ?? "",
    AUTH_COGNITO_ID: process.env.AUTH_COGNITO_ID ?? "",
    AUTH_COGNITO_SECRET: process.env.AUTH_COGNITO_SECRET ?? "",
    AUTH_SECRET: process.env.AUTH_SECRET ?? "",
    AUTH_URL: process.env.AUTH_URL ?? "",
  },
};

export default nextConfig;