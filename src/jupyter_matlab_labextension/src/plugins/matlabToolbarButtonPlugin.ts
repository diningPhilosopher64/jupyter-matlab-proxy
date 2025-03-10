// Copyright 2025 The MathWorks, Inc.

// Registers the button which allows access to MATLAB in a browser, which will
// appear in the notebook toolbar.

import {
    JupyterFrontEnd,
    JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
    ToolbarButton
} from '@jupyterlab/apputils';

import {
    INotebookTracker, NotebookPanel
} from '@jupyterlab/notebook';

import { CommandRegistry } from '@lumino/commands';
import { Menu } from '@lumino/widgets';

import { matlabIcon } from '../icons';

import { CommunicationService, ICommunicationService } from './matlabCommunicationPlugin';
import { convertAndOpenMatlab, getMatlabUrl, startMatlab } from '../utils/matlab';
import { getFileNameForConversion } from '../utils/file';

export const matlabToolbarButtonPlugin: JupyterFrontEndPlugin<void> = {
    id: '@mathworks/matlabToolbarButtonPlugin',
    autoStart: true,
    requires: [CommunicationService, INotebookTracker],
    activate: (
        app: JupyterFrontEnd, commService: ICommunicationService, notebookTracker: INotebookTracker
    ) => {
        console.log('Activated toolbar plugin');
        const handleNotebook = (notebook: NotebookPanel) => {
            const context = notebook.context;

            if (!context) {
                console.log('\n\n Context not ready ');
                return;
            }

            if (context.model.metadata.kernelspec?.language === 'matlab') {
                const openAsMlxInMatlabCommand = {
                    label: 'Open as MLX in MATLAB',
                    icon: matlabIcon,
                    execute: async () => {
                        /* Steps:
                        1) Check if an MLX file with the same name as the IPYNB file already exists in the current directory
                            If yes, ask if they would like to overwrite ?
                        2) Start matlab-proxy & complete licensing if required
                        3) Convert the ipynb file to mlx and send and edit request after opening MATLAB
                        */

                        notebook.sessionContext.ready.then(async () => {
                            const comm = commService.getComm(notebook.id);
                            const finalMlxFilePath = await getFileNameForConversion(notebook, comm);
                            if (!finalMlxFilePath) {
                                return; // User aborted the conversion, so return early..
                            }

                            await startMatlab(notebook, comm);
                            await convertAndOpenMatlab(notebook, comm, finalMlxFilePath);
                        });
                    }
                };

                const commands = new CommandRegistry();
                const openMatlabCommand = {
                    label: 'Open MATLAB',
                    icon: matlabIcon,
                    execute: () => {
                        window.open(getMatlabUrl(), '_blank');
                    }
                };

                commands.addCommand('matlab:open-browser', openMatlabCommand);
                commands.addCommand('matlab:open-mlx', openAsMlxInMatlabCommand);
                const menu = new Menu({ commands });
                menu.addItem({ command: 'matlab:open-browser' });
                menu.addItem({ command: 'matlab:open-mlx' });

                // Create the toolbar button
                const matlabToolbarButton = new ToolbarButton({
                    className: 'openMATLABButton',
                    icon: matlabIcon,
                    label: 'Open MATLAB',
                    tooltip: 'Open MATLAB',
                    onClick: (): void => {
                        // "_blank" is the option to open in a new browser tab
                        const buttonElement = matlabToolbarButton.node;
                        const rect = buttonElement.getBoundingClientRect();
                        menu.open(rect.left, rect.bottom);
                    }
                });

                // Add the button to the notebook toolbar
                notebook.toolbar.insertItem(10, 'openMatlabButton', matlabToolbarButton);

                // Cleanup when notebook is disposed
                notebook.disposed.connect(() => {
                    menu.dispose();
                    matlabToolbarButton.dispose();
                    console.log('Commands disposed for notebook:', notebook.id);
                });
            }
        };

        notebookTracker.widgetAdded.connect((_, notebook) => {
            notebook.context.ready.then(() => {
                handleNotebook(notebook);
            });
        });
    }
};
