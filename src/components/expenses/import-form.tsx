"use client";

import { useRef, useState, useTransition, useEffect } from "react";
import { importMoneyLoverFile } from "@/lib/actions/import";
import { listDriveFiles, importFromDrive, type DriveFile } from "@/lib/actions/drive";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Upload, Loader2, HardDrive, RefreshCw, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";

type ImportResult = { error?: string; success?: boolean; month?: number; year?: number; count?: number };

export function ImportForm() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"upload" | "drive">("drive");

  // Upload tab state
  const [uploadPending, startUploadTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Drive tab state
  const [driveFiles, setDriveFiles] = useState<DriveFile[] | null>(null);
  const [drivePending, startDriveTransition] = useTransition();

  // Auto-fetch Drive files when the dialog opens on the Drive tab
  useEffect(() => {
    if (open && tab === "drive" && driveFiles === null && !drivePending) {
      fetchDriveFiles();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleResult(result: ImportResult) {
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({
        type: "success",
        text: `Imported ${result.count} transactions for ${result.month}/${result.year}.`,
      });
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setMessage(null);
    startUploadTransition(async () => {
      const result = await importMoneyLoverFile(formData);
      handleResult(result);
    });
  }

  function fetchDriveFiles() {
    startDriveTransition(async () => {
      const files = await listDriveFiles();
      setDriveFiles(files);
    });
  }

  function handleSwitchToDrive() {
    setTab("drive");
    setMessage(null);
    if (driveFiles === null) fetchDriveFiles();
  }

  function handleSwitchToUpload() {
    setTab("upload");
    setMessage(null);
  }

  function handleDriveImport(file: DriveFile) {
    setMessage(null);
    startDriveTransition(async () => {
      const result = await importFromDrive(file.id, file.name);
      handleResult(result);
    });
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setMessage(null);
      setTab("drive");
    }
    setOpen(next);
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload className="size-4" />
        Import
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="overflow-x-hidden sm:max-w-xl lg:max-w-fit">
          <DialogHeader>
            <DialogTitle>Import MoneyLover export</DialogTitle>
          </DialogHeader>

          {/* Tab toggle */}
          <div className="flex gap-1 rounded-lg bg-muted p-1 text-xs font-medium">
            <button
              type="button"
              onClick={handleSwitchToUpload}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 transition-colors",
                tab === "upload"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Upload className="size-3" />
              Upload file
            </button>
            <button
              type="button"
              onClick={handleSwitchToDrive}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 transition-colors",
                tab === "drive"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <HardDrive className="size-3" />
              Google Drive
            </button>
          </div>

          {/* Upload tab */}
          {tab === "upload" && (
            <form id="import-form" onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <p className="text-sm text-muted-foreground">
                  Select an <span className="font-medium text-foreground">.xlsx</span> file
                  exported from MoneyLover. Re-importing the same month replaces existing data.
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  name="file"
                  accept=".xlsx"
                  required
                  className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1 file:text-sm file:font-medium"
                />
              </div>
            </form>
          )}

          {/* Drive tab */}
          {tab === "drive" && (
            <div className="space-y-3 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Click a file to import. Re-importing the same month replaces existing data.
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0 text-muted-foreground"
                  onClick={fetchDriveFiles}
                  disabled={drivePending}
                  title="Refresh"
                >
                  <RefreshCw className={cn("size-3", drivePending && "animate-spin")} />
                </Button>
              </div>

              {drivePending ? (
                <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  <span className="text-sm">Loading files…</span>
                </div>
              ) : driveFiles?.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No MoneyLover files found in Drive folder.
                </p>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden divide-y divide-border/50 max-h-64 overflow-y-auto">
                  {driveFiles?.map((f) => {
                    // Extract the date range from the filename for a cleaner label
                    const dateMatch = f.name.match(/(\d{2}\/\d{2}\/\d{4})-(\d{2}\/\d{2}\/\d{4})/);
                    const label = dateMatch ? `${dateMatch[1]} → ${dateMatch[2]}` : f.name;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => handleDriveImport(f)}
                        disabled={drivePending}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors disabled:opacity-50 group"
                      >
                        <FileSpreadsheet className="size-4 shrink-0 text-success" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{f.name}</p>
                          {dateMatch && (
                            <p className="text-xs text-muted-foreground">{label}</p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                          {new Date(f.modifiedTime).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "2-digit",
                          })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Status message */}
          {message && (
            <p className={cn("text-sm", message.type === "error" ? "text-destructive" : "text-success")}>
              {message.text}
            </p>
          )}

          <DialogFooter showCloseButton>
            {tab === "upload" && (
              <Button type="submit" form="import-form" disabled={uploadPending}>
                {uploadPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                Import
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
