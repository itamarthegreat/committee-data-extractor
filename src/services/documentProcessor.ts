import { ProcessedDocument } from '@/types/document';
import { PdfService } from './pdfService';
import { OpenAIService } from './openaiService';
import { OcrService } from './ocrService';

export class DocumentProcessor {
  private openaiService: OpenAIService;
  
  constructor(apiKey: string) {
    this.openaiService = new OpenAIService(apiKey);
  }
  
  async processFile(file: File): Promise<ProcessedDocument> {
    try {
      console.log(`Starting to process file: ${file.name}`);
      
      let extractedText = '';
      
      // Try multiple extraction methods in order of sophistication
      try {
        // Method 1: Try advanced OCR with Hugging Face
        console.log('Attempting OCR extraction with Hugging Face...');
        extractedText = await OcrService.extractTextFromPdfWithOcr(file);
        
        if (extractedText && extractedText.length > 50) {
          console.log(`OCR successfully extracted ${extractedText.length} characters`);
        } else {
          throw new Error('OCR did not extract sufficient text');
        }
        
      } catch (ocrError) {
        console.warn('OCR extraction failed, trying binary extraction:', ocrError);
        
        // Method 2: Fallback to advanced binary extraction
        try {
          const arrayBuffer = await file.arrayBuffer();
          extractedText = await this.advancedBinaryExtraction(arrayBuffer);
          
          if (extractedText && extractedText.length > 20) {
            console.log(`Binary extraction extracted ${extractedText.length} characters`);
          } else {
            throw new Error('Binary extraction insufficient');
          }
          
        } catch (binaryError) {
          console.error('All extraction methods failed');
          throw new Error(`
לא ניתן לחלץ טקסט קריא מהקובץ "${file.name}".

ניסינו:
✗ OCR מתקדם עם Hugging Face
✗ חילוץ בינארי מתקדם

הקובץ עשוי להיות:
• מוגן בסיסמה
• פגום או לא תקין
• מכיל רק תמונות ללא טקסט
• מקודד בפורמט לא נתמך

אנא נסה קובץ PDF אחר או שמור את הקובץ מחדש.
          `);
        }
      }
      
      console.log(`Successfully extracted ${extractedText.length} characters from ${file.name}`);
      console.log('Text sample:', extractedText.substring(0, 200));
      
      // Process with OpenAI
      const extractedData = await this.openaiService.processDocumentText(extractedText, file.name);
      
      return {
        fileName: file.name,
        processingStatus: 'completed',
        ...extractedData
      } as ProcessedDocument;
      
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
  
  
  private async advancedBinaryExtraction(arrayBuffer: ArrayBuffer): Promise<string> {
    console.log('Starting advanced binary extraction...');
    
    const uint8Array = new Uint8Array(arrayBuffer);
    const extractedParts: string[] = [];
    
    // Method 1: Look for readable text in PDF streams
    let binaryString = '';
    for (let i = 0; i < Math.min(uint8Array.length, 500000); i++) {
      const byte = uint8Array[i];
      // Only include ASCII printable characters and Hebrew range
      if ((byte >= 32 && byte <= 126) || (byte >= 0x05D0 && byte <= 0x05EA) || byte === 10 || byte === 13) {
        binaryString += String.fromCharCode(byte);
      } else {
        binaryString += ' '; // Replace non-printable with space
      }
    }
    
    console.log('Binary string created, searching for Hebrew patterns...');
    
    // Enhanced pattern matching for Hebrew medical documents
    const patterns = [
      // Hebrew text patterns with context
      { 
        name: 'medical_forms',
        regex: /(?:ביטוח\s*לאומי|ועדה\s*רפואית|מסמך\s*רפואי)[^\n]{0,200}/gi,
        weight: 10
      },
      {
        name: 'patient_info', 
        regex: /(?:שם\s*המבוטח|מבוטח|שם)[:\s]*([א-ת\s]{2,40})/gi,
        weight: 8
      },
      {
        name: 'id_numbers',
        regex: /(?:ת\.ז|תעודת\s*זהות|זהות)[:\s]*(\d{8,9})/gi,
        weight: 8
      },
      {
        name: 'dates',
        regex: /(?:תאריך|מתאריך|עד\s*תאריך)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi,
        weight: 7
      },
      {
        name: 'percentages',
        regex: /(?:אחוז|אחוזי?\s*נכות|נכות)[:\s]*(\d{1,3}%?)/gi,
        weight: 9
      },
      {
        name: 'diagnosis',
        regex: /(?:אבחנה|דיאגנוזה|מחלה)[:\s]*([א-ת\s]{3,80})/gi,
        weight: 8
      },
      {
        name: 'committee_type',
        regex: /(?:סוג\s*ועדה|ועדה)[:\s]*([א-ת\s]{2,40})/gi,
        weight: 7
      },
      {
        name: 'disability_details',
        regex: /(?:מידת\s*נכות|ליקוי|פגיעה)[:\s]*([א-ת\s\d%]{2,50})/gi,
        weight: 8
      },
      {
        name: 'hebrew_words',
        regex: /[א-ת]{3,}/g,
        weight: 3
      }
    ];
    
    // Apply patterns with weights
    const weightedResults: { text: string, weight: number }[] = [];
    
    for (const pattern of patterns) {
      const matches = binaryString.match(pattern.regex) || [];
      console.log(`Pattern ${pattern.name} found ${matches.length} matches`);
      
      for (const match of matches.slice(0, 20)) { // Limit matches per pattern
        const cleaned = match
          .replace(/[^\u05D0-\u05EA\s\d\/%.\-:]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (cleaned.length > 2) {
          weightedResults.push({ text: cleaned, weight: pattern.weight });
        }
      }
    }
    
    // Sort by weight and length, take best results
    const bestResults = weightedResults
      .sort((a, b) => (b.weight * b.text.length) - (a.weight * a.text.length))
      .slice(0, 50)
      .map(r => r.text);
    
    // Remove duplicates and combine
    const uniqueResults = Array.from(new Set(bestResults));
    const finalText = uniqueResults.join(' ').replace(/\s+/g, ' ').trim();
    
    console.log(`Advanced extraction found ${uniqueResults.length} unique text parts`);
    console.log('Final extracted text:', finalText.substring(0, 300));
    
    return finalText;
  }

  private isTextGarbled(text: string): boolean {
    if (!text || text.length < 10) return true;
    
    // Check for meaningful Hebrew words (3+ consecutive Hebrew letters)
    const hebrewWords = text.match(/[א-ת]{3,}/g) || [];
    
    // Check for common medical document keywords
    const medicalKeywords = ['ביטוח', 'לאומי', 'ועדה', 'רפואי', 'נכות', 'מבוטח', 'תאריך'];
    const foundKeywords = medicalKeywords.filter(keyword => text.includes(keyword)).length;
    
    // Text is garbled if it has very few Hebrew words and no medical keywords
    const isGarbled = hebrewWords.length < 3 && foundKeywords === 0;
    
    console.log(`Text quality check: ${hebrewWords.length} Hebrew words, ${foundKeywords} medical keywords, garbled: ${isGarbled}`);
    
    return isGarbled;
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