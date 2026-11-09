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

        let sumsub_timestamp = chrono::Utc::now().naive_utc();
        let payload = RegisterUser {
            sumsub_timestamp: Some(sumsub_timestamp),
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

        let sumsub_timestamp = chrono::Utc::now().naive_utc();
        let payload = RegisterUser {
            name: Some("Jane Doe".to_string()),
            sumsub_timestamp: Some(sumsub_timestamp),
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

        let sumsub_timestamp = chrono::Utc::now().naive_utc();
        let payload = RegisterUser {
            name: Some("Jane Doe".to_string()),
            sumsub_timestamp: Some(sumsub_timestamp),
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
    async fn test_inclusion_details_are_ignored_once_order_is_credited() {
        use bigdecimal::BigDecimal;
        use db::{
            controllers::{fund, users as users_ctrl},
            models::user_model::UserCreate,
            schema::credit_requests::dsl as credit_requests,
        };
        use diesel::{ExpressionMethods, QueryDsl};
        use diesel_async::RunQueryDsl;

        let db = TestDB::init();
        let mut conn = db.dbc.postgres.get().await.unwrap();
        let user = "user@example.com".to_string();
        users_ctrl::register_new_user(
            &mut conn,
            UserCreate {
                id: user.clone(),
                name: "User".to_string(),
                sumsub_timestamp: None,
            },
        )
        .await
        .unwrap();
        let order = fund::create_credit_request(user.clone(), 1, &mut conn)
            .await
            .unwrap();
        diesel::update(credit_requests::credit_requests.filter(credit_requests::id.eq(order.id)))
            .set((
                credit_requests::amount_credit.eq(Some(BigDecimal::from(1000))),
                credit_requests::request_status.eq("PROCESSED"),
                credit_requests::tx_hash.eq(Some("0xverified")),
            ))
            .execute(&mut conn)
            .await
            .unwrap();

        let row = fund::update_inclusion_details(user, order.id, "0xother".to_string(), &mut conn)
            .await
            .expect("reporting a hash on a credited order should not fail");

        assert_eq!(row.tx_hash, Some("0xverified".to_string()));
        assert_eq!(row.request_status, "PROCESSED");
    }

    /// Authenticates a request as `user` the way the Clerk middleware does.
    fn authenticate_as(req: Request, user: &str) -> Request {
        use actix_web::HttpMessage;
        use clerk_rs::validators::authorizer::ClerkJwt;

        req.extensions_mut().insert(ClerkJwt {
            azp: None,
            exp: 0,
            iat: 0,
            iss: String::new(),
            nbf: 0,
            sid: None,
            sub: String::new(),
            act: None,
            org: None,
            other: serde_json::Map::from_iter([(
                "user_email".to_string(),
                serde_json::json!(user),
            )]),
        });
        req
    }

    fn inclusion_request(user: &str, order_id: i32, tx_hash: &str) -> Request {
        let req = test::TestRequest::post()
            .uri("/add_inclusion_details")
            .set_json(serde_json::json!({ "order_id": order_id, "tx_hash": tx_hash }))
            .to_request();
        authenticate_as(req, user)
    }

    #[test]
    async fn test_add_inclusion_details_endpoint_cannot_squat_or_touch_other_orders() {
        use crate::controllers::fund::add_inclusion_details;
        use db::{
            controllers::{fund, users as users_ctrl},
            models::user_model::UserCreate,
        };

        let db = TestDB::init();
        let mut conn = db.dbc.postgres.get().await.unwrap();
        for user in ["attacker@example.com", "victim@example.com"] {
            users_ctrl::register_new_user(
                &mut conn,
                UserCreate {
                    id: user.to_string(),
                    name: user.to_string(),
                    sumsub_timestamp: None,
                },
            )
            .await
            .unwrap();
        }
        let attacker_order =
            fund::create_credit_request("attacker@example.com".to_string(), 1, &mut conn)
                .await
                .unwrap();
        let victim_order =
            fund::create_credit_request("victim@example.com".to_string(), 1, &mut conn)
                .await
                .unwrap();
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(db.dbc.postgres.clone()))
                .service(add_inclusion_details),
        )
        .await;

        let squat = inclusion_request("attacker@example.com", attacker_order.id, "0xvictim");
        let squat = test::call_service(&app, squat).await;
        let own = inclusion_request("victim@example.com", victim_order.id, "0xvictim");
        let own = test::call_service(&app, own).await;
        let foreign = inclusion_request("attacker@example.com", victim_order.id, "0xforged");
        let foreign = test::call_service(&app, foreign).await;

        assert_eq!(squat.status().as_u16(), 200);
        assert_eq!(
            own.status().as_u16(),
            200,
            "squatted hash must not block the owner"
        );
        assert_ne!(
            foreign.status().as_u16(),
            200,
            "order of another user must be rejected"
        );
        let status =
            fund::get_fund_status("victim@example.com".to_string(), victim_order.id, &mut conn)
                .await
                .unwrap();
        assert_eq!(status[0].tx_hash, Some("0xvictim".to_string()));
    }

    /// Registers a user holding `main` credits and one app holding `allocated` credits.
    async fn seed_user_with_app(db: &TestDB, user: &str, main: i32, allocated: i32) -> uuid::Uuid {
        use bigdecimal::BigDecimal;
        use db::{
            controllers::{apps as apps_ctrl, users as users_ctrl},
            models::{apps::AppsCreate, user_model::UserCreate},
            schema::users::dsl as users_dsl,
        };
        use diesel::{ExpressionMethods, QueryDsl};
        use diesel_async::RunQueryDsl;

        let mut conn = db.dbc.postgres.get().await.unwrap();
        users_ctrl::register_new_user(
            &mut conn,
            UserCreate {
                id: user.to_string(),
                name: user.to_string(),
                sumsub_timestamp: None,
            },
        )
        .await
        .unwrap();
        diesel::update(users_dsl::users.filter(users_dsl::id.eq(user)))
            .set(users_dsl::credit_balance.eq(BigDecimal::from(main)))
            .execute(&mut conn)
            .await
            .unwrap();
        let app = uuid::Uuid::new_v4();
        apps_ctrl::create_account(
            &mut conn,
            &AppsCreate {
                id: app,
                user_id: user.to_string(),
                app_id: 2,
                credit_balance: BigDecimal::from(allocated),
                credit_used: BigDecimal::from(0),
                credit_selection: Some(0),
                app_name: Some("app".to_string()),
                app_description: None,
                app_logo: None,
            },
        )
        .await
        .unwrap();
        app
    }

    async fn credit_balances(db: &TestDB, user: &str, app: &uuid::Uuid) -> (i64, i64) {
        use bigdecimal::ToPrimitive;
        use db::controllers::{apps as apps_ctrl, users as users_ctrl};

        let mut conn = db.dbc.postgres.get().await.unwrap();
        let user_row = users_ctrl::get_user(&mut conn, &user.to_string())
            .await
            .unwrap();
        let app_row = apps_ctrl::get_app_by_id(&mut conn, &user.to_string(), app)
            .await
            .unwrap();
        (
            user_row.credit_balance.to_i64().unwrap(),
            app_row.credit_balance.to_i64().unwrap(),
        )
    }

    /// Runs `count` copies of a credit move at once, each on its own pooled connection.
    async fn race_credit_moves(
        db: &TestDB,
        user: &str,
        app: uuid::Uuid,
        count: usize,
        reclaim: bool,
    ) -> usize {
        use bigdecimal::BigDecimal;
        use db::controllers::misc;

        let ready = std::sync::Arc::new(tokio::sync::Barrier::new(count));
        let moves = (0..count).map(|_| {
            let pool = db.dbc.postgres.clone();
            let user = user.to_string();
            let ready = ready.clone();
            tokio::spawn(async move {
                let mut conn = pool.get().await.unwrap();
                let amount = BigDecimal::from(10);
                // Start together, otherwise the first task finishes before the rest connect.
                ready.wait().await;
                if reclaim {
                    misc::reclaim_credits(&mut conn, &app, &user, &amount).await
                } else {
                    misc::allocate_credit_balance(&mut conn, &app, &user, &amount).await
                }
            })
        });
        futures::future::join_all(moves)
            .await
            .into_iter()
            .filter(|result| matches!(result, Ok(Ok(()))))
            .count()
    }

    /// No RPC endpoints are configured, so a request that passes the size check would panic.
    #[test]
    async fn test_estimate_against_size_rejects_oversized_request_before_connecting() {
        use crate::controllers::fund::estimate_credits_against_size;

        let config = AppConfig {
            payload_size: 100,
            ..AppConfig::default()
        };
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(config))
                .service(estimate_credits_against_size),
        )
        .await;

        for size in [101, 1u64 << 62, u64::MAX] {
            let request = test::TestRequest::get()
                .uri(&format!("/estimate_credits_against_size?size={size}"))
                .to_request();
            let response = test::call_service(&app, request).await;
            assert_eq!(
                response.status(),
                actix_web::http::StatusCode::BAD_REQUEST,
                "size {size}"
            );
        }
    }

    #[test]
    async fn test_concurrent_reclaims_cannot_duplicate_credits() {
        let db = TestDB::init();
        let user = "reclaim@example.com";
        let app = seed_user_with_app(&db, user, 0, 10).await;

        let succeeded = race_credit_moves(&db, user, app, 8, true).await;

        assert_eq!(succeeded, 1);
        assert_eq!(credit_balances(&db, user, &app).await, (10, 0));
    }

    #[test]
    async fn test_concurrent_allocations_cannot_overdraw_main_balance() {
        let db = TestDB::init();
        let user = "allocate@example.com";
        let app = seed_user_with_app(&db, user, 10, 0).await;

        let succeeded = race_credit_moves(&db, user, app, 8, false).await;

        assert_eq!(succeeded, 1);
        assert_eq!(credit_balances(&db, user, &app).await, (0, 10));
    }

    #[test]
    async fn test_allocating_to_another_users_app_leaves_balances_unchanged() {
        use bigdecimal::BigDecimal;
        use db::controllers::misc;

        let db = TestDB::init();
        let own_app = seed_user_with_app(&db, "owner@example.com", 10, 0).await;
        let foreign_app = seed_user_with_app(&db, "other@example.com", 0, 0).await;
        let mut conn = db.dbc.postgres.get().await.unwrap();

        let result = misc::allocate_credit_balance(
            &mut conn,
            &foreign_app,
            &"owner@example.com".to_string(),
            &BigDecimal::from(10),
        )
        .await;

        assert!(result.is_err());
        assert_eq!(
            credit_balances(&db, "owner@example.com", &own_app).await,
            (10, 0)
        );
    }

    #[test]
    async fn test_app_with_negative_balance_cannot_be_deleted() {
        use db::controllers::apps as apps_ctrl;

        let db = TestDB::init();
        let user = "debt@example.com";
        let app = seed_user_with_app(&db, user, 0, -10).await;
        let mut conn = db.dbc.postgres.get().await.unwrap();

        let result = apps_ctrl::delete_account_by_id(&mut conn, user.to_string(), app).await;

        assert!(result.is_err());
        assert_eq!(credit_balances(&db, user, &app).await, (0, -10));
    }

    /// Starts a stub Enigma server, returning its URL and a count of register calls.
    fn spawn_enigma_stub() -> (String, std::sync::Arc<std::sync::atomic::AtomicUsize>) {
        use std::sync::atomic::{AtomicUsize, Ordering};

        let registrations = std::sync::Arc::new(AtomicUsize::new(0));
        let counter = registrations.clone();
        let server = actix_web::HttpServer::new(move || {
            let counter = counter.clone();
            App::new().route(
                "/v1/register",
                web::post().to(move || {
                    let counter = counter.clone();
                    async move {
                        counter.fetch_add(1, Ordering::SeqCst);
                        actix_web::HttpResponse::Ok().json(serde_json::json!({
                            "turbo_da_app_id": "app",
                            "participants_added": 1,
                        }))
                    }
                }),
            )
        })
        .workers(1)
        .disable_signals()
        .bind(("127.0.0.1", 0))
        .unwrap();
        let port = server.addrs()[0].port();
        actix_web::rt::spawn(server.run());
        (format!("http://127.0.0.1:{port}"), registrations)
    }

    fn toggle_encryption_request(user: &str, app: uuid::Uuid, signer: &str) -> Request {
        let req = test::TestRequest::put()
            .uri("/toggle_encryption")
            .set_json(serde_json::json!({
                "app_id": app,
                "participants": [signer],
                "threshold": 1,
            }))
            .to_request();
        authenticate_as(req, user)
    }

    #[test]
    async fn test_toggle_encryption_on_another_users_app_changes_nothing() {
        use crate::controllers::users::toggle_encryption;
        use db::controllers::{
            apps as apps_ctrl, mpc_participants as mpc_ctrl, public_keys as keys_ctrl,
        };
        use enigma::EnigmaEncryptionService;
        use std::sync::atomic::Ordering;

        let db = TestDB::init();
        let (attacker, victim) = ("attacker@example.com", "victim@example.com");
        seed_user_with_app(&db, attacker, 0, 0).await;
        let victim_app = seed_user_with_app(&db, victim, 0, 0).await;
        let mut conn = db.dbc.postgres.get().await.unwrap();
        keys_ctrl::add_public_key(&mut conn, attacker, "0xattacker")
            .await
            .unwrap();
        let (enigma_url, registrations) = spawn_enigma_stub();
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(db.dbc.postgres.clone()))
                .app_data(web::Data::new(EnigmaEncryptionService::new(enigma_url)))
                .service(toggle_encryption),
        )
        .await;

        let response = test::call_service(
            &app,
            toggle_encryption_request(attacker, victim_app, "0xattacker"),
        )
        .await;

        assert_eq!(response.status().as_u16(), 404);
        assert_eq!(registrations.load(Ordering::SeqCst), 0);
        let signers = mpc_ctrl::get_participants_by_app_id(&mut conn, &victim_app)
            .await
            .unwrap();
        assert!(signers.is_empty());
        let row = apps_ctrl::get_app_by_id(&mut conn, &victim.to_string(), &victim_app)
            .await
            .unwrap();
        assert!(!row.encryption);
    }

    #[test]
    async fn test_toggle_encryption_by_owner_registers_signers_and_enables_encryption() {
        use crate::controllers::users::toggle_encryption;
        use db::controllers::{
            apps as apps_ctrl, mpc_participants as mpc_ctrl, public_keys as keys_ctrl,
        };
        use enigma::EnigmaEncryptionService;
        use std::sync::atomic::Ordering;

        let db = TestDB::init();
        let owner = "owner@example.com";
        let owned_app = seed_user_with_app(&db, owner, 0, 0).await;
        let mut conn = db.dbc.postgres.get().await.unwrap();
        keys_ctrl::add_public_key(&mut conn, owner, "0xowner")
            .await
            .unwrap();
        let (enigma_url, registrations) = spawn_enigma_stub();
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(db.dbc.postgres.clone()))
                .app_data(web::Data::new(EnigmaEncryptionService::new(enigma_url)))
                .service(toggle_encryption),
        )
        .await;

        let response =
            test::call_service(&app, toggle_encryption_request(owner, owned_app, "0xowner")).await;

        assert_eq!(response.status().as_u16(), 200);
        assert_eq!(registrations.load(Ordering::SeqCst), 1);
        let signers = mpc_ctrl::get_participants_by_app_id(&mut conn, &owned_app)
            .await
            .unwrap();
        assert_eq!(signers.len(), 1);
        let row = apps_ctrl::get_app_by_id(&mut conn, &owner.to_string(), &owned_app)
            .await
            .unwrap();
        assert!(row.encryption);
    }

    #[test]
    async fn test_db_toggle_encryption_rejects_app_not_owned_by_user() {
        use db::controllers::apps as apps_ctrl;

        let db = TestDB::init();
        seed_user_with_app(&db, "attacker@example.com", 0, 0).await;
        let victim_app = seed_user_with_app(&db, "victim@example.com", 0, 0).await;
        let mut conn = db.dbc.postgres.get().await.unwrap();

        let result = apps_ctrl::toggle_encryption(
            &mut conn,
            &"attacker@example.com".to_string(),
            &victim_app,
        )
        .await;

        assert!(result.is_err());
    }

    #[test]
    async fn test_get_user() {
        let db = TestDB::init();
        let mut app_config = AppConfig::default();
        app_config.database_url = db.db_url.clone();
        let sumsub_timestamp = chrono::Utc::now().naive_utc();
        let payload = RegisterUser {
            name: Some("Jane Doe".to_string()),
            sumsub_timestamp: Some(sumsub_timestamp),
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
        let sumsub_timestamp = chrono::Utc::now().naive_utc();
        let payload = RegisterUser {
            name: Some("Jane Doe".to_string()),
            sumsub_timestamp: Some(sumsub_timestamp),
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
