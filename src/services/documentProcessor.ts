import { ProcessedDocument } from '@/types/document';
import { PdfService } from './pdfService';
import { OpenAIService } from './openaiService';

export class DocumentProcessor {
  private openaiService: OpenAIService;
  
  constructor(apiKey: string) {
    this.openaiService = new OpenAIService(apiKey);
  }
  
  async processFile(file: File): Promise<ProcessedDocument> {
    try {
      console.log(`Starting processing of ${file.name}`);
      
      // Step 1: Extract text from PDF
      const extractedText = await PdfService.extractTextFromPdf(file);
      
      // Step 2: Validate extracted text
      PdfService.validateExtractedText(extractedText, file.name);
      
      console.log(`Extracted ${extractedText.length} characters from ${file.name}`);
      
      // Step 3: Process with OpenAI
      const extractedData = await this.openaiService.processDocumentText(extractedText, file.name);
      
      // Step 4: Create final document object
      const processedDocument: ProcessedDocument = {
        fileName: file.name,
        committeeType: extractedData.committeeType || 'לא זוהה',
        committeeDate: extractedData.committeeDate || '',
        committeeBranch: extractedData.committeeBranch || 'לא זוהה',
        insuredName: extractedData.insuredName || 'לא זוהה',
        idNumber: extractedData.idNumber || '',
        injuryDate: extractedData.injuryDate || '',
        committeeMembers: extractedData.committeeMembers || [],
        diagnoses: extractedData.diagnoses || [],
        decisionTable: extractedData.decisionTable || [],
        disabilityWeightTable: extractedData.disabilityWeightTable || [],
        processingStatus: 'completed'
      };
      
      console.log(`Successfully processed ${file.name}`);
      return processedDocument;
      
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
      
      return {
        fileName: file.name,
        committeeType: '',
        committeeDate: '',
        committeeBranch: '',
        insuredName: '',
        idNumber: '',
        injuryDate: '',
        committeeMembers: [],
        diagnoses: [],
        decisionTable: [],
        disabilityWeightTable: [],
        processingStatus: 'error',
        errorMessage: `שגיאה בעיבוד הקובץ: ${error.message}`,
      };
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