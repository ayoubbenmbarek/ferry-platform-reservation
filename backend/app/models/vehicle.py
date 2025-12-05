"""
Vehicle make and model database models.
"""
from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, Index
from sqlalchemy.orm import relationship
from app.database import Base


class VehicleMake(Base):
    """Vehicle manufacturer/make."""

    __tablename__ = "vehicle_makes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True, index=True)
    logo_url = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)

    # Relationships
    models = relationship("VehicleModel", back_populates="make")

    def __repr__(self):
        return f"<VehicleMake(id={self.id}, name='{self.name}')>"


class VehicleModel(Base):
    """Vehicle model for a specific make."""

    __tablename__ = "vehicle_models"

    id = Column(Integer, primary_key=True, index=True)
    make_id = Column(Integer, ForeignKey("vehicle_makes.id"), nullable=False)
    name = Column(String(100), nullable=False, index=True)
    year_start = Column(Integer, nullable=True)
    year_end = Column(Integer, nullable=True)
    body_type = Column(String(50), nullable=True)  # sedan, suv, hatchback, etc.
    is_active = Column(Boolean, default=True)

    # Average dimensions (in cm) - for auto-fill suggestions
    avg_length_cm = Column(Integer, nullable=True)
    avg_width_cm = Column(Integer, nullable=True)
    avg_height_cm = Column(Integer, nullable=True)

    # Relationships
    make = relationship("VehicleMake", back_populates="models")

    # Index for faster lookups
    __table_args__ = (
        Index('idx_make_model', 'make_id', 'name'),
    )

    def __repr__(self):
        return f"<VehicleModel(id={self.id}, make='{self.make.name if self.make else 'N/A'}', model='{self.name}')>"
