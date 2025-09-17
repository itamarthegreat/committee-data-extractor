// Advanced PDF processing service with OCR fallback for Hebrew documents
import { createWorker } from 'tesseract.js';

export class PdfService {
  
  static async extractTextFromPdf(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      let pdfjsLib: any = null;
      
      // Method 1: Try pdfjs-dist first with optimized Hebrew settings
      try {
        pdfjsLib = await import('pdfjs-dist');
        
        // Configure worker properly
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
        
        console.log('Loading PDF with pdfjs-dist...');
        
        const loadingTask = pdfjsLib.getDocument({ 
          data: arrayBuffer,
          useWorkerFetch: false,
          isEvalSupported: false,
          useSystemFonts: true,
          verbosity: 0,
          standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
          cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
          cMapPacked: true
        });
        
        const pdf = await loadingTask.promise;
        console.log(`PDF loaded successfully: ${pdf.numPages} pages`);
        
        const textPages: string[] = [];
        for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) { // Process first 5 pages max
          try {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent({
              normalizeWhitespace: true,
              disableCombineTextItems: false
            });
            
            console.log(`Page ${i} has ${textContent.items.length} text items`);
            
            const pageText = textContent.items
              .map((item: any) => {
                if (item.str && item.str.trim()) {
                  return item.str.trim();
                }
                return '';
              })
              .filter(str => str.length > 0)
              .join(' ')
              .trim();
            
            console.log(`Page ${i} raw text:`, pageText.substring(0, 200));
            
            // Check if the extracted text looks readable
            const readabilityScore = this.calculateTextReadability(pageText);
            console.log(`Page ${i} readability score:`, readabilityScore);
            
            if (readabilityScore > 0.3) { // If text seems readable (30% readable characters)
              const cleanText = this.cleanHebrewText(pageText);
              if (cleanText.length > 10) {
                textPages.push(cleanText);
              }
            }
          } catch (pageError) {
            console.warn(`Error extracting text from page ${i}:`, pageError);
          }
        }
        
        const extractedText = textPages.join('\n\n').trim();
        console.log(`Total extracted text: ${extractedText.length} characters`);
        
        if (extractedText && extractedText.length > 50 && this.containsHebrewContent(extractedText)) {
          console.log('PDF.js extraction successful, returning text');
          return extractedText;
        } else {
          console.log('PDF.js extraction failed or text not readable, trying OCR...');
        }
        
      } catch (pdfjsError) {
        console.warn('pdfjs-dist failed:', pdfjsError);
      }
      
      // Method 2: OCR approach using Tesseract.js for Hebrew
      console.log('Attempting OCR extraction for Hebrew text...');
      
      try {
        // First, convert PDF pages to images using PDF.js
        if (!pdfjsLib) {
          pdfjsLib = await import('pdfjs-dist');
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
        }
        
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        const ocrResults: string[] = [];
        const maxPages = Math.min(pdf.numPages, 3); // Process first 3 pages with OCR
        
        for (let i = 1; i <= maxPages; i++) {
          try {
            console.log(`Processing page ${i} with OCR...`);
            const page = await pdf.getPage(i);
            
            // Get page as image
            const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            const renderContext = {
              canvasContext: context,
              viewport: viewport
            };
            
            await page.render(renderContext).promise;
            
            // Convert canvas to image data for Tesseract
            const imageData = canvas.toDataURL('image/png');
            
            // Use Tesseract.js with Hebrew language
            const worker = await createWorker('heb+eng'); // Hebrew + English
            console.log(`Running OCR on page ${i}...`);
            
            const { data: { text } } = await worker.recognize(imageData);
            await worker.terminate();
            
            console.log(`OCR page ${i} result length:`, text.length);
            console.log(`OCR page ${i} sample:`, text.substring(0, 200));
            
            if (text && text.trim().length > 20) {
              const cleanedOcrText = this.cleanHebrewText(text);
              if (cleanedOcrText.length > 10) {
                ocrResults.push(cleanedOcrText);
              }
            }
            
          } catch (ocrPageError) {
            console.warn(`OCR failed for page ${i}:`, ocrPageError);
          }
        }
        
        const ocrText = ocrResults.join('\n\n').trim();
        console.log(`OCR total extracted text: ${ocrText.length} characters`);
        
        if (ocrText && ocrText.length > 50) {
          console.log('OCR extraction successful');
          return ocrText;
        }
        
      } catch (ocrError) {
        console.warn('OCR extraction failed:', ocrError);
      }
      
      // Method 3: Final fallback - enhanced binary extraction
      console.log('Attempting enhanced binary text extraction as final fallback...');
      const binaryResult = await this.binaryTextExtraction(arrayBuffer);
      
      if (binaryResult && binaryResult.length > 30) {
        return binaryResult;
      }
      
      // If all methods fail
      throw new Error('לא ניתן לחלץ טקסט קריא מהקובץ. ייתכן שהקובץ מוגן בסיסמה, מכיל רק תמונות, או שהטקסט מקודד בפורמט לא נתמך.');
      
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error(`שגיאה בחילוץ טקסט מהקובץ: ${error.message}`);
    }
  }
  
  private static async binaryTextExtraction(arrayBuffer: ArrayBuffer): Promise<string> {
    const uint8Array = new Uint8Array(arrayBuffer);
    const textResults: string[] = [];
    
    // Try different encoding methods
    const encodings = ['utf-8', 'windows-1255', 'iso-8859-8'];
    
    for (const encoding of encodings) {
      try {
        const decoder = new TextDecoder(encoding, { fatal: false });
        const decodedText = decoder.decode(uint8Array);
        
        // Extract text using regex patterns
        const patterns = [
          /\(([\u0590-\u05FF\s\u0020-\u007E]{3,}?)\)/g, // Text in parentheses
          /[\u0590-\u05FF][\u0590-\u05FF\s\u0020-\u007E]{5,}/g, // Hebrew sequences
        ];
        
        for (const pattern of patterns) {
          const matches = decodedText.match(pattern) || [];
          for (const match of matches.slice(0, 100)) { // Limit matches
            const cleaned = this.cleanHebrewText(match.replace(/[()]/g, ''));
            if (cleaned.length > 3 && this.containsHebrewContent(cleaned)) {
              textResults.push(cleaned);
            }
          }
        }
      } catch (err) {
        console.warn(`Binary extraction with ${encoding} failed:`, err);
      }
    }
    
    return textResults
      .filter((text, index, array) => array.indexOf(text) === index) // Remove duplicates
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  private static calculateTextReadability(text: string): number {
    if (!text || text.length === 0) return 0;
    
    const hebrewChars = (text.match(/[\u0590-\u05FF]/g) || []).length;
    const englishChars = (text.match(/[A-Za-z]/g) || []).length;
    const digits = (text.match(/[0-9]/g) || []).length;
    const spaces = (text.match(/\s/g) || []).length;
    const punctuation = (text.match(/[.,;:!?\-()]/g) || []).length;
    
    const readableChars = hebrewChars + englishChars + digits + spaces + punctuation;
    const totalChars = text.length;
    
    return totalChars > 0 ? readableChars / totalChars : 0;
  }
  
  private static cleanHebrewText(text: string): string {
    return text
      .replace(/[\u0591-\u05C7]/g, '') // Remove Hebrew diacritics
      .replace(/[\x00-\x08\x0B-\x1F\x7F-\x9F]/g, ' ') // Remove control characters
      .replace(/[^\u0590-\u05FF\u0020-\u007E\s\d\-.,;:()\[\]]/g, ' ') // Keep only valid characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }
  
  private static containsHebrewContent(text: string): boolean {
    const hebrewChars = text.match(/[\u0590-\u05FF]/g) || [];
    return hebrewChars.length >= 5; // Need at least 5 Hebrew characters
  }
  
  private static containsMedicalKeywords(text: string): boolean {
    const medicalKeywords = [
      'ביטוח', 'לאומי', 'ועדה', 'רפואי', 'נכות', 'מבוטח', 'זהות', 
      'תאריך', 'סניף', 'החלטה', 'אבחנה', 'אחוז', 'פגיעה',
      'טופס', 'מידת', 'שקלול', 'פטור', 'ממס', 'ליקוי', 'סעיף'
    ];
    
    return medicalKeywords.some(keyword => text.includes(keyword));
  }

  static validateExtractedText(text: string, fileName: string): void {
    if (!text || text.trim().length < 20) {
      throw new Error(`הקובץ ${fileName} לא מכיל מספיק טקסט קריא`);
    }
    
    if (!this.containsHebrewContent(text)) {
      console.warn(`No substantial Hebrew text detected in ${fileName}`);
    }
  }
}