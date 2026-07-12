"""
SQLite database models via SQLModel for Attack Chain Mapper.
"""
from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel, create_engine, Session
import os
import json

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sentinel.db")
engine = create_engine(DATABASE_URL, echo=False)


class AnalysisRun(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    repo_url: str
    status: str = "pending"  # pending | cloning | scanning | graphing | reasoning | scoring | done | error
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    error_message: Optional[str] = None
    report_url:    Optional[str] = None
    work_dir_path: Optional[str] = None  # cloned repo path — None once deleted


class Finding(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    run_id: int = Field(foreign_key="analysisrun.id")
    source: str  # "semgrep" | "pip-audit"
    rule_id: str
    severity: str  # "ERROR" | "WARNING" | "INFO"
    file_path: str
    line_start: int = 0
    message: str
    extra: Optional[str] = None  # JSON blob for additional data


class GraphData(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    run_id: int = Field(foreign_key="analysisrun.id")
    nodes_json: str = "[]"  # JSON: [{id, label, type, file}]
    edges_json: str = "[]"  # JSON: [{source, target, label}]


class AttackChain(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    run_id: int = Field(foreign_key="analysisrun.id")
    chain_index: int = 0
    title: str
    steps_json: str = "[]"   # JSON: [{node, weakness, action}]
    impact: str = "Low"      # "Critical" | "High" | "Low"
    confidence: float = 0.0
    explanation: str = ""
    node_ids_json: str = "[]"  # node ids that light up in the graph
    historical_similarity: Optional[str] = None  # e.g. "2020 SolarWinds (82% match)"


class ThreatIntelGraph(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    run_id: int
    published_at: datetime = Field(default_factory=datetime.utcnow)
    topology_hash: str  # Hash of the graph structure for signature matching
    nodes_json: str = "[]"  # Anonymized/hashed nodes
    edges_json: str = "[]"
    impact_level: str


class SandboxProfile(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    run_id: int = Field(foreign_key="analysisrun.id")
    chain_id: int = Field(foreign_key="attackchain.id")
    profile_type: str  # "seccomp" | "apparmor"
    content: str       # The actual generated profile string


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
