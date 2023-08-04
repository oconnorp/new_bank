//step-function.ts
import * as cdk from "aws-cdk-lib";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";

interface BmoPocStepFunctionProps extends sfn.StateProps {
  queue: sqs.Queue;
}

export class BmoPocStepFunction extends Construct {
  constructor(scope: Construct, id: string, props: BmoPocStepFunctionProps) {
    super(scope, id);

    const messageProps = {
      queue: props.queue,
      messageBody: sfn.TaskInput.fromObject({
        taskToken: sfn.JsonPath.taskToken,
        applicationId: sfn.JsonPath.stringAt("$.applicationId"),
        task: sfn.JsonPath.stringAt("$.taskName"),
        passed: sfn.JsonPath.objectAt("$.passed"),
      }),
      integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
    };

    const processTaskChoice = (taskName: string) => {
      const passedId = taskName + " Passed";
      const choiceId = taskName + " Check";
      const sendMsgId = "Send " + taskName + "MessageToQueue";
      const sendMsg = new tasks.SqsSendMessage(this, sendMsgId, messageProps);

      return new sfn.Choice(this, choiceId)
        .when(
          sfn.Condition.booleanEquals("$.passed", true),
          new sfn.Succeed(this, passedId)
        )
        .when(sfn.Condition.booleanEquals("$.passed", false), sendMsg);
    };

    const ofac = processTaskChoice("OFAC");
    const pep = processTaskChoice("PEP");
    const articlesOfInc = processTaskChoice("ArticlesOfInc");

    /*
    const sendOfacMsg = new tasks.SqsSendMessage(
      this,
      "SendOfacMessageToQueue",
      messageProps
    );
    const sendPepMsg = new tasks.SqsSendMessage(
      this,
      "SendPepMessageToQueue",
      messageProps
    );

    const ofac = new sfn.Choice(this, "OFAC Check")
      .when(
        sfn.Condition.booleanEquals("$.passed", true),
        new sfn.Succeed(this, "OFAC Passed")
      )
      .when(sfn.Condition.booleanEquals("$.passed", false), sendOfacMsg);

    const pep = new sfn.Choice(this, "PEP Check")
      .when(
        sfn.Condition.booleanEquals("$.passed", true),
        new sfn.Succeed(this, "PEP Passed")
      )
      .when(sfn.Condition.booleanEquals("$.passed", false), sendPepMsg);

      */

    const parallel = new sfn.Parallel(this, "Parallel Execution");

    const chain = parallel.branch(ofac).branch(pep).branch(articlesOfInc);

    // Create the Step Function chain
    const chainDefinitionBody = sfn.ChainDefinitionBody.fromChainable(chain);

    // Create the Step Function state machine
    new sfn.StateMachine(this, "BmoStepFunctionPoc", {
      definitionBody: chainDefinitionBody,
      timeout: cdk.Duration.minutes(5), // Set the timeout as required
      stateMachineName: "BMOStepFunctionPOC",
    });
  }
}
