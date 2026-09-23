from app.rooms.slug import SLUG_ALPHABET, generate_slug


def test_slug_has_requested_length():
    assert len(generate_slug()) == 6
    assert len(generate_slug(8)) == 8


def test_slug_uses_unambiguous_alphabet():
    for _ in range(200):
        assert set(generate_slug()) <= set(SLUG_ALPHABET)
    for banned in "0oO1lI":
        assert banned not in SLUG_ALPHABET


def test_slugs_are_not_all_identical():
    assert len({generate_slug() for _ in range(50)}) > 1
