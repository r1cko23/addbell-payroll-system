"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { base64ToBlob } from "@/lib/request-supporting-document";
import { isSchemaMissingTableOrRelationError } from "@/lib/postgrestSchema";
import type { FundRequestDocumentSummary } from "@/types/fund-request";

export function FundRequestSupportingDocuments({
  documents,
}: {
  documents: FundRequestDocumentSummary[];
}) {
  const supabase = createClient();
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  if (documents.length === 0) return null;

  async function downloadDocument(docId: string) {
    setDownloadingDocId(docId);
    const { data, error } = await supabase
      .from("fund_request_documents")
      .select("file_base64, file_name, file_type")
      .eq("id", docId)
      .maybeSingle();

    setDownloadingDocId(null);

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

    const blob = base64ToBlob(
      docData.file_base64,
      docData.file_type || "application/octet-stream"
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = docData.file_name || "document";
    link.target = "_blank";
    link.rel = "noopener";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
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
              onClick={() => downloadDocument(doc.id)}
              disabled={downloadingDocId === doc.id}
            >
              {downloadingDocId === doc.id ? "Loading..." : "View"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
