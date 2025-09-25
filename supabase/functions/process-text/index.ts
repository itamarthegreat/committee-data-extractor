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
  return `אתה מומחה בחילוץ מידע ממסמכי ועדות רפואיות של ביטוח לאומי בעברית.

**כללים קריטיים:**
1. חפש בכל העמודים - לא רק בעמודים פנימיים
2. כל שדה חייב להתבסס על מידע מדויק מהמסמך - לא להמציא כלום!
3. אם המידע לא נמצא במסמך - החזר null במקום לנחש
4. שים לב למידע בכותרות ובתחילת המסמך

**טקסט המסמך:**
${text}

**משימה:** חלץ מידע מכל העמודים:

**1. פרטי המבוטח - חפש בכל המקומות הבאים:**
- **שם המבוטח**: 
  • בכותרת העליונה (כמו "קיבוביץ מיקה")
  • בטבלת "פרטים אישיים" תחת "שם:"
  • בכל מקום שמופיע השם המלא
- **ת.ז:**: 
  • בכותרת העליונה לאחר "זהות, מספר:" או "מספר זהות:"
  • בטבלת "פרטים אישיים" תחת "מספר זהות:"
  • בכל מקום שמופיע מספר של 8-9 ספרות

**2. משתתפי הועדה - חפש בקטע "משתתפי הועדה":**
- **פורמט טבלה**: עמודה עם תפקיד (כמו "מזכיר הישיבה", "פסיכיאטריה") ועמודה עם שם
- **דוגמאות**: "חיעינבל (מזכיר הישיבה), ד״ר ויינר יפעת (פסיכיאטריה)"
- **שלב תפקיד ושם**: "שם (תפקיד)" או "ד״ר שם תפקיד"

**3. סוג הוועדה והטופס:**
- **סוג ועדה**: חפש "ועדת אשכול נפגעי עבודה" או "ועדה רפואית" 
- **שם טופס**: קבע לפי תוכן:
  • אם יש "איבה" בכותרת = "איבה"
  • אם יש "תאריך פגיעה" + "מעבודה" = "נכות מעבודה"
  • אם אין תאריך פגיעה = "נכות כללית"
- **סניף הוועדה**: כמו "סניף ראשי רמת גן"

**4. תאריכים:**
- **תאריך פגיעה**: "תאריך האירוע:" או "תאריך פגיעה:" (רק אם קיים)

**5. אבחנות ונכות:**
- **אבחנה**: מטבלת אבחנות - הפרד מספר אבחנות בפסיק
- **סעיף ליקוי**: קודים כמו "F43", "34א)ב("
- **אחוז הנכות**: מטבלת החלטות
- **תקופה**: תקופות הנכות
- **מידת הנכות**: זמני/צמית

**פורמט החזרה - JSON בלבד:**
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

**חובה: רק JSON, ללא הסברים או טקסט נוסף!**`;
}

function parseOpenAIResponse(content: string): any {
  console.log('OpenAI raw response content:', content);
  
  try {
    // Clean the response
    let cleanContent = content;
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    cleanContent = fixJsonFormatting(cleanContent);
    
    let extractedData;
    try {
      extractedData = JSON.parse(cleanContent);
    } catch (parseError) {
      const fixedContent = cleanContent
        .replace(/\u200B/g, '')
        .replace(/\u00A0/g, ' ')
        .replace(/[\u200C\u200D]/g, '')
        .trim();
      extractedData = JSON.parse(fixedContent);
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
  
  const jsonStart = fixed.indexOf('{');
  const jsonEnd = fixed.lastIndexOf('}') + 1;
  if (jsonStart !== -1 && jsonEnd !== -1) {
    fixed = fixed.substring(jsonStart, jsonEnd);
  }
  
  fixed = fixed.replace(/}\s*\n?\s*{/g, '},\n    {');
  fixed = fixed.replace(/"\s*\n\s*"/g, '",\n  "');
  fixed = fixed.replace(/"\s*\n\s*}/g, '"\n  }');
  fixed = fixed.replace(/]\s*\n\s*"/g, '],\n  "');
  fixed = fixed.replace(/"null"/g, 'null');
  fixed = fixed.replace(/,\s*}/g, '}');
  fixed = fixed.replace(/,\s*]/g, ']');
  fixed = fixed.replace(/(\n\s*)([^"{\s][^:\n]*?)(\s*:)/g, '$1"$2"$3');
  
  return fixed;
}

function cleanHebrewText(text: string): string {
  if (!text) return '';
  
  let cleaned = text
    .replace(/[\u0591-\u05BD\u05BF-\u05C2\u05C4-\u05C5\u05C7]/g, '')
    .replace(/[׃־]/g, ' ')
    .replace(/[\u05D0-\u05EA][\u0590-\u05C7]+/g, match => match.charAt(0))
    .replace(/[״׳]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  
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