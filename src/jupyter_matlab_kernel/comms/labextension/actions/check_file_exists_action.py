# Copyright 2026 The MathWorks, Inc.

from . import ActionCommand, ActionTypes
from pathlib import Path


class CheckFileExistsAction(ActionCommand):
    def __init__(self, kernel):
        self.kernel = kernel
        self.log = kernel.log

    def get_code(self):
        pass

    def validate_data(self, data):
        if "ipynbFilePath" not in data:
            raise ValueError(
                "Invalid data for CheckFileExistsAction: 'ipynbFilePath' is required."
            )

    async def execute(self, comm, data):
        """Starts MATLAB proxy
        Args:
            comm (ipykernel.comm.Comm): IPYKernels' Commuincation object
        """
        try:
            self.validate_data(data)

        except Exception as err:
            self.log.error(f"CheckFileExists action failed with error: {err}")
            comm.send(
                {
                    "action": ActionTypes.CHECK_FILE_EXISTS.value,
                    "exists": False,
                    "error": str(err),
                }
            )
            return

        ipynb_filepath = data.get("ipynbFilePath", "")

        self.log.debug(f"File to check if it exists: {ipynb_filepath}")

        if not ipynb_filepath:
            error = Exception("No file path provided for checking if it exists")
            self.log.error(str(error))
            comm.send(
                {
                    "action": ActionTypes.CHECK_FILE_EXISTS.value,
                    "exists": False,
                    "error": str(error),
                }
            )

        else:
            ipynb_filepath = Path(ipynb_filepath)
            livecode_mlx_filepath = ipynb_filepath.parent / (
                ipynb_filepath.stem + ".mlx"
            )
            livecode_m_filepath = ipynb_filepath.parent / (ipynb_filepath.stem + ".m")
            exists = livecode_mlx_filepath.exists() or livecode_m_filepath.exists()

            self.log.debug(
                f"LiveCode file at {livecode_mlx_filepath} or {livecode_m_filepath} exists: {exists}"
            )

            comm.send(
                {
                    "action": ActionTypes.CHECK_FILE_EXISTS.value,
                    "exists": exists,
                    "error": None,
                }
            )
