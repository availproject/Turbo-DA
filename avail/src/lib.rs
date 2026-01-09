pub mod retrieve_data;
pub mod submit_data;

pub mod utils {
    use avail_rust::Client;
    use avail_rust::avail::data_availability::storage::NextAppId;
    use avail_rust::prelude::*;

    pub async fn check_app_id_validity(rpc_url: &str, app_id: i32) -> Result<bool, String> {
        let client = Client::new(rpc_url).await.map_err(|e| e.to_string())?;
        let rpc_client = &client.rpc_client;
        let next_app_id = NextAppId::fetch(rpc_client, None)
            .await
            .map_err(|e| e.to_string())?
            .expect("Should be there");
        Ok((app_id as u32) < next_app_id.0)
    }
}
