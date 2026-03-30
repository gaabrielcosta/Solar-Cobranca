/**
 * boleto-pix.service.ts
 * Extrai o código PIX copia e cola de um PDF de boleto bancário.
 *
 * Dependências (sem Ghostscript/ImageMagick):
 *   npm install pdfjs-dist canvas jsqr
 */

import * as fs from 'fs';

export class BoletoPixService {

  async extrairPixDoPDF(pdfPath: string): Promise<string | null> {
    try {
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js');
      (pdfjsLib as any).GlobalWorkerOptions.workerSrc = false;

      const data = new Uint8Array(fs.readFileSync(pdfPath));
      const pdf  = await pdfjsLib.getDocument({
        data,
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
      }).promise;

      console.log(`[PIX] PDF carregado — ${pdf.numPages} página(s)`);

      for (let i = 1; i <= Math.min(pdf.numPages, 4); i++) {
        const page = await pdf.getPage(i);
        const vp   = page.getViewport({ scale: 2.0 });

        const { createCanvas } = await import('canvas');
        const canvas  = createCanvas(vp.width, vp.height);
        const context = canvas.getContext('2d') as any;

        await page.render({ canvasContext: context, viewport: vp }).promise;

        const imageData = context.getImageData(0, 0, vp.width, vp.height);
        const pixels    = new Uint8ClampedArray(imageData.data);

        const jsQR = (await import('jsqr')).default;
        const qr   = jsQR(pixels, vp.width, vp.height, { inversionAttempts: 'attemptBoth' });

        if (qr?.data) {
          console.log(`[PIX-DEBUG] QR Code lido: "${qr.data.substring(0, 80)}"`);
          const texto = qr.data.trim();
          if (texto.startsWith('000201')) {
            console.log(`[PIX] QR Code PIX encontrado na página ${i}`);
            return texto;
          }
          console.log(`[PIX] QR Code na p.${i} não é EMV PIX: ${texto.substring(0, 40)}`);
        } else {
          console.log(`[PIX] Sem QR Code na página ${i}`);
        } 
      }

      console.warn('[PIX] Nenhum QR Code PIX encontrado no PDF');
      return null;

    } catch (err: any) {
      console.error('[PIX] Erro:', err.message);
      throw new Error(`Falha ao extrair PIX: ${err.message}`);
    }
  }
}

export const boletoPixService = new BoletoPixService();