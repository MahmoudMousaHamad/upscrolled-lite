import {
  APIGatewayProxyResult,
  APIGatewayProxyEvent,
  Context,
} from "aws-lambda";
import { unauthorized, badRequest, error } from "../utils/response";

type HandlerFn = (
  event: APIGatewayProxyEvent,
  context: Context
) => Promise<APIGatewayProxyResult>;

export function withErrorHandler(
  handler: HandlerFn,
  fallbackMessage = "Internal server error"
): HandlerFn {
  return async (event, context) => {
    try {
      return await handler(event, context);
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === "Unauthorized") {
          return unauthorized();
        }
        if (err.name === "ValidationError") {
          return badRequest(err.message);
        }
        if (err.name === "CastError") {
          return badRequest("Invalid ID format");
        }
      }

      console.error("Unhandled error:", err);
      return error(fallbackMessage);
    }
  };
}
