# Turbo Data Availability Core Service

This service enables users to submit data to the Avail Data Availability (DA) chain while paying fees in tokens other than AVAIL. It acts as a relay service that handles token conversions, fee payments, and data submissions on behalf of users.

## Overview

The core service provides:

- Data submission to Avail DA chain
- Multi-token fee payment support
- User balance management
- Transaction monitoring and resubmission
- REST API interface

## Key Features

- **Multi-Token Support**: Pay fees in your preferred token instead of AVAIL
- **Automated Fee Handling**: Service manages token conversions and AVAIL fee payments
- **Balance Management**: Maintain token balances via deposits on Ethereum
- **Secure Authentication**: Bearer token authentication for API access
- **Fee Estimation**: Query current fee rates before submitting data
- **Transaction Monitoring**: Automatic monitoring and resubmission of failed transactions

## Getting Started

### Prerequisites

- Rust toolchain
- PostgreSQL database
- Node.js and pnpm (for dashboard)

### Installation

diesel migration run`

### Generate Documentation

To generate and view documentation
`cargo doc --open`

### TO LOG

`RUST_LOG=trace cargo run`

### Run Dashboard

```
pnpm i
pnpm run dev
```

### Run API server

`cargo run --release`

# API Documentation

This API allows users to interact with the Turbo Data Availability Service. All requests require authentication via a bearer token unless specified otherwise.

```bash
Authorization: Bearer <YOUR_TOKEN>
```

### User Management Endpoints

#### 1. POST /v1/user/register_new_user

Register a new user.

- **Method**: `POST`
- **Headers**:
  - `Authorization: Bearer <token>`
- **Body Parameters**:
  - `name` (optional): Name of the user.

**Example Request:**

```bash
curl -X POST "https://api.example.com/v1/user/register_new_user" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
           "name": "John Doe"
         }'
```

**Example Response:**

```json
{
  "state": "SUCCESS",
  "message": "Success: John Doe"
}
```

#### 2. GET /v1/user/get_user

Retrieve details for the authenticated user.

- **Method**: `GET`
- **Headers**:
  - `Authorization: Bearer <token>`

**Example Request:**

```bash
curl -X GET "https://api.example.com/v1/user/get_user" \
     -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response:**

```json
{
  "state": "SUCCESS",
  "message": "User retrieved successfully",
  "data": {
    "id": "user@example.com",
    "name": "John Doe",
    "credit_balance": "50.00",
    "credit_used": "10.25",
    "allocated_credit_balance": "100.00"
  }
}
```

#### 3. GET /v1/user/get_all_users

Retrieve details about all users (admin endpoint).

- **Method**: `GET`
- **Headers**:
  - `Authorization: Bearer <token>`
- **URL Parameters**:
  - `limit` (optional): The limit of users to query.

**Example Request:**

```bash
curl -X GET "https://api.example.com/v1/user/get_all_users?limit=10" \
     -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response:**

```json
{
  "state": "SUCCESS",
  "message": "Users retrieved successfully",
  "data": [
    {
      "id": "user1@example.com",
      "name": "User One",
      "credit_balance": "100.00",
      "credit_used": "25.50",
      "allocated_credit_balance": "200.00"
    },
    {
      "id": "user2@example.com",
      "name": "User Two",
      "credit_balance": "50.00",
      "credit_used": "10.25",
      "allocated_credit_balance": "100.00"
    }
  ]
}
```

#### 4. POST /v1/user/generate_app_account

Generate an app account for a user.

- **Method**: `POST`
- **Headers**:
  - `Authorization: Bearer <token>`
- **Body Parameters**:
  - `fallback_enabled` (required): Boolean to enable/disable fallback.

**Example Request:**

```bash
curl -X POST "https://api.example.com/v1/user/generate_app_account" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
           "fallback_enabled": true
         }'
```

**Example Response:**

```json
{
  "state": "SUCCESS",
  "message": "Account created successfully",
  "data": {
    "id": "uuid-string",
    "user_id": "user@example.com",
    "app_id": 0,
    "credit_balance": "0",
    "credit_used": "0",
    "fallback_enabled": true
  }
}
```

#### 5. GET /v1/user/get_apps

Retrieve all apps for the authenticated user.

- **Method**: `GET`
- **Headers**:
  - `Authorization: Bearer <token>`

**Example Request:**

```bash
curl -X GET "https://api.example.com/v1/user/get_apps" \
     -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response:**

```json
{
  "state": "SUCCESS",
  "message": "Apps retrieved successfully",
  "data": [
    {
      "id": "uuid-string",
      "user_id": "user@example.com",
      "app_id": 1001,
      "credit_balance": "25.00",
      "credit_used": "5.50",
      "fallback_enabled": true
    }
  ]
}
```

#### 6. DELETE /v1/user/delete_account

Delete an account for the authenticated user.

- **Method**: `DELETE`
- **Headers**:
  - `Authorization: Bearer <token>`
- **Body Parameters**:
  - `app_id` (required): UUID of the app to delete.

**Example Request:**

```bash
curl -X DELETE "https://api.example.com/v1/user/delete_account" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
           "app_id": "uuid-string"
         }'
```

**Example Response:**

```json
{
  "state": "SUCCESS",
  "message": "Account successfully deleted"
}
```

#### 7. POST /v1/user/allocate_credit_balance

Allocate credit balance to a user account.

- **Method**: `POST`
- **Headers**:
  - `Authorization: Bearer <token>`
- **Body Parameters**:
  - `amount` (required): Amount to allocate.
  - `app_id` (required): UUID of the app.

**Example Request:**

```bash
curl -X POST "https://api.example.com/v1/user/allocate_credit_balance" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
           "amount": "100.00",
           "app_id": "uuid-string"
         }'
```

**Example Response:**

```json
{
  "state": "SUCCESS",
  "message": "Credit balance allocated successfully"
}
```

#### 8. POST /v1/user/reclaim_credits

Reclaim credits from a user account.

- **Method**: `POST`
- **Headers**:
  - `Authorization: Bearer <token>`
- **Body Parameters**:
  - `amount` (required): Amount to reclaim.
  - `app_id` (required): UUID of the app.

**Example Request:**

```bash
curl -X POST "https://api.example.com/v1/user/reclaim_credits" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
           "amount": "50.00",
           "app_id": "uuid-string"
         }'
```

**Example Response:**

```json
{
  "state": "SUCCESS",
  "message": "Credits reclaimed successfully"
}
```

#### 9. POST /v1/user/generate_api_key

Generate a new API key for the authenticated user.

- **Method**: `POST`
- **Headers**:
  - `Authorization: Bearer <token>`
- **Body Parameters**:
  - `app_id` (required): UUID of the app.

**Example Request:**

```bash
curl -X POST "https://api.example.com/v1/user/generate_api_key" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
           "app_id": "uuid-string"
         }'
```

**Example Response:**

```json
{
  "state": "SUCCESS",
  "message": "API key created successfully",
  "data": {
    "api_key": "abcdef1234567890"
  }
}
```

#### 10. GET /v1/user/get_api_keys

Retrieve all API keys for the authenticated user.

- **Method**: `GET`
- **Headers**:
  - `Authorization: Bearer <token>`

**Example Request:**

```bash
curl -X GET "https://api.example.com/v1/user/get_api_keys" \
     -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response:**

```json
{
  "state": "SUCCESS",
  "message": "API key retrieved successfully",
  "data": [
    {
      "api_key": "***********abc12",
      "identifier": "abc12",
      "created_at": "2023-01-01T12:00:00Z",
      "user_id": "user-id-string",
      "app_id": "uuid-string"
    }
  ]
}
```

#### 11. DELETE /v1/user/delete_api_key

Delete an API key for the authenticated user.

- **Method**: `DELETE`
- **Headers**:
  - `Authorization: Bearer <token>`
- **Body Parameters**:
  - `identifier` (required): Identifier of the API key.

**Example Request:**

```bash
curl -X DELETE "https://api.example.com/v1/user/delete_api_key" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
           "identifier": "abc12"
         }'
```

**Example Response:**

```json
{
  "state": "SUCCESS",
  "message": "API key deleted successfully",
  "data": {
    "api_key": "abc12"
  }
}
```

#### 12. PUT /v1/user/update_app_id

Update the app_id for a user account.

- **Method**: `PUT`
- **Headers**:
  - `Authorization: Bearer <token>`
- **Body Parameters**:
  - `avail_app_id` (required): New app ID for Avail.
  - `app_id` (required): UUID of the app to update.

**Example Request:**

```bash
curl -X PUT "https://api.example.com/v1/user/update_app_id" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
           "avail_app_id": 1002,
           "app_id": "uuid-string"
         }'
```

**Example Response:**

```json
{
  "state": "SUCCESS",
  "message": "App ID updated successfully",
  "error": null
}
```

#### 13. GET /v1/user/get_wallet_usage

Retrieve wallet usage statistics for a given time period.

- **Method**: `GET`
- **Headers**:
  - `Authorization: Bearer <token>`
- **URL Parameters**:
  - `app_id` (required): UUID of the application
  - `start_date` (required): Start date as UTC timestamp in seconds
  - `end_date` (required): End date as UTC timestamp in seconds

**Example Request:**

```bash
curl -X GET "https://api.example.com/v1/user/get_wallet_usage?app_id=uuid-string&start_date=1709251200&end_date=1711929600" \
     -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response:**

```json
{
  "state": "SUCCESS",
  "message": "Wallet usage retrieved successfully",
  "data": {
    "list": [...],
    "wallet_usage": [
      [100, 200],
      [150, 250],
      [200, 300],
      [250, 350],
      [300, 400],
      [350, 450],
      [400, 500],
      [450, 550],
      [500, 600],
      [550, 650],
      [600, 700],
      [650, 750]
    ]
  }
}
```

### Customer Expenditure Endpoints

#### 14. GET /v1/user/get_all_expenditure

Retrieve all expenditure records for an authenticated customer.

- **Method**: `GET`
- **Headers**:
  - `Authorization: Bearer <token>`
- **URL Parameters**:
  - `limit` (optional): Limit the number of records returned.

**Example Request:**

```bash
curl -X GET "https://api.example.com/v1/user/get_all_expenditure?limit=10" \
     -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response:**

```json
{
  "state": "SUCCESS",
  "message": "Expenditure retrieved successfully",
  "data": {
    "results": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "user_id": "user123",
        "extrinsic_index": 42,
        "amount_data": "1024",
        "fees": "0.05",
        "to_address": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
        "block_number": 12345,
        "block_hash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        "data_hash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        "tx_hash": "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba",
        "created_at": "2023-01-01T12:00:00Z",
        "error": null,
        "converted_fees": "0.05",
        "app_id": "123e4567-e89b-12d3-a456-426614174001"
      }
    ]
  }
}
```

#### 15. GET /v1/user/get_expenditure_by_time_range

Retrieve expenditure records for an authenticated customer within a specified time range.

- **Method**: `GET`
- **Headers**:
  - `Authorization: Bearer <token>`
- **URL Parameters**:
  - `start_date` (required): The start date and time (format: ISO 8601).
  - `end_date` (required): The end date and time (format: ISO 8601).

**Example Request:**

```bash
curl -X GET "https://api.example.com/v1/user/get_expenditure_by_time_range?start_date=2023-01-01T00:00:00&end_date=2023-01-31T23:59:59" \
     -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response:**

```json
{
  "state": "SUCCESS",
  "message": "Expenditure retrieved successfully",
  "data": {
    "results": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "user_id": "user123",
        "extrinsic_index": 42,
        "amount_data": "1024",
        "fees": "0.05",
        "to_address": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
        "block_number": 12345,
        "block_hash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        "data_hash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        "tx_hash": "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba",
        "created_at": "2023-01-15T12:00:00Z",
        "error": null,
        "converted_fees": "0.05",
        "app_id": "123e4567-e89b-12d3-a456-426614174001"
      }
    ]
  }
}
```

## Error Handling

- **401 Unauthorized**: Invalid or missing token.
- **404 Not Found**: The requested resource does not exist.
- **400 Bad Request**: Missing required parameters or invalid request.
- **500 Internal Server Error**: Something unexpected happened on the server side.

### File Management Endpoints

#### 16. POST /v1/user/upload_file

Upload a file to S3-compatible storage.

- **Method**: `POST`
- **Headers**:
  - `Authorization: Bearer <token>`
- **Body Parameters**:
  - Multipart form with a file field (max 10MB)

**Example Request:**

```bash
curl -X POST "https://api.example.com/v1/user/upload_file" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -F file=@./example.jpg
```

**Example Response:**

```json
{
  "state": "SUCCESS",
  "message": "File uploaded successfully",
  "file": "64a5b3c2-1234-5678-90ab-cdef01234567"
}
```

#### 17. GET /v1/user/download_file

Download a file from S3-compatible storage.

- **Method**: `GET`
- **Headers**:
  - `Authorization: Bearer <token>`
- **URL Parameters**:
  - `key` (required): The unique identifier of the file to download.

**Example Request:**

```bash
curl -X GET "https://api.example.com/v1/user/download_file?key=64a5b3c2-1234-5678-90ab-cdef01234567" \
     -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response:**

```json
{
  "state": "SUCCESS",
  "message": "File downloaded successfully",
  "file": [...]  // byte array of file content
}
```

### Fund Management Endpoints

#### 18. POST /v1/user/register_credit_request

Register a new credit request for a specific blockchain.

- **Method**: `POST`
- **Headers**:
  - `Authorization: Bearer <token>` - JWT token for authentication
- **Request Body**:
  - `chain` - The chain ID for which the credit request is being registered
  - `amount_credit` - The amount of credit being requested
  - `request_type` - The type of credit request (e.g., "DEPOSIT", "WITHDRAWAL")

**Example Request:**

```bash
curl -X POST "https://api.example.com/v1/user/register_credit_request" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
           "chain": 1,
           "amount_credit": "100.00",
           "request_type": "DEPOSIT"
         }'
```

**Example Response:**

```json
{
  "state": "SUCCESS",
  "message": "Credit request registered successfully",
  "data": {
    "id": 123,
    "user_id": "user@example.com",
    "amount_credit": "100.00",
    "chain_id": 1,
    "request_status": "PENDING",
    "tx_hash": null,
    "request_type": "DEPOSIT",
    "created_at": "2024-03-20T10:00:00Z"
  }
}
```

**Notes:**

- The combination of `chain_id` and `tx_hash` must be unique to prevent duplicate credit requests
- The request status will be updated once the transaction is confirmed on the blockchain
- Use the `add_inclusion_details` endpoint to update the transaction hash once the transaction is confirmed

#### 19. GET /v1/user/request_fund_status

Retrieve the status and details of a user's fund request.

- **Method**: `GET`
- **Headers**:
  - `Authorization: Bearer <token>`

**Example Request:**

```bash
curl -X GET "https://api.example.com/v1/user/request_fund_status" \
     -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response:**

```json
{
  "state": "SUCCESS",
  "message": "Fund request status retrieved successfully",
  "data": [
    {
      "amount_credit": "100000000000000000000",
      "chain_id": 1,
      "request_status": "pending",
      "request_type": "credit",
      "tx_hash": "0x123abc456def789ghi"
    }
  ]
}
```

#### 20. GET /v1/user/purchase_cost

Calculate the credit cost for a given data size.

- **Method**: `GET`
- **Headers**:
  - `Authorization: Bearer <token>`
- **URL Parameters**:
  - `data_size` (required): The size of the data in bytes.

**Example Request:**

```bash
curl -X GET "https://api.example.com/v1/user/purchase_cost?data_size=1024" \
     -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response:**

```json
{
  "state": "SUCCESS",
  "message": "Credit cost calculated successfully",
  "data": "0.0123456789"
}
```

#### 21. GET /v1/user/estimate_credits

Estimate the credits required for a given data amount.

- **Method**: `GET`
- **Headers**:
  - `Authorization: Bearer <token>`
- **URL Parameters**:
  - `data` (required): The amount of data as a decimal value.

**Example Request:**

```bash
curl -X GET "https://api.example.com/v1/user/estimate_credits?data=1024.5" \
     -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response:**

```json
{
  "state": "SUCCESS",
  "message": "Credit cost calculated successfully",
  "data": "0.0123456789"
}
```

#### 22. GET /v1/user/estimate_credits_for_bytes

Estimate the credits required for raw byte data.

- **Method**: `GET`
- **Headers**:
  - `Authorization: Bearer <token>`
- **Body**: Raw bytes that represent the data.

**Example Request:**

```bash
curl -X GET "https://api.example.com/v1/user/estimate_credits_for_bytes" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     --data-binary @./data.bin
```

**Example Response:**

```json
{
  "state": "SUCCESS",
  "message": "Credit cost calculated successfully",
  "data": "0.0123456789"
}
```

#### 23. GET /v1/user/token_map

Retrieve the list of supported tokens and their corresponding addresses.

- **Method**: `GET`
- **Headers**:
  - `Authorization: Bearer <token>`

**Example Request:**

```bash
curl -X GET "https://api.example.com/v1/user/token_map" \
     -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response:**

```json
{
  "state": "SUCCESS",
  "message": "Token map retrieved successfully",
  "data": {
    "ethereum": {
      "token_address": "0xc...",
      "other_properties": "..."
    },
    "cardano": {
      "token_address": "0xd...",
      "other_properties": "..."
    }
  }
}
```

#### 24. GET /v1/user/get_fund_list

Retrieve a list of all fund transactions for a user.

- **Method**: `GET`
- **Headers**:
  - `Authorization: Bearer <token>` - JWT token for authentication

**Example Request:**

```bash
curl -X GET "https://api.example.com/v1/user/get_fund_list" \
     -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response:**

```json
{
  "state": "SUCCESS",
  "message": "Fund list retrieved successfully",
  "data": [
    {
      "id": "uuid-string",
      "user_id": "user@example.com",
      "chain_id": 1,
      "amount_credit": "100000000000000000000",
      "request_status": "completed",
      "request_type": "credit",
      "tx_hash": "0x123abc456def789ghi",
      "created_at": "2023-01-01T12:00:00Z"
    }
  ]
}
```

### Admin Endpoints

These endpoints are restricted to users with admin privileges. All requests require admin-level authentication via a bearer token.

#### 1. GET /v1/admin/get_all_users

Retrieve details about all users in the system.

- **Method**: `GET`
- **Headers**:
  - `Authorization: Bearer <token>` (requires admin privileges)
- **Query Parameters**:
  - `limit` (optional): The limit of users to query
  - `user_id` (optional): Filter users by specific user ID

**Example Request:**

```bash
curl -X GET "https://api.example.com/v1/admin/get_all_users?limit=10&user_id=user@example.com" \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Example Response:**

```json
{
  "state": "SUCCESS",
  "message": "Users retrieved successfully",
  "data": [
    {
      "id": "user1@example.com",
      "name": "User One",
      "credit_balance": "100.00",
      "credit_used": "25.50",
      "allocated_credit_balance": "200.00"
    }
  ]
}
```

#### 2. GET /v1/admin/get_all_apps

Retrieve details about all application accounts in the system.

- **Method**: `GET`
- **Headers**:
  - `Authorization: Bearer <token>` (requires admin privileges)
- **Query Parameters**:
  - `user_id` (optional): Filter apps by user ID
  - `app_id` (optional): Filter by specific app ID

**Example Request:**

```bash
curl -X GET "https://api.example.com/v1/admin/get_all_apps?user_id=user@example.com" \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Example Response:**

```json
{
  "state": "SUCCESS",
  "message": "Apps retrieved successfully",
  "data": [
    {
      "id": "uuid-string",
      "user_id": "user@example.com",
      "app_id": 1001,
      "credit_balance": "25.00",
      "credit_used": "5.50",
      "fallback_enabled": true,
      "app_name": "My Application",
      "app_description": "Description of my application",
      "app_logo": "https://example.com/logo.png",
      "metadata_path": "path/to/metadata",
      "created_at": "2024-01-01T12:00:00Z",
      "updated_at": "2024-01-01T12:00:00Z"
    }
  ]
}
```

#### 3. GET /v1/admin/get_all_fund_requests

Retrieve all fund requests across all users.

- **Method**: `GET`
- **Headers**:
  - `Authorization: Bearer <token>` (requires admin privileges)
- **Query Parameters**:
  - `limit` (optional): Limit the number of results
  - `user_id` (optional): Filter by user ID
  - `app_id` (optional): Filter by app ID

**Example Request:**

```bash
curl -X GET "https://api.example.com/v1/admin/get_all_fund_requests?limit=10&user_id=user@example.com" \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Example Response:**

```json
{
  "state": "SUCCESS",
  "message": "Fund list retrieved successfully",
  "data": [
    {
      "id": "uuid-string",
      "user_id": "user@example.com",
      "chain_id": 1,
      "amount_credit": "100.00",
      "request_status": "PENDING",
      "request_type": "DEPOSIT",
      "tx_hash": null,
      "created_at": "2024-03-20T10:00:00Z"
    }
  ]
}
```

#### 4. POST /v1/admin/fund_user

Fund a user's account with credits.

- **Method**: `POST`
- **Headers**:
  - `Authorization: Bearer <token>` (requires admin privileges)
  - `Content-Type: application/json`
- **Body Parameters**:
  - `user_id` (required): The ID of the user to fund
  - `amount` (required): The amount of credits to add

**Example Request:**

```bash
curl -X POST "https://api.example.com/v1/admin/fund_user" \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
           "user_id": "user@example.com",
           "amount": "100.00"
         }'
```

**Example Response:**

```json
{
  "state": "SUCCESS",
  "message": "Funds Granted Successfully",
  "data": {
    "user_id": "user@example.com",
    "amount": "100.00"
  }
}
```

#### 5. GET /v1/admin/indexer_status

Retrieve the current status of the indexer service.

- **Method**: `GET`
- **Headers**:
  - `Authorization: Bearer <token>` (requires admin privileges)

**Example Request:**

```bash
curl -X GET "https://api.example.com/v1/admin/indexer_status" \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Example Response:**

```json
{
  "state": "SUCCESS",
  "message": "Indexer status retrieved successfully",
  "data": {
    "status": "RUNNING",
    "last_block_processed": 12345,
    "last_processed_at": "2024-03-20T10:00:00Z"
  }
}
```

#### 6. PUT /v1/admin/reset_retry_count

Reset the retry count for customer expenditures.

- **Method**: `PUT`
- **Headers**:
  - `Authorization: Bearer <token>` (requires admin privileges)
  - `Content-Type: application/json`
- **Body Parameters**:
  - `retry_count` (required): The new retry count value
  - `app_id` (optional): UUID of the app to reset retry count for
  - `expenditure_id` (optional): UUID of specific expenditure to reset

**Example Request:**

```bash
curl -X PUT "https://api.example.com/v1/admin/reset_retry_count" \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
           "retry_count": 0,
           "app_id": "optional-uuid",
           "expenditure_id": "optional-uuid"
         }'
```

**Example Response:**

```json
{
  "state": "SUCCESS",
  "message": "Retry count reset successfully"
}
```

**Notes for Admin Endpoints:**

- All admin endpoints require a valid admin-level bearer token
- Unauthorized access attempts will result in a 401 Unauthorized response
- These endpoints are intended for system administration and monitoring purposes
- Exercise caution when using these endpoints as they can affect system-wide operations
- The admin role is verified through the JWT token's "role" claim, which must be "admin"
