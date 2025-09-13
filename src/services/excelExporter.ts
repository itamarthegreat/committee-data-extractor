import * as XLSX from 'xlsx';
import { ProcessedDocument } from '@/types/document';

export class ExcelExporter {
  
  static exportToExcel(documents: ProcessedDocument[]): void {
    if (documents.length === 0) return;
    
    const workbook = XLSX.utils.book_new();
    
    // Create summary sheet with enhanced mapping
    this.createSummarySheet(workbook, documents);
    
    // Create detailed sheets for each document
    documents.forEach((doc, index) => {
      if (doc.processingStatus === 'completed') {
        this.createDocumentSheets(workbook, doc, index);
      }
    });
    
    // Save file with timestamp
    const timestamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `ועדות_רפואיות_מעובדות_${timestamp}.xlsx`);
  }
  
  private static createSummarySheet(workbook: XLSX.WorkBook, documents: ProcessedDocument[]): void {
    const summaryData = [
      [
        'מס"ד', 'שם הקובץ', 'סוג הועדה', 'תאריך ועדה', 'סניף', 
        'שם המבוטח', 'ת.ז', 'תאריך פגיעה', 'מספר אבחנות', 
        'מספר החלטות', 'מספר איברים בשקלול', 'סטטוס עיבוד'
      ],
      ...documents.map((doc, index) => [
        index + 1,
        doc.fileName,
        doc.committeeType,
        doc.committeeDate,
        doc.committeeBranch,
        doc.insuredName,
        doc.idNumber,
        doc.injuryDate || 'לא רלוונטי',
        doc.diagnoses.length,
        doc.decisionTable.length,
        doc.disabilityWeightTable.length,
        doc.processingStatus === 'completed' ? 'הושלם בהצלחה' : 
        doc.processingStatus === 'error' ? `שגיאה: ${doc.errorMessage}` : 'בעיבוד'
      ])
    ];
    
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    
    // Set column widths for better readability
    summarySheet['!cols'] = [
      { wch: 6 },   // מס"ד
      { wch: 25 },  // שם הקובץ
      { wch: 20 },  // סוג הועדה
      { wch: 12 },  // תאריך ועדה
      { wch: 15 },  // סניף
      { wch: 20 },  // שם המבוטח
      { wch: 12 },  // ת.ז
      { wch: 12 },  // תאריך פגיעה
      { wch: 10 },  // מספר אבחנות
      { wch: 10 },  // מספר החלטות
      { wch: 15 },  // מספר איברים
      { wch: 20 }   // סטטוס עיבוד
    ];
    
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'סיכום כללי');
  }
  
  private static createDocumentSheets(workbook: XLSX.WorkBook, doc: ProcessedDocument, index: number): void {
    const docNum = index + 1;
    
    // Main document details
    const mainData = [
      ['שדה', 'ערך'],
      ['שם הקובץ', doc.fileName],
      ['סוג הועדה', doc.committeeType],
      ['תאריך ועדה', doc.committeeDate],
      ['סניף הועדה', doc.committeeBranch],
      ['שם המבוטח', doc.insuredName],
      ['תעודת זהות', doc.idNumber],
      ['תאריך פגיעה', doc.injuryDate || 'לא רלוונטי']
    ];
    
    const mainSheet = XLSX.utils.aoa_to_sheet(mainData);
    mainSheet['!cols'] = [{ wch: 15 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(workbook, mainSheet, `מסמך ${docNum} - פרטים`);
    
    // Committee members
    if (doc.committeeMembers.length > 0) {
      const membersData = [
        ['מס"ד', 'שם החבר', 'תפקיד'],
        ...doc.committeeMembers.map((member, idx) => [idx + 1, member.name, member.role])
      ];
      const membersSheet = XLSX.utils.aoa_to_sheet(membersData);
      membersSheet['!cols'] = [{ wch: 6 }, { wch: 25 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(workbook, membersSheet, `מסמך ${docNum} - חברי ועדה`);
    }
    
    // Diagnoses
    if (doc.diagnoses.length > 0) {
      const diagnosesData = [
        ['מס"ד', 'קוד אבחנה', 'תיאור האבחנה'],
        ...doc.diagnoses.map((diagnosis, idx) => [idx + 1, diagnosis.code, diagnosis.description])
      ];
      const diagnosesSheet = XLSX.utils.aoa_to_sheet(diagnosesData);
      diagnosesSheet['!cols'] = [{ wch: 6 }, { wch: 15 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(workbook, diagnosesSheet, `מסמך ${docNum} - אבחנות`);
    }
    
    // Decision table
    if (doc.decisionTable.length > 0) {
      const decisionData = [
        ['מס"ד', 'פריט/נושא', 'החלטה', 'אחוז נכות', 'הערות'],
        ...doc.decisionTable.map((row, idx) => [
          idx + 1,
          row.item, 
          row.decision, 
          row.percentage?.toString() || 'לא רלוונטי', 
          row.notes || 'אין הערות'
        ])
      ];
      const decisionSheet = XLSX.utils.aoa_to_sheet(decisionData);
      decisionSheet['!cols'] = [{ wch: 6 }, { wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(workbook, decisionSheet, `מסמך ${docNum} - החלטות`);
    }
    
    // Disability weight table
    if (doc.disabilityWeightTable.length > 0) {
      const disabilityData = [
        ['מס"ד', 'איבר/חלק גוף', 'אחוז נכות', 'סוג הנכות', 'חישוב הנכות'],
        ...doc.disabilityWeightTable.map((row, idx) => [
          idx + 1,
          row.bodyPart, 
          row.percentage.toString() + '%', 
          row.type, 
          row.calculation
        ])
      ];
      const disabilitySheet = XLSX.utils.aoa_to_sheet(disabilityData);
      disabilitySheet['!cols'] = [{ wch: 6 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(workbook, disabilitySheet, `מסמך ${docNum} - שקלול נכות`);
    }
  }
}