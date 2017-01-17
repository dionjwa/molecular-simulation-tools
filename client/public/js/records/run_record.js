import { Record } from 'immutable';
import { statusConstants } from 'molecular-design-applications-shared';

const RunRecord = new Record({
  canceling: false,
  email: '',
  fetchingPdb: false,
  fetchingPdbError: null,
  id: null,
  inputPdbUrl: '',
  inputPdb: '',
  outputData: null,
  outputPdbUrl: '',
  outputPdb: '',
  status: statusConstants.IDLE,
  uploadError: null,
  uploadPending: false,
});

export default RunRecord;