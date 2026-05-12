from __future__ import annotations
import json
import sys
import importlib
import importlib.util
from pathlib import Path

import typer

app = typer.Typer(help="Malleable SDK CLI")


@app.command()
def generate(
    entry: str = typer.Argument(
        "main",
        help="Python module to import (e.g. 'main' or 'backend.main'). "
             "The module must import and call @semantic-decorated functions at import time.",
    ),
    output: Path = typer.Option(
        Path("manifest.json"),
        "--output", "-o",
        help="Where to write the manifest.",
    ),
    models: str = typer.Option(
        "",
        "--models", "-m",
        help="Comma-separated list of 'module:ClassName' to introspect for field metadata.",
    ),
):
    """Generate a Semantic Manifest by importing your FastAPI app module."""
    # Add cwd to path so local modules are importable
    sys.path.insert(0, str(Path.cwd()))

    try:
        importlib.import_module(entry)
    except ModuleNotFoundError as e:
        typer.echo(f"Error: could not import '{entry}': {e}", err=True)
        raise typer.Exit(1)

    model_classes = []
    if models:
        for spec in models.split(","):
            spec = spec.strip()
            if ":" not in spec:
                continue
            mod_path, class_name = spec.rsplit(":", 1)
            try:
                mod = importlib.import_module(mod_path)
                model_classes.append(getattr(mod, class_name))
            except Exception as e:
                typer.echo(f"Warning: could not load model '{spec}': {e}", err=True)

    from malleable.manifest import generate_manifest
    manifest = generate_manifest(model_classes or None)

    output.write_text(json.dumps(manifest, indent=2))
    typer.echo(f"✓ Manifest written to {output}  ({len(manifest['endpoints'])} endpoints)")
