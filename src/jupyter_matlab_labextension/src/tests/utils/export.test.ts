import { exportHandler } from '../../utils/export';
// import { NotebookInfo } from '../../utils/notebook';
import {
    displayKernelBusyNotification,
    displayUserSigninNotification
} from '../../utils/notifications';
import {
    getFileNameForConversion
} from '../../utils/file';
import {
    convertToLiveCode,
    startMatlab,
    waitForMatlabToStart,
    waitForUserToSignin
} from '../../utils/matlab';
import { openMatlabButtonHandler } from '../../utils/commands';
import { Notification } from '@jupyterlab/apputils';
import { PromiseDelegate, ReadonlyJSONValue } from '@lumino/coreutils';

// --------------------
// MOCKS
// --------------------

jest.mock('../../utils/notifications', () => ({
    displayKernelBusyNotification: jest.fn(),
    displayUserSigninNotification: jest.fn()
}));
// const mockedDisplayKernelBusyNotification = displayKernelBusyNotification as jest.MockedFunction<typeof displayKernelBusyNotification>;
const mockedDisplayUserSigninNotification = displayUserSigninNotification as jest.MockedFunction<typeof displayUserSigninNotification>;

jest.mock('../../utils/file', () => ({
    getFileNameForConversion: jest.fn()
}));
// Typecast to a jest mocked function to be able to return custom values in tests
const mockedGetFileNameForConversion = getFileNameForConversion as jest.MockedFunction<typeof getFileNameForConversion>;

jest.mock('../../utils/matlab', () => ({
    convertToLiveCode: jest.fn(),
    startMatlab: jest.fn(),
    waitForMatlabToStart: jest.fn(),
    waitForUserToSignin: jest.fn()
}));
const mockedStartMatlab = startMatlab as jest.MockedFunction<typeof startMatlab>;
const mockedConvertToLiveCode = convertToLiveCode as jest.MockedFunction<typeof convertToLiveCode>;
const mockedWaitForMatlabToStart = waitForMatlabToStart as jest.MockedFunction<typeof waitForMatlabToStart>;
const mockedWaitForUserToSignin = waitForUserToSignin as jest.MockedFunction<typeof waitForUserToSignin>;

jest.mock('../../utils/commands', () => ({
    openMatlabButtonHandler: jest.fn()
}));
const mockedOpenMatlabButtonHandler = openMatlabButtonHandler as jest.MockedFunction<typeof openMatlabButtonHandler>;

jest.mock('@jupyterlab/apputils', () => ({
    Notification: {
        info: jest.fn()
    }
}));

describe('exportHandler', () => {
    let commService: any;
    let panel: any;

    beforeEach(() => {
        jest.clearAllMocks();

        commService = {
            getComm: jest.fn().mockResolvedValue({}) // mock comm object
        };

        panel = {
            id: 'notebook-123',
            context: { path: 'abc.ipynb' },
            sessionContext: {
                kernelDisplayName: 'MATLAB Kernel',
                session: {
                    kernel: {
                        status: 'busy'
                    }
                }
            }
        };
    });

    it('logs error when panel is null and returns early', async () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await exportHandler(commService, null);

        expect(errorSpy).toHaveBeenCalledWith('No active notebook to export');
        expect(commService.getComm).not.toHaveBeenCalled();

        errorSpy.mockRestore();
    });

    it('shows busy notification when notebook is busy', async () => {
        mockedGetFileNameForConversion.mockResolvedValue('file.mlx');
        mockedStartMatlab.mockResolvedValue({ isLicensed: true });

        await exportHandler(commService, panel);

        expect(displayKernelBusyNotification).toHaveBeenCalled();
    });

    it('returns early if getFileNameForConversion returns null', async () => {
        mockedGetFileNameForConversion.mockResolvedValue(null);

        await exportHandler(commService, panel);

        expect(mockedStartMatlab).not.toHaveBeenCalled();
        expect(mockedConvertToLiveCode).not.toHaveBeenCalled();
        expect(Notification.info).not.toHaveBeenCalled();
    });

    it('handles MATLAB not licensed flow and closes window after user sign in', async () => {
        const fakeWindow = { closed: false, close: jest.fn() } as unknown as Window;

        mockedStartMatlab.mockResolvedValue({ isLicensed: false });

        mockedDisplayUserSigninNotification.mockResolvedValue({
            promise: Promise.resolve({})
        } as PromiseDelegate<ReadonlyJSONValue>); // dummy promise which resolves to a PromiseDelegate.

        mockedOpenMatlabButtonHandler.mockReturnValue(fakeWindow);

        mockedGetFileNameForConversion.mockResolvedValue('file.mlx');
        mockedWaitForMatlabToStart.mockResolvedValue(undefined);
        mockedWaitForUserToSignin.mockResolvedValue(undefined);

        await exportHandler(commService, panel);

        expect(openMatlabButtonHandler).toHaveBeenCalled();
        expect(fakeWindow.close).toHaveBeenCalled();
    });


    it('executes full conversion flow', async () => {
        mockedGetFileNameForConversion.mockResolvedValue('file.mlx');
        mockedStartMatlab.mockResolvedValue({ isLicensed: true });
        mockedWaitForMatlabToStart.mockResolvedValue(undefined);

        await exportHandler(commService, panel);

        expect(startMatlab).toHaveBeenCalled();
        expect(waitForMatlabToStart).toHaveBeenCalled();
        expect(convertToLiveCode).toHaveBeenCalledWith(panel, expect.any(Object), 'file.mlx');
        expect(Notification.info).toHaveBeenCalledWith('File file.mlx ready', { autoClose: 2000 });
    });
});
