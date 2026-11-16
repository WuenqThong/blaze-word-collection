"""Start the API with explicit TLS / trusted-proxy boundaries and safe logs."""
import argparse
import uvicorn
from app.core.config import get_settings


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--ssl-keyfile')
    parser.add_argument('--ssl-certfile')
    args = parser.parse_args()
    settings = get_settings()
    if bool(args.ssl_keyfile) != bool(args.ssl_certfile):
        parser.error('Both TLS key and certificate are required')
    if settings.environment == 'production' and not settings.trusted_proxy_ips and not args.ssl_certfile:
        parser.error('Production requires TLS or an explicit trusted reverse-proxy allowlist')
    uvicorn.run('app.main:app', host=args.host, port=args.port, access_log=False,
                proxy_headers=bool(settings.trusted_proxy_ips), forwarded_allow_ips=','.join(settings.trusted_proxy_ips),
                ssl_keyfile=args.ssl_keyfile, ssl_certfile=args.ssl_certfile)


if __name__ == '__main__':
    main()
