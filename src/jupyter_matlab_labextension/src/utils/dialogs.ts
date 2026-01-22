import { showDialog, Dialog, InputDialog } from '@jupyterlab/apputils';
import { PathExt } from '@jupyterlab/coreutils';

export async function getNewFileNameDialog (
    currentFileName: string,
    mlxFileName: string
): Promise<string | null> {
    const result = await showDialog({
        title: `"${mlxFileName}" already exists.`,
        body: `A file named "${mlxFileName}" already exists in the folder. Choose a new name or replace it to overwrite its current contents`,
        buttons: [
            Dialog.cancelButton(),
            Dialog.okButton({ label: 'Replace' }),
            Dialog.okButton({ label: 'New Name' })
        ]
    });

    if (result.button.label === 'New Name') {
        const newNameResult = await InputDialog.getText({
            title: 'New File Name',
            label: 'Choose a new name for the file. Do not include a file extension',
            placeholder: 'Enter file name'
        });

        if (newNameResult.button.accept && newNameResult.value) {
            console.debug(
                'new file name is ',
                newNameResult.value,
                ' currentfilename is ',
                currentFileName
            );

            return `${newNameResult.value}.mlx`;
        } else {
            // User cancelled, no need to proceed further
            return null;
        }
    } else if (result.button.label === 'Replace') {
        // User chose to replace the existing file
        const mlxFileNameWithoutExtension = PathExt.basename(
            currentFileName,
            PathExt.extname(currentFileName)
        );
        return `${mlxFileNameWithoutExtension}.mlx`;
    } else {
        return null; // User cancelled, no need to proceed further
    }
}

export async function showMatlabKernelIsBusyDialog (): Promise<void> {
    await showDialog({
        title: 'MATLAB Kernel is Busy',
        body: 'The MATLAB kernel is currently busy. Please wait for the current operation to complete.',
        buttons: [Dialog.okButton()]
    });
}
