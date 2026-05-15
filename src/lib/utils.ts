import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function convertDriveUrlToDirectStream(url: string | undefined): string | undefined {
  if (!url) return undefined;
  
  // Match standard drive viewer urls: https://drive.google.com/file/d/IMAGE_ID/view
  const driveRegex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
  const match = url.match(driveRegex);
  
  if (match && match[1]) {
    const imageId = match[1];
    return `https://drive.google.com/uc?export=view&id=${imageId}`;
  }
  
  return url;
}
