from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class UISchema(BaseModel):
    layout: str = Field(description="One of: list, kanban, table")
    data_source: str = Field(description="Which endpoint to use as primary data")
    group_by: Optional[str] = Field(None, description="Field name to group rows by")
    sort_by: Optional[str] = Field(None, description="Field name to sort by")
    sort_direction: str = Field("asc", description="asc or desc")
    card_fields: list[str] = Field(
        default_factory=lambda: ["title", "artist", "genre", "duration_sec"],
        description="Fields to show on each row/card",
    )
    filters: list[dict] = Field(default_factory=list)
    actions: list[str] = Field(default_factory=list)


class ConversationMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ConversationMessage]
    current_schema: UISchema
    current_code: Optional[str] = None


class ShareArtifact(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    schema: UISchema
    componentCode: Optional[str] = None
    renderMode: str = "schema"
    label: str = ""
    playlistId: str = ""
