from __future__ import annotations
import secrets

from fastapi import APIRouter, HTTPException

_share_store: dict[str, dict] = {}


def add_share_routes(router: APIRouter, artifact_model: type) -> None:
    @router.post("/share")
    def create_share(artifact: artifact_model):
        share_id = secrets.token_urlsafe(8)
        _share_store[share_id] = artifact.model_dump()
        return {"id": share_id}

    @router.get("/share/{share_id}")
    def get_share(share_id: str):
        artifact = _share_store.get(share_id)
        if not artifact:
            raise HTTPException(status_code=404, detail="Share not found")
        return artifact
