"""Serve the built SPA on the same origin as the API."""
from pathlib import PurePosixPath
from starlette.staticfiles import StaticFiles
from starlette.exceptions import HTTPException


class FrontendFiles(StaticFiles):
    async def get_response(self, path, scope):
        path = path.replace('\\', '/').lstrip('/')
        # Missing API endpoints and assets must never turn into an HTML 200.
        if path.split('/', 1)[0] in {'api', 'docs', 'redoc', 'openapi.json'} or any(part.startswith('.') and part != '.' for part in PurePosixPath(path).parts):
            raise HTTPException(404)
        try:
            response = await super().get_response(path, scope)
        except HTTPException as error:
            if error.status_code != 404:
                raise
        else:
            if response.status_code != 404:
                if response.headers.get('content-type', '').startswith('text/html'):
                    response.headers['Cache-Control'] = 'no-cache'
                return response
        if scope['method'] not in {'GET', 'HEAD'} or PurePosixPath(path).suffix or '..' in PurePosixPath(path).parts:
            raise HTTPException(404)
        response = await super().get_response('index.html', scope)
        response.headers['Cache-Control'] = 'no-cache'
        return response
