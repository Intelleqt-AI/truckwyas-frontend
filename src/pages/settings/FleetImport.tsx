import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import useFetch from "@/hooks/useFetch";
import { usePost } from "@/hooks/usePost";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
} from "lucide-react";

interface ImportHistory {
  id: number;
  filename: string;
  uploaded_at: string;
  status: "success" | "error" | "processing";
  records_imported: number;
  error_message?: string;
}

interface ColumnMapping {
  [key: string]: string;
}

interface PreviewRow {
  [key: string]: string;
}

export default function FleetImport() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewRow[] | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [isUploading, setIsUploading] = useState(false);

  // Fetch import history
  const { data: importHistory, isLoading } = useFetch<ImportHistory[]>(
    "/api/integrations/fleet/import-history/"
  );

  // Upload file
  const { mutate: uploadFile } = usePost({
    onSuccess: (data: any) => {
      toast.success("File imported successfully");
      setIsUploading(false);
      setSelectedFile(null);
      setPreviewData(null);
      setColumnMapping({});
      queryClient.invalidateQueries({
        queryKey: ["/api/integrations/fleet/import-history/"],
      });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to import file");
      setIsUploading(false);
    },
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleFileInputClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleFileSelect = (file: File) => {
    // Validate file type
    const validTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (!validTypes.includes(file.type) && !file.name.match(/\.(csv|xlsx|xls)$/i)) {
      toast.error("Please upload a CSV or Excel file");
      return;
    }

    setSelectedFile(file);

    // Parse file for preview (simplified - in real app, use a library like PapaParse)
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").slice(0, 4); // Header + 3 rows
      const headers = lines[0].split(",").map((h) => h.trim());

      const rows = lines.slice(1, 4).map((line) => {
        const values = line.split(",").map((v) => v.trim());
        const row: PreviewRow = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || "";
        });
        return row;
      });

      setPreviewData(rows);

      // Auto-map common columns
      const mapping: ColumnMapping = {};
      headers.forEach((header) => {
        const lower = header.toLowerCase();
        if (lower.includes("trip") || lower.includes("id")) {
          mapping[header] = "trip_id";
        } else if (lower.includes("date")) {
          mapping[header] = "date";
        } else if (lower.includes("vehicle") || lower.includes("truck")) {
          mapping[header] = "vehicle";
        } else if (lower.includes("driver")) {
          mapping[header] = "driver";
        } else if (lower.includes("distance") || lower.includes("km")) {
          mapping[header] = "distance_km";
        } else if (lower.includes("fuel")) {
          mapping[header] = "fuel_litres";
        }
      });
      setColumnMapping(mapping);
    };

    reader.readAsText(file);
  };

  const handleImport = () => {
    if (!selectedFile) {
      toast.error("Please select a file to import");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("column_mapping", JSON.stringify(columnMapping));

    setIsUploading(true);

    // Note: usePost with FormData requires special handling
    // For now, using the pattern - backend will handle multipart/form-data
    uploadFile({
      url: "/api/integrations/fleet/import/",
      data: formData,
      config: {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-ZA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="w-5 h-5 text-[#10B981]" />;
      case "error":
        return <XCircle className="w-5 h-5 text-[#EF4444]" />;
      case "processing":
        return <AlertCircle className="w-5 h-5 text-[#F59E0B] animate-pulse" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return (
          <Badge className="bg-[#10B981] text-white hover:bg-[#10B981]">
            Success
          </Badge>
        );
      case "error":
        return (
          <Badge className="bg-[#EF4444] text-white hover:bg-[#EF4444]">
            Error
          </Badge>
        );
      case "processing":
        return (
          <Badge className="bg-[#F59E0B] text-white hover:bg-[#F59E0B]">
            Processing
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-[#0F172A]">
          Import Trip Data
        </h2>
        <p className="text-sm text-[#64748B] mt-1">
          Upload CSV or Excel files to import trip data into your fleet
        </p>
      </div>

      {/* Upload Card */}
      <Card className="border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <CardHeader>
          <CardTitle className="text-lg">Upload File</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Upload Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleFileInputClick}
            className={`
              border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
              transition-colors
              ${
                isDragging
                  ? "border-[#2563EB] bg-[#EFF6FF]"
                  : "border-[#E2E8F0] hover:border-[#2563EB] hover:bg-[#F8FAFC]"
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileInputChange}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#EFF6FF] flex items-center justify-center">
                {selectedFile ? (
                  <FileSpreadsheet className="w-6 h-6 text-[#2563EB]" />
                ) : (
                  <Upload className="w-6 h-6 text-[#2563EB]" />
                )}
              </div>
              {selectedFile ? (
                <>
                  <p className="text-sm font-medium text-[#0F172A]">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-[#64748B]">
                    {(selectedFile.size / 1024).toFixed(2)} KB
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      setPreviewData(null);
                      setColumnMapping({});
                    }}
                  >
                    Change File
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-[#0F172A]">
                    Drop your file here, or click to browse
                  </p>
                  <p className="text-xs text-[#64748B]">
                    Supports CSV and Excel files (.csv, .xlsx, .xls)
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Preview Data */}
          {previewData && previewData.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-[#0F172A]">
                  Preview (First 3 rows)
                </h3>
                <a
                  href="/assets/fleet-import-template.csv"
                  download
                  className="text-xs text-[#2563EB] hover:underline flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  Download Template
                </a>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#F8FAFC] border-b">
                      <tr>
                        {Object.keys(previewData[0]).map((header) => (
                          <th
                            key={header}
                            className="px-4 py-3 text-left text-xs font-medium text-[#64748B] uppercase"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {previewData.map((row, index) => (
                        <tr key={index} className="hover:bg-[#F8FAFC]">
                          {Object.values(row).map((value, colIndex) => (
                            <td
                              key={colIndex}
                              className="px-4 py-3 text-[#0F172A]"
                            >
                              {value}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Import Button */}
          {selectedFile && (
            <Button
              onClick={handleImport}
              disabled={isUploading}
              className="w-full bg-[#2563EB] hover:bg-[#1D4ED8]"
            >
              {isUploading ? (
                <>
                  <AlertCircle className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import Data
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Import History */}
      <Card className="border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <CardHeader>
          <CardTitle className="text-lg">Import History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-[#64748B]">Loading history...</div>
          ) : importHistory && importHistory.length > 0 ? (
            <div className="space-y-3">
              {importHistory.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-3 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(item.status)}
                    <div>
                      <p className="text-sm font-medium text-[#0F172A]">
                        {item.filename}
                      </p>
                      <p className="text-xs text-[#64748B]">
                        {item.status === "success"
                          ? `${item.records_imported} records imported`
                          : item.status === "error"
                          ? item.error_message || "Import failed"
                          : "Processing..."}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(item.status)}
                    <span className="text-xs text-[#64748B]">
                      {formatDate(item.uploaded_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-[#64748B]">
              No import history yet. Upload your first file to get started.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
