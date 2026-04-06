import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReceiptTemplate } from "./ReceiptTemplateSettings";

interface ReceiptData {
  receiptNumber: string;
  studentName: string;
  admissionNumber?: string;
  className?: string;
  feeType: string;
  amount: number;
  discount?: number;
  paidAmount: number;
  paidAt: string;
  template?: ReceiptTemplate;
}

export async function generateFeeReceipt(data: ReceiptData) {
  const t = data.template;
  const doc = new jsPDF();
  let y = 14;

  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;
  const leftMargin = 14;
  const rightMargin = pageWidth - 14;

  const hasLogo = !!(t?.showLogo && (t.logoBase64 || t.logoUrl));
  let logoData: { dataUrl: string; format: string } | null = null;

  if (hasLogo) {
    if (t!.logoBase64) {
      // Backend already encoded the logo as base64 — use it directly (no S3/CORS fetch needed)
      const mime =
        t!.logoBase64.match(/^data:([^;]+);/)?.[1]?.toLowerCase() ?? "";
      const format = mime.includes("png")
        ? "PNG"
        : mime.includes("webp")
          ? "WEBP"
          : "JPEG";
      logoData = { dataUrl: t!.logoBase64, format };
    } else {
      // Fallback: fetch the logo URL (works when frontend & backend are same origin)
      try {
        logoData = await loadImageAsDataUrl(t!.logoUrl);
      } catch (err) {
        console.warn("Fee receipt: failed to load school logo:", err);
      }
    }
  }

  // School header block — logo centered on top, text centered below
  if (logoData) {
    const logoW = 22;
    const logoH = 22;
    const logoX = centerX - logoW / 2;
    doc.addImage(logoData.dataUrl, logoData.format, logoX, y, logoW, logoH);
    y += logoH + 4;
  }

  if (t?.schoolName) {
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(t.schoolName, centerX, y, { align: "center" });
    y += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    if (t.schoolAddress) {
      doc.text(t.schoolAddress, centerX, y, { align: "center" });
      y += 4;
    }
    if (t.schoolPhone) {
      doc.text("Ph: " + t.schoolPhone, centerX, y, { align: "center" });
      y += 4;
    }
    y += 2;
  }

  // Header title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(t?.headerTitle || "Payment Receipt", centerX, y + 4, {
    align: "center",
  });
  y += 12;

  // Separator line
  doc.setDrawColor(180);
  doc.setLineWidth(0.5);
  doc.line(leftMargin, y, rightMargin, y);
  y += 8;

  // Receipt No and Date on same line
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Receipt No: " + data.receiptNumber, leftMargin, y);
  doc.text(
    "Date: " + new Date(data.paidAt).toLocaleDateString(),
    rightMargin,
    y,
    { align: "right" },
  );
  y += 8;

  // Student info
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Student: " + data.studentName, leftMargin, y);
  y += 7;

  const showAdm = t ? t.showAdmissionNumber : true;
  const showClass = t ? t.showClass : true;

  if (showAdm && data.admissionNumber) {
    doc.text("Admission No: " + data.admissionNumber, leftMargin, y);
    y += 7;
  }
  if (showClass && data.className) {
    doc.text("Class: " + data.className, leftMargin, y);
    y += 7;
  }
  y += 4;

  // Table data
  const discount = data.discount ?? 0;
  const netAmount = data.amount - discount;
  const showDiscount = t ? t.showDiscount : true;

  const head = showDiscount
    ? [
        [
          "Fee Type",
          "Amount (Rs.)",
          "Discount (Rs.)",
          "Net (Rs.)",
          "Paid (Rs.)",
        ],
      ]
    : [["Fee Type", "Amount (Rs.)", "Net (Rs.)", "Paid (Rs.)"]];

  const body = showDiscount
    ? [
        [
          data.feeType,
          data.amount.toLocaleString(),
          discount.toLocaleString(),
          netAmount.toLocaleString(),
          data.paidAmount.toLocaleString(),
        ],
      ]
    : [
        [
          data.feeType,
          data.amount.toLocaleString(),
          netAmount.toLocaleString(),
          data.paidAmount.toLocaleString(),
        ],
      ];

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: "grid",
    styles: {
      fontSize: 10,
      cellPadding: 4,
      halign: "center",
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { halign: "left" },
    },
    margin: { left: leftMargin, right: 14 },
  });

  // Footer
  const finalY =
    (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 25;
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.text(
    t?.footerText || "This is a computer-generated receipt.",
    centerX,
    finalY,
    { align: "center" },
  );

  // Direct download using blob link (avoids pop-up blockers)
  const pdfBlob = doc.output("blob");
  const blobUrl = URL.createObjectURL(pdfBlob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = "Receipt_" + data.receiptNumber + ".pdf";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
}

function loadImageAsDataUrl(
  url: string,
): Promise<{ dataUrl: string; format: string }> {
  return new Promise((resolve, reject) => {
    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Failed to fetch image: ${response.status} ${response.statusText}`,
          );
        }
        return response.blob();
      })
      .then((blob) => {
        const mimeType = blob.type.toLowerCase();
        let format: string;
        if (mimeType.includes("png")) {
          format = "PNG";
        } else if (mimeType.includes("webp")) {
          format = "WEBP";
        } else {
          format = "JPEG";
        }

        const reader = new FileReader();
        reader.onload = () => {
          resolve({ dataUrl: reader.result as string, format });
        };
        reader.onerror = () => {
          reject(
            new Error("FileReader failed to convert image blob to data URL"),
          );
        };
        reader.readAsDataURL(blob);
      })
      .catch(reject);
  });
}
