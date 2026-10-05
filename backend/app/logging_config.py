import logging

ACCESS_LOGGER = "uvicorn.access"
# 두 로거는 INFO에서 요청 URL 전체를 남긴다. URL에는 주소 검색어와 API 키가 들어 있다.
QUIET_LOGGERS = ("httpx", "httpcore")
PATH_ARG_INDEX = 2


class StripQueryFilter(logging.Filter):
    """uvicorn 접근 로그의 경로에서 쿼리 문자열을 지운다. 검색어 칸에 주소를 치는 사람이 있다."""

    def filter(self, record: logging.LogRecord) -> bool:
        args = record.args
        if isinstance(args, tuple) and len(args) > PATH_ARG_INDEX and isinstance(args[PATH_ARG_INDEX], str):
            path = args[PATH_ARG_INDEX].split("?", 1)[0]
            record.args = (*args[:PATH_ARG_INDEX], path, *args[PATH_ARG_INDEX + 1 :])
        return True


def configure_logging() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    for name in QUIET_LOGGERS:
        logging.getLogger(name).setLevel(logging.WARNING)
    access = logging.getLogger(ACCESS_LOGGER)
    if not any(isinstance(f, StripQueryFilter) for f in access.filters):
        access.addFilter(StripQueryFilter())
