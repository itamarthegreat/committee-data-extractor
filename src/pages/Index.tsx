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

  const sendExportNotification = async (documents: ProcessedDocument[]) => {
    const webhookUrl = "https://25ddcab8efd846c887ba8300533a77.72.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/1eda0255165a4bc68febce2c8ad7ef97/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=BWfq5jArj34ke1b_iH4Nt4XQCRVzXQ_XkTGVQZZ5haQ";
    
    const payload = {
      exportDate: new Date().toISOString(),
      totalDocuments: documents.length,
      documents: documents.map(doc => ({
        caseNumber: doc["ת.ז:"] || "לא זמין", // מספר התיק - משתמש בת.ז כמזהה
        fileName: doc.fileName,
        patientName: doc["שם המבוטח"],
        idNumber: doc["ת.ז:"],
        committeeType: doc["סוג ועדה"],
        committeeDate: doc["תאריך ועדה"],
        committeeBranch: doc["סניף הוועדה"],
        injuryDate: doc["תאריך פגיעה(רק באיבה,נכות מעבודה)"],
        decisions: doc["החלטות"] || [],
        totalDisabilityPercentage: doc["אחוז הנכות הנובע מהפגיעה"],
        weightedDisabilityPercentage: doc["אחוז הנכות משוקלל"],
        taxExemptionWeighting: doc["שקלול לפטור ממס"],
        processingStatus: doc.processingStatus
      }))
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error('Failed to send notification:', response.statusText);
      } else {
        console.log('Export notification sent successfully');
      }
    } catch (error) {
      console.error('Error sending export notification:', error);
    }
  };

  const exportAllToExcel = async () => {
    if (results.length === 0) return;
    
    const successfulResults = results.filter(r => r.processingStatus === 'completed');
    const totalDiagnoses = successfulResults.reduce((count, doc) => {
      const diagnosis = doc["אבחנה"];
      if (diagnosis && diagnosis.trim() !== '') {
        const diagnosesArray = diagnosis.split(/[,،;؛]/).map(d => d.trim()).filter(d => d.length > 0);
        return count + diagnosesArray.length;
      }
      return count;
    }, 0);
    
    ExcelExporter.exportToExcel(results);
    
    // שליחת הודעה עם הנתונים
    await sendExportNotification(results);
    
    toast({
      title: "יוצא לאקסל בהצלחה!",
      description: `נוצר קובץ אקסל עם ${results.length} מסמכים, ${totalDiagnoses} אבחנות, וגליון "כולם ביחד"`
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
                    יצא הכל לאקסל ({results.length} מסמכים)
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