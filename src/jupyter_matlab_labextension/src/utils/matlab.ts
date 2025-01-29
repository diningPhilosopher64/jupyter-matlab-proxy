// Copyright 2025 The MathWorks, Inc.

import { PageConfig } from '@jupyterlab/coreutils';
import { ActionFactory } from '../plugins/actions/actionFactory';
import { ActionTypes } from '../plugins/actions/actionTypes';
import { MatlabStatusAction } from '../plugins/actions/matlabStatusAction';
import PopupWindowManager from './window';

import { Notification } from '@jupyterlab/apputils';
import { PromiseDelegate, ReadonlyJSONValue } from '@lumino/coreutils';

export function getMatlabUrl (): string {
    const baseUrl = PageConfig.getBaseUrl();
    // TODO for Krishan: Add logic to use Kernel IDs in the url for Isolated MATLAB Kernel
    return baseUrl + 'matlab/default/index.html';
}

export async function handleMatlabLicensing (url: string) {
    const popupManager = new PopupWindowManager();
    console.debug('Show Pop up for MATLAB Sign In');
    popupManager.openPopup({
        url,
        title: 'MATLAB Sign In',
        width: 700,
        height: 600
    });

    await waitForMatlabToFinishLicensing(1000);
    console.debug('Finished SignIn successfully');
    popupManager.closePopup();
}

export async function waitForMatlabToStart (sleepInMS: number) : Promise<void> {
    const matlabStatusAction = ActionFactory.createAction(ActionTypes.MATLAB_STATUS, true);
    const matlabStartPromise = new PromiseDelegate<ReadonlyJSONValue>();
    Notification.promise(matlabStartPromise.promise, {
        pending: {
            message: (() : string => {
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
        await matlabStatusAction.execute(null);
        const status = MatlabStatusAction.getStatus();
        if (status.status === 'up') {
            matlabStartPromise.resolve(null);
            break;
        }
        await new Promise(resolve => setTimeout(resolve, sleepInMS));
    }
}

async function waitForMatlabToFinishLicensing (sleepInMS: number) : Promise<void> {
    const matlabStatusAction = ActionFactory.createAction(ActionTypes.MATLAB_STATUS, true);

    const matlabLicensePromise = new PromiseDelegate<ReadonlyJSONValue>();
    Notification.promise(matlabLicensePromise.promise, {
        pending: {
            message: (() : string => {
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
        await matlabStatusAction.execute(null);
        const status = MatlabStatusAction.getStatus();
        console.log('Status in licensing is ', status);
        if (status.isLicensed) {
            matlabLicensePromise.resolve(null);
            break;
        }
        await new Promise(resolve => setTimeout(resolve, sleepInMS));
    }
}
