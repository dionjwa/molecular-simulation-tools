import { List as IList } from 'immutable';
import { browserHistory } from 'react-router';
import isEmail from 'validator/lib/isEmail';
import { widgetsConstants } from 'molecular-design-applications-shared';
import PipeDataRecord from './records/pipe_data_record';
import actionConstants from './constants/action_constants';
import apiUtils from './utils/api_utils';
import appUtils from './utils/app_utils';
import pipeUtils from './utils/pipe_utils';
import rcsbApiUtils from './utils/rcsb_api_utils';
import widgetUtils from './utils/widget_utils';

const FILE_INPUT_EXTENSIONS = ['pdb', 'xyz', 'sdf', 'mol2'];

export function initializeApp(appId, runId) {
  return async function initializeAppDispatch(dispatch) {
    dispatch({
      type: actionConstants.INITIALIZE_APP,
      appId,
    });

    let app;
    try {
      app = await apiUtils.getApp(appId);

      if (runId) {
        app = app.set('run', app.run.set('id', runId));
      }

      if (app.comingSoon) {
        throw new Error('This app is not yet available, please try another.');
      }
    } catch (error) {
      console.error(error);
      return dispatch({
        type: actionConstants.FETCHED_APP,
        error,
      });
    }

    return dispatch({
      type: actionConstants.FETCHED_APP,
      app,
    });
  };
}

export function clickWidget(widgetIndex) {
  return {
    type: actionConstants.CLICK_WIDGET,
    widgetIndex,
  };
}

/**
 * When the user clicks on the run button
 * @param {String} appId
 * @param {String} email
 * @param {IList of PipeDataRecords} inputPipeDatas
 * @param {String} [inputString]
 */
export function clickRun(runId, widgets, widget, inputPipeDatas) {
  return async function clickRunAsync(dispatch) {
    dispatch({
      type: actionConstants.CLICK_RUN,
    });

    let updatedRunStatePipeData = new IList();

    try {
      const inputData = widgetUtils.getWidgetInputs(widget.id, widgets, inputPipeDatas);
      const cccResult = await apiUtils.runCCC(runId, widget.id, widget.config.toJS(), inputData.toJS());
      // Record that the widget is running by setting the jobId
      updatedRunStatePipeData = updatedRunStatePipeData.push(new PipeDataRecord({
        pipeName: 'jobId',
        type: 'inline',
        value: cccResult.data.jobId,
        widgetId: widget.id,
      }));

      await apiUtils.updateSessionWidget(runId, widget.id, updatedRunStatePipeData); // eslint no-unused-expressions: 'off', max-len: 'off'
    } catch (err) {
      console.error(err);
      dispatch({
        type: actionConstants.RUN_SUBMITTED,
        err,
      });
    }

    dispatch({
      type: actionConstants.RUN_SUBMITTED,
    });
  };
}

export function updateWidgetPipeData(runId, widgetId, widgetPipeData) {
  // TODO: something like this, update the server, then this client
  apiUtils.updateSessionWidget(runId, widgetId, widgetPipeData);
  return {
    type: actionConstants.WIDGET_PIPE_DATA_UPDATE,
    runId,
    widgetId,
    widgetPipeData,
  };
}

export function submitInputString(inputString, widget, runId, pipeDatasByWidget) {
  return async function submitInputStringDispatch(dispatch) {
    dispatch({
      type: actionConstants.SUBMIT_INPUT_STRING,
      inputString,
    });

    // If the input is 4 characters, try it as a pdbid first
    let pdbDownload;
    if (inputString.length === 4) {
      try {
        pdbDownload = await rcsbApiUtils.getPdbById(inputString);
      } catch (error) {
        console.log(`Failed to fetch ${inputString} as pdbid, will try directly.`);
      }
    }

    try {
      const newInput = pdbDownload ? pdbDownload.pdb : inputString;
      const extension = pdbDownload ? '.pdb' : '';
      let inputPipeDatas = await appUtils.processInput(
        widget, newInput, extension,
      );

      // If only one ligand, select it
      const ligands = pipeUtils.getLigandNames(inputPipeDatas);
      if (ligands.size === 1) {
        inputPipeDatas = pipeUtils.selectLigand(inputPipeDatas, ligands.get(0));
      }

      let updatedPipeDatasByWidget = pipeDatasByWidget;
      inputPipeDatas.forEach((inputPipeData) => {
        updatedPipeDatasByWidget = pipeUtils.set(
          updatedPipeDatasByWidget,
          inputPipeData,
        );
      });

      // await apiUtils.updateSession(runId, updatedPipeDatasByWidget); // eslint no-unused-expressions: 'off', max-len: 'off'
      await apiUtils.updateSessionWidget(runId, widget.id, inputPipeDatas); // eslint no-unused-expressions: 'off', max-len: 'off'

      dispatch({
        type: actionConstants.PROCESSED_INPUT_STRING,
        updatedPipeDatasByWidget,
      });
    } catch (err) {
      console.error(err);
      dispatch({
        type: actionConstants.PROCESSED_INPUT_STRING,
        error: err.message || err,
        inputPipeDatas: err ? err.inputPipeDatas : null,
      });
    }
  };
}

export function selectInputFile(file, widget, runId, pipeDatasByWidget) {
  return async function selectInputFileDispatch(dispatch) {
    dispatch({
      type: actionConstants.INPUT_FILE,
      file,
    });

    const extension = file.name.split('.').pop();
    if (!FILE_INPUT_EXTENSIONS.includes(extension.toLowerCase())) {
      dispatch({
        type: actionConstants.INPUT_FILE_COMPLETE,
        error: 'File has invalid extension.',
      });
      return;
    }

    try {
      const inputString = await appUtils.readFile(file);
      let inputPipeDatas = await appUtils.processInput(
        widget, inputString, extension,
      );

      // If only one ligand, select it
      const ligands = pipeUtils.getLigandNames(inputPipeDatas);
      if (ligands.size === 1) {
        inputPipeDatas = pipeUtils.selectLigand(inputPipeDatas, ligands.get(0));
      }

      let updatedPipeDatasByWidget = pipeDatasByWidget;
      inputPipeDatas.forEach((inputPipeData) => {
        updatedPipeDatasByWidget = pipeUtils.set(
          updatedPipeDatasByWidget,
          inputPipeData,
        );
      });

      await apiUtils.updateSession(runId, updatedPipeDatasByWidget); /* eslint no-unused-expressions: 'off', max-len: 'off' */

      dispatch({
        type: actionConstants.INPUT_FILE_COMPLETE,
        inputPipeDatas,
      });
    } catch (err) {
      console.error(err);
      dispatch({
        type: actionConstants.INPUT_FILE_COMPLETE,
        error: err ? (err.message || err) : null,
        inputs: err ? err.inputs : null,
      });
    }
  };
}

export function submitEmail(email, appId, runId, pipeDatasByWidget) {
  return async function submitEmailDispatch(dispatch) {
    if (!isEmail(email)) {
      dispatch({
        type: actionConstants.SUBMIT_EMAIL,
        error: 'Invalid email',
      });
      return;
    }

    const updatedPipeDatasByWidget = pipeUtils.set(
      pipeDatasByWidget,
      new PipeDataRecord({
        pipeName: 'email',
        type: 'inline',
        value: email,
        widgetId: widgetsConstants.ENTER_EMAIL,
      }),
    );

    let newRunId;
    try {
      if (runId) {
        newRunId = runId;
      } else {
        newRunId = await apiUtils.startSession(email, appId);
        dispatch({
          type: actionConstants.START_SESSION,
          runId: newRunId,
        });
      }

      await apiUtils.updateSession(newRunId, updatedPipeDatasByWidget); /* eslint no-unused-expressions: 'off', max-len: 'off' */
    } catch (error) {
      console.error(error);
      dispatch({
        type: actionConstants.SUBMIT_EMAIL,
        error: 'Unable to save your session, please try again',
      });
      return;
    }

    dispatch({
      type: actionConstants.SUBMIT_EMAIL,
      updatedPipeDatasByWidget,
    });

    if (!runId) {
      browserHistory.push(`/app/${appId}/${newRunId}`);
    }
  };
}

export function clickAbout() {
  return {
    type: actionConstants.CLICK_ABOUT,
  };
}

export function clickCancel(runId) {
  return (dispatch) => {
    dispatch({
      type: actionConstants.CLICK_CANCEL,
    });

    apiUtils.cancelRun(runId).then(() => {
      dispatch({
        type: actionConstants.SUBMITTED_CANCEL,
      });
    }).catch((err) => {
      dispatch({
        type: actionConstants.SUBMITTED_CANCEL,
        err,
      });
    });
  };
}

export function messageTimeout() {
  return {
    type: actionConstants.MESSAGE_TIMEOUT,
  };
}

export function clickColorize() {
  return {
    type: actionConstants.CLICK_COLORIZE,
  };
}

export function changeLigandSelection(runId, pipeDatasByWidget, ligand) {
  const pipeDatas = pipeUtils.flatten(pipeDatasByWidget);
  const updatedPipeDatas = pipeUtils.selectLigand(pipeDatas, ligand);
  const updatedPipeDatasByWidget = pipeUtils.unflatten(updatedPipeDatas);
  apiUtils.updateSession(runId, updatedPipeDatasByWidget);
  return {
    type: actionConstants.CHANGE_LIGAND_SELECTION,
    pipeDatasByWidget: updatedPipeDatasByWidget,
  };
}

export function changeMorph(morph) {
  return {
    type: actionConstants.CHANGE_MORPH,
    morph,
  };
}

export function updatePipeData(runId, pipeDatasByWidget, widgets) {
  return async function updatePipeDataAsync(dispatch) {
    let pipeDatasList = pipeUtils.flatten(pipeDatasByWidget);

    try {
      pipeDatasList = await appUtils.fetchPipeDataPdbs(pipeDatasList);
      pipeDatasList = await appUtils.fetchPipeDataJson(pipeDatasList);
    } catch (error) {
      console.error(error);
      dispatch({
        type: actionConstants.PIPE_DATA_UPDATE,
        error: error ? (error.message || error) : null,
      });
      return;
    }

    // If only one ligand, select it
    const ligands = pipeUtils.getLigandNames(pipeDatasList);
    if (ligands.size === 1) {
      pipeDatasList = pipeUtils.selectLigand(pipeDatasList, ligands.get(0));
    }

    const updatedPipeDatasByWidget = pipeUtils.unflatten(pipeDatasList);

    // Find the widget that should be active by default for this pipeData
    const activeWidgetIndex = widgetUtils.getActiveIndex(
      widgets, updatedPipeDatasByWidget,
    );

    dispatch({
      type: actionConstants.PIPE_DATA_UPDATE,
      runId,
      pipeData: updatedPipeDatasByWidget,
      activeWidgetIndex,
    });
  };
}
