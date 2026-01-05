import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessedDocument {
  fileName: string;
  "כותרת הועדה": string | null;
  "סוג ועדה": string | null;
  "שם טופס": string | null;
  "סניף הוועדה": string | null;
  "שם המבוטח": string | null;
  "ת.ז:": string | null;
  "תאריך ועדה": string | null;
  "תאריך פגיעה(רק באיבה,נכות מעבודה)": string | null;
  "משתתף ועדה 1": string | null;
  "משתתף ועדה 2": string | null;
  "משתתף ועדה 3": string | null;
  "משתתף ועדה 4": string | null;
  "החלטות": any[] | null;
  "אחוז הנכות הנובע מהפגיעה": string | null;
  "אחוז הנכות משוקלל": string | null;
  "שקלול לפטור ממס": string | null;
  processingStatus: 'completed' | 'error';
  errorMessage?: string;
}

class DocumentProcessor {
  private azureEndpoint: string;
  private azureApiKey: string;
  private azureDeploymentName: string;
  private googleApiKey: string;

  constructor(azureEndpoint: string, azureApiKey: string, azureDeploymentName: string, googleApiKey: string) {
    this.azureEndpoint = azureEndpoint;
    this.azureApiKey = azureApiKey;
    this.azureDeploymentName = azureDeploymentName;
    this.googleApiKey = googleApiKey;
  }

  async processFile(fileData: Uint8Array, fileName: string, mimeType: string): Promise<ProcessedDocument> {
    try {
      console.log(`Starting to process file: ${fileName}`);
      
      let extractedText = '';
      
      // Try direct Azure OpenAI processing first for PDFs
      if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
        try {
          console.log('Trying direct Azure OpenAI file processing...');
          const base64 = this.arrayBufferToBase64(fileData);
          const result = await this.processDocumentFileWithAzureOpenAI(base64, fileName, mimeType);
          if (result && Object.keys(result).length > 3) {
            console.log('Direct Azure OpenAI processing successful');
            return {
              fileName,
              processingStatus: 'completed',
              ...result
            } as ProcessedDocument;
          }
        } catch (directError) {
          console.warn('Direct Azure OpenAI processing failed:', directError instanceof Error ? directError.message : 'Unknown error');
        }
      }

      // Fallback to text extraction methods
      try {
        console.log('Trying enhanced text extraction...');
        extractedText = await this.extractTextFromPdf(fileData);
        
        if (extractedText && extractedText.length > 50) {
          console.log(`Enhanced extraction successful: ${extractedText.length} characters`);
        } else {
          throw new Error('Enhanced extraction insufficient');
        }
      } catch (extractionError) {
        console.warn('Enhanced extraction failed:', extractionError instanceof Error ? extractionError.message : 'Unknown error');
        
        // Try Google OCR if available
        if (this.googleApiKey) {
          try {
            console.log('Trying Google OCR...');
            extractedText = await this.processWithGoogleOCR(fileData, fileName);
            
            if (extractedText && extractedText.length > 30) {
              console.log(`Google OCR successful: ${extractedText.length} characters`);
            } else {
              throw new Error('Google OCR insufficient');
            }
          } catch (googleError) {
            console.warn('Google OCR failed:', googleError instanceof Error ? googleError.message : 'Unknown error');
            throw new Error('כל שיטות חילוץ הטקסט נכשלו');
          }
        } else {
          throw new Error('לא ניתן לחלץ טקסט מהקובץ');
        }
      }

      // Process with Azure OpenAI
      console.log(`Processing extracted text with Azure OpenAI: ${extractedText.length} characters`);
      const extractedData = await this.processDocumentTextWithAzureOpenAI(extractedText, fileName);
      
      return {
        fileName,
        processingStatus: 'completed',
        ...extractedData
      } as ProcessedDocument;
      
    } catch (error) {
      console.error(`Error processing file ${fileName}:`, error);
      return {
        fileName,
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
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      } as ProcessedDocument;
    }
  }

  private async processDocumentFileWithAzureOpenAI(base64: string, fileName: string, mimeType: string): Promise<Partial<ProcessedDocument>> {
    const prompt = this.createEnhancedExtractionPrompt("");
    
    const azureUrl = `${this.azureEndpoint}/openai/deployments/${this.azureDeploymentName}/chat/completions?api-version=2024-02-15-preview`;
    
    const response = await fetch(azureUrl, {
      method: 'POST',
      headers: {
        'api-key': this.azureApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `${prompt}\n\nהקובץ המצורף הוא מסמך ועדה רפואית בעברית. אנא חלץ את המידע הנדרש מהמסמך:`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                  detail: "high"
                }
              }
            ]
          }
        ],
        max_tokens: 4000
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Azure OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    if (!content) {
      throw new Error('Azure OpenAI returned empty response');
    }

    return this.parseOpenAIResponse(content);
  }

  private async processDocumentTextWithAzureOpenAI(text: string, fileName: string): Promise<Partial<ProcessedDocument>> {
    const cleanedText = this.cleanHebrewText(text);
    const maxLength = 15000;
    const truncatedText = cleanedText.length > maxLength ? cleanedText.substring(0, maxLength) + '...' : cleanedText;
    
    const readableRatio = this.calculateReadableRatio(truncatedText);
    console.log(`Text readability ratio: ${readableRatio}%`);
    
    if (readableRatio < 30) {
      throw new Error('הטקסט שנחלץ מהקובץ אינו קריא מספיק');
    }
    
    const prompt = this.createEnhancedExtractionPrompt(truncatedText);
    
    const azureUrl = `${this.azureEndpoint}/openai/deployments/${this.azureDeploymentName}/chat/completions?api-version=2024-02-15-preview`;
    
    const response = await fetch(azureUrl, {
      method: 'POST',
      headers: {
        'api-key': this.azureApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Azure OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    if (!content) {
      throw new Error('Azure OpenAI returned empty response');
    }

    return this.parseOpenAIResponse(content);
  }

  private async processWithGoogleOCR(fileData: Uint8Array, fileName: string): Promise<string> {
    const base64 = this.arrayBufferToBase64(fileData);
    
    const requestBody = {
      requests: [
        {
          image: {
            content: base64
          },
          features: [
            {
              type: 'DOCUMENT_TEXT_DETECTION',
              maxResults: 1
            }
          ],
          imageContext: {
            languageHints: ['he', 'en']
          }
        }
      ]
    };
    
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${this.googleApiKey}`,
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
      return this.fixRtlText(fullText);
    }
    
    return '';
  }

  private extractTextFromPdf(fileData: Uint8Array): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        let extractedTexts: string[] = [];
        
        const hebrewDecodingStrategies = [
          () => {
            const decoder = new TextDecoder('utf-8', { fatal: false });
            return decoder.decode(fileData);
          },
          () => {
            let result = '';
            for (let i = 0; i < fileData.length; i++) {
              const byte = fileData[i];
              if (byte >= 224 && byte <= 250) {
                result += String.fromCharCode(0x05D0 + (byte - 224));
              } else if (byte >= 32 && byte <= 126) {
                result += String.fromCharCode(byte);
              } else if (byte === 13 || byte === 10 || byte === 9) {
                result += String.fromCharCode(byte);
              } else {
                result += ' ';
              }
            }
            return result;
          }
        ];
        
        for (let strategyIndex = 0; strategyIndex < hebrewDecodingStrategies.length; strategyIndex++) {
          try {
            const content = hebrewDecodingStrategies[strategyIndex]();
            
            const hebrewPatterns = [
              /([א-ת]{2,})\s+([א-ת]{2,})(?:\s+([א-ת]{2,}))?/g,
              /ועדה\s*רפואית[^]*?(?=\n|\.)/gi,
              /ביטוח\s*לאומי[^]*?(?=\n|\.)/gi,
              /שם[:\s]*המבוטח[:\s]*([א-ת\s]{3,50})/gi,
              /מבוטח[:\s]*([א-ת\s]{3,30})/gi,
              /אבחנה[:\s]*([א-ת\s\d]{3,100})/gi,
              /אחוז[:\s]*נכות[:\s]*(\d{1,3}%?)/gi,
              /סניף[:\s]*([א-ת\s]{3,30})/gi,
              /משתתפי[:\s]*הועדה[:\s]*([א-ת\s\d\."]{10,200})/gi,
              /[א-ת]{3,}/g
            ];
            
            for (const pattern of hebrewPatterns) {
              const matches = content.match(pattern) || [];
              if (matches.length > 0) {
                extractedTexts.push(...matches.slice(0, 10));
              }
            }
            
            const dataPatterns = [
              /\b\d{9}\b/g,
              /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}/g,
              /\d{1,3}%/g,
            ];
            
            for (const pattern of dataPatterns) {
              const matches = content.match(pattern) || [];
              extractedTexts.push(...matches.slice(0, 15));
            }
            
          } catch (strategyError) {
            console.warn(`Hebrew decoding strategy ${strategyIndex + 1} failed:`, strategyError);
          }
        }
        
        const uniqueTexts = [...new Set(extractedTexts)]
          .filter(text => text && text.trim().length > 1)
          .map(text => text.trim())
          .slice(0, 50);
        
        const finalText = uniqueTexts.join(' ').trim();
        
        if (finalText.length > 100) {
          resolve(finalText);
        } else {
          reject(new Error('Enhanced extraction insufficient'));
        }
        
      } catch (error) {
        reject(new Error('Enhanced document parsing failed'));
      }
    });
  }

  private createEnhancedExtractionPrompt(text: string): string {
    return `אתה מומחה בחילוץ מידע ממסמכי ועדות רפואיות של ביטוח לאומי בעברית.

**כללים קריטיים:**
1. חפש בכל העמודים - לא רק בעמודים פנימיים
2. כל שדה חייב להתבסס על מידע מדויק מהמסמך - לא להמציא כלום!
3. אם המידע לא נמצא במסמך - החזר null במקום לנחש
4. שים לב למידע בכותרות ובתחילת המסמך

**טקסט המסמך:**
${text}

**משימה:** חלץ מידע מכל העמודים:

**1. פרטי המבוטח - חפש בכל המקומות הבאים:**
- **שם המבוטח**: 
  • בכותרת העליונה (כמו "קיבוביץ מיקה")
  • בטבלת "פרטים אישיים" תחת "שם:"
  • בכל מקום שמופיע השם המלא
- **ת.ז:**: 
  • בכותרת העליונה לאחר "זהות, מספר:" או "מספר זהות:"
  • בטבלת "פרטים אישיים" תחת "מספר זהות:"
  • בכל מקום שמופיע מספר של 8-9 ספרות

**2. משתתפי הועדה - חפש בקטע "משתתפי הועדה":**
- **פורמט טבלה**: עמודה עם תפקיד (כמו "מזכיר הישיבה", "פסיכיאטריה") ועמודה עם שם
- **דוגמאות**: "חיעינבל (מזכיר הישיבה), ד״ר ויינר יפעת (פסיכיאטריה)"
- **שלב תפקיד ושם**: "שם (תפקיד)" או "ד״ר שם תפקיד"

**3. סוג הוועדה והטופס:**
- **סוג ועדה**: חפש "ועדת אשכול נפגעי עבודה" או "ועדה רפואית" 
- **שם טופס**: קבע לפי תוכן:
  • אם יש "איבה" בכותרת = "איבה"
  • אם יש "תאריך פגיעה" + "מעבודה" = "נכות מעבודה"
  • אם אין תאריך פגיעה = "נכות כללית"
- **סניף הוועדה**: כמו "סניף ראשי רמת גן"

**4. תאריכים:**
- **תאריך פגיעה**: "תאריך האירוע:" או "תאריך פגיעה:" (רק אם קיים)

**5. אבחנות ונכות:**
- **אבחנה**: מטבלת אבחנות - הפרד מספר אבחנות בפסיק
- **סעיף ליקוי**: קודים כמו "F43", "34א)ב("
- **אחוז הנכות**: מטבלת החלטות
- **תקופה**: תקופות הנכות
- **מידת הנכות**: זמני/צמית

**פורמט החזרה - JSON בלבד:**
{
  "כותרת הועדה": "...",
  "סוג ועדה": "...",
  "שם טופס": "...",
  "סניף הוועדה": "...",
  "שם המבוטח": "...",
  "ת.ז:": "...",
  "תאריך ועדה": "...",
  "תאריך פגיעה(רק באיבה,נכות מעבודה)": "...",
  "משתתף ועדה 1": "...",
  "משתתף ועדה 2": "...",
  "משתתף ועדה 3": "...",
  "משתתף ועדה 4": "...",
  "החלטות": [...],
  "אחוז הנכות הנובע מהפגיעה": "...",
  "אחוז הנכות משוקלל": "...",
  "שקלול לפטור ממס": "..."
}

**חובה: רק JSON, ללא הסברים או טקסט נוסף!**`;
  }

  private parseOpenAIResponse(content: string): Partial<ProcessedDocument> {
    console.log('Azure OpenAI raw response content:', content);
    
    try {
      let cleanContent = content;
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      cleanContent = this.fixJsonFormatting(cleanContent);
      
      let extractedData;
      try {
        extractedData = JSON.parse(cleanContent);
      } catch (parseError) {
        const fixedContent = cleanContent
          .replace(/\u200B/g, '')
          .replace(/\u00A0/g, ' ')
          .replace(/[\u200C\u200D]/g, '')
          .trim();
        extractedData = JSON.parse(fixedContent);
      }
      
      console.log('Successfully parsed JSON:', Object.keys(extractedData));
      return extractedData;
      
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Failed content:', content);
      
      // Fallback to regex extraction
      const result: Partial<ProcessedDocument> = {} as Partial<ProcessedDocument>;
      
      const extractField = (pattern: string, fieldName: keyof ProcessedDocument) => {
        const match = content.match(new RegExp(`"${pattern}":\\s*"([^"]+)"`, 'i'));
        if (match) {
          (result as any)[fieldName] = match[1];
        }
      };
      
      extractField('כותרת הועדה', 'כותרת הועדה');
      extractField('סוג ועדה', 'סוג ועדה');
      extractField('שם טופס', 'שם טופס');
      extractField('סניף הוועדה', 'סניף הוועדה');
      extractField('שם המבוטח', 'שם המבוטח');
      extractField('ת\\.ז:', 'ת.ז:');
      extractField('תאריך ועדה', 'תאריך ועדה');
      extractField('תאריך פגיעה\\(רק באיבה,נכות מעבודה\\)', 'תאריך פגיעה(רק באיבה,נכות מעבודה)');
      extractField('משתתף ועדה 1', 'משתתף ועדה 1');
      extractField('משתתף ועדה 2', 'משתתף ועדה 2');
      extractField('משתתף ועדה 3', 'משתתף ועדה 3');
      extractField('משתתף ועדה 4', 'משתתף ועדה 4');
      extractField('אחוז הנכות הנובע מהפגיעה', 'אחוז הנכות הנובע מהפגיעה');
      extractField('אחוז הנכות משוקלל', 'אחוז הנכות משוקלל');
      extractField('שקלול לפטור ממס', 'שקלול לפטור ממס');
      
      console.log('Using regex fallback extraction:', result);
      return result;
    }
  }

  private fixJsonFormatting(content: string): string {
    let fixed = content.trim();
    
    const jsonStart = fixed.indexOf('{');
    const jsonEnd = fixed.lastIndexOf('}') + 1;
    if (jsonStart !== -1 && jsonEnd !== -1) {
      fixed = fixed.substring(jsonStart, jsonEnd);
    }
    
    fixed = fixed.replace(/}\s*\n?\s*{/g, '},\n    {');
    fixed = fixed.replace(/"\s*\n\s*"/g, '",\n  "');
    fixed = fixed.replace(/"\s*\n\s*}/g, '"\n  }');
    fixed = fixed.replace(/]\s*\n\s*"/g, '],\n  "');
    fixed = fixed.replace(/"null"/g, 'null');
    fixed = fixed.replace(/,\s*}/g, '}');
    fixed = fixed.replace(/,\s*]/g, ']');
    
    return fixed;
  }

  private cleanHebrewText(text: string): string {
    if (!text) return '';
    
    let cleaned = text
      .replace(/[\u0591-\u05BD\u05BF-\u05C2\u05C4-\u05C5\u05C7]/g, '')
      .replace(/[׃־]/g, ' ')
      .replace(/[\u05D0-\u05EA][\u0590-\u05C7]+/g, match => match.charAt(0))
      .replace(/[״׳]/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
    
    return cleaned;
  }

  private calculateReadableRatio(text: string): number {
    if (!text || text.length === 0) return 0;
    
    const hebrewLetters = (text.match(/[\u05D0-\u05EA]/g) || []).length;
    const englishLetters = (text.match(/[A-Za-z]/g) || []).length;
    const digits = (text.match(/\d/g) || []).length;
    const punctuation = (text.match(/[.,;:!?()\-\s]/g) || []).length;
    
    const totalReadable = hebrewLetters + englishLetters + digits + punctuation;
    const ratio = (totalReadable / text.length) * 100;
    
    const hebrewWords = (text.match(/[\u05D0-\u05EA]{2,}/g) || []).length;
    const wordBonus = Math.min(hebrewWords * 2, 20);
    
    return Math.min(ratio + wordBonus, 100);
  }

  private arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < buffer.length; i++) {
      binary += String.fromCharCode(buffer[i]);
    }
    return btoa(binary);
  }

  private fixRtlText(text: string): string {
    if (!text) return '';
    
    const lines = text.split('\n');
    const fixedLines = lines.map(line => {
      const hebrewRatio = (line.match(/[\u05D0-\u05EA]/g) || []).length / Math.max(line.length, 1);
      
      if (hebrewRatio > 0.3) {
        return line.split(' ').reverse().join(' ');
      }
      return line;
    });
    
    return fixedLines.join('\n');
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Azure OpenAI configuration
    const azureEndpoint = Deno.env.get('AZURE_OPENAI_ENDPOINT');
    const azureApiKey = Deno.env.get('AZURE_OPENAI_API_KEY');
    const azureDeploymentName = Deno.env.get('AZURE_OPENAI_DEPLOYMENT_NAME');
    const googleApiKey = Deno.env.get('GOOGLE_VISION_API_KEY') || '';

    if (!azureEndpoint || !azureApiKey || !azureDeploymentName) {
      throw new Error('Azure OpenAI configuration not complete. Required: AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT_NAME');
    }

    console.log('Azure OpenAI configuration loaded successfully');

    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    
    if (!files || files.length === 0) {
      throw new Error('No files provided');
    }

    console.log(`Processing ${files.length} files with Azure OpenAI`);

    const processor = new DocumentProcessor(azureEndpoint, azureApiKey, azureDeploymentName, googleApiKey);
    
    const results: ProcessedDocument[] = [];
    
    for (const file of files) {
      console.log(`Processing file: ${file.name}, type: ${file.type}`);
      
      const arrayBuffer = await file.arrayBuffer();
      const fileData = new Uint8Array(arrayBuffer);
      
      const result = await processor.processFile(fileData, file.name, file.type);
      results.push(result);
    }
    
    const successCount = results.filter(r => r.processingStatus === 'completed').length;
    const errorCount = results.filter(r => r.processingStatus === 'error').length;
    
    console.log(`Processing completed: ${successCount} success, ${errorCount} errors`);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-documents function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
