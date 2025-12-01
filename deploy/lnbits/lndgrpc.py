import asyncio
import base64
import os
from collections.abc import AsyncGenerator
from hashlib import sha256
from os import environ

import grpc
from loguru import logger

import lnbits.wallets.lnd_grpc_files.invoices_pb2 as invoices
import lnbits.wallets.lnd_grpc_files.invoices_pb2_grpc as invoicesrpc
import lnbits.wallets.lnd_grpc_files.lightning_pb2 as ln
import lnbits.wallets.lnd_grpc_files.lightning_pb2_grpc as lnrpc
import lnbits.wallets.lnd_grpc_files.router_pb2 as router
from lnbits.helpers import normalize_endpoint
from lnbits.settings import settings
from lnbits.utils.crypto import random_secret_and_hash
from lnbits.wallets.lnd_grpc_files.router_pb2_grpc import RouterStub

from .base import (
    Feature,
    InvoiceResponse,
    PaymentFailedStatus,
    PaymentPendingStatus,
    PaymentResponse,
    PaymentStatus,
    PaymentSuccessStatus,
    StatusResponse,
    Wallet,
)
from .macaroon import load_macaroon


def b64_to_bytes(checking_id: str) -> bytes:
    return base64.b64decode(checking_id.replace("_", "/"))


def bytes_to_b64(r_hash: bytes) -> str:
    return base64.b64encode(r_hash).decode().replace("/", "_")


def hex_to_b64(hex_str: str) -> str:
    try:
        return base64.b64encode(bytes.fromhex(hex_str)).decode()
    except ValueError:
        return ""


def hex_to_bytes(hex_str: str) -> bytes:
    try:
        return bytes.fromhex(hex_str)
    except Exception:
        return b""


def bytes_to_hex(b: bytes) -> str:
    return b.hex()


# Due to updated ECDSA generated tls.cert we need to let gprc know that
# we need to use that cipher suite otherwise there will be a handhsake
# error when we communicate with the lnd rpc server.
environ["GRPC_SSL_CIPHER_SUITES"] = "HIGH+ECDSA"


class LndWallet(Wallet):
    features = [Feature.holdinvoice]

    def __init__(self):
        # Allow env vars to backfill values that might be missing in settings.
        endpoint_env = environ.get("LND_GRPC_ENDPOINT")
        port_env = environ.get("LND_GRPC_PORT")
        macaroon_env = environ.get("LND_GRPC_MACAROON") or environ.get(
            "LND_GRPC_ADMIN_MACAROON"
        )

        if settings.lnd_grpc_endpoint is None and endpoint_env:
            settings.lnd_grpc_endpoint = endpoint_env
        if settings.lnd_grpc_port is None and port_env:
            try:
                settings.lnd_grpc_port = int(port_env)
            except Exception:
                pass
        if (not settings.lnd_grpc_macaroon) and macaroon_env:
            settings.lnd_grpc_macaroon = macaroon_env
            settings.lnd_grpc_admin_macaroon = macaroon_env

        cert_path = (
            settings.lnd_grpc_cert
            or settings.lnd_cert
            or environ.get("LND_GRPC_CERT")
            or environ.get("LND_CERT")
        )
        # Support inline PEM (plain or base64) content by writing it to a temp file.
        if cert_path:
            if "BEGIN CERTIFICATE" in cert_path or "\n" in cert_path:
                inline_path = "/tmp/lnd-inline.cert"
                with open(inline_path, "w") as f:
                    f.write(cert_path)
                cert_path = inline_path
            else:
                try:
                    decoded = base64.b64decode(cert_path).decode()
                    if "BEGIN CERTIFICATE" in decoded:
                        inline_path = "/tmp/lnd-inline.cert"
                        with open(inline_path, "w") as f:
                            f.write(decoded)
                        cert_path = inline_path
                except Exception:
                    pass
        if not cert_path and os.path.exists("/tmp/lnd-tls.cert"):
            cert_path = "/tmp/lnd-tls.cert"

        if not settings.lnd_grpc_endpoint:
            raise ValueError("cannot initialize LndWallet: missing lnd_grpc_endpoint")
        if not settings.lnd_grpc_port:
            raise ValueError("cannot initialize LndWallet: missing lnd_grpc_port")

        if not cert_path:
            raise ValueError(
                "cannot initialize LndWallet: missing lnd_grpc_cert or lnd_cert"
            )

        # If endpoint already includes a port, strip it and capture as fallback port.
        endpoint_host = settings.lnd_grpc_endpoint
        extra_port = None
        if endpoint_host and ":" in endpoint_host:
            endpoint_host, _, _port = endpoint_host.partition(":")
            try:
                extra_port = int(_port)
            except Exception:
                extra_port = None
        self.endpoint = normalize_endpoint(endpoint_host, add_proto=False)
        self.port = int(settings.lnd_grpc_port or port_env or extra_port or 10009)

        macaroon = (
            settings.lnd_grpc_macaroon
            or settings.lnd_grpc_admin_macaroon
            or settings.lnd_admin_macaroon
            or settings.lnd_grpc_invoice_macaroon
            or settings.lnd_invoice_macaroon
            or macaroon_env
        )

        if not macaroon:
            mac_path = environ.get("LND_GRPC_MACAROON_PATH", "/tmp/lnd-admin.macaroon")
            if os.path.exists(mac_path):
                macaroon = mac_path

        encrypted_macaroon = settings.lnd_grpc_macaroon_encrypted
        try:
            self.macaroon = load_macaroon(macaroon, encrypted_macaroon)
        except ValueError as exc:
            raise ValueError(f"cannot load macaroon for LndWallet: {exc!s}") from exc

        cert = open(cert_path, "rb").read()
        creds = grpc.ssl_channel_credentials(cert)
        auth_creds = grpc.metadata_call_credentials(self.metadata_callback)
        composite_creds = grpc.composite_channel_credentials(creds, auth_creds)
        channel = grpc.aio.secure_channel(
            f"{self.endpoint}:{self.port}", composite_creds
        )
        self.rpc = lnrpc.LightningStub(channel)
        self.routerpc = RouterStub(channel)
        self.invoicesrpc = invoicesrpc.InvoicesStub(channel)

    def metadata_callback(self, _, callback):
        callback([("macaroon", self.macaroon)], None)

    async def cleanup(self):
        pass

    async def status(self) -> StatusResponse:
        try:
            resp = await self.rpc.ChannelBalance(ln.ChannelBalanceRequest())  # type: ignore
        except Exception as exc:
            try:
                code = exc.code() if hasattr(exc, "code") else None
                details = exc.details() if hasattr(exc, "details") else None
                debug = (
                    exc.debug_error_string() if hasattr(exc, "debug_error_string") else None
                )
            except Exception:
                code = details = debug = None
            logger.error(
                f"LndWallet status error type={type(exc).__name__} "
                f"code={code} details={details} debug={debug} exc={exc!r}"
            )
            return StatusResponse(f"Unable to connect, got: '{exc}'", 0)

        return StatusResponse(None, resp.balance * 1000)

    async def create_invoice(
        self,
        amount: int,
        memo: str | None = None,
        description_hash: bytes | None = None,
        unhashed_description: bytes | None = None,
        **kwargs,
    ) -> InvoiceResponse:
        data: dict = {
            "description_hash": b"",
            "value": amount,
            "private": True,
            "memo": memo or "",
        }
        if kwargs.get("expiry"):
            data["expiry"] = kwargs["expiry"]
        if description_hash:
            data["description_hash"] = description_hash
        elif unhashed_description:
            data["description_hash"] = sha256(unhashed_description).digest()

        preimage = kwargs.get("preimage")
        if preimage:
            payment_hash = sha256(preimage.encode()).hexdigest()
        else:
            preimage, payment_hash = random_secret_and_hash()

        data["r_hash"] = bytes.fromhex(payment_hash)
        data["r_preimage"] = bytes.fromhex(preimage)
        try:
            req = ln.Invoice(**data)  # type: ignore
            resp = await self.rpc.AddInvoice(req)
            # response model
            # {
            #    "r_hash": <bytes>,
            #    "payment_request": <string>,
            #    "add_index": <uint64>,
            #    "payment_addr": <bytes>,
            # }
        except Exception as exc:
            logger.warning(exc)
            return InvoiceResponse(ok=False, error_message=str(exc))

        checking_id = bytes_to_hex(resp.r_hash)
        payment_request = str(resp.payment_request)
        return InvoiceResponse(
            ok=True,
            checking_id=checking_id,
            payment_request=payment_request,
            preimage=preimage,
        )

    async def pay_invoice(self, bolt11: str, fee_limit_msat: int) -> PaymentResponse:
        # fee_limit_fixed = ln.FeeLimit(fixed=fee_limit_msat // 1000)
        req = router.SendPaymentRequest(  # type: ignore
            payment_request=bolt11,
            fee_limit_msat=fee_limit_msat,
            timeout_seconds=30,
            no_inflight_updates=True,
        )
        try:
            resp = await self.routerpc.SendPaymentV2(req).read()
        except Exception as exc:
            logger.warning(exc)
            return PaymentResponse(error_message=str(exc))

        # PaymentStatus from https://github.com/lightningnetwork/lnd/blob/master/channeldb/payments.go#L178
        statuses = {
            0: None,  # NON_EXISTENT
            1: None,  # IN_FLIGHT
            2: True,  # SUCCEEDED
            3: False,  # FAILED
        }

        failure_reasons = {
            0: "Payment failed: No error given.",
            1: "Payment failed: Payment timed out.",
            2: "Payment failed: No route to destination.",
            3: "Payment failed: Error.",
        }

        if resp.status not in statuses:
            logger.error(resp)
            return PaymentResponse(ok=False, error_message="Unknown status")
        status: PaymentStatus | None = statuses[resp.status]

        fees_msat = 0
        if status is False:
            failure_reason = failure_reasons.get(
                resp.failure_reason, "Unknown failure reason"
            )
            return PaymentResponse(ok=False, fee_msat=fees_msat, error_message=failure_reason)

        if status is None:
            return PaymentResponse(
                ok=None,
                fee_msat=fees_msat,
                status=PaymentPendingStatus(None),
            )

        preimage = resp.payment_preimage.hex()
        fees_msat = resp.fee_msat
        if resp.status == ln.Payment.SUCCEEDED:
            return PaymentResponse(
                ok=True,
                fee_msat=fees_msat,
                preimage=preimage,
                status=PaymentSuccessStatus(None),
            )
        else:
            return PaymentResponse(
                ok=False,
                fee_msat=fees_msat,
                error_message=resp.failure_reason,
                status=PaymentFailedStatus(resp.failure_reason),
            )

    async def get_invoice_status(self, checking_id: str) -> PaymentStatus:
        invoice_hash = hex_to_bytes(checking_id)
        req = ln.PaymentHash(r_hash=invoice_hash)  # type: ignore
        try:
            resp = await self.rpc.LookupInvoice(req)
            settled, preimage = resp.settled, resp.r_preimage.hex()
        except Exception as exc:
            logger.warning(exc)
            return PaymentPendingStatus(str(exc))

        if not settled:
            return PaymentPendingStatus(None)
        else:
            return PaymentSuccessStatus(preimage)

    async def paid_invoices_stream(self) -> AsyncGenerator[str, None]:
        req = invoices.SubscribeSingleInvoiceRequest(  # type: ignore
            r_hash=bytes.fromhex("00")
        )
        try:
            sub = self.invoicesrpc.SubscribeSingleInvoice(req)
        except Exception as exc:
            logger.warning(exc)
            return

        while True:
            try:
                invoice = await sub.read()
                if invoice.settled:
                    yield bytes_to_hex(invoice.r_hash)
            except Exception as exc:
                logger.warning(exc)
                return

    async def get_payment_status(self, checking_id: str) -> PaymentStatus:
        """Uses the pending payment map to find the payment if it's still pending"""
        payment_hash = b64_to_bytes(checking_id)
        try:
            payments: router.TrackPaymentsResponse = await self.routerpc.TrackPayments(  # type: ignore
                router.TrackPaymentsRequest(
                    include_incomplete=True,
                    no_inflight_updates=True,
                    payment_hash=payment_hash,
                )
            ).read()
        except Exception as exc:
            logger.warning(exc)
            return PaymentPendingStatus(str(exc))

        for payment in payments.payments:
            status = PaymentStatus(payment.status)
            if status == PaymentStatus.SUCCEEDED:
                return PaymentSuccessStatus(payment.preimage.hex())
            elif status == PaymentStatus.FAILED:
                reason = PaymentFailedStatus(payment.failure_reason)
                return PaymentFailedStatus(reason.message)

        return PaymentPendingStatus(None)

    async def create_hold_invoice(
        self,
        amount: int,
        memo: str | None = None,
        description_hash: bytes | None = None,
        unhashed_description: bytes | None = None,
        **kwargs,
    ) -> InvoiceResponse:
        preimage, payment_hash = random_secret_and_hash()
        data = {
            "description_hash": b"",
            "value": amount,
            "private": True,
            "memo": memo or "",
            "hash": bytes.fromhex(payment_hash),
        }
        if kwargs.get("expiry"):
            data["expiry"] = kwargs["expiry"]
        if description_hash:
            data["description_hash"] = description_hash
        elif unhashed_description:
            data["description_hash"] = sha256(unhashed_description).digest()
        try:
            req = invoices.AddHoldInvoiceRequest(**data)  # type: ignore
            res = await self.invoicesrpc.AddHoldInvoice(req)
            logger.debug(f"AddHoldInvoice response: {res}")
        except Exception as exc:
            logger.warning(exc)
            error_message = str(exc)
            return InvoiceResponse(ok=False, error_message=error_message)
        return InvoiceResponse(
            ok=True, checking_id=payment_hash, payment_request=str(res.payment_request)
        )

    async def settle_hold_invoice(self, preimage: str) -> InvoiceResponse:
        try:
            req = invoices.SettleInvoiceMsg(preimage=hex_to_bytes(preimage))  # type: ignore
            await self.invoicesrpc.SettleInvoice(req)
        except grpc.aio.AioRpcError as exc:
            return InvoiceResponse(
                ok=False, error_message=exc.details() or "unknown grpc exception"
            )
        except Exception as exc:
            logger.warning(exc)
            return InvoiceResponse(ok=False, error_message=str(exc))
        return InvoiceResponse(ok=True, preimage=preimage)

    async def cancel_hold_invoice(self, payment_hash: str) -> InvoiceResponse:
        try:
            req = invoices.CancelInvoiceMsg(payment_hash=hex_to_bytes(payment_hash))  # type: ignore
            res = await self.invoicesrpc.CancelInvoice(req)
            logger.debug(f"CancelInvoice response: {res}")
        except Exception as exc:
            logger.warning(exc)
            # If we cannot cancel the invoice, we return an error message
            # and True for ok that should be ignored by the service
            return InvoiceResponse(
                ok=False, checking_id=payment_hash, error_message=str(exc)
            )
        # If we reach here, the invoice was successfully canceled and payment failed
        return InvoiceResponse(True, checking_id=payment_hash)
