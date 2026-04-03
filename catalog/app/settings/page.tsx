import CredentialsForm from "../../components/CredentialsForm";
import EStatGuideSteps from "../../components/EStatGuideSteps";
import { fetchSourcesRequiringApiKey } from "../../lib/sources";

export default async function SettingsPage() {
  const sources = await fetchSourcesRequiringApiKey();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-8 text-2xl font-bold text-gray-900">設定</h1>

      {sources.map((source) => (
        <section
          key={source.id}
          className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <h2 className="mb-1 text-lg font-semibold text-gray-900">APIキー</h2>
          <p className="mb-6 text-sm text-gray-500">
            {source.label} へのアクセスに必要なアプリケーションIDを設定します。
          </p>
          <CredentialsForm source={source} />
          {source.id === "estat" && <EStatGuideSteps />}
        </section>
      ))}
    </main>
  );
}
