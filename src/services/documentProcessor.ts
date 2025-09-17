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
    
    // Strategy 1: Look for readable text streams in PDF
    let binaryString = '';
    for (let i = 0; i < Math.min(uint8Array.length, 2000000); i++) { // Process up to 2MB
      const byte = uint8Array[i];
      if (byte >= 32 && byte <= 126) { // ASCII printable
        binaryString += String.fromCharCode(byte);
      } else if (byte >= 0x05D0 && byte <= 0x05EA) { // Hebrew range
        binaryString += String.fromCharCode(byte);
      } else {
        binaryString += ' ';
      }
    }
    
    console.log('Binary string created, searching for content...');
    
    // Strategy 2: Advanced pattern matching for Hebrew medical documents
    const extractedTexts: string[] = [];
    
    // Hebrew medical keywords and patterns
    const medicalPatterns = [
      // Form types
      { regex: /(?:ביטוח\s*לאומי|מוסד\s*לביטוח)[^\.]{0,100}/gi, weight: 10 },
      { regex: /(?:ועדה\s*רפואית|רפואי)[^\.]{0,100}/gi, weight: 10 },
      
      // Patient information
      { regex: /(?:שם\s*המבוטח|מבוטח)[:\s]*([א-ת\s]{2,40})/gi, weight: 9 },
      { regex: /(?:ת\.ז|תעודת\s*זהות)[:\s]*(\d{8,9})/gi, weight: 9 },
      
      // Medical details
      { regex: /(?:אבחנה|דיאגנוזה)[:\s]*([א-ת\s]{3,80})/gi, weight: 8 },
      { regex: /(?:אחוז\s*נכות|נכות)[:\s]*(\d{1,3}%?)/gi, weight: 8 },
      { regex: /(?:מידת\s*נכות|ליקוי)[:\s]*([א-ת\s\d%]{2,50})/gi, weight: 7 },
      
      // Dates
      { regex: /(?:תאריך|מתאריך|עד\s*תאריך)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi, weight: 7 },
      
      // Committee details
      { regex: /(?:סוג\s*ועדה|סניף)[:\s]*([א-ת\s]{2,40})/gi, weight: 6 },
      { regex: /(?:משתתפי\s*הועדה|משתתפים)[:\s]*([א-ת\s]{3,100})/gi, weight: 6 },
      
      // General Hebrew words
      { regex: /[א-ת]{3,}/g, weight: 2 }
    ];
    
    // Apply patterns with weights
    const weightedResults: { text: string, weight: number }[] = [];
    
    for (const pattern of medicalPatterns) {
      const matches = binaryString.match(pattern.regex) || [];
      console.log(`Pattern found ${matches.length} matches`);
      
      for (const match of matches.slice(0, 30)) { // Limit per pattern
        let cleaned = match
          .replace(/[^\u05D0-\u05EA\s\d\/%.\-:()]/g, ' ') // Keep Hebrew, numbers, basic punctuation
          .replace(/\s+/g, ' ')
          .trim();
        
        if (cleaned.length > 2 && /[\u05D0-\u05EA]/.test(cleaned)) {
          weightedResults.push({ text: cleaned, weight: pattern.weight });
        }
      }
    }
    
    // Strategy 3: Look for structured data patterns
    const structuredPatterns = [
      /(\d{2,3})%/g, // Percentages
      /\d{8,9}/g, // ID numbers
      /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/g, // Dates
    ];
    
    for (const pattern of structuredPatterns) {
      const matches = binaryString.match(pattern) || [];
      for (const match of matches.slice(0, 10)) {
        weightedResults.push({ text: match, weight: 5 });
      }
    }
    
    // Sort by weight and combine
    const sortedResults = weightedResults
      .sort((a, b) => (b.weight * b.text.length) - (a.weight * a.text.length))
      .slice(0, 100) // Take top 100 results
      .map(r => r.text);
    
    // Remove duplicates and combine
    const uniqueResults = Array.from(new Set(sortedResults));
    const finalText = uniqueResults.join(' ').replace(/\s+/g, ' ').trim();
    
    console.log(`Enhanced extraction found ${uniqueResults.length} text fragments`);
    console.log('Sample result:', finalText.substring(0, 300));
    
    if (finalText.length < 20) {
      // Strategy 4: Try different encodings as last resort
      const encodings = ['windows-1255', 'iso-8859-8'];
      for (const encoding of encodings) {
        try {
          const decoder = new TextDecoder(encoding, { fatal: false });
          const decoded = decoder.decode(uint8Array);
          
          const hebrewWords = decoded.match(/[א-ת]{3,}/g) || [];
          if (hebrewWords.length > 0) {
            console.log(`Found Hebrew words with ${encoding} encoding`);
            return hebrewWords.join(' ');
          }
        } catch (e) {
          console.warn(`Encoding ${encoding} failed`);
        }
      }
      
      throw new Error('Could not extract readable Hebrew text from PDF');
    }
    
    return finalText;
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