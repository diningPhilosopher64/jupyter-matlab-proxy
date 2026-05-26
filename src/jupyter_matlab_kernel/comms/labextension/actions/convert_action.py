# Copyright 2026 The MathWorks, Inc.

from . import ActionCommand, ActionTypes
from pathlib import Path
import base64
import json
import re
import uuid

_PLACEHOLDER_TEXT = "Please rerun this cell to see output"


class ConvertAction(ActionCommand):
    def __init__(self, kernel):
        self.kernel = kernel
        self.log = kernel.log

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

    def _escape_html_tags(self, text):
        """Escape < and > in HTML tags. e.g. <div> -> \\<div\\>"""
        return re.sub(
            r"(</?[a-zA-Z][^>]*>)",
            lambda m: m.group(0).replace("<", "\\<").replace(">", "\\>"),
            text,
        )

    def _escape_markdown_syntax(self, text):
        """Escape markdown syntax that conflicts with MATLAB's rich .m format.

        Handles:
          - HTML tags: <tag> -> \\<tag\\>
          - Horizontal rules: --- -> \\---
          - Block quotes: > text -> \\> text
        """
        # Escape HTML tags first
        text = self._escape_html_tags(text)

        # Escape horizontal rules (three or more dashes on their own line)
        if re.match(r"^-{3,}$", text.strip()):
            text = "\\" + text

        # Escape block quotes (lines starting with "> ", possibly after whitespace)
        text = re.sub(r"^(\s*)>", r"\1\\>", text)

        return text

    def _placeholder_output(self):
        return {
            "dataType": "warning",
            "outputData": {"text": _PLACEHOLDER_TEXT},
        }

    def _split_source_lines(self, source):
        lines = source.split("\n")
        if lines and lines[-1] == "":
            lines = lines[:-1]
        if not lines:
            lines = [""]
        return lines

    def _classify_output(self, output):
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
                return {
                    "dataType": "image",
                    "outputData": {"dataUri": f"data:image/png;base64,{png_b64}"},
                }

            if "text/html" in data:
                return self._placeholder_output()

        return self._placeholder_output()

    def _build_appendix(self, outputs_data):
        lines = []
        lines.append("")
        lines.append('%[appendix]{"version":"1.0"}')
        lines.append("%---")
        lines.append("%[metadata:view]")
        lines.append('%   data: {"layout":"inline"}')

        for oid, data_dict in outputs_data:
            lines.append("%---")
            lines.append(f"%[output:{oid}]")
            lines.append(f"%   data: {self._serialize_json(data_dict)}")

        lines.append("%---")
        lines.append("")
        return lines

    def _serialize_json(self, obj):
        return json.dumps(obj, separators=(",", ":")).replace("/", "\\/")

    def _convert_notebook(self, notebook):
        cells = notebook["cells"]

        body_lines = []
        outputs_data = []

        for cell_idx, cell in enumerate(cells):
            cell_type = cell["cell_type"]

            if cell_type == "code":
                source = self._get_cell_source(cell)

                output_ids = []
                cell_outputs = cell.get("outputs", [])

                for output in cell_outputs:
                    classified = self._classify_output(output)
                    if classified is not None:
                        oid = self._generate_output_id()
                        output_ids.append(oid)
                        outputs_data.append((oid, classified))

                source_lines = self._split_source_lines(source)

                if output_ids:
                    markers = " ".join(f"%[output:{oid}]" for oid in output_ids)
                    source_lines[-1] = source_lines[-1] + " " + markers

                body_lines.extend(source_lines)

            elif cell_type in ("markdown", "raw"):
                source = self._get_cell_source(cell)
                for line in source.split("\n"):
                    line = self._escape_markdown_syntax(line)
                    body_lines.append(f"%[text] {line}")

            if cell_idx < len(cells) - 1:
                body_lines.append("%%")

        appendix_lines = self._build_appendix(outputs_data)

        return "\n".join(body_lines + appendix_lines)

    def _convert(self, input_path, output_path):
        """Convert a Jupyter notebook (.ipynb) to rich m format (.m).

        Args:
            input_path: Path to the input .ipynb file.
            output_path: Path to write the output .m file.
        """
        with open(input_path, "r") as f:
            notebook = json.load(f)

        result = self._convert_notebook(notebook)

        with open(output_path, "w") as f:
            f.write(result)

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

            if not self._is_matlab_version_25a_or_later(status.matlab_version):
                error_msg = f"MATLABVersionUnsupportedForConversionError: Conversion to Live Script .m requires MATLAB R2025a or later. Current version: {status.matlab_version}"
                self.log.error(error_msg)
                comm.send(
                    {
                        "action": ActionTypes.CONVERT.value,
                        "liveCodeFilePath": None,
                        "error": error_msg,
                    }
                )
                return

            pwd = Path.cwd()
            m_livecode_filepath = pwd / livecode_filepath.with_suffix(".m")

            self._convert(
                str(ipynb_filepath),
                str(m_livecode_filepath),
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

        except Exception as err:
            self.log.error(f"Convert action failed with error: {err}")
            comm.send(
                {
                    "action": ActionTypes.CONVERT.value,
                    "liveCodeFilePath": None,
                    "error": str(err),
                }
            )
