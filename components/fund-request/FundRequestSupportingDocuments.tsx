"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { base64ToBlob } from "@/lib/request-supporting-document";
import type { FundRequestDocumentSummary } from "@/types/fund-request";

type DocumentPreview = {
  fileName: string;
  fileType: string;
  url: string;
  canPreview: boolean;
  isImage: boolean;
  revokeOnClose: boolean;
};

function isPdfDocument(fileType: string | null, fileName: string | null): boolean {
  if (fileType === "application/pdf") return true;
  return (fileName || "").toLowerCase().endsWith(".pdf");
}

function isImageDocument(fileType: string | null, fileName: string | null): boolean {
  if (fileType?.startsWith("image/")) return true;
  const lower = (fileName || "").toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".gif"].some((ext) => lower.endsWith(ext));
}

function canPreviewDocument(fileType: string | null, fileName: string | null): boolean {
  return isPdfDocument(fileType, fileName) || isImageDocument(fileType, fileName);
}

export function FundRequestSupportingDocuments({
  documents,
  title,
  emptyLabel,
  requestedBy,
}: {
  documents: FundRequestDocumentSummary[];
  title?: string;
  emptyLabel?: string;
  requestedBy?: string;
}) {
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);
  const [preview, setPreview] = useState<DocumentPreview | null>(null);

  useEffect(() => {
    return () => {
      if (preview?.revokeOnClose && preview.url) {
        URL.revokeObjectURL(preview.url);
      }
    };
  }, [preview?.url, preview?.revokeOnClose]);

  if (documents.length === 0) {
    return emptyLabel ? (
      <p className="text-sm text-muted-foreground">{emptyLabel}</p>
    ) : null;
  }

  function closePreview() {
    setPreview((current) => {
      if (current?.revokeOnClose && current.url) {
        URL.revokeObjectURL(current.url);
      }
      return null;
    });
  }

  function downloadPreview() {
    if (!preview) return;
    const link = document.createElement("a");
    link.href = preview.url;
    link.download = preview.fileName;
    link.click();
  }

  async function viewDocument(docId: string) {
    setLoadingDocId(docId);

    const query = requestedBy
      ? `?requested_by=${encodeURIComponent(requestedBy)}`
      : "";
    const response = await fetch(`/api/fund-requests/documents/${docId}${query}`);
    const result = (await response.json()) as {
      error?: string;
      url?: string;
      file_base64?: string;
      file_name?: string | null;
      file_type?: string | null;
    };

    setLoadingDocId(null);

    if (!response.ok) {
      toast.error(result.error ?? "Unable to fetch document");
      return;
    }

    const fileName = result.file_name || "document";
    const fileType = result.file_type || "application/octet-stream";

    if (result.url) {
      setPreview((current) => {
        if (current?.revokeOnClose && current.url) {
          URL.revokeObjectURL(current.url);
        }
        return {
          fileName,
          fileType,
          url: result.url!,
          canPreview: canPreviewDocument(result.file_type ?? null, result.file_name ?? null),
          isImage: isImageDocument(result.file_type ?? null, result.file_name ?? null),
          revokeOnClose: false,
        };
      });
      return;
    }

    if (!result.file_base64) {
      toast.error("Unable to fetch document");
      return;
    }

    const blob = base64ToBlob(result.file_base64, fileType);
    const url = URL.createObjectURL(blob);

    setPreview((current) => {
      if (current?.revokeOnClose && current.url) {
        URL.revokeObjectURL(current.url);
      }
      return {
        fileName,
        fileType,
        url,
        canPreview: canPreviewDocument(result.file_type ?? null, result.file_name ?? null),
        isImage: isImageDocument(result.file_type ?? null, result.file_name ?? null),
        revokeOnClose: true,
      };
    });
  }

  return (
    <>
      <div>
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          {title ?? `Supporting Document${documents.length > 1 ? "s" : ""}`}
        </h4>
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{doc.file_name}</span>
              {doc.file_size != null ? (
                <span className="text-xs text-muted-foreground">
                  {(doc.file_size / 1024).toFixed(1)} KB
                </span>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void viewDocument(doc.id)}
                disabled={loadingDocId === doc.id}
              >
                {loadingDocId === doc.id ? "Loading..." : "View"}
              </Button>
            </div>
          ))}
        </div>
      </div>

      <Dialog
        open={preview != null}
        onOpenChange={(open) => {
          if (!open) closePreview();
        }}
      >
        <DialogContent
          className={
            preview?.canPreview
              ? "flex max-h-[90vh] w-[min(56rem,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden p-0 sm:rounded-lg"
              : "max-w-md"
          }
        >
          <DialogHeader className={preview?.canPreview ? "border-b px-6 py-4" : undefined}>
            <DialogTitle className="truncate pr-8 text-base">
              {preview?.fileName ?? "Document"}
            </DialogTitle>
          </DialogHeader>

          {preview?.canPreview ? (
            <div className="min-h-0 flex-1 bg-muted/30">
              {preview.isImage ? (
                <img
                  src={preview.url}
                  alt={preview.fileName}
                  className="mx-auto max-h-[min(70vh,48rem)] w-full object-contain p-4"
                />
              ) : (
                <iframe
                  src={preview.url}
                  title={preview.fileName}
                  className="h-[min(70vh,48rem)] w-full border-0"
                />
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Preview is not available for this file type. Use download to open the document.
            </p>
          )}

          <DialogFooter className={preview?.canPreview ? "border-t px-6 py-4" : undefined}>
            <Button type="button" variant="outline" onClick={closePreview}>
              Close
            </Button>
            <Button type="button" onClick={downloadPreview}>
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
