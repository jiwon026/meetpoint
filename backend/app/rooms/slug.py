import secrets

# 0/o/O, 1/l/I 처럼 헷갈리는 글자는 뺀다.
SLUG_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"


def generate_slug(length: int = 6) -> str:
    return "".join(secrets.choice(SLUG_ALPHABET) for _ in range(length))
