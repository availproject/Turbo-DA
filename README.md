# Turbo Data

TurboDA is a service that posts data on users’ behalf. Users can buy “credits” which allow them to post data via the service at a guaranteed rate. It handles all the error logic internally, and can respond immediately with a “pre-confirmation” even before the data is finalized on the Avail chain.

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

## Environment Setup

<details>
  <summary>DB</summary>

    The `db` crate is a local crate that provides database functionalities for the Turbo Data Availability Core Service. It is included as a dependency in the `Cargo.toml` file. The `migrations.sh` file setups your db migration and initializes the required table as per config file provided. Configs are stored inside `config.json`:

    {
    "db_host": "localhost",
    "db_name": "turbo_da_core",
    "db_user": "postgres",
    "db_password": "password",
    "block_entries": [
        {
        "chain_id": 1, // chain id of the chain the funds monitor will monitor
        "block_number": 12345, // block number from where the funds monitor should start it's indexing ( default 0 )
        "block_hash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" // block hash corresponding to block number
        },
        {
        "chain_id": 2,
        "block_number": 67890,
        "block_hash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
        }
    ]
    }

    ```

</details>

<details>
  <summary>Turbo DA Core</summary>

You can use a `config.toml` or a `.env`:

```env
PORT=8080                  # PORT is the port on which the server will run
DATABASE_URL=              # DATABASE_URL is the connection string to the database
REDIS_URL=                 # REDIS_URL is the connection string to the redis database
MAX_POOL_SIZE=             # MAX_POOL_SIZE is the maximum number of connections in the connection pool. Ideally, try not to keep it too low for increased throughput.
AVAIL_RPC_ENDPOINT_1=      # AVAIL_RPC_ENDPOINT_1 is the first RPC endpoint of the Avail chain
AVAIL_RPC_ENDPOINT_2=      # AVAIL_RPC_ENDPOINT_2 is the second RPC endpoint of the Avail chain
AVAIL_RPC_ENDPOINT_3=      # AVAIL_RPC_ENDPOINT_3 is the third RPC endpoint of the Avail chain
TOTAL_USERS_QUERY_LIMIT=   # TOTAL_USERS_QUERY_LIMIT is the maximum number of users to be queried in a single request. This is used to limit the number of users to be queried in a single request.
COINGECKO_API_URL=         # COINGECKO_API_URL is the URL of the CoinGecko API. This is used to get the price of the token in USD.
COINGECKO_API_KEY=         # COINGECKO_API_KEY is the API key of the CoinGecko API. This is used to get the price of the token in USD.
DATABASE_URL_TEST=         # DATABASE_URL_TEST is the connection string to the test database. This is used to test the database connection. Ideally don't set this as in the .env file but using export in the terminal.
RATE_LIMIT_MAX_REQUESTS=15 # RATE_LIMIT_MAX_REQUESTS is the maximum number of requests that a user can make in a given time window.
RATE_LIMIT_WINDOW_SIZE=60  # RATE_LIMIT_WINDOW_SIZE is the time window in seconds for the rate limit.
```

</details>

<details>
  <summary>Funds Monitor</summary>
  This services monitors different chain for deposits and withdrawals.

```env
DATABASE_URL=postgres://user:password@localhost:5432/db
AVAIL_RPC_URL=
MAXIMUM_PENDING_REQUESTS=100
COINGECKO_API_URL=https://api.coingecko.com/api/v3
COINGECKO_API_KEY=YOUR_API_KEY

# All the names start with NETWORK_<NETWORK_NAME>_ for example NETWORK_ETHEREUM_CONTRACT_ADDRESS.
# Ethereum network
NETWORK_ETHEREUM_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000 # This is the smart contract address to make the payment to. .
NETWORK_ETHEREUM_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID            # This is the RPC endpoint of the Ethereum network.
NETWORK_ETHEREUM_WS_URL=wss://mainnet.infura.io/ws/v3/YOUR_PROJECT_ID        # This is the WebSocket endpoint of the Ethereum network.
NETWORK_ETHEREUM_CHAIN_ID=1                                                  # This is the chain ID of the Ethereum network.

# Base network
NETWORK_BASE_CONTRACT_ADDRESS=0x1111111111111111111111111111111111111111
NETWORK_BASE_URL=https://rpc.base.org
NETWORK_BASE_WS_URL=wss://ws.base.org
NETWORK_BASE_CHAIN_ID=8453

```

</details>

<details>
  <summary>Fallback Monitor</summary>
  This service monitors the transactions that have failed, and attempts to resubmit them.

```env
DATABASE_URL=         # The database URL to use for the fallback monitor.
PRIVATE_KEY=          # The private key to use for the fallback monitor.
COINGECKO_API_URL=    # The Coingecko API URL to use for the fallback monitor.
COINGECKO_API_KEY=    # The Coingecko API key to use for the fallback monitor.
AVAIL_RPC_ENDPOINT_1= # The first Avail RPC endpoint to use for the fallback monitor.
RETRY_COUNT=          # The retry count to try a particular transaction before giving up.

```

</details>

<details>
  <summary>Data Submission Service</summary>
  This service used to actually submit data.

```env
PORT=8080                  # PORT is the port on which the server will run
DATABASE_URL=         # DATABASE_URL is the connection string to the database
REDIS_URL=            # REDIS_URL is the connection string to the redis database
NUMBER_OF_THREADS=    # NUMBER_OF_THREADS is the number of threads to be used for the workload scheduler. This is used to vertically scale the workload scheduler.
MAX_POOL_SIZE=        # MAX_POOL_SIZE is the maximum number of connections in the connection pool. Ideally, try not to keep it too low for increased throughput.
AVAIL_RPC_ENDPOINT_1= # AVAIL_RPC_ENDPOINT_1 is the first RPC endpoint of the Avail chain
AVAIL_RPC_ENDPOINT_2= # AVAIL_RPC_ENDPOINT_2 is the second RPC endpoint of the Avail chain
AVAIL_RPC_ENDPOINT_3= # AVAIL_RPC_ENDPOINT_3 is the third RPC endpoint of the Avail chain
PRIVATE_KEY_0=        # PRIVATE_KEY_0 is the private key of the first signer. One private key is used per thread defined by NUMBER_OF_THREADS. So thread 0 will use PRIVATE_KEY_0, thread 1 will use PRIVATE_KEY_1, and so on.
PRIVATE_KEY_1=
PRIVATE_KEY_2=
PRIVATE_KEY_3=
PRIVATE_KEY_4=
PRIVATE_KEY_5=
PRIVATE_KEY_6=
PRIVATE_KEY_7=
BROADCAST_CHANNEL_SIZE=     # BROADCAST_CHANNEL_SIZE is the size of the broadcast channel. You can think of this as the mempool size of the core API.
PAYLOAD_SIZE=               # PAYLOAD_SIZE is the size of the payload to be sent to the Avail chain. This is used to define the size of the payload to be sent to the Avail chain.
DATABASE_URL_TEST=          # DATABASE_URL_TEST is the connection string to the test database. This is used to test the database connection. Ideally don't set this as in the .env file but using export in the terminal.
MAXIMUM_PENDING_REQUESTS=50 # MAXIMUM_PENDING_REQUESTS is the maximum number of pending requests that a user can have at a time.
RATE_LIMIT_MAX_REQUESTS=15  # RATE_LIMIT_MAX_REQUESTS is the maximum number of requests that a user can make in a given time window.
RATE_LIMIT_WINDOW_SIZE=60   # RATE_LIMIT_WINDOW_SIZE is the time window in seconds for the rate limit.

```

</details>
