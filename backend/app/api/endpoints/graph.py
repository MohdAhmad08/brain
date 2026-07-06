from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.database.connection import get_db
from backend.app.database.models import Entity, Relationship, Media

router = APIRouter()

@router.get("", response_model=dict)
def get_knowledge_graph(
    media_id: Optional[int] = None, 
    db: Session = Depends(get_db)
):
    """
    Returns entities and relationships structured for React Flow canvas display.
    """
    # 1. Fetch Relationships
    rel_query = db.query(Relationship)
    if media_id:
        rel_query = rel_query.filter(Relationship.media_id == media_id)
    relationships = rel_query.all()

    # Get set of all active entity IDs in these relationships
    active_entity_ids = set()
    for rel in relationships:
        active_entity_ids.add(rel.source_id)
        active_entity_ids.add(rel.target_id)

    # 2. Fetch Entities
    ent_query = db.query(Entity)
    if media_id and active_entity_ids:
        ent_query = ent_query.filter(Entity.id.in_(active_entity_ids))
    entities = ent_query.all()

    # Format nodes for React Flow
    nodes = []
    # Simple layout spacing estimation
    import math
    num_nodes = len(entities)
    radius = max(num_nodes * 20, 150)
    
    for idx, ent in enumerate(entities):
        # Place nodes in a circle by default to give a neat layout
        angle = (2 * math.pi * idx) / max(num_nodes, 1)
        x = 400 + radius * math.cos(angle)
        y = 300 + radius * math.sin(angle)
        
        nodes.append({
            "id": str(ent.id),
            "type": "customNode", # Custom node type for custom styling
            "position": {"x": round(x, 1), "y": round(y, 1)},
            "data": {
                "label": ent.name,
                "type": ent.entity_type,
                "description": ent.description or ""
            }
        })

    # Format edges for React Flow
    edges = []
    for rel in relationships:
        edges.append({
            "id": f"e_{rel.id}",
            "source": str(rel.source_id),
            "target": str(rel.target_id),
            "label": rel.relation_type,
            "animated": True,
            "style": {"stroke": "#8b5cf6"} # Violet glow line styling
        })

    return {
        "nodes": nodes,
        "edges": edges
    }
