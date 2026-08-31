from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from app.database import Base


class WhatsAppMessage(Base):
    """Raw WhatsApp message stored in PostgreSQL."""
    __tablename__ = "whatsapp_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    chat_jid = Column(String, nullable=False, index=True)
    sender = Column(String, nullable=True)
    timestamp = Column(String, nullable=True)
    message = Column(Text, nullable=True)
    from_me = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship to normalized records
    normalized_records = relationship("NormalizedMessage", back_populates="raw_message", cascade="all, delete-orphan")


class NormalizedMessage(Base):
    """Structured AI-normalized representation of a WhatsApp message."""
    __tablename__ = "normalized_messages"

    id = Column(Integer, primary_key=True, index=True)
    whatsapp_message_id = Column(Integer, ForeignKey("whatsapp_messages.id"), nullable=False, index=True)
    chat_jid = Column(String, nullable=False, index=True)
    sender = Column(String, nullable=True)
    category = Column(String, nullable=True, index=True)
    intent = Column(String, nullable=True)
    sentiment = Column(String, nullable=True, index=True)
    language = Column(String, nullable=True)
    summary = Column(Text, nullable=True)
    entities = Column(JSON, nullable=True)
    city = Column(String, nullable=True, index=True)
    is_property = Column(Boolean, default=True)
    purpose = Column(String, nullable=True, index=True)
    property_type = Column(String, nullable=True, index=True)
    property_sub_type = Column(String, nullable=True, index=True)
    area = Column(String, nullable=True, index=True)
    vicinity = Column(String, nullable=True)
    size = Column(String, nullable=True)
    size_value = Column(Float, nullable=True)
    size_unit = Column(String, nullable=True)
    price = Column(String, nullable=True)
    price_value = Column(Float, nullable=True)
    contact_number = Column(String, nullable=True)
    confidence_score = Column(Float, default=1.0)
    model_used = Column(String, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship back to raw message
    raw_message = relationship("WhatsAppMessage", back_populates="normalized_records")


class NormalizationBenchmark(Base):
    """Benchmark metrics comparing different LLM models for normalization."""
    __tablename__ = "normalization_benchmarks"

    id = Column(Integer, primary_key=True, index=True)
    model_name = Column(String, nullable=False, index=True)
    sample_size = Column(Integer, nullable=False)
    avg_latency_sec = Column(Float, nullable=False)
    tokens_per_sec = Column(Float, nullable=False)
    json_validity_rate = Column(Float, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


from sqlalchemy.types import UserDefinedType

class PGVector(UserDefinedType):
    """Custom PostgreSQL Vector type to avoid compiling external binaries on Windows."""
    def __init__(self, dimensions: int):
        self.dimensions = dimensions

    def get_col_spec(self, **kw) -> str:
        return f"vector({self.dimensions})"


class ModelComparison(Base):
    """Store normalization results of multiple models side-by-side."""
    __tablename__ = "model_comparisons"

    id = Column(Integer, primary_key=True, index=True)
    whatsapp_message_id = Column(Integer, ForeignKey("whatsapp_messages.id"), unique=True, nullable=False, index=True)
    raw_message = Column(Text, nullable=True)
    qwen_result = Column(JSON, nullable=True)
    llama_result = Column(JSON, nullable=True)
    deepseek_result = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class NormalizeClaim(Base):
    """In-flight lock so parallel workers / tenants never process the same row."""
    __tablename__ = "normalize_claims"

    whatsapp_message_id = Column(Integer, primary_key=True)
    model_used = Column(String, primary_key=True)
    user_id = Column(Integer, nullable=True, index=True)
    claimed_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class MessageEmbedding(Base):
    """Store vector embeddings for normalized message content."""
    __tablename__ = "message_embeddings"

    id = Column(Integer, primary_key=True, index=True)
    whatsapp_message_id = Column(Integer, ForeignKey("whatsapp_messages.id"), nullable=False, index=True)
    model_used = Column(String, nullable=False, index=True)
    content_chunk = Column(Text, nullable=False)
    embedding = Column(PGVector(768), nullable=False)  # Matches Ollama nomic-embed-text/bge-m3 size
    created_at = Column(DateTime, default=datetime.utcnow)

