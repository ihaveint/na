from __future__ import annotations
import json
import re
from dataclasses import dataclass, field
from typing import Callable, Optional

import anthropic

# ---------------------------------------------------------------------------
# Text-processing helpers (pure — no LLM calls)
# ---------------------------------------------------------------------------

def parse_subcomponents(code: str) -> dict[str, str]:
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


def replace_subcomponent(code: str, name: str, new_func: str) -> str:
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


def ensure_data_sc(code: str) -> str:
    components = parse_subcomponents(code)
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


def find_undefined_components(code: str) -> list[str]:
    defined = set(re.findall(r'function\s+([A-Z]\w*)\s*\(', code))
    used = set(re.findall(r'<([A-Z]\w*)[\s/>]', code))
    builtin = {"React"}
    return sorted(used - defined - builtin)


# ---------------------------------------------------------------------------
# LLM-dependent helpers
# ---------------------------------------------------------------------------

def is_bug_report(get_anthropic: Callable[[], anthropic.Anthropic], message: str) -> bool:
    resp = get_anthropic().messages.create(
        model="claude-haiku-4-5",
        max_tokens=8,
        system=(
            "Reply with only 'yes' or 'no'. "
            "Is the following message reporting that something is broken, not working, or producing wrong output? "
            "(yes = bug report / debugging; no = new feature request or styling change)"
        ),
        messages=[{"role": "user", "content": message}],
    )
    return resp.content[0].text.strip().lower().startswith("y")


def make_subcomponent_modify_prompt(
    components: dict[str, str],
    target: str | None,
    scope_description: str = "",
) -> str:
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
        ' className="bg-zinc-800 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">content</div>}'
    )
    return_instruction = (
        '{"action":"component","message":"one sentence","changes":[{"name":"ComponentName","code":"function ComponentName..."},...]}\n'
        'Include every sub-component you modified in "changes". Most edits touch 1-2; never return unchanged components.\n'
        'Or if ambiguous: {"action":"question","message":"your question"}'
    )
    return (
        "You are a surgical React component editor."
        + (f" {scope_description}" if scope_description else "")
        + " Make the MINIMUM change needed.\n\n"
        + component_section
        + "\n\nRULES:\n"
        "- Preserve ALL existing logic, variable names, and styling not explicitly mentioned.\n"
        '- Keep the `data-sc="ComponentName"` attribute on the root element of every function you return.\n'
        "- Do NOT redesign, reformat, or restyle anything not explicitly requested.\n"
        "- PROP DRILLING: If adding a new prop to a child component, you MUST also update every parent that renders it to pass that prop through. Include all affected components in your changes array.\n"
        "- Available in scope (do NOT import): React, useState, useEffect, useMemo, "
        + ("formatDate(iso), groupItems(items, field)" if not scope_description else scope_description)
        + "\n"
        "- Layout receives two props: `items` (array) and `onItemClick(item)` (function). Call `onItemClick(item)` when the user clicks a card/row/item to open its detail view. Always wire this up on clickable items.\n"
        + tooltip_rule + "\n"
        "- BORDER RADIUS: always use inline style={{borderRadius:'1rem'}} NOT Tailwind rounded-* classes.\n"
        "- UNDEFINED REFERENCES: every function/component you call or render MUST be defined in your output. If you reference <Foo />, Foo must appear as a function in the changes array. Never reference a function that isn't defined.\n"
        "- Return the COMPLETE modified function for each changed component, not snippets.\n\n"
        "Return ONLY valid JSON — no markdown fences, no text outside JSON:\n"
        + return_instruction
    )


# ---------------------------------------------------------------------------
# System prompt builder
# ---------------------------------------------------------------------------

_CHAT_SYSTEM_PROMPT_STATIC = """\
ALWAYS respond with valid JSON only — no markdown fences, no explanation outside the JSON:

Schema update:    {"action":"schema",    "message":"...", "schema":{...}, "code":null}
Component:        {"action":"component", "message":"...", "schema":null,  "code":"function Layout({ items, onItemClick }) { ... }"}
Clarifying question: {"action":"question",  "message":"...", "schema":null,  "code":null}

--- WHEN TO USE EACH ---

Use "schema" when the user wants:
- A standard layout: list, kanban, table, calendar
- Sorting, filtering, or grouping by a field
- Changing visible fields or data source
- Simple, well-defined presentation changes

Use "component" when the user wants:
- Any feature the schema cannot express: tooltips, click interactions, custom cell rendering, conditional styling, hover effects
- A novel layout: heatmap, timeline, split-pane, activity grid, swimlane
- current_code is provided — ALWAYS use "component", never revert to schema

When current_code is NOT provided (schema mode) and you choose "component":
- Replicate the current schema layout visually: same layout type (table/list/kanban), same columns/fields, same sort order
- Then add the requested feature on top — do NOT invent a new visual style from scratch

When current_code IS provided:
- Make ONLY the minimal change asked for. Do not redesign, reformat, or restyle anything else.
- Preserve all existing variable names, structure, styling, and logic not mentioned.

Use "question" when:
- The request is too vague ("make it better", "change it")
- Key parameters are missing
- Ask ONE focused question

--- SCHEMA FORMAT ---

UISchema:
{
  "layout": "list" | "kanban" | "table" | "calendar",
  "data_source": "<intent from manifest>",
  "group_by": "<field>" | null,
  "sort_by": "<field>" | null,
  "sort_direction": "asc" | "desc",
  "card_fields": ["<field_names>"],
  "filters": [{"field":"...","op":"eq|neq|gt|lt","value":"..."}],
  "actions": []
}

Kanban works best with group_by set. Calendar requires sort_by to be a date field.

--- COMPONENT FORMAT ---

Props: { items: Entity[], onItemClick: (item: Entity) => void }
Call onItemClick(item) when the user clicks a card/row/item to open its detail view. Always wire this up on clickable items.
Already in scope — do NOT import: React, useState, useEffect, useMemo, formatDate(iso), groupItems(items, field)

groupItems(items, field) groups an array by a field value and returns Record<string, Entity[]>.

CRITICAL styling: use inline style={{}} for ALL layout properties (display, gridTemplateColumns, flex, width, height).
Tailwind is safe only for: colors (bg-*, text-*, border-*), spacing (p-*, m-*, gap-*), typography, borders.
BORDER RADIUS — always use inline style for rounded corners: style={{borderRadius:'1rem'}} NOT className="rounded-xl".
Always add p-4 at the root. Renders inside a full-width full-height overflow-auto container.

TOOLTIPS — MANDATORY pattern (position:absolute is FORBIDDEN for tooltips):
  const [tipPos, setTipPos] = useState(null)
  <trigger onMouseMove={e => setTipPos({x:e.clientX, y:e.clientY})} onMouseLeave={() => setTipPos(null)}>...</trigger>
  {tipPos && <div style={{position:'fixed',left:tipPos.x+12,top:tipPos.y-28,zIndex:9999,pointerEvents:'none'}} className="bg-zinc-800 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">{content}</div>}

UNDEFINED REFERENCES — every function/component you call or render MUST be defined in the same output.

MANDATORY structure — you MUST decompose into at least 2 named functions:
- Extract every repeating or distinct UI element into its own function (e.g. ItemCard, TableRow, GroupHeader, SidePanel)
- The main entry point MUST be named exactly `Layout`
- Add `data-sc="FunctionName"` on the ROOT element of EVERY function (including Layout) — this is required for surgical editing
- A single monolithic `function Layout` is NEVER acceptable
- No imports, no exports"""


def build_chat_system_prompt(manifest: dict, domain_intro: str = "") -> str:
    entities = manifest.get("entities", {})
    endpoints = manifest.get("endpoints", [])

    entity_blocks: list[str] = []
    for entity_name, fields in entities.items():
        field_lines: list[str] = []
        for fname, meta in fields.items():
            if fname.startswith("_"):
                continue
            ftype = meta.get("type", "any")
            desc = meta.get("description", "")
            entry = f"  {fname} ({ftype})"
            if desc:
                entry += f" — {desc}"
            field_lines.append(entry)
        entity_blocks.append(f"{entity_name} fields:\n" + "\n".join(field_lines))
    entity_section = "\n\n".join(entity_blocks) if entity_blocks else "  (no entities in manifest)"

    list_endpoints = [
        e for e in endpoints
        if e.get("intent") and str(e["intent"]).startswith("list")
    ]
    if list_endpoints:
        ds_lines = "\n".join(
            f'  "{e["intent"]}" — {e.get("description", "")}'
            for e in list_endpoints
        )
    else:
        ds_lines = "  (no list endpoints found)"

    intro_parts = [
        "You are a conversational UI agent.",
        "You help users customize how their data is displayed by updating a config schema or generating a custom React component.",
    ]
    if domain_intro:
        intro_parts.insert(1, domain_intro)

    intro = "\n".join(intro_parts) + "\n\n--- DATA MODEL ---\n\n" + entity_section + "\n\nValid data_source values (use the exact intent string):\n" + ds_lines

    return intro + "\n\n" + _CHAT_SYSTEM_PROMPT_STATIC


# ---------------------------------------------------------------------------
# Base component generation
# ---------------------------------------------------------------------------

@dataclass
class BaseComponentGenerator:
    field_label: Callable[[str], str]
    cell_jsx: Callable[[str], str]
    title_fields: set = field(default_factory=lambda: {"subject", "title", "name", "id"})
    schema_to_base_component_override: Callable | None = None

    def table_base_component(self, fields: list[str], extra_props: str = "", extra_row_logic: str = "") -> str:
        label_ths = "\n        ".join(
            f'<th className="text-left px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wide">'
            f'{self.field_label(f)}</th>'
            for f in fields
        )
        cell_tds = "\n      ".join(
            f'<td className="px-4 py-2 max-w-xs">{self.cell_jsx(f)}</td>'
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
            f'function TableRow({{ item, onItemClick{extra_props} }}) {{\n'
            f'{extra_row_logic}'
            '  return (\n'
            '    <tr data-sc="TableRow"\n'
            '      onClick={() => onItemClick && onItemClick(item)}\n'
            '      className="hover:bg-zinc-50 transition-colors cursor-pointer">\n'
            f'      {cell_tds}\n'
            '    </tr>\n'
            '  )\n'
            '}\n'
            '\n'
            'function Layout({ items, onItemClick }) {\n'
            '  return (\n'
            '    <div data-sc="Layout" className="overflow-x-auto">\n'
            '      <table className="w-full text-sm">\n'
            '        <TableHeader />\n'
            '        <tbody className="divide-y divide-zinc-100">\n'
            '          {items.map(t => <TableRow key={t.id ?? t.name ?? t.title ?? t.subject} item={t} onItemClick={onItemClick} />)}\n'
            '        </tbody>\n'
            '      </table>\n'
            '    </div>\n'
            '  )\n'
            '}'
        )

    def list_base_component(self, fields: list[str]) -> str:
        title_fields = self.title_fields
        meta_fields = [f for f in fields if f not in title_fields]

        meta_parts: list[str] = []
        for field in meta_fields:
            if field in ("date", "due_date", "created_at", "updated_at") or "date" in field or field.endswith("_at"):
                meta_parts.append(
                    f'          {{item.{field} && <span className="text-xs text-zinc-400">{{formatDate(item.{field})}}</span>}}'
                )
            else:
                meta_parts.append(
                    f'          {{item.{field} != null && item.{field} !== false && ('
                    f'Array.isArray(item.{field})'
                    f' ? (item.{field}).slice(0,3).map(v => <span key={{v}} className="text-xs bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded">{{v}}</span>)'
                    f' : <span className="text-xs bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded">{{String(item.{field})}}</span>'
                    f')}}'
                )

        meta_row = "\n".join(meta_parts)

        return (
            'function ItemCard({ item, onItemClick }) {\n'
            '  const title = item.name ?? item.title ?? item.subject ?? "(untitled)"\n'
            '  const isUnread = item.is_read === false\n'
            '  const dateVal = item.date ?? null\n'
            '  return (\n'
            '    <div data-sc="ItemCard"\n'
            '      onClick={() => onItemClick && onItemClick(item)}\n'
            '      className={`flex gap-4 px-4 py-3 hover:bg-zinc-50 transition-colors cursor-pointer ${isUnread ? "bg-blue-50/40" : ""}`}>\n'
            '      <div className="mt-1 flex-shrink-0">\n'
            '        <div className={`w-2 h-2 rounded-full mt-1.5 ${isUnread ? "bg-blue-500" : "bg-transparent"}`} />\n'
            '      </div>\n'
            '      <div className="flex-1 min-w-0">\n'
            '        <div className="flex items-baseline justify-between gap-2">\n'
            '          <span className={`text-sm truncate ${isUnread ? "font-semibold text-zinc-900" : "text-zinc-700"}`}>\n'
            '            {String(title)}\n'
            '          </span>\n'
            '          {dateVal && <span className="text-xs text-zinc-400 flex-shrink-0">{formatDate(dateVal)}</span>}\n'
            '        </div>\n'
            '        <div className="flex items-center gap-2 mt-0.5 flex-wrap">\n'
            f'{meta_row}\n'
            '        </div>\n'
            '      </div>\n'
            '    </div>\n'
            '  )\n'
            '}\n'
            '\n'
            'function Layout({ items, onItemClick }) {\n'
            '  return (\n'
            '    <div data-sc="Layout" className="flex flex-col divide-y divide-zinc-100">\n'
            '      {items.map(t => <ItemCard key={t.id ?? t.name ?? t.title ?? t.subject} item={t} onItemClick={onItemClick} />)}\n'
            '    </div>\n'
            '  )\n'
            '}'
        )

    def schema_to_base_component(self, schema, default_fields: list[str] | None = None) -> str | None:
        if self.schema_to_base_component_override:
            return self.schema_to_base_component_override(self, schema, default_fields)
        fields = schema.card_fields or default_fields or ["subject", "sender_name"]
        if schema.layout == "table":
            return self.table_base_component(fields)
        if schema.layout == "list" or schema.layout == "kanban":
            return self.list_base_component(fields)
        return None


def parse_response(raw: str) -> dict:
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
