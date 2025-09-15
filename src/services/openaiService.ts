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
      // Limit text length for better OpenAI processing
      const maxLength = 15000; // Reduced further for more focused processing
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
אתה מומחה בחילוץ מידע ממסמכי ביטוח לאומי בעברית. חלץ את הפרטים בדיוק לפי המבנה הבא:

טקסט המסמך:
${text}

**חפש את הפרטים הבאים בדיוק:**

**פרטים בסיסיים (חובה!):**
1. סוג ועדה: חפש "נכות", "שיקום", "חוות דעת", "ועדה רפואית" - זהה את סוג הועדה
2. שם המבוטח: שם מלא בעברית (לרוב אחרי "שם:", "מבוטח:" או "ת.ז:")
3. תעודת זהות: בדיוק 9 ספרות (לרוב אחרי "ת.ז:", "מספר זהות", "מס' זהות")
4. סניף הוועדה: שם מקום/עיר (חפש "סניף", "סניף הוועדה", "סניף ראשי")
5. תאריך ועדה: תאריך הישיבה (חפש "תאריך הוועדה", "תאריך ישיבה")
6. תאריך פגיעה: רק אם קיים - בנכות מעבודה/פעולות איבה

**משתתפי הועדה:**
חפש "משתתפי הועדה" ולאחר מכן טבלה עם שם ותפקיד:
- חפש שמות רופאים עם "ד"ר" 
- חפש "מזכיר הישיבה", "פסיכיאטריה", "אורתופדיה" וכו'

**אבחנות:**  
חפש בטבלת "קביעת אחוזים רפואיים" או "אבחנות":
- קוד אבחנה (מספרים וספרות)
- תיאור האבחנה

**טבלת החלטות:**
חפש "קביעת אחוזים רפואיים" או טבלה עם העמודות:
- תקופה (מתאריך/עד תאריך)
- אבחנה
- סעיף
- ליקוי/תיאור  
- אחוז הנכות

**שקלול נכות:**
חפש טבלה בתחתית עם:
- תאריכים (מ/עד)
- מידת הנכות (זמני/קבוע)
- אחוז נכות
- אחוז משוקלל

**דוגמה לפורמט הצפוי:**
בהתבסס על הדוגמה:
- סוג ועדה: "נכות" 
- שם המבוטח: "חיים ירין מזלטרין"
- ת.ז: "305566515"
- סניף הוועדה: "סניף ראשי רמלה" 
- תאריך ועדה: "18/05/2025"

**החזר בפורמט JSON בלבד:**
{
  "committeeType": "סוג הועדה המדויק או 'לא זוהה'",
  "committeeDate": "תאריך בפורמט YYYY-MM-DD או 'לא נמצא'",
  "committeeBranch": "שם סניף מדויק או 'לא זוהה'", 
  "insuredName": "שם מלא מדויק או 'לא זוהה'",
  "idNumber": "9 ספרות מדויקות או 'לא נמצא'",
  "injuryDate": "תאריך פגיעה או 'לא רלוונטי'",
  "committeeMembers": [{"name": "שם מלא", "role": "תפקיד מדויק"}],
  "diagnoses": [{"code": "קוד", "description": "תיאור מלא"}],
  "decisionTable": [{"item": "תיאור הליקוי", "decision": "החלטה", "percentage": מספר, "notes": "הערות"}],
  "disabilityWeightTable": [{"bodyPart": "איבר/מערכת", "percentage": מספר, "type": "זמני/קבוע", "calculation": "פירוט"}]
}

**חשוב מאוד:** אל תחזיר "לא נמצא" אלא אם אתה באמת לא מוצא את המידע במסמך!`;
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