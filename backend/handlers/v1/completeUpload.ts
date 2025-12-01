import { checkClaims } from "../../utils/auth";
import { success, badRequest } from "../../utils/response";
import { withErrorHandler } from "../../utils/errorHandler";
import { completeMultipartUpload, verifySecurityToken } from "../../utils/s3";

interface CompleteUploadBody {
  fileId: string;
  key: string;
  uploadId: string;
  securityToken: string;
  expiresAt: string;
  parts: { PartNumber: number; ETag: string }[];
}

export const handler = withErrorHandler(async (event) => {
  const userId = checkClaims(event);
  const body: CompleteUploadBody = JSON.parse(event.body || "{}");

  const { fileId, key, uploadId, securityToken, expiresAt, parts } = body;

  // Validate required fields
  if (!fileId || !key || !uploadId || !securityToken || !expiresAt || !parts) {
    return badRequest(
      "Missing required fields: fileId, key, uploadId, securityToken, expiresAt, and parts are required"
    );
  }

  // Verify security token
  const isValidToken = verifySecurityToken(
    fileId,
    userId,
    expiresAt,
    securityToken
  );

  if (!isValidToken) {
    return badRequest("Invalid or expired security token");
  }

  // Check if token has expired
  if (new Date(expiresAt) < new Date()) {
    return badRequest("Upload session has expired");
  }

  // Validate parts
  if (!Array.isArray(parts) || parts.length === 0) {
    return badRequest("Parts array must not be empty");
  }

  for (const part of parts) {
    if (!part.PartNumber || !part.ETag) {
      return badRequest("Each part must have PartNumber and ETag");
    }
  }

  // Sort parts by part number
  const sortedParts = parts.sort((a, b) => a.PartNumber - b.PartNumber);

  // Complete the multipart upload
  await completeMultipartUpload(key, uploadId, sortedParts);

  return success({
    ok: true,
    message: "Upload completed successfully",
    fileId,
    key,
  });
}, "Failed to complete upload");
