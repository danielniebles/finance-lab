// @vitest-environment node
//
// Unit tests for the Telegram file-download helpers (card-screenshot image
// ingestion, Part 1 — see .scratch/card-screenshot-image-ingestion.md).
// getFile() resolves a file_id to a file_path via the Bot API; downloadFile()
// fetches the bytes from Telegram's separate file-host URL and returns them
// base64-encoded, ready for an Anthropic image content block.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getFile, downloadFile } from "./api";

const TEST_FILE_PATH = "photos/file_1.jpg";

beforeEach(() => {
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getFile", () => {
  it("returns the file_path on a successful getFile response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ ok: true, result: { file_path: TEST_FILE_PATH } }),
      }),
    );

    const result = await getFile("abc123");
    expect(result).toBe(TEST_FILE_PATH);
  });

  it("returns null when Telegram responds with ok: false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ ok: false, description: "Bad Request: file not found" }),
      }),
    );

    const result = await getFile("stale-id");
    expect(result).toBeNull();
  });

  it("returns null when the fetch itself throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    const result = await getFile("abc123");
    expect(result).toBeNull();
  });
});

describe("downloadFile", () => {
  it("downloads bytes and returns them base64-encoded with the inferred media type", async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => bytes,
      }),
    );

    const result = await downloadFile(TEST_FILE_PATH);
    expect(result).not.toBeNull();
    expect(result?.mediaType).toBe("image/jpeg");
    expect(result?.base64).toBe(Buffer.from(bytes).toString("base64"));
  });

  it("infers image/png from a .png file path", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(4),
      }),
    );

    const result = await downloadFile("photos/file_1.png");
    expect(result?.mediaType).toBe("image/png");
  });

  it("returns null on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    const result = await downloadFile("photos/missing.jpg");
    expect(result).toBeNull();
  });

  it("returns null when the fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    const result = await downloadFile(TEST_FILE_PATH);
    expect(result).toBeNull();
  });

  it("requests the file-host URL (not the Bot API host)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(4),
    });
    vi.stubGlobal("fetch", fetchMock);

    await downloadFile(TEST_FILE_PATH);

    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.telegram.org/file/bottest-token/${TEST_FILE_PATH}`,
    );
  });
});
