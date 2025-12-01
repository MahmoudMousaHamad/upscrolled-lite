import { APIGatewayProxyEvent } from "aws-lambda";

export const checkClaims = (event: APIGatewayProxyEvent) => {
  const claims = event.requestContext.authorizer?.jwt.claims;
  if (!claims) {
    throw new Error("Unauthorized");
  }
  return claims.sub;
};
