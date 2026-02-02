// Copyright 2025 The MathWorks, Inc.

import { ICommunicationChannel } from '../plugins/matlabCommunication';
import { NotebookPanel } from '@jupyterlab/notebook';
import { ActionFactory } from '../plugins/actions/actionFactory';
import { ActionTypes } from '../plugins/actions/actionTypes';
import { MATLABStatus, MatlabStatusAction } from '../plugins/actions/matlabStatusAction';

import { PromiseDelegate, ReadonlyJSONValue } from '@lumino/coreutils';
import { displayOpenMatlabNotification, displayStartingMatlabNotification } from './notifications';
import { ConvertAction } from '../plugins/actions/convertAction';
import { NotebookInfo } from './notebook';

export async function getMatlabProxyStatus (panel: NotebookPanel, comm: ICommunicationChannel): Promise<MATLABStatus> {
    const matlabStatusAction = ActionFactory.createAction(
        ActionTypes.MATLAB_STATUS,
        true,
        panel
    );
    await matlabStatusAction.execute(null, comm);
    return MatlabStatusAction.getStatus();
}

export async function startMatlab (
    notebook: NotebookPanel,
    comm: ICommunicationChannel
): Promise<MATLABStatus> {
    // Send StartMatlabProxy action to kernel. This would be a no-op if matlab-proxy is already up
    const startMatlabProxyAction = ActionFactory.createAction(
        ActionTypes.START_MATLAB_PROXY,
        true,
        notebook
    );
    await startMatlabProxyAction.execute(null, comm);

    // Get status of matlab-proxy
    const status = await getMatlabProxyStatus(notebook, comm);
    return status;
}

export async function waitForMatlabToStart (
    sleepInMS: number,
    comm: ICommunicationChannel,
    notebook: NotebookPanel,
    timeoutInMS: number = 600000 // Default timeout for MATLAB to start is 10 minutes
): Promise<void> {
    const matlabStatusAction = ActionFactory.createAction(
        ActionTypes.MATLAB_STATUS,
        true,
        notebook
    );
    const matlabStartPromise = displayStartingMatlabNotification();

    let timeoutReached = false;

    // Setup a timeout to reject the promise and return from this function
    // if MATLAB does not start within the specified timeoutInMS
    setTimeout(() => {
        matlabStartPromise.reject(
            new Error('Timed out waiting for MATLAB to start')
        );
        timeoutReached = true;
    }, timeoutInMS);

    // eslint-disable-next-line no-unmodified-loop-condition
    while (!timeoutReached) {
        await matlabStatusAction.execute(null, comm);
        const status = MatlabStatusAction.getStatus();
        if (status.matlabStatus === 'up') {
            matlabStartPromise.resolve(null);
            break;
        }
        await new Promise((resolve) => setTimeout(resolve, sleepInMS));
    }
}

export async function convertToLiveCodeAndOpenMatlab (
    panel: NotebookPanel,
    comm: ICommunicationChannel,
    liveCodeFilePath: string,
    shouldOpenMatlab: boolean = true
): Promise<void> {
    const generatedLiveCodeFilePath = await convertToLiveCode(panel, comm, liveCodeFilePath);
    const notebookInfo = new NotebookInfo();
    await notebookInfo.update(panel);

    if (generatedLiveCodeFilePath) {
        if (shouldOpenMatlab) {
            displayOpenMatlabNotification();
            // Open MATLAB in a new tab after a slight delay to allow notification to render
            setTimeout(() => {
                window.open(notebookInfo.getTargetURL()!, '_blank');
            }, 1500);
        }

        await openGeneratedFileInEditor(panel, comm, generatedLiveCodeFilePath);
    }
}

export async function openGeneratedFileInEditor (
    notebook: NotebookPanel,
    comm: ICommunicationChannel,
    liveCodeFilePath: string): Promise<void> {
    const editAction = ActionFactory.createAction(
        ActionTypes.EDIT,
        true,
        notebook
    );
    await editAction.execute(
        { action: ActionTypes.EDIT, liveCodeFilePath },
        comm
    );
}

export async function convertToLiveCode (
    notebook: NotebookPanel,
    comm: ICommunicationChannel,
    liveCodeFilePath: string
): Promise<string> {
    const convertAction = ActionFactory.createAction(
        ActionTypes.CONVERT,
        true,
        notebook
    );
    await convertAction.execute(
        {
            ipynbFilePath: notebook.context.path,
            liveCodeFilePath
        },
        comm
    );

    return ConvertAction.getGeneratedLiveCodeFilePath();
}

export async function waitForUserToSignin (sleepInMS: number,
    comm: ICommunicationChannel,
    notebook: NotebookPanel,
    promise: PromiseDelegate<ReadonlyJSONValue>,
    timeoutInMS: number = 600000 // Default timeout for User to finish Signin is 10 minutes
): Promise<void> {
    const matlabStatusAction = ActionFactory.createAction(
        ActionTypes.MATLAB_STATUS,
        true,
        notebook
    );

    let timeoutReached = false;

    // Setup a timeout to reject the promise and return from this function
    // if MATLAB does not start within the specified timeoutInMS
    setTimeout(() => {
        promise.reject(
            new Error('Timed out waiting for user to finish signin')
        );
        timeoutReached = true;
    }, timeoutInMS);

    // eslint-disable-next-line no-unmodified-loop-condition
    while (!timeoutReached) {
        await matlabStatusAction.execute(null, comm);
        const status = MatlabStatusAction.getStatus();
        if (status.isMatlabLicensed) {
            promise.resolve(null);
            break;
        }
        await new Promise((resolve) => setTimeout(resolve, sleepInMS));
    }
}

export function sendConvertRequest (
    data: any,
    comm: ICommunicationChannel
): boolean {
    comm.send({
        action: ActionTypes.CONVERT,
        data
    });
    return true;
}
