import requests
from fastapi import FastAPI, Request, Form, Depends
from fastapi.responses import HTMLResponse

class_name = "btn btn-primary"
from fastapi.templating import Jinja2Templates
from sqlmodel import SQLModel, Session, create_engine, select
from models import Activity, ChessGame
from datetime import datetime, date, timedelta
import collections

app = FastAPI()
templates = Jinja2Templates(directory="templates")

# SQLite setup
sqlite_url = "sqlite:///./tracker.db"
engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})


@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session


# --- ROUTES ---


@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request, session: Session = Depends(get_session)):
    activities = session.exec(
        select(Activity).order_by(Activity.activity_date.desc()).limit(10)
    ).all()
    chess_games = session.exec(
        select(ChessGame).order_by(ChessGame.played_at.desc()).limit(10)
    ).all()
    return templates.TemplateResponse(
        "dashboard.html",
        {
            "request": request,
            "activities": activities,
            "chess_games": chess_games,
            "today": date.today(),
        },
    )


@app.get("/dashboard")
async def get_dashboard(request: Request):
    return templates.TemplateResponse(
        "dashboard_content.html",
        {"request": request},
    )


@app.get("/stats")
async def get_stats(request: Request, session: Session = Depends(get_session)):
    activities = session.exec(
        select(Activity).order_by(Activity.activity_date.desc())
    ).all()

    # Filter based on query params
    filter_param = request.query_params.get("filter")
    today = date.today()
    if filter_param == "current_week":
        year, week, _ = today.isocalendar()
        start_of_week = today - timedelta(days=today.weekday())
        activities = [a for a in activities if a.activity_date >= start_of_week]
    elif filter_param == "last_week":
        last_week_start = today - timedelta(days=today.weekday() + 7)
        last_week_end = last_week_start + timedelta(days=6)
        activities = [
            a for a in activities if last_week_start <= a.activity_date <= last_week_end
        ]
    elif filter_param == "current_month":
        start_of_month = date(today.year, today.month, 1)
        activities = [a for a in activities if a.activity_date >= start_of_month]

    # Grouping by week
    weekly_data = collections.defaultdict(list)
    for act in activities:
        year, week, _ = act.activity_date.isocalendar()
        week_key = f"{year} - Week {week}"
        weekly_data[week_key].append(act)

    # Sort weeks descending
    sorted_weeks = sorted(weekly_data.items(), key=lambda x: x[0], reverse=True)

    template = "partial_stats.html" if filter_param else "stats_tab.html"
    return templates.TemplateResponse(
        template,
        {"request": request, "weekly_data": sorted_weeks, "today": date.today()},
    )


@app.get("/log-view")
async def get_log_view(request: Request, session: Session = Depends(get_session)):
    activities = session.exec(
        select(Activity).order_by(Activity.activity_date.desc())
    ).all()

    # Grouping by week
    weekly_data = collections.defaultdict(list)
    for act in activities:
        year, week, _ = act.activity_date.isocalendar()
        week_key = f"{year} - Week {week}"
        weekly_data[week_key].append(act)

    # Sort weeks descending
    sorted_weeks = sorted(weekly_data.items(), key=lambda x: x[0], reverse=True)

    return templates.TemplateResponse(
        "log_view.html",
        {"request": request, "weekly_data": sorted_weeks, "today": date.today()},
    )


@app.get("/chess")
async def get_chess(request: Request, session: Session = Depends(get_session)):
    chess_games = session.exec(
        select(ChessGame).order_by(ChessGame.played_at.desc()).limit(10)
    ).all()
    return templates.TemplateResponse(
        "chess_tab.html", {"request": request, "chess_games": chess_games}
    )


@app.post("/log-activity/", response_class=HTMLResponse)
async def log_activity(
    name: str = Form(...),
    minutes: int = Form(...),
    activity_date: date = Form(...),
    comment: str = Form(""),
    session: Session = Depends(get_session),
):
    # Ensure your Activity model (in models.py) has 'minutes' and 'comment' fields
    new_activity = Activity(
        name=name, minutes=minutes, comment=comment, activity_date=activity_date
    )
    session.add(new_activity)
    session.commit()

    # Return a snippet of the new log entry to update the UI
    return f"""
    <li class="flex justify-between items-center text-slate-300 bg-slate-800/50 p-3 rounded">
        <span>{name} - {minutes} min</span>
        <span class="text-xs text-slate-500">{activity_date.strftime('%m-%d')} at {datetime.now().strftime('%H:%M')}</span>
    </li>
    """


@app.post("/sync-chess/")
async def sync_chess(
    username: str = Form(...), session: Session = Depends(get_session)
):
    # Lichess API Open Source endpoint
    response = requests.get(
        f"https://lichess.org/api/games/user/{username}",
        params={"max": 5, "perfType": "rapid,classical"},
        headers={"Accept": "application/x-ndjson"},
    )

    if response.status_code == 200:
        # Simple parser for Lichess NDJSON format
        for line in response.text.strip().split("\n"):
            game_data = eval(line.replace("false", "False").replace("true", "True"))

            # Check if game already exists to avoid duplicates
            existing = session.exec(
                select(ChessGame).where(ChessGame.id == game_data["id"])
            ).first()
            if not existing:
                is_white = (
                    game_data["players"]["white"]["user"]["name"].lower()
                    == username.lower()
                )
                my_color = "white" if is_white else "black"

                result = "draw"
                if "winner" in game_data:
                    result = "win" if game_data["winner"] == my_color else "loss"

                game = ChessGame(
                    id=game_data["id"],
                    source="Lichess",
                    my_rating=game_data["players"][my_color]["rating"],
                    opponent_rating=game_data["players"][
                        "black" if is_white else "white"
                    ]["rating"],
                    result=result,
                    played_at=datetime.fromtimestamp(game_data["createdAt"] // 1000),
                )
                session.add(game)
        session.commit()
    return "<div>Chess Synced! Refresh to see games.</div>"


@app.post("/add-manual-game/")
async def add_manual_game(
    source: str = Form(...),
    result: str = Form(...),
    my_rating: int = Form(...),
    opponent_rating: int = Form(...),
    played_at: datetime = Form(...),
    error_category: str = Form(""),
    comment: str = Form(""),
    session: Session = Depends(get_session),
):
    # Generate a unique ID for manual games
    import uuid

    game_id = f"manual-{uuid.uuid4().hex[:8]}"

    game = ChessGame(
        id=game_id,
        source=source,
        result=result,
        my_rating=my_rating,
        opponent_rating=opponent_rating,
        played_at=played_at,
        error_category=error_category or None,
        comment=comment or None,
    )
    session.add(game)
    session.commit()

    # Return the new game row
    result_class = (
        "bg-green-900 text-green-300"
        if result == "win"
        else (
            "bg-red-900 text-red-300"
            if result == "loss"
            else "bg-slate-700 text-slate-300"
        )
    )
    selected_blunder = "selected" if error_category == "Tactical Blunder" else ""
    selected_positional = "selected" if error_category == "Positional Error" else ""
    selected_opening = "selected" if error_category == "Opening Theory" else ""
    selected_time = "selected" if error_category == "Time Management" else ""
    selected_calculation = "selected" if error_category == "Calculation Error" else ""
    selected_endgame = "selected" if error_category == "Endgame Technique" else ""
    selected_no_error = "selected" if error_category == "No Error" else ""
    selected_empty = "selected" if not error_category else ""

    return f"""
    <tr class="border-t border-slate-800">
        <td class="py-3 text-sm text-blue-400">{source}</td>
        <td class="py-3 text-sm">{played_at.strftime('%m-%d %H:%M')}</td>
        <td class="py-3">
            <span class="px-2 py-1 rounded text-xs font-bold {result_class}">
                {result.upper()}
            </span>
        </td>
        <td class="py-3 font-mono">{my_rating}</td>
        <td class="py-3 text-slate-400">{opponent_rating}</td>
        <td class="py-3">
            <form hx-post="/update-chess/{game_id}" hx-target="closest tr" class="inline">
                <select name="error_category" class="bg-slate-800 border border-slate-700 p-1 rounded text-white text-xs">
                    <option value="" {selected_empty}></option>
                    <option value="Tactical Blunder" {selected_blunder}>Tactical Blunder</option>
                    <option value="Positional Error" {selected_positional}>Positional Error</option>
                    <option value="Opening Theory" {selected_opening}>Opening Theory</option>
                    <option value="Time Management" {selected_time}>Time Management</option>
                    <option value="Calculation Error" {selected_calculation}>Calculation Error</option>
                    <option value="Endgame Technique" {selected_endgame}>Endgame Technique</option>
                    <option value="No Error" {selected_no_error}>No Error</option>
                </select>
        </td>
        <td class="py-3">
                <input type="text" name="comment" value="{comment or ''}" class="bg-slate-800 border border-slate-700 p-1 rounded text-white text-xs w-full">
        </td>
        <td class="py-3 flex gap-1">
                <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded">
                    Save
                </button>
                <button 
                    hx-delete="/delete-chess/{game_id}" 
                    hx-target="closest tr" 
                    hx-swap="outerHTML"
                    class="bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1 rounded">
                    🗑️
                </button>
            </form>
        </td>
    </tr>
    """


@app.post("/update-chess/{game_id}")
async def update_chess(
    game_id: str,
    error_category: str = Form(...),
    comment: str = Form(...),
    session: Session = Depends(get_session),
):
    game = session.get(ChessGame, game_id)
    if game:
        game.error_category = error_category or None
        game.comment = comment or None
        session.commit()

    # Return the updated row
    result_class = (
        "bg-green-900 text-green-300"
        if game.result == "win"
        else (
            "bg-red-900 text-red-300"
            if game.result == "loss"
            else "bg-slate-700 text-slate-300"
        )
    )
    selected_blunder = "selected" if game.error_category == "Tactical Blunder" else ""
    selected_positional = (
        "selected" if game.error_category == "Positional Error" else ""
    )
    selected_opening = "selected" if game.error_category == "Opening Theory" else ""
    selected_time = "selected" if game.error_category == "Time Management" else ""
    selected_calculation = (
        "selected" if game.error_category == "Calculation Error" else ""
    )
    selected_endgame = "selected" if game.error_category == "Endgame Technique" else ""
    selected_no_error = "selected" if game.error_category == "No Error" else ""
    selected_empty = "selected" if not game.error_category else ""

    return f"""
    <tr class="border-t border-slate-800">
        <td class="py-3 text-sm text-blue-400">{game.source}</td>
        <td class="py-3 text-sm">{game.played_at.strftime('%m-%d %H:%M')}</td>
        <td class="py-3">
            <span class="px-2 py-1 rounded text-xs font-bold {result_class}">
                {game.result.upper()}
            </span>
        </td>
        <td class="py-3 font-mono">{game.my_rating}</td>
        <td class="py-3 text-slate-400">{game.opponent_rating}</td>
        <td class="py-3">
            <form hx-post="/update-chess/{game.id}" hx-target="closest tr" class="inline">
                <select name="error_category" class="bg-slate-800 border border-slate-700 p-1 rounded text-white text-xs">
                    <option value="" {selected_empty}></option>
                    <option value="Tactical Blunder" {selected_blunder}>Tactical Blunder</option>
                    <option value="Positional Error" {selected_positional}>Positional Error</option>
                    <option value="Opening Theory" {selected_opening}>Opening Theory</option>
                    <option value="Time Management" {selected_time}>Time Management</option>
                    <option value="Calculation Error" {selected_calculation}>Calculation Error</option>
                    <option value="Endgame Technique" {selected_endgame}>Endgame Technique</option>
                    <option value="No Error" {selected_no_error}>No Error</option>
                </select>
        </td>
        <td class="py-3">
                <input type="text" name="comment" value="{game.comment or ''}" class="bg-slate-800 border border-slate-700 p-1 rounded text-white text-xs w-full">
        </td>
        <td class="py-3 flex gap-1">
                <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded">
                    Save
                </button>
                <button 
                    hx-delete="/delete-chess/{game.id}" 
                    hx-target="closest tr" 
                    hx-swap="outerHTML"
                    class="bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1 rounded">
                    🗑️
                </button>
            </form>
        </td>
    </tr>
    """


@app.delete("/delete-activity/{activity_id}")
async def delete_activity(activity_id: int, session: Session = Depends(get_session)):
    activity = session.get(Activity, activity_id)
    if activity:
        session.delete(activity)
        session.commit()
    return {"deleted": True}


@app.delete("/delete-chess/{game_id}")
async def delete_chess(game_id: str, session: Session = Depends(get_session)):
    game = session.get(ChessGame, game_id)
    if game:
        session.delete(game)
        session.commit()
    return {"deleted": True}
