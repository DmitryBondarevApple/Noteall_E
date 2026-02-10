# Routes exports
from app.routes.auth import router as auth_router
from app.routes.projects import router as projects_router
from app.routes.transcripts import router as transcripts_router
from app.routes.fragments import router as fragments_router
from app.routes.speakers import router as speakers_router
from app.routes.prompts import router as prompts_router
from app.routes.chat import router as chat_router
from app.routes.admin import router as admin_router
from app.routes.seed import router as seed_router
from app.routes.export import router as export_router
from app.routes.pipelines import router as pipelines_router
from app.routes.attachments import router as attachments_router
from app.routes.documents import router as documents_router
from app.routes.meeting_folders import router as meeting_folders_router
