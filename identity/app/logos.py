"""App logo validation. See catalog spec §3.3."""

MAX_LOGO_BYTES = 256 * 1024
LOGO_ERROR = "Logo must be a PNG, JPEG or WebP image up to 256 KB"


def detect_image_type(data: bytes) -> str | None:
    """Content type from the file's leading bytes; the uploader's declared type is not trusted."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None
