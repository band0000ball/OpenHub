"use client";

import { useState } from "react";

interface JsonNodeProps {
  data: unknown;
  depth: number;
  maxDepth: number;
}

function JsonNode({ data, depth, maxDepth }: JsonNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (data === null) return <span className="text-gray-400">null</span>;
  if (typeof data === "boolean") return <span className="text-blue-600">{String(data)}</span>;
  if (typeof data === "number") return <span className="text-green-600">{data}</span>;
  if (typeof data === "string") return <span className="text-amber-700">&quot;{data.length > 200 ? data.slice(0, 200) + "…" : data}&quot;</span>;

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-gray-400">[]</span>;
    if (depth >= maxDepth) return <span className="text-gray-400">[…{data.length} items]</span>;
    return (
      <span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-500 hover:text-gray-700 font-mono text-xs"
        >
          {expanded ? "▼" : "▶"} [{data.length}]
        </button>
        {expanded && (
          <ul className="ml-4 border-l border-gray-200 pl-2">
            {data.slice(0, 50).map((item, i) => (
              <li key={i} className="py-0.5">
                <span className="text-gray-400 text-xs mr-1">{i}:</span>
                <JsonNode data={item} depth={depth + 1} maxDepth={maxDepth} />
              </li>
            ))}
            {data.length > 50 && (
              <li className="text-gray-400 text-xs py-1">…他 {data.length - 50} 件</li>
            )}
          </ul>
        )}
      </span>
    );
  }

  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-gray-400">{"{}"}</span>;
    if (depth >= maxDepth) return <span className="text-gray-400">{"{"} …{entries.length} keys {"}"}</span>;
    return (
      <span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-500 hover:text-gray-700 font-mono text-xs"
        >
          {expanded ? "▼" : "▶"} {"{"}
          {entries.length}
          {"}"}
        </button>
        {expanded && (
          <ul className="ml-4 border-l border-gray-200 pl-2">
            {entries.map(([key, value]) => (
              <li key={key} className="py-0.5">
                <span className="text-purple-600 text-sm font-medium">{key}</span>
                <span className="text-gray-400">: </span>
                <JsonNode data={value} depth={depth + 1} maxDepth={maxDepth} />
              </li>
            ))}
          </ul>
        )}
      </span>
    );
  }

  return <span className="text-gray-400">{String(data)}</span>;
}

interface JsonPreviewProps {
  data: string;
}

export default function JsonPreview({ data }: JsonPreviewProps) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return (
      <pre className="overflow-auto rounded-lg bg-gray-50 p-4 text-sm text-gray-700 max-h-96">
        {data.slice(0, 5000)}
      </pre>
    );
  }

  return (
    <div className="overflow-auto rounded-lg bg-gray-50 p-4 text-sm max-h-96 font-mono">
      <JsonNode data={parsed} depth={0} maxDepth={5} />
    </div>
  );
}
