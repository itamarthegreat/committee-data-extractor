import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, XCircle, FileText, Eye, Download } from "lucide-react";
import DocumentDetails from "@/components/DocumentDetails";
import { ProcessedDocument } from "@/types/document";
import * as XLSX from 'xlsx';

interface ProcessingResultsProps {
  results: ProcessedDocument[];
  isProcessing: boolean;
  filesCount: number;
}

const ProcessingResults = ({ results, isProcessing, filesCount }: ProcessingResultsProps) => {
  
  // Debug logging
  console.log('ProcessingResults received results:', results);
  if (results.length > 0) {
    console.log('First result keys:', Object.keys(results[0]));
    console.log('First result data:', results[0]);
  }
  
  // Show placeholder when no documents processed yet
  if (results.length === 0 && !isProcessing) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">אין מסמכים מעובדים</h3>
          <p className="text-sm text-muted-foreground">
            העלה קבצי PDF ולחץ על "עבד מסמכים" כדי להתחיל
          </p>
        </CardContent>
      </Card>
    );
  }

  // Show processing state
  if (isProcessing) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Clock className="mx-auto h-12 w-12 text-primary mb-4 animate-spin" />
          <h3 className="text-lg font-medium mb-2">מעבד מסמכים...</h3>
          <p className="text-sm text-muted-foreground">
            מעבד {filesCount} קבצים עם OpenAI
          </p>
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = (status: ProcessedDocument['processingStatus']): JSX.Element => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'processing':
        return <Clock className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: ProcessedDocument['processingStatus']): JSX.Element => {
    switch (status) {
      case 'completed':
        return <Badge variant="secondary" className="bg-green-100 text-green-700">הושלם</Badge>;
      case 'processing':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700">מעבד</Badge>;
      case 'error':
        return <Badge variant="destructive">שגיאה</Badge>;
      default:
        return <Badge variant="secondary">ממתין</Badge>;
    }
  };

  const exportSingleDocument = (doc: ProcessedDocument) => {
    const workbook = XLSX.utils.book_new();
    
    // Add document details with all new fields
    const docData = [
      ['שדה', 'ערך'],
      ['שם קובץ', doc.fileName],
      ['סוג ועדה', doc["סוג ועדה"] || 'לא זוהה'],
      ['שם טופס', doc["שם טופס"] || 'לא זוהה'],
      ['סניף הועדה', doc["סניף הוועדה"] || 'לא זוהה'],
      ['שם המבוטח', doc["שם המבוטח"] || 'לא זוהה'],
      ['ת.ז:', doc["ת.ז:"] || 'לא נמצא'],
      ['תאריך פגיעה(רק באיבה,נכות מעבודה)', doc["תאריך פגיעה(רק באיבה,נכות מעבודה)"] || 'לא רלוונטי'],
      ['משתתפי הועדה', doc["משתתפי הועדה"] || 'לא זוהו'],
      ['תקופה', doc["תקופה"] || 'לא צוינה'],
      ['אבחנה', doc["אבחנה"] || 'לא צוינה'],
      ['סעיף ליקוי', doc["סעיף ליקוי"] || 'לא צוין'],
      ['אחוז הנכות הנובע מהפגיעה', doc["אחוז הנכות הנובע מהפגיעה"] || 'לא צוין'],
      ['הערות', doc["הערות"] || 'אין'],
      ['מתאריך', doc["מתאריך"] || 'לא צוין'],
      ['עד תאריך', doc["עד תאריך"] || 'לא צוין'],
      ['מידת הנכות', doc["מידת הנכות"] || 'לא צוינה'],
      ['אחוז הנכות משוקלל', doc["אחוז הנכות משוקלל"] || 'לא צוין'],
      ['שקלול לפטור ממס', doc["שקלול לפטור ממס"] || 'לא צוין']
    ];
    
    const docSheet = XLSX.utils.aoa_to_sheet(docData);
    XLSX.utils.book_append_sheet(workbook, docSheet, 'פרטי מסמך');
    
    // Save file
    const timestamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `${doc.fileName.replace('.pdf', '')}_${timestamp}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {results.map((doc, index) => (
        <Card key={index} className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusIcon(doc.processingStatus)}
                <div>
                  <h4 className="font-medium truncate max-w-[300px]">
                    {doc.fileName}
                  </h4>
                  {doc.processingStatus === 'completed' && (
                    <p className="text-sm text-muted-foreground">
                      {doc["שם המבוטח"] || 'שם לא זוהה'} - {doc["סוג ועדה"] || 'סוג ועדה לא ידוע'}
                    </p>
                  )}
                </div>
              </div>
              {getStatusBadge(doc.processingStatus)}
            </div>
          </CardHeader>

          {doc.processingStatus === 'error' && (
            <CardContent className="pt-0">
              <div className="p-3 bg-destructive/10 rounded-md">
                <p className="text-sm text-destructive">
                  {doc.errorMessage || 'אירעה שגיאה בעיבוד הקובץ'}
                </p>
              </div>
            </CardContent>
          )}

          {doc.processingStatus === 'completed' && (
            <CardContent className="pt-0">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">סוג ועדה:</span> {doc["סוג ועדה"] || 'לא זוהה'}
                  </div>
                  <div>
                    <span className="font-medium">שם טופס:</span> {doc["שם טופס"] || 'לא זוהה'}
                  </div>
                  <div>
                    <span className="font-medium">סניף הועדה:</span> {doc["סניף הוועדה"] || 'לא זוהה'}
                  </div>
                  <div>
                    <span className="font-medium">תעודת זהות:</span> {doc["ת.ז:"] || 'לא זוהה'}
                  </div>
                </div>
                
                <div className="flex gap-2 pt-2 border-t">
                  <DocumentDetails document={doc}>
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-2" />
                      צפה בפרטים
                    </Button>
                  </DocumentDetails>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => exportSingleDocument(doc)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    ייצוא ל-Excel
                  </Button>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
};

export default ProcessingResults;