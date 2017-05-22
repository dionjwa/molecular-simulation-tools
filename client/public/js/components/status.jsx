import React from 'react';
import { List as IList } from 'immutable';
import { statusConstants, widgetsConstants } from 'molecular-design-applications-shared';
import AppRecord from '../records/app_record';
import SelectionRecord from '../records/selection_record';
import StatusAbout from './status_about';
import StatusEnterEmail from './status_enter_email';
import StatusLigandSelection from './status_ligand_selection';
import StatusLoad from './status_load';
import StatusRun from './status_run';
import StatusResults from './status_results';
import pipeUtils from '../utils/pipe_utils';
import selectionConstants from '../constants/selection_constants';

require('../../css/status.scss');

function Status(props) {
  const runCompleted = props.app.run.status === statusConstants.COMPLETED;

  let selection;
  if (!props.hideContent) {
    if (!props.app.fetching && !props.app.fetchingError &&
      props.selection.type === selectionConstants.WIDGET) {
      const widget = props.app.widgets.get(props.selection.widgetIndex);
      const inputPipeDatas = pipeUtils.getPipeDatas(
        widget.inputPipes, props.app.run.pipeDatasByWidget,
      );
      const outputPipeDatas = pipeUtils.getPipeDatas(
        widget.outputPipes, props.app.run.pipeDatasByWidget,
      );
      const pipeDatas = pipeUtils.flatten(props.app.run.pipeDatasByWidget);

      switch (widget.id) {
        case widgetsConstants.ENTER_EMAIL: {
          selection = (
            <StatusEnterEmail
              email={outputPipeDatas.size ? outputPipeDatas.get(0).value : ''}
              emailError={props.app.run.emailError}
              runCompleted={runCompleted}
              submitEmail={props.submitEmail}
            />
          );
          break;
        }

        case widgetsConstants.LOAD: {
          selection = (
            <StatusLoad
              widget={widget}
              fetchingData={props.app.run.fetchingData}
              inputData={pipeUtils.getPdb(outputPipeDatas)}
              inputFileError={props.app.run.inputFileError}
              inputString={props.app.run.inputString}
              inputStringError={props.app.run.inputStringError}
              onSelectInputFile={props.onSelectInputFile}
              runCompleted={runCompleted}
              submitInputString={props.submitInputString}
            />
          );
          break;
        }

        case widgetsConstants.RUN: {
          selection = (
            <StatusRun
              widget={widget}
              clickRun={props.clickRun}
              emailError={props.app.run.emailError}
              inputPipeDatas={inputPipeDatas}
              runCompleted={runCompleted}
              submitEmail={props.submitEmail}
              widget={widget}
            />
          );
          break;
        }

        case widgetsConstants.SELECTION: {
          const selectedLigand = pipeUtils.getSelectedLigand(pipeDatas);
          selection = (
            <StatusLigandSelection
              widget={widget}
              changeLigandSelection={props.changeLigandSelection}
              ligandNames={pipeUtils.getLigandNames(pipeDatas)}
              runCompleted={runCompleted}
              selectedLigand={selectedLigand}
            />
          );
          break;
        }

        case widgetsConstants.RESULTS: {
          const resultsJsonResult = pipeDatas.find(pipeData =>
            pipeData.pipeName === 'results.json',
          );
          let resultValues;

          if (resultsJsonResult) {
            const resultsJsonFetchedValue = resultsJsonResult.fetchedValue;

            if (resultsJsonFetchedValue.output_values) {
              resultValues = new IList(resultsJsonFetchedValue.output_values);
            }
          }

          const finalStructureResult = pipeDatas.find(pipeData =>
            pipeData.pipeName === 'final_structure.pdb',
          );
          const outputPdbUrl = finalStructureResult.value;
          const numberOfPdbs = pipeUtils.getAnimationPdbs(pipeDatas).size;

          selection = (
            <StatusResults
              widget={widget}
              morph={props.morph}
              numberOfPdbs={numberOfPdbs}
              onClickColorize={props.onClickColorize}
              onChangeMorph={props.onChangeMorph}
              resultValues={resultValues}
              outputPdbUrl={outputPdbUrl}
            />
          );
          break;
        }

        default:
          selection = null;
      }
    } else if (props.selection.type === selectionConstants.ABOUT) {
      selection = (
        <StatusAbout />
      );
    }
  }

  return (
    <div className={`status ${props.selection.type ? '' : 'placeholder-container'}`}>
      {selection}
    </div>
  );
}

Status.defaultProps = {
  hideContent: false,
};

Status.propTypes = {
  changeLigandSelection: React.PropTypes.func.isRequired,
  clickRun: React.PropTypes.func.isRequired,
  fetching: React.PropTypes.bool.isRequired,
  fetchingData: React.PropTypes.bool.isRequired,
  hideContent: React.PropTypes.bool,
  morph: React.PropTypes.number.isRequired,
  onClickColorize: React.PropTypes.func.isRequired,
  onChangeMorph: React.PropTypes.func.isRequired,
  onSelectInputFile: React.PropTypes.func.isRequired,
  selection: React.PropTypes.instanceOf(SelectionRecord).isRequired,
  submitInputString: React.PropTypes.func.isRequired,
  submitEmail: React.PropTypes.func.isRequired,
  app: React.PropTypes.instanceOf(AppRecord).isRequired,
};

export default Status;
