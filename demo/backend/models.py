from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class Thread(BaseModel):
    id: str
    subject: str = Field(description="Email subject line")
    sender: str = Field(description="Sender email address")
    sender_name: str = Field(description="Sender display name")
    preview: str = Field(description="First line of email body")
    project: Optional[str] = Field(None, description="Project or label tag")
    urgency_score: int = Field(description="Urgency 0-100, higher = more urgent")
    date: datetime = Field(description="Date received")
    is_read: bool = Field(description="Whether the thread has been read")
    is_snoozed: bool = Field(False, description="Whether the thread is snoozed")
    due_date: Optional[datetime] = Field(None, description="User-set due date")
    tags: list[str] = Field(default_factory=list, description="User-applied tags")
    messages: list["Message"] = Field(default_factory=list, description="Conversation messages in this thread")


class SnoozeRequest(BaseModel):
    until: datetime


class TagRequest(BaseModel):
    project: str


class UISchema(BaseModel):
    layout: str = Field(description="One of: list, kanban, calendar, table")
    data_source: str = Field(description="Which endpoint to use as primary data")
    group_by: Optional[str] = Field(None, description="Field name to group cards by")
    sort_by: Optional[str] = Field(None, description="Field name to sort by")
    sort_direction: str = Field("desc", description="asc or desc")
    card_fields: list[str] = Field(
        default_factory=lambda: ["subject", "sender_name", "date"],
        description="Fields to show on each card",
    )
    filters: list[dict] = Field(default_factory=list)
    actions: list[str] = Field(default_factory=list)


class GenerateSchemaRequest(BaseModel):
    user_message: str
    current_schema: UISchema


class ConversationMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class GenerateComponentRequest(BaseModel):
    messages: list[ConversationMessage]
    current_code: Optional[str] = None


class Message(BaseModel):
    id: str
    sender: str
    sender_name: str
    date: datetime
    body: str
    is_self: bool  # True = sent by the "user" (styled differently in UI)


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
    personaId: str = ""
