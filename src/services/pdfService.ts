// PDF processing service with reliable browser-compatible text extraction
export class PdfService {
  
  static async extractTextFromPdf(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // Method 1: Try pdfjs-dist with local worker setup
      try {
        const pdfjsLib = await import('pdfjs-dist');
        
        // Use built-in worker that comes with the package
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
        
        const loadingTask = pdfjsLib.getDocument({ 
          data: arrayBuffer,
          useWorkerFetch: false,
          isEvalSupported: false,
          useSystemFonts: true
        });
        
        const pdf = await loadingTask.promise;
        console.log(`PDF loaded successfully: ${pdf.numPages} pages`);
        
        const textPages: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          try {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            
            const pageText = textContent.items
              .map((item: any) => {
                let str = item.str || '';
                return str.trim();
              })
              .filter(str => str.length > 0)
              .join(' ')
              .trim();
            
            if (pageText) {
              textPages.push(pageText);
            }
          } catch (pageError) {
            console.warn(`Error extracting text from page ${i}:`, pageError);
          }
        }
        
        const extractedText = textPages.join('\n\n').trim();
        console.log(`Extracted ${extractedText.length} characters with pdfjs-dist`);
        
        if (extractedText && extractedText.length > 20) {
          return extractedText;
        }
        
      } catch (pdfjsError) {
        console.warn('pdfjs-dist failed, trying binary extraction:', pdfjsError);
      }
      
      // Method 2: Fallback binary text extraction for browser
      console.log('Attempting binary text extraction...');
      const uint8Array = new Uint8Array(arrayBuffer);
      let extractedText = '';
      
      // Convert to string and extract readable text
      let binaryString = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binaryString += String.fromCharCode(uint8Array[i]);
      }
      
      // Extract text between BT (Begin Text) and ET (End Text) markers
      const textObjectRegex = /BT\s+(.*?)\s+ET/gs;
      const streamRegex = /stream\s+([\s\S]*?)\s+endstream/g;
      
      let matches = binaryString.match(textObjectRegex);
      if (matches) {
        for (const match of matches) {
          // Clean up the text content
          let cleanText = match.replace(/BT\s+|ET/g, '')
            .replace(/Tj\s*|\)\s*Tj/g, ' ')
            .replace(/\[(.*?)\]/g, '$1')
            .replace(/\((.*?)\)/g, '$1')
            .replace(/[^\u0590-\u05FF\u0020-\u007E\u00A0-\u024F\s\d\.\-\(\)\[\]\:\;\/\%\,\'\"\!]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          if (cleanText.length > 3) {
            extractedText += cleanText + ' ';
          }
        }
      }
      
      // Also try to extract from stream objects
      matches = binaryString.match(streamRegex);
      if (matches) {
        for (const match of matches) {
          let streamContent = match.replace(/stream\s+|\s+endstream/g, '');
          // Extract readable characters
          let readable = streamContent
            .replace(/[^\u0590-\u05FF\u0020-\u007E\u00A0-\u024F\s\d\.\-\(\)\[\]\:\;\/\%\,\'\"\!]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          if (readable.length > 10) {
            extractedText += readable + ' ';
          }
        }
      }
      
      // Clean up final text
      extractedText = extractedText
        .replace(/\s+/g, ' ')
        .trim();
      
      console.log(`Binary extraction yielded ${extractedText.length} characters`);
      
      if (extractedText && extractedText.length > 20) {
        return extractedText;
      }
      
      throw new Error('לא ניתן לחלץ טקסט מהקובץ. הקובץ עלול להיות מוגן או סרוק (תמונה).');
      
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