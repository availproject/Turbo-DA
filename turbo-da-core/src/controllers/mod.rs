/// This entire module contains controllers which take data and do DB operations accordingly.
/// Scope covers all listed tables: customer_expenditure, users, fund, token_balances ( excludes failed_transactions )
pub mod customer_expenditure;
pub mod file;
pub mod fund;
pub mod kyc;
pub mod misc;
mod test;
pub mod users;
