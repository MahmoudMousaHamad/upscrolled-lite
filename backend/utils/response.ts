import { APIGatewayProxyResult } from "aws-lambda";

export const success = (
  data: Record<string, unknown>,
  statusCode = 200
): APIGatewayProxyResult => ({
  statusCode,
  body: JSON.stringify(data),
});

export const created = (data: Record<string, unknown>): APIGatewayProxyResult =>
  success(data, 201);

export const error = (
  message: string,
  statusCode = 500
): APIGatewayProxyResult => ({
  statusCode,
  body: JSON.stringify({ message }),
});

export const unauthorized = (message = "Unauthorized"): APIGatewayProxyResult =>
  error(message, 401);

export const badRequest = (message = "Bad Request"): APIGatewayProxyResult =>
  error(message, 400);

export const notFound = (message = "Not Found"): APIGatewayProxyResult =>
  error(message, 404);

export const tooManyRequests = (
  retryAfter?: number
): APIGatewayProxyResult => ({
  statusCode: 429,
  headers: retryAfter ? { "Retry-After": String(retryAfter) } : undefined,
  body: JSON.stringify({ message: "Too many requests. Please slow down." }),
});
