# Data Submission Service

The Data Submission service is a component of TurboDA that handles submitting data to the Avail chain. It provides endpoints for submitting both JSON and raw byte data, with support for multiple token payments.

## Overview

Key features:

- Submit data in JSON or raw byte format
- Multi-token payment support
- Pre-image retrieval for submitted data
- Rate limiting and request queuing
- Automatic retry on failures

## Usage

1. Configure environment variables in `.env` file (see `.env.example`)
2. Start the service:

## API Reference

### 1. POST v1/submit_data

Submit data to avail using JSON payload.

- **URL**: `/submit_data`
- **Method**: `POST`
- **Headers**:
  - `x-api-key <API-KEY>`
- **Body Parameters**:
  - `data` : Stringified payload.
  - 
#### Example Request:

```bash
curl -X POST "https://api.example.com/v1/submit_data
" \
     -H "x-api-key: <API KEY>" \
     -H "Content-Type: application/json" \
     -d '{
           "data": "Test",
         }'

```

### 2. POST v1/submit_raw_data

Submit data to avail using JSON payload.

- **URL**: `/submit_raw_data`
- **Method**: `POST`
- **Headers**:
  - `x-api-key <API-KEY>`
- **Body Parameters**:
  - Payload as raw byte data

#### Example Request:

```bash
curl -X POST "https://api.example.com/v1/submit_raw_data
" \
     -H "x-api-key <API-KEY>" \
     -H "Content-Type: application/json" \
     -d '011010101010101010100101'

```

### 3. GET v1/get_pre_image

Submit data to avail using JSON payload.

- **URL**: `/get_pre_image`
- **Method**: `GET`
- **Headers**:
  - `x-api-key <API-KEY>`
- **URL Parameters**:
  - `submission_id`: Submission ID value.

#### Example Request:

```bash
curl -X POST "https://api.example.com/v1/get_pre_image?submission_id="<SUBMISSION_ID>"
" \
     -H "x-api-key <API-KEY>" \
     -H "Content-Type: application/json"

```

### 4. GET v1/get_submission_info

Retrieve details about a expenditure done using a given token.

- **URL**: `/get_submission_info`
- **Method**: `GET`
- **Headers**:
  - `x-api-key <API-KEY>`
- **URL Parameters**:
  - `submission_id`: Submission id to get info for.

#### Example Request:

```bash
curl -X GET "https://api.example.com/v1/get_submission_info?submission_id=b9a3f58e-0f49-4e3b-9466-f28d73d75e0a" \
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
