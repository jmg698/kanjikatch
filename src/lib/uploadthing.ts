import { generateUploadButton, generateUploadDropzone, generateReactHelpers } from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";

/** Prefer `ufsUrl` (UploadThing v7+) over deprecated `url` for server-side fetch allowlists. */
export function getUploadThingPublicUrl(file: { url: string; ufsUrl?: string | null }): string {
  const ufs = typeof file.ufsUrl === "string" ? file.ufsUrl.trim() : "";
  return ufs.length > 0 ? ufs : file.url;
}

export const UploadButton = generateUploadButton<OurFileRouter>();
export const UploadDropzone = generateUploadDropzone<OurFileRouter>();
export const { useUploadThing } = generateReactHelpers<OurFileRouter>();
