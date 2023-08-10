//step-function.ts
import * as cdk from "aws-cdk-lib";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

interface BmoPocStepFunctionProps extends sfn.StateProps {
  queue: sqs.Queue,
  lambdaFunction: lambda.Function
}

export class BmoPocStepFunction extends Construct {
  constructor(scope: Construct, id: string, props: BmoPocStepFunctionProps) {
    super(scope, id);

    const processTaskChoice = (taskName: string) => {
      const passedId = taskName + " Passed";
      const choiceId = taskName + "?";
      const sendMsgId = "Send " + taskName + "MessageToQueue";

      const messageProps = {
        queue: props.queue,
        messageBody: sfn.TaskInput.fromObject({
          taskToken: sfn.JsonPath.taskToken,
          applicationId: sfn.JsonPath.stringAt("$.applicationId"),
          task: taskName,
          passed: false,
        }),
        integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
      };

      const sendMsg = new tasks.SqsSendMessage(this, sendMsgId, messageProps);

      return new sfn.Choice(this, choiceId, {})
        .when(
          sfn.Condition.booleanEquals("$." + taskName, true),
          new sfn.Succeed(this, passedId)
        )
        .when(sfn.Condition.booleanEquals("$." + taskName, false), sendMsg);
    };

    const ofac = processTaskChoice("isPersonalOfac");
    const businessOfac = processTaskChoice("isBusinessOfac");
    const pep = processTaskChoice("isPersonalPep");
    const articlesOfInc = processTaskChoice("isArticleOfIncUploaded");
    const businessFinancials = processTaskChoice("isBusinessFinUploaded");
    const personalFinancials = processTaskChoice("isPersonalFinUploaded");
    const outlierTestResult = processTaskChoice("outlierTestResult");

    const parallel = new sfn.Parallel(this, "Parallel Execution");

    const chain = parallel
      .branch(ofac)
      .branch(businessOfac)
      .branch(pep)
      .branch(articlesOfInc)
      .branch(businessFinancials)
      .branch(personalFinancials)
      .branch(outlierTestResult);

    // Create the Step Function chain
    const chainDefinitionBody = sfn.ChainDefinitionBody.fromChainable(chain);

    // Create the Step Function state machine
    const stateMachine =  new sfn.StateMachine(this, "BmoStepFunctionPoc", {
      definitionBody: chainDefinitionBody,
      timeout: cdk.Duration.minutes(5), // Set the timeout as required
      stateMachineName: "BMOStepFunctionPOC",
    });
    
    stateMachine.grantTaskResponse(props.lambdaFunction);
  }
}
