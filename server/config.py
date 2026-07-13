import os
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]


def load_local_env(path=ROOT_DIR / ".env.local"):
    env_path = Path(path)
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        parsed = parse_env_line(raw_line)
        if not parsed:
            continue
        key, value = parsed
        if key and key not in os.environ:
            os.environ[key] = value


def parse_env_line(raw_line):
    line = raw_line.strip()
    if not line or line.startswith("#") or "=" not in line:
        return None
    if line.startswith("export "):
        line = line[len("export ") :].strip()
    if "=" not in line:
        return None

    key, value = line.split("=", 1)
    key = key.strip()
    value = strip_inline_comment(value.strip())
    return key, unquote_env_value(value.strip())


def strip_inline_comment(value):
    quote = None
    for index, char in enumerate(value):
        if char in {"'", '"'}:
            quote = None if quote == char else char if quote is None else quote
        if char == "#" and quote is None and (index == 0 or value[index - 1].isspace()):
            return value[:index].rstrip()
    return value


def unquote_env_value(value):
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1]
    return value


def deepseek_settings():
    load_local_env()
    return {
        "api_key": os.environ.get("DEEPSEEK_API_KEY", ""),
        "model": os.environ.get("DEEPSEEK_MODEL", "deepseek-v4-flash"),
        "base_url": os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
    }
