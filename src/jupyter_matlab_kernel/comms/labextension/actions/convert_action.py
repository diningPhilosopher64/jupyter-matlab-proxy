# Copyright 2026 The MathWorks, Inc.

from . import ActionCommand, ActionTypes
from pathlib import Path
import re


class ConvertAction(ActionCommand):
    def __init__(self, kernel):
        self.kernel = kernel
        self.log = kernel.log

    def get_code(self, ipynb_filepath, livecode_filepath):
        """Fetches code specific to Convert action.

        Args:
            ipynb_file_path (str): IPYNB file path  to be converted.
            mlx_file_path (str): MLX file path where the converted file will be generated.

        Returns:
            str: MATLAB code which converts the IPYNB file to MLX file.
        """
        return f'ipynb2mlx("{ipynb_filepath}","{livecode_filepath}")'

    def _get_code_mlx_to_m_conversion(self, mlx_livecode_filepath, m_livecode_filepath):
        """Fetches code to convert generated .mlx file to live code .m and deletes the .mlx file

        Args:
            mlx_filepath (str): Path to generated .mlx file

        Returns:
            str: MATLAB code which converts .mlx to live code .m and deletes .mlx file
        """

        # return f"editor = matlab.desktop.editor.openDocument('{livecode_filepath}',Visible=1); editor.Opened; editor.saveAs('{rich_m_filepath}'); delete('{livecode_filepath}');"
        return f"editor = matlab.desktop.editor.openDocument('{mlx_livecode_filepath}',Visible=0); editor.Opened; editor.saveAs('{m_livecode_filepath}');editor.closeNoPrompt; clear editor;"

    def _is_matlab_version_25a_or_later(self, version) -> bool:
        """Checks if MATLAB version is 25a or later"""
        if not version:
            return False

        m = re.match(r"^R(\d{4})([ab])$", version)
        if not m:
            return False

        year = int(m.group(1))
        release = m.group(2)

        if year >= 2025 and (release == "a" or release == "b"):
            return True

        return False

    def validate_data(self, data):
        if "ipynbFilePath" not in data or "liveCodeFilePath" not in data:
            raise ValueError(
                "Invalid data for ConvertAction: 'ipynbFilePath' and 'liveCodeFilePath' are required."
            )

    async def execute(self, comm, data):
        """Executes the Convert action based on the data provided and returns
        result to the labextension using the comm channel.

        Args:
            comm (ipykernel.comm.Comm): IPYKernels' Communication object
            data (dict): data used by this action
        """

        try:
            self.validate_data(data)

        except ValueError as ve:
            self.log.error(f"Convert action validation failed with error: {ve}")
            comm.send(
                {
                    "action": ActionTypes.CONVERT.value,
                    "liveCodeFilePath": None,
                    "error": str(ve),
                }
            )
            return

        # For Conversion, we need to ensure that MATLAB is up and running.
        # This check is not performed here as it already done by the labextension with the MATLAB_STATUS action, before
        # sending this convert request to the kernel.
        ipynb_filepath = Path(data["ipynbFilePath"]).expanduser()
        livecode_filepath = Path(data["liveCodeFilePath"]).expanduser()
        self.log.debug(
            f"Received IPYNB file path for conversion: {ipynb_filepath}.  Live code file path: {livecode_filepath}"
        )

        try:
            # First convert from .ipynb to live code .mlx
            code = self.get_code(ipynb_filepath, livecode_filepath)

            # TODO: This eval request to clear console can be removed once the kernel's interrupt_request or related interrupt
            # infrastructure is enhanced to handle stack output of a recent interrupt request. Until then, always send a clc; before
            # conversion to ensure any previous interrupt stack output is cleared from the console.
            _ = await self.kernel.mwi_comm_helper.send_eval_request_to_matlab("clc;")

            eval_response = (
                await self.kernel.mwi_comm_helper.send_eval_request_to_matlab(code)
            )

            self.log.debug(f"Convert action eval response: {eval_response}")

            if eval_response["isError"]:
                self.log.error(
                    f"Failed to convert file with error:{eval_response['response_str']}"
                )
                comm.send(
                    {
                        "action": ActionTypes.CONVERT.value,
                        "liveCodeFilePath": None,
                        "error": f"Failed to convert from .mlx to live code .m with error: {eval_response['responseStr']}",
                    }
                )
                return

            self.log.debug(
                f"Successfully generated Live Code file at {str(livecode_filepath)}"
            )

            status = await self.kernel.mwi_comm_helper.fetch_matlab_proxy_status()

            # Additionally convert from .mlx to live code .m is required (for 25a or later versions)
            if self._is_matlab_version_25a_or_later(status.matlab_version):
                pwd = Path.cwd()
                mlx_livecode_filepath, m_livecode_filepath = (
                    livecode_filepath,
                    livecode_filepath.with_suffix(".m"),
                )

                mlx_livecode_filepath = pwd / mlx_livecode_filepath
                m_livecode_filepath = pwd / m_livecode_filepath

                code = self._get_code_mlx_to_m_conversion(
                    mlx_livecode_filepath, m_livecode_filepath
                )
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
                            "liveCodeFilePath": None,
                            "error": f"Failed to convert from .mlx to live code .m with error: {eval_response['responseStr']}",
                        }
                    )

                else:
                    comm.send(
                        {
                            "action": ActionTypes.CONVERT.value,
                            "liveCodeFilePath": str(m_livecode_filepath),
                            "error": None,
                        }
                    )

            else:
                comm.send(
                    {
                        "action": ActionTypes.CONVERT.value,
                        "liveCodeFilePath": str(livecode_filepath),
                        "error": None,
                    }
                )

        except Exception as err:
            self.log.error(f"Convert action failed with error: {err}")
            comm.send(
                {
                    "action": ActionTypes.CONVERT.value,
                    "liveCodeFilePath": None,
                    "error": str(err),
                }
            )
