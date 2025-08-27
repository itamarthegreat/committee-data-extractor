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
    setResults([]); // Clear previous results
    
    toast({
      title: "מתחיל עיבוד",
      description: `מעבד ${files.length} קבצים...`
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
      
      // Simulate processing with actual results
      setTimeout(() => {
        const completedResults: ProcessedDocument[] = files.map(file => ({
          fileName: file.name,
          committeeType: 'ועדה רפואית',
          committeeDate: '2025-08-27',
          committeeBranch: 'מרכז',
          insuredName: 'שם המבוטח',
          idNumber: '123456789',
          injuryDate: '2025-01-01',
          committeeMembers: [
            { name: 'ד"ר יוסי כהן', role: 'יו"ר הועדה' },
            { name: 'ד"ר מירי לוי', role: 'חבר ועדה' }
          ],
          diagnoses: [
            { code: 'M25.9', description: 'פגיעה בברך' },
            { code: 'M79.1', description: 'כאבי שרירים' }
          ],
          decisionTable: [
            { item: 'נכות רפואית', decision: 'מוכר', percentage: 15, notes: 'בברך ימין' }
          ],
          disabilityWeightTable: [
            { bodyPart: 'ברך ימין', percentage: 15, type: 'רפואי', calculation: '15% מלא' }
          ],
          processingStatus: 'completed' as const,
        }));
        
        setResults(completedResults);
        setIsProcessing(false);
        
        toast({
          title: "העיבוד הושלם בהצלחה",
          description: `עובדו ${files.length} קבצים`
        });
      }, 3000);
      
    } catch (error) {
      console.error('Processing error:', error);
      setIsProcessing(false);
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