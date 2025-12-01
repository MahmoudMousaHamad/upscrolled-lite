import { connectDb, Post, Like } from "../../db/mongo";
import { checkClaims } from "../../utils/auth";
import { success, notFound } from "../../utils/response";
import { withErrorHandler } from "../../middlewares/errorHandler";

export const handler = withErrorHandler(async (event) => {
  const userId = checkClaims(event);
  const body = JSON.parse(event.body || "{}");

  await connectDb();

  const post = await Post.findById(body.postId);
  if (!post) {
    return notFound("Post not found");
  }

  await Like.updateOne(
    { userId, postId: post._id },
    { $setOnInsert: { userId, postId: post._id } },
    { upsert: true }
  );

  return success({ ok: true, message: "Post liked successfully" });
}, "Failed to like post");
