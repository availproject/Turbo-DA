# Fallback Monitor

A service that monitors and resubmits failed transactions from the core APIs.

## Overview

The fallback monitor is responsible for:

1. Monitoring failed transactions from core API endpoints
2. Analyzing failure reasons
3. Attempting to resubmit transactions with adjusted parameters
4. Logging resubmission attempts and results

## How it Works

The service periodically checks for failed transactions in the system. When it detects a failure:

1. It retrieves the original transaction details
2. Analyzes the failure reason (e.g. gas price too low, network congestion)
3. Attempts to resubmit the transaction
4. Tracks the resubmission status

## Configuration

The monitor can be configured with:

- [TODO] Check interval
- Maximum retry attempts
- Logging level

## Usage

To run the fallback monitor:

`cargo run`

To build

`cargo build`
