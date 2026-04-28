import os
import fitz  # PyMuPDF
import docx
import spacy
import uuid

# Load English tokenizer, tagger, parser and NER
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    # Fallback to basic if model isn't downloaded yet
    from spacy.lang.en import English
    nlp = English()
    nlp.add_pipe("sentencizer")

def extract_text_from_pdf(filepath):
    """
    Extract text and preserve simple structure from PDF.
    Returns a list of dicts: {"text": str, "page": int, "section": str}
    """
    doc = fitz.open(filepath)
    content = []
    current_section = "Document Start"
    
    for page_num, page in enumerate(doc):
        blocks = page.get_text("dict")["blocks"]
        for b in blocks:
            if b['type'] == 0:  # text block
                block_text = ""
                is_heading = False
                for l in b["lines"]:
                    for s in l["spans"]:
                        block_text += s["text"] + " "
                        # A very heuristic way to detect headings: large font size or bold
                        if s["size"] > 14 or "bold" in s["font"].lower():
                            is_heading = True
                
                block_text = block_text.strip()
                if not block_text:
                    continue
                
                if is_heading and len(block_text.split()) < 15:
                    current_section = block_text
                else:
                    content.append({
                        "text": block_text,
                        "page": page_num + 1,
                        "section": current_section
                    })
    return content

def extract_text_from_docx(filepath):
    """
    Extract text and headings from DOCX.
    """
    doc = docx.Document(filepath)
    content = []
    current_section = "Document Start"
    
    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            continue
            
        if para.style.name.startswith('Heading'):
            current_section = text
        else:
            content.append({
                "text": text,
                "page": 1, # DOCX doesn't have reliable page numbers via python-docx
                "section": current_section
            })
    return content

def extract_text_from_txt(filepath):
    content = []
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()
    # Basic split by paragraphs
    paragraphs = text.split('\n\n')
    for p in paragraphs:
        if p.strip():
            content.append({
                "text": p.strip(),
                "page": 1,
                "section": "General"
            })
    return content

def chunk_content(content_list, doc_id, max_chunk_size=500):
    """
    Semantic chunking using spaCy to split on sentence boundaries.
    Respects heading boundaries (content_list items are separated by sections/blocks).
    """
    chunks = []
    
    for item in content_list:
        text = item["text"]
        doc = nlp(text)
        
        current_chunk_text = ""
        char_offset = 0
        
        for sent in doc.sents:
            sent_text = sent.text.strip() + " "
            
            if len(current_chunk_text) + len(sent_text) > max_chunk_size and current_chunk_text:
                chunks.append({
                    "chunk_id": str(uuid.uuid4()),
                    "doc_id": doc_id,
                    "text": current_chunk_text.strip(),
                    "page": item["page"],
                    "section": item["section"],
                    "char_offset": char_offset
                })
                char_offset += len(current_chunk_text)
                current_chunk_text = sent_text
            else:
                current_chunk_text += sent_text
                
        if current_chunk_text:
            chunks.append({
                "chunk_id": str(uuid.uuid4()),
                "doc_id": doc_id,
                "text": current_chunk_text.strip(),
                "page": item["page"],
                "section": item["section"],
                "char_offset": char_offset
            })
            
    return chunks

def process_document(filepath, doc_id):
    ext = filepath.lower().split('.')[-1]
    if ext == 'pdf':
        content_list = extract_text_from_pdf(filepath)
    elif ext == 'docx':
        content_list = extract_text_from_docx(filepath)
    elif ext in ['txt', 'md']:
        content_list = extract_text_from_txt(filepath)
    else:
        raise ValueError("Unsupported file type")
        
    chunks = chunk_content(content_list, doc_id)
    return chunks
