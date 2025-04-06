// Copyright 2025 The MathWorks, Inc.

import { PageConfig } from '@jupyterlab/coreutils';
import { ActionFactory } from '../plugins/actions/actionFactory';
import { ActionTypes } from '../plugins/actions/actionTypes';
import { MatlabStatusAction } from '../plugins/actions/matlabStatusAction';
import PopupWindowManager from './window';

import { Notification } from '@jupyterlab/apputils';
import { PromiseDelegate, ReadonlyJSONValue } from '@lumino/coreutils';
import { ICommunicationChannel } from '../plugins/matlabCommunicationPlugin';
import { NotebookPanel } from '@jupyterlab/notebook';

export function getMatlabUrl (): string {
    const baseUrl = PageConfig.getBaseUrl();
    // TODO for Krishan: Add logic to use Kernel IDs in the url for Isolated MATLAB Kernel
    return baseUrl + 'matlab/default/index.html';
}

async function handleMatlabLicensing (
    url: string,
    comm: ICommunicationChannel,
    notebook: NotebookPanel
) {
    const popupManager = new PopupWindowManager();
    console.debug('Show Pop up for MATLAB Sign In');
    popupManager.openPopup({
        url,
        title: 'MATLAB Sign In',
        width: 700,
        height: 600
    });

    await waitForMatlabToFinishLicensing(1000, comm, notebook);
    console.debug('Finished SignIn successfully');
    popupManager.closePopup();
}

async function waitForMatlabToStart (
    sleepInMS: number,
    comm: ICommunicationChannel,
    notebook: NotebookPanel
): Promise<void> {
    const matlabStatusAction = ActionFactory.createAction(
        ActionTypes.MATLAB_STATUS,
        true,
        notebook
    );
    const matlabStartPromise = new PromiseDelegate<ReadonlyJSONValue>();
    Notification.promise(matlabStartPromise.promise, {
        pending: {
            message: ((): string => {
                return 'Starting MATLAB...';
            })(),
            options: { autoClose: false }
        },
        success: {
            message: (): string => {
                return 'MATLAB is running';
            },
            options: { autoClose: 3000 }
        },
        error: { message: () => 'Failed to start MATLAB' }
    });
    while (true) {
        await matlabStatusAction.execute(null, comm);
        const status = MatlabStatusAction.getStatus();
        console.log('status is ', status);
        if (status.status === 'up') {
            matlabStartPromise.resolve(null);
            break;
        }
        await new Promise((resolve) => setTimeout(resolve, sleepInMS));
    }
}

async function waitForMatlabToFinishLicensing (
    sleepInMS: number,
    comm: ICommunicationChannel,
    notebook: NotebookPanel
): Promise<void> {
    const matlabStatusAction = ActionFactory.createAction(
        ActionTypes.MATLAB_STATUS,
        true,
        notebook
    );

    const matlabLicensePromise = new PromiseDelegate<ReadonlyJSONValue>();
    Notification.promise(matlabLicensePromise.promise, {
        pending: {
            message: ((): string => {
                return 'Waiting for MATLAB to be licensed...';
            })(),
            options: { autoClose: false }
        },
        success: {
            message: (): string => {
                return 'MATLAB finished licensing';
            },
            options: { autoClose: 3000 }
        },
        error: { message: () => 'Failed to license MATLAB' }
    });

    while (true) {
        await matlabStatusAction.execute(null, comm);
        const status = MatlabStatusAction.getStatus();
        console.log('Status in licensing is ', status);
        if (status.isLicensed) {
            matlabLicensePromise.resolve(null);
            break;
        }
        await new Promise((resolve) => setTimeout(resolve, sleepInMS));
    }
}
export async function startMatlab (
    notebook: NotebookPanel,
    comm: ICommunicationChannel
): Promise<void> {
    // Send StartMatlabProxy action to kernel. This would be a no-op if matlab-proxy is already up
    const startMatlabProxyAction = ActionFactory.createAction(
        ActionTypes.START_MATLAB_PROXY,
        true,
        notebook
    );
    await startMatlabProxyAction.execute(null, comm);

    // Get status of matlab-proxy
    const matlabStatusAction = ActionFactory.createAction(
        ActionTypes.MATLAB_STATUS,
        true,
        notebook
    );
    await matlabStatusAction.execute(null, comm);

    let status = MatlabStatusAction.getStatus();

    if (!status.isLicensed) {
        await handleMatlabLicensing(getMatlabUrl(), comm, notebook);

        // After sign in, re-fetch matlab status for the updated status
        await matlabStatusAction.execute(null, comm);
        status = MatlabStatusAction.getStatus();
    }

    if (status.status === 'starting') {
        await waitForMatlabToStart(1000, comm, notebook);
    }
}

export async function convertAndOpenMatlab (
    notebook: NotebookPanel,
    comm: ICommunicationChannel,
    finalMlxFilePath: string
): Promise<void> {
    await convertToMLX(notebook, comm, finalMlxFilePath);

    // Conversion successful, proceed with opening MATLAB
    Notification.info('Opening MATLAB...', { autoClose: 2000 });
    setTimeout(() => {
        window.open(getMatlabUrl(), '_blank');
    }, 1500);

    const editAction = ActionFactory.createAction(
        ActionTypes.EDIT,
        true,
        notebook
    );
    await editAction.execute(
        { action: ActionTypes.EDIT, mlxFilePath: finalMlxFilePath },
        comm
    );
}

export async function convertToMLX (
    notebook: NotebookPanel,
    comm: ICommunicationChannel,
    finalMlxFilePath: string
): Promise<void> {
    const convertAction = ActionFactory.createAction(
        ActionTypes.CONVERT,
        true,
        notebook
    );
    await convertAction.execute(
        {
            action: ActionTypes.CONVERT,
            ipynbFilePath: notebook.context.path,
            mlxFilePath: finalMlxFilePath
        },
        comm
    );
}
