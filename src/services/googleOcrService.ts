// Google Cloud Vision OCR Service for Hebrew RTL text
export class GoogleOcrService {
  
  static async extractTextFromPdf(file: File, apiKey: string): Promise<string> {
    try {
      console.log('Starting Google OCR extraction with document parsing...');
      
      let extractedTexts: string[] = [];
      
      // Method 1: Try to use document parsing first
      try {
        console.log('Attempting to parse document and extract images...');
        
        // Since we don't have access to document parser in browser,
        // let's try PDF.js to convert to high-quality images
        const images = await this.convertPdfToImages(file);
        
        if (images.length > 0) {
          console.log(`Processing ${images.length} PDF pages with Google OCR...`);
          
          for (let i = 0; i < Math.min(images.length, 3); i++) {
            try {
              const text = await this.processImageWithGoogleOcr(images[i], apiKey);
              if (text && text.trim().length > 10) {
                extractedTexts.push(text.trim());
                console.log(`Page ${i + 1} OCR result length:`, text.length);
              }
            } catch (pageError) {
              console.warn(`Google OCR failed for page ${i + 1}:`, pageError);
            }
          }
        }
        
      } catch (imageError) {
        console.warn('Image-based OCR failed:', imageError);
        
        // Method 2: Try direct text extraction as fallback
        try {
          console.log('Trying direct PDF text extraction...');
          const directText = await this.extractPdfContentDirectly(file);
          
          if (directText && directText.length > 50) {
            console.log(`Extracted ${directText.length} characters directly from PDF`);
            extractedTexts.push(directText);
          }
          
        } catch (directError) {
          console.warn('Direct text extraction also failed:', directError);
        }
      }
      
      const finalText = extractedTexts.join('\n\n').trim();
      
      console.log(`Google OCR completed: ${finalText.length} characters extracted`);
      console.log('Sample result:', finalText.substring(0, 300));
      
      if (finalText.length < 20) {
        throw new Error('Google OCR did not extract sufficient text');
      }
      
      return finalText;
      
    } catch (error) {
      console.error('Google OCR extraction failed:', error);
      throw new Error(`Google OCR failed: ${error.message}`);
    }
  }
  
  private static async processImageWithGoogleOcr(imageDataUrl: string, apiKey: string): Promise<string> {
    try {
      // Convert data URL to base64
      const base64Image = imageDataUrl.split(',')[1];
      
      // Google Cloud Vision API request
      const requestBody = {
        requests: [
          {
            image: {
              content: base64Image
            },
            features: [
              {
                type: 'TEXT_DETECTION',
                maxResults: 1
              }
            ],
            imageContext: {
              languageHints: ['he', 'en'] // Hebrew and English
            }
          }
        ]
      };
      
      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Google Vision API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }
      
      const data = await response.json();
      
      if (data.responses && data.responses[0] && data.responses[0].textAnnotations) {
        const fullText = data.responses[0].textAnnotations[0]?.description || '';
        
        // Clean and fix RTL text direction issues
        return this.fixRtlText(fullText);
      }
      
      return '';
      
    } catch (error) {
      console.error('Google Vision API call failed:', error);
      throw error;
    }
  }
  
  private static async extractPdfContentDirectly(file: File): Promise<string> {
    try {
      // Try to extract text directly from PDF using FileReader
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Convert to string and look for readable text
      let textContent = '';
      
      // Look for text in different encodings
      try {
        const decoder = new TextDecoder('utf-8', { fatal: false });
        const decoded = decoder.decode(uint8Array);
        
        // Extract Hebrew and English text patterns
        const textPatterns = [
          /[\u05D0-\u05EA\s]{3,}/g, // Hebrew text
          /[a-zA-Z\s]{3,}/g, // English text
          /\d{9}/g, // ID numbers
          /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}/g, // Dates
        ];
        
        for (const pattern of textPatterns) {
          const matches = decoded.match(pattern) || [];
          textContent += matches.join(' ') + ' ';
        }
        
        if (textContent.length > 50) {
          return textContent.trim();
        }
        
      } catch (decodingError) {
        console.warn('UTF-8 decoding failed:', decodingError);
      }
      
      // Alternative: Try to find readable text in the binary data
      let binaryText = '';
      for (let i = 0; i < Math.min(uint8Array.length, 500000); i++) {
        const byte = uint8Array[i];
        if ((byte >= 32 && byte <= 126) || // ASCII
            (byte >= 0x05D0 && byte <= 0x05EA) || // Hebrew
            byte === 10 || byte === 13 || byte === 9) {
          binaryText += String.fromCharCode(byte);
        } else if (binaryText.length > 0 && byte === 0) {
          binaryText += ' ';
        }
      }
      
      // Extract meaningful patterns from binary text
      const patterns = [
        /[א-ת]+\s*[א-ת]*/g, // Hebrew names
        /\b\d{9}\b/g, // ID numbers
        /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}\b/g, // Dates
        /(ביטוח\s*לאומי|ועדה\s*רפואית|נכות|אבחנה)/gi, // Medical terms
      ];
      
      let extractedText = '';
      for (const pattern of patterns) {
        const matches = binaryText.match(pattern) || [];
        extractedText += matches.join(' ') + ' ';
      }
      
      return extractedText.trim();
      
    } catch (error) {
      console.error('Direct PDF text extraction failed:', error);
      throw new Error('Could not extract text directly from PDF');
    }
  }
  
  private static fixRtlText(text: string): string {
    // Fix common RTL text issues and clean the text
    let cleaned = text
      // Normalize line breaks
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      
      // Fix common OCR mistakes in Hebrew
      .replace(/[״״]/g, '"')
      .replace(/[׳']/g, "'")
      
      // Clean up extra whitespace
      .replace(/\n\s*\n/g, '\n\n')
      .replace(/\t/g, ' ')
      .replace(/ {2,}/g, ' ')
      .trim();
    
    // Split into lines and process each line for RTL
    const lines = cleaned.split('\n');
    const processedLines = lines.map(line => {
      const trimmedLine = line.trim();
      
      // If line contains Hebrew, ensure proper RTL handling
      if (/[\u0590-\u05FF]/.test(trimmedLine)) {
        // Hebrew line - might need reordering if OCR mixed up the direction
        return this.fixHebrewLineDirection(trimmedLine);
      }
      
      return trimmedLine;
    });
    
    return processedLines.join('\n');
  }
  
  private static fixHebrewLineDirection(line: string): string {
    // Split line into words and check if Hebrew words are in wrong order
    const words = line.split(/\s+/);
    
    // Identify Hebrew words vs numbers/English
    const hebrewWords: string[] = [];
    const otherWords: string[] = [];
    
    for (const word of words) {
      if (/[\u0590-\u05FF]/.test(word)) {
        hebrewWords.push(word);
      } else {
        otherWords.push(word);
      }
    }
    
    // If we have both Hebrew and other content, try to reconstruct properly
    if (hebrewWords.length > 0 && otherWords.length > 0) {
      // Common pattern: Hebrew text followed by numbers/dates
      // Example: "שם המבוטח: יוסי כהן 123456789"
      const result = [...hebrewWords, ...otherWords].join(' ');
      return result;
    }
    
    return line;
  }
  
  private static async convertPdfToImages(file: File): Promise<string[]> {
    try {
      const pdfjsLib = await import('pdfjs-dist');
      
      // Try different worker configurations
      const workerUrls = [
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`,
        `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`
      ];
      
      let workerLoaded = false;
      
      for (const workerUrl of workerUrls) {
        try {
          pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
          
          const arrayBuffer = await file.arrayBuffer();
          const loadingTask = pdfjsLib.getDocument({ 
            data: arrayBuffer,
            useWorkerFetch: false,
            isEvalSupported: false
          });
          
          const pdf = await loadingTask.promise;
          console.log(`PDF loaded with worker ${workerUrl}: ${pdf.numPages} pages`);
          workerLoaded = true;
          
          const images: string[] = [];
          const maxPages = Math.min(pdf.numPages, 3);
          
          for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
            try {
              const page = await pdf.getPage(pageNum);
              
              // Create very high resolution for better OCR
              const scale = 4.0; // Higher scale for better OCR results
              const viewport = page.getViewport({ scale });
              
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              canvas.height = viewport.height;
              canvas.width = viewport.width;
              
              // Set canvas to high quality
              context.imageSmoothingEnabled = false;
              context.imageSmoothingEnabled = false;
              
              const renderContext = {
                canvasContext: context,
                viewport: viewport,
                canvas: canvas
              };
              
              await page.render(renderContext).promise;
              
              const imageDataUrl = canvas.toDataURL('image/png', 1.0);
              images.push(imageDataUrl);
              
              console.log(`Page ${pageNum} converted to image (${canvas.width}x${canvas.height})`);
              
            } catch (pageError) {
              console.warn(`Failed to convert page ${pageNum}:`, pageError);
            }
          }
          
          return images;
          
        } catch (workerError) {
          console.warn(`Worker ${workerUrl} failed:`, workerError);
          continue;
        }
      }
      
      if (!workerLoaded) {
        throw new Error('All PDF.js worker configurations failed');
      }
      
      return [];
      
    } catch (error) {
      console.error('PDF to images conversion failed:', error);
      throw new Error('Could not convert PDF to images for OCR');
    }
  }
}