import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Upload, Download, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import FileUpload from '@/components/FileUpload';
import ApiKeyInput from '@/components/ApiKeyInput';
import ProcessingResults from '@/components/ProcessingResults';
import { ProcessedDocument } from '@/types/document';
import OpenAI from 'openai';
import * as XLSX from 'xlsx';
// Basic PDF text extraction without external dependencies

const Index = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [apiKey, setApiKey] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ProcessedDocument[]>([]);
  const { toast } = useToast();

  const handleFilesChange = (newFiles: File[]) => {
    setFiles(newFiles);
  };

  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
    // Store in localStorage for convenience
    localStorage.setItem('openai_api_key', key);
  };

  const processDocuments = async () => {
    if (!apiKey) {
      toast({
        title: "שגיאה",
        description: "נא להזין מפתח API של OpenAI",
        variant: "destructive"
      });
      return;
    }

    if (files.length === 0) {
      toast({
        title: "שגיאה", 
        description: "נא לבחור קבצי PDF לעיבוד",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setResults([]);
    
    toast({
      title: "מתחיל עיבוד",
      description: `מעבד ${files.length} קבצים...`
    });

    const openai = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true
    });

    try {
      console.log('Processing files:', files);
      
      // Create initial processing results
      const processingResults: ProcessedDocument[] = files.map(file => ({
        fileName: file.name,
        committeeType: '',
        committeeDate: '',
        committeeBranch: '',
        insuredName: '',
        idNumber: '',
        injuryDate: '',
        committeeMembers: [],
        diagnoses: [],
        decisionTable: [],
        disabilityWeightTable: [],
        processingStatus: 'processing' as const,
      }));
      
      setResults(processingResults);

      // Process each file with OpenAI
      const processedResults = await Promise.all(
        files.map(async (file, index) => {
          try {
            // Proper PDF text extraction using pdfjs-dist
            const arrayBuffer = await file.arrayBuffer();
            
            let pdfText = '';
            try {
              // Dynamic import of pdfjs-dist for browser compatibility
              const pdfjsLib = await import('pdfjs-dist');
              
              // Set worker source for pdfjs
              pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
              
              // Load the PDF document
              const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
              const pdf = await loadingTask.promise;
              
              console.log(`PDF loaded successfully: ${pdf.numPages} pages`);
              
              // Extract text from all pages
              const textPages: string[] = [];
              
              for (let i = 1; i <= pdf.numPages; i++) {
                try {
                  const page = await pdf.getPage(i);
                  const textContent = await page.getTextContent();
                  
                  // Combine all text items from the page
                  const pageText = textContent.items
                    .map((item: any) => item.str)
                    .join(' ')
                    .trim();
                  
                  if (pageText) {
                    textPages.push(pageText);
                  }
                } catch (pageError) {
                  console.warn(`Error extracting text from page ${i}:`, pageError);
                }
              }
              
              pdfText = textPages.join('\n\n').trim();
              
              console.log(`Extracted text from ${file.name} (${pdf.numPages} pages, length: ${pdfText.length}):`, pdfText.substring(0, 500));
              
            } catch (parseError) {
              console.warn('PDF parsing error:', parseError);
              throw new Error('לא ניתן לחלץ טקסט מהקובץ. ייתכן שהקובץ מוגן או פגום.');
            }

            // Check if we have meaningful text
            if (!pdfText || pdfText.trim().length < 20) {
              throw new Error('לא ניתן לחלץ טקסט מהקובץ. ייתכן שהקובץ מוגן או פגום.');
            }

            console.log(`Extracted text from ${file.name}:`, pdfText.substring(0, 500));

            // Limit text length to avoid token limit (approximately 30,000 characters for safe processing)
            const maxLength = 30000;
            const truncatedText = pdfText.length > maxLength ? pdfText.substring(0, maxLength) + '...' : pdfText;

            // Create prompt for OpenAI
            const prompt = `
אתה עוזר AI המתמחה בעיבוד מסמכי ועדות רפואיות ישראליות. 
עליך לחלץ נתונים ממסמך הועדה הרפואית הבא ולהחזיר אותם בפורמט JSON מובנה.

טקסט המסמך:
${truncatedText}

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

            const completion = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: prompt }],
              temperature: 0.1,
            });

            const content = completion.choices[0].message.content;
            console.log(`OpenAI response for ${file.name}:`, content);

            let extractedData;
            try {
              // Clean the response - remove markdown code blocks if present
              let cleanContent = content || '{}';
              if (cleanContent.startsWith('```json')) {
                cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
              } else if (cleanContent.startsWith('```')) {
                cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
              }
              
              extractedData = JSON.parse(cleanContent);
            } catch (parseError) {
              console.error('JSON parse error:', parseError);
              throw new Error('תגובה לא תקינה מ-OpenAI');
            }

            return {
              fileName: file.name,
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
              processingStatus: 'completed' as const,
            };

          } catch (fileError) {
            console.error(`Error processing file ${file.name}:`, fileError);
            return {
              fileName: file.name,
              committeeType: '',
              committeeDate: '',
              committeeBranch: '',
              insuredName: '',
              idNumber: '',
              injuryDate: '',
              committeeMembers: [],
              diagnoses: [],
              decisionTable: [],
              disabilityWeightTable: [],
              processingStatus: 'error' as const,
              errorMessage: `שגיאה בעיבוד הקובץ: ${fileError.message}`,
            };
          }
        })
      );

      setResults(processedResults);
      setIsProcessing(false);
      
      const successCount = processedResults.filter(r => r.processingStatus === 'completed').length;
      const errorCount = processedResults.filter(r => r.processingStatus === 'error').length;
      
      toast({
        title: "העיבוד הושלם",
        description: `בוצע בהצלחה: ${successCount} קבצים${errorCount > 0 ? `, שגיאות: ${errorCount}` : ''}`,
        variant: errorCount > 0 ? "destructive" : "default"
      });
      
    } catch (error) {
      console.error('Processing error:', error);
      setIsProcessing(false);
      
      // Update all results to error status
      setResults(prev => prev.map(result => ({
        ...result,
        processingStatus: 'error' as const,
        errorMessage: 'שגיאה כללית בעיבוד'
      })));
      
      toast({
        title: "שגיאה בעיבוד",
        description: "אירעה שגיאה בעת עיבוד הקבצים",
        variant: "destructive"
      });
    }
  };

  const exportAllToExcel = () => {
    if (results.length === 0) return;
    
    const workbook = XLSX.utils.book_new();
    
    // Create summary sheet
    const summaryData = [
      ['שם הקובץ', 'סוג הועדה', 'תאריך ועדה', 'סניף', 'שם המבוטח', 'ת.ז', 'תאריך פגיעה', 'סטטוס'],
      ...results.map(doc => [
        doc.fileName,
        doc.committeeType,
        doc.committeeDate,
        doc.committeeBranch,
        doc.insuredName,
        doc.idNumber,
        doc.injuryDate || 'לא רלוונטי',
        doc.processingStatus === 'completed' ? 'הושלם' : doc.processingStatus === 'error' ? 'שגיאה' : 'בעיבוד'
      ])
    ];
    
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'סיכום כללי');
    
    // Process each completed document
    results.forEach((doc, index) => {
      if (doc.processingStatus === 'completed') {
        // Main info sheet for each document
        const mainData = [
          ['שדה', 'ערך'],
          ['שם הקובץ', doc.fileName],
          ['סוג הועדה', doc.committeeType],
          ['תאריך ועדה', doc.committeeDate],
          ['סניף הועדה', doc.committeeBranch],
          ['שם המבוטח', doc.insuredName],
          ['תעודת זהות', doc.idNumber],
          ['תאריך פגיעה', doc.injuryDate || 'לא רלוונטי']
        ];
        
        const mainSheet = XLSX.utils.aoa_to_sheet(mainData);
        const sheetName = `מסמך ${index + 1} - פרטים`;
        XLSX.utils.book_append_sheet(workbook, mainSheet, sheetName);
        
        // Committee members for this document
        if (doc.committeeMembers.length > 0) {
          const membersData = [
            ['שם', 'תפקיד'],
            ...doc.committeeMembers.map(member => [member.name, member.role])
          ];
          const membersSheet = XLSX.utils.aoa_to_sheet(membersData);
          XLSX.utils.book_append_sheet(workbook, membersSheet, `מסמך ${index + 1} - חברי ועדה`);
        }
        
        // Diagnoses for this document
        if (doc.diagnoses.length > 0) {
          const diagnosesData = [
            ['קוד אבחנה', 'תיאור'],
            ...doc.diagnoses.map(diagnosis => [diagnosis.code, diagnosis.description])
          ];
          const diagnosesSheet = XLSX.utils.aoa_to_sheet(diagnosesData);
          XLSX.utils.book_append_sheet(workbook, diagnosesSheet, `מסמך ${index + 1} - אבחנות`);
        }
        
        // Decision table for this document
        if (doc.decisionTable.length > 0) {
          const decisionData = [
            ['פריט', 'החלטה', 'אחוז', 'הערות'],
            ...doc.decisionTable.map(row => [
              row.item, 
              row.decision, 
              row.percentage?.toString() || '', 
              row.notes || ''
            ])
          ];
          const decisionSheet = XLSX.utils.aoa_to_sheet(decisionData);
          XLSX.utils.book_append_sheet(workbook, decisionSheet, `מסמך ${index + 1} - החלטות`);
        }
        
        // Disability weight for this document
        if (doc.disabilityWeightTable.length > 0) {
          const disabilityData = [
            ['איבר', 'אחוז', 'סוג', 'חישוב'],
            ...doc.disabilityWeightTable.map(row => [
              row.bodyPart, 
              row.percentage.toString(), 
              row.type, 
              row.calculation
            ])
          ];
          const disabilitySheet = XLSX.utils.aoa_to_sheet(disabilityData);
          XLSX.utils.book_append_sheet(workbook, disabilitySheet, `מסמך ${index + 1} - שקלול נכות`);
        }
      }
    });
    
    // Save file
    const timestamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `ועדות_רפואיות_מעובדות_${timestamp}.xlsx`);
    
    toast({
      title: "הורד בהצלחה",
      description: "הקובץ נשמר בהצלחה"
    });
  };

  return (
    <div className="min-h-screen bg-gradient-subtle p-6" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <FileText className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              מערכת עיבוד מסמכי ועדות
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            העלה קבצי PDF של מסמכי ועדות והמערכת תחלץ אוטומטית את כל הנתונים הרלוונטיים באמצעות AI
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Settings */}
          <div className="space-y-6">
            <Card className="p-6 shadow-soft">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">הגדרות</h2>
              </div>
              <ApiKeyInput value={apiKey} onChange={handleApiKeyChange} />
            </Card>

            <Card className="p-6 shadow-soft">
              <div className="flex items-center gap-2 mb-4">
                <Upload className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">העלאת קבצים</h2>
              </div>
              <FileUpload files={files} onFilesChange={handleFilesChange} />
            </Card>

            {/* Process Button */}
            <Button 
              onClick={processDocuments}
              disabled={isProcessing || !apiKey || files.length === 0}
              className="w-full h-12 text-lg font-semibold bg-gradient-primary hover:opacity-90 transition-smooth"
              size="lg"
            >
              {isProcessing ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  מעבד...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  עבד מסמכים
                </div>
              )}
            </Button>
          </div>

          {/* Right Panel - Results */}
          <div className="lg:col-span-2">
            <Card className="p-6 shadow-soft min-h-[600px]">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Download className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold">תוצאות עיבוד</h2>
                </div>
                {results.length > 0 && (
                  <Button variant="outline" className="gap-2" onClick={exportAllToExcel}>
                    <Download className="h-4 w-4" />
                    ייצא לExcel
                  </Button>
                )}
              </div>
              
              <ProcessingResults 
                results={results} 
                isProcessing={isProcessing}
                filesCount={files.length}
              />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;