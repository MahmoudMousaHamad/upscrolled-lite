import {
  S3Client,
  PutObjectCommand,
  CreateMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  UploadPartCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
});

const BUCKET_NAME = process.env.STORAGE_BUCKET_NAME || "";

// Allowed media types and their extensions
const ALLOWED_MEDIA_TYPES: Record<string, string[]> = {
  image: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  video: ["video/mp4", "video/quicktime", "video/webm", "video/mpeg"],
};

// Max file sizes in bytes
const MAX_FILE_SIZES: Record<string, number> = {
  image: 10 * 1024 * 1024, // 10MB
  video: 500 * 1024 * 1024, // 500MB
};

// Chunk size for multipart uploads (5MB minimum for S3)
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

export interface UploadRequest {
  fileName: string;
  contentType: string;
  fileSize: number;
  userId: string;
}

export interface SingleUploadResponse {
  uploadUrl: string;
  fileId: string;
  key: string;
  expiresAt: string;
  contentType: string;
  maxSize: number;
  securityToken: string;
}

export interface MultipartUploadResponse {
  uploadId: string;
  fileId: string;
  key: string;
  expiresAt: string;
  contentType: string;
  maxSize: number;
  securityToken: string;
  chunkSize: number;
  totalChunks: number;
  chunks: ChunkUploadInfo[];
}

export interface ChunkUploadInfo {
  partNumber: number;
  uploadUrl: string;
  startByte: number;
  endByte: number;
}

function getMediaType(contentType: string): "image" | "video" | null {
  if (ALLOWED_MEDIA_TYPES.image.includes(contentType)) return "image";
  if (ALLOWED_MEDIA_TYPES.video.includes(contentType)) return "video";
  return null;
}

function generateFileId(): string {
  return crypto.randomUUID();
}

function generateSecurityToken(
  fileId: string,
  userId: string,
  expiresAt: Date
): string {
  const payload = `${fileId}:${userId}:${expiresAt.toISOString()}`;
  const secret = process.env.UPLOAD_TOKEN_SECRET || "default-secret";
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function validateUploadRequest(request: UploadRequest): {
  valid: boolean;
  error?: string;
  mediaType?: "image" | "video";
} {
  const { contentType, fileSize } = request;

  const mediaType = getMediaType(contentType);
  if (!mediaType) {
    return {
      valid: false,
      error: `Invalid content type: ${contentType}. Allowed types: ${[
        ...ALLOWED_MEDIA_TYPES.image,
        ...ALLOWED_MEDIA_TYPES.video,
      ].join(", ")}`,
    };
  }

  const maxSize = MAX_FILE_SIZES[mediaType];
  if (fileSize > maxSize) {
    return {
      valid: false,
      error: `File size ${fileSize} exceeds maximum allowed size of ${maxSize} bytes for ${mediaType}`,
    };
  }

  if (fileSize <= 0) {
    return {
      valid: false,
      error: "File size must be greater than 0",
    };
  }

  return { valid: true, mediaType };
}

export async function generateSingleUploadUrl(
  request: UploadRequest
): Promise<SingleUploadResponse> {
  const { fileName, contentType, fileSize, userId } = request;

  const fileId = generateFileId();
  const fileExtension = fileName.split(".").pop() || "";
  const key = `uploads/${userId}/${fileId}.${fileExtension}`;

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    ContentLength: fileSize,
    Metadata: {
      userId,
      fileId,
      originalFileName: fileName,
    },
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

  const mediaType = getMediaType(contentType)!;
  const securityToken = generateSecurityToken(fileId, userId, expiresAt);

  return {
    uploadUrl,
    fileId,
    key,
    expiresAt: expiresAt.toISOString(),
    contentType,
    maxSize: MAX_FILE_SIZES[mediaType],
    securityToken,
  };
}

export async function initiateMultipartUpload(
  request: UploadRequest
): Promise<MultipartUploadResponse> {
  const { fileName, contentType, fileSize, userId } = request;

  const fileId = generateFileId();
  const fileExtension = fileName.split(".").pop() || "";
  const key = `uploads/${userId}/${fileId}.${fileExtension}`;

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour for multipart

  // Initiate multipart upload
  const createCommand = new CreateMultipartUploadCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    Metadata: {
      userId,
      fileId,
      originalFileName: fileName,
    },
  });

  const { UploadId } = await s3Client.send(createCommand);

  if (!UploadId) {
    throw new Error("Failed to initiate multipart upload");
  }

  // Calculate chunks
  const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
  const chunks: ChunkUploadInfo[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const partNumber = i + 1;
    const startByte = i * CHUNK_SIZE;
    const endByte = Math.min(startByte + CHUNK_SIZE, fileSize) - 1;

    const uploadPartCommand = new UploadPartCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      PartNumber: partNumber,
      UploadId,
    });

    const uploadUrl = await getSignedUrl(s3Client, uploadPartCommand, {
      expiresIn: 3600,
    });

    chunks.push({
      partNumber,
      uploadUrl,
      startByte,
      endByte,
    });
  }

  const mediaType = getMediaType(contentType)!;
  const securityToken = generateSecurityToken(fileId, userId, expiresAt);

  return {
    uploadId: UploadId,
    fileId,
    key,
    expiresAt: expiresAt.toISOString(),
    contentType,
    maxSize: MAX_FILE_SIZES[mediaType],
    securityToken,
    chunkSize: CHUNK_SIZE,
    totalChunks,
    chunks,
  };
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: { PartNumber: number; ETag: string }[]
): Promise<void> {
  const command = new CompleteMultipartUploadCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: { Parts: parts },
  });

  await s3Client.send(command);
}

export async function abortMultipartUpload(
  key: string,
  uploadId: string
): Promise<void> {
  const command = new AbortMultipartUploadCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
  });

  await s3Client.send(command);
}

export function verifySecurityToken(
  fileId: string,
  userId: string,
  expiresAt: string,
  token: string
): boolean {
  const expectedToken = generateSecurityToken(
    fileId,
    userId,
    new Date(expiresAt)
  );
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken));
}

// Threshold for multipart upload (10MB)
export const MULTIPART_THRESHOLD = 10 * 1024 * 1024;
