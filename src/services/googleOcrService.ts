// Google Cloud Vision OCR Service for Hebrew RTL text
export class GoogleOcrService {
  
  static async extractTextFromPdf(file: File, apiKey: string): Promise<string> {
    try {
      console.log('Starting Google OCR extraction...');
      
      // Convert PDF to images first
      const images = await this.convertPdfToImages(file);
      
      if (images.length === 0) {
        throw new Error('Could not convert PDF to images for OCR');
      }
      
      console.log(`Converted PDF to ${images.length} images for OCR`);
      
      // Process each image with Google Vision API
      const extractedTexts: string[] = [];
      
      for (let i = 0; i < Math.min(images.length, 5); i++) { // Limit to 5 pages
        try {
          console.log(`Processing page ${i + 1} with Google OCR...`);
          
          const text = await this.processImageWithGoogleOcr(images[i], apiKey);
          
          if (text && text.trim().length > 5) {
            extractedTexts.push(text.trim());
            console.log(`Page ${i + 1} OCR result length:`, text.length);
          }
          
        } catch (pageError) {
          console.warn(`Google OCR failed for page ${i + 1}:`, pageError);
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
      // Use a lighter approach - try to use PDF.js if available
      const pdfjsLib = await import('pdfjs-dist');
      
      // Set worker source to match the package version
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.7.76/pdf.worker.min.js';
      
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ 
        data: arrayBuffer,
        useWorkerFetch: false,
        isEvalSupported: false
      });
      
      const pdf = await loadingTask.promise;
      console.log(`PDF loaded: ${pdf.numPages} pages`);
      
      const images: string[] = [];
      const maxPages = Math.min(pdf.numPages, 5); // Limit to 5 pages
      
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          
          // Create high-resolution canvas for better OCR
          const scale = 3.0; // Higher resolution for better OCR accuracy
          const viewport = page.getViewport({ scale });
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          // Set canvas to high quality
          context.imageSmoothingEnabled = false;
          
          // Render page to canvas
          const renderContext = {
            canvasContext: context,
            viewport: viewport,
            canvas: canvas
          };
          
          await page.render(renderContext).promise;
          
          // Convert to high-quality image
          const imageDataUrl = canvas.toDataURL('image/png', 1.0);
          images.push(imageDataUrl);
          
          console.log(`Page ${pageNum} converted to image (${canvas.width}x${canvas.height})`);
          
        } catch (pageError) {
          console.warn(`Failed to convert page ${pageNum}:`, pageError);
        }
      }
      
      return images;
      
    } catch (error) {
      console.error('PDF to images conversion failed:', error);
      throw new Error('Could not convert PDF to images for OCR');
    }
  }
}