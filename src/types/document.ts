export interface CommitteeMember {
  name: string;
  role: string;
}

export interface Diagnosis {
  code: string;
  description: string;
}

export interface DecisionRow {
  item: string;
  decision: string;
  percentage?: number;
  notes?: string;
}

export interface DisabilityWeightRow {
  bodyPart: string;
  percentage: number;
  type: string;
  calculation: string;
}

export interface ProcessedDocument {
  fileName: string;
  committeeType: string;
  committeeDate: string;
  committeeBranch: string;
  insuredName: string;
  idNumber: string;
  injuryDate?: string;
  committeeMembers: CommitteeMember[];
  diagnoses: Diagnosis[];
  decisionTable: DecisionRow[];
  disabilityWeightTable: DisabilityWeightRow[];
  processingStatus: 'pending' | 'processing' | 'completed' | 'error';
  errorMessage?: string;
}