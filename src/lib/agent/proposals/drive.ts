// Drive-import proposal resolver. Split out of run-agent-turn.ts
// (see docs/backlog.md god-file item).

import { listDriveFiles } from "@/lib/actions/drive";
import { blockingProposal, buildResolvedProposal, type ResolvedProposal } from "./shared";

export type DriveFileResolution =
  | { ok: true; fileId: string; fileName: string }
  | { ok: false; error: ResolvedProposal };

export async function resolveDriveFile(
  input: Record<string, unknown>,
): Promise<DriveFileResolution> {
  const fileId = input.fileId as string | undefined;
  const fileName = input.fileName as string | undefined;

  if (!fileId) {
    const files = await listDriveFiles();
    if (files.length === 0) {
      return {
        ok: false,
        error: blockingProposal("Import from Drive", "No files found in the configured Drive folder.", input),
      };
    }
    return { ok: true, fileId: files[0].id, fileName: files[0].name };
  }

  if (!fileName) {
    const files = await listDriveFiles();
    const match = files.find((f) => f.id === fileId);
    if (match) {
      return { ok: true, fileId, fileName: match.name };
    }
    return {
      ok: false,
      error: blockingProposal(
        "Import from Drive",
        "File not found in the Drive folder — the provided file ID may be stale or from a different folder. Please re-list files and try again.",
      ),
    };
  }

  return { ok: true, fileId, fileName };
}

export function detectDrivePeriod(
  fileName: string,
  statusOverride: string | undefined,
  currentMonth: number,
  currentYear: number,
): { detectedLabel: string; resolvedStatus: string } {
  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthMatch = fileName.match(/(\d{4})[_-](\d{2})/);
  let detectedLabel = fileName;
  if (monthMatch) {
    const y = parseInt(monthMatch[1]);
    const m = parseInt(monthMatch[2]);
    detectedLabel = `${MONTH_NAMES[m - 1]} ${y}`;
  }
  const resolvedStatus = statusOverride ?? (
    monthMatch && parseInt(monthMatch[1]) === currentYear && parseInt(monthMatch[2]) === currentMonth
      ? "IN_PROGRESS"
      : "FINAL"
  );
  return { detectedLabel, resolvedStatus };
}

export async function resolveImportFromDrive(
  input: Record<string, unknown>,
  currentMonth: number,
  currentYear: number,
): Promise<ResolvedProposal> {
  const statusOverride = input.status as string | undefined;

  const resolution = await resolveDriveFile(input);
  if (!resolution.ok) return resolution.error;
  const { fileId, fileName } = resolution;

  const { detectedLabel, resolvedStatus } = detectDrivePeriod(fileName, statusOverride, currentMonth, currentYear);

  const params = { fileId, fileName: fileName ?? fileId, status: resolvedStatus };
  const title = `Import from Drive: ${fileName ?? fileId}`;
  const fields = [
    { label: "File", value: fileName ?? fileId ?? "?" },
    { label: "Detected period", value: detectedLabel },
    { label: "Batch status", value: resolvedStatus === "IN_PROGRESS" ? "IN PROGRESS (mid-month)" : "FINAL" },
  ];
  return buildResolvedProposal(params, title, fields);
}
