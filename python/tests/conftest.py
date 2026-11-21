import os
import sys

# Ensure python/ directory is on sys.path for test discovery and module imports
python_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if python_dir not in sys.path:
    sys.path.insert(0, python_dir)
