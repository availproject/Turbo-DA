pub mod controllers;
pub mod errors;
pub mod models;
pub mod schema;

use diesel::{ConnectionError, ConnectionResult};
use diesel_async::{
    pooled_connection::{AsyncDieselConnectionManager, ManagerConfig},
    AsyncPgConnection,
};
use futures::{future::BoxFuture, FutureExt};

pub fn pool_manager(url: &str) -> AsyncDieselConnectionManager<AsyncPgConnection> {
    let mut config = ManagerConfig::default();
    config.custom_setup = Box::new(setup);
    AsyncDieselConnectionManager::new_with_config(url, config)
}

fn setup(url: &str) -> BoxFuture<'_, ConnectionResult<AsyncPgConnection>> {
    establish(url).boxed()
}

pub async fn establish(url: &str) -> ConnectionResult<AsyncPgConnection> {
    let bad = |e: native_tls::Error| ConnectionError::BadConnection(e.to_string());
    let mut builder = native_tls::TlsConnector::builder();
    if let Ok(ca) = std::env::var("DATABASE_CA_CERT") {
        builder
            .add_root_certificate(native_tls::Certificate::from_pem(ca.as_bytes()).map_err(bad)?);
    }
    let tls = builder.build().map_err(bad)?;
    let (client, connection) =
        tokio_postgres::connect(url, postgres_native_tls::MakeTlsConnector::new(tls))
            .await
            .map_err(|e| ConnectionError::BadConnection(e.to_string()))?;
    AsyncPgConnection::try_from_client_and_connection(client, connection).await
}
