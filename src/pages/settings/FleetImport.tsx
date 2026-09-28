import { StatusChip } from '@/components/ui/StatusChip';
import { formatDateTime } from '@/lib/formatters';
import { useState, useRef } from "react";
import useFetch from "@/hooks/useFetch";
import { usePost } from "@/hooks/usePost";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader } from "@/components/Loader";
import { useAuth } from "@/lib/AuthContext";
import '@/pages/table-heading-roles.css';
import { SettingsShell } from "./SettingsShell";
import {
  SettingsPageHeader,
  settingsCardStyle,
  settingsCardHeaderStyle,
  settingsCardTitleStyle,
  settingsCardBodyStyle,
  settingsSecondaryButtonStyle,
  settingsBadgeStyle,
} from "./settingsUi";
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
  const { user: authUser } = useAuth();
  // Shared public demo account — this page imports real trip data into the
  // fleet, so file selection (click-to-browse AND drag-and-drop) and the
  // import trigger are all fixed off, not just styled as disabled; viewing
  // import history stays fully live.
  const isDemo = !!authUser?.is_demo;
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
    if (isDemo) return;
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    // Always preventDefault so the browser doesn't navigate away to open the
    // dropped file, even when the drop itself is blocked below.
    e.preventDefault();
    setIsDragging(false);

    if (isDemo) {
      toast.error("Not available in the demo");
      return;
    }

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleFileInputClick = () => {
    if (isDemo) {
      toast.error("Not available in the demo");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Defense in depth — the input is also `disabled` when isDemo, but guard
    // the handler too in case it's ever reached programmatically.
    if (isDemo) return;
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleFileSelect = (file: File) => {
    // Demo account never persists a real import — block file selection at
    // its single entry point (covers both drag-and-drop and click-to-browse).
    if (isDemo) return;
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
    if (isDemo) {
      toast.error("Not available in the demo");
      return;
    }
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
      url: "/api/v1/integrations/fleet/import-trips/",
      data: formData,
      config: {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    });
  };

  const formatDate = (dateString: string) => {
    return formatDateTime(dateString);
  };

  const STATUS_TEXT: Record<string, string> = {
    success: 'var(--status-success-text)',
    error: 'var(--status-danger-text)',
    processing: 'var(--status-warning-text)',
  };

  const getStatusIcon = (status: string) => {
    const style = { width: 20, height: 20, flexShrink: 0, color: STATUS_TEXT[status] };
    switch (status) {
      case "success":
        return <CheckCircle2 aria-hidden="true" style={style} />;
      case "error":
        return <XCircle aria-hidden="true" style={style} />;
      case "processing":
        return <AlertCircle aria-hidden="true" style={style} />;
      default:
        return null;
    }
  };

  const STATUS_LABEL: Record<string, string> = { success: 'Success', error: 'Error', processing: 'Processing' };
  const getStatusBadge = (status: string) => {
    if (!STATUS_LABEL[status]) return null;
    return (
      <StatusChip tone={status === 'success' ? 'success' : status === 'error' ? 'danger' : 'warning'} label={STATUS_LABEL[status]} size="sm" />
    );
  };

  const dropBorder = isDemo ? 'var(--border-subtle)' : isDragging ? 'var(--accent-primary)' : 'var(--border-active)';

  return (
    <SettingsShell activeId="integrations">
    <div style={{ maxWidth: 960 }}>
      <SettingsPageHeader
        title="Import trip data"
        description="Upload CSV or Excel files to import trip data into your fleet"
      />

      {/* Upload */}
      <section style={settingsCardStyle} aria-labelledby="fleet-upload-title">
        <div style={settingsCardHeaderStyle}>
          <h2 id="fleet-upload-title" style={settingsCardTitleStyle}>Upload file</h2>
        </div>
        <div style={{ ...settingsCardBodyStyle, display: 'grid', gap: 24 }}>
          {/* File upload zone — also reachable by keyboard (Enter/Space). */}
          <div
            role="button"
            tabIndex={isDemo ? -1 : 0}
            aria-disabled={isDemo || undefined}
            aria-label={selectedFile ? `Selected file ${selectedFile.name}` : 'Choose a CSV or Excel file to import'}
            className="settings-control"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleFileInputClick}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleFileInputClick(); }
            }}
            title={isDemo ? "Not available in the demo" : undefined}
            style={{
              border: `2px dashed ${dropBorder}`,
              borderRadius: 'var(--radius-nested)',
              padding: 40,
              textAlign: 'center',
              cursor: isDemo ? 'not-allowed' : 'pointer',
              opacity: isDemo ? 0.6 : 1,
              background: isDragging ? 'var(--accent-dim)' : 'transparent',
              transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileInputChange}
              disabled={isDemo}
              style={{ display: 'none' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', marginBottom: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--accent-dim)', color: 'var(--accent-primary)',
              }}>
                {selectedFile ? (
                  <FileSpreadsheet aria-hidden="true" style={{ width: 24, height: 24 }} />
                ) : (
                  <Upload aria-hidden="true" style={{ width: 24, height: 24 }} />
                )}
              </div>
              {selectedFile ? (
                <>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: '20px', fontWeight: 500, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>
                    {selectedFile.name}
                  </p>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                    {(selectedFile.size / 1024).toFixed(2)} KB
                  </p>
                  <button
                    type="button"
                    className="settings-control"
                    style={{ ...settingsSecondaryButtonStyle, marginTop: 4 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      setPreviewData(null);
                      setColumnMapping({});
                    }}
                  >
                    Change file
                  </button>
                </>
              ) : (
                <>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: '20px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    Drop your file here, or click to browse
                  </p>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)' }}>
                    Supports CSV and Excel files (.csv, .xlsx, .xls)
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Preview */}
          {previewData && previewData.length > 0 && (
            <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: 14, lineHeight: '20px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
                  Preview (first 3 rows)
                </h3>
                <a
                  href="/assets/fleet-import-template.csv"
                  download
                  className="settings-control"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, lineHeight: '20px', color: 'var(--status-info-text)', textDecoration: 'none', minHeight: 40 }}
                >
                  <Download aria-hidden="true" style={{ width: 16, height: 16 }} />
                  Download template
                </a>
              </div>
              <div className="settings-scroll-region" role="region" aria-label="Import preview" tabIndex={0} style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-nested)', overflowX: 'auto' }}>
                <table className="table-heading-roles settings-table">
                  <thead>
                    <tr>
                      {Object.keys(previewData[0]).map((header) => (
                        <th key={header} scope="col" style={{ textAlign: 'left' }}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, index) => (
                      <tr key={index} style={{ borderTop: index > 0 ? '1px solid var(--border-row)' : 'none' }}>
                        {Object.values(row).map((value, colIndex) => (
                          <td key={colIndex} style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>
                            {value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedFile && (
            <button
              type="button"
              className="btn-action settings-control"
              onClick={handleImport}
              disabled={isUploading || isDemo}
              title={isDemo ? "Not available in the demo" : undefined}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }}
            >
              {isUploading ? (
                <>
                  <AlertCircle aria-hidden="true" className="animate-spin" style={{ width: 16, height: 16 }} />
                  Importing…
                </>
              ) : (
                <>
                  <Upload aria-hidden="true" style={{ width: 16, height: 16 }} />
                  Import data
                </>
              )}
            </button>
          )}
        </div>
      </section>

      {/* Import history */}
      <section style={settingsCardStyle} aria-labelledby="fleet-history-title">
        <div style={settingsCardHeaderStyle}>
          <h2 id="fleet-history-title" style={settingsCardTitleStyle}>Import history</h2>
        </div>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Loader size={20} /></div>
        ) : importHistory && importHistory.length > 0 ? (
          <ul style={{ listStyle: 'none', margin: 0, padding: '4px 0' }}>
            {importHistory.map((item, i) => (
              <li
                key={item.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
                  padding: '12px 24px',
                  borderBottom: i < importHistory.length - 1 ? '1px solid var(--border-row)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  {getStatusIcon(item.status)}
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: '20px', fontWeight: 500, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>
                      {item.filename}
                    </p>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: '20px', color: item.status === 'error' ? 'var(--status-danger-text)' : 'var(--text-tertiary)' }}>
                      {item.status === "success"
                        ? `${item.records_imported} records imported`
                        : item.status === "error"
                        ? item.error_message || "Import failed"
                        : "Processing…"}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {getStatusBadge(item.status)}
                  <span style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                    {formatDate(item.uploaded_at)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ padding: '32px 24px', textAlign: 'center', fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)' }}>
            No import history yet. Upload your first file to get started.
          </div>
        )}
      </section>
    </div>
    </SettingsShell>
  );
}
