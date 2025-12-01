import os

from lnbits.settings import settings, ExchangeRateProvider

# Pull in shim that patches LndWallet to backfill macaroons/port before init.
try:
    import lnd_shim  # noqa: F401
except Exception:
    pass

# Mount a public status router with backend balance.
try:
    from fastapi import FastAPI
    import status_public

    _fastapi_init = FastAPI.__init__

    def _fastapi_init_with_status(self, *args, **kwargs):
        _fastapi_init(self, *args, **kwargs)
        try:
            self.include_router(status_public.status_router)
        except Exception:
            pass

    FastAPI.__init__ = _fastapi_init_with_status  # type: ignore
except Exception:
    pass

# Force asyncpg to use TLS by default for Postgres URLs.
try:
    import lnbits.db as _ln_db
    from sqlalchemy.ext.asyncio import create_async_engine as _sa_create_async_engine

    def _create_async_engine_with_ssl(url, **kwargs):
        if url.startswith("postgres://"):
            kwargs.setdefault("connect_args", {}).setdefault("ssl", True)
        return _sa_create_async_engine(url, **kwargs)

    _ln_db.create_async_engine = _create_async_engine_with_ssl
except Exception:
    pass

# Remove Binance (HTTP 451 in US) and add CoinGecko for fiat rates.
try:
    providers = [
        p for p in settings.lnbits_exchange_rate_providers if p.name.lower() != "binance"
    ]
    providers.insert(
        0,
        ExchangeRateProvider(
            name="CoinGecko",
            api_url="https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies={TO}",
            path="$.bitcoin.{TO}",
            exclude_to=[],
            ticker_conversion=[],
        ),
    )
    settings.lnbits_exchange_rate_providers = providers
except Exception:
    pass

# Force-fill gRPC port from env if pydantic missed it (seen in Container Apps).
if not settings.lnd_grpc_port:
    try:
        settings.lnd_grpc_port = int(os.getenv("LND_GRPC_PORT", "10009"))
    except Exception:
        settings.lnd_grpc_port = None

# Force-fill macaroon path if missing.
if not settings.lnd_grpc_macaroon:
    settings.lnd_grpc_macaroon = os.getenv("LND_GRPC_MACAROON")
if not settings.lnd_grpc_admin_macaroon:
    settings.lnd_grpc_admin_macaroon = os.getenv("LND_GRPC_ADMIN_MACAROON")

# Ensure endpoint strips proto/port if provided.
if settings.lnd_grpc_endpoint and "://" in settings.lnd_grpc_endpoint:
    settings.lnd_grpc_endpoint = settings.lnd_grpc_endpoint.split("://", 1)[1].split(
        ":"
    )[0]

# Also backfill onto the wallet module settings before wallet init.
try:
    from lnbits.wallets import lndgrpc

    if not lndgrpc.settings.lnd_grpc_port:
        lndgrpc.settings.lnd_grpc_port = settings.lnd_grpc_port
    if not lndgrpc.settings.lnd_grpc_macaroon:
        lndgrpc.settings.lnd_grpc_macaroon = settings.lnd_grpc_macaroon
    if not lndgrpc.settings.lnd_grpc_admin_macaroon:
        lndgrpc.settings.lnd_grpc_admin_macaroon = settings.lnd_grpc_admin_macaroon
except Exception:
    pass

try:
    import lnd_shim  # noqa: F401
except Exception:
    pass
