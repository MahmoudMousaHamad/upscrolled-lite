import { checkClaims } from "../../utils/auth";
import { success, badRequest } from "../../utils/response";
import { withErrorHandler } from "../../utils/errorHandler";
import { abortMultipartUpload, verifySecurityToken } from "../../utils/s3";

interface AbortUploadBody {
  fileId: string;
  key: string;
  uploadId: string;
  securityToken: string;
  expiresAt: string;
}

export const handler = withErrorHandler(async (event) => {
  const userId = checkClaims(event);
  const body: AbortUploadBody = JSON.parse(event.body || "{}");

  const { fileId, key, uploadId, securityToken, expiresAt } = body;

  // Validate required fields
  if (!fileId || !key || !uploadId || !securityToken || !expiresAt) {
    return badRequest(
      "Missing required fields: fileId, key, uploadId, securityToken, and expiresAt are required"
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
    return badRequest("Invalid security token");
  }

  // Abort the multipart upload
  await abortMultipartUpload(key, uploadId);

  return success({
    ok: true,
    message: "Upload aborted successfully",
    fileId,
  });
}, "Failed to abort upload");
