export const EventBusName = process.env.EVENT_BUS_NAME || "NewPostBus";

export const EventSources = {
  NewPostCreated: "post.created",
};

export const EventTypeDetails = {
  NewPostCreated: "New Post Created",
};

export const CollectionNames = {
  Posts: "posts",
  Likes: "likes",
};

export const DatabaseName = "upscrolled";
