import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProcessedDocument } from "@/types/document";
import * as XLSX from 'xlsx';

interface DocumentDetailsProps {
  document: ProcessedDocument;
  children: React.ReactNode;
}

const DocumentDetails = ({ document, children }: DocumentDetailsProps): JSX.Element => {
  
  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();
    
    const docData = [
      ['שדה', 'ערך'],
      ['שם קובץ', document.fileName],
      ['כותרת הועדה', document["כותרת הועדה"] || 'לא זוהה'],
      ['סוג ועדה', document["סוג ועדה"] || 'לא זוהה'],
      ['שם טופס', document["שם טופס"] || 'לא זוהה'],
      ['סניף הועדה', document["סניף הוועדה"] || 'לא זוהה'],
      ['שם המבוטח', document["שם המבוטח"] || 'לא זוהה'],
      ['ת.ז:', document["ת.ז:"] || 'לא נמצא'],
      ['תאריך ועדה', document["תאריך ועדה"] || 'לא זוהה'],
      ['תאריך פגיעה', document["תאריך פגיעה(רק באיבה,נכות מעבודה)"] || 'לא רלוונטי'],
      ['משתתף ועדה 1', document["משתתף ועדה 1"] || 'לא זוהה'],
      ['משתתף ועדה 2', document["משתתף ועדה 2"] || 'לא זוהה'],
      ['משתתף ועדה 3', document["משתתף ועדה 3"] || 'לא זוהה'],
      ['משתתף ועדה 4', document["משתתף ועדה 4"] || 'לא זוהה'],
      ['אחוז הנכות הנובע מהפגיעה', document["אחוז הנכות הנובע מהפגיעה"] || 'לא צוין'],
      ['אחוז הנכות משוקלל', document["אחוז הנכות משוקלל"] || 'לא צוין'],
      ['שקלול לפטור ממס', document["שקלול לפטור ממס"] || 'לא צוין']
    ];
    
    const docSheet = XLSX.utils.aoa_to_sheet(docData);
    XLSX.utils.book_append_sheet(workbook, docSheet, 'פרטי מסמך');
    
    // Add decisions table if exists
    if (document["החלטות"] && Array.isArray(document["החלטות"]) && document["החלטות"].length > 0) {
      const decisionsSheet = [
        ['מס"ד', 'אבחנה', 'סעיף ליקוי', 'אחוז נכות', 'מתאריך', 'עד תאריך', 'מידת הנכות', 'הערות']
      ];
      
      document["החלטות"].forEach((decision, idx) => {
        decisionsSheet.push([
          (idx + 1).toString(),
          decision["אבחנה"] || '-',
          decision["סעיף ליקוי"] || '-',
          decision["אחוז הנכות"] || '-',
          decision["מתאריך"] || '-',
          decision["עד תאריך"] || '-',
          decision["מידת הנכות"] || '-',
          decision["הערות"] || '-'
        ]);
      });
      
      const decisionsSheetObj = XLSX.utils.aoa_to_sheet(decisionsSheet);
      XLSX.utils.book_append_sheet(workbook, decisionsSheetObj, 'החלטות');
    }
    
    const timestamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `${document.fileName}_${timestamp}.xlsx`);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-right">פרטי מסמך: {document.fileName}</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-6" dir="rtl">
            
            <div className="flex justify-end">
              <Button onClick={exportToExcel} className="bg-green-600 hover:bg-green-700">
                ייצוא ל-Excel
              </Button>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>{document["כותרת הועדה"] || "מידע כללי"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {Object.entries({
                    'שם קובץ': document.fileName,
                    'כותרת הועדה': document["כותרת הועדה"],
                    'סוג ועדה': document["סוג ועדה"],
                    'שם טופס': document["שם טופס"],
                    'סניף הועדה': document["סניף הוועדה"],
                    'שם המבוטח': document["שם המבוטח"],
                    'ת.ז:': document["ת.ז:"],
                    'תאריך ועדה': document["תאריך ועדה"],
                    'תאריך פגיעה': document["תאריך פגיעה(רק באיבה,נכות מעבודה)"],
                    'משתתף ועדה 1': document["משתתף ועדה 1"],
                    'משתתף ועדה 2': document["משתתף ועדה 2"],
                    'משתתף ועדה 3': document["משתתף ועדה 3"],
                    'משתתף ועדה 4': document["משתתף ועדה 4"],
                    'אחוז הנכות הנובע מהפגיעה': document["אחוז הנכות הנובע מהפגיעה"],
                    'אחוז הנכות משוקלל': document["אחוז הנכות משוקלל"],
                    'שקלול לפטור ממס': document["שקלול לפטור ממס"]
                  }).map(([key, value]) => (
                    <div key={key}>
                      <span className="font-medium">{key}:</span> {value || 'לא זוהה'}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {document["החלטות"] && Array.isArray(document["החלטות"]) && document["החלטות"].length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>החלטות ({document["החלטות"].length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {document["החלטות"].map((decision, idx) => (
                      <div key={idx} className="border-b pb-3 last:border-b-0">
                        <div className="font-medium mb-2">החלטה {idx + 1}</div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div><span className="font-medium">אבחנה:</span> {decision["אבחנה"] || 'לא זוהה'}</div>
                          <div><span className="font-medium">סעיף ליקוי:</span> {decision["סעיף ליקוי"] || 'לא זוהה'}</div>
                          <div><span className="font-medium">אחוז נכות:</span> {decision["אחוז הנכות"] || 'לא זוהה'}</div>
                          <div><span className="font-medium">מידת הנכות:</span> {decision["מידת הנכות"] || 'לא זוהה'}</div>
                          <div><span className="font-medium">מתאריך:</span> {decision["מתאריך"] || 'לא זוהה'}</div>
                          <div><span className="font-medium">עד תאריך:</span> {decision["עד תאריך"] || 'לא זוהה'}</div>
                          {decision["הערות"] && (
                            <div className="col-span-2"><span className="font-medium">הערות:</span> {decision["הערות"]}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentDetails;