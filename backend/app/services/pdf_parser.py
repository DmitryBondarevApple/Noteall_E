import logging
import fitz  # PyMuPDF
import pytesseract
from PIL import Image
import io

logger = logging.getLogger(__name__)


def extract_text_from_pdf(pdf_bytes: bytes, max_chars: int = 100000) -> str:
    """Extract text from PDF. Falls back to OCR if no text layer found."""
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        logger.warning(f"Failed to open PDF: {e}")
        return ""

    # Step 1: Try direct text extraction
    text_parts = []
    for page in doc:
        text = page.get_text("text")
        if text.strip():
            text_parts.append(text.strip())

    if text_parts:
        result = "\n\n".join(text_parts)
        doc.close()
        if len(result) > max_chars:
            result = result[:max_chars] + "\n...[обрезано]"
        logger.info(f"PDF text extracted: {len(result)} chars (text layer)")
        return result

    # Step 2: OCR fallback
    logger.info("No text layer found, running OCR...")
    ocr_parts = []
    for i, page in enumerate(doc):
        try:
            pix = page.get_pixmap(dpi=200)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            ocr_text = pytesseract.image_to_string(img, lang="rus+eng")
            if ocr_text.strip():
                ocr_parts.append(ocr_text.strip())
        except Exception as e:
            logger.warning(f"OCR failed for page {i}: {e}")

    doc.close()

    if ocr_parts:
        result = "\n\n".join(ocr_parts)
        if len(result) > max_chars:
            result = result[:max_chars] + "\n...[обрезано]"
        logger.info(f"PDF text extracted: {len(result)} chars (OCR)")
        return result

    logger.warning("No text extracted from PDF")
    return ""
