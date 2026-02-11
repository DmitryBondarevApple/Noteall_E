from pydantic import BaseModel
from typing import Optional, List, Literal, Any


class PipelineNodeConfig(BaseModel):
    """Configuration for a single node in the pipeline"""
    node_id: str
    node_type: Literal[
        "ai_prompt",
        "parse_list",
        "batch_loop",
        "aggregate",
        "template",
        "user_edit_list",
        "user_review"
    ]
    label: str
    # For ai_prompt nodes
    prompt_id: Optional[str] = None
    inline_prompt: Optional[str] = None
    system_message: Optional[str] = None
    reasoning_effort: Optional[str] = "high"
    # For batch_loop nodes
    batch_size: Optional[int] = 3
    # For template nodes
    template_text: Optional[str] = None
    # For parse_list nodes — custom script
    script: Optional[str] = None
    # Which node's output to use as input (node_id reference)
    input_from: Optional[List[str]] = None
    # Visual position on canvas
    position_x: Optional[float] = 0
    position_y: Optional[float] = 0
    # --- Wizard display settings ---
    step_title: Optional[str] = None          # max 40 chars
    step_description: Optional[str] = None    # max 200 chars
    continue_button_label: Optional[str] = None  # max 25 chars
    pause_after: Optional[bool] = False
    # user_edit_list options
    allow_add: Optional[bool] = True
    allow_edit: Optional[bool] = True
    allow_delete: Optional[bool] = True
    min_selected: Optional[int] = 1
    # user_review options
    allow_review_edit: Optional[bool] = True
    show_export: Optional[bool] = True
    show_save: Optional[bool] = True
    # template variable config: { var_name: { label, placeholder, input_type, required } }
    variable_config: Optional[Any] = None


class PipelineEdge(BaseModel):
    """Connection between two nodes"""
    source: str
    target: str
    source_handle: Optional[str] = None
    target_handle: Optional[str] = None


class PipelineCreate(BaseModel):
    name: str
    description: Optional[str] = None
    nodes: List[PipelineNodeConfig]
    edges: List[PipelineEdge]
    is_public: bool = False


class PipelineUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    nodes: Optional[List[PipelineNodeConfig]] = None
    edges: Optional[List[PipelineEdge]] = None
    is_public: Optional[bool] = None


class PipelineResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    nodes: List[PipelineNodeConfig]
    edges: List[PipelineEdge]
    user_id: Optional[str] = None
    is_public: bool
    generation_prompt: Optional[str] = None
    created_at: str
    updated_at: str
