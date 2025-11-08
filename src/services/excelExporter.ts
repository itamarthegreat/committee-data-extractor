import * as XLSX from 'xlsx-js-style';
import { ProcessedDocument } from '@/types/document';

export class ExcelExporter {
  
  // Generate distinct colors for each patient
  private static getPatientColor(index: number): string {
    const colors = [
      'FFE3F2FD', // Light Blue
      'FFF3E5F5', // Light Purple
      'FFE8F5E9', // Light Green
      'FFFFF3E0', // Light Orange
      'FFFCE4EC', // Light Pink
      'FFE0F2F1', // Light Teal
      'FFFFF9C4', // Light Yellow
      'FFE1F5FE', // Lighter Blue
      'FFF1F8E9', // Lighter Green
      'FFFFF8E1', // Lighter Amber
      'FFF3E5AB', // Light Khaki
      'FFE8EAF6', // Light Indigo
    ];
    return colors[index % colors.length];
  }
  
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

    // Process each document and create separate rows for each decision
    documents.forEach((doc, docIndex) => {
      const decisions = doc["החלטות"] && Array.isArray(doc["החלטות"]) && doc["החלטות"].length > 0
        ? doc["החלטות"]
        : [{ "אבחנה": "-", "סעיף ליקוי": "-", "אחוז הנכות": "-", "מתאריך": "-", "עד תאריך": "-", "מידת הנכות": "-", "הערות": "-" }];
      
      decisions.forEach((decision, decisionIndex) => {
        const rowNumber = decisionIndex === 0 ? (docIndex + 1).toString() : `${docIndex + 1}.${decisionIndex + 1}`;
        
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
          decision["אבחנה"] || '-',
          decision["סעיף ליקוי"] || '-',
          decision["אחוז הנכות"] || '-',
          getFieldValue(doc, "אחוז הנכות הנובע מהפגיעה"),
          decision["הערות"] || '-',
          decision["מתאריך"] || '-',
          decision["עד תאריך"] || '-',
          decision["מידת הנכות"] || '-',
          getFieldValue(doc, "אחוז הנכות משוקלל"),
          getFieldValue(doc, "שקלול לפטור ממס"),
          doc.processingStatus === 'completed' ? '✓ הושלם' : 
          doc.processingStatus === 'error' ? `✗ שגיאה: ${doc.errorMessage || 'לא ידוע'}` : '⏳ בעיבוד'
        ]);
      });
    });
    
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    
    // Apply colors and styles to patient rows
    let currentRow = 1; // Start after header
    documents.forEach((doc, docIndex) => {
      const decisions = doc["החלטות"] && Array.isArray(doc["החלטות"]) && doc["החלטות"].length > 0
        ? doc["החלטות"]
        : [{}];
      
      const patientColor = this.getPatientColor(docIndex);
      
      decisions.forEach(() => {
        // Apply color and style to all cells in this row
        for (let col = 0; col < 25; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: currentRow, c: col });
          if (!summarySheet[cellAddress]) {
            summarySheet[cellAddress] = { t: 's', v: '' };
          }
          
          summarySheet[cellAddress].s = {
            fill: {
              fgColor: { rgb: patientColor }
            },
            alignment: {
              horizontal: 'right',
              vertical: 'center',
              wrapText: true
            },
            border: {
              top: { style: 'thin', color: { rgb: 'CCCCCC' } },
              bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
              left: { style: 'thin', color: { rgb: 'CCCCCC' } },
              right: { style: 'thin', color: { rgb: 'CCCCCC' } }
            }
          };
        }
        currentRow++;
      });
    });
    
    // Style header row
    for (let col = 0; col < 25; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (summarySheet[cellAddress]) {
        summarySheet[cellAddress].s = {
          fill: {
            fgColor: { rgb: '4472C4' }
          },
          font: {
            bold: true,
            color: { rgb: 'FFFFFF' }
          },
          alignment: {
            horizontal: 'center',
            vertical: 'center',
            wrapText: true
          },
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } }
          }
        };
      }
    }
    
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
        'סניף הוועדה', 'תאריך ועדה', 'תאריך פגיעה', 'משתתפי הוועדה', 
        'אבחנה', 'סעיף ליקוי', 'אחוז נכות', 'מתאריך', 'עד תאריך', 'מידת הנכות',
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
    
    // Apply colors and styles to patient rows in consolidated sheet
    let currentRow = 1; // Start after header
    documents.forEach((doc, docIndex) => {
      const diagnosisField = getFieldValue(doc, "אבחנה");
      const diagnoses = diagnosisField !== '-' ? 
        diagnosisField.split(/[,،;؛]/).map(d => d.trim()).filter(d => d.length > 0) : 
        ['-'];
      
      const patientColor = this.getPatientColor(docIndex);
      
      diagnoses.forEach(() => {
        // Apply color and style to all cells in this row
        for (let col = 0; col < 21; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: currentRow, c: col });
          if (!consolidatedSheet[cellAddress]) {
            consolidatedSheet[cellAddress] = { t: 's', v: '' };
          }
          
          consolidatedSheet[cellAddress].s = {
            fill: {
              fgColor: { rgb: patientColor }
            },
            alignment: {
              horizontal: 'right',
              vertical: 'center',
              wrapText: true
            },
            border: {
              top: { style: 'thin', color: { rgb: 'CCCCCC' } },
              bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
              left: { style: 'thin', color: { rgb: 'CCCCCC' } },
              right: { style: 'thin', color: { rgb: 'CCCCCC' } }
            }
          };
        }
        currentRow++;
      });
    });
    
    // Style header row
    for (let col = 0; col < 21; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (consolidatedSheet[cellAddress]) {
        consolidatedSheet[cellAddress].s = {
          fill: {
            fgColor: { rgb: '4472C4' }
          },
          font: {
            bold: true,
            color: { rgb: 'FFFFFF' }
          },
          alignment: {
            horizontal: 'center',
            vertical: 'center',
            wrapText: true
          },
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } }
          }
        };
      }
    }
    
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
      { wch: 35 },  // משתתפי הוועדה
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
    
    XLSX.utils.book_append_sheet(workbook, consolidatedSheet, 'כולם ביחד - החלטות');
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
      ['אחוז הנכות הנובע מהפגיעה', getFieldValue("אחוז הנכות הנובע מהפגיעה")],
      ['אחוז הנכות משוקלל', getFieldValue("אחוז הנכות משוקלל")],
      ['שקלול לפטור ממס', getFieldValue("שקלול לפטור ממס")],
      ['סטטוס עיבוד', doc.processingStatus === 'completed' ? '✓ הושלם בהצלחה' : 
                      doc.processingStatus === 'error' ? `✗ שגיאה: ${doc.errorMessage || 'לא ידוע'}` : '⏳ בעיבוד']
    ];
    
    // Add decisions breakdown if decisions exist
    const decisions = doc["החלטות"];
    if (decisions && Array.isArray(decisions) && decisions.length > 0) {
      mainData.push(['', '']); // Empty row separator
      mainData.push(['פירוט החלטות:', '']);
      
      decisions.forEach((decision, index) => {
        mainData.push([`החלטה ${index + 1}:`, '']);
        mainData.push(['  אבחנה', decision["אבחנה"] || 'לא זוהה']);
        mainData.push(['  סעיף ליקוי', decision["סעיף ליקוי"] || 'לא זוהה']);
        mainData.push(['  אחוז הנכות', decision["אחוז הנכות"] || 'לא זוהה']);
        mainData.push(['  מתאריך', decision["מתאריך"] || 'לא זוהה']);
        mainData.push(['  עד תאריך', decision["עד תאריך"] || 'לא זוהה']);
        mainData.push(['  מידת הנכות', decision["מידת הנכות"] || 'לא זוהה']);
        mainData.push(['  הערות', decision["הערות"] || 'לא זוהה']);
      });
    }
    
    const mainSheet = XLSX.utils.aoa_to_sheet(mainData);
    mainSheet['!cols'] = [{ wch: 25 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(workbook, mainSheet, `מסמך ${docNum} - ${doc.fileName ? doc.fileName.substring(0, 15) : 'לא ידוע'}`);
  }
}