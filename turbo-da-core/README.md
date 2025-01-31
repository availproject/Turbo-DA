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

- **URL**: `/user/register_new_user`
- **Method**: `POST`
- **Headers**:
  - `Authorization: Bearer <token>`
- **Body Parameters**:
  - `name` : Name of the user.
  - `app_id` : App ID for the user on Avail.

#### Example Request:

```bash
curl -X POST "https://api.example.com/user/register_new_user" \
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

- **URL**: `/user/get_user`
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

## Error Handling

- **401 Unauthorized**: Invalid or missing token.
- **404 Not Found**: The requested resource does not exist.
- **400 Bad Request**: Missing required parameters or invalid request.
- **500 Internal Server Error**: Something unexpected happened on the server side.
