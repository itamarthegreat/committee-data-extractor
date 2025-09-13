import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProcessedDocument } from '@/types/document';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface DocumentDetailsProps {
  document: ProcessedDocument;
  children: React.ReactNode;
}

const DocumentDetails = ({ document, children }: DocumentDetailsProps) => {
  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();
    
    // Create main info sheet
    const mainData = [
      ['שדה', 'ערך'],
      ['שם הקובץ', document.fileName],
      ['סוג הועדה', document.committeeType],
      ['תאריך ועדה', document.committeeDate],
      ['סניף הועדה', document.committeeBranch],
      ['שם המבוטח', document.insuredName],
      ['תעודת זהות', document.idNumber],
      ['תאריך פגיעה', document.injuryDate || 'לא רלוונטי']
    ];
    
    const mainSheet = XLSX.utils.aoa_to_sheet(mainData);
    XLSX.utils.book_append_sheet(workbook, mainSheet, 'פרטים כלליים');
    
    // Create committee members sheet
    if (document.committeeMembers.length > 0) {
      const membersData = [
        ['שם', 'תפקיד'],
        ...document.committeeMembers.map(member => [member.name, member.role])
      ];
      const membersSheet = XLSX.utils.aoa_to_sheet(membersData);
      XLSX.utils.book_append_sheet(workbook, membersSheet, 'משתתפי הועדה');
    }
    
    // Create diagnoses sheet
    if (document.diagnoses.length > 0) {
      const diagnosesData = [
        ['קוד אבחנה', 'תיאור'],
        ...document.diagnoses.map(diagnosis => [diagnosis.code, diagnosis.description])
      ];
      const diagnosesSheet = XLSX.utils.aoa_to_sheet(diagnosesData);
      XLSX.utils.book_append_sheet(workbook, diagnosesSheet, 'אבחנות');
    }
    
    // Create decision table sheet
    if (document.decisionTable.length > 0) {
      const decisionData = [
        ['פריט', 'החלטה', 'אחוז', 'הערות'],
        ...document.decisionTable.map(row => [
          row.item, 
          row.decision, 
          row.percentage?.toString() || '', 
          row.notes || ''
        ])
      ];
      const decisionSheet = XLSX.utils.aoa_to_sheet(decisionData);
      XLSX.utils.book_append_sheet(workbook, decisionSheet, 'טבלת החלטות');
    }
    
    // Create disability weight sheet
    if (document.disabilityWeightTable.length > 0) {
      const disabilityData = [
        ['איבר', 'אחוז', 'סוג', 'חישוב'],
        ...document.disabilityWeightTable.map(row => [
          row.bodyPart, 
          row.percentage.toString(), 
          row.type, 
          row.calculation
        ])
      ];
      const disabilitySheet = XLSX.utils.aoa_to_sheet(disabilityData);
      XLSX.utils.book_append_sheet(workbook, disabilitySheet, 'שקלול נכות');
    }
    
    // Save file
    XLSX.writeFile(workbook, `${document.fileName.replace('.pdf', '')}_מעובד.xlsx`);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto" aria-describedby="document-details-description">
        <DialogHeader>
          <div className="flex items-center justify-between mb-6">
            <div>
              <DialogTitle className="text-2xl font-bold text-foreground">{document.fileName}</DialogTitle>
              <p id="document-details-description" className="text-muted-foreground mt-1">
                פרטים מלאים של המסמך המעובד
              </p>
            </div>
            <Button onClick={exportToExcel} className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-medium" size="lg">
              <Download className="h-5 w-5 ml-2" />
              ייצא ל-Excel
            </Button>
          </div>
        </DialogHeader>
        
        <div className="space-y-6 mt-4">
          {/* Basic Info */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">פרטים כלליים</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-muted-foreground">סוג הועדה:</span>
                <span className="mr-2">{document.committeeType}</span>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">תאריך ועדה:</span>
                <span className="mr-2">{document.committeeDate}</span>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">סניף הועדה:</span>
                <span className="mr-2">{document.committeeBranch}</span>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">שם המבוטח:</span>
                <span className="mr-2">{document.insuredName}</span>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">תעודת זהות:</span>
                <span className="mr-2">{document.idNumber}</span>
              </div>
              {document.injuryDate && (
                <div>
                  <span className="font-medium text-muted-foreground">תאריך פגיעה:</span>
                  <span className="mr-2">{document.injuryDate}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Committee Members */}
          {document.committeeMembers.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold mb-3">משתתפי הועדה</h3>
              <div className="space-y-2">
                {document.committeeMembers.map((member, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                    <span className="font-medium">{member.name}</span>
                    <Badge variant="outline">{member.role}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Diagnoses */}
          {document.diagnoses.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold mb-3">אבחנות</h3>
              <div className="space-y-2">
                {document.diagnoses.map((diagnosis, index) => (
                  <div key={index} className="flex items-start gap-3 p-2 bg-muted/50 rounded">
                    <Badge variant="outline" className="shrink-0">{diagnosis.code}</Badge>
                    <span className="text-sm">{diagnosis.description}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Decision Table */}
          {document.decisionTable.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold mb-3">טבלת החלטות</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-right p-2">פריט</th>
                      <th className="text-right p-2">החלטה</th>
                      <th className="text-right p-2">אחוז</th>
                      <th className="text-right p-2">הערות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {document.decisionTable.map((row, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-2">{row.item}</td>
                        <td className="p-2">{row.decision}</td>
                        <td className="p-2">{row.percentage || '-'}</td>
                        <td className="p-2">{row.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Disability Weight Table */}
          {document.disabilityWeightTable.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold mb-3">טבלת שקלול נכות</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-right p-2">איבר</th>
                      <th className="text-right p-2">אחוז</th>
                      <th className="text-right p-2">סוג</th>
                      <th className="text-right p-2">חישוב</th>
                    </tr>
                  </thead>
                  <tbody>
                    {document.disabilityWeightTable.map((row, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-2">{row.bodyPart}</td>
                        <td className="p-2">{row.percentage}%</td>
                        <td className="p-2">{row.type}</td>
                        <td className="p-2">{row.calculation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentDetails;