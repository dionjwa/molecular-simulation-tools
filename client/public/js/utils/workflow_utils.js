import isEmail from 'validator/lib/isEmail';
import { statusConstants } from 'molecular-design-applications-shared';

const workflowUtils = {
  /**
   * Given a list of workflowNodes, return the overall status of the workflow
   * @param workflowNodes {Immutable.List}
   * @returns {String}
  */
  getWorkflowStatus(workflowNodes) {
    if (!workflowNodes.size) {
      return statusConstants.IDLE;
    }

    let atLeastOneCanceled = false;
    let atLeastOneError = false;
    let allCompleted = true;
    let allIdle = true;

    for (let i = 0; i < workflowNodes.size; i += 1) {
      const workflowNode = workflowNodes.get(i);

      if (workflowNode.status === statusConstants.ERROR) {
        atLeastOneError = true;
        break;
      } else if (workflowNode.status === statusConstants.CANCELED) {
        atLeastOneCanceled = true;
        break;
      } else if (workflowNode.status === statusConstants.RUNNING) {
        allCompleted = false;
        allIdle = false;
      } else if (workflowNode.status === statusConstants.COMPLETED) {
        allIdle = false;
      } else if (workflowNode.status === statusConstants.IDLE) {
        allCompleted = false;
      }
    }

    if (atLeastOneCanceled) {
      return statusConstants.CANCELED;
    }
    if (atLeastOneError) {
      return statusConstants.ERROR;
    }
    if (allCompleted) {
      return statusConstants.COMPLETED;
    }
    if (allIdle) {
      return statusConstants.IDLE;
    }

    return statusConstants.RUNNING;
  },

  isRunnable(workflow) {
    if (!workflow.inputPdbUrl) {
      return false;
    }
    if (!isEmail(workflow.email)) {
      return false;
    }
    if (workflow.status === statusConstants.RUNNING) {
      return false;
    }

    return true;
  },

  readPdb(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  },
};

export default workflowUtils;
