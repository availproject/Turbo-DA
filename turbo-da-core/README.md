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

This API allows users to interact with Gas Relay Service. Below are the available endpoints and their usage.

## Authentication

All requests require authentication via a bearer token passed in the headers.

```bash
Authorization: Bearer <YOUR_TOKEN>
```

## Endpoints

### 1. POST /user/register_new_user

Register a new User.

- **URL**: `/users/register_new_user`
- **Method**: `POST`
- **Headers**:
  - `Authorization: Bearer <token>`
- **Body Parameters**:
  - `name` : Name of the user.
  - `app_id` : App ID for the user on Avail.

#### Example Request:

```bash
curl -X POST "https://api.example.com/users/register_new_user" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
           "name": "John Doe",
           "app_id": 1001
         }'

```

#### Example Response:

```json
{
  "id": "1",
  "name": "John Doe",
  "email": "john@example.com",
  "app_id": 1001,
  "assigned_wallet": "0x123abc456def789ghi"
}
```

### 2. GET /user/get_user

Create a new user.

- **URL**: `/users/get_user`
- **Method**: `GET`
- **Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Body Parameters**:
  - `name` (required): User's name.
  - `email` (required): User's email address.

#### Example Request:

```bash
curl -X GET "https://api.example.com/user/get_user" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json"
```

#### Example Response:

```json
{
  "id": "1",
  "name": "John Doe",
  "email": "john@example.com",
  "app_id": 1001,
  "assigned_wallet": "0x123abc456def789ghi"
}
```

### 3. GET /admin/get_all_users

Retrieve details about all users.

- **URL**: `/admin/get_all_users`
- **Method**: `GET`
- **Headers**:
  - `Authorization: Bearer <token>`
- **URL Parameters**:
  - `limit` (required): The limit of users to query.

#### Example Request:

```bash
curl -X GET "https://api.example.com/admin/get_all_users" \
     -H "Authorization: Bearer YOUR_TOKEN"
```

#### Example Response:

```json
[
  {
    "id": "1",
    "name": "John Doe",
    "email": "john@example.com",
    "app_id": 1001,
    "assigned_wallet": "0x123abc456def789ghi"
  },
  {
    "id": "2",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "app_id": 1002,
    "assigned_wallet": "0xabc456def789ghi123"
  }
]
```

### 4. GET /user/get_all_tokens

Retrieve details about all tokens of a user.

- **URL**: `/user/get_all_tokens`
- **Method**: `GET`
- **Headers**:
  - `Authorization: Bearer <token>`
- **URL Parameters**:
  - `limit` (required): The limit of users to query.

#### Example Request:

```bash
curl -X GET "https://api.example.com//user/get_all_tokens" \
     -H "Authorization: Bearer YOUR_TOKEN"
```

#### Example Response:

```json
[
  {
    "token_details_id": 1,
    "user_id": "user_2lO5zzxhV08hooYiSCOkfWfPxls",
    "token_address": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    "token_balance": "100000000000000000000"
  },
  {
    "token_details_id": 2,
    "user_id": "user_2lO5zzxhV08hooYiSCOkfWfPxls",
    "token_address": "0xc0bbb3139b223fe8d0a0e5c4f27ead9083c756cc2",
    "token_balance": "100000000000000000000"
  }
]
```

### 5. GET /user/get_token

Retrieve details about a token.

- **URL**: `/user/get_token`
- **Method**: `GET`
- **Headers**:
  - `Authorization: Bearer <token>`
- **URL Parameters**:
  - `token_details_id` (required): The registered id of the token against the user information in Token Details DB table.

#### Example Request:

```bash
curl -X GET "https://api.example.com/user/get_token" \
     -H "Authorization: Bearer YOUR_TOKEN"
```

### 6. GET /user/get_token_using_address

Retrieve details about a token using address.

- **URL**: `/user/get_token_using_address`
- **Method**: `GET`
- **Headers**:
  - `Authorization: Bearer <token>`
- **URL Parameters**:
  - `token_details_id` (required): The registered id of the token against the user information in Token Details DB table.

#### Example Request:

```bash
curl -X GET "https://api.example.com//user/get_token_using_address" \
     -H "Authorization: Bearer YOUR_TOKEN"
```

#### Example Response:

```json
{
  "token_details_id": 1,
  "user_id": "user_2lO5zzxhV08hooYiSCOkfWfPxls",
  "token_address": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  "token_balance": "100000000000000000000"
}
```

### 7. POST /user/register_new_token

Register a new token.

- **URL**: `/users/register_new_token`
- **Method**: `POST`
- **Headers**:
  - `Authorization: Bearer <token>`
- **Body Parameters**:
  - `token_address` : A whitelisted address of a token user wants to subscribe to.

#### Example Request:

```bash
curl -X POST "https://api.example.com/user/register_new_token" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
           "name": "John Doe",
           "app_id": 1001
         }'

```

#### Example Response:

```json
{
  "token_details_id": 1,
  "user_id": "user_2lO5zzxhV08hooYiSCOkfWfPxls",
  "token_address": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  "token_balance": "100000000000000000000"
}
```

### 11. GET /token_map

Retrieve supported token lists.

- **URL**: `/token_map`
- **Method**: `GET`

#### Example Request:

```bash
curl -X GET "https://api.example.com/token_map"
```

#### Example Response:

```json
{
  "etherum": "0xc...",
  "cardano": "0xd..."
}
```

### 12. GET /user/get_all_expenditure

Retrieve details about a expenditures done by a user.

- **URL**: `/user/get_all_expenditure`
- **Method**: `GET`
- **Headers**:
  - `Authorization: Bearer <token>`
- **URL Parameters**:
  - `limit` ( optional ): limit of entries you want in response.

#### Example Request:

```bash
curl -X GET "https://api.example.com/user/get_all_expenditure" \
     -H "Authorization: Bearer YOUR_TOKEN"
```

#### Example Response:

```json
[
  {
    "id": "b9a3f58e-0f49-4e3b-9466-f28d73d75e0a",
    "user_id": "user_2lO5zzxhV08hooYiSCOkfWfPxls",
    "token_details_id": 1,
    "extrinsic_index": 42,
    "amount_data": "100.00",
    "fees": "0.01",
    "to_address": "0x123abc456def789ghi",
    "block_hash": "0xabcdef1234567890",
    "data_hash": "0xdeadbeef12345678",
    "tx_hash": "0xabcdef9876543210",
    "created_at": "2024-09-11T12:34:56"
  }
]
```

### 13. GET /user/get_token_expenditure

Retrieve details about a expenditure done using a given token.

- **URL**: `/user/get_token_expenditure`
- **Method**: `GET`
- **Headers**:
  - `Authorization: Bearer <token>`
- **URL Parameters**:
  - `token_id`: Token table id to check the expenditure against.

#### Example Request:

```bash
curl -X GET "https://api.example.com/user/get_token_expenditure" \
     -H "Authorization: Bearer YOUR_TOKEN"
```

#### Example Response:

```json
[
  {
    "id": "b9a3f58e-0f49-4e3b-9466-f28d73d75e0a",
    "user_id": "user_2lO5zzxhV08hooYiSCOkfWfPxls",
    "token_details_id": 1,
    "extrinsic_index": 42,
    "amount_data": "100.00",
    "fees": "0.01",
    "to_address": "0x123abc456def789ghi",
    "block_hash": "0xabcdef1234567890",
    "data_hash": "0xdeadbeef12345678",
    "tx_hash": "0xabcdef9876543210",
    "created_at": "2024-09-11T12:34:56"
  }
]
```

### 14. GET /user/get_submission_info

Retrieve details about a expenditure done using a given token.

- **URL**: `/user/get_submission_info`
- **Method**: `GET`
- **Headers**:
  - `Authorization: Bearer <token>`
- **URL Parameters**:
  - `submission_id`: Submission id to get info for.

#### Example Request:

```bash
curl -X GET "https://api.example.com/user/get_submission_info?submission_id=b9a3f58e-0f49-4e3b-9466-f28d73d75e0a" \
     -H "Authorization: Bearer YOUR_TOKEN"
```

#### Example Response:

```json
{
  "id": "b9a3f58e-0f49-4e3b-9466-f28d73d75e0a",
  "user_id": "user_2lO5zzxhV08hooYiSCOkfWfPxls",
  "token_details_id": 1,
  "extrinsic_index": 42,
  "amount_data": "100.00",
  "fees": "0.01",
  "to_address": "0x123abc456def789ghi",
  "block_hash": "0xabcdef1234567890",
  "data_hash": "0xdeadbeef12345678",
  "tx_hash": "0xabcdef9876543210",
  "created_at": "2024-09-11T12:34:56"
}
```

### 15. POST /user/submit_data

Submit data to avail using JSON payload.

- **URL**: `/user/submit_data`
- **Method**: `POST`
- **Headers**:
  - `Authorization: Bearer <token>`
- **Body Parameters**:
  - `data` : Stringified payload.
  - `token`: The token corresponding to which you wanna make the payment.

#### Example Request:

```bash
curl -X POST "https://api.example.com/user/submit_data
" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
           "data": "Test",
           "token": "ethereum"
         }'

```

### 16. POST /user/submit_raw_data

Submit data to avail using JSON payload.

- **URL**: `/user/submit_raw_data`
- **Method**: `POST`
- **Headers**:
  - `Authorization: Bearer <token>`
- **URL Parameters**:
  - `token`: Token name based on `token_map` endpoint result.
- **Body Parameters**:
  - Payload as raw byte data

#### Example Request:

```bash
curl -X POST "https://api.example.com/user/submit_raw_data?token=ethereum
" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '011010101010101010100101'

```

### 17. GET /user/get_pre_image

Submit data to avail using JSON payload.

- **URL**: `/user/get_pre_image`
- **Method**: `GET`
- **Headers**:
  - `Authorization: Bearer <token>`
- **URL Parameters**:
  - `submission_id`: Submission ID value.

#### Example Request:

```bash
curl -X POST "https://api.example.com/user/get_pre_image?submission_id="<SUBMISSION_ID>"
" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json"

```

## Error Handling

- **401 Unauthorized**: Invalid or missing token.
- **404 Not Found**: The requested resource does not exist.
- **400 Bad Request**: Missing required parameters or invalid request.
- **500 Internal Server Error**: Something unexpected happened on the server side.

[] P0: Write tests: just check customer_expenditure exists, check user creation, fund creation, funding etc. - setup docker avail - start alice user and do transactions
[] ( not imp for audit )Integration test: - Create new setup - one account - create user - create token - fund - submit - check
