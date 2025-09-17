// Advanced PDF processing service with enhanced Hebrew text extraction
export class PdfService {
  
  static async extractTextFromPdf(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      let pdfjsLib: any = null;
      
      // Method 1: Try pdfjs-dist first with better configuration
      try {
        pdfjsLib = await import('pdfjs-dist');
        
        // Configure worker properly - use jsDelivr CDN
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
        for (let i = 1; i <= pdf.numPages; i++) {
          try {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            
            console.log(`Page ${i} has ${textContent.items.length} text items`);
            
            const pageText = textContent.items
              .map((item: any) => {
                if (item.str && item.str.trim()) {
                  return this.cleanAndReconstructHebrewText(item.str.trim());
                }
                return '';
              })
              .filter(str => str.length > 0)
              .join(' ')
              .trim();
            
            console.log(`Page ${i} extracted text:`, pageText.substring(0, 200));
            
            if (pageText && pageText.length > 5) {
              textPages.push(pageText);
            }
          } catch (pageError) {
            console.warn(`Error extracting text from page ${i}:`, pageError);
          }
        }
        
        const extractedText = textPages.join('\n\n').trim();
        console.log(`Total extracted text: ${extractedText.length} characters`);
        console.log(`Sample:`, extractedText.substring(0, 500));
        
        if (extractedText && extractedText.length > 20) {
          return this.finalHebrewTextCleanup(extractedText);
        }
        
      } catch (pdfjsError) {
        console.warn('pdfjs-dist failed, trying alternative approach:', pdfjsError);
      }
      
      // Method 2: Advanced binary Hebrew text extraction
      console.log('Attempting advanced Hebrew text extraction...');
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Create binary string for pattern matching
      let pdfBinary = '';
      for (let i = 0; i < Math.min(uint8Array.length, 1000000); i++) {
        pdfBinary += String.fromCharCode(uint8Array[i]);
      }
      
      console.log('Binary string created, length:', pdfBinary.length);
      
      // Advanced Hebrew text extraction with multiple patterns
      const allExtractedTexts: string[] = [];
      
      // Pattern 1: Extract text between PDF text markers
      const textMarkerPattern = /BT\s+([\s\S]*?)\s+ET/g;
      let match;
      while ((match = textMarkerPattern.exec(pdfBinary)) !== null) {
        const cleaned = this.cleanAndReconstructHebrewText(match[1]);
        if (cleaned.length > 3) {
          allExtractedTexts.push(cleaned);
        }
      }
      
      // Pattern 2: Extract text from parentheses (common in PDF text encoding)
      const parenthesesPattern = /\(([^)]+)\)/g;
      while ((match = parenthesesPattern.exec(pdfBinary)) !== null) {
        const cleaned = this.cleanAndReconstructHebrewText(match[1]);
        if (cleaned.length > 2) {
          allExtractedTexts.push(cleaned);
        }
      }
      
      // Pattern 3: Extract Hebrew character sequences
      const hebrewPattern = /[\u0590-\u05FF\u0020-\u007E\s]{5,}/g;
      while ((match = hebrewPattern.exec(pdfBinary)) !== null) {
        const cleaned = this.cleanAndReconstructHebrewText(match[0]);
        if (cleaned.length > 3) {
          allExtractedTexts.push(cleaned);
        }
      }
      
      // Pattern 4: Try different encoding approaches
      const encodingMethods = [
        { name: 'UTF-8', decoder: new TextDecoder('utf-8', { fatal: false }) },
        { name: 'Windows-1255', decoder: new TextDecoder('windows-1255', { fatal: false }) },
        { name: 'ISO-8859-8', decoder: new TextDecoder('iso-8859-8', { fatal: false }) }
      ];
      
      for (const method of encodingMethods) {
        try {
          console.log(`Trying ${method.name} encoding reconstruction...`);
          const decoded = method.decoder.decode(uint8Array);
          const textBlocks = decoded.match(/[\u0590-\u05FF\u0020-\u007E\s]{5,}/g) || [];
          
          for (const block of textBlocks.slice(0, 100)) {
            const cleaned = this.cleanAndReconstructHebrewText(block);
            if (cleaned.length > 3 && this.containsHebrewContent(cleaned)) {
              allExtractedTexts.push(cleaned);
            }
          }
        } catch (error) {
          console.warn(`${method.name} encoding failed:`, error);
        }
      }
      
      // Combine and clean all extracted text
      let combinedText = allExtractedTexts
        .filter((text, index, array) => array.indexOf(text) === index) // Remove duplicates
        .map(text => this.finalHebrewTextCleanup(text))
        .filter(text => text.length > 2)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      console.log(`Advanced extraction yielded ${combinedText.length} characters`);
      console.log('- Clean text sample (first 500 chars):', combinedText.substring(0, 500));
      console.log('- Clean text sample (last 500 chars):', combinedText.substring(Math.max(0, combinedText.length - 500)));
      console.log('- Hebrew content detected:', this.containsHebrewContent(combinedText));
      console.log('- Contains medical keywords:', this.containsMedicalKeywords(combinedText));
      
      if (combinedText && combinedText.length > 30) {
        return combinedText;
      }
      
      // If all else fails, provide a helpful error message
      throw new Error('לא ניתן לחלץ טקסט קריא מהקובץ. אנא וודא שהקובץ אינו מוגן בסיסמה ומכיל טקסט (לא רק תמונות).');
      
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error(`שגיאה בחילוץ טקסט מהקובץ: ${error.message}`);
    }
  }
  
  // Advanced Hebrew text cleaning and reconstruction methods
  private static cleanAndReconstructHebrewText(text: string): string {
    let cleaned = text
      .replace(/BT|ET|\(|\)|\[|\]/g, '') // Remove PDF markers
      .replace(/\\[0-9]{3}/g, '') // Remove octal escape sequences
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/\/[A-Za-z]+/g, '') // Remove PDF commands like /Tj, /TJ
      .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, ' ') // Remove control characters except \t and \n
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    // Hebrew character normalization and fixing common encoding issues
    cleaned = cleaned
      .replace(/[״״]/g, '"') // Normalize Hebrew quotation marks
      .replace(/[׳']/g, "'") // Normalize Hebrew apostrophes
      .replace(/[\u05F0-\u05F4]/g, '') // Remove Hebrew ligatures that may cause issues
      .replace(/[\u0591-\u05C7]/g, '') // Remove Hebrew cantillation marks and diacritics
      .replace(/\u05BE/g, '-') // Replace Hebrew maqaf with hyphen
      .replace(/\u05C0/g, '|') // Replace Hebrew paseq
      .replace(/\u05C3/g, ':') // Replace Hebrew sof pasuq
      
      // Fix common character substitutions in corrupted Hebrew PDFs
      .replace(/×/g, 'א') // Sometimes × becomes א
      .replace(/÷/g, 'ב') // Sometimes ÷ becomes ב
      .replace(/[^\u0590-\u05FF\u0020-\u007E\s\d]/g, ' ') // Keep only Hebrew, Latin, numbers, and basic punctuation
      .replace(/\s+/g, ' ')
      .trim();
    
    return cleaned;
  }
  
  private static finalHebrewTextCleanup(text: string): string {
    return text
      .replace(/[^\u0590-\u05FF\u0020-\u007E\s\d\-.,;:()\[\]]/g, ' ') // Keep only valid characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\s*([.,;:!?])\s*/g, '$1 ') // Fix punctuation spacing
      .replace(/\s+$/, '') // Remove trailing spaces
      .trim();
  }
  
  private static containsHebrewContent(text: string): boolean {
    const hebrewChars = text.match(/[\u0590-\u05FF]/g) || [];
    return hebrewChars.length > 10; // Need at least 10 Hebrew characters
  }
  
  private static containsMedicalKeywords(text: string): boolean {
    const medicalKeywords = [
      'ביטוח', 'לאומי', 'ועדה', 'רפואי', 'נכות', 'מבוטח', 'זהות', 
      'תאריך', 'סניף', 'החלטה', 'אבחנה', 'אחוז', 'נכות', 'פגיעה',
      'טופס', 'מידת', 'שקלול', 'פטור', 'ממס', 'ליקוי', 'סעיף'
    ];
    
    let found = 0;
    for (const keyword of medicalKeywords) {
      if (text.includes(keyword)) {
        found++;
      }
    }
    
    return found > 0;
  }

  static validateExtractedText(text: string, fileName: string): void {
    if (!text || text.trim().length < 20) {
      throw new Error(`הקובץ ${fileName} לא מכיל מספיק טקסט קריא`);
    }
    
    // Check for Hebrew content
    const hebrewRegex = /[\u0590-\u05FF]/;
    if (!hebrewRegex.test(text)) {
      console.warn(`No Hebrew text detected in ${fileName}`);
    }
  }
}