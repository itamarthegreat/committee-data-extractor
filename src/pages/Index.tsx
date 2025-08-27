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
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.54/pdf.worker.min.js`;

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
            // Extract text from PDF using PDF.js
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            
            let pdfText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');
              pdfText += pageText + '\n';
            }

            console.log(`Extracted text from ${file.name}:`, pdfText.substring(0, 500));

            // Create prompt for OpenAI
            const prompt = `
אתה עוזר AI המתמחה בעיבוד מסמכי ועדות רפואיות ישראליות. 
עליך לחלץ נתונים ממסמך הועדה הרפואית הבא ולהחזיר אותם בפורמט JSON מובנה.

טקסט המסמך:
${pdfText}

אנא חלץ את הנתונים הבאים והחזר אותם בפורמט JSON:

{
  "committeeType": "סוג הועדה (למשל: ועדה רפואית)",
  "committeeDate": "תאריך הועדה (YYYY-MM-DD)",
  "committeeBranch": "סניף הועדה",
  "insuredName": "שם המבוטח",
  "idNumber": "מספר זהות",
  "injuryDate": "תאריך הפגיעה",
  "committeeMembers": [
    {"name": "שם החבר", "role": "תפקיד"}
  ],
  "diagnoses": [
    {"code": "קוד אבחנה", "description": "תיאור האבחנה"}
  ],
  "decisionTable": [
    {"item": "פריט", "decision": "החלטה", "percentage": אחוז_מספרי, "notes": "הערות"}
  ],
  "disabilityWeightTable": [
    {"bodyPart": "איבר", "percentage": אחוז_מספרי, "type": "סוג", "calculation": "חישוב"}
  ]
}

חשוב: החזר רק את ה-JSON ללא טקסט נוסף.`;

            const completion = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: prompt }],
              temperature: 0.1,
            });

            const content = completion.choices[0].message.content;
            console.log(`OpenAI response for ${file.name}:`, content);

            let extractedData;
            try {
              extractedData = JSON.parse(content || '{}');
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
                  <Button variant="outline" className="gap-2">
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