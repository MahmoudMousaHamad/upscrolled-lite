import type { AWS } from "@serverless/typescript";

const serverlessConfiguration: AWS = {
  service: "upscrolled-lite",
  frameworkVersion: "3",
  plugins: [
    "serverless-esbuild",
    "serverless-offline",
    "serverless-apigateway-route-settings",
  ],

  provider: {
    name: "aws",
    runtime: "nodejs18.x",
    region: "us-east-1",
    architecture: "arm64",
    stage: '${opt:stage, "dev"}',
    environment: {
      STAGE: "${self:provider.stage}",
      MONGODB_URI: "${env:MONGODB_URI}",
      REDIS_URL: "${env:REDIS_URL}",
      POSTS_COLLECTION: "posts",
      USERS_COLLECTION: "users",
      STORAGE_BUCKET_NAME: "upscrolled-lite-storage-${self:provider.stage}",
      UPLOAD_TOKEN_SECRET:
        "${env:UPLOAD_TOKEN_SECRET, 'default-upload-secret'}",
    },

    httpApi: {
      cors: {
        allowedOrigins: ["*"],
        allowedHeaders: ["*"],
        allowedMethods: ["GET", "POST", "OPTIONS"],
      },
      authorizers: {
        cognitoAuth: {
          type: "jwt",
          identitySource: "$request.header.Authorization",
          issuerUrl: {
            "Fn::Sub":
              "https://cognito-idp.${AWS::Region}.amazonaws.com/${CognitoUserPool}",
          },
          audience: [{ Ref: "CognitoUserPoolClient" }],
        },
      },
    },

    iam: {
      role: { "Fn::GetAtt": ["LambdaExecutionRole", "Arn"] },
    },
  },

  functions: {
    createPost: {
      handler: "backend/handlers/v1/createPost.handler",
      events: [
        {
          httpApi: {
            path: "/api/v1/posts",
            method: "post",
            authorizer: "cognitoAuth",
          },
        },
      ],
    },

    listPosts: {
      handler: "backend/handlers/v1/listPosts.handler",
      events: [
        {
          httpApi: {
            path: "/api/v1/posts",
            method: "get",
            authorizer: "cognitoAuth",
          },
        },
      ],
    },

    likePost: {
      handler: "backend/handlers/v1/likePost.handler",
      events: [
        {
          httpApi: {
            path: "/api/v1/likes",
            method: "post",
            authorizer: "cognitoAuth",
          },
        },
      ],
    },

    eventNewPost: {
      handler: "backend/handlers/eventNewPost.handler",
      events: [
        {
          eventBridge: {
            eventBus: { Ref: "NewPostBus" },
            pattern: { source: ["post.created"] },
          },
        },
      ],
    },

    requestUploadUrl: {
      handler: "backend/handlers/v1/requestUploadUrl.handler",
      events: [
        {
          httpApi: {
            path: "/api/v1/uploads/request",
            method: "post",
            authorizer: "cognitoAuth",
          },
        },
      ],
    },

    completeUpload: {
      handler: "backend/handlers/v1/completeUpload.handler",
      events: [
        {
          httpApi: {
            path: "/api/v1/uploads/complete",
            method: "post",
            authorizer: "cognitoAuth",
          },
        },
      ],
    },

    abortUpload: {
      handler: "backend/handlers/v1/abortUpload.handler",
      events: [
        {
          httpApi: {
            path: "/api/v1/uploads/abort",
            method: "post",
            authorizer: "cognitoAuth",
          },
        },
      ],
    },
  },

  package: {
    individually: true,
  },

  custom: {
    esbuild: {
      bundle: true,
      minify: true,
      sourcemap: false,
      target: "node18",
      platform: "node",
      treeShaking: true,
      packager: "npm",
      concurrency: 10,
      external: ["aws-sdk"],
    },
    routeSettings: {
      burstLimit: 200,
      rateLimit: 400,
      detailedMetricsEnabled: true,
    },
  },

  resources: {
    Resources: {
      CognitoUserPool: {
        Type: "AWS::Cognito::UserPool",
        Properties: {
          UserPoolName: "upscrolled-lite-${self:provider.stage}",
          UsernameAttributes: ["email"],
          AutoVerifiedAttributes: ["email"],
        },
      },

      CognitoUserPoolClient: {
        Type: "AWS::Cognito::UserPoolClient",
        Properties: {
          ClientName: "upscrolled-lite-client",
          UserPoolId: { Ref: "CognitoUserPool" },
          GenerateSecret: false,
        },
      },

      StorageBucket: {
        Type: "AWS::S3::Bucket",
        Properties: {
          BucketName: "upscrolled-lite-storage-${self:provider.stage}",
          CorsConfiguration: {
            CorsRules: [
              {
                AllowedHeaders: ["*"],
                AllowedMethods: ["PUT", "POST", "GET", "HEAD"],
                AllowedOrigins: ["*"],
                MaxAge: 3600,
              },
            ],
          },
        },
      },

      NewPostBus: {
        Type: "AWS::Events::EventBus",
        Properties: {
          Name: "NewPostBus-${self:provider.stage}",
        },
      },

      LambdaExecutionRole: {
        Type: "AWS::IAM::Role",
        Properties: {
          RoleName: "upscrolled-lite-lambda-role-${self:provider.stage}",
          AssumeRolePolicyDocument: {
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Principal: { Service: "lambda.amazonaws.com" },
                Action: "sts:AssumeRole",
              },
            ],
          },
          Policies: [
            {
              PolicyName: "lambda-basic",
              PolicyDocument: {
                Version: "2012-10-17",
                Statement: [
                  {
                    Effect: "Allow",
                    Action: [
                      "logs:CreateLogGroup",
                      "logs:CreateLogStream",
                      "logs:PutLogEvents",
                    ],
                    Resource: "*",
                  },
                  {
                    Effect: "Allow",
                    Action: ["events:PutEvents"],
                    Resource: "*",
                  },
                  {
                    Effect: "Allow",
                    Action: [
                      "s3:PutObject",
                      "s3:GetObject",
                      "s3:DeleteObject",
                      "s3:ListMultipartUploadParts",
                      "s3:AbortMultipartUpload",
                    ],
                    Resource: {
                      "Fn::Sub":
                        "arn:aws:s3:::upscrolled-lite-storage-${self:provider.stage}/*",
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    },
  },
};

module.exports = serverlessConfiguration;
