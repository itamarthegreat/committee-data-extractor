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
      ['משתתפי הועדה', document["משתתפי הועדה"] || 'לא זוהו'],
      ['אבחנה', document["אבחנה"] || 'לא צוינה'],
      ['סעיף ליקוי', document["סעיף ליקוי"] || 'לא צוין'],
      ['אחוז הנכות', document["אחוז הנכות"] || 'לא צוין'],
      ['אחוז הנכות הנובע מהפגיעה', document["אחוז הנכות הנובע מהפגיעה"] || 'לא צוין'],
      ['הערות', document["הערות"] || 'אין'],
      ['מתאריך', document["מתאריך"] || 'לא צוין'],
      ['עד תאריך', document["עד תאריך"] || 'לא צוין'],
      ['מידת הנכות', document["מידת הנכות"] || 'לא צוינה'],
      ['אחוז הנכות משוקלל', document["אחוז הנכות משוקלל"] || 'לא צוין'],
      ['שקלול לפטור ממס', document["שקלול לפטור ממס"] || 'לא צוין']
    ];
    
    const docSheet = XLSX.utils.aoa_to_sheet(docData);
    XLSX.utils.book_append_sheet(workbook, docSheet, 'פרטי מסמך');
    
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
                    'משתתפי הועדה': document["משתתפי הועדה"],
                    'אבחנה': document["אבחנה"],
                    'סעיף ליקוי': document["סעיף ליקוי"],
                    'אחוז הנכות': document["אחוז הנכות"],
                    'אחוז הנכות הנובע מהפגיעה': document["אחוז הנכות הנובע מהפגיעה"],
                    'הערות': document["הערות"],
                    'מתאריך': document["מתאריך"],
                    'עד תאריך': document["עד תאריך"],
                    'מידת הנכות': document["מידת הנכות"],
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
            
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentDetails;