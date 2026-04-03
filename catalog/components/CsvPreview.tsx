"use client";

const MAX_ROWS = 100;

interface CsvPreviewProps {
  data: string;
}

function parseCsv(text: string): string[][] {
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")));
}

export default function CsvPreview({ data }: CsvPreviewProps) {
  const rows = parseCsv(data);

  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">データが空です</p>;
  }

  const header = rows[0];
  const body = rows.slice(1, MAX_ROWS + 1);
  const truncated = rows.length - 1 > MAX_ROWS;

  return (
    <div className="overflow-auto rounded-lg border border-gray-200 max-h-96">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100 sticky top-0">
          <tr>
            {header.map((cell, i) => (
              <th key={i} className="px-3 py-2 text-left font-medium text-gray-700 whitespace-nowrap">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-1.5 text-gray-600 whitespace-nowrap">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {truncated && (
        <p className="px-3 py-2 text-xs text-gray-400 bg-gray-50 border-t">
          最初の {MAX_ROWS} 行を表示（全 {rows.length - 1} 行）
        </p>
      )}
    </div>
  );
}
