use actix_web::web::Bytes;
use bigdecimal::BigDecimal;
use uuid::Uuid;

#[derive(Clone, Debug)]
pub struct Response {
    pub(crate) raw_payload: Bytes,
    pub(crate) submission_id: Uuid,
    pub(crate) thread_id: i32,
    pub(crate) user_id: String,
    pub(crate) app_id: i32,
    pub(crate) credit_balance: BigDecimal,
}
