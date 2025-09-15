// PDF processing service with reliable browser-compatible text extraction
export class PdfService {
  
  static async extractTextFromPdf(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      let pdfjsLib: any = null;
      
      // Method 1: Try pdfjs-dist first with better configuration
      try {
        pdfjsLib = await import('pdfjs-dist');
        
        // Configure worker properly - use more reliable CDN
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
        
        console.log('Loading PDF with pdfjs-dist...');
        
        const loadingTask = pdfjsLib.getDocument({ 
          data: arrayBuffer,
          useWorkerFetch: false,
          isEvalSupported: false,
          useSystemFonts: true,
          verbosity: 0,
          standardFontDataUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/standard_fonts/`,
          cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
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
        console.warn('pdfjs-dist failed, trying alternative approach:', pdfjsError);
        
        // Try alternative PDF.js configuration  
        try {
          if (!pdfjsLib) {
            pdfjsLib = await import('pdfjs-dist');
          }
          
          const altLoadingTask = pdfjsLib.getDocument({
            data: arrayBuffer,
            disableAutoFetch: true,
            disableStream: true,
            disableFontFace: true,
            useSystemFonts: false,
            verbosity: 0
          });
          
          const altPdf = await altLoadingTask.promise;
          const altTextPages: string[] = [];
          
          for (let i = 1; i <= altPdf.numPages; i++) {
            try {
              const page = await altPdf.getPage(i);
              const textContent = await page.getTextContent({
                normalizeWhitespace: true,
                disableCombineTextItems: false
              });
              
              const pageText = textContent.items
                .map((item: any) => item.str || '')
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();
                
              if (pageText && pageText.length > 5) {
                altTextPages.push(pageText);
              }
            } catch (pageError) {
              console.warn(`Error extracting from page ${i}:`, pageError);
            }
          }
          
          const altExtractedText = altTextPages.join('\n\n').trim();
          if (altExtractedText && altExtractedText.length > 20) {
            console.log('Alternative PDF.js approach succeeded');
            return altExtractedText;
          }
          
        } catch (altError) {
          console.warn('Alternative PDF.js approach also failed:', altError);
        }
      }
      
      // Method 2: Enhanced binary text extraction for Hebrew PDFs
      console.log('Attempting enhanced binary text extraction...');
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Try UTF-8 decoding first
      try {
        const decoder = new TextDecoder('utf-8', { fatal: false });
        const decodedText = decoder.decode(uint8Array);
        
        // Look for readable Hebrew and English text
        const readableText = decodedText
          .replace(/[\x00-\x1F\x7F-\x9F]/g, ' ') // Remove control characters
          .replace(/\s+/g, ' ')
          .trim();
          
        // Extract meaningful content using patterns
        const hebrewPattern = /[\u0590-\u05FF](?:\s*[\u0590-\u05FF\u0020-\u007E])+/g;
        const englishPattern = /[A-Za-z](?:\s*[A-Za-z0-9\s])+/g;
        const numberPattern = /\d{2,}/g;
        
        const hebrewMatches = readableText.match(hebrewPattern) || [];
        const englishMatches = readableText.match(englishPattern) || [];
        const numberMatches = readableText.match(numberPattern) || [];
        
        const extractedContent = [
          ...hebrewMatches,
          ...englishMatches.filter(text => text.length > 2),
          ...numberMatches
        ].join(' ').replace(/\s+/g, ' ').trim();
        
        if (extractedContent && extractedContent.length > 50) {
          console.log(`UTF-8 decoding succeeded: ${extractedContent.length} characters`);
          return extractedContent;
        }
      } catch (utf8Error) {
        console.warn('UTF-8 decoding failed:', utf8Error);
      }
      
      // Method 3: Binary string analysis as last resort
      let binaryString = '';
      for (let i = 0; i < Math.min(uint8Array.length, 500000); i++) { // Limit to 500KB
        binaryString += String.fromCharCode(uint8Array[i]);
      }
      
      console.log('Binary string analysis - length:', binaryString.length);
      
      // Enhanced extraction patterns for Hebrew documents
      let extractedTexts: string[] = [];
      
      // Look for text between specific PDF markers
      const patterns = [
        /\(([\u0590-\u05FF\u0020-\u007E\s]+?)\)/g,  // Text in parentheses (Hebrew + Latin)
        /\[([\u0590-\u05FF\u0020-\u007E\s]+?)\]/g,  // Text in brackets  
        /BT\s+([\s\S]*?)\s+ET/g,                    // PDF text objects
        /[\u0590-\u05FF][\u0590-\u05FF\u0020\s]{2,}/g // Hebrew text sequences
      ];
      
      for (const pattern of patterns) {
        const matches = binaryString.match(pattern);
        if (matches) {
          for (const match of matches) {
            let cleaned = match
              .replace(/[BT|ET|\(|\)|\[|\]]/g, '')
              .replace(/\\[0-9]{3}/g, '') // Remove octal characters
              .replace(/\s+/g, ' ')
              .trim();
            
            // Keep text with Hebrew or meaningful Latin content
            if ((cleaned.length > 3) && 
                (/[\u0590-\u05FF]/.test(cleaned) || 
                 (/[A-Za-z]{3,}/.test(cleaned) && cleaned.length > 5))) {
              extractedTexts.push(cleaned);
            }
          }
        }
      }
      
      // Join and clean the extracted text
      let finalText = extractedTexts
        .filter((text, index, array) => array.indexOf(text) === index) // Remove duplicates
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      console.log(`Binary extraction yielded ${finalText.length} characters`);
      if (finalText.length > 0) {
        console.log('Sample extracted text:', finalText.substring(0, 200));
      }
      
      if (finalText && finalText.length > 20) {
        return finalText;
      }
      
      // If all else fails, provide a helpful error message
      throw new Error('לא ניתן לחלץ טקסט קריא מהקובץ. אנא וודא שהקובץ אינו מוגן בסיסמה ומכיל טקסט (לא רק תמונות).');
      
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error(`שגיאה בחילוץ טקסט מהקובץ: ${error.message}`);
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