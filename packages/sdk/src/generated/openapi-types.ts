/* Minimal hand-crafted OpenAPI types for the SDK client.
   Generated types were blocked by tooling; this mirrors current API surface. */

export type paths = {
  "/health": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": {
              status: string;
              env?: string;
              uptime?: number;
            };
          };
        };
      };
    };
  };

  "/.well-known/lnurlp/{username}": {
    get: {
      parameters: {
        path: { username: string };
      };
      responses: {
        200: {
          content: {
            "application/json": {
              callback: string;
              maxSendable: number;
              minSendable: number;
              metadata: string;
              tag: string;
            };
          };
        };
      };
    };
  };

  "/api/lnurlp/{username}/invoice": {
    get: {
      parameters: {
        path: { username: string };
        query: { amount: number };
      };
      responses: {
        200: {
          content: {
            "application/json": {
              pr: string;
              routes: unknown[];
            };
          };
        };
      };
    };
  };

  "/api/bolt12/offers": {
    post: {
      requestBody: {
        content: {
          "application/json": {
            description: string;
            amountMsat?: number;
            label?: string;
            issuer?: string;
            expiresIn?: number;
          };
        };
      };
      responses: {
        201: {
          content: {
            "application/json": {
              offer: string;
              offerId?: string;
              label?: string;
            };
          };
        };
      };
    };
  };

  "/api/bolt12/invoices": {
    post: {
      requestBody: {
        content: {
          "application/json": {
            offer: string;
            amountMsat?: number;
            quantity?: number;
            payerNote?: string;
          };
        };
      };
      responses: {
        200: {
          content: {
            "application/json": {
              invoice: string;
            };
          };
        };
      };
    };
  };

  "/.well-known/nostr.json": {
    get: {
      parameters: {
        query?: { name?: string };
      };
      responses: {
        200: {
          content: {
            "application/json": {
              names: Record<string, string>;
            };
          };
        };
      };
    };
  };

  "/api/admin/tenants": {
    post: {
      requestBody: {
        content: {
          "application/json": {
            domain: string;
            displayName: string;
          };
        };
      };
      responses: {
        201: {
          content: {
            "application/json": {
              id: string;
              domain: string;
              displayName: string;
              createdAt: string;
              updatedAt: string;
            };
          };
        };
      };
    };
  };

  "/api/admin/users": {
    post: {
      requestBody: {
        content: {
          "application/json": {
            domain: string;
            lightningAddress: string;
            pubkey: string;
          };
        };
      };
      responses: {
        201: {
          content: {
            "application/json": {
              id: string;
              tenantId: string;
              pubkey: string;
              lightningAddress?: string | null;
              createdAt: string;
              updatedAt: string;
            };
          };
        };
      };
    };
  };
};
