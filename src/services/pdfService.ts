// PDF processing service with reliable browser-compatible text extraction
export class PdfService {
  
  static async extractTextFromPdf(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // Method 1: Try pdfjs-dist first with better configuration
      try {
        const pdfjsLib = await import('pdfjs-dist');
        
        // Configure worker properly
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
        
        console.log('Loading PDF with pdfjs-dist...');
        
        const loadingTask = pdfjsLib.getDocument({ 
          data: arrayBuffer,
          useWorkerFetch: false,
          isEvalSupported: false,
          useSystemFonts: true,
          verbosity: 0
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
                  return item.str.trim();
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
          return extractedText;
        }
        
      } catch (pdfjsError) {
        console.warn('pdfjs-dist failed, trying binary extraction:', pdfjsError);
      }
      
      // Method 2: Enhanced binary text extraction 
      console.log('Attempting enhanced binary text extraction...');
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Convert to string for analysis
      let binaryString = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binaryString += String.fromCharCode(uint8Array[i]);
      }
      
      console.log('Binary string length:', binaryString.length);
      
      // Method 2a: Look for text objects with better regex
      let extractedTexts: string[] = [];
      
      // Enhanced text extraction patterns
      const patterns = [
        /\((.*?)\)/g,           // Text in parentheses  
        /\[(.*?)\]/g,           // Text in brackets
        /BT\s+(.*?)\s+ET/gs,    // Text objects
        /Tj\s*(.+?)(?=\s|$)/g,  // Text drawing commands
        /TJ\s*\[(.*?)\]/g       // Array-based text
      ];
      
      for (const pattern of patterns) {
        const matches = binaryString.match(pattern);
        if (matches) {
          for (const match of matches) {
            let cleaned = match
              .replace(/BT\s+|ET\s*|Tj\s*|\(|\)|\[|\]/g, '')
              .replace(/\s+/g, ' ')
              .trim();
            
            // Keep only text with Hebrew/Latin characters
            if (/[\u0590-\u05FF\u0020-\u007E]/.test(cleaned) && cleaned.length > 2) {
              extractedTexts.push(cleaned);
            }
          }
        }
      }
      
      // Method 2b: Look for readable UTF-8 sequences
      const utf8Regex = /[\u0590-\u05FF\u0020-\u007E\s]{3,}/g;
      const utf8Matches = binaryString.match(utf8Regex);
      if (utf8Matches) {
        extractedTexts = extractedTexts.concat(utf8Matches);
      }
      
      // Clean and join all extracted text
      let finalText = extractedTexts
        .map(text => text.trim())
        .filter(text => text.length > 2)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      console.log(`Binary extraction yielded ${finalText.length} characters`);
      console.log('Sample extracted text:', finalText.substring(0, 300));
      
      if (finalText && finalText.length > 20) {
        return finalText;
      }
      
      throw new Error('לא ניתן לחלץ טקסט קריא מהקובץ. הקובץ עלול להיות מוגן, מוצפן או להכיל רק תמונות.');
      
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error(`שגיאה בחילוץ טקסט: ${error.message}`);
    }
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