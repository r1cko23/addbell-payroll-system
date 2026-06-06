/**
 * Download payslip PDF from the same DOM used by Print (#payslip-print-content).
 * Clones full letter-size layout off-screen (no preview zoom) so output matches print.
 */

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

function createFullSizePayslipClone(source: HTMLElement): HTMLDivElement {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = "8.5in";
  host.style.background = "#fff";
  host.style.zIndex = "-1";
  host.style.pointerEvents = "none";
  host.innerHTML = source.outerHTML;

  const clone = host.firstElementChild as HTMLElement | null;
  if (clone) {
    clone.style.width = "8.5in";
    clone.style.padding = "0.5in";
    clone.style.margin = "0";
    clone.style.backgroundColor = "#fff";
    clone.style.color = "#000";
    clone.style.fontFamily = "Arial, sans-serif";
    clone.style.fontSize = "10pt";
    clone.style.lineHeight = "1.2";
    clone.style.boxSizing = "border-box";
  }

  fixImageSources(host);
  document.body.appendChild(host);
  return host;
}

export async function downloadPayslipPdfFromDom(
  source: HTMLElement,
  filename: string
): Promise<void> {
  const host = createFullSizePayslipClone(source);
  const captureTarget =
    (host.firstElementChild as HTMLElement | null) ?? host;

  try {
    await waitForImages(host);

    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");

    const canvas = await html2canvas(captureTarget, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: captureTarget.scrollWidth,
      height: captureTarget.scrollHeight,
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
    const imgData = canvas.toDataURL("image/jpeg", 0.92);

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      pdf.addPage();
      position = heightLeft - imgHeight;
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
  } finally {
    host.remove();
  }
}
