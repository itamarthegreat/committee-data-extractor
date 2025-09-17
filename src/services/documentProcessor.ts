import { ProcessedDocument } from '@/types/document';
import { OpenAIService } from './openaiService';
import { GoogleOcrService } from './googleOcrService';

export class DocumentProcessor {
  private openaiService: OpenAIService;
  private googleApiKey: string | null = null;
  
  constructor(apiKey: string, googleApiKey?: string) {
    this.openaiService = new OpenAIService(apiKey);
    this.googleApiKey = googleApiKey || this.getStoredGoogleApiKey();
  }
  
  private getStoredGoogleApiKey(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('googleCloudApiKey');
    }
    return null;
  }
  
  setGoogleApiKey(apiKey: string): void {
    this.googleApiKey = apiKey;
    if (typeof window !== 'undefined') {
      localStorage.setItem('googleCloudApiKey', apiKey);
    }
  }
  
  async processFile(file: File): Promise<ProcessedDocument> {
    try {
      console.log(`Starting to process file: ${file.name}`);
      
      let extractedText = '';
      
      try {
        // Try Google OCR first if API key is available
        if (this.googleApiKey) {
          console.log('Using document parser + Google OCR for text extraction...');
          extractedText = await GoogleOcrService.extractTextFromPdf(file, this.googleApiKey);
          
          if (extractedText && extractedText.length > 30) {
            console.log(`Google OCR successfully extracted ${extractedText.length} characters`);
          } else {
            throw new Error('Google OCR did not extract sufficient text');
          }
        } else {
          // Fallback to basic extraction
          console.log('No Google API key found, using basic extraction...');
          extractedText = await this.extractPdfText(file);
          
          if (!extractedText || extractedText.length < 20) {
            throw new Error('Could not extract sufficient text');
          }
        }
        
        console.log(`Successfully extracted ${extractedText.length} characters`);
        
      } catch (error) {
        console.error('Text extraction failed:', error);
        
        if (!this.googleApiKey) {
          throw new Error(`
לא ניתן לחלץ טקסט מהקובץ.

🔑 הוסף מפתח Google Cloud Vision API לתוצאות טובות יותר:

1. צור פרויקט ב-Google Cloud Console
2. הפעל את Vision API
3. צור API Key
4. הוסף את המפתח בהגדרות המערכת

או נסה קובץ PDF פשוט יותר.
          `);
        }
        
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
  
  private async extractPdfText(file: File): Promise<string> {
    console.log('Starting advanced PDF text extraction...');
    
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Strategy 1: Look for readable text using multiple approaches
    const extractedTexts: string[] = [];
    
    // Create binary string
    let binaryString = '';
    for (let i = 0; i < Math.min(uint8Array.length, 3000000); i++) {
      const byte = uint8Array[i];
      if ((byte >= 32 && byte <= 126) || // ASCII
          (byte >= 0x05D0 && byte <= 0x05EA) || // Hebrew
          byte === 10 || byte === 13 || byte === 9) {
        binaryString += String.fromCharCode(byte);
      } else {
        binaryString += ' ';
      }
    }
    
    console.log('Binary string created, length:', binaryString.length);
    
    // Strategy 2: Extract based on known patterns from analyzed document
    const patterns = [
      // Names (Hebrew names like "קיבוביץ מיקה")
      { regex: /([א-ת]+\s*[א-ת]*)\s*([א-ת]+)/g, type: 'name', weight: 10 },
      
      // ID numbers (9 digits like "221635089") 
      { regex: /\b\d{9}\b/g, type: 'id', weight: 10 },
      
      // Dates (various formats)
      { regex: /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}\b/g, type: 'date', weight: 9 },
      
      // Medical codes (like "F43")
      { regex: /\b[A-Z]\d{2,3}\b/g, type: 'medical_code', weight: 8 },
      
      // Percentages
      { regex: /\b\d{1,3}%/g, type: 'percentage', weight: 8 },
      
      // Committee numbers (like "NV-45035-3900")
      { regex: /[A-Z]{2}-\d{5}-\d{4}/g, type: 'committee_number', weight: 9 },
      
      // Phone numbers
      { regex: /\b0\d{2}-\d{7}\b/g, type: 'phone', weight: 7 },
      
      // Medical keywords in Hebrew
      { regex: /(ביטוח\s*לאומי|ועדה\s*רפואית|נכות|אבחנה|פגיעה|דחק|טראומה|הפרעת|חרדה)/gi, type: 'medical_term', weight: 8 },
      
      // Committee-related terms
      { regex: /(משתתפי\s*הועדה|סניף|תאריך\s*הועדה|דוח\s*רפואי)/gi, type: 'committee_term', weight: 7 },
      
      // Hebrew words (general)
      { regex: /[א-ת]{3,}/g, type: 'hebrew_word', weight: 3 }
    ];
    
    const foundData: { text: string, type: string, weight: number }[] = [];
    
    for (const pattern of patterns) {
      const matches = binaryString.match(pattern.regex) || [];
      console.log(`Pattern ${pattern.type} found ${matches.length} matches`);
      
      for (const match of matches.slice(0, 50)) {
        const cleaned = match.trim().replace(/\s+/g, ' ');
        if (cleaned.length > 1) {
          foundData.push({ text: cleaned, type: pattern.type, weight: pattern.weight });
        }
      }
    }
    
    // Strategy 3: Try different character encodings for Hebrew
    const encodings = ['windows-1255', 'iso-8859-8', 'utf-8'];
    
    for (const encoding of encodings) {
      try {
        const decoder = new TextDecoder(encoding, { fatal: false });
        const decoded = decoder.decode(uint8Array);
        
        // Look for Hebrew medical terms in decoded text
        const hebrewMedicalTerms = [
          'ביטוח לאומי', 'ועדה רפואית', 'נכות', 'אבחנה', 'פגיעה', 
          'דוח רפואי', 'משתתפי הועדה', 'סניף', 'אחוז נכות'
        ];
        
        for (const term of hebrewMedicalTerms) {
          const regex = new RegExp(`${term}[^\\n]{0,100}`, 'gi');
          const matches = decoded.match(regex) || [];
          
          for (const match of matches) {
            const cleaned = match.replace(/[^\u05D0-\u05EA\s\d\/%.\-:()]/g, ' ').trim();
            if (cleaned.length > 3) {
              foundData.push({ text: cleaned, type: 'medical_context', weight: 9 });
            }
          }
        }
        
        // Extract Hebrew names and text segments
        const hebrewSegments = decoded.match(/[א-ת][א-ת\s]{2,50}/g) || [];
        for (const segment of hebrewSegments.slice(0, 30)) {
          const cleaned = segment.replace(/[^\u05D0-\u05EA\s]/g, ' ').trim();
          if (cleaned.length > 2) {
            foundData.push({ text: cleaned, type: 'hebrew_text', weight: 5 });
          }
        }
        
      } catch (err) {
        console.warn(`Encoding ${encoding} failed:`, err);
      }
    }
    
    // Sort by weight and relevance
    const sortedData = foundData
      .sort((a, b) => (b.weight * Math.log(b.text.length + 1)) - (a.weight * Math.log(a.text.length + 1)))
      .slice(0, 200);
    
    // Build structured text output
    const structuredText: string[] = [];
    
    // Group by type for better organization
    const groupedData: { [key: string]: string[] } = {};
    
    for (const item of sortedData) {
      if (!groupedData[item.type]) {
        groupedData[item.type] = [];
      }
      if (!groupedData[item.type].includes(item.text)) {
        groupedData[item.type].push(item.text);
      }
    }
    
    // Add to structured text in order of importance
    const typeOrder = ['name', 'id', 'committee_number', 'date', 'medical_code', 'percentage', 'phone', 'medical_term', 'committee_term', 'medical_context', 'hebrew_text', 'hebrew_word'];
    
    for (const type of typeOrder) {
      if (groupedData[type]) {
        structuredText.push(...groupedData[type].slice(0, 20)); // Limit per type
      }
    }
    
    const finalText = structuredText.join(' ').replace(/\s+/g, ' ').trim();
    
    console.log(`Extracted ${structuredText.length} text elements`);
    console.log('Final text length:', finalText.length);
    console.log('Sample:', finalText.substring(0, 300));
    
    if (finalText.length < 30) {
      throw new Error('Could not extract sufficient readable text from PDF');
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