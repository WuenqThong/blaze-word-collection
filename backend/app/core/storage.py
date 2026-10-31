from datetime import timedelta
from typing import BinaryIO, Iterator, Optional
from urllib.parse import urlparse

from minio import Minio
from minio.error import S3Error

from .config import get_settings

settings = get_settings()


def _build_client(
    endpoint: str = settings.minio_endpoint,
    access_key: str = settings.minio_access_key,
    secret_key: str = settings.minio_secret_key,
    secure: bool = settings.minio_secure,
) -> Minio:
    if endpoint.startswith(("http://", "https://")):
        u = urlparse(endpoint)
        endpoint = u.netloc
        secure = u.scheme == "https"
    return Minio(endpoint, access_key=access_key, secret_key=secret_key, secure=secure)


class StorageService:
    """Wrapper quanh MinIO client cho local bucket của hệ thống."""

    def __init__(self) -> None:
        self.client = _build_client()
        self.bucket = settings.minio_bucket
        self._ensure_bucket()

    def _ensure_bucket(self) -> None:
        try:
            if not self.client.bucket_exists(self.bucket):
                self.client.make_bucket(self.bucket)
        except S3Error:
            # In production có thể cần permission khác — khoan raise để app vẫn boot
            pass

    # ------------- writes -------------
    def put_object(self, key: str, data: BinaryIO, length: int, content_type: str) -> None:
        self.client.put_object(self.bucket, key, data, length, content_type=content_type)

    def remove_object(self, key: str) -> None:
        try:
            self.client.remove_object(self.bucket, key)
        except S3Error:
            pass

    # ------------- reads -------------
    def presigned_get(self, key: str, ttl_sec: Optional[int] = None) -> str:
        return self.client.presigned_get_object(
            self.bucket,
            key,
            expires=timedelta(seconds=ttl_sec or settings.minio_presign_ttl_sec),
        )

    def stat_object(self, key: str):
        return self.client.stat_object(self.bucket, key)


class ExternalSyncClient:
    """Client một-lần để liệt kê + tải file từ MinIO/S3 ngoại hệ thống."""

    def __init__(self, endpoint: str, access_key: str, secret_key: str, secure: bool = False) -> None:
        self.client = _build_client(endpoint, access_key, secret_key, secure)

    def list_objects(self, bucket: str, prefix: str = "", limit: int = 500) -> list[dict]:
        out: list[dict] = []
        for obj in self.client.list_objects(bucket, prefix=prefix, recursive=True):
            if obj.is_dir:
                continue
            out.append({"key": obj.object_name, "size": obj.size, "last_modified": obj.last_modified})
            if len(out) >= limit:
                break
        return out

    def stream_object(self, bucket: str, key: str) -> Iterator[bytes]:
        response = self.client.get_object(bucket, key)
        try:
            for chunk in response.stream(amt=1024 * 256):
                yield chunk
        finally:
            response.close()
            response.release_conn()


_singleton: Optional[StorageService] = None


def get_storage() -> StorageService:
    global _singleton
    if _singleton is None:
        _singleton = StorageService()
    return _singleton
