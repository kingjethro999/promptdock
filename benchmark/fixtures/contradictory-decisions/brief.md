# Database decision

Earlier I considered MongoDB. After reviewing the existing application, the final decision is to keep PostgreSQL and preserve the current schema. Do not migrate the data or replace the database.

Keep existing account records. Add the requested account-linking feature using the current identity table. Do not create duplicate accounts, and add a regression test for this rule.
