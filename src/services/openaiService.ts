import OpenAI from 'openai';
import { ProcessedDocument } from '@/types/document';

export class OpenAIService {
  private openai: OpenAI;
  
  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true
    });
  }
  
  async processDocumentText(text: string, fileName: string): Promise<Partial<ProcessedDocument>> {
    // Limit text length and add debugging
    const maxLength = 20000; // Further reduced for better processing
    const truncatedText = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    
    console.log(`Processing ${fileName}:`);
    console.log(`- Full text length: ${text.length} chars`);
    console.log(`- Truncated text length: ${truncatedText.length} chars`);
    console.log(`- Text sample (first 500 chars):`, truncatedText.substring(0, 500));
    console.log(`- Text sample (last 500 chars):`, truncatedText.substring(Math.max(0, truncatedText.length - 500)));
    
    const prompt = this.createImprovedExtractionPrompt(truncatedText);
    
    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-5-2025-08-07",
        messages: [{ role: "user", content: prompt }],
      });

      const content = completion.choices[0].message.content;
      console.log(`OpenAI raw response for ${fileName}:`, content);
      
      if (!content) {
        throw new Error('OpenAI returned empty response');
      }

      return this.parseOpenAIResponse(content);
      
    } catch (error) {
      console.error('OpenAI processing error:', error);
      throw new Error(`שגיאה בעיבוד עם OpenAI: ${error.message}`);
    }
  }
  
  private createImprovedExtractionPrompt(text: string): string {
    return `
אתה מומחה בחילוץ מידע ממסמכי ביטוח לאומי בעברית. התמקד בחילוץ מדויק של הפרטים הבסיסיים.

טקסט המסמך:
${text}

חפש בקפדנות את הפרטים הבאים:

**פרטים בסיסיים חובה:**
1. כותרת המסמך - חפש "ביטוח לאומי", "ועדה רפואית", "הודעה", "החלטה"
2. תאריך - כל תאריך במסמך (DD/MM/YYYY או DD.MM.YYYY או YYYY-MM-DD)  
3. שם מבוטח - שם אדם בעברית (בדרך כלל אחרי "שם:" או "מבוטח:")
4. תעודת זהות - 9 ספרות (בדרך כלל אחרי "ת.ז:" או "מספר:")
5. סניף - שם עיר או מקום (בדרך כלל בכותרת או תחילת המסמך)

**הוראות מיוחדות לפרטים בסיסיים:**
- אם אתה רואה "ביטוח לאומי" - זה בוודאי המסמך הנכון
- אם יש תאריך - זה כנראה תאריך הועדה  
- אם יש שם של אדם בעברית - זה כנראה שם המבוטח
- אם יש 9 ספרות - זה תעודת זהות
- חפש במיוחד במחצית הראשונה של הטקסט

דוגמאות למה לחפש:
- "ביטוח לאומי" → committeeType
- "07/08/2025" → committeeDate  
- "שלום כהן" → insuredName
- "123456789" → idNumber
- "ירושלים" או "תל אביב" → committeeBranch

**החזר בפורמט JSON:**
{
  "committeeType": "אם מוצא 'ביטוח לאומי' או 'ועדה רפואית' - כתוב זאת, אחרת 'לא נמצא'",
  "committeeDate": "התאריך הראשון שמוצא בפורמט YYYY-MM-DD, אחרת 'לא נמצא'",
  "committeeBranch": "שם עיר או מקום, אחרת 'לא נמצא'", 
  "insuredName": "השם הראשון שנראה כמו שם אדם בעברית, אחרת 'לא נמצא'",
  "idNumber": "9 ספרות הראשונות שמוצא, אחרת 'לא נמצא'",
  "injuryDate": "תאריך נוסף אם יש, אחרת 'לא נמצא'",
  "committeeMembers": [{"name": "שמות נוספים", "role": "תפקיד"}],
  "diagnoses": [{"code": "קוד", "description": "אבחנה"}],
  "decisionTable": [{"item": "נושא", "decision": "החלטה", "percentage": מספר, "notes": "הערות"}],
  "disabilityWeightTable": [{"bodyPart": "איבר", "percentage": מספר, "type": "סוג", "calculation": "חישוב"}]
}

**חשוב:** התמקד בעיקר בפרטים הבסיסיים! אל תוותר על שם מבוטח ותאריך אם הם באמת קיימים במסמך.

החזר רק JSON ללא הסברים!`;
  }
  
  private parseOpenAIResponse(content: string): Partial<ProcessedDocument> {
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanContent = content;
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const extractedData = JSON.parse(cleanContent);
      
      return {
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
      };
      
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      throw new Error('תגובה לא תקינה מ-OpenAI');
    }
  }
}