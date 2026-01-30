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
        if "liveCodeFilePath" not in data:
            raise ValueError(
                "Invalid data for CheckFileExistsAction: 'liveCodeFilePath' is required."
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

        file_to_check = data.get("liveCodeFilePath", "")

        self.log.debug(f"File to check if it exists: {file_to_check}")

        if not file_to_check:
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
            comm.send(
                {
                    "action": ActionTypes.CHECK_FILE_EXISTS.value,
                    "exists": Path(file_to_check).expanduser().resolve().exists(),
                    "error": None,
                }
            )
            self.log.debug(f"File exists at {Path(file_to_check)}")
