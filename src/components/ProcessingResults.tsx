import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Clock, CheckCircle, AlertCircle, Download, Eye } from 'lucide-react';
import { ProcessedDocument } from '@/types/document';
import DocumentDetails from './DocumentDetails';
import * as XLSX from 'xlsx';

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
            <div className="space-y-4">
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
                  onClick={(e) => {
                    e.stopPropagation();
                    const exportSingleDoc = () => {
                      const workbook = XLSX.utils.book_new();
                      
                      // Main info
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
                      XLSX.utils.book_append_sheet(workbook, mainSheet, 'פרטים כלליים');
                      
                      // Committee members
                      if (doc.committeeMembers.length > 0) {
                        const membersData = [
                          ['שם', 'תפקיד'],
                          ...doc.committeeMembers.map(member => [member.name, member.role])
                        ];
                        const membersSheet = XLSX.utils.aoa_to_sheet(membersData);
                        XLSX.utils.book_append_sheet(workbook, membersSheet, 'משתתפי הועדה');
                      }
                      
                      // Diagnoses
                      if (doc.diagnoses.length > 0) {
                        const diagnosesData = [
                          ['קוד אבחנה', 'תיאור'],
                          ...doc.diagnoses.map(diagnosis => [diagnosis.code, diagnosis.description])
                        ];
                        const diagnosesSheet = XLSX.utils.aoa_to_sheet(diagnosesData);
                        XLSX.utils.book_append_sheet(workbook, diagnosesSheet, 'אבחנות');
                      }
                      
                      // Decision table
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
                        XLSX.utils.book_append_sheet(workbook, decisionSheet, 'טבלת החלטות');
                      }
                      
                      // Disability weight
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
                        XLSX.utils.book_append_sheet(workbook, disabilitySheet, 'שקלול נכות');
                      }
                      
                      XLSX.writeFile(workbook, `${doc.fileName.replace('.pdf', '')}_מעובד.xlsx`);
                    };
                    exportSingleDoc();
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  ייצא לאקסל
                </Button>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};

export default ProcessingResults;