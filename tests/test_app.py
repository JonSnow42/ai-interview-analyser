import sys
from unittest.mock import MagicMock

# Mock streamlit with correct unpacking behavior for columns and tabs
mock_st = MagicMock()

def mock_columns(spec):
    n = spec if isinstance(spec, int) else len(spec)
    return [MagicMock() for _ in range(n)]

def mock_tabs(tab_list):
    return [MagicMock() for _ in tab_list]

mock_st.columns = mock_columns
mock_st.tabs = mock_tabs

sys.modules['streamlit'] = mock_st

from app import esc, parse_pdf

def test_esc_sanitizes_html():
    raw_html = "<script>alert('xss')</script>"
    expected = "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;"
    assert esc(raw_html) == expected

def test_esc_handles_none():
    assert esc(None) == ""

def test_parse_pdf_handles_none():
    assert parse_pdf(None) == ""
