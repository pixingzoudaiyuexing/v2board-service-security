## 1.1.3

### Changed

- Added compatibility mode for mixed traffic:
  - encrypted web requests remain supported
  - plain Android app requests can now proxy through the same middleware
- Improved `/api/v1/*` proxy forwarding behavior for Android-compatible request bodies
- Added and documented Cloudflare Worker fallback build

### Recommended config

```dotenv
ENCRYPTED_REQUEST_ONLY=false
```

Use `false` when the same middleware instance needs to serve both:

- encrypted web frontend traffic
- plain HTTPS Android app traffic
