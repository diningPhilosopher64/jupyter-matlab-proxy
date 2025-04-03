// Copyright 2025 The MathWorks, Inc.

import { BaseAction } from './baseAction';
import { ActionTypes } from './actionTypes';
import { ICommunicationChannel } from '../matlabCommunicationPlugin';
import { Notification } from '@jupyterlab/apputils';
import { NotebookPanel } from '@jupyterlab/notebook';
import { getFileNameForConversion } from '../../utils/file';
import { convertAndOpenMatlab, startMatlab } from '../../utils/matlab';

export class NudgeAction extends BaseAction {
    blocking: boolean;
    private notebook: NotebookPanel;

    constructor (blocking: boolean, panel: NotebookPanel) {
        super();
        this.blocking = blocking;
        this.notebook = panel;
    }

    public getActionName () : string {
        return ActionTypes.NUDGE;
    }

    public async execute (data: any, comm:ICommunicationChannel): Promise<void> { }

    public onMsg (data: any, comm: ICommunicationChannel): void {
        Notification.info(data.msg, {
            autoClose: 5000,
            actions: [
                {
                    label: 'Open',
                    callback: async () => {
                        Notification.info('This requires the file to be converted to mlx before opening MATLAB', {
                            autoClose: 5000
                        });

                        await new Promise(resolve => setTimeout(resolve, 2000));

                        const finalMlxFilePath = await getFileNameForConversion(this.notebook, comm);
                        if (!finalMlxFilePath) {
                            return; // User aborted the conversion, so return early..
                        }

                        await startMatlab(this.notebook, comm);
                        await convertAndOpenMatlab(this.notebook, comm, finalMlxFilePath);
                    }
                },
                {
                    label: 'Ignore',
                    callback: () => {
                        console.log('Ignore clicked');
                    }
                }
            ]
        });
    }
}
