import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from server.config import load_local_env


class ConfigTests(unittest.TestCase):
    def test_load_local_env_supports_export_quotes_and_inline_comments(self):
        with tempfile.TemporaryDirectory() as tmp:
            env_path = Path(tmp) / ".env.local"
            env_path.write_text(
                """
# ignored
export DEEPSEEK_API_KEY=\"local-key\"
DEEPSEEK_MODEL='flash-model'
DEEPSEEK_BASE_URL=https://example.test # comment
NO_EQUALS_LINE
""".strip(),
                encoding="utf-8",
            )
            with patch.dict(os.environ, {}, clear=True):
                load_local_env(env_path)

                self.assertEqual(os.environ["DEEPSEEK_API_KEY"], "local-key")
                self.assertEqual(os.environ["DEEPSEEK_MODEL"], "flash-model")
                self.assertEqual(os.environ["DEEPSEEK_BASE_URL"], "https://example.test")

    def test_load_local_env_does_not_override_existing_environment(self):
        with tempfile.TemporaryDirectory() as tmp:
            env_path = Path(tmp) / ".env.local"
            env_path.write_text("DEEPSEEK_MODEL=local-model", encoding="utf-8")
            with patch.dict(os.environ, {"DEEPSEEK_MODEL": "system-model"}, clear=True):
                load_local_env(env_path)

                self.assertEqual(os.environ["DEEPSEEK_MODEL"], "system-model")


if __name__ == "__main__":
    unittest.main()
