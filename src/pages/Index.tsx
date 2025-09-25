import React, { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";
import FileUpload from "@/components/FileUpload";
import ProcessingResults from "@/components/ProcessingResults";
import { DocumentProcessor } from "@/services/documentProcessor";
import { ProcessedDocument } from "@/types/document";
import { ExcelExporter } from "@/services/excelExporter";

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
        description: "אנא בחר קבצים לעיבוד",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      // Use the original DocumentProcessor that will now use server-side API keys
      const processor = new DocumentProcessor();
      const processedResults = await processor.processMultipleFiles(files);
      
      setResults(processedResults);
      
      const successCount = processedResults.filter(r => r.processingStatus === 'completed').length;
      const errorCount = processedResults.filter(r => r.processingStatus === 'error').length;
      
      toast({
        title: "עיבוד הושלם",
        description: `עובדו בהצלחה: ${successCount}, שגיאות: ${errorCount}`,
      });
      
    } catch (error) {
      console.error('Processing error:', error);
      toast({
        title: "שגיאת עיבוד",
        description: error.message || "אירעה שגיאה לא צפויה",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            מערכת עיבוד ועדות רפואיות
          </h1>
          <p className="text-xl text-gray-600">
            חילוץ אוטומטי של נתונים ממסמכי ביטוח לאומי באמצעות AI
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Controls */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>הגדרות וקבצים</CardTitle>
                <CardDescription>
                  העלה קבצי PDF של ועדות רפואיות לעיבוד אוטומטי
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FileUpload files={files} onFilesChange={handleFilesChange} />
                
                <Button 
                  onClick={processDocuments} 
                  disabled={isProcessing || files.length === 0}
                  className="w-full"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      מעבד מסמכים...
                    </>
                  ) : (
                    `עבד מסמכים (${files.length})`
                  )}
                </Button>
                
                {results.length > 0 && (
                  <Button 
                    onClick={exportAllToExcel}
                    variant="outline"
                    className="w-full"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    יצא לאקסל
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Results */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>תוצאות עיבוד</CardTitle>
                <CardDescription>
                  נתונים מחולצים ממסמכי הועדות הרפואיות
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProcessingResults 
                  results={results} 
                  isProcessing={isProcessing}
                  filesCount={files.length}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;