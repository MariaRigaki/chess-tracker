from sqlmodel import SQLModel, Field
from datetime import datetime, date
from typing import Optional


class Activity(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str  # e.g., "Gym", "Deep Work", "Reading"
    minutes: int
    comment: Optional[str] = None
    activity_date: date = Field(default_factory=date.today)  # The date for the log
    created_at: datetime = Field(default_factory=datetime.now)


class ChessGame(SQLModel, table=True):
    id: Optional[str] = Field(default=None, primary_key=True)
    source: str = Field(default="Lichess")  # Lichess, OTB, Other
    result: str
    my_rating: int
    opponent_rating: int
    played_at: datetime = Field(default_factory=datetime.now)
    error_category: Optional[str] = None
    comment: Optional[str] = None
