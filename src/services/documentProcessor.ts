import { ProcessedDocument } from '@/types/document';
import { supabase } from '@/integrations/supabase/client';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

// Set up PDF.js worker using version-specific URL
GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.54/pdf.worker.min.mjs`;

export class DocumentProcessor {
  
  constructor() {
    // No longer need API keys in constructor - they're handled server-side
  }

  async processFile(file: File): Promise<ProcessedDocument> {
    try {
      console.log(`Starting to process file: ${file.name}`);
      
      let extractedText = '';
      
      // Try PDF.js first
      try {
        console.log('Using PDF.js for text extraction...');
        extractedText = await this.extractPdfTextWithPdfJs(file);
        
        if (extractedText && extractedText.length > 50) {
          console.log(`PDF.js successfully extracted ${extractedText.length} characters`);
        } else {
          throw new Error('PDF.js extracted insufficient text');
        }
      } catch (pdfError) {
        console.warn('PDF.js failed:', pdfError.message);
        
        // PDF is likely scanned - send to server for OCR processing
        console.log('PDF appears to be scanned, sending to server for OCR processing...');
        try {
          const result = await this.processFileWithServer(file);
          return {
            fileName: file.name,
            processingStatus: 'completed',
            ...result
          } as ProcessedDocument;
        } catch (serverError) {
          console.error('Server OCR processing failed:', serverError.message);
          throw new Error(`לא ניתן לעבד את הקובץ: ${serverError.message}`);
        }
      }
      
      console.log(`Successfully extracted ${extractedText.length} characters`);
      
      // Process with server-side OpenAI
      const extractedData = await this.processDocumentTextWithServer(extractedText, file.name);
      
      const finalDocument = {
        fileName: file.name,
        processingStatus: 'completed',
        ...extractedData
      } as ProcessedDocument;
      
      return finalDocument;
      
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
      return {
        fileName: file.name,
        "כותרת הועדה": null,
        "סוג ועדה": null,
        "שם טופס": null,
        "סניף הוועדה": null,
        "שם המבוטח": null,
        "ת.ז:": null,
        "תאריך ועדה": null,
        "תאריך פגיעה(רק באיבה,נכות מעבודה)": null,
        "משתתף ועדה 1": null,
        "משתתף ועדה 2": null,
        "משתתף ועדה 3": null,
        "משתתף ועדה 4": null,
        "החלטות": null,
        "אחוז הנכות הנובע מהפגיעה": null,
        "אחוז הנכות משוקלל": null,
        "שקלול לפטור ממס": null,
        processingStatus: 'error',
        errorMessage: error.message
      } as ProcessedDocument;
    }
  }

  private async processDocumentTextWithServer(text: string, fileName: string): Promise<Partial<ProcessedDocument>> {
    try {
      const { data, error } = await supabase.functions.invoke('process-text', {
        body: { text, fileName }
      });

      if (error) {
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Server-side text processing error:', error);
      throw new Error(`שגיאה בעיבוד עם OpenAI: ${error.message}`);
    }
  }

  private async processFileWithServer(file: File): Promise<Partial<ProcessedDocument>> {
    try {
      // Convert file to base64 for server processing with OCR
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const base64 = btoa(String.fromCharCode(...uint8Array));
      
      console.log(`Sending file to server for OCR processing: ${file.name} (${base64.length} base64 chars)`);
      
      const { data, error } = await supabase.functions.invoke('process-documents', {
        body: { 
          fileData: base64,
          fileName: file.name,
          mimeType: file.type || 'application/pdf'
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Server-side file processing error:', error);
      throw new Error(`שגיאה בעיבוד הקובץ בשרת: ${error.message}`);
    }
  }

  private async extractPdfTextWithPdfJs(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      
      for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 10); pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Combine text items into readable text
        const pageText = textContent.items
          .filter((item: any) => item.str && item.str.trim())
          .map((item: any) => item.str)
          .join(' ');
        
        fullText += pageText + '\n\n';
      }
      
      console.log(`PDF.js extracted ${fullText.length} characters from ${Math.min(pdf.numPages, 10)} pages`);
      
      if (fullText.length < 50) {
        throw new Error('PDF.js extracted insufficient text');
      }
      
      return fullText.trim();
    } catch (error) {
      console.error('PDF.js extraction failed:', error);
      throw new Error(`PDF.js failed: ${error.message}`);
    }
  }

  private async parseDocumentWithTool(file: File): Promise<string> {
    try {
      console.log('Trying enhanced Hebrew text extraction...');
      
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      let extractedTexts: string[] = [];
      
      // Look for Hebrew medical document patterns
      const hebrewPatterns = [
        /([א-ת]{2,})\s+([א-ת]{2,})(?:\s+([א-ת]{2,}))?/g,
        /ועדה\s*רפואית[^]*?(?=\n|\.)/gi,
        /ביטוח\s*לאומי[^]*?(?=\n|\.)/gi,
        /שם[:\s]*המבוטח[:\s]*([א-ת\s]{3,50})/gi,
        /[א-ת]{3,}/g
      ];
      
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const content = decoder.decode(uint8Array);
      
      for (const pattern of hebrewPatterns) {
        const matches = content.match(pattern) || [];
        if (matches.length > 0) {
          extractedTexts.push(...matches.slice(0, 10));
        }
      }
      
      const finalText = [...new Set(extractedTexts)]
        .filter(text => text && text.trim().length > 1)
        .map(text => text.trim())
        .slice(0, 50)
        .join(' ').trim();
      
      if (finalText.length > 100) {
        return finalText;
      } else {
        throw new Error('Enhanced extraction insufficient');
      }
      
    } catch (error) {
      console.error('Enhanced Hebrew document parser failed:', error);
      throw new Error('Enhanced document parsing failed');
    }
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