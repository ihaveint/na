from __future__ import annotations
import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from malleable import generate_manifest
from malleable_server.chat import (
    parse_subcomponents,
    replace_subcomponent,
    ensure_data_sc,
    find_undefined_components,
    parse_response,
    is_bug_report,
    make_subcomponent_modify_prompt,
    build_chat_system_prompt,
    BaseComponentGenerator,
)


@dataclass
class MalleableConfig:
    title: str
    cors_origins: list[str] | None = None

    # System prompt — static string, or callable receiving manifest dict
    system_prompt: str | Callable[[dict], str] = ""

    # Component scope description for surgical edit prompts
    component_scope: str = ""

    # Models to include in /manifest
    manifest_models: list | None = None

    # Domain-specific base component generator
    base_generator: BaseComponentGenerator | None = None
    default_card_fields: list[str] = field(default_factory=lambda: ["subject", "sender_name"])

    # Pydantic model classes for request/response
    chat_request_model: type | None = None
    ui_schema_model: type | None = None


def create_malleable_app(config: MalleableConfig) -> FastAPI:
    load_dotenv()

    app = FastAPI(title=config.title)
    origins = config.cors_origins or []
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    anthropic_client: anthropic.Anthropic | None = None

    def get_anthropic() -> anthropic.Anthropic:
        nonlocal anthropic_client
        if anthropic_client is None:
            api_key = os.environ.get("ANTHROPIC_API_KEY", "")
            env_file = Path.cwd() / ".env"
            if not api_key and env_file.exists():
                for line in env_file.read_text().splitlines():
                    if line.startswith("ANTHROPIC_API_KEY="):
                        api_key = line.split("=", 1)[1].strip()
                        break
            anthropic_client = anthropic.Anthropic(api_key=api_key)
        return anthropic_client

    # Resolve base generator
    gen = config.base_generator or BaseComponentGenerator(
        field_label=lambda f: f.replace("_", " ").title(),
        cell_jsx=lambda f: (
            '{Array.isArray(item.' + f + ')'
            ' ? <div className="flex gap-1 flex-wrap">{(item.' + f + ').map(v => <span key={v} className="bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded text-xs">{v}</span>)}</div>'
            ' : <span className="text-zinc-700 truncate block max-w-xs">{String(item.' + f + ' ?? "\u2014")}</span>}'
        ),
    )

    # -----------------------------------------------------------------------
    # Manifest
    # -----------------------------------------------------------------------
    @app.get("/manifest")
    async def get_manifest():
        models = config.manifest_models
        return generate_manifest(models) if models else generate_manifest()

    # -----------------------------------------------------------------------
    # Share
    # -----------------------------------------------------------------------
    import secrets
    _share_store: dict[str, dict] = {}

    @app.post("/share")
    def create_share(artifact: dict):
        share_id = secrets.token_urlsafe(8)
        _share_store[share_id] = artifact
        return {"id": share_id}

    @app.get("/share/{share_id}")
    def get_share(share_id: str):
        artifact = _share_store.get(share_id)
        if not artifact:
            raise HTTPException(status_code=404, detail="Share not found")
        return artifact

    # -----------------------------------------------------------------------
    # Chat
    # -----------------------------------------------------------------------
    ChatReq = config.chat_request_model
    UISchemaModel = config.ui_schema_model

    if ChatReq is None:
        # Create a runtime-compatible request type from minimal info
        from pydantic import BaseModel

        class _ConversationMessage(BaseModel):
            role: str
            content: str

        class _ChatRequest(BaseModel):
            messages: list[_ConversationMessage]
            current_schema: dict
            current_code: Optional[str] = None

        ChatReq = _ChatRequest
        UISchemaModel = dict

    @app.post("/chat")
    async def chat(body: ChatReq):  # type: ignore[valid-type]
        manifest = generate_manifest(config.manifest_models) if config.manifest_models else generate_manifest()

        if callable(config.system_prompt):
            chat_system_prompt = config.system_prompt(manifest)
        elif config.system_prompt:
            chat_system_prompt = build_chat_system_prompt(manifest, config.system_prompt)
        else:
            chat_system_prompt = build_chat_system_prompt(manifest)

        messages = [{"role": m.role, "content": m.content} for m in body.messages]
        current_schema = body.current_schema
        if hasattr(current_schema, "model_dump"):
            current_schema_dict = current_schema.model_dump()
        else:
            current_schema_dict = current_schema

        if body.current_code:
            return _handle_surgical_edit(
                get_anthropic=get_anthropic,
                code=body.current_code,
                messages=messages,
                component_scope=config.component_scope,
            )

        # Generation path
        schema_obj = _ensure_obj(current_schema, UISchemaModel) if UISchemaModel and UISchemaModel is not dict else current_schema_dict
        base = gen.schema_to_base_component(schema_obj, config.default_card_fields)

        if base:
            context = (
                f"Current schema:\n{json.dumps(current_schema_dict, indent=2)}\n\n"
                f"The following base component already matches the current layout pixel-for-pixel. "
                f"Start from it — do NOT redesign or restyle it. Add ONLY what the user asks for, nothing more:\n"
                f"```jsx\n{base}\n```"
            )
        else:
            context = (
                f"Current schema (the user's active layout — if you generate a component, "
                f"visually replicate this layout first then layer in the requested change):\n"
                f"{json.dumps(current_schema_dict, indent=2)}"
            )
        if messages:
            messages = [{"role": "user", "content": context + "\n\n" + messages[0]["content"]}] + messages[1:]

        raw = get_anthropic().messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system=chat_system_prompt,
            messages=messages,
        ).content[0].text.strip()

        try:
            parsed = parse_response(raw)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"JSON parse error: {e}\nRaw: {raw}")

        raw_code = parsed.get("code")
        if raw_code:
            undefined = find_undefined_components(raw_code)
            if undefined:
                fix_msg = (
                    f"Your previous response referenced {', '.join(undefined)} but never defined {'it' if len(undefined) == 1 else 'them'}. "
                    f"Regenerate the full component and include the complete function definition for every component you reference."
                )
                raw2 = get_anthropic().messages.create(
                    model="claude-sonnet-4-6",
                    max_tokens=8096,
                    system=chat_system_prompt,
                    messages=messages + [{"role": "assistant", "content": raw}, {"role": "user", "content": fix_msg}],
                ).content[0].text.strip()
                try:
                    parsed = parse_response(raw2)
                    raw_code = parsed.get("code")
                except Exception:
                    pass

        result: dict = {
            "action": parsed.get("action", "question"),
            "message": parsed.get("message", ""),
            "schema": None,
            "code": ensure_data_sc(raw_code) if raw_code else None,
        }

        if parsed.get("action") == "schema" and parsed.get("schema"):
            try:
                if UISchemaModel and UISchemaModel is not dict:
                    result["schema"] = UISchemaModel(**parsed["schema"]).model_dump()
                else:
                    result["schema"] = parsed["schema"]
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Schema parse error: {e}")

        return result

    return app


def _ensure_obj(data, model_class):
    """Convert dict to model instance if needed."""
    if isinstance(data, dict) and hasattr(model_class, "model_validate"):
        return model_class(**data)
    return data


def _handle_surgical_edit(
    get_anthropic: Callable[[], anthropic.Anthropic],
    code: str,
    messages: list[dict],
    component_scope: str,
) -> dict:
    components = parse_subcomponents(code)

    if len(components) <= 1:
        return {
            "action": "question",
            "message": "This component was generated without sub-components, so I can't make surgical edits. Ask me to regenerate the layout from scratch with your changes included.",
            "schema": None,
            "code": None,
        }

    _STRUCTURAL = {"TableHeader", "Layout"}
    last_message = messages[-1]["content"] if messages else ""

    if is_bug_report(get_anthropic, last_message):
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
        system=make_subcomponent_modify_prompt(components, target, component_scope),
        messages=messages,
    ).content[0].text.strip()

    try:
        parsed = parse_response(raw)
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
            result_code = code
            for func_name, new_func in updates:
                result_code = replace_subcomponent(result_code, func_name, new_func)
            if additions:
                new_defs = "\n\n".join(code for _, code in additions)
                layout_match = re.search(r'\nfunction Layout\b', result_code)
                if layout_match:
                    result_code = result_code[:layout_match.start()] + "\n\n" + new_defs + result_code[layout_match.start():]
                else:
                    result_code = new_defs + "\n\n" + result_code
            undefined = find_undefined_components(result_code)
            if undefined:
                fix_msg = (
                    f"Your previous response referenced {', '.join(undefined)} but never defined {'it' if len(undefined) == 1 else 'them'}. "
                    f"Return the same changes but include the complete function definition for every component you reference. "
                    f"Do not omit any component."
                )
                raw2 = get_anthropic().messages.create(
                    model="claude-sonnet-4-6",
                    max_tokens=8096,
                    system=make_subcomponent_modify_prompt(components, target, component_scope),
                    messages=messages + [{"role": "assistant", "content": raw}, {"role": "user", "content": fix_msg}],
                ).content[0].text.strip()
                try:
                    parsed2 = parse_response(raw2)
                except Exception:
                    parsed2 = {}
                if parsed2.get("action") == "component":
                    changes2 = parsed2.get("changes", [])
                    valid2 = [(c["name"], c["code"]) for c in changes2 if c.get("name") in components and c.get("code")]
                    if valid2:
                        result_code = code
                        for func_name, new_func in valid2:
                            result_code = replace_subcomponent(result_code, func_name, new_func)
                        if not find_undefined_components(result_code):
                            return {"action": "component", "message": parsed2.get("message", parsed["message"]), "schema": None, "code": ensure_data_sc(result_code)}
                return {
                    "action": "question",
                    "message": f"The generated code references {', '.join(undefined)} but never defines {'it' if len(undefined) == 1 else 'them'}. Please try again.",
                    "schema": None,
                    "code": None,
                }
            return {"action": "component", "message": parsed["message"], "schema": None, "code": ensure_data_sc(result_code)}
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
