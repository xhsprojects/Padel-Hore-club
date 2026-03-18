'use client';

// Helper function to wrap text on canvas
export function fillTextMultiLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
}

// Helper to load an image from a URL.
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    // Handle data URIs directly
    if (src.startsWith('data:')) {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load data URI'));
        img.src = src;
        return;
    }

    // Try standard loading with crossOrigin first (faster/simpler)
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => resolve(img);
    
    img.onerror = () => {
        // Fallback to fetch + blob if standard loading fails
        console.warn(`Standard load failed for ${src}, trying fetch fallback...`);
        fetch(src, { mode: 'cors' })
          .then(response => {
            if (!response.ok) throw new Error('Network response error');
            return response.blob();
          })
          .then(blob => {
            const blobImg = new Image();
            const url = URL.createObjectURL(blob);
            blobImg.onload = () => resolve(blobImg);
            blobImg.onerror = () => reject(new Error('Blob load failed'));
            blobImg.src = url;
          })
          .catch(err => {
            console.error("All image load attempts failed:", err);
            reject(err);
          });
    };
    
    img.src = src;
  });
}


// Helper to draw a rounded rectangle
export function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
