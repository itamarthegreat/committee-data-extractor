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
    // Clean and normalize Hebrew text first
    const cleanedText = this.cleanHebrewText(text);
    
    // Limit text length for better OpenAI processing
    const maxLength = 15000; // Reduced further for more focused processing
    const truncatedText = cleanedText.length > maxLength ? cleanedText.substring(0, maxLength) + '...' : cleanedText;
    
    console.log(`Processing ${fileName}:`);
    console.log(`- Original text length: ${text.length} chars`);
    console.log(`- Cleaned text length: ${cleanedText.length} chars`);
    console.log(`- Truncated text length: ${truncatedText.length} chars`);
    console.log(`- Clean text sample (first 500 chars):`, truncatedText.substring(0, 500));
    console.log(`- Clean text sample (last 500 chars):`, truncatedText.substring(Math.max(0, truncatedText.length - 500)));
    
    // Check if text looks corrupted or binary
    const readableRatio = this.calculateReadableRatio(truncatedText);
    console.log(`Text readability ratio: ${readableRatio}%`);
    
    if (readableRatio < 30) {
      throw new Error('הטקסט שנחלץ מהקובץ אינו קריא מספיק. ייתכן שהקובץ מוצפן, מוגן או מכיל רק תמונות שצריכות OCR.');
    }
    
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
  
  private cleanHebrewText(text: string): string {
    if (!text) return '';
    
    // Remove or normalize problematic Hebrew characters and diacritics
    let cleaned = text
      // Remove most Hebrew diacritics and cantillation marks
      .replace(/[\u0591-\u05BD\u05BF-\u05C2\u05C4-\u05C5\u05C7]/g, '')
      // Normalize Hebrew punctuation
      .replace(/[׃־]/g, ' ') // Hebrew punctuation to space
      // Remove excessive Hebrew points and marks
      .replace(/[\u05D0-\u05EA][\u0590-\u05C7]+/g, match => match.charAt(0)) // Keep only base Hebrew letter
      // Normalize quotes and special characters
      .replace(/[״׳]/g, '"')
      // Replace multiple spaces with single space
      .replace(/\s+/g, ' ')
      .trim();
    
    // Try to extract meaningful Hebrew words and phrases
    const hebrewWords = cleaned.match(/[\u05D0-\u05EA]{2,}/g) || [];
    const englishWords = cleaned.match(/[A-Za-z]{2,}/g) || [];
    const numbers = cleaned.match(/\d+/g) || [];
    
    // If we have Hebrew words, try to reconstruct readable text
    if (hebrewWords.length > 0) {
      // Look for common patterns in Hebrew documents
      const patterns = [
        /ביטוח\s*לאומי/gi,
        /ועדה\s*רפואית/gi,
        /מבוטח[:\s]*/gi,
        /תעודת\s*זהות[:\s]*/gi,
        /תאריך[:\s]*/gi,
        /סניף[:\s]*/gi,
        /החלטה[:\s]*/gi,
        /אבחנה[:\s]*/gi,
        /אחוז[:\s]*נכות/gi,
        /משתתפי\s*הועדה/gi
      ];
      
      let reconstructed = cleaned;
      for (const pattern of patterns) {
        const matches = cleaned.match(pattern);
        if (matches) {
          // Add space around important terms for better parsing
          reconstructed = reconstructed.replace(pattern, match => ` ${match} `);
        }
      }
      
      // Clean up extra spaces
      reconstructed = reconstructed.replace(/\s+/g, ' ').trim();
      
      return reconstructed;
    }
    
    // If no Hebrew words found, return combination of found elements
    return [...hebrewWords, ...englishWords, ...numbers].join(' ');
  }
  
  private calculateReadableRatio(text: string): number {
    if (!text || text.length === 0) return 0;
    
    // Count basic Hebrew letters (without diacritics)
    const hebrewLetters = text.match(/[\u05D0-\u05EA]/g) || [];
    
    // Count English letters
    const englishLetters = text.match(/[A-Za-z]/g) || [];
    
    // Count digits
    const digits = text.match(/[0-9]/g) || [];
    
    // Count spaces and basic punctuation
    const basicPunctuation = text.match(/[\s.,;:!?()-]/g) || [];
    
    // Total readable characters
    const readableCount = hebrewLetters.length + englishLetters.length + digits.length + basicPunctuation.length;
    
    const ratio = (readableCount / text.length) * 100;
    
    // Check for actual words
    const hebrewWords = text.match(/[\u05D0-\u05EA]{2,}/g) || [];
    const englishWords = text.match(/[A-Za-z]{2,}/g) || [];
    
    // Boost score if we have real words
    const wordBonus = Math.min((hebrewWords.length + englishWords.length) * 2, 30);
    
    return Math.min(ratio + wordBonus, 100);
  }
}