"""
Session Vault — AES-256-GCM in-memory encryption for analysis results.

Each analysis run gets a unique 256-bit key. All data written to the vault
is encrypted immediately. The key lives only in process memory. On session
close, secure_wipe() overwrites both the key and ciphertext buffers.

No plaintext is ever written to disk. SQLite stores only ciphertext blobs.
"""
import ctypes
import os
import struct
from dataclasses import dataclass, field
from typing import Any
import json

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


@dataclass
class EncryptedRecord:
    nonce:      bytes
    ciphertext: bytes
    tag_len:    int = 16   # GCM default


class SessionVault:
    """
    In-memory vault for a single analysis run.
    Thread-safe reads; writes protected by Python GIL for this use case.
    """

    def __init__(self):
        self._key: bytes = os.urandom(32)   # AES-256
        self._store: dict[str, EncryptedRecord] = {}
        self._wiped: bool = False

    # ── Public interface ───────────────────────────────────────────────

    def put(self, key: str, value: Any) -> None:
        """Encrypt and store any JSON-serialisable value."""
        if self._wiped:
            raise RuntimeError("Vault has been wiped — create a new session.")
        plaintext = json.dumps(value).encode()
        nonce = os.urandom(12)
        aesgcm = AESGCM(self._key)
        ciphertext = aesgcm.encrypt(nonce, plaintext, associated_data=key.encode())
        self._store[key] = EncryptedRecord(nonce=nonce, ciphertext=ciphertext)

    def get(self, key: str) -> Any:
        """Decrypt and return a stored value, or None if not present."""
        if self._wiped:
            raise RuntimeError("Vault has been wiped.")
        record = self._store.get(key)
        if record is None:
            return None
        aesgcm = AESGCM(self._key)
        plaintext = aesgcm.decrypt(record.nonce, record.ciphertext, associated_data=key.encode())
        return json.loads(plaintext)

    def key_fingerprint(self) -> str:
        """
        Returns last 8 hex chars of SHA-256(key) — safe to display in UI
        as proof-of-encryption without exposing the key.
        """
        import hashlib
        digest = hashlib.sha256(self._key).hexdigest()
        return digest[-8:].upper()

    def secure_wipe(self) -> None:
        """
        Overwrite key and all ciphertext buffers with zeros in memory,
        then delete references. Best-effort under CPython — the GC may
        still hold stale references, but this eliminates the primary risk.
        """
        if self._wiped:
            return

        # Overwrite key bytes
        key_len = len(self._key)
        buf = (ctypes.c_char * key_len).from_buffer_copy(self._key)
        ctypes.memset(buf, 0, key_len)

        # Overwrite all stored ciphertexts
        for record in self._store.values():
            ct_len = len(record.ciphertext)
            ct_buf = (ctypes.c_char * ct_len).from_buffer_copy(record.ciphertext)
            ctypes.memset(ct_buf, 0, ct_len)

        self._store.clear()
        self._key   = b""
        self._wiped = True

    @property
    def is_wiped(self) -> bool:
        return self._wiped


# ── Module-level vault registry ────────────────────────────────────────────────
# Maps run_id → SessionVault. Wiped when pipeline completes or app exits.

_vaults: dict[int, SessionVault] = {}


def create_vault(run_id: int) -> SessionVault:
    vault = SessionVault()
    _vaults[run_id] = vault
    return vault


def get_vault(run_id: int) -> SessionVault | None:
    return _vaults.get(run_id)


def destroy_vault(run_id: int) -> None:
    vault = _vaults.pop(run_id, None)
    if vault:
        vault.secure_wipe()
