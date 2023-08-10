import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as eventSources from "aws-cdk-lib/aws-lambda-event-sources";
import { BmoPocStepFunction } from "./step-function";

export class BmoPocStack extends cdk.Stack {
  public readonly queue: sqs.Queue;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const queue = new sqs.Queue(this, "ApplicationReviewQueue", {
      queueName: "ApplicationReviewQueue",
      visibilityTimeout: cdk.Duration.seconds(300)
    });
    
    // Create a Lambda function to respond to each message in above sqs queue
    const updateTaskStatus = new lambda.Function(this, 'UpdateTaskReviewStatus', {
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda'),
    });

    // Grant necessary permissions to the Lambda function to access the SQS queue
    queue.grantConsumeMessages(updateTaskStatus);

    // Add an event source to the Lambda function to listen to the SQS queue
    updateTaskStatus.addEventSource(new eventSources.SqsEventSource(queue));

    //send the queue object as a prop to the step function
    const stepFunction = new BmoPocStepFunction(this, "ApplicationReviewProcessPOC", {
      queue,
      lambdaFunction: updateTaskStatus
    });
    
  }
}
