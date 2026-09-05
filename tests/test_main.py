"""Unit tests for Pioneer Remote FastAPI endpoints."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from main import PioneerCommandError, PioneerConnection, app


@pytest.fixture
def mock_pioneer():
    """Mock the global PioneerConnection object."""
    with patch("main.pioneer_conn", new_callable=AsyncMock) as mock_conn:
        mock_conn.is_connected = AsyncMock(return_value=True)
        yield mock_conn


@pytest.fixture
def client():
    """Create a FastAPI TestClient."""
    return TestClient(app)


def test_health_endpoint(client, mock_pioneer):
    """Test health check endpoint returns 200 and connected status."""
    mock_pioneer.is_connected.return_value = True
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "connected": True}


def test_power_on(client, mock_pioneer):
    """Test setting power to True sends PO command."""
    mock_pioneer.send_command.return_value = "PO"
    response = client.post("/power", json={"power": True})
    assert response.status_code == 200
    assert response.json()["success"] is True
    mock_pioneer.send_command.assert_called_once_with("PO")


def test_power_off(client, mock_pioneer):
    """Test setting power to False sends PF command."""
    mock_pioneer.send_command.return_value = "PF"
    response = client.post("/power", json={"power": False})
    assert response.status_code == 200
    assert response.json()["success"] is True
    mock_pioneer.send_command.assert_called_once_with("PF")


def test_power_extra_fields_forbidden(client, mock_pioneer):
    """Test that unknown fields are forbidden by Pydantic validation."""
    response = client.post("/power", json={"power": True, "extra_field": "disallowed"})
    assert response.status_code == 422


def test_volume_set_valid(client, mock_pioneer):
    """Test setting volume within valid range."""
    mock_pioneer.send_command.return_value = "VOL080"
    response = client.post("/volume", json={"volume": 80})
    assert response.status_code == 200
    assert response.json()["success"] is True
    mock_pioneer.send_command.assert_called_once_with("080VL")


def test_volume_out_of_range(client, mock_pioneer):
    """Test setting volume outside 0-161 range raises 400."""
    response = client.post("/volume", json={"volume": 200})
    assert response.status_code == 400


def test_volume_up(client, mock_pioneer):
    """Test volume up endpoint."""
    mock_pioneer.send_command.return_value = "VOL081"
    response = client.post("/volume/up")
    assert response.status_code == 200
    mock_pioneer.send_command.assert_called_once_with("VU")


def test_volume_down(client, mock_pioneer):
    """Test volume down endpoint."""
    mock_pioneer.send_command.return_value = "VOL080"
    response = client.post("/volume/down")
    assert response.status_code == 200
    mock_pioneer.send_command.assert_called_once_with("VD")


def test_mute_toggle(client, mock_pioneer):
    """Test muting and unmuting."""
    mock_pioneer.send_command.return_value = "MO"
    response = client.post("/mute", json={"power": True})
    assert response.status_code == 200
    mock_pioneer.send_command.assert_called_once_with("MO")


def test_input_selection(client, mock_pioneer):
    """Test changing input source."""
    mock_pioneer.send_command.return_value = "FN19"
    response = client.post("/input", json={"input": "19"})
    assert response.status_code == 200
    mock_pioneer.send_command.assert_called_once_with("19FN")


def test_power_get(client, mock_pioneer):
    """Test get power status."""
    mock_pioneer.send_command.return_value = "PWR0"
    response = client.get("/power")
    assert response.status_code == 200
    assert response.json() == {"power": True, "response": "PWR0"}
    mock_pioneer.send_command.assert_called_once_with("?P")


def test_mute_get(client, mock_pioneer):
    """Test get mute status."""
    mock_pioneer.send_command.return_value = "MUT0"
    response = client.get("/mute")
    assert response.status_code == 200
    assert response.json() == {"muted": True, "response": "MUT0"}
    mock_pioneer.send_command.assert_called_once_with("?M")


def test_volume_get(client, mock_pioneer):
    """Test get volume status."""
    mock_pioneer.send_command.return_value = "VOL080"
    response = client.get("/volume")
    assert response.status_code == 200
    assert response.json() == {"volume": "VOL080", "response": "VOL080"}
    mock_pioneer.send_command.assert_called_once_with("?V")


def test_input_get(client, mock_pioneer):
    """Test get input status."""
    mock_pioneer.send_command.return_value = "FN25"
    response = client.get("/input")
    assert response.status_code == 200
    assert response.json() == {"input": "FN25", "response": "FN25"}
    mock_pioneer.send_command.assert_called_once_with("?F")


def test_status_endpoint(client, mock_pioneer):
    """Test full status query."""
    mock_pioneer.send_command.side_effect = ["PWR0", "VOL090", "MUT1", "FN25"]
    response = client.get("/status")
    assert response.status_code == 200
    data = response.json()
    assert data["power"] is True
    assert data["volume"] == "VOL090"
    assert data["muted"] is False
    assert data["input"] == "FN25"
    assert data["connected"] is True


def test_status_standby(client, mock_pioneer):
    """Test status query when receiver is in standby."""
    mock_pioneer.send_command.side_effect = ["PWR1"]
    response = client.get("/status")
    assert response.status_code == 200
    data = response.json()
    assert data["power"] is False
    assert data["connected"] is True
    # Should only call POWER_QUERY ("?P"), NOT volume/mute/input
    mock_pioneer.send_command.assert_called_once_with(
        "?P", expected_prefix=("PWR", "PO", "PF")
    )


def test_raw_command(client, mock_pioneer):
    """Test sending a raw command."""
    mock_pioneer.send_command.return_value = "RGB"
    response = client.post("/command?command=%3FF")
    assert response.status_code == 200
    assert response.json()["response"] == "RGB"


@pytest.mark.anyio
async def test_pioneer_connection_eof_handling():
    """Test that PioneerConnection raises PioneerCommandError on EOF."""
    conn = PioneerConnection("127.0.0.1", 8102)
    mock_reader = AsyncMock()
    mock_reader.read.return_value = b""  # EOF
    mock_writer = MagicMock()
    mock_writer.drain = AsyncMock()
    mock_writer.is_closing.return_value = False

    conn.reader = mock_reader
    conn.writer = mock_writer

    with pytest.raises(PioneerCommandError, match="Connection closed by remote host"):
        await conn.send_command("?V")

    assert conn.reader is None
    assert conn.writer is None


@pytest.mark.anyio
async def test_pioneer_connection_cr_and_crlf_reading():
    """Test that PioneerConnection reads lines terminated with CR or CRLF."""
    conn = PioneerConnection("127.0.0.1", 8102)
    mock_reader = AsyncMock()
    # First response: VOL080\r, Second response: \n trailing then MUT0\r\n
    mock_reader.read.side_effect = [
        b"V",
        b"O",
        b"L",
        b"0",
        b"8",
        b"0",
        b"\r",
        b"\n",
        b"M",
        b"U",
        b"T",
        b"0",
        b"\r",
    ]
    mock_writer = MagicMock()
    mock_writer.drain = AsyncMock()
    mock_writer.is_closing.return_value = False

    conn.reader = mock_reader
    conn.writer = mock_writer

    res1 = await conn.send_command("?V")
    assert res1 == "VOL080"

    res2 = await conn.send_command("?M")
    assert res2 == "MUT0"


@pytest.mark.anyio
async def test_pioneer_connection_expected_prefix_skips_unsolicited():
    """Test that send_command skips unsolicited lines until expected prefix is received."""
    conn = PioneerConnection("127.0.0.1", 8102)
    mock_reader = AsyncMock()
    # Receiver sends VOL080\r then PWR0\r
    mock_reader.read.side_effect = [
        b"V",
        b"O",
        b"L",
        b"0",
        b"8",
        b"0",
        b"\r",
        b"P",
        b"W",
        b"R",
        b"0",
        b"\r",
    ]
    mock_writer = MagicMock()
    mock_writer.drain = AsyncMock()
    mock_writer.is_closing.return_value = False

    conn.reader = mock_reader
    conn.writer = mock_writer

    res = await conn.send_command("?P", expected_prefix=("PWR", "PO", "PF"))
    assert res == "PWR0"
