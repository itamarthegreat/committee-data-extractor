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
    const maxLength = 15000;
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
    
    const prompt = this.createEnhancedExtractionPrompt(truncatedText);
    
    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
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
  
  private createEnhancedExtractionPrompt(text: string): string {
    return `אתה מומחה בחילוץ מידע ממסמכי ועדות רפואיות של ביטוח לאומי בעברית.

**טקסט המסמך:**
${text}

**משימה:** חלץ את הערכים המדויקים עבור השדות הבאים. אם שדה לא נמצא, החזר null.

**מיקום השדות במסמך (הנחיות מפורטות):**

**פרטי ועדה (בראש המסמך):**
- **סוג ועדה**: חפש "ועדת", "ועדה רפואית", "נכות", "שיקום" בכותרת
- **שם טופס**: חפש "טופס" או מספר טופס (למשל "טופס 21", "טופס 119")
- **סניף הועדה**: חפש "סניף", "משרד" (למשל "סניף ירושלים", "משרד רמלה")

**פרטי מבוטח (בראש המסמך):**
- **שם המבוטח**: חפש "שם:", "שם המבוטח:", או שם אחרי ת.ז
- **ת.ז:**: חפש "ת.ז:", "תעודת זהות", "מספר זהות" - תמיד 9 ספרות
- **תאריך פגיעה**: חפש "תאריך פגיעה:", "פגיעה בתאריך", רק בתיקי נכות מעבודה/איבה

**משתתפי הועדה (בטבלה נפרדת):**
- **משתתפי הועדה**: חפש טבלה עם "שם", "תפקיד" - כלול רופאים, מזכיר/ה, יו"ר

**פרטי תקופה ואבחנה (בטבלה מרכזית):**
- **תקופה**: חפש "תקופה:", "מתאריך", "עד תאריך"
- **אבחנה**: חפש "אבחנה:", "קוד אבחנה", "תיאור הליקוי"
- **סעיף ליקוי**: חפש "סעיף", מספרים כמו "2.1", "3.4"

**פרטי נכות (בטבלת החלטות):**
- **אחוז הנכות הנובע מהפגיעה**: חפש "אחוז נכות", "%", בטבלת החלטות
- **הערות**: חפש "הערות:", "הערה:", בסוף הטבלה
- **מתאריך**: תאריך תחילת נכות
- **עד תאריך**: תאריך סיום נכות (אם זמני)

**פרטי שקלול (בטבלה תחתונה):**
- **מידת הנכות**: חפש "קבוע", "זמני", "מידת נכות"
- **אחוז הנכות משוקלל**: אחוז סופי אחרי חישובים
- **שקלול לפטור ממס**: חפש "פטור ממס", "שקלול מס"

**דוגמאות למיקום:**
- כותרת: "ועדה רפואית לנכות כללית - סניף תל אביב"
- פרטי אישיים: "שם: יוסי כהן, ת.ז: 123456789"
- טבלת משתתפים: "ד"ר דוד לוי - רופא מומחה"
- טבלת החלטות: "תקופה: 01/01/2024 - 31/12/2024, אבחנה: כאב גב, אחוז: 15%"

**חזור בפורמט JSON בלבד:**
{
  "סוג ועדה": "...",
  "שם טופס": "...",
  "סניף הועדה": "...",
  "שם המבוטח": "...",
  "ת.ז:": "...",
  "תאריך פגיעה(רק באיבה,נכות מעבודה)": "...",
  "משתתפי הועדה": "...",
  "תקופה": "...",
  "אבחנה": "...",
  "סעיף ליקוי": "...",
  "אחוז הנכות הנובע מהפגיעה": "...",
  "הערות": "...",
  "מתאריך": "...",
  "עד תאריך": "...",
  "מידת הנכות": "...",
  "אחוז הנכות משוקלל": "...",
  "שקלול לפטור ממס": "..."
}

**רק JSON, ללא טקסט נוסף!**`;
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
        "סוג ועדה": extractedData["סוג ועדה"] || null,
        "שם טופס": extractedData["שם טופס"] || null,
        "סניף הוועדה": extractedData["סניף הוועדה"] || null,
        "שם המבוטח": extractedData["שם המבוטח"] || null,
        "ת.ז:": extractedData["ת.ז:"] || null,
        "תאריך פגיעה(רק באיבה,נכות מעבודה)": extractedData["תאריך פגיעה(רק באיבה,נכות מעבודה)"] || null,
        "משתתפי הועדה": extractedData["משתתפי הועדה"] || null,
        "תקופה": extractedData["תקופה"] || null,
        "אבחנה": extractedData["אבחנה"] || null,
        "סעיף ליקוי": extractedData["סעיף ליקוי"] || null,
        "אחוז הנכות הנובע מהפגיעה": extractedData["אחוז הנכות הנובע מהפגיעה"] || null,
        "הערות": extractedData["הערות"] || null,
        "מתאריך": extractedData["מתאריך"] || null,
        "עד תאריך": extractedData["עד תאריך"] || null,
        "מידת הנכות": extractedData["מידת הנכות"] || null,
        "אחוז הנכות משוקלל": extractedData["אחוז הנכות משוקלל"] || null,
        "שקלול לפטור ממס": extractedData["שקלול לפטור ממס"] || null,
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