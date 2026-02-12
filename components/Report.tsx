import React from "react";
import { ReportSummary } from "../types";

interface ReportProps {
  summary: ReportSummary;
  onReset: () => void;
}

const Report: React.FC<ReportProps> = ({ summary, onReset }) => {
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
              Potential Clinical Impression
            </h3>
            <p className="text-lg font-medium text-blue-800 mt-1">
              {summary.differentialDiagnosis}
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">
              Category Breakdown
            </h3>
            <ul className="space-y-3 text-sm">
              <li>
                <span className="font-semibold">Joint Path:</span>{" "}
                {summary.categorySummary.jointPath}
              </li>
              <li>
                <span className="font-semibold">Systemic:</span>{" "}
                {summary.categorySummary.systemic}
              </li>
              <li>
                <span className="font-semibold">Gut:</span>{" "}
                {summary.categorySummary.gut}
              </li>
              <li>
                <span className="font-semibold">Psychological:</span>{" "}
                {summary.categorySummary.psych}
              </li>
              <li>
                <span className="font-semibold">Ayurvedic:</span>{" "}
                {summary.categorySummary.ayurvedic}
              </li>
            </ul>
          </div>
        </section>

        <section className="space-y-4">
          {summary.redFlagsDetected.length > 0 && (
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
                {summary.redFlagsDetected.map((rf, i) => (
                  <li key={i}>{rf}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Detailed Q&A Transcript
            </h3>
            <div className="max-h-[300px] overflow-y-auto border border-slate-100 rounded-lg bg-slate-50 p-3 text-xs space-y-4">
              {summary.fullTranscript.map((item, i) => (
                <div
                  key={i}
                  className="border-b border-slate-200 pb-2 last:border-0"
                >
                  <p className="text-slate-500 italic mb-1">Q: {item.q}</p>
                  <p className="text-slate-800 font-medium">A: {item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Report;
