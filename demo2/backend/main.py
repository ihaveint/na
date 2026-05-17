from __future__ import annotations
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException

from malleable_server import create_malleable_app, MalleableConfig, BaseComponentGenerator

from models import Transaction, FlagRequest, RecategorizeRequest, UISchema, ChatRequest, ShareArtifact
from data import TRANSACTIONS, TRANSACTIONS_BY_ID

load_dotenv(Path(__file__).resolve().parent / ".env")

# ---------------------------------------------------------------------------
# CRUD routes
# ---------------------------------------------------------------------------

crud = APIRouter()


@crud.get("/transactions", response_model=list[Transaction])
async def list_transactions():
    return sorted(TRANSACTIONS, key=lambda t: t.date, reverse=True)


@crud.get("/transactions/expenses", response_model=list[Transaction])
async def list_expenses():
    return sorted(
        [t for t in TRANSACTIONS if t.type == "expense"],
        key=lambda t: t.date, reverse=True,
    )


@crud.get("/transactions/income", response_model=list[Transaction])
async def list_income():
    return sorted(
        [t for t in TRANSACTIONS if t.type == "income"],
        key=lambda t: t.date, reverse=True,
    )


@crud.get("/transactions/{transaction_id}", response_model=Transaction)
async def get_transaction(transaction_id: str):
    tx = TRANSACTIONS_BY_ID.get(transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return tx


@crud.post("/transactions/{transaction_id}/flag", response_model=Transaction)
async def flag_transaction(transaction_id: str, body: FlagRequest):
    tx = TRANSACTIONS_BY_ID.get(transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    tx.is_flagged = body.flagged
    return tx


@crud.post("/transactions/{transaction_id}/recategorize", response_model=Transaction)
async def recategorize_transaction(transaction_id: str, body: RecategorizeRequest):
    tx = TRANSACTIONS_BY_ID.get(transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    tx.category = body.category
    return tx

# ---------------------------------------------------------------------------
# Domain-specific field helpers
# ---------------------------------------------------------------------------

_FIELD_LABELS: dict[str, str] = {
    "date": "Date",
    "amount": "Amount",
    "merchant": "Merchant",
    "category": "Category",
    "account": "Account",
    "description": "Note",
    "type": "Type",
    "is_flagged": "Flagged",
    "tags": "Tags",
}

def field_label(field: str) -> str:
    return _FIELD_LABELS.get(field, field.replace("_", " ").title())


def cell_jsx(field: str) -> str:
    if field == "amount":
        return '<span className="font-mono text-zinc-800">${item.amount.toFixed(2)}</span>'
    if field == "date":
        return '<span className="text-zinc-500">{formatDate(item.date)}</span>'
    if field == "category":
        return '<span className={`px-1.5 py-0.5 rounded border text-xs ${categoryColor(item.category)}`}>{item.category}</span>'
    if field == "type":
        return (
            '<span className={item.type === "income" ? "text-emerald-600 font-medium" : item.type === "transfer" ? "text-blue-600" : "text-zinc-700"}>'
            '{item.type}</span>'
        )
    if field == "is_flagged":
        return '{item.is_flagged && <span className="text-amber-500 text-xs font-semibold">Flagged</span>}'
    if field == "tags":
        return '<div className="flex gap-1 flex-wrap">{(item.tags || []).map(tag => <span key={tag} className="bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded text-xs">{tag}</span>)}</div>'
    if field == "merchant":
        return '<span className="font-medium text-zinc-900 truncate block max-w-xs">{item.merchant}</span>'
    return f'<span className="text-zinc-700 truncate block max-w-xs">{{String(item.{field} ?? "\u2014")}}</span>'


ledger_generator = BaseComponentGenerator(field_label=field_label, cell_jsx=cell_jsx)


_SYSTEM_PROMPT = """You are a conversational UI agent for a personal finance tracker called Ledger.
You help users customize how their transaction data is displayed by either updating a config schema or generating a custom React component.

Transaction fields: id, date (ISO string), amount (float, always positive USD), merchant (string), category (string), account (string), description (string), type ("expense"|"income"|"transfer"), is_flagged (bool), tags (string[])
Virtual group_by fields: month (computed from date, e.g. "May 2026"), type (expense/income/transfer)
Valid data_source values: list_all, list_expenses, list_income

Component scope: formatDate(iso), formatAmount(amount), categoryColor(category), groupTransactions(transactions, field)
Layout receives: { transactions: Transaction[], onTransactionClick: (tx: Transaction) => void }
Call onTransactionClick(tx) when the user clicks a row/card/bar.

Finance-specific:
- formatAmount(amount) returns e.g. "$143.22"
- categoryColor(category) returns Tailwind classes e.g. "bg-orange-100 text-orange-700 border-orange-200"
- Bar charts, donut charts, spending timelines, category breakdowns, monthly summaries, budget heatmaps are all valid component modes
- Kanban works best with group_by="category" or "month"
- Always include at least ["date","merchant","amount"] in card_fields"""


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = create_malleable_app(MalleableConfig(
    title="Ledger Finance Demo",
    cors_origins=["http://localhost:3001"],
    system_prompt=_SYSTEM_PROMPT,
    chat_request_model=ChatRequest,
    ui_schema_model=UISchema,
    base_generator=ledger_generator,
    default_card_fields=["date", "merchant", "amount", "category"],
    component_scope="Ledger personal finance tracker. Fields: id, date, amount (float), merchant, category, account, description, type (expense/income/transfer), is_flagged, tags. Scope: formatDate(iso), formatAmount(amount), categoryColor(category), groupTransactions(transactions, field). Props: transactions, onTransactionClick.",
))

app.include_router(crud)
