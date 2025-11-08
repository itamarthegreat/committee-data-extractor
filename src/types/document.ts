export interface CommitteeMember {
  name: string;
  role: string;
}

export interface Diagnosis {
  code: string;
  description: string;
}

export interface DecisionRow {
  "אבחנה": string | null;
  "סעיף ליקוי": string | null;
  "אחוז הנכות": string | null;
  "מתאריך": string | null;
  "עד תאריך": string | null;
  "מידת הנכות": string | null;
  "הערות": string | null;
}

export interface DisabilityWeightRow {
  bodyPart: string;
  percentage: number;
  type: string;
  calculation: string;
}

export interface ProcessedDocument {
  fileName: string;
  "כותרת הועדה": string | null;
  "סוג ועדה": string | null;
  "שם טופס": string | null;
  "סניף הוועדה": string | null;
  "שם המבוטח": string | null;
  "ת.ז:": string | null;
  "תאריך ועדה": string | null;
  "תאריך פגיעה(רק באיבה,נכות מעבודה)": string | null;
  "משתתף ועדה 1": string | null;
  "משתתף ועדה 2": string | null;
  "משתתף ועדה 3": string | null;
  "משתתף ועדה 4": string | null;
  "החלטות": DecisionRow[] | null;
  "אחוז הנכות הנובע מהפגיעה": string | null;
  "אחוז הנכות משוקלל": string | null;
  "שקלול לפטור ממס": string | null;
  processingStatus: 'pending' | 'processing' | 'completed' | 'error';
  errorMessage?: string;
}