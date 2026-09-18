"""Reading the text out of a PDF, with nothing to install.

A purchase order usually carries its figures in the attachment rather than the covering
note, so an extractor that only reads the email body reads the wrong document. This pulls
the text layer out of the PDF so the same patterns can be applied to it.

Deliberately stdlib-only — `zlib` is the whole of the dependency list. A demo laptop the
morning of a presentation is the worst possible time to discover a missing wheel, and the
alternative (pypdf, pdfplumber, pdfminer) buys features this does not need: no layout
reconstruction, no tables, no OCR. It needs the words, in order.

## What it does and does not handle

It reads **text-layer** PDFs: content streams, raw or FlateDecode, and the `Tj`/`TJ`/`'`/`"`
show-text operators, including hex strings and the `TJ` array form. That covers every PDF
produced by a word processor, an accounting package or `tools/make_demo_pos.py`.

It does **not** do OCR. A photographed or scanned purchase order has no text layer at all,
and this returns an empty string for one — which is correct and is what the pipeline's
OCR-failure branch is for. Returning a guess would be worse than returning nothing.

Encrypted PDFs are also empty by design. Decrypting somebody's document because we happen
to be able to is not a decision this module should make quietly.
"""

from __future__ import annotations

import re
import zlib

# `5 0 obj ... stream\r\n<bytes>\r\nendstream`. Non-greedy so consecutive objects do not
# merge, and DOTALL because a content stream is binary and full of newlines.
_STREAM = re.compile(rb"stream\r?\n(.*?)\r?\nendstream", re.DOTALL)

# The show-text operators. Group 1 is a literal string, group 2 a hex string.
_SHOW = re.compile(rb"(?:\((?P<lit>(?:\\.|[^\\()])*)\)|<(?P<hex>[0-9A-Fa-f\s]*)>)\s*(?:Tj|TJ|'|\")")

# Inside a `TJ` array: [(Hello) -250 (World)] TJ — the strings, with the kerning dropped.
_TJ_ARRAY = re.compile(rb"\[(?P<body>(?:[^\[\]\\]|\\.)*)\]\s*TJ")

_ESCAPES = {
    b"n": b"\n",
    b"r": b"\r",
    b"t": b"\t",
    b"b": b"\b",
    b"f": b"\f",
    b"(": b"(",
    b")": b")",
    b"\\": b"\\",
}


def extract_text(data: bytes) -> str:
    """Every string drawn by the document, in order, one line per text-showing operator.

    Never raises. A PDF this cannot read comes back as an empty string, because a caller
    deciding "there is no text layer here" is a sound decision and a caller handling an
    exception from a malformed attachment is not.
    """
    if not data or not data.startswith(b"%PDF"):
        return ""
    # An encrypted document decodes to noise. Say nothing rather than something wrong.
    if b"/Encrypt" in data[:4096] or b"/Encrypt" in data[-4096:]:
        return ""

    pieces: list[str] = []
    for raw in _STREAM.findall(data):
        content = _decompress(raw)
        if not content:
            continue
        pieces.extend(_strings_in(content))

    # Some producers write text outside a stream object entirely; `make_demo_pos.py` does
    # not, but a real-world PDF might, and missing it would look like an empty document.
    if not pieces:
        pieces.extend(_strings_in(data))

    return "\n".join(pieces)


def has_text_layer(data: bytes) -> bool:
    """Whether anything readable came out. The OCR-failure branch asks this."""
    return bool(extract_text(data).strip())


def _decompress(raw: bytes) -> bytes:
    """FlateDecode if it is compressed, the bytes themselves if not."""
    try:
        return zlib.decompress(raw)
    except zlib.error:
        # Not deflate, or a stream with junk on the end. Try a tolerant pass, then give up
        # and treat it as already-plain content.
        try:
            return zlib.decompressobj().decompress(raw)
        except zlib.error:
            return raw


def _strings_in(content: bytes) -> list[str]:
    out: list[str] = []

    # `TJ` arrays first, so their pieces are joined into one line rather than scattered.
    consumed: list[tuple[int, int]] = []
    for match in _TJ_ARRAY.finditer(content):
        parts = [
            _literal(m.group("lit")) if m.group("lit") is not None else _hex(m.group("hex"))
            for m in re.finditer(
                rb"\((?P<lit>(?:\\.|[^\\()])*)\)|<(?P<hex>[0-9A-Fa-f\s]*)>", match.group("body")
            )
        ]
        line = "".join(parts).strip()
        if line:
            out.append(line)
        consumed.append(match.span())

    for match in _SHOW.finditer(content):
        # Skip anything already taken by a TJ array above.
        if any(start <= match.start() < end for start, end in consumed):
            continue
        text = (
            _literal(match.group("lit"))
            if match.group("lit") is not None
            else _hex(match.group("hex"))
        ).strip()
        if text:
            out.append(text)

    return out


def _literal(raw: bytes | None) -> str:
    """A `(...)` string, with PDF's backslash escapes and \\ooo octals resolved."""
    if raw is None:
        return ""
    out = bytearray()
    index = 0
    while index < len(raw):
        byte = raw[index : index + 1]
        if byte != b"\\":
            out += byte
            index += 1
            continue
        index += 1
        if index >= len(raw):
            break
        nxt = raw[index : index + 1]
        if nxt in _ESCAPES:
            out += _ESCAPES[nxt]
            index += 1
        elif nxt.isdigit():
            octal = raw[index : index + 3]
            try:
                out.append(int(octal, 8) & 0xFF)
            except ValueError:
                out += nxt
            index += len(octal)
        elif nxt in (b"\n", b"\r"):
            # A backslash at end of line is a line continuation: it emits nothing.
            index += 1
        else:
            out += nxt
            index += 1
    return out.decode("utf-8", errors="replace")


def _hex(raw: bytes | None) -> str:
    """A `<48656C6C6F>` string. Odd length is padded with 0, per the spec."""
    if raw is None:
        return ""
    digits = re.sub(rb"\s", b"", raw)
    if len(digits) % 2:
        digits += b"0"
    try:
        decoded = bytes.fromhex(digits.decode("ascii"))
    except (ValueError, UnicodeDecodeError):
        return ""
    # UTF-16BE with a byte-order mark is how most producers write non-ASCII.
    if decoded.startswith(b"\xfe\xff"):
        return decoded[2:].decode("utf-16-be", errors="replace")
    return decoded.decode("latin-1", errors="replace")
