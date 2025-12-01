import { checkClaims } from "../../utils/auth";
import { success, badRequest } from "../../utils/response";
import { withErrorHandler } from "../../utils/errorHandler";
import {
  validateUploadRequest,
  generateSingleUploadUrl,
  initiateMultipartUpload,
  MULTIPART_THRESHOLD,
} from "../../utils/s3";

interface RequestUploadBody {
  fileName: string;
  contentType: string;
  fileSize: number;
}

export const handler = withErrorHandler(async (event) => {
  const userId = checkClaims(event);
  const body: RequestUploadBody = JSON.parse(event.body || "{}");

  const { fileName, contentType, fileSize } = body;

  if (!fileName || !contentType || !fileSize) {
    return badRequest(
      "Missing required fields: fileName, contentType, and fileSize are required"
    );
  }

  const { valid, mediaType, error } = validateUploadRequest({
    fileName,
    contentType,
    fileSize,
    userId,
  });

  if (!valid) {
    return badRequest(error!);
  }

  const isLargeFile = fileSize > MULTIPART_THRESHOLD;
  const isVideo = mediaType === "video";

  // Use multipart upload for large files or videos
  if (isLargeFile || isVideo) {
    const multipartResponse = await initiateMultipartUpload({
      fileName,
      contentType,
      fileSize,
      userId,
    });

    return success({
      ok: true,
      uploadType: "multipart",
      fileId: multipartResponse.fileId,
      uploadId: multipartResponse.uploadId,
      key: multipartResponse.key,
      expiresAt: multipartResponse.expiresAt,
      contentType: multipartResponse.contentType,
      maxSize: multipartResponse.maxSize,
      securityToken: multipartResponse.securityToken,
      instructions: {
        type: "chunked",
        chunkSize: multipartResponse.chunkSize,
        totalChunks: multipartResponse.totalChunks,
        steps: [
          "Upload each chunk to its corresponding uploadUrl using PUT request",
          "Include the Content-Length header matching the chunk size",
          "Save the ETag from each successful chunk response",
          "Call /api/v1/uploads/complete with all ETags to finalize",
          "If upload fails, call /api/v1/uploads/abort to clean up",
        ],
      },
      chunks: multipartResponse.chunks,
    });
  }

  // Use single upload for small images
  const singleResponse = await generateSingleUploadUrl({
    fileName,
    contentType,
    fileSize,
    userId,
  });

  return success({
    ok: true,
    uploadType: "single",
    fileId: singleResponse.fileId,
    uploadUrl: singleResponse.uploadUrl,
    key: singleResponse.key,
    expiresAt: singleResponse.expiresAt,
    contentType: singleResponse.contentType,
    maxSize: singleResponse.maxSize,
    securityToken: singleResponse.securityToken,
    instructions: {
      type: "direct",
      steps: [
        "Upload the file directly to the uploadUrl using PUT request",
        "Include Content-Type header matching the contentType",
        "Include Content-Length header matching the file size",
        "Use the fileId when creating the post to reference this upload",
      ],
    },
  });
}, "Failed to generate upload URL");
