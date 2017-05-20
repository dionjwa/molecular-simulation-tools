import { List as IList, Map as IMap } from 'immutable';
import { widgetsConstants } from 'molecular-design-applications-shared';
import axios from 'axios';
import AppRecord from '../records/app_record';
import PipeRecord from '../records/pipe_record';
import PipeDataRecord from '../records/pipe_data_record';
import RunRecord from '../records/run_record';
import WidgetRecord from '../records/widget_record';
import pipeUtils from './pipe_utils';

const API_URL = process.env.API_URL || '';

const apiUtils = {
  /**
   * Fetch all apps
   * @returns {Promise}
   */
  getApps() {
    return axios.get(`${API_URL}/v1/app`)
      .then(res =>
        res.data.map(appData => new AppRecord(appData)),
      );
  },

  /**
   * Fetch an app from the server (when there is no run)
   * @param {String} appId
   * @returns {Promise resolves with AppRecord}
   */
  getApp(appId) {
    return axios.get(`${API_URL}/v1/app/${appId}`)
      .then((res) => {
        let widgets = new IList(
          res.data.widgets.map((widgetData) => {
            let inputPipes = widgetData.inputs ?
              new IList(widgetData.inputs.map(
                inputPipeJson => new PipeRecord({
                  name: inputPipeJson.id,
                  sourceWidgetId: inputPipeJson.source,
                }),
              )) : new IList();
            const outputPipes = widgetData.outputs ?
              new IList(widgetData.outputs.map(
                outputPipeJson => new PipeRecord({
                  name: outputPipeJson.id,
                  sourceWidgetId: widgetData.id,
                }),
              )) : new IList();

            // Hack in email requirement (TODO remove with auth)
            inputPipes = inputPipes.push(new PipeRecord({
              name: 'email',
              sourceWidgetId: widgetsConstants.ENTER_EMAIL,
            }));

            return new WidgetRecord(
              Object.assign({}, widgetData, { inputPipes, outputPipes }),
            );
          }),
        );

        // Hack in email widget (TODO remove with Auth)
        widgets = widgets.unshift(new WidgetRecord({
          id: widgetsConstants.ENTER_EMAIL,
          title: 'Enter Email',
          outputPipes: new IList([
            new PipeRecord({
              name: 'email',
              sourceWidgetId: widgetsConstants.ENTER_EMAIL,
            }),
          ]),
        }));

        return new AppRecord(Object.assign({}, res.data, {
          widgets,
          run: new RunRecord(),
        }));
      });
  },

  /**
   * Get the indicated run data from the server
   * @param {String} runId
   * @returns {Promise resolves with RunRecord}
   */
  getRun(runId) {
    return axios.get(`${API_URL}/v1/session/${runId}`)
      .then(res =>
        res.data,
      )
      .then((runData) => {
        let pipeDatasByWidget = new IMap();

        Object.entries(runData.widgets).forEach(([widgetId, widgetData]) => {
          let pipeDatas = new IList();
          const widgetPipeDatas = Object.entries(widgetData.in || {})
            .concat(Object.entries(widgetData.out || {}));

          widgetPipeDatas.forEach(([pipeName, pipeDataServer]) => {
            pipeDatas = pipeDatas.push(
              new PipeDataRecord(Object.assign({}, pipeDataServer, {
                pipeName,
                widgetId,
              })),
            );
          });

          pipeDatasByWidget = pipeDatasByWidget.set(widgetId, pipeDatas);
        });

        return new RunRecord(Object.assign({}, runData, {
          id: runId,
          pipeDatasByWidget,
        }));
      });
  },

  /**
   * Start a run
   * @param {String} appId
   * @param {String} email
   * @param {IList} inputs
   * @param {String} selectedLigand
   * @param {String} [inputString]
   * @returns {Promise}
   */
  run(appId, email, inputPipeDatas, inputString) {
    return axios.post(`${API_URL}/v1/run`, {
      appId,
      email,
      inputs: pipeUtils.formatInputPipeDatasForServer(inputPipeDatas),
      inputString,
    })
      .then(res => res.data.runId);
  },

  cancelRun(runId) {
    return axios.post(`${API_URL}/v1/run/cancel`, {
      runId,
    });
  },

  /**
   * Process the input given by the user and return processed input
   * @param appId {String}
   * @param input {String} PDB, IUPAC, InChi, SMILES
   * @param extension {String} Optional
   * @returns {Promise}
   */
  processInput(appId, input, extension) {
    /*
     * For PDB, a sent input looks like:
     *   {
     *     name: 'input.pdb',
     *     type: 'inline',
     *     value: 'imapdbstring',
     *   },
     * For other formats, sent inputs look like:
     *   {
     *     name: 'input.json',
     *     type: 'inline',
     *     value: '{"input":"acetylene"}',
     *   },
     */
    let value;
    let nameExtension;
    if (extension) {
      value = input;
      nameExtension = extension;
    } else {
      value = JSON.stringify({ input });
      nameExtension = 'json';
    }

    const data = {
      inputs: [
        {
          name: `input.${nameExtension}`,
          type: 'inline',
          value,
        },
      ],
    };
    return axios.post(`${API_URL}/v1/structure/executeApp${appId}Step0`, data)
      .then((res) => {
        if (!res.data.success) {
          const error = new Error('Failed to process this input, please try again.');
          error.result = res.data;
          throw error;
        }

        return new IList(res.data.outputs.map(output =>
          new PipeDataRecord(Object.assign({}, output, {
            pipeName: output.name,
            widgetId: widgetsConstants.LOAD,
          })),
        ));
      });
  },

  /**
   * Fetch and parse a json file
   * @param jsonUrl {String}
   * @returns {Promise}
   */
  getPipeDataJson(jsonUrl) {
    return axios.get(jsonUrl)
      .then(res => res.data);
  },

  /**
   * Get the pdb data string from its url
   * @param pdbUrl {String}
   * @returns {String}
   */
  getPdb(pdbUrl) {
    return axios.get(pdbUrl)
      .then(res => res.data);
  },

  /**
   * Start a new app session
   * @param {String} appId
   * @param {String} email
   * @returns {Promise resolves with sessionId}
   */
  startSession(email, appId) {
    return axios.post(`${API_URL}/v1/session/start/${appId}`, { email })
      .then(response => response.data.sessionId);
  },

  /**
   * Set pipeDatas in a session
   * @param {String} runId
   * @param {IList of PipeDataRecords}
   * @returns {Promise}
   */
  updateSession(runId, pipeDatasByWidget) {
    let pipeDatasByWidgetServer = new IMap();
    pipeDatasByWidget.entrySeq().forEach(([widgetId, pipeDatas]) => {
      let pipeDatasByName = new IMap();
      pipeDatas.forEach((pipeData) => {
        pipeDatasByName = pipeDatasByName.set(pipeData.pipeName, pipeData);
      });
      pipeDatasByWidgetServer = pipeDatasByWidgetServer.set(
        widgetId,
        pipeDatasByName,
      );
    });
    return axios.post(
      `${API_URL}/v1/session/outputs/${runId}`,
      pipeDatasByWidgetServer.toJS(),
    );
  },

  /**
   * Executes a ccc turbo job on the server
   * See README.md ##### POST /ccc/runturbo
   * @param  {[type]} cccTurboJobConfig [See README.md]
   * @param  {[type]} inputMap          [See README.md]
   * @return {[type]}                   [See README.md]
   */
  runCCCTurbo(cccTurboJobConfig, inputMap) {
    const blob = cccTurboJobConfig;
    blob.inputs = inputMap;
    axios.post(`${API_URL}/v1/ccc/run/turbo`, blob);
  },

  /**
   * Executes a ccc turbo job on the server
   * See README.md ##### POST /ccc/runturbo
   * @param  {[type]} cccTurboJobConfig [See README.md]
   * @param  {[type]} inputMap          [See README.md]
   * @return {[type]}                   [See README.md]
   */
  runCCC(runId, widgetId, cccJobConfig, inputMap) {
    const blob = cccJobConfig;
    blob.inputs = inputMap;
    axios.post(`${API_URL}/v1/ccc/run/${runId}/:widgetId`, blob);
  },
};

export default apiUtils;
