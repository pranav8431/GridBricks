"""Write the OpenAPI document: ``python -m gridbricks.export_openapi [path]``.

The frontend generates its TypeScript types from this file, and CI fails if they drift.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from gridbricks.main import create_app


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    document = json.dumps(create_app().openapi(), indent=2) + "\n"
    if args:
        Path(args[0]).write_text(document)
    else:
        sys.stdout.write(document)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
