// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const designs = sqliteTable('designs', { id: text('id').primaryKey(), name: text('name').notNull(), category: text('category').notNull(), createdAt: text('created_at').notNull() });
export const versions = sqliteTable('versions', { id: text('id').primaryKey(), designId: text('design_id').notNull().references(()=>designs.id), number: integer('number').notNull(), html: text('html').notNull(), author: text('author').notNull(), role: text('role').notNull(), notes: text('notes').notNull(), source: text('source').notNull(), createdAt: text('created_at').notNull(), status: text('status').notNull().default('In review') });
