from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ProjectBase(BaseModel):
    slug: str
    name: str
    short_name: str
    project_type: str = "lotes"
    tagline: str = ""
    description: str = ""
    long_description: str = ""
    features: str = ""
    location: str = ""
    reference: str = ""
    map_link: str = ""
    latitude: float | None = None
    longitude: float | None = None
    color_primary: str = "#14532d"
    color_secondary: str = "#1e3a5f"
    hero_image: str = ""
    hero_video: str = ""
    logo_url: str = ""
    plan_pdf_url: str = ""
    status: str = "active"
    is_published: bool = True
    legal_info: str = ""
    seo_title: str = ""
    seo_description: str = ""
    og_image: str = ""


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    slug: str | None = None
    name: str | None = None
    short_name: str | None = None
    project_type: str | None = None
    tagline: str | None = None
    description: str | None = None
    long_description: str | None = None
    features: str | None = None
    location: str | None = None
    reference: str | None = None
    map_link: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    color_primary: str | None = None
    color_secondary: str | None = None
    hero_image: str | None = None
    hero_video: str | None = None
    logo_url: str | None = None
    plan_pdf_url: str | None = None
    status: str | None = None
    is_published: bool | None = None
    legal_info: str | None = None
    seo_title: str | None = None
    seo_description: str | None = None
    og_image: str | None = None


class ProjectOut(ProjectBase):
    id: int
    created_at: datetime | None = None
    updated_at: datetime | None = None
    blocks_count: int = 0
    lots_count: int = 0
    available_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class BlockCreate(BaseModel):
    project_id: int
    code: str = Field(min_length=1, max_length=10)
    name: str = ""
    sort_order: int = 0


class BlockUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    sort_order: int | None = None


class BlockOut(BaseModel):
    id: int
    project_id: int
    code: str
    name: str
    sort_order: int
    lots_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class LotCreate(BaseModel):
    project_id: int
    block_id: int | None = None
    code: str
    lot_number: int | None = None
    area_m2: float | None = None
    price_per_m2: float | None = None
    price: float | None = None
    promo_price: float | None = None
    status: str = "available"
    x: float | None = None
    y: float | None = None
    width: float | None = None
    height: float | None = None
    notes: str = ""
    zone: str | None = None
    location_bonus: str | None = None
    location_bonus_amount: float | None = None
    normal_price_usd: float | None = None
    normal_price_soles: float | None = None
    contract_pdf_url: str | None = None


class LotUpdate(BaseModel):
    block_id: int | None = None
    code: str | None = None
    lot_number: int | None = None
    area_m2: float | None = None
    price_per_m2: float | None = None
    price: float | None = None
    promo_price: float | None = None
    status: str | None = None
    x: float | None = None
    y: float | None = None
    width: float | None = None
    height: float | None = None
    notes: str | None = None
    zone: str | None = None
    location_bonus: str | None = None
    location_bonus_amount: float | None = None
    normal_price_usd: float | None = None
    normal_price_soles: float | None = None
    contract_pdf_url: str | None = None


class LotStatusUpdate(BaseModel):
    status: str


class LotOut(BaseModel):
    id: int
    project_id: int
    block_id: int | None = None
    block_code: str | None = None
    code: str
    lot_number: int | None = None
    area_m2: float | None = None
    price_per_m2: float | None = None
    price: float | None = None
    promo_price: float | None = None
    status: str
    x: float | None = None
    y: float | None = None
    width: float | None = None
    height: float | None = None
    notes: str | None = None
    zone: str | None = None
    location_bonus: str | None = None
    location_bonus_amount: float | None = None
    normal_price_usd: float | None = None
    normal_price_soles: float | None = None
    contract_pdf_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class ProjectImagesOut(BaseModel):
    items: list[Any] = []


class GalleryItem(BaseModel):
    id: int
    url: str
    caption: str
    category: str
    sort_order: int
    is_cover: bool

    model_config = ConfigDict(from_attributes=True)


class GalleryCreate(BaseModel):
    project_id: int
    url: str
    caption: str = ""
    category: str = "gallery"
    sort_order: int = 0
    is_cover: bool = False


class VideoCreate(BaseModel):
    project_id: int
    url: str
    title: str = ""
    video_type: str = "promotional"
    sort_order: int = 0


class DocumentCreate(BaseModel):
    project_id: int
    name: str
    category: str = "brochure"
    url: str
    description: str = ""
    is_published: bool = True


class DocumentUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    url: str | None = None
    description: str | None = None
    is_published: bool | None = None


class PromotionCreate(BaseModel):
    project_id: int
    name: str
    description: str = ""
    old_price: float | None = None
    promo_price: float | None = None
    start_date: Any = None
    end_date: Any = None
    is_active: bool = True


class PromotionUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    old_price: float | None = None
    promo_price: float | None = None
    start_date: Any = None
    end_date: Any = None
    is_active: bool | None = None


class PromotionOut(BaseModel):
    id: int
    project_id: int
    name: str
    description: str
    old_price: float | None = None
    promo_price: float | None = None
    start_date: Any = None
    end_date: Any = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)