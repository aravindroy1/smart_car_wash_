from fastapi import FastAPI, HTTPException, Depends, status
from pydantic import BaseModel
from jose import JWTError, jwt
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime
from typing import List

app = FastAPI(title="Notification Service")

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
SECRET_KEY = os.getenv("SECRET_KEY", "secret")
ALGORITHM = "HS256"

client = AsyncIOMotorClient(MONGO_URL)
db = client.notification_db
notifications_collection = db.notifications

security = HTTPBearer()

def get_current_user_payload(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

class NotificationInput(BaseModel):
    user_id: str
    message: str

class NotificationOutput(BaseModel):
    id: str
    message: str
    created_at: str

@app.post("/internal/notify")
async def create_notification(notification: NotificationInput):
    # This endpoint is intended to be called internally by other services (like booking service)
    # in a real microservice architecture, we might secure this via internal network or API key
    doc = {
        "user_id": notification.user_id,
        "message": notification.message,
        "created_at": datetime.utcnow().isoformat()
    }
    result = await notifications_collection.insert_one(doc)
    return {"message": "Notification created"}

@app.get("/notifications", response_model=List[NotificationOutput])
async def get_notifications(payload: dict = Depends(get_current_user_payload)):
    user_id = payload.get("user_id")
    if not user_id:
        # Fallback to sub if user_id wasn't in some old token, though we did include it
        raise HTTPException(status_code=400, detail="Invalid token")

    cursor = notifications_collection.find({"user_id": user_id}).sort("created_at", -1)
    notifications = await cursor.to_list(length=50)
    
    return [
        {
            "id": str(n["_id"]),
            "message": n["message"],
            "created_at": n["created_at"]
        }
        for n in notifications
    ]
