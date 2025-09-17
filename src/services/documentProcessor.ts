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
        // First try using the document parser tool
        console.log('Using document parser for text extraction...');
        extractedText = await this.parseDocumentWithTool(file);
        
        if (extractedText && extractedText.length > 50) {
          console.log(`Document parser successfully extracted ${extractedText.length} characters`);
        } else if (this.googleApiKey) {
          // Fallback to Google OCR if document parser doesn't work well
          console.log('Document parser insufficient, trying Google OCR...');
          extractedText = await GoogleOcrService.extractTextFromPdf(file, this.googleApiKey);
          
          if (extractedText && extractedText.length > 30) {
            console.log(`Google OCR successfully extracted ${extractedText.length} characters`);
          } else {
            throw new Error('Both document parser and Google OCR failed');
          }
        } else {
          // Last resort - basic extraction
          console.log('No Google API key, trying basic extraction...');
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
  
  private async parseDocumentWithTool(file: File): Promise<string> {
    try {
      // Use PDF.js with better Hebrew text extraction
      console.log('Loading PDF.js for enhanced text extraction...');
      
      const pdfjsLib = await import('pdfjs-dist');
      
      // Set worker for PDF.js
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
      
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        useWorkerFetch: false,
        isEvalSupported: false
      });
      
      const pdf = await loadingTask.promise;
      console.log(`PDF loaded: ${pdf.numPages} pages`);
      
      let extractedTexts: string[] = [];
      const maxPages = Math.min(pdf.numPages, 3); // Process up to 3 pages
      
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          
          // Get text content
          const textContent = await page.getTextContent();
          
          // Extract text items and preserve Hebrew
          const pageTexts = textContent.items
            .filter((item: any) => item.str && item.str.trim().length > 0)
            .map((item: any) => {
              let text = item.str.trim();
              
              // Clean up text but preserve Hebrew characters
              text = text
                .replace(/\s+/g, ' ')
                .replace(/[^\u05D0-\u05EA\u0590-\u05FF\w\s\d.,;:()\-\/%]/g, ' ')
                .trim();
              
              return text;
            })
            .filter(text => text.length > 0);
          
          if (pageTexts.length > 0) {
            const pageText = pageTexts.join(' ');
            extractedTexts.push(pageText);
            console.log(`Page ${pageNum} extracted ${pageText.length} characters`);
            console.log(`Page ${pageNum} sample:`, pageText.substring(0, 200));
          }
          
        } catch (pageError) {
          console.warn(`Failed to extract text from page ${pageNum}:`, pageError);
        }
      }
      
      const finalText = extractedTexts.join('\n\n').trim();
      
      if (finalText.length > 30) {
        console.log(`PDF.js successfully extracted ${finalText.length} characters`);
        return finalText;
      } else {
        throw new Error('PDF.js extraction insufficient');
      }
      
    } catch (error) {
      console.error('PDF.js document parser failed:', error);
      throw new Error('Enhanced document parsing failed');
    }
  }
  
  private async extractTextFromArrayBuffer(arrayBuffer: ArrayBuffer, fileName: string): Promise<string> {
    // For now, fall back to the enhanced PDF text extraction
    // In the future, this could be replaced with a proper document parser integration
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Try to find readable Hebrew and English text
    const decoder = new TextDecoder('utf-8', { fatal: false });
    let content = decoder.decode(uint8Array);
    
    // Look for actual content patterns in Hebrew PDFs
    const patterns = [
      // Hebrew text patterns
      /[\u05D0-\u05EA]{2,}(?:\s+[\u05D0-\u05EA]{2,})*/g,
      // ID numbers
      /\b\d{9}\b/g,
      // Dates
      /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/g,
      // Percentages
      /\d{1,3}%/g,
      // Medical/committee terms in Hebrew
      /(ביטוח\s*לאומי|ועדה\s*רפואית|נכות|אבחנה|פגיעה|דוח\s*רפואי|משתתפי\s*הועדה)/gi
    ];
    
    const extractedParts: string[] = [];
    
    for (const pattern of patterns) {
      const matches = content.match(pattern) || [];
      extractedParts.push(...matches.slice(0, 20)); // Limit per pattern
    }
    
    if (extractedParts.length > 0) {
      return extractedParts.join(' ').trim();
    }
    
    // If no patterns found, try a different approach
    return this.extractPdfText({ arrayBuffer: () => Promise.resolve(arrayBuffer) } as File);
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