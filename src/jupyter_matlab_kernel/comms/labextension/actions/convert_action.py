# Copyright 2026 The MathWorks, Inc.

from . import ActionCommand, ActionTypes
from pathlib import Path
import base64
import json
import re
import struct
import uuid


_PLACEHOLDER_TEXT = "Please rerun this cell to see output"


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
        """Fetches code to convert generated .mlx file to live script .m and deletes the .mlx file

        Args:
            mlx_filepath (str): Path to generated .mlx file

        Returns:
            str: MATLAB code which converts .mlx to live script .m and deletes .mlx file
        """

        return f"editor = matlab.desktop.editor.openDocument('{mlx_livecode_filepath}',Visible=0); editor.Opened; editor.saveAs('{m_livecode_filepath}');editor.closeNoPrompt; clear editor;delete('{mlx_livecode_filepath}');"

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

    # --- Rich .m conversion methods (ipynb → rich .m without MATLAB) ---

    def _generate_output_id(self):
        return uuid.uuid4().hex[:8]

    def _get_cell_source(self, cell):
        source = cell["source"]
        if isinstance(source, list):
            return "".join(source)
        return source

    def _contains_html(self, text):
        return bool(re.search(r"<html[\s>]", text, re.IGNORECASE))

    def _placeholder_output(self):
        return {
            "dataType": "warning",
            "outputData": {"text": _PLACEHOLDER_TEXT},
        }

    def _compute_png_dimensions(self, b64_data):
        raw = base64.b64decode(b64_data)
        width = struct.unpack(">I", raw[16:20])[0]
        height = struct.unpack(">I", raw[20:24])[0]
        return width, height

    def _classify_output(self, output, compute_dimensions=False):
        output_type = output["output_type"]

        if output_type == "stream":
            text = output.get("text", "")
            if isinstance(text, list):
                text = "".join(text)

            if output.get("name") == "stderr":
                return {
                    "dataType": "error",
                    "outputData": {"errorType": "runtime", "text": text},
                }

            if output.get("name") == "stdout":
                return {
                    "dataType": "text",
                    "outputData": {"text": text, "truncated": False},
                }

        if output_type in ("execute_result", "display_data"):
            data = output.get("data", {})

            if "text/plain" in data:
                text_plain = data["text/plain"]
                if isinstance(text_plain, list):
                    text_plain = "".join(text_plain)

                if self._contains_html(text_plain):
                    return self._placeholder_output()

                match = re.match(r"^(\w+)\s*=\s*(.+)$", text_plain.strip())
                if match:
                    return {
                        "dataType": "textualVariable",
                        "outputData": {
                            "name": match.group(1),
                            "value": match.group(2),
                        },
                    }
                else:
                    return {
                        "dataType": "text",
                        "outputData": {"text": text_plain, "truncated": False},
                    }

            if "text/latex" in data:
                latex = data["text/latex"]
                if isinstance(latex, list):
                    latex = "".join(latex)
                latex = latex.strip().strip("$")
                name, _, value = latex.partition(" =")
                return {
                    "dataType": "symbolic",
                    "outputData": {"name": name, "value": value},
                }

            if "image/png" in data:
                png_b64 = data["image/png"]
                if isinstance(png_b64, list):
                    png_b64 = "".join(png_b64)
                png_b64 = png_b64.strip()
                output_data = {"dataUri": f"data:image/png;base64,{png_b64}"}
                if compute_dimensions:
                    width, height = self._compute_png_dimensions(png_b64)
                    output_data["height"] = height
                    output_data["width"] = width
                return {
                    "dataType": "image",
                    "outputData": output_data,
                }

            if "text/html" in data:
                return self._placeholder_output()

        return self._placeholder_output()

    def _serialize_json(self, obj):
        return json.dumps(obj, separators=(",", ":")).replace("/", "\\/")

    def _convert_notebook(self, notebook, include_outputs=False):
        cells = notebook["cells"]

        body_lines = []
        outputs_data = []

        for cell_idx, cell in enumerate(cells):
            cell_type = cell["cell_type"]

            if cell_type == "code":
                source = self._get_cell_source(cell)

                output_ids = []
                if include_outputs:
                    cell_outputs = cell.get("outputs", [])

                    for output in cell_outputs:
                        classified = self._classify_output(output)
                        if classified is not None:
                            oid = self._generate_output_id()
                            output_ids.append(oid)
                            outputs_data.append((oid, classified))

                source_lines = source.split("\n")
                if source_lines and source_lines[-1] == "":
                    source_lines = source_lines[:-1]

                if not source_lines:
                    source_lines = [""]

                if output_ids:
                    markers = " ".join(f"%[output:{oid}]" for oid in output_ids)
                    source_lines[-1] = source_lines[-1] + " " + markers

                body_lines.extend(source_lines)

            elif cell_type == "markdown":
                source = self._get_cell_source(cell)
                for line in source.split("\n"):
                    body_lines.append(f"%[text] {line}")

            if cell_idx < len(cells) - 1:
                body_lines.append("%%")

        appendix_lines = []
        appendix_lines.append("")
        appendix_lines.append('%[appendix]{"version":"1.0"}')
        appendix_lines.append("%---")
        appendix_lines.append("%[metadata:view]")
        appendix_lines.append('%   data: {"layout":"onright"}')

        if include_outputs:
            for oid, data_dict in outputs_data:
                appendix_lines.append("%---")
                appendix_lines.append(f"%[output:{oid}]")
                appendix_lines.append(f"%   data: {self._serialize_json(data_dict)}")

        appendix_lines.append("%---")
        appendix_lines.append("")

        return "\n".join(body_lines + appendix_lines)

    def convert(self, input_path, output_path, include_outputs=False):
        """Convert a Jupyter notebook (.ipynb) to rich m format (.m).

        Args:
            input_path: Path to the input .ipynb file.
            output_path: Path to write the output .m file.
            include_outputs: Whether to include cell outputs in the conversion.
        """
        with open(input_path, "r") as f:
            notebook = json.load(f)

        result = self._convert_notebook(notebook, include_outputs)

        with open(output_path, "w") as f:
            f.write(result)

    # --- End rich .m conversion methods ---

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
            f"Received IPYNB file path for conversion: {ipynb_filepath}.  Live Script file path: {livecode_filepath}"
        )

        try:
            status = await self.kernel.mwi_comm_helper.fetch_matlab_proxy_status()

            if self._is_matlab_version_25a_or_later(status.matlab_version):
                # Use Python-based converter directly (ipynb → rich .m)
                pwd = Path.cwd()
                m_livecode_filepath = pwd / livecode_filepath.with_suffix(".m")

                self.convert(
                    str(ipynb_filepath),
                    str(m_livecode_filepath),
                    include_outputs=True,
                )

                self.log.debug(
                    f"Successfully converted {ipynb_filepath} to rich .m at {m_livecode_filepath}"
                )

                comm.send(
                    {
                        "action": ActionTypes.CONVERT.value,
                        "liveCodeFilePath": str(m_livecode_filepath),
                        "error": None,
                    }
                )

            else:
                # Use MATLAB-based conversion (ipynb → mlx)
                code = self.get_code(ipynb_filepath, livecode_filepath)

                # TODO: This eval request to clear console can be removed once the kernel's interrupt_request or related interrupt
                # infrastructure is enhanced to handle stack output of a recent interrupt request. Until then, always send a clc; before
                # conversion to ensure any previous interrupt stack output is cleared from the console.
                _ = await self.kernel.mwi_comm_helper.send_eval_request_to_matlab(
                    "clc;"
                )

                eval_response = (
                    await self.kernel.mwi_comm_helper.send_eval_request_to_matlab(code)
                )

                self.log.debug(f"Convert action eval response: {eval_response}")

                if eval_response["isError"]:
                    self.log.error(
                        f"Failed to convert file with error:{eval_response['responseStr']}"
                    )
                    comm.send(
                        {
                            "action": ActionTypes.CONVERT.value,
                            "liveCodeFilePath": None,
                            "error": f"Failed to convert .ipynb to .mlx with error: {eval_response['responseStr']}",
                        }
                    )
                    return

                self.log.debug(
                    f"Successfully generated Live Script file at {str(livecode_filepath)}"
                )

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
