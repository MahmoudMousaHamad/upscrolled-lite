import {
  APIGatewayProxyResult,
  APIGatewayProxyEvent,
  Context,
} from "aws-lambda";
import {
  checkRateLimit,
  RateLimitConfig,
  RateLimitConfigs,
} from "../utils/rateLimit";
import { checkClaims } from "../utils/auth";
import { tooManyRequests } from "../utils/response";

type HandlerFn = (
  event: APIGatewayProxyEvent,
  context: Context
) => Promise<APIGatewayProxyResult>;

interface RateLimitedOptions {
  config?: RateLimitConfig;
  identifyBy?: "user" | "ip" | "both";
}

function getClientIp(event: APIGatewayProxyEvent): string {
  const forwardedFor = event.headers["x-forwarded-for"];
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return event.requestContext.identity?.sourceIp || "unknown";
}

export function withRateLimit(
  handler: HandlerFn,
  options: RateLimitedOptions = {}
): HandlerFn {
  const { config = RateLimitConfigs.standard, identifyBy = "user" } = options;

  return async (event, context) => {
    const clientIp = getClientIp(event);

    // Check IP-based rate limit
    if (identifyBy === "ip" || identifyBy === "both") {
      const ipResult = await checkRateLimit(`ip:${clientIp}`, config);
      if (!ipResult.allowed) {
        const retryAfter = ipResult.resetAt - Math.floor(Date.now() / 1000);
        return tooManyRequests(retryAfter);
      }
    }

    // Check user-based rate limit
    if (identifyBy === "user" || identifyBy === "both") {
      try {
        const userId = checkClaims(event);
        const userResult = await checkRateLimit(`user:${userId}`, config);
        if (!userResult.allowed) {
          const retryAfter = userResult.resetAt - Math.floor(Date.now() / 1000);
          return tooManyRequests(retryAfter);
        }
      } catch {
        // If user extraction fails, fall back to IP-only
        // This shouldn't happen for authenticated endpoints
        const ipResult = await checkRateLimit(`ip:${clientIp}`, config);
        if (!ipResult.allowed) {
          const retryAfter = ipResult.resetAt - Math.floor(Date.now() / 1000);
          return tooManyRequests(retryAfter);
        }
      }
    }

    // Rate limit passed, execute the handler
    return handler(event, context);
  };
}

export { RateLimitConfigs } from "../utils/rateLimit";
