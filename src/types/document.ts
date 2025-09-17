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
  "סוג ועדה": string | null;
  "שם טופס": string | null;
  "סניף הוועדה": string | null;
  "שם המבוטח": string | null;
  "ת.ז:": string | null;
  "תאריך פגיעה(רק באיבה,נכות מעבודה)": string | null;
  "משתתפי הועדה": string | null;
  "תקופה": string | null;
  "אבחנה": string | null;
  "סעיף ליקוי": string | null;
  "אחוז הנכות הנובע מהפגיעה": string | null;
  "הערות": string | null;
  "מתאריך": string | null;
  "עד תאריך": string | null;
  "מידת הנכות": string | null;
  "אחוז הנכות משוקלל": string | null;
  "שקלול לפטור ממס": string | null;
  processingStatus: 'pending' | 'processing' | 'completed' | 'error';
  errorMessage?: string;
}