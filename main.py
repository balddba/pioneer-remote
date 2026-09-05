"""FastAPI application to control a Pioneer AV receiver via telnet."""

import asyncio
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from loguru import logger
from pydantic import BaseModel, ConfigDict

# Pioneer Amplifier Telnet Commands
POWER_ON = "PO"
POWER_OFF = "PF"
POWER_QUERY = "?P"
VOLUME_UP = "VU"
VOLUME_DOWN = "VD"
VOLUME_QUERY = "?V"
MUTE_ON = "MO"
MUTE_OFF = "MF"
MUTE_QUERY = "?M"
INPUT_QUERY = "?F"


class PioneerCommandError(Exception):
    """Custom exception raised when a Pioneer amplifier command fails."""


class PioneerConnection:
    """Manages telnet connection to Pioneer amplifier."""

    def __init__(self, host: str, port: int = 8102) -> None:
        """Initialize connection parameters.

        Args:
            host (str): IP address or hostname of the Pioneer amplifier.
            port (int): Telnet port number (default 8102).
        """
        self.host = host
        self.port = port
        self.reader: asyncio.StreamReader | None = None
        self.writer: asyncio.StreamWriter | None = None
        self.lock = asyncio.Lock()

    async def connect(self) -> None:
        """Establish telnet connection.

        Raises:
            ConnectionError: If connection cannot be established within timeout.
        """
        try:
            logger.info(
                "Connecting to Pioneer amplifier at {}:{}", self.host, self.port
            )
            self.reader, self.writer = await asyncio.wait_for(
                asyncio.open_connection(self.host, self.port),
                timeout=5.0,
            )
            # Send initial CR to wake up CPU buffer and flush any prompt/greeting
            self.writer.write(b"\r")
            await self.writer.drain()
            await asyncio.sleep(0.1)
            logger.info("Connected to Pioneer amplifier at {}:{}", self.host, self.port)
        except (TimeoutError, OSError) as e:
            logger.error("Failed to connect to {}:{}: {}", self.host, self.port, e)
            self.writer = None
            self.reader = None
            raise ConnectionError(
                f"Failed to connect to {self.host}:{self.port}: {e}"
            ) from e

    async def disconnect(self) -> None:
        """Close telnet connection."""
        if self.writer:
            logger.info("Disconnecting from Pioneer amplifier")
            self.writer.close()
            try:
                await self.writer.wait_closed()
            except OSError as e:
                logger.warning("Error waiting for connection close: {}", e)
            self.writer = None
            self.reader = None

    async def _read_line(self, timeout: float = 2.0) -> str:
        """Read a single response line terminated by CR, LF, or CRLF.

        Args:
            timeout (float): Read timeout in seconds.

        Returns:
            str: Decoded response string.

        Raises:
            ConnectionError: If EOF is reached.
            TimeoutError: If read times out.
        """
        if not self.reader:
            raise ConnectionError("Reader unavailable")

        buffer = bytearray()
        while True:
            char = await asyncio.wait_for(self.reader.read(1), timeout=timeout)
            if not char:
                if not buffer:
                    raise ConnectionError("Connection closed by remote host (EOF)")
                break
            if char in (b"\r", b"\n"):
                if buffer:
                    break
                # Skip leading empty delimiters
                continue
            buffer.extend(char)

        return buffer.decode("ascii", errors="replace").strip()

    async def send_command(
        self,
        command: str,
        expected_prefix: str | tuple[str, ...] | None = None,
        timeout: float = 2.0,
    ) -> str:
        """Send command and receive response matching expected prefix.

        Args:
            command (str): Pioneer telnet command string.
            expected_prefix (str | tuple[str, ...] | None): Expected response prefix.
            timeout (float): Read timeout in seconds.

        Returns:
            str: Amplifier response string.

        Raises:
            PioneerCommandError: If sending command or receiving response fails.
        """
        if not self.writer or not self.reader:
            await self.connect()

        async with self.lock:
            try:
                logger.debug("Sending command: {}", command)
                if not self.writer or not self.reader:
                    raise ConnectionError("Writer or reader unavailable")

                self.writer.write((command + "\r").encode())
                await self.writer.drain()

                start_time = asyncio.get_running_loop().time()
                while True:
                    elapsed = asyncio.get_running_loop().time() - start_time
                    remaining = max(0.1, timeout - elapsed)
                    decoded = await self._read_line(timeout=remaining)
                    logger.debug("Received response: {}", decoded)
                    state_mgr.process_line(decoded)

                    if expected_prefix is None:
                        return decoded
                    if isinstance(expected_prefix, str) and decoded.startswith(
                        expected_prefix
                    ):
                        return decoded
                    if isinstance(expected_prefix, tuple) and decoded.startswith(
                        expected_prefix
                    ):
                        return decoded
                    if decoded.startswith("E0"):
                        return decoded
            except (TimeoutError, OSError, ConnectionError) as e:
                logger.error("Command '{}' failed: {}", command, e)
                if self.writer:
                    try:
                        self.writer.close()
                    except OSError:
                        pass
                self.writer = None
                self.reader = None
                raise PioneerCommandError(f"Command failed: {e}") from e

    async def is_connected(self) -> bool:
        """Check if connection is active.

        Returns:
            bool: True if connection writer is available, False otherwise.
        """
        return self.writer is not None and not self.writer.is_closing()


class StateManager:
    """Manages amplifier cached state and active WebSocket clients."""

    def __init__(self) -> None:
        """Initialize state cache and client set."""
        self.state: dict = {
            "power": False,
            "volume": "VOL000",
            "muted": False,
            "input": "00",
            "connected": False,
        }
        self.active_websockets: set[WebSocket] = set()

    def process_line(self, line: str) -> None:
        """Parse an incoming Pioneer response line and update state cache.

        Args:
            line (str): Raw response string from Pioneer receiver.
        """
        line = line.strip()
        if not line:
            return
        if line.startswith("PWR") or line in ("PO", "PF"):
            self.state["power"] = line in ("PWR0", "PO")
            self.state["connected"] = True
        elif line.startswith("VOL"):
            self.state["volume"] = line
            self.state["connected"] = True
        elif line.startswith("MUT"):
            self.state["muted"] = line in ("MUT0", "MO")
            self.state["connected"] = True
        elif line.startswith("FN"):
            self.state["input"] = line
            self.state["connected"] = True

    async def register(self, websocket: WebSocket) -> None:
        """Register a connected WebSocket client and send initial status.

        Args:
            websocket (WebSocket): Connected WebSocket instance.
        """
        self.active_websockets.add(websocket)
        try:
            await websocket.send_json(self.state)
        except (WebSocketDisconnect, RuntimeError, OSError) as e:
            logger.debug("Failed to send initial state to WebSocket: {}", e)

    def unregister(self, websocket: WebSocket) -> None:
        """Unregister a disconnected WebSocket client.

        Args:
            websocket (WebSocket): Disconnected WebSocket instance.
        """
        self.active_websockets.discard(websocket)

    async def broadcast(self) -> None:
        """Broadcast current state to all connected clients."""
        if not self.active_websockets:
            return
        disconnected = set()
        for ws in self.active_websockets:
            try:
                await ws.send_json(self.state)
            except (WebSocketDisconnect, RuntimeError, OSError):
                disconnected.add(ws)
        self.active_websockets.difference_update(disconnected)

    async def update_status(self, conn: PioneerConnection) -> dict:
        """Query amplifier status and update cache with standby awareness.

        Args:
            conn (PioneerConnection): Active Pioneer connection.

        Returns:
            dict: Updated state dictionary.

        Raises:
            PioneerCommandError: If communication fails.
            ConnectionError: If connection cannot be maintained.
            OSError: On low-level socket issues.
        """
        try:
            power_resp = await conn.send_command(
                POWER_QUERY, expected_prefix=("PWR", "PO", "PF")
            )
            is_powered = power_resp in ("PWR0", "PO")
            self.state["power"] = is_powered
            self.state["connected"] = True

            if is_powered:
                await asyncio.sleep(0.05)
                try:
                    self.state["volume"] = await conn.send_command(
                        VOLUME_QUERY, expected_prefix="VOL"
                    )
                except (PioneerCommandError, TimeoutError) as e:
                    logger.debug("Volume query non-critical delay/error: {}", e)

                await asyncio.sleep(0.05)
                try:
                    mute_resp = await conn.send_command(
                        MUTE_QUERY, expected_prefix="MUT"
                    )
                    self.state["muted"] = mute_resp in ("MUT0", "MO")
                except (PioneerCommandError, TimeoutError) as e:
                    logger.debug("Mute query non-critical delay/error: {}", e)

                await asyncio.sleep(0.05)
                try:
                    self.state["input"] = await conn.send_command(
                        INPUT_QUERY, expected_prefix="FN"
                    )
                except (PioneerCommandError, TimeoutError) as e:
                    logger.debug("Input query non-critical delay/error: {}", e)

            return self.state.copy()
        except (PioneerCommandError, ConnectionError, OSError) as e:
            self.state["connected"] = False
            self.state["error"] = str(e)
            raise


# Global instances
pioneer_conn: PioneerConnection | None = None
state_mgr = StateManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle.

    Args:
        app (FastAPI): The FastAPI application instance.
    """
    global pioneer_conn
    pioneer_ip = os.getenv("PIONEER_IP", "10.1.1.199")
    pioneer_port = int(os.getenv("PIONEER_PORT", "8102"))
    pioneer_conn = PioneerConnection(pioneer_ip, port=pioneer_port)
    logger.info(
        "Pioneer remote server started with target {}:{}", pioneer_ip, pioneer_port
    )

    async def poller_loop():
        while True:
            try:
                if pioneer_conn and state_mgr.active_websockets:
                    try:
                        await state_mgr.update_status(pioneer_conn)
                    except (PioneerCommandError, ConnectionError, OSError) as e:
                        logger.debug("Background poll error: {}", e)
                    await state_mgr.broadcast()
            except asyncio.CancelledError:
                break
            except (PioneerCommandError, ConnectionError, OSError, RuntimeError) as e:
                logger.warning("Poller loop exception: {}", e)
            await asyncio.sleep(2)

    poller_task = asyncio.create_task(poller_loop())
    yield
    poller_task.cancel()
    try:
        await poller_task
    except asyncio.CancelledError:
        pass
    if pioneer_conn:
        await pioneer_conn.disconnect()
    logger.info("Pioneer remote server stopped")


app = FastAPI(
    title="Pioneer Amplifier Remote",
    description="Control Pioneer amplifier via telnet",
    lifespan=lifespan,
)

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response models
class PowerRequest(BaseModel):
    """Request model for power and mute toggling."""

    model_config = ConfigDict(extra="forbid")
    power: bool


class VolumeRequest(BaseModel):
    """Request model for setting volume level."""

    model_config = ConfigDict(extra="forbid")
    volume: int


class InputRequest(BaseModel):
    """Request model for selecting input source."""

    model_config = ConfigDict(extra="forbid")
    input: str


class CommandResponse(BaseModel):
    """Standard response model for command endpoints."""

    model_config = ConfigDict(extra="forbid")
    success: bool
    message: str
    response: str | None = None


# Power endpoints
@app.post("/power", response_model=CommandResponse)
async def set_power(request: PowerRequest):
    """Turn amplifier on/off.

    Args:
        request (PowerRequest): Desired power state.

    Returns:
        CommandResponse: Status of power command.
    """
    if not pioneer_conn:
        raise HTTPException(
            status_code=503, detail="Pioneer connection not initialized"
        )
    command = POWER_ON if request.power else POWER_OFF
    try:
        response = await pioneer_conn.send_command(command)
        state_mgr.state["power"] = request.power
        state_mgr.state["connected"] = True
        await state_mgr.broadcast()
        return CommandResponse(
            success=True,
            message=f"Power {'on' if request.power else 'off'}",
            response=response,
        )
    except (PioneerCommandError, ConnectionError, OSError) as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/power")
async def get_power():
    """Get current power status.

    Returns:
        dict: Current power state and raw response.
    """
    if not pioneer_conn:
        raise HTTPException(
            status_code=503, detail="Pioneer connection not initialized"
        )
    try:
        response = await pioneer_conn.send_command(POWER_QUERY)
        return {
            "power": response in ("PWR0", "PO"),
            "response": response,
        }
    except (PioneerCommandError, ConnectionError, OSError) as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# Volume endpoints
@app.post("/volume", response_model=CommandResponse)
async def set_volume(request: VolumeRequest):
    """Set volume (0-161).

    Args:
        request (VolumeRequest): Desired volume level.

    Returns:
        CommandResponse: Status of volume command.
    """
    if not pioneer_conn:
        raise HTTPException(
            status_code=503, detail="Pioneer connection not initialized"
        )
    if not 0 <= request.volume <= 161:
        raise HTTPException(status_code=400, detail="Volume must be between 0 and 161")

    command = f"{request.volume:03d}VL"
    try:
        response = await pioneer_conn.send_command(command)
        state_mgr.state["volume"] = response or f"VOL{request.volume:03d}"
        await state_mgr.broadcast()
        return CommandResponse(
            success=True,
            message=f"Volume set to {request.volume}",
            response=response,
        )
    except (PioneerCommandError, ConnectionError, OSError) as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/volume")
async def get_volume():
    """Get current volume level.

    Returns:
        dict: Current volume response.
    """
    if not pioneer_conn:
        raise HTTPException(
            status_code=503, detail="Pioneer connection not initialized"
        )
    try:
        response = await pioneer_conn.send_command(VOLUME_QUERY)
        return {
            "volume": response,
            "response": response,
        }
    except (PioneerCommandError, ConnectionError, OSError) as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/volume/up", response_model=CommandResponse)
async def volume_up():
    """Increase volume by 1 level.

    Returns:
        CommandResponse: Status of volume increase.
    """
    if not pioneer_conn:
        raise HTTPException(
            status_code=503, detail="Pioneer connection not initialized"
        )
    try:
        response = await pioneer_conn.send_command(VOLUME_UP)
        if response:
            state_mgr.state["volume"] = response
            await state_mgr.broadcast()
        return CommandResponse(
            success=True,
            message="Volume increased",
            response=response,
        )
    except (PioneerCommandError, ConnectionError, OSError) as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/volume/down", response_model=CommandResponse)
async def volume_down():
    """Decrease volume by 1 level.

    Returns:
        CommandResponse: Status of volume decrease.
    """
    if not pioneer_conn:
        raise HTTPException(
            status_code=503, detail="Pioneer connection not initialized"
        )
    try:
        response = await pioneer_conn.send_command(VOLUME_DOWN)
        if response:
            state_mgr.state["volume"] = response
            await state_mgr.broadcast()
        return CommandResponse(
            success=True,
            message="Volume decreased",
            response=response,
        )
    except (PioneerCommandError, ConnectionError, OSError) as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# Input endpoints
@app.post("/input", response_model=CommandResponse)
async def set_input(request: InputRequest):
    """Change input source.

    Args:
        request (InputRequest): Selected input source identifier.

    Returns:
        CommandResponse: Status of input selection command.
    """
    if not pioneer_conn:
        raise HTTPException(
            status_code=503, detail="Pioneer connection not initialized"
        )
    command = f"{request.input}FN"
    try:
        response = await pioneer_conn.send_command(command)
        state_mgr.state["input"] = response or f"FN{request.input}"
        await state_mgr.broadcast()
        return CommandResponse(
            success=True,
            message=f"Input changed to {request.input}",
            response=response,
        )
    except (PioneerCommandError, ConnectionError, OSError) as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/input")
async def get_input():
    """Get current input source.

    Returns:
        dict: Current input source response.
    """
    if not pioneer_conn:
        raise HTTPException(
            status_code=503, detail="Pioneer connection not initialized"
        )
    try:
        response = await pioneer_conn.send_command(INPUT_QUERY)
        return {
            "input": response,
            "response": response,
        }
    except (PioneerCommandError, ConnectionError, OSError) as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# Mute endpoints
@app.post("/mute", response_model=CommandResponse)
async def set_mute(request: PowerRequest):
    """Mute/unmute amplifier.

    Args:
        request (PowerRequest): True to mute, False to unmute.

    Returns:
        CommandResponse: Status of mute command.
    """
    if not pioneer_conn:
        raise HTTPException(
            status_code=503, detail="Pioneer connection not initialized"
        )
    command = MUTE_ON if request.power else MUTE_OFF
    try:
        response = await pioneer_conn.send_command(command)
        state_mgr.state["muted"] = request.power
        await state_mgr.broadcast()
        return CommandResponse(
            success=True,
            message=f"Mute {'on' if request.power else 'off'}",
            response=response,
        )
    except (PioneerCommandError, ConnectionError, OSError) as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/mute")
async def get_mute():
    """Get mute status.

    Returns:
        dict: Current mute state and raw response.
    """
    if not pioneer_conn:
        raise HTTPException(
            status_code=503, detail="Pioneer connection not initialized"
        )
    try:
        response = await pioneer_conn.send_command(MUTE_QUERY)
        return {
            "muted": response in ("MUT0", "MO"),
            "response": response,
        }
    except (PioneerCommandError, ConnectionError, OSError) as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# Status endpoint
@app.get("/status")
async def get_status():
    """Get complete amplifier status.

    Returns:
        dict: Status object with power, volume, muted, input, and connected fields.
    """
    if not pioneer_conn:
        raise HTTPException(
            status_code=503, detail="Pioneer connection not initialized"
        )
    try:
        return await state_mgr.update_status(pioneer_conn)
    except (PioneerCommandError, ConnectionError, OSError) as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# Raw command endpoint
@app.post("/command", response_model=CommandResponse)
async def send_raw_command(command: str):
    """Send raw telnet command.

    Args:
        command (str): Raw telnet command to dispatch.

    Returns:
        CommandResponse: Status and response of dispatched command.
    """
    if not pioneer_conn:
        raise HTTPException(
            status_code=503, detail="Pioneer connection not initialized"
        )
    try:
        response = await pioneer_conn.send_command(command)
        return CommandResponse(
            success=True,
            message="Command sent",
            response=response,
        )
    except (PioneerCommandError, ConnectionError, OSError) as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# WebSocket for real-time monitoring
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time status updates.

    Args:
        websocket (WebSocket): Client WebSocket connection.
    """
    await websocket.accept()
    await state_mgr.register(websocket)
    logger.info("WebSocket client connected")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    finally:
        state_mgr.unregister(websocket)


# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint.

    Returns:
        dict: Health status and connectivity.
    """
    if not pioneer_conn:
        return {"status": "error", "connected": False, "error": "Uninitialized"}
    try:
        connected = await pioneer_conn.is_connected()
        if not connected:
            await pioneer_conn.connect()
        return {
            "status": "ok",
            "connected": connected,
        }
    except (PioneerCommandError, ConnectionError, OSError) as e:
        return {
            "status": "error",
            "connected": False,
            "error": str(e),
        }


# Mount static build if available
frontend_dist = Path(__file__).parent / "frontend" / "dist"
if frontend_dist.exists() and (frontend_dist / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve single-page application static files.

        Args:
            full_path (str): Requested file path.

        Returns:
            FileResponse: The requested static file or index.html fallback.
        """
        requested_file = frontend_dist / full_path
        if requested_file.is_file():
            return FileResponse(requested_file)
        return FileResponse(frontend_dist / "index.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
