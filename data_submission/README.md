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

### 1. POST /submit_data

Submit data to avail using JSON payload.

- **URL**: `/submit_data`
- **Method**: `POST`
- **Headers**:
  - `Authorization: Bearer <token>`
- **Body Parameters**:
  - `data` : Stringified payload.
  - `token`: The token corresponding to which you wanna make the payment.

#### Example Request:

```bash
curl -X POST "https://api.example.com/submit_data
" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
           "data": "Test",
           "token": "ethereum"
         }'

```

### 2. POST /submit_raw_data

Submit data to avail using JSON payload.

- **URL**: `/submit_raw_data`
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

### 3. GET /get_pre_image

Submit data to avail using JSON payload.

- **URL**: `/get_pre_image`
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
