#!/bin/bash

# Function to handle cleanup on exit
cleanup() {
    echo "Stopping servers..."
    kill $BACKEND_PID
    kill $FRONTEND_PID
    exit
}

trap cleanup SIGINT SIGTERM

echo "Starting Chess Activity Tracker..."

# Start Backend
echo "Starting Backend..."
cd backend
conda run -n chess uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

# Start Frontend
echo "Starting Frontend..."
cd ../frontend
npm run dev -- --port 5173 &
FRONTEND_PID=$!

echo "App is running!"
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:5173"

# Wait for processes
wait
