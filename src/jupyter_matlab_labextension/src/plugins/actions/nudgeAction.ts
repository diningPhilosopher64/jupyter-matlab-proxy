// Copyright 2025 The MathWorks, Inc.

// import { PromiseDelegate, ReadonlyJSONValue } from '@lumino/coreutils';

// import './index.css';

import { BaseAction } from './baseAction';
import { ActionTypes } from './actionTypes';
import { ICommunicationChannel } from '../matlabCommunicationPlugin';
import { Notification } from '@jupyterlab/apputils';
import { NotebookPanel } from '@jupyterlab/notebook';
import { Widget } from '@lumino/widgets';
import { getFileNameForConversion } from '../../utils/file';
import { convertAndOpenMatlab, startMatlab } from '../../utils/matlab';

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
