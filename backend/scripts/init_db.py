"""테이블을 만든다. 처음 배포할 때와 로컬 개발 시작할 때 한 번 실행한다.

실행: python -m scripts.init_db
"""

from app.db import engine
from app.models import Base

if __name__ == "__main__":
    Base.metadata.create_all(engine)
    print("tables created")
