#[cfg(test)]
pub mod test {
    use crate::config::AppConfig;
    use crate::controllers::users::{get_all_users, get_user, register_new_user, RegisterUser};
    use actix_http::Request;
    use actix_web::{dev::ServiceResponse, test, web, App};
    use db::models::user_model::User;
    use serde::Deserialize;

    use std::env;

    use diesel::{Connection, PgConnection};
    use diesel_async::{
        pooled_connection::{deadpool::Pool, AsyncDieselConnectionManager},
        AsyncPgConnection,
    };
    use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};

    const MIGRATIONS: EmbeddedMigrations = embed_migrations!("../db/migrations");
    #[derive(Clone)]
    pub struct DatabaseConnections {
        pub postgres: Pool<AsyncPgConnection>,
    }

    impl DatabaseConnections {
        pub fn postgres_pool(db_url: String) -> Pool<AsyncPgConnection> {
            let config = AsyncDieselConnectionManager::new(db_url);
            Pool::builder(config)
                .max_size(8)
                .build()
                .expect("Failed to create pool")
        }
    }

    pub struct TestDB {
        db_url: String,
        db_name: String,
        pub dbc: DatabaseConnections,
    }

    impl TestDB {
        pub fn init() -> Self {
            let db_url = env::var("DATABASE_URL_TEST").expect("DATABASE_URL_TEST must be set");
            let mut conn = PgConnection::establish(&db_url).expect("Can't connect to database");
            let db_name = "test_".to_string() + &uuid::Uuid::new_v4().to_string().replace('-', "_");
            let query = diesel::sql_query(format!("CREATE DATABASE {}", db_name).as_str());
            diesel::RunQueryDsl::execute(query, &mut conn)
                .expect(format!("Can't create test database {}", db_name).as_str());
            let table_url = format!("{}/{}", &db_url, db_name);
            let mut conn = PgConnection::establish(&table_url).expect("Can't connect to database");
            conn.run_pending_migrations(MIGRATIONS)
                .expect("Can't run migrations");

            let dbc = DatabaseConnections {
                postgres: DatabaseConnections::postgres_pool(table_url),
            };

            Self {
                db_url,
                db_name,
                dbc,
            }
        }
    }

    impl Drop for TestDB {
        fn drop(&mut self) {
            self.dbc.postgres.close();
            let mut conn =
                PgConnection::establish(&self.db_url).expect("Can't connect to database");
            let query = diesel::sql_query(&format!("DROP DATABASE {} WITH (FORCE)", &self.db_name));
            diesel::RunQueryDsl::execute(query, &mut conn)
                .expect(&format!("Can't drop test database {}", &self.db_name));
        }
    }

    #[test]
    async fn test_user_registration_fails_without_injected_user_id() {
        let db = TestDB::init();
        let mut app_config = AppConfig::default();
        app_config.database_url = db.db_url.clone();

        let payload = RegisterUser {
            name: Some("Jane Doe".to_string()),
        };

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(app_config.clone()))
                .app_data(web::Data::new(db.dbc.postgres.clone()))
                .service(register_new_user),
        )
        .await;

        let req = test::TestRequest::post()
            .uri("/register_new_user")
            .set_json(&payload)
            .to_request();

        let response: ServiceResponse = test::call_service(&app, req).await;
        assert_eq!(
            response.status().to_string(),
            "500 Internal Server Error".to_string()
        );
    }
    #[test]
    async fn test_user_registration_fails_if_user_already_exists() {
        let db = TestDB::init();
        let mut app_config = AppConfig::default();
        app_config.database_url = db.db_url.clone();

        let payload = RegisterUser {
            name: Some("Jane Doe".to_string()),
        };

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(app_config.clone()))
                .app_data(web::Data::new(db.dbc.postgres.clone()))
                .service(register_new_user),
        )
        .await;

        let mut req = test::TestRequest::post()
            .uri("/register_new_user")
            .set_json(&payload)
            .to_request();

        insert_user_email(&mut req);

        let response: ServiceResponse = test::call_service(&app, req).await;
        assert_eq!(response.status().to_string(), "200 OK".to_string());
        let body = test::read_body(response).await;
        let body_str = String::from_utf8(body.to_vec()).unwrap();
        assert_eq!(body_str, "Success: Jane Doe".to_string());

        // resend the req

        let mut req = test::TestRequest::post()
            .uri("/register_new_user")
            .set_json(&payload)
            .to_request();

        insert_user_email(&mut req);

        let response: ServiceResponse = test::call_service(&app, req).await;
        assert_eq!(response.status().to_string(), "409 Conflict".to_string());
        let body = test::read_body(response).await;
        let body_str = String::from_utf8(body.to_vec()).unwrap();
        assert_eq!(body_str, "User already exists".to_string());
    }
    #[test]
    async fn test_user_registration_success() {
        let db = TestDB::init();
        let mut app_config = AppConfig::default();
        app_config.database_url = db.db_url.clone();

        let payload = RegisterUser {
            name: Some("Jane Doe".to_string()),
        };

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(app_config.clone()))
                .app_data(web::Data::new(db.dbc.postgres.clone()))
                .service(register_new_user),
        )
        .await;

        let mut req = test::TestRequest::post()
            .uri("/register_new_user")
            .set_json(&payload)
            .to_request();

        insert_user_email(&mut req);

        let response: ServiceResponse = test::call_service(&app, req).await;
        assert_eq!(response.status().to_string(), "200 OK".to_string());
        let body = test::read_body(response).await;
        let body_str = String::from_utf8(body.to_vec()).unwrap();
        assert_eq!(body_str, "Success: Jane Doe".to_string());
    }
    #[test]
    async fn test_get_user() {
        let db = TestDB::init();
        let mut app_config = AppConfig::default();
        app_config.database_url = db.db_url.clone();
        let payload = RegisterUser {
            name: Some("Jane Doe".to_string()),
        };

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(app_config.clone()))
                .app_data(web::Data::new(db.dbc.postgres.clone()))
                .service(register_new_user)
                .service(get_user),
        )
        .await;

        let mut req = test::TestRequest::post()
            .uri("/register_new_user")
            .set_json(&payload)
            .to_request();

        insert_user_email(&mut req);

        let response: ServiceResponse = test::call_service(&app, req).await;
        assert_eq!(response.status().to_string(), "200 OK".to_string());

        let mut req_get = test::TestRequest::get().uri("/get_user").to_request();

        insert_user_email(&mut req_get);

        let response: ServiceResponse = test::call_service(&app, req_get).await;
        assert_eq!(response.status().to_string(), "200 OK".to_string());

        let body = test::read_body(response).await;
        let body_str = String::from_utf8(body.to_vec()).unwrap();
        let user: User = serde_json::from_str(&body_str).expect("Failed to parse JSON");
        assert_eq!(user.name, "Jane Doe");
        assert!(!user.id.is_empty());
    }
    #[test]
    async fn test_get_all_users() {
        let db = TestDB::init();
        let mut app_config = AppConfig::default();
        app_config.database_url = db.db_url.clone();
        let payload = RegisterUser {
            name: Some("Jane Doe".to_string()),
        };

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(app_config.clone()))
                .app_data(web::Data::new(db.dbc.postgres.clone()))
                .service(register_new_user)
                .service(get_all_users),
        )
        .await;

        let mut req = test::TestRequest::post()
            .uri("/register_new_user")
            .set_json(&payload)
            .to_request();

        insert_user_email(&mut req);

        let response: ServiceResponse = test::call_service(&app, req).await;
        assert_eq!(response.status().to_string(), "200 OK".to_string());

        let req_get = test::TestRequest::get().uri("/get_all_users").to_request();

        let response: ServiceResponse = test::call_service(&app, req_get).await;
        assert_eq!(response.status().to_string(), "200 OK".to_string());

        let body = test::read_body(response).await;
        let body_str = String::from_utf8(body.to_vec()).unwrap();

        #[derive(Deserialize)]
        struct Response {
            results: Vec<User>,
        }
        let user: Response = serde_json::from_str(&body_str).expect("Failed to parse JSON");
        assert_eq!(user.results[0].name, "Jane Doe");
        assert!(!user.results[0].id.is_empty());
    }

    fn insert_user_email(req: &mut Request) {
        let headers = req.headers_mut();

        headers.insert(
            "user_email"
                .parse::<actix_web::http::header::HeaderName>()
                .unwrap(),
            "test@availproject.org"
                .parse::<actix_web::http::header::HeaderValue>()
                .unwrap(),
        );
    }
}
