import React from "react";

export type PhaseStatus = "completed" | "current" | "upcoming";

export interface PatientPhase {
  id: string;
  label: string;
  /** Optional short hint shown under the label */
  subtitle?: string;
  status: PhaseStatus;
}

export interface PatientPhaseProgressProps {
  /** Ordered list of phases in the journey */
  phases: PatientPhase[];
  /**
   * Optional title above the progress bar.
   * Example: "Intake progress" / "Aapka assessment progress"
   */
  title?: string;
  /**
   * Optional helper line below the title.
   * Example: "3 me se 1 phase complete"
   */
  helperText?: string;
}

/**
 * Pure, reusable UI-only component for showing patient-friendly
 * phase progress (e.g. "Basic Phase", "Grand Split", etc.).
 *
 * NOTE: This component is not wired into any existing screen.
 * To keep current behaviour unchanged, it is only exported here.
 * You can import it wherever needed, for example in `LiveGeminiChat`.
 */
const PatientPhaseProgress: React.FC<PatientPhaseProgressProps> = ({
  phases,
  title = "Intake progress",
  helperText,
}) => {
  if (!phases || phases.length === 0) return null;

  const total = phases.length;
  const completedCount = phases.filter((p) => p.status === "completed").length;
  const currentIndex = phases.findIndex((p) => p.status === "current");

  const rawPercent =
    total === 0
      ? 0
      : ((completedCount + (currentIndex >= 0 ? 0.5 : 0)) / total) * 100;
  const clampedPercent = Math.max(0, Math.min(100, rawPercent));

  return (
    <section className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          {/* <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {title}
          </p> */}
          <p className="text-xs text-slate-500">
            {helperText ??
              `${completedCount} / ${total} phase complete ho chuke hain`}
          </p>
        </div>
        <span className="text-xs font-semibold text-teal-600">
          {Math.round(clampedPercent)}%
        </span>
      </div>

      {/* Linear progress track */}
      <div className="relative mb-3">
        <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal-500 via-teal-400 to-emerald-400 transition-[width] duration-500"
            style={{ width: `${clampedPercent}%` }}
          />
        </div>
      </div>

      {/* Phase pills */}
      <ol className="flex flex-wrap items-center gap-y-2 gap-x-3 text-xs">
        {phases.map((phase, index) => {
          const isCompleted = phase.status === "completed";
          const isCurrent = phase.status === "current";

          const basePill =
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1";

          const pillClass = isCompleted
            ? `${basePill} bg-teal-50 border-teal-200 text-teal-700`
            : isCurrent
              ? `${basePill} bg-white border-teal-500 text-teal-700 shadow-xs`
              : `${basePill} bg-white border-slate-200 text-slate-500`;

          return (
            <li key={phase.id} className="flex items-center gap-2">
              <div className={pillClass}>
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold ${
                    isCompleted
                      ? "bg-teal-500 text-white"
                      : isCurrent
                        ? "border border-teal-500 text-teal-600"
                        : "border border-slate-300 text-slate-400"
                  }`}
                >
                  {index + 1}
                </span>
                <span className="font-medium">{phase.label}</span>
                {phase.subtitle && (
                  <span className="hidden sm:inline text-[10px] text-slate-400">
                    • {phase.subtitle}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};

export default PatientPhaseProgress;
