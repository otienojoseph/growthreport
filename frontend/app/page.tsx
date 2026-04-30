"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAudit } from "../lib/api";

export default function HomePage() {
  const [auditType, setAuditType] = useState<"website" | "social" | "full">(
    "website",
  );
  const [url, setUrl] = useState("");
  const [social, setSocial] = useState({
    instagram: "",
    facebook: "",
    linkedin: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload: any = { type: auditType };

      // Ensure website URL is provided if required
      if (auditType === "website" || auditType === "full") {
        if (!url.trim())
          throw new Error("A website URL is required for this audit type.");
        payload.url = url.trim();
      }

      // Ensure at least one social handle is provided if required
      if (auditType === "social" || auditType === "full") {
        const hasSocial =
          social.instagram || social.facebook || social.linkedin;
        if (!hasSocial && auditType === "social") {
          throw new Error(
            "At least one social handle is required for a social media audit.",
          );
        }
        if (hasSocial) {
          payload.social = {
            ...(social.instagram && { instagram: social.instagram.trim() }),
            ...(social.facebook && { facebook: social.facebook.trim() }),
            ...(social.linkedin && { linkedin: social.linkedin.trim() }),
          };
        }
      }

      const response = await createAudit(payload);
      router.push(`/audit/${response.auditId}`);
    } catch (err: any) {
      setError(err.message || "Something went wrong while creating the audit.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center p-8 sm:p-24 bg-gradient-to-b from-white to-gray-100 min-h-[calc(100vh-64px)]">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm flex flex-col gap-8">
        <div className="text-center space-y-4 pt-8">
          <h1
            className="text-4xl sm:text-6xl font-bold text-gray-900 tracking-tight"
            id="main-heading"
          >
            Growth<span className="text-blue-600">Audit</span>
          </h1>
          <p
            className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto px-4"
            id="main-description"
          >
            Get a professional audit of your website's performance, social media
            presence, and conversion metrics in minutes.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="w-full max-w-lg space-y-8 bg-white p-6 sm:p-10 rounded-2xl shadow-sm border border-gray-100"
          aria-labelledby="main-heading"
        >
          {/* Audit Type Selection (Radio Group) */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Select Audit Type
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: "website", icon: "🌐", label: "Website" },
                { id: "social", icon: "📱", label: "Social Media" },
                { id: "full", icon: "⭐", label: "Full Audit" },
              ].map((opt) => (
                <label
                  key={opt.id}
                  htmlFor={`type-${opt.id}`}
                  className={`
                    relative flex flex-col items-center text-center p-4 cursor-pointer rounded-xl border-2 transition-all
                    ${auditType === opt.id ? "border-blue-600 bg-blue-50/50 shadow-sm" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50 focus-within:ring-2 focus-within:ring-blue-500"}
                  `}
                >
                  <input
                    type="radio"
                    id={`type-${opt.id}`}
                    name="auditType"
                    value={opt.id}
                    checked={auditType === opt.id}
                    onChange={(e) => setAuditType(e.target.value as any)}
                    className="sr-only"
                    aria-label={`Select ${opt.label} audit type`}
                  />
                  <span className="text-2xl mb-2" aria-hidden="true">
                    {opt.icon}
                  </span>
                  <span
                    className={`text-sm font-medium ${auditType === opt.id ? "text-blue-700" : "text-gray-700"}`}
                  >
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Website Input Group */}
          {(auditType === "website" || auditType === "full") && (
            <div className="space-y-2">
              <label
                htmlFor="website-url"
                className="block text-sm font-semibold text-gray-900"
              >
                Website URL
              </label>
              <input
                id="website-url"
                type="url"
                placeholder="https://example.com"
                required={auditType === "website" || auditType === "full"}
                className="w-full px-5 py-3 rounded-lg border border-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-900 bg-white"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                aria-describedby={
                  auditType === "full" ? "website-desc" : undefined
                }
              />
              {auditType === "full" && (
                <p id="website-desc" className="text-xs text-gray-500">
                  Required for full audit.
                </p>
              )}
            </div>
          )}

          {/* Social Media Input Group */}
          {(auditType === "social" || auditType === "full") && (
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold text-gray-900">
                Social Media Handles{" "}
                <span className="font-normal text-gray-500">
                  (at least one required for social audits)
                </span>
              </legend>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <label htmlFor="instagram-handle" className="sr-only">
                    Instagram Username
                  </label>
                  <span
                    className="w-8 flex-shrink-0 text-center flex items-center justify-center text-pink-600"
                    aria-hidden="true"
                    title="Instagram"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-6 h-6"
                    >
                      <rect
                        x="2"
                        y="2"
                        width="20"
                        height="20"
                        rx="5"
                        ry="5"
                      ></rect>
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                    </svg>
                  </span>
                  <input
                    id="instagram-handle"
                    type="text"
                    placeholder="@username"
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-gray-900 bg-white"
                    value={social.instagram}
                    onChange={(e) =>
                      setSocial({ ...social, instagram: e.target.value })
                    }
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label htmlFor="linkedin-handle" className="sr-only">
                    LinkedIn Username or Company URL
                  </label>
                  <span
                    className="w-8 flex-shrink-0 text-center flex items-center justify-center text-[#0a66c2]"
                    aria-hidden="true"
                    title="LinkedIn"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-6 h-6"
                    >
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                  </span>
                  <input
                    id="linkedin-handle"
                    type="text"
                    placeholder="company-name"
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-gray-900 bg-white"
                    value={social.linkedin}
                    onChange={(e) =>
                      setSocial({ ...social, linkedin: e.target.value })
                    }
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label htmlFor="facebook-handle" className="sr-only">
                    Facebook Page Username
                  </label>
                  <span
                    className="w-8 flex-shrink-0 text-center flex items-center justify-center text-[#1877f2]"
                    aria-hidden="true"
                    title="Facebook"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-6 h-6"
                    >
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </span>
                  <input
                    id="facebook-handle"
                    type="text"
                    placeholder="page-username"
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-gray-900 bg-white"
                    value={social.facebook}
                    onChange={(e) =>
                      setSocial({ ...social, facebook: e.target.value })
                    }
                  />
                </div>
              </div>
            </fieldset>
          )}

          {error && (
            <div
              className="p-4 bg-red-50 border border-red-200 rounded-lg"
              role="alert"
              aria-live="assertive"
            >
              <p className="text-red-600 text-sm font-medium">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-xl bg-blue-600 text-white text-lg font-bold hover:bg-blue-700 transition-colors focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:text-gray-500 flex items-center justify-center gap-2"
            aria-busy={loading}
          >
            {loading && (
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            )}
            {loading ? "Generating Audit..." : "Start Audit"}
          </button>
        </form>

        <div
          className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-6 w-full max-w-4xl"
          aria-label="Audit Features"
        >
          <section className="text-center p-6 rounded-2xl bg-white shadow-sm border border-gray-100 flex flex-col items-center h-full">
            <div className="text-3xl mb-3" aria-hidden="true">
              ⚡
            </div>
            <h2 className="font-semibold text-gray-900 text-lg mb-1">
              Performance
            </h2>
            <p className="text-sm text-gray-500 mt-auto">
              Deep Lighthouse and SEO technical analysis
            </p>
          </section>
          <section className="text-center p-6 rounded-2xl bg-white shadow-sm border border-gray-100 flex flex-col items-center h-full">
            <div className="text-3xl mb-3" aria-hidden="true">
              📱
            </div>
            <h2 className="font-semibold text-gray-900 text-lg mb-1">
              Social Media
            </h2>
            <p className="text-sm text-gray-500 mt-auto">
              Engagement and growth scoring metrics
            </p>
          </section>
          <section className="text-center p-6 rounded-2xl bg-white shadow-sm border border-gray-100 flex flex-col items-center h-full">
            <div className="text-3xl mb-3" aria-hidden="true">
              💰
            </div>
            <h2 className="font-semibold text-gray-900 text-lg mb-1">
              Conversion
            </h2>
            <p className="text-sm text-gray-500 mt-auto">
              Actionable CRO and growth recommendations
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
