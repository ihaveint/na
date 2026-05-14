from __future__ import annotations
import json
import os
import re
import secrets
from pathlib import Path
from typing import Optional

import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import Transaction, FlagRequest, RecategorizeRequest, UISchema, ChatRequest, ShareArtifact
from data import TRANSACTIONS, TRANSACTIONS_BY_ID

load_dotenv(Path(__file__).resolve().parent / ".env")

_ENV_FILE = Path(__file__).resolve().parent / ".env"

def _read_api_key() -> str:
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if key:
        return key
    if _ENV_FILE.exists():
        for line in _ENV_FILE.read_text().splitlines():
            if line.startswith("ANTHROPIC_API_KEY="):
                return line.split("=", 1)[1].strip()
    raise RuntimeError("ANTHROPIC_API_KEY not found in environment or .env file")

app = FastAPI(title="Ledger Finance Demo")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_anthropic: anthropic.Anthropic | None = None

def get_anthropic() -> anthropic.Anthropic:
    global _anthropic
    if _anthropic is None:
        _anthropic = anthropic.Anthropic(api_key=_read_api_key())
    return _anthropic


# ---------------------------------------------------------------------------
# Data endpoints
# ---------------------------------------------------------------------------

@app.get("/transactions", response_model=list[Transaction])
async def list_transactions():
    return sorted(TRANSACTIONS, key=lambda t: t.date, reverse=True)


@app.get("/transactions/expenses", response_model=list[Transaction])
async def list_expenses():
    return sorted(
        [t for t in TRANSACTIONS if t.type == "expense"],
        key=lambda t: t.date, reverse=True,
    )


@app.get("/transactions/income", response_model=list[Transaction])
async def list_income():
    return sorted(
        [t for t in TRANSACTIONS if t.type == "income"],
        key=lambda t: t.date, reverse=True,
    )


@app.get("/transactions/{transaction_id}", response_model=Transaction)
async def get_transaction(transaction_id: str):
    tx = TRANSACTIONS_BY_ID.get(transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return tx


@app.post("/transactions/{transaction_id}/flag", response_model=Transaction)
async def flag_transaction(transaction_id: str, body: FlagRequest):
    tx = TRANSACTIONS_BY_ID.get(transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    tx.is_flagged = body.flagged
    return tx


@app.post("/transactions/{transaction_id}/recategorize", response_model=Transaction)
async def recategorize_transaction(transaction_id: str, body: RecategorizeRequest):
    tx = TRANSACTIONS_BY_ID.get(transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    tx.category = body.category
    return tx


# ---------------------------------------------------------------------------
# Share store
# ---------------------------------------------------------------------------

_share_store: dict[str, dict] = {}

@app.post("/share")
def create_share(artifact: ShareArtifact):
    share_id = secrets.token_urlsafe(8)
    _share_store[share_id] = artifact.model_dump()
    return {"id": share_id}

@app.get("/share/{share_id}")
def get_share(share_id: str):
    artifact = _share_store.get(share_id)
    if not artifact:
        raise HTTPException(status_code=404, detail="Share not found")
    return artifact


# ---------------------------------------------------------------------------
# Unified chat endpoint
# ---------------------------------------------------------------------------

_CHAT_SYSTEM_PROMPT = """You are a conversational UI agent for a personal finance tracker called Ledger. You help users customize how their transaction data is displayed by either updating a config schema or generating a custom React component.

ALWAYS respond with valid JSON only — no markdown fences, no explanation outside the JSON:

Schema update:       {"action":"schema",    "message":"...", "schema":{...}, "code":null}
Component:           {"action":"component", "message":"...", "schema":null,  "code":"function Layout({ transactions }) { ... }"}
Clarifying question: {"action":"question",  "message":"...", "schema":null,  "code":null}

--- WHEN TO USE EACH ---

Use "schema" when the user wants:
- A standard layout: list, table, kanban
- Sorting, filtering, or grouping by a field
- Changing visible fields or data source (all/expenses/income)
- Simple, well-defined presentation changes

Use "component" when the user wants:
- Any feature the schema cannot express: charts, graphs, custom cell rendering, hover effects, conditional styling
- A novel layout: bar chart by category, spending timeline, monthly heatmap, donut chart, budget vs actual
- current_code is provided — ALWAYS use "component", never revert to schema

When current_code is NOT provided (schema mode) and you choose "component":
- Replicate the current schema layout visually: same layout type (table/list), same columns/fields, same sort order
- Then add the requested feature on top — do NOT invent a new visual style from scratch

When current_code IS provided:
- Make ONLY the minimal change asked for. Do not redesign, reformat, or restyle anything else.
- Preserve all existing variable names, structure, styling, and logic not mentioned.

Use "question" when:
- The request is too vague ("make it better", "change it")
- Key parameters are missing for a custom visualization
- Ask ONE focused question

--- SCHEMA FORMAT ---

UISchema:
{
  "layout": "list" | "table" | "kanban",
  "data_source": "list_all" | "list_expenses" | "list_income",
  "group_by": "<field>" | null,
  "sort_by": "<field>" | null,
  "sort_direction": "asc" | "desc",
  "card_fields": ["date", "merchant", "amount", ...],
  "filters": [{"field":"...","op":"eq|neq|gt|lt","value":"..."}],
  "actions": ["FlagTransaction","Recategorize"]
}

Transaction fields: id, date (ISO string), amount (float, always positive USD), merchant (string), category (string), account (string), description (string), type ("expense"|"income"|"transfer"), is_flagged (bool), tags (string[])
Virtual group_by fields: month (computed from date, e.g. "May 2026"), type (expense/income/transfer)
Kanban layout works best with group_by="category" or group_by="month".
Always include at least ["date","merchant","amount"] in card_fields.

--- COMPONENT FORMAT ---

Props: { transactions: Transaction[], onTransactionClick: (tx: Transaction) => void }
Call onTransactionClick(tx) when the user clicks a row/card/bar to open the transaction detail. Always wire this up on clickable items.

Already in scope — do NOT import:
  React, useState, useEffect, useMemo
  formatDate(iso: string) → string  (e.g. "Today", "Jan 5")
  formatAmount(amount: number) → string  (e.g. "$143.22")
  categoryColor(category: string) → string  (Tailwind classes, e.g. "bg-orange-100 text-orange-700 border-orange-200")
  groupTransactions(transactions, field) → Record<string, Transaction[]>

categoryColor(category) returns a STRING of Tailwind classes.
Use it ONLY in className, never in style. Example: <span className={categoryColor(tx.category)}>

CRITICAL styling: use inline style={{}} for ALL layout properties (display, gridTemplateColumns, flex, width, height).
Tailwind is safe only for: colors (bg-*, text-*, border-*), spacing (p-*, m-*, gap-*), typography, borders.
BORDER RADIUS — always use inline style for rounded corners: style={{borderRadius:'0.5rem'}} NOT className="rounded-xl".
Tailwind rounded-* classes are unreliable in generated components because the CSS may not be pre-compiled.
Always add p-4 at the root. Renders inside a full-width full-height overflow-auto container.

TOOLTIPS — MANDATORY pattern (position:absolute is FORBIDDEN — it gets clipped by overflow containers):
  const [tipPos, setTipPos] = useState(null)
  <trigger onMouseMove={e => setTipPos({x:e.clientX, y:e.clientY})} onMouseLeave={() => setTipPos(null)}>...</trigger>
  {tipPos && <div style={{position:'fixed',left:tipPos.x+12,top:tipPos.y-28,zIndex:9999,pointerEvents:'none'}} className="bg-zinc-800 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">{content}</div>}

UNDEFINED REFERENCES — every function/component you call or render MUST be defined in the same output. No exceptions.

MANDATORY structure — decompose into at least 2 named functions:
- Extract every repeating or distinct UI element into its own function (e.g. TxRow, CategoryBar, SummaryCard, ChartCell)
- The main entry point MUST be named exactly `Layout`
- Add `data-sc="FunctionName"` on the ROOT element of EVERY function (including Layout) — required for surgical editing
- A single monolithic `function Layout` is NEVER acceptable
- No imports, no exports

Finance component guidance:
- Bar chart: horizontal or vertical bars; bar width via inline style proportional to value; label + amount on each bar
- Donut/pie: use SVG circles or arc paths with stroke-dasharray for segments
- Spending timeline: dates on x-axis, amounts as dots or bars, connected by a line
- Category breakdown: grouped rows or columns; totals per category; percentage of spend
- Monthly summary: one row per month with total expense/income; delta vs previous month
- Budget heatmap: grid of days/weeks, colored by spend intensity

Examples:
  function CategoryBar({ category, total, max, transactions }) {
    return <div data-sc="CategoryBar" ...>...</div>
  }
  function Layout({ transactions, onTransactionClick }) {
    return <div data-sc="Layout" className="p-4">...</div>
  }
"""


def _parse_subcomponents(code: str) -> dict[str, str]:
    functions: dict[str, str] = {}
    lines = code.splitlines()
    i = 0
    while i < len(lines):
        m = re.match(r'^function (\w+)\s*\(', lines[i])
        if m:
            name = m.group(1)
            start = i
            depth = 0
            j = i
            while j < len(lines):
                depth += lines[j].count('{') - lines[j].count('}')
                j += 1
                if depth == 0 and j > start + 1:
                    functions[name] = '\n'.join(lines[start:j])
                    i = j
                    break
            else:
                i += 1
        else:
            i += 1
    return functions


def _replace_subcomponent(code: str, name: str, new_func: str) -> str:
    lines = code.splitlines()
    i = 0
    while i < len(lines):
        if re.match(r'^function ' + re.escape(name) + r'\s*\(', lines[i]):
            start = i
            depth = 0
            j = i
            while j < len(lines):
                depth += lines[j].count('{') - lines[j].count('}')
                j += 1
                if depth == 0 and j > start + 1:
                    return '\n'.join(lines[:start] + new_func.splitlines() + lines[j:])
            break
        i += 1
    return code


def _ensure_data_sc(code: str) -> str:
    components = _parse_subcomponents(code)
    result = code
    for name, func_code in components.items():
        attr = f'data-sc="{name}"'
        if attr in func_code:
            continue
        m = re.search(r'return\s*\(?\s*<([A-Za-z][A-Za-z0-9.]*)', func_code)
        if not m:
            continue
        insert_at = m.end(1)
        new_func = func_code[:insert_at] + f' data-sc="{name}"' + func_code[insert_at:]
        result = result.replace(func_code, new_func, 1)
    return result


def _find_undefined_components(code: str) -> list[str]:
    defined = set(re.findall(r'function\s+([A-Z]\w*)\s*\(', code))
    used = set(re.findall(r'<([A-Z]\w*)[\s/>]', code))
    builtin = {"React"}
    return sorted(used - defined - builtin)


def _parse_response(raw: str) -> dict:
    if raw.startswith("```"):
        raw = "\n".join(raw.split("\n")[1:])
    if raw.endswith("```"):
        raw = "\n".join(raw.split("\n")[:-1])
    start = raw.find("{")
    if start > 0:
        raw = raw[start:]
    try:
        return json.loads(raw.strip())
    except json.JSONDecodeError:
        if raw.strip():
            return {"action": "question", "message": raw.strip()}
        raise


def _make_subcomponent_modify_prompt(components: dict[str, str], target: str | None) -> str:
    if target and target in components:
        component_section = f"Modify this sub-component:\n```jsx\n{components[target]}\n```"
        other_sections = "\n\n".join(
            f"[{name}] (context only — modify only if the change requires it)\n```jsx\n{func}\n```"
            for name, func in components.items() if name != target
        )
        if other_sections:
            component_section += f"\n\nOther sub-components for context:\n\n{other_sections}"
    else:
        sections = "\n\n".join(
            f"[{name}]\n```jsx\n{func}\n```" for name, func in components.items()
        )
        component_section = f"The current component has these sub-components:\n\n{sections}"

    tooltip_rule = (
        "- TOOLTIPS: ALWAYS use position:'fixed' and track mouse coords via onMouseMove — NEVER position:'absolute'."
        " Pattern: const [pos, setPos] = useState(null);"
        " attach onMouseMove={e => setPos({x:e.clientX,y:e.clientY})} onMouseLeave={() => setPos(null)} to the trigger;"
        " render {pos && <div style={{position:'fixed',left:pos.x+12,top:pos.y-28,zIndex:9999,pointerEvents:'none'}}"
        " className=\"bg-zinc-800 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap\">content</div>}"
    )
    return_instruction = (
        '{"action":"component","message":"one sentence","changes":[{"name":"ComponentName","code":"function ComponentName..."},...]}\n'
        'Include every sub-component you modified in "changes". Most edits touch 1-2; never return unchanged components.\n'
        'Or if ambiguous: {"action":"question","message":"your question"}'
    )
    return (
        "You are a surgical React component editor for a personal finance tracker. Make the MINIMUM change needed.\n\n"
        + component_section
        + "\n\nRULES:\n"
        "- Preserve ALL existing logic, variable names, and styling not explicitly mentioned.\n"
        "- Keep the `data-sc=\"ComponentName\"` attribute on the root element of every function you return.\n"
        "- Do NOT redesign, reformat, or restyle anything not explicitly requested.\n"
        "- PROP DRILLING: If adding a new prop to a child component, update every parent that renders it.\n"
        "- Available in scope (do NOT import): React, useState, useEffect, useMemo, formatDate(iso), formatAmount(amount), categoryColor(category), groupTransactions(transactions, field)\n"
        "- Layout receives two props: `transactions` (array) and `onTransactionClick(tx)` (function). Call it when the user clicks a transaction.\n"
        + tooltip_rule + "\n"
        "- BORDER RADIUS: always use inline style={{borderRadius:'0.5rem'}} NOT Tailwind rounded-* classes.\n"
        "- UNDEFINED REFERENCES: every function/component you reference MUST be defined in your output.\n"
        "- Return the COMPLETE modified function for each changed component, not snippets.\n\n"
        "Return ONLY valid JSON — no markdown fences, no text outside JSON:\n"
        + return_instruction
    )


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


def _cell_jsx(field: str) -> str:
    if field == "amount":
        return '<span className="font-mono text-zinc-800">${{tx.amount.toFixed(2)}}</span>'
    if field == "date":
        return '<span className="text-zinc-500">{formatDate(tx.date)}</span>'
    if field == "category":
        return '<span className={`px-1.5 py-0.5 rounded border text-xs ${categoryColor(tx.category)}`}>{tx.category}</span>'
    if field == "type":
        return (
            '<span className={tx.type === "income" ? "text-emerald-600 font-medium" : tx.type === "transfer" ? "text-blue-600" : "text-zinc-700"}>'
            '{tx.type}</span>'
        )
    if field == "is_flagged":
        return '{tx.is_flagged && <span className="text-amber-500 text-xs font-semibold">⚑ Flagged</span>}'
    if field == "tags":
        return '<div className="flex gap-1 flex-wrap">{(tx.tags || []).map(tag => <span key={tag} className="bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded text-xs">{tag}</span>)}</div>'
    if field == "merchant":
        return '<span className="font-medium text-zinc-900 truncate block max-w-xs">{tx.merchant}</span>'
    return f'<span className="text-zinc-700 truncate block max-w-xs">{{String(tx.{field} ?? "—")}}</span>'


def _table_base_component(fields: list[str]) -> str:
    label_ths = "\n        ".join(
        f'<th className="text-left px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wide">'
        f'{_FIELD_LABELS.get(f, f)}</th>'
        for f in fields
    )
    cell_tds = "\n      ".join(
        f'<td className="px-4 py-2 max-w-xs">{_cell_jsx(f)}</td>'
        for f in fields
    )
    return (
        'function TableHeader() {\n'
        '  return (\n'
        '    <thead data-sc="TableHeader">\n'
        '      <tr className="border-b border-zinc-200 bg-zinc-50">\n'
        f'        {label_ths}\n'
        '      </tr>\n'
        '    </thead>\n'
        '  )\n'
        '}\n'
        '\n'
        'function TableRow({ tx, onTransactionClick }) {\n'
        '  return (\n'
        '    <tr data-sc="TableRow" className="hover:bg-zinc-50 transition-colors cursor-pointer" onClick={() => onTransactionClick(tx)}>\n'
        f'      {cell_tds}\n'
        '    </tr>\n'
        '  )\n'
        '}\n'
        '\n'
        'function Layout({ transactions, onTransactionClick }) {\n'
        '  return (\n'
        '    <div data-sc="Layout" className="overflow-x-auto">\n'
        '      <table className="w-full text-sm">\n'
        '        <TableHeader />\n'
        '        <tbody className="divide-y divide-zinc-100">\n'
        '          {transactions.map(tx => <TableRow key={tx.id} tx={tx} onTransactionClick={onTransactionClick} />)}\n'
        '        </tbody>\n'
        '      </table>\n'
        '    </div>\n'
        '  )\n'
        '}'
    )


def _list_base_component(fields: list[str]) -> str:
    meta_parts: list[str] = []
    if "account" in fields:
        meta_parts.append('          <span className="text-xs text-zinc-500">{tx.account}</span>')
    if "category" in fields:
        meta_parts.append('          <span className={`text-xs px-1.5 py-0.5 rounded border ${categoryColor(tx.category)}`}>{tx.category}</span>')
    if "type" in fields:
        meta_parts.append('          <span className={`text-xs font-medium ${tx.type === "income" ? "text-emerald-600" : "text-zinc-500"}`}>{tx.type}</span>')
    if "tags" in fields:
        meta_parts.append(
            '          {tx.tags && tx.tags.length > 0 && '
            '<div className="flex gap-1">'
            '{tx.tags.slice(0, 2).map(tag => '
            '<span key={tag} className="text-xs bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded">{tag}</span>'
            ')}</div>}'
        )
    meta_row = "\n".join(meta_parts)
    description_row = (
        '\n        <p className="text-xs text-zinc-400 truncate mt-0.5">{tx.description}</p>'
        if "description" in fields else ""
    )
    return (
        'function TxCard({ tx, onTransactionClick }) {\n'
        '  return (\n'
        '    <div data-sc="TxCard" className="flex gap-4 px-4 py-3 hover:bg-zinc-50 transition-colors cursor-pointer" onClick={() => onTransactionClick(tx)}>\n'
        '      <div className="flex-1 min-w-0">\n'
        '        <div className="flex items-baseline justify-between gap-2">\n'
        '          <span className="text-sm font-medium text-zinc-900 truncate">{tx.merchant}</span>\n'
        '          <span className={`text-sm font-mono flex-shrink-0 ${tx.type === "income" ? "text-emerald-600" : "text-zinc-800"}`}>\n'
        '            {tx.type === "income" ? "+" : ""}{formatAmount(tx.amount)}\n'
        '          </span>\n'
        '        </div>\n'
        '        <div className="flex items-center gap-2 mt-0.5">\n'
        '          <span className="text-xs text-zinc-400">{formatDate(tx.date)}</span>\n'
        f'{meta_row}\n'
        '        </div>'
        f'{description_row}\n'
        '      </div>\n'
        '    </div>\n'
        '  )\n'
        '}\n'
        '\n'
        'function Layout({ transactions, onTransactionClick }) {\n'
        '  return (\n'
        '    <div data-sc="Layout" className="flex flex-col divide-y divide-zinc-100">\n'
        '      {transactions.map(tx => <TxCard key={tx.id} tx={tx} onTransactionClick={onTransactionClick} />)}\n'
        '    </div>\n'
        '  )\n'
        '}'
    )


def _schema_to_base_component(schema) -> str | None:
    fields = schema.card_fields or ["date", "merchant", "amount", "category"]
    if schema.layout == "table":
        return _table_base_component(fields)
    if schema.layout == "list":
        return _list_base_component(fields)
    return None


def _is_bug_report(message: str) -> bool:
    resp = get_anthropic().messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=8,
        system=(
            "Reply with only 'yes' or 'no'. "
            "Is the following message reporting that something is broken, not working, or producing wrong output? "
            "(yes = bug report / debugging; no = new feature request or styling change)"
        ),
        messages=[{"role": "user", "content": message}],
    )
    return resp.content[0].text.strip().lower().startswith("y")


@app.post("/chat")
async def chat(body: ChatRequest):
    messages = [{"role": m.role, "content": m.content} for m in body.messages]

    if body.current_code:
        components = _parse_subcomponents(body.current_code)

        if len(components) <= 1:
            return {
                "action": "question",
                "message": "This component was generated without sub-components, so I can't make surgical edits. Ask me to regenerate the layout from scratch with your changes included.",
                "schema": None,
                "code": None,
            }

        _STRUCTURAL = {"TableHeader", "Layout"}
        last_message = messages[-1]["content"] if messages else ""

        if _is_bug_report(last_message):
            target = None
        else:
            target_match = re.search(r'\[(\w+)\]', last_message)
            target = target_match.group(1) if target_match else None
            if target and (target not in components or target in _STRUCTURAL):
                target = None

            if not target:
                for msg in reversed(messages[:-1]):
                    m = re.search(r'\[(\w+)\]', msg.get("content", ""))
                    if m and m.group(1) in components and m.group(1) not in _STRUCTURAL:
                        target = m.group(1)
                        break

        raw = get_anthropic().messages.create(
            model="claude-sonnet-4-6",
            max_tokens=8096,
            system=_make_subcomponent_modify_prompt(components, target),
            messages=messages,
        ).content[0].text.strip()

        try:
            parsed = _parse_response(raw)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"JSON parse error: {e}\nRaw: {raw}")

        if parsed.get("action") == "component":
            changes = parsed.get("changes", [])
            if not changes and parsed.get("name") and parsed.get("code"):
                changes = [{"name": parsed["name"], "code": parsed["code"]}]
            updates = [(c["name"], c["code"]) for c in changes if c.get("name") in components and c.get("code")]
            additions = [(c["name"], c["code"]) for c in changes if c.get("name") not in components and c.get("code")]
            valid = updates or additions
            if valid:
                result_code = body.current_code
                for func_name, new_func in updates:
                    result_code = _replace_subcomponent(result_code, func_name, new_func)
                if additions:
                    new_defs = "\n\n".join(code for _, code in additions)
                    layout_match = re.search(r'\nfunction Layout\b', result_code)
                    if layout_match:
                        result_code = result_code[:layout_match.start()] + "\n\n" + new_defs + result_code[layout_match.start():]
                    else:
                        result_code = new_defs + "\n\n" + result_code
                undefined = _find_undefined_components(result_code)
                if undefined:
                    fix_msg = (
                        f"Your previous response referenced {', '.join(undefined)} but never defined {'it' if len(undefined) == 1 else 'them'}. "
                        f"Return the same changes but include the complete function definition for every component you reference."
                    )
                    raw2 = get_anthropic().messages.create(
                        model="claude-sonnet-4-6",
                        max_tokens=8096,
                        system=_make_subcomponent_modify_prompt(components, target),
                        messages=messages + [{"role": "assistant", "content": raw}, {"role": "user", "content": fix_msg}],
                    ).content[0].text.strip()
                    try:
                        parsed2 = _parse_response(raw2)
                    except Exception:
                        parsed2 = {}
                    if parsed2.get("action") == "component":
                        changes2 = parsed2.get("changes", [])
                        valid2 = [(c["name"], c["code"]) for c in changes2 if c.get("name") in components and c.get("code")]
                        if valid2:
                            result_code = body.current_code
                            for func_name, new_func in valid2:
                                result_code = _replace_subcomponent(result_code, func_name, new_func)
                            if not _find_undefined_components(result_code):
                                return {"action": "component", "message": parsed2.get("message", parsed["message"]), "schema": None, "code": _ensure_data_sc(result_code)}
                    return {
                        "action": "question",
                        "message": f"The generated code references {', '.join(undefined)} but never defines {'it' if len(undefined) == 1 else 'them'}. Please try again.",
                        "schema": None,
                        "code": None,
                    }
                return {"action": "component", "message": parsed["message"], "schema": None, "code": _ensure_data_sc(result_code)}
            return {
                "action": "question",
                "message": "I couldn't match the change to the right sub-component. Click Inspect, select the exact element, and try again.",
                "schema": None,
                "code": None,
            }
        elif parsed.get("action") == "question":
            return {"action": "question", "message": parsed["message"], "schema": None, "code": None}

        return {
            "action": "question",
            "message": "I wasn't sure how to apply that change safely. Use Inspect to select the exact element you'd like to modify.",
            "schema": None,
            "code": None,
        }

    else:
        base = _schema_to_base_component(body.current_schema)
        if base:
            context = (
                f"Current schema:\n{body.current_schema.model_dump_json(indent=2)}\n\n"
                f"The following base component already matches the current layout pixel-for-pixel. "
                f"Start from it — do NOT redesign or restyle it. Add ONLY what the user asks for, nothing more:\n"
                f"```jsx\n{base}\n```"
            )
        else:
            context = (
                f"Current schema (the user's active layout — if you generate a component, "
                f"visually replicate this layout first then layer in the requested change):\n"
                f"{body.current_schema.model_dump_json(indent=2)}"
            )
        if messages:
            messages = [{"role": "user", "content": context + "\n\n" + messages[0]["content"]}] + messages[1:]

    raw = get_anthropic().messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=_CHAT_SYSTEM_PROMPT,
        messages=messages,
    ).content[0].text.strip()

    try:
        parsed = _parse_response(raw)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"JSON parse error: {e}\nRaw: {raw}")

    raw_code = parsed.get("code")
    if raw_code:
        undefined = _find_undefined_components(raw_code)
        if undefined:
            fix_msg = (
                f"Your previous response referenced {', '.join(undefined)} but never defined {'it' if len(undefined) == 1 else 'them'}. "
                f"Regenerate the full component and include the complete function definition for every component you reference."
            )
            raw2 = get_anthropic().messages.create(
                model="claude-sonnet-4-6",
                max_tokens=8096,
                system=_CHAT_SYSTEM_PROMPT,
                messages=messages + [{"role": "assistant", "content": raw}, {"role": "user", "content": fix_msg}],
            ).content[0].text.strip()
            try:
                parsed = _parse_response(raw2)
                raw_code = parsed.get("code")
            except Exception:
                pass

    result: dict = {
        "action": parsed.get("action", "question"),
        "message": parsed.get("message", ""),
        "schema": None,
        "code": _ensure_data_sc(raw_code) if raw_code else None,
    }

    if parsed.get("action") == "schema" and parsed.get("schema"):
        try:
            result["schema"] = UISchema(**parsed["schema"]).model_dump()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Schema parse error: {e}")

    return result
