from __future__ import annotations
import functools
import inspect
import typing

_registry: list[dict] = []


def semantic(
    entity: str,
    intent: str | None = None,
    operation: str | None = None,
    description: str | None = None,
    path: str | None = None,
):
    """Mark a FastAPI endpoint as a semantic primitive.

    Args:
        entity:      The domain entity this endpoint produces or acts on (e.g. "Thread").
        intent:      For read endpoints — what the caller is trying to accomplish (e.g. "list_actionable").
        operation:   For write endpoints — the action being performed (e.g. "snooze").
        description: Human-readable description surfaced in the manifest.
    """
    def decorator(fn):
        hints = typing.get_type_hints(fn)
        return_hint = hints.get("return")

        _registry.append({
            "endpoint": fn.__name__,
            "entity": entity,
            "intent": intent,
            "operation": operation,
            "description": description or fn.__doc__ or "",
            "return_type": _hint_to_str(return_hint),
            "params": _extract_params(fn),
            "path": path,
        })

        @functools.wraps(fn)
        async def wrapper(*args, **kwargs):
            return await fn(*args, **kwargs)

        return wrapper
    return decorator


def _hint_to_str(hint) -> str:
    if hint is None:
        return "void"
    origin = typing.get_origin(hint)
    if origin is list:
        args = typing.get_args(hint)
        inner = args[0].__name__ if args else "Any"
        return f"{inner}[]"
    if hasattr(hint, "__name__"):
        return hint.__name__
    return str(hint)


def _extract_params(fn) -> dict:
    sig = inspect.signature(fn)
    hints = typing.get_type_hints(fn)
    result = {}
    for name, param in sig.parameters.items():
        if name in ("self", "cls"):
            continue
        hint = hints.get(name)
        if hint is not None:
            result[name] = _hint_to_str(hint)
    return result
