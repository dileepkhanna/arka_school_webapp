import { useState, useRef } from 'react';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import * as XLSX from 'xlsx';

interface LeadExcelImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ImportError {
  row: number;
  field: string;
  message: string;
}

const TEMPLATE_COLUMNS = [
  'Student Name', 'Gender', 'Date of Birth', 'Current Class', 'Class Applying For',
  'Academic Year', 'Father Name', 'Mother Name', 'Primary Contact Person',
  'Primary Contact Number', 'Alternate Contact Number', 'Email', 'Address', 'Area/City',
  'Father Education', 'Mother Education', 'Father Occupation', 'Mother Occupation',
  'Annual Income Range', 'Previous School', 'Board', 'Medium of Instruction',
  'Last Class Passed', 'Academic Performance', 'Remarks',
];

const COLUMN_MAP: Record<string, string> = {
  'Student Name': 'student_name',
  'Gender': 'gender',
  'Date of Birth': 'date_of_birth',
  'Current Class': 'current_class',
  'Class Applying For': 'class_applying_for',
  'Academic Year': 'academic_year',
  'Father Name': 'father_name',
  'Mother Name': 'mother_name',
  'Primary Contact Person': 'primary_contact_person',
  'Primary Contact Number': 'primary_mobile',
  'Alternate Contact Number': 'alternate_mobile',
  'Email': 'email',
  'Address': 'address',
  'Area/City': 'area_city',
  'Father Education': 'father_education',
  'Mother Education': 'mother_education',
  'Father Occupation': 'father_occupation',
  'Mother Occupation': 'mother_occupation',
  'Annual Income Range': 'annual_income_range',
  'Previous School': 'previous_school',
  'Board': 'education_board',
  'Medium of Instruction': 'medium_of_instruction',
  'Last Class Passed': 'last_class_passed',
  'Academic Performance': 'academic_performance',
  'Remarks': 'remarks',
};

export default function LeadExcelImport({ open, onOpenChange, onSuccess }: LeadExcelImportProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [successCount, setSuccessCount] = useState(0);
  const [showResults, setShowResults] = useState(false);

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_COLUMNS, [
      'John Doe', 'Male', '2015-03-15', 'Class 5', 'Class 6', '2026-2027',
      'Robert Doe', 'Jane Doe', 'father', '9876543210', '9876543211',
      'john@example.com', '123 Main St', 'New Delhi',
      'Graduate', 'Post Graduate', 'Engineer', 'Teacher',
      '₹5,00,000 - ₹10,00,000', 'ABC School', 'CBSE', 'English',
      'Class 5', 'Good', 'Sample remarks',
    ]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lead Template');
    // Set column widths
    ws['!cols'] = TEMPLATE_COLUMNS.map(() => ({ wch: 20 }));
    XLSX.writeFile(wb, 'lead_import_template.xlsx');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setImporting(true);
    setErrors([]);
    setSuccessCount(0);
    setShowResults(false);

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws);

      if (rows.length === 0) {
        toast({ title: 'Empty file', description: 'No data rows found', variant: 'destructive' });
        return;
      }

      const validLeads: any[] = [];
      const importErrors: ImportError[] = [];

      rows.forEach((row, index) => {
        const rowNum = index + 2; // +2 for header row and 0-index
        const mapped: any = { created_by: user.id, status: 'new_lead' };

        // Map columns
        Object.entries(COLUMN_MAP).forEach(([excelCol, dbCol]) => {
          const value = row[excelCol];
          if (value !== undefined && value !== null && value !== '') {
            mapped[dbCol] = String(value).trim();
          }
        });

        // Validate required fields
        if (!mapped.student_name) {
          importErrors.push({ row: rowNum, field: 'Student Name', message: 'Required field' });
        }
        if (!mapped.primary_mobile) {
          importErrors.push({ row: rowNum, field: 'Primary Contact Number', message: 'Required field' });
        } else if (mapped.primary_mobile.length < 10) {
          importErrors.push({ row: rowNum, field: 'Primary Contact Number', message: 'Must be at least 10 digits' });
        }

        if (mapped.student_name && mapped.primary_mobile && mapped.primary_mobile.length >= 10) {
          validLeads.push(mapped);
        }
      });

      // Insert valid leads
      if (validLeads.length > 0) {
        await apiClient.post('/leads/import', { leads: validLeads });
        setSuccessCount(validLeads.length);
      }

      setErrors(importErrors);
      setShowResults(true);

      if (importErrors.length === 0) {
        toast({ title: `Successfully imported ${validLeads.length} leads` });
        onSuccess?.();
      } else {
        toast({
          title: `Imported ${validLeads.length} leads with ${importErrors.length} errors`,
          variant: importErrors.length > 0 ? 'destructive' : 'default',
        });
      }
    } catch (error: any) {
      toast({ title: 'Import failed', description: error.message, variant: 'destructive' });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Leads from Excel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={downloadTemplate} className="flex items-center gap-2 w-full sm:w-auto text-sm">
              <Download className="h-4 w-4" />
              Download Template
            </Button>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-2 w-full sm:w-auto text-sm"
            >
              <Upload className="h-4 w-4" />
              {importing ? 'Importing...' : 'Upload Excel File'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          <div className="text-sm text-muted-foreground space-y-1">
            <p>• Download the template, fill in your data, and upload</p>
            <p>• <strong>Student Name</strong> and <strong>Primary Contact Number</strong> are mandatory</p>
            <p>• Supported formats: .xlsx, .xls, .csv</p>
          </div>

          {showResults && (
            <div className="space-y-3">
              {successCount > 0 && (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-lg">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>{successCount} leads imported successfully</span>
                </div>
              )}

              {errors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-red-700 bg-red-50 p-3 rounded-lg">
                    <AlertCircle className="h-5 w-5" />
                    <span>{errors.length} rows had errors and were skipped</span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Field</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {errors.slice(0, 20).map((err, i) => (
                        <TableRow key={i}>
                          <TableCell>{err.row}</TableCell>
                          <TableCell>{err.field}</TableCell>
                          <TableCell>{err.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {errors.length > 20 && (
                    <p className="text-sm text-muted-foreground">...and {errors.length - 20} more errors</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
