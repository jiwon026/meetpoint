from typing import Literal

Region = Literal["서울", "경기", "인천"]
REGIONS: tuple[str, ...] = ("서울", "경기", "인천")

Theme = Literal["food", "cafe", "drink", "play"]
THEMES: tuple[str, ...] = ("food", "cafe", "drink", "play")
THEME_OFF = "any"
