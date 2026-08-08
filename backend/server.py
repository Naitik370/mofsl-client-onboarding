import sys

import uvicorn

from router import app


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4173
    uvicorn.run(app, host="127.0.0.1", port=port)


if __name__ == "__main__":
    main()
