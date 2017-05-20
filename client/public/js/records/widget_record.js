import { List as IList, Record } from 'immutable';

const WidgetRecord = new Record({
  id: '',
  title: '',
  config: {},
  inputPipes: new IList(),
  outputPipes: new IList(),
});

export default WidgetRecord;
