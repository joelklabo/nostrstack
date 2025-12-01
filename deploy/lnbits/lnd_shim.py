import os

from lnbits.wallets import lndgrpc
import sys


def _patch():
    orig_init = lndgrpc.LndWallet.__init__

    def wrapped(self):
        # Force-fill macaroon from admin env or file before calling original init.
        mac = os.getenv("LND_GRPC_ADMIN_MACAROON") or os.getenv("LND_GRPC_MACAROON")
        if not mac:
            try:
                with open("/tmp/lnd-admin.macaroon", "rb") as f:
                    mac = f.read().hex()
            except Exception:
                mac = None
        if mac:
            lndgrpc.settings.lnd_grpc_macaroon = mac
            lndgrpc.settings.lnd_grpc_admin_macaroon = mac
        print(
            "lnd_shim: endpoint",
            lndgrpc.settings.lnd_grpc_endpoint,
            "port",
            lndgrpc.settings.lnd_grpc_port,
            "mac set",
            bool(lndgrpc.settings.lnd_grpc_macaroon),
            file=sys.stderr,
        )
        return orig_init(self)

    lndgrpc.LndWallet.__init__ = wrapped


_patch()
