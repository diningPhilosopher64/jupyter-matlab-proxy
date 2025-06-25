// Copyright 2023-2024 The MathWorks, Inc.

import { JupyterFrontEndPlugin } from '@jupyterlab/application';
import { matlabToolbarButtonPlugin } from './matlabToolbarButton';
import { matlabMFilesPlugin } from './matlabFiles';
import { matlabCodeMirror6Plugin } from './matlabCM6Mode';
import { matlabCommPlugin } from './matlabCommunication';

const plugins: JupyterFrontEndPlugin<any>[] = [matlabToolbarButtonPlugin, matlabMFilesPlugin, matlabCodeMirror6Plugin, matlabCommPlugin];
export default plugins;
