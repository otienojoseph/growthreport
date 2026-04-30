'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAudit } from '../lib/api';

export default function HomePage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError(null);

    try {
      const response = await createAudit({ url, type: 'website' });
      router.push(`/audit/${response.auditId}`);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-b from-white to-gray-100">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm flex flex-col gap-8">
        <div className="text-center space-y-4">
          <h1 className="text-6xl font-bold text-gray-900 tracking-tight">
            Growth<span className="text-blue-600">Audit</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl">
            Get a professional audit of your website's performance, SEO, and conversion rate in minutes.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
          <div className="relative">
            <input
              type="url"
              placeholder="https://example.com"
              required
              className="w-full px-6 py-4 rounded-full border border-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-gray-900 bg-white"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading}
              className="absolute right-2 top-2 bottom-2 px-6 rounded-full bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:bg-blue-300"
            >
              {loading ? 'Starting...' : 'Audit Now'}
            </button>
          </div>
          {error && <p className="text-red-500 text-center text-sm">{error}</p>}
        </form>

        <div className="grid grid-cols-3 gap-8 mt-12 w-full max-w-3xl">
          <div className="text-center p-6 rounded-2xl bg-white shadow-sm border border-gray-100">
            <div className="text-2xl mb-2">⚡</div>
            <h3 className="font-semibold text-gray-900">Lighthouse</h3>
            <p className="text-xs text-gray-500 mt-1">Full performance analysis</p>
          </div>
          <div className="text-center p-6 rounded-2xl bg-white shadow-sm border border-gray-100">
            <div className="text-2xl mb-2">🔍</div>
            <h3 className="font-semibold text-gray-900">SEO Check</h3>
            <p className="text-xs text-gray-500 mt-1">Technical SEO audit</p>
          </div>
          <div className="text-center p-6 rounded-2xl bg-white shadow-sm border border-gray-100">
            <div className="text-2xl mb-2">💰</div>
            <h3 className="font-semibold text-gray-900">Conversion</h3>
            <p className="text-xs text-gray-500 mt-1">CRO recommendations</p>
          </div>
        </div>
      </div>
    </main>
  );
}
