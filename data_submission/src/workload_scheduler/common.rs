use actix_web::web::Bytes;
use uuid::Uuid;

#[derive(Clone, Debug)]
pub struct Response {
    pub(crate) raw_payload: Bytes,
    pub(crate) submission_id: Uuid,
    pub(crate) thread_id: i32,
    pub(crate) app_id: Uuid,
    pub(crate) avail_app_id: i32,
    pub(crate) encrypted: bool,
}
