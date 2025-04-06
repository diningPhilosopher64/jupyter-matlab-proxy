# Copyright 2025 The MathWorks, Inc.

from . import ActionCommand, ActionTypes
from pathlib import Path


class ConvertAction(ActionCommand):
    def __init__(self, kernel):
        self.kernel = kernel
        self.log = kernel.log

    def get_code(self, ipynb_file_path, mlx_file_path):
        """Fetches code specific to Convert action.

        Args:
            ipynb_file_path (str): IPYNB file path  to be converted.
            mlx_file_path (str): MLX file path where the converted file will be generated.

        Returns:
            str: MATLAB code which converts the IPYNB file to MLX file.
        """
        return f"ipynb2mlx {ipynb_file_path} {mlx_file_path}"

    async def execute(self, comm, data):
        """Executes the Convert action based on the data provided and returns
        result to the labextension using the comm channel.

        Args:
            comm (ipykernel.comm.Comm): IPYKernels' Communication object
            data (dict): data used by this action
        """

        # For Conversion, we need to ensure that MATLAB is up and running.
        # This check is not performed here as it already done by the labextension before
        # sending the request to the kernel.

        ipynb_file_path = Path(data["data"]["ipynbFilePath"]).expanduser()
        mlx_file_path = Path(data["data"]["mlxFilePath"]).expanduser()

        self.log.debug(f"Received IPYNB file for conversion: {ipynb_file_path}")
        self.log.debug(f"MLX file will be generated at:{mlx_file_path}")

        try:
            code = self.get_code(ipynb_file_path, mlx_file_path)
            eval_response = (
                await self.kernel.mwi_comm_helper.send_eval_request_to_matlab(code)
            )

            if eval_response["isError"]:
                self.log.error(
                    f"Failed to convert file with error:{eval_response['response_str']}"
                )
                comm.send(
                    {
                        "action": ActionTypes.CONVERT.value,
                        "mlxFilePath": None,
                        "error": eval_response["responseStr"],
                    }
                )

            else:
                self.log.debug("Successfully converted IPYNB file.")
                comm.send(
                    {
                        "action": ActionTypes.CONVERT.value,
                        "mlxFilePath": str(mlx_file_path),
                        "error": None,
                    }
                )

        except Exception as err:
            self.log.error(f"Convert action failed with error: {err}")
            comm.send(
                {
                    "action": ActionTypes.CONVERT.value,
                    "mlxFilePath": None,
                    "error": str(err),
                }
            )
