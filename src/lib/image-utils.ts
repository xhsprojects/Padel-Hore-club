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
// This version handles both data URIs and network URLs, with CORS support for the latter.
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    // Handle data URIs directly, which don't need fetch or CORS.
    if (src.startsWith('data:')) {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (err) => {
          console.error("Data URI loading error:", err);
          reject(new Error('Failed to load image from data URI.'));
        };
        img.src = src;
        return;
    }

    // For network URLs, use fetch to handle potential CORS issues.
    // This creates a local blob URL, which prevents tainting the canvas.
    fetch(src, { mode: 'cors' })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Network response was not ok for image: ${src}`);
        }
        return response.blob();
      })
      .then((blob) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);
        img.onload = () => {
          // It's often better to not revoke the URL immediately,
          // to give the canvas time to fully render the image.
          // The browser will garbage-collect it later.
          resolve(img);
        };
        img.onerror = (err) => {
          URL.revokeObjectURL(url);
          console.error("Image loading error from blob:", err);
          reject(new Error(`Failed to load image from blob. Src: ${src.substring(0, 100)}...`));
        };
        img.src = url;
      })
      .catch((error) => {
        console.error("Fetch error for image:", error);
        reject(error);
      });
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
