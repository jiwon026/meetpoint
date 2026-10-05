import logging

from app.logging_config import StripQueryFilter, configure_logging


def _access_record(path: str) -> logging.LogRecord:
    return logging.LogRecord(
        name="uvicorn.access", level=logging.INFO, pathname="", lineno=0,
        msg='%s - "%s %s HTTP/%s" %d', args=("127.0.0.1:5000", "GET", path, "1.1", 200), exc_info=None,
    )


def test_strip_query_filter_removes_query_string():
    record = _access_record("/stations?q=%EC%84%9C%EC%9A%B8%EC%8B%9C+%EA%B0%95%EB%82%A8%EA%B5%AC")
    assert StripQueryFilter().filter(record) is True
    assert record.getMessage() == '127.0.0.1:5000 - "GET /stations HTTP/1.1" 200'


def test_strip_query_filter_keeps_plain_paths_and_other_records():
    record = _access_record("/health")
    StripQueryFilter().filter(record)
    assert record.getMessage() == '127.0.0.1:5000 - "GET /health HTTP/1.1" 200'
    other = logging.LogRecord("x", logging.INFO, "", 0, "hello %s", ("a?b",), None)
    assert StripQueryFilter().filter(other) is True
    assert other.getMessage() == "hello a?b"


def test_configure_logging_quiets_http_clients_and_is_idempotent():
    configure_logging()
    configure_logging()
    assert logging.getLogger("httpx").level == logging.WARNING
    assert logging.getLogger("httpcore").level == logging.WARNING
    filters = [f for f in logging.getLogger("uvicorn.access").filters if isinstance(f, StripQueryFilter)]
    assert len(filters) == 1
