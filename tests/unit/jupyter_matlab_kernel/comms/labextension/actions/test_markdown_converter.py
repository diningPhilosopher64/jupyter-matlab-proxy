# Copyright 2026 The MathWorks, Inc.

import re

import pytest

from jupyter_matlab_kernel.comms.labextension.actions import markdown_converter as mc
from jupyter_matlab_kernel.comms.labextension.actions.markdown_converter import (
    _clean_table_cell,
    _convert_hyperlinks,
    _escape_markdown_syntax,
    _extract_anchor_id,
    _generate_media_id,
    _is_anchor_line,
    _is_block_latex_start,
    _is_empty_header_row,
    _is_image_block_start,
    _is_pre_block_start,
    _is_table_row,
    _is_table_separator,
    _is_table_start,
    _is_toc_start,
    _is_video_thumbnail,
    _normalize_separator,
    convert_markdown_lines,
)


@pytest.fixture
def fixed_media_id(monkeypatch):
    """Force _generate_media_id to return a deterministic value.

    Media IDs are random, so tests that assert on generated IDs use this fixture.
    """
    monkeypatch.setattr(mc, "_generate_media_id", lambda: "1abc")
    return "1abc"


def _convert(text, entries=None):
    """Run convert_markdown_lines on a text blob (split into lines)."""
    entries = entries if entries is not None else []
    return convert_markdown_lines(text.split("\n"), entries), entries


# ---- _generate_media_id ----


def test_generate_media_id_format():
    """Test that media IDs are 4 hex chars, starting with a numeric digit."""
    ids = [_generate_media_id() for _ in range(500)]
    assert all(len(i) == 4 for i in ids)
    assert all(re.fullmatch(r"[0-9a-f]{4}", i) for i in ids)
    assert all(i[0] in "0123456789" for i in ids)


# ---- _escape_markdown_syntax ----


@pytest.mark.parametrize(
    "text,expected",
    [
        pytest.param("<div>hi</div>", "\\<div\\>hi\\</div\\>", id="html_tags"),
        pytest.param("<br/>", "\\<br/\\>", id="self_closing_tag"),
        pytest.param(
            '<a href="url">link</a>',
            '\\<a href="url"\\>link\\</a\\>',
            id="tag_with_attributes",
        ),
        pytest.param("<!-- End Toc -->", "\\<!-- End Toc --\\>", id="html_comment"),
        pytest.param("---", "\\---", id="horizontal_rule_3_dashes"),
        pytest.param("-----", "\\-----", id="horizontal_rule_5_dashes"),
        pytest.param("> Block quote", "\\> Block quote", id="block_quote"),
        pytest.param("  > Indented", "  \\> Indented", id="block_quote_indented"),
        pytest.param("   >   HE", "   \\>   HE", id="block_quote_multiple_spaces"),
        pytest.param("plain text", "plain text", id="no_escaping_needed"),
        pytest.param("a - b - c", "a - b - c", id="dashes_not_horizontal_rule"),
        pytest.param("->arrow", "->arrow", id="gt_not_at_start"),
        pytest.param("a < b > c", "a < b > c", id="non_tag_angle_brackets"),
    ],
)
def test_escape_markdown_syntax(text, expected):
    """Test that markdown/HTML syntax conflicting with rich .m format is escaped."""
    assert _escape_markdown_syntax(text) == expected


# ---- _convert_hyperlinks ----


@pytest.mark.parametrize(
    "text,expected",
    [
        pytest.param(
            "[link](#M_1234)",
            "[link](internal:M_1234)",
            id="anchor_link",
        ),
        pytest.param(
            "[file](./other.m)",
            "[file](file:./other.m)",
            id="relative_file_link",
        ),
        pytest.param(
            "See [a](#X) and [b](./f.m)",
            "See [a](internal:X) and [b](file:./f.m)",
            id="both_in_one_line",
        ),
        pytest.param(
            "[external](https://example.com)",
            "[external](https://example.com)",
            id="external_untouched",
        ),
        pytest.param("no links here", "no links here", id="no_links"),
    ],
)
def test_convert_hyperlinks(text, expected):
    """Test that exported link formats are restored to rich .m link prefixes."""
    assert _convert_hyperlinks(text) == expected


# ---- Table predicates ----


@pytest.mark.parametrize(
    "line,expected",
    [
        pytest.param("| a | b |", True, id="valid_row"),
        pytest.param("|x|", True, id="minimal_row"),
        pytest.param("no pipes", False, id="no_pipes"),
        pytest.param("| missing end", False, id="no_trailing_pipe"),
        pytest.param("|", False, id="single_pipe_too_short"),
    ],
)
def test_is_table_row(line, expected):
    """Test that a markdown table row is detected by its surrounding pipes."""
    assert _is_table_row(line) is expected


@pytest.mark.parametrize(
    "line,expected",
    [
        pytest.param("| --- | --- |", True, id="plain_dashes"),
        pytest.param("| :-- | :-- |", True, id="left_aligned"),
        pytest.param("| :--: | --: |", True, id="center_and_right"),
        pytest.param("| a | b |", False, id="data_row_not_separator"),
        pytest.param("| - | - |", False, id="single_dash_too_short"),
        pytest.param("| :-: | :-: |", False, id="single_dash_alignment_too_short"),
    ],
)
def test_is_table_separator(line, expected):
    """Test that a table separator row requires 2+ dashes per cell."""
    assert _is_table_separator(line) is expected


@pytest.mark.parametrize(
    "line,expected",
    [
        pytest.param("|||", True, id="triple_pipe"),
        pytest.param("| | |", True, id="spaced_empty"),
        pytest.param("| a | |", False, id="one_cell_filled"),
    ],
)
def test_is_empty_header_row(line, expected):
    """Test that an empty header row is detected when all cells are blank."""
    assert _is_empty_header_row(line) is expected


def test_is_table_start_requires_separator_and_data():
    """Test that a table needs a row, a separator, and room for a data row."""
    assert _is_table_start(["| A | B |", "| --- | --- |", "| 1 | 2 |"], 0) is True

    # Header + separator but no data row (index+2 out of bounds)
    assert _is_table_start(["| A |", "| --- |"], 0) is False

    # Two pipe rows but no separator
    assert _is_table_start(["| a |", "| b |", "| c |"], 0) is False


def test_normalize_separator_strips_alignment():
    """Test that separator alignment markers are normalized to plain dashes."""
    assert _normalize_separator("| :-- | :-: | --: |") == "| --- | --- | --- |"


@pytest.mark.parametrize(
    "cell,expected",
    [
        pytest.param(" a<br>b ", "ab", id="strips_br_and_whitespace"),
        pytest.param("  hi  ", "hi", id="strips_whitespace"),
        pytest.param("x<br>y<br>z", "xyz", id="multiple_br"),
    ],
)
def test_clean_table_cell(cell, expected):
    """Test that table cells are cleaned of <br> tags and excess whitespace."""
    assert _clean_table_cell(cell) == expected


# ---- Anchor predicates ----


@pytest.mark.parametrize(
    "line,is_anchor,anchor_id",
    [
        pytest.param('<a id="M_1"></a>', True, "M_1", id="m_anchor"),
        pytest.param('<a id="TMP_143d"></a>', True, "TMP_143d", id="tmp_anchor"),
        pytest.param('  <a id="X"></a>  ', True, "X", id="indented_anchor"),
        pytest.param("<a>no id</a>", False, None, id="no_id"),
        pytest.param("plain text", False, None, id="not_anchor"),
    ],
)
def test_anchor_predicates(line, is_anchor, anchor_id):
    """Test that anchor lines are detected and their IDs extracted."""
    assert _is_anchor_line(line) is is_anchor
    assert _extract_anchor_id(line) == anchor_id


# ---- Other predicates ----


def test_is_toc_start():
    """Test that a Table of Contents block start is detected."""
    assert _is_toc_start(["<!-- Begin Toc -->"], 0) is True
    assert _is_toc_start(["some text"], 0) is False


@pytest.mark.parametrize(
    "line,expected",
    [
        pytest.param(
            '[<img src="p.png" width="1" alt="onlineVideoThumb_x.png">](u)',
            True,
            id="youtube",
        ),
        pytest.param(
            '[<img src="p.png" width="1" alt="videoThumb_false.png">](u)',
            True,
            id="local_video",
        ),
        pytest.param(
            '[<img src="p.png" width="1" alt="regular.png">](u)',
            False,
            id="regular_image_link",
        ),
    ],
)
def test_is_video_thumbnail(line, expected):
    """Test that video thumbnail patterns are distinguished from plain images."""
    assert _is_video_thumbnail(line) is expected


def test_is_pre_block_start():
    """Test that a <pre> code block start is detected."""
    assert _is_pre_block_start(["<pre>"], 0) is True
    assert _is_pre_block_start(["  <pre>  "], 0) is True
    assert _is_pre_block_start(["not pre"], 0) is False


@pytest.mark.parametrize(
    "line,expected",
    [
        pytest.param("$$x$$", True, id="single_line"),
        pytest.param("$$", True, id="fenced_opener"),
        pytest.param("$x$", False, id="inline_single_dollar"),
        pytest.param("text", False, id="plain"),
    ],
)
def test_is_block_latex_start(line, expected):
    """Test that a block-LaTeX ($$...$$) region start is detected."""
    assert _is_block_latex_start([line], 0) is expected


def test_is_image_block_start():
    """Test that standalone and <p>-wrapped image blocks are detected."""
    assert _is_image_block_start(['<img src="x" alt="y">'], 0) is True
    assert (
        _is_image_block_start(['<p style="text-align:left">', '<img src="x">'], 0)
        is True
    )
    assert _is_image_block_start(["plain text"], 0) is False


# ---- convert_markdown_lines: headings ----


def test_convert_heading_inserts_section_breaks():
    """Test that a heading gets a section break after it when content follows."""
    # Act
    result, _ = _convert("## Heading 2\nbody text")

    # Assert
    assert result == [
        "%[text] ## Heading 2",
        "%%",
        "%[text] body text",
    ]


def test_convert_heading_only():
    """Test that a lone heading produces no trailing section break."""
    # Act
    result, _ = _convert("## Just a heading")

    # Assert
    assert result == ["%[text] ## Just a heading"]


# ---- convert_markdown_lines: table of contents ----


def test_convert_toc_block_replaced_with_directive():
    """Test that the ToC HTML-comment block collapses to a single directive."""
    # Arrange
    text = (
        "<!-- Begin Toc -->\n"
        "## Table of Contents\n"
        "&emsp;[H1](#TMP_143d)\n"
        "<!-- End Toc -->\n"
        "After toc"
    )

    # Act
    result, _ = _convert(text)

    # Assert
    assert result[0] == '%[text:tableOfContents]{"heading":"Table of Contents"}'
    assert "%[text] After toc" in result
    # None of the ToC internals leak through
    assert not any("Begin Toc" in line for line in result)
    assert not any("&emsp;" in line for line in result)


# ---- convert_markdown_lines: anchors ----


def test_convert_tmp_anchor_discarded():
    """Test that TMP_ anchors are auto-generated and dropped."""
    # Act
    result, _ = _convert('<a id="TMP_1"></a>\nplain')

    # Assert
    assert result == ["%[text] plain"]


def test_convert_user_anchor_attached_to_table():
    """Test that an M_ anchor is carried forward and attached to the next table."""
    # Arrange
    text = '<a id="M_6594"></a>\n| A | B |\n| :-- | :-- |\n| 1 | 2 |'

    # Act
    result, _ = _convert(text)

    # Assert
    assert result[0] == '%[text:table]{"ignoreHeader":false} %[text:anchor:M_6594]'


# ---- convert_markdown_lines: images ----


def test_convert_standalone_image(fixed_media_id):
    """Test that a standalone <img> becomes an inline ref plus appendix entry."""
    # Arrange
    line = '<img src="data:image/png;base64,AAAA" width="481" height="200" alt="image_0.png">'

    # Act
    result, entries = _convert(line)

    # Assert
    assert result == ["%[text] ![image_0.png](text:image:1abc)"]
    assert entries == [
        (
            "text:image",
            "1abc",
            {"align": "baseline", "height": 200, "src": "data:image/png;base64,AAAA"},
        )
    ]


def test_convert_p_wrapped_image_derives_height(fixed_media_id):
    """Test that a <p>-wrapped image with only width derives height as width * 0.75."""
    # Arrange
    text = (
        '<p style="text-align:left">\n'
        '<img src="data:image/png;base64,BBBB" width="100" alt="pic.png">\n'
        "</p>"
    )

    # Act
    result, entries = _convert(text)

    # Assert
    assert result == ["%[text] ![pic.png](text:image:1abc)"]
    assert entries[0][2]["height"] == 75  # 100 * 0.75


# ---- convert_markdown_lines: videos ----


def test_convert_youtube_video(fixed_media_id):
    """Test that a YouTube thumbnail produces a video reference without a poster."""
    # Arrange
    line = '[<img src="poster.png" width="562" alt="onlineVideoThumb_x.png">](https://youtube.com/embed/abc123)'

    # Act
    result, entries = _convert(line)

    # Assert
    assert result == ["%[text] ![](text:video:1abc)"]
    assert entries == [
        (
            "text:video",
            "1abc",
            {"height": 315, "vidSrc": "https://youtube.com/embed/abc123", "width": 560},
        )
    ]


def test_convert_local_video_includes_poster(fixed_media_id):
    """Test that a local video thumbnail includes posterSrc in the appendix entry."""
    # Arrange
    line = '[<img src="data:image/png;base64,CCCC" width="562" alt="videoThumb_false.png">](/path/local.mp4)'

    # Act
    result, entries = _convert(line)

    # Assert
    assert result == ["%[text] ![](text:video:1abc)"]
    data = entries[0][2]
    assert data["vidSrc"] == "/path/local.mp4"
    assert data["posterSrc"] == "data:image/png;base64,CCCC"


# ---- convert_markdown_lines: code blocks (<pre>) ----


def test_convert_pre_block_matlab():
    """Test that a <pre> block with MATLAB keywords is fenced as matlabCodeExample."""
    # Arrange
    text = "<pre>\nfunction y = f(x)\ndisp(x)\nend\n</pre>"

    # Act
    result, _ = _convert(text)

    # Assert
    assert result == [
        "%[text] ```matlabCodeExample",
        "%[text] function y = f(x)",
        "%[text] disp(x)",
        "%[text] end",
        "%[text] ```",
    ]


def test_convert_pre_block_non_matlab():
    """Test that a <pre> block without MATLAB keywords uses a bare fence."""
    # Arrange
    text = "<pre>\nhello world\njust text\n</pre>"

    # Act
    result, _ = _convert(text)

    # Assert
    assert result[0] == "%[text] ```"
    assert result[-1] == "%[text] ```"
    assert "%[text] hello world" in result


# ---- convert_markdown_lines: tables ----


def test_convert_table_basic():
    """Test that a GFM table is wrapped with %[text:table] markers."""
    # Arrange
    text = "| A | B |\n| --- | --- |\n| 1 | 2 |"

    # Act
    result, _ = _convert(text)

    # Assert
    assert result == [
        '%[text:table]{"ignoreHeader":false}',
        "%[text] | A | B |",
        "%[text] | --- | --- |",
        "%[text] | 1 | 2 |",
        "%[text:table]",
    ]


def test_convert_table_normalizes_alignment_separator():
    """Test that alignment markers in the separator are normalized to plain dashes."""
    # Arrange
    text = "| A | B |\n| :-- | --: |\n| 1 | 2 |"

    # Act
    result, _ = _convert(text)

    # Assert
    assert "%[text] | --- | --- |" in result


def test_convert_table_strips_br_in_cells():
    """Test that <br> tags inside table cells are stripped."""
    # Arrange
    text = "| A | B |\n| --- | --- |\n| x<br>y | z |"

    # Act
    result, _ = _convert(text)

    # Assert
    assert "%[text] | xy | z |" in result


def test_convert_table_empty_header_sets_ignore_header():
    """Test that an empty header row sets ignoreHeader=true and promotes data row."""
    # Arrange
    text = "|||\n| :-- | :-- |\n| 1 | 2 |"

    # Act
    result, _ = _convert(text)

    # Assert
    assert result[0] == '%[text:table]{"ignoreHeader":true}'
    assert "%[text] | 1 | 2 |" in result


# ---- convert_markdown_lines: block LaTeX ($$...$$) ----


def test_convert_block_latex_single_line():
    """Test that $$...$$ becomes a single-$ equation with escaped inner dollars."""
    # Act
    result, _ = _convert("$$\\int_0^1 x dx$$")

    # Assert
    assert result == ["%[text] $&dollar&;&dollar&;\\int_0^1 x dx&dollar&;&dollar&;$"]


def test_convert_block_latex_fenced_multiline():
    """Test that a fenced $$ ... $$ block collapses onto one line."""
    # Act
    result, _ = _convert("$$\n\\int_0^1 x dx\n$$")

    # Assert
    assert result == ["%[text] $&dollar&;&dollar&;\\int_0^1 x dx&dollar&;&dollar&;$"]


# ---- convert_markdown_lines: hyperlinks in plain text ----


def test_convert_plain_text_restores_hyperlinks():
    """Test that hyperlink prefixes are restored on plain text lines."""
    # Act
    result, _ = _convert("See [here](#M_1234) and [file](./other.m)")

    # Assert
    assert result == ["%[text] See [here](internal:M_1234) and [file](file:./other.m)"]


# ---- convert_markdown_lines: blank lines & trailing trim ----


def test_convert_single_blank_line_ignored():
    """Test that a single blank line is ignored."""
    # Act
    result, _ = _convert("line1\n\nline2")

    # Assert
    assert result == ["%[text] line1", "%[text] line2"]


def test_convert_double_blank_line_creates_spacing():
    """Test that 2+ consecutive blanks create a section break + empty text line."""
    # Act
    result, _ = _convert("line1\n\n\nline2")

    # Assert
    assert result == [
        "%[text] line1",
        "%%",
        "%[text] ",
        "%[text] line2",
    ]


def test_convert_trailing_section_breaks_stripped():
    """Test that trailing %% / empty text lines are removed from the output."""
    # Act
    result, _ = _convert("## Heading\n\n\n")

    # Assert
    assert result == ["%[text] ## Heading"]


def test_convert_empty_input():
    """Test that empty input produces no output lines and no appendix entries."""
    # Act
    result, entries = _convert("")

    # Assert
    assert result == []
    assert entries == []
