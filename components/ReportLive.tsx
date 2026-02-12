import React from "react";
import { ReportSummary } from "../types";

interface ReportProps {
  summary: ReportSummary;
  onReset: () => void;
}

const ReportLive: React.FC<ReportProps> = ({ summary, onReset }) => {
  const patient = (summary as any)?.patientDetails ?? {};
  const phaseDetails = (summary as any)?.phaseDetails ?? [];
  const category = (summary as any)?.categorySummary ?? {};
  const redFlags: string[] = (summary as any)?.redFlagsDetected ?? [];

  // ✅ Support NEW transcript shape: [{ role, text }]
  // ✅ Also keep backward compatibility if old QA shape exists: [{ q, a }]
  const fullTranscript: any[] = (summary as any)?.fullTranscript ?? [];

  const renderTranscriptItem = (item: any, i: number) => {
    // Old format
    if (item?.q !== undefined || item?.a !== undefined) {
      return (
        <div key={i} className="border-b border-slate-200 pb-2 last:border-0">
          <p className="text-slate-500 italic mb-1">Q: {item?.q || ""}</p>
          <p className="text-slate-800 font-medium">A: {item?.a || ""}</p>
        </div>
      );
    }

    // New format
    const role =
      item?.role === "patient"
        ? "Patient"
        : item?.role === "assistant"
          ? "Assistant"
          : "Unknown";
    return (
      <div key={i} className="border-b border-slate-200 pb-2 last:border-0">
        <p className="text-slate-500 italic mb-1">{role}:</p>
        <p className="text-slate-800 font-medium whitespace-pre-wrap">
          {item?.text || ""}
        </p>
      </div>
    );
  };

  const showRightSection =
    (Array.isArray(redFlags) && redFlags.length > 0) ||
    (Array.isArray(fullTranscript) && fullTranscript.length > 3);

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 max-w-4xl mx-auto border border-slate-100 overflow-auto">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h2 className="text-2xl font-bold text-slate-900">
          Clinical Summary Report
        </h2>
        <button
          onClick={onReset}
          className="text-sm bg-teal-300 hover:bg-teal-400 text-slate-700 px-3 py-1 rounded-md transition"
        >
          New Session
        </button>
      </div>

      {/* ✅ Patient Details */}
      <div className="bg-slate-50 p-4 rounded-lg mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Patient Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="font-semibold">Name:</span>{" "}
            {patient?.name || "Not reported"}
          </div>
          <div>
            <span className="font-semibold">Age:</span>{" "}
            {patient?.age || "Not reported"}
          </div>
          <div>
            <span className="font-semibold">Gender:</span>{" "}
            {patient?.gender || "Not reported"}
          </div>
          <div>
            <span className="font-semibold">Chief Complaint:</span>{" "}
            {patient?.chiefComplaint || "Not reported"}
          </div>
          <div>
            <span className="font-semibold">Pain Location:</span>{" "}
            {patient?.painLocation || "Not reported"}
          </div>
          <div>
            <span className="font-semibold">Duration:</span>{" "}
            {patient?.duration || "Not reported"}
          </div>
        </div>
      </div>

      {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-6"> */}
      <div
        className={`grid gap-6 ${
          showRightSection ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
        }`}
      >
        <section className="space-y-4">
          {/* <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
              Potential Clinical Impression
            </h3>
            <p className="text-lg font-medium text-blue-400 mt-1 b">
              {(summary as any)?.differentialDiagnosis || "Not reported"}
            </p>
          </div> */}
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl shadow-sm">
            <h3 className="text-[14px] font-semibold text-blue-600 uppercase tracking-wider">
              Potential Clinical Impression
            </h3>

            <p className="text-m font-medium text-blue-900 mt-2">
              {(summary as any)?.differentialDiagnosis || "Not reported"}
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">
              Category Breakdown
            </h3>
            <ul className="space-y-3 text-sm">
              <li>
                <span className="font-semibold">Joint Path:</span>{" "}
                {category?.jointPath || "Not reported"}
              </li>
              <li>
                <span className="font-semibold">Systemic:</span>{" "}
                {category?.systemic || "Not reported"}
              </li>
              <li>
                <span className="font-semibold">Gut:</span>{" "}
                {category?.gut || "Not reported"}
              </li>
              <li>
                <span className="font-semibold">Psychological:</span>{" "}
                {category?.psych || "Not reported"}
              </li>
              <li>
                <span className="font-semibold">Ayurvedic:</span>{" "}
                {category?.ayurvedic || "Not reported"}
              </li>
            </ul>
          </div>

          {/* ✅ Phase Details */}
          <div className="bg-slate-50 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">
              Phase Details
            </h3>

            {Array.isArray(phaseDetails) && phaseDetails.length > 0 ? (
              <div className="space-y-3 text-sm">
                {phaseDetails.map((ph: any, idx: number) => (
                  <div
                    key={idx}
                    className="border border-slate-200 rounded-lg p-3 bg-white"
                  >
                    <div className="font-semibold text-slate-800 mb-1">
                      {ph?.phase || "Unknown phase"}
                    </div>
                    {Array.isArray(ph?.keyFindings) && ph.keyFindings.length ? (
                      <ul className="list-disc list-inside text-slate-700 space-y-1">
                        {ph.keyFindings.map((k: string, i: number) => (
                          <li key={i}>{k}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-slate-500">Not reported</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Not reported</p>
            )}
          </div>
        </section>

        <section className="space-y-4">
          {redFlags.length > 0 && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
              <h3 className="text-red-700 font-bold text-sm mb-2 flex items-center">
                <svg
                  className="w-4 h-4 mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                RED FLAGS IDENTIFIED
              </h3>
              <ul className="list-disc list-inside text-sm text-red-600">
                {redFlags.map((rf, i) => (
                  <li key={i}>{rf}</li>
                ))}
              </ul>
            </div>
          )}

          {Array.isArray(fullTranscript) && fullTranscript.length > 3 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Full Transcript
              </h3>

              <div className="max-h-[300px] overflow-y-auto border border-slate-100 rounded-lg bg-slate-50 p-3 text-xs space-y-4">
                {Array.isArray(fullTranscript) && fullTranscript.length > 0 ? (
                  fullTranscript.map((item, i) => renderTranscriptItem(item, i))
                ) : (
                  <p className="text-slate-500">No transcript available.</p>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ReportLive;
