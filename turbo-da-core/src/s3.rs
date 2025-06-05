use aws_sdk_s3::{
    primitives::{AggregatedBytes, ByteStream},
    Client,
};

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Deserialize, Serialize)]
pub(crate) struct S3Upload {
    data: String,
}

pub(crate) async fn s3_upload(
    body: ByteStream,
    name: &String,
    s3_bucket_name: &String,
    aws_access_key_id: &String,
    aws_secret_access_key: &String,
    aws_endpoint_url: &String,
) -> Result<String, String> {
    let shared_config = aws_config::from_env()
        .endpoint_url(aws_endpoint_url)
        .credentials_provider(aws_sdk_s3::config::Credentials::new(
            aws_access_key_id,
            aws_secret_access_key,
            None,
            None,
            "R2",
        ))
        .region("auto")
        .load()
        .await;
    let client = Client::new(&shared_config);
    let key = format!("{}-{}", Uuid::new_v4().to_string(), name);
    client
        .put_object()
        .bucket(s3_bucket_name)
        .key(key.clone())
        .body(body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    Ok(key)
}

pub(crate) async fn s3_download(
    key: &String,
    s3_bucket_name: &String,
    aws_access_key_id: &String,
    aws_secret_access_key: &String,
    aws_endpoint_url: &String,
) -> Result<AggregatedBytes, String> {
    let shared_config = aws_config::from_env()
        .endpoint_url(aws_endpoint_url)
        .credentials_provider(aws_sdk_s3::config::Credentials::new(
            aws_access_key_id,
            aws_secret_access_key,
            None,
            None,
            "R2",
        ))
        .region("auto")
        .load()
        .await;
    let client = Client::new(&shared_config);
    let resp = client
        .get_object()
        .bucket(s3_bucket_name)
        .key(key.clone())
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let data = resp.body.collect().await.map_err(|e| e.to_string())?;

    Ok(data)
}
