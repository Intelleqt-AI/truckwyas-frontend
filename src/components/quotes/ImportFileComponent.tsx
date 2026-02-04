import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Upload, FileText } from "lucide-react";

interface ImportFileComponentProps {
  onSubmit: (data: { file?: File; text?: string }) => void;
  isProcessing?: boolean;
}

export function ImportFileComponent({ onSubmit, isProcessing }: ImportFileComponentProps) {
  const [importText, setImportText] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
    }
  };

  const handleSubmit = () => {
    onSubmit({ file: importFile || undefined, text: importText || undefined });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Import Quote Data
        </CardTitle>
        <p className="text-muted-foreground">
          Upload CSV, Excel, or paste email/text content
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* File Upload */}
        <div className="space-y-2">
          <Label>Upload File</Label>
          <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center transition-colors hover:border-brand-300">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv,.xlsx,.xls"
              className="hidden"
            />
            {importFile ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="w-5 h-5 text-brand-500" />
                <span className="font-medium">{importFile.name}</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setImportFile(null)}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto bg-muted/30 rounded-full flex items-center justify-center">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <p className="text-muted-foreground">
                    Drop files here or{" "}
                    <Button
                      variant="link"
                      className="p-0 h-auto font-semibold text-brand-500"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      browse files
                    </Button>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports CSV, Excel files (max 10MB)
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 border-t border-border"></div>
          <span className="text-xs text-muted-foreground bg-background px-2">OR</span>
          <div className="flex-1 border-t border-border"></div>
        </div>

        {/* Text Import */}
        <div className="space-y-2">
          <Label htmlFor="importText">Paste text content</Label>
          <Textarea
            id="importText"
            placeholder="Paste email content, CSV data, or any text containing quote information..."
            rows={6}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            className="resize-none"
          />
        </div>

        <Button 
          onClick={handleSubmit} 
          className="w-full"
          disabled={(!importFile && !importText.trim()) || isProcessing}
        >
          {isProcessing ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
              Processing...
            </>
          ) : (
            "Import & Parse Quote"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}