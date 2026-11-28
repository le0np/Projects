-- T15: guests play with only a name; they can later save the account with an email and a password.
ALTER TABLE users ADD COLUMN is_guest boolean NOT NULL DEFAULT false;
