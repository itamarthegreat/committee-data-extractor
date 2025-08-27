import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { ProcessedDocument } from '@/types/document';

interface ProcessingResultsProps {
  results: ProcessedDocument[];
  isProcessing: boolean;
  filesCount: number;
}

const ProcessingResults = ({ results, isProcessing, filesCount }: ProcessingResultsProps) => {
  if (!isProcessing && results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center space-y-4">
        <FileText className="h-16 w-16 text-muted-foreground/50" />
        <div>
          <h3 className="text-lg font-medium text-muted-foreground">
            עדיין לא עובדו מסמכים
          </h3>
          <p className="text-sm text-muted-foreground mt-2">
            העלה קבצי PDF והזן מפתח API כדי להתחיל
          </p>
        </div>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center space-y-4">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <div>
          <h3 className="text-lg font-medium">
            מעבד {filesCount} קבצים...
          </h3>
          <p className="text-sm text-muted-foreground mt-2">
            זה עלול לקחת מספר דקות, אנא המתן
          </p>
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: ProcessedDocument['processingStatus']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-warning" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: ProcessedDocument['processingStatus']) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-success text-success-foreground">הושלם</Badge>;
      case 'processing':
        return <Badge variant="default" className="bg-warning text-warning-foreground">מעבד</Badge>;
      case 'error':
        return <Badge variant="destructive">שגיאה</Badge>;
      default:
        return <Badge variant="outline">ממתין</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {results.map((doc, index) => (
        <Card key={index} className="p-4 hover:shadow-medium transition-shadow">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              {getStatusIcon(doc.processingStatus)}
              <div>
                <h4 className="font-medium truncate max-w-[300px]">
                  {doc.fileName}
                </h4>
                {doc.processingStatus === 'completed' && (
                  <p className="text-sm text-muted-foreground">
                    {doc.insuredName} - {doc.committeeType}
                  </p>
                )}
              </div>
            </div>
            {getStatusBadge(doc.processingStatus)}
          </div>

          {doc.processingStatus === 'error' && (
            <div className="p-3 bg-destructive/10 rounded-md">
              <p className="text-sm text-destructive">
                {doc.errorMessage || 'אירעה שגיאה בעיבוד הקובץ'}
              </p>
            </div>
          )}

          {doc.processingStatus === 'completed' && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-muted-foreground">תאריך ועדה:</span>
                <span className="mr-2">{doc.committeeDate}</span>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">סניף:</span>
                <span className="mr-2">{doc.committeeBranch}</span>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">ת.ז:</span>
                <span className="mr-2">{doc.idNumber}</span>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">אבחנות:</span>
                <span className="mr-2">{doc.diagnoses.length}</span>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};

export default ProcessingResults;