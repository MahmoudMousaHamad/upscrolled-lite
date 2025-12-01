import mongoose, { Schema, Document } from "mongoose";

// Post Schema
export interface IPost extends Document {
  userId: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  media?: {
    fileId: string;
    key: string;
    type: "image" | "video";
  };
}

const postSchema = new Schema<IPost>(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true, maxlength: 200 },
    content: { type: String, required: true, maxlength: 10000 },
  },
  { timestamps: true }
);

export const Post = mongoose.model<IPost>("Post", postSchema);

// Like Schema
export interface ILike extends Document {
  userId: string;
  postId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const likeSchema = new Schema<ILike>(
  {
    userId: { type: String, required: true },
    postId: { type: Schema.Types.ObjectId, ref: "Post", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Unique compound index for idempotency
likeSchema.index({ userId: 1, postId: 1 }, { unique: true });

export const Like = mongoose.model<ILike>("Like", likeSchema);

export interface IUser extends Document {
  cognitoId: string;
  email: string;
  displayName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    cognitoId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    displayName: { type: String, maxlength: 100 },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", userSchema);
