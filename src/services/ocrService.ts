// Advanced OCR service using Hugging Face Transformers
import { pipeline } from '@huggingface/transformers';

export class OcrService {
  private static ocrPipeline: any = null;
  
  static async initializeOcr() {
    if (!this.ocrPipeline) {
      console.log('Initializing OCR pipeline...');
      try {
        // Use TrOCR model for text recognition
        this.ocrPipeline = await pipeline(
          'image-to-text',
          'microsoft/trocr-base-printed',
          { device: 'webgpu' }
        );
        console.log('OCR pipeline initialized successfully');
      } catch (error) {
        console.warn('WebGPU not available, falling back to CPU...');
        this.ocrPipeline = await pipeline(
          'image-to-text',
          'microsoft/trocr-base-printed'
        );
      }
    }
    return this.ocrPipeline;
  }
  
  static async extractTextFromPdfWithOcr(file: File): Promise<string> {
    try {
      console.log('Starting OCR extraction for PDF...');
      
      // First convert PDF pages to images
      const images = await this.convertPdfToImages(file);
      console.log(`Converted PDF to ${images.length} images`);
      
      if (images.length === 0) {
        throw new Error('Could not convert PDF to images');
      }
      
      // Initialize OCR
      const ocr = await this.initializeOcr();
      
      // Process each image with OCR
      const extractedTexts: string[] = [];
      
      for (let i = 0; i < Math.min(images.length, 5); i++) { // Limit to first 5 pages
        try {
          console.log(`Processing page ${i + 1} with OCR...`);
          
          const result = await ocr(images[i]);
          const text = result[0]?.generated_text || '';
          
          console.log(`Page ${i + 1} OCR result:`, text.substring(0, 200));
          
          if (text && text.trim().length > 5) {
            extractedTexts.push(text.trim());
          }
        } catch (pageError) {
          console.warn(`OCR failed for page ${i + 1}:`, pageError);
        }
      }
      
      const finalText = extractedTexts.join('\n\n').trim();
      console.log(`OCR extraction completed: ${finalText.length} characters`);
      
      return finalText;
      
    } catch (error) {
      console.error('OCR extraction failed:', error);
      throw new Error(`OCR extraction failed: ${error.message}`);
    }
  }
  
  private static async convertPdfToImages(file: File): Promise<string[]> {
    try {
      // Use PDF.js to convert pages to images
      const pdfjsLib = await import('pdfjs-dist');
      
      // Set worker source to a working CDN
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ 
        data: arrayBuffer,
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: false
      });
      
      const pdf = await loadingTask.promise;
      console.log(`PDF loaded: ${pdf.numPages} pages`);
      
      const images: string[] = [];
      const maxPages = Math.min(pdf.numPages, 5); // Limit to 5 pages
      
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          
          // Create canvas for rendering
          const scale = 2.0; // Higher resolution for better OCR
          const viewport = page.getViewport({ scale });
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          // Render page to canvas
          const renderContext = {
            canvasContext: context,
            viewport: viewport,
            canvas: canvas
          };
          
          await page.render(renderContext).promise;
          
          // Convert to data URL for OCR
          const imageDataUrl = canvas.toDataURL('image/png');
          images.push(imageDataUrl);
          
          console.log(`Page ${pageNum} converted to image`);
          
        } catch (pageError) {
          console.warn(`Failed to convert page ${pageNum}:`, pageError);
        }
      }
      
      return images;
      
    } catch (error) {
      console.error('PDF to images conversion failed:', error);
      
      // Fallback: try to create a simple image representation
      try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 800;
        canvas.height = 1000;
        
        // Fill with white background
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add some text indicating conversion failed
        context.fillStyle = 'black';
        context.font = '20px Arial';
        context.fillText('PDF conversion failed', 50, 50);
        
        return [canvas.toDataURL('image/png')];
      } catch (fallbackError) {
        console.error('Fallback image creation failed:', fallbackError);
        return [];
      }
    }
  }
}