use crate::{
    config::AppConfig,
    s3::{self, s3_download},
};
use actix_multipart::form::{tempfile::TempFile, MultipartForm};
use actix_web::{get, post, web, HttpResponse, Responder};
use aws_sdk_s3::primitives::ByteStream;
use s3::s3_upload;
use serde::Deserialize;
use serde_json::json;
use std::io::Read;

/// Form structure for file uploads
#[derive(Debug, MultipartForm)]
struct UploadForm {
    /// The file to be uploaded, limited to 10MB
    #[multipart(limit = "10MB")]
    file: TempFile,
}

/// Handles file uploads to S3-compatible storage
///
/// # Endpoint
/// `POST /v1/user/upload_file`
///
/// # Request
/// Multipart form with:
/// - file: The file to upload (max 10MB)
/// - json: Metadata containing the file name
///
/// # Response
/// - 200 OK: File uploaded successfully with the generated file key
/// - 500 Internal Server Error: Failed to read or upload the file
///
/// # Example
/// ```
/// curl -v --request POST --url http://localhost:8000/upload_file \
///   -F file=@./download.jpeg
/// ```
#[post("/upload_file")]
pub async fn upload_file(
    payload: MultipartForm<UploadForm>,
    config: web::Data<AppConfig>,
) -> impl Responder {
    let temp_path = &payload.file;
    let file_name = match temp_path.file_name.clone() {
        Some(name) => name,
        None => {
            return HttpResponse::InternalServerError().json(json!({
                "state": "ERROR",
                "message": "Failed to get file name",
                "error": "File name not found"
            }));
        }
    };
    let mut buffer = Vec::new();
    if let Err(e) = temp_path.file.as_file().read_to_end(&mut buffer) {
        return HttpResponse::InternalServerError().json(json!({
            "state": "ERROR",
            "message": "Failed to read file",
            "error": e.to_string()
        }));
    }

    let file = s3_upload(
        ByteStream::from(buffer),
        &file_name,
        &config.s3_bucket_name,
        &config.aws_access_key_id,
        &config.aws_secret_access_key,
        &config.aws_endpoint_url,
    )
    .await;

    match file {
        Ok(file) => HttpResponse::Ok().json(json!({
            "state": "SUCCESS",
            "message": "File uploaded successfully",
            "file": file
        })),
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "state": "ERROR",
            "message": "Failed to upload file",
            "error": e
        })),
    }
}

/// Query parameters for file download
#[derive(Debug, Deserialize)]
struct DownloadForm {
    /// The unique key of the file to download
    key: String,
}

/// Handles file downloads from S3-compatible storage
///
/// # Endpoint
/// `GET /v1/user/download_file`
///
/// # Query Parameters
/// - key: The unique identifier of the file to download
///
/// # Response
/// - 200 OK: File downloaded successfully with file content as byte array
/// - 500 Internal Server Error: Failed to download the file
#[get("/download_file")]
pub async fn download_file(
    payload: web::Query<DownloadForm>,
    config: web::Data<AppConfig>,
) -> impl Responder {
    let file = s3_download(
        &payload.key,
        &config.s3_bucket_name,
        &config.aws_access_key_id,
        &config.aws_secret_access_key,
        &config.aws_endpoint_url,
    )
    .await;

    match file {
        Ok(file) => HttpResponse::Ok().json(json!({
            "state": "SUCCESS",
            "message": "File downloaded successfully",
            "file": file.to_vec()
        })),
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "state": "ERROR",
            "message": "Failed to download file",
            "error": e
        })),
    }
}
