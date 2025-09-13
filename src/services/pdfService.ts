// PDF processing service with reliable text extraction
export class PdfService {
  
  static async extractTextFromPdf(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // Method 1: Try PDF-parse (most reliable)
      try {
        const pdfParse = await import('pdf-parse');
        const data = await pdfParse.default(Buffer.from(arrayBuffer));
        
        if (data.text && data.text.trim().length > 20) {
          console.log(`PDF-parse extracted ${data.text.length} characters from ${file.name}`);
          return data.text;
        }
      } catch (parseError) {
        console.warn('PDF-parse failed, trying pdfjs-dist:', parseError);
      }
      
      // Method 2: Fallback to pdfjs-dist
      try {
        const pdfjsLib = await import('pdfjs-dist');
        
        // Set worker source
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
        }
        
        const loadingTask = pdfjsLib.getDocument({ 
          data: arrayBuffer,
          useWorkerFetch: false,
          isEvalSupported: false
        });
        
        const pdf = await loadingTask.promise;
        const textPages: string[] = [];
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          
          const pageText = textContent.items
            .map((item: any) => item.str || '')
            .filter(str => str.trim().length > 0)
            .join(' ')
            .trim();
          
          if (pageText) {
            textPages.push(pageText);
          }
        }
        
        const extractedText = textPages.join('\n\n').trim();
        console.log(`pdfjs-dist extracted ${extractedText.length} characters from ${file.name}`);
        return extractedText;
        
      } catch (pdfjsError) {
        console.error('Both PDF extraction methods failed:', pdfjsError);
        throw new Error('לא ניתן לחלץ טקסט מהקובץ. הקובץ עלול להיות מוגן או פגום.');
      }
      
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