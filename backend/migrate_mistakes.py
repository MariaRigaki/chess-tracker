import pandas as pd
import sqlite3
from datetime import datetime
import os

CSV_PATH = "../data/Weekly Activity & Game Tracker (2026) - Game mistakes.csv"
DB_PATH = "chess_activities.db"

def migrate():
    if not os.path.exists(CSV_PATH):
        print(f"CSV file not found at {CSV_PATH}")
        return

    # Read the CSV
    df = pd.read_csv(CSV_PATH)
    
    # Clean up column names to match our desired schema
    # Expected columns: Date Played, Game Type, Time Control, Opponent Name, Opponent Rating, Result, 
    # Move number, Mistake Category, “Got It Wrong” vs “Didn’t See It”, One-sentence fix, Training prescription, URL or OTB, Annotations (Check)
    
    # Rename columns for easier access
    df = df.rename(columns={
        'Date Played': 'date',
        'Game Type': 'game_type',
        'Time Control': 'time_control',
        'Opponent Name': 'opponent_name',
        'Opponent Rating': 'opponent_rating',
        'Result': 'result',
        'Move number': 'move_number',
        'Mistake Category': 'mistake_category',
        '“Got It Wrong” vs “Didn’t See It”': 'cause',
        'One-sentence fix': 'fix',
        'Training prescription': 'training',
        'URL or OTB': 'url',
        'Annotations (Check)': 'annotations'
    })

    # Drop rows where Date is NaN (empty rows)
    df = df.dropna(subset=['date'])

    # Convert date to ISO format
    def parse_date(date_str):
        try:
            return datetime.strptime(str(date_str).strip(), "%d/%m/%Y").date().isoformat()
        except:
            return None

    df['date'] = df['date'].apply(parse_date)
    df = df.dropna(subset=['date'])

    # Connect to SQLite
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS mistakes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            game_type TEXT,
            time_control TEXT,
            opponent_name TEXT,
            opponent_rating INTEGER,
            result TEXT,
            move_number INTEGER,
            mistake_category TEXT,
            cause TEXT,
            fix TEXT,
            training TEXT,
            url TEXT,
            annotations TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Insert data
    for index, row in df.iterrows():
        try:
            # Handle NaN values for text fields
            def clean_val(val):
                return str(val) if pd.notna(val) else None
            
            def clean_int(val):
                try:
                    return int(val) if pd.notna(val) else None
                except:
                    return None

            cursor.execute('''
                INSERT INTO mistakes (
                    date, game_type, time_control, opponent_name, opponent_rating, 
                    result, move_number, mistake_category, cause, fix, training, url, annotations
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                row['date'], 
                clean_val(row['game_type']), 
                clean_val(row['time_control']), 
                clean_val(row['opponent_name']), 
                clean_int(row['opponent_rating']), 
                clean_val(row['result']), 
                clean_int(row['move_number']), 
                clean_val(row['mistake_category']), 
                clean_val(row['cause']), 
                clean_val(row['fix']), 
                clean_val(row['training']), 
                clean_val(row['url']), 
                clean_val(row['annotations'])
            ))
        except Exception as e:
            print(f"Error inserting row {index}: {e}")
    
    conn.commit()
    conn.close()
    print(f"Successfully migrated {len(df)} mistake records to {DB_PATH}")

if __name__ == "__main__":
    migrate()
