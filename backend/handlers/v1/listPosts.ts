import { connectDb, Post } from "../../db/mongo";
import { checkClaims } from "../../utils/auth";
import { success } from "../../utils/response";
import { withErrorHandler } from "../../middlewares/errorHandler";

export const handler = withErrorHandler(async (event) => {
  checkClaims(event);

  await connectDb();

  const limit = Math.min(
    parseInt(event.queryStringParameters?.limit || "20"),
    100
  );
  const cursor = event.queryStringParameters?.cursor;

  const query = cursor ? { _id: { $lt: cursor } } : {};

  const posts = await Post.find(query)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = posts.length > limit;
  if (hasMore) {
    posts.pop();
  }

  const nextCursor = hasMore ? posts[posts.length - 1]._id.toString() : null;

  return success({
    posts,
    pagination: {
      limit,
      nextCursor,
      hasMore,
    },
  });
}, "Failed to fetch posts");
