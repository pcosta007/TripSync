// lib/images.ts
// Utility functions for downscaling and uploading images to Firebase Storage

import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

/**
 * Downscale an image file to maxSize px (longest side) while preserving aspect ratio
 */
export async function downscaleImage(file: File, maxSize = 1600): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Image downscale failed"));
      }, "image/jpeg", 0.85); // ~85% quality
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Uploads a file/blob to Firebase Storage and returns { url, width, height }
 */
export async function uploadImage(file: File | Blob, path: string): Promise<{ url: string; width: number; height: number }> {
  const blobFile = file instanceof File ? file : new File([file], "upload.jpg", { type: "image/jpeg" });

  const img = await blobToImage(blobFile);
  const width = img.width;
  const height = img.height;

  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, blobFile);
  const url = await getDownloadURL(fileRef);

  return { url, width, height };
}

/**
 * Helper: turn Blob/File into HTMLImageElement
 */
function blobToImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}