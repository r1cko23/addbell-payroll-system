export const MAX_REQUEST_DOCUMENT_SIZE = 5 * 1024 * 1024;

/**
 * Vercel Hobby caps serverless request bodies at 4.5 MB. Base64 adds ~33% overhead,
 * so JSON uploads through API routes must stay below this raw size.
 */
export const MAX_REQUEST_DOCUMENT_API_BODY_SIZE = 3 * 1024 * 1024;

export const ALLOWED_REQUEST_DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const ALLOWED_REQUEST_DOCUMENT_EXTENSIONS = [".pdf", ".doc", ".docx"] as const;

export function resolveRequestDocumentMimeType(file: File): string {
  if (file.type) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".doc")) return "application/msword";
  return "application/octet-stream";
}

export function isAllowedRequestDocument(file: File): boolean {
  const mime = resolveRequestDocumentMimeType(file);
  const typeOk = (ALLOWED_REQUEST_DOCUMENT_TYPES as readonly string[]).includes(mime);
  const extOk = ALLOWED_REQUEST_DOCUMENT_EXTENSIONS.some((ext) =>
    file.name.toLowerCase().endsWith(ext)
  );
  return typeOk || extOk;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      if (base64) resolve(base64);
      else reject(new Error("Unable to read file"));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function base64ToBlob(base64: string, type: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNumbers)], { type });
}
