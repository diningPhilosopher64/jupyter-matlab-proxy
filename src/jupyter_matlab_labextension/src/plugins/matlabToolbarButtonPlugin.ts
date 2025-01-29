// Copyright 2025 The MathWorks, Inc.

// Registers the button which allows access to MATLAB in a browser, which will
// appear in the notebook toolbar.

import {
    JupyterFrontEnd,
    JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ToolbarButton, Notification } from '@jupyterlab/apputils';
import { PathExt } from '@jupyterlab/coreutils';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { INotebookModel, INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';

import { DisposableDelegate } from '@lumino/disposable';
import { Menu } from '@lumino/widgets';

import { matlabIcon } from '../icons';

import { CommService, ICommService } from './matlabCommunicationPlugin';
import { getCurrentFilePath } from './matlabFileTrackerPlugin';
import { ActionFactory } from './actions/actionFactory';
import { ActionTypes } from './actions/actionTypes';
import { MatlabStatusAction } from './actions/matlabStatusAction';
import { CheckFileExistsAction } from './actions/checkFileExistsAction';
import { getNewFileName } from '../utils/file';
import { handleMatlabLicensing, waitForMatlabToStart, getMatlabUrl } from '../utils/matlab';
import { LabIcon } from '@jupyterlab/ui-components';

// Wait until the kernel has loaded, then check if it is a MATLAB kernel
const insertButton = async (panel: NotebookPanel, matlabToolbarButton: ToolbarButton, index: number, buttonName: string): Promise<void> => {
    await panel.sessionContext.ready;
    if (panel.sessionContext.kernelDisplayName === 'MATLAB Kernel') {
        panel.toolbar.insertItem(index, buttonName, matlabToolbarButton);
    }
};

type CommandType = {
    label: string;
    icon?: LabIcon;
    execute: () => void | Promise<void>;
    isEnabled?: () => boolean;
    isVisible?: () => boolean;
    caption?: string;
};

// TODO: If MATLAB is already busy, what is the behaviour ?

class MatlabToolbarButtonExtension implements DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel> {
    private menu: Menu;
    private openMatlabCommand: CommandType;
    private openAsMlxInMatlabCommand : CommandType;
    private matlabToolbarButton: ToolbarButton;
    constructor (private app: JupyterFrontEnd) {
        const { commands } = this.app;
        this.menu = new Menu({ commands });
        const matlabUrl = getMatlabUrl();

        this.matlabToolbarButton = new ToolbarButton({
            className: 'openMATLABButton',
            icon: matlabIcon,
            label: 'MATLAB',
            tooltip: 'MATLAB Options',
            onClick: (): void => {
                // Position and show the menu
                const buttonElement = this.matlabToolbarButton.node;
                const rect = buttonElement.getBoundingClientRect();
                this.menu.open(rect.left, rect.bottom);
            }
        });

        this.openMatlabCommand = {
            label: 'Open MATLAB',
            icon: matlabIcon,
            execute: () => {
                window.open(matlabUrl, '_blank');
            }
        };

        this.openAsMlxInMatlabCommand = {
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
                const filePath = getCurrentFilePath() as string; // An ipynb file is guarranteed to be here as we are in a Notebook
                console.log('File path is ', filePath);

                const currentDir = PathExt.dirname(filePath);
                const currentFileNameWithoutExtension = PathExt.basename(filePath, PathExt.extname(filePath));
                const mlxFileName = `${currentFileNameWithoutExtension}.mlx`;
                let finalMlxFilePath = PathExt.join(currentDir, mlxFileName);

                const checkFileExistsAction = ActionFactory.createAction(ActionTypes.CHECK_FILE_EXISTS, true);
                await checkFileExistsAction.execute({ mlxFilePath: finalMlxFilePath });

                const fileAlreadyExists = CheckFileExistsAction.getFileExistsStatus();

                if (fileAlreadyExists) {
                    const newFileName = await getNewFileName(currentFileNameWithoutExtension);
                    if (newFileName) {
                        finalMlxFilePath = PathExt.join(currentDir, newFileName);
                    } else {
                        return; // User neither provided a new file name nor chose to overwrite, so return early
                    }
                }

                // Send StartMatlabProxy action to kernel. This would be a no-op if matlab-proxy is already up
                const startMatlabProxyAction = ActionFactory.createAction(ActionTypes.START_MATLAB_PROXY, true);
                await startMatlabProxyAction.execute(null);

                // Get status of matlab-proxy
                const matlabStatusAction = ActionFactory.createAction(ActionTypes.MATLAB_STATUS, true);
                await matlabStatusAction.execute(null);

                let status = MatlabStatusAction.getStatus();

                if (!status.isLicensed) {
                    await handleMatlabLicensing(matlabUrl);

                    // After sign in, re-fetch matlab status for the updated status
                    await matlabStatusAction.execute(null);
                    status = MatlabStatusAction.getStatus();
                }

                if (status.status === 'starting') {
                    await waitForMatlabToStart(1000);
                }

                const convertAction = ActionFactory.createAction(ActionTypes.CONVERT, true);
                await convertAction.execute({
                    action: ActionTypes.CONVERT,
                    ipynbFilePath: filePath,
                    mlxFilePath: finalMlxFilePath
                });

                // Conversion successful, proceed with opening MATLAB
                Notification.info('Opening MATLAB...', { autoClose: 2000 });
                setTimeout(() => {
                    window.open(matlabUrl, '_blank');
                }, 1500);

                const editAction = ActionFactory.createAction(ActionTypes.EDIT, true);
                await editAction.execute({ action: ActionTypes.EDIT, mlxFilePath: finalMlxFilePath });
            }
        };

        commands.addCommand('matlab:open-browser', this.openMatlabCommand);

        commands.addCommand('matlab:open-mlx', this.openAsMlxInMatlabCommand);

        this.menu.addItem({ command: 'matlab:open-browser' });
        this.menu.addItem({ command: 'matlab:open-mlx' });
    }

    // Only notebook specific setup should be done here.
    // This function will be run everytime a new notebook is opened.
    createNew (panel: NotebookPanel, context: DocumentRegistry.IContext<INotebookModel>): DisposableDelegate {
        insertButton(panel, this.matlabToolbarButton, 10, 'matlabToolbarButton');

        // Dispose resources created by this plugin when the page unloads.
        // Need to add this seperately if the jupyterlab tab is closed directly.
        window.addEventListener('beforeunload', () => {
            this.disposeResources();
        });
        return new DisposableDelegate(() => {
            this.disposeResources();
        });
    }

    disposeResources (): void {
        console.log('Disposing MATLAB toolbar button plugin');
        this.matlabToolbarButton.dispose();
        this.menu.dispose();
    }
}

export const matlabToolbarButtonPlugin: JupyterFrontEndPlugin<any> = {
    id: '@mathworks/matlabToolbarButtonPlugin',
    autoStart: true,
    requires: [ICommService, INotebookTracker],
    activate: (app: JupyterFrontEnd, comm: CommService) => {
        const matlabToolbarButton = new MatlabToolbarButtonExtension(app);
        app.docRegistry.addWidgetExtension('Notebook', matlabToolbarButton);
        console.log('MATLAB Toolbar button plugin activated');
    }
};
