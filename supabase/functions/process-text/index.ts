import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const { text, fileName } = await req.json();
    
    if (!text || !fileName) {
      throw new Error('Text and fileName are required');
    }

    console.log(`Processing text for ${fileName}: ${text.length} characters`);

    const cleanedText = cleanHebrewText(text);
    const maxLength = 15000;
    const truncatedText = cleanedText.length > maxLength ? cleanedText.substring(0, maxLength) + '...' : cleanedText;
    
    const readableRatio = calculateReadableRatio(truncatedText);
    console.log(`Text readability ratio: ${readableRatio}%`);
    
    if (readableRatio < 30) {
      throw new Error('הטקסט שנחלץ מהקובץ אינו קריא מספיק');
    }
    
    const prompt = createEnhancedExtractionPrompt(truncatedText);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    if (!content) {
      throw new Error('OpenAI returned empty response');
    }

    const result = parseOpenAIResponse(content);
    
    console.log('Processed result:', result);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-text function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function createEnhancedExtractionPrompt(text: string): string {
  return `אתה מומחה בחילוץ מידע ממסמכי ועדות רפואיות של ביטוח לאומי ומס הכנסה בעברית.

**כללים קריטיים:**
1. חפש בכל העמודים - לא רק בעמודים פנימיים
2. כל שדה חייב להתבסס על מידע מדויק מהמסמך - לא להמציא כלום!
3. אם המידע לא נמצא במסמך - החזר null במקום לנחש
4. שים לב למידע בכותרות ובתחילת המסמך
5. **הבדל בין אבחנה לסעיף ליקוי** - אלו שני שדות נפרדים!

**טקסט המסמך:**
${text}

**משימה:** חלץ מידע מכל העמודים:

**1. כותרת הועדה:**
- חפש את הכותרת המלאה של הועדה בראש המסמך
- דוגמאות: "דוח חוות דעת כירורגיה אורולוגית לפי פקודת מס הכנסה", "דוח נכות רפואית", "פטור ממס הכנסה"
- **זה צריך להיות הכותרת המדויקת שבראש המסמך**

**2. פרטי המבוטח - חפש בכל המקומות הבאים:**
- **שם המבוטח**: 
  • בכותרת העליונה (כמו "ליאור קצפ", "קיבוביץ מיקה")
  • בשורה "זהות, מספר: XXXXXXXX שם שם" - השם מופיע אחרי המספר!
  • בטבלת "פרטים אישיים" תחת "שם:" או "זהות: מספר"
  • **שים לב!** לפעמים השם והת.ז מופיעים באותה שורה - השם בא אחרי המספר
  
- **ת.ז:**: 
  • **חפש קודם כל** בשורה "זהות, מספר: XXXXXXXX" - זה המקום הנפוץ ביותר!
  • בכותרת העליונה לאחר "זהות, מספר:" או "מספר זהות:"
  • בטבלת "פרטים אישיים" תחת "מספר זהות:"
  • **זה תמיד מספר של 8-9 ספרות** - אל תבלבל עם מספרי ועדה או מספרי תיק!
  • דוגמאות לזיהוי: "11327061", "123456789"
  • **לא** מספר ועדה כמו "NV-54565-2100"

**3. תאריכים חשובים:**
- **תאריך ועדה**: 
  • **בטבלה הראשונה** תחת "תאריך הועדה" או "תאריך ועדה"
  • דוגמה: "29/09/2025"
  • זה התאריך שבו התקיימה הועדה
  • **לא לבלבל** עם תאריך לידה או תאריך ביקור!
  
- **תאריך פגיעה**: "תאריך האירוע:" או "תאריך פגיעה:" (רק אם קיים - לאיבה ונכות מעבודה)

**4. משתתפי הועדה - **שים לב מאוד!**:**
- חפש בקטע שכותרתו "משתתפי הועדה" או "חברי הועדה"
- **פורמט:** לכל חבר ועדה יש שורה נפרדת עם השם והתפקיד
- **דוגמאות לפורמט:**
  • "ד"ר מיכאל בלומנטל - כירורגיה אורולוגית"
  • "אורולוגית כירורגיה בלומנטל מיכאל ד"ר" (שים לב - הסדר הפוך!)
  • "יהל מסורי - מזכיר הישיבה"
  • "הישיבה מזכיר מסורייהל" (שים לב - הסדר הפוך!)
- **החזר בפורמט:** "שם (תפקיד), שם (תפקיד)"
- **דוגמה:** "מיכאל בלומנטל (כירורגיה אורולוגית), יהל מסורי (מזכיר הישיבה)"
- **תרגם את התפקידים לעברית תקנית** אם הם מופיעים בסדר הפוך

**5. סוג הוועדה והטופס:**
- **סוג ועדה**: חפש "ועדת אשכול נפגעי עבודה" או "ועדה רפואית" או "ועדת פטור ממס"
- **שם טופס**: קבע לפי תוכן:
  • אם יש "פטור ממס" או "מס הכנסה" או "פקודת מס הכנסה" בכותרת = "פטור ממס"
  • אם יש "איבה" בכותרת = "איבה"
  • אם יש "תאריך פגיעה" + "מעבודה" = "נכות מעבודה"
  • אם אין תאריך פגיעה = "נכות כללית"
- **סניף הוועדה**: כמו "סניף ראשי רמת גן", "סניף ראשי נתניה"

**6. אבחנות ונכות - שים לב מאוד להבדלים!:**
- **אבחנה**: התיאור הרפואי של המצב הרפואי
  • דוגמה: "תכיפות במתן שתן", "כאבי גב", "דיכאון", "דלקת כרונית של שלפוחית השתן"
  • זה התיאור המילולי של המחלה/בעיה הרפואית
  • חפש בטבלת "אבחנות" או בעמודה "אבחנה"
  • **אם יש כמה אבחנות - הפרד אותן בפסיק**
  
- **סעיף ליקוי**: הקוד או הסעיף המשפטי/רפואי או התיאור הפורמלי
  • דוגמה: "F43", "34א)ב(", "5א", "דלקת קלה עם תאי מוגלה בשתן", "(II)(23)2()א"
  • זה הקוד הפורמלי לפי הטבלאות הרפואיות
  • חפש בטבלת "החלטה" בעמודה "ליקוי" או "סעיף ליקוי"
  
- **אחוז הנכות**: האחוז הסופי שנקבע
  • דוגמה: "10%", "25%", "50%"
  • חפש בטבלת ההחלטות בעמודה "אחוז נכות" או "אחוז הנכות"
  • **זה השדה החשוב ביותר - אל תפספס אותו!**
  • **אל תוסיף** את המילה "צמית" לאחוז - היא שייכת ל"מידת הנכות"
  
- **מתקופה**: התקופה שמתחילה ממנה הנכות (תאריך התחלה)
  • חפש בטבלת ההחלטות תחת "תקופה" בעמודה שמתחילה ב"מ:" או "החל מ"
  • דוגמה: "01/09/2024", "מ: 01/09/2024"
  • **רק את התאריך** - ללא "מ:" או "החל מ"
  
- **תקופה**: כל התקופה המלאה של הנכות
  • דוגמה: "01/09/2024 - 31/12/2024" או "צמיתה" או "מ: 01/09/2024"
  
- **מידת הנכות**: האם הנכות זמנית או צמיתה
  • אפשרויות: "זמני", "צמית", "צמיתה"
  • חפש בטבלת החלטות - לפעמים זה בעמודה נפרדת, לפעמים זה כתוב באותה תא עם התקופה

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
  "משתתפי הועדה": "...",
  "מתקופה": "...",
  "תקופה": "...",
  "אבחנה": "...",
  "סעיף ליקוי": "...",
  "אחוז הנכות": "...",
  "אחוז הנכות הנובע מהפגיעה": "...",
  "הערות": "...",
  "מתאריך": "...",
  "עד תאריך": "...",
  "מידת הנכות": "...",
  "אחוז הנכות משוקלל": "...",
  "שקלול לפטור ממס": "..."
}

**חובה: רק JSON, ללא הסברים או טקסט נוסף!**`;
}

function parseOpenAIResponse(content: string): any {
  console.log('OpenAI raw response content:', content);
  
  try {
    // Clean the response
    let cleanContent = content.trim();
    
    // Remove markdown code blocks
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    // Apply multiple rounds of JSON fixing
    cleanContent = fixJsonFormatting(cleanContent);
    
    let extractedData;
    try {
      extractedData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('First parse attempt failed:', parseError);
      
      // Try more aggressive fixing
      let fixedContent = cleanContent
        .replace(/\u200B/g, '') // Zero-width space
        .replace(/\u00A0/g, ' ') // Non-breaking space
        .replace(/[\u200C\u200D]/g, '') // Zero-width non-joiner/joiner
        .replace(/[\u202A-\u202E]/g, '') // Left-to-right/right-to-left marks
        .replace(/\\/g, '\\\\') // Escape backslashes
        .replace(/"/g, '\\"') // Escape quotes
        .replace(/\\"/g, '"') // Fix over-escaped quotes
        .replace(/"\s*:\s*"/g, '": "') // Fix spacing around colons
        .replace(/",\s*"/g, '", "') // Fix spacing around commas
        .trim();
      
      // Try to fix common JSON issues
      fixedContent = fixJsonFormatting(fixedContent);
      
      try {
        extractedData = JSON.parse(fixedContent);
      } catch (secondParseError) {
        console.error('Second parse attempt failed:', secondParseError);
        
        // Last resort: use regex to extract fields
        return extractDataWithRegex(content);
      }
    }
    
    const convertToString = (value: any): string => {
      if (value === null || value === undefined || value === "null") return "";
      if (typeof value === 'string') return value;
      if (Array.isArray(value)) {
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
    
    const result: any = {};
    
    const fieldMapping = {
      "כותרת הועדה": "כותרת הועדה",
      "סוג ועדה": "סוג ועדה",
      "שם טופס": "שם טופס", 
      "סניף הוועדה": "סניף הוועדה",
      "שם המבוטח": "שם המבוטח",
      "ת.ז:": "ת.ז:",
      "תאריך ועדה": "תאריך ועדה",
      "תאריך פגיעה(רק באיבה,נכות מעבודה)": "תאריך פגיעה(רק באיבה,נכות מעבודה)",
      "משתתפי הועדה": "משתתפי הועדה",
      "מתקופה": "מתקופה",
      "תקופה": "תקופה", 
      "אבחנה": "אבחנה",
      "סעיף ליקוי": "סעיף ליקוי",
      "אחוז הנכות": "אחוז הנכות",
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
      }
    });
    
    return result;
    
  } catch (parseError) {
    console.error('JSON parse error:', parseError);
    return {};
  }
}

function fixJsonFormatting(content: string): string {
  let fixed = content.trim();
  
  // Extract JSON object
  const jsonStart = fixed.indexOf('{');
  const jsonEnd = fixed.lastIndexOf('}') + 1;
  if (jsonStart !== -1 && jsonEnd !== -1) {
    fixed = fixed.substring(jsonStart, jsonEnd);
  }
  
  // Fix common JSON formatting issues
  fixed = fixed.replace(/}\s*\n?\s*{/g, '},\n    {');
  fixed = fixed.replace(/"\s*\n\s*"/g, '",\n  "');
  fixed = fixed.replace(/"\s*\n\s*}/g, '"\n  }');
  fixed = fixed.replace(/]\s*\n\s*"/g, '],\n  "');
  
  // Handle null values
  fixed = fixed.replace(/"null"/g, 'null');
  fixed = fixed.replace(/:\s*null\s*"/g, ': null');
  fixed = fixed.replace(/:\s*""\s*,/g, ': null,');
  fixed = fixed.replace(/:\s*""\s*}/g, ': null}');
  
  // Remove trailing commas
  fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
  
  // Fix unquoted property names
  fixed = fixed.replace(/(\n\s*)([^"{\s][^:\n]*?)(\s*:)/g, '$1"$2"$3');
  
  // Fix escaped quotes in values
  fixed = fixed.replace(/: "([^"]*)\\"([^"]*)"([^,}\n]*)/g, ': "$1\\"$2"');
  
  // Ensure proper structure
  if (!fixed.startsWith('{')) fixed = '{' + fixed;
  if (!fixed.endsWith('}')) fixed = fixed + '}';
  
  return fixed;
}

function extractDataWithRegex(content: string): any {
  console.log('Using regex fallback for data extraction');
  
  const result: any = {};
  
  const patterns = {
    'כותרת הועדה': /"כותרת הועדה"[:\s]*"([^"]+)"/,
    'סוג ועדה': /"סוג ועדה"[:\s]*"([^"]+)"/,
    'שם טופס': /"שם טופס"[:\s]*"([^"]+)"/,
    'סניף הוועדה': /"סניף הוועדה"[:\s]*"([^"]+)"/,
    'שם המבוטח': /"שם המבוטח"[:\s]*"([^"]+)"/,
    'ת.ז:': /"ת\.ז:"[:\s]*"([^"]+)"/,
    'תאריך ועדה': /"תאריך ועדה"[:\s]*"([^"]+)"/,
    'תאריך פגיעה(רק באיבה,נכות מעבודה)': /"תאריך פגיעה\(רק באיבה,נכות מעבודה\)"[:\s]*"([^"]+)"/,
    'משתתפי הועדה': /"משתתפי הועדה"[:\s]*"([^"]+)"/,
    'מתקופה': /"מתקופה"[:\s]*"([^"]+)"/,
    'תקופה': /"תקופה"[:\s]*"([^"]+)"/,
    'אבחנה': /"אבחנה"[:\s]*"([^"]+)"/,
    'סעיף ליקוי': /"סעיף ליקוי"[:\s]*"([^"]+)"/,
    'אחוז הנכות': /"אחוז הנכות"[:\s]*"([^"]+)"/,
    'אחוז הנכות הנובע מהפגיעה': /"אחוז הנכות הנובע מהפגיעה"[:\s]*"([^"]+)"/,
    'הערות': /"הערות"[:\s]*"([^"]+)"/,
    'מתאריך': /"מתאריך"[:\s]*"([^"]+)"/,
    'עד תאריך': /"עד תאריך"[:\s]*"([^"]+)"/,
    'מידת הנכות': /"מידת הנכות"[:\s]*"([^"]+)"/,
    'אחוז הנכות משוקלל': /"אחוז הנכות משוקלל"[:\s]*"([^"]+)"/,
    'שקלול לפטור ממס': /"שקלול לפטור ממס"[:\s]*"([^"]+)"/
  };
  
  Object.entries(patterns).forEach(([key, pattern]) => {
    const match = content.match(pattern);
    result[key] = match ? match[1] : "";
  });
  
  return result;
}

function cleanHebrewText(text: string): string {
  if (!text) return '';
  
  let cleaned = text
    // Remove Hebrew diacritics
    .replace(/[\u0591-\u05BD\u05BF-\u05C2\u05C4-\u05C5\u05C7]/g, '')
    // Replace Hebrew punctuation
    .replace(/[׃־]/g, ' ')
    // Clean Hebrew letters with diacritics
    .replace(/[\u05D0-\u05EA][\u0590-\u05C7]+/g, match => match.charAt(0))
    // Replace Hebrew quotes
    .replace(/[״׳]/g, '"')
    // Clean up corrupted characters and symbols
    .replace(/[λ⊥αΛΑαβγδεζηθικμνξοπρστυφχψω∠∀∁∂∃∄∅∆∇∈∉∊∋∌∍∎∏∐∑−∓∔∕∖∗∘∙√∛∜∝∞∟∠∡∢∣∤∥∦∧∨∩∪∫∬∭∮∯∰∱∲∳∴∵∶∷∸∹∺∻∼∽∾∿≀≁≂≃≄≅≆≇≈≉≊≋≌≍≎≏]/g, '')
    // Remove corrupted text patterns
    .replace(/[UIXLGCETANOWK]+/g, '')
    // Clean up random symbols and punctuation
    .replace(/[^\u05D0-\u05EA\u0590-\u05FF0-9a-zA-Z\s.,;:!?()\[\]{}"'-]/g, ' ')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
    
  // Try to reconstruct readable Hebrew text by looking for patterns
  const hebrewWords = cleaned.match(/[\u05D0-\u05EA]{2,}/g) || [];
  const englishWords = cleaned.match(/[a-zA-Z]{2,}/g) || [];
  const numbers = cleaned.match(/\d+/g) || [];
  
  // If we have some Hebrew content, keep it
  if (hebrewWords.length > 0) {
    const reconstructed = [...hebrewWords, ...englishWords, ...numbers].join(' ');
    if (reconstructed.length > cleaned.length * 0.3) {
      return reconstructed;
    }
  }
  
  return cleaned;
}

function calculateReadableRatio(text: string): number {
  if (!text || text.length === 0) return 0;
  
  const hebrewLetters = (text.match(/[\u05D0-\u05EA]/g) || []).length;
  const englishLetters = (text.match(/[a-zA-Z]/g) || []).length;
  const digits = (text.match(/\d/g) || []).length;
  const punctuation = (text.match(/[.,;:!?()[\]{}"-]/g) || []).length;
  const spaces = (text.match(/\s/g) || []).length;
  
  const readableChars = hebrewLetters + englishLetters + digits + punctuation + spaces;
  const ratio = (readableChars / text.length) * 100;
  
  const words = text.split(/\s+/).filter(word => 
    word.length > 1 && (/[\u05D0-\u05EA]/.test(word) || /[a-zA-Z]/.test(word))
  );
  const wordBonus = Math.min((words.length / 10) * 5, 15);
  
  return Math.min(ratio + wordBonus, 100);
}