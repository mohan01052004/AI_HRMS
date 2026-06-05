"""
migrate_mongo_to_cloud.py - Copies all collections from local MongoDB to MongoDB Atlas cloud.
"""
from pymongo import MongoClient

LOCAL_URL = "mongodb://localhost:27017"
CLOUD_URL = "mongodb+srv://mohan2004143_db_user:ppiNE9D7Bz1QOuNR@cluster0.feddway.mongodb.net/?appName=Cluster0"
DB_NAME = "aihrms"

COLLECTIONS = [
    "resume_screenings",
    "chat_history",
    "ai_logs",
    "voice_interviews",
    "video_interviews",
]

def migrate():
    local_client = MongoClient(LOCAL_URL)
    cloud_client = MongoClient(CLOUD_URL)
    
    local_db = local_client[DB_NAME]
    cloud_db = cloud_client[DB_NAME]
    
    print("[OK] Connected to both local and cloud MongoDB databases.\n")
    
    for coll_name in COLLECTIONS:
        # Check local collection
        local_coll = local_db[coll_name]
        docs = list(local_coll.find({}))
        
        print(f"Collection '{coll_name}': {len(docs)} documents found locally.")
        
        # Clear cloud collection
        cloud_coll = cloud_db[coll_name]
        cloud_coll.delete_many({})
        print(f"  [OK] Cleared cloud collection '{coll_name}'.")
        
        if docs:
            # Insert to cloud
            cloud_coll.insert_many(docs)
            print(f"  [OK] Successfully migrated {len(docs)} documents to cloud.")
        else:
            print(f"  [INFO] No documents to migrate for '{coll_name}'.")
            
    print("\n[DONE] MongoDB migration completed successfully!")

if __name__ == "__main__":
    migrate()
