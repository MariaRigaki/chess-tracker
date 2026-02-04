import pandas as pd
import sqlite3
from datetime import datetime
import os

CSV_PATH = "../data/Weekly Activity & Game Tracker (2026) - Activities.csv"
DB_PATH = "chess_activities.db"

def migrate():
    if not os.path.exists(CSV_PATH):
        print(f"CSV file not found at {CSV_PATH}")
        return

    # Read the CSV, skipping the first row which is empty commas
    df = pd.read_csv(CSV_PATH, skiprows=1, usecols=[0, 1, 2, 3, 4, 5])
    
    # Drop rows where Date is NaN
    df = df.dropna(subset=['Date'])
    
    # Clean up column names
    df.columns = ['date', 'week', 'category', 'minutes', 'details', 'hours']
    
    # Convert date to ISO format
    def parse_date(date_str):
        try:
            # Handle potential whitespace
            date_str = str(date_str).strip()
            return datetime.strptime(date_str, "%d/%m/%Y").date().isoformat()
        except Exception as e:
            # print(f"Error parsing date {date_str}: {e}")
            return None

    df['date'] = df['date'].apply(parse_date)
    df = df.dropna(subset=['date'])
    
    # Connect to SQLite
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            week INTEGER NOT NULL,
            category TEXT NOT NULL,
            minutes INTEGER NOT NULL,
            details TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Insert data
    for index, row in df.iterrows():
        try:
            cursor.execute('''
                INSERT INTO activities (date, week, category, minutes, details)
                VALUES (?, ?, ?, ?, ?)
            ''', (row['date'], int(row['week']), row['category'], int(row['minutes']), row['details']))
        except Exception as e:
            print(f"Error inserting row {index}: {e}")
    
    conn.commit()
    conn.close()
    print(f"Successfully migrated {len(df)} records to {DB_PATH}")

if __name__ == "__main__":
    migrate()