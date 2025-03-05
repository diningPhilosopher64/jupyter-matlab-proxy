// Copyright 2025 The MathWorks, Inc.

import {
    JupyterFrontEnd,
    JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { PageConfig } from '@jupyterlab/coreutils';
import { INotebookTracker } from '@jupyterlab/notebook';
import { Token } from '@lumino/coreutils';
import { Signal, ISignal } from '@lumino/signaling';

import path from 'path';

// let this._notebookName : string | undefined;
// let notebookLanguage : string | undefined;
// let currentNotebook: NotebookPanel | null;
// let isNotebookOpen = false;

export interface IFileTracker {
    isMatlabNotebook(): boolean;
    getCurrentFilename(): string | undefined;
    getCurrentFilePath(): string | undefined;
    notebookChanged: ISignal<IFileTracker, void>;

    // Signal that fires when tracker is ready
    ready: ISignal<IFileTracker, void>;

    // Whether the tracker is ready
    isReady: boolean;

    // Returns a promise that resolves when the tracker is ready
    whenReady(): Promise<void>;
}

// Define a unique token for the FileTracker plugin
export const FileTrackerService = new Token<IFileTracker>('@mathworks/MatlabFileTrackerPlugin');

class MatlabFileTracker implements IFileTracker {
    private _notebookTracker: INotebookTracker;
    private _isNotebookOpen = false;
    private _notebookName : string | undefined = undefined;
    private _notebookLanguage : string | undefined = undefined;
    private _isReady: boolean;
    notebookChanged: Signal<IFileTracker, void>;
    private _ready: Signal<IFileTracker, void>;

    constructor (notebookTracker: INotebookTracker) {
        this._notebookTracker = notebookTracker;
        this._isReady = false;
        this.notebookChanged = new Signal<IFileTracker, void>(this);
        this._ready = new Signal<IFileTracker, void>(this);

        this._notebookTracker.currentChanged.connect(this._onCurrentChanged, this);

        this._notebookTracker.restored.then(() => {
            if (this._notebookTracker.currentWidget) {
                this.updateNotebookInfo().then(() => {
                    this._isReady = true;
                    this._ready.emit();
                });
            } else if (!this._isReady) {
                // Still mark as ready if there's no notebook after restoration
                // this._isReady = true;
                // this._ready.emit();
                console.log('\n no notebook after restoration');
            }
        });
    }

    isMatlabNotebook (): boolean {
        return this._isNotebookOpen && this._notebookLanguage === 'matlab';
    }

    getCurrentFilePath (): string | undefined {
        if (this._notebookName) {
            return path.join(PageConfig.getOption('serverRoot'), this._notebookName);
        } else {
            return undefined;
        }
    }

    getCurrentFilename (): string | undefined {
        return this._notebookName;
    }

    get ready (): ISignal<IFileTracker, void> {
        return this._ready;
    }

    get isReady (): boolean {
        return this._isReady;
    }

    async whenReady (): Promise<void> {
        if (this._isReady) {
            return Promise.resolve();
        }

        return new Promise<void>(resolve => {
            this.updateNotebookInfo().then(resolve);
        });

        // return this._updateNotebookInfo();

        // return new Promise<void>(resolve => {
        //     const onReady = () => {
        //         this._ready.disconnect(onReady);
        //         resolve();
        //     };
        //     this._ready.connect(onReady);
        // });
    }

    private _onCurrentChanged (): void {
        // this._isReady = false;
        this.updateNotebookInfo().then(() => {
            // this._isReady = true;
            this._ready.emit();
        });
    }

    async updateNotebookInfo (): Promise<void> {
        this._isReady = false;
        const current = this._notebookTracker.currentWidget;
        if (current) {
            this._isNotebookOpen = true;
            const context = current.context;
            this._isNotebookOpen = context !== null;

            // Wait for session context to be ready
            if (!current.sessionContext.isReady) {
                await current.sessionContext.ready;
            }

            this._notebookName = context.path;
            const metadata = current.content?.model?.metadata as any;
            if (metadata) {
                const kernelInfo = metadata.kernelspec as any;
                if (kernelInfo && kernelInfo.language) {
                    this._notebookLanguage = kernelInfo.language.toLowerCase();
                }
            }
            this._isReady = true;
            console.log('Current notebook is ready \n\n');
        } else {
            console.log('\n \n current notebook is not ready \n');
        }
    }
}

// Global plugin. Initialized once and used by all notebooks.
export const matlabFileTrackerPlugin: JupyterFrontEndPlugin<IFileTracker> = {
    id: '@mathworks/FileTrackerPlugin',
    autoStart: true,
    requires: [INotebookTracker],
    provides: FileTrackerService,
    activate: async (
        app: JupyterFrontEnd,
        notebookTracker: INotebookTracker
    ) => {
        const fileTracker = new MatlabFileTracker(notebookTracker);
        await fileTracker.whenReady();
        app.shell.currentChanged?.connect(async () => {
            await fileTracker.updateNotebookInfo();
        });
        console.log('\n FileTracker initialized \n');
        return fileTracker;

        // If jupyterlab interface loads for the first time with a notebook already opened
        // update currentFileName to notebooks' name.
        // currentNotebook = notebookTracker.currentWidget;

        // if (currentNotebook) {
        //     await updateNotebookInfo(currentNotebook);
        // } else {
        //     currentFileName = undefined;
        //     notebookLanguage = undefined;
        //     isNotebookOpen = false;
        // }
        // console.log(currentFileName ? `Current file name is ${currentFileName}` : 'No file opened');

        // // Add state change listener
        // notebookTracker.currentChanged.connect(async (_, currentNotebook) => {
        //     if (currentNotebook) {
        //         await updateNotebookInfo(currentNotebook);
        //     } else {
        //         currentFileName = undefined;
        //         notebookLanguage = undefined;
        //         isNotebookOpen = false;
        //     }
        //     console.log(currentFileName ? `Current file name is ${currentFileName}` : 'No file opened');
        // });
        // console.log('MATLAB FileTracker Plugin activated!', PageConfig.getOption('serverRoot'));
        // const currentPath = factory.tracker.currentWidget?.model.path;

        // console.log('Current direcotry path is ', currentPath, typeof (currentPath), currentPath?.length);
    }
};

// export function isMatlabNotebook (): boolean {
//     return isNotebookOpen && notebookLanguage === 'matlab';
// }

// export function getCurrentFileName (): string | undefined {
//     return this._notebookName;
// }

// export function getCurrentFilePath (): string | undefined {
//     if (this._notebookName) {
//         return path.join(PageConfig.getOption('serverRoot'), this._notebookName);
//     } else {
//         return undefined;
//     }
// }

// export function getCurrentNotebook (): NotebookPanel | null {
//     return currentNotebook;
// }

// export async function updateNotebookInfo (panel: NotebookPanel): Promise<void> {
//     await panel.sessionContext.ready;
//     this._notebookName = panel.context.path;
//     const metadata = panel.content?.model?.metadata as any;
//     if (metadata) {
//         const kernelInfo = metadata.kernelspec as any;
//         if (kernelInfo && kernelInfo.language) {
//             notebookLanguage = kernelInfo.language.toLowerCase();
//         }
//     }

//     isNotebookOpen = panel.context !== null && panel.context.path.endsWith('.ipynb');
// }
