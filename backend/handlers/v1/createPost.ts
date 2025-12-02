import { connectDb, Post } from "../../db/mongo";
import { checkClaims } from "../../utils/auth";
import { created, badRequest } from "../../utils/response";
import { withErrorHandler } from "../../middlewares/errorHandler";
import { publishNewPostEvent } from "../../utils/events";
import {
  withRateLimit,
  RateLimitConfigs,
} from "../../middlewares/rateLimitMiddleware";

interface CreatePostBody {
  title: string;
  content: string;
  mediaFileId?: string;
  mediaKey?: string;
  mediaType?: "image" | "video";
}

const createPostHandler = withErrorHandler(async (event) => {
  const userId = checkClaims(event);
  const body: CreatePostBody = JSON.parse(event.body || "{}");

  const { title, content, mediaFileId, mediaKey, mediaType } = body;

  if (!title || !content) {
    return badRequest("Title and content are required");
  }

  if (
    (mediaFileId || mediaKey || mediaType) &&
    (!mediaFileId || !mediaKey || !mediaType)
  ) {
    return badRequest(
      "When including media, mediaFileId, mediaKey, and mediaType are all required"
    );
  }

  await connectDb();

  const postData: {
    userId: string;
    title: string;
    content: string;
    media?: {
      fileId: string;
      key: string;
      type: "image" | "video";
    };
  } = {
    userId,
    title,
    content,
  };

  if (mediaFileId && mediaKey && mediaType) {
    postData.media = {
      fileId: mediaFileId,
      key: mediaKey,
      type: mediaType,
    };
  }

  const post = await Post.create(postData);

  await publishNewPostEvent(userId, title);

  return created({
    ok: true,
    message: "Post created successfully",
    postId: post._id,
    ...(postData.media && { media: postData.media }),
  });
}, "Failed to create post");

// Apply rate limiting: 20 requests per minute for write operations
export const handler = withRateLimit(createPostHandler, {
  config: RateLimitConfigs.write,
  identifyBy: "user",
});
