/**
 * Download payslip PDF from #payslip-print-content using the same HTML shell as Print.
 */

import { buildPayslipPrintDocumentHtml } from "@/lib/payslip-print-document";

const LETTER_WIDTH_PX = Math.round(8.5 * 96);

function waitForImages(root: ParentNode): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  if (images.length === 0) return Promise.resolve();

  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
          window.setTimeout(resolve, 1500);
        })
    )
  ).then(() => undefined);
}

function fixImageSources(root: ParentNode) {
  root.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src");
    if (src && src.startsWith("/")) {
      img.src = `${window.location.origin}${src}`;
    }
  });
}

function waitForIframeLoad(iframe: HTMLIFrameElement): Promise<Document> {
  return new Promise((resolve, reject) => {
    iframe.onload = () => {
      const doc = iframe.contentDocument;
      if (!doc) {
        reject(new Error("PDF capture document unavailable"));
        return;
      }
      resolve(doc);
    };
    iframe.onerror = () => reject(new Error("Failed to prepare payslip for PDF"));
  });
}

async function renderPayslipInPrintDocument(
  source: HTMLElement
): Promise<{ doc: Document; target: HTMLElement; cleanup: () => void }> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = `${LETTER_WIDTH_PX}px`;
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";
  document.body.appendChild(iframe);

  const loadPromise = waitForIframeLoad(iframe);
  iframe.srcdoc = buildPayslipPrintDocumentHtml(source.outerHTML, "Payslip PDF");
  const doc = await loadPromise;

  fixImageSources(doc);
  await waitForImages(doc);
  await new Promise((resolve) => window.setTimeout(resolve, 200));

  const target = doc.getElementById("payslip-print-content");
  if (!target) {
    iframe.remove();
    throw new Error("Payslip content not found");
  }

  return {
    doc,
    target,
    cleanup: () => iframe.remove(),
  };
}

export async function downloadPayslipPdfFromDom(
  source: HTMLElement,
  filename: string
): Promise<void> {
  const { target, cleanup } = await renderPayslipInPrintDocument(source);

  try {
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");

    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: LETTER_WIDTH_PX,
      windowWidth: LETTER_WIDTH_PX,
      onclone: (clonedDoc) => {
        fixImageSources(clonedDoc);
      },
    });

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "letter",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL("image/png");

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      pdf.addPage();
      position = heightLeft - imgHeight;
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
  } finally {
    cleanup();
  }
}
