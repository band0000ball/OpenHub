"use client";

import JsonPreview from "./JsonPreview";
import CsvPreview from "./CsvPreview";

interface DataPreviewProps {
  data: string;
  format: string;
  dataEncoding: "utf-8" | "base64";
}

export default function DataPreview({ data, format, dataEncoding }: DataPreviewProps) {
  const decoded = dataEncoding === "base64" ? atob(data) : data;

  if (!decoded || decoded.length === 0) {
    return <p className="text-sm text-gray-500">プレビューデータがありません</p>;
  }

  if (format === "json") {
    return <JsonPreview data={decoded} />;
  }

  if (format === "csv") {
    return <CsvPreview data={decoded} />;
  }

  // その他: プレーンテキスト表示
  return (
    <pre className="overflow-auto rounded-lg bg-gray-50 p-4 text-sm text-gray-700 max-h-96">
      {decoded.slice(0, 5000)}
      {decoded.length > 5000 && "\n\n…（以降省略）"}
    </pre>
  );
}
