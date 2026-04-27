import os
import io
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import google.genai as genai
from google.genai import types
from dotenv import load_dotenv
from pypdf import PdfReader

# 환경 변수 로드
load_dotenv()

# Gemini API 설정
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

app = FastAPI(title="AI Chatbot Backend")

# 기본 CORS 허용 목록 (로컬 개발용)
default_origins = ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"]
frontend_origins = os.getenv("FRONTEND_ORIGINS")
allowed_origins = [origin.strip() for origin in frontend_origins.split(",")] if frontend_origins else default_origins

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    history: list = Field(default_factory=list)
    pdf_context: str = ""
    use_search: bool = False

class SummarizeRequest(BaseModel):
    pdf_context: str
    language: str = "ko"


def build_generate_config(use_search: bool) -> types.GenerateContentConfig | None:
    if not use_search:
        return None
    return types.GenerateContentConfig(
        tools=[types.Tool(google_search=types.GoogleSearch())]
    )

@app.post("/api/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    try:
        contents = await file.read()
        pdf_file = io.BytesIO(contents)
        reader = PdfReader(pdf_file)
        
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
            
        return {
            "text": text,
            "filename": file.filename,
            "status": "success"
        }
    except Exception as e:
        print(f"Error parsing PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to parse PDF: {str(e)}")

@app.post("/api/chat")
async def chat(request: ChatRequest):
    if not genai_client:
        raise HTTPException(status_code=500, detail="Gemini API Key not configured")
    
    try:
        # PDF 컨텍스트가 있으면 프롬프트에 추가
        prompt = request.message
        if request.pdf_context:
            prompt = f"[PDF Context Info]\n{request.pdf_context}\n\n[User Message]\n{request.message}\n\nPlease answer the user's message based on the provided PDF context if relevant."

        contents = [*request.history, {"role": "user", "parts": [{"text": prompt}]}]
        response = genai_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=contents,
            config=build_generate_config(request.use_search)
        )
        
        return {
            "response": response.text,
            "status": "success"
        }
    except Exception as e:
        print(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate chat response")

@app.post("/api/summarize")
async def summarize(request: SummarizeRequest):
    if not genai_client:
        raise HTTPException(status_code=500, detail="Gemini API Key not configured")
    
    try:
        prompt = f"""
        당신은 전문적인 문서 분석가입니다. 아래 제공된 PDF 내용을 분석하여 사용자를 위한 '핵심 요약 레포트'를 작성해 주세요.
        
        [요청 사항]
        1. 레포트는 Markdown 형식으로 작성해 주세요.
        2. 제목, 주요 요약, 핵심 포인트(불렛 포인트), 결론/제언 순서로 구성해 주세요.
        3. 전문적이고 가독성이 좋은 톤앤매너를 유지해 주세요.
        4. 언어는 {request.language}로 작성해 주세요.
        
        [PDF 내용]
        {request.pdf_context}
        """
        
        response = genai_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )
        
        return {
            "summary": response.text,
            "status": "success"
        }
    except Exception as e:
        print(f"Error in summarize endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to summarize content")

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
