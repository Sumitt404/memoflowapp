import os
import re
import logging
from collections import defaultdict
from typing import List, Optional

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

import chromadb
from openai import AsyncOpenAI
from groq import AsyncGroq

# ==========================================
# 0. SETUP & CONFIGURATION
# ==========================================
load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("MemoFlow")

app = FastAPI(title="MemoFlow API", description="AI Support Agent with Hindsight and cascadeflow")

# Add CORS middleware to allow the frontend to communicate with the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For the hackathon MVP, allow all origins. In production, specify your frontend URL.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize API Clients
# In a real environment, you'd want to ensure these keys exist. 
# For safety, we allow initialization and catch errors during the request.
openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", "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"))
groq_client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY", "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"))

# Initialize ChromaDB for Hindsight (Ephemeral Client for Hackathon MVP)
chroma_client = chromadb.Client()
user_history_collection = chroma_client.get_or_create_collection(name="user_history")

# Token Budgeting (In-memory dict for Hackathon MVP)
# Default budget is 5000 tokens per session_id
SESSION_BUDGETS = defaultdict(lambda: 5000)
MAX_BUDGET = 5000

# ==========================================
# 1. PYDANTIC MODELS (API CONTRACT)
# ==========================================
class MessageDict(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    session_id: str
    message: str
    history: List[MessageDict] = []

class ChatResponse(BaseModel):
    response_text: str
    active_model: str
    tokens_used: int
    budget_remaining: int
    hindsight_triggered: bool

# ==========================================
# 2. STARTUP EVENT: SEEDING HINDSIGHT
# ==========================================
@app.on_event("startup")
async def startup_event():
    """
    Phase 3: Hindsight Engine Initialization.
    We seed the Vector DB with dummy data mimicking past resolved tickets 
    so the hackathon demo works flawlessly out of the box.
    """
    logger.info("Seeding ChromaDB 'user_history' with dummy data...")
    user_history_collection.add(
        documents=[
            "User is running PostgreSQL 14 on an AWS t3.medium instance. Previous timeout issues were resolved by increasing max_connections to 200.",
            "User deployment pipeline relies on GitHub Actions. Node version is 18.x."
        ],
        metadatas=[
            {"session_id": "USR-992-TX"},
            {"session_id": "USR-404-JS"}
        ],
        ids=["seed_db_1", "seed_db_2"]
    )
    logger.info("Hindsight DB seeded successfully.")

# ==========================================
# 3. CORE LOGIC: CASCADEFLOW & HINDSIGHT
# ==========================================
def classify_intent(message: str) -> bool:
    """
    Phase 2: cascadeflow Intent Classification.
    Uses a fast regex rule to detect complex technical issues.
    Returns True if COMPLEX (requires GPT-4), False if SIMPLE (can use Llama-3).
    """
    complex_keywords = re.compile(
        r'\b(error|debug|timeout|fail|failing|code|deploy|exception|crash|architecture)\b', 
        re.IGNORECASE
    )
    return bool(complex_keywords.search(message))

# ==========================================
# 4. API ENDPOINTS
# ==========================================
@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    session_id = request.session_id
    user_message = request.message
    
    # ---------------------------------------
    # A. Token Budget Pre-Check
    # ---------------------------------------
    current_budget = SESSION_BUDGETS[session_id]
    if current_budget <= 0:
        logger.warning(f"Session {session_id} exceeded token budget.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token budget of 5000 exceeded for this session. Please upgrade your plan or restart the session."
        )

    # ---------------------------------------
    # B. Phase 3: Hindsight Engine (Retrieval)
    # ---------------------------------------
    hindsight_triggered = False
    system_prompt = "You are MemoFlow, an expert, concise AI support agent."
    
    try:
        # Query ChromaDB based on the exact session_id
        results = user_history_collection.query(
            query_texts=[user_message],
            n_results=1,
            where={"session_id": session_id}
        )
        
        # If we find relevant context, inject it into the system prompt
        if results and results['documents'] and len(results['documents'][0]) > 0:
            retrieved_context = results['documents'][0][0]
            system_prompt += f"\n\nHINDSIGHT CONTEXT (Skip basic troubleshooting based on this): {retrieved_context}"
            hindsight_triggered = True
            logger.info(f"Hindsight triggered for {session_id}.")
            
    except Exception as e:
        logger.error(f"Hindsight vector retrieval failed: {str(e)}")
        # We don't want a DB failure to crash the chat, so we log and proceed
        pass

    # ---------------------------------------
    # C. Phase 2: cascadeflow Router
    # ---------------------------------------
    is_complex = classify_intent(user_message)
    active_model_name = "GPT-4 (Escalated)" if is_complex else "Llama-3 (Groq)"
    
    # Build the messages payload
    messages_payload = [{"role": "system", "content": system_prompt}]
    for msg in request.history:
        messages_payload.append({"role": msg.role, "content": msg.content})
    messages_payload.append({"role": "user", "content": user_message})

    # ---------------------------------------
    # D. Model Execution
    # ---------------------------------------
    response_text = ""
    tokens_used = 0

    try:
        if is_complex:
            # Route to OpenAI (High Reasoning)
            response = await openai_client.chat.completions.create(
                model="gpt-4-turbo",  # Or "gpt-4o"
                messages=messages_payload,
                max_tokens=500
            )
            response_text = response.choices[0].message.content
            tokens_used = response.usage.total_tokens
        else:
            # Route to Groq (Fast / Cheap)
            response = await groq_client.chat.completions.create(
                model="llama3-8b-8192",
                messages=messages_payload,
                max_tokens=500
            )
            response_text = response.choices[0].message.content
            tokens_used = response.usage.total_tokens
            
    except Exception as e:
        logger.error(f"LLM API Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while contacting the AI provider: {str(e)}"
        )

    # ---------------------------------------
    # E. Token Budget Post-Update
    # ---------------------------------------
    SESSION_BUDGETS[session_id] -= tokens_used
    
    # Prepend hindsight notification for hackathon visibility if triggered
    if hindsight_triggered:
        response_text = f"**[HINDSIGHT TRIGGERED]**\n{response_text}"

    return ChatResponse(
        response_text=response_text,
        active_model=active_model_name,
        tokens_used=tokens_used,
        budget_remaining=SESSION_BUDGETS[session_id],
        hindsight_triggered=hindsight_triggered
    )

# Run instructions for local testing:
# uvicorn main:app --reload