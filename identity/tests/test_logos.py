from app.logos import detect_image_type


def test_detect_image_type():
    assert detect_image_type(b"\x89PNG\r\n\x1a\n rest") == "image/png"
    assert detect_image_type(b"\xff\xd8\xff\xdb rest") == "image/jpeg"
    assert detect_image_type(b"RIFF\x00\x00\x00\x00WEBPVP8 ") == "image/webp"
    assert detect_image_type(b"RIFF\x00\x00\x00\x00WAVEfmt ") is None
    assert detect_image_type(b"<svg/>") is None
    assert detect_image_type(b"") is None
