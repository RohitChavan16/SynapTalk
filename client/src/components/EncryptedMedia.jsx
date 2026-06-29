import React, { useState, useEffect } from 'react';
import { MediaCryptoService } from '../lib/MediaCryptoService';
import axios from 'axios';
import { Loader2, AlertCircle } from 'lucide-react';

export const EncryptedMedia = ({ payload, className }) => {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    
    const fetchAndDecrypt = async () => {
      try {
        setLoading(true);
        // 1. Download the encrypted blob from R2/S3
        const downloadResponse = await fetch(payload.url);
        if (!downloadResponse.ok) {
          throw new Error(`Download failed with status ${downloadResponse.status}`);
        }
        const arrayBuffer = await downloadResponse.arrayBuffer();
        
        // 2. Decrypt using MediaCryptoService
        try {
          const url = await MediaCryptoService.decryptMedia(
            arrayBuffer,
            payload.aesKey,
            payload.iv,
            payload.sha256,
            payload.mimeType
          );
          if (active) {
            setBlobUrl(url);
            setLoading(false);
          }
        } catch (decryptErr) {
          console.error("Decryption error details:", decryptErr, "ArrayBuffer size:", arrayBuffer.byteLength, "Original size:", payload.size);
          throw decryptErr;
        }
      } catch (err) {
        if (active) {
          console.error("Decryption failed:", err);
          setError(`Failed to decrypt media: ${err.message}`);
          setLoading(false);
        }
      }
    };

    fetchAndDecrypt();

    return () => {
      active = false;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [payload]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-gray-800/50 rounded-lg min-h-[150px] ${className}`}>
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center bg-red-900/20 text-red-400 rounded-lg min-h-[150px] p-4 text-center ${className}`}>
        <AlertCircle className="w-8 h-8 mb-2" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  if (payload.mimeType.startsWith('image/')) {
    return (
      <img 
        src={blobUrl} 
        alt="Decrypted media" 
        className={`max-w-[230px] w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105 ${className || ''}`} 
      />
    );
  }

  if (payload.mimeType.startsWith('video/')) {
    return (
      <video 
        src={blobUrl} 
        controls
        className={`max-w-[280px] w-full h-auto rounded-lg ${className || ''}`} 
      />
    );
  }

  return (
    <a href={blobUrl} download={payload.name || "download"} className="text-blue-400 underline">
      Download {payload.name || "File"}
    </a>
  );
};
