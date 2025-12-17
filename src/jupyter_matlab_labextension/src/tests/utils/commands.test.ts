import {
    openMatlabButtonHandler,
    openAsLiveCodeInMatlabButtonHandler
} from '../../utils/commands';
import { Notification } from '@jupyterlab/apputils';

import { getFileNameForConversion } from '../../utils/file';
import {
    getMatlabUrl,
    startMatlab,
    waitForMatlabToStart,
    convertToLiveCodeAndOpenMatlab,
    waitForUserToSignin
} from '../../utils/matlab';
import {
    displayKernelBusyNotification,
    displayUserSigninNotification
} from '../../utils/notifications';

// --------------------
// Mocks
// --------------------
jest.mock('../../utils/file', () => ({
    getFileNameForConversion: jest.fn()
}));
// Typecast to a jest mocked function to be able to return custom values in tests
const mockedGetFileNameForConversion = getFileNameForConversion as jest.MockedFunction<typeof getFileNameForConversion>;

jest.mock('../../utils/matlab', () => ({
    getMatlabUrl: jest.fn(),
    startMatlab: jest.fn(),
    waitForMatlabToStart: jest.fn(),
    convertToLiveCodeAndOpenMatlab: jest.fn(),
    waitForUserToSignin: jest.fn()
}));
const mockedGetMatlabUrl = getMatlabUrl as jest.MockedFunction<typeof getMatlabUrl>;
const mockedStartMatlab = startMatlab as jest.MockedFunction<typeof startMatlab>;
const mockedConvertToLiveCodeAndOpenMatlab = convertToLiveCodeAndOpenMatlab as jest.MockedFunction<typeof convertToLiveCodeAndOpenMatlab>;
const mockedWaitForMatlabToStart = waitForMatlabToStart as jest.MockedFunction<typeof waitForMatlabToStart>;
const mockedWaitForUserToSignin = waitForUserToSignin as jest.MockedFunction<typeof waitForUserToSignin>;

jest.mock('@jupyterlab/apputils', () => ({
    Notification: {
        info: jest.fn()
    }
}));

jest.mock('../../utils/notifications', () => ({
    displayKernelBusyNotification: jest.fn(),
    displayUserSigninNotification: jest.fn()
}));
const mockedDisplayUserSigninNotification = displayUserSigninNotification as jest.MockedFunction<typeof displayUserSigninNotification>;
const mockedDisplayKernelBqusyNotification = displayKernelBusyNotification as jest.MockedFunction<typeof displayKernelBusyNotification>;

// const mockedGetFileName = getFileNameForConversion as jest.MockedFunction<typeof getFileNameForConversion>;
// const mockedStartMatlab = startMatlab as jest.MockedFunction<typeof startMatlab>;
// const mockedConvertLC = convertToLiveCodeAndOpenMatlab as jest.MockedFunction<typeof convertToLiveCodeAndOpenMatlab>;
// const mockedWaitForSignin = waitForUserToSignin as jest.MockedFunction<typeof waitForUserToSignin>;
// const mockedWaitForMatlab = waitForMatlabToStart as jest.MockedFunction<typeof waitForMatlabToStart>;
// const mockedDisplaySignin = displayUserSigninNotification as jest.MockedFunction<typeof displayUserSigninNotification>;
// const mockedBusyNotification = displayKernelBusyNotification as jest.MockedFunction<typeof displayKernelBusyNotification>;

// ------------------------------
// Test Suite
// ------------------------------
describe('Commands module', () => {
    let panel: any;
    let commService: any;

    beforeEach(() => {
        jest.clearAllMocks();

        commService = {
            getComm: jest.fn().mockResolvedValue({})
        };

        // DEFAULT: MATLAB kernel, idle, not busy
        panel = {
            id: 'notebook-123',
            context: { path: 'abc.ipynb' },
            sessionContext: {
                kernelDisplayName: 'MATLAB Kernel',
                session: {
                    kernel: {
                        status: 'idle'
                    }
                }
            }
        };
    });

    it('openMatlabButtonHandler opens MATLAB in new tab', () => {
        const mockWindowOpen = jest.fn();
        (global as any).window = { open: mockWindowOpen };
        mockWindowOpen.mockReturnValue({});
        const matlabUrl = 'http://localhost:8888/matlab/default/';
        mockedGetMatlabUrl.mockReturnValue(matlabUrl);

        openMatlabButtonHandler();

        expect(mockWindowOpen).toHaveBeenCalledTimes(1);
        expect(mockWindowOpen).toHaveBeenCalledWith(matlabUrl, '_blank');
    });

    it('calls busy notification when NotebookInfo detects busy kernel', async () => {
    // Overwrite kernel status so NotebookInfo reports busy
        panel.sessionContext.session.kernel.status = 'busy';
        mockedGetFileNameForConversion.mockResolvedValue('file.mlx');
        mockedStartMatlab.mockResolvedValue({ isLicensed: true });

        await openAsLiveCodeInMatlabButtonHandler(panel, commService);

        expect(mockedDisplayKernelBqusyNotification).toHaveBeenCalled();
    });

    it('returns early when getFileNameForConversion returns null', async () => {
        mockedGetFileNameForConversion.mockResolvedValue(null);

        await openAsLiveCodeInMatlabButtonHandler(panel, commService);

        expect(mockedStartMatlab).not.toHaveBeenCalled();
        expect(mockedConvertToLiveCodeAndOpenMatlab).not.toHaveBeenCalled();
        expect(Notification.info).not.toHaveBeenCalled();
    });

    it('handles MATLAB not licensed: signin flow + window open + conversion', async () => {
        panel.sessionContext.session.kernel.status = 'idle';
        mockedGetFileNameForConversion.mockResolvedValue('file.mlx');
        mockedStartMatlab.mockResolvedValue({ isLicensed: false });
        mockedDisplayUserSigninNotification.mockResolvedValue({} as any);
        mockedWaitForMatlabToStart.mockResolvedValue();
        mockedWaitForUserToSignin.mockResolvedValue();

        const mockWindowOpen = jest.fn();
        (global as any).window = { open: mockWindowOpen };
        mockWindowOpen.mockReturnValue({});
        const matlabUrl = 'http://localhost:8888/matlab/default/';
        mockedGetMatlabUrl.mockReturnValue(matlabUrl);

        await openAsLiveCodeInMatlabButtonHandler(panel, commService);

        expect(mockedDisplayUserSigninNotification).toHaveBeenCalled();
        expect(mockedWaitForUserToSignin).toHaveBeenCalled();
        expect(mockedWaitForMatlabToStart).toHaveBeenCalled();
        expect(mockedConvertToLiveCodeAndOpenMatlab).toHaveBeenCalled();
    });

    it('handles MATLAB licensed: waits + converts', async () => {
        panel.sessionContext.session.kernel.status = 'idle';
        mockedGetFileNameForConversion.mockResolvedValue('file.mlx');
        mockedStartMatlab.mockResolvedValue({ isLicensed: true });
        mockedWaitForMatlabToStart.mockResolvedValue();

        const mockWindowOpen = jest.fn();
        (global as any).window = { open: mockWindowOpen };
        mockWindowOpen.mockReturnValue({});
        const matlabUrl = 'http://localhost:8888/matlab/default/';
        mockedGetMatlabUrl.mockReturnValue(matlabUrl);

        await openAsLiveCodeInMatlabButtonHandler(panel, commService);

        expect(mockedDisplayUserSigninNotification).not.toHaveBeenCalled();
        expect(mockedWaitForUserToSignin).not.toHaveBeenCalled();
        expect(mockedWaitForMatlabToStart).toHaveBeenCalled();
        expect(mockedConvertToLiveCodeAndOpenMatlab).toHaveBeenCalled();
    });
});
