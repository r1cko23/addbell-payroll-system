"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
import { isSchemaMissingTableOrRelationError } from "@/lib/postgrestSchema";
import type { FundRequestDocumentSummary } from "@/types/fund-request";

type DocumentPreview = {
  fileName: string;
  fileType: string;
  url: string;
  canPreview: boolean;
};

function isPdfDocument(fileType: string | null, fileName: string | null): boolean {
  if (fileType === "application/pdf") return true;
  return (fileName || "").toLowerCase().endsWith(".pdf");
}

export function FundRequestSupportingDocuments({
  documents,
}: {
  documents: FundRequestDocumentSummary[];
}) {
  const supabase = createClient();
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);
  const [preview, setPreview] = useState<DocumentPreview | null>(null);

  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview?.url]);

  if (documents.length === 0) return null;

  function closePreview() {
    setPreview((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
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
    const { data, error } = await supabase
      .from("fund_request_documents")
      .select("file_base64, file_name, file_type")
      .eq("id", docId)
      .maybeSingle();

    setLoadingDocId(null);

    if (error) {
      if (isSchemaMissingTableOrRelationError(error)) {
        toast.error("Document storage is not configured");
      } else {
        toast.error("Unable to fetch document");
      }
      return;
    }
    if (!data) {
      toast.error("Unable to fetch document");
      return;
    }

    const docData = data as {
      file_base64: string;
      file_name: string | null;
      file_type: string | null;
    };

    const fileType = docData.file_type || "application/octet-stream";
    const blob = base64ToBlob(docData.file_base64, fileType);
    const url = URL.createObjectURL(blob);

    setPreview((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return {
        fileName: docData.file_name || "document",
        fileType,
        url,
        canPreview: isPdfDocument(docData.file_type, docData.file_name),
      };
    });
  }

  return (
    <>
      <div>
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Supporting Document{documents.length > 1 ? "s" : ""}
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
                onClick={() => viewDocument(doc.id)}
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
              <iframe
                src={preview.url}
                title={preview.fileName}
                className="h-[min(70vh,48rem)] w-full border-0"
              />
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
