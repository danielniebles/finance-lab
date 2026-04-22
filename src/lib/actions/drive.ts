"use server";

import { drive } from "@googleapis/drive";
import { GoogleAuth } from "google-auth-library";
import { importBuffer } from "./import";

function getCredentials() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
  }
  return credentials;
}

function getAuth() {
  return new GoogleAuth({
    credentials: getCredentials(),
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
}

export type DriveFile = { id: string; name: string; modifiedTime: string };

export async function listDriveFiles(): Promise<DriveFile[]> {
  const driveClient = drive({ version: "v3", auth: getAuth() });
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
  const res = await driveClient.files.list({
    q: `'${folderId}' in parents and name contains 'MoneyLover' and trashed = false`,
    fields: "files(id, name, modifiedTime)",
    orderBy: "modifiedTime desc",
  });
  return (res.data.files ?? []) as DriveFile[];
}

export async function importFromDrive(fileId: string, fileName: string) {
  const auth = getAuth();
  const token = await auth.getAccessToken();
  const headers = { Authorization: `Bearer ${token}` };

  // Check the file's MIME type — Drive auto-converts uploaded XLSX to Google Sheets
  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType`,
    { headers }
  );
  if (!metaRes.ok) throw new Error(`Drive metadata failed: ${metaRes.status}`);
  const { mimeType } = await metaRes.json() as { mimeType: string };

  // Google Sheets files must use export; uploaded binary XLSX uses alt=media
  const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const isGoogleSheet = mimeType === "application/vnd.google-apps.spreadsheet";
  const url = isGoogleSheet
    ? `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(XLSX_MIME)}`
    : `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive download failed: ${res.status} ${res.statusText} — ${body}`);
  }
  return importBuffer(Buffer.from(await res.arrayBuffer()), fileName);
}
