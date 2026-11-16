# Forum channel deployment

Run `npm run migration:run` in `campusgg-backend` with the target `DATABASE_URL` and, if applicable, `DATABASE_SCHEMA` before deploying code that uses game channels. The migration creates and seeds `forum_channels`; it does not update or delete forum posts. A repeat execution preserves existing rows and rejects conflicting channel identities or duplicate, non-normalized aliases. Resolve any reported conflict before retrying; do not change an existing channel ID or slug without a coordinated migration.

The migration intentionally has no automatic down operation. `npm run migration:revert` will fail while it is the latest migration, leaving its migration record and channel data in place. Rolling application code back must retain this table; reversing the database change requires a separately reviewed migration after checking for all dependencies, including future subscriptions. Take normal database backups before deployment.

Channel aliases are validated when this migration runs, but the array column does not enforce cross-row alias uniqueness on later manual edits. Catalog changes need a reviewed migration and tests to preserve unique, lowercase, trimmed aliases and stable identities. Unsupported historical game strings and posts without games remain on Forum Home.

Run `npm run migration:run` after deploying the channel catalog migration to add `forum_channel_follows`. The migration creates an indexed user/channel relationship with cascading foreign keys and a composite primary key. Reverting it deletes all subscription data; back up or retain that data if a rollback is needed. No existing channel or post rows are changed.
