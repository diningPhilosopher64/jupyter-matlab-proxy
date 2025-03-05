// Copyright 2025 The MathWorks, Inc.

// import { PromiseDelegate, ReadonlyJSONValue } from '@lumino/coreutils';

// import './index.css';

import { BaseAction } from './baseAction';
import { ActionTypes } from './actionTypes';
import { ICommunicationChannel } from '../matlabCommunicationPlugin';
import { Notification } from '@jupyterlab/apputils';
import { NotebookPanel } from '@jupyterlab/notebook';
import { Widget } from '@lumino/widgets';
import { ActionFactory } from './actionFactory';
import { CheckFileExistsAction } from './checkFileExistsAction';
import { getNewFileName } from '../../utils/file';
import { PathExt } from '@jupyterlab/coreutils';
import { getMatlabUrl, handleMatlabLicensing, waitForMatlabToStart } from '../../utils/matlab';
import { MatlabStatusAction } from './matlabStatusAction';

export class NudgeAction extends BaseAction {
    blocking: boolean;
    private notebook: NotebookPanel;
    // private static blockingPromise: PromiseDelegate<ReadonlyJSONValue> | null;

    constructor (blocking: boolean, panel: NotebookPanel) {
        super();
        this.blocking = blocking;
        this.notebook = panel;
        // NudgeAction.blockingPromise = null;
    }

    public getActionName () : string {
        return ActionTypes.NUDGE;
    }

    public async execute (data: any, comm:ICommunicationChannel): Promise<void> { }

    public onMsg (data: any, comm: ICommunicationChannel): void {
        const popup = new CellPopup();
        popup.showNextToCell(this.notebook, 2);
        Notification.info(data.msg, {
            autoClose: 5000,
            actions: [
                {
                    label: 'Open',
                    callback: async () => {
                        console.log('Open clicked');
                        const notebookName = this.notebook.context.path; // An ipynb file is guarranteed to be here as we are in a Notebook
                        const matlabUrl = getMatlabUrl();
                        const currentDir = PathExt.dirname(notebookName);
                        const notebookNameWithoutExtension = PathExt.basename(notebookName, PathExt.extname(notebookName));
                        const mlxFileName = `${notebookNameWithoutExtension}.mlx`;
                        let finalMlxFilePath = PathExt.join(currentDir, mlxFileName);

                        const checkFileExistsAction = ActionFactory.createAction(ActionTypes.CHECK_FILE_EXISTS, true, this.notebook);
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
                        const startMatlabProxyAction = ActionFactory.createAction(ActionTypes.START_MATLAB_PROXY, true, this.notebook);
                        await startMatlabProxyAction.execute(null, comm);

                        // Get status of matlab-proxy
                        const matlabStatusAction = ActionFactory.createAction(ActionTypes.MATLAB_STATUS, true, this.notebook);
                        await matlabStatusAction.execute(null, comm);

                        let status = MatlabStatusAction.getStatus();

                        if (!status.isLicensed) {
                            await handleMatlabLicensing(matlabUrl, comm, this.notebook);

                            // After sign in, re-fetch matlab status for the updated status
                            await matlabStatusAction.execute(null, comm);
                            status = MatlabStatusAction.getStatus();
                        }

                        if (status.status === 'starting') {
                            await waitForMatlabToStart(1000, comm, this.notebook);
                        }

                        const convertAction = ActionFactory.createAction(ActionTypes.CONVERT, true, this.notebook);
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

                        const editAction = ActionFactory.createAction(ActionTypes.EDIT, true, this.notebook);
                        await editAction.execute({ action: ActionTypes.EDIT, mlxFilePath: finalMlxFilePath }, comm);
                    }
                },
                {
                    label: 'Ignore',
                    callback: () => {
                        console.log('Ignore clicked');
                        // Your ignore action logic here
                    }
                }
            ]
        });
    }
}

export class CellPopup extends Widget {
    constructor () {
        super();
        this.addClass('my-cell-popup');
    }

    showNextToCell (notebook: NotebookPanel, cellIndex: number) {
        const cell = notebook.content.widgets[cellIndex];
        if (!cell) return;

        // Get cell position
        const cellRect = cell.node.getBoundingClientRect();

        // Position popup next to cell
        this.node.style.position = 'absolute';
        this.node.style.left = `${cellRect.right + 10}px`;
        this.node.style.top = `${cellRect.top}px`;

        // Add to document body
        document.body.appendChild(this.node);
    }
}
