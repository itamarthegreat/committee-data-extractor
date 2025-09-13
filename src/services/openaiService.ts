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
אתה מומחה בחילוץ מידע ממסמכי ביטוח לאומי בעברית. עליך לחלץ מידע מובנה מהמסמך בצורה מדויקת.

המסמך:
${text}

חלץ את המידע הבא בדיוק כפי שמופיע במסמך:

1. **סוג הועדה** - הכותרת של המסמך (למשל: "הודעה הועדה הרפואית", "החלטת ועדה רפואית")
2. **תאריך ועדה** - התאריך שבו התכנסה הועדה
3. **סניף הועדה** - שם הסניף או האזור
4. **שם המבוטח** - השם המלא של המבוטח
5. **תעודת זהות** - מספר ת.ז של 9 ספרות
6. **תאריך פגיעה** - התאריך בו אירעה הפגיעה (רלוונטי לנכות מעבודה)
7. **משתתפי הועדה** - רשימת השמות והתפקידים של חברי הועדה
8. **רשימת אבחנות** - כל האבחנות הרפואיות עם קודים אם יש
9. **טבלת החלטה** - כל השורות בטבלה שמכילות החלטות, אחוזי נכות, תקופות
10. **טבלת שקלול נכות** - פירוט שקלול הנכות לפי איברים או סוגי נכות

החזר תוצאה בפורמט JSON הזה בלבד:

{
  "committeeType": "סוג הועדה מהכותרת",
  "committeeDate": "תאריך בפורמט YYYY-MM-DD", 
  "committeeBranch": "שם הסניף",
  "insuredName": "שם המבוטח המלא",
  "idNumber": "מספר תעודת זהות",
  "injuryDate": "תאריך פגיעה YYYY-MM-DD או null",
  "committeeMembers": [
    {
      "name": "שם המשתתף",
      "role": "התפקיד"
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
      "item": "מה שמוערך או הנושא", 
      "decision": "החלטת הועדה",
      "percentage": מספר_האחוז_אם_יש,
      "notes": "הערות או תקופה"
    }
  ],
  "disabilityWeightTable": [
    {
      "bodyPart": "איבר או סוג נכות",
      "percentage": מספר_האחוז,
      "type": "סוג הפגיעה", 
      "calculation": "פירוט החישוב"
    }
  ]
}

חשוב מאוד: 
- חלץ כל שורה בטבלאות, אפילו אם יש הרבה
- אם אין מידע מסוים השאר ריק או null
- היה מדויק עם מספרים ותאריכים
- החזר רק JSON ללא הסבר נוסף`;
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