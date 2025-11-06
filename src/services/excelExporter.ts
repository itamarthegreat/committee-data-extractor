import * as XLSX from 'xlsx';
import { ProcessedDocument } from '@/types/document';

export class ExcelExporter {
  
  static exportToExcel(documents: ProcessedDocument[]): void {
    if (documents.length === 0) {
      console.warn('No documents to export');
      return;
    }
    
    console.log('Exporting documents to Excel:', documents);
    
    const workbook = XLSX.utils.book_new();
    
    // Create enhanced summary sheet with separated diagnoses
    this.createEnhancedSummarySheet(workbook, documents);
    
    // Create a consolidated "All Together" sheet
    this.createConsolidatedSheet(workbook, documents);
    
    // Create detailed sheets for each document that was processed successfully
    documents.forEach((doc, index) => {
      if (doc.processingStatus === 'completed' || doc.processingStatus === 'error') {
        this.createEnhancedDocumentSheets(workbook, doc, index);
      }
    });
    
    // Save file with timestamp
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(/:/g, '-');
    const fileName = `ועדות_רפואיות_${timestamp}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    
    console.log(`Excel file exported: ${fileName}`);
  }
  
  private static createEnhancedSummarySheet(workbook: XLSX.WorkBook, documents: ProcessedDocument[]): void {
    const summaryData = [
      [
        'מס"ד', 'שם קובץ', 'כותרת הועדה', 'סוג ועדה', 'שם טופס', 'סניף הוועדה', 'שם המבוטח', 'ת.ז:', 
        'תאריך ועדה', 'תאריך פגיעה', 'משתתף ועדה 1', 'משתתף ועדה 2', 'משתתף ועדה 3', 'משתתף ועדה 4', 'אבחנה', 
        'סעיף ליקוי', 'אחוז הנכות', 'אחוז הנכות הנובע מהפגיעה', 'הערות', 'מתאריך', 'עד תאריך', 
        'מידת הנכות', 'אחוז הנכות משוקלל', 'שקלול לפטור ממס', 'סטטוס'
      ]
    ];

    // Helper function to safely get field value
    const getFieldValue = (doc: ProcessedDocument, field: string): string => {
      const value = doc[field];
      return value && value.trim() !== '' ? value : '-';
    };

    // Process each document and create separate rows for each diagnosis
    documents.forEach((doc, docIndex) => {
      const diagnosisField = getFieldValue(doc, "אבחנה");
      const diagnoses = diagnosisField !== '-' ? 
        diagnosisField.split(/[,،;؛]/).map(d => d.trim()).filter(d => d.length > 0) : 
        ['-'];
      
      diagnoses.forEach((diagnosis, diagnosisIndex) => {
        const rowNumber = diagnosisIndex === 0 ? (docIndex + 1).toString() : `${docIndex + 1}.${diagnosisIndex + 1}`;
        
        summaryData.push([
          rowNumber,
          doc.fileName || '-',
          getFieldValue(doc, "כותרת הועדה"),
          getFieldValue(doc, "סוג ועדה"),
          getFieldValue(doc, "שם טופס"),
          getFieldValue(doc, "סניף הוועדה"),
          getFieldValue(doc, "שם המבוטח"),
          getFieldValue(doc, "ת.ז:"),
          getFieldValue(doc, "תאריך ועדה"),
          getFieldValue(doc, "תאריך פגיעה(רק באיבה,נכות מעבודה)"),
          getFieldValue(doc, "משתתף ועדה 1"),
          getFieldValue(doc, "משתתף ועדה 2"),
          getFieldValue(doc, "משתתף ועדה 3"),
          getFieldValue(doc, "משתתף ועדה 4"),
          diagnosis,
          getFieldValue(doc, "סעיף ליקוי"),
          getFieldValue(doc, "אחוז הנכות"),
          getFieldValue(doc, "אחוז הנכות הנובע מהפגיעה"),
          getFieldValue(doc, "הערות"),
          getFieldValue(doc, "מתאריך"),
          getFieldValue(doc, "עד תאריך"),
          getFieldValue(doc, "מידת הנכות"),
          getFieldValue(doc, "אחוז הנכות משוקלל"),
          getFieldValue(doc, "שקלול לפטור ממס"),
          doc.processingStatus === 'completed' ? '✓ הושלם' : 
          doc.processingStatus === 'error' ? `✗ שגיאה: ${doc.errorMessage || 'לא ידוע'}` : '⏳ בעיבוד'
        ]);
      });
    });
    
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    
    // Set column widths for better readability
    summarySheet['!cols'] = [
      { wch: 6 },   // מס"ד
      { wch: 25 },  // שם הקובץ
      { wch: 30 },  // כותרת הועדה
      { wch: 15 },  // סוג ועדה
      { wch: 15 },  // שם טופס
      { wch: 15 },  // סניף הוועדה
      { wch: 20 },  // שם המבוטח
      { wch: 12 },  // ת.ז:
      { wch: 15 },  // תאריך ועדה
      { wch: 15 },  // תאריך פגיעה
      { wch: 25 },  // משתתף ועדה 1
      { wch: 25 },  // משתתף ועדה 2
      { wch: 25 },  // משתתף ועדה 3
      { wch: 25 },  // משתתף ועדה 4
      { wch: 20 },  // אבחנה
      { wch: 15 },  // סעיף ליקוי
      { wch: 15 },  // אחוז הנכות
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
  
  private static createConsolidatedSheet(workbook: XLSX.WorkBook, documents: ProcessedDocument[]): void {
    const consolidatedData = [
      [
        'מס"ד', 'שם קובץ', 'כותרת הועדה', 'שם המבוטח', 'ת.ז:', 'סוג ועדה', 'שם טופס', 
        'סניף הוועדה', 'תאריך ועדה', 'תאריך פגיעה', 'משתתף ועדה 1', 'משתתף ועדה 2', 
        'משתתף ועדה 3', 'משתתף ועדה 4', 'אבחנה', 'סעיף ליקוי', 
        'אחוז נכות', 'מתאריך', 'עד תאריך', 'מידת הנכות',
        'אחוז נכות משוקלל', 'שקלול לפטור ממס', 'הערות', 'סטטוס'
      ]
    ];

    // Helper function to safely get field value
    const getFieldValue = (doc: ProcessedDocument, field: string): string => {
      const value = doc[field];
      return value && value.trim() !== '' ? value : '-';
    };

    let rowCounter = 1;
    
    // Process each document and create separate rows for each diagnosis
    documents.forEach((doc) => {
      const diagnosisField = getFieldValue(doc, "אבחנה");
      const diagnoses = diagnosisField !== '-' ? 
        diagnosisField.split(/[,،;؛]/).map(d => d.trim()).filter(d => d.length > 0) : 
        ['-'];
      
      diagnoses.forEach((diagnosis) => {
        consolidatedData.push([
          rowCounter.toString(),
          doc.fileName || '-',
          getFieldValue(doc, "שם המבוטח"),
          getFieldValue(doc, "ת.ז:"),
          getFieldValue(doc, "סוג ועדה"),
          getFieldValue(doc, "שם טופס"),
          getFieldValue(doc, "סניף הוועדה"),
          getFieldValue(doc, "תאריך פגיעה(רק באיבה,נכות מעבודה)"),
          diagnosis,
          getFieldValue(doc, "סעיף ליקוי"),
          getFieldValue(doc, "אחוז הנכות הנובע מהפגיעה"),
          getFieldValue(doc, "תקופה"),
          getFieldValue(doc, "מתאริך"),
          getFieldValue(doc, "עד תאריך"),
          getFieldValue(doc, "מידת הנכות"),
          getFieldValue(doc, "אחוז הנכות משוקלל"),
          getFieldValue(doc, "שקלול לפטור ממס"),
          getFieldValue(doc, "משתתפי הועדה"),
          getFieldValue(doc, "הערות"),
          doc.processingStatus === 'completed' ? '✓ הושלם' : 
          doc.processingStatus === 'error' ? `✗ שגיאה: ${doc.errorMessage || 'לא ידוע'}` : '⏳ בעיבוד'
        ]);
        rowCounter++;
      });
    });
    
    const consolidatedSheet = XLSX.utils.aoa_to_sheet(consolidatedData);
    
    // Set column widths for better readability
    consolidatedSheet['!cols'] = [
      { wch: 6 },   // מס"ד
      { wch: 20 },  // שם הקובץ
      { wch: 30 },  // כותרת הועדה
      { wch: 20 },  // שם המבוטח
      { wch: 12 },  // ת.ז:
      { wch: 15 },  // סוג ועדה
      { wch: 15 },  // שם טופס
      { wch: 15 },  // סניף הוועדה
      { wch: 15 },  // תאריך ועדה
      { wch: 15 },  // תאריך פגיעה
      { wch: 25 },  // משתתף ועדה 1
      { wch: 25 },  // משתתף ועדה 2
      { wch: 25 },  // משתתף ועדה 3
      { wch: 25 },  // משתתף ועדה 4
      { wch: 25 },  // אבחנה
      { wch: 15 },  // סעיף ליקוי
      { wch: 12 },  // אחוז נכות
      { wch: 12 },  // מתאריך
      { wch: 12 },  // עד תאריך
      { wch: 15 },  // מידת הנכות
      { wch: 15 },  // אחוז נכות משוקלל
      { wch: 15 },  // שקלול לפטור ממס
      { wch: 20 },  // הערות
      { wch: 15 }   // סטטוס
    ];
    
    XLSX.utils.book_append_sheet(workbook, consolidatedSheet, 'כולם ביחד - אבחנות');
  }
  
  private static createEnhancedDocumentSheets(workbook: XLSX.WorkBook, doc: ProcessedDocument, index: number): void {
    const docNum = index + 1;
    
    // Helper function to safely get field value
    const getFieldValue = (field: string): string => {
      const value = doc[field];
      return value && value.trim() !== '' ? value : 'לא זוהה';
    };
    
    // Main document details
    const mainData = [
      ['שדה', 'ערך'],
      ['שם הקובץ', doc.fileName || 'לא ידוע'],
      ['כותרת הועדה', getFieldValue("כותרת הועדה")],
      ['סוג ועדה', getFieldValue("סוג ועדה")],
      ['שם טופס', getFieldValue("שם טופס")],
      ['סניף הוועדה', getFieldValue("סניף הוועדה")],
      ['שם המבוטח', getFieldValue("שם המבוטח")],
      ['ת.ז:', getFieldValue("ת.ז:")],
      ['תאריך ועדה', getFieldValue("תאריך ועדה")],
      ['תאריך פגיעה(רק באיבה,נכות מעבודה)', getFieldValue("תאריך פגיעה(רק באיבה,נכות מעבודה)")],
      ['משתתף ועדה 1', getFieldValue("משתתף ועדה 1")],
      ['משתתף ועדה 2', getFieldValue("משתתף ועדה 2")],
      ['משתתף ועדה 3', getFieldValue("משתתף ועדה 3")],
      ['משתתף ועדה 4', getFieldValue("משתתף ועדה 4")],
      ['מתקופה', getFieldValue("מתקופה")],
      ['תקופה', getFieldValue("תקופה")],
      ['אבחנה', getFieldValue("אבחנה")],
      ['סעיף ליקוי', getFieldValue("סעיף ליקוי")],
      ['אחוז הנכות', getFieldValue("אחוז הנכות")],
      ['אחוז הנכות הנובע מהפגיעה', getFieldValue("אחוז הנכות הנובע מהפגיעה")],
      ['הערות', getFieldValue("הערות")],
      ['מתאריך', getFieldValue("מתאריך")],
      ['עד תאריך', getFieldValue("עד תאריך")],
      ['מידת הנכות', getFieldValue("מידת הנכות")],
      ['אחוז הנכות משוקלל', getFieldValue("אחוז הנכות משוקלל")],
      ['שקלול לפטור ממס', getFieldValue("שקלול לפטור ממס")],
      ['סטטוס עיבוד', doc.processingStatus === 'completed' ? '✓ הושלם בהצלחה' : 
                      doc.processingStatus === 'error' ? `✗ שגיאה: ${doc.errorMessage || 'לא ידוע'}` : '⏳ בעיבוד']
    ];
    
    // Add diagnosis breakdown if multiple diagnoses exist
    const diagnosisField = getFieldValue("אבחנה");
    if (diagnosisField !== 'לא זוהה' && diagnosisField.includes(',')) {
      const diagnoses = diagnosisField.split(/[,،;؛]/).map(d => d.trim()).filter(d => d.length > 0);
      
      mainData.push(['', '']); // Empty row separator
      mainData.push(['פירוט אבחנות:', '']);
      
      diagnoses.forEach((diagnosis, index) => {
        mainData.push([`אבחנה ${index + 1}`, diagnosis]);
      });
    }
    
    const mainSheet = XLSX.utils.aoa_to_sheet(mainData);
    mainSheet['!cols'] = [{ wch: 25 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(workbook, mainSheet, `מסמך ${docNum} - ${doc.fileName ? doc.fileName.substring(0, 15) : 'לא ידוע'}`);
  }
}