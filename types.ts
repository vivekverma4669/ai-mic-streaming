
export interface Message {
  role: 'user' | 'model' | 'system';
  text: string;
}

export interface PatientData {
  basics: {
    age?: number;
    gender?: string;
    habits?: string[];
  };
  symptoms: {
    duration?: string;
    jointCount?: number;
    symmetry?: boolean;
    morningStiffness?: string;
    movementImpact?: 'better' | 'worse';
  };
}

export interface ReportSummary {
  categorySummary: {
    jointPath: string;
    systemic: string;
    gut: string;
    psych: string;
    ayurvedic: string;
  };
  differentialDiagnosis: string;
  redFlagsDetected: string[];
  fullTranscript: { q: string; a: string }[];
}
