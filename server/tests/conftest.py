import os
import sys
import types
from pathlib import Path

os.environ.setdefault("RATE_LIMIT_STORAGE_URL", "memory://")
os.environ.setdefault("RATE_LIMIT_LOGIN", "5/minute")
os.environ.setdefault("RATE_LIMIT_REGISTER", "3/minute")
os.environ.setdefault("RATE_LIMIT_GOOGLE_LOGIN", "10/minute")
os.environ.setdefault("RATE_LIMIT_MICROSOFT_LOGIN", "10/minute")

SERVER_ROOT = Path(__file__).resolve().parents[1]
if str(SERVER_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVER_ROOT))

partition_pdf_module = types.ModuleType("unstructured.partition.pdf")
partition_pdf_module.partition_pdf = lambda *args, **kwargs: []

chunking_title_module = types.ModuleType("unstructured.chunking.title")
chunking_title_module.chunk_by_title = lambda elements, *args, **kwargs: elements

sys.modules.setdefault("unstructured", types.ModuleType("unstructured"))
sys.modules.setdefault("unstructured.partition", types.ModuleType("unstructured.partition"))
sys.modules.setdefault("unstructured.partition.pdf", partition_pdf_module)
sys.modules.setdefault("unstructured.chunking", types.ModuleType("unstructured.chunking"))
sys.modules.setdefault("unstructured.chunking.title", chunking_title_module)
