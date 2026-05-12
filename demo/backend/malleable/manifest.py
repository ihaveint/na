from __future__ import annotations
import json
import inspect
import typing
from .decorators import _registry


def generate_manifest(model_classes: list | None = None) -> dict:
    """Build a Semantic Manifest from all @semantic-decorated endpoints."""
    entities: dict[str, dict] = {}

    if model_classes:
        for cls in model_classes:
            entities[cls.__name__] = _extract_fields(cls)

    endpoints = []
    for entry in _registry:
        entity_name = entry["entity"]
        if entity_name not in entities:
            entities[entity_name] = {}

        endpoints.append({
            k: v for k, v in entry.items()
            if v not in (None, "", {})
        })

    return {
        "schema_version": "0.1",
        "entities": entities,
        "endpoints": endpoints,
        "layouts": ["list", "kanban", "calendar", "table"],
    }


def _extract_fields(cls) -> dict:
    fields = {}
    hints = typing.get_type_hints(cls)
    for field_name, hint in hints.items():
        if field_name.startswith("_"):
            continue
        fields[field_name] = {"type": _hint_to_str(hint)}

    # Pydantic v2 field metadata
    if hasattr(cls, "model_fields"):
        for field_name, field_info in cls.model_fields.items():
            if field_name in fields and field_info.description:
                fields[field_name]["description"] = field_info.description

    return fields


def _hint_to_str(hint) -> str:
    if hint is None:
        return "any"
    origin = typing.get_origin(hint)
    if origin is list:
        args = typing.get_args(hint)
        inner = args[0].__name__ if args else "Any"
        return f"{inner}[]"
    if origin is typing.Union:
        args = [a for a in typing.get_args(hint) if a is not type(None)]
        return _hint_to_str(args[0]) + "?" if args else "any?"
    if hasattr(hint, "__name__"):
        return hint.__name__
    return str(hint)
