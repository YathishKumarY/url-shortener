import QRCode from "qrcode";

export async function generateQRCode(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    width: 300,
    margin: 2,
    color: { dark: "#ffffff", light: "#0b101b" },
    errorCorrectionLevel: "M",
  });
}
