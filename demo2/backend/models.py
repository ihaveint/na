from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class Transaction(BaseModel):
    id: str
    date: str = Field(description="ISO date string")
    amount: float = Field(description="Transaction amount in USD (always positive)")
    merchant: str = Field(description="Merchant or payee name")
    category: str = Field(description="Spending category (Food & Drink, Transport, etc.)")
    account: str = Field(description="Account used (e.g. Chase Checking, Amex Gold)")
    description: str = Field(description="Short memo or note")
    type: str = Field(description="Transaction type: expense, income, or transfer")
    is_flagged: bool = Field(False, description="Whether the transaction is flagged for review")
    tags: list[str] = Field(default_factory=list, description="User-applied tags")


class FlagRequest(BaseModel):
    flagged: bool


class RecategorizeRequest(BaseModel):
    category: str


class UISchema(BaseModel):
    layout: str = Field(description="One of: list, table, kanban")
    data_source: str = Field(description="Which endpoint to use as primary data")
    group_by: Optional[str] = Field(None, description="Field name to group rows by")
    sort_by: Optional[str] = Field(None, description="Field name to sort by")
    sort_direction: str = Field("desc", description="asc or desc")
    card_fields: list[str] = Field(
        default_factory=lambda: ["date", "merchant", "amount", "category"],
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
    personaId: str = ""
