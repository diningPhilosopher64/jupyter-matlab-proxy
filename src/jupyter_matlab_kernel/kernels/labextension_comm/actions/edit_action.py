# Copyright 2025 The MathWorks, Inc.

from . import ActionCommand, ActionTypes
from pathlib import Path
import asyncio
from jupyter_matlab_kernel.mwi_comm_helpers import MWICommHelper


class EditAction(ActionCommand):
    def __init__(self, kernel):
        self.kernel = kernel
        self.log = kernel.log

    def get_code(self, mlx_file_path):
        """Fetches code specific to Edit action.

        Args:
            mlx_file_path (str): MLX file path to be opened in MATLAB.

        Returns:
            str: MATLAB code which opens the MLX file in MATLAB.
        """
        return f"edit {mlx_file_path}"

    async def execute(self, comm, data):
        """Executes the Edit action based on the data provided and returns
        result to the labextension using the comm channel.

        Args:
            comm (ipykernel.comm.Comm): IPYKernels' Commuincation object
            data (dict): data used by this action

        Raises:
            err: FileNotFoundError error if no MLX file path is supplied
        """

        # For Edit, we need to ensure that MATLAB is up and running.
        # This check is not performed here as it already done by the labextension before
        # sending the request to the kernel.

        client_type_code = "connector.internal.getClientType"
        data = data["data"]

        if not "mlxFilePath" in data:
            err = FileNotFoundError("Need mlx file to open...")
            # Inform lab extension about the error
            comm.send({"action": ActionTypes.EDIT.value, "error": str(err)})
            raise err

        mlx_file_path = Path(data["mlxFilePath"]).expanduser()
        self.log.info(f"Received MLX file path for editing is {mlx_file_path}")

        # max time it should take for the client type to be set on the jsd
        # Is this enough ?
        time_taken, time_out = 0, 30
        while True:
            await asyncio.sleep(1)
            # Keep sending eval execution requests till client type is set
            try:
                eval_response = (
                    await self.kernel.mwi_comm_helper.send_eval_request_to_matlab(
                        client_type_code
                    )
                )
                self.log.debug(
                    f"The output received for client type request {eval_response}"
                )
                if eval_response["isError"]:
                    self.log.error(
                        f"Failed to check client type :{eval_response['responseStr']}"
                    )

                elif "jsd_rmt_tmw" in eval_response["responseStr"]:
                    self.log.debug(f"Successfully set the client type")
                    break

            except Exception as err:
                self.log.error(f"Edit action failed with error: {err}")
                comm.send({"action": ActionTypes.EDIT.value, "error": str(err)})

            finally:
                time_taken += 1
                if time_taken > time_out:
                    err = TimeoutError(
                        f"Failed to set client type within {time_out} seconds."
                    )
                    self.log.error(err)
                    comm.send({"action": ActionTypes.EDIT.value, "error": str(err)})
                    return

        # Client type is set on the jsd, now send eval request to open mlx file
        code = self.get_code(mlx_file_path)
        # Sleeping for a second after client type is set for always ensuring JS tabs open
        # and not java ones
        await asyncio.sleep(1)

        try:
            eval_response = (
                await self.kernel.mwi_comm_helper.send_eval_request_to_matlab(code)
            )
            if eval_response["isError"]:
                self.log.error(
                    f"Failed to edit file with error:{eval_response['response_str']}"
                )
                comm.send(
                    {
                        "action": ActionTypes.EDIT.value,
                        "error": eval_response["responseStr"],
                    }
                )

            else:
                comm.send({"action": ActionTypes.EDIT.value, "error": None})
                self.log.info("Edit action successful")

        except Exception as err:
            self.log.error(f"Edit action failed with error: {err}")
            comm.send({"action": ActionTypes.EDIT.value, "error": str(err)})
