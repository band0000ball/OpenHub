import {
  ESTAT_GUIDE_STEPS,
  ESTAT_GUIDE_LAST_VERIFIED,
  ESTAT_URLS,
} from "../lib/estat-guide";

export default function EStatGuideSteps() {
  return (
    <details id="estat-guide" className="mt-6 rounded-lg border border-gray-200 bg-gray-50">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100">
        アプリケーションIDの取得手順
      </summary>
      <div className="px-4 pb-4 pt-2">
        <ol className="space-y-2 text-sm text-gray-700">
          {ESTAT_GUIDE_STEPS.map(({ step, text }) => (
            <li key={step} className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                {step}
              </span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
        <div className="mt-3">
          <a
            href={ESTAT_URLS.registration}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 underline hover:text-blue-800"
          >
            e-Stat ユーザー登録ページへ →
          </a>
        </div>
        <p className="mt-3 text-xs text-gray-400">
          最終確認日: {ESTAT_GUIDE_LAST_VERIFIED}
        </p>
      </div>
    </details>
  );
}
