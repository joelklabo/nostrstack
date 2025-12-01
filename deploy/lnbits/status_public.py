from fastapi import APIRouter

from lnbits.wallets import get_funding_source
from lnbits.wallets.base import StatusResponse

status_router = APIRouter(tags=["Core"], prefix="/status")


@status_router.get("/health")
async def health() -> dict:
    """Public lightweight health with funding backend state."""
    funding = get_funding_source()
    status: StatusResponse = await funding.status()
    return {
        "funding_source": funding.__class__.__name__,
        "funding_error": status.error_message,
        "funding_balance_msat": status.balance_msat,
    }
