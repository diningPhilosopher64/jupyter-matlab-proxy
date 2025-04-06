// Copyright 2023-2025 The MathWorks, Inc.

import { JupyterFrontEndPlugin } from '@jupyterlab/application';
import { matlabToolbarButtonPlugin } from './plugins/matlabToolbarButtonPlugin';
import { matlabMFilesPlugin } from './plugins/matlabFilesPlugin';
import { matlabCodeMirror6Plugin } from './plugins/matlabCM6ModePlugin';
import { matlabExportPlugin } from './plugins/matlabExportPlugin';
import { matlabCommPlugin } from './plugins/matlabCommunicationPlugin';

const plugins: JupyterFrontEndPlugin<any>[] = [
    matlabToolbarButtonPlugin,
    matlabMFilesPlugin,
    matlabCommPlugin,
    matlabCodeMirror6Plugin,
    matlabExportPlugin
];

export default plugins;
