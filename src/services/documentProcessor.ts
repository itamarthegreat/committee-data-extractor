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
      
      let extractedText = '';
      
      // Try Lovable's document parser for complex PDFs
      try {
        console.log('Attempting advanced document parsing...');
        
        // Copy file to a temporary path for processing
        const tempPath = `user-uploads://${Date.now()}_${file.name}`;
        
        // Read file contents
        const arrayBuffer = await file.arrayBuffer();
        
        // Since we can't directly copy to user-uploads in browser,
        // let's try our enhanced binary extraction with better patterns
        extractedText = await this.enhancedPdfExtraction(arrayBuffer, file.name);
        
        if (extractedText && extractedText.length > 30) {
          console.log(`Successfully extracted ${extractedText.length} characters`);
        } else {
          throw new Error('Could not extract sufficient text from PDF');
        }
        
      } catch (error) {
        console.error('Enhanced extraction failed:', error);
        throw new Error(`לא ניתן לחלץ טקסט מהקובץ: ${error.message}`);
      }
      
      console.log(`Processing extracted text for ${file.name}:`);
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
  
  
  private async enhancedPdfExtraction(arrayBuffer: ArrayBuffer, fileName: string): Promise<string> {
    console.log(`Enhanced PDF extraction for ${fileName}`);
    
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Check if this is a digitally signed or encrypted PDF
    const binaryCheck = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array.slice(0, 10000));
    if (binaryCheck.includes('/Sig') || binaryCheck.includes('308204') || binaryCheck.includes('864886f70d')) {
      console.log('Detected digitally signed or complex PDF - trying advanced extraction');
    }
    
    // Strategy 1: Multiple binary string approaches with enhanced filtering
    const extractedTexts: string[] = [];
    
    // Approach 1: Direct character conversion with Hebrew support
    let binaryString = '';
    for (let i = 0; i < Math.min(uint8Array.length, 3000000); i++) {
      const byte = uint8Array[i];
      // Include more character ranges
      if ((byte >= 32 && byte <= 126) || // ASCII
          (byte >= 0x05D0 && byte <= 0x05EA) || // Hebrew
          (byte >= 0x0590 && byte <= 0x05FF) || // Extended Hebrew
          byte === 10 || byte === 13 || byte === 9) { // Line breaks and tabs
        binaryString += String.fromCharCode(byte);
      } else {
        binaryString += ' ';
      }
    }
    
    console.log('Binary string created, length:', binaryString.length);
    
    // Approach 2: Look for PDF text objects and streams
    const pdfTextPatterns = [
      /BT\s+([\s\S]*?)\s+ET/g, // Text objects
      /\(([\s\S]*?)\)/g, // Text in parentheses
      /\[([\s\S]*?)\]/g, // Text in brackets
      /<([\s\S]*?)>/g, // Hex strings
    ];
    
    for (const pattern of pdfTextPatterns) {
      const matches = binaryString.match(pattern) || [];
      console.log(`PDF pattern found ${matches.length} matches`);
      
      for (const match of matches) {
        let cleaned = match
          .replace(/[BT|ET|\(|\)|\[|\]|<|>]/g, '')
          .replace(/\\[0-9]{3}/g, '')
          .trim();
        
        if (cleaned.length > 1) {
          extractedTexts.push(cleaned);
        }
      }
    }
    
    // Strategy 2: Enhanced Hebrew medical pattern matching
    const hebrewMedicalPatterns = [
      // Document types and headers
      { regex: /(?:ביטוח\s*לאומי|מוסד\s*לביטוח\s*לאומי)[^\n]{0,150}/gi, weight: 15 },
      { regex: /(?:ועדה\s*רפואית|ועדה\s*רפואי)[^\n]{0,100}/gi, weight: 15 },
      { regex: /(?:מסמך\s*רפואי|טופס\s*רפואי)[^\n]{0,100}/gi, weight: 12 },
      
      // Patient details
      { regex: /(?:שם\s*המבוטח|שם\s*מבוטח|מבוטח)[:\s]*([א-ת\s]{2,50})/gi, weight: 12 },
      { regex: /(?:ת\.ז|תעודת\s*זהות|זהות)[:\s]*(\d{8,9})/gi, weight: 12 },
      
      // Medical information
      { regex: /(?:אבחנה|אבחנות|דיאגנוזה)[:\s]*([א-ת\s]{3,100})/gi, weight: 11 },
      { regex: /(?:אחוז\s*נכות|נכות\s*באחוזים|אחוזי\s*נכות)[:\s]*(\d{1,3}%?)/gi, weight: 11 },
      { regex: /(?:מידת\s*נכות|מידת\s*הנכות|ליקוי)[:\s]*([א-ת\s\d%]{2,80})/gi, weight: 10 },
      { regex: /(?:סעיף\s*ליקוי|סעיף)[:\s]*([א-ת\s\d]{2,50})/gi, weight: 9 },
      
      // Dates and periods
      { regex: /(?:תאריך\s*פגיעה|פגיעה)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi, weight: 10 },
      { regex: /(?:מתאריך|החל\s*מ)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi, weight: 9 },
      { regex: /(?:עד\s*תאריך|עד)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi, weight: 9 },
      { regex: /(?:תקופה|תקופת)[:\s]*([^\n]{3,50})/gi, weight: 8 },
      
      // Committee information
      { regex: /(?:סוג\s*ועדה|סוג\s*הועדה)[:\s]*([א-ת\s]{2,50})/gi, weight: 10 },
      { regex: /(?:סניף\s*הועדה|סניף)[:\s]*([א-ת\s]{2,50})/gi, weight: 9 },
      { regex: /(?:משתתפי\s*הועדה|משתתפים)[:\s]*([א-ת\s]{3,150})/gi, weight: 8 },
      
      // Additional details
      { regex: /(?:הערות|הערה)[:\s]*([א-ת\s]{3,200})/gi, weight: 7 },
      { regex: /(?:שקלול\s*לפטור\s*ממס|שקלול)[:\s]*([א-ת\s\d%]{2,50})/gi, weight: 8 },
      
      // General Hebrew text patterns
      { regex: /[א-ת][א-ת\s]{5,}/g, weight: 3 },
      { regex: /[א-ת]{3,}/g, weight: 2 }
    ];
    
    // Apply Hebrew patterns
    const weightedResults: { text: string, weight: number }[] = [];
    
    for (const pattern of hebrewMedicalPatterns) {
      const matches = binaryString.match(pattern.regex) || [];
      console.log(`Hebrew pattern found ${matches.length} matches`);
      
      for (const match of matches.slice(0, 50)) {
        let cleaned = match
          .replace(/[^\u05D0-\u05EA\s\d\/%.\-:()]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (cleaned.length > 2 && /[\u05D0-\u05EA]/.test(cleaned)) {
          weightedResults.push({ text: cleaned, weight: pattern.weight });
        }
      }
    }
    
    // Strategy 3: Try different character encodings for Hebrew
    const encodings = ['windows-1255', 'iso-8859-8', 'utf-8', 'utf-16le'];
    
    for (const encoding of encodings) {
      try {
        console.log(`Trying encoding: ${encoding}`);
        const decoder = new TextDecoder(encoding, { fatal: false });
        const decoded = decoder.decode(uint8Array);
        
        // Look for Hebrew content in decoded text
        const hebrewSegments = decoded.match(/[א-ת][א-ת\s]{2,50}/g) || [];
        console.log(`Encoding ${encoding} found ${hebrewSegments.length} Hebrew segments`);
        
        for (const segment of hebrewSegments.slice(0, 30)) {
          const cleaned = segment.replace(/[^\u05D0-\u05EA\s]/g, ' ').trim();
          if (cleaned.length > 2) {
            weightedResults.push({ text: cleaned, weight: 6 });
          }
        }
        
        // Also look for medical keywords
        const medicalKeywords = ['ביטוח', 'לאומי', 'ועדה', 'רפואי', 'נכות', 'מבוטח', 'אבחנה', 'תאריך', 'אחוז'];
        for (const keyword of medicalKeywords) {
          if (decoded.includes(keyword)) {
            const keywordMatches = decoded.match(new RegExp(`${keyword}[^\\n]{0,100}`, 'gi')) || [];
            for (const match of keywordMatches.slice(0, 5)) {
              const cleaned = match.replace(/[^\u05D0-\u05EA\s\d\/%.\-:()]/g, ' ').trim();
              if (cleaned.length > 2) {
                weightedResults.push({ text: cleaned, weight: 8 });
              }
            }
          }
        }
        
      } catch (e) {
        console.warn(`Encoding ${encoding} failed:`, e);
      }
    }
    
    // Add extracted texts from PDF patterns
    for (const text of extractedTexts) {
      if (text.length > 2) {
        weightedResults.push({ text, weight: 4 });
      }
    }
    
    // Strategy 4: Look for structured data
    const structuredPatterns = [
      { regex: /(\d{2,3})%/g, weight: 6 },
      { regex: /\d{8,9}/g, weight: 7 },
      { regex: /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/g, weight: 7 },
    ];
    
    for (const pattern of structuredPatterns) {
      const matches = binaryString.match(pattern.regex) || [];
      for (const match of matches.slice(0, 20)) {
        weightedResults.push({ text: match, weight: pattern.weight });
      }
    }
    
    // Combine and prioritize results
    const sortedResults = weightedResults
      .sort((a, b) => (b.weight * Math.log(b.text.length + 1)) - (a.weight * Math.log(a.text.length + 1)))
      .slice(0, 200)
      .map(r => r.text);
    
    // Remove duplicates but preserve order
    const uniqueResults = sortedResults.filter((text, index, array) => 
      array.findIndex(t => t.toLowerCase() === text.toLowerCase()) === index
    );
    
    const finalText = uniqueResults.join(' ').replace(/\s+/g, ' ').trim();
    
    console.log(`Enhanced extraction found ${uniqueResults.length} unique text fragments`);
    console.log('Final result length:', finalText.length);
    console.log('Sample result:', finalText.substring(0, 500));
    
    // Special handling for digitally signed PDFs
    if (finalText.length < 100 && (binaryCheck.includes('/Sig') || binaryCheck.includes('308204'))) {
      console.log('PDF appears to be digitally signed with embedded text as images');
      
      // Try to extract any readable content from between binary blocks
      const readableSegments = this.extractReadableFromBinary(binaryString);
      if (readableSegments.length > 50) {
        console.log('Found readable segments in binary data');
        return readableSegments;
      }
      
      throw new Error(`
קובץ PDF זה מוגן בחתימה דיגיטלית והטקסט מוטמע כתמונות.

🔧 פתרונות מומלצים:

1. **העלה את הקובץ ישירות בצ'אט** 📎
   • לחץ על כפתור העלאת הקבצים בצ'אט
   • המערכת תפעיל Document Parser מתקדם + OCR

2. **המר את הקובץ:**
   • שמור את ה-PDF מחדש ללא חתימה דיגיטלית
   • השתמש בתוכנה עם OCR לחילוץ טקסט
   • נסה להדפיס ל-PDF חדש

3. **נסה קובץ אחר:**
   • PDF פשוט ללא הגנות
   • קובץ Word או Excel

האפשרות הטובה ביותר היא העלאה ישירה בצ'אט.
      `);
    }
    
    if (finalText.length < 30) {
      throw new Error('Could not extract sufficient readable text from PDF');
    }
    
    return finalText;
  }
  
  private extractReadableFromBinary(binaryString: string): string {
    // Try to find readable text segments between binary data
    const readableSegments: string[] = [];
    
    // Look for Hebrew text patterns that might be hidden in the binary
    const patterns = [
      /(?:[א-ת]\s*){3,}/g,
      /[א-ת][א-ת\s]{5,}[א-ת]/g,
      /(?:ביטוח|לאומי|ועדה|רפואי|נכות|מבוטח|אבחנה|תאריך)/g
    ];
    
    for (const pattern of patterns) {
      const matches = binaryString.match(pattern) || [];
      for (const match of matches) {
        const cleaned = match.replace(/[^\u05D0-\u05EA\s]/g, ' ').trim();
        if (cleaned.length > 3) {
          readableSegments.push(cleaned);
        }
      }
    }
    
    return readableSegments.join(' ').replace(/\s+/g, ' ').trim();
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