import { PromiseDelegate, ReadonlyJSONValue } from '@lumino/coreutils';
import { Notification } from '@jupyterlab/apputils';
import { NotebookInfo } from './notebook';
import { ICommunicationChannel } from '../plugins/matlabCommunication';
import { sendConvertRequest } from './matlab';

export async function displayUserSigninNotification () : Promise<PromiseDelegate<ReadonlyJSONValue>> {
    const userSigninPromise = new PromiseDelegate<ReadonlyJSONValue>();
    Notification.promise(userSigninPromise.promise, {
        pending: {
            message: ((): string => {
                return 'Waiting for user to sign in...';
            })(),
            options: { autoClose: false }
        },
        success: {
            message: (): string => {
                return 'User signed in successfully';
            },
            options: { autoClose: 3000 }
        },
        error: { message: () => 'Failed to sign in to MATLAB' }
    });

    // Sleep for 1.5 seconds to allow the notification to render
    await new Promise((resolve) => setTimeout(resolve, 1500));

    return userSigninPromise;
}

export function displayStartingMatlabNotification () : PromiseDelegate<ReadonlyJSONValue> {
    const startingMatlabPromise = new PromiseDelegate<ReadonlyJSONValue>();
    Notification.promise(startingMatlabPromise.promise, {
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

    return startingMatlabPromise;
}

export function displayKernelBusyNotification (notebookInfo: NotebookInfo) : void {
    Notification.info('Kernel is busy', {
        autoClose: 5000,
        actions: [
            {
                label: 'Wait',
                callback: async () => {
                    await notebookInfo.waitForIdleStatus();
                }
            },
            {
                label: 'Interrupt',
                callback: () => {
                    notebookInfo.interrupt();
                    console.debug('Interrupt clicked');
                }
            }
        ]
    });
}

export function displayOpenMatlabNotification () : void {
    Notification.info('Opening MATLAB...', { autoClose: 2000 });
}

export function displayConversionNotification (
    data: any,
    comm: ICommunicationChannel,
    timeoutInMS: number = 50000) : PromiseDelegate<ReadonlyJSONValue> {
    const conversionPromise = new PromiseDelegate<ReadonlyJSONValue>();

    Notification.promise(conversionPromise.promise, {
        pending: {
            message: ((): string => {
                if (
                    sendConvertRequest(data, comm)
                ) {
                    console.debug('Successfully sent convert request to MATLAB');
                } else {
                    console.error('Failed to send convert request to MATLAB');
                }

                setTimeout(() => {
                    // If the conversion takes more than timeout, throw error
                    if (conversionPromise) {
                        conversionPromise.reject({
                            reason: 'Conversion process timed out'
                        });
                    }
                }, timeoutInMS);

                return 'Waiting for conversion to complete...';
            })(),
            options: { autoClose: false }
        },
        success: {
            message: (): string => {
                return 'Conversion successful';
            },
            options: { autoClose: 3000 }
        },
        error: { message: () => 'Failed conversion' }
    });

    return conversionPromise;
}
