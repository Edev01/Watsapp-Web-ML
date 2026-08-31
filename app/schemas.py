from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class MessageCategory(str, Enum):
    INQUIRY = "INQUIRY"
    SUPPORT = "SUPPORT"
    SALES = "SALES"
    COMPLAINT = "COMPLAINT"
    GENERAL = "GENERAL"
    SPAM = "SPAM"


class Sentiment(str, Enum):
    POSITIVE = "POSITIVE"
    NEUTRAL = "NEUTRAL"
    NEGATIVE = "NEGATIVE"


class EntityExtractionSchema(BaseModel):
    products: List[str] = Field(default_factory=list, description="Products, services, or packages mentioned")
    dates_mentioned: List[str] = Field(default_factory=list, description="Any specific dates or timeframes mentioned")
    action_items: List[str] = Field(default_factory=list, description="Requested tasks or actions required")
    names: List[str] = Field(default_factory=list, description="Names of individuals or organizations mentioned")


class NormalizedOutputSchema(BaseModel):
    is_property_listing_or_inquiry: bool = Field(description="True if message contains a property listing, property inquiry, or commercial deal. False if it is general greeting, chit-chat, spam, or unrelated discussion.")
    summary: str = Field(description="Concise 1-2 sentence summary of the message")
    category: MessageCategory = Field(description="High-level message classification")
    intent: str = Field(default="", description="Primary intent or question of the sender")
    sentiment: Sentiment = Field(description="Overall sentiment of the message sender")
    
    # Real estate specific metadata
    purpose: Optional[str] = Field(default=None, description="SALE | RENT. Use SALE for properties being sold/advertised for sale. Use RENT for properties being rented/leased. Null if unrelated.")
    property_type: Optional[str] = Field(default=None, description="PLOT | HOUSE | BUNGALOW | APARTMENT | FLAT | SHOP | COMMERCIAL | FARMHOUSE. Null if unrelated.")
    property_sub_type: Optional[str] = Field(default=None, description="Single Storey | Double Storey | Triple Storey | Studio | 1 Bed | 2 Bed | 3 Bed | Penthouse | Lower Portion | Upper Portion | Residential Plot | Commercial Plot | Agricultural Land | Industrial Land | Office | Shop | Warehouse | Factory | Building. Null if none.")
    city: Optional[str] = Field(default=None, description="City mentioned, e.g. Karachi, Lahore, Islamabad. Null if none.")
    area: Optional[str] = Field(default=None, description="Major housing scheme or area, e.g. DHA, Bahria Town, Clifton, Gulberg, G-11. Null if none.")
    vicinity: Optional[str] = Field(default=None, description="Sub-location, street, block, or phase, e.g. Phase 6, Phase 5, 29th Street, Block H, Scheme 33. Null if none.")
    size: Optional[str] = Field(default=None, description="Size of property, e.g. 1000 Yards, 2 Kanal, 4 Marla, 120 Sq. Yd. Null if none.")
    size_value: Optional[float] = Field(default=None, description="Numeric size value only, e.g. 1000, 2, 4, 120. Null if none.")
    size_unit: Optional[str] = Field(default=None, description="Size unit only: Marla | Kanal | Sq. Ft. | Sq. Yd. | Sq. M. Null if none.")
    price: Optional[str] = Field(default=None, description="Price of property, e.g. 15 Crore, 45,000 / month, 1.8 Cr. Null if none.")
    price_value: Optional[float] = Field(default=None, description="Numeric price value in PKR (convert Cr to 10000000, Lac to 100000), e.g. 15000000, 4500000. Null if none.")
    contact_number: Optional[str] = Field(default=None, description="Any phone numbers mentioned in the message text. Null if none.")

    entities: EntityExtractionSchema = Field(default_factory=EntityExtractionSchema, description="Extracted general entities")
    language: str = Field(default="en", description="Language of message e.g. en, ur, hinglish")
    confidence_score: float = Field(default=1.0, ge=0.0, le=1.0, description="Confidence score from 0.0 to 1.0")


