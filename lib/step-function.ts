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

    const processTaskChoice = (taskName: string) => {
      const passedId = taskName + " Passed";
      const choiceId = taskName + " Check";
      const sendMsgId = "Send " + taskName + "MessageToQueue";

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

      const sendMsg = new tasks.SqsSendMessage(this, sendMsgId, messageProps);

      return new sfn.Choice(this, choiceId)
        .when(
          sfn.Condition.booleanEquals("$.passed", true),
          new sfn.Succeed(this, passedId)
        )
        .when(sfn.Condition.booleanEquals("$.passed", false), sendMsg);
    };

    const transform = (taskName: string) => {
      return new sfn.Pass(this, "Transform" + taskName, {
        parameters: {
          applicationId: sfn.JsonPath.stringAt("$.applicationId"),
          taskName: taskName,
          passed: sfn.JsonPath.objectAt("$." + taskName),
        },
      });
    };

    const ofac = processTaskChoice("ofac");
    const pep = processTaskChoice("pep");
    const articlesOfInc = processTaskChoice("articlesOfInc");
    const businessInfo = processTaskChoice("businessInfo");
    const transformOfac = transform("ofac");
    const tranformPep = transform("pep");
    const tranformArticlesOfInc = transform("articlesOfInc");
    const tranformBusinessInfo = transform("businessInfo");

    const parallel = new sfn.Parallel(this, "Parallel Execution");

    const chain = parallel
      .branch(transformOfac.next(ofac))
      .branch(tranformPep.next(pep))
      .branch(tranformArticlesOfInc.next(articlesOfInc))
      .branch(tranformBusinessInfo.next(businessInfo));

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
