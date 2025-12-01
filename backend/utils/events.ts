import AWS from "aws-sdk";
import { EventBusName, EventSources, EventTypeDetails } from "./config";

const eventBridge = new AWS.EventBridge();

export const publishNewPostEvent = async (userId: string, title: string) => {
  await eventBridge
    .putEvents({
      Entries: [
        {
          Source: EventSources.NewPostCreated,
          DetailType: EventTypeDetails.NewPostCreated,
          Detail: JSON.stringify({ userId, title }),
          EventBusName,
        },
      ],
    })
    .promise();
};
