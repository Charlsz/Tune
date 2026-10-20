"""Candado de un análisis a la vez (sin cola de trabajos)."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from tune.interfaces.api import analyses as analyses_api


def test_inference_slot_rejects_while_held() -> None:
    with analyses_api._inference_slot():
        assert analyses_api.inference_busy() is True
        with pytest.raises(HTTPException) as ei:
            with analyses_api._inference_slot():
                pass
        assert ei.value.status_code == 503
        assert "análisis en curso" in ei.value.detail.lower()
    assert analyses_api.inference_busy() is False
