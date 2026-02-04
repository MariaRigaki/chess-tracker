from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import sqlite3
from datetime import datetime
import os
import io
import csv

app = FastAPI()

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "chess_activities.db"

class ActivityBase(BaseModel):
    date: str
    week: int
    category: str
    minutes: int
    details: Optional[str] = None

class ActivityCreate(ActivityBase):
    pass

class Activity(ActivityBase):
    id: int
    created_at: str

class MistakeBase(BaseModel):
    date: str
    game_type: Optional[str] = None
    time_control: Optional[str] = None
    opponent_name: Optional[str] = None
    opponent_rating: Optional[int] = None
    result: Optional[str] = None
    move_number: Optional[int] = None
    mistake_category: Optional[str] = None
    cause: Optional[str] = None
    fix: Optional[str] = None
    training: Optional[str] = None
    url: Optional[str] = None
    annotations: Optional[str] = None

class MistakeCreate(MistakeBase):
    pass

class Mistake(MistakeBase):
    id: int
    created_at: str

def get_db_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

# ... existing activity endpoints ...

@app.get("/mistakes")
def get_mistakes(limit: int = 20, offset: int = 0, db: sqlite3.Connection = Depends(get_db_conn)):
    cursor = db.cursor()
    
    # Get total count
    cursor.execute("SELECT COUNT(*) FROM mistakes")
    total_count = cursor.fetchone()[0]
    
    # Get paginated data
    cursor.execute("SELECT * FROM mistakes ORDER BY date DESC, id DESC LIMIT ? OFFSET ?", (limit, offset))
    rows = cursor.fetchall()
    
    return {
        "mistakes": [dict(row) for row in rows],
        "total_count": total_count,
        "limit": limit,
        "offset": offset
    }

@app.post("/mistakes", response_model=Mistake)
def create_mistake(mistake: MistakeCreate, db: sqlite3.Connection = Depends(get_db_conn)):
    cursor = db.cursor()
    cursor.execute('''
        INSERT INTO mistakes (
            date, game_type, time_control, opponent_name, opponent_rating, 
            result, move_number, mistake_category, cause, fix, training, url, annotations
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        mistake.date, mistake.game_type, mistake.time_control, mistake.opponent_name, 
        mistake.opponent_rating, mistake.result, mistake.move_number, 
        mistake.mistake_category, mistake.cause, mistake.fix, mistake.training, 
        mistake.url, mistake.annotations
    ))
    db.commit()
    mistake_id = cursor.lastrowid
    cursor.execute("SELECT * FROM mistakes WHERE id = ?", (mistake_id,))
    row = cursor.fetchone()
    return dict(row)

@app.delete("/mistakes/{mistake_id}")
def delete_mistake(mistake_id: int, db: sqlite3.Connection = Depends(get_db_conn)):
    cursor = db.cursor()
    cursor.execute("DELETE FROM mistakes WHERE id = ?", (mistake_id,))
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Mistake not found")
    db.commit()
    return {"message": "Mistake deleted"}

@app.get("/mistakes/stats")
def get_mistakes_stats(db: sqlite3.Connection = Depends(get_db_conn)):
    cursor = db.cursor()
    
    # Mistakes by category
    cursor.execute('''
        SELECT mistake_category, COUNT(*) as count 
        FROM mistakes 
        WHERE mistake_category IS NOT NULL 
        GROUP BY mistake_category
    ''')
    category_data = [dict(row) for row in cursor.fetchall()]
    
    # Results distribution
    cursor.execute('''
        SELECT result, COUNT(*) as count 
        FROM mistakes 
        WHERE result IS NOT NULL 
        GROUP BY result
    ''')
    result_data = [dict(row) for row in cursor.fetchall()]

    return {
        "mistake_distribution": category_data,
        "result_distribution": result_data
    }

@app.get("/export/mistakes")
def export_mistakes(db: sqlite3.Connection = Depends(get_db_conn)):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM mistakes ORDER BY date DESC")
    rows = cursor.fetchall()
    
    if not rows:
        return StreamingResponse(io.StringIO(), media_type="text/csv")

    output = io.StringIO()
    writer = csv.writer(output)
    
    # Get column names from cursor description
    column_names = [description[0] for description in cursor.description]
    writer.writerow(column_names)
    
    for row in rows:
        writer.writerow(list(row))
    
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=chess_mistakes_{datetime.now().strftime('%Y%m%d')}.csv"}
    )

@app.get("/activities")
def get_activities(
    limit: int = 20, 
    offset: int = 0, 
    category: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: sqlite3.Connection = Depends(get_db_conn)
):
    cursor = db.cursor()
    query = "FROM activities WHERE 1=1"
    params = []
    
    if category:
        query += " AND category = ?"
        params.append(category)
    if start_date:
        query += " AND date >= ?"
        params.append(start_date)
    if end_date:
        query += " AND date <= ?"
        params.append(end_date)
    
    # Get total count for pagination
    cursor.execute(f"SELECT COUNT(*) {query}", params)
    total_count = cursor.fetchone()[0]
    
    # Get paginated data
    cursor.execute(f"SELECT * {query} ORDER BY date DESC, id DESC LIMIT ? OFFSET ?", params + [limit, offset])
    rows = cursor.fetchall()
    
    return {
        "activities": [dict(row) for row in rows],
        "total_count": total_count,
        "limit": limit,
        "offset": offset
    }

@app.post("/activities", response_model=Activity)
def create_activity(activity: ActivityCreate, db: sqlite3.Connection = Depends(get_db_conn)):
    cursor = db.cursor()
    cursor.execute('''
        INSERT INTO activities (date, week, category, minutes, details)
        VALUES (?, ?, ?, ?, ?)
    ''', (activity.date, activity.week, activity.category, activity.minutes, activity.details))
    db.commit()
    activity_id = cursor.lastrowid
    cursor.execute("SELECT * FROM activities WHERE id = ?", (activity_id,))
    row = cursor.fetchone()
    return dict(row)

@app.delete("/activities/{activity_id}")
def delete_activity(activity_id: int, db: sqlite3.Connection = Depends(get_db_conn)):
    cursor = db.cursor()
    cursor.execute("DELETE FROM activities WHERE id = ?", (activity_id,))
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Activity not found")
    db.commit()
    return {"message": "Activity deleted"}

@app.get("/export")
def export_activities(db: sqlite3.Connection = Depends(get_db_conn)):
    cursor = db.cursor()
    cursor.execute("SELECT date, week, category, minutes, details FROM activities ORDER BY date DESC")
    rows = cursor.fetchall()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Date', 'Week', 'Category', 'Minutes', 'Details'])
    for row in rows:
        writer.writerow(list(row))
    
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=chess_activities_{datetime.now().strftime('%Y%m%d')}.csv"}
    )

@app.get("/stats/summary")
def get_summary(db: sqlite3.Connection = Depends(get_db_conn)):
    cursor = db.cursor()
    
    # Total hours per category
    cursor.execute('''
        SELECT category, SUM(minutes) as total_minutes 
        FROM activities 
        GROUP BY category
    ''')
    category_data = [dict(row) for row in cursor.fetchall()]
    
    # Total hours per week, grouped by Sunday start date and category for stacked chart
    cursor.execute('''
        SELECT DISTINCT date(date, 'weekday 0', '-6 days') as week_start
        FROM activities
        ORDER BY week_start DESC
        LIMIT 12
    ''')
    weeks_rows = cursor.fetchall()
    weeks = [row[0] for row in weeks_rows]
    weeks.reverse()

    weekly_data = []
    if weeks:
        placeholders = ','.join(['?'] * len(weeks))
        query = f'''
            SELECT date(date, 'weekday 0', '-6 days') as week_start, category, SUM(minutes) as total_minutes 
            FROM activities 
            WHERE date(date, 'weekday 0', '-6 days') IN ({placeholders})
            GROUP BY week_start, category
        '''
        cursor.execute(query, weeks)
        rows = cursor.fetchall()
        
        data_map = {week: {'week_start': week} for week in weeks}
        for row in rows:
            week = row['week_start']
            cat = row['category']
            mins = row['total_minutes']
            if week in data_map:
                data_map[week][cat] = mins
        
        weekly_data = list(data_map.values())
    
    cursor.execute("SELECT date(MAX(date), 'weekday 0', '-6 days') FROM activities")
    current_week_start_row = cursor.fetchone()
    current_week_start = current_week_start_row[0] if current_week_start_row else None
    
    current_week_minutes = 0
    if current_week_start:
        cursor.execute('''
            SELECT SUM(minutes) FROM activities 
            WHERE date(date, 'weekday 0', '-6 days') = ?
        ''', (current_week_start,))
        row = cursor.fetchone()
        current_week_minutes = row[0] if row and row[0] else 0
    
    return {
        "category_distribution": category_data,
        "weekly_progress": weekly_data,
        "current_week_total_hours": round(current_week_minutes / 60, 2),
        "current_week_start": current_week_start
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)