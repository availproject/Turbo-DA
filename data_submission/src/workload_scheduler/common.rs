use actix_web::web::Bytes;
use uuid::Uuid;

#[derive(Clone, Debug)]
pub struct Response {
    pub raw_payload: Bytes,
    pub submission_id: Uuid,
    pub thread_id: i32,
    pub app_id: Uuid,
    pub avail_app_id: i32,
}
