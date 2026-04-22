from fastapi import FastAPI, HTTPException, Depends, status
from pydantic import BaseModel
from jose import JWTError, jwt
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
from typing import List

app = FastAPI(title="Service Management Service")

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
SECRET_KEY = os.getenv("SECRET_KEY", "secret")
ALGORITHM = "HS256"

client = AsyncIOMotorClient(MONGO_URL)
db = client.service_db
services_collection = db.services

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

class ServiceInput(BaseModel):
    name: str
    price: float
    duration: int # duration in minutes

class ServiceOutput(BaseModel):
    id: str
    name: str
    price: float
    duration: int

def serialize_service(service_doc) -> dict:
    return {
        "id": str(service_doc["_id"]),
        "name": service_doc["name"],
        "price": service_doc["price"],
        "duration": service_doc["duration"],
    }

@app.post("/service", response_model=ServiceOutput)
async def create_service(service: ServiceInput, admin=Depends(require_admin)):
    service_dict = service.model_dump()
    result = await services_collection.insert_one(service_dict)
    service_dict["_id"] = result.inserted_id
    return serialize_service(service_dict)

@app.put("/service/{id}", response_model=ServiceOutput)
async def update_service(id: str, service: ServiceInput, admin=Depends(require_admin)):
    result = await services_collection.update_one(
        {"_id": ObjectId(id)}, {"$set": service.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    
    updated_service = await services_collection.find_one({"_id": ObjectId(id)})
    return serialize_service(updated_service)

@app.delete("/service/{id}")
async def delete_service(id: str, admin=Depends(require_admin)):
    result = await services_collection.delete_one({"_id": ObjectId(id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    return {"message": "Service deleted successfully"}

@app.get("/services", response_model=List[ServiceOutput])
async def get_services():
    cursor = services_collection.find({})
    services = await cursor.to_list(length=100)
    return [serialize_service(s) for s in services]
