import sys
import types
from pathlib import Path

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
