'use client';

import { useEffect } from 'react';
import { Html5Qrcode, type Html5QrcodeResult } from 'html5-qrcode';

interface QrScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (errorMessage: string) => void;
  readerId?: string;
}

export function QrScanner({ onScanSuccess, onScanError, readerId = 'qr-reader-container' }: QrScannerProps) {
  useEffect(() => {
    // Use a variable to track if the scanner instance is still active
    let isComponentMounted = true;
    const scanner = new Html5Qrcode(readerId, false);

    const handleSuccess = (decodedText: string, decodedResult: Html5QrcodeResult) => {
      onScanSuccess(decodedText);
    };

    const handleError = (errorMessage: string) => {
      if (onScanError) {
        onScanError(errorMessage);
      }
    };

    // Check camera permissions before starting
    Html5Qrcode.getCameras().then(cameras => {
      if (cameras && cameras.length && isComponentMounted) {
        scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
                const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                const qrboxSize = Math.floor(minEdge * 0.8);
                return {
                    width: qrboxSize,
                    height: qrboxSize,
                };
            },
            aspectRatio: 1.0
          },
          handleSuccess,
          handleError
        ).catch(err => {
          console.error("Unable to start scanning.", err);
        });
      }
    }).catch(err => {
        console.error("Error getting cameras", err);
    });

    return () => {
      isComponentMounted = false;
      // Ensure scanner is stopped and UI is cleared on unmount.
      if (scanner && scanner.isScanning) {
          scanner.stop()
            .then(() => {
                // Clearing might fail if the element is already gone, so we wrap in try-catch.
                try {
                  scanner.clear();
                } catch(clearError) {
                  console.warn("Failed to clear the scanner, element might be unmounted already.", clearError);
                }
            })
            .catch(err => {
                // If stopping fails, log it but don't crash.
                console.error("Failed to stop the scanner.", err);
            });
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readerId]);

  return <div id={readerId} className="w-full h-full"></div>;
}
