import re
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, HTTPException, Depends
from app.core.database import db
from app.core.security import get_current_user
from app.models.fragment import UncertainFragmentUpdate, UncertainFragmentResponse

router = APIRouter(prefix="/projects/{project_id}/fragments", tags=["fragments"])


async def update_project_status_if_needed(project_id: str):
    """Update project status based on remaining pending fragments"""
    pending_count = await db.uncertain_fragments.count_documents({
        "project_id": project_id,
        "status": {"$in": ["pending", "auto_corrected"]}
    })
    
    if pending_count == 0:
        # All fragments confirmed - mark project as ready
        await db.projects.update_one(
            {"id": project_id},
            {"$set": {"status": "ready", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        # Still has pending fragments - ensure status is needs_review
        project = await db.projects.find_one({"id": project_id})
        if project and project.get("status") == "ready":
            await db.projects.update_one(
                {"id": project_id},
                {"$set": {"status": "needs_review", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )


@router.post("/bulk-accept")
async def bulk_accept_fragments(project_id: str, user=Depends(get_current_user)):
    """Auto-accept all pending/auto_corrected fragments. For fast-track mode."""
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get all pending fragments
    pending = await db.uncertain_fragments.find({
        "project_id": project_id,
        "status": {"$in": ["pending", "auto_corrected"]}
    }, {"_id": 0}).to_list(1000)
    
    # For auto_corrected: accept the AI suggestion
    # For pending: leave the original text (no correction needed)
    accepted = 0
    for frag in pending:
        if frag.get("status") == "auto_corrected" and frag.get("corrected_text"):
            # AI already proposed a correction - accept it
            corrected = frag["corrected_text"]
            # Apply correction to transcript
            transcript = await db.transcripts.find_one(
                {"project_id": project_id, "version_type": "processed"}, {"_id": 0}
            )
            if transcript:
                word = frag.get("original_text", "")
                escaped = re.escape(word)
                pattern = re.compile(rf'\[+{escaped}\?+\]+')
                content = transcript.get("content", "")
                new_content = pattern.sub(corrected, content)
                if new_content != content:
                    await db.transcripts.update_one(
                        {"project_id": project_id, "version_type": "processed"},
                        {"$set": {"content": new_content}}
                    )
        else:
            # Pending with no AI correction - remove [word?] markers, keep original
            transcript = await db.transcripts.find_one(
                {"project_id": project_id, "version_type": "processed"}, {"_id": 0}
            )
            if transcript:
                word = frag.get("original_text", "")
                escaped = re.escape(word)
                pattern = re.compile(rf'\[+{escaped}\?+\]+')
                content = transcript.get("content", "")
                new_content = pattern.sub(word, content)
                if new_content != content:
                    await db.transcripts.update_one(
                        {"project_id": project_id, "version_type": "processed"},
                        {"$set": {"content": new_content}}
                    )
        
        await db.uncertain_fragments.update_one(
            {"id": frag["id"]},
            {"$set": {"status": "confirmed", "corrected_text": frag.get("corrected_text") or frag.get("original_text")}}
        )
        accepted += 1
    
    # Update project status
    await update_project_status_if_needed(project_id)
    
    return {"accepted": accepted, "total": len(pending)}


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
    
    # Update project status if all fragments are confirmed
    await update_project_status_if_needed(project_id)
    
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
    
    # Update project status (now has pending fragments)
    await update_project_status_if_needed(project_id)
    
    updated = await db.uncertain_fragments.find_one({"id": fragment_id}, {"_id": 0})
    return UncertainFragmentResponse(**updated)
