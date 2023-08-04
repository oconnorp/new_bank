import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { BmoPocStepFunction } from "./step-function";

export class BmoPocStack extends cdk.Stack {
  public readonly queue: sqs.Queue;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const queue = new sqs.Queue(this, "ApplicationReviewQueue", {
      queueName: "ApplicationReviewQueue",
    });

    //send the queue object as a prop to the step function
    new BmoPocStepFunction(this, "ApplicationReviewProcessPOC", {
      queue,
    });
  }
}
