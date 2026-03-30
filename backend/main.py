from fastapi import FastAPI
from pydantic import BaseModel
from transformers import pipeline
from fastapi.middleware.cors import CORSMiddleware
from tinydb import TinyDB, Query
from datetime import datetime
import uvicorn
import os

# 1. Initialize App FIRST
app = FastAPI()

# 2. Add Middleware (Corrected Order)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Database & AI Setup
db = TinyDB('data.json')
history_table = db.table('history')
blocked_table = db.table('blocked')
users_table = db.table('users') 
Record = Query()

print("--- AI MODEL LOADING (This may take a few minutes) ---")
# This model is ~1GB, Hugging Face will handle this in its 16GB RAM
classifier = pipeline("text-classification", model="unitary/multilingual-toxic-xlm-roberta", top_k=None)

class CommentRequest(BaseModel):
    text: str
    email: str = None

@app.get("/")
async def health_check():
    return {"status": "SafeSpace AI Backend is Running"}

@app.get("/user-status/{email}")
async def get_user_status(email: str):
    user = users_table.get(Record.email == email)
    if not user:
        users_table.insert({'email': email, 'strikes': 5})
        return {'strikes': 5}
    if user.get('strikes', 5) <= 0:
        users_table.update({'strikes': 5}, Record.email == email)
        return {'strikes': 5}
    return user

@app.post("/analyze")
async def analyze_comment(request: CommentRequest):
    content = request.text.lower().strip()
    email = request.email
    all_blocked = [item['text'].lower().strip() for item in blocked_table.all()]
    is_blocked = any(blocked_word in content for blocked_word in all_blocked if blocked_word)

    results = classifier(request.text)[0]
    highest_score = 0
    for res in results:
        if res['label'] in ['toxic', 'insult', 'obscene', 'threat', 'identity_hate']:
            if res['score'] > highest_score:
                highest_score = res['score']
    
    is_hateful = is_blocked or (highest_score > 0.45)

    new_strike_count = 5
    if is_hateful and email:
        user = users_table.get(Record.email == email)
        if user:
            current = user.get('strikes', 5)
            new_strike_count = max(0, current - 1)
            users_table.update({'strikes': new_strike_count}, Record.email == email)
        else:
            users_table.insert({'email': email, 'strikes': 4})
            new_strike_count = 4

    return {
        "is_hateful": is_hateful, 
        "score": float(highest_score), 
        "remaining_strikes": new_strike_count,
        "label": "BLOCKED_WORD" if is_blocked else "AI_DETECTED"
    }

@app.post("/submit")
async def submit_comment(request: CommentRequest):
    history_table.insert({'text': request.text.strip(), 'time': datetime.now().strftime("%I:%M %p"), 'status': 'PENDING'})
    return {"status": "success"}

@app.get("/history")
async def get_history():
    return [item for item in history_table.all() if item.get('status') == 'PENDING']

@app.get("/blocked")
async def get_blocked():
    return blocked_table.all()

@app.post("/learn")
async def learn_hate(request: CommentRequest):
    clean_text = request.text.lower().strip()
    if not blocked_table.search(Record.text == clean_text):
        blocked_table.insert({'text': clean_text})
    history_table.remove(Record.text == request.text)
    return {"status": "learned"}

@app.post("/unblock")
async def unblock_word(request: CommentRequest):
    blocked_table.remove(Record.text == request.text.lower().strip())
    return {"status": "unblocked"}

@app.post("/ignore")
async def ignore_comment(request: CommentRequest):
    history_table.remove(Record.text == request.text)
    return {"status": "deleted"}

if __name__ == "__main__":
    # Hugging Face uses port 7860 by default
    port = int(os.environ.get("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)