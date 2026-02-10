import io
import logging
import boto3
from botocore.exceptions import ClientError
from app.core.config import S3_ACCESS_KEY, S3_SECRET_KEY, S3_ENDPOINT, S3_BUCKET, S3_REGION

logger = logging.getLogger(__name__)

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=S3_ENDPOINT,
            aws_access_key_id=S3_ACCESS_KEY,
            aws_secret_access_key=S3_SECRET_KEY,
            region_name=S3_REGION,
        )
    return _client


def s3_enabled() -> bool:
    return all([S3_ACCESS_KEY, S3_SECRET_KEY, S3_ENDPOINT, S3_BUCKET])


def upload_bytes(key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    """Upload bytes to S3. Returns the S3 key."""
    client = _get_client()
    client.put_object(
        Bucket=S3_BUCKET,
        Key=key,
        Body=data,
        ContentType=content_type,
    )
    logger.info(f"S3 upload: {key} ({len(data)} bytes)")
    return key


def download_bytes(key: str) -> bytes:
    """Download file from S3, returns bytes."""
    client = _get_client()
    resp = client.get_object(Bucket=S3_BUCKET, Key=key)
    return resp["Body"].read()


def delete_object(key: str):
    """Delete object from S3."""
    try:
        client = _get_client()
        client.delete_object(Bucket=S3_BUCKET, Key=key)
        logger.info(f"S3 delete: {key}")
    except ClientError as e:
        logger.warning(f"S3 delete failed for {key}: {e}")


def presigned_url(key: str, expires: int = 3600) -> str:
    """Generate a presigned download URL."""
    client = _get_client()
    url = client.generate_presigned_url(
        "get_object",
        Params={"Bucket": S3_BUCKET, "Key": key},
        ExpiresIn=expires,
    )
    return url
