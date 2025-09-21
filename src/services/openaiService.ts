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
  
  async processDocumentFile(file: File, fileName: string): Promise<Partial<ProcessedDocument>> {
    console.log(`Processing document file directly: ${fileName}`);
    
    try {
      // Convert file to base64 for OpenAI API
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const mimeType = file.type || 'application/pdf';
      
      const prompt = this.createEnhancedExtractionPrompt("");
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o",
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
      });

      const content = completion.choices[0].message.content;
      console.log(`OpenAI direct file response for ${fileName}:`, content);
      
      if (!content) {
        throw new Error('OpenAI returned empty response');
      }

      return this.parseOpenAIResponse(content);
      
    } catch (error) {
      console.error('OpenAI direct file processing error:', error);
      
      // Fallback to text-based processing
      return this.processDocumentText("", fileName);
    }
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

**הוראות חשובות:**
1. התעלם מעמוד הראשון אם הוא מכיל רק מכתב החלטה כללי 
2. התמקד בדפים שמכילים פרטים מפורטים של הועדה הרפואית
3. עבור שם הטופס - זהה את הסוג המדוייק לפי תוכן המסמך

**טקסט המסמך:**
${text}

**משימה:** חלץ את הערכים המדויקים עבור השדות הבאים. אם שדה לא נמצא, החזר null.

**מיקום השדות במסמך (הנחיות מפורטות):**

**פרטי ועדה (בראש המסמך):**
- **סוג ועדה**: חפש "ועדת", "ועדה רפואית", "נכות", "שיקום" בכותרת
- **שם טופס**: זהה את הסוג המדוייק:
  • אם יש תאריך פגיעה ומדובר בעבודה: "נכות מעבודה"
  • אם מדובר בנכות כללית: "נכות כללית"  
  • אם מדובר באיבה: "איבה"
  • אם מדובר בשארים: "שארים"
- **סניף הוועדה**: חפש "סניף", "משרד" (למשל "סניף ירושלים", "משרד רמלה")

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
  "סניף הוועדה": "...",
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
    console.log('OpenAI raw response content:', content);
    
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanContent = content;
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Fix common JSON formatting issues  
      cleanContent = this.fixJsonFormatting(cleanContent);
      console.log('Cleaned content for parsing:', cleanContent);
      
      // Parse the JSON
      const extractedData = JSON.parse(cleanContent);
      console.log('Successfully parsed JSON:', extractedData);
      
      // Helper function to convert values to strings
      const convertToString = (value: any): string => {
        if (value === null || value === undefined || value === "null") return "";
        if (typeof value === 'string') return value;
        if (Array.isArray(value)) {
          // Convert array to formatted string
          return value.map(item => {
            if (typeof item === 'object' && item !== null) {
              if (item.שם && item.תפקיד) {
                return `${item.שם} (${item.תפקיד})`;
              }
              return Object.values(item).join(' - ');
            }
            return String(item);
          }).join(', ');
        }
        if (typeof value === 'object' && value !== null) return JSON.stringify(value);
        return String(value);
      };
      
      const result: Partial<ProcessedDocument> = {};
      
      console.log('Extracted data keys:', Object.keys(extractedData));
      console.log('Full extracted data:', extractedData);
      
      // Process all fields from the extracted data
      const fieldMapping = {
        "סוג ועדה": "סוג ועדה",
        "שם טופס": "שם טופס", 
        "סניף הוועדה": "סניף הוועדה",
        "שם המבוטח": "שם המבוטח",
        "ת.ז:": "ת.ז:",
        "תאריך פגיעה(רק באיבה,נכות מעבודה)": "תאריך פגיעה(רק באיבה,נכות מעבודה)",
        "משתתפי הועדה": "משתתפי הועדה",
        "תקופה": "תקופה", 
        "אבחנה": "אבחנה",
        "סעיף ליקוי": "סעיף ליקוי",
        "אחוז הנכות הנובע מהפגיעה": "אחוז הנכות הנובע מהפגיעה",
        "הערות": "הערות",
        "מתאריך": "מתאריך",
        "עד תאריך": "עד תאריך", 
        "מידת הנכות": "מידת הנכות",
        "אחוז הנכות משוקלל": "אחוז הנכות משוקלל",
        "שקלול לפטור ממס": "שקלול לפטור ממס"
      };
      
      Object.entries(fieldMapping).forEach(([key, field]) => {
        if (extractedData.hasOwnProperty(key)) {
          const value = convertToString(extractedData[key]);
          result[field] = value;
          console.log(`Set ${field}:`, value);
        }
      });
      
      console.log('Final parsed result:', result);
      return result;
      
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Failed content:', content);
      console.error('Falling back to comprehensive regex extraction');
      
      // Comprehensive regex fallback for ALL fields
      const result: Partial<ProcessedDocument> = {};
      
      // Helper function to extract field value
      const extractField = (pattern: string, fieldName: string) => {
        const match = content.match(new RegExp(`"${pattern}":\\s*"([^"]+)"`, 'i'));
        if (match) {
          result[fieldName] = match[1];
          console.log(`Regex extracted ${fieldName}:`, match[1]);
        }
      };
      
      // Extract all fields using regex
      extractField('סוג ועדה', 'סוג ועדה');
      extractField('שם טופס', 'שם טופס');
      extractField('סניף הוועדה', 'סניף הוועדה');
      extractField('שם המבוטח', 'שם המבוטח');
      extractField('ת\\.ז:', 'ת.ز:');
      extractField('תאריך פגיעה\\(רק באיבה,נכות מעבודה\\)', 'תאריך פגיעה(רק באיבה,נכות מעבודה)');
      extractField('תקופה', 'תקופה');
      extractField('אבחנה', 'אבחנה');
      extractField('סעיף ליקוי', 'סעיף ליקוי');
      extractField('אחוז הנכות הנובע מהפגיעה', 'אחוז הנכות הנובע מהפגיעה');
      extractField('הערות', 'הערות');
      extractField('מתאריך', 'מתאריך');
      extractField('עד תאריך', 'עד תאריך');
      extractField('מידת הנכות', 'מידת הנכות');
      extractField('אחוז הנכות משוקלל', 'אחוז הנכות משוקלל');
      extractField('שקלול לפטור ממס', 'שקלול לפטור ממס');
      
      // Special handling for משתתפי הועדה (array format)
      const committeeMembersMatch = content.match(/"משתתפי הועדה":\s*\[(.*?)\]/s);
      if (committeeMembersMatch) {
        try {
          const membersArray = JSON.parse(`[${committeeMembersMatch[1]}]`);
          result["משתתפי הועדה"] = membersArray.map(member => 
            typeof member === 'object' && member.שם && member.תפקיד 
              ? `${member.שם} (${member.תפקיד})`
              : String(member)
          ).join(', ');
        } catch {
          // Fallback to simple text extraction
          result["משתתפי הועדה"] = committeeMembersMatch[1].replace(/[{},"]/g, '').trim();
        }
      }
      
      console.log('Using comprehensive regex fallback extraction:', result);
      return result;
    }
  }

  private fixJsonFormatting(content: string): string {
    let fixed = content.trim();
    
    // Remove any extra text before the JSON
    const jsonStart = fixed.indexOf('{');
    const jsonEnd = fixed.lastIndexOf('}') + 1;
    if (jsonStart !== -1 && jsonEnd !== -1) {
      fixed = fixed.substring(jsonStart, jsonEnd);
    }
    
    // Fix missing commas after closing braces/brackets before opening braces
    fixed = fixed.replace(/}\s*\n?\s*{/g, '},\n    {');
    
    // Fix missing commas after string values before next property
    fixed = fixed.replace(/"\s*\n\s*"/g, '",\n  "');
    
    // Fix missing commas after values before closing braces
    fixed = fixed.replace(/"\s*\n\s*}/g, '"\n  }');
    
    // Fix missing commas after arrays
    fixed = fixed.replace(/]\s*\n\s*"/g, '],\n  "');
    
    // Fix null values that are strings
    fixed = fixed.replace(/"null"/g, 'null');
    
    // Fix any trailing commas before closing braces or brackets
    fixed = fixed.replace(/,\s*}/g, '}');
    fixed = fixed.replace(/,\s*]/g, ']');
    
    // Fix missing quotes around property names
    fixed = fixed.replace(/(\n\s*)([^"{\s][^:\n]*?)(\s*:)/g, '$1"$2"$3');
    
    // Fix arrays without proper JSON structure
    fixed = fixed.replace(/\[\s*([^[\]]*?)\s*\]/g, (match, content) => {
      if (!content.trim()) return '[]';
      // If it looks like already proper JSON array, leave it
      if (content.includes('{') && content.includes('}')) return match;
      // Otherwise wrap simple values in quotes
      const items = content.split(',').map(item => {
        const trimmed = item.trim();
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed;
        return `"${trimmed}"`;
      });
      return `[${items.join(', ')}]`;
    });
    
    return fixed;
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