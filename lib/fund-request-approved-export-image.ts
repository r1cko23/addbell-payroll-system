import { FUND_REQUEST_EXPORT_CAPTURE_WIDTH_PX } from "@/components/fund-request/FundRequestApprovedExportPayeeSheet";

function mountCaptureClone(element: HTMLElement): {
  clone: HTMLElement;
  cleanup: () => void;
} {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.width = `${FUND_REQUEST_EXPORT_CAPTURE_WIDTH_PX}px`;
  clone.style.maxWidth = `${FUND_REQUEST_EXPORT_CAPTURE_WIDTH_PX}px`;

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = `${FUND_REQUEST_EXPORT_CAPTURE_WIDTH_PX}px`;
  host.style.background = "#ffffff";
  host.appendChild(clone);
  document.body.appendChild(host);

  return {
    clone,
    cleanup: () => {
      host.remove();
    },
  };
}

export async function captureFundRequestExportImage(
  element: HTMLElement
): Promise<HTMLCanvasElement> {
  const html2canvas = (await import("html2canvas")).default;
  const { clone, cleanup } = mountCaptureClone(element);

  try {
    return await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: FUND_REQUEST_EXPORT_CAPTURE_WIDTH_PX,
      windowWidth: FUND_REQUEST_EXPORT_CAPTURE_WIDTH_PX,
    });
  } finally {
    cleanup();
  }
}

export async function captureFundRequestExportPngBlob(
  element: HTMLElement
): Promise<Blob> {
  const canvas = await captureFundRequestExportImage(element);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((value) => resolve(value), "image/png")
  );
  if (!blob) {
    throw new Error("Unable to create image");
  }
  return blob;
}

export async function downloadFundRequestExportPng(
  element: HTMLElement,
  filename: string
): Promise<void> {
  const blob = await captureFundRequestExportPngBlob(element);
  const link = document.createElement("a");
  link.download = filename;
  link.href = URL.createObjectURL(blob);
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

export async function downloadFundRequestExportZip(
  files: Array<{ filename: string; blob: Blob }>,
  zipFilename: string
): Promise<void> {
  if (files.length === 0) {
    throw new Error("No files to download");
  }

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.filename, file.blob);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const link = document.createElement("a");
  link.download = zipFilename;
  link.href = URL.createObjectURL(zipBlob);
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

export async function downloadFundRequestExportImages(
  items: Array<{ element: HTMLElement; filename: string }>,
  zipFilename: string
): Promise<void> {
  if (items.length === 0) {
    throw new Error("No files to download");
  }

  if (items.length === 1) {
    await downloadFundRequestExportPng(items[0]!.element, items[0]!.filename);
    return;
  }

  const files: Array<{ filename: string; blob: Blob }> = [];
  for (const item of items) {
    files.push({
      filename: item.filename,
      blob: await captureFundRequestExportPngBlob(item.element),
    });
  }

  await downloadFundRequestExportZip(files, zipFilename);
}

export async function copyFundRequestExportImageToClipboard(
  element: HTMLElement
): Promise<void> {
  const canvas = await captureFundRequestExportImage(element);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((value) => resolve(value), "image/png")
  );
  if (!blob) {
    throw new Error("Unable to create image");
  }

  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Copy to clipboard is not supported in this browser");
  }

  await navigator.clipboard.write([
    new ClipboardItem({
      "image/png": blob,
    }),
  ]);
}
