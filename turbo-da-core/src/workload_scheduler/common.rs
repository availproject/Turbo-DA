use actix_web::web::{Bytes, Data};
use uuid::Uuid;

use crate::store::CoinGeckoStore;

#[derive(Clone, Debug)]
pub struct Response {
    pub(crate) raw_payload: Bytes,
    pub(crate) token_id: i32,
    pub(crate) submission_id: Uuid,
    pub(crate) thread_id: i32,
    pub(crate) user_id: String,
    pub(crate) app_id: i32,
    pub(crate) store: Data<CoinGeckoStore>,
    pub(crate) token_name: String,
}
