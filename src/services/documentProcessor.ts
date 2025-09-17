import { ProcessedDocument } from '@/types/document';
import { PdfService } from './pdfService';
import { OpenAIService } from './openaiService';

export class DocumentProcessor {
  private openaiService: OpenAIService;
  
  constructor(apiKey: string) {
    this.openaiService = new OpenAIService(apiKey);
  }
  
  async processFile(file: File): Promise<ProcessedDocument> {
    try {
      console.log(`Starting to process file: ${file.name}`);
      
      // Inform user about document parser option for complex PDFs
      const errorMessage = `
PDF זה מורכב מאוד וצריך עיבוד מתקדם.

🔧 פתרונות מומלצים:

1. **השתמש ב-Document Parser של לובל:**
   • לחץ על כפתור "📎" (העלה קובץ) בצ'אט
   • העלה את ה-PDF ישירות בחלון הצ'אט
   • לובל ישתמש ב-Document Parser המתקדם שלו

2. **או נסה קובץ PDF פשוט יותר:**
   • PDF שנוצר ישירות ממחשב (לא סרוק)
   • PDF עם טקסט ברור וקריא
   • ללא הגנת סיסמה

3. **או המר את הקובץ:**
   • שמור את ה-PDF מחדש עם OCR
   • נסה להמיר לפורמט Word ואז חזרה ל-PDF

נסה את אחת מהאפשרויות למעלה.
      `;
      
      throw new Error(errorMessage);
      
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
      return {
        fileName: file.name,
        "סוג ועדה": null,
        "שם טופס": null,
        "סניף הוועדה": null,
        "שם המבוטח": null,
        "ת.ז:": null,
        "תאריך פגיעה(רק באיבה,נכות מעבודה)": null,
        "משתתפי הועדה": null,
        "תקופה": null,
        "אבחנה": null,
        "סעיף ליקוי": null,
        "אחוז הנכות הנובע מהפגיעה": null,
        "הערות": null,
        "מתאריך": null,
        "עד תאריך": null,
        "מידת הנכות": null,
        "אחוז הנכות משוקלל": null,
        "שקלול לפטור ממס": null,
        processingStatus: 'error',
        errorMessage: error.message
      } as ProcessedDocument;
    }
  }
  
  async processMultipleFiles(files: File[]): Promise<ProcessedDocument[]> {
    console.log(`Processing ${files.length} files`);
    
    const results = await Promise.all(
      files.map(file => this.processFile(file))
    );
    
    const successCount = results.filter(r => r.processingStatus === 'completed').length;
    const errorCount = results.filter(r => r.processingStatus === 'error').length;
    
    console.log(`Processing completed: ${successCount} success, ${errorCount} errors`);
    
    return results;
  }
}