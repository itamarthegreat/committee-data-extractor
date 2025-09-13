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
    // Limit text length for OpenAI processing
    const maxLength = 30000;
    const truncatedText = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    
    const prompt = this.createExtractionPrompt(truncatedText);
    
    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-5-2025-08-07",
        messages: [{ role: "user", content: prompt }],
      });

      const content = completion.choices[0].message.content;
      console.log(`OpenAI response for ${fileName}:`, content);

      return this.parseOpenAIResponse(content || '{}');
      
    } catch (error) {
      console.error('OpenAI processing error:', error);
      throw new Error(`שגיאה בעיבוד עם OpenAI: ${error.message}`);
    }
  }
  
  private createExtractionPrompt(text: string): string {
    return `
אתה עוזר AI המתמחה בעיבוד מסמכי ועדות רפואיות ישראליות. 
עליך לחלץ נתונים ממסמך הועדה הרפואית הבא ולהחזיר אותם בפורמט JSON מובנה.

טקסט המסמך:
${text}

אנא חלץ את הנתונים הבאים והחזר אותם בפורמט JSON בדיוק כפי שמופיע במסמך:

{
  "committeeType": "סוג הועדה (כפי שמופיע בכותרת)",
  "committeeDate": "תאריך הועדה בפורמט YYYY-MM-DD",
  "committeeBranch": "סניף הועדה",
  "insuredName": "שם המבוטח",
  "idNumber": "מספר תעודת זהות",
  "injuryDate": "תאריך הפגיעה (אם קיים)",
  "committeeMembers": [
    {
      "name": "שם החבר",
      "role": "תפקיד החבר"
    }
  ],
  "diagnoses": [
    {
      "code": "קוד האבחנה",
      "description": "תיאור האבחנה"
    }
  ],
  "decisionTable": [
    {
      "item": "פריט/נושא ההחלטה",
      "decision": "ההחלטה שהתקבלה", 
      "percentage": אחוז_נכות_אם_קיים,
      "notes": "הערות נוספות"
    }
  ],
  "disabilityWeightTable": [
    {
      "bodyPart": "איבר/חלק גוף",
      "percentage": אחוז_נכות,
      "type": "סוג הנכות",
      "calculation": "חישוב הנכות"
    }
  ]
}

הוראות חשובות:
1. חלץ את כל הנתונים כפי שהם מופיעים במסמך המקורי
2. אם יש טבלה - חלץ את כל השורות
3. אם משהו לא קיים במסמך, השאר אותו ריק או null
4. החזר רק JSON תקין ללא טקסט נוסף
5. אל תוסיף מידע שלא מופיע במסמך
6. שים לב לפרטים הקטנים כמו תאריכים ומספרים`;
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