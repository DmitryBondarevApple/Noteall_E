import re
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, HTTPException, Depends
from app.core.database import db
from app.core.security import get_current_user
from app.models.fragment import UncertainFragmentUpdate, UncertainFragmentResponse

router = APIRouter(prefix="/projects/{project_id}/fragments", tags=["fragments"])


@router.get("", response_model=List[UncertainFragmentResponse])
async def get_fragments(project_id: str, user=Depends(get_current_user)):
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    fragments = await db.uncertain_fragments.find({"project_id": project_id}, {"_id": 0}).to_list(1000)
    return [UncertainFragmentResponse(**f) for f in fragments]


@router.put("/{fragment_id}", response_model=UncertainFragmentResponse)
async def update_fragment(
    project_id: str,
    fragment_id: str,
    data: UncertainFragmentUpdate,
    user=Depends(get_current_user)
):
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    fragment = await db.uncertain_fragments.find_one({"id": fragment_id, "project_id": project_id})
    if not fragment:
        raise HTTPException(status_code=404, detail="Fragment not found")
    
    update_data = {"status": data.status}
    if data.corrected_text is not None:
        update_data["corrected_text"] = data.corrected_text
    
    await db.uncertain_fragments.update_one(
        {"id": fragment_id},
        {"$set": update_data}
    )
    
    updated = await db.uncertain_fragments.find_one({"id": fragment_id}, {"_id": 0})
    return UncertainFragmentResponse(**updated)


@router.post("/{fragment_id}/revert", response_model=UncertainFragmentResponse)
async def revert_fragment(
    project_id: str,
    fragment_id: str,
    user=Depends(get_current_user)
):
    """Revert a confirmed fragment back to pending status and restore [word?] marker in transcript"""
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    fragment = await db.uncertain_fragments.find_one({"id": fragment_id, "project_id": project_id})
    if not fragment:
        raise HTTPException(status_code=404, detail="Fragment not found")
    
    if fragment.get("status") != "confirmed":
        raise HTTPException(status_code=400, detail="Only confirmed fragments can be reverted")
    
    # Determine new status
    new_status = "pending"
    if fragment.get("source") == "list":
        transcript = await db.transcripts.find_one(
            {"project_id": project_id, "version_type": "processed"},
            {"_id": 0}
        )
        if transcript:
            word = fragment.get("original_text", "")
            if word and not re.search(re.escape(word), transcript.get("content", ""), re.IGNORECASE):
                new_status = "auto_corrected"
    
    # Update fragment status
    await db.uncertain_fragments.update_one(
        {"id": fragment_id},
        {"$set": {"status": new_status}}
    )
    
    # Restore [word?] marker in transcript
    transcript = await db.transcripts.find_one(
        {"project_id": project_id, "version_type": "processed"},
        {"_id": 0}
    )
    if transcript and fragment.get("corrected_text"):
        corrected = fragment["corrected_text"]
        original = fragment["original_text"]
        content = transcript["content"]
        
        escaped = re.escape(corrected)
        pattern = re.compile(rf'\b{escaped}\b')
        new_content = pattern.sub(f'[{original}?]', content, count=1)
        
        if new_content != content:
            await db.transcripts.update_one(
                {"project_id": project_id, "version_type": "processed"},
                {"$set": {"content": new_content}}
            )
    
    updated = await db.uncertain_fragments.find_one({"id": fragment_id}, {"_id": 0})
    return UncertainFragmentResponse(**updated)
