"""Convert Jupyter notebook (.ipynb) with MATLAB kernel to rich m format (.m)."""

import json
import re
import sys
import uuid


def generate_output_id():
    return uuid.uuid4().hex[:8]


def get_cell_source(cell):
    source = cell["source"]
    if isinstance(source, list):
        return "".join(source)
    return source


def _contains_html(text):
    """Check if text contains HTML content."""
    return bool(re.search(r"<html[\s>]", text, re.IGNORECASE))


_PLACEHOLDER_TEXT = "Rerun this cell to see output"


def _placeholder_output():
    return {
        "dataType": "text",
        "outputData": {"text": _PLACEHOLDER_TEXT, "truncated": False},
    }


def classify_output(output):
    """Classify an ipynb output into a rich m dataType and extract data."""
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

            if _contains_html(text_plain):
                return _placeholder_output()

            if "image/png" in data:
                # Phase 2 - skip for now
                return None

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

        if "text/html" in data:
            return _placeholder_output()

    return None


def serialize_json(obj):
    """Serialize to compact JSON with forward slash escaping."""
    return json.dumps(obj, separators=(",", ":")).replace("/", "\\/")


def convert(notebook, include_outputs=False):
    """Convert a parsed ipynb notebook dict to rich m format string."""
    cells = notebook["cells"]

    body_lines = []
    outputs_data = []  # list of (id, data_dict)

    for cell_idx, cell in enumerate(cells):
        cell_type = cell["cell_type"]

        if cell_type == "code":
            source = get_cell_source(cell)

            output_ids = []
            if include_outputs:
                cell_outputs = cell.get("outputs", [])

                for output in cell_outputs:
                    classified = classify_output(output)
                    if classified is not None:
                        oid = generate_output_id()
                        output_ids.append(oid)
                        outputs_data.append((oid, classified))

            # Write source with output markers on last line
            source_lines = source.split("\n")
            # Remove trailing empty line if source ends with \n
            if source_lines and source_lines[-1] == "":
                source_lines = source_lines[:-1]

            if not source_lines:
                source_lines = [""]

            if output_ids:
                markers = " ".join(f"%[output:{oid}]" for oid in output_ids)
                source_lines[-1] = source_lines[-1] + " " + markers

            body_lines.extend(source_lines)

        elif cell_type == "markdown":
            source = get_cell_source(cell)
            for line in source.split("\n"):
                body_lines.append(f"%[text] {line}")

        # Section break after every cell except the last
        if cell_idx < len(cells) - 1:
            body_lines.append("%%")

    # Build appendix
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
            appendix_lines.append(f"%   data: {serialize_json(data_dict)}")

    appendix_lines.append("%---")
    appendix_lines.append("")

    return "\n".join(body_lines + appendix_lines)


def main():
    if len(sys.argv) < 2:
        print("Usage: python converter.py <input.ipynb> [output.m]", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    if len(sys.argv) >= 3:
        output_path = sys.argv[2]
    else:
        output_path = re.sub(r"\.ipynb$", ".m", input_path)
        if output_path == input_path:
            output_path = input_path + ".m"

    with open(input_path, "r") as f:
        notebook = json.load(f)

    result = convert(notebook, True)

    with open(output_path, "w") as f:
        f.write(result)

    print(f"Converted: {input_path} -> {output_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
