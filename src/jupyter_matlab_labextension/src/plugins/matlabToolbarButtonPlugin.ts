// Copyright 2025 The MathWorks, Inc.

// Registers the button which allows access to MATLAB in a browser, which will
// appear in the notebook toolbar.

import {
    JupyterFrontEnd,
    JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
    ToolbarButton, Notification
} from '@jupyterlab/apputils';

import {
    INotebookTracker, NotebookPanel
} from '@jupyterlab/notebook';

import { CommandRegistry } from '@lumino/commands';
import { Menu } from '@lumino/widgets';

import { matlabIcon } from '../icons';

import { CommunicationService, ICommunicationService } from './matlabCommunicationPlugin';
import { getMatlabUrl, handleMatlabLicensing, waitForMatlabToStart } from '../utils/matlab';
import { PathExt } from '@jupyterlab/coreutils';
import { ActionFactory } from './actions/actionFactory';
import { ActionTypes } from './actions/actionTypes';
import { CheckFileExistsAction } from './actions/checkFileExistsAction';
import { getNewFileName } from '../utils/file';
import { MatlabStatusAction } from './actions/matlabStatusAction';

export const matlabToolbarButtonPlugin: JupyterFrontEndPlugin<void> = {
    id: '@mathworks/matlabToolbarButtonPlugin',
    autoStart: true,
    requires: [CommunicationService, INotebookTracker],
    activate: (
        app: JupyterFrontEnd, commService: ICommunicationService, notebookTracker: INotebookTracker
    ) => {
        console.log('Activated toolbar plugin');
        // const matlabToolbarButton = new MatlabToolbarButtonExtension();
        // app.docRegistry.addWidgetExtension('Notebook', matlabToolbarButton);

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
                        2) Start matlab-proxy and fetch MATLAB status
                        3) Complete licensing if required
                        4) The IPYNB file needs to be converted to MLX
                        5) Edit command request for the newly generated MLX file needs to be sent
                        */

                        notebook.sessionContext.ready.then(async () => {
                            const notebookName = notebook.context.path; // An ipynb file is guarranteed to be here as we are in a Notebook
                            const comm = commService.getComm(notebook.id);
                            const matlabUrl = getMatlabUrl();

                            const currentDir = PathExt.dirname(notebookName);
                            const notebookNameWithoutExtension = PathExt.basename(notebookName, PathExt.extname(notebookName));
                            const mlxFileName = `${notebookNameWithoutExtension}.mlx`;
                            let finalMlxFilePath = PathExt.join(currentDir, mlxFileName);

                            console.log('notebook name ', notebookName, ' currentDir ', currentDir, ' notebookNameWithout ', notebookNameWithoutExtension, ' mlxFileName', mlxFileName);
                            console.log('final mlx file path ', finalMlxFilePath);

                            const checkFileExistsAction = ActionFactory.createAction(ActionTypes.CHECK_FILE_EXISTS, true, notebook);
                            await checkFileExistsAction.execute({ mlxFilePath: finalMlxFilePath }, comm);
                            const fileAlreadyExists = CheckFileExistsAction.getFileExistsStatus();

                            if (fileAlreadyExists) {
                                const newFileName = await getNewFileName(notebookName);
                                console.log('New file name is ', newFileName);
                                if (newFileName) {
                                    finalMlxFilePath = PathExt.join(currentDir, newFileName);
                                } else {
                                    return; // User neither provided a new file name nor chose to overwrite, so return early
                                }
                            }

                            // Send StartMatlabProxy action to kernel. This would be a no-op if matlab-proxy is already up
                            const startMatlabProxyAction = ActionFactory.createAction(ActionTypes.START_MATLAB_PROXY, true, notebook);
                            await startMatlabProxyAction.execute(null, comm);

                            // Get status of matlab-proxy
                            const matlabStatusAction = ActionFactory.createAction(ActionTypes.MATLAB_STATUS, true, notebook);
                            await matlabStatusAction.execute(null, comm);

                            let status = MatlabStatusAction.getStatus();

                            if (!status.isLicensed) {
                                await handleMatlabLicensing(matlabUrl, comm, notebook);

                                // After sign in, re-fetch matlab status for the updated status
                                await matlabStatusAction.execute(null, comm);
                                status = MatlabStatusAction.getStatus();
                            }

                            if (status.status === 'starting') {
                                await waitForMatlabToStart(1000, comm, notebook);
                            }

                            const convertAction = ActionFactory.createAction(ActionTypes.CONVERT, true, notebook);
                            await convertAction.execute({
                                action: ActionTypes.CONVERT,
                                ipynbFilePath: notebookName,
                                mlxFilePath: finalMlxFilePath
                            }, comm);

                            // Conversion successful, proceed with opening MATLAB
                            Notification.info('Opening MATLAB...', { autoClose: 2000 });
                            setTimeout(() => {
                                window.open(matlabUrl, '_blank');
                            }, 1500);

                            const editAction = ActionFactory.createAction(ActionTypes.EDIT, true, notebook);
                            await editAction.execute({ action: ActionTypes.EDIT, mlxFilePath: finalMlxFilePath }, comm);
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

                // Add cleanup when notebook is disposed
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
