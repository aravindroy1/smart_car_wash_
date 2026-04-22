import httpx
from fastapi import FastAPI, HTTPException, Depends, status
from pydantic import BaseModel
from jose import JWTError, jwt
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
from datetime import datetime
from typing import List, Optional

app = FastAPI(title="Booking & Queue Service")

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
SECRET_KEY = os.getenv("SECRET_KEY", "secret")
NOTIFICATION_SERVICE_URL = os.getenv("NOTIFICATION_SERVICE_URL", "http://localhost:8004")
ALGORITHM = "HS256"

client = AsyncIOMotorClient(MONGO_URL)
db = client.booking_db
bookings_collection = db.bookings

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

def require_admin(payload: dict = Depends(get_current_user_payload)):
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized. Admin only.")
    return payload

class BookInput(BaseModel):
    service_id: str
    service_name: str
    service_duration: int

class StatusUpdateInput(BaseModel):
    status: str # booked, in_queue, washing, completed

class BookingOutput(BaseModel):
    id: str
    user_id: str
    service_id: str
    service_name: str
    status: str
    queue_position: int
    estimated_time: int
    created_at: str

async def get_queue_info(created_at: str, service_duration: int):
    # count active bookings created before this user
    count = await bookings_collection.count_documents({
        "status": {"$in": ["in_queue", "washing"]},
        "created_at": {"$lt": created_at}
    })
    position = count + 1
    estimated_time = position * service_duration
    return position, estimated_time

def serialize_booking(doc) -> dict:
    return {
        "id": str(doc["_id"]),
        "user_id": doc["user_id"],
        "service_id": doc["service_id"],
        "service_name": doc.get("service_name", "Unknown"),
        "status": doc["status"],
        "queue_position": doc.get("queue_position", 0),
        "estimated_time": doc.get("estimated_time", 0),
        "created_at": doc["created_at"],
    }

async def notify_user(user_id: str, message: str):
    async with httpx.AsyncClient() as client:
        try:
            await client.post(
                f"{NOTIFICATION_SERVICE_URL}/internal/notify",
                json={"user_id": user_id, "message": message}
            )
        except Exception as e:
            print(f"Failed to send notification: {e}")

@app.post("/book", response_model=BookingOutput)
async def create_booking(book: BookInput, payload: dict = Depends(get_current_user_payload)):
    created_at = datetime.utcnow().isoformat()
    user_id = payload.get("user_id")
    
    doc = {
        "user_id": user_id,
        "service_id": book.service_id,
        "service_name": book.service_name,
        "service_duration": book.service_duration,
        "status": "in_queue", # Let's assume they enter queue immediately
        "created_at": created_at
    }
    
    result = await bookings_collection.insert_one(doc)
    doc["_id"] = result.inserted_id
    
    pos, est = await get_queue_info(created_at, book.service_duration)
    doc["queue_position"] = pos
    doc["estimated_time"] = est
    
    # Notify user
    await notify_user(user_id, f"Your booking for {book.service_name} is confirmed. Position: {pos}")
    
    return serialize_booking(doc)

@app.get("/my-bookings", response_model=List[BookingOutput])
async def get_my_bookings(payload: dict = Depends(get_current_user_payload)):
    user_id = payload.get("user_id")
    cursor = bookings_collection.find({"user_id": user_id}).sort("created_at", -1)
    bookings = await cursor.to_list(length=100)
    
    res = []
    for b in bookings:
        if b["status"] in ["in_queue", "washing"]:
            pos, est = await get_queue_info(b["created_at"], b.get("service_duration", 30))
            b["queue_position"] = pos
            b["estimated_time"] = est
        elif b["status"] == "completed":
            b["queue_position"] = 0
            b["estimated_time"] = 0
        res.append(serialize_booking(b))
    return res

@app.get("/queue-status/{booking_id}", response_model=BookingOutput)
async def get_queue_status(booking_id: str, payload: dict = Depends(get_current_user_payload)):
    booking = await bookings_collection.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    if booking["status"] in ["in_queue", "washing"]:
        pos, est = await get_queue_info(booking["created_at"], booking.get("service_duration", 30))
        booking["queue_position"] = pos
        booking["estimated_time"] = est
    else:
        booking["queue_position"] = 0
        booking["estimated_time"] = 0
    return serialize_booking(booking)

@app.put("/booking/{id}/status")
async def update_status(id: str, st: StatusUpdateInput, admin=Depends(require_admin)):
    result = await bookings_collection.update_one(
        {"_id": ObjectId(id)}, {"$set": {"status": st.status}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    booking = await bookings_collection.find_one({"_id": ObjectId(id)})
    
    # Notify user
    if st.status == "washing":
        await notify_user(booking["user_id"], f"Your car is now washing!")
    elif st.status == "completed":
        await notify_user(booking["user_id"], f"Your car wash is completed!")
    
    # Let's also check who is next and notify them if someone is near
    # If a booking finishes, the next in line might need a notification "Your turn is near"
    if st.status in ["washing", "completed"]:
        next_booking = await bookings_collection.find_one(
            {"status": "in_queue"}, sort=[("created_at", 1)]
        )
        if next_booking:
            await notify_user(next_booking["user_id"], "Your turn is near! Get ready.")
            
    return {"message": "Status updated successfully"}

@app.get("/all-active-bookings")
async def get_all_active_bookings(admin=Depends(require_admin)):
    cursor = bookings_collection.find({"status": {"$in": ["in_queue", "washing"]}}).sort("created_at", 1)
    bookings = await cursor.to_list(length=100)
    
    res = []
    for b in bookings:
        pos, est = await get_queue_info(b["created_at"], b.get("service_duration", 30))
        b["queue_position"] = pos
        b["estimated_time"] = est
        res.append(serialize_booking(b))
    return res
