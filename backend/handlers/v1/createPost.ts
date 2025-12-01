import { connectDb, Post } from "../../utils/mongo";
import { checkClaims } from "../../utils/auth";
import { created, badRequest } from "../../utils/response";
import { withErrorHandler } from "../../utils/errorHandler";
import { publishNewPostEvent } from "../../utils/events";

interface CreatePostBody {
  title: string;
  content: string;
  mediaFileId?: string;
  mediaKey?: string;
  mediaType?: "image" | "video";
}

export const handler = withErrorHandler(async (event) => {
  const userId = checkClaims(event);
  const body: CreatePostBody = JSON.parse(event.body || "{}");

  const { title, content, mediaFileId, mediaKey, mediaType } = body;

  // Validate required fields
  if (!title || !content) {
    return badRequest("Title and content are required");
  }

  // Validate media fields - if one is provided, all must be provided
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

  // Add media if provided
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
