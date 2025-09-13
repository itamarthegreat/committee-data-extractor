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
    const maxLength = 25000; // Reduced for better processing
    const truncatedText = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    
    console.log(`Processing ${fileName} - Text sample:`, truncatedText.substring(0, 1000));
    
    const prompt = this.createImprovedExtractionPrompt(truncatedText);
    
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
  
  private createImprovedExtractionPrompt(text: string): string {
    return `
אתה מומחה לעיבוד מסמכי ועדות רפואיות בעברית. המשימה שלך היא לחלץ מידע מובנה מהמסמך הבא.

המסמך:
${text}

חלץ את המידע הבא ללא יוצא מן הכלל - אפילו אם חלק מהמידע לא ברור, נסה למצוא את הקרוב ביותר:

1. סוג הועדה - חפש ביטויים כמו "ועדה רפואית", "ועדת נכות", "ועדה מקצועית"
2. תאריך הועדה - חפש תאריכים בפורמט יום/חודש/שנה או שנה-חודש-יום
3. סניף - חפש שמות ערים או אזורים
4. שם המבוטח - שמות פרטיים ומשפחה בעברית
5. תעודת זהות - רצף של 9 ספרות
6. תאריך פגיעה - תאריך קודם לתאריך הועדה
7. חברי ועדה - רשימת שמות עם תארים רפואיים
8. אבחנות - קודי מחלות וטקסט אבחנה
9. החלטות - טבלאות עם אחוזי נכות והחלטות
10. שקלול נכות - פירוט לפי איברים ואחוזים

החזר בפורמט JSON המדויק הזה (ללא טקסט נוסף):

{
  "committeeType": "סוג הועדה שמצאת",
  "committeeDate": "תאריך בפורמט YYYY-MM-DD",
  "committeeBranch": "שם הסניף",
  "insuredName": "שם המבוטח המלא",
  "idNumber": "תעודת זהות",
  "injuryDate": "תאריך פגיעה בפורמט YYYY-MM-DD",
  "committeeMembers": [
    {
      "name": "שם חבר הועדה",
      "role": "תפקיד (רופא/פסיכולוג וכו')"
    }
  ],
  "diagnoses": [
    {
      "code": "קוד אבחנה אם יש",
      "description": "תיאור האבחנה"
    }
  ],
  "decisionTable": [
    {
      "item": "מה מוערך",
      "decision": "החלטת הועדה",
      "percentage": אחוז_אם_יש,
      "notes": "הערות"
    }
  ],
  "disabilityWeightTable": [
    {
      "bodyPart": "איבר גוף",
      "percentage": אחוז_נכות,
      "type": "סוג הנכות",
      "calculation": "חישוב"
    }
  ]
}

חשוב: אפילו אם לא מוצא מידע מסוים, נסה להעריך או לחלץ מקורב. אל תחזיר null אלא אם כן המידע באמת לא קיים במסמך.`;
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