import * as XLSX from 'xlsx';
import { ProcessedDocument } from '@/types/document';

export class ExcelExporter {
  
  static exportToExcel(documents: ProcessedDocument[]): void {
    if (documents.length === 0) return;
    
    const workbook = XLSX.utils.book_new();
    
    // Create enhanced summary sheet
    this.createEnhancedSummarySheet(workbook, documents);
    
    // Create detailed sheets for each document  
    documents.forEach((doc, index) => {
      if (doc.processingStatus === 'completed') {
        this.createEnhancedDocumentSheets(workbook, doc, index);
      }
    });
    
    // Save file with timestamp
    const timestamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `ועדות_רפואיות_${timestamp}.xlsx`);
  }
  
  private static createEnhancedSummarySheet(workbook: XLSX.WorkBook, documents: ProcessedDocument[]): void {
    const summaryData = [
      [
        'מס"ד', 'שם קובץ', 'סוג ועדה', 'שם טופס', 'סניף הוועדה', 'שם המבוטח', 'ת.ז:', 
        'תאריך פגיעה(רק באיבה,נכות מעבודה)', 'משתתפי הועדה', 'תקופה', 'אבחנה', 
        'סעיף ליקוי', 'אחוז הנכות הנובע מהפגיעה', 'הערות', 'מתאריך', 'עד תאריך', 
        'מידת הנכות', 'אחוז הנכות משוקלל', 'שקלול לפטור ממס', 'סטטוס'
      ],
      ...documents.map((doc, index) => [
        index + 1,
        doc.fileName,
        doc["סוג ועדה"] || '-',
        doc["שם טופס"] || '-',
        doc["סניף הוועדה"] || '-',
        doc["שם המבוטח"] || '-',
        doc["ת.ז:"] || '-',
        doc["תאריך פגיעה(רק באיבה,נכות מעבודה)"] || '-',
        doc["משתתפי הועדה"] || '-',
        doc["תקופה"] || '-',
        doc["אבחנה"] || '-',
        doc["סעיף ליקוי"] || '-',
        doc["אחוז הנכות הנובע מהפגיעה"] || '-',
        doc["הערות"] || '-',
        doc["מתאריך"] || '-',
        doc["עד תאריך"] || '-',
        doc["מידת הנכות"] || '-',
        doc["אחוז הנכות משוקלל"] || '-',
        doc["שקלול לפטור ממס"] || '-',
        doc.processingStatus === 'completed' ? '✓ הושלם' : 
        doc.processingStatus === 'error' ? '✗ שגיאה' : '⏳ בעיבוד'
      ])
    ];
    
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    
    // Set column widths for better readability
    summarySheet['!cols'] = [
      { wch: 6 },   // מס"ד
      { wch: 25 },  // שם הקובץ
      { wch: 15 },  // סוג ועדה
      { wch: 15 },  // שם טופס
      { wch: 15 },  // סניף הוועדה
      { wch: 20 },  // שם המבוטח
      { wch: 12 },  // ת.ז:
      { wch: 20 },  // תאריך פגיעה(רק באיבה,נכות מעבודה)
      { wch: 15 },  // משתתפי הועדה
      { wch: 12 },  // תקופה
      { wch: 15 },  // אבחנה
      { wch: 15 },  // סעיף ליקוי
      { wch: 20 },  // אחוז הנכות הנובע מהפגיעה
      { wch: 15 },  // הערות
      { wch: 12 },  // מתאריך
      { wch: 12 },  // עד תאריך
      { wch: 15 },  // מידת הנכות
      { wch: 20 },  // אחוז הנכות משוקלל
      { wch: 20 },  // שקלול לפטור ממס
      { wch: 15 }   // סטטוס עיבוד
    ];
    
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'סיכום כללי');
  }
  
  private static createEnhancedDocumentSheets(workbook: XLSX.WorkBook, doc: ProcessedDocument, index: number): void {
    const docNum = index + 1;
    
    // Main document details
    const mainData = [
      ['שדה', 'ערך'],
      ['שם הקובץ', doc.fileName],
      ['סוג ועדה', doc["סוג ועדה"] || 'לא זוהה'],
      ['שם טופס', doc["שם טופס"] || 'לא זוהה'],
      ['סניף הוועדה', doc["סניף הוועדה"] || 'לא זוהה'],
      ['שם המבוטח', doc["שם המבוטח"] || 'לא זוהה'],
      ['ת.ז:', doc["ת.ז:"] || 'לא נמצא'],
      ['תאריך פגיעה(רק באיבה,נכות מעבודה)', doc["תאריך פגיעה(רק באיבה,נכות מעבודה)"] || 'לא רלוונטי'],
      ['משתתפי הועדה', doc["משתתפי הועדה"] || 'לא זוהו'],
      ['תקופה', doc["תקופה"] || 'לא צוינה'],
      ['אבחנה', doc["אבחנה"] || 'לא צוינה'],
      ['סעיף ליקוי', doc["סעיף ליקוי"] || 'לא צוין'],
      ['אחוז הנכות הנובע מהפגיעה', doc["אחוז הנכות הנובע מהפגיעה"] || 'לא צוין'],
      ['הערות', doc["הערות"] || 'אין'],
      ['מתאריך', doc["מתאריך"] || 'לא צוין'],
      ['עד תאריך', doc["עד תאריך"] || 'לא צוין'],
      ['מידת הנכות', doc["מידת הנכות"] || 'לא צוינה'],
      ['אחוז הנכות משוקלל', doc["אחוז הנכות משוקלל"] || 'לא צוין'],
      ['שקלול לפטור ממס', doc["שקלול לפטור ממס"] || 'לא צוין']
    ];
    
    const mainSheet = XLSX.utils.aoa_to_sheet(mainData);
    mainSheet['!cols'] = [{ wch: 15 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(workbook, mainSheet, `מסמך ${docNum} - פרטים`);
    
    // Note: For the enhanced system, detailed tables are included in the main data structure
  }
}