import CredentialsForm from "../../components/CredentialsForm";

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-8 text-2xl font-bold text-gray-900">設定</h1>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-gray-900">APIキー</h2>
        <p className="mb-6 text-sm text-gray-500">
          データソースへのアクセスに必要なアプリケーションIDを設定します。
          IDはサーバーのメモリにのみ保存され、再起動でリセットされます。
        </p>
        <CredentialsForm />
      </section>
    </main>
  );
}
