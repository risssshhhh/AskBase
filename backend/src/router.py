import os
import time
from groq import Groq
import google.generativeai as genai

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY and GROQ_API_KEY != "your_groq_api_key_here" else None

if GEMINI_API_KEY and GEMINI_API_KEY != "your_gemini_api_key_here":
    genai.configure(api_key=GEMINI_API_KEY)
    gemini_model = genai.GenerativeModel('gemini-1.5-flash')
else:
    gemini_model = None

class LLMRouter:
    def __init__(self):
        self.models = [
            {"provider": "groq", "model": "llama3-70b-8192"},
            {"provider": "groq", "model": "mixtral-8x7b-32768"},
            {"provider": "gemini", "model": "gemini-1.5-flash"}
        ]

    def generate_stream(self, prompt, history=[]):
        """
        Attempts to generate a response streaming from primary, then fallbacks.
        history format: [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]
        """
        start_time = time.time()
        
        for idx, model_config in enumerate(self.models):
            try:
                if model_config["provider"] == "groq":
                    if not groq_client:
                        raise ValueError("Groq client not initialized (missing API key).")
                        
                    messages = [{"role": "system", "content": "You are AskBase, a precise document intelligence assistant. Rules:\n1. Answer using ONLY the provided context chunks.\n2. If the answer is absent, say exactly: 'This information is not present in the uploaded document.'\n3. Cite your sources using [Chunk X, Page Y] inline.\n4. Never infer, extrapolate, or hallucinate."}]
                    messages.extend(history)
                    messages.append({"role": "user", "content": prompt})

                    stream = groq_client.chat.completions.create(
                        messages=messages,
                        model=model_config["model"],
                        stream=True,
                    )
                    
                    def generate():
                        for chunk in stream:
                            if chunk.choices[0].delta.content is not None:
                                yield chunk.choices[0].delta.content
                                
                    return {
                        "stream": generate(),
                        "model_used": model_config["model"],
                        "latency_ms": (time.time() - start_time) * 1000
                    }
                    
                elif model_config["provider"] == "gemini":
                    if not gemini_model:
                        raise ValueError("Gemini client not initialized (missing API key).")
                        
                    # Gemini format mapping
                    gemini_history = []
                    for msg in history:
                        role = "user" if msg["role"] == "user" else "model"
                        gemini_history.append({"role": role, "parts": [msg["content"]]})
                        
                    system_instruction = "You are AskBase, a precise document intelligence assistant. Answer using ONLY the provided context. Cite sources. Don't hallucinate."
                    
                    chat = gemini_model.start_chat(history=gemini_history)
                    full_prompt = f"System: {system_instruction}\nUser: {prompt}"
                    
                    response = chat.send_message(full_prompt, stream=True)
                    
                    def generate():
                        for chunk in response:
                            if chunk.text:
                                yield chunk.text
                                
                    return {
                        "stream": generate(),
                        "model_used": model_config["model"],
                        "latency_ms": (time.time() - start_time) * 1000
                    }

            except Exception as e:
                print(f"Error with model {model_config['model']}: {e}")
                continue # Try next model
                
        # If all fail
        def generate_error():
            yield "Sorry, I am currently unavailable. Please check API keys or try again later."
            
        return {
            "stream": generate_error(),
            "model_used": "error",
            "latency_ms": (time.time() - start_time) * 1000
        }

router = LLMRouter()
