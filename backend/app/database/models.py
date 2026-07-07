from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, Table
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

# Many-to-many relationship helper table for Media and Tags
media_tags = Table(
    "media_tags",
    Base.metadata,
    Column("media_id", Integer, ForeignKey("media.id", ondelete="CASCADE")),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"))
)

class Media(Base):
    __tablename__ = "media"

    id = Column(Integer, primary_key=True, index=True)
    file_path = Column(String, unique=True, index=True, nullable=False)
    file_hash = Column(String, unique=True, index=True, nullable=False)
    file_name = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String, nullable=False)
    duration = Column(Float, nullable=True)  # In seconds, for video/audio
    thumbnail_path = Column(String, nullable=True)
    status = Column(String, default="pending", nullable=False)  # pending, processing, completed, failed
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    transcript = relationship("Transcript", uselist=False, back_populates="media", cascade="all, delete-orphan")
    chunks = relationship("Chunk", back_populates="media", cascade="all, delete-orphan")
    topics = relationship("Topic", back_populates="media", cascade="all, delete-orphan")
    speakers = relationship("Speaker", back_populates="media", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="media", cascade="all, delete-orphan")
    relationships = relationship("Relationship", back_populates="media", cascade="all, delete-orphan")
    tags = relationship("Tag", secondary=media_tags, back_populates="media")

class Transcript(Base):
    __tablename__ = "transcripts"

    id = Column(Integer, primary_key=True, index=True)
    media_id = Column(Integer, ForeignKey("media.id", ondelete="CASCADE"), nullable=False, unique=True)
    full_text = Column(Text, nullable=False)
    language = Column(String, nullable=True)
    word_level_data = Column(Text, nullable=True)  # JSON-serialized word timestamp array
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    media = relationship("Media", back_populates="transcript")

class Chunk(Base):
    __tablename__ = "chunks"

    id = Column(Integer, primary_key=True, index=True)
    media_id = Column(Integer, ForeignKey("media.id", ondelete="CASCADE"), nullable=False)
    vector_id = Column(String, unique=True, index=True, nullable=False)  # Map to ChromaDB document ID
    text = Column(Text, nullable=False)
    start_time = Column(Float, nullable=True)
    end_time = Column(Float, nullable=True)
    page_number = Column(Integer, nullable=True)
    chunk_index = Column(Integer, nullable=False)

    media = relationship("Media", back_populates="chunks")

class Topic(Base):
    __tablename__ = "topics"

    id = Column(Integer, primary_key=True, index=True)
    media_id = Column(Integer, ForeignKey("media.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    summary = Column(Text, nullable=False)
    start_time = Column(Float, nullable=True)
    end_time = Column(Float, nullable=True)

    media = relationship("Media", back_populates="topics")

class Speaker(Base):
    __tablename__ = "speakers"

    id = Column(Integer, primary_key=True, index=True)
    media_id = Column(Integer, ForeignKey("media.id", ondelete="CASCADE"), nullable=False)
    label = Column(String, nullable=False)  # e.g., "SPEAKER_00"
    display_name = Column(String, nullable=False)  # e.g., "John Doe" (initially same as label)
    voice_signature = Column(Text, nullable=True)

    media = relationship("Media", back_populates="speakers")

class Entity(Base):
    __tablename__ = "entities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    entity_type = Column(String, nullable=False)  # Person, Organization, Location, Topic, Project, etc.
    description = Column(Text, nullable=True)

    # Relationships
    source_relations = relationship("Relationship", foreign_keys="[Relationship.source_id]", back_populates="source_entity", cascade="all, delete-orphan")
    target_relations = relationship("Relationship", foreign_keys="[Relationship.target_id]", back_populates="target_entity", cascade="all, delete-orphan")

class Relationship(Base):
    __tablename__ = "relationships"

    id = Column(Integer, primary_key=True, index=True)
    media_id = Column(Integer, ForeignKey("media.id", ondelete="CASCADE"), nullable=False)
    source_id = Column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    target_id = Column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    relation_type = Column(String, nullable=False)  # e.g., "works_at", "mentioned_in", "collaborates_with"

    media = relationship("Media", back_populates="relationships")
    source_entity = relationship("Entity", foreign_keys=[source_id], back_populates="source_relations")
    target_entity = relationship("Entity", foreign_keys=[target_id], back_populates="target_relations")

class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    media_id = Column(Integer, ForeignKey("media.id", ondelete="SET NULL"), nullable=True)
    title = Column(String, nullable=False, default="Untitled Note")
    content = Column(Text, nullable=False)
    timestamp = Column(Float, nullable=True)  # Associated offset in media if relevant
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    media = relationship("Media", back_populates="notes")

class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)

    media = relationship("Media", secondary=media_tags, back_populates="tags")
