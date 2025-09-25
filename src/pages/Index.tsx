import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Upload, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import FileUpload from '@/components/FileUpload';
import ProcessingResults from '@/components/ProcessingResults';
import { ProcessedDocument } from '@/types/document';
import { ExcelExporter } from '@/services/excelExporter';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ProcessedDocument[]>([]);
  const { toast } = useToast();

  const handleFilesChange = (newFiles: File[]) => {
    setFiles(newFiles);
  };

  const processDocuments = async () => {
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

    try {
      console.log('Processing files with server-side edge function:', files);
      
      // Create initial processing results
      const processingResults: ProcessedDocument[] = files.map(file => ({
        fileName: file.name,
        "סוג ועדה": null,
        "שם טופס": null,
        "סניף הוועדה": null,
        "שם המבוטח": null,
        "ת.ז:": null,
        "תאריך פגיעה(רק באיבה,נכות מעבודה)": null,
        "משתתפי הועדה": null,
        "תקופה": null,
        "אבחנה": null,
        "סעיף ליקוי": null,
        "אחוז הנכות הנובע מהפגיעה": null,
        "הערות": null,
        "מתאריך": null,
        "עד תאריך": null,
        "מידת הנכות": null,
        "אחוז הנכות משוקלל": null,
        "שקלול לפטור ממס": null,
        processingStatus: 'processing' as const
      }));
      
      setResults(processingResults);

      // Process each file through the edge function
      const processedResults: ProcessedDocument[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          console.log(`Processing file ${i + 1}/${files.length}: ${file.name}`);
          
          const formData = new FormData();
          formData.append('file', file);
          
          const { data, error } = await supabase.functions.invoke('process-documents', {
            body: formData,
          });
          
          if (error) {
            throw new Error(error.message);
          }
          
          processedResults.push(data);
          
          // Update results incrementally
          setResults(prev => prev.map((result, index) => 
            index === i ? data : result
          ));
          
        } catch (fileError) {
          console.error(`Error processing file ${file.name}:`, fileError);
          const errorResult = {
            fileName: file.name,
            "סוג ועדה": null,
            "שם טופס": null,
            "סניף הוועדה": null,
            "שם המבוטח": null,
            "ת.ז:": null,
            "תאריך פגיעה(רק באיבה,נכות מעבודה)": null,
            "משתתפי הועדה": null,
            "תקופה": null,
            "אבחנה": null,
            "סעיף ליקוי": null,
            "אחוז הנכות הנובע מהפגיעה": null,
            "הערות": null,
            "מתאריך": null,
            "עד תאריך": null,
            "מידת הנכות": null,
            "אחוז הנכות משוקלל": null,
            "שקלול לפטור ממס": null,
            processingStatus: 'error' as const,
            errorMessage: fileError instanceof Error ? fileError.message : 'Unknown error'
          } as ProcessedDocument;
          
          processedResults.push(errorResult);
          
          // Update results incrementally
          setResults(prev => prev.map((result, index) => 
            index === i ? errorResult : result
          ));
        }
      }

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
    
    ExcelExporter.exportToExcel(results);
    
    toast({
      title: "הורד בהצלחה",
      description: "הקובץ נשמר בהצלחה עם מיפוי משופר"
    });
  };

  return (
    <div className="min-h-screen bg-gradient-subtle p-6" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-6 mb-12">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="p-3 rounded-2xl bg-gradient-primary">
              <FileText className="h-10 w-10 text-white" />
            </div>
            <div>
              <h1 className="text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                מערכת עיבוד ועדות רפואיות
              </h1>
              <p className="text-xl text-muted-foreground mt-2">
                חילוץ אוטומטי של נתונים ממסמכי ביטוח לאומי באמצעות AI
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Left Panel - Controls */}
          <div className="xl:col-span-1 space-y-6">
            <Card className="p-6 shadow-soft border-0 bg-card/50 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Upload className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-xl font-semibold">העלאת קבצים</h2>
              </div>
              <FileUpload files={files} onFilesChange={handleFilesChange} />
              
              {/* Process Button */}
              <Button 
                onClick={processDocuments}
                disabled={isProcessing || files.length === 0}
                className="w-full h-12 text-lg font-semibold bg-gradient-primary hover:opacity-90 transition-smooth mt-6"
                size="lg"
              >
                {isProcessing ? (
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    מעבד מסמכים...
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5" />
                    עבד מסמכים ({files.length})
                  </div>
                )}
              </Button>
            </Card>
          </div>

          {/* Right Panel - Results */}
          <div className="xl:col-span-3">
            <Card className="p-8 shadow-soft border-0 bg-card/50 backdrop-blur-sm min-h-[700px]">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Download className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold">תוצאות עיבוד</h2>
                    <p className="text-muted-foreground">נתונים מחולצים ממסמכי הועדות</p>
                  </div>
                </div>
                {results.length > 0 && (
                  <Button variant="outline" className="gap-3 h-11 px-6" onClick={exportAllToExcel}>
                    <Download className="h-5 w-5" />
                    ייצא ל-Excel
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