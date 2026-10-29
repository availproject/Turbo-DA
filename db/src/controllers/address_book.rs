use crate::{
    models::address_book::{AddressBookCreate, AddressBookEntry},
    schema::address_book::dsl::*,
};
use diesel::prelude::*;
use diesel_async::{AsyncPgConnection, RunQueryDsl};
use uuid::Uuid;

pub async fn list(
    conn: &mut AsyncPgConnection,
    user: &String,
) -> Result<Vec<AddressBookEntry>, diesel::result::Error> {
    address_book
        .filter(user_id.eq(user))
        .order(created_at.desc())
        .select(AddressBookEntry::as_select())
        .load::<AddressBookEntry>(conn)
        .await
}

/// A duplicate address for the same user surfaces as a unique violation from
/// `address_book_user_address_idx`; the error is passed through untouched so
/// callers can map it to a 409.
pub async fn create(
    conn: &mut AsyncPgConnection,
    entry: &AddressBookCreate,
) -> Result<AddressBookEntry, diesel::result::Error> {
    diesel::insert_into(address_book)
        .values(entry)
        .returning(AddressBookEntry::as_returning())
        .get_result(conn)
        .await
}

pub async fn update(
    conn: &mut AsyncPgConnection,
    user: &String,
    entry_id: &Uuid,
    new_name: &str,
    new_role: Option<String>,
) -> Result<usize, diesel::result::Error> {
    diesel::update(
        address_book
            .filter(id.eq(entry_id))
            .filter(user_id.eq(user)),
    )
    .set((
        name.eq(new_name),
        role.eq(new_role),
        updated_at.eq(diesel::dsl::now),
    ))
    .execute(conn)
    .await
}

pub async fn delete(
    conn: &mut AsyncPgConnection,
    user: &String,
    entry_id: &Uuid,
) -> Result<usize, diesel::result::Error> {
    diesel::delete(
        address_book
            .filter(id.eq(entry_id))
            .filter(user_id.eq(user)),
    )
    .execute(conn)
    .await
}
