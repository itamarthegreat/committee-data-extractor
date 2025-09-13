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
אתה מומחה בחילוץ מידע ממסמכי ביטוח לאומי וועדות רפואיות בעברית. 

המסמך לעיבוד:
${text}

משימתך: חלץ מידע מדויק מהמסמך לפי הקטגוריות הבאות.

חפש במסמך:

1. **כותרת המסמך** - סוג הועדה (למשל: "הודעה הועדה הרפואית", "החלטת ועדה")
2. **תאריך** - התאריך בו התכנסה הועדה (יכול להיות בפורמטים שונים)
3. **מקום/סניף** - שם העיר, סניף או מיקום 
4. **פרטי מבוטח** - שם ומספר תעודת זהות (9 ספרות)
5. **תאריך פגיעה** - אם רלוונטי למקרה
6. **חברי ועדה** - שמות ותפקידים של המשתתפים
7. **אבחנות רפואיות** - רשימת כל האבחנות
8. **טבלאות החלטות** - כל השורות עם אחוזים והחלטות
9. **טבלת שקלול נכות** - פירוט לפי איברים

אם אתה לא מוצא מידע מסוים, כתב "לא נמצא" במקום null.

דוגמה למבנה שאתה צריך לחפש:
- ביטוח לאומי 
- ועדה רפואית
- שם: [שם המבוטח]
- ת.ז: [מספר]
- תאריך: [תאריך]

החזר בפורמט JSON בלבד:

{
  "committeeType": "סוג הועדה שמצאת או 'לא נמצא'",
  "committeeDate": "תאריך בפורמט YYYY-MM-DD או 'לא נמצא'", 
  "committeeBranch": "שם הסניף או 'לא נמצא'",
  "insuredName": "שם המבוטח או 'לא נמצא'",
  "idNumber": "מספר ת.ז או 'לא נמצא'",
  "injuryDate": "תאריך פגיעה או 'לא נמצא'",
  "committeeMembers": [
    {
      "name": "שם המשתתף",
      "role": "התפקיד"
    }
  ],
  "diagnoses": [
    {
      "code": "קוד אם יש",
      "description": "תיאור האבחנה"
    }
  ],
  "decisionTable": [
    {
      "item": "מה שמוערך", 
      "decision": "החלטה",
      "percentage": מספר_או_null,
      "notes": "הערות"
    }
  ],
  "disabilityWeightTable": [
    {
      "bodyPart": "איבר",
      "percentage": מספר,
      "type": "סוג", 
      "calculation": "חישוב"
    }
  ]
}

חשוב: החזר רק JSON ללא הסברים נוספים!`;
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